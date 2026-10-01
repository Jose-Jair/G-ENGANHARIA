import pb from '@/lib/pocketbase/client'
import {
  ExecutorRecord,
  TipoExecutor,
  ConselhoClasse,
  StatusExecutor,
  CotacaoRecord,
  StatusCotacao,
  AvaliacaoRecord,
  PesosAvaliacaoExecutor,
} from '@/types'

export interface CreateExecutorData {
  tipo: TipoExecutor
  nome: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  conselho?: ConselhoClasse
  numero_registro?: string
  conselho_validade?: string
  disciplinas?: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: string
  nda_contrato?: File | string
  status?: StatusExecutor
  motivo_suspensao?: string
}

export interface ExecutorComMetricas extends ExecutorRecord {
  etapasAtivasCount: number
  isCapacidadeEsgotada: boolean
  isRegistroVencido: boolean
  isRegistroVencendoBreve: boolean // <= 30 dias
  isAbaixoNotaCorte: boolean
}

export const executoresService = {
  async list(): Promise<ExecutorRecord[]> {
    return await pb.collection('executores').getFullList<ExecutorRecord>({
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<ExecutorRecord> {
    return await pb.collection('executores').getOne<ExecutorRecord>(id)
  },

  async create(data: CreateExecutorData): Promise<ExecutorRecord> {
    const formData = new FormData()
    formData.append('tipo', data.tipo)
    formData.append('nome', data.nome)
    if (data.cpf_cnpj) formData.append('cpf_cnpj', data.cpf_cnpj)
    if (data.email) formData.append('email', data.email)
    if (data.telefone) formData.append('telefone', data.telefone)
    if (data.conselho) formData.append('conselho', data.conselho)
    if (data.numero_registro) formData.append('numero_registro', data.numero_registro)
    if (data.conselho_validade) formData.append('conselho_validade', data.conselho_validade)
    if (data.disciplinas) formData.append('disciplinas', data.disciplinas)
    if (data.regiao) formData.append('regiao', data.regiao)
    formData.append('capacidade_simultanea', String(data.capacidade_simultanea ?? 3))
    if (data.dados_bancarios) formData.append('dados_bancarios', data.dados_bancarios)
    formData.append('status', data.status || 'homologacao')
    if (data.motivo_suspensao) formData.append('motivo_suspensao', data.motivo_suspensao)
    if (data.nda_contrato instanceof File) {
      formData.append('nda_contrato', data.nda_contrato)
    }

    return await pb.collection('executores').create<ExecutorRecord>(formData)
  },

  async update(id: string, data: Partial<CreateExecutorData>): Promise<ExecutorRecord> {
    const formData = new FormData()
    if (data.tipo) formData.append('tipo', data.tipo)
    if (data.nome) formData.append('nome', data.nome)
    if (data.cpf_cnpj !== undefined) formData.append('cpf_cnpj', data.cpf_cnpj)
    if (data.email !== undefined) formData.append('email', data.email)
    if (data.telefone !== undefined) formData.append('telefone', data.telefone)
    if (data.conselho !== undefined) formData.append('conselho', data.conselho)
    if (data.numero_registro !== undefined) formData.append('numero_registro', data.numero_registro)
    if (data.conselho_validade !== undefined)
      formData.append('conselho_validade', data.conselho_validade || '')
    if (data.disciplinas !== undefined) formData.append('disciplinas', data.disciplinas)
    if (data.regiao !== undefined) formData.append('regiao', data.regiao)
    if (data.capacidade_simultanea !== undefined) {
      formData.append('capacidade_simultanea', String(data.capacidade_simultanea))
    }
    if (data.dados_bancarios !== undefined) formData.append('dados_bancarios', data.dados_bancarios)
    if (data.status) formData.append('status', data.status)
    if (data.motivo_suspensao !== undefined)
      formData.append('motivo_suspensao', data.motivo_suspensao)
    if (data.nda_contrato instanceof File) {
      formData.append('nda_contrato', data.nda_contrato)
    }

    return await pb.collection('executores').update<ExecutorRecord>(id, formData)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('executores').delete(id)
  },

  // Mudar status com motivo (homologacao -> ativo -> suspenso)
  async alterarStatus(
    id: string,
    status: StatusExecutor,
    motivo?: string,
  ): Promise<ExecutorRecord> {
    return await pb.collection('executores').update<ExecutorRecord>(id, {
      status,
      motivo_suspensao: status === 'suspenso' ? motivo || 'Suspenso pelo gestor' : '',
    })
  },

  // Listar executores com métricas de validação em tela
  async listComMetricas(notaCorte: number = 3.0): Promise<ExecutorComMetricas[]> {
    const [executores, etapasAtivas] = await Promise.all([
      this.list(),
      pb.collection('projeto_etapas').getFullList({
        filter: "executor != '' && status != 'concluida' && status != 'cancelada'",
        fields: 'id,executor',
      }),
    ])

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Agrupar etapas por executor
    const contagemEtapas: Record<string, number> = {}
    for (const e of etapasAtivas) {
      const execId = (e as any).executor
      contagemEtapas[execId] = (contagemEtapas[execId] || 0) + 1
    }

    return executores.map((ex) => {
      const ativas = contagemEtapas[ex.id] || 0
      const cap = ex.capacidade_simultanea || 1
      const isCapacidadeEsgotada = ativas >= cap

      let isRegistroVencido = false
      let isRegistroVencendoBreve = false
      if (ex.conselho_validade) {
        const v = new Date(ex.conselho_validade)
        v.setHours(0, 0, 0, 0)
        const diffMs = v.getTime() - hoje.getTime()
        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        if (diffDias < 0) {
          isRegistroVencido = true
        } else if (diffDias <= 30) {
          isRegistroVencendoBreve = true
        }
      }

      const isAbaixoNotaCorte =
        ex.total_avaliacoes && ex.total_avaliacoes > 0 && ex.nota_geral !== undefined
          ? ex.nota_geral < notaCorte
          : false

      return {
        ...ex,
        etapasAtivasCount: ativas,
        isCapacidadeEsgotada,
        isRegistroVencido,
        isRegistroVencendoBreve,
        isAbaixoNotaCorte,
      }
    })
  },
}

// COTAÇÕES
export interface CreateCotacaoData {
  etapa: string
  executor: string
  escopo?: string
  prazo_resposta?: string
  data_limite?: string
}

export interface RespostaCotacaoData {
  preco_ofertado: number
  prazo_ofertado: string
  observacoes?: string
}

export const cotacoesService = {
  async listByEtapa(etapaId: string): Promise<CotacaoRecord[]> {
    return await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `etapa = '${etapaId}'`,
      sort: '-created',
      expand: 'executor,etapa',
    })
  },

  async getByToken(token: string): Promise<CotacaoRecord> {
    const list = await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `token = '${token}'`,
      expand: 'etapa,etapa.projeto,executor',
    })
    if (list.length === 0) {
      throw new Error('Cotação não encontrada ou token inválido')
    }
    return list[0]
  },

  async create(data: CreateCotacaoData): Promise<CotacaoRecord> {
    return await pb.collection('cotacoes').create<CotacaoRecord>({
      ...data,
      status: 'convite_enviado',
      escolhida: false,
    })
  },

  async responderPorToken(token: string, resposta: RespostaCotacaoData): Promise<CotacaoRecord> {
    const cotacao = await this.getByToken(token)
    return await pb.collection('cotacoes').update<CotacaoRecord>(cotacao.id, {
      preco_ofertado: resposta.preco_ofertado,
      prazo_ofertado: resposta.prazo_ofertado,
      observacoes: resposta.observacoes || '',
      status: 'respondida',
      data_resposta: new Date().toISOString(),
    })
  },

  // Escolha da proposta vencedora (o hook do servidor desmarca as outras e vincula à etapa)
  async escolherCotacao(cotacaoId: string): Promise<CotacaoRecord> {
    return await pb.collection('cotacoes').update<CotacaoRecord>(cotacaoId, {
      escolhida: true,
      status: 'escolhida',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('cotacoes').delete(id)
  },
}

// AVALIAÇÕES
export interface CreateAvaliacaoData {
  executor: string
  etapa: string
  avaliado_por?: string
  pontualidade: number
  qualidade: number
  desvio_custo: number
  responsividade: number
  comentario?: string
}

export const avaliacoesService = {
  async listByExecutor(executorId: string): Promise<AvaliacaoRecord[]> {
    return await pb.collection('avaliacoes').getFullList<AvaliacaoRecord>({
      filter: `executor = '${executorId}'`,
      sort: '-created',
      expand: 'etapa,etapa.projeto,avaliado_por',
    })
  },

  async create(
    data: CreateAvaliacaoData,
    pesos?: PesosAvaliacaoExecutor,
  ): Promise<AvaliacaoRecord> {
    const pPont = pesos?.peso_pontualidade ?? 30
    const pQual = pesos?.peso_qualidade ?? 35
    const pCust = pesos?.peso_desvio_custo ?? 20
    const pResp = pesos?.peso_responsividade ?? 15
    const somaPesos = pPont + pQual + pCust + pResp || 100

    const notaCalculada =
      (data.pontualidade * pPont +
        data.qualidade * pQual +
        data.desvio_custo * pCust +
        data.responsividade * pResp) /
      somaPesos

    return await pb.collection('avaliacoes').create<AvaliacaoRecord>({
      ...data,
      nota_final: parseFloat(notaCalculada.toFixed(2)),
    })
  },

  async listAll(): Promise<AvaliacaoRecord[]> {
    return await pb.collection('avaliacoes').getFullList<AvaliacaoRecord>({
      sort: '-created',
      expand: 'executor,etapa,avaliado_por',
    })
  },
}
