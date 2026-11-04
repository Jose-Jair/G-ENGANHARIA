// =============================================================================
// GESTÃO G+ — CRIAÇÃO E REENVIO DE ACESSO AO PORTAL DO PRESTADOR (ITEM 8 - PARTE A)
// Rota: POST /backend/v1/prestadores/criar-acesso (Restrito a Admin)
// 100% inline no callback, sem cron, sem migrações de dados.
// =============================================================================

routerAdd('POST', '/backend/v1/prestadores/criar-acesso', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const authUser = reqInfo.auth
    if (!authUser) {
      return e.json(401, { error: 'Autenticação obrigatória.' })
    }
    const role = authUser.getString('role')
    if (role !== 'admin') {
      return e.json(403, {
        error:
          'Acesso restrito: apenas Administradores podem criar ou gerenciar acessos de prestadores.',
      })
    }

    const body = reqInfo.body || {}
    const prestadorId = (body.prestador_id || '').trim()
    const enviarConvite = body.enviar_convite === true || body.enviar_convite === 'true'

    if (!prestadorId) {
      return e.json(400, { error: 'O parâmetro prestador_id é obrigatório.' })
    }

    let prestador = null
    try {
      prestador = $app.findRecordById('prestadores', prestadorId)
    } catch (_) {
      return e.json(400, { error: 'Prestador não encontrado com o ID fornecido.' })
    }

    const status = (prestador.getString('status') || '').trim().toLowerCase()
    // Exige status ativo ou homologado
    if (status !== 'ativo' && status !== 'homologado' && status !== 'homologacao') {
      return e.json(400, {
        error:
          'Apenas prestadores com status ativo ou homologado podem receber acesso ao portal (status atual: "' +
          status +
          '").',
      })
    }

    const prestadorEmail = (prestador.getString('email') || '').trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!prestadorEmail || !emailRegex.test(prestadorEmail)) {
      return e.json(400, {
        error: 'O prestador não possui um endereço de e-mail válido cadastrado.',
      })
    }

    const safeEmail = prestadorEmail.replace(/'/g, "\\'")
    const safePid = prestadorId.replace(/'/g, "\\'")

    const usersCol = $app.findCollectionByNameOrId('users')
    const temPrestadorIdUser = !!usersCol.fields.getByName('prestador_id')
    const temPrestadorUser = !!usersCol.fields.getByName('prestador')

    // Verificar se já existe usuário ligado a esse prestador (ou com o mesmo e-mail)
    let userRecord = null
    try {
      userRecord = $app.findAuthRecordByEmail('users', prestadorEmail)
    } catch (_) {}

    if (!userRecord) {
      const usersByEmail = $app.findRecordsByFilter(
        'users',
        "email = '" + safeEmail + "'",
        '',
        1,
        0,
      )
      if (usersByEmail.length > 0) {
        userRecord = usersByEmail[0]
      }
    }

    if (!userRecord) {
      if (temPrestadorIdUser) {
        const usersByPid = $app.findRecordsByFilter(
          'users',
          "prestador_id = '" + safePid + "'",
          '',
          1,
          0,
        )
        if (usersByPid.length > 0) {
          userRecord = usersByPid[0]
        }
      } else if (temPrestadorUser) {
        const usersByPid = $app.findRecordsByFilter(
          'users',
          "prestador = '" + safePid + "'",
          '',
          1,
          0,
        )
        if (usersByPid.length > 0) {
          userRecord = usersByPid[0]
        }
      }
    }

    let jaTinhaAcesso = false

    if (userRecord) {
      // Usuário já existe: NÃO criar outro. Ligar o vínculo se faltar.
      jaTinhaAcesso = true
      let alterouUser = false

      if (temPrestadorIdUser && userRecord.getString('prestador_id') !== prestadorId) {
        userRecord.set('prestador_id', prestadorId)
        alterouUser = true
      }
      if (temPrestadorUser && userRecord.getString('prestador') !== prestadorId) {
        userRecord.set('prestador', prestadorId)
        alterouUser = true
      }
      if (!userRecord.getBool('active')) {
        userRecord.set('active', true)
        alterouUser = true
      }
      if (alterouUser) {
        $app.save(userRecord)
      }
    } else {
      // Criar users role executor com senha aleatória forte (nunca exibida/retornada)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+'
      let randomPass = ''
      for (let i = 0; i < 28; i++) {
        randomPass += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      userRecord = new Record(usersCol)
      userRecord.set('email', prestadorEmail)
      userRecord.set('name', prestador.getString('nome') || 'Prestador G+')
      userRecord.set('role', 'executor')
      userRecord.set('active', true)
      userRecord.setPassword(randomPass)

      if (usersCol.fields.getByName('phone') && prestador.getString('telefone')) {
        userRecord.set('phone', prestador.getString('telefone'))
      }
      if (usersCol.fields.getByName('cpf_cnpj') && prestador.getString('cpf_cnpj')) {
        userRecord.set('cpf_cnpj', prestador.getString('cpf_cnpj'))
      }
      if (temPrestadorIdUser) {
        userRecord.set('prestador_id', prestadorId)
      }
      if (temPrestadorUser) {
        userRecord.set('prestador', prestadorId)
      }

      $app.save(userRecord)

      // Registrar auditoria 'CRIAR_ACESSO_PRESTADOR'
      try {
        let clientIp = '127.0.0.1'
        if (e.request && typeof e.request.getHeader === 'function') {
          const xff = e.request.getHeader('x-forwarded-for')
          if (xff) clientIp = xff.split(',')[0].trim()
        } else if (reqInfo.headers && reqInfo.headers['x-forwarded-for']) {
          clientIp = String(reqInfo.headers['x-forwarded-for']).split(',')[0].trim()
        }

        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'CRIAR_ACESSO_PRESTADOR')
        aRec.set('entidade', 'prestadores')
        aRec.set('registro_id', prestadorId)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          prestador_id: prestadorId,
          prestador_nome: prestador.getString('nome'),
          prestador_email: prestadorEmail,
          user_id: userRecord.id,
          user_role: 'executor',
          criado_por_id: authUser.id,
          criado_por_email: authUser.getString('email'),
        })
        $app.save(aRec)
      } catch (errAudit) {
        console.log('[prestadores_criar_acesso] Aviso ao registrar auditoria: ' + errAudit)
      }
    }

    // Se prestadores tiver campo de relação user/usuario, ligar o vínculo
    try {
      const prestadoresCol = $app.findCollectionByNameOrId('prestadores')
      let alterouPrestador = false
      if (
        prestadoresCol.fields.getByName('user') &&
        prestador.getString('user') !== userRecord.id
      ) {
        prestador.set('user', userRecord.id)
        alterouPrestador = true
      }
      if (
        prestadoresCol.fields.getByName('usuario') &&
        prestador.getString('usuario') !== userRecord.id
      ) {
        prestador.set('usuario', userRecord.id)
        alterouPrestador = true
      }
      if (alterouPrestador) {
        $app.save(prestador)
      }
    } catch (_) {}

    // Envio do convite: SOMENTE se enviar_convite === true (fluxo de redefinição de senha / convite do PocketBase)
    let conviteEnviado = false
    if (enviarConvite) {
      let token = ''
      try {
        if (typeof userRecord.newPasswordResetToken === 'function') {
          token = userRecord.newPasswordResetToken()
        }
      } catch (errToken) {
        console.log('[prestadores_criar_acesso] Aviso ao gerar newPasswordResetToken: ' + errToken)
      }

      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'

      if (token) {
        try {
          const resetLink = appUrl + '/_/#/auth/confirm-password-reset/' + token
          const senderAddress =
            ($app.settings().meta && $app.settings().meta.senderAddress) ||
            'nao-responder@gestaogmais.eng.br'
          const senderName =
            ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia'

          const htmlBody =
            '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#141D34;color:#f8fafc;">' +
            '<div style="max-width:580px;margin:0 auto;background-color:#1E2A4A;border-radius:12px;overflow:hidden;border:1px solid #334155;padding:32px;">' +
            '<div style="text-align:center;margin-bottom:28px;">' +
            '<img src="https://gestao-de-projetos-de-engenharia-be59d.goskip.app/brand/gplus-logo-horizontal.png" width="220" alt="G+ ENGENHARIA" style="display:inline-block;max-width:100%;height:auto;" />' +
            '</div>' +
            '<h2 style="color:#ffffff;font-size:20px;margin-top:0;margin-bottom:16px;text-align:center;">Acesso ao Portal do Prestador</h2>' +
            '<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">' +
            'Olá, <strong>' +
            (prestador.getString('nome') || 'Prestador') +
            '</strong>,' +
            '</p>' +
            '<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:20px;">' +
            'Seu acesso ao <strong>Portal do Prestador da G+ Engenharia</strong> foi habilitado. Através do portal, você poderá visualizar e gerenciar ordens de serviço (OS), entregáveis técnicos, documentos e comunicações operacionais dos projetos intermediados.' +
            '</p>' +
            '<p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:28px;">' +
            'Para definir sua senha de acesso e ativar sua conta, clique no botão seguro abaixo:' +
            '</p>' +
            '<div style="text-align:center;margin-bottom:32px;">' +
            '<a href="' +
            resetLink +
            '" style="background-color:#D95A2B;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:bold;display:inline-block;box-shadow:0 4px 12px rgba(217,90,43,0.3);">' +
            'Definir Minha Senha de Acesso' +
            '</a>' +
            '</div>' +
            '<p style="color:#94a3b8;font-size:12px;line-height:1.5;margin-bottom:8px;text-align:center;">' +
            'Se o botão não funcionar, copie e cole o seguinte link em seu navegador:<br/>' +
            '<a href="' +
            resetLink +
            '" style="color:#D95A2B;word-break:break-all;">' +
            resetLink +
            '</a>' +
            '</p>' +
            '<hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />' +
            '<p style="color:#64748b;font-size:11px;text-align:center;margin:0;">' +
            'G+ Engenharia — Gestão e Intermediação Técnica de Projetos<br/>Este é um e-mail automático do sistema. Não responda a esta mensagem.' +
            '</p>' +
            '</div></body></html>'

          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: prestadorEmail, name: prestador.getString('nome') || '' }],
            subject: 'Convite de Acesso ao Portal do Prestador — G+ Engenharia',
            html: htmlBody,
          })
          $app.newMailClient().send(msg)
          conviteEnviado = true
        } catch (errMail) {
          console.log('[prestadores_criar_acesso] Erro ao enviar e-mail personalizado: ' + errMail)
        }
      }

      // Fallback nativo PocketBase via $mails.sendRecordPasswordReset caso token manual não esteja disponível
      if (!conviteEnviado) {
        try {
          if (
            typeof $mails !== 'undefined' &&
            typeof $mails.sendRecordPasswordReset === 'function'
          ) {
            $mails.sendRecordPasswordReset($app, userRecord)
            conviteEnviado = true
          }
        } catch (errMails) {
          console.log(
            '[prestadores_criar_acesso] Erro no fallback $mails.sendRecordPasswordReset: ' +
              errMails,
          )
        }
      }
    }

    return e.json(jaTinhaAcesso ? 200 : 201, {
      sucesso: true,
      ja_tinha_acesso: jaTinhaAcesso,
      user_id: userRecord.id,
      email: prestadorEmail,
      convite_enviado: conviteEnviado,
      mensagem: jaTinhaAcesso
        ? enviarConvite
          ? 'O prestador já possuía acesso ao sistema. O convite foi reenviado com sucesso para ' +
            prestadorEmail +
            '.'
          : 'O prestador já possuía usuário vinculado no sistema.'
        : enviarConvite
          ? 'Usuário de acesso criado com sucesso e convite enviado para ' + prestadorEmail + '.'
          : 'Usuário de acesso criado com sucesso.',
    })
  } catch (err) {
    console.log('[prestadores_criar_acesso] Erro ao processar requisição: ' + err)
    return e.json(500, {
      error: 'Erro interno ao criar/gerenciar acesso do prestador: ' + (err.message || String(err)),
    })
  }
})
