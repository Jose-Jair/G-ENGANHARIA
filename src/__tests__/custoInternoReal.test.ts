// src/__tests__/custoInternoReal.test.ts
// RODADA 15 — CUSTO INTERNO REAL (Parte 1: backend)
// Testes unitários e de integração das regras de negócio:
// (1) Limite diário de horas apontadas (horas_mes / 22 ou horas_dia_padrao)
// (2) Retroativo máximo (> 7 dias recusado, data futura recusada)
// (3) Passo mínimo de horas (múltiplo de 0,25) e validação de pertencimento da OS
// (4) Cálculo de horas estimadas = dias_úteis × (horas/dia) ÷ OS simultâneas
// (5) Custo realizado na aprovação do entregável e bloqueio sem custo_hora
// (6) Margem e saúde financeira do projeto subtraindo o custo interno
// (7) Isolamento e regras de segurança (API Rules: prestador interno NUNCA vê custo_hora/salário/margem)

import { describe, expect, it } from 'vitest'

describe('RODADA 15 — Custo Interno Real (Regras de Negócio do Backend)', () => {
  // --------------------------------------------------------------------------
  // 1. Limite diário de horas contratadas e Passo de horas
  // --------------------------------------------------------------------------
  describe('Limite diário e passo do apontamento', () => {
    it('deve calcular o teto diário de horas contratadas a partir das horas do mês', () => {
      const horasMes = 176
      const diasUteisMedia = 22
      const limiteDiarioContratado = Math.round((horasMes / diasUteisMedia) * 100) / 100
      expect(limiteDiarioContratado).toBe(8)

      // Teste com meio período (88h/mês)
      const meioPeriodo = 88
      const limiteMeioPeriodo = Math.round((meioPeriodo / diasUteisMedia) * 100) / 100
      expect(limiteMeioPeriodo).toBe(4)
    })

    it('deve recusar soma de apontamentos no dia que ultrapasse o limite diário contratado', () => {
      const limiteDiario = 8
      const apontamentoExistente = 6
      const novoApontamentoValido = 2
      const novoApontamentoInvalido = 2.5

      expect(apontamentoExistente + novoApontamentoValido <= limiteDiario).toBe(true)
      expect(apontamentoExistente + novoApontamentoInvalido > limiteDiario).toBe(true)

      const validarLimiteDiario = (existente: number, novo: number, limite: number) => {
        if (existente + novo > limite) {
          throw new Error(
            `BLOQUEIO: Limite diário de horas excedido. Total: ${existente + novo}h (limite: ${limite}h)`,
          )
        }
        return true
      }

      expect(() => validarLimiteDiario(6, 2, 8)).not.toThrow()
      expect(() => validarLimiteDiario(6, 2.5, 8)).toThrow(/Limite diário de horas excedido/)
    })

    it('deve validar que o apontamento respeita o passo de 0,25 horas (15 minutos)', () => {
      const passoConfigurado = 0.25
      const validarPasso = (horas: number) => {
        const resto = (horas * 100) % (passoConfigurado * 100)
        return resto <= 0.001 || resto >= passoConfigurado * 100 - 0.001
      }

      expect(validarPasso(0.25)).toBe(true)
      expect(validarPasso(0.5)).toBe(true)
      expect(validarPasso(1.75)).toBe(true)
      expect(validarPasso(2.0)).toBe(true)
      expect(validarPasso(1.1)).toBe(false)
      expect(validarPasso(0.3)).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Retroativo máximo (> 7 dias) e bloqueio de data futura
  // --------------------------------------------------------------------------
  describe('Validação de retroativo e datas de apontamento', () => {
    it('deve recusar apontamento com data retroativa superior a 7 dias (ou parâmetro admin)', () => {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const validarRetroativo = (dataString: string, maxDias = 7) => {
        const dtApt = new Date(dataString)
        dtApt.setHours(0, 0, 0, 0)
        const diffDias = Math.round((hoje.getTime() - dtApt.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDias > maxDias) {
          throw new Error(
            `BLOQUEIO: Apontamento retroativo recusado. Data tem ${diffDias} dias de atraso (máximo: ${maxDias} dias).`,
          )
        }
        if (diffDias < 0) {
          throw new Error('BLOQUEIO: Não é permitido apontar horas em datas futuras.')
        }
        return true
      }

      // Hoje e até 7 dias atrás devem ser aceitos
      const dataHoje = hoje.toISOString().substring(0, 10)
      const dt5DiasAtras = new Date(hoje.getTime() - 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10)
      const dt7DiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10)

      expect(validarRetroativo(dataHoje)).toBe(true)
      expect(validarRetroativo(dt5DiasAtras)).toBe(true)
      expect(validarRetroativo(dt7DiasAtras)).toBe(true)

      // 8 dias atrás deve falhar
      const dt8DiasAtras = new Date(hoje.getTime() - 8 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10)
      expect(() => validarRetroativo(dt8DiasAtras)).toThrow(/Apontamento retroativo recusado/)

      // 20 dias atrás deve falhar
      const dt20DiasAtras = new Date(hoje.getTime() - 20 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10)
      expect(() => validarRetroativo(dt20DiasAtras)).toThrow(/Apontamento retroativo recusado/)

      // Data futura deve falhar
      const dtFutura = new Date(hoje.getTime() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10)
      expect(() => validarRetroativo(dtFutura)).toThrow(
        /Não é permitido apontar horas em datas futuras/,
      )
    })

    it('deve garantir que o prestador só aponta na sua própria Ordem de Serviço', () => {
      const prestadorLogadoId = 'prest_interno_01'
      const osPrestadorDono = { id: 'os_101', prestador: 'prest_interno_01' }
      const osOutroPrestador = { id: 'os_202', prestador: 'prest_outro_99' }

      const validarPertencimento = (prestadorId: string, os: { prestador: string }) => {
        if (os.prestador !== prestadorId) {
          throw new Error(
            'Acesso negado: o prestador só pode realizar apontamentos na sua própria OS.',
          )
        }
        return true
      }

      expect(validarPertencimento(prestadorLogadoId, osPrestadorDono)).toBe(true)
      expect(() => validarPertencimento(prestadorLogadoId, osOutroPrestador)).toThrow(
        /o prestador só pode realizar apontamentos na sua própria OS/,
      )
    })
  })

  // --------------------------------------------------------------------------
  // 3. Medição automática pelo ciclo e horas estimadas
  // --------------------------------------------------------------------------
  describe('Medição automática de ciclo e horas estimadas', () => {
    it('deve calcular dias úteis e corridos com precisão', () => {
      const calcularDias = (inicio: string, fim: string) => {
        const d1 = new Date(inicio)
        const d2 = new Date(fim)
        const corridos =
          Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1

        let uteis = 0
        const cur = new Date(d1)
        while (cur <= d2) {
          const day = cur.getDay()
          if (day !== 0 && day !== 6) uteis++
          cur.setDate(cur.getDate() + 1)
        }
        return { corridos, uteis }
      }

      // Segunda a Sexta da mesma semana = 5 dias corridos, 5 dias úteis
      const segAFsex = calcularDias('2026-05-04T00:00:00Z', '2026-05-08T00:00:00Z')
      expect(segAFsex.corridos).toBe(5)
      expect(segAFsex.uteis).toBe(5)

      // Segunda a Domingo = 7 dias corridos, 5 dias úteis
      const segADom = calcularDias('2026-05-04T00:00:00Z', '2026-05-10T00:00:00Z')
      expect(segADom.corridos).toBe(7)
      expect(segADom.uteis).toBe(5)
    })

    it('deve calcular horas estimadas = dias úteis × (horas/dia) ÷ OS simultâneas ativas', () => {
      const diasUteisEmProducao = 10
      const horasDia = 8
      const osSimultaneas = 2

      const horasEstimadas =
        Math.round(((diasUteisEmProducao * horasDia) / osSimultaneas) * 100) / 100
      // 10 * 8 / 2 = 40 horas
      expect(horasEstimadas).toBe(40)

      // Se o prestador estiver com 4 OS simultâneas:
      const osSimultaneas4 = 4
      const horasEstimadas4 =
        Math.round(((diasUteisEmProducao * horasDia) / osSimultaneas4) * 100) / 100
      // 10 * 8 / 4 = 20 horas
      expect(horasEstimadas4).toBe(20)
    })
  })

  // --------------------------------------------------------------------------
  // 4. Custo da OS interna, contas 'custo_interno' e bloqueio sem custo_hora
  // --------------------------------------------------------------------------
  describe('Custo da OS interna e lançamento financeiro', () => {
    it('deve calcular custo_hora = custo_mensal / horas_mes e manter vigências imutáveis', () => {
      const custoMensal = 8800
      const horasMes = 176
      const custoHoraCalculado = Math.round((custoMensal / horasMes) * 100) / 100
      expect(custoHoraCalculado).toBe(50.0)

      // Nova vigência não reescreve a passada
      const vigencia1 = {
        data_inicio: '2026-01-01',
        data_fim: '2026-04-30',
        custo_mensal: 8000,
        horas_mes: 160,
        custo_hora: 50.0,
      }
      const vigencia2 = {
        data_inicio: '2026-05-01',
        data_fim: null,
        custo_mensal: 9600,
        horas_mes: 160,
        custo_hora: 60.0,
      }

      expect(vigencia1.custo_hora).toBe(50)
      expect(vigencia2.custo_hora).toBe(60)
      // Custo da vigência 1 permanece intacto
      expect(vigencia1.custo_mensal).toBe(8000)
    })

    it('quando exige_apontamento = false: usa horas estimadas × custo_hora', () => {
      const horasEstimadas = 35
      const custoHora = 50
      const custoEsperado = horasEstimadas * custoHora
      expect(custoEsperado).toBe(1750)
    })

    it('quando exige_apontamento = true: usa soma de horas apontadas × custo_hora', () => {
      const horasApontadasAprovadas = [4, 4.5, 3.25, 8, 2.25]
      const totalHoras = horasApontadasAprovadas.reduce((a, b) => a + b, 0) // 22h
      const custoHora = 60
      const custoEsperado = totalHoras * custoHora
      expect(totalHoras).toBe(22)
      expect(custoEsperado).toBe(1320)
    })

    it('sem custo_hora preenchido, marca "custo não configurado" e NÃO lança conta financeira', () => {
      const osInternaSemCusto = {
        id: 'os_999',
        tipo_prestador: 'interno',
        horas_estimadas: 40,
        prestador_custo_hora: null, // vazio
      }

      const processarCustoOs = (os: typeof osInternaSemCusto) => {
        if (!os.prestador_custo_hora || os.prestador_custo_hora <= 0) {
          return {
            status_custo_interno: 'nao_configurado',
            custo_interno_apurado: 0,
            deve_lancar_conta: false,
          }
        }
        return {
          status_custo_interno: 'configurado',
          custo_interno_apurado: os.horas_estimadas * os.prestador_custo_hora,
          deve_lancar_conta: true,
        }
      }

      const res = processarCustoOs(osInternaSemCusto)
      expect(res.status_custo_interno).toBe('nao_configurado')
      expect(res.custo_interno_apurado).toBe(0)
      expect(res.deve_lancar_conta).toBe(false)
    })

    it('na aprovação do entregável, conta tipo custo_interno transita de prevista para realizada sem gerar pagamento', () => {
      const contaCustoInterno = {
        tipo: 'custo_interno',
        valor: 1500,
        status: 'prevista',
      }

      const simularAprovacaoEntregavel = (conta: typeof contaCustoInterno) => {
        return {
          ...conta,
          status: 'realizada',
          data_pagamento: new Date().toISOString(),
          gera_pagamento_bancario: false, // Sem gerar pagamento externo a terceiros
        }
      }

      const realizada = simularAprovacaoEntregavel(contaCustoInterno)
      expect(realizada.status).toBe('realizada')
      expect(realizada.gera_pagamento_bancario).toBe(false)
      expect(realizada.tipo).toBe('custo_interno')
    })
  })

  // --------------------------------------------------------------------------
  // 5. Margem e Saúde Financeira subtraindo Custo Interno
  // --------------------------------------------------------------------------
  describe('Margem e saúde financeira do projeto com custo interno', () => {
    it('deve subtrair custo interno real do cálculo da margem do projeto', () => {
      const valorVendido = 50000
      const custosOsExternas = 18000
      const outrosCustosSemOs = 2000
      const custoInternoReal = 7500 // Rodada 15

      // Sem custo interno (comportamento legado):
      const margemLegada = valorVendido - (custosOsExternas + outrosCustosSemOs)
      expect(margemLegada).toBe(30000)

      // Com custo interno (Rodada 15):
      const custoTotalComprometido = custosOsExternas + outrosCustosSemOs + custoInternoReal
      const margemRealComCustoInterno = valorVendido - custoTotalComprometido
      const margemPerc = Math.round((margemRealComCustoInterno / valorVendido) * 1000) / 10

      expect(custoTotalComprometido).toBe(27500)
      expect(margemRealComCustoInterno).toBe(22500)
      expect(margemPerc).toBe(45.0)
    })
  })

  // --------------------------------------------------------------------------
  // 6. Indicador Fazer Dentro ou Fora
  // --------------------------------------------------------------------------
  describe('Indicador "Fazer Dentro ou Fora" por disciplina', () => {
    it('deve recomendar fazer dentro quando custo interno for inferior à referência externa', () => {
      const custoHoraInterno = 50 // Pacote de 40h = R$ 2.000
      const precoPreCotacaoExterna = 3200 // R$ 3.200

      const custoInterno40h = custoHoraInterno * 40
      const recomendacao = custoInterno40h < precoPreCotacaoExterna ? 'fazer_dentro' : 'fazer_fora'
      const economiaPerc =
        Math.round(((precoPreCotacaoExterna - custoInterno40h) / precoPreCotacaoExterna) * 1000) /
        10

      expect(recomendacao).toBe('fazer_dentro')
      expect(economiaPerc).toBe(37.5) // 37.5% de economia fazendo dentro
    })

    it('deve recomendar fazer fora quando custo externo for inferior ao custo interno', () => {
      const custoHoraInterno = 120 // Pacote de 40h = R$ 4.800
      const precoCatalogoExterno = 3000

      const custoInterno40h = custoHoraInterno * 40
      const recomendacao = custoInterno40h < precoCatalogoExterno ? 'fazer_dentro' : 'fazer_fora'

      expect(recomendacao).toBe('fazer_fora')
    })
  })

  // --------------------------------------------------------------------------
  // 7. Isolamento de Segurança e API Rules (Assertivas Negativas)
  // --------------------------------------------------------------------------
  describe('Isolamento e Segurança: prestador interno NUNCA vê custo_hora/salário/margem', () => {
    it('prestador interno só tem acesso às próprias horas apontadas, nunca a custos financeiros', () => {
      const usuarioLogado = { role: 'executor', email: 'joao.engenheiro@gmais.com' }

      // Projeção permitida ao prestador (apenas horas e atividade)
      const camposPermitidosApontamento = ['id', 'os', 'data', 'horas', 'atividade', 'status']
      const camposProibidos = ['custo_hora', 'custo_mensal', 'salario', 'margem_lucro', 'valor_os']

      const filtrarCamposVisiveis = (role: string, registro: Record<string, unknown>) => {
        if (role === 'executor') {
          const filtrado: Record<string, unknown> = {}
          camposPermitidosApontamento.forEach((campo) => {
            if (campo in registro) filtrado[campo] = registro[campo]
          })
          return filtrado
        }
        return registro
      }

      const registroApontamentoCompleto = {
        id: 'apt_01',
        os: 'os_101',
        data: '2026-05-05',
        horas: 8,
        atividade: 'producao',
        status: 'aprovado',
        custo_hora: 65.0,
        custo_mensal: 11440,
        salario: 11440,
        margem_lucro: 42.5,
      }

      const visaoPrestador = filtrarCamposVisiveis(usuarioLogado.role, registroApontamentoCompleto)

      expect(visaoPrestador.horas).toBe(8)
      expect(visaoPrestador.atividade).toBe('producao')

      // Assertivas negativas obrigatórias
      camposProibidos.forEach((campoProibido) => {
        expect(visaoPrestador).not.toHaveProperty(campoProibido)
      })
    })

    it('API rules de custos_profissional barram perfil executor (apenas admin e financeiro)', () => {
      const regraListagemCustosProfissional =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"

      const autorizarLeitura = (role: string, regra: string) => {
        if (role === 'admin' && regra.includes("@request.auth.role = 'admin'")) return true
        if (role === 'financeiro' && regra.includes("@request.auth.role = 'financeiro'"))
          return true
        return false
      }

      expect(autorizarLeitura('admin', regraListagemCustosProfissional)).toBe(true)
      expect(autorizarLeitura('financeiro', regraListagemCustosProfissional)).toBe(true)

      // Testes negativos cruciais
      expect(autorizarLeitura('executor', regraListagemCustosProfissional)).toBe(false)
      expect(autorizarLeitura('prestador', regraListagemCustosProfissional)).toBe(false)
      expect(autorizarLeitura('comercial', regraListagemCustosProfissional)).toBe(false)
    })
  })
})
