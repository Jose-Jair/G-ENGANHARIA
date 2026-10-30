import pb from '@/lib/pocketbase/client'
import {
  CatalogoEscopoRecord,
  EntregavelRecord,
  EntregavelVersaoRecord,
  SugestaoPrestadorItem,
} from '@/types'

export interface CreateCatalogoEscopoData {
  disciplina: string
  nome: string
  entregaveis_padrao?: Array<{ nome: string; descricao?: string; ordem?: number }>
  checklist_revisao?: Array<{ item: string; obrigatorio: boolean }>
  ativo: boolean
}

export const catalogoEscoposService = {
  async list(): Promise<CatalogoEscopoRecord[]> {
    return await pb.collection('catalogo_escopos').getFullList<CatalogoEscopoRecord>({
      sort: 'disciplina,nome',
    })
  },

  async listAtivos(): Promise<CatalogoEscopoRecord[]> {
    return await pb.collection('catalogo_escopos').getFullList<CatalogoEscopoRecord>({
      filter: 'ativo = true',
      sort: 'disciplina,nome',
    })
  },

  async getById(id: string): Promise<CatalogoEscopoRecord> {
    return await pb.collection('catalogo_escopos').getOne<CatalogoEscopoRecord>(id)
  },

  async create(data: CreateCatalogoEscopoData): Promise<CatalogoEscopoRecord> {
    return await pb.collection('catalogo_escopos').create<CatalogoEscopoRecord>(data)
  },

  async update(id: string, data: Partial<CreateCatalogoEscopoData>): Promise<CatalogoEscopoRecord> {
    return await pb.collection('catalogo_escopos').update<CatalogoEscopoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('catalogo_escopos').delete(id)
  },
}

export const entregaveisCicloService = {
  async listVersoes(entregavelId: string): Promise<EntregavelVersaoRecord[]> {
    return await pb.collection('entregaveis_versoes').getFullList<EntregavelVersaoRecord>({
      filter: `entregavel = '${entregavelId}'`,
      sort: '-numero_versao,-created',
      expand: 'enviado_por,avaliado_por',
    })
  },

  async submeterVersao(
    entregavelId: string,
    observacoes?: string,
  ): Promise<{
    sucesso: boolean
    entregavel_id: string
    versao: number
    status: string
    versao_id: string
  }> {
    return await pb.send(`/backend/v1/entregaveis/${entregavelId}/submeter-versao`, {
      method: 'POST',
      body: { observacoes: observacoes || '' },
    })
  },

  async avaliarVersao(
    entregavelId: string,
    decisao: 'aprovado' | 'devolvido',
    motivoDevolucao?: string,
  ): Promise<{ sucesso: boolean; entregavel_id: string; status: string; versao_atual: number }> {
    return await pb.send(`/backend/v1/entregaveis/${entregavelId}/avaliar`, {
      method: 'POST',
      body: {
        decisao,
        motivo_devolucao: motivoDevolucao || '',
      },
    })
  },
}

export { geradorPacotesContratoService } from './geradorPacotesContrato'

export const sugestoesPrestadoresService = {
  async obterSugestoes(params: {
    disciplina: string
    regiao?: string
    pacote_id?: string
  }): Promise<{
    disciplina: string
    regiao: string
    pacote_id: string | null
    total: number
    sugestoes: SugestaoPrestadorItem[]
  }> {
    return await pb.send('/backend/v1/prestadores/sugestoes', {
      method: 'POST',
      body: {
        disciplina: params.disciplina,
        regiao: params.regiao || '',
        pacote_id: params.pacote_id || '',
      },
    })
  },

  async aprovarSugestao(params: {
    prestador_id: string
    projeto_id: string
    pacote_id?: string
    disciplina?: string
    valor_os?: number
    prazo_dias?: number
    escopo_tecnico?: string
  }): Promise<{
    sucesso: boolean
    os_id: string
    numero: string
    tipo: string
    status: string
    valor: number
  }> {
    return await pb.send('/backend/v1/prestadores/aprovar-sugestao', {
      method: 'POST',
      body: params,
    })
  },
}
