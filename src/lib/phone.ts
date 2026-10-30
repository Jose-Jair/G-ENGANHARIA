/**
 * Módulo único e canônico de telefonia brasileira — GESTÃO G+
 * Padrão canônico: E.164 (+55DDNNNNNNNNN para celular, +55DDNNNNNNNN para fixo)
 * Máscara APENAS para exibição / digitação progressiva.
 * wa.me montado estritamente com dígitos.
 */

export const DDDS_BRASILEIROS_VALIDOS = new Set<number>([
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19, // SP
  21,
  22,
  24, // RJ
  27,
  28, // ES
  31,
  32,
  33,
  34,
  35,
  37,
  38, // MG
  41,
  42,
  43,
  44,
  45,
  46, // PR
  47,
  48,
  49, // SC
  51,
  53,
  54,
  55, // RS (atenção especial a DDDs iniciados em 5)
  61, // DF
  62,
  64, // GO
  63, // TO
  65,
  66, // MT
  67, // MS
  68, // AC
  69, // RO
  71,
  73,
  74,
  75,
  77, // BA
  79, // SE
  81,
  87, // PE
  82, // AL
  83, // PB
  84, // RN
  85,
  88, // CE
  86,
  89, // PI
  91,
  93,
  94, // PA
  92,
  97, // AM
  95, // RR
  96, // AP
  98,
  99, // MA
])

export interface PhoneParseResult {
  digitsOnly: string
  nationalDigits: string // 10 ou 11 dígitos (sem 55)
  ddd: string
  number: string
  isMobile: boolean
  isValid: boolean
  canonicalE164: string // ex: +5511999999999
  display: string // ex: +55 (11) 99999-9999
  displayWithoutDdi: string // ex: (11) 99999-9999
  waNumber: string // ex: 5511999999999
}

/**
 * Remove formatações não-numéricas.
 */
export function extractDigits(value: string | undefined | null): string {
  if (!value) return ''
  return String(value).replace(/\D/g, '')
}

/**
 * Extrai os dígitos nacionais (10 ou 11 dígitos, descartando DDI 55 se presente).
 * Trata com cuidado números onde o DDD começa com 5 (ex: DDD 51, 53, 54, 55 do RS).
 * Um número de celular do RS tem 11 dígitos: 51987654321.
 * Se vier com 55 na frente: 5551987654321 (13 dígitos).
 */
export function getNationalDigits(value: string | undefined | null): string {
  const digits = extractDigits(value)
  if (!digits) return ''

  // Se tem 12 ou 13 dígitos e começa com 55, é DDI 55 + nacional
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }

  // Se tiver mais de 13 dígitos e começar com 55, corta o 55
  if (digits.startsWith('55') && digits.length > 13) {
    return digits.slice(2, 13)
  }

  // Se tiver até 11 dígitos, já são os dígitos nacionais
  return digits.slice(0, 11)
}

/**
 * Validação rigorosa de número brasileiro:
 * - DDD oficial válido (Set de DDDs da Anatel)
 * - 10 dígitos (fixo, iniciado por 2, 3, 4 ou 5) ou 11 dígitos (celular com 9º dígito = 9)
 * - Não pode ser repetição de um mesmo dígito (ex: 11111111111)
 */
export function isValidPhone(value: string | undefined | null): boolean {
  if (!value) return false
  const national = getNationalDigits(value)

  if (national.length !== 10 && national.length !== 11) {
    return false
  }

  // Rejeita sequências repetidas
  if (/^(\d)\1+$/.test(national)) {
    return false
  }

  const dddNum = parseInt(national.slice(0, 2), 10)
  if (!DDDS_BRASILEIROS_VALIDOS.has(dddNum)) {
    return false
  }

  const firstNumDigit = national.charAt(2)

  // Celular (11 dígitos): nono dígito DEVE ser 9
  if (national.length === 11) {
    if (firstNumDigit !== '9') return false
  }

  // Fixo (10 dígitos): primeiro dígito do número deve ser 2, 3, 4 ou 5
  if (national.length === 10) {
    if (!['2', '3', '4', '5'].includes(firstNumDigit)) return false
  }

  return true
}

/**
 * Retorna se o número é de celular (11 dígitos nacionais com nono dígito 9).
 */
