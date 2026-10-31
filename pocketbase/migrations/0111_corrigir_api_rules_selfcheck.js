// pocketbase/migrations/0111_corrigir_api_rules_selfcheck.js
// =============================================================================
// GESTÃO G+ — MIGRAÇÃO 0111: CORREÇÃO IDEMPOTENTE DAS API RULES PARA O SELFCHECK
// Restaura a condição segura de token em cotacoes e subcontratos:
// Permite acesso via token específico (@request.query.token = token) ou headers,
// mantendo bloqueio anti-escalonamento de perfil (role) em _pb_users_auth_.
// =============================================================================

migrate(
  (app) => {
    // 1. Coleção cotacoes:
    // Deve permitir perfis autorizados (admin, gestor, financeiro, executor da cotação)
    // E acesso seguro por token específico (@request.query.token = token || token = @request.headers.x_token_cotacao),
    // SEM a vulnerabilidade antiga de token != '' solto.
    try {
      const colCot = app.findCollectionByNameOrId('cotacoes')
      colCot.listRule =
        "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
      colCot.viewRule =
        "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
      app.save(colCot)
    } catch (eCot) {
      console.log('Erro ao atualizar api rules de cotacoes na 0111: ' + eCot)
    }

    // 2. Coleção subcontratos:
    // Deve permitir perfis autorizados e token específico (@request.query.token = token_assinatura)
    try {
      const colSub = app.findCollectionByNameOrId('subcontratos')
      colSub.listRule =
        "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
      colSub.viewRule =
        "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
      app.save(colSub)
    } catch (eSub) {
      console.log('Erro ao atualizar api rules de subcontratos na 0111: ' + eSub)
    }

    // 3. Garantir anti-escalonamento de role em _pb_users_auth_
    try {
      const colUsers = app.findCollectionByNameOrId('_pb_users_auth_')
      colUsers.updateRule =
        "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'admin') && (@request.auth.role = 'admin' || (@request.body.role:changed = false && @request.body.active:changed = false && @request.body.cpf_cnpj:changed = false))"
      app.save(colUsers)
    } catch (eUsr) {
      console.log('Erro ao garantir anti-escalonamento de users na 0111: ' + eUsr)
    }
  },
  (app) => {},
)
