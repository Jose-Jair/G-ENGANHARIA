// PROVA DE RUNTIME — v0.0.273 — anexo do portfólio no Toque 1
// Rota temporária: POST /backend/v1/prova-anexo-toque1
//  - Chama a ROTA REAL /backend/v1/cadencia/disparo-lote (MESMO processo) via $http.send
//    com o token de um usuário admin (record.newAuthToken()) e header Authorization.
//  - Body: { email_teste, empresa_ids: [1 empresa] } — modo teste: envia 1 e-mail de
//    prova e NÃO altera registros.
//  - Selfcheck: GET /backend/v1/prova-anexo-toque1 devolve se a rota está montada.
//
// Padrão de rota idêntico ao de disparo_lote_toque1.js (routerAdd no topo, sem top-level
// function: 100% do código INLINE nos callbacks, pois callbacks rodam em VMs separadas).
// Arquivo temporário: remover após a prova.

// ---------- Selfcheck (GET anônimo: só devolve se a rota está montada) ----------
routerAdd('GET', '/backend/v1/prova-anexo-toque1', (e) => {
  return e.json(200, { rota_montada: true, prova: 'anexo-toque1' })
})

// ---------- Rota temporária de prova ----------
routerAdd(
  'POST',
  '/backend/v1/prova-anexo-toque1',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }
      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, { message: 'Acesso restrito ao perfil Administrador.' })
      }

      const body = reqInfo.body || {}
      const emailTeste = (body.email_teste || '').toString().trim()
      if (!emailTeste) {
        return e.json(400, { message: 'Informe email_teste' })
      }

      // 1. Token de um admin interno (padrão de prova deste projeto)
      let token = ''
      try {
        const admin = $app.findFirstRecordByFilter('users', "role = 'admin'", null)
        if (!admin) throw 'nenhum usuário admin encontrado'
        token = admin.newAuthToken()
      } catch (authErr) {
        return e.json(500, { etapa: 'auth', message: String(authErr) })
      }

      // 2. POST REAL à rota REAL /backend/v1/cadencia/disparo-lote (host interno do
      //    próprio PocketBase, PB_INSTANCE_URL — e.request.url é só o caminho).
      //    Modo teste não precisa de empresa_ids (o backend usa placeholders).
      const host = ($os.getenv('PB_INSTANCE_URL') || '').replace(/\/+$/, '')
      if (!host) {
        return e.json(500, { etapa: 'host', message: 'PB_INSTANCE_URL ausente' })
      }
      const url = host + '/backend/v1/cadencia/disparo-lote'
      let res
      try {
        res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
          },
          body: JSON.stringify({ email_teste: emailTeste }),
          timeout: 120,
        })
      } catch (httpErr) {
        return e.json(500, { etapa: 'http', url: url, message: String(httpErr) })
      }

      // 4. Log da prova no stream hooks (list_logs)
      console.log(
        '[prova-anexo-toque1] POST ' +
          url +
          ' -> status=' +
          res.statusCode +
          ' resposta=' +
          JSON.stringify(res.json).slice(0, 800),
      )

      return e.json(200, {
        etapa: 'disparo-lote-teste',
        url: url,
        status_http: res.statusCode,
        resposta: res.json,
      })
    } catch (err) {
      console.log('[prova-anexo-toque1] erro inesperado: ' + err)
      return e.json(500, { message: 'Erro interno na prova: ' + err })
    }
  },
  $apis.requireAuth(),
)
