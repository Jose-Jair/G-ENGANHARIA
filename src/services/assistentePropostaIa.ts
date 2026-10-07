import pb from '@/lib/pocketbase/client'

export interface SugestaoItemIa {
  descricao: string
  disciplina?: string
  unidade?: string
  quantidade?: number
  preco_venda_unitario?: number
  custo_unitario?: number
  subservicos?: string[]
  origem?: 'catalogo' | 'avulso'
  area_id?: string
}

export interface SugestaoParcelaIa {
  ordem?: number
  percentual: number
  gatilho?: 'contratacao' | 'entrega' | 'marco'
  descricao: string
}

export interface SugestaoPropostaIa {
  empreendimento?: string
  municipio?: string
  uf?: string
  area_m2?: number
  prazo_dias?: number
  requer_nota?: boolean
  impostos_percent?: number
  margem_percent?: number
  objeto?: string
  escopo?: string
  premissas?: string
  itens?: SugestaoItemIa[]
  entregaveis?: string
  parcelas?: SugestaoParcelaIa[]
}

export interface RespostaAssistenteIa {
  conversation_id: string | null
  content: string
  citations?: any[]
  message_id?: string
  sugestaoEstruturada: SugestaoPropostaIa | null
}

/**
 * Extrai o bloco JSON contido no texto da resposta do Assistente IA
 */
export function extrairJsonDaResposta(texto: string): SugestaoPropostaIa | null {
  if (!texto) return null

  // Tentar encontrar bloco ```json ... ```
  const matchBloco = texto.match(/```json\s*([\s\S]*?)\s*```/i)
  if (matchBloco && matchBloco[1]) {
    try {
      return JSON.parse(matchBloco[1])
    } catch (err) {
      console.warn('Falha ao parsear JSON do bloco ```json:', err)
    }
  }

  // Tentar encontrar bloco genérico ``` ... ```
  const matchBlocoGenerico = texto.match(/```\s*([\s\S]*?)\s*```/i)
  if (matchBlocoGenerico && matchBlocoGenerico[1]) {
    const raw = matchBlocoGenerico[1].trim()
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        return JSON.parse(raw)
      } catch {
        /* intentionally ignored */
      }
    }
  }

  // Fallback: primeira ocorrência de { ... }
  const inicioJson = texto.indexOf('{')
  const fimJson = texto.lastIndexOf('}')
  if (inicioJson !== -1 && fimJson > inicioJson) {
    try {
      const possivelJson = texto.substring(inicioJson, fimJson + 1)
      return JSON.parse(possivelJson)
    } catch {
      /* intentionally ignored */
    }
  }

  return null
}

export const assistentePropostaIaService = {
  /**
   * Envia o pedido em linguagem livre para o assistente IA nativo Skip Cloud
   */
  async enviarMensagem(
    message: string,
    conversationId: string | null = null,
  ): Promise<RespostaAssistenteIa> {
    const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const url = `${baseUrl.replace(/\/$/, '')}/backend/v1/propostas/assistente-ia`

    const token = pb.authStore.token
    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.')
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload.error || `Erro na comunicação com o assistente IA (${res.status})`)
    }

    const content = payload.content || ''
    const sugestaoEstruturada = extrairJsonDaResposta(content)

    return {
      conversation_id: payload.conversation_id || conversationId,
      content,
      citations: payload.citations || [],
      message_id: payload.message_id,
      sugestaoEstruturada,
    }
  },
}
