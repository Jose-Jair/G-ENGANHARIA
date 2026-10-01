migrate(
  (app) => {
    const contasCol = app.findCollectionByNameOrId('contas')

    // 1. Atualizar contas a receber legadas com status 'prevista'/'realizada' para o novo vocabulário
    // ('realizada' -> 'paga', 'prevista' -> 'aprovada')
    try {
      app.db().newQuery("UPDATE contas SET status = 'paga' WHERE status = 'realizada'").execute()
      app.db().newQuery("UPDATE contas SET status = 'aprovada' WHERE status = 'prevista'").execute()
    } catch (e) {
      console.log('Erro ao normalizar status legados de contas: ' + e)
    }

    // Obter referências de projetos, etapas e executores existentes
    let prj1 = null
    let prj2 = null
    let etp1 = null
    let execVértice = null
    let execRoberto = null
    let propNovaInfra = null

    try {
      prj1 = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-001')
    } catch (_) {
      try {
        const prjs = app.findRecordsByFilter('projetos', '', '-created', 1, 0)
        if (prjs.length > 0) prj1 = prjs[0]
      } catch (_) {}
    }

    try {
      prj2 = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-031')
    } catch (_) {}

    try {
      const etps = app.findRecordsByFilter(
        'projeto_etapas',
        "tipo_execucao = 'terceirizada'",
        '-created',
        2,
        0,
      )
      if (etps.length > 0) etp1 = etps[0]
    } catch (_) {}

    try {
      execVértice = app.findFirstRecordByData('executores', 'cpf_cnpj', '12.345.678/0001-90')
    } catch (_) {}

    try {
      execRoberto = app.findFirstRecordByData('executores', 'cpf_cnpj', '234.567.890-12')
    } catch (_) {}

    try {
      propNovaInfra = app.findFirstRecordByData('propostas', 'numero', 'PROP-2026-099')
    } catch (_) {}

    const hoje = new Date()
    const dMenos45 =
      new Date(hoje.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMenos20 =
      new Date(hoje.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMenos10 =
      new Date(hoje.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais1 =
      new Date(hoje.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais5 =
      new Date(hoje.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais15 =
      new Date(hoje.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais30 =
      new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais60 =
      new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'
    const dMais90 =
      new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
      ' 12:00:00.000Z'

    // 2. Criar contas a receber simulando todos os status e caso reincidente de atraso
    const seedContas = [
      // Caso de parceiro com atrasos históricos reincidentes: Nova Infra Rodovias (propNovaInfra)
      {
        tipo: 'receber',
        proposta: propNovaInfra ? propNovaInfra.id : undefined,
        projeto: prj2 ? prj2.id : undefined,
        descricao: 'Parcela 1/3 - Mobilização e Ensaio Estrutural (Atraso Histórico Liquidado)',
        valor: 86600,
        vencimento: dMenos45,
        data_pagamento: dMenos20,
        forma_pagamento: 'Boleto Bancário',
        nf: 'NFe-2026/0410',
        status: 'paga',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'receber',
        proposta: propNovaInfra ? propNovaInfra.id : undefined,
        projeto: prj2 ? prj2.id : undefined,
        descricao: 'Parcela 2/3 - Relatório de Cálculo e Reforço de Viga (Atualmente em Atraso)',
        valor: 86600,
        vencimento: dMenos10,
        data_pagamento: null,
        forma_pagamento: 'Boleto Bancário',
        nf: 'NFe-2026/0488',
        status: 'atrasada',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'receber',
        proposta: propNovaInfra ? propNovaInfra.id : undefined,
        projeto: prj2 ? prj2.id : undefined,
        descricao: 'Parcela 3/3 - Conclusão e Termo de Entrega Definitivo',
        valor: 86800,
        vencimento: dMais30,
        forma_pagamento: 'Boleto Bancário',
        nf: '',
        status: 'enviada',
        bloqueada_por_fechamento: false,
      },
      // Conta a receber em Rascunho
      {
        tipo: 'receber',
        projeto: prj1 ? prj1.id : undefined,
        descricao: 'Faturamento de Sinal - Serviços Complementares de Sondagem',
        valor: 45000,
        vencimento: dMais15,
        forma_pagamento: 'Pix',
        status: 'rascunho',
        bloqueada_por_fechamento: false,
      },
      // Conta a receber Aprovada
      {
        tipo: 'receber',
        projeto: prj1 ? prj1.id : undefined,
        descricao: 'Medição BM-01 - Liberação de Pranchas de Fundação',
        valor: 110000,
        vencimento: dMais5,
        forma_pagamento: 'Boleto 15 dias',
        status: 'aprovada',
        bloqueada_por_fechamento: false,
      },
      // Conta a receber Enviada (Vencimento D-1)
      {
        tipo: 'receber',
        projeto: prj1 ? prj1.id : undefined,
        descricao: 'Medição BM-02 - Alerta D-1 Remessa de Cobrança Registrada',
        valor: 75000,
        vencimento: dMais1,
        forma_pagamento: 'Boleto Registrado',
        nf: 'NF-e 8812',
        status: 'enviada',
        bloqueada_por_fechamento: false,
      },
      // Conta a receber Cancelada com motivo
      {
        tipo: 'receber',
        descricao: 'Cobrança Avulsa de Revisão de Projeto Cancelada',
        valor: 18000,
        vencimento: dMenos20,
        forma_pagamento: 'Transferência',
        status: 'cancelada',
        motivo_cancelamento:
          'Serviço renegociado e incorporado no aditivo contratual geral do projeto.',
        bloqueada_por_fechamento: false,
      },
      // 3. Contas a pagar (Subcontratações vinculadas a medição de executores)
      {
        tipo: 'pagar',
        executor: execVértice ? execVértice.id : undefined,
        projeto: prj1 ? prj1.id : undefined,
        etapa: etp1 ? etp1.id : undefined,
        descricao: 'Subcontratação - Medição BM-01: Cálculo Estrutural Superestrutura',
        valor: 58000,
        retencao_impostos: 6670, // 11.5%
        valor_liquido: 51330,
        vencimento: dMais5,
        forma_pagamento: 'Transferência Bancária (PIX)',
        nf: 'NFS-e 4490 (Vértice)',
        status: 'aprovada',
        medicao_aprovada_origem: 'BM-01/2026',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        executor: execRoberto ? execRoberto.id : undefined,
        projeto: prj1 ? prj1.id : undefined,
        descricao: 'Subcontratação - Medição Elétrica e Laudo SPDA',
        valor: 24000,
        retencao_impostos: 2760,
        valor_liquido: 21240,
        vencimento: dMais1,
        forma_pagamento: 'PIX',
        nf: 'RPA-2026/012',
        status: 'aprovada',
        medicao_aprovada_origem: 'BM-01/2026',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        executor: execVértice ? execVértice.id : undefined,
        descricao: 'Subcontratação - Análise Térmica e Detalhamento de Armaduras (Atrasada)',
        valor: 32000,
        retencao_impostos: 3680,
        valor_liquido: 28320,
        vencimento: dMenos10,
        forma_pagamento: 'Transferência',
        nf: 'NFS-e 4310',
        status: 'atrasada',
        medicao_aprovada_origem: 'BM-01/2026',
        bloqueada_por_fechamento: false,
      },
      // 4. Despesas internas a pagar (Aluguel, Folha, Impostos, Softwares)
      {
        tipo: 'pagar',
        descricao: 'Despesa Operacional - Locação da Sede e Salas de Reunião',
        valor: 14500,
        vencimento: dMais5,
        forma_pagamento: 'Boleto Bancário',
        nf: 'Recibo Imobiliária 09/2026',
        status: 'aprovada',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        descricao: 'Folha de Pagamento - Equipe de Engenharia e Gestão Técnica',
        valor: 48000,
        vencimento: dMais15,
        forma_pagamento: 'Transferência Bancária',
        nf: 'Folha 10/2026',
        status: 'aprovada',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        descricao: 'Tributos Federais - DAS Simples / PIS / COFINS / IRPJ',
        valor: 22400,
        vencimento: dMais30,
        forma_pagamento: 'DARF / Guia DAS',
        nf: 'Guia Tributária DAS',
        status: 'rascunho',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        descricao: 'Licenças de Softwares BIM e Modelagem Estrutural (TQS / Revit)',
        valor: 9800,
        vencimento: dMais60,
        forma_pagamento: 'Cartão Corporativo / Boleto',
        nf: 'Invoice 98112',
        status: 'aprovada',
        bloqueada_por_fechamento: false,
      },
      {
        tipo: 'pagar',
        descricao: 'Manutenção de Servidores e Infraestrutura em Nuvem (Skip Cloud)',
        valor: 3500,
        vencimento: dMais90,
        forma_pagamento: 'Boleto Bancário',
        nf: 'NF 5510',
        status: 'aprovada',
        bloqueada_por_fechamento: false,
      },
    ]

    for (let i = 0; i < seedContas.length; i++) {
      const cData = seedContas[i]
      try {
        const r = new Record(contasCol)
        r.set('tipo', cData.tipo)
        if (cData.projeto) r.set('projeto', cData.projeto)
        if (cData.proposta) r.set('proposta', cData.proposta)
        if (cData.executor) r.set('executor', cData.executor)
        if (cData.etapa) r.set('etapa', cData.etapa)
        r.set('descricao', cData.descricao)
        r.set('valor', cData.valor)
        if (cData.retencao_impostos) r.set('retencao_impostos', cData.retencao_impostos)
        if (cData.valor_liquido) r.set('valor_liquido', cData.valor_liquido)
        if (cData.vencimento) r.set('vencimento', cData.vencimento)
        if (cData.data_pagamento) r.set('data_pagamento', cData.data_pagamento)
        r.set('status', cData.status)
        if (cData.forma_pagamento) r.set('forma_pagamento', cData.forma_pagamento)
        if (cData.nf) r.set('nf', cData.nf)
        if (cData.motivo_cancelamento) r.set('motivo_cancelamento', cData.motivo_cancelamento)
        if (cData.medicao_aprovada_origem)
          r.set('medicao_aprovada_origem', cData.medicao_aprovada_origem)
        r.set('bloqueada_por_fechamento', !!cData.bloqueada_por_fechamento)

        app.save(r)
      } catch (err) {
        console.log('Erro ao inserir conta seed: ' + err)
      }
    }
  },
  (app) => {
    // Rollback
  },
)
