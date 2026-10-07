import pb from '@/lib/pocketbase/client'
import { CatalogoServicoRecord } from '@/types'

export interface CreateCatalogoServicoData {
  nome: string
  disciplina: string
  unidade: string
  preco_base: number
  descricao?: string
  ativo: boolean
  area?: string
  precisa_revisao_area?: boolean
}

export interface UpdateCatalogoServicoData extends Partial<CreateCatalogoServicoData> {}

export const catalogoServicosService = {
  async list(): Promise<CatalogoServicoRecord[]> {
    return pb.collection('catalogo_servicos').getFullList<CatalogoServicoRecord>({
      sort: 'disciplina,nome',
      expand: 'area',
    })
  },

  async listAtivos(): Promise<CatalogoServicoRecord[]> {
    return pb.collection('catalogo_servicos').getFullList<CatalogoServicoRecord>({
      filter: 'ativo = true',
      sort: 'disciplina,nome',
      expand: 'area',
    })
  },

  async getById(id: string): Promise<CatalogoServicoRecord> {
    return pb.collection('catalogo_servicos').getOne<CatalogoServicoRecord>(id, {
      expand: 'area',
    })
  },

  async create(data: CreateCatalogoServicoData): Promise<CatalogoServicoRecord> {
    return pb.collection('catalogo_servicos').create<CatalogoServicoRecord>(data)
  },

  async update(id: string, data: UpdateCatalogoServicoData): Promise<CatalogoServicoRecord> {
    return pb.collection('catalogo_servicos').update<CatalogoServicoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('catalogo_servicos').delete(id)
  },
}
