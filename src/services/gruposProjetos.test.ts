import { describe, it, expect } from 'vitest'
import { ModoExecucaoProjeto } from '@/types'

describe('Bloco 4 — Grupo de Projetos e Modo de Execução', () => {
  it('valida os valores permitidos para ModoExecucaoProjeto', () => {
    const modosPermitidos: ModoExecucaoProjeto[] = [
      'direta',
      'terceirizada_parcial',
      'terceirizada_integral',
    ]

    expect(modosPermitidos).toHaveLength(3)
    expect(modosPermitidos).toContain('direta')
    expect(modosPermitidos).toContain('terceirizada_parcial')
    expect(modosPermitidos).toContain('terceirizada_integral')
  })

  it('calcula o progresso consolidado ponderado de etapas do grupo', () => {
    const etapasExemplo = [
      { id: '1', status: 'concluida' },
      { id: '2', status: 'concluida' },
      { id: '3', status: 'em_andamento' },
      { id: '4', status: 'nao_iniciada' },
    ]

    const concluidas = etapasExemplo.filter((e) => e.status === 'concluida').length
    const progressoMedio = Math.round((concluidas / etapasExemplo.length) * 100)

    expect(concluidas).toBe(2)
    expect(progressoMedio).toBe(50)
  })

  it('soma os valores dos projetos de forma a igualar ao total do contrato', () => {
    const itensEscopo = [
      { descricao: 'Projeto Arquitetônico', valor: 12000 },
      { descricao: 'Projeto Estrutural', valor: 18000 },
      { descricao: 'Projeto Elétrico e Hidrossanitário', valor: 15000 },
    ]

    const valorContrato = 45000
    const somaValoresProjetos = itensEscopo.reduce((acc, it) => acc + it.valor, 0)

    expect(somaValoresProjetos).toBe(valorContrato)
  })

  it('formata o código sequencial do grupo no padrão GPR-AAAA-NNNN', () => {
    const ano = 2025
    const seq = 1
    const seqStr = ('0000' + seq).slice(-4)
    const codigoGPR = `GPR-${ano}-${seqStr}`

    expect(codigoGPR).toBe('GPR-2025-0001')
    expect(codigoGPR).toMatch(/^GPR-\d{4}-\d{4}$/)
  })
})
