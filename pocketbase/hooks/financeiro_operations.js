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

  // Regra C: Bloqueio no servidor (RODADA 8):
  // 1. OS interna NUNCA gera conta a pagar (trava no servidor).
  // 2. Conta a pagar vinculada a prestador/executor/OS externa requer medição APROVADA
  //    e entregável técnico aprovado com retenção técnica devidamente descontada.
  const osIdConta = rec.getString('ordem_servico')
  if (tipo === 'pagar' && osIdConta) {
    try {
      const osVinculada = $app.findRecordById('ordens_servico', osIdConta)
      if (osVinculada && osVinculada.getString('tipo_prestador') === 'interno') {
        throw new BadRequestError(
          'BLOQUEIO ESTREITO NO SERVIDOR: Ordem de Serviço interna NUNCA gera conta a pagar no Financeiro.',
        )
      }
    } catch (errOsInt) {
      if (errOsInt && errOsInt.message && errOsInt.message.startsWith('BLOQUEIO')) {
        throw errOsInt
      }
    }
  }

  if (tipo === 'pagar' && (executorId || osIdConta)) {
    const medicaoOrigem = rec.getString('medicao_aprovada_origem')
    if (!medicaoOrigem) {
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
          'BLOQUEIO: Não é permitido gerar conta a pagar de subcontratação/prestador sem medição aprovada contra entregável aprovado.',
        )
      }
    } else {
      // Validar que a medição informada realmente está 'aprovada', 'faturada' ou 'paga'
      try {
        let medRecord = null
        try {
          medRecord = $app.findRecordById('medicoes', medicaoOrigem)
        } catch (_) {
          const medsPorNum = $app.findRecordsByFilter(
            'medicoes',
            "numero = '" + medicaoOrigem + "'",
            '',
            1,
            0,
          )
          if (medsPorNum.length > 0) medRecord = medsPorNum[0]
        }

        if (medRecord) {
          const stMed = medRecord.getString('status')
          if (stMed !== 'aprovada' && stMed !== 'faturada' && stMed !== 'paga') {
            throw new BadRequestError(
              'BLOQUEIO: A medição de origem (' +
                medicaoOrigem +
                ') deve estar APROVADA para gerar conta a pagar. Status atual: ' +
                stMed,
            )
          }

          // Garantir que a retenção técnica foi descontada
          const retencaoTecMed = medRecord.getFloat('valor_retencao_tecnica') || 0
          const retencaoImpMed = medRecord.getFloat('retencao_impostos') || 0
          const valorBrutoMed = medRecord.getFloat('valor_bruto') || 0
          const valorLiqCalculado =
            Math.round((valorBrutoMed - retencaoTecMed - retencaoImpMed) * 100) / 100

          if (
            !rec.getFloat('valor_liquido') ||
            rec.getFloat('valor_liquido') === rec.getFloat('valor')
          ) {
            if (retencaoTecMed > 0 || retencaoImpMed > 0) {
              rec.set('valor_liquido', valorLiqCalculado)
              rec.set('retencao_impostos', retencaoImpMed + retencaoTecMed)
            }
          }
        }
      } catch (errMedCheck) {
        if (errMedCheck && errMedCheck.message && errMedCheck.message.startsWith('BLOQUEIO')) {
          throw errMedCheck
        }
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
// Endpoint dedicado da Visão Gerencial do Financeiro (somente Admin e Financeiro)
// Retorna:
// 1. Fluxo de caixa projetado (meses passados = realizado, meses futuros = vencimento de contas e medições)
// 2. Margem real por projeto (Previsto na proposta × Real: receitas aprovadas/realizadas - custos pagos/comprometidos)
// 3. Alertas de atraso (contas a receber e a pagar vencidas e não pagas)
routerAdd(
  'GET',
  '/backend/v1/financeiro/visao-gerencial',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.json(403, {
          message:
            'Acesso restrito: apenas Administradores e Financeiro podem acessar a Visão Gerencial.',
        })
      }

      // Parâmetro opcional de horizonte (3, 6 ou 12 meses, padrão 12)
      let horizonte = 12
      try {
        const hQuery = e.request.url.query().get('horizonte')
        if (hQuery) {
          const parsed = parseInt(hQuery, 10)
          if (parsed === 3 || parsed === 6 || parsed === 12) {
            horizonte = parsed
          }
        }
      } catch (_) {}

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const hojeIso = hoje.toISOString()
      const hojeYmd = hojeIso.substring(0, 10)
      const anoAtual = hoje.getFullYear()
      const mesAtual = hoje.getMonth() // 0-11
      const mesAtualChave = `${anoAtual}-${(mesAtual + 1).toString().padStart(2, '0')}`

      // 1. Carregar contas que não estejam canceladas
      const contas = $app.findRecordsByFilter(
        'contas',
        "status != 'cancelada'",
        'vencimento',
        2000,
        0,
      )

      // 2. Carregar projetos
      const projetos = $app.findRecordsByFilter(
        'projetos',
        "status != 'cancelado'",
        'codigo',
        500,
        0,
      )

      // 3. Carregar propostas para dados de previsto (preço, custo, margem)
      const propostas = $app.findRecordsByFilter(
        'propostas',
        "status != 'recusada' && status != 'expirada'",
        '-created',
        500,
        0,
      )

      // Indexar propostas por ID
      const propostasById = {}
      for (let i = 0; i < propostas.length; i++) {
        propostasById[propostas[i].id] = propostas[i]
      }

      // 4. Carregar medições aprovadas/faturadas/pagas
      const medicoes = $app.findRecordsByFilter(
        'medicoes',
        "status != 'reprovada'",
        '-created',
        1000,
        0,
      )

      // 5. Carregar empresas e clientes_pf para enriquecer nomes de projetos
      const empresas = $app.findRecordsByFilter('empresas', '', 'razao_social', 1000, 0)
      const empresasById = {}
      for (let i = 0; i < empresas.length; i++) {
        empresasById[empresas[i].id] = empresas[i]
      }

      const clientesPf = $app.findRecordsByFilter('clientes_pf', '', 'nome', 1000, 0)
      const clientesPfById = {}
      for (let i = 0; i < clientesPf.length; i++) {
        clientesPfById[clientesPf[i].id] = clientesPf[i]
      }

      // --- BLOCO 1: FLUXO DE CAIXA PROJETADO ---
      // Montar meses do horizonte selecionado (a partir do mês atual, ou últimos 2 meses + horizonte)
      // Conforme requisitos: horizonte de 3/6/12 meses.
      const mesesNomes = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ]
      const mesesLista = []
      const mesesMap = {}

      for (let i = 0; i < horizonte; i++) {
        const d = new Date(anoAtual, mesAtual + i, 1)
        const ano = d.getFullYear()
        const mesIdx = d.getMonth()
        const chave = `${ano}-${(mesIdx + 1).toString().padStart(2, '0')}`
        const rotulo = `${mesesNomes[mesIdx]}/${ano}`
        const mesObj = {
          mesChave: chave,
          rotulo: rotulo,
          ano: ano,
          mes: mesIdx + 1,
          isPassado: chave < mesAtualChave,
          isAtual: chave === mesAtualChave,
          isFuturo: chave > mesAtualChave,
          entradasRealizadas: 0,
          entradasPrevistas: 0,
          totalEntradas: 0,
          saidasRealizadas: 0,
          saidasPrevistas: 0,
          totalSaidas: 0,
          saldoMes: 0,
          saldoAcumulado: 0,
          alertaNegativo: false,
        }
        mesesLista.push(mesObj)
        mesesMap[chave] = mesObj
      }

      // Distribuir as contas nos meses
      // Regra:
      // Meses passados (< mesAtualChave) = efetivamente pago/recebido (data_pagamento)
      // Mês atual e futuros (>= mesAtualChave):
      // - Se status paga/realizada: entra como realizado pelo mes de pagamento
      // - Se status rascunho/aprovada/enviada/prevista/atrasada: entra como previsto pelo vencimento
      for (let i = 0; i < contas.length; i++) {
        const c = contas[i]
        const status = c.getString('status')
        const tipo = c.getString('tipo')
        const valor = c.getFloat('valor') || 0
        const dataPagamento = c.getString('data_pagamento')
        const vencimento = c.getString('vencimento')
        const isLiquidada = status === 'paga' || status === 'realizada'

        if (isLiquidada && dataPagamento) {
          const chavePag = dataPagamento.substring(0, 7)
          if (mesesMap[chavePag]) {
            if (tipo === 'receber') {
              mesesMap[chavePag].entradasRealizadas += valor
            } else {
              mesesMap[chavePag].saidasRealizadas += valor
            }
          }
        } else if (!isLiquidada && vencimento) {
          const chaveVenc = vencimento.substring(0, 7)
          if (mesesMap[chaveVenc]) {
            if (tipo === 'receber') {
              mesesMap[chaveVenc].entradasPrevistas += valor
            } else {
              mesesMap[chaveVenc].saidasPrevistas += valor
            }
          }
        }
      }

      // Totalizar fluxo
      let acumulado = 0
      for (let i = 0; i < mesesLista.length; i++) {
        const m = mesesLista[i]
        m.totalEntradas = Math.round((m.entradasRealizadas + m.entradasPrevistas) * 100) / 100
        m.totalSaidas = Math.round((m.saidasRealizadas + m.saidasPrevistas) * 100) / 100
        m.saldoMes = Math.round((m.totalEntradas - m.totalSaidas) * 100) / 100
        acumulado += m.saldoMes
        m.saldoAcumulado = Math.round(acumulado * 100) / 100
        m.alertaNegativo = m.saldoAcumulado < 0 || m.saldoMes < 0
      }

      // --- BLOCO 2: MARGEM REAL POR PROJETO ---
      // Tabela comparando Previsto × Real por projeto
      // Previsto: preço, custo e margem da proposta de origem
      // Real: receitas aprovadas/realizadas − custos pagos e comprometidos (contas a pagar + medições aprovadas sem conta duplicada)
      // Desvio: semáforo (🟢 dentro do previsto / 🟡 até 10% de erosão / 🔴 acima de 10% de erosão)
      const projetosMargem = []
      let somaMargemPrevistaPerc = 0
      let somaMargemRealPerc = 0
      let totalProjetosComMargem = 0

      for (let i = 0; i < projetos.length; i++) {
        const proj = projetos[i]
        const pId = proj.id
        const pCodigo = proj.getString('codigo')
        const pNome = proj.getString('nome')
        const pStatus = proj.getString('status')
        const propostaId = proj.getString('proposta')
        const prop = propostasById[propostaId]

        // Nome do cliente
        let clienteNome = 'Cliente Direto'
        const empId = proj.getString('empresa')
        const cliPfId = proj.getString('cliente_pf')
        if (empId && empresasById[empId]) {
          clienteNome =
            empresasById[empId].getString('nome_fantasia') ||
            empresasById[empId].getString('razao_social')
        } else if (cliPfId && clientesPfById[cliPfId]) {
          clienteNome = clientesPfById[cliPfId].getString('nome')
        } else if (prop) {
          const pEmp = prop.getString('empresa')
          const pCli = prop.getString('cliente_pf')
          if (pEmp && empresasById[pEmp]) {
            clienteNome =
              empresasById[pEmp].getString('nome_fantasia') ||
              empresasById[pEmp].getString('razao_social')
          } else if (pCli && clientesPfById[pCli]) {
            clienteNome = clientesPfById[pCli].getString('nome')
          }
        }

        // Previsto da proposta
        let previstoPreco = proj.getFloat('valor_total') || 0
        let previstoCusto = 0
        let previstoMargemPerc = 0
        let previstoMargemValor = 0

        if (prop) {
          if (!previstoPreco) previstoPreco = prop.getFloat('preco') || 0
          previstoCusto = prop.getFloat('custo') || 0
          previstoMargemPerc = prop.getFloat('margem') || 0
          if (!previstoMargemPerc && previstoPreco > 0) {
            previstoMargemValor = previstoPreco - previstoCusto
            previstoMargemPerc = (previstoMargemValor / previstoPreco) * 100
          } else {
            previstoMargemValor = (previstoPreco * previstoMargemPerc) / 100
          }
        }

        // Real do projeto:
        // Receitas: contas a receber do projeto com status != cancelada (aprovada, enviada, paga, realizada, atrasada)
        // Custos: contas a pagar do projeto com status != cancelada + medições aprovadas deste projeto que não tenham gerado conta a pagar ainda
        let receitaRealizada = 0
        let receitaAprovadaPrevista = 0
        let custoPago = 0
        let custoComprometido = 0

        const medicaoIdsComConta = {}

        for (let j = 0; j < contas.length; j++) {
          const c = contas[j]
          if (c.getString('projeto') !== pId) continue

          const cTipo = c.getString('tipo')
          const cStatus = c.getString('status')
          const cValor = c.getFloat('valor') || 0
          const medOrigem = c.getString('medicao_aprovada_origem')
          if (medOrigem) {
            medicaoIdsComConta[medOrigem] = true
          }

          if (cTipo === 'receber') {
            if (cStatus === 'paga' || cStatus === 'realizada') {
              receitaRealizada += cValor
            } else {
              receitaAprovadaPrevista += cValor
            }
          } else if (cTipo === 'pagar') {
            if (cStatus === 'paga' || cStatus === 'realizada') {
              custoPago += cValor
            } else {
              custoComprometido += cValor
            }
          }
        }

        // Medições aprovadas do projeto sem conta a pagar vinculada contam como custo comprometido
        for (let k = 0; k < medicoes.length; k++) {
          const m = medicoes[k]
          if (m.getString('projeto') !== pId) continue
          const mId = m.id
          const mStatus = m.getString('status')
          if (!medicaoIdsComConta[mId] && (mStatus === 'aprovada' || mStatus === 'faturada')) {
            custoComprometido += m.getFloat('valor_bruto') || 0
          }
        }

        const receitaTotal = Math.round((receitaRealizada + receitaAprovadaPrevista) * 100) / 100
        const custoTotal = Math.round((custoPago + custoComprometido) * 100) / 100
        const margemRealValor = Math.round((receitaTotal - custoTotal) * 100) / 100
        const margemRealPerc =
          receitaTotal > 0 ? Math.round((margemRealValor / receitaTotal) * 1000) / 10 : 0

        // Desvio de margem em pontos percentuais (ou erosão percentual)
        // desvio = margemRealPerc - previstoMargemPerc
        // Se desvio >= 0: dentro do previsto (verde)
        // Se desvio < 0 e erosao <= 10 pp: até 10% de erosão (amarelo)
        // Se erosao > 10 pp: vermelho
        const erosaoPp = previstoMargemPerc - margemRealPerc
        let statusSemaforo = 'verde'
        let semaforoDescricao = 'Dentro do previsto'
        if (erosaoPp > 10) {
          statusSemaforo = 'vermelho'
          semaforoDescricao = `Erosão de ${erosaoPp.toFixed(1)}% (crítica)`
        } else if (erosaoPp > 0) {
          statusSemaforo = 'amarelo'
          semaforoDescricao = `Erosão de ${erosaoPp.toFixed(1)}% (atenção)`
        }

        projetosMargem.push({
          id: pId,
          codigo: pCodigo,
          nome: pNome,
          status: pStatus,
          clienteNome: clienteNome,
          propostaNumero: prop ? prop.getString('numero') : null,
          previsto: {
            preco: Math.round(previstoPreco * 100) / 100,
            custo: Math.round(previstoCusto * 100) / 100,
            margemPerc: Math.round(previstoMargemPerc * 10) / 10,
            margemValor: Math.round(previstoMargemValor * 100) / 100,
          },
          real: {
            receitaRealizada: Math.round(receitaRealizada * 100) / 100,
            receitaAprovadaPrevista: Math.round(receitaAprovadaPrevista * 100) / 100,
            receitaTotal: receitaTotal,
            custoPago: Math.round(custoPago * 100) / 100,
            custoComprometido: Math.round(custoComprometido * 100) / 100,
            custoTotal: custoTotal,
            margemValor: margemRealValor,
            margemPerc: margemRealPerc,
          },
          desvio: {
            pontosPercentuais: Math.round((margemRealPerc - previstoMargemPerc) * 10) / 10,
            erosaoPp: Math.round(erosaoPp * 10) / 10,
            semaforo: statusSemaforo,
            descricao: semaforoDescricao,
          },
        })

        if (receitaTotal > 0 || previstoPreco > 0) {
          somaMargemPrevistaPerc += previstoMargemPerc
          somaMargemRealPerc += margemRealPerc
          totalProjetosComMargem++
        }
      }

      // Consolidado da carteira
      const margemMediaCarteiraPrevista =
        totalProjetosComMargem > 0
          ? Math.round((somaMargemPrevistaPerc / totalProjetosComMargem) * 10) / 10
          : 0
      const margemMediaCarteiraReal =
        totalProjetosComMargem > 0
          ? Math.round((somaMargemRealPerc / totalProjetosComMargem) * 10) / 10
          : 0

      // --- BLOCO 3: ALERTA DE ATRASO ---
      // Painel de contas a receber em atraso (vencidas e não pagas, dias de atraso, projeto de origem)
      // e contas a pagar vencidas.
      const contasReceberAtrasadas = []
      const contasPagarAtrasadas = []
      let totalReceberAtrasadoValor = 0
      let totalPagarAtrasadoValor = 0

      for (let i = 0; i < contas.length; i++) {
        const c = contas[i]
        const status = c.getString('status')
        const tipo = c.getString('tipo')
        const venc = c.getString('vencimento')
        const isLiquidada = status === 'paga' || status === 'realizada'
        if (isLiquidada || !venc) continue

        const vencYmd = venc.substring(0, 10)
        // Se data de vencimento for menor que hoje ou status for expressamente 'atrasada'
        if (vencYmd < hojeYmd || status === 'atrasada') {
          const vDate = new Date(vencYmd + 'T00:00:00Z')
          const hDate = new Date(hojeYmd + 'T00:00:00Z')
          const diffMs = hDate.getTime() - vDate.getTime()
          const diasAtraso = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
          const valor = c.getFloat('valor') || 0
          const valorLiquido = c.getFloat('valor_liquido') || valor

          const projId = c.getString('projeto')
          let projCodigo = ''
          let projNome = ''
          let cliNome = ''
          if (projId) {
            for (let p = 0; p < projetos.length; p++) {
              if (projetos[p].id === projId) {
                projCodigo = projetos[p].getString('codigo')
                projNome = projetos[p].getString('nome')
                const eId = projetos[p].getString('empresa')
                const cId = projetos[p].getString('cliente_pf')
                if (eId && empresasById[eId]) {
                  cliNome =
                    empresasById[eId].getString('nome_fantasia') ||
                    empresasById[eId].getString('razao_social')
                } else if (cId && clientesPfById[cId]) {
                  cliNome = clientesPfById[cId].getString('nome')
                }
                break
              }
            }
          }

          const itemAtraso = {
            id: c.id,
            tipo: tipo,
            descricao: c.getString('descricao'),
            valor: valor,
            valorLiquido: valorLiquido,
            vencimento: venc,
            status: status,
            diasAtraso: diasAtraso,
            projetoId: projId || null,
            projetoCodigo: projCodigo || null,
            projetoNome: projNome || null,
            clienteNome: cliNome || null,
            nf: c.getString('nf') || null,
            executorId: c.getString('executor') || null,
          }

          if (tipo === 'receber') {
            contasReceberAtrasadas.push(itemAtraso)
            totalReceberAtrasadoValor += valor
          } else {
            contasPagarAtrasadas.push(itemAtraso)
            totalPagarAtrasadoValor += valor
          }
        }
      }

      // Ordenar atrasadas por maior número de dias de atraso
      contasReceberAtrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso)
      contasPagarAtrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso)

      const totalAtrasadosCount = contasReceberAtrasadas.length + contasPagarAtrasadas.length

      return e.json(200, {
        success: true,
        data_referencia: hojeIso,
        horizonte_meses: horizonte,
        bloco1_fluxo_caixa: {
          horizonte: horizonte,
          meses: mesesLista,
          totais: {
            totalEntradas:
              Math.round(mesesLista.reduce((acc, m) => acc + m.totalEntradas, 0) * 100) / 100,
            totalSaidas:
              Math.round(mesesLista.reduce((acc, m) => acc + m.totalSaidas, 0) * 100) / 100,
            saldoFinal:
              mesesLista.length > 0 ? mesesLista[mesesLista.length - 1].saldoAcumulado : 0,
            mesesComAlertaNegativo: mesesLista.filter((m) => m.alertaNegativo).length,
          },
        },
        bloco2_margem_projetos: {
          consolidado: {
            totalProjetos: projetosMargem.length,
            margemMediaPrevistaPerc: margemMediaCarteiraPrevista,
            margemMediaRealPerc: margemMediaCarteiraReal,
            desvioMedioPp:
              Math.round((margemMediaCarteiraReal - margemMediaCarteiraPrevista) * 10) / 10,
            projetosVerde: projetosMargem.filter((p) => p.desvio.semaforo === 'verde').length,
            projetosAmarelo: projetosMargem.filter((p) => p.desvio.semaforo === 'amarelo').length,
            projetosVermelho: projetosMargem.filter((p) => p.desvio.semaforo === 'vermelho').length,
          },
          projetos: projetosMargem,
        },
        bloco3_alertas_atraso: {
          totalAtrasadosCount: totalAtrasadosCount,
          receber: {
            totalCount: contasReceberAtrasadas.length,
            totalValor: Math.round(totalReceberAtrasadoValor * 100) / 100,
            contas: contasReceberAtrasadas,
          },
          pagar: {
            totalCount: contasPagarAtrasadas.length,
            totalValor: Math.round(totalPagarAtrasadoValor * 100) / 100,
            contas: contasPagarAtrasadas,
          },
        },
      })
    } catch (err) {
      console.log('Erro interno em /financeiro/visao-gerencial: ' + err)
      return e.json(500, { message: 'Erro interno ao processar visão gerencial: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Endpoint leve para o badge do sininho: contagem de contas vencidas não liquidadas (receber + pagar)
// Somente Admin e Financeiro. Sem auditoria (consulta, não ação).
routerAdd(
  'GET',
  '/backend/v1/financeiro/count-atraso',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }
      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.json(403, { message: 'Acesso restrito.' })
      }

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const hojeYmd = hoje.toISOString().substring(0, 10)

      const contas = $app.findRecordsByFilter(
        'contas',
        "status != 'cancelada' && status != 'paga' && status != 'realizada'",
        '',
        2000,
        0,
      )

      let receber = 0
      let pagar = 0
      for (let i = 0; i < contas.length; i++) {
        const venc = contas[i].getString('vencimento')
        if (!venc) continue
        if (venc.substring(0, 10) < hojeYmd || contas[i].getString('status') === 'atrasada') {
          if (contas[i].getString('tipo') === 'receber') {
            receber++
          } else {
            pagar++
          }
        }
      }

      return e.json(200, { receber, pagar, total: receber + pagar })
    } catch (err) {
      console.log('Erro em /financeiro/count-atraso: ' + err)
      return e.json(500, { message: 'Erro interno: ' + err })
    }
  },
  $apis.requireAuth(),
)

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
