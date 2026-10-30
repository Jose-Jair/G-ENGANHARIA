// =============================================================================
// GESTÃO G+ — CICLO DE VIDA DE ENTREGÁVEIS E VERSÕES
// Requisito 5:
// - Ciclo: atribuido → em_producao → enviado_revisao → aprovado | devolvido
// - motivo_devolucao obrigatório na devolução
// - Nova versão incrementa versao_atual e cria histórico em entregaveis_versoes
// - Transições validadas no hook (estado inválido bloqueado) e auditadas
// =============================================================================

onRecordValidate((e) => {
  const transicoesValidas = {
    pendente: ['atribuido', 'em_producao'],
    atribuido: ['em_producao', 'enviado_revisao'],
    em_producao: ['enviado_revisao'],
    enviado_revisao: ['aprovado', 'devolvido'],
    devolvido: ['em_producao', 'enviado_revisao'],
    aprovado: [], // Estado terminal
  }

  const rec = e.record
  const colName = rec.collection().name

  // Validação em entregaveis
  if (colName === 'entregaveis') {
    const orig = rec.original()
    const stNovo = rec.getString('status')
    const stAntigo = orig ? orig.getString('status') : ''

    if (orig && stAntigo && stNovo && stAntigo !== stNovo) {
      const permitidos = transicoesValidas[stAntigo] || []
      if (!permitidos.includes(stNovo)) {
        throw new BadRequestError(
          'TRANSIÇÃO INVÁLIDA: O entregável não pode transitar de "' +
            stAntigo +
            '" para "' +
            stNovo +
            '". Transições permitidas a partir de ' +
            stAntigo +
            ': ' +
            (permitidos.join(', ') || 'Nenhuma (estado final)'),
        )
      }

      // Se transitar para devolvido, motivo_devolucao é obrigatório
      if (stNovo === 'devolvido') {
        const motivo = (rec.getString('motivo_devolucao') || '').trim()
        if (!motivo) {
          throw new BadRequestError(
            'BLOQUEIO: Para devolver um entregável é OBRIGATÓRIO informar o motivo da devolução detalhando os apontamentos técnicos.',
          )
        }
      }
    }
  }

  // Validação em entregaveis_versoes
  if (colName === 'entregaveis_versoes') {
    const stVersao = rec.getString('status')
    if (stVersao === 'devolvido') {
      const motivo = (rec.getString('motivo_devolucao') || '').trim()
      if (!motivo) {
        throw new BadRequestError(
          'BLOQUEIO: É obrigatório informar o motivo da devolução para reprovar esta versão.',
        )
      }
    }
  }

  e.next()
})

