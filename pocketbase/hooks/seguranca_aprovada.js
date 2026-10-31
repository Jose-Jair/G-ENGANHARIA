/**
 * Hook de Segurança GESTÃO G+ (Itens 1, 2, 3 e 4 do Plano Aprovado)
 * Todas as funções são declaradas inline dentro dos callbacks para compatibilidade com o JSVM do PocketBase.
 */

// -----------------------------------------------------------------------------
// 1. users: Bloquear escalonamento de privilégios (self-update de role/active)
// -----------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const rec = e.record
  if (rec.collection().name !== '_pb_users_auth_' && rec.collection().name !== 'users') {
    e.next()
    return
  }

  const reqInfo = e.requestInfo()
  const auth = reqInfo ? reqInfo.auth : null

  if (auth) {
    const callerRole = auth.getString('role')
    const callerId = auth.id

    if (callerRole !== 'admin') {
      const orig = rec.original()
      if (orig) {
        if (rec.getString('role') !== orig.getString('role')) {
          throw new BadRequestError(
            'Apenas Administradores podem alterar o perfil (role) de usuários.',
          )
        }
        if (rec.getBool('active') !== orig.getBool('active')) {
          throw new BadRequestError(
            'Apenas Administradores podem alterar o status de ativação de usuários.',
          )
        }
      }

      if (callerId === rec.id) {
        const body = reqInfo.body || {}
        if (body.role !== undefined && body.role !== auth.getString('role')) {
          throw new BadRequestError('Não é permitido alterar o próprio perfil de acesso.')
        }
        if (body.active !== undefined && body.active !== auth.getBool('active')) {
          throw new BadRequestError('Não é permitido alterar o próprio status de conta.')
        }
      }
    }
  }

  e.next()
}, 'users')

// -----------------------------------------------------------------------------
// 2. Criação/Atualização: Expiração de novos links em 7 dias
// -----------------------------------------------------------------------------
onRecordCreate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'propostas') {
    const status = rec.getString('status') || 'rascunho'
    if (status !== 'rascunho' && !rec.getString('token_aceite')) {
      rec.set('token_aceite', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'contratos_servico') {
    if (!rec.getString('token_assinatura_cliente')) {
      rec.set('token_assinatura_cliente', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'subcontratos') {
    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'ordens_servico') {
    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'contratos_mestre') {
    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'cotacoes') {
    if (!rec.getString('token')) {
      rec.set('token', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  e.next()
})

onRecordUpdate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'propostas') {
    const orig = rec.original()
    const newStatus = rec.getString('status')

    if (newStatus !== 'rascunho' && !rec.getString('token_aceite')) {
      rec.set('token_aceite', $security.randomString(32))
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_expiracao', expira)
      rec.set('tentativas_token', 0)
    }
  }

  if (colName === 'contratos_servico') {
    const orig = rec.original()
    const oldTokenComp = orig ? orig.getString('token_complemento_dados') : ''
    const newTokenComp = rec.getString('token_complemento_dados')
    if (newTokenComp && !oldTokenComp && !rec.getString('token_complemento_expiracao')) {
      const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      rec.set('token_complemento_expiracao', expira)
      rec.set('tentativas_token_complemento', 0)
    }
  }

  e.next()
})

// -----------------------------------------------------------------------------
// 3. Espelhamento bidirecional seguro de telefones (JSON <-> legado texto)
// -----------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  const rec = e.record
  const cName = rec.collection().name
  if (cName === 'clientes_pf' || cName === 'empresas' || cName === 'executores') {
    try {
      const telefonesJson = rec.get('telefones')
      const rawTelefone = (rec.getString('telefone') || '').trim()

      if (Array.isArray(telefonesJson) && telefonesJson.length > 0) {
        let principal = null
        for (let i = 0; i < telefonesJson.length; i++) {
          if (telefonesJson[i] && telefonesJson[i].whatsapp) {
            principal = telefonesJson[i]
            break
          }
        }
        if (!principal) principal = telefonesJson[0]
        if (principal && principal.numero) {
          rec.set('telefone', String(principal.numero).trim())
        }
      } else if (rawTelefone) {
        const cleanDigits = rawTelefone.replace(/\D/g, '')
        const semDdi =
          cleanDigits.startsWith('55') && cleanDigits.length > 11
            ? cleanDigits.slice(2)
            : cleanDigits
        let formatted = rawTelefone
        if (semDdi.length === 11) {
          formatted =
            '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 7) + '-' + semDdi.slice(7)
        } else if (semDdi.length === 10) {
          formatted =
            '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 6) + '-' + semDdi.slice(6)
        }
        rec.set('telefones', [
          {
            id: 'tel_sync_' + rec.id,
            numero: formatted,
            whatsapp: true,
            tipo: semDdi.length === 11 ? 'whatsapp' : 'fixo',
          },
        ])
      }
    } catch (errSync) {
      console.log('Erro ao sincronizar telefones no create: ' + errSync)
    }
  }
  e.next()
})

onRecordUpdateRequest((e) => {
  const rec = e.record
  const cName = rec.collection().name
  if (cName === 'clientes_pf' || cName === 'empresas' || cName === 'executores') {
    try {
      const telefonesJson = rec.get('telefones')
      const rawTelefone = (rec.getString('telefone') || '').trim()

      if (Array.isArray(telefonesJson) && telefonesJson.length > 0) {
        let principal = null
        for (let i = 0; i < telefonesJson.length; i++) {
          if (telefonesJson[i] && telefonesJson[i].whatsapp) {
            principal = telefonesJson[i]
            break
          }
        }
        if (!principal) principal = telefonesJson[0]
        if (principal && principal.numero) {
          rec.set('telefone', String(principal.numero).trim())
        }
      } else if (rawTelefone) {
        const cleanDigits = rawTelefone.replace(/\D/g, '')
        const semDdi =
          cleanDigits.startsWith('55') && cleanDigits.length > 11
            ? cleanDigits.slice(2)
            : cleanDigits
        let formatted = rawTelefone
        if (semDdi.length === 11) {
          formatted =
            '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 7) + '-' + semDdi.slice(7)
        } else if (semDdi.length === 10) {
          formatted =
            '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 6) + '-' + semDdi.slice(6)
        }
        rec.set('telefones', [
          {
            id: 'tel_sync_' + rec.id,
            numero: formatted,
            whatsapp: true,
            tipo: semDdi.length === 11 ? 'whatsapp' : 'fixo',
          },
        ])
      }
    } catch (errSync) {
      console.log('Erro ao sincronizar telefones no update: ' + errSync)
    }
  }
  e.next()
})

// -----------------------------------------------------------------------------
// 4. Endpoints Públicos Protegidos: Limite de 10 tentativas + Validação de Expiração + Rotação
// -----------------------------------------------------------------------------

