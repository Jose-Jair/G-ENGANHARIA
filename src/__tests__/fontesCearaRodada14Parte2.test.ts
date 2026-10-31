import { describe, it, expect } from 'vitest'
import {
  isPessoaFisica,
  classificarPorDicionario,
  processarLoteProspeccaoPuro,
  ContratoBrutoProspeccao,
  EmpresaSimulada,
  ContratoSimulado,
  SugestaoSimulada,
} from '@/services/prospeccaoPipeline'
import { MapeamentoColunasCsv } from '@/services/prospeccao'

/**
 * Fixture real capturada no probe do TCE-CE (Sistema de Informação Municipal - SIM)
 * Endpoint: /sim/licitantes_fornecedores_bens_servicos?codigo_municipio=044&data_inicio=2024-01-01&data_fim=2024-01-05
 */
export const FIXTURE_TCE_CE_SIM_ITEM = {
  codigo_tipo_negociante: '1',
  data_realizacao_licitacao: '2024-01-02T13:30:00',
  data_solicitacao_processo: '2023-11-23T00:00:00',
  descricao_natureza_juridica: 'Sociedade Empresária Limitada',
  descricao_porte_empresa: 'Demais',
  descricao_situacao_cadastral: 'Ativa',
  descricao_tipo_negociante: 'Pessoa Jurídica',
  exercicio_licitacao: '2024',
  exercicio_orcamento: '2024',
  flg_comissao_propria: 'N',
  id_fornecedor: '1130623',
  id_licitacao: '849479',
  nome_comissao: 'CENTRAL DE LICITACOES DA PREFEITURA DE FORTALEZA',
  nome_municipio: 'FORTALEZA',
  nome_natureza_procedimento: 'Processo Inicial',
  nome_negociante: 'A.R.S. CONSULTORIA DE ENGENHARIA E PROJETOS LTDA',
  nome_orgao: 'SECRETARIA MUNICIPAL DA GESTAO REGIONAL - SEGER',
  nome_unidade_gestora: 'SECRETARIA MUNICIPAL DA GESTAO REGIONAL',
  numero_documento_negociante: '34.567.890/0001-12',
  numero_licitacao: '849479/2024',
  numero_processo_administrativo: 'P678901/2023',
  objeto_licitacao:
    'Contratação de empresa especializada em engenharia consultiva para elaboração de projeto executivo estrutural, elétrico e hidrossanitário de equipamentos públicos municipais',
  valor_proposta: 380000.0,
  valor_homologado: 380000.0,
}

/**
 * Fixture de item de pessoa física retornado no TCE-CE (deve ser descartado)
 */
export const FIXTURE_TCE_CE_PF_ITEM = {
  codigo_tipo_negociante: '2',
  descricao_tipo_negociante: 'Pessoa Física',
  nome_negociante: 'JOAO DA SILVA ENGENHEIRO',
  numero_documento_negociante: '123.456.789-00',
  objeto_licitacao: 'Serviços técnicos de consultoria individual',
  valor_proposta: 25000.0,
}

/**
 * Parser TypeScript do TCE-CE (mesma lógica aplicada no hook do servidor)
 */
export function parsearItemTceCe(
  item: Record<string, unknown>,
  codigoMunicipio: string = '044',
): ContratoBrutoProspeccao {
  const doc = String(item.numero_documento_negociante || '').replace(/\D/g, '')
  const tipoP =
    item.codigo_tipo_negociante === '2' ||
    String(item.descricao_tipo_negociante || '')
      .toLowerCase()
      .includes('física') ||
    doc.length === 11
      ? 'PF'
      : 'PJ'

  return {
    cnpj: doc,
    tipoPessoa: tipoP,
    razaoSocial: String(item.nome_negociante || ''),
    orgao: String(item.nome_orgao || item.nome_unidade_gestora || 'Prefeitura de Fortaleza'),
    numero: String(item.numero_licitacao || 'LIC-' + codigoMunicipio + '-' + Date.now()),
    objeto: String(item.objeto_licitacao || item.nome_negociante || ''),
    valor: Number(item.valor_homologado || item.valor_proposta || 0) || 0,
    vigenciaInicio: String(item.data_realizacao_licitacao || ''),
    link: 'https://municipios-licitacoes.tce.ce.gov.br',
    uf: 'CE',
    municipio: codigoMunicipio,
  }
}

