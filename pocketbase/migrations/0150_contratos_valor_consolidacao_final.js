/**
 * 0150 — Consolidação final do campo `valor` na coleção `contratos`
 *
 * Contexto (rodada final autorizada pelo dono):
 *  - 0146 criou a COLUNA por SQL direto e tentou registrar o campo;
 *  - 0147/0149 usavam padrões mistos (app.save col vs $app.save, try/catch
 *    que podia mascarar falha de save) — 0149 com loadFromDB inexistente na
 *    JSVM v0.23 fez o dono ver o campo ausente via HTTP às 14:18;
 *  - após o deploy efetivo, a API de registros passou a servir `valor`
 *    (registro zgtfm4s5kknv1ob => valor 79438; filtro valor>0 sem erro 400).
 *
 * Esta migração é a prova durável e idempotente do padrão correto, para
 * replays em cópias do projeto e banco limpo:
 *  1) se o campo `valor` NÃO consta no schema: fields.add(new NumberField)
 *     + app.save(col) — SEM loadFromDB, SEM try/catch em torno do save
 *     (se falhar, a migração estoura e não é marcada como aplicada);
 *  2) VERIFICAÇÃO OBRIGATÓRIA relendo a coleção do banco: se o field não
 *     vier, throw — a migração NÃO é marcada como aplicada;
 *  3) backfill idempotente valor = saldo WHERE (valor IS NULL OR valor = 0)
 *     AND saldo > 0, com contagem antes/depois no log (queries SEM try/catch
 *     que mascare erro — .one(recept) como na 0055);
 *  4) NÃO derruba nem recria a coluna física: se ela já existe (criada por
 *     SQL na 0146), os dados são preservados — só o schema é registrado.
 *     Em banco vazio (coluna inexistente), o registro do field via API de
 *     coleções já cria a coluna — nenhum SQL de tabela aqui.
 *
 * Não altera regras de API, hooks, outras coleções nem telas do front.
 */
migrate(
  (app) => {
    const LOG = '[0150 contratos valor]'

    // ---- Passo 1: garantir o field no schema (idempotente) ----
    const col = app.findCollectionByNameOrId('contratos')

    let fieldValor = null
    try {
      fieldValor = col.fields.getByName('valor')
    } catch (e) {
      // getByName lança quando o field não existe — isto é DETECÇÃO, não mascara erro
      fieldValor = null
    }

    if (!fieldValor) {
      const f = new NumberField({ name: 'valor', required: false, min: 0 })
      col.fields.add(f)
      console.log(LOG + " field 'valor' ausente no schema — fields.add(new NumberField) + app.save")
      app.save(col)
      console.log(LOG + ' app.save(col) executado SEM try/catch (falha aqui estoura)')
    } else {
      console.log(LOG + " field 'valor' já registrado no schema — seguindo para verificação")
    }

    // ---- Passo 2: VERIFICAÇÃO OBRIGATÓRIA relendo do banco ----
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
          " FALHA NA VERIFICAÇÃO: após app.save o field 'valor' NÃO consta no schema da coleção contratos. A migração NÃO foi marcada como aplicada.",
      )
    }
    console.log(
      LOG +
        " VERIFICAÇÃO OK: fields.getByName('valor') existe (type=" +
        verificado.type() +
        ', required=' +
        verificado.required +
        ', min=' +
        verificado.min +
        ')',
    )

    // ---- Passo 3: backfill idempotente com contagens antes/depois (sem mascarar erro) ----
    // receptor correto na JSVM v0.23: DynamicModel (objeto JS puro dá "must be a NullStringMap")
    const antes = new DynamicModel({ n: 0 })
    app
      .db()
      .newQuery(
        'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
      )
      .one(antes)
    const antesN = parseInt(String(antes.n), 10) || 0
    console.log(
      LOG + ' antes do backfill: registros a preencher (valor nulo/0 com saldo>0) = ' + antesN,
    )

    app
      .db()
      .newQuery(
        'UPDATE contratos SET valor = saldo WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
      )
      .execute()

    const depois = new DynamicModel({ n: 0 })
    app
      .db()
      .newQuery(
        'SELECT COUNT(*) AS n FROM contratos WHERE (valor IS NULL OR valor = 0) AND saldo IS NOT NULL AND saldo > 0',
      )
      .one(depois)
    const depoisN = parseInt(String(depois.n), 10) || 0

    const positivos = new DynamicModel({ n: 0 })
    app.db().newQuery('SELECT COUNT(*) AS n FROM contratos WHERE valor > 0').one(positivos)
    const positivosN = parseInt(String(positivos.n), 10) || 0

    console.log(
      LOG +
        ' backfill concluído: registros corrigidos = ' +
        (antesN - depoisN) +
        '; restantes sem valor (com saldo>0) = ' +
        depoisN +
        '; total com valor > 0 = ' +
        positivosN,
    )
  },
  (app) => {
    // down: remove apenas o field do schema (coluna/dados permanecem)
    const col = app.findCollectionByNameOrId('contratos')
    let f = null
    try {
      f = col.fields.getByName('valor')
    } catch (e) {
      f = null
    }
    if (f) {
      col.fields.removeByName('valor')
      app.save(col)
    }
  },
)
