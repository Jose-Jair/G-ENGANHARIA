migrate(
  (app) => {
    // 1. Atualizar campos do subcontratos:
    // Novos status: 'minuta', 'aguardando_assinatura', 'assinado', 'em_execucao', 'concluido', 'avaliado', 'encerrado', 'cancelado'
    // Novos campos: percentual_retencao_tecnica, retencao_tecnica_acumulada, retencao_tecnica_liberada, status_retencao, checklist_encerramento_json
    const subCol = app.findCollectionByNameOrId('subcontratos')

    const statusField = subCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'minuta',
        'aguardando_assinatura',
        'assinado',
        'em_execucao',
        'concluido',
        'avaliado',
        'encerrado',
        'cancelado',
      ]
    }

    if (!subCol.fields.getByName('percentual_retencao_tecnica')) {
      subCol.fields.add(
        new NumberField({
          name: 'percentual_retencao_tecnica',
          required: false,
        }),
      )
    }

    if (!subCol.fields.getByName('retencao_tecnica_acumulada')) {
      subCol.fields.add(
        new NumberField({
          name: 'retencao_tecnica_acumulada',
          required: false,
        }),
      )
    }

    if (!subCol.fields.getByName('retencao_tecnica_liberada')) {
      subCol.fields.add(
        new NumberField({
          name: 'retencao_tecnica_liberada',
          required: false,
        }),
      )
    }

    if (!subCol.fields.getByName('status_retencao')) {
      subCol.fields.add(
        new SelectField({
          name: 'status_retencao',
          values: ['sem_retencao', 'acumulando', 'parcialmente_liberada', 'totalmente_liberada'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!subCol.fields.getByName('checklist_encerramento_json')) {
      subCol.fields.add(
        new JSONField({
          name: 'checklist_encerramento_json',
          required: false,
        }),
      )
    }

    app.save(subCol)

    // 2. Atualizar campos da coleção 'medicoes':
    // Campos de retenção técnica na medição e aceitação do cliente
    const medCol = app.findCollectionByNameOrId('medicoes')

    if (!medCol.fields.getByName('percentual_retencao_tecnica')) {
      medCol.fields.add(
        new NumberField({
          name: 'percentual_retencao_tecnica',
          required: false,
        }),
      )
    }

    if (!medCol.fields.getByName('valor_retencao_tecnica')) {
      medCol.fields.add(
        new NumberField({
          name: 'valor_retencao_tecnica',
          required: false,
        }),
      )
    }

    if (!medCol.fields.getByName('aceita_pelo_cliente')) {
      medCol.fields.add(
        new BoolField({
          name: 'aceita_pelo_cliente',
          required: false,
        }),
      )
    }

    if (!medCol.fields.getByName('data_aceitacao_cliente')) {
      medCol.fields.add(
        new DateField({
          name: 'data_aceitacao_cliente',
          required: false,
        }),
      )
    }

    if (!medCol.fields.getByName('responsavel_aceitacao_cliente')) {
      medCol.fields.add(
        new TextField({
          name: 'responsavel_aceitacao_cliente',
          required: false,
        }),
      )
    }

    app.save(medCol)

    // 3. Parâmetro no sistema para o percentual padrão sugerido de retenção técnica (10%)
    try {
      let pRet = null
      try {
        pRet = app.findFirstRecordByData(
          'parametros',
          'chave',
          'subcontrato_retencao_tecnica_padrao',
        )
      } catch (_) {}

      if (!pRet) {
        const paramsCol = app.findCollectionByNameOrId('parametros')
        const novoParam = new Record(paramsCol)
        novoParam.set('chave', 'subcontrato_retencao_tecnica_padrao')
        novoParam.set('valor', '10')
        novoParam.set(
          'descricao',
          'Percentual padrão sugerido de retenção técnica em subcontratos de executores (%), retido a cada medição e liberado após aceitação da entrega pelo cliente.',
        )
        app.save(novoParam)
      }
    } catch (eParam) {
      console.log('[0085] Aviso ao criar parâmetro subcontrato_retencao_tecnica_padrao: ' + eParam)
    }
  },
  (app) => {
    // Reverter campos se necessário
    try {
      const subCol = app.findCollectionByNameOrId('subcontratos')
      const statusField = subCol.fields.getByName('status')
      if (statusField) {
        statusField.values = ['minuta', 'aguardando_assinatura', 'assinado', 'cancelado']
      }
      app.save(subCol)
    } catch (_) {}
  },
)
