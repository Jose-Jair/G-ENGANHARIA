migrate(
  (app) => {
    // Backfill idempotente para propostas aceitas sem contrato/projeto
    // Propostas existentes identificadas: PROP-2026-0001 (id: cq7zt0vpm5ru61y) e PROP-2026-0003 (id: oqmmphq44jshbum)
    const propostasAceitas = app.findRecordsByFilter(
      'propostas',
      "status = 'aceita'",
      'created',
      100,
      0,
    )

    if (propostasAceitas.length === 0) {
      return
    }

    // Obter cláusulas padrão
    let clausulasTexto = ''
    try {
      const param = app.findFirstRecordByData(
        'parametros',
        'chave',
        'contrato_servico_clausulas_padrao',
      )
      if (param) {
        clausulasTexto = param.getString('valor')
      }
    } catch (_) {}

    const contratosCol = app.findCollectionByNameOrId('contratos_servico')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    for (let i = 0; i < propostasAceitas.length; i++) {
      const prop = propostasAceitas[i]
      const propId = prop.id
      const propNumero = prop.getString('numero')
      const empresaId = prop.getString('empresa')
      const clientePfId = prop.getString('cliente_pf')
      const preco = prop.getFloat('preco') || 0
      const prazoDias = prop.getInt('prazo_dias') || 30
      const notaPrazo =
        prop.getString('nota_prazo') ||
        'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'
      const objeto =
        prop.getString('objeto') ||
        prop.getString('escopo') ||
        'Prestação de serviços técnicos especializados de engenharia'

      // 1. Contrato de serviço (idempotência)
      let contrato = null
      const contratosExistentes = app.findRecordsByFilter(
        'contratos_servico',
        "proposta = '" + propId + "'",
        '-created',
        1,
        0,
      )

      if (contratosExistentes.length > 0) {
        contrato = contratosExistentes[0]
      } else {
        // Buscar próximo número CTR-2026-NNNN
        const ano = 2026
        const prefixoCTR = 'CTR-' + ano + '-'
        const ctrs = app.findRecordsByFilter(
          'contratos_servico',
          "numero ~ '" + prefixoCTR + "'",
          '-numero',
          1,
          0,
        )

        let nextSeq = 1
        if (ctrs.length > 0) {
          const u = ctrs[0].getString('numero')
          const parts = u.split('-')
          const n = parseInt(parts[2], 10)
          if (!isNaN(n)) nextSeq = n + 1
        }
        const numCTR = prefixoCTR + ('0000' + nextSeq).slice(-4)

        // Espelho de parcelas
        let parcelas = []
        try {
          const parcs = app.findRecordsByFilter(
            'proposta_parcelas',
            "proposta = '" + propId + "'",
            'ordem',
            50,
            0,
          )
          parcelas = parcs.map((p) => ({
            ordem: p.getInt('ordem'),
            percentual: p.getFloat('percentual'),
            valor: p.getFloat('valor'),
            gatilho: p.getString('gatilho'),
            descricao: p.getString('descricao'),
          }))
        } catch (_) {}

        const novoCtr = new Record(contratosCol)
        novoCtr.set('numero', numCTR)
        novoCtr.set('proposta', propId)
        if (empresaId) novoCtr.set('empresa', empresaId)
        if (clientePfId) novoCtr.set('cliente_pf', clientePfId)
        novoCtr.set('objeto', objeto)
        novoCtr.set('valor_total', preco)
        novoCtr.set('prazo_dias', prazoDias)
        novoCtr.set('nota_prazo', notaPrazo)
        novoCtr.set('clausulas_texto', clausulasTexto)
        novoCtr.set('parcelas_json', parcelas)
        novoCtr.set('status', 'aguardando_assinatura_admin')
        novoCtr.set('token_assinatura_cliente', $security.randomString(32))

        app.save(novoCtr)
        contrato = novoCtr

        // Atualizar proposta com contrato_servico
        prop.set('contrato_servico', novoCtr.id)
        app.save(prop)

        // Auditar backfill contrato
        try {
          const aRec = new Record(auditCol)
          aRec.set('acao', 'BACKFILL_CORRECAO_RETROATIVA')
          aRec.set('entidade', 'contratos_servico')
          aRec.set('registro_id', novoCtr.id)
          aRec.set('detalhes', {
            tipo: 'correcao_retroativa',
            mensagem:
              'Contrato ' +
              numCTR +
              ' gerado retroativamente por migração de backfill para proposta aceita ' +
              propNumero,
            proposta_numero: propNumero,
            proposta_id: propId,
            contrato_numero: numCTR,
          })
          app.save(aRec)
        } catch (_) {}
      }

      // 2. Projeto em "Em Contratação" (idempotência)
      let projeto = null
      const projetosExistentes = app.findRecordsByFilter(
        'projetos',
        "proposta = '" + propId + "'",
        '-created',
        1,
        0,
      )

      if (projetosExistentes.length > 0) {
        projeto = projetosExistentes[0]
        let salvar = false
        if (!projeto.getString('contrato_servico') && contrato) {
          projeto.set('contrato_servico', contrato.id)
          salvar = true
        }
        if (salvar) app.save(projeto)

        if (contrato && !contrato.getString('projeto')) {
          contrato.set('projeto', projeto.id)
          app.save(contrato)
        }
      } else {
        const ano = 2026
        const prefixoPRJ = 'PRJ-' + ano + '-'
        const prjs = app.findRecordsByFilter(
          'projetos',
          "codigo ~ '" + prefixoPRJ + "'",
          '-codigo',
          1,
          0,
        )

        let nextSeqPrj = 1
        if (prjs.length > 0) {
          const u = prjs[0].getString('codigo')
          const parts = u.split('-')
          const n = parseInt(parts[2], 10)
          if (!isNaN(n)) nextSeqPrj = n + 1
        }
        const codPRJ = prefixoPRJ + ('0000' + nextSeqPrj).slice(-4)

        let nomeCliente = 'Cliente'
        if (empresaId) {
          try {
            const emp = app.findRecordById('empresas', empresaId)
            if (emp) nomeCliente = emp.getString('razao_social')
          } catch (_) {}
        } else if (clientePfId) {
          try {
            const pf = app.findRecordById('clientes_pf', clientePfId)
            if (pf) nomeCliente = pf.getString('nome')
          } catch (_) {}
        }

        const ctrNum = contrato ? contrato.getString('numero') : ''
        const novoPrj = new Record(projetosCol)
        novoPrj.set('codigo', codPRJ)
        novoPrj.set('nome', 'Projeto: ' + (ctrNum || propNumero) + ' — ' + nomeCliente)
        novoPrj.set('descricao', objeto)
        novoPrj.set('proposta', propId)
        if (contrato) {
          novoPrj.set('contrato_servico', contrato.id)
        }
        if (empresaId) novoPrj.set('empresa', empresaId)
        if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
        novoPrj.set('valor_total', preco)
        novoPrj.set('subcontratacao_autorizada', true)
        novoPrj.set('saude', 'verde')
        novoPrj.set('status', 'Em Contratação')

        app.save(novoPrj)
        projeto = novoPrj

        if (contrato) {
          contrato.set('projeto', novoPrj.id)
          app.save(contrato)
        }

        // Auditar backfill projeto
        try {
          const aRec = new Record(auditCol)
          aRec.set('acao', 'BACKFILL_CORRECAO_RETROATIVA')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoPrj.id)
          aRec.set('detalhes', {
            tipo: 'correcao_retroativa',
            mensagem:
              'Projeto ' +
              codPRJ +
              ' gerado retroativamente por migração de backfill em status "Em Contratação" para proposta aceita ' +
              propNumero,
            proposta_numero: propNumero,
            proposta_id: propId,
            projeto_codigo: codPRJ,
            status: 'Em Contratação',
          })
          app.save(aRec)
        } catch (_) {}
      }
    }
  },
  (app) => {
    // Reversão opcional (não remove registros gerados para não quebrar integridade histórica)
  },
)
