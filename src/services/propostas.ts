import pb from '@/lib/pocketbase/client'
import {
  PropostaRecord,
  PropostaItemRecord,
  PropostaRevisaoHistorico,
  PropostaParcelaRecord,
} from '@/types'
import { auditService } from '@/services/audit'

export interface CreatePropostaData {
  numero?: string
  revisao?: string
  empresa?: string
  cliente_pf?: string
  contrato?: string
  modelo?: string
  escopo: string
  disciplinas?: string
  entregaveis?: string
  prazo?: string
  preco: number
  custo?: number
  margem?: number
  impostos?: number
  requer_nota?: boolean
  condicoes_pagamento?: string
  validade?: string
  premissas?: string
  exclusoes?: string
  status?: PropostaRecord['status']
  token_aceite?: string
  itens_json?: PropostaItemRecord[]
  historico_revisoes?: PropostaRevisaoHistorico[]
  criado_por?: string
  requer_aprovacao_admin?: boolean
  empreendimento?: string
  objeto?: string
  escopo_gerado?: string
  prazo_dias?: number
  nota_prazo?: string
  validade_dias?: number
  condicoes_gerais?: string
  dados_complementares_preenchidos?: boolean
}

export interface PropostaParcelaItemInput {
  id?: string
  ordem?: number
  percentual: number
  valor: number
  gatilho: 'contratacao' | 'entrega' | 'marco'
  descricao: string
}

export interface UpdatePropostaData extends Partial<CreatePropostaData> {
  motivo_recusa?: string
  detalhe_recusa?: string
  data_visualizacao?: string
  data_aceite?: string
  data_recusa?: string
  parecer_financeiro?: string
  aprovador_financeiro?: string
  data_aprovacao_financeira?: string
  aprovador_admin?: string
  data_aprovacao_admin?: string
}

export interface PropostaFilters {
  status?: string
  empresaId?: string
  clientePfId?: string
  busca?: string
  periodoMes?: string
}

export interface MetricasPropostas {
  totalCriadas: number
  totalEnviadas: number
  totalAceitas: number
  totalRecusadas: number
  totalExpiradas: number
  totalEmNegociacao: number
  taxaAceite: number // (aceitas / enviadas_totais) * 100
  valorTotalAceitas: number
  recusasPorMotivo: Record<string, number>
}

