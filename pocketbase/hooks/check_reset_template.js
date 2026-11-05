// Diagnóstico do template de redefinição de senha (só leitura — NÃO envia e-mail).
// Logs o actionUrl/subject VIVOS do template de reset da collection "users"
// (onde o PocketBase v0.23+ guarda os templates de e-mail) e de settings.meta.
// Acesso: registro no log acontece sempre; resposta JSON apenas para Admin.

routerAdd('GET', '/backend/v1/sistema/reset-template-check', (e) => {
  try {
    var users = $app.findCollectionByNameOrId('users')
    var tpl = null
    try {
      tpl = users.resetPasswordTemplate
    } catch (errTpl) {
      console.log('[reset-template-check] erro ao ler resetPasswordTemplate: ' + errTpl)
    }

    var appUrl = ''
    var senderAddress = ''
    try {
      var s = $app.settings()
      appUrl = (s.meta && s.meta.appUrl) || ''
      senderAddress = (s.meta && s.meta.senderAddress) || ''
    } catch (errS) {
      console.log('[reset-template-check] erro ao ler settings: ' + errS)
    }

    var actionUrl = (tpl && tpl.actionUrl) || '(vazio)'
    var subject = (tpl && tpl.subject) || '(vazio)'
    var body = (tpl && tpl.body) || '(vazio)'

    console.log(
      '[reset-template-check] meta.appUrl=' +
        (appUrl || '(vazio)') +
        ' | subject=' +
        subject +
        ' | actionUrl=' +
        actionUrl,
    )
    console.log('[reset-template-check] body.len=' + body.length)

    // Exigências de acesso: apenas Admin autenticado lê a resposta
    var info = e.requestInfo()
    var auth = info.auth
    var isAdmin =
      !!auth && auth.collection().name === 'users' && String(auth.get('role') || '') === 'admin'
    if (!isAdmin) {
      return e.json(401, { error: 'Acesso restrito ao perfil Administrador.' })
    }

    return e.json(200, {
      meta_appUrl: appUrl,
      sender_address: senderAddress,
      reset_template: {
        subject: subject,
        actionUrl: actionUrl,
        body_len: body.length,
        body_contem_painel_admin: body.indexOf('confirm-password-reset') !== -1,
      },
    })
  } catch (err) {
    console.log('[reset-template-check] ERRO: ' + err)
    return e.json(500, { error: String(err) })
  }
})
