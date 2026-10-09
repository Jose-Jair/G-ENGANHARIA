// Hook de Recrutamento e Homologação de Executores Externos (G+ Engenharia)
// Endpoints dedicados:
// 1. POST /backend/v1/executores/convidar (Admin / Comercial)
// 2. GET  /backend/v1/executores/obter-por-token-cadastro/{token} (Público)
// 3. POST /backend/v1/executores/submeter-cadastro-token (Público)
// 4. POST /backend/v1/executores/{id}/homologar (Admin)

// =========================================================================
// 1. CONVIDAR EXECUTOR EXTERNO (Admin / Comercial)
// POST /backend/v1/executores/convidar
// Body: { nome: string, email: string }
// =========================================================================
routerAdd(
  'POST',
  '/backend/v1/executores/convidar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authRecord = reqInfo.auth
      if (!authRecord) {
        return e.json(401, { error: 'Autenticação obrigatória' })
      }

      const role = authRecord.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          error: 'Apenas Administradores e equipe Comercial podem convidar novos executores.',
        })
      }

      const body = reqInfo.body || {}
      const nome = (body.nome || '').trim()
      const email = (body.email || '').trim().toLowerCase()

      if (!nome) {
        return e.json(400, { error: 'Nome do executor é obrigatório' })
      }
      if (!email || !email.includes('@')) {
        return e.json(400, { error: 'E-mail válido é obrigatório' })
      }

      // Validar duplicidade de e-mail em executores
      try {
        const duplicados = $app.findRecordsByFilter(
          'executores',
          "email = '" + email.replace(/'/g, "\\'") + "'",
          '',
          1,
          0,
        )
        if (duplicados.length > 0) {
          const exExistente = duplicados[0]
          return e.json(400, {
            error:
              "Já existe um executor cadastrado com este e-mail ('" +
              email +
              "'), com status '" +
              exExistente.getString('status') +
              "'.",
          })
        }
      } catch (errDup) {
        console.log('Erro ao validar e-mail duplicado: ' + errDup)
      }

      // Gerar token de 32 bytes aleatório
      const token = $security.randomString(32)

      // Expiração em 7 dias
      const expiraData = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const executoresCol = $app.findCollectionByNameOrId('executores')
      const novoExecutor = new Record(executoresCol)

      novoExecutor.set('tipo', 'PF')
      novoExecutor.set('nome', nome)
      novoExecutor.set('email', email)
      novoExecutor.set('status', 'homologacao')
      novoExecutor.set('token_cadastro', token)
      novoExecutor.set('token_cadastro_expira', expiraData)
      novoExecutor.set('nota_geral', 0)
      novoExecutor.set('total_avaliacoes', 0)

      $app.save(novoExecutor)

      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'

      const linkCadastro = appUrl + '/cadastro-executor?token=' + token

      // Determinar IP da requisição
      const clientIp =
        (e.request &&
          typeof e.request.getHeader === 'function' &&
          (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria CONVITE_EXECUTOR_EXTERNO
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'CONVITE_EXECUTOR_EXTERNO')
        aRec.set('entidade', 'executores')
        aRec.set('registro_id', novoExecutor.id)
        aRec.set('user', authRecord.id)
        aRec.set('user_email', authRecord.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          origem: 'USUÁRIO',
          executor_id: novoExecutor.id,
          nome: nome,
          email: email,
          token_cadastro: token,
          expira_em: expiraData,
          link_cadastro: linkCadastro,
          convidado_por_id: authRecord.id,
          convidado_por_nome: authRecord.getString('name') || authRecord.getString('nome'),
          convidado_por_email: authRecord.getString('email'),
          convidado_por_role: role,
          mensagem:
            'Convite para cadastro de executor externo enviado para ' +
            nome +
            ' (' +
            email +
            ') por ' +
            (authRecord.getString('name') || authRecord.getString('nome')),
        })
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar convite de executor: ' + errAudit)
      }

      // Enviar e-mail de convite
      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

      try {
        const htmlEmail =
          '<!DOCTYPE html><html><body style="font-family: sans-serif; background: #f8fafc; padding: 20px; color: #1e293b;">' +
          '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">' +
          '<div style="background: #1E2A4A; padding: 20px; border-bottom: 3px solid #D95A2B; color: #fff;">' +
          '<span style="font-size: 18px; font-weight: bold;">G+ ENGENHARIA</span><br/>' +
          '<span style="font-size: 11px; color: #cbd5e1;">Credenciamento e Homologação de Executores</span>' +
          '</div>' +
          '<div style="padding: 24px; font-size: 14px; line-height: 1.6;">' +
          '<p>Prezado(a) <strong>' +
          nome +
          '</strong>,</p>' +
          '<p>Você foi convidado(a) pela equipe da G+ Engenharia a integrar nossa rede credenciada de executores técnicos parceiros.</p>' +
          '<p>Para concluir seu cadastro de homologação, clique no botão abaixo e preencha suas informações profissionais e bancárias:</p>' +
          '<div style="text-align: center; margin: 28px 0;">' +
          '<a href="' +
          linkCadastro +
          '" style="background: #D95A2B; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">Concluir Meu Cadastro de Executor</a>' +
          '</div>' +
          '<p style="font-size: 12px; color: #64748b;">Este link é pessoal, intransferível e expira em 7 dias.</p>' +
          '</div>' +
          '<div style="padding: 14px; background: #f1f5f9; font-size: 11px; text-align: center; color: #64748b;">' +
          'G+ Engenharia Consultiva • Gestão de Contratos e Parceiros' +
          '</div>' +
          '</div></body></html>'

        const msg = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: email, name: nome }],
          subject: 'Convite para Credenciamento de Executor — G+ Engenharia',
          html: htmlEmail,
        })
        $app.newMailClient().send(msg)
      } catch (errMail) {
        console.log('Aviso ao disparar e-mail de convite de executor: ' + errMail)
      }

      return e.json(200, {
        sucesso: true,
        executor_id: novoExecutor.id,
        nome: nome,
        email: email,
        token_cadastro: token,
        token_cadastro_expira: expiraData,
        link_cadastro: linkCadastro,
      })
    } catch (err) {
      console.log('Erro interno em convidar executor: ' + err)
      return e.json(500, { error: 'Erro interno ao convidar executor: ' + err })
    }
  },
  $apis.requireAuth(),
)

