// Hook to guard inactivation (only admin can move to inativa or update an inativa status)
// and automatic suggested reactivation generation when a new active contract is added to an inactive/nutricao company
// and Cadência de 5 toques server-side rules:
// - Bloquear início de cadência para empresa parceira
// - Gerar automaticamente 5 toques calculados a partir dos parâmetros quando empresa entra em "em_cadencia"
// - Atualizar proxima_acao_data e proxima_acao_desc da empresa a partir do próximo toque ativo

onRecordUpdateRequest((e) => {
  try {
    const auth = e.auth
    const original = e.record.original()
    const newEtapa = e.record.getString('etapa_funil')
    const oldEtapa = original ? original.getString('etapa_funil') : ''
    const newStatus = e.record.getString('status')
    const oldStatus = original ? original.getString('status') : ''

    const role = auth ? auth.getString('role') : ''

    // Se estiver tentando inativar (etapa_funil = 'inativa' ou status = 'inativa') e o usuário não for admin
    const tryingToInactivate =
      (newEtapa === 'inativa' && oldEtapa !== 'inativa') ||
      (newStatus === 'inativa' && oldStatus !== 'inativa')

    if (tryingToInactivate && role !== 'admin') {
      throw new ForbiddenError(
        'Apenas administradores podem inativar empresas no funil de intermediação.',
      )
    }

    // Regra: EMPRESA PARCEIRA NÃO ENTRA NA CADÊNCIA — bloquear no servidor (hook)
    if (newEtapa === 'em_cadencia' && oldEtapa === 'parceira') {
      throw new BadRequestError(
        'Empresas já homologadas como Parceiras não podem ser incluídas na cadência de prospecção.',
      )
    }

    // Se estiver mudando de etapa, registrar no campo etapa_anterior para permitir restauração
    if (newEtapa && oldEtapa && newEtapa !== oldEtapa && newEtapa === 'inativa') {
      e.record.set('etapa_anterior', oldEtapa)
    }
  } catch (err) {
    throw err
  }

  e.next()
}, 'empresas')

