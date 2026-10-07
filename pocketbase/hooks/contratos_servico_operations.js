// Hook com rotas públicas para interações do cliente pelo link:
// 1. /backend/v1/propostas/solicitar-alteracoes (cliente solicita alterações -> volta para 'em_negociacao' + notificação)
// 2. /backend/v1/propostas/aceitar-digital (aceite eletrônico com declaração, IP, user-agent, hash)
// 3. /backend/v1/contratos-servico/assinar-cliente (assinatura eletrônica do cliente no contrato)
// 4. /backend/v1/contratos-servico/assinar-admin (assinatura eletrônica do administrador)

routerAdd('POST', '/backend/v1/propostas/solicitar-alteracoes', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_aceite
    const texto = (body.texto || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token de proposta não informado' })
    }
    if (!texto) {
      return e.json(400, {
        message: 'Por favor, descreva detalhadamente os ajustes ou dúvidas desejadas.',
      })
    }

    const records = $app.findRecordsByFilter(
      'propostas',
      "token_aceite = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Proposta não encontrada ou link inválido' })
    }

    const proposta = records[0]
    const statusAtual = proposta.getString('status')
    if (statusAtual === 'aceita') {
      return e.json(400, { message: 'Esta proposta já foi aceita e formalizada.' })
    }

    // Atualizar status para 'em_negociacao' e salvar solicitação do cliente
    const nowIso = new Date().toISOString()
    const versaoAtual = proposta.getString('revisao') || 'Rev.00'
    let historico = []
    try {
      const histRaw = proposta.get('historico_devolutivas')
      if (Array.isArray(histRaw)) {
        historico = histRaw
      } else if (typeof histRaw === 'string' && histRaw.trim()) {
        historico = JSON.parse(histRaw)
      }
    } catch (_) {
      historico = []
    }

    const novaDevolutiva = {
      data: nowIso,
      versao: versaoAtual,
      texto: texto,
      autor: 'Cliente',
    }
    const historicoAtualizado = historico.concat([novaDevolutiva])

    proposta.set('status', 'em_negociacao')
    proposta.set('solicitacao_alteracao_texto', texto)
    proposta.set('data_solicitacao_alteracao', nowIso)
    proposta.set('historico_devolutivas', historicoAtualizado)
    $app.save(proposta)

    // Registrar auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'SOLICITACAO_ALTERACAO_PROPOSTA')
      aRec.set('entidade', 'propostas')
      aRec.set('registro_id', proposta.id)
      aRec.set('detalhes', {
        mensagem:
          'Cliente solicitou alterações na proposta ' +
          proposta.getString('numero') +
          '. Retornada para "Em negociação".',
        proposta_numero: proposta.getString('numero'),
        texto_solicitacao: texto,
        ip: reqInfo.remoteIP || '',
        user_agent: (reqInfo.headers && reqInfo.headers['user-agent']) || '',
      })
      aRec.set('ip', reqInfo.remoteIP || '')
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar solicitação de alteração: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message: 'Solicitação de alterações enviada com sucesso! Nossa equipe entrará em contato.',
    })
  } catch (err) {
    console.log('Erro ao processar solicitação de alteração de proposta: ' + err)
    return e.json(500, { message: 'Erro ao registrar solicitação: ' + err })
  }
})

