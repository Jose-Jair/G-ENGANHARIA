// =============================================================================
// GESTÃO G+ — SERVIÇO DE NOTIFICAÇÕES (CENTRAL + SINALIZAÇÕES)
// Coleção: notificacoes
// =============================================================================

import pb from '@/lib/pocketbase/client'
import type { NotificacaoRecord } from '@/types'

export interface NotificacoesFiltros {
  apenasNaoLidas?: boolean
  tipo?: string
}

export const notificacoesService = {
  /**
   * Listar notificações do usuário autenticado (interno ou prestador via RLS).
   */
  async listarMinhas(filtros?: NotificacoesFiltros): Promise<NotificacaoRecord[]> {
    const filters: string[] = []
    if (filtros?.apenasNaoLidas) {
      filters.push('lida = false')
    }
    if (filtros?.tipo) {
      filters.push(`tipo = "${filtros.tipo}"`)
    }

    return pb.collection('notificacoes').getFullList<NotificacaoRecord>({
      filter: filters.length > 0 ? filters.join(' && ') : '',
      sort: '-created',
    })
  },

  /**
   * Obter contagem de notificações não lidas.
   */
  async contarNaoLidas(): Promise<number> {
    const list = await pb.collection('notificacoes').getList<NotificacaoRecord>(1, 1, {
      filter: 'lida = false',
    })
    return list.totalItems
  },

  /**
   * Marcar uma notificação específica como lida.
   */
  async marcarComoLida(notificacaoId: string): Promise<NotificacaoRecord> {
    return pb.collection('notificacoes').update<NotificacaoRecord>(notificacaoId, {
      lida: true,
      data_leitura: new Date().toISOString(),
    })
  },

  /**
   * Marcar todas as notificações não lidas do usuário como lidas.
   */
  async marcarTodasComoLidas(): Promise<number> {
    const naoLidas = await pb.collection('notificacoes').getFullList<NotificacaoRecord>({
      filter: 'lida = false',
      fields: 'id',
    })

    const agora = new Date().toISOString()
    let count = 0
    for (const item of naoLidas) {
      try {
        await pb.collection('notificacoes').update(item.id, {
          lida: true,
          data_leitura: agora,
        })
        count++
      } catch {
        /* intentionally ignored */
      }
    }

    return count
  },
}
