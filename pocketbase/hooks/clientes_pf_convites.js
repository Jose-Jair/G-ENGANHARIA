// Hook — Cadastro completo do Cliente PF via link seguro (PARTE A — backend)
// Rotas:
//   POST /backend/v1/clientes-pf/{id}/convite                      (admin/comercial)
//        -> cancela convite ativo anterior, cria novo (token aleatório >=32 chars,
//           guardado SOMENTE como hash SHA-256), marca cliente 'aguardando_cliente',
//           devolve o link público. Se {enviar_email:true}, envia e-mail ao cliente
//           (apenas quando o dono dispara explicitamente por este campo).
//   GET  /backend/v1/cadastro-cliente/{token}                      (público)
//        -> válido/ativo: devolve só nome + dados já existentes do cliente p/ pré-preencher.
//   POST /backend/v1/cadastro-cliente/{token}                      (público, uso único)
//        -> valida CPF (dígitos verificadores + duplicado) e campos obrigatórios,
//           grava em dados_enviados do convite (NÃO no cliente), convite -> 'usado',
//           cliente -> 'em_revisao', cria notificação para o dono.
//   POST /backend/v1/clientes-pf/convite/{convite_id}/aprovar       (admin/comercial)
//        -> copia dados_enviados para o cliente (revalida CPF único), cliente -> 'completo',
//           convite -> 'aprovado'.
//   POST /backend/v1/clientes-pf/convite/{convite_id}/recusar       (admin/comercial)
//        -> exige motivo; cliente volta a 'pre_cadastro', convite -> 'recusado'.
// Auditoria em todas as ações (padrão audit_logs do projeto).
//
// Regras respeitadas: sem cron; helpers inline no callback (evita Hook scoping error);
// IP real via header x-forwarded-for (remoteIP não existe no JSVM v0.23+).

