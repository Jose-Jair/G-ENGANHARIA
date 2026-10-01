migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const modelosId = app.findCollectionByNameOrId('modelos').id

    // 1. empresas
    const empresas = new Collection({
      name: 'empresas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || responsavel = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || responsavel = @request.auth.id)",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || responsavel = @request.auth.id)",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'razao_social', type: 'text', required: true },
        { name: 'nome_fantasia', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'situacao_cadastral', type: 'text' },
        { name: 'cnae', type: 'text' },
        { name: 'porte', type: 'text' },
        { name: 'uf', type: 'text' },
        { name: 'municipio', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'instagram', type: 'text' },
        { name: 'linkedin', type: 'text' },
        { name: 'site', type: 'text' },
        {
          name: 'etapa_funil',
          type: 'select',
          values: [
            'identificada',
            'qualificada',
            'em_cadencia',
            'em_conversa',
            'com_proposta_elaborada',
            'proposta_enviada',
            'parceira',
            'nutricao_mensal',
            'inativa',
          ],
          maxSelect: 1,
        },
        {
          name: 'curva',
          type: 'select',
          values: ['A', 'B', 'C'],
          maxSelect: 1,
        },
        { name: 'score', type: 'number' },
        {
          name: 'responsavel',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['ativa', 'inativa'],
          maxSelect: 1,
        },
        { name: 'motivo_inativacao', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_empresas_cnpj ON empresas (cnpj)',
        'CREATE INDEX idx_empresas_status ON empresas (status)',
        'CREATE INDEX idx_empresas_responsavel ON empresas (responsavel)',
      ],
    })
    app.save(empresas)

    const empresasId = app.findCollectionByNameOrId('empresas').id

    // 2. contatos
    const contatos = new Collection({
      name: 'contatos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'cargo', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'decisor', type: 'bool' },
        { name: 'verificado', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_contatos_empresa ON contatos (empresa)'],
    })
    app.save(contatos)

    // 3. contratos
    const contratos = new Collection({
      name: 'contratos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'orgao', type: 'text', required: true },
        { name: 'numero', type: 'text', required: true },
        { name: 'objeto', type: 'text' },
        { name: 'modalidade', type: 'text' },
        { name: 'valor', type: 'number' },
        { name: 'saldo', type: 'number' },
        { name: 'vigencia_inicio', type: 'date' },
        { name: 'vigencia_fim', type: 'date' },
        { name: 'situacao', type: 'text' },
        { name: 'link_edital', type: 'text' },
        { name: 'fonte', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_contratos_empresa ON contratos (empresa)'],
    })
    app.save(contratos)

    // 4. toques
    const toques = new Collection({
      name: 'toques',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numero_toque', type: 'number', min: 1, max: 5 },
        { name: 'data_prevista', type: 'date' },
        { name: 'data_realizada', type: 'date' },
        { name: 'canal', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['agendado', 'para_hoje', 'em_atraso', 'realizado', 'respondido', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'resultado', type: 'text' },
        { name: 'observacao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_toques_empresa ON toques (empresa)'],
    })
    app.save(toques)

    // 5. campanhas
    const campanhas = new Collection({
      name: 'campanhas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'segmento',
          type: 'select',
          values: ['A', 'B', 'C', 'todos'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'aprovada', 'agendada', 'enviada'],
          maxSelect: 1,
        },
        { name: 'data_envio', type: 'date' },
        {
          name: 'template',
          type: 'relation',
          collectionId: modelosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'enviados', type: 'number' },
        { name: 'abertos', type: 'number' },
        { name: 'cliques', type: 'number' },
        { name: 'respostas', type: 'number' },
        { name: 'descadastros', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(campanhas)

    // 6. nao_contatar
    const naoContatar = new Collection({
      name: 'nao_contatar',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'empresa',
          type: 'relation',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'email', type: 'text', required: true },
        { name: 'motivo', type: 'text' },
        { name: 'data_inclusao', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_nao_contatar_email ON nao_contatar (email)'],
    })
    app.save(naoContatar)

    // 7. clientes_pf
    const clientesPf = new Collection({
      name: 'clientes_pf',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'base_legal', type: 'text' },
        { name: 'consentimento_lgpd', type: 'bool' },
        { name: 'data_consentimento', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(clientesPf)
  },
  (app) => {
    ;[
      'clientes_pf',
      'nao_contatar',
      'campanhas',
      'toques',
      'contratos',
      'contatos',
      'empresas',
    ].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
