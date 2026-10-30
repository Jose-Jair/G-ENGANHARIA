migrate(
  (app) => {
    // =========================================================================
    // 1. ATUALIZAR COLEÇÃO: prestadores
    // Novos campos aditivos e idempotentes:
    // origem_cadastro, status (novo valor "triagem"), portfolio_json, softwares,
    // preco_referencia_json, disponibilidade_json, aceite_termos_em, aceite_ip,
    // aceite_hash, nota_triagem, parecer_triagem, triado_por
    // =========================================================================
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Atualizar status para incluir 'triagem'
    const statusField = prestadoresCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['triagem', 'ativo', 'pendente', 'suspenso', 'inativo']
    }

    // origem_cadastro
    if (!prestadoresCol.fields.getByName('origem_cadastro')) {
      prestadoresCol.fields.add(
        new SelectField({
          name: 'origem_cadastro',
          values: ['publico', 'convite', 'interno'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // portfolio_json
    if (!prestadoresCol.fields.getByName('portfolio_json')) {
      prestadoresCol.fields.add(
        new JSONField({
          name: 'portfolio_json',
          required: false,
        }),
      )
    }

    // softwares
    if (!prestadoresCol.fields.getByName('softwares')) {
      prestadoresCol.fields.add(
        new TextField({
          name: 'softwares',
          required: false,
        }),
      )
    }

    // preco_referencia_json (por disciplina: unidade, valor_min, valor_max)
    if (!prestadoresCol.fields.getByName('preco_referencia_json')) {
      prestadoresCol.fields.add(
        new JSONField({
          name: 'preco_referencia_json',
          required: false,
        }),
      )
    }

    // disponibilidade_json (horas_semana, inicio_disponivel, bloqueios)
    if (!prestadoresCol.fields.getByName('disponibilidade_json')) {
      prestadoresCol.fields.add(
        new JSONField({
          name: 'disponibilidade_json',
          required: false,
        }),
      )
    }

    // aceite_termos_em
    if (!prestadoresCol.fields.getByName('aceite_termos_em')) {
      prestadoresCol.fields.add(
        new DateField({
          name: 'aceite_termos_em',
          required: false,
        }),
      )
    }

    // aceite_ip
    if (!prestadoresCol.fields.getByName('aceite_ip')) {
      prestadoresCol.fields.add(
        new TextField({
          name: 'aceite_ip',
          required: false,
        }),
      )
    }

    // aceite_hash
    if (!prestadoresCol.fields.getByName('aceite_hash')) {
      prestadoresCol.fields.add(
        new TextField({
          name: 'aceite_hash',
          required: false,
        }),
      )
    }

    // nota_triagem
    if (!prestadoresCol.fields.getByName('nota_triagem')) {
      prestadoresCol.fields.add(
        new NumberField({
          name: 'nota_triagem',
          required: false,
        }),
      )
    }

    // parecer_triagem
    if (!prestadoresCol.fields.getByName('parecer_triagem')) {
      prestadoresCol.fields.add(
        new TextField({
          name: 'parecer_triagem',
          required: false,
        }),
      )
    }

    // triado_por (relation -> users)
    if (!prestadoresCol.fields.getByName('triado_por')) {
      prestadoresCol.fields.add(
        new RelationField({
          name: 'triado_por',
          collectionId: usersCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(prestadoresCol)

    // =========================================================================
    // 2. COLEÇÃO NOVA: links_recrutamento
    // Slug público, disciplina-alvo opcional, ativo (bool), expira_em, contador_acessos.
    // Slug único.
    // =========================================================================
    let linksCol
    try {
      linksCol = app.findCollectionByNameOrId('links_recrutamento')
    } catch (_) {
      linksCol = new Collection({
        name: 'links_recrutamento',
        type: 'base',
        fields: [
          { name: 'slug', type: 'text', required: true },
          { name: 'titulo', type: 'text' },
          { name: 'disciplina_alvo', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'expira_em', type: 'date' },
          { name: 'contador_acessos', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_links_recrutamento_slug ON links_recrutamento (slug)'],
      })
      app.save(linksCol)

      linksCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      linksCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(linksCol)
    }

    // Seed link padrão geral de recrutamento se não existir nenhum
    try {
      const linksExistentes = app.findRecordsByFilter('links_recrutamento', '', '', 1, 0)
      if (linksExistentes.length === 0) {
        const linkPadrao = new Record(linksCol)
        linkPadrao.set('slug', 'geral')
        linkPadrao.set('titulo', 'Banco de Talentos e Especialistas — G+ Engenharia')
        linkPadrao.set('disciplina_alvo', 'Geral')
        linkPadrao.set('ativo', true)
        linkPadrao.set('contador_acessos', 0)
        app.save(linkPadrao)
      }
    } catch (eLinkSeed) {
      console.log('Aviso ao seedar link_recrutamento geral: ' + eLinkSeed)
    }

    // =========================================================================
    // 3. COLEÇÃO NOVA: prestadores_documentos
    // prestador (dono), tipo, arquivo (protected), validade, verificado_por, status_verificacao.
    // API rules: lido SOMENTE pelo dono (prestador) e por Admin/Gestor — jamais por outro prestador!
    // =========================================================================
    let docsCol
    try {
      docsCol = app.findCollectionByNameOrId('prestadores_documentos')
    } catch (_) {
      docsCol = new Collection({
        name: 'prestadores_documentos',
        type: 'base',
        fields: [
          {
            name: 'prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'tipo',
            type: 'select',
            values: [
              'rg_cnh',
              'registro_conselho',
              'certidao_regularidade',
              'comprovante_residencia',
              'contrato_social',
              'certidao_tributaria',
              'curriculo_portfolio',
              'outro',
            ],
            required: true,
          },
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            maxSize: 15728640, // 15MB
            protected: true,
          },
          { name: 'validade', type: 'date' },
          {
            name: 'verificado_por',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          {
            name: 'status_verificacao',
            type: 'select',
            values: ['pendente', 'aprovado', 'rejeitado'],
          },
          { name: 'motivo_rejeicao', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pdocs_prestador ON prestadores_documentos (prestador)',
          'CREATE INDEX idx_pdocs_tipo ON prestadores_documentos (tipo)',
        ],
      })
      app.save(docsCol)

      // API Rules estritas de isolamento:
      // Dono (prestador com seu email logado como executor) ou equipe Admin/Gestor
      docsCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      docsCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      docsCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      docsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      docsCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      app.save(docsCol)
    }

    // =========================================================================
    // 4. PARÂMETROS NA ADMINISTRAÇÃO (NUNCA NO CÓDIGO)
    // - recrutamento_rate_limit_ip_hora: limite de requisições por IP na rota pública
    // - recrutamento_validade_link_dias: validade dos links de recrutamento (se aplicável)
    // - dias_expiracao_link_complemento_prestador: dias para expirar link de complemento
    // =========================================================================
    const paramCol = app.findCollectionByNameOrId('parametros')
    const paramsNovos = [
      {
        chave: 'recrutamento_rate_limit_ip_hora',
        valor: '5',
        descricao:
          'Limite máximo de submissões de pré-cadastro público permitidas por IP a cada hora (anti-abuso e honeypot).',
      },
      {
        chave: 'recrutamento_validade_link_dias',
        valor: '30',
        descricao: 'Prazo padrão em dias para expiração de links de recrutamento criados.',
      },
      {
        chave: 'dias_expiracao_link_complemento_prestador',
        valor: '7',
        descricao:
          'Prazo em dias para expiração do token de link de complemento e retorno do prestador.',
      },
    ]

    for (let p = 0; p < paramsNovos.length; p++) {
      const item = paramsNovos[p]
      try {
        const exist = app.findRecordsByFilter(
          'parametros',
          "chave = '" + item.chave + "'",
          '',
          1,
          0,
        )
        if (exist.length === 0) {
          const rec = new Record(paramCol)
          rec.set('chave', item.chave)
          rec.set('valor', item.valor)
          rec.set('descricao', item.descricao)
          app.save(rec)
        }
      } catch (eParam) {
        console.log('Aviso ao registrar parâmetro ' + item.chave + ': ' + eParam)
      }
    }
  },
  (app) => {
    // Reversão segura
  },
)
