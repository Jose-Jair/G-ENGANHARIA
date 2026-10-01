import pb from '@/lib/pocketbase/client'
import { PropostaRecord, PropostaItemRecord, PropostaRevisaoHistorico } from '@/types'

export interface CreatePropostaData {
  numero?: string
  revisao?: string
  empresa?: string
  cliente_pf?: string
  contrato?: string
  modelo?: string
  escopo: string
  disciplinas?: string
  entregaveis?: string
  prazo?: string
  preco: number
  custo?: number
  margem?: number
  impostos?: number
  condicoes_pagamento?: string
  validade?: string
  premissas?: string
  exclusoes?: string
  status?: PropostaRecord['status']
  token_aceite?: string
  itens_json?: PropostaItemRecord[]
  historico_revisoes?: PropostaRevisaoHistorico[]
  criado_por?: string
  requer_aprovacao_admin?: boolean
}

export interface UpdatePropostaData extends Partial<CreatePropostaData> {
  motivo_recusa?: string
  detalhe_recusa?: string
  data_visualizacao?: string
  data_aceite?: string
  data_recusa?: string
  parecer_financeiro?: string
  aprovador_financeiro?: string
  data_aprovacao_financeira?: string
  aprovador_admin?: string
  data_aprovacao_admin?: string
}

export interface PropostaFilters {
  status?: string
  empresaId?: string
  clientePfId?: string
  busca?: string
  periodoMes?: string
}

export interface MetricasPropostas {
  totalCriadas: number
  totalEnviadas: number
  totalAceitas: number
  totalRecusadas: number
  totalExpiradas: number
  totalEmNegociacao: number
  taxaAceite: number // (aceitas / enviadas_totais) * 100
  valorTotalAceitas: number
  recusasPorMotivo: Record<string, number>
}

