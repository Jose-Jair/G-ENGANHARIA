import pb from '@/lib/pocketbase/client'
import { MedicaoRecord } from '@/types'

export interface CriarMedicaoPayload {
  subcontrato: string
  periodo_inicio: string
  periodo_fim: string
  percentual_executado: number
  valor_bruto: number
  retencao_impostos?: number
  percentual_retencao_tecnica?: number
  anexos?: File[]
}

export interface AceitarMedicaoClienteResponse {
  success: boolean
  message: string
  medicao_id: string
  aceita_pelo_cliente: boolean
  data_aceitacao_cliente: string
}

export interface AprovarMedicaoResponse {
  success: boolean
  message: string
  medicao_id: string
  conta_pagar_id?: string
}

export interface ReprovarMedicaoResponse {
  success: boolean
  message: string
  medicao_id: string
}

export const medicoesService = {
  /**
   * Listar medições de um projeto (expandindo subcontrato, executor, aprovada_por)
   */
  async listByProjeto(projetoId: string): Promise<MedicaoRecord[]> {
    return pb.collection('medicoes').getFullList<MedicaoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
      expand: 'subcontrato,projeto,executor,aprovada_por',
    })
  },

  /**
   * Listar medições de um subcontrato específico
   */
  async listBySubcontrato(subcontratoId: string): Promise<MedicaoRecord[]> {
    return pb.collection('medicoes').getFullList<MedicaoRecord>({
      filter: `subcontrato = '${subcontratoId}'`,
      sort: 'numero_medicao',
      expand: 'subcontrato,projeto,executor,aprovada_por',
    })
  },

  /**
   * Listar todas as medições pendentes de aprovação (status = 'apresentada')
   * Usado para o badge de notificações no sino
   */
  async countApresentadas(): Promise<number> {
    try {
      const res = await pb.collection('medicoes').getList(1, 1, {
        filter: "status = 'apresentada'",
      })
      return res.totalItems
    } catch (_) {
      return 0
    }
  },

  /**
   * Obter medição por ID
   */
  async getById(id: string): Promise<MedicaoRecord> {
    return pb.collection('medicoes').getOne<MedicaoRecord>(id, {
      expand: 'subcontrato,projeto,executor,aprovada_por',
    })
  },

  /**
   * Apresentar / Criar medição através do endpoint validado no servidor
   */
  async criar(
    payload: CriarMedicaoPayload,
  ): Promise<{ success: boolean; message: string; medicao: any }> {
    // 1. Criar via endpoint customizado
    const res = await pb.send('/backend/v1/medicoes/criar', {
      method: 'POST',
      body: {
        subcontrato: payload.subcontrato,
        periodo_inicio: payload.periodo_inicio,
        periodo_fim: payload.periodo_fim,
        percentual_executado: payload.percentual_executado,
        valor_bruto: payload.valor_bruto,
        retencao_impostos: payload.retencao_impostos || 0,
        percentual_retencao_tecnica: payload.percentual_retencao_tecnica,
      },
    })

    // 2. Se houver anexos, fazer upload via FormData para o registro criado
    if (res?.medicao?.id && payload.anexos && payload.anexos.length > 0) {
      try {
        const formData = new FormData()
        for (const file of payload.anexos) {
          formData.append('anexos', file)
        }
        await pb.collection('medicoes').update(res.medicao.id, formData)
      } catch (errUpload) {
        console.error('Aviso ao anexar arquivos na medição:', errUpload)
      }
    }

    return res
  },

  /**
   * Aprovar medição (Admin/Gestor)
   */
  async aprovar(medicaoId: string): Promise<AprovarMedicaoResponse> {
    return pb.send(`/backend/v1/medicoes/${medicaoId}/aprovar`, {
      method: 'POST',
    })
  },

  /**
   * Reprovar medição (Admin/Gestor) - exige justificativa
   */
  async reprovar(medicaoId: string, observacoes: string): Promise<ReprovarMedicaoResponse> {
    return pb.send(`/backend/v1/medicoes/${medicaoId}/reprovar`, {
      method: 'POST',
      body: {
        observacoes_gestor: observacoes,
      },
    })
  },

  /**
   * Registrar aceitação formal da etapa/entrega pelo cliente
   */
  async aceitarPeloCliente(
    medicaoId: string,
    responsavel?: string,
  ): Promise<AceitarMedicaoClienteResponse> {
    return pb.send(`/backend/v1/medicoes/${medicaoId}/aceitar-cliente`, {
      method: 'POST',
      body: {
        responsavel_aceitacao_cliente: responsavel,
      },
    })
  },

  /**
   * Obter URL de anexo da medição (com token de proteção se logado)
   */
  async getAnexoUrl(medicao: MedicaoRecord, fileName: string): Promise<string> {
    const { getProtectedFileUrl } = await import('@/lib/pocketbase/files')
    return getProtectedFileUrl(medicao, fileName)
  },
}
