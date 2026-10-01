import pb from '@/lib/pocketbase/client'
import { NaoContatarRecord } from '@/types'

export interface CreateNaoContatarData {
  email: string
  empresa?: string
  motivo: string
  data_inclusao?: string
}

export const naoContatarService = {
  async list(): Promise<NaoContatarRecord[]> {
    return await pb.collection('nao_contatar').getFullList<NaoContatarRecord>({
      sort: '-created',
      expand: 'empresa',
    })
  },

  async isEmailBloqueado(email: string): Promise<boolean> {
    if (!email) return false
    const cleanEmail = email.trim().toLowerCase()
    try {
      const records = await pb.collection('nao_contatar').getList<NaoContatarRecord>(1, 1, {
        filter: `email = '${cleanEmail}'`,
      })
      return records.totalItems > 0
    } catch (_) {
      return false
    }
  },

  async create(data: CreateNaoContatarData): Promise<NaoContatarRecord> {
    return await pb.collection('nao_contatar').create<NaoContatarRecord>({
      ...data,
      email: data.email.trim().toLowerCase(),
      data_inclusao: data.data_inclusao || new Date().toISOString(),
    })
  },

  /**
   * Remoção permitida apenas para Admin (regra reforçada no servidor e verificada no cliente)
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('nao_contatar').delete(id)
  },
}
