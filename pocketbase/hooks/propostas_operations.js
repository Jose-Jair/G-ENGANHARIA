// Hook to handle automatic numbering for Propostas (PROP-AAAA-NNNN),
// Projetos (PRJ-AAAA-NNNN), Contratos de Serviço (CTR-AAAA-NNNN),
// Revisions (Rev.00, Rev.01, etc.), token_aceite generation,
// and the consequences of Proposal Acceptance and Contract Signing:
//
// NOVO FLUXO APROVADO:
// 1. Proposta ACEITA:
//    - Gera CONTRATO DE SERVIÇOS (CTR-AAAA-NNNN) com status 'aguardando_assinatura_admin'
//    - Registra auditoria do aceite
//    - NÃO gera projeto nem conta a receber aqui (movidos para a assinatura do contrato)
// 2. Contrato de Serviço ASSINADO (ambas as partes assinaram):
//    - GERA PROJETO (PRJ-AAAA-NNNN)
//    - GERA CONTAS A RECEBER (a partir das parcelas da proposta)
//    - Converte Empresa em Parceira / Promove pré-cadastro

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
      if (newStatus === 'aguardando_assinatura_admin') {
        rec.set('status', 'aguardando_assinatura_cliente')
      }
    }

    // Quando cliente assina e admin já assinou -> status vira 'assinado'
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
// 1. Proposta virou 'aceita': GERA CONTRATO DE SERVIÇOS (aguardando assinatura admin)
// 2. Contrato de Serviço virou 'assinado': GERA PROJETO + CONTAS A RECEBER + PROMOÇÃO
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  const colName = rec.collection().name

  // =========================================================================
  // CASO 1: PROPOSTA ACEITA -> GERA CONTRATO DE SERVIÇOS
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

        // Verificar se já existe contrato para esta proposta
        const contratosExistentes = $app.findRecordsByFilter(
          'contratos_servico',
          "proposta = '" + propostaId + "'",
          '-created',
          1,
          0,
        )

        let contratoCriado = null
        if (contratosExistentes.length === 0) {
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
      } catch (errContrato) {
        console.log('Erro ao gerar contrato de serviços após aceite da proposta: ' + errContrato)
      }
    }
  }

  // =========================================================================
  // CASO 2: CONTRATO DE SERVIÇO ASSINADO -> GERA PROJETO + CONTAS + PROMOÇÃO
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

      // 1. CRIAR PROJETO COM CÓDIGO PRJ-AAAA-NNNN SEQUENCIAL
      let projetoCriadoId = null
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
        if (empresaId) novoProjeto.set('empresa', empresaId)
        if (clientePfId) novoProjeto.set('cliente_pf', clientePfId)
        novoProjeto.set('valor_total', preco)
        novoProjeto.set('subcontratacao_autorizada', true)
        novoProjeto.set('saude', 'verde')
        novoProjeto.set('status', 'em_andamento')

        $app.save(novoProjeto)
        projetoCriadoId = novoProjeto.id

        // Auditoria de criação do projeto
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'CRIACAO_AUTOMATICA_PROJETO')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoProjeto.id)
          aRec.set('detalhes', {
            mensagem:
              'Projeto gerado automaticamente por assinatura do Contrato ' +
              contratoNumero +
              ' (Proposta ' +
              propostaNumero +
              ')',
            codigo: novoCodigo,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            proposta_id: propostaId,
          })
          $app.save(aRec)
        } catch (_) {}
      } catch (errProj) {
        console.log('Erro ao criar projeto a partir de contrato assinado: ' + errProj)
      }

      // 2. CRIAR CONTA(S) A RECEBER EM RASCUNHO A PARTIR DAS PARCELAS
      try {
        const contasCol = $app.findCollectionByNameOrId('contas')
        const auditCol = $app.findCollectionByNameOrId('audit_logs')

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
            const descParc = parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
            const gatilho = parc.getString('gatilho') || 'marco'

            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoCriadoId) novaConta.set('projeto', projetoCriadoId)
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
          if (projetoCriadoId) novaConta.set('projeto', projetoCriadoId)
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
          novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

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
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errContas) {
        console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
      }

      // 3. PROMOÇÃO DO PRÉ-CADASTRO E CONVERSÃO EM PARCEIRO NO FUNIL
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