// Endpoint de Aceite Digital da Proposta com Validade Jurídica
routerAdd('POST', '/backend/v1/propostas/aceitar-digital', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_aceite
    const declaracao = body.declaracao === true
    const hashConteudo = body.hash_conteudo || ''

    if (!token) {
      return e.json(400, { message: 'Token de proposta não informado' })
    }

    if (!declaracao) {
      return e.json(400, {
        message:
          'A declaração de concordância integral com a proposta é obrigatória para o aceite.',
      })
    }

    const records = $app.findRecordsByFilter(
      'propostas',
      "token_aceite = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Proposta não encontrada' })
    }

    const proposta = records[0]
    const statusAtual = proposta.getString('status')
    if (statusAtual === 'aceita') {
      return e.json(200, {
        success: true,
        message: 'Esta proposta já se encontra aceita.',
        proposta_id: proposta.id,
      })
    }
    if (statusAtual === 'recusada' || statusAtual === 'expirada') {
      return e.json(400, {
        message: 'Esta proposta está marcada como ' + statusAtual + ' e não pode mais ser aceita.',
      })
    }

    const clientIp =
      reqInfo.remoteIP || (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '127.0.0.1'
    const clientUserAgent = (reqInfo.headers && reqInfo.headers['user-agent']) || 'Navegador Web'
    const nowIso = new Date().toISOString()

    // Hash de integridade (conteúdo da proposta + data + IP)
    let hashFinal = hashConteudo
    if (!hashFinal) {
      const payloadStr =
        proposta.getString('numero') +
        '|' +
        proposta.getFloat('preco') +
        '|' +
        proposta.getString('revisao') +
        '|' +
        clientIp +
        '|' +
        nowIso
      hashFinal = $security.sha256(payloadStr)
    }

    proposta.set('status', 'aceita')
    proposta.set('data_aceite', nowIso)
    proposta.set('aceite_ip', clientIp)
    proposta.set('aceite_user_agent', clientUserAgent)
    proposta.set('aceite_declaracao', true)
    proposta.set('aceite_hash', hashFinal)

    $app.save(proposta)

    // Auditoria detalhada do aceite
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'ACEITE_DIGITAL_PROPOSTA')
      aRec.set('entidade', 'propostas')
      aRec.set('registro_id', proposta.id)
      aRec.set('detalhes', {
        mensagem:
          'Aceite eletrônico formalizado pelo cliente com validade jurídica na proposta ' +
          proposta.getString('numero'),
        proposta_numero: proposta.getString('numero'),
        revisao: proposta.getString('revisao'),
        valor: proposta.getFloat('preco'),
        data_aceite: nowIso,
        ip: clientIp,
        user_agent: clientUserAgent,
        hash: hashFinal,
        declaracao_aceite: true,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar aceite digital: ' + errAudit)
    }

    // =========================================================================
    // CADEIA COMPLETA DE CRIAÇÃO DO CONTRATO E PROJETO NO ACEITE (DEFITO 1)
    // Regra: idempotência 1 proposta = 1 contrato = 1 projeto
    // =========================================================================
    const propostaId = proposta.id
    const propostaNumero = proposta.getString('numero')
    const empresaId = proposta.getString('empresa')
    const clientePfId = proposta.getString('cliente_pf')
    const preco = proposta.getFloat('preco') || 0
    const prazoDias = proposta.getInt('prazo_dias') || 30
    const notaPrazo =
      proposta.getString('nota_prazo') ||
      'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'
    const objeto =
      proposta.getString('objeto') ||
      proposta.getString('escopo') ||
      'Prestação de serviços técnicos especializados de engenharia'

    let contratoCriado = null
    let projetoCriado = null

    try {
      // (a) Checagem de idempotência do contrato
      const contratosExistentes = $app.findRecordsByFilter(
        'contratos_servico',
        "proposta = '" + propostaId + "'",
        '-created',
        1,
        0,
      )

      if (contratosExistentes.length > 0) {
        contratoCriado = contratosExistentes[0]
      } else {
        // (b) Gerar número CTR-AAAA-NNNN sequencial por ano
        const anoAtual = new Date().getFullYear()
        const prefixoCTR = 'CTR-' + anoAtual + '-'
        const contratosDoAno = $app.findRecordsByFilter(
          'contratos_servico',
          "numero ~ '" + prefixoCTR + "'",
          '-numero',
          1,
          0,
        )

        let proximoSeqCtr = 1
        if (contratosDoAno.length > 0) {
          const ultimoNumero = contratosDoAno[0].getString('numero')
          const partes = ultimoNumero.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeqCtr = ultimoSeq + 1
          }
        }
        const numeroCTR = prefixoCTR + ('0000' + proximoSeqCtr).slice(-4)

        // (c) Ler cláusulas do modelo em parametros
        let clausulasTexto = ''
        try {
          const paramClausulas = $app.findFirstRecordByData(
            'parametros',
            'chave',
            'contrato_servico_clausulas_padrao',
          )
          if (paramClausulas) {
            clausulasTexto = paramClausulas.getString('valor')
          }
        } catch (_) {}

        // Espelho das parcelas
        let parcelas = []
        try {
          const parcs = $app.findRecordsByFilter(
            'proposta_parcelas',
            "proposta = '" + propostaId + "'",
            'ordem',
            50,
            0,
          )
          parcelas = parcs.map((p) => ({
            ordem: p.getInt('ordem'),
            percentual: p.getFloat('percentual'),
            valor: p.getFloat('valor'),
            gatilho: p.getString('gatilho'),
            descricao: p.getString('descricao'),
          }))
        } catch (_) {}

        // (d) Criar contrato
        const contratosCol = $app.findCollectionByNameOrId('contratos_servico')
        const novoContrato = new Record(contratosCol)
        novoContrato.set('numero', numeroCTR)
        novoContrato.set('proposta', propostaId)
        if (empresaId) novoContrato.set('empresa', empresaId)
        if (clientePfId) novoContrato.set('cliente_pf', clientePfId)
        novoContrato.set('objeto', objeto)
        novoContrato.set('valor_total', preco)
        novoContrato.set('prazo_dias', prazoDias)
        novoContrato.set('nota_prazo', notaPrazo)
        novoContrato.set('clausulas_texto', clausulasTexto)
        novoContrato.set('parcelas_json', parcelas)
        novoContrato.set('status', 'aguardando_assinatura_admin')
        novoContrato.set('token_assinatura_cliente', $security.randomString(32))

        $app.save(novoContrato)
        contratoCriado = novoContrato

        // (f) Salvar proposta.contrato_servico = id do contrato
        try {
          proposta.set('contrato_servico', novoContrato.id)
          $app.save(proposta)
        } catch (errPropVinculo) {
          console.log('Erro ao atualizar vinculo contrato_servico na proposta: ' + errPropVinculo)
        }

        // (g) Auditar evento de geração do contrato no servidor
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'GERACAO_CONTRATO_SERVICO')
          aRec.set('entidade', 'contratos_servico')
          aRec.set('registro_id', novoContrato.id)
          aRec.set('detalhes', {
            mensagem:
              'Contrato de serviços gerado automaticamente pelo aceite digital da proposta ' +
              propostaNumero,
            contrato_numero: numeroCTR,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            valor: preco,
            ip: clientIp,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}
      }

      // (e) Criar projeto PRJ-AAAA-NNNN com status "Em Contratação", saúde verde,
      // vínculo com proposta e contrato, SEM etapas/entregáveis/contas
      const projetosExistentes = $app.findRecordsByFilter(
        'projetos',
        "proposta = '" + propostaId + "'",
        '-created',
        1,
        0,
      )

      if (projetosExistentes.length > 0) {
        projetoCriado = projetosExistentes[0]
        let prjModificado = false
        if (!projetoCriado.getString('contrato_servico') && contratoCriado) {
          projetoCriado.set('contrato_servico', contratoCriado.id)
          prjModificado = true
        }
        if (prjModificado) {
          $app.save(projetoCriado)
        }
        if (contratoCriado && !contratoCriado.getString('projeto')) {
          contratoCriado.set('projeto', projetoCriado.id)
          $app.save(contratoCriado)
        }
      } else {
        const anoAtual = new Date().getFullYear()
        const prefixoPRJ = 'PRJ-' + anoAtual + '-'
        const projetosDoAno = $app.findRecordsByFilter(
          'projetos',
          "codigo ~ '" + prefixoPRJ + "'",
          '-codigo',
          1,
          0,
        )

        let proximoSeqPrj = 1
        if (projetosDoAno.length > 0) {
          const ultimoCodigo = projetosDoAno[0].getString('codigo')
          const partes = ultimoCodigo.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeqPrj = ultimoSeq + 1
          }
        }
        const codigoPRJ = prefixoPRJ + ('0000' + proximoSeqPrj).slice(-4)

        let nomeCliente = 'Cliente'
        if (empresaId) {
          try {
            const emp = $app.findRecordById('empresas', empresaId)
            if (emp) nomeCliente = emp.getString('razao_social')
          } catch (_) {}
        } else if (clientePfId) {
          try {
            const pf = $app.findRecordById('clientes_pf', clientePfId)
            if (pf) nomeCliente = pf.getString('nome')
          } catch (_) {}
        }

        const contratoNumero = contratoCriado ? contratoCriado.getString('numero') : ''
        const projetosCol = $app.findCollectionByNameOrId('projetos')
        const novoProjeto = new Record(projetosCol)
        novoProjeto.set('codigo', codigoPRJ)
        novoProjeto.set(
          'nome',
          'Projeto: ' + (contratoNumero || propostaNumero) + ' — ' + nomeCliente,
        )
        novoProjeto.set('descricao', objeto)
        novoProjeto.set('proposta', propostaId)
        if (contratoCriado) {
          novoProjeto.set('contrato_servico', contratoCriado.id)
        }
        if (empresaId) novoProjeto.set('empresa', empresaId)
        if (clientePfId) novoProjeto.set('cliente_pf', clientePfId)
        novoProjeto.set('valor_total', preco)
        novoProjeto.set('subcontratacao_autorizada', true)
        novoProjeto.set('saude', 'verde')
        novoProjeto.set('status', 'Em Contratação')

        $app.save(novoProjeto)
        projetoCriado = novoProjeto

        // Atualizar contrato com o id do projeto criado
        if (contratoCriado) {
          try {
            contratoCriado.set('projeto', novoProjeto.id)
            $app.save(contratoCriado)
          } catch (_) {}
        }

        // (g) Auditar evento de criação do projeto no servidor
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'CRIACAO_PROJETO_CONTRATACAO')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoProjeto.id)
          aRec.set('detalhes', {
            mensagem:
              'Projeto criado em status "Em Contratação" pelo aceite digital da Proposta ' +
              propostaNumero,
            codigo: codigoPRJ,
            status: 'Em Contratação',
            contrato_id: contratoCriado ? contratoCriado.id : null,
            contrato_numero: contratoNumero,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            valor: preco,
            ip: clientIp,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}
      }
    } catch (errCadeia) {
      console.log('Erro na cadeia de criação contrato/projeto no aceite digital: ' + errCadeia)
    }

    return e.json(200, {
      success: true,
      message: 'Aceite registrado com pleno sucesso e validade jurídica!',
      proposta_id: proposta.id,
      proposta_numero: proposta.getString('numero'),
      contrato_id: contratoCriado ? contratoCriado.id : null,
      contrato_numero: contratoCriado ? contratoCriado.getString('numero') : null,
      projeto_id: projetoCriado ? projetoCriado.id : null,
      projeto_codigo: projetoCriado ? projetoCriado.getString('codigo') : null,
      hash: hashFinal,
      data_aceite: nowIso,
    })
  } catch (err) {
    console.log('Erro ao registrar aceite digital de proposta: ' + err)
    return e.json(500, { message: 'Erro interno ao processar aceite: ' + err })
  }
})

