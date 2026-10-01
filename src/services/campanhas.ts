import pb from '@/lib/pocketbase/client'
import {
  CampanhaRecord,
  CampanhaEnvioRecord,
  CampanhaCalculada,
  MetricasConsolidadasCampanhas,
  StatusCampanha,
} from '@/types'

export interface CreateCampanhaData {
  nome: string
  segmento: 'A' | 'B' | 'C' | 'todos'
  template?: string
  assunto?: string
  corpo?: string
}

export interface UpdateCampanhaData {
  nome?: string
  segmento?: 'A' | 'B' | 'C' | 'todos'
  template?: string
  assunto?: string
  corpo?: string
  status?: StatusCampanha
  data_envio?: string
  observacao_devolucao?: string
  aprovado_por?: string
  aprovado_em?: string
  enviados?: number
  abertos?: number
  cliques?: number
  respostas?: number
  descadastros?: number
}

export interface DisparoLoteResponse {
  success: boolean
  message: string
  total_candidatas: number
  total_enviados: number
  total_bloqueados_nao_contatar: number
  total_bloqueados_regra: number
  total_falhas_email: number
}

export const campanhasService = {
  async list(): Promise<CampanhaRecord[]> {
    return (await pb.collection('campanhas').getFullList({
      sort: '-created',
      expand: 'template,aprovado_por',
    })) as CampanhaRecord[]
  },

  async getById(id: string): Promise<CampanhaRecord> {
    return (await pb.collection('campanhas').getOne(id, {
      expand: 'template,aprovado_por',
    })) as CampanhaRecord
  },

  async create(data: CreateCampanhaData): Promise<CampanhaRecord> {
    const payload = {
      ...data,
      status: 'rascunho',
      enviados: 0,
      abertos: 0,
      cliques: 0,
      respostas: 0,
      descadastros: 0,
    }
    return (await pb.collection('campanhas').create(payload)) as CampanhaRecord
  },

  async update(id: string, data: UpdateCampanhaData): Promise<CampanhaRecord> {
    return (await pb.collection('campanhas').update(id, data)) as CampanhaRecord
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('campanhas').delete(id)
  },

  // Aprovar campanha (somente Admin)
  async aprovar(id: string, adminId: string): Promise<CampanhaRecord> {
    return (await pb.collection('campanhas').update(id, {
      status: 'aprovada',
      aprovado_por: adminId,
      aprovado_em: new Date().toISOString(),
      observacao_devolucao: '',
    })) as CampanhaRecord
  },

  // Devolver campanha para o Comercial com observação (somente Admin)
  async devolver(id: string, observacao: string): Promise<CampanhaRecord> {
    return (await pb.collection('campanhas').update(id, {
      status: 'devolvida',
      observacao_devolucao: observacao,
    })) as CampanhaRecord
  },

  // Agendar campanha (somente Admin)
  async agendar(id: string, dataEnvio: string, adminId: string): Promise<CampanhaRecord> {
    return (await pb.collection('campanhas').update(id, {
      status: 'agendada',
      data_envio: dataEnvio,
      aprovado_por: adminId,
      aprovado_em: new Date().toISOString(),
    })) as CampanhaRecord
  },

  // Disparo em lote pelo servidor
  async dispararLote(campanhaId: string): Promise<DisparoLoteResponse> {
    return await pb.send<DisparoLoteResponse>('/backend/v1/campanhas/disparar-lote', {
      method: 'POST',
      body: { campanha_id: campanhaId },
    })
  },

  // Listar envios de uma campanha
  async listEnvios(campanhaId: string): Promise<CampanhaEnvioRecord[]> {
    return (await pb.collection('campanha_envios').getFullList({
      filter: `campanha = "${campanhaId}"`,
      sort: '-created',
      expand: 'empresa,campanha',
    })) as CampanhaEnvioRecord[]
  },

  // Comercial/Admin registra resposta de uma empresa
  async marcarResposta(
    envioId: string,
    observacao?: string,
  ): Promise<{ success: boolean; message: string }> {
    return await pb.send<{ success: boolean; message: string }>(
      '/backend/v1/campanhas/marcar-resposta',
      {
        method: 'POST',
        body: { envio_id: envioId, observacao },
      },
    )
  },

  // Calcular status dinâmico (sem cron) e métricas percentuais de uma campanha
  calcularCampanha(camp: CampanhaRecord): CampanhaCalculada {
    const hoje = new Date().toISOString().substring(0, 10)
    let isProntaParaDisparo = false

    if (camp.status === 'aprovada') {
      isProntaParaDisparo = true
    } else if (camp.status === 'agendada' && camp.data_envio) {
      const dataPrevista = camp.data_envio.substring(0, 10)
      if (dataPrevista <= hoje) {
        isProntaParaDisparo = true
      }
    }

    const env = camp.enviados || 0
    const ab = camp.abertos || 0
    const cl = camp.cliques || 0
    const resp = camp.respostas || 0
    const desc = camp.descadastros || 0

    return {
      ...camp,
      isProntaParaDisparo,
      taxaAbertura: env > 0 ? Math.round((ab / env) * 1000) / 10 : 0,
      taxaClique: env > 0 ? Math.round((cl / env) * 1000) / 10 : 0,
      taxaResposta: env > 0 ? Math.round((resp / env) * 1000) / 10 : 0,
      taxaDescadastro: env > 0 ? Math.round((desc / env) * 1000) / 10 : 0,
    }
  },

  // Calcular métricas consolidadas gerais
  calcularMetricasConsolidadas(campanhas: CampanhaRecord[]): MetricasConsolidadasCampanhas {
    let totalEnviados = 0
    let totalAbertos = 0
    let totalCliques = 0
    let totalRespostas = 0
    let totalDescadastros = 0

    for (const c of campanhas) {
      totalEnviados += c.enviados || 0
      totalAbertos += c.abertos || 0
      totalCliques += c.cliques || 0
      totalRespostas += c.respostas || 0
      totalDescadastros += c.descadastros || 0
    }

    return {
      totalCampanhas: campanhas.length,
      totalEnviados,
      totalAbertos,
      totalCliques,
      totalRespostas,
      totalDescadastros,
      taxaAberturaGeral:
        totalEnviados > 0 ? Math.round((totalAbertos / totalEnviados) * 1000) / 10 : 0,
      taxaCliqueGeral:
        totalEnviados > 0 ? Math.round((totalCliques / totalEnviados) * 1000) / 10 : 0,
      taxaRespostaGeral:
        totalEnviados > 0 ? Math.round((totalRespostas / totalEnviados) * 1000) / 10 : 0,
      taxaDescadastroGeral:
        totalEnviados > 0 ? Math.round((totalDescadastros / totalEnviados) * 1000) / 10 : 0,
    }
  },
}
