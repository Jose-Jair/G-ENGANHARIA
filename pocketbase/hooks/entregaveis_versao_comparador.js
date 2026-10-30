// =============================================================================
// GESTÃO G+ — REVISÃO DE VERSÕES DE ENTREGÁVEIS & "O QUE MUDOU"
// Requisitos:
// 1. Auditoria e notificação a cada comentário em entregavel_comentarios
// 2. Notificação (central + e-mail) a cada nova versão enviada ou avaliada
// 3. Endpoint "O que mudou" comparando metadados entre versões consecutivas:
//    GET /backend/v1/entregaveis/{id}/o-que-mudou?v_atual=X&v_anterior=Y (ou default versao atual x anterior)
//    Devolve: { nome_mudou, tamanho_anterior/atual, data_anterior/atual, autor_anterior/atual, comentarios_anteriores/atuais }
//    SEM comparar conteúdo interno do arquivo binário.
// =============================================================================

// -----------------------------------------------------------------------------
// Pós-criação de comentário de revisão na versão
// -----------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name !== 'entregavel_comentarios') {
    e.next()
    return
  }

  try {
    const versaoId = rec.getString('versao')
    let versaoRec = null
    try {
      versaoRec = $app.findRecordById('entregaveis_versoes', versaoId)
    } catch (_) {}

    if (!versaoRec) {
      e.next()
      return
    }

    const entregavelId = versaoRec.getString('entregavel')
    let entRec = null
    try {
      entRec = $app.findRecordById('entregaveis', entregavelId)
    } catch (_) {}

    const numVersao = versaoRec.getInt('numero_versao') || 1
    const nomeEntregavel = entRec
      ? entRec.getString('titulo') || entRec.getString('nome')
      : 'Entregável'
    const autorTipo = rec.getString('autor_tipo')
    const autorNome = rec.getString('autor_nome') || 'Usuário'
    const textoComentario = rec.getString('texto') || ''

    // 1. Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', rec.getString('autor_usuario') || null)
      aRec.set('user_email', rec.getString('autor_email') || autorNome)
      aRec.set('acao', 'COMENTARIO_VERSAO_ENTREGAVEL')
      aRec.set('entidade', 'entregavel_comentarios')
      aRec.set('registro_id', rec.id)
      aRec.set('detalhes', {
        versao_id: versaoId,
        numero_versao: numVersao,
        entregavel_id: entregavelId,
        autor_tipo: autorTipo,
        tamanho_texto: textoComentario.length,
      })
      $app.save(aRec)
    } catch (_) {}

    // 2. Notificação & E-mail para a outra parte
    const notifCol = $app.findCollectionByNameOrId('notificacoes')

    if (autorTipo === 'prestador') {
      // Prestador comentou na versão -> notificar Gestor interno
      let gestorEmail = ''
      let gestorNome = 'Gestor de Projetos'
      let gestorId = entRec ? entRec.getString('revisor_interno') : null

      if (gestorId) {
        try {
          const gUser = $app.findRecordById('users', gestorId)
          if (gUser) {
            gestorEmail = gUser.getString('email')
            gestorNome = gUser.getString('name') || gestorNome
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
            gestorNome = users[0].getString('name') || gestorNome
          }
        } catch (_) {}
      }

      const titulo = 'Novo comentário na v' + numVersao + ' de ' + nomeEntregavel
      const mensagem =
        'O prestador comentou na revisão da versão ' +
        numVersao +
        ': "' +
        (textoComentario.length > 120
          ? textoComentario.substring(0, 117) + '...'
          : textoComentario) +
        '"'

      const nRec = new Record(notifCol)
      nRec.set('destinatario_tipo', 'interno')
      if (gestorId) nRec.set('destinatario_usuario', gestorId)
      if (gestorEmail) nRec.set('destinatario_email', gestorEmail)
      nRec.set('tipo', 'comentario_versao')
      nRec.set('titulo', titulo)
      nRec.set('mensagem', mensagem)
      nRec.set('referencia_tipo', 'entregaveis')
      nRec.set('referencia_id', entregavelId)
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
            '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Gestão de Entregáveis e Versões</p>' +
            '</td></tr>' +
            '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
            '<p>Olá, <strong>' +
            gestorNome +
            '</strong>!</p>' +
            '<p>O prestador publicou um novo comentário técnico na <strong>versão ' +
            numVersao +
            '</strong> do entregável <strong>' +
            nomeEntregavel +
            '</strong>.</p>' +
            '<div style="background:#f1f5f9;border-left:4px solid #D95A2B;padding:12px 16px;margin:16px 0;">' +
            textoComentario +
            '</div>' +
            '<p>Acesse o painel para verificar a revisão e dar o parecer.</p>' +
            '</td></tr>' +
            '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
            'G+ Engenharia Consultiva • Plataforma Digital' +
            '</td></tr>' +
            '</table></body></html>'

          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: gestorEmail, name: gestorNome }],
            subject: titulo,
            html: htmlCompleto,
          })
          $app.newMailClient().send(msg)
          emailEnviado = true
        } catch (eMail) {
          console.log('[notificacao_comentario_gestor] Falha ao enviar email: ' + eMail)
        }
      }
      nRec.set('email_enviado', emailEnviado)
      $app.save(nRec)
    } else if (autorTipo === 'interno') {
      // Gestor comentou na versão -> notificar prestador
      let prestadorEmail = ''
      let prestadorNome = 'Prestador'

      if (entRec && entRec.getString('prestador')) {
        try {
          const pRec = $app.findRecordById('prestadores', entRec.getString('prestador'))
          if (pRec) {
            prestadorEmail = pRec.getString('email')
            prestadorNome = pRec.getString('nome') || prestadorNome
          }
        } catch (_) {}
      }

      if (prestadorEmail) {
        const titulo = 'Comentário técnico na versão ' + numVersao + ' de ' + nomeEntregavel
        const mensagem =
          'A equipe técnica comentou na versão ' +
          numVersao +
          ': "' +
          (textoComentario.length > 120
            ? textoComentario.substring(0, 117) + '...'
            : textoComentario) +
          '"'

        const nRec = new Record(notifCol)
        nRec.set('destinatario_tipo', 'prestador')
        nRec.set('destinatario_email', prestadorEmail)
        nRec.set('tipo', 'comentario_versao')
        nRec.set('titulo', titulo)
        nRec.set('mensagem', mensagem)
        nRec.set('referencia_tipo', 'entregaveis')
        nRec.set('referencia_id', entregavelId)
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
              '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Gestão de Entregáveis e Versões</p>' +
              '</td></tr>' +
              '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
              '<p>Olá, <strong>' +
              prestadorNome +
              '</strong>!</p>' +
              '<p>Você recebeu um novo comentário de revisão na <strong>versão ' +
              numVersao +
              '</strong> do entregável <strong>' +
              nomeEntregavel +
              '</strong>.</p>' +
              '<div style="background:#f1f5f9;border-left:4px solid #1E2A4A;padding:12px 16px;margin:16px 0;">' +
              textoComentario +
              '</div>' +
              '<p>Acesse o Portal do Prestador para interagir e providenciar eventuais ajustes.</p>' +
              '</td></tr>' +
              '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
              'G+ Engenharia Consultiva • Plataforma Digital' +
              '</td></tr>' +
              '</table></body></html>'

            const msg = new MailerMessage({
              from: { address: senderAddress, name: senderName },
              to: [{ address: prestadorEmail, name: prestadorNome }],
              subject: titulo,
              html: htmlCompleto,
            })
            $app.newMailClient().send(msg)
            emailEnviado = true
          } catch (eMail) {
            console.log('[notificacao_comentario_prestador] Falha ao enviar email: ' + eMail)
          }
        }
        nRec.set('email_enviado', emailEnviado)
        $app.save(nRec)
      }
    }
  } catch (err) {
    console.log('[entregavel_comentarios_hook] Erro pós-create de comentário: ' + err)
  } finally {
    e.next()
  }
})

