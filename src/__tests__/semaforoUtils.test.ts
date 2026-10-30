import { describe, it, expect } from 'vitest'
import {
  calcularDiferencaDias,
  calcularHorasDecorridas,
  calcularSemaforoOs,
  calcularSemaforoEntregavel,
} from '@/components/monitoramento/semaforoUtils'
import { OrdemServicoRecord, EntregavelRecord } from '@/types'

describe('semaforoUtils - Monitoramento e Prazos', () => {
  describe('calcularDiferencaDias', () => {
    it('retorna null quando data não é fornecida', () => {
      expect(calcularDiferencaDias(null)).toBeNull()
      expect(calcularDiferencaDias('')).toBeNull()
    })

    it('calcula dias restantes positivos para datas no futuro', () => {
      const futuro = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      const diff = calcularDiferencaDias(futuro)
      expect(diff).toBeGreaterThanOrEqual(4)
      expect(diff).toBeLessThanOrEqual(6)
    })

    it('calcula dias negativos para datas no passado (atraso)', () => {
      const passado = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      const diff = calcularDiferencaDias(passado)
      expect(diff).toBeLessThanOrEqual(-3)
    })
  })

  describe('calcularSemaforoOs', () => {
    it('retorna "concluido" se a OS estiver com status concluida', () => {
      const os: Partial<OrdemServicoRecord> = {
        id: 'os_1',
        status: 'concluida',
        data_previsao_fim: '2026-01-01',
      }
      const res = calcularSemaforoOs(os as OrdemServicoRecord, false)
      expect(res.status).toBe('concluido')
    })

    it('retorna "aguardando_revisao" se houver entregável em revisão interna', () => {
      const os: Partial<OrdemServicoRecord> = {
        id: 'os_2',
        status: 'em_execucao',
        data_previsao_fim: new Date(Date.now() + 10 * 86400000).toISOString(),
      }
      const res = calcularSemaforoOs(os as OrdemServicoRecord, true)
      expect(res.status).toBe('aguardando_revisao')
    })

    it('retorna "atrasado" se data_previsao_fim já expirou', () => {
      const os: Partial<OrdemServicoRecord> = {
        id: 'os_3',
        status: 'em_execucao',
        data_previsao_fim: new Date(Date.now() - 3 * 86400000).toISOString(),
      }
      const res = calcularSemaforoOs(os as OrdemServicoRecord, false)
      expect(res.status).toBe('atrasado')
      expect(res.diasRestantes).toBeLessThan(0)
    })

    it('retorna "atencao" se data_previsao_fim está dentro de 3 dias', () => {
      const os: Partial<OrdemServicoRecord> = {
        id: 'os_4',
        status: 'em_execucao',
        data_previsao_fim: new Date(Date.now() + 2 * 86400000).toISOString(),
      }
      const res = calcularSemaforoOs(os as OrdemServicoRecord, false)
      expect(res.status).toBe('atencao')
    })

    it('retorna "no_prazo" se prazo está confortável (>3 dias)', () => {
      const os: Partial<OrdemServicoRecord> = {
        id: 'os_5',
        status: 'em_execucao',
        data_previsao_fim: new Date(Date.now() + 15 * 86400000).toISOString(),
      }
      const res = calcularSemaforoOs(os as OrdemServicoRecord, false)
      expect(res.status).toBe('no_prazo')
    })
  })

  describe('calcularSemaforoEntregavel', () => {
    it('retorna "concluido" para entregável com status aprovado', () => {
      const ent: Partial<EntregavelRecord> = {
        id: 'ent_1',
        status: 'aprovado',
      }
      const res = calcularSemaforoEntregavel(ent as EntregavelRecord)
      expect(res.status).toBe('concluido')
    })

    it('retorna "aguardando_revisao" com horas decorridas para status revisao_interna', () => {
      const dataCriacao = new Date(Date.now() - 10 * 3600 * 1000).toISOString()
      const ent: Partial<EntregavelRecord> = {
        id: 'ent_2',
        status: 'revisao_interna',
        updated: dataCriacao,
      }
      const res = calcularSemaforoEntregavel(ent as EntregavelRecord)
      expect(res.status).toBe('aguardando_revisao')
      expect(res.horasEmRevisao).toBeGreaterThanOrEqual(9)
    })

    it('retorna "atrasado" se prazo expirou e entregável não foi aprovado', () => {
      const ent: Partial<EntregavelRecord> = {
        id: 'ent_3',
        status: 'em_producao',
        prazo: new Date(Date.now() - 2 * 86400000).toISOString(),
      }
      const res = calcularSemaforoEntregavel(ent as EntregavelRecord)
      expect(res.status).toBe('atrasado')
      expect(res.diasRestantes).toBeLessThan(0)
    })
  })
})
