// Hook to handle automatic numbering for Propostas (PROP-AAAA-NNNN),
// Projetos (PRJ-AAAA-NNNN), Contratos de Serviço (CTR-AAAA-NNNN),
// Revisions (Rev.00, Rev.01, etc.), token_aceite generation,
// and the consequences of Proposal Acceptance and Contract Signing:
//
// NOVO FLUXO CONTRATUAL REESTRUTURADO (Opção B):
// 1. Proposta ACEITA:
//    - Gera CONTRATO DE SERVIÇOS (CTR-AAAA-NNNN) com status 'aguardando_assinatura_admin'
//    - Gera IMEDIATAMENTE o PROJETO (PRJ-AAAA-NNNN) em status 'contratacao'
//      vinculado ao contrato CTR e à proposta
//      SEM etapas, sem entregáveis e sem contas a receber neste momento
//    - Registra auditoria do aceite, da criação do contrato e do projeto em Contratação
// 2. Contrato de Serviço ASSINADO (assinatura bilateral - Admin e Cliente):
//    - ATIVA o projeto já existente (muda status de 'contratacao' para 'em_andamento')
//    - GERA ETAPAS por disciplina pré-populadas e entregáveis padrão das áreas
//    - GERA CONTAS A RECEBER (a partir das parcelas da proposta ou parcela integral)
//    - Promove Empresa a Parceira no funil e Cliente PF de pré-cadastro a definitivo
//    - Trava estrita de idempotência (1 proposta = 1 contrato = 1 projeto ativado, sem duplicações)

onRecordCreate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'propostas') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'PROP-' + anoAtual + '-'

    let numeroExistente = rec.getString('numero')
    if (!numeroExistente || !numeroExistente.startsWith(prefixo)) {
      try {
        const propostasDoAno = $app.findRecordsByFilter(
          'propostas',
          "numero ~ '" + prefixo + "'",
          '-numero',
          1,
          0,
        )

        let proximoSeq = 1
        if (propostasDoAno.length > 0) {
          const ultimoNumero = propostasDoAno[0].getString('numero')
          const partes = ultimoNumero.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeq = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeq).slice(-4)
        rec.set('numero', prefixo + seqStr)
      } catch (err) {
        console.log('Erro ao gerar numeração automática de proposta: ' + err)
      }
    }

    if (!rec.getString('revisao')) {
      rec.set('revisao', 'Rev.00')
    }

    // Regra: link/token_aceite só é gerado quando aprovada pelo Admin/Comercial
    // Se a proposta já estiver nascendo aprovada ou com status posterior a rascunho
    const statusCriado = rec.getString('status') || 'rascunho'
    if (statusCriado !== 'rascunho' && !rec.getString('token_aceite')) {
      rec.set('token_aceite', $security.randomString(32))
    }

    if (!rec.getString('status')) {
      rec.set('status', 'rascunho')
    }
  }

  if (colName === 'contratos_servico') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'CTR-' + anoAtual + '-'

    let numeroExistente = rec.getString('numero')
    if (!numeroExistente || !numeroExistente.startsWith(prefixo)) {
      try {
        const contratosDoAno = $app.findRecordsByFilter(
          'contratos_servico',
          "numero ~ '" + prefixo + "'",
          '-numero',
          1,
          0,
        )

        let proximoSeq = 1
        if (contratosDoAno.length > 0) {
          const ultimoNumero = contratosDoAno[0].getString('numero')
          const partes = ultimoNumero.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeq = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeq).slice(-4)
        rec.set('numero', prefixo + seqStr)
      } catch (err) {
        console.log('Erro ao gerar numeração automática de contrato de serviço: ' + err)
      }
    }

    if (!rec.getString('token_assinatura_cliente')) {
      rec.set('token_assinatura_cliente', $security.randomString(32))
    }

    if (!rec.getString('status')) {
      rec.set('status', 'aguardando_assinatura_admin')
    }
  }

  if (colName === 'projetos') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'PRJ-' + anoAtual + '-'

    let codigoExistente = rec.getString('codigo')
    if (!codigoExistente || !codigoExistente.startsWith(prefixo)) {
      try {
        const projetosDoAno = $app.findRecordsByFilter(
          'projetos',
          "codigo ~ '" + prefixo + "'",
          '-codigo',
          1,
          0,
        )

        let proximoSeq = 1
        if (projetosDoAno.length > 0) {
          const ultimoCodigo = projetosDoAno[0].getString('codigo')
          const partes = ultimoCodigo.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeq = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeq).slice(-4)
        rec.set('codigo', prefixo + seqStr)
      } catch (err) {
        console.log('Erro ao gerar código automático de projeto: ' + err)
      }
    }

    if (!rec.getString('saude')) {
      rec.set('saude', 'verde')
    }
    if (!rec.getString('status')) {
      rec.set('status', 'em_andamento')
    }
  }

  e.next()
})

