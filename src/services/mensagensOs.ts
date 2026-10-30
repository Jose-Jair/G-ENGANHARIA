// =============================================================================
// GESTÃO G+ — SERVIÇO DE MENSAGENS POR ORDEM DE SERVIÇO
// Coleção: mensagens_os
// Regras: Imutabilidade (update/delete negados), restrição estrita por perfil.
// Anexos protegidos (download seguro via file token).
// =============================================================================

import { pb } from '@/lib/pocketbase/client'
import type { MensagemOsRecord, ContadoresMensagensNaoLidasResponse } from '@/types'

export interface EnviarMensagemOsPayload {
  os: string
  texto: string
  autor_tipo: 'interno' | 'prestador'
  autor_usuario?: string
  autor_nome: string
  autor_email?: string
  anexo?: File | Blob
}

export const mensagensOsService = {
  /**
   * Listar histórico de mensagens de uma OS, ordenadas cronologicamente.
   */
  async listarPorOs(osId: string): Promise<MensagemOsRecord[]> {
    if (!osId) return []
    return pb.collection('mensagens_os').getFullList<MensagemOsRecord>({
      filter: `os = "${osId}"`,
      sort: '+created',
      expand: 'autor_usuario',
    })
  },

  /**
   * Enviar nova mensagem dentro do canal da OS.
   * Suporta texto e arquivo anexo opcional (arquivo protegido).
   */
  async enviarMensagem(payload: EnviarMensagemOsPayload): Promise<MensagemOsRecord> {
    const formData = new FormData()
    formData.append('os', payload.os)
    formData.append('texto', payload.texto.trim())
    formData.append('autor_tipo', payload.autor_tipo)
    formData.append('autor_nome', payload.autor_nome)

    if (payload.autor_usuario) {
      formData.append('autor_usuario', payload.autor_usuario)
    }
    if (payload.autor_email) {
      formData.append('autor_email', payload.autor_email)
    }

    if (payload.anexo) {
      formData.append('anexo', payload.anexo)
      if (payload.anexo instanceof File) {
        formData.append('anexo_nome_original', payload.anexo.name)
        formData.append('anexo_tamanho', String(payload.anexo.size))
      }
    }

    return pb.collection('mensagens_os').create<MensagemOsRecord>(formData)
  },

  /**
   * Marcar todas as mensagens de uma OS como lidas para o perfil atual.
   */
  async marcarComoLidas(osId: string): Promise<{
    sucesso: boolean
    os_id: string
    tipo_leitor: string
    total_marcadas_lidas: number
  }> {
    return pb.send(`/backend/v1/ordens-servico/${osId}/mensagens/marcar-lidas`, {
      method: 'POST',
    })
  },

  /**
   * Obter contadores de mensagens não lidas por OS (badge para Gestor e Prestador).
   */
  async obterContadoresNaoLidas(): Promise<ContadoresMensagensNaoLidasResponse> {
    return pb.send('/backend/v1/ordens-servico/contadores-mensagens-nao-lidas', {
      method: 'GET',
    })
  },
}