// -----------------------------------------------------------------------------
// Endpoint: Comparador "O que mudou" entre versões consecutivas do entregável
// GET /backend/v1/entregaveis/{id}/o-que-mudou?v_atual=X&v_anterior=Y
// Compara metadados: nome_mudou, arquivo_mudou, autor_anterior/atual,
// data_anterior/atual, status_anterior/atual, observacoes_anteriores/atuais,
// contagem_comentarios_anterior/atual e lista de comentários de cada versão.
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/entregaveis/{id}/o-que-mudou',
  (e) => {
    try {
      const entId = e.request.pathValue('id')
      if (!entId) {
        return e.json(400, { error: 'ID do entregável não informado.' })
      }

      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')

      // Isolamento por perfil: se executor, deve ser o prestador dono do entregável
      if (role === 'executor') {
        const prestadorId = entRec.getString('prestador')
        let autorizado = false
        if (prestadorId) {
          try {
            const pRec = $app.findRecordById('prestadores', prestadorId)
            if (pRec && pRec.getString('email') === userEmail) {
              autorizado = true
            }
          } catch (_) {}
        }
        if (!autorizado) {
          return e.json(403, { error: 'Acesso não autorizado a este entregável.' })
        }
      }

      // Buscar histórico de versões ordenado por numero_versao ASC
      const versoes = $app.findRecordsByFilter(
        'entregaveis_versoes',
        "entregavel = '" + entId + "'",
        '+numero_versao',
        50,
        0,
      )

      if (versoes.length === 0) {
        return e.json(200, {
          tem_versoes: false,
          mensagem: 'Nenhuma versão registrada para este entregável ainda.',
        })
      }

      const queryAtual = parseInt(reqInfo.query.v_atual || '', 10)
      const queryAnterior = parseInt(reqInfo.query.v_anterior || '', 10)

      let versaoAtualRec = null
      let versaoAnteriorRec = null

      if (!isNaN(queryAtual) && !isNaN(queryAnterior)) {
        for (let i = 0; i < versoes.length; i++) {
          if (versoes[i].getInt('numero_versao') === queryAtual) versaoAtualRec = versoes[i]
          if (versoes[i].getInt('numero_versao') === queryAnterior) versaoAnteriorRec = versoes[i]
        }
      } else {
        // Default: pegar a versão mais recente e a imediatamente anterior
        versaoAtualRec = versoes[versoes.length - 1]
        if (versoes.length >= 2) {
          versaoAnteriorRec = versoes[versoes.length - 2]
        }
      }

      function extrairMetadadosVersao(vRec) {
        if (!vRec) return null

        let autorNome = 'Desconhecido'
        let autorEmail = ''
        const enviadoPorId = vRec.getString('enviado_por')
        if (enviadoPorId) {
          try {
            const u = $app.findRecordById('users', enviadoPorId)
            if (u) {
              autorNome = u.getString('name') || autorNome
              autorEmail = u.getString('email') || ''
            }
          } catch (_) {}
        }

        let avaliadorNome = ''
        const avaliadoPorId = vRec.getString('avaliado_por')
        if (avaliadoPorId) {
          try {
            const u = $app.findRecordById('users', avaliadoPorId)
            if (u) {
              avaliadorNome = u.getString('name') || ''
            }
          } catch (_) {}
        }

        // Buscar comentários desta versão
        const comentarios = $app.findRecordsByFilter(
          'entregavel_comentarios',
          "versao = '" + vRec.id + "'",
          '+created',
          100,
          0,
        )

        const comLista = []
        for (let j = 0; j < comentarios.length; j++) {
          const c = comentarios[j]
          comLista.push({
            id: c.id,
            autor_tipo: c.getString('autor_tipo'),
            autor_nome: c.getString('autor_nome'),
            texto: c.getString('texto'),
            created: c.getString('created'),
          })
        }

        const arquivoNome = vRec.getString('arquivo') || ''

        return {
          id: vRec.id,
          numero_versao: vRec.getInt('numero_versao') || 1,
          arquivo_nome: arquivoNome,
          tem_arquivo: Boolean(arquivoNome),
          enviado_em: vRec.getString('enviado_em') || vRec.getString('created'),
          autor_nome: autorNome,
          autor_email: autorEmail,
          status: vRec.getString('status'),
          motivo_devolucao: vRec.getString('motivo_devolucao') || '',
          observacoes: vRec.getString('observacoes') || '',
          avaliador_nome: avaliadorNome,
          avaliado_em: vRec.getString('avaliado_em') || '',
          total_comentarios: comLista.length,
          comentarios: comLista,
        }
      }

      const dadosAtual = extrairMetadadosVersao(versaoAtualRec)
      const dadosAnterior = extrairMetadadosVersao(versaoAnteriorRec)

      const diff = {
        entregavel_id: entId,
        titulo_entregavel: entRec.getString('titulo') || entRec.getString('nome'),
        versao_atual: dadosAtual ? dadosAtual.numero_versao : null,
        versao_anterior: dadosAnterior ? dadosAnterior.numero_versao : null,
        tem_versao_anterior: Boolean(dadosAnterior),
        arquivo_alterado: Boolean(
          dadosAtual && dadosAnterior && dadosAtual.arquivo_nome !== dadosAnterior.arquivo_nome,
        ),
        autor_mudou: Boolean(
          dadosAtual && dadosAnterior && dadosAtual.autor_nome !== dadosAnterior.autor_nome,
        ),
        status_mudou: Boolean(
          dadosAtual && dadosAnterior && dadosAtual.status !== dadosAnterior.status,
        ),
        novos_comentarios_na_atual: dadosAtual
          ? Math.max(
              0,
              dadosAtual.total_comentarios - (dadosAnterior ? dadosAnterior.total_comentarios : 0),
            )
          : 0,
        atual: dadosAtual,
        anterior: dadosAnterior,
      }

      return e.json(200, {
        sucesso: true,
        comparacao: diff,
      })
    } catch (err) {
      console.log('Erro no endpoint o-que-mudou: ' + err)
      return e.json(500, { error: 'Erro ao comparar versões do entregável: ' + err })
    }
  },
  $apis.requireAuth(),
)
