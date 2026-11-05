import { describe, it, expect } from 'vitest'
import {
  OPCOES_ESTADO_CIVIL,
  OPCOES_DOC_TIPO,
} from '@/components/clientesPf/cadastroClientePfConstants'

describe('Validação do cadastro de cliente PF (rotas públicas e payload)', () => {
  it('contém solteiro(a) nas opções válidas de estado civil aceitas pelo backend e front', () => {
    expect(OPCOES_ESTADO_CIVIL).toContain('solteiro(a)')
  })

  it('contém CIN como 1ª opção de documento de identificação', () => {
    expect(OPCOES_DOC_TIPO[0]).toBe('CIN')
  })

  it('simula mapeamento de erros específicos por campo retornados pelo backend', () => {
    const ROTULOS_CAMPO: Record<string, string> = {
      cpf: 'Informe um CPF válido (11 dígitos, com os dígitos verificadores corretos).',
      doc_tipo: 'Selecione o documento de identificação.',
      doc_tipo_outro: 'Informe qual é o documento de identificação.',
      rg: 'Informe o número do documento.',
      rg_orgao_emissor: 'Informe o órgão emissor.',
      rg_uf: 'Selecione a UF do documento.',
      estado_civil: 'Selecione o estado civil.',
      profissao: 'Informe a profissão.',
      nacionalidade: 'Informe a nacionalidade.',
      data_nascimento: 'Informe a data de nascimento.',
      cep: 'Informe um CEP válido (8 dígitos).',
      logradouro: 'Informe o logradouro.',
      numero: 'Informe o número do endereço.',
      bairro: 'Informe o bairro.',
      municipio: 'Informe o município.',
      uf: 'Selecione a UF do endereço.',
      telefone: 'Informe um telefone válido.',
      email: 'Informe um e-mail válido.',
      aceite_lgpd: 'É necessário marcar o aceite do tratamento de dados (LGPD).',
    }

    const payloadErroBackend = {
      error: 'Campos obrigatórios ausentes ou inválidos: rg_orgao_emissor, rg_uf.',
      campos: ['rg_orgao_emissor', 'rg_uf'],
      erros: {
        rg_orgao_emissor: 'Informe o órgão emissor.',
        rg_uf: 'Selecione a UF do documento.',
      },
    }

    const mapeados: Record<string, string> = {}
    for (const [campo, msg] of Object.entries(payloadErroBackend.erros)) {
      mapeados[campo] = msg || ROTULOS_CAMPO[campo] || 'Verifique este campo.'
    }

    expect(mapeados.rg_orgao_emissor).toBe('Informe o órgão emissor.')
    expect(mapeados.rg_uf).toBe('Selecione a UF do documento.')
    expect(mapeados.cpf).toBeUndefined()
  })

  it('trata erro 409 de CPF duplicado com mensagem padronizada', () => {
    const MENSAGEM_CPF_DUPLICADO = 'Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.'
    const respErro = {
      error: MENSAGEM_CPF_DUPLICADO,
      campos: ['cpf'],
      erros: { cpf: MENSAGEM_CPF_DUPLICADO },
    }

    const mapeados: Record<string, string> = {}
    if (respErro.erros?.cpf) {
      mapeados.cpf = respErro.erros.cpf
    }
    expect(mapeados.cpf).toBe('Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.')
  })

  it('extrai mensagem de erro e status HTTP mesmo em caso de erro 500 do servidor', async () => {
    const { extrairErroBackend } = await import('@/pages/CadastroClientePublico')

    const erro500ComMsg = {
      status: 500,
      response: {
        error:
          'Não foi possível processar o envio do cadastro. Por favor, tente novamente em instantes.',
      },
    }
    const extraido = extrairErroBackend(erro500ComMsg)
    expect(extraido.status).toBe(500)
    expect(extraido.error).toBe(
      'Não foi possível processar o envio do cadastro. Por favor, tente novamente em instantes.',
    )

    const msgBase = extraido.error || 'Não foi possível enviar o cadastro. Tente novamente.'
    const statusSufixo = extraido.status ? ` (cód. ${extraido.status})` : ''
    const msgExibida = `${msgBase}${statusSufixo}`

    expect(msgExibida).toContain('cód. 500')
    expect(msgExibida).toContain('Não foi possível processar o envio do cadastro')
  })

  it('extrai mensagem genérica e código de status se o erro for resposta padrão do PocketBase', async () => {
    const { extrairErroBackend } = await import('@/pages/CadastroClientePublico')

    const erroPbPadrao = {
      status: 500,
      data: {
        message: 'Something went wrong while processing your request.',
      },
    }
    const extraido = extrairErroBackend(erroPbPadrao)
    expect(extraido.status).toBe(500)
    expect(extraido.error).toBe('Something went wrong while processing your request.')

    const msgBase = extraido.error || 'Não foi possível enviar o cadastro. Tente novamente.'
    const statusSufixo = extraido.status ? ` (cód. ${extraido.status})` : ''
    const msgExibida = `${msgBase}${statusSufixo}`

    expect(msgExibida).toBe('Something went wrong while processing your request. (cód. 500)')
  })
})
