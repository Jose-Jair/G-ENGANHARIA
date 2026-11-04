/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Correção API Rules portal_entregaveis:
    // Permite que o executor autenticado crie e atualize entregáveis técnicos em OS atribuídas a seu prestador
    // (via prestador_id com vínculo seguro ao prestadores.id e email do auth, com fallback seguro por prestador_email).
    const col = app.findCollectionByNameOrId('portal_entregaveis')
    const regraGravacao =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && ((prestador_id != '' && @collection.prestadores.id ?= prestador_id && @collection.prestadores.email ?= @request.auth.email) || prestador_email = @request.auth.email)))"

    col.createRule = regraGravacao
    col.updateRule = regraGravacao
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('portal_entregaveis')
      col.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      col.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(col)
    } catch (_) {}
  },
)
