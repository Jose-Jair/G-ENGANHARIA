/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const propostas = app.findCollectionByNameOrId('propostas')
    const statusField = propostas.fields.getByName('status')
    if (statusField && statusField.values) {
      if (!statusField.values.includes('aprovada')) {
        statusField.values.push('aprovada')
        app.save(propostas)
      }
    }
  },
  (app) => {
    try {
      const propostas = app.findCollectionByNameOrId('propostas')
      const statusField = propostas.fields.getByName('status')
      if (statusField && statusField.values) {
        statusField.values = statusField.values.filter((v) => v !== 'aprovada')
        app.save(propostas)
      }
    } catch (_) {}
  },
)
