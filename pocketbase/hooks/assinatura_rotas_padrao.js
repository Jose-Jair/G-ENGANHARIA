// pocketbase/hooks/assinatura_rotas_padrao.js
// =============================================================================
// GESTÃO G+ — ROTAS NATIVAS DE ASSINATURA ELETRÔNICA COM OTP E DOSSIÊ DE EVIDÊNCIAS
// Padrão Jurídico Único (MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020)
//
// Rotas registradas:
// 1. Solicitação de código OTP:
//    - POST /backend/v1/ordens-servico/{id}/solicitar-codigo-aceite
//    - POST /backend/v1/contratos-mestre/{id}/solicitar-codigo-aceite
//    - POST /backend/v1/contratos-servico/solicitar-codigo-aceite/{id}
// 2. Aceite simplificado de OS interna:
//    - POST /backend/v1/ordens-servico/{id}/aceite-interno
// 3. Exportação de Dossiê de Evidências Digitais (Admin e Gestor):
//    - GET /backend/v1/ordens-servico/{id}/dossie-evidencias
//    - GET /backend/v1/contratos-mestre/{id}/dossie-evidencias
//    - GET /backend/v1/contratos-servico/dossie-evidencias/{id}
// =============================================================================

// -----------------------------------------------------------------------------
// 1. SOLICITAÇÃO DE CÓDIGO OTP (OS, CM, CS)
// -----------------------------------------------------------------------------

routerAdd('POST', '/backend/v1/ordens-servico/{id}/solicitar-codigo-aceite', (e) => {
  try {
    const osId = e.request.pathValue('id')
    let osRec
    try {
      osRec = $app.findRecordById('ordens_servico', osId)
    } catch (_) {
      return e.json(404, { error: 'Ordem de Serviço não encontrada.' })
    }

    const reqInfo = e.requestInfo()
    const token = ((reqInfo.body && reqInfo.body.token) || reqInfo.query.token || '').trim()
    const tokenEsperado = osRec.getString('token_assinatura')
    const authUser = reqInfo.auth

    let autorizado = false
    let prestadorRec = null

    const prestadorId = osRec.getString('prestador')
    if (prestadorId) {
      try {
        prestadorRec = $app.findRecordById('prestadores', prestadorId)
      } catch (_) {}
    }

    if (token && tokenEsperado && token === tokenEsperado) {
      autorizado = true
    } else if (authUser) {
      const role = authUser.getString('role')
      if (role === 'admin' || role === 'gestor') {
        autorizado = true
      } else if (prestadorRec && prestadorRec.getString('email') === authUser.getString('email')) {
        autorizado = true
      }
    }

    if (!autorizado) {
      return e.json(403, { error: 'Token inválido ou acesso não autorizado à Ordem de Serviço.' })
    }

    let emailDestino = ''
    let nomeDestino = ''
    if (prestadorRec) {
      emailDestino = prestadorRec.getString('email')
      nomeDestino =
        prestadorRec.getString('nome') || prestadorRec.getString('razao_social') || 'Prestador'
    }

    if (!emailDestino || emailDestino.indexOf('@') === -1) {
      return e.json(400, {
        error:
          'O prestador desta OS não possui e-mail cadastrado para recebimento do código de verificação.',
      })
    }

    if (osRec.getString('aceite_status') === 'aceito') {
      return e.json(400, { error: 'Esta Ordem de Serviço já foi aceita e assinada.' })
    }

    // Gerar código OTP de 6 dígitos numéricos
    const numRandom = Math.floor(100000 + Math.random() * 900000)
    const codigoOtp = String(numRandom)
    const codigoHash = $security.sha256(codigoOtp)
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    osRec.set('codigo_verificacao_hash', codigoHash)
    osRec.set('codigo_expiracao', expiraEm)
    osRec.set('codigo_tentativas', 0)
    osRec.set('codigo_enviado_para', emailDestino)
    $app.save(osRec)

    // Envio de e-mail transacional
    let emailEnviado = false
    try {
      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

      const htmlBody =
        '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
        '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
        '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
        '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Código de Verificação de Assinatura Eletrônica (OTP)</p>' +
        '</td></tr>' +
        '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
        '<p>Olá, <strong>' +
        (nomeDestino || 'Signatário') +
        '</strong>!</p>' +
        '<p>Você solicitou a formalização eletrônica da <strong>Ordem de Serviço nº ' +
        osRec.getString('numero') +
        '</strong>.</p>' +
        '<p>Utilize o código de segurança de 6 dígitos abaixo para confirmar sua assinatura com validade jurídica plena (MP 2.200-2/2001 e Lei 14.063/2020):</p>' +
        '<div style="margin:24px 0;text-align:center;">' +
        '<span style="background-color:#f1f5f9;border:2px dashed #D95A2B;color:#1E2A4A;font-weight:bold;letter-spacing:6px;font-size:28px;padding:12px 28px;border-radius:8px;display:inline-block;font-family:monospace;">' +
        codigoOtp +
        '</span>' +
        '</div>' +
        '<p style="font-size:12px;color:#64748b;">Este código é pessoal e expira em <strong>10 minutos</strong>. Limite de 5 tentativas.</p>' +
        '</td></tr>' +
        '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
        'G+ Engenharia Consultiva • Plataforma Digital' +
        '</td></tr>' +
        '</table></body></html>'

      const msg = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: emailDestino, name: nomeDestino || emailDestino }],
        subject:
          'Código de Confirmação: ' +
          codigoOtp +
          ' para assinatura da OS ' +
          osRec.getString('numero'),
        html: htmlBody,
      })

      $app.newMailClient().send(msg)
      emailEnviado = true
    } catch (eMail) {
      console.log('Aviso: Falha ao enviar e-mail OTP para ' + emailDestino + ': ' + eMail)
    }

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', authUser ? authUser.id : null)
      aRec.set('user_email', authUser ? authUser.getString('email') : emailDestino)
      aRec.set('acao', 'SOLICITACAO_OTP_OS')
      aRec.set('entidade', 'ordens_servico')
      aRec.set('registro_id', osRec.id)
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        numero_os: osRec.getString('numero'),
        destinatario: emailDestino,
        expiracao: expiraEm,
        email_enviado: emailEnviado,
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Código de verificação enviado para o e-mail cadastrado.',
      email_mascarado: emailDestino.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      expira_em: expiraEm,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao solicitar código de aceite da OS: ' + err })
  }
})

