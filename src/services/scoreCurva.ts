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
  posicaoNaBase?: number
  totalEmpresasBase?: number
  explicacao?: string
  detalhes: {
    pontosValor: number // 50%
    pontosVigencia: number // 30%
    pontosQtd: number // 20%
    indiceComposto: number
    percentualAcumuladoPareto?: number
    regraAplicada?: string
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
      let regraAplicada = ''

      // Regras de piso e Pareto com base pequena:
      // - A maior empresa (index === 0) com contrato/índice > 0 é SEMPRE Curva A (piso da maior empresa)
      // - Se base tiver 1 empresa com contrato: Curva A
      // - Se base tiver 2 empresas: 1ª = A, 2ª = B (se tiver contrato) ou C (se zero)
      // - Se base tiver 3 empresas: 1ª = A, 2ª = B, 3ª = C
      // - Se base >= 4 empresas: Pareto tradicional (A <= 80%, B 80%-95%, C > 95%), sempre garantindo index 0 como A
      const totalEmpresas = comIndices.length

      if (item.indiceComposto > 0 || item.met.totalValorAtivo > 0) {
        if (index === 0) {
          curva = 'A'
          regraAplicada = 'Maior índice da base (regra de piso: top 1 é sempre Curva A)'
        } else if (totalEmpresas <= 2) {
          curva = 'B'
          regraAplicada = 'Segunda maior empresa em base pequena (regra de piso: Curva B)'
        } else if (totalEmpresas === 3) {
          if (index === 1) {
            curva = 'B'
            regraAplicada = 'Distribuição Pareto em base pequena (2ª posição = Curva B)'
          } else {
            curva = 'C'
            regraAplicada = 'Distribuição Pareto em base pequena (3ª posição = Curva C)'
          }
        } else {
          // Base >= 4 empresas: Pareto acumulado
          if (percAcumulado <= 80) {
            curva = 'A'
            regraAplicada = `Pareto: até 80% do acumulado da base (${Math.round(percAcumulado)}%)`
          } else if (percAcumulado <= 95) {
            curva = 'B'
            regraAplicada = `Pareto: faixa entre 80% e 95% do acumulado (${Math.round(percAcumulado)}%)`
          } else {
            curva = 'C'
            regraAplicada = `Pareto: cauda longa acima de 95% do acumulado (${Math.round(percAcumulado)}%)`
          }
        }
      } else {
        curva = 'C'
        regraAplicada = 'Sem contratos ativos ou índice composto zero'
      }

      const explicacao = `Classificada na Curva ${curva} com Índice Composto ${Math.round(item.indiceComposto)}/100 (posição ${index + 1} de ${totalEmpresas} na base). Critérios: 50% Valor (${item.pontosValor} pts), 30% Vigência (${item.pontosVigencia} pts), 20% Volume (${item.pontosQtd} pts). ${regraAplicada}.`

      resultados.set(item.id, {
        score: Math.round(item.indiceComposto),
        curva,
        totalValorAtivo: item.met.totalValorAtivo,
        qtdContratosAtivos: item.met.qtdContratosAtivos,
        mediaMesesVigencia: item.met.mediaMesesVigencia,
        posicaoNaBase: index + 1,
        totalEmpresasBase: totalEmpresas,
        explicacao,
        detalhes: {
          pontosValor: item.pontosValor,
          pontosVigencia: item.pontosVigencia,
          pontosQtd: item.pontosQtd,
          indiceComposto: item.indiceComposto,
          percentualAcumuladoPareto: Math.round(percAcumulado * 10) / 10,
          regraAplicada,
        },
      })
    })

    return resultados
  },

  /**
   * Cálculo pontual para uma empresa isolada (compatibilidade e visualização individual)
   */
  calcular(
    contratos: ContratoRecord[] = [],
    _cnae?: string,
    contextoBase?: { posicao?: number; total?: number },
  ): ScoreCalculationResult {
    const hoje = new Date()
    const met = extrairMetricasContratosAtivos(contratos, hoje)
    const calculo = calcularIndiceCompostoItem(met)

    // Regra de piso quando avaliada individualmente:
    // Se possui contratos ativos vigentes, a empresa nunca cai em C arbitrariamente se for a única ou principal.
    // Piso: com contrato ativo >= R$ 1,00, no mínimo Curva A (se for única na base) ou calculada por faixas generosas
    let curva: CurvaABC = 'C'
    let regra = ''

    if (met.qtdContratosAtivos === 0 || met.totalValorAtivo === 0) {
      curva = 'C'
      regra = 'Sem contratos ativos vigentes cadastrados'
    } else if (contextoBase && contextoBase.total && contextoBase.total <= 1) {
      // Regra de piso expressa: única empresa com contrato ativo é sempre A
      curva = 'A'
      regra = 'Única empresa com contrato ativo na base (regra de piso: Curva A garantida)'
    } else if (calculo.indiceComposto >= 40 || met.totalValorAtivo >= 1000000) {
      curva = 'A'
      regra = 'Alto índice composto ou valor contratual expressivo (>= R$ 1M)'
    } else if (calculo.indiceComposto >= 15 || met.totalValorAtivo >= 200000) {
      curva = 'B'
      regra = 'Médio índice composto ou valor contratual intermediário'
    } else {
      // Mesmo com valor menor, se tiver contratos ativos relevantes e for uma base pequena (ou única analisada isoladamente)
      curva = 'B'
      regra =
        'Empresa com contrato ativo em análise pontual (piso mínimo B para empresas contratadas)'
    }

    const pos = contextoBase?.posicao ?? 1
    const tot = contextoBase?.total ?? 1
    const explicacao = `Classificada na Curva ${curva} com Índice Composto ${Math.round(calculo.indiceComposto)}/100 (posição ${pos} de ${tot}). Critérios: 50% Valor (${calculo.pontosValor} pts), 30% Vigência (${calculo.pontosVigencia} pts), 20% Volume (${calculo.pontosQtd} pts). ${regra}.`

    return {
      score: Math.round(calculo.indiceComposto),
      curva,
      totalValorAtivo: met.totalValorAtivo,
      qtdContratosAtivos: met.qtdContratosAtivos,
      mediaMesesVigencia: met.mediaMesesVigencia,
      posicaoNaBase: pos,
      totalEmpresasBase: tot,
      explicacao,
      detalhes: {
        pontosValor: calculo.pontosValor,
        pontosVigencia: calculo.pontosVigencia,
        pontosQtd: calculo.pontosQtd,
        indiceComposto: calculo.indiceComposto,
        regraAplicada: regra,
      },
    }
  },
}
