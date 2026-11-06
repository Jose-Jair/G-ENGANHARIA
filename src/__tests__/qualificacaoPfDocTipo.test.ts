import { describe, it, expect } from 'vitest'
import { montarQualificacaoPf, montarTrechoDocumentoIdentificacao } from '@/lib/qualificacaoPf'
import { ClientePfRecord } from '@/types'

describe('qualificacaoPf (B2b Ajuste v0.0.237)', () => {
  const baseCliente: ClientePfRecord = {
    id: 'cli_teste_1',
    nome: 'Maria da Silva',
    cpf: '12345678901',
    nacionalidade: 'brasileira',
    estado_civil: 'casado(a)',
    regime_bens: 'comunhão parcial de bens',
    profissao: 'Engenheira Civil',
    doc_tipo: 'RG',
    rg: '1234567',
    rg_orgao_emissor: 'SSP',
    rg_uf: 'CE',
    logradouro: 'Rua das Flores',
    numero: '100',
    bairro: 'Aldeota',
    municipio: 'Fortaleza',
    uf: 'CE',
    cep: '60000-000',
    consentimento_lgpd: true,
    cadastro_status: 'completo',
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  it('não menciona regime de bens mesmo com estado civil casado(a) e regime_bens preenchido', () => {
    const res = montarQualificacaoPf(baseCliente)
    expect(res.texto).not.toContain('regime')
    expect(res.texto).not.toContain('comunhão')
    expect(res.faltando).not.toContain('regime de bens (casado(a)/união estável)')
    expect(res.texto).toContain(
      'Maria da Silva, de nacionalidade brasileira, casado(a), Engenheira Civil, portador(a) do RG nº 1234567 SSP/CE, inscrito(a) no CPF sob o nº 123.456.789-01, residente e domiciliado(a) em Rua das Flores, nº 100, Aldeota, Fortaleza/CE, CEP 60000-000',
    )
  })

  it('formata RG corretamente: portador(a) do RG nº X SSP/CE', () => {
    const trecho = montarTrechoDocumentoIdentificacao('RG', '', '999888', 'SSP', 'CE')
    expect(trecho).toBe('portador(a) do RG nº 999888 SSP/CE')
  })

  it('formata CNH com artigo feminino: portador(a) da CNH nº X DETRAN/CE', () => {
    const trecho = montarTrechoDocumentoIdentificacao('CNH', '', '11223344', 'DETRAN', 'CE')
    expect(trecho).toBe('portador(a) da CNH nº 11223344 DETRAN/CE')

    const cliCnh: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'CNH',
      rg: '11223344',
      rg_orgao_emissor: 'DETRAN',
      rg_uf: 'CE',
    }
    const res = montarQualificacaoPf(cliCnh)
    expect(res.texto).toContain('portador(a) da CNH nº 11223344 DETRAN/CE')
  })

  it('formata Carteira profissional: portador(a) da carteira profissional nº X CREA/CE', () => {
    const trecho = montarTrechoDocumentoIdentificacao(
      'Carteira profissional',
      '',
      '556677',
      'CREA',
      'CE',
    )
    expect(trecho).toBe('portador(a) da carteira profissional nº 556677 CREA/CE')

    const cliCart: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'Carteira profissional',
      rg: '556677',
      rg_orgao_emissor: 'CREA',
      rg_uf: 'CE',
    }
    const res = montarQualificacaoPf(cliCart)
    expect(res.texto).toContain('portador(a) da carteira profissional nº 556677 CREA/CE')
  })

  it('formata Outro com tipo especificado: portador(a) do documento Passaporte nº X DPF/CE', () => {
    const trecho = montarTrechoDocumentoIdentificacao(
      'Outro',
      'Passaporte',
      'AA123456',
      'DPF',
      'CE',
    )
    expect(trecho).toBe('portador(a) do documento Passaporte nº AA123456 DPF/CE')

    const cliOutro: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'Outro',
      doc_tipo_outro: 'Passaporte',
      rg: 'AA123456',
      rg_orgao_emissor: 'DPF',
      rg_uf: 'CE',
    }
    const res = montarQualificacaoPf(cliOutro)
    expect(res.texto).toContain('portador(a) do documento Passaporte nº AA123456 DPF/CE')
  })

  it('aponta falta de doc_tipo_outro quando doc_tipo é Outro mas tipo não foi informado', () => {
    const cliIncompleto: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'Outro',
      doc_tipo_outro: '',
    }
    const res = montarQualificacaoPf(cliIncompleto)
    expect(res.faltando).toContain('doc_tipo_outro')
  })

  it('formata CIN sem repetir o número na qualificação civil', () => {
    const cliCin: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'CIN',
      rg: '529.982.247-25', // número é o próprio CPF
      rg_orgao_emissor: 'SSP',
      rg_uf: 'CE',
    }
    const res = montarQualificacaoPf(cliCin)
    expect(res.texto).toContain(
      'portador(a) da Carteira de Identidade Nacional, inscrito(a) no CPF sob o nº 529.982.247-25',
    )
    expect(res.texto).not.toContain('nº 529.982.247-25 SSP/CE')
  })

  it('formata RG cujo número é igual ao CPF sem repetir o número', () => {
    const cliRgCpf: ClientePfRecord = {
      ...baseCliente,
      doc_tipo: 'RG',
      rg: '52998224725',
      rg_orgao_emissor: 'SSP',
      rg_uf: 'CE',
    }
    const res = montarQualificacaoPf(cliRgCpf)
    expect(res.texto).toContain(
      'portador(a) do RG SSP/CE, inscrito(a) no CPF sob o nº 529.982.247-25',
    )
    expect(res.texto).not.toContain('nº 52998224725')
  })

  describe('flexão por gênero (Item B)', () => {
    it('flexiona para masculino: brasileiro, solteiro, portador, inscrito, residente e domiciliado', () => {
      const cliMasc: ClientePfRecord = {
        ...baseCliente,
        nome: 'João de Sousa',
        genero: 'masculino',
        estado_civil: 'solteiro',
        nacionalidade: 'Brasileiro',
      }
      const res = montarQualificacaoPf(cliMasc)
      expect(res.texto).toContain('brasileiro, solteiro')
      expect(res.texto).toContain('portador do RG nº 1234567 SSP/CE')
      expect(res.texto).toContain('inscrito no CPF sob o nº 123.456.789-01')
      expect(res.texto).toContain('residente e domiciliado em Rua das Flores')
      expect(res.texto).not.toContain('portador(a)')
      expect(res.texto).not.toContain('inscrito(a)')
      expect(res.texto).not.toContain('domiciliado(a)')
    })

    it('flexiona para feminino: brasileira, solteira, portadora, inscrita, residente e domiciliada', () => {
      const cliFem: ClientePfRecord = {
        ...baseCliente,
        nome: 'Maria da Silva',
        genero: 'feminino',
        estado_civil: 'solteira',
        nacionalidade: 'Brasileira',
      }
      const res = montarQualificacaoPf(cliFem)
      expect(res.texto).toContain('brasileira, solteira')
      expect(res.texto).toContain('portadora do RG nº 1234567 SSP/CE')
      expect(res.texto).toContain('inscrita no CPF sob o nº 123.456.789-01')
      expect(res.texto).toContain('residente e domiciliada em Rua das Flores')
      expect(res.texto).not.toContain('portador(a)')
      expect(res.texto).not.toContain('inscrito(a)')
      expect(res.texto).not.toContain('domiciliado(a)')
    })

    it('flexiona estados civis masculinos e femininos e união estável invariável', () => {
      const civis = [
        { mascIn: 'casado', mascOut: 'casado', femIn: 'casada', femOut: 'casada' },
        { mascIn: 'divorciado', mascOut: 'divorciado', femIn: 'divorciada', femOut: 'divorciada' },
        { mascIn: 'separado', mascOut: 'separado', femIn: 'separada', femOut: 'separada' },
        { mascIn: 'viúvo', mascOut: 'viúvo', femIn: 'viúva', femOut: 'viúva' },
        {
          mascIn: 'em união estável',
          mascOut: 'em união estável',
          femIn: 'em união estável',
          femOut: 'em união estável',
        },
      ]

      for (const item of civis) {
        const resMasc = montarQualificacaoPf({
          ...baseCliente,
          genero: 'masculino',
          estado_civil: item.mascIn,
        })
        expect(resMasc.texto).toContain(item.mascOut)
        const resFem = montarQualificacaoPf({
          ...baseCliente,
          genero: 'feminino',
          estado_civil: item.femIn,
        })
        expect(resFem.texto).toContain(item.femOut)
      }
    })

    it('mantém nacionalidade estrangeira em minúsculas conforme digitado', () => {
      const resMasc = montarQualificacaoPf({
        ...baseCliente,
        genero: 'masculino',
        nacionalidade: 'Portuguesa',
      })
      expect(resMasc.texto).toContain(', portuguesa, ')
      const resFem = montarQualificacaoPf({
        ...baseCliente,
        genero: 'feminino',
        nacionalidade: 'Italiana',
      })
      expect(resFem.texto).toContain(', italiana, ')
    })

    it('sem gênero: mantém forma neutra atual com (a) e de nacionalidade {nacionalidade}', () => {
      const cliNeutro: ClientePfRecord = {
        ...baseCliente,
        genero: undefined,
        estado_civil: 'solteiro',
        nacionalidade: 'brasileira',
      }
      const res = montarQualificacaoPf(cliNeutro)
      expect(res.texto).toContain('de nacionalidade brasileira')
      expect(res.texto).toContain('solteiro(a)')
      expect(res.texto).toContain('portador(a)')
      expect(res.texto).toContain('inscrito(a)')
      expect(res.texto).toContain('residente e domiciliado(a)')
    })
  })
})
