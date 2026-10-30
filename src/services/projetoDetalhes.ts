import pb from '@/lib/pocketbase/client'
import {
  ProjetoEtapaRecord,
  TipoExecucaoEtapa,
  StatusEtapa,
  EntregavelRecord,
  StatusEntregavel,
  DocumentoRecord,
  TipoDocumento,
  RiscoRecord,
  ProbabilidadeRisco,
  ImpactoRisco,
  StatusRisco,
} from '@/types'

// ETAPAS
export interface CreateEtapaData {
  projeto: string
  nome: string
  descricao?: string
  ordem?: number
  disciplina?: string
  tipo_execucao: TipoExecucaoEtapa
  executor?: string
  prazo?: string
  data_inicio?: string
  data_conclusao?: string
  custo_estimado?: number
  status?: StatusEtapa
}

export const projetoEtapasService = {
  async listByProjeto(projetoId: string): Promise<ProjetoEtapaRecord[]> {
    return await pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: 'ordem,created',
      expand: 'executor,area',
    })
  },

  async create(data: CreateEtapaData): Promise<ProjetoEtapaRecord> {
    return await pb.collection('projeto_etapas').create<ProjetoEtapaRecord>(data)
  },

  async update(id: string, data: Partial<CreateEtapaData>): Promise<ProjetoEtapaRecord> {
    return await pb.collection('projeto_etapas').update<ProjetoEtapaRecord>(id, data)
  },

  async atualizarDatasGantt(
    etapaId: string,
    dataInicioYmd: string,
    prazoYmd: string,
    etapaAnterior?: ProjetoEtapaRecord,
  ): Promise<ProjetoEtapaRecord> {
    const dataInicioIso = dataInicioYmd ? `${dataInicioYmd} 00:00:00.000Z` : null
    const prazoIso = prazoYmd ? `${prazoYmd} 23:59:59.000Z` : null

    // Atualização com gravação direta na coleção
    const updated = await pb.collection('projeto_etapas').update<ProjetoEtapaRecord>(etapaId, {
      data_inicio: dataInicioIso,
      prazo: prazoIso,
    })

    // Registro explícito e detalhado em audit_logs via auditService.log
    const antesObj = {
      data_inicio: etapaAnterior?.data_inicio || null,
      prazo: etapaAnterior?.prazo || etapaAnterior?.prazo_fim || null,
    }
    const depoisObj = {
      data_inicio: dataInicioIso,
      prazo: prazoIso,
    }

    await pb
      .collection('audit_logs')
      .create({
        user: pb.authStore.record?.id || pb.authStore.model?.id || null,
        user_email: pb.authStore.record?.email || (pb.authStore.model as any)?.email || 'SISTEMA',
        acao: 'EDICAO_CRONOGRAMA_GANTT',
        entidade: 'projeto_etapas',
        registro_id: etapaId,
        detalhes: {
          etapa_nome: etapaAnterior?.nome || updated.nome,
          projeto_id: updated.projeto,
          antes: antesObj,
          depois: depoisObj,
          origem: 'Gantt Interativo',
        },
      })
      .catch((err) => {
        console.warn('Falha ao gravar auditoria do Gantt:', err)
      })

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('projeto_etapas').delete(id)
  },

  // Aplicar modelo padrão de etapas por disciplina
  async aplicarModeloPadrao(projetoId: string, disciplina: string, etapasNomes: string[]) {
    const etapasExistentes = await this.listByProjeto(projetoId)
    let ordemAtual = etapasExistentes.length

    for (const nome of etapasNomes) {
      ordemAtual++
      await this.create({
        projeto: projetoId,
        nome,
        disciplina,
        ordem: ordemAtual,
        tipo_execucao: 'direta',
        status: 'a_iniciar',
      })
    }
  },
}

// ENTREGÁVEIS
export interface CreateEntregavelData {
  etapa: string
  nome: string
  descricao?: string
  versao?: string
  status?:
    | StatusEntregavel
    | 'atribuido'
    | 'em_producao'
    | 'enviado_revisao'
    | 'aprovado'
    | 'devolvido'
  arquivo?: File | string
  data_aprovacao?: string
  observacoes_revisao?: string
}

