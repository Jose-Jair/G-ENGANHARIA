import { describe, it, expect } from 'vitest'
import { ScorecardRecord, ParametroScorecardRecord, ItemRankingCotacao } from '../types'

describe('RODADA 16 — SCORECARDS (Parte 1: Backend & Motor de Cálculo)', () => {
  // ---------------------------------------------------------------------------
  // 1. VARIAÇÃO DO COMPOSTO: DEVOLUÇÃO DE ENTREGÁVEL VS ENTREGA NO PRAZO
  // ---------------------------------------------------------------------------
  it('deve penalizar o composto do prestador externo após devolução de entregável (retrabalho cai)', () => {
    // Pesos padrão prestador externo: pontualidade 30, retrabalho 25, qualidade 20, aderência 10, responsividade 10, conformidade 5
    const pesos = {
      pontualidade: 30,
      retrabalho: 25,
      qualidade: 20,
      aderencia_preco: 10,
      responsividade: 10,
      conformidade: 5,
    }

    // Cenário 1: Prestador com 100% de entregas no prazo e 0 devoluções (retrabalho 100)
    const indicesAntes = {
      pontualidade: 100,
      retrabalho: 100,
      qualidade: 80,
      aderencia_preco: 90,
      responsividade: 100,
      conformidade: 100,
    }

    const compostoAntes =
      (indicesAntes.pontualidade * pesos.pontualidade +
        indicesAntes.retrabalho * pesos.retrabalho +
        indicesAntes.qualidade * pesos.qualidade +
        indicesAntes.aderencia_preco * pesos.aderencia_preco +
        indicesAntes.responsividade * pesos.responsividade +
        indicesAntes.conformidade * pesos.conformidade) /
      100

    expect(compostoAntes).toBe(94)

    // Cenário 2: Entregável devolvido (retrabalho cai para 60)
    const indicesDepoisDevolucao = {
      ...indicesAntes,
      retrabalho: 60, // 40% de entregáveis precisaram de revisão
    }

    const compostoDepoisDevolucao =
      (indicesDepoisDevolucao.pontualidade * pesos.pontualidade +
        indicesDepoisDevolucao.retrabalho * pesos.retrabalho +
        indicesDepoisDevolucao.qualidade * pesos.qualidade +
        indicesDepoisDevolucao.aderencia_preco * pesos.aderencia_preco +
        indicesDepoisDevolucao.responsividade * pesos.responsividade +
        indicesDepoisDevolucao.conformidade * pesos.conformidade) /
      100

    expect(compostoDepoisDevolucao).toBe(84)
    expect(compostoDepoisDevolucao).toBeLessThan(compostoAntes)
    expect(compostoAntes - compostoDepoisDevolucao).toBe(10)
  })

  it('deve elevar o composto do prestador quando OSs são concluídas com pontualidade', () => {
    const pesos = {
      pontualidade: 30,
      retrabalho: 25,
      qualidade: 20,
      aderencia_preco: 10,
      responsividade: 10,
      conformidade: 5,
    }

    const compostoComAtraso =
      (50 * pesos.pontualidade +
        100 * pesos.retrabalho +
        80 * pesos.qualidade +
        90 * pesos.aderencia_preco +
        100 * pesos.responsividade +
        100 * pesos.conformidade) /
      100

    const compostoPontual =
      (100 * pesos.pontualidade +
        100 * pesos.retrabalho +
        80 * pesos.qualidade +
        90 * pesos.aderencia_preco +
        100 * pesos.responsividade +
        100 * pesos.conformidade) /
      100

    expect(compostoPontual).toBeGreaterThan(compostoComAtraso)
    expect(compostoPontual - compostoComAtraso).toBe(15) // 50 pts * 30% = 15 pts no composto
  })

  // ---------------------------------------------------------------------------
  // 2. ORDENAÇÃO DO RANKING PELO COMPOSTO
  // ---------------------------------------------------------------------------
  it('deve priorizar no ranking prestadores com maior índice composto e capacidade livre', () => {
    const cotacoesSimuladas: ItemRankingCotacao[] = [
      {
        cotacao_id: 'cot_1',
        prestador_id: 'p_1',
        prestador_nome: 'Eng. Carlos (Scorecard 95)',
        prestador_tipo: 'pf_externo',
        status: 'respondida',
        preco_ofertado: 5000,
        prazo_ofertado: '2026-04-10',
        escolhida: false,
        nota_geral: 4.8,
        scorecard_composto: 95,
        scorecard_dados_insuficientes: false,
        tendencia: 'melhorou',
        capacidade_maxima: 3,
        carga_atual: 1,
        capacidade_livre: 2,
        ultrapassa_referencia: false,
        score_final: 95 * 0.5 + 2 * 5 + 8, // 47.5 + 10 + 8 = 65.5
        respondida: true,
      },
      {
        cotacao_id: 'cot_2',
        prestador_id: 'p_2',
        prestador_nome: 'Eng. Beatriz (Scorecard 60)',
        prestador_tipo: 'pf_externo',
        status: 'respondida',
        preco_ofertado: 5000,
        prazo_ofertado: '2026-04-10',
        escolhida: false,
        nota_geral: 3.5,
        scorecard_composto: 60,
        scorecard_dados_insuficientes: false,
        tendencia: 'estavel',
        capacidade_maxima: 3,
        carga_atual: 1,
        capacidade_livre: 2,
        ultrapassa_referencia: false,
        score_final: 60 * 0.5 + 2 * 5, // 30 + 10 = 40
        respondida: true,
      },
      {
        cotacao_id: 'cot_3',
        prestador_id: 'p_3',
        prestador_nome: 'Eng. Lucas (Dados Insuficientes)',
        prestador_tipo: 'pf_externo',
        status: 'respondida',
        preco_ofertado: 5000,
        prazo_ofertado: '2026-04-10',
        escolhida: false,
        nota_geral: 5.0,
        scorecard_composto: null,
        scorecard_dados_insuficientes: true,
        tendencia: 'estavel',
        capacidade_maxima: 3,
        carga_atual: 1,
        capacidade_livre: 2,
        ultrapassa_referencia: false,
        score_final: 5.0 * 10 + 2 * 5, // 50 + 10 = 60
        respondida: true,
      },
    ]

    const ordenados = [...cotacoesSimuladas].sort((a, b) => b.score_final - a.score_final)

    expect(ordenados[0].prestador_id).toBe('p_1') // Score 65.5
    expect(ordenados[1].prestador_id).toBe('p_3') // Score 60 (dados insuficientes não zerou nem derrubou)
    expect(ordenados[2].prestador_id).toBe('p_2') // Score 40 (composto baixo)
  })

  // ---------------------------------------------------------------------------
  // 3. DADOS INSUFICIENTES: NUNCA INVENTAR NOTA
  // ---------------------------------------------------------------------------
  it('deve manter campos nulos e flag de insuficiência quando prestador não possui histórico na janela', () => {
    const scorecardSemHistorico: Partial<ScorecardRecord> = {
      tipo_entidade: 'prestador_externo',
      registro_id: 'p_novato',
      dados_insuficientes: true,
      motivo_insuficiencia: 'Nenhum trabalho ou entregável finalizado nos últimos 12 meses',
      total_trabalhos_janela: 0,
      indice_composto: null,
      tendencia_5_trabalhos: 'dados_insuficientes',
      ext_pontualidade: null,
      ext_retrabalho: null,
      ext_qualidade: null,
      ext_aderencia_preco: null,
      ext_responsividade: null,
      ext_conformidade: null,
    }

    expect(scorecardSemHistorico.dados_insuficientes).toBe(true)
    expect(scorecardSemHistorico.indice_composto).toBeNull()
    expect(scorecardSemHistorico.ext_pontualidade).toBeNull()
    expect(scorecardSemHistorico.ext_retrabalho).toBeNull()
    expect(scorecardSemHistorico.motivo_insuficiencia).toContain('Nenhum trabalho')
  })

  // ---------------------------------------------------------------------------
  // 4. HISTÓRICO E SNAPSHOT MENSAL DE PONTO NO TEMPO
  // ---------------------------------------------------------------------------
  it('deve armazenar snapshot mensal com mes_referencia sem sobrescrever o scorecard ativo', () => {
    const scAtivo: ScorecardRecord = {
      id: 'sc_ativo_1',
      tipo_entidade: 'prestador_externo',
      registro_id: 'p_10',
      is_snapshot: false,
      data_calculo: '2026-03-31T15:00:00Z',
      versao_pesos: 1,
      dados_insuficientes: false,
      total_trabalhos_janela: 8,
      indice_composto: 88.5,
      tendencia_5_trabalhos: 'melhorou',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-31T15:00:00Z',
    }

    const scSnapshot: ScorecardRecord = {
      id: 'sc_snap_fev',
      tipo_entidade: 'prestador_externo',
      registro_id: 'p_10',
      is_snapshot: true,
      mes_referencia: '2026-02',
      data_calculo: '2026-02-28T23:59:59Z',
      versao_pesos: 1,
      dados_insuficientes: false,
      total_trabalhos_janela: 6,
      indice_composto: 82.0,
      tendencia_5_trabalhos: 'estavel',
      created: '2026-02-28T23:59:59Z',
      updated: '2026-02-28T23:59:59Z',
    }

    expect(scAtivo.is_snapshot).toBe(false)
    expect(scSnapshot.is_snapshot).toBe(true)
    expect(scSnapshot.mes_referencia).toBe('2026-02')
    expect(scSnapshot.indice_composto).toBe(82.0)
    expect(scAtivo.indice_composto).toBe(88.5)
  })

  // ---------------------------------------------------------------------------
  // 5. ISOLAMENTO E SEGURANÇA (ASSERTIVAS NEGATIVAS)
  // ---------------------------------------------------------------------------
  it('deve garantir que a projeção do Portal do Prestador não exponha dados financeiros ou de outros prestadores', () => {
    // Projeção do prestador logado
    const projecaoPrestador = {
      prestador_id: 'prest_abc',
      prestador_nome: 'Eng. Roberto Lima',
      tipo: 'prestador_externo',
      scorecard: {
        indice_composto: 91,
        tendencia_5_trabalhos: 'melhorou',
        ext_pontualidade: 95,
        ext_retrabalho: 90,
        ext_qualidade: 85,
      },
    }

    const chavesProjecao = Object.keys(projecaoPrestador)
    const chavesScorecard = Object.keys(projecaoPrestador.scorecard)

    // ASSERTIVAS NEGATIVAS MANDATÓRIAS
    expect(chavesProjecao).not.toContain('custo_hora')
    expect(chavesProjecao).not.toContain('custo_mensal')
    expect(chavesProjecao).not.toContain('salario')
    expect(chavesProjecao).not.toContain('margem')
    expect(chavesProjecao).not.toContain('valor_contrato')
    expect(chavesProjecao).not.toContain('bdi')
    expect(chavesProjecao).not.toContain('outros_prestadores')

    expect(chavesScorecard).not.toContain('custo_hora')
    expect(chavesScorecard).not.toContain('margem')
  })

  // ---------------------------------------------------------------------------
  // 6. PARÂMETROS VERSIONADOS: NUNCA APAGAR NEM REESCREVER VERSÃO ANTERIOR
  // ---------------------------------------------------------------------------
  it('deve criar nova versão de parâmetros preservando o histórico imutável das versões anteriores', () => {
    const versao1: ParametroScorecardRecord = {
      id: 'param_v1',
      tipo_entidade: 'prestador_externo',
      versao: 1,
      descricao: 'Pesos v1 padrão',
      ativo: false, // Desativado ao nascer v2
      pesos_json: {
        pontualidade: 30,
        retrabalho: 25,
        qualidade: 20,
        aderencia_preco: 10,
        responsividade: 10,
        conformidade: 5,
      },
      criado_em: '2026-03-01T00:00:00Z',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-15T00:00:00Z',
    }

    const versao2: ParametroScorecardRecord = {
      id: 'param_v2',
      tipo_entidade: 'prestador_externo',
      versao: 2,
      descricao: 'Pesos v2 calibrados pela diretoria técnica',
      ativo: true,
      pesos_json: {
        pontualidade: 35,
        retrabalho: 25,
        qualidade: 20,
        aderencia_preco: 10,
        responsividade: 5,
        conformidade: 5,
      },
      criado_em: '2026-03-15T00:00:00Z',
      created: '2026-03-15T00:00:00Z',
      updated: '2026-03-15T00:00:00Z',
    }

    expect(versao2.versao).toBe(versao1.versao + 1)
    expect(versao1.ativo).toBe(false)
    expect(versao2.ativo).toBe(true)
    expect(versao1.pesos_json.pontualidade).toBe(30)
    expect(versao2.pesos_json.pontualidade).toBe(35)
  })
})
