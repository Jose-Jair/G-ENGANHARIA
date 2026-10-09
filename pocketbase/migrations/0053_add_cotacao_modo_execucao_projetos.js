/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('projetos')
    const modoExecField = col.fields.getByName('modo_execucao')
    if (modoExecField) {
      // Garantir que 'cotacao' esteja entre os valores aceitos
      const currentValues = modoExecField.values || []
      const updatedValues = [...currentValues]
      if (!updatedValues.includes('cotacao')) {
        updatedValues.push('cotacao')
      }
      if (!updatedValues.includes('direta')) {
        updatedValues.push('direta')
      }
      modoExecField.values = updatedValues
      app.save(col)
    }
  },
  (app) => {
    // Reversão no-op
  },
)
