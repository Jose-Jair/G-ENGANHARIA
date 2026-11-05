// Migração 0133 — Documento de Identificação em clientes_pf (RG, CNH, Carteira profissional, Outro)
// e descontinuação do campo regime_bens na UI.

migrate(
  (app) => {
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')

    if (!clientesPf.fields.getByName('doc_tipo')) {
      clientesPf.fields.add(
        new SelectField({
          name: 'doc_tipo',
          maxSelect: 1,
          values: ['RG', 'CNH', 'Carteira profissional', 'Outro'],
        }),
      )
    }

    if (!clientesPf.fields.getByName('doc_tipo_outro')) {
      clientesPf.fields.add(new TextField({ name: 'doc_tipo_outro' }))
    }

    app.save(clientesPf)

    // Backfill idempotente: registros existentes com RG preenchido recebem doc_tipo = 'RG'
    app
      .db()
      .newQuery(
        "UPDATE clientes_pf SET doc_tipo = 'RG' WHERE (doc_tipo IS NULL OR doc_tipo = '') AND (rg IS NOT NULL AND rg != '')",
      )
      .execute()
  },
  (app) => {
    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      if (clientesPf.fields.getByName('doc_tipo')) {
        clientesPf.fields.removeByName('doc_tipo')
      }
      if (clientesPf.fields.getByName('doc_tipo_outro')) {
        clientesPf.fields.removeByName('doc_tipo_outro')
      }
      app.save(clientesPf)
    } catch (_) {}
  },
)
