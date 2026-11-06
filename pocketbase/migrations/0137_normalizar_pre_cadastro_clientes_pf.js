// Migração 0137 — Normalizar pre_cadastro de clientes_pf
// Atualiza pre_cadastro = false onde cadastro_status = 'completo' e pre_cadastro = true.
// IDEMPOTENTE: executa diretamente via SQL sem disparar hooks ou records API.
// Registra contagens antes e depois.

migrate(
  (app) => {
    if (!app.hasTable('clientes_pf')) {
      console.log('[0137] Tabela clientes_pf não encontrada. Nenhuma ação necessária.')
      return
    }

    let contagemAntes = 0
    try {
      const qAntes = app
        .db()
        .newQuery(
          "SELECT COUNT(*) AS total FROM clientes_pf WHERE cadastro_status = 'completo' AND pre_cadastro = true",
        )
      const resAntes = {}
      qAntes.one(resAntes)
      contagemAntes = parseInt(resAntes.total, 10) || 0
    } catch (eCountAntes) {
      console.log('[0137] Erro ao contar antes: ' + eCountAntes)
    }

    console.log(
      "[0137] Contagem de clientes_pf com cadastro_status='completo' e pre_cadastro=true antes da normalização: " +
        contagemAntes,
    )

    // Executa UPDATE direto via SQL
    try {
      app
        .db()
        .newQuery(
          "UPDATE clientes_pf SET pre_cadastro = false WHERE cadastro_status = 'completo' AND pre_cadastro = true",
        )
        .execute()
    } catch (eUpdate) {
      console.log('[0137] Erro ao executar UPDATE em clientes_pf: ' + eUpdate)
      throw eUpdate
    }

    let contagemDepois = 0
    try {
      const qDepois = app
        .db()
        .newQuery(
          "SELECT COUNT(*) AS total FROM clientes_pf WHERE cadastro_status = 'completo' AND pre_cadastro = true",
        )
      const resDepois = {}
      qDepois.one(resDepois)
      contagemDepois = parseInt(resDepois.total, 10) || 0
    } catch (eCountDepois) {
      console.log('[0137] Erro ao contar depois: ' + eCountDepois)
    }

    console.log(
      "[0137] Contagem de clientes_pf com cadastro_status='completo' e pre_cadastro=true após a normalização: " +
        contagemDepois,
    )
  },
  (app) => {
    // Reversão não é aplicável/necessária para normalização de consistência de dados
  },
)
