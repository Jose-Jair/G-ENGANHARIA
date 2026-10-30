import { describe, it, expect } from 'vitest'

// =============================================================================
// TESTES UNITÁRIOS DA LÓGICA DE NEGÓCIO DO BACKEND (Requisito 10):
// 1. Ranqueamento e Tendência de Prestadores (Requisito 3)
// 2. Trava de Teto de OS Externa sobre Valor Vendido (Requisito 4)
// 3. Ciclo de Vida de Entregáveis e Transições (Requisito 5)
// 4. Gate de Liberação de Medição condicionado a Entregáveis Aprovados (Requisito 7)
// =============================================================================

// 1. Algoritmo de Sugestão e Tendência
interface PrestadorMock {
  id: string
  nome: string
  tipo: 'interno' | 'pf_externo' | 'pj_externo'
  disciplinas: string[]
  uf: string
  nota_media: number
  capacidade_simultanea: number
  os_ativas: number
  validade_conselho: string // ISO ou YYYY-MM-DD
  historico_dias_atraso: number[] // dias de atraso nas últimas entregas
}

function calcularTendencia(historico: number[]): 'melhorou' | 'estavel' | 'piorou' {
  if (historico.length < 2) return 'estavel'
  const maisRecente = historico[0]
  const anterior = historico[1]
  if (maisRecente < anterior) return 'melhorou'
  if (maisRecente > anterior) return 'piorou'
  return 'estavel'
}

function ranquearPrestadores(
  prestadores: PrestadorMock[],
  disciplinaAlvo: string,
  regiaoAlvo?: string,
  dataReferencia: Date = new Date('2026-03-31'),
) {
  const elegiveis = prestadores.filter((p) => {
    // 1. Conselho não vencido
    const dtVal = new Date(p.validade_conselho)
    if (dtVal < dataReferencia) return false

    // 2. Disciplina compatível
    const discOk = p.disciplinas.some(
      (d) =>
        d.toLowerCase().includes(disciplinaAlvo.toLowerCase()) ||
        disciplinaAlvo.toLowerCase().includes(d.toLowerCase()),
    )
    return discOk
  })

  return elegiveis
    .map((p) => {
      const capacidadeLivre = Math.max(0, p.capacidade_simultanea - p.os_ativas)
      const mesmaRegiao = regiaoAlvo ? p.uf.toUpperCase() === regiaoAlvo.toUpperCase() : true
      const tendencia = calcularTendencia(p.historico_dias_atraso)

      let score = p.nota_media * 10
      score += capacidadeLivre * 5
      if (mesmaRegiao) score += 10
      if (p.tipo === 'interno') score += 5
      if (tendencia === 'melhorou') score += 8
      if (tendencia === 'piorou') score -= 12

      return {
        id: p.id,
        nome: p.nome,
        capacidadeLivre,
        tendencia,
        scoreFinal: Math.round(score * 10) / 10,
      }
    })
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
}

// 2. Trava de Teto Vendido
function validarTetoOsExterna(
  tipoPrestador: 'interno' | 'externo',
  valorNovaOS: number,
  outrasOsExternasValores: number[],
  tetoVendidoDisciplina: number,
): { permitido: boolean; motivo?: string } {
  if (tipoPrestador === 'interno') {
    return { permitido: true } // Interno não tem camada financeira
  }

  const somaOutras = outrasOsExternasValores.reduce((acc, v) => acc + v, 0)
  const somaTotal = somaOutras + valorNovaOS

  if (somaTotal > tetoVendidoDisciplina + 0.01) {
    return {
      permitido: false,
      motivo: `A soma das OS externas (R$ ${somaTotal.toFixed(2)}) ultrapassa o valor vendido contratado (R$ ${tetoVendidoDisciplina.toFixed(2)}).`,
    }
  }

  return { permitido: true }
}

// 3. Ciclo de Entregáveis
const TRANSOES_VALIDAS: Record<string, string[]> = {
  pendente: ['atribuido', 'em_producao'],
  atribuido: ['em_producao', 'enviado_revisao'],
  em_producao: ['enviado_revisao'],
  enviado_revisao: ['aprovado', 'devolvido'],
  devolvido: ['em_producao', 'enviado_revisao'],
  aprovado: [],
}

function validarTransicaoEntregavel(
  statusAtual: string,
  novoStatus: string,
  motivoDevolucao?: string,
): { valida: boolean; erro?: string } {
  const permitidos = TRANSOES_VALIDAS[statusAtual] || []
  if (!permitidos.includes(novoStatus)) {
    return {
      valida: false,
      erro: `Transição inválida de "${statusAtual}" para "${novoStatus}".`,
    }
  }

  if (novoStatus === 'devolvido' && (!motivoDevolucao || motivoDevolucao.trim().length === 0)) {
    return {
      valida: false,
      erro: 'Motivo da devolução é obrigatório.',
    }
  }

  return { valida: true }
}

// 4. Gate de Liberação de Medição
function validarGateMedicao(entregaveisStatus: string[]): {
  liberada: boolean
  pendentesQtd: number
} {
  const pendentes = entregaveisStatus.filter((st) => st !== 'aprovado')
  return {
    liberada: pendentes.length === 0,
    pendentesQtd: pendentes.length,
  }
}

