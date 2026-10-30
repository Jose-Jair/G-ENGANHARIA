import { describe, it, expect } from 'vitest'
import {
  isValidPhone,
  isMobilePhone,
  toCanonicalPhone,
  formatPhoneDisplay,
  formatPhoneProgressive,
  getWaDigitsOnly,
  buildWaMeUrl,
  parsePhone,
  getNationalDigits,
} from './phone'

describe('Módulo Único de Telefonia (src/lib/phone.ts)', () => {
  describe('Validação de DDD e Regras Oficiais Anatel', () => {
    it('aceita celulares válidos com 9º dígito em SP (DDD 11)', () => {
      expect(isValidPhone('11987654321')).toBe(true)
      expect(isValidPhone('+5511987654321')).toBe(true)
      expect(isValidPhone('+55 (11) 98765-4321')).toBe(true)
    })

    it('aceita celulares em DDD iniciado por 5 (RS - DDD 51 e 55)', () => {
      // DDD 51 Porto Alegre
      expect(isValidPhone('51999887766')).toBe(true)
      expect(isValidPhone('+5551999887766')).toBe(true)
      expect(isValidPhone('5551999887766')).toBe(true)

      // DDD 55 Santa Maria
      expect(isValidPhone('55999887766')).toBe(true)
      expect(isValidPhone('+5555999887766')).toBe(true)
      expect(isValidPhone('5555999887766')).toBe(true)
    })

    it('aceita telefones fixos (10 dígitos, iniciados por 2, 3, 4 ou 5)', () => {
      expect(isValidPhone('1134567890')).toBe(true)
      expect(isValidPhone('2122334455')).toBe(true)
      expect(isValidPhone('3133445566')).toBe(true)
      expect(isValidPhone('5132114455')).toBe(true)
      expect(isMobilePhone('1134567890')).toBe(false)
    })

    it('rejeita DDDs inexistentes no Brasil (ex: 20, 23, 25, 26, 29, 36, 39, 00)', () => {
      expect(isValidPhone('20987654321')).toBe(false)
      expect(isValidPhone('23987654321')).toBe(false)
      expect(isValidPhone('00987654321')).toBe(false)
      expect(isValidPhone('29987654321')).toBe(false)
    })

    it('rejeita celulares sem o 9º dígito (ex: celular de 11 dígitos iniciado por 8 ou 7 após DDD)', () => {
      // 11 dígitos com 8 na frente não é celular nem fixo
      expect(isValidPhone('11887654321')).toBe(false)
      expect(isValidPhone('21787654321')).toBe(false)
    })

    it('rejeita números com todos os dígitos iguais (sequências repetidas)', () => {
      expect(isValidPhone('11999999999')).toBe(false)
      expect(isValidPhone('11111111111')).toBe(false)
      expect(isValidPhone('00000000000')).toBe(false)
    })

    it('rejeita strings vazias ou nulas', () => {
      expect(isValidPhone('')).toBe(false)
      expect(isValidPhone(null)).toBe(false)
      expect(isValidPhone(undefined)).toBe(false)
      expect(isValidPhone('abc')).toBe(false)
    })
  })

  describe('Formato Canônico E.164 (+55DDNNNNNNNNN)', () => {
    it('converte entradas variadas para o padrão E.164 canônico', () => {
      expect(toCanonicalPhone('11987654321')).toBe('+5511987654321')
      expect(toCanonicalPhone('+55 (11) 98765-4321')).toBe('+5511987654321')
      expect(toCanonicalPhone('5511987654321')).toBe('+5511987654321')
      expect(toCanonicalPhone('+5511987654321')).toBe('+5511987654321')
      expect(toCanonicalPhone('(88) 99944-1685')).toBe('+5588999441685')
      expect(toCanonicalPhone('+55 88 99944-1685')).toBe('+5588999441685')
      expect(toCanonicalPhone('(51) 3211-4455')).toBe('+555132114455')
    })

    it('retorna vazio quando o número é inválido', () => {
      expect(toCanonicalPhone('12345')).toBe('')
      expect(toCanonicalPhone('99999999999')).toBe('')
    })
  })

  describe('Digitação Progressiva e Formatação de Exibição', () => {
    it('formata progressivamente durante a digitação', () => {
      expect(formatPhoneProgressive('1')).toBe('+55 (1')
      expect(formatPhoneProgressive('11')).toBe('+55 (11')
      expect(formatPhoneProgressive('119')).toBe('+55 (11) 9')
      expect(formatPhoneProgressive('119876')).toBe('+55 (11) 9876')
      expect(formatPhoneProgressive('1198765432')).toBe('+55 (11) 9876-5432')
      expect(formatPhoneProgressive('11987654321')).toBe('+55 (11) 98765-4321')
    })

    it('suporta colagem com prefixo +55 já existente', () => {
      expect(formatPhoneProgressive('+55 11 98765-4321')).toBe('+55 (11) 98765-4321')
      expect(formatPhoneProgressive('+5511987654321')).toBe('+55 (11) 98765-4321')
    })

    it('formata exibição com ou sem DDI', () => {
      expect(formatPhoneDisplay('11987654321', true)).toBe('+55 (11) 98765-4321')
      expect(formatPhoneDisplay('11987654321', false)).toBe('(11) 98765-4321')
      expect(formatPhoneDisplay('1134567890', true)).toBe('+55 (11) 3456-7890')
    })

    it('lida corretamente com números do RS iniciados em 55', () => {
      const national = getNationalDigits('55999887766')
      expect(national).toBe('55999887766')
      expect(formatPhoneDisplay(national, true)).toBe('+55 (55) 99988-7766')

      // Quando vier com DDI completo (13 dígitos)
      const nationalComDdi = getNationalDigits('5555999887766')
      expect(nationalComDdi).toBe('55999887766')
      expect(formatPhoneDisplay(nationalComDdi, true)).toBe('+55 (55) 99988-7766')
    })
  })

  describe('Montagem do wa.me estritamente com dígitos', () => {
    it('extrai dígitos do WhatsApp com DDI 55 sem símbolos nem espaços', () => {
      expect(getWaDigitsOnly('+55 (11) 98765-4321')).toBe('5511987654321')
      expect(getWaDigitsOnly('11987654321')).toBe('5511987654321')
      expect(getWaDigitsOnly('+5511987654321')).toBe('5511987654321')
      expect(getWaDigitsOnly('+55 (88) 99944-1685')).toBe('5588999441685')
      expect(getWaDigitsOnly('+55 (51) 99988-7766')).toBe('5551999887766')
    })

    it('monta a URL wa.me com parâmetros de texto devidamente codificados', () => {
      const urlSemTexto = buildWaMeUrl('+55 (11) 98765-4321')
      expect(urlSemTexto).toBe('https://wa.me/5511987654321')

      const urlComTexto = buildWaMeUrl(
        '+55 (11) 98765-4321',
        'Olá! Segue sua proposta: https://exemplo.com/p/123',
      )
      expect(urlComTexto).toBe(
        'https://wa.me/5511987654321?text=Ol%C3%A1!%20Segue%20sua%20proposta%3A%20https%3A%2F%2Fexemplo.com%2Fp%2F123',
      )
      // Garantir que não há caracteres não numéricos na parte do número de telefone
      const numberPart = urlComTexto.split('https://wa.me/')[1].split('?')[0]
      expect(/^\d+$/.test(numberPart)).toBe(true)
    })
  })

  describe('Parser Completo (parsePhone)', () => {
    it('decompõe o telefone em todas as propriedades úteis', () => {
      const parsed = parsePhone('+55 (88) 99944-1685')
      expect(parsed.isValid).toBe(true)
      expect(parsed.isMobile).toBe(true)
      expect(parsed.ddd).toBe('88')
      expect(parsed.number).toBe('999441685')
      expect(parsed.canonicalE164).toBe('+5588999441685')
      expect(parsed.display).toBe('+55 (88) 99944-1685')
      expect(parsed.displayWithoutDdi).toBe('(88) 99944-1685')
      expect(parsed.waNumber).toBe('5588999441685')
    })
  })
})
