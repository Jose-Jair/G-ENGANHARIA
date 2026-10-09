import { describe, it, expect } from 'vitest'
import { formatPrazoRelativo } from './formatters'

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
