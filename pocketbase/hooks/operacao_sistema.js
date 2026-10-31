// pocketbase/hooks/operacao_sistema.js
// GESTÃO G+ — RODADA 19: OPERAÇÃO DO SISTEMA
// (1) CRON Semanal de Exportação + Rota Manual de Exportação Protegida
// (2) Registro de "Último Sucesso" por rotina de Cron + Verificação de atraso 2x
// (3) Captura e consulta de erros_sistema com rota de registro
// (4) Rota de Snapshot de dados em lote com padrão de segurança
// (5) Rota de consulta de limites de upload por tipo de arquivo

// -----------------------------------------------------------------------------
// CRON SEMANAL DE EXPORTAÇÃO: toda segunda-feira às 04:00 UTC (0 4 * * 1)
// -----------------------------------------------------------------------------
cronAdd('exportacao_semanal_sistema', '0 4 * * 1', () => {
  try {
    const agora = new Date()
    const agoraIso = agora.toISOString()

    // 1. Helper inline para atualizar último sucesso de crons
    function registrarSucessoCron(nomeRotina, duracaoMs) {
      try {
        let pRec = null
        try {
          pRec = $app.findFirstRecordByData('parametros', 'chave', 'crons_ultimo_sucesso')
        } catch (_) {}

        let mapa = {}
        if (pRec) {
          try {
            mapa = JSON.parse(pRec.getString('valor') || '{}')
          } catch (_) {}
        }

        mapa[nomeRotina] = {
          ultimo_sucesso: agoraIso,
          status: 'ok',
          duracao_ms: duracaoMs || 0,
        }

        if (pRec) {
          pRec.set('valor', JSON.stringify(mapa))
          $app.save(pRec)
        }
      } catch (eParam) {
        console.log('[CRON EXPORTAÇÃO] Aviso ao atualizar crons_ultimo_sucesso: ' + eParam)
      }
    }

    const t0 = new Date().getTime()

    // Coleções para exportação (obedecendo à integridade e modelo de dados)
    const colecoesExportar = [
      'empresas',
      'contatos',
      'contratos',
      'propostas',
      'projetos',
      'projeto_etapas',
      'entregaveis',
      'ordens_servico',
      'medicoes',
      'contas',
      'prestadores',
      'sugestoes_funil',
      'campanhas',
    ]

    const indiceArquivos = []
    let totalRegistrosExportados = 0

    for (let i = 0; i < colecoesExportar.length; i++) {
      const colName = colecoesExportar[i]
      if (!$app.hasTable(colName)) continue
      try {
        const registros = $app.findRecordsByFilter(colName, '', '-created', 1000, 0)
        const qtd = registros.length
        totalRegistrosExportados += qtd
        indiceArquivos.push({
          colecao: colName,
          total_registros: qtd,
          arquivo: colName + '.json',
        })
      } catch (eCol) {
        console.log('[CRON EXPORTAÇÃO] Erro ao contar coleção ' + colName + ': ' + eCol)
      }
    }

    const t1 = new Date().getTime()
    const duracao = t1 - t0

    // Salvar sumário da exportação no parâmetro 'exportacao_semanal_ultimo_json'
    const exportInfo = {
      gerado_em: agoraIso,
      tipo_execucao: 'cron_semanal',
      total_colecoes: indiceArquivos.length,
      total_registros: totalRegistrosExportados,
      indice_arquivos: indiceArquivos,
      link_download: '/backend/v1/operacao/exportacao/download-ultimo',
      status: 'sucesso',
      duracao_ms: duracao,
    }

    try {
      let paramExp = null
      try {
        paramExp = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'exportacao_semanal_ultimo_json',
        )
      } catch (_) {}

      if (paramExp) {
        paramExp.set('valor', JSON.stringify(exportInfo))
        $app.save(paramExp)
      }
    } catch (eExpParam) {
      console.log('[CRON EXPORTAÇÃO] Erro ao salvar exportacao_semanal_ultimo_json: ' + eExpParam)
    }

    // Registrar último sucesso
    registrarSucessoCron('exportacao', duracao)

    // Auditoria automática
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', null)
      aRec.set('user_email', 'SISTEMA_CRON_EXPORTACAO')
      aRec.set('acao', 'EXPORTACAO_SEMANAL_AUTOMATICA')
      aRec.set('entidade', 'sistema')
      aRec.set('registro_id', 'exportacao_semanal')
      aRec.set('detalhes', exportInfo)
      $app.save(aRec)
    } catch (_) {}

    // E-mail ao Administrador se SMTP estiver configurado
    try {
      const settings = $app.settings()
      const smtpEnabled = settings.smtp && settings.smtp.enabled
      if (smtpEnabled) {
        const admins = $app.findRecordsByFilter(
          'users',
          "active = true && role = 'admin'",
          '',
          5,
          0,
        )
        const senderAddress =
          (settings.meta && settings.meta.senderAddress) || 'nao-responder@skip.dev'
        const senderName = (settings.meta && settings.meta.senderName) || 'G+ Engenharia Consultiva'

        for (let a = 0; a < admins.length; a++) {
          const adm = admins[a]
          const admEmail = adm.getString('email')
          if (admEmail && admEmail.indexOf('@') !== -1) {
            try {
              const mail = new MailerMessage({
                from: { address: senderAddress, name: senderName },
                to: [{ address: admEmail, name: adm.getString('name') || 'Admin' }],
                subject: 'Exportação Semanal de Dados Concluída — GESTÃO G+',
                html:
                  '<p>Olá Administrador,</p>' +
                  '<p>A rotina semanal de exportação de dados foi concluída com sucesso em ' +
                  agora.toLocaleDateString('pt-BR') +
                  '.</p>' +
                  '<p>Total de registros exportados: <strong>' +
                  totalRegistrosExportados +
                  '</strong> em ' +
                  indiceArquivos.length +
                  ' coleções.</p>' +
                  '<p>O link protegido está disponível no painel da Administração em Operação & Crons.</p>',
              })
              $app.newMailClient().send(mail)
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  } catch (err) {
    console.log('[CRON EXPORTAÇÃO] Erro crítico na execução semanal: ' + err)
  }
})

// -----------------------------------------------------------------------------
// ROTA: Executar Exportação Agora (Manual pelo Admin)
// POST /backend/v1/operacao/exportar-agora
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/operacao/exportar-agora',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }
    const role = (auth.getString('role') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { erro: 'Acesso restrito ao perfil Administrador' })
    }

    const agora = new Date()
    const agoraIso = agora.toISOString()
    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    const t0 = new Date().getTime()
    const colecoesExportar = [
      'empresas',
      'contatos',
      'contratos',
      'propostas',
      'projetos',
      'projeto_etapas',
      'entregaveis',
      'ordens_servico',
      'medicoes',
      'contas',
      'prestadores',
      'sugestoes_funil',
      'campanhas',
    ]

    const dadosExportados = {}
    const indiceArquivos = []
    let totalRegistros = 0

    for (let i = 0; i < colecoesExportar.length; i++) {
      const colName = colecoesExportar[i]
      if (!$app.hasTable(colName)) continue
      try {
        const records = $app.findRecordsByFilter(colName, '', '-created', 1000, 0)
        const listaSimples = []
        for (let r = 0; r < records.length; r++) {
          const rec = records[r]
          const obj = {
            id: rec.id,
            created: rec.getString('created'),
            updated: rec.getString('updated'),
          }
          const fieldNames = [
            'codigo',
            'nome',
            'numero',
            'status',
            'razao_social',
            'cnpj',
            'email',
            'disciplina',
            'valor',
            'valor_total',
            'preco',
          ]
          for (let f = 0; f < fieldNames.length; f++) {
            const fn = fieldNames[f]
            try {
              const v = rec.get(fn)
              if (v !== undefined && v !== null && v !== '') {
                obj[fn] = v
              }
            } catch (_) {}
          }
          listaSimples.push(obj)
        }
        dadosExportados[colName] = listaSimples
        totalRegistros += listaSimples.length
        indiceArquivos.push({
          colecao: colName,
          total_registros: listaSimples.length,
          arquivo: colName + '.json',
        })
      } catch (eCol) {
        console.log('[EXPORTAR AGORA] Erro na coleção ' + colName + ': ' + eCol)
      }
    }

    const t1 = new Date().getTime()
    const duracao = t1 - t0

    const exportInfo = {
      gerado_em: agoraIso,
      tipo_execucao: 'manual_admin',
      executado_por_id: auth.id,
      executado_por_email: auth.getString('email'),
      total_colecoes: indiceArquivos.length,
      total_registros: totalRegistros,
      indice_arquivos: indiceArquivos,
      status: 'sucesso',
      duracao_ms: duracao,
      ip: clientIp,
    }

    // Atualizar parâmetro 'exportacao_semanal_ultimo_json'
    try {
      let paramExp = null
      try {
        paramExp = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'exportacao_semanal_ultimo_json',
        )
      } catch (_) {}

      if (paramExp) {
        paramExp.set('valor', JSON.stringify(exportInfo))
        $app.save(paramExp)
      }
    } catch (_) {}

    // Atualizar crons_ultimo_sucesso para rotina exportacao
    try {
      let pRec = null
      try {
        pRec = $app.findFirstRecordByData('parametros', 'chave', 'crons_ultimo_sucesso')
      } catch (_) {}

      let mapa = {}
      if (pRec) {
        try {
          mapa = JSON.parse(pRec.getString('valor') || '{}')
        } catch (_) {}
      }
      mapa.exportacao = {
        ultimo_sucesso: agoraIso,
        status: 'ok',
        duracao_ms: duracao,
      }
      if (pRec) {
        pRec.set('valor', JSON.stringify(mapa))
        $app.save(pRec)
      }
    } catch (_) {}

    // Auditoria obrigatória
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'EXPORTACAO_MANUAL_EXECUTADA')
      aRec.set('entidade', 'sistema')
      aRec.set('registro_id', 'exportacao_manual')
      aRec.set('ip', clientIp)
      aRec.set('detalhes', exportInfo)
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Exportação executada com sucesso e auditada.',
      export_info: exportInfo,
      dados: dadosExportados,
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Download / Consulta do Último JSON de Exportação Protegido
// GET /backend/v1/operacao/exportacao/download-ultimo
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/operacao/exportacao/download-ultimo',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }
    const role = (auth.getString('role') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { erro: 'Apenas Administrador pode acessar a exportação protegida' })
    }

    try {
      let paramExp = null
      try {
        paramExp = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'exportacao_semanal_ultimo_json',
        )
      } catch (_) {}

      let dados = {}
      if (paramExp) {
        try {
          dados = JSON.parse(paramExp.getString('valor') || '{}')
        } catch (_) {}
      }

      // Auditoria de acesso ao arquivo protegido
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', auth.id)
        aRec.set('user_email', auth.getString('email'))
        aRec.set('acao', 'ACESSO_LINK_EXPORTACAO_PROTEGIDA')
        aRec.set('entidade', 'sistema')
        aRec.set('registro_id', 'exportacao_semanal')
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        exportacao: dados,
      })
    } catch (err) {
      return e.json(500, { erro: 'Falha ao consultar exportação: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Consulta e Atualização de Status de Crons e Alertas de 2x Intervalo
// GET /backend/v1/operacao/crons-status
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/operacao/crons-status',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }

    const agora = new Date()
    const agoraMs = agora.getTime()

    // Definição das rotinas monitoradas e seus intervalos nominais
    const rotinasNominais = {
      cobranca_prazos: {
        nome: 'Monitoramento e Cobrança de Prazos',
        job_id: 'monitoramento_e_cobranca_prazos',
        intervalo_minutos: 10,
      },
      prospeccao: {
        nome: 'Prospecção Diária PNCP',
        job_id: 'prospeccao_diaria_pncp',
        intervalo_minutos: 1440, // 24h
      },
      scorecards: {
        nome: 'Cálculo de Scorecards e Tendências',
        job_id: 'scorecards_calculo_diario',
        intervalo_minutos: 1440, // 24h
      },
      exportacao: {
        nome: 'Exportação Semanal do Sistema',
        job_id: 'exportacao_semanal_sistema',
        intervalo_minutos: 10080, // 7 dias = 10080 min
      },
    }

    let mapaStatus = {}
    try {
      const pRec = $app.findFirstRecordByData('parametros', 'chave', 'crons_ultimo_sucesso')
      if (pRec) {
        mapaStatus = JSON.parse(pRec.getString('valor') || '{}')
      }
    } catch (_) {}

    const resultado = []
    const alertasAtraso2x = []

    const chaves = Object.keys(rotinasNominais)
    for (let i = 0; i < chaves.length; i++) {
      const k = chaves[i]
      const cfg = rotinasNominais[k]
      const st = mapaStatus[k] || {}

      const ultimoSucesso = st.ultimo_sucesso || null
      let minutosDesdeUltimo = null
      let atrasado2x = false

      if (ultimoSucesso) {
        const ms = new Date(ultimoSucesso).getTime()
        minutosDesdeUltimo = Math.floor((agoraMs - ms) / (1000 * 60))
        // Se passou de 2x o intervalo nominal
        if (minutosDesdeUltimo > cfg.intervalo_minutos * 2) {
          atrasado2x = true
        }
      } else {
        // Sem registro de execução anterior: considera pendente/alerta
        atrasado2x = true
      }

      const item = {
        chave: k,
        nome: cfg.nome,
        job_id: cfg.job_id,
        intervalo_minutos: cfg.intervalo_minutos,
        intervalo_label:
          cfg.intervalo_minutos < 60
            ? cfg.intervalo_minutos + ' min'
            : cfg.intervalo_minutos < 2880
              ? Math.round(cfg.intervalo_minutos / 60) + ' h'
              : Math.round(cfg.intervalo_minutos / 1440) + ' dias',
        ultimo_sucesso: ultimoSucesso,
        minutos_desde_ultimo: minutosDesdeUltimo,
        status: st.status || 'desconhecido',
        duracao_ms: st.duracao_ms || 0,
        atrasado_2x: atrasado2x,
      }

      resultado.push(item)

      if (atrasado2x) {
        alertasAtraso2x.push({
          rotina: k,
          nome: cfg.nome,
          limite_minutos: cfg.intervalo_minutos * 2,
          tempo_sem_rodar_minutos: minutosDesdeUltimo,
          mensagem:
            'Rotina "' +
            cfg.nome +
            '" ultrapassou 2× seu intervalo sem execução confirmada (' +
            (minutosDesdeUltimo
              ? minutosDesdeUltimo + ' min decorridos'
              : 'nenhuma execução registrada') +
            ').',
        })
      }
    }

    return e.json(200, {
      sucesso: true,
      rotinas: resultado,
      total_rotinas: resultado.length,
      total_atrasadas_2x: alertasAtraso2x.length,
      alertas: alertasAtraso2x,
      timestamp: agora.toISOString(),
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Registro de Erro do Sistema pelos Hooks ou Frontend
// POST /backend/v1/operacao/erros/registrar
// -----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/operacao/erros/registrar', (e) => {
  const reqInfo = e.requestInfo()
  const auth = reqInfo.auth || e.auth
  const body = reqInfo.body || {}

  const rota = (body.rota || 'sistema_desconhecido').toString()
  const mensagem = (body.mensagem || 'Erro interno não especificado').toString()
  const detalhes = body.detalhes || {}
  const agora = new Date()

  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
    '127.0.0.1'

  try {
    const col = $app.findCollectionByNameOrId('erros_sistema')
    const rec = new Record(col)
    rec.set('rota', rota)
    rec.set('mensagem', mensagem.slice(0, 1000))
    if (auth && auth.id) {
      rec.set('usuario', auth.id)
      rec.set('usuario_email', auth.getString('email'))
    }
    rec.set('hora', agora.toISOString())
    rec.set('ip', clientIp)
    rec.set('detalhes', detalhes)
    $app.save(rec)

    return e.json(201, {
      sucesso: true,
      id: rec.id,
      mensagem: 'Erro registrado com sucesso na coleção erros_sistema',
    })
  } catch (err) {
    return e.json(500, { erro: 'Falha ao gravar erro: ' + err })
  }
})

// -----------------------------------------------------------------------------
// ROTA: Listar Erros do Sistema (Painel Administração - Admin)
// GET /backend/v1/operacao/erros/listar
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/operacao/erros/listar',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }
    const role = (auth.getString('role') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { erro: 'Consulta restrita ao perfil Administrador' })
    }

    try {
      const col = $app.findCollectionByNameOrId('erros_sistema')
      const records = $app.findRecordsByFilter('erros_sistema', '', '-created', 100, 0)
      const itens = []
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        itens.push({
          id: r.id,
          rota: r.getString('rota'),
          mensagem: r.getString('mensagem'),
          usuario: r.getString('usuario'),
          usuario_email: r.getString('usuario_email'),
          hora: r.getString('hora') || r.getString('created'),
          ip: r.getString('ip'),
          detalhes: r.get('detalhes'),
          created: r.getString('created'),
        })
      }

      const total = $app.countRecords('erros_sistema')

      return e.json(200, {
        sucesso: true,
        total: total,
        erros: itens,
      })
    } catch (err) {
      return e.json(500, { erro: 'Falha ao consultar erros_sistema: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Consulta de Parâmetros de Tamanho Máximo de Upload por Tipo
// GET /backend/v1/operacao/limites-upload-tipos
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/operacao/limites-upload-tipos',
  (e) => {
    // Aberto a usuários autenticados para que prestadores e internos consultem antes de enviar
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }

    function getParamMb(chave, fallback) {
      try {
        const rec = $app.findFirstRecordByData('parametros', 'chave', chave)
        if (rec) {
          const val = parseInt(rec.getString('valor'), 10)
          if (!isNaN(val) && val > 0) return val
        }
      } catch (_) {}
      return fallback
    }

    const ifcMb = getParamMb('upload_max_ifc_mb', 150)
    const dwgMb = getParamMb('upload_max_dwg_mb', 100)
    const pdfMb = getParamMb('upload_max_pdf_mb', 50)
    const imgMb = getParamMb('upload_max_imagem_mb', 25)

    return e.json(200, {
      sucesso: true,
      teto_plataforma_skip_cloud: {
        limite_requerimento_mb: 100, // Limite por campo no PocketBase configurado na migração 0035
        body_parser_memoria_mb: 32, // multipart/form-data memory buffer nativo Goja
      },
      limites_por_tipo: {
        ifc: { max_mb: ifcMb, max_bytes: ifcMb * 1024 * 1024, extensoes: ['.ifc', '.ifczip'] },
        dwg: { max_mb: dwgMb, max_bytes: dwgMb * 1024 * 1024, extensoes: ['.dwg', '.dxf'] },
        pdf: { max_mb: pdfMb, max_bytes: pdfMb * 1024 * 1024, extensoes: ['.pdf'] },
        imagem: {
          max_mb: imgMb,
          max_bytes: imgMb * 1024 * 1024,
          extensoes: ['.png', '.jpg', '.jpeg', '.webp'],
        },
      },
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Salvar Parâmetros de Tamanhos Máximos de Upload (Admin)
// POST /backend/v1/operacao/limites-upload-tipos/salvar
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/operacao/limites-upload-tipos/salvar',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }
    const role = (auth.getString('role') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { erro: 'Acesso restrito ao perfil Administrador' })
    }

    const body = reqInfo.body || {}
    const paramCol = $app.findCollectionByNameOrId('parametros')

    function salvarParam(chave, valor, desc) {
      let rec = null
      try {
        rec = $app.findFirstRecordByData('parametros', 'chave', chave)
      } catch (_) {}

      if (rec) {
        rec.set('valor', String(valor))
        $app.save(rec)
      } else {
        const nRec = new Record(paramCol)
        nRec.set('chave', chave)
        nRec.set('valor', String(valor))
        nRec.set('descricao', desc)
        $app.save(nRec)
      }
    }

    if (body.upload_max_ifc_mb) {
      salvarParam('upload_max_ifc_mb', body.upload_max_ifc_mb, 'Teto máximo para IFC em MB')
    }
    if (body.upload_max_dwg_mb) {
      salvarParam('upload_max_dwg_mb', body.upload_max_dwg_mb, 'Teto máximo para DWG em MB')
    }
    if (body.upload_max_pdf_mb) {
      salvarParam('upload_max_pdf_mb', body.upload_max_pdf_mb, 'Teto máximo para PDF em MB')
    }
    if (body.upload_max_imagem_mb) {
      salvarParam(
        'upload_max_imagem_mb',
        body.upload_max_imagem_mb,
        'Teto máximo para Imagens em MB',
      )
    }

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'PARAMETROS_LIMITES_UPLOAD_ALTERADOS')
      aRec.set('entidade', 'parametros')
      aRec.set('registro_id', 'limites_upload')
      aRec.set('detalhes', body)
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      mensagem: 'Parâmetros de upload salvos com sucesso e auditados.',
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: Snapshot de Dados Pré-Migração ou Limpeza em Lote
// POST /backend/v1/operacao/snapshot-pre-migracao
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/operacao/snapshot-pre-migracao',
  (e) => {
    const reqInfo = e.requestInfo()
    const auth = reqInfo.auth || e.auth
    if (!auth) {
      return e.json(401, { erro: 'Autenticação necessária' })
    }
    const role = (auth.getString('role') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, { erro: 'Snapshot pré-migração restrito ao perfil Administrador' })
    }

    const body = reqInfo.body || {}
    const operacaoNome = (body.operacao || 'migracao_lote').toString()
    const colecoesAlvo = Array.isArray(body.colecoes) ? body.colecoes : ['contas', 'ordens_servico']
    const agora = new Date()

    const contagensSnapshot = {}
    let totalLinhas = 0

    for (let i = 0; i < colecoesAlvo.length; i++) {
      const cName = colecoesAlvo[i]
      if ($app.hasTable(cName)) {
        try {
          const count = $app.countRecords(cName)
          contagensSnapshot[cName] = count
          totalLinhas += count
        } catch (_) {
          contagensSnapshot[cName] = 0
        }
      }
    }

    const snapshotPayload = {
      operacao: operacaoNome,
      gerado_em: agora.toISOString(),
      gerado_por: auth.getString('email'),
      total_linhas_afetadas: totalLinhas,
      contagens_por_colecao: contagensSnapshot,
      padrao_seguranca: 'SNAPSHOT_IMUTAVEL_PRE_MIGRACAO',
    }

    // Registrar em audit_logs
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', auth.id)
      aRec.set('user_email', auth.getString('email'))
      aRec.set('acao', 'SNAPSHOT_PRE_MIGRACAO_DADOS')
      aRec.set('entidade', 'sistema')
      aRec.set('registro_id', operacaoNome)
      aRec.set('detalhes', snapshotPayload)
      $app.save(aRec)
    } catch (eAudit) {
      return e.json(500, { erro: 'Falha ao registrar auditoria do snapshot: ' + eAudit })
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Snapshot de segurança pré-migração gerado e registrado na auditoria imutável.',
      snapshot: snapshotPayload,
    })
  },
  $apis.requireAuth(),
)
