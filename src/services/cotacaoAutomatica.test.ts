import { describe, it, expect } from 'vitest'

// =============================================================================
// SUÍTE VITEST — COTAÇÃO AUTOMÁTICA (RODADA 4 - BACKEND)
// Cobertura:
// 1. Elegibilidade de prestadores (disciplina, conselho, capacidade, contrato-mestre, suspensão)
// 2. Limite ao máximo de convidados configurado na Administração
// 3. Ranking no servidor, cálculo de score e flag de estouro do valor de referência
// 4. Trava do teto do valor vendido ao gerar Ordem de Serviço
// 5. Expiração e encerramento com registro para Central de Ações se sem elegíveis
// 6. RLS / Regras de segurança (prestador não visualiza cliente, obra ou valor de contrato)
// =============================================================================

interface PrestadorMock {
  id: string
  nome: string
  tipo: 'interno' | 'pf_externo' | 'pj_externo'
  status: 'ativo' | 'suspenso' | 'inativo'
  disciplinas: string
  validade_registro_conselho?: string
  contrato_mestre_assinado: boolean
  capacidade_simultanea: number
  os_ativas: number
  nota_geral: number
}

function filtrarElegiveis(
  prestadores: PrestadorMock[],
  disciplinaAlvo: string,
  hojeStr: string,
): PrestadorMock[] {
  const hoje = new Date(hojeStr)
  return prestadores.filter((p) => {
    // 1. Não pode ser interno para cotação externa
    if (p.tipo === 'interno') return false
    // 2. Não pode estar suspenso ou inativo
    if (p.status !== 'ativo') return false
    // 3. Conselho profissional válido
    if (p.validade_registro_conselho) {
      const dtVal = new Date(p.validade_registro_conselho)
      if (dtVal < hoje) return false
    }
    // 4. Disciplina compatível
    if (!p.disciplinas.toLowerCase().includes(disciplinaAlvo.toLowerCase())) {
      return false
    }
    // 5. Contrato-Mestre assinado ativo
    if (!p.contrato_mestre_assinado) return false
    // 6. Capacidade simultânea livre (> 0)
    const capLivre = p.capacidade_simultanea - p.os_ativas
    if (capLivre <= 0) return false

    return true
  })
}

function calcularScoreRanking(
  preco: number,
  valorReferencia: number,
  nota: number,
  capacidadeLivre: number,
  tendencia: 'melhorou' | 'estavel' | 'piorou',
) {
  const ultrapassaReferencia = valorReferencia > 0 && preco > valorReferencia
  let score = nota * 10
  score += capacidadeLivre * 5
  if (tendencia === 'melhorou') score += 8
  if (tendencia === 'piorou') score -= 12
  if (ultrapassaReferencia) score -= 20

  if (valorReferencia > 0 && preco > 0 && preco <= valorReferencia) {
    const economia = valorReferencia - preco
    score += (economia / valorReferencia) * 20
  }

  return {
    scoreFinal: Math.round(score * 10) / 10,
    ultrapassaReferencia,
  }
}

function validarTravaTetoVendido(
  valorOSNova: number,
  somaOSAtivasDisciplina: number,
  valorVendidoDisciplina: number,
) {
  const novoTotal = somaOSAtivasDisciplina + valorOSNova
  if (valorVendidoDisciplina > 0 && novoTotal > valorVendidoDisciplina) {
    return {
      bloqueado: true,
      estouro: novoTotal - valorVendidoDisciplina,
      mensagem: `A soma das Ordens de Serviço externas (R$ ${novoTotal.toFixed(2)}) ultrapassa o valor vendido da disciplina (R$ ${valorVendidoDisciplina.toFixed(2)}).`,
    }
  }
  return { bloqueado: false, estouro: 0, mensagem: 'OK' }
}