routerAdd('POST', '/backend/v1/contratos-mestre/{id}/solicitar-codigo-aceite', (e) => {
  try {
    const cmId = e.request.pathValue('id')
    let cmRec
    try {
      cmRec = $app.findRecordById('contratos_mestre', cmId)
    } catch (_) {
      return e.json(404, { error: 'Contrato-Mestre não encontrado.' })
    }

    const reqInfo = e.requestInfo()
    const token = ((reqInfo.body && reqInfo.body.token) || reqInfo.query.token || '').trim()
    const tokenEsperado = cmRec.getString('token_assinatura')
    const authUser = reqInfo.auth

    let autorizado = false
    let prestadorRec = null

    const prestadorId = cmRec.getString('prestador')
    if (prestadorId) {
      try {
        prestadorRec = $app.findRecordById('prestadores', prestadorId)
      } catch (_) {}
    }

    if (token && tokenEsperado && token === tokenEsperado) {
      autorizado = true
    } else if (authUser) {
      const role = authUser.getString('role')
      if (role === 'admin' || role === 'gestor') {
        autorizado = true
      } else if (prestadorRec && prestadorRec.getString('email') === authUser.getString('email')) {
        autorizado = true
      }
    }

    if (!autorizado) {
      return e.json(403, { error: 'Token inválido ou acesso não autorizado ao Contrato-Mestre.' })
    }

    let emailDestino = ''
    let nomeDestino = ''
    if (prestadorRec) {
      emailDestino = prestadorRec.getString('email')
      nomeDestino =
        prestadorRec.getString('nome') || prestadorRec.getString('razao_social') || 'Prestador'
    }

    if (!emailDestino || emailDestino.indexOf('@') === -1) {
      return e.json(400, {
        error: 'O prestador deste contrato não possui e-mail cadastrado para verificação.',
      })
    }

    const numRandom = Math.floor(100000 + Math.random() * 900000)
    const codigoOtp = String(numRandom)
    const codigoHash = $security.sha256(codigoOtp)
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    cmRec.set('codigo_verificacao_hash', codigoHash)
    cmRec.set('codigo_expiracao', expiraEm)
    cmRec.set('codigo_tentativas', 0)
    cmRec.set('codigo_enviado_para', emailDestino)
    $app.save(cmRec)

    try {
      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

      const htmlBody =
        '<p>Olá, <strong>' +
        (nomeDestino || 'Signatário') +
        '</strong>!</p>' +
        '<p>Seu código para assinar o Contrato-Mestre nº <strong>' +
        cmRec.getString('numero') +
        '</strong> é:</p>' +
        '<h2 style="font-size:26px;letter-spacing:4px;color:#1E2A4A;">' +
        codigoOtp +
        '</h2>' +
        '<p>Válido por 10 minutos.</p>'

      const msg = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: emailDestino, name: nomeDestino || emailDestino }],
        subject:
          'Código de Confirmação: ' +
          codigoOtp +
          ' para assinatura do Contrato-Mestre ' +
          cmRec.getString('numero'),
        html: htmlBody,
      })
      $app.newMailClient().send(msg)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Código de verificação enviado para o e-mail cadastrado.',
      email_mascarado: emailDestino.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      expira_em: expiraEm,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao solicitar código do Contrato-Mestre: ' + err })
  }
})

