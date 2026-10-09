// Hook para operações de Avaliações de Executor (por Subcontrato)
// Rota:
// 1. POST /backend/v1/avaliacoes-executor/criar (Admin/Gestor)
//    - Valida subcontrato assinado, todas as medições (exceto reprovadas) pagas e ausência de avaliação prévia
//    - Calcula nota_ponderada no servidor: 0.4*prazo + 0.4*qualidade + 0.2*comunicacao
//    - Recalcula nota_geral do executor (média móvel ponderada) e incrementa total_avaliacoes na mesma transação
//    - Audita AVALIACAO_EXECUTOR_REGISTRADA em audit_logs

routerAdd(
  'POST',
  '/backend/v1/avaliacoes-executor/criar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')
      const userId = reqInfo.auth.id

      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message:
            'Permissão negada: apenas Administradores ou Gestores de Projetos podem registrar avaliações de executor.',
        })
      }

      const body = reqInfo.body || {}
      const subcontratoId = body.subcontrato
      const notaPrazo = parseInt(body.nota_prazo, 10)
      const notaQualidade = parseInt(body.nota_qualidade, 10)
      const notaComunicacao = parseInt(body.nota_comunicacao, 10)
      const comentarios = (body.comentarios || '').toString().trim()

      if (!subcontratoId) {
        return e.json(400, { message: 'Subcontrato é obrigatório para registrar a avaliação.' })
      }
      if (
        isNaN(notaPrazo) ||
        isNaN(notaQualidade) ||
        isNaN(notaComunicacao) ||
        notaPrazo < 1 ||
        notaPrazo > 5 ||
        notaQualidade < 1 ||
        notaQualidade > 5 ||
        notaComunicacao < 1 ||
        notaComunicacao > 5
      ) {
        return e.json(400, {
          message: 'As notas de Prazo, Qualidade e Comunicação devem ser de 1 a 5 estrelas.',
        })
      }

      // Buscar subcontrato
      let sub
      try {
        sub = $app.findRecordById('subcontratos', subcontratoId)
      } catch (_) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }
      if (!sub) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }

      const subStatus = sub.getString('status')
      if (subStatus !== 'assinado') {
        return e.json(400, {
          message:
            'Apenas subcontratos no status "assinado" podem ser avaliados após a conclusão dos pagamentos.',
        })
      }

      const projetoId = sub.getString('projeto') || ''
      const executorId = sub.getString('executor') || ''
      if (!executorId || !projetoId) {
        return e.json(400, {
          message: 'Subcontrato sem vínculo de projeto/executor não pode ser avaliado.',
        })
      }

      // Buscar executor
      let execRec = null
      try {
        execRec = $app.findRecordById('executores', executorId)
      } catch (_) {}
      if (!execRec) {
        return e.json(404, { message: 'Executor vinculado ao subcontrato não encontrado.' })
      }

      // Validação 1: subcontrato ainda não avaliado (proteção adicional ao índice único)
      const avaliacoesExistentes = $app.findRecordsByFilter(
        'avaliacoes_executor',
        "subcontrato = '" + subcontratoId + "'",
        '-created',
        1,
        0,
      )
      if (avaliacoesExistentes && avaliacoesExistentes.length > 0) {
        return e.json(400, {
          message:
            'Este subcontrato já possui uma avaliação de executor registrada. Cada subcontrato pode ser avaliado apenas uma vez.',
        })
      }

      // Validação 2: todas as medições do subcontrato (exceto reprovadas) devem estar pagas
      const medicoesNaoReprovadas = $app.findRecordsByFilter(
        'medicoes',
        "subcontrato = '" + subcontratoId + "' && status != 'reprovada'",
        '-numero_medicao',
        200,
        0,
      )
      let totalPago = 0
      for (let i = 0; i < medicoesNaoReprovadas.length; i++) {
        const st = medicoesNaoReprovadas[i].getString('status')
        if (st !== 'paga') {
          return e.json(400, {
            message:
              'BLOQUEIO: A avaliação do executor só pode ser registrada quando TODAS as medições do subcontrato (exceto reprovadas) estiverem com status "paga". ' +
              'A medição ' +
              medicoesNaoReprovadas[i].getString('numero') +
              ' está como "' +
              st +
              '".',
          })
        }
        totalPago += medicoesNaoReprovadas[i].getFloat('valor_liquido') || 0
      }
      if (medicoesNaoReprovadas.length === 0) {
        return e.json(400, {
          message:
            'BLOQUEIO: Este subcontrato não possui medições pagas. Registre e pague ao menos uma medição antes de avaliar o executor.',
        })
      }

      // Cálculo da nota ponderada NO SERVIDOR: 0.4*prazo + 0.4*qualidade + 0.2*comunicacao
      const notaPonderada =
        Math.round((0.4 * notaPrazo + 0.4 * notaQualidade + 0.2 * notaComunicacao) * 100) / 100

      // Números sequenciais: AVA-AAAA-NNNN (global por ano) e data da avaliação
      const anoAtual = new Date().getFullYear()
      const prefixoAVA = 'AVA-' + anoAtual + '-'
      const ultimasAvas = $app.findRecordsByFilter(
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
      const dataAvaliacao = new Date().toISOString()

      // Valores pré-transação para auditoria
      const notaGeralAntes = execRec.getFloat('nota_geral') || 0
      const totalAvaliacoesAntes = execRec.getInt('total_avaliacoes') || 0

      // Transação: cria a avaliação e recalcula a nota_geral do executor (média móvel ponderada)
      let novaAvaliacao = null
      let notaGeralDepois = 0
      let totalAvaliacoesDepois = 0

      $app.runInTransaction((txApp) => {
        const avalsCol = txApp.findCollectionByNameOrId('avaliacoes_executor')
        const rec = new Record(avalsCol)
        rec.set('numero', numeroGlobal)
        rec.set('subcontrato', subcontratoId)
        rec.set('projeto', projetoId)
        rec.set('executor', executorId)
        rec.set('avaliado_por', userId)
        rec.set('data_avaliacao', dataAvaliacao)
        rec.set('nota_prazo', notaPrazo)
        rec.set('nota_qualidade', notaQualidade)
        rec.set('nota_comunicacao', notaComunicacao)
        rec.set('nota_ponderada', notaPonderada)
        if (comentarios) {
          rec.set('comentarios', comentarios)
        }
        txApp.save(rec)
        novaAvaliacao = rec

        // Média móvel ponderada: (nota_geral*total + 2*nova) / (total + 2)
        // A nova avaliação de subcontrato conta com peso 2 (maior maturidade que a avaliação de etapa).
        const notaAtual = execRec.getFloat('nota_geral') || 0
        const totalAtual = execRec.getInt('total_avaliacoes') || 0
        const novaNotaGeral =
          totalAtual > 0 && notaAtual > 0
            ? (notaAtual * totalAtual + 2 * notaPonderada) / (totalAtual + 2)
            : notaPonderada
        notaGeralDepois = Math.round(novaNotaGeral * 100) / 100
        totalAvaliacoesDepois = totalAtual + 1

        execRec.set('nota_geral', notaGeralDepois)
        execRec.set('total_avaliacoes', totalAvaliacoesDepois)
        txApp.save(execRec)
      })

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria AVALIACAO_EXECUTOR_REGISTRADA
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'AVALIACAO_EXECUTOR_REGISTRADA')
        aRec.set('entidade', 'avaliacoes_executor')
        aRec.set('registro_id', novaAvaliacao ? novaAvaliacao.id : '')
        aRec.set('detalhes', {
          mensagem:
            'Avaliação de executor ' +
            numeroGlobal +
            ' registrada para o subcontrato ' +
            sub.getString('numero') +
            ' (' +
            execRec.getString('nome') +
            ') por ' +
            userEmail,
          numero: numeroGlobal,
          subcontrato_id: subcontratoId,
          subcontrato_numero: sub.getString('numero'),
          projeto_id: projetoId,
          executor_id: executorId,
          executor_nome: execRec.getString('nome'),
          nota_prazo: notaPrazo,
          nota_qualidade: notaQualidade,
          nota_comunicacao: notaComunicacao,
          nota_ponderada: notaPonderada,
          total_medicoes_pagas: medicoesNaoReprovadas.length,
          valor_total_pago: Math.round(totalPago * 100) / 100,
          nota_geral_antes: notaGeralAntes,
          nota_geral_depois: notaGeralDepois,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar AVALIACAO_EXECUTOR_REGISTRADA: ' + errAudit)
      }

      return e.json(200, {
        success: true,
        message:
          'Avaliação ' +
          numeroGlobal +
          ' registrada com sucesso! Nota ponderada: ' +
          notaPonderada.toFixed(2) +
          '/5.00',
        avaliacao: {
          id: novaAvaliacao ? novaAvaliacao.id : '',
          numero: numeroGlobal,
          nota_ponderada: notaPonderada,
          nota_geral_antes: notaGeralAntes,
          nota_geral_depois: notaGeralDepois,
          total_avaliacoes: totalAvaliacoesDepois,
        },
      })
    } catch (err) {
      console.log('Erro interno em /avaliacoes-executor/criar: ' + err)
      return e.json(500, { message: 'Erro interno ao registrar avaliação do executor: ' + err })
    }
  },
  $apis.requireAuth(),
)
