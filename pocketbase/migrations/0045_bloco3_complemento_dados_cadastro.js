migrate(
  (app) => {
    // 1. Atualizar contratos_servico:
    // - novo status 'aguardando_dados_cliente'
    // - token_complemento_dados (text)
    // - campos_faltantes_json (json)
    // - dados_completados_em (date)
    const contratosCol = app.findCollectionByNameOrId('contratos_servico')

    // Atualizar opções do campo select 'status'
    const statusField = contratosCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'aguardando_dados_cliente',
        'aguardando_assinatura_admin',
        'aguardando_assinatura_cliente',
        'assinado',
        'cancelado',
      ]
      statusField.maxSelect = 1
    }

    if (!contratosCol.fields.getByName('token_complemento_dados')) {
      contratosCol.fields.add(
        new TextField({
          name: 'token_complemento_dados',
          required: false,
        }),
      )
    }

    if (!contratosCol.fields.getByName('campos_faltantes_json')) {
      contratosCol.fields.add(
        new JSONField({
          name: 'campos_faltantes_json',
          required: false,
        }),
      )
    }

    if (!contratosCol.fields.getByName('dados_completados_em')) {
      contratosCol.fields.add(
        new DateField({
          name: 'dados_completados_em',
          required: false,
        }),
      )
    }

    // Permitir list e view pública também quando query ?token coincidir com token_complemento_dados
    contratosCol.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && @request.query.token = token_assinatura_cliente) || (token_complemento_dados != '' && @request.query.token = token_complemento_dados)"

    contratosCol.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && (@request.query.token = token_assinatura_cliente || token_assinatura_cliente = @request.headers.x_token_assinatura)) || (token_complemento_dados != '' && (@request.query.token = token_complemento_dados || token_complemento_dados = @request.headers.x_token_complemento))"

    app.save(contratosCol)

    // Índice para token_complemento_dados
    try {
      contratosCol.addIndex(
        'idx_contratos_servico_token_comp',
        false,
        'token_complemento_dados',
        '',
      )
      app.save(contratosCol)
    } catch (_) {}

    // 2. Parâmetro editável em Administração para texto padrão do WhatsApp de complemento de dados
    const parametrosCol = app.findCollectionByNameOrId('parametros')
    const novoParametro = {
      chave: 'texto_padrao_whatsapp_complemento_dados',
      valor:
        'Olá, {nome}!\n\n' +
        'Recebemos com sucesso o seu aceite na Proposta Comercial {numero_proposta} da G+ Engenharia.\n\n' +
        'Para gerarmos o seu Contrato de Prestação de Serviços Técnicos completo ({numero_contrato}) e liberarmos a assinatura digital, precisamos que você complete alguns dados cadastrais obrigatórios no link seguro abaixo:\n\n' +
        '{link_complemento}\n\n' +
        'É rápido e garante a total segurança jurídica do seu contrato. Qualquer dúvida, estamos à disposição!\n\n' +
        'G+ Engenharia Consultiva',
      descricao:
        'Texto padrão sugerido para envio do link de complemento de dados cadastrais ao cliente via WhatsApp (editável em Administração). Variáveis: {nome}, {numero_proposta}, {numero_contrato}, {link_complemento}',
    }

    try {
      const existente = app.findFirstRecordByData('parametros', 'chave', novoParametro.chave)
      if (existente) {
        existente.set('descricao', novoParametro.descricao)
        app.save(existente)
      }
    } catch (_) {
      const novo = new Record(parametrosCol)
      novo.set('chave', novoParametro.chave)
      novo.set('valor', novoParametro.valor)
      novo.set('descricao', novoParametro.descricao)
      app.save(novo)
    }
  },
  (app) => {
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos_servico')
      contratosCol.removeIndex('idx_contratos_servico_token_comp')
      app.save(contratosCol)
    } catch (_) {}
  },
)
