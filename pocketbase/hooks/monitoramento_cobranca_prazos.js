// =============================================================================
// GESTÃO G+ — MONITORAMENTO E COBRANÇA AUTOMÁTICA DE PRAZO (RODADA 7)
//
// ATENÇÃO ARQUITETURAL POCKETBASE / GOJA:
// Todas as funções auxiliares e regras de negócio devem estar estritamente
// declaradas INLINE dentro de cada callback (cronAdd, routerAdd) para evitar
// ReferenceError e erros de scoping do pool Goja.
// =============================================================================

// -----------------------------------------------------------------------------
// CRON: Varredura de prazos e geração do resumo diário
// Intervalo: */10 * * * * (a cada 10 min — limite da plataforma Skip Cloud)
// -----------------------------------------------------------------------------
cronAdd('monitoramento_e_cobranca_prazos', '*/10 * * * *', () => {
  try {
    const agora = new Date()
    const hojeStr = agora.toISOString().slice(0, 10) // YYYY-MM-DD
    const agoraMs = agora.getTime()

    // 1. Helper para obter parâmetros
    function obterParametro(chave, fallback) {
      try {
        const rec = $app.findFirstRecordByData('parametros', 'chave', chave)
        if (rec) {
          const v = rec.getString('valor')
          if (v !== '') return v
        }
      } catch (_) {}
      return fallback
    }

    // 2. Sanitização de telefone para o padrão WhatsApp wa.me
    function sanitizarTelefoneWa(tel) {
      if (!tel) return ''
      const digitos = String(tel).replace(/\D/g, '')
      if (!digitos) return ''
      if (digitos.startsWith('55') && digitos.length >= 12) {
        return digitos
      }
      if (digitos.length === 10 || digitos.length === 11) {
        return '55' + digitos
      }
      return digitos
    }

    // 3. Montador de link WhatsApp wa.me com texto sem dados sensíveis
    function montarLinkWhatsApp(tel, texto) {
      const telLimpo = sanitizarTelefoneWa(tel)
      if (!telLimpo) return ''
      return 'https://wa.me/' + telLimpo + '?text=' + encodeURIComponent(texto || '')
    }

    // 4. Parâmetros dinâmicos da Administração
    const diasLembrete = parseInt(obterParametro('monitoramento_prazo_dias_lembrete', '-3'), 10) // -3
    const diasAviso = parseInt(obterParametro('monitoramento_prazo_dias_aviso', '0'), 10) // 0
    const diasCobranca = parseInt(obterParametro('monitoramento_prazo_dias_cobranca', '1'), 10) // 1
    const diasEscalonamento = parseInt(
      obterParametro('monitoramento_prazo_dias_escalonamento', '3'),
      10,
    ) // 3
    const slaRevisaoHoras = parseInt(obterParametro('monitoramento_revisao_sla_horas', '48'), 10) // 48h

    // 5. Gestor padrão para escalonamento
    let gestorUsuarioId = null
    let gestorEmail = ''
    let gestorNome = 'Gestor de Projetos'
    try {
      const gestores = $app.findRecordsByFilter(
        'users',
        "active = true && (role = 'gestor' || role = 'admin')",
        'created',
        1,
        0,
      )
      if (gestores.length > 0) {
        gestorUsuarioId = gestores[0].id
        gestorEmail = gestores[0].getString('email')
        gestorNome = gestores[0].getString('name') || gestorNome
      }
    } catch (_) {}

    const senderAddress =
      ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
    const senderName =
      ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

    let totalOsAtrasadas = 0
    let totalEntregaveisAtrasados = 0
    let totalRevisoesEstagnadas = 0
    let totalEscalonamentos = 0
    const itensAtencao = []

    // -------------------------------------------------------------------------
    // 6. MONITORAMENTO DE ORDENS DE SERVIÇO
    // -------------------------------------------------------------------------
    const ordens = $app.findRecordsByFilter(
      'ordens_servico',
      "(status = 'em_execucao' || status = 'assinada') && data_previsao_fim != ''",
      'data_previsao_fim',
      500,
      0,
    )

    for (let i = 0; i < ordens.length; i++) {
      const os = ordens[i]
      const osId = os.id
      const numeroOs = os.getString('numero') || osId
      const disciplina = os.getString('disciplina') || 'Serviços de Engenharia'
      const dtPrevisao = os.getString('data_previsao_fim')
      if (!dtPrevisao) continue

      const prestadorId = os.getString('prestador')
      let prestadorNome = 'Prestador'
      let prestadorEmail = ''
      let prestadorTel = ''

      if (prestadorId) {
        try {
          const prest = $app.findRecordById('prestadores', prestadorId)
          if (prest) {
            prestadorNome = prest.getString('nome') || prestadorNome
            prestadorEmail = prest.getString('email') || ''
            prestadorTel = prest.getString('telefone') || ''
            if (!prestadorTel) {
              const telsJson = prest.get('telefones')
              if (Array.isArray(telsJson) && telsJson.length > 0) {
                prestadorTel = telsJson[0].numero || ''
              }
            }
          }
        } catch (_) {}
      }

      // Diferença em dias inteiros
      const dtPrevisaoMs = new Date(dtPrevisao).getTime()
      const diffDias = Math.floor((agoraMs - dtPrevisaoMs) / (1000 * 60 * 60 * 24))

      if (diffDias > 0) {
        totalOsAtrasadas++
      }

      const degrausCheck = []

      // D-3: Lembrete preventivo
      if (diffDias >= diasLembrete && diffDias < diasAviso) {
        degrausCheck.push({
          degrau: 'd_menos_3',
          diasConfig: diasLembrete,
          tituloNotif: 'Lembrete de Prazo — OS ' + numeroOs,
          mensagemTexto:
            'Olá, ' +
            prestadorNome +
            '. Lembramos que o prazo da Ordem de Serviço ' +
            numeroOs +
            ' (' +
            disciplina +
            ') encerra em breve. Favor verificar o andamento das entregas.',
          assuntoEmail: 'Lembrete de Prazo — Ordem de Serviço ' + numeroOs,
        })
      }

      // D0: Aviso no dia do vencimento
      if (diffDias >= diasAviso && diffDias < diasCobranca) {
        degrausCheck.push({
          degrau: 'd_zero',
          diasConfig: diasAviso,
          tituloNotif: 'Prazo Limite Hoje — OS ' + numeroOs,
          mensagemTexto:
            'Olá, ' +
            prestadorNome +
            '. A data limite prevista para a Ordem de Serviço ' +
            numeroOs +
            ' (' +
            disciplina +
            ') é hoje. Por favor, submeta a versão final no portal para revisão técnica.',
          assuntoEmail: 'Prazo de Conclusão Hoje — Ordem de Serviço ' + numeroOs,
        })
      }

      // D+1: Cobrança formal pós-vencimento
      if (diffDias >= diasCobranca && diffDias < diasEscalonamento) {
        degrausCheck.push({
          degrau: 'd_mais_1',
          diasConfig: diasCobranca,
          tituloNotif: 'Cobrança de Prazo em Atraso — OS ' + numeroOs,
          mensagemTexto:
            'Aviso formal de atraso: A Ordem de Serviço ' +
            numeroOs +
            ' (' +
            disciplina +
            ') ultrapassou a data limite prevista. Solicitamos a regularização ou envio da devolutiva com nova previsão.',
          assuntoEmail: 'Notificação de Atraso — Ordem de Serviço ' + numeroOs,
        })
      }

      // D+3: Escalonamento crítico ao Gestor
      if (diffDias >= diasEscalonamento) {
        totalEscalonamentos++
        degrausCheck.push({
          degrau: 'd_mais_3',
          diasConfig: diasEscalonamento,
          escalonarGestor: true,
          tituloNotif: 'CRÍTICO: Escalonamento de Prazo — OS ' + numeroOs,
          mensagemTexto:
            'ALERTA CRÍTICO: A Ordem de Serviço ' +
            numeroOs +
            ' está com ' +
            diffDias +
            ' dia(s) de atraso. O caso foi escalonado à Coordenação de Projetos para deliberação.',
          assuntoEmail: 'Alerta Crítico: OS ' + numeroOs + ' em Atraso Prolongado',
        })

        itensAtencao.push({
          tipo: 'os_escalonada',
          id: osId,
          numero: numeroOs,
          disciplina: disciplina,
          prestador_nome: prestadorNome,
          prestador_telefone: prestadorTel,
          dias_atraso: diffDias,
          prazo_previsto: dtPrevisao,
        })
      }

      // Idempotência por degrau
      for (let d = 0; d < degrausCheck.length; d++) {
        const cfg = degrausCheck[d]
        const chaveIdemp = 'ordens_servico_' + osId + '_' + cfg.degrau

        const jaExiste = $app.findRecordsByFilter(
          'eventos_cobranca',
          "chave_idempotencia = '" + chaveIdemp + "'",
          '',
          1,
          0,
        )
        if (jaExiste.length > 0) continue

        const waTexto =
          'Olá ' +
          prestadorNome +
          ', informamos sobre a OS ' +
          numeroOs +
          ' (' +
          disciplina +
          '): ' +
          cfg.mensagemTexto
        const waUrl = montarLinkWhatsApp(prestadorTel, waTexto)

        try {
          const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
          const evtRec = new Record(evtCol)
          evtRec.set('referencia_tipo', 'ordens_servico')
          evtRec.set('referencia_id', osId)
          evtRec.set('ordem_servico', osId)
          evtRec.set('degrau', cfg.degrau)
          evtRec.set('dias_configurados', cfg.diasConfig)
          evtRec.set('destinatario_tipo', 'prestador')
          if (prestadorId) evtRec.set('destinatario_prestador', prestadorId)
          evtRec.set('destinatario_email', prestadorEmail)
          evtRec.set('destinatario_nome', prestadorNome)
          evtRec.set('destinatario_telefone', prestadorTel)
          evtRec.set('status', 'processado')
          evtRec.set('whatsapp_url', waUrl)
          evtRec.set('mensagem_texto', cfg.mensagemTexto)
          evtRec.set('chave_idempotencia', chaveIdemp)
          evtRec.set('detalhes_auditoria', {
            os_numero: numeroOs,
            disciplina: disciplina,
            dias_calculados: diffDias,
            origem: 'cron',
            data_hora: new Date().toISOString(),
          })

          let emailEnviado = false
          if (prestadorEmail && prestadorEmail.indexOf('@') !== -1) {
            try {
              const mail = new MailerMessage({
                from: { address: senderAddress, name: senderName },
                to: [{ address: prestadorEmail, name: prestadorNome }],
                subject: cfg.assuntoEmail,
                html:
                  '<p>Olá, <strong>' +
                  prestadorNome +
                  '</strong>.</p>' +
                  '<p>' +
                  cfg.mensagemTexto +
                  '</p>' +
                  '<p>Por gentileza, acesse o Portal do Prestador para conferir o status e encaminhar suas entregas.</p>',
              })
              $app.newMailClient().send(mail)
              emailEnviado = true
            } catch (_) {}
          }
          evtRec.set('email_enviado', emailEnviado)

          let notifEnviada = false
          try {
            const notCol = $app.findCollectionByNameOrId('notificacoes')
            const nRec = new Record(notCol)
            nRec.set('destinatario_tipo', 'prestador')
            nRec.set('destinatario_email', prestadorEmail)
            nRec.set('tipo', 'sistema')
            nRec.set('titulo', cfg.tituloNotif)
            nRec.set('mensagem', cfg.mensagemTexto)
            nRec.set('referencia_tipo', 'ordens_servico')
            nRec.set('referencia_id', osId)
            nRec.set('lida', false)
            nRec.set('email_enviado', emailEnviado)
            $app.save(nRec)
            notifEnviada = true
          } catch (_) {}
          evtRec.set('notificacao_enviada', notifEnviada)

          $app.save(evtRec)

          // Escalonamento ao Gestor em D+3
          if (cfg.escalonarGestor && gestorEmail) {
            try {
              const notCol = $app.findCollectionByNameOrId('notificacoes')
              const nGestor = new Record(notCol)
              nGestor.set('destinatario_tipo', 'interno')
              if (gestorUsuarioId) nGestor.set('destinatario_usuario', gestorUsuarioId)
              nGestor.set('destinatario_email', gestorEmail)
              nGestor.set('tipo', 'sistema')
              nGestor.set('titulo', 'ESCALONAMENTO D+3: OS ' + numeroOs + ' em atraso')
              nGestor.set(
                'mensagem',
                'A OS ' +
                  numeroOs +
                  ' (' +
                  prestadorNome +
                  ') atingiu ' +
                  diffDias +
                  ' dias de atraso e requer deliberação na Central de Ações.',
              )
              nGestor.set('referencia_tipo', 'ordens_servico')
              nGestor.set('referencia_id', osId)
              nGestor.set('lida', false)
              $app.save(nGestor)

              const mailGestor = new MailerMessage({
                from: { address: senderAddress, name: senderName },
                to: [{ address: gestorEmail, name: gestorNome }],
                subject: 'Escalonamento de Prazo: OS ' + numeroOs + ' (' + diffDias + 'd atraso)',
                html:
                  '<p>Olá, <strong>' +
                  gestorNome +
                  '</strong>.</p>' +
                  '<p>A Ordem de Serviço <strong>' +
                  numeroOs +
                  '</strong> do prestador <strong>' +
                  prestadorNome +
                  '</strong> está com <strong>' +
                  diffDias +
                  ' dias de atraso</strong>.</p>' +
                  (waUrl
                    ? '<p><a href="' +
                      waUrl +
                      '" style="display:inline-block;padding:8px 16px;background:#25D366;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">Abrir WhatsApp com Prestador</a></p>'
                    : ''),
              })
              $app.newMailClient().send(mailGestor)
            } catch (_) {}
          }

          // Ajuste de tendência e nota por atrasos
          if (prestadorId) {
            try {
              const pRecord = $app.findRecordById('prestadores', prestadorId)
              if (pRecord) {
                let nAtual = pRecord.getFloat('nota_geral') || 5.0
                if (nAtual > 1.5 && diffDias > 0) {
                  nAtual = Math.max(1.0, Math.round((nAtual - 0.05) * 10) / 10)
                  pRecord.set('nota_geral', nAtual)
                  $app.save(pRecord)
                }
              }
            } catch (_) {}
          }

          // Auditoria
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA_MONITORAMENTO')
            aRec.set('acao', 'DEGRAU_COBRANCA_APLICADO')
            aRec.set('entidade', 'ordens_servico')
            aRec.set('registro_id', osId)
            aRec.set('detalhes', {
              os_id: osId,
              numero_os: numeroOs,
              degrau: cfg.degrau,
              dias_atraso: diffDias,
              chave_idempotencia: chaveIdemp,
            })
            $app.save(aRec)
          } catch (_) {}
        } catch (_) {}
      }
    }

    // -------------------------------------------------------------------------
    // 7. MONITORAMENTO DE ENTREGÁVEIS (PRAZO E SLA DO REVISOR INTERNO)
    // -------------------------------------------------------------------------
    const entregaveis = $app.findRecordsByFilter(
      'entregaveis',
      "status != 'aprovado'",
      'prazo',
      500,
      0,
    )

    for (let j = 0; j < entregaveis.length; j++) {
      const ent = entregaveis[j]
      const entId = ent.id
      const entNome = ent.getString('titulo') || ent.getString('nome') || 'Entregável'
      const statusEnt = ent.getString('status')
      const dtPrazo = ent.getString('prazo')

      // Entregável atrasado pelo prestador
      if (
        dtPrazo &&
        (statusEnt === 'pendente' || statusEnt === 'atribuido' || statusEnt === 'em_producao')
      ) {
        const dtPrazoMs = new Date(dtPrazo).getTime()
        const diffDias = Math.floor((agoraMs - dtPrazoMs) / (1000 * 60 * 60 * 24))

        if (diffDias > 0) totalEntregaveisAtrasados++

        if (diffDias >= diasCobranca) {
          const chaveIdemp = 'entregaveis_' + entId + '_d_mais_1'
          const jaExiste = $app.findRecordsByFilter(
            'eventos_cobranca',
            "chave_idempotencia = '" + chaveIdemp + "'",
            '',
            1,
            0,
          )

          if (jaExiste.length === 0) {
            const prestId = ent.getString('prestador')
            let pEmail = ''
            let pNome = 'Prestador'
            let pTel = ''
            if (prestId) {
              try {
                const pRec = $app.findRecordById('prestadores', prestId)
                if (pRec) {
                  pEmail = pRec.getString('email')
                  pNome = pRec.getString('nome') || pNome
                  pTel = pRec.getString('telefone') || ''
                }
              } catch (_) {}
            }

            const msgTexto =
              'O entregável "' +
              entNome +
              '" está com prazo vencido há ' +
              diffDias +
              ' dia(s). Solicitamos o envio da versão para revisão técnica.'
            const waUrl = montarLinkWhatsApp(pTel, 'Olá ' + pNome + ', ' + msgTexto)

            try {
              const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
              const evtRec = new Record(evtCol)
              evtRec.set('referencia_tipo', 'entregaveis')
              evtRec.set('referencia_id', entId)
              evtRec.set('entregavel', entId)
              evtRec.set('degrau', 'd_mais_1')
              evtRec.set('dias_configurados', diasCobranca)
              evtRec.set('destinatario_tipo', 'prestador')
              if (prestId) evtRec.set('destinatario_prestador', prestId)
              evtRec.set('destinatario_email', pEmail)
              evtRec.set('destinatario_nome', pNome)
              evtRec.set('destinatario_telefone', pTel)
              evtRec.set('status', 'processado')
              evtRec.set('whatsapp_url', waUrl)
              evtRec.set('mensagem_texto', msgTexto)
              evtRec.set('chave_idempotencia', chaveIdemp)
              evtRec.set('detalhes_auditoria', {
                entregavel_id: entId,
                entregavel_nome: entNome,
                dias_atraso: diffDias,
                origem: 'cron',
              })
              $app.save(evtRec)
            } catch (_) {}
          }
        }
      }

      // COBRANÇA DO REVISOR INTERNO: entregável enviado_revisao além do SLA
      if (statusEnt === 'enviado_revisao') {
        let dataSubmissaoMs = null
        try {
          const ultVersao = $app.findRecordsByFilter(
            'entregaveis_versoes',
            "entregavel = '" + entId + "'",
            '-created',
            1,
            0,
          )
          if (ultVersao.length > 0) {
            const dtEnv = ultVersao[0].getString('enviado_em') || ultVersao[0].getString('created')
            if (dtEnv) dataSubmissaoMs = new Date(dtEnv).getTime()
          }
        } catch (_) {}

        if (!dataSubmissaoMs) {
          dataSubmissaoMs = new Date(ent.getString('updated')).getTime()
        }

        const horasEmRevisao = Math.floor((agoraMs - dataSubmissaoMs) / (1000 * 60 * 60))

        if (horasEmRevisao >= slaRevisaoHoras) {
          totalRevisoesEstagnadas++
          const chaveIdempRev = 'entregaveis_' + entId + '_revisor_sla'
          const jaCobrado = $app.findRecordsByFilter(
            'eventos_cobranca',
            "chave_idempotencia = '" + chaveIdempRev + "'",
            '',
            1,
            0,
          )

          if (jaCobrado.length === 0) {
            let revisorId = ent.getString('revisor_interno')
            let revisorEmail = ''
            let revisorNome = 'Revisor Técnico'

            if (revisorId) {
              try {
                const uRec = $app.findRecordById('users', revisorId)
                if (uRec) {
                  revisorEmail = uRec.getString('email')
                  revisorNome = uRec.getString('name') || revisorNome
                }
              } catch (_) {}
            }

            if (!revisorEmail && gestorEmail) {
              revisorId = gestorUsuarioId
              revisorEmail = gestorEmail
              revisorNome = gestorNome
            }

            const msgRev =
              'O entregável "' +
              entNome +
              '" está aguardando revisão técnica há ' +
              horasEmRevisao +
              ' horas (SLA configurado: ' +
              slaRevisaoHoras +
              'h). Favor avaliar ou devolver com apontamentos.'

            try {
              const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
              const evtRec = new Record(evtCol)
              evtRec.set('referencia_tipo', 'entregaveis')
              evtRec.set('referencia_id', entId)
              evtRec.set('entregavel', entId)
              evtRec.set('degrau', 'revisor_sla')
              evtRec.set('dias_configurados', slaRevisaoHoras)
              evtRec.set('destinatario_tipo', 'revisor_interno')
              if (revisorId) evtRec.set('destinatario_usuario', revisorId)
              evtRec.set('destinatario_email', revisorEmail)
              evtRec.set('destinatario_nome', revisorNome)
              evtRec.set('status', 'processado')
              evtRec.set('mensagem_texto', msgRev)
              evtRec.set('chave_idempotencia', chaveIdempRev)
              evtRec.set('detalhes_auditoria', {
                entregavel_id: entId,
                horas_em_revisao: horasEmRevisao,
                sla_horas: slaRevisaoHoras,
              })

              let notifOk = false
              try {
                const notCol = $app.findCollectionByNameOrId('notificacoes')
                const nRec = new Record(notCol)
                nRec.set('destinatario_tipo', 'interno')
                if (revisorId) nRec.set('destinatario_usuario', revisorId)
                nRec.set('destinatario_email', revisorEmail)
                nRec.set('tipo', 'sistema')
                nRec.set('titulo', 'SLA de Revisão Excedido: ' + entNome)
                nRec.set('mensagem', msgRev)
                nRec.set('referencia_tipo', 'entregaveis')
                nRec.set('referencia_id', entId)
                nRec.set('lida', false)
                $app.save(nRec)
                notifOk = true
              } catch (_) {}
              evtRec.set('notificacao_enviada', notifOk)

              let mailOk = false
              if (revisorEmail && revisorEmail.indexOf('@') !== -1) {
                try {
                  const mail = new MailerMessage({
                    from: { address: senderAddress, name: senderName },
                    to: [{ address: revisorEmail, name: revisorNome }],
                    subject: 'SLA de Revisão Excedido (' + horasEmRevisao + 'h): ' + entNome,
                    html:
                      '<p>Olá, <strong>' +
                      revisorNome +
                      '</strong>.</p><p>' +
                      msgRev +
                      '</p><p>Acesse o painel para avaliar.</p>',
                  })
                  $app.newMailClient().send(mail)
                  mailOk = true
                } catch (_) {}
              }
              evtRec.set('email_enviado', mailOk)

              $app.save(evtRec)

              // Alerta adicional ao Gestor se revisor for terceiro
              if (gestorEmail && revisorEmail !== gestorEmail) {
                try {
                  const notCol = $app.findCollectionByNameOrId('notificacoes')
                  const nGestor = new Record(notCol)
                  nGestor.set('destinatario_tipo', 'interno')
                  if (gestorUsuarioId) nGestor.set('destinatario_usuario', gestorUsuarioId)
                  nGestor.set('destinatario_email', gestorEmail)
                  nGestor.set('tipo', 'sistema')
                  nGestor.set('titulo', 'Alerta SLA: Entregável parado em revisão')
                  nGestor.set(
                    'mensagem',
                    'O entregável "' +
                      entNome +
                      '" está há ' +
                      horasEmRevisao +
                      'h aguardando revisão de ' +
                      revisorNome +
                      '.',
                  )
                  nGestor.set('referencia_tipo', 'entregaveis')
                  nGestor.set('referencia_id', entId)
                  nGestor.set('lida', false)
                  $app.save(nGestor)
                } catch (_) {}
              }
            } catch (_) {}
          }

          itensAtencao.push({
            tipo: 'revisao_estagnada',
            id: entId,
            nome: entNome,
            horas_em_revisao: horasEmRevisao,
            sla_horas: slaRevisaoHoras,
          })
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7.1 MONITORAMENTO DE ISSUES DE REVISÃO (COBRANÇA DE PRAZO DE AJUSTES)
    // -------------------------------------------------------------------------
    const issuesAbertasPrazo = $app.findRecordsByFilter(
      'issues_revisao',
      "(status = 'aberta' || status = 'atribuida') && prazo != ''",
      'prazo',
      500,
      0,
    )

    for (let k = 0; k < issuesAbertasPrazo.length; k++) {
      const iss = issuesAbertasPrazo[k]
      const issId = iss.id
      const issTitulo = iss.getString('titulo') || 'Issue de Revisão'
      const issPrazo = iss.getString('prazo')
      const entIdIss = iss.getString('entregavel')
      if (!issPrazo || !entIdIss) continue

      let prestadorNomeIss = 'Prestador'
      let prestadorEmailIss = ''
      let prestadorTelIss = ''
      let prestadorIdIss = ''

      try {
        const entRecIss = $app.findRecordById('entregaveis', entIdIss)
        if (entRecIss) {
          prestadorIdIss = entRecIss.getString('prestador')
          if (prestadorIdIss) {
            const pRecIss = $app.findRecordById('prestadores', prestadorIdIss)
            if (pRecIss) {
              prestadorNomeIss = pRecIss.getString('nome') || prestadorNomeIss
              prestadorEmailIss = pRecIss.getString('email') || ''
              prestadorTelIss = pRecIss.getString('telefone') || ''
            }
          }
        }
      } catch (_) {}

      const dtPrazoIssMs = new Date(issPrazo).getTime()
      const diffDiasIss = Math.floor((agoraMs - dtPrazoIssMs) / (1000 * 60 * 60 * 24))

      if (diffDiasIss >= 0) {
        // Issue com prazo vencido ou vencendo hoje
        const chaveIdempIss = 'issue_' + issId + '_atraso_' + (diffDiasIss === 0 ? 'd0' : 'd_mais')
        const jaCobradoIss = $app.findRecordsByFilter(
          'eventos_cobranca',
          "chave_idempotencia = '" + chaveIdempIss + "'",
          '',
          1,
          0,
        )

        if (jaCobradoIss.length === 0) {
          const msgIss =
            'Aviso de prazo de issue: A pendência técnica "' +
            issTitulo +
            '" possui prazo limite ' +
            (diffDiasIss === 0 ? 'hoje' : diffDiasIss + ' dia(s) vencido') +
            '. Por favor, providencie os ajustes e submeta nova versão.'

          try {
            const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
            const evtRec = new Record(evtCol)
            evtRec.set('referencia_tipo', 'issues_revisao')
            evtRec.set('referencia_id', issId)
            evtRec.set('degrau', diffDiasIss === 0 ? 'd_zero' : 'd_mais_1')
            evtRec.set('destinatario_tipo', 'prestador')
            if (prestadorIdIss) evtRec.set('destinatario_prestador', prestadorIdIss)
            evtRec.set('destinatario_email', prestadorEmailIss)
            evtRec.set('destinatario_nome', prestadorNomeIss)
            evtRec.set('destinatario_telefone', prestadorTelIss)
            evtRec.set('status', 'processado')
            evtRec.set('mensagem_texto', msgIss)
            evtRec.set('chave_idempotencia', chaveIdempIss)
            evtRec.set('detalhes_auditoria', {
              issue_id: issId,
              titulo: issTitulo,
              prazo: issPrazo,
              dias_atraso: diffDiasIss,
            })

            let notifOk = false
            try {
              const notCol = $app.findCollectionByNameOrId('notificacoes')
              const nRec = new Record(notCol)
              nRec.set('destinatario_tipo', 'prestador')
              nRec.set('destinatario_email', prestadorEmailIss)
              nRec.set('tipo', 'sistema')
              nRec.set('titulo', 'Aviso de Prazo de Issue: ' + issTitulo)
              nRec.set('mensagem', msgIss)
              nRec.set('referencia_tipo', 'issues_revisao')
              nRec.set('referencia_id', issId)
              nRec.set('lida', false)
              $app.save(nRec)
              notifOk = true
            } catch (_) {}
            evtRec.set('notificacao_enviada', notifOk)

            $app.save(evtRec)
          } catch (_) {}
        }
      }
    }

    // -------------------------------------------------------------------------
    // 8. RESUMO DIÁRIO DO GESTOR
    // -------------------------------------------------------------------------
    try {
      const resCol = $app.findCollectionByNameOrId('resumos_diarios_gestor')
      const existentes = $app.findRecordsByFilter(
        'resumos_diarios_gestor',
        "data_referencia = '" + hojeStr + "'",
        '',
        1,
        0,
      )

      let rRec
      if (existentes.length > 0) {
        rRec = existentes[0]
      } else {
        rRec = new Record(resCol)
        rRec.set('data_referencia', hojeStr)
      }

      rRec.set('total_os_monitoradas', ordens.length)
      rRec.set('total_os_atrasadas', totalOsAtrasadas)
      rRec.set('total_entregaveis_atrasados', totalEntregaveisAtrasados)
      rRec.set('total_revisoes_estagnadas', totalRevisoesEstagnadas)
      rRec.set('total_escalonamentos', totalEscalonamentos)
      rRec.set('itens_atencao_json', itensAtencao)
      rRec.set('gerado_em', new Date().toISOString())
      rRec.set('lido_por_gestor', false)
      $app.save(rRec)
    } catch (_) {}
  } catch (errCron) {
    console.log('[cron_monitoramento_prazos] Erro durante execucao: ' + errCron)
  }
})

// -----------------------------------------------------------------------------
// ENDPOINT 1: Executar monitoramento sob demanda (Admin/Gestor)
// POST /backend/v1/monitoramento/executar
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/monitoramento/executar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Acesso restrito a Administradores e Gestores.' })
      }

      const agora = new Date()
      const hojeStr = agora.toISOString().slice(0, 10)
      const agoraMs = agora.getTime()

      function obterParametro(chave, fallback) {
        try {
          const rec = $app.findFirstRecordByData('parametros', 'chave', chave)
          if (rec) {
            const v = rec.getString('valor')
            if (v !== '') return v
          }
        } catch (_) {}
        return fallback
      }

      function sanitizarTelefoneWa(tel) {
        if (!tel) return ''
        const digitos = String(tel).replace(/\D/g, '')
        if (!digitos) return ''
        if (digitos.startsWith('55') && digitos.length >= 12) return digitos
        if (digitos.length === 10 || digitos.length === 11) return '55' + digitos
        return digitos
      }

      function montarLinkWhatsApp(tel, texto) {
        const telLimpo = sanitizarTelefoneWa(tel)
        if (!telLimpo) return ''
        return 'https://wa.me/' + telLimpo + '?text=' + encodeURIComponent(texto || '')
      }

      const diasLembrete = parseInt(obterParametro('monitoramento_prazo_dias_lembrete', '-3'), 10)
      const diasAviso = parseInt(obterParametro('monitoramento_prazo_dias_aviso', '0'), 10)
      const diasCobranca = parseInt(obterParametro('monitoramento_prazo_dias_cobranca', '1'), 10)
      const diasEscalonamento = parseInt(
        obterParametro('monitoramento_prazo_dias_escalonamento', '3'),
        10,
      )
      const slaRevisaoHoras = parseInt(obterParametro('monitoramento_revisao_sla_horas', '48'), 10)

      let totalOsAtrasadas = 0
      let totalEntregaveisAtrasados = 0
      let totalRevisoesEstagnadas = 0
      let totalEscalonamentos = 0
      let novosEventos = 0
      const itensAtencao = []

      // Varredura OS
      const ordens = $app.findRecordsByFilter(
        'ordens_servico',
        "(status = 'em_execucao' || status = 'assinada') && data_previsao_fim != ''",
        'data_previsao_fim',
        500,
        0,
      )

      for (let i = 0; i < ordens.length; i++) {
        const os = ordens[i]
        const osId = os.id
        const numeroOs = os.getString('numero') || osId
        const disciplina = os.getString('disciplina') || 'Serviços de Engenharia'
        const dtPrevisao = os.getString('data_previsao_fim')
        if (!dtPrevisao) continue

        const prestadorId = os.getString('prestador')
        let prestadorNome = 'Prestador'
        let prestadorEmail = ''
        let prestadorTel = ''

        if (prestadorId) {
          try {
            const prest = $app.findRecordById('prestadores', prestadorId)
            if (prest) {
              prestadorNome = prest.getString('nome') || prestadorNome
              prestadorEmail = prest.getString('email') || ''
              prestadorTel = prest.getString('telefone') || ''
              if (!prestadorTel) {
                const telsJson = prest.get('telefones')
                if (Array.isArray(telsJson) && telsJson.length > 0) {
                  prestadorTel = telsJson[0].numero || ''
                }
              }
            }
          } catch (_) {}
        }

        const dtPrevisaoMs = new Date(dtPrevisao).getTime()
        const diffDias = Math.floor((agoraMs - dtPrevisaoMs) / (1000 * 60 * 60 * 24))
        if (diffDias > 0) totalOsAtrasadas++

        const degrausCheck = []
        if (diffDias >= diasLembrete && diffDias < diasAviso) {
          degrausCheck.push({
            degrau: 'd_menos_3',
            diasConfig: diasLembrete,
            mensagemTexto:
              'Olá, ' +
              prestadorNome +
              '. Lembramos que o prazo da Ordem de Serviço ' +
              numeroOs +
              ' (' +
              disciplina +
              ') encerra em breve. Favor verificar o andamento das entregas.',
          })
        }
        if (diffDias >= diasAviso && diffDias < diasCobranca) {
          degrausCheck.push({
            degrau: 'd_zero',
            diasConfig: diasAviso,
            mensagemTexto:
              'Olá, ' +
              prestadorNome +
              '. A data limite prevista para a Ordem de Serviço ' +
              numeroOs +
              ' (' +
              disciplina +
              ') é hoje. Por favor, submeta a versão final no portal para revisão técnica.',
          })
        }
        if (diffDias >= diasCobranca && diffDias < diasEscalonamento) {
          degrausCheck.push({
            degrau: 'd_mais_1',
            diasConfig: diasCobranca,
            mensagemTexto:
              'Aviso formal de atraso: A Ordem de Serviço ' +
              numeroOs +
              ' (' +
              disciplina +
              ') ultrapassou a data limite prevista. Solicitamos a regularização ou envio da devolutiva com nova previsão.',
          })
        }
        if (diffDias >= diasEscalonamento) {
          totalEscalonamentos++
          degrausCheck.push({
            degrau: 'd_mais_3',
            diasConfig: diasEscalonamento,
            mensagemTexto:
              'ALERTA CRÍTICO: A Ordem de Serviço ' +
              numeroOs +
              ' está com ' +
              diffDias +
              ' dia(s) de atraso. O caso foi escalonado à Coordenação de Projetos para deliberação.',
          })
          itensAtencao.push({
            tipo: 'os_escalonada',
            id: osId,
            numero: numeroOs,
            disciplina: disciplina,
            prestador_nome: prestadorNome,
            prestador_telefone: prestadorTel,
            dias_atraso: diffDias,
            prazo_previsto: dtPrevisao,
          })
        }

        for (let d = 0; d < degrausCheck.length; d++) {
          const cfg = degrausCheck[d]
          const chaveIdemp = 'ordens_servico_' + osId + '_' + cfg.degrau
          const jaExiste = $app.findRecordsByFilter(
            'eventos_cobranca',
            "chave_idempotencia = '" + chaveIdemp + "'",
            '',
            1,
            0,
          )
          if (jaExiste.length > 0) continue

          const waUrl = montarLinkWhatsApp(
            prestadorTel,
            'Olá ' + prestadorNome + ', sobre a OS ' + numeroOs + ': ' + cfg.mensagemTexto,
          )

          try {
            const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
            const evtRec = new Record(evtCol)
            evtRec.set('referencia_tipo', 'ordens_servico')
            evtRec.set('referencia_id', osId)
            evtRec.set('ordem_servico', osId)
            evtRec.set('degrau', cfg.degrau)
            evtRec.set('dias_configurados', cfg.diasConfig)
            evtRec.set('destinatario_tipo', 'prestador')
            if (prestadorId) evtRec.set('destinatario_prestador', prestadorId)
            evtRec.set('destinatario_email', prestadorEmail)
            evtRec.set('destinatario_nome', prestadorNome)
            evtRec.set('destinatario_telefone', prestadorTel)
            evtRec.set('status', 'processado')
            evtRec.set('whatsapp_url', waUrl)
            evtRec.set('mensagem_texto', cfg.mensagemTexto)
            evtRec.set('chave_idempotencia', chaveIdemp)
            evtRec.set('detalhes_auditoria', {
              os_numero: numeroOs,
              disciplina: disciplina,
              dias_calculados: diffDias,
              origem: 'manual_api',
              executado_por: authUser.id,
            })
            $app.save(evtRec)
            novosEventos++
          } catch (_) {}
        }
      }

      // Varredura Entregáveis
      const entregaveis = $app.findRecordsByFilter(
        'entregaveis',
        "status != 'aprovado'",
        'prazo',
        500,
        0,
      )

      for (let j = 0; j < entregaveis.length; j++) {
        const ent = entregaveis[j]
        const entId = ent.id
        const entNome = ent.getString('titulo') || ent.getString('nome') || 'Entregável'
        const statusEnt = ent.getString('status')
        const dtPrazo = ent.getString('prazo')

        if (
          dtPrazo &&
          (statusEnt === 'pendente' || statusEnt === 'atribuido' || statusEnt === 'em_producao')
        ) {
          const dtPrazoMs = new Date(dtPrazo).getTime()
          const diffDias = Math.floor((agoraMs - dtPrazoMs) / (1000 * 60 * 60 * 24))
          if (diffDias > 0) totalEntregaveisAtrasados++

          if (diffDias >= diasCobranca) {
            const chaveIdemp = 'entregaveis_' + entId + '_d_mais_1'
            const jaExiste = $app.findRecordsByFilter(
              'eventos_cobranca',
              "chave_idempotencia = '" + chaveIdemp + "'",
              '',
              1,
              0,
            )
            if (jaExiste.length === 0) {
              const prestId = ent.getString('prestador')
              let pEmail = ''
              let pNome = 'Prestador'
              let pTel = ''
              if (prestId) {
                try {
                  const pRec = $app.findRecordById('prestadores', prestId)
                  if (pRec) {
                    pEmail = pRec.getString('email')
                    pNome = pRec.getString('nome') || pNome
                    pTel = pRec.getString('telefone') || ''
                  }
                } catch (_) {}
              }

              const msgTexto =
                'O entregável "' +
                entNome +
                '" está com prazo vencido há ' +
                diffDias +
                ' dia(s). Solicitamos o envio da versão para revisão técnica.'
              const waUrl = montarLinkWhatsApp(pTel, 'Olá ' + pNome + ', ' + msgTexto)

              try {
                const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
                const evtRec = new Record(evtCol)
                evtRec.set('referencia_tipo', 'entregaveis')
                evtRec.set('referencia_id', entId)
                evtRec.set('entregavel', entId)
                evtRec.set('degrau', 'd_mais_1')
                evtRec.set('dias_configurados', diasCobranca)
                evtRec.set('destinatario_tipo', 'prestador')
                if (prestId) evtRec.set('destinatario_prestador', prestId)
                evtRec.set('destinatario_email', pEmail)
                evtRec.set('destinatario_nome', pNome)
                evtRec.set('destinatario_telefone', pTel)
                evtRec.set('status', 'processado')
                evtRec.set('whatsapp_url', waUrl)
                evtRec.set('mensagem_texto', msgTexto)
                evtRec.set('chave_idempotencia', chaveIdemp)
                $app.save(evtRec)
                novosEventos++
              } catch (_) {}
            }
          }
        }

        // SLA do revisor interno
        if (statusEnt === 'enviado_revisao') {
          let dataSubmissaoMs = null
          try {
            const ultVersao = $app.findRecordsByFilter(
              'entregaveis_versoes',
              "entregavel = '" + entId + "'",
              '-created',
              1,
              0,
            )
            if (ultVersao.length > 0) {
              const dtEnv =
                ultVersao[0].getString('enviado_em') || ultVersao[0].getString('created')
              if (dtEnv) dataSubmissaoMs = new Date(dtEnv).getTime()
            }
          } catch (_) {}
          if (!dataSubmissaoMs) dataSubmissaoMs = new Date(ent.getString('updated')).getTime()

          const horasEmRevisao = Math.floor((agoraMs - dataSubmissaoMs) / (1000 * 60 * 60))
          if (horasEmRevisao >= slaRevisaoHoras) {
            totalRevisoesEstagnadas++
            const chaveIdempRev = 'entregaveis_' + entId + '_revisor_sla'
            const jaCobrado = $app.findRecordsByFilter(
              'eventos_cobranca',
              "chave_idempotencia = '" + chaveIdempRev + "'",
              '',
              1,
              0,
            )
            if (jaCobrado.length === 0) {
              let revisorId = ent.getString('revisor_interno')
              let revisorEmail = ''
              let revisorNome = 'Revisor Técnico'
              if (revisorId) {
                try {
                  const uRec = $app.findRecordById('users', revisorId)
                  if (uRec) {
                    revisorEmail = uRec.getString('email')
                    revisorNome = uRec.getString('name') || revisorNome
                  }
                } catch (_) {}
              }

              const msgRev =
                'O entregável "' +
                entNome +
                '" está aguardando revisão técnica há ' +
                horasEmRevisao +
                ' horas (SLA configurado: ' +
                slaRevisaoHoras +
                'h). Favor avaliar ou devolver com apontamentos.'

              try {
                const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
                const evtRec = new Record(evtCol)
                evtRec.set('referencia_tipo', 'entregaveis')
                evtRec.set('referencia_id', entId)
                evtRec.set('entregavel', entId)
                evtRec.set('degrau', 'revisor_sla')
                evtRec.set('dias_configurados', slaRevisaoHoras)
                evtRec.set('destinatario_tipo', 'revisor_interno')
                if (revisorId) evtRec.set('destinatario_usuario', revisorId)
                evtRec.set('destinatario_email', revisorEmail)
                evtRec.set('destinatario_nome', revisorNome)
                evtRec.set('status', 'processado')
                evtRec.set('mensagem_texto', msgRev)
                evtRec.set('chave_idempotencia', chaveIdempRev)
                $app.save(evtRec)
                novosEventos++
              } catch (_) {}
            }

            itensAtencao.push({
              tipo: 'revisao_estagnada',
              id: entId,
              nome: entNome,
              horas_em_revisao: horasEmRevisao,
              sla_horas: slaRevisaoHoras,
            })
          }
        }
      }

      // Atualizar Resumo Diário
      try {
        const resCol = $app.findCollectionByNameOrId('resumos_diarios_gestor')
        const existentes = $app.findRecordsByFilter(
          'resumos_diarios_gestor',
          "data_referencia = '" + hojeStr + "'",
          '',
          1,
          0,
        )
        let rRec
        if (existentes.length > 0) {
          rRec = existentes[0]
        } else {
          rRec = new Record(resCol)
          rRec.set('data_referencia', hojeStr)
        }
        rRec.set('total_os_monitoradas', ordens.length)
        rRec.set('total_os_atrasadas', totalOsAtrasadas)
        rRec.set('total_entregaveis_atrasados', totalEntregaveisAtrasados)
        rRec.set('total_revisoes_estagnadas', totalRevisoesEstagnadas)
        rRec.set('total_escalonamentos', totalEscalonamentos)
        rRec.set('itens_atencao_json', itensAtencao)
        rRec.set('gerado_em', new Date().toISOString())
        rRec.set('lido_por_gestor', false)
        $app.save(rRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        data_referencia: hojeStr,
        total_os_monitoradas: ordens.length,
        total_os_atrasadas: totalOsAtrasadas,
        total_entregaveis_atrasados: totalEntregaveisAtrasados,
        total_revisoes_estagnadas: totalRevisoesEstagnadas,
        total_escalonamentos: totalEscalonamentos,
        novos_eventos_criados: novosEventos,
        origem: 'manual_api',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao executar monitoramento: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ENDPOINT 2: Obter resumo diário do Gestor mais recente para a Central de Ações
// GET /backend/v1/monitoramento/resumo-diario
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/monitoramento/resumo-diario',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor' && role !== 'financeiro') {
        return e.json(403, { error: 'Acesso restrito.' })
      }

      const hojeStr = new Date().toISOString().slice(0, 10)
      let resumo = null
      try {
        const registros = $app.findRecordsByFilter(
          'resumos_diarios_gestor',
          "data_referencia = '" + hojeStr + "'",
          '-created',
          1,
          0,
        )
        if (registros.length > 0) {
          resumo = registros[0]
        } else {
          const ultimos = $app.findRecordsByFilter(
            'resumos_diarios_gestor',
            '',
            '-data_referencia',
            1,
            0,
          )
          if (ultimos.length > 0) resumo = ultimos[0]
        }
      } catch (_) {}

      return e.json(200, {
        resumo: resumo,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao obter resumo diário: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ENDPOINT 3: Gerador de link de WhatsApp para uma OS específica sob demanda
// GET /backend/v1/ordens-servico/{id}/whatsapp-link
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/ordens-servico/{id}/whatsapp-link',
  (e) => {
    try {
      const osId = e.request.pathValue('id')
      if (!osId) return e.json(400, { error: 'ID da OS não informado' })

      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) return e.json(401, { error: 'Autenticação necessária' })

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Acesso restrito a Gestores e Administradores' })
      }

      let osRec
      try {
        osRec = $app.findRecordById('ordens_servico', osId)
      } catch (_) {
        return e.json(404, { error: 'Ordem de Serviço não encontrada' })
      }

      const numeroOs = osRec.getString('numero') || osId
      const disciplina = osRec.getString('disciplina') || 'Serviços de Engenharia'
      const dtPrevisao = osRec.getString('data_previsao_fim') || ''

      const prestId = osRec.getString('prestador')
      let pNome = 'Prestador'
      let pTel = ''
      if (prestId) {
        try {
          const pRec = $app.findRecordById('prestadores', prestId)
          if (pRec) {
            pNome = pRec.getString('nome') || pNome
            pTel = pRec.getString('telefone') || ''
            if (!pTel) {
              const telsJson = pRec.get('telefones')
              if (Array.isArray(telsJson) && telsJson.length > 0) {
                pTel = telsJson[0].numero || ''
              }
            }
          }
        } catch (_) {}
      }

      function sanitizarTelefoneWa(tel) {
        if (!tel) return ''
        const digitos = String(tel).replace(/\D/g, '')
        if (!digitos) return ''
        if (digitos.startsWith('55') && digitos.length >= 12) return digitos
        if (digitos.length === 10 || digitos.length === 11) return '55' + digitos
        return digitos
      }

      const telLimpo = sanitizarTelefoneWa(pTel)

      // Texto curto e objetivo SEM dados sensíveis (sem cliente, obra ou valor)
      const textoMensagem =
        'Olá ' +
        pNome +
        ', aqui é da Coordenação da G+ Engenharia. Entramos em contato referente ao cronograma da OS ' +
        numeroOs +
        ' (' +
        disciplina +
        '). Favor confirmar a previsão de entrega.'

      const linkWa = telLimpo
        ? 'https://wa.me/' + telLimpo + '?text=' + encodeURIComponent(textoMensagem)
        : ''

      return e.json(200, {
        os_id: osId,
        numero: numeroOs,
        prestador_nome: pNome,
        prestador_telefone: pTel,
        prazo_previsto: dtPrevisao,
        mensagem_texto: textoMensagem,
        whatsapp_url: linkWa,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar link de WhatsApp: ' + err })
    }
  },
  $apis.requireAuth(),
)
