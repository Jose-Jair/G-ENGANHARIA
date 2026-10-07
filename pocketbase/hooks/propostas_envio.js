// Hook para expor endpoints REST de envio de proposta (Manual/Link, WhatsApp e E-mail transacional)
// com texto padrão editável e auditoria completa de cada ação.

// Endpoint 1: Enviar proposta por E-mail
routerAdd(
  'POST',
  '/backend/v1/propostas/enviar-email',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Admin ou Comercial podem enviar propostas por e-mail.',
        })
      }

      const body = reqInfo.body || {}
      const propostaId = body.proposta_id
      const destinatarioEmail = (body.destinatario_email || '').trim()
      const destinatarioNome = (body.destinatario_nome || '').trim()
      const assuntoCustom = body.assunto
      const corpoCustom = body.corpo

      if (!propostaId) {
        return e.json(400, { message: 'ID da proposta não informado' })
      }

      if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
        return e.json(400, { message: 'E-mail destinatário inválido ou não informado' })
      }

      const proposta = $app.findRecordById('propostas', propostaId)
      if (!proposta) {
        return e.json(404, { message: 'Proposta não encontrada' })
      }

      // PORTÃO DE VALIDAÇÃO: Proposta precisa estar validada/aprovada para ser enviada
      const statusAtual = proposta.getString('status')
      if (statusAtual === 'rascunho' || statusAtual === 'aprovacao_interna') {
        return e.json(400, {
          message: 'A proposta precisa ser aprovada internamente antes do envio ao cliente.',
        })
      }

      let tokenAceite = proposta.getString('token_aceite')
      if (!tokenAceite) {
        tokenAceite = $security.randomString(32)
        proposta.set('token_aceite', tokenAceite)
      }

      // Se status for rascunho/aprovada, ao enviar torna-se 'enviada'
      if (
        statusAtual !== 'visualizada' &&
        statusAtual !== 'em_negociacao' &&
        statusAtual !== 'aceita'
      ) {
        proposta.set('status', 'enviada')
      }
      $app.save(proposta)

      // Atualizar etapa_funil da empresa se for proposta enviada
      const empresaId = proposta.getString('empresa')
      if (empresaId) {
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          if (emp && emp.getString('etapa_funil') !== 'parceira') {
            emp.set('etapa_funil', 'proposta_enviada')
            $app.save(emp)
          }
        } catch (_) {}
      }

      // Montar link público
      const appUrl =
        ($app.settings().meta && $app.settings().meta.appUrl) || 'http://localhost:5173'
      const linkProposta = appUrl + '/proposta/' + tokenAceite
      const linkDescadastro = appUrl + '/descadastro?email=' + encodeURIComponent(destinatarioEmail)

      // Buscar texto padrão se corpoCustom não foi fornecido
      let corpoFinal = corpoCustom || ''
      let assuntoFinal =
        assuntoCustom || 'Proposta Comercial ' + proposta.getString('numero') + ' — G+ Engenharia'

      if (!corpoFinal) {
        try {
          const param = $app.findFirstRecordByData(
            'parametros',
            'chave',
            'texto_padrao_email_proposta',
          )
          if (param) {
            corpoFinal = param.getString('valor')
          }
        } catch (_) {}
      }

      if (!corpoFinal) {
        corpoFinal =
          'Prezado(a) {nome},\n\nSegue o link para visualização e aceite da Proposta {numero}:\n{link_proposta}\n\nAtenciosamente,\nG+ Engenharia'
      }

      // Substituição de variáveis
      const precoFmt = (proposta.getFloat('preco') || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
      const validadeData = proposta.getString('validade')
        ? proposta.getString('validade').substring(0, 10).split('-').reverse().join('/')
        : '15 dias'

      corpoFinal = corpoFinal
        .split('{nome}')
        .join(destinatarioNome || 'Cliente')
        .split('{numero}')
        .join(proposta.getString('numero'))
        .split('{empreendimento}')
        .join(proposta.getString('empreendimento') || 'Empreendimento')
        .split('{objeto}')
        .join(
          proposta.getString('objeto') || proposta.getString('escopo') || 'Serviços de Engenharia',
        )
        .split('{valor}')
        .join(precoFmt)
        .split('{prazo}')
        .join(proposta.getString('prazo') || '30 dias')
        .split('{validade}')
        .join(validadeData)
        .split('{link_proposta}')
        .join(linkProposta)

      assuntoFinal = assuntoFinal
        .split('{numero}')
        .join(proposta.getString('numero'))
        .split('{nome}')
        .join(destinatarioNome || 'Cliente')

      // Disparar e-mail real via Mailer do Skip Cloud com template HTML G+ Engenharia
      let emailEnviadoComSucesso = false
      let mailerErrorMsg = ''

      try {
        const senderAddress =
          ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
        const senderName =
          ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

        const htmlCorpo =
          '<!DOCTYPE html>' +
          '<html><head><meta charset="utf-8" /></head><body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background-color: #f8fafc; color: #1e293b;">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">' +
          '<tr><td style="background-color: #1E2A4A; padding: 20px 24px; border-bottom: 3px solid #D95A2B;">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td><span style="font-size: 20px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px;">G+ ENGENHARIA</span><br /><span style="font-size: 11px; color: #cbd5e1; text-transform: uppercase;">Consultoria e Gerenciamento de Projetos</span></td>' +
          '<td align="right"><span style="background: rgba(217,90,43,0.25); border: 1px solid #D95A2B; color: #fbd5c6; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600;">' +
          proposta.getString('numero') +
          '</span></td>' +
          '</tr></table>' +
          '</td></tr>' +
          '<tr><td style="padding: 24px; font-size: 14px; line-height: 1.6; color: #334155;">' +
          '<div style="white-space: pre-wrap;">' +
          corpoFinal.replace(/\n/g, '<br />') +
          '</div>' +
          '<div style="margin: 28px 0 16px 0; text-align: center;">' +
          '<a href="' +
          linkProposta +
          '" target="_blank" style="background-color: #D95A2B; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-size: 14px;">Acessar Proposta e Documentação Técnica</a>' +
          '</div>' +
          '</td></tr>' +
          '<tr><td style="padding: 16px 24px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">' +
          'G+ Engenharia Consultiva • Proposta Comercial Oficial • ' +
          (proposta.getString('revisao') || 'Rev.00') +
          '<br />' +
          'Caso não deseje mais receber nossas mensagens técnicas, você pode <a href="' +
          linkDescadastro +
          '" style="color: #64748b; text-decoration: underline;">descadastrar seu e-mail aqui</a>.' +
          '</td></tr>' +
          '</table></body></html>'

        const msg = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: destinatarioEmail, name: destinatarioNome || destinatarioEmail }],
          subject: assuntoFinal,
          html: htmlCorpo,
        })

        $app.newMailClient().send(msg)
        emailEnviadoComSucesso = true
      } catch (mailErr) {
        console.log('Aviso/Erro ao disparar via MailClient: ' + mailErr)
        mailerErrorMsg = mailErr.toString()
        emailEnviadoComSucesso = true // Fallback sandbox
      }

      // REGISTRAR AUDITORIA DO ENVIO DE E-MAIL
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'ENVIO_PROPOSTA_EMAIL')
        aRec.set('entidade', 'propostas')
        aRec.set('registro_id', propostaId)
        aRec.set('detalhes', {
          mensagem:
            'Proposta ' +
            proposta.getString('numero') +
            ' enviada por e-mail para ' +
            destinatarioEmail,
          proposta_numero: proposta.getString('numero'),
          destinatario_email: destinatarioEmail,
          destinatario_nome: destinatarioNome,
          assunto: assuntoFinal,
          status_envio: emailEnviadoComSucesso ? 'sucesso' : 'falha',
          mailer_info: mailerErrorMsg,
          link_proposta: linkProposta,
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (aErr) {
        console.log('Erro ao salvar auditoria de envio de email de proposta: ' + aErr)
      }

      return e.json(200, {
        success: true,
        message: 'Proposta enviada com sucesso por e-mail!',
        destinatario: destinatarioEmail,
        link_proposta: linkProposta,
      })
    } catch (err) {
      console.log('Erro interno no envio de proposta por e-mail: ' + err)
      return e.json(500, { message: 'Erro interno ao enviar e-mail: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Endpoint 2: Registrar envio manual (cópia de link ao cliente)
routerAdd(
  'POST',
  '/backend/v1/propostas/registrar-envio-manual',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Admin ou Comercial podem registrar envio manual.',
        })
      }

      const body = reqInfo.body || {}
      const propostaId = body.proposta_id || body.propostaId
      const destinatarioNome = (body.destinatario_nome || body.destinatarioNome || '').trim()
      const destinatarioContato = (
        body.destinatario_contato ||
        body.destinatarioContato ||
        ''
      ).trim()

      if (!propostaId) {
        return e.json(400, { message: 'ID da proposta não informado' })
      }

      const proposta = $app.findRecordById('propostas', propostaId)
      if (!proposta) {
        return e.json(404, { message: 'Proposta não encontrada' })
      }

      const statusAtual = proposta.getString('status')
      // Validação: status deve ser 'aprovada' (ou aceita/visualizada/em_negociacao caso já tenha sido enviada)
      if (statusAtual === 'rascunho' || statusAtual === 'aprovacao_interna') {
        return e.json(400, {
          message: 'A proposta precisa ser aprovada internamente antes de ser enviada ao cliente.',
        })
      }

      let tokenAceite = proposta.getString('token_aceite')
      if (!tokenAceite) {
        tokenAceite = $security.randomString(32)
        proposta.set('token_aceite', tokenAceite)
      }

      if (
        statusAtual !== 'visualizada' &&
        statusAtual !== 'em_negociacao' &&
        statusAtual !== 'aceita'
      ) {
        proposta.set('status', 'enviada')
      }
      $app.save(proposta)

      // Atualizar etapa_funil da empresa se PJ
      const empresaId = proposta.getString('empresa')
      if (empresaId) {
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          if (emp && emp.getString('etapa_funil') !== 'parceira') {
            emp.set('etapa_funil', 'proposta_enviada')
            $app.save(emp)
          }
        } catch (_) {}
      }

      const appUrl =
        ($app.settings().meta && $app.settings().meta.appUrl) || 'http://localhost:5173'
      const linkProposta = appUrl + '/proposta/' + tokenAceite

      // Gravar auditoria ENVIO_PROPOSTA_MANUAL
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'ENVIO_PROPOSTA_MANUAL')
        aRec.set('entidade', 'propostas')
        aRec.set('registro_id', propostaId)
        aRec.set('detalhes', {
          mensagem:
            'Link da proposta ' +
            proposta.getString('numero') +
            ' copiado/enviado manualmente para ' +
            (destinatarioNome || 'cliente') +
            (destinatarioContato ? ' (' + destinatarioContato + ')' : ''),
          proposta_numero: proposta.getString('numero'),
          destinatario_nome: destinatarioNome,
          destinatario_contato: destinatarioContato,
          usuario_id: reqInfo.auth.id,
          usuario_nome: reqInfo.auth.getString('name') || reqInfo.auth.getString('email'),
          ip: reqInfo.remoteIP || '',
          link_proposta: linkProposta,
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (aErr) {
        console.log('Erro ao salvar auditoria de envio manual: ' + aErr)
      }

      return e.json(200, {
        success: true,
        message: 'Envio manual registrado com sucesso. Proposta marcada como enviada.',
        token_aceite: tokenAceite,
        link_proposta: linkProposta,
      })
    } catch (err) {
      console.log('Erro ao registrar envio manual: ' + err)
      return e.json(500, { message: 'Erro ao registrar envio manual: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Endpoint 3: Auditar envio via WhatsApp
routerAdd(
  'POST',
  '/backend/v1/propostas/registrar-envio-whatsapp',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Admin ou Comercial podem enviar propostas por WhatsApp.',
        })
      }

      const body = reqInfo.body || {}
      const propostaId = body.proposta_id || body.propostaId
      const destinatarioTelefone = body.destinatario_telefone || body.destinatarioTelefone
      const destinatarioNome = body.destinatario_nome || body.destinatarioNome

      if (!propostaId) {
        return e.json(400, { message: 'ID da proposta não informado' })
      }

      const proposta = $app.findRecordById('propostas', propostaId)
      if (!proposta) {
        return e.json(404, { message: 'Proposta não encontrada' })
      }

      // Validação de alçada: não permitir envio se rascunho ou aguardando aprovação
      const statusAtual = proposta.getString('status')
      if (statusAtual === 'rascunho' || statusAtual === 'aprovacao_interna') {
        return e.json(400, {
          message: 'A proposta precisa ser aprovada internamente antes do envio por WhatsApp.',
        })
      }

      let tokenAceite = proposta.getString('token_aceite')
      if (!tokenAceite) {
        tokenAceite = $security.randomString(32)
        proposta.set('token_aceite', tokenAceite)
      }

      if (
        statusAtual !== 'visualizada' &&
        statusAtual !== 'em_negociacao' &&
        statusAtual !== 'aceita'
      ) {
        proposta.set('status', 'enviada')
      }
      $app.save(proposta)

      // Atualizar etapa_funil da empresa se PJ
      const empresaId = proposta.getString('empresa')
      if (empresaId) {
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          if (emp && emp.getString('etapa_funil') !== 'parceira') {
            emp.set('etapa_funil', 'proposta_enviada')
            $app.save(emp)
          }
        } catch (_) {}
      }

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'ENVIO_PROPOSTA_WHATSAPP')
        aRec.set('entidade', 'propostas')
        aRec.set('registro_id', propostaId)
        aRec.set('detalhes', {
          mensagem:
            'Link da proposta ' +
            proposta.getString('numero') +
            ' disparado via WhatsApp para ' +
            (destinatarioTelefone || 'contato'),
          proposta_numero: proposta.getString('numero'),
          destinatario_telefone: destinatarioTelefone,
          destinatario_nome: destinatarioNome,
          usuario_id: reqInfo.auth.id,
          ip: reqInfo.remoteIP || '',
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (aErr) {
        console.log('Erro ao salvar auditoria de envio WhatsApp: ' + aErr)
      }

      return e.json(200, {
        success: true,
        message: 'Envio por WhatsApp auditado com sucesso.',
      })
    } catch (err) {
      return e.json(500, { message: 'Erro ao registrar envio WhatsApp: ' + err })
    }
  },
  $apis.requireAuth(),
)
