migrate(
  (app) => {
    // 1. Adicionar campos auxiliares na coleção 'contas' para idempotência estrita e rastreabilidade:
    // - chave_idempotencia (text)
    // - parcela_origem (relation -> proposta_parcelas)
    // - marco_origem (relation -> projeto_etapas)
    const contas = app.findCollectionByNameOrId('contas')

    if (!contas.fields.getByName('chave_idempotencia')) {
      contas.fields.add(new TextField({ name: 'chave_idempotencia' }))
    }

    try {
      const propostaParcelasCol = app.findCollectionByNameOrId('proposta_parcelas')
      if (!contas.fields.getByName('parcela_origem')) {
        contas.fields.add(
          new RelationField({
            name: 'parcela_origem',
            collectionId: propostaParcelasCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          }),
        )
      }
    } catch (eParc) {
      console.log('Aviso ao adicionar parcela_origem em contas: ' + eParc)
    }

    try {
      const projetoEtapasCol = app.findCollectionByNameOrId('projeto_etapas')
      if (!contas.fields.getByName('marco_origem')) {
        contas.fields.add(
          new RelationField({
            name: 'marco_origem',
            collectionId: projetoEtapasCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          }),
        )
      }
    } catch (eMarco) {
      console.log('Aviso ao adicionar marco_origem em contas: ' + eMarco)
    }

    app.save(contas)

    // Adicionar índice em chave_idempotencia de contas
    try {
      contas.addIndex('idx_contas_chave_idemp', false, 'chave_idempotencia', '')
      app.save(contas)
    } catch (eIdx) {
      console.log('Aviso ao criar índice idx_contas_chave_idemp: ' + eIdx)
    }

    // 2. Parâmetros configuráveis da Rodada 8 na Administração:
    // - funil_probabilidade_por_etapa (JSON com probabilidades por etapa do funil)
    // - financeiro_margem_minima_alerta (número/percentual mínimo, padrão 20)
    // - financeiro_antecedencia_alerta_inversao_dias (dias de antecedência para alerta quando conta a pagar vence antes da receita, padrão 5)
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'funil_probabilidade_por_etapa',
        valor: JSON.stringify({
          identificada: 10,
          qualificada: 20,
          em_cadencia: 30,
          em_conversa: 50,
          com_proposta_elaborada: 70,
          proposta_enviada: 85,
          parceira: 100,
          nutricao_mensal: 15,
          inativa: 0,
        }),
        descricao:
          'Probabilidade percentual (0 a 100%) por etapa do funil de prospecção para cálculo de previsão de receita ponderada',
      },
      {
        chave: 'financeiro_margem_minima_alerta',
        valor: '20',
        descricao:
          'Margem mínima de lucro (%) aceitável por projeto. Projetos com margem real abaixo deste valor disparam alerta crítico de saúde financeira',
      },
      {
        chave: 'financeiro_antecedencia_alerta_inversao_dias',
        valor: '5',
        descricao:
          'Antecedência em dias para emissão de alerta no fluxo de caixa projetado quando uma conta a pagar ao prestador vence antes do recebimento do cliente correspondente',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      try {
        app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        const r = new Record(parametrosCol)
        r.set('chave', p.chave)
        r.set('valor', p.valor)
        r.set('descricao', p.descricao)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reversão não-destrutiva
  },
)