// ===========================================================================
// ROTA 1 — Criação de convite pelo staff (admin/comercial)
// ===========================================================================
routerAdd('POST', '/backend/v1/clientes-pf/{id}/convite', (e) => {
  function soDigitos(v) {
    return (v || '').toString().replace(/\D/g, '')
  }
  function isValidCpf(cStr) {
    const clean = soDigitos(cStr)
    if (!clean || clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false
    let soma = 0
    for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
    let resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(clean.charAt(9), 10)) return false
    soma = 0
    for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
    resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    return resto === parseInt(clean.charAt(10), 10)
  }

  // Constantes inline (callbacks rodam em VMs separadas — nada de top-level)
  const BASE_URL_PUBLICA = 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'

  try {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Autenticação necessária.' })
    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'comercial') {
      return e.json(403, {
        error: 'Apenas Administradores e equipe Comercial podem criar convites de cadastro.',
      })
    }

    const clienteId = e.request.pathValue('id')
    let cliente
    try {
      cliente = $app.findRecordById('clientes_pf', clienteId)
    } catch (_) {
      return e.json(404, { error: 'Cliente PF não encontrado.' })
    }

    // Nome obrigatório; CPF é opcional em pré-cadastro, mas se vier tem de ser válido
    const nomeCliente = (cliente.getString('nome') || '').trim()
    if (!nomeCliente) {
      return e.json(400, { error: 'O cliente precisa ter nome para receber o convite.' })
    }
    const cpfAtual = soDigitos(cliente.getString('cpf'))
    if (cpfAtual && !isValidCpf(cpfAtual)) {
      return e.json(400, { error: 'O CPF já cadastrado para este cliente é inválido.' })
    }

    let body = {}
    try {
      const reqInfo = e.requestInfo ? e.requestInfo() : null
      if (reqInfo && reqInfo.body && typeof reqInfo.body === 'object') {
        body = reqInfo.body
      }
    } catch (_) {}
    if (!body || Object.keys(body).length === 0) {
      try {
        e.bindBody(body)
      } catch (_) {
        body = {}
      }
    }
    const enviarEmail =
      body.enviar_email === true || body.enviar_email === 'true' || body.enviar_email === 1

    const emailCliente = (cliente.getString('email') || '').trim()
    if (enviarEmail && (!emailCliente || emailCliente.indexOf('@') === -1)) {
      return e.json(400, {
        error: 'O cliente não possui e-mail cadastrado para envio do convite.',
      })
    }

    const ipEnvio =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      '127.0.0.1'

    // (A) Cancela convite ativo anterior (qualquer status 'ativo' vira 'cancelado')
    // Nota: clientes_pf_convites não possui campo autodate 'created'; ordenar por -id
    try {
      const ativos = $app.findRecordsByFilter(
        'clientes_pf_convites',
        "cliente_pf = '" + clienteId + "' && status = 'ativo'",
        '-id',
        50,
        0,
      )
      for (let i = 0; i < ativos.length; i++) {
        ativos[i].set('status', 'cancelado')
        $app.save(ativos[i])
      }
    } catch (eCancel) {
      console.log('Aviso ao cancelar convites anteriores: ' + eCancel)
    }

    // (B) Token aleatório (>=32 chars) — grava SOMENTE o hash SHA-256
    const tokenAleatorio = $security.randomString(43)
    const tokenHash = $security.sha256(tokenAleatorio)
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const convCol = $app.findCollectionByNameOrId('clientes_pf_convites')
    const convite = new Record(convCol)
    convite.set('cliente_pf', clienteId)
    convite.set('token', tokenHash)
    convite.set('expira_em', expiraEm)
    convite.set('status', 'ativo')
    convite.set('canal', enviarEmail ? 'email' : 'link')
    convite.set('criado_por', auth.id)
    convite.set('enviado_em', enviarEmail ? new Date().toISOString() : '')
    convite.set('ip_envio', ipEnvio)
    $app.save(convite)

    // (C) Cliente passa a 'aguardando_cliente'
    cliente.set('cadastro_status', 'aguardando_cliente')
    $app.save(cliente)

    // (D) E-mail de convite — SOMENTE quando o dono dispara por enviar_email
    let emailEnviado = false
    if (enviarEmail) {
      try {
        const settings = $app.settings()
        const meta = settings.meta || {}
        const smtp = settings.smtp || {}
        if (smtp.enabled && smtp.host && meta.senderAddress) {
          const linkConvite = BASE_URL_PUBLICA + '/cadastro-cliente?token=' + tokenAleatorio
          const htmlEmail =
            '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
            '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
            '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
            '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
            '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Cadastro de Cliente</p>' +
            '</td></tr>' +
            '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
            '<p>Olá, <strong>' +
            nomeCliente +
            '</strong>!</p>' +
            '<p>Para concluirmos o seu cadastro, precisamos que você complete alguns dados no formulário seguro abaixo:</p>' +
            '<p style="text-align:center;margin:24px 0;">' +
            '<a href="' +
            linkConvite +
            '" style="background-color:#D95A2B;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px;display:inline-block;">Completar meu cadastro</a>' +
            '</p>' +
            '<p>Este link é pessoal e expira em <strong>7 dias</strong>.</p>' +
            '<p style="font-size:12px;color:#64748b;">Se você não reconhece este pedido, ignore este e-mail.</p>' +
            '</td></tr>' +
            '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
            'G+ Engenharia Consultiva' +
            '</td></tr>' +
            '</table></body></html>'

          const msg = new MailerMessage({
            from: {
              address: meta.senderAddress,
              name: meta.senderName || 'G+ Engenharia Consultiva',
            },
            to: [{ address: emailCliente, name: nomeCliente }],
            subject: 'Complete o seu cadastro — G+ Engenharia Consultiva',
            html: htmlEmail,
          })
          $app.newMailClient().send(msg)
          emailEnviado = true
        }
      } catch (eMail) {
        console.log('Aviso: falha ao enviar e-mail de convite de cadastro: ' + eMail)
      }
    }

    // (E) Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'CONVITE_CADASTRO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf_convites')
      aRec.set('registro_id', convite.id)
      aRec.set('ip', ipEnvio)
      aRec.set('detalhes', {
        cliente_pf: clienteId,
        cliente_nome: nomeCliente,
        canal: enviarEmail ? 'email' : 'link',
        enviar_email: enviarEmail,
        email_enviado: emailEnviado,
        expira_em: expiraEm,
      })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Aviso ao auditar criação de convite: ' + eAudit)
    }

    return e.json(200, {
      sucesso: true,
      convite_id: convite.id,
      token: tokenAleatorio,
      link: BASE_URL_PUBLICA + '/cadastro-cliente?token=' + tokenAleatorio,
      expira_em: expiraEm,
      email_enviado: emailEnviado,
      cliente_status: 'aguardando_cliente',
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao criar convite de cadastro: ' + err })
  }
})

