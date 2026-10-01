migrate(
  (app) => {
    const empresas = app.findCollectionByNameOrId('empresas')

    // Adicionar campo telefones (JSON) se ainda não existir
    if (!empresas.fields.getByName('telefones')) {
      empresas.fields.add(
        new JSONField({
          name: 'telefones',
          required: false,
        }),
      )
      app.save(empresas)
    }
  },
  (app) => {
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const field = empresas.fields.getByName('telefones')
      if (field) {
        empresas.fields.remove(field)
        app.save(empresas)
      }
    } catch (_) {}
  },
)
