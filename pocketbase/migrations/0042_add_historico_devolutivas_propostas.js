migrate(
  (app) => {
    const propostas = app.findCollectionByNameOrId('propostas')
    if (!propostas.fields.getByName('historico_devolutivas')) {
      propostas.fields.add(
        new JSONField({
          name: 'historico_devolutivas',
          required: false,
        }),
      )
      app.save(propostas)
    }
  },
  (app) => {
    const propostas = app.findCollectionByNameOrId('propostas')
    if (propostas.fields.getByName('historico_devolutivas')) {
      propostas.fields.removeByName('historico_devolutivas')
      app.save(propostas)
    }
  },
)
