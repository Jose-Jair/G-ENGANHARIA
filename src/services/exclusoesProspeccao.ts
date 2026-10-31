import pb from '@/lib/pocketbase/client'

export interface ExclusaoProspeccaoRecord {
  id: string
  cnpj?: string
  cnae?: string
  objeto_termo?: string
  razao_social?: string
  tipo_chave?: 'cnpj' | 'cnae' | 'objeto_termo' | 'misto' | string
  motivo_descarte: string
  fonte_origem?: string
  sugestao_origem_id?: string
  descartado_por?: string
  data_descarte?: string
  ativo: boolean
  observacoes?: string
  created: string
  updated: string
}

export interface CreateExclusaoProspeccaoData {
  cnpj?: string
  cnae?: string
  objeto_termo?: string
  razao_social?: string
  tipo_chave?: 'cnpj' | 'cnae' | 'objeto_termo' | 'misto' | string
  motivo_descarte: string
  fonte_origem?: string
  sugestao_origem_id?: string
  descartado_por?: string
  data_descarte?: string
  ativo?: boolean
  observacoes?: string
}

export const exclusoesProspeccaoService = {
  /**
   * Lista todas as exclusões de prospecção cadastradas
   */
  async list(): Promise<ExclusaoProspeccaoRecord[]> {
    return await pb.collection('exclusoes_prospeccao').getFullList<ExclusaoProspeccaoRecord>({
      sort: '-created',
    })
  },

  /**
   * Verifica se determinado CNPJ está na lista de exclusão de prospecção
   */
  async isCnpjExcluido(cnpj: string): Promise<boolean> {
    const clean = cnpj.replace(/\D/g, '')
    if (!clean) return false
    try {
      const records = await pb.collection('exclusoes_prospeccao').getList(1, 1, {
        filter: `cnpj = "${clean}" && ativo = true`,
      })
      return records.totalItems > 0
    } catch {
      return false
    }
  },

  /**
   * Cria um registro na lista de exclusão de prospecção
   */
  async create(data: CreateExclusaoProspeccaoData): Promise<ExclusaoProspeccaoRecord> {
    return await pb.collection('exclusoes_prospeccao').create<ExclusaoProspeccaoRecord>({
      ...data,
      cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : '',
      ativo: data.ativo ?? true,
      data_descarte: data.data_descarte || new Date().toISOString(),
    })
  },

  /**
   * Desativa ou remove uma exclusão da lista
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('exclusoes_prospeccao').delete(id)
  },
}
