import pb from '@/lib/pocketbase/client'
import { EmpresaRecord, EtapaFunil, CurvaABC, StatusEmpresa } from '@/types'
import { cleanCnpj, formatCnpj } from '@/lib/cnpj'

export interface EmpresaFilters {
  busca?: string
  etapa_funil?: string
  curva?: string
  uf?: string
  responsavel?: string
  status?: string
}

export interface CreateEmpresaData {
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  situacao_cadastral?: string
  cnae?: string
  porte?: string
  uf?: string
  municipio?: string
  email?: string
  telefone?: string
  instagram?: string
  linkedin?: string
  site?: string
  etapa_funil?: EtapaFunil
  curva?: CurvaABC
  score?: number
  responsavel?: string
  status?: StatusEmpresa
  motivo_inativacao?: string
  observacoes?: string
}

export const empresasService = {
  async list(filters?: EmpresaFilters): Promise<EmpresaRecord[]> {
    const filterParts: string[] = []

    if (filters?.busca) {
      const q = filters.busca.trim().replace(/'/g, "\\'")
      const cleanQ = cleanCnpj(filters.busca)
      if (cleanQ.length >= 3) {
        filterParts.push(
          `(razao_social ~ '${q}' || nome_fantasia ~ '${q}' || cnpj ~ '${cleanQ}' || municipio ~ '${q}')`,
        )
      } else {
        filterParts.push(`(razao_social ~ '${q}' || nome_fantasia ~ '${q}' || municipio ~ '${q}')`)
      }
    }

    if (filters?.etapa_funil && filters.etapa_funil !== 'todas') {
      filterParts.push(`etapa_funil = '${filters.etapa_funil}'`)
    }

    if (filters?.curva && filters.curva !== 'todas') {
      filterParts.push(`curva = '${filters.curva}'`)
    }

    if (filters?.uf && filters.uf !== 'todas') {
      filterParts.push(`uf = '${filters.uf}'`)
    }

    if (filters?.responsavel && filters.responsavel !== 'todos') {
      filterParts.push(`responsavel = '${filters.responsavel}'`)
    }

    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = '${filters.status}'`)
    }

    const filterString = filterParts.length > 0 ? filterParts.join(' && ') : ''

    const records = await pb.collection('empresas').getFullList<EmpresaRecord>({
      filter: filterString,
      sort: '-created',
      expand: 'responsavel',
    })

    return records
  },

  async getById(id: string): Promise<EmpresaRecord> {
    return await pb.collection('empresas').getOne<EmpresaRecord>(id, {
      expand: 'responsavel',
    })
  },

  async findByCnpj(cnpj: string): Promise<EmpresaRecord | null> {
    const clean = cleanCnpj(cnpj)
    if (!clean) return null
    const formatted = formatCnpj(clean)

    try {
      // Tenta tanto com dígitos limpos quanto com máscara
      const filter = `cnpj = '${clean}' || cnpj = '${formatted}'`
      const records = await pb.collection('empresas').getList<EmpresaRecord>(1, 1, {
        filter,
        expand: 'responsavel',
      })
      return records.items[0] || null
    } catch (_) {
      return null
    }
  },

  async create(data: CreateEmpresaData): Promise<EmpresaRecord> {
    return await pb.collection('empresas').create<EmpresaRecord>(data)
  },

  async update(id: string, data: Partial<CreateEmpresaData>): Promise<EmpresaRecord> {
    return await pb.collection('empresas').update<EmpresaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('empresas').delete(id)
  },

  /**
   * Recalcula a curva ABC da empresa baseada no somatório de contratos ativos
   * Curva A: > 5M
   * Curva B: 1M a 5M
   * Curva C: < 1M
   */
  calcularCurva(totalValorContratos: number): CurvaABC {
    if (totalValorContratos >= 5000000) return 'A'
    if (totalValorContratos >= 1000000) return 'B'
    return 'C'
  },
}
