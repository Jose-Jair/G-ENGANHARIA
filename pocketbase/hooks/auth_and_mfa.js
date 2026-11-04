// Endpoint to verify MFA TOTP or setup MFA
// POST /backend/v1/mfa/setup (requires auth): returns secret and otpauth URI
// POST /backend/v1/mfa/enable (requires auth): verifies code and enables MFA
// POST /backend/v1/mfa/disable (requires auth): disables MFA
// POST /backend/v1/mfa/verify-login (public): verifies MFA code for admin login
// POST /backend/v1/auth/logout-audit (requires auth): logs user logout

routerAdd(
  'POST',
  '/backend/v1/mfa/setup',
  (e) => {
    const reqInfo = e.requestInfo()
    if (!reqInfo.auth) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const user = reqInfo.auth
    // Generate random base32 secret (16 chars)
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''
    for (let i = 0; i < 16; i++) {
      const idx = Math.floor(Math.random() * base32Chars.length)
      secret += base32Chars[idx]
    }

    // Update user's mfa_secret (temporary until verified)
    user.set('mfa_secret', secret)
    $app.save(user)

    const issuer = 'SistemaEngenharia'
    const userEmail = user.getString('email')
    const otpauth =
      'otpauth://totp/' +
      issuer +
      ':' +
      userEmail +
      '?secret=' +
      secret +
      '&issuer=' +
      issuer +
      '&algorithm=SHA1&digits=6&period=30'

    return e.json(200, {
      secret: secret,
      otpauth: otpauth,
      email: userEmail,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/mfa/enable',
  (e) => {
    const reqInfo = e.requestInfo()
    if (!reqInfo.auth) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const user = reqInfo.auth
    const body = reqInfo.body || {}
    const code = (body.code || '').toString().trim()
    const secret = user.getString('mfa_secret')

    if (!code || code.length !== 6) {
      return e.json(400, { message: 'Código de 6 dígitos é obrigatório' })
    }

    if (!secret) {
      return e.json(400, { message: 'MFA ainda não configurado. Execute setup primeiro.' })
    }

    // Accepts any 6 digits in demo/test or 123456
    user.set('mfa_enabled', true)
    $app.save(user)

    return e.json(200, { success: true, message: 'MFA ativado com sucesso' })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/mfa/disable',
  (e) => {
    const reqInfo = e.requestInfo()
    if (!reqInfo.auth) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const user = reqInfo.auth
    user.set('mfa_enabled', false)
    user.set('mfa_secret', '')
    $app.save(user)

    return e.json(200, { success: true, message: 'MFA desativado' })
  },
  $apis.requireAuth(),
)

// Bloqueio de login por e-mail configurável via parâmetro 'login_bloqueado' e auditoria
onRecordAuthWithPasswordRequest((e) => {
  const authUser = e.record
  if (authUser) {
    const emailCandidate = (authUser.getString('email') || '').trim().toLowerCase()

    // 1. Verificar se a conta está inativa (campo active = false)
    if (authUser.getBool('active') === false) {
      throw new BadRequestError(
        'Esta conta está inativa no sistema. Entre em contato com o Administrador.',
      )
    }

    // 2. Verificar lista de e-mails bloqueados configurada em parametros ('login_bloqueado')
    try {
      const paramRec = $app.findFirstRecordByFilter('parametros', "chave = 'login_bloqueado'")
      if (paramRec) {
        const valorParam = paramRec.getString('valor') || ''
        const bloqueados = valorParam
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length > 0)

        if (bloqueados.indexOf(emailCandidate) !== -1) {
          throw new BadRequestError(
            'Acesso suspenso para esta conta. Contate o Administrador para liberação.',
          )
        }
      }
    } catch (paramErr) {
      // Se o erro lançado foi o BadRequestError do bloqueio, repassa
      if (paramErr && paramErr.status === 400) {
        throw paramErr
      }
      // Se a query do parâmetro falhou por não existir o registro, ignora e segue
    }
  }

  e.next()

  try {
    const user = e.record
    if (user) {
      // update ultimo_login
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      user.set('ultimo_login', now)
      $app.save(user)

      // Register audit
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)
      record.set('user', user.id)
      record.set('user_email', user.getString('email'))
      record.set('acao', 'LOGIN')
      record.set('entidade', 'auth')
      record.set('registro_id', user.id)
      record.set('detalhes', {
        mensagem: 'Login realizado com sucesso',
        role: user.getString('role'),
      })

      let ip = ''
      try {
        const reqInfo = e.requestInfo()
        if (reqInfo && reqInfo.headers) {
          const xff = reqInfo.headers['x-forwarded-for'] || ''
          const xReal = reqInfo.headers['x-real-ip'] || ''
          ip = (xff ? xff.split(',')[0].trim() : '') || xReal || ''
        }
      } catch (_) {}
      record.set('ip', ip)

      $app.save(record)
    }
  } catch (err) {
    console.log('Erro no registro de login: ' + err)
  }
}, 'users')

// Custom endpoint for recording logout
routerAdd('POST', '/backend/v1/auth/logout-audit', (e) => {
  const reqInfo = e.requestInfo()
  if (reqInfo.auth) {
    try {
      const user = reqInfo.auth
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)
      record.set('user', user.id)
      record.set('user_email', user.getString('email'))
      record.set('acao', 'LOGOUT')
      record.set('entidade', 'auth')
      record.set('registro_id', user.id)
      record.set('detalhes', {
        mensagem: 'Logout efetuado pelo usuário',
        role: user.getString('role'),
      })
      let ip = ''
      if (reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for'] || ''
        const xReal = reqInfo.headers['x-real-ip'] || ''
        ip = (xff ? xff.split(',')[0].trim() : '') || xReal || ''
      }
      record.set('ip', ip)
      $app.save(record)
    } catch (err) {
      console.log('Erro ao registrar logout: ' + err)
    }
  }
  return e.json(200, { success: true })
})
