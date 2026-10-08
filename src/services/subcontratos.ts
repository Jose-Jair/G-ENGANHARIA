import pb from '@/lib/pocketbase/client'
import { SubcontratoRecord, ParcelaSubcontratoItem } from '@/types'

export interface ContratarExecutorPayload {
  projeto_id: string
  cotacao_id: string
  modo_execucao: 'terceirizada_parcial' | 'terceirizada_integral'
  descricao_delegada?: string
  condicoes_pagamento?: string
  parcelas?: ParcelaSubcontratoItem[]
}

export interface AssinarSubcontratoExecutorPayload {
  token_assinatura: string
  declaracao: boolean
  nome_assinante: string
  documento_assinante: string
}

export interface SubcontratoPublicoData {
  id: string
  numero: string
  status: string
  modo_execucao: 'terceirizada_parcial' | 'terceirizada_integral'
  descricao_escopo?: string
  descricao_delegada?: string
  valor_total: number
  prazo_dias?: number
  nota_prazo?: string
  clausulas_texto?: string
  condicoes_pagamento?: string
  parcelas_json?: ParcelaSubcontratoItem[]
  data_emissao?: string
  executor_nome_assinante?: string
  executor_documento_assinante?: string
  data_assinatura_executor?: string
  executor_hash?: string
  executor?: {
    id: string
    nome: string
    cpf_cnpj: string
    conselho: string
    numero_registro: string
    email: string
    telefone: string
  }
  projeto?: {
    id: string
    codigo: string
    nome: string
    descricao: string
    disciplinas: string
  }
  contrato_original?: {
    id: string
    numero: string
    objeto: string
    prazo_dias: number
    nota_prazo: string
  }
}

export const subcontratosService = {
  async listAll(): Promise<SubcontratoRecord[]> {
    return await pb.collection('subcontratos').getFullList<SubcontratoRecord>({
      sort: '-created',
      expand: 'projeto,executor,cotacao,emitido_por,grupo',
    })
  },

  async listByProjeto(projetoId: string): Promise<SubcontratoRecord[]> {
    return await pb.collection('subcontratos').getFullList<SubcontratoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
      expand: 'projeto,executor,cotacao,emitido_por,grupo',
    })
  },

  async listByGrupo(grupoId: string): Promise<SubcontratoRecord[]> {
    return await pb.collection('subcontratos').getFullList<SubcontratoRecord>({
      filter: `grupo = '${grupoId}'`,
      sort: '-created',
      expand: 'projeto,executor,cotacao,emitido_por',
    })
  },

  async getById(id: string): Promise<SubcontratoRecord> {
    return await pb.collection('subcontratos').getOne<SubcontratoRecord>(id, {
      expand: 'projeto,executor,cotacao,emitido_por,grupo,contrato_servico_origem',
    })
  },

  // Contratação do executor pelo gestor (chama endpoint REST seguro com auditoria e geração de contas)
  async contratarExecutor(payload: ContratarExecutorPayload): Promise<{
    success: boolean
    message: string
    subcontrato_id: string
    numero: string
    token_assinatura: string
    link_assinatura: string
  }> {
    return await pb.send('/backend/v1/projetos/contratar-executor', {
      method: 'POST',
      body: payload,
    })
  },

  // Consulta pública dos dados do subcontrato por token (sem login)
  async obterPorToken(token: string): Promise<SubcontratoPublicoData> {
    return await pb.send(`/backend/v1/subcontratos/obter-por-token/${token}`, {
      method: 'GET',
    })
  },

  // Assinatura digital pública pelo executor (sem login)
  async assinarExecutor(payload: AssinarSubcontratoExecutorPayload): Promise<{
    success: boolean
    message: string
    subcontrato_id: string
    numero: string
    hash: string
  }> {
    return await pb.send('/backend/v1/subcontratos/assinar-executor', {
      method: 'POST',
      body: payload,
    })
  },
}
