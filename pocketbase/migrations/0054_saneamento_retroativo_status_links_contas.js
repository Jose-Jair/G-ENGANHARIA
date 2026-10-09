/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    const contasCol = app.findCollectionByNameOrId('contas')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const gruposCol = app.findCollectionByNameOrId('grupos_projetos')
    const subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    const contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')

    // =========================================================================
    // 1. NORMALIZAÇÃO E CONVERSÃO DO CAMPO STATUS DE PROJETOS EM SELECT FECHADO
    // =========================================================================
    // Normalizar valores existentes para snake_case canônico
    // Ex: "Em Contratação" -> "contratacao"
    app
      .db()
      .newQuery(`
      UPDATE projetos
      SET status = 'contratacao'
      WHERE status = 'Em Contratação' OR status = 'em_contratacao'
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE projetos
      SET status = 'aguardando_definicao'
      WHERE status = 'aguardando_definicao_execucao'
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE projetos
      SET status = 'em_andamento'
      WHERE status IS NULL OR status = ''
    `)
      .execute()

    // Atualizar o campo status de Text para SelectField fechado
    // Valores canônicos: aguardando_definicao, contratacao, em_andamento, concluido, cancelado, pausado
    const statusField = projetosCol.fields.getByName('status')
    if (statusField) {
      projetosCol.fields.removeByName('status')
    }
    projetosCol.fields.add(
      new SelectField({
        name: 'status',
        values: [
          'aguardando_definicao',
          'contratacao',
          'em_andamento',
          'concluido',
          'cancelado',
          'pausado',
        ],
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(projetosCol)

    // =========================================================================
    // 2. CRIAÇÃO RETROATIVA DE GRUPOS DE PROJETOS (GPR) E VÍNCULO AOS PROJETOS
    // =========================================================================
    // Garante que existam GPR-2026-0001, GPR-2026-0002 e GPR-2026-0003 vinculados
    // a CTR-2026-0001, CTR-2026-0002 e CTR-2026-0003 / propostas correspondentes
    const mapGrupos = [
      {
        codigoGpr: 'GPR-2026-0001',
        contratoNumero: 'CTR-2026-0001',
        propostaNumero: 'PROP-2026-0001',
        prjCodigo: 'PRJ-2026-0001',
        nome: 'Grupo: CTR-2026-0001 — José Jair Olievira Alves',
        descricao: 'Grupo consolidado para o contrato CTR-2026-0001 (Saneamento Migração 0054)',
        valorTotal: 5000,
        statusGrupo: 'em_contratacao',
        modoExecucaoPrj: 'terceirizada_integral',
        statusPrj: 'contratacao',
      },
      {
        codigoGpr: 'GPR-2026-0002',
        contratoNumero: 'CTR-2026-0002',
        propostaNumero: 'PROP-2026-0002',
        prjCodigo: 'PRJ-2026-0002',
        nome: 'Grupo: CTR-2026-0002 — José Jair Olievira Alves',
        descricao: 'Grupo consolidado para o contrato CTR-2026-0002 (Saneamento Migração 0054)',
        valorTotal: 23.1,
        statusGrupo: 'ativo',
        modoExecucaoPrj: 'direta',
        statusPrj: 'aguardando_definicao',
      },
      {
        codigoGpr: 'GPR-2026-0003',
        contratoNumero: 'CTR-2026-0003',
        propostaNumero: 'PROP-2026-0003',
        prjCodigo: 'PRJ-2026-0003',
        nome: 'Grupo: CTR-2026-0003 — Beatriz da Conceição de Lima',
        descricao: 'Grupo consolidado para o contrato CTR-2026-0003 (Saneamento Migração 0054)',
        valorTotal: 34206.15,
        statusGrupo: 'ativo',
        modoExecucaoPrj: 'terceirizada_integral',
        statusPrj: 'em_andamento',
      },
    ]

    const gruposCriadosOuEncontrados = {}

    for (let i = 0; i < mapGrupos.length; i++) {
      const cfg = mapGrupos[i]

      // Buscar contrato de serviço
      let csRec = null
      try {
        const csList = app.findRecordsByFilter(
          'contratos_servico',
          "numero = '" + cfg.contratoNumero + "'",
          '-created',
          1,
          0,
        )
        if (csList.length > 0) csRec = csList[0]
      } catch (_) {}

      // Buscar proposta
      let propRec = null
      try {
        const propList = app.findRecordsByFilter(
          'propostas',
          "numero = '" + cfg.propostaNumero + "'",
          '-created',
          1,
          0,
        )
        if (propList.length > 0) propRec = propList[0]
      } catch (_) {}

      // Buscar projeto
      let prjRec = null
      try {
        const prjList = app.findRecordsByFilter(
          'projetos',
          "codigo = '" + cfg.prjCodigo + "'",
          '-created',
          1,
          0,
        )
        if (prjList.length > 0) prjRec = prjList[0]
      } catch (_) {}

      // Verificar ou criar Grupo de Projetos (idempotente)
      let grupoRec = null
      try {
        const grpList = app.findRecordsByFilter(
          'grupos_projetos',
          "codigo = '" + cfg.codigoGpr + "'",
          '-created',
          1,
          0,
        )
        if (grpList.length > 0) {
          grupoRec = grpList[0]
        }
      } catch (_) {}

      if (!grupoRec) {
        grupoRec = new Record(gruposCol)
        grupoRec.set('codigo', cfg.codigoGpr)
        grupoRec.set('nome', cfg.nome)
        grupoRec.set('descricao', cfg.descricao)
        if (csRec) grupoRec.set('contrato_servico', csRec.id)
        if (propRec) grupoRec.set('proposta', propRec.id)
        if (csRec && csRec.getString('empresa')) grupoRec.set('empresa', csRec.getString('empresa'))
        else if (propRec && propRec.getString('empresa'))
          grupoRec.set('empresa', propRec.getString('empresa'))
        if (csRec && csRec.getString('cliente_pf'))
          grupoRec.set('cliente_pf', csRec.getString('cliente_pf'))
        else if (propRec && propRec.getString('cliente_pf'))
          grupoRec.set('cliente_pf', propRec.getString('cliente_pf'))
        grupoRec.set('status', cfg.statusGrupo)
        grupoRec.set('valor_total', cfg.valorTotal)
        app.save(grupoRec)

        try {
          const aRec = new Record(auditCol)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'SANEAMENTO_CRIACAO_GRUPO_PROJETO')
          aRec.set('entidade', 'grupos_projetos')
          aRec.set('registro_id', grupoRec.id)
          aRec.set('detalhes', {
            mensagem:
              'Grupo ' + cfg.codigoGpr + ' criado na migração 0054 (saneamento de dados de teste)',
            codigo: cfg.codigoGpr,
            contrato: cfg.contratoNumero,
            valor: cfg.valorTotal,
          })
          app.save(aRec)
        } catch (_) {}
      } else {
        // Atualizar se faltava vínculo
        let precisaSalvar = false
        if (csRec && !grupoRec.getString('contrato_servico')) {
          grupoRec.set('contrato_servico', csRec.id)
          precisaSalvar = true
        }
        if (propRec && !grupoRec.getString('proposta')) {
          grupoRec.set('proposta', propRec.id)
          precisaSalvar = true
        }
        if (grupoRec.getFloat('valor_total') !== cfg.valorTotal) {
          grupoRec.set('valor_total', cfg.valorTotal)
          precisaSalvar = true
        }
        if (precisaSalvar) {
          app.save(grupoRec)
        }
      }

      gruposCriadosOuEncontrados[cfg.codigoGpr] = grupoRec

      // Atualizar Projeto com grupo, valor corrigido e vínculos recíprocos
      if (prjRec) {
        prjRec.set('grupo', grupoRec.id)
        prjRec.set('valor_total', cfg.valorTotal)
        prjRec.set('status', cfg.statusPrj)
        if (cfg.modoExecucaoPrj && !prjRec.getString('modo_execucao')) {
          prjRec.set('modo_execucao', cfg.modoExecucaoPrj)
        }
        if (csRec && !prjRec.getString('contrato_servico')) {
          prjRec.set('contrato_servico', csRec.id)
        }
        if (propRec && !prjRec.getString('proposta')) {
          prjRec.set('proposta', propRec.id)
        }
        if (csRec && csRec.getString('cliente_pf') && !prjRec.getString('cliente_pf')) {
          prjRec.set('cliente_pf', csRec.getString('cliente_pf'))
        }
        if (csRec && csRec.getString('empresa') && !prjRec.getString('empresa')) {
          prjRec.set('empresa', csRec.getString('empresa'))
        }
        app.save(prjRec)
      }

      // Vínculo recíproco no Contrato de Serviço (projeto -> prjRec.id)
      if (csRec && prjRec) {
        if (csRec.getString('projeto') !== prjRec.id) {
          csRec.set('projeto', prjRec.id)
          app.save(csRec)
        }
      }
    }

    // =========================================================================
    // 3. RASTREABILIDADE DOS SUBCONTRATOS: SUB -> PRJ -> GPR -> CTR
    // =========================================================================
    // SUB-2026-0001 pertence ao PRJ-2026-0001 / GPR-2026-0001 / CTR-2026-0001
    // SUB-2026-0002 pertence ao PRJ-2026-0003 / GPR-2026-0003 / CTR-2026-0003
    const mapSubs = [
      {
        subNumero: 'SUB-2026-0001',
        prjCodigo: 'PRJ-2026-0001',
        codigoGpr: 'GPR-2026-0001',
        contratoNumero: 'CTR-2026-0001',
        cotacaoTokenOuId: 'nih2nqt3h1anp2k',
      },
      {
        subNumero: 'SUB-2026-0002',
        prjCodigo: 'PRJ-2026-0003',
        codigoGpr: 'GPR-2026-0003',
        contratoNumero: 'CTR-2026-0003',
        cotacaoTokenOuId: 'c7t7txta0mg7nhh',
      },
    ]

    for (let i = 0; i < mapSubs.length; i++) {
      const ms = mapSubs[i]
      try {
        const subList = app.findRecordsByFilter(
          'subcontratos',
          "numero = '" + ms.subNumero + "'",
          '-created',
          1,
          0,
        )
        if (subList.length > 0) {
          const subRec = subList[0]

          // Buscar projeto
          const prjList = app.findRecordsByFilter(
            'projetos',
            "codigo = '" + ms.prjCodigo + "'",
            '-created',
            1,
            0,
          )
          const prjId = prjList.length > 0 ? prjList[0].id : null

          // Buscar grupo
          const grpRec = gruposCriadosOuEncontrados[ms.codigoGpr]
          const grpId = grpRec ? grpRec.id : null

          // Buscar contrato de serviço
          const csList = app.findRecordsByFilter(
            'contratos_servico',
            "numero = '" + ms.contratoNumero + "'",
            '-created',
            1,
            0,
          )
          const csId = csList.length > 0 ? csList[0].id : null

          if (prjId) subRec.set('projeto', prjId)
          if (grpId) subRec.set('grupo', grpId)
          if (csId) subRec.set('contrato_servico_origem', csId)
          app.save(subRec)

          // Atualizar também a cotação associada com o grupo se faltar
          try {
            const cotList = app.findRecordsByFilter(
              'cotacoes',
              "id = '" + ms.cotacaoTokenOuId + "'",
              '-created',
              1,
              0,
            )
            if (cotList.length > 0 && grpId) {
              const cotRec = cotList[0]
              if (cotRec.getString('grupo') !== grpId) {
                cotRec.set('grupo', grpId)
                app.save(cotRec)
              }
            }
          } catch (_) {}

          try {
            const aRec = new Record(auditCol)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'SANEAMENTO_RASTREABILIDADE_SUBCONTRATO')
            aRec.set('entidade', 'subcontratos')
            aRec.set('registro_id', subRec.id)
            aRec.set('detalhes', {
              mensagem: 'Rastreabilidade SUB -> PRJ -> GPR -> CTR restaurada na migração 0054',
              subcontrato: ms.subNumero,
              projeto: ms.prjCodigo,
              grupo: ms.codigoGpr,
              contrato: ms.contratoNumero,
            })
            app.save(aRec)
          } catch (_) {}
        }
      } catch (errSub) {
        console.log('Aviso ao sanear subcontrato: ' + errSub)
      }
    }

    // =========================================================================
    // 4. REGENERAÇÃO DAS CONTAS (A RECEBER E A PAGAR) EM RASCUNHO (IDEMPOTENTE)
    // =========================================================================
    // A) Contas a Receber: regenerar a partir das parcelas de contratos de serviços
    // CTR-2026-0001 (5.000 -> 2 parcelas de 2.500)
    // CTR-2026-0002 (23.10 -> 2 parcelas de 11.55)
    // CTR-2026-0003 (34.206,15 -> 2 parcelas de 17.103,08)
    const contratosParaContas = ['CTR-2026-0001', 'CTR-2026-0002', 'CTR-2026-0003']

    for (let c = 0; c < contratosParaContas.length; c++) {
      const numCtr = contratosParaContas[c]
      try {
        const csList = app.findRecordsByFilter(
          'contratos_servico',
          "numero = '" + numCtr + "'",
          '-created',
          1,
          0,
        )
        if (csList.length === 0) continue
        const cs = csList[0]
        const csId = cs.id
        const propostaId = cs.getString('proposta')
        const projetoId = cs.getString('projeto')
        const valorTotalCs = cs.getFloat('valor_total') || 0

        // Verificar se já existem contas a receber para esta proposta/contrato
        let contasReceberExistentes = []
        try {
          if (propostaId) {
            contasReceberExistentes = app.findRecordsByFilter(
              'contas',
              "tipo = 'receber' && proposta = '" + propostaId + "'",
              'created',
              50,
              0,
            )
          }
        } catch (_) {}

        if (contasReceberExistentes.length === 0) {
          // Buscar parcelas da proposta
          let parcelas = []
          try {
            if (propostaId) {
              parcelas = app.findRecordsByFilter(
                'proposta_parcelas',
                "proposta = '" + propostaId + "'",
                'ordem',
                50,
                0,
              )
            }
          } catch (_) {}

          // Buscar se proposta requer nota e impostos
          let requerNota = false
          let impostos = 0
          if (propostaId) {
            try {
              const p = app.findRecordById('propostas', propostaId)
              if (p) {
                requerNota = p.getBool('requer_nota')
                impostos = p.getFloat('impostos') || 0
              }
            } catch (_) {}
          }

          if (parcelas.length > 0) {
            for (let pIdx = 0; pIdx < parcelas.length; pIdx++) {
              const parc = parcelas[pIdx]
              const ordem = parc.getInt('ordem') || pIdx + 1
              const perc = parc.getFloat('percentual') || 50
              const valorParc = parc.getFloat('valor') || (valorTotalCs * perc) / 100
              const descParc = parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
              const gatilho = parc.getString('gatilho') || 'marco'

              const novaConta = new Record(contasCol)
              novaConta.set('tipo', 'receber')
              if (projetoId) novaConta.set('projeto', projetoId)
              if (propostaId) novaConta.set('proposta', propostaId)
              novaConta.set(
                'descricao',
                'Contrato ' +
                  numCtr +
                  ' — Parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' (' +
                  perc +
                  '% - ' +
                  descParc +
                  ')' +
                  (requerNota ? ' (Com NF)' : ' (Sem NF)'),
              )
              novaConta.set('valor', valorParc)
              novaConta.set('status', 'rascunho')
              novaConta.set(
                'forma_pagamento',
                'Gatilho: ' + gatilho + ' | Conforme contrato assinado',
              )
              novaConta.set('bloqueada_por_fechamento', false)

              if (requerNota && impostos > 0) {
                const retencao = Math.round(((valorParc * impostos) / (100 + impostos)) * 100) / 100
                novaConta.set('retencao_impostos', retencao)
                novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
              } else {
                novaConta.set('retencao_impostos', 0)
                novaConta.set('valor_liquido', valorParc)
              }

              const diasVenc = pIdx === 0 ? 15 : (pIdx + 1) * 30
              const dataVenc = new Date()
              dataVenc.setDate(dataVenc.getDate() + diasVenc)
              novaConta.set(
                'vencimento',
                dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )

              app.save(novaConta)

              try {
                const aRec = new Record(auditCol)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'SANEAMENTO_CRIACAO_CONTA_RECEBER')
                aRec.set('entidade', 'contas')
                aRec.set('registro_id', novaConta.id)
                aRec.set('detalhes', {
                  justificativa: 'saneamento de dados de teste',
                  contrato: numCtr,
                  ordem: ordem,
                  valor: valorParc,
                })
                app.save(aRec)
              } catch (_) {}
            }
          } else {
            // Conta integral caso não haja parcelas desmembradas
            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoId) novaConta.set('projeto', projetoId)
            if (propostaId) novaConta.set('proposta', propostaId)
            novaConta.set(
              'descricao',
              'Recebimento integral do Contrato Assinado ' +
                numCtr +
                (requerNota ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorTotalCs)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Conforme contrato assinado')
            novaConta.set('bloqueada_por_fechamento', false)
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorTotalCs)

            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + 30)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            app.save(novaConta)
          }
        }
      } catch (errRec) {
        console.log('Aviso ao regenerar contas a receber: ' + errRec)
      }
    }

    // B) Contas a Pagar dos Subcontratos SUB-2026-0001 e SUB-2026-0002
    const subsParaContas = ['SUB-2026-0001', 'SUB-2026-0002']
    for (let s = 0; s < subsParaContas.length; s++) {
      const numSub = subsParaContas[s]
      try {
        const subList = app.findRecordsByFilter(
          'subcontratos',
          "numero = '" + numSub + "'",
          '-created',
          1,
          0,
        )
        if (subList.length === 0) continue
        const sub = subList[0]
        const subId = sub.id

        // Verificar se já tem contas a pagar vinculadas ao subcontrato
        let contasPagarExistentes = []
        try {
          contasPagarExistentes = app.findRecordsByFilter(
            'contas',
            "tipo = 'pagar' && subcontrato = '" + subId + "'",
            'created',
            50,
            0,
          )
        } catch (_) {}

        if (contasPagarExistentes.length === 0) {
          const prjId = sub.getString('projeto')
          const execId = sub.getString('executor')
          const vTotal = sub.getFloat('valor_total') || 0

          let parcelasJson = []
          try {
            const raw = sub.getString('parcelas_json')
            if (raw) parcelasJson = JSON.parse(raw)
          } catch (_) {}

          if (Array.isArray(parcelasJson) && parcelasJson.length > 0) {
            for (let pIdx = 0; pIdx < parcelasJson.length; pIdx++) {
              const parc = parcelasJson[pIdx]
              const nParc = parc.numero || pIdx + 1
              const vParc = parseFloat(parc.valor) || vTotal / parcelasJson.length
              const dVenc = parc.vencimento
                ? parc.vencimento + ' 12:00:00.000Z'
                : new Date(Date.now() + (pIdx + 1) * 30 * 86400000).toISOString().substring(0, 10) +
                  ' 12:00:00.000Z'

              const novaContaPagar = new Record(contasCol)
              novaContaPagar.set('tipo', 'pagar')
              if (prjId) novaContaPagar.set('projeto', prjId)
              if (execId) novaContaPagar.set('executor', execId)
              novaContaPagar.set('subcontrato', subId)
              novaContaPagar.set(
                'descricao',
                'Subcontrato ' +
                  numSub +
                  ' — Parcela ' +
                  nParc +
                  '/' +
                  parcelasJson.length +
                  ' — ' +
                  (parc.descricao || 'Serviços terceirizados'),
              )
              novaContaPagar.set('valor', vParc)
              novaContaPagar.set('valor_liquido', vParc)
              novaContaPagar.set('retencao_impostos', 0)
              novaContaPagar.set('vencimento', dVenc)
              novaContaPagar.set('status', 'rascunho')
              novaContaPagar.set(
                'forma_pagamento',
                sub.getString('condicoes_pagamento') || '30 dias após medição aprovada',
              )
              novaContaPagar.set('bloqueada_por_fechamento', false)
              app.save(novaContaPagar)

              try {
                const aRec = new Record(auditCol)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'SANEAMENTO_CRIACAO_CONTA_PAGAR')
                aRec.set('entidade', 'contas')
                aRec.set('registro_id', novaContaPagar.id)
                aRec.set('detalhes', {
                  justificativa: 'saneamento de dados de teste',
                  subcontrato: numSub,
                  parcela: nParc,
                  valor: vParc,
                })
                app.save(aRec)
              } catch (_) {}
            }
          } else {
            // Parcela única
            const novaContaPagar = new Record(contasCol)
            novaContaPagar.set('tipo', 'pagar')
            if (prjId) novaContaPagar.set('projeto', prjId)
            if (execId) novaContaPagar.set('executor', execId)
            novaContaPagar.set('subcontrato', subId)
            novaContaPagar.set(
              'descricao',
              'Subcontrato ' + numSub + ' — Terceirização de Engenharia',
            )
            novaContaPagar.set('valor', vTotal)
            novaContaPagar.set('valor_liquido', vTotal)
            novaContaPagar.set('retencao_impostos', 0)
            const dVenc =
              new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10) + ' 12:00:00.000Z'
            novaContaPagar.set('vencimento', dVenc)
            novaContaPagar.set('status', 'rascunho')
            novaContaPagar.set('forma_pagamento', '30 dias após medição aprovada')
            novaContaPagar.set('bloqueada_por_fechamento', false)
            app.save(novaContaPagar)
          }
        }
      } catch (errPagar) {
        console.log('Aviso ao regenerar contas a pagar: ' + errPagar)
      }
    }

    // =========================================================================
    // 5. SANITIZAÇÃO DE LINKS LOCALHOST NO BANCO REAL
    // =========================================================================
    // Determinar a URL base pública oficial do ambiente de produção/deploy
    const rawPublicUrl =
      $os.getenv('SITE_URL') ||
      $os.getenv('PB_INSTANCE_URL') ||
      'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'

    // Limpar barra final se houver
    const publicBaseUrl = rawPublicUrl.replace(/\/+$/, '')

    // A) Substituir em audit_logs onde detalhes contém http://localhost:5173
    app
      .db()
      .newQuery(`
      UPDATE audit_logs
      SET detalhes = replace(CAST(detalhes AS TEXT), 'http://localhost:5173', {:baseUrl})
      WHERE instr(CAST(detalhes AS TEXT), 'http://localhost:5173') > 0
    `)
      .bind({ baseUrl: publicBaseUrl })
      .execute()

    // B) Substituir em parametros se houver alguma referência a localhost
    app
      .db()
      .newQuery(`
      UPDATE parametros
      SET valor = replace(valor, 'http://localhost:5173', {:baseUrl})
      WHERE instr(valor, 'http://localhost:5173') > 0
    `)
      .bind({ baseUrl: publicBaseUrl })
      .execute()

    // C) Substituir em modelos se houver referência a localhost
    app
      .db()
      .newQuery(`
      UPDATE modelos
      SET corpo = replace(corpo, 'http://localhost:5173', {:baseUrl})
      WHERE instr(corpo, 'http://localhost:5173') > 0
    `)
      .bind({ baseUrl: publicBaseUrl })
      .execute()

    // D) Substituir em campanhas se houver referência a localhost
    app
      .db()
      .newQuery(`
      UPDATE campanhas
      SET corpo = replace(corpo, 'http://localhost:5173', {:baseUrl})
      WHERE instr(corpo, 'http://localhost:5173') > 0
    `)
      .bind({ baseUrl: publicBaseUrl })
      .execute()

    // Auditoria final consolidada da migração 0054
    try {
      const aRec = new Record(auditCol)
      aRec.set('user_email', 'SISTEMA')
      aRec.set('acao', 'MIGRACAO_0054_SANEAMENTO_CONCLUIDO')
      aRec.set('entidade', 'sistema')
      aRec.set('registro_id', '0054')
      aRec.set('detalhes', {
        justificativa: 'saneamento de dados de teste',
        mensagem:
          'Migração 0054 executada com sucesso: grupos retroativos GPR criados e vinculados, valores corrigidos, contas regeneradas, rastreabilidade dos SUBs restaurada, status de projetos convertido para select fechado e links localhost sanitizados.',
        base_url_sanitizacao: publicBaseUrl,
        grupos: ['GPR-2026-0001', 'GPR-2026-0002', 'GPR-2026-0003'],
        subcontratos: ['SUB-2026-0001', 'SUB-2026-0002'],
      })
      app.save(aRec)
    } catch (_) {}
  },
  (app) => {
    // Reversão no-op idempotente
  },
)
