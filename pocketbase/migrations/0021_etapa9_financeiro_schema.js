migrate(
  (app) => {
    const etapasId = app.findCollectionByNameOrId('projeto_etapas').id
    const contas = app.findCollectionByNameOrId('contas')

    // 1. Atualizar select field 'status' em 'contas'
    // Valores requeridos: rascunho | aprovada | enviada | paga | atrasada | cancelada | prevista | realizada
    const statusField = contas.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'rascunho',
        'aprovada',
        'enviada',
        'paga',
        'atrasada',
        'cancelada',
        'prevista',
        'realizada',
      ]
    }

    // 2. Adicionar novos campos em 'contas' se não existirem
    if (!contas.fields.getByName('etapa')) {
      contas.fields.add(
        new RelationField({
          name: 'etapa',
          collectionId: etapasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!contas.fields.getByName('data_pagamento')) {
      contas.fields.add(new DateField({ name: 'data_pagamento' }))
    }

    if (!contas.fields.getByName('anexo_comprovante')) {
      contas.fields.add(
        new FileField({
          name: 'anexo_comprovante',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        }),
      )
    }

    if (!contas.fields.getByName('motivo_cancelamento')) {
      contas.fields.add(new TextField({ name: 'motivo_cancelamento' }))
    }

    if (!contas.fields.getByName('retencao_impostos')) {
      contas.fields.add(new NumberField({ name: 'retencao_impostos' }))
    }

    if (!contas.fields.getByName('valor_liquido')) {
      contas.fields.add(new NumberField({ name: 'valor_liquido' }))
    }

    if (!contas.fields.getByName('medicao_aprovada_origem')) {
      contas.fields.add(new TextField({ name: 'medicao_aprovada_origem' }))
    }

    // 3. Regras RLS estritas:
    // Apenas Admin e Financeiro têm acesso (leitura e gravação).
    // Comercial, Gestor e Executor SEM acesso a contas (bloqueio no banco)
    contas.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
    contas.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
    contas.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
    contas.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
    contas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    app.save(contas)

    // 4. Parâmetros novos da Etapa 9:
    // - bloqueio_fechamento_financeiro_pendente (bool 'true'/'false')
    // - retencao_impostos_padrao_percentual (ex: '11.5')
    // - dias_alerta_financeiro (ex: '7,1')
    const parametros = app.findCollectionByNameOrId('parametros')
    const novosParametros = [
      {
        chave: 'bloqueio_fechamento_financeiro_pendente',
        valor: 'true',
        descricao:
          'Bloquear novas movimentações de contas quando o projeto estiver com fechamento financeiro pendente',
      },
      {
        chave: 'retencao_impostos_padrao_percentual',
        valor: '11.5',
        descricao:
          'Percentual padrão de retenção de tributos (IRRF/INSS/ISS/PIS/COFINS/CSLL) na contratação de executores PJ (%)',
      },
      {
        chave: 'dias_alerta_financeiro',
        valor: '7,1',
        descricao:
          'Dias de antecedência para alertas de contas a pagar e a receber no sininho e dashboard (D-7 e D-1)',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      try {
        app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        const r = new Record(parametros)
        r.set('chave', p.chave)
        r.set('valor', p.valor)
        r.set('descricao', p.descricao)
        app.save(r)
      }
    }
  },
  (app) => {
    // Rollback
  },
)
