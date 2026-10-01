import pb from '@/lib/pocketbase/client'
import { AuditLogRecord } from '@/types'

export interface AuditLogFilters {
  userEmail?: string
  acao?: string
  entidade?: string
  dataInicio?: string
  dataFim?: string
}

export const auditService = {
  async list(page = 1, perPage = 25, filters?: AuditLogFilters) {
    const filterClauses: string[] = []

    if (filters?.userEmail?.trim()) {
      filterClauses.push(`user_email ~ '${filters.userEmail.trim()}'`)
    }
    if (filters?.acao && filters.acao !== 'todas') {
      filterClauses.push(`acao = '${filters.acao}'`)
    }
    if (filters?.entidade && filters.entidade !== 'todas') {
      filterClauses.push(`entidade = '${filters.entidade}'`)
    }
    if (filters?.dataInicio) {
      filterClauses.push(`created >= '${filters.dataInicio} 00:00:00'`)
    }
    if (filters?.dataFim) {
      filterClauses.push(`created <= '${filters.dataFim} 23:59:59'`)
    }

    const filterString = filterClauses.join(' && ')

    return await pb.collection('audit_logs').getList<AuditLogRecord>(page, perPage, {
      sort: '-created',
      filter: filterString,
      expand: 'user',
    })
  },
}
