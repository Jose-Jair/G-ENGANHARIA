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

export interface ConvidarExecutorData {
  nome: string
  email: string
}

export interface ConvidarExecutorResponse {
  sucesso: boolean
  executor_id: string
  nome: string
  email: string
  token_cadastro: string
  token_cadastro_expira: string
  link_cadastro: string
}

export interface ObterExecutorTokenResponse {
  valido: boolean
  expirado?: boolean
  error?: string
  executor?: {
    id: string
    nome: string
    email: string
    tipo: TipoExecutor
    cpf_cnpj?: string
    telefone?: string
    conselho?: ConselhoClasse
    conselho_classe?: ConselhoClasse
    numero_registro?: string
    numero_registro_conselho?: string
    conselho_validade?: string
    validade_registro_conselho?: string
    disciplinas?: string
    regiao?: string
    capacidade_simultanea?: number
    dados_bancarios?: string
    status: StatusExecutor
  }
}

export interface SubmeterCadastroTokenData {
  token: string
  nome?: string
  tipo: TipoExecutor
  cpf_cnpj: string
  telefone?: string
  conselho_classe?: string
  numero_registro?: string
  validade_registro?: string
  disciplinas: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: any
}

export interface CreateExecutorData {
  tipo: TipoExecutor
  nome: string
  cpf_cnpj?: string
  email?: string
  telefone?: string
  conselho?: ConselhoClasse
  conselho_classe?: ConselhoClasse
  numero_registro?: string
  numero_registro_conselho?: string
  conselho_validade?: string
  validade_registro_conselho?: string
  disciplinas?: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: string
  nda_contrato?: File | string
  documento_termo?: File | string
  status?: StatusExecutor
  motivo_suspensao?: string
}

export interface ExecutorProjetoResumo {
  projetoId: string
  codigo: string
  nome: string
  etapaNome: string
  statusEtapa: string
}

export interface ExecutorComMetricas extends ExecutorRecord {
  etapasAtivasCount: number
  isCapacidadeEsgotada: boolean
  isRegistroVencido: boolean
  isRegistroVencendoBreve: boolean
  isAbaixoNotaCorte: boolean
  tendenciaNota?: 'subindo' | 'caindo' | 'estavel' | 'sem_historico'
  taxaOcupacaoPercent: number
  capacidadeLivre: number
  ultimosProjetos: ExecutorProjetoResumo[]
  ultimaAvaliacao?: {
    data: string
    nota: number
    projetoCodigo?: string
    comentario?: string
  }
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