// ===========================================================================
// ROTA 2 — Consulta pública do convite (pré-preencher formulário)
// ===========================================================================
routerAdd('GET', '/backend/v1/cadastro-cliente/{token}', (e) => {
  try {
    const token = (e.request.pathValue('token') || '').trim()
    if (!token) return e.json(400, { error: 'Token inválido.' })

    const tokenHash = $security.sha256(token)
    let convite
    try {
      convite = $app.findFirstRecordByFilter('clientes_pf_convites', "token = '" + tokenHash + "'")
    } catch (_) {
      convite = null
    }
    if (!convite) return e.json(404, { error: 'Link inválido ou expirado.' })

    if (convite.getString('status') !== 'ativo') {
      return e.json(410, { error: 'Este link já foi utilizado ou não está mais disponível.' })
    }

    const expiraEm = convite.getString('expira_em')
    if (expiraEm && new Date(expiraEm).getTime() < Date.now()) {
      return e.json(410, { error: 'Este link expirou. Solicite um novo link à nossa equipe.' })
    }

    const clienteId = convite.getString('cliente_pf')
    let cliente
    try {
      cliente = $app.findRecordById('clientes_pf', clienteId)
    } catch (_) {
      return e.json(404, { error: 'Link inválido ou expirado.' })
    }

    // Devolve SOMENTE nome e dados já existentes DESSE cliente (pré-preenchimento)
    return e.json(200, {
      sucesso: true,
      expira_em: expiraEm,
      dados: {
        nome: cliente.getString('nome'),
        cpf: cliente.getString('cpf'),
        email: cliente.getString('email'),
        telefone: cliente.getString('telefone'),
        doc_tipo: cliente.getString('doc_tipo') || (cliente.getString('rg') ? 'RG' : ''),
        doc_tipo_outro: cliente.getString('doc_tipo_outro'),
        rg: cliente.getString('rg'),
        rg_orgao_emissor: cliente.getString('rg_orgao_emissor'),
        rg_uf: cliente.getString('rg_uf'),
        cep: cliente.getString('cep'),
        logradouro: cliente.getString('logradouro'),
        numero: cliente.getString('numero'),
        complemento: cliente.getString('complemento'),
        bairro: cliente.getString('bairro'),
        municipio: cliente.getString('municipio'),
        uf: cliente.getString('uf'),
      },
    })
  } catch (err) {
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', '/backend/v1/cadastro-cliente/:token [GET]')
        errRec.set(
          'mensagem',
          ('Erro ao carregar dados do convite: ' + (err.message || String(err))).slice(0, 1000),
        )
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', {
          erro: String(err),
          stack: err && err.stack ? String(err.stack) : '',
        })
        $app.save(errRec)
      }
    } catch (_) {}
    return e.json(500, {
      error: 'Não foi possível carregar os dados do convite. Por favor, tente novamente.',
      erro: 'Não foi possível carregar os dados do convite. Por favor, tente novamente.',
    })
  }
})

