migrate(
  (app) => {
    // 1. Obter coleções 'projetos' e 'contratos_servico'
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')

    // 2. Adicionar campo 'contrato_servico' (relação com contratos_servico) em 'projetos'
    if (!projetosCol.fields.getByName('contrato_servico')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'contrato_servico',
          collectionId: contratosServicoCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 3. Adicionar campo 'projeto' (relação com projetos) em 'contratos_servico'
    if (!contratosServicoCol.fields.getByName('projeto')) {
      contratosServicoCol.fields.add(
        new RelationField({
          name: 'projeto',
          collectionId: projetosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(projetosCol)
    app.save(contratosServicoCol)

    // 4. Backfill: para projetos existentes vinculados a propostas que já tenham contratos_servico,
    // sincronizar as referências mútuas
    try {
      const contratos = app.findRecordsByFilter(
        'contratos_servico',
        "proposta != ''",
        '-created',
        500,
        0,
      )
      for (const ctr of contratos) {
        const propostaId = ctr.getString('proposta')
        if (propostaId) {
          const projs = app.findRecordsByFilter(
            'projetos',
            "proposta = '" + propostaId + "'",
            '-created',
            1,
            0,
          )
          if (projs.length > 0) {
            const prj = projs[0]
            if (!prj.getString('contrato_servico')) {
              prj.set('contrato_servico', ctr.id)
              app.save(prj)
            }
            if (!ctr.getString('projeto')) {
              ctr.set('projeto', prj.id)
              app.save(ctr)
            }
          }
        }
      }
    } catch (errBackfill) {
      console.log('Aviso ao sincronizar contrato_servico e projetos: ' + errBackfill)
    }
  },
  (app) => {
    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      const campoContrato = projetosCol.fields.getByName('contrato_servico')
      if (campoContrato) {
        projetosCol.fields.removeByName('contrato_servico')
        app.save(projetosCol)
      }
    } catch (_) {}

    try {
      const contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')
      const campoProj = contratosServicoCol.fields.getByName('projeto')
      if (campoProj) {
        contratosServicoCol.fields.removeByName('projeto')
        app.save(contratosServicoCol)
      }
    } catch (_) {}
  },
)
