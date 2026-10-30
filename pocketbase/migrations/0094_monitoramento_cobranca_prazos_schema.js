migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const osCol = app.findCollectionByNameOrId('ordens_servico')
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')

    // =========================================================================
    // 1. COLEÇÃO: eventos_cobranca
    // Registra cada degrau de cobrança de prazo (OS ou entregável) com idempotência
    // Índice ÚNICO em chave_idempotencia (formato: {referencia_tipo}_{referencia_id}_{degrau})
    // Degraus: d_menos_3 (lembrete), d_zero (aviso), d_mais_1 (cobranca),
    //          d_mais_3 (escalonamento), revisor_sla (cobranca SLA revisor)
    // Regras de RLS:
    // - list/view: Admin/Gestor/Financeiro leem tudo. Prestador lê somente se
    //   destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email
    // - create: Superuser ou Admin/Gestor
    // - update/delete: null (imutabilidade total via API)
    // =========================================================================
    let eventosCol
    try {
      eventosCol = app.findCollectionByNameOrId('eventos_cobranca')
    } catch (_) {
      eventosCol = new Collection({
        name: 'eventos_cobranca',
        type: 'base',
        fields: [
          {
            name: 'referencia_tipo',
            type: 'select',
            values: ['ordens_servico', 'entregaveis'],
            required: true,
          },
          { name: 'referencia_id', type: 'text', required: true },
          {
            name: 'ordem_servico',
            type: 'relation',
            collectionId: osCol.id,
            maxSelect: 1,
          },
          {
            name: 'entregavel',
            type: 'relation',
            collectionId: entregaveisCol.id,
            maxSelect: 1,
          },
          {
            name: 'degrau',
            type: 'select',
            values: ['d_menos_3', 'd_zero', 'd_mais_1', 'd_mais_3', 'revisor_sla'],
            required: true,
          },
          { name: 'dias_configurados', type: 'number' },
          {
            name: 'destinatario_tipo',
            type: 'select',
            values: ['prestador', 'revisor_interno', 'gestor'],
            required: true,
          },
          {
            name: 'destinatario_usuario',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          {
            name: 'destinatario_prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
          },
          { name: 'destinatario_email', type: 'email' },
          { name: 'destinatario_nome', type: 'text' },
          { name: 'destinatario_telefone', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['processado', 'pendente', 'falha'],
            required: true,
          },
          { name: 'email_enviado', type: 'bool' },
          { name: 'notificacao_enviada', type: 'bool' },
          { name: 'whatsapp_url', type: 'text' },
          { name: 'mensagem_texto', type: 'text' },
          { name: 'detalhes_auditoria', type: 'json' },
          { name: 'chave_idempotencia', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_evt_cobranca_idemp ON eventos_cobranca (chave_idempotencia)',
          'CREATE INDEX idx_evt_cobranca_ref ON eventos_cobranca (referencia_tipo, referencia_id)',
          'CREATE INDEX idx_evt_cobranca_os ON eventos_cobranca (ordem_servico)',
          'CREATE INDEX idx_evt_cobranca_ent ON eventos_cobranca (entregavel)',
          'CREATE INDEX idx_evt_cobranca_degrau ON eventos_cobranca (degrau)',
          'CREATE INDEX idx_evt_cobranca_dest_email ON eventos_cobranca (destinatario_email)',
          'CREATE INDEX idx_evt_cobranca_created ON eventos_cobranca (created)',
        ],
      })
      app.save(eventosCol)

      // Regras de RLS:
      // Admin/Gestor/Financeiro leem tudo. Prestador lê somente seus próprios eventos.
      // Modificação via API proibida (imutabilidade).
      eventosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email))"
      eventosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email))"
      eventosCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      eventosCol.updateRule = null
      eventosCol.deleteRule = null
      app.save(eventosCol)
    }

    // =========================================================================
    // 2. COLEÇÃO: resumos_diarios_gestor
    // Registra o consolidado diário gerado pelo cron de monitoramento
    // para exibição imediata ao Gestor na Central de Ações do Dia.
    // =========================================================================
    let resumosCol
    try {
      resumosCol = app.findCollectionByNameOrId('resumos_diarios_gestor')
    } catch (_) {
      resumosCol = new Collection({
        name: 'resumos_diarios_gestor',
        type: 'base',
        fields: [
          { name: 'data_referencia', type: 'text', required: true }, // 'YYYY-MM-DD'
          { name: 'total_os_monitoradas', type: 'number' },
          { name: 'total_os_atrasadas', type: 'number' },
          { name: 'total_entregaveis_atrasados', type: 'number' },
          { name: 'total_revisoes_estagnadas', type: 'number' },
          { name: 'total_escalonamentos', type: 'number' },
          { name: 'itens_atencao_json', type: 'json' },
          { name: 'gerado_em', type: 'date' },
          { name: 'lido_por_gestor', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_resumo_data ON resumos_diarios_gestor (data_referencia)',
          'CREATE INDEX idx_resumo_created ON resumos_diarios_gestor (created)',
        ],
      })
      app.save(resumosCol)

      resumosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      resumosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      resumosCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      resumosCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      resumosCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(resumosCol)
    }

    // =========================================================================
    // 3. PARÂMETROS EDITÁVEIS NA ADMINISTRAÇÃO:
    // - monitoramento_prazo_dias_lembrete (default: "-3") -> D-3
    // - monitoramento_prazo_dias_aviso (default: "0") -> D0
    // - monitoramento_prazo_dias_cobranca (default: "1") -> D+1
    // - monitoramento_prazo_dias_escalonamento (default: "3") -> D+3
    // - monitoramento_revisao_sla_horas (default: "48") -> SLA de revisão interna
    // - monitoramento_cron_horario (default: "08:00") -> Horário diário do resumo/varredura
    // =========================================================================
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'monitoramento_prazo_dias_lembrete',
        valor: '-3',
        descricao:
          'Antecedência em dias para lembrete preventivo ao prestador (D-3, padrão: -3 dias do prazo).',
      },
      {
        chave: 'monitoramento_prazo_dias_aviso',
        valor: '0',
        descricao: 'Aviso formal no dia do vencimento do prazo (D0, padrão: 0 dias do prazo).',
      },
      {
        chave: 'monitoramento_prazo_dias_cobranca',
        valor: '1',
        descricao: 'Primeira cobrança após o vencimento do prazo (D+1, padrão: 1 dia de atraso).',
      },
      {
        chave: 'monitoramento_prazo_dias_escalonamento',
        valor: '3',
        descricao:
          'Escalonamento crítico ao Gestor de Projetos com geração de link WhatsApp (D+3, padrão: 3 dias de atraso).',
      },
      {
        chave: 'monitoramento_revisao_sla_horas',
        valor: '48',
        descricao:
          'SLA máximo em horas para revisão interna técnica de entregável enviado antes de cobrar revisor e avisar Gestor.',
      },
      {
        chave: 'monitoramento_cron_horario',
        valor: '08:00',
        descricao:
          'Horário padrão configurado para geração do Resumo Diário do Gestor na Central de Ações (formato HH:MM Brasília/UTC).',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      const existentes = app.findRecordsByFilter(
        'parametros',
        "chave = '" + p.chave + "'",
        '',
        1,
        0,
      )
      if (existentes.length === 0) {
        const rec = new Record(parametrosCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const r = app.findCollectionByNameOrId('resumos_diarios_gestor')
      app.delete(r)
    } catch (_) {}
    try {
      const e = app.findCollectionByNameOrId('eventos_cobranca')
      app.delete(e)
    } catch (_) {}
  },
)
