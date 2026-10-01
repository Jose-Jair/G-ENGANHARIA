import pb from '@/lib/pocketbase/client'
import { ParametroRecord } from '@/types'

export const parametrosService = {
  async list(): Promise<ParametroRecord[]> {
    return await pb.collection('parametros').getFullList<ParametroRecord>({
      sort: 'chave',
    })
  },

  async update(id: string, data: Partial<ParametroRecord>): Promise<ParametroRecord> {
    return await pb.collection('parametros').update<ParametroRecord>(id, data)
  },
}
