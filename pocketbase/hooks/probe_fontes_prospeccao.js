// Probe de Fontes - Refinamento das URLs e Parâmetros
// Rota: GET /backend/v1/prospeccao/probe-fontes-ceara

onRecordAfterCreateSuccess((e) => {
  try {
    const chave = ($os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || '').trim()
    const desc = e.record.get('descricao') || ''
    if (desc.indexOf('TRIGGER_PROVA_TRANSPARENCIA') !== -1) {
      let ceisStatus = 0
      let ceisLength = 0
      let ceisRaw = ''
      try {
        const res = $http.send({
          url: 'https://api.portaldatransparencia.gov.br/api-de-dados/ceis?pagina=1',
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'chave-api-dados': chave,
            'User-Agent': 'GESTAO-GPLUS/1.0',
          },
          timeout: 20,
        })
        ceisStatus = res.statusCode
        if (Array.isArray(res.json)) ceisLength = res.json.length
        if (res.statusCode >= 400)
          ceisRaw = typeof res.raw === 'string' ? res.raw.slice(0, 300) : ''
      } catch (err) {
        ceisStatus = 500
        ceisRaw = String(err)
      }

      let cnepStatus = 0
      let cnepLength = 0
      let cnepRaw = ''
      try {
        const res = $http.send({
          url: 'https://api.portaldatransparencia.gov.br/api-de-dados/cnep?pagina=1',
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'chave-api-dados': chave,
            'User-Agent': 'GESTAO-GPLUS/1.0',
          },
          timeout: 20,
        })
        cnepStatus = res.statusCode
        if (Array.isArray(res.json)) cnepLength = res.json.length
        if (res.statusCode >= 400)
          cnepRaw = typeof res.raw === 'string' ? res.raw.slice(0, 300) : ''
      } catch (err) {
        cnepStatus = 500
        cnepRaw = String(err)
      }

      // Atualiza o registro de auditoria com os resultados exatos (SEM IMPRIMIR A CHAVE)
      e.record.set(
        'resultado',
        JSON.stringify({
          chave_presente: chave.length > 0,
          ceis: { status_http: ceisStatus, registros_lidos: ceisLength, erro: ceisRaw },
          cnep: { status_http: cnepStatus, registros_lidos: cnepLength, erro: cnepRaw },
          total_lidos: ceisLength + cnepLength,
        }),
      )
      $app.save(e.record)

      // Se a chave estiver presente, atualiza a fonte fontes_prospeccao
      if (chave.length > 0) {
        try {
          const fTransp = $app.findFirstRecordByData(
            'fontes_prospeccao',
            'slug',
            'portal_transparencia',
          )
          if (fTransp) {
            fTransp.set('chave_configurada', true)
            fTransp.set('aviso_configuracao', '')
            fTransp.set('ultima_execucao', new Date().toISOString())
            fTransp.set(
              'total_lidos',
              (fTransp.get('total_lidos') || 0) + (ceisLength + cnepLength),
            )
            fTransp.set('ultimo_erro', '')
            $app.save(fTransp)
          }
        } catch (_) {}
      }
    }
  } catch (_) {
  } finally {
    e.next()
  }
}, 'auditoria')

routerAdd('GET', '/backend/v1/prospeccao/test-probe-transparencia', (e) => {
  const chave = ($os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || '').trim()
  if (!chave) {
    return e.json(200, { chave_presente: false, message: 'Chave ausente no $os.getenv' })
  }

  // Faz teste direto sem expor a chave
  let ceisStatus = 0
  let ceisLength = 0
  let ceisErro = ''
  try {
    const res = $http.send({
      url: 'https://api.portaldatransparencia.gov.br/api-de-dados/ceis?pagina=1',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'chave-api-dados': chave,
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 20,
    })
    ceisStatus = res.statusCode
    if (Array.isArray(res.json)) ceisLength = res.json.length
    if (res.statusCode >= 400) ceisErro = typeof res.raw === 'string' ? res.raw.slice(0, 300) : ''
  } catch (err) {
    ceisStatus = 500
    ceisErro = String(err)
  }

  let cnepStatus = 0
  let cnepLength = 0
  let cnepErro = ''
  try {
    const res = $http.send({
      url: 'https://api.portaldatransparencia.gov.br/api-de-dados/cnep?pagina=1',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'chave-api-dados': chave,
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 20,
    })
    cnepStatus = res.statusCode
    if (Array.isArray(res.json)) cnepLength = res.json.length
    if (res.statusCode >= 400) cnepErro = typeof res.raw === 'string' ? res.raw.slice(0, 300) : ''
  } catch (err) {
    cnepStatus = 500
    cnepErro = String(err)
  }

  // Sincroniza fontes_prospeccao
  try {
    const fTransp = $app.findFirstRecordByData('fontes_prospeccao', 'slug', 'portal_transparencia')
    if (fTransp) {
      fTransp.set('chave_configurada', true)
      fTransp.set('aviso_configuracao', '')
      $app.save(fTransp)
    }
  } catch (_) {}

  // Grava em log para captura no list_logs (SEM A CHAVE)
  console.log(
    '[PROVA REAL PORTAL TRANSPARENCIA] CEIS HTTP ' +
      ceisStatus +
      ' (' +
      ceisLength +
      ' registros) | CNEP HTTP ' +
      cnepStatus +
      ' (' +
      cnepLength +
      ' registros) | Total lidos: ' +
      (ceisLength + cnepLength),
  )

  return e.json(200, {
    chave_presente: true,
    ceis: { status_http: ceisStatus, registros_lidos: ceisLength, erro: ceisErro },
    cnep: { status_http: cnepStatus, registros_lidos: cnepLength, erro: cnepErro },
    total_lidos: ceisLength + cnepLength,
  })
})

