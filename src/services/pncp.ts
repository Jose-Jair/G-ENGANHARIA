/**
 * Serviço de Integração com o Portal Nacional de Contratações Públicas (PNCP)
 * Endpoint oficial: https://pncp.gov.br/api/consulta/v1
 * Consulta compras e contratações públicas para alimentação da Fila de Sugestões
 */

export interface PncpItemCompra {
  numeroControlePNCP?: string
  sequencialCompra?: number
  anoCompra?: number
  objetoCompra?: string
  valorTotalEstimado?: number
  valorTotalHomologado?: number
  modalidadeNome?: string
  dataPublicacaoPncp?: string
  dataAberturaProposta?: string
  dataEncerramentoProposta?: string
  linkSistemaOrigem?: string
  orgaoEntidade?: {
    cnpj?: string
    razaoSocial?: string
    esferaId?: string
    poderId?: string
  }
  unidadeOrgao?: {
    ufSigla?: string
    municipioNome?: string
    nomeUnidade?: string
  }
}

export interface PncpSearchParams {
  termo?: string
  uf?: string
  dataInicial?: string // formato YYYYMMDD
  dataFinal?: string // formato YYYYMMDD
  codigoModalidade?: number // 6 = pregão eletrônico, 4 = concorrência eletrônica, etc.
  pagina?: number
  tamanhoPagina?: number
}

import { registrarErroSistema } from './operacaoSistema'
import pb from '../lib/pocketbase/client'

export interface PncpSearchResult {
  success: boolean
  totalRegistros: number
  items: PncpItemCompra[]
  aviso?: string
  erro?: string
}

export const pncpService = {
  /**
   * Consulta compras públicas no PNCP com tratamento de erros, CORS e timeout amigável
   */
  async consultarContratacoes(params: PncpSearchParams = {}): Promise<PncpSearchResult> {
    const hoje = new Date()
    // Default: últimos 7 dias se não especificado
    const dataPassada = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000)

    const formatYmd = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const dataFinal = params.dataFinal || formatYmd(hoje)
    const dataInicial = params.dataInicial || formatYmd(dataPassada)
    const codigoModalidade = params.codigoModalidade || 6 // 6 = Pregão Eletrônico
    const pagina = params.pagina || 1
    // A API oficial do PNCP rejeita estritamente tamanhoPagina > 50 (retornando erro 400/422).
    // Limitamos no máximo a 50 (padrão 50 para termos boa cobertura na filtragem local por palavra-chave).
    const tamanhoPagina = Math.max(1, Math.min(50, params.tamanhoPagina || 50))

    // Validar formato estrito AAAAMMDD
    const regexAaaammdd = /^\d{8}$/
    const dataIniValida = regexAaaammdd.test(dataInicial) ? dataInicial : formatYmd(dataPassada)
    const dataFimValida = regexAaaammdd.test(dataFinal) ? dataFinal : formatYmd(hoje)

    // Primeiro tentar via backend proxy se disponível, ou direto à API pública
    const query = new URLSearchParams({
      dataInicial: dataIniValida,
      dataFinal: dataFimValida,
      codigoModalidadeContratacao: String(codigoModalidade),
      pagina: String(pagina),
      tamanhoPagina: String(tamanhoPagina),
    })

    if (params.uf && params.uf.toLowerCase() !== 'todas') {
      query.append('uf', params.uf.toUpperCase())
    }

    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${query.toString()}`

    let statusHttp = 0
    let corpoErro = ''

    try {
      // 1. Tentar primeiro via endpoint dedicado no backend (evita bloqueios de CORS do navegador)
      let backendOk = false
      let itemsBackend: PncpItemCompra[] = []
      let totalBackend = 0

      try {
        const proxyData = await pb.send<{ data?: PncpItemCompra[]; totalRegistros?: number }>(
          `/backend/v1/prospeccao/pncp/consultar-publicacoes?${query.toString()}`,
          { method: 'GET' },
        )
        if (proxyData && Array.isArray(proxyData.data)) {
          itemsBackend = proxyData.data
          totalBackend = proxyData.totalRegistros || itemsBackend.length
          backendOk = true
        }
      } catch (eProxy: any) {
        statusHttp = eProxy?.status || 0
        corpoErro = eProxy?.data?.details || eProxy?.message || String(eProxy)
      }

      if (backendOk) {
        let items = itemsBackend
        if (params.termo && params.termo.trim()) {
          const termoClean = params.termo.toLowerCase().trim()
          items = items.filter((it) => {
            const obj = (it.objetoCompra || '').toLowerCase()
            const orgao = (it.orgaoEntidade?.razaoSocial || '').toLowerCase()
            const mun = (it.unidadeOrgao?.municipioNome || '').toLowerCase()
            return (
              obj.includes(termoClean) || orgao.includes(termoClean) || mun.includes(termoClean)
            )
          })
        }
        return {
          success: true,
          totalRegistros: totalBackend,
          items,
        }
      }

      // 2. Chamada direta ao PNCP
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      statusHttp = res.status

      if (!res.ok) {
        corpoErro = await res.text().catch(() => '')
        throw new Error(
          `HTTP ${res.status}: ${res.statusText || 'Erro retornado pela API do PNCP'}`,
        )
      }

      const json = await res.json()
      let items: PncpItemCompra[] = json.data || []

      // Se houver filtro por termo/palavra-chave, filtrar no cliente pelo objetoCompra e órgão
      if (params.termo && params.termo.trim()) {
        const termoClean = params.termo.toLowerCase().trim()
        items = items.filter((it) => {
          const obj = (it.objetoCompra || '').toLowerCase()
          const orgao = (it.orgaoEntidade?.razaoSocial || '').toLowerCase()
          const mun = (it.unidadeOrgao?.municipioNome || '').toLowerCase()
          return obj.includes(termoClean) || orgao.includes(termoClean) || mun.includes(termoClean)
        })
      }

      return {
        success: true,
        totalRegistros: json.totalRegistros || items.length,
        items,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Falha ou instabilidade na consulta PNCP:', msg, corpoErro)

      // Registrar erro detalhado na coleção erros_sistema
      try {
        await registrarErroSistema(
          '/backend/v1/prospeccao/pncp/consultar-publicacoes',
          `Falha na consulta PNCP: status ${statusHttp || 0}. ${msg}`,
          {
            url,
            statusHttp,
            corpoErro: corpoErro.slice(0, 1000),
            params,
          },
        )
      } catch (errLog) {
        console.warn('Não foi possível gravar na tabela erros_sistema:', errLog)
      }

      const mensagemErroDetalhada = statusHttp
        ? `Falha na API PNCP [HTTP ${statusHttp}]: ${corpoErro ? corpoErro.slice(0, 200) : msg}`
        : `Falha de conexão com a API do PNCP: ${msg}`

      return {
        success: false,
        totalRegistros: 0,
        items: [],
        aviso: mensagemErroDetalhada,
        erro: mensagemErroDetalhada,
      }
    }
  },
}
