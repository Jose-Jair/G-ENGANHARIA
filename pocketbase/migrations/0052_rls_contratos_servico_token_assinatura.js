migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos_servico')

    // 1. Atualizar API rules para garantir que token_assinatura_cliente seja aceito via query param e via headers:
    // x_token_assinatura e x_token_assinatura_cliente (e seus equivalentes sem underscore no PB se aplicável)
    col.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && (@request.query.token = token_assinatura_cliente || token_assinatura_cliente = @request.headers.x_token_assinatura || token_assinatura_cliente = @request.headers.x_token_assinatura_cliente)) || (token_complemento_dados != '' && (@request.query.token = token_complemento_dados || token_complemento_dados = @request.headers.x_token_complemento))"

    col.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && (@request.query.token = token_assinatura_cliente || token_assinatura_cliente = @request.headers.x_token_assinatura || token_assinatura_cliente = @request.headers.x_token_assinatura_cliente)) || (token_complemento_dados != '' && (@request.query.token = token_complemento_dados || token_complemento_dados = @request.headers.x_token_complemento))"

    // 2. Adicionar índice em token_assinatura_cliente se ainda não existir
    try {
      col.addIndex('idx_contratos_servico_token_cli', false, 'token_assinatura_cliente', '')
    } catch (_) {}

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contratos_servico')
      col.removeIndex('idx_contratos_servico_token_cli')
      app.save(col)
    } catch (_) {}
  },
)
