migrate(
  (app) => {
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    try {
      const existing = app.findFirstRecordByData('parametros', 'chave', 'funil_estagnacao_dias')
      if (existing) {
        existing.set('valor', '15')
        existing.set(
          'descricao',
          'Quantidade limite de dias sem avanço de etapa ou registro de toque antes de considerar uma empresa estagnada no funil de prospecção',
        )
        app.save(existing)
      }
    } catch (_) {
      const record = new Record(parametrosCol)
      record.set('chave', 'funil_estagnacao_dias')
      record.set('valor', '15')
      record.set(
        'descricao',
        'Quantidade limite de dias sem avanço de etapa ou registro de toque antes de considerar uma empresa estagnada no funil de prospecção',
      )
      app.save(record)
    }
  },
  (app) => {
    try {
      const existing = app.findFirstRecordByData('parametros', 'chave', 'funil_estagnacao_dias')
      if (existing) {
        app.delete(existing)
      }
    } catch (_) {}
  },
)
