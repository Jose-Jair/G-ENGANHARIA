migrate(
  (app) => {
    // 1. Ampliar coleção `propostas` com os novos campos do modelo GMAIS:
    // empreendimento (text), objeto (text), escopo_gerado (text), premissas (text),
    // prazo_dias (number), nota_prazo (text), validade_dias (number), condicoes_gerais (text)
    const propostas = app.findCollectionByNameOrId('propostas')

    if (!propostas.fields.getByName('empreendimento')) {
      propostas.fields.add(
        new TextField({
          name: 'empreendimento',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('objeto')) {
      propostas.fields.add(
        new TextField({
          name: 'objeto',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('escopo_gerado')) {
      propostas.fields.add(
        new TextField({
          name: 'escopo_gerado',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('premissas')) {
      propostas.fields.add(
        new TextField({
          name: 'premissas',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('prazo_dias')) {
      propostas.fields.add(
        new NumberField({
          name: 'prazo_dias',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('nota_prazo')) {
      propostas.fields.add(
        new TextField({
          name: 'nota_prazo',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('validade_dias')) {
      propostas.fields.add(
        new NumberField({
          name: 'validade_dias',
          required: false,
        }),
      )
    }

    if (!propostas.fields.getByName('condicoes_gerais')) {
      propostas.fields.add(
        new TextField({
          name: 'condicoes_gerais',
          required: false,
        }),
      )
    }

    app.save(propostas)

    // 2. Preencher valores padrão para propostas existentes que estiverem nulas
    try {
      app
        .db()
        .newQuery(
          'UPDATE propostas SET validade_dias = 15 WHERE validade_dias IS NULL OR validade_dias = 0',
        )
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE propostas SET nota_prazo = 'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.' WHERE nota_prazo IS NULL OR nota_prazo = ''",
        )
        .execute()
    } catch (_) {}

    // 3. Criar coleção `proposta_parcelas`
    const propostasId = propostas.id
    let parcelasCol
    try {
      parcelasCol = app.findCollectionByNameOrId('proposta_parcelas')
    } catch (_) {
      parcelasCol = new Collection({
        name: 'proposta_parcelas',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        fields: [
          {
            name: 'proposta',
            type: 'relation',
            collectionId: propostasId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'ordem', type: 'number', required: true },
          { name: 'percentual', type: 'number', required: true },
          { name: 'valor', type: 'number', required: true },
          {
            name: 'gatilho',
            type: 'select',
            values: ['contratacao', 'entrega', 'marco'],
            maxSelect: 1,
            required: true,
          },
          { name: 'descricao', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_proposta_parcelas_proposta ON proposta_parcelas (proposta)',
          'CREATE INDEX idx_proposta_parcelas_ordem ON proposta_parcelas (ordem)',
        ],
      })
      app.save(parcelasCol)
    }

    // 4. Inserir ou atualizar parâmetros do modelo padrão da empresa GMAIS em `parametros`
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const paramsGmais = [
      {
        chave: 'modelo_proposta_premissas',
        valor:
          '1. A CONTRATADA não se responsabiliza por eventuais paralisações, atrasos e/ou cancelamentos decorrentes de exigências imprevistas e/ou extraordinárias dos órgãos competentes, bem como decorrentes de atrasos no fornecimento de dados, informações e subsídios por parte da CONTRATANTE.\n' +
          '2. Não estão inclusos os custos de taxas dos órgãos competentes (Secretarias, Concessionárias, Vigilância Sanitária, etc.) para a aprovação dos projetos e emissão de alvarás, bem como as taxas das Anotações e Registros de Responsabilidade Técnica (ART/RRT) que deverão ser pagas pela CONTRATANTE.\n' +
          '3. Os projetos executivos serão elaborados em conformidade com as normas técnicas vigentes e com os padrões estabelecidos nas orientações da CONTRATANTE.\n' +
          '4. Estão inclusas até 2 (duas) revisões de projeto decorrentes de ajustes de concepção arquitetônica solicitadas pela CONTRATANTE, desde que não configurem alteração substancial de premissas.',
        descricao: 'Texto padrão de premissas da proposta técnica GMAIS (editável por proposta)',
      },
      {
        chave: 'modelo_proposta_condicoes_gerais',
        valor:
          'CLÁUSULA 1ª — As alterações no projeto ou nas premissas de cálculo e concepção solicitadas pela CONTRATANTE após a conclusão ou entrega das respectivas fases incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias, mediante prévia estimativa e aprovação.\n\n' +
          'CLÁUSULA 2ª — Os documentos, desenhos, memoriais e arquivos digitais gerados durante a prestação dos serviços são de uso exclusivo para o empreendimento objeto desta proposta, sendo vedada sua reprodução ou cessão a terceiros sem prévia autorização formal da CONTRATADA.\n\n' +
          'CLÁUSULA 3ª — A rescisão imotivada do contrato sujeitará a parte infratora à quitação integral dos serviços já executados até a data da comunicação formal, acrescida de multa rescisória compensatória de 20% (vinte por cento) sobre o saldo remanescente do valor global do contrato.',
        descricao: 'Texto padrão das condições gerais da proposta técnica GMAIS (3 cláusulas)',
      },
      {
        chave: 'modelo_proposta_nota_prazo',
        valor:
          'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.',
        descricao: 'Nota explicativa padrão sobre contagem de prazos de execução (dias corridos)',
      },
      {
        chave: 'modelo_proposta_parcelas_padrao',
        valor: JSON.stringify([
          {
            ordem: 1,
            percentual: 50,
            gatilho: 'contratacao',
            descricao: '50% (cinquenta por cento) na assinatura do contrato/aceite',
          },
          {
            ordem: 2,
            percentual: 50,
            gatilho: 'entrega',
            descricao: '50% (cinquenta por cento) na entrega final dos projetos executivos',
          },
        ]),
        descricao: 'Configuração das parcelas padrão da proposta GMAIS (nº, percentual e gatilhos)',
      },
    ]

    for (const p of paramsGmais) {
      try {
        const existente = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (existente) {
          existente.set('descricao', p.descricao)
          app.save(existente)
        }
      } catch (_) {
        const novo = new Record(parametrosCol)
        novo.set('chave', p.chave)
        novo.set('valor', p.valor)
        novo.set('descricao', p.descricao)
        app.save(novo)
      }
    }
  },
  (app) => {
    try {
      const pCol = app.findCollectionByNameOrId('proposta_parcelas')
      app.delete(pCol)
    } catch (_) {}
  },
)
