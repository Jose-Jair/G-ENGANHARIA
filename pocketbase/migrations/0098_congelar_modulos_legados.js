migrate(
  (app) => {
    // Congelamento de coleções legadas (Rodada 11 - Saneamento)
    // Mantém leitura intacta para auditoria e histórico
    // Bloqueia create e update via API rules

    // 1. executores: congelada
    try {
      const colExec = app.findCollectionByNameOrId('executores')
      colExec.createRule = null
      colExec.updateRule = null
      colExec.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(colExec)
    } catch (e) {
      console.log('Aviso ao congelar executores: ' + e)
    }

    // 2. subcontratos: congelada
    try {
      const colSub = app.findCollectionByNameOrId('subcontratos')
      colSub.createRule = null
      colSub.updateRule = null
      colSub.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(colSub)
    } catch (e) {
      console.log('Aviso ao congelar subcontratos: ' + e)
    }

    // 3. projeto_etapas: congelada
    try {
      const colEtapas = app.findCollectionByNameOrId('projeto_etapas')
      colEtapas.createRule = null
      colEtapas.updateRule = null
      colEtapas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(colEtapas)
    } catch (e) {
      console.log('Aviso ao congelar projeto_etapas: ' + e)
    }

    // 4. cotacoes: congelar criação e respostas por token público legado
    try {
      const colCot = app.findCollectionByNameOrId('cotacoes')
      colCot.createRule = null
      colCot.updateRule = null
      colCot.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(colCot)
    } catch (e) {
      console.log('Aviso ao congelar cotacoes: ' + e)
    }
  },
  (app) => {
    // Reversão das regras anteriores se necessário
    try {
      const colExec = app.findCollectionByNameOrId('executores')
      colExec.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      colExec.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(colExec)
    } catch (_) {}

    try {
      const colSub = app.findCollectionByNameOrId('subcontratos')
      colSub.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      colSub.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(colSub)
    } catch (_) {}

    try {
      const colEtapas = app.findCollectionByNameOrId('projeto_etapas')
      colEtapas.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      colEtapas.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(colEtapas)
    } catch (_) {}

    try {
      const colCot = app.findCollectionByNameOrId('cotacoes')
      colCot.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      colCot.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(colCot)
    } catch (_) {}
  },
)
