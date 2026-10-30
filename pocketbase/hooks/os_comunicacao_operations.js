// =============================================================================
// GESTÃO G+ — CANAL DE MENSAGENS POR ORDEM DE SERVIÇO (HOOKS & REGRAS)
// Requisitos:
// 1. Imutabilidade e auditoria obrigatória de mensagens_os
// 2. Proteção de dados: isolamento rígido entre interno e prestador
// 3. Marcação de mensagens como lidas (por OS, para Gestor e Prestador)
// 4. Contador de não lidas por OS (badge para as duas pontas)
// =============================================================================

// -----------------------------------------------------------------------------
// Validação ao criar mensagem_os (preenchimento seguro do autor e flags de leitura)
// -----------------------------------------------------------------------------
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'mensagens_os') {
    const osId = rec.getString('os')
    if (!osId) {
      throw new BadRequestError('É obrigatório vincular a mensagem a uma Ordem de Serviço.')
    }

    const texto = (rec.getString('texto') || '').trim()
    if (!texto) {
      throw new BadRequestError('O texto da mensagem não pode ser vazio.')
    }

    // Identificar contexto de quem está criando caso haja requisição
    let autorTipo = rec.getString('autor_tipo')
    if (!autorTipo) {
      autorTipo = 'sistema'
      rec.set('autor_tipo', autorTipo)
    }

    // Se criado por prestador: lida_por_prestador = true, lida_por_interno = false
    // Se criado por interno: lida_por_interno = true, lida_por_prestador = false
    if (autorTipo === 'prestador') {
      rec.set('lida_por_prestador', true)
      rec.set('lida_por_interno', false)
      rec.set('data_leitura_prestador', new Date().toISOString())
    } else if (autorTipo === 'interno') {
      rec.set('lida_por_interno', true)
      rec.set('lida_por_prestador', false)
      rec.set('data_leitura_interno', new Date().toISOString())
    }
  }

  e.next()
})

