// Endpoint backend para consulta de CNPJ via BrasilAPI com fallback e bypass de CORS
// Rota: GET /backend/v1/cnpj/{cnpj}

routerAdd('GET', '/backend/v1/cnpj/{cnpj}', (e) => {
  const cnpjParam = (e.request.pathValue('cnpj') || '').replace(/\D/g, '')

  if (!cnpjParam || cnpjParam.length !== 14) {
    return e.json(400, {
      message: 'CNPJ deve conter exatamente 14 dígitos numéricos',
    })
  }

  try {
    const res = $http.send({
      url: 'https://brasilapi.com.br/api/cnpj/v1/' + cnpjParam,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EngenhariaContratos-App/1.0',
      },
      timeout: 10,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return e.json(200, res.json)
    } else {
      return e.json(res.statusCode || 404, {
        message: 'CNPJ não localizado na base pública da Receita Federal (BrasilAPI)',
        status: res.statusCode,
      })
    }
  } catch (err) {
    console.log('Erro ao consultar BrasilAPI via hook: ' + err)
    return e.json(502, {
      message: 'Falha de comunicação externa com o serviço BrasilAPI: ' + err,
    })
  }
})