routerAdd('GET', '/backend/v1/prospeccao/probe-fontes-ceara-v5', (e) => {
  const resultados = {}

  // Sincroniza dinamicamente registro de fontes_prospeccao com chave do Portal da Transparência
  try {
    const chaveTransp = ($os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || '').trim()
    const temChaveTransp = chaveTransp.length > 0
    const fTransp = $app.findFirstRecordByData('fontes_prospeccao', 'slug', 'portal_transparencia')
    if (fTransp && fTransp.get('chave_configurada') !== temChaveTransp) {
      fTransp.set('chave_configurada', temChaveTransp)
      if (temChaveTransp) {
        fTransp.set('aviso_configuracao', '')
      }
      $app.save(fTransp)
    }
  } catch (_) {}

  // Transparência - Teste real
  const chaveTranspReal = ($os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || '').trim()
  if (chaveTranspReal.length > 0) {
    let statusCeis = 0
    let totalCeis = 0
    try {
      const resCeis = $http.send({
        url: 'https://api.portaldatransparencia.gov.br/api-de-dados/ceis?pagina=1',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'chave-api-dados': chaveTranspReal,
          'User-Agent': 'GESTAO-GPLUS/1.0',
        },
        timeout: 15,
      })
      statusCeis = resCeis.statusCode
      if (Array.isArray(resCeis.json)) totalCeis = resCeis.json.length
    } catch (_) {
      statusCeis = 500
    }

    let statusCnep = 0
    let totalCnep = 0
    try {
      const resCnep = $http.send({
        url: 'https://api.portaldatransparencia.gov.br/api-de-dados/cnep?pagina=1',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'chave-api-dados': chaveTranspReal,
          'User-Agent': 'GESTAO-GPLUS/1.0',
        },
        timeout: 15,
      })
      statusCnep = resCnep.statusCode
      if (Array.isArray(resCnep.json)) totalCnep = resCnep.json.length
    } catch (_) {
      statusCnep = 500
    }

    resultados.portal_transparencia = {
      requer_chave: true,
      chave_configurada: true,
      status: statusCeis === 200 && statusCnep === 200 ? 200 : Math.max(statusCeis, statusCnep),
      observacao:
        'Chave PORTAL_TRANSPARENCIA_API_KEY ativa. CEIS: ' +
        totalCeis +
        ' reg (HTTP ' +
        statusCeis +
        '), CNEP: ' +
        totalCnep +
        ' reg (HTTP ' +
        statusCnep +
        ').',
      ceis: { status_http: statusCeis, registros: totalCeis },
      cnep: { status_http: statusCnep, registros: totalCnep },
    }
  }

  // 1a. PNCP Contratos com tamanhoPagina=10 (ou maior)
  try {
    const hoje = new Date()
    const dFim = hoje.toISOString().slice(0, 10).replace(/-/g, '')
    const dIni = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')
    const urlPncpContratos =
      'https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=' +
      dIni +
      '&dataFinal=' +
      dFim +
      '&pagina=1&tamanhoPagina=10'

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
      primeiroItem:
        resPncp.json && resPncp.json.data && resPncp.json.data[0]
          ? {
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
            }
          : null,
      bodyPreview:
        typeof resPncp.raw === 'string'
          ? resPncp.raw.slice(0, 300)
          : JSON.stringify(resPncp.json || {}).slice(0, 300),
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
    const dIni = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')
    const urlPncpPub =
      'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=' +
      dIni +
      '&dataFinal=' +
      dFim +
      '&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10'

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
      bodyPreview:
        typeof resPncpPub.raw === 'string'
          ? resPncpPub.raw.slice(0, 300)
          : JSON.stringify(resPncpPub.json || {}).slice(0, 300),
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
  if (chaveTranspReal.length > 0) {
    // Já preenchido acima
  } else {
    resultados.portal_transparencia = {
      requer_chave: true,
      chave_configurada: false,
      status: 401,
      observacao:
        'Exige cabeçalho chave-api-dados cadastrado na CGU/Transparência. Cadastrado como fonte desligada por padrão.',
    }
  }

  // ---------------------------------------------------------------------------
  // 5. PROBE TCE-CE (api-dados-abertos.tce.ce.gov.br e licitacoes.tce.ce.gov.br)
  // ---------------------------------------------------------------------------
  // 5a. API Dados Abertos TCE-CE - teste do item completo retornado
  let licitantesItemExemplo = null
  try {
    const resLicItem = $http.send({
      url: 'https://api-dados-abertos.tce.ce.gov.br/sim/licitantes_fornecedores_bens_servicos?codigo_municipio=044&data_inicio=2024-01-01&data_fim=2024-01-05',
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
      timeout: 8,
    })
    if (resLicItem.json && resLicItem.json.elements && resLicItem.json.elements[0]) {
      licitantesItemExemplo = resLicItem.json.elements[0]
    }
  } catch (_) {}

  const endpointsTceCe = [
    {
      nome: 'tce_ce_sim_municipios',
      url: 'https://api-dados-abertos.tce.ce.gov.br/sim/municipios',
    },
    {
      nome: 'tce_ce_sim_licitantes_fornecedores',
      url: 'https://api-dados-abertos.tce.ce.gov.br/sim/licitantes_fornecedores_bens_servicos?codigo_municipio=044&data_inicio=2024-01-01&data_fim=2024-01-31',
    },
  ]

  resultados.tce_ce = {}
  for (let idx = 0; idx < endpointsTceCe.length; idx++) {
    const ep = endpointsTceCe[idx]
    try {
      const res = $http.send({
        url: ep.url,
        method: 'GET',
        headers: {
          Accept: 'application/json, text/html, */*',
          'User-Agent': 'GESTAO-GPLUS/1.0',
        },
        timeout: 8,
      })
      resultados.tce_ce[ep.nome] = {
        url: ep.url,
        status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 300,
        tipoConteudo: res.headers ? res.headers['content-type'] : '',
        bodyPreview:
          typeof res.raw === 'string'
            ? res.raw.slice(0, 300)
            : JSON.stringify(res.json || {}).slice(0, 300),
      }
    } catch (errEp) {
      resultados.tce_ce[ep.nome] = {
        url: ep.url,
        ok: false,
        erro: String(errEp),
      }
    }
  }

  // 5b. Portal de Licitações do TCE-CE (licitacoes.tce.ce.gov.br)
  try {
    const resLic = $http.send({
      url: 'https://licitacoes.tce.ce.gov.br',
      method: 'GET',
      headers: {
        Accept: 'text/html, application/json, */*',
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 8,
    })
    resultados.tce_ce_portal_licitacoes = {
      url: 'https://licitacoes.tce.ce.gov.br',
      status: resLic.statusCode,
      ok: resLic.statusCode >= 200 && resLic.statusCode < 300,
      tipoConteudo: resLic.headers ? resLic.headers['content-type'] : '',
      bodyPreview: typeof resLic.raw === 'string' ? resLic.raw.slice(0, 300) : '',
    }
  } catch (errLic) {
    resultados.tce_ce_portal_licitacoes = {
      url: 'https://licitacoes.tce.ce.gov.br',
      ok: false,
      erro: String(errLic),
    }
  }

  // 5c. Ceará Transparente (transparencia.ce.gov.br)
  try {
    const resTranspCe = $http.send({
      url: 'https://transparencia.ce.gov.br',
      method: 'GET',
      headers: {
        Accept: 'text/html, application/json, */*',
        'User-Agent': 'GESTAO-GPLUS/1.0',
      },
      timeout: 8,
    })
    resultados.ceara_transparente = {
      url: 'https://transparencia.ce.gov.br',
      status: resTranspCe.statusCode,
      ok: resTranspCe.statusCode >= 200 && resTranspCe.statusCode < 300,
      tipoConteudo: resTranspCe.headers ? resTranspCe.headers['content-type'] : '',
      bodyPreview: typeof resTranspCe.raw === 'string' ? resTranspCe.raw.slice(0, 300) : '',
    }
  } catch (errCe) {
    resultados.ceara_transparente = {
      url: 'https://transparencia.ce.gov.br',
      ok: false,
      erro: String(errCe),
    }
  }

  resultados.tce_ce_item_exemplo = licitantesItemExemplo

  return e.json(200, resultados)
})
