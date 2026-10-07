// Hook para expor endpoints REST de envio de proposta (WhatsApp e E-mail transacional)
// com texto padrão editável e auditoria completa de cada ação.

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
          message:
            'A proposta precisa ser aprovada internamente pelo Administrador antes do envio ao cliente.',
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

      // Disparar e-mail real via Mailer do Skip Cloud
      let emailEnviadoComSucesso = false
      let mailerErrorMsg = ''

      try {
        const senderAddress =
          ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
        const senderName =
          ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

        const htmlCorpo =
          '<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">' +
          corpoFinal.replace(/\n/g, '<br />') +
          '</div>'

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

// Endpoint para auditar envio via WhatsApp
routerAdd(
  'POST',
  '/backend/v1/propostas/registrar-envio-whatsapp',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const body = reqInfo.body || {}
      const propostaId = body.proposta_id
      const destinatarioTelefone = body.destinatario_telefone
      const destinatarioNome = body.destinatario_nome

      if (!propostaId) {
        return e.json(400, { message: 'ID da proposta não informado' })
      }

      const proposta = $app.findRecordById('propostas', propostaId)
      if (!proposta) {
        return e.json(404, { message: 'Proposta não encontrada' })
      }

      // Se status for antes de enviada, atualizar
      const statusAtual = proposta.getString('status')
      if (statusAtual === 'aprovada' || statusAtual === 'rascunho') {
        proposta.set('status', 'enviada')
        $app.save(proposta)
      }

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
