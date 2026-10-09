// Hook com rotas para interações do contrato e proposta:
// 1. /backend/v1/propostas/solicitar-alteracoes
// 2. /backend/v1/propostas/aceitar-digital (validação do cadastro do cliente: se incompleto -> status 'aguardando_dados_cliente')
// 3. /backend/v1/contratos-servico/assinar-cliente (bloqueio se status for 'aguardando_dados_cliente')
// 4. /backend/v1/contratos-servico/assinar-admin
// 5. /backend/v1/contratos-servico/obter-por-token-complemento (dados para o formulário de complemento)
// 6. /backend/v1/contratos-servico/complementar-dados (gravação dos dados faltantes pelo cliente, atualização cadastral e liberação do contrato)

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

// Endpoint de Aceite Digital da Proposta com Validação Cadastral Server-Side (Bloco 3)
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
      // Idempotência: se já aceita, retornar dados do contrato/projeto existentes
      const contrsExistentes = $app.findRecordsByFilter(
        'contratos_servico',
        "proposta = '" + proposta.id + "'",
        '-created',
        1,
        0,
      )
      const c = contrsExistentes.length > 0 ? contrsExistentes[0] : null
      return e.json(200, {
        success: true,
        message: 'Esta proposta já se encontra aceita.',
        proposta_id: proposta.id,
        contrato_id: c ? c.id : null,
        contrato_numero: c ? c.getString('numero') : null,
        status_contrato: c ? c.getString('status') : null,
        token_complemento_dados: c ? c.getString('token_complemento_dados') : null,
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
    // BLOCO 3: VERIFICAÇÃO RIGOROSA DO CADASTRO DO CLIENTE (PF OU PJ)
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

    // Helpers de validação inline (goja VM self-contained)
    const fnCleanDigits = (val) => (val || '').toString().replace(/\D/g, '')

    const fnIsValidCpf = (cpfStr) => {
      const clean = fnCleanDigits(cpfStr)
      if (!clean || clean.length !== 11) return false
      if (/^(\d)\1{10}$/.test(clean)) return false
      let soma = 0
      for (let i = 0; i < 9; i++) {
        soma += parseInt(clean.charAt(i), 10) * (10 - i)
      }
      let resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      if (resto !== parseInt(clean.charAt(9), 10)) return false
      soma = 0
      for (let i = 0; i < 10; i++) {
        soma += parseInt(clean.charAt(i), 10) * (11 - i)
      }
      resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      if (resto !== parseInt(clean.charAt(10), 10)) return false
      return true
    }

    const fnIsValidCnpj = (cnpjStr) => {
      const clean = fnCleanDigits(cnpjStr)
      if (!clean || clean.length !== 14) return false
      if (/^(\d)\1{13}$/.test(clean)) return false
      let soma = 0
      let peso = 5
      for (let i = 0; i < 12; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      let resto = soma % 11
      const dv1 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(12), 10) !== dv1) return false
      soma = 0
      peso = 6
      for (let i = 0; i < 13; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      resto = soma % 11
      const dv2 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(13), 10) !== dv2) return false
      return true
    }

    const camposFaltantes = []
    let tipoCliente = 'pj'
    let clienteRecord = null
    let emailDestinatario = ''
    let nomeClienteDestinatario = ''

    if (empresaId) {
      tipoCliente = 'pj'
      try {
        clienteRecord = $app.findRecordById('empresas', empresaId)
      } catch (_) {}

      if (!clienteRecord) {
        camposFaltantes.push('empresa_nao_encontrada')
      } else {
        const razao = (clienteRecord.getString('razao_social') || '').trim()
        const cnpjClean = fnCleanDigits(clienteRecord.getString('cnpj'))
        const cepClean = fnCleanDigits(clienteRecord.getString('cep'))
        const logradouro = (clienteRecord.getString('logradouro') || '').trim()
        const numero = (clienteRecord.getString('numero') || '').trim()
        const bairro = (clienteRecord.getString('bairro') || '').trim()
        const municipio = (clienteRecord.getString('municipio') || '').trim()
        const uf = (clienteRecord.getString('uf') || '').trim()
        const email = (clienteRecord.getString('email') || '').trim()
        const telefone = (clienteRecord.getString('telefone') || '').trim()

        emailDestinatario = email
        nomeClienteDestinatario = razao

        // Checagem de telefone em array de telefones ou campo único
        let temTelefone = Boolean(telefone)
        try {
          const tels = clienteRecord.get('telefones')
          if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) {
            temTelefone = true
          }
        } catch (_) {}

        if (!razao) camposFaltantes.push('razao_social')
        if (!cnpjClean || !fnIsValidCnpj(cnpjClean)) camposFaltantes.push('cnpj')
        if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
        if (!temTelefone) camposFaltantes.push('telefone')
        if (!cepClean || cepClean.length < 8) camposFaltantes.push('cep')
        if (!logradouro) camposFaltantes.push('logradouro')
        if (!numero) camposFaltantes.push('numero')
        if (!bairro) camposFaltantes.push('bairro')
        if (!municipio) camposFaltantes.push('municipio')
        if (!uf) camposFaltantes.push('uf')

        // Representante legal para PJ: busca em contatos decisores ou contatos da empresa
        let repNome = ''
        let repCpfClean = ''
        try {
          const contatosEmpresa = $app.findRecordsByFilter(
            'contatos',
            "empresa = '" + empresaId + "'",
            '-decisor,-created',
            5,
            0,
          )
          for (let ci = 0; ci < contatosEmpresa.length; ci++) {
            const cNome = (contatosEmpresa[ci].getString('nome') || '').trim()
            if (cNome) {
              repNome = cNome
              break
            }
          }
        } catch (_) {}

        if (!repNome) {
          camposFaltantes.push('representante_nome')
        }
        // CPF do representante legal
        if (!repCpfClean || !fnIsValidCpf(repCpfClean)) {
          camposFaltantes.push('representante_documento')
        }
      }
    } else if (clientePfId) {
      tipoCliente = 'pf'
      try {
        clienteRecord = $app.findRecordById('clientes_pf', clientePfId)
      } catch (_) {}

      if (!clienteRecord) {
        camposFaltantes.push('cliente_pf_nao_encontrado')
      } else {
        const nome = (clienteRecord.getString('nome') || '').trim()
        const cpfClean = fnCleanDigits(clienteRecord.getString('cpf'))
        const email = (clienteRecord.getString('email') || '').trim()
        const telefone = (clienteRecord.getString('telefone') || '').trim()
        const cepClean = fnCleanDigits(clienteRecord.getString('cep'))
        const logradouro = (clienteRecord.getString('logradouro') || '').trim()
        const numero = (clienteRecord.getString('numero') || '').trim()
        const bairro = (clienteRecord.getString('bairro') || '').trim()
        const municipio = (clienteRecord.getString('municipio') || '').trim()
        const uf = (clienteRecord.getString('uf') || '').trim()

        emailDestinatario = email
        nomeClienteDestinatario = nome

        let temTelefone = Boolean(telefone)
        try {
          const tels = clienteRecord.get('telefones')
          if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) {
            temTelefone = true
          }
        } catch (_) {}

        if (!nome) camposFaltantes.push('nome')
        if (!cpfClean || !fnIsValidCpf(cpfClean)) camposFaltantes.push('cpf')
        if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
        if (!temTelefone) camposFaltantes.push('telefone')
        if (!cepClean || cepClean.length < 8) camposFaltantes.push('cep')
        if (!logradouro) camposFaltantes.push('logradouro')
        if (!numero) camposFaltantes.push('numero')
        if (!bairro) camposFaltantes.push('bairro')
        if (!municipio) camposFaltantes.push('municipio')
        if (!uf) camposFaltantes.push('uf')
      }
    } else {
      camposFaltantes.push('cliente_indefinido')
    }

    const cadastroCompleto = camposFaltantes.length === 0
    const statusInicialContrato = cadastroCompleto
      ? 'aguardando_assinatura_admin'
      : 'aguardando_dados_cliente'

    // =========================================================================
    // CRIAÇÃO OU RECUPERAÇÃO DO CONTRATO E PROJETO (Idempotência 1:1)
    // =========================================================================
    let contratoCriado = null
    let projetoCriado = null

    try {
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

        const tokenAssinaturaCliente = $security.randomString(32)
        const tokenComplementoDados = cadastroCompleto ? '' : $security.randomString(32)

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
        novoContrato.set('status', statusInicialContrato)
        novoContrato.set('token_assinatura_cliente', tokenAssinaturaCliente)
        novoContrato.set('token_complemento_dados', tokenComplementoDados)
        novoContrato.set('campos_faltantes_json', camposFaltantes)

        $app.save(novoContrato)
        contratoCriado = novoContrato

        try {
          proposta.set('contrato_servico', novoContrato.id)
          $app.save(proposta)
        } catch (_) {}

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'GERACAO_CONTRATO_SERVICO')
          aRec.set('entidade', 'contratos_servico')
          aRec.set('registro_id', novoContrato.id)
          aRec.set('detalhes', {
            mensagem:
              'Contrato de serviços gerado pelo aceite digital da proposta ' +
              propostaNumero +
              (cadastroCompleto
                ? ' (Cadastro completo -> Aguardando assinatura Admin)'
                : ' (Cadastro incompleto -> Aguardando dados do cliente)'),
            contrato_numero: numeroCTR,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            status: statusInicialContrato,
            campos_faltantes: camposFaltantes,
            valor: preco,
            ip: clientIp,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}
      }

      // O aceite digital da proposta cria SOMENTE o Contrato de Serviços (Grupo B/D).
      // A geração de Grupo GPR e Projetos PRJ ocorre exclusivamente na ASSINATURA BILATERAL do contrato.
    } catch (errCadeia) {
      console.log('Erro na cadeia de criação de contrato de serviço no aceite: ' + errCadeia)
    }

    // =========================================================================
    // DISPARO DE E-MAIL TRANSACIONAL AO CLIENTE CASO O CADASTRO ESTEJA INCOMPLETO
    // =========================================================================
    let linkComplemento = ''
    if (
      !cadastroCompleto &&
      contratoCriado &&
      contratoCriado.getString('token_complemento_dados')
    ) {
      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'
      const tokenComp = contratoCriado.getString('token_complemento_dados')
      linkComplemento = appUrl + '/completar-cadastro/' + tokenComp

      if (emailDestinatario && emailDestinatario.indexOf('@') !== -1) {
        try {
          const senderAddress =
            ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
          const senderName =
            ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

          const linkDescadastro =
            appUrl +
            '/descadastro?origem=fluxo_contratual&email=' +
            encodeURIComponent(emailDestinatario)

          const htmlEmail =
            '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
            '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
            '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
            '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
            '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Complementação de Dados para Emissão do Contrato</p>' +
            '</td></tr>' +
            '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
            '<p>Olá, <strong>' +
            (nomeClienteDestinatario || 'Cliente') +
            '</strong>!</p>' +
            '<p>Confirmamos o aceite na Proposta Comercial <strong>' +
            propostaNumero +
            '</strong>. Para que o seu Contrato de Prestação de Serviços Técnicos seja gerado com total conformidade jurídica e siga para a etapa de assinaturas digitais, precisamos que você complete alguns dados cadastrais obrigatórios.</p>' +
            '<div style="margin:28px 0;text-align:center;">' +
            '<a href="' +
            linkComplemento +
            '" target="_blank" style="background-color:#D95A2B;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;font-size:14px;">Completar Meus Dados Cadastrais</a>' +
            '</div>' +
            '<p style="font-size:12px;color:#64748b;">Se o botão não funcionar, copie e cole este link em seu navegador:<br /><span style="font-family:monospace;word-break:break-all;">' +
            linkComplemento +
            '</span></p>' +
            '</td></tr>' +
            '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
            'Mensagem transacional do fluxo de contratação G+ Engenharia • ' +
            contratoCriado.getString('numero') +
            '<br />Caso não queira receber nossas comunicações, <a href="' +
            linkDescadastro +
            '" style="color:#64748b;">descadastre seu e-mail</a>.' +
            '</td></tr>' +
            '</table></body></html>'

          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: emailDestinatario, name: nomeClienteDestinatario }],
            subject:
              'Ação necessária: Complete seu cadastro para geração do contrato ' +
              contratoCriado.getString('numero'),
            html: htmlEmail,
          })

          $app.newMailClient().send(msg)

          // Auditar envio de e-mail de complemento
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'ENVIO_EMAIL_COMPLEMENTO_DADOS')
            aRec.set('entidade', 'contratos_servico')
            aRec.set('registro_id', contratoCriado.id)
            aRec.set('detalhes', {
              mensagem:
                'E-mail transacional de complemento de dados enviado com link exclusivo para ' +
                emailDestinatario,
              contrato_numero: contratoCriado.getString('numero'),
              destinatario: emailDestinatario,
              link: linkComplemento,
            })
            aRec.set('ip', clientIp)
            $app.save(aRec)
          } catch (_) {}
        } catch (mailErr) {
          console.log('Aviso/Erro ao disparar e-mail de complemento: ' + mailErr)
        }
      }
    }

    return e.json(200, {
      success: true,
      message: cadastroCompleto
        ? 'Aceite formalizado com sucesso! Contrato gerado e encaminhado para assinatura do Administrador.'
        : 'Aceite registrado! Alguns dados cadastrais estão pendentes para geração completa do contrato.',
      cadastro_completo: cadastroCompleto,
      campos_faltantes: camposFaltantes,
      proposta_id: proposta.id,
      proposta_numero: propostaNumero,
      contrato_id: contratoCriado ? contratoCriado.id : null,
      contrato_numero: contratoCriado ? contratoCriado.getString('numero') : null,
      status_contrato: contratoCriado ? contratoCriado.getString('status') : statusInicialContrato,
      token_complemento_dados:
        contratoCriado && !cadastroCompleto
          ? contratoCriado.getString('token_complemento_dados')
          : null,
      link_complemento: linkComplemento || null,
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

// Endpoint Público: Obter Contrato de Serviço por Token de Assinatura (ou Complemento) em QUALQUER status (sem login)
routerAdd('GET', '/backend/v1/contratos-servico/obter-por-token/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { message: 'Token não informado' })
    }

    // ALTERAÇÃO 2: Aceitar o contrato em QUALQUER status (aguardando_dados_cliente, aguardando_assinatura_admin,
    // aguardando_assinatura_cliente, assinado) desde que o token da URL corresponda exatamente
    // ao campo token_assinatura_cliente (ou token_complemento_dados) do registro.
    // Retornar a minuta completa expandida (contratante PJ/PF, proposta, cláusulas) sem exigir sessão.
    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_assinatura_cliente = '" + token + "' || token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link expirado' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    const propostaId = contrato.getString('proposta')
    const assinanteAdminId = contrato.getString('assinante_admin')
    const projetoId = contrato.getString('projeto')

    let empresaExpand = null
    let clientePfExpand = null
    let propostaExpand = null
    let assinanteAdminExpand = null

    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) {
          empresaExpand = {
            id: emp.id,
            razao_social: emp.getString('razao_social'),
            nome_fantasia: emp.getString('nome_fantasia'),
            cnpj: emp.getString('cnpj'),
            email: emp.getString('email'),
            telefone: emp.getString('telefone'),
            telefones: emp.get('telefones') || [],
            cep: emp.getString('cep'),
            logradouro: emp.getString('logradouro'),
            numero: emp.getString('numero'),
            complemento: emp.getString('complemento'),
            bairro: emp.getString('bairro'),
            municipio: emp.getString('municipio'),
            uf: emp.getString('uf'),
          }
        }
      } catch (_) {}
    }

    if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        if (pf) {
          clientePfExpand = {
            id: pf.id,
            nome: pf.getString('nome'),
            cpf: pf.getString('cpf'),
            email: pf.getString('email'),
            telefone: pf.getString('telefone'),
            telefones: pf.get('telefones') || [],
            cep: pf.getString('cep'),
            logradouro: pf.getString('logradouro'),
            numero: pf.getString('numero'),
            complemento: pf.getString('complemento'),
            bairro: pf.getString('bairro'),
            municipio: pf.getString('municipio'),
            uf: pf.getString('uf'),
            endereco: pf.getString('endereco'),
          }
        }
      } catch (_) {}
    }

    if (propostaId) {
      try {
        const prop = $app.findRecordById('propostas', propostaId)
        if (prop) {
          propostaExpand = {
            id: prop.id,
            numero: prop.getString('numero'),
            objeto: prop.getString('objeto'),
            preco: prop.getFloat('preco'),
          }
        }
      } catch (_) {}
    }

    if (assinanteAdminId) {
      try {
        const adm = $app.findRecordById('users', assinanteAdminId)
        if (adm) {
          assinanteAdminExpand = {
            id: adm.id,
            name: adm.getString('name'),
            email: adm.getString('email'),
          }
        }
      } catch (_) {}
    }

    let camposFaltantes = []
    try {
      const cf = contrato.get('campos_faltantes_json')
      if (Array.isArray(cf)) camposFaltantes = cf
    } catch (_) {}

    return e.json(200, {
      id: contrato.id,
      numero: contrato.getString('numero'),
      proposta: propostaId,
      empresa: empresaId || undefined,
      cliente_pf: clientePfId || undefined,
      projeto: projetoId || undefined,
      objeto: contrato.getString('objeto'),
      valor_total: contrato.getFloat('valor_total'),
      prazo_dias: contrato.getInt('prazo_dias'),
      nota_prazo: contrato.getString('nota_prazo'),
      clausulas_texto: contrato.getString('clausulas_texto'),
      parcelas_json: contrato.get('parcelas_json'),
      status: contrato.getString('status'),
      token_complemento_dados: contrato.getString('token_complemento_dados'),
      campos_faltantes_json: camposFaltantes,
      dados_completados_em: contrato.getString('dados_completados_em'),
      assinante_admin: assinanteAdminId || undefined,
      data_assinatura_admin: contrato.getString('data_assinatura_admin'),
      admin_ip: contrato.getString('admin_ip'),
      admin_user_agent: contrato.getString('admin_user_agent'),
      admin_declaracao: contrato.getBool('admin_declaracao'),
      admin_hash: contrato.getString('admin_hash'),
      token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
      cliente_nome_assinante: contrato.getString('cliente_nome_assinante'),
      cliente_documento_assinante: contrato.getString('cliente_documento_assinante'),
      data_assinatura_cliente: contrato.getString('data_assinatura_cliente'),
      cliente_ip: contrato.getString('cliente_ip'),
      cliente_user_agent: contrato.getString('cliente_user_agent'),
      cliente_declaracao: contrato.getBool('cliente_declaracao'),
      cliente_hash: contrato.getString('cliente_hash'),
      arquivo_pdf_assinado: contrato.getString('arquivo_pdf_assinado'),
      created: contrato.getString('created'),
      updated: contrato.getString('updated'),
      expand: {
        proposta: propostaExpand,
        empresa: empresaExpand,
        cliente_pf: clientePfExpand,
        assinante_admin: assinanteAdminExpand,
      },
    })
  } catch (err) {
    console.log('Erro ao obter contrato por token de assinatura: ' + err)
    return e.json(500, { message: 'Erro interno: ' + err })
  }
})

