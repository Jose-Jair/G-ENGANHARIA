export type UserRole = 'admin' | 'comercial' | 'financeiro' | 'gestor' | 'executor'

export interface UserRecord {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  cpf_cnpj?: string
  active?: boolean
  mfa_enabled?: boolean
  mfa_secret?: string
  ultimo_login?: string
  created: string
  updated: string
}

export interface ParametroRecord {
  id: string
  chave: string
  valor: string
  descricao: string
  created: string
  updated: string
}

export interface ModeloRecord {
  id: string
  tipo: 'email_institucional' | 'solucao_elaborada' | 'piloto' | 'campanha' | 'proposta' | 'cotacao'
  nome: string
  assunto: string
  corpo: string
  created: string
  updated: string
}

export interface MotivoRecord {
  id: string
  tipo: 'inativacao' | 'recusa_proposta' | 'cancelamento_toque'
  descricao: string
  ativo: boolean
  created: string
  updated: string
}

export interface AuditLogRecord {
  id: string
  user?: string
  user_email?: string
  acao: string
  entidade: string
  registro_id?: string
  detalhes?: {
    antes?: Record<string, unknown>
    depois?: Record<string, unknown>
    mensagem?: string
    role?: string
    [key: string]: unknown
  }
  ip?: string
  created: string
  updated: string
  expand?: {
    user?: UserRecord
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  gestor: 'Gestor de Projetos',
  executor: 'Executor externo',
}

export type EtapaFunil =
  | 'identificada'
  | 'qualificada'
  | 'em_cadencia'
  | 'em_conversa'
  | 'com_proposta_elaborada'
  | 'proposta_enviada'
  | 'parceira'
  | 'nutricao_mensal'
  | 'inativa'

export const ETAPA_FUNIL_LABELS: Record<EtapaFunil, string> = {
  identificada: 'Identificada',
  qualificada: 'Qualificada',
  em_cadencia: 'Em Cadência',
  em_conversa: 'Em Conversa',
  com_proposta_elaborada: 'Proposta Elaborada',
  proposta_enviada: 'Proposta Enviada',
  parceira: 'Parceira',
  nutricao_mensal: 'Nutrição Mensal',
  inativa: 'Inativa',
}

export type CurvaABC = 'A' | 'B' | 'C'

export type StatusEmpresa = 'ativa' | 'inativa'

export type TipoTelefoneEmpresa = 'celular' | 'whatsapp' | 'fixo'

export interface TelefoneItem {
  id: string
  numero: string
  tipo?: TipoTelefoneEmpresa
  whatsapp?: boolean
  ramalOuDescricao?: string
}

export type TelefoneEmpresaItem = TelefoneItem

// RODADA 10: 5 Colunas oficiais do Funil Enxuto
export type ColunaFunil5 =
  | 'identificada'
  | 'qualificada'
  | 'em_proposta'
  | 'negociacao'
  | 'ganha_perdida'

export const COLUNAS_FUNIL_5_LABELS: Record<ColunaFunil5, string> = {
  identificada: 'Identificada',
  qualificada: 'Qualificada',
  em_proposta: 'Em proposta',
  negociacao: 'Negociação',
  ganha_perdida: 'Ganha / Perdida',
}

export interface EmpresaRecord {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  situacao_cadastral?: string
  cnae?: string
  porte?: string
  uf?: string
  municipio?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  email?: string
  telefone?: string
  telefones?: TelefoneItem[]
  instagram?: string
  linkedin?: string
  site?: string
  etapa_funil?: EtapaFunil
  is_parceira?: boolean
  data_selo_parceira?: string
  tipo_cliente?: 'pj' | 'pf'
  cliente_pf_ref?: string
  curva?: CurvaABC
  score?: number
  responsavel?: string
  status?: StatusEmpresa
  motivo_inativacao?: string
  etapa_anterior?: string
  proxima_acao_data?: string
  proxima_acao_desc?: string
  observacoes?: string
  pre_cadastro?: boolean
  created: string
  updated: string
  expand?: {
    responsavel?: UserRecord
    'contratos(empresa)'?: ContratoRecord[]
    'contatos(empresa)'?: ContatoRecord[]
    cliente_pf_ref?: ClientePfRecord
  }
}

export type SugestaoFonte = 'planilha' | 'pncp' | 'manual'
export type SugestaoStatus = 'pendente' | 'aprovada_para_inclusao' | 'incorporada' | 'descartada'

export interface SugestaoFunilRecord {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  uf?: string
  municipio?: string
  email?: string
  telefone?: string
  cnae?: string
  porte?: string
  orgao_contrato?: string
  numero_contrato?: string
  objeto_contrato?: string
  valor_estimado?: number
  fonte: SugestaoFonte
  status: SugestaoStatus
  motivo_descarte?: string
  observacoes?: string
  empresa_criada?: string
  decidido_por?: string
  data_decisao?: string
  created: string
  updated: string
  expand?: {
    empresa_criada?: EmpresaRecord
    decidido_por?: UserRecord
  }
}

export interface ReativacaoSugeridaRecord {
  id: string
  empresa: string
  contrato?: string
  contrato_numero?: string
  contrato_orgao?: string
  contrato_valor?: number
  etapa_origem?: string
  status: 'pendente' | 'aceita' | 'descartada'
  destino_aceito?: string
  observacao_decisao?: string
  decidido_por?: string
  data_decisao?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    contrato?: ContratoRecord
    decidido_por?: UserRecord
  }
}

