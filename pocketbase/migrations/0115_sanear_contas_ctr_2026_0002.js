migrate(
  (app) => {
    // Ajuste fino do backfill: manter exatamente as 2 contas a receber legítimas do CTR-2026-0002
    const contas = app.findRecordsByFilter(
      'contas',
      "contrato_servico = '3q1x2s11wdbzlzw' && tipo = 'receber'",
      'created',
      500,
      0,
    )

    if (contas.length > 2) {
      // Apaga contas excedentes (geradas a partir de repetições em parcelas_json)
      for (let i = 2; i < contas.length; i++) {
        try {
          app.delete(contas[i])
        } catch (_) {}
      }
    }

    // Renomeia as 2 primeiras para 'Parcela 1/2' e 'Parcela 2/2'
    const contasRestantes = app.findRecordsByFilter(
      'contas',
      "contrato_servico = '3q1x2s11wdbzlzw' && tipo = 'receber'",
      'created',
      10,
      0,
    )

    if (contasRestantes.length >= 1) {
      const c1 = contasRestantes[0]
      c1.set(
        'descricao',
        'Contrato CTR-2026-0002 — Parcela 1/2 (50% - Entrada na Assinatura) (Sem NF)',
      )
      c1.set('valor', 500)
      c1.set('valor_liquido', 500)
      app.save(c1)
    }
    if (contasRestantes.length >= 2) {
      const c2 = contasRestantes[1]
      c2.set(
        'descricao',
        'Contrato CTR-2026-0002 — Parcela 2/2 (50% - Entrega Final dos Laudos) (Sem NF)',
      )
      c2.set('valor', 500)
      c2.set('valor_liquido', 500)
      app.save(c2)
    }

    // Saneamento do próprio parcelas_json do contrato para exatamente 2 parcelas limpas
    try {
      const ctr0002 = app.findRecordById('contratos_servico', '3q1x2s11wdbzlzw')
      if (ctr0002) {
        ctr0002.set('parcelas_json', [
          {
            ordem: 1,
            percentual: 50,
            valor: 500,
            descricao: 'Entrada na Assinatura (50%)',
            dias_vencimento: 15,
            gatilho: 'marco',
          },
          {
            ordem: 2,
            percentual: 50,
            valor: 500,
            descricao: 'Entrega Final dos Laudos (50%)',
            dias_vencimento: 30,
            gatilho: 'marco',
          },
        ])
        app.save(ctr0002)
      }
    } catch (_) {}
  },
  (app) => {},
)
