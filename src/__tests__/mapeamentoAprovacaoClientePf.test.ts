import { describe, it, expect } from 'vitest'
import {
  normalizarDataNascimento,
  mapearDadosAprovacaoClientePf,
  DadosEnviadosClientePf,
  extrairDadosEnviadosSeguro,
} from '../services/mapeamentoClientePf'

describe('Mapeamento e Normalização — Aprovação de Cadastro Cliente PF', () => {
  describe('normalizarDataNascimento', () => {
    it('normaliza formato ISO AAAA-MM-DD mantendo ano, mês e dia', () => {
      expect(normalizarDataNascimento('1980-11-05')).toBe('1980-11-05')
      expect(normalizarDataNascimento(' 1995-06-01 ')).toBe('1995-06-01')
    })

    it('normaliza formato brasileiro DD/MM/AAAA para AAAA-MM-DD', () => {
      expect(normalizarDataNascimento('05/11/1980')).toBe('1980-11-05')
      expect(normalizarDataNascimento('01/06/1995')).toBe('1995-06-01')
    })

    it('normaliza formato com hífen DD-MM-AAAA para AAAA-MM-DD', () => {
      expect(normalizarDataNascimento('15-03-1990')).toBe('1990-03-15')
    })

    it('rejeita datas inválidas retornando string vazia', () => {
      expect(normalizarDataNascimento('')).toBe('')
      expect(normalizarDataNascimento('invalida')).toBe('')
      expect(normalizarDataNascimento('32/13/2000')).toBe('')
      expect(normalizarDataNascimento('1850-01-01')).toBe('') // fora do range
    })
  })

  describe('mapearDadosAprovacaoClientePf com payload real do José (CIN, SSP, CE, solteiro)', () => {
    // Payload idêntico ao do caso real do cliente José
    const payloadJose: DadosEnviadosClientePf = {
      doc_tipo: 'CIN',
      cpf: '604.548.853-93', // CPF fictício/formatado no padrão BR
      rg: '60454885393',
      rg_orgao_emissor: 'SSP',
      rg_uf: 'CE',
      estado_civil: 'solteiro(a)',
      nacionalidade: 'Brasileira',
      profissao: 'Engenheiro Civil',
      cep: '60175-055',
      logradouro: 'Av. Santos Dumont',
      numero: '1234',
      complemento: 'Apto 502',
      bairro: 'Aldeota',
      municipio: 'Fortaleza',
      uf: 'CE',
      telefone: '(85) 99876-5432',
      email: 'jose.teste@exemplo.com.br',
      aceite_lgpd: true,
      data_nascimento: '1980-11-05',
    }

    it('mapeia corretamente payload com CIN, sincronizando RG com CPF', () => {
      const clienteExistente = {
        id: 'cliente_jose_1',
        nome: 'José',
        cpf: '', // ainda não tinha CPF gravado
      }

      const resultado = mapearDadosAprovacaoClientePf(payloadJose, clienteExistente)

      expect(resultado.doc_tipo).toBe('CIN')
      expect(resultado.cpf).toBe('60454885393')
      expect(resultado.rg).toBe('60454885393') // CIN: RG vira cópia de 11 dígitos do CPF
      expect(resultado.rg_orgao_emissor).toBe('SSP')
      expect(resultado.rg_uf).toBe('CE')
      expect(resultado.estado_civil).toBe('solteiro(a)')
      expect(resultado.nacionalidade).toBe('Brasileira')
      expect(resultado.municipio).toBe('Fortaleza')
      expect(resultado.uf).toBe('CE')
      expect(resultado.cadastro_status).toBe('completo')
      expect(resultado.consentimento_lgpd).toBe(true)
      expect(resultado.data_nascimento).toBe('1980-11-05')
      expect(resultado.data_consentimento).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    })

    it('normaliza data de nascimento vinda no formato DD/MM/AAAA para AAAA-MM-DD', () => {
      const payloadComDataBr: DadosEnviadosClientePf = {
        ...payloadJose,
        data_nascimento: '05/11/1980',
      }

      const resultado = mapearDadosAprovacaoClientePf(payloadComDataBr)
      expect(resultado.data_nascimento).toBe('1980-11-05')
    })

    it('A4: NÃO seta CPF nem RG quando o cliente já possui o mesmo CPF/RG gravado', () => {
      const clienteExistente = {
        id: 'cliente_jose_1',
        nome: 'José',
        cpf: '604.548.853-93', // já tem o mesmo CPF
        rg: '60454885393',
      }

      const resultado = mapearDadosAprovacaoClientePf(payloadJose, clienteExistente)

      // Regra A4: não deve conter 'cpf' nem 'rg' para não disparar revalidação/índice duplicado
      expect(resultado.cpf).toBeUndefined()
      expect(resultado.rg).toBeUndefined()
      // Os outros campos são atualizados normalmente
      expect(resultado.doc_tipo).toBe('CIN')
      expect(resultado.rg_orgao_emissor).toBe('SSP')
      expect(resultado.rg_uf).toBe('CE')
      expect(resultado.estado_civil).toBe('solteiro(a)')
      expect(resultado.cadastro_status).toBe('completo')
    })

    it('A4: seta CPF se o cliente existente tinha CPF diferente ou vazio', () => {
      const clienteExistente = {
        id: 'cliente_jose_1',
        nome: 'José',
        cpf: '111.222.333-44', // CPF antigo diferente
      }

      const resultado = mapearDadosAprovacaoClientePf(payloadJose, clienteExistente)
      expect(resultado.cpf).toBe('60454885393')
    })

    it('extrai com sucesso dados_enviados chegando como STRING JSON (como o JSVM do PocketBase entrega) e mapeia cpf e doc_tipo', () => {
      // Simulação fiel do JSVM do PocketBase quando o campo JSON é lido com getString('dados_enviados')
      const jsonStringDoJsvm = JSON.stringify(payloadJose)

      // Leitura segura do hook:
      // const raw = convite.getString('dados_enviados')
      // const dados = raw ? JSON.parse(raw) : {}
      const dadosExtraidos = extrairDadosEnviadosSeguro(jsonStringDoJsvm)

      expect(dadosExtraidos).toBeDefined()
      expect(typeof dadosExtraidos).toBe('object')
      expect(dadosExtraidos.cpf).toBe('604.548.853-93')
      expect(dadosExtraidos.doc_tipo).toBe('CIN')
      expect(dadosExtraidos.rg_orgao_emissor).toBe('SSP')
      expect(dadosExtraidos.rg_uf).toBe('CE')
      expect(dadosExtraidos.estado_civil).toBe('solteiro(a)')

      // Mapeamento para clientes_pf
      const clienteExistente = { id: 'cli_jose_sem_cpf', nome: 'José', cpf: '' }
      const resultado = mapearDadosAprovacaoClientePf(dadosExtraidos, clienteExistente)

      expect(resultado.cpf).toBe('60454885393')
      expect(resultado.doc_tipo).toBe('CIN')
      expect(resultado.rg).toBe('60454885393')
      expect(resultado.rg_orgao_emissor).toBe('SSP')
      expect(resultado.rg_uf).toBe('CE')
      expect(resultado.estado_civil).toBe('solteiro(a)')
      expect(resultado.cadastro_status).toBe('completo')
    })

    it('fallback se dados_enviados já vier como objeto JS', () => {
      const dadosExtraidos = extrairDadosEnviadosSeguro(payloadJose)
      expect(dadosExtraidos.cpf).toBe('604.548.853-93')
      expect(dadosExtraidos.doc_tipo).toBe('CIN')
      const resultado = mapearDadosAprovacaoClientePf(dadosExtraidos)
      expect(resultado.cpf).toBe('60454885393')
      expect(resultado.doc_tipo).toBe('CIN')
    })

    it('dados_enviados chegando como STRING JSON com nome "josé jair oliveira alves" -> mapeamento/aprovação produz cliente.nome "José Jair Oliveira Alves"', () => {
      const stringJsonJsVm = JSON.stringify({
        nome: 'josé jair oliveira alves',
        cpf: '529.982.247-25',
        doc_tipo: 'RG',
        rg: '1234567',
        logradouro: 'rua das flores',
        bairro: 'centro',
        municipio: 'fortaleza',
        uf: 'CE',
      })

      const dadosExtraidos = extrairDadosEnviadosSeguro(stringJsonJsVm)
      expect(dadosExtraidos.nome).toBe('josé jair oliveira alves')

      const clienteExistente = { id: 'cli_pre_cadastro', nome: 'José' }
      const resultado = mapearDadosAprovacaoClientePf(dadosExtraidos, clienteExistente)

      expect(resultado.nome).toBe('José Jair Oliveira Alves')
      expect(resultado.cadastro_status).toBe('completo')
    })
  })
})
