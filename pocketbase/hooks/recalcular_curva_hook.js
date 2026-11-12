/**
 * recalcular_curva_hook.js — RECALCULA empresas.curva PELA REGRA OFICIAL
 * ======================================================================
 * Usa as funções de curva_comum.js (carregadas na MESMA VM: top-level
 * compartilhado entre arquivos de hooks — ver comentário em curva_comum.js).
 *
 * IMPORTANTE: são hooks de REQUISIÇÃO (onRecord*Request), NÃO hooks de modelo —
 * regra do projeto: checagens/efeitos com requestInfo/auth em hooks de modelo
 * bloqueiam operações legítimas de rotas internas.
 *
 * Gatilhos:
 *  - contratos: create / update / delete  -> recalcula a curva da empresa dona
 *  - empresas:  update que altere score_relevancia (ou score) ou status
 *
 * Só grava se a curva calculada for diferente (idempotente). NÃO toca em
 * score, etapa_funil, responsável, próxima ação nem qualquer outro campo.
 *
 * Padrão obrigatório: e.next() PRIMEIRO (operação original persistida) e,
 * nos gatilhos de contrato, o valor do contrato já está na soma SQL (create/
 * update gravam antes do recálculo; delete remove antes do recálculo).
 */

// ---- contratos: create ----
onRecordCreateRequest((e) => {
  e.next()
  try {
    var empId = e.record.getString('empresa') || ''
    if (!empId) return
    var nova = recalcularCurvaEmpresa($app, empId)
    if (nova) {
      console.log(
        '[curva-hook] contrato criado: empresa ' +
          empId +
          ' curva -> ' +
          nova +
          ' (valor ativo ' +
          valorAtivoDaEmpresa($app, empId) +
          ')',
      )
    }
  } catch (errCreate) {
    console.log('[curva-hook] erro no create de contrato: ' + errCreate)
  }
}, 'contratos')

// ---- contratos: update ----
onRecordUpdateRequest((e) => {
  e.next()
  try {
    var empIdU = e.record.getString('empresa') || ''
    if (!empIdU) return
    var novaU = recalcularCurvaEmpresa($app, empIdU)
    if (novaU) {
      console.log('[curva-hook] contrato atualizado: empresa ' + empIdU + ' curva -> ' + novaU)
    }
  } catch (errUpd) {
    console.log('[curva-hook] erro no update de contrato: ' + errUpd)
  }
}, 'contratos')

// ---- contratos: delete ----
onRecordDeleteRequest((e) => {
  e.next()
  try {
    var empIdD = e.record.getString('empresa') || ''
    if (!empIdD) return
    var novaD = recalcularCurvaEmpresa($app, empIdD)
    if (novaD) {
      console.log('[curva-hook] contrato excluído: empresa ' + empIdD + ' curva -> ' + novaD)
    }
  } catch (errDel) {
    console.log('[curva-hook] erro no delete de contrato: ' + errDel)
  }
}, 'contratos')

// ---- empresas: update de score/status ----
onRecordUpdateRequest((e) => {
  e.next()
  try {
    var rec = e.record
    var empIdE = rec.getString('id') || ''
    if (!empIdE) return

    // Recalcula se score (ou score_relevancia, se existir) ou status mudaram
    var scoreMudou = rec.getString('score') !== rec.original().getString('score')
    var scoreRelMudou = false
    try {
      scoreRelMudou =
        rec.getString('score_relevancia') !== rec.original().getString('score_relevancia')
    } catch (_) {}
    var statusMudou = rec.getString('status') !== rec.original().getString('status')
    if (!scoreMudou && !scoreRelMudou && !statusMudou) return

    var novaE = recalcularCurvaEmpresa($app, empIdE)
    if (novaE) {
      console.log('[curva-hook] empresa ' + empIdE + ' (score/status alterados) curva -> ' + novaE)
    }
  } catch (errEmp) {
    console.log('[curva-hook] erro no update de empresa: ' + errEmp)
  }
}, 'empresas')
