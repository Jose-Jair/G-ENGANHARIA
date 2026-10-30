import pb from '@/lib/pocketbase/client'
import {
  PrestadorRecord,
  ProfissionalPrestadorRecord,
  ContratoMestreRecord,
  OrdemServicoRecord,
  PortalOsRecord,
  PortalEntregavelRecord,
  PortalDocumentoRecord,
} from '@/types'

export interface CreatePrestadorData {
  tipo: 'interno' | 'pf_externo' | 'pj_externo'
  nome: string
  cpf_cnpj?: string
  email: string
  telefone?: string
  conselho?: string
  conselho_classe?: string
  numero_registro_conselho?: string
  validade_registro_conselho?: string
  disciplinas?: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: string
  status?: 'ativo' | 'pendente' | 'suspenso' | 'inativo'
}

export interface CreateProfissionalData {
  prestador: string
  nome: string
  conselho?: string
  numero?: string
  validade?: string
  email?: string
  telefone?: string
  cargo_funcao?: string
  ativo?: boolean
}

export interface CreateContratoMestreData {
  prestador: string
  minuta_texto?: string
  clausulas_nda?: string
}

export interface CreateOrdemServicoData {
  tipo_prestador: 'interno' | 'externo'
  projeto: string
  prestador: string
  contrato_mestre?: string
  disciplina?: string
  escopo_tecnico?: string
  entregaveis_texto?: string
  prazo_dias?: number
  data_inicio?: string
  data_previsao_fim?: string
  valor_os?: number
  percentual_retencao_tecnica?: number
  parcelas_json?: Array<{
    numero: number
    descricao: string
    valor: number
    percentual?: number
    vencimento?: string
  }>
}