export interface NaoContatarRecord {
  id: string
  empresa?: string
  email: string
  motivo?: string
  data_inclusao?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface PesosScoreCurva {
  peso_valor: number // ex: 40
  peso_vigencia: number // ex: 25
  peso_qtd_contratos: number // ex: 20
  peso_aderencia_disciplinas: number // ex: 15
}

export interface ContatoRecord {
  id: string
  empresa: string
  nome: string
  cargo?: string
  email?: string
  telefone?: string
  whatsapp?: string
  decisor?: boolean
  verificado?: boolean
  created: string
  updated: string
}

export type StatusRevisaoContrato = 'rascunho_pendente' | 'revisado' | 'ativo'

export interface ContratoRecord {
  id: string
  empresa: string
  orgao: string
  numero: string
  objeto?: string
  modalidade?: string
  valor?: number
  saldo?: number
  vigencia_inicio?: string
  vigencia_fim?: string
  situacao?: string
  link_edital?: string
  fonte?: string
  status_revisao?: StatusRevisaoContrato
  sugestao_origem?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    sugestao_origem?: SugestaoFunilRecord
  }
}

export type StatusToque =
  | 'agendado'
  | 'para_hoje'
  | 'em_atraso'
  | 'realizado'
  | 'respondido'
  | 'cancelado'

export type StatusVisualToque =
  | 'bloqueado'
  | 'para_hoje'
  | 'em_atraso'
  | 'agendado'
  | 'realizado'
  | 'respondido'
  | 'cancelado'

export interface ToqueRecord {
  id: string
  empresa: string
  numero_toque: number
  data_prevista: string
  data_realizada?: string
  canal: 'email' | 'whatsapp' | string
  status: StatusToque
  resultado?: string
  observacao?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
  }
}

export interface ToqueComCalculo extends ToqueRecord {
  statusCalculado: StatusVisualToque
  isLiberadoParaExecucao: boolean
  diasAtraso: number
  isCriticoAdmin: boolean
}

export type CenarioEntrada = 'nova' | 'cadastrada' | 'parceira'

export type StatusCampanha = 'rascunho' | 'devolvida' | 'aprovada' | 'agendada' | 'enviada'
export type SegmentoCampanha = 'A' | 'B' | 'C' | 'todos'

export interface CampanhaRecord {
  id: string
  nome: string
  segmento: SegmentoCampanha
  status: StatusCampanha
  data_envio?: string
  template?: string
  assunto?: string
  corpo?: string
  observacao_devolucao?: string
  aprovado_por?: string
  aprovado_em?: string
  enviados?: number
  abertos?: number
  cliques?: number
  respostas?: number
  descadastros?: number
  created: string
  updated: string
  expand?: {
    template?: ModeloRecord
    aprovado_por?: UserRecord
  }
}

export type StatusEnvioCampanha = 'pendente' | 'enviado' | 'falha' | 'bloqueado_nao_contatar'

export interface CampanhaEnvioRecord {
  id: string
  campanha: string
  empresa: string
  destinatario_email: string
  destinatario_nome?: string
  status: StatusEnvioCampanha
  token_rastreamento: string
  enviado_em?: string
  aberto_em?: string
  total_aberturas?: number
  cliques?: number
  ultimo_clique_em?: string
  resposta_em?: string
  resposta_observacao?: string
  descadastro_em?: string
  erro_mensagem?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    campanha?: CampanhaRecord
  }
}

export interface CampanhaCalculada extends CampanhaRecord {
  isProntaParaDisparo: boolean // Aprovada ou Agendada com data_envio <= hoje
  taxaAbertura: number // %
  taxaClique: number // %
  taxaResposta: number // %
  taxaDescadastro: number // %
}

export interface MetricasConsolidadasCampanhas {
  totalCampanhas: number
  totalEnviados: number
  totalAbertos: number
  totalCliques: number
  totalRespostas: number
  totalDescadastros: number
  taxaAberturaGeral: number
  taxaCliqueGeral: number
  taxaRespostaGeral: number
  taxaDescadastroGeral: number
}

/* ==========================================================================
   ETAPA 6 — PARCEIROS E CLIENTES (PF & PJ)
   ========================================================================== */

export type BaseLegalLgpd =
  | 'consentimento'
  | 'execucao_contrato'
  | 'obrigacao_legal'
  | 'legitimo_interesse'

export const BASE_LEGAL_LGPD_LABELS: Record<BaseLegalLgpd, string> = {
  consentimento: 'Consentimento do Titular (Art. 7º, I)',
  execucao_contrato: 'Execução de Contrato (Art. 7º, V)',
  obrigacao_legal: 'Cumprimento de Obrigação Legal (Art. 7º, II)',
  legitimo_interesse: 'Legítimo Interesse (Art. 7º, IX)',
}

export interface ClientePfRecord {
  id: string
  nome: string
  cpf: string
  email?: string
  telefone?: string
  telefones?: TelefoneItem[]
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  base_legal?: BaseLegalLgpd | string
  consentimento_lgpd: boolean
  data_consentimento?: string
  endereco?: string
  observacoes?: string
  pre_cadastro?: boolean
  created: string
  updated: string
}

export interface AreaAtuacaoRecord {
  id: string
  nome: string
  descricao?: string
  ordem?: number
  ativo: boolean
  created: string
  updated: string
}

export interface SubservicoRecord {
  id: string
  area: string
  nome: string
  descricao?: string
  ativo: boolean
  created: string
  updated: string
  expand?: {
    area?: AreaAtuacaoRecord
  }
}

export interface EntregavelPadraoRecord {
  id: string
  area: string
  subservico?: string
  nome: string
  descricao?: string
  ordem?: number
  ativo: boolean
  created: string
  updated: string
  expand?: {
    area?: AreaAtuacaoRecord
    subservico?: SubservicoRecord
  }
}

export interface PropostaParcelaRecord {
  id: string
  proposta: string
  ordem: number
  percentual: number
  valor: number
  gatilho: 'contratacao' | 'entrega' | 'marco'
  descricao: string
  created: string
  updated: string
  expand?: {
    proposta?: PropostaRecord
  }
}

export interface CatalogoServicoRecord {
  id: string
  nome: string
  disciplina: string
  unidade: string
  preco_base: number
  descricao?: string
  ativo: boolean
  area?: string
  precisa_revisao_area?: boolean
  created: string
  updated: string
  expand?: {
    area?: AreaAtuacaoRecord
  }
}

