/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0125 - Lote 4: Portal do Prestador (Achado M5)
    // Atualização das API rules de portal_os, portal_entregaveis e portal_documentos:
    // Vincula o acesso do executor ao prestador_id (relacionando com prestadores via @collection.prestadores)
    // mantendo fallback seguro por prestador_email = @request.auth.email.

    const colecoes = ['portal_os', 'portal_entregaveis', 'portal_documentos']

    for (let i = 0; i < colecoes.length; i++) {
      const nomeCol = colecoes[i]
      try {
        const col = app.findCollectionByNameOrId(nomeCol)

        // Garantir campo prestador_id na coleção caso não exista
        if (!col.fields.getByName('prestador_id')) {
          col.fields.add(new TextField({ name: 'prestador_id' }))
        }

        const regraLeitura =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && ((prestador_id != '' && @collection.prestadores.id ?= prestador_id && @collection.prestadores.email ?= @request.auth.email) || prestador_email = @request.auth.email)))"

        col.listRule = regraLeitura
        col.viewRule = regraLeitura

        app.save(col)
      } catch (err) {
        console.log('Erro ao atualizar regras de ' + nomeCol + ' na 0125: ' + err)
        throw err
      }
    }
  },
  (app) => {
    const colecoes = ['portal_os', 'portal_entregaveis', 'portal_documentos']
    for (let i = 0; i < colecoes.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(colecoes[i])
        const regraAntiga =
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
        col.listRule = regraAntiga
        col.viewRule = regraAntiga
        app.save(col)
      } catch (_) {}
    }
  },
)
