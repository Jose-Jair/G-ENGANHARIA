/**
 * 0146 — Campo `valor` na coleção `contratos` + backfill valor = saldo
 *
 * Bug relatado: o frontend soma `contratos.valor` (lista de Empresas, Dashboard
 * 'Contratos sob gestão', curva ABC), mas a coleção só tinha `saldo`. O PocketBase
 * descartava silenciosamente o `valor` enviado pelo formulário e pela importação.
 *
 * 1) Adiciona o campo number opcional `valor` ("Valor global do contrato", min 0),
 *    SEM alterar as regras de API (listRule/viewRule/createRule/updateRule/deleteRule).
 * 2) Backfill idempotente com SQL direto: valor = saldo onde valor vazio/0 e saldo > 0.
 *    Em banco vazio é no-op.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')

    // 1. Campo `valor` (idempotente)
    if (!col.fields.getByName('valor')) {
      const f = new NumberField({
        name: 'valor',
        min: 0,
      })
      col.fields.add(f)
      app.save(col)
      console.log('[0146] Campo `valor` adicionado à coleção contratos')
    } else {
      console.log('[0146] Campo `valor` já existe em contratos — nada a fazer')
    }

    // 2. Backfill: valor = saldo onde valor vazio/0 e saldo > 0
    const antes = {}
    try {
      const qAntes = app
        .db()
        .newQuery(
          'SELECT COUNT(*) as total FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
      qAntes.one(antes)
      console.log('[0146] Linhas a corrigir (valor vazio/0 com saldo > 0): ' + (antes.total || 0))
    } catch (errCount) {
      console.log('[0146] Aviso ao contar linhas antes do backfill: ' + errCount)
    }

    try {
      app
        .db()
        .newQuery(
          'UPDATE contratos SET valor = saldo WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
        .execute()
      console.log('[0146] Backfill executado')
    } catch (errUpdate) {
      console.log('[0146] Aviso ao executar backfill: ' + errUpdate)
    }

    const depois = {}
    try {
      const qDepois = app
        .db()
        .newQuery(
          'SELECT COUNT(*) as total FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
      qDepois.one(depois)
      console.log('[0146] Linhas restantes sem valor após backfill: ' + (depois.total || 0))
      console.log(
        '[0146] Linhas afetadas pelo backfill: ' + ((antes.total || 0) - (depois.total || 0)),
      )
    } catch (errCount2) {
      console.log('[0146] Aviso ao contar linhas depois do backfill: ' + errCount2)
    }
  },
  (app) => {
    // down: remove apenas o campo; os valores preenchidos pelo backfill somem com ele
    const col = app.findCollectionByNameOrId('contratos')
    if (col.fields.getByName('valor')) {
      col.fields.removeByName('valor')
      app.save(col)
    }
  },
)