// Hook onRecordAfterUpdateSuccess for empresas:
// When empresa enters 'em_cadencia', generate the 5 toques if not already present or active
onRecordAfterUpdateSuccess((e) => {
  try {
    const empresa = e.record
    const original = empresa.original()
    const newEtapa = empresa.getString('etapa_funil')
    const oldEtapa = original ? original.getString('etapa_funil') : ''

    if (newEtapa === 'em_cadencia' && oldEtapa !== 'em_cadencia') {
      const empresaId = empresa.id

      // Check if there are already toques for this empresa
      const existingToques = $app.findRecordsByFilter(
        'toques',
        "empresa = '" + empresaId + "' && status != 'cancelado'",
        'numero_toque',
        10,
        0,
      )

      if (existingToques.length === 0) {
        // Obter parâmetros de dias
        let t2Dias = 2
        let t3Dias = 7
        let t4Dias = 12
        let t5Dias = 30

        try {
          const p2 = $app.findFirstRecordByData('parametros', 'chave', 'toque2_dias')
          if (p2) t2Dias = parseInt(p2.getString('valor'), 10) || 2
        } catch (_) {}

        try {
          const p3 = $app.findFirstRecordByData('parametros', 'chave', 'toque3_dias')
          if (p3) t3Dias = parseInt(p3.getString('valor'), 10) || 7
        } catch (_) {}

        try {
          const p4 = $app.findFirstRecordByData('parametros', 'chave', 'toque4_dias_inicio')
          if (p4) t4Dias = parseInt(p4.getString('valor'), 10) || 12
        } catch (_) {}

        try {
          const p5 = $app.findFirstRecordByData('parametros', 'chave', 'toque5_dias')
          if (p5) t5Dias = parseInt(p5.getString('valor'), 10) || 30
        } catch (_) {}

        const now = new Date()
        const toDateString = (d) => {
          return d.toISOString().substring(0, 10) + ' 12:00:00.000Z'
        }

        const addDays = (baseDate, days) => {
          const d = new Date(baseDate.getTime())
          d.setDate(d.getDate() + days)
          return d
        }

        const d0 = toDateString(now)
        const d2 = toDateString(addDays(now, t2Dias))
        const d7 = toDateString(addDays(now, t3Dias))
        const d12 = toDateString(addDays(now, t4Dias))
        const d30 = toDateString(addDays(now, t5Dias))

        const toquesCol = $app.findCollectionByNameOrId('toques')

        const toquesDef = [
          {
            num: 1,
            canal: 'email',
            data: d0,
            obs: 'Toque 1 institucional de apresentação e credenciamento.',
          },
          { num: 2, canal: 'whatsapp', data: d2, obs: 'Toque 2 de retomada via WhatsApp.' },
          {
            num: 3,
            canal: 'email',
            data: d7,
            obs: 'Toque 3 de solução técnica elaborada e viabilidade.',
          },
          { num: 4, canal: 'whatsapp', data: d12, obs: 'Toque 4 de retomada via WhatsApp.' },
          {
            num: 5,
            canal: 'email',
            data: d30,
            obs: 'Toque 5 de oferta de projeto piloto preliminar sem risco.',
          },
        ]

        for (let i = 0; i < toquesDef.length; i++) {
          const td = toquesDef[i]
          const rec = new Record(toquesCol)
          rec.set('empresa', empresaId)
          rec.set('numero_toque', td.num)
          rec.set('canal', td.canal)
          rec.set('data_prevista', td.data)
          rec.set('status', 'agendado')
          rec.set('observacao', td.obs)
          $app.save(rec)
        }

        // Atualizar campos da empresa com a próxima ação real (Toque 1)
        empresa.set('proxima_acao_data', d0)
        empresa.set('proxima_acao_desc', 'Toque 1: E-mail Institucional (D0)')
        $app.save(empresa)

        // Registrar auditoria específica do início da cadência
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'INICIO_CADENCIA')
          aRec.set('entidade', 'toques')
          aRec.set('registro_id', empresaId)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Cadência padrão de 5 toques gerada automaticamente na entrada da etapa Em cadência.',
            empresa_id: empresaId,
            empresa_nome: empresa.getString('razao_social'),
          })
          $app.save(aRec)
        } catch (_) {}
      }
    }
  } catch (err) {
    console.log('Erro ao processar início de cadência da empresa: ' + err)
  } finally {
    e.next()
  }
}, 'empresas')

// Hook on contratos creation: if empresa is in 'nutricao_mensal' or 'inativa', create reativacao_sugerida
onRecordAfterCreateSuccess((e) => {
  try {
    const contrato = e.record
    const empresaId = contrato.getString('empresa')
    if (!empresaId) return

    const empresa = $app.findRecordById('empresas', empresaId)
    if (!empresa) return

    const etapa = empresa.getString('etapa_funil')
    const status = empresa.getString('status')

    if (etapa === 'nutricao_mensal' || etapa === 'inativa' || status === 'inativa') {
      const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')
      const reatRec = new Record(reativacoesCol)

      reatRec.set('empresa', empresa.id)
      reatRec.set('contrato', contrato.id)
      reatRec.set('contrato_numero', contrato.getString('numero') || '')
      reatRec.set('contrato_orgao', contrato.getString('orgao') || '')
      reatRec.set('contrato_valor', contrato.getFloat('valor') || 0)
      reatRec.set('etapa_origem', etapa || status || 'nutricao_mensal')
      reatRec.set('status', 'pendente')

      $app.save(reatRec)
    }
  } catch (err) {
    console.log('Erro ao processar sugestao de reativacao por novo contrato: ' + err)
  } finally {
    e.next()
  }
}, 'contratos')