// -----------------------------------------------------------------------------
// Pós-criação da mensagem: Auditoria + Geração de Notificação + Disparo de E-mail
// -----------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name !== 'mensagens_os') {
    e.next()
    return
  }

  try {
    const osId = rec.getString('os')
    let osRec = null
    try {
      osRec = $app.findRecordById('ordens_servico', osId)
    } catch (_) {}

    if (!osRec) {
      e.next()
      return
    }

    const numeroOs = osRec.getString('numero')
    const autorTipo = rec.getString('autor_tipo')
    const autorNome = rec.getString('autor_nome') || 'Usuário'
    const textoMsg = rec.getString('texto') || ''
    const temAnexo = Boolean(rec.getString('anexo'))

    // 1. Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', rec.getString('autor_usuario') || null)
      aRec.set('user_email', rec.getString('autor_email') || autorNome)
      aRec.set('acao', 'ENVIO_MENSAGEM_OS')
      aRec.set('entidade', 'mensagens_os')
      aRec.set('registro_id', rec.id)
      aRec.set('detalhes', {
        os_id: osId,
        numero_os: numeroOs,
        autor_tipo: autorTipo,
        tem_anexo: temAnexo,
        tamanho_texto: textoMsg.length,
      })
      $app.save(aRec)
    } catch (_) {}

    // 2. Criar Notificação e Enviar E-mail para a outra ponta
    const notifCol = $app.findCollectionByNameOrId('notificacoes')

    if (autorTipo === 'prestador') {
      // Prestador enviou mensagem -> notificar o Gestor / Revisor interno
      let gestorId = osRec.getString('emitido_por')
      let gestorEmail = ''
      let gestorNome = 'Gestor de Projetos'

      if (gestorId) {
        try {
          const gestorUser = $app.findRecordById('users', gestorId)
          if (gestorUser) {
            gestorEmail = gestorUser.getString('email')
            gestorNome = gestorUser.getString('name') || gestorNome
          }
        } catch (_) {}
      }

      if (!gestorEmail) {
        try {
          const users = $app.findRecordsByFilter(
            'users',
            "active = true && (role = 'gestor' || role = 'admin')",
            'created',
            1,
            0,
          )
          if (users.length > 0) {
            gestorId = users[0].id
            gestorEmail = users[0].getString('email')
            gestorNome = users[0].getString('name') || 'Gestor de Projetos'
          }
        } catch (_) {}
      }

      const tituloNotif = 'Nova mensagem na OS ' + numeroOs
      const textoNotif =
        'O prestador enviou uma mensagem no canal da OS ' +
        numeroOs +
        ': "' +
        (textoMsg.length > 120 ? textoMsg.substring(0, 117) + '...' : textoMsg) +
        '"'

      const nRec = new Record(notifCol)
      nRec.set('destinatario_tipo', 'interno')
      if (gestorId) nRec.set('destinatario_usuario', gestorId)
      if (gestorEmail) nRec.set('destinatario_email', gestorEmail)
      nRec.set('tipo', 'mensagem_os')
      nRec.set('titulo', tituloNotif)
      nRec.set('mensagem', textoNotif)
      nRec.set('referencia_tipo', 'ordens_servico')
      nRec.set('referencia_id', osId)
      nRec.set('lida', false)

      let emailEnviado = false
      if (gestorEmail && gestorEmail.indexOf('@') !== -1) {
        try {
          const senderAddress =
            ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
          const senderName =
            ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

          const htmlCompleto =
            '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
            '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
            '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
            '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
            '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Comunicação & Notificações</p>' +
            '</td></tr>' +
            '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
            '<p>Olá, <strong>' +
            gestorNome +
            '</strong>!</p>' +
            '<p>Uma nova mensagem foi publicada pelo prestador no canal da <strong>Ordem de Serviço nº ' +
            numeroOs +
            '</strong>.</p>' +
            '<div style="background:#f1f5f9;border-left:4px solid #D95A2B;padding:12px 16px;margin:16px 0;font-style:italic;">' +
            textoMsg +
            '</div>' +
            (temAnexo
              ? '<p style="color:#64748b;font-size:12px;">📎 Esta mensagem contém um arquivo anexo.</p>'
              : '') +
            '<p>Acesse o painel do sistema para responder.</p>' +
            '</td></tr>' +
            '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
            'G+ Engenharia Consultiva • Portal de Comunicação' +
            '</td></tr>' +
            '</table></body></html>'

          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: gestorEmail, name: gestorNome }],
            subject: 'Nova mensagem na OS ' + numeroOs,
            html: htmlCompleto,
          })
          $app.newMailClient().send(msg)
          emailEnviado = true
        } catch (eMail) {
          console.log('[notificacao_email_gestor] Falha ao enviar email: ' + eMail)
        }
      }
      nRec.set('email_enviado', emailEnviado)
      $app.save(nRec)
    } else if (autorTipo === 'interno') {
      // Gestor interno enviou mensagem -> notificar o Prestador
      // O texto do e-mail NÃO CONTÉM cliente, obra ou valor de contrato
      let prestadorEmail = ''
      let prestadorNome = 'Prestador de Serviço'
      const prestadorId = osRec.getString('prestador')

      if (prestadorId) {
        try {
          const pRec = $app.findRecordById('prestadores', prestadorId)
          if (pRec) {
            prestadorEmail = pRec.getString('email')
            prestadorNome = pRec.getString('nome') || prestadorNome
          }
        } catch (_) {}
      }

      if (prestadorEmail) {
        const tituloNotif = 'Nova mensagem na OS ' + numeroOs
        const textoNotif =
          'A equipe de gestão enviou uma mensagem na OS ' +
          numeroOs +
          ': "' +
          (textoMsg.length > 120 ? textoMsg.substring(0, 117) + '...' : textoMsg) +
          '"'

        const nRec = new Record(notifCol)
        nRec.set('destinatario_tipo', 'prestador')
        nRec.set('destinatario_email', prestadorEmail)
        nRec.set('tipo', 'mensagem_os')
        nRec.set('titulo', tituloNotif)
        nRec.set('mensagem', textoNotif)
        nRec.set('referencia_tipo', 'ordens_servico')
        nRec.set('referencia_id', osId)
        nRec.set('lida', false)

        let emailEnviado = false
        if (prestadorEmail && prestadorEmail.indexOf('@') !== -1) {
          try {
            const senderAddress =
              ($app.settings().meta && $app.settings().meta.senderAddress) ||
              'nao-responder@skip.dev'
            const senderName =
              ($app.settings().meta && $app.settings().meta.senderName) ||
              'G+ Engenharia Consultiva'

            const htmlCompleto =
              '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
              '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
              '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
              '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
              '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Comunicação & Notificações</p>' +
              '</td></tr>' +
              '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
              '<p>Olá, <strong>' +
              prestadorNome +
              '</strong>!</p>' +
              '<p>A equipe de coordenação enviou uma nova mensagem no canal da sua <strong>Ordem de Serviço nº ' +
              numeroOs +
              '</strong>.</p>' +
              '<div style="background:#f1f5f9;border-left:4px solid #1E2A4A;padding:12px 16px;margin:16px 0;font-style:italic;">' +
              textoMsg +
              '</div>' +
              (temAnexo
                ? '<p style="color:#64748b;font-size:12px;">📎 Esta mensagem contém um arquivo anexo disponível para download seguro no Portal.</p>'
                : '') +
              '<p>Acesse o Portal do Prestador para visualizar o histórico completo e responder.</p>' +
              '</td></tr>' +
              '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
              'G+ Engenharia Consultiva • Portal de Comunicação' +
              '</td></tr>' +
              '</table></body></html>'

            const msg = new MailerMessage({
              from: { address: senderAddress, name: senderName },
              to: [{ address: prestadorEmail, name: prestadorNome }],
              subject: 'Nova mensagem na OS ' + numeroOs,
              html: htmlCompleto,
            })
            $app.newMailClient().send(msg)
            emailEnviado = true
          } catch (eMail) {
            console.log('[notificacao_email_prestador] Falha ao enviar email: ' + eMail)
          }
        }
        nRec.set('email_enviado', emailEnviado)
        $app.save(nRec)
      }
    }
  } catch (err) {
    console.log('[mensagens_os_hook] Erro ao processar pós-criação da mensagem: ' + err)
  } finally {
    e.next()
  }
})

