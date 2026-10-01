migrate(
  (app) => {
    // 1. parametros
    const parametros = new Collection({
      name: 'parametros',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'valor', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_parametros_chave ON parametros (chave)'],
    })
    app.save(parametros)

    // 2. modelos
    const modelos = new Collection({
      name: 'modelos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'email_institucional',
            'solucao_elaborada',
            'piloto',
            'campanha',
            'proposta',
            'cotacao',
          ],
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'assunto', type: 'text' },
        { name: 'corpo', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(modelos)

    // 3. motivos
    const motivos = new Collection({
      name: 'motivos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['inativacao', 'recusa_proposta', 'cancelamento_toque'],
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(motivos)

    // 4. audit_logs
    // Regras: listRule/viewRule = só admin; createRule/updateRule/deleteRule = NINGUÉM (null)
    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'user_email', type: 'text' },
        { name: 'acao', type: 'text', required: true },
        { name: 'entidade', type: 'text', required: true },
        { name: 'registro_id', type: 'text' },
        { name: 'detalhes', type: 'json' },
        { name: 'ip', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_logs_created ON audit_logs (created DESC)',
        'CREATE INDEX idx_audit_logs_entidade ON audit_logs (entidade)',
        'CREATE INDEX idx_audit_logs_user ON audit_logs (user)',
      ],
    })
    app.save(auditLogs)
  },
  (app) => {
    ;['audit_logs', 'motivos', 'modelos', 'parametros'].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
