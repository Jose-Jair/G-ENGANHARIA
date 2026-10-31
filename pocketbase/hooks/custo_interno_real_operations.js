// pocketbase/hooks/custo_interno_real_operations.js
// RODADA 15 — CUSTO INTERNO REAL
// Regras implementadas (com escopo estritamente inline para compatibilidade Goja/PocketBase JSVM):
// (1) Histórico de vigências em custos_profissional
// (2) Validação estrita de Apontamentos de horas
// (3) Medição automática pelo ciclo
// (4) Custo da OS interna e Contas
// (5) Indicador "fazer dentro ou fora" por disciplina
// (6) API rules de isolamento

// ----------------------------------------------------------------------------
// 1. Hook em custos_profissional: cálculo automático de custo_hora e sincronização
// ----------------------------------------------------------------------------
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'custos_profissional') {
    const cMensal = rec.getFloat('custo_mensal') || 0
    const hMes = rec.getFloat('horas_mes') || 0

    if (hMes <= 0) {
      throw new BadRequestError('As horas contratadas por mês devem ser maiores que zero.')
    }
    if (cMensal < 0) {
      throw new BadRequestError('O custo mensal não pode ser negativo.')
    }

    const cHora = Math.round((cMensal / hMes) * 100) / 100
    rec.set('custo_hora', cHora)
  }
  e.next()
})

onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'custos_profissional') {
    try {
      const prestadorId = rec.getString('prestador')
      if (prestadorId) {
        const prestador = $app.findRecordById('prestadores', prestadorId)
        if (prestador) {
          prestador.set('custo_mensal', rec.getFloat('custo_mensal'))
          prestador.set('horas_mes', rec.getFloat('horas_mes'))
          prestador.set('custo_hora', rec.getFloat('custo_hora'))
          $app.save(prestador)
        }
      }
    } catch (err) {
      console.log('Aviso ao sincronizar custo na vigência do prestador: ' + err)
    }
  }
  e.next()
})

