migrate(
  (app) => {
    // 1. Campo pre_cadastro na coleção clientes_pf
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')
    if (!clientesPf.fields.getByName('pre_cadastro')) {
      clientesPf.fields.add(
        new BoolField({
          name: 'pre_cadastro',
          required: false,
        }),
      )
      app.save(clientesPf)
    }

    // 2. Campo pre_cadastro na coleção empresas
    const empresas = app.findCollectionByNameOrId('empresas')
    if (!empresas.fields.getByName('pre_cadastro')) {
      empresas.fields.add(
        new BoolField({
          name: 'pre_cadastro',
          required: false,
        }),
      )
      app.save(empresas)
    }

    // Garantir que todos os registros existentes continuem definitivos (pre_cadastro = 0 / false)
    try {
      app
        .db()
        .newQuery('UPDATE clientes_pf SET pre_cadastro = 0 WHERE pre_cadastro IS NULL')
        .execute()
    } catch (_) {}

    try {
      app.db().newQuery('UPDATE empresas SET pre_cadastro = 0 WHERE pre_cadastro IS NULL').execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      const fPf = clientesPf.fields.getByName('pre_cadastro')
      if (fPf) {
        clientesPf.fields.removeByName('pre_cadastro')
        app.save(clientesPf)
      }
    } catch (_) {}

    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      const fEmp = empresas.fields.getByName('pre_cadastro')
      if (fEmp) {
        empresas.fields.removeByName('pre_cadastro')
        app.save(empresas)
      }
    } catch (_) {}
  },
)
