migrate(
  (app) => {
    try {
      const parametros = app.findCollectionByNameOrId('parametros')

      // Chaves manuais que deixam de existir conforme v0.0.16
      const chavesParaRemover = [
        'faixas_curva',
        'faixa_corte_curva_a',
        'faixa_corte_curva_b',
        'pesos_score_curva',
        'modo_curva_parceiros',
        'pesos_score_demanda_parceiro',
        'percentuais_curva_abc_parceiro',
        'pesos_avaliacao_executor',
      ]

      for (let i = 0; i < chavesParaRemover.length; i++) {
        try {
          const rec = app.findFirstRecordByData('parametros', 'chave', chavesParaRemover[i])
          app.delete(rec)
        } catch (_) {}
      }
    } catch (err) {
      console.log('Erro na migracao 0024: ' + err)
    }
  },
  (app) => {
    // Reverter apenas re-adicionando se estritamente necessário
  },
)
