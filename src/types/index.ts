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
  created: string
  updated: string
  expand?: {
    empresa?: EmpresaRecord
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
    | 'aprovacao_interna'
    | 'enviada'
    | 'visualizada'
    | 'em_negociacao'
    | 'aceita'
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

export interface ProjetoRecord {
  id: string
  codigo: string
  nome?: string
  descricao?: string
  disciplinas?: string
  proposta?: string
  contrato?: string
  contrato_servico?: string
  empresa?: string
  cliente_pf?: string
  valor_total?: number
  prazo_final?: string
  subcontratacao_autorizada?: boolean
  anexo_autorizacao?: string
  saude?: SaudeProjeto
  justificativa_saude?: string
  status?: string
  created: string
  updated: string
  expand?: {
    proposta?: PropostaRecord
    contrato?: ContratoRecord
    contrato_servico?: ContratoServicoRecord
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
  numero_registro?: string
  conselho_validade?: string
  disciplinas?: string
  regiao?: string
  capacidade_simultanea?: number
  dados_bancarios?: string
  nda_contrato?: string
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
  created: string
  updated: string
  expand?: {
    projeto?: ProjetoRecord
    executor?: ExecutorRecord
    area?: AreaAtuacaoRecord
  }
}

export interface EntregavelRecord {
  id: string
  etapa: string
  nome: string
  descricao?: string
  versao?: string
  status: StatusEntregavel
  arquivo?: string
  data_aprovacao?: string
  observacoes_revisao?: string
  created: string
  updated: string
  expand?: {
    etapa?: ProjetoEtapaRecord
  }
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
  etapa: string
  executor: string
  escopo?: string
  prazo_resposta?: string
  data_limite?: string
  preco_ofertado?: number
  prazo_ofertado?: string
  observacoes?: string
  status?: StatusCotacao
  escolhida?: boolean
  token?: string
  data_resposta?: string
  created: string
  updated: string
  expand?: {
    etapa?: ProjetoEtapaRecord
    executor?: ExecutorRecord
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
  expand?: {
    projeto?: ProjetoRecord
    proposta?: PropostaRecord
    executor?: ExecutorRecord
    etapa?: ProjetoEtapaRecord
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
