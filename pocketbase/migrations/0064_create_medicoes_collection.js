migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const executoresCol = app.findCollectionByNameOrId('executores')

    let medicoesCol
    try {
      medicoesCol = app.findCollectionByNameOrId('medicoes')
    } catch (_) {
      medicoesCol = new Collection({
        name: 'medicoes',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'numero', type: 'text', required: true },
          {
            name: 'subcontrato',
            type: 'relation',
            collectionId: subcontratosCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'projeto',
            type: 'relation',
            collectionId: projetosCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'executor',
            type: 'relation',
            collectionId: executoresCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'numero_medicao', type: 'number', onlyInt: true, required: true },
          { name: 'periodo_inicio', type: 'date', required: true },
          { name: 'periodo_fim', type: 'date', required: true },
          { name: 'percentual_executado', type: 'number', required: true },
          { name: 'valor_bruto', type: 'number', required: true },
          { name: 'retencao_impostos', type: 'number', required: false },
          { name: 'valor_liquido', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            values: ['apresentada', 'aprovada', 'reprovada', 'faturada', 'paga'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'aprovada_por',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'data_aprovacao', type: 'date', required: false },
          { name: 'observacoes_gestor', type: 'text', required: false },
          {
            name: 'anexos',
            type: 'file',
            maxSelect: 10,
            maxSize: 20971520,
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_medicoes_numero ON medicoes (numero)',
          'CREATE INDEX idx_medicoes_subcontrato ON medicoes (subcontrato)',
          'CREATE INDEX idx_medicoes_projeto ON medicoes (projeto)',
          'CREATE INDEX idx_medicoes_executor ON medicoes (executor)',
          'CREATE INDEX idx_medicoes_status ON medicoes (status)',
        ],
      })
      app.save(medicoesCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('medicoes')
      app.delete(col)
    } catch (_) {}
  },
)