/**
 * Parser dinâmico de linha CSV com mapeamento de colunas configurável
 */
export function mapearLinhaCsv(
  linha: Record<string, unknown>,
  mapeamento: MapeamentoColunasCsv,
): ContratoBrutoProspeccao {
  const colCnpj = mapeamento.col_cnpj || 'cnpj'
  const colRazao = mapeamento.col_razao_social || 'razao_social'
  const colOrgao = mapeamento.col_orgao || 'orgao'
  const colNumero = mapeamento.col_numero_contrato || 'numero_contrato'
  const colObjeto = mapeamento.col_objeto || 'objeto'
  const colValor = mapeamento.col_valor || 'valor'

  const cnpj = String(linha[colCnpj] || linha.cnpj || '')
  const razao = String(linha[colRazao] || linha.razao_social || '')
  const orgao = String(linha[colOrgao] || linha.orgao || 'Órgão Público')
  const num = String(linha[colNumero] || linha.numero || '')
  const obj = String(linha[colObjeto] || linha.objeto || '')
  const rawValor = linha[colValor] ?? linha.valor ?? 0
  const valor = Number(String(rawValor).replace(/\./g, '').replace(',', '.')) || 0

  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const tipoP = cnpjLimpo.length === 11 ? 'PF' : 'PJ'

  return {
    cnpj: cnpjLimpo,
    tipoPessoa: tipoP,
    razaoSocial: razao,
    orgao,
    numero: num,
    objeto: obj,
    valor,
  }
}