// ----------------------------------------------------------------------------
// 2. Validações de Apontamentos (apontamentos)
// ----------------------------------------------------------------------------
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'apontamentos') {
    const osId = rec.getString('os')
    const prestadorId = rec.getString('prestador')
    const dataApt = rec.getString('data')
    const horas = rec.getFloat('horas') || 0

    if (!osId) {
      throw new BadRequestError('A Ordem de Serviço é obrigatória.')
    }
    if (!prestadorId) {
      throw new BadRequestError('O Prestador é obrigatório.')
    }
    if (!dataApt) {
      throw new BadRequestError('A data do apontamento é obrigatória.')
    }

    // 1. Passo de horas configurado
    let passo = 0.25
    try {
      const p = $app.findFirstRecordByData('parametros', 'chave', 'apontamento_passo_horas')
      if (p && p.getString('valor')) {
        const pv = parseFloat(p.getString('valor'))
        if (!isNaN(pv) && pv > 0) passo = pv
      }
    } catch (_) {}

    const resto = (horas * 100) % (passo * 100)
    if (resto > 0.001 && resto < passo * 100 - 0.001) {
      throw new BadRequestError(
        'As horas apontadas (' +
          horas +
          'h) devem seguir o passo mínimo de ' +
          passo +
          ' horas (ex: 0.25, 0.5, 0.75, 1.0).',
      )
    }

    // 2. Pertencimento: a OS deve pertencer ao prestador
    let osRec
    try {
      osRec = $app.findRecordById('ordens_servico', osId)
    } catch (_) {
      throw new BadRequestError('Ordem de Serviço informada não encontrada.')
    }

    if (osRec.getString('prestador') !== prestadorId) {
      throw new BadRequestError(
        'Acesso negado: o prestador só pode realizar apontamentos na sua própria Ordem de Serviço.',
      )
    }

    // 3. Retroativo máximo
    let maxRetroDias = 7
    try {
      const p = $app.findFirstRecordByData('parametros', 'chave', 'apontamento_retroativo_max_dias')
      if (p && p.getString('valor')) {
        const mv = parseInt(p.getString('valor'), 10)
        if (!isNaN(mv) && mv >= 0) maxRetroDias = mv
      }
    } catch (_) {}

    const dtApt = new Date(dataApt)
    dtApt.setHours(0, 0, 0, 0)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const diffDias = Math.round((hoje.getTime() - dtApt.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDias > maxRetroDias) {
      throw new BadRequestError(
        'BLOQUEIO: Apontamento retroativo recusado. A data informada (' +
          dataApt.substring(0, 10) +
          ') tem mais de ' +
          maxRetroDias +
          ' dias de atraso em relação a hoje.',
      )
    }
    if (diffDias < 0) {
      throw new BadRequestError('BLOQUEIO: Não é permitido apontar horas em datas futuras.')
    }

    // 4. Limite diário = horas contratadas (horas_mes / 22 ou horas_dia_padrao)
    let limiteDiarioHoras = 8
    try {
      const prestadorRec = $app.findRecordById('prestadores', prestadorId)
      const hMes = prestadorRec ? prestadorRec.getFloat('horas_mes') : 0
      if (hMes > 0) {
        limiteDiarioHoras = Math.round((hMes / 22) * 100) / 100
      } else {
        const pPadrao = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'apontamento_horas_dia_padrao',
        )
        if (pPadrao && pPadrao.getString('valor')) {
          const ldv = parseFloat(pPadrao.getString('valor'))
          if (!isNaN(ldv) && ldv > 0) limiteDiarioHoras = ldv
        }
      }
    } catch (_) {}

    // Somar outros apontamentos do mesmo prestador na mesma data
    const filtroOutros =
      "prestador = '" +
      prestadorId +
      "' && data ~ '" +
      dataApt.substring(0, 10) +
      "' && status != 'rejeitado'"
    const outrosApt = $app.findRecordsByFilter('apontamentos', filtroOutros, '', 100, 0)

    let somaHorasDia = horas
    for (let i = 0; i < outrosApt.length; i++) {
      if (outrosApt[i].id !== rec.id) {
        somaHorasDia += outrosApt[i].getFloat('horas') || 0
      }
    }

    if (somaHorasDia > limiteDiarioHoras + 0.001) {
      throw new BadRequestError(
        'BLOQUEIO: Limite diário de horas excedido. Total para o dia ' +
          dataApt.substring(0, 10) +
          ': ' +
          somaHorasDia +
          'h (limite diário contratado: ' +
          limiteDiarioHoras +
          'h).',
      )
    }

    if (!rec.getString('status')) {
      rec.set('status', 'pendente')
    }
  }
  e.next()
})