// Hook onRecordUpdate for propostas & contratos_servico:
onRecordUpdate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'propostas') {
    const original = rec.original()
    const oldStatus = original ? original.getString('status') : ''
    const newStatus = rec.getString('status')

    // PORTÃO DE VALIDAÇÃO: Quando a proposta for validada/aprovada (ex: vira 'enviada' ou 'aprovada'),
    // se ainda não possuir token_aceite, gera agora!
    if (newStatus !== 'rascunho' && !rec.getString('token_aceite')) {
      rec.set('token_aceite', $security.randomString(32))
    }

    // Se status mudou para 'visualizada' pela primeira vez
    if (
      newStatus === 'visualizada' &&
      oldStatus !== 'visualizada' &&
      !rec.getString('data_visualizacao')
    ) {
      rec.set('data_visualizacao', new Date().toISOString())
    }

    // Se status mudou para 'aceita'
    if (newStatus === 'aceita' && oldStatus !== 'aceita' && !rec.getString('data_aceite')) {
      rec.set('data_aceite', new Date().toISOString())
    }

    // Se status mudou para 'recusada'
    if (newStatus === 'recusada' && oldStatus !== 'recusada' && !rec.getString('data_recusa')) {
      rec.set('data_recusa', new Date().toISOString())
    }
  }

  if (colName === 'contratos_servico') {
    const original = rec.original()
    const oldStatus = original ? original.getString('status') : ''
    const newStatus = rec.getString('status')

    // Quando admin assina
    if (
      rec.getString('data_assinatura_admin') &&
      (!original || !original.getString('data_assinatura_admin'))
    ) {
      if (!rec.getString('data_assinatura_cliente')) {
        rec.set('status', 'aguardando_assinatura_cliente')
      } else {
        rec.set('status', 'assinado')
      }
    }

    // Quando cliente assina:
    // Se admin já assinou -> status vira 'assinado'
    // Se admin ainda não assinou -> fica 'aguardando_assinatura_admin'
    if (
      rec.getString('data_assinatura_cliente') &&
      (!original || !original.getString('data_assinatura_cliente'))
    ) {
      if (rec.getString('data_assinatura_admin')) {
        rec.set('status', 'assinado')
      }
    }
  }

  e.next()
})

