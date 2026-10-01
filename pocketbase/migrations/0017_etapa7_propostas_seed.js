migrate(
  (app) => {
    const catalogoCol = app.findCollectionByNameOrId('catalogo_servicos')
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const modelosCol = app.findCollectionByNameOrId('modelos')
    const motivosCol = app.findCollectionByNameOrId('motivos')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const clientesPfCol = app.findCollectionByNameOrId('clientes_pf')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const contasCol = app.findCollectionByNameOrId('contas')

    // 1. SEED DO CATÁLOGO DE SERVIÇOS DE ENGENHARIA
    const servicosIniciais = [
      {
        nome: 'Projeto Executivo Estrutural em Concreto Armado',
        disciplina: 'Estruturas',
        unidade: 'm²',
        preco_base: 38.5,
        descricao:
          'Dimensionamento completo, plantas de formas, armações, quantitativos de aço e concreto e modelo BIM IFC.',
        ativo: true,
      },
      {
        nome: 'Projeto de Fundações e Contenções Geotécnicas',
        disciplina: 'Geotecnia',
        unidade: 'm²',
        preco_base: 24.0,
        descricao:
          'Análise de sondagens SPT, dimensionamento de estacas, sapatas, cortinas atirantadas e laudo de estabilidade.',
        ativo: true,
      },
      {
        nome: 'Projeto Hidrossanitário e Drenagem Pluvial',
        disciplina: 'Instalações Hidráulicas',
        unidade: 'm²',
        preco_base: 18.0,
        descricao:
          'Rede de água fria, esgoto sanitário, ventilação, reúso de água pluvial e caixas de retenção.',
        ativo: true,
      },
      {
        nome: 'Projeto Elétrico e Subestação Abrigada',
        disciplina: 'Instalações Elétricas',
        unidade: 'un',
        preco_base: 14500.0,
        descricao:
          'Diagramas unifilares, malha de aterramento, SPDA e aprovação na concessionária de energia.',
        ativo: true,
      },
      {
        nome: 'Laudo Pericial de Patologia e Vistoria Cautelar de Vizinhança',
        disciplina: 'Engenharia Diagnóstica',
        unidade: 'un',
        preco_base: 6800.0,
        descricao:
          'Inspeção predial com registro fotográfico, análise termográfica, emissão de ART e parecer conclusivo.',
        ativo: true,
      },
      {
        nome: 'Modelagem da Informação da Construção (BIM Compatibilização)',
        disciplina: 'BIM / Gestão',
        unidade: 'm²',
        preco_base: 15.0,
        descricao:
          'Detecção de interferências (Clash Detection), relatórios de inconformidades e matriz de compatibilização.',
        ativo: true,
      },
      {
        nome: 'Plano de Gerenciamento de Resíduos da Construção Civil (PGRCC)',
        disciplina: 'Meio Ambiente',
        unidade: 'un',
        preco_base: 4200.0,
        descricao:
          'Levantamento de resíduos classe A, B, C e D e protocolo junto ao órgão ambiental municipal.',
        ativo: true,
      },
    ]

    const servicosCriados = []
    for (const s of servicosIniciais) {
      let rec
      try {
        rec = app.findFirstRecordByData('catalogo_servicos', 'nome', s.nome)
      } catch (_) {
        rec = new Record(catalogoCol)
        rec.set('nome', s.nome)
        rec.set('disciplina', s.disciplina)
        rec.set('unidade', s.unidade)
        rec.set('preco_base', s.preco_base)
        rec.set('descricao', s.descricao)
        rec.set('ativo', s.ativo)
        app.save(rec)
      }
      servicosCriados.push(rec)
    }

    // 2. SEED DE MODELOS DE PROPOSTA
    const modelosIniciais = [
      {
        nome: 'Proposta Padrão - Projetos Executivos Complementares',
        assunto: 'Proposta Técnica e Orçamentária — {orgao}',
        tipo: 'solucao_elaborada',
        corpo:
          'Prezados senhores da {nome},\n\nApresentamos nossa proposta técnica e comercial para elaboração dos projetos de engenharia vinculados ao contrato {orgao} ({valor_contrato}).\n\n1. ESCOPO:\nElaboração de projetos executivos detalhados para atendimento às exigências do órgão contratante, englobando cálculos, memoriais e modelos para aprovação.\n\n2. DISCIPLINAS:\n{disciplinas}\n\n3. PRAZO E CONDIÇÕES:\nPrazo estimado: {prazo}. Pagamento conforme medições.',
      },
      {
        nome: 'Proposta Padrão - Laudo Diagnóstico e Vistoria Cautelar',
        assunto: 'Proposta de Laudo Diagnóstico e Vistoria — {nome}',
        tipo: 'solucao_elaborada',
        corpo:
          'À atenção de {nome},\n\nEncaminhamos nossa proposta para realização de perícia técnica diagnóstica e emissão de laudo circunstanciado para a edificação em referência.\n\n1. ESCOPO:\nVistoria in loco, ensaios não destrutivos, mapeamento de anomalias e expedição de ART junto ao CREA.\n\n2. VALIDADE:\n15 dias corridos.',
      },
    ]

    for (const m of modelosIniciais) {
      try {
        app.findFirstRecordByData('modelos', 'nome', m.nome)
      } catch (_) {
        const rec = new Record(modelosCol)
        rec.set('nome', m.nome)
        rec.set('assunto', m.assunto)
        rec.set('tipo', m.tipo)
        rec.set('corpo', m.corpo)
        app.save(rec)
      }
    }

    // 3. SEED DE MOTIVOS DE RECUSA ESPECÍFICOS (tipo 'recusa_proposta')
    const motivosRecusaSeed = [
      'Preço acima do orçamento disponível',
      'Prazo de entrega superior ao exigido pela obra',
      'Opção por concorrente local',
      'Escopo técnico não aprovado pelo cliente final',
      'Cancelamento da licitação ou contrato público',
    ]

    for (const desc of motivosRecusaSeed) {
      try {
        app.findFirstRecordByData('motivos', 'descricao', desc)
      } catch (_) {
        const rec = new Record(motivosCol)
        rec.set('tipo', 'recusa_proposta')
        rec.set('descricao', desc)
        rec.set('ativo', true)
        app.save(rec)
      }
    }

    // Buscar IDs existentes de empresas, clientes PF e contratos
    const empresasList = app.findRecordsByFilter('empresas', 'id != ""', 'created', 10, 0)
    const clientesList = app.findRecordsByFilter('clientes_pf', 'id != ""', 'created', 10, 0)
    const contratosList = app.findRecordsByFilter('contratos', 'id != ""', 'created', 10, 0)
    const usersList = app.findRecordsByFilter('_pb_users_auth_', 'id != ""', 'created', 5, 0)

    const adminUser = usersList.find((u) => u.getString('role') === 'admin') || usersList[0]
    const comercialUser = usersList.find((u) => u.getString('role') === 'comercial') || usersList[0]
    const financeiroUser =
      usersList.find((u) => u.getString('role') === 'financeiro') || usersList[0]

    const empRioDoce =
      empresasList.find((e) => e.getString('nome_fantasia') === 'Rio Doce Engenharia') ||
      empresasList[0]
    const empCNEP =
      empresasList.find((e) => e.getString('nome_fantasia') === 'CNEP Projetos') || empresasList[1]
    const empSani =
      empresasList.find((e) => e.getString('nome_fantasia') === 'SaniPaulista') || empresasList[2]
    const pfAlbuquerque = clientesList[0]
    const pfHelena = clientesList[1]

    const contratoValadares =
      contratosList.find((c) => c.getString('numero') === 'CT-2024/048') || contratosList[0]
    const contratoSeduc =
      contratosList.find((c) => c.getString('numero') === 'SEDUC-CONV-2024-88') || contratosList[1]

    const anoAtual = new Date().getFullYear()

    // 4. SEED DE PROPOSTAS EM DIFERENTES STATUS:
    // PROP-AAAA-0001: ACEITA (com Projeto PRJ-AAAA-0001, Conta a Receber e Empresa Parceira gerados)
    // PROP-AAAA-0002: RECUSADA (com motivo)
    // PROP-AAAA-0003: RECUSADA (com motivo)
    // PROP-AAAA-0004: ENVIADA / VISUALIZADA
    // PROP-AAAA-0005: EM NEGOCIAÇÃO (D-3 para alerta)
    // PROP-AAAA-0006: APROVAÇÃO INTERNA (com parecer financeiro)
    // PROP-AAAA-0007: EXPIRADA
    // PROP-AAAA-0008: RASCUNHO (para Cliente PF)

    // PROPOSTA 1: ACEITA
    const prop1Num = `PROP-${anoAtual}-0001`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop1Num)
    } catch (_) {
      const p1 = new Record(propostasCol)
      p1.set('numero', prop1Num)
      p1.set('revisao', 'Rev.01')
      p1.set('empresa', empRioDoce ? empRioDoce.id : null)
      p1.set('contrato', contratoValadares ? contratoValadares.id : null)
      p1.set(
        'escopo',
        'Elaboração de Projeto Executivo Estrutural em Concreto Armado e Drenagem Pluvial do Corredor Viário Sul.',
      )
      p1.set('disciplinas', 'Estruturas, Drenagem Pluvial, BIM')
      p1.set('entregaveis', 'Plantas de formas, armações, memórias de cálculo e arquivo IFC')
      p1.set('prazo', '45 dias corridos')
      p1.set('custo', 58000.0)
      p1.set('margem', 35.0)
      p1.set('impostos', 16.5)
      p1.set('preco', 87870.0)
      p1.set(
        'condicoes_pagamento',
        '30% na assinatura, 40% na entrega parcial e 30% no aceite final',
      )
      p1.set('validade', '2026-11-30 23:59:59.000Z')
      p1.set('status', 'aceita')
      p1.set('token_aceite', 'token_aceite_demo_prop_0001_seed')
      p1.set('data_visualizacao', '2026-10-01 10:15:00.000Z')
      p1.set('data_aceite', '2026-10-01 14:30:00.000Z')
      p1.set('criado_por', comercialUser ? comercialUser.id : null)
      p1.set('aprovador_financeiro', financeiroUser ? financeiroUser.id : null)
      p1.set('parecer_financeiro', 'Margem de 35% e prazos compatíveis com nosso fluxo de caixa.')
      p1.set('itens_json', [
        {
          descricao: 'Projeto Executivo Estrutural em Concreto Armado',
          disciplina: 'Estruturas',
          unidade: 'm²',
          quantidade: 1000,
          custo_unitario: 38.5,
          custo_total: 38500.0,
        },
        {
          descricao: 'Projeto Hidrossanitário e Drenagem Pluvial',
          disciplina: 'Instalações Hidráulicas',
          unidade: 'm²',
          quantidade: 1000,
          custo_unitario: 19.5,
          custo_total: 19500.0,
        },
      ])
      app.save(p1)

      // Tríplice Consequência gerada para o seed:
      // (1) Projeto PRJ-AAAA-0001
      const prj1Cod = `PRJ-${anoAtual}-0001`
      let prj1
      try {
        prj1 = app.findFirstRecordByData('projetos', 'codigo', prj1Cod)
      } catch (_) {
        prj1 = new Record(projetosCol)
        prj1.set('codigo', prj1Cod)
        prj1.set('proposta', p1.id)
        if (contratoValadares) prj1.set('contrato', contratoValadares.id)
        prj1.set('subcontratacao_autorizada', true)
        prj1.set('saude', 'verde')
        prj1.set('status', 'em_andamento')
        app.save(prj1)
      }

      // (2) Conta a receber em rascunho
      try {
        app.findFirstRecordByData('contas', 'proposta', p1.id)
      } catch (_) {
        const c1 = new Record(contasCol)
        c1.set('tipo', 'receber')
        if (prj1) c1.set('projeto', prj1.id)
        c1.set('proposta', p1.id)
        c1.set('descricao', 'Recebimento de Proposta Aceita ' + prop1Num)
        c1.set('valor', 87870.0)
        c1.set('status', 'rascunho')
        c1.set('forma_pagamento', '30% entrada, 40% parcial, 30% aceite final')
        c1.set('vencimento', '2026-11-15 12:00:00.000Z')
        c1.set('bloqueada_por_fechamento', false)
        app.save(c1)
      }

      // (3) Empresa já convertida em parceira
      if (empRioDoce) {
        empRioDoce.set('etapa_funil', 'parceira')
        empRioDoce.set('status', 'ativa')
        app.save(empRioDoce)
      }
    }

    // PROPOSTA 2: RECUSADA (Motivo: Preço)
    const prop2Num = `PROP-${anoAtual}-0002`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop2Num)
    } catch (_) {
      const p2 = new Record(propostasCol)
      p2.set('numero', prop2Num)
      p2.set('revisao', 'Rev.00')
      p2.set('empresa', empCNEP ? empCNEP.id : null)
      p2.set('contrato', contratoSeduc ? contratoSeduc.id : null)
      p2.set(
        'escopo',
        'Compatibilização de Projetos em BIM e Revisão das Instalações Elétricas das 8 escolas técnicas.',
      )
      p2.set('disciplinas', 'Instalações Elétricas, BIM')
      p2.set('prazo', '30 dias corridos')
      p2.set('custo', 32000.0)
      p2.set('margem', 30.0)
      p2.set('impostos', 16.5)
      p2.set('preco', 46880.0)
      p2.set('status', 'recusada')
      p2.set('motivo_recusa', 'Preço acima do orçamento disponível')
      p2.set('detalhe_recusa', 'Empresa orçou com projetista local pelo valor de R$ 38.000,00.')
      p2.set('token_aceite', 'token_aceite_demo_prop_0002_seed')
      p2.set('data_recusa', '2026-09-28 17:00:00.000Z')
      p2.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p2)
    }

    // PROPOSTA 3: RECUSADA (Motivo: Prazo)
    const prop3Num = `PROP-${anoAtual}-0003`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop3Num)
    } catch (_) {
      const p3 = new Record(propostasCol)
      p3.set('numero', prop3Num)
      p3.set('revisao', 'Rev.00')
      p3.set('cliente_pf', pfHelena ? pfHelena.id : null)
      p3.set(
        'escopo',
        'Laudo Pericial de Patologia e Vistoria Cautelar de Vizinhança para Reforma de Imóvel Tombado.',
      )
      p3.set('disciplinas', 'Engenharia Diagnóstica')
      p3.set('prazo', '25 dias úteis')
      p3.set('custo', 6800.0)
      p3.set('margem', 35.0)
      p3.set('impostos', 16.5)
      p3.set('preco', 10302.0)
      p3.set('status', 'recusada')
      p3.set('motivo_recusa', 'Prazo de entrega superior ao exigido pela obra')
      p3.set('detalhe_recusa', 'Necessitava do laudo pericial em no máximo 5 dias corridos.')
      p3.set('token_aceite', 'token_aceite_demo_prop_0003_seed')
      p3.set('data_recusa', '2026-09-25 11:20:00.000Z')
      p3.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p3)
    }

    // PROPOSTA 4: VISUALIZADA (com link público e tracking)
    const prop4Num = `PROP-${anoAtual}-0004`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop4Num)
    } catch (_) {
      const p4 = new Record(propostasCol)
      p4.set('numero', prop4Num)
      p4.set('revisao', 'Rev.00')
      p4.set('empresa', empSani ? empSani.id : null)
      p4.set(
        'escopo',
        'Dimensionamento de Estação Elevatória de Esgoto e Poços de Sucção no Rio Pardo.',
      )
      p4.set('disciplinas', 'Estruturas, Geotecnia, Saneamento')
      p4.set('prazo', '60 dias corridos')
      p4.set('custo', 75000.0)
      p4.set('margem', 32.0)
      p4.set('impostos', 16.5)
      p4.set('preco', 111375.0)
      p4.set('validade', '2026-10-25 23:59:59.000Z')
      p4.set('status', 'visualizada')
      p4.set('token_aceite', 'demo_token_publico_prop_0004')
      p4.set('data_visualizacao', '2026-10-01 09:30:00.000Z')
      p4.set('requer_aprovacao_admin', true) // > 100k
      p4.set('aprovador_admin', adminUser ? adminUser.id : null)
      p4.set('data_aprovacao_admin', '2026-09-30 16:00:00.000Z')
      p4.set('criado_por', comercialUser ? comercialUser.id : null)
      p4.set('itens_json', [
        {
          descricao: 'Projeto de Fundações e Contenções Geotécnicas',
          disciplina: 'Geotecnia',
          unidade: 'm²',
          quantidade: 1500,
          custo_unitario: 24.0,
          custo_total: 36000.0,
        },
        {
          descricao: 'Projeto Executivo Estrutural em Concreto Armado',
          disciplina: 'Estruturas',
          unidade: 'm²',
          quantidade: 1000,
          custo_unitario: 39.0,
          custo_total: 39000.0,
        },
      ])
      app.save(p4)
    }

    // PROPOSTA 5: EM NEGOCIAÇÃO (Quase vencendo - D-3)
    const prop5Num = `PROP-${anoAtual}-0005`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop5Num)
    } catch (_) {
      const p5 = new Record(propostasCol)
      p5.set('numero', prop5Num)
      p5.set('revisao', 'Rev.00')
      p5.set('empresa', empCNEP ? empCNEP.id : null)
      p5.set(
        'escopo',
        'Projeto de Prevenção e Combate a Incêndio (PPCI) e Sistema de Proteção contra Descargas Atmosféricas (SPDA).',
      )
      p5.set('disciplinas', 'Instalações Elétricas, Segurança contra Incêndio')
      p5.set('prazo', '20 dias corridos')
      p5.set('custo', 14500.0)
      p5.set('margem', 40.0)
      p5.set('impostos', 16.5)
      p5.set('preco', 22692.5)

      // Validade para daqui a 2 dias (Dispara D-3)
      const dataD3 = new Date()
      dataD3.setDate(dataD3.getDate() + 2)
      p5.set('validade', dataD3.toISOString())

      p5.set('status', 'em_negociacao')
      p5.set('token_aceite', 'demo_token_publico_prop_0005')
      p5.set('data_visualizacao', '2026-09-29 14:00:00.000Z')
      p5.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p5)
    }

    // PROPOSTA 6: APROVAÇÃO INTERNA (Parecer financeiro em andamento)
    const prop6Num = `PROP-${anoAtual}-0006`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop6Num)
    } catch (_) {
      const p6 = new Record(propostasCol)
      p6.set('numero', prop6Num)
      p6.set('revisao', 'Rev.00')
      p6.set('empresa', empRioDoce ? empRioDoce.id : null)
      p6.set(
        'escopo',
        'Contenção de Encostas e Recuperação Estrutural de Pontilhões Viários na MG-259.',
      )
      p6.set('disciplinas', 'Geotecnia, Estruturas')
      p6.set('prazo', '90 dias corridos')
      p6.set('custo', 120000.0)
      p6.set('margem', 25.0)
      p6.set('impostos', 16.5)
      p6.set('preco', 169800.0)
      p6.set('validade', '2026-11-20 23:59:59.000Z')
      p6.set('status', 'aprovacao_interna')
      p6.set('token_aceite', 'demo_token_publico_prop_0006')
      p6.set('requer_aprovacao_admin', true) // > 100k
      p6.set('aprovador_financeiro', financeiroUser ? financeiroUser.id : null)
      p6.set(
        'parecer_financeiro',
        'Aprovado pelo Financeiro. Fluxo prevê desembolsos escalonados e margem adequada.',
      )
      p6.set('data_aprovacao_financeira', '2026-10-01 11:00:00.000Z')
      p6.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p6)
    }

    // PROPOSTA 7: EXPIRADA (Validade no passado)
    const prop7Num = `PROP-${anoAtual}-0007`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop7Num)
    } catch (_) {
      const p7 = new Record(propostasCol)
      p7.set('numero', prop7Num)
      p7.set('revisao', 'Rev.00')
      p7.set('empresa', empSani ? empSani.id : null)
      p7.set(
        'escopo',
        'Plano de Gerenciamento de Resíduos da Construção Civil (PGRCC) e Licenciamento Ambiental.',
      )
      p7.set('disciplinas', 'Meio Ambiente')
      p7.set('prazo', '15 dias')
      p7.set('custo', 4200.0)
      p7.set('margem', 35.0)
      p7.set('impostos', 16.5)
      p7.set('preco', 6363.0)
      p7.set('validade', '2026-09-10 23:59:59.000Z') // Passado
      p7.set('status', 'expirada')
      p7.set('token_aceite', 'demo_token_publico_prop_0007')
      p7.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p7)
    }

    // PROPOSTA 8: RASCUNHO PARA CLIENTE PF (com consentimento LGPD)
    const prop8Num = `PROP-${anoAtual}-0008`
    try {
      app.findFirstRecordByData('propostas', 'numero', prop8Num)
    } catch (_) {
      const p8 = new Record(propostasCol)
      p8.set('numero', prop8Num)
      p8.set('revisao', 'Rev.00')
      p8.set('cliente_pf', pfAlbuquerque ? pfAlbuquerque.id : null)
      p8.set(
        'escopo',
        'Parecer Técnico Pericial de Estabilidade Geotécnica para Fundações de Residência Unifamiliar.',
      )
      p8.set('disciplinas', 'Geotecnia')
      p8.set('prazo', '10 dias corridos')
      p8.set('custo', 6800.0)
      p8.set('margem', 30.0)
      p8.set('impostos', 16.5)
      p8.set('preco', 9962.0)
      p8.set('status', 'rascunho')
      p8.set('token_aceite', 'demo_token_publico_prop_0008')
      p8.set('criado_por', comercialUser ? comercialUser.id : null)
      app.save(p8)
    }
  },
  (app) => {
    // Rollback se necessário
  },
)
