/**
 * 0147 — Registrar o campo `valor` da coleção `contratos` NO SCHEMA (via API de coleções)
 *
 * Contexto: a migração 0146 criou a COLUNA `valor` no SQLite com SQL direto
 * (e/ou tentou registrar sem sucesso), de modo que a coluna existe na tabela
 * com valores preenchidos, mas NÃO está registrada no schema da coleção.
 * Resultado: a API REST (e o front) ignoram o campo — as telas somam R$ 0,00.
 *
 * Esta migração:
 * 1) Preserva os dados atuais da coluna `valor` (backup em tabela temporária);
 * 2) Remove a coluna órfã via SQL (para o ALTER TABLE do PocketBase não falhar
 *    com "duplicate column name: valor");
 * 3) Registra o campo via API de coleções (NumberField, opcional, min 0),
 *    SEM alterar nenhuma regra de API (listRule/viewRule/createRule/updateRule/deleteRule);
 * 4) Restaura os valores do backup;
 * 5) Backfill idempotente: valor = saldo onde valor vazio/0 e saldo > 0,
 *    com contagem antes/depois no log.
 *
 * Em banco vazio (replay em cópia do projeto) tudo é no-op seguro.
 */
migrate(
  (app) => {
    // Restaura `valor` do backup _bk0147_contratos_valor e apaga a tabela de backup.
    // Definida aqui dentro (corpo da migração não aceita instruções de topo fora do migrate).
    const restaurarBackup = () => {
      app
        .db()
        .newQuery(
          'UPDATE contratos SET valor = (SELECT b.valor FROM _bk0147_contratos_valor b WHERE b.id = contratos.id) WHERE EXISTS (SELECT 1 FROM _bk0147_contratos_valor b WHERE b.id = contratos.id)',
        )
        .execute()
      const pos = {}
      app.db().newQuery('SELECT COUNT(*) AS n FROM contratos WHERE valor IS NOT NULL').one(pos)
      console.log(
        '[0147] Valores restaurados do backup: ' + (pos.n || 0) + ' linha(s) com valor preenchido',
      )
      app.db().newQuery('DROP TABLE _bk0147_contratos_valor').execute()
      console.log('[0147] Tabela de backup removida')
    }

    const col = app.findCollectionByNameOrId('contratos')

    const campoJaRegistrado = !!col.fields.getByName('valor')
    console.log('[0147] Campo `valor` já registrado no schema? ' + campoJaRegistrado)

    if (!campoJaRegistrado) {
      // 1. Detecta se a coluna órfã existe no SQLite (0146 criou por SQL direto)
      let colunaExiste = false
      try {
        const contagem = {}
        app
          .db()
          .newQuery('SELECT COUNT(*) AS n FROM contratos WHERE valor IS NOT NULL')
          .one(contagem)
        colunaExiste = true
        console.log(
          '[0147] Coluna órfã `valor` encontrada no SQLite com ' +
            (contagem.n || 0) +
            ' valor(is) preenchido(s)',
        )
      } catch (errDetect) {
        console.log('[0147] Coluna `valor` não existe no SQLite (fluxo limpo): ' + errDetect)
      }

      if (colunaExiste) {
        // 2. Backup dos valores atuais (nenhum dado pode ser perdido)
        try {
          app
            .db()
            .newQuery(
              'CREATE TABLE _bk0147_contratos_valor AS SELECT id, valor FROM contratos WHERE valor IS NOT NULL',
            )
            .execute()
          const bk = {}
          app.db().newQuery('SELECT COUNT(*) AS n FROM _bk0147_contratos_valor').one(bk)
          console.log(
            '[0147] Backup criado (_bk0147_contratos_valor) com ' + (bk.n || 0) + ' linha(s)',
          )
        } catch (errBk) {
          throw new Error(
            '[0147] Falha ao fazer backup de `valor` antes de recriar o campo: ' + errBk,
          )
        }

        // 3. Remove a coluna órfã (senão o save da coleção falha com duplicate column)
        try {
          app.db().newQuery('ALTER TABLE contratos DROP COLUMN valor').execute()
          console.log('[0147] Coluna órfã `valor` removida (dados presos no backup)')
        } catch (errDrop) {
          throw new Error('[0147] Falha ao remover coluna órfã `valor`: ' + errDrop)
        }

        // 4. Registra o campo pela API de coleções do PocketBase
        col.fields.add(
          new NumberField({
            name: 'valor',
            required: false,
            min: 0,
          }),
        )
        app.save(col)
        console.log('[0147] Campo `valor` registrado no schema da coleção contratos')
      } else {
        col.fields.add(
          new NumberField({
            name: 'valor',
            required: false,
            min: 0,
          }),
        )
        app.save(col)
        console.log(
          '[0147] Campo `valor` registrado no schema da coleção contratos (sem coluna prévia)',
        )
      }

      // 5. Restaura os valores do backup (só quando houve backup da coluna órfã)
      if (colunaExiste) {
        restaurarBackup()
      }
    }

    // 6. Backfill idempotente: valor = saldo onde valor vazio/0 e saldo > 0
    const antes = {}
    try {
      app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
        .one(antes)
      console.log(
        '[0147] Linhas a corrigir no backfill (valor vazio/0 e saldo > 0): ' + (antes.n || 0),
      )
    } catch (errCount) {
      console.log('[0147] Aviso ao contar linhas antes do backfill: ' + errCount)
    }

    try {
      app
        .db()
        .newQuery(
          'UPDATE contratos SET valor = saldo WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
        .execute()
      console.log('[0147] Backfill valor = saldo executado')
    } catch (errUpdate) {
      console.log('[0147] Aviso ao executar backfill: ' + errUpdate)
    }

    const depois = {}
    try {
      app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
        )
        .one(depois)
      console.log('[0147] Linhas restantes sem valor após backfill: ' + (depois.n || 0))
      console.log('[0147] Linhas afetadas pelo backfill: ' + ((antes.n || 0) - (depois.n || 0)))
    } catch (errCount2) {
      console.log('[0147] Aviso ao contar linhas depois do backfill: ' + errCount2)
    }
  },
  (app) => {
    // down: remove o campo do schema (a coluna e os valores somem com ele)
    const col = app.findCollectionByNameOrId('contratos')
    if (col.fields.getByName('valor')) {
      col.fields.removeByName('valor')
      app.save(col)
      console.log('[0147] Campo `valor` removido do schema (down)')
    }
  },
)