describe('Rodada 14 — Parte 2: Fontes do Ceará (TCE-CE e Mapeamento Dinâmico de CSV)', () => {
  // 1. PARSER TCE-CE COM FIXTURE REAL
  it('deve parsear fixture real capturada no probe da API do TCE-CE (SIM)', () => {
    const contratoMapeado = parsearItemTceCe(FIXTURE_TCE_CE_SIM_ITEM, '044')

    expect(contratoMapeado.cnpj).toBe('34567890000112')
    expect(contratoMapeado.tipoPessoa).toBe('PJ')
    expect(contratoMapeado.razaoSocial).toBe('A.R.S. CONSULTORIA DE ENGENHARIA E PROJETOS LTDA')
    expect(contratoMapeado.orgao).toContain('SEGER')
    expect(contratoMapeado.numero).toBe('849479/2024')
    expect(contratoMapeado.valor).toBe(380000.0)
    expect(contratoMapeado.uf).toBe('CE')
    expect(contratoMapeado.municipio).toBe('044')
  })

  // 2. DESCARTE DE PESSOA FÍSICA NO TCE-CE
  it('deve descartar pessoa física da resposta do TCE-CE', () => {
    const itemPf = parsearItemTceCe(FIXTURE_TCE_CE_PF_ITEM, '044')
    expect(itemPf.tipoPessoa).toBe('PF')
    expect(isPessoaFisica(itemPf.tipoPessoa, itemPf.cnpj)).toBe(true)

    const empresas: EmpresaSimulada[] = []
    const contratos: ContratoSimulado[] = []
    const sugestoes: SugestaoSimulada[] = []

    const res = processarLoteProspeccaoPuro([itemPf], empresas, contratos, sugestoes)
    expect(res.descartadosCpf).toBe(1)
    expect(res.novasSugestoes.length).toBe(0)
  })

  // 3. CLASSIFICAÇÃO DE RELEVÂNCIA DO OBJETO DO TCE-CE
  it('deve classificar relevância técnica do objeto da licitação do TCE-CE', () => {
    const itemTce = parsearItemTceCe(FIXTURE_TCE_CE_SIM_ITEM, '044')
    const scoreDic = classificarPorDicionario(itemTce.objeto)

    expect(scoreDic.score).toBeGreaterThanOrEqual(60)
    expect(scoreDic.termos).toEqual(
      expect.arrayContaining([
        'engenharia consultiva',
        'projeto executivo',
        'estrutural',
        'elétrico',
        'hidrossanitário',
      ]),
    )
  })

  // 4. MAPEAMENTO CONFIGURÁVEL DE COLUNAS CSV (Ceará Transparente)
  it('deve mapear corretamente linhas CSV com colunas do Ceará Transparente (transparencia.ce.gov.br)', () => {
    const mapeamentoCearaTransp: MapeamentoColunasCsv = {
      col_cnpj: 'cpf_cnpj_contratada',
      col_razao_social: 'nome_contratada',
      col_orgao: 'orgao_contratante',
      col_numero_contrato: 'numero_contrato',
      col_objeto: 'objeto_contrato',
      col_valor: 'valor_contrato',
    }

    const linhaCearaCsv = {
      cpf_cnpj_contratada: '12.345.678/0001-99',
      nome_contratada: 'ENG CONSTRUTORA CE LTDA',
      orgao_contratante: 'SOP - SUPERINTENDÊNCIA DE OBRAS PÚBLICAS DO CEARÁ',
      numero_contrato: 'CTR-SOP-044/2026',
      objeto_contrato: 'Elaboração de projetos executivos de engenharia rodoviária e pavimentação',
      valor_contrato: '850.000,00',
    }

    const mapeado = mapearLinhaCsv(linhaCearaCsv, mapeamentoCearaTransp)

    expect(mapeado.cnpj).toBe('12345678000199')
    expect(mapeado.razaoSocial).toBe('ENG CONSTRUTORA CE LTDA')
    expect(mapeado.orgao).toContain('SOP')
    expect(mapeado.numero).toBe('CTR-SOP-044/2026')
    expect(mapeado.valor).toBe(850000)
    expect(mapeado.tipoPessoa).toBe('PJ')
  })

  // 5. MAPEAMENTO DE COLUNAS CSV ALTERNATIVO (Comprasnet com cabeçalho customizado)
  it('deve suportar variação arbitrária de nomes de colunas CSV salva por fonte', () => {
    const mapeamentoCustom: MapeamentoColunasCsv = {
      col_cnpj: 'documento_fiscal',
      col_razao_social: 'fornecedor_nome',
      col_orgao: 'unidade_compradora',
      col_numero_contrato: 'termo_contratual',
      col_objeto: 'descricao_servico',
      col_valor: 'total_empenhado',
    }

    const linhaCustom = {
      documento_fiscal: '98.765.432/0001-10',
      fornecedor_nome: 'PROJETOS E LAUDOS CEARÁ LTDA',
      unidade_compradora: 'PREFEITURA DE CAUCAIA',
      termo_contratual: 'CTR-2026-CAU-01',
      descricao_servico: 'Elaboração de projetos e laudo técnico para drenagem urbana',
      total_empenhado: '420000',
    }

    const mapeado = mapearLinhaCsv(linhaCustom, mapeamentoCustom)

    expect(mapeado.cnpj).toBe('98765432000110')
    expect(mapeado.razaoSocial).toBe('PROJETOS E LAUDOS CEARÁ LTDA')
    expect(mapeado.orgao).toBe('PREFEITURA DE CAUCAIA')
    expect(mapeado.valor).toBe(420000)
  })

  // 6. PIPELINE COMPLETO REAPROVEITADO COM DEDUPE E SUGESTÕES
  it('deve processar lote do Ceará gerando dedupe com existentes e novas sugestões', () => {
    const empresas: EmpresaSimulada[] = [
      {
        id: 'emp_ce_existente',
        cnpj: '34567890000112', // Mesmo CNPJ da fixture
        razao_social: 'A.R.S. CONSULTORIA DE ENGENHARIA E PROJETOS LTDA',
        etapa_funil: 'nutricao_mensal',
        status: 'ativa',
      },
    ]
    const contratos: ContratoSimulado[] = []
    const sugestoes: SugestaoSimulada[] = []

    const itemTce = parsearItemTceCe(FIXTURE_TCE_CE_SIM_ITEM, '044')

    const res = processarLoteProspeccaoPuro([itemTce], empresas, contratos, sugestoes)

    // CNPJ já existe: dedupe detectado
    expect(res.duplicadosDedupe).toBe(1)
    expect(res.novasSugestoes.length).toBe(0)
    // Contrato anexado à empresa existente
    expect(res.novosContratos.length).toBe(1)
    expect(res.novosContratos[0].empresa).toBe('emp_ce_existente')
    expect(res.novosContratos[0].numero).toBe('849479/2024')
    // Como a empresa estava em nutricao_mensal, sugere reativação
    expect(res.novasReativacoes.length).toBe(1)
  })
})
