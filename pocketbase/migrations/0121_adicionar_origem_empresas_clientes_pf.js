migrate(
  (app) => {
    // Adicionar campo origem na coleção empresas (para rastreio da origem do lead: 'site', 'prospeccao', etc.)
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (!empresasCol.fields.getByName('origem')) {
      empresasCol.fields.add(new TextField({ name: 'origem' }))
      app.save(empresasCol)
    }

    // Adicionar campo origem na coleção clientes_pf
    const clientesPfCol = app.findCollectionByNameOrId('clientes_pf')
    if (!clientesPfCol.fields.getByName('origem')) {
      clientesPfCol.fields.add(new TextField({ name: 'origem' }))
      app.save(clientesPfCol)
    }
  },
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (empresasCol && empresasCol.fields.getByName('origem')) {
      empresasCol.fields.removeByName('origem')
      app.save(empresasCol)
    }

    const clientesPfCol = app.findCollectionByNameOrId('clientes_pf')
    if (clientesPfCol && clientesPfCol.fields.getByName('origem')) {
      clientesPfCol.fields.removeByName('origem')
      app.save(clientesPfCol)
    }
  },
)
