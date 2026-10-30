// =============================================================================
// GESTÃO G+ — RECRUTAMENTO PÚBLICO E TRIAGEM DE PRESTADORES (RODADA 12)
// Endpoints dedicados (todas as funções e variáveis declaradas INLINE nos callbacks):
// 1. POST /backend/v1/recrutamento/{slug} — Rota pública de pré-cadastro (sem login)
// 2. POST /backend/v1/prestadores/{id}/triagem/aprovar — Admin/Gestor
// 3. POST /backend/v1/prestadores/{id}/triagem/recusar — Admin/Gestor
// 4. POST /backend/v1/prestadores/{id}/triagem/pedir-complemento — Admin/Gestor
// 5. GET  /backend/v1/prestadores/obter-por-token-complemento/{token} — Público
// 6. POST /backend/v1/prestadores/submeter-complemento-token — Público
// 7. POST /backend/v1/portal-prestador/meu-perfil — Prestador autenticado
// =============================================================================

// -----------------------------------------------------------------------------
// 1. ROTA PÚBLICA DE PRÉ-CADASTRO: POST /backend/v1/recrutamento/{slug}
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/recrutamento/{slug}', (e) => {
  try {
    const slug = (e.request.pathValue('slug') || '').trim()
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}

    // Obter IP do cliente inline
    let clientIp = '127.0.0.1'
    try {
      if (e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        if (xff) clientIp = xff.split(',')[0].trim()
        else {
          const xReal = e.request.getHeader('x-real-ip')
          if (xReal) clientIp = xReal.trim()
        }
      }
    } catch (_) {}
    if (clientIp === '127.0.0.1' && reqInfo && reqInfo.headers) {
      const xff = reqInfo.headers['x-forwarded-for']
      if (xff) clientIp = String(xff).split(',')[0].trim()
      else if (reqInfo.headers['x-real-ip']) {
        clientIp = String(reqInfo.headers['x-real-ip']).trim()
      }
    }

    // A. HONEYPOT: se preenchido (ex: campo oculto website ou honeypot), recusa silenciosa
    const honeypotVal = (body.website || body.honeypot || body.hp_campo || '').trim()
    if (honeypotVal) {
      return e.json(200, {
        sucesso: true,
        mensagem: 'Pré-cadastro recebido com sucesso!',
      })
    }

    // B. VALIDAÇÃO DO SLUG: ativo e não expirado
    let linkRec = null
    try {
      const links = $app.findRecordsByFilter(
        'links_recrutamento',
        "slug = '" + slug.replace(/'/g, "\\'") + "'",
        '',
        1,
        0,
      )
      if (links.length > 0) {
        linkRec = links[0]
      }
    } catch (_) {}

    if (!linkRec) {
      return e.json(404, { error: 'Link de recrutamento não encontrado ou inexistente.' })
    }

    if (!linkRec.getBool('ativo')) {
      return e.json(410, { error: 'Este link de recrutamento foi desativado pela G+ Engenharia.' })
    }

    const expiraStr = linkRec.getString('expira_em')
    if (expiraStr) {
      const expTime = new Date(expiraStr).getTime()
      if (Date.now() > expTime) {
        return e.json(410, {
          error: 'Este link de recrutamento expirou. Solicite um novo link à G+ Engenharia.',
        })
      }
    }

    // C. RATE LIMIT POR IP (parâmetro na Administração)
    let limitHora = 5
    try {
      const pLimit = $app.findFirstRecordByData(
        'parametros',
        'chave',
        'recrutamento_rate_limit_ip_hora',
      )
      if (pLimit) {
        limitHora = parseInt(pLimit.getString('valor'), 10) || 5
      }
    } catch (_) {}

    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    let countEnvios = 0
    try {
      const auditLogsIp = $app.findRecordsByFilter(
        'audit_logs',
        "acao = 'PRE_CADASTRO_PUBLICO_SUBMETIDO' && ip = '" +
          clientIp.replace(/'/g, "\\'") +
          "' && created >= '" +
          umaHoraAtras +
          "'",
        '',
        100,
        0,
      )
      countEnvios = auditLogsIp.length
    } catch (_) {}

    if (countEnvios >= limitHora) {
      return e.json(429, {
        error:
          'Limite de tentativas excedido para o seu endereço IP (' +
          limitHora +
          ' por hora). Tente novamente mais tarde.',
      })
    }

    // D. VALIDAÇÃO DE CAMPOS E UNICIDADE DE CPF/CNPJ E E-MAIL
    const nome = (body.nome || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const cpfCnpjRaw = (body.cpf_cnpj || '').replace(/\D/g, '')
    const tipo = body.tipo === 'pj_externo' ? 'pj_externo' : 'pf_externo'
    const telefone = (body.telefone || '').trim()
    const conselho = (body.conselho || body.conselho_classe || '').trim()
    const numeroRegistro = (body.numero_registro_conselho || body.numero_registro || '').trim()
    const validadeRegistro = (body.validade_registro_conselho || '').trim()
    const disciplinas = (body.disciplinas || linkRec.getString('disciplina_alvo') || '').trim()
    const regiao = (body.regiao || '').trim()
    const softwares = (body.softwares || '').trim()
    const aceiteTermos = Boolean(body.aceite_termos)

    if (!nome) {
      return e.json(400, { error: 'O nome completo ou razão social é obrigatório.' })
    }
    if (!email || !email.includes('@')) {
      return e.json(400, { error: 'E-mail válido é obrigatório.' })
    }
    if (!cpfCnpjRaw) {
      return e.json(400, { error: 'CPF ou CNPJ é obrigatório.' })
    }
    if (tipo === 'pf_externo' && cpfCnpjRaw.length !== 11) {
      return e.json(400, { error: 'CPF deve conter exatamente 11 dígitos numéricos.' })
    }
    if (tipo === 'pj_externo' && cpfCnpjRaw.length !== 14) {
      return e.json(400, { error: 'CNPJ deve conter exatamente 14 dígitos numéricos.' })
    }
    if (!aceiteTermos) {
      return e.json(400, {
        error:
          'É obrigatório aceitar os termos de uso e política de privacidade para submeter o pré-cadastro.',
      })
    }

    // Formatação amigável do documento
    let cpfCnpjFormatado = cpfCnpjRaw
    if (cpfCnpjRaw.length === 11) {
      cpfCnpjFormatado = cpfCnpjRaw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else if (cpfCnpjRaw.length === 14) {
      cpfCnpjFormatado = cpfCnpjRaw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }

    // Verificar duplicidade de CPF/CNPJ em prestadores
    const docExistente = $app.findRecordsByFilter(
      'prestadores',
      "cpf_cnpj = '" + cpfCnpjFormatado + "' || cpf_cnpj = '" + cpfCnpjRaw + "'",
      '',
      1,
      0,
    )
    if (docExistente.length > 0) {
      return e.json(409, {
        error: 'Já existe um prestador cadastrado com este CPF/CNPJ na base da G+ Engenharia.',
      })
    }

    // Verificar duplicidade de E-mail em prestadores
    const emailExistente = $app.findRecordsByFilter(
      'prestadores',
      "email = '" + email.replace(/'/g, "\\'") + "'",
      '',
      1,
      0,
    )
    if (emailExistente.length > 0) {
      return e.json(409, {
        error: 'Já existe um prestador cadastrado com este e-mail na base da G+ Engenharia.',
      })
    }

    // E. HASH DO ACEITE E TIMESTAMP
    const agoraIso = new Date().toISOString()
    const payloadHashTermos =
      'ACEITE_TERMOS|' + cpfCnpjRaw + '|' + email + '|' + clientIp + '|' + agoraIso + '|' + slug
    const aceiteHash = $security.sha256(payloadHashTermos)

    // Processar campos JSON opcionais
    let portfolioJson = body.portfolio_json || null
    let precoRefJson = body.preco_referencia_json || null
    let disponibilidadeJson = body.disponibilidade_json || null

    if (typeof portfolioJson === 'string') {
      try {
        portfolioJson = JSON.parse(portfolioJson)
      } catch (_) {}
    }
    if (typeof precoRefJson === 'string') {
      try {
        precoRefJson = JSON.parse(precoRefJson)
      } catch (_) {}
    }
    if (typeof disponibilidadeJson === 'string') {
      try {
        disponibilidadeJson = JSON.parse(disponibilidadeJson)
      } catch (_) {}
    }

    // F. GRAVAR PRESTADOR: status='triagem', origem_cadastro='publico'
    const prestadoresCol = $app.findCollectionByNameOrId('prestadores')
    const novoPrestador = new Record(prestadoresCol)

    novoPrestador.set('tipo', tipo)
    novoPrestador.set('nome', nome)
    novoPrestador.set('cpf_cnpj', cpfCnpjFormatado)
    novoPrestador.set('email', email)
    if (telefone) novoPrestador.set('telefone', telefone)
    if (conselho) {
      novoPrestador.set('conselho', conselho)
      novoPrestador.set('conselho_classe', conselho)
    }
    if (numeroRegistro) novoPrestador.set('numero_registro_conselho', numeroRegistro)
    if (validadeRegistro) novoPrestador.set('validade_registro_conselho', validadeRegistro)
    if (disciplinas) novoPrestador.set('disciplinas', disciplinas)
    if (regiao) novoPrestador.set('regiao', regiao)
    if (softwares) novoPrestador.set('softwares', softwares)
    if (portfolioJson) novoPrestador.set('portfolio_json', portfolioJson)
    if (precoRefJson) novoPrestador.set('preco_referencia_json', precoRefJson)
    if (disponibilidadeJson) novoPrestador.set('disponibilidade_json', disponibilidadeJson)

    // Ciclo de vida: nasce "triagem"
    novoPrestador.set('status', 'triagem')
    novoPrestador.set('origem_cadastro', 'publico')

    // Evidências de aceite jurídico
    novoPrestador.set('aceite_termos_em', agoraIso)
    novoPrestador.set('aceite_ip', clientIp)
    novoPrestador.set('aceite_hash', aceiteHash)

    novoPrestador.set('nota_geral', 0)
    novoPrestador.set('total_avaliacoes', 0)
    novoPrestador.set('capacidade_simultanea', 1)

    $app.save(novoPrestador)

    // Incrementar contador de acessos do link de recrutamento
    try {
      const acessosAtuais = linkRec.getInt('contador_acessos') || 0
      linkRec.set('contador_acessos', acessosAtuais + 1)
      $app.save(linkRec)
    } catch (_) {}

    // G. AUDITORIA: PRE_CADASTRO_PUBLICO_SUBMETIDO (sem dados sensíveis)
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'PRE_CADASTRO_PUBLICO_SUBMETIDO')
      aRec.set('entidade', 'prestadores')
      aRec.set('registro_id', novoPrestador.id)
      aRec.set('user', null)
      aRec.set('user_email', email)
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        origem: 'PUBLICO_SLUG',
        slug: slug,
        prestador_id: novoPrestador.id,
        nome: nome,
        tipo: tipo,
        disciplinas: disciplinas,
        status: 'triagem',
        aceite_timestamp: agoraIso,
        aceite_hash: aceiteHash,
      })
      $app.save(aRec)
    } catch (eAud) {
      console.log('Aviso ao auditar pré-cadastro público: ' + eAud)
    }

    // H. NOTIFICAÇÃO ADMIN/GESTOR (Central de Notificações + e-mail se SMTP configurado)
    try {
      const notCol = $app.findCollectionByNameOrId('notificacoes')
      const gestores = $app.findRecordsByFilter(
        'users',
        "role = 'admin' || role = 'gestor'",
        '',
        20,
        0,
      )

      for (let g = 0; g < gestores.length; g++) {
        const uGestor = gestores[g]
        const nRec = new Record(notCol)
        nRec.set('destinatario_tipo', 'interno')
        nRec.set('destinatario_usuario', uGestor.id)
        nRec.set('destinatario_email', uGestor.getString('email'))
        nRec.set('tipo', 'sistema')
        nRec.set('titulo', 'Novo Pré-Cadastro de Prestador em Triagem')
        nRec.set(
          'mensagem',
          'O prestador "' +
            nome +
            '" (' +
            tipo +
            ', ' +
            disciplinas +
            ') realizou o pré-cadastro pelo link "' +
            slug +
            '" e aguarda triagem da equipe.',
        )
        nRec.set('referencia_tipo', 'prestadores')
        nRec.set('referencia_id', novoPrestador.id)
        nRec.set('lida', false)
        nRec.set('email_enviado', false)
        $app.save(nRec)
      }

      // E-mail se SMTP estiver configurado no servidor
      try {
        const settings = $app.settings()
        const smtp = settings.smtp || {}
        const meta = settings.meta || {}
        if (smtp.enabled && smtp.host && meta.senderAddress) {
          const senderAddress = meta.senderAddress
          const senderName = meta.senderName || 'G+ Engenharia'
          const destinatarios = gestores.map((u) => ({
            address: u.getString('email'),
            name: u.getString('name') || 'Gestão G+',
          }))

          if (destinatarios.length > 0) {
            const htmlEmail =
              '<!DOCTYPE html><html><body style="font-family: sans-serif; background: #f8fafc; padding: 20px; color: #1e293b;">' +
              '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">' +
              '<div style="background: #1E2A4A; padding: 20px; border-bottom: 3px solid #D95A2B; color: #fff;">' +
              '<span style="font-size: 18px; font-weight: bold;">G+ ENGENHARIA</span><br/>' +
              '<span style="font-size: 11px; color: #cbd5e1;">Triagem de Prestadores e Parceiros</span>' +
              '</div>' +
              '<div style="padding: 24px; font-size: 14px; line-height: 1.6;">' +
              '<p>Olá,</p>' +
              '<p>Um novo prestador concluiu o formulário de pré-cadastro público e entrou em status de <strong>Triagem</strong>:</p>' +
              '<ul>' +
              '<li><strong>Nome:</strong> ' +
              nome +
              '</li>' +
              '<li><strong>Tipo:</strong> ' +
              tipo +
              '</li>' +
              '<li><strong>E-mail:</strong> ' +
              email +
              '</li>' +
              '<li><strong>Disciplina(s):</strong> ' +
              disciplinas +
              '</li>' +
              '<li><strong>Canal/Slug:</strong> ' +
              slug +
              '</li>' +
              '</ul>' +
              '<p>Acesse o painel administrativo da G+ Engenharia para avaliar, pedir complemento ou aprovar a minuta do contrato-mestre.</p>' +
              '</div></div></body></html>'

            const msg = new MailerMessage({
              from: { address: senderAddress, name: senderName },
              to: destinatarios,
              subject: 'Novo Pré-Cadastro de Prestador (' + nome + ') — Triagem G+',
              html: htmlEmail,
            })
            $app.newMailClient().send(msg)
          }
        }
      } catch (eMail) {
        console.log('Aviso ao enviar e-mail de notificação de triagem: ' + eMail)
      }
    } catch (eNotif) {
      console.log('Aviso ao registrar notificações de triagem: ' + eNotif)
    }

    return e.json(201, {
      sucesso: true,
      mensagem:
        'Pré-cadastro submetido com sucesso! Seus dados foram encaminhados para a equipe de triagem da G+ Engenharia.',
      prestador_id: novoPrestador.id,
      status: 'triagem',
    })
  } catch (err) {
    console.log('Erro ao processar recrutamento público: ' + err)
    return e.json(500, {
      error: 'Erro interno ao processar cadastro: ' + (err.message || String(err)),
    })
  }
})

