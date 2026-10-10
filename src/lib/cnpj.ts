/**
 * Utilitários para CNPJ brasileiro: formatação, sanitização e validação de dígitos verificadores
 */

export function cleanCnpj(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function formatCnpj(value: string | undefined | null): string {
  const clean = cleanCnpj(value)
  if (!clean) return ''
  if (clean.length <= 2) return clean
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`
  if (clean.length <= 12)
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`
}

/**
 * Validação dos dois dígitos verificadores do CNPJ (algoritmo Módulo 11 da Receita Federal)
 */
export function isValidCnpj(cnpj: string | undefined | null): boolean {
  const clean = cleanCnpj(cnpj)
  if (!clean || clean.length !== 14) return false

  // Rejeita sequências de números repetidos óbvias (ex: 00000000000000, 11111111111111)
  if (/^(\d)\1{13}$/.test(clean)) return false

  // Primeiro dígito verificador
  let soma = 0
  let peso = 5
  for (let i = 0; i < 12; i++) {
    soma += parseInt(clean.charAt(i), 10) * peso
    peso = peso === 2 ? 9 : peso - 1
  }
  let resto = soma % 11
  const dv1 = resto < 2 ? 0 : 11 - resto
  if (parseInt(clean.charAt(12), 10) !== dv1) return false

  // Segundo dígito verificador
  soma = 0
  peso = 6
  for (let i = 0; i < 13; i++) {
    soma += parseInt(clean.charAt(i), 10) * peso
    peso = peso === 2 ? 9 : peso - 1
  }
  resto = soma % 11
  const dv2 = resto < 2 ? 0 : 11 - resto
  if (parseInt(clean.charAt(13), 10) !== dv2) return false

  return true
}

/**
 * Formata um número de telefone brasileiro no formato padrão:
 * - Sem DDI: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * - Com DDI (includeDdi: true): +55 (XX) XXXXX-XXXX ou +55 (XX) XXXX-XXXX
 */
export function formatPhoneBr(
  value: string | undefined | null,
  includeDdi: boolean = false,
): string {
  if (!value) return ''
  const str = String(value).trim()
  let clean = str.replace(/\D/g, '')
  if (!clean) return ''

  // Se a string começar explicitamente com "+55" ou "55", remove o prefixo DDI 55
  if (str.startsWith('+55') && clean.startsWith('55')) {
    clean = clean.slice(2)
  } else if (clean.startsWith('55') && clean.length > 11) {
    // Caso venha número completo salvo tipo "5511987654321" (12 ou 13 dígitos)
    clean = clean.slice(2)
  }

  // Limitar aos 11 dígitos nacionais (DDD + até 9 dígitos)
  if (clean.length > 11) {
    clean = clean.slice(0, 11)
  }

  let formatted = ''
  if (clean.length === 0) {
    formatted = ''
  } else if (clean.length <= 2) {
    formatted = `(${clean}`
  } else if (clean.length <= 6) {
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`
  } else if (clean.length <= 10) {
    // 8 dígitos: (XX) XXXX-XXXX
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  } else {
    // 9 dígitos: (XX) XXXXX-XXXX
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`
  }

  if (includeDdi && formatted) {
    return `+55 ${formatted}`
  }
  return formatted
}

/**
 * Validação rigorosa de número de telefone brasileiro:
 * - Deve conter DDD válido (11 a 99)
 * - Deve ter 10 dígitos (fixo: 2-5 no primeiro dígito do número) ou 11 dígitos (celular: 9 no primeiro dígito do número)
 * - Aceita tanto com DDI 55 quanto sem DDI
 */
export function isValidPhoneBr(value: string | undefined | null): boolean {
  if (!value) return false
  let clean = value.replace(/\D/g, '')
  if (!clean) return false

  // Se tiver 12 ou 13 dígitos e começar com 55, extrai os 10 ou 11 dígitos sem DDI
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    clean = clean.slice(2)
  }

  if (clean.length !== 10 && clean.length !== 11) {
    return false
  }

  // DDDs válidos no Brasil (11 a 99 com exceções conhecidas de números inexistentes como 20, 23, etc.)
  const ddd = parseInt(clean.slice(0, 2), 10)
  const dddsValidos = new Set([
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
    44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
    79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  ])

  if (!dddsValidos.has(ddd)) {
    return false
  }

  // Rejeita sequências repetidas óbvias (ex: 11111111111, 0000000000)
  if (/^(\d)\1+$/.test(clean)) {
    return false
  }

  // Celular (11 dígitos): o nono dígito (primeiro após o DDD) deve ser 9
  if (clean.length === 11) {
    const primeiroDigito = clean.charAt(2)
    if (primeiroDigito !== '9') return false
  }

  // Fixo (10 dígitos): primeiro dígito costuma ser 2, 3, 4 ou 5
  if (clean.length === 10) {
    const primeiroDigito = clean.charAt(2)
    if (!['2', '3', '4', '5'].includes(primeiroDigito)) return false
  }

  return true
}

/**
 * Normaliza o telefone para o padrão wa.me e banco de dados: apenas dígitos com DDI 55.
 * Exemplo: "(11) 98765-4321" -> "5511987654321"
 * Exemplo: "+55 (88) 99944-1685" -> "5588999441685"
 */
export function cleanPhoneForWa(value: string | undefined | null): string {
  if (!value) return ''
  let clean = value.replace(/\D/g, '')
  if (!clean) return ''

  // Se já começa com 55 e possui 12 ou 13 dígitos
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean
  }
  // Se não tem DDI 55, adiciona caso tenha 10 ou 11 dígitos
  if (clean.length === 10 || clean.length === 11) {
    return '55' + clean
  }
  return clean
}

/**
 * Validação rigorosa de e-mail (RFC 5322 simplificada, rejeita espaços, requer domínio e TLD válidos)
 */
export function isValidEmail(value: string | undefined | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 254) return false

  // Regex estrita de e-mail com TLD de pelo menos 2 caracteres
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(trimmed)) return false

  // Domínio deve conter pelo menos um ponto e TLD de no mínimo 2 letras
  const parts = trimmed.split('@')
  if (parts.length !== 2) return false
  const domain = parts[1]
  const domainParts = domain.split('.')
  if (domainParts.length < 2) return false
  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) return false

  return true
}

/**
 * Utilitários para CPF brasileiro: formatação, sanitização e validação de dígitos verificadores
 */
export function cleanCpf(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

export function formatCpf(value: string | undefined | null): string {
  const clean = cleanCpf(value)
  if (!clean) return ''
  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
}

/**
 * Validação dos dois dígitos verificadores do CPF (algoritmo Módulo 11 da Receita Federal)
 */
export function isValidCpf(cpf: string | undefined | null): boolean {
  const clean = cleanCpf(cpf)
  if (!clean || clean.length !== 11) return false

  // Rejeita sequências de números repetidos óbvias (ex: 11111111111)
  if (/^(\d)\1{10}$/.test(clean)) return false

  // Primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(clean.charAt(i), 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(9), 10)) return false

  // Segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(clean.charAt(i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(10), 10)) return false

  return true
}
