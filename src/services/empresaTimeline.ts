import pb from '@/lib/pocketbase/client'
import { AuditLogRecord } from '@/types'

export const empresaTimelineService = {
  /**
   * Busca registros de auditoria vinculados diretamente à empresa
   * ou às suas entidades filhas (contratos e contatos vinculados)
   */
  async getTimeline(
    empresaId: string,
    contratoIds: string[] = [],
    contatoIds: string[] = [],
  ): Promise<AuditLogRecord[]> {
    try {
      const idList = [empresaId, ...contratoIds, ...contatoIds].filter(Boolean)
      if (idList.length === 0) return []

      // Construir filtro PocketBase
      const idFilters = idList.map((id) => `registro_id = '${id}'`).join(' || ')

      const records = await pb.collection('audit_logs').getFullList<AuditLogRecord>({
        filter: idFilters,
        sort: '-created',
        expand: 'user',
      })

      return records
    } catch (err) {
      console.warn('Não foi possível carregar a timeline da empresa via audit_logs:', err)
      return []
    }
  },
}