export const propostasService = {
  async list(filters?: PropostaFilters): Promise<PropostaRecord[]> {
    const filterClauses: string[] = []

    if (filters?.status && filters.status !== 'todos') {
      filterClauses.push(`status = '${filters.status}'`)
    }
    if (filters?.empresaId) {
      filterClauses.push(`empresa = '${filters.empresaId}'`)
    }
    if (filters?.clientePfId) {
      filterClauses.push(`cliente_pf = '${filters.clientePfId}'`)
    }

    const filter = filterClauses.join(' && ')

    return pb.collection('propostas').getFullList<PropostaRecord>({
      filter: filter || undefined,
      sort: '-created',
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por,aprovador_financeiro,aprovador_admin',
    })
  },

  async getById(id: string): Promise<PropostaRecord> {
    return pb.collection('propostas').getOne<PropostaRecord>(id, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por,aprovador_financeiro,aprovador_admin',
    })
  },

  async getByToken(token: string): Promise<PropostaRecord | null> {
    try {
      // Passar o token tanto no query filter quanto como query param ?token= e header x-token-aceite
      // para satisfazer a viewRule/listRule de propostas sem autenticação
      const records = await pb.collection('propostas').getFullList<PropostaRecord>({
        filter: `token_aceite = '${token}'`,
        expand: 'empresa,cliente_pf,contrato',
        requestKey: null,
        token: token,
        headers: {
          'x-token-aceite': token,
        },
      } as any)
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar proposta pelo token:', err)
      return null
    }
  },

  async create(data: CreatePropostaData): Promise<PropostaRecord> {
    const created = await pb.collection('propostas').create<PropostaRecord>(data, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por',
    })

    // Sincronizar itens na tabela proposta_itens (sanitizado contra erro 400 no PocketBase)
    if (data.itens_json && Array.isArray(data.itens_json)) {
      for (const item of data.itens_json) {
        try {
          const payloadItem: Record<string, any> = {
            proposta: created.id,
            descricao: item.descricao,
            disciplina: item.disciplina || '',
            unidade: item.unidade || 'un',
            subservicos: item.subservicos || [],
            status_conversao: item.status_conversao || 'nao_convertido',
            quantidade: Number(item.quantidade) || 1,
            custo_unitario: Number(item.custo_unitario) || 0,
            custo_total: Number(item.custo_total) || 0,
            bdi_percentual: Number(item.bdi_percentual) || 0,
            preco_total: Number(item.preco_total) || 0,
          }

          // Relações opcionais: incluir APENAS se ID for válido (não vazio e não '__nenhum__')
          if (
            item.servico &&
            item.servico !== '__nenhum__' &&
            typeof item.servico === 'string' &&
            item.servico.trim().length > 0
          ) {
            payloadItem.servico = item.servico.trim()
          }
          if (
            item.area &&
            item.area !== '__nenhum__' &&
            typeof item.area === 'string' &&
            item.area.trim().length > 0
          ) {
            payloadItem.area = item.area.trim()
          }
          if (
            item.projeto_gerado &&
            item.projeto_gerado !== '__nenhum__' &&
            typeof item.projeto_gerado === 'string' &&
            item.projeto_gerado.trim().length > 0
          ) {
            payloadItem.projeto_gerado = item.projeto_gerado.trim()
          }
          if (
            item.etapa_gerada &&
            item.etapa_gerada !== '__nenhum__' &&
            typeof item.etapa_gerada === 'string' &&
            item.etapa_gerada.trim().length > 0
          ) {
            payloadItem.etapa_gerada = item.etapa_gerada.trim()
          }

          await pb.collection('proposta_itens').create(payloadItem)
        } catch (itemErr) {
          console.warn('Erro ao salvar item na tabela proposta_itens:', itemErr)
        }
      }
    }

    return created
  },

  async update(id: string, data: UpdatePropostaData): Promise<PropostaRecord> {
    const updated = await pb.collection('propostas').update<PropostaRecord>(id, data, {
      expand: 'empresa,cliente_pf,contrato,modelo,criado_por',
    })

    // Se itens_json foi atualizado, sincronizar com proposta_itens (sanitizado contra erro 400 no PocketBase)
    if (data.itens_json && Array.isArray(data.itens_json)) {
      try {
        const existingItens = await pb.collection('proposta_itens').getFullList({
          filter: `proposta = '${id}'`,
        })

        // Para evitar apagar vínculos com projetos já existentes, se não houver vínculos, recriar
        const hasConverted = existingItens.some((i: any) => i.status_conversao === 'convertido')
        if (!hasConverted) {
          for (const old of existingItens) {
            await pb.collection('proposta_itens').delete(old.id)
          }
          for (const item of data.itens_json) {
            const payloadItem: Record<string, any> = {
              proposta: id,
              descricao: item.descricao,
              disciplina: item.disciplina || '',
              unidade: item.unidade || 'un',
              subservicos: item.subservicos || [],
              status_conversao: item.status_conversao || 'nao_convertido',
              quantidade: Number(item.quantidade) || 1,
              custo_unitario: Number(item.custo_unitario) || 0,
              custo_total: Number(item.custo_total) || 0,
              bdi_percentual: Number(item.bdi_percentual) || 0,
              preco_total: Number(item.preco_total) || 0,
            }

            // Relações opcionais: incluir APENAS se ID for válido (não vazio e não '__nenhum__')
            if (
              item.servico &&
              item.servico !== '__nenhum__' &&
              typeof item.servico === 'string' &&
              item.servico.trim().length > 0
            ) {
              payloadItem.servico = item.servico.trim()
            }
            if (
              item.area &&
              item.area !== '__nenhum__' &&
              typeof item.area === 'string' &&
              item.area.trim().length > 0
            ) {
              payloadItem.area = item.area.trim()
            }
            if (
              item.projeto_gerado &&
              item.projeto_gerado !== '__nenhum__' &&
              typeof item.projeto_gerado === 'string' &&
              item.projeto_gerado.trim().length > 0
            ) {
              payloadItem.projeto_gerado = item.projeto_gerado.trim()
            }
            if (
              item.etapa_gerada &&
              item.etapa_gerada !== '__nenhum__' &&
              typeof item.etapa_gerada === 'string' &&
              item.etapa_gerada.trim().length > 0
            ) {
              payloadItem.etapa_gerada = item.etapa_gerada.trim()
            }

            await pb.collection('proposta_itens').create(payloadItem)
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar proposta_itens no update:', err)
      }
    }

    return updated
  },
  async delete(id: string): Promise<boolean> {
    return pb.collection('propostas').delete(id)
  },

  /**
   * Cálculo de Alçada:
   * Comercial aprova sozinho até R$ 100 mil E margem >= 20%.
   * Acima disso, requer aprovação do Admin.
   * Financeiro participa da aprovação interna (leitura + parecer).
   */
  avaliarAlcada(
    preco: number,
    margemPercent: number,
    limiteValor: number = 100000,
    margemMinima: number = 20,
    custoInformado: boolean = true,
  ): { requerAdmin: boolean; motivoAlcada: string } {
    const excedePreco = preco > limiteValor

    // Quando custo não for informado no item, a alçada considera apenas o valor total
    if (!custoInformado) {
      if (excedePreco) {
        return {
          requerAdmin: true,
          motivoAlcada: `Valor total (R$ ${preco.toLocaleString('pt-BR')}) superior à alçada comercial de R$ ${limiteValor.toLocaleString('pt-BR')} (sem custo direto informado)`,
        }
      }
      return {
        requerAdmin: false,
        motivoAlcada: 'Dentro da alçada autônoma do Comercial por valor total',
      }
    }

    const margemAbaixo = margemPercent < margemMinima

    if (excedePreco && margemAbaixo) {
      return {
        requerAdmin: true,
        motivoAlcada: `Valor (R$ ${preco.toLocaleString('pt-BR')}) acima de R$ ${limiteValor.toLocaleString('pt-BR')} e Margem efetiva (${margemPercent.toFixed(1)}%) abaixo de ${margemMinima}%`,
      }
    }
    if (excedePreco) {
      return {
        requerAdmin: true,
        motivoAlcada: `Valor total (R$ ${preco.toLocaleString('pt-BR')}) superior à alçada comercial de R$ ${limiteValor.toLocaleString('pt-BR')}`,
      }
    }
    if (margemAbaixo) {
      return {
        requerAdmin: true,
        motivoAlcada: `Margem de lucro efetiva (${margemPercent.toFixed(1)}%) inferior ao piso mínimo de ${margemMinima}%`,
      }
    }

    return {
      requerAdmin: false,
      motivoAlcada: 'Dentro da alçada autônoma do Comercial',
    }
  },

  /**
   * Cálculo automático do Preço = Custo + Margem + Impostos
   * Fórmula padrão de engenharia com BDI sobre o custo:
   * Preço = Custo / (1 - (Margem% + Impostos%) / 100)
   * OU Preço = Custo + (Custo * Margem%) + (Custo * Impostos%)
   * O requisito define: "Preço = custo + margem + impostos, calculado dos itens (custo por item + % margem + % impostos)"
   */
  calcularTotais(
    custoTotal: number,
    margemPercent: number,
    impostosPercent: number,
    precoVendaBase?: number,
    requerNota: boolean = false,
  ): {
    custo: number
    valorMargem: number
    valorImpostos: number
    precoVendaSemImpostos: number
    precoTotal: number
    margemEfetivaValor: number
    margemEfetivaPercent: number
  } {
    // Se precoVendaBase fornecido (soma dos preços de venda dos itens), usar o novo modelo
    // Caso contrário (compatibilidade legada), calcular precoVendaBase = custoTotal + (custoTotal * margemPercent / 100)
    const baseVenda =
      precoVendaBase !== undefined && precoVendaBase >= 0
        ? precoVendaBase
        : custoTotal + (custoTotal * margemPercent) / 100

    const impostosAplicaveis = requerNota ? impostosPercent : 0
    const valorImpostos = (baseVenda * impostosAplicaveis) / 100
    const precoTotal = baseVenda + valorImpostos
    const margemEfetivaValor = baseVenda - custoTotal
    const margemEfetivaPercent = baseVenda > 0 ? (margemEfetivaValor / baseVenda) * 100 : 0

    return {
      custo: Math.round(custoTotal * 100) / 100,
      valorMargem: Math.round(margemEfetivaValor * 100) / 100,
      valorImpostos: Math.round(valorImpostos * 100) / 100,
      precoVendaSemImpostos: Math.round(baseVenda * 100) / 100,
      precoTotal: Math.round(precoTotal * 100) / 100,
      margemEfetivaValor: Math.round(margemEfetivaValor * 100) / 100,
      margemEfetivaPercent: Math.round(margemEfetivaPercent * 10) / 10,
    }
  },

  /**
   * Cria nova revisão da proposta: Rev.01, Rev.02...
   * Mantém o mesmo número de proposta (PROP-AAAA-NNNN), revalida internamente (volta para rascunho),
   * limpa dados de aceite anterior e invalida token antigo (token só gerado após nova validação).
   */
  async criarRevisao(proposta: PropostaRecord, responsavelNome: string): Promise<PropostaRecord> {
    const revisaoAtual = proposta.revisao || 'Rev.00'
    const match = revisaoAtual.match(/\d+/)
    const seq = match ? parseInt(match[0], 10) : 0
    const novaRevisao = `Rev.${String(seq + 1).padStart(2, '0')}`

    const snapshotHistorico: PropostaRevisaoHistorico = {
      revisao: revisaoAtual,
      data: new Date().toISOString(),
      responsavel_nome: responsavelNome,
      preco: proposta.preco,
      custo: proposta.custo || 0,
      margem: proposta.margem || 0,
      impostos: proposta.impostos || 0,
      conteudo_snapshot: {
        escopo: proposta.escopo,
        disciplinas: proposta.disciplinas,
        entregaveis: proposta.entregaveis,
        prazo: proposta.prazo,
        condicoes_pagamento: proposta.condicoes_pagamento,
        premissas: proposta.premissas,
        exclusoes: proposta.exclusoes,
        itens_json: proposta.itens_json || [],
      },
    }

    const historicoAtualizado = [...(proposta.historico_revisoes || []), snapshotHistorico]

    const updated = await this.update(proposta.id, {
      revisao: novaRevisao,
      status: 'rascunho', // Revisão volta a Rascunho para revalidação interna
      token_aceite: '', // Invalida link anterior
      data_aceite: '',
      data_recusa: '',
      motivo_recusa: '',
      detalhe_recusa: '',
      solicitacao_alteracao_texto: '',
      data_solicitacao_alteracao: '',
      aceite_ip: '',
      aceite_user_agent: '',
      aceite_declaracao: false,
      aceite_hash: '',
      historico_revisoes: historicoAtualizado,
    })

    await auditService.log({
      action: 'CRIACAO_NOVA_REVISAO_PROPOSTA',
      entity_type: 'propostas',
      entity_id: proposta.id,
      details: {
        mensagem: `Nova revisão ${novaRevisao} criada a partir da ${revisaoAtual}. Proposta retornada para rascunho para revalidação interna.`,
        proposta_numero: proposta.numero,
        revisao_anterior: revisaoAtual,
        nova_revisao: novaRevisao,
      },
    })

    return updated
  },

  /**
   * Enviar proposta por e-mail transacional via endpoint dedicado do backend
   */
  async enviarPorEmail(params: {
    propostaId: string
    destinatarioEmail: string
    destinatarioNome?: string
    assunto?: string
    corpo?: string
  }): Promise<{ success: boolean; message: string; link_proposta?: string }> {
    return await pb.send('/backend/v1/propostas/enviar-email', {
      method: 'POST',
      body: {
        proposta_id: params.propostaId,
        destinatario_email: params.destinatarioEmail,
        destinatario_nome: params.destinatarioNome,
        assunto: params.assunto,
        corpo: params.corpo,
      },
    })
  },

  /**
   * Registrar envio manual (cópia de link ao cliente)
   */
  async registrarEnvioManual(
    propostaId: string,
    destinatarioNome?: string,
    destinatarioContato?: string,
  ): Promise<{ success: boolean; message: string; link_proposta?: string }> {
    return await pb.send('/backend/v1/propostas/registrar-envio-manual', {
      method: 'POST',
      body: {
        proposta_id: propostaId,
        destinatario_nome: destinatarioNome || '',
        destinatario_contato: destinatarioContato || '',
      },
    })
  },

  /**
   * Registrar auditoria de disparo da proposta via WhatsApp
   */
  async registrarEnvioWhatsApp(params: {
    propostaId: string
    destinatarioTelefone?: string
    destinatarioNome?: string
  }): Promise<{ success: boolean; message: string }> {
    return await pb.send('/backend/v1/propostas/registrar-envio-whatsapp', {
      method: 'POST',
      body: {
        proposta_id: params.propostaId,
        destinatario_telefone: params.destinatarioTelefone,
        destinatario_nome: params.destinatarioNome,
      },
    })
  },

  /**
   * Cliente solicita alterações via link público
   */
  async solicitarAlteracoes(tokenAceite: string, texto: string): Promise<any> {
    return await pb.send('/backend/v1/propostas/solicitar-alteracoes', {
      method: 'POST',
      body: {
        token_aceite: tokenAceite,
        texto,
      },
    })
  },

  /**
   * Aceite digital com validade jurídica (declaração, IP, hash)
   */
  async aceitarDigital(params: {
    tokenAceite: string
    declaracao: boolean
    hashConteudo?: string
  }): Promise<any> {
    return await pb.send('/backend/v1/propostas/aceitar-digital', {
      method: 'POST',
      body: {
        token_aceite: params.tokenAceite,
        declaracao: params.declaracao,
        hash_conteudo: params.hashConteudo,
      },
    })
  },

  /**
   * Verificação e Expiração Automática de Propostas Vencidas ao abrir o sistema
   */
  async verificarEAtualizarExpiradas(propostas: PropostaRecord[]): Promise<PropostaRecord[]> {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atualizadas: PropostaRecord[] = []

    for (const p of propostas) {
      if (
        (p.status === 'enviada' || p.status === 'visualizada' || p.status === 'em_negociacao') &&
        p.validade
      ) {
        const dataValidade = new Date(p.validade)
        dataValidade.setHours(23, 59, 59, 999)

        if (hoje.getTime() > dataValidade.getTime()) {
          try {
            const exp = await pb.collection('propostas').update<PropostaRecord>(p.id, {
              status: 'expirada',
            })
            atualizadas.push(exp)
          } catch (err) {
            console.warn(`Erro ao expirar proposta ${p.numero}:`, err)
          }
        }
      }
    }

    return atualizadas
  },

  /**
   * Consolidação de métricas: taxa de aceite e distribuição de recusas
   */
  calcularMetricas(propostas: PropostaRecord[]): MetricasPropostas {
    let totalCriadas = propostas.length
    let totalEnviadas = 0
    let totalAceitas = 0
    let totalRecusadas = 0
    let totalExpiradas = 0
    let totalEmNegociacao = 0
    let valorTotalAceitas = 0
    const recusasPorMotivo: Record<string, number> = {}

    // Status considerados como propostas que chegaram a ser enviadas ao cliente
    const statusEnviadas = [
      'enviada',
      'visualizada',
      'em_negociacao',
      'aceita',
      'recusada',
      'expirada',
    ]

    for (const p of propostas) {
      if (statusEnviadas.includes(p.status)) {
        totalEnviadas++
      }

      if (p.status === 'aceita') {
        totalAceitas++
        valorTotalAceitas += Number(p.preco) || 0
      } else if (p.status === 'recusada') {
        totalRecusadas++
        const motivo = p.motivo_recusa || 'Outro motivo'
        recusasPorMotivo[motivo] = (recusasPorMotivo[motivo] || 0) + 1
      } else if (p.status === 'expirada') {
        totalExpiradas++
      } else if (p.status === 'em_negociacao') {
        totalEmNegociacao++
      }
    }

    const taxaAceite =
      totalEnviadas > 0 ? Math.round((totalAceitas / totalEnviadas) * 1000) / 10 : 0

    return {
      totalCriadas,
      totalEnviadas,
      totalAceitas,
      totalRecusadas,
      totalExpiradas,
      totalEmNegociacao,
      taxaAceite,
      valorTotalAceitas,
      recusasPorMotivo,
    }
  },

  /**
   * Gerador automático da redação do Objeto no formato oficial GMAIS
   */
  gerarObjetoAutomatico(params: {
    empreendimento?: string
    municipio?: string
    uf?: string
    itens?: PropostaItemRecord[]
  }): string {
    const emp = params.empreendimento?.trim() || 'Empreendimento'
    const mun = params.municipio?.trim()
    const uf = params.uf?.trim()
    const local = mun && uf ? `em ${mun}–${uf}` : mun || (uf ? `– ${uf}` : '')

    // Compilar serviços distintos por área ou disciplina
    const servicosNomes: string[] = []
    if (params.itens && params.itens.length > 0) {
      for (const it of params.itens) {
        if (it.descricao && !servicosNomes.includes(it.descricao)) {
          servicosNomes.push(it.descricao)
        }
      }
    }

    const resumoServicos =
      servicosNomes.length > 0
        ? servicosNomes.slice(0, 4).join(', ') +
          (servicosNomes.length > 4 ? ' e demais especialidades' : '')
        : 'projetos de engenharia e consultoria técnica especializada'

    return `Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para a elaboração de ${resumoServicos} destinados ao empreendimento "${emp}"${local ? ` ${local}` : ''}, em conformidade com as diretrizes e necessidades apresentadas pela CONTRATANTE.`
  },

  /**
   * Gerador automático do Escopo Técnico dos Serviços no formato oficial GMAIS
   * Gera lista numerada consolidada com cada área e seus subserviços / itens
   */
  gerarEscopoAutomatico(params: {
    itens: PropostaItemRecord[]
    areas?: Array<{ id: string; nome: string }>
  }): string {
    if (!params.itens || params.itens.length === 0) {
      return ''
    }

    const linhas: string[] = []
    let contador = 1

    // Agrupar itens por área quando disponível
    const porArea = new Map<string, PropostaItemRecord[]>()
    for (const it of params.itens) {
      const areaKey = it.area || 'geral'
      if (!porArea.has(areaKey)) {
        porArea.set(areaKey, [])
      }
      porArea.get(areaKey)!.push(it)
    }

    for (const [areaId, itensArea] of porArea.entries()) {
      const areaNome =
        params.areas?.find((a) => a.id === areaId)?.nome ||
        (areaId !== 'geral' ? areaId : 'Serviços Técnicos')
      linhas.push(`${contador}. PROJETO / DISCIPLINA: ${areaNome.toUpperCase()}`)
      contador++

      itensArea.forEach((it) => {
        linhas.push(`   • ${it.descricao}`)
        if (it.subservicos && it.subservicos.length > 0) {
          it.subservicos.forEach((sub) => {
            linhas.push(`     - ${sub}`)
          })
        }
      })
      linhas.push('')
    }

    return linhas.join('\n').trim()
  },

  /**
   * Preenchimento automático de variáveis de modelo:
   * {nome}, {orgao}, {valor_contrato}, {numero_proposta}, {prazo}, etc.
   */
  substituirVariaveisModelo(
    texto: string,
    variaveis: {
      nome?: string
      orgao?: string
      valor_contrato?: string
      numero_proposta?: string
      prazo?: string
      disciplinas?: string
      preco?: string
    },
  ): string {
    let resultado = texto
    if (variaveis.nome) resultado = resultado.replace(/{nome}/g, variaveis.nome)
    if (variaveis.orgao) resultado = resultado.replace(/{orgao}/g, variaveis.orgao)
    if (variaveis.valor_contrato) {
      resultado = resultado.replace(/{valor_contrato}/g, variaveis.valor_contrato)
    }
    if (variaveis.numero_proposta) {
      resultado = resultado.replace(/{numero_proposta}/g, variaveis.numero_proposta)
    }
    if (variaveis.prazo) resultado = resultado.replace(/{prazo}/g, variaveis.prazo)
    if (variaveis.disciplinas) {
      resultado = resultado.replace(/{disciplinas}/g, variaveis.disciplinas)
    }
    if (variaveis.preco) resultado = resultado.replace(/{preco}/g, variaveis.preco)
    return resultado
  },

  /**
   * Parcelas de pagamento da proposta (proposta_parcelas)
   */
  async listParcelas(propostaId: string): Promise<PropostaParcelaRecord[]> {
    return pb.collection('proposta_parcelas').getFullList<PropostaParcelaRecord>({
      filter: `proposta = '${propostaId}'`,
      sort: 'ordem',
    })
  },

  async sincronizarParcelas(
    propostaId: string,
    parcelas: Array<{
      id?: string
      ordem: number
      percentual: number
      valor: number
      gatilho: 'contratacao' | 'entrega' | 'marco'
      descricao: string
    }>,
  ): Promise<PropostaParcelaRecord[]> {
    const existentes = await this.listParcelas(propostaId)
    const existentesIds = new Set(existentes.map((p) => p.id))
    const mantidosIds = new Set<string>()

    const resultados: PropostaParcelaRecord[] = []

    for (let i = 0; i < parcelas.length; i++) {
      const p = parcelas[i]
      const dados = {
        proposta: propostaId,
        ordem: i + 1,
        percentual: p.percentual,
        valor: p.valor,
        gatilho: p.gatilho,
        descricao: p.descricao,
      }

      if (p.id && existentesIds.has(p.id)) {
        mantidosIds.add(p.id)
        const updated = await pb
          .collection('proposta_parcelas')
          .update<PropostaParcelaRecord>(p.id, dados)
        resultados.push(updated)
      } else {
        const created = await pb
          .collection('proposta_parcelas')
          .create<PropostaParcelaRecord>(dados)
        resultados.push(created)
      }
    }

    // Remover parcelas deletadas
    for (const ex of existentes) {
      if (!mantidosIds.has(ex.id)) {
        try {
          await pb.collection('proposta_parcelas').delete(ex.id)
        } catch {
          /* intentionally ignored */
        }
      }
    }

    return resultados
  },

  async listItens(propostaId: string): Promise<PropostaItemRecord[]> {
    return pb.collection('proposta_itens').getFullList<PropostaItemRecord>({
      filter: `proposta = '${propostaId}'`,
      expand: 'servico,area,projeto_gerado,etapa_gerada',
    })
  },

  async updateItem(itemId: string, data: Partial<PropostaItemRecord>): Promise<PropostaItemRecord> {
    return pb.collection('proposta_itens').update<PropostaItemRecord>(itemId, data)
  },
}
