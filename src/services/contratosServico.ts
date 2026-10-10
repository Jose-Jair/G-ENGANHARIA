import pb from '@/lib/pocketbase/client'
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

export interface ObterContratoComplementoResponse {
  success: boolean
  contrato: {
    id: string
    numero: string
    objeto: string
    valor_total: number
    prazo_dias?: number
    status: StatusContratoServico
    token_assinatura_cliente?: string
    campos_faltantes?: string[]
    dados_completados_em?: string
  }
  tipo_cliente: 'pf' | 'pj'
  dados_cliente: {
    razao_social?: string
    nome?: string
    nome_fantasia?: string
    cnpj?: string
    cpf?: string
    email?: string
    telefone?: string
    telefones?: any[]
    cep?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    municipio?: string
    uf?: string
    porte?: string
  }
  representante?: {
    nome: string
    documento: string
  }
}

export interface ComplementarDadosPayload {
  token_complemento_dados: string
  razao_social?: string
  nome?: string
  nome_fantasia?: string
  cnpj?: string
  cpf?: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  municipio: string
  uf: string
  representante_nome?: string
  representante_documento?: string
}

export const contratosServicoService = {
  async getByProposta(propostaId: string): Promise<ContratoServicoRecord | null> {
    try {
      const records = await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
        filter: `proposta = "${propostaId}"`,
        sort: '-created',
        expand: 'proposta,projeto,empresa,cliente_pf,assinante_admin',
        requestKey: null,
      })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar contrato por proposta:', err)
      return null
    }
  },

  async getByProjeto(projetoId: string): Promise<ContratoServicoRecord | null> {
    try {
      const records = await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
        filter: `projeto = "${projetoId}"`,
        sort: '-created',
        expand: 'proposta,projeto,empresa,cliente_pf,assinante_admin',
        requestKey: null,
      })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar contrato por projeto:', err)
      return null
    }
  },

  async getById(id: string): Promise<ContratoServicoRecord> {
    return await pb.collection('contratos_servico').getOne<ContratoServicoRecord>(id, {
      expand: 'proposta,projeto,empresa,cliente_pf,assinante_admin',
      requestKey: null,
    })
  },

  async getByToken(token: string): Promise<ContratoServicoRecord | null> {
    if (!token) return null
    try {
      // 1. Tenta buscar via endpoint público dedicado do backend (garante bypass seguro de RLS para clientes anônimos)
      const res = await pb.send<ContratoServicoRecord>(
        `/backend/v1/contratos-servico/obter-por-token/${encodeURIComponent(token)}`,
        {
          method: 'GET',
        },
      )
      if (res && res.id) {
        return res
      }
    } catch (errEndpoint) {
      console.warn(
        'Endpoint público de contrato retornou erro ou não disponível, tentando fallback direto:',
        errEndpoint,
      )
    }

    try {
      // 2. Fallback direto via SDK do PocketBase com headers de token
      const records = await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
        filter: `token_assinatura_cliente = "${token}"`,
        expand: 'proposta,empresa,cliente_pf,assinante_admin',
        requestKey: null,
        token: token,
        headers: {
          'x-token-assinatura': token,
          'x-token-assinatura-cliente': token,
        },
      } as any)
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar contrato por token (fallback):', err)
      return null
    }
  },

  /**
   * Bloco 3: Busca dados do contrato e cadastro via token de complemento de dados
   */
  async getPorTokenComplemento(token: string): Promise<ObterContratoComplementoResponse> {
    return await pb.send<ObterContratoComplementoResponse>(
      `/backend/v1/contratos-servico/obter-por-token-complemento?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Bloco 3: Salva o complemento de dados pelo cliente
   */
  async complementarDados(payload: ComplementarDadosPayload): Promise<{
    success: boolean
    message: string
    contrato_numero: string
    status: string
    token_assinatura_cliente?: string
    token_complemento_dados?: string
    contrato?: any
  }> {
    return await pb.send('/backend/v1/contratos-servico/complementar-dados', {
      method: 'POST',
      body: payload,
    })
  },

  async listAll(status?: StatusContratoServico): Promise<ContratoServicoRecord[]> {
    let filter = ''
    if (status) {
      filter = `status = "${status}"`
    }
    return await pb.collection('contratos_servico').getFullList<ContratoServicoRecord>({
      filter,
      sort: '-created',
      expand: 'proposta,projeto,empresa,cliente_pf,assinante_admin',
      requestKey: null,
    })
  },

  async getAll(): Promise<ContratoServicoRecord[]> {
    return this.listAll()
  },

  async updateClausulas(id: string, clausulasTexto: string): Promise<ContratoServicoRecord> {
    const updated = await pb.collection('contratos_servico').update<ContratoServicoRecord>(id, {
      clausulas_texto: clausulasTexto,
    })
    await auditService.log({
      action: 'ATUALIZACAO_CONTRATO_SERVICO',
      entity_type: 'contratos_servico',
      entity_id: id,
      details: {
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
   * Registra envio do link de assinatura do contrato via WhatsApp com auditoria
   */
  async registrarEnvioWhatsApp(params: {
    contratoId: string
    telefone: string
    destinatarioNome: string
    mensagem: string
  }): Promise<void> {
    await auditService.log({
      action: 'ENVIO_CONTRATO_WHATSAPP',
      entity_type: 'contratos_servico',
      entity_id: params.contratoId,
      details: {
        canal: 'whatsapp',
        telefone: params.telefone,
        destinatario: params.destinatarioNome,
        mensagem_preview: params.mensagem.substring(0, 160),
        disparado_em: new Date().toISOString(),
      },
    })
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
      action: 'UPLOAD_PDF_CONTRATO_ASSINADO',
      entity_type: 'contratos_servico',
      entity_id: contratoId,
      details: {
        mensagem: `Arquivo PDF assinado anexado ao contrato (${file.name})`,
        tamanho: file.size,
      },
    })
    return updated
  },
}