// ----------------------------------------------------------------------------
// 3. Ouvir transições da OS e recalcular métricas inline
// ----------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'ordens_servico') {
    try {
      const osId = rec.id
      const osRec = $app.findRecordById('ordens_servico', osId)
      if (osRec) {
        const tipoPrest = osRec.getString('tipo_prestador')
        const prestadorId = osRec.getString('prestador')
        const dtInicio = osRec.getString('data_inicio')
        const dtConclusao = osRec.getString('data_conclusao') || new Date().toISOString()

        let dCorridos = 0
        let dUteis = 0
        if (dtInicio && dtConclusao) {
          const dt1 = new Date(dtInicio)
          const dt2 = new Date(dtConclusao)
          if (!isNaN(dt1.getTime()) && !isNaN(dt2.getTime()) && dt1 <= dt2) {
            dCorridos =
              Math.ceil(Math.abs(dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const cur = new Date(dt1)
            while (cur <= dt2) {
              const day = cur.getDay()
              if (day !== 0 && day !== 6) dUteis++
              cur.setDate(cur.getDate() + 1)
            }
          }
        }
        osRec.set('lead_time_dias_corridos', dCorridos)
        osRec.set('lead_time_dias_uteis', dUteis)

        let totalCiclos = 0
        try {
          const entregaveisDaOs = $app.findRecordsByFilter(
            'entregaveis',
            "ordem_servico = '" + osId + "'",
            '',
            100,
            0,
          )
          for (let eIdx = 0; eIdx < entregaveisDaOs.length; eIdx++) {
            const vCount = entregaveisDaOs[eIdx].getInt('versao_atual') || 1
            if (vCount > 1) totalCiclos += vCount - 1
          }
        } catch (_) {}
        osRec.set('ciclos_revisao', totalCiclos)

        if (tipoPrest === 'interno' && prestadorId) {
          let horasDia = 8
          let custoHora = 0
          try {
            const pRec = $app.findRecordById('prestadores', prestadorId)
            if (pRec) {
              custoHora = pRec.getFloat('custo_hora') || 0
              const hMes = pRec.getFloat('horas_mes') || 0
              if (hMes > 0) horasDia = hMes / 22
            }
          } catch (_) {}

          let totalSimultaneas = 1
          try {
            const osAtivas = $app.findRecordsByFilter(
              'ordens_servico',
              "prestador = '" +
                prestadorId +
                "' && status != 'concluida' && status != 'avaliada' && status != 'encerrada' && status != 'cancelada'",
              '',
              100,
              0,
            )
            totalSimultaneas = Math.max(1, osAtivas.length)
          } catch (_) {}

          const horasEstimadas = Math.round(((dUteis * horasDia) / totalSimultaneas) * 100) / 100
          osRec.set('horas_estimadas', horasEstimadas)

          const exigeApontamento = osRec.getBool('exige_apontamento')
          let horasApuradas = horasEstimadas

          if (exigeApontamento) {
            let somaHorasApontadas = 0
            try {
              const apts = $app.findRecordsByFilter(
                'apontamentos',
                "os = '" + osId + "' && status != 'rejeitado'",
                '',
                500,
                0,
              )
              for (let a = 0; a < apts.length; a++) {
                somaHorasApontadas += apts[a].getFloat('horas') || 0
              }
            } catch (_) {}
            horasApuradas = Math.round(somaHorasApontadas * 100) / 100
          }

          if (custoHora > 0) {
            const custoTotal = Math.round(horasApuradas * custoHora * 100) / 100
            osRec.set('custo_interno_apurado', custoTotal)
            osRec.set('status_custo_interno', 'configurado')
          } else {
            osRec.set('custo_interno_apurado', 0)
            osRec.set('status_custo_interno', 'nao_configurado')
          }
        }
        $app.save(osRec)
      }
    } catch (err) {
      console.log('Aviso ao recalcular métricas da OS: ' + err)
    }
  }
  e.next()
})

// ----------------------------------------------------------------------------
// 4. Hook na aprovação de entregável: transição de contas custo_interno previsto -> realizado
// ----------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'entregaveis') {
    const orig = rec.original()
    const stNovo = rec.getString('status')
    const stAntigo = orig ? orig.getString('status') : ''

    if (stNovo === 'aprovado' && stAntigo !== 'aprovado') {
      const osId = rec.getString('ordem_servico')
      if (osId) {
        try {
          const osRec = $app.findRecordById('ordens_servico', osId)
          if (osRec && osRec.getString('tipo_prestador') === 'interno') {
            const statusCusto = osRec.getString('status_custo_interno')
            const custoApurado = osRec.getFloat('custo_interno_apurado') || 0

            // Sem custo_hora preenchido, marcar 'custo não configurado' e NÃO lançar conta
            if (statusCusto === 'configurado' && custoApurado > 0) {
              const projetoId = osRec.getString('projeto')
              const contasCol = $app.findCollectionByNameOrId('contas')

              const contasExistentes = $app.findRecordsByFilter(
                'contas',
                "ordem_servico = '" + osId + "' && tipo = 'custo_interno' && status != 'cancelada'",
                '-created',
                1,
                0,
              )

              let cRec
              if (contasExistentes.length > 0) {
                cRec = contasExistentes[0]
              } else {
                cRec = new Record(contasCol)
                cRec.set('tipo', 'custo_interno')
                cRec.set('ordem_servico', osId)
                cRec.set('projeto', projetoId)
                cRec.set('descricao', 'Custo Interno Operacional - OS ' + osRec.getString('numero'))
              }

              cRec.set('valor', custoApurado)
              cRec.set('status', 'realizada')
              cRec.set('data_pagamento', new Date().toISOString())
              $app.save(cRec)
            }
          }
        } catch (errCusto) {
          console.log('Aviso ao sincronizar conta de custo interno na aprovação: ' + errCusto)
        }
      }
    }
  }
  e.next()
})