// -----------------------------------------------------------------------------
// 2. ENDPOINTS DE TRIAGEM (Restritos a Admin / Gestor)
// -----------------------------------------------------------------------------

// 2.1 APROVAR TRIAGEM: prestador vai para "pendente", gera minuta do contrato-mestre e notifica pedido de documentos
routerAdd(
  'POST',
  '/backend/v1/prestadores/{id}/triagem/aprovar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const auth = reqInfo.auth
      if (!auth) {
        return e.json(401, { error: 'Autenticação obrigatória.' })
      }
      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: apenas Administradores e Gestores de Projetos podem realizar a triagem de prestadores.',
        })
      }

      const prestadorId = (e.request.pathValue('id') || '').trim()
      const body = reqInfo.body || {}

      let clientIp = '127.0.0.1'
      try {
        if (e.request && typeof e.request.getHeader === 'function') {
          const xff = e.request.getHeader('x-forwarded-for')
          if (xff) clientIp = xff.split(',')[0].trim()
        }
      } catch (_) {}

      const prestador = $app.findRecordById('prestadores', prestadorId)
      const statusAtual = prestador.getString('status')
      if (statusAtual !== 'triagem') {
        return e.json(400, {
          error:
            'Apenas prestadores em status "triagem" podem ser aprovados nesta etapa (status atual: "' +
            statusAtual +
            '").',
        })
      }

      // 1. Atualizar prestador: status='pendente', parecer_triagem, triado_por
      const parecer = (
        body.parecer ||
        'Aprovado na triagem inicial. Encaminhada solicitação de documentos e minuta de contrato-mestre.'
      ).trim()
      const nota = body.nota !== undefined ? parseFloat(body.nota) : 5.0

      prestador.set('status', 'pendente')
      prestador.set('nota_triagem', nota)
      prestador.set('parecer_triagem', parecer)
      prestador.set('triado_por', auth.id)
      $app.save(prestador)

      // 2. Gerar minuta do contrato-mestre se ainda não existir
      let contratoMestre = null
      try {
        const cmExistentes = $app.findRecordsByFilter(
          'contratos_mestre',
          "prestador = '" + prestador.id + "'",
          '-created',
          1,
          0,
        )
        if (cmExistentes.length > 0) {
          contratoMestre = cmExistentes[0]
        } else {
          const cmCol = $app.findCollectionByNameOrId('contratos_mestre')
          contratoMestre = new Record(cmCol)
          contratoMestre.set('prestador', prestador.id)
          contratoMestre.set('status', 'minuta')
          contratoMestre.set(
            'minuta_texto',
            'CONTRATO-MESTRE DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA E TERMO DE CONFIDENCIALIDADE (NDA)\n\n' +
              'Contratante: G+ ENGENHARIA CONSULTIVA LTDA\n' +
              'Contratado: ' +
              prestador.getString('nome') +
              ' (CPF/CNPJ: ' +
              (prestador.getString('cpf_cnpj') || 'Pendente') +
              ')\n\n' +
              'Objeto: Estabelece as regras gerais, padrões de qualidade técnica e sigilo aplicáveis a todas as Ordens de Serviço futuras.',
          )
          contratoMestre.set(
            'clausulas_nda',
            'As partes comprometem-se ao sigilo absoluto das informações técnicas, comerciais e de projetos.',
          )
          $app.save(contratoMestre)
        }
      } catch (eCm) {
        console.log('Aviso ao gerar contrato-mestre na aprovação da triagem: ' + eCm)
      }

      // 3. Disparar notificação ao prestador pedindo envio de documentos
      try {
        const notCol = $app.findCollectionByNameOrId('notificacoes')
        const nRec = new Record(notCol)
        nRec.set('destinatario_tipo', 'prestador')
        nRec.set('destinatario_email', prestador.getString('email'))
        nRec.set('tipo', 'sistema')
        nRec.set('titulo', 'Triagem Aprovada — Envio de Documentos e Minuta de Contrato')
        nRec.set(
          'mensagem',
          'Parabéns, seu cadastro foi pré-aprovado pela G+ Engenharia! Por favor, acesse o Portal do Prestador para enviar os documentos comprobatórios e revisar a minuta do Contrato-Mestre.',
        )
        nRec.set('referencia_tipo', 'prestadores')
        nRec.set('referencia_id', prestador.id)
        nRec.set('lida', false)
        nRec.set('email_enviado', false)
        $app.save(nRec)
      } catch (_) {}

      // 4. Auditoria da aprovação
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'TRIAGEM_PRESTADOR_APROVADA')
        aRec.set('entidade', 'prestadores')
        aRec.set('registro_id', prestador.id)
        aRec.set('user', auth.id)
        aRec.set('user_email', auth.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          prestador_id: prestador.id,
          nome: prestador.getString('nome'),
          status_anterior: 'triagem',
          status_novo: 'pendente',
          nota_triagem: nota,
          parecer: parecer,
          contrato_mestre_id: contratoMestre ? contratoMestre.id : null,
          triado_por: auth.getString('email'),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        prestador_id: prestador.id,
        status: 'pendente',
        contrato_mestre_id: contratoMestre ? contratoMestre.id : null,
        mensagem: 'Triagem aprovada com sucesso. Prestador movido para pendente e minuta gerada.',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao aprovar triagem: ' + (err.message || String(err)) })
    }
  },
  $apis.requireAuth(),
)

