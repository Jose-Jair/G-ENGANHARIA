import pb from '@/lib/pocketbase/client'
import { AuditLogRecord } from '@/types'

export interface AuditLogFilters {
  userEmail?: string
  usuario?: string
  acao?: string
  entidade?: string
  dataInicio?: string
  dataFim?: string
}

export const auditService = {
  async list(page: number = 1, perPage: number = 50, filters?: AuditLogFilters) {
    const filterClauses: string[] = []

    if (filters?.usuario) {
      filterClauses.push(`usuario = "${filters.usuario}"`)
    }
    if (filters?.entidade) {
      filterClauses.push(`entidade = "${filters.entidade}"`)
    }
    if (filters?.acao) {
      filterClauses.push(`acao = "${filters.acao}"`)
    }
    if (filters?.dataInicio) {
      filterClauses.push(`created >= "${filters.dataInicio}"`)
    }
    if (filters?.dataFim) {
      filterClauses.push(`created <= "${filters.dataFim} 23:59:59"`)
    }

    const filter = filterClauses.join(' && ')

    return pb.collection('audit_logs').getList<AuditLogRecord>(page, perPage, {
      filter: filter || undefined,
      sort: '-created',
      expand: 'usuario',
    })
  },

  async log(data: {
    action: string
    entity_type?: string
    entity_id?: string
    details?: Record<string, any>
  }) {
    try {
      // 100% no servidor via endpoint /backend/v1/auditoria/registrar com privilégio de sistema ($app.save)
      return await pb.send('/backend/v1/auditoria/registrar', {
        method: 'POST',
        body: {
          acao: data.action,
          entidade: data.entity_type || 'sistema',
          registro_id: data.entity_id || '',
          detalhes: data.details || {},
          user_id: pb.authStore.record?.id || pb.authStore.model?.id,
          user_email: pb.authStore.record?.email || (pb.authStore.model as any)?.email,
        },
      })
    } catch (err) {
      console.warn('Falha ao gravar log de auditoria no servidor:', err)
      return null
    }
  },
}
