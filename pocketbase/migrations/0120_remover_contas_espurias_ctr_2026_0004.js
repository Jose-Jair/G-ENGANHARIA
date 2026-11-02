migrate(
  (app) => {
    // Saneamento pontual: limpar contas espúrias do CTR-2026-0004
    const contasCtr4 = app.findRecordsByFilter(
      'contas',
      "contrato_servico = 'yikdjwsrxm3zhkn' && tipo = 'receber'",
      '-created',
      500,
      0,
    )

    if (contasCtr4 && contasCtr4.length > 0) {
      for (let i = 0; i < contasCtr4.length; i++) {
        try {
          app.delete(contasCtr4[i])
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
