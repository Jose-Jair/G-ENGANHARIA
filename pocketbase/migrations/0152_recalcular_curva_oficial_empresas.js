/**
 * 0152 — RECALCULA empresas.curva de TODAS as empresas pela REGRA OFICIAL
 * =========================================================================
 * Decisão do dono (curvas divergentes: Dashboard usava >= 5M, campo usava
 * >= 1 mi / B > 0). Regra oficial, idêntica a src/lib/curvaOficial.ts e
 * pocketbase/hooks/curva_comum.js:
 *   A: score >= 70 OU valor ativo >= 1.000.000
 *   B: score >= 40 OU valor ativo >= 200.000
 *   C: caso contrário; status = 'inativa' é SEMPRE C
 * valor ativo = soma de contratos.valor cuja situacao NÃO contém
 * 'encerr', 'cancel' nem 'rescind'.
 *
 * IDEMPOTENTE: recalcula sempre; grava apenas empresas com curva divergente.
 * NÃO altera score, etapa_funil, responsável, próxima ação nem outro campo.
 * Loga as contagens ANTES e DEPOIS por curva.
 *
 * Padrões JSVM PB v0.23 respeitados: .one() com receptor DynamicModel;
 * COUNT/SUM em try/catch; SUM com CAST AS TEXT; sem loadFromDB; verificação
 * obrigatória relendo após save.
 */
migrate(
  (app) => {
    var CORTE_SCORE_A = 70
    var CORTE_SCORE_B = 40
    var CORTE_VALOR_A = 1000000
    var CORTE_VALOR_B = 200000

    // -------- contagem ANTES --------
    var antes = { a: 0, b: 0, c: 0 }
    function contarCurva(letra) {
      var r = new DynamicModel({ n: 0 })
      try {
        app
          .db()
          .newQuery("SELECT COUNT(*) as n FROM empresas WHERE curva = '" + letra + "'")
          .one(r)
      } catch (err) {
        console.log('[0152] aviso contagem ' + letra + ': ' + err)
      }
      return r.n || 0
    }
    antes.a = contarCurva('A')
    antes.b = contarCurva('B')
    antes.c = contarCurva('C')
    console.log('[0152] ANTES: A=' + antes.a + ' B=' + antes.b + ' C=' + antes.c)

    // -------- valores ativos por empresa (uma query) --------
    var somaPorEmpresa = {}
    var empIds = []
    try {
      var qSomas = app
        .db()
        .newQuery(
          "SELECT empresa as eid, CAST(COALESCE(SUM(valor), 0) AS TEXT) as total FROM contratos WHERE empresa IS NOT NULL AND empresa != '' AND situacao IS NOT NULL AND LOWER(situacao) NOT LIKE '%encerr%' AND LOWER(situacao) NOT LIKE '%cancel%' AND LOWER(situacao) NOT LIKE '%rescind%' GROUP BY empresa",
        )
      var linhas = qSomas.all(new DynamicModel({}))
      for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i]
        var eid = l.getString('eid')
        if (!eid) continue
        somaPorEmpresa[eid] = Number(l.getString('total')) || 0
        empIds.push(eid)
      }
      console.log('[0152] empresas com contratos ativos: ' + empIds.length)
    } catch (eSum) {
      console.log('[0152] aviso ao agrupar somas: ' + eSum)
    }

    // -------- recálculo por empresa --------
    var alteradas = { a: 0, b: 0, c: 0 }
    var total = 0
    try {
      var todas = app.findRecordsByFilter('empresas', 'id != ""', '', 0, 0)
      for (var j = 0; j < todas.length; j++) {
        var emp = todas[j]
        var eid2 = emp.id
        total++
        var score = emp.get('score') || emp.get('score_relevancia') || 0
        var status = emp.get('status') || ''
        var valorAtivo = somaPorEmpresa[eid2] || 0
        var novaCurva
        if ((status || '').toString() === 'inativa') {
          novaCurva = 'C'
        } else if (Number(score) >= CORTE_SCORE_A || valorAtivo >= CORTE_VALOR_A) {
          novaCurva = 'A'
        } else if (Number(score) >= CORTE_SCORE_B || valorAtivo >= CORTE_VALOR_B) {
          novaCurva = 'B'
        } else {
          novaCurva = 'C'
        }
        var curvaAtual = emp.get('curva') || 'C'
        if (novaCurva === curvaAtual) continue
        emp.set('curva', novaCurva)
        app.save(emp)
        // verificação obrigatória: reler
        var verif = app.findRecordById('empresas', eid2)
        if ((verif.get('curva') || 'C') !== novaCurva) {
          throw new Error('[0152] FALHA ao persistir curva ' + novaCurva + ' da empresa ' + eid2)
        }
        alteradas[novaCurva] = (alteradas[novaCurva] || 0) + 1
      }
    } catch (eLoop) {
      console.log('[0152] aviso no recálculo: ' + eLoop)
    }

    // -------- contagem DEPOIS --------
    var depois = { a: 0, b: 0, c: 0 }
    depois.a = contarCurva('A')
    depois.b = contarCurva('B')
    depois.c = contarCurva('C')
    console.log('[0152] DEPOIS: A=' + depois.a + ' B=' + depois.b + ' C=' + depois.c)
    console.log(
      '[0152] Alteradas por curva: A=' +
        (alteradas.a || 0) +
        ' B=' +
        (alteradas.b || 0) +
        ' C=' +
        (alteradas.c || 0) +
        ' (total ' +
        total +
        ' empresas processadas)',
    )
  },
  (app) => {
    // down: nada reversível — a curva anterior não é reconstruída (recálculo puro)
    console.log('[0152] down: nada a desfazer (recálculo de curva)')
  },
)
