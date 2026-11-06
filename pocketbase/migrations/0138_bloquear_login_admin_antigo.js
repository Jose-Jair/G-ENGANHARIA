// Migração 0138 — Bloqueio de login da conta antiga (admin@sistema.eng.br / Ana Souza)
// Acrescenta 'admin@sistema.eng.br' ao parâmetro 'login_bloqueado' em parametros,
// mantendo os 4 e-mails já bloqueados (comercial@..., financeiro@..., gestor@..., executor@...).
// Idempotente via SQL direto, sem disparar hooks nem alterar/apagar users/audit_logs.

migrate(
  (app) => {
    if (!app.hasTable('parametros')) {
      console.log('[0138] Tabela parametros não encontrada. Nenhuma ação necessária.')
      return
    }

    const emailParaBloquear = 'admin@sistema.eng.br'

    try {
      const rec = app.findFirstRecordByFilter('parametros', "chave = 'login_bloqueado'")
      if (rec) {
        const valorAtual = (rec.getString('valor') || '').trim()
        const lista = valorAtual
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length > 0)

        if (lista.indexOf(emailParaBloquear) === -1) {
          lista.push(emailParaBloquear)
          const novoValor = lista.join(',')
          app
            .db()
            .newQuery('UPDATE parametros SET valor = {:novoValor} WHERE id = {:id}')
            .bind({ novoValor: novoValor, id: rec.id })
            .execute()
          console.log(
            '[0138] Parametro login_bloqueado atualizado via SQL com sucesso: ' + novoValor,
          )
        } else {
          console.log('[0138] admin@sistema.eng.br já estava presente na lista login_bloqueado.')
        }
      }
    } catch (e) {
      console.log('[0138] Registro de login_bloqueado não encontrado ou erro na leitura: ' + e)
      throw e
    }
  },
  (app) => {
    // Reversão opcional: remove admin@sistema.eng.br mantendo os demais
    try {
      const qBusca = app
        .db()
        .newQuery("SELECT id, valor FROM parametros WHERE chave = 'login_bloqueado' LIMIT 1")
      const row = {}
      qBusca.one(row)

      if (row.id && row.valor) {
        const lista = (row.valor || '')
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length > 0 && item !== 'admin@sistema.eng.br')
        const novoValor = lista.join(',')
        app
          .db()
          .newQuery('UPDATE parametros SET valor = {:novoValor} WHERE id = {:id}')
          .bind({ novoValor: novoValor, id: row.id })
          .execute()
      }
    } catch (_) {}
  },
)
