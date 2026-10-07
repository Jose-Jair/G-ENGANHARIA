migrate(
  (app) => {
    const areasCol = app.findCollectionByNameOrId('areas_atuacao')
    const subservicosCol = app.findCollectionByNameOrId('subservicos')
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis_padrao')

    // 1. Definição das 9 áreas iniciais com subserviços e entregáveis padrão
    const seedAreas = [
      {
        nome: 'Projetos de estruturas de concreto armado',
        descricao:
          'Edifícios residenciais e comerciais, obras industriais, pontes, passarelas e reforço estrutural em concreto armado.',
        ordem: 1,
        subservicos: [
          'Edifícios',
          'Obras industriais',
          'Passarelas/pontes',
          'Verificação/reforço estrutural',
        ],
        entregaveis: [
          'Memorial de cálculo',
          'Plantas de forma e armação',
          'Quantitativos',
          'Modelo BIM IFC',
          'ART',
        ],
      },
      {
        nome: 'Projetos de estrutura metálica',
        descricao:
          'Estruturas em perfis laminados, soldados, formados a frio, galpões, coberturas treliçadas e ligações.',
        ordem: 2,
        subservicos: [
          'Perfis laminados/formados',
          'Estruturas treliçadas',
          'Ligações e detalhamento',
          'Galpões',
        ],
        entregaveis: [
          'Memorial de cálculo',
          'Desenho de montagem',
          'Detalhamento de shop drawings',
          'Lista de materiais',
        ],
      },
      {
        nome: 'Projeto hidráulico',
        descricao:
          'Sistemas prediais de água fria e água quente, drenagem pluvial, combate a incêndio e irrigação.',
        ordem: 3,
        subservicos: ['Água fria/quente', 'Drenagem pluvial', 'Combate a incêndio', 'Irrigação'],
        entregaveis: [
          'Plantas e detalhes',
          'Memória de cálculo',
          'Quantitativos',
          'Spool/fluxogramas',
        ],
      },
      {
        nome: 'Projeto sanitário',
        descricao:
          'Redes de esgoto sanitário predial, águas servidas, sistemas de tratamento, fossas sépticas e reúso.',
        ordem: 4,
        subservicos: ['Esgoto sanitário', 'Águas servidas', 'Tratamento/disposição', 'Reúso'],
        entregaveis: ['Plantas e detalhes', 'Memória de cálculo', 'Quantitativos', 'Laudo/parecer'],
      },
      {
        nome: 'Projeto elétrico',
        descricao:
          'Entradas de energia de baixa e média tensão, subestações, SPDA, iluminação técnica e cabeamento estruturado.',
        ordem: 5,
        subservicos: [
          'Entradas de energia',
          'SPDA',
          'Cabeamento estruturado',
          'Iluminação',
          'Subestações',
        ],
        entregaveis: [
          'Diagrama unifilar',
          'Planta de dispositivos',
          'Malha de aterramento',
          'Memorial descritivo',
          'Aprovação concessionária',
        ],
      },
      {
        nome: 'Projetos de infraestrutura',
        descricao:
          'Terraplenagem, pavimentação urbana e rodoviária, drenagem de macrorredes, fundações profundas e contenções.',
        ordem: 6,
        subservicos: ['Pavimentação', 'Drenagem urbana', 'Fundações e contenções', 'Terraplenagem'],
        entregaveis: [
          'Plantas gerais',
          'Memorial de cálculo',
          'Quantitativos',
          'Cronograma executivo',
        ],
      },
      {
        nome: 'Orçamentos',
        descricao:
          'Engenharia de custos, orçamentos analíticos sintéticos, curva ABC, composições SINAPI/SICRO e parametricos.',
        ordem: 7,
        subservicos: [
          'Orçamento analítico',
          'Curva ABC de insumos',
          'Composição de custos unitários',
          'Orçamento paramétrico',
        ],
        entregaveis: [
          'Planilha orçamentária',
          'Composições unitárias',
          'Quadro de quantitativos',
          'Relatório de preços',
        ],
      },
      {
        nome: 'Pleitos administrativos',
        descricao:
          'Assessoria técnica para licitações e contratos públicos, laudos técnicos, vistorias cautelares e perícias.',
        ordem: 8,
        subservicos: [
          'Laudos técnicos',
          'Vistoria cautelar',
          'Parecer de patologia',
          'Assessoria em licitações',
          'PGRCC',
        ],
        entregaveis: [
          'Laudo pericial com fotos',
          'Parecer técnico conclusivo',
          'ART/RRT',
          'Plano/relatório administrativo',
        ],
      },
      {
        nome: 'Outros',
        descricao:
          'Compatibilização BIM, coordenação multidisciplinar de projetos, inspeção predial e consultorias especiais.',
        ordem: 9,
        subservicos: ['BIM e compatibilização', 'Consultoria técnica', 'Inspeção predial'],
        entregaveis: [
          'Detecção de interferências',
          'Matriz de compatibilização',
          'Relatório de inspeção',
        ],
      },
    ]

    const areaMap = {} // nome -> record

    for (let i = 0; i < seedAreas.length; i++) {
      const item = seedAreas[i]
      let areaRec
      try {
        areaRec = app.findFirstRecordByData('areas_atuacao', 'nome', item.nome)
      } catch (_) {
        areaRec = new Record(areasCol)
        areaRec.set('nome', item.nome)
        areaRec.set('descricao', item.descricao)
        areaRec.set('ordem', item.ordem)
        areaRec.set('ativo', true)
        app.save(areaRec)
      }
      areaMap[item.nome] = areaRec

      // Inserir subserviços
      const subMap = {}
      for (let s = 0; s < item.subservicos.length; s++) {
        const subNome = item.subservicos[s]
        let subRec
        try {
          const existingSubs = app.findRecordsByFilter(
            'subservicos',
            "area = '" + areaRec.id + "' && nome = '" + subNome + "'",
            'created',
            1,
            0,
          )
          if (existingSubs.length > 0) {
            subRec = existingSubs[0]
          } else {
            throw new Error('not found')
          }
        } catch (_) {
          subRec = new Record(subservicosCol)
          subRec.set('area', areaRec.id)
          subRec.set('nome', subNome)
          subRec.set('descricao', 'Subserviço de ' + item.nome + ': ' + subNome)
          subRec.set('ativo', true)
          app.save(subRec)
        }
        subMap[subNome] = subRec
      }

      // Inserir entregáveis padrão (vale para a área toda)
      for (let e = 0; e < item.entregaveis.length; e++) {
        const entNome = item.entregaveis[e]
        try {
          const existingEnts = app.findRecordsByFilter(
            'entregaveis_padrao',
            "area = '" + areaRec.id + "' && nome = '" + entNome + "'",
            'created',
            1,
            0,
          )
          if (existingEnts.length > 0) {
            continue
          }
        } catch (_) {}

        const entRec = new Record(entregaveisCol)
        entRec.set('area', areaRec.id)
        entRec.set('nome', entNome)
        entRec.set('descricao', 'Entregável padrão de ' + item.nome)
        entRec.set('ordem', e + 1)
        entRec.set('ativo', true)
        app.save(entRec)
      }
    }

    // 2. Migrar os serviços existentes em catalogo_servicos:
    // - "Projeto Executivo Estrutural em Concreto Armado" -> Estruturas de concreto armado (precisa_revisao_area: false)
    // - "Projeto de Fundações e Contenções Geotécnicas" -> Projetos de infraestrutura (precisa_revisao_area: false)
    // - "Projeto Hidrossanitário e Drenagem Pluvial" -> Projeto hidráulico (precisa_revisao_area: true) [SINALIZAR]
    // - "Projeto Elétrico e Subestação Abrigada" -> Projeto elétrico (precisa_revisao_area: false)
    // - "Laudo Pericial de Patologia e Vistoria Cautelar de Vizinhança" -> Outros (precisa_revisao_area: true) [SINALIZAR]
    // - "Modelagem da Informação da Construção (BIM Compatibilização)" -> Outros (precisa_revisao_area: true) [SINALIZAR]
    // - "Plano de Gerenciamento de Resíduos da Construção Civil (PGRCC)" -> Outros (precisa_revisao_area: true) [SINALIZAR]
    const catalogoCol = app.findCollectionByNameOrId('catalogo_servicos')
    const allServicos = app.findRecordsByFilter('catalogo_servicos', "id != ''", 'created', 100, 0)

    for (let i = 0; i < allServicos.length; i++) {
      const serv = allServicos[i]
      const nome = serv.getString('nome')

      if (nome.indexOf('Estrutural em Concreto Armado') !== -1) {
        serv.set('area', areaMap['Projetos de estruturas de concreto armado'].id)
        serv.set('precisa_revisao_area', false)
      } else if (nome.indexOf('Fundações e Contenções') !== -1) {
        serv.set('area', areaMap['Projetos de infraestrutura'].id)
        serv.set('precisa_revisao_area', false)
      } else if (nome.indexOf('Hidrossanitário e Drenagem') !== -1) {
        serv.set('area', areaMap['Projeto hidráulico'].id)
        serv.set('precisa_revisao_area', true) // Sinalizado para revisão manual
      } else if (nome.indexOf('Elétrico e Subestação') !== -1) {
        serv.set('area', areaMap['Projeto elétrico'].id)
        serv.set('precisa_revisao_area', false)
      } else if (
        nome.indexOf('Laudo Pericial') !== -1 ||
        nome.indexOf('BIM Compatibilização') !== -1 ||
        nome.indexOf('PGRCC') !== -1
      ) {
        serv.set('area', areaMap['Outros'].id)
        serv.set('precisa_revisao_area', true) // Sinalizado para revisão manual
      } else {
        // Padrão defensivo caso haja outro serviço
        serv.set('area', areaMap['Outros'].id)
        serv.set('precisa_revisao_area', false)
      }

      app.save(serv)
    }
  },
  (app) => {
    // Reverter sementes se necessário
  },
)
