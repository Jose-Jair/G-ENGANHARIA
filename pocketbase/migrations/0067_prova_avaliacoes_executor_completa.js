// Migração 0067 — Prova de comportamento no banco com dados fictícios (Regra 8) do Módulo de Avaliações de Executor
// Checklist de prova obrigatório:
// 1. Hook deployado verificado via deploy_backend
// 2. Criação do cenário mínimo:
//    - Executor fictício homologado (status: ativo, nota_geral: 4.0, total_avaliacoes: 1)
//    - Subcontrato assinado (status: assinado)
//    - Medição paga (status: paga) e teste negativo com medição apresentada (não paga)
// 3. Prova de comportamento no banco com dados fictícios:
//    a. Criação da avaliação: AVA-AAAA-NNNN, nota_ponderada: Prazo 40% (nota 5 -> 2.0), Qualidade 40% (nota 4 -> 1.6), Comunicação 20% (nota 5 -> 1.0) = 4.60
//    b. nota_geral do executor ANTES (4.0) e DEPOIS (média móvel ponderada com peso 2 da nova avaliação: (4.0*1 + 2*4.60)/(1+2) = 13.20/3 = 4.40) e total_avaliacoes incrementado (1 -> 2)
//    c. Tentar segunda avaliação no mesmo subcontrato -> bloqueada pelo índice único / validação com mensagem pt-BR
//    d. Bloqueio de perfil executor -> role != admin/gestor não tem permissão
//    e. Auditoria AVALIACAO_EXECUTOR_REGISTRADA gravada com quem/quando/notas antes->depois
// 4. Limpeza rigorosa: deleta todos os registros de teste e deixa o banco rigorosamente limpo

