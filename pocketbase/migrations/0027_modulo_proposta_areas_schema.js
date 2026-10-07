migrate(
  (app) => {
    // 1. Criar coleção areas_atuacao
    let areasCol
    try {
      areasCol = app.findCollectionByNameOrId('areas_atuacao')
    } catch (_) {
      areasCol = new Collection({
        name: 'areas_atuacao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'ordem', type: 'number' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_areas_atuacao_nome ON areas_atuacao (nome)'],
      })
      app.save(areasCol)
    }

    const areasId = areasCol.id

    // 2. Criar coleção subservicos
    let subservicosCol
    try {
      subservicosCol = app.findCollectionByNameOrId('subservicos')
    } catch (_) {
      subservicosCol = new Collection({
        name: 'subservicos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'area',
            type: 'relation',
            collectionId: areasId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_subservicos_area ON subservicos (area)'],
      })
      app.save(subservicosCol)
    }

    const subservicosId = subservicosCol.id

    // 3. Criar coleção entregaveis_padrao
    let entregaveisPadraoCol
    try {
      entregaveisPadraoCol = app.findCollectionByNameOrId('entregaveis_padrao')
    } catch (_) {
      entregaveisPadraoCol = new Collection({
        name: 'entregaveis_padrao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'area',
            type: 'relation',
            collectionId: areasId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'subservico',
            type: 'relation',
            collectionId: subservicosId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'ordem', type: 'number' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_entregaveis_padrao_area ON entregaveis_padrao (area)',
          'CREATE INDEX idx_entregaveis_padrao_subservico ON entregaveis_padrao (subservico)',
        ],
      })
      app.save(entregaveisPadraoCol)
    }

    // 4. Atualizar catalogo_servicos com area e precisa_revisao_area
    const catalogoCol = app.findCollectionByNameOrId('catalogo_servicos')
    if (!catalogoCol.fields.getByName('area')) {
      catalogoCol.fields.add(
        new RelationField({
          name: 'area',
          collectionId: areasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!catalogoCol.fields.getByName('precisa_revisao_area')) {
      catalogoCol.fields.add(
        new BoolField({
          name: 'precisa_revisao_area',
        }),
      )
    }
    app.save(catalogoCol)

    // 5. Atualizar proposta_itens com novos campos:
    // area (relation→areas_atuacao), subservicos (json), status_conversao (select: nao_convertido | convertido),
    // projeto_gerado (relation→projetos), etapa_gerada (relation→projeto_etapas)
    const propostaItensCol = app.findCollectionByNameOrId('proposta_itens')
    const projetosId = app.findCollectionByNameOrId('projetos').id
    const projetoEtapasId = app.findCollectionByNameOrId('projeto_etapas').id

    if (!propostaItensCol.fields.getByName('area')) {
      propostaItensCol.fields.add(
        new RelationField({
          name: 'area',
          collectionId: areasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!propostaItensCol.fields.getByName('subservicos')) {
      propostaItensCol.fields.add(
        new JSONField({
          name: 'subservicos',
        }),
      )
    }
    if (!propostaItensCol.fields.getByName('status_conversao')) {
      propostaItensCol.fields.add(
        new SelectField({
          name: 'status_conversao',
          values: ['nao_convertido', 'convertido'],
          maxSelect: 1,
        }),
      )
    }
    if (!propostaItensCol.fields.getByName('projeto_gerado')) {
      propostaItensCol.fields.add(
        new RelationField({
          name: 'projeto_gerado',
          collectionId: projetosId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!propostaItensCol.fields.getByName('etapa_gerada')) {
      propostaItensCol.fields.add(
        new RelationField({
          name: 'etapa_gerada',
          collectionId: projetoEtapasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(propostaItensCol)

    // 6. Atualizar projeto_etapas: + area (relation→areas_atuacao)
    const projetoEtapasCol = app.findCollectionByNameOrId('projeto_etapas')
    if (!projetoEtapasCol.fields.getByName('area')) {
      projetoEtapasCol.fields.add(
        new RelationField({
          name: 'area',
          collectionId: areasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(projetoEtapasCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('entregaveis_padrao')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('subservicos')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('areas_atuacao')
      app.delete(col)
    } catch (_) {}
  },
)
