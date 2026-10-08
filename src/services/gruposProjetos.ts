import pb from '@/lib/pocketbase/client'
import { GrupoProjetosRecord, ProjetoRecord, ProjetoEtapaRecord } from '@/types'

export interface CreateGrupoProjetosData {
  codigo?: string
  contrato_servico?: string
  proposta?: string
  empresa?: string
  cliente_pf?: string
  nome?: string
  descricao?: string
  status?: 'em_contratacao' | 'ativo' | 'concluido' | 'cancelado'
  valor_total?: number
}

export interface UpdateGrupoProjetosData extends Partial<CreateGrupoProjetosData> {}

export interface GrupoComProjetosEDetalhes {
  grupo: GrupoProjetosRecord
  projetos: ProjetoRecord[]
  etapasPorProjeto: Record<string, ProjetoEtapaRecord[]>
  progressoMedio: number
  valorTotalConsolidado: number
  totalEtapas: number
  totalEtapasConcluidas: number
}

export const gruposProjetosService = {
  async list(): Promise<GrupoProjetosRecord[]> {
    return await pb.collection('grupos_projetos').getFullList<GrupoProjetosRecord>({
      sort: '-created',
      expand: 'empresa,cliente_pf,proposta,contrato_servico',
    })
  },

  async getById(id: string): Promise<GrupoProjetosRecord> {
    return await pb.collection('grupos_projetos').getOne<GrupoProjetosRecord>(id, {
      expand: 'empresa,cliente_pf,proposta,contrato_servico',
    })
  },

  async getByContrato(contratoId: string): Promise<GrupoProjetosRecord | null> {
    try {
      const achados = await pb.collection('grupos_projetos').getFullList<GrupoProjetosRecord>({
        filter: `contrato_servico = '${contratoId}'`,
        sort: '-created',
        expand: 'empresa,cliente_pf,proposta,contrato_servico',
      })
      return achados.length > 0 ? achados[0] : null
    } catch {
      return null
    }
  },

  async create(data: CreateGrupoProjetosData): Promise<GrupoProjetosRecord> {
    return await pb.collection('grupos_projetos').create<GrupoProjetosRecord>(data)
  },

  async update(id: string, data: UpdateGrupoProjetosData): Promise<GrupoProjetosRecord> {
    return await pb.collection('grupos_projetos').update<GrupoProjetosRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('grupos_projetos').delete(id)
  },

  // Carrega grupo completo com seus projetos, etapas e progresso consolidado
  async getGrupoCompleto(grupoId: string): Promise<GrupoComProjetosEDetalhes> {
    const grupo = await this.getById(grupoId)

    // Buscar projetos pertencentes ao grupo (ou que apontem para o mesmo contrato caso legado)
    let projetos = await pb.collection('projetos').getFullList<ProjetoRecord>({
      filter: `grupo = '${grupoId}' || (contrato_servico = '${grupo.contrato_servico}' && grupo = '')`,
      sort: 'codigo',
      expand: 'empresa,cliente_pf,proposta,contrato_servico',
    })

    // Se nenhum projeto encontrado e temos contrato_servico, buscar por contrato
    if (projetos.length === 0 && grupo.contrato_servico) {
      projetos = await pb.collection('projetos').getFullList<ProjetoRecord>({
        filter: `contrato_servico = '${grupo.contrato_servico}'`,
        sort: 'codigo',
        expand: 'empresa,cliente_pf,proposta,contrato_servico',
      })
    }

    // Carregar etapas de cada projeto
    const etapasPorProjeto: Record<string, ProjetoEtapaRecord[]> = {}
    let totalEtapas = 0
    let totalEtapasConcluidas = 0

    if (projetos.length > 0) {
      const filtroEtapas = projetos.map((p) => `projeto = '${p.id}'`).join(' || ')
      try {
        const todasEtapas = await pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
          filter: filtroEtapas,
          sort: 'ordem',
          expand: 'executor',
        })

        for (const prj of projetos) {
          etapasPorProjeto[prj.id] = []
        }

        for (const etapa of todasEtapas) {
          if (!etapasPorProjeto[etapa.projeto]) {
            etapasPorProjeto[etapa.projeto] = []
          }
          etapasPorProjeto[etapa.projeto].push(etapa)
          totalEtapas++
          if (etapa.status === 'concluida') {
            totalEtapasConcluidas++
          }
        }
      } catch {
        // Ignora erro se etapas vazias
      }
    }

    const progressoMedio =
      totalEtapas > 0 ? Math.round((totalEtapasConcluidas / totalEtapas) * 100) : 0

    const valorTotalConsolidado = projetos.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0)

    return {
      grupo,
      projetos,
      etapasPorProjeto,
      progressoMedio,
      valorTotalConsolidado:
        valorTotalConsolidado > 0 ? valorTotalConsolidado : grupo.valor_total || 0,
      totalEtapas,
      totalEtapasConcluidas,
    }
  },
}
