// -----------------------------------------------------------------------------
// G+ ENGENHARIA — RODADA 16: SCORECARDS (PARTE 1: BACKEND)
// Arquivo: pocketbase/hooks/scorecards_engine.js
// Observação de arquitetura do Skip Cloud: todas as funções auxiliares residem
// dentro dos respectivos callbacks para isolamento completo no JSVM pool.
// -----------------------------------------------------------------------------

// HOOK DE DISPARO DE RECÁLCULO POR EVENTO
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    const colName = rec.collection().name
    const orig = rec.original()

    function executarRecalculo(tipoEntidade, registroId, evento) {
      try {
        // Obter parâmetros ativos
        let paramsAtivos = null
        try {
          const pl = $app.findRecordsByFilter(
            'parametros_scorecards',
            "tipo_entidade = '" + tipoEntidade + "' && ativo = true",
            '-versao',
            1,
            0,
          )
          if (pl.length > 0) paramsAtivos = pl[0]
        } catch (_) {}

        const versaoPesos = paramsAtivos ? paramsAtivos.getInt('versao') : 1
        const pesos = (paramsAtivos && paramsAtivos.get('pesos_json')) || {}
        const metas = (paramsAtivos && paramsAtivos.get('metas_json')) || {}
        const minimoSuspensao = paramsAtivos
          ? paramsAtivos.getFloat('minimo_sugestao_suspensao') || 50
          : 50

        let prestadorEmail = ''
        let nomeEntidade = ''
        let composto = null
        let dadosInsuficientes = true
        let motivoInsuficiencia = 'Dados insuficientes'
        let totalTrabalhos = 0
        let tendencia = 'dados_insuficientes'
        const ultimos5 = []
        let metricasDetalhadas = {}

        // 1. Prestador Externo
        if (tipoEntidade === 'prestador_externo') {
          let pRec = null
          try {
            pRec = $app.findRecordById('prestadores', registroId)
          } catch (_) {}
          if (!pRec) return

          prestadorEmail = pRec.getString('email')
          nomeEntidade = pRec.getString('nome')

          const oss = $app.findRecordsByFilter(
            'ordens_servico',
            "prestador = '" + registroId + "' && (status = 'encerrada' || status = 'concluida')",
            '-data_conclusao',
            100,
            0,
          )
          const entregaveis = $app.findRecordsByFilter(
            'entregaveis',
            "prestador = '" + registroId + "'",
            '-created',
            100,
            0,
          )
          const cotacoes = $app.findRecordsByFilter(
            'cotacoes',
            "prestador = '" + registroId + "'",
            '-created',
            100,
            0,
          )

          totalTrabalhos = oss.length
          const temEntregavelAvaliado = entregaveis.some((ent) => {
            const st = ent.getString('status')
            return st === 'aprovado' || st === 'devolvido'
          })

          if (totalTrabalhos > 0 || temEntregavelAvaliado) {
            dadosInsuficientes = false
            motivoInsuficiencia = ''

            // Pontualidade
            let osPontuais = 0
            let osComPrazo = 0
            for (let i = 0; i < oss.length; i++) {
              const o = oss[i]
              const dtPrev = o.getString('data_previsao_fim')
              const dtFim = o.getString('data_conclusao') || o.getString('updated')
              if (dtPrev && dtFim) {
                osComPrazo++
                const diffDias = Math.floor(
                  (new Date(dtFim).getTime() - new Date(dtPrev).getTime()) / (1000 * 60 * 60 * 24),
                )
                if (diffDias <= 0) osPontuais++
                if (ultimos5.length < 5) {
                  ultimos5.push({
                    os_id: o.id,
                    numero: o.getString('numero'),
                    atraso_dias: Math.max(0, diffDias),
                    pontual: diffDias <= 0,
                    data: dtFim,
                  })
                }
              }
            }
            const pontualidade = osComPrazo > 0 ? Math.round((osPontuais / osComPrazo) * 100) : 100

            // Retrabalho (inclui entregáveis com devolução e issues de revisão apontadas)
            let comDevolucao = 0
            let totalIssuesPrestador = 0
            for (let j = 0; j < entregaveis.length; j++) {
              const ent = entregaveis[j]
              let teveRetrabalho = false
              if (ent.getInt('versao_atual') > 1 || ent.getString('status') === 'devolvido') {
                teveRetrabalho = true
              }

              try {
                const issuesEnt = $app.findRecordsByFilter(
                  'issues_revisao',
                  "entregavel = '" + ent.id + "'",
                  '',
                  100,
                  0,
                )
                if (issuesEnt.length > 0) {
                  totalIssuesPrestador += issuesEnt.length
                  teveRetrabalho = true
                }
              } catch (_) {}

              if (teveRetrabalho) {
                comDevolucao++
              }
            }
            const retrabalho =
              entregaveis.length > 0
                ? Math.max(0, Math.round((1 - comDevolucao / entregaveis.length) * 100))
                : 100

            // Qualidade
            const notaGeral = pRec.getFloat('nota_geral') || 0
            const qualidade =
              notaGeral > 0 ? Math.min(100, Math.round((notaGeral / 5.0) * 100)) : 80

            // Aderência preço
            const aderenciaPreco = 90

            // Responsividade
            let respondidas = 0
            for (let k = 0; k < cotacoes.length; k++) {
              const stC = cotacoes[k].getString('status')
              if (
                stC === 'respondida' ||
                stC === 'escolhida' ||
                cotacoes[k].getFloat('preco_ofertado') > 0
              ) {
                respondidas++
              }
            }
            const responsividade =
              cotacoes.length > 0 ? Math.round((respondidas / cotacoes.length) * 100) : 100

            // Conformidade
            const conformidade = (pRec.getBool('conselho_ativo') !== false ? 50 : 0) + 50

            // Pesos
            const pPont = pesos.pontualidade !== undefined ? pesos.pontualidade : 30
            const pRetr = pesos.retrabalho !== undefined ? pesos.retrabalho : 25
            const pQual = pesos.qualidade !== undefined ? pesos.qualidade : 20
            const pAder = pesos.aderencia_preco !== undefined ? pesos.aderencia_preco : 10
            const pResp = pesos.responsividade !== undefined ? pesos.responsividade : 10
            const pConf = pesos.conformidade !== undefined ? pesos.conformidade : 5
            const somaP = pPont + pRetr + pQual + pAder + pResp + pConf || 100

            const bruto =
              pontualidade * pPont +
              retrabalho * pRetr +
              qualidade * pQual +
              aderenciaPreco * pAder +
              responsividade * pResp +
              conformidade * pConf

            composto = Math.round((bruto / somaP) * 10) / 10

            if (ultimos5.length >= 2) {
              if (ultimos5[0].atraso_dias < ultimos5[1].atraso_dias) tendencia = 'melhorou'
              else if (ultimos5[0].atraso_dias > ultimos5[1].atraso_dias) tendencia = 'piorou'
              else tendencia = 'estavel'
            } else {
              tendencia = 'estavel'
            }

            metricasDetalhadas = {
              ext_pontualidade: pontualidade,
              ext_retrabalho: retrabalho,
              ext_qualidade: qualidade,
              ext_aderencia_preco: aderenciaPreco,
              ext_responsividade: responsividade,
              ext_conformidade: conformidade,
              total_os: oss.length,
              total_entregaveis: entregaveis.length,
              total_issues_revisao: totalIssuesPrestador,
            }
          }
        }

        // Salvar na coleção scorecards
        const scCol = $app.findCollectionByNameOrId('scorecards')
        const scExistentes = $app.findRecordsByFilter(
          'scorecards',
          "tipo_entidade = '" +
            tipoEntidade +
            "' && registro_id = '" +
            registroId +
            "' && is_snapshot != true",
          '-created',
          1,
          0,
        )

        const scRec = scExistentes.length > 0 ? scExistentes[0] : new Record(scCol)
        const valoresAntes =
          scExistentes.length > 0
            ? {
                indice_composto: scRec.getFloat('indice_composto'),
                tendencia: scRec.getString('tendencia_5_trabalhos'),
              }
            : null

        const sugereSuspensao =
          !dadosInsuficientes && composto !== null && composto < minimoSuspensao

        scRec.set('tipo_entidade', tipoEntidade)
        scRec.set('registro_id', registroId)
        if (prestadorEmail) scRec.set('prestador_email', prestadorEmail)
        if (nomeEntidade) scRec.set('nome_entidade', nomeEntidade)
        scRec.set('is_snapshot', false)
        scRec.set('versao_pesos', versaoPesos)
        scRec.set('data_calculo', new Date().toISOString())
        scRec.set('dados_insuficientes', dadosInsuficientes)
        scRec.set('motivo_insuficiencia', motivoInsuficiencia)
        scRec.set('total_trabalhos_janela', totalTrabalhos)
        scRec.set('indice_composto', composto)
        scRec.set('tendencia_5_trabalhos', tendencia)
        scRec.set('historico_ultimos_5', ultimos5)
        scRec.set('metricas_detalhadas', metricasDetalhadas)
        scRec.set('sugestao_suspensao', sugereSuspensao)

        if (tipoEntidade === 'prestador_externo' && !dadosInsuficientes) {
          scRec.set('ext_pontualidade', metricasDetalhadas.ext_pontualidade)
          scRec.set('ext_retrabalho', metricasDetalhadas.ext_retrabalho)
          scRec.set('ext_qualidade', metricasDetalhadas.ext_qualidade)
          scRec.set('ext_aderencia_preco', metricasDetalhadas.ext_aderencia_preco)
          scRec.set('ext_responsividade', metricasDetalhadas.ext_responsividade)
          scRec.set('ext_conformidade', metricasDetalhadas.ext_conformidade)
        }

        $app.save(scRec)

        // Snapshot mensal
        const mesRef = new Date().toISOString().substring(0, 7)
        try {
          const snapL = $app.findRecordsByFilter(
            'scorecards',
            "tipo_entidade = '" +
              tipoEntidade +
              "' && registro_id = '" +
              registroId +
              "' && is_snapshot = true && mes_referencia = '" +
              mesRef +
              "'",
            '',
            1,
            0,
          )
          const snapRec = snapL.length > 0 ? snapL[0] : new Record(scCol)
          snapRec.set('tipo_entidade', tipoEntidade)
          snapRec.set('registro_id', registroId)
          if (prestadorEmail) snapRec.set('prestador_email', prestadorEmail)
          if (nomeEntidade) snapRec.set('nome_entidade', nomeEntidade)
          snapRec.set('is_snapshot', true)
          snapRec.set('mes_referencia', mesRef)
          snapRec.set('versao_pesos', versaoPesos)
          snapRec.set('data_calculo', new Date().toISOString())
          snapRec.set('dados_insuficientes', dadosInsuficientes)
          snapRec.set('indice_composto', composto)
          snapRec.set('tendencia_5_trabalhos', tendencia)
          $app.save(snapRec)
        } catch (_) {}

        // Auditoria
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'SCORECARD_RECALCULADO')
          aRec.set('entidade', 'scorecards')
          aRec.set('registro_id', scRec.id)
          aRec.set('detalhes', {
            evento_disparador: evento,
            tipo_entidade: tipoEntidade,
            valores_antes: valoresAntes,
            valores_depois: { indice_composto: composto, tendencia: tendencia },
          })
          $app.save(aRec)
        } catch (_) {}
      } catch (errRecalc) {
        console.log('Erro ao executar recálculo de scorecard: ' + errRecalc)
      }
    }

    // 1. Ordem de Serviço Encerrada
    if (colName === 'ordens_servico') {
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''
      if ((stNovo === 'encerrada' || stNovo === 'concluida') && stAntigo !== stNovo) {
        const prestadorId = rec.getString('prestador')
        const tipoPrest = rec.getString('tipo_prestador') || 'externo'
        if (prestadorId) {
          const tipoEntidade = tipoPrest === 'interno' ? 'prestador_interno' : 'prestador_externo'
          executarRecalculo(tipoEntidade, prestadorId, 'OS_ENCERRADA')
        }
      }
    }

    // 2. Entregável aprovado ou devolvido
    if (colName === 'entregaveis') {
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''
      if ((stNovo === 'aprovado' || stNovo === 'devolvido') && stAntigo !== stNovo) {
        const prestadorId = rec.getString('prestador')
        if (prestadorId) {
          try {
            const p = $app.findRecordById('prestadores', prestadorId)
            const tipo =
              p.getString('tipo') === 'interno' ? 'prestador_interno' : 'prestador_externo'
            executarRecalculo(
              tipo,
              prestadorId,
              stNovo === 'aprovado' ? 'ENTREGAVEL_APROVADO' : 'ENTREGAVEL_DEVOLVIDO',
            )
          } catch (_) {}
        }
      }
    }

    // 2.1 Issues de Revisão criadas ou alteradas (Rodada 17: issues alimentam retrabalho do scorecard)
    if (colName === 'issues_revisao') {
      const entId = rec.getString('entregavel')
      if (entId) {
        try {
          const ent = $app.findRecordById('entregaveis', entId)
          if (ent) {
            const prestadorId = ent.getString('prestador')
            if (prestadorId) {
              const p = $app.findRecordById('prestadores', prestadorId)
              const tipo =
                p.getString('tipo') === 'interno' ? 'prestador_interno' : 'prestador_externo'
              executarRecalculo(tipo, prestadorId, 'ISSUE_REVISAO_ATUALIZADA')
            }
          }
        } catch (_) {}
      }
    }

    // 3. Cotação respondida
    if (colName === 'cotacoes') {
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''
      if (stNovo === 'respondida' && stAntigo !== stNovo) {
        const prestadorId = rec.getString('prestador')
        if (prestadorId) {
          executarRecalculo('prestador_externo', prestadorId, 'COTACAO_RESPONDIDA')
        }
      }
    }

    // 4. Resposta Pré-Cotação respondida
    if (colName === 'respostas_pre_cotacao') {
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''
      if (stNovo === 'respondida' && stAntigo !== stNovo) {
        const prestadorId = rec.getString('prestador')
        if (prestadorId) {
          executarRecalculo('prestador_externo', prestadorId, 'PRE_COTACAO_RESPONDIDA')
        }
      }
    }

    // 5. Conta liquidada / paga
    if (colName === 'contas') {
      const stNovo = rec.getString('status')
      const stAntigo = orig ? orig.getString('status') : ''
      if ((stNovo === 'paga' || stNovo === 'realizada') && stAntigo !== stNovo) {
        const empresaId = rec.getString('empresa')
        if (empresaId) {
          executarRecalculo('empresa_parceira', empresaId, 'CONTA_PAGA')
        }
      }
    }
  } catch (err) {
    console.log('Aviso no hook de eventos de scorecards: ' + err)
  } finally {
    e.next()
  }
})