// 2.2 RECUSAR TRIAGEM: motivo obrigatório, grava parecer_triagem, nota_triagem e triado_por
routerAdd(
  'POST',
  '/backend/v1/prestadores/{id}/triagem/recusar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const auth = reqInfo.auth
      if (!auth) {
        return e.json(401, { error: 'Autenticação obrigatória.' })
      }
      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: apenas Administradores e Gestores de Projetos podem realizar a triagem de prestadores.',
        })
      }

      const prestadorId = (e.request.pathValue('id') || '').trim()
      const body = reqInfo.body || {}

      let clientIp = '127.0.0.1'
      try {
        if (e.request && typeof e.request.getHeader === 'function') {
          const xff = e.request.getHeader('x-forwarded-for')
          if (xff) clientIp = xff.split(',')[0].trim()
        }
      } catch (_) {}

      const motivo = (body.motivo || body.parecer || '').trim()
      if (!motivo) {
        return e.json(400, { error: 'O motivo da recusa é estritamente obrigatório.' })
      }

      const prestador = $app.findRecordById('prestadores', prestadorId)
      const statusAtual = prestador.getString('status')
      if (statusAtual !== 'triagem') {
        return e.json(400, {
          error:
            'Apenas prestadores em status "triagem" podem ser recusados nesta etapa (status atual: "' +
            statusAtual +
            '").',
        })
      }

      const nota = body.nota !== undefined ? parseFloat(body.nota) : 0

      prestador.set('status', 'inativo')
      prestador.set('motivo_suspensao', 'Recusado na triagem: ' + motivo)
      prestador.set('parecer_triagem', motivo)
      prestador.set('nota_triagem', nota)
      prestador.set('triado_por', auth.id)
      $app.save(prestador)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'TRIAGEM_PRESTADOR_RECUSADA')
        aRec.set('entidade', 'prestadores')
        aRec.set('registro_id', prestador.id)
        aRec.set('user', auth.id)
        aRec.set('user_email', auth.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          prestador_id: prestador.id,
          nome: prestador.getString('nome'),
          status_anterior: 'triagem',
          status_novo: 'inativo',
          motivo: motivo,
          nota_triagem: nota,
          triado_por: auth.getString('email'),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        prestador_id: prestador.id,
        status: 'inativo',
        mensagem: 'Triagem recusada com sucesso. Parecer e motivo registrados.',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao recusar triagem: ' + (err.message || String(err)) })
    }
  },
  $apis.requireAuth(),
)

