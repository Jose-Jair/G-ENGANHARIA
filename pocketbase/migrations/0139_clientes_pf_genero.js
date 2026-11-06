// Migração 0139 — Adicionar campo genero em clientes_pf (select: masculino, feminino)
// Opcional, sem default forçado em registros existentes. Idempotente.

migrate(
  (app) => {
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')

    if (!clientesPf.fields.getByName('genero')) {
      clientesPf.fields.add(
        new SelectField({
          name: 'genero',
          maxSelect: 1,
          values: ['masculino', 'feminino'],
        }),
      )
      app.save(clientesPf)
      console.log('[0139] Campo genero adicionado com sucesso em clientes_pf.')
    } else {
      console.log('[0139] Campo genero já existe em clientes_pf.')
    }
  },
  (app) => {
    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      if (clientesPf.fields.getByName('genero')) {
        clientesPf.fields.removeByName('genero')
        app.save(clientesPf)
      }
    } catch (_) {}
  },
)
