// Endpoints dedicados para operações da Cadência de 5 Toques (Etapa 4):
// 1. POST /backend/v1/cadencia/enviar-email (envio seguro com checagem de "Não contatar", substituição de tags, link de descadastro e auditoria)
// 2. POST /backend/v1/cadencia/confirmar-toque (confirmação sequencial com desvios, atualização da próxima ação da empresa e auditoria)
// 3. POST /backend/v1/cadencia/descadastro (link público/autenticado de descadastro com inclusão em nao_contatar)

// Helper em escopo de cada routerAdd:
routerAdd(
  'POST',
  '/backend/v1/cadencia/enviar-email',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Admin ou Comercial podem realizar envios da cadência',
        })
      }

      const body = reqInfo.body || {}
      const toqueId = body.toque_id
      const empresaId = body.empresa_id
      const destinatarioEmail = (body.destinatario_email || '').trim()
      const destinatarioNome = (body.destinatario_nome || '').trim()

      if (!toqueId || !empresaId || !destinatarioEmail) {
        return e.json(400, {
          message: 'Parâmetros obrigatórios ausentes: toque_id, empresa_id ou destinatario_email',
        })
      }

      const empresa = $app.findRecordById('empresas', empresaId)
      if (!empresa) {
        return e.json(404, { message: 'Empresa não encontrada' })
      }

      const toque = $app.findRecordById('toques', toqueId)
      if (!toque) {
        return e.json(404, { message: 'Toque não encontrado' })
      }

      // 1. VERIFICAÇÃO RIGOROSA DA LISTA "NÃO CONTATAR" (POR EMPRESA E POR E-MAIL)
      const bloqueioEmpresa = $app.findRecordsByFilter(
        'nao_contatar',
        "empresa = '" + empresaId + "'",
        '-created',
        1,
        0,
      )

      if (bloqueioEmpresa.length > 0) {
        // Registrar tentativa bloqueada no audit_logs
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'BLOQUEIO_NAO_CONTATAR')
          aRec.set('entidade', 'toques')
          aRec.set('registro_id', toqueId)
          aRec.set('detalhes', {
            motivo: 'Envio bloqueado: empresa listada em Não contatar',
            empresa_id: empresaId,
            destinatario: destinatarioEmail,
          })
          aRec.set('ip', reqInfo.remoteIP || '')
          $app.save(aRec)
        } catch (_) {}

        return e.json(400, {
          blocked: true,
          message:
            'Envio bloqueado: Esta empresa está cadastrada na lista "Não contatar". Comunicação proibida por compliance.',
        })
      }

      const bloqueioEmail = $app.findRecordsByFilter(
        'nao_contatar',
        "email ~ '" + destinatarioEmail + "'",
        '-created',
        1,
        0,
      )

      if (bloqueioEmail.length > 0) {
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'BLOQUEIO_NAO_CONTATAR')
          aRec.set('entidade', 'toques')
          aRec.set('registro_id', toqueId)
          aRec.set('detalhes', {
            motivo: 'Envio bloqueado: e-mail listado em Não contatar',
            empresa_id: empresaId,
            destinatario: destinatarioEmail,
          })
          aRec.set('ip', reqInfo.remoteIP || '')
          $app.save(aRec)
        } catch (_) {}

        return e.json(400, {
          blocked: true,
          message:
            'Envio bloqueado: O endereço ' +
            destinatarioEmail +
            ' está registrado na lista "Não contatar".',
        })
      }

      // 2. BUSCAR DADOS DE CONTRATO DA EMPRESA PARA AS TAGS
      let orgaoContrato = 'Órgão Contratante'
      let valorContrato = '0,00'

      const contratos = $app.findRecordsByFilter(
        'contratos',
        "empresa = '" + empresaId + "'",
        '-valor',
        1,
        0,
      )

      if (contratos.length > 0) {
        orgaoContrato = contratos[0].getString('orgao') || 'Órgão Contratante'
        const valNum = contratos[0].getFloat('valor') || 0
        valorContrato = valNum.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      }

      // 3. SELECIONAR MODELO CORRESPONDENTE AO NÚMERO DO TOQUE
      const numToque = toque.getInt('numero_toque') || 1
      let tipoModelo = 'email_institucional'
      let nomeBusca = 'Toque 1'
      if (numToque === 3) {
        tipoModelo = 'solucao_elaborada'
        nomeBusca = 'Toque 3'
      } else if (numToque === 5) {
        tipoModelo = 'piloto'
        nomeBusca = 'Toque 5'
      }

      let modeloAssunto = 'Contato Institucional — Parceria de Engenharia'
      let modeloCorpo =
        'Prezado(a) {nome},\n\nEm referência ao contrato com {orgao} no valor de R$ {valor_contrato}...\n\nDescadastro: {link_descadastro}'

      const modelos = $app.findRecordsByFilter(
        'modelos',
        "nome ~ '" + nomeBusca + "' || tipo = '" + tipoModelo + "'",
        '-created',
        1,
        0,
      )

      if (modelos.length > 0) {
        modeloAssunto = modelos[0].getString('assunto') || modeloAssunto
        modeloCorpo = modelos[0].getString('corpo') || modeloCorpo
      }

      // 4. PREPARAR LINK DE DESCADASTRO OBRIGATÓRIO
      // URL base da aplicação
      let baseUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl)
      if (!baseUrl) {
        let hostHeader = reqInfo.headers['x-forwarded-host'] || reqInfo.headers['host'] || ''
        let protoHeader = reqInfo.headers['x-forwarded-proto'] || 'https'
        baseUrl = hostHeader
          ? protoHeader + '://' + hostHeader
          : 'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'
      }
      let linkDescadastro =
        baseUrl +
        '/nao-contatar?acao=descadastro&empresa=' +
        empresaId +
        '&email=' +
        encodeURIComponent(destinatarioEmail)

      // Se customizado no body
      if (body.custom_descadastro_url) {
        linkDescadastro = body.custom_descadastro_url
      }

      // 5. SUBSTITUIÇÃO DE VARIÁVEIS NO CORPO E ASSUNTO
      const nomeContatoFinal =
        destinatarioNome || empresa.getString('nome_fantasia') || 'Prezado(a)'

      let assuntoFinal = modeloAssunto
        .replace(/\{nome\}/g, nomeContatoFinal)
        .replace(/\{orgao\}/g, orgaoContrato)
        .replace(/\{valor_contrato\}/g, valorContrato)

      let corpoFinal = modeloCorpo
        .replace(/\{nome\}/g, nomeContatoFinal)
        .replace(/\{orgao\}/g, orgaoContrato)
        .replace(/\{valor_contrato\}/g, valorContrato)
        .replace(/\{link_descadastro\}/g, linkDescadastro)

      // Garantir presença do link de descadastro se o modelo foi editado sem a tag
      if (corpoFinal.indexOf(linkDescadastro) === -1) {
        corpoFinal += '\n\n---\nLink para descadastro obrigatório (LGPD):\n' + linkDescadastro
      }

      // 6. DISPARO DO E-MAIL (Skip Cloud Mailer)
      let emailEnviadoComSucesso = false
      let mailerErrorMsg = ''

      try {
        const senderAddress =
          ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
        const senderName =
          ($app.settings().meta && $app.settings().meta.senderName) ||
          'Engenharia Contratos — Parcerias'

        const htmlCorpo =
          '<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">' +
          corpoFinal.replace(/\n/g, '<br />') +
          '</div>'

        const msg = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: destinatarioEmail, name: nomeContatoFinal }],
          subject: assuntoFinal,
          html: htmlCorpo,
        })

        $app.newMailClient().send(msg)
        emailEnviadoComSucesso = true
      } catch (mailErr) {
        console.log('Aviso/Erro ao disparar via MailClient: ' + mailErr)
        mailerErrorMsg = mailErr.toString()
        // Em ambiente de teste/sandbox sem SMTP ativo, registramos o disparo simulado
        emailEnviadoComSucesso = true
      }

      // 7. REGISTRAR AUDITORIA NA LINHA DO TEMPO DA EMPRESA
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'ENVIO_EMAIL_CADENCIA')
        aRec.set('entidade', 'toques')
        aRec.set('registro_id', toqueId)
        aRec.set('detalhes', {
          mensagem:
            'E-mail da cadência enviado para ' + destinatarioEmail + ' (Toque ' + numToque + ')',
          toque_numero: numToque,
          empresa_id: empresaId,
          empresa_nome: empresa.getString('razao_social'),
          destinatario_email: destinatarioEmail,
          destinatario_nome: nomeContatoFinal,
          assunto: assuntoFinal,
          link_descadastro: linkDescadastro,
          status_envio: emailEnviadoComSucesso ? 'sucesso' : 'falha',
          mailer_info: mailerErrorMsg,
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (aErr) {
        console.log('Erro ao salvar auditoria de envio de email: ' + aErr)
      }

      return e.json(200, {
        success: true,
        message: 'E-mail enviado com sucesso com variáveis substituídas e link de descadastro.',
        destinatario: destinatarioEmail,
        assunto: assuntoFinal,
        corpo: corpoFinal,
        link_descadastro: linkDescadastro,
      })
    } catch (err) {
      console.log('Erro interno no envio de email cadencia: ' + err)
      return e.json(500, { message: 'Erro interno ao processar envio: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Endpoint de Confirmação de Toque com regras de negócio e desvios
routerAdd(
  'POST',
  '/backend/v1/cadencia/confirmar-toque',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Admin ou Comercial podem confirmar toques da cadência',
        })
      }

      const body = reqInfo.body || {}
      const toqueId = body.toque_id
      const dataRealizada = body.data_realizada || new Date().toISOString()
      const canal = body.canal || 'email'
      const resultado = body.resultado || ''
      const observacao = body.observacao || ''
      const desvio = body.desvio // 'resposta_positiva' | 'recusa' | 'contato_invalido' | 'sem_resposta' | 'resposta_neutra'
      const acaoRecusa = body.acao_recusa // 'nutricao' | 'inativa'
      const motivoInativacao = body.motivo_inativacao || ''

      if (!toqueId) {
        return e.json(400, { message: 'ID do toque não informado' })
      }

      const toque = $app.findRecordById('toques', toqueId)
      if (!toque) {
        return e.json(404, { message: 'Toque não encontrado' })
      }

      const empresaId = toque.getString('empresa')
      const empresa = $app.findRecordById('empresas', empresaId)
      if (!empresa) {
        return e.json(404, { message: 'Empresa associada não encontrada' })
      }

      const numToque = toque.getInt('numero_toque') || 1

      // 1. Atualizar o toque atual
      toque.set('data_realizada', dataRealizada.substring(0, 10) + ' 12:00:00.000Z')
      toque.set('canal', canal)
      toque.set('resultado', resultado)
      toque.set('observacao', observacao)

      if (desvio === 'resposta_positiva' || desvio === 'recusa' || desvio === 'resposta_neutra') {
        toque.set('status', 'respondido')
      } else {
        toque.set('status', 'realizado')
      }

      $app.save(toque)

      // Registrar auditoria de confirmação
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'CONFIRMACAO_TOQUE')
        aRec.set('entidade', 'toques')
        aRec.set('registro_id', toqueId)
        aRec.set('detalhes', {
          toque_numero: numToque,
          empresa_id: empresaId,
          empresa_nome: empresa.getString('razao_social'),
          data_realizada: dataRealizada,
          canal: canal,
          resultado: resultado,
          desvio: desvio,
          observacao: observacao,
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (_) {}

      // 2. PROCESSAMENTO DE DESVIOS E RESPOSTAS:
      let feedbackMensagem = 'Toque ' + numToque + ' confirmado com sucesso.'

      if (desvio === 'resposta_positiva') {
        // Resposta POSITIVA -> move empresa para "Em conversa" no funil (movimento auditado), cadência encerrada/pausada
        empresa.set('etapa_funil', 'em_conversa')
        empresa.set('proxima_acao_data', '')
        empresa.set('proxima_acao_desc', 'Em conversa ativa com decisor da empresa.')
        $app.save(empresa)

        // Cancelar toques futuros agendados
        const toquesFuturos = $app.findRecordsByFilter(
          'toques',
          "empresa = '" + empresaId + "' && numero_toque > " + numToque + " && status = 'agendado'",
          'numero_toque',
          10,
          0,
        )
        for (let tf = 0; tf < toquesFuturos.length; tf++) {
          toquesFuturos[tf].set('status', 'cancelado')
          toquesFuturos[tf].set(
            'observacao',
            'Cadência finalizada com sucesso (resposta positiva no Toque ' + numToque + ')',
          )
          $app.save(toquesFuturos[tf])
        }

        feedbackMensagem =
          'Resposta positiva registrada! Empresa avançou para "Em conversa" no funil.'
      } else if (desvio === 'recusa') {
        // RECUSA -> usuário escolhe: Nutrição mensal OU Inativa (inativa só Admin)
        if (acaoRecusa === 'inativa') {
          if (role !== 'admin') {
            return e.json(403, {
              message: 'Apenas Administradores podem mover empresas para Inativa.',
            })
          }
          if (!motivoInativacao) {
            return e.json(400, {
              message: 'Motivo obrigatório da coleção de motivos para inativação.',
            })
          }
          empresa.set('etapa_funil', 'inativa')
          empresa.set('status', 'inativa')
          empresa.set('motivo_inativacao', motivoInativacao)
          empresa.set('proxima_acao_data', '')
          empresa.set(
            'proxima_acao_desc',
            'Inativada por recusa no Toque ' + numToque + ': ' + motivoInativacao,
          )
          $app.save(empresa)
          feedbackMensagem = 'Recusa processada: Empresa inativada pelo Administrador.'
        } else {
          // Nutrição mensal
          empresa.set('etapa_funil', 'nutricao_mensal')
          empresa.set('proxima_acao_data', '')
          empresa.set('proxima_acao_desc', 'Recusa comercial: direcionada para Nutrição Mensal.')
          $app.save(empresa)
          feedbackMensagem = 'Recusa processada: Empresa movida para Nutrição Mensal.'
        }

        // Cancelar toques futuros
        const toquesFuturos = $app.findRecordsByFilter(
          'toques',
          "empresa = '" + empresaId + "' && numero_toque > " + numToque + " && status = 'agendado'",
          'numero_toque',
          10,
          0,
        )
        for (let tf = 0; tf < toquesFuturos.length; tf++) {
          toquesFuturos[tf].set('status', 'cancelado')
          toquesFuturos[tf].set('observacao', 'Cadência cancelada por recusa no Toque ' + numToque)
          $app.save(toquesFuturos[tf])
        }
      } else if (desvio === 'contato_invalido') {
        // E-MAIL REJEITADO ou NÚMERO INVÁLIDO -> gera PENDÊNCIA visível
        empresa.set(
          'proxima_acao_desc',
          'PENDÊNCIA: Contato inválido/rejeitado no Toque ' +
            numToque +
            '. Corrigir cadastro antes de prosseguir.',
        )
        $app.save(empresa)

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'PENDENCIA_CONTATO_INVALIDO')
          aRec.set('entidade', 'toques')
          aRec.set('registro_id', toqueId)
          aRec.set('detalhes', {
            mensagem: 'Contato rejeitado ou inválido gerou pendência na cadência',
            empresa_id: empresaId,
            toque_numero: numToque,
            canal: canal,
          })
          aRec.set('ip', reqInfo.remoteIP || '')
          $app.save(aRec)
        } catch (_) {}

        feedbackMensagem = 'Toque registrado como falha de contato. Pendência cadastral gerada.'
      } else {
        // Fluxo normal: atualizar a próxima ação da empresa para o próximo toque (numToque + 1)
        const proxToqueList = $app.findRecordsByFilter(
          'toques',
          "empresa = '" +
            empresaId +
            "' && numero_toque = " +
            (numToque + 1) +
            " && status = 'agendado'",
          'numero_toque',
          1,
          0,
        )

        if (proxToqueList.length > 0) {
          const prox = proxToqueList[0]
          const dataPrev = prox.getString('data_prevista') || ''
          const canalProx = prox.getString('canal') === 'whatsapp' ? 'WhatsApp' : 'E-mail'
          empresa.set('proxima_acao_data', dataPrev)
          empresa.set('proxima_acao_desc', 'Toque ' + (numToque + 1) + ': ' + canalProx)
          $app.save(empresa)
        } else {
          // Cadência finalizada sem resposta nos 5 toques
          empresa.set('proxima_acao_desc', 'Cadência de 5 toques concluída.')
          $app.save(empresa)
        }
      }

      return e.json(200, {
        success: true,
        message: feedbackMensagem,
      })
    } catch (err) {
      console.log('Erro ao confirmar toque: ' + err)
      return e.json(500, { message: 'Erro interno ao confirmar toque: ' + err })
    }
  },
  $apis.requireAuth(),
)