// =========================================================================
// 2. OBTER EXECUTOR POR TOKEN DE CADASTRO (Público)
// GET /backend/v1/executores/obter-por-token-cadastro/{token}
// =========================================================================
routerAdd('GET', '/backend/v1/executores/obter-por-token-cadastro/{token}', (e) => {
  try {
    const token = e.request.pathValue('token') || ''
    if (!token) {
      return e.json(400, { error: 'Token não fornecido' })
    }

    let executor = null
    try {
      const registros = $app.findRecordsByFilter(
        'executores',
        "token_cadastro = '" + token.replace(/'/g, "\\'") + "'",
        '',
        1,
        0,
      )
      if (registros.length > 0) {
        executor = registros[0]
      }
    } catch (_) {}

    if (!executor) {
      return e.json(404, {
        valido: false,
        error: 'Convite ou link de cadastro não encontrado.',
      })
    }

    // Validar expiração
    const expiraStr = executor.getString('token_cadastro_expira')
    if (expiraStr) {
      const expiraTime = new Date(expiraStr).getTime()
      if (Date.now() > expiraTime) {
        return e.json(410, {
          valido: false,
          expirado: true,
          error: 'Este link de cadastro expirou. Solicite um novo convite à G+ Engenharia.',
        })
      }
    }

    return e.json(200, {
      valido: true,
      executor: {
        id: executor.id,
        nome: executor.getString('nome'),
        email: executor.getString('email'),
        tipo: executor.getString('tipo') || 'PF',
        cpf_cnpj: executor.getString('cpf_cnpj') || '',
        telefone: executor.getString('telefone') || '',
        conselho: executor.getString('conselho') || '',
        conselho_classe: executor.getString('conselho_classe') || '',
        numero_registro: executor.getString('numero_registro') || '',
        numero_registro_conselho: executor.getString('numero_registro_conselho') || '',
        conselho_validade: executor.getString('conselho_validade') || '',
        validade_registro_conselho: executor.getString('validade_registro_conselho') || '',
        disciplinas: executor.getString('disciplinas') || '',
        regiao: executor.getString('regiao') || '',
        capacidade_simultanea: executor.getInt('capacidade_simultanea') || 1,
        dados_bancarios: executor.getString('dados_bancarios') || '',
        status: executor.getString('status'),
      },
    })
  } catch (err) {
    console.log('Erro ao obter executor por token de cadastro: ' + err)
    return e.json(500, { error: 'Erro interno ao consultar token: ' + err })
  }
})

// =========================================================================
// 3. SUBMETER CADASTRO POR TOKEN (Público)
// POST /backend/v1/executores/submeter-cadastro-token
// Body: { token, tipo, cpf_cnpj, telefone, conselho_classe, numero_registro,
//         validade_registro, disciplinas, regiao, capacidade_simultanea, dados_bancarios }
// =========================================================================
routerAdd('POST', '/backend/v1/executores/submeter-cadastro-token', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = (body.token || '').trim()

    if (!token) {
      return e.json(400, { error: 'Token de cadastro é obrigatório' })
    }

    let executor = null
    try {
      const registros = $app.findRecordsByFilter(
        'executores',
        "token_cadastro = '" + token.replace(/'/g, "\\'") + "'",
        '',
        1,
        0,
      )
      if (registros.length > 0) {
        executor = registros[0]
      }
    } catch (_) {}

    if (!executor) {
      return e.json(404, { error: 'Cadastro não localizado para o token fornecido.' })
    }

    // Validar expiração
    const expiraStr = executor.getString('token_cadastro_expira')
    if (expiraStr) {
      const expiraTime = new Date(expiraStr).getTime()
      if (Date.now() > expiraTime) {
        return e.json(410, {
          error: 'Este link de cadastro expirou. Solicite um novo convite à G+ Engenharia.',
        })
      }
    }

    // Validações básicas de campos
    const tipo = body.tipo === 'PJ' ? 'PJ' : 'PF'
    const cpfCnpj = (body.cpf_cnpj || '').trim()
    const telefone = (body.telefone || '').trim()
    const conselhoClasse = (body.conselho_classe || body.conselho || 'CREA').toUpperCase()
    const numeroRegistro = (body.numero_registro_conselho || body.numero_registro || '').trim()
    const validadeRegistro = (
      body.validade_registro_conselho ||
      body.conselho_validade ||
      ''
    ).trim()
    const disciplinas = (body.disciplinas || '').trim()
    const regiao = (body.regiao || '').trim()
    const capacidade = Math.max(1, parseInt(body.capacidade_simultanea, 10) || 1)

    let dadosBancariosStr = ''
    if (typeof body.dados_bancarios === 'object' && body.dados_bancarios !== null) {
      dadosBancariosStr = JSON.stringify(body.dados_bancarios)
    } else {
      dadosBancariosStr = (body.dados_bancarios || '').trim()
    }

    if (!cpfCnpj) {
      return e.json(400, { error: 'CPF/CNPJ é obrigatório para credenciamento.' })
    }
    if (!numeroRegistro) {
      return e.json(400, { error: 'Número de registro no conselho é obrigatório.' })
    }
    if (!disciplinas) {
      return e.json(400, { error: 'Informe ao menos uma especialidade/disciplina técnica.' })
    }

    // Atualizar SOMENTE o registro do executor do token
    executor.set('tipo', tipo)
    executor.set('cpf_cnpj', cpfCnpj)
    if (telefone) executor.set('telefone', telefone)
    if (body.nome && (body.nome || '').trim()) {
      executor.set('nome', body.nome.trim())
    }
    executor.set('conselho', conselhoClasse)
    executor.set('conselho_classe', conselhoClasse)
    executor.set('numero_registro', numeroRegistro)
    executor.set('numero_registro_conselho', numeroRegistro)
    if (validadeRegistro) {
      executor.set('conselho_validade', validadeRegistro)
      executor.set('validade_registro_conselho', validadeRegistro)
    }
    executor.set('disciplinas', disciplinas)
    if (regiao) executor.set('regiao', regiao)
    executor.set('capacidade_simultanea', capacidade)
    if (dadosBancariosStr) executor.set('dados_bancarios', dadosBancariosStr)

    // Manter status como 'homologacao' (pendente de aprovação do Admin)
    executor.set('status', 'homologacao')

    // Invalidar o token para evitar reenvio
    executor.set('token_cadastro', null)
    executor.set('token_cadastro_expira', null)

    $app.save(executor)

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    // Auditoria CADASTRO_EXECUTOR_CONCLUIDO
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'CADASTRO_EXECUTOR_CONCLUIDO')
      aRec.set('entidade', 'executores')
      aRec.set('registro_id', executor.id)
      aRec.set('user', null)
      aRec.set('user_email', executor.getString('email'))
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        origem: 'EXTERNO / PORTAL PÚBLICO',
        executor_id: executor.id,
        nome: executor.getString('nome'),
        email: executor.getString('email'),
        tipo: tipo,
        cpf_cnpj: cpfCnpj,
        conselho: conselhoClasse,
        numero_registro: numeroRegistro,
        disciplinas: disciplinas,
        status: 'homologacao',
        mensagem:
          'Cadastro do executor externo ' +
          executor.getString('nome') +
          ' preenchido e enviado para homologação do Administrador.',
      })
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar cadastro concluído: ' + errAudit)
    }

    return e.json(200, {
      sucesso: true,
      mensagem:
        'Cadastro enviado com sucesso! Seus dados estão em análise pela equipe da G+ Engenharia.',
      executor_id: executor.id,
      status: 'homologacao',
    })
  } catch (err) {
    console.log('Erro interno em submeter-cadastro-token: ' + err)
    return e.json(500, { error: 'Erro interno ao submeter cadastro: ' + err })
  }
})

