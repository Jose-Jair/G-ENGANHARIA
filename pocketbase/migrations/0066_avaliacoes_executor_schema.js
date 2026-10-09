// Migração 0066 — Coleção avaliacoes_executor (Módulo de Avaliações de Executor por Subcontrato)
// Cria a coleção com rules: leitura admin/gestor/comercial; escrita somente via hook (createRule/updateRule/deleteRule = null).
// Imutabilidade garantida no servidor (sem regra de update/delete para perfis de aplicação).
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const executoresCol = app.findCollectionByNameOrId('executores')

    let avaliacoesCol
    try {
      avaliacoesCol = app.findCollectionByNameOrId('avaliacoes_executor')
    } catch (_) {
      avaliacoesCol = new Collection({
        name: 'avaliacoes_executor',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')",
        createRule: null,
        updateRule: null,
        deleteRule: null,
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
          {
            name: 'avaliado_por',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'data_avaliacao', type: 'date', required: true },
          { name: 'nota_prazo', type: 'number', min: 1, max: 5, onlyInt: true, required: true },
          { name: 'nota_qualidade', type: 'number', min: 1, max: 5, onlyInt: true, required: true },
          {
            name: 'nota_comunicacao',
            type: 'number',
            min: 1,
            max: 5,
            onlyInt: true,
            required: true,
          },
          { name: 'nota_ponderada', type: 'number', min: 1, max: 5, required: true },
          { name: 'comentarios', type: 'text', required: false },
          {
            name: 'anexos',
            type: 'file',
            maxSelect: 5,
            maxSize: 20971520,
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_avaliacoes_executor_subcontrato ON avaliacoes_executor (subcontrato)',
          'CREATE INDEX idx_avaliacoes_executor_executor ON avaliacoes_executor (executor)',
          'CREATE INDEX idx_avaliacoes_executor_projeto ON avaliacoes_executor (projeto)',
        ],
      })
      app.save(avaliacoesCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('avaliacoes_executor')
      app.delete(col)
    } catch (_) {}
  },
)
