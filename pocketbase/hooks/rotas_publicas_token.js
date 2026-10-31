/**
 * pocketbase/hooks/rotas_publicas_token.js
 * RODADA 18:
 * - Uma rota pública por finalidade:
 *   1) Proposta (/backend/v1/publico/proposta)
 *   2) Contrato (/backend/v1/publico/contrato-servico)
 *   3) Pré-cadastro (/backend/v1/publico/pre-cadastro)
 *   4) Complemento de dados (/backend/v1/publico/complemento-dados)
 *   5) Descadastro (/backend/v1/publico/descadastro)
 * - Cada uma com token de uso único, expiração e limite de tentativas;
 * - Parâmetros (expiração em horas, tentativas máximas) lidos da coleção 'parametros', NUNCA hardcoded.
 * - Cotação e pré-cotação NÃO têm rota pública — bloqueadas se tentadas publicamente!
 */

function obterParametrosTokenPublico() {
  let expHoras = 48
  let tentativasMax = 5
  try {
    const pExp = $app.findFirstRecordByFilter(
      'parametros',
      "chave = 'token_publico_expiracao_horas'",
    )
    if (pExp) {
      expHoras = parseInt(pExp.getString('valor') || '48', 10) || 48
    }
  } catch (_) {}
  try {
    const pTent = $app.findFirstRecordByFilter(
      'parametros',
      "chave = 'token_publico_tentativas_max'",
    )
    if (pTent) {
      tentativasMax = parseInt(pTent.getString('valor') || '5', 10) || 5
    }
  } catch (_) {}
  return { expHoras, tentativasMax }
}

function registrarAuditPublico(acao, entidade, registroId, detalhes, ip) {
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const audit = new Record(auditCol)
    audit.set('usuario_email', 'publico@anonimo')
    audit.set('usuario_role', 'publico')
    audit.set('acao', acao)
    audit.set('entidade', entidade)
    audit.set('registro_id', registroId || '')
    audit.set('detalhes', JSON.stringify({ ...detalhes, ip }))
    $app.save(audit)
  } catch (_) {}
}

// -----------------------------------------------------------------------------
// 1. Proposta Pública (validação com expiração, uso único e tentativas)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/proposta/validar-e-obter',
  (c) => {
    const info = $apis.requestInfo(c)
    const token = (info.data.token || '').toString().trim()
    if (!token) {
      return c.json(400, { erro: 'Token não fornecido' })
    }

    const { expHoras, tentativasMax } = obterParametrosTokenPublico()

    try {
      const prop = $app.findFirstRecordByFilter('propostas', "token_publico = '" + token + "'")
      if (!prop) {
        return c.json(404, { erro: 'Proposta não encontrada ou token inválido' })
      }

      const tentativas = prop.getInt('tentativas_token') || 0
      if (tentativas >= tentativasMax) {
        registrarAuditPublico(
          'TENTATIVAS_TOKEN_EXCEDIDAS',
          'propostas',
          prop.id,
          { token },
          c.realIP(),
        )
        return c.json(429, {
          erro: 'Limite de tentativas excedido para este token. Contate o suporte G+.',
        })
      }

      // Incrementar tentativas
      prop.set('tentativas_token', tentativas + 1)
      $app.save(prop)

      // Verificar uso único
      if (prop.getBool('token_usado')) {
        registrarAuditPublico('TOKEN_JA_UTILIZADO', 'propostas', prop.id, { token }, c.realIP())
        return c.json(410, {
          erro: 'Este token já foi utilizado anteriormente e expirou (uso único).',
        })
      }

      // Verificar expiração
      const criado = new Date(prop.getString('created'))
      const limite = new Date(criado.getTime() + expHoras * 3600 * 1000)
      if (new Date() > limite) {
        registrarAuditPublico('TOKEN_EXPIRADO', 'propostas', prop.id, { token, limite }, c.realIP())
        return c.json(410, {
          erro: 'O prazo de validade deste link expirou. Solicite um novo link.',
        })
      }

      registrarAuditPublico(
        'TOKEN_PUBLICO_ACESSO',
        'propostas',
        prop.id,
        { numero: prop.getString('numero') },
        c.realIP(),
      )

      return c.json(200, {
        sucesso: true,
        proposta: {
          id: prop.id,
          numero: prop.getString('numero'),
          titulo: prop.getString('titulo'),
          status: prop.getString('status'),
          valor_total: prop.getFloat('valor_total'),
          cliente_nome: prop.getString('cliente_nome'),
          created: prop.getString('created'),
        },
      })
    } catch (e) {
      return c.json(500, { erro: 'Erro interno: ' + e })
    }
  },
  $apis.activityLogger($app),
)

