import { ContratoRecord, CurvaABC } from '@/types'

export interface MetricasContratoAtivo {
  totalValorAtivo: number
  qtdContratosAtivos: number
  mediaMesesVigencia: number
}

export interface ScoreCalculationResult {
  score: number // Índice Composto de 0 a 100
  curva: CurvaABC
  totalValorAtivo: number
  qtdContratosAtivos: number
  mediaMesesVigencia: number
  aderenciaPercent?: number
  detalhes: {
    pontosValor: number // 50%
    pontosVigencia: number // 30%
    pontosQtd: number // 20%
    indiceComposto: number
    percentualAcumuladoPareto?: number
  }
}

/**
 * Filtra contratos vigentes de uma empresa:
 * Situação diferente de encerrado/cancelado/rescindido e vigência final não expirada há mais de 30 dias.
 */
export function extrairMetricasContratosAtivos(
  contratos: ContratoRecord[] = [],
  hoje: Date = new Date(),
): MetricasContratoAtivo {
  const contratosAtivos = contratos.filter((c) => {
    const sit = (c.situacao || '').toLowerCase()
    if (sit.includes('encerr') || sit.includes('cancel') || sit.includes('rescind')) return false
    if (c.vigencia_fim) {
      const fim = new Date(c.vigencia_fim)
      const diffDias = (fim.getTime() - hoje.getTime()) / (1000 * 3600 * 24)
      if (diffDias < -30) return false
    }
    return true
  })

  const totalValorAtivo = contratosAtivos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
  const qtdContratosAtivos = contratosAtivos.length

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

  return {
    totalValorAtivo,
    qtdContratosAtivos,
    mediaMesesVigencia: Math.round(mediaMesesVigencia * 10) / 10,
  }
}

/**
 * Calcula o Índice Composto de uma empresa individualmente:
 * Peso 50% valor dos contratos ativos
 * Peso 30% vigência restante dos contratos
 * Peso 20% quantidade de contratos
 * Normalizado de 0 a 100 em relação aos tetos estatísticos da base (ou tetos de referência padrão).
 */
export function calcularIndiceCompostoItem(
  metricas: MetricasContratoAtivo,
  maxValor: number = 10000000,
  maxVigenciaMeses: number = 36,
  maxQtd: number = 5,
): { indiceComposto: number; pontosValor: number; pontosVigencia: number; pontosQtd: number } {
  // Normalização de 0 a 100 para cada componente
  const refValor = Math.max(maxValor, 100000)
  const refVigencia = Math.max(maxVigenciaMeses, 12)
  const refQtd = Math.max(maxQtd, 1)

  const normValor = Math.min(100, Math.max(0, (metricas.totalValorAtivo / refValor) * 100))
  const normVigencia = Math.min(100, Math.max(0, (metricas.mediaMesesVigencia / refVigencia) * 100))
  const normQtd = Math.min(100, Math.max(0, (metricas.qtdContratosAtivos / refQtd) * 100))

  // Índice Composto com pesos automáticos: 50% valor, 30% vigência, 20% quantidade
  const indiceFloat = normValor * 0.5 + normVigencia * 0.3 + normQtd * 0.2
  const indiceComposto = Math.min(100, Math.max(0, Math.round(indiceFloat * 10) / 10))

  return {
    indiceComposto,
    pontosValor: Math.round(normValor),
    pontosVigencia: Math.round(normVigencia),
    pontosQtd: Math.round(normQtd),
  }
}

