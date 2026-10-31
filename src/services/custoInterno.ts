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
}