export interface PropostaItemRecord {
  id?: string
  proposta?: string
  servico?: string
  area?: string
  origem?: 'catalogo' | 'avulso'
  subservicos?: string[] // IDs ou nomes de subserviços
  status_conversao?: 'nao_convertido' | 'convertido'
  projeto_gerado?: string
  etapa_gerada?: string
  entregaveis_sugeridos?: string[]
  descricao: string
  disciplina?: string
  unidade?: string
  quantidade: number
  custo_unitario: number
  custo_total: number
  preco_venda_unitario?: number
  bdi_percentual?: number
  preco_total?: number
  created?: string
  updated?: string
  expand?: {
    servico?: CatalogoServicoRecord
    area?: AreaAtuacaoRecord
    projeto_gerado?: ProjetoRecord
    etapa_gerada?: ProjetoEtapaRecord
  }
}

export interface PropostaRevisaoHistorico {
  revisao: string
  data: string
  responsavel_nome?: string
  preco: number
  custo: number
  margem: number
  impostos: number
  conteudo_snapshot: {
    escopo: string
    disciplinas?: string
    entregaveis?: string
    prazo?: string
    condicoes_pagamento?: string
    premissas?: string
    exclusoes?: string
    itens_json?: PropostaItemRecord[]
  }
}

export interface PropostaRecord {
  id: string
  numero: string
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
  requer_nota?: boolean
  // Novos campos do modelo GMAIS
  empreendimento?: string
  objeto?: string
  escopo_gerado?: string
  prazo_dias?: number
  nota_prazo?: string
  validade_dias?: number
  condicoes_gerais?: string
  status:
    | 'rascunho'
    | 'aprovada'
    | 'enviada'
    | 'visualizada'
    | 'em_negociacao'
    | 'aceita'
    | 'convertida_em_projeto'
    | 'recusada'
    | 'expirada'
  motivo_recusa?: string
  detalhe_recusa?: string
  token_aceite?: string
  itens_json?: PropostaItemRecord[]
  historico_revisoes?: PropostaRevisaoHistorico[]
  data_visualizacao?: string
  data_aceite?: string
  data_recusa?: string
  // Campos de integridade, validade jurídica e negociação
  aceite_ip?: string
  aceite_user_agent?: string
  aceite_declaracao?: boolean
  aceite_hash?: string
  solicitacao_alteracao_texto?: string
  data_solicitacao_alteracao?: string
  historico_devolutivas?: Array<{
    data: string
    versao?: string
    texto: string
    autor?: string
  }>
  dados_complementares_preenchidos?: boolean
  contrato_servico?: string
  parecer_financeiro?: string
  aprovador_financeiro?: string
  data_aprovacao_financeira?: string
  requer_aprovacao_admin?: boolean
  aprovador_admin?: string
  data_aprovacao_admin?: string
  criado_por?: string
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
    cliente_pf?: ClientePfRecord
    contrato?: ContratoRecord
    modelo?: ModeloRecord
    criado_por?: UserRecord
    aprovador_financeiro?: UserRecord
    aprovador_admin?: UserRecord
    contrato_servico?: ContratoServicoRecord
  }
}

export type StatusContratoServico =
  | 'aguardando_dados_cliente'
  | 'aguardando_assinatura_admin'
  | 'aguardando_assinatura_cliente'
  | 'assinado'
  | 'cancelado'

export interface ContratoServicoParcela {
  ordem: number
  percentual: number
  valor: number
  gatilho: string
  descricao: string
}

export interface ContratoServicoRecord {
  id: string
  numero: string // CTR-AAAA-NNNN
  proposta: string
  projeto?: string
  empresa?: string
  cliente_pf?: string
  objeto: string
  valor_total: number
  prazo_dias?: number
  nota_prazo?: string
  clausulas_texto?: string
  parcelas_json?: ContratoServicoParcela[]
  status: StatusContratoServico
  // Bloco 3: Complemento de dados
  token_complemento_dados?: string
  campos_faltantes_json?: string[]
  dados_completados_em?: string
  // Assinatura Admin
  assinante_admin?: string
  data_assinatura_admin?: string
  admin_ip?: string
  admin_user_agent?: string
  admin_declaracao?: boolean
  admin_hash?: string
  // Assinatura Cliente
  token_assinatura_cliente?: string
  cliente_nome_assinante?: string
  cliente_documento_assinante?: string
  data_assinatura_cliente?: string
  cliente_ip?: string
  cliente_user_agent?: string
  cliente_declaracao?: boolean
  cliente_hash?: string
  arquivo_pdf_assinado?: string
  created: string
  updated: string
  expand?: {
    proposta?: PropostaRecord
    projeto?: ProjetoRecord
    empresa?: EmpresaRecord
    cliente_pf?: ClientePfRecord
    assinante_admin?: UserRecord
  }
}

export type SaudeProjeto = 'verde' | 'amarelo' | 'vermelho'
export type TipoExecucaoEtapa = 'direta' | 'terceirizada' | 'mista'
export type StatusEtapa =
  | 'a_iniciar'
  | 'cotacao'
  | 'em_andamento'
  | 'revisao'
  | 'concluida'
  | 'cancelada'
export type StatusEntregavel =
  | 'elaborando'
  | 'revisao_interna'
  | 'enviado_cliente'
  | 'aprovado'
  | 'reprovado'
export type TipoDocumento = 'ART' | 'RRT' | 'TRT' | 'OS' | 'medicao'
export type ProbabilidadeRisco = 'baixa' | 'media' | 'alta'
export type ImpactoRisco = 'baixo' | 'medio' | 'alto'
export type StatusRisco = 'aberto' | 'mitigado' | 'realizado'
export type TipoExecutor = 'PF' | 'PJ'
export type ConselhoClasse = 'CREA' | 'CAU' | 'CFT' | 'OUTRO'
export type StatusExecutor = 'homologacao' | 'ativo' | 'suspenso'
export type StatusCotacao =
  | 'convite_enviado'
  | 'respondida'
  | 'escolhida'
  | 'nao_escolhida'
  | 'recusada'

