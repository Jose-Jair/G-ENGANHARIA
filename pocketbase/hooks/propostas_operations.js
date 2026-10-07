// Hook to handle automatic numbering for Propostas (PROP-AAAA-NNNN) and Projetos (PRJ-AAAA-NNNN)
// revisions (R00, R01, etc.), token_aceite generation,
// automatic expiration checks, and the triple consequences of proposal acceptance:
// 1. Creation of Projeto (PRJ-AAAA-NNNN)
// 2. Creation of Conta a Receber (rascunho)
// 3. Conversion of Empresa to "parceira" (if PJ) or link to Cliente PF

onRecordCreate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'propostas') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'PROP-' + anoAtual + '-'

    let numeroExistente = rec.getString('numero')
    if (!numeroExistente || !numeroExistente.startsWith(prefixo)) {
      try {
        // Encontrar maior sequencial do ano
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

    if (!rec.getString('token_aceite')) {
      rec.set('token_aceite', $security.randomString(32))
    }

    if (!rec.getString('status')) {
      rec.set('status', 'rascunho')
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

// Hook onRecordUpdate for propostas:
// Check revisions, check approval rules, check acceptance and dispatch triple consequences
onRecordUpdate((e) => {
  const rec = e.record
  if (rec.collection().name !== 'propostas') {
    e.next()
    return
  }

  const original = rec.original()
  const oldStatus = original ? original.getString('status') : ''
  const newStatus = rec.getString('status')

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

  e.next()
})

// After update success: if proposal just became 'aceita', execute the TRÍPLICE CONSEQUÊNCIA
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name !== 'propostas') {
    return
  }

  const original = rec.original()
  const oldStatus = original ? original.getString('status') : ''
  const newStatus = rec.getString('status')

  if (newStatus === 'aceita' && oldStatus !== 'aceita') {
    const propostaId = rec.id
    const propostaNumero = rec.getString('numero')
    const empresaId = rec.getString('empresa')
    const clientePfId = rec.getString('cliente_pf')
    const contratoId = rec.getString('contrato')
    const preco = rec.getFloat('preco') || 0
    const condicoesPagamento = rec.getString('condicoes_pagamento') || 'Conforme proposta aceita'

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

      const novoProjeto = new Record(projetosCol)
      novoProjeto.set('codigo', novoCodigo)
      novoProjeto.set('proposta', propostaId)
      if (contratoId) {
        novoProjeto.set('contrato', contratoId)
      }
      novoProjeto.set('subcontratacao_autorizada', true)
      novoProjeto.set('saude', 'verde')
      novoProjeto.set('status', 'em_andamento')
      $app.save(novoProjeto)
      projetoCriadoId = novoProjeto.id

      // Auditoria da criação do projeto
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'CRIACAO_AUTOMATICA_PROJETO')
        aRec.set('entidade', 'projetos')
        aRec.set('registro_id', novoProjeto.id)
        aRec.set('detalhes', {
          mensagem: 'Projeto gerado automaticamente por aceite da proposta ' + propostaNumero,
          codigo: novoCodigo,
          proposta_id: propostaId,
        })
        $app.save(aRec)
      } catch (_) {}
    } catch (err) {
      console.log('Erro ao criar projeto a partir de proposta aceita: ' + err)
    }

    // 2. CRIAR CONTA A RECEBER EM RASCUNHO NA COLEÇÃO CONTAS
    try {
      const contasCol = $app.findCollectionByNameOrId('contas')
      const novaConta = new Record(contasCol)
      const requerNotaProposta = rec.getBool('requer_nota')
      const aliquotaImpostos = rec.getInt('impostos') || 0

      novaConta.set('tipo', 'receber')
      if (projetoCriadoId) {
        novaConta.set('projeto', projetoCriadoId)
      }
      novaConta.set('proposta', propostaId)
      novaConta.set(
        'descricao',
        'Recebimento de Proposta Aceita ' +
          propostaNumero +
          (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
      )
      novaConta.set('valor', preco)
      novaConta.set('status', 'rascunho')
      novaConta.set('forma_pagamento', condicoesPagamento)
      novaConta.set('bloqueada_por_fechamento', false)

      // Se requer nota fiscal e tem impostos informados, calcular retenção e líquido
      if (requerNotaProposta && aliquotaImpostos > 0) {
        const retencao =
          Math.round(((preco * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
        novaConta.set('retencao_impostos', retencao)
        novaConta.set('valor_liquido', Math.round((preco - retencao) * 100) / 100)
      } else {
        novaConta.set('retencao_impostos', 0)
        novaConta.set('valor_liquido', preco)
      }

      // Vencimento padrão: +30 dias a partir de hoje
      const dataVenc = new Date()
      dataVenc.setDate(dataVenc.getDate() + 30)
      novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

      $app.save(novaConta)

      // Auditoria da criação da conta
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
        aRec.set('entidade', 'contas')
        aRec.set('registro_id', novaConta.id)
        aRec.set('detalhes', {
          mensagem:
            'Conta a receber em rascunho gerada por aceite da proposta ' +
            propostaNumero +
            (requerNotaProposta ? ' (com exigência de NF)' : ' (sem exigência de NF)'),
          valor: preco,
          requer_nota: requerNotaProposta,
          proposta_id: propostaId,
        })
        $app.save(aRec)
      } catch (_) {}
    } catch (err) {
      console.log('Erro ao gerar conta a receber: ' + err)
    }

    // 3. CONVERSÃO DO PROSPECT EM PARCEIRO NO FUNIL (se empresa PJ)
    if (empresaId) {
      try {
        const empresa = $app.findRecordById('empresas', empresaId)
        if (empresa) {
          const etapaAtual = empresa.getString('etapa_funil')
          if (etapaAtual !== 'parceira') {
            empresa.set('etapa_anterior', etapaAtual)
            empresa.set('etapa_funil', 'parceira')
            empresa.set('status', 'ativa')
            empresa.set(
              'observacoes',
              (empresa.getString('observacoes') || '') +
                '\n[Conversão em Parceira]: Proposta ' +
                propostaNumero +
                ' aceita em ' +
                new Date().toISOString(),
            )
            $app.save(empresa)

            // Auditoria específica da conversão
            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('acao', 'CONVERSAO_EM_PARCEIRA')
              aRec.set('entidade', 'empresas')
              aRec.set('registro_id', empresaId)
              aRec.set('detalhes', {
                mensagem:
                  'Empresa convertida para Parceira pelo aceite da proposta ' + propostaNumero,
                etapa_anterior: etapaAtual,
                proposta_numero: propostaNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (err) {
        console.log('Erro ao converter empresa em parceira: ' + err)
      }
    }
  }
})
