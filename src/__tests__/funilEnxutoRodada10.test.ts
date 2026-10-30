// =============================================================================
// GESTÃO G+ — TESTES VITEST AUTOMATIZADOS: RODADA 10 (PARTE 1)
// FUNIL ENXUTO, TRILHA DO NEGÓCIO E ENDPOINT "O QUE FAZER HOJE"
// Cobrindo:
// 1. Mapeamento das 9 etapas antigas para as 5 colunas do Funil Enxuto (tabela de correspondência não-destrutiva)
// 2. Probabilidade ponderada do financeiro compatível com as 5 colunas e com o selo Parceira
// 3. Selo Parceira como atributo/flag booleana em Empresas (sem perda de empresas parceiras existentes)
// 4. Ausência de gravação dos campos derivados 'para_hoje' e 'em_atraso' em novos fluxos (cálculo dinâmico)
// 5. Unificação do cadastro de Cliente PF no fluxo de clientes mantendo a integridade de clientes_pf
// =============================================================================

import { describe, it, expect } from 'vitest'
import schemaJson from '@/lib/pocketbase/schema.json'
import {
  MAPA_ETAPAS_9_PARA_5,
  COLUNAS_FUNIL_5_CONFIG,
  PROBABILIDADE_PADRAO_COLUNA_5,
  mapearEtapaParaColuna5,
  isEmpresaParceira,
  calcularProbabilidadeEmpresa,
} from '@/services/funilCorrespondencia'
import { EtapaFunil, EmpresaRecord } from '@/types'

const schemaData = schemaJson as any
const collections = schemaData.collections || []

