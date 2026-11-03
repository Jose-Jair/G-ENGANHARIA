// pocketbase/hooks/site_leads_publico.js
// Endpoint público para recebimento de leads do site institucional G+ Engenharia
// Requisitos:
// 100% inline no callback routerAdd (sem funções top-level, sem cronAdd, sem envio de e-mail)
// CORS com OPTIONS e headers no POST
// Antispam: máx 5 envios por IP por hora (audit_logs com acao 'LEAD_SITE', IP via x-forwarded-for)
// Validação: nome, email OU whatsapp, descricao (<=3000), consentimento_lgpd=true
// Consulta à lista 'nao_contatar': se presente, grava e marca flag
// PJ: localiza empresa por CNPJ ou nome ou cria na etapa 'identificada' com origem 'site'
// PF: localiza cliente_pf por CPF ou email ou cria com pre_cadastro=true e origem 'site' (espelhando em empresas)
// Demanda registrada como interação/toque com serviços, descrição, prazo, cidade/UF, data e IP de consentimento
// Auditoria 'LEAD_SITE' e notificação para admins
// Resposta 200 com { success: true, protocolo: '<id curto>' } em < 2s

routerAdd('OPTIONS', '/backend/v1/publico/lead-site', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  e.response.header().set('Access-Control-Max-Age', '86400')
  return e.noContent(204)
})