export const propostasService = {
  async list(filters?: PropostaFilters): Promise<PropostaRecord[]> {
    const filterClauses: string[] = []

    if (filters?.status && filters.status !== 'todos') {
      filterClauses.push(`status = '${filters.status}'`)
    }
    if (filters?.empresaId) {
      filterClauses.push(`empresa = '${filters.empresaId}'`)
    }
    if (filters?.clientePfId) {
      filterClauses.push(`cliente_pf = '${filters.clientePfId}'`)
    }

    const filter = filterClauses.join(' && ')

    return pb.collection('propostas').getFullList<PropostaRecord>({
      filter: filter || undefined,
      sort: '-created',
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por,aprovador_financeiro,aprovador_admin',
    })
  },

  async getById(id: string): Promise<PropostaRecord> {
    return pb.collection('propostas').getOne<PropostaRecord>(id, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por,aprovador_financeiro,aprovador_admin',
    })
  },

  async getByToken(token: string): Promise<PropostaRecord | null> {
    try {
      const records = await pb.collection('propostas').getFullList<PropostaRecord>({
        filter: `token_aceite = '${token}'`,
        expand: 'empresa,cliente_pf,contrato',
        requestKey: null,
      })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar proposta pelo token:', err)
      return null
    }
  },

  async create(data: CreatePropostaData): Promise<PropostaRecord> {
    return pb.collection('propostas').create<PropostaRecord>(data, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por',
    })
  },

  async update(id: string, data: UpdatePropostaData): Promise<PropostaRecord> {
    return pb.collection('propostas').update<PropostaRecord>(id, data, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por,aprovador_financeiro,aprovador_admin',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('propostas').delete(id)
  },

  /**
   * Cálculo de Alçada:
   * Comercial aprova sozinho até R$ 100 mil E margem >= 20%.
   * Acima disso, requer aprovação do Admin.
   * Financeiro participa da aprovação interna (leitura + parecer).
   */
  avaliarAlcada(
    preco: number,
    margemPercent: number,
    limiteValor: number = 100000,
    margemMinima: number = 20,
  ): { requerAdmin: boolean; motivoAlcada: string } {
    const excedePreco = preco > limiteValor
    const margemAbaixo = margemPercent < margemMinima

    if (excedePreco && margemAbaixo) {
      return {
        requerAdmin: true,
        motivoAlcada: `Valor (R$ ${preco.toLocaleString('pt-BR')}) acima de R$ ${limiteValor.toLocaleString('pt-BR')} e Margem (${margemPercent.toFixed(1)}%) abaixo de ${margemMinima}%`,
      }
    }
    if (excedePreco) {
      return {
        requerAdmin: true,
        motivoAlcada: `Valor total (R$ ${preco.toLocaleString('pt-BR')}) superior à alçada comercial de R$ ${limiteValor.toLocaleString('pt-BR')}`,
      }
    }
    if (margemAbaixo) {
      return {
        requerAdmin: true,
        motivoAlcada: `Margem de lucro (${margemPercent.toFixed(1)}%) inferior ao piso mínimo de ${margemMinima}%`,
      }
    }

    return {
      requerAdmin: false,
      motivoAlcada: 'Dentro da alçada autônoma do Comercial',
    }
  },

  /**
   * Cálculo automático do Preço = Custo + Margem + Impostos
   * Fórmula padrão de engenharia com BDI sobre o custo:
   * Preço = Custo / (1 - (Margem% + Impostos%) / 100)
   * OU Preço = Custo + (Custo * Margem%) + (Custo * Impostos%)
   * O requisito define: "Preço = custo + margem + impostos, calculado dos itens (custo por item + % margem + % impostos)"
   */
  calcularTotais(
    custoTotal: number,
    margemPercent: number,
    impostosPercent: number,
  ): {
    custo: number
    valorMargem: number
    valorImpostos: number
    precoTotal: number
  } {
    const valorMargem = (custoTotal * margemPercent) / 100
    const valorImpostos = (custoTotal * impostosPercent) / 100
    const precoTotal = custoTotal + valorMargem + valorImpostos

    return {
      custo: Math.round(custoTotal * 100) / 100,
      valorMargem: Math.round(valorMargem * 100) / 100,
      valorImpostos: Math.round(valorImpostos * 100) / 100,
      precoTotal: Math.round(precoTotal * 100) / 100,
    }
  },

  /**
   * Cria nova revisão da proposta: Rev.01, Rev.02...
   * Mantém o mesmo número de proposta (PROP-AAAA-NNNN) e arquiva cópia do conteúdo anterior no histórico.
   */
  async criarRevisao(proposta: PropostaRecord, responsavelNome: string): Promise<PropostaRecord> {
    const revisaoAtual = proposta.revisao || 'Rev.00'
    const match = revisaoAtual.match(/\d+/)
    const seq = match ? parseInt(match[0], 10) : 0
    const novaRevisao = `Rev.${String(seq + 1).padStart(2, '0')}`

    const snapshotHistorico: PropostaRevisaoHistorico = {
      revisao: revisaoAtual,
      data: new Date().toISOString(),
      responsavel_nome: responsavelNome,
      preco: proposta.preco,
      custo: proposta.custo || 0,
      margem: proposta.margem || 0,
      impostos: proposta.impostos || 0,
      conteudo_snapshot: {
        escopo: proposta.escopo,
        disciplinas: proposta.disciplinas,
        entregaveis: proposta.entregaveis,
        prazo: proposta.prazo,
        condicoes_pagamento: proposta.condicoes_pagamento,
        premissas: proposta.premissas,
        exclusoes: proposta.exclusoes,
        itens_json: proposta.itens_json || [],
      },
    }

    const historicoAtualizado = [...(proposta.historico_revisoes || []), snapshotHistorico]

    return this.update(proposta.id, {
      revisao: novaRevisao,
      status: 'rascunho', // Revisão volta a Rascunho
      historico_revisoes: historicoAtualizado,
    })
  },

  /**
   * Verificação e Expiração Automática de Propostas Vencidas ao abrir o sistema
   */
  async verificarEAtualizarExpiradas(propostas: PropostaRecord[]): Promise<PropostaRecord[]> {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atualizadas: PropostaRecord[] = []

    for (const p of propostas) {
      if (
        (p.status === 'enviada' || p.status === 'visualizada' || p.status === 'em_negociacao') &&
        p.validade
      ) {
        const dataValidade = new Date(p.validade)
        dataValidade.setHours(23, 59, 59, 999)

        if (hoje.getTime() > dataValidade.getTime()) {
          try {
            const exp = await pb.collection('propostas').update<PropostaRecord>(p.id, {
              status: 'expirada',
            })
            atualizadas.push(exp)
          } catch (err) {
            console.warn(`Erro ao expirar proposta ${p.numero}:`, err)
          }
        }
      }
    }

    return atualizadas
  },

  /**
   * Consolidação de métricas: taxa de aceite e distribuição de recusas
   */
  calcularMetricas(propostas: PropostaRecord[]): MetricasPropostas {
    let totalCriadas = propostas.length
    let totalEnviadas = 0
    let totalAceitas = 0
    let totalRecusadas = 0
    let totalExpiradas = 0
    let totalEmNegociacao = 0
    let valorTotalAceitas = 0
    const recusasPorMotivo: Record<string, number> = {}

    // Status considerados como propostas que chegaram a ser enviadas ao cliente
    const statusEnviadas = [
      'enviada',
      'visualizada',
      'em_negociacao',
      'aceita',
      'recusada',
      'expirada',
    ]

    for (const p of propostas) {
      if (statusEnviadas.includes(p.status)) {
        totalEnviadas++
      }

      if (p.status === 'aceita') {
        totalAceitas++
        valorTotalAceitas += Number(p.preco) || 0
      } else if (p.status === 'recusada') {
        totalRecusadas++
        const motivo = p.motivo_recusa || 'Outro motivo'
        recusasPorMotivo[motivo] = (recusasPorMotivo[motivo] || 0) + 1
      } else if (p.status === 'expirada') {
        totalExpiradas++
      } else if (p.status === 'em_negociacao') {
        totalEmNegociacao++
      }
    }

    const taxaAceite =
      totalEnviadas > 0 ? Math.round((totalAceitas / totalEnviadas) * 1000) / 10 : 0

    return {
      totalCriadas,
      totalEnviadas,
      totalAceitas,
      totalRecusadas,
      totalExpiradas,
      totalEmNegociacao,
      taxaAceite,
      valorTotalAceitas,
      recusasPorMotivo,
    }
  },

  /**
   * Preenchimento automático de variáveis de modelo:
   * {nome}, {orgao}, {valor_contrato}, {numero_proposta}, {prazo}, etc.
   */
  substituirVariaveisModelo(
    texto: string,
    variaveis: {
      nome?: string
      orgao?: string
      valor_contrato?: string
      numero_proposta?: string
      prazo?: string
      disciplinas?: string
      preco?: string
    },
  ): string {
    let resultado = texto
    if (variaveis.nome) resultado = resultado.replace(/{nome}/g, variaveis.nome)
    if (variaveis.orgao) resultado = resultado.replace(/{orgao}/g, variaveis.orgao)
    if (variaveis.valor_contrato) {
      resultado = resultado.replace(/{valor_contrato}/g, variaveis.valor_contrato)
    }
    if (variaveis.numero_proposta) {
      resultado = resultado.replace(/{numero_proposta}/g, variaveis.numero_proposta)
    }
    if (variaveis.prazo) resultado = resultado.replace(/{prazo}/g, variaveis.prazo)
    if (variaveis.disciplinas) {
      resultado = resultado.replace(/{disciplinas}/g, variaveis.disciplinas)
    }
    if (variaveis.preco) resultado = resultado.replace(/{preco}/g, variaveis.preco)
    return resultado
  },
}
