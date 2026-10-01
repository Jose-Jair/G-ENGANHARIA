import { ContratoRecord, CurvaABC, PesosScoreCurva } from '@/types'

export interface ScoreCalculationResult {
  score: number // 0 a 100
  curva: CurvaABC
  totalValorAtivo: number
  qtdContratosAtivos: number
  mediaMesesVigencia: number
  aderenciaPercent: number
  detalhes: {
    pontosValor: number
    pontosVigencia: number
    pontosQtd: number
    pontosAderencia: number
  }
}

export const scoreCurvaService = {
  /**
   * Calcula o score da empresa e classifica na Curva A/B/C
   * Fatores:
   * 1. Valor total de contratos ativos
   * 2. Média de vigência restante dos contratos ativos
   * 3. Número de contratos ativos
   * 4. Aderência às disciplinas (CNAE de engenharia/infraestrutura vs serviços)
   */
  calcular(
    contratos: ContratoRecord[] = [],
    cnae?: string,
    pesos: PesosScoreCurva = {
      peso_valor: 40,
      peso_vigencia: 25,
      peso_qtd_contratos: 20,
      peso_aderencia_disciplinas: 15,
    },
    faixaCorteA = 5000000,
    faixaCorteB = 1000000,
  ): ScoreCalculationResult {
    const hoje = new Date()

    // Considera apenas contratos que não estejam com situação "Encerrado", "Cancelado" ou "Rescindido"
    const contratosAtivos = contratos.filter((c) => {
      const sit = (c.situacao || '').toLowerCase()
      if (sit.includes('encerr') || sit.includes('cancel') || sit.includes('rescind')) return false
      // Se tiver vigência fim no passado distante (> 30 dias), considera inativo
      if (c.vigencia_fim) {
        const fim = new Date(c.vigencia_fim)
        const diffDias = (fim.getTime() - hoje.getTime()) / (1000 * 3600 * 24)
        if (diffDias < -30) return false
      }
      return true
    })

    const totalValorAtivo = contratosAtivos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
    const qtdContratosAtivos = contratosAtivos.length

    // Média de meses restantes de vigência
    let somaMesesVigencia = 0
    let contagemVigencias = 0
    contratosAtivos.forEach((c) => {
      if (c.vigencia_fim) {
        const fim = new Date(c.vigencia_fim)
        const meses = Math.max(0, (fim.getTime() - hoje.getTime()) / (1000 * 3600 * 24 * 30.4))
        somaMesesVigencia += meses
        contagemVigencias++
      }
    })
    const mediaMesesVigencia = contagemVigencias > 0 ? somaMesesVigencia / contagemVigencias : 0

    // Aderência CNAE: se CNAE contém divisões típicas de obras e engenharia (41, 42, 43, 71)
    let aderenciaScore = 50 // baseline
    if (cnae) {
      const clean = cnae.replace(/\D/g, '')
      if (
        clean.startsWith('42') || // Infraestrutura pesada (rodovias, ferrovias, redes)
        clean.startsWith('7112') // Serviços de engenharia consultiva
      ) {
        aderenciaScore = 100
      } else if (clean.startsWith('41') || clean.startsWith('43')) {
        // Edificações ou serviços especializados
        aderenciaScore = 80
      } else {
        aderenciaScore = 40
      }
    }

    // Normalização das notas parciais (0 a 100)
    // 1. Valor: se >= faixaCorteA (5M), nota 100. Se 1M, nota 70. Se < 100k, nota 20.
    let notaValor = 0
    if (totalValorAtivo >= faixaCorteA) {
      notaValor = 100
    } else if (totalValorAtivo >= faixaCorteB) {
      // Interpolação entre faixaCorteB e faixaCorteA (70 a 99)
      const ratio = (totalValorAtivo - faixaCorteB) / (faixaCorteA - faixaCorteB)
      notaValor = 70 + ratio * 29
    } else if (totalValorAtivo > 0) {
      // Interpolação até faixaCorteB (20 a 69)
      const ratio = Math.min(1, totalValorAtivo / faixaCorteB)
      notaValor = 20 + ratio * 49
    } else {
      notaValor = 10
    }

    // 2. Vigência: se média >= 24 meses -> 100; se 12 meses -> 80; se 6 meses -> 50; se < 3 -> 25
    let notaVigencia = 0
    if (mediaMesesVigencia >= 24) notaVigencia = 100
    else if (mediaMesesVigencia >= 12) notaVigencia = 80
    else if (mediaMesesVigencia >= 6) notaVigencia = 60
    else if (mediaMesesVigencia > 0) notaVigencia = 35
    else notaVigencia = 15

    // 3. Quantidade de contratos: 1 contrato -> 60, 2 contratos -> 85, 3 ou mais -> 100
    let notaQtd = 0
    if (qtdContratosAtivos >= 3) notaQtd = 100
    else if (qtdContratosAtivos === 2) notaQtd = 85
    else if (qtdContratosAtivos === 1) notaQtd = 65
    else notaQtd = 10

    // Cálculo ponderado
    const totalPesos =
      pesos.peso_valor +
        pesos.peso_vigencia +
        pesos.peso_qtd_contratos +
        pesos.peso_aderencia_disciplinas || 100

    const scoreFloat =
      (notaValor * pesos.peso_valor +
        notaVigencia * pesos.peso_vigencia +
        notaQtd * pesos.peso_qtd_contratos +
        aderenciaScore * pesos.peso_aderencia_disciplinas) /
      totalPesos

    const score = Math.min(100, Math.max(0, Math.round(scoreFloat)))

    // Curva A/B/C estipulada pelo valor total dos contratos (conforme regra de negócio principal)
    let curva: CurvaABC = 'C'
    if (totalValorAtivo >= faixaCorteA) {
      curva = 'A'
    } else if (totalValorAtivo >= faixaCorteB) {
      curva = 'B'
    } else {
      curva = 'C'
    }

    return {
      score,
      curva,
      totalValorAtivo,
      qtdContratosAtivos,
      mediaMesesVigencia: Math.round(mediaMesesVigencia * 10) / 10,
      aderenciaPercent: aderenciaScore,
      detalhes: {
        pontosValor: Math.round(notaValor),
        pontosVigencia: Math.round(notaVigencia),
        pontosQtd: Math.round(notaQtd),
        pontosAderencia: Math.round(aderenciaScore),
      },
    }
  },
}
