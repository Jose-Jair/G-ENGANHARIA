import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateBr(dateString?: string | null): string {
  if (!dateString) return '-'
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return format(date, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatDateTimeBr(dateString?: string | null): string {
  if (!dateString) return '-'
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatCurrencyBr(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