// ===========================================================================
// ROTA 3 — Submissão pública do formulário (uso único, rate limit por IP)
// ===========================================================================
routerAdd('POST', '/backend/v1/cadastro-cliente/{token}', (e) => {
  function soDigitos(v) {
    return (v || '').toString().replace(/\D/g, '')
  }
  function isValidCpf(cStr) {
    const clean = soDigitos(cStr)
    if (!clean || clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false
    let soma = 0
    for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
    let resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(clean.charAt(9), 10)) return false
    soma = 0
    for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
    resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    return resto === parseInt(clean.charAt(10), 10)
  }
  function ehEmailValido(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').toString().trim())
  }
  const CPF_ESTADOS_UF = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]
  const ESTADOS_CIVIS_VALIDOS = [
    'solteiro(a)',
    'casado(a)',
    'união estável',
    'divorciado(a)',
    'separado(a)',
    'viúvo(a)',
  ]

  try {
    // Rate limit por IP: máx. 10 submissões a cada 10 minutos (via x-forwarded-for)
    const ipCliente =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      '127.0.0.1'

    try {
      const janelaInicio = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace('T', ' ')
      const rowRate = {}
      $app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS total FROM clientes_pf_convites WHERE ip_envio = {:ip} AND enviado_em >= {:janela}',
        )
        .bind({ ip: ipCliente, janela: janelaInicio })
        .one(rowRate)
      const totalRecentes = parseInt(rowRate.total, 10) || 0
      if (totalRecentes >= 10) {
        return e.json(429, {
          error: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
        })
      }
    } catch (eRate) {
      console.log('Aviso ao aplicar rate limit: ' + eRate)
    }

    const token = (e.request.pathValue('token') || '').trim()
    if (!token) return e.json(400, { error: 'Token inválido.' })
    const tokenHash = $security.sha256(token)

    let convite
    try {
      convite = $app.findFirstRecordByFilter('clientes_pf_convites', "token = '" + tokenHash + "'")
    } catch (_) {
      convite = null
    }
    if (!convite) return e.json(404, { error: 'Link inválido ou expirado.' })

    if (convite.getString('status') !== 'ativo') {
      return e.json(410, { error: 'Este link já foi utilizado ou não está mais disponível.' })
    }
    const expiraEm = convite.getString('expira_em')
    if (expiraEm && new Date(expiraEm).getTime() < Date.now()) {
      return e.json(410, { error: 'Este link expirou. Solicite um novo link à nossa equipe.' })
    }

    const clienteId = convite.getString('cliente_pf')
    let cliente
    try {
      cliente = $app.findRecordById('clientes_pf', clienteId)
    } catch (_) {
      return e.json(404, { error: 'Link inválido ou expirado.' })
    }

    let rawBody = {}
    try {
      const reqInfo = e.requestInfo ? e.requestInfo() : null
      if (reqInfo && reqInfo.body && typeof reqInfo.body === 'object') {
        rawBody = reqInfo.body
      }
    } catch (_) {}

    if (!rawBody || Object.keys(rawBody).length === 0) {
      try {
        const parsed = {}
        e.bindBody(parsed)
        rawBody = parsed
      } catch (_) {}
    }

    // Suporte tanto para payload plano quanto para aninhado em { dados: { ... } }
    const body =
      rawBody && typeof rawBody.dados === 'object' && rawBody.dados !== null
        ? Object.assign({}, rawBody, rawBody.dados)
        : rawBody || {}

    // -----------------------------------------------------------------------
    // Validação dos campos obrigatórios
    // -----------------------------------------------------------------------
    const docTipoValidos = ['CIN', 'RG', 'CNH', 'Carteira profissional', 'Outro']
    const docTipo = (body.doc_tipo || '').toString().trim()
    const docTipoOutro = (body.doc_tipo_outro || '').toString().trim()
    const cpf = soDigitos(body.cpf)
    // Se CIN, o número do documento é o próprio CPF (apenas dígitos)
    const rg = docTipo === 'CIN' ? cpf : (body.rg || '').toString().trim()
    const rgOrgao = (body.rg_orgao_emissor || '').toString().trim()
    const rgUf = (body.rg_uf || '').toString().trim().toUpperCase()
    const estadoCivil = (body.estado_civil || '').toString().trim().toLowerCase()
    const regimeBens = (body.regime_bens || '').toString().trim()
    const profissao = (body.profissao || '').toString().trim()
    const nacionalidade = (body.nacionalidade || '').toString().trim()
    const dataNascimento = (body.data_nascimento || '').toString().trim()
    const cep = (body.cep || '').toString().trim()
    const logradouro = (body.logradouro || '').toString().trim()
    const numero = (body.numero || '').toString().trim()
    const complemento = (body.complemento || '').toString().trim()
    const bairro = (body.bairro || '').toString().trim()
    const municipio = (body.municipio || '').toString().trim()
    const uf = (body.uf || '').toString().trim().toUpperCase()
    const telefone = (body.telefone || '').toString().trim()
    const email = (body.email || '').toString().trim().toLowerCase()
    const aceiteLgpd = body.aceite_lgpd === true || body.aceite_lgpd === 'true'

    const errosPorCampo = {}
    if (!docTipo || docTipoValidos.indexOf(docTipo) === -1) {
      errosPorCampo.doc_tipo = 'Selecione o documento de identificação.'
    }
    if (docTipo === 'Outro' && !docTipoOutro) {
      errosPorCampo.doc_tipo_outro = 'Informe qual é o documento de identificação.'
    }
    if (!cpf) {
      errosPorCampo.cpf = 'Informe o CPF.'
    } else if (!isValidCpf(cpf)) {
      errosPorCampo.cpf =
        'Informe um CPF válido (11 dígitos, com os dígitos verificadores corretos).'
    }
    if (!rg) {
      errosPorCampo.rg = 'Informe o número do documento.'
    }
    if (!rgOrgao) {
      errosPorCampo.rg_orgao_emissor = 'Informe o órgão emissor.'
    }
    if (!rgUf || rgUf.length !== 2 || CPF_ESTADOS_UF.indexOf(rgUf) === -1) {
      errosPorCampo.rg_uf = 'Selecione a UF do documento.'
    }
    if (!estadoCivil || ESTADOS_CIVIS_VALIDOS.indexOf(estadoCivil) === -1) {
      errosPorCampo.estado_civil = 'Selecione o estado civil.'
    }
    if (!profissao) {
      errosPorCampo.profissao = 'Informe a profissão.'
    }
    if (!nacionalidade) {
      errosPorCampo.nacionalidade = 'Informe a nacionalidade.'
    }
    if (!dataNascimento) {
      errosPorCampo.data_nascimento = 'Informe a data de nascimento.'
    }
    if (!cep || soDigitos(cep).length < 8) {
      errosPorCampo.cep = 'Informe um CEP válido (8 dígitos).'
    }
    if (!logradouro) {
      errosPorCampo.logradouro = 'Informe o logradouro.'
    }
    if (!numero) {
      errosPorCampo.numero = 'Informe o número do endereço.'
    }
    if (!bairro) {
      errosPorCampo.bairro = 'Informe o bairro.'
    }
    if (!municipio) {
      errosPorCampo.municipio = 'Informe o município.'
    }
    if (!uf || uf.length !== 2 || CPF_ESTADOS_UF.indexOf(uf) === -1) {
      errosPorCampo.uf = 'Selecione a UF do endereço.'
    }
    if (!telefone) {
      errosPorCampo.telefone = 'Informe um telefone válido.'
    }
    if (!email) {
      errosPorCampo.email = 'Informe o e-mail.'
    } else if (!ehEmailValido(email)) {
      errosPorCampo.email = 'Informe um e-mail válido.'
    }
    if (!aceiteLgpd) {
      errosPorCampo.aceite_lgpd = 'É necessário marcar o aceite do tratamento de dados (LGPD).'
    }

    const camposFaltantes = Object.keys(errosPorCampo)
    if (camposFaltantes.length > 0) {
      return e.json(400, {
        error: 'Campos obrigatórios ausentes ou inválidos: ' + camposFaltantes.join(', ') + '.',
        campos: camposFaltantes,
        erros: errosPorCampo,
      })
    }

    // CPF duplicado — regra de negócio (não mexe em cadastros reais, só bloqueia novo envio)
    try {
      const duplicados = $app.findRecordsByFilter(
        'clientes_pf',
        "cpf != '' && id != '" + clienteId + "'",
        '-id',
        500,
        0,
      )
      for (let i = 0; i < duplicados.length; i++) {
        if (soDigitos(duplicados[i].getString('cpf')) === cpf) {
          const msgDup = 'Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.'
          return e.json(409, {
            error: msgDup,
            campos: ['cpf'],
            erros: { cpf: msgDup },
          })
        }
      }
    } catch (eDup) {
      console.log('Aviso ao verificar CPF duplicado: ' + eDup)
    }

    // -----------------------------------------------------------------------
    // Grava em dados_enviados do convite (NÃO no cliente)
    // -----------------------------------------------------------------------
    const dadosEnviados = {
      doc_tipo: docTipo,
      doc_tipo_outro: docTipo === 'Outro' ? docTipoOutro : '',
      cpf,
      rg,
      rg_orgao_emissor: rgOrgao,
      rg_uf: rgUf,
      estado_civil: estadoCivil,
      regime_bens: regimeBens,
      profissao,
      nacionalidade,
      data_nascimento: dataNascimento,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      municipio,
      uf,
      telefone,
      email,
      aceite_lgpd: aceiteLgpd,
      submetido_em: new Date().toISOString(),
    }

    convite.set('dados_enviados', dadosEnviados)
    convite.set('status', 'usado')
    convite.set('enviado_em', new Date().toISOString())
    convite.set('ip_envio', ipCliente)
    $app.save(convite)

    cliente.set('cadastro_status', 'em_revisao')
    $app.save(cliente)

    // -----------------------------------------------------------------------
    // Notificação para o dono (admin/gestor)
    // -----------------------------------------------------------------------
    try {
      const notCol = $app.findCollectionByNameOrId('notificacoes')
      const donos = $app.findRecordsByFilter(
        'users',
        "role = 'admin' || role = 'gestor'",
        '',
        20,
        0,
      )
      for (let i = 0; i < donos.length; i++) {
        const nRec = new Record(notCol)
        nRec.set('destinatario_tipo', 'interno')
        nRec.set('destinatario_usuario', donos[i].id)
        nRec.set('destinatario_email', donos[i].getString('email'))
        nRec.set('tipo', 'sistema')
        nRec.set('titulo', 'Cliente PF enviou dados para revisão')
        nRec.set(
          'mensagem',
          'O cliente "' +
            (cliente.getString('nome') || 'Cliente PF') +
            '" completou o cadastro pelo link seguro e aguarda revisão.',
        )
        nRec.set('referencia_tipo', 'clientes_pf')
        nRec.set('referencia_id', clienteId)
        nRec.set('lida', false)
        nRec.set('email_enviado', false)
        $app.save(nRec)
      }
    } catch (eNotif) {
      console.log('Aviso ao criar notificação de cadastro recebido: ' + eNotif)
    }

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', null)
      aRec.set('user_email', email)
      aRec.set('acao', 'ENVIO_DADOS_CADASTRO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf_convites')
      aRec.set('registro_id', convite.id)
      aRec.set('ip', ipCliente)
      aRec.set('detalhes', {
        cliente_pf: clienteId,
        canal: convite.getString('canal'),
        campos_informados: Object.keys(dadosEnviados).filter((k) => k !== 'submetido_em'),
      })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Aviso ao auditar envio de cadastro: ' + eAudit)
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Dados recebidos com sucesso! Nossa equipe fará a revisão e confirmará em breve.',
      convite_id: convite.id,
    })
  } catch (err) {
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', '/backend/v1/cadastro-cliente/:token [POST]')
        errRec.set(
          'mensagem',
          ('Erro ao processar cadastro: ' + (err.message || String(err))).slice(0, 1000),
        )
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', {
          erro: String(err),
          stack: err && err.stack ? String(err.stack) : '',
        })
        $app.save(errRec)
      }
    } catch (_) {}
    return e.json(500, {
      error:
        'Não foi possível processar o envio do cadastro. Por favor, tente novamente em instantes.',
      erro: 'Não foi possível processar o envio do cadastro. Por favor, tente novamente em instantes.',
    })
  }
})

