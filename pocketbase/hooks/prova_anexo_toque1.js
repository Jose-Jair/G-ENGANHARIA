// PROVA DE RUNTIME — v0.0.272 — anexo do portfólio no Toque 1
// Rota: POST /backend/v1/prova-anexo-toque1  (auto-chama a rota real de disparo-lote
// no modo teste, usando o token de um usuário admin interno)
// Arquivo temporário: remover após a prova

routerAdd('POST', '/backend/v1/prova-anexo-toque1', (e) => {
  const body = e.requestInfo().body || {}
  const emailTeste = (body.email_teste || '').trim()
  if (!emailTeste) {
    return e.json(400, { message: 'Informe email_teste' })
  }

  // --- 1. Token de um admin interno (prova de runtime com usuário comum) ---
  let token = ''
  try {
    const admin = $app.findFirstRecordByFilter('users', "role = 'admin'", null)
    if (!admin) throw 'nenhum usuário admin encontrado'
    token = admin.newAuthToken()
  } catch (authErr) {
    return e.json(500, { etapa: 'auth', message: String(authErr) })
  }

  // --- 2. Empresa fictícia para os placeholders do modelo ---
  let empresaId = ''
  try {
    const empresa = $app.findFirstRecordByFilter('empresas', 'email != ""', null)
    if (!empresa) throw 'nenhuma empresa com e-mail encontrada'
    empresaId = empresa.id
  } catch (empErr) {
    return e.json(500, { etapa: 'empresa', message: String(empErr) })
  }

  // --- 3. Chama a rota REAL de disparo-lote no modo teste (HTTP na própria instância) ---
  const host =
    ($os.getenv('PB_INSTANCE_URL') || '').replace(/\/+$/, '') ||
    ($app.settings().meta && $app.settings().meta.appUrl) ||
    'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'
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
      body: JSON.stringify({ email_teste: emailTeste, empresa_ids: [empresaId] }),
      timeout: 60,
    })
  } catch (httpErr) {
    return e.json(500, { etapa: 'http', url: url, message: String(httpErr) })
  }

  return e.json(res.statusCode >= 400 ? 502 : 200, {
    etapa: 'disparo-lote-teste',
    url: url,
    status_http: res.statusCode,
    resposta: res.json,
  })
})