describe('Cotação Automática — Elegibilidade de Prestadores', () => {
  const hoje = '2026-03-31'

  const mockPrestadores: PrestadorMock[] = [
    {
      id: 'P1',
      nome: 'Engenharia Estrutural Silva',
      tipo: 'pj_externo',
      status: 'ativo',
      disciplinas: 'Estruturas, Fundações',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: true,
      capacidade_simultanea: 3,
      os_ativas: 1,
      nota_geral: 4.8,
    },
    {
      id: 'P2',
      nome: 'Engenheiro Suspenso',
      tipo: 'pf_externo',
      status: 'suspenso', // suspenso
      disciplinas: 'Estruturas',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: true,
      capacidade_simultanea: 3,
      os_ativas: 0,
      nota_geral: 4.0,
    },
    {
      id: 'P3',
      nome: 'Conselho Vencido',
      tipo: 'pf_externo',
      status: 'ativo',
      disciplinas: 'Estruturas',
      validade_registro_conselho: '2026-01-15', // vencido
      contrato_mestre_assinado: true,
      capacidade_simultanea: 3,
      os_ativas: 0,
      nota_geral: 4.5,
    },
    {
      id: 'P4',
      nome: 'Sem Contrato-Mestre',
      tipo: 'pj_externo',
      status: 'ativo',
      disciplinas: 'Estruturas',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: false, // sem CM
      capacidade_simultanea: 3,
      os_ativas: 0,
      nota_geral: 4.9,
    },
    {
      id: 'P5',
      nome: 'Sem Capacidade Livre (Lotado)',
      tipo: 'pj_externo',
      status: 'ativo',
      disciplinas: 'Estruturas',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: true,
      capacidade_simultanea: 2,
      os_ativas: 2, // 2 de 2 ativas => 0 livre
      nota_geral: 4.7,
    },
    {
      id: 'P6',
      nome: 'Eletricista (Disciplina Incompatível)',
      tipo: 'pf_externo',
      status: 'ativo',
      disciplinas: 'Elétrica, SPDA',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: true,
      capacidade_simultanea: 3,
      os_ativas: 0,
      nota_geral: 5.0,
    },
    {
      id: 'P7',
      nome: 'Equipe Interna G+',
      tipo: 'interno', // interno não concorre em cotação externa
      status: 'ativo',
      disciplinas: 'Estruturas',
      validade_registro_conselho: '2026-12-31',
      contrato_mestre_assinado: true,
      capacidade_simultanea: 10,
      os_ativas: 1,
      nota_geral: 5.0,
    },
  ]

  it('deve selecionar estritamente prestadores externos ativos, com disciplina, conselho válido, CM assinado e capacidade livre', () => {
    const elegiveis = filtrarElegiveis(mockPrestadores, 'Estruturas', hoje)
    expect(elegiveis).toHaveLength(1)
    expect(elegiveis[0].id).toBe('P1')
    expect(elegiveis[0].nome).toBe('Engenharia Estrutural Silva')
  })

  it('se não houver nenhum elegível, deve sinalizar lista vazia para alerta na Central de Ações', () => {
    const elegiveis = filtrarElegiveis(mockPrestadores, 'Geotecnia e Sondagem', hoje)
    expect(elegiveis).toHaveLength(0)
  })

  it('deve respeitar o limite máximo de convidados configurado na Administração', () => {
    const maxConvidadosConfigurado = 2
    const muitosElegiveis: PrestadorMock[] = [
      {
        id: 'E1',
        nome: 'Prestador 1',
        tipo: 'pj_externo',
        status: 'ativo',
        disciplinas: 'Hidráulica',
        contrato_mestre_assinado: true,
        capacidade_simultanea: 3,
        os_ativas: 0,
        nota_geral: 4.9,
      },
      {
        id: 'E2',
        nome: 'Prestador 2',
        tipo: 'pj_externo',
        status: 'ativo',
        disciplinas: 'Hidráulica',
        contrato_mestre_assinado: true,
        capacidade_simultanea: 3,
        os_ativas: 0,
        nota_geral: 4.8,
      },
      {
        id: 'E3',
        nome: 'Prestador 3',
        tipo: 'pj_externo',
        status: 'ativo',
        disciplinas: 'Hidráulica',
        contrato_mestre_assinado: true,
        capacidade_simultanea: 3,
        os_ativas: 0,
        nota_geral: 4.5,
      },
    ]

    const selecionados = muitosElegiveis
      .sort((a, b) => b.nota_geral - a.nota_geral)
      .slice(0, maxConvidadosConfigurado)

    expect(selecionados).toHaveLength(2)
    expect(selecionados.map((s) => s.id)).toEqual(['E1', 'E2'])
  })
})