// 4.1 Validação e Obtenção de Cotação por Token
routerAdd('GET', '/backend/v1/cotacoes/obter-por-token/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { message: 'Token não informado' })
    }

    const reqInfo = e.requestInfo()
    const clientIp =
      reqInfo &&
      reqInfo.headers &&
      (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])
        ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip']
        : '127.0.0.1'

    const records = $app.findRecordsByFilter(
      'cotacoes',
      "token = '" + token.replace(/'/g, "\\'") + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Cotação não localizada ou link inválido.' })
    }

    const cotacao = records[0]
    const tentativas = cotacao.getInt('tentativas_token') || 0

    // Limite de 10 tentativas
    if (tentativas >= 10) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'TOKEN_BLOQUEADO_EXCESSO_TENTATIVAS')
        aRec.set('entidade', 'cotacoes')
        aRec.set('registro_id', cotacao.id)
        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA_SEGURANCA')
        aRec.set('ip', clientIp)
        aRec.set('detalhes', {
          motivo: 'Limite de 10 tentativas excedido para o token da cotação',
          limite_tentativas: 10,
          timestamp: new Date().toISOString(),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(429, {
        message:
          'Limite de tentativas excedido (10/10). Este link foi bloqueado por segurança. Contate a G+ Engenharia.',
      })
    }

    // Incrementar tentativas
    cotacao.set('tentativas_token', tentativas + 1)
    $app.save(cotacao)

    // Validar expiração apenas se campo existir e estiver preenchido
    const expiraStr = cotacao.getString('token_expiracao')
    if (expiraStr) {
      const expiraTime = new Date(expiraStr).getTime()
      if (Date.now() > expiraTime) {
        return e.json(410, {
          message: 'Este link de cotação expirou. Solicite um novo link à equipe da G+ Engenharia.',
        })
      }
    }

    let executorData = null
    let projetoData = null
    try {
      const exec = $app.findRecordById('executores', cotacao.getString('executor'))
      if (exec) {
        executorData = {
          id: exec.id,
          nome: exec.getString('nome'),
          email: exec.getString('email'),
          conselho: exec.getString('conselho'),
        }
      }
    } catch (_) {}

    try {
      const prj = $app.findRecordById('projetos', cotacao.getString('projeto'))
      if (prj) {
        projetoData = {
          id: prj.id,
          codigo: prj.getString('codigo'),
          nome: prj.getString('nome'),
          descricao: prj.getString('descricao'),
          disciplinas: prj.getString('disciplinas'),
        }
      }
    } catch (_) {}

    return e.json(200, {
      id: cotacao.id,
      projeto: projetoData,
      executor: executorData,
      escopo: cotacao.getString('escopo'),
      status: cotacao.getString('status'),
      preco_ofertado: cotacao.getFloat('preco_ofertado'),
      prazo_ofertado: cotacao.getString('prazo_ofertado'),
      observacoes: cotacao.getString('observacoes'),
      data_resposta: cotacao.getString('data_resposta'),
    })
  } catch (err) {
    console.log('Erro ao obter cotacao por token: ' + err)
    return e.json(500, { message: 'Erro interno ao consultar cotação: ' + err })
  }
})

// 4.2 Submeter Resposta da Cotação com Rotação de Token
routerAdd('POST', '/backend/v1/cotacoes/responder-por-token', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = (body.token || '').trim()
    const precoOfertado = parseFloat(body.preco_ofertado)
    const prazoOfertado = (body.prazo_ofertado || '').trim()
    const observacoes = (body.observacoes || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token não fornecido' })
    }
    if (isNaN(precoOfertado) || precoOfertado <= 0) {
      return e.json(400, { message: 'Preço ofertado deve ser maior que zero' })
    }
    if (!prazoOfertado) {
      return e.json(400, { message: 'Prazo ofertado é obrigatório' })
    }

    const records = $app.findRecordsByFilter(
      'cotacoes',
      "token = '" + token.replace(/'/g, "\\'") + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, {
        message: 'Cotação não localizada ou link já utilizado/inválido.',
      })
    }

    const cotacao = records[0]
    const tentativas = cotacao.getInt('tentativas_token') || 0
    if (tentativas >= 10) {
      return e.json(429, {
        message: 'Limite de tentativas excedido (10/10). Link bloqueado por segurança.',
      })
    }

    const expiraStr = cotacao.getString('token_expiracao')
    if (expiraStr) {
      const expiraTime = new Date(expiraStr).getTime()
      if (Date.now() > expiraTime) {
        return e.json(410, {
          message: 'Este link de cotação expirou. Solicite um novo link à equipe da G+ Engenharia.',
        })
      }
    }

    if (
      cotacao.getString('status') === 'respondida' ||
      cotacao.getString('status') === 'escolhida'
    ) {
      return e.json(400, {
        message: 'Esta cotação já foi respondida anteriormente.',
      })
    }

    const nowIso = new Date().toISOString()
    cotacao.set('preco_ofertado', precoOfertado)
    cotacao.set('prazo_ofertado', prazoOfertado)
    cotacao.set('observacoes', observacoes)
    cotacao.set('status', 'respondida')
    cotacao.set('data_resposta', nowIso)

    // ROTAÇÃO DE TOKEN: Inutiliza o token antigo
    cotacao.set('token', '')

    $app.save(cotacao)

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'RESPOSTA_COTACAO_TOKEN')
      aRec.set('entidade', 'cotacoes')
      aRec.set('registro_id', cotacao.id)
      aRec.set('user', null)
      aRec.set('user_email', 'EXECUTOR_EXTERNO_TOKEN')
      aRec.set('detalhes', {
        preco_ofertado: precoOfertado,
        prazo_ofertado: prazoOfertado,
        token_rotacionado: true,
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: 'Proposta de cotação enviada com sucesso!',
      cotacao_id: cotacao.id,
    })
  } catch (err) {
    console.log('Erro ao responder cotacao por token: ' + err)
    return e.json(500, { message: 'Erro interno: ' + err })
  }
})

// 4.3 Rotação de Token ao Aceitar Proposta e Subcontrato
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    if (rec.collection().name === 'propostas') {
      const orig = rec.original()
      const oldStatus = orig ? orig.getString('status') : ''
      const newStatus = rec.getString('status')

      if (newStatus === 'aceita' && oldStatus !== 'aceita' && rec.getString('token_aceite')) {
        try {
          rec.set('token_aceite', '')
          $app.save(rec)
        } catch (errRot) {
          console.log('Erro ao rotacionar token de proposta aceita: ' + errRot)
        }
      }
    }

    if (rec.collection().name === 'subcontratos') {
      const orig = rec.original()
      const oldStatus = orig ? orig.getString('status') : ''
      const newStatus = rec.getString('status')

      if (
        newStatus === 'assinado' &&
        oldStatus !== 'assinado' &&
        rec.getString('token_assinatura')
      ) {
        try {
          rec.set('token_assinatura', '')
          $app.save(rec)
        } catch (errRotSub) {
          console.log('Erro ao rotacionar token_assinatura de subcontrato assinado: ' + errRotSub)
        }
      }
    }

    if (rec.collection().name === 'contratos_servico') {
      const orig = rec.original()
      const oldStatus = orig ? orig.getString('status') : ''
      const newStatus = rec.getString('status')

      if (newStatus === 'assinado' && oldStatus !== 'assinado') {
        try {
          if (rec.getString('token_assinatura_cliente')) {
            rec.set('token_assinatura_cliente', '')
          }
          if (rec.getString('token_complemento_dados')) {
            rec.set('token_complemento_dados', '')
          }
          $app.save(rec)
        } catch (errRotCtr) {
          console.log('Erro ao rotacionar tokens de contrato assinado: ' + errRotCtr)
        }
      }
    }
  } finally {
    e.next()
  }
})

