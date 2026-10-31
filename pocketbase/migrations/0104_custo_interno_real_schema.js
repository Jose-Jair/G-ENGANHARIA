migrate(
  (app) => {
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')
    const ordensServicoCol = app.findCollectionByNameOrId('ordens_servico')
    const contasCol = app.findCollectionByNameOrId('contas')

    // 1. Campos em prestadores: custo_mensal, horas_mes, custo_hora
    // Valores vazios/nulos até o Admin preencher — sem valores fictícios, sem backfill
    if (!prestadoresCol.fields.getByName('custo_mensal')) {
      prestadoresCol.fields.add(
        new NumberField({
          name: 'custo_mensal',
          min: 0,
        }),
      )
    }
    if (!prestadoresCol.fields.getByName('horas_mes')) {
      prestadoresCol.fields.add(
        new NumberField({
          name: 'horas_mes',
          min: 0,
        }),
      )
    }
    if (!prestadoresCol.fields.getByName('custo_hora')) {
      prestadoresCol.fields.add(
        new NumberField({
          name: 'custo_hora',
          min: 0,
        }),
      )
    }
    app.save(prestadoresCol)

    // 2. Nova coleção: custos_profissional (Histórico de vigências)
    // Vigências com data de início/fim — nunca reescrever custo passado
    // API Rules: Superusuários, Admin e Financeiro apenas. Prestador NUNCA lê.
    if (!app.hasTable('custos_profissional')) {
      const custosProfCol = new Collection({
        name: 'custos_profissional',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          {
            name: 'prestador',
            type: 'relation',
            required: true,
            collectionId: prestadoresCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_inicio', type: 'date', required: true },
          { name: 'data_fim', type: 'date' },
          { name: 'custo_mensal', type: 'number', required: false, min: 0 },
          { name: 'horas_mes', type: 'number', required: false, min: 0 },
          { name: 'custo_hora', type: 'number', required: false, min: 0 },
          { name: 'observacoes', type: 'text' },
          {
            name: 'criado_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cp_prestador ON custos_profissional (prestador)',
          'CREATE INDEX idx_cp_data_inicio ON custos_profissional (data_inicio)',
        ],
      })
      app.save(custosProfCol)
    }

    // 3. Campos em ordens_servico:
    // exige_apontamento, horas_estimadas, lead_time_dias_corridos, lead_time_dias_uteis, ciclos_revisao, custo_interno_apurado, status_custo_interno
    if (!ordensServicoCol.fields.getByName('exige_apontamento')) {
      ordensServicoCol.fields.add(
        new BoolField({
          name: 'exige_apontamento',
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('horas_estimadas')) {
      ordensServicoCol.fields.add(
        new NumberField({
          name: 'horas_estimadas',
          min: 0,
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('lead_time_dias_corridos')) {
      ordensServicoCol.fields.add(
        new NumberField({
          name: 'lead_time_dias_corridos',
          min: 0,
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('lead_time_dias_uteis')) {
      ordensServicoCol.fields.add(
        new NumberField({
          name: 'lead_time_dias_uteis',
          min: 0,
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('ciclos_revisao')) {
      ordensServicoCol.fields.add(
        new NumberField({
          name: 'ciclos_revisao',
          min: 0,
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('custo_interno_apurado')) {
      ordensServicoCol.fields.add(
        new NumberField({
          name: 'custo_interno_apurado',
          min: 0,
        }),
      )
    }
    if (!ordensServicoCol.fields.getByName('status_custo_interno')) {
      ordensServicoCol.fields.add(
        new SelectField({
          name: 'status_custo_interno',
          values: ['configurado', 'nao_configurado'],
          maxSelect: 1,
        }),
      )
    }
    app.save(ordensServicoCol)

    // 4. Nova coleção: apontamentos
    // OS, prestador, data, horas em passos de 0,25, atividade produção/revisão/correção/reunião, origem manual/automatico, aprovado_por
    if (!app.hasTable('apontamentos')) {
      const apontamentosCol = new Collection({
        name: 'apontamentos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email && status = 'pendente'))",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email && status = 'pendente'))",
        fields: [
          {
            name: 'os',
            type: 'relation',
            required: true,
            collectionId: ordensServicoCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'prestador',
            type: 'relation',
            required: true,
            collectionId: prestadoresCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data', type: 'date', required: true },
          { name: 'horas', type: 'number', required: true, min: 0.25 },
          {
            name: 'atividade',
            type: 'select',
            required: true,
            values: ['producao', 'revisao', 'correcao', 'reuniao'],
            maxSelect: 1,
          },
          {
            name: 'origem',
            type: 'select',
            required: true,
            values: ['manual', 'automatico'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aprovado', 'rejeitado'],
            maxSelect: 1,
          },
          {
            name: 'aprovado_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_aprovacao', type: 'date' },
          { name: 'descricao', type: 'text' },
          { name: 'motivo_rejeicao', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_apt_os ON apontamentos (os)',
          'CREATE INDEX idx_apt_prestador ON apontamentos (prestador)',
          'CREATE INDEX idx_apt_data ON apontamentos (data)',
          'CREATE INDEX idx_apt_status ON apontamentos (status)',
        ],
      })
      app.save(apontamentosCol)
    }

    // 5. Atualizar select tipo em contas para incluir 'custo_interno'
    const tipoField = contasCol.fields.getByName('tipo')
    if (tipoField && !tipoField.values.includes('custo_interno')) {
      tipoField.values = [...tipoField.values, 'custo_interno']
      tipoField.maxSelect = 1
      app.save(contasCol)
    }

    // 6. Parâmetros na Administração (retroativo máximo 7 dias, passo de 0,25h, horas/dia padrão 8h)
    const paramCol = app.findCollectionByNameOrId('parametros')
    const paramsIniciais = [
      {
        chave: 'apontamento_retroativo_max_dias',
        valor: '7',
        descricao:
          'Limite máximo de dias retroativos permitidos para inserção ou edição de apontamentos de horas',
      },
      {
        chave: 'apontamento_passo_horas',
        valor: '0.25',
        descricao:
          'Fração mínima permitida para lançamento de horas no apontamento (ex: 0.25 = 15 minutos)',
      },
      {
        chave: 'apontamento_horas_dia_padrao',
        valor: '8',
        descricao:
          'Carga horária padrão diária contratada para prestadores internos (teto diário de apontamento)',
      },
    ]

    for (let i = 0; i < paramsIniciais.length; i++) {
      const p = paramsIniciais[i]
      try {
        const existente = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (!existente) {
          const rec = new Record(paramCol)
          rec.set('chave', p.chave)
          rec.set('valor', p.valor)
          rec.set('descricao', p.descricao)
          app.save(rec)
        }
      } catch (_) {
        const rec = new Record(paramCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    // Reversão
    try {
      const colApt = app.findCollectionByNameOrId('apontamentos')
      app.delete(colApt)
    } catch (_) {}
    try {
      const colCustos = app.findCollectionByNameOrId('custos_profissional')
      app.delete(colCustos)
    } catch (_) {}
  },
)
