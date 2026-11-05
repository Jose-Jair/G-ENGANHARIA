// Migração 0135 — Adicionar campos autodate created e updated à coleção clientes_pf_convites
// Corrige o erro 400 em ordenações ?sort=-created no painel administrativo.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clientes_pf_convites')
    if (!col) return

    if (!col.fields.getByName('created')) {
      col.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        }),
      )
    }

    if (!col.fields.getByName('updated')) {
      col.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clientes_pf_convites')
      if (!col) return
      if (col.fields.getByName('created')) {
        col.fields.removeByName('created')
      }
      if (col.fields.getByName('updated')) {
        col.fields.removeByName('updated')
      }
      app.save(col)
    } catch (_) {}
  },
)
