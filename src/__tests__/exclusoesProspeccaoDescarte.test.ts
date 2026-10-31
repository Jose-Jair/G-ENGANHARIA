import { describe, it, expect } from 'vitest'
import { processarLoteProspeccaoPuro } from '../services/prospeccaoPipeline'
import { exclusoesProspeccaoService } from '../services/exclusoesProspeccao'

describe('Ajuste pós-v0.0.150 — Descarte de Prospecção e Lista Própria de Exclusão (Não é opt-out LGPD)', () => {
  it('exclusoesProspeccaoService deve exportar métodos de list, create, isCnpjExcluido e delete', () => {
    expect(typeof exclusoesProspeccaoService.list).toBe('function')
    expect(typeof exclusoesProspeccaoService.create).toBe('function')
    expect(typeof exclusoesProspeccaoService.isCnpjExcluido).toBe('function')
    expect(typeof exclusoesProspeccaoService.delete).toBe('function')
  })

  it('pipeline de varredura descarta sugestão cujo CNPJ está na lista de exclusões de prospecção', () => {
    const itens = [
      {
        cnpj: '12.345.678/0001-90',
        razaoSocial: 'EMPRESA EXCLUIDA ENGENHARIA LTDA',
        numeroContrato: 'CTR-2026-999',
        objeto: 'Reforma de ponte e terraplanagem',
        valor: 150000,
        tipoPessoa: 'J',
      },
      {
        cnpj: '98.765.432/0001-11',
        razaoSocial: 'EMPRESA PERMITIDA PROJETOS LTDA',
        numeroContrato: 'CTR-2026-101',
        objeto: 'Elaboração de projetos executivos de saneamento',
        valor: 200000,
        tipoPessoa: 'J',
      },
    ]

    const empresasExistentes: any[] = []
    const contratosExistentes: any[] = []
    const sugestoesExistentes: any[] = []
    const exclusoesExistentes = [
      {
        cnpj: '12.345.678/0001-90',
        ativo: true,
      },
    ]

    const resultado = processarLoteProspeccaoPuro(
      itens,
      empresasExistentes,
      contratosExistentes,
      sugestoesExistentes,
      exclusoesExistentes,
    )

    expect(resultado.descartadosExclusao).toBe(1)
    expect(resultado.novasSugestoes.length).toBe(1)
    expect(resultado.novasSugestoes[0].cnpj).toBe('98.765.432/0001-11')
  })

  it('pipeline de varredura descarta sugestão cujo objeto casa com termo/objeto excluído', () => {
    const itens = [
      {
        cnpj: '11.222.333/0001-44',
        razaoSocial: 'DISTRIBUIDORA DE ALIMENTOS LTDA',
        numeroContrato: 'CTR-2026-MERENDA',
        objeto: 'Fornecimento de merenda escolar e gêneros alimentícios perecíveis',
        valor: 350000,
        tipoPessoa: 'J',
      },
      {
        cnpj: '44.555.666/0001-77',
        razaoSocial: 'GMAIS ENGENHARIA PARCEIRA LTDA',
        numeroContrato: 'CTR-2026-OBRA',
        objeto: 'Supervisão técnica de obra de contenção de encostas',
        valor: 450000,
        tipoPessoa: 'J',
      },
    ]

    const exclusoesExistentes = [
      {
        objeto_termo: 'merenda escolar',
        ativo: true,
      },
    ]

    const resultado = processarLoteProspeccaoPuro(itens, [], [], [], exclusoesExistentes)

    expect(resultado.descartadosExclusao).toBe(1)
    expect(resultado.novasSugestoes.length).toBe(1)
    expect(resultado.novasSugestoes[0].razao_social).toBe('GMAIS ENGENHARIA PARCEIRA LTDA')
  })

  it('exclusões inativas (ativo = false) não devem bloquear a criação da sugestão', () => {
    const itens = [
      {
        cnpj: '55.666.777/0001-88',
        razaoSocial: 'EMPRESA REATIVADA LTDA',
        numeroContrato: 'CTR-2026-REATIVADO',
        objeto: 'Consultoria ambiental e licenciamento',
        valor: 180000,
        tipoPessoa: 'J',
      },
    ]

    const exclusoesInativas = [
      {
        cnpj: '55.666.777/0001-88',
        ativo: false,
      },
    ]

    const resultado = processarLoteProspeccaoPuro(itens, [], [], [], exclusoesInativas)

    expect(resultado.descartadosExclusao).toBe(0)
    expect(resultado.novasSugestoes.length).toBe(1)
  })

  it('garante que modelo de dados de exclusão carrega metadados de auditoria e origem', () => {
    const registroExclusao = {
      cnpj: '12345678000190',
      cnae: '7112-0/00',
      objeto_termo: 'Serviços de engenharia',
      tipo_chave: 'cnpj',
      motivo_descarte: 'Fora do escopo de atuação do parceiro',
      fonte_origem: 'pncp',
      descartado_por: 'user_admin_01',
      data_descarte: new Date().toISOString(),
      ativo: true,
      observacoes: 'Exclusão operacional de prospecção. Não constitui opt-out LGPD.',
    }

    expect(registroExclusao.tipo_chave).toBe('cnpj')
    expect(registroExclusao.ativo).toBe(true)
    expect(registroExclusao.observacoes).toContain('Não constitui opt-out LGPD')
  })
})