// After update success:
// 1. Proposta virou 'aceita': GERA CONTRATO DE SERVIÇOS + PROJETO (status "contratacao")
// 2. Contrato de Serviço virou 'assinado': ATIVA PROJETO EXISTENTE + GERA ETAPAS + CONTAS + PROMOÇÃO
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    const colName = rec.collection().name

    // =========================================================================
    // CASO 1: PROPOSTA ACEITA -> GERA CONTRATO CTR
    // =========================================================================
    if (colName === 'propostas') {
      const original = rec.original()
      const oldStatus = original ? original.getString('status') : ''
      const newStatus = rec.getString('status')

      if (newStatus === 'aceita' && oldStatus !== 'aceita') {
        const propostaId = rec.id
        const propostaNumero = rec.getString('numero')
        const empresaId = rec.getString('empresa')
        const clientePfId = rec.getString('cliente_pf')
        const preco = rec.getFloat('preco') || 0
        const prazoDias = rec.getInt('prazo_dias') || 30
        const notaPrazo =
          rec.getString('nota_prazo') ||
          'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'
        const objeto =
          rec.getString('objeto') ||
          rec.getString('escopo') ||
          'Prestação de serviços técnicos de engenharia'

        try {
          // Obter cláusulas padrão dos parâmetros
          let clausulasTexto = ''
          try {
            const paramClausulas = $app.findFirstRecordByData(
              'parametros',
              'chave',
              'contrato_servico_clausulas_padrao',
            )
            if (paramClausulas) {
              clausulasTexto = paramClausulas.getString('valor')
            }
          } catch (_) {}

          // Obter parcelas da proposta
          let parcelas = []
          try {
            const parcs = $app.findRecordsByFilter(
              'proposta_parcelas',
              "proposta = '" + propostaId + "'",
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

          // 1.1 Verificar/Criar Contrato de Serviços com Trava de Idempotência
          let contratoCriado = null
          const contratosExistentes = $app.findRecordsByFilter(
            'contratos_servico',
            "proposta = '" + propostaId + "'",
            '-created',
            1,
            0,
          )

          if (contratosExistentes.length > 0) {
            contratoCriado = contratosExistentes[0]
          } else {
            const contratosCol = $app.findCollectionByNameOrId('contratos_servico')
            const novoContrato = new Record(contratosCol)
            novoContrato.set('proposta', propostaId)
            if (empresaId) novoContrato.set('empresa', empresaId)
            if (clientePfId) novoContrato.set('cliente_pf', clientePfId)
            novoContrato.set('objeto', objeto)
            novoContrato.set('valor_total', preco)
            novoContrato.set('prazo_dias', prazoDias)
            novoContrato.set('nota_prazo', notaPrazo)
            novoContrato.set('clausulas_texto', clausulasTexto)
            novoContrato.set('parcelas_json', parcelas)
            novoContrato.set('status', 'aguardando_assinatura_admin')
            novoContrato.set('token_assinatura_cliente', $security.randomString(32))

            $app.save(novoContrato)
            contratoCriado = novoContrato

            // Vincular contrato_servico de volta na proposta
            try {
              rec.set('contrato_servico', novoContrato.id)
              $app.save(rec)
            } catch (_) {}

            // Auditoria de geração do contrato de serviço
            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('acao', 'GERACAO_CONTRATO_SERVICO')
              aRec.set('entidade', 'contratos_servico')
              aRec.set('registro_id', novoContrato.id)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Contrato de serviços gerado automaticamente pelo aceite da proposta ' +
                  propostaNumero,
                contrato_numero: novoContrato.getString('numero'),
                proposta_id: propostaId,
                proposta_numero: propostaNumero,
                valor: preco,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        } catch (errAceite) {
          console.log('Erro ao processar aceite da proposta: ' + errAceite)
        }
      }
    }

    // =========================================================================
    // CASO 2: CONTRATO DE SERVIÇO ASSINADO -> GERAÇÃO DE GRUPO + 1 PROJETO POR ITEM (BLOCO 4)
    // =========================================================================
    if (colName === 'contratos_servico') {
      const original = rec.original()
      const oldStatus = original ? original.getString('status') : ''
      const newStatus = rec.getString('status')

      if (newStatus === 'assinado' && oldStatus !== 'assinado') {
        // Ativação desacoplada agora é gerenciada pelo endpoint assinar-* ou rotina/cron agendada
        try {
          executarAtivacaoContratoServico(rec)
        } catch (errAtiv) {
          console.log(
            'Erro na ativação de contrato de serviço assinado (onRecordAfterUpdateSuccess): ' +
              errAtiv,
          )
        }
      }
    }
  } finally {
    e.next()
  }

  function executarAtivacaoContratoServico(rec) {
    const contratoId = rec.id
    const contratoNumero = rec.getString('numero')
    const propostaId = rec.getString('proposta')
    const empresaId = rec.getString('empresa')
    const clientePfId = rec.getString('cliente_pf')
    const valorTotalContrato = rec.getFloat('valor_total') || 0
    const objetoContrato = rec.getString('objeto') || 'Prestação de serviços técnicos de engenharia'

    let propostaRec = null
    let propostaNumero = ''
    let condicoesPagamento = 'Conforme contrato assinado'
    let requerNotaProposta = false
    let aliquotaImpostos = 0

    if (propostaId) {
      try {
        propostaRec = $app.findRecordById('propostas', propostaId)
        if (propostaRec) {
          propostaNumero = propostaRec.getString('numero')
          condicoesPagamento = propostaRec.getString('condicoes_pagamento') || condicoesPagamento
          requerNotaProposta = propostaRec.getBool('requer_nota')
          aliquotaImpostos = propostaRec.getInt('impostos') || 0
        }
      } catch (errProp) {
        console.log('Erro ao buscar proposta vinculada ' + propostaId + ': ' + errProp)
      }
    }

    let nomeCliente = 'Cliente'
    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) nomeCliente = emp.getString('razao_social')
      } catch (_) {}
    } else if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        if (pf) nomeCliente = pf.getString('nome')
      } catch (_) {}
    }

    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const projetosCol = $app.findCollectionByNameOrId('projetos')
    const gruposCol = $app.findCollectionByNameOrId('grupos_projetos')
    const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')
    const contasCol = $app.findCollectionByNameOrId('contas')

    // 1. CRIAR OU RECUPERAR GRUPO DE PROJETOS (Trava de Idempotência 1:1 Contrato <-> Grupo)
    let grupoCriado = null
    try {
      const gruposExistentes = $app.findRecordsByFilter(
        'grupos_projetos',
        "contrato_servico = '" + contratoId + "'",
        '-created',
        1,
        0,
      )
      if (gruposExistentes.length > 0) {
        grupoCriado = gruposExistentes[0]
      } else {
        const anoAtual = new Date().getFullYear()
        const prefixoGPR = 'GPR-' + anoAtual + '-'
        const gruposDoAno = $app.findRecordsByFilter(
          'grupos_projetos',
          "codigo ~ '" + prefixoGPR + "'",
          '-codigo',
          1,
          0,
        )

        let proximoSeqGpr = 1
        if (gruposDoAno.length > 0) {
          const ultimoCodigo = gruposDoAno[0].getString('codigo')
          const partes = ultimoCodigo.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeqGpr = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeqGpr).slice(-4)
        const codigoGPR = prefixoGPR + seqStr

        const novoGrupo = new Record(gruposCol)
        novoGrupo.set('codigo', codigoGPR)
        novoGrupo.set('contrato_servico', contratoId)
        if (propostaId) novoGrupo.set('proposta', propostaId)
        if (empresaId) novoGrupo.set('empresa', empresaId)
        if (clientePfId) novoGrupo.set('cliente_pf', clientePfId)
        novoGrupo.set('nome', 'Grupo: ' + contratoNumero + ' — ' + nomeCliente)
        novoGrupo.set('descricao', objetoContrato)
        novoGrupo.set('status', 'ativo')
        novoGrupo.set('valor_total', valorTotalContrato)

        $app.save(novoGrupo)
        grupoCriado = novoGrupo

        try {
          const aRec = new Record(auditCol)
          aRec.set('acao', 'CRIACAO_GRUPO_PROJETOS')
          aRec.set('entidade', 'grupos_projetos')
          aRec.set('registro_id', novoGrupo.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Grupo de projetos ' +
              codigoGPR +
              ' criado pela assinatura bilateral do Contrato ' +
              contratoNumero,
            codigo: codigoGPR,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            valor_total: valorTotalContrato,
          })
          $app.save(aRec)
        } catch (errAud) {
          console.log('Erro ao gravar auditoria do grupo: ' + errAud)
        }
      }
    } catch (errGrupo) {
      console.log('Erro ao criar grupo de projetos: ' + errGrupo)
    }

    // Trava de idempotência atômica: se já existirem projetos ativos vinculados a este contrato, não recriar
    const projetosJaCriados = $app.findRecordsByFilter(
      'projetos',
      "contrato_servico = '" + contratoId + "'",
      'codigo',
      100,
      0,
    )
    if (projetosJaCriados.length > 0) {
      for (let pIdx = 0; pIdx < projetosJaCriados.length; pIdx++) {
        const prjExistente = projetosJaCriados[pIdx]
        let prjModificado = false
        if (grupoCriado && prjExistente.getString('grupo') !== grupoCriado.id) {
          prjExistente.set('grupo', grupoCriado.id)
          prjModificado = true
        }
        if (clientePfId && prjExistente.getString('cliente_pf') !== clientePfId) {
          prjExistente.set('cliente_pf', clientePfId)
          prjModificado = true
        }
        if (empresaId && prjExistente.getString('empresa') !== empresaId) {
          prjExistente.set('empresa', empresaId)
          prjModificado = true
        }
        const st = prjExistente.getString('status')
        if (st === 'contratacao' || st === 'Em Contratação' || !st) {
          prjExistente.set('status', 'aguardando_definicao')
          prjExistente.set('modo_execucao', null)
          prjModificado = true
        }
        if (prjModificado) {
          $app.save(prjExistente)
        }
      }
      return
    }

    // 2. OBTER ITENS DE ESCOPO DA PROPOSTA (Apenas itens reais do catálogo ou com serviço/descrição válida)
    let itensEscopo = []
    if (propostaId) {
      try {
        const itensDb = $app.findRecordsByFilter(
          'proposta_itens',
          "proposta = '" + propostaId + "'",
          'ordem,created',
          200,
          0,
        )
        if (itensDb.length > 0) {
          itensEscopo = itensDb
            .filter((it) => {
              const desc = (it.getString('descricao') || '').trim()
              const serv = it.getString('servico') || ''
              return (serv !== '' || desc.length > 0) && !desc.startsWith('Item de Escopo ')
            })
            .map((it) => ({
              id: it.id,
              record: it,
              descricao: it.getString('descricao'),
              disciplina: it.getString('disciplina') || 'Geral',
              area: it.getString('area'),
              valor: it.getFloat('preco_total') || 0,
              custo: it.getFloat('custo_total') || 0,
              subservicos: it.get('subservicos') || [],
            }))
        }
      } catch (_) {}

      if (itensEscopo.length === 0 && propostaRec) {
        try {
          const rawJsonStr = propostaRec.getString('itens_json')
          let parsedItens = []
          if (rawJsonStr && rawJsonStr.trim()) {
            const parsed = JSON.parse(rawJsonStr)
            if (Array.isArray(parsed)) {
              parsedItens = parsed
            }
          }
          if (parsedItens.length > 0) {
            itensEscopo = parsedItens
              .filter((it) => {
                const desc = typeof it.descricao === 'string' ? it.descricao.trim() : ''
                const temServico = Boolean(it.servico || it.catalogo_servico)
                const descValida = desc.length > 0 && !desc.startsWith('Item de Escopo ')
                return temServico || descValida
              })
              .map((it) => ({
                id: null,
                record: null,
                descricao: (it.descricao || '').trim() || objetoContrato,
                disciplina: it.disciplina || 'Geral',
                area: it.area || '',
                valor: Number(it.preco_total) || 0,
                custo: Number(it.custo_total) || 0,
                subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
              }))
          }
        } catch (errJson) {
          console.log('Erro ao analisar itens_json canônico: ' + errJson)
        }
      }
    }

    // Se ainda não houver itens específicos, cria 1 item sintético representando o escopo integral
    if (itensEscopo.length === 0) {
      itensEscopo = [
        {
          id: null,
          record: null,
          descricao: objetoContrato,
          disciplina: propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
          area: '',
          valor: valorTotalContrato,
          custo: 0,
          subservicos: [],
        },
      ]
    }

    const somaItens = itensEscopo.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
    if (somaItens === 0 && valorTotalContrato > 0) {
      const valorPorItem = Math.round((valorTotalContrato / itensEscopo.length) * 100) / 100
      for (let idx = 0; idx < itensEscopo.length; idx++) {
        itensEscopo[idx].valor =
          idx === itensEscopo.length - 1
            ? Math.round((valorTotalContrato - valorPorItem * (itensEscopo.length - 1)) * 100) / 100
            : valorPorItem
      }
    }

    // 3. GERAR / ATUALIZAR 1 PROJETO POR ITEM DE ESCOPO (VINCULADOS AO GRUPO E AO CONTRATO)
    let projetosExistentesContrato = []
    try {
      projetosExistentesContrato = $app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" +
          contratoId +
          "' || (proposta = '" +
          propostaId +
          "' && grupo = '')",
        'codigo',
        100,
        0,
      )
    } catch (_) {}

    const anoAtual = new Date().getFullYear()
    const prefixoPRJ = 'PRJ-' + anoAtual + '-'
    let proximoSeqPrj = 1
    try {
      const projetosDoAno = $app.findRecordsByFilter(
        'projetos',
        "codigo ~ '" + prefixoPRJ + "'",
        '-codigo',
        1,
        0,
      )
      if (projetosDoAno.length > 0) {
        const ult = projetosDoAno[0].getString('codigo')
        const partes = ult.split('-')
        const num = parseInt(partes[2], 10)
        if (!isNaN(num)) proximoSeqPrj = num + 1
      }
    } catch (_) {}

    const projetosGerados = []

    for (let i = 0; i < itensEscopo.length; i++) {
      const item = itensEscopo[i]
      let prjParaItem = null

      if (i < projetosExistentesContrato.length) {
        prjParaItem = projetosExistentesContrato[i]
      }

      if (prjParaItem) {
        let prjAlterado = false
        if (grupoCriado && prjParaItem.getString('grupo') !== grupoCriado.id) {
          prjParaItem.set('grupo', grupoCriado.id)
          prjAlterado = true
        }
        if (prjParaItem.getString('contrato_servico') !== contratoId) {
          prjParaItem.set('contrato_servico', contratoId)
          prjAlterado = true
        }
        if (clientePfId && prjParaItem.getString('cliente_pf') !== clientePfId) {
          prjParaItem.set('cliente_pf', clientePfId)
          prjAlterado = true
        }
        if (empresaId && prjParaItem.getString('empresa') !== empresaId) {
          prjParaItem.set('empresa', empresaId)
          prjAlterado = true
        }

        if (itensEscopo.length > 1) {
          prjParaItem.set(
            'nome',
            'Projeto ' +
              (i + 1) +
              '/' +
              itensEscopo.length +
              ': ' +
              item.descricao +
              ' — ' +
              nomeCliente,
          )
          prjParaItem.set('descricao', item.descricao)
          prjParaItem.set('valor_total', item.valor)
          prjParaItem.set('disciplinas', item.disciplina)
          prjAlterado = true
        } else {
          prjParaItem.set('valor_total', item.valor || valorTotalContrato)
          prjAlterado = true
        }

        if (!prjParaItem.getString('prazo_final')) {
          try {
            const pDiasContrato = rec.getInt('prazo_dias') || 30
            const dtBaseAssinatura =
              rec.getString('data_assinatura_cliente') ||
              rec.getString('data_assinatura_admin') ||
              new Date().toISOString()
            const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
            dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
            prjParaItem.set(
              'prazo_final',
              dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
            )
            prjAlterado = true
          } catch (_) {}
        }

        // Regra canônica: projetos ativados por contrato assinado nascem com status 'aguardando_definicao' e modo_execucao null
        const statusAtual = prjParaItem.getString('status')
        if (statusAtual === 'contratacao' || statusAtual === 'Em Contratação' || !statusAtual) {
          prjParaItem.set('status', 'aguardando_definicao')
          prjParaItem.set('modo_execucao', null)
          prjAlterado = true
        }

        if (prjAlterado) {
          $app.save(prjParaItem)
        }
      } else {
        const seqStr = ('0000' + proximoSeqPrj).slice(-4)
        const codigoPRJ = prefixoPRJ + seqStr
        proximoSeqPrj++

        const novoPrj = new Record(projetosCol)
        novoPrj.set('codigo', codigoPRJ)
        novoPrj.set(
          'nome',
          itensEscopo.length > 1
            ? 'Projeto ' +
                (i + 1) +
                '/' +
                itensEscopo.length +
                ': ' +
                item.descricao +
                ' — ' +
                nomeCliente
            : 'Projeto: ' + contratoNumero + ' — ' + nomeCliente,
        )
        novoPrj.set('descricao', item.descricao)
        if (propostaId) novoPrj.set('proposta', propostaId)
        novoPrj.set('contrato_servico', contratoId)
        if (grupoCriado) novoPrj.set('grupo', grupoCriado.id)
        if (empresaId) novoPrj.set('empresa', empresaId)
        if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
        novoPrj.set('valor_total', item.valor)
        novoPrj.set('subcontratacao_autorizada', true)
        novoPrj.set('saude', 'verde')
        novoPrj.set('status', 'aguardando_definicao')
        novoPrj.set('modo_execucao', null)
        novoPrj.set('disciplinas', item.disciplina)

        // Prazo final do projeto PRJ criado = data_assinatura + prazo_dias
        try {
          const pDiasContrato = rec.getInt('prazo_dias') || 30
          const dtBaseAssinatura =
            rec.getString('data_assinatura_cliente') ||
            rec.getString('data_assinatura_admin') ||
            new Date().toISOString()
          const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
          dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
          novoPrj.set(
            'prazo_final',
            dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
          )
        } catch (_) {}

        $app.save(novoPrj)
        prjParaItem = novoPrj

        try {
          const aRec = new Record(auditCol)
          aRec.set('acao', 'CRIACAO_PROJETO_ITEM_ESCOPO')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoPrj.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Projeto ' +
              codigoPRJ +
              ' criado para o item de escopo "' +
              item.descricao +
              '" do Contrato ' +
              contratoNumero,
            codigo: codigoPRJ,
            grupo_id: grupoCriado ? grupoCriado.id : null,
            grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            item_descricao: item.descricao,
            item_valor: item.valor,
          })
          $app.save(aRec)
        } catch (errAudPrj) {
          console.log('Erro ao auditar criação de projeto: ' + errAudPrj)
        }
      }

      projetosGerados.push(prjParaItem)

      if (item.record) {
        try {
          item.record.set('status_conversao', 'convertido')
          item.record.set('projeto_gerado', prjParaItem.id)
          $app.save(item.record)
        } catch (_) {}
      }

      // 4. CRIAR ETAPAS E ENTREGÁVEIS PARA ESTE PROJETO ESPECÍFICO (se ainda não existirem)
      try {
        const etapasExistentes = $app.findRecordsByFilter(
          'projeto_etapas',
          "projeto = '" + prjParaItem.id + "'",
          'ordem',
          1,
          0,
        )

        if (etapasExistentes.length === 0) {
          let areaNome = item.disciplina || 'Geral'
          if (item.area) {
            try {
              const areaRec = $app.findRecordById('areas_atuacao', item.area)
              if (areaRec) areaNome = areaRec.getString('nome')
            } catch (_) {}
          }

          const novaEtapa = new Record(etapasCol)
          novaEtapa.set('projeto', prjParaItem.id)
          novaEtapa.set('nome', 'Etapa: ' + (areaNome || item.descricao))
          novaEtapa.set('disciplina', item.disciplina || 'Geral')
          novaEtapa.set('ordem', 1)
          novaEtapa.set('tipo_execucao', 'direta')
          novaEtapa.set('status', 'nao_iniciada')
          novaEtapa.set('custo_estimado', item.custo || 0)

          let desc = 'Subserviços contemplados: '
          if (Array.isArray(item.subservicos) && item.subservicos.length > 0) {
            desc += item.subservicos.join(', ')
          } else {
            desc += 'Serviços técnicos de ' + item.disciplina
          }
          desc += '.\nItem do escopo: ' + item.descricao
          novaEtapa.set('descricao', desc)

          if (item.area) {
            novaEtapa.set('area', item.area)
          }

          $app.save(novaEtapa)

          if (item.record) {
            try {
              item.record.set('etapa_gerada', novaEtapa.id)
              $app.save(item.record)
            } catch (_) {}
          }

          if (item.area) {
            try {
              const entregaveisPadrao = $app.findRecordsByFilter(
                'entregaveis_padrao',
                "area = '" + item.area + "' && ativo = true",
                'ordem',
                30,
                0,
              )
              for (let ep = 0; ep < entregaveisPadrao.length; ep++) {
                try {
                  const novoEntregavel = new Record(entregaveisCol)
                  novoEntregavel.set('etapa', novaEtapa.id)
                  novoEntregavel.set('nome', entregaveisPadrao[ep].getString('nome'))
                  novoEntregavel.set('versao', 'v1.0')
                  novoEntregavel.set('status', 'pendente')
                  novoEntregavel.set(
                    'descricao',
                    entregaveisPadrao[ep].getString('descricao') ||
                      'Entregável técnico padrão da disciplina ' + item.disciplina,
                  )
                  $app.save(novoEntregavel)
                } catch (_) {}
              }
            } catch (_) {}
          }
        }
      } catch (errEtapaPrj) {
        console.log('Erro ao criar etapas para o projeto do item: ' + errEtapaPrj)
      }
    }

    // Retrocompatibilidade: amarrar o primeiro projeto gerado ao contrato
    if (projetosGerados.length > 0) {
      try {
        rec.set('projeto', projetosGerados[0].id)
        $app.save(rec)
      } catch (_) {}
    }

    // 5. CONTAS A RECEBER NO NÍVEL DO CONTRATO/GRUPO (espelho das parcelas com campos canônicos completos)
    try {
      const projetoRefId = projetosGerados.length > 0 ? projetosGerados[0].id : null
      let filtroContas =
        "tipo = 'receber' && (contrato_servico = '" +
        contratoId +
        "' || descricao ~ 'Contrato " +
        contratoNumero +
        "'"
      if (propostaId) {
        filtroContas += " || proposta = '" + propostaId + "'"
      }
      filtroContas += ')'
      const contasExistentes = $app.findRecordsByFilter('contas', filtroContas, '-created', 1, 0)

      if (contasExistentes.length === 0) {
        let parcelas = []
        // Prioridade L1: parcelas_json do próprio contrato
        try {
          const rawParcelasJson = rec.get('parcelas_json')
          if (Array.isArray(rawParcelasJson) && rawParcelasJson.length > 0) {
            parcelas = rawParcelasJson.map((p, idx) => ({
              id: 'json_' + (idx + 1),
              ordem: p.ordem || idx + 1,
              percentual: Number(p.percentual) || 0,
              valor: Number(p.valor) || (valorTotalContrato * (Number(p.percentual) || 0)) / 100,
              descricao:
                p.descricao || 'Parcela ' + (p.ordem || idx + 1) + '/' + rawParcelasJson.length,
              gatilho: p.gatilho || 'marco',
              dias_vencimento: p.dias_vencimento || (idx === 0 ? 15 : (idx + 1) * 30),
            }))
          }
        } catch (_) {}

        // Fallback: proposta_parcelas apenas se parcelas_json vazio
        if (parcelas.length === 0 && propostaId) {
          try {
            const parcsDb = $app.findRecordsByFilter(
              'proposta_parcelas',
              "proposta = '" + propostaId + "'",
              'ordem',
              50,
              0,
            )
            if (parcsDb && parcsDb.length > 0) {
              parcelas = parcsDb.map((p, idx) => ({
                id: p.id,
                ordem: p.getInt('ordem') || idx + 1,
                percentual: p.getFloat('percentual') || 0,
                valor:
                  p.getFloat('valor') ||
                  (valorTotalContrato * (p.getFloat('percentual') || 0)) / 100,
                descricao:
                  p.getString('descricao') ||
                  'Parcela ' + (p.getInt('ordem') || idx + 1) + '/' + parcsDb.length,
                gatilho: p.getString('gatilho') || 'marco',
                dias_vencimento: idx === 0 ? 15 : (idx + 1) * 30,
              }))
            }
          } catch (_) {}
        }

        if (parcelas && parcelas.length > 0) {
          for (let i = 0; i < parcelas.length; i++) {
            const parc = parcelas[i]
            const ordem =
              typeof parc.ordem === 'number'
                ? parc.ordem
                : parc.getInt
                  ? parc.getInt('ordem')
                  : i + 1
            const perc =
              typeof parc.percentual === 'number'
                ? parc.percentual
                : parc.getFloat
                  ? parc.getFloat('percentual')
                  : 0
            const valorParc =
              typeof parc.valor === 'number'
                ? parc.valor
                : parc.getFloat
                  ? parc.getFloat('valor')
                  : (valorTotalContrato * perc) / 100
            const descParc =
              typeof parc.descricao === 'string'
                ? parc.descricao
                : parc.getString
                  ? parc.getString('descricao')
                  : 'Parcela ' + ordem + '/' + parcelas.length
            const gatilho =
              typeof parc.gatilho === 'string'
                ? parc.gatilho
                : parc.getString
                  ? parc.getString('gatilho')
                  : 'marco'

            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoRefId) novaConta.set('projeto', projetoRefId)
            if (propostaId) novaConta.set('proposta', propostaId)
            if (contratoId) novaConta.set('contrato_servico', contratoId)
            novaConta.set(
              'descricao',
              'Contrato ' +
                contratoNumero +
                ' — Parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ' (' +
                perc +
                '% - ' +
                descParc +
                ')' +
                (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorParc)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNotaProposta && aliquotaImpostos > 0) {
              const retencao =
                Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorParc)
            }

            const diasVenc = i === 0 ? 15 : (i + 1) * 30
            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + diasVenc)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            try {
              $app.save(novaConta)
            } catch (errSaveConta) {
              console.log('ERRO CRÍTICO ao salvar conta a receber de parcela: ' + errSaveConta)
              throw errSaveConta
            }

            try {
              const aRec = new Record(auditCol)
              aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Conta a receber da parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' gerada por assinatura do Contrato ' +
                  contratoNumero,
                ordem: ordem,
                percentual: perc,
                valor: valorParc,
                gatilho: gatilho,
                projeto_id: projetoRefId,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        } else {
          const novaConta = new Record(contasCol)
          novaConta.set('tipo', 'receber')
          if (projetoRefId) novaConta.set('projeto', projetoRefId)
          if (propostaId) novaConta.set('proposta', propostaId)
          if (contratoId) novaConta.set('contrato_servico', contratoId)
          novaConta.set(
            'descricao',
            'Recebimento integral do Contrato Assinado ' +
              contratoNumero +
              (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
          )
          novaConta.set('valor', valorTotalContrato)
          novaConta.set('status', 'rascunho')
          novaConta.set('forma_pagamento', condicoesPagamento)
          novaConta.set('bloqueada_por_fechamento', false)

          if (requerNotaProposta && aliquotaImpostos > 0) {
            const retencao =
              Math.round(
                ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
              ) / 100
            novaConta.set('retencao_impostos', retencao)
            novaConta.set('valor_liquido', Math.round((valorTotalContrato - retencao) * 100) / 100)
          } else {
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorTotalContrato)
          }

          const dataVenc = new Date()
          dataVenc.setDate(dataVenc.getDate() + 30)
          novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

          try {
            $app.save(novaConta)
          } catch (errSaveConta) {
            console.log('ERRO CRÍTICO ao salvar conta a receber integral: ' + errSaveConta)
            throw errSaveConta
          }

          try {
            const aRec = new Record(auditCol)
            aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
            aRec.set('entidade', 'contas')
            aRec.set('registro_id', novaConta.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
              valor: valorTotalContrato,
              projeto_id: projetoRefId,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (errContas) {
      console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
    }

    // Auditoria geral de ativação do Bloco 4
    try {
      const aRec = new Record(auditCol)
      aRec.set('acao', 'ATIVACAO_BLOCO4_CONTRATO_ASSINADO')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contratoId)
      aRec.set('detalhes', {
        origem: 'SISTEMA / GATILHO AUTOMÁTICO',
        mensagem:
          'Contrato ' +
          contratoNumero +
          ' assinado bilateralmente. 1 Grupo de Projetos (' +
          (grupoCriado ? grupoCriado.getString('codigo') : 'GPR') +
          ') e ' +
          projetosGerados.length +
          ' projeto(s) gerado(s) com sucesso.',
        contrato_numero: contratoNumero,
        grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
        total_projetos: projetosGerados.length,
        codigos_projetos: projetosGerados.map((p) => p.getString('codigo')),
        valor_total: valorTotalContrato,
      })
      $app.save(aRec)
    } catch (_) {}

    // Promoção do pré-cadastro e conversão em parceiro no funil
    if (empresaId) {
      try {
        const empresa = $app.findRecordById('empresas', empresaId)
        if (empresa) {
          const etapaAtual = empresa.getString('etapa_funil')
          const eraPreCadastro = empresa.getBool('pre_cadastro')

          let houveMudanca = false
          if (eraPreCadastro) {
            empresa.set('pre_cadastro', false)
            houveMudanca = true
          }

          if (etapaAtual !== 'parceira') {
            empresa.set('etapa_anterior', etapaAtual)
            empresa.set('etapa_funil', 'parceira')
            empresa.set('status', 'ativa')
            houveMudanca = true
          }

          if (houveMudanca) {
            empresa.set(
              'observacoes',
              (empresa.getString('observacoes') || '') +
                '\n[Efetivação por Contrato Assinado]: Contrato ' +
                contratoNumero +
                ' assinado em ' +
                new Date().toISOString() +
                (eraPreCadastro ? ' (pré-cadastro promovido a definitivo)' : ''),
            )
            $app.save(empresa)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('acao', 'CONVERSAO_PARCEIRO')
              aRec.set('entidade', 'empresas')
              aRec.set('registro_id', empresaId)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Empresa convertida para Parceira pela assinatura do Contrato ' + contratoNumero,
                contrato_numero: contratoNumero,
                proposta_numero: propostaNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (errEmp) {
        console.log('Erro ao converter empresa em parceira por contrato: ' + errEmp)
      }
    }

    if (clientePfId) {
      try {
        const clientePf = $app.findRecordById('clientes_pf', clientePfId)
        if (clientePf && clientePf.getBool('pre_cadastro')) {
          clientePf.set('pre_cadastro', false)
          clientePf.set(
            'observacoes',
            (clientePf.getString('observacoes') || '') +
              '\n[Efetivação por Contrato Assinado]: Contrato ' +
              contratoNumero +
              ' assinado em ' +
              new Date().toISOString() +
              ' (promovido a cliente definitivo)',
          )
          $app.save(clientePf)

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'PROMOCAO_CLIENTE_CONTRATO')
            aRec.set('entidade', 'clientes_pf')
            aRec.set('registro_id', clientePfId)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              tipo: 'pf',
              mensagem:
                'Cliente PF promovido de pré-cadastro a definitivo pela assinatura do Contrato ' +
                contratoNumero,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errPf) {
        console.log('Erro ao promover cliente PF por contrato: ' + errPf)
      }
    }
  }
})