export type ModoExecucaoProjeto =
  | 'direta'
  | 'cotacao'
  | 'terceirizada_parcial'
  | 'terceirizada_integral'

export type StatusProjeto =
  | 'aguardando_definicao'
  | 'contratacao'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado'
  | 'pausado'

export interface SugestaoExecutorArea {
  id: string
  nome: string
  tipo: TipoExecutor
  cpf_cnpj?: string
  email?: string
  telefone?: string
  telefone_normalizado: string
  disciplinas?: string
  regiao?: string
  nota_geral: number
  total_avaliacoes: number
  status: StatusExecutor
  compatibilidade: number
  termos_compativeis: string[]
}

export interface SugestoesExecutoresResponse {
  projeto_id: string
  projeto_codigo: string
  disciplinas_projeto?: string
  total_encontrados: number
  sugestoes: SugestaoExecutorArea[]
}

export interface GrupoProjetosRecord {
  id: string
  codigo: string
  contrato_servico?: string
  proposta?: string
  empresa?: string
  cliente_pf?: string
  nome?: string
  descricao?: string
  status?: 'em_contratacao' | 'ativo' | 'concluido' | 'cancelado'
  valor_total?: number
  created: string
  updated: string
  expand?: {
    contrato_servico?: ContratoServicoRecord
    proposta?: PropostaRecord
    empresa?: EmpresaRecord
    cliente_pf?: ClientePfRecord
  }
}

export interface ProjetoRecord {
  id: string
  codigo: string
  nome?: string
  descricao?: string
  disciplinas?: string
  proposta?: string
  contrato?: string
  contrato_servico?: string
  grupo?: string
  modo_execucao?: ModoExecucaoProjeto | null
  descricao_delegada?: string
  empresa?: string
  cliente_pf?: string
  valor_total?: number
  prazo_final?: string
  subcontratacao_autorizada?: boolean
  anexo_autorizacao?: string
  saude?: SaudeProjeto
  justificativa_saude?: string
  status?: StatusProjeto
  created: string
  updated: string
  expand?: {
    proposta?: PropostaRecord
    contrato?: ContratoRecord
    contrato_servico?: ContratoServicoRecord
    grupo?: GrupoProjetosRecord
    empresa?: EmpresaRecord
    cliente_pf?: ClientePfRecord
  }
}

export interface ExecutorRecord {
  id: string
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
  nda_contrato?: string
  documento_termo?: string
  token_cadastro?: string
  token_cadastro_expira?: string
  status: StatusExecutor
  motivo_suspensao?: string
  nota_geral?: number
  total_avaliacoes?: number
  created: string
  updated: string
}

export interface ProjetoEtapaRecord {
  id: string
  projeto: string
  area?: string
  nome: string
  descricao?: string
  ordem?: number
  disciplina?: string
  tipo_execucao: TipoExecucaoEtapa
  executor?: string
  prazo?: string
  prazo_fim?: string
  data_inicio?: string
  data_conclusao?: string
  custo_estimado?: number
  valor_executor?: number
  status: StatusEtapa
  is_pacote_trabalho?: boolean
  is_marco?: boolean
  valor_interno_referencia?: number
  valor_vendido?: number
  escopo_detalhado?: string
  proposta_item_origem?: string
  parcela_origem?: string
  ordem_servico_ativa?: string
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
    executor?: ExecutorRecord
    area?: AreaAtuacaoRecord
    ordem_servico_ativa?: OrdemServicoRecord
    parcela_origem?: any
    proposta_item_origem?: any
  }
}

export interface EntregavelRecord {
  id: string
  etapa: string
  nome: string
  titulo?: string
  descricao?: string
  versao?: string
  versao_atual?: number
  status:
    | StatusEntregavel
    | 'atribuido'
    | 'em_producao'
    | 'enviado_revisao'
    | 'aprovado'
    | 'devolvido'
  arquivo?: string
  prestador?: string
  ordem_servico?: string
  prazo?: string
  revisor_interno?: string
  motivo_devolucao?: string
  data_aprovacao?: string
  observacoes_revisao?: string
  created: string
  updated: string
  expand?: {
    etapa?: ProjetoEtapaRecord
    prestador?: PrestadorRecord
    revisor_interno?: UserRecord
    ordem_servico?: OrdemServicoRecord
  }
}

export interface EntregavelVersaoRecord {
  id: string
  entregavel: string
  numero_versao: number
  arquivo?: string
  enviado_por?: string
  enviado_em?: string
  status: 'submetido' | 'em_revisao' | 'aprovado' | 'devolvido'
  motivo_devolucao?: string
  avaliado_por?: string
  avaliado_em?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    entregavel?: EntregavelRecord
    enviado_por?: UserRecord
    avaliado_por?: UserRecord
  }
}

export interface CatalogoEscopoItemEntregavel {
  nome: string
  descricao?: string
  ordem?: number
}

export interface CatalogoEscopoChecklistItem {
  item: string
  obrigatorio: boolean
}

export interface CatalogoEscopoRecord {
  id: string
  disciplina: string
  nome: string
  entregaveis_padrao?: CatalogoEscopoItemEntregavel[]
  checklist_revisao?: CatalogoEscopoChecklistItem[]
  ativo: boolean
  created: string
  updated: string
}

export interface SugestaoPrestadorItem {
  prestador_id: string
  nome: string
  tipo: 'interno' | 'pf_externo' | 'pj_externo' | string
  email: string
  uf: string
  disciplinas: string[]
  nota_media: number
  capacidade_maxima: number
  capacidade_livre: number
  os_ativas: number
  tendencia: 'melhorou' | 'estavel' | 'piorou'
  score_final: number
  motivos: string[]
  conselho_validade: string
}

export interface DocumentoRecord {
  id: string
  projeto?: string
  etapa?: string
  tipo: TipoDocumento
  numero?: string
  descricao?: string
  responsavel_tecnico?: string
  arquivo?: string
  vencimento?: string
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
    etapa?: ProjetoEtapaRecord
  }
}