// Pós-salvamento: auditoria de transição e sincronização de versão
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    const colName = rec.collection().name

    if (colName === 'entregaveis') {
      const orig = rec.original()
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''

      if (orig && stAntigo && stNovo && stAntigo !== stNovo) {
        // Auditar transição de entregável
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'TRANSICAO_STATUS_ENTREGAVEL')
          aRec.set('entidade', 'entregaveis')
          aRec.set('registro_id', rec.id)
          aRec.set('detalhes', {
            titulo: rec.getString('titulo') || rec.getString('nome'),
            etapa_id: rec.getString('etapa'),
            status_anterior: stAntigo,
            novo_status: stNovo,
            versao_atual: rec.getInt('versao_atual') || 1,
            motivo_devolucao: rec.getString('motivo_devolucao') || null,
          })
          $app.save(aRec)
        } catch (_) {}

        // Se devolvido, preparar para nova versão
        if (stNovo === 'devolvido') {
          const vAtual = rec.getInt('versao_atual') || 1
          rec.set('versao_atual', vAtual + 1)
          rec.set('versao', 'v' + (vAtual + 1) + '.0')
          $app.save(rec)
        }
      }
    }

    if (colName === 'entregaveis_versoes') {
      const entregavelId = rec.getString('entregavel')
      const stVersao = rec.getString('status')
      if (entregavelId) {
        try {
          const entRec = $app.findRecordById('entregaveis', entregavelId)
          if (entRec) {
            if (stVersao === 'aprovado' && entRec.getString('status') !== 'aprovado') {
              entRec.set('status', 'aprovado')
              entRec.set('motivo_devolucao', '')
              $app.save(entRec)
            } else if (stVersao === 'devolvido' && entRec.getString('status') !== 'devolvido') {
              entRec.set('status', 'devolvido')
              entRec.set(
                'motivo_devolucao',
                rec.getString('motivo_devolucao') || 'Ajustes solicitados',
              )
              $app.save(entRec)
            }
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.log('Aviso no hook pós-update de entregáveis: ' + err)
  } finally {
    e.next()
  }
})

// Rota custom para o prestador submeter uma nova versão de entregável
routerAdd(
  'POST',
  '/backend/v1/entregaveis/{id}/submeter-versao',
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

      // Validar se o usuário é admin, gestor ou o prestador dono do entregável
      const userRole = authUser.getString('role')
      const userEmail = authUser.getString('email')
      let autorizado = userRole === 'admin' || userRole === 'gestor'

      if (!autorizado && userRole === 'executor') {
        const prestadorId = entRec.getString('prestador')
        if (prestadorId) {
          try {
            const prestadorRec = $app.findRecordById('prestadores', prestadorId)
            if (prestadorRec && prestadorRec.getString('email') === userEmail) {
              autorizado = true
            }
          } catch (_) {}
        }
      }

      if (!autorizado) {
        return e.json(403, {
          error: 'Você não tem permissão para submeter versões para este entregável.',
        })
      }

      const body = reqInfo.body || {}
      const observacoes = (body.observacoes || '').trim()

      const vAtual = entRec.getInt('versao_atual') || 1
      const novaVersaoNum = vAtual

      // Criar registro na coleção entregaveis_versoes
      const versoesCol = $app.findCollectionByNameOrId('entregaveis_versoes')
      const vRec = new Record(versoesCol)
      vRec.set('entregavel', entId)
      vRec.set('numero_versao', novaVersaoNum)
      vRec.set('enviado_por', authUser.id)
      vRec.set('enviado_em', new Date().toISOString())
      vRec.set('status', 'submetido')
      vRec.set('observacoes', observacoes)
      $app.save(vRec)

      // Atualizar status do entregável para enviado_revisao
      entRec.set('status', 'enviado_revisao')
      entRec.set('motivo_devolucao', '')
      $app.save(entRec)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'SUBMISSAO_VERSAO_ENTREGAVEL')
        aRec.set('entidade', 'entregaveis')
        aRec.set('registro_id', entId)
        aRec.set('detalhes', {
          entregavel_id: entId,
          versao: novaVersaoNum,
          observacoes: observacoes,
        })
        $app.save(aRec)
      } catch (_) {}

      // Notificação e E-mail para a equipe de gestão interna
      try {
        const notifCol = $app.findCollectionByNameOrId('notificacoes')
        let gestorEmail = ''
        let gestorNome = 'Gestor de Projetos'
        let gestorId = entRec.getString('revisor_interno')

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

        const nomeEntregavel =
          entRec.getString('titulo') || entRec.getString('nome') || 'Entregável'
        const nRec = new Record(notifCol)
        nRec.set('destinatario_tipo', 'interno')
        if (gestorId) nRec.set('destinatario_usuario', gestorId)
        if (gestorEmail) nRec.set('destinatario_email', gestorEmail)
        nRec.set('tipo', 'versao_submetida')
        nRec.set('titulo', 'Nova versão enviada: ' + nomeEntregavel + ' (v' + novaVersaoNum + ')')
        nRec.set(
          'mensagem',
          'O prestador enviou a versão ' +
            novaVersaoNum +
            ' do entregável "' +
            nomeEntregavel +
            '" para revisão técnica.',
        )
        nRec.set('referencia_tipo', 'entregaveis')
        nRec.set('referencia_id', entId)
        nRec.set('lida', false)

        let emailEnviado = false
        if (gestorEmail) {
          try {
            const senderAddress =
              ($app.settings().meta && $app.settings().meta.senderAddress) ||
              'nao-responder@skip.dev'
            const senderName =
              ($app.settings().meta && $app.settings().meta.senderName) ||
              'G+ Engenharia Consultiva'
            const msg = new MailerMessage({
              from: { address: senderAddress, name: senderName },
              to: [{ address: gestorEmail, name: gestorNome }],
              subject: 'Nova versão para revisão: ' + nomeEntregavel + ' (v' + novaVersaoNum + ')',
              html:
                '<p>Olá, <strong>' +
                gestorNome +
                '</strong>!</p>' +
                '<p>A versão <strong>' +
                novaVersaoNum +
                '</strong> do entregável <strong>' +
                nomeEntregavel +
                '</strong> foi submetida pelo prestador e está aguardando revisão técnica.</p>' +
                (observacoes ? '<p><strong>Observações:</strong> ' + observacoes + '</p>' : '') +
                '<p>Acesse o painel do sistema para baixar o arquivo e avaliar.</p>',
            })
            $app.newMailClient().send(msg)
            emailEnviado = true
          } catch (_) {}
        }
        nRec.set('email_enviado', emailEnviado)
        $app.save(nRec)
      } catch (eNotif) {
        console.log('Aviso ao criar notificação de versão submetida: ' + eNotif)
      }

      return e.json(200, {
        sucesso: true,
        entregavel_id: entId,
        versao: novaVersaoNum,
        status: 'enviado_revisao',
        versao_id: vRec.id,
      })
    } catch (err) {
      console.log('Erro ao submeter versão de entregável: ' + err)
      return e.json(500, { error: 'Erro ao submeter versão: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Rota custom para o gestor/admin avaliar a versão do entregável (aprovar ou devolver)
routerAdd(
  'POST',
  '/backend/v1/entregaveis/{id}/avaliar',
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

      const userRole = authUser.getString('role')
      if (userRole !== 'admin' && userRole !== 'gestor') {
        return e.json(403, {
          error: 'Apenas Administradores e Gestores podem avaliar entregáveis.',
        })
      }

      const body = reqInfo.body || {}
      const decisao = (body.decisao || '').trim().toLowerCase() // 'aprovado' ou 'devolvido'
      const motivoDevolucao = (body.motivo_devolucao || body.observacoes || '').trim()

      if (decisao !== 'aprovado' && decisao !== 'devolvido') {
        return e.json(400, { error: 'Decisão inválida. Use "aprovado" ou "devolvido".' })
      }

      if (decisao === 'devolvido' && !motivoDevolucao) {
        return e.json(400, {
          error: 'O motivo da devolução é obrigatório ao rejeitar um entregável.',
        })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      const agora = new Date().toISOString()
      entRec.set('revisor_interno', authUser.id)

      if (decisao === 'aprovado') {
        entRec.set('status', 'aprovado')
        entRec.set('motivo_devolucao', '')
      } else {
        entRec.set('status', 'devolvido')
        entRec.set('motivo_devolucao', motivoDevolucao)
      }

      $app.save(entRec)

      // Atualizar a versão mais recente em entregaveis_versoes
      try {
        const ultimasVersoes = $app.findRecordsByFilter(
          'entregaveis_versoes',
          "entregavel = '" + entId + "'",
          '-created',
          1,
          0,
        )
        if (ultimasVersoes.length > 0) {
          const vRec = ultimasVersoes[0]
          vRec.set('status', decisao)
          vRec.set('avaliado_por', authUser.id)
          vRec.set('avaliado_em', agora)
          if (decisao === 'devolvido') {
            vRec.set('motivo_devolucao', motivoDevolucao)
          }
          $app.save(vRec)
        }
      } catch (eVers) {
        console.log('Aviso ao atualizar versão do entregável: ' + eVers)
      }

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('acao', 'AVALIACAO_ENTREGAVEL')
        aRec.set('entidade', 'entregaveis')
        aRec.set('registro_id', entId)
        aRec.set('detalhes', {
          entregavel_id: entId,
          decisao: decisao,
          motivo_devolucao: motivoDevolucao || null,
        })
        $app.save(aRec)
      } catch (_) {}

      // Notificação e E-mail para o Prestador (SEM dados confidenciais de cliente/obra/valores)
      try {
        let prestadorEmail = ''
        let prestadorNome = 'Prestador'
        const prestadorId = entRec.getString('prestador')
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
          const notifCol = $app.findCollectionByNameOrId('notificacoes')
          const nomeEnt = entRec.getString('titulo') || entRec.getString('nome') || 'Entregável'
          const numVersao = entRec.getInt('versao_atual') || 1
          const decisaoLabel = decisao === 'aprovado' ? 'aprovada' : 'devolvida com apontamentos'

          const nRec = new Record(notifCol)
          nRec.set('destinatario_tipo', 'prestador')
          nRec.set('destinatario_email', prestadorEmail)
          nRec.set('tipo', 'versao_avaliada')
          nRec.set('titulo', 'Versão ' + numVersao + ' ' + decisaoLabel + ': ' + nomeEnt)
          nRec.set(
            'mensagem',
            decisao === 'aprovado'
              ? 'Sua versão ' +
                  numVersao +
                  ' do entregável "' +
                  nomeEnt +
                  '" foi aprovada pela coordenação.'
              : 'Sua versão ' +
                  numVersao +
                  ' do entregável "' +
                  nomeEnt +
                  '" foi devolvida para correções. Motivo: ' +
                  motivoDevolucao,
          )
          nRec.set('referencia_tipo', 'entregaveis')
          nRec.set('referencia_id', entId)
          nRec.set('lida', false)

          let emailEnviado = false
          try {
            const senderAddress =
              ($app.settings().meta && $app.settings().meta.senderAddress) ||
              'nao-responder@skip.dev'
            const senderName =
              ($app.settings().meta && $app.settings().meta.senderName) ||
              'G+ Engenharia Consultiva'

            const corpoEmail =
              decisao === 'aprovado'
                ? '<p>Olá, <strong>' +
                  prestadorNome +
                  '</strong>!</p>' +
                  '<p>Temos o prazer de informar que sua versão <strong>' +
                  numVersao +
                  '</strong> do entregável <strong>' +
                  nomeEnt +
                  '</strong> foi <strong>APROVADA</strong> pela coordenação técnica.</p>' +
                  '<p>Acesse o Portal do Prestador para acompanhar as próximas entregas.</p>'
                : '<p>Olá, <strong>' +
                  prestadorNome +
                  '</strong>!</p>' +
                  '<p>A coordenação técnica revisou a versão <strong>' +
                  numVersao +
                  '</strong> do entregável <strong>' +
                  nomeEnt +
                  '</strong> e solicitou ajustes.</p>' +
                  '<div style="background:#f1f5f9;border-left:4px solid #ef4444;padding:12px 16px;margin:16px 0;">' +
                  '<strong>Apontamentos / Motivo:</strong><br/>' +
                  motivoDevolucao +
                  '</div>' +
                  '<p>Por favor, providencie as correções e submeta uma nova versão pelo Portal do Prestador.</p>'

            const msg = new MailerMessage({
              from: { address: senderAddress, name: senderName },
              to: [{ address: prestadorEmail, name: prestadorNome }],
              subject:
                'Parecer da revisão: Entregável ' +
                nomeEnt +
                ' (v' +
                numVersao +
                ' ' +
                (decisao === 'aprovado' ? 'Aprovada' : 'Devolvida') +
                ')',
              html: corpoEmail,
            })
            $app.newMailClient().send(msg)
            emailEnviado = true
          } catch (_) {}
          nRec.set('email_enviado', emailEnviado)
          $app.save(nRec)
        }
      } catch (eNotif) {
        console.log('Aviso ao notificar prestador sobre avaliação: ' + eNotif)
      }

      return e.json(200, {
        sucesso: true,
        entregavel_id: entId,
        status: entRec.getString('status'),
        versao_atual: entRec.getInt('versao_atual') || 1,
      })
    } catch (err) {
      console.log('Erro ao avaliar entregável: ' + err)
      return e.json(500, { error: 'Erro ao avaliar entregável: ' + err })
    }
  },
  $apis.requireAuth(),
)