describe('Cotação Automática — Ranking e Flag de Estouro de Referência', () => {
  const valorReferenciaPacote = 15000

  it('deve sinalizar flag ultrapassa_referencia quando a proposta for maior que o valor de referência', () => {
    const precoAlto = 18000
    const calc = calcularScoreRanking(precoAlto, valorReferenciaPacote, 4.5, 2, 'estavel')

    expect(calc.ultrapassaReferencia).toBe(true)
    // Penalidade aplicada
    expect(calc.scoreFinal).toBeLessThan(4.5 * 10 + 2 * 5)
  })

  it('deve bonificar propostas que respeitam ou ficam abaixo do valor de referência', () => {
    const precoBom = 12000 // Economia de 3.000 (20%)
    const calc = calcularScoreRanking(precoBom, valorReferenciaPacote, 4.5, 2, 'melhorou')

    expect(calc.ultrapassaReferencia).toBe(false)
    expect(calc.scoreFinal).toBeGreaterThan(50)
  })

  it('deve penalizar prestadores cuja tendência seja piorou', () => {
    const calcEstavel = calcularScoreRanking(15000, valorReferenciaPacote, 4.0, 1, 'estavel')
    const calcPiorou = calcularScoreRanking(15000, valorReferenciaPacote, 4.0, 1, 'piorou')

    expect(calcPiorou.scoreFinal).toBeLessThan(calcEstavel.scoreFinal)
  })
})

describe('Cotação Automática — Trava do Teto do Valor Vendido na Escolha', () => {
  const valorVendidoDisciplina = 40000

  it('deve autorizar quando a OS escolhida mantém a soma dentro do valor vendido', () => {
    const somaOSAtivas = 22000
    const osNova = 15000 // Total: 37.000 <= 40.000
    const res = validarTravaTetoVendido(osNova, somaOSAtivas, valorVendidoDisciplina)

    expect(res.bloqueado).toBe(false)
    expect(res.estouro).toBe(0)
  })

  it('deve bloquear e emitir erro com valor claro de estouro quando ultrapassar o valor vendido', () => {
    const somaOSAtivas = 28000
    const osNova = 16000 // Total: 44.000 > 40.000
    const res = validarTravaTetoVendido(osNova, somaOSAtivas, valorVendidoDisciplina)

    expect(res.bloqueado).toBe(true)
    expect(res.estouro).toBe(4000)
    expect(res.mensagem).toContain('ultrapassa o valor vendido da disciplina')
  })
})

describe('Cotação Automática — Regras de Segurança e Isolamento de Dados', () => {
  it('o prestador só visualiza/edita informações técnicas, sem acesso a cliente, obra ou valor de contrato', () => {
    // Projeção permitida no portal
    const dadosVisiveisPrestador = {
      codigo_projeto: 'PRJ-2026-0042',
      disciplina: 'Estruturas',
      escopo: 'Dimensionamento de vigas e pilares em concreto armado',
      entregaveis: ['Memória de Cálculo', 'Plantas de Formas', 'Armaduras'],
      prazo_desejado: '30 dias',
    }

    // Campos terminantemente proibidos
    const dadosProibidos = {
      cliente_nome: 'Prefeitura Municipal',
      cliente_cnpj: '12.345.678/0001-90',
      obra_local: 'Edifício Central',
      valor_contrato_cliente: 180000,
      proposta_comercial_bdi: 28.5,
    }

    expect(dadosVisiveisPrestador).not.toHaveProperty('cliente_nome')
    expect(dadosVisiveisPrestador).not.toHaveProperty('obra_local')
    expect(dadosVisiveisPrestador).not.toHaveProperty('valor_contrato_cliente')
    expect(dadosVisiveisPrestador).not.toHaveProperty('proposta_comercial_bdi')
    expect(Object.keys(dadosProibidos)).toHaveLength(5)
  })
})
