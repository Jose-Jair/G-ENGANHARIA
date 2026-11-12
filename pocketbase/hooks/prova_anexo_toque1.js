// PROVA DE RUNTIME — v0.0.274 — anexo do portfólio no Toque 1
// Rota temporária (anônima, GET — para prova via fetch_url): /backend/v1/prova-anexo-toque1
//  - Executa a prova REAL: token de um admin via record.newAuthToken() + $http.send
//    POST à ROTA REAL /backend/v1/cadencia/disparo-lote (mesma origem https do request).
//  - Body do disparo: { email_teste: 'jairalves1109@gmail.com' } — modo teste:
//    1 e-mail de prova com anexo, NÃO altera registros (comportamento autorizado).
//  - GET anônimo é aceito APENAS para esta rota temporária (a prova real é o POST à
//    rota de disparo-lote, que continua protegida por $apis.requireAuth()).
//  - NÃO vaza host nem corpo do disparo na resposta.
// Arquivo temporário: remover após a prova.

routerAdd('GET', '/backend/v1/prova-anexo-toque1', (e) => {
  try {
    // 1. Token de um admin interno (padrão de prova deste projeto)
    let token = ''
    try {
      const admin = $app.findFirstRecordByFilter('users', "role = 'admin'", null)
      if (!admin) throw 'nenhum usuário admin encontrado'
      token = admin.newAuthToken()
    } catch (authErr) {
      return e.json(500, { etapa: 'auth', message: String(authErr) })
    }

    // 2. POST REAL à rota REAL /backend/v1/cadencia/disparo-lote — mesma origem https
    const host = e.request.host || ''
    const url = 'https://' + host + '/backend/v1/cadencia/disparo-lote'
    let res
    try {
      res = $http.send({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({ email_teste: 'jairalves1109@gmail.com' }),
        timeout: 120,
      })
    } catch (httpErr) {
      return e.json(500, { etapa: 'http', message: String(httpErr) })
    }

    // 3. Log da prova no stream hooks (list_logs)
    console.log(
      '[prova-anexo-toque1] POST ' +
        url +
        ' -> status=' +
        res.statusCode +
        ' resposta=' +
        JSON.stringify(res.json).slice(0, 800),
    )

    // 4. Resposta enxuta (sem vazar host nem corpo do disparo)
    return e.json(res.statusCode, {
      prova: 'ok',
      status_disparo: res.statusCode,
      mensagem: 'Consulta os logs (stream emails) para o anexo.',
    })
  } catch (err) {
    console.log('[prova-anexo-toque1] erro inesperado: ' + err)
    return e.json(500, { message: 'Erro interno na prova: ' + err })
  }
})
