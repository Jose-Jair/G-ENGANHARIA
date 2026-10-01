import pb from '@/lib/pocketbase/client'

/**
 * Interface de coluna para exportação CSV compatível com Excel padrão Brasil.
 */
export interface CsvColumn<T = any> {
  header: string
  accessor: (item: T) => string | number | boolean | null | undefined
}

/**
 * Opções para execução de exportação com auditoria.
 */
export interface ExportCsvOptions<T = any> {
  filename: string
  tela: string
  descricao?: string
  filtros?: Record<string, any>
  isFinanceiro?: boolean
  columns: CsvColumn<T>[]
  data: T[]
}

/**
 * Escapa uma célula para CSV padrão Excel (BR, ponto-e-vírgula).
 * - Substitui aspas duplas por aspas duplas dobradas.
 * - Envolve com aspas caso contenha ponto-e-vírgula, quebra de linha ou aspas.
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  if (str.includes(';') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Converte um array de objetos em texto CSV compatível com Excel BR (separador ";").
 * Inclui o Byte Order Mark (BOM \uFEFF) para que o Microsoft Excel reconheça UTF-8 com acentuação correta.
 */
export function buildCsvContent<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(';')
  const rows = data.map((item) => {
    return columns.map((col) => escapeCsvCell(col.accessor(item))).join(';')
  })

  // \uFEFF força o Excel a interpretar UTF-8
  return '\uFEFF' + [headerLine, ...rows].join('\r\n')
}

/**
 * Dispara o download de um arquivo gerado no navegador.
 */
export function triggerFileDownload(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8;',
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Registra a auditoria da exportação no backend via rota autenticada.
 * Valida permissões estritas no servidor:
 * - Executor externo bloqueado
 * - Comercial não exporta financeiro
 */
export async function registrarAuditoriaExportacao(params: {
  tela: string
  formato: string
  totalLinhas: number
  filtros?: Record<string, any>
  descricao?: string
  isFinanceiro?: boolean
}): Promise<void> {
  await pb.send('/backend/v1/export/audit', {
    method: 'POST',
    body: {
      tela: params.tela,
      formato: params.formato || 'csv',
      total_linhas: params.totalLinhas,
      filtros: params.filtros || {},
      descricao: params.descricao || `Exportação de ${params.tela}`,
      is_financeiro: params.isFinanceiro === true,
    },
  })
}

/**
 * Executa a exportação CSV completa:
 * 1. Registra auditoria no servidor (com bloqueio por perfil).
 * 2. Constrói o arquivo com separador ';' e codificação Excel BR.
 * 3. Faz o download automático no cliente.
 */
export async function exportarParaCsv<T>(
  options: ExportCsvOptions<T>,
): Promise<{ totalLinhas: number }> {
  const { filename, tela, descricao, filtros, isFinanceiro, columns, data } = options

  // 1. Registra auditoria no backend (se o backend recusar por permissão, lança erro antes de baixar)
  await registrarAuditoriaExportacao({
    tela,
    formato: 'csv',
    totalLinhas: data.length,
    filtros,
    descricao,
    isFinanceiro,
  })

  // 2. Constrói e baixa CSV
  const csvText = buildCsvContent(columns, data)
  const fullFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  triggerFileDownload(csvText, fullFilename)

  return { totalLinhas: data.length }
}

export const exportService = {
  exportarParaCsv,
  buildCsvContent,
  triggerFileDownload,
  registrarAuditoriaExportacao,
}