// -----------------------------------------------------------------------------
// 5. Endpoint de Autochecagem de Segurança (/backend/v1/seguranca/selfcheck)
// Restrito a Administradores. NÃO cria nem apaga nenhum registro real.
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/seguranca/selfcheck',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, { message: 'Acesso restrito ao perfil Administrador.' })
      }

      const resultados = {
        item1_api_rules: {},
        item2_protected_files: {},
        item3_token_security: {},
        item4_telefones_json: {},
        item5_modulo_prestadores: {},
        conformidade_geral: true,
      }

      const cotacoesCol = $app.findCollectionByNameOrId('cotacoes')
      const cotacoesRuleOk =
        cotacoesCol.listRule &&
        !cotacoesCol.listRule.includes("token != '' ||") &&
        cotacoesCol.listRule.includes('@request.query.token')
      resultados.item1_api_rules.cotacoes_segura = Boolean(cotacoesRuleOk)

      const subcontratosCol = $app.findCollectionByNameOrId('subcontratos')
      const subRuleOk =
        subcontratosCol.listRule &&
        !subcontratosCol.listRule.includes("token_assinatura != '' ||") &&
        subcontratosCol.listRule.includes('@request.query.token')
      resultados.item1_api_rules.subcontratos_segura = Boolean(subRuleOk)

      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      const usersRuleOk =
        usersCol.updateRule && usersCol.updateRule.includes('@request.body.role:changed = false')
      resultados.item1_api_rules.users_anti_escalonamento = Boolean(usersRuleOk)

      const fileChecks = [
        { col: 'executores', field: 'nda_contrato' },
        { col: 'executores', field: 'documento_termo' },
        { col: 'contratos_servico', field: 'arquivo_pdf_assinado' },
        { col: 'contas', field: 'anexo_comprovante' },
        { col: 'medicoes', field: 'anexos' },
        { col: 'avaliacoes_executor', field: 'anexos' },
        { col: 'entregaveis', field: 'arquivo' },
        { col: 'documentos', field: 'arquivo' },
        { col: 'projetos', field: 'anexo_autorizacao' },
        { col: 'entregaveis_versoes', field: 'arquivo' },
        { col: 'mensagens_os', field: 'anexo' },
      ]

      let todosArquivosProtegidos = true
      const detalheArquivos = {}
      for (let i = 0; i < fileChecks.length; i++) {
        const item = fileChecks[i]
        try {
          const c = $app.findCollectionByNameOrId(item.col)
          const f = c.fields.getByName(item.field)
          const isProt = Boolean(f && f.protected)
          detalheArquivos[item.col + '.' + item.field] = isProt
          if (!isProt) todosArquivosProtegidos = false
        } catch (_) {
          detalheArquivos[item.col + '.' + item.field] = false
          todosArquivosProtegidos = false
        }
      }
      resultados.item2_protected_files.todos_protegidos = todosArquivosProtegidos
      resultados.item2_protected_files.detalhes = detalheArquivos

      const colTokens = [
        { col: 'propostas', exp: 'token_expiracao', tent: 'tentativas_token' },
        { col: 'contratos_servico', exp: 'token_expiracao', tent: 'tentativas_token' },
        { col: 'subcontratos', exp: 'token_expiracao', tent: 'tentativas_token' },
        { col: 'cotacoes', exp: 'token_expiracao', tent: 'tentativas_token' },
        { col: 'executores', exp: 'token_cadastro_expira', tent: 'tentativas_token' },
        { col: 'ordens_servico', exp: 'token_expiracao', tent: 'tentativas_token' },
        { col: 'contratos_mestre', exp: 'token_expiracao', tent: 'tentativas_token' },
      ]
      let camposTokenOk = true
      for (let i = 0; i < colTokens.length; i++) {
        const ct = colTokens[i]
        try {
          const c = $app.findCollectionByNameOrId(ct.col)
          const hasExp = Boolean(c.fields.getByName(ct.exp))
          const hasTent = Boolean(c.fields.getByName(ct.tent))
          resultados.item3_token_security[ct.col] = { expira: hasExp, tentativas: hasTent }
          if (!hasExp || !hasTent) camposTokenOk = false
        } catch (_) {
          camposTokenOk = false
        }
      }
      resultados.item3_token_security.campos_configurados = camposTokenOk

      const telCols = ['clientes_pf', 'empresas', 'executores']
      let telefonesJsonOk = true
      for (let i = 0; i < telCols.length; i++) {
        try {
          const c = $app.findCollectionByNameOrId(telCols[i])
          const hasTels = Boolean(c.fields.getByName('telefones'))
          resultados.item4_telefones_json[telCols[i]] = hasTels
          if (!hasTels) telefonesJsonOk = false
        } catch (_) {
          telefonesJsonOk = false
        }
      }
      resultados.item4_telefones_json.campos_configurados = telefonesJsonOk

      // Verificações do Módulo de Prestadores e Portal
      let prestadoresOk = true
      try {
        const prestCol = $app.findCollectionByNameOrId('prestadores')
        const profCol = $app.findCollectionByNameOrId('profissionais_prestador')
        const cmCol = $app.findCollectionByNameOrId('contratos_mestre')
        const osCol = $app.findCollectionByNameOrId('ordens_servico')
        const posCol = $app.findCollectionByNameOrId('portal_os')

        // Validar que executor externo NÃO tem acesso a ordens_servico nem contratos_mestre
        const osRuleSegura =
          osCol.listRule && !osCol.listRule.includes('executor') && !osCol.listRule.includes('true')
        const cmRuleSegura =
          cmCol.listRule && !cmCol.listRule.includes('executor') && !cmCol.listRule.includes('true')

        const pentCol = $app.findCollectionByNameOrId('portal_entregaveis')
        const pdocCol = $app.findCollectionByNameOrId('portal_documentos')

        // Validar que portal_os, portal_entregaveis e portal_documentos filtram por prestador_email
        const posRuleSegura =
          posCol.listRule && posCol.listRule.includes('prestador_email = @request.auth.email')
        const pentRuleSegura =
          pentCol.listRule && pentCol.listRule.includes('prestador_email = @request.auth.email')
        const pdocRuleSegura =
          pdocCol.listRule && pdocCol.listRule.includes('prestador_email = @request.auth.email')

        // Validar que portal_os NÃO tem campos de cliente, obra, proposta, bdi
        const camposPos = posCol.fields
        const posSemCamposSensiveis =
          !camposPos.getByName('cliente') &&
          !camposPos.getByName('proposta') &&
          !camposPos.getByName('bdi') &&
          !camposPos.getByName('obra') &&
          !camposPos.getByName('outros_prestadores')

        // RODADA 8 — SEGMENTAÇÃO FINANCEIRA DO PORTAL DO PRESTADOR:
        // Garantir que a coleção 'contas' tem API rules restritas exclusivamente a admin e financeiro
        // e que portal_os NÃO contém dados de margem, faturamento de cliente, propostas ou contas a receber
        const contasCol = $app.findCollectionByNameOrId('contas')
        const contasRuleSegura =
          contasCol.listRule &&
          !contasCol.listRule.includes('executor') &&
          !contasCol.listRule.includes('true') &&
          (contasCol.listRule.includes("@request.auth.role = 'admin'") ||
            contasCol.listRule.includes("@request.auth.role = 'financeiro'"))

        const posSemDadosFinanceirosProposta =
          !camposPos.getByName('margem') &&
          !camposPos.getByName('valor_vendido') &&
          !camposPos.getByName('contas_receber') &&
          !camposPos.getByName('lucro')

        resultados.item5_modulo_prestadores = {
          colecoes_criadas: Boolean(
            prestCol && profCol && cmCol && osCol && posCol && pentCol && pdocCol,
          ),
          os_regra_segura_sem_executor: Boolean(osRuleSegura),
          contrato_mestre_regra_segura_sem_executor: Boolean(cmRuleSegura),
          portal_os_isolado_por_email: Boolean(posRuleSegura),
          portal_entregaveis_isolado_por_email: Boolean(pentRuleSegura),
          portal_documentos_isolado_por_email: Boolean(pdocRuleSegura),
          portal_os_sem_campos_sensiveis: Boolean(posSemCamposSensiveis),
          contas_financeiro_isolado_sem_prestador: Boolean(contasRuleSegura),
          portal_os_sem_dados_financeiros_cliente: Boolean(posSemDadosFinanceirosProposta),
        }

        if (!contasRuleSegura || !posSemDadosFinanceirosProposta) {
          prestadoresOk = false
        }

        if (
          !resultados.item5_modulo_prestadores.colecoes_criadas ||
          !osRuleSegura ||
          !cmRuleSegura ||
          !posRuleSegura ||
          !pentRuleSegura ||
          !pdocRuleSegura ||
          !posSemCamposSensiveis
        ) {
          prestadoresOk = false
        }
      } catch (eModP) {
        prestadoresOk = false
        resultados.item5_modulo_prestadores = { erro: String(eModP) }
      }

      // REQUISITO 9: SELFCHECK ESTENDIDO
      // Passa a verificar também as regras das coleções novas (catalogo_escopos, entregaveis_versoes)
      // e as projeções de entregáveis (campos sensíveis ausentes)
      let colecoesNovasOk = true
      const detalheColecoesNovas = {}
      try {
        const escoposCol = $app.findCollectionByNameOrId('catalogo_escopos')
        const versoesCol = $app.findCollectionByNameOrId('entregaveis_versoes')
        const entCol = $app.findCollectionByNameOrId('entregaveis')

        // catalogo_escopos: escrita só admin, sem acesso público
        const escoposSeguro =
          escoposCol.createRule &&
          escoposCol.createRule.includes("@request.auth.role = 'admin'") &&
          !escoposCol.listRule.includes('true')
        detalheColecoesNovas.catalogo_escopos_regras = Boolean(escoposSeguro)

        // entregaveis_versoes: executor só vê entregáveis de seu email
        const versoesSeguro =
          versoesCol.listRule &&
          versoesCol.listRule.includes('@request.auth.role =') &&
          versoesCol.listRule.includes('entregavel.prestador.email = @request.auth.email')
        detalheColecoesNovas.entregaveis_versoes_regras = Boolean(versoesSeguro)

        // Projeção/entregaveis do portal: garantir que campos sensíveis de proposta/cliente/bdi NÃO existem no entregável
        const camposEnt = entCol.fields
        const entSemSensiveis =
          !camposEnt.getByName('cliente') &&
          !camposEnt.getByName('proposta') &&
          !camposEnt.getByName('bdi') &&
          !camposEnt.getByName('valor_contrato')
        detalheColecoesNovas.entregaveis_sem_campos_sensiveis = Boolean(entSemSensiveis)

        if (!escoposSeguro || !versoesSeguro || !entSemSensiveis) {
          colecoesNovasOk = false
        }
      } catch (eNovas) {
        colecoesNovasOk = false
        detalheColecoesNovas.erro = String(eNovas)
      }

      resultados.item6_colecoes_novas_cadeia_projetos = {
        todas_conformes: colecoesNovasOk,
        detalhes: detalheColecoesNovas,
      }

      // REQUISITO 7: SELFCHECK ESTENDIDO ÀS REGRAS NOVAS DE COTAÇÃO AUTOMÁTICA
      // Valida:
      // - coleção cotacoes tem campos novos (pacote, prestador, automatica, lembrete_enviado, data_limite_resposta)
      // - parâmetros de cotação configurados na Administração (prazo_resposta_cotacao_dias, antecedencia_lembrete_cotacao_dias, max_convidados_cotacao)
      // - coleção cotacoes não expõe campos sensíveis (cliente, obra, valor_contrato) para executor externo
      let cotacaoAutomaticaOk = true
      const detalheCotacaoAuto = {}
      try {
        const cotCol = $app.findCollectionByNameOrId('cotacoes')
        const temPacote = Boolean(cotCol.fields.getByName('pacote'))
        const temPrestador = Boolean(cotCol.fields.getByName('prestador'))
        const temAuto = Boolean(cotCol.fields.getByName('automatica'))
        const temLembrete = Boolean(cotCol.fields.getByName('lembrete_enviado'))
        const temDtLimite = Boolean(cotCol.fields.getByName('data_limite_resposta'))

        detalheCotacaoAuto.campos_novos = Boolean(
          temPacote && temPrestador && temAuto && temLembrete && temDtLimite,
        )

        // API rule de cotacoes isola executor por prestador.email
        const ruleIsolaPrestador =
          cotCol.listRule && cotCol.listRule.includes('prestador.email = @request.auth.email')
        detalheCotacaoAuto.rls_prestador_email = Boolean(ruleIsolaPrestador)

        // Campos sensíveis ausentes na coleção cotacoes
        const cFields = cotCol.fields
        const cotSemSensiveis =
          !cFields.getByName('cliente') &&
          !cFields.getByName('obra') &&
          !cFields.getByName('valor_contrato') &&
          !cFields.getByName('proposta_comercial')
        detalheCotacaoAuto.sem_campos_sensiveis = Boolean(cotSemSensiveis)

        // Parâmetros da Administração
        const p1 = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'prazo_resposta_cotacao_dias'),
        )
        const p2 = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'antecedencia_lembrete_cotacao_dias'),
        )
        const p3 = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'max_convidados_cotacao'),
        )
        detalheCotacaoAuto.parametros_administracao = Boolean(p1 && p2 && p3)

        if (
          !detalheCotacaoAuto.campos_novos ||
          !ruleIsolaPrestador ||
          !cotSemSensiveis ||
          !detalheCotacaoAuto.parametros_administracao
        ) {
          cotacaoAutomaticaOk = false
        }
      } catch (eAuto) {
        cotacaoAutomaticaOk = false
        detalheCotacaoAuto.erro = String(eAuto)
      }

      resultados.item7_cotacao_automatica = {
        todas_conformes: cotacaoAutomaticaOk,
        detalhes: detalheCotacaoAuto,
      }

      // REQUISITO 8: SELFCHECK ESTENDIDO — ASSINATURA ELETRÔNICA PADRÃO JURÍDICO (OS, CONTRATOS, OTP)
      let assinaturaEletronicaOk = true
      const detalheAssinatura = {}

      try {
        const colOS = $app.findCollectionByNameOrId('ordens_servico')
        const colCM = $app.findCollectionByNameOrId('contratos_mestre')
        const colCS = $app.findCollectionByNameOrId('contratos_servico')

        const camposEsperados = [
          'codigo_verificacao_hash',
          'codigo_expiracao',
          'codigo_tentativas',
          'codigo_enviado_para',
          'aceite_status',
          'pdf_congelado_hash',
          'versao_texto_aceito',
          'versao_texto_hash',
          'dossie_evidencias_json',
        ]

        function checarCamposColecao(col, nomes) {
          if (!col) return false
          return nomes.every((nome) => Boolean(col.fields && col.fields.getByName(nome)))
        }

        detalheAssinatura.ordens_servico_campos = checarCamposColecao(colOS, camposEsperados)
        detalheAssinatura.contratos_mestre_campos = checarCamposColecao(colCM, camposEsperados)
        detalheAssinatura.contratos_servico_campos = checarCamposColecao(colCS, camposEsperados)

        const paramClausula = $app.findRecordsByFilter(
          'parametros',
          "chave = 'clausula_assinatura_eletronica_padrao'",
          '',
          1,
          0,
        )
        detalheAssinatura.parametro_clausula_padrao = paramClausula.length > 0

        if (
          !detalheAssinatura.ordens_servico_campos ||
          !detalheAssinatura.contratos_mestre_campos ||
          !detalheAssinatura.contratos_servico_campos ||
          !detalheAssinatura.parametro_clausula_padrao
        ) {
          assinaturaEletronicaOk = false
        }
      } catch (eAssin) {
        assinaturaEletronicaOk = false
        detalheAssinatura.erro = String(eAssin)
      }

      resultados.item8_assinatura_eletronica_otp = {
        todas_conformes: assinaturaEletronicaOk,
        detalhes: detalheAssinatura,
      }

      // REQUISITO 9: SELFCHECK ESTENDIDO — CANAL DE MENSAGENS E VERSIONAMENTO POR OS (RODADA 6)
      let comunicacaoOsOk = true
      const detalheComunicacaoOs = {}
      try {
        const msgCol = $app.findCollectionByNameOrId('mensagens_os')
        const comCol = $app.findCollectionByNameOrId('entregavel_comentarios')
        const notCol = $app.findCollectionByNameOrId('notificacoes')

        // 1. mensagens_os: imutabilidade estrita (updateRule e deleteRule nulos)
        const msgImutavel = msgCol.updateRule === null && msgCol.deleteRule === null
        detalheComunicacaoOs.mensagens_imutabilidade = Boolean(msgImutavel)

        // 2. mensagens_os: isolamento do prestador por os.prestador.email
        const msgIsolamento =
          msgCol.listRule &&
          msgCol.listRule.includes('os.prestador.email = @request.auth.email') &&
          msgCol.createRule &&
          msgCol.createRule.includes('os.prestador.email = @request.auth.email')
        detalheComunicacaoOs.mensagens_isolamento_prestador = Boolean(msgIsolamento)

        // 3. mensagens_os: anexo protegido
        const anexoF = msgCol.fields.getByName('anexo')
        const msgAnexoProtegido = Boolean(anexoF && anexoF.protected)
        detalheComunicacaoOs.mensagens_anexo_protegido = Boolean(msgAnexoProtegido)

        // 4. mensagens_os: sem campos sensíveis de cliente/obra/valores
        const mFields = msgCol.fields
        const msgSemSensiveis =
          !mFields.getByName('cliente') &&
          !mFields.getByName('obra') &&
          !mFields.getByName('valor_contrato') &&
          !mFields.getByName('proposta')
        detalheComunicacaoOs.mensagens_sem_campos_sensiveis = Boolean(msgSemSensiveis)

        // 5. entregavel_comentarios: imutabilidade e isolamento por versão
        const comImutavel = comCol.updateRule === null && comCol.deleteRule === null
        const comIsolamento =
          comCol.listRule &&
          comCol.listRule.includes('versao.entregavel.prestador.email = @request.auth.email')
        detalheComunicacaoOs.comentarios_imutabilidade = Boolean(comImutavel)
        detalheComunicacaoOs.comentarios_isolamento_prestador = Boolean(comIsolamento)

        // 6. notificacoes: regras de segmentação de perfil
        const notifSegura =
          notCol.listRule &&
          notCol.listRule.includes("destinatario_tipo = 'interno'") &&
          notCol.listRule.includes("destinatario_tipo = 'prestador'")
        detalheComunicacaoOs.notificacoes_segmentadas = Boolean(notifSegura)

        if (
          !msgImutavel ||
          !msgIsolamento ||
          !msgAnexoProtegido ||
          !msgSemSensiveis ||
          !comImutavel ||
          !comIsolamento ||
          !notifSegura
        ) {
          comunicacaoOsOk = false
        }
      } catch (eComOs) {
        comunicacaoOsOk = false
        detalheComunicacaoOs.erro = String(eComOs)
      }

      resultados.item9_canal_comunicacao_os = {
        todas_conformes: comunicacaoOsOk,
        detalhes: detalheComunicacaoOs,
      }

      // REQUISITO 10: SELFCHECK ESTENDIDO — MONITORAMENTO E COBRANÇA AUTOMÁTICA DE PRAZOS (RODADA 7)
      let monitoramentoOk = true
      const detalheMonitoramento = {}
      try {
        const evtCol = $app.findCollectionByNameOrId('eventos_cobranca')
        const resCol = $app.findCollectionByNameOrId('resumos_diarios_gestor')

        // 1. eventos_cobranca: imutabilidade estrita via API (updateRule e deleteRule nulos)
        const evtImutavel = evtCol.updateRule === null && evtCol.deleteRule === null
        detalheMonitoramento.eventos_imutabilidade_api = Boolean(evtImutavel)

        // 2. eventos_cobranca: isolamento do prestador no listRule (não vê de outros)
        const evtIsolamento =
          evtCol.listRule &&
          evtCol.listRule.includes("destinatario_tipo = 'prestador'") &&
          evtCol.listRule.includes('destinatario_email = @request.auth.email')
        detalheMonitoramento.eventos_isolamento_prestador = Boolean(evtIsolamento)

        // 3. eventos_cobranca: presença do campo e índice de chave_idempotencia
        const temIdempField = Boolean(evtCol.fields.getByName('chave_idempotencia'))
        const temIdempIndex = evtCol.indexes.some(
          (idx) =>
            idx.toLowerCase().includes('chave_idempotencia') ||
            idx.toLowerCase().includes('idx_evt_cobranca_idemp'),
        )
        detalheMonitoramento.eventos_idempotencia_configurada = Boolean(
          temIdempField && temIdempIndex,
        )

        // 4. resumos_diarios_gestor: leitura restrita a Admin, Gestor e Financeiro
        const resAcessoRestrito =
          resCol.listRule &&
          resCol.listRule.includes("@request.auth.role = 'admin'") &&
          resCol.listRule.includes("@request.auth.role = 'gestor'") &&
          !resCol.listRule.includes("@request.auth.role = 'executor'")
        detalheMonitoramento.resumo_diario_restrito_gestao = Boolean(resAcessoRestrito)

        // 5. Parâmetros de monitoramento presentes na coleção 'parametros'
        const paramsObrigatorios = [
          'monitoramento_prazo_dias_lembrete',
          'monitoramento_prazo_dias_aviso',
          'monitoramento_prazo_dias_cobranca',
          'monitoramento_prazo_dias_escalonamento',
          'monitoramento_revisao_sla_horas',
          'monitoramento_cron_horario',
        ]
        let todosParamsExistem = true
        for (let pIdx = 0; pIdx < paramsObrigatorios.length; pIdx++) {
          const recs = $app.findRecordsByFilter(
            'parametros',
            "chave = '" + paramsObrigatorios[pIdx] + "'",
            '',
            1,
            0,
          )
          if (recs.length === 0) {
            todosParamsExistem = false
            break
          }
        }
        detalheMonitoramento.parametros_prazos_configurados = Boolean(todosParamsExistem)

        if (
          !evtImutavel ||
          !evtIsolamento ||
          !temIdempField ||
          !temIdempIndex ||
          !resAcessoRestrito ||
          !todosParamsExistem
        ) {
          monitoramentoOk = false
        }
      } catch (eMon) {
        monitoramentoOk = false
        detalheMonitoramento.erro = String(eMon)
      }

      resultados.item10_monitoramento_cobranca_prazos = {
        todas_conformes: monitoramentoOk,
        detalhes: detalheMonitoramento,
      }

      // REQUISITO 11: SELFCHECK ESTENDIDO — IA A SERVIÇO DA OPERAÇÃO (RODADA 9)
      // Validação das 5 chaves na Administração e teste de recusa quando chave desligada
      let iaOperacaoOk = true
      const detalheIaOperacao = {}
      try {
        const chavesIaObrigatorias = [
          'ia_escopo',
          'ia_justificativa_prestador',
          'ia_texto_canal',
          'ia_resumo_dia',
          'ia_pre_revisao',
        ]

        let todasChavesConfiguradas = true
        const estadoChaves = {}

        for (let k = 0; k < chavesIaObrigatorias.length; k++) {
          const chaveNome = chavesIaObrigatorias[k]
          const paramRecs = $app.findRecordsByFilter(
            'parametros',
            "chave = '" + chaveNome + "'",
            '',
            1,
            0,
          )
          if (paramRecs.length === 0) {
            todasChavesConfiguradas = false
            estadoChaves[chaveNome] = 'ausente'
          } else {
            const valor = String(paramRecs[0].getString('valor')).trim().toLowerCase()
            estadoChaves[chaveNome] = valor
          }
        }

        detalheIaOperacao.chaves_presentes = todasChavesConfiguradas
        detalheIaOperacao.estado_chaves = estadoChaves

        // Validação de que ia_pre_revisao está com padrão 'false' (ou devidamente respeitada como booleano)
        const preRevisaoPadraoRespeitado =
          estadoChaves['ia_pre_revisao'] === 'false' || estadoChaves['ia_pre_revisao'] === 'true'
        detalheIaOperacao.pre_revisao_configurada = preRevisaoPadraoRespeitado

        // Validação da política de recusa segura: chave desligada ('false') deve gerar recusa
        // Teste de lógica: se valor !== 'true', a política do gate recusa
        const gateRecusaFuncionando = estadoChaves['ia_pre_revisao'] === 'false'
        detalheIaOperacao.gate_recusa_ativo_para_desligada = gateRecusaFuncionando

        if (!todasChavesConfiguradas || !preRevisaoPadraoRespeitado) {
          iaOperacaoOk = false
        }
      } catch (eIa) {
        iaOperacaoOk = false
        detalheIaOperacao.erro = String(eIa)
      }

      resultados.item11_ia_operacao_chaves = {
        todas_conformes: iaOperacaoOk,
        detalhes: detalheIaOperacao,
      }

      // REQUISITO 12: SELFCHECK ESTENDIDO — SMTP OPERANTE (RODADA 11)
      let smtpOk = false
      const detalheSmtp = {}
      try {
        const settings = $app.settings()
        const meta = settings.meta || {}
        const smtp = settings.smtp || {}

        detalheSmtp.senderAddress = meta.senderAddress || ''
        detalheSmtp.senderName = meta.senderName || ''
        detalheSmtp.host = smtp.host || ''
        detalheSmtp.port = smtp.port || 0
        detalheSmtp.enabled = Boolean(smtp.enabled)
        detalheSmtp.auth_user_configurado = Boolean(smtp.username)

        // SMTP é considerado configurado e operante quando habilitado com host e remetente
        if (smtp.enabled && smtp.host && meta.senderAddress) {
          smtpOk = true
          detalheSmtp.status = 'configurado'
        } else {
          smtpOk = false
          detalheSmtp.status = 'pendente_configuracao_painel'
          detalheSmtp.motivo = !smtp.enabled
            ? 'SMTP desabilitado nas configurações do servidor'
            : !smtp.host
              ? 'Host SMTP não configurado'
              : 'Remetente (senderAddress) não configurado'
        }
      } catch (eSmtp) {
        smtpOk = false
        detalheSmtp.status = 'erro_verificacao'
        detalheSmtp.erro = String(eSmtp)
      }

      resultados.item12_smtp_operante = {
        todas_conformes: smtpOk,
        detalhes: detalheSmtp,
      }

      // REQUISITO 13 (RODADA 12): SELFCHECK ESTENDIDO — PRÉ-CADASTRO PÚBLICO, TRIAGEM E DOCUMENTOS
      let recrutamentoTriagemOk = true
      const detalheRecrutamento = {}
      try {
        const linksCol = $app.findCollectionByNameOrId('links_recrutamento')
        const pdocsCol = $app.findCollectionByNameOrId('prestadores_documentos')
        const prestCol = $app.findCollectionByNameOrId('prestadores')

        // 1. links_recrutamento: leitura restrita a Admin/Gestor ou registros ativos/não expirados (sem write público)
        const linksRestrito =
          linksCol.listRule &&
          linksCol.listRule.includes("@request.auth.role = 'admin'") &&
          linksCol.listRule.includes("@request.auth.role = 'gestor'") &&
          linksCol.createRule !== '' &&
          linksCol.deleteRule !== ''
        detalheRecrutamento.links_recrutamento_regras = Boolean(linksRestrito)

        // 2. prestadores_documentos: leitura SOMENTE pelo dono (prestador logado) e por Admin/Gestor
        const pdocsIsolamentoDono =
          pdocsCol.listRule &&
          pdocsCol.listRule.includes("@request.auth.role = 'admin'") &&
          pdocsCol.listRule.includes("@request.auth.role = 'gestor'") &&
          pdocsCol.listRule.includes('prestador.email = @request.auth.email')
        detalheRecrutamento.documentos_isolamento_dono = Boolean(pdocsIsolamentoDono)

        // 3. prestadores_documentos: arquivo com flag protected
        const arquivoField = pdocsCol.fields.getByName('arquivo')
        const arquivoProtegido = Boolean(arquivoField && arquivoField.protected)
        detalheRecrutamento.documentos_arquivo_protegido = arquivoProtegido

        // 4. prestadores: novos campos presentes
        const camposPrestadoresNovos = [
          'origem_cadastro',
          'portfolio_json',
          'softwares',
          'preco_referencia_json',
          'disponibilidade_json',
          'aceite_termos_em',
          'aceite_ip',
          'aceite_hash',
          'nota_triagem',
          'parecer_triagem',
          'triado_por',
        ]
        const todosCamposPrestador = camposPrestadoresNovos.every((c) =>
          Boolean(prestCol.fields.getByName(c)),
        )
        detalheRecrutamento.campos_prestador_adicionados = todosCamposPrestador

        // 5. Parâmetros de triagem na Administração
        const pRate = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'recrutamento_rate_limit_ip_hora'),
        )
        const pVal = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'recrutamento_validade_link_dias'),
        )
        const pCompl = Boolean(
          $app.findFirstRecordByData(
            'parametros',
            'chave',
            'dias_expiracao_link_complemento_prestador',
          ),
        )
        detalheRecrutamento.parametros_administracao = Boolean(pRate && pVal && pCompl)

        if (
          !linksRestrito ||
          !pdocsIsolamentoDono ||
          !arquivoProtegido ||
          !todosCamposPrestador ||
          !detalheRecrutamento.parametros_administracao
        ) {
          recrutamentoTriagemOk = false
        }
      } catch (eRecr) {
        recrutamentoTriagemOk = false
        detalheRecrutamento.erro = String(eRecr)
      }

      resultados.item13_recrutamento_triagem_documentos = {
        todas_conformes: recrutamentoTriagemOk,
        detalhes: detalheRecrutamento,
      }

      // REQUISITO 14 (RODADA 14): SELFCHECK ESTENDIDO — PROSPECÇÃO AUTOMÁTICA
      // Valida:
      // - Coleções fontes_prospeccao e lotes_prospeccao_auditoria existem e ativas
      // - Chave da Transparência ausente -> reporta 'pendente_chave' (nunca finge sucesso)
      // - Fontes configuradas (PNCP ativa, Comprasnet CSV ativa, Transparência desligada)
      let prospeccaoOk = true
      const detalheProspeccao = {}
      try {
        const fontesCol = $app.findCollectionByNameOrId('fontes_prospeccao')
        const lotesCol = $app.findCollectionByNameOrId('lotes_prospeccao_auditoria')
        detalheProspeccao.colecoes_configuradas = Boolean(fontesCol && lotesCol)

        const fPncp = $app.findRecordsByFilter(
          'fontes_prospeccao',
          "slug = 'pncp_contratos'",
          '',
          1,
          0,
        )
        const fComp = $app.findRecordsByFilter(
          'fontes_prospeccao',
          "slug = 'comprasnet_contratos'",
          '',
          1,
          0,
        )
        const fTransp = $app.findRecordsByFilter(
          'fontes_prospeccao',
          "slug = 'portal_transparencia'",
          '',
          1,
          0,
        )

        detalheProspeccao.pncp_configurada = fPncp.length > 0 && fPncp[0].getBool('ativo')
        detalheProspeccao.comprasnet_csv_configurada = fComp.length > 0 && fComp[0].getBool('ativo')

        // Checagem das fontes Ceará (Rodada 14 Parte 2)
        const fTceCe = $app.findRecordsByFilter(
          'fontes_prospeccao',
          "slug = 'tce_ce_contratacoes'",
          '',
          1,
          0,
        )
        const fCearaCsv = $app.findRecordsByFilter(
          'fontes_prospeccao',
          "slug = 'ceara_transparente_csv'",
          '',
          1,
          0,
        )
        detalheProspeccao.tce_ce_configurada = fTceCe.length > 0
        detalheProspeccao.ceara_transparente_csv_configurada = fCearaCsv.length > 0

        const chaveTransp = $os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || ''
        if (chaveTransp && chaveTransp.trim().length > 0) {
          detalheProspeccao.transparencia_chave = 'configurada'
          detalheProspeccao.transparencia_status = 'operante'
        } else {
          detalheProspeccao.transparencia_chave = 'ausente'
          detalheProspeccao.transparencia_status = 'pendente' // Nunca finge sucesso
          detalheProspeccao.transparencia_aviso =
            'Chave PORTAL_TRANSPARENCIA_API_KEY não configurada no painel. Fonte desligada por padrão.'
        }

        detalheProspeccao.transparencia_desligada_por_padrao =
          fTransp.length > 0 && !fTransp[0].getBool('ativo')

        if (!detalheProspeccao.colecoes_configuradas || !detalheProspeccao.pncp_configurada) {
          prospeccaoOk = false
        }
      } catch (eProsp) {
        prospeccaoOk = false
        detalheProspeccao.erro = String(eProsp)
      }

      resultados.item14_prospeccao_automatica = {
        todas_conformes: prospeccaoOk,
        detalhes: detalheProspeccao,
      }

      // REQUISITO 15 (RODADA 15): SELFCHECK ESTENDIDO — CUSTO INTERNO REAL E ISOLAMENTO
      // Valida:
      // - Coleções custos_profissional e apontamentos existem e ativas
      // - custos_profissional: listRule restrito a Admin e Financeiro (prestador NUNCA lê)
      // - apontamentos: prestador só vê próprias horas (prestador.email = @request.auth.email)
      // - prestadores: não expõe custo_hora, custo_mensal ao executor externo
      // - Parâmetros da Administração configurados (retroativo, passo, horas padrão)
      let custoInternoOk = true
      const detalheCustoInterno = {}
      try {
        const cpCol = $app.findCollectionByNameOrId('custos_profissional')
        const aptCol = $app.findCollectionByNameOrId('apontamentos')
        const osColCusto = $app.findCollectionByNameOrId('ordens_servico')

        detalheCustoInterno.colecoes_configuradas = Boolean(cpCol && aptCol)

        // custos_profissional sem executor no listRule/viewRule
        const cpRegraSegura =
          cpCol.listRule &&
          !cpCol.listRule.includes('executor') &&
          !cpCol.listRule.includes('true') &&
          (cpCol.listRule.includes("@request.auth.role = 'admin'") ||
            cpCol.listRule.includes("@request.auth.role = 'financeiro'"))
        detalheCustoInterno.custos_profissional_isolamento = Boolean(cpRegraSegura)

        // apontamentos: executor isolado por prestador.email
        const aptRegraSegura =
          aptCol.listRule && aptCol.listRule.includes('prestador.email = @request.auth.email')
        detalheCustoInterno.apontamentos_isolamento_prestador = Boolean(aptRegraSegura)

        // ordens_servico: contém campo exige_apontamento e custo_interno_apurado
        const temExigeApt = Boolean(osColCusto.fields.getByName('exige_apontamento'))
        const temCustoApurado = Boolean(osColCusto.fields.getByName('custo_interno_apurado'))
        detalheCustoInterno.os_campos_custo_interno = Boolean(temExigeApt && temCustoApurado)

        // Parâmetros de apontamento na Administração
        const pRetro = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'apontamento_retroativo_max_dias'),
        )
        const pPasso = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'apontamento_passo_horas'),
        )
        const pHorasPadrao = Boolean(
          $app.findFirstRecordByData('parametros', 'chave', 'apontamento_horas_dia_padrao'),
        )
        detalheCustoInterno.parametros_administracao = Boolean(pRetro && pPasso && pHorasPadrao)

        if (
          !detalheCustoInterno.colecoes_configuradas ||
          !cpRegraSegura ||
          !aptRegraSegura ||
          !detalheCustoInterno.os_campos_custo_interno ||
          !detalheCustoInterno.parametros_administracao
        ) {
          custoInternoOk = false
        }
      } catch (eCusto) {
        custoInternoOk = false
        detalheCustoInterno.erro = String(eCusto)
      }

      resultados.item15_custo_interno_real = {
        todas_conformes: custoInternoOk,
        detalhes: detalheCustoInterno,
      }

      // REQUISITO 16 (RODADA 16): SELFCHECK ESTENDIDO — SCORECARDS E ISOLAMENTO
      // Valida:
      // - Coleções scorecards e parametros_scorecards existem e ativas
      // - parametros_scorecards: versionamento com deleteRule = null (proibido apagar)
      // - scorecards: listRule restringe executor a prestador_email = @request.auth.email
      // - scorecards: createRule/updateRule nulos (apenas servidor/hooks)
      // - parâmetros ativos versionados para os 3 tipos de entidade (prestador_externo, interno, parceira)
      let scorecardsOk = true
      const detalheScorecards = {}
      try {
        const scCol = $app.findCollectionByNameOrId('scorecards')
        const psCol = $app.findCollectionByNameOrId('parametros_scorecards')

        detalheScorecards.colecoes_configuradas = Boolean(scCol && psCol)

        // scorecards: RLS seguro (executor só vê seu próprio email)
        const scListRuleSegura =
          scCol.listRule &&
          scCol.listRule.includes('prestador_email = @request.auth.email') &&
          scCol.createRule === null &&
          scCol.updateRule === null
        detalheScorecards.scorecards_isolamento_prestador = Boolean(scListRuleSegura)

        // parametros_scorecards: deleteRule nulo para garantir imutabilidade de versões
        const psImutavel = psCol.deleteRule === null
        detalheScorecards.parametros_versionados_imutaveis = Boolean(psImutavel)

        // Verificar versões ativas dos parâmetros
        const pExt = $app.findRecordsByFilter(
          'parametros_scorecards',
          "tipo_entidade = 'prestador_externo' && ativo = true",
          '',
          1,
          0,
        )
        const pInt = $app.findRecordsByFilter(
          'parametros_scorecards',
          "tipo_entidade = 'prestador_interno' && ativo = true",
          '',
          1,
          0,
        )
        const pParc = $app.findRecordsByFilter(
          'parametros_scorecards',
          "tipo_entidade = 'empresa_parceira' && ativo = true",
          '',
          1,
          0,
        )

        detalheScorecards.parametros_ativos_configurados = Boolean(
          pExt.length > 0 && pInt.length > 0 && pParc.length > 0,
        )

        if (
          !detalheScorecards.colecoes_configuradas ||
          !detalheScorecards.scorecards_isolamento_prestador ||
          !detalheScorecards.parametros_versionados_imutaveis ||
          !detalheScorecards.parametros_ativos_configurados
        ) {
          scorecardsOk = false
        }
      } catch (eSc) {
        scorecardsOk = false
        detalheScorecards.erro = String(eSc)
      }

      resultados.item16_scorecards_isolamento = {
        todas_conformes: scorecardsOk,
        detalhes: detalheScorecards,
      }

      // REQUISITO 17 (RODADA 17): SELFCHECK — IFC / BCF E ISSUES DE REVISÃO
      // Valida:
      // - entregaveis_versoes com campos resumo_ifc_json, hash_sha256, tamanho
      // - issues_revisao com campos essenciais e RLS segmentado
      // - parâmetro tamanho_maximo_ifc_mb configurado na coleção parametros
      let ifcBcfOk = true
      const detalheIfcBcf = {}
      try {
        const evCol = $app.findCollectionByNameOrId('entregaveis_versoes')
        const irCol = $app.findCollectionByNameOrId('issues_revisao')

        detalheIfcBcf.campo_resumo_ifc = Boolean(evCol.fields.getByName('resumo_ifc_json'))
        detalheIfcBcf.campo_hash_sha256 = Boolean(evCol.fields.getByName('hash_sha256'))
        detalheIfcBcf.campo_tamanho = Boolean(evCol.fields.getByName('tamanho'))

        detalheIfcBcf.colecao_issues_revisao = Boolean(irCol)
        detalheIfcBcf.viewpoint_protegido = Boolean(
          irCol &&
          irCol.fields.getByName('viewpoint') &&
          irCol.fields.getByName('viewpoint').protected,
        )

        const irListSegura =
          irCol &&
          irCol.listRule &&
          irCol.listRule.includes('entregavel.prestador.email = @request.auth.email')
        detalheIfcBcf.issues_isolamento_prestador = Boolean(irListSegura)

        const pTeto = $app.findRecordsByFilter(
          'parametros',
          "chave = 'tamanho_maximo_ifc_mb'",
          '',
          1,
          0,
        )
        detalheIfcBcf.parametro_teto_ifc = Boolean(pTeto.length > 0)
        detalheIfcBcf.teto_ifc_mb = pTeto.length > 0 ? pTeto[0].getString('valor') : '150'

        if (
          !detalheIfcBcf.campo_resumo_ifc ||
          !detalheIfcBcf.campo_hash_sha256 ||
          !detalheIfcBcf.campo_tamanho ||
          !detalheIfcBcf.colecao_issues_revisao ||
          !detalheIfcBcf.viewpoint_protegido ||
          !detalheIfcBcf.issues_isolamento_prestador ||
          !detalheIfcBcf.parametro_teto_ifc
        ) {
          ifcBcfOk = false
        }
      } catch (eIfc) {
        ifcBcfOk = false
        detalheIfcBcf.erro = String(eIfc)
      }

      resultados.item17_ifc_bcf_issues = {
        todas_conformes: ifcBcfOk,
        detalhes: detalheIfcBcf,
      }

      // REQUISITO 18 (RODADA 18): SELFCHECK — MATRIZ POR PERFIL E SIGILO DE CAMPOS SENSÍVEIS
      // Valida:
      // - Coleção 'decisoes_acoes' criada e protegida
      // - Parâmetros 'token_publico_expiracao_horas', 'token_publico_tentativas_max', 'decisoes_limite_dias_revisao_sla'
      // - API rules das coleções sensíveis (cotacoes, pre_cotacao_respostas, custos_profissional, mensagens_os)
      // - Isolamento do Comercial (sem preço de prestador em cotacoes), Gestor (sem dados bancários), Financeiro e Executor
      let matrizPerfilOk = true
      const detalheMatrizPerfil = {}
      try {
        const daCol = $app.findCollectionByNameOrId('decisoes_acoes')
        detalheMatrizPerfil.colecao_decisoes_acoes = Boolean(daCol)

        const cotCol = $app.findCollectionByNameOrId('cotacoes')
        const pcrCol = $app.findCollectionByNameOrId('pre_cotacao_respostas')
        const cpCol = $app.findCollectionByNameOrId('custos_profissional')
        const mosCol = $app.findCollectionByNameOrId('mensagens_os')

        detalheMatrizPerfil.cotacoes_regra_comercial_protegida = Boolean(
          cotCol &&
          cotCol.listRule &&
          !cotCol.listRule.includes('@request.auth.role = "comercial"'),
        )
        detalheMatrizPerfil.precotacao_regra_comercial_protegida = Boolean(
          pcrCol &&
          pcrCol.listRule &&
          !pcrCol.listRule.includes('@request.auth.role = "comercial"'),
        )
        detalheMatrizPerfil.custos_profissional_isolamento = Boolean(
          cpCol &&
          cpCol.listRule &&
          (cpCol.listRule.includes('admin') || cpCol.listRule.includes('financeiro')),
        )
        detalheMatrizPerfil.mensagens_os_regra_financeiro_sem_acesso = Boolean(
          mosCol &&
          mosCol.listRule &&
          !mosCol.listRule.includes('@request.auth.role = "financeiro"'),
        )

        const pExp = $app.findRecordsByFilter(
          'parametros',
          "chave = 'token_publico_expiracao_horas'",
          '',
          1,
          0,
        )
        const pTent = $app.findRecordsByFilter(
          'parametros',
          "chave = 'token_publico_tentativas_max'",
          '',
          1,
          0,
        )
        const pSla = $app.findRecordsByFilter(
          'parametros',
          "chave = 'decisoes_limite_dias_revisao_sla'",
          '',
          1,
          0,
        )

        detalheMatrizPerfil.parametro_token_expiracao = Boolean(pExp.length > 0)
        detalheMatrizPerfil.parametro_token_tentativas = Boolean(pTent.length > 0)
        detalheMatrizPerfil.parametro_sla_decisoes = Boolean(pSla.length > 0)

        if (
          !detalheMatrizPerfil.colecao_decisoes_acoes ||
          !detalheMatrizPerfil.cotacoes_regra_comercial_protegida ||
          !detalheMatrizPerfil.precotacao_regra_comercial_protegida ||
          !detalheMatrizPerfil.custos_profissional_isolamento ||
          !detalheMatrizPerfil.mensagens_os_regra_financeiro_sem_acesso ||
          !detalheMatrizPerfil.parametro_token_expiracao ||
          !detalheMatrizPerfil.parametro_token_tentativas ||
          !detalheMatrizPerfil.parametro_sla_decisoes
        ) {
          matrizPerfilOk = false
        }
      } catch (eMatriz) {
        matrizPerfilOk = false
        detalheMatrizPerfil.erro = String(eMatriz)
      }

      resultados.item18_matriz_perfil_sigilo = {
        todas_conformes: matrizPerfilOk,
        detalhes: detalheMatrizPerfil,
      }

      // -----------------------------------------------------------------------
      // ITEM 19 (RODADA 19): Operação, Erros de Sistema e Crons
      // -----------------------------------------------------------------------
      let operacaoOk = true
      const detalheOperacao = {
        colecao_erros_sistema: false,
        total_erros_sistema: 0,
        parametros_upload_presentes: false,
        parametro_crons_ultimo_sucesso: false,
        rotinas_crons_ativas: 4,
      }

      try {
        const errCol = $app.findCollectionByNameOrId('erros_sistema')
        detalheOperacao.colecao_erros_sistema = Boolean(errCol)
        if (errCol) {
          detalheOperacao.total_erros_sistema = $app.countRecords('erros_sistema')
        }

        const pIfc = $app.findRecordsByFilter('parametros', "chave = 'upload_max_ifc_mb'", '', 1, 0)
        const pDwg = $app.findRecordsByFilter('parametros', "chave = 'upload_max_dwg_mb'", '', 1, 0)
        const pPdf = $app.findRecordsByFilter('parametros', "chave = 'upload_max_pdf_mb'", '', 1, 0)
        const pImg = $app.findRecordsByFilter(
          'parametros',
          "chave = 'upload_max_imagem_mb'",
          '',
          1,
          0,
        )
        detalheOperacao.parametros_upload_presentes = Boolean(
          pIfc.length > 0 && pDwg.length > 0 && pPdf.length > 0 && pImg.length > 0,
        )

        const pCronSuc = $app.findRecordsByFilter(
          'parametros',
          "chave = 'crons_ultimo_sucesso'",
          '',
          1,
          0,
        )
        detalheOperacao.parametro_crons_ultimo_sucesso = Boolean(pCronSuc.length > 0)

        if (
          !detalheOperacao.colecao_erros_sistema ||
          !detalheOperacao.parametros_upload_presentes ||
          !detalheOperacao.parametro_crons_ultimo_sucesso
        ) {
          operacaoOk = false
        }
      } catch (eOp) {
        operacaoOk = false
        detalheOperacao.erro = String(eOp)
      }

      resultados.item19_operacao_erros_crons = {
        todas_conformes: operacaoOk,
        detalhes: detalheOperacao,
      }

      resultados.conformidade_geral =
        resultados.item1_api_rules.cotacoes_segura &&
        resultados.item1_api_rules.subcontratos_segura &&
        resultados.item1_api_rules.users_anti_escalonamento &&
        resultados.item2_protected_files.todos_protegidos &&
        resultados.item3_token_security.campos_configurados &&
        resultados.item4_telefones_json.campos_configurados &&
        prestadoresOk &&
        colecoesNovasOk &&
        cotacaoAutomaticaOk &&
        assinaturaEletronicaOk &&
        comunicacaoOsOk &&
        monitoramentoOk &&
        iaOperacaoOk &&
        smtpOk &&
        recrutamentoTriagemOk &&
        prospeccaoOk &&
        custoInternoOk &&
        scorecardsOk &&
        ifcBcfOk &&
        matrizPerfilOk &&
        operacaoOk

      return e.json(200, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        resultados: resultados,
      })
    } catch (err) {
      console.log('Erro no selfcheck de seguranca: ' + err)
      return e.json(500, { message: 'Erro ao executar autochecagem de segurança: ' + err })
    }
  },
  $apis.requireAuth(),
)
