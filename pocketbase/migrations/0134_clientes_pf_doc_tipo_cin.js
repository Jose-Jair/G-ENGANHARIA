// Migração 0134 — Acrescentar 'CIN' nas opções do campo select doc_tipo em clientes_pf.
// Valores: ['CIN', 'RG', 'CNH', 'Carteira profissional', 'Outro'].
// CIN (Carteira de Identidade Nacional) usa como número o próprio CPF.

migrate(
  (app) => {
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')
    const field = clientesPf.fields.getByName('doc_tipo')

    const novosValores = ['CIN', 'RG', 'CNH', 'Carteira profissional', 'Outro']

    if (field) {
      field.values = novosValores
      field.maxSelect = 1
    } else {
      clientesPf.fields.add(
        new SelectField({
          name: 'doc_tipo',
          maxSelect: 1,
          values: novosValores,
        }),
      )
    }

    if (!clientesPf.fields.getByName('doc_tipo_outro')) {
      clientesPf.fields.add(new TextField({ name: 'doc_tipo_outro' }))
    }

    app.save(clientesPf)
  },
  (app) => {
    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      const field = clientesPf.fields.getByName('doc_tipo')
      if (field) {
        field.values = ['RG', 'CNH', 'Carteira profissional', 'Outro']
        app.save(clientesPf)
      }
    } catch (_) {}
  },
)