// Endpoint para Obter Dados do Contrato e Cliente via Token de Complemento (Público, sem login)
routerAdd('GET', '/backend/v1/contratos-servico/obter-por-token-complemento', (e) => {
  try {
    const token = e.request.url.query().get('token')
    if (!token) {
      return e.json(400, { message: 'Token de complemento não informado' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link expirado' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    let tipoCliente = empresaId ? 'pj' : 'pf'

    let dadosCliente = {}
    let representante = { nome: '', documento: '' }

    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        dadosCliente = {
          razao_social: emp.getString('razao_social'),
          nome_fantasia: emp.getString('nome_fantasia'),
          cnpj: emp.getString('cnpj'),
          email: emp.getString('email'),
          telefone: emp.getString('telefone'),
          telefones: emp.get('telefones') || [],
          cep: emp.getString('cep'),
          logradouro: emp.getString('logradouro'),
          numero: emp.getString('numero'),
          complemento: emp.getString('complemento'),
          bairro: emp.getString('bairro'),
          municipio: emp.getString('municipio'),
          uf: emp.getString('uf'),
          porte: emp.getString('porte'),
        }

        const contatos = $app.findRecordsByFilter(
          'contatos',
          "empresa = '" + empresaId + "'",
          '-decisor,-created',
          1,
          0,
        )
        if (contatos.length > 0) {
          representante.nome = contatos[0].getString('nome') || ''
        }
      } catch (_) {}
    } else if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        dadosCliente = {
          nome: pf.getString('nome'),
          cpf: pf.getString('cpf'),
          email: pf.getString('email'),
          telefone: pf.getString('telefone'),
          telefones: pf.get('telefones') || [],
          cep: pf.getString('cep'),
          logradouro: pf.getString('logradouro'),
          numero: pf.getString('numero'),
          complemento: pf.getString('complemento'),
          bairro: pf.getString('bairro'),
          municipio: pf.getString('municipio'),
          uf: pf.getString('uf'),
        }
      } catch (_) {}
    }

    let camposFaltantes = []
    try {
      const cf = contrato.get('campos_faltantes_json')
      if (Array.isArray(cf)) camposFaltantes = cf
    } catch (_) {}

    return e.json(200, {
      success: true,
      contrato: {
        id: contrato.id,
        numero: contrato.getString('numero'),
        objeto: contrato.getString('objeto'),
        valor_total: contrato.getFloat('valor_total'),
        prazo_dias: contrato.getInt('prazo_dias'),
        status: contrato.getString('status'),
        token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
        campos_faltantes: camposFaltantes,
        dados_completados_em: contrato.getString('dados_completados_em'),
      },
      tipo_cliente: tipoCliente,
      dados_cliente: dadosCliente,
      representante: representante,
    })
  } catch (err) {
    console.log('Erro ao obter contrato por token de complemento: ' + err)
    return e.json(500, { message: 'Erro interno: ' + err })
  }
})

