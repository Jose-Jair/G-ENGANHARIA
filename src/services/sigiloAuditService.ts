/**
 * src/services/sigiloAuditService.ts
 * RODADA 18:
 * Serviços do frontend para consultar dados sensíveis com auditoria imutável de leitura no servidor:
 * - Prestador sensível (dados bancários ocultos para gestor, custo-hora)
 * - Cotação preço ofertado (bloqueado para comercial)
 * - Pré-cotação resposta preço (bloqueado para comercial)
 * - Contrato público valor (bloqueado para executor)
 */

import pb from '@/lib/pocketbase/client'
import type {
  PrestadorSensivelResponse,
  CotacaoPrecoResponse,
  PreCotacaoRespostaPrecoResponse,
  ContratoPublicoValorResponse,
} from '@/types'

export const sigiloAuditService = {
  /**
   * Obtém ficha com dados sensíveis do prestador auditando quem leu
   * Gestor: sem dados bancários (vem null + motivo)
   * Comercial: bloqueado com 403
   */
  async getPrestadorSensivel(id: string): Promise<PrestadorSensivelResponse> {
    try {
      const resp = await pb.send<PrestadorSensivelResponse>(
        `/backend/v1/sigilo/prestador-sensivel/${encodeURIComponent(id)}`,
        { method: 'GET' },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.message || 'Falha ao consultar dados sensíveis do prestador',
      }
    }
  },

  /**
   * Obtém preço ofertado da cotação individual auditando leitura
   * Comercial: bloqueado com 403
   */
  async getCotacaoPreco(id: string): Promise<CotacaoPrecoResponse> {
    try {
      const resp = await pb.send<CotacaoPrecoResponse>(
        `/backend/v1/sigilo/cotacao-preco/${encodeURIComponent(id)}`,
        { method: 'GET' },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.message || 'Falha ao consultar preço de cotação',
      }
    }
  },

  /**
   * Obtém preço ofertado da pré-cotação individual auditando leitura
   * Comercial: bloqueado com 403
   */
  async getPreCotacaoRespostaPreco(id: string): Promise<PreCotacaoRespostaPrecoResponse> {
    try {
      const resp = await pb.send<PreCotacaoRespostaPrecoResponse>(
        `/backend/v1/sigilo/pre-cotacao-resposta-preco/${encodeURIComponent(id)}`,
        { method: 'GET' },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.message || 'Falha ao consultar preço de pré-cotação',
      }
    }
  },

  /**
   * Obtém valor de contrato público com auditoria
   * Executor: bloqueado com 403
   */
  async getContratoPublicoValor(id: string): Promise<ContratoPublicoValorResponse> {
    try {
      const resp = await pb.send<ContratoPublicoValorResponse>(
        `/backend/v1/sigilo/contrato-publico-valor/${encodeURIComponent(id)}`,
        { method: 'GET' },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.message || 'Falha ao consultar valor de contrato público',
      }
    }
  },
}