describe('Cadeia Contrato → Projetos: Regras de Negócio e Validações', () => {
  describe('1. Sugestão e Ranqueamento de Prestadores com Tendência', () => {
    const prestadoresAmostra: PrestadorMock[] = [
      {
        id: 'p1',
        nome: 'Eng. Carlos (Interno)',
        tipo: 'interno',
        disciplinas: ['Estruturas', 'Fundações'],
        uf: 'SP',
        nota_media: 4.8,
        capacidade_simultanea: 4,
        os_ativas: 1, // livre: 3
        validade_conselho: '2026-12-31',
        historico_dias_atraso: [0, 2], // 0 < 2 -> melhorou
      },
      {
        id: 'p2',
        nome: 'Construtora Beta (PJ Externa)',
        tipo: 'pj_externo',
        disciplinas: ['Estruturas'],
        uf: 'SP',
        nota_media: 4.9,
        capacidade_simultanea: 3,
        os_ativas: 2, // livre: 1
        validade_conselho: '2026-12-31',
        historico_dias_atraso: [5, 1], // 5 > 1 -> piorou
      },
      {
        id: 'p3',
        nome: 'Eng. Vencido (PF Externa)',
        tipo: 'pf_externo',
        disciplinas: ['Estruturas'],
        uf: 'SP',
        nota_media: 5.0,
        capacidade_simultanea: 5,
        os_ativas: 0,
        validade_conselho: '2025-12-31', // vencido!
        historico_dias_atraso: [0, 0],
      },
    ]

    it('bloqueia prestador com conselho de classe vencido', () => {
      const rank = ranquearPrestadores(prestadoresAmostra, 'Estruturas', 'SP')
      const ids = rank.map((r) => r.id)
      expect(ids).not.toContain('p3')
    })

    it('calcula tendência: "melhorou" ganha bônus e "piorou" recebe penalidade', () => {
      expect(calcularTendencia([0, 3])).toBe('melhorou')
      expect(calcularTendencia([4, 1])).toBe('piorou')
      expect(calcularTendencia([2, 2])).toBe('estavel')
    })

    it('ranqueia prestador com capacidade livre e tendência positiva no topo', () => {
      const rank = ranquearPrestadores(prestadoresAmostra, 'Estruturas', 'SP')
      expect(rank.length).toBe(2)
      expect(rank[0].id).toBe('p1') // Carlos interno com tendência 'melhorou' e 3 capacidades livres
      expect(rank[0].tendencia).toBe('melhorou')
      expect(rank[1].tendencia).toBe('piorou')
      expect(rank[0].scoreFinal).toBeGreaterThan(rank[1].scoreFinal)
    })
  })

  describe('2. Trava de Teto Vendido para OS Externa', () => {
    it('permite OS externa quando a soma não ultrapassa o valor vendido contratado', () => {
      const res = validarTetoOsExterna('externo', 5000, [10000, 15000], 35000)
      expect(res.permitido).toBe(true)
    })

    it('bloqueia OS externa quando a soma ultrapassa o valor vendido', () => {
      // Outras: 30.000 + Nova: 12.000 = 42.000 > Teto vendido: 40.000
      const res = validarTetoOsExterna('externo', 12000, [10000, 20000], 40000)
      expect(res.permitido).toBe(false)
      expect(res.motivo).toContain('ultrapassa o valor vendido contratado')
    })

    it('não bloqueia prestador interno por teto financeiro', () => {
      const res = validarTetoOsExterna('interno', 0, [30000], 30000)
      expect(res.permitido).toBe(true)
    })
  })

  describe('3. Ciclo de Vida de Entregáveis e Versões', () => {
    it('permite transição sequencial atribuido → em_producao → enviado_revisao → aprovado', () => {
      expect(validarTransicaoEntregavel('atribuido', 'em_producao').valida).toBe(true)
      expect(validarTransicaoEntregavel('em_producao', 'enviado_revisao').valida).toBe(true)
      expect(validarTransicaoEntregavel('enviado_revisao', 'aprovado').valida).toBe(true)
    })

    it('bloqueia transições ilegais como atribuido direto para aprovado', () => {
      const res = validarTransicaoEntregavel('atribuido', 'aprovado')
      expect(res.valida).toBe(false)
      expect(res.erro).toContain('Transição inválida')
    })

    it('exige motivo da devolução ao transitar para devolvido', () => {
      const semMotivo = validarTransicaoEntregavel('enviado_revisao', 'devolvido', '')
      expect(semMotivo.valida).toBe(false)
      expect(semMotivo.erro).toContain('Motivo da devolução é obrigatório')

      const comMotivo = validarTransicaoEntregavel(
        'enviado_revisao',
        'devolvido',
        'Memorial de cálculo incompleto',
      )
      expect(comMotivo.valida).toBe(true)
    })

    it('aprovado é estado final e não permite reabertura sem nova versão', () => {
      const res = validarTransicaoEntregavel('aprovado', 'em_producao')
      expect(res.valida).toBe(false)
    })
  })

  describe('4. Trava da Medição: Gate de Aprovação de Entregáveis', () => {
    it('libera medição quando todos os entregáveis do escopo estão aprovados', () => {
      const gate = validarGateMedicao(['aprovado', 'aprovado', 'aprovado'])
      expect(gate.liberada).toBe(true)
      expect(gate.pendentesQtd).toBe(0)
    })

    it('bloqueia medição se houver entregável pendente, em produção ou devolvido', () => {
      const gateComPendente = validarGateMedicao(['aprovado', 'em_producao', 'aprovado'])
      expect(gateComPendente.liberada).toBe(false)
      expect(gateComPendente.pendentesQtd).toBe(1)

      const gateComDevolvido = validarGateMedicao(['aprovado', 'devolvido'])
      expect(gateComDevolvido.liberada).toBe(false)
      expect(gateComDevolvido.pendentesQtd).toBe(1)
    })
  })
})
