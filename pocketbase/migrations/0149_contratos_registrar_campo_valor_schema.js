/**
 * 0149 — Re-registro definitivo do campo `valor` na coleção `contratos`
 *
 * Histórico do bug (valor sempre R$ 0,00 no Dashboard/Empresas/curva):
 *  - 0146 criou a COLUNA por SQL direto, fora do schema da coleção (API ignora);
 *  - 0146/0147 tentaram o registro via API de coleções (fields.add + $app.save);
 *  - o erro dominante era o uso de app.save(col) / col.save() com ponteiro errado
 *    ("Invalid variable type: must be a pointer" na JSVM — SaveReceiver não
 *    enfileira mutations; $app.save é o caminho certo e é o mesmo que a 0146
 *    usa com sucesso), além de callbacks .one(fn, fn) que a JSVM do PB v0.23
 *    recusa ("must be a pointer" / "NullStringMap");
 *  - 0148 consta como aplicada em _migrations, mas seu arquivo nem existe mais
 *    no repositório (churn de deploy) — o campo seguiu ausente do schema vivo.
 *
 * O que esta migração faz (idempotente, segura para rodar de novo):
 *  1) se a coluna física `valor` não existir (caso de banco limpo), recria a
 *     tabela com backup em contratos_bk_0149 e restaura os dados;
 *  2) carrega a coleção e, se `valor` não constar do schema, adiciona via
 *     fields.add(new NumberField) e persiste com $app.save(collection);
 *  3) VERIFICAÇÃO OBRIGATÓRIA lendo do banco: fields.getByName('valor') tem que
 *     existir — se não existir, a migração FALHA (não é marcada como aplicada
 *     em silêncio); backup permanece como rede de segurança;
 *  4) backfill idempotente: UPDATE contratos SET valor = saldo
 *     WHERE (valor IS NULL OR valor = 0) AND saldo > 0, com contagens
 *     antes/depois logadas.
 *
 * Não altera regras de API, hooks, outras coleções nem telas do front.
 * Sem DELETE de dados: a única ação destrutiva é o DROP da tabela nova
 * e vazia criada no passo 1 (dados vivos foram primeiro copiados para o backup).
 */
