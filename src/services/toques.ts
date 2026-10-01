import pb from '@/lib/pocketbase/client'
import { ToqueRecord, ToqueComCalculo, StatusVisualToque, ModeloRecord } from '@/types'

export interface ConfirmarToquePayload {
  toque_id: string
  data_realizada: string
  canal: string
  resultado: string
  observacao: string
  desvio?: 'sem_resposta' | 'resposta_positiva' | 'recusa' | 'contato_invalido' | 'resposta_neutra'
  acao_recusa?: 'nutricao' | 'inativa'
  motivo_inativacao?: string
}

export interface EnviarEmailToquePayload {
  toque_id: string
  empresa_id: string
  destinatario_email: string
  destinatario_nome?: string
  custom_descadastro_url?: string
}

export const toquesService = {
  /**
   * Lista todos os toques de uma empresa ordenados por número (1 a 5)
   */
  async getByEmpresa(empresaId: string): Promise<ToqueRecord[]> {
    return await pb.collection('toques').getFullList<ToqueRecord>({
      filter: `empresa = "${empresaId}"`,
      sort: 'numero_toque',
      expand: 'empresa',
    })
  },

  /**
   * Lista toques ativos do sistema (expandindo empresa e contatos)
   */
  async listAtivos(): Promise<ToqueRecord[]> {
    return await pb.collection('toques').getFullList<ToqueRecord>({
      filter: 'status != "cancelado"',
      sort: 'numero_toque',
      expand: 'empresa',
    })
  },

  /**
   * Criação manual de toque se necessário
   */
  async create(data: Partial<ToqueRecord>): Promise<ToqueRecord> {
    return await pb.collection('toques').create<ToqueRecord>(data)
  },

  /**
   * Atualização de toque
   */
  async update(id: string, data: Partial<ToqueRecord>): Promise<ToqueRecord> {
    return await pb.collection('toques').update<ToqueRecord>(id, data)
  },

  /**
   * Cancelamento de toque com motivo
   */
  async cancelar(id: string, observacao: string): Promise<ToqueRecord> {
    return await pb.collection('toques').update<ToqueRecord>(id, {
      status: 'cancelado',
      observacao,
    })
  },

  /**
   * Envia e-mail da cadência pelo endpoint do servidor com substituição e descadastro
   */
  async enviarEmailCadencia(payload: EnviarEmailToquePayload): Promise<{
    success: boolean
    message: string
    destinatario?: string
    assunto?: string
    corpo?: string
    link_descadastro?: string
  }> {
    const res = await pb.send('/backend/v1/cadencia/enviar-email', {
      method: 'POST',
      body: payload,
    })
    return res
  },

  /**
   * Confirmação sequencial de toque com desvios pelo servidor
   */
  async confirmarToque(payload: ConfirmarToquePayload): Promise<{
    success: boolean
    message: string
  }> {
    const res = await pb.send('/backend/v1/cadencia/confirmar-toque', {
      method: 'POST',
      body: payload,
    })
    return res
  },

  /**
   * Dispara criação de cadência para empresa (movendo no funil ou gerando toques)
   */
  async iniciarCadencia(empresaId: string): Promise<void> {
    await pb.collection('empresas').update(empresaId, {
      etapa_funil: 'em_cadencia',
    })
  },

  /**
   * Regra 4 e 3: CÁLCULO DINÂMICO DE STATUS DO TOQUE AO ABRIR O SISTEMA
   * "Para hoje" = data_prevista == hoje e anterior confirmado;
   * "Em atraso" = data_prevista < hoje e anterior confirmado;
   * "bloqueado" = se anterior não confirmado (status visual 'aguardando confirmação');
   * "agendado" = data_prevista > hoje e anterior confirmado.
   * Tolerância de atraso crítico do Admin (parâmetro default 5 dias).
   */
  calcularStatusToques(
    toquesDaEmpresa: ToqueRecord[],
    diasLimiteAtrasoAdmin = 5,
  ): ToqueComCalculo[] {
    const sorted = [...toquesDaEmpresa].sort((a, b) => a.numero_toque - b.numero_toque)
    const hojeStr = new Date().toISOString().substring(0, 10)
    const hojeDate = new Date(hojeStr + 'T00:00:00')

    const resultado: ToqueComCalculo[] = []

    for (let i = 0; i < sorted.length; i++) {
      const toque = sorted[i]
      const anterior = i > 0 ? sorted[i - 1] : null
      const anteriorConfirmado =
        !anterior || anterior.status === 'realizado' || anterior.status === 'respondido'

      let statusCalc: StatusVisualToque = 'agendado'
      let isLiberado = false
      let diasAtraso = 0
      let isCritico = false

      if (toque.status === 'realizado') {
        statusCalc = 'realizado'
      } else if (toque.status === 'respondido') {
        statusCalc = 'respondido'
      } else if (toque.status === 'cancelado') {
        statusCalc = 'cancelado'
      } else if (!anteriorConfirmado) {
        // Bloqueado aguardando confirmação do anterior
        statusCalc = 'bloqueado'
        isLiberado = false
      } else {
        // Anterior está confirmado, este é o próximo toque ativo
        isLiberado = true
        const prevStr = toque.data_prevista ? toque.data_prevista.substring(0, 10) : hojeStr
        const prevDate = new Date(prevStr + 'T00:00:00')
        const diffMs = hojeDate.getTime() - prevDate.getTime()
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDias === 0) {
          statusCalc = 'para_hoje'
        } else if (diffDias > 0) {
          statusCalc = 'em_atraso'
          diasAtraso = diffDias
          if (diffDias >= diasLimiteAtrasoAdmin) {
            isCritico = true
          }
        } else {
          statusCalc = 'agendado'
        }
      }

      resultado.push({
        ...toque,
        statusCalculado: statusCalc,
        isLiberadoParaExecucao: isLiberado,
        diasAtraso,
        isCriticoAdmin: isCritico,
      })
    }

    return resultado
  },

  /**
   * Prepara URL do WhatsApp com mensagem pronta
   */
  montarWhatsAppUrl(params: {
    telefone: string
    modelo: ModeloRecord | null
    nomeContato: string
    nomeEmpresa: string
    orgao: string
    valorContrato: string
  }): string {
    const rawTel = (params.telefone || '').replace(/\D/g, '')
    const telFinal = rawTel.startsWith('55') ? rawTel : `55${rawTel}`

    let texto = ''
    if (params.modelo?.corpo) {
      texto = params.modelo.corpo
        .replace(/\{nome\}/g, params.nomeContato || 'Prezado(a)')
        .replace(/\{orgao\}/g, params.orgao || 'órgão contratante')
        .replace(/\{valor_contrato\}/g, params.valorContrato || '0,00')
        // Em WhatsApp não há necessidade de link de descadastro
        .replace(/\n*---\n*Caso não deseje mais[\s\S]*\{link_descadastro\}/g, '')
        .replace(/\{link_descadastro\}/g, '')
    } else {
      texto = `Olá, ${params.nomeContato || 'tudo bem'}? Entramos em contato referente às demandas de engenharia do contrato com ${params.orgao}.`
    }

    return `https://wa.me/${telFinal}?text=${encodeURIComponent(texto.trim())}`
  },
}
