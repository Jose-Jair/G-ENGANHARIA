// Migração 0132 — Cadastro completo do Cliente PF via link seguro (PARTE A — backend)
// 1) Novos campos em clientes_pf: rg, rg_orgao_emissor, rg_uf, estado_civil (select),
//    regime_bens, profissao, nacionalidade, data_nascimento (date) e cadastro_status
//    (select: pre_cadastro, aguardando_cliente, em_revisao, completo).
// 2) Backfill idempotente: cadastro_status = 'completo' para os registros existentes.
// 3) CPF passa a poder ficar vazio em pré-cadastro, mas com índice ÚNICO parcial
//    considerando somente os dígitos (quando não vazio) — bloqueio de duplicado no banco.
// 4) Nova coleção clientes_pf_convites:
//    - NENHUMA leitura/escrita pública (regras vazias = superuser apenas);
//    - staff (admin/comercial) lê;
//    - o campo token guarda SOMENTE o hash SHA-256 do token aleatório (>= 32 chars).

migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. Campos novos em clientes_pf (idempotente: só adiciona se não existir)
    // -------------------------------------------------------------------------
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')

    if (!clientesPf.fields.getByName('rg')) {
      clientesPf.fields.add(new TextField({ name: 'rg' }))
    }
    if (!clientesPf.fields.getByName('rg_orgao_emissor')) {
      clientesPf.fields.add(new TextField({ name: 'rg_orgao_emissor' }))
    }
    if (!clientesPf.fields.getByName('rg_uf')) {
      clientesPf.fields.add(new TextField({ name: 'rg_uf' }))
    }
    if (!clientesPf.fields.getByName('estado_civil')) {
      clientesPf.fields.add(
        new SelectField({
          name: 'estado_civil',
          maxSelect: 1,
          values: [
            'solteiro(a)',
            'casado(a)',
            'união estável',
            'divorciado(a)',
            'separado(a)',
            'viúvo(a)',
          ],
        }),
      )
    }
    if (!clientesPf.fields.getByName('regime_bens')) {
      clientesPf.fields.add(new TextField({ name: 'regime_bens' }))
    }
    if (!clientesPf.fields.getByName('profissao')) {
      clientesPf.fields.add(new TextField({ name: 'profissao' }))
    }
    if (!clientesPf.fields.getByName('nacionalidade')) {
      clientesPf.fields.add(new TextField({ name: 'nacionalidade' }))
    }
    if (!clientesPf.fields.getByName('data_nascimento')) {
      clientesPf.fields.add(new DateField({ name: 'data_nascimento' }))
    }
    if (!clientesPf.fields.getByName('cadastro_status')) {
      clientesPf.fields.add(
        new SelectField({
          name: 'cadastro_status',
          maxSelect: 1,
          values: ['pre_cadastro', 'aguardando_cliente', 'em_revisao', 'completo'],
        }),
      )
    }
    app.save(clientesPf)

    // -------------------------------------------------------------------------
    // 2. Backfill idempotente: registros existentes = 'completo'
    // -------------------------------------------------------------------------
    app
      .db()
      .newQuery(
        "UPDATE clientes_pf SET cadastro_status = 'completo' WHERE cadastro_status IS NULL OR cadastro_status = ''",
      )
      .execute()

    // -------------------------------------------------------------------------
    // 3. Índice ÚNICO parcial no cpf (somente dígitos, quando não vazio)
    // -------------------------------------------------------------------------
    try {
      clientesPf.addIndex(
        'idx_clientes_pf_cpf_unico',
        true,
        "REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', ''), '/', '')",
        "cpf != ''",
      )
      app.save(clientesPf)
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 4. Nova coleção clientes_pf_convites
    // -------------------------------------------------------------------------
    let convitesCol = null
    try {
      convitesCol = app.findCollectionByNameOrId('clientes_pf_convites')
    } catch (_) {}

    if (!convitesCol) {
      const usersCol = app.findCollectionByNameOrId('users')
      const regraLeituraStaff =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"

      convitesCol = new Collection({
        name: 'clientes_pf_convites',
        type: 'base',
        // NENHUMA leitura/escrita pública: escrita vazia = apenas superuser (hooks).
        listRule: regraLeituraStaff,
        viewRule: regraLeituraStaff,
        createRule: '',
        updateRule: '',
        deleteRule: '',
        fields: [
          {
            name: 'cliente_pf',
            type: 'relation',
            collectionId: clientesPf.id,
            maxSelect: 1,
            required: true,
          },
          // Guarda SOMENTE o hash SHA-256 do token aleatório (>= 32 chars)
          { name: 'token', type: 'text', required: true },
          { name: 'expira_em', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            maxSelect: 1,
            required: true,
            values: ['ativo', 'usado', 'expirado', 'cancelado', 'aprovado', 'recusado'],
          },
          {
            name: 'canal',
            type: 'select',
            maxSelect: 1,
            required: true,
            values: ['link', 'whatsapp', 'email'],
          },
          { name: 'criado_por', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
          { name: 'dados_enviados', type: 'json' },
          { name: 'enviado_em', type: 'date' },
          { name: 'ip_envio', type: 'text' },
          { name: 'revisado_por', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
          { name: 'revisado_em', type: 'date' },
          { name: 'motivo_recusa', type: 'text' },
        ],
      })
      app.save(convitesCol)

      try {
        convitesCol.addIndex('idx_convites_token_hash', true, 'token', '')
        convitesCol.addIndex('idx_convites_cliente', false, 'cliente_pf', '')
        convitesCol.addIndex('idx_convites_status', false, 'status', '')
        app.save(convitesCol)
      } catch (_) {}
    }
  },
  (app) => {
    // Down: reverter de forma segura
    try {
      const convitesCol = app.findCollectionByNameOrId('clientes_pf_convites')
      app.delete(convitesCol)
    } catch (_) {}

    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      try {
        clientesPf.removeIndex('idx_clientes_pf_cpf_unico')
        app.save(clientesPf)
      } catch (_) {}
      const nomes = [
        'rg',
        'rg_orgao_emissor',
        'rg_uf',
        'estado_civil',
        'regime_bens',
        'profissao',
        'nacionalidade',
        'data_nascimento',
        'cadastro_status',
      ]
      for (let i = 0; i < nomes.length; i++) {
        try {
          const campo = clientesPf.fields.getByName(nomes[i])
          if (campo) clientesPf.fields.removeByName(nomes[i])
        } catch (_) {}
      }
      app.save(clientesPf)
    } catch (_) {}
  },
)
