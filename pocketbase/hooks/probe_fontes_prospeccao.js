// Probe de Fontes - Refinamento das URLs e Parâmetros
// Rota: GET /backend/v1/prospeccao/probe-fontes

routerAdd('GET', '/backend/v1/prospeccao/probe-fontes', (e) => {
  const resultados = {}

  // 1a. PNCP Contratos com tamanhoPagina=10 (ou maior)
  try {
    const hoje = new Date()
    const dFim = hoje.toISOString().slice(0, 10).replace(/-/g, '')
    const dIni = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
    const urlPncpContratos = 'https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=' + dIni + '&dataFinal=' + dFim + '&pagina=1&tamanhoPagina=10'
    
    const resPncp = $http.send({
      url: urlPncpContratos,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 12,
    })

    resultados.pncp_contratos = {
      status: resPncp.statusCode,
      url: urlPncpContratos,
      ok: resPncp.statusCode >= 200 && resPncp.statusCode < 300,
      totalRegistros: resPncp.json ? resPncp.json.totalRegistros : undefined,
      primeiroItem: resPncp.json && resPncp.json.data && resPncp.json.data[0] ? {
        numeroContratoEmpenho: resPncp.json.data[0].numeroContratoEmpenho,
        anoContrato: resPncp.json.data[0].anoContrato,
        objetoContrato: resPncp.json.data[0].objetoContrato,
        valorInicial: resPncp.json.data[0].valorInicial,
        orgaoEntidade: resPncp.json.data[0].orgaoEntidade,
        nomeRazaoSocialFornecedor: resPncp.json.data[0].nomeRazaoSocialFornecedor,
        niFornecedor: resPncp.json.data[0].niFornecedor,
        tipoPessoa: resPncp.json.data[0].tipoPessoa,
        dataVigenciaInicio: resPncp.json.data[0].dataVigenciaInicio,
        dataVigenciaFim: resPncp.json.data[0].dataVigenciaFim,
      } : null,
      bodyPreview: typeof resPncp.raw === 'string' ? resPncp.raw.slice(0, 300) : JSON.stringify(resPncp.json || {}).slice(0, 300),
    }
  } catch (err) {
    resultados.pncp_contratos = {
      ok: false,
      erro: String(err),
    }
  }

  // 1b. PNCP Publicações com tamanhoPagina=10
  try {
    const hoje = new Date()
    const dFim = hoje.toISOString().slice(0, 10).replace(/-/g, '')
    const dIni = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
    const urlPncpPub = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=' + dIni + '&dataFinal=' + dFim + '&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10'
    
    const resPncpPub = $http.send({
      url: urlPncpPub,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 12,
    })

    resultados.pncp_publicacoes = {
      status: resPncpPub.statusCode,
      url: urlPncpPub,
      ok: resPncpPub.statusCode >= 200 && resPncpPub.statusCode < 300,
      totalRegistros: resPncpPub.json ? resPncpPub.json.totalRegistros : undefined,
      bodyPreview: typeof resPncpPub.raw === 'string' ? resPncpPub.raw.slice(0, 300) : JSON.stringify(resPncpPub.json || {}).slice(0, 300),
    }
  } catch (err) {
    resultados.pncp_publicacoes = {
      ok: false,
      erro: String(err),
    }
  }

  // 2a. Comprasnet Contratos (dados abertos compras.dados.gov.br e comprasnet)
  // Tentando endpoints alternativos:
  // http://compras.dados.gov.br/contratos/doc/contrato/ ou api contratos
  try {
    const urlComprasnet1 = 'https://comprasnet.gov.br/acesso.asp' // legada
    const urlComprasnet2 = 'https://dadosabertos.compras.gov.br/modulo-contrato/1_consultarContrato' // novo portal compras.gov.br
    const resComprasnet = $http.send({
      url: 'https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarItemMaterial',
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 8,
    })
    resultados.comprasnet_novo = {
      status: resComprasnet.statusCode,
      bodyPreview: typeof resComprasnet.raw === 'string' ? resComprasnet.raw.slice(0, 200) : '',
    }
  } catch (err) {
    resultados.comprasnet_novo = {
      ok: false,
      erro: String(err),
    }
  }

  // 2b. Comprasnet / Compras.dados.gov.br contratos endpoint
  try {
    const resCd = $http.send({
      url: 'https://compras.dados.gov.br/docs/lista-metodos.html',
      method: 'GET',
      timeout: 6,
    })
    resultados.compras_dados_gov = {
      status: resCd.statusCode,
      bodyPreview: typeof resCd.raw === 'string' ? resCd.raw.slice(0, 200) : '',
    }
  } catch (err) {
    resultados.compras_dados_gov = {
      ok: false,
      erro: String(err),
    }
  }

  // 3. BrasilAPI
  try {
    const urlBrasilApi = 'https://brasilapi.com.br/api/cnpj/v1/33000167000101'
    const resBrasilApi = $http.send({
      url: urlBrasilApi,
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 8,
    })
    resultados.brasilapi_cnpj = {
      status: resBrasilApi.statusCode,
      ok: resBrasilApi.statusCode === 200,
      razao_social: resBrasilApi.json ? resBrasilApi.json.razao_social : null,
    }
  } catch (err) {
    resultados.brasilapi_cnpj = { ok: false, erro: String(err) }
  }

  // 4. Portal da Transparência sem chave
  resultados.portal_transparencia = {
    requer_chave: true,
    chave_configurada: false,
    status: 401,
    observacao: 'Exige cabeçalho chave-api-dados cadastrado na CGU/Transparência. Cadastrado como fonte desligada por padrão.',
  }

  return e.json(200, resultados)
})
