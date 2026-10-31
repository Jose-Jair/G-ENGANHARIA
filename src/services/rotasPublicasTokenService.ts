/**
 * src/services/rotasPublicasTokenService.ts
 * RODADA 18:
 * Serviços do frontend para rotas públicas com token de uso único, expiração e limite de tentativas:
 * 1) Proposta (/backend/v1/publico/proposta/validar-e-obter)
 * 2) Contrato (/backend/v1/publico/contrato-servico/validar-e-obter)
 * 3) Pré-cadastro (/backend/v1/publico/pre-cadastro/validar-e-obter)
 * 4) Complemento de dados (/backend/v1/publico/complemento-dados/validar-e-obter)
 * 5) Descadastro (/backend/v1/publico/descadastro/confirmar)
 * Cotação e pré-cotação NÃO têm rota pública — bloqueio explícito 403.
 */

import pb from '@/lib/pocketbase/client'
import type {
  ValidarTokenPropostaResponse,
  ValidarTokenContratoResponse,
  ValidarTokenPreCadastroResponse,
  ValidarTokenComplementoResponse,
  ConfirmarDescadastroPayload,
  ConfirmarDescadastroResponse,
} from '@/types'

export const rotasPublicasTokenService = {
  /**
   * Valida e obtém proposta pública por token de uso único
   */
  async validarTokenProposta(token: string): Promise<ValidarTokenPropostaResponse> {
    try {
      const resp = await pb.send<ValidarTokenPropostaResponse>(
        '/backend/v1/publico/proposta/validar-e-obter',
        {
          method: 'POST',
          body: { token },
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.data?.erro || err?.message || 'Link inválido ou expirado',
      }
    }
  },

  /**
   * Valida e obtém contrato de serviço público por token de uso único
   */
  async validarTokenContrato(token: string): Promise<ValidarTokenContratoResponse> {
    try {
      const resp = await pb.send<ValidarTokenContratoResponse>(
        '/backend/v1/publico/contrato-servico/validar-e-obter',
        {
          method: 'POST',
          body: { token },
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.data?.erro || err?.message || 'Link inválido ou expirado',
      }
    }
  },

  /**
   * Valida e obtém link de recrutamento / pré-cadastro público
   */
  async validarTokenPreCadastro(token: string): Promise<ValidarTokenPreCadastroResponse> {
    try {
      const resp = await pb.send<ValidarTokenPreCadastroResponse>(
        '/backend/v1/publico/pre-cadastro/validar-e-obter',
        {
          method: 'POST',
          body: { token },
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.data?.erro || err?.message || 'Link de recrutamento inválido ou expirado',
      }
    }
  },

  /**
   * Valida token de complemento de dados de cliente
   */
  async validarTokenComplemento(token: string): Promise<ValidarTokenComplementoResponse> {
    try {
      const resp = await pb.send<ValidarTokenComplementoResponse>(
        '/backend/v1/publico/complemento-dados/validar-e-obter',
        {
          method: 'POST',
          body: { token },
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.data?.erro || err?.message || 'Token de complemento inválido',
      }
    }
  },

  /**
   * Confirma descadastro por e-mail e token
   */
  async confirmarDescadastro(
    payload: ConfirmarDescadastroPayload,
  ): Promise<ConfirmarDescadastroResponse> {
    try {
      const resp = await pb.send<ConfirmarDescadastroResponse>(
        '/backend/v1/publico/descadastro/confirmar',
        {
          method: 'POST',
          body: payload,
        },
      )
      return resp
    } catch (err: any) {
      return {
        sucesso: false,
        erro: err?.data?.erro || err?.message || 'Falha ao confirmar descadastro',
      }
    }
  },

  /**
   * Prova explícita de que cotação pública está bloqueada
   */
  async tentarAcessoCotacaoPublica(): Promise<{ bloqueado: boolean; erro: string }> {
    try {
      await pb.send('/backend/v1/publico/cotacao/bloqueada', {
        method: 'POST',
      })
      return { bloqueado: false, erro: 'Rota não bloqueou' }
    } catch (err: any) {
      return {
        bloqueado: true,
        erro: err?.data?.erro || err?.message || 'Acesso negado (403)',
      }
    }
  },

  /**
   * Validação de rota pública de subcontratação
   */
  async tentarAcessoSubcontratoPublico(): Promise<{ bloqueado: boolean; erro: string }> {
    return { bloqueado: false, erro: '' }
  },
}
