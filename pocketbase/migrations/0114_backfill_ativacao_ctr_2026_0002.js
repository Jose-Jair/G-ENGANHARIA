migrate(
  (app) => {
    // Backfill idempotente: Ativação do CTR-2026-0002 caso ainda não tenha projeto
    const ctrCol = app.findCollectionByNameOrId('contratos_servico')
    let ctr0002 = null
    try {
      ctr0002 = app.findFirstRecordByFilter('contratos_servico', "numero = 'CTR-2026-0002'")
    } catch (_) {
      return
    }

    if (!ctr0002 || ctr0002.getString('status') !== 'assinado') {
      return
    }

    const prjIdVinculado = ctr0002.getString('projeto')
    const prjsExistentes = app.findRecordsByFilter(
      'projetos',
      "contrato_servico = '" + ctr0002.id + "' || codigo = 'PRJ-2026-0002'",
      'codigo',
      1,
      0,
    )

    if (!prjIdVinculado && prjsExistentes.length === 0) {
      const propostaId = ctr0002.getString('proposta')
      const clientePfId = ctr0002.getString('cliente_pf')
      const valorTotal = ctr0002.getFloat('valor_total') || 1000
      const prazoDias = ctr0002.getInt('prazo_dias') || 30
      const dtBase =
        ctr0002.getString('data_assinatura_cliente') ||
        ctr0002.getString('data_assinatura_admin') ||
        new Date().toISOString()
      const dtPrazoFinal = new Date(dtBase)
      dtPrazoFinal.setDate(dtPrazoFinal.getDate() + prazoDias)
      const prazoFinalIso = dtPrazoFinal.toISOString().substring(0, 10) + ' 12:00:00.000Z'

      let nomeCliente = 'Cliente'
      if (clientePfId) {
        try {
          const pf = app.findRecordById('clientes_pf', clientePfId)
          if (pf) nomeCliente = pf.getString('nome') || 'Cliente PF'
        } catch (_) {}
      }

      const projetosCol = app.findCollectionByNameOrId('projetos')
      const gruposCol = app.findCollectionByNameOrId('grupos_projetos')
      const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
      const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
      const contasCol = app.findCollectionByNameOrId('contas')

      // 1. Grupo
      let grupoRec = null
      const gruposExist = app.findRecordsByFilter(
        'grupos_projetos',
        "contrato_servico = '" + ctr0002.id + "'",
        '-created',
        1,
        0,
      )
      if (gruposExist.length > 0) {
        grupoRec = gruposExist[0]
      } else {
        const anoAtual = new Date().getFullYear()
        const prefixoGPR = 'GPR-' + anoAtual + '-'
        const gruposDoAno = app.findRecordsByFilter(
          'grupos_projetos',
          "codigo ~ '" + prefixoGPR + "'",
          '-codigo',
          1,
          0,
        )
        let proximoSeqGpr = 1
        if (gruposDoAno.length > 0) {
          const partes = gruposDoAno[0].getString('codigo').split('-')
          const uSeq = parseInt(partes[2], 10)
          if (!isNaN(uSeq)) proximoSeqGpr = uSeq + 1
        }
        const codigoGPR = prefixoGPR + ('0000' + proximoSeqGpr).slice(-4)
        grupoRec = new Record(gruposCol)
        grupoRec.set('codigo', codigoGPR)
        grupoRec.set('contrato_servico', ctr0002.id)
        if (propostaId) grupoRec.set('proposta', propostaId)
        if (clientePfId) grupoRec.set('cliente_pf', clientePfId)
        grupoRec.set('nome', 'Grupo: CTR-2026-0002 — ' + nomeCliente)
        grupoRec.set('descricao', ctr0002.getString('objeto'))
        grupoRec.set('status', 'ativo')
        grupoRec.set('valor_total', valorTotal)
        app.save(grupoRec)
      }

      // 2. Projeto PRJ-2026-0002
      const prj0002 = new Record(projetosCol)
      prj0002.set('codigo', 'PRJ-2026-0002')
      prj0002.set('nome', 'Projeto: CTR-2026-0002 — ' + nomeCliente)
      prj0002.set('descricao', ctr0002.getString('objeto'))
      if (propostaId) prj0002.set('proposta', propostaId)
      prj0002.set('contrato_servico', ctr0002.id)
      if (grupoRec) prj0002.set('grupo', grupoRec.id)
      if (clientePfId) prj0002.set('cliente_pf', clientePfId)
      prj0002.set('valor_total', valorTotal)
      prj0002.set('subcontratacao_autorizada', true)
      prj0002.set('saude', 'verde')
      prj0002.set('status', 'aguardando_definicao')
      prj0002.set('disciplinas', 'Estrutural')
      prj0002.set('prazo_final', prazoFinalIso)
      app.save(prj0002)

      // Vincula projeto no contrato
      ctr0002.set('projeto', prj0002.id)
      app.save(ctr0002)

      // 3. Etapas
      const etapa0002 = new Record(etapasCol)
      etapa0002.set('projeto', prj0002.id)
      etapa0002.set('nome', 'Pacote: Laudo Estrutural')
      etapa0002.set('disciplina', 'Estrutural')
      etapa0002.set('ordem', 1)
      etapa0002.set('tipo_execucao', 'direta')
      etapa0002.set('status', 'atribuido')
      etapa0002.set('custo_estimado', 0)
      etapa0002.set('is_pacote_trabalho', true)
      etapa0002.set('is_marco', false)
      etapa0002.set('valor_interno_referencia', 0)
      etapa0002.set('valor_vendido', valorTotal)
      etapa0002.set('escopo_detalhado', ctr0002.getString('objeto'))
      etapa0002.set('prazo', prazoFinalIso)
      etapa0002.set(
        'descricao',
        'Serviços técnicos de Engenharia Estrutural.\nItem do escopo: ' +
          ctr0002.getString('objeto'),
      )
      app.save(etapa0002)

      // 4. Entregáveis
      const entregaveisPadrao = [
        {
          nome: 'Relatório e Memorial Estrutural',
          descricao: 'Memorial técnico descritivo e memória de cálculo',
        },
        {
          nome: 'Pranchas e Desenhos Técnicos',
          descricao: 'Plantas, cortes, detalhes e arquivos executivos',
        },
        {
          nome: 'Anotação de Responsabilidade Técnica (ART/RRT)',
          descricao: 'Registro de responsabilidade técnica perante o conselho de classe',
        },
      ]
      for (let ep = 0; ep < entregaveisPadrao.length; ep++) {
        try {
          const novoEnt = new Record(entregaveisCol)
          novoEnt.set('etapa', etapa0002.id)
          novoEnt.set('nome', entregaveisPadrao[ep].nome)
          novoEnt.set('titulo', entregaveisPadrao[ep].nome)
          novoEnt.set('versao', 'v1.0')
          novoEnt.set('versao_atual', 1)
          novoEnt.set('status', 'atribuido')
          novoEnt.set('descricao', entregaveisPadrao[ep].descricao)
          novoEnt.set('prazo', prazoFinalIso)
          app.save(novoEnt)
        } catch (_) {}
      }

      // 5. Contas a receber (2 x R$ 500 do parcelas_json)
      let parcelas = []
      const rawParcelas = ctr0002.get('parcelas_json')
      if (Array.isArray(rawParcelas) && rawParcelas.length > 0) {
        parcelas = rawParcelas
      } else {
        parcelas = [
          {
            ordem: 1,
            percentual: 50,
            valor: 500,
            descricao: 'Entrada na Assinatura (50%)',
            dias_vencimento: 15,
          },
          {
            ordem: 2,
            percentual: 50,
            valor: 500,
            descricao: 'Entrega Final dos Laudos (50%)',
            dias_vencimento: 30,
          },
        ]
      }
      for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i]
        const ordem = p.ordem || i + 1
        const valorParc = Number(p.valor) || 500
        const perc = Number(p.percentual) || 50
        const descParc = p.descricao || 'Parcela ' + ordem + '/' + parcelas.length
        const novaConta = new Record(contasCol)
        novaConta.set('tipo', 'receber')
        novaConta.set('projeto', prj0002.id)
        if (propostaId) novaConta.set('proposta', propostaId)
        novaConta.set('contrato_servico', ctr0002.id)
        novaConta.set(
          'descricao',
          'Contrato CTR-2026-0002 — Parcela ' +
            ordem +
            '/' +
            parcelas.length +
            ' (' +
            perc +
            '% - ' +
            descParc +
            ') (Sem NF)',
        )
        novaConta.set('valor', valorParc)
        novaConta.set('status', 'rascunho')
        novaConta.set('forma_pagamento', 'Gatilho: marco | 50% de entrada + 50% na entrega final')
        novaConta.set('bloqueada_por_fechamento', false)
        novaConta.set('retencao_impostos', 0)
        novaConta.set('valor_liquido', valorParc)

        const diasVenc = p.dias_vencimento || (i === 0 ? 15 : 30)
        const dataVenc = new Date()
        dataVenc.setDate(dataVenc.getDate() + diasVenc)
        novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')
        app.save(novaConta)
      }

      if (propostaId) {
        try {
          const propRec = app.findRecordById('propostas', propostaId)
          if (propRec && propRec.getString('status') !== 'convertida_em_projeto') {
            propRec.set('status', 'convertida_em_projeto')
            app.save(propRec)
          }
        } catch (_) {}
      }
      if (clientePfId) {
        try {
          const pfRec = app.findRecordById('clientes_pf', clientePfId)
          if (pfRec && pfRec.getBool('pre_cadastro')) {
            pfRec.set('pre_cadastro', false)
            app.save(pfRec)
          }
        } catch (_) {}
      }
    } else if (prjsExistentes.length > 0 && !prjIdVinculado) {
      ctr0002.set('projeto', prjsExistentes[0].id)
      app.save(ctr0002)
    }
  },
  (app) => {},
)
