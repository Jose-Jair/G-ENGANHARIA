/**
 * src/services/decisoesFilaService.ts
 * RODADA 18:
 * Serviços do frontend para o Painel "Decisões":
 * - Fila única agregada ordenada por impacto decrescente
 * - Fechar decisão com clique e parecer auditado
 * - Listar histórico de ações tomadas
 */

import pb from '@/lib/pocketbase/client'
import type { FilaDecisoesResponse, FecharDecisaoPayload, DecisaoAcaoRecord } from '@/types'

export const decisoesFilaService = {
  /**
   * Obtém a fila agregada de decisões pendentes ordenada por impacto decrescente.
   * Restrita a Admin e Gestor.
   */
  async getFila(): Promise<FilaDecisoesResponse> {
    try {
      const resp = await pb.send<FilaDecisoesResponse>('/backend/v1/decisoes/fila', {
        method: 'GET',
      })
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        itens: [],
        erro: err?.message || 'Falha ao carregar fila de decisões',
      }
    }
  },

  /**
   * Fecha uma decisão com parecer e ação tomada, gravando em decisoes_acoes e audit_logs.
   */
  async fecharDecisao(
    payload: FecharDecisaoPayload,
  ): Promise<{ sucesso: boolean; mensagem?: string; erro?: string }> {
    try {
      const resp = await pb.send<{ sucesso: boolean; mensagem?: string }>(
        '/backend/v1/decisoes/fechar',
        {
          method: 'POST',
          body: payload,
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.message || 'Falha ao registrar decisão',
      }
    }
  },

  /**
   * Lista o histórico de decisões fechadas diretamente da coleção decisoes_acoes
   */
  async listarHistoricoAcoes(limite = 50): Promise<DecisaoAcaoRecord[]> {
    try {
      return await pb
        .collection('decisoes_acoes')
        .getList<DecisaoAcaoRecord>(1, limite, {
          sort: '-created',
        })
        .then((res) => res.items)
    } catch (_) {
      return []
    }
  },
}
