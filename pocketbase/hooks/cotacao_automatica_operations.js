// =============================================================================
// GESTÃO G+ — COTAÇÃO AUTOMÁTICA (RODADA 4 - BACKEND)
// ATENÇÃO: Conforme o motor Goja/PocketBase, cada callback (onRecord*, cronAdd, routerAdd)
// roda em pool de VM isolado. Não declare funções reutilizáveis no escopo do topo.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Hook onRecordAfterUpdateSuccess para projeto_etapas:
// Ao marcar pacote como EXTERNO, abrir cotação automática para elegíveis
// -----------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'projeto_etapas') {
    try {
      const orig = rec.original()
      const tipoNovo = (rec.getString('tipo_execucao') || '').toLowerCase()
      const tipoAntigo = orig ? (orig.getString('tipo_execucao') || '').toLowerCase() : ''

      const isExterno = tipoNovo === 'terceirizada' || tipoNovo === 'externo'
      const jaEraExterno = tipoAntigo === 'terceirizada' || tipoAntigo === 'externo'

      // RODADA 13: Se o pacote já nasceu ou possui ordem_servico_ativa (ex: preço travado na pré-cotação),
      // BLOQUEAR TERMINANTEMENTE o disparo da cotação automática!
      const temOsAtiva = Boolean(rec.getString('ordem_servico_ativa'))

      if (isExterno && !temOsAtiva && !jaEraExterno) {
        // Idempotência: verificar se já existe cotação aberta
        const cotacoesExistentes = $app.findRecordsByFilter(
          'cotacoes',
          "pacote = '" +
            rec.id +
            "' && status != 'cancelada' && status != 'expirada' && status != 'encerrada'",
          '-created',
          5,
          0,
        )
        if (cotacoesExistentes.length === 0) {
          const reqInfo = e.requestInfo ? e.requestInfo() : null
          const authUser = reqInfo ? reqInfo.auth : null
          const clientIp =
            reqInfo && reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'

          // Ler parâmetros da Administração
          let prazoRespostaDias = 3
          let maxConvidados = 5
          try {
            const pPrazo = $app.findFirstRecordByData(
              'parametros',
              'chave',
              'prazo_resposta_cotacao_dias',
            )
            if (pPrazo) prazoRespostaDias = parseInt(pPrazo.getString('valor'), 10) || 3
          } catch (_) {}
          try {
            const pMax = $app.findFirstRecordByData('parametros', 'chave', 'max_convidados_cotacao')
            if (pMax) maxConvidados = parseInt(pMax.getString('valor'), 10) || 5
          } catch (_) {}

          const agora = new Date()
          const dataLimite = new Date(agora.getTime() + prazoRespostaDias * 24 * 60 * 60 * 1000)
          const dataLimiteIso = dataLimite.toISOString()

          const projetoId = rec.getString('projeto')
          let projetoRec = null
          if (projetoId) {
            try {
              projetoRec = $app.findRecordById('projetos', projetoId)
            } catch (_) {}
          }

          const disciplina = rec.getString('disciplina') || 'Engenharia'
          const escopo =
            rec.getString('escopo_detalhado') ||
            rec.getString('descricao') ||
            rec.getString('nome') ||
            'Execução técnica de escopo'

          const entregaveisPacote = $app.findRecordsByFilter(
            'entregaveis',
            "etapa = '" + rec.id + "'",
            'created',
            20,
            0,
          )
          const nomesEntregaveis = entregaveisPacote
            .map((ent) => ent.getString('nome'))
            .filter(Boolean)

          // Buscar prestadores elegíveis
          const hoje = new Date()
          hoje.setHours(0, 0, 0, 0)
          const todosPrestadores = $app.findRecordsByFilter(
            'prestadores',
            "status = 'ativo'",
            '-nota_geral',
            200,
            0,
          )

          const elegiveis = []
          for (let i = 0; i < todosPrestadores.length; i++) {
            const p = todosPrestadores[i]
            if (p.getString('tipo') === 'interno') continue
            if (p.getString('status') === 'suspenso') continue

            const valConselho = p.getString('validade_registro_conselho')
            if (valConselho) {
              const dtVal = new Date(valConselho)
              if (dtVal < hoje) continue
            }

            const discStr = p.getString('disciplinas') || ''
            const discList = p.get('disciplinas_atuacao') || []
            let compativel = false
            if (discStr.toLowerCase().includes(disciplina.toLowerCase())) compativel = true
            if (!compativel && Array.isArray(discList)) {
              compativel = discList.some((d) =>
                String(d).toLowerCase().includes(disciplina.toLowerCase()),
              )
            }
            if (!compativel) continue

            const cmAssinados = $app.findRecordsByFilter(
              'contratos_mestre',
              "prestador = '" + p.id + "' && status = 'assinado'",
              '',
              1,
              0,
            )
            if (cmAssinados.length === 0) continue

            const capMax = p.getInt('capacidade_simultanea') || 3
            const osAtivas = $app.findRecordsByFilter(
              'ordens_servico',
              "prestador = '" +
                p.id +
                "' && (status = 'em_execucao' || status = 'em_revisao' || status = 'assinada' || status = 'minuta' || status = 'aguardando_assinatura')",
              '',
              100,
              0,
            )
            const capLivre = capMax - osAtivas.length
            if (capLivre <= 0) continue

            elegiveis.push({
              prestador: p,
              capacidadeLivre: capLivre,
              notaGeral: p.getFloat('nota_geral') || 5.0,
            })
          }

          // Se não houver elegíveis: registrar na Central de Ações e auditar
          if (elegiveis.length === 0) {
            const codProjeto = projetoRec ? projetoRec.getString('codigo') : 'PRJ'
            const avisoMsg =
              'COTAÇÃO AUTOMÁTICA SEM ELEGÍVEIS: Pacote "' +
              rec.getString('nome') +
              '" (' +
              disciplina +
              ') do projeto ' +
              codProjeto +
              ' não encontrou prestadores elegíveis (disciplina, conselho válido, capacidade livre e contrato-mestre assinado).'

            if (projetoRec) {
              try {
                projetoRec.set('justificativa_saude', avisoMsg)
                $app.save(projetoRec)
              } catch (_) {}
            }

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', authUser ? authUser.id : null)
              aRec.set('user_email', authUser ? authUser.getString('email') : 'SISTEMA')
              aRec.set('acao', 'COTACAO_AUTOMATICA_SEM_ELEGIVEIS')
              aRec.set('entidade', 'projeto_etapas')
              aRec.set('registro_id', rec.id)
              aRec.set('detalhes', {
                pacote_id: rec.id,
                pacote_nome: rec.getString('nome'),
                disciplina: disciplina,
                aviso: avisoMsg,
              })
              aRec.set('ip', clientIp)
              $app.save(aRec)
            } catch (_) {}
          } else {
            elegiveis.sort(
              (a, b) => b.notaGeral - a.notaGeral || b.capacidadeLivre - a.capacidadeLivre,
            )
            const selecionados = elegiveis.slice(0, maxConvidados)
            const cotacoesCol = $app.findCollectionByNameOrId('cotacoes')
            const convidadosNomes = []

            for (let s = 0; s < selecionados.length; s++) {
              const prest = selecionados[s].prestador
              const token = $security.randomString(32)

              const novaCot = new Record(cotacoesCol)
              novaCot.set('etapa', rec.id)
              novaCot.set('pacote', rec.id)
              novaCot.set('prestador', prest.id)
              if (projetoId) novaCot.set('projeto', projetoId)
              novaCot.set('disciplina', disciplina)
              novaCot.set('escopo', escopo)
              novaCot.set('automatica', true)
              novaCot.set('status', 'convite_enviado')
              novaCot.set('escolhida', false)
              novaCot.set('lembrete_enviado', false)
              novaCot.set('token', token)
              novaCot.set('data_limite', dataLimiteIso)
              novaCot.set('data_limite_resposta', dataLimiteIso)
              novaCot.set('prazo_resposta', dataLimiteIso)

              const execLegadoId = prest.getString('executor_legado_id')
              if (execLegadoId) novaCot.set('executor', execLegadoId)

              $app.save(novaCot)
              convidadosNomes.push(prest.getString('nome'))

              // E-mail de convite
              const prestEmail = prest.getString('email')
              if (prestEmail) {
                try {
                  const codPrj = projetoRec ? projetoRec.getString('codigo') : 'PRJ'
                  const msg = new MailerMessage({
                    from: { address: 'contato@gmais.eng.br', name: 'G+ Engenharia Consultiva' },
                    to: [{ address: prestEmail, name: prest.getString('nome') }],
                    subject:
                      'Convite de Cotação — ' + codPrj + ' (' + disciplina + ') — G+ Engenharia',
                    html:
                      '<p>Olá <strong>' +
                      prest.getString('nome') +
                      '</strong>,</p><p>Você foi convidado a cotar a disciplina <strong>' +
                      disciplina +
                      '</strong> do projeto <strong>' +
                      codPrj +
                      '</strong>.</p><p>Acesse o Portal do Prestador para conferir escopo e prazos e enviar sua proposta.</p>',
                  })
                  $app.newMailClient().send(msg)
                } catch (errMail) {
                  console.log('Aviso ao enviar e-mail convite de cotação: ' + errMail)
                }
              }
            }

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', authUser ? authUser.id : null)
              aRec.set('user_email', authUser ? authUser.getString('email') : 'SISTEMA')
              aRec.set('acao', 'COTACAO_AUTOMATICA_ABERTA')
              aRec.set('entidade', 'projeto_etapas')
              aRec.set('registro_id', rec.id)
              aRec.set('detalhes', {
                pacote_id: rec.id,
                disciplina: disciplina,
                convidados: convidadosNomes,
                data_limite: dataLimiteIso,
              })
              aRec.set('ip', clientIp)
              $app.save(aRec)
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.log('Erro no hook update da etapa: ' + err)
    }
  }
  e.next()
})

