migrate(
  (app) => {
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const clientesPfId = app.findCollectionByNameOrId('clientes_pf').id
    const contratosId = app.findCollectionByNameOrId('contratos').id

    // 1. propostas
    const propostas = new Collection({
      name: 'propostas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'numero', type: 'text', required: true },
        { name: 'revisao', type: 'text' },
        {
          name: 'empresa',
          type: 'relation',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'cliente_pf',
          type: 'relation',
          collectionId: clientesPfId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'escopo', type: 'text' },
        { name: 'disciplinas', type: 'text' },
        { name: 'entregaveis', type: 'text' },
        { name: 'prazo', type: 'text' },
        { name: 'preco', type: 'number' },
        { name: 'custo', type: 'number' },
        { name: 'margem', type: 'number' },
        { name: 'impostos', type: 'number' },
        { name: 'condicoes_pagamento', type: 'text' },
        { name: 'validade', type: 'date' },
        { name: 'premissas', type: 'text' },
        { name: 'exclusoes', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'rascunho',
            'aprovacao_interna',
            'enviada',
            'visualizada',
            'em_negociacao',
            'aceita',
            'recusada',
            'expirada',
          ],
          maxSelect: 1,
        },
        { name: 'motivo_recusa', type: 'text' },
        { name: 'token_aceite', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_propostas_numero ON propostas (numero)',
        'CREATE INDEX idx_propostas_empresa ON propostas (empresa)',
        'CREATE INDEX idx_propostas_status ON propostas (status)',
      ],
    })
    app.save(propostas)

    const propostasId = app.findCollectionByNameOrId('propostas').id

    // 2. projetos
    const projetos = new Collection({
      name: 'projetos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'codigo', type: 'text', required: true },
        {
          name: 'proposta',
          type: 'relation',
          collectionId: propostasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contrato',
          type: 'relation',
          collectionId: contratosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'subcontratacao_autorizada', type: 'bool' },
        { name: 'anexo_autorizacao', type: 'file', maxSelect: 1, maxSize: 10485760 },
        {
          name: 'saude',
          type: 'select',
          values: ['verde', 'amarelo', 'vermelho'],
          maxSelect: 1,
        },
        { name: 'status', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_projetos_codigo ON projetos (codigo)'],
    })
    app.save(projetos)
  },
  (app) => {
    ;['projetos', 'propostas'].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