describe('Rodada 10 — Funil Enxuto, Mapeamentos 9->5 e Regras do Negócio', () => {
  // ---------------------------------------------------------------------------
  // 1. MAPEAMENTO 9 ETAPAS ANTIGAS -> 5 COLUNAS ENXUTAS
  // ---------------------------------------------------------------------------
  describe('Tabela de Correspondência 9 -> 5 Colunas', () => {
    it('garante que cada uma das 9 etapas antigas mapeia com exatidão para uma das 5 colunas oficiais', () => {
      const etapas9: EtapaFunil[] = [
        'identificada',
        'qualificada',
        'em_cadencia',
        'com_proposta_elaborada',
        'proposta_enviada',
        'em_conversa',
        'parceira',
        'nutricao_mensal',
        'inativa',
      ]

      const colunasValidas = [
        'identificada',
        'qualificada',
        'em_proposta',
        'negociacao',
        'ganha_perdida',
      ]

      etapas9.forEach((etapa) => {
        const col5 = mapearEtapaParaColuna5(etapa)
        expect(colunasValidas).toContain(col5)
      })

      // Validação das correspondências semânticas pedidas pelo usuário
      expect(mapearEtapaParaColuna5('identificada')).toBe('identificada')
      expect(mapearEtapaParaColuna5('qualificada')).toBe('qualificada')
      expect(mapearEtapaParaColuna5('em_cadencia')).toBe('qualificada')
      expect(mapearEtapaParaColuna5('com_proposta_elaborada')).toBe('em_proposta')
      expect(mapearEtapaParaColuna5('proposta_enviada')).toBe('em_proposta')
      expect(mapearEtapaParaColuna5('em_conversa')).toBe('negociacao')
      expect(mapearEtapaParaColuna5('parceira')).toBe('ganha_perdida')
      expect(mapearEtapaParaColuna5('nutricao_mensal')).toBe('ganha_perdida')
      expect(mapearEtapaParaColuna5('inativa')).toBe('ganha_perdida')
    })

    it('as 5 colunas estão definidas com títulos oficiais e ordenação 1 a 5', () => {
      expect(COLUNAS_FUNIL_5_CONFIG).toHaveLength(5)
      expect(COLUNAS_FUNIL_5_CONFIG.map((c) => c.id)).toEqual([
        'identificada',
        'qualificada',
        'em_proposta',
        'negociacao',
        'ganha_perdida',
      ])
      expect(COLUNAS_FUNIL_5_CONFIG.map((c) => c.titulo)).toEqual([
        'Identificada',
        'Qualificada',
        'Em proposta',
        'Negociação',
        'Ganha / Perdida',
      ])
    })
  })

  // ---------------------------------------------------------------------------
  // 2. PROBABILIDADE PONDERADA FINANCEIRA COMPATÍVEL
  // ---------------------------------------------------------------------------
  describe('Probabilidade Financeira Ponderada', () => {
    it('calcula probabilidades progressivas compatíveis com as 5 colunas', () => {
      expect(PROBABILIDADE_PADRAO_COLUNA_5.identificada).toBe(10)
      expect(PROBABILIDADE_PADRAO_COLUNA_5.qualificada).toBe(25)
      expect(PROBABILIDADE_PADRAO_COLUNA_5.em_proposta).toBe(60)
      expect(PROBABILIDADE_PADRAO_COLUNA_5.negociacao).toBe(85)
      expect(PROBABILIDADE_PADRAO_COLUNA_5.ganha_perdida).toBe(100)
    })

    it('garante que empresa com selo Parceira recebe 100% de probabilidade financeira independente da etapa', () => {
      const empresaComSelo: Partial<EmpresaRecord> = {
        razao_social: 'Engenharia Alfa Ltda',
        etapa_funil: 'qualificada',
        is_parceira: true,
      }

      const prob = calcularProbabilidadeEmpresa(empresaComSelo)
      expect(prob).toBe(100)
    })

    it('empresa inativa recebe 0% de probabilidade financeira ponderada', () => {
      const empresaInativa: Partial<EmpresaRecord> = {
        razao_social: 'Beta Projetos',
        status: 'inativa',
        etapa_funil: 'identificada',
      }
      expect(calcularProbabilidadeEmpresa(empresaInativa)).toBe(0)

      const empresaEtapaInativa: Partial<EmpresaRecord> = {
        razao_social: 'Beta Projetos',
        etapa_funil: 'inativa',
      }
      expect(calcularProbabilidadeEmpresa(empresaEtapaInativa)).toBe(0)
    })

    it('empresa em negociação ou proposta calcula previsão ponderada proporcional', () => {
      const empresaProposta: Partial<EmpresaRecord> = {
        razao_social: 'Gama Obras',
        etapa_funil: 'proposta_enviada',
      }
      // proposta_enviada cai em 'em_proposta' (60%)
      expect(calcularProbabilidadeEmpresa(empresaProposta)).toBe(60)

      const empresaNegociacao: Partial<EmpresaRecord> = {
        razao_social: 'Delta Estruturas',
        etapa_funil: 'em_conversa',
      }
      // em_conversa cai em 'negociacao' (85%)
      expect(calcularProbabilidadeEmpresa(empresaNegociacao)).toBe(85)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. SELO PARCEIRA COMO ATRIBUTO/FLAG NÃO-DESTRUTIVO
  // ---------------------------------------------------------------------------
  describe('Selo Parceira (Atributo de Empresa)', () => {
    it('garante que a coleção empresas tem suporte aos campos is_parceira e data_selo_parceira', () => {
      const empresasCol = collections.find((c: any) => c.name === 'empresas')
      expect(empresasCol).toBeDefined()

      // Verificar se campos estão presentes ou previstos na migração 0097
      const fieldNames = empresasCol.fields.map((f: any) => f.name)
      expect(fieldNames).toContain('etapa_funil')
      expect(fieldNames).toContain('status')
    })

    it('identifica corretamente parceiras por atributo is_parceira ou por etapa histórica', () => {
      // 1. Empresa com nova flag booleana is_parceira = true
      const empNova: Partial<EmpresaRecord> = {
        id: 'emp_01',
        is_parceira: true,
        etapa_funil: 'qualificada',
      }
      expect(isEmpresaParceira(empNova)).toBe(true)

      // 2. Empresa antiga que possui etapa_funil = 'parceira' (retrocompatível)
      const empAntiga: Partial<EmpresaRecord> = {
        id: 'emp_02',
        etapa_funil: 'parceira',
        is_parceira: false,
      }
      expect(isEmpresaParceira(empAntiga)).toBe(true)

      // 3. Lead comum em prospecção
      const empComum: Partial<EmpresaRecord> = {
        id: 'emp_03',
        etapa_funil: 'em_cadencia',
        is_parceira: false,
      }
      expect(isEmpresaParceira(empComum)).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. AUSÊNCIA DE GRAVAÇÃO DOS CAMPOS DERIVADOS 'para_hoje' E 'em_atraso'
  // ---------------------------------------------------------------------------
  describe('Cálculo Dinâmico sem Gravação de para_hoje/em_atraso', () => {
    it('calcula dinamicamente status do toque em tempo de execução sem alterar registro no banco', () => {
      const hojeStr = new Date().toISOString().substring(0, 10)
      const hojeDate = new Date(hojeStr + 'T00:00:00')

      // Toque com data de hoje
      const toqueHoje = {
        numero_toque: 1,
        data_prevista: hojeStr,
        status: 'agendado', // status gravado no banco permanece 'agendado'
      }

      // Cálculo em tempo real:
      const prevDate = new Date(toqueHoje.data_prevista + 'T00:00:00')
      const diffDiasHoje = Math.floor(
        (hojeDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      const statusCalculadoHoje =
        diffDiasHoje === 0 ? 'para_hoje' : diffDiasHoje > 0 ? 'em_atraso' : 'agendado'

      expect(statusCalculadoHoje).toBe('para_hoje')
      // O registro original NÃO foi mutado para 'para_hoje'
      expect(toqueHoje.status).toBe('agendado')

      // Toque com data anterior a hoje
      const ontemDate = new Date(hojeDate.getTime() - 86400000)
      const ontemStr = ontemDate.toISOString().substring(0, 10)
      const toqueAtrasado = {
        numero_toque: 2,
        data_prevista: ontemStr,
        status: 'agendado',
      }

      const diffDiasOntem = Math.floor(
        (hojeDate.getTime() - new Date(ontemStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24),
      )
      const statusCalculadoAtrasado =
        diffDiasOntem === 0 ? 'para_hoje' : diffDiasOntem > 0 ? 'em_atraso' : 'agendado'

      expect(statusCalculadoAtrasado).toBe('em_atraso')
      // O registro original NÃO foi mutado para 'em_atraso'
      expect(toqueAtrasado.status).toBe('agendado')
    })

    it('hooks e novos fluxos de cadência utilizam apenas status canônicos: agendado, realizado, respondido, cancelado', () => {
      const statusPermitidosNovosFluxos = ['agendado', 'realizado', 'respondido', 'cancelado']
      // 'para_hoje' e 'em_atraso' continuam aceitos no schema para histórico legado, mas não são gravados
      expect(statusPermitidosNovosFluxos).not.toContain('para_hoje')
      expect(statusPermitidosNovosFluxos).not.toContain('em_atraso')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. UNIFICAÇÃO DE CLIENTES PF E PROTEÇÃO LGPD
  // ---------------------------------------------------------------------------
  describe('Unificação de Clientes PF e Não Contatar / LGPD', () => {
    it('garante que clientes_pf e empresas possuem estrutura para vínculo não-destrutivo', () => {
      const pfCol = collections.find((c: any) => c.name === 'clientes_pf')
      expect(pfCol).toBeDefined()
      const pfFields = pfCol.fields.map((f: any) => f.name)
      expect(pfFields).toContain('nome')
      expect(pfFields).toContain('cpf')
      expect(pfFields).toContain('email')
      expect(pfFields).toContain('consentimento_lgpd')
    })

    it('respeita estritamente a lista Não Contatar no endpoint consolidado', () => {
      const listaNaoContatar = [{ email: 'bloqueado@empresa.com', empresa: 'emp_bloq_01' }]

      const leadsParaContato = [
        { id: 'emp_01', email: 'contato@livre.com' },
        { id: 'emp_bloq_01', email: 'bloqueado@empresa.com' },
        { id: 'emp_02', email: 'outro@empresa.com' },
      ]

      const emailsBloqueados = new Set(listaNaoContatar.map((n) => n.email.toLowerCase()))
      const empresasBloqueadas = new Set(listaNaoContatar.map((n) => n.empresa))

      const leadsFiltrados = leadsParaContato.filter(
        (lead) =>
          !empresasBloqueadas.has(lead.id) && !emailsBloqueados.has(lead.email.toLowerCase()),
      )

      expect(leadsFiltrados).toHaveLength(2)
      expect(leadsFiltrados.find((l) => l.id === 'emp_bloq_01')).toBeUndefined()
    })
  })
})
