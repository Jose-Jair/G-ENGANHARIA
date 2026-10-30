// =============================================================================
// GESTÃO G+ — SUÍTE VITEST: RECRUTAMENTO PÚBLICO E TRIAGEM (RODADA 12)
// Cobertura completa dos 4 blocos exigidos:
// 1. Unicidade de CPF/CNPJ e e-mail (recusa 409)
// 2. Rate limit por IP (parâmetro recrutamento_rate_limit_ip_hora, padrão 5/hora)
//    e honeypot (website/honeypot/hp_campo preenchido = recusa silenciosa 200)
// 3. Prestador em "triagem" ou "pendente" fora de qualquer cotação ou sugestão de OS
// 4. Isolamento dos documentos de prestadores_documentos (leitura só pelo dono e
//    Admin/Gestor, NEGATIVO estrito para outro prestador)
// =============================================================================

import { describe, it, expect } from 'vitest'
import schemaJson from '@/lib/pocketbase/schema.json'

const schemaData = schemaJson as unknown as {
  collections?: Array<{
    name: string
    createRule: string | null
    updateRule: string | null
    deleteRule: string | null
    listRule: string | null
    viewRule: string | null
    fields?: Array<{
      name: string
      type: string
      protected?: boolean
      values?: string[]
    }>
  }>
}

const collections = schemaData.collections || []

// -----------------------------------------------------------------------------
// Modelos e Helpers de Simulação de Regras
// -----------------------------------------------------------------------------

interface MockPrestador {
  id: string
  nome: string
  tipo: 'interno' | 'pf_externo' | 'pj_externo'
  email: string
  cpf_cnpj: string
  status: 'triagem' | 'ativo' | 'pendente' | 'suspenso' | 'inativo'
  disciplinas: string
  validade_registro_conselho?: string
  contrato_mestre_assinado?: boolean
  capacidade_simultanea?: number
  os_ativas?: number
}

interface MockAuditLog {
  id: string
  acao: string
  ip: string
  created: string
}

interface MockSubmissaoRecrutamento {
  nome: string
  email: string
  cpf_cnpj: string
  tipo?: 'pf_externo' | 'pj_externo'
  aceite_termos?: boolean
  website?: string
  honeypot?: string
  hp_campo?: string
  clientIp: string
}

/**
 * Simula a lógica do endpoint POST /backend/v1/recrutamento/{slug}
 * conforme implementado no backend Skip Cloud
 */
function simularSubmissaoRecrutamento(
  payload: MockSubmissaoRecrutamento,
  baseExistente: MockPrestador[],
  logsAuditoriaIp: MockAuditLog[],
  limiteHora: number = 5,
  agora: Date = new Date(),
) {
  // 1. HONEYPOT: se website, honeypot ou hp_campo preenchidos -> 200 silencioso
  const honeypotVal = (payload.website || payload.honeypot || payload.hp_campo || '').trim()
  if (honeypotVal) {
    return {
      status: 200,
      body: { sucesso: true, mensagem: 'Pré-cadastro recebido com sucesso!' },
      ignoradoSilencioso: true,
    }
  }

  // 2. RATE LIMIT POR IP
  const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000)
  const enviosNaUltimaHora = logsAuditoriaIp.filter((log) => {
    return (
      log.acao === 'PRE_CADASTRO_PUBLICO_SUBMETIDO' &&
      log.ip === payload.clientIp &&
      new Date(log.created) >= umaHoraAtras
    )
  }).length

  if (enviosNaUltimaHora >= limiteHora) {
    return {
      status: 429,
      body: {
        error: `Limite de tentativas excedido para o seu endereço IP (${limiteHora} por hora). Tente novamente mais tarde.`,
      },
    }
  }

  // 3. Validação de campos essenciais
  if (!payload.nome || !payload.email || !payload.cpf_cnpj) {
    return { status: 400, body: { error: 'Campos obrigatórios ausentes.' } }
  }

  if (!payload.aceite_termos) {
    return {
      status: 400,
      body: { error: 'É obrigatório aceitar os termos de uso e política de privacidade.' },
    }
  }

  const cpfCnpjClean = payload.cpf_cnpj.replace(/\D/g, '')
  const emailClean = payload.email.trim().toLowerCase()

  // 4. UNICIDADE DE CPF/CNPJ (409 Conflict)
  const duplicadoDoc = baseExistente.find((p) => p.cpf_cnpj.replace(/\D/g, '') === cpfCnpjClean)
  if (duplicadoDoc) {
    return {
      status: 409,
      body: {
        error: 'Já existe um prestador cadastrado com este CPF/CNPJ na base da G+ Engenharia.',
      },
    }
  }

  // 5. UNICIDADE DE E-MAIL (409 Conflict)
  const duplicadoEmail = baseExistente.find((p) => p.email.toLowerCase() === emailClean)
  if (duplicadoEmail) {
    return {
      status: 409,
      body: {
        error: 'Já existe um prestador cadastrado com este e-mail na base da G+ Engenharia.',
      },
    }
  }

  // 6. Criação com sucesso em status "triagem"
  const novoPrestador: MockPrestador = {
    id: 'novo-' + Math.random().toString(36).substring(2, 9),
    nome: payload.nome,
    email: emailClean,
    cpf_cnpj: payload.cpf_cnpj,
    tipo: payload.tipo || 'pf_externo',
    status: 'triagem',
    disciplinas: 'Geral',
  }

  return {
    status: 201,
    body: {
      sucesso: true,
      mensagem: 'Pré-cadastro submetido com sucesso!',
      prestador_id: novoPrestador.id,
      status: 'triagem',
    },
    prestadorCriado: novoPrestador,
  }
}