export interface RiscoRecord {
  id: string
  projeto: string
  descricao: string
  probabilidade: ProbabilidadeRisco
  impacto: ImpactoRisco
  mitigacao?: string
  status: StatusRisco
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
  }
}

export interface CotacaoRecord {
  id: string
  etapa?: string
  pacote?: string
  prestador?: string
  projeto?: string
  grupo?: string
  executor?: string
  disciplina?: string
  escopo?: string
  automatica?: boolean
  lembrete_enviado?: boolean
  data_limite_resposta?: string
  prazo_resposta?: string
  data_limite?: string
  preco_ofertado?: number
  prazo_ofertado?: string
  observacoes?: string
  motivo_encerramento?: string
  status?: StatusCotacao | 'convite_enviado' | 'respondida' | 'escolhida' | 'expirada' | 'encerrada'
  escolhida?: boolean
  token?: string
  data_resposta?: string
  resposta_externa?: boolean
  registrado_por?: string
  created: string
  updated: string
  expand?: {
    etapa?: ProjetoEtapaRecord
    pacote?: ProjetoEtapaRecord
    prestador?: PrestadorRecord
    projeto?: ProjetoRecord
    grupo?: GrupoProjetosRecord
    executor?: ExecutorRecord
    registrado_por?: UserRecord
  }
}

export interface ItemRankingCotacao {
  cotacao_id: string
  prestador_id: string
  prestador_nome: string
  prestador_tipo: string
  status: string
  preco_ofertado: number
  prazo_ofertado: string
  data_resposta?: string
  observacoes?: string
  escolhida: boolean
  nota_geral: number
  tendencia: 'melhorou' | 'estavel' | 'piorou'
  capacidade_maxima: number
  carga_atual: number
  capacidade_livre: number
  ultrapassa_referencia: boolean
  score_final: number
  respondida: boolean
}

export interface RankingCotacoesPacoteResponse {
  pacote_id: string
  pacote_nome: string
  disciplina: string
  valor_interno_referencia: number
  valor_vendido: number
  total: number
  ranking: ItemRankingCotacao[]
}

export type StatusSubcontrato =
  | 'minuta'
  | 'aguardando_assinatura'
  | 'assinado'
  | 'em_execucao'
  | 'concluido'
  | 'avaliado'
  | 'encerrado'
  | 'cancelado'

export const STATUS_SUBCONTRATO_LABELS: Record<
  StatusSubcontrato,
  { label: string; cor: string; variant?: string }
