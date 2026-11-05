// Migração 0131 — Corrige o CORPO do template de redefinição de senha da
// collection "users" (PocketBase v0.23+ guarda os templates de e-mail nas
// opções da collection de auth, não em settings.meta).
//
// Diagnóstico (migração 0130 + rota de diagnóstico /backend/v1/sistema/reset-template-check):
//   - O struct EmailTemplate só possui `subject` e `body`; não existe campo
//     `actionUrl`. O link do e-mail é o placeholder {ACTION_URL} que o Go do
//     PocketBase resolve como {APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}
//     (caminho do painel admin → 404 no app publicado). Era por isso que a 0129,
//     que alterava settings.meta.resetPasswordTemplate.actionUrl, nunca pegou.
//   - O subject gravado pela 0130 PEGOU (log: "Redefinição de senha — GESTÃO G+"),
//     provando que atribuir objeto ao users.resetPasswordTemplate persiste.
//
// Solução: gravar o corpo APONTANDO DIRETO para a tela pública, sem depender do
// {ACTION_URL}, usando {APP_URL}/redefinir-senha?token={TOKEN}. Como rede extra,
// o corpo usa a URL absoluta publicada (o settings.meta.appUrl não é legível
// pelo JSVM neste runtime — leitura retorna undefined) e o hook
// reset_action_url_guard.js reescreve qualquer link antigo residual no envio.
//
// Idempotente: rodar de novo apenas regrava os mesmos valores.

migrate(
  (app) => {
    var users = app.findCollectionByNameOrId('users')

    var subjectCorreto = 'Redefinição de senha — GESTÃO G+'
    var corpoCorreto =
      '<p>Olá,</p>' +
      '<p>Clique no botão abaixo para definir sua nova senha de acesso à plataforma GESTÃO G+:</p>' +
      '<p><a href="https://gestao-de-projetos-de-engenharia-be59d.goskip.app/redefinir-senha?token={TOKEN}" style="background-color:#D95A2B;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Definir Minha Senha</a></p>' +
      '<p>Ou copie e cole este link no navegador:<br />' +
      '<a href="https://gestao-de-projetos-de-engenharia-be59d.goskip.app/redefinir-senha?token={TOKEN}">https://gestao-de-projetos-de-engenharia-be59d.goskip.app/redefinir-senha?token={TOKEN}</a></p>' +
      '<p>Se você não solicitou esta alteração, ignore este e-mail.</p>' +
      '<p style="color:#8A8A8A;font-size:12px;">G+ Engenharia — Gestão e Intermediação Técnica de Projetos<br />Este é um e-mail automático do sistema. Não responda a esta mensagem.</p>'

    var tplAntes = users.resetPasswordTemplate
    console.log(
      '[0131] ANTES: subject=' +
        ((tplAntes && tplAntes.subject) || '(vazio)') +
        ' | body.contem_redefinir_senha=' +
        String(!!(tplAntes && tplAntes.body && tplAntes.body.indexOf('redefinir-senha') !== -1)),
    )

    var aplicado = false
    try {
      users.resetPasswordTemplate = { subject: subjectCorreto, body: corpoCorreto }
      aplicado = true
    } catch (errAtrib) {
      console.log('[0131] Atribuição direta falhou: ' + errAtrib)
    }
    if (!aplicado) {
      try {
        users.set('resetPasswordTemplate', { subject: subjectCorreto, body: corpoCorreto })
        aplicado = true
      } catch (errSet) {
        console.log('[0131] col.set() falhou: ' + errSet)
      }
    }

    app.save(users)

    var tplDepois = users.resetPasswordTemplate
    console.log(
      '[0131] DEPOIS: subject=' +
        ((tplDepois && tplDepois.subject) || '(vazio)') +
        ' | body.contem_redefinir_senha=' +
        String(!!(tplDepois && tplDepois.body && tplDepois.body.indexOf('redefinir-senha') !== -1)),
    )
  },
  (app) => {
    // Revert: volta ao template padrão do PocketBase
    var users = app.findCollectionByNameOrId('users')
    try {
      users.resetPasswordTemplate = {
        subject: 'Redefina sua senha',
        body: '<p>Olá,</p>\n<p>Clique no botão abaixo para redefinir sua senha:</p>\n<p>{ACTION_URL}</p>',
      }
      app.save(users)
    } catch (errRevert) {
      console.log('[0131 down] Aviso: ' + errRevert)
    }
  },
)
