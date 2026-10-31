import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateBr(dateString?: string | Date | null): string {
  if (!dateString) return '-'
  try {
    const date =
      typeof dateString === 'string'
        ? parseISO(dateString)
        : dateString instanceof Date
          ? dateString
          : new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return format(date, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '-'
  }
}

export function formatDateTimeBr(dateString?: string | Date | null): string {
  if (!dateString) return '-'
  try {
    const date =
      typeof dateString === 'string'
        ? parseISO(dateString)
        : dateString instanceof Date
          ? dateString
          : new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return '-'
  }
}

/**
 * Retorna contagem relativa de prazo em relação a hoje:
 * Ex: "em 12 dias", "hoje", "amanhã", "atrasado há 3 dias", "ontem"
 */
export function formatPrazoRelativo(
  dateString?: string | Date | null,
  dataBase: Date = new Date(),
): { texto: string; dias: number; atrasado: boolean; hoje: boolean } {
  if (!dateString) {
    return { texto: 'Sem prazo', dias: 0, atrasado: false, hoje: false }
  }

  try {
    const dataAlvo =
      typeof dateString === 'string'
        ? parseISO(dateString)
        : dateString instanceof Date
          ? dateString
          : new Date(dateString)

    if (isNaN(dataAlvo.getTime())) {
      return { texto: 'Sem prazo', dias: 0, atrasado: false, hoje: false }
    }

    const dRef = new Date(dataBase)
    dRef.setHours(0, 0, 0, 0)
    const dAlvo = new Date(dataAlvo)
    dAlvo.setHours(0, 0, 0, 0)

    const diffMs = dAlvo.getTime() - dRef.getTime()
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDias === 0) {
      return { texto: 'vence hoje', dias: 0, atrasado: false, hoje: true }
    } else if (diffDias === 1) {
      return { texto: 'amanhã', dias: 1, atrasado: false, hoje: false }
    } else if (diffDias > 1) {
      return { texto: `em ${diffDias} dias`, dias: diffDias, atrasado: false, hoje: false }
    } else if (diffDias === -1) {
      return { texto: 'atrasado há 1 dia', dias: -1, atrasado: true, hoje: false }
    } else {
      return {
        texto: `atrasado há ${Math.abs(diffDias)} dias`,
        dias: diffDias,
        atrasado: true,
        hoje: false,
      }
    }
  } catch {
    return { texto: 'Sem prazo', dias: 0, atrasado: false, hoje: false }
  }
}

/**
 * Normaliza textos de condições de pagamento que sofreram duplicação acidental
 * ex: "50% (50% (cinquenta por cento) na assinatura..." -> "50% (cinquenta por cento) na assinatura..."
 */
export function normalizarCondicoesPagamento(texto?: string | null): string {
  if (!texto) return ''
  let resultado = String(texto)
  // Colapsa padrões repetidos como "NN% (NN% (" ou "NN% ( NN% (" -> "NN% ("
  // Tratando também múltiplas repetições caso existam
  const regex = /(\b\d{1,3}(?:[.,]\d+)?\s*%\s*\()\s*\1+/gi
  while (regex.test(resultado)) {
    resultado = resultado.replace(regex, '$1')
  }
  // Colapsa também caso o percentual interno seja diferente mas com a mesma estrutura "NN% (MM% (" -> "NN% (" se NN == MM
  resultado = resultado.replace(/(\b\d{1,3}(?:[.,]\d+)?\s*%)\s*\(\s*\1\s*\(/gi, '$1 (')
  return resultado
}

export function formatCurrencyBr(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatarMoeda = formatCurrencyBr

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
