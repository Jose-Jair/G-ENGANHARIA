/**
 * curva_comum.js — REGRA OFICIAL DE CURVA (espelho de src/lib/curvaOficial.ts)
 * ============================================================================
 * - Curva A: score >= 70 OU valor ativo >= 1.000.000
 * - Curva B: score >= 40 OU valor ativo >= 200.000
 * - Caso contrário: C
 * - Empresa com status = 'inativa' é SEMPRE Curva C
 *
 * "Valor ativo" = soma de contratos.valor da empresa cuja situação NÃO contenha
 * 'encerr', 'cancel' nem 'rescind' (mesmo critério de ativo do Dashboard).
 *
 * IMPORTANTE (JSVM PocketBase v0.23): cada callback de hook roda em uma VM
 * separada — funções/consts top-level DESTE arquivo NÃO são visíveis dentro de
 * outros callbacks definidos em OUTROS arquivos. Como o Go embute TODO hook
 * .js do diretório numa única VM, este arquivo é carregado automaticamente:
 * NÃO declare nem load() nenhum outro módulo aqui, e NÃO confie em top-level
 * de arquivos distintos (ver contratos_duplicidade.js antes do fix 'no member get').
 */

var CURVA_CORTE_SCORE_A = 70
var CURVA_CORTE_SCORE_B = 40
var CURVA_CORTE_VALOR_A = 1000000
var CURVA_CORTE_VALOR_B = 200000

function contratoSituacaoAtiva(situacao) {
  var sit = (situacao || '').toString().toLowerCase()
  return (
    sit.indexOf('encerr') === -1 && sit.indexOf('cancel') === -1 && sit.indexOf('rescind') === -1
  )
}

/**
 * Função única de curva no backend.
 * @param {number|string|null} score  score_relevancia da empresa (0-100)
 * @param {number|string|null} valorAtivo soma dos contratos ativos (R$)
 * @param {string|null} status status da empresa ('inativa' => sempre C)
 * @returns {string} 'A' | 'B' | 'C'
 */
function calcularCurvaBackend(score, valorAtivo, status) {
  if ((status || '').toString() === 'inativa') return 'C'
  var s = Number(score) || 0
  var v = Number(valorAtivo) || 0
  if (s >= CURVA_CORTE_SCORE_A || v >= CURVA_CORTE_VALOR_A) return 'A'
  if (s >= CURVA_CORTE_SCORE_B || v >= CURVA_CORTE_VALOR_B) return 'B'
  return 'C'
}

/**
 * Valor ativo da empresa: soma de contratos.valor com situacao ativa
 * (mesmo critério do Dashboard). SUM float em SQL exige CAST AS TEXT.
 * @param {*} app instância $app (ou app de migração)
 * @param {string} empresaId id da empresa
 * @returns {number}
 */
function valorAtivoDaEmpresa(app, empresaId) {
  if (!empresaId) return 0
  var receptor = new DynamicModel({ total: '0' })
  try {
    app
      .db()
      .newQuery(
        "SELECT CAST(COALESCE(SUM(valor), 0) AS TEXT) as total FROM contratos WHERE empresa = {:eid} AND situacao IS NOT NULL AND LOWER(situacao) NOT LIKE '%encerr%' AND LOWER(situacao) NOT LIKE '%cancel%' AND LOWER(situacao) NOT LIKE '%rescind%'",
      )
      .one(receptor)
  } catch (errSum) {
    console.log(
      'curva_comum: erro ao somar contratos ativos da empresa ' + empresaId + ': ' + errSum,
    )
    return 0
  }
  var total = Number(receptor.total)
  return isFinite(total) ? total : 0
}

/**
 * Recalcula e GRAVA a curva oficial da empresa (somente o campo curva).
 * Relê o registro do banco antes de gravar (padrão do projeto).
 * @returns {string|null} curva gravada, ou null se não precisou alterar/deu erro
 */
function recalcularCurvaEmpresa(app, empresaId) {
  if (!empresaId) return null
  var emp
  try {
    emp = app.findRecordById('empresas', empresaId)
  } catch (errFind) {
    console.log('curva_comum: empresa ' + empresaId + ' não encontrada: ' + errFind)
    return null
  }
  var score = emp.get('score') || emp.get('score_relevancia') || 0
  var status = emp.get('status') || ''
  var valorAtivo = valorAtivoDaEmpresa(app, empresaId)
  var novaCurva = calcularCurvaBackend(score, valorAtivo, status)
  var curvaAtual = emp.get('curva') || 'C'
  if (novaCurva === curvaAtual) return null // nada a fazer (idempotente)
  emp.set('curva', novaCurva)
  app.save(emp)
  // VERIFICAÇÃO OBRIGATÓRIA: reler e conferir que persistiu
  var empVerif = app.findRecordById('empresas', empresaId)
  if ((empVerif.get('curva') || 'C') !== novaCurva) {
    throw new Error(
      'curva_comum: FALHA ao persistir curva ' + novaCurva + ' da empresa ' + empresaId,
    )
  }
  return novaCurva
}