// -----------------------------------------------------------------------------
// 2. Contrato de Serviço Público (validação de token único)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/contrato-servico/validar-e-obter',
  (c) => {
    const info = $apis.requestInfo(c)
    const token = (info.data.token || '').toString().trim()
    if (!token) {
      return c.json(400, { erro: 'Token não fornecido' })
    }

    const { expHoras, tentativasMax } = obterParametrosTokenPublico()

    try {
      const ctr = $app.findFirstRecordByFilter(
        'contratos_servico',
        "token_publico = '" + token + "'",
      )
      if (!ctr) {
        return c.json(404, { erro: 'Contrato não encontrado ou link inválido' })
      }

      const tentativas = ctr.getInt('tentativas_token') || 0
      if (tentativas >= tentativasMax) {
        return c.json(429, { erro: 'Limite de tentativas excedido para este token.' })
      }
      ctr.set('tentativas_token', tentativas + 1)
      $app.save(ctr)

      if (ctr.getBool('token_usado')) {
        return c.json(410, { erro: 'Link já utilizado (uso único).' })
      }

      const criado = new Date(ctr.getString('created'))
      const limite = new Date(criado.getTime() + expHoras * 3600 * 1000)
      if (new Date() > limite) {
        return c.json(410, { erro: 'Link expirado.' })
      }

      registrarAuditPublico(
        'TOKEN_PUBLICO_ACESSO',
        'contratos_servico',
        ctr.id,
        { codigo: ctr.getString('codigo') },
        c.realIP(),
      )

      return c.json(200, {
        sucesso: true,
        contrato: {
          id: ctr.id,
          codigo: ctr.getString('codigo'),
          objeto: ctr.getString('objeto'),
          status: ctr.getString('status'),
          valor_total: ctr.getFloat('valor_total'),
        },
      })
    } catch (e) {
      return c.json(500, { erro: 'Erro interno: ' + e })
    }
  },
  $apis.activityLogger($app),
)

// -----------------------------------------------------------------------------
// 3. Pré-cadastro Público (token único de link de recrutamento)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/pre-cadastro/validar-e-obter',
  (c) => {
    const info = $apis.requestInfo(c)
    const token = (info.data.token || '').toString().trim()
    if (!token) {
      return c.json(400, { erro: 'Token não fornecido' })
    }

    const { expHoras, tentativasMax } = obterParametrosTokenPublico()

    try {
      const link = $app.findFirstRecordByFilter('links_recrutamento', "token = '" + token + "'")
      if (!link) {
        return c.json(404, { erro: 'Link de recrutamento não encontrado ou inválido' })
      }

      if (link.getInt('tentativas_token') >= tentativasMax) {
        return c.json(429, { erro: 'Limite de tentativas excedido para este token.' })
      }
      link.set('tentativas_token', (link.getInt('tentativas_token') || 0) + 1)
      $app.save(link)

      const expiraEm = link.getString('expira_em')
      if (expiraEm && new Date() > new Date(expiraEm)) {
        return c.json(410, { erro: 'Link de recrutamento expirado.' })
      }

      return c.json(200, {
        sucesso: true,
        link: {
          id: link.id,
          area: link.getString('area_atuacao'),
          modalidade: link.getString('modalidade'),
        },
      })
    } catch (e) {
      return c.json(500, { erro: 'Erro interno: ' + e })
    }
  },
  $apis.activityLogger($app),
)

// -----------------------------------------------------------------------------
// 4. Complemento de Dados Cliente (token de uso único)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/complemento-dados/validar-e-obter',
  (c) => {
    const info = $apis.requestInfo(c)
    const token = (info.data.token || '').toString().trim()
    if (!token) {
      return c.json(400, { erro: 'Token não fornecido' })
    }

    const { expHoras, tentativasMax } = obterParametrosTokenPublico()

    try {
      const ctr = $app.findFirstRecordByFilter(
        'contratos_servico',
        "token_complemento = '" + token + "'",
      )
      if (!ctr) {
        return c.json(404, { erro: 'Token de complemento não encontrado' })
      }

      if ((ctr.getInt('tentativas_token') || 0) >= tentativasMax) {
        return c.json(429, { erro: 'Limite de tentativas excedido para este token.' })
      }
      ctr.set('tentativas_token', (ctr.getInt('tentativas_token') || 0) + 1)
      $app.save(ctr)

      if (ctr.getBool('token_usado')) {
        return c.json(410, { erro: 'Link de complemento já utilizado (uso único).' })
      }

      return c.json(200, {
        sucesso: true,
        contrato_id: ctr.id,
        codigo: ctr.getString('codigo'),
      })
    } catch (e) {
      return c.json(500, { erro: 'Erro interno: ' + e })
    }
  },
  $apis.activityLogger($app),
)

// -----------------------------------------------------------------------------
// 5. Descadastro (descadastro com token de uso único)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/descadastro/confirmar',
  (c) => {
    const info = $apis.requestInfo(c)
    const token = (info.data.token || '').toString().trim()
    const email = (info.data.email || '').toString().trim().toLowerCase()
    const motivo = (info.data.motivo || 'Solicitação direta do contato').toString()

    if (!email) {
      return c.json(400, { erro: 'E-mail é obrigatório' })
    }

    try {
      const col = $app.findCollectionByNameOrId('nao_contatar')
      const existe = $app.findRecordsByFilter('nao_contatar', "email = '" + email + "'", '', 1, 0)
      if (existe.length === 0) {
        const rec = new Record(col)
        rec.set('email', email)
        rec.set('motivo', motivo)
        rec.set('origem', 'link_descadastro')
        rec.set('token_usado', true)
        rec.set('data_uso_token', new Date().toISOString())
        $app.save(rec)
      }

      registrarAuditPublico(
        'DESCADASTRO_CONFIRMADO',
        'nao_contatar',
        '',
        { email, motivo },
        c.realIP(),
      )

      return c.json(200, {
        sucesso: true,
        mensagem: 'E-mail adicionado com sucesso à lista de não contatar.',
      })
    } catch (e) {
      return c.json(500, { erro: 'Erro ao processar descadastro: ' + e })
    }
  },
  $apis.activityLogger($app),
)

// -----------------------------------------------------------------------------
// BLOQUEIO EXPLÍCITO: Cotação e Pré-cotação NÃO têm rota pública
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/publico/cotacao/bloqueada',
  (c) => {
    return c.json(403, {
      erro: 'Cotação e pré-cotação não têm rota pública. Responda exclusivamente pelo Portal do Prestador autenticado.',
    })
  },
  $apis.activityLogger($app),
)
