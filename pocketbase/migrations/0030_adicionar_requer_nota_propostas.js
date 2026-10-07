migrate(
  (app) => {
    const propostas = app.findCollectionByNameOrId('propostas')

    if (!propostas.fields.getByName('requer_nota')) {
      propostas.fields.add(
        new BoolField({
          name: 'requer_nota',
          required: false,
        }),
      )
      app.save(propostas)
    }

    // Garantir que propostas existentes tenham requer_nota = false (0 no SQLite)
    try {
      app.db().newQuery('UPDATE propostas SET requer_nota = 0 WHERE requer_nota IS NULL').execute()
    } catch (_) {}
  },
  (app) => {
    const propostas = app.findCollectionByNameOrId('propostas')
    const f = propostas.fields.getByName('requer_nota')
    if (f) {
      propostas.fields.removeByName('requer_nota')
      app.save(propostas)
    }
  },
)
