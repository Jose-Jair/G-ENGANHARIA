migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const projetosId = app.findCollectionByNameOrId('projetos').id

    // 1. executores
    const executores = new Collection({
      name: 'executores',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['PF', 'PJ'],
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf_cnpj', type: 'text' },
        {
          name: 'conselho',
          type: 'select',
          values: ['CREA', 'CAU', 'CFT', 'OUTRO'],
          maxSelect: 1,
        },
        { name: 'conselho_validade', type: 'date' },
        { name: 'disciplinas', type: 'text' },
        { name: 'regiao', type: 'text' },
        { name: 'capacidade_simultanea', type: 'number' },
        { name: 'dados_bancarios', type: 'text' },
        { name: 'nda_contrato', type: 'file', maxSelect: 1, maxSize: 10485760 },
        {
          name: 'status',
          type: 'select',
          values: ['homologacao', 'ativo', 'suspenso'],
          maxSelect: 1,
        },
        { name: 'nota_geral', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_executores_cpf_cnpj ON executores (cpf_cnpj)',
        'CREATE INDEX idx_executores_status ON executores (status)',
      ],
    })
    app.save(executores)

    const executoresId = app.findCollectionByNameOrId('executores').id

    // 2. projeto_etapas
    const projetoEtapas = new Collection({
      name: 'projeto_etapas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          required: true,
          collectionId: projetosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'disciplina', type: 'text' },
        {
          name: 'tipo_execucao',
          type: 'select',
          values: ['direta', 'terceirizada', 'mista'],
          maxSelect: 1,
        },
        {
          name: 'executor',
          type: 'relation',
          collectionId: executoresId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date' },
        { name: 'status', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_projeto_etapas_projeto ON projeto_etapas (projeto)'],
    })
    app.save(projetoEtapas)

    const projetoEtapasId = app.findCollectionByNameOrId('projeto_etapas').id

    // 3. entregaveis
    const entregaveis = new Collection({
      name: 'entregaveis',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      fields: [
        {
          name: 'etapa',
          type: 'relation',
          required: true,
          collectionId: projetoEtapasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'versao', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 20971520 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_entregaveis_etapa ON entregaveis (etapa)'],
    })
    app.save(entregaveis)

    // 4. documentos
    const documentos = new Collection({
      name: 'documentos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          collectionId: projetosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'etapa',
          type: 'relation',
          collectionId: projetoEtapasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['ART', 'RRT', 'TRT', 'OS', 'medicao'],
          maxSelect: 1,
        },
        { name: 'numero', type: 'text' },
        { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 20971520 },
        { name: 'vencimento', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_documentos_projeto ON documentos (projeto)'],
    })
    app.save(documentos)

    // 5. riscos
    const riscos = new Collection({
      name: 'riscos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      fields: [
        {
          name: 'projeto',
          type: 'relation',
          required: true,
          collectionId: projetosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'probabilidade',
          type: 'select',
          values: ['baixa', 'media', 'alta'],
          maxSelect: 1,
        },
        {
          name: 'impacto',
          type: 'select',
          values: ['baixo', 'medio', 'alto'],
          maxSelect: 1,
        },
        { name: 'mitigacao', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_riscos_projeto ON riscos (projeto)'],
    })
    app.save(riscos)

    // 6. cotacoes
    const cotacoes = new Collection({
      name: 'cotacoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'etapa',
          type: 'relation',
          required: true,
          collectionId: projetoEtapasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'executor',
          type: 'relation',
          required: true,
          collectionId: executoresId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'escopo', type: 'text' },
        { name: 'prazo_resposta', type: 'date' },
        { name: 'preco_ofertado', type: 'number' },
        { name: 'prazo_ofertado', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'escolhida', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_cotacoes_etapa ON cotacoes (etapa)'],
    })
    app.save(cotacoes)

    // 7. avaliacoes
    const avaliacoes = new Collection({
      name: 'avaliacoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'executor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'executor',
          type: 'relation',
          required: true,
          collectionId: executoresId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'etapa',
          type: 'relation',
          required: true,
          collectionId: projetoEtapasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'pontualidade', type: 'number', min: 0, max: 10 },
        { name: 'qualidade', type: 'number', min: 0, max: 10 },
        { name: 'desvio_custo', type: 'number', min: 0, max: 10 },
        { name: 'responsividade', type: 'number', min: 0, max: 10 },
        { name: 'comentario', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_avaliacoes_executor ON avaliacoes (executor)'],
    })
    app.save(avaliacoes)

    // 8. contas
    const propostasId = app.findCollectionByNameOrId('propostas').id
    const contas = new Collection({
      name: 'contas',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['receber', 'pagar'],
          maxSelect: 1,
        },
        {
          name: 'projeto',
          type: 'relation',
          collectionId: projetosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'proposta',
          type: 'relation',
          collectionId: propostasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'executor',
          type: 'relation',
          collectionId: executoresId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'vencimento', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'prevista', 'realizada', 'paga', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'nf', type: 'text' },
        { name: 'forma_pagamento', type: 'text' },
        { name: 'bloqueada_por_fechamento', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_tipo ON contas (tipo)',
        'CREATE INDEX idx_contas_status ON contas (status)',
        'CREATE INDEX idx_contas_vencimento ON contas (vencimento)',
      ],
    })
    app.save(contas)
  },
  (app) => {
    ;[
      'contas',
      'avaliacoes',
      'cotacoes',
      'riscos',
      'documentos',
      'entregaveis',
      'projeto_etapas',
      'executores',
    ].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