// ----------------------------------------------------------------------------
// 5. Rotas de Apontamentos e Aprovação em Lote
// ----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/apontamentos/aprovar-lote',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message: 'Acesso restrito: apenas Gestor e Administrador podem aprovar apontamentos.',
        })
      }

      const body = reqInfo.body || {}
      const ids = body.apontamento_ids || []
      const decisao = body.decisao || 'aprovado'
      const motivoRejeicao = body.motivo_rejeicao || ''

      if (!Array.isArray(ids) || ids.length === 0) {
        return e.json(400, { message: 'Informe uma lista de apontamento_ids para aprovação.' })
      }

      let processados = 0
      const osAfetadas = {}

      for (let i = 0; i < ids.length; i++) {
        try {
          const apt = $app.findRecordById('apontamentos', ids[i])
          if (apt) {
            apt.set('status', decisao)
            apt.set('aprovado_por', reqInfo.auth.id)
            apt.set('data_aprovacao', new Date().toISOString())
            if (decisao === 'rejeitado') {
              apt.set('motivo_rejeicao', motivoRejeicao)
            }
            $app.save(apt)
            processados++
            const osId = apt.getString('os')
            if (osId) osAfetadas[osId] = true
          }
        } catch (_) {}
      }

      // Recalcular métricas das OS afetadas
      const osIds = Object.keys(osAfetadas)
      for (let k = 0; k < osIds.length; k++) {
        try {
          const osRec = $app.findRecordById('ordens_servico', osIds[k])
          if (osRec && osRec.getString('tipo_prestador') === 'interno') {
            const prestadorId = osRec.getString('prestador')
            let custoHora = 0
            if (prestadorId) {
              const pRec = $app.findRecordById('prestadores', prestadorId)
              if (pRec) custoHora = pRec.getFloat('custo_hora') || 0
            }

            if (osRec.getBool('exige_apontamento')) {
              let somaHoras = 0
              const apts = $app.findRecordsByFilter(
                'apontamentos',
                "os = '" + osIds[k] + "' && status != 'rejeitado'",
                '',
                500,
                0,
              )
              for (let a = 0; a < apts.length; a++) {
                somaHoras += apts[a].getFloat('horas') || 0
              }
              const horasApuradas = Math.round(somaHoras * 100) / 100
              if (custoHora > 0) {
                osRec.set(
                  'custo_interno_apurado',
                  Math.round(horasApuradas * custoHora * 100) / 100,
                )
                osRec.set('status_custo_interno', 'configurado')
              } else {
                osRec.set('custo_interno_apurado', 0)
                osRec.set('status_custo_interno', 'nao_configurado')
              }
              $app.save(osRec)
            }
          }
        } catch (_) {}
      }

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'APROVACAO_LOTE_APONTAMENTOS')
        aRec.set('entidade', 'apontamentos')
        aRec.set('registro_id', ids.join(','))
        aRec.set('detalhes', {
          total_solicitados: ids.length,
          total_processados: processados,
          decisao: decisao,
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        processados: processados,
        decisao: decisao,
      })
    } catch (err) {
      console.log('Erro na aprovação em lote de apontamentos: ' + err)
      return e.json(500, { message: 'Erro ao processar aprovação: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------------------------------
// 6. Rota para recalcular custo interno de uma OS
// ----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/ordens-servico/{id}/recalcular-custo-interno',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor' && role !== 'financeiro') {
        return e.json(403, { message: 'Acesso restrito.' })
      }

      const osId = e.request.pathValue('id')
      let osRec
      try {
        osRec = $app.findRecordById('ordens_servico', osId)
      } catch (_) {
        return e.json(404, { message: 'OS não encontrada.' })
      }

      const tipoPrest = osRec.getString('tipo_prestador')
      const prestadorId = osRec.getString('prestador')
      const dtInicio = osRec.getString('data_inicio')
      const dtConclusao = osRec.getString('data_conclusao') || new Date().toISOString()

      let dCorridos = 0
      let dUteis = 0
      if (dtInicio && dtConclusao) {
        const dt1 = new Date(dtInicio)
        const dt2 = new Date(dtConclusao)
        if (!isNaN(dt1.getTime()) && !isNaN(dt2.getTime()) && dt1 <= dt2) {
          dCorridos = Math.ceil(Math.abs(dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24)) + 1
          const cur = new Date(dt1)
          while (cur <= dt2) {
            const day = cur.getDay()
            if (day !== 0 && day !== 6) dUteis++
            cur.setDate(cur.getDate() + 1)
          }
        }
      }
      osRec.set('lead_time_dias_corridos', dCorridos)
      osRec.set('lead_time_dias_uteis', dUteis)

      let totalCiclos = 0
      try {
        const entregaveisDaOs = $app.findRecordsByFilter(
          'entregaveis',
          "ordem_servico = '" + osId + "'",
          '',
          100,
          0,
        )
        for (let eIdx = 0; eIdx < entregaveisDaOs.length; eIdx++) {
          const vCount = entregaveisDaOs[eIdx].getInt('versao_atual') || 1
          if (vCount > 1) totalCiclos += vCount - 1
        }
      } catch (_) {}
      osRec.set('ciclos_revisao', totalCiclos)

      if (tipoPrest === 'interno' && prestadorId) {
        let horasDia = 8
        let custoHora = 0
        try {
          const pRec = $app.findRecordById('prestadores', prestadorId)
          if (pRec) {
            custoHora = pRec.getFloat('custo_hora') || 0
            const hMes = pRec.getFloat('horas_mes') || 0
            if (hMes > 0) horasDia = hMes / 22
          }
        } catch (_) {}

        let totalSimultaneas = 1
        try {
          const osAtivas = $app.findRecordsByFilter(
            'ordens_servico',
            "prestador = '" +
              prestadorId +
              "' && status != 'concluida' && status != 'avaliada' && status != 'encerrada' && status != 'cancelada'",
            '',
            100,
            0,
          )
          totalSimultaneas = Math.max(1, osAtivas.length)
        } catch (_) {}

        const horasEstimadas = Math.round(((dUteis * horasDia) / totalSimultaneas) * 100) / 100
        osRec.set('horas_estimadas', horasEstimadas)

        const exigeApontamento = osRec.getBool('exige_apontamento')
        let horasApuradas = horasEstimadas

        if (exigeApontamento) {
          let somaHoras = 0
          try {
            const apts = $app.findRecordsByFilter(
              'apontamentos',
              "os = '" + osId + "' && status != 'rejeitado'",
              '',
              500,
              0,
            )
            for (let a = 0; a < apts.length; a++) {
              somaHoras += apts[a].getFloat('horas') || 0
            }
          } catch (_) {}
          horasApuradas = Math.round(somaHoras * 100) / 100
        }

        if (custoHora > 0) {
          const custoTotal = Math.round(horasApuradas * custoHora * 100) / 100
          osRec.set('custo_interno_apurado', custoTotal)
          osRec.set('status_custo_interno', 'configurado')
        } else {
          osRec.set('custo_interno_apurado', 0)
          osRec.set('status_custo_interno', 'nao_configurado')
        }
      }
      $app.save(osRec)

      return e.json(200, {
        success: true,
        os_id: osId,
        numero: osRec.getString('numero'),
        horas_estimadas: osRec.getFloat('horas_estimadas'),
        custo_interno_apurado: osRec.getFloat('custo_interno_apurado'),
        status_custo_interno: osRec.getString('status_custo_interno'),
        lead_time_dias_corridos: osRec.getFloat('lead_time_dias_corridos'),
        lead_time_dias_uteis: osRec.getFloat('lead_time_dias_uteis'),
        ciclos_revisao: osRec.getInt('ciclos_revisao'),
      })
    } catch (err) {
      return e.json(500, { message: 'Erro ao recalcular custo interno: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------------------------------
// 7. Indicador "Fazer Dentro ou Fora" por disciplina
// ----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/indicadores/fazer-dentro-ou-fora',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor' && role !== 'financeiro') {
        return e.json(403, { message: 'Acesso restrito à coordenação interna.' })
      }

      const disciplinaQuery = e.request.url.query().get('disciplina')

      let catFiltro = 'ativo = true'
      if (disciplinaQuery) {
        catFiltro += " && disciplina = '" + disciplinaQuery.replace(/'/g, "''") + "'"
      }
      const catalogo = $app.findRecordsByFilter(
        'catalogo_servicos',
        catFiltro,
        'disciplina',
        200,
        0,
      )
      const refPorDisciplina = {}

      for (let c = 0; c < catalogo.length; c++) {
        const disc = catalogo[c].getString('disciplina')
        const pBase = catalogo[c].getFloat('preco_base') || 0
        if (!refPorDisciplina[disc]) {
          refPorDisciplina[disc] = {
            disciplina: disc,
            preco_catalogo_medio: 0,
            soma_catalogo: 0,
            count_catalogo: 0,
            pre_cotacao_media: 0,
            soma_precotacao: 0,
            count_precotacao: 0,
            custo_interno_medio_hora: 0,
            soma_custo_hora: 0,
            count_prestadores_internos: 0,
          }
        }
        if (pBase > 0) {
          refPorDisciplina[disc].soma_catalogo += pBase
          refPorDisciplina[disc].count_catalogo++
        }
      }

      let precotFiltro = "status = 'respondida' || status = 'convertida'"
      if (disciplinaQuery) {
        precotFiltro += " && disciplina = '" + disciplinaQuery.replace(/'/g, "''") + "'"
      }
      const precotacoes = $app.findRecordsByFilter('pre_cotacoes', precotFiltro, '', 200, 0)
      for (let p = 0; p < precotacoes.length; p++) {
        const disc = precotacoes[p].getString('disciplina')
        if (disc) {
          if (!refPorDisciplina[disc]) {
            refPorDisciplina[disc] = {
              disciplina: disc,
              preco_catalogo_medio: 0,
              soma_catalogo: 0,
              count_catalogo: 0,
              pre_cotacao_media: 0,
              soma_precotacao: 0,
              count_precotacao: 0,
              custo_interno_medio_hora: 0,
              soma_custo_hora: 0,
              count_prestadores_internos: 0,
            }
          }
          try {
            const resp = $app.findRecordsByFilter(
              'pre_cotacao_respostas',
              "pre_cotacao = '" + precotacoes[p].id + "' && preco_ofertado > 0",
              'preco_ofertado',
              1,
              0,
            )
            if (resp.length > 0) {
              const preco = resp[0].getFloat('preco_ofertado') || 0
              if (preco > 0) {
                refPorDisciplina[disc].soma_precotacao += preco
                refPorDisciplina[disc].count_precotacao++
              }
            }
          } catch (_) {}
        }
      }

      const prestadoresInternos = $app.findRecordsByFilter(
        'prestadores',
        "tipo = 'interno' && status = 'ativo' && custo_hora > 0",
        '',
        100,
        0,
      )

      for (let pi = 0; pi < prestadoresInternos.length; pi++) {
        const pInt = prestadoresInternos[pi]
        const cHora = pInt.getFloat('custo_hora') || 0
        const discStr = pInt.getString('disciplinas') || ''
        const arrDisc = discStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

        for (let d = 0; d < arrDisc.length; d++) {
          const disc = arrDisc[d]
          if (disciplinaQuery && disc !== disciplinaQuery) continue
          if (!refPorDisciplina[disc]) {
            refPorDisciplina[disc] = {
              disciplina: disc,
              preco_catalogo_medio: 0,
              soma_catalogo: 0,
              count_catalogo: 0,
              pre_cotacao_media: 0,
              soma_precotacao: 0,
              count_precotacao: 0,
              custo_interno_medio_hora: 0,
              soma_custo_hora: 0,
              count_prestadores_internos: 0,
            }
          }
          refPorDisciplina[disc].soma_custo_hora += cHora
          refPorDisciplina[disc].count_prestadores_internos++
        }
      }

      const lista = []
      const chaves = Object.keys(refPorDisciplina)
      for (let k = 0; k < chaves.length; k++) {
        const item = refPorDisciplina[chaves[k]]
        item.preco_catalogo_medio =
          item.count_catalogo > 0
            ? Math.round((item.soma_catalogo / item.count_catalogo) * 100) / 100
            : 0
        item.pre_cotacao_media =
          item.count_precotacao > 0
            ? Math.round((item.soma_precotacao / item.count_precotacao) * 100) / 100
            : 0
        item.custo_interno_medio_hora =
          item.count_prestadores_internos > 0
            ? Math.round((item.soma_custo_hora / item.count_prestadores_internos) * 100) / 100
            : 0

        const referenciaExterna =
          item.pre_cotacao_media > 0 ? item.pre_cotacao_media : item.preco_catalogo_medio

        const custoPacoteInternoPadrao40h =
          item.custo_interno_medio_hora > 0
            ? Math.round(item.custo_interno_medio_hora * 40 * 100) / 100
            : 0

        let recomendacao = 'indiferente'
        let economiaEstimadaPerc = 0

        if (referenciaExterna > 0 && custoPacoteInternoPadrao40h > 0) {
          if (custoPacoteInternoPadrao40h < referenciaExterna) {
            recomendacao = 'fazer_dentro'
            economiaEstimadaPerc =
              Math.round(
                ((referenciaExterna - custoPacoteInternoPadrao40h) / referenciaExterna) * 1000,
              ) / 10
          } else {
            recomendacao = 'fazer_fora'
            economiaEstimadaPerc =
              Math.round(
                ((custoPacoteInternoPadrao40h - referenciaExterna) / custoPacoteInternoPadrao40h) *
                  1000,
              ) / 10
          }
        } else if (item.count_prestadores_internos > 0 && referenciaExterna === 0) {
          recomendacao = 'fazer_dentro'
        } else if (referenciaExterna > 0 && item.count_prestadores_internos === 0) {
          recomendacao = 'fazer_fora'
        }

        lista.push({
          disciplina: item.disciplina,
          custo_interno_hora: item.custo_interno_medio_hora,
          custo_interno_padrao_40h: custoPacoteInternoPadrao40h,
          referencia_externa_valor: referenciaExterna,
          origem_referencia_externa:
            item.pre_cotacao_media > 0
              ? 'pre_cotacao'
              : item.preco_catalogo_medio > 0
                ? 'catalogo'
                : 'sem_referencia',
          recomendacao: recomendacao,
          economia_estimada_perc: economiaEstimadaPerc,
          prestadores_internos_disponiveis: item.count_prestadores_internos,
        })
      }

      lista.sort((a, b) => b.economia_estimada_perc - a.economia_estimada_perc)

      return e.json(200, {
        success: true,
        total_disciplinas: lista.length,
        indicadores: lista,
      })
    } catch (err) {
      console.log('Erro ao calcular indicador fazer dentro ou fora: ' + err)
      return e.json(500, { message: 'Erro ao calcular indicador: ' + err })
    }
  },
  $apis.requireAuth(),
)
