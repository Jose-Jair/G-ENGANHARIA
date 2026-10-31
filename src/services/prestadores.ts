import pb from '@/lib/pocketbase/client'
import {
  PrestadorRecord,
  ProfissionalPrestadorRecord,
  ContratoMestreRecord,
  OrdemServicoRecord,
  PortalOsRecord,
  PortalEntregavelRecord,
  PortalDocumentoRecord,
  LinkRecrutamentoRecord,
  PrestadorDocumentoRecord,
  PreCadastroPublicoPayload,
  PreCadastroPublicoResponse,
  AprovarTriagemPayload,
  AprovarTriagemResponse,
  RecusarTriagemPayload,
  RecusarTriagemResponse,
  PedirComplementoTriagemPayload,
  PedirComplementoTriagemResponse,
  ObterPrestadorTokenComplementoResponse,
  SubmeterComplementoTokenPayload,
  SubmeterComplementoTokenResponse,
  AtualizarMeuPerfilPrestadorPayload,
  AtualizarMeuPerfilPrestadorResponse,
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
  status?: 'triagem' | 'ativo' | 'pendente' | 'suspenso' | 'inativo'
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
      status: (data.status as any) || 'ativo',
    })
  },

  async update(
    id: string,
    data: Partial<CreatePrestadorData> & Partial<PrestadorRecord>,
  ): Promise<PrestadorRecord> {
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

  // ===========================================================================
  // RODADA 12: TRIAGEM DE PRESTADORES (ADMIN / GESTOR)
  // ===========================================================================

  /**
   * Aprova triagem do prestador: muda status para "pendente", registra nota/parecer,
   * gera minuta de contrato-mestre e notifica prestador para envio de documentos.
   */
  async aprovarTriagem(
    prestadorId: string,
    payload: AprovarTriagemPayload = {},
  ): Promise<AprovarTriagemResponse> {
    return pb.send(`/backend/v1/prestadores/${prestadorId}/triagem/aprovar`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Recusa triagem do prestador: motivo obrigatório, grava parecer e nota, move para "inativo".
   */
  async recusarTriagem(
    prestadorId: string,
    payload: RecusarTriagemPayload,
  ): Promise<RecusarTriagemResponse> {
    return pb.send(`/backend/v1/prestadores/${prestadorId}/triagem/recusar`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Solicita complemento de dados e gera link seguro com token de retorno.
   */
  async pedirComplementoTriagem(
    prestadorId: string,
    payload: PedirComplementoTriagemPayload = {},
  ): Promise<PedirComplementoTriagemResponse> {
    return pb.send(`/backend/v1/prestadores/${prestadorId}/triagem/pedir-complemento`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Consulta pública de dados para preenchimento de complemento via token.
   */
  async obterPorTokenComplemento(token: string): Promise<ObterPrestadorTokenComplementoResponse> {
    return pb.send(
      `/backend/v1/prestadores/obter-por-token-complemento/${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Submissão pública dos dados complementados pelo prestador via token.
   */
  async submeterComplementoToken(
    payload: SubmeterComplementoTokenPayload,
  ): Promise<SubmeterComplementoTokenResponse> {
    return pb.send('/backend/v1/prestadores/submeter-complemento-token', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Obtém os dados cadastrais do prestador autenticado
   */
  async getMeuPerfilPrestador(): Promise<PrestadorRecord | null> {
    return portalPrestadorService.getMeuPerfilPrestador()
  },

  /**
   * Atualização cadastral do perfil do prestador
   */
  async updatePerfilPrestador(
    _prestadorId: string,
    payload: AtualizarMeuPerfilPrestadorPayload,
  ): Promise<AtualizarMeuPerfilPrestadorResponse> {
    return portalPrestadorService.atualizarMeuPerfil(payload)
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

  /**
   * Atualização cadastral/técnica pelo próprio prestador autenticado
   * POST /backend/v1/portal-prestador/meu-perfil (Auditada, sem expor dados confidenciais)
   */
  async atualizarMeuPerfil(
    payload: AtualizarMeuPerfilPrestadorPayload,
  ): Promise<AtualizarMeuPerfilPrestadorResponse> {
    return pb.send('/backend/v1/portal-prestador/meu-perfil', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Obtém os dados cadastrais do prestador autenticado por seu email
   */
  async getMeuPerfilPrestador(): Promise<PrestadorRecord | null> {
    const userEmail = pb.authStore.model?.email
    if (!userEmail) return null
    try {
      const records = await pb.collection('prestadores').getFullList<PrestadorRecord>({
        filter: `email = '${userEmail.replace(/'/g, "\\'")}'`,
        limit: 1,
      })
      return records[0] || null
    } catch (_) {
      return null
    }
  },
}

// =============================================================================
// RECRUTAMENTO PÚBLICO E GESTÃO DE DOCUMENTOS DE PRESTADORES
// =============================================================================

export const recrutamentoService = {
  /**
   * Submissão pública de pré-cadastro através do slug de recrutamento (sem login).
   * POST /backend/v1/recrutamento/{slug}
   */
  async submeterPreCadastro(
    slug: string,
    payload: PreCadastroPublicoPayload,
  ): Promise<PreCadastroPublicoResponse> {
    return pb.send(`/backend/v1/recrutamento/${encodeURIComponent(slug)}`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Listagem de links de recrutamento (Admin / Gestor)
   */
  async listLinks(filter?: string): Promise<LinkRecrutamentoRecord[]> {
    return pb.collection('links_recrutamento').getFullList<LinkRecrutamentoRecord>({
      filter: filter || '',
      sort: '-created',
    })
  },

  /**
   * Obter link de recrutamento por slug (Público ou Admin / Gestor).
   * Prioriza o endpoint público /backend/v1/recrutamento/link-publico/:slug para acesso sem token.
   * Se o usuário estiver autenticado ou a rota falhar, faz fallback para coleção links_recrutamento.
   */
  async getLinkBySlug(slug: string): Promise<LinkRecrutamentoRecord | null> {
    const safeSlug = (slug || '').trim()
    if (!safeSlug) return null

    // 1. Tentar primeiro o endpoint público dedicado via pb.send (sem token / seguro contra vazamento de campos internos)
    try {
      const data = await pb.send<{ valido: boolean; link: LinkRecrutamentoRecord }>(
        `/backend/v1/recrutamento/link-publico/${encodeURIComponent(safeSlug)}`,
        { method: 'GET' },
      )
      if (data && data.valido && data.link) {
        return data.link
      }
    } catch (e) {
      console.warn('Fallback para coleção links_recrutamento após falha no endpoint público:', e)
    }

    // 2. Fallback via SDK PocketBase (habilitado pela regra pública ativa da migração 0113)
    try {
      const list = await pb.collection('links_recrutamento').getList<LinkRecrutamentoRecord>(1, 1, {
        filter: `slug = '${safeSlug.replace(/'/g, "\\'")}' && ativo = true`,
      })
      const link = list.items[0] || null
      if (link && link.expira_em) {
        const expirado = new Date(link.expira_em).getTime() < Date.now()
        if (expirado) return null
      }
      return link
    } catch {
      return null
    }
  },

  /**
   * Cria novo link de recrutamento com slug amigável (Admin / Gestor)
   */
  async createLink(data: {
    slug: string
    titulo?: string
    disciplina_alvo?: string
    ativo?: boolean
    expira_em?: string
  }): Promise<LinkRecrutamentoRecord> {
    return pb.collection('links_recrutamento').create<LinkRecrutamentoRecord>({
      ...data,
      ativo: data.ativo !== undefined ? data.ativo : true,
      contador_acessos: 0,
    })
  },

  /**
   * Atualiza link de recrutamento (ativar/desativar, prorrogar expiração)
   */
  async updateLink(
    id: string,
    data: Partial<LinkRecrutamentoRecord>,
  ): Promise<LinkRecrutamentoRecord> {
    return pb.collection('links_recrutamento').update<LinkRecrutamentoRecord>(id, data)
  },

  /**
   * Remove link de recrutamento (Admin)
   */
  async deleteLink(id: string): Promise<boolean> {
    return pb.collection('links_recrutamento').delete(id)
  },
}

export const prestadoresDocumentosService = {
  /**
   * Lista documentos de um prestador.
   * Isolamento por RLS: Prestador vê apenas os seus; Admin/Gestor veem todos.
   */
  async listByPrestador(prestadorId: string): Promise<PrestadorDocumentoRecord[]> {
    return pb.collection('prestadores_documentos').getFullList<PrestadorDocumentoRecord>({
      filter: `prestador = '${prestadorId}'`,
      sort: '-created',
      expand: 'prestador,verificado_por',
    })
  },

  /**
   * Upload de documento para um prestador (dono logado ou Admin/Gestor).
   * Aceita FormData para envio do arquivo binário protegido.
   */
  async upload(data: {
    prestador: string
    tipo: string
    arquivo: File | Blob
    validade?: string
  }): Promise<PrestadorDocumentoRecord> {
    const formData = new FormData()
    formData.append('prestador', data.prestador)
    formData.append('tipo', data.tipo)
    formData.append('arquivo', data.arquivo)
    if (data.validade) formData.append('validade', data.validade)
    formData.append('status_verificacao', 'pendente')

    return pb.collection('prestadores_documentos').create<PrestadorDocumentoRecord>(formData)
  },

  /**
   * Alias de conveniência para upload de documento
   */
  async uploadDocumento(
    prestadorId: string,
    tipo: string,
    arquivo: File | Blob,
    validade?: string,
  ): Promise<PrestadorDocumentoRecord> {
    return this.upload({ prestador: prestadorId, tipo, arquivo, validade })
  },

  /**
   * Verificação/Validação técnica de documento (Admin / Gestor).
   */
  async verificarDocumento(
    docId: string,
    status: 'aprovado' | 'rejeitado',
    motivoRejeicao?: string,
  ): Promise<PrestadorDocumentoRecord> {
    const userId = pb.authStore.model?.id
    return pb.collection('prestadores_documentos').update<PrestadorDocumentoRecord>(docId, {
      status_verificacao: status,
      motivo_rejeicao: motivoRejeicao || '',
      verificado_por: userId || undefined,
    })
  },

  /**
   * Remove documento (Admin / Gestor).
   */
  async delete(id: string): Promise<boolean> {
    return pb.collection('prestadores_documentos').delete(id)
  },
}
