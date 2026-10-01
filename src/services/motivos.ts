import pb from '@/lib/pocketbase/client'
import { MotivoRecord } from '@/types'

export const motivosService = {
  async list(): Promise<MotivoRecord[]> {
    return await pb.collection('motivos').getFullList<MotivoRecord>({
      sort: '-created',
    })
  },

  async listAtivos(tipo?: string): Promise<MotivoRecord[]> {
    const filters: string[] = ['ativo = true']
    if (tipo) {
      filters.push(`tipo = '${tipo}'`)
    }
    return await pb.collection('motivos').getFullList<MotivoRecord>({
      filter: filters.join(' && '),
      sort: 'descricao',
    })
  },

  async create(data: Omit<MotivoRecord, 'id' | 'created' | 'updated'>): Promise<MotivoRecord> {
    return await pb.collection('motivos').create<MotivoRecord>(data)
  },

  async update(id: string, data: Partial<MotivoRecord>): Promise<MotivoRecord> {
    return await pb.collection('motivos').update<MotivoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('motivos').delete(id)
  },
}
