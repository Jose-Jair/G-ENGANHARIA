// Rotas Públicas e Operações de Descadastro e Resposta de Campanhas (Etapa 5):
// 1. GET /backend/v1/descadastro/info/{token} (público)
//    - Retorna dados mínimos e seguros para a página pública (/descadastro/:token)
// 2. POST /backend/v1/descadastro/confirmar (público)
//    - Valida o token
//    - Insere o e-mail/empresa na tabela 'nao_contatar' (motivo "Descadastro em campanha de nutrição")
//    - Marca 'descadastro_em' no envio e incrementa 'descadastros' na campanha
//    - Registra auditoria completa
// 3. POST /backend/v1/campanhas/marcar-resposta (autenticado Comercial / Admin)
//    - Marca data de resposta e observação no envio
//    - Move empresa para "em_conversa" no funil
//    - Pausa nutrição para a empresa
//    - Audita retorno ao funil

routerAdd('GET', '/backend/v1/descadastro/info/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { message: 'Token não fornecido' })
    }

    const envios = $app.findRecordsByFilter(
      'campanha_envios',
      "token_rastreamento = '" + token + "'",
      '-created',
      1,
      0,
    )
    if (envios.length === 0) {
      return e.json(404, { message: 'Registro de envio não localizado ou link expirado.' })
    }

    const envio = envios[0]
    const empresaId = envio.getString('empresa')
    let empresaNome = 'Empresa'
    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) {
          empresaNome = emp.getString('nome_fantasia') || emp.getString('razao_social') || 'Empresa'
        }
      } catch (_) {}
    }

    return e.json(200, {
      token: token,
      email: envio.getString('destinatario_email'),
      destinatario_nome: envio.getString('destinatario_nome'),
      empresa_nome: empresaNome,
      ja_descadastrado: !!envio.getString('descadastro_em'),
      data_descadastro: envio.getString('descadastro_em'),
    })
  } catch (err) {
    console.log('Erro ao consultar info de descadastro: ' + err)
    return e.json(500, { message: 'Erro interno ao consultar dados de descadastro: ' + err })
  }
})

routerAdd('POST', '/backend/v1/descadastro/confirmar', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const token = body.token
    const motivoCliente =
      body.motivo || 'Descadastro solicitado pelo destinatário via link de e-mail (LGPD)'

    if (!token) {
      return e.json(400, { message: 'Token de descadastro obrigatório' })
    }

    const envios = $app.findRecordsByFilter(
      'campanha_envios',
      "token_rastreamento = '" + token + "'",
      '-created',
      1,
      0,
    )
    if (envios.length === 0) {
      return e.json(404, { message: 'Registro não localizado' })
    }

    const envio = envios[0]
    const email = (envio.getString('destinatario_email') || '').trim()
    const empresaId = envio.getString('empresa')
    const jaDescadastrado = envio.getString('descadastro_em')

    if (!jaDescadastrado) {
      // 1. Atualizar envio
      const nowIso = new Date().toISOString()
      envio.set('descadastro_em', nowIso)
      $app.save(envio)

      // 2. Incrementar descadastros na campanha
      const campId = envio.getString('campanha')
      if (campId) {
        try {
          const camp = $app.findRecordById('campanhas', campId)
          if (camp) {
            const numDesc = camp.getInt('descadastros') || 0
            camp.set('descadastros', numDesc + 1)
            $app.save(camp)
          }
        } catch (_) {}
      }

      // 3. Inserir na coleção 'nao_contatar' se ainda não estiver
      const naoContatarCol = $app.findCollectionByNameOrId('nao_contatar')
      let jaBloqueado = false
      if (email) {
        const exist = $app.findRecordsByFilter(
          'nao_contatar',
          "email ~ '" + email + "'",
          '-created',
          1,
          0,
        )
        if (exist.length > 0) jaBloqueado = true
      }

      if (!jaBloqueado) {
        const ncRec = new Record(naoContatarCol)
        if (empresaId) ncRec.set('empresa', empresaId)
        ncRec.set('email', email)
        ncRec.set('motivo', 'Descadastro em campanha de nutrição: ' + motivoCliente)
        ncRec.set('data_inclusao', nowIso.substring(0, 10) + ' 12:00:00.000Z')
        $app.save(ncRec)
      }

      // 4. Auditar descadastro
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'DESCADASTRO_CAMPANHA_LGPD')
        aRec.set('entidade', 'campanhas')
        aRec.set('registro_id', campId || envio.id)
        aRec.set('detalhes', {
          mensagem: 'Opt-out realizado pelo destinatário via link de descadastro da campanha.',
          email: email,
          empresa_id: empresaId,
          motivo: motivoCliente,
          token: token,
        })
        aRec.set('ip', e.requestInfo().remoteIP || '')
        $app.save(aRec)
      } catch (_) {}
    }

    return e.json(200, {
      success: true,
      message: 'Descadastro confirmado com sucesso. O e-mail foi incluído na lista "Não contatar".',
      email: email,
    })
  } catch (err) {
    console.log('Erro ao confirmar descadastro: ' + err)
    return e.json(500, { message: 'Erro ao processar descadastro: ' + err })
  }
})

