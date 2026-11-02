migrate(
  (app) => {
    // Saneamento de segurança para o CTR-2026-0004
    // Se porventura houver mais de 2 contas geradas, mantém apenas as 2 corretas
    const contasCtr4 = app.findRecordsByFilter(
      'contas',
      "contrato_servico = 'yikdjwsrxm3zhkn' && tipo = 'receber'",
      '-created',
      500,
      0,
    )

    if (contasCtr4 && contasCtr4.length > 2) {
      for (let i = 2; i < contasCtr4.length; i++) {
        try {
          app.delete(contasCtr4[i])
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