// ===========================================================================
// ROTA 4 — Aprovar convite (admin/comercial)
// ===========================================================================
routerAdd('POST', '/backend/v1/clientes-pf/convite/{convite_id}/aprovar', (e) => {
  function soDigitos(v) {
    return (v || '').toString().replace(/\D/g, '')
  }
  function isValidCpf(cStr) {
    const clean = soDigitos(cStr)
    if (!clean || clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false
    let soma = 0
    for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
    let resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(clean.charAt(9), 10)) return false
    soma = 0
    for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
    resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    return resto === parseInt(clean.charAt(10), 10)
  }

  try {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Autenticação necessária.' })
    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'comercial') {
      return e.json(403, {
        error: 'Apenas Administradores e equipe Comercial podem aprovar cadastros.',
      })
    }

    const conviteId = e.request.pathValue('convite_id')
    let convite
    try {
      convite = $app.findRecordById('clientes_pf_convites', conviteId)
    } catch (_) {
      return e.json(404, { error: 'Convite não encontrado.' })
    }

    if (convite.getString('status') !== 'usado') {
      return e.json(400, {
        error: 'Somente convites com dados já enviados pelo cliente podem ser aprovados.',
      })
    }

    const clienteId = convite.getString('cliente_pf')
    let cliente
    try {
      cliente = $app.findRecordById('clientes_pf', clienteId)
    } catch (_) {
      return e.json(404, { error: 'Cliente PF não encontrado.' })
    }

    let dados = {}
    try {
      dados = convite.get('dados_enviados') || {}
    } catch (_) {
      dados = {}
    }

    // Revalidar CPF único antes de gravar no cliente
    const cpfNovo = soDigitos(dados.cpf)
    if (!cpfNovo || !isValidCpf(cpfNovo)) {
      return e.json(400, { error: 'O CPF informado pelo cliente é inválido.' })
    }
    try {
      const duplicados = $app.findRecordsByFilter(
        'clientes_pf',
        "cpf != '' && id != '" + clienteId + "'",
        '-id',
        500,
        0,
      )
      for (let i = 0; i < duplicados.length; i++) {
        if (soDigitos(duplicados[i].getString('cpf')) === cpfNovo) {
          return e.json(409, { error: 'Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.' })
        }
      }
    } catch (eDup) {
      console.log('Aviso ao revalidar CPF único na aprovação: ' + eDup)
    }

    // Copia dados_enviados -> cliente
    cliente.set('cpf', cpfNovo)
    if (dados.doc_tipo) cliente.set('doc_tipo', dados.doc_tipo)
    if (dados.doc_tipo_outro !== undefined)
      cliente.set('doc_tipo_outro', dados.doc_tipo_outro || '')
    const rgFinal = dados.doc_tipo === 'CIN' ? cpfNovo : dados.rg || ''
    if (rgFinal) cliente.set('rg', rgFinal)
    if (dados.rg_orgao_emissor) cliente.set('rg_orgao_emissor', dados.rg_orgao_emissor)
    if (dados.rg_uf) cliente.set('rg_uf', dados.rg_uf)
    if (dados.estado_civil) cliente.set('estado_civil', dados.estado_civil)
    // Mantém compatibilidade caso enviado, mas sem exigência
    if (dados.regime_bens) cliente.set('regime_bens', dados.regime_bens)
    if (dados.profissao) cliente.set('profissao', dados.profissao)
    if (dados.nacionalidade) cliente.set('nacionalidade', dados.nacionalidade)
    if (dados.data_nascimento) cliente.set('data_nascimento', dados.data_nascimento)
    if (dados.cep) cliente.set('cep', dados.cep)
    if (dados.logradouro) cliente.set('logradouro', dados.logradouro)
    if (dados.numero) cliente.set('numero', dados.numero)
    if (dados.complemento) cliente.set('complemento', dados.complemento)
    if (dados.bairro) cliente.set('bairro', dados.bairro)
    if (dados.municipio) cliente.set('municipio', dados.municipio)
    if (dados.uf) cliente.set('uf', dados.uf)
    if (dados.telefone) cliente.set('telefone', dados.telefone)
    if (dados.email) cliente.set('email', dados.email)
    cliente.set('consentimento_lgpd', true)
    cliente.set('data_consentimento', new Date().toISOString())
    cliente.set('cadastro_status', 'completo')
    $app.save(cliente)

    convite.set('status', 'aprovado')
    convite.set('revisado_por', auth.id)
    convite.set('revisado_em', new Date().toISOString())
    $app.save(convite)

    const ipAcao =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      '127.0.0.1'

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'APROVACAO_CADASTRO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf_convites')
      aRec.set('registro_id', convite.id)
      aRec.set('ip', ipAcao)
      aRec.set('detalhes', { cliente_pf: clienteId, cpf_final: cpfNovo })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Aviso ao auditar aprovação de convite: ' + eAudit)
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Cadastro aprovado e dados copiados para o cliente.',
      cliente_id: clienteId,
      cliente_status: 'completo',
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao aprovar cadastro: ' + err })
  }
})