// -----------------------------------------------------------------------------
// 2. Hook onRecordAfterCreateSuccess para projeto_etapas:
// Se nascer já como EXTERNO, disparar abertura de cotação
// -----------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'projeto_etapas') {
    try {
      // RODADA 13: Se o pacote já nasceu com ordem_servico_ativa (preço travado), BLOQUEAR disparo
      if (rec.getString('ordem_servico_ativa')) {
        e.next()
        return
      }

      const tipoNovo = (rec.getString('tipo_execucao') || '').toLowerCase()
      if (tipoNovo === 'terceirizada' || tipoNovo === 'externo') {
        const reqInfo = e.requestInfo ? e.requestInfo() : null
        const authUser = reqInfo ? reqInfo.auth : null
        const clientIp =
          reqInfo && reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'

        let prazoRespostaDias = 3
        let maxConvidados = 5
        try {
          const pPrazo = $app.findFirstRecordByData(
            'parametros',
            'chave',
            'prazo_resposta_cotacao_dias',
          )
          if (pPrazo) prazoRespostaDias = parseInt(pPrazo.getString('valor'), 10) || 3
        } catch (_) {}
        try {
          const pMax = $app.findFirstRecordByData('parametros', 'chave', 'max_convidados_cotacao')
          if (pMax) maxConvidados = parseInt(pMax.getString('valor'), 10) || 5
        } catch (_) {}

        const agora = new Date()
        const dataLimite = new Date(agora.getTime() + prazoRespostaDias * 24 * 60 * 60 * 1000)
        const dataLimiteIso = dataLimite.toISOString()

        const disciplina = rec.getString('disciplina') || 'Engenharia'
        const escopo =
          rec.getString('escopo_detalhado') ||
          rec.getString('descricao') ||
          rec.getString('nome') ||
          'Execução técnica de escopo'

        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const todosPrestadores = $app.findRecordsByFilter(
          'prestadores',
          "status = 'ativo'",
          '-nota_geral',
          200,
          0,
        )

        const elegiveis = []
        for (let i = 0; i < todosPrestadores.length; i++) {
          const p = todosPrestadores[i]
          if (p.getString('tipo') === 'interno') continue
          if (p.getString('status') === 'suspenso') continue

          const valConselho = p.getString('validade_registro_conselho')
          if (valConselho) {
            const dtVal = new Date(valConselho)
            if (dtVal < hoje) continue
          }

          const discStr = p.getString('disciplinas') || ''
          const discList = p.get('disciplinas_atuacao') || []
          let compativel = false
          if (discStr.toLowerCase().includes(disciplina.toLowerCase())) compativel = true
          if (!compativel && Array.isArray(discList)) {
            compativel = discList.some((d) =>
              String(d).toLowerCase().includes(disciplina.toLowerCase()),
            )
          }
          if (!compativel) continue

          const cmAssinados = $app.findRecordsByFilter(
            'contratos_mestre',
            "prestador = '" + p.id + "' && status = 'assinado'",
            '',
            1,
            0,
          )
          if (cmAssinados.length === 0) continue

          const capMax = p.getInt('capacidade_simultanea') || 3
          const osAtivas = $app.findRecordsByFilter(
            'ordens_servico',
            "prestador = '" +
              p.id +
              "' && (status = 'em_execucao' || status = 'em_revisao' || status = 'assinada' || status = 'minuta' || status = 'aguardando_assinatura')",
            '',
            100,
            0,
          )
          const capLivre = capMax - osAtivas.length
          if (capLivre <= 0) continue

          elegiveis.push({
            prestador: p,
            capacidadeLivre: capLivre,
            notaGeral: p.getFloat('nota_geral') || 5.0,
          })
        }

        if (elegiveis.length === 0) {
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', authUser ? authUser.id : null)
            aRec.set('user_email', authUser ? authUser.getString('email') : 'SISTEMA')
            aRec.set('acao', 'COTACAO_AUTOMATICA_SEM_ELEGIVEIS')
            aRec.set('entidade', 'projeto_etapas')
            aRec.set('registro_id', rec.id)
            aRec.set('detalhes', {
              pacote_id: rec.id,
              disciplina: disciplina,
              aviso: 'Sem elegíveis na criação do pacote externo',
            })
            aRec.set('ip', clientIp)
            $app.save(aRec)
          } catch (_) {}
        } else {
          elegiveis.sort(
            (a, b) => b.notaGeral - a.notaGeral || b.capacidadeLivre - a.capacidadeLivre,
          )
          const selecionados = elegiveis.slice(0, maxConvidados)
          const cotacoesCol = $app.findCollectionByNameOrId('cotacoes')
          const convidadosNomes = []

          for (let s = 0; s < selecionados.length; s++) {
            const prest = selecionados[s].prestador
            const token = $security.randomString(32)

            const novaCot = new Record(cotacoesCol)
            novaCot.set('etapa', rec.id)
            novaCot.set('pacote', rec.id)
            novaCot.set('prestador', prest.id)
            novaCot.set('projeto', rec.getString('projeto'))
            novaCot.set('disciplina', disciplina)
            novaCot.set('escopo', escopo)
            novaCot.set('automatica', true)
            novaCot.set('status', 'convite_enviado')
            novaCot.set('escolhida', false)
            novaCot.set('lembrete_enviado', false)
            novaCot.set('token', token)
            novaCot.set('data_limite', dataLimiteIso)
            novaCot.set('data_limite_resposta', dataLimiteIso)
            novaCot.set('prazo_resposta', dataLimiteIso)

            $app.save(novaCot)
            convidadosNomes.push(prest.getString('nome'))
          }

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', authUser ? authUser.id : null)
            aRec.set('user_email', authUser ? authUser.getString('email') : 'SISTEMA')
            aRec.set('acao', 'COTACAO_AUTOMATICA_ABERTA')
            aRec.set('entidade', 'projeto_etapas')
            aRec.set('registro_id', rec.id)
            aRec.set('detalhes', {
              pacote_id: rec.id,
              disciplina: disciplina,
              convidados: convidadosNomes,
            })
            aRec.set('ip', clientIp)
            $app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (err) {
      console.log('Erro no hook create da etapa: ' + err)
    }
  }
  e.next()
})

