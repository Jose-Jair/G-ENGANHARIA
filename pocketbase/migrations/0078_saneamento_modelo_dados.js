migrate(
  (app) => {
    // =========================================================================
    // SANEAMENTO DO MODELO DE DADOS — GESTÃO G+ (0078)
    // 1. PROPOSTAS: migra status 'aprovacao_interna' residual para 'aprovada' e
    //    restringe a lista de valores do SelectField status.
    // 2. EXECUTORES: backfill conselho_classe -> conselho e numero_registro_conselho -> numero_registro.
    // 3. COTAÇÕES: backfill data_limite -> prazo_resposta (quando prazo_resposta nulo/vazio).
    // 4. EMPRESAS e CLIENTES_PF: conversão de telefone textual para o json telefones (quando telefones vazio).
    // 5. CONTAS: adicionar relation 'contrato_servico' -> contratos_servico (maxSelect 1)
    //    e backfill via descrição ("Contrato CTR-...") e via proposta vinculada.
    // =========================================================================

    // 1. PROPOSTAS: atualizar registros residuais 'aprovacao_interna' para 'aprovada'
    app
      .db()
      .newQuery(`
    UPDATE propostas SET status = 'aprovada' WHERE status = 'aprovacao_interna'
  `)
      .execute()

    // Atualizar schema de propostas: campo status sem 'aprovacao_interna'
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const statusFieldProp = propostasCol.fields.getByName('status')
    if (statusFieldProp) {
      statusFieldProp.values = [
        'rascunho',
        'aprovada',
        'enviada',
        'visualizada',
        'em_negociacao',
        'aceita',
        'recusada',
        'expirada',
      ]
      statusFieldProp.maxSelect = 1
      app.save(propostasCol)
    }

    // 2. EXECUTORES: copiar conselho_classe -> conselho e numero_registro_conselho -> numero_registro
    // Apenas quando o canônico estiver vazio ou nulo
    app
      .db()
      .newQuery(`
    UPDATE executores
    SET conselho = conselho_classe
    WHERE (conselho IS NULL OR conselho = '')
      AND conselho_classe IS NOT NULL
      AND conselho_classe != ''
  `)
      .execute()

    app
      .db()
      .newQuery(`
    UPDATE executores
    SET numero_registro = numero_registro_conselho
    WHERE (numero_registro IS NULL OR numero_registro = '')
      AND numero_registro_conselho IS NOT NULL
      AND numero_registro_conselho != ''
  `)
      .execute()

    // 3. COTAÇÕES: data_limite -> prazo_resposta (quando prazo_resposta for nulo/vazio)
    app
      .db()
      .newQuery(`
    UPDATE cotacoes
    SET prazo_resposta = data_limite
    WHERE (prazo_resposta IS NULL OR prazo_resposta = '')
      AND data_limite IS NOT NULL
      AND data_limite != ''
  `)
      .execute()

    // 4. EMPRESAS: converter telefone texto em array JSON telefones quando telefones vazio
    try {
      const empresas = app.findRecordsByFilter('empresas', "telefone != ''", 'created', 500, 0)
      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        const telsRaw = emp.getString('telefones')
        let parsed = []
        try {
          if (telsRaw && telsRaw !== 'null' && telsRaw !== '[]') {
            parsed = JSON.parse(telsRaw)
          }
        } catch (_) {
          parsed = []
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
          const telTexto = emp.getString('telefone')
          if (telTexto && telTexto.trim()) {
            const limpo = telTexto.replace(/\D/g, '')
            let ddi = '55'
            let ddd = ''
            let num = limpo

            if (limpo.startsWith('55') && limpo.length >= 12) {
              ddi = '55'
              ddd = limpo.substring(2, 4)
              num = limpo.substring(4)
            } else if (limpo.length >= 10) {
              ddd = limpo.substring(0, 2)
              num = limpo.substring(2)
            }

            const novoArray = [
              {
                tipo: 'comercial',
                ddi: ddi,
                ddd: ddd,
                numero: num,
                ramal: '',
                whatsapp: true,
                principal: true,
              },
            ]
            emp.set('telefones', novoArray)
            app.save(emp)
          }
        }
      }
    } catch (errEmp) {
      console.log('[0078] Erro no backfill de telefones empresas: ' + errEmp)
    }

    // CLIENTES_PF: converter telefone texto em array JSON telefones quando telefones vazio
    try {
      const clientesPf = app.findRecordsByFilter('clientes_pf', "telefone != ''", 'created', 500, 0)
      for (let i = 0; i < clientesPf.length; i++) {
        const cli = clientesPf[i]
        const telsRaw = cli.getString('telefones')
        let parsed = []
        try {
          if (telsRaw && telsRaw !== 'null' && telsRaw !== '[]') {
            parsed = JSON.parse(telsRaw)
          }
        } catch (_) {
          parsed = []
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
          const telTexto = cli.getString('telefone')
          if (telTexto && telTexto.trim()) {
            const limpo = telTexto.replace(/\D/g, '')
            let ddi = '55'
            let ddd = ''
            let num = limpo

            if (limpo.startsWith('55') && limpo.length >= 12) {
              ddi = '55'
              ddd = limpo.substring(2, 4)
              num = limpo.substring(4)
            } else if (limpo.length >= 10) {
              ddd = limpo.substring(0, 2)
              num = limpo.substring(2)
            }

            const novoArray = [
              {
                tipo: 'celular',
                ddi: ddi,
                ddd: ddd,
                numero: num,
                ramal: '',
                whatsapp: true,
                principal: true,
              },
            ]
            cli.set('telefones', novoArray)
            app.save(cli)
          }
        }
      }
    } catch (errCli) {
      console.log('[0078] Erro no backfill de telefones clientes_pf: ' + errCli)
    }

    // 5. CONTAS: Adicionar campo relation 'contrato_servico' -> contratos_servico
    const contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')
    const contasCol = app.findCollectionByNameOrId('contas')

    if (!contasCol.fields.getByName('contrato_servico')) {
      contasCol.fields.add(
        new RelationField({
          name: 'contrato_servico',
          type: 'relation',
          collectionId: contratosServicoCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(contasCol)
    }

    // Backfill 5.1: Vincular contas pelo número do contrato na descrição ("Contrato CTR-AAAA-NNNN")
    try {
      const todosContratos = app.findRecordsByFilter('contratos_servico', '', 'created', 500, 0)
      for (let c = 0; c < todosContratos.length; c++) {
        const ctr = todosContratos[c]
        const numCtr = ctr.getString('numero')
        const ctrId = ctr.id

        if (numCtr) {
          // Atualiza contas que mencionam o contrato na descrição
          app
            .db()
            .newQuery(`
          UPDATE contas
          SET contrato_servico = {:ctrId}
          WHERE (contrato_servico IS NULL OR contrato_servico = '')
            AND descricao LIKE {:padrao}
        `)
            .bind({ ctrId: ctrId, padrao: `%${numCtr}%` })
            .execute()
        }

        // Backfill 5.2: Vincular contas que têm a mesma proposta vinculada
        const propId = ctr.getString('proposta')
        if (propId) {
          app
            .db()
            .newQuery(`
          UPDATE contas
          SET contrato_servico = {:ctrId}
          WHERE (contrato_servico IS NULL OR contrato_servico = '')
            AND proposta = {:propId}
        `)
            .bind({ ctrId: ctrId, propId: propId })
            .execute()
        }
      }
    } catch (errBackfillContas) {
      console.log('[0078] Erro no backfill de contrato_servico em contas: ' + errBackfillContas)
    }
  },
  (app) => {
    // Reversão
    try {
      const contasCol = app.findCollectionByNameOrId('contas')
      const fieldContrato = contasCol.fields.getByName('contrato_servico')
      if (fieldContrato) {
        contasCol.fields.removeByName('contrato_servico')
        app.save(contasCol)
      }
    } catch (_) {}
  },
)
