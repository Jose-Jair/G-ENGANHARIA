import pb from '@/lib/pocketbase/client'
import { PreCotacaoRecord, PreCotacaoRespostaPortalRecord, PropostaItemRecord } from '@/types'

export interface AbrirPreCotacaoResponse {
  success: boolean
  sem_elegiveis: boolean
  pre_cotacao_id: string
  codigo: string
  disciplina?: string
  total_convidados?: number
  convidados?: string[]
  data_limite?: string
  origem_custo?: string
  mensagem?: string
  link_recrutamento?: string
}

export interface ConsultaPreCotacoesItemResponse {
  existe: boolean
  total?: number
  pre_cotacoes: PreCotacaoRecord[]
}

export interface ResponderPreCotacaoPayload {
  preco_ofertado: number
  prazo_ofertado_dias: number
  premissas?: string
  observacoes?: string
  aceite_vinculante: boolean
}

export interface ResponderPreCotacaoResponse {
  success: boolean
  mensagem: string
  resposta_id: string
  codigo_pre_cotacao: string
  aceite_hash: string
  status: string
}

export interface EscolherPreCotacaoResponse {
  success: boolean
  mensagem: string
  codigo_pre_cotacao: string
  preco_travado: number
  prazo_travado_dias: number
  prestador_vencedor_id: string
  total_prestadores_liberados: number
}

export interface EditarCustoAuditadoPayload {
  novo_custo_total: number
  motivo_edicao_custo?: string
}

export interface EditarCustoAuditadoResponse {
  success: boolean
  mensagem: string
  item_id: string
  origem_custo: string
  custo_total: number
  motivo_edicao_custo: string
}

export const preCotacaoService = {
  /**
   * Abre pré-cotação vinculante para um item de proposta
   * Gera código PRE-AAAA-NNNN, anonimiza escopo e convida até N elegíveis.
   * Se não houver elegíveis, marca origem_custo='sem_cotacao' e alerta recrutamento.
   */
  async abrir(propostaId: string, itemId: string): Promise<AbrirPreCotacaoResponse> {
    return await pb.send<AbrirPreCotacaoResponse>(
      `/backend/v1/propostas/${propostaId}/itens/${itemId}/pre-cotacao/abrir`,
      {
        method: 'POST',
      },
    )
  },

  /**
   * Abre pré-cotação para todos os itens da proposta que ainda não possuem custo cotado
   */
  async abrirTodos(
    propostaId: string,
    itens: PropostaItemRecord[],
  ): Promise<{
    sucessos: AbrirPreCotacaoResponse[]
    semElegiveis: AbrirPreCotacaoResponse[]
    erros: string[]
  }> {
    const sucessos: AbrirPreCotacaoResponse[] = []
    const semElegiveis: AbrirPreCotacaoResponse[] = []
    const erros: string[] = []

    for (const it of itens) {
      if (!it.id) continue
      // Se já tem preço travado por pré-cotação ou vencedor, pode pular ou tentar de novo
      if (it.origem_custo === 'pre_cotacao' && it.preco_travado) {
        continue
      }
      try {
        const res = await this.abrir(propostaId, it.id)
        if (res.sem_elegiveis) {
          semElegiveis.push(res)
        } else {
          sucessos.push(res)
        }
      } catch (err: any) {
        erros.push(`Item "${it.descricao}": ${err.message || 'Falha ao abrir'}`)
      }
    }

    return { sucessos, semElegiveis, erros }
  },

  /**
   * Consulta histórico de pré-cotações e respostas abertas para um item da proposta
   */
  async getByItem(itemId: string): Promise<ConsultaPreCotacoesItemResponse> {
    return await pb.send<ConsultaPreCotacoesItemResponse>(
      `/backend/v1/pre-cotacoes/item/${itemId}`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Gestor ou Admin escolhe a resposta vencedora
   * Atualiza o item: origem_custo='pre_cotacao', preco_travado, prazo_travado_dias, prestador_vencedor
   * Trava a vencedora e libera concorrentes sem citar detalhes
   */
  async escolherVencedor(
    preCotacaoId: string,
    respostaId: string,
  ): Promise<EscolherPreCotacaoResponse> {
    return await pb.send<EscolherPreCotacaoResponse>(
      `/backend/v1/pre-cotacoes/${preCotacaoId}/escolher`,
      {
        method: 'POST',
        body: { resposta_id: respostaId },
      },
    )
  },

  /**
   * Edita o custo de um item da proposta.
   * Se a origem atual for 'pre_cotacao', o motivo_edicao_custo é OBRIGATÓRIO (mínimo 5 chars),
   * mudando a origem para 'manual_auditado'.
   */
  async editarCustoAuditado(
    propostaId: string,
    itemId: string,
    payload: EditarCustoAuditadoPayload,
  ): Promise<EditarCustoAuditadoResponse> {
    return await pb.send<EditarCustoAuditadoResponse>(
      `/backend/v1/propostas/${propostaId}/itens/${itemId}/editar-custo-auditado`,
      {
        method: 'POST',
        body: payload,
      },
    )
  },

  // ---------------------------------------------------------------------------
  // PORTAL DO PRESTADOR
  // ---------------------------------------------------------------------------

  /**
   * Lista as oportunidades de pré-cotação direcionadas ao prestador autenticado
   * Protegido por API rules no PocketBase: prestador.email = @request.auth.email
   */
  async listMinhasPreCotacoes(): Promise<PreCotacaoRespostaPortalRecord[]> {
    return await pb
      .collection('pre_cotacao_respostas')
      .getFullList<PreCotacaoRespostaPortalRecord>({
        sort: '-created',
        requestKey: null,
      })
  },

  /**
   * Prestador envia resposta vinculante através do Portal
   * Registra preço, prazo, premissas, observações e grava hash SHA-256 com IP/timestamp
   */
  async responderPortal(
    respostaId: string,
    payload: ResponderPreCotacaoPayload,
  ): Promise<ResponderPreCotacaoResponse> {
    return await pb.send<ResponderPreCotacaoResponse>(
      `/backend/v1/portal-prestador/pre-cotacoes/${respostaId}/responder`,
      {
        method: 'POST',
        body: payload,
      },
    )
  },
}