routerAdd('POST', '/backend/v1/contratos-servico/solicitar-codigo-aceite/{id}', (e) => {
  try {
    const csId = e.request.pathValue('id')
    let csRec
    try {
      csRec = $app.findRecordById('contratos_servico', csId)
    } catch (_) {
      return e.json(404, { error: 'Contrato de Serviço não encontrado.' })
    }

    const reqInfo = e.requestInfo()
    const token = ((reqInfo.body && reqInfo.body.token) || reqInfo.query.token || '').trim()
    const tokenEsperado = csRec.getString('token_assinatura_cliente')
    const authUser = reqInfo.auth

    let emailDestino = ''
    let nomeDestino = ''
    const empresaId = csRec.getString('empresa')
    const clientePfId = csRec.getString('cliente_pf')

    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) {
          emailDestino = emp.getString('email')
          nomeDestino = emp.getString('razao_social') || 'Cliente PJ'
        }
      } catch (_) {}
    } else if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        if (pf) {
          emailDestino = pf.getString('email')
          nomeDestino = pf.getString('nome') || 'Cliente PF'
        }
      } catch (_) {}
    }

    let autorizado = false
    if (token && tokenEsperado && token === tokenEsperado) {
      autorizado = true
    } else if (authUser) {
      const role = authUser.getString('role')
      if (role === 'admin' || role === 'gestor') {
        autorizado = true
      } else if (emailDestino && authUser.getString('email') === emailDestino) {
        autorizado = true
      }
    }

    if (!autorizado) {
      return e.json(403, {
        error: 'Token inválido ou acesso não autorizado ao Contrato de Serviço.',
      })
    }

    if (!emailDestino || emailDestino.indexOf('@') === -1) {
      return e.json(400, {
        error: 'O cliente contratante não possui e-mail cadastrado para envio do código OTP.',
      })
    }

    const numRandom = Math.floor(100000 + Math.random() * 900000)
    const codigoOtp = String(numRandom)
    const codigoHash = $security.sha256(codigoOtp)
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    csRec.set('codigo_verificacao_hash', codigoHash)
    csRec.set('codigo_expiracao', expiraEm)
    csRec.set('codigo_tentativas', 0)
    csRec.set('codigo_enviado_para', emailDestino)
    $app.save(csRec)

    try {
      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

      const htmlBody =
        '<p>Olá, <strong>' +
        (nomeDestino || 'Signatário') +
        '</strong>!</p>' +
        '<p>Seu código para assinar o Contrato de Serviços nº <strong>' +
        csRec.getString('numero') +
        '</strong> é:</p>' +
        '<h2 style="font-size:26px;letter-spacing:4px;color:#1E2A4A;">' +
        codigoOtp +
        '</h2>' +
        '<p>Válido por 10 minutos.</p>'

      const msg = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: emailDestino, name: nomeDestino || emailDestino }],
        subject:
          'Código de Confirmação: ' +
          codigoOtp +
          ' para assinatura do Contrato ' +
          csRec.getString('numero'),
        html: htmlBody,
      })
      $app.newMailClient().send(msg)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Código de verificação enviado para o e-mail cadastrado.',
      email_mascarado: emailDestino.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      expira_em: expiraEm,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao solicitar código do Contrato de Serviço: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 2. ACEITE SIMPLIFICADO DE OS INTERNA (SEM CÓDIGO E SEM CAMADA FINANCEIRA)
// -----------------------------------------------------------------------------

