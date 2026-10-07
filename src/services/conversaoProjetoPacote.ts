import pb from '@/lib/pocketbase/client'
import {
  PropostaRecord,
  PropostaItemRecord,
  ProjetoRecord,
  ProjetoEtapaRecord,
  AreaAtuacaoRecord,
  EntregavelPadraoRecord,
} from '@/types'
import { propostasService } from './propostas'
import { entregaveisPadraoService } from './areasAtuacao'

export interface ItemAgrupadoPorArea {
  areaId: string
  areaNome: string
  itens: PropostaItemRecord[]
  valorTotal: number
  custoTotal: number
  prazoSugerido: string
  disciplina: string
  subservicos: string[]
  entregaveisSugeridos: string[]
}

export interface ConversaoProjetoPacoteParams {
  proposta: PropostaRecord
  itensSelecionadosIds: string[] // IDs de proposta_itens a converter nesta operação
  modoProjeto: 'novo' | 'incorporar'
  projetoExistenteId?: string // Se modo 'incorporar', ID do projeto-pacote existente
  nomeProjeto?: string // Se novo projeto
  subcontratacaoAutorizada?: boolean
  usuarioId?: string
  usuarioEmail?: string
}

export interface ResultadoConversaoProjetoPacote {
  projeto: ProjetoRecord
  etapasCriadas: ProjetoEtapaRecord[]
  itensConvertidosCount: number
  itensRestantesCount: number
  percentualConvertido: number
  isParcial: boolean
  isNovoProjeto: boolean
}

