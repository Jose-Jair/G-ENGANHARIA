/**
 * 0151 — Tornar o campo `valor` da coleção `contratos` VISÍVEL para usuários do app
 *
 * Problema (relatado e confirmado pelo dono):
 *  - com token de SUPERUSER, GET do registro zgtfm4s5kknv1ob retorna valor=79438
 *    e o filtro (valor>0) funciona;
 *  - com token de USUÁRIO comum (coleção users), o GET vem SEM `valor` e o filtro
 *    dá 400. Esse é exatamente o comportamento de um campo com hidden:true.
 *
 * Causa provável: o NumberField registrado em 0147–0150 foi criado com o flag
 * hidden ativado (comportamento incomum do construtor da JSVM v0.23) ou o save
 * preservou um flag herdado.
 *
 * Esta migração NÃO edita as já aplicadas (regra da plataforma). Ela:
 *  1) relê a coleção contratos do banco;
 *  2) se o field `valor` existir, força hidden = false, preservando todo o
 *     restante do campo (required=false, min=0, presentable etc.) — sem tocar
 *     em dados, regras de API, hooks, outras coleções ou telas;
 *  3) se o field não existir, cria-o já com hidden=false (idempotente em banco
 *     limpo onde 0150 ainda teria registrado o campo);
 *  4) VERIFICAÇÃO OBRIGATÓRIA relendo a coleção do banco: se após app.save o
 *     flag hidden ainda estiver true, a migração ESTOURA e não é marcada como
 *     aplicada — sem try/catch que mascare erro.
 *
 * down: restaura hidden = true no field (estado anterior ao fix).
 */
migrate(
  (app) => {
    const LOG = '[0151 contratos valor hidden]'

    // ---- Passo 1: garantir o field com hidden=false ----
    const col = app.findCollectionByNameOrId('contratos')

    let fieldValor = null
    try {
      fieldValor = col.fields.getByName('valor')
    } catch (e) {
      // getByName lança quando o field não existe — DETECÇÃO, não mascara erro
      fieldValor = null
    }

    if (!fieldValor) {
      console.log(LOG + " field 'valor' ausente no schema — criando com hidden=false")
      col.fields.add(new NumberField({ name: 'valor', required: false, min: 0, hidden: false }))
      app.save(col)
      console.log(LOG + ' app.save(col) executado SEM try/catch (falha aqui estoura)')
    } else {
      const hiddenAntes = fieldValor.hidden
      fieldValor.hidden = false
      // preservar tudo o mais do campo: required=false, min=0 (conforme schema esperado)
      fieldValor.required = false
      if (fieldValor.min === undefined || fieldValor.min === null || fieldValor.min !== 0) {
        fieldValor.min = 0
      }
      if (!hiddenAntes) {
        console.log(LOG + " field 'valor' já estava hidden=false — nada a fazer no schema")
      } else {
        console.log(LOG + " field 'valor' estava hidden=true — aplicando hidden=false")
      }
      app.save(col)
    }

    // ---- Passo 2: VERIFICAÇÃO OBRIGATÓRIA relendo a coleção do banco ----
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
          " FALHA NA VERIFICAÇÃO: após app.save o field 'valor' NÃO consta no schema. Migração NÃO marcada como aplicada.",
      )
    }
    if (verificado.hidden) {
      throw new Error(
        LOG +
          " FALHA NA VERIFICAÇÃO: o flag hidden do field 'valor' NÃO persistiu como false. Migração NÃO marcada como aplicada.",
      )
    }
    console.log(
      LOG +
        " VERIFICAÇÃO OK: field 'valor' type=" +
        verificado.type() +
        ', hidden=' +
        verificado.hidden +
        ', required=' +
        verificado.required +
        ', min=' +
        verificado.min,
    )
  },
  (app) => {
    // down: restaura o estado anterior (hidden=true), apenas o flag, sem tocar em dados
    const col = app.findCollectionByNameOrId('contratos')
    let f = null
    try {
      f = col.fields.getByName('valor')
    } catch (e) {
      f = null
    }
    if (f) {
      f.hidden = true
      app.save(col)
    }
  },
)
