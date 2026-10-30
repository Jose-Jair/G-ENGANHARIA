// =============================================================================
// GESTÃO G+ — SERVIÇO DE COMENTÁRIOS DE REVISÃO E "O QUE MUDOU"
// Coleção: entregavel_comentarios
// Endpoint: /backend/v1/entregaveis/{id}/o-que-mudou
// =============================================================================

import { pb } from '@/lib/pocketbase/client'
import type { EntregavelComentarioRecord, ComparacaoOQueMudouResponse } from '@/types'

export interface CriarComentarioVersaoPayload {
  versao: string
  texto: string
  autor_tipo: 'interno' | 'prestador'
  autor_usuario?: string
  autor_nome: string
  autor_email?: string
}

export const entregavelComentariosService = {
  /**
   * Listar comentários de revisão de uma versão do entregável.
   */
  async listarPorVersao(versaoId: string): Promise<EntregavelComentarioRecord[]> {
    if (!versaoId) return []
    return pb.collection('entregavel_comentarios').getFullList<EntregavelComentarioRecord>({
      filter: `versao = "${versaoId}"`,
      sort: '+created',
      expand: 'autor_usuario',
    })
  },

  /**
   * Publicar comentário de revisão em uma versão de entregável.
   */
  async criarComentario(
    payload: CriarComentarioVersaoPayload,
  ): Promise<EntregavelComentarioRecord> {
    return pb.collection('entregavel_comentarios').create<EntregavelComentarioRecord>({
      versao: payload.versao,
      texto: payload.texto.trim(),
      autor_tipo: payload.autor_tipo,
      autor_usuario: payload.autor_usuario || null,
      autor_nome: payload.autor_nome,
      autor_email: payload.autor_email || null,
    })
  },

  /**
   * Obter comparativo "O que mudou" entre versões do entregável.
   * Não compara binário de arquivo: compara metadados, autores, datas, arquivos e comentários.
   */
  async obterOQueMudou(
    entregavelId: string,
    vAtual?: number,
    vAnterior?: number,
  ): Promise<ComparacaoOQueMudouResponse> {
    let url = `/backend/v1/entregaveis/${entregavelId}/o-que-mudou`
    const params = new URLSearchParams()
    if (vAtual !== undefined) params.set('v_atual', String(vAtual))
    if (vAnterior !== undefined) params.set('v_anterior', String(vAnterior))

    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }

    const res = await pb.send<{ sucesso: boolean; comparacao: ComparacaoOQueMudouResponse }>(url, {
      method: 'GET',
    })

    return res.comparacao
  },
}
