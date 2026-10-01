migrate(
  (app) => {
    // 1. Atualizar coleção 'campanhas':
    // Adicionar campos necessários se não existirem (assunto, corpo, observacao_devolucao, aprovado_por, aprovado_em)
    // e expandir status se necessário ('rascunho', 'devolvida', 'aprovada', 'agendada', 'enviada')
    const campanhasCol = app.findCollectionByNameOrId('campanhas')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresasId = empresasCol.id
    const campanhasId = campanhasCol.id

    // Atualizar campo status para incluir 'devolvida'
    const statusField = campanhasCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['rascunho', 'devolvida', 'aprovada', 'agendada', 'enviada']
      statusField.maxSelect = 1
    }

    if (!campanhasCol.fields.getByName('assunto')) {
      campanhasCol.fields.add(
        new TextField({
          name: 'assunto',
          required: false,
        }),
      )
    }

    if (!campanhasCol.fields.getByName('corpo')) {
      campanhasCol.fields.add(
        new TextField({
          name: 'corpo',
          required: false,
        }),
      )
    }

    if (!campanhasCol.fields.getByName('observacao_devolucao')) {
      campanhasCol.fields.add(
        new TextField({
          name: 'observacao_devolucao',
          required: false,
        }),
      )
    }

    if (!campanhasCol.fields.getByName('aprovado_por')) {
      campanhasCol.fields.add(
        new RelationField({
          name: 'aprovado_por',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!campanhasCol.fields.getByName('aprovado_em')) {
      campanhasCol.fields.add(
        new DateField({
          name: 'aprovado_em',
          required: false,
        }),
      )
    }

    app.save(campanhasCol)

    // 2. Criar coleção 'campanha_envios' (um registro por destinatário/empresa por campanha)
    let enviosCol
    try {
      enviosCol = app.findCollectionByNameOrId('campanha_envios')
    } catch (_) {
      enviosCol = new Collection({
        name: 'campanha_envios',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'campanha',
            type: 'relation',
            collectionId: campanhasId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'empresa',
            type: 'relation',
            collectionId: empresasId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'destinatario_email', type: 'text', required: true },
          { name: 'destinatario_nome', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'enviado', 'falha', 'bloqueado_nao_contatar'],
            maxSelect: 1,
          },
          { name: 'token_rastreamento', type: 'text', required: true },
          { name: 'enviado_em', type: 'date' },
          { name: 'aberto_em', type: 'date' },
          { name: 'total_aberturas', type: 'number' },
          { name: 'cliques', type: 'number' },
          { name: 'ultimo_clique_em', type: 'date' },
          { name: 'resposta_em', type: 'date' },
          { name: 'resposta_observacao', type: 'text' },
          { name: 'descadastro_em', type: 'date' },
          { name: 'erro_mensagem', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_campanha_envios_campanha ON campanha_envios (campanha)',
          'CREATE INDEX idx_campanha_envios_empresa ON campanha_envios (empresa)',
          'CREATE UNIQUE INDEX idx_campanha_envios_token ON campanha_envios (token_rastreamento)',
        ],
      })
      app.save(enviosCol)
    }

    // 3. Parâmetros de nutrição mensal
    const parametrosCol = app.findCollectionByNameOrId('parametros')
    const paramsNutricao = [
      {
        chave: 'nutricao_carencia_dias',
        valor: '15',
        descricao:
          'Carência em dias após a data prevista do Toque 5 sem resposta para sugerir envio para Nutrição Mensal',
      },
      {
        chave: 'nutricao_dia_envio',
        valor: '5',
        descricao:
          'Dia do mês sugerido para disparo de campanhas de nutrição mensal (ex: dia 5 de cada mês)',
      },
    ]

    for (let p = 0; p < paramsNutricao.length; p++) {
      const item = paramsNutricao[p]
      try {
        const exist = app.findFirstRecordByData('parametros', 'chave', item.chave)
        exist.set('valor', item.valor)
        exist.set('descricao', item.descricao)
        app.save(exist)
      } catch (_) {
        const rec = new Record(parametrosCol)
        rec.set('chave', item.chave)
        rec.set('valor', item.valor)
        rec.set('descricao', item.descricao)
        app.save(rec)
      }
    }

    // 4. Modelo padrão de Campanha de Nutrição Mensal
    const modelosCol = app.findCollectionByNameOrId('modelos')
    try {
      app.findFirstRecordByData('modelos', 'nome', 'Campanha de Nutrição Mensal — Padrão')
    } catch (_) {
      const modRec = new Record(modelosCol)
      modRec.set('nome', 'Campanha de Nutrição Mensal — Padrão')
      modRec.set('tipo', 'campanha')
      modRec.set(
        'assunto',
        'Informativo Técnico & Atualizações de Engenharia — Oportunidades em {orgao}',
      )
      modRec.set(
        'corpo',
        'Prezado(a) {nome},\n\n' +
          'Esperamos que sua equipe esteja avançando com sucesso na gestão e execução dos contratos vigentes, especialmente junto a {orgao} (contrato referencial: R$ {valor_contrato}).\n\n' +
          'Neste mês, nossa divisão de engenharia preparou um boletim com as principais atualizações sobre compliance técnico em obras públicas, normas ABNT recentemente revisadas e boas práticas de aditivação e fiscalização contratual.\n\n' +
          'Disponibilizamos suporte contínuo de equipes homologadas para laudos, vistorias e projetos complementares sob demanda.\n\n' +
          'Caso deseje agendar uma sessão técnica para mapear demandas do próximo trimestre, basta responder a este e-mail ou acionar nosso canal comercial.\n\n' +
          'Atenciosamente,\n' +
          'Equipe de Engenharia e Parcerias Públicas\n\n' +
          '---\n' +
          'Para não receber mais este informativo mensal, clique no link de descadastro:\n' +
          '{link_descadastro}',
      )
      app.save(modRec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('campanha_envios')
      app.delete(col)
    } catch (_) {}
  },
)