// Endpoint autenticado para Comercial/Admin registrar resposta manual da campanha:
// Move empresa de volta para "em_conversa" no funil, pausa nutrição e audita
routerAdd(
  'POST',
  '/backend/v1/campanhas/marcar-resposta',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas Admin ou Comercial podem registrar respostas a campanhas.',
        })
      }

      const body = reqInfo.body || {}
      const envioId = body.envio_id
      const observacao =
        body.observacao || 'Interesse manifestado via resposta ao e-mail de nutrição mensal.'

      if (!envioId) {
        return e.json(400, { message: 'ID do envio não informado' })
      }

      const envio = $app.findRecordById('campanha_envios', envioId)
      if (!envio) {
        return e.json(404, { message: 'Registro de envio não encontrado' })
      }

      const jaRespondeu = envio.getString('resposta_em')
      const nowIso = new Date().toISOString()

      envio.set('resposta_em', nowIso)
      envio.set('resposta_observacao', observacao)
      $app.save(envio)

      // Incrementar contagem de respostas na campanha se ainda não havia respondido
      const campId = envio.getString('campanha')
      if (!jaRespondeu && campId) {
        try {
          const camp = $app.findRecordById('campanhas', campId)
          if (camp) {
            const respAtuais = camp.getInt('respostas') || 0
            camp.set('respostas', respAtuais + 1)
            $app.save(camp)
          }
        } catch (_) {}
      }

      // RETORNO AO FUNIL:
      // Mover empresa de volta ao funil na coluna "em_conversa", pausar nutrição para ela
      const empresaId = envio.getString('empresa')
      let empresaNome = ''
      if (empresaId) {
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          if (emp) {
            empresaNome = emp.getString('razao_social')
            const etapaAnterior = emp.getString('etapa_funil')
            emp.set('etapa_anterior', etapaAnterior)
            emp.set('etapa_funil', 'em_conversa')
            emp.set('status', 'ativa')
            emp.set('proxima_acao_data', nowIso)
            emp.set(
              'proxima_acao_desc',
              'Retomada comercial ativa: empresa respondeu à campanha de nutrição.',
            )
            $app.save(emp)

            // Auditar retorno ao funil
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', reqInfo.auth.id)
            aRec.set('user_email', reqInfo.auth.getString('email'))
            aRec.set('acao', 'RETORNO_FUNIL_RESPOSTA_NUTRICAO')
            aRec.set('entidade', 'empresas')
            aRec.set('registro_id', empresaId)
            aRec.set('detalhes', {
              mensagem:
                'Empresa retornou ao funil na etapa Em conversa após resposta à campanha de nutrição.',
              empresa_id: empresaId,
              empresa_nome: empresaNome,
              campanha_id: campId,
              observacao: observacao,
              movido_por: reqInfo.auth.getString('email'),
            })
            aRec.set('ip', reqInfo.remoteIP || '')
            $app.save(aRec)
          }
        } catch (empErr) {
          console.log('Erro ao mover empresa de volta ao funil: ' + empErr)
        }
      }

      return e.json(200, {
        success: true,
        message:
          'Resposta registrada com sucesso. A empresa retornou para a etapa "Em conversa" no funil.',
        empresa_id: empresaId,
        empresa_nome: empresaNome,
      })
    } catch (err) {
      console.log('Erro ao marcar resposta de campanha: ' + err)
      return e.json(500, { message: 'Erro interno ao processar resposta: ' + err })
    }
  },
  $apis.requireAuth(),
)