> = {
  minuta: { label: 'Minuta', cor: 'bg-slate-100 text-slate-700 border-slate-300' },
  aguardando_assinatura: {
    label: 'Aguardando Assinatura',
    cor: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  assinado: { label: 'Assinado', cor: 'bg-blue-50 text-blue-800 border-blue-300' },
  em_execucao: { label: 'Em Execução', cor: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
  concluido: { label: 'Concluído', cor: 'bg-purple-50 text-purple-800 border-purple-300' },
  avaliado: { label: 'Avaliado', cor: 'bg-teal-50 text-teal-800 border-teal-300' },
  encerrado: { label: 'Encerrado', cor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  cancelado: { label: 'Cancelado', cor: 'bg-rose-50 text-rose-800 border-rose-300' },
}

export type StatusRetencaoTecnica =
  | 'sem_retencao'
  | 'acumulando'
  | 'parcialmente_liberada'
  | 'totalmente_liberada'

export const STATUS_RETENCAO_LABELS: Record<StatusRetencaoTecnica, { label: string; cor: string }> =
  {
    sem_retencao: { label: 'Sem Retenção', cor: 'bg-slate-100 text-slate-600 border-slate-200' },
    acumulando: {
      label: 'Retenção Acumulando',
      cor: 'bg-amber-50 text-amber-800 border-amber-300',
    },
    parcialmente_liberada: {
      label: 'Parcialmente Liberada',
      cor: 'bg-blue-50 text-blue-800 border-blue-300',
    },
    totalmente_liberada: {
      label: 'Totalmente Liberada',
      cor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    },
  }

export interface ItemChecklistEncerramento {
  id: string
  titulo: string
  descricao?: string
  concluido: boolean
  concluido_por?: string
  data_conclusao?: string
}

export interface ParcelaSubcontratoItem {
  numero?: number
  descricao?: string
  valor: number
  vencimento?: string
  status?: string
  gatilho?: string
}

export interface SubcontratoRecord {
  id: string
  numero: string // SUB-AAAA-NNNN
  projeto: string
  grupo?: string
  contrato_servico_origem?: string
  executor: string
  cotacao?: string
  modo_execucao: ModoExecucaoProjeto
  descricao_escopo?: string
  descricao_delegada?: string
  valor_total: number
  prazo_dias: number
  nota_prazo?: string
  clausulas_texto?: string
  condicoes_pagamento?: string
  parcelas_json?: ParcelaSubcontratoItem[]
  status: StatusSubcontrato
  token_assinatura?: string
  emitido_por?: string
  data_emissao?: string
  data_assinatura_executor?: string
  executor_nome_assinante?: string
  executor_documento_assinante?: string
  executor_ip?: string
  executor_user_agent?: string
  executor_declaracao?: boolean
  executor_hash?: string
  percentual_retencao_tecnica?: number
  retencao_tecnica_acumulada?: number
  retencao_tecnica_liberada?: number
  status_retencao?: StatusRetencaoTecnica
  checklist_encerramento_json?: ItemChecklistEncerramento[]
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
    grupo?: GrupoProjetosRecord
    contrato_servico_origem?: ContratoServicoRecord
    executor?: ExecutorRecord
    cotacao?: CotacaoRecord
    emitido_por?: UserRecord
  }
}

export interface AvaliacaoRecord {
  id: string
  executor: string
  etapa: string
  avaliado_por?: string
  pontualidade: number // 1 a 5
  qualidade: number // 1 a 5
  desvio_custo: number // 1 a 5
  responsividade: number // 1 a 5
  nota_final?: number
  comentario?: string
  created: string
  updated: string
  expand?: {
    executor?: ExecutorRecord
    etapa?: ProjetoEtapaRecord
    avaliado_por?: UserRecord
  }
}

export interface PesosAvaliacaoExecutor {
  peso_pontualidade: number // default 30%
  peso_qualidade: number // default 35%
  peso_desvio_custo: number // default 20%
  peso_responsividade: number // default 15%
}

export interface ModeloEtapaDisciplina {
  disciplina: string
  etapas: string[]
}

export type StatusConta =
  | 'rascunho'
  | 'aprovada'
  | 'enviada'
  | 'paga'
  | 'atrasada'
  | 'cancelada'
  | 'prevista'
  | 'realizada'

export interface ContaRecord {
  id: string
  tipo: 'receber' | 'pagar'
  projeto?: string
  proposta?: string
  contrato_servico?: string
  executor?: string
  etapa?: string
  descricao: string
  valor: number
  retencao_impostos?: number
  valor_liquido?: number
  vencimento?: string
  data_pagamento?: string
  status: StatusConta
  nf?: string
  forma_pagamento?: string
  anexo_comprovante?: string
  motivo_cancelamento?: string
  medicao_aprovada_origem?: string
  bloqueada_por_fechamento?: boolean
  created: string
  updated: string
  subcontrato?: string
  expand?: {
    projeto?: ProjetoRecord
    proposta?: PropostaRecord
    contrato_servico?: ContratoServicoRecord
    executor?: ExecutorRecord
    etapa?: ProjetoEtapaRecord
    subcontrato?: SubcontratoRecord
  }
}

export type StatusMedicao = 'apresentada' | 'aprovada' | 'reprovada' | 'faturada' | 'paga'

export interface MedicaoRecord {
  id: string
  numero: string // MED-AAAA-NNNN
  subcontrato: string
  projeto: string
  executor: string
  numero_medicao: number
  periodo_inicio: string
  periodo_fim: string
  percentual_executado: number
  valor_bruto: number
  retencao_impostos?: number
  percentual_retencao_tecnica?: number
  valor_retencao_tecnica?: number
  aceita_pelo_cliente?: boolean
  data_aceitacao_cliente?: string
  responsavel_aceitacao_cliente?: string
  valor_liquido: number
  status: StatusMedicao
  aprovada_por?: string
  data_aprovacao?: string
  observacoes_gestor?: string
  anexos?: string[]
  created: string
  updated: string
  expand?: {
    subcontrato?: SubcontratoRecord
    projeto?: ProjetoRecord
    executor?: ExecutorRecord
    aprovada_por?: UserRecord
  }
}

export interface PesosScoreDemandaParceiro {
  peso_contratos_valor: number // ex: 35%
  peso_taxa_conversao: number // ex: 35%
  peso_projetos_ano: number // ex: 30%
}

export interface IndicadoresParceiro {
  empresaId: string
  empresa: EmpresaRecord
  receitaAcumulada: number
  margemMedia: number // %
  ticketMedio: number // R$
  prazoMedioPagamentoDias: number // dias médios até liquidação
  ultimaDemandaData: string | null // data da última proposta ou projeto
  diasSemDemanda: number
  isSemDemandaCritica: boolean // se diasSemDemanda >= limite configurado
  totalPropostasEnviadas: number
  totalPropostasAceitas: number
  taxaConversao: number // %
  totalProjetos: number
  projetosPorAno: number
  contratosAtivosQtd: number
  contratosAtivosValor: number
  scoreDemanda: number // 0 a 100
  componentesScore?: {
    contratosNorm: number
    conversaoNorm: number
    projetosNorm: number
  }
  curvaDinamica: CurvaABC
  percentualReceitaAcumulada: number // fatia acumulada no Pareto (0 a 100%)
  ranking: number
}

// ==========================================
// VISÃO GERENCIAL DO FINANCEIRO (ETAPA DE EVOLUÇÃO)
// ==========================================

export interface VisaoGerencialFluxoMes {
  mesChave: string // '2026-10'
  rotulo: string // 'Out/2026'
  ano: number
  mes: number
  isPassado: boolean
  isAtual: boolean
  isFuturo: boolean
  entradasRealizadas: number
  entradasPrevistas: number
  totalEntradas: number
  saidasRealizadas: number
  saidasPrevistas: number
  totalSaidas: number
  saldoMes: number
  saldoAcumulado: number
  alertaNegativo: boolean
}

export interface VisaoGerencialFluxoCaixa {
  horizonte: 3 | 6 | 12
  meses: VisaoGerencialFluxoMes[]
  totais: {
    totalEntradas: number
    totalSaidas: number
    saldoFinal: number
    mesesComAlertaNegativo: number
  }
}

export interface VisaoGerencialProjetoMargem {
  id: string
  codigo: string
  nome?: string
  status?: string
  clienteNome: string
  propostaNumero?: string | null
  previsto: {
    preco: number
    custo: number
    margemPerc: number
    margemValor: number
  }
  real: {
    receitaRealizada: number
    receitaAprovadaPrevista: number
    receitaTotal: number
    custoPago: number
    custoComprometido: number
    custoTotal: number
    margemValor: number
    margemPerc: number
  }
  desvio: {
    pontosPercentuais: number
    erosaoPp: number
    semaforo: 'verde' | 'amarelo' | 'vermelho'
    descricao: string
  }
}

export interface VisaoGerencialMargemConsolidado {
  totalProjetos: number
  margemMediaPrevistaPerc: number
  margemMediaRealPerc: number
  desvioMedioPp: number
  projetosVerde: number
  projetosAmarelo: number
  projetosVermelho: number
}

export interface VisaoGerencialContaAtrasada {
  id: string
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  valorLiquido: number
  vencimento: string
  status: string
  diasAtraso: number
  projetoId?: string | null
  projetoCodigo?: string | null
  projetoNome?: string | null
  clienteNome?: string | null
  nf?: string | null
  executorId?: string | null
}

export interface VisaoGerencialAlertasAtraso {
  totalAtrasadosCount: number
  receber: {
    totalCount: number
    totalValor: number
    contas: VisaoGerencialContaAtrasada[]
  }
  pagar: {
    totalCount: number
    totalValor: number
    contas: VisaoGerencialContaAtrasada[]
  }
}

export interface VisaoGerencialDados {
  success: boolean
  data_referencia: string
  horizonte_meses: number
  bloco1_fluxo_caixa: VisaoGerencialFluxoCaixa
  bloco2_margem_projetos: {
    consolidado: VisaoGerencialMargemConsolidado
    projetos: VisaoGerencialProjetoMargem[]
  }
  bloco3_alertas_atraso: VisaoGerencialAlertasAtraso
}

// =============================================================================
// PRESTADORES, PROFISSIONAIS, CONTRATOS MESTRE, ORDENS DE SERVIÇO E PORTAL
// =============================================================================

export type TipoPrestador = 'interno' | 'pf_externo' | 'pj_externo'
export type StatusPrestador = 'ativo' | 'pendente' | 'suspenso' | 'inativo'

export interface PrestadorRecord {
  id: string
  tipo: TipoPrestador
  nome: string
  cpf_cnpj?: string
  email: string
  telefone?: string
  telefones?: TelefoneItem[]
  conselho?: string
  conselho_classe?: string
  numero_registro_conselho?: string
  validade_registro_conselho?: string
  disciplinas?: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: string
  nda_contrato?: string
  documento_termo?: string
  status: StatusPrestador
  motivo_suspensao?: string
  nota_geral?: number
  total_avaliacoes?: number
  token_cadastro?: string
  token_cadastro_expira?: string
  tentativas_token?: number
  executor_legado_id?: string
  created: string
  updated: string
  expand?: {
    profissionais?: ProfissionalPrestadorRecord[]
  }
}

export interface ProfissionalPrestadorRecord {
  id: string
  prestador: string
  nome: string
  conselho?: string
  numero?: string
  validade?: string
  email?: string
  telefone?: string
  cargo_funcao?: string
  ativo?: boolean
  created: string
  updated: string
  expand?: {
    prestador?: PrestadorRecord
  }
}

export type StatusContratoMestre =
  | 'minuta'
  | 'aguardando_assinatura_gmais'
  | 'aguardando_assinatura_prestador'
  | 'assinado'
  | 'cancelado'

export interface ContratoMestreRecord {
  id: string
  numero: string
  prestador: string
  status: StatusContratoMestre
  minuta_texto?: string
  clausulas_nda?: string
  token_assinatura?: string
  assinante_gmais?: string
  data_assinatura_gmais?: string
  gmais_ip?: string
  gmais_hash?: string
  assinante_prestador_nome?: string
  assinante_prestador_doc?: string
  data_assinatura_prestador?: string
  prestador_ip?: string
  prestador_hash?: string
  arquivo_pdf?: string
  data_emissao?: string
  token_expiracao?: string
  tentativas_token?: number
  created: string
  updated: string
  expand?: {
    prestador?: PrestadorRecord
    assinante_gmais?: UserRecord
  }
}

export type StatusOrdemServico =
  | 'minuta'
  | 'aguardando_assinatura'
  | 'assinada'
  | 'em_execucao'
  | 'concluida'
  | 'avaliada'
  | 'encerrada'
  | 'cancelada'

export type StatusRetencaoOS =
  | 'sem_retencao'
  | 'acumulando'
  | 'parcialmente_liberada'
  | 'totalmente_liberada'

export interface OrdemServicoRecord {
  id: string
  numero: string
  tipo_prestador: 'interno' | 'externo'
  projeto: string
  prestador: string
  contrato_mestre?: string
  subcontrato_legado?: string
  disciplina?: string
  escopo_tecnico?: string
  entregaveis_texto?: string
  prazo_dias?: number
  data_inicio?: string
  data_previsao_fim?: string
  data_conclusao?: string
  valor_os?: number
  status: StatusOrdemServico
  percentual_retencao_tecnica?: number
  retencao_tecnica_acumulada?: number
  retencao_tecnica_liberada?: number
  status_retencao?: StatusRetencaoOS
  checklist_encerramento_json?: Array<{
    id: string
    descricao: string
    concluido: boolean
    obrigatorio?: boolean
    data_conclusao?: string
    responsavel?: string
  }>
  aceite_cliente?: boolean
  data_aceite_cliente?: string
  token_assinatura?: string
  aceite_status?: 'pendente' | 'aguardando_codigo' | 'aceito' | 'recusado'
  data_aceite?: string
  aceite_ip?: string
  aceite_user_agent?: string
  codigo_verificacao_hash?: string
  codigo_expiracao?: string
  codigo_tentativas?: number
  codigo_enviado_para?: string
  pdf_congelado_hash?: string
  versao_texto_hash?: string
  versao_texto_aceito?: string
  dossie_evidencias_json?: any
  confirmacao_email_enviada?: boolean
  assinante_prestador_nome?: string
  assinante_prestador_doc?: string
  data_assinatura_prestador?: string
  prestador_ip?: string
  prestador_hash?: string
  clausulas_texto?: string
  parcelas_json?: Array<{
    numero: number
    descricao: string
    valor: number
    percentual?: number
    vencimento?: string
  }>
  emitido_por?: string
  token_expiracao?: string
  tentativas_token?: number
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
    prestador?: PrestadorRecord
    contrato_mestre?: ContratoMestreRecord
    emitido_por?: UserRecord
  }
}

// Projeções isoladas para o Portal do Prestador
export interface PortalOsRecord {
  id: string
  os_id: string
  prestador_email: string
  prestador_id?: string
  codigo_projeto: string
  numero_os: string
  disciplina?: string
  escopo_tecnico?: string
  entregaveis_resumo?: string
  prazo_dias?: number
  data_inicio?: string
  data_previsao_fim?: string
  status: string
  valor_os?: number
  token_assinatura?: string
  created: string
  updated: string
}

export interface PortalEntregavelRecord {
  id: string
  os_id: string
  prestador_email: string
  codigo_projeto: string
  nome: string
  descricao?: string
  status?: string
  versao?: string
  prazo_entrega?: string
  arquivo?: string
  created: string
  updated: string
}

export interface PortalDocumentoRecord {
  id: string
  os_id: string
  prestador_email: string
  codigo_projeto: string
  titulo: string
  categoria?: string
  arquivo?: string
  created: string
  updated: string
}

// =============================================================================
// RODADA 6: CANAL DE COMUNICAÇÃO, VERSIONAMENTO E NOTIFICAÇÕES POR OS
// =============================================================================

export type AutorTipoMensagem = 'interno' | 'prestador' | 'sistema'

export interface MensagemOsRecord {
  id: string
  os: string
  autor_tipo: AutorTipoMensagem
  autor_usuario?: string
  autor_nome: string
  autor_email?: string
  texto: string
  anexo?: string
  anexo_nome_original?: string
  anexo_tamanho?: number
  lida_por_prestador?: boolean
  lida_por_interno?: boolean
  data_leitura_prestador?: string
  data_leitura_interno?: string
  created: string
  updated: string
  expand?: {
    os?: OrdemServicoRecord
    autor_usuario?: UserRecord
  }
}

export interface EntregavelComentarioRecord {
  id: string
  versao: string
  autor_tipo: AutorTipoMensagem
  autor_usuario?: string
  autor_nome: string
  autor_email?: string
  texto: string
  created: string
  updated: string
  expand?: {
    versao?: EntregavelVersaoRecord
    autor_usuario?: UserRecord
  }
}

export type TipoNotificacao =
  | 'mensagem_os'
  | 'versao_submetida'
  | 'versao_avaliada'
  | 'comentario_versao'
  | 'sistema'

export interface NotificacaoRecord {
  id: string
  destinatario_tipo: 'interno' | 'prestador'
  destinatario_usuario?: string
  destinatario_email?: string
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  referencia_tipo?: string
  referencia_id?: string
  lida: boolean
  data_leitura?: string
  email_enviado?: boolean
  created: string
  updated: string
  expand?: {
    destinatario_usuario?: UserRecord
  }
}

export interface ResumoMetadadosVersao {
  id: string
  numero_versao: number
  arquivo_nome: string
  tem_arquivo: boolean
  enviado_em: string
  autor_nome: string
  autor_email?: string
  status: string
  motivo_devolucao?: string
  observacoes?: string
  avaliador_nome?: string
  avaliado_em?: string
  total_comentarios: number
  comentarios: Array<{
    id: string
    autor_tipo: string
    autor_nome: string
    texto: string
    created: string
  }>
}

export interface ComparacaoOQueMudouResponse {
  entregavel_id: string
  titulo_entregavel: string
  versao_atual: number | null
  versao_anterior: number | null
  tem_versao_anterior: boolean
  arquivo_alterado: boolean
  autor_mudou: boolean
  status_mudou: boolean
  novos_comentarios_na_atual: number
  atual: ResumoMetadadosVersao | null
  anterior: ResumoMetadadosVersao | null
}

export interface ContadoresMensagensNaoLidasResponse {
  sucesso: boolean
  total_geral: number
  por_os: Record<string, number>
}

// =============================================================================
// RODADA 7 — MONITORAMENTO E COBRANÇA AUTOMÁTICA DE PRAZOS
// =============================================================================

export type DegrauCobranca = 'd_menos_3' | 'd_zero' | 'd_mais_1' | 'd_mais_3' | 'revisor_sla'

export type DestinatarioTipoCobranca = 'prestador' | 'revisor_interno' | 'gestor'

export interface EventoCobrancaRecord {
  id: string
  referencia_tipo: 'ordens_servico' | 'entregaveis'
  referencia_id: string
  ordem_servico?: string
  entregavel?: string
  degrau: DegrauCobranca
  dias_configurados?: number
  destinatario_tipo: DestinatarioTipoCobranca
  destinatario_usuario?: string
  destinatario_prestador?: string
  destinatario_email?: string
  destinatario_nome?: string
  destinatario_telefone?: string
  status: 'processado' | 'pendente' | 'falha'
  email_enviado: boolean
  notificacao_enviada: boolean
  whatsapp_url?: string
  mensagem_texto: string
  detalhes_auditoria?: any
  chave_idempotencia: string
  created: string
  updated: string
  expand?: {
    ordem_servico?: OrdemServicoRecord
    entregavel?: EntregavelRecord
    destinatario_usuario?: UserRecord
    destinatario_prestador?: PrestadorRecord
  }
}

export interface ItemAtencaoResumo {
  tipo: 'os_escalonada' | 'revisao_estagnada'
  id: string
  numero?: string
  nome?: string
  disciplina?: string
  prestador_nome?: string
  prestador_telefone?: string
  dias_atraso?: number
  horas_em_revisao?: number
  sla_horas?: number
  prazo_previsto?: string
}

export interface ResumoDiarioGestorRecord {
  id: string
  data_referencia: string
  total_os_monitoradas: number
  total_os_atrasadas: number
  total_entregaveis_atrasados: number
  total_revisoes_estagnadas: number
  total_escalonamentos: number
  itens_atencao_json: ItemAtencaoResumo[]
  gerado_em: string
  lido_por_gestor: boolean
  created: string
  updated: string
}

export interface ExecutarMonitoramentoResponse {
  sucesso: boolean
  data_referencia: string
  total_os_monitoradas: number
  total_os_atrasadas: number
  total_entregaveis_atrasados: number
  total_revisoes_estagnadas: number
  total_escalonamentos: number
  novos_eventos_criados: number
  origem: string
}

export interface ObterWhatsAppLinkResponse {
  os_id: string
  numero: string
  prestador_nome: string
  prestador_telefone: string
  prazo_previsto: string
  mensagem_texto: string
  whatsapp_url: string
}
