import { describe, it, expect } from 'vitest'
import { formatPhoneBr, cleanPhoneForWa, isValidPhoneBr, isValidEmail } from './cnpj'

describe('Validação e Formatação de Telefone Brasileiro', () => {
  it('formata telefone celular sem DDI', () => {
    expect(formatPhoneBr('11987654321', false)).toBe('(11) 98765-4321')
  })

  it('formata telefone celular com DDI +55', () => {
    expect(formatPhoneBr('11987654321', true)).toBe('+55 (11) 98765-4321')
    expect(formatPhoneBr('5511987654321', true)).toBe('+55 (11) 98765-4321')
    expect(formatPhoneBr('+55 11 98765-4321', true)).toBe('+55 (11) 98765-4321')
  })

  it('não repete o número 5 durante a digitação progressiva', () => {
    // Digitando DDD 88 com 5 no início do número
    expect(formatPhoneBr('885', false)).toBe('(88) 5')
    expect(formatPhoneBr('+55 (88) 5', true)).toBe('+55 (88) 5')
    expect(formatPhoneBr('+55 (88) 55', true)).toBe('+55 (88) 55')
    expect(formatPhoneBr('+55 (88) 555', true)).toBe('+55 (88) 555')
    // Digitando celular com DDD 55 (RS)
    expect(formatPhoneBr('55', false)).toBe('(55')
    expect(formatPhoneBr('+55 (55) 9', true)).toBe('+55 (55) 9')
    expect(formatPhoneBr('+55 (55) 99999-5555', true)).toBe('+55 (55) 99999-5555')
  })

  it('formata telefone fixo com e sem DDI', () => {
    expect(formatPhoneBr('1133334444', false)).toBe('(11) 3333-4444')
    expect(formatPhoneBr('1133334444', true)).toBe('+55 (11) 3333-4444')
  })

  it('normaliza para wa.me com DDI 55 e apenas dígitos', () => {
    expect(cleanPhoneForWa('+55 (11) 98765-4321')).toBe('5511987654321')
    expect(cleanPhoneForWa('(11) 98765-4321')).toBe('5511987654321')
    expect(cleanPhoneForWa('5588999441685')).toBe('5588999441685')
    expect(cleanPhoneForWa('88999441685')).toBe('5588999441685')
  })

  it('valida telefone celular e fixo válidos', () => {
    expect(isValidPhoneBr('11987654321')).toBe(true)
    expect(isValidPhoneBr('(11) 98765-4321')).toBe(true)
    expect(isValidPhoneBr('+55 (11) 98765-4321')).toBe(true)
    expect(isValidPhoneBr('+55 (88) 99944-1685')).toBe(true)
    expect(isValidPhoneBr('(11) 3333-4444')).toBe(true)
  })

  it('rejeita telefones com DDD inválido, tamanho incorreto ou repetidos', () => {
    expect(isValidPhoneBr('')).toBe(false)
    expect(isValidPhoneBr('123')).toBe(false)
    expect(isValidPhoneBr('00987654321')).toBe(false) // DDD 00 inválido
    expect(isValidPhoneBr('11111111111')).toBe(false) // repetidos
    expect(isValidPhoneBr('(11) 78765-4321')).toBe(false) // celular iniciando com 7
  })
})

describe('Validação de E-mail', () => {
  it('aceita e-mails válidos', () => {
    expect(isValidEmail('cliente@empresa.com.br')).toBe(true)
    expect(isValidEmail('josejair_ufca@outlook.com')).toBe(true)
    expect(isValidEmail('contato.diretoria@sub.dominio.eng.br')).toBe(true)
  })

  it('rejeita e-mails inválidos ou vazios', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('cliente@')).toBe(false)
    expect(isValidEmail('cliente@empresa')).toBe(false)
    expect(isValidEmail('cliente @empresa.com')).toBe(false)
    expect(isValidEmail('cliente@.com')).toBe(false)
  })
})
