import pb from '@/lib/pocketbase/client'
import { AreaAtuacaoRecord, SubservicoRecord, EntregavelPadraoRecord } from '@/types'

export interface CreateAreaAtuacaoData {
  nome: string
  descricao?: string
  ordem?: number
  ativo: boolean
}

export interface UpdateAreaAtuacaoData extends Partial<CreateAreaAtuacaoData> {}

export interface CreateSubservicoData {
  area: string
  nome: string
  descricao?: string
  ativo: boolean
}

export interface UpdateSubservicoData extends Partial<CreateSubservicoData> {}

export interface CreateEntregavelPadraoData {
  area: string
  subservico?: string
  nome: string
  descricao?: string
  ordem?: number
  ativo: boolean
}

export interface UpdateEntregavelPadraoData extends Partial<CreateEntregavelPadraoData> {}

export const areasAtuacaoService = {
  async list(): Promise<AreaAtuacaoRecord[]> {
    return pb.collection('areas_atuacao').getFullList<AreaAtuacaoRecord>({
      sort: 'ordem,nome',
    })
  },

  async listAtivas(): Promise<AreaAtuacaoRecord[]> {
    return pb.collection('areas_atuacao').getFullList<AreaAtuacaoRecord>({
      filter: 'ativo = true',
      sort: 'ordem,nome',
    })
  },

  async getById(id: string): Promise<AreaAtuacaoRecord> {
    return pb.collection('areas_atuacao').getOne<AreaAtuacaoRecord>(id)
  },

  async create(data: CreateAreaAtuacaoData): Promise<AreaAtuacaoRecord> {
    return pb.collection('areas_atuacao').create<AreaAtuacaoRecord>(data)
  },

  async update(id: string, data: UpdateAreaAtuacaoData): Promise<AreaAtuacaoRecord> {
    return pb.collection('areas_atuacao').update<AreaAtuacaoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('areas_atuacao').delete(id)
  },
}

export const subservicosService = {
  async list(areaId?: string): Promise<SubservicoRecord[]> {
    const options: any = {
      sort: 'nome',
      expand: 'area',
    }
    if (areaId) {
      options.filter = `area = '${areaId}'`
    }
    return pb.collection('subservicos').getFullList<SubservicoRecord>(options)
  },

  async listAtivos(areaId?: string): Promise<SubservicoRecord[]> {
    const options: any = {
      sort: 'nome',
      expand: 'area',
    }
    if (areaId) {
      options.filter = `ativo = true && area = '${areaId}'`
    } else {
      options.filter = 'ativo = true'
    }
    return pb.collection('subservicos').getFullList<SubservicoRecord>(options)
  },

  async getById(id: string): Promise<SubservicoRecord> {
    return pb.collection('subservicos').getOne<SubservicoRecord>(id, {
      expand: 'area',
    })
  },

  async create(data: CreateSubservicoData): Promise<SubservicoRecord> {
    return pb.collection('subservicos').create<SubservicoRecord>(data)
  },

  async update(id: string, data: UpdateSubservicoData): Promise<SubservicoRecord> {
    return pb.collection('subservicos').update<SubservicoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('subservicos').delete(id)
  },
}

export const entregaveisPadraoService = {
  async list(areaId?: string): Promise<EntregavelPadraoRecord[]> {
    const options: any = {
      sort: 'ordem,nome',
      expand: 'area,subservico',
    }
    if (areaId) {
      options.filter = `area = '${areaId}'`
    }
    return pb.collection('entregaveis_padrao').getFullList<EntregavelPadraoRecord>(options)
  },

  async listAtivos(areaId?: string): Promise<EntregavelPadraoRecord[]> {
    const options: any = {
      sort: 'ordem,nome',
      expand: 'area,subservico',
    }
    if (areaId) {
      options.filter = `ativo = true && area = '${areaId}'`
    } else {
      options.filter = 'ativo = true'
    }
    return pb.collection('entregaveis_padrao').getFullList<EntregavelPadraoRecord>(options)
  },

  async getById(id: string): Promise<EntregavelPadraoRecord> {
    return pb.collection('entregaveis_padrao').getOne<EntregavelPadraoRecord>(id, {
      expand: 'area,subservico',
    })
  },

  async create(data: CreateEntregavelPadraoData): Promise<EntregavelPadraoRecord> {
    return pb.collection('entregaveis_padrao').create<EntregavelPadraoRecord>(data)
  },

  async update(id: string, data: UpdateEntregavelPadraoData): Promise<EntregavelPadraoRecord> {
    return pb.collection('entregaveis_padrao').update<EntregavelPadraoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('entregaveis_padrao').delete(id)
  },
}
