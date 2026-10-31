migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. Reforço de API Rules para restrição do perfil 'financeiro':
    //    Financeiro sem escopo técnico e arquivos de projeto:
    //    - entregaveis: remover 'financeiro' de listRule e viewRule
    //    - entregaveis_versoes: remover 'financeiro' de listRule e viewRule
    //    - documentos: manter financeiro apenas para tipo = 'medicao' (necessário para listMedicoesAprovadas no financeiro)
    //    - mensagens_os: já sem financeiro na migração 0108, mantido restrito a admin, gestor e executor da OS
    // -------------------------------------------------------------------------
    try {
      const colEnt = app.findCollectionByNameOrId('entregaveis')
      colEnt.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      colEnt.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      app.save(colEnt)
    } catch (_) {}

    try {
      const colEntVers = app.findCollectionByNameOrId('entregaveis_versoes')
      colEntVers.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      colEntVers.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      app.save(colEntVers)
    } catch (_) {}

    try {
      const colDocs = app.findCollectionByNameOrId('documentos')
      // Financeiro só pode listar/ver documentos de medição financeira (tipo = 'medicao')
      colDocs.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'financeiro' && tipo = 'medicao'))"
      colDocs.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'financeiro' && tipo = 'medicao'))"
      app.save(colDocs)
    } catch (_) {}
  },
  (app) => {},
)
