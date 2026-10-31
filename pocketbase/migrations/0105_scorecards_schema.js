migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. Coleção parametros_scorecards (Versionada: nunca sobrescrever nem apagar versão anterior)
    // -------------------------------------------------------------------------
    let paramScorecardsCol
    try {
      paramScorecardsCol = app.findCollectionByNameOrId('parametros_scorecards')
    } catch (_) {
      paramScorecardsCol = new Collection({
        name: 'parametros_scorecards',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: null, // Proibido apagar versões de parâmetros
        fields: [
          {
            name: 'tipo_entidade',
            type: 'select',
            required: true,
            values: ['prestador_externo', 'prestador_interno', 'empresa_parceira'],
            maxSelect: 1,
          },
          { name: 'versao', type: 'number', required: true, onlyInt: true },
          { name: 'descricao', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'pesos_json', type: 'json', required: true },
          { name: 'metas_json', type: 'json' },
          { name: 'minimo_sugestao_suspensao', type: 'number' },
          {
            name: 'autor_alteracao',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'criado_em', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_param_score_tipo_versao ON parametros_scorecards (tipo_entidade, versao)',
          'CREATE INDEX idx_param_score_ativo ON parametros_scorecards (tipo_entidade, ativo)',
        ],
      })
      app.save(paramScorecardsCol)
    }

    // -------------------------------------------------------------------------
    // 2. Coleção scorecards (Scorecards e Histórico de Snapshots Mensais)
    // -------------------------------------------------------------------------
    let scorecardsCol
    try {
      scorecardsCol = app.findCollectionByNameOrId('scorecards')
    } catch (_) {
      scorecardsCol = new Collection({
        name: 'scorecards',
        type: 'base',
        // Prestador externo/interno só lê se prestador_email for o seu e somente se for prestador
        listRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || " +
          "(@request.auth.role = 'executor' && prestador_email = @request.auth.email)" +
          ')',
        viewRule:
          "@request.auth.id != '' && (" +
          "@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || " +
          "(@request.auth.role = 'executor' && prestador_email = @request.auth.email)" +
          ')',
        createRule: null, // Apenas hooks / servidor
        updateRule: null, // Apenas hooks / servidor
        deleteRule: null, // Somente superuser
        fields: [
          {
            name: 'tipo_entidade',
            type: 'select',
            required: true,
            values: ['prestador_externo', 'prestador_interno', 'empresa_parceira'],
            maxSelect: 1,
          },
          { name: 'registro_id', type: 'text', required: true },
          { name: 'prestador_email', type: 'text' }, // Permite isolamento seguro no RLS
          { name: 'nome_entidade', type: 'text' },
          { name: 'is_snapshot', type: 'bool' },
          { name: 'mes_referencia', type: 'text' }, // Ex: '2026-03'
          { name: 'data_calculo', type: 'date' },
          { name: 'versao_pesos', type: 'number', onlyInt: true },
          { name: 'dados_insuficientes', type: 'bool' },
          { name: 'motivo_insuficiencia', type: 'text' },
          { name: 'total_trabalhos_janela', type: 'number', onlyInt: true },

          // Composto e Tendência
          { name: 'indice_composto', type: 'number' },
          {
            name: 'tendencia_5_trabalhos',
            type: 'select',
            values: ['melhorou', 'estavel', 'piorou', 'dados_insuficientes'],
            maxSelect: 1,
          },
          { name: 'historico_ultimos_5', type: 'json' },

          // Índices Prestador Externo (0-100)
          { name: 'ext_pontualidade', type: 'number' },
          { name: 'ext_retrabalho', type: 'number' },
          { name: 'ext_qualidade', type: 'number' },
          { name: 'ext_aderencia_preco', type: 'number' },
          { name: 'ext_responsividade', type: 'number' },
          { name: 'ext_conformidade', type: 'number' },

          // Índices Prestador Interno (0-100)
          { name: 'int_lead_time', type: 'number' },
          { name: 'int_ciclos_revisao', type: 'number' },
          { name: 'int_horas_entregavel', type: 'number' },
          { name: 'int_ocupacao', type: 'number' },
          { name: 'int_pontualidade', type: 'number' },

          // Índices Empresa Parceira (0-100)
          { name: 'par_prazo_pagamento', type: 'number' },
          { name: 'par_taxa_aceite', type: 'number' },
          { name: 'par_devolucoes_cliente', type: 'number' },
          { name: 'par_frequencia_demanda', type: 'number' },
          { name: 'par_margem_media', type: 'number' },
          { name: 'par_inversoes_fluxo', type: 'number' },

          // Métricas brutas de apoio (para transparência e auditoria)
          { name: 'metricas_detalhadas', type: 'json' },
          { name: 'sugestao_suspensao', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_scorecards_entidade ON scorecards (tipo_entidade, registro_id, is_snapshot)',
          'CREATE INDEX idx_scorecards_email ON scorecards (prestador_email)',
          'CREATE INDEX idx_scorecards_snapshot ON scorecards (registro_id, mes_referencia)',
        ],
      })
      app.save(scorecardsCol)
    }

    // -------------------------------------------------------------------------
    // 3. SEED DOS PARÂMETROS VERSIONADOS INICIAIS (VERSÃO 1)
    // -------------------------------------------------------------------------
    const parametrosIniciais = [
      {
        tipo_entidade: 'prestador_externo',
        versao: 1,
        descricao: 'Pesos e metas padrão para Prestadores Externos (Rodada 16)',
        ativo: true,
        minimo_sugestao_suspensao: 50,
        pesos_json: {
          pontualidade: 30,
          retrabalho: 25,
          qualidade: 20,
          aderencia_preco: 10,
          responsividade: 10,
          conformidade: 5,
        },
        metas_json: {
          minimo_trabalhos_avaliacao: 1,
          janela_meses: 12,
          tolerancia_atraso_dias: 0,
        },
      },
      {
        tipo_entidade: 'prestador_interno',
        versao: 1,
        descricao: 'Pesos e metas padrão para Prestadores Internos (Rodada 16)',
        ativo: true,
        minimo_sugestao_suspensao: 50,
        pesos_json: {
          lead_time: 25,
          ciclos_revisao: 20,
          horas_entregavel: 20,
          ocupacao: 20,
          pontualidade: 15,
        },
        metas_json: {
          lead_time_dias_padrao: 15,
          lead_time_disciplinas: {
            Estrutural: 20,
            Instalações: 15,
            Arquitetura: 25,
            Elétrica: 15,
            Hidráulica: 15,
            Engenharia: 15,
          },
          ocupacao_meta_percentual: 100,
          janela_meses: 12,
        },
      },
      {
        tipo_entidade: 'empresa_parceira',
        versao: 1,
        descricao: 'Pesos e metas padrão para Empresas Parceiras Demandantes (Rodada 16)',
        ativo: true,
        minimo_sugestao_suspensao: 40,
        pesos_json: {
          prazo_pagamento: 25,
          taxa_aceite: 20,
          devolucoes_cliente: 15,
          frequencia_demanda: 15,
          margem_media: 15,
          inversoes_fluxo: 10,
        },
        metas_json: {
          prazo_pagamento_dias_meta: 30,
          margem_meta_percentual: 25,
          janela_meses: 12,
        },
      },
    ]

    for (let i = 0; i < parametrosIniciais.length; i++) {
      const p = parametrosIniciais[i]
      const existentes = app.findRecordsByFilter(
        'parametros_scorecards',
        "tipo_entidade = '" + p.tipo_entidade + "' && versao = " + p.versao,
        '',
        1,
        0,
      )
      if (existentes.length === 0) {
        const r = new Record(paramScorecardsCol)
        r.set('tipo_entidade', p.tipo_entidade)
        r.set('versao', p.versao)
        r.set('descricao', p.descricao)
        r.set('ativo', p.ativo)
        r.set('minimo_sugestao_suspensao', p.minimo_sugestao_suspensao)
        r.set('pesos_json', p.pesos_json)
        r.set('metas_json', p.metas_json)
        r.set('criado_em', new Date().toISOString())
        app.save(r)
      }
    }

    // -------------------------------------------------------------------------
    // 4. Parâmetros globais em 'parametros' (para central de ações e políticas)
    // -------------------------------------------------------------------------
    const paramCol = app.findCollectionByNameOrId('parametros')
    const configsScorecards = [
      {
        chave: 'scorecard_alerta_queda_composto_pontos',
        valor: '15',
        descricao:
          'Queda em pontos no composto do scorecard em 60 dias para disparar alerta na Central de Ações',
        categoria: 'scorecards',
      },
      {
        chave: 'scorecard_alerta_queda_dias_janela',
        valor: '60',
        descricao: 'Janela de dias para monitoramento de queda brusca de scorecard',
        categoria: 'scorecards',
      },
      {
        chave: 'scorecard_minimo_sugestao_suspensao_padrao',
        valor: '50',
        descricao:
          'Pontuação mínima do índice composto para sugerir suspensão de prestador (Apenas sugestão auditada)',
        categoria: 'scorecards',
      },
    ]

    for (let k = 0; k < configsScorecards.length; k++) {
      const c = configsScorecards[k]
      try {
        app.findFirstRecordByData('parametros', 'chave', c.chave)
      } catch (_) {
        const pr = new Record(paramCol)
        pr.set('chave', c.chave)
        pr.set('valor', c.valor)
        pr.set('descricao', c.descricao)
        pr.set('categoria', c.categoria)
        app.save(pr)
      }
    }
  },
  (app) => {
    try {
      const sCol = app.findCollectionByNameOrId('scorecards')
      if (sCol) app.delete(sCol)
    } catch (_) {}
    try {
      const psCol = app.findCollectionByNameOrId('parametros_scorecards')
      if (psCol) app.delete(psCol)
    } catch (_) {}
  },
)
