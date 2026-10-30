import pb from '@/lib/pocketbase/client'
import { ProjetoEtapaRecord, EntregavelRecord } from '@/types'

export interface GerarPacotesResultado {
  sucesso: boolean
  pacotesCriados: number
  marcosCriados: number
  entregaveisCriados: number
  mensagem: string
  pacotes: ProjetoEtapaRecord[]
}

export const geradorPacotesContratoService = {
  /**
   * Gera pacotes de trabalho e marcos a partir de um contrato já assinado.
   * Totalmente idempotente: não duplica pacotes nem marcos que já foram criados.
   */
  async gerarPacotesParaContrato(
    contratoId: string,
    projetoIdAlvo?: string,
  ): Promise<GerarPacotesResultado> {
    const contrato = await pb.collection('contratos_servico').getOne(contratoId)
    if (!contrato) {
      throw new Error('Contrato de serviço não encontrado.')
    }

    const propostaId = contrato.proposta || ''
    const contratoNumero = contrato.numero || 'CTR'
    const prazoDiasContrato = Number(contrato.prazo_dias) || 30
    const valorTotalContrato = Number(contrato.valor_total) || 0
    const objetoContrato = contrato.objeto || 'Prestação de serviços técnicos'

    // Identificar projeto
    let projetoId = projetoIdAlvo || contrato.projeto
    if (!projetoId) {
      const projetosContrato = await pb.collection('projetos').getFullList({
        filter: `contrato_servico = '${contratoId}'`,
        sort: '-created',
      })
      if (projetosContrato.length > 0) {
        projetoId = projetosContrato[0].id
      }
    }

    if (!projetoId && propostaId) {
      const projetosProposta = await pb.collection('projetos').getFullList({
        filter: `proposta = '${propostaId}'`,
        sort: '-created',
      })
      if (projetosProposta.length > 0) {
        projetoId = projetosProposta[0].id
      }
    }

    if (!projetoId) {
      throw new Error('Nenhum projeto encontrado vinculado a este contrato para gerar os pacotes.')
    }

    // 1. Obter itens de proposta
    let itensEscopo: Array<{
      id?: string
      descricao: string
      disciplina: string
      area?: string
      valor: number
      custo: number
      subservicos: string[]
    }> = []

    if (propostaId) {
      try {
        const itensDb = await pb.collection('proposta_itens').getFullList({
          filter: `proposta = '${propostaId}'`,
          sort: 'ordem,created',
        })
        if (itensDb.length > 0) {
          itensEscopo = itensDb
            .filter((it: any) => {
              const desc = (it.descricao || '').trim()
              return (it.servico || desc.length > 0) && !desc.startsWith('Item de Escopo ')
            })
            .map((it: any) => ({
              id: it.id,
              descricao: it.descricao,
              disciplina: it.disciplina || 'Geral',
              area: it.area,
              valor: Number(it.preco_total) || 0,
              custo: Number(it.custo_total) || 0,
              subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
            }))
        }
      } catch {
        /* ignore */
      }
    }

    if (itensEscopo.length === 0) {
      itensEscopo = [
        {
          descricao: objetoContrato,
          disciplina: 'Engenharia',
          valor: valorTotalContrato,
          custo: 0,
          subservicos: [],
        },
      ]
    }

    // 2. Carregar catálogo de escopos para pré-carregar entregáveis
    let catalogoEscopos: any[] = []
    try {
      catalogoEscopos = await pb.collection('catalogo_escopos').getFullList()
    } catch {
      /* ignore */
    }

    // 3. Buscar etapas existentes no projeto para garantir IDEMPOTÊNCIA ESTRITA
    const etapasExistentes = await pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
      filter: `projeto = '${projetoId}'`,
      sort: 'ordem',
    })

    let pacotesCriados = 0
    let marcosCriados = 0
    let entregaveisCriados = 0
    const pacotesRetorno: ProjetoEtapaRecord[] = []

    // 4. Criar ou reutilizar Pacotes de Trabalho
    const dtPrazoPacote = new Date()
    dtPrazoPacote.setDate(dtPrazoPacote.getDate() + prazoDiasContrato)
    const prazoIso = dtPrazoPacote.toISOString().substring(0, 10) + ' 12:00:00.000Z'

    let proximaOrdem =
      etapasExistentes.length > 0 ? Math.max(...etapasExistentes.map((e) => e.ordem || 0)) + 1 : 1

    for (const item of itensEscopo) {
      // Verificar se já existe pacote com mesma origem ou mesmo nome/disciplina
      const jaExiste = etapasExistentes.find(
        (e) =>
          (item.id && e.proposta_item_origem === item.id) ||
          (e.is_pacote_trabalho &&
            e.disciplina === item.disciplina &&
            e.nome.includes(item.disciplina)),
      )

      let pacoteRecord: ProjetoEtapaRecord
      if (jaExiste) {
        pacoteRecord = jaExiste
      } else {
        let desc = 'Subserviços contemplados: '
        if (item.subservicos.length > 0) {
          desc += item.subservicos.join(', ')
        } else {
          desc += 'Serviços técnicos de ' + item.disciplina
        }
        desc += '.\nItem do escopo: ' + item.descricao

        pacoteRecord = await pb.collection('projeto_etapas').create<ProjetoEtapaRecord>({
          projeto: projetoId,
          nome: 'Pacote: ' + (item.disciplina || item.descricao),
          disciplina: item.disciplina || 'Geral',
          ordem: proximaOrdem++,
          tipo_execucao: 'direta',
          status: 'nao_iniciada',
          custo_estimado: item.custo || 0,
          is_pacote_trabalho: true,
          is_marco: false,
          valor_interno_referencia: item.custo || 0,
          valor_vendido: item.valor || 0,
          escopo_detalhado: item.descricao || '',
          proposta_item_origem: item.id || undefined,
          descricao: desc,
          area: item.area || undefined,
          prazo: prazoIso,
        })
        pacotesCriados++
      }

      pacotesRetorno.push(pacoteRecord)

      // Verificar entregáveis para este pacote
      const entregaveisEtapa = await pb.collection('entregaveis').getFullList<EntregavelRecord>({
        filter: `etapa = '${pacoteRecord.id}'`,
      })

      if (entregaveisEtapa.length === 0) {
        // Encontrar entregáveis no catálogo de escopos
        let listaEntregaveis: Array<{ nome: string; descricao?: string }> = []
        const escopoMatch = catalogoEscopos.find(
          (c) =>
            (c.disciplina && c.disciplina.toLowerCase() === item.disciplina.toLowerCase()) ||
            (c.nome && c.nome.toLowerCase() === item.disciplina.toLowerCase()),
        )

        if (
          escopoMatch &&
          Array.isArray(escopoMatch.entregaveis_padrao) &&
          escopoMatch.entregaveis_padrao.length > 0
        ) {
          listaEntregaveis = escopoMatch.entregaveis_padrao
        } else {
          listaEntregaveis = [
            {
              nome: 'Relatório e Memorial de ' + (item.disciplina || 'Engenharia'),
              descricao: 'Memorial técnico descritivo e memória de cálculo',
            },
            {
              nome: 'Pranchas e Desenhos Técnicos',
              descricao: 'Plantas, cortes, detalhes e arquivos executivos',
            },
            {
              nome: 'Anotação de Responsabilidade Técnica (ART/RRT)',
              descricao: 'Registro de responsabilidade técnica perante o conselho de classe',
            },
          ]
        }

        for (const ent of listaEntregaveis) {
          try {
            await pb.collection('entregaveis').create({
              etapa: pacoteRecord.id,
              nome: ent.nome,
              titulo: ent.nome,
              versao: 'v1.0',
              versao_atual: 1,
              status: 'atribuido',
              descricao: ent.descricao || `Entregável da disciplina ${item.disciplina}`,
              prazo: prazoIso,
            })
            entregaveisCriados++
          } catch {
            /* ignore */
          }
        }
      }
    }

    // 5. Criar Marcos Financeiros a partir das parcelas da proposta
    if (propostaId) {
      try {
        const parcelas = await pb.collection('proposta_parcelas').getFullList({
          filter: `proposta = '${propostaId}'`,
          sort: 'ordem',
        })

        for (let i = 0; i < parcelas.length; i++) {
          const parc = parcelas[i]
          const ordem = parc.ordem || i + 1
          const perc = Number(parc.percentual) || 0
          const valorParc = Number(parc.valor) || (valorTotalContrato * perc) / 100
          const descParc = parc.descricao || `Parcela ${ordem}/${parcelas.length}`
          const gatilho = parc.gatilho || 'marco'

          const marcoExiste = etapasExistentes.find(
            (e) =>
              (e.is_marco && e.parcela_origem === parc.id) ||
              (e.is_marco && e.nome.includes(`Parcela ${ordem}`)),
          )

          if (!marcoExiste) {
            const diasVenc = i === 0 ? 15 : (i + 1) * 30
            const dtVenc = new Date()
            dtVenc.setDate(dtVenc.getDate() + diasVenc)
            const vencIso = dtVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z'

            await pb.collection('projeto_etapas').create({
              projeto: projetoId,
              nome: 'Marco Financeiro: Parcela ' + ordem + ' (' + descParc + ')',
              disciplina: 'Marco Financeiro',
              ordem: 100 + ordem,
              tipo_execucao: 'direta',
              status: 'nao_iniciada',
              is_marco: true,
              is_pacote_trabalho: false,
              valor_vendido: valorParc,
              valor_interno_referencia: valorParc,
              parcela_origem: parc.id,
              prazo: vencIso,
              descricao: `Marco vinculado à parcela ${ordem} do Contrato ${contratoNumero}. Gatilho: ${gatilho}`,
            })
            marcosCriados++
          }
        }
      } catch {
        /* ignore */
      }
    }

    return {
      sucesso: true,
      pacotesCriados,
      marcosCriados,
      entregaveisCriados,
      mensagem:
        pacotesCriados === 0 && marcosCriados === 0
          ? 'Todos os pacotes de trabalho e marcos já estavam gerados e atualizados.'
          : `${pacotesCriados} pacote(s), ${marcosCriados} marco(s) e ${entregaveisCriados} entregável(is) gerados com sucesso.`,
      pacotes: pacotesRetorno,
    }
  },
}
