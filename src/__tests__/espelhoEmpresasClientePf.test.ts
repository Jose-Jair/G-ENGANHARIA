import { describe, it, expect } from 'vitest'
import {
  construirEspelhoEmpresasDoClientePf,
  CAMPOS_ESPELHO_CLIENTE_PF,
} from '../services/mapeamentoEspelhoEmpresas'

describe('Sincronização do espelho empresas (cliente_pf_ref) quando o cliente PF muda', () => {
  it('mapeia nome formatado aprovado para razao_social e nome_fantasia', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      { nome: 'José Jair Oliveira Alves', email: 'jose@exemplo.com.br' },
      { razao_social: 'José', nome_fantasia: 'José' },
    )
    expect(espelho).not.toBeNull()
    expect(espelho!.razao_social).toBe('José Jair Oliveira Alves')
    expect(espelho!.nome_fantasia).toBe('José Jair Oliveira Alves')
  })

  it('quando nada mudou, não gera update no espelho (retorna null)', () => {
    const dadosIguais = {
      nome: 'José Jair Oliveira Alves',
      email: 'jose.teste@exemplo.com.br',
      telefone: '(85) 99876-5432',
      cpf: '60454885393',
      cep: '60175-055',
      logradouro: 'Av. Santos Dumont',
      numero: '1234',
      complemento: 'Apto 502',
      bairro: 'Aldeota',
      municipio: 'Fortaleza',
      uf: 'CE',
    }
    const espelho = construirEspelhoEmpresasDoClientePf(dadosIguais, {
      razao_social: 'José Jair Oliveira Alves',
      nome_fantasia: 'José Jair Oliveira Alves',
      cnpj: '60454885393',
      email: 'jose.teste@exemplo.com.br',
      telefone: '(85) 99876-5432',
      cep: '60175-055',
      logradouro: 'Av. Santos Dumont',
      numero: '1234',
      complemento: 'Apto 502',
      bairro: 'Aldeota',
      municipio: 'Fortaleza',
      uf: 'CE',
    })
    expect(espelho).toBeNull()
  })

  it('sincroniza cpf -> campo cnpj do espelho quando o CPF do cliente mudou', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      { nome: 'Maria Souza Silva', cpf: '52998224725' },
      { razao_social: 'Maria', nome_fantasia: 'Maria', cnpj: '11122233344' },
    )
    expect(espelho).not.toBeNull()
    expect(espelho!.cnpj).toBe('52998224725')
  })

  it('não mexe no cnpj do espelho quando o CPF do cliente não veio', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      { nome: 'Novo Nome do Cliente' },
      { razao_social: 'Nome Antigo do Cliente', cnpj: '11122233344' },
    )
    expect(espelho).not.toBeNull()
    expect(espelho!.cnpj).toBeUndefined()
  })

  it('sincroniza contato e endereço (email, telefone, cep, logradouro, numero, complemento, bairro, municipio, uf)', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      {
        nome: 'Maria Souza Silva',
        email: 'maria.souza@exemplo.com',
        telefone: '(85) 98888-7777',
        cep: '60175-055',
        logradouro: 'Av. Beira Mar',
        numero: '4321',
        complemento: 'Cobertura',
        bairro: 'Meireles',
        municipio: 'Fortaleza',
        uf: 'CE',
      },
      {
        razao_social: 'Maria',
        nome_fantasia: 'Maria',
        email: 'antigo@exemplo.com',
        telefone: '(11) 90000-0000',
        cep: '00000-000',
        logradouro: 'Rua Antiga',
        numero: '1',
        complemento: '',
        bairro: 'Centro',
        municipio: 'São Paulo',
        uf: 'SP',
      },
    )

    expect(espelho!.razao_social).toBe('Maria Souza Silva')
    expect(espelho!.nome_fantasia).toBe('Maria Souza Silva')
    expect(espelho!.email).toBe('maria.souza@exemplo.com')
    expect(espelho!.telefone).toBe('(85) 98888-7777')
    expect(espelho!.cep).toBe('60175-055')
    expect(espelho!.logradouro).toBe('Av. Beira Mar')
    expect(espelho!.numero).toBe('4321')
    expect(espelho!.complemento).toBe('Cobertura')
    expect(espelho!.bairro).toBe('Meireles')
    expect(espelho!.municipio).toBe('Fortaleza')
    expect(espelho!.uf).toBe('CE')
  })

  it('cnpj do espelho vazio recebe o CPF do cliente quando informado', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      { nome: 'Ana Lima', cpf: '11144477735' },
      { razao_social: 'Ana', cnpj: '' },
    )
    expect(espelho!.cnpj).toBe('11144477735')
  })

  it('normaliza CPF com pontuação antes de comparar (evita update redundante)', () => {
    const espelho = construirEspelhoEmpresasDoClientePf(
      { nome: 'José Jair Oliveira Alves', cpf: '604.548.853-93' },
      {
        razao_social: 'José Jair Oliveira Alves',
        nome_fantasia: 'José Jair Oliveira Alves',
        cnpj: '60454885393',
      },
    )
    expect(espelho).toBeNull()
  })

  it('expõe a lista de campos sincronizados (documento do mapeamento)', () => {
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('nome')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('cpf')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('email')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('telefone')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('cep')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('logradouro')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('numero')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('complemento')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('bairro')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('municipio')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).toContain('uf')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).not.toContain('observacoes')
    expect(CAMPOS_ESPELHO_CLIENTE_PF).not.toContain('etapa_funil')
  })
})