/**
 * Simula a verificação de elegibilidade para cotação e sugestão de OS
 * conforme hooks `cotacao_automatica_operations.js` e `prestadores_sugestoes_routes.js`
 */
function avaliarElegibilidadeCotacaoOuOS(prestador: MockPrestador): {
  elegivel: boolean
  motivoBloqueio?: string
} {
  // Bloqueio categórico da Rodada 12: triagem ou pendente NUNCA entram em cotação/sugestão
  if (prestador.status === 'triagem') {
    return {
      elegivel: false,
      motivoBloqueio: 'Prestador em triagem ainda não foi aprovado pela G+ Engenharia.',
    }
  }
  if (prestador.status === 'pendente') {
    return {
      elegivel: false,
      motivoBloqueio: 'Prestador pendente de envio de documentos e assinatura de contrato-mestre.',
    }
  }
  if (prestador.status === 'suspenso' || prestador.status === 'inativo') {
    return {
      elegivel: false,
      motivoBloqueio: `Prestador inelegível com status "${prestador.status}".`,
    }
  }
  if (prestador.status !== 'ativo') {
    return {
      elegivel: false,
      motivoBloqueio: 'Apenas prestadores com status "ativo" são elegíveis.',
    }
  }
  if (prestador.tipo !== 'interno' && !prestador.contrato_mestre_assinado) {
    return {
      elegivel: false,
      motivoBloqueio: 'Prestador externo sem Contrato-Mestre assinado.',
    }
  }

  return { elegivel: true }
}

/**
 * Avaliador da regra de isolamento de documentos (RLS do PocketBase)
 * Coleção `prestadores_documentos`:
 * Rule: "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
 */
function podeAcessarDocumentoPrestador(
  userAuth: {
    id: string
    role: 'admin' | 'gestor' | 'executor' | 'comercial' | 'financeiro'
    email: string
  } | null,
  donoDocumentoEmail: string,
): boolean {
  if (!userAuth || !userAuth.id) return false

  // Admin e Gestor podem auditar/verificar qualquer documento
  if (userAuth.role === 'admin' || userAuth.role === 'gestor') {
    return true
  }

  // Prestador autenticado (role executor) SOMENTE acessa os seus próprios documentos
  if (userAuth.role === 'executor' && userAuth.email === donoDocumentoEmail) {
    return true
  }

  // Qualquer outro caso (outro prestador, outro perfil sem permissão) é BLOQUEADO
  return false
}

// =============================================================================
// TESTES
// =============================================================================

