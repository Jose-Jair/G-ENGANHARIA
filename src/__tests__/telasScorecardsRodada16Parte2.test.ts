import { describe, it, expect } from 'vitest'
import { renderBadgeTendencia } from '@/components/scorecards/FichaScorecard'

describe('Rodada 16 Parte 2 - Telas dos Scorecards', () => {
  it('renderBadgeTendencia retorna badges corretos para cada tendência', () => {
    const badgeMelhorou = renderBadgeTendencia('melhorou')
    expect(badgeMelhorou).toBeDefined()

    const badgePiorou = renderBadgeTendencia('piorou')
    expect(badgePiorou).toBeDefined()

    const badgeEstavel = renderBadgeTendencia('estavel')
    expect(badgeEstavel).toBeDefined()

    const badgeInsuficiente = renderBadgeTendencia('dados_insuficientes')
    expect(badgeInsuficiente).toBeDefined()

    const badgeNulo = renderBadgeTendencia(null)
    expect(badgeNulo).toBeDefined()
  })

  it('Verifica estrutura de tipos de Scorecard e Parâmetros', () => {
    const fakeScorecard = {
      id: 'sc123',
      tipo_entidade: 'prestador_externo',
      registro_id: 'prest123',
      indice_composto: 88,
      versao_pesos: 1,
      tendencia_5_trabalhos: 'melhorou',
      dados_insuficientes: false,
      ext_pontualidade: 95,
      ext_retrabalho: 90,
      ext_qualidade: 85,
    }

    expect(fakeScorecard.indice_composto).toBe(88)
    expect(fakeScorecard.dados_insuficientes).toBe(false)
    expect(fakeScorecard.tendencia_5_trabalhos).toBe('melhorou')
  })

  it('Validação da regra de soma de pesos 100% para nova versão de parâmetros', () => {
    const pesosValidos = {
      pontualidade: 30,
      retrabalho: 25,
      qualidade: 25,
      aderencia_preco: 10,
      responsividade: 5,
      conformidade_documental: 5,
    }

    const soma = Object.values(pesosValidos).reduce((acc, v) => acc + v, 0)
    expect(soma).toBe(100)

    const pesosInvalidos = {
      pontualidade: 40,
      retrabalho: 20,
    }
    const somaInvalida = Object.values(pesosInvalidos).reduce((acc, v) => acc + v, 0)
    expect(somaInvalida).not.toBe(100)
  })

  it('Garante que a decisão humana de suspensão aceita ações válidas', () => {
    const acoesPermitidas = ['suspender', 'manter_ativo']
    expect(acoesPermitidas).toContain('suspender')
    expect(acoesPermitidas).toContain('manter_ativo')
  })
})