export const conversaoProjetoPacoteService = {
  /**
   * Agrupa itens selecionados por área de atuação técnica para exibição e geração de etapas.
   */
  async agruparItensPorArea(
    itens: PropostaItemRecord[],
    areas: AreaAtuacaoRecord[],
  ): Promise<ItemAgrupadoPorArea[]> {
    // Buscar entregáveis padrão ativos para sugestão automática nas etapas
    let entregaveisPadrao: EntregavelPadraoRecord[] = []
    try {
      entregaveisPadrao = await entregaveisPadraoService.listAtivos()
    } catch {
      /* intentionally ignored */
    }

    const mapaAreas = new Map<string, ItemAgrupadoPorArea>()

    for (const it of itens) {
      const areaId = it.area || 'sem_area'
      const areaObj = areas.find((a) => a.id === areaId)
      const areaNome = areaObj?.nome || 'Área Geral de Engenharia'

      if (!mapaAreas.has(areaId)) {
        // Encontrar entregáveis da área
        const entsDaArea = entregaveisPadrao
          .filter((e) => e.area === areaId && !e.subservico)
          .map((e) => e.nome)

        mapaAreas.set(areaId, {
          areaId,
          areaNome,
          itens: [],
          valorTotal: 0,
          custoTotal: 0,
          prazoSugerido: '30 dias',
          disciplina: it.disciplina || 'Engenharia Consultiva',
          subservicos: [],
          entregaveisSugeridos:
            entsDaArea.length > 0
              ? entsDaArea
              : ['Relatório Técnico', 'Memorial Descritivo', 'ART'],
        })
      }

      const grupo = mapaAreas.get(areaId)!
      grupo.itens.push(it)
      grupo.valorTotal += Number(it.preco_total) || 0
      grupo.custoTotal += Number(it.custo_total) || 0

      if (it.subservicos && Array.isArray(it.subservicos)) {
        for (const s of it.subservicos) {
          if (!grupo.subservicos.includes(s)) {
            grupo.subservicos.push(s)
          }
        }
      }
    }

    return Array.from(mapaAreas.values())
  },

  /**
   * Executa a conversão estruturada de itens de proposta em Projeto-Pacote
   * com etapas agrupadas por área de atuação e entregáveis pré-lançados.
   */
  async converterItensEmProjetoPacote(
    params: ConversaoProjetoPacoteParams,
  ): Promise<ResultadoConversaoProjetoPacote> {
    const {
      proposta,
      itensSelecionadosIds,
      modoProjeto,
      projetoExistenteId,
      nomeProjeto,
      subcontratacaoAutorizada = true,
      usuarioId,
      usuarioEmail,
    } = params

    // 1. Carregar todos os itens da proposta do banco
    const todosItens = await propostasService.listItens(proposta.id)
    const itensAConverter = todosItens.filter((i) => itensSelecionadosIds.includes(i.id || ''))

    if (itensAConverter.length === 0) {
      throw new Error('Nenhum item válido selecionado para conversão em projeto.')
    }

    // Carregar áreas para mapeamento
    const areas = await pb.collection('areas_atuacao').getFullList<AreaAtuacaoRecord>()
    const gruposPorArea = await this.agruparItensPorArea(itensAConverter, areas)

    let projeto: ProjetoRecord
    let isNovoProjeto = false

    // 2. Obter ou Criar o Projeto-Pacote
    // REGRA DE OURO FLUXO LINEAR: Projetos só devem existir se o Contrato de Serviços estiver assinado!
    // Verificar se já existe projeto gerado para esta proposta (via contrato assinado)
    const projetosExistentes = await pb.collection('projetos').getFullList<ProjetoRecord>({
      filter: `proposta = '${proposta.id}'`,
      sort: '-created',
    })

    if (modoProjeto === 'incorporar' && (projetoExistenteId || projetosExistentes.length > 0)) {
      const targetId = projetoExistenteId || projetosExistentes[0].id
      projeto = await pb.collection('projetos').getOne<ProjetoRecord>(targetId)
      // Atualizar valor total do projeto existente com os novos itens
      const novoValor =
        (Number(projeto.valor_total) || 0) +
        itensAConverter.reduce((acc, it) => acc + (Number(it.preco_total) || 0), 0)

      await pb.collection('projetos').update(projeto.id, {
        valor_total: novoValor,
      })
    } else if (projetosExistentes.length > 0) {
      // Já existe projeto gerado pelo contrato assinado -> reutilizar e incorporar para evitar duplicação
      projeto = projetosExistentes[0]
      const novoValor =
        (Number(projeto.valor_total) || 0) +
        itensAConverter.reduce((acc, it) => acc + (Number(it.preco_total) || 0), 0)

      await pb.collection('projetos').update(projeto.id, {
        valor_total: novoValor,
      })
    } else {
      // Bloquear criação direta de projeto a partir do frontend sem contrato assinado:
      // Verificar se a proposta tem contrato assinado
      let contratoAssinado = false
      if (proposta.id) {
        try {
          const ctrs = await pb.collection('contratos_servico').getFullList({
            filter: `proposta = '${proposta.id}' && status = 'assinado'`,
          })
          contratoAssinado = ctrs.length > 0
        } catch {
          /* intentionally ignored */
        }
      }

      if (!contratoAssinado) {
        throw new Error(
          'Fluxo linear estrito: Não é permitido criar projetos sem o Contrato de Serviços assinado por ambas as partes. Assine o contrato antes de gerenciar o projeto.',
        )
      }

      isNovoProjeto = true
      const valorTotalConversao = itensAConverter.reduce(
        (acc, it) => acc + (Number(it.preco_total) || 0),
        0,
      )

      // Criar novo Projeto-Pacote
      projeto = await pb.collection('projetos').create<ProjetoRecord>({
        nome:
          nomeProjeto ||
          `Pacote Técnico: ${proposta.numero} - ${
            proposta.expand?.empresa?.razao_social ||
            proposta.expand?.cliente_pf?.nome ||
            'Engenharia G+'
          }`,
        descricao: `Projeto-pacote originado da Proposta Técnica ${proposta.numero}.\nDisciplinas: ${
          proposta.disciplinas || ''
        }`,
        proposta: proposta.id,
        empresa: proposta.empresa || undefined,
        cliente_pf: proposta.cliente_pf || undefined,
        contrato: proposta.contrato || undefined,
        valor_total: valorTotalConversao,
        subcontratacao_autorizada: subcontratacaoAutorizada,
        status: 'em_andamento',
        saude: 'verde',
      })
    }

    // 3. Descobrir ordem inicial das etapas se for incorporar
    let ordemEtapa = 1
    if (!isNovoProjeto) {
      const etapasExistentes = await pb.collection('projeto_etapas').getFullList({
        filter: `projeto = '${projeto.id}'`,
        sort: '-ordem',
      })
      if (etapasExistentes.length > 0) {
        ordemEtapa = (etapasExistentes[0].ordem || etapasExistentes.length) + 1
      }
    }

    const etapasCriadas: ProjetoEtapaRecord[] = []

    // 4. Cada ÁREA técnica vira uma ETAPA do projeto (sanitizado com valores válidos do PocketBase)
    for (const grupo of gruposPorArea) {
      const nomeEtapa = `Etapa: ${grupo.areaNome}`
      const descEtapa = `Subserviços contemplados: ${
        grupo.subservicos.length > 0 ? grupo.subservicos.join(', ') : 'Serviços técnicos gerais'
      }.\nItens da proposta: ${grupo.itens.map((i) => i.descricao).join('; ')}`

      const payloadEtapa: Record<string, any> = {
        projeto: projeto.id,
        nome: nomeEtapa,
        descricao: descEtapa,
        disciplina: grupo.disciplina,
        ordem: ordemEtapa++,
        tipo_execucao: 'direta', // valores válidos: direta | terceirizada | mista
        custo_estimado: grupo.custoTotal,
        status: 'nao_iniciada',
      }

      // NUNCA enviar strings vazias em relations
      if (grupo.areaId && grupo.areaId !== 'sem_area') {
        payloadEtapa.area = grupo.areaId
      }

      const etapaCriada = await pb
        .collection('projeto_etapas')
        .create<ProjetoEtapaRecord>(payloadEtapa)
      etapasCriadas.push(etapaCriada)

      // 4.1 Lançar entregáveis padrão desta área/subserviço na etapa criada
      for (const entNome of grupo.entregaveisSugeridos) {
        try {
          await pb.collection('entregaveis').create({
            etapa: etapaCriada.id,
            nome: entNome,
            versao: 'v1.0',
            descricao: `Entregável técnico padrão da disciplina ${grupo.areaNome}`,
            status: 'pendente',
          })
        } catch (entErr) {
          console.warn('Erro ao criar entregável para etapa:', entErr)
        }
      }

      // 4.2 Atualizar o status dos itens vinculados a esta etapa e ao projeto
      for (const item of grupo.itens) {
        if (item.id) {
          await propostasService.updateItem(item.id, {
            status_conversao: 'convertido',
            projeto_gerado: projeto.id,
            etapa_gerada: etapaCriada.id,
          })
        }
      }
    }

    // 5. Atualizar itens_json no registro da proposta para manter sincronismo
    const itensAtualizadosJson = (proposta.itens_json || []).map((jsonItem: any, idx: number) => {
      const match = itensAConverter.find(
        (i) => i.descricao === jsonItem.descricao || i.id === jsonItem.id,
      )
      if (match) {
        return {
          ...jsonItem,
          status_conversao: 'convertido',
          projeto_gerado: projeto.id,
        }
      }
      return jsonItem
    })

    await propostasService.update(proposta.id, {
      itens_json: itensAtualizadosJson,
    })

    // 6. Calcular balanço de conversão
    const todosItensAtualizados = await propostasService.listItens(proposta.id)
    const convertidosCount = todosItensAtualizados.filter(
      (i) => i.status_conversao === 'convertido',
    ).length
    const restantesCount = todosItensAtualizados.length - convertidosCount
    const percentualConvertido =
      todosItensAtualizados.length > 0
        ? Math.round((convertidosCount / todosItensAtualizados.length) * 100)
        : 100

    // 7. Auditoria no servidor via endpoint /backend/v1/auditoria/registrar
    try {
      await pb.send('/backend/v1/auditoria/registrar', {
        method: 'POST',
        body: {
          acao: isNovoProjeto
            ? 'CONVERSAO_PROPOSTA_PROJETO_PACOTE'
            : 'INCORPORACAO_PROPOSTA_PROJETO_PACOTE',
          entidade: 'propostas',
          registro_id: proposta.id,
          user_id: usuarioId || pb.authStore.record?.id,
          user_email: usuarioEmail || pb.authStore.record?.email,
          detalhes: {
            proposta_numero: proposta.numero,
            projeto_codigo: projeto.codigo,
            projeto_id: projeto.id,
            modo: modoProjeto,
            areas_convertidas: gruposPorArea.map((g) => g.areaNome),
            itens_convertidos: itensAConverter.map((i) => i.descricao),
            etapas_geradas_ids: etapasCriadas.map((e) => e.id),
            percentual_total_convertido: percentualConvertido,
            itens_restantes: restantesCount,
          },
        },
      })
    } catch (auditErr) {
      console.warn('Erro ao registrar auditoria de conversão:', auditErr)
    }

    return {
      projeto,
      etapasCriadas,
      itensConvertidosCount: itensAConverter.length,
      itensRestantesCount: restantesCount,
      percentualConvertido,
      isParcial: restantesCount > 0,
      isNovoProjeto,
    }
  },

  /**
   * Busca projetos já vinculados a uma proposta para sugerir incorporação.
   */
  async listProjetosDaProposta(propostaId: string): Promise<ProjetoRecord[]> {
    return pb.collection('projetos').getFullList<ProjetoRecord>({
      filter: `proposta = '${propostaId}'`,
      sort: '-created',
    })
  },
}
