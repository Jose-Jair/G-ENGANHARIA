// src/services/custoInterno.ts
// RODADA 15 — CUSTO INTERNO REAL, VIGÊNCIAS, APONTAMENTOS E INDICADOR FAZER DENTRO OU FORA

import pb from '@/lib/pocketbase/client'
import {
  ApontamentoRecord,
  CustoProfissionalRecord,
  IndicadoresFazerDentroForaResponse,
  OrdemServicoRecord,
} from '@/types'

export interface SalvarVigenciaParams {
  prestadorId: string
  dataInicio: string
  dataFim?: string
  custoMensal: number
  horasMes: number
  observacoes?: string
}

export interface SalvarApontamentoParams {
  osId: string
  prestadorId: string
  data: string
  horas: number
  atividade: 'producao' | 'revisao' | 'correcao' | 'reuniao'
  origem?: 'manual' | 'automatico'
  descricao?: string
}

export interface RecalcularOsResponse {
  success: boolean
  os_id: string
  numero: string
  horas_estimadas: number
  custo_interno_apurado: number
  status_custo_interno: 'configurado' | 'nao_configurado'
  lead_time_dias_corridos: number
  lead_time_dias_uteis: number
  ciclos_revisao: number
}

export interface RateioProjetoMes {
  projeto_id: string
  codigo_projeto: string
  nome_projeto: string
  mes_ano: string
  total_os: number
  horas_totais: number
  custo_total: number
}

