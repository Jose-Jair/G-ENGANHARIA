migrate(
  (app) => {
    // 1. Atualizar ou adicionar campos em clientes_pf (adicionar endereco e observacoes se não existirem)
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')
    if (!clientesPf.fields.getByName('endereco')) {
      clientesPf.fields.add(new TextField({ name: 'endereco' }))
    }
    if (!clientesPf.fields.getByName('observacoes')) {
      clientesPf.fields.add(new TextField({ name: 'observacoes' }))
    }
    // Garantir regras de clientes_pf: Admin e Comercial criam/editam; Financeiro e Gestor leem; Executor sem acesso
    clientesPf.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
    clientesPf.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
    clientesPf.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    clientesPf.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    clientesPf.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(clientesPf)

    // 2. Garantir regras de empresas e propostas
    const empresas = app.findCollectionByNameOrId('empresas')
    empresas.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
    empresas.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
    empresas.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    empresas.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
    empresas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(empresas)

    // 3. Cadastrar novos parâmetros caso não existam
    const paramCol = app.findCollectionByNameOrId('parametros')

    // dias_alerta_sem_demanda_parceiro (default 180 dias)
    try {
      const p1 = app.findFirstRecordByData(
        'parametros',
        'chave',
        'dias_alerta_sem_demanda_parceiro',
      )
      p1.set('valor', '180')
      app.save(p1)
    } catch (_) {
      const r = new Record(paramCol)
      r.set('chave', 'dias_alerta_sem_demanda_parceiro')
      r.set('valor', '180')
      r.set(
        'descricao',
        'Número de dias sem novas demandas (propostas/projetos) para disparar alerta de parceiro dormente',
      )
      app.save(r)
    }

    // modo_curva_parceiros (dinamico vs manual)
    try {
      app.findFirstRecordByData('parametros', 'chave', 'modo_curva_parceiros')
    } catch (_) {
      const r = new Record(paramCol)
      r.set('chave', 'modo_curva_parceiros')
      r.set('valor', 'dinamico')
      r.set(
        'descricao',
        'Modo de cálculo da curva ABC de parceiros: dinamico (Pareto ~80/15/5% da receita acumulada) ou manual',
      )
      app.save(r)
    }

    // pesos_score_demanda_parceiro
    try {
      app.findFirstRecordByData('parametros', 'chave', 'pesos_score_demanda_parceiro')
    } catch (_) {
      const r = new Record(paramCol)
      r.set('chave', 'pesos_score_demanda_parceiro')
      r.set(
        'valor',
        JSON.stringify({
          peso_contratos_valor: 35,
          peso_taxa_conversao: 35,
          peso_projetos_ano: 30,
        }),
      )
      r.set(
        'descricao',
        'Pesos em percentual (soma = 100) para o Score de Capacidade de Demanda do Parceiro: contratos ativos, taxa de conversão e projetos por ano',
      )
      app.save(r)
    }

    // percentuais_curva_abc_parceiro
    try {
      app.findFirstRecordByData('parametros', 'chave', 'percentuais_curva_abc_parceiro')
    } catch (_) {
      const r = new Record(paramCol)
      r.set('chave', 'percentuais_curva_abc_parceiro')
      r.set(
        'valor',
        JSON.stringify({
          corte_a_percent: 80,
          corte_b_percent: 95,
        }),
      )
      r.set(
        'descricao',
        'Pontos de corte de Pareto para Curva ABC dinâmica: A até X% acumulado, B até Y% acumulado, C o restante',
      )
      app.save(r)
    }
  },
  (app) => {
    // Reversão limpa
  },
)
