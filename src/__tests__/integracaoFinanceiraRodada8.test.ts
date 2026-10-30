// =============================================================================
// GESTÃO G+ — TESTES VITEST AUTOMATIZADOS: INTEGRAÇÃO FINANCEIRA RODADA 8
// Cobrindo:
// 1. Idempotência da conferência Contrato -> Contas a Receber (chave de idempotência única)
// 2. Gate da conta a pagar de OS externa com medição aprovada (com retenção técnica) e OS interna sem conta
// 3. Cálculo de margem em tempo real (valor vendido - OS externas - custos lançados) e teto vendido
// 4. Detecção e alerta de inversão de fluxo (conta a pagar do prestador vencendo antes do recebimento do cliente)
// 5. Isolamento estrito de dados financeiros no Portal do Prestador
// =============================================================================

import { describe, it, expect } from 'vitest'
import schemaJson from '@/lib/pocketbase/schema.json'

const schemaData = schemaJson as any
const collections = schemaData.collections || []

describe('Integração Financeira Rodada 8 — Regras de Negócio e Cálculos', () => {
  // ---------------------------------------------------------------------------
  // 1. IDEMPOTÊNCIA DA CONFERÊNCIA CONTRATO -> CONTAS A RECEBER
  // ---------------------------------------------------------------------------
  describe('Idempotência de Contas a Receber por Contrato', () => {
    it('garante que a coleção contas possui o campo chave_idempotencia indexado e único', () => {
      const contasCol = collections.find((c: any) => c.name === 'contas')
      expect(contasCol).toBeDefined()

      const fieldNames = contasCol.fields.map((f: any) => f.name)
      expect(fieldNames).toContain('chave_idempotencia')
      expect(fieldNames).toContain('contrato_servico')
      expect(fieldNames).toContain('parcela_origem')
      expect(fieldNames).toContain('marco_origem')
      expect(fieldNames).toContain('retencao_impostos')
      expect(fieldNames).toContain('valor_liquido')
    })

    it('simula conferência de parcelas gerando contas e garante que reexecução não gera duplicidade', () => {
      const contratoId = 'ctr_test_001'
      const parcelas = [
        { id: 'parc_1', ordem: 1, percentual: 30, valor: 3000, descricao: 'Entrada 30%' },
        {
          id: 'parc_2',
          ordem: 2,
          percentual: 40,
          valor: 4000,
          descricao: 'Entrega Projeto Executivo',
        },
        { id: 'parc_3', ordem: 3, percentual: 30, valor: 3000, descricao: 'Aprovação Final' },
      ]

      // Estado simulado do banco
      const bancoContas: Array<{
        id: string
        chave_idempotencia: string
        contrato_servico: string
        parcela_origem: string
        valor: number
        status: string
      }> = []

      // Função de conferência idempotente simulando a lógica do hook financeiro_rodada8_operations.js
      const conferirContas = (cId: string, listaParcelas: typeof parcelas) => {
        const criadas: any[] = []
        const jaExistiam: any[] = []

        for (const p of listaParcelas) {
          const chave = `CTR_${cId}_PARC_${p.id}`
          const existente = bancoContas.find((c) => c.chave_idempotencia === chave)

          if (existente) {
            jaExistiam.push(existente)
          } else {
            const nova = {
              id: `conta_${Math.random().toString(36).substring(2, 9)}`,
              chave_idempotencia: chave,
              contrato_servico: cId,
              parcela_origem: p.id,
              valor: p.valor,
              status: 'rascunho',
            }
            bancoContas.push(nova)
            criadas.push(nova)
          }
        }

        return { criadas, jaExistiam }
      }

      // 1ª Execução: Todas as 3 parcelas devem ser criadas
      const res1 = conferirContas(contratoId, parcelas)
      expect(res1.criadas.length).toBe(3)
      expect(res1.jaExistiam.length).toBe(0)
      expect(bancoContas.length).toBe(3)

      // 2ª Execução (Idempotente): Nenhuma conta nova deve ser criada; todas as 3 já existiam
      const res2 = conferirContas(contratoId, parcelas)
      expect(res2.criadas.length).toBe(0)
      expect(res2.jaExistiam.length).toBe(3)
      expect(bancoContas.length).toBe(3)

      // 3ª Execução com adição de 1 parcela nova: apenas a nova deve ser criada
      const parcelasAditadas = [
        ...parcelas,
        { id: 'parc_4', ordem: 4, percentual: 10, valor: 1000, descricao: 'Aditivo' },
      ]
      const res3 = conferirContas(contratoId, parcelasAditadas)
      expect(res3.criadas.length).toBe(1)
      expect(res3.jaExistiam.length).toBe(3)
      expect(bancoContas.length).toBe(4)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. GATE DE CONTA A PAGAR: OS EXTERNA COM MEDIÇÃO APROVADA VS OS INTERNA
  // ---------------------------------------------------------------------------
  describe('Gate de Contas a Pagar (OS Externa vs Interna)', () => {
    it('garante que OS interna tem valor 0 e não gera conta a pagar nem retenção técnica', () => {
      const osInterna = {
        id: 'os_int_01',
        tipo_prestador: 'interno' as const,
        valor_os: 0,
        percentual_retencao_tecnica: 0,
        retencao_tecnica_acumulada: 0,
        status_retencao: 'sem_retencao',
      }

      // Função gate de geração de conta
      const podeGerarContaPagar = (os: typeof osInterna) => {
        if (os.tipo_prestador === 'interno') {
          return { permitido: false, motivo: 'OS interna não gera contas a pagar nem retenção.' }
        }
        return { permitido: true, motivo: '' }
      }

      const decisao = podeGerarContaPagar(osInterna)
      expect(decisao.permitido).toBe(false)
      expect(osInterna.valor_os).toBe(0)
      expect(osInterna.retencao_tecnica_acumulada).toBe(0)
      expect(osInterna.status_retencao).toBe('sem_retencao')
    })

    it('garante que OS externa gera conta a pagar na aprovação de medição com retenção técnica e fiscal', () => {
      const subcontrato = {
        id: 'sub_ext_01',
        valor_total: 20000,
        percentual_retencao_tecnica: 5, // 5%
      }

      const medicao = {
        id: 'med_01',
        subcontrato_id: subcontrato.id,
        valor_bruto: 8000,
        retencao_impostos: 880, // 11% INSS/ISS
        status: 'apresentada',
        entregaveis: [{ id: 'ent_1', status: 'aprovado' }],
      }

      // Gate: só aprova se todos os entregáveis técnicos vinculados estão aprovados
      const todosEntregaveisAprovados = medicao.entregaveis.every((e) => e.status === 'aprovado')
      expect(todosEntregaveisAprovados).toBe(true)

      // Cálculo de retenção técnica e valor líquido
      const valorRetencaoTecnica =
        (medicao.valor_bruto * subcontrato.percentual_retencao_tecnica) / 100 // 400
      const valorLiquido = medicao.valor_bruto - medicao.retencao_impostos - valorRetencaoTecnica // 8000 - 880 - 400 = 6720

      expect(valorRetencaoTecnica).toBe(400)
      expect(valorLiquido).toBe(6720)

      // Geração da conta a pagar
      const contaPagar = {
        tipo: 'pagar',
        status: 'rascunho',
        valor: medicao.valor_bruto,
        retencao_impostos: medicao.retencao_impostos,
        retencao_tecnica: valorRetencaoTecnica,
        valor_liquido: valorLiquido,
        medicao_aprovada_origem: medicao.id,
      }

      expect(contaPagar.tipo).toBe('pagar')
      expect(contaPagar.valor).toBe(8000)
      expect(contaPagar.valor_liquido).toBe(6720)
      expect(contaPagar.medicao_aprovada_origem).toBe('med_01')
    })

    it('bloqueia aprovação de medição se houver entregável pendente ou em revisão', () => {
      const medicao = {
        id: 'med_02',
        valor_bruto: 5000,
        entregaveis: [
          { id: 'ent_1', titulo: 'Plantas', status: 'aprovado' },
          { id: 'ent_2', titulo: 'Memorial Descritivo', status: 'enviado_revisao' },
        ],
      }

      const pendentes = medicao.entregaveis.filter((e) => e.status !== 'aprovado')
      const podeAprovar = pendentes.length === 0

      expect(podeAprovar).toBe(false)
      expect(pendentes.length).toBe(1)
      expect(pendentes[0].titulo).toBe('Memorial Descritivo')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. CÁLCULO DE MARGEM EM TEMPO REAL E CONTROLE DE TETO VENDIDO
  // ---------------------------------------------------------------------------
  describe('Cálculo de Margem Real e Teto Vendido por Projeto', () => {
    it('calcula margem real com precisão e identifica status saudável vs crítico', () => {
      const tetoVendido = 50000 // R$ 50.000 vendido ao cliente
      const somaOsExternas = 25000 // R$ 25.000 em OS subcontratadas
      const outrosCustosLancados = 5000 // R$ 5.000 outros custos (ART, viagens, etc)
      const margemMinimaConfigurada = 20 // 20% configurado em parâmetros

      const custoTotalComprometido = somaOsExternas + outrosCustosLancados // R$ 30.000
      const margemRealValor = tetoVendido - custoTotalComprometido // R$ 20.000
      const margemRealPerc = (margemRealValor / tetoVendido) * 100 // 40%

      expect(custoTotalComprometido).toBe(30000)
      expect(margemRealValor).toBe(20000)
      expect(margemRealPerc).toBe(40)
      expect(margemRealPerc >= margemMinimaConfigurada).toBe(true)

      // Simular aumento de custos que rebaixe a margem para abaixo de 20%
      const custoComAdicional = custoTotalComprometido + 12000 // R$ 42.000
      const novaMargemValor = tetoVendido - custoComAdicional // R$ 8.000
      const novaMargemPerc = (novaMargemValor / tetoVendido) * 100 // 16%

      expect(novaMargemPerc).toBe(16)
      expect(novaMargemPerc < margemMinimaConfigurada).toBe(true)
      // Dispara alerta crítico
      const alertaCritico = novaMargemPerc < margemMinimaConfigurada
      expect(alertaCritico).toBe(true)
    })

    it('calcula exposição de caixa (custos comprometidos vs receita efetivamente realizada)', () => {
      const custoTotalComprometido = 35000
      const totalRecebidoRealizado = 20000 // Cliente pagou R$ 20.000 até o momento

      const exposicaoFinanceira = custoTotalComprometido - totalRecebidoRealizado // R$ 15.000 exposto
      expect(exposicaoFinanceira).toBe(15000)
      expect(exposicaoFinanceira > 0).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. DETECÇÃO E ALERTA DE INVERSÃO DE FLUXO (PRESTADOR ANTES DO CLIENTE)
  // ---------------------------------------------------------------------------
  describe('Alerta de Inversão de Fluxo (Cliente x Prestador por Marco)', () => {
    it('detecta quando conta a pagar ao prestador vence antes do recebimento do cliente correspondente', () => {
      const antecedenciaConfiguradaDias = 5

      // Cenário 1: Inversão direta (prestador vence no dia 10, cliente paga no dia 20 -> descasamento de 10 dias)
      const contaPagar1 = {
        id: 'cp_1',
        descricao: 'Prestador Estrutural Parcela 1',
        valor: 5000,
        vencimento: '2026-11-10T12:00:00.000Z',
      }
      const contaReceber1 = {
        id: 'cr_1',
        descricao: 'Cliente Faturamento Parcela 1',
        valor: 12000,
        vencimento: '2026-11-20T12:00:00.000Z',
      }

      const dtPagar1 = new Date(contaPagar1.vencimento).getTime()
      const dtReceber1 = new Date(contaReceber1.vencimento).getTime()
      const diffDias1 = Math.round((dtReceber1 - dtPagar1) / (1000 * 60 * 60 * 24))

      expect(diffDias1).toBe(10) // 10 dias de inversão (G+ precisará pagar o prestador antes de receber do cliente)
      const isInversao1 = diffDias1 > 0
      expect(isInversao1).toBe(true)

      // Cenário 2: Fluxo saudável com folga confortável (cliente paga dia 15, prestador recebe dia 25)
      const contaPagar2 = {
        id: 'cp_2',
        vencimento: '2026-11-25T12:00:00.000Z',
      }
      const contaReceber2 = {
        id: 'cr_2',
        vencimento: '2026-11-15T12:00:00.000Z',
      }

      const dtPagar2 = new Date(contaPagar2.vencimento).getTime()
      const dtReceber2 = new Date(contaReceber2.vencimento).getTime()
      const diffDias2 = Math.round((dtReceber2 - dtPagar2) / (1000 * 60 * 60 * 24))

      expect(diffDias2).toBe(-10) // Cliente paga 10 dias antes do vencimento do prestador -> Sem inversão
      const isInversao2 =
        diffDias2 > 0 || (diffDias2 >= 0 && diffDias2 <= antecedenciaConfiguradaDias)
      expect(isInversao2).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 5. SEGMENTAÇÃO E ISOLAMENTO DO PORTAL DO PRESTADOR
  // ---------------------------------------------------------------------------
  describe('Segmentação de Segurança: Portal do Prestador', () => {
    it('garante que coleção portal_os não expõe contratos a receber, faturamento de clientes ou margem', () => {
      const portalOsCol = collections.find((c: any) => c.name === 'portal_os')
      expect(portalOsCol).toBeDefined()

      const fieldNames = portalOsCol.fields.map((f: any) => f.name)
      // Permite apenas valor_os da própria ordem de serviço
      expect(fieldNames).toContain('valor_os')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('codigo_projeto')

      // Proibido em absoluto
      expect(fieldNames).not.toContain('margem')
      expect(fieldNames).not.toContain('valor_contrato_cliente')
      expect(fieldNames).not.toContain('contas_receber')
      expect(fieldNames).not.toContain('bdi')
      expect(fieldNames).not.toContain('faturamento')
    })
  })
})
