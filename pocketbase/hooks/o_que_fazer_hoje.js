// =========================================================================
// RODADA 10 — ENDPOINT CONSOLIDADO "O QUE FAZER HOJE"
// GET /backend/v1/funil/o-que-fazer-hoje
//
// Unifica em uma única chamada de backend:
// 1. Central de Ações do Dia (Toques da cadência para hoje / em atraso com status dinâmico calculado NA HORA)
// 2. Painel de Saúde do Funil (Empresas estagnadas, tempo na etapa, gargalos)
// 3. Sugestões de Nutrição Mensal (Leads em Toque 5 + carência sem resposta)
// 4. Propostas aguardando ação (Solicitação de alteração do cliente)
// 5. Alertas operacionais e contratuais (Prazos de entregáveis, cotações, conselhos de executores)
//
// Regras obrigatórias do usuário:
// - NENHUMA gravação de campos 'para_hoje' ou 'em_atraso' no banco (cálculo dinâmico em tempo de execução).
// - Respeita estritamente lista "Não contatar" e LGPD (empresas/e-mails bloqueados são filtrados ou sinalizados).
// - Responde por perfil do usuário logado (Admin, Comercial, Financeiro, Gestor).
// =========================================================================

routerAdd(
  'GET',
  '/backend/v1/funil/o-que-fazer-hoje',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária.' })
      }

      const role = reqInfo.auth.getString('role')
      const userId = reqInfo.auth.id

      // Somente perfis internos têm acesso ao resumo operacional
      if (role !== 'admin' && role !== 'comercial' && role !== 'financeiro' && role !== 'gestor') {
        return e.json(403, {
          message: 'Acesso restrito à equipe interna da G+.',
        })
      }

      const hoje = new Date()
      const hojeIso = hoje.toISOString()
      const hojeStr = hojeIso.substring(0, 10)
      const hojeDate = new Date(hojeStr + 'T00:00:00')

      // 1. Carregar lista "Não contatar" para conformidade LGPD
      const naoContatarRecords = $app.findRecordsByFilter('nao_contatar', '', '', 5000, 0)
      const emailsNaoContatar = {}
      const empresasNaoContatar = {}
      for (let i = 0; i < naoContatarRecords.length; i++) {
        const nc = naoContatarRecords[i]
        const em = (nc.getString('email') || '').trim().toLowerCase()
        const empId = nc.getString('empresa')
        if (em) emailsNaoContatar[em] = true
        if (empId) empresasNaoContatar[empId] = true
      }

      // 2. Parâmetros de tolerância
      let diasLimiteAtrasoToque = 5
      try {
        const pLim = $app.findFirstRecordByData('parametros', 'chave', 'dias_limite_atraso_toque')
        if (pLim) {
          const v = parseInt(pLim.getString('valor'), 10)
          if (!isNaN(v) && v > 0) diasLimiteAtrasoToque = v
        }
      } catch (_) {}

      let diasEstagnacaoLimite = 15
      try {
        const pEst = $app.findFirstRecordByData('parametros', 'chave', 'funil_estagnacao_dias')
        if (pEst) {
          const v = parseInt(pEst.getString('valor'), 10)
          if (!isNaN(v) && v > 0) diasEstagnacaoLimite = v
        }
      } catch (_) {}

      let carenciaDiasNutricao = 15
      try {
        const pCar = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'cadencia_dias_carencia_nutricao',
        )
        if (pCar) {
          const v = parseInt(pCar.getString('valor'), 10)
          if (!isNaN(v) && v > 0) carenciaDiasNutricao = v
        }
      } catch (_) {}

      // Mapeamento 9 -> 5 colunas
      const mapa9para5 = {
        identificada: 'identificada',
        qualificada: 'qualificada',
        em_cadencia: 'qualificada',
        com_proposta_elaborada: 'em_proposta',
        proposta_enviada: 'em_proposta',
        em_conversa: 'negociacao',
        parceira: 'ganha_perdida',
        nutricao_mensal: 'ganha_perdida',
        inativa: 'ganha_perdida',
      }
      try {
        const pMap = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'funil_correspondencia_5_colunas',
        )
        if (pMap) {
          const pVal = pMap.getString('valor')
          if (pVal) Object.assign(mapa9para5, JSON.parse(pVal))
        }
      } catch (_) {}

      // 3. Carregar Empresas ativas
      const empresas = $app.findRecordsByFilter('empresas', "status = 'ativa'", '-created', 3000, 0)
      const empresasMap = {}
      for (let i = 0; i < empresas.length; i++) {
        empresasMap[empresas[i].id] = empresas[i]
      }

      // -----------------------------------------------------------------------
      // BLOCO 1: CADÊNCIA / AÇÕES DO DIA (CÁLCULO DINÂMICO SEM GRAVAÇÃO)
      // -----------------------------------------------------------------------
      const toquesAtivos = $app.findRecordsByFilter(
        'toques',
        "status != 'cancelado' && status != 'realizado' && status != 'respondido'",
        'numero_toque',
        5000,
        0,
      )

      // Buscar todos os toques dessas empresas para checar se anterior foi confirmado
      const toquesTodasEmpresas = $app.findRecordsByFilter('toques', '', 'numero_toque', 10000, 0)
      const toquesPorEmpresa = {}
      for (let i = 0; i < toquesTodasEmpresas.length; i++) {
        const t = toquesTodasEmpresas[i]
        const eId = t.getString('empresa')
        if (!eId) continue
        if (!toquesPorEmpresa[eId]) toquesPorEmpresa[eId] = []
        toquesPorEmpresa[eId].push(t)
      }

      const acoesDoDia = []
      let totalToquesAtrasados = 0
      let totalToquesParaHoje = 0
      let totalToquesCriticos = 0

      for (let i = 0; i < toquesAtivos.length; i++) {
        const t = toquesAtivos[i]
        const empId = t.getString('empresa')
        const emp = empresasMap[empId]
        if (!emp) continue

        // Se a empresa está na lista "Não contatar", respeitar LGPD e pular contato proativo
        if (empresasNaoContatar[empId]) continue
        const empEmail = (emp.getString('email') || '').trim().toLowerCase()
        if (empEmail && emailsNaoContatar[empEmail]) continue

        // Verificar toques da mesma empresa para determinar se anterior foi confirmado
        const listaEmp = toquesPorEmpresa[empId] || []
        const numToque = t.getInt('numero_toque') || 1
        let anteriorConfirmado = true
        if (numToque > 1) {
          const anterior = listaEmp.find((item) => item.getInt('numero_toque') === numToque - 1)
          if (anterior) {
            const stAnt = anterior.getString('status')
            anteriorConfirmado = stAnt === 'realizado' || stAnt === 'respondido'
          }
        }

        if (!anteriorConfirmado) {
          // Bloqueado aguardando o toque anterior
          continue
        }

        // Cálculo dinâmico do status do toque (NÃO GRAVA NO BANCO)
        const prevStr = (t.getString('data_prevista') || hojeStr).substring(0, 10)
        const prevDate = new Date(prevStr + 'T00:00:00')
        const diffMs = hojeDate.getTime() - prevDate.getTime()
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        let statusDinamico = 'agendado'
        let diasAtraso = 0
        let isCritico = false

        if (diffDias === 0) {
          statusDinamico = 'para_hoje'
          totalToquesParaHoje++
        } else if (diffDias > 0) {
          statusDinamico = 'em_atraso'
          diasAtraso = diffDias
          totalToquesAtrasados++
          if (diffDias >= diasLimiteAtrasoToque) {
            isCritico = true
            totalToquesCriticos++
          }
        }

        // Apenas 'para_hoje' e 'em_atraso' compõem o que fazer hoje
        if (statusDinamico === 'para_hoje' || statusDinamico === 'em_atraso') {
          const etapaEmpresa = emp.getString('etapa_funil') || 'identificada'
          acoesDoDia.push({
            id: t.id,
            empresa_id: emp.id,
            empresa_nome: emp.getString('nome_fantasia') || emp.getString('razao_social'),
            cnpj: emp.getString('cnpj'),
            curva: emp.getString('curva') || 'C',
            etapa_funil_atual: etapaEmpresa,
            coluna_5: mapa9para5[etapaEmpresa] || 'identificada',
            is_parceira: emp.getBool('is_parceira') || etapaEmpresa === 'parceira',
            numero_toque: numToque,
            canal: t.getString('canal') || 'email',
            data_prevista: t.getString('data_prevista'),
            status_calculado: statusDinamico,
            dias_atraso: diasAtraso,
            is_critico: isCritico,
            observacao: t.getString('observacao') || '',
          })
        }
      }

      // Ordenação das Ações do Dia: Curva A -> B -> C, maior atraso primeiro
      const pesoCurva = (c) => (c === 'A' ? 1 : c === 'B' ? 2 : 3)
      acoesDoDia.sort((a, b) => {
        const diffC = pesoCurva(a.curva) - pesoCurva(b.curva)
        if (diffC !== 0) return diffC
        if (b.dias_atraso !== a.dias_atraso) return b.dias_atraso - a.dias_atraso
        return (a.data_prevista || '').localeCompare(b.data_prevista || '')
      })

      // -----------------------------------------------------------------------
      // BLOCO 2: SUGESTÕES DE NUTRIÇÃO (Toque 5 sem resposta + carência)
      // -----------------------------------------------------------------------
      const sugestoesNutricao = []
      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        if (emp.getString('etapa_funil') !== 'em_cadencia') continue

        const lista = toquesPorEmpresa[emp.id] || []
        const toque5 = lista.find((item) => item.getInt('numero_toque') === 5)
        if (!toque5) continue

        const st5 = toque5.getString('status')
        if (st5 === 'respondido' || st5 === 'cancelado') continue

        const dtPrev5Str = (toque5.getString('data_prevista') || hojeStr).substring(0, 10)
        const dtPrev5 = new Date(dtPrev5Str + 'T00:00:00')
        const diffDias5 = Math.floor(
          (hojeDate.getTime() - dtPrev5.getTime()) / (1000 * 60 * 60 * 24),
        )

        if (diffDias5 >= carenciaDiasNutricao) {
          const empEmail = (emp.getString('email') || '').trim().toLowerCase()
          const isBloqueadoNc = !!(
            empresasNaoContatar[emp.id] ||
            (empEmail && emailsNaoContatar[empEmail])
          )

          sugestoesNutricao.push({
            empresa_id: emp.id,
            empresa_nome: emp.getString('nome_fantasia') || emp.getString('razao_social'),
            cnpj: emp.getString('cnpj'),
            curva: emp.getString('curva') || 'C',
            toque5_id: toque5.id,
            dias_decorridos_toque5: diffDias5,
            carencia_limite_dias: carenciaDiasNutricao,
            bloqueada_nao_contatar: isBloqueadoNc,
            sugerida_para_nutricao: !isBloqueadoNc,
          })
        }
      }

      // -----------------------------------------------------------------------
      // BLOCO 3: SAÚDE DO FUNIL / EMPRESAS ESTAGNADAS (≥ X dias sem avanço)
      // -----------------------------------------------------------------------
      const empresasEstagnadas = []
      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        const etapa = emp.getString('etapa_funil') || 'identificada'

        // Não alertar estagnação em etapas finais
        if (etapa === 'parceira' || etapa === 'inativa' || etapa === 'nutricao_mensal') {
          continue
        }

        const dtAtualizacao = new Date(emp.getString('updated') || emp.getString('created'))
        const diffDiasEst = Math.max(
          0,
          Math.floor((hojeDate.getTime() - dtAtualizacao.getTime()) / (1000 * 60 * 60 * 24)),
        )

        if (diffDiasEst >= diasEstagnacaoLimite) {
          empresasEstagnadas.push({
            empresa_id: emp.id,
            empresa_nome: emp.getString('nome_fantasia') || emp.getString('razao_social'),
            cnpj: emp.getString('cnpj'),
            curva: emp.getString('curva') || 'C',
            etapa_funil: etapa,
            coluna_5: mapa9para5[etapa] || 'identificada',
            is_parceira: emp.getBool('is_parceira'),
            dias_estagnada: diffDiasEst,
            limite_dias: diasEstagnacaoLimite,
            proxima_acao_data: emp.getString('proxima_acao_data'),
            proxima_acao_desc: emp.getString('proxima_acao_desc'),
            alerta: diffDiasEst >= diasEstagnacaoLimite * 2 ? 'critico' : 'atencao',
          })
        }
      }
      empresasEstagnadas.sort((a, b) => b.dias_estagnada - a.dias_estagnada)

      // -----------------------------------------------------------------------
      // BLOCO 4: PROPOSTAS PENDENTES DE AÇÃO (Solicitada alteração / Aguardando aprovação)
      // -----------------------------------------------------------------------
      const propostasAtencao = []
      if (role === 'admin' || role === 'comercial') {
        const props = $app.findRecordsByFilter(
          'propostas',
          "status = 'solicitada_alteracao' || status = 'em_elaboracao'",
          '-updated',
          100,
          0,
        )
        for (let i = 0; i < props.length; i++) {
          const pr = props[i]
          const eId = pr.getString('empresa')
          const emp = empresasMap[eId]
          propostasAtencao.push({
            id: pr.id,
            codigo: pr.getString('codigo'),
            status: pr.getString('status'),
            empresa_id: eId,
            empresa_nome: emp
              ? emp.getString('nome_fantasia') || emp.getString('razao_social')
              : '',
            preco: pr.getFloat('preco') || 0,
            motivo: pr.getString('observacoes') || 'Ação necessária na proposta',
          })
        }
      }

      // -----------------------------------------------------------------------
      // BLOCO 5: ENTREGÁVEIS E PRAZOS (Gestor / Admin)
      // -----------------------------------------------------------------------
      const entregaveisAtrasados = []
      if (role === 'admin' || role === 'gestor') {
        try {
          const ents = $app.findRecordsByFilter(
            'entregaveis',
            "status != 'aprovado' && prazo != '' && prazo < '" + hojeIso + "'",
            'prazo',
            50,
            0,
          )
          for (let i = 0; i < ents.length; i++) {
            const en = ents[i]
            entregaveisAtrasados.push({
              id: en.id,
              nome: en.getString('nome'),
              status: en.getString('status'),
              prazo: en.getString('prazo'),
              projeto_id: en.getString('projeto'),
              etapa_id: en.getString('etapa'),
            })
          }
        } catch (_) {}
      }

      // -----------------------------------------------------------------------
      // RODADA 13: ALERTA DE ITENS DE PROPOSTA SEM COTAÇÃO / SEM ELEGÍVEIS
      // -----------------------------------------------------------------------
      const itensSemCotacaoAcoes = []
      if (role === 'admin' || role === 'gestor' || role === 'comercial') {
        try {
          const itensSemCot = $app.findRecordsByFilter(
            'proposta_itens',
            "origem_custo = 'sem_cotacao'",
            '-created',
            20,
            0,
          )
          for (let sc = 0; sc < itensSemCot.length; sc++) {
            const itSc = itensSemCot[sc]
            const propId = itSc.getString('proposta')
            let propNum = 'Proposta'
            if (propId) {
              try {
                const pr = $app.findRecordById('propostas', propId)
                if (pr) propNum = pr.getString('numero')
              } catch (_) {}
            }
            const discSc = itSc.getString('disciplina') || 'Geral'
            const descSc = itSc.getString('descricao') || 'Item técnico'

            // Link de recrutamento correspondente
            let linkRecrutamento = '/recrutamento/geral'
            try {
              const linksR = $app.findRecordsByFilter(
                'links_recrutamento',
                "ativo = true && (disciplina_alvo ~ '" + discSc + "' || disciplina_alvo = 'Geral')",
                '-created',
                1,
                0,
              )
              if (linksR.length > 0) {
                linkRecrutamento = '/recrutamento/' + linksR[0].getString('slug')
              }
            } catch (_) {}

            const acaoSemCot = {
              tipo: 'recrutamento_necessario',
              prioridade: 'alta',
              titulo: 'Recrutamento Sugerido: ' + discSc + ' (' + propNum + ')',
              descricao:
                'O item "' +
                descSc +
                '" está sem prestadores elegíveis. Custo fixado pelo catálogo. Abra recrutamento para compor o banco de prestadores.',
              item_id: itSc.id,
              proposta_id: propId,
              disciplina: discSc,
              link_recrutamento: linkRecrutamento,
              acao_sugerida: 'Compartilhar link de recrutamento ' + linkRecrutamento,
            }
            itensSemCotacaoAcoes.push(acaoSemCot)
            acoesDoDia.push(acaoSemCot)
          }
        } catch (_) {}
      }

      // -----------------------------------------------------------------------
      // RODADA 16: ALERTAS DE SCORECARDS NA CENTRAL DE AÇÕES
      // 1. Queda de 15 pontos ou mais no composto em 60 dias
      // 2. Atraso médio de pagamento do parceiro acima da meta
      // 3. Ocupação do prestador interno acima de 100%
      // 4. Sugestão de suspensão do prestador quando composto abaixo do mínimo (APENAS sugestão)
      // -----------------------------------------------------------------------
      const alertasScorecardsAcoes = []
      if (role === 'admin' || role === 'gestor' || role === 'financeiro') {
        try {
          const scorecardsAtivos = $app.findRecordsByFilter(
            'scorecards',
            'is_snapshot != true',
            '-data_calculo',
            100,
            0,
          )

          for (let scIdx = 0; scIdx < scorecardsAtivos.length; scIdx++) {
            const sc = scorecardsAtivos[scIdx]
            const tipoEnt = sc.getString('tipo_entidade')
            const regId = sc.getString('registro_id')
            const nomeEnt = sc.getString('nome_entidade') || 'Entidade'
            const compostoAtual = sc.get('indice_composto')
            const dadosInsuf = sc.getBool('dados_insuficientes')

            if (dadosInsuf || compostoAtual === null || compostoAtual === undefined) {
              continue
            }

            // Alerta 4: Sugestão de suspensão de prestador (quando flag ativo)
            if (sc.getBool('sugestao_suspensao')) {
              const acaoSusp = {
                tipo: 'sugestao_suspensao_scorecard',
                prioridade: 'alta',
                titulo: 'Sugestão de Suspensão Técnica: ' + nomeEnt,
                descricao:
                  'O prestador está com índice composto de ' +
                  compostoAtual +
                  '/100, abaixo do mínimo configurado. Avalie suspensão preventiva da convocação (nunca aplicada automaticamente).',
                scorecard_id: sc.id,
                registro_id: regId,
                tipo_entidade: tipoEnt,
                indice_composto: compostoAtual,
                acao_sugerida: 'Revisar ficha de scorecard e histórico de entregas',
              }
              alertasScorecardsAcoes.push(acaoSusp)
              acoesDoDia.push(acaoSusp)
            }

            // Alerta 1: Queda de 15 pontos ou mais em relação a snapshot de até 60 dias
            try {
              const snapsAnteriores = $app.findRecordsByFilter(
                'scorecards',
                "is_snapshot = true && registro_id = '" + regId + "'",
                '-mes_referencia',
                3,
                0,
              )
              if (snapsAnteriores.length > 0) {
                const snapAnt = snapsAnteriores[0]
                const compAnt = snapAnt.get('indice_composto')
                if (compAnt !== null && compAnt !== undefined) {
                  const queda = Number(compAnt) - Number(compostoAtual)
                  if (queda >= 15) {
                    const acaoQueda = {
                      tipo: 'queda_brusca_scorecard',
                      prioridade: 'alta',
                      titulo:
                        'Queda Brusca de Desempenho: ' +
                        nomeEnt +
                        ' (-' +
                        Math.round(queda) +
                        ' pts)',
                      descricao:
                        'O índice composto caiu de ' +
                        compAnt +
                        ' para ' +
                        compostoAtual +
                        ' nos últimos 60 dias. Verifique retrabalhos ou atrasos recentes.',
                      scorecard_id: sc.id,
                      registro_id: regId,
                      tipo_entidade: tipoEnt,
                      queda_pontos: Math.round(queda),
                      acao_sugerida: 'Consultar ficha de scorecard e planejar alinhamento técnico',
                    }
                    alertasScorecardsAcoes.push(acaoQueda)
                    acoesDoDia.push(acaoQueda)
                  }
                }
              }
            } catch (_) {}

            // Alerta 2: Parceiro com atraso de pagamento acima da meta
            if (tipoEnt === 'empresa_parceira') {
              const metricas = sc.get('metricas_detalhadas') || {}
              const mediaAtraso = metricas.media_dias_atraso_pagamento || 0
              if (mediaAtraso > 30) {
                const acaoAtrasoParceiro = {
                  tipo: 'atraso_pagamento_parceiro',
                  prioridade: 'media',
                  titulo: 'Atraso Médio de Pagamento: ' + nomeEnt + ' (' + mediaAtraso + ' dias)',
                  descricao:
                    'A empresa parceira apresenta atraso médio de pagamento de marcos contratuais superior à meta de 30 dias.',
                  scorecard_id: sc.id,
                  registro_id: regId,
                  tipo_entidade: tipoEnt,
                  media_dias_atraso: mediaAtraso,
                  acao_sugerida: 'Alinhar fluxo financeiro com o gestor de contas do parceiro',
                }
                alertasScorecardsAcoes.push(acaoAtrasoParceiro)
                acoesDoDia.push(acaoAtrasoParceiro)
              }
            }

            // Alerta 3: Prestador interno com ocupação acima de 100%
            if (tipoEnt === 'prestador_interno') {
              const ocupacao = sc.get('int_ocupacao')
              if (ocupacao !== null && ocupacao > 100) {
                const acaoSobrecarga = {
                  tipo: 'sobrecarga_prestador_interno',
                  prioridade: 'media',
                  titulo: 'Sobrecarga de Equipe Interna: ' + nomeEnt + ' (' + ocupacao + '%)',
                  descricao:
                    'A carga de trabalho do profissional interno ultrapassou 100% da capacidade mensal programada.',
                  scorecard_id: sc.id,
                  registro_id: regId,
                  tipo_entidade: tipoEnt,
                  ocupacao_percentual: ocupacao,
                  acao_sugerida: 'Redistribuir OSs internas ou avaliar subcontratação externa',
                }
                alertasScorecardsAcoes.push(acaoSobrecarga)
                acoesDoDia.push(acaoSobrecarga)
              }
            }
          }
        } catch (eScAlert) {
          console.log('Aviso ao gerar alertas de scorecards no o-que-fazer-hoje: ' + eScAlert)
        }
      }

      // -----------------------------------------------------------------------
      // TOTALIZADOR CONSOLIDADO POR PERFIL
      // -----------------------------------------------------------------------
      return e.json(200, {
        success: true,
        perfil: role,
        usuario_id: userId,
        data_referencia: hojeIso,
        regras: {
          calculado_em_tempo_real: true,
          gravacao_para_hoje_em_atraso_desabilitada: true,
          conformidade_lgpd_nao_contatar: true,
          dias_limite_atraso_toque: diasLimiteAtrasoToque,
          dias_estagnacao_limite: diasEstagnacaoLimite,
          dias_carencia_nutricao: carenciaDiasNutricao,
        },
        resumo_geral: {
          total_acoes_hoje: acoesDoDia.length,
          toques_para_hoje: totalToquesParaHoje,
          toques_em_atraso: totalToquesAtrasados,
          toques_criticos: totalToquesCriticos,
          sugestoes_nutricao: sugestoesNutricao.length,
          empresas_estagnadas: empresasEstagnadas.length,
          propostas_pendentes: propostasAtencao.length,
          entregaveis_atrasados: entregaveisAtrasados.length,
          recrutamentos_necessarios: itensSemCotacaoAcoes.length,
        },
        acoes_do_dia: acoesDoDia,
        sugestoes_nutricao: sugestoesNutricao,
        empresas_estagnadas: empresasEstagnadas,
        propostas_pendentes: propostasAtencao,
        entregaveis_atrasados: entregaveisAtrasados,
        itens_sem_cotacao: itensSemCotacaoAcoes,
      })
    } catch (err) {
      console.log('Erro no endpoint unificado o-que-fazer-hoje: ' + err)
      return e.json(500, {
        message: 'Erro interno ao consolidar ações do dia: ' + err,
      })
    }
  },
  $apis.requireAuth(),
)