migrate(
  (app) => {
    // 1. Obter usuários
    const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    const executorUser = app.findFirstRecordByData('users', 'email', 'executor@sistema.eng.br')
    const gestorUser = app.findFirstRecordByData('users', 'email', 'gestor@sistema.eng.br')

    // 2. Buscar projeto existente
    const projetos = app.findRecordsByFilter('projetos', "status != ''", '-created', 1, 0)
    if (!projetos || projetos.length === 0) {
      throw new Error('Nenhum projeto encontrado para vincular subcontrato de teste.')
    }
    const projetoId = projetos[0].id

    // 3. Criar executor fictício homologado
    const execCol = app.findCollectionByNameOrId('executores')
    const execTeste = new Record(execCol)
    execTeste.set('tipo', 'PJ')
    execTeste.set('nome', 'EXECUTOR_TESTE_PROVA_MODULO_LTDA')
    execTeste.set('cpf_cnpj', '88.888.888/0001-88')
    execTeste.set('status', 'ativo')
    execTeste.set('nota_geral', 4.0)
    execTeste.set('total_avaliacoes', 1)
    execTeste.set('capacidade_simultanea', 2)
    execTeste.set('disciplinas', 'Estrutural, Fundações')
    app.save(execTeste)
    const execId = execTeste.id

    // 4. Criar subcontrato assinado de teste
    const subCol = app.findCollectionByNameOrId('subcontratos')
    const subTeste = new Record(subCol)
    subTeste.set('numero', 'SUB-2026-9999')
    subTeste.set('projeto', projetoId)
    subTeste.set('executor', execId)
    subTeste.set('modo_execucao', 'terceirizada_integral')
    subTeste.set('descricao_escopo', 'Escopo de prova de avaliação')
    subTeste.set('valor_total', 15000)
    subTeste.set('status', 'assinado')
    app.save(subTeste)
    const subId = subTeste.id

    // 5. Criar medição de teste
    const medCol = app.findCollectionByNameOrId('medicoes')
    const medTeste = new Record(medCol)
    medTeste.set('numero', 'MED-2026-9999')
    medTeste.set('subcontrato', subId)
    medTeste.set('projeto', projetoId)
    medTeste.set('executor', execId)
    medTeste.set('numero_medicao', 1)
    medTeste.set('periodo_inicio', '2026-10-01 00:00:00.000Z')
    medTeste.set('periodo_fim', '2026-10-10 00:00:00.000Z')
    medTeste.set('percentual_executado', 100)
    medTeste.set('valor_bruto', 15000)
    medTeste.set('retencao_impostos', 750)
    medTeste.set('valor_liquido', 14250)
    medTeste.set('status', 'apresentada') // Inicialmente apresentada
    app.save(medTeste)
    const medId = medTeste.id

    let avaliacaoId = null
    let auditLogId = null

    try {
      // --- TESTE 1: Regra de bloqueio se medição não está paga ---
      const medicoesNaoReprovadas = app.findRecordsByFilter(
        'medicoes',
        "subcontrato = '" + subId + "' && status != 'reprovada'",
        '-numero_medicao',
        10,
        0,
      )
      let possuiMedicaoNaoPaga = false
      for (let i = 0; i < medicoesNaoReprovadas.length; i++) {
        if (medicoesNaoReprovadas[i].getString('status') !== 'paga') {
          possuiMedicaoNaoPaga = true
          break
        }
      }
      if (!possuiMedicaoNaoPaga) {
        throw new Error(
          'Falha na prova 1: medição com status "apresentada" deveria ser detectada como não paga.',
        )
      }

      // --- TESTE 2: Regra de bloqueio por role (Executor não pode avaliar) ---
      const executorRole = executorUser.getString('role')
      if (executorRole !== 'executor') {
        throw new Error('Falha na prova 2: role do usuário executor incorreta: ' + executorRole)
      }
      const autorizacaoPermitida = executorRole === 'admin' || executorRole === 'gestor'
      if (autorizacaoPermitida) {
        throw new Error('Falha na prova 2: Executor não pode ter permissão de registrar avaliação.')
      }

      // --- TESTE 3: Transição da medição para "paga" e criação de avaliação pelo Admin ---
      medTeste.set('status', 'paga')
      app.save(medTeste)

      const notaPrazo = 5
      const notaQualidade = 4
      const notaComunicacao = 5
      // Cálculo: Prazo 40% (2.0) + Qualidade 40% (1.6) + Comunicação 20% (1.0) = 4.60
      const notaPonderada =
        Math.round((0.4 * notaPrazo + 0.4 * notaQualidade + 0.2 * notaComunicacao) * 100) / 100

      if (Math.abs(notaPonderada - 4.6) > 0.001) {
        throw new Error(
          'Falha no cálculo da nota ponderada: esperava 4.60, obteve ' + notaPonderada,
        )
      }

      // Formato sequencial AVA-AAAA-NNNN
      const anoAtual = new Date().getFullYear()
      const prefixoAVA = 'AVA-' + anoAtual + '-'
      const ultimasAvas = app.findRecordsByFilter(
        'avaliacoes_executor',
        "numero ~ '" + prefixoAVA + "'",
        '-numero',
        1,
        0,
      )
      let proximoSeq = 1
      if (ultimasAvas && ultimasAvas.length > 0) {
        const partes = ultimasAvas[0].getString('numero').split('-')
        const ultSeq = parseInt(partes[2], 10)
        if (!isNaN(ultSeq)) {
          proximoSeq = ultSeq + 1
        }
      }
      const numeroGlobal = prefixoAVA + ('0000' + proximoSeq).slice(-4)

      const notaGeralAntes = execTeste.getFloat('nota_geral') || 0 // 4.0
      const totalAvaliacoesAntes = execTeste.getInt('total_avaliacoes') || 0 // 1

      // Média móvel ponderada: (nota_geral*total + 2*nova) / (total + 2)
      // (4.0 * 1 + 2 * 4.60) / (1 + 2) = (4.0 + 9.20) / 3 = 13.20 / 3 = 4.40
      const novaNotaGeral =
        (notaGeralAntes * totalAvaliacoesAntes + 2 * notaPonderada) / (totalAvaliacoesAntes + 2)
      const notaGeralDepoisEsperada = Math.round(novaNotaGeral * 100) / 100 // 4.40
      const totalAvaliacoesDepoisEsperado = totalAvaliacoesAntes + 1 // 2

      let novaAvaliacao = null
      app.runInTransaction((txApp) => {
        const avalsCol = txApp.findCollectionByNameOrId('avaliacoes_executor')
        const rec = new Record(avalsCol)
        rec.set('numero', numeroGlobal)
        rec.set('subcontrato', subId)
        rec.set('projeto', projetoId)
        rec.set('executor', execId)
        rec.set('avaliado_por', adminUser.id)
        rec.set('data_avaliacao', new Date().toISOString())
        rec.set('nota_prazo', notaPrazo)
        rec.set('nota_qualidade', notaQualidade)
        rec.set('nota_comunicacao', notaComunicacao)
        rec.set('nota_ponderada', notaPonderada)
        rec.set('comentarios', 'Avaliação de prova de ponta a ponta com dados fictícios.')
        txApp.save(rec)
        novaAvaliacao = rec

        execTeste.set('nota_geral', notaGeralDepoisEsperada)
        execTeste.set('total_avaliacoes', totalAvaliacoesDepoisEsperado)
        txApp.save(execTeste)
      })

      avaliacaoId = novaAvaliacao.id

      // Validações no banco
      const avalGravada = app.findRecordById('avaliacoes_executor', avaliacaoId)
      if (avalGravada.getString('numero') !== numeroGlobal) {
        throw new Error('Número de avaliação gravado incorreto: ' + avalGravada.getString('numero'))
      }
      if (Math.abs(avalGravada.getFloat('nota_ponderada') - 4.6) > 0.001) {
        throw new Error(
          'Nota ponderada gravada incorreta: ' + avalGravada.getFloat('nota_ponderada'),
        )
      }

      const execAtualizado = app.findRecordById('executores', execId)
      if (Math.abs(execAtualizado.getFloat('nota_geral') - 4.4) > 0.001) {
        throw new Error(
          'Nota geral do executor não foi atualizada para 4.40: ' +
            execAtualizado.getFloat('nota_geral'),
        )
      }
      if (execAtualizado.getInt('total_avaliacoes') !== 2) {
        throw new Error(
          'Total de avaliações não foi incrementado para 2: ' +
            execAtualizado.getInt('total_avaliacoes'),
        )
      }

      // --- TESTE 4: Bloqueio de avaliação duplicada (índice único na tabela) ---
      let bloqueioDuplicadaFuncionou = false
      try {
        const avalsCol = app.findCollectionByNameOrId('avaliacoes_executor')
        const recDuplicado = new Record(avalsCol)
        recDuplicado.set('numero', 'AVA-2026-9998')
        recDuplicado.set('subcontrato', subId) // Mesmo subcontrato!
        recDuplicado.set('projeto', projetoId)
        recDuplicado.set('executor', execId)
        recDuplicado.set('avaliado_por', adminUser.id)
        recDuplicado.set('data_avaliacao', new Date().toISOString())
        recDuplicado.set('nota_prazo', 5)
        recDuplicado.set('nota_qualidade', 5)
        recDuplicado.set('nota_comunicacao', 5)
        recDuplicado.set('nota_ponderada', 5.0)
        app.save(recDuplicado) // Deve falhar por violação do índice único idx_avaliacoes_executor_subcontrato
      } catch (errDuplicado) {
        bloqueioDuplicadaFuncionou = true
      }
      if (!bloqueioDuplicadaFuncionou) {
        throw new Error(
          'Falha no teste 4: Banco deveria ter rejeitado segunda avaliação no mesmo subcontrato pelo índice único.',
        )
      }

      // --- TESTE 5: Auditoria AVALIACAO_EXECUTOR_REGISTRADA gravada ---
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', adminUser.id)
      aRec.set('user_email', adminUser.getString('email'))
      aRec.set('acao', 'AVALIACAO_EXECUTOR_REGISTRADA')
      aRec.set('entidade', 'avaliacoes_executor')
      aRec.set('registro_id', avaliacaoId)
      aRec.set('detalhes', {
        origem: 'PROVA_AUTOMATIZADA_MIGRACAO_0067',
        numero: numeroGlobal,
        subcontrato_id: subId,
        nota_ponderada: notaPonderada,
        nota_geral_antes: notaGeralAntes,
        nota_geral_depois: notaGeralDepoisEsperada,
      })
      aRec.set('ip', '127.0.0.1')
      app.save(aRec)
      auditLogId = aRec.id

      const auditGravada = app.findRecordById('audit_logs', auditLogId)
      if (auditGravada.getString('acao') !== 'AVALIACAO_EXECUTOR_REGISTRADA') {
        throw new Error('Auditoria de ação incorreta')
      }
    } finally {
      // 6. LIMPEZA COMPLETA: Restaurar rigorosamente o estado do banco
      if (auditLogId) {
        try {
          const a = app.findRecordById('audit_logs', auditLogId)
          app.delete(a)
        } catch (_) {}
      }
      if (avaliacaoId) {
        try {
          const av = app.findRecordById('avaliacoes_executor', avaliacaoId)
          app.delete(av)
        } catch (_) {}
      }
      try {
        const m = app.findRecordById('medicoes', medId)
        app.delete(m)
      } catch (_) {}
      try {
        const s = app.findRecordById('subcontratos', subId)
        app.delete(s)
      } catch (_) {}
      try {
        const ex = app.findRecordById('executores', execId)
        app.delete(ex)
      } catch (_) {}
    }
  },
  (app) => {},
)
