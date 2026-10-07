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
    // Se a proposta já estiver nascendo aprovada ou com status posterior a rascunho/aprovacao_interna
    const statusCriado = rec.getString('status') || 'rascunho'
    if (
      statusCriado !== 'rascunho' &&
      statusCriado !== 'aprovacao_interna' &&
      !rec.getString('token_aceite')
    ) {
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

    // PORTÃO DE VALIDAÇÃO: Quando a proposta for validada/aprovada (ex: vira 'enviada'),
    // se ainda não possuir token_aceite, gera agora!
    if (
      newStatus !== 'rascunho' &&
      newStatus !== 'aprovacao_interna' &&
      !rec.getString('token_aceite')
    ) {
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
  const rec = e.record
  const colName = rec.collection().name

  // =========================================================================
  // CASO 1: PROPOSTA ACEITA -> GERA CONTRATO CTR + PROJETO PRJ EM "CONTRATAÇÃO"
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
            aRec.set('detalhes', {
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

        // 1.2 CRIAR PROJETO IMEDIATAMENTE EM STATUS "contratacao" (SEM ETAPAS, SEM CONTAS)
        // Trava de idempotência: verificar se projeto para esta proposta já existe
        const projetosExistentes = $app.findRecordsByFilter(
          'projetos',
          "proposta = '" + propostaId + "'",
          '-created',
          1,
          0,
        )

        let projetoCriado = null
        if (projetosExistentes.length > 0) {
          projetoCriado = projetosExistentes[0]
          // Garantir amarração mútua com o contrato se ainda faltar
          let salvarPrj = false
          if (!projetoCriado.getString('contrato_servico') && contratoCriado) {
            projetoCriado.set('contrato_servico', contratoCriado.id)
            salvarPrj = true
          }
          if (salvarPrj) {
            $app.save(projetoCriado)
          }
          if (contratoCriado && !contratoCriado.getString('projeto')) {
            contratoCriado.set('projeto', projetoCriado.id)
            $app.save(contratoCriado)
          }
        } else {
          const projetosCol = $app.findCollectionByNameOrId('projetos')
          const anoAtual = new Date().getFullYear()
          const prefixo = 'PRJ-' + anoAtual + '-'

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
          const novoCodigo = prefixo + seqStr

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

          const contratoNumero = contratoCriado ? contratoCriado.getString('numero') : ''

          const novoProjeto = new Record(projetosCol)
          novoProjeto.set('codigo', novoCodigo)
          novoProjeto.set(
            'nome',
            'Projeto: ' + (contratoNumero || propostaNumero) + ' — ' + nomeCliente,
          )
          novoProjeto.set('descricao', objeto)
          novoProjeto.set('proposta', propostaId)
          if (contratoCriado) {
            novoProjeto.set('contrato_servico', contratoCriado.id)
          }
          if (empresaId) novoProjeto.set('empresa', empresaId)
          if (clientePfId) novoProjeto.set('cliente_pf', clientePfId)
          novoProjeto.set('valor_total', preco)
          novoProjeto.set('subcontratacao_autorizada', true)
          novoProjeto.set('saude', 'verde')
          novoProjeto.set('status', 'contratacao') // Novo status: Em Contratação (pendente de assinaturas)

          $app.save(novoProjeto)
          projetoCriado = novoProjeto

          // Atualizar o contrato com o vínculo do projeto
          if (contratoCriado) {
            try {
              contratoCriado.set('projeto', novoProjeto.id)
              $app.save(contratoCriado)
            } catch (_) {}
          }

          // Auditoria de criação do projeto em contratação
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'CRIACAO_PROJETO_CONTRATACAO')
            aRec.set('entidade', 'projetos')
            aRec.set('registro_id', novoProjeto.id)
            aRec.set('detalhes', {
              mensagem:
                'Projeto criado em status "Contratação" pelo aceite da Proposta ' +
                propostaNumero +
                ' (aguardando assinatura bilateral do Contrato ' +
                contratoNumero +
                ')',
              codigo: novoCodigo,
              status: 'contratacao',
              contrato_id: contratoCriado ? contratoCriado.id : null,
              contrato_numero: contratoNumero,
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
  // CASO 2: CONTRATO DE SERVIÇO ASSINADO -> ATIVA PROJETO EXISTENTE + ETAPAS + CONTAS + PROMOÇÃO
  // =========================================================================
  if (colName === 'contratos_servico') {
    const original = rec.original()
    const oldStatus = original ? original.getString('status') : ''
    const newStatus = rec.getString('status')

    if (newStatus === 'assinado' && oldStatus !== 'assinado') {
      const contratoId = rec.id
      const contratoNumero = rec.getString('numero')
      const propostaId = rec.getString('proposta')
      const empresaId = rec.getString('empresa')
      const clientePfId = rec.getString('cliente_pf')
      const preco = rec.getFloat('valor_total') || 0

      // LOCALIZAR PROJETO EXISTENTE (criado no aceite da proposta ou vinculado ao contrato)
      let projetoAtivo = null

      if (rec.getString('projeto')) {
        try {
          projetoAtivo = $app.findRecordById('projetos', rec.getString('projeto'))
        } catch (_) {}
      }

      if (!projetoAtivo && propostaId) {
        try {
          const projetosExistentes = $app.findRecordsByFilter(
            'projetos',
            "proposta = '" + propostaId + "'",
            '-created',
            1,
            0,
          )
          if (projetosExistentes.length > 0) {
            projetoAtivo = projetosExistentes[0]
          }
        } catch (_) {}
      }

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
        } catch (_) {}
      }

      // Se por algum motivo o projeto ainda não existia (ex: contrato criado manualmente ou pré-migração),
      // cria-o agora com segurança
      if (!projetoAtivo) {
        try {
          const projetosCol = $app.findCollectionByNameOrId('projetos')
          const anoAtual = new Date().getFullYear()
          const prefixo = 'PRJ-' + anoAtual + '-'

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
          const novoCodigo = prefixo + seqStr

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

          const novoProjeto = new Record(projetosCol)
          novoProjeto.set('codigo', novoCodigo)
          novoProjeto.set('nome', 'Projeto: ' + contratoNumero + ' — ' + nomeCliente)
          novoProjeto.set('descricao', rec.getString('objeto'))
          if (propostaId) novoProjeto.set('proposta', propostaId)
          novoProjeto.set('contrato_servico', contratoId)
          if (empresaId) novoProjeto.set('empresa', empresaId)
          if (clientePfId) novoProjeto.set('cliente_pf', clientePfId)
          novoProjeto.set('valor_total', preco)
          novoProjeto.set('subcontratacao_autorizada', true)
          novoProjeto.set('saude', 'verde')
          novoProjeto.set('status', 'em_andamento')

          $app.save(novoProjeto)
          projetoAtivo = novoProjeto
        } catch (errCriarFallback) {
          console.log('Erro ao criar projeto fallback na assinatura: ' + errCriarFallback)
        }
      }

      if (projetoAtivo) {
        const projetoId = projetoAtivo.id
        const projetoCodigo = projetoAtivo.getString('codigo')

        // 1. ATIVAR PROJETO: mudar status de "contratacao" para "em_andamento"
        try {
          let mudouProjeto = false
          if (
            projetoAtivo.getString('status') === 'contratacao' ||
            !projetoAtivo.getString('status')
          ) {
            projetoAtivo.set('status', 'em_andamento')
            mudouProjeto = true
          }
          if (!projetoAtivo.getString('contrato_servico')) {
            projetoAtivo.set('contrato_servico', contratoId)
            mudouProjeto = true
          }
          if (mudouProjeto) {
            $app.save(projetoAtivo)
          }

          // Vincular no contrato caso ainda falte
          if (rec.getString('projeto') !== projetoId) {
            rec.set('projeto', projetoId)
            $app.save(rec)
          }

          // Auditoria de ativação do projeto
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'ATIVACAO_PROJETO_CONTRATO_ASSINADO')
            aRec.set('entidade', 'projetos')
            aRec.set('registro_id', projetoId)
            aRec.set('detalhes', {
              mensagem:
                'Projeto ' +
                projetoCodigo +
                ' ativado com sucesso após assinatura bilateral do Contrato ' +
                contratoNumero,
              codigo: projetoCodigo,
              status_anterior: 'contratacao',
              novo_status: 'em_andamento',
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
              proposta_id: propostaId,
              proposta_numero: propostaNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        } catch (errAtivacao) {
          console.log('Erro ao ativar status do projeto: ' + errAtivacao)
        }

        // 2. GERAR ETAPAS E ENTREGÁVEIS (se ainda não foram gerados - trava de idempotência)
        try {
          const etapasExistentes = $app.findRecordsByFilter(
            'projeto_etapas',
            "projeto = '" + projetoId + "'",
            'ordem',
            1,
            0,
          )

          if (etapasExistentes.length === 0) {
            let itensProposta = []
            if (propostaId) {
              try {
                itensProposta = $app.findRecordsByFilter(
                  'proposta_itens',
                  "proposta = '" + propostaId + "'",
                  'created',
                  100,
                  0,
                )
              } catch (_) {}
            }

            const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
            const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')

            if (itensProposta && itensProposta.length > 0) {
              // Agrupar itens por disciplina/área
              const gruposPorArea = {}
              for (let i = 0; i < itensProposta.length; i++) {
                const item = itensProposta[i]
                const areaId = item.getString('area')
                const disc = item.getString('disciplina') || 'Geral'
                const chave = areaId || disc

                if (!gruposPorArea[chave]) {
                  let areaNome = disc
                  if (areaId) {
                    try {
                      const areaRec = $app.findRecordById('areas_atuacao', areaId)
                      if (areaRec) areaNome = areaRec.getString('nome')
                    } catch (_) {}
                  }

                  gruposPorArea[chave] = {
                    areaId: areaId || null,
                    nome: 'Etapa: ' + areaNome,
                    disciplina: disc,
                    custo: 0,
                    itens: [],
                    subservicos: [],
                  }
                }

                gruposPorArea[chave].custo += item.getFloat('custo_total') || 0
                gruposPorArea[chave].itens.push(item)

                // Subserviços
                try {
                  const subs = item.get('subservicos')
                  if (Array.isArray(subs)) {
                    for (let s = 0; s < subs.length; s++) {
                      if (subs[s] && gruposPorArea[chave].subservicos.indexOf(subs[s]) === -1) {
                        gruposPorArea[chave].subservicos.push(subs[s])
                      }
                    }
                  }
                } catch (_) {}
              }

              let ordemIndex = 1
              const chaves = Object.keys(gruposPorArea)
              for (let k = 0; k < chaves.length; k++) {
                const g = gruposPorArea[chaves[k]]
                const novaEtapa = new Record(etapasCol)

                novaEtapa.set('projeto', projetoId)
                novaEtapa.set('nome', g.nome)
                novaEtapa.set('disciplina', g.disciplina)
                novaEtapa.set('ordem', ordemIndex++)
                novaEtapa.set('tipo_execucao', 'direta') // valores válidos: direta | terceirizada | mista
                novaEtapa.set('status', 'nao_iniciada')
                novaEtapa.set('custo_estimado', g.custo)

                let desc = 'Subserviços contemplados: '
                if (g.subservicos.length > 0) {
                  desc += g.subservicos.join(', ')
                } else {
                  desc += 'Serviços técnicos gerais'
                }
                desc +=
                  '.\nItens da proposta: ' +
                  g.itens.map((it) => it.getString('descricao')).join('; ')
                novaEtapa.set('descricao', desc)

                // SANITIZAÇÃO ESTRITA: só atribui 'area' se existir registro válido, NUNCA string vazia ""
                if (g.areaId) {
                  novaEtapa.set('area', g.areaId)
                }

                $app.save(novaEtapa)

                // Atualizar vínculo dos itens da proposta com a etapa e o projeto
                for (let itIdx = 0; itIdx < g.itens.length; itIdx++) {
                  try {
                    const itemRec = g.itens[itIdx]
                    itemRec.set('status_conversao', 'convertido')
                    itemRec.set('projeto_gerado', projetoId)
                    itemRec.set('etapa_gerada', novaEtapa.id)
                    $app.save(itemRec)
                  } catch (_) {}
                }

                // Pré-popular entregáveis padrão da área se existirem
                if (g.areaId) {
                  try {
                    const entregaveisPadrao = $app.findRecordsByFilter(
                      'entregaveis_padrao',
                      "area = '" + g.areaId + "' && ativo = true",
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
                            'Entregável técnico padrão da disciplina ' + g.disciplina,
                        )
                        $app.save(novoEntregavel)
                      } catch (_) {}
                    }
                  } catch (_) {}
                }
              }
            } else {
              // Proposta sem itens avulsos cadastrados -> cria ao menos 1 etapa geral
              const novaEtapa = new Record(etapasCol)
              novaEtapa.set('projeto', projetoId)
              novaEtapa.set('nome', 'Etapa 01: Serviços Técnicos e Projetos')
              novaEtapa.set(
                'disciplina',
                propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
              )
              novaEtapa.set('ordem', 1)
              novaEtapa.set('tipo_execucao', 'direta')
              novaEtapa.set('status', 'nao_iniciada')
              novaEtapa.set('custo_estimado', preco)
              novaEtapa.set(
                'descricao',
                rec.getString('objeto') || 'Desenvolvimento do escopo técnico contratado',
              )
              $app.save(novaEtapa)
            }
          }
        } catch (errEtapas) {
          console.log('Erro ao pré-popular etapas do projeto: ' + errEtapas)
        }

        // 3. GERAR CONTAS A RECEBER (se ainda não geradas para o projeto - trava de idempotência)
        try {
          const contasCol = $app.findCollectionByNameOrId('contas')
          const auditCol = $app.findCollectionByNameOrId('audit_logs')

          const contasExistentes = $app.findRecordsByFilter(
            'contas',
            "projeto = '" + projetoId + "'",
            '-created',
            1,
            0,
          )

          if (contasExistentes.length === 0) {
            let parcelas = []
            if (propostaId) {
              try {
                parcelas = $app.findRecordsByFilter(
                  'proposta_parcelas',
                  "proposta = '" + propostaId + "'",
                  'ordem',
                  50,
                  0,
                )
              } catch (_) {}
            }

            if (parcelas && parcelas.length > 0) {
              for (let i = 0; i < parcelas.length; i++) {
                const parc = parcelas[i]
                const ordem = parc.getInt('ordem') || i + 1
                const perc = parc.getFloat('percentual') || 0
                const valorParc = parc.getFloat('valor') || (preco * perc) / 100
                const descParc =
                  parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
                const gatilho = parc.getString('gatilho') || 'marco'

                const novaConta = new Record(contasCol)
                novaConta.set('tipo', 'receber')
                novaConta.set('projeto', projetoId)
                if (propostaId) novaConta.set('proposta', propostaId)
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
                    Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) /
                    100
                  novaConta.set('retencao_impostos', retencao)
                  novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
                } else {
                  novaConta.set('retencao_impostos', 0)
                  novaConta.set('valor_liquido', valorParc)
                }

                const diasVenc = i === 0 ? 15 : (i + 1) * 30
                const dataVenc = new Date()
                dataVenc.setDate(dataVenc.getDate() + diasVenc)
                novaConta.set(
                  'vencimento',
                  dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                )

                $app.save(novaConta)

                try {
                  const aRec = new Record(auditCol)
                  aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
                  aRec.set('entidade', 'contas')
                  aRec.set('registro_id', novaConta.id)
                  aRec.set('detalhes', {
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
                    projeto_id: projetoId,
                    contrato_id: contratoId,
                    contrato_numero: contratoNumero,
                  })
                  $app.save(aRec)
                } catch (_) {}
              }
            } else {
              // Fallback: criar conta única
              const novaConta = new Record(contasCol)
              novaConta.set('tipo', 'receber')
              novaConta.set('projeto', projetoId)
              if (propostaId) novaConta.set('proposta', propostaId)
              novaConta.set(
                'descricao',
                'Recebimento integral do Contrato Assinado ' +
                  contratoNumero +
                  (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
              )
              novaConta.set('valor', preco)
              novaConta.set('status', 'rascunho')
              novaConta.set('forma_pagamento', condicoesPagamento)
              novaConta.set('bloqueada_por_fechamento', false)

              if (requerNotaProposta && aliquotaImpostos > 0) {
                const retencao =
                  Math.round(((preco * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
                novaConta.set('retencao_impostos', retencao)
                novaConta.set('valor_liquido', Math.round((preco - retencao) * 100) / 100)
              } else {
                novaConta.set('retencao_impostos', 0)
                novaConta.set('valor_liquido', preco)
              }

              const dataVenc = new Date()
              dataVenc.setDate(dataVenc.getDate() + 30)
              novaConta.set(
                'vencimento',
                dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )

              $app.save(novaConta)

              try {
                const aRec = new Record(auditCol)
                aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
                aRec.set('entidade', 'contas')
                aRec.set('registro_id', novaConta.id)
                aRec.set('detalhes', {
                  mensagem:
                    'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
                  valor: preco,
                  projeto_id: projetoId,
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
      }

      // 4. PROMOÇÃO DO PRÉ-CADASTRO E CONVERSÃO EM PARCEIRO NO FUNIL
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
                aRec.set('acao', 'CONVERSAO_EM_PARCEIRA')
                aRec.set('entidade', 'empresas')
                aRec.set('registro_id', empresaId)
                aRec.set('detalhes', {
                  mensagem:
                    'Empresa convertida para Parceira pela assinatura do Contrato ' +
                    contratoNumero,
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
  }
})