// -----------------------------------------------------------------------------
// ENDPOINTS REST
// -----------------------------------------------------------------------------

// 1. GET /backend/v1/scorecards/entidade/{tipo}/{id}
routerAdd(
  'GET',
  '/backend/v1/scorecards/entidade/{tipo}/{id}',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) return e.json(401, { error: 'Autenticação necessária' })

      const tipo = e.request.pathValue('tipo')
      const id = e.request.pathValue('id')
      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')

      if (role === 'executor') {
        let pRec = null
        try {
          pRec = $app.findRecordById('prestadores', id)
        } catch (_) {}
        if (!pRec || pRec.getString('email') !== userEmail) {
          return e.json(403, { error: 'Acesso negado ao scorecard de outro prestador.' })
        }
      }

      let sc = null
      const scList = $app.findRecordsByFilter(
        'scorecards',
        "tipo_entidade = '" + tipo + "' && registro_id = '" + id + "' && is_snapshot != true",
        '-created',
        1,
        0,
      )
      if (scList.length > 0) sc = scList[0]

      const snapshots = $app.findRecordsByFilter(
        'scorecards',
        "tipo_entidade = '" + tipo + "' && registro_id = '" + id + "' && is_snapshot = true",
        '-mes_referencia',
        12,
        0,
      )

      return e.json(200, { scorecard: sc, snapshots: snapshots })
    } catch (err) {
      return e.json(500, { error: 'Erro ao consultar scorecard: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 2. GET /backend/v1/portal-prestador/meu-scorecard (Projeção do Prestador Autenticado)
routerAdd(
  'GET',
  '/backend/v1/portal-prestador/meu-scorecard',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) return e.json(401, { error: 'Autenticação necessária' })

      const userEmail = authUser.getString('email')
      const pList = $app.findRecordsByFilter(
        'prestadores',
        "email = '" + userEmail + "'",
        '-created',
        1,
        0,
      )
      if (pList.length === 0) {
        return e.json(404, {
          error: 'Cadastro de prestador não localizado para o e-mail autenticado.',
        })
      }

      const prestador = pList[0]
      const tipoEntidade =
        prestador.getString('tipo') === 'interno' ? 'prestador_interno' : 'prestador_externo'

      let sc = null
      const scList = $app.findRecordsByFilter(
        'scorecards',
        "registro_id = '" + prestador.id + "' && is_snapshot != true",
        '-created',
        1,
        0,
      )
      if (scList.length > 0) sc = scList[0]

      const snapshots = $app.findRecordsByFilter(
        'scorecards',
        "registro_id = '" + prestador.id + "' && is_snapshot = true",
        '-mes_referencia',
        12,
        0,
      )

      // RETORNAR APENAS ÍNDICES PRÓPRIOS, NADA DE CUSTO-HORA, SALÁRIO, OUTROS PRESTADORES
      return e.json(200, {
        prestador_id: prestador.id,
        prestador_nome: prestador.getString('nome'),
        tipo: tipoEntidade,
        scorecard: sc
          ? {
              id: sc.id,
              tipo_entidade: sc.getString('tipo_entidade'),
              indice_composto: sc.get('indice_composto'),
              tendencia_5_trabalhos: sc.getString('tendencia_5_trabalhos'),
              dados_insuficientes: sc.getBool('dados_insuficientes'),
              motivo_insuficiencia: sc.getString('motivo_insuficiencia'),
              total_trabalhos_janela: sc.getInt('total_trabalhos_janela'),
              ext_pontualidade: sc.get('ext_pontualidade'),
              ext_retrabalho: sc.get('ext_retrabalho'),
              ext_qualidade: sc.get('ext_qualidade'),
              ext_aderencia_preco: sc.get('ext_aderencia_preco'),
              ext_responsividade: sc.get('ext_responsividade'),
              ext_conformidade: sc.get('ext_conformidade'),
              int_lead_time: sc.get('int_lead_time'),
              int_ciclos_revisao: sc.get('int_ciclos_revisao'),
              int_horas_entregavel: sc.get('int_horas_entregavel'),
              int_ocupacao: sc.get('int_ocupacao'),
              int_pontualidade: sc.get('int_pontualidade'),
              data_calculo: sc.getString('data_calculo'),
            }
          : null,
        snapshots: snapshots.map((s) => ({
          mes_referencia: s.getString('mes_referencia'),
          indice_composto: s.get('indice_composto'),
          tendencia: s.getString('tendencia_5_trabalhos'),
          dados_insuficientes: s.getBool('dados_insuficientes'),
        })),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao consultar meu scorecard: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 3. POST /backend/v1/scorecards/parametros/nova-versao (Admin)
routerAdd(
  'POST',
  '/backend/v1/scorecards/parametros/nova-versao',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) return e.json(401, { error: 'Autenticação necessária' })

      const role = authUser.getString('role')
      if (role !== 'admin') {
        return e.json(403, { error: 'Apenas Administradores podem versionar parâmetros.' })
      }

      const body = reqInfo.body || {}
      const tipoEntidade = body.tipo_entidade
      const descricao = body.descricao || ''
      const pesosJson = body.pesos_json
      const metasJson = body.metas_json || {}
      const minimoSuspensao = body.minimo_sugestao_suspensao || 50

      if (!tipoEntidade || !pesosJson) {
        return e.json(400, { error: 'tipo_entidade e pesos_json são obrigatórios.' })
      }

      const anteriores = $app.findRecordsByFilter(
        'parametros_scorecards',
        "tipo_entidade = '" + tipoEntidade + "'",
        '-versao',
        1,
        0,
      )
      const versaoAtual = anteriores.length > 0 ? anteriores[0].getInt('versao') : 0
      const novaVersaoNum = versaoAtual + 1

      const ativas = $app.findRecordsByFilter(
        'parametros_scorecards',
        "tipo_entidade = '" + tipoEntidade + "' && ativo = true",
        '',
        50,
        0,
      )
      for (let i = 0; i < ativas.length; i++) {
        ativas[i].set('ativo', false)
        $app.save(ativas[i])
      }

      const col = $app.findCollectionByNameOrId('parametros_scorecards')
      const novoReg = new Record(col)
      novoReg.set('tipo_entidade', tipoEntidade)
      novoReg.set('versao', novaVersaoNum)
      novoReg.set(
        'descricao',
        descricao || 'Versão ' + novaVersaoNum + ' atualizada pelo Administrador',
      )
      novoReg.set('ativo', true)
      novoReg.set('pesos_json', pesosJson)
      novoReg.set('metas_json', metasJson)
      novoReg.set('minimo_sugestao_suspensao', minimoSuspensao)
      novoReg.set('autor_alteracao', authUser.id)
      novoReg.set('criado_em', new Date().toISOString())
      $app.save(novoReg)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('acao', 'NOVA_VERSAO_PARAMETROS_SCORECARD')
        aRec.set('entidade', 'parametros_scorecards')
        aRec.set('registro_id', novoReg.id)
        aRec.set('detalhes', {
          tipo_entidade: tipoEntidade,
          versao_anterior: versaoAtual,
          nova_versao: novaVersaoNum,
          novos_pesos: pesosJson,
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        mensagem: 'Nova versão ' + novaVersaoNum + ' criada com sucesso.',
        parametro: novoReg,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao criar nova versão: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 4. GET /backend/v1/scorecards/parametros/listar
routerAdd(
  'GET',
  '/backend/v1/scorecards/parametros/listar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) return e.json(401, { error: 'Autenticação necessária' })

      const lista = $app.findRecordsByFilter('parametros_scorecards', '', '-versao', 100, 0)
      return e.json(200, { parametros: lista })
    } catch (err) {
      return e.json(500, { error: 'Erro ao listar parâmetros: ' + err })
    }
  },
  $apis.requireAuth(),
)
