// Migração 0145 — Adicionar campos snapshot_assinatura (JSON) e snapshot_em (date) em contratos_servico
// Idempotente. Não altera nenhum contrato existente.

migrate(
  (app) => {
    const contratosCol = app.findCollectionByNameOrId('contratos_servico')
    let alterado = false

    if (!contratosCol.fields.getByName('snapshot_assinatura')) {
      contratosCol.fields.add(
        new JSONField({
          name: 'snapshot_assinatura',
          required: false,
        }),
      )
      alterado = true
      console.log('[0145] Campo snapshot_assinatura (JSON) adicionado a contratos_servico.')
    } else {
      console.log('[0145] Campo snapshot_assinatura já existe em contratos_servico.')
    }

    if (!contratosCol.fields.getByName('snapshot_em')) {
      contratosCol.fields.add(
        new DateField({
          name: 'snapshot_em',
          required: false,
        }),
      )
      alterado = true
      console.log('[0145] Campo snapshot_em (DateField) adicionado a contratos_servico.')
    } else {
      console.log('[0145] Campo snapshot_em já existe em contratos_servico.')
    }

    if (alterado) {
      app.save(contratosCol)
      console.log('[0145] Coleção contratos_servico atualizada com sucesso.')
    }
  },
  (app) => {
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos_servico')
      let alterado = false
      if (contratosCol.fields.getByName('snapshot_assinatura')) {
        contratosCol.fields.removeByName('snapshot_assinatura')
        alterado = true
      }
      if (contratosCol.fields.getByName('snapshot_em')) {
        contratosCol.fields.removeByName('snapshot_em')
        alterado = true
      }
      if (alterado) {
        app.save(contratosCol)
      }
    } catch (_) {}
  },
)
