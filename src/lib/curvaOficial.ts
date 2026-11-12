/**
 * REGRA OFICIAL DE CURVA (decisão do dono, centralizada)
 * ======================================================
 * - Curva A: score >= 70 OU valor ativo >= 1.000.000
 * - Curva B: score >= 40 OU valor ativo >= 200.000
 * - Caso contrário: C
 * - Empresa com status = 'inativa' é SEMPRE Curva C
 *
 * "Valor ativo" = soma de contratos.valor da empresa cuja situação
 * NÃO contenha 'encerr', 'cancel' nem 'rescind' (mesmo critério do Dashboard).
 *
 * ESTE ARQUIVO É A FONTE ÚNICA DA VERDADE no front. O backend (JSVM de hooks
 * PocketBase) não compartilha módulos com o front, por isso os hooks espelham
 * estas MESMAS constantes em pocketbase/hooks/curva_comum.js — altere sempre
 * os dois arquivos juntos.
 */
export const CURVA_CORTE_SCORE_A = 70
export const CURVA_CORTE_SCORE_B = 40
export const CURVA_CORTE_VALOR_A = 1_000_000
export const CURVA_CORTE_VALOR_B = 200_000

export type CurvaLetra = 'A' | 'B' | 'C'

/** Situação de contrato considerado ATIVO (mesmo critério do Dashboard). */
export function contratoSituacaoAtiva(situacao?: string | null): boolean {
  const sit = (situacao || '').toLowerCase()
  return !sit.includes('encerr') && !sit.includes('cancel') && !sit.includes('rescind')
}

/** Situação de contrato INATIVO (encerrado/cancelado/rescindido), para clareza. */
export function contratoSituacaoInativa(situacao?: string | null): boolean {
  return !contratoSituacaoAtiva(situacao)
}

/** Soma dos contratos ativos (critério oficial de "valor ativo"). */
export function somarValorAtivo<
  T extends { situacao?: string | null; valor?: number | string | null },
>(contratos: T[] = []): number {
  return contratos
    .filter((c) => contratoSituacaoAtiva(c.situacao))
    .reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
}

/**
 * FUNÇÃO ÚNICA DE CURVA.
 * @param score      score_relevancia da empresa (0–100)
 * @param valorAtivo soma dos contratos ativos (R$)
 * @param status     status da empresa ('inativa' => sempre C)
 */
export function calcularCurvaOficial(
  score: number | null | undefined,
  valorAtivo: number | null | undefined,
  status?: string | null,
): CurvaLetra {
  if (status === 'inativa') return 'C'
  const s = Number(score) || 0
  const v = Number(valorAtivo) || 0
  if (s >= CURVA_CORTE_SCORE_A || v >= CURVA_CORTE_VALOR_A) return 'A'
  if (s >= CURVA_CORTE_SCORE_B || v >= CURVA_CORTE_VALOR_B) return 'B'
  return 'C'
}
