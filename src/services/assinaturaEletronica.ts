// src/services/assinaturaEletronica.ts
// =============================================================================
// GESTÃO G+ — SERVIÇO DE ASSINATURA ELETRÔNICA JURÍDICA E DOSSIÊ DE EVIDÊNCIAS
// Padrão MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020
// =============================================================================

import pb from '@/lib/pocketbase/client'

export const CLÁUSULA_ACEITE_ELETRONICO_PADRAO =
  'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta formalização realizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como válidas as assinaturas eletrônicas emitidas mediante verificação de código OTP de 6 dígitos enviado por e-mail, registro de endereço IP, user-agent, carimbo de tempo UTC e hash criptográfico SHA-256 do documento congelado.'

export interface SolicitarCodigoOtpResponse {
  sucesso: boolean
  mensagem: string
  email_mascarado?: string
  expira_em?: string
  error?: string
}

export interface AssinarOrdemServicoPayload {
  token?: string
  codigo_otp: string
  nome: string
  documento: string
  declaracao: boolean
}

export interface DossiêEvidenciasOSResponse {
  documento_tipo: string
  id: string
  numero: string
  projeto_codigo?: string
  prestador_nome?: string
  prestador_documento?: string
  tipo_prestador: 'interno' | 'externo'
  valor_os: number
  status: string
  aceite_status: 'pendente' | 'aguardando_codigo' | 'aceito' | 'recusado'
  data_aceite?: string
  aceite_ip?: string
  aceite_user_agent?: string
  pdf_congelado_hash?: string
  versao_texto_hash?: string
  versao_texto_aceito?: string
  assinante_prestador_nome?: string
  assinante_prestador_doc?: string
  dossie_evidencias_json?: any
  confirmacao_email_enviada?: boolean
  error?: string
}

export const assinaturaEletronicaService = {
  /**
   * Solicita o envio de código OTP de 6 dígitos para o e-mail do signatário da OS
   */
  async solicitarCodigoOS(osId: string, token?: string): Promise<SolicitarCodigoOtpResponse> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/solicitar-codigo-aceite`, {
      method: 'POST',
      body: { token },
    })
  },

  /**
   * Assina Ordem de Serviço com validação do código OTP de 6 dígitos
   */
  async assinarOS(osId: string, payload: AssinarOrdemServicoPayload): Promise<any> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/assinar-prestador`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Formaliza aceite simplificado de OS interna (sem código e sem camada financeira)
   */
  async aceiteInternoOS(osId: string): Promise<any> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/aceite-interno`, {
      method: 'POST',
    })
  },

  /**
   * Obtém o Dossiê de Evidências Digitais da Ordem de Serviço (restrito Admin e Gestor)
   */
  async getDossieOS(osId: string): Promise<DossiêEvidenciasOSResponse> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/dossie-evidencias`, {
      method: 'GET',
    })
  },

  /**
   * Obtém o Dossiê de Evidências Digitais do Contrato-Mestre (restrito Admin e Gestor)
   */
  async getDossieContratoMestre(cmId: string): Promise<any> {
    return pb.send(`/backend/v1/contratos-mestre/${cmId}/dossie-evidencias`, {
      method: 'GET',
    })
  },

  /**
   * Obtém o Dossiê de Evidências Digitais do Contrato de Serviço (restrito Admin e Gestor)
   */
  async getDossieContratoServico(csId: string): Promise<any> {
    return pb.send(`/backend/v1/contratos-servico/dossie-evidencias/${csId}`, {
      method: 'GET',
    })
  },
}
