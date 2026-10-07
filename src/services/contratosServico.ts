import { pb } from '@/lib/pocketbase/client'
import { ContratoServicoRecord, StatusContratoServico, ContratoServicoParcela } from '@/types'
import { auditService } from '@/services/audit'

export interface CreateContratoServicoData {
  proposta: string
  empresa?: string
  cliente_pf?: string
  objeto: string
  valor_total: number
  prazo_dias?: number
  nota_prazo?: string
  clausulas_texto?: string
  parcelas_json?: ContratoServicoParcela[]
}

export interface AssinarContratoClientePayload {
  token_assinatura_cliente: string
  declaracao: boolean
  nome_assinante: string
  documento_assinante: string
}

export const contratosServicoService = {
  async getByProposta(propostaId: string): Promise<ContratoServicoRecord | null> {
    try {
      const records = await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
        filter: `proposta = "${propostaId}"`,
        sort: '-created',
        expand: 'proposta,empresa,cliente_pf,assinante_admin',
        requestKey: null,
      })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar contrato por proposta:', err)
      return null
    }
  },

  async getById(id: string): Promise<ContratoServicoRecord> {
    return await pb.collection('contratos_servico').getOne<ContratoServicoRecord>(id, {
      expand: 'proposta,empresa,cliente_pf,assinante_admin',
      requestKey: null,
    })
  },

  async getByToken(token: string): Promise<ContratoServicoRecord | null> {
    try {
      const records = await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
        filter: `token_assinatura_cliente = "${token}"`,
        expand: 'proposta,empresa,cliente_pf,assinante_admin',
        requestKey: null,
      })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar contrato por token:', err)
      return null
    }
  },

  async listAll(status?: StatusContratoServico): Promise<ContratoServicoRecord[]> {
    let filter = ''
    if (status) {
      filter = `status = "${status}"`
    }
    return await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
      filter,
      sort: '-created',
      expand: 'proposta,empresa,cliente_pf,assinante_admin',
      requestKey: null,
    })
  },

  async updateClausulas(id: string, clausulasTexto: string): Promise<ContratoServicoRecord> {
    const updated = await pb.collection('contratos_servico').update<ContratoServicoRecord>(id, {
      clausulas_texto: clausulasTexto,
    })
    await auditService.log({
      acao: 'ATUALIZACAO_CONTRATO_SERVICO',
      entidade: 'contratos_servico',
      registro_id: id,
      detalhes: {
        mensagem: 'Cláusulas do contrato de serviços atualizadas',
      },
    })
    return updated
  },

  /**
   * Assinatura eletrônica pelo Administrador (autenticado)
   */
  async assinarComoAdmin(contratoId: string, declaracao: boolean): Promise<any> {
    const res = await pb.send('/backend/v1/contratos-servico/assinar-admin', {
      method: 'POST',
      body: {
        contrato_id: contratoId,
        declaracao,
      },
    })
    return res
  },

  /**
   * Assinatura eletrônica pelo Cliente através do link com token público
   */
  async assinarComoCliente(payload: AssinarContratoClientePayload): Promise<any> {
    const res = await pb.send('/backend/v1/contratos-servico/assinar-cliente', {
      method: 'POST',
      body: payload,
    })
    return res
  },

  /**
   * Upload de arquivo PDF final assinado
   */
  async uploadPdfAssinado(contratoId: string, file: File): Promise<ContratoServicoRecord> {
    const formData = new FormData()
    formData.append('arquivo_pdf_assinado', file)
    const updated = await pb
      .collection('contratos_servico')
      .update<ContratoServicoRecord>(contratoId, formData)
    await auditService.log({
      acao: 'UPLOAD_PDF_CONTRATO_ASSINADO',
      entidade: 'contratos_servico',
      registro_id: contratoId,
      detalhes: {
        mensagem: `Arquivo PDF assinado anexado ao contrato (${file.name})`,
        tamanho: file.size,
      },
    })
    return updated
  },
}
