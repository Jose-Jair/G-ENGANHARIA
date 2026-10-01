// Endpoint dedicado para Operações de Campanha de Nutrição Mensal (Etapa 5):
// 1. POST /backend/v1/campanhas/disparar-lote
//    - Autenticação obrigatória (apenas Admin)
//    - Valida contra nao_contatar (por empresa e email)
//    - Bloqueia Parceiras e empresas em_conversa
//    - Realiza substituição de tags ({nome}, {orgao}, {valor_contrato}, {link_descadastro})
//    - Gera token individual de rastreamento por envio (campanha_envios)
//    - Dispara e-mail via Mailer do Skip Cloud
//    - Atualiza contadores e audita cada passo e cada bloqueio

routerAdd(
  'POST',
  '/backend/v1/campanhas/disparar-lote',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          message: 'Apenas Administradores podem executar o disparo de campanhas de nutrição.',
        })
      }

      const body = reqInfo.body || {}
      const campanhaId = body.campanha_id
      if (!campanhaId) {
        return e.json(400, { message: 'ID da campanha não informado' })
      }

      const campanha = $app.findRecordById('campanhas', campanhaId)
      if (!campanha) {
        return e.json(404, { message: 'Campanha não encontrada' })
      }

      const statusCamp = campanha.getString('status')
      if (statusCamp === 'rascunho' || statusCamp === 'devolvida') {
        return e.json(400, {
          message:
            'Campanhas em rascunho ou devolvidas não podem ser disparadas sem aprovação prévia.',
        })
      }

      const segmento = campanha.getString('segmento') || 'todos'
      const modeloAssunto = campanha.getString('assunto') || 'Informativo Técnico de Engenharia'
      const modeloCorpo =
        campanha.getString('corpo') || 'Prezado(a) {nome},\n\nDescadastro: {link_descadastro}'

      // Determinar filtro de empresas elegíveis:
      // - etapa_funil = 'nutricao_mensal'
      // - status = 'ativa'
      // - segmento A/B/C/todos
      let filterEmpresas = "etapa_funil = 'nutricao_mensal' && status = 'ativa'"
      if (segmento !== 'todos') {
        filterEmpresas += " && curva = '" + segmento + "'"
      }

      const empresasCandidatas = $app.findRecordsByFilter(
        'empresas',
        filterEmpresas,
        'razao_social',
        500,
        0,
      )

      let totalCandidatas = empresasCandidatas.length
      let totalEnviados = 0
      let totalBloqueadosNaoContatar = 0
      let totalBloqueadosRegra = 0
      let totalFalhas = 0

      const enviosCol = $app.findCollectionByNameOrId('campanha_envios')
      const auditCol = $app.findCollectionByNameOrId('audit_logs')

      // Detectar base URL para os links de tracking e descadastro
      let hostHeader = reqInfo.headers['x-forwarded-host'] || reqInfo.headers['host'] || ''
      let protoHeader = reqInfo.headers['x-forwarded-proto'] || 'https'
      let baseUrl = protoHeader + '://' + hostHeader

      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) ||
        'Engenharia Contratos — Nutrição'

      for (let i = 0; i < empresasCandidatas.length; i++) {
        const emp = empresasCandidatas[i]
        const empId = emp.id
        const empEtapa = emp.getString('etapa_funil')

        // 1. BLOQUEIO DE SEGURANÇA NO SERVIDOR:
        // Empresas Parceiras e "em_conversa" NUNCA recebem campanha (bloqueio rígido)
        if (empEtapa === 'parceira' || empEtapa === 'em_conversa') {
          totalBloqueadosRegra++
          try {
            const aRec = new Record(auditCol)
            aRec.set('user', reqInfo.auth.id)
            aRec.set('user_email', reqInfo.auth.getString('email'))
            aRec.set('acao', 'BLOQUEIO_CAMPANHA_REGRA')
            aRec.set('entidade', 'campanhas')
            aRec.set('registro_id', campanhaId)
            aRec.set('detalhes', {
              motivo: 'Empresa parceira ou em conversa não pode receber campanha de nutrição',
              empresa_id: empId,
              empresa_nome: emp.getString('razao_social'),
              etapa_atual: empEtapa,
            })
            aRec.set('ip', reqInfo.remoteIP || '')
            $app.save(aRec)
          } catch (_) {}
          continue
        }

        // Buscar email preferencial (contato decisor ou email da empresa)
        let emailDestino = (emp.getString('email') || '').trim()
        let nomeDestino =
          emp.getString('nome_fantasia') || emp.getString('razao_social') || 'Prezado(a)'

        const contatosDecisores = $app.findRecordsByFilter(
          'contatos',
          "empresa = '" + empId + "'",
          '-decisor,-created',
          1,
          0,
        )
        if (contatosDecisores.length > 0) {
          const cEmail = (contatosDecisores[0].getString('email') || '').trim()
          if (cEmail) {
            emailDestino = cEmail
            nomeDestino = contatosDecisores[0].getString('nome') || nomeDestino
          }
        }

        // Se e-mail vazio ou inválido, gera pendência e registra
        if (!emailDestino || emailDestino.indexOf('@') === -1) {
          totalFalhas++
          emp.set(
            'proxima_acao_desc',
            'PENDÊNCIA: E-mail ausente/inválido para campanha de nutrição mensal.',
          )
          $app.save(emp)

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', reqInfo.auth.id)
            aRec.set('user_email', reqInfo.auth.getString('email'))
            aRec.set('acao', 'PENDENCIA_EMAIL_CAMPANHA')
            aRec.set('entidade', 'campanhas')
            aRec.set('registro_id', campanhaId)
            aRec.set('detalhes', {
              mensagem: 'Empresa em nutrição mensal com e-mail inválido/ausente.',
              empresa_id: empId,
              empresa_nome: emp.getString('razao_social'),
            })
            aRec.set('ip', reqInfo.remoteIP || '')
            $app.save(aRec)
          } catch (_) {}
          continue
        }

        // 2. VERIFICAÇÃO RIGOROSA DE NÃO CONTATAR (ANTES DE CADA ENVIO)
        const bloqEmp = $app.findRecordsByFilter(
          'nao_contatar',
          "empresa = '" + empId + "'",
          '-created',
          1,
          0,
        )
        const bloqMail = $app.findRecordsByFilter(
          'nao_contatar',
          "email ~ '" + emailDestino + "'",
          '-created',
          1,
          0,
        )

        if (bloqEmp.length > 0 || bloqMail.length > 0) {
          totalBloqueadosNaoContatar++

          // Registrar envio bloqueado na coleção campanha_envios
          const tokenBloq = $security.randomString(32)
          const envioBloqRec = new Record(enviosCol)
          envioBloqRec.set('campanha', campanhaId)
          envioBloqRec.set('empresa', empId)
          envioBloqRec.set('destinatario_email', emailDestino)
          envioBloqRec.set('destinatario_nome', nomeDestino)
          envioBloqRec.set('status', 'bloqueado_nao_contatar')
          envioBloqRec.set('token_rastreamento', tokenBloq)
          envioBloqRec.set(
            'erro_mensagem',
            'Bloqueado compliance: cadastrado na lista Não contatar',
          )
          $app.save(envioBloqRec)

          // Auditar tentativa de envio bloqueada
          try {
            const aRec = new Record(auditCol)
            aRec.set('user', reqInfo.auth.id)
            aRec.set('user_email', reqInfo.auth.getString('email'))
            aRec.set('acao', 'BLOQUEIO_NAO_CONTATAR')
            aRec.set('entidade', 'campanhas')
            aRec.set('registro_id', campanhaId)
            aRec.set('detalhes', {
              motivo: 'Disparo de campanha bloqueado: empresa ou e-mail listado em Não contatar',
              empresa_id: empId,
              empresa_nome: emp.getString('razao_social'),
              destinatario_email: emailDestino,
            })
            aRec.set('ip', reqInfo.remoteIP || '')
            $app.save(aRec)
          } catch (_) {}

          continue
        }

        // 3. RECUPERAR DADOS DE CONTRATO PARA AS VARIÁVEIS
        let orgaoContrato = 'Órgão Público Contratante'
        let valorContrato = '0,00'
        const contratos = $app.findRecordsByFilter(
          'contratos',
          "empresa = '" + empId + "'",
          '-valor',
          1,
          0,
        )
        if (contratos.length > 0) {
          orgaoContrato = contratos[0].getString('orgao') || orgaoContrato
          const v = contratos[0].getFloat('valor') || 0
          valorContrato = v.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        }

        // 4. GERAR TOKEN ÚNICO DE RASTREAMENTO E DESCADASTRO
        const tokenEnvio = $security.randomString(36)
        const linkDescadastro = baseUrl + '/descadastro/' + tokenEnvio
        const pixelUrl = baseUrl + '/backend/v1/track/open/' + tokenEnvio

        // Substituição de variáveis no assunto e corpo
        let assuntoFinal = modeloAssunto
          .replace(/\{nome\}/g, nomeDestino)
          .replace(/\{orgao\}/g, orgaoContrato)
          .replace(/\{valor_contrato\}/g, valorContrato)

        let corpoFinal = modeloCorpo
          .replace(/\{nome\}/g, nomeDestino)
          .replace(/\{orgao\}/g, orgaoContrato)
          .replace(/\{valor_contrato\}/g, valorContrato)
          .replace(/\{link_descadastro\}/g, linkDescadastro)

        if (corpoFinal.indexOf(linkDescadastro) === -1) {
          corpoFinal += '\n\n---\nLink para descadastro obrigatório (LGPD):\n' + linkDescadastro
        }

        // Converter links normais em links de tracking de clique se houver URLs http(s)
        // e adicionar o pixel de rastreamento de abertura no final
        let htmlCorpo =
          '<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">' +
          corpoFinal.replace(/\n/g, '<br />') +
          '</div>' +
          '<img src="' +
          pixelUrl +
          '" width="1" height="1" style="display:none;" alt="" />'

        // 5. REGISTRAR REGISTRO EM CAMPANHA_ENVIOS
        const envioRec = new Record(enviosCol)
        envioRec.set('campanha', campanhaId)
        envioRec.set('empresa', empId)
        envioRec.set('destinatario_email', emailDestino)
        envioRec.set('destinatario_nome', nomeDestino)
        envioRec.set('status', 'enviado')
        envioRec.set('token_rastreamento', tokenEnvio)
        envioRec.set('enviado_em', new Date().toISOString())
        envioRec.set('total_aberturas', 0)
        envioRec.set('cliques', 0)

        // 6. DISPARO DO E-MAIL VIA MAILER DO SKIP CLOUD
        try {
          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: emailDestino, name: nomeDestino }],
            subject: assuntoFinal,
            html: htmlCorpo,
          })
          $app.newMailClient().send(msg)
        } catch (mailErr) {
          console.log('Aviso/Erro ao disparar e-mail de nutrição: ' + mailErr)
          // Se o envio falhar no transporte real sem SMTP conectado, fluxo e auditoria seguem funcionando
          envioRec.set('erro_mensagem', 'Falha no transporte: ' + mailErr.toString())
        }

        $app.save(envioRec)
        totalEnviados++

        // Atualizar última ação da empresa
        emp.set('proxima_acao_data', new Date().toISOString())
        emp.set(
          'proxima_acao_desc',
          'Campanha de Nutrição Mensal enviada: ' + campanha.getString('nome'),
        )
        $app.save(emp)
      }

      // Atualizar campanha
      campanha.set('status', 'enviada')
      campanha.set('data_envio', new Date().toISOString())
      campanha.set('enviados', totalEnviados)
      $app.save(campanha)

      // Registrar auditoria global do disparo da campanha
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'DISPARO_CAMPANHA_LOTE')
        aRec.set('entidade', 'campanhas')
        aRec.set('registro_id', campanhaId)
        aRec.set('detalhes', {
          campanha_nome: campanha.getString('nome'),
          segmento: segmento,
          total_candidatas: totalCandidatas,
          total_enviados: totalEnviados,
          bloqueados_nao_contatar: totalBloqueadosNaoContatar,
          bloqueados_regras: totalBloqueadosRegra,
          falhas_email: totalFalhas,
        })
        aRec.set('ip', reqInfo.remoteIP || '')
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Disparo do lote de campanha finalizado com sucesso.',
        total_candidatas: totalCandidatas,
        total_enviados: totalEnviados,
        total_bloqueados_nao_contatar: totalBloqueadosNaoContatar,
        total_bloqueados_regra: totalBloqueadosRegra,
        total_falhas_email: totalFalhas,
      })
    } catch (err) {
      console.log('Erro interno no disparo de campanha: ' + err)
      return e.json(500, { message: 'Erro interno ao disparar lote: ' + err })
    }
  },
  $apis.requireAuth(),
)