migrate(
  (app) => {
    const LOG = '[0149 contratos valor]'

    // ---- Passo 1: coluna física (caso de banco limpo, sem a coluna órfã) ----
    const temColuna = function () {
      let n = 0
      try {
        const recept = {}
        app
          .db()
          .newQuery("SELECT COUNT(*) AS n FROM pragma_table_info('contratos') WHERE name='valor'")
          .one(recept)
        n = parseInt(recept.n, 10) || 0
      } catch (eCount) {
        console.log(LOG + ' aviso ao checar coluna física: ' + eCount)
      }
      return n > 0
    }

    if (!temColuna()) {
      // backup em _bk antes de qualquer recriação
      app.db().newQuery('CREATE TABLE contratos_bk_0149 AS SELECT * FROM contratos').execute()
      console.log(LOG + ' backup criado: contratos_bk_0149')

      // recria a tabela com a coluna valor
      app
        .db()
        .newQuery(
          'CREATE TABLE contratos_new_0149 AS SELECT *, CAST(NULL AS REAL) AS valor FROM contratos',
        )
        .execute()
      app.db().newQuery('DROP TABLE contratos').execute()
      app.db().newQuery('ALTER TABLE contratos_new_0149 RENAME TO contratos').execute()

      // restaura os dados preservando valores existentes de valor
      app
        .db()
        .newQuery(
          'UPDATE contratos SET valor = (SELECT valor FROM contratos_bk_0149 WHERE contratos_bk_0149.id = contratos.id) WHERE id IN (SELECT id FROM contratos_bk_0149)',
        )
        .execute()
      let restauraN = 0
      try {
        const restauraRecept = {}
        app
          .db()
          .newQuery(
            'SELECT COUNT(*) AS n FROM contratos WHERE valor IS NOT NULL AND id IN (SELECT id FROM contratos_bk_0149)',
          )
          .one(restauraRecept)
        restauraN = parseInt(restauraRecept.n, 10) || 0
      } catch (eRest) {
        console.log(LOG + ' aviso ao contar restaurações: ' + eRest)
      }
      console.log(
        LOG + ' restauração concluída: registros com valor restaurado do backup = ' + restauraN,
      )
    } else {
      console.log(
        LOG +
          ' coluna física valor já existe — nada a fazer na recriação (estado: coluna presente, field possivelmente ausente)',
      )
    }

    // ---- Passo 2: registro do field no schema da coleção ----
    const col = app.findCollectionByNameOrId('contratos')

    let fieldValor = null
    try {
      fieldValor = col.fields.getByName('valor')
    } catch (e) {
      fieldValor = null
    }
    if (!fieldValor) {
      const f = new NumberField({ name: 'valor', required: false, min: 0 })
      col.fields.add(f)
      console.log(
        LOG +
          ' field valor AUSENTE no schema — adicionado via fields.add(new NumberField) e entrando em $app.save',
      )
      $app.save(col)
      console.log(LOG + ' $app.save(collection) executado')
    } else {
      console.log(
        LOG + ' field valor já registrado no schema — seguindo para verificação e backfill',
      )
    }

    // ---- Passo 3: VERIFICAÇÃO OBRIGATÓRIA (falha => migração NÃO é marcada) ----
    const colVerificada = app.findCollectionByNameOrId('contratos')
    let verificado = null
    try {
      verificado = colVerificada.fields.getByName('valor')
    } catch (e2) {
      verificado = null
    }
    if (!verificado) {
      throw new Error(
        LOG +
          " FALHA NA VERIFICAÇÃO: após $app.save o field 'valor' NÃO consta no schema da coleção contratos. " +
          'A migração NÃO foi marcada como aplicada. Backup em contratos_bk_0149 preservado. ' +
          'Investigar deploy do PocketBase (o save pode ter sido desfeito por processo externo).',
      )
    }
    console.log(
      LOG +
        " VERIFICAÇÃO OK: fields.getByName('valor') existe no schema (type=" +
        verificado.type() +
        ', required=' +
        verificado.required +
        ', min=' +
        verificado.min +
        ')',
    )

    // ---- Passo 4: backfill idempotente valor = saldo ----
    let antesN = 0
    let depoisN = 0
    let positivosN = 0
    try {
      const antes = {}
      app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo > 0',
        )
        .one(antes)
      antesN = parseInt(antes.n, 10) || 0
    } catch (eAntes) {
      console.log(LOG + ' aviso ao contar antes do backfill: ' + eAntes)
    }
    console.log(
      LOG + ' antes do backfill: registros a preencher (nulo/0 com saldo>0) = ' + antesN,
    )

    app
      .db()
      .newQuery(
        'UPDATE contratos SET valor = saldo WHERE (valor IS NULL OR valor = 0) AND saldo > 0',
      )
      .execute()

    try {
      const depois = {}
      app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo > 0',
        )
        .one(depois)
      depoisN = parseInt(depois.n, 10) || 0
    } catch (eDepois) {
      console.log(LOG + ' aviso ao contar depois do backfill: ' + eDepois)
    }

    try {
      const positivos = {}
      app.db().newQuery('SELECT COUNT(*) AS n FROM contratos WHERE valor > 0').one(positivos)
      positivosN = parseInt(positivos.n, 10) || 0
    } catch (ePos) {
      console.log(LOG + ' aviso ao contar positivos: ' + ePos)
    }

    console.log(
      LOG +
        ' backfill concluído: registros corrigidos = ' +
        (antesN - depoisN) +
        '; restantes sem valor = ' +
        depoisN +
        '; total com valor > 0 = ' +
        positivosN,
    )
  },
  (app) => {
    // down: remove apenas o field do schema (coluna/dados permanecem)
    const col = app.findCollectionByNameOrId('contratos')
    if (col.fields.getByName('valor')) {
      col.fields.removeByName('valor')
      app.save(col)
    }
  },
)
