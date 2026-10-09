import pb from '@/lib/pocketbase/client'

// ==========================================
// MÓDULO AVALIAÇÕES DE EXECUTOR (por Subcontrato)
// Coleção nova `avaliacoes_executor` — escrita SOMENTE via endpoint
// POST /backend/v1/avaliacoes-executor/criar (Admin/Gestor, validado no servidor).
// Não confundir com o serviço antigo `avaliacoesService` (avaliação por etapa).
// ==========================================

export interface AvaliacaoExecutorRecord {
  id: string
  numero: string // AVA-AAAA-NNNN
  subcontrato: string
  projeto: string
  executor: string
  avaliado_por: string
  data_avaliacao: string
  nota_prazo: number // 1 a 5
  nota_qualidade: number // 1 a 5
  nota_comunicacao: number // 1 a 5
  nota_ponderada: number // 0.4*prazo + 0.4*qualidade + 0.2*comunicacao (calculado no servidor)
  comentarios?: string
  anexos?: string[]
  created: string
  updated: string
  expand?: {
    subcontrato?: any
    projeto?: any
    executor?: any
    avaliado_por?: any
  }
}

export interface RegistrarAvaliacaoExecutorPayload {
  subcontrato: string
  nota_prazo: number
  nota_qualidade: number
  nota_comunicacao: number
  comentarios?: string
}

export interface RegistrarAvaliacaoExecutorResponse {
  success: boolean
  message: string
  avaliacao: {
    id: string
    numero: string
    nota_ponderada: number
    nota_geral_antes: number
    nota_geral_depois: number
    total_avaliacoes: number
  }
}

export const avaliacoesExecutorService = {
  /**
   * Listar avaliações de executor (coleção nova) de um executor,
   * expandindo subcontrato, projeto e quem avaliou.
   */
  async listByExecutor(executorId: string): Promise<AvaliacaoExecutorRecord[]> {
    return pb.collection('avaliacoes_executor').getFullList<AvaliacaoExecutorRecord>({
      filter: `executor = '${executorId}'`,
      sort: '-created',
      expand: 'subcontrato,projeto,executor,avaliado_por',
    })
  },

  /**
   * Listar todas as avaliações de executor registradas.
   * Requer perfil admin/gestor/comercial (rule da coleção).
   */
  async listAll(): Promise<AvaliacaoExecutorRecord[]> {
    return pb.collection('avaliacoes_executor').getFullList<AvaliacaoExecutorRecord>({
      sort: '-created',
      expand: 'subcontrato,projeto,executor,avaliado_por',
    })
  },

  /**
   * Listar todas as avaliações de executor de um projeto.
   */
  async listByProjeto(projetoId: string): Promise<AvaliacaoExecutorRecord[]> {
    return pb.collection('avaliacoes_executor').getFullList<AvaliacaoExecutorRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
      expand: 'subcontrato,projeto,executor,avaliado_por',
    })
  },

  /**
   * Buscar a avaliação vinculada a um subcontrato (máx. 1 — índice único).
   * Retorna null quando o subcontrato ainda não foi avaliado.
   */
  async getBySubcontrato(subcontratoId: string): Promise<AvaliacaoExecutorRecord | null> {
    try {
      const res = await pb
        .collection('avaliacoes_executor')
        .getList<AvaliacaoExecutorRecord>(1, 1, {
          filter: `subcontrato = '${subcontratoId}'`,
          expand: 'subcontrato,projeto,executor,avaliado_por',
        })
      return res.items.length > 0 ? res.items[0] : null
    } catch (_) {
      return null
    }
  },

  /**
   * Registrar avaliação via endpoint validado no servidor (Admin/Gestor).
   * A nota ponderada é calculada no servidor: 0.4*prazo + 0.4*qualidade + 0.2*comunicacao.
   * Anexos são enviados em seguida via multipart (campo anexos é opcional).
   */
  async registrar(
    payload: RegistrarAvaliacaoExecutorPayload,
    anexos?: File[],
  ): Promise<RegistrarAvaliacaoExecutorResponse> {
    const res = await pb.send('/backend/v1/avaliacoes-executor/criar', {
      method: 'POST',
      body: {
        subcontrato: payload.subcontrato,
        nota_prazo: payload.nota_prazo,
        nota_qualidade: payload.nota_qualidade,
        nota_comunicacao: payload.nota_comunicacao,
        comentarios: payload.comentarios || '',
      },
    })

    if (res?.avaliacao?.id && anexos && anexos.length > 0) {
      try {
        const formData = new FormData()
        for (const file of anexos) {
          formData.append('anexos', file)
        }
        await pb.collection('avaliacoes_executor').update(res.avaliacao.id, formData)
      } catch (errUpload) {
        console.error('Aviso ao anexar arquivos na avaliação do executor:', errUpload)
      }
    }

    return res
  },
}
