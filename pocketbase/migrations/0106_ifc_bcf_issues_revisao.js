migrate(
  (app) => {
    // =========================================================================
    // RODADA 17 — IFC / BCF (Parte 1: backend)
    // 1) Adicionar a entregaveis_versoes os campos:
    //    - resumo_ifc_json (json)
    //    - hash_sha256 (text)
    //    - tamanho (number)
    // =========================================================================
    const versoesCol = app.findCollectionByNameOrId('entregaveis_versoes')

    if (!versoesCol.fields.getByName('resumo_ifc_json')) {
      versoesCol.fields.add(new JSONField({ name: 'resumo_ifc_json' }))
    }
    if (!versoesCol.fields.getByName('hash_sha256')) {
      versoesCol.fields.add(new TextField({ name: 'hash_sha256' }))
    }
    if (!versoesCol.fields.getByName('tamanho')) {
      versoesCol.fields.add(new NumberField({ name: 'tamanho', onlyInt: true }))
    }
    app.save(versoesCol)

    // =========================================================================
    // 2) Criar coleção issues_revisao
    // Campos:
    // - entregavel (relation -> entregaveis)
    // - versao (relation -> entregaveis_versoes)
    // - origem (select: bcf | manual | pre_revisao_ia)
    // - guid_bcf (text)
    // - titulo (text, required)
    // - descricao (text)
    // - elementos (json) -- lista de GlobalIds IFC
    // - pavimento (text)
    // - severidade (select: baixa | media | alta | critica)
    // - status (select: aberta | atribuida | corrigida | verificada | rejeitada)
    // - atribuida_a (relation -> users)
    // - prazo (date)
    // - viewpoint (file) -- imagem/snapshot de câmera
    // - versao_corrigida (relation -> entregaveis_versoes)
    //
    // API rules:
    // O prestador lê e atualiza SÓ issues das próprias OS e nunca campos de cliente/obra
    // segmentação por API rules:
    // list/view: Admin, Gestor, Financeiro, Comercial OU executor se entregavel.prestador.email = @request.auth.email
    // create: Admin, Gestor OU executor se entregavel.prestador.email = @request.auth.email
    // update: Admin, Gestor OU executor se entregavel.prestador.email = @request.auth.email
    // delete: Admin
    // =========================================================================
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    let issuesCol
    try {
      issuesCol = app.findCollectionByNameOrId('issues_revisao')
    } catch (_) {
      issuesCol = new Collection({
        name: 'issues_revisao',
        type: 'base',
        fields: [
          {
            name: 'entregavel',
            type: 'relation',
            collectionId: entregaveisCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'versao',
            type: 'relation',
            collectionId: versoesCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'origem',
            type: 'select',
            values: ['bcf', 'manual', 'pre_revisao_ia'],
            maxSelect: 1,
            required: true,
          },
          { name: 'guid_bcf', type: 'text' },
          { name: 'titulo', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'elementos', type: 'json' }, // GlobalIds
          { name: 'pavimento', type: 'text' },
          {
            name: 'severidade',
            type: 'select',
            values: ['baixa', 'media', 'alta', 'critica'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['aberta', 'atribuida', 'corrigida', 'verificada', 'rejeitada'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'atribuida_a',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'prazo', type: 'date' },
          {
            name: 'viewpoint',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB para imagem viewpoint BCF
            mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
            protected: true,
          },
          {
            name: 'versao_corrigida',
            type: 'relation',
            collectionId: versoesCol.id,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_issues_entregavel ON issues_revisao (entregavel)',
          'CREATE INDEX idx_issues_versao ON issues_revisao (versao)',
          'CREATE INDEX idx_issues_guid_bcf ON issues_revisao (guid_bcf)',
          'CREATE INDEX idx_issues_status ON issues_revisao (status)',
          'CREATE INDEX idx_issues_severidade ON issues_revisao (severidade)',
          'CREATE INDEX idx_issues_origem ON issues_revisao (origem)',
        ],
      })
      app.save(issuesCol)

      issuesCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      issuesCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      issuesCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      issuesCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      issuesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(issuesCol)
    }

    // =========================================================================
    // 3) Parâmetro de tamanho máximo de IFC na Administração (padrão 150 MB)
    // =========================================================================
    const paramCol = app.findCollectionByNameOrId('parametros')
    try {
      app.findFirstRecordByData('parametros', 'chave', 'tamanho_maximo_ifc_mb')
    } catch (_) {
      const pRec = new Record(paramCol)
      pRec.set('chave', 'tamanho_maximo_ifc_mb')
      pRec.set('valor', '150')
      pRec.set(
        'descricao',
        'Tamanho máximo de arquivo IFC em megabytes (MB) para upload/análise no sistema',
      )
      pRec.set('categoria', 'ifc_bcf')
      app.save(pRec)
    }
  },
  (app) => {
    try {
      const issuesCol = app.findCollectionByNameOrId('issues_revisao')
      if (issuesCol) app.delete(issuesCol)
    } catch (_) {}
  },
)
