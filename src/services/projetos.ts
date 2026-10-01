import pb from '@/lib/pocketbase/client'
import {
  ProjetoRecord,
  SaudeProjeto,
  ProjetoEtapaRecord,
  EntregavelRecord,
  DocumentoRecord,
  RiscoRecord,
} from '@/types'

export interface CreateProjetoData {
  nome: string
  codigo?: string
  descricao?: string
  disciplinas?: string
  proposta?: string
  contrato?: string
  empresa?: string
  cliente_pf?: string
  valor_total?: number
  prazo_final?: string
  subcontratacao_autorizada?: boolean
  saude?: SaudeProjeto
  justificativa_saude?: string
  status?: string
}

export interface UpdateProjetoData extends Partial<CreateProjetoData> {}

export interface DocumentoComAlerta extends DocumentoRecord {
  diasAteVencimento: number | null
  alertaNivel: 'vencido' | 'd1' | 'd7' | 'd15' | 'd30' | 'ok' | null
}

export const projetosService = {
  async list(): Promise<ProjetoRecord[]> {
    return await pb.collection('projetos').getFullList<ProjetoRecord>({
      sort: '-created',
      expand: 'proposta,proposta.empresa,proposta.cliente_pf,contrato,empresa,cliente_pf',
    })
  },

  async getById(id: string): Promise<ProjetoRecord> {
    return await pb.collection('projetos').getOne<ProjetoRecord>(id, {
      expand: 'proposta,proposta.empresa,proposta.cliente_pf,contrato,empresa,cliente_pf',
    })
  },

  async create(data: CreateProjetoData): Promise<ProjetoRecord> {
    return await pb.collection('projetos').create<ProjetoRecord>(data)
  },

  async update(id: string, data: UpdateProjetoData): Promise<ProjetoRecord> {
    return await pb.collection('projetos').update<ProjetoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('projetos').delete(id)
  },

  async updateSaude(
    id: string,
    saude: SaudeProjeto,
    justificativa: string,
  ): Promise<ProjetoRecord> {
    return await pb.collection('projetos').update<ProjetoRecord>(id, {
      saude,
      justificativa_saude: justificativa,
    })
  },

  // Busca dados completos de todas as 4 abas para a tela de detalhe do projeto
  async getProjetoCompleto(projetoId: string) {
    const [projeto, etapas, documentos, riscos] = await Promise.all([
      this.getById(projetoId),
      pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
        filter: `projeto = '${projetoId}'`,
        sort: 'ordem,created',
        expand: 'executor',
      }),
      pb.collection('documentos').getFullList<DocumentoRecord>({
        filter: `projeto = '${projetoId}'`,
        sort: 'vencimento',
        expand: 'etapa',
      }),
      pb.collection('riscos').getFullList<RiscoRecord>({
        filter: `projeto = '${projetoId}'`,
        sort: '-created',
      }),
    ])

    // Carregar entregáveis de todas as etapas do projeto
    let entregaveis: EntregavelRecord[] = []
    if (etapas.length > 0) {
      const etapaIds = etapas.map((e) => `etapa = '${e.id}'`).join(' || ')
      entregaveis = await pb.collection('entregaveis').getFullList<EntregavelRecord>({
        filter: etapaIds,
        sort: 'created',
        expand: 'etapa',
      })
    }

    return {
      projeto,
      etapas,
      entregaveis,
      documentos: this.calcularAlertasDocumentos(documentos),
      riscos,
    }
  },

  // Alerta D-30 / D-15 / D-7 / D-1 de vencimento de documentos do projeto
  calcularAlertasDocumentos(docs: DocumentoRecord[]): DocumentoComAlerta[] {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    return docs.map((doc) => {
      if (!doc.vencimento) {
        return { ...doc, diasAteVencimento: null, alertaNivel: null }
      }

      const venc = new Date(doc.vencimento)
      venc.setHours(0, 0, 0, 0)
      const diffMs = venc.getTime() - hoje.getTime()
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      let alertaNivel: DocumentoComAlerta['alertaNivel'] = 'ok'
      if (diffDias < 0) {
        alertaNivel = 'vencido'
      } else if (diffDias <= 1) {
        alertaNivel = 'd1'
      } else if (diffDias <= 7) {
        alertaNivel = 'd7'
      } else if (diffDias <= 15) {
        alertaNivel = 'd15'
      } else if (diffDias <= 30) {
        alertaNivel = 'd30'
      }

      return {
        ...doc,
        diasAteVencimento: diffDias,
        alertaNivel,
      }
    })
  },

  // Lista todos os documentos de todos os projetos que estão com alerta de vencimento (para sininho do Gestor/Admin)
  async listDocumentosComAlertaGeral(): Promise<DocumentoComAlerta[]> {
    const docs = await pb.collection('documentos').getFullList<DocumentoRecord>({
      filter: "vencimento != ''",
      sort: 'vencimento',
      expand: 'projeto,etapa',
    })

    const comAlertas = this.calcularAlertasDocumentos(docs)
    return comAlertas.filter(
      (d) => d.alertaNivel && ['vencido', 'd1', 'd7', 'd15', 'd30'].includes(d.alertaNivel),
    )
  },
}
