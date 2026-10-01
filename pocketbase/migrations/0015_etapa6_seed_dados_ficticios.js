migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const contatosCol = app.findCollectionByNameOrId('contatos')
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const contasCol = app.findCollectionByNameOrId('contas')
    const clientesPfCol = app.findCollectionByNameOrId('clientes_pf')
    const usersCol = app.findCollectionByNameOrId('users')

    let adminUser = null
    let comercialUser = null
    try {
      adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    } catch (_) {}
    try {
      comercialUser = app.findFirstRecordByData('users', 'email', 'comercial@sistema.eng.br')
    } catch (_) {}
    const respId = comercialUser ? comercialUser.id : adminUser ? adminUser.id : null

    // 1. Criar Parceiros fictícios com valores de receita variados para demonstrar perfeitamente a Curva ABC Dinâmica:
    // Parceiro 1: Alta receita (A) - ex: Construtora Aliança
    // Parceiro 2: Alta receita (A) - ex: Sul-Brasileira de Túneis (já existe uhciz39a4bera0x)
    // Parceiro 3: Média receita (B) - ex: SaniPaulista (já existe rgk0bkh2n6q3yac)
    // Parceiro 4: Média receita (B) - ex: Nova Infra Rodovias
    // Parceiro 5: Menor receita (C) - ex: Pavimentadora Horizonte
    // Parceiro 6: Sem demanda há mais de 180 dias (Alerta) - ex: Drenatech Engenharia

    // Parceiro 1: Construtora Aliança Infraestrutura S.A.
    let pAlianca = null
    try {
      pAlianca = app.findFirstRecordByData('empresas', 'cnpj', '33.592.110/0001-88')
    } catch (_) {
      pAlianca = new Record(empresasCol)
      pAlianca.set('razao_social', 'Aliança Infraestrutura & Concessões S.A.')
      pAlianca.set('nome_fantasia', 'Aliança Concessões')
      pAlianca.set('cnpj', '33.592.110/0001-88')
      pAlianca.set('situacao_cadastral', 'ATIVA')
      pAlianca.set('porte', 'GRANDE')
      pAlianca.set('cnae', '42.11-1-01 - Construção de rodovias e ferrovias')
      pAlianca.set('uf', 'SP')
      pAlianca.set('municipio', 'São Paulo')
      pAlianca.set('email', 'novosnegocios@aliancaconcessoes.com.br')
      pAlianca.set('telefone', '(11) 3340-9000')
      pAlianca.set('etapa_funil', 'parceira')
      pAlianca.set('curva', 'A')
      pAlianca.set('score', 95)
      pAlianca.set('status', 'ativa')
      if (respId) pAlianca.set('responsavel', respId)
      pAlianca.set(
        'observacoes',
        'Parceira demandante de alto porte. Excelente pontualidade nos pagamentos.',
      )
      app.save(pAlianca)
    }

    // Parceiro 4: Nova Infra Rodovias
    let pNovaInfra = null
    try {
      pNovaInfra = app.findFirstRecordByData('empresas', 'cnpj', '44.218.790/0001-52')
    } catch (_) {
      pNovaInfra = new Record(empresasCol)
      pNovaInfra.set('razao_social', 'Nova Infra Engenharia Rodoviária Ltda')
      pNovaInfra.set('nome_fantasia', 'Nova Infra Rodovias')
      pNovaInfra.set('cnpj', '44.218.790/0001-52')
      pNovaInfra.set('situacao_cadastral', 'ATIVA')
      pNovaInfra.set('porte', 'MEDIO')
      pNovaInfra.set('cnae', '42.12-0-00 - Construção de obras de arte especiais')
      pNovaInfra.set('uf', 'MG')
      pNovaInfra.set('municipio', 'Belo Horizonte')
      pNovaInfra.set('email', 'engenharia@novainfrarodovias.com.br')
      pNovaInfra.set('telefone', '(31) 3280-4500')
      pNovaInfra.set('etapa_funil', 'parceira')
      pNovaInfra.set('curva', 'B')
      pNovaInfra.set('score', 82)
      pNovaInfra.set('status', 'ativa')
      if (respId) pNovaInfra.set('responsavel', respId)
      pNovaInfra.set('observacoes', 'Parceira especializada em pontes e viadutos.')
      app.save(pNovaInfra)
    }

    // Parceiro 5: Pavimentadora Horizonte (Curva C)
    let pHorizonte = null
    try {
      pHorizonte = app.findFirstRecordByData('empresas', 'cnpj', '55.670.321/0001-14')
    } catch (_) {
      pHorizonte = new Record(empresasCol)
      pHorizonte.set('razao_social', 'Horizonte Obras & Pavimentação Urbana Ltda')
      pHorizonte.set('nome_fantasia', 'Pavimentadora Horizonte')
      pHorizonte.set('cnpj', '55.670.321/0001-14')
      pHorizonte.set('situacao_cadastral', 'ATIVA')
      pHorizonte.set('porte', 'PEQUENO')
      pHorizonte.set('cnae', '42.13-8-00 - Obras de urbanização')
      pHorizonte.set('uf', 'PR')
      pHorizonte.set('municipio', 'Londrina')
      pHorizonte.set('email', 'contato@horizonteobras.com.br')
      pHorizonte.set('telefone', '(43) 3322-1100')
      pHorizonte.set('etapa_funil', 'parceira')
      pHorizonte.set('curva', 'C')
      pHorizonte.set('score', 65)
      pHorizonte.set('status', 'ativa')
      if (respId) pHorizonte.set('responsavel', respId)
      pHorizonte.set('observacoes', 'Parceira de demandas pontuais em projetos de drenagem.')
      app.save(pHorizonte)
    }

    // Parceiro 6: Drenatech Engenharia (SEM DEMANDA HÁ MAIS DE 200 DIAS - para o Alerta de 180 dias)
    let pDrenatech = null
    try {
      pDrenatech = app.findFirstRecordByData('empresas', 'cnpj', '66.890.432/0001-77')
    } catch (_) {
      pDrenatech = new Record(empresasCol)
      pDrenatech.set('razao_social', 'Drenatech Infraestrutura Hídrica S.A.')
      pDrenatech.set('nome_fantasia', 'Drenatech Hídrica')
      pDrenatech.set('cnpj', '66.890.432/0001-77')
      pDrenatech.set('situacao_cadastral', 'ATIVA')
      pDrenatech.set('porte', 'MEDIO')
      pDrenatech.set('cnae', '42.22-7-01 - Redes de abastecimento e drenagem')
      pDrenatech.set('uf', 'GO')
      pDrenatech.set('municipio', 'Goiânia')
      pDrenatech.set('email', 'projetos@drenatech.com.br')
      pDrenatech.set('telefone', '(62) 3411-9988')
      pDrenatech.set('etapa_funil', 'parceira')
      pDrenatech.set('curva', 'C')
      pDrenatech.set('score', 58)
      pDrenatech.set('status', 'ativa')
      if (respId) pDrenatech.set('responsavel', respId)
      pDrenatech.set(
        'observacoes',
        'Atenção comercial: sem solicitação de proposta nem projetos iniciados há mais de 6 meses.',
      )
      app.save(pDrenatech)
    }

    // Recuperar os parceiros existentes da Etapa 2/3
    let pSulTuneis = null
    try {
      pSulTuneis = app.findFirstRecordByData('empresas', 'cnpj', '11.390.871/0001-20')
    } catch (_) {}
    let pSaniPaulista = null
    try {
      pSaniPaulista = app.findFirstRecordByData('empresas', 'cnpj', '28.761.429/0001-92')
    } catch (_) {}

    // 2. Contatos dos parceiros
    const seedContato = (empId, nome, cargo, email, tel, decisor) => {
      try {
        app.findFirstRecordByData('contatos', 'email', email)
      } catch (_) {
        const c = new Record(contatosCol)
        c.set('empresa', empId)
        c.set('nome', nome)
        c.set('cargo', cargo)
        c.set('email', email)
        c.set('telefone', tel)
        c.set('whatsapp', tel)
        c.set('decisor', decisor)
        c.set('verificado', true)
        app.save(c)
      }
    }

    if (pAlianca) {
      seedContato(
        pAlianca.id,
        'Eng. Roberto Vasconcelos',
        'Diretor de Engenharia e Novos Contratos',
        'roberto@aliancaconcessoes.com.br',
        '(11) 99123-4501',
        true,
      )
    }
    if (pNovaInfra) {
      seedContato(
        pNovaInfra.id,
        'Mariana Fontes',
        'Gerente de Suprimentos Técnicos',
        'mariana@novainfrarodovias.com.br',
        '(31) 98765-1234',
        true,
      )
    }
    if (pHorizonte) {
      seedContato(
        pHorizonte.id,
        'Cláudio Nogueira',
        'Coordenador Operacional',
        'claudio@horizonteobras.com.br',
        '(43) 99876-5432',
        true,
      )
    }
    if (pDrenatech) {
      seedContato(
        pDrenatech.id,
        'Gustavo Meireles',
        'Diretor Técnico',
        'gustavo@drenatech.com.br',
        '(62) 99654-3210',
        true,
      )
    }

    // 3. Clientes Pessoa Física (PF) com consentimento LGPD conforme requisito B
    const clientesPfData = [
      {
        nome: 'Dr. Fernando Albuquerque',
        cpf: '458.129.870-34',
        email: 'fernando.albuquerque@advocacia.com.br',
        telefone: '(11) 98122-3344',
        base_legal: 'execucao_contrato',
        consentimento_lgpd: true,
        data_consentimento: '2026-03-15',
        endereco: 'Av. Brigadeiro Faria Lima, 1800, Conj 91, Itaim Bibi, São Paulo - SP',
        observacoes:
          'Contratou laudo pericial de estabilidade geotécnica e fundações para condomínio horizontal.',
      },
      {
        nome: 'Helena Montenegro Dias',
        cpf: '712.983.450-81',
        email: 'helena.montenegro@gmail.com',
        telefone: '(21) 99233-4455',
        base_legal: 'consentimento',
        consentimento_lgpd: true,
        data_consentimento: '2026-05-20',
        endereco: 'Rua Visconde de Pirajá, 450, Ipanema, Rio de Janeiro - RJ',
        observacoes:
          'Proprietária de imóvel tombado. Contratou projeto de reforço estrutural e restauração.',
      },
      {
        nome: 'Marcio Aurélio Silveira',
        cpf: '839.201.740-92',
        email: 'marcio.silveira@agropec.com.br',
        telefone: '(67) 99877-6655',
        base_legal: 'legitimo_interesse',
        consentimento_lgpd: true,
        data_consentimento: '2026-07-10',
        endereco: 'Rodovia BR-163, Km 12, Campo Grande - MS',
        observacoes:
          'Produtor rural. Solicitou dimensionamento de vertedouro e barragem de captação hídrica.',
      },
      {
        nome: 'Dra. Camila Toledo Prado',
        cpf: '320.918.450-19',
        email: 'camila.toledo@clinica.med.br',
        telefone: '(31) 98455-6677',
        base_legal: 'obrigacao_legal',
        consentimento_lgpd: true,
        data_consentimento: '2026-08-01',
        endereco: 'Rua dos Inconfidentes, 780, Savassi, Belo Horizonte - MG',
        observacoes:
          'Adequação de edificação médica com laudo de capacidade portante de lajes para ressonância magnética.',
      },
    ]

    const savedClientesPf = []
    for (let i = 0; i < clientesPfData.length; i++) {
      const d = clientesPfData[i]
      let rec = null
      try {
        rec = app.findFirstRecordByData('clientes_pf', 'cpf', d.cpf)
      } catch (_) {
        rec = new Record(clientesPfCol)
        rec.set('nome', d.nome)
        rec.set('cpf', d.cpf)
        rec.set('email', d.email)
        rec.set('telefone', d.telefone)
        rec.set('base_legal', d.base_legal)
        rec.set('consentimento_lgpd', d.consentimento_lgpd)
        rec.set('data_consentimento', d.data_consentimento)
        rec.set('endereco', d.endereco)
        rec.set('observacoes', d.observacoes)
        app.save(rec)
      }
      savedClientesPf.push(rec)
    }

    // 4. Propostas Comerciais, Projetos e Contas a Receber para alimentar indicadores reais de parceiros
    // Aliança Concessões (A) -> R$ 1.850.000 acumulado
    // Sul-Brasileira de Túneis (A) -> R$ 1.200.000 acumulado
    // SaniPaulista (B) -> R$ 380.000 acumulado
    // Nova Infra Rodovias (B) -> R$ 260.000 acumulado
    // Pavimentadora Horizonte (C) -> R$ 75.000 acumulado
    // Drenatech Hídrica (C / Alerta) -> última demanda em 15/01/2026 (mais de 200 dias atrás), R$ 45.000

    const seedProposta = (dados) => {
      try {
        return app.findFirstRecordByData('propostas', 'numero', dados.numero)
      } catch (_) {
        const p = new Record(propostasCol)
        p.set('numero', dados.numero)
        p.set('revisao', 'R00')
        if (dados.empresa) p.set('empresa', dados.empresa)
        if (dados.cliente_pf) p.set('cliente_pf', dados.cliente_pf)
        p.set('escopo', dados.escopo)
        p.set('disciplinas', dados.disciplinas)
        p.set('entregaveis', dados.entregaveis)
        p.set('prazo', dados.prazo)
        p.set('preco', dados.preco)
        p.set('custo', dados.custo)
        p.set('margem', dados.margem)
        p.set('impostos', dados.impostos)
        p.set('condicoes_pagamento', dados.condicoes_pagamento)
        p.set('validade', dados.validade)
        p.set('status', dados.status)
        p.set('premissas', 'Dados topográficos fornecidos pelo contratante.')
        p.set('exclusoes', 'Taxas de licenciamento e ART.')
        app.save(p)
        return p
      }
    }

    const seedProjeto = (dados) => {
      try {
        return app.findFirstRecordByData('projetos', 'codigo', dados.codigo)
      } catch (_) {
        const proj = new Record(projetosCol)
        proj.set('codigo', dados.codigo)
        proj.set('proposta', dados.proposta)
        if (dados.contrato) proj.set('contrato', dados.contrato)
        proj.set('subcontratacao_autorizada', true)
        proj.set('saude', dados.saude || 'verde')
        proj.set('status', dados.status || 'em_andamento')
        app.save(proj)
        return proj
      }
    }

    const seedConta = (dados) => {
      const c = new Record(contasCol)
      c.set('tipo', 'receber')
      if (dados.projeto) c.set('projeto', dados.projeto)
      if (dados.proposta) c.set('proposta', dados.proposta)
      c.set('descricao', dados.descricao)
      c.set('valor', dados.valor)
      c.set('vencimento', dados.vencimento)
      c.set('status', dados.status)
      c.set('forma_pagamento', dados.forma_pagamento || 'Boleto 30 dias')
      app.save(c)
      return c
    }

    // --- Aliança Concessões ---
    if (pAlianca) {
      const prop1 = seedProposta({
        numero: 'PROP-2026-081',
        empresa: pAlianca.id,
        escopo: 'Modelagem bim e cálculo de superestrutura para ponte estaiada no Rodoanel',
        disciplinas: 'Estruturas, BIM, Geotecnia',
        entregaveis: 'Memorial de cálculo, modelos IFC, pranchas de armação e ART',
        prazo: '120 dias',
        preco: 1100000,
        custo: 720000,
        margem: 34.5,
        impostos: 16.5,
        condicoes_pagamento: '30% entrada, 40% entregas intermediárias, 30% aceite final',
        validade: '2026-04-10',
        status: 'aceita',
      })
      const proj1 = seedProjeto({
        codigo: 'PRJ-2026-015',
        proposta: prop1.id,
        saude: 'verde',
        status: 'em_andamento',
      })
      seedConta({
        projeto: proj1.id,
        proposta: prop1.id,
        descricao: '1ª Medição - Mobilização e Memorial Preliminar',
        valor: 330000,
        vencimento: '2026-05-15',
        status: 'paga',
      })
      seedConta({
        projeto: proj1.id,
        proposta: prop1.id,
        descricao: '2ª Medição - Modelos IFC e Cálculo Estrutural',
        valor: 440000,
        vencimento: '2026-07-20',
        status: 'paga',
      })
      seedConta({
        projeto: proj1.id,
        proposta: prop1.id,
        descricao: '3ª Medição - Pranchas Finais e ART de Projeto',
        valor: 330000,
        vencimento: '2026-10-30',
        status: 'prevista',
      })

      const prop2 = seedProposta({
        numero: 'PROP-2026-112',
        empresa: pAlianca.id,
        escopo: 'Inspeção especial e ensaios não-destrutivos em 12 viadutos rodoviários',
        disciplinas: 'Patologia das Estruturas, Ensaios',
        entregaveis: 'Relatórios fotográficos, mapas de danos, diretrizes de recuperação',
        prazo: '60 dias',
        preco: 750000,
        custo: 480000,
        margem: 36.0,
        impostos: 16.5,
        condicoes_pagamento: '50% medição 1, 50% entrega final',
        validade: '2026-09-01',
        status: 'aceita',
      })
      const proj2 = seedProjeto({
        codigo: 'PRJ-2026-028',
        proposta: prop2.id,
        saude: 'verde',
        status: 'em_andamento',
      })
      seedConta({
        projeto: proj2.id,
        proposta: prop2.id,
        descricao: 'Medição Inicial de Campo - Campanhas de Ensaios',
        valor: 375000,
        vencimento: '2026-09-25',
        status: 'paga',
      })
    }

    // --- Sul-Brasileira de Túneis ---
    if (pSulTuneis) {
      const prop3 = seedProposta({
        numero: 'PROP-2026-045',
        empresa: pSulTuneis.id,
        escopo:
          'Projeto executivo de contenção e instrumentação geotécnica para emboque sul do túnel ERS-115',
        disciplinas: 'Geotecnia Pesada, Instrumentação',
        entregaveis: 'Projetos de tirantes, piezômetros, inclinômetros e seções críticas',
        prazo: '90 dias',
        preco: 1200000,
        custo: 780000,
        margem: 35.0,
        impostos: 16.5,
        condicoes_pagamento: 'Medições mensais por avanço físico',
        validade: '2026-03-30',
        status: 'aceita',
      })
      const proj3 = seedProjeto({
        codigo: 'PRJ-2026-009',
        proposta: prop3.id,
        saude: 'verde',
        status: 'em_andamento',
      })
      seedConta({
        projeto: proj3.id,
        proposta: prop3.id,
        descricao: 'Medição 01 - Projeto Conceitual e Dimensionamento de Tirantes',
        valor: 400000,
        vencimento: '2026-05-10',
        status: 'paga',
      })
      seedConta({
        projeto: proj3.id,
        proposta: prop3.id,
        descricao: 'Medição 02 - Plano de Instrumentação e Monitoramento',
        valor: 400000,
        vencimento: '2026-06-25',
        status: 'paga',
      })
      seedConta({
        projeto: proj3.id,
        proposta: prop3.id,
        descricao: 'Medição 03 - Conclusão do As-Built Geotécnico',
        valor: 400000,
        vencimento: '2026-08-30',
        status: 'paga',
      })
    }

    // --- SaniPaulista ---
    if (pSaniPaulista) {
      const prop4 = seedProposta({
        numero: 'PROP-2026-068',
        empresa: pSaniPaulista.id,
        escopo:
          'Dimensionamento estrutural de estação elevatória de esgoto bruto e bloco de bombas',
        disciplinas: 'Hidráulica, Estruturas de Concreto Armado',
        entregaveis: 'Cálculo de empuxos hidrostáticos, pranchas de forma e armadura',
        prazo: '45 dias',
        preco: 380000,
        custo: 240000,
        margem: 36.8,
        impostos: 16.5,
        condicoes_pagamento: '2 parcelas iguais',
        validade: '2026-05-15',
        status: 'aceita',
      })
      const proj4 = seedProjeto({
        codigo: 'PRJ-2026-018',
        proposta: prop4.id,
        saude: 'verde',
        status: 'concluido',
      })
      seedConta({
        projeto: proj4.id,
        proposta: prop4.id,
        descricao: 'Parcela 1/2 - Memorial e Cálculos Hidroestruturais',
        valor: 190000,
        vencimento: '2026-06-10',
        status: 'paga',
      })
      seedConta({
        projeto: proj4.id,
        proposta: prop4.id,
        descricao: 'Parcela 2/2 - Detalhamento Final e Emissão de ART',
        valor: 190000,
        vencimento: '2026-07-25',
        status: 'paga',
      })
    }

    // --- Nova Infra Rodovias ---
    if (pNovaInfra) {
      const prop5 = seedProposta({
        numero: 'PROP-2026-099',
        empresa: pNovaInfra.id,
        escopo:
          'Laudo pericial e reforço de viga protendida danificada por colisão de carga especial',
        disciplinas: 'Estruturas Protendidas',
        entregaveis:
          'Diagnóstico de fissuras, projeto de reforço com fibra de carbono e escoramento',
        prazo: '30 dias',
        preco: 260000,
        custo: 165000,
        margem: 36.5,
        impostos: 16.5,
        condicoes_pagamento: '100% após entrega e aprovação do DER',
        validade: '2026-08-20',
        status: 'aceita',
      })
      const proj5 = seedProjeto({
        codigo: 'PRJ-2026-031',
        proposta: prop5.id,
        saude: 'verde',
        status: 'em_andamento',
      })
      seedConta({
        projeto: proj5.id,
        proposta: prop5.id,
        descricao: 'Pagamento Integral - Projeto Executivo de Reforço com PRFC',
        valor: 260000,
        vencimento: '2026-09-30',
        status: 'paga',
      })
    }

    // --- Pavimentadora Horizonte (Curva C) ---
    if (pHorizonte) {
      const prop6 = seedProposta({
        numero: 'PROP-2026-104',
        empresa: pHorizonte.id,
        escopo: 'Projeto de microdrenagem pluvial para loteamento empresarial em Londrina',
        disciplinas: 'Drenagem, Pavimentação',
        entregaveis: 'Bacias de retenção, galerias celulares e perfis longitudinais',
        prazo: '25 dias',
        preco: 75000,
        custo: 48000,
        margem: 36.0,
        impostos: 16.5,
        condicoes_pagamento: 'Entrada 50% e entrega final 50%',
        validade: '2026-08-25',
        status: 'aceita',
      })
      const proj6 = seedProjeto({
        codigo: 'PRJ-2026-033',
        proposta: prop6.id,
        saude: 'verde',
        status: 'em_andamento',
      })
      seedConta({
        projeto: proj6.id,
        proposta: prop6.id,
        descricao: 'Sinal de Início - Dimensionamento Hidrológico',
        valor: 37500,
        vencimento: '2026-09-10',
        status: 'paga',
      })
    }

    // --- Drenatech Hídrica (SEM DEMANDAS HÁ MAIS DE 200 DIAS - DATA DO ÚLTIMO PROJETO: 15/01/2026) ---
    if (pDrenatech) {
      const propAntiga = seedProposta({
        numero: 'PROP-2026-002',
        empresa: pDrenatech.id,
        escopo: 'Estudo de dispersão de efluentes e modelagem hidrodinâmica em córrego receptor',
        disciplinas: 'Hidrologia, Meio Ambiente',
        entregaveis: 'Relatório hidrológico e calibração de modelo',
        prazo: '30 dias',
        preco: 45000,
        custo: 28000,
        margem: 37.7,
        impostos: 16.5,
        condicoes_pagamento: 'À vista na entrega',
        validade: '2026-01-15',
        status: 'aceita',
      })
      const projAntigo = seedProjeto({
        codigo: 'PRJ-2026-003',
        proposta: propAntiga.id,
        saude: 'verde',
        status: 'concluido',
      })
      seedConta({
        projeto: projAntigo.id,
        proposta: propAntiga.id,
        descricao: 'Liquidação Final de Serviços Hidrológicos',
        valor: 45000,
        vencimento: '2026-02-15',
        status: 'paga',
      })
    }

    // Proposta vinculada a Cliente PF (para demonstrar vínculo opcional de PF com proposta)
    if (savedClientesPf.length > 0) {
      const cli1 = savedClientesPf[0]
      seedProposta({
        numero: 'PROP-PF-2026-01',
        cliente_pf: cli1.id,
        escopo: 'Perícia judicial e laudo de patologia estrutural em fissuras de muro de arrimo',
        disciplinas: 'Perícia de Engenharia, Geotecnia',
        entregaveis: 'Laudo pericial detalhado com fotos termográficas e ART',
        prazo: '20 dias',
        preco: 28000,
        custo: 16000,
        margem: 42.8,
        impostos: 16.5,
        condicoes_pagamento: '50% início e 50% emissão do laudo',
        validade: '2026-09-30',
        status: 'aceita',
      })
    }
  },
  (app) => {
    // Reversão
  },
)
