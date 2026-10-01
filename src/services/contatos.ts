import pb from '@/lib/pocketbase/client'
import { ContatoRecord } from '@/types'

export interface CreateContatoData {
  empresa: string
  nome: string
  cargo?: string
  email?: string
  telefone?: string
  whatsapp?: string
  decisor?: boolean
  verificado?: boolean
}

export const contatosService = {
  async listByEmpresa(empresaId: string): Promise<ContatoRecord[]> {
    return await pb.collection('contatos').getFullList<ContatoRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-decisor,nome',
    })
  },

  async create(data: CreateContatoData): Promise<ContatoRecord> {
    return await pb.collection('contatos').create<ContatoRecord>(data)
  },

  async update(id: string, data: Partial<CreateContatoData>): Promise<ContatoRecord> {
    return await pb.collection('contatos').update<ContatoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('contatos').delete(id)
  },
}
