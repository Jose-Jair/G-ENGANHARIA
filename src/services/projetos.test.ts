import { describe, it, expect } from 'vitest'
import { buildProjetosFilter, ProjetoFiltrosServidor } from './projetos'

describe('Filtros no Servidor — Módulo de Projetos (buildProjetosFilter)', () => {
  it('retorna string vazia quando nenhum filtro for especificado', () => {
    expect(buildProjetosFilter()).toBe('')
    expect(buildProjetosFilter({})).toBe('')
  })

  it('monta filtro de busca textual livre (código, título, cliente)', () => {
    const filtros: ProjetoFiltrosServidor = { busca: 'PRJ-2026' }
    const res = buildProjetosFilter(filtros)

    expect(res).toContain("codigo ~ 'PRJ-2026'")
    expect(res).toContain("nome ~ 'PRJ-2026'")
    expect(res).toContain("empresa.razao_social ~ 'PRJ-2026'")
    expect(res).toContain("cliente_pf.nome ~ 'PRJ-2026'")
  })

  it('escapa caracteres especiais de aspas e barras na busca', () => {
    const filtros: ProjetoFiltrosServidor = { busca: "O'Reilly & Co" }
    const res = buildProjetosFilter(filtros)
    expect(res).toContain("O\\'Reilly & Co")
  })

  it('monta filtro por status e ignora quando status for "todos"', () => {
    expect(buildProjetosFilter({ status: 'todos' })).toBe('')
    expect(buildProjetosFilter({ status: 'aguardando_definicao' })).toBe(
      "status = 'aguardando_definicao'",
    )
    expect(buildProjetosFilter({ status: 'em_andamento' })).toBe("status = 'em_andamento'")
  })

  it('monta filtro por saúde e ignora quando for "todos"', () => {
    expect(buildProjetosFilter({ saude: 'todos' })).toBe('')
    expect(buildProjetosFilter({ saude: 'verde' })).toBe("saude = 'verde'")
    expect(buildProjetosFilter({ saude: 'amarelo' })).toBe("saude = 'amarelo'")
    expect(buildProjetosFilter({ saude: 'vermelho' })).toBe("saude = 'vermelho'")
  })

  it('monta filtro por parceiro demandante (empresaId)', () => {
    expect(buildProjetosFilter({ empresaId: 'todas' })).toBe('')
    const res = buildProjetosFilter({ empresaId: 'emp123' })
    expect(res).toBe("(empresa = 'emp123' || proposta.empresa = 'emp123')")
  })

  it('monta filtro por disciplina', () => {
    expect(buildProjetosFilter({ disciplina: 'todas' })).toBe('')
    expect(buildProjetosFilter({ disciplina: 'Estrutura' })).toBe("disciplinas ~ 'Estrutura'")
  })

  it('monta filtro de intervalo de prazo (dataInicial e dataFinal)', () => {
    const res1 = buildProjetosFilter({ dataInicial: '2026-01-01' })
    expect(res1).toBe("prazo_final >= '2026-01-01 00:00:00.000Z'")

    const res2 = buildProjetosFilter({ dataFinal: '2026-12-31' })
    expect(res2).toBe("prazo_final <= '2026-12-31 23:59:59.999Z'")

    const res3 = buildProjetosFilter({
      dataInicial: '2026-01-01',
      dataFinal: '2026-12-31',
    })
    expect(res3).toBe(
      "prazo_final >= '2026-01-01 00:00:00.000Z' && prazo_final <= '2026-12-31 23:59:59.999Z'",
    )
  })

  it('combina múltiplos filtros corretamente com operador AND (&&)', () => {
    const filtros: ProjetoFiltrosServidor = {
      busca: 'Hospital',
      status: 'aguardando_definicao',
      saude: 'amarelo',
      disciplina: 'Instalações',
      dataInicial: '2026-05-01',
    }
    const res = buildProjetosFilter(filtros)

    expect(res).toContain("status = 'aguardando_definicao'")
    expect(res).toContain("saude = 'amarelo'")
    expect(res).toContain("disciplinas ~ 'Instalações'")
    expect(res).toContain("prazo_final >= '2026-05-01 00:00:00.000Z'")
    expect(res).toContain("nome ~ 'Hospital'")
    expect(res.split(' && ').length).toBe(5)
  })
})
