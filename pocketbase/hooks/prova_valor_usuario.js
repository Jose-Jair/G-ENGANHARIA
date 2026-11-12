// PROVA PONTUAL (temporária — remover após a checagem autorizada pelo dono):
// autentica-se como USUÁRIO comum do app (coleção users) e consulta a REST
// real de registros de `contratos`, para provar que o campo `valor` (fix da
// migração 0151, hidden:false) chega ao usuário comum.
//
// Rota: GET /backend/v1/prova-valor-usuario
// - Gera token de usuário real via record.NewAuthToken() (mesmo mecanismo do
//   endpoint impersonate de superuser — token de AUTH de usuário, não superuser).
// - Chama $http.send contra a própria REST com Authorization Bearer do USUÁRIO.
// - Reporta status HTTP e presença/valor de `valor` no JSON.
// - Além disso, conta por status_revisao dos contratos (leitura interna, para o
//   levantamento pedido pelo dono) e lê o usuário alvo por email, se informado.
routerAdd('GET', '/backend/v1/prova-valor-usuario', (e) => {
  const resultado = {
    usuario_email: '',
    get_registro: null,
    filter_valor_maior_zero: null,
    status_revisao_distribuicao: null,
    erro: '',
  }

  try {
    // --- escolher o usuário: ?email=... ou o primeiro admin do app na coleção users
    const urlCompleta = String(e.request.url)
    const emailMatch = urlCompleta.match(/[?&]email=([^&]*)/)
    const emailParam = emailMatch ? decodeURIComponent(emailMatch[1]).trim() : ''
    let usuario = null

    const usuariosCol = $app.findCollectionByNameOrId('users')
    let usuarioRecord = null
    if (emailParam !== '') {
      try {
        usuarioRecord = $app.findFirstRecordByFilter(
          usuariosCol,
          "email = '" + emailParam.replace(/'/g, "''") + "'",
        )
      } catch (err1) {
        usuarioRecord = null
      }
      if (!usuarioRecord) {
        return e.json(404, { message: 'Usuário não encontrado para o email informado' })
      }
    } else {
      // primeiro usuário não-superuser disponível (ordem por created)
      const lista = $app.findRecordsByFilter(usuariosCol, '', 'created', 1, 0)
      if (!lista || lista.length === 0) {
        return e.json(404, { message: 'Nenhum usuário na coleção users' })
      }
      usuarioRecord = lista[0]
    }

    resultado.usuario_email = usuarioRecord.email()

    // --- token de AUTH do USUÁRIO (não superuser) — mecanismo do impersonate
    const tokenUsuario = usuarioRecord.newAuthToken()

    const headers = {
      Authorization: 'Bearer ' + tokenUsuario,
      Accept: 'application/json',
    }

    // --- (a) GET do registro zgtfm4s5kknv1ob autenticado como USUÁRIO
    // e.request.url traz só o caminho — host vem do ambiente (com fallback literal)
    let urlBase = ($os.getenv('VITE_POCKETBASE_URL') || '').trim()
    if (urlBase === '') {
      urlBase = 'https://gestao-de-projetos-de-engenharia-be59d.shrd03.internal.goskip.dev'
    }
    urlBase = urlBase.replace(/\/$/, '')
    const getReg = $http.send({
      url: urlBase + '/api/collections/contratos/records/zgtfm4s5kknv1ob',
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    resultado.get_registro = {
      status: getReg.statusCode,
      tem_valor: false,
      valor: null,
    }
    if (getReg.json && typeof getReg.json === 'object') {
      resultado.get_registro.tem_valor = 'valor' in getReg.json
      resultado.get_registro.valor = getReg.json.valor !== undefined ? getReg.json.valor : null
      resultado.get_registro.id = getReg.json.id || null
      resultado.get_registro.status_revisao = getReg.json.status_revisao || null
    }

    // --- (b) filtro (valor>0) autenticado como USUÁRIO
    const urlLista = urlBase + '/api/collections/contratos/records?filter=(valor%3E0)'
    const getLista = $http.send({
      url: urlLista,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    let totalItens = null
    try {
      totalItens =
        getLista.json && getLista.json.totalItems !== undefined ? getLista.json.totalItems : null
    } catch (err2) {
      totalItens = null
    }
    resultado.filter_valor_maior_zero = {
      status: getLista.statusCode,
      totalItems: totalItens,
    }

    // --- (c) distribuição status_revisao (contagem por valor, leitura interna)
    const dist = []
    const valores = ['revisado', 'rascunho_pendente', 'ativo']
    for (let i = 0; i < valores.length; i++) {
      const st = valores[i]
      const rec = new DynamicModel({ n: 0, s: '' })
      try {
        $app
          .db()
          .newQuery(
            'SELECT COUNT(*) AS n, CAST(COALESCE(SUM(valor),0) AS TEXT) AS s FROM contratos WHERE status_revisao = {:st}',
          )
          .bind({ st: st })
          .one(rec)
        dist.push({
          status_revisao: st,
          quantidade: parseInt(String(rec.n), 10) || 0,
          soma_valor: parseFloat(String(rec.s)) || 0,
        })
      } catch (err3) {
        dist.push({ status_revisao: st, erro: String(err3) })
      }
    }
    // contratos sem status_revisao preenchido
    const recNull = new DynamicModel({ n: 0, s: '' })
    try {
      $app
        .db()
        .newQuery(
          "SELECT COUNT(*) AS n, CAST(COALESCE(SUM(valor),0) AS TEXT) AS s FROM contratos WHERE status_revisao = '' OR status_revisao IS NULL",
        )
        .one(recNull)
      dist.push({
        status_revisao: '(vazio)',
        quantidade: parseInt(String(recNull.n), 10) || 0,
        soma_valor: parseFloat(String(recNull.s)) || 0,
      })
    } catch (err4) {
      dist.push({ status_revisao: '(vazio)', erro: String(err4) })
    }
    resultado.status_revisao_distribuicao = dist

    return e.json(200, resultado)
  } catch (err) {
    resultado.erro = String(err)
    console.log('[prova-valor-usuario] erro: ' + err)
    return e.json(500, resultado)
  }
})
