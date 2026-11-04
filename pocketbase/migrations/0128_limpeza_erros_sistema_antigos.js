/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0128: LIMPEZA DOS REGISTROS ANTIGOS DE erros_sistema (GRUPO 1)
    // Decisão do dono: apagar SOMENTE os registros antigos de erros_sistema
    // criados entre 31/10 e 02/11/2026 (resíduos do loop do sweep já corrigido).
    //
    // Regras estritas:
    // - SQL direto via app.db().newQuery().execute() para NÃO disparar hooks nem e-mails.
    // - Idempotente: rodar novamente não faz nada nem causa erro.
    // - Cláusula: created <= '2026-11-02 23:59:59'.
    // - Contagem antes e depois registrada nos logs de console da migração.
    // - Sem .one() vazio, sem newFilesystem (panics conhecidos).
    // - NADA mais é tocado (users, audit_logs, catálogos, parâmetros 100% intactos).
    // =========================================================================

    const corte = '2026-11-02 23:59:59'

    if (!app.hasTable('erros_sistema')) {
      console.log('[0128] Tabela erros_sistema não existe. Nenhuma ação necessária.')
      return
    }

    let contagemAntes = 0
    try {
      const qAntes = app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM erros_sistema WHERE created <= {:corte}')
        .bind({ corte: corte })
      const resAntes = {}
      qAntes.one(resAntes)
      contagemAntes = parseInt(resAntes.total, 10) || 0
    } catch (eCountAntes) {
      console.log('[0128] Erro ao contar antes: ' + eCountAntes)
    }

    console.log(
      '[0128] Contagem de erros_sistema antes da exclusão (created <= ' +
        corte +
        '): ' +
        contagemAntes,
    )

    // Executa a exclusão direta via SQL (sem hooks / sem e-mails)
    try {
      app
        .db()
        .newQuery('DELETE FROM erros_sistema WHERE created <= {:corte}')
        .bind({ corte: corte })
        .execute()
    } catch (eDelete) {
      console.log('[0128] Erro ao deletar registros de erros_sistema: ' + eDelete)
      throw eDelete
    }

    let contagemDepois = 0
    try {
      const qDepois = app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM erros_sistema WHERE created <= {:corte}')
        .bind({ corte: corte })
      const resDepois = {}
      qDepois.one(resDepois)
      contagemDepois = parseInt(resDepois.total, 10) || 0
    } catch (eCountDepois) {
      console.log('[0128] Erro ao contar depois: ' + eCountDepois)
    }

    console.log(
      '[0128] Contagem de erros_sistema após a exclusão (created <= ' +
        corte +
        '): ' +
        contagemDepois,
    )
  },
  (app) => {
    // Reversão não é aplicável para limpeza destrutiva de logs de erro antigos
  },
)
