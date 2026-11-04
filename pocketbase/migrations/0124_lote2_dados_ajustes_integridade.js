/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0124 - Lote 2: Dados + Brecha Residual
    // Ajustes pontuais via raw SQL UPDATE (.newQuery) para NÃO disparar hooks nem e-mails.
    // 1. A1/A2: PROP-2026-0004 e PROP-2026-0001 -> status 'convertida_em_projeto'
    //    somente se cada uma tiver contrato assinado e projeto existente.
    // 2. A3: PRJ-2026-0001 prazo_final = data da última assinatura do seu contrato + prazo_dias,
    //    somente se prazo_final estiver vazio.
    // 3. M6: contas (a receber, vinculadas a contratos) sem chave_idempotencia recebem
    //    'ctr-<numero do contrato em minusculo>-parcela-<N>' na ordem do vencimento,
    //    somente onde estiver vazio e sem colidir com chave existente.

    // -------------------------------------------------------------------------
    // A1/A2 - Propostas PROP-2026-0001 e PROP-2026-0004 -> 'convertida_em_projeto'
    // -------------------------------------------------------------------------
    try {
      app
        .db()
        .newQuery(
          'UPDATE propostas ' +
            "SET status = 'convertida_em_projeto', updated = strftime('%Y-%m-%d %H:%M:%f', 'now') " +
            "WHERE numero IN ('PROP-2026-0001', 'PROP-2026-0004') " +
            "  AND status != 'convertida_em_projeto' " +
            '  AND id IN ( ' +
            '    SELECT cs.proposta ' +
            '    FROM contratos_servico cs ' +
            '    INNER JOIN projetos p ON p.contrato_servico = cs.id ' +
            "    WHERE cs.status = 'assinado' " +
            '      AND cs.proposta = propostas.id ' +
            '  )',
        )
        .execute()
    } catch (errA1A2) {
      console.log('Erro ao atualizar status A1/A2: ' + errA1A2)
    }

    // -------------------------------------------------------------------------
    // A3 - PRJ-2026-0001 prazo_final = última assinatura + prazo_dias
    // -------------------------------------------------------------------------
    try {
      app
        .db()
        .newQuery(
          'UPDATE projetos ' +
            'SET prazo_final = ( ' +
            "  SELECT strftime('%Y-%m-%d 12:00:00.000Z', " +
            '    CASE ' +
            '      WHEN cs.data_assinatura_cliente > cs.data_assinatura_admin THEN cs.data_assinatura_cliente ' +
            '      ELSE cs.data_assinatura_admin ' +
            '    END, ' +
            "    '+' || cs.prazo_dias || ' days' " +
            '  ) ' +
            '  FROM contratos_servico cs ' +
            '  WHERE cs.id = projetos.contrato_servico ' +
            "    AND cs.data_assinatura_cliente IS NOT NULL AND cs.data_assinatura_cliente != '' " +
            "    AND cs.data_assinatura_admin IS NOT NULL AND cs.data_assinatura_admin != '' " +
            '), ' +
            "updated = strftime('%Y-%m-%d %H:%M:%f', 'now') " +
            "WHERE codigo = 'PRJ-2026-0001' " +
            "  AND (prazo_final IS NULL OR prazo_final = '') " +
            '  AND contrato_servico IN ( ' +
            '    SELECT id FROM contratos_servico ' +
            "    WHERE data_assinatura_cliente IS NOT NULL AND data_assinatura_cliente != '' " +
            "      AND data_assinatura_admin IS NOT NULL AND data_assinatura_admin != '' " +
            '  )',
        )
        .execute()
    } catch (errA3) {
      console.log('Erro ao atualizar prazo_final A3: ' + errA3)
    }

    // -------------------------------------------------------------------------
    // M6 - Chave de idempotência para contas a receber vinculadas a contrato
    // -------------------------------------------------------------------------
    try {
      // Localizar contratos que possuem contas sem chave_idempotencia
      const rowsContratos = []
      app
        .db()
        .newQuery(
          'SELECT DISTINCT cs.id as cs_id, cs.numero as cs_numero ' +
            'FROM contas c ' +
            'INNER JOIN contratos_servico cs ON cs.id = c.contrato_servico ' +
            "WHERE c.tipo = 'receber' " +
            "  AND (c.chave_idempotencia IS NULL OR c.chave_idempotencia = '')",
        )
        .all(rowsContratos)

      for (let i = 0; i < rowsContratos.length; i++) {
        const csId = rowsContratos[i].cs_id
        const csNum = rowsContratos[i].cs_numero || ''
        const prefixo = csNum ? csNum.toLowerCase() : 'ctr'

        const contasContrato = []
        app
          .db()
          .newQuery(
            'SELECT id, vencimento, created ' +
              'FROM contas ' +
              "WHERE contrato_servico = {:csId} AND tipo = 'receber' " +
              "ORDER BY CASE WHEN vencimento IS NULL OR vencimento = '' THEN '9999' ELSE vencimento END ASC, created ASC",
          )
          .bind({ csId: csId })
          .all(contasContrato)

        for (let idx = 0; idx < contasContrato.length; idx++) {
          const contaId = contasContrato[idx].id
          const nParcela = idx + 1
          const chaveCandidata = prefixo + '-parcela-' + nParcela

          // Atualiza apenas se a conta ainda não tiver chave_idempotencia
          // e se a chaveCandidata não estiver em uso em outra conta (sem colisão)
          app
            .db()
            .newQuery(
              'UPDATE contas ' +
                "SET chave_idempotencia = {:chave}, updated = strftime('%Y-%m-%d %H:%M:%f', 'now') " +
                'WHERE id = {:contaId} ' +
                "  AND (chave_idempotencia IS NULL OR chave_idempotencia = '') " +
                '  AND NOT EXISTS ( ' +
                '    SELECT 1 FROM contas WHERE chave_idempotencia = {:chave} ' +
                '  )',
            )
            .bind({ chave: chaveCandidata, contaId: contaId })
            .execute()
        }
      }
    } catch (errM6) {
      console.log('Erro ao atribuir chave_idempotencia M6: ' + errM6)
    }
  },
  (app) => {
    // Reversão segura no-op (migração de ajuste de integridade de dados existentes)
  },
)