export function isMobilePhone(value: string | undefined | null): boolean {
  const national = getNationalDigits(value)
  return national.length === 11 && national.charAt(2) === '9'
}

/**
 * Converte qualquer entrada para a forma canônica E.164: +55DDNNNNNNNNN
 * Se for inválido ou vazio, retorna string vazia.
 */
export function toCanonicalPhone(value: string | undefined | null): string {
  if (!value) return ''
  const national = getNationalDigits(value)
  if (!isValidPhone(national)) return ''
  return `+55${national}`
}

/**
 * Formatação para exibição:
 * Com DDI: +55 (11) 98765-4321 ou +55 (11) 3456-7890
 * Sem DDI: (11) 98765-4321 ou (11) 3456-7890
 */
export function formatPhoneDisplay(
  value: string | undefined | null,
  includeDdi: boolean = true,
): string {
  if (!value) return ''
  const national = getNationalDigits(value)
  if (!national) return ''

  let formatted = ''
  if (national.length <= 2) {
    formatted = `(${national}`
  } else if (national.length <= 6) {
    formatted = `(${national.slice(0, 2)}) ${national.slice(2)}`
  } else if (national.length <= 10) {
    // Fixo ou celular incompleto de 10 dígitos: (XX) XXXX-XXXX
    formatted = `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`
  } else {
    // Celular 11 dígitos: (XX) XXXXX-XXXX
    formatted = `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7, 11)}`
  }

  if (includeDdi && formatted) {
    return `+55 ${formatted}`
  }
  return formatted
}

/**
 * Formatação progressiva para inputs de formulário.
 * Aceita o usuário digitando número a número, colando com ou sem +55, com ou sem parênteses.
 * Garante prefixo visual amigável sem quebrar quando DDD começa com 5.
 */
export function formatPhoneProgressive(input: string): string {
  if (!input) return ''
  const str = input.trim()

  // Se o usuário apagar até ficar vazio ou apenas '+', '+5', '+55', limpa
  const digits = extractDigits(str)
  if (!digits) return ''

  // Se o usuário digitou ou colou começando com 55 e tiver mais de 2 dígitos,
  // mas atenção: se tiver 2 dígitos '51' ou '55', pode ser o próprio DDD!
  let national = digits
  if (str.startsWith('+55') || str.startsWith('+55 ') || str.startsWith('55 ')) {
    if (digits.startsWith('55') && digits.length > 2) {
      national = digits.slice(2)
    }
  } else if (digits.startsWith('55') && digits.length >= 12) {
    national = digits.slice(2)
  }

  // Limita a 11 dígitos nacionais
  if (national.length > 11) {
    national = national.slice(0, 11)
  }

  return formatPhoneDisplay(national, true)
}

/**
 * Gera apenas os dígitos para link do WhatsApp (ex: 5511999999999).
 * Garante que tem DDI 55 e não contém espaços nem símbolos.
 */
export function getWaDigitsOnly(value: string | undefined | null): string {
  if (!value) return ''
  const national = getNationalDigits(value)
  if (!national) return ''
  return `55${national}`
}

/**
 * Constrói o link oficial wa.me estritamente com dígitos e mensagem codificada.
 */
export function buildWaMeUrl(value: string | undefined | null, text?: string): string {
  const digits = getWaDigitsOnly(value)
  if (!digits) return ''
  const query = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${query}`
}

/**
 * Parser completo do telefone retornando todos os formatos úteis.
 */
export function parsePhone(value: string | undefined | null): PhoneParseResult {
  const digits = extractDigits(value)
  const national = getNationalDigits(value)
  const ddd = national.slice(0, 2)
  const num = national.slice(2)
  const valid = isValidPhone(national)
  const isMobile = isMobilePhone(national)
  const canonical = valid ? `+55${national}` : ''
  const display = formatPhoneDisplay(national, true)
  const displayWithoutDdi = formatPhoneDisplay(national, false)
  const waNumber = national ? `55${national}` : ''

  return {
    digitsOnly: digits,
    nationalDigits: national,
    ddd,
    number: num,
    isMobile,
    isValid: valid,
    canonicalE164: canonical,
    display,
    displayWithoutDdi,
    waNumber,
  }
}
