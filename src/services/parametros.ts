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

  async getByKey(chave: string): Promise<ParametroRecord | null> {
    try {
      return await pb
        .collection('parametros')
        .getFirstListItem<ParametroRecord>(`chave = "${chave}"`)
    } catch (_) {
      return null
    }
  },

  async get(chave: string, defaultValue: string = ''): Promise<string> {
    const p = await this.getByKey(chave)
    return p?.valor || defaultValue
  },
}
