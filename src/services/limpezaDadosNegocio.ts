import pb from '@/lib/pocketbase/client'
import {
  FRASE_CONFIRMACAO_LIMPEZA,
  COLECOES_NEGOCIO_ORDEM_LIMPEZA,
  COLECOES_PRESERVADAS,
} from './limpezaDadosNegocioConstants'

export interface LimpezaResultadoResponse {
  success: boolean
  message?: string
  error?: string
  total_apagados?: number
  apagados_por_colecao?: Record<string, number>
  preservados_conferencia?: Record<string, number>
  executado_em?: string
  executado_por?: string
  detalhes_parciais?: {
    total_apagados_ate_falha: number
    apagados_por_colecao: Record<string, number>
  }
}

/**
 * Dispara a execução da limpeza de dados de negócio no backend sob /backend/v1/sistema/limpeza-dados-negocio.
 * Requer autenticação do Admin e a frase expressa de confirmação.
 */
export async function executarLimpezaDadosNegocio(
  fraseConfirmacao: string,
): Promise<LimpezaResultadoResponse> {
  const token = pb.authStore.token
  if (!token) {
    throw new Error('Sessão expirada ou usuário não autenticado.')
  }

  const baseUrl = (pb.baseUrl || '').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/backend/v1/sistema/limpeza-dados-negocio`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      confirmacao: fraseConfirmacao,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMsg =
      data.error ||
      data.message ||
      `Falha na requisição (${response.status}: ${response.statusText})`
    const err = new Error(errorMsg)
    // Anexa detalhes parciais caso existam
    ;(err as unknown as { detalhes?: unknown }).detalhes = data.detalhes_parciais
    throw err
  }

  return data as LimpezaResultadoResponse
}

export { FRASE_CONFIRMACAO_LIMPEZA, COLECOES_NEGOCIO_ORDEM_LIMPEZA, COLECOES_PRESERVADAS }
