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
  email?: string
  telefone?: string
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