export const prestadoresService = {
  async list(filter?: string): Promise<PrestadorRecord[]> {
    return pb.collection('prestadores').getFullList<PrestadorRecord>({
      filter: filter || '',
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<PrestadorRecord> {
    return pb.collection('prestadores').getOne<PrestadorRecord>(id)
  },

  async create(data: CreatePrestadorData): Promise<PrestadorRecord> {
    return pb.collection('prestadores').create<PrestadorRecord>({
      ...data,
      status: data.status || 'ativo',
    })
  },

  async update(id: string, data: Partial<CreatePrestadorData>): Promise<PrestadorRecord> {
    return pb.collection('prestadores').update<PrestadorRecord>(id, data)
  },

  async suspender(id: string, motivo: string): Promise<PrestadorRecord> {
    return pb.collection('prestadores').update<PrestadorRecord>(id, {
      status: 'suspenso',
      motivo_suspensao: motivo,
    })
  },

  async reativar(id: string): Promise<PrestadorRecord> {
    return pb.collection('prestadores').update<PrestadorRecord>(id, {
      status: 'ativo',
      motivo_suspensao: '',
    })
  },

  // Profissionais vinculados ao prestador (especialmente PJ)
  async listProfissionais(prestadorId: string): Promise<ProfissionalPrestadorRecord[]> {
    return pb.collection('profissionais_prestador').getFullList<ProfissionalPrestadorRecord>({
      filter: `prestador = '${prestadorId}'`,
      sort: 'nome',
    })
  },

  async createProfissional(data: CreateProfissionalData): Promise<ProfissionalPrestadorRecord> {
    return pb.collection('profissionais_prestador').create<ProfissionalPrestadorRecord>(data)
  },

  async updateProfissional(
    id: string,
    data: Partial<CreateProfissionalData>,
  ): Promise<ProfissionalPrestadorRecord> {
    return pb.collection('profissionais_prestador').update<ProfissionalPrestadorRecord>(id, data)
  },

  async deleteProfissional(id: string): Promise<boolean> {
    return pb.collection('profissionais_prestador').delete(id)
  },

  // Contratos Mestre
  async listContratosMestre(prestadorId?: string): Promise<ContratoMestreRecord[]> {
    const filter = prestadorId ? `prestador = '${prestadorId}'` : ''
    return pb.collection('contratos_mestre').getFullList<ContratoMestreRecord>({
      filter,
      sort: '-created',
      expand: 'prestador,assinante_gmais',
    })
  },

  async createContratoMestre(data: CreateContratoMestreData): Promise<ContratoMestreRecord> {
    return pb.collection('contratos_mestre').create<ContratoMestreRecord>({
      ...data,
      status: 'minuta',
    })
  },

  async assinarContratoMestreGmais(contratoId: string): Promise<any> {
    return pb.send(`/backend/v1/contratos-mestre/${contratoId}/assinar-gmais`, {
      method: 'POST',
    })
  },

  async assinarContratoMestrePrestador(
    contratoId: string,
    payload: { token?: string; nome: string; documento: string },
  ): Promise<any> {
    return pb.send(`/backend/v1/contratos-mestre/${contratoId}/assinar-prestador`, {
      method: 'POST',
      body: payload,
    })
  },
}

export const ordensServicoService = {
  async list(filter?: string): Promise<OrdemServicoRecord[]> {
    return pb.collection('ordens_servico').getFullList<OrdemServicoRecord>({
      filter: filter || '',
      sort: '-created',
      expand: 'projeto,prestador,contrato_mestre,emitido_por',
    })
  },

  async listByProjeto(projetoId: string): Promise<OrdemServicoRecord[]> {
    return pb.collection('ordens_servico').getFullList<OrdemServicoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
      expand: 'projeto,prestador,contrato_mestre,emitido_por',
    })
  },

  async listByPrestador(prestadorId: string): Promise<OrdemServicoRecord[]> {
    return pb.collection('ordens_servico').getFullList<OrdemServicoRecord>({
      filter: `prestador = '${prestadorId}'`,
      sort: '-created',
      expand: 'projeto,prestador,contrato_mestre,emitido_por',
    })
  },

  async getById(id: string): Promise<OrdemServicoRecord> {
    return pb.collection('ordens_servico').getOne<OrdemServicoRecord>(id, {
      expand: 'projeto,prestador,contrato_mestre,emitido_por',
    })
  },

  async create(data: CreateOrdemServicoData): Promise<OrdemServicoRecord> {
    const isInterno = data.tipo_prestador === 'interno'
    return pb.collection('ordens_servico').create<OrdemServicoRecord>({
      ...data,
      status: isInterno ? 'em_execucao' : 'minuta',
      valor_os: isInterno ? 0 : data.valor_os || 0,
      percentual_retencao_tecnica: isInterno ? 0 : data.percentual_retencao_tecnica || 0,
      retencao_tecnica_acumulada: 0,
      retencao_tecnica_liberada: 0,
      status_retencao: 'sem_retencao',
      emitido_por: pb.authStore.model?.id || undefined,
    })
  },

  async update(id: string, data: Partial<OrdemServicoRecord>): Promise<OrdemServicoRecord> {
    return pb.collection('ordens_servico').update<OrdemServicoRecord>(id, data)
  },

  async assinarPrestador(
    osId: string,
    payload: {
      token?: string
      declaracao: boolean
      nome: string
      documento: string
    },
  ): Promise<any> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/assinar-prestador`, {
      method: 'POST',
      body: payload,
    })
  },

  async encerrar(id: string, checklistJson?: any): Promise<OrdemServicoRecord> {
    return pb.collection('ordens_servico').update<OrdemServicoRecord>(id, {
      status: 'encerrada',
      data_conclusao: new Date().toISOString().substring(0, 10),
      checklist_encerramento_json: checklistJson,
    })
  },
}

export const portalPrestadorService = {
  /**
   * Consulta as OS projetadas do portal pertencentes ao prestador autenticado
   * (filtrado automaticamente pelo RLS: prestador_email = @request.auth.email)
   */
  async listMinhasOS(): Promise<PortalOsRecord[]> {
    return pb.collection('portal_os').getFullList<PortalOsRecord>({
      sort: '-created',
    })
  },

  /**
   * Consulta os entregáveis técnicos projetados da OS
   */
  async listEntregaveis(osId: string): Promise<PortalEntregavelRecord[]> {
    return pb.collection('portal_entregaveis').getFullList<PortalEntregavelRecord>({
      filter: `os_id = '${osId}'`,
      sort: '-created',
    })
  },

  /**
   * Consulta os documentos técnicos projetados da OS
   */
  async listDocumentos(osId: string): Promise<PortalDocumentoRecord[]> {
    return pb.collection('portal_documentos').getFullList<PortalDocumentoRecord>({
      filter: `os_id = '${osId}'`,
      sort: '-created',
    })
  },
}