// -----------------------------------------------------------------------------
// 3. CRON: Lembrete de cotação e expiração após vencimento (a cada 10 min)
// -----------------------------------------------------------------------------
cronAdd('cotacoes_lembrete_e_expiracao', '*/10 * * * *', () => {
  try {
    const agora = new Date()
    const agoraIso = agora.toISOString()

    let antecedenciaDias = 1
    try {
      const pAnt = $app.findFirstRecordByData(
        'parametros',
        'chave',
        'antecedencia_lembrete_cotacao_dias',
      )
      if (pAnt) antecedenciaDias = parseInt(pAnt.getString('valor'), 10) || 1
    } catch (_) {}

    // Lembrete
    const cotsParaLembrete = $app.findRecordsByFilter(
      'cotacoes',
      "status = 'convite_enviado' && lembrete_enviado = false && data_limite_resposta != ''",
      '',
      100,
      0,
    )

    for (let i = 0; i < cotsParaLembrete.length; i++) {
      const cot = cotsParaLembrete[i]
      const dtLim = cot.getString('data_limite_resposta') || cot.getString('data_limite')
      if (!dtLim) continue

      const diffMs = new Date(dtLim).getTime() - agora.getTime()
      const diffDias = diffMs / (1000 * 60 * 60 * 24)

      if (diffDias > 0 && diffDias <= antecedenciaDias) {
        cot.set('lembrete_enviado', true)
        $app.save(cot)

        const prestId = cot.getString('prestador')
        if (prestId) {
          try {
            const prest = $app.findRecordById('prestadores', prestId)
            const email = prest ? prest.getString('email') : ''
            if (email) {
              const msg = new MailerMessage({
                from: { address: 'contato@gmais.eng.br', name: 'G+ Engenharia Consultiva' },
                to: [{ address: email, name: prest.getString('nome') }],
                subject: 'Lembrete de Cotação a Vencer — G+ Engenharia',
                html:
                  '<p>Olá <strong>' +
                  prest.getString('nome') +
                  '</strong>,</p><p>Sua cotação pendente no Portal do Prestador vence em breve.</p>',
              })
              $app.newMailClient().send(msg)
            }
          } catch (_) {}
        }
      }
    }

    // Expiração
    const cotsVencidas = $app.findRecordsByFilter(
      'cotacoes',
      "status = 'convite_enviado' && data_limite_resposta != '' && data_limite_resposta < '" +
        agoraIso +
        "'",
      '',
      100,
      0,
    )

    for (let v = 0; v < cotsVencidas.length; v++) {
      const cotVenc = cotsVencidas[v]
      cotVenc.set('status', 'expirada')
      cotVenc.set('motivo_encerramento', 'Prazo de resposta esgotado sem envio de proposta.')
      $app.save(cotVenc)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA')
        aRec.set('acao', 'COTACAO_ENCERRADA_POR_EXPIRACAO')
        aRec.set('entidade', 'cotacoes')
        aRec.set('registro_id', cotVenc.id)
        aRec.set('detalhes', {
          cotacao_id: cotVenc.id,
          motivo: 'Vencimento sem resposta do prestador',
        })
        aRec.set('ip', '127.0.0.1')
        $app.save(aRec)
      } catch (_) {}
    }
  } catch (errCron) {
    console.log('Erro no cron cotacoes_lembrete_e_expiracao: ' + errCron)
  }
})