export const custoInternoService = {
  // --------------------------------------------------------------------------
  // Vigências de Custo do Profissional (custos_profissional)
  // --------------------------------------------------------------------------
  async listarVigenciasPrestador(prestadorId: string): Promise<CustoProfissionalRecord[]> {
    if (!prestadorId) return []
    const records = await pb
      .collection('custos_profissional')
      .getFullList<CustoProfissionalRecord>({
        filter: `prestador = '${prestadorId}'`,
        sort: '-data_inicio',
        expand: 'criado_por',
      })
    return records
  },

  async criarVigencia(params: SalvarVigenciaParams): Promise<CustoProfissionalRecord> {
    const custoHora =
      params.horasMes > 0 ? Math.round((params.custoMensal / params.horasMes) * 100) / 100 : 0

    const record = await pb.collection('custos_profissional').create<CustoProfissionalRecord>({
      prestador: params.prestadorId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim || '',
      custo_mensal: params.custoMensal,
      horas_mes: params.horasMes,
      custo_hora: custoHora,
      observacoes: params.observacoes || '',
      criado_por: pb.authStore.record?.id || '',
    })
    return record
  },

  // --------------------------------------------------------------------------
  // Apontamentos de Horas (apontamentos)
  // --------------------------------------------------------------------------
  async listarApontamentosOS(osId: string): Promise<ApontamentoRecord[]> {
    if (!osId) return []
    const records = await pb.collection('apontamentos').getFullList<ApontamentoRecord>({
      filter: `os = '${osId}'`,
      sort: '-data,-created',
      expand: 'prestador,aprovado_por',
    })
    return records
  },

  async listarMeusApontamentosPrestador(prestadorId: string): Promise<ApontamentoRecord[]> {
    if (!prestadorId) return []
    const records = await pb.collection('apontamentos').getFullList<ApontamentoRecord>({
      filter: `prestador = '${prestadorId}'`,
      sort: '-data,-created',
      expand: 'os',
    })
    return records
  },

  async listarApontamentosPendentes(): Promise<ApontamentoRecord[]> {
    const records = await pb.collection('apontamentos').getFullList<ApontamentoRecord>({
      filter: `status = 'pendente'`,
      sort: '-data',
      expand: 'os,prestador',
    })
    return records
  },

  async criarApontamento(params: SalvarApontamentoParams): Promise<ApontamentoRecord> {
    const record = await pb.collection('apontamentos').create<ApontamentoRecord>({
      os: params.osId,
      prestador: params.prestadorId,
      data: params.data,
      horas: params.horas,
      atividade: params.atividade,
      origem: params.origem || 'manual',
      status: 'pendente',
      descricao: params.descricao || '',
    })
    return record
  },

  async aprovarLote(
    apontamentoIds: string[],
    decisao: 'aprovado' | 'rejeitado',
    motivoRejeicao = '',
  ): Promise<{ success: boolean; processados: number; decisao: string }> {
    const res = await pb.send<{ success: boolean; processados: number; decisao: string }>(
      '/backend/v1/apontamentos/aprovar-lote',
      {
        method: 'POST',
        body: {
          apontamento_ids: apontamentoIds,
          decisao,
          motivo_rejeicao: motivoRejeicao,
        },
      },
    )
    return res
  },

  // --------------------------------------------------------------------------
  // Recálculo da OS Interna
  // --------------------------------------------------------------------------
  async recalcularOsInterna(osId: string): Promise<RecalcularOsResponse> {
    const res = await pb.send<RecalcularOsResponse>(
      `/backend/v1/ordens-servico/${osId}/recalcular-custo-interno`,
      {
        method: 'POST',
      },
    )
    return res
  },

  async alternarExigeApontamento(osId: string, exige: boolean): Promise<OrdemServicoRecord> {
    const record = await pb.collection('ordens_servico').update<OrdemServicoRecord>(osId, {
      exige_apontamento: exige,
    })
    return record
  },

  // --------------------------------------------------------------------------
  // Indicador "Fazer Dentro ou Fora" por disciplina
  // --------------------------------------------------------------------------
  async obterIndicadoresFazerDentroFora(
    disciplina?: string,
  ): Promise<IndicadoresFazerDentroForaResponse> {
    const q = disciplina ? `?disciplina=${encodeURIComponent(disciplina)}` : ''
    const res = await pb.send<IndicadoresFazerDentroForaResponse>(
      `/backend/v1/indicadores/fazer-dentro-ou-fora${q}`,
      {
        method: 'GET',
      },
    )
    return res
  },

  // --------------------------------------------------------------------------
  // Rateio Mensal de Custo Interno por Projeto
  // --------------------------------------------------------------------------
  async obterRateioMensalProjetos(): Promise<RateioProjetoMes[]> {
    // 1. Buscar OS internas apuradas
    const osInternas = await pb.collection('ordens_servico').getFullList<OrdemServicoRecord>({
      filter: `tipo_prestador = 'interno' && status != 'cancelada'`,
      expand: 'projeto,prestador',
    })

    // 2. Buscar contas de despesa do tipo 'custo_interno'
    let contasCustoInterno: any[] = []
    try {
      contasCustoInterno = await pb.collection('contas').getFullList({
        filter: `tipo = 'custo_interno' && status != 'cancelada'`,
        expand: 'projeto',
      })
    } catch (_) {
      contasCustoInterno = []
    }

    const mapaRateio: Record<string, RateioProjetoMes> = {}

    // Processar OS internas
    for (const os of osInternas) {
      const prj = os.expand?.projeto
      const prjId = os.projeto || prj?.id || 'sem_projeto'
      const prjCod = prj?.codigo || 'PRJ'
      const prjNome = prj?.nome || 'Projeto Sem Nome'

      // Determinar competência (mês/ano) baseada na conclusão ou criação
      const dataRef = os.data_conclusao || os.created || new Date().toISOString()
      const d = new Date(dataRef)
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const mesAno = `${mes}/${ano}`

      const chave = `${prjId}_${mesAno}`

      if (!mapaRateio[chave]) {
        mapaRateio[chave] = {
          projeto_id: prjId,
          codigo_projeto: prjCod,
          nome_projeto: prjNome,
          mes_ano: mesAno,
          total_os: 0,
          horas_totais: 0,
          custo_total: 0,
        }
      }

      mapaRateio[chave].total_os += 1
      mapaRateio[chave].horas_totais += Number(os.horas_estimadas) || 0
      mapaRateio[chave].custo_total += Number(os.custo_interno_apurado) || 0
    }

    // Processar contas do tipo custo_interno (adicionar valores financeiros complementares se houver)
    for (const c of contasCustoInterno) {
      const prj = c.expand?.projeto
      const prjId = c.projeto || prj?.id || 'sem_projeto'
      const prjCod = prj?.codigo || 'PRJ'
      const prjNome = prj?.nome || 'Projeto Sem Nome'

      const dataRef = c.data_pagamento || c.data_vencimento || c.created || new Date().toISOString()
      const d = new Date(dataRef)
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const mesAno = `${mes}/${ano}`

      const chave = `${prjId}_${mesAno}`

      if (!mapaRateio[chave]) {
        mapaRateio[chave] = {
          projeto_id: prjId,
          codigo_projeto: prjCod,
          nome_projeto: prjNome,
          mes_ano: mesAno,
          total_os: 0,
          horas_totais: 0,
          custo_total: 0,
        }
      }

      // Adiciona o valor da conta ao custo total do rateio se não tiver ordem de serviço vinculada
      // para evitar dupla contagem com a OS
      if (!c.ordem_servico) {
        mapaRateio[chave].custo_total += Number(c.valor) || 0
      }
    }

    const lista = Object.values(mapaRateio)
    // Arredondar valores
    lista.forEach((item) => {
      item.horas_totais = Math.round(item.horas_totais * 100) / 100
      item.custo_total = Math.round(item.custo_total * 100) / 100
    })

    // Ordenar decrescente por competência
    lista.sort((a, b) => b.mes_ano.localeCompare(a.mes_ano))
    return lista
  },
}
