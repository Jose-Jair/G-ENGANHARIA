migrate(
  (app) => {
    // =========================================================================
    // 1. CAMPOS NOVOS NA COLEÇÃO cotacoes
    // - pacote: relation -> projeto_etapas (vinculo com o pacote de trabalho)
    // - prestador: relation -> prestadores (prestador convidado/respondente)
    // - automatica: bool (indica se é cotação automática de pacote EXTERNO)
    // - lembrete_enviado: bool (controle de disparo de lembrete pelo cron)
    // - data_limite_resposta: date (data/hora limite de resposta calculada com base no parâmetro)
    // - motivo_encerramento: text (caso encerrada por falta de resposta ou expiração)
    // =========================================================================
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')
    const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')

    if (!cotacoesCol.fields.getByName('pacote')) {
      cotacoesCol.fields.add(
        new RelationField({
          name: 'pacote',
          collectionId: etapasCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!cotacoesCol.fields.getByName('prestador')) {
      cotacoesCol.fields.add(
        new RelationField({
          name: 'prestador',
          collectionId: prestadoresCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!cotacoesCol.fields.getByName('automatica')) {
      cotacoesCol.fields.add(new BoolField({ name: 'automatica' }))
    }

    if (!cotacoesCol.fields.getByName('lembrete_enviado')) {
      cotacoesCol.fields.add(new BoolField({ name: 'lembrete_enviado' }))
    }

    if (!cotacoesCol.fields.getByName('data_limite_resposta')) {
      cotacoesCol.fields.add(new DateField({ name: 'data_limite_resposta' }))
    }

    if (!cotacoesCol.fields.getByName('motivo_encerramento')) {
      cotacoesCol.fields.add(new TextField({ name: 'motivo_encerramento' }))
    }

    // Regras de RLS de cotacoes:
    // O prestador autenticado (role = 'executor') pode listar e visualizar SOMENTE suas próprias cotações
    // (prestador.email = @request.auth.email), enquanto Admin/Gestor/Comercial/Financeiro acessam normalmente.
    // O prestador autenticado pode atualizar apenas suas próprias cotações para responder preço/prazo/observações.
    // Regra de segurança existente do token público (@request.query.token) mantida intacta.
    cotacoesCol.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    cotacoesCol.updateRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    app.save(cotacoesCol)

    // Adicionar índices úteis
    try {
      cotacoesCol.addIndex('idx_cotacoes_pacote', false, 'pacote', '')
      cotacoesCol.addIndex('idx_cotacoes_prestador', false, 'prestador', '')
      cotacoesCol.addIndex('idx_cotacoes_automatica', false, 'automatica', '')
      cotacoesCol.addIndex('idx_cotacoes_dt_limite', false, 'data_limite_resposta', '')
      app.save(cotacoesCol)
    } catch (_) {}

    // =========================================================================
    // 2. PARÂMETROS NOVOS NA ADMINISTRAÇÃO:
    // - prazo_resposta_cotacao_dias (default: "3")
    // - antecedencia_lembrete_cotacao_dias (default: "1")
    // - max_convidados_cotacao (default: "5")
    // Backfill não destrutivo, preservando chaves já existentes.
    // =========================================================================
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParams = [
      {
        chave: 'prazo_resposta_cotacao_dias',
        valor: '3',
        descricao:
          'Prazo padrão (em dias corridos) para os prestadores responderem à cotação automática de pacote externo.',
      },
      {
        chave: 'antecedencia_lembrete_cotacao_dias',
        valor: '1',
        descricao:
          'Antecedência (em dias) para envio do lembrete automático de resposta de cotação pendente.',
      },
      {
        chave: 'max_convidados_cotacao',
        valor: '5',
        descricao:
          'Número máximo de prestadores elegíveis convidados simultaneamente em cada cotação automática.',
      },
    ]

    for (let i = 0; i < novosParams.length; i++) {
      const p = novosParams[i]
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
    // Reversão segura
  },
)
