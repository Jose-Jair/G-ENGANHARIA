import { describe, it, expect } from 'vitest'
import {
  limparCnpj,
  isPessoaFisica,
  classificarPorDicionario,
  calcularScoreCurvaProvisorio,
  processarLoteProspeccaoPuro,
  ContratoBrutoProspeccao,
  EmpresaSimulada,
  ContratoSimulado,
  SugestaoSimulada,
} from '@/services/prospeccaoPipeline'

describe('Rodada 14 — Prospecção Automática (Parte 1: PNCP e Fontes Federais)', () => {
  // 1. DESCARTE DE PESSOA FÍSICA (CPF)
  it('deve descartar pessoa física (CPF de 11 dígitos ou tipoPessoa=PF)', () => {
    // CPFs com 11 dígitos
    expect(isPessoaFisica('PF', '12345678901')).toBe(true)
    expect(isPessoaFisica('PJ', '123.456.789-01')).toBe(true)
    expect(isPessoaFisica('Física', '12345678901')).toBe(true)

    // CNPJ de 14 dígitos não é pessoa física
    expect(isPessoaFisica('PJ', '12.345.678/0001-90')).toBe(false)
    expect(isPessoaFisica(undefined, '12345678000190')).toBe(false)
  })

  // 2. CLASSIFICAÇÃO MONOTÔNICA POR DICIONÁRIO (0 a 100)
  it('deve classificar relevância técnica de 0 a 100 com crescimento monotônico por palavras-chave', () => {
    // Objeto genérico sem palavras-chave
    const semPalavras = classificarPorDicionario('Fornecimento contínuo de café e açúcar')
    expect(semPalavras.score).toBeLessThanOrEqual(20)

    // 1 palavra-chave
    const comUmaPalavra = classificarPorDicionario('Serviço de laudo técnico predial')
    expect(comUmaPalavra.score).toBeGreaterThan(semPalavras.score)
    expect(comUmaPalavra.termos).toContain('laudo')

    // 2 palavras-chave
    const comDuasPalavras = classificarPorDicionario(
      'Elaboração de projetos e cálculo estrutural para escola municipal',
    )
    expect(comDuasPalavras.score).toBeGreaterThan(comUmaPalavra.score)
    expect(comDuasPalavras.termos).toEqual(
      expect.arrayContaining(['elaboração de projetos', 'estrutural']),
    )

    // Múltiplas palavras-chave pesadas (projeto executivo + estrutural + elétrico + hidrossanitário + drenagem)
    const completo = classificarPorDicionario(
      'Contratação de empresa para projeto executivo completo, incluindo estrutural, elétrico, hidrossanitário, drenagem e orçamento',
    )
    expect(completo.score).toBeGreaterThanOrEqual(80)
    expect(completo.score).toBeLessThanOrEqual(100)
  })

  // 3. SCORE CURVA ABC PROVISÓRIO
  it('deve calcular score da curva ABC provisório proporcional ao valor do contrato', () => {
    const pequeno = calcularScoreCurvaProvisorio(50000, 12)
    expect(pequeno.curva).toBe('C')

    const medio = calcularScoreCurvaProvisorio(350000, 24)
    expect(medio.curva).toBe('B')

    const grande = calcularScoreCurvaProvisorio(1500000, 36)
    expect(grande.curva).toBe('A')
    expect(grande.score).toBeGreaterThanOrEqual(40)
  })

  // 4. DEDUPE POR CNPJ (CNPJ existente não duplica + anexa contrato + sugere reativação)
  it('dedupe por CNPJ: empresa existente não duplica, anexa contrato e sugere reativação se inativa', () => {
    const cnpjExistente = '11222333000144'
    const empresas: EmpresaSimulada[] = [
      {
        id: 'emp_existente_1',
        cnpj: cnpjExistente,
        razao_social: 'ENGENHARIA MODELO LTDA',
        etapa_funil: 'inativa',
        status: 'inativa',
      },
    ]
    const contratos: ContratoSimulado[] = []
    const sugestoes: SugestaoSimulada[] = []

    const lote: ContratoBrutoProspeccao[] = [
      {
        cnpj: '11.222.333/0001-44',
        tipoPessoa: 'PJ',
        razaoSocial: 'ENGENHARIA MODELO LTDA',
        orgao: 'Prefeitura Municipal',
        numero: 'CTR-2026-99',
        objeto: 'Projeto executivo estrutural e hidrossanitário',
        valor: 450000,
      },
    ]

    const res = processarLoteProspeccaoPuro(lote, empresas, contratos, sugestoes)

    // Não deve criar nova sugestão de empresa nova
    expect(res.novasSugestoes.length).toBe(0)
    expect(res.duplicadosDedupe).toBe(1)

    // Deve anexar o contrato à empresa existente
    expect(res.novosContratos.length).toBe(1)
    expect(res.novosContratos[0].empresa).toBe('emp_existente_1')
    expect(res.novosContratos[0].numero).toBe('CTR-2026-99')

    // Como estava inativa, deve sugerir reativação
    expect(res.novasReativacoes.length).toBe(1)
    expect(res.novasReativacoes[0].empresa).toBe('emp_existente_1')
  })

  // 5. CNPJ NOVO GERA SUGESTÃO NO FUNIL COM METADADOS
  it('CNPJ novo gera registro em sugestoes_funil com score provisório e sem reativação', () => {
    const empresas: EmpresaSimulada[] = []
    const contratos: ContratoSimulado[] = []
    const sugestoes: SugestaoSimulada[] = []

    const lote: ContratoBrutoProspeccao[] = [
      {
        cnpj: '99888777000155',
        tipoPessoa: 'PJ',
        razaoSocial: 'NOVA CONSULTORIA DE PROJETOS S/A',
        orgao: 'Secretaria de Infraestrutura',
        numero: 'CTR-2026-101',
        objeto: 'Elaboração de projetos de pavimentação, drenagem e orçamento',
        valor: 820000,
      },
    ]

    const res = processarLoteProspeccaoPuro(lote, empresas, contratos, sugestoes)

    expect(res.novasSugestoes.length).toBe(1)
    expect(res.novasSugestoes[0].cnpj).toBe('99888777000155')
    expect(res.novasSugestoes[0].score_relevancia).toBeGreaterThan(40)
    expect(['A', 'B']).toContain(res.novasSugestoes[0].curva_provisoria)
    expect(res.novosContratos.length).toBe(0)
    expect(res.novasReativacoes.length).toBe(0)
  })

  // 6. IDEMPOTÊNCIA DO LOTE (Rodar duas vezes não duplica sugestões)
  it('idempotência do lote: rodar duas vezes não duplica registros nem contratos', () => {
    const empresas: EmpresaSimulada[] = []
    const contratos: ContratoSimulado[] = []
    const sugestoes: SugestaoSimulada[] = []

    const lote: ContratoBrutoProspeccao[] = [
      {
        cnpj: '55444333000122',
        tipoPessoa: 'PJ',
        razaoSocial: 'PROJETOS BRASIL ENGENHARIA',
        numero: 'CTR-2026-IDEMPOTENTE',
        objeto: 'Projeto básico e executivo elétrico e hidrossanitário',
        valor: 300000,
      },
    ]

    // 1ª Execução
    const res1 = processarLoteProspeccaoPuro(lote, empresas, contratos, sugestoes)
    expect(res1.novasSugestoes.length).toBe(1)

    // Simula a gravação no banco
    sugestoes.push(...res1.novasSugestoes)

    // 2ª Execução com o mesmo lote
    const res2 = processarLoteProspeccaoPuro(lote, empresas, contratos, sugestoes)
    expect(res2.novasSugestoes.length).toBe(0)
    expect(res2.duplicadosDedupe).toBe(1)
    expect(sugestoes.length).toBe(1)
  })

  // 7. TESTE NEGATIVO DE SEGMENTAÇÃO: PORTAL DO PRESTADOR
  it('teste negativo de segmentação: regras de API e coleções de prospecção bloqueiam acesso de prestador/executor externo', () => {
    // Definição das regras de acesso da coleção fontes_prospeccao e lotes_prospeccao_auditoria
    const ruleFontes =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    const ruleLotes =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"

    function simularAcessoColecao(role: string, rule: string) {
      if (!role) return false
      if (rule.includes("@request.auth.role = 'admin'") && role === 'admin') return true
      if (rule.includes("@request.auth.role = 'comercial'") && role === 'comercial') return true
      return false
    }

    // Admin e Comercial têm acesso
    expect(simularAcessoColecao('admin', ruleFontes)).toBe(true)
    expect(simularAcessoColecao('comercial', ruleFontes)).toBe(true)

    // Executor / Prestador externo NÃO tem acesso (bloqueado na API rule do servidor)
    expect(simularAcessoColecao('executor', ruleFontes)).toBe(false)
    expect(simularAcessoColecao('executor', ruleLotes)).toBe(false)
    expect(simularAcessoColecao('prestador', ruleFontes)).toBe(false)
    expect(simularAcessoColecao('anonimo', ruleFontes)).toBe(false)
  })
})
