// Migração 0129 — Corrige o destino do link do e-mail de redefinição de senha.
//
// Antes: actionUrl apontava para o painel de admin do PocketBase
//        ({APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}) que dá 404 no app publicado.
// Agora: aponta para a tela pública do app "Defina sua senha"
//        https://gestao-de-projetos-de-engenharia-be59d.goskip.app/redefinir-senha?token={TOKEN}
//
// No runtime de migrações o receiver é o próprio `app` (sem $app global).
// O template de reset em PocketBase v0.36 expõe meta.resetPasswordTemplate
// com os campos subject / body / actionUrl / verifyTemplate etc.

migrate(
  (app) => {
    const appUrl = 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'

    const settings = app.settings()
    const novoHtml =
      '<p>Olá,</p>' +
      '<p>Clique no botão abaixo para definir sua nova senha de acesso à plataforma GESTÃO G+:</p>' +
      '<p><a href="{ACTION_URL}" style="background-color:#D95A2B;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Definir Minha Senha</a></p>' +
      '<p>Ou copie e cole este link no navegador:<br /><a href="{ACTION_URL}">{ACTION_URL}</a></p>' +
      '<p>Se você não solicitou esta alteração, ignore este e-mail.</p>' +
      '<p style="color:#8A8A8A;font-size:12px;">G+ Engenharia — Gestão e Intermediação Técnica de Projetos<br />Este é um e-mail automático do sistema. Não responda a esta mensagem.</p>'

    try {
      const tpl = settings.meta.resetPasswordTemplate
      if (tpl) {
        tpl.actionUrl = appUrl + '/redefinir-senha?token={TOKEN}'
        tpl.subject = 'Redefinição de senha — GESTÃO G+'
        tpl.body = novoHtml
        app.save(settings)
        console.log('[0129] resetPasswordTemplate atualizado via objeto template')
      } else {
        throw new Error('resetPasswordTemplate vazio')
      }
    } catch (errTpl) {
      console.log('[0129] Aviso ao editar template direto: ' + errTpl)
      // Fallback: ajusta apenas o actionUrl pelo caminho plano do meta
      const meta = settings.meta
      meta.resetPasswordTemplate = {
        actionUrl: appUrl + '/redefinir-senha?token={TOKEN}',
        subject: 'Redefinição de senha — GESTÃO G+',
        body: novoHtml,
      }
      app.save(settings)
    }
  },
  (app) => {
    // Revert: volta ao actionUrl padrão do PocketBase
    const settings = app.settings()
    settings.meta.resetPasswordTemplate.actionUrl =
      '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}'
    app.save(settings)
  },
)