  // Recrutamento e Homologação
  async convidar(data: ConvidarExecutorData): Promise<ConvidarExecutorResponse> {
    return await pb.send('/backend/v1/executores/convidar', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
  },

  async obterPorTokenCadastro(token: string): Promise<ObterExecutorTokenResponse> {
    return await pb.send(
      `/backend/v1/executores/obter-por-token-cadastro/${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
    )
  },

  async submeterCadastroToken(
    data: SubmeterCadastroTokenData,
  ): Promise<{ sucesso: boolean; mensagem: string; executor_id: string; status: string }> {
    return await pb.send('/backend/v1/executores/submeter-cadastro-token', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
  },

  async homologar(id: string): Promise<{
    sucesso: boolean
    executor_id: string
    nome: string
    status: string
    mensagem: string
  }> {
    return await pb.send(`/backend/v1/executores/${id}/homologar`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
  },

  // Listar executores com métricas de validação em tela, tendência e mapa de disponibilidade
  async listComMetricas(notaCorte: number = 3.0): Promise<ExecutorComMetricas[]> {
    const [executores, todasEtapas, todasAvaliacoes] = await Promise.all([
      this.list(),
      pb.collection('projeto_etapas').getFullList({
        filter: "executor != ''",
        expand: 'projeto',
        sort: '-created',
      }),
      pb.collection('avaliacoes').getFullList<AvaliacaoRecord>({
        sort: '-created',
        expand: 'etapa,etapa.projeto',
      }),
    ])

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Agrupar etapas por executor e calcular ativas vs projetos
    const contagemEtapasAtivas: Record<string, number> = {}
    const projetosPorExec: Record<string, ExecutorProjetoResumo[]> = {}

    for (const e of todasEtapas) {
      const execId = (e as any).executor
      const status = (e as any).status
      if (status !== 'concluida' && status !== 'cancelada') {
        contagemEtapasAtivas[execId] = (contagemEtapasAtivas[execId] || 0) + 1
      }

      if (!projetosPorExec[execId]) {
        projetosPorExec[execId] = []
      }

      const prj = (e as any).expand?.projeto
      if (prj && !projetosPorExec[execId].some((p) => p.projetoId === prj.id)) {
        projetosPorExec[execId].push({
          projetoId: prj.id,
          codigo: prj.codigo || '',
          nome: prj.nome || '',
          etapaNome: (e as any).nome || '',
          statusEtapa: status || '',
        })
      }
    }

    // Agrupar avaliações por executor
    const avaliacoesPorExec: Record<string, AvaliacaoRecord[]> = {}
    for (const a of todasAvaliacoes) {
      if (!avaliacoesPorExec[a.executor]) {
        avaliacoesPorExec[a.executor] = []
      }
      avaliacoesPorExec[a.executor].push(a)
    }

    return executores.map((ex) => {
      const ativas = contagemEtapasAtivas[ex.id] || 0
      const cap = ex.capacidade_simultanea || 1
      const isCapacidadeEsgotada = ativas >= cap
      const taxaOcupacaoPercent = Math.min(100, Math.round((ativas / cap) * 100))
      const capacidadeLivre = Math.max(0, cap - ativas)

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

      // Calcular tendência comparando a última avaliação com a média das anteriores
      const avs = avaliacoesPorExec[ex.id] || []
      let tendenciaNota: 'subindo' | 'caindo' | 'estavel' | 'sem_historico' = 'sem_historico'
      let ultimaAvaliacao:
        | {
            data: string
            nota: number
            projetoCodigo?: string
            comentario?: string
          }
        | undefined

      if (avs.length >= 2) {
        const ultimaNota = avs[0].nota_final || 0
        const penultimaNota = avs[1].nota_final || 0
        if (ultimaNota > penultimaNota + 0.1) tendenciaNota = 'subindo'
        else if (ultimaNota < penultimaNota - 0.1) tendenciaNota = 'caindo'
        else tendenciaNota = 'estavel'

        const prjCodigo = (avs[0].expand as any)?.etapa?.expand?.projeto?.codigo
        ultimaAvaliacao = {
          data: avs[0].created || '',
          nota: ultimaNota,
          projetoCodigo: prjCodigo,
          comentario: avs[0].comentario,
        }
      } else if (avs.length === 1) {
        tendenciaNota = 'estavel'
        const prjCodigo = (avs[0].expand as any)?.etapa?.expand?.projeto?.codigo
        ultimaAvaliacao = {
          data: avs[0].created || '',
          nota: avs[0].nota_final || 0,
          projetoCodigo: prjCodigo,
          comentario: avs[0].comentario,
        }
      }

      const ultimosProjetos = (projetosPorExec[ex.id] || []).slice(0, 3)

      return {
        ...ex,
        etapasAtivasCount: ativas,
        isCapacidadeEsgotada,
        isRegistroVencido,
        isRegistroVencendoBreve,
        isAbaixoNotaCorte,
        tendenciaNota,
        taxaOcupacaoPercent,
        capacidadeLivre,
        ultimosProjetos,
        ultimaAvaliacao,
      }
    })
  },
}

// COTAÇÕES
export interface CreateCotacaoData {
  etapa?: string
  projeto?: string
  grupo?: string
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

export interface SolicitarCotacoesMultiplosData {
  projeto_id: string
  executores_ids: string[]
  escopo?: string
  data_limite?: string
  enviar_email?: boolean
}

export interface RespostaCotacaoExternaData {
  cotacao_id: string
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

  async listByProjeto(projetoId: string): Promise<CotacaoRecord[]> {
    return await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
      expand: 'executor,projeto,etapa,registrado_por',
    })
  },

  async listByGrupo(grupoId: string): Promise<CotacaoRecord[]> {
    return await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `grupo = '${grupoId}'`,
      sort: '-created',
      expand: 'executor,projeto,etapa',
    })
  },

  async getByToken(token: string): Promise<CotacaoRecord> {
    const list = await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `token = '${token}'`,
      expand: 'etapa,etapa.projeto,projeto,executor',
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

  // Disparo em lote de solicitação de cotação para múltiplos executores homologados
  async solicitarCotacoesMultiplos(
    data: SolicitarCotacoesMultiplosData,
  ): Promise<{ success: boolean; total_cotacoes: number }> {
    return await pb.send('/backend/v1/projetos/solicitar-cotacoes', {
      method: 'POST',
      body: data,
    })
  },

  // Registro de resposta recebida fora do sistema (telefone, WhatsApp, reunião)
  async registrarRespostaExterna(
    data: RespostaCotacaoExternaData,
  ): Promise<{ success: boolean; cotacao_id: string }> {
    return await pb.send('/backend/v1/cotacoes/registrar-resposta-externa', {
      method: 'POST',
      body: data,
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

  // Escolha da proposta vencedora (o hook do servidor desmarca as outras e vincula)
  async escolherCotacao(cotacaoId: string): Promise<CotacaoRecord> {
    return await pb.collection('cotacoes').update<CotacaoRecord>(cotacaoId, {
      escolhida: true,
      status: 'escolhida',
    })
  },

  // Resposta autenticada pelo executor logado no Portal do Executor
  async responderCotacaoLogado(
    cotacaoId: string,
    resposta: RespostaCotacaoData,
  ): Promise<{ success: boolean; cotacao_id: string }> {
    return await pb.send('/backend/v1/portal-executor/responder-cotacao', {
      method: 'POST',
      body: {
        cotacao_id: cotacaoId,
        preco_ofertado: resposta.preco_ofertado,
        prazo_ofertado: resposta.prazo_ofertado,
        observacoes: resposta.observacoes,
      },
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
    _pesos?: PesosAvaliacaoExecutor,
  ): Promise<AvaliacaoRecord> {
    // Cálculo balanceado automático dos 4 indicadores (25% cada)
    const notaCalculada =
      (data.pontualidade + data.qualidade + data.desvio_custo + data.responsividade) / 4

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
