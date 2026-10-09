import { StatusEtapa } from '@/types'

/**
 * Normaliza uma data em formato ISO / Date / YYYY-MM-DD para meia-noite (00:00:00).
 */
export function parseDateOnly(val?: string | Date | null): Date | null {
  if (!val) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const d = new Date(val)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const s = String(val).trim()
  if (!s) return null
  // Extrai YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const year = parseInt(m[1], 10)
    const month = parseInt(m[2], 10) - 1
    const day = parseInt(m[3], 10)
    return new Date(year, month, day, 0, 0, 0, 0)
  }
  const parsed = new Date(s)
  if (isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

/**
 * Retorna string YYYY-MM-DD
 */
export function formatToYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Adiciona dias a uma data
 */
export function addDays(d: Date, days: number): Date {
  const res = new Date(d)
  res.setDate(res.getDate() + days)
  return res
}

/**
 * Diferença em dias inteiros entre d2 e d1 (d2 - d1)
 */
export function diffDays(d1: Date, d2: Date): number {
  const t1 = d1.getTime()
  const t2 = d2.getTime()
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
}

/**
 * Percentual de progresso estimado com base no status da etapa
 */
export function getProgressoPorStatus(status?: StatusEtapa): number {
  switch (status) {
    case 'concluida':
      return 100
    case 'revisao':
      return 85
    case 'em_andamento':
      return 50
    case 'cotacao':
      return 25
    case 'a_iniciar':
    default:
      return 0
  }
}

/**
 * Cores e badges por status da etapa
 */
export interface StatusGanttStyle {
  barClass: string
  progressClass: string
  borderClass: string
  label: string
}

export function getStatusGanttStyle(
  status: StatusEtapa | undefined,
  isAtrasada: boolean,
  isUltrapassaPrazoProjeto: boolean,
): StatusGanttStyle {
  if (isUltrapassaPrazoProjeto || isAtrasada) {
    return {
      barClass: 'bg-rose-100 border-rose-300 text-rose-900',
      progressClass: 'bg-rose-500',
      borderClass: 'border-rose-400',
      label: isUltrapassaPrazoProjeto ? 'Estouro de Prazo do Projeto' : 'Atrasada',
    }
  }

  switch (status) {
    case 'concluida':
      return {
        barClass: 'bg-emerald-100 border-emerald-300 text-emerald-900',
        progressClass: 'bg-emerald-600',
        borderClass: 'border-emerald-400',
        label: 'Concluída',
      }
    case 'em_andamento':
      return {
        barClass: 'bg-blue-100 border-blue-300 text-blue-900',
        progressClass: 'bg-blue-600',
        borderClass: 'border-blue-400',
        label: 'Em Andamento',
      }
    case 'revisao':
      return {
        barClass: 'bg-amber-100 border-amber-300 text-amber-900',
        progressClass: 'bg-amber-500',
        borderClass: 'border-amber-400',
        label: 'Em Revisão',
      }
    case 'cotacao':
      return {
        barClass: 'bg-indigo-100 border-indigo-300 text-indigo-900',
        progressClass: 'bg-indigo-500',
        borderClass: 'border-indigo-400',
        label: 'Em Cotação',
      }
    case 'cancelada':
      return {
        barClass: 'bg-slate-200 border-slate-300 text-slate-500',
        progressClass: 'bg-slate-400',
        borderClass: 'border-slate-300',
        label: 'Cancelada',
      }
    case 'a_iniciar':
    default:
      return {
        barClass: 'bg-slate-100 border-slate-300 text-slate-800',
        progressClass: 'bg-slate-400',
        borderClass: 'border-slate-300',
        label: 'Planejada / A Iniciar',
      }
  }
}
