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
