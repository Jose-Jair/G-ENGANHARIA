import pb from '@/lib/pocketbase/client'
import {
  ProjetoRecord,
  SaudeProjeto,
  ProjetoEtapaRecord,
  EntregavelRecord,
  DocumentoRecord,
  RiscoRecord,
  ContaRecord,
} from '@/types'

export interface CreateProjetoData {
  nome: string
  codigo?: string
  descricao?: string
  disciplinas?: string
  proposta?: string
  contrato?: string
  contrato_servico?: string
  grupo?: string
  modo_execucao?: import('@/types').ModoExecucaoProjeto
  descricao_delegada?: string
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
  alertaNivel: 'ok' | 'd30' | 'd15' | 'd7' | 'd1' | 'vencido' | null
}

export interface SugestaoSaudeProjeto {
  sugestao: SaudeProjeto
  motivos: string[]
  metricas: {
    etapasTotal: number
    etapasAtrasadas: number
    riscosAltosAbertos: number
    docsVencidosOuVencendo: number
    desvioPrazoDias: number
    pagoExecutores: number
    valorTotalContratado: number
  }
}
export const projetosService = {
  async list(): Promise<ProjetoRecord[]> {
    return await pb.collection('projetos').getFullList<ProjetoRecord>({
      sort: '-created',
      expand:
        'empresa,cliente_pf,proposta,proposta.empresa,proposta.cliente_pf,contrato_servico,grupo',
    })
  },

  async updateModoExecucao(
    id: string,
    modo_execucao: import('@/types').ModoExecucaoProjeto,
    descricao_delegada?: string,
  ): Promise<ProjetoRecord> {
    const atual = await pb.collection('projetos').getOne<ProjetoRecord>(id)
    const atualizado = await pb.collection('projetos').update<ProjetoRecord>(id, {
      modo_execucao,
      descricao_delegada: modo_execucao === 'terceirizada_parcial' ? descricao_delegada || '' : '',
    })

    try {
      await pb.send('/backend/v1/auditoria/registrar', {
        method: 'POST',
        body: {
          acao: 'ALTERACAO_MODO_EXECUCAO_PROJETO',
          entidade: 'projetos',
          registro_id: id,
          detalhes: {
            modo_anterior: atual.modo_execucao || 'direta',
            novo_modo: modo_execucao,
            descricao_delegada: descricao_delegada || null,
            codigo: atualizado.codigo,
            projeto_id: id,
          },
        },
      })
    } catch {
      // continua
    }

    return atualizado
  },

  async listTodasEtapas(): Promise<ProjetoEtapaRecord[]> {
    return await pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
      sort: 'ordem',
      expand: 'executor',
    })
  },
  async getById(id: string): Promise<ProjetoRecord> {
    return await pb.collection('projetos').getOne<ProjetoRecord>(id, {
      expand:
        'proposta,proposta.empresa,proposta.cliente_pf,contrato,contrato_servico,grupo,empresa,cliente_pf',
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

  // Atualizar a saúde do projeto com justificativa e auditoria de concordância/divergência
  async updateSaude(
    id: string,
    saude: SaudeProjeto,
    justificativa: string,
    sugestaoCalculada?: SaudeProjeto,
    motivosSugestao?: string[],
  ): Promise<ProjetoRecord> {
    const atual = await pb.collection('projetos').getOne<ProjetoRecord>(id)
    const atualizado = await pb.collection('projetos').update<ProjetoRecord>(id, {
      saude,
      justificativa_saude: justificativa,
    })

    // Auditoria no servidor via endpoint dedicado /backend/v1/auditoria/registrar
    try {
      const concordouComSugestao = sugestaoCalculada ? saude === sugestaoCalculada : undefined
      await pb.send('/backend/v1/auditoria/registrar', {
        method: 'POST',
        body: {
          acao: 'ATUALIZACAO_SAUDE_PROJETO',
          entidade: 'projetos',
          registro_id: id,
          detalhes: {
            saude_anterior: atual.saude,
            saude_nova: saude,
            sugestao_calculada: sugestaoCalculada || null,
            concordou_com_sugestao: concordouComSugestao,
            tipo_decisao:
              sugestaoCalculada && saude !== sugestaoCalculada
                ? 'DIVERGENCIA_COM_JUSTIFICATIVA'
                : 'CONCORDANCIA',
            motivos_sugestao: motivosSugestao || [],
            justificativa,
            codigo: atualizado.codigo,
          },
        },
      })
    } catch {
      // continua
    }

    return atualizado
  },

  // Busca dados completos de todas as abas (incluindo contrato de serviço) para a tela de detalhe do projeto
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

    let contratoServico: any = null

    // 1. Tentar buscar direto pelo ID do contrato_servico informado no projeto
    if (projeto.contrato_servico) {
      try {
        contratoServico = await pb
          .collection('contratos_servico')
          .getOne(projeto.contrato_servico, {
            expand: 'proposta,empresa,cliente_pf,assinante_admin',
            requestKey: null,
          })
      } catch {
        /* intentionally ignored */
      }
    }

    // 2. Tentar buscar pela relação projeto = projetoId
    if (!contratoServico) {
      try {
        const ctrs = await pb.collection('contratos_servico').getFullList({
          filter: `projeto = '${projetoId}'`,
          sort: '-created',
          expand: 'proposta,empresa,cliente_pf,assinante_admin',
          requestKey: null,
        })
        if (ctrs.length > 0) {
          contratoServico = ctrs[0]
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 3. Se o projeto pertence a um grupo, buscar o contrato do grupo ou através do grupo
    if (!contratoServico && projeto.grupo) {
      try {
        const grupo = await pb.collection('grupos_projetos').getOne(projeto.grupo, {
          requestKey: null,
        })
        if (grupo?.contrato_servico) {
          contratoServico = await pb
            .collection('contratos_servico')
            .getOne(grupo.contrato_servico, {
              expand: 'proposta,empresa,cliente_pf,assinante_admin',
              requestKey: null,
            })
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 4. Se ainda não encontrou contrato e o projeto tem proposta vinculada, buscar por proposta
    if (!contratoServico && projeto.proposta) {
      try {
        const ctrsProposta = await pb.collection('contratos_servico').getFullList({
          filter: `proposta = '${projeto.proposta}'`,
          sort: '-created',
          expand: 'proposta,empresa,cliente_pf,assinante_admin',
          requestKey: null,
        })
        if (ctrsProposta.length > 0) {
          contratoServico = ctrsProposta[0]
        }
      } catch {
        /* intentionally ignored */
      }
    }

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
      contratoServico,
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

  // Sugestão automática de Saúde do Projeto (🟢 Verde, 🟡 Amarelo, 🔴 Vermelho)
  // Baseada em: etapas atrasadas, riscos Alto/Alto abertos, documentos vencidos/vencendo, desvio de prazo e financeiro
  calcularSugestaoSaude(
    projeto: ProjetoRecord,
    etapas: ProjetoEtapaRecord[] = [],
    riscos: RiscoRecord[] = [],
    documentos: DocumentoRecord[] = [],
    contasPagar: ContaRecord[] = [],
  ): SugestaoSaudeProjeto {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const motivos: string[] = []
    let pontosProblema = 0 // 0 a 1: verde, 2 a 4: amarelo, 5+: vermelho

    // 1. Etapas atrasadas
    let etapasAtrasadas = 0
    let desvioPrazoDias = 0

    etapas.forEach((e) => {
      if (e.status !== 'concluida' && e.status !== 'cancelada') {
        const prazoFim = e.prazo_fim || (e as any).data_fim
        if (prazoFim) {
          const dFim = new Date(prazoFim)
          dFim.setHours(0, 0, 0, 0)
          const diff = Math.ceil((hoje.getTime() - dFim.getTime()) / (1000 * 3600 * 24))
          if (diff > 0) {
            etapasAtrasadas++
            if (diff > desvioPrazoDias) desvioPrazoDias = diff
          }
        }
      }
    })

    if (etapasAtrasadas > 1 || desvioPrazoDias > 15) {
      pontosProblema += 3
      motivos.push(
        `${etapasAtrasadas} etapa(s) atrasada(s) (maior atraso: ${desvioPrazoDias} dias)`,
      )
    } else if (etapasAtrasadas === 1 || desvioPrazoDias > 0) {
      pontosProblema += 1.5
      motivos.push(`1 etapa com atraso de ${desvioPrazoDias} dias`)
    }

    // 2. Riscos Alto/Alto em aberto
    const riscosAltosAbertos = riscos.filter((r) => {
      const status = (r.status || '').toLowerCase()
      if (status === 'mitigado' || status === 'resolvido') return false
      const prob = (r.probabilidade || '').toLowerCase()
      const imp = (r.impacto || '').toLowerCase()
      return (prob === 'alta' || prob === 'alto') && (imp === 'alta' || imp === 'alto')
    }).length

    if (riscosAltosAbertos >= 2) {
      pontosProblema += 3
      motivos.push(`${riscosAltosAbertos} riscos críticos (Alto/Alto) abertos sem mitigação`)
    } else if (riscosAltosAbertos === 1) {
      pontosProblema += 1.5
      motivos.push(`1 risco crítico (Alto/Alto) pendente de controle`)
    }

    // 3. Documentos vencidos ou vencendo em até 7 dias
    let docsVencidosOuVencendo = 0
    documentos.forEach((d) => {
      if (d.vencimento) {
        const v = new Date(d.vencimento)
        v.setHours(0, 0, 0, 0)
        const diff = Math.ceil((v.getTime() - hoje.getTime()) / (1000 * 3600 * 24))
        if (diff <= 7) {
          docsVencidosOuVencendo++
        }
      }
    })

    if (docsVencidosOuVencendo > 0) {
      pontosProblema += 1
      motivos.push(
        `${docsVencidosOuVencendo} documento(s) técnico(s) vencido(s) ou vencendo em 7 dias`,
      )
    }

    // 4. Situação financeira: se contas a pagar para executores excederem o valor contratado previsto
    const pagoExecutores = contasPagar
      .filter((c) => c.status === 'paga' || c.status === 'realizada')
      .reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
    const valorTotalContratado = Number(projeto.valor_total) || 0

    if (valorTotalContratado > 0 && pagoExecutores > valorTotalContratado) {
      pontosProblema += 2
      motivos.push('Desvio financeiro: pagamentos a executores superam o teto do projeto')
    }

    let sugestao: SaudeProjeto = 'verde'
    if (pontosProblema >= 3.5 || desvioPrazoDias >= 15 || riscosAltosAbertos >= 2) {
      sugestao = 'vermelho'
    } else if (pontosProblema >= 1.5 || etapasAtrasadas > 0 || docsVencidosOuVencendo > 0) {
      sugestao = 'amarelo'
    } else {
      sugestao = 'verde'
      if (motivos.length === 0) {
        motivos.push('Etapas no prazo, sem riscos críticos abertos e documentos em dia')
      }
    }

    return {
      sugestao,
      motivos,
      metricas: {
        etapasTotal: etapas.length,
        etapasAtrasadas,
        riscosAltosAbertos,
        docsVencidosOuVencendo,
        desvioPrazoDias,
        pagoExecutores,
        valorTotalContratado,
      },
    }
  },
}
