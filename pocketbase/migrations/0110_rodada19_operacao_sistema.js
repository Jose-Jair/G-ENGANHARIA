migrate(
  (app) => {
    // 1. Coleção erros_sistema
    const collection = new Collection({
      name: 'erros_sistema',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'rota', type: 'text', required: true },
        { name: 'mensagem', type: 'text', required: true },
        {
          name: 'usuario',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: false,
          maxSelect: 1,
        },
        { name: 'usuario_email', type: 'text', required: false },
        { name: 'hora', type: 'date', required: false },
        { name: 'ip', type: 'text', required: false },
        { name: 'detalhes', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_erros_sistema_created ON erros_sistema (created DESC)',
        'CREATE INDEX idx_erros_sistema_rota ON erros_sistema (rota)',
      ],
    })
    app.save(collection)

    // 2. Parâmetros de tamanhos máximos de upload e status de crons
    const parametrosIniciais = [
      {
        chave: 'upload_max_ifc_mb',
        valor: '150',
        descricao: 'Tamanho máximo permitido para modelos IFC em megabytes (MB)',
      },
      {
        chave: 'upload_max_dwg_mb',
        valor: '100',
        descricao: 'Tamanho máximo permitido para pranchas e arquivos DWG em megabytes (MB)',
      },
      {
        chave: 'upload_max_pdf_mb',
        valor: '50',
        descricao: 'Tamanho máximo permitido para documentos técnicos PDF em megabytes (MB)',
      },
      {
        chave: 'upload_max_imagem_mb',
        valor: '25',
        descricao: 'Tamanho máximo permitido para imagens e evidências em megabytes (MB)',
      },
      {
        chave: 'crons_ultimo_sucesso',
        valor: JSON.stringify({
          cobranca_prazos: {
            ultimo_sucesso: new Date().toISOString(),
            status: 'ok',
            intervalo_minutos: 10,
          },
          prospeccao: {
            ultimo_sucesso: new Date().toISOString(),
            status: 'ok',
            intervalo_minutos: 1440,
          },
          scorecards: {
            ultimo_sucesso: new Date().toISOString(),
            status: 'ok',
            intervalo_minutos: 1440,
          },
          exportacao: {
            ultimo_sucesso: new Date().toISOString(),
            status: 'ok',
            intervalo_minutos: 10080,
          },
        }),
        descricao:
          'Registro centralizado de último sucesso e intervalo das rotinas de cron agendadas',
      },
      {
        chave: 'exportacao_semanal_ultimo_json',
        valor: '',
        descricao:
          'Metadados e sumário do último arquivo de exportação semanal gerado pelo sistema',
      },
    ]

    const paramCol = app.findCollectionByNameOrId('parametros')
    for (let i = 0; i < parametrosIniciais.length; i++) {
      const p = parametrosIniciais[i]
      let existe = false
      try {
        const rec = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (rec) existe = true
      } catch (_) {}

      if (!existe) {
        const rec = new Record(paramCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('erros_sistema')
      app.delete(col)
    } catch (_) {}
  },
)
