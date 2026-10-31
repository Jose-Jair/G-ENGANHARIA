import pb from '@/lib/pocketbase/client'
import type {
  IssueRevisaoRecord,
  OrigemIssueRevisao,
  ResumoIfcContagem,
  SeveridadeIssueRevisao,
  StatusIssueRevisao,
} from '@/types'

export interface TopicoBcfPayload {
  guid_bcf?: string
  markup_xml?: string
  titulo?: string
  descricao?: string
  severidade?: SeveridadeIssueRevisao
  status?: StatusIssueRevisao
  elementos?: string[]
  pavimento?: string
  prazo?: string
  viewpoint_base64?: string
  viewpoint_nome?: string
}

export interface ImportarBcfResponse {
  sucesso: boolean
  entregavel_id: string
  versao_id: string
  total_processados: number
  criadas: number
  ignoradas_dedupe: number
  ids_criados: string[]
}

export interface GravarResumoIfcPayload {
  hash_sha256: string
  tamanho?: number
  resumo_ifc: ResumoIfcContagem
}

export interface GravarResumoIfcResponse {
  sucesso: boolean
  entregavel_id: string
  versao_id: string
  hash_sha256: string
  tamanho: number
  resumo_ifc_json: ResumoIfcContagem
}

export interface ListarIssuesResponse {
  entregavel_id: string
  versao_id: string
  total: number
  issues: IssueRevisaoRecord[]
}

export const issuesRevisaoService = {
  /**
   * Importa tópicos BCF (2.1/3.0) para uma versão de entregável com deduplicação por guid_bcf
   */
  async importarBcf(
    entregavelId: string,
    versaoId: string,
    topicos: TopicoBcfPayload[],
  ): Promise<ImportarBcfResponse> {
    const res = await pb.send<ImportarBcfResponse>(
      `/backend/v1/entregaveis/${entregavelId}/versoes/${versaoId}/importar-bcf`,
      {
        method: 'POST',
        body: JSON.stringify({ topicos }),
      },
    )
    return res
  },

  /**
   * Grava o resumo IFC processado pelo navegador na versão com validação estrita de hash SHA-256
   */
  async gravarResumoIfc(
    entregavelId: string,
    versaoId: string,
    payload: GravarResumoIfcPayload,
  ): Promise<GravarResumoIfcResponse> {
    const res = await pb.send<GravarResumoIfcResponse>(
      `/backend/v1/entregaveis/${entregavelId}/versoes/${versaoId}/resumo-ifc`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    return res
  },

  /**
   * Lista issues de revisão de um entregável/versão com segmentação para prestadores
   */
  async listarIssues(
    entregavelId: string,
    versaoId: string = 'todas',
  ): Promise<ListarIssuesResponse> {
    const res = await pb.send<ListarIssuesResponse>(
      `/backend/v1/entregaveis/${entregavelId}/versoes/${versaoId}/issues`,
      {
        method: 'GET',
      },
    )
    return res
  },

  /**
   * Criação manual ou assistida por IA de uma issue de revisão
   */
  async criarIssue(data: {
    entregavel: string
    versao: string
    origem: OrigemIssueRevisao
    titulo: string
    descricao?: string
    elementos?: string[]
    pavimento?: string
    severidade: SeveridadeIssueRevisao
    status?: StatusIssueRevisao
    prazo?: string
    atribuida_a?: string
  }): Promise<IssueRevisaoRecord> {
    return (await pb.collection('issues_revisao').create({
      ...data,
      status: data.status || 'aberta',
    })) as unknown as IssueRevisaoRecord
  },

  /**
   * Atualização de status da issue (ex: marcar corrigida, verificada ou rejeitada)
   */
  async atualizarStatus(
    issueId: string,
    novoStatus: StatusIssueRevisao,
    versaoCorrigidaId?: string,
  ): Promise<IssueRevisaoRecord> {
    const updateData: Record<string, unknown> = { status: novoStatus }
    if (versaoCorrigidaId) {
      updateData.versao_corrigida = versaoCorrigidaId
    }
    return (await pb
      .collection('issues_revisao')
      .update(issueId, updateData)) as unknown as IssueRevisaoRecord
  },
}
