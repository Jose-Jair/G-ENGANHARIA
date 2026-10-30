import pb from '@/lib/pocketbase/client'
import {
  EventoCobrancaRecord,
  ResumoDiarioGestorRecord,
  ExecutarMonitoramentoResponse,
  ObterWhatsAppLinkResponse,
} from '@/types'

export const monitoramentoPrazosService = {
  /**
   * Lista eventos de cobrança registrados no servidor.
   * Admin/Gestor/Financeiro veem tudo. Prestador vê somente os seus.
   */
  async listarEventos(
    filtro?: string,
    sort = '-created',
    limit = 50,
  ): Promise<EventoCobrancaRecord[]> {
    return await pb.collection('eventos_cobranca').getFullList<EventoCobrancaRecord>({
      filter: filtro,
      sort,
      batch: limit,
      expand: 'ordem_servico,entregavel,destinatario_usuario,destinatario_prestador',
    })
  },

  /**
   * Lista eventos de uma Ordem de Serviço específica
   */
  async listarPorOs(osId: string): Promise<EventoCobrancaRecord[]> {
    return await pb.collection('eventos_cobranca').getFullList<EventoCobrancaRecord>({
      filter: `referencia_tipo = 'ordens_servico' && referencia_id = '${osId}'`,
      sort: '-created',
    })
  },

  /**
   * Obtém o Resumo Diário do Gestor mais recente via endpoint do backend
   */
  async obterResumoDiario(): Promise<{ resumo: ResumoDiarioGestorRecord | null }> {
    return await pb.send('/backend/v1/monitoramento/resumo-diario', {
      method: 'GET',
    })
  },

  /**
   * Dispara o monitoramento e cobrança sob demanda (Admin/Gestor)
   */
  async executarMonitoramento(): Promise<ExecutarMonitoramentoResponse> {
    return await pb.send('/backend/v1/monitoramento/executar', {
      method: 'POST',
    })
  },

  /**
   * Obtém o link wa.me pronto para contato com o prestador da OS
   */
  async obterWhatsAppLink(osId: string): Promise<ObterWhatsAppLinkResponse> {
    return await pb.send(`/backend/v1/ordens-servico/${osId}/whatsapp-link`, {
      method: 'GET',
    })
  },
}