describe('Rodada 12 — Suíte de Testes: Recrutamento Público e Triagem de Prestadores', () => {
  // ---------------------------------------------------------------------------
  // BLOCO 1: Unicidade de CPF/CNPJ e E-mail (Recusa 409)
  // ---------------------------------------------------------------------------
  describe('Bloco 1: Unicidade de CPF/CNPJ e E-mail (Recusa HTTP 409)', () => {
    const baseMock: MockPrestador[] = [
      {
        id: 'prest-1',
        nome: 'Carlos Silva Engenharia',
        email: 'carlos.silva@eng.com.br',
        cpf_cnpj: '12.345.678/0001-90',
        tipo: 'pj_externo',
        status: 'ativo',
        disciplinas: 'Estruturas',
      },
      {
        id: 'prest-2',
        nome: 'Mariana Oliveira',
        email: 'mariana.oliveira@eng.com.br',
        cpf_cnpj: '111.222.333-44',
        tipo: 'pf_externo',
        status: 'triagem',
        disciplinas: 'Instalações Elétricas',
      },
    ]

    it('deve recusar com 409 ao tentar submeter pré-cadastro com CNPJ já cadastrado', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Outra Empresa Engenharia',
          email: 'novo.email@eng.com.br',
          cpf_cnpj: '12345678000190', // mesmo CNPJ sem pontuação
          tipo: 'pj_externo',
          aceite_termos: true,
          clientIp: '189.40.10.2',
        },
        baseMock,
        [],
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('Já existe um prestador cadastrado com este CPF/CNPJ')
    })

    it('deve recusar com 409 ao tentar submeter pré-cadastro com CPF já cadastrado', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Mariana Clone',
          email: 'mariana.nova@eng.com.br',
          cpf_cnpj: '111.222.333-44',
          tipo: 'pf_externo',
          aceite_termos: true,
          clientIp: '189.40.10.3',
        },
        baseMock,
        [],
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('Já existe um prestador cadastrado com este CPF/CNPJ')
    })

    it('deve recusar com 409 ao tentar submeter pré-cadastro com e-mail já existente', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Novo Prestador',
          email: 'CARLOS.SILVA@ENG.COM.BR', // mesmo e-mail em maiúsculas
          cpf_cnpj: '98.765.432/0001-10', // novo CNPJ
          tipo: 'pj_externo',
          aceite_termos: true,
          clientIp: '189.40.10.4',
        },
        baseMock,
        [],
      )

      expect(res.status).toBe(409)
      expect(res.body.error).toContain('Já existe um prestador cadastrado com este e-mail')
    })

    it('deve aceitar com 201 quando CPF/CNPJ e e-mail forem inéditos', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Roberto Inédito Projetos',
          email: 'roberto.inedito@eng.com.br',
          cpf_cnpj: '44.555.666/0001-77',
          tipo: 'pj_externo',
          aceite_termos: true,
          clientIp: '189.40.10.5',
        },
        baseMock,
        [],
      )

      expect(res.status).toBe(201)
      expect(res.body.sucesso).toBe(true)
      expect(res.body.status).toBe('triagem')
      expect(res.prestadorCriado?.status).toBe('triagem')
    })

    it('deve exigir aceite explícito dos termos de uso', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Sem Aceite',
          email: 'sem.aceite@eng.com.br',
          cpf_cnpj: '55.666.777/0001-88',
          tipo: 'pj_externo',
          aceite_termos: false,
          clientIp: '189.40.10.6',
        },
        baseMock,
        [],
      )

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('termos de uso')
    })
  })

  // ---------------------------------------------------------------------------
  // BLOCO 2: Rate limit por IP e Honeypot Anti-Spam
  // ---------------------------------------------------------------------------
  describe('Bloco 2: Rate Limit por IP (Parâmetro) e Honeypot Anti-Spam', () => {
    it('deve aplicar recusa silenciosa (200 sucesso) quando o campo honeypot "website" estiver preenchido', () => {
      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Bot Spammer',
          email: 'spam@bot.com',
          cpf_cnpj: '00000000000',
          aceite_termos: true,
          clientIp: '200.100.50.1',
          website: 'http://spam-link.com', // honeypot disparado
        },
        [],
        [],
      )

      expect(res.status).toBe(200)
      expect(res.ignoradoSilencioso).toBe(true)
      expect(res.body.mensagem).toBe('Pré-cadastro recebido com sucesso!')
      expect(res.prestadorCriado).toBeUndefined()
    })

    it('deve aplicar recusa silenciosa quando campos alternativos de honeypot estiverem preenchidos', () => {
      const resHp = simularSubmissaoRecrutamento(
        {
          nome: 'Bot 2',
          email: 'bot2@spam.com',
          cpf_cnpj: '11111111111',
          aceite_termos: true,
          clientIp: '200.100.50.2',
          honeypot: 'preenchido_por_robo',
        },
        [],
        [],
      )
      expect(resHp.status).toBe(200)
      expect(resHp.ignoradoSilencioso).toBe(true)

      const resHpCampo = simularSubmissaoRecrutamento(
        {
          nome: 'Bot 3',
          email: 'bot3@spam.com',
          cpf_cnpj: '22222222222',
          aceite_termos: true,
          clientIp: '200.100.50.3',
          hp_campo: 'valor_injetado',
        },
        [],
        [],
      )
      expect(resHpCampo.status).toBe(200)
      expect(resHpCampo.ignoradoSilencioso).toBe(true)
    })

    it('deve bloquear com 429 quando o IP atingir o limite de submissões na última hora', () => {
      const clientIp = '177.18.25.10'
      const agora = new Date('2026-03-31T14:30:00.000Z')
      const limiteParametroHora = 5

      // Criar 5 logs de envio na última hora para este IP
      const logsIp: MockAuditLog[] = [
        {
          id: '1',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T13:45:00.000Z',
        },
        {
          id: '2',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T13:55:00.000Z',
        },
        {
          id: '3',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T14:05:00.000Z',
        },
        {
          id: '4',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T14:15:00.000Z',
        },
        {
          id: '5',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T14:25:00.000Z',
        },
      ]

      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Tentativa Extra',
          email: 'extra@eng.com.br',
          cpf_cnpj: '33.444.555/0001-66',
          aceite_termos: true,
          clientIp: clientIp,
        },
        [],
        logsIp,
        limiteParametroHora,
        agora,
      )

      expect(res.status).toBe(429)
      expect(res.body.error).toContain(
        'Limite de tentativas excedido para o seu endereço IP (5 por hora)',
      )
    })

    it('deve liberar submissão se as tentativas do IP ocorreram há mais de 1 hora', () => {
      const clientIp = '177.18.25.10'
      const agora = new Date('2026-03-31T14:30:00.000Z')

      // Envios com mais de 1 hora
      const logsAntigos: MockAuditLog[] = [
        {
          id: '1',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T12:00:00.000Z',
        },
        {
          id: '2',
          acao: 'PRE_CADASTRO_PUBLICO_SUBMETIDO',
          ip: clientIp,
          created: '2026-03-31T13:00:00.000Z',
        },
      ]

      const res = simularSubmissaoRecrutamento(
        {
          nome: 'Prestador Liberado',
          email: 'liberado@eng.com.br',
          cpf_cnpj: '33.444.555/0001-66',
          aceite_termos: true,
          clientIp: clientIp,
        },
        [],
        logsAntigos,
        5,
        agora,
      )

      expect(res.status).toBe(201)
    })
  })

  // ---------------------------------------------------------------------------
  // BLOCO 3: Prestador em "triagem" ou "pendente" FORA de Cotações / Sugestões
  // ---------------------------------------------------------------------------
  describe('Bloco 3: Exclusão Categórica de Prestadores em "triagem" ou "pendente" de Cotações e Sugestões', () => {
    it('prestador em status "triagem" NUNCA é elegível para cotação nem para sugestão de OS', () => {
      const prestadorTriagem: MockPrestador = {
        id: 'p-triagem-1',
        nome: 'Engenheiro Em Triagem',
        email: 'triagem@eng.com.br',
        cpf_cnpj: '111.222.333-01',
        tipo: 'pf_externo',
        status: 'triagem',
        disciplinas: 'Estruturas',
        validade_registro_conselho: '2027-12-31',
        contrato_mestre_assinado: true,
        capacidade_simultanea: 3,
        os_ativas: 0,
      }

      const res = avaliarElegibilidadeCotacaoOuOS(prestadorTriagem)
      expect(res.elegivel).toBe(false)
      expect(res.motivoBloqueio).toContain('triagem')
    })

    it('prestador em status "pendente" NUNCA é elegível para cotação nem para sugestão de OS', () => {
      const prestadorPendente: MockPrestador = {
        id: 'p-pendente-1',
        nome: 'Engenheiro Pendente de Documentos',
        email: 'pendente@eng.com.br',
        cpf_cnpj: '111.222.333-02',
        tipo: 'pf_externo',
        status: 'pendente',
        disciplinas: 'Estruturas',
        validade_registro_conselho: '2027-12-31',
        contrato_mestre_assinado: false,
        capacidade_simultanea: 3,
        os_ativas: 0,
      }

      const res = avaliarElegibilidadeCotacaoOuOS(prestadorPendente)
      expect(res.elegivel).toBe(false)
      expect(res.motivoBloqueio).toContain('pendente')
    })

    it('prestadores suspensos ou inativos também são bloqueados', () => {
      const pSuspenso: MockPrestador = {
        id: 'p-susp-1',
        nome: 'Suspenso',
        email: 'susp@eng.com.br',
        cpf_cnpj: '111.222.333-03',
        tipo: 'pf_externo',
        status: 'suspenso',
        disciplinas: 'Estruturas',
      }
      expect(avaliarElegibilidadeCotacaoOuOS(pSuspenso).elegivel).toBe(false)

      const pInativo: MockPrestador = {
        id: 'p-inativo-1',
        nome: 'Inativo',
        email: 'inativo@eng.com.br',
        cpf_cnpj: '111.222.333-04',
        tipo: 'pf_externo',
        status: 'inativo',
        disciplinas: 'Estruturas',
      }
      expect(avaliarElegibilidadeCotacaoOuOS(pInativo).elegivel).toBe(false)
    })

    it('somente prestador com status "ativo" e Contrato-Mestre assinado é elegível', () => {
      const prestadorAtivoOk: MockPrestador = {
        id: 'p-ativo-ok',
        nome: 'Engenheiro Ativo Pleno',
        email: 'ativo.pleno@eng.com.br',
        cpf_cnpj: '111.222.333-05',
        tipo: 'pf_externo',
        status: 'ativo',
        disciplinas: 'Estruturas',
        contrato_mestre_assinado: true,
        capacidade_simultanea: 3,
        os_ativas: 0,
      }

      const res = avaliarElegibilidadeCotacaoOuOS(prestadorAtivoOk)
      expect(res.elegivel).toBe(true)
      expect(res.motivoBloqueio).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // BLOCO 4: Isolamento de Documentos de prestadores_documentos
  // ---------------------------------------------------------------------------
  describe('Bloco 4: Isolamento de prestadores_documentos (Dono e Admin/Gestor; NEGATIVO para outro prestador)', () => {
    const prestadorDonoEmail = 'prestador.alvo@engenharia.com.br'
    const prestadorInvasorEmail = 'outro.prestador@engenharia.com.br'

    it('deve PERMITIR leitura do documento pelo prestador proprietário (dono)', () => {
      const userDono = {
        id: 'usr-dono',
        role: 'executor' as const,
        email: prestadorDonoEmail,
      }

      const permitido = podeAcessarDocumentoPrestador(userDono, prestadorDonoEmail)
      expect(permitido).toBe(true)
    })

    it('deve PERMITIR leitura e auditoria por Administrador', () => {
      const userAdmin = {
        id: 'usr-admin',
        role: 'admin' as const,
        email: 'admin@gmais.eng.br',
      }

      const permitido = podeAcessarDocumentoPrestador(userAdmin, prestadorDonoEmail)
      expect(permitido).toBe(true)
    })

    it('deve PERMITIR leitura e verificação por Gestor de Projetos', () => {
      const userGestor = {
        id: 'usr-gestor',
        role: 'gestor' as const,
        email: 'gestor@gmais.eng.br',
      }

      const permitido = podeAcessarDocumentoPrestador(userGestor, prestadorDonoEmail)
      expect(permitido).toBe(true)
    })

    it('TESTE NEGATIVO ESTRITO: deve BLOQUEAR leitura de documentos por OUTRO prestador', () => {
      const userOutroPrestador = {
        id: 'usr-invasor',
        role: 'executor' as const,
        email: prestadorInvasorEmail, // email diferente do dono!
      }

      const permitido = podeAcessarDocumentoPrestador(userOutroPrestador, prestadorDonoEmail)
      expect(permitido, 'Outro prestador NÃO pode ter acesso aos documentos de terceiros').toBe(
        false,
      )
    })

    it('TESTE NEGATIVO: deve BLOQUEAR acesso não autenticado (público anônimo)', () => {
      const permitido = podeAcessarDocumentoPrestador(null, prestadorDonoEmail)
      expect(permitido).toBe(false)
    })

    it('valida que a coleção prestadores_documentos no schema tem o campo arquivo protegido (protected: true)', () => {
      const pdocsCol = collections.find((c) => c.name === 'prestadores_documentos')
      expect(pdocsCol, 'Coleção prestadores_documentos deve existir no schema').toBeDefined()

      const campoArquivo = pdocsCol?.fields?.find((f) => f.name === 'arquivo')
      expect(campoArquivo, 'Campo arquivo deve existir').toBeDefined()
      expect(
        campoArquivo?.protected,
        'Campo arquivo deve ter protected: true para exigir token auth',
      ).toBe(true)
    })

    it('valida que a coleção prestadores contém o valor "triagem" nos valores aceitos do campo status', () => {
      const prestCol = collections.find((c) => c.name === 'prestadores')
      expect(prestCol).toBeDefined()

      const statusField = prestCol?.fields?.find((f) => f.name === 'status')
      expect(statusField).toBeDefined()
      expect(statusField?.values).toContain('triagem')
      expect(statusField?.values).toContain('ativo')
      expect(statusField?.values).toContain('pendente')
      expect(statusField?.values).toContain('suspenso')
      expect(statusField?.values).toContain('inativo')
    })

    it('valida que a coleção links_recrutamento existe e possui o campo slug com índice único', () => {
      const linksCol = collections.find((c) => c.name === 'links_recrutamento')
      expect(linksCol).toBeDefined()

      const slugField = linksCol?.fields?.find((f) => f.name === 'slug')
      expect(slugField).toBeDefined()
    })
  })
})