// ===========================================================================
// ROTA 5 — Recusar convite (admin/comercial)
// ===========================================================================
routerAdd('POST', '/backend/v1/clientes-pf/convite/{convite_id}/recusar', (e) => {
  try {
    const auth = e.auth
    if (!auth) return e.json(401, { error: 'Autenticação necessária.' })
    const role = auth.getString('role')
    if (role !== 'admin' && role !== 'comercial') {
      return e.json(403, {
        error: 'Apenas Administradores e equipe Comercial podem recusar cadastros.',
      })
    }

    const conviteId = e.request.pathValue('convite_id')
    let convite
    try {
      convite = $app.findRecordById('clientes_pf_convites', conviteId)
    } catch (_) {
      return e.json(404, { error: 'Convite não encontrado.' })
    }

    if (convite.getString('status') !== 'usado') {
      return e.json(400, {
        error: 'Somente convites com dados já enviados pelo cliente podem ser recusados.',
      })
    }

    let body = {}
    try {
      const reqInfo = e.requestInfo ? e.requestInfo() : null
      if (reqInfo && reqInfo.body && typeof reqInfo.body === 'object') {
        body = reqInfo.body
      }
    } catch (_) {}
    if (!body || Object.keys(body).length === 0) {
      try {
        e.bindBody(body)
      } catch (_) {
        body = {}
      }
    }
    const motivo = (body.motivo || '').toString().trim()
    if (!motivo) {
      return e.json(400, { error: 'É obrigatório informar o motivo da recusa.' })
    }

    const clienteId = convite.getString('cliente_pf')
    let cliente
    try {
      cliente = $app.findRecordById('clientes_pf', clienteId)
    } catch (_) {
      return e.json(404, { error: 'Cliente PF não encontrado.' })
    }

    convite.set('status', 'recusado')
    convite.set('revisado_por', auth.id)
    convite.set('revisado_em', new Date().toISOString())
    convite.set('motivo_recusa', motivo)
    $app.save(convite)

    cliente.set('cadastro_status', 'pre_cadastro')
    $app.save(cliente)

    const ipAcao =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      '127.0.0.1'

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'RECUSA_CADASTRO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf_convites')
      aRec.set('registro_id', convite.id)
      aRec.set('ip', ipAcao)
      aRec.set('detalhes', { cliente_pf: clienteId, motivo })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Aviso ao auditar recusa de convite: ' + eAudit)
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Cadastro recusado. O cliente voltou para pré-cadastro.',
      cliente_id: clienteId,
      cliente_status: 'pre_cadastro',
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao recusar cadastro: ' + err })
  }
})
