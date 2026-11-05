// Migração 0130 — Corrige o template de redefinição de senha NA ORIGEM REAL.
//
// Por que a 0129 não pegou: no PocketBase v0.23+ (aqui v0.36) os templates de
// e-mail saíram de settings.meta e passaram a viver nas OPÇÕES da collection
// de autenticação ("users"). A 0129 alterou settings.meta.resetPasswordTemplate,
// campo que o runtime não lê mais, então o requestPasswordReset nativo continuou
// usando o template padrão da collection:
//   actionUrl = {APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}
// que no frontend publicado rende "404 Oops! Page not found".
//
// Esta migração:
//   1. corrige settings.meta.appUrl (usado no placeholder {APP_URL});
//   2. grava o template de reset nas opções da collection "users"
//      (subject/body/actionUrl), com actionUrl ABSOLUTO apontando para a tela
//      pública /redefinir-senha?token={TOKEN};
//   3. é idempotente: rodar de novo apenas regrava os mesmos valores;
//   4. loga os valores ANTES/DEPOIS para auditoria.
//
// No runtime de migrações o receiver é o próprio `app` (sem $app global).

migrate(
  (app) => {
    var appUrl = 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
    var actionUrlCorreto = appUrl + '/redefinir-senha?token={TOKEN}'
    var subjectCorreto = 'Redefinição de senha — GESTÃO G+'
    var novoHtml =
      '<p>Olá,</p>' +
      '<p>Clique no botão abaixo para definir sua nova senha de acesso à plataforma GESTÃO G+:</p>' +
      '<p><a href="{ACTION_URL}" style="background-color:#D95A2B;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Definir Minha Senha</a></p>' +
      '<p>Ou copie e cole este link no navegador:<br /><a href="{ACTION_URL}">{ACTION_URL}</a></p>' +
      '<p>Se você não solicitou esta alteração, ignore este e-mail.</p>' +
      '<p style="color:#8A8A8A;font-size:12px;">G+ Engenharia — Gestão e Intermediação Técnica de Projetos<br />Este é um e-mail automático do sistema. Não responda a esta mensagem.</p>'

    // --- 1. meta.appUrl ---
    try {
      var settings = app.settings()
      console.log(
        '[0130] meta.appUrl ANTES: ' + ((settings.meta && settings.meta.appUrl) || '(vazio)'),
      )
      settings.meta.appUrl = appUrl
      app.save(settings)
      console.log('[0130] meta.appUrl salvo: ' + appUrl)
    } catch (errSettings) {
      console.log('[0130] Aviso ao salvar settings.meta.appUrl: ' + errSettings)
    }

    // --- 2. Template de reset nas opções da collection de auth ---
    var users = app.findCollectionByNameOrId('users')

    var tplAntes = users.resetPasswordTemplate
    console.log(
      '[0130] users.resetPasswordTemplate ANTES: subject=' +
        ((tplAntes && tplAntes.subject) || '(vazio)') +
        ' | actionUrl=' +
        ((tplAntes && tplAntes.actionUrl) || '(vazio)'),
    )

    var novoTpl = { subject: subjectCorreto, body: novoHtml, actionUrl: actionUrlCorreto }
    var aplicado = false

    // Tentativa 1: atribuição direta da propriedade (goja exporta o objeto para o struct)
    try {
      users.resetPasswordTemplate = novoTpl
      aplicado = true
      console.log('[0130] template aplicado via atribuição direta')
    } catch (errAtrib) {
      console.log('[0130] Atribuição direta falhou: ' + errAtrib)
    }

    // Tentativa 2: Set genérico da collection
    if (!aplicado) {
      try {
        users.set('resetPasswordTemplate', novoTpl)
        aplicado = true
        console.log('[0130] template aplicado via col.set()')
      } catch (errSet) {
        console.log('[0130] col.set() falhou: ' + errSet)
      }
    }

    if (!aplicado) {
      // Último recurso: mutação aninhada do objeto existente
      try {
        var tpl = users.resetPasswordTemplate
        if (tpl) {
          tpl.subject = subjectCorreto
          tpl.body = novoHtml
          tpl.actionUrl = actionUrlCorreto
          console.log('[0130] template aplicado via mutação aninhada')
        }
      } catch (errNested) {
        console.log('[0130] Mutação aninhada falhou: ' + errNested)
      }
    }

    app.save(users)

    var tplDepois = users.resetPasswordTemplate
    console.log(
      '[0130] users.resetPasswordTemplate DEPOIS: subject=' +
        ((tplDepois && tplDepois.subject) || '(vazio)') +
        ' | actionUrl=' +
        ((tplDepois && tplDepois.actionUrl) || '(vazio)'),
    )
  },
  (app) => {
    // Revert: restaura o template padrão do PocketBase na collection users
    var users = app.findCollectionByNameOrId('users')
    try {
      users.resetPasswordTemplate = {
        subject: 'Redefina sua senha',
        body: '<p>Olá,</p>\n<p>Clique no botão abaixo para redefinir sua senha:</p>\n<p>{ACTION_URL}</p>',
        actionUrl: '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}',
      }
      app.save(users)
    } catch (errRevert) {
      console.log('[0130 down] Aviso: ' + errRevert)
    }
  },
)