export const entregaveisService = {
  async listByEtapa(etapaId: string): Promise<EntregavelRecord[]> {
    return await pb.collection('entregaveis').getFullList<EntregavelRecord>({
      filter: `etapa = '${etapaId}'`,
      sort: 'created',
      expand: 'etapa',
    })
  },

  async create(data: CreateEntregavelData): Promise<EntregavelRecord> {
    const formData = new FormData()
    formData.append('etapa', data.etapa)
    formData.append('nome', data.nome)
    if (data.descricao) formData.append('descricao', data.descricao)
    formData.append('versao', data.versao || 'Rev.00')
    formData.append('status', data.status || 'elaborando')
    if (data.arquivo instanceof File) {
      formData.append('arquivo', data.arquivo)
    }
    if (data.observacoes_revisao) {
      formData.append('observacoes_revisao', data.observacoes_revisao)
    }
    return await pb.collection('entregaveis').create<EntregavelRecord>(formData)
  },

  async update(id: string, data: Partial<CreateEntregavelData>): Promise<EntregavelRecord> {
    const formData = new FormData()
    if (data.etapa) formData.append('etapa', data.etapa)
    if (data.nome) formData.append('nome', data.nome)
    if (data.descricao !== undefined) formData.append('descricao', data.descricao)
    if (data.versao) formData.append('versao', data.versao)
    if (data.status) formData.append('status', data.status)
    if (data.arquivo instanceof File) {
      formData.append('arquivo', data.arquivo)
    }
    if (data.data_aprovacao !== undefined) {
      formData.append('data_aprovacao', data.data_aprovacao || '')
    }
    if (data.observacoes_revisao !== undefined) {
      formData.append('observacoes_revisao', data.observacoes_revisao)
    }
    return await pb.collection('entregaveis').update<EntregavelRecord>(id, formData)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('entregaveis').delete(id)
  },
}

// DOCUMENTOS
export interface CreateDocumentoData {
  projeto: string
  etapa?: string
  tipo: TipoDocumento
  numero?: string
  descricao?: string
  responsavel_tecnico?: string
  arquivo?: File | string
  vencimento?: string
}

export const documentosService = {
  async listByProjeto(projetoId: string): Promise<DocumentoRecord[]> {
    return await pb.collection('documentos').getFullList<DocumentoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: 'vencimento',
      expand: 'etapa',
    })
  },

  async create(data: CreateDocumentoData): Promise<DocumentoRecord> {
    const formData = new FormData()
    formData.append('projeto', data.projeto)
    if (data.etapa) formData.append('etapa', data.etapa)
    formData.append('tipo', data.tipo)
    if (data.numero) formData.append('numero', data.numero)
    if (data.descricao) formData.append('descricao', data.descricao)
    if (data.responsavel_tecnico) formData.append('responsavel_tecnico', data.responsavel_tecnico)
    if (data.vencimento) formData.append('vencimento', data.vencimento)
    if (data.arquivo instanceof File) {
      formData.append('arquivo', data.arquivo)
    }
    return await pb.collection('documentos').create<DocumentoRecord>(formData)
  },

  async update(id: string, data: Partial<CreateDocumentoData>): Promise<DocumentoRecord> {
    const formData = new FormData()
    if (data.etapa !== undefined) formData.append('etapa', data.etapa || '')
    if (data.tipo) formData.append('tipo', data.tipo)
    if (data.numero !== undefined) formData.append('numero', data.numero || '')
    if (data.descricao !== undefined) formData.append('descricao', data.descricao || '')
    if (data.responsavel_tecnico !== undefined) {
      formData.append('responsavel_tecnico', data.responsavel_tecnico || '')
    }
    if (data.vencimento !== undefined) formData.append('vencimento', data.vencimento || '')
    if (data.arquivo instanceof File) {
      formData.append('arquivo', data.arquivo)
    }
    return await pb.collection('documentos').update<DocumentoRecord>(id, formData)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('documentos').delete(id)
  },
}

// RISCOS
export interface CreateRiscoData {
  projeto: string
  descricao: string
  probabilidade: ProbabilidadeRisco
  impacto: ImpactoRisco
  mitigacao?: string
  status?: StatusRisco
}

export const riscosService = {
  async listByProjeto(projetoId: string): Promise<RiscoRecord[]> {
    return await pb.collection('riscos').getFullList<RiscoRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: '-created',
    })
  },

  async create(data: CreateRiscoData): Promise<RiscoRecord> {
    return await pb.collection('riscos').create<RiscoRecord>({
      ...data,
      status: data.status || 'aberto',
    })
  },

  async update(id: string, data: Partial<CreateRiscoData>): Promise<RiscoRecord> {
    return await pb.collection('riscos').update<RiscoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('riscos').delete(id)
  },
}
