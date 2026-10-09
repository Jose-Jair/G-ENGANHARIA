import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatToYmd,
  addDays,
  diffDays,
  getProgressoPorStatus,
  getStatusGanttStyle,
} from './ganttUtils'
import { StatusEtapa } from '@/types'

describe('Cronograma Gantt - Utilitários de Datas e Posicionamento', () => {
  it('parseDateOnly converte corretamente ISO e strings YYYY-MM-DD', () => {
    const d1 = parseDateOnly('2026-04-10T12:30:00.000Z')
    expect(d1).not.toBeNull()
    expect(d1?.getFullYear()).toBe(2026)
    expect(d1?.getMonth()).toBe(3) // 0-indexed: abril
    expect(d1?.getDate()).toBe(10)

    const d2 = parseDateOnly('2026-05-20')
    expect(d2).not.toBeNull()
    expect(d2?.getFullYear()).toBe(2026)
    expect(d2?.getMonth()).toBe(4) // maio
    expect(d2?.getDate()).toBe(20)

    expect(parseDateOnly(null)).toBeNull()
    expect(parseDateOnly('')).toBeNull()
  })

  it('formatToYmd gera data no formato padrão YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 15)
    expect(formatToYmd(d)).toBe('2026-04-15')
  })

  it('addDays e diffDays calculam deslocamento e duração em dias', () => {
    const start = new Date(2026, 3, 1)
    const end = addDays(start, 14)
    expect(end.getDate()).toBe(15)
    expect(diffDays(start, end)).toBe(14)
  })

  it('calcula progresso proporcional por status da etapa', () => {
    expect(getProgressoPorStatus('concluida')).toBe(100)
    expect(getProgressoPorStatus('revisao')).toBe(85)
    expect(getProgressoPorStatus('em_andamento')).toBe(50)
    expect(getProgressoPorStatus('cotacao')).toBe(25)
    expect(getProgressoPorStatus('a_iniciar')).toBe(0)
  })

  it('aplica cores corretas por status e alerta em vermelho para estouro/atraso', () => {
    // Normal em andamento
    const styleNormal = getStatusGanttStyle('em_andamento', false, false)
    expect(styleNormal.barClass).toContain('bg-blue-100')
    expect(styleNormal.progressClass).toContain('bg-blue-600')

    // Concluída
    const styleConcluida = getStatusGanttStyle('concluida', false, false)
    expect(styleConcluida.barClass).toContain('bg-emerald-100')

    // Atrasada
    const styleAtrasada = getStatusGanttStyle('em_andamento', true, false)
    expect(styleAtrasada.barClass).toContain('bg-rose-100')
    expect(styleAtrasada.progressClass).toContain('bg-rose-500')
    expect(styleAtrasada.label).toBe('Atrasada')

    // Estouro do prazo final do projeto (alerta vermelho)
    const styleEstouro = getStatusGanttStyle('a_iniciar', false, true)
    expect(styleEstouro.barClass).toContain('bg-rose-100')
    expect(styleEstouro.label).toContain('Estouro')
  })

  it('valida posicionamento e dependência sequencial entre 3+ etapas', () => {
    const etapasFicticias = [
      {
        id: '1',
        nome: 'Topografia e Sondagem',
        ordem: 1,
        data_inicio: '2026-04-01',
        prazo: '2026-04-10',
      },
      {
        id: '2',
        nome: 'Projeto Arquitetônico',
        ordem: 2,
        data_inicio: '2026-04-11',
        prazo: '2026-04-25',
      },
      {
        id: '3',
        nome: 'Estrutural e Fundações',
        ordem: 3,
        data_inicio: '2026-04-26',
        prazo: '2026-05-15',
      },
    ]

    const d1Ini = parseDateOnly(etapasFicticias[0].data_inicio)!
    const d1Fim = parseDateOnly(etapasFicticias[0].prazo)!
    const d2Ini = parseDateOnly(etapasFicticias[1].data_inicio)!
    const d3Fim = parseDateOnly(etapasFicticias[2].prazo)!

    expect(d2Ini.getTime()).toBeGreaterThan(d1Fim.getTime())
    expect(diffDays(d1Ini, d3Fim)).toBe(44)
  })
})