// Endpoint para Gravar Complemento de Dados do Cliente (Público, sem login)
routerAdd('POST', '/backend/v1/contratos-servico/complementar-dados', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_complemento_dados

    if (!token) {
      return e.json(400, { message: 'Token de complemento não informado' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou token inválido' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    const isPj = Boolean(empresaId)

    const clientIp =
      reqInfo.remoteIP || (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '127.0.0.1'
    const nowIso = new Date().toISOString()

    const fnClean = (val) => (val || '').toString().replace(/\D/g, '')

    const fnIsValidCpf = (cpfStr) => {
      const clean = fnClean(cpfStr)
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
      if (resto !== parseInt(clean.charAt(10), 10)) return false
      return true
    }

    const fnIsValidCnpj = (cnpjStr) => {
      const clean = fnClean(cnpjStr)
      if (!clean || clean.length !== 14) return false
      if (/^(\d)\1{13}$/.test(clean)) return false
      let soma = 0
      let peso = 5
      for (let i = 0; i < 12; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      let resto = soma % 11
      const dv1 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(12), 10) !== dv1) return false
      soma = 0
      peso = 6
      for (let i = 0; i < 13; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      resto = soma % 11
      const dv2 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(13), 10) !== dv2) return false
      return true
    }

    // Campos submetidos
    const nomeOuRazao = (body.razao_social || body.nome || '').trim()
    const docPrincipal = (body.cnpj || body.cpf || '').trim()
    const email = (body.email || '').trim()
    const telefone = (body.telefone || '').trim()
    const cep = (body.cep || '').trim()
    const logradouro = (body.logradouro || '').trim()
    const numero = (body.numero || '').trim()
    const complemento = (body.complemento || '').trim()
    const bairro = (body.bairro || '').trim()
    const municipio = (body.municipio || '').trim()
    const uf = (body.uf || '').trim().toUpperCase()

    // Validações obrigatórias
    if (!nomeOuRazao) {
      return e.json(400, { message: isPj ? 'Razão social é obrigatória.' : 'Nome é obrigatório.' })
    }
    if (!email || email.indexOf('@') === -1) {
      return e.json(400, { message: 'E-mail válido é obrigatório.' })
    }
    if (!telefone) {
      return e.json(400, { message: 'Telefone com DDD é obrigatório.' })
    }
    if (!cep || fnClean(cep).length < 8) {
      return e.json(400, { message: 'CEP completo de 8 dígitos é obrigatório.' })
    }
    if (!logradouro || !numero || !bairro || !municipio || !uf) {
      return e.json(400, {
        message: 'Endereço completo (logradouro, número, bairro, município e UF) é obrigatório.',
      })
    }

    if (isPj) {
      const cleanCnpj = fnClean(docPrincipal)
      if (!cleanCnpj || !fnIsValidCnpj(cleanCnpj)) {
        return e.json(400, { message: 'CNPJ inválido: confira os dígitos verificadores.' })
      }
      const repNome = (body.representante_nome || '').trim()
      const repDocClean = fnClean(body.representante_documento)
      if (!repNome) {
        return e.json(400, {
          message: 'Nome do representante legal é obrigatório para pessoa jurídica.',
        })
      }
      if (!repDocClean || !fnIsValidCpf(repDocClean)) {
        return e.json(400, { message: 'CPF do representante legal é inválido.' })
      }

      // Atualizar dados da empresa
      const emp = $app.findRecordById('empresas', empresaId)
      emp.set('razao_social', nomeOuRazao)
      emp.set('cnpj', docPrincipal)
      emp.set('email', email)
      emp.set('telefone', telefone)
      emp.set('cep', cep)
      emp.set('logradouro', logradouro)
      emp.set('numero', numero)
      emp.set('complemento', complemento)
      emp.set('bairro', bairro)
      emp.set('municipio', municipio)
      emp.set('uf', uf)
      emp.set('pre_cadastro', false)
      if (body.nome_fantasia) emp.set('nome_fantasia', body.nome_fantasia)
      $app.save(emp)

      // Criar ou atualizar contato do representante legal
      try {
        const contatosEmpresa = $app.findRecordsByFilter(
          'contatos',
          "empresa = '" + empresaId + "'",
          '-decisor,-created',
          1,
          0,
        )
        if (contatosEmpresa.length > 0) {
          const c = contatosEmpresa[0]
          c.set('nome', repNome)
          c.set('cargo', 'Representante Legal / Signatário')
          c.set('telefone', telefone)
          c.set('email', email)
          c.set('decisor', true)
          $app.save(c)
        } else {
          const contatosCol = $app.findCollectionByNameOrId('contatos')
          const novoC = new Record(contatosCol)
          novoC.set('empresa', empresaId)
          novoC.set('nome', repNome)
          novoC.set('cargo', 'Representante Legal / Signatário')
          novoC.set('telefone', telefone)
          novoC.set('email', email)
          novoC.set('decisor', true)
          $app.save(novoC)
        }
      } catch (errContato) {
        console.log('Aviso ao atualizar contato de representante: ' + errContato)
      }

      // Registrar nome sugerido no contrato para signatário
      contrato.set('cliente_nome_assinante', repNome)
      contrato.set('cliente_documento_assinante', body.representante_documento)
    } else {
      const cleanCpf = fnClean(docPrincipal)
      if (!cleanCpf || !fnIsValidCpf(cleanCpf)) {
        return e.json(400, { message: 'CPF inválido: confira os dígitos verificadores.' })
      }

      const pf = $app.findRecordById('clientes_pf', clientePfId)
      pf.set('nome', nomeOuRazao)
      pf.set('cpf', docPrincipal)
      pf.set('email', email)
      pf.set('telefone', telefone)
      pf.set('cep', cep)
      pf.set('logradouro', logradouro)
      pf.set('numero', numero)
      pf.set('complemento', complemento)
      pf.set('bairro', bairro)
      pf.set('municipio', municipio)
      pf.set('uf', uf)
      pf.set('pre_cadastro', false)
      const partes = [
        logradouro,
        numero ? 'nº ' + numero : '',
        complemento,
        bairro,
        municipio + '/' + uf,
        'CEP ' + cep,
      ]
      pf.set('endereco', partes.filter(Boolean).join(', '))
      $app.save(pf)

      contrato.set('cliente_nome_assinante', nomeOuRazao)
      contrato.set('cliente_documento_assinante', docPrincipal)
    }

    // Atualizar Contrato: assegurar token de assinatura do cliente (gerar se inexistente) e transição para 'aguardando_assinatura_admin'
    let tokenAssinaturaCliente = (contrato.getString('token_assinatura_cliente') || '').trim()
    let tokenFoiGeradoAgora = false
    if (!tokenAssinaturaCliente) {
      tokenAssinaturaCliente = $security.randomString(32)
      contrato.set('token_assinatura_cliente', tokenAssinaturaCliente)
      tokenFoiGeradoAgora = true
    }

    contrato.set('status', 'aguardando_assinatura_admin')
    contrato.set('campos_faltantes_json', [])
    contrato.set('dados_completados_em', nowIso)
    $app.save(contrato)

    // Atualizar Proposta marcando dados_complementares_preenchidos = true
    try {
      const propostaId = contrato.getString('proposta')
      if (propostaId) {
        const prop = $app.findRecordById('propostas', propostaId)
        prop.set('dados_complementares_preenchidos', true)
        $app.save(prop)
      }
    } catch (_) {}

    // Auditoria com detalhes do complemento de dados e emissão/atualização de token
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'COMPLEMENTO_DADOS_CLIENTE')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contrato.id)
      aRec.set('detalhes', {
        mensagem:
          'Cliente completou cadastro com sucesso pelo link público. Contrato ' +
          contrato.getString('numero') +
          ' liberado para assinatura da Diretoria G+.' +
          (tokenFoiGeradoAgora
            ? ' Novo token de assinatura do cliente emitido.'
            : ' Token de assinatura do cliente confirmado.'),
        contrato_numero: contrato.getString('numero'),
        tipo_cliente: isPj ? 'PJ' : 'PF',
        cliente_nome: nomeOuRazao,
        documento: docPrincipal,
        ip: clientIp,
        novo_status: 'aguardando_assinatura_admin',
        token_assinatura_cliente_emitido: tokenFoiGeradoAgora,
        token_assinatura_cliente_presente: Boolean(tokenAssinaturaCliente),
        data_conclusao: nowIso,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar complemento de dados: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message:
        'Cadastro complementado com sucesso! O contrato agora está pronto e aguardando a assinatura da Diretoria G+.',
      contrato_id: contrato.id,
      contrato_numero: contrato.getString('numero'),
      status: 'aguardando_assinatura_admin',
      token_assinatura_cliente: tokenAssinaturaCliente,
      token_complemento_dados: contrato.getString('token_complemento_dados'),
      contrato: {
        id: contrato.id,
        numero: contrato.getString('numero'),
        status: 'aguardando_assinatura_admin',
        token_assinatura_cliente: tokenAssinaturaCliente,
        token_complemento_dados: contrato.getString('token_complemento_dados'),
        valor_total: contrato.getFloat('valor_total'),
        objeto: contrato.getString('objeto'),
        dados_completados_em: nowIso,
      },
    })
  } catch (err) {
    console.log('Erro ao salvar complemento de dados: ' + err)
    return e.json(500, { message: 'Erro interno ao processar dados: ' + err })
  }
})

