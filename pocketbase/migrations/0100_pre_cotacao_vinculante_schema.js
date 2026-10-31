migrate(
  (app) => {
    // =========================================================================
    // GESTÃO G+ — RODADA 13: PRÉ-COTAÇÃO VINCULANTE NA PROPOSTA
    // =========================================================================

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const propostaItensCol = app.findCollectionByNameOrId('proposta_itens')
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')
    const paramCol = app.findCollectionByNameOrId('parametros')

    // -------------------------------------------------------------------------
    // 1. CAMPOS ADITIVOS EM proposta_itens
    // -------------------------------------------------------------------------
    if (!propostaItensCol.fields.getByName('origem_custo')) {
      propostaItensCol.fields.add(
        new SelectField({
          name: 'origem_custo',
          values: ['catalogo', 'pre_cotacao', 'manual_auditado', 'sem_cotacao'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!propostaItensCol.fields.getByName('motivo_edicao_custo')) {
      propostaItensCol.fields.add(
        new TextField({
          name: 'motivo_edicao_custo',
          required: false,
        }),
      )
    }

    if (!propostaItensCol.fields.getByName('pre_cotacao_vencedora')) {
      propostaItensCol.fields.add(
        new RelationField({
          name: 'pre_cotacao_vencedora',
          collectionId: prestadoresCol.id, // será atualizado ou mantido conforme resposta
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!propostaItensCol.fields.getByName('preco_travado')) {
      propostaItensCol.fields.add(
        new NumberField({
          name: 'preco_travado',
          required: false,
        }),
      )
    }

    if (!propostaItensCol.fields.getByName('prazo_travado_dias')) {
      propostaItensCol.fields.add(
        new NumberField({
          name: 'prazo_travado_dias',
          required: false,
        }),
      )
    }

    if (!propostaItensCol.fields.getByName('prestador_vencedor')) {
      propostaItensCol.fields.add(
        new RelationField({
          name: 'prestador_vencedor',
          collectionId: prestadoresCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(propostaItensCol)

    // -------------------------------------------------------------------------
    // 2. COLEÇÃO NOVA: pre_cotacoes
    // Código provisório PRE-AAAA-NNNN, proposta, item_proposta, disciplina,
    // escopo_anonimizado, entregaveis_texto, prazo_desejado_dias, validade_dias,
    // data_limite, status (aberta | respondida | encerrada | convertida | expirada),
    // resposta_escolhida_id, motivo_encerramento, criado_por
    // -------------------------------------------------------------------------
    let preCotCol
    try {
      preCotCol = app.findCollectionByNameOrId('pre_cotacoes')
    } catch (_) {
      preCotCol = new Collection({
        name: 'pre_cotacoes',
        type: 'base',
        fields: [
          { name: 'codigo', type: 'text', required: true },
          {
            name: 'proposta',
            type: 'relation',
            collectionId: propostasCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'item_proposta',
            type: 'relation',
            collectionId: propostaItensCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'disciplina', type: 'text', required: true },
          { name: 'escopo_anonimizado', type: 'text', required: true },
          { name: 'entregaveis_texto', type: 'text' },
          { name: 'prazo_desejado_dias', type: 'number' },
          { name: 'validade_dias', type: 'number' },
          { name: 'data_limite', type: 'date' },
          {
            name: 'status',
            type: 'select',
            values: ['aberta', 'respondida', 'encerrada', 'convertida', 'expirada'],
            maxSelect: 1,
            required: true,
          },
          { name: 'resposta_escolhida_id', type: 'text' },
          { name: 'motivo_encerramento', type: 'text' },
          {
            name: 'criado_por',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_precot_codigo ON pre_cotacoes (codigo)',
          'CREATE INDEX idx_precot_proposta ON pre_cotacoes (proposta)',
          'CREATE INDEX idx_precot_item ON pre_cotacoes (item_proposta)',
          'CREATE INDEX idx_precot_status ON pre_cotacoes (status)',
          'CREATE INDEX idx_precot_disciplina ON pre_cotacoes (disciplina)',
        ],
      })
      app.save(preCotCol)

      // Regras RLS estritas:
      // List e View: Admin/Gestor/Comercial podem ver todas.
      // O prestador externo NUNCA lê diretamente pre_cotacoes com relação à proposta;
      // lê suas oportunidades pela pre_cotacao_respostas (onde prestador.email = @request.auth.email)
      preCotCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      preCotCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      preCotCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
      preCotCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
      preCotCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(preCotCol)
    }

    // -------------------------------------------------------------------------
    // 3. COLEÇÃO NOVA: pre_cotacao_respostas
    // Respostas dos prestadores convidados com aceite vinculante, hash, IP, timestamp
    // Status: enviada | travada | liberada | expirada
    // -------------------------------------------------------------------------
    let respCol
    try {
      respCol = app.findCollectionByNameOrId('pre_cotacao_respostas')
    } catch (_) {
      respCol = new Collection({
        name: 'pre_cotacao_respostas',
        type: 'base',
        fields: [
          {
            name: 'pre_cotacao',
            type: 'relation',
            collectionId: preCotCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'codigo_pre_cotacao', type: 'text', required: true },
          { name: 'disciplina', type: 'text', required: true },
          { name: 'escopo_resumo', type: 'text' },
          { name: 'entregaveis_resumo', type: 'text' },
          { name: 'prazo_desejado_dias', type: 'number' },
          { name: 'data_limite_resposta', type: 'date' },
          { name: 'preco_ofertado', type: 'number' },
          { name: 'prazo_ofertado_dias', type: 'number' },
          { name: 'premissas', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'aceite_vinculante', type: 'bool' },
          { name: 'aceite_hash', type: 'text' },
          { name: 'aceite_ip', type: 'text' },
          { name: 'aceite_user_agent', type: 'text' },
          { name: 'aceite_timestamp', type: 'date' },
          {
            name: 'status',
            type: 'select',
            values: ['convite_enviado', 'enviada', 'travada', 'liberada', 'expirada'],
            maxSelect: 1,
            required: true,
          },
          { name: 'escolhida', type: 'bool' },
          { name: 'lembrete_enviado', type: 'bool' },
          { name: 'aviso_liberacao', type: 'text' },
          { name: 'data_resposta', type: 'date' },
          { name: 'data_liberacao', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pcresp_precot ON pre_cotacao_respostas (pre_cotacao)',
          'CREATE INDEX idx_pcresp_prestador ON pre_cotacao_respostas (prestador)',
          'CREATE INDEX idx_pcresp_status ON pre_cotacao_respostas (status)',
          'CREATE INDEX idx_pcresp_codigo ON pre_cotacao_respostas (codigo_pre_cotacao)',
        ],
      })
      app.save(respCol)

      // Regras RLS estritas de isolamento:
      // - Admin e Gestor vêem todas as respostas
      // - Prestador autenticado (@request.auth.role = 'executor') SÓ VÊ a resposta atribuída a ele próprio
      // - NUNCA expõe cliente, obra, órgão, proposta nem concorrentes!
      respCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      respCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      respCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
      respCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      respCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(respCol)
    }

    // -------------------------------------------------------------------------
    // 4. PARÂMETROS NA ADMINISTRAÇÃO (NUNCA NO CÓDIGO)
    // -------------------------------------------------------------------------
    const parametrosNovos = [
      {
        chave: 'pre_cotacao_validade_dias',
        valor: '30',
        descricao:
          'Validade padrão em dias da pré-cotação vinculante gerada na proposta comercial.',
      },
      {
        chave: 'pre_cotacao_max_convidados',
        valor: '5',
        descricao:
          'Número máximo de prestadores convidados automaticamente por disciplina na pré-cotação.',
      },
      {
        chave: 'pre_cotacao_antecedencia_lembrete_dias',
        valor: '2',
        descricao:
          'Antecedência em dias para envio de lembrete automático aos prestadores com pré-cotação pendente.',
      },
      {
        chave: 'pre_cotacao_tolerancia_preco_percentual',
        valor: '10',
        descricao:
          'Percentual de tolerância admitido sobre o preço de referência da tabela antes de sinalizar desvio.',
      },
    ]

    for (let i = 0; i < parametrosNovos.length; i++) {
      const p = parametrosNovos[i]
      try {
        const exist = app.findRecordsByFilter('parametros', "chave = '" + p.chave + "'", '', 1, 0)
        if (exist.length === 0) {
          const rec = new Record(paramCol)
          rec.set('chave', p.chave)
          rec.set('valor', p.valor)
          rec.set('descricao', p.descricao)
          app.save(rec)
        }
      } catch (eParam) {
        console.log('Aviso ao registrar parâmetro ' + p.chave + ': ' + eParam)
      }
    }
  },
  (app) => {
    // Reversão segura
  },
)