routerAdd('POST', '/backend/v1/ordens-servico/{id}/aceite-interno', (e) => {
  try {
    const osId = e.request.pathValue('id')
    let osRec
    try {
      osRec = $app.findRecordById('ordens_servico', osId)
    } catch (_) {
      return e.json(404, { error: 'Ordem de Serviço não encontrada.' })
    }

    const reqInfo = e.requestInfo()
    const authUser = reqInfo.auth
    if (!authUser) {
      return e.json(401, {
        error: 'Apenas usuários autenticados da equipe interna podem formalizar o aceite interno.',
      })
    }

    const tipoPrestador = osRec.getString('tipo_prestador')
    if (tipoPrestador !== 'interno') {
      return e.json(400, {
        error:
          'BLOQUEIO: O aceite simplificado sem código OTP é restrito a Ordens de Serviço Internas.',
      })
    }

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    const clientUserAgent =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        e.request.getHeader('user-agent')) ||
      (reqInfo.headers && reqInfo.headers['user-agent']) ||
      'Navegador Web / API'

    const nowIso = new Date().toISOString()

    const temOtp = false
    let clausulaPadrao =
      'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta formalização interna realizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como prova de autoria, integridade e tempestividade o registro da data e hora da manifestação, o endereço IP de conexão, a identificação do navegador (user agent) e o hash criptográfico SHA-256 gerado no momento do aceite.'
    try {
      const p = $app.findFirstRecordByData(
        'parametros',
        'chave',
        'clausula_assinatura_eletronica_padrao',
      )
      if (p && p.getString('valor')) {
        const textoParam = p.getString('valor')
        if (/código OTP|código de 6 dígitos/i.test(textoParam)) {
          clausulaPadrao =
            'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta formalização interna realizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como prova de autoria, integridade e tempestividade o registro da data e hora da manifestação, o endereço IP de conexão, a identificação do navegador (user agent) e o hash criptográfico SHA-256 gerado no momento do aceite.'
        } else {
          clausulaPadrao = textoParam
        }
      }
    } catch (_) {}

    const textoBase =
      'OS_INTERNA|' +
      osRec.getString('numero') +
      '|' +
      osRec.getString('disciplina') +
      '|' +
      (osRec.getString('escopo_tecnico') || '') +
      '|' +
      nowIso +
      '|' +
      clausulaPadrao
    const hashTexto = $security.sha256(textoBase)

    const dossieEvidencias = {
      tipo: 'aceite_interno_simplificado',
      documento_numero: osRec.getString('numero'),
      data_aceite_utc: nowIso,
      ip_origem: clientIp,
      user_agent: clientUserAgent,
      email_utilizado: authUser.getString('email'),
      assinante_nome: authUser.getString('name') || 'Colaborador Interno',
      versao_texto_hash: hashTexto,
      pdf_congelado_hash: hashTexto,
      clausula_assinatura: clausulaPadrao,
    }

    osRec.set('status', 'em_execucao')
    osRec.set('aceite_status', 'aceito')
    osRec.set('data_aceite', nowIso)
    osRec.set('aceite_ip', clientIp)
    osRec.set('aceite_user_agent', clientUserAgent)
    osRec.set('versao_texto_aceito', clausulaPadrao)
    osRec.set('versao_texto_hash', hashTexto)
    osRec.set('pdf_congelado_hash', hashTexto)
    osRec.set('dossie_evidencias_json', dossieEvidencias)
    osRec.set('assinante_prestador_nome', authUser.getString('name') || 'Equipe Interna')
    osRec.set('data_assinatura_prestador', nowIso)
    osRec.set('prestador_ip', clientIp)
    osRec.set('prestador_hash', hashTexto)

    $app.save(osRec)

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', authUser.id)
      aRec.set('user_email', authUser.getString('email'))
      aRec.set('acao', 'ACEITE_INTERNO_ORDEM_SERVICO')
      aRec.set('entidade', 'ordens_servico')
      aRec.set('registro_id', osRec.id)
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        numero_os: osRec.getString('numero'),
        status: 'em_execucao',
        hash: hashTexto,
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Aceite interno registrado com sucesso. OS em execução.',
      numero: osRec.getString('numero'),
      status: osRec.getString('status'),
      aceite_status: 'aceito',
      data_aceite: nowIso,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao processar aceite interno: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 3. EXPORTAÇÃO DO DOSSIÊ DE EVIDÊNCIAS DIGITAIS (ADMIN E GESTOR APENAS)
// -----------------------------------------------------------------------------

routerAdd(
  'GET',
  '/backend/v1/ordens-servico/{id}/dossie-evidencias',
  (e) => {
    try {
      const authUser = e.requestInfo().auth
      if (!authUser) {
        return e.json(403, {
          error: 'Acesso restrito. Faça login como Administrador ou Gestor de Projetos.',
        })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Apenas Administradores e Gestores de Projetos podem acessar o Dossiê de Evidências.',
        })
      }

      const osId = e.request.pathValue('id')
      let osRec
      try {
        osRec = $app.findRecordById('ordens_servico', osId)
      } catch (_) {
        return e.json(404, { error: 'Ordem de Serviço não encontrada.' })
      }

      const dossieJson = osRec.get('dossie_evidencias_json') || null
      const aceiteStatus = osRec.getString('aceite_status') || 'pendente'

      let prestadorNome = ''
      let prestadorDoc = ''
      try {
        const prestId = osRec.getString('prestador')
        if (prestId) {
          const p = $app.findRecordById('prestadores', prestId)
          if (p) {
            prestadorNome = p.getString('nome') || p.getString('razao_social')
            prestadorDoc = p.getString('cpf_cnpj')
          }
        }
      } catch (_) {}

      let projetoCodigo = ''
      try {
        const prjId = osRec.getString('projeto')
        if (prjId) {
          const prj = $app.findRecordById('projetos', prjId)
          if (prj) projetoCodigo = prj.getString('codigo')
        }
      } catch (_) {}

      return e.json(200, {
        documento_tipo: 'Ordem de Serviço',
        id: osRec.id,
        numero: osRec.getString('numero'),
        projeto_codigo: projetoCodigo,
        prestador_nome: prestadorNome,
        prestador_documento: prestadorDoc,
        tipo_prestador: osRec.getString('tipo_prestador'),
        valor_os: osRec.getFloat('valor_os') || 0,
        status: osRec.getString('status'),
        aceite_status: aceiteStatus,
        data_aceite: osRec.getString('data_aceite'),
        aceite_ip: osRec.getString('aceite_ip'),
        aceite_user_agent: osRec.getString('aceite_user_agent'),
        pdf_congelado_hash: osRec.getString('pdf_congelado_hash'),
        versao_texto_hash: osRec.getString('versao_texto_hash'),
        versao_texto_aceito: osRec.getString('versao_texto_aceito'),
        assinante_prestador_nome: osRec.getString('assinante_prestador_nome'),
        assinante_prestador_doc: osRec.getString('assinante_prestador_doc'),
        dossie_evidencias_json: dossieJson,
        confirmacao_email_enviada: osRec.getBool('confirmacao_email_enviada'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao carregar dossiê da OS: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/contratos-mestre/{id}/dossie-evidencias',
  (e) => {
    try {
      const authUser = e.requestInfo().auth
      if (!authUser) {
        return e.json(403, { error: 'Acesso restrito.' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Apenas Administradores e Gestores podem acessar o Dossiê.' })
      }

      const cmId = e.request.pathValue('id')
      let cmRec
      try {
        cmRec = $app.findRecordById('contratos_mestre', cmId)
      } catch (_) {
        return e.json(404, { error: 'Contrato-Mestre não encontrado.' })
      }

      return e.json(200, {
        documento_tipo: 'Contrato-Mestre',
        id: cmRec.id,
        numero: cmRec.getString('numero'),
        status: cmRec.getString('status'),
        data_assinatura_prestador: cmRec.getString('data_assinatura_prestador'),
        prestador_ip: cmRec.getString('prestador_ip'),
        pdf_congelado_hash: cmRec.getString('pdf_congelado_hash'),
        versao_texto_hash: cmRec.getString('versao_texto_hash'),
        dossie_evidencias_json: cmRec.get('dossie_evidencias_json'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao carregar dossiê: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/contratos-servico/dossie-evidencias/{id}',
  (e) => {
    try {
      const authUser = e.requestInfo().auth
      if (!authUser) {
        return e.json(403, { error: 'Acesso restrito.' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Apenas Administradores e Gestores podem acessar o Dossiê.' })
      }

      const csId = e.request.pathValue('id')
      let csRec
      try {
        csRec = $app.findRecordById('contratos_servico', csId)
      } catch (_) {
        return e.json(404, { error: 'Contrato de Serviço não encontrado.' })
      }

      return e.json(200, {
        documento_tipo: 'Contrato de Serviço',
        id: csRec.id,
        numero: csRec.getString('numero'),
        status: csRec.getString('status'),
        data_assinatura_cliente: csRec.getString('data_assinatura_cliente'),
        cliente_ip: csRec.getString('cliente_ip'),
        pdf_congelado_hash: csRec.getString('pdf_congelado_hash'),
        versao_texto_hash: csRec.getString('versao_texto_hash'),
        dossie_evidencias_json: csRec.get('dossie_evidencias_json'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao carregar dossiê: ' + err })
    }
  },
  $apis.requireAuth(),
)