// Endpoint para Assinatura do Cliente no Contrato de Serviço
routerAdd('POST', '/backend/v1/contratos-servico/assinar-cliente', (e) => {
  function ativarContratoServicoBilateral(rec) {
    const contratoId = rec.id
    const contratoNumero = rec.getString('numero')
    const propostaId = rec.getString('proposta')
    const empresaId = rec.getString('empresa')
    const clientePfId = rec.getString('cliente_pf')
    const valorTotalContrato = rec.getFloat('valor_total') || 0
    const objetoContrato = rec.getString('objeto') || 'Prestação de serviços técnicos de engenharia'

    let propostaRec = null
    let propostaNumero = ''
    let condicoesPagamento = 'Conforme contrato assinado'
    let requerNotaProposta = false
    let aliquotaImpostos = 0

    if (propostaId) {
      try {
        propostaRec = $app.findRecordById('propostas', propostaId)
        if (propostaRec) {
          propostaNumero = propostaRec.getString('numero')
          condicoesPagamento = propostaRec.getString('condicoes_pagamento') || condicoesPagamento
          requerNotaProposta = propostaRec.getBool('requer_nota')
          aliquotaImpostos = propostaRec.getInt('impostos') || 0
        }
      } catch (errProp) {
        console.log('Erro ao buscar proposta vinculada ' + propostaId + ': ' + errProp)
      }
    }

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

    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const projetosCol = $app.findCollectionByNameOrId('projetos')
    const gruposCol = $app.findCollectionByNameOrId('grupos_projetos')
    const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')
    const contasCol = $app.findCollectionByNameOrId('contas')

    // 1. CRIAR OU RECUPERAR GRUPO DE PROJETOS (Trava 1:1)
    let grupoCriado = null
    try {
      const gruposExistentes = $app.findRecordsByFilter(
        'grupos_projetos',
        "contrato_servico = '" + contratoId + "'",
        '-created',
        1,
        0,
      )
      if (gruposExistentes.length > 0) {
        grupoCriado = gruposExistentes[0]
      } else {
        const anoAtual = new Date().getFullYear()
        const prefixoGPR = 'GPR-' + anoAtual + '-'
        const gruposDoAno = $app.findRecordsByFilter(
          'grupos_projetos',
          "codigo ~ '" + prefixoGPR + "'",
          '-codigo',
          1,
          0,
        )

        let proximoSeqGpr = 1
        if (gruposDoAno.length > 0) {
          const ultimoCodigo = gruposDoAno[0].getString('codigo')
          const partes = ultimoCodigo.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeqGpr = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeqGpr).slice(-4)
        const codigoGPR = prefixoGPR + seqStr

        const novoGrupo = new Record(gruposCol)
        novoGrupo.set('codigo', codigoGPR)
        novoGrupo.set('contrato_servico', contratoId)
        if (propostaId) novoGrupo.set('proposta', propostaId)
        if (empresaId) novoGrupo.set('empresa', empresaId)
        if (clientePfId) novoGrupo.set('cliente_pf', clientePfId)
        novoGrupo.set('nome', 'Grupo: ' + contratoNumero + ' — ' + nomeCliente)
        novoGrupo.set('descricao', objetoContrato)
        novoGrupo.set('status', 'ativo')
        novoGrupo.set('valor_total', valorTotalContrato)

        $app.save(novoGrupo)
        grupoCriado = novoGrupo

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'CRIACAO_GRUPO_PROJETOS')
          aRec.set('entidade', 'grupos_projetos')
          aRec.set('registro_id', novoGrupo.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Grupo de projetos ' +
              codigoGPR +
              ' criado pela assinatura bilateral do Contrato ' +
              contratoNumero,
            codigo: codigoGPR,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            valor_total: valorTotalContrato,
          })
          $app.save(aRec)
        } catch (_) {}
      }
    } catch (errGrupo) {
      console.log('Erro ao criar grupo de projetos: ' + errGrupo)
    }

    // Trava de idempotência atômica: se já existirem projetos ativos vinculados a este contrato, não recriar
    const projetosJaCriados = $app.findRecordsByFilter(
      'projetos',
      "contrato_servico = '" + contratoId + "'",
      'codigo',
      100,
      0,
    )
    if (projetosJaCriados.length > 0) {
      for (let pIdx = 0; pIdx < projetosJaCriados.length; pIdx++) {
        const prjExistente = projetosJaCriados[pIdx]
        let prjModificado = false
        if (grupoCriado && prjExistente.getString('grupo') !== grupoCriado.id) {
          prjExistente.set('grupo', grupoCriado.id)
          prjModificado = true
        }
        if (clientePfId && prjExistente.getString('cliente_pf') !== clientePfId) {
          prjExistente.set('cliente_pf', clientePfId)
          prjModificado = true
        }
        if (empresaId && prjExistente.getString('empresa') !== empresaId) {
          prjExistente.set('empresa', empresaId)
          prjModificado = true
        }
        const st = prjExistente.getString('status')
        if (st === 'contratacao' || st === 'Em Contratação' || !st) {
          prjExistente.set('status', 'aguardando_definicao')
          prjExistente.set('modo_execucao', null)
          prjModificado = true
        }
        if (prjModificado) {
          $app.save(prjExistente)
        }
      }
      return
    }

    // 2. ITENS DE ESCOPO (Apenas itens reais do catálogo ou com serviço/descrição válida)
    let itensEscopo = []
    if (propostaId) {
      try {
        const itensDb = $app.findRecordsByFilter(
          'proposta_itens',
          "proposta = '" + propostaId + "'",
          'ordem,created',
          200,
          0,
        )
        if (itensDb.length > 0) {
          itensEscopo = itensDb
            .filter((it) => {
              const desc = (it.getString('descricao') || '').trim()
              const serv = it.getString('servico') || ''
              return (serv !== '' || desc.length > 0) && !desc.startsWith('Item de Escopo ')
            })
            .map((it) => ({
              id: it.id,
              record: it,
              descricao: it.getString('descricao'),
              disciplina: it.getString('disciplina') || 'Geral',
              area: it.getString('area'),
              valor: it.getFloat('preco_total') || 0,
              custo: it.getFloat('custo_total') || 0,
              subservicos: it.get('subservicos') || [],
            }))
        }
      } catch (_) {}

      if (itensEscopo.length === 0 && propostaRec) {
        try {
          const rawJsonStr = propostaRec.getString('itens_json')
          let parsedItens = []
          if (rawJsonStr && rawJsonStr.trim()) {
            const parsed = JSON.parse(rawJsonStr)
            if (Array.isArray(parsed)) {
              parsedItens = parsed
            }
          }
          if (parsedItens.length > 0) {
            itensEscopo = parsedItens
              .filter((it) => {
                const desc = typeof it.descricao === 'string' ? it.descricao.trim() : ''
                const temServico = Boolean(it.servico || it.catalogo_servico)
                const descValida = desc.length > 0 && !desc.startsWith('Item de Escopo ')
                return temServico || descValida
              })
              .map((it) => ({
                id: null,
                record: null,
                descricao: (it.descricao || '').trim() || objetoContrato,
                disciplina: it.disciplina || 'Geral',
                area: it.area || '',
                valor: Number(it.preco_total) || 0,
                custo: Number(it.custo_total) || 0,
                subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
              }))
          }
        } catch (errJson) {
          console.log('Erro ao analisar itens_json canônico: ' + errJson)
        }
      }
    }

    if (itensEscopo.length === 0) {
      itensEscopo = [
        {
          id: null,
          record: null,
          descricao: objetoContrato,
          disciplina: propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
          area: '',
          valor: valorTotalContrato,
          custo: 0,
          subservicos: [],
        },
      ]
    }

    const somaItens = itensEscopo.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
    if (somaItens === 0 && valorTotalContrato > 0) {
      const valorPorItem = Math.round((valorTotalContrato / itensEscopo.length) * 100) / 100
      for (let idx = 0; idx < itensEscopo.length; idx++) {
        itensEscopo[idx].valor =
          idx === itensEscopo.length - 1
            ? Math.round((valorTotalContrato - valorPorItem * (itensEscopo.length - 1)) * 100) / 100
            : valorPorItem
      }
    }

    // 3. PROJETOS POR ITEM DE ESCOPO
    let projetosExistentesContrato = []
    try {
      projetosExistentesContrato = $app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" +
          contratoId +
          "' || (proposta = '" +
          propostaId +
          "' && grupo = '')",
        'codigo',
        100,
        0,
      )
    } catch (_) {}

    const anoAtualPrj = new Date().getFullYear()
    const prefixoPRJ = 'PRJ-' + anoAtualPrj + '-'
    let proximoSeqPrj = 1
    try {
      const projetosDoAno = $app.findRecordsByFilter(
        'projetos',
        "codigo ~ '" + prefixoPRJ + "'",
        '-codigo',
        1,
        0,
      )
      if (projetosDoAno.length > 0) {
        const ult = projetosDoAno[0].getString('codigo')
        const partes = ult.split('-')
        const num = parseInt(partes[2], 10)
        if (!isNaN(num)) proximoSeqPrj = num + 1
      }
    } catch (_) {}

    const projetosGerados = []

    for (let i = 0; i < itensEscopo.length; i++) {
      const item = itensEscopo[i]
      let prjParaItem = null

      if (i < projetosExistentesContrato.length) {
        prjParaItem = projetosExistentesContrato[i]
      }

      if (prjParaItem) {
        let prjAlterado = false
        if (grupoCriado && prjParaItem.getString('grupo') !== grupoCriado.id) {
          prjParaItem.set('grupo', grupoCriado.id)
          prjAlterado = true
        }
        if (prjParaItem.getString('contrato_servico') !== contratoId) {
          prjParaItem.set('contrato_servico', contratoId)
          prjAlterado = true
        }
        if (clientePfId && prjParaItem.getString('cliente_pf') !== clientePfId) {
          prjParaItem.set('cliente_pf', clientePfId)
          prjAlterado = true
        }
        if (empresaId && prjParaItem.getString('empresa') !== empresaId) {
          prjParaItem.set('empresa', empresaId)
          prjAlterado = true
        }

        if (itensEscopo.length > 1) {
          prjParaItem.set(
            'nome',
            'Projeto ' +
              (i + 1) +
              '/' +
              itensEscopo.length +
              ': ' +
              item.descricao +
              ' — ' +
              nomeCliente,
          )
          prjParaItem.set('descricao', item.descricao)
          prjParaItem.set('valor_total', item.valor)
          prjParaItem.set('disciplinas', item.disciplina)
          prjAlterado = true
        } else {
          prjParaItem.set('valor_total', item.valor || valorTotalContrato)
          prjAlterado = true
        }

        const statusAtual = prjParaItem.getString('status')
        if (statusAtual === 'contratacao' || statusAtual === 'Em Contratação' || !statusAtual) {
          prjParaItem.set('status', 'aguardando_definicao')
          prjParaItem.set('modo_execucao', null)
          prjAlterado = true
        }

        if (prjAlterado) {
          $app.save(prjParaItem)
        }
      } else {
        const seqStr = ('0000' + proximoSeqPrj).slice(-4)
        const codigoPRJ = prefixoPRJ + seqStr
        proximoSeqPrj++

        const novoPrj = new Record(projetosCol)
        novoPrj.set('codigo', codigoPRJ)
        novoPrj.set(
          'nome',
          itensEscopo.length > 1
            ? 'Projeto ' +
                (i + 1) +
                '/' +
                itensEscopo.length +
                ': ' +
                item.descricao +
                ' — ' +
                nomeCliente
            : 'Projeto: ' + contratoNumero + ' — ' + nomeCliente,
        )
        novoPrj.set('descricao', item.descricao)
        if (propostaId) novoPrj.set('proposta', propostaId)
        novoPrj.set('contrato_servico', contratoId)
        if (grupoCriado) novoPrj.set('grupo', grupoCriado.id)
        if (empresaId) novoPrj.set('empresa', empresaId)
        if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
        novoPrj.set('valor_total', item.valor)
        novoPrj.set('subcontratacao_autorizada', true)
        novoPrj.set('saude', 'verde')
        novoPrj.set('status', 'aguardando_definicao')
        novoPrj.set('modo_execucao', null)
        novoPrj.set('disciplinas', item.disciplina)

        $app.save(novoPrj)
        prjParaItem = novoPrj

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'CRIACAO_PROJETO_ITEM_ESCOPO')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoPrj.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Projeto ' +
              codigoPRJ +
              ' criado para o item de escopo "' +
              item.descricao +
              '" do Contrato ' +
              contratoNumero,
            codigo: codigoPRJ,
            grupo_id: grupoCriado ? grupoCriado.id : null,
            grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            item_descricao: item.descricao,
            item_valor: item.valor,
          })
          $app.save(aRec)
        } catch (_) {}
      }

      projetosGerados.push(prjParaItem)

      if (item.record) {
        try {
          item.record.set('status_conversao', 'convertido')
          item.record.set('projeto_gerado', prjParaItem.id)
          $app.save(item.record)
        } catch (_) {}
      }

      // 4. ETAPAS E ENTREGÁVEIS
      try {
        const etapasExistentes = $app.findRecordsByFilter(
          'projeto_etapas',
          "projeto = '" + prjParaItem.id + "'",
          'ordem',
          1,
          0,
        )

        if (etapasExistentes.length === 0) {
          let areaNome = item.disciplina || 'Geral'
          if (item.area) {
            try {
              const areaRec = $app.findRecordById('areas_atuacao', item.area)
              if (areaRec) areaNome = areaRec.getString('nome')
            } catch (_) {}
          }

          const novaEtapa = new Record(etapasCol)
          novaEtapa.set('projeto', prjParaItem.id)
          novaEtapa.set('nome', 'Etapa: ' + (areaNome || item.descricao))
          novaEtapa.set('disciplina', item.disciplina || 'Geral')
          novaEtapa.set('ordem', 1)
          novaEtapa.set('tipo_execucao', 'direta')
          novaEtapa.set('status', 'nao_iniciada')
          novaEtapa.set('custo_estimado', item.custo || 0)

          let desc = 'Subserviços contemplados: '
          if (Array.isArray(item.subservicos) && item.subservicos.length > 0) {
            desc += item.subservicos.join(', ')
          } else {
            desc += 'Serviços técnicos de ' + item.disciplina
          }
          desc += '.\nItem do escopo: ' + item.descricao
          novaEtapa.set('descricao', desc)

          if (item.area) {
            novaEtapa.set('area', item.area)
          }

          $app.save(novaEtapa)

          if (item.record) {
            try {
              item.record.set('etapa_gerada', novaEtapa.id)
              $app.save(item.record)
            } catch (_) {}
          }

          if (item.area) {
            try {
              const entregaveisPadrao = $app.findRecordsByFilter(
                'entregaveis_padrao',
                "area = '" + item.area + "' && ativo = true",
                'ordem',
                30,
                0,
              )
              for (let ep = 0; ep < entregaveisPadrao.length; ep++) {
                try {
                  const novoEntregavel = new Record(entregaveisCol)
                  novoEntregavel.set('etapa', novaEtapa.id)
                  novoEntregavel.set('nome', entregaveisPadrao[ep].getString('nome'))
                  novoEntregavel.set('versao', 'v1.0')
                  novoEntregavel.set('status', 'pendente')
                  novoEntregavel.set(
                    'descricao',
                    entregaveisPadrao[ep].getString('descricao') ||
                      'Entregável técnico padrão da disciplina ' + item.disciplina,
                  )
                  $app.save(novoEntregavel)
                } catch (_) {}
              }
            } catch (_) {}
          }
        }
      } catch (errEtapaPrj) {
        console.log('Erro ao criar etapas para o projeto do item: ' + errEtapaPrj)
      }
    }

    if (projetosGerados.length > 0) {
      try {
        rec.set('projeto', projetosGerados[0].id)
        $app.save(rec)
      } catch (_) {}
    }

    // 5. CONTAS A RECEBER
    try {
      const projetoRefId = projetosGerados.length > 0 ? projetosGerados[0].id : null
      let filtroContas = "tipo = 'receber' && (descricao ~ 'Contrato " + contratoNumero + "'"
      if (propostaId) {
        filtroContas += " || proposta = '" + propostaId + "'"
      }
      filtroContas += ')'
      const contasExistentes = $app.findRecordsByFilter('contas', filtroContas, '-created', 1, 0)

      if (contasExistentes.length === 0) {
        let parcelas = []
        if (propostaId) {
          try {
            parcelas = $app.findRecordsByFilter(
              'proposta_parcelas',
              "proposta = '" + propostaId + "'",
              'ordem',
              50,
              0,
            )
          } catch (_) {}
        }

        if (parcelas && parcelas.length > 0) {
          for (let i = 0; i < parcelas.length; i++) {
            const parc = parcelas[i]
            const ordem = parc.getInt('ordem') || i + 1
            const perc = parc.getFloat('percentual') || 0
            const valorParc = parc.getFloat('valor') || (valorTotalContrato * perc) / 100
            const descParc = parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
            const gatilho = parc.getString('gatilho') || 'marco'

            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoRefId) novaConta.set('projeto', projetoRefId)
            if (propostaId) novaConta.set('proposta', propostaId)
            novaConta.set(
              'descricao',
              'Contrato ' +
                contratoNumero +
                ' — Parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ' (' +
                perc +
                '% - ' +
                descParc +
                ')' +
                (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorParc)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNotaProposta && aliquotaImpostos > 0) {
              const retencao =
                Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorParc)
            }

            const diasVenc = i === 0 ? 15 : (i + 1) * 30
            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + diasVenc)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaConta)

            try {
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Conta a receber da parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' gerada por assinatura do Contrato ' +
                  contratoNumero,
                ordem: ordem,
                percentual: perc,
                valor: valorParc,
                gatilho: gatilho,
                projeto_id: projetoRefId,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        } else {
          const novaConta = new Record(contasCol)
          novaConta.set('tipo', 'receber')
          if (projetoRefId) novaConta.set('projeto', projetoRefId)
          if (propostaId) novaConta.set('proposta', propostaId)
          novaConta.set(
            'descricao',
            'Recebimento integral do Contrato Assinado ' +
              contratoNumero +
              (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
          )
          novaConta.set('valor', valorTotalContrato)
          novaConta.set('status', 'rascunho')
          novaConta.set('forma_pagamento', condicoesPagamento)
          novaConta.set('bloqueada_por_fechamento', false)

          if (requerNotaProposta && aliquotaImpostos > 0) {
            const retencao =
              Math.round(
                ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
              ) / 100
            novaConta.set('retencao_impostos', retencao)
            novaConta.set('valor_liquido', Math.round((valorTotalContrato - retencao) * 100) / 100)
          } else {
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorTotalContrato)
          }

          const dataVenc = new Date()
          dataVenc.setDate(dataVenc.getDate() + 30)
          novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

          $app.save(novaConta)

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
            aRec.set('entidade', 'contas')
            aRec.set('registro_id', novaConta.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
              valor: valorTotalContrato,
              projeto_id: projetoRefId,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (errContas) {
      console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
    }

    // Auditoria geral Bloco 4
    try {
      const aRec = new Record(auditCol)
      aRec.set('user', null)
      aRec.set('user_email', 'SISTEMA')
      aRec.set('acao', 'ATIVACAO_BLOCO4_CONTRATO_ASSINADO')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contratoId)
      aRec.set('detalhes', {
        origem: 'SISTEMA / GATILHO AUTOMÁTICO',
        mensagem:
          'Contrato ' +
          contratoNumero +
          ' assinado bilateralmente. 1 Grupo de Projetos (' +
          (grupoCriado ? grupoCriado.getString('codigo') : 'GPR') +
          ') e ' +
          projetosGerados.length +
          ' projeto(s) gerado(s) com sucesso.',
        contrato_numero: contratoNumero,
        grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
        total_projetos: projetosGerados.length,
        codigos_projetos: projetosGerados.map((p) => p.getString('codigo')),
        valor_total: valorTotalContrato,
      })
      $app.save(aRec)
    } catch (_) {}

    // Promoção
    if (empresaId) {
      try {
        const empresa = $app.findRecordById('empresas', empresaId)
        if (empresa) {
          const etapaAtual = empresa.getString('etapa_funil')
          const eraPreCadastro = empresa.getBool('pre_cadastro')

          let houveMudanca = false
          if (eraPreCadastro) {
            empresa.set('pre_cadastro', false)
            houveMudanca = true
          }

          if (etapaAtual !== 'parceira') {
            empresa.set('etapa_anterior', etapaAtual)
            empresa.set('etapa_funil', 'parceira')
            empresa.set('status', 'ativa')
            houveMudanca = true
          }

          if (houveMudanca) {
            empresa.set(
              'observacoes',
              (empresa.getString('observacoes') || '') +
                '\n[Efetivação por Contrato Assinado]: Contrato ' +
                contratoNumero +
                ' assinado em ' +
                new Date().toISOString() +
                (eraPreCadastro ? ' (pré-cadastro promovido a definitivo)' : ''),
            )
            $app.save(empresa)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CONVERSAO_EM_PARCEIRA')
              aRec.set('entidade', 'empresas')
              aRec.set('registro_id', empresaId)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Empresa convertida para Parceira pela assinatura do Contrato ' + contratoNumero,
                contrato_numero: contratoNumero,
                proposta_numero: propostaNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (errEmp) {
        console.log('Erro ao converter empresa em parceira por contrato: ' + errEmp)
      }
    }

    if (clientePfId) {
      try {
        const clientePf = $app.findRecordById('clientes_pf', clientePfId)
        if (clientePf && clientePf.getBool('pre_cadastro')) {
          clientePf.set('pre_cadastro', false)
          clientePf.set(
            'observacoes',
            (clientePf.getString('observacoes') || '') +
              '\n[Efetivação por Contrato Assinado]: Contrato ' +
              contratoNumero +
              ' assinado em ' +
              new Date().toISOString() +
              ' (promovido a cliente definitivo)',
          )
          $app.save(clientePf)

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'PROMOCAO_CLIENTE_CONTRATO')
            aRec.set('entidade', 'clientes_pf')
            aRec.set('registro_id', clientePfId)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              tipo: 'pf',
              mensagem:
                'Cliente PF promovido de pré-cadastro a definitivo pela assinatura do Contrato ' +
                contratoNumero,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errPf) {
        console.log('Erro ao promover cliente PF por contrato: ' + errPf)
      }
    }
  }

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

    // BLOQUEIO SERVER-SIDE DO BLOCO 3:
    // Se o cadastro estiver incompleto (status 'aguardando_dados_cliente'), o cliente NÃO pode assinar
    if (contrato.getString('status') === 'aguardando_dados_cliente') {
      return e.json(403, {
        message:
          'Não é possível assinar o contrato enquanto houver pendências nos dados cadastrais. Por favor, complete as informações solicitadas.',
        cadastro_incompleto: true,
        token_complemento_dados: contrato.getString('token_complemento_dados'),
      })
    }

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

    const assinadoBilateralmente = Boolean(contrato.getString('data_assinatura_admin'))
    if (assinadoBilateralmente) {
      contrato.set('status', 'assinado')
    } else {
      contrato.set('status', 'aguardando_assinatura_admin')
    }

    $app.save(contrato)

    // Ativação explícita do contrato quando assinado bilateralmente
    if (assinadoBilateralmente) {
      try {
        ativarContratoServicoBilateral(contrato)
      } catch (errAtiv) {
        console.log('Erro ao ativar contrato assinado (assinar-cliente): ' + errAtiv)
      }
    }

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
    function ativarContratoServicoBilateral(rec) {
      const contratoId = rec.id
      const contratoNumero = rec.getString('numero')
      const propostaId = rec.getString('proposta')
      const empresaId = rec.getString('empresa')
      const clientePfId = rec.getString('cliente_pf')
      const valorTotalContrato = rec.getFloat('valor_total') || 0
      const objetoContrato =
        rec.getString('objeto') || 'Prestação de serviços técnicos de engenharia'

      let propostaRec = null
      let propostaNumero = ''
      let condicoesPagamento = 'Conforme contrato assinado'
      let requerNotaProposta = false
      let aliquotaImpostos = 0

      if (propostaId) {
        try {
          propostaRec = $app.findRecordById('propostas', propostaId)
          if (propostaRec) {
            propostaNumero = propostaRec.getString('numero')
            condicoesPagamento = propostaRec.getString('condicoes_pagamento') || condicoesPagamento
            requerNotaProposta = propostaRec.getBool('requer_nota')
            aliquotaImpostos = propostaRec.getInt('impostos') || 0
          }
        } catch (errProp) {
          console.log('Erro ao buscar proposta vinculada ' + propostaId + ': ' + errProp)
        }
      }

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

      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const projetosCol = $app.findCollectionByNameOrId('projetos')
      const gruposCol = $app.findCollectionByNameOrId('grupos_projetos')
      const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
      const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')
      const contasCol = $app.findCollectionByNameOrId('contas')

      // 1. CRIAR OU RECUPERAR GRUPO DE PROJETOS (Trava 1:1)
      let grupoCriado = null
      try {
        const gruposExistentes = $app.findRecordsByFilter(
          'grupos_projetos',
          "contrato_servico = '" + contratoId + "'",
          '-created',
          1,
          0,
        )
        if (gruposExistentes.length > 0) {
          grupoCriado = gruposExistentes[0]
        } else {
          const anoAtual = new Date().getFullYear()
          const prefixoGPR = 'GPR-' + anoAtual + '-'
          const gruposDoAno = $app.findRecordsByFilter(
            'grupos_projetos',
            "codigo ~ '" + prefixoGPR + "'",
            '-codigo',
            1,
            0,
          )

          let proximoSeqGpr = 1
          if (gruposDoAno.length > 0) {
            const ultimoCodigo = gruposDoAno[0].getString('codigo')
            const partes = ultimoCodigo.split('-')
            const ultimoSeq = parseInt(partes[2], 10)
            if (!isNaN(ultimoSeq)) {
              proximoSeqGpr = ultimoSeq + 1
            }
          }

          const seqStr = ('0000' + proximoSeqGpr).slice(-4)
          const codigoGPR = prefixoGPR + seqStr

          const novoGrupo = new Record(gruposCol)
          novoGrupo.set('codigo', codigoGPR)
          novoGrupo.set('contrato_servico', contratoId)
          if (propostaId) novoGrupo.set('proposta', propostaId)
          if (empresaId) novoGrupo.set('empresa', empresaId)
          if (clientePfId) novoGrupo.set('cliente_pf', clientePfId)
          novoGrupo.set('nome', 'Grupo: ' + contratoNumero + ' — ' + nomeCliente)
          novoGrupo.set('descricao', objetoContrato)
          novoGrupo.set('status', 'ativo')
          novoGrupo.set('valor_total', valorTotalContrato)

          $app.save(novoGrupo)
          grupoCriado = novoGrupo

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_GRUPO_PROJETOS')
            aRec.set('entidade', 'grupos_projetos')
            aRec.set('registro_id', novoGrupo.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Grupo de projetos ' +
                codigoGPR +
                ' criado pela assinatura bilateral do Contrato ' +
                contratoNumero,
              codigo: codigoGPR,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
              proposta_id: propostaId,
              proposta_numero: propostaNumero,
              valor_total: valorTotalContrato,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errGrupo) {
        console.log('Erro ao criar grupo de projetos: ' + errGrupo)
      }

      // Trava de idempotência atômica: se já existirem projetos ativos vinculados a este contrato, não recriar
      const projetosJaCriados = $app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" + contratoId + "'",
        'codigo',
        100,
        0,
      )
      if (projetosJaCriados.length > 0) {
        for (let pIdx = 0; pIdx < projetosJaCriados.length; pIdx++) {
          const prjExistente = projetosJaCriados[pIdx]
          let prjModificado = false
          if (grupoCriado && prjExistente.getString('grupo') !== grupoCriado.id) {
            prjExistente.set('grupo', grupoCriado.id)
            prjModificado = true
          }
          if (clientePfId && prjExistente.getString('cliente_pf') !== clientePfId) {
            prjExistente.set('cliente_pf', clientePfId)
            prjModificado = true
          }
          if (empresaId && prjExistente.getString('empresa') !== empresaId) {
            prjExistente.set('empresa', empresaId)
            prjModificado = true
          }
          const st = prjExistente.getString('status')
          if (st === 'contratacao' || st === 'Em Contratação' || !st) {
            prjExistente.set('status', 'aguardando_definicao')
            prjExistente.set('modo_execucao', null)
            prjModificado = true
          }
          if (prjModificado) {
            $app.save(prjExistente)
          }
        }
        return
      }

      // 2. ITENS DE ESCOPO (Apenas itens reais do catálogo ou com serviço/descrição válida)
      let itensEscopo = []
      if (propostaId) {
        try {
          const itensDb = $app.findRecordsByFilter(
            'proposta_itens',
            "proposta = '" + propostaId + "'",
            'ordem,created',
            200,
            0,
          )
          if (itensDb.length > 0) {
            itensEscopo = itensDb
              .filter((it) => {
                const desc = (it.getString('descricao') || '').trim()
                const serv = it.getString('servico') || ''
                return (serv !== '' || desc.length > 0) && !desc.startsWith('Item de Escopo ')
              })
              .map((it) => ({
                id: it.id,
                record: it,
                descricao: it.getString('descricao'),
                disciplina: it.getString('disciplina') || 'Geral',
                area: it.getString('area'),
                valor: it.getFloat('preco_total') || 0,
                custo: it.getFloat('custo_total') || 0,
                subservicos: it.get('subservicos') || [],
              }))
          }
        } catch (_) {}

        if (itensEscopo.length === 0 && propostaRec) {
          try {
            const rawJsonStr = propostaRec.getString('itens_json')
            let parsedItens = []
            if (rawJsonStr && rawJsonStr.trim()) {
              const parsed = JSON.parse(rawJsonStr)
              if (Array.isArray(parsed)) {
                parsedItens = parsed
              }
            }
            if (parsedItens.length > 0) {
              itensEscopo = parsedItens
                .filter((it) => {
                  const desc = typeof it.descricao === 'string' ? it.descricao.trim() : ''
                  const temServico = Boolean(it.servico || it.catalogo_servico)
                  const descValida = desc.length > 0 && !desc.startsWith('Item de Escopo ')
                  return temServico || descValida
                })
                .map((it) => ({
                  id: null,
                  record: null,
                  descricao: (it.descricao || '').trim() || objetoContrato,
                  disciplina: it.disciplina || 'Geral',
                  area: it.area || '',
                  valor: Number(it.preco_total) || 0,
                  custo: Number(it.custo_total) || 0,
                  subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
                }))
            }
          } catch (errJson) {
            console.log('Erro ao analisar itens_json canônico: ' + errJson)
          }
        }
      }

      if (itensEscopo.length === 0) {
        itensEscopo = [
          {
            id: null,
            record: null,
            descricao: objetoContrato,
            disciplina: propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
            area: '',
            valor: valorTotalContrato,
            custo: 0,
            subservicos: [],
          },
        ]
      }

      const somaItens = itensEscopo.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
      if (somaItens === 0 && valorTotalContrato > 0) {
        const valorPorItem = Math.round((valorTotalContrato / itensEscopo.length) * 100) / 100
        for (let idx = 0; idx < itensEscopo.length; idx++) {
          itensEscopo[idx].valor =
            idx === itensEscopo.length - 1
              ? Math.round((valorTotalContrato - valorPorItem * (itensEscopo.length - 1)) * 100) /
                100
              : valorPorItem
        }
      }

      // 3. PROJETOS POR ITEM DE ESCOPO
      let projetosExistentesContrato = []
      try {
        projetosExistentesContrato = $app.findRecordsByFilter(
          'projetos',
          "contrato_servico = '" +
            contratoId +
            "' || (proposta = '" +
            propostaId +
            "' && grupo = '')",
          'codigo',
          100,
          0,
        )
      } catch (_) {}

      const anoAtualPrj = new Date().getFullYear()
      const prefixoPRJ = 'PRJ-' + anoAtualPrj + '-'
      let proximoSeqPrj = 1
      try {
        const projetosDoAno = $app.findRecordsByFilter(
          'projetos',
          "codigo ~ '" + prefixoPRJ + "'",
          '-codigo',
          1,
          0,
        )
        if (projetosDoAno.length > 0) {
          const ult = projetosDoAno[0].getString('codigo')
          const partes = ult.split('-')
          const num = parseInt(partes[2], 10)
          if (!isNaN(num)) proximoSeqPrj = num + 1
        }
      } catch (_) {}

      const projetosGerados = []

      for (let i = 0; i < itensEscopo.length; i++) {
        const item = itensEscopo[i]
        let prjParaItem = null

        if (i < projetosExistentesContrato.length) {
          prjParaItem = projetosExistentesContrato[i]
        }

        if (prjParaItem) {
          let prjAlterado = false
          if (grupoCriado && prjParaItem.getString('grupo') !== grupoCriado.id) {
            prjParaItem.set('grupo', grupoCriado.id)
            prjAlterado = true
          }
          if (prjParaItem.getString('contrato_servico') !== contratoId) {
            prjParaItem.set('contrato_servico', contratoId)
            prjAlterado = true
          }
          if (clientePfId && prjParaItem.getString('cliente_pf') !== clientePfId) {
            prjParaItem.set('cliente_pf', clientePfId)
            prjAlterado = true
          }
          if (empresaId && prjParaItem.getString('empresa') !== empresaId) {
            prjParaItem.set('empresa', empresaId)
            prjAlterado = true
          }

          if (itensEscopo.length > 1) {
            prjParaItem.set(
              'nome',
              'Projeto ' +
                (i + 1) +
                '/' +
                itensEscopo.length +
                ': ' +
                item.descricao +
                ' — ' +
                nomeCliente,
            )
            prjParaItem.set('descricao', item.descricao)
            prjParaItem.set('valor_total', item.valor)
            prjParaItem.set('disciplinas', item.disciplina)
            prjAlterado = true
          } else {
            prjParaItem.set('valor_total', item.valor || valorTotalContrato)
            prjAlterado = true
          }

          const statusAtual = prjParaItem.getString('status')
          if (statusAtual === 'contratacao' || statusAtual === 'Em Contratação' || !statusAtual) {
            prjParaItem.set('status', 'aguardando_definicao')
            prjParaItem.set('modo_execucao', null)
            prjAlterado = true
          }

          if (prjAlterado) {
            $app.save(prjParaItem)
          }
        } else {
          const seqStr = ('0000' + proximoSeqPrj).slice(-4)
          const codigoPRJ = prefixoPRJ + seqStr
          proximoSeqPrj++

          const novoPrj = new Record(projetosCol)
          novoPrj.set('codigo', codigoPRJ)
          novoPrj.set(
            'nome',
            itensEscopo.length > 1
              ? 'Projeto ' +
                  (i + 1) +
                  '/' +
                  itensEscopo.length +
                  ': ' +
                  item.descricao +
                  ' — ' +
                  nomeCliente
              : 'Projeto: ' + contratoNumero + ' — ' + nomeCliente,
          )
          novoPrj.set('descricao', item.descricao)
          if (propostaId) novoPrj.set('proposta', propostaId)
          novoPrj.set('contrato_servico', contratoId)
          if (grupoCriado) novoPrj.set('grupo', grupoCriado.id)
          if (empresaId) novoPrj.set('empresa', empresaId)
          if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
          novoPrj.set('valor_total', item.valor)
          novoPrj.set('subcontratacao_autorizada', true)
          novoPrj.set('saude', 'verde')
          novoPrj.set('status', 'aguardando_definicao')
          novoPrj.set('modo_execucao', null)
          novoPrj.set('disciplinas', item.disciplina)

          $app.save(novoPrj)
          prjParaItem = novoPrj

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_PROJETO_ITEM_ESCOPO')
            aRec.set('entidade', 'projetos')
            aRec.set('registro_id', novoPrj.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Projeto ' +
                codigoPRJ +
                ' criado para o item de escopo "' +
                item.descricao +
                '" do Contrato ' +
                contratoNumero,
              codigo: codigoPRJ,
              grupo_id: grupoCriado ? grupoCriado.id : null,
              grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
              item_descricao: item.descricao,
              item_valor: item.valor,
            })
            $app.save(aRec)
          } catch (_) {}
        }

        projetosGerados.push(prjParaItem)

        if (item.record) {
          try {
            item.record.set('status_conversao', 'convertido')
            item.record.set('projeto_gerado', prjParaItem.id)
            $app.save(item.record)
          } catch (_) {}
        }

        // 4. ETAPAS E ENTREGÁVEIS
        try {
          const etapasExistentes = $app.findRecordsByFilter(
            'projeto_etapas',
            "projeto = '" + prjParaItem.id + "'",
            'ordem',
            1,
            0,
          )

          if (etapasExistentes.length === 0) {
            let areaNome = item.disciplina || 'Geral'
            if (item.area) {
              try {
                const areaRec = $app.findRecordById('areas_atuacao', item.area)
                if (areaRec) areaNome = areaRec.getString('nome')
              } catch (_) {}
            }

            const novaEtapa = new Record(etapasCol)
            novaEtapa.set('projeto', prjParaItem.id)
            novaEtapa.set('nome', 'Etapa: ' + (areaNome || item.descricao))
            novaEtapa.set('disciplina', item.disciplina || 'Geral')
            novaEtapa.set('ordem', 1)
            novaEtapa.set('tipo_execucao', 'direta')
            novaEtapa.set('status', 'nao_iniciada')
            novaEtapa.set('custo_estimado', item.custo || 0)

            let desc = 'Subserviços contemplados: '
            if (Array.isArray(item.subservicos) && item.subservicos.length > 0) {
              desc += item.subservicos.join(', ')
            } else {
              desc += 'Serviços técnicos de ' + item.disciplina
            }
            desc += '.\nItem do escopo: ' + item.descricao
            novaEtapa.set('descricao', desc)

            if (item.area) {
              novaEtapa.set('area', item.area)
            }

            $app.save(novaEtapa)

            if (item.record) {
              try {
                item.record.set('etapa_gerada', novaEtapa.id)
                $app.save(item.record)
              } catch (_) {}
            }

            if (item.area) {
              try {
                const entregaveisPadrao = $app.findRecordsByFilter(
                  'entregaveis_padrao',
                  "area = '" + item.area + "' && ativo = true",
                  'ordem',
                  30,
                  0,
                )
                for (let ep = 0; ep < entregaveisPadrao.length; ep++) {
                  try {
                    const novoEntregavel = new Record(entregaveisCol)
                    novoEntregavel.set('etapa', novaEtapa.id)
                    novoEntregavel.set('nome', entregaveisPadrao[ep].getString('nome'))
                    novoEntregavel.set('versao', 'v1.0')
                    novoEntregavel.set('status', 'pendente')
                    novoEntregavel.set(
                      'descricao',
                      entregaveisPadrao[ep].getString('descricao') ||
                        'Entregável técnico padrão da disciplina ' + item.disciplina,
                    )
                    $app.save(novoEntregavel)
                  } catch (_) {}
                }
              } catch (_) {}
            }
          }
        } catch (errEtapaPrj) {
          console.log('Erro ao criar etapas para o projeto do item: ' + errEtapaPrj)
        }
      }

      if (projetosGerados.length > 0) {
        try {
          rec.set('projeto', projetosGerados[0].id)
          $app.save(rec)
        } catch (_) {}
      }

      // 5. CONTAS A RECEBER
      try {
        const projetoRefId = projetosGerados.length > 0 ? projetosGerados[0].id : null
        let filtroContas = "tipo = 'receber' && (descricao ~ 'Contrato " + contratoNumero + "'"
        if (propostaId) {
          filtroContas += " || proposta = '" + propostaId + "'"
        }
        filtroContas += ')'
        const contasExistentes = $app.findRecordsByFilter('contas', filtroContas, '-created', 1, 0)

        if (contasExistentes.length === 0) {
          let parcelas = []
          if (propostaId) {
            try {
              parcelas = $app.findRecordsByFilter(
                'proposta_parcelas',
                "proposta = '" + propostaId + "'",
                'ordem',
                50,
                0,
              )
            } catch (_) {}
          }

          if (parcelas && parcelas.length > 0) {
            for (let i = 0; i < parcelas.length; i++) {
              const parc = parcelas[i]
              const ordem = parc.getInt('ordem') || i + 1
              const perc = parc.getFloat('percentual') || 0
              const valorParc = parc.getFloat('valor') || (valorTotalContrato * perc) / 100
              const descParc = parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
              const gatilho = parc.getString('gatilho') || 'marco'

              const novaConta = new Record(contasCol)
              novaConta.set('tipo', 'receber')
              if (projetoRefId) novaConta.set('projeto', projetoRefId)
              if (propostaId) novaConta.set('proposta', propostaId)
              novaConta.set(
                'descricao',
                'Contrato ' +
                  contratoNumero +
                  ' — Parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' (' +
                  perc +
                  '% - ' +
                  descParc +
                  ')' +
                  (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
              )
              novaConta.set('valor', valorParc)
              novaConta.set('status', 'rascunho')
              novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
              novaConta.set('bloqueada_por_fechamento', false)

              if (requerNotaProposta && aliquotaImpostos > 0) {
                const retencao =
                  Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) /
                  100
                novaConta.set('retencao_impostos', retencao)
                novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
              } else {
                novaConta.set('retencao_impostos', 0)
                novaConta.set('valor_liquido', valorParc)
              }

              const diasVenc = i === 0 ? 15 : (i + 1) * 30
              const dataVenc = new Date()
              dataVenc.setDate(dataVenc.getDate() + diasVenc)
              novaConta.set(
                'vencimento',
                dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )

              $app.save(novaConta)

              try {
                const aRec = new Record(auditCol)
                aRec.set('user', null)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
                aRec.set('entidade', 'contas')
                aRec.set('registro_id', novaConta.id)
                aRec.set('detalhes', {
                  origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                  mensagem:
                    'Conta a receber da parcela ' +
                    ordem +
                    '/' +
                    parcelas.length +
                    ' gerada por assinatura do Contrato ' +
                    contratoNumero,
                  ordem: ordem,
                  percentual: perc,
                  valor: valorParc,
                  gatilho: gatilho,
                  projeto_id: projetoRefId,
                  contrato_id: contratoId,
                  contrato_numero: contratoNumero,
                })
                $app.save(aRec)
              } catch (_) {}
            }
          } else {
            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoRefId) novaConta.set('projeto', projetoRefId)
            if (propostaId) novaConta.set('proposta', propostaId)
            novaConta.set(
              'descricao',
              'Recebimento integral do Contrato Assinado ' +
                contratoNumero +
                (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorTotalContrato)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNotaProposta && aliquotaImpostos > 0) {
              const retencao =
                Math.round(
                  ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
                ) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set(
                'valor_liquido',
                Math.round((valorTotalContrato - retencao) * 100) / 100,
              )
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorTotalContrato)
            }

            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + 30)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaConta)

            try {
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
                valor: valorTotalContrato,
                projeto_id: projetoRefId,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (errContas) {
        console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
      }

      // Auditoria geral Bloco 4
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA')
        aRec.set('acao', 'ATIVACAO_BLOCO4_CONTRATO_ASSINADO')
        aRec.set('entidade', 'contratos_servico')
        aRec.set('registro_id', contratoId)
        aRec.set('detalhes', {
          origem: 'SISTEMA / GATILHO AUTOMÁTICO',
          mensagem:
            'Contrato ' +
            contratoNumero +
            ' assinado bilateralmente. 1 Grupo de Projetos (' +
            (grupoCriado ? grupoCriado.getString('codigo') : 'GPR') +
            ') e ' +
            projetosGerados.length +
            ' projeto(s) gerado(s) com sucesso.',
          contrato_numero: contratoNumero,
          grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
          total_projetos: projetosGerados.length,
          codigos_projetos: projetosGerados.map((p) => p.getString('codigo')),
          valor_total: valorTotalContrato,
        })
        $app.save(aRec)
      } catch (_) {}

      // Promoção
      if (empresaId) {
        try {
          const empresa = $app.findRecordById('empresas', empresaId)
          if (empresa) {
            const etapaAtual = empresa.getString('etapa_funil')
            const eraPreCadastro = empresa.getBool('pre_cadastro')

            let houveMudanca = false
            if (eraPreCadastro) {
              empresa.set('pre_cadastro', false)
              houveMudanca = true
            }

            if (etapaAtual !== 'parceira') {
              empresa.set('etapa_anterior', etapaAtual)
              empresa.set('etapa_funil', 'parceira')
              empresa.set('status', 'ativa')
              houveMudanca = true
            }

            if (houveMudanca) {
              empresa.set(
                'observacoes',
                (empresa.getString('observacoes') || '') +
                  '\n[Efetivação por Contrato Assinado]: Contrato ' +
                  contratoNumero +
                  ' assinado em ' +
                  new Date().toISOString() +
                  (eraPreCadastro ? ' (pré-cadastro promovido a definitivo)' : ''),
              )
              $app.save(empresa)

              try {
                const auditCol = $app.findCollectionByNameOrId('audit_logs')
                const aRec = new Record(auditCol)
                aRec.set('user', null)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'CONVERSAO_EM_PARCEIRA')
                aRec.set('entidade', 'empresas')
                aRec.set('registro_id', empresaId)
                aRec.set('detalhes', {
                  origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                  mensagem:
                    'Empresa convertida para Parceira pela assinatura do Contrato ' +
                    contratoNumero,
                  contrato_numero: contratoNumero,
                  proposta_numero: propostaNumero,
                })
                $app.save(aRec)
              } catch (_) {}
            }
          }
        } catch (errEmp) {
          console.log('Erro ao converter empresa em parceira por contrato: ' + errEmp)
        }
      }

      if (clientePfId) {
        try {
          const clientePf = $app.findRecordById('clientes_pf', clientePfId)
          if (clientePf && clientePf.getBool('pre_cadastro')) {
            clientePf.set('pre_cadastro', false)
            clientePf.set(
              'observacoes',
              (clientePf.getString('observacoes') || '') +
                '\n[Efetivação por Contrato Assinado]: Contrato ' +
                contratoNumero +
                ' assinado em ' +
                new Date().toISOString() +
                ' (promovido a cliente definitivo)',
            )
            $app.save(clientePf)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'PROMOCAO_CLIENTE_CONTRATO')
              aRec.set('entidade', 'clientes_pf')
              aRec.set('registro_id', clientePfId)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                tipo: 'pf',
                mensagem:
                  'Cliente PF promovido de pré-cadastro a definitivo pela assinatura do Contrato ' +
                  contratoNumero,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        } catch (errPf) {
          console.log('Erro ao promover cliente PF por contrato: ' + errPf)
        }
      }
    }

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

      // Bloquear se o contrato ainda estiver aguardando dados do cliente
      if (contrato.getString('status') === 'aguardando_dados_cliente') {
        return e.json(400, {
          message:
            'Não é possível assinar o contrato: os dados cadastrais do cliente ainda estão incompletos.',
        })
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

      const assinadoBilateralmente = Boolean(contrato.getString('data_assinatura_cliente'))
      if (assinadoBilateralmente) {
        contrato.set('status', 'assinado')
      } else {
        contrato.set('status', 'aguardando_assinatura_cliente')
      }

      $app.save(contrato)

      // Ativação explícita do contrato quando assinado bilateralmente
      if (assinadoBilateralmente) {
        try {
          ativarContratoServicoBilateral(contrato)
        } catch (errAtiv) {
          console.log('Erro ao ativar contrato assinado (assinar-admin): ' + errAtiv)
        }
      }

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