// 2.3 PEDIR COMPLEMENTO: gera link de retorno (token) para o prestador completar o cadastro
routerAdd(
  'POST',
  '/backend/v1/prestadores/{id}/triagem/pedir-complemento',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const auth = reqInfo.auth
      if (!auth) {
        return e.json(401, { error: 'Autenticação obrigatória.' })
      }
      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: apenas Administradores e Gestores de Projetos podem realizar a triagem de prestadores.',
        })
      }

      const prestadorId = (e.request.pathValue('id') || '').trim()
      const body = reqInfo.body || {}

      let clientIp = '127.0.0.1'
      try {
        if (e.request && typeof e.request.getHeader === 'function') {
          const xff = e.request.getHeader('x-forwarded-for')
          if (xff) clientIp = xff.split(',')[0].trim()
        }
      } catch (_) {}

      const observacoes = (
        body.observacoes ||
        body.motivo ||
        'Favor complementar seus dados cadastrais, referências ou documentos.'
      ).trim()

      const prestador = $app.findRecordById('prestadores', prestadorId)

      // Buscar prazo de expiração do link de complemento na Administração
      let diasExpiracao = 7
      try {
        const pDias = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'dias_expiracao_link_complemento_prestador',
        )
        if (pDias) diasExpiracao = parseInt(pDias.getString('valor'), 10) || 7
      } catch (_) {}

      const token = $security.randomString(32)
      const expiraData = new Date(Date.now() + diasExpiracao * 24 * 60 * 60 * 1000).toISOString()

      prestador.set('token_cadastro', token)
      prestador.set('token_cadastro_expira', expiraData)
      prestador.set('parecer_triagem', 'Complemento solicitado: ' + observacoes)
      prestador.set('triado_por', auth.id)
      $app.save(prestador)

      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'

      const linkRetorno = appUrl + '/cadastro-executor?token=' + token

      // Notificação
      try {
        const notCol = $app.findCollectionByNameOrId('notificacoes')
        const nRec = new Record(notCol)
        nRec.set('destinatario_tipo', 'prestador')
        nRec.set('destinatario_email', prestador.getString('email'))
        nRec.set('tipo', 'sistema')
        nRec.set('titulo', 'Solicitação de Complemento de Cadastro — G+ Engenharia')
        nRec.set(
          'mensagem',
          'A equipe da G+ Engenharia solicitou complementos no seu pré-cadastro: ' +
            observacoes +
            '. Acesse o link para atualizar suas informações.',
        )
        nRec.set('referencia_tipo', 'prestadores')
        nRec.set('referencia_id', prestador.id)
        nRec.set('lida', false)
        nRec.set('email_enviado', false)
        $app.save(nRec)
      } catch (_) {}

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'TRIAGEM_COMPLEMENTO_SOLICITADO')
        aRec.set('entidade', 'prestadores')
        aRec.set('registro_id', prestador.id)
        aRec.set('user', auth.id)
        aRec.set('user_email', auth.getString('email'))
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          prestador_id: prestador.id,
          nome: prestador.getString('nome'),
          email: prestador.getString('email'),
          observacoes: observacoes,
          token: token,
          expira_em: expiraData,
          dias_expiracao: diasExpiracao,
          link_retorno: linkRetorno,
          solicitado_por: auth.getString('email'),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        prestador_id: prestador.id,
        token: token,
        token_expira: expiraData,
        link_retorno: linkRetorno,
        mensagem: 'Solicitação de complemento registrada e link gerado com sucesso.',
      })
    } catch (err) {
      return e.json(500, {
        error: 'Erro ao solicitar complemento de triagem: ' + (err.message || String(err)),
      })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 3. CONSULTA E SUBMISSÃO POR TOKEN DE COMPLEMENTO EM PRESTADORES (Público)
// -----------------------------------------------------------------------------

routerAdd('GET', '/backend/v1/prestadores/obter-por-token-complemento/{token}', (e) => {
  try {
    const token = (e.request.pathValue('token') || '').trim()
    if (!token) return e.json(400, { error: 'Token não fornecido' })

    const prestadores = $app.findRecordsByFilter(
      'prestadores',
      "token_cadastro = '" + token.replace(/'/g, "\\'") + "'",
      '',
      1,
      0,
    )

    if (prestadores.length === 0) {
      return e.json(404, { valido: false, error: 'Link ou token de complemento não encontrado.' })
    }

    const p = prestadores[0]
    const expiraStr = p.getString('token_cadastro_expira')
    if (expiraStr) {
      const expTime = new Date(expiraStr).getTime()
      if (Date.now() > expTime) {
        return e.json(410, {
          valido: false,
          expirado: true,
          error: 'Este link de complemento expirou. Solicite um novo link à G+ Engenharia.',
        })
      }
    }

    return e.json(200, {
      valido: true,
      prestador: {
        id: p.id,
        nome: p.getString('nome'),
        email: p.getString('email'),
        tipo: p.getString('tipo'),
        cpf_cnpj: p.getString('cpf_cnpj') || '',
        telefone: p.getString('telefone') || '',
        conselho: p.getString('conselho') || '',
        numero_registro_conselho: p.getString('numero_registro_conselho') || '',
        validade_registro_conselho: p.getString('validade_registro_conselho') || '',
        disciplinas: p.getString('disciplinas') || '',
        regiao: p.getString('regiao') || '',
        softwares: p.getString('softwares') || '',
        portfolio_json: p.get('portfolio_json') || null,
        preco_referencia_json: p.get('preco_referencia_json') || null,
        disponibilidade_json: p.get('disponibilidade_json') || null,
        status: p.getString('status'),
        parecer_triagem: p.getString('parecer_triagem') || '',
      },
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao validar token de complemento: ' + err })
  }
})

routerAdd('POST', '/backend/v1/prestadores/submeter-complemento-token', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = (body.token || '').trim()

    let clientIp = '127.0.0.1'
    try {
      if (e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        if (xff) clientIp = xff.split(',')[0].trim()
      }
    } catch (_) {}

    if (!token) return e.json(400, { error: 'Token é obrigatório.' })

    const prestadores = $app.findRecordsByFilter(
      'prestadores',
      "token_cadastro = '" + token.replace(/'/g, "\\'") + "'",
      '',
      1,
      0,
    )

    if (prestadores.length === 0) {
      return e.json(404, { error: 'Cadastro não localizado para o token fornecido.' })
    }

    const p = prestadores[0]
    const expiraStr = p.getString('token_cadastro_expira')
    if (expiraStr) {
      const expTime = new Date(expiraStr).getTime()
      if (Date.now() > expTime) {
        return e.json(410, { error: 'Este link de complemento expirou.' })
      }
    }

    if (body.nome) p.set('nome', String(body.nome).trim())
    if (body.telefone) p.set('telefone', String(body.telefone).trim())
    if (body.conselho) p.set('conselho', String(body.conselho).trim())
    if (body.numero_registro_conselho)
      p.set('numero_registro_conselho', String(body.numero_registro_conselho).trim())
    if (body.validade_registro_conselho)
      p.set('validade_registro_conselho', String(body.validade_registro_conselho).trim())
    if (body.disciplinas) p.set('disciplinas', String(body.disciplinas).trim())
    if (body.regiao) p.set('regiao', String(body.regiao).trim())
    if (body.softwares) p.set('softwares', String(body.softwares).trim())

    if (body.portfolio_json) p.set('portfolio_json', body.portfolio_json)
    if (body.preco_referencia_json) p.set('preco_referencia_json', body.preco_referencia_json)
    if (body.disponibilidade_json) p.set('disponibilidade_json', body.disponibilidade_json)
    if (body.dados_bancarios) p.set('dados_bancarios', String(body.dados_bancarios).trim())

    // Invalidar token de retorno
    p.set('token_cadastro', null)
    p.set('token_cadastro_expira', null)
    $app.save(p)

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'COMPLEMENTO_PRESTADOR_ENVIADO')
      aRec.set('entidade', 'prestadores')
      aRec.set('registro_id', p.id)
      aRec.set('user', null)
      aRec.set('user_email', p.getString('email'))
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        prestador_id: p.id,
        nome: p.getString('nome'),
        email: p.getString('email'),
        status: p.getString('status'),
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Dados complementares atualizados com sucesso.',
      prestador_id: p.id,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao salvar complemento: ' + err })
  }
})

// -----------------------------------------------------------------------------
// 4. EDIÇÃO PELO PRÓPRIO PRESTADOR AUTENTICADO NO PORTAL (AUDITADA)
// Permite atualizar: portfólio, preços de referência, disponibilidade e documentos
// NUNCA expõe: cliente, obra, proposta, valor de contrato, BDI ou outros prestadores
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/portal-prestador/meu-perfil',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const auth = reqInfo.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const email = auth.getString('email')
      const prestadores = $app.findRecordsByFilter(
        'prestadores',
        "email = '" + email.replace(/'/g, "\\'") + "'",
        '',
        1,
        0,
      )

      if (prestadores.length === 0) {
        return e.json(404, { error: 'Perfil de prestador não localizado para este usuário.' })
      }

      const p = prestadores[0]
      const body = reqInfo.body || {}

      let clientIp = '127.0.0.1'
      try {
        if (e.request && typeof e.request.getHeader === 'function') {
          const xff = e.request.getHeader('x-forwarded-for')
          if (xff) clientIp = xff.split(',')[0].trim()
        }
      } catch (_) {}

      const alteracoes = {}

      if (body.portfolio_json !== undefined) {
        p.set('portfolio_json', body.portfolio_json)
        alteracoes.portfolio_json = true
      }
      if (body.preco_referencia_json !== undefined) {
        p.set('preco_referencia_json', body.preco_referencia_json)
        alteracoes.preco_referencia_json = true
      }
      if (body.disponibilidade_json !== undefined) {
        p.set('disponibilidade_json', body.disponibilidade_json)
        alteracoes.disponibilidade_json = true
      }
      if (body.softwares !== undefined) {
        p.set('softwares', String(body.softwares).trim())
        alteracoes.softwares = true
      }
      if (body.telefone !== undefined) {
        p.set('telefone', String(body.telefone).trim())
        alteracoes.telefone = true
      }
      if (body.dados_bancarios !== undefined) {
        p.set('dados_bancarios', String(body.dados_bancarios).trim())
        alteracoes.dados_bancarios = true
      }

      $app.save(p)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'PERFIL_PORTAL_PRESTADOR_ATUALIZADO')
        aRec.set('entidade', 'prestadores')
        aRec.set('registro_id', p.id)
        aRec.set('user', auth.id)
        aRec.set('user_email', email)
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          prestador_id: p.id,
          nome: p.getString('nome'),
          campos_alterados: Object.keys(alteracoes),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        mensagem: 'Perfil técnico atualizado com sucesso no Portal do Prestador.',
        prestador: {
          id: p.id,
          nome: p.getString('nome'),
          email: p.getString('email'),
          portfolio_json: p.get('portfolio_json'),
          preco_referencia_json: p.get('preco_referencia_json'),
          disponibilidade_json: p.get('disponibilidade_json'),
          softwares: p.getString('softwares'),
        },
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao atualizar perfil do prestador: ' + err })
    }
  },
  $apis.requireAuth(),
)
