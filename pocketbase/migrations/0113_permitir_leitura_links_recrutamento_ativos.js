migrate(
  (app) => {
    // Migração 0113: Ajuste idempotente nas regras da coleção links_recrutamento
    // Permite leitura anônima de registros ativos e não expirados via API direta:
    // ativo = true && (expira_em = '' || expira_em = null || expira_em > @now)
    // Mantém acesso integral para Admin e Gestor.
    // O endpoint dedicado GET /backend/v1/recrutamento/link-publico/:slug também é fornecido
    // expondo estritamente os campos públicos sem dados sensíveis.
    try {
      const linksCol = app.findCollectionByNameOrId('links_recrutamento')

      const regraPublicaAtivoNaoExpirado =
        "(ativo = true && (expira_em = '' || expira_em > @now)) || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor'))"

      linksCol.listRule = regraPublicaAtivoNaoExpirado
      linksCol.viewRule = regraPublicaAtivoNaoExpirado

      // Criação, alteração e exclusão continuam restritas a Admin/Gestor
      linksCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

      app.save(linksCol)
    } catch (err) {
      console.log('Aviso ao ajustar regras de links_recrutamento: ' + err)
    }
  },
  (app) => {
    try {
      const linksCol = app.findCollectionByNameOrId('links_recrutamento')
      linksCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(linksCol)
    } catch (_) {}
  },
)
