// =============================================================================
// GESTÃO G+ — SERVIÇO DE IA DA OPERAÇÃO (RODADA 9)
// Cliente frontend para os endpoints backend /backend/v1/ia/*
// =============================================================================

import pb from '@/lib/pocketbase/client'

export interface IaEscopoPacoteRequest {
  disciplina: string
  proposta_texto?: string
  descricao_proposta?: string
  catalogo_escopo_id?: string
  pacote_id?: string
  projeto_codigo?: string
}

export interface IaEscopoPacoteResponse {
  sucesso: boolean
  recurso: string
  rascunho: {
    disciplina: string
    titulo_pacote: string
    escopo_detalhado: string
    entregaveis_sugeridos: Array<{
      titulo: string
      descricao: string
      formato?: string
      ordem?: number
    }>
    premissas_especificas?: string[]
    observacoes?: string
    raw_texto?: string
    parse_sucesso?: boolean
  }
}

export interface IaJustificativaPrestadorRequest {
  prestador_id: string
  disciplina?: string
  regiao?: string
}

export interface IaJustificativaPrestadorResponse {
  sucesso: boolean
  recurso: string
  rascunho: {
    prestador_nome: string
    nivel_recomendacao:
      | 'altamente_recomendado'
      | 'recomendado'
      | 'recomendado_com_ressalvas'
      | 'nao_recomendado'
    justificativa_texto: string
    pontos_fortes: string[]
    pontos_atencao: string[]
    resumo_indicadores: {
      disciplina: string
      capacidade_livre: number
      capacidade_maxima: number
      nota_media: number
      tendencia: string
    }
    raw_texto?: string
    parse_sucesso?: boolean
  }
}

export interface IaTextoCanalOsRequest {
  os_id: string
  finalidade?:
    | 'cobranca_preventiva'
    | 'cobranca_atraso'
    | 'resposta_prestador'
    | 'alinhamento_tecnico'
  contexto_extra?: string
}

export interface IaTextoCanalOsResponse {
  sucesso: boolean
  recurso: string
  rascunho: {
    finalidade: string
    destinatario_tipo: 'prestador' | 'interno'
    assunto_sugerido: string
    mensagem_texto: string
    aviso_confidencialidade_respeitado: boolean
    raw_texto?: string
    parse_sucesso?: boolean
  }
}

export interface IaResumoDiaResponse {
  sucesso: boolean
  recurso: string
  rascunho: {
    data_referencia: string
    status_geral_operacao: 'verde' | 'amarelo' | 'vermelho'
    titulo_resumo: string
    texto_corrido: string
    destaques_operacionais: string[]
    destaques_financeiros: string[]
    acoes_recomendadas: string[]
    raw_texto?: string
    parse_sucesso?: boolean
  }
}

export interface IaPreRevisaoEntregavelRequest {
  entregavel_id: string
  versao_id?: string
}

export interface IaPreRevisaoEntregavelResponse {
  sucesso: boolean
  recurso: string
  rascunho: {
    entregavel_titulo: string
    versao_avaliada: number
    resultado_pre_analise: 'apto_para_revisao_humana' | 'incompleto' | 'alerta_documental'
    pontuacao_conformidade_percentual: number
    itens_checklist: Array<{
      item: string
      obrigatorio: boolean
      status: 'conforme' | 'pendente' | 'nao_aplicavel'
      observacao?: string
    }>
    parecer_sintetico: string
    recomendacao_ao_revisor_humano: string
    raw_texto?: string
    parse_sucesso?: boolean
  }
}

export const iaOperacaoService = {
  /**
   * Gera rascunho de escopo técnico + entregáveis para um pacote de trabalho
   */
  async gerarEscopoPacote(dados: IaEscopoPacoteRequest): Promise<IaEscopoPacoteResponse> {
    return pb.send<IaEscopoPacoteResponse>('/backend/v1/ia/escopo-pacote', {
      method: 'POST',
      body: dados,
    })
  },

  /**
   * Gera justificativa técnica fundamentada para sugestão de prestador
   */
  async gerarJustificativaPrestador(
    dados: IaJustificativaPrestadorRequest,
  ): Promise<IaJustificativaPrestadorResponse> {
    return pb.send<IaJustificativaPrestadorResponse>('/backend/v1/ia/justificativa-prestador', {
      method: 'POST',
      body: dados,
    })
  },

  /**
   * Redige mensagem de cobrança ou resposta no canal da OS
   * (Regra dura: sem dados confidenciais de cliente/obra/valores)
   */
  async gerarTextoCanalOs(dados: IaTextoCanalOsRequest): Promise<IaTextoCanalOsResponse> {
    return pb.send<IaTextoCanalOsResponse>('/backend/v1/ia/texto-canal-os', {
      method: 'POST',
      body: dados,
    })
  },

  /**
   * Gera o Resumo Diário Executivo do Gestor
   */
  async gerarResumoDia(): Promise<IaResumoDiaResponse> {
    return pb.send<IaResumoDiaResponse>('/backend/v1/ia/resumo-dia', {
      method: 'POST',
    })
  },

  /**
   * Executa a pré-revisão de entregável (opcional, requer ia_pre_revisao ativada)
   */
  async preRevisarEntregavel(
    dados: IaPreRevisaoEntregavelRequest,
  ): Promise<IaPreRevisaoEntregavelResponse> {
    return pb.send<IaPreRevisaoEntregavelResponse>('/backend/v1/ia/pre-revisao-entregavel', {
      method: 'POST',
      body: dados,
    })
  },
}
