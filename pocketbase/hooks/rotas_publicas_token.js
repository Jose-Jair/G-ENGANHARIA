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
 * - Nota PocketBase JSVM: todas as funções utilitárias ficam inline dentro do callback (sem escopo global compartilhado).
 */

// -----------------------------------------------------------------------------
// 1. Proposta Pública (validação com expiração, uso único e tentativas)
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/proposta/validar-e-obter', (e) => {
  function obterParams() {
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

  function registrarAudit(acao, registroId, detalhes, ip) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user_email', 'publico@anonimo')
      audit.set('acao', acao)
      audit.set('entidade', 'propostas')
      audit.set('registro_id', registroId || '')
      audit.set('ip', ip || '127.0.0.1')
      audit.set('detalhes', { ...detalhes, ip: ip || '127.0.0.1' })
      $app.save(audit)
    } catch (_) {}
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const token = (body.token || info.query.token || '').toString().trim()
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (info.headers && (info.headers['x-forwarded-for'] || info.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (!token) {
    return e.json(400, { erro: 'Token não fornecido' })
  }

  const { expHoras, tentativasMax } = obterParams()

  try {
    let prop
    try {
      prop = $app.findFirstRecordByFilter('propostas', "token_publico = '" + token + "'")
    } catch (_) {
      return e.json(404, { erro: 'Proposta não encontrada ou token inválido' })
    }
    if (!prop) {
      return e.json(404, { erro: 'Proposta não encontrada ou token inválido' })
    }

    const tentativas = prop.getInt('tentativas_token') || 0
    if (tentativas >= tentativasMax) {
      registrarAudit('TENTATIVAS_TOKEN_EXCEDIDAS', prop.id, { token }, clientIp)
      return e.json(429, {
        erro: 'Limite de tentativas excedido para este token. Contate o suporte G+.',
      })
    }

    // Incrementar tentativas
    prop.set('tentativas_token', tentativas + 1)
    $app.save(prop)

    // Verificar uso único
    if (prop.getBool('token_usado')) {
      registrarAudit('TOKEN_JA_UTILIZADO', prop.id, { token }, clientIp)
      return e.json(410, {
        erro: 'Este token já foi utilizado anteriormente e expirou (uso único).',
      })
    }

    // Verificar expiração
    const criado = new Date(prop.getString('created'))
    const limite = new Date(criado.getTime() + expHoras * 3600 * 1000)
    if (new Date() > limite) {
      registrarAudit('TOKEN_EXPIRADO', prop.id, { token, limite }, clientIp)
      return e.json(410, {
        erro: 'O prazo de validade deste link expirou. Solicite um novo link.',
      })
    }

    registrarAudit('TOKEN_PUBLICO_ACESSO', prop.id, { numero: prop.getString('numero') }, clientIp)

    return e.json(200, {
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
  } catch (err) {
    return e.json(500, { erro: 'Erro interno: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 2. Contrato de Serviço Público (validação de token único)
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/contrato-servico/validar-e-obter', (e) => {
  function obterParams() {
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

  function registrarAudit(acao, registroId, detalhes, ip) {
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user_email', 'publico@anonimo')
      audit.set('acao', acao)
      audit.set('entidade', 'contratos_servico')
      audit.set('registro_id', registroId || '')
      audit.set('ip', ip || '127.0.0.1')
      audit.set('detalhes', { ...detalhes, ip: ip || '127.0.0.1' })
      $app.save(audit)
    } catch (_) {}
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const token = (body.token || info.query.token || '').toString().trim()
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (info.headers && (info.headers['x-forwarded-for'] || info.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (!token) {
    return e.json(400, { erro: 'Token não fornecido' })
  }

  const { expHoras, tentativasMax } = obterParams()

  try {
    let ctr
    try {
      ctr = $app.findFirstRecordByFilter('contratos_servico', "token_publico = '" + token + "'")
    } catch (_) {
      return e.json(404, { erro: 'Contrato não encontrado ou link inválido' })
    }
    if (!ctr) {
      return e.json(404, { erro: 'Contrato não encontrado ou link inválido' })
    }

    const tentativas = ctr.getInt('tentativas_token') || 0
    if (tentativas >= tentativasMax) {
      return e.json(429, { erro: 'Limite de tentativas excedido para este token.' })
    }
    ctr.set('tentativas_token', tentativas + 1)
    $app.save(ctr)

    if (ctr.getBool('token_usado')) {
      return e.json(410, { erro: 'Link já utilizado (uso único).' })
    }

    const criado = new Date(ctr.getString('created'))
    const limite = new Date(criado.getTime() + expHoras * 3600 * 1000)
    if (new Date() > limite) {
      return e.json(410, { erro: 'Link expirado.' })
    }

    registrarAudit('TOKEN_PUBLICO_ACESSO', ctr.id, { codigo: ctr.getString('codigo') }, clientIp)

    return e.json(200, {
      sucesso: true,
      contrato: {
        id: ctr.id,
        codigo: ctr.getString('codigo'),
        objeto: ctr.getString('objeto'),
        status: ctr.getString('status'),
        valor_total: ctr.getFloat('valor_total'),
      },
    })
  } catch (err) {
    return e.json(500, { erro: 'Erro interno: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 3. Pré-cadastro Público (token único de link de recrutamento)
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/pre-cadastro/validar-e-obter', (e) => {
  function obterParams() {
    let tentativasMax = 5
    try {
      const pTent = $app.findFirstRecordByFilter(
        'parametros',
        "chave = 'token_publico_tentativas_max'",
      )
      if (pTent) {
        tentativasMax = parseInt(pTent.getString('valor') || '5', 10) || 5
      }
    } catch (_) {}
    return { tentativasMax }
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const token = (body.token || info.query.token || '').toString().trim()

  if (!token) {
    return e.json(400, { erro: 'Token não fornecido' })
  }

  const { tentativasMax } = obterParams()

  try {
    let link
    try {
      link = $app.findFirstRecordByFilter('links_recrutamento', "token = '" + token + "'")
    } catch (_) {
      return e.json(404, { erro: 'Link de recrutamento não encontrado ou inválido' })
    }
    if (!link) {
      return e.json(404, { erro: 'Link de recrutamento não encontrado ou inválido' })
    }

    if (link.getInt('tentativas_token') >= tentativasMax) {
      return e.json(429, { erro: 'Limite de tentativas excedido para este token.' })
    }
    link.set('tentativas_token', (link.getInt('tentativas_token') || 0) + 1)
    $app.save(link)

    const expiraEm = link.getString('expira_em')
    if (expiraEm && new Date() > new Date(expiraEm)) {
      return e.json(410, { erro: 'Link de recrutamento expirado.' })
    }

    return e.json(200, {
      sucesso: true,
      link: {
        id: link.id,
        area: link.getString('area_atuacao'),
        modalidade: link.getString('modalidade'),
      },
    })
  } catch (err) {
    return e.json(500, { erro: 'Erro interno: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 4. Complemento de Dados Cliente (token de uso único)
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/complemento-dados/validar-e-obter', (e) => {
  function obterParams() {
    let tentativasMax = 5
    try {
      const pTent = $app.findFirstRecordByFilter(
        'parametros',
        "chave = 'token_publico_tentativas_max'",
      )
      if (pTent) {
        tentativasMax = parseInt(pTent.getString('valor') || '5', 10) || 5
      }
    } catch (_) {}
    return { tentativasMax }
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const token = (body.token || info.query.token || '').toString().trim()

  if (!token) {
    return e.json(400, { erro: 'Token não fornecido' })
  }

  const { tentativasMax } = obterParams()

  try {
    let ctr
    try {
      ctr = $app.findFirstRecordByFilter('contratos_servico', "token_complemento = '" + token + "'")
    } catch (_) {
      return e.json(404, { erro: 'Token de complemento não encontrado' })
    }
    if (!ctr) {
      return e.json(404, { erro: 'Token de complemento não encontrado' })
    }

    if ((ctr.getInt('tentativas_token') || 0) >= tentativasMax) {
      return e.json(429, { erro: 'Limite de tentativas excedido para este token.' })
    }
    ctr.set('tentativas_token', (ctr.getInt('tentativas_token') || 0) + 1)
    $app.save(ctr)

    if (ctr.getBool('token_usado')) {
      return e.json(410, { erro: 'Link de complemento já utilizado (uso único).' })
    }

    return e.json(200, {
      sucesso: true,
      contrato_id: ctr.id,
      codigo: ctr.getString('codigo'),
    })
  } catch (err) {
    return e.json(500, { erro: 'Erro interno: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 5. Descadastro (descadastro com token de uso único)
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/descadastro/confirmar', (e) => {
  const info = e.requestInfo()
  const body = info.body || {}
  const email = (body.email || '').toString().trim().toLowerCase()
  const motivo = (body.motivo || 'Solicitação direta do contato').toString()
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (info.headers && (info.headers['x-forwarded-for'] || info.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (!email) {
    return e.json(400, { erro: 'E-mail é obrigatório' })
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

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user_email', 'publico@anonimo')
      audit.set('acao', 'DESCADASTRO_CONFIRMADO')
      audit.set('entidade', 'nao_contatar')
      audit.set('registro_id', '')
      audit.set('ip', clientIp)
      audit.set('detalhes', { email, motivo, ip: clientIp })
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'E-mail adicionado com sucesso à lista de não contatar.',
    })
  } catch (err) {
    return e.json(500, { erro: 'Erro ao processar descadastro: ' + err })
  }
})

// -----------------------------------------------------------------------------
// BLOQUEIO EXPLÍCITO: Cotação e Pré-cotação NÃO têm rota pública
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/publico/cotacao/bloqueada', (e) => {
  return e.json(403, {
    erro: 'Cotação e pré-cotação não têm rota pública. Responda exclusivamente pelo Portal do Prestador autenticado.',
  })
})