// Endpoint para Assinatura do Cliente no Contrato de Serviço
routerAdd('POST', '/backend/v1/contratos-servico/assinar-cliente', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_assinatura_cliente
    const declaracao = body.declaracao === true
    const nomeAssinante = (body.nome_assinante || '').trim()
    const documentoAssinante = (body.documento_assinante || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token de assinatura não informado' })
    }
    if (!declaracao) {
      return e.json(400, { message: 'A declaração de concordância com o contrato é obrigatória.' })
    }
    if (!nomeAssinante || !documentoAssinante) {
      return e.json(400, { message: 'Nome e CPF do signatário são obrigatórios.' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_assinatura_cliente = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link inválido' })
    }

    const contrato = records[0]
    if (contrato.getString('data_assinatura_cliente')) {
      return e.json(200, {
        success: true,
        message: 'Este contrato já foi assinado pelo cliente.',
        contrato_id: contrato.id,
      })
    }

    const clientIp =
      reqInfo.remoteIP || (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '127.0.0.1'
    const clientUserAgent = (reqInfo.headers && reqInfo.headers['user-agent']) || 'Navegador Web'
    const nowIso = new Date().toISOString()

    const hashPayload =
      contrato.getString('numero') +
      '|' +
      nomeAssinante +
      '|' +
      documentoAssinante +
      '|' +
      clientIp +
      '|' +
      nowIso
    const clientHash = $security.sha256(hashPayload)

    contrato.set('cliente_nome_assinante', nomeAssinante)
    contrato.set('cliente_documento_assinante', documentoAssinante)
    contrato.set('data_assinatura_cliente', nowIso)
    contrato.set('cliente_ip', clientIp)
    contrato.set('cliente_user_agent', clientUserAgent)
    contrato.set('cliente_declaracao', true)
    contrato.set('cliente_hash', clientHash)

    // Se Admin já assinou -> status vira 'assinado'
    // Se Admin ainda não assinou -> status vai para 'aguardando_assinatura_admin'
    if (contrato.getString('data_assinatura_admin')) {
      contrato.set('status', 'assinado')
    } else {
      contrato.set('status', 'aguardando_assinatura_admin')
    }

    $app.save(contrato)

    // Auditoria da assinatura do cliente
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'ASSINATURA_CLIENTE_CONTRATO')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contrato.id)
      aRec.set('detalhes', {
        mensagem:
          'Contrato ' +
          contrato.getString('numero') +
          ' assinado digitalmente pelo cliente ' +
          nomeAssinante,
        contrato_numero: contrato.getString('numero'),
        signatario_nome: nomeAssinante,
        signatario_doc: documentoAssinante,
        data_assinatura: nowIso,
        ip: clientIp,
        hash: clientHash,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar assinatura cliente contrato: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message: 'Contrato assinado com sucesso! O projeto de engenharia foi iniciado.',
      contrato_id: contrato.id,
      contrato_numero: contrato.getString('numero'),
      hash: clientHash,
    })
  } catch (err) {
    console.log('Erro ao assinar contrato de serviço (cliente): ' + err)
    return e.json(500, { message: 'Erro interno ao assinar contrato: ' + err })
  }
})

