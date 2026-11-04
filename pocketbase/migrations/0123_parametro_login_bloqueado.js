migrate(
  (app) => {
    const paramCol = app.findCollectionByNameOrId('parametros')

    // Verificar se o parâmetro 'login_bloqueado' já existe
    try {
      app.findFirstRecordByFilter('parametros', "chave = 'login_bloqueado'")
    } catch (_) {
      // Cria o parâmetro inicial com a lista reversível de e-mails de seeds bloqueados
      const rec = new Record(paramCol)
      rec.set('chave', 'login_bloqueado')
      rec.set(
        'descricao',
        'Lista de e-mails com login desativado/bloqueado no sistema (separados por vírgula). Editável pelo Administrador.',
      )
      rec.set(
        'valor',
        'comercial@sistema.eng.br,financeiro@sistema.eng.br,gestor@sistema.eng.br,executor@sistema.eng.br',
      )
      app.save(rec)
    }
  },
  (app) => {
    try {
      const rec = app.findFirstRecordByFilter('parametros', "chave = 'login_bloqueado'")
      if (rec) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
