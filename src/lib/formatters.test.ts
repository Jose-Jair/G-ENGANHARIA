import { describe, it, expect } from 'vitest'
import {
  formatPrazoRelativo,
  normalizarCondicoesPagamento,
  normalizarObjetoProposta,
} from './formatters'

describe('normalizarObjetoProposta', () => {
  it('substitui literal "Empreendimento" pelo nome real do empreendimento com aspas retas', () => {
    const texto =
      'Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para a elaboração de Modelagem BIM destinados ao empreendimento "Empreendimento" em Fortaleza-CE.'
    const res = normalizarObjetoProposta(texto, 'Residencial Teste Final V185')
    expect(res).toContain('"Residencial Teste Final V185"')
    expect(res).not.toContain('"Empreendimento"')
    expect(res).not.toContain('empreendimento "Empreendimento"')
  })

  it('substitui aspas curvas “Empreendimento” ou ”Empreendimento”', () => {
    const texto = 'Serviços destinados ao empreendimento “Empreendimento” em São Paulo.'
    const res = normalizarObjetoProposta(texto, 'Residencial Teste Final V185')
    expect(res).toBe(
      'Serviços destinados ao empreendimento "Residencial Teste Final V185" em São Paulo.',
    )
  })

  it('quando empreendimento for vazio, remove o trecho e nunca exibe literal', () => {
    const texto =
      'Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para a elaboração de Modelagem BIM destinados ao empreendimento "Empreendimento" em Fortaleza-CE.'
    const res = normalizarObjetoProposta(texto, '')
    expect(res).not.toContain('Empreendimento')
    expect(res).toBe(
      'Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para a elaboração de Modelagem BIM em Fortaleza-CE.',
    )
  })

  it('quando empreendimento for o próprio literal "Empreendimento", trata como vazio e remove o trecho', () => {
    const texto = 'Serviços destinados ao empreendimento "Empreendimento".'
    const res = normalizarObjetoProposta(texto, 'Empreendimento')
    expect(res).not.toContain('Empreendimento')
  })

  it('retorna vazio se texto for nulo ou indefinido', () => {
    expect(normalizarObjetoProposta(null, 'Residencial Teste')).toBe('')
    expect(normalizarObjetoProposta(undefined, 'Residencial Teste')).toBe('')
  })
})

describe('normalizarCondicoesPagamento', () => {
  it('colapsa padrão duplicado NN% (NN% ( em NN% (', () => {
    const entrada =
      '50% (50% (cinquenta por cento) na assinatura do contrato/aceite); 50% (50% (cinquenta por cento) na entrega final dos projetos executivos)'
    const esperado =
      '50% (cinquenta por cento) na assinatura do contrato/aceite); 50% (cinquenta por cento) na entrega final dos projetos executivos)'
    expect(normalizarCondicoesPagamento(entrada)).toBe(esperado)
  })

  it('mantém texto que não tem duplicação', () => {
    const entrada = '50% (cinquenta por cento) na assinatura; 50% (cinquenta por cento) na entrega'
    expect(normalizarCondicoesPagamento(entrada)).toBe(entrada)
  })

  it('lida com entradas nulas ou vazias', () => {
    expect(normalizarCondicoesPagamento(null)).toBe('')
    expect(normalizarCondicoesPagamento(undefined)).toBe('')
    expect(normalizarCondicoesPagamento('')).toBe('')
  })
})

describe('formatPrazoRelativo', () => {
  const base = new Date('2026-10-10T12:00:00Z')

  it('retorna "Sem prazo" para valores nulos ou inválidos', () => {
    expect(formatPrazoRelativo(null).texto).toBe('Sem prazo')
    expect(formatPrazoRelativo(undefined).texto).toBe('Sem prazo')
    expect(formatPrazoRelativo('invalido').texto).toBe('Sem prazo')
  })

  it('identifica prazo futuro com contagem em dias', () => {
    const res = formatPrazoRelativo('2026-10-22T00:00:00Z', base)
    expect(res.texto).toBe('em 12 dias')
    expect(res.dias).toBe(12)
    expect(res.atrasado).toBe(false)
  })

  it('identifica prazo para amanhã', () => {
    const res = formatPrazoRelativo('2026-10-11T00:00:00Z', base)
    expect(res.texto).toBe('amanhã')
    expect(res.dias).toBe(1)
    expect(res.atrasado).toBe(false)
  })

  it('identifica prazo para hoje', () => {
    const res = formatPrazoRelativo('2026-10-10T00:00:00Z', base)
    expect(res.texto).toBe('vence hoje')
    expect(res.dias).toBe(0)
    expect(res.hoje).toBe(true)
    expect(res.atrasado).toBe(false)
  })

  it('identifica atraso de 1 dia', () => {
    const res = formatPrazoRelativo('2026-10-09T00:00:00Z', base)
    expect(res.texto).toBe('atrasado há 1 dia')
    expect(res.dias).toBe(-1)
    expect(res.atrasado).toBe(true)
  })

  it('identifica atraso de múltiplos dias', () => {
    const res = formatPrazoRelativo('2026-10-07T00:00:00Z', base)
    expect(res.texto).toBe('atrasado há 3 dias')
    expect(res.dias).toBe(-3)
    expect(res.atrasado).toBe(true)
  })
})