// Endpoint para Assinatura do Admin no Contrato de Serviço
routerAdd(
  'POST',
  '/backend/v1/contratos-servico/assinar-admin',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          message:
            'Apenas Administradores podem assinar o Contrato de Serviços pela G+ Engenharia.',
        })
      }

      const body = reqInfo.body || {}
      const contratoId = body.contrato_id
      const declaracao = body.declaracao === true

      if (!contratoId) {
        return e.json(400, { message: 'ID do contrato não informado' })
      }

      if (!declaracao) {
        return e.json(400, { message: 'Declaração obrigatória para formalização da assinatura.' })
      }

      const contrato = $app.findRecordById('contratos_servico', contratoId)
      if (!contrato) {
        return e.json(404, { message: 'Contrato não encontrado' })
      }

      const clientIp = reqInfo.remoteIP || '127.0.0.1'
      const clientUserAgent = (reqInfo.headers && reqInfo.headers['user-agent']) || 'Navegador Web'
      const nowIso = new Date().toISOString()

      const hashPayload =
        contrato.getString('numero') + '|' + reqInfo.auth.id + '|ADMIN|' + clientIp + '|' + nowIso
      const adminHash = $security.sha256(hashPayload)

      contrato.set('assinante_admin', reqInfo.auth.id)
      contrato.set('data_assinatura_admin', nowIso)
      contrato.set('admin_ip', clientIp)
      contrato.set('admin_user_agent', clientUserAgent)
      contrato.set('admin_declaracao', true)
      contrato.set('admin_hash', adminHash)

      if (contrato.getString('data_assinatura_cliente')) {
        contrato.set('status', 'assinado')
      } else {
        contrato.set('status', 'aguardando_assinatura_cliente')
      }

      $app.save(contrato)

      // Auditoria da assinatura do admin
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'ASSINATURA_ADMIN_CONTRATO')
        aRec.set('entidade', 'contratos_servico')
        aRec.set('registro_id', contratoId)
        aRec.set('detalhes', {
          mensagem:
            'Contrato ' +
            contrato.getString('numero') +
            ' assinado digitalmente pelo Administrador ' +
            reqInfo.auth.getString('name'),
          contrato_numero: contrato.getString('numero'),
          admin_id: reqInfo.auth.id,
          admin_nome: reqInfo.auth.getString('name'),
          data_assinatura: nowIso,
          ip: clientIp,
          hash: adminHash,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar assinatura admin contrato: ' + errAudit)
      }

      return e.json(200, {
        success: true,
        message: 'Contrato assinado pelo Administrador com sucesso!',
        contrato_id: contrato.id,
        contrato_numero: contrato.getString('numero'),
        status: contrato.getString('status'),
        token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
      })
    } catch (err) {
      console.log('Erro ao assinar contrato como admin: ' + err)
      return e.json(500, { message: 'Erro interno ao assinar contrato: ' + err })
    }
  },
  $apis.requireAuth(),
)