export const scoreCurvaService = {
  extrairMetricas: extrairMetricasContratosAtivos,

  /**
   * Classificação estatística em lote para uma lista de empresas com contratos
   * Aplica cortes estatísticos de Pareto da própria base:
   * 1. Calcula o Índice Composto de cada empresa (50% valor + 30% vigência + 20% quantidade).
   * 2. Ordena de forma decrescente pelo Índice Composto.
   * 3. Calcula o acumulado percentual da soma dos índices na base.
   * 4. Cortes estatísticos Pareto:
   *    - Curva A: até 80% do índice acumulado (ou top se base pequena)
   *    - Curva B: de 80% a 95% do índice acumulado
   *    - Curva C: acima de 95% ou índice zero
   */
  classificarBaseEmpresas<T extends { id: string; cnae?: string }>(
    empresas: T[],
    contratosPorEmpresa: Map<string, ContratoRecord[]>,
  ): Map<string, ScoreCalculationResult> {
    const hoje = new Date()
    const resultados = new Map<string, ScoreCalculationResult>()

    if (empresas.length === 0) return resultados

    // 1. Extrair métricas de todas as empresas
    const metricasArray = empresas.map((emp) => {
      const contratos = contratosPorEmpresa.get(emp.id) || []
      const met = extrairMetricasContratosAtivos(contratos, hoje)
      return {
        id: emp.id,
        met,
      }
    })

    // Tetos estatísticos da base atual
    const maxValorBase = Math.max(1000000, ...metricasArray.map((m) => m.met.totalValorAtivo))
    const maxVigenciaBase = Math.max(12, ...metricasArray.map((m) => m.met.mediaMesesVigencia))
    const maxQtdBase = Math.max(2, ...metricasArray.map((m) => m.met.qtdContratosAtivos))

    // 2. Calcular índice composto individual de cada um
    const comIndices = metricasArray.map((item) => {
      const calculo = calcularIndiceCompostoItem(
        item.met,
        maxValorBase,
        maxVigenciaBase,
        maxQtdBase,
      )
      return {
        id: item.id,
        met: item.met,
        ...calculo,
      }
    })

    // 3. Ordenar por índice composto decrescente
    comIndices.sort((a, b) => b.indiceComposto - a.indiceComposto)

    // 4. Acumulado estatístico de Pareto
    const somaTotalIndices = comIndices.reduce((acc, curr) => acc + curr.indiceComposto, 0)

    let acumulado = 0
    comIndices.forEach((item, index) => {
      acumulado += item.indiceComposto
      const percAcumulado =
        somaTotalIndices > 0
          ? (acumulado / somaTotalIndices) * 100
          : ((index + 1) / comIndices.length) * 100

      let curva: CurvaABC = 'C'
      // Pareto: A até 80%, B de 80 a 95%, C restante
      if (item.indiceComposto > 0) {
        if (percAcumulado <= 80 || (index === 0 && item.indiceComposto > 0)) {
          curva = 'A'
        } else if (percAcumulado <= 95) {
          curva = 'B'
        } else {
          curva = 'C'
        }
      } else {
        curva = 'C'
      }

      resultados.set(item.id, {
        score: Math.round(item.indiceComposto),
        curva,
        totalValorAtivo: item.met.totalValorAtivo,
        qtdContratosAtivos: item.met.qtdContratosAtivos,
        mediaMesesVigencia: item.met.mediaMesesVigencia,
        detalhes: {
          pontosValor: item.pontosValor,
          pontosVigencia: item.pontosVigencia,
          pontosQtd: item.pontosQtd,
          indiceComposto: item.indiceComposto,
          percentualAcumuladoPareto: Math.round(percAcumulado * 10) / 10,
        },
      })
    })

    return resultados
  },

  /**
   * Cálculo pontual para uma empresa isolada (compatibilidade e visualização individual)
   */
  calcular(contratos: ContratoRecord[] = [], _cnae?: string): ScoreCalculationResult {
    const hoje = new Date()
    const met = extrairMetricasContratosAtivos(contratos, hoje)
    const calculo = calcularIndiceCompostoItem(met)

    // Classificação de referência quando sem a base inteira:
    // A: índice composto >= 70 ou contratos ativos > 3M
    // B: índice composto entre 30 e 70 ou contratos ativos > 500k
    // C: restante
    let curva: CurvaABC = 'C'
    if (calculo.indiceComposto >= 60 || met.totalValorAtivo >= 5000000) {
      curva = 'A'
    } else if (calculo.indiceComposto >= 25 || met.totalValorAtivo >= 1000000) {
      curva = 'B'
    } else {
      curva = 'C'
    }

    return {
      score: Math.round(calculo.indiceComposto),
      curva,
      totalValorAtivo: met.totalValorAtivo,
      qtdContratosAtivos: met.qtdContratosAtivos,
      mediaMesesVigencia: met.mediaMesesVigencia,
      detalhes: {
        pontosValor: calculo.pontosValor,
        pontosVigencia: calculo.pontosVigencia,
        pontosQtd: calculo.pontosQtd,
        indiceComposto: calculo.indiceComposto,
      },
    }
  },
}
