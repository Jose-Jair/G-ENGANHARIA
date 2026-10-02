import pb from '@/lib/pocketbase/client'
import { ContratoRecord } from '@/types'

export interface CreateContratoData {
  empresa: string
  orgao: string
  numero: string
  objeto?: string
  modalidade?: string
  valor?: number
  saldo?: number
  vigencia_inicio?: string
  vigencia_fim?: string
  situacao?: string
  link_edital?: string
  fonte?: string
  confirmado_duplicidade?: boolean
  contrato_similar_id?: string
}

export const contratosService = {
  async listByEmpresa(empresaId: string): Promise<ContratoRecord[]> {
    return await pb.collection('contratos').getFullList<ContratoRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-vigencia_fim,-created',
    })
  },

  async listAll(): Promise<ContratoRecord[]> {
    return await pb.collection('contratos').getFullList<ContratoRecord>({
      sort: '-created',
    })
  },

  async getById(id: string): Promise<ContratoRecord> {
    return await pb.collection('contratos').getOne<ContratoRecord>(id, {
      expand: 'empresa',
    })
  },

  async create(data: CreateContratoData): Promise<ContratoRecord> {
    return await pb.collection('contratos').create<ContratoRecord>(data)
  },

  async update(id: string, data: Partial<CreateContratoData>): Promise<ContratoRecord> {
    return await pb.collection('contratos').update<ContratoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('contratos').delete(id)
  },

  /**
   * Verifica se o contrato está ativo (situação não é 'Encerrado', 'Rescindido' ou 'Cancelado')
   */
  isContratoAtivo(contrato: ContratoRecord): boolean {
    const sit = (contrato.situacao || '').toLowerCase()
    if (sit.includes('encerrad') || sit.includes('rescindid') || sit.includes('cancelad')) {
      return false
    }
    return true
  },

  /**
   * Calcula se a vigência fim do contrato está dentro do período de alerta (padrão: 90 dias)
   */
  isProximoDoFim(
    vigenciaFimStr?: string,
    diasAlerta: number = 90,
  ): { proximo: boolean; diasRestantes: number | null } {
    if (!vigenciaFimStr) return { proximo: false, diasRestantes: null }
    try {
      const fim = new Date(vigenciaFimStr)
      if (isNaN(fim.getTime())) return { proximo: false, diasRestantes: null }

      const hoje = new Date()
      // Zerar horas para comparar dias civis
      hoje.setHours(0, 0, 0, 0)
      const fimDia = new Date(fim)
      fimDia.setHours(0, 0, 0, 0)

      const diffMs = fimDia.getTime() - hoje.getTime()
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      // Se já passou ou está dentro da janela de alerta (ex: até 90 dias)
      if (diasRestantes <= diasAlerta) {
        return { proximo: true, diasRestantes }
      }
      return { proximo: false, diasRestantes }
    } catch (_) {
      return { proximo: false, diasRestantes: null }
    }
  },
}
