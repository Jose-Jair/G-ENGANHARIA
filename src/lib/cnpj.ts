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

export function formatPhoneBr(
  value: string | undefined | null,
  includeDdi: boolean = false,
): string {
  if (!value) return ''
  let clean = value.replace(/\D/g, '')
  if (!clean) return ''
  // Se começar com 55 (DDI Brasil) e tiver mais de 11 dígitos, remove para formatar DDD + número
  if (clean.length > 11 && clean.startsWith('55')) {
    clean = clean.slice(2)
  }

  let formatted = clean
  if (clean.length <= 2) {
    formatted = `(${clean}`
  } else if (clean.length <= 6) {
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`
  } else if (clean.length <= 10) {
    // 8 dígitos: (00) 0000-0000
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6, 10)}`
  } else {
    // 9 dígitos: (00) 00000-0000
    formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`
  }

  if (includeDdi) {
    return `+55 ${formatted}`
  }
  return formatted
}

export function cleanPhoneForWa(value: string | undefined | null): string {
  if (!value) return ''
  let clean = value.replace(/\D/g, '')
  if (!clean) return ''
  // Se não tem DDI 55, adiciona
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean
  }
  return clean
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
