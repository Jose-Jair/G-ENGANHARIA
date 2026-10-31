migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. Coleção 'decisoes_acoes' (Histórico auditado de itens fechados na Fila de Decisões)
    // -------------------------------------------------------------------------
    if (!app.hasTable('decisoes_acoes')) {
      const col = new Collection({
        name: 'decisoes_acoes',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule: null, // Imutável
        deleteRule: null, // Proibido apagar histórico
        fields: [
          { name: 'tipo_item', type: 'text', required: true },
          { name: 'item_id', type: 'text', required: true },
          { name: 'impacto', type: 'text', required: true },
          { name: 'titulo', type: 'text', required: true },
          {
            name: 'resolvido_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'resolvido_por_email', type: 'text' },
          { name: 'resolvido_por_nome', type: 'text' },
          { name: 'parecer_resolucao', type: 'text' },
          { name: 'acao_tomada', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_decisao_item ON decisoes_acoes (tipo_item, item_id)',
          'CREATE INDEX idx_decisao_resolvido_por ON decisoes_acoes (resolvido_por)',
        ],
      })
      app.save(col)
    }

    // -------------------------------------------------------------------------
    // 2. Parâmetros na Administração para Sigilo e Rotas Públicas com Token
    // -------------------------------------------------------------------------
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'token_publico_expiracao_horas',
        valor: '48',
        descricao: 'Tempo padrão de expiração de tokens públicos de uso único (em horas)',
      },
      {
        chave: 'token_publico_tentativas_max',
        valor: '5',
        descricao: 'Limite máximo de tentativas por IP/token público antes de bloqueio temporário',
      },
      {
        chave: 'sigilo_auditoria_leitura_ativa',
        valor: 'true',
        descricao:
          'Habilita auditoria imutável de leitura detalhada para dados bancários, custo-hora e preços',
      },
      {
        chave: 'decisoes_limite_dias_revisao_sla',
        valor: '24',
        descricao: 'Horas máximas para considerar revisão estagnada na fila de decisões (SLA)',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      const existe = app.findRecordsByFilter('parametros', `chave = '${p.chave}'`, '', 1, 0)
      if (existe.length === 0) {
        const rec = new Record(parametrosCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }

    // -------------------------------------------------------------------------
    // 3. Garantir campos de uso único e controle de tentativas nas entidades com token público
    // -------------------------------------------------------------------------
    const colecoesToken = [
      'propostas',
      'contratos_servico',
      'subcontratos',
      'executores',
      'prestadores',
    ]
    for (let c = 0; c < colecoesToken.length; c++) {
      try {
        const col = app.findCollectionByNameOrId(colecoesToken[c])
        let mudou = false
        if (!col.fields.getByName('token_usado')) {
          col.fields.add(new BoolField({ name: 'token_usado' }))
          mudou = true
        }
        if (!col.fields.getByName('data_uso_token')) {
          col.fields.add(new DateField({ name: 'data_uso_token' }))
          mudou = true
        }
        if (!col.fields.getByName('tentativas_token')) {
          col.fields.add(new NumberField({ name: 'tentativas_token', min: 0 }))
          mudou = true
        }
        if (mudou) {
          app.save(col)
        }
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('decisoes_acoes')
      app.delete(col)
    } catch (_) {}
  },
)
