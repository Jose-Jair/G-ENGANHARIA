// Hook para operações de Medições Progressivas
// Rotas:
// 1. POST /backend/v1/medicoes/criar (Admin/Gestor ou Executor no próprio subcontrato)
// 2. POST /backend/v1/medicoes/{id}/aprovar (Admin/Gestor)
// 3. POST /backend/v1/medicoes/{id}/reprovar (Admin/Gestor)

// 1. Criar Medição
routerAdd(
  'POST',
  '/backend/v1/medicoes/criar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')
      const userId = reqInfo.auth.id

      if (role !== 'admin' && role !== 'gestor' && role !== 'executor') {
        return e.json(403, {
          message: 'Apenas Admin, Gestor de Projetos ou Executor podem apresentar medições.',
        })
      }

      const body = reqInfo.body || {}
      const subcontratoId = body.subcontrato
      const periodoInicio = body.periodo_inicio
      const periodoFim = body.periodo_fim
      const percentualExecutado = parseFloat(body.percentual_executado)
      const valorBruto = parseFloat(body.valor_bruto)
      const retencaoImpostos = parseFloat(body.retencao_impostos || 0) || 0
      const anexos = body.anexos || []

      if (!subcontratoId) {
        return e.json(400, { message: 'Subcontrato é obrigatório para registrar a medição.' })
      }
      if (!periodoInicio || !periodoFim) {
        return e.json(400, { message: 'Período inicial e final da medição são obrigatórios.' })
      }
      if (isNaN(valorBruto) || valorBruto <= 0) {
        return e.json(400, { message: 'Valor bruto da medição deve ser maior que zero.' })
      }
      if (isNaN(percentualExecutado) || percentualExecutado <= 0) {
        return e.json(400, { message: 'Percentual executado deve ser maior que zero.' })
      }
      if (retencaoImpostos < 0 || retencaoImpostos > valorBruto) {
        return e.json(400, {
          message:
            'Retenção de impostos inválida (não pode ser negativa nem exceder o valor bruto).',
        })
      }

      // Buscar subcontrato
      let sub
      try {
        sub = $app.findRecordById('subcontratos', subcontratoId)
      } catch (_) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }

      const subStatus = sub.getString('status')
      if (subStatus !== 'assinado' && subStatus !== 'em_execucao') {
        return e.json(400, {
          message:
            'Apenas subcontratos no status "assinado" ou "em_execucao" podem receber medições progressivas.',
        })
      }

      // Validação de executor
      const executorId = sub.getString('executor')
      let execRec = null
      try {
        execRec = $app.findRecordById('executores', executorId)
      } catch (_) {}

      if (role === 'executor') {
        if (!execRec || execRec.getString('email') !== userEmail) {
          return e.json(403, {
            message: 'Você só pode apresentar medições vinculadas aos seus próprios subcontratos.',
          })
        }
      }

      const valorTotalSub = sub.getFloat('valor_total') || 0
      const projetoId = sub.getString('projeto')

      // Buscar medições anteriores deste subcontrato (status apresentada, aprovada, faturada, paga)
      // Exclui apenas as reprovadas
      const medicoesExistentes = $app.findRecordsByFilter(
        'medicoes',
        "subcontrato = '" + subcontratoId + "' && status != 'reprovada'",
        'numero_medicao',
        200,
        0,
      )

      let totalMedidoAnterior = 0
      let maxNumMedicao = 0
      for (let i = 0; i < medicoesExistentes.length; i++) {
        totalMedidoAnterior += medicoesExistentes[i].getFloat('valor_bruto') || 0
        const n = medicoesExistentes[i].getInt('numero_medicao') || 0
        if (n > maxNumMedicao) {
          maxNumMedicao = n
        }
      }

      // Se houver medições reprovadas também, precisamos verificar o maior número de medição
      try {
        const todasMedicoesSub = $app.findRecordsByFilter(
          'medicoes',
          "subcontrato = '" + subcontratoId + "'",
          '-numero_medicao',
          1,
          0,
        )
        if (todasMedicoesSub.length > 0) {
          const ultN = todasMedicoesSub[0].getInt('numero_medicao') || 0
          if (ultN > maxNumMedicao) {
            maxNumMedicao = ultN
          }
        }
      } catch (_) {}

      const proximoNumeroMedicao = maxNumMedicao + 1

      // Validação de saldo no servidor
      // valor_bruto acumulado não pode exceder valor_total do subcontrato
      const saldoDisponivel = Math.round((valorTotalSub - totalMedidoAnterior) * 100) / 100
      const novoTotal = Math.round((totalMedidoAnterior + valorBruto) * 100) / 100

      if (novoTotal > valorTotalSub + 0.01) {
        return e.json(400, {
          message:
            'BLOQUEIO: A soma das medições (R$ ' +
            novoTotal.toFixed(2) +
            ') excede o valor total do subcontrato (R$ ' +
            valorTotalSub.toFixed(2) +
            '). Saldo disponível para medição: R$ ' +
            (saldoDisponivel > 0 ? saldoDisponivel.toFixed(2) : '0,00') +
            '.',
        })
      }

      // Gerar numeração global sequencial sem lacunas: MED-AAAA-NNNN
      const anoAtual = new Date().getFullYear()
      const prefixoMED = 'MED-' + anoAtual + '-'
      const medicoesDoAno = $app.findRecordsByFilter(
        'medicoes',
        "numero ~ '" + prefixoMED + "'",
        '-numero',
        1,
        0,
      )

      let proximoSeq = 1
      if (medicoesDoAno.length > 0) {
        const ultNum = medicoesDoAno[0].getString('numero')
        const partes = ultNum.split('-')
        const ultSeq = parseInt(partes[2], 10)
        if (!isNaN(ultSeq)) {
          proximoSeq = ultSeq + 1
        }
      }
      const numeroGlobal = prefixoMED + ('0000' + proximoSeq).slice(-4)

      // Percentual de retenção técnica configurado no subcontrato (ou herdado de parâmetros)
      let pctRetencaoTec = sub.getFloat('percentual_retencao_tecnica')
      if (isNaN(pctRetencaoTec) || pctRetencaoTec < 0) {
        pctRetencaoTec = 0
      }
      // Se body enviou percentual específico e o usuário tem perfil interno, respeita; caso contrário usa o do subcontrato
      if (
        body.percentual_retencao_tecnica !== undefined &&
        (role === 'admin' || role === 'gestor')
      ) {
        const bodyPct = parseFloat(body.percentual_retencao_tecnica)
        if (!isNaN(bodyPct) && bodyPct >= 0 && bodyPct <= 100) {
          pctRetencaoTec = bodyPct
        }
      }
      const valorRetencaoTecnica = Math.round(((valorBruto * pctRetencaoTec) / 100) * 100) / 100

      const valorLiquido =
        Math.round((valorBruto - retencaoImpostos - valorRetencaoTecnica) * 100) / 100

      const medicoesCol = $app.findCollectionByNameOrId('medicoes')
      const novaMedicao = new Record(medicoesCol)
      novaMedicao.set('numero', numeroGlobal)
      novaMedicao.set('subcontrato', subcontratoId)
      novaMedicao.set('projeto', projetoId)
      novaMedicao.set('executor', executorId)
      novaMedicao.set('numero_medicao', proximoNumeroMedicao)
      novaMedicao.set('periodo_inicio', periodoInicio)
      novaMedicao.set('periodo_fim', periodoFim)
      novaMedicao.set('percentual_executado', percentualExecutado)
      novaMedicao.set('valor_bruto', valorBruto)
      novaMedicao.set('retencao_impostos', retencaoImpostos)
      novaMedicao.set('percentual_retencao_tecnica', pctRetencaoTec)
      novaMedicao.set('valor_retencao_tecnica', valorRetencaoTecnica)
      novaMedicao.set('aceita_pelo_cliente', false)
      novaMedicao.set('valor_liquido', valorLiquido)
      novaMedicao.set('status', 'apresentada')
      if (Array.isArray(anexos) && anexos.length > 0) {
        novaMedicao.set('anexos', anexos)
      }

      $app.save(novaMedicao)

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria MEDICAO_CRIADA
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'MEDICAO_CRIADA')
        aRec.set('entidade', 'medicoes')
        aRec.set('registro_id', novaMedicao.id)
        aRec.set('detalhes', {
          mensagem:
            'Medição ' +
            numeroGlobal +
            ' (Medição ' +
            ('00' + proximoNumeroMedicao).slice(-2) +
            ') apresentada para o subcontrato ' +
            sub.getString('numero'),
          numero: numeroGlobal,
          numero_medicao: proximoNumeroMedicao,
          subcontrato_id: subcontratoId,
          subcontrato_numero: sub.getString('numero'),
          projeto_id: projetoId,
          executor_id: executorId,
          valor_bruto: valorBruto,
          retencao_impostos: retencaoImpostos,
          percentual_retencao_tecnica: pctRetencaoTec,
          valor_retencao_tecnica: valorRetencaoTecnica,
          valor_liquido: valorLiquido,
          percentual_executado: percentualExecutado,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          apresentado_por_role: role,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar MEDICAO_CRIADA: ' + errAudit)
      }

      return e.json(200, {
        success: true,
        message: 'Medição ' + numeroGlobal + ' apresentada com sucesso!',
        medicao: {
          id: novaMedicao.id,
          numero: numeroGlobal,
          numero_medicao: proximoNumeroMedicao,
          status: 'apresentada',
          valor_bruto: valorBruto,
          retencao_impostos: retencaoImpostos,
          percentual_retencao_tecnica: pctRetencaoTec,
          valor_retencao_tecnica: valorRetencaoTecnica,
          valor_liquido: valorLiquido,
        },
      })
    } catch (err) {
      console.log('Erro interno em /medicoes/criar: ' + err)
      return e.json(500, { message: 'Erro interno ao criar medição: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 2. Aprovar Medição (apenas Admin/Gestor)
// Gera automaticamente conta a pagar na coleção 'contas' com medicao_aprovada_origem = id da medição
routerAdd(
  'POST',
  '/backend/v1/medicoes/{id}/aprovar',
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
            'Permissão negada: apenas Administradores ou Gestores de Projetos podem aprovar medições.',
        })
      }

      const medicaoId = e.request.pathValue('id')
      if (!medicaoId) {
        return e.json(400, { message: 'ID da medição não informado.' })
      }

      let medicao
      try {
        medicao = $app.findRecordById('medicoes', medicaoId)
      } catch (_) {
        return e.json(404, { message: 'Medição não encontrada.' })
      }

      const statusAtual = medicao.getString('status')
      const medicaoNumero = medicao.getString('numero')
      const subcontratoId = medicao.getString('subcontrato')
      const projetoId = medicao.getString('projeto')
      const executorId = medicao.getString('executor')
      const valorBruto = medicao.getFloat('valor_bruto') || 0
      const retencao = medicao.getFloat('retencao_impostos') || 0
      const valorRetencaoTecnica = medicao.getFloat('valor_retencao_tecnica') || 0
      const valorLiquido =
        medicao.getFloat('valor_liquido') ||
        Math.round((valorBruto - retencao - valorRetencaoTecnica) * 100) / 100
      const numeroMedicaoSeq = medicao.getInt('numero_medicao') || 1

      // Idempotência: se já aprovada/faturada/paga, não duplicar a conta a pagar
      const contasExistentes = $app.findRecordsByFilter(
        'contas',
        "medicao_aprovada_origem = '" + medicaoId + "'",
        '-created',
        1,
        0,
      )

      if (statusAtual === 'aprovada' || statusAtual === 'faturada' || statusAtual === 'paga') {
        const cExistente = contasExistentes.length > 0 ? contasExistentes[0] : null
        return e.json(200, {
          success: true,
          message: 'Esta medição já se encontra aprovada.',
          medicao_id: medicaoId,
          conta_pagar_id: cExistente ? cExistente.id : null,
          conta_descricao: cExistente ? cExistente.getString('descricao') : null,
        })
      }

      if (statusAtual === 'reprovada') {
        return e.json(400, {
          message:
            'Medição reprovada não pode ser aprovada diretamente. O executor deve reapresentar uma nova medição.',
        })
      }

      // REQUISITO 7: TRAVA DA MEDIÇÃO
      // No hook de medições existente, a liberação/aprovação da medição exige que os entregáveis vinculados
      // à OS/disciplina correspondente estejam APROVADOS (nenhum pendente/em revisão/devolvido) — bloquear com erro claro e auditado.
      try {
        let entregaveisParaChecar = []

        // 1. Se houver etapa vinculada à medição
        const etapaIdMedicao = medicao.getString('etapa')
        if (etapaIdMedicao) {
          entregaveisParaChecar = $app.findRecordsByFilter(
            'entregaveis',
            "etapa = '" + etapaIdMedicao + "'",
            '',
            100,
            0,
          )
        }

        // 2. Se não houver por etapa, checar se a medição está vinculada a OS ou subcontrato
        if (entregaveisParaChecar.length === 0) {
          const osMedicao = medicao.getString('ordem_servico')
          if (osMedicao) {
            entregaveisParaChecar = $app.findRecordsByFilter(
              'entregaveis',
              "ordem_servico = '" + osMedicao + "'",
              '',
              100,
              0,
            )
          } else if (subcontratoId) {
            // Buscar OS correspondente ao subcontrato
            const osSub = $app.findRecordsByFilter(
              'ordens_servico',
              "subcontrato_legado = '" + subcontratoId + "'",
              '',
              1,
              0,
            )
            if (osSub.length > 0) {
              entregaveisParaChecar = $app.findRecordsByFilter(
                'entregaveis',
                "ordem_servico = '" + osSub[0].id + "'",
                '',
                100,
                0,
              )
            }
          }
        }

        // 3. Se ainda assim houver projeto, checar entregáveis do projeto associados à mesma disciplina
        if (entregaveisParaChecar.length === 0 && projetoId) {
          // Buscar entregáveis vinculados às etapas da disciplina
          const discMed = medicao.getString('disciplina')
          if (discMed) {
            const etapasDisc = $app.findRecordsByFilter(
              'projeto_etapas',
              "projeto = '" + projetoId + "' && disciplina = '" + discMed.replace(/'/g, "''") + "'",
              '',
              20,
              0,
            )
            for (let ed = 0; ed < etapasDisc.length; ed++) {
              const ents = $app.findRecordsByFilter(
                'entregaveis',
                "etapa = '" + etapasDisc[ed].id + "'",
                '',
                50,
                0,
              )
              for (let x = 0; x < ents.length; x++) {
                entregaveisParaChecar.push(ents[x])
              }
            }
          }
        }

        // Se há entregáveis mapeados para o escopo desta medição, nenhum pode estar pendente/em revisão/devolvido
        if (entregaveisParaChecar.length > 0) {
          const pendentes = []
          for (let ep = 0; ep < entregaveisParaChecar.length; ep++) {
            const entItem = entregaveisParaChecar[ep]
            const stEnt = entItem.getString('status')
            if (stEnt !== 'aprovado') {
              pendentes.push({
                id: entItem.id,
                titulo: entItem.getString('titulo') || entItem.getString('nome'),
                status: stEnt,
              })
            }
          }

          if (pendentes.length > 0) {
            // Auditar bloqueio de medição por entregáveis pendentes
            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', userId)
              aRec.set('user_email', userEmail)
              aRec.set('acao', 'BLOQUEIO_MEDICAO_ENTREGAVEIS_PENDENTES')
              aRec.set('entidade', 'medicoes')
              aRec.set('registro_id', medicaoId)
              aRec.set('detalhes', {
                mensagem:
                  'Tentativa de aprovação da Medição ' +
                  medicaoNumero +
                  ' bloqueada: ' +
                  pendentes.length +
                  ' entregável(is) não aprovado(s).',
                medicao_id: medicaoId,
                medicao_numero: medicaoNumero,
                total_entregaveis: entregaveisParaChecar.length,
                total_pendentes: pendentes.length,
                pendentes: pendentes,
              })
              $app.save(aRec)
            } catch (_) {}

            return e.json(400, {
              error:
                'BLOQUEIO DE MEDIÇÃO: A liberação desta medição exige que todos os entregáveis técnicos vinculados estejam com status APROVADO. Há ' +
                pendentes.length +
                ' entregável(is) pendente(s) ou em revisão.',
              pendentes: pendentes,
            })
          }
        }
      } catch (errTravaMed) {
        console.log('Erro ao validar trava de entregáveis na medição: ' + errTravaMed)
      }

      const nowIso = new Date().toISOString()
      medicao.set('status', 'aprovada')
      medicao.set('aprovada_por', userId)
      medicao.set('data_aprovacao', nowIso)
      $app.save(medicao)

      // Transição automática: se o subcontrato ainda estiver 'assinado', a aprovação da primeira medição
      // avança o ciclo para 'em_execucao' e acumula a retenção técnica calculada.
      try {
        const subRec = $app.findRecordById('subcontratos', subcontratoId)
        if (subRec) {
          let mudouSub = false
          if (subRec.getString('status') === 'assinado') {
            subRec.set('status', 'em_execucao')
            mudouSub = true

            // Auditoria da transição de ciclo disparada pela primeira medição aprovada
            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aCiclo = new Record(auditCol)
              aCiclo.set('user', userId)
              aCiclo.set('user_email', userEmail)
              aCiclo.set('acao', 'SUBCONTRATO_INICIO_EXECUCAO')
              aCiclo.set('entidade', 'subcontratos')
              aCiclo.set('registro_id', subRec.id)
              aCiclo.set('detalhes', {
                mensagem:
                  'Subcontrato ' +
                  subRec.getString('numero') +
                  ' avançou para "em_execucao" automaticamente pela aprovação da medição ' +
                  medicaoNumero,
                status_anterior: 'assinado',
                novo_status: 'em_execucao',
                medicao_id: medicaoId,
                medicao_numero: medicaoNumero,
              })
              aCiclo.set(
                'ip',
                (reqInfo.headers &&
                  (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
                  '127.0.0.1',
              )
              $app.save(aCiclo)
            } catch (_) {}
          }

          // Acumular retenção técnica no subcontrato
          if (valorRetencaoTecnica > 0) {
            const retAtual = subRec.getFloat('retencao_tecnica_acumulada') || 0
            const novaRetAcumulada = Math.round((retAtual + valorRetencaoTecnica) * 100) / 100
            subRec.set('retencao_tecnica_acumulada', novaRetAcumulada)
            const retLiberada = subRec.getFloat('retencao_tecnica_liberada') || 0
            if (retLiberada <= 0) {
              subRec.set('status_retencao', 'acumulando')
            } else if (retLiberada < novaRetAcumulada) {
              subRec.set('status_retencao', 'parcialmente_liberada')
            }
            mudouSub = true
          }

          if (mudouSub) {
            $app.save(subRec)
          }
        }
      } catch (errSubTrans) {
        console.log('Aviso ao atualizar subcontrato na aprovação da medição: ' + errSubTrans)
      }

      // Transição automática em Ordem de Serviço vinculada ao subcontrato ou associada
      try {
        const osRecs = $app.findRecordsByFilter(
          'ordens_servico',
          "subcontrato_legado = '" + subcontratoId + "'",
          '-created',
          1,
          0,
        )
        if (osRecs.length > 0) {
          const osRec = osRecs[0]
          let mudouOs = false
          if (osRec.getString('status') === 'assinada') {
            osRec.set('status', 'em_execucao')
            mudouOs = true
          }
          if (valorRetencaoTecnica > 0 && osRec.getString('tipo_prestador') === 'externo') {
            const retAtualOs = osRec.getFloat('retencao_tecnica_acumulada') || 0
            const novaRetAcumuladaOs = Math.round((retAtualOs + valorRetencaoTecnica) * 100) / 100
            osRec.set('retencao_tecnica_acumulada', novaRetAcumuladaOs)
            const retLiberadaOs = osRec.getFloat('retencao_tecnica_liberada') || 0
            if (retLiberadaOs <= 0) {
              osRec.set('status_retencao', 'acumulando')
            } else if (retLiberadaOs < novaRetAcumuladaOs) {
              osRec.set('status_retencao', 'parcialmente_liberada')
            }
            mudouOs = true
          }
          if (mudouOs) {
            $app.save(osRec)
          }
        }
      } catch (errOsTrans) {
        console.log('Aviso ao sincronizar transição na OS: ' + errOsTrans)
      }

      let contaCriada = null
      if (contasExistentes.length > 0) {
        contaCriada = contasExistentes[0]
      } else {
        // Obter número do subcontrato e código do projeto para descrição rica
        let subNumero = ''
        try {
          const subRec = $app.findRecordById('subcontratos', subcontratoId)
          if (subRec) subNumero = subRec.getString('numero')
        } catch (_) {}

        let prjCodigo = ''
        try {
          const prjRec = $app.findRecordById('projetos', projetoId)
          if (prjRec) prjCodigo = prjRec.getString('codigo')
        } catch (_) {}

        let execNome = ''
        try {
          const exRec = $app.findRecordById('executores', executorId)
          if (exRec) execNome = exRec.getString('nome')
        } catch (_) {}

        const contasCol = $app.findCollectionByNameOrId('contas')
        const novaConta = new Record(contasCol)
        novaConta.set('tipo', 'pagar')
        novaConta.set('status', 'rascunho')
        novaConta.set(
          'descricao',
          'Medição ' +
            medicaoNumero +
            ' (Medição ' +
            ('00' + numeroMedicaoSeq).slice(-2) +
            ') — Subcontrato ' +
            (subNumero || subcontratoId) +
            (prjCodigo ? ' • ' + prjCodigo : '') +
            (execNome ? ' • ' + execNome : ''),
        )
        novaConta.set('valor', valorBruto)
        novaConta.set('retencao_impostos', retencao)
        novaConta.set('valor_liquido', valorLiquido)
        novaConta.set('subcontrato', subcontratoId)
        novaConta.set('projeto', projetoId)
        novaConta.set('executor', executorId)
        novaConta.set('medicao_aprovada_origem', medicaoId)
        novaConta.set(
          'forma_pagamento',
          'Transferência Bancária / PIX conforme Termo de Subcontratação',
        )
        novaConta.set('bloqueada_por_fechamento', false)

        // Vencimento em D+15 dias por padrão
        const dataVenc = new Date()
        dataVenc.setDate(dataVenc.getDate() + 15)
        novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

        $app.save(novaConta)
        contaCriada = novaConta

        const clientIp =
          (reqInfo.headers &&
            (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
          '127.0.0.1'

        // Auditoria CONTA_PAGAR_GERADA_MEDICAO
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aConta = new Record(auditCol)
          aConta.set('user', userId)
          aConta.set('user_email', userEmail)
          aConta.set('acao', 'CONTA_PAGAR_GERADA_MEDICAO')
          aConta.set('entidade', 'contas')
          aConta.set('registro_id', novaConta.id)
          aConta.set('detalhes', {
            mensagem:
              'Conta a pagar rascunho gerada automaticamente a partir da aprovação da Medição ' +
              medicaoNumero,
            medicao_id: medicaoId,
            medicao_numero: medicaoNumero,
            subcontrato_id: subcontratoId,
            projeto_id: projetoId,
            executor_id: executorId,
            valor_bruto: valorBruto,
            retencao_impostos: retencao,
            valor_liquido: valorLiquido,
          })
          aConta.set('ip', clientIp)
          $app.save(aConta)
        } catch (errAuditConta) {
          console.log('Erro ao auditar CONTA_PAGAR_GERADA_MEDICAO: ' + errAuditConta)
        }
      }

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria MEDICAO_APROVADA
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'MEDICAO_APROVADA')
        aRec.set('entidade', 'medicoes')
        aRec.set('registro_id', medicaoId)
        aRec.set('detalhes', {
          mensagem: 'Medição ' + medicaoNumero + ' aprovada pelo ' + role + ' ' + userEmail,
          medicao_numero: medicaoNumero,
          aprovador_id: userId,
          aprovador_email: userEmail,
          data_aprovacao: nowIso,
          conta_pagar_id: contaCriada ? contaCriada.id : null,
          valor_liquido: valorLiquido,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar MEDICAO_APROVADA: ' + errAudit)
      }

      return e.json(200, {
        success: true,
        message:
          'Medição aprovada com sucesso! Conta a pagar gerada automaticamente no Financeiro.',
        medicao_id: medicaoId,
        conta_pagar_id: contaCriada ? contaCriada.id : null,
      })
    } catch (err) {
      console.log('Erro interno em /medicoes/aprovar: ' + err)
      return e.json(500, { message: 'Erro interno ao aprovar medição: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 3. Reprovar Medição (apenas Admin/Gestor)
// Exige observacoes_gestor preenchida
routerAdd(
  'POST',
  '/backend/v1/medicoes/{id}/reprovar',
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
            'Permissão negada: apenas Administradores ou Gestores de Projetos podem reprovar medições.',
        })
      }

      const medicaoId = e.request.pathValue('id')
      if (!medicaoId) {
        return e.json(400, { message: 'ID da medição não informado.' })
      }

      const body = reqInfo.body || {}
      const observacoes = (body.observacoes_gestor || body.observacoes || '').trim()

      if (!observacoes) {
        return e.json(400, {
          message:
            'Para reprovar uma medição, é obrigatório preencher a justificativa/observações para o executor.',
        })
      }

      let medicao
      try {
        medicao = $app.findRecordById('medicoes', medicaoId)
      } catch (_) {
        return e.json(404, { message: 'Medição não encontrada.' })
      }

      const statusAtual = medicao.getString('status')
      if (statusAtual === 'aprovada' || statusAtual === 'faturada' || statusAtual === 'paga') {
        return e.json(400, {
          message: 'Esta medição já foi aprovada/faturada e não pode ser reprovada diretamente.',
        })
      }

      medicao.set('status', 'reprovada')
      medicao.set('observacoes_gestor', observacoes)
      $app.save(medicao)

      const medicaoNumero = medicao.getString('numero')
      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria MEDICAO_REPROVADA
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'MEDICAO_REPROVADA')
        aRec.set('entidade', 'medicoes')
        aRec.set('registro_id', medicaoId)
        aRec.set('detalhes', {
          mensagem:
            'Medição ' +
            medicaoNumero +
            ' reprovada por ' +
            userEmail +
            '. Justificativa: ' +
            observacoes,
          medicao_numero: medicaoNumero,
          observacoes_gestor: observacoes,
          reprovado_por_id: userId,
          reprovado_por_email: userEmail,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar MEDICAO_REPROVADA: ' + errAudit)
      }

      return e.json(200, {
        success: true,
        message: 'Medição reprovada com sucesso. O executor poderá reapresentar os ajustes.',
        medicao_id: medicaoId,
      })
    } catch (err) {
      console.log('Erro interno em /medicoes/reprovar: ' + err)
      return e.json(500, { message: 'Erro interno ao reprovar medição: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 4. Aceitar Medição pelo Cliente (Gestor ou Admin registra aceitação da etapa/entrega)
// Essencial para permitir a posterior liberação da retenção técnica
routerAdd(
  'POST',
  '/backend/v1/medicoes/{id}/aceitar-cliente',
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
            'Apenas Administradores ou Gestores de Projetos podem registrar a aceitação da entrega pelo cliente.',
        })
      }

      const medicaoId = e.request.pathValue('id')
      if (!medicaoId) {
        return e.json(400, { message: 'ID da medição não informado.' })
      }

      let medicao
      try {
        medicao = $app.findRecordById('medicoes', medicaoId)
      } catch (_) {
        return e.json(404, { message: 'Medição não encontrada.' })
      }

      const statusAtual = medicao.getString('status')
      if (statusAtual !== 'aprovada' && statusAtual !== 'faturada' && statusAtual !== 'paga') {
        return e.json(400, {
          message:
            'Apenas medições aprovadas, faturadas ou pagas podem ter aceitação pelo cliente registrada.',
        })
      }

      const body = reqInfo.body || {}
      const responsavel = (body.responsavel_aceitacao_cliente || body.responsavel || userEmail)
        .toString()
        .trim()
      const nowIso = new Date().toISOString()

      medicao.set('aceita_pelo_cliente', true)
      medicao.set('data_aceitacao_cliente', nowIso)
      medicao.set('responsavel_aceitacao_cliente', responsavel)
      $app.save(medicao)

      const medicaoNumero = medicao.getString('numero')
      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'MEDICAO_ACEITA_CLIENTE')
        aRec.set('entidade', 'medicoes')
        aRec.set('registro_id', medicaoId)
        aRec.set('detalhes', {
          mensagem:
            'Aceitação da medição ' + medicaoNumero + ' pelo cliente registrada por ' + responsavel,
          medicao_numero: medicaoNumero,
          responsavel: responsavel,
          data_aceitacao: nowIso,
          valor_retencao_tecnica: medicao.getFloat('valor_retencao_tecnica') || 0,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Aceitação da entrega pelo cliente registrada com sucesso!',
        medicao_id: medicaoId,
        aceita_pelo_cliente: true,
        data_aceitacao_cliente: nowIso,
      })
    } catch (err) {
      console.log('Erro interno em /medicoes/aceitar-cliente: ' + err)
      return e.json(500, { message: 'Erro interno ao aceitar medição: ' + err })
    }
  },
  $apis.requireAuth(),
)