// -----------------------------------------------------------------------------
// 4. ENDPOINT: Prestador responde cotação pelo portal
// POST /backend/v1/portal-prestador/cotacoes/{id}/responder
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/portal-prestador/cotacoes/{id}/responder',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const cotacaoId = e.request.pathValue('id')
      let cotacao
      try {
        cotacao = $app.findRecordById('cotacoes', cotacaoId)
      } catch (_) {
        return e.json(404, { error: 'Cotação não encontrada' })
      }

      const prestadorId = cotacao.getString('prestador')
      if (!prestadorId) {
        return e.json(400, { error: 'Cotação não vinculada a prestador' })
      }

      const prestador = $app.findRecordById('prestadores', prestadorId)
      const userEmail = authUser.getString('email')
      const userRole = authUser.getString('role')

      if (userRole !== 'admin' && prestador.getString('email') !== userEmail) {
        return e.json(403, { error: 'Você só pode responder às suas próprias cotações.' })
      }

      const statusAtual = cotacao.getString('status')
      if (
        statusAtual === 'expirada' ||
        statusAtual === 'cancelada' ||
        statusAtual === 'encerrada'
      ) {
        return e.json(400, { error: 'Esta cotação já está encerrada ou expirada.' })
      }

      const body = reqInfo.body || {}
      const precoOfertado = parseFloat(body.preco_ofertado)
      const prazoOfertado = (body.prazo_ofertado || '').trim()
      const observacoes = (body.observacoes || '').trim()

      if (isNaN(precoOfertado) || precoOfertado <= 0) {
        return e.json(400, { error: 'Preço ofertado deve ser um valor numérico positivo.' })
      }
      if (!prazoOfertado) {
        return e.json(400, { error: 'Prazo ofertado é obrigatório.' })
      }

      cotacao.set('preco_ofertado', precoOfertado)
      cotacao.set('prazo_ofertado', prazoOfertado)
      cotacao.set('observacoes', observacoes)
      cotacao.set('status', 'respondida')
      cotacao.set('data_resposta', new Date().toISOString())
      $app.save(cotacao)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('acao', 'COTACAO_RESPONDIDA_PORTAL')
        aRec.set('entidade', 'cotacoes')
        aRec.set('registro_id', cotacao.id)
        aRec.set('detalhes', {
          cotacao_id: cotacao.id,
          prestador_id: prestadorId,
          preco_ofertado: precoOfertado,
          prazo_ofertado: prazoOfertado,
        })
        aRec.set('ip', reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1')
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        mensagem: 'Proposta registrada com sucesso!',
        cotacao_id: cotacao.id,
        status: cotacao.getString('status'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao registrar resposta: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 5. ENDPOINT: Ranking de propostas do pacote (Admin/Gestor)
// GET /backend/v1/cotacoes/pacote/{pacote_id}/ranking
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/cotacoes/pacote/{pacote_id}/ranking',
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

      const pacoteId = e.request.pathValue('pacote_id')
      let pacote
      try {
        pacote = $app.findRecordById('projeto_etapas', pacoteId)
      } catch (_) {
        return e.json(404, { error: 'Pacote de trabalho não encontrado' })
      }

      const valorReferencia = pacote.getFloat('valor_interno_referencia') || 0
      const valorVendido = pacote.getFloat('valor_vendido') || 0

      const cotacoes = $app.findRecordsByFilter(
        'cotacoes',
        "pacote = '" + pacoteId + "' || etapa = '" + pacoteId + "'",
        '-created',
        100,
        0,
      )

      const ranking = []

      for (let i = 0; i < cotacoes.length; i++) {
        const c = cotacoes[i]
        const prestId = c.getString('prestador')
        let prestador = null
        if (prestId) {
          try {
            prestador = $app.findRecordById('prestadores', prestId)
          } catch (_) {}
        }

        const preco = c.getFloat('preco_ofertado') || 0
        const prazo = c.getString('prazo_ofertado') || ''
        const respondida = c.getString('status') === 'respondida' || preco > 0

        const nota = prestador ? prestador.getFloat('nota_geral') || 5.0 : 5.0
        const capMax = prestador ? prestador.getInt('capacidade_simultanea') || 3 : 3

        let osAtivasQtd = 0
        if (prestId) {
          const osAtivas = $app.findRecordsByFilter(
            'ordens_servico',
            "prestador = '" +
              prestId +
              "' && (status = 'em_execucao' || status = 'em_revisao' || status = 'assinada' || status = 'minuta' || status = 'aguardando_assinatura')",
            '',
            100,
            0,
          )
          osAtivasQtd = osAtivas.length
        }

        const capLivre = Math.max(0, capMax - osAtivasQtd)
        let tendencia = 'estavel'
        if (prestId) {
          const osHist = $app.findRecordsByFilter(
            'ordens_servico',
            "prestador = '" + prestId + "' && (status = 'encerrada' || status = 'concluida')",
            '-data_conclusao',
            5,
            0,
          )
          const atrasos = []
          for (let h = 0; h < osHist.length; h++) {
            const dtPrev = osHist[h].getString('data_previsao_fim')
            const dtFim = osHist[h].getString('data_conclusao') || new Date().toISOString()
            if (dtPrev) {
              const diffDias = Math.floor(
                (new Date(dtFim).getTime() - new Date(dtPrev).getTime()) / (1000 * 60 * 60 * 24),
              )
              atrasos.push(diffDias)
            }
          }
          if (atrasos.length >= 2) {
            if (atrasos[0] < atrasos[1]) tendencia = 'melhorou'
            else if (atrasos[0] > atrasos[1]) tendencia = 'piorou'
          }
        }

        const ultrapassaReferencia = valorReferencia > 0 && preco > valorReferencia

        let score = nota * 10
        score += capLivre * 5
        if (tendencia === 'melhorou') score += 8
        if (tendencia === 'piorou') score -= 12
        if (ultrapassaReferencia) score -= 20

        if (valorReferencia > 0 && preco > 0 && preco <= valorReferencia) {
          const economia = valorReferencia - preco
          score += (economia / valorReferencia) * 20
        }

        ranking.push({
          cotacao_id: c.id,
          prestador_id: prestId,
          prestador_nome: prestador ? prestador.getString('nome') : 'Prestador',
          prestador_tipo: prestador ? prestador.getString('tipo') : 'pf_externo',
          status: c.getString('status'),
          preco_ofertado: preco,
          prazo_ofertado: prazo,
          data_resposta: c.getString('data_resposta'),
          observacoes: c.getString('observacoes'),
          escolhida: Boolean(c.getBool('escolhida')),
          nota_geral: nota,
          tendencia: tendencia,
          capacidade_maxima: capMax,
          carga_atual: osAtivasQtd,
          capacidade_livre: capLivre,
          ultrapassa_referencia: ultrapassaReferencia,
          score_final: Math.round(score * 10) / 10,
          respondida: respondida,
        })
      }

      ranking.sort((a, b) => {
        if (a.respondida && !b.respondida) return -1
        if (!a.respondida && b.respondida) return 1
        return b.score_final - a.score_final
      })

      return e.json(200, {
        pacote_id: pacoteId,
        pacote_nome: pacote.getString('nome'),
        disciplina: pacote.getString('disciplina'),
        valor_interno_referencia: valorReferencia,
        valor_vendido: valorVendido,
        total: ranking.length,
        ranking: ranking,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar ranking: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 6. ENDPOINT: Escolha do Gestor (um clique) -> Gera OS externa com trava do teto
// POST /backend/v1/cotacoes/{id}/escolher
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/cotacoes/{id}/escolher',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Apenas Administradores e Gestores podem escolher propostas.' })
      }

      const cotacaoId = e.request.pathValue('id')
      let cotacao
      try {
        cotacao = $app.findRecordById('cotacoes', cotacaoId)
      } catch (_) {
        return e.json(404, { error: 'Cotação não encontrada' })
      }

      const precoOfertado = cotacao.getFloat('preco_ofertado') || 0
      if (precoOfertado <= 0) {
        return e.json(400, {
          error:
            'A cotação precisa possuir um preço ofertado válido antes de ser escolhida para contratação.',
        })
      }

      const prestadorId = cotacao.getString('prestador')
      if (!prestadorId) {
        return e.json(400, { error: 'Cotação não possui prestador vinculado.' })
      }

      const prestador = $app.findRecordById('prestadores', prestadorId)
      if (!prestador) {
        return e.json(404, { error: 'Prestador não encontrado.' })
      }

      // Validar contrato-mestre assinado
      const cmAssinados = $app.findRecordsByFilter(
        'contratos_mestre',
        "prestador = '" + prestadorId + "' && status = 'assinado'",
        '-created',
        1,
        0,
      )
      if (cmAssinados.length === 0) {
        return e.json(400, {
          error:
            'BLOQUEIO: O prestador ' +
            prestador.getString('nome') +
            ' não possui Contrato-Mestre assinado ativo. Providencie a assinatura do CM antes de gerar a OS.',
        })
      }
      const contratoMestre = cmAssinados[0]

      const pacoteId = cotacao.getString('pacote') || cotacao.getString('etapa')
      let pacote = null
      let projetoId = cotacao.getString('projeto')

      if (pacoteId) {
        try {
          pacote = $app.findRecordById('projeto_etapas', pacoteId)
          if (!projetoId && pacote) {
            projetoId = pacote.getString('projeto')
          }
        } catch (_) {}
      }

      if (!projetoId) {
        return e.json(400, { error: 'Projeto de referência da cotação não identificado.' })
      }

      const disciplina =
        cotacao.getString('disciplina') || (pacote ? pacote.getString('disciplina') : 'Engenharia')
      const escopo =
        cotacao.getString('escopo') || (pacote ? pacote.getString('escopo_detalhado') : '')

      let prazoDias = 30
      const prazoOfertadoStr = cotacao.getString('prazo_ofertado') || ''
      const numMatch = prazoOfertadoStr.match(/\d+/)
      if (numMatch) {
        prazoDias = parseInt(numMatch[0], 10) || 30
      }

      // Criar Ordem de Serviço Externa
      const osCol = $app.findCollectionByNameOrId('ordens_servico')
      const novaOS = new Record(osCol)

      novaOS.set('projeto', projetoId)
      novaOS.set('prestador', prestadorId)
      novaOS.set('contrato_mestre', contratoMestre.id)
      novaOS.set('tipo_prestador', 'externo')
      novaOS.set('disciplina', disciplina)
      novaOS.set(
        'escopo_tecnico',
        escopo || 'Execução do pacote de trabalho ' + (pacote ? pacote.getString('nome') : ''),
      )
      novaOS.set('prazo_dias', prazoDias)
      novaOS.set('valor_os', precoOfertado)

      const dtInicio = new Date()
      const dtFim = new Date(dtInicio.getTime() + prazoDias * 24 * 60 * 60 * 1000)
      novaOS.set('data_inicio', dtInicio.toISOString().substring(0, 10) + ' 12:00:00.000Z')
      novaOS.set('data_previsao_fim', dtFim.toISOString().substring(0, 10) + ' 12:00:00.000Z')

      const percRetencao = prestador.getFloat('retencao_tecnica_padrao') || 5.0
      novaOS.set('percentual_retencao_tecnica', percRetencao)
      novaOS.set('status_retencao', 'acumulando')
      novaOS.set('status', 'minuta')

      novaOS.set('parcelas_json', [
        {
          ordem: 1,
          descricao: 'Entrega e Aprovação Técnica Final',
          percentual: 100,
          valor: precoOfertado,
          vencimento: dtFim.toISOString().substring(0, 10),
        },
      ])

      // $app.save valida o teto vendido em prestadores_os_operations.js
      $app.save(novaOS)

      // Marcar cotação como escolhida
      cotacao.set('escolhida', true)
      cotacao.set('status', 'escolhida')
      $app.save(cotacao)

      if (pacoteId) {
        const outras = $app.findRecordsByFilter(
          'cotacoes',
          "(pacote = '" +
            pacoteId +
            "' || etapa = '" +
            pacoteId +
            "') && id != '" +
            cotacao.id +
            "'",
          '',
          50,
          0,
        )
        for (let o = 0; o < outras.length; o++) {
          outras[o].set('escolhida', false)
          if (outras[o].getString('status') === 'convite_enviado') {
            outras[o].set('status', 'encerrada')
            outras[o].set('motivo_encerramento', 'Outra proposta foi escolhida pelo Gestor.')
            $app.save(outras[o])
          }
        }

        if (pacote) {
          pacote.set('ordem_servico_ativa', novaOS.id)
          pacote.set('status', 'em_andamento')
          $app.save(pacote)

          const entregaveisPacote = $app.findRecordsByFilter(
            'entregaveis',
            "etapa = '" + pacoteId + "'",
            '',
            50,
            0,
          )
          for (let eIdx = 0; eIdx < entregaveisPacote.length; eIdx++) {
            const ent = entregaveisPacote[eIdx]
            ent.set('prestador', prestadorId)
            ent.set('ordem_servico', novaOS.id)
            ent.set('status', 'atribuido')
            $app.save(ent)
          }
        }
      }

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('acao', 'COTACAO_ESCOLHIDA_OS_GERADA')
        aRec.set('entidade', 'ordens_servico')
        aRec.set('registro_id', novaOS.id)
        aRec.set('detalhes', {
          cotacao_id: cotacao.id,
          pacote_id: pacoteId,
          prestador_id: prestadorId,
          prestador_nome: prestador.getString('nome'),
          numero_os: novaOS.getString('numero'),
          valor_os: precoOfertado,
          prazo_dias: prazoDias,
        })
        aRec.set('ip', reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1')
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        mensagem: 'Proposta escolhida e Ordem de Serviço gerada com sucesso!',
        os_id: novaOS.id,
        numero_os: novaOS.getString('numero'),
        valor_os: precoOfertado,
        status_os: novaOS.getString('status'),
      })
    } catch (err) {
      return e.json(400, { error: err.message || String(err) })
    }
  },
  $apis.requireAuth(),
)
