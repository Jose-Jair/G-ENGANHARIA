// Regras de negócio do módulo Financeiro (ETAPA 9)
// 1. Bloqueio no servidor: não gera conta a pagar vinculada a executor/projeto sem medição aprovada (documento tipo 'medicao')
// 2. Bloqueio no servidor: não baixa conta (status 'paga') sem data de pagamento e comprovante (anexo_comprovante)
// 3. Bloqueio no servidor: cancelamento de conta requer motivo (motivo_cancelamento)
// 4. Bloqueio por fechamento financeiro pendente do projeto (quando configurado no parâmetro bloqueio_fechamento_financeiro_pendente)
// 5. Permissão de transição de status no servidor: Comercial e Gestor não podem alterar status de contas

onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name !== 'contas') {
    e.next()
    return
  }

  // 1. Verificar permissão de papel no request
  let role = ''
  try {
    const reqInfo = e.requestInfo()
    if (reqInfo && reqInfo.auth) {
      role = reqInfo.auth.getString('role')
    }
  } catch (_) {}

  // Apenas Admin e Financeiro têm permissão para manipular contas
  if (role && role !== 'admin' && role !== 'financeiro') {
    throw new BadRequestError(
      'BLOQUEIO: Apenas Administrador e Financeiro têm permissão para gerenciar contas.',
    )
  }

  const tipo = rec.getString('tipo')
  const status = rec.getString('status')
  const executorId = rec.getString('executor')
  const projetoId = rec.getString('projeto')
  const anexoComprovante = rec.getString('anexo_comprovante')
  const dataPagamento = rec.getString('data_pagamento')
  const motivoCancelamento = rec.getString('motivo_cancelamento')
  const original = rec.original()
  const oldStatus = original ? original.getString('status') : ''

  // Regra A: Bloqueio no servidor: cancelamento requer motivo
  if (status === 'cancelada' && !motivoCancelamento) {
    throw new BadRequestError(
      'BLOQUEIO: O cancelamento de uma conta exige a informação do motivo de cancelamento.',
    )
  }

  // Regra B: Bloqueio no servidor: não baixa conta sem data de liquidação e comprovante anexado
  if (status === 'paga') {
    if (!dataPagamento) {
      throw new BadRequestError(
        'BLOQUEIO: Para liquidar/baixar a conta como Paga/Recebida, informe a data de pagamento/recebimento.',
      )
    }
    if (!anexoComprovante) {
      throw new BadRequestError(
        'BLOQUEIO: Não é permitido baixar a conta sem anexo do comprovante de pagamento/recebimento.',
      )
    }
  }

  // Regra C: Bloqueio no servidor: não gera conta a pagar de subcontratação sem medição aprovada
  // Se for conta a pagar vinculada a executor
  if (tipo === 'pagar' && executorId) {
    const medicaoOrigem = rec.getString('medicao_aprovada_origem')
    if (!medicaoOrigem) {
      // Verificar se existe no projeto algum documento do tipo 'medicao'
      let temMedicao = false
      if (projetoId) {
        try {
          const docs = $app.findRecordsByFilter(
            'documentos',
            "projeto = '" + projetoId + "' && tipo = 'medicao'",
            '-created',
            5,
            0,
          )
          if (docs && docs.length > 0) {
            temMedicao = true
            rec.set('medicao_aprovada_origem', docs[0].getString('numero') || docs[0].id)
          }
        } catch (_) {}
      }

      if (!temMedicao) {
        throw new BadRequestError(
          'BLOQUEIO: Não é permitido gerar conta a pagar de subcontratação sem medição aprovada vinculada ao projeto/etapa.',
        )
      }
    }
  }

  // Regra D: Bloqueio quando o projeto estiver com fechamento financeiro pendente (parâmetro)
  if (projetoId) {
    try {
      let bloqueioAtivo = true
      try {
        const param = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'bloqueio_fechamento_financeiro_pendente',
        )
        if (param) {
          bloqueioAtivo = param.getString('valor') === 'true'
        }
      } catch (_) {}

      if (bloqueioAtivo) {
        const proj = $app.findRecordById('projetos', projetoId)
        if (proj && proj.getString('status') === 'fechamento_pendente') {
          // Se a conta for marcada como bloqueada
          rec.set('bloqueada_por_fechamento', true)
          // Se estiver tentando alterar status de uma conta já bloqueada
          if (oldStatus && oldStatus !== status && status !== 'cancelada') {
            throw new BadRequestError(
              'BLOQUEIO: Projeto ' +
                proj.getString('codigo') +
                ' possui fechamento financeiro pendente. Movimentações bloqueadas por parâmetro.',
            )
          }
        }
      }
    } catch (err) {
      if (err && err.message && err.message.startsWith('BLOQUEIO:')) {
        throw err
      }
    }
  }

  e.next()
})

// Registro de auditoria financeira rica em ações críticas (aprovação, envio de cobrança, baixa e cancelamento)
onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    if (rec.collection().name !== 'contas') {
      return
    }

    const original = rec.original()
    const oldStatus = original ? original.getString('status') : ''
    const newStatus = rec.getString('status')

    if (oldStatus !== newStatus) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)

        let acao = 'STATUS_CONTA_' + newStatus.toUpperCase()
        if (newStatus === 'aprovada') acao = 'APROVACAO_CONTA'
        if (newStatus === 'enviada') acao = 'ENVIO_REMESSA_COBRANCA'
        if (newStatus === 'paga') acao = 'BAIXA_LIQUIDACAO_CONTA'
        if (newStatus === 'cancelada') acao = 'CANCELAMENTO_CONTA'

        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA')
        aRec.set('acao', acao)
        aRec.set('entidade', 'contas')
        aRec.set('registro_id', rec.id)
        aRec.set('detalhes', {
          origem: 'SISTEMA / GATILHO AUTOMÁTICO',
          tipo: rec.getString('tipo'),
          descricao: rec.getString('descricao'),
          valor: rec.getFloat('valor'),
          status_anterior: oldStatus,
          status_novo: newStatus,
          data_pagamento: rec.getString('data_pagamento'),
          forma_pagamento: rec.getString('forma_pagamento'),
          motivo_cancelamento: rec.getString('motivo_cancelamento'),
          executor_id: rec.getString('executor'),
          projeto_id: rec.getString('projeto'),
          comprovante: rec.getString('anexo_comprovante'),
        })

        $app.save(aRec)
      } catch (err) {
        console.log('Erro ao auditar transição financeira: ' + err)
      }
    }
  } finally {
    e.next()
  }
})
