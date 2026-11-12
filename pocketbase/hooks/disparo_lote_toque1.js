// Endpoints da Disparo em Lote do Toque 1 (e-mail de apresentação com modelo + portfólio anexo):
// 1. POST /backend/v1/cadencia/disparo-lote        — enfileira (ou envia teste) — SÓ ADMIN
// 2. POST /backend/v1/empresas/parceira-existente  — selo de parceira legada — SÓ ADMIN
// 3. cron 'disparo-lote-toque1' — processa a fila (1 envio por execução, espaçado >= 15s)
// Permissões checadas AQUI (hooks de REQUISIÇÃO — requestInfo/auth), nunca em hook de MODELO.
// Callbacks rodam em VMs separadas: helpers usados em mais de um callback ficam INLINE em cada um.

// ---------- Rota 1: disparo-lote ----------
routerAdd(
  'POST',
  '/backend/v1/cadencia/disparo-lote',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }
      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, { message: 'Apenas Administradores podem disparar o lote do Toque 1' })
      }

      const body = reqInfo.body || {}
      const empresaIds = Array.isArray(body.empresa_ids) ? body.empresa_ids : []
      const emailTeste = (body.email_teste || '').toString().trim()

      if (!empresaIds.length) {
        return e.json(400, { message: 'Informe ao menos uma empresa (empresa_ids)' })
      }
      if (empresaIds.length > 500) {
        return e.json(400, { message: 'Máximo de 500 empresas por lote' })
      }

      const modelos = $app.findRecordsByFilter('modelos_email', 'ativo = true', '-created', 1, 0)
      if (!modelos.length) {
        return e.json(400, {
          message: 'Modelo aprovado do Toque 1 não encontrado (modelos_email ativo)',
        })
      }
      const modelo = modelos[0]

      // padrão JSVM v0.23 (Record não tem getFileName/getFilePath):
      // nome via record.get + caminho via record.baseFilesPath()
      let anexoReader = null
      let anexoNome = 'portfolio-gmais.pdf'
      try {
        const nomeAnexo = modelo.getString('anexo_portfolio') || ''
        if (nomeAnexo) {
          anexoReader = $app.newFilesystem().getFile(modelo.baseFilesPath() + '/' + nomeAnexo)
          anexoNome = nomeAnexo
        }
      } catch (aErr) {
        console.log('aviso anexo_portfolio: ' + aErr)
      }

      const baseUrl =
        typeof getAppBaseUrl === 'function' ? getAppBaseUrl() : $os.getenv('PUBLIC_APP_URL') || ''

      // ---- modo TESTE: envia 1 e-mail, não altera nenhum registro ----
      if (emailTeste) {
        const primeira = $app.findRecordById('empresas', empresaIds[0])
        if (!primeira) {
          return e.json(404, { message: 'Empresa (para placeholder) não encontrada' })
        }
        const nomeEmpresa =
          primeira.getString('nome_fantasia') || primeira.getString('razao_social') || 'Empresa'
        const corpo = modelo.getString('corpo_html').replace(/\{\{empresa\}\}/g, nomeEmpresa)
        const assunto = modelo.getString('assunto')

        // mailer.Message da JSVM não tem replyTo (e não aceita atribuir depois de criar):
        // o remetente já é grupomais.sae@gmail.com, então as respostas voltam para ele.
        // attachments deve nascer como mapa vazio NO construtor (undefined depois falha).
        const msg = new MailerMessage({
          from: { address: 'grupomais.sae@gmail.com', name: 'G+ Engenharia' },
          to: [{ address: emailTeste, name: 'Teste' }],
          subject: assunto,
          html: corpo,
          attachments: {},
        })
        if (anexoReader) {
          try {
            msg.attachments[anexoNome] = anexoReader.reader.open()
          } catch (anexoErr) {
            console.log('aviso anexo (abertura): ' + anexoErr)
          }
        }
        $app.newMailClient().send(msg)

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'DISPARO_TOQUE1_TESTE')
          aRec.set('entidade', 'modelos_email')
          aRec.set('registro_id', modelo.id)
          aRec.set('detalhes', {
            email_teste: emailTeste,
            empresa_placeholder: nomeEmpresa,
            com_anexo: !!anexoReader,
          })
          aRec.set('ip', (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '')
          $app.save(aRec)
        } catch (_) {}

        return e.json(200, { teste: true, enviado: true, para: emailTeste })
      }

      // ---- modo LOTE: cria lote e enfileira ----
      const loteCol = $app.findCollectionByNameOrId('lotes_disparo')
      const filaCol = $app.findCollectionByNameOrId('fila_disparo')

      const lote = new Record(loteCol)
      lote.set('status', 'processando')
      lote.set('total', empresaIds.length)
      lote.set('enviados', 0)
      lote.set('pulados', 0)
      lote.set('erros', [])
      lote.set('avisos', [])
      lote.set('iniciado_por', reqInfo.auth.id)
      lote.set('iniciado_por_email', reqInfo.auth.getString('email'))
      $app.save(lote)

      let enfileiradas = 0
      for (let i = 0; i < empresaIds.length; i++) {
        try {
          $app.findRecordById('empresas', empresaIds[i])
        } catch (empErr) {
          try {
            const avisos = lote.get('avisos') || []
            avisos.push({ empresa_id: empresaIds[i], motivo: 'empresa não encontrada' })
            lote.set('avisos', avisos)
            $app.save(lote)
          } catch (_) {}
          continue
        }
        const item = new Record(filaCol)
        item.set('lote', lote.id)
        item.set('empresa', empresaIds[i])
        item.set('status', 'pendente')
        $app.save(item)
        enfileiradas++
      }

      return e.json(200, { lote_id: lote.id, enfileiradas: enfileiradas })
    } catch (err) {
      console.log('Erro no disparo-lote: ' + err)
      return e.json(500, { message: 'Erro interno no disparo do lote: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ---------- Rota 2: parceira-existente ----------
routerAdd(
  'POST',
  '/backend/v1/empresas/parceira-existente',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }
      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, { message: 'Apenas Administradores podem registrar parceira legada' })
      }

      const body = reqInfo.body || {}
      const empresaId = body.empresa_id
      const motivo = (body.motivo || '').toString().trim()
      if (!empresaId || !motivo) {
        return e.json(400, { message: 'Parâmetros obrigatórios: empresa_id e motivo' })
      }

      const empresa = $app.findRecordById('empresas', empresaId)
      if (!empresa) {
        return e.json(404, { message: 'Empresa não encontrada' })
      }

      // Guarda etapa anterior (se já estava marcada como parceira, mantém a existente)
      let etapaAnterior = empresa.getString('etapa_anterior') || ''
      if (empresa.getString('etapa_funil') !== 'parceira') {
        etapaAnterior = empresa.getString('etapa_funil') || etapaAnterior
      }

      empresa.set('etapa_funil', 'parceira')
      empresa.set('is_parceira', true)
      empresa.set('data_selo_parceira', new Date().toISOString())
      if (etapaAnterior) {
        empresa.set('etapa_anterior', etapaAnterior)
      }
      $app.save(empresa)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'PARCEIRA_EXISTENTE_LEGADO')
        aRec.set('entidade', 'empresas')
        aRec.set('registro_id', empresaId)
        aRec.set('detalhes', { motivo: motivo, etapa_anterior: etapaAnterior })
        aRec.set('ip', (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '')
        $app.save(aRec)
      } catch (aErr) {
        console.log('Erro auditoria parceira-existente: ' + aErr)
      }

      return e.json(200, {
        success: true,
        message: 'Empresa marcada como parceira (legado) com auditoria registrada.',
      })
    } catch (err) {
      console.log('Erro parceira-existente: ' + err)
      return e.json(500, { message: 'Erro interno: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ---------- Cron de TOPO: processa fila (1 envio por execução, espaçamento >= 15s) ----------
cronAdd('disparo-lote-toque1', '* * * * *', () => {
  try {
    // espaçamento: último envio do lote foi há menos de 15s -> pula execução
    const agoraMs = new Date().getTime()
    const ultimo = $app.findRecordsByFilter('fila_disparo', "status = 'enviada'", '-updated', 1, 0)
    if (ultimo.length > 0) {
      const t = new Date(ultimo[0].getString('updated')).getTime()
      if (agoraMs - t < 15000) {
        return
      }
    }

    // 1 item pendente por execução (mais antigo primeiro)
    const itens = $app.findRecordsByFilter('fila_disparo', "status = 'pendente'", 'created', 1, 0)
    if (!itens.length) {
      return
    }
    const item = itens[0]
    const loteId = item.getString('lote')
    const empresaId = item.getString('empresa')

    // marca processando (evita reprocessar caso a execução caia)
    item.set('status', 'enviada')
    $app.save(item)

    let empresa
    try {
      empresa = $app.findRecordById('empresas', empresaId)
    } catch (_) {
      empresa = null
    }
    if (!empresa) {
      item.set('status', 'erro')
      item.set('erro_detalhe', 'empresa não encontrada')
      $app.save(item)
      try {
        const lote = $app.findRecordById('lotes_disparo', loteId)
        const erros = lote.get('erros') || []
        erros.push({ empresa_id: empresaId, erro: 'empresa não encontrada' })
        lote.set('erros', erros)
        $app.save(lote)
      } catch (_) {}
      return
    }

    const emailEmpresa = empresa.getString('email') || ''
    const nomeEmpresa =
      empresa.getString('nome_fantasia') || empresa.getString('razao_social') || 'Empresa'

    // ---------- Salvaguardas (marca pulado com motivo, sem tocar na empresa) ----------
    let motivoPulo = ''

    if (!emailEmpresa.trim()) {
      motivoPulo = 'sem e-mail cadastrado'
    } else if (empresa.getBool('cadencia_bloqueada_sancao')) {
      motivoPulo = 'cadência bloqueada por sanção'
    } else {
      // Toque 1 já realizado?
      const toque1 = $app.findRecordsByFilter(
        'toques',
        "empresa = '" + empresaId + "' && numero_toque = 1 && status = 'realizado'",
        '-created',
        1,
        0,
      )
      if (toque1.length > 0) {
        motivoPulo = 'Toque 1 já realizado'
      } else {
        const bloqueioEmpresa = $app.findRecordsByFilter(
          'nao_contatar',
          "empresa = '" + empresaId + "'",
          '-created',
          1,
          0,
        )
        if (bloqueioEmpresa.length > 0) {
          motivoPulo = 'empresa em não_contatar'
        } else {
          const bloqueioEmail = $app.findRecordsByFilter(
            'nao_contatar',
            "email = '" + emailEmpresa.replace(/'/g, "''") + "'",
            '-created',
            1,
            0,
          )
          if (bloqueioEmail.length > 0) {
            motivoPulo = 'e-mail em não_contatar'
          }
        }
      }
    }

    if (motivoPulo) {
      item.set('status', 'pulada')
      item.set('motivo', motivoPulo)
      $app.save(item)
      try {
        const lote = $app.findRecordById('lotes_disparo', loteId)
        lote.set('pulados', (lote.getInt('pulados') || 0) + 1)
        $app.save(lote)
      } catch (_) {}
      return
    }

    // ---------- Monta corpo (modelo + placeholder + rodapé LGPD) ----------
    let modelo = null
    try {
      const modelos = $app.findRecordsByFilter('modelos_email', 'ativo = true', '-created', 1, 0)
      if (modelos.length) modelo = modelos[0]
    } catch (_) {}
    if (!modelo) {
      item.set('status', 'erro')
      item.set('erro_detalhe', 'modelo ativo não encontrado')
      $app.save(item)
      try {
        const lote = $app.findRecordById('lotes_disparo', loteId)
        const erros = lote.get('erros') || []
        erros.push({ empresa_id: empresaId, erro: 'modelo ativo não encontrado' })
        lote.set('erros', erros)
        $app.save(lote)
      } catch (_) {}
      return
    }

    const baseUrl =
      typeof getAppBaseUrl === 'function' ? getAppBaseUrl() : $os.getenv('PUBLIC_APP_URL') || ''
    const linkDescadastro =
      baseUrl + '/descadastro?email=' + encodeURIComponent(emailEmpresa.trim())

    const rodape =
      '<p style="font-size:11px;color:#94a3b8;margin-top:16px">Recebeste este e-mail por cadência comercial da G+ Engenharia. ' +
      '<a href="' +
      linkDescadastro +
      '" style="color:#94a3b8">Não quero mais receber</a></p>'

    const corpoHtml = modelo
      .getString('corpo_html')
      .replace(/\{\{empresa\}\}/g, nomeEmpresa)
      .replace('</div>', rodape + '</div>')

    const assunto = modelo.getString('assunto')

    // ---------- Anexo do portfólio ----------
    // padrão JSVM v0.23 (Record não tem getFileName/getFilePath):
    // nome via record.get + caminho via record.baseFilesPath()
    let anexoReader = null
    let anexoNome = 'portfolio-gmais.pdf'
    try {
      const nomeAnexo = modelo.getString('anexo_portfolio') || ''
      if (nomeAnexo) {
        anexoReader = $app.newFilesystem().getFile(modelo.baseFilesPath() + '/' + nomeAnexo)
        anexoNome = nomeAnexo
      }
    } catch (aErr) {
      console.log('aviso anexo_portfolio (cron): ' + aErr)
    }

    // ---------- Envio ----------
    try {
      // mailer.Message da JSVM não tem replyTo (e não aceita atribuir depois de criar):
      // o remetente já é grupomais.sae@gmail.com, então as respostas voltam para ele.
      // attachments deve nascer como mapa vazio NO construtor (undefined depois falha).
      const msg = new MailerMessage({
        from: { address: 'grupomais.sae@gmail.com', name: 'G+ Engenharia' },
        to: [{ address: emailEmpresa.trim(), name: nomeEmpresa }],
        subject: assunto,
        html: corpoHtml,
        attachments: {},
      })
      if (anexoReader) {
        try {
          msg.attachments[anexoNome] = anexoReader.reader.open()
        } catch (anexoErr) {
          console.log('aviso anexo (abertura): ' + anexoErr)
        }
      }
      $app.newMailClient().send(msg)
    } catch (mailErr) {
      item.set('status', 'erro')
      item.set('erro_detalhe', String(mailErr).substring(0, 300))
      $app.save(item)
      try {
        const lote = $app.findRecordById('lotes_disparo', loteId)
        const erros = lote.get('erros') || []
        erros.push({ empresa_id: empresaId, erro: String(mailErr).substring(0, 300) })
        lote.set('erros', erros)
        $app.save(lote)
      } catch (_) {}
      return
    }

    // ---------- Pós-envio: toque, etapa, auditoria ----------
    try {
      // Cria a cadência padrão (Toque 1/2/3) se não existir; marca o Toque 1 como realizado
      const toquesCol = $app.findCollectionByNameOrId('toques')
      const agora = new Date()
      const iso = agora.toISOString()

      const existentes = $app.findRecordsByFilter(
        'toques',
        "empresa = '" + empresaId + "'",
        'numero_toque',
        10,
        0,
      )
      let toque1Rec = null
      const mapa = {}
      for (let i = 0; i < existentes.length; i++) {
        mapa[existentes[i].getInt('numero_toque')] = existentes[i]
      }

      for (let n = 1; n <= 3; n++) {
        if (mapa[n]) {
          if (n === 1) toque1Rec = mapa[1]
          continue
        }
        const t = new Record(toquesCol)
        t.set('empresa', empresaId)
        t.set('numero_toque', n)
        t.set('canal', n === 1 ? 'email' : 'whatsapp')
        const prev = new Date(agora.getTime() + (n === 2 ? 2 : 7) * 86400000)
        t.set('data_prevista', prev.toISOString().substring(0, 10) + ' 12:00:00.000Z')
        t.set('status', n === 1 ? 'realizado' : 'agendado')
        t.set('resultado', n === 1 ? 'enviado' : '')
        t.set('observacao', n === 1 ? 'Toque 1 enviado no disparo em lote.' : '')
        $app.save(t)
        if (n === 1) toque1Rec = t
      }

      if (toque1Rec) {
        toque1Rec.set('data_realizada', iso)
        toque1Rec.set('status', 'realizado')
        toque1Rec.set('resultado', 'enviado')
        toque1Rec.set('observacao', 'Toque 1 enviado no disparo em lote.')
        $app.save(toque1Rec)
        item.set('toque', toque1Rec.id)
      }

      // Etapa do funil
      const etapaAnterior = empresa.getString('etapa_funil') || ''
      if (etapaAnterior && empresa.getString('etapa_funil') !== 'em_cadencia') {
        empresa.set('etapa_anterior', etapaAnterior)
      }
      empresa.set('etapa_funil', 'em_cadencia')
      $app.save(empresa)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'DISPARO_TOQUE1_LOTE')
        aRec.set('entidade', 'empresas')
        aRec.set('registro_id', empresaId)
        aRec.set('detalhes', {
          lote_id: loteId,
          email: emailEmpresa.trim(),
          empresa_nome: nomeEmpresa,
          etapa_anterior: etapaAnterior,
          etapa_nova: 'em_cadencia',
        })
        $app.save(aRec)
      } catch (_) {}
    } catch (posErr) {
      console.log('Erro pós-envio lote: ' + posErr)
    }

    item.set('status', 'enviada')
    $app.save(item)

    try {
      const lote = $app.findRecordById('lotes_disparo', loteId)
      lote.set('enviados', (lote.getInt('enviados') || 0) + 1)
      $app.save(lote)
    } catch (_) {}

    // ---------- Fim do lote: grava relatório e status ----------
    try {
      const lote = $app.findRecordById('lotes_disparo', loteId)
      const restantes = $app.findRecordsByFilter(
        'fila_disparo',
        "lote = '" + loteId + "' && status = 'pendente'",
        'created',
        1,
        0,
      )
      if (!restantes.length) {
        const erros = lote.get('erros') || []
        const statusFinal = erros.length > 0 ? 'concluido_com_erros' : 'concluido'
        lote.set('status', statusFinal)
        lote.set('concluido_em', new Date().toISOString())
        lote.set('relatorio', {
          enviados: lote.getInt('enviados') || 0,
          pulados: lote.getInt('pulados') || 0,
          erros: erros.length,
        })
        $app.save(lote)
      }
    } catch (relErr) {
      console.log('Erro relatório lote: ' + relErr)
    }
  } catch (cronErr) {
    console.log('Cron disparo-lote-toque1 falhou: ' + cronErr)
  }
})
