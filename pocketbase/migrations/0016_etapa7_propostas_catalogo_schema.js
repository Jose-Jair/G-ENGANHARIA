migrate(
  (app) => {
    // 1. Criar catalogo_servicos se não existir
    let catalogoCol
    try {
      catalogoCol = app.findCollectionByNameOrId('catalogo_servicos')
    } catch (_) {
      catalogoCol = new Collection({
        name: 'catalogo_servicos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'disciplina', type: 'text', required: true },
          { name: 'unidade', type: 'text', required: true }, // vb: un, m², km, proj, mês, hora
          { name: 'preco_base', type: 'number', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_catalogo_servicos_disciplina ON catalogo_servicos (disciplina)',
        ],
      })
      app.save(catalogoCol)
    }

    // 2. Criar proposta_itens para suportar itens orçados na proposta
    let propostaItensCol
    try {
      propostaItensCol = app.findCollectionByNameOrId('proposta_itens')
    } catch (_) {
      const propostasId = app.findCollectionByNameOrId('propostas').id
      const catalogoId = app.findCollectionByNameOrId('catalogo_servicos').id

      propostaItensCol = new Collection({
        name: 'proposta_itens',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
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
          {
            name: 'servico',
            type: 'relation',
            collectionId: catalogoId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'descricao', type: 'text', required: true },
          { name: 'disciplina', type: 'text' },
          { name: 'unidade', type: 'text' },
          { name: 'quantidade', type: 'number', required: true },
          { name: 'custo_unitario', type: 'number', required: true },
          { name: 'custo_total', type: 'number', required: true },
          { name: 'bdi_percentual', type: 'number' },
          { name: 'preco_total', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_proposta_itens_proposta ON proposta_itens (proposta)'],
      })
      app.save(propostaItensCol)
    }

    // 3. Atualizar campos da coleção 'propostas'
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const contratosId = app.findCollectionByNameOrId('contratos').id
    const modelosId = app.findCollectionByNameOrId('modelos').id
    const usersId = '_pb_users_auth_'

    if (!propostasCol.fields.getByName('contrato')) {
      propostasCol.fields.add(
        new RelationField({
          name: 'contrato',
          collectionId: contratosId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!propostasCol.fields.getByName('modelo')) {
      propostasCol.fields.add(
        new RelationField({
          name: 'modelo',
          collectionId: modelosId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!propostasCol.fields.getByName('itens_json')) {
      propostasCol.fields.add(
        new JSONField({
          name: 'itens_json',
        }),
      )
    }

    if (!propostasCol.fields.getByName('historico_revisoes')) {
      propostasCol.fields.add(
        new JSONField({
          name: 'historico_revisoes',
        }),
      )
    }

    if (!propostasCol.fields.getByName('data_visualizacao')) {
      propostasCol.fields.add(
        new DateField({
          name: 'data_visualizacao',
        }),
      )
    }

    if (!propostasCol.fields.getByName('data_aceite')) {
      propostasCol.fields.add(
        new DateField({
          name: 'data_aceite',
        }),
      )
    }

    if (!propostasCol.fields.getByName('data_recusa')) {
      propostasCol.fields.add(
        new DateField({
          name: 'data_recusa',
        }),
      )
    }

    if (!propostasCol.fields.getByName('detalhe_recusa')) {
      propostasCol.fields.add(
        new TextField({
          name: 'detalhe_recusa',
        }),
      )
    }

    if (!propostasCol.fields.getByName('parecer_financeiro')) {
      propostasCol.fields.add(
        new TextField({
          name: 'parecer_financeiro',
        }),
      )
    }

    if (!propostasCol.fields.getByName('aprovador_financeiro')) {
      propostasCol.fields.add(
        new RelationField({
          name: 'aprovador_financeiro',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!propostasCol.fields.getByName('data_aprovacao_financeira')) {
      propostasCol.fields.add(
        new DateField({
          name: 'data_aprovacao_financeira',
        }),
      )
    }

    if (!propostasCol.fields.getByName('requer_aprovacao_admin')) {
      propostasCol.fields.add(
        new BoolField({
          name: 'requer_aprovacao_admin',
        }),
      )
    }

    if (!propostasCol.fields.getByName('aprovador_admin')) {
      propostasCol.fields.add(
        new RelationField({
          name: 'aprovador_admin',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!propostasCol.fields.getByName('data_aprovacao_admin')) {
      propostasCol.fields.add(
        new DateField({
          name: 'data_aprovacao_admin',
        }),
      )
    }

    if (!propostasCol.fields.getByName('criado_por')) {
      propostasCol.fields.add(
        new RelationField({
          name: 'criado_por',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // Permitir visualização e aceite por link público via token_aceite sem autenticação
    // listRule e viewRule: autenticados com papéis autorizados OU acesso por token_aceite
    propostasCol.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_aceite != '' && @request.query.token = token_aceite)"
    propostasCol.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_aceite != '' && (@request.query.token = token_aceite || token_aceite = @request.headers.x_token_aceite))"
    propostasCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    // Update: Admin, Comercial, Financeiro (para dar parecer/aprovação interna) OU público se tiver o token_aceite correto (para aceitar/recusar)
    propostasCol.updateRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')) || (token_aceite != '' && token_aceite = @request.body.token_aceite)"
    propostasCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    app.save(propostasCol)

    // 4. Inserir parâmetros de proposta se não existirem
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const defaultParams = [
      {
        chave: 'proposta_validade_dias',
        valor: '15',
        descricao: 'Prazo padrão de validade da proposta em dias corridos após envio',
      },
      {
        chave: 'proposta_alcada_limite_valor',
        valor: '100000',
        descricao:
          'Valor máximo (R$) para o Comercial aprovar a proposta sem necessidade de aval do Admin',
      },
      {
        chave: 'proposta_alcada_margem_minima',
        valor: '20',
        descricao:
          'Margem mínima percentual (%) para aprovação autônoma pelo Comercial (abaixo requer Admin)',
      },
      {
        chave: 'proposta_margem_padrao',
        valor: '35',
        descricao: 'Percentual de margem de lucro padrão sugerido nos orçamentos de engenharia (%)',
      },
      {
        chave: 'proposta_impostos_padrao',
        valor: '16.5',
        descricao: 'Percentual padrão de tributos/impostos sobre a nota fiscal de engenharia (%)',
      },
      {
        chave: 'proposta_lembrete_dias_antes',
        valor: '3',
        descricao: 'Dias antes do vencimento para alertar proposta em risco de expiração (D-3)',
      },
    ]

    for (let i = 0; i < defaultParams.length; i++) {
      const p = defaultParams[i]
      try {
        app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        const rec = new Record(parametrosCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const itens = app.findCollectionByNameOrId('proposta_itens')
      app.delete(itens)
    } catch (_) {}
    try {
      const cat = app.findCollectionByNameOrId('catalogo_servicos')
      app.delete(cat)
    } catch (_) {}
  },
)
