// Guarda do e-mail de redefinição de senha (rede de segurança na origem).
//
// Mesmo com o template corrigido na collection "users" (migração 0130), qualquer
// revert/desatualização do template faria o requestPasswordReset nativo voltar a
// gerar o link antigo do painel admin ({APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}),
// que dá 404 no app publicado. Este hook intercepta TODO e-mail enviado pelo
// PocketBase e, quando o corpo contém o caminho antigo, reescreve o link para a
// tela pública /redefinir-senha?token=<token>.
//
// Não envia e-mail: apenas reescreve a mensagem que já está em processo de envio.

onMailerSend((e) => {
  try {
    var msg = e.message
    if (!msg) {
      e.next()
      return
    }

    var appUrl =
      typeof getAppBaseUrl === 'function' && getAppBaseUrl()
        ? getAppBaseUrl()
        : 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'

    // Link antigo já renderizado (placeholders substituídos): https://host/_/#/auth/confirm-password-reset/TOKEN
    var padrao = /https?:\/\/[^"'\\s<>]+\/_\/#\/auth\/confirm-password-reset\/([^"'\\s<>]+)/g
    var destino = appUrl + '/redefinir-senha?token=$1'

    if (typeof msg.html === 'string' && msg.html.indexOf('confirm-password-reset') !== -1) {
      msg.html = msg.html.replace(padrao, destino)
      console.log('[reset_action_url_guard] link de reset reescrito no corpo HTML do e-mail')
    }
    if (typeof msg.text === 'string' && msg.text.indexOf('confirm-password-reset') !== -1) {
      msg.text = msg.text.replace(padrao, destino)
    }
  } catch (err) {
    console.log('[reset_action_url_guard] Aviso: ' + err)
  }
  e.next()
})
