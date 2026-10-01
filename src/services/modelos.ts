import pb from '@/lib/pocketbase/client'
import { ModeloRecord } from '@/types'

export const modelosService = {
  async list(): Promise<ModeloRecord[]> {
    return await pb.collection('modelos').getFullList<ModeloRecord>({
      sort: '-created',
    })
  },

  async create(data: Omit<ModeloRecord, 'id' | 'created' | 'updated'>): Promise<ModeloRecord> {
    return await pb.collection('modelos').create<ModeloRecord>(data)
  },

  async update(id: string, data: Partial<ModeloRecord>): Promise<ModeloRecord> {
    return await pb.collection('modelos').update<ModeloRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('modelos').delete(id)
  },
}