// -----------------------------------------------------------------------------
// Endpoint 1: Marcar mensagens da OS como lidas
// POST /backend/v1/ordens-servico/{id}/mensagens/marcar-lidas
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ordens-servico/{id}/mensagens/marcar-lidas',
  (e) => {
    try {
      const osId = e.request.pathValue('id')
      if (!osId) {
        return e.json(400, { error: 'ID da OS não fornecido.' })
      }

      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      let osRec
      try {
        osRec = $app.findRecordById('ordens_servico', osId)
      } catch (_) {
        return e.json(404, { error: 'Ordem de Serviço não encontrada.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')

      let prestadorRec = null
      const prestadorId = osRec.getString('prestador')
      if (prestadorId) {
        try {
          prestadorRec = $app.findRecordById('prestadores', prestadorId)
        } catch (_) {}
      }

      let tipoLeitor = ''
      if (role === 'admin' || role === 'gestor') {
        tipoLeitor = 'interno'
      } else if (
        role === 'executor' &&
        prestadorRec &&
        prestadorRec.getString('email') === userEmail
      ) {
        tipoLeitor = 'prestador'
      } else {
        return e.json(403, { error: 'Acesso não autorizado a esta Ordem de Serviço.' })
      }

      const agoraIso = new Date().toISOString()
      let totalAtualizadas = 0

      // Atualizar mensagens não lidas correspondentes
      if (tipoLeitor === 'interno') {
        const msgs = $app.findRecordsByFilter(
          'mensagens_os',
          "os = '" + osId + "' && lida_por_interno != true",
          '',
          500,
          0,
        )
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i]
          m.set('lida_por_interno', true)
          m.set('data_leitura_interno', agoraIso)
          $app.save(m)
          totalAtualizadas++
        }
      } else if (tipoLeitor === 'prestador') {
        const msgs = $app.findRecordsByFilter(
          'mensagens_os',
          "os = '" + osId + "' && lida_por_prestador != true",
          '',
          500,
          0,
        )
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i]
          m.set('lida_por_prestador', true)
          m.set('data_leitura_prestador', agoraIso)
          $app.save(m)
          totalAtualizadas++
        }
      }

      return e.json(200, {
        sucesso: true,
        os_id: osId,
        tipo_leitor: tipoLeitor,
        total_marcadas_lidas: totalAtualizadas,
      })
    } catch (err) {
      console.log('Erro ao marcar mensagens como lidas: ' + err)
      return e.json(500, { error: 'Erro ao marcar mensagens como lidas: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// Endpoint 2: Contadores de mensagens não lidas por OS (Badge)
// GET /backend/v1/ordens-servico/contadores-mensagens-nao-lidas
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/ordens-servico/contadores-mensagens-nao-lidas',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')

      let filtro = ''
      if (role === 'admin' || role === 'gestor') {
        filtro = 'lida_por_interno != true'
      } else if (role === 'executor') {
        filtro = "lida_por_prestador != true && os.prestador.email = '" + userEmail + "'"
      } else {
        return e.json(200, { total_geral: 0, por_os: {} })
      }

      const msgsNaoLidas = $app.findRecordsByFilter('mensagens_os', filtro, '', 1000, 0)
      const porOs = {}
      let totalGeral = 0

      for (let i = 0; i < msgsNaoLidas.length; i++) {
        const osId = msgsNaoLidas[i].getString('os')
        if (osId) {
          porOs[osId] = (porOs[osId] || 0) + 1
          totalGeral++
        }
      }

      return e.json(200, {
        sucesso: true,
        total_geral: totalGeral,
        por_os: porOs,
      })
    } catch (err) {
      console.log('Erro ao buscar contadores de mensagens não lidas: ' + err)
      return e.json(500, { error: 'Erro ao buscar contadores de não lidas: ' + err })
    }
  },
  $apis.requireAuth(),
)
