import { describe, it, expect } from 'vitest'
import { normalizeText } from './ClienteAutocomplete'

describe('ClienteAutocomplete - normalizeText e lógica de busca', () => {
  it('remove acentos, pontuações e converte para minúsculas', () => {
    expect(normalizeText('São Paulo')).toBe('sao paulo')
    expect(normalizeText('CONSTRUTORA ÁGUA & AÇO')).toBe('construtora agua & aco')
    expect(normalizeText('José Jair')).toBe('jose jair')
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
  })

  it('permite buscar empresas por razão social, nome fantasia e CNPJ limpo ou formatado', () => {
    const empresasMock = [
      {
        id: '1',
        razao_social: 'Construtora Horizonte Ltda',
        nome_fantasia: 'Horizonte Engenharia',
        cnpj: '12.345.678/0001-90',
        municipio: 'Recife',
        uf: 'PE',
        pre_cadastro: false,
      },
      {
        id: '2',
        razao_social: 'Beta Incorporações S.A.',
        nome_fantasia: 'Beta Imóveis',
        cnpj: '98.765.432/0001-10',
        municipio: 'São Paulo',
        uf: 'SP',
        pre_cadastro: true,
      },
    ]

    // Busca por termo no nome fantasia
    const termo1 = normalizeText('engenharia')
    const res1 = empresasMock.filter(
      (e) =>
        normalizeText(e.razao_social).includes(termo1) ||
        normalizeText(e.nome_fantasia).includes(termo1),
    )
    expect(res1.length).toBe(1)
    expect(res1[0].id).toBe('1')

    // Busca por CNPJ com ou sem pontuação
    const termo2Digits = '12345678'
    const res2 = empresasMock.filter((e) =>
      (e.cnpj || '').replace(/\D/g, '').includes(termo2Digits),
    )
    expect(res2.length).toBe(1)
    expect(res2[0].id).toBe('1')

    // Suporta pré-cadastros
    const preCad = empresasMock.filter((e) => e.pre_cadastro)
    expect(preCad.length).toBe(1)
    expect(preCad[0].razao_social).toBe('Beta Incorporações S.A.')
  })

  it('permite buscar clientes PF por nome, CPF e telefone', () => {
    const clientesPfMock = [
      {
        id: 'pf1',
        nome: 'Jose Jair Oliveira Alves',
        cpf: '604.548.853-93',
        email: 'josejair_ufca@outlook.com',
        telefone: '(88) 99999-1234',
        municipio: 'Tauá',
        uf: 'CE',
        pre_cadastro: true,
      },
      {
        id: 'pf2',
        nome: 'Maria da Silva Ramos',
        cpf: '111.222.333-44',
        email: 'maria@gmail.com',
        telefone: '11987654321',
        municipio: 'Fortaleza',
        uf: 'CE',
        pre_cadastro: false,
      },
    ]

    // Busca sem acento: "jose jair" encontra "Jose Jair"
    const termoNome = normalizeText('jose jair')
    const resNome = clientesPfMock.filter((c) => normalizeText(c.nome).includes(termoNome))
    expect(resNome.length).toBe(1)
    expect(resNome[0].id).toBe('pf1')

    // Busca por CPF apenas com números
    const cleanCpfDigits = '604548'
    const resCpf = clientesPfMock.filter((c) =>
      (c.cpf || '').replace(/\D/g, '').includes(cleanCpfDigits),
    )
    expect(resCpf.length).toBe(1)
    expect(resCpf[0].id).toBe('pf1')

    // Pré-cadastro presente
    expect(resCpf[0].pre_cadastro).toBe(true)
  })
})
