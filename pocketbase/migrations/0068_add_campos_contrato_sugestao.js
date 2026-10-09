migrate(
  (app) => {
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const sugestoesCol = app.findCollectionByNameOrId('sugestoes_funil')

    // 1. Campo status_revisao em contratos
    if (!contratosCol.fields.getByName('status_revisao')) {
      contratosCol.fields.add(
        new SelectField({
          name: 'status_revisao',
          values: ['rascunho_pendente', 'revisado', 'ativo'],
          maxSelect: 1,
        }),
      )
    }

    // 2. Campo sugestao_origem em contratos relacionando a sugestoes_funil
    if (!contratosCol.fields.getByName('sugestao_origem')) {
      contratosCol.fields.add(
        new RelationField({
          name: 'sugestao_origem',
          collectionId: sugestoesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(contratosCol)

    // Adicionar índice em sugestao_origem
    try {
      contratosCol.addIndex('idx_contratos_sugestao_origem', false, 'sugestao_origem', '')
      app.save(contratosCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos')
      if (contratosCol.fields.getByName('sugestao_origem')) {
        contratosCol.fields.removeByName('sugestao_origem')
      }
      if (contratosCol.fields.getByName('status_revisao')) {
        contratosCol.fields.removeByName('status_revisao')
      }
      app.save(contratosCol)
    } catch (_) {}
  },
)
