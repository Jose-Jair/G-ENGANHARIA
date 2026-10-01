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
    const ontem = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000)

    const formatYmd = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const dataFinal = params.dataFinal || formatYmd(hoje)
    const dataInicial = params.dataInicial || formatYmd(ontem)
    const codigoModalidade = params.codigoModalidade || 6 // Pregão Eletrônico
    const pagina = params.pagina || 1
    const tamanhoPagina = Math.max(10, Math.min(50, params.tamanhoPagina || 10))

    const query = new URLSearchParams({
      dataInicial,
      dataFinal,
      codigoModalidadeContratacao: String(codigoModalidade),
      pagina: String(pagina),
      tamanhoPagina: String(tamanhoPagina),
    })

    if (params.uf && params.uf !== 'todas') {
      query.append('uf', params.uf.toUpperCase())
    }

    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${query.toString()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      let items: PncpItemCompra[] = json.data || []

      // Se houver filtro por termo/palavra-chave, filtrar no cliente
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
      console.warn('Falha ou instabilidade na consulta PNCP:', msg)

      return {
        success: false,
        totalRegistros: 0,
        items: [],
        aviso:
          'A API pública do PNCP pode estar temporariamente indisponível ou instável no ambiente de rede. Você pode importar sugestões normalmente via planilha CSV/XLSX.',
        erro: msg,
      }
    }
  },
}