// =========================================================================
// 4. HOMOLOGAR EXECUTOR (Admin)
// POST /backend/v1/executores/{id}/homologar
// =========================================================================
routerAdd(
  'POST',
  '/backend/v1/executores/{id}/homologar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authRecord = reqInfo.auth
      if (!authRecord) {
        return e.json(401, { error: 'Autenticação obrigatória' })
      }

      const role = authRecord.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          error: 'Apenas Administradores têm permissão para homologar executores na base.',
        })
      }

      const executorId = e.request.pathValue('id') || ''
      if (!executorId) {
        return e.json(400, { error: 'ID do executor não fornecido' })
      }

      let executor
      try {
        executor = $app.findRecordById('executores', executorId)
      } catch (_) {
        return e.json(404, { error: 'Executor não encontrado' })
      }

      const statusAnterior = executor.getString('status')
      executor.set('status', 'ativo')

      $app.save(executor)

      const clientIp =
        (e.request &&
          typeof e.request.getHeader === 'function' &&
          (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria HOMOLOGAR_EXECUTOR
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'HOMOLOGAR_EXECUTOR')
        aRec.set('entidade', 'executores')
        aRec.set('registro_id', executor.id)
        aRec.set('user', authRecord.id)
        aRec.set('user_email', authRecord.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          origem: 'USUÁRIO',
          executor_id: executor.id,
          nome: executor.getString('nome'),
          email: executor.getString('email'),
          status_anterior: statusAnterior,
          status_novo: 'ativo',
          homologado_por_id: authRecord.id,
          homologado_por_nome: authRecord.getString('name') || authRecord.getString('nome'),
          homologado_por_email: authRecord.getString('email'),
          mensagem:
            'Executor ' +
            executor.getString('nome') +
            ' homologado e ativado por ' +
            (authRecord.getString('name') || authRecord.getString('nome')),
        })
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar homologação de executor: ' + errAudit)
      }

      return e.json(200, {
        sucesso: true,
        executor_id: executor.id,
        nome: executor.getString('nome'),
        status: 'ativo',
        mensagem: 'Executor homologado e ativado com sucesso!',
      })
    } catch (err) {
      console.log('Erro interno em homologar executor: ' + err)
      return e.json(500, { error: 'Erro interno ao homologar executor: ' + err })
    }
  },
  $apis.requireAuth(),
)
