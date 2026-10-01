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

/**
 * Converte uma digitação monetária (ex: "1250000", "R$ 1.250.000,00" ou números em centavos/reais)
 * para o formato de máscara "R$ 1.250.000,00".
 * Trabalha com dígitos como centavos: digitando "1" -> "R$ 0,01", "125000" -> "R$ 1.250,00"
 */
export function formatCurrencyInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return formatCurrencyBr(num)
}

/**
 * Extrai o valor numérico (float em Reais) de uma string formatada em moeda
 */
export function parseCurrencyInput(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits, 10) / 100
}
