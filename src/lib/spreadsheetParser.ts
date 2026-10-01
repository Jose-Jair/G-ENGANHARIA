/**
 * Parser leve e robusto no navegador para CSV e planilhas tabulares
 * Suporta separador ";" (padrão Brasil/Excel) e "," além de valores entre aspas com quebras de linha
 */

export interface ParsedSheetData {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvText(content: string): ParsedSheetData {
  if (!content) return { headers: [], rows: [] }

  // Detectar separador provável (; ou , ou \t) na primeira linha não vazia
  const lines = content.split(/\r\n|\n|\r/)
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || ''

  let separator = ';'
  const countSemi = (firstNonEmpty.match(/;/g) || []).length
  const countComma = (firstNonEmpty.match(/,/g) || []).length
  const countTab = (firstNonEmpty.match(/\t/g) || []).length

  if (countTab > countSemi && countTab > countComma) {
    separator = '\t'
  } else if (countComma > countSemi) {
    separator = ','
  }

  // Parse com controle de aspas
  const parsedRows: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"'
        i++ // pula aspas escapadas
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === separator && !inQuotes) {
      currentRow.push(currentVal.trim())
      currentVal = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++ // consome \r\n
      }
      currentRow.push(currentVal.trim())
      currentVal = ''

      // Se linha não for totalmente vazia
      if (currentRow.some((c) => c.length > 0)) {
        parsedRows.push(currentRow)
      }
      currentRow = []
    } else {
      currentVal += char
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim())
    if (currentRow.some((c) => c.length > 0)) {
      parsedRows.push(currentRow)
    }
  }

  if (parsedRows.length === 0) return { headers: [], rows: [] }

  // Primeira linha como cabeçalhos
  const rawHeaders = parsedRows[0].map((h) => h.replace(/^["']|["']$/g, '').trim())
  // Evitar cabeçalhos vazios
  const headers = rawHeaders.map((h, idx) => h || `Coluna_${idx + 1}`)

  const rows: Record<string, string>[] = []
  for (let r = 1; r < parsedRows.length; r++) {
    const rowObj: Record<string, string> = {}
    const rData = parsedRows[r]
    headers.forEach((h, idx) => {
      rowObj[h] = rData[idx] ?? ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Leitor genérico de arquivos:
 * - Se CSV ou TXT: lê como texto e roda o parseCsvText
 * - Se XLSX ou XLS: carrega dinamicamente a biblioteca xlsx se disponível ou faz a extração de strings
 */
export async function readFileToSheetData(file: File): Promise<ParsedSheetData> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    return parseCsvText(text)
  }

  // Se for XLSX, tentar importar pacote dinâmico ou CDN
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      // Tentar usar window.XLSX se injetado ou carregar via CDN dinâmico
      let XLSX: any = (window as any).XLSX
      if (!XLSX) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
          script.onload = () => {
            XLSX = (window as any).XLSX
            resolve()
          }
          script.onerror = () => reject(new Error('Falha ao carregar motor XLSX'))
          document.head.appendChild(script)
        })
      }

      if (XLSX) {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' })
        return parseCsvText(csvContent)
      }
    } catch (e) {
      console.warn('Erro ao processar arquivo XLSX:', e)
      throw new Error(
        'Não foi possível processar o arquivo XLSX diretamente. Salve o arquivo como CSV (separador ponto-e-vírgula ";") e tente novamente.',
      )
    }
  }

  // Fallback para texto
  const text = await file.text()
  return parseCsvText(text)
}
