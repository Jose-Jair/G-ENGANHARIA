import pb from '@/lib/pocketbase/client'
import { CotacaoRecord, ItemRankingCotacao, RankingCotacoesPacoteResponse } from '@/types'

export interface RespostaCotacaoPortalPayload {
  preco_ofertado: number
  prazo_ofertado: string
  observacoes?: string
}

export interface EscolherCotacaoResponse {
  sucesso: boolean
  mensagem: string
  os_id: string
  numero_os: string
  valor_os: number
  status_os: string
}

export const cotacaoAutomaticaService = {
  /**
   * Lista cotações atribuídas ao prestador autenticado
   * O RLS no PocketBase isola automaticamente onde prestador.email = @request.auth.email
   */
  async listMinhasCotacoes(): Promise<CotacaoRecord[]> {
    return await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      sort: '-created',
      expand: 'projeto,pacote,etapa',
    })
  },

  /**
   * Lista cotações do pacote de trabalho
   */
  async listByPacote(pacoteId: string): Promise<CotacaoRecord[]> {
    return await pb.collection('cotacoes').getFullList<CotacaoRecord>({
      filter: `pacote = '${pacoteId}' || etapa = '${pacoteId}'`,
      sort: '-created',
      expand: 'prestador,executor,pacote,projeto',
    })
  },

  /**
   * Resposta do prestador autenticado pelo Portal do Prestador
   * Regras de API garantem que só lê/escreve a própria cotação.
   */
  async responderCotacaoPortal(
    cotacaoId: string,
    payload: RespostaCotacaoPortalPayload,
  ): Promise<{ sucesso: boolean; mensagem: string; cotacao_id: string; status: string }> {
    return await pb.send<{
      sucesso: boolean
      mensagem: string
      cotacao_id: string
      status: string
    }>(`/backend/v1/portal-prestador/cotacoes/${cotacaoId}/responder`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Ranking consolidado das propostas de um pacote de trabalho no servidor (Admin/Gestor)
   */
  async obterRankingPacote(pacoteId: string): Promise<RankingCotacoesPacoteResponse> {
    return await pb.send<RankingCotacoesPacoteResponse>(
      `/backend/v1/cotacoes/pacote/${pacoteId}/ranking`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Escolha do Gestor (um clique) -> Gera OS externa sob o Contrato-Mestre
   * respeitando a trava do teto do valor vendido no servidor.
   */
  async escolherPropostaGerarOS(cotacaoId: string): Promise<EscolherCotacaoResponse> {
    return await pb.send<EscolherCotacaoResponse>(`/backend/v1/cotacoes/${cotacaoId}/escolher`, {
      method: 'POST',
    })
  },
}