routerAdd('POST', '/backend/v1/publico/lead-site', (e) => {
  // Configuração obrigatória de CORS
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}

    // 1. HONEYPOT: se preenchido, responder 200 imediatamente SEM gravar nada
    const honeypotVal = (body.website || '').trim()
    if (honeypotVal) {
      return e.json(200, {
        success: true,
        protocolo: 'HP-' + $security.randomString(6).toUpperCase(),
        mensagem: 'Solicitação recebida com sucesso.',
      })
    }

    // 2. Extração segura de IP real (NUNCA requestInfo().remoteIP no PB v0.23)
    let rawIp = ''
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        rawIp = e.request.header.get('x-forwarded-for') || e.request.header.get('x-real-ip') || ''
      }
      if (!rawIp && e.request && typeof e.request.getHeader === 'function') {
        rawIp = e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip') || ''
      }
      if (!rawIp && reqInfo.headers) {
        rawIp = reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || ''
      }
    } catch (_) {}

    if (rawIp && typeof rawIp === 'string') {
      rawIp = rawIp.split(',')[0].trim()
    }
    const clientIp = rawIp && rawIp !== '127.0.0.1' ? rawIp : 'nao_capturado'

    // 3. ANTISPAM: Máximo 5 envios por IP por hora contando em audit_logs com acao 'LEAD_SITE'
    if (clientIp !== 'nao_capturado') {
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      let totalEnviosIp = 0
      try {
        const registrosIp = $app.findRecordsByFilter(
          'audit_logs',
          "acao = 'LEAD_SITE' && ip = '" +
            clientIp.replace(/'/g, "\\'") +
            "' && created >= '" +
            umaHoraAtras +
            "'",
          '-created',
          10,
          0,
        )
        totalEnviosIp = registrosIp.length
      } catch (errCount) {
        console.log('[site_leads_publico] Erro ao checar rate limit: ' + errCount)
      }

      if (totalEnviosIp >= 5) {
        return e.json(429, {
          success: false,
          error:
            'Limite de envios excedido (máximo 5 por hora). Por favor, aguarde alguns instantes antes de tentar novamente.',
        })
      }
    }

    // 4. SANITIZAÇÃO E LIMITES DE TAMANHO
    const tipoClienteRaw = String(body.tipo_cliente || '')
      .trim()
      .toLowerCase()
    const tipoCliente =
      ['escritorio', 'construtora', 'pessoa_fisica', 'outro'].indexOf(tipoClienteRaw) !== -1
        ? tipoClienteRaw
        : 'outro'

    const nome = String(body.nome || '')
      .trim()
      .slice(0, 150)
    const empresaNome = String(body.empresa || '')
      .trim()
      .slice(0, 200)
    const documentoRaw = String(body.documento || '')
      .replace(/\D/g, '')
      .slice(0, 18)
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
      .slice(0, 120)
    const whatsappRaw = String(body.whatsapp || '')
      .trim()
      .slice(0, 30)
    const cidade = String(body.cidade || '')
      .trim()
      .slice(0, 100)
    const uf = String(body.uf || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    const descricao = String(body.descricao || '')
      .trim()
      .slice(0, 3000)
    const prazoDesejado = String(body.prazo_desejado || '')
      .trim()
      .slice(0, 100)
    const comoConheceu = String(body.como_conheceu || '')
      .trim()
      .slice(0, 150)
    const consentimentoLgpd = Boolean(body.consentimento_lgpd)

    // Tratamento do array de serviços
    let servicos = []
    if (Array.isArray(body.servicos)) {
      servicos = body.servicos
        .map((s) =>
          String(s || '')
            .trim()
            .slice(0, 100),
        )
        .filter((s) => Boolean(s))
    } else if (typeof body.servicos === 'string' && body.servicos.trim()) {
      servicos = body.servicos
        .split(',')
        .map((s) => s.trim().slice(0, 100))
        .filter((s) => Boolean(s))
    }

    // 5. VALIDAÇÕES DE NEGÓCIO (mensagens em português)
    if (!nome) {
      return e.json(400, {
        success: false,
        error: 'O campo Nome é obrigatório.',
      })
    }

    if (!consentimentoLgpd) {
      return e.json(400, {
        success: false,
        error:
          'O consentimento com a Política de Privacidade e LGPD é obrigatório para envio do pedido.',
      })
    }

    if (!descricao) {
      return e.json(400, {
        success: false,
        error: 'A descrição da demanda ou projeto é obrigatória (até 3000 caracteres).',
      })
    }

    if (!email && !whatsappRaw) {
      return e.json(400, {
        success: false,
        error: 'Informe ao menos um meio de contato: e-mail ou WhatsApp.',
      })
    }

    // Validação de formato de e-mail se fornecido
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return e.json(400, {
          success: false,
          error: 'O formato do e-mail informado é inválido.',
        })
      }
    }

    // Normalização de telefone/whatsapp
    const whatsappApenasDigitos = whatsappRaw.replace(/\D/g, '')

    // 6. CONSULTA À LISTA DE DESCADASTRO (nao_contatar) — Regra permanente
    let estaEmNaoContatar = false
    let motivoNaoContatar = ''
    try {
      if (email) {
        const ncEmail = $app.findRecordsByFilter(
          'nao_contatar',
          "email = '" + email.replace(/'/g, "\\'") + "'",
          '',
          1,
          0,
        )
        if (ncEmail.length > 0) {
          estaEmNaoContatar = true
          motivoNaoContatar = ncEmail[0].getString('motivo') || 'Opt-out de contato registrado'
        }
      }
      if (!estaEmNaoContatar && whatsappApenasDigitos.length >= 8) {
        const ncTelefones = $app.findRecordsByFilter(
          'nao_contatar',
          "motivo ~ '" + whatsappApenasDigitos + "'",
          '',
          1,
          0,
        )
        if (ncTelefones.length > 0) {
          estaEmNaoContatar = true
          motivoNaoContatar =
            ncTelefones[0].getString('motivo') || 'Telefone em lista de descadastro'
        }
      }
    } catch (errNc) {
      console.log('[site_leads_publico] Erro ao consultar lista nao_contatar: ' + errNc)
    }

    // 7. GRAVAÇÃO NO MODELO DO FUNIL
    const agoraIso = new Date().toISOString()
    const dataHoje = agoraIso.substring(0, 10)
    const isPessoaFisica = tipoCliente === 'pessoa_fisica'

    let idEmpresaVinculada = ''
    let idClientePfVinculado = ''
    let registroEmpresa = null
    let registroClientePf = null

    const servicosTexto = servicos.length > 0 ? servicos.join(', ') : 'Serviços de Engenharia'

    // Montar observação estruturada da demanda
    let tagAvisoNaoContatar = ''
    if (estaEmNaoContatar) {
      tagAvisoNaoContatar =
        ' [ATENÇÃO: Consta na lista Não Contatar - ' + (motivoNaoContatar || 'Opt-out prévio') + ']'
    }

    const textoDemanda =
      '[Lead Site G+ ' +
      dataHoje +
      ']' +
      tagAvisoNaoContatar +
      '\n' +
      'Nome solicitante: ' +
      nome +
      '\n' +
      (empresaNome ? 'Empresa informada: ' + empresaNome + '\n' : '') +
      (documentoRaw ? 'Documento informado: ' + documentoRaw + '\n' : '') +
      (email ? 'E-mail: ' + email + '\n' : '') +
      (whatsappRaw ? 'WhatsApp: ' + whatsappRaw + '\n' : '') +
      (cidade || uf ? 'Localidade: ' + cidade + (uf ? '/' + uf : '') + '\n' : '') +
      'Serviços de interesse: ' +
      servicosTexto +
      '\n' +
      (prazoDesejado ? 'Prazo desejado: ' + prazoDesejado + '\n' : '') +
      (comoConheceu ? 'Como conheceu: ' + comoConheceu + '\n' : '') +
      'Consentimento LGPD: Confirmado em ' +
      agoraIso +
      ' (IP: ' +
      clientIp +
      ')\n' +
      '---\n' +
      'Descrição detalhada:\n' +
      descricao

    if (!isPessoaFisica) {
      // Caso PJ: escritório, construtora ou outro com nome de empresa
      const empresasCol = $app.findCollectionByNameOrId('empresas')
      const nomeFinalEmpresa = empresaNome || nome

      // Localizar empresa existente por CNPJ ou nome
      if (documentoRaw && documentoRaw.length === 14) {
        try {
          const achouCnpj = $app.findRecordsByFilter(
            'empresas',
            "cnpj = '" + documentoRaw + "'",
            '',
            1,
            0,
          )
          if (achouCnpj.length > 0) {
            registroEmpresa = achouCnpj[0]
          }
        } catch (_) {}
      }

      if (!registroEmpresa && nomeFinalEmpresa) {
        try {
          const achouNome = $app.findRecordsByFilter(
            'empresas',
            "razao_social ~ '" +
              nomeFinalEmpresa.replace(/'/g, "\\'") +
              "' || nome_fantasia ~ '" +
              nomeFinalEmpresa.replace(/'/g, "\\'") +
              "'",
            '',
            1,
            0,
          )
          if (achouNome.length > 0) {
            registroEmpresa = achouNome[0]
          }
        } catch (_) {}
      }

      if (registroEmpresa) {
        // Empresa já existe: atualizar dados complementares se vazios e anexar observação
        idEmpresaVinculada = registroEmpresa.id
        if (!registroEmpresa.getString('email') && email) {
          registroEmpresa.set('email', email)
        }
        if (!registroEmpresa.getString('telefone') && whatsappRaw) {
          registroEmpresa.set('telefone', whatsappRaw)
        }
        if (!registroEmpresa.getString('municipio') && cidade) {
          registroEmpresa.set('municipio', cidade)
        }
        if (!registroEmpresa.getString('uf') && uf) {
          registroEmpresa.set('uf', uf)
        }
        const obsAtual = registroEmpresa.getString('observacoes') || ''
        registroEmpresa.set('observacoes', (obsAtual ? obsAtual + '\n\n' : '') + textoDemanda)
        registroEmpresa.set(
          'proxima_acao_desc',
          'Retornar lead do site: ' + nome + ' (' + servicosTexto + ')',
        )
        registroEmpresa.set('proxima_acao_data', agoraIso)
        $app.save(registroEmpresa)
      } else {
        // Criar nova empresa na PRIMEIRA etapa do funil ('identificada')
        const novaEmpresa = new Record(empresasCol)
        novaEmpresa.set('razao_social', nomeFinalEmpresa)
        novaEmpresa.set('nome_fantasia', nomeFinalEmpresa)
        if (documentoRaw && documentoRaw.length === 14) {
          novaEmpresa.set('cnpj', documentoRaw)
        } else {
          novaEmpresa.set('cnpj', 'PJ-' + $security.randomString(8).toUpperCase())
        }
        novaEmpresa.set('email', email || '')
        novaEmpresa.set('telefone', whatsappRaw || '')
        if (whatsappRaw) {
          novaEmpresa.set('telefones', [{ numero: whatsappRaw, tipo: 'whatsapp', principal: true }])
        }
        novaEmpresa.set('municipio', cidade || '')
        novaEmpresa.set('uf', uf || '')
        novaEmpresa.set('etapa_funil', 'identificada')
        novaEmpresa.set('curva', 'C')
        novaEmpresa.set('score', 40)
        novaEmpresa.set('status', 'ativa')
        novaEmpresa.set('tipo_cliente', 'pj')
        novaEmpresa.set('pre_cadastro', true)
        novaEmpresa.set('origem', 'site')
        novaEmpresa.set('fonte_prospeccao_origem', 'site')
        novaEmpresa.set('observacoes', textoDemanda)
        novaEmpresa.set(
          'proxima_acao_desc',
          'Retornar lead do site: ' + nome + ' (' + servicosTexto + ')',
        )
        novaEmpresa.set('proxima_acao_data', agoraIso)

        $app.save(novaEmpresa)
        idEmpresaVinculada = novaEmpresa.id
        registroEmpresa = novaEmpresa
      }

      // Adicionar contato da empresa
      if (idEmpresaVinculada) {
        try {
          const contatosCol = $app.findCollectionByNameOrId('contatos')
          const novoContato = new Record(contatosCol)
          novoContato.set('empresa', idEmpresaVinculada)
          novoContato.set('nome', nome)
          novoContato.set('cargo', 'Solicitante do Site')
          novoContato.set('email', email || '')
          novoContato.set('telefone', whatsappRaw || '')
          novoContato.set('whatsapp', whatsappRaw || '')
          novoContato.set('decisor', false)
          novoContato.set('verificado', false)
          $app.save(novoContato)
        } catch (errContato) {
          console.log('[site_leads_publico] Erro ao gravar contato: ' + errContato)
        }
      }
    } else {
      // Caso PF: pessoa física
      const clientesPfCol = $app.findCollectionByNameOrId('clientes_pf')

      // Localizar cliente_pf por CPF ou e-mail
      if (documentoRaw && documentoRaw.length === 11) {
        try {
          const achouCpf = $app.findRecordsByFilter(
            'clientes_pf',
            "cpf = '" + documentoRaw + "'",
            '',
            1,
            0,
          )
          if (achouCpf.length > 0) {
            registroClientePf = achouCpf[0]
          }
        } catch (_) {}
      }

      if (!registroClientePf && email) {
        try {
          const achouEmail = $app.findRecordsByFilter(
            'clientes_pf',
            "email = '" + email.replace(/'/g, "\\'") + "'",
            '',
            1,
            0,
          )
          if (achouEmail.length > 0) {
            registroClientePf = achouEmail[0]
          }
        } catch (_) {}
      }

      if (registroClientePf) {
        idClientePfVinculado = registroClientePf.id
        if (!registroClientePf.getString('telefone') && whatsappRaw) {
          registroClientePf.set('telefone', whatsappRaw)
        }
        if (!registroClientePf.getString('municipio') && cidade) {
          registroClientePf.set('municipio', cidade)
        }
        if (!registroClientePf.getString('uf') && uf) {
          registroClientePf.set('uf', uf)
        }
        const obsAtualPf = registroClientePf.getString('observacoes') || ''
        registroClientePf.set('observacoes', (obsAtualPf ? obsAtualPf + '\n\n' : '') + textoDemanda)
        $app.save(registroClientePf)
      } else {
        const novoPf = new Record(clientesPfCol)
        novoPf.set('nome', nome)
        novoPf.set('cpf', documentoRaw || 'PF-' + $security.randomString(8).toUpperCase())
        novoPf.set('email', email || '')
        novoPf.set('telefone', whatsappRaw || '')
        if (whatsappRaw) {
          novoPf.set('telefones', [{ numero: whatsappRaw, tipo: 'whatsapp', principal: true }])
        }
        novoPf.set('municipio', cidade || '')
        novoPf.set('uf', uf || '')
        novoPf.set('base_legal', 'consentimento')
        novoPf.set('consentimento_lgpd', true)
        novoPf.set('data_consentimento', dataHoje)
        novoPf.set('pre_cadastro', true)
        novoPf.set('origem', 'site')
        novoPf.set('observacoes', textoDemanda)

        $app.save(novoPf)
        idClientePfVinculado = novoPf.id
        registroClientePf = novoPf
      }

      // Espelhar cliente PF na coleção empresas com tipo_cliente='pf' e etapa_funil='identificada'
      try {
        const empresasCol = $app.findCollectionByNameOrId('empresas')
        const espelhos = $app.findRecordsByFilter(
          'empresas',
          "cliente_pf_ref = '" + idClientePfVinculado + "'",
          '',
          1,
          0,
        )

        if (espelhos.length > 0) {
          registroEmpresa = espelhos[0]
          idEmpresaVinculada = registroEmpresa.id
          const obsEmpAtual = registroEmpresa.getString('observacoes') || ''
          registroEmpresa.set(
            'observacoes',
            (obsEmpAtual ? obsEmpAtual + '\n\n' : '') + textoDemanda,
          )
          registroEmpresa.set(
            'proxima_acao_desc',
            'Retornar lead do site (PF): ' + nome + ' (' + servicosTexto + ')',
          )
          registroEmpresa.set('proxima_acao_data', agoraIso)
          $app.save(registroEmpresa)
        } else {
          const novaEmpPf = new Record(empresasCol)
          novaEmpPf.set('razao_social', nome)
          novaEmpPf.set('nome_fantasia', nome)
          novaEmpPf.set('cnpj', documentoRaw || 'PF-' + idClientePfVinculado)
          novaEmpPf.set('email', email || '')
          novaEmpPf.set('telefone', whatsappRaw || '')
          if (whatsappRaw) {
            novaEmpPf.set('telefones', [{ numero: whatsappRaw, tipo: 'whatsapp', principal: true }])
          }
          novaEmpPf.set('municipio', cidade || '')
          novaEmpPf.set('uf', uf || '')
          novaEmpPf.set('tipo_cliente', 'pf')
          novaEmpPf.set('cliente_pf_ref', idClientePfVinculado)
          novaEmpPf.set('etapa_funil', 'identificada')
          novaEmpPf.set('curva', 'C')
          novaEmpPf.set('score', 40)
          novaEmpPf.set('status', 'ativa')
          novaEmpPf.set('pre_cadastro', true)
          novaEmpPf.set('origem', 'site')
          novaEmpPf.set('fonte_prospeccao_origem', 'site')
          novaEmpPf.set('observacoes', textoDemanda)
          novaEmpPf.set(
            'proxima_acao_desc',
            'Retornar lead do site (PF): ' + nome + ' (' + servicosTexto + ')',
          )
          novaEmpPf.set('proxima_acao_data', agoraIso)

          $app.save(novaEmpPf)
          idEmpresaVinculada = novaEmpPf.id
          registroEmpresa = novaEmpPf
        }
      } catch (errEspelho) {
        console.log('[site_leads_publico] Erro ao espelhar PF em empresas: ' + errEspelho)
      }
    }

    // 8. REGISTRO DE DEMANDA COMO TOQUE/INTERAÇÃO NO FUNIL
    if (idEmpresaVinculada) {
      try {
        const toquesCol = $app.findCollectionByNameOrId('toques')
        const novoToque = new Record(toquesCol)
        novoToque.set('empresa', idEmpresaVinculada)
        novoToque.set('numero_toque', 1)
        novoToque.set('data_prevista', agoraIso)
        novoToque.set('data_realizada', agoraIso)
        novoToque.set('canal', 'site')
        novoToque.set('status', 'respondido')
        novoToque.set(
          'resultado',
          'Lead recebido via formulário de orçamento do site institucional G+ Engenharia.',
        )
        novoToque.set(
          'observacao',
          'Serviços: ' +
            servicosTexto +
            '\n' +
            (prazoDesejado ? 'Prazo desejado: ' + prazoDesejado + '\n' : '') +
            (cidade || uf ? 'Local: ' + cidade + (uf ? '/' + uf : '') + '\n' : '') +
            'Consentimento LGPD: ' +
            agoraIso +
            ' (IP ' +
            clientIp +
            ')\n' +
            (estaEmNaoContatar ? '[FLAG: E-mail ou Telefone consta na lista Não Contatar]\n' : '') +
            'Descrição: ' +
            descricao,
        )
        $app.save(novoToque)
      } catch (errToque) {
        console.log('[site_leads_publico] Erro ao gravar toque do lead: ' + errToque)
      }
    }

    // 9. GERAR PROTOCOLO CURTO DE ATENDIMENTO
    const protocoloCurto =
      'LEAD-' + new Date().getFullYear() + '-' + $security.randomString(6).toUpperCase()

    // 10. GRAVAR AUDITORIA COM AÇÃO 'LEAD_SITE'
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user', null)
      auditRec.set('user_email', email || 'LEAD_SITE')
      auditRec.set('acao', 'LEAD_SITE')
      auditRec.set('entidade', isPessoaFisica ? 'clientes_pf' : 'empresas')
      auditRec.set('registro_id', idEmpresaVinculada || idClientePfVinculado || protocoloCurto)
      auditRec.set('ip', clientIp)
      auditRec.set('detalhes', {
        protocolo: protocoloCurto,
        nome: nome,
        tipo_cliente: tipoCliente,
        empresa: empresaNome,
        email: email,
        whatsapp: whatsappRaw,
        cidade: cidade,
        uf: uf,
        servicos: servicos,
        prazo_desejado: prazoDesejado,
        como_conheceu: comoConheceu,
        empresa_id: idEmpresaVinculada,
        cliente_pf_id: idClientePfVinculado,
        consta_nao_contatar: estaEmNaoContatar,
        motivo_nao_contatar: motivoNaoContatar,
        consentimento_lgpd_ip: clientIp,
        consentimento_lgpd_data: agoraIso,
      })
      $app.save(auditRec)
    } catch (errAudit) {
      console.log('[site_leads_publico] Erro ao auditar lead do site: ' + errAudit)
    }

    // 11. NOTIFICAÇÃO INTERNA PARA PERFIS ADMIN
    try {
      const notifCol = $app.findCollectionByNameOrId('notificacoes')
      const admins = $app.findRecordsByFilter('users', "role = 'admin'", '', 20, 0)

      const textoNotificacao = 'Novo pedido pelo site: ' + nome + ' — ' + servicosTexto

      for (let a = 0; a < admins.length; a++) {
        const uAdmin = admins[a]
        const notRec = new Record(notifCol)
        notRec.set('destinatario_tipo', 'interno')
        notRec.set('destinatario_usuario', uAdmin.id)
        notRec.set('destinatario_email', uAdmin.getString('email'))
        notRec.set('tipo', 'sistema')
        notRec.set('titulo', 'Novo Pedido de Orçamento pelo Site G+')
        notRec.set('mensagem', textoNotificacao)
        notRec.set('referencia_tipo', isPessoaFisica ? 'clientes_pf' : 'empresas')
        notRec.set('referencia_id', idEmpresaVinculada || idClientePfVinculado)
        notRec.set('lida', false)
        notRec.set('email_enviado', false)
        $app.save(notRec)
      }
    } catch (errNotif) {
      console.log('[site_leads_publico] Erro ao criar notificações para admins: ' + errNotif)
    }

    // 12. RESPOSTA RÁPIDA (< 2s)
    return e.json(200, {
      success: true,
      protocolo: protocoloCurto,
      mensagem:
        'Pedido de orçamento recebido com sucesso! Nossa equipe entrará em contato em breve.',
    })
  } catch (err) {
    // Falha interna -> registrar em erros_sistema e responder 500
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', '/backend/v1/publico/lead-site')
        errRec.set(
          'mensagem',
          ('Falha interna ao processar lead do site: ' + (err.message || String(err))).slice(
            0,
            1000,
          ),
        )
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', { erro: String(err), stack: err.stack ? String(err.stack) : '' })
        $app.save(errRec)
      }
    } catch (_) {}

    return e.json(500, {
      success: false,
      error:
        'Ocorreu um erro interno ao processar seu pedido. Por favor, tente novamente em instantes.',
    })
  }
})
