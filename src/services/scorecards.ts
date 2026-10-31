import pb from '@/lib/pocketbase/client'
import {
  ScorecardRecord,
  ParametroScorecardRecord,
  ScorecardEntidadeResponse,
  PortalMeuScorecardResponse,
  NovaVersaoParametrosPayload,
  RecalcularScorecardPayload,
} from '@/types'

export const scorecardsService = {
  /**
   * Obtém o scorecard atual e histórico de snapshots mensais de uma entidade
   */
  async obterPorEntidade(
    tipo: 'prestador_externo' | 'prestador_interno' | 'empresa_parceira',
    id: string,
  ): Promise<ScorecardEntidadeResponse> {
    return await pb.send<ScorecardEntidadeResponse>(
      `/backend/v1/scorecards/entidade/${tipo}/${id}`,
      {
        method: 'GET',
      },
    )
  },

  /**
   * Projeção segura do Portal do Prestador: retorna apenas índices e tendência próprios
   * NUNCA expõe margem, faturamento de cliente, custo-hora ou outros prestadores.
   */
  async obterMeuScorecard(): Promise<PortalMeuScorecardResponse> {
    return await pb.send<PortalMeuScorecardResponse>('/backend/v1/portal-prestador/meu-scorecard', {
      method: 'GET',
    })
  },

  /**
   * Dispara recálculo manual sob demanda (Admin e Gestor)
   */
  async recalcular(payload: RecalcularScorecardPayload): Promise<{
    sucesso: boolean
    scorecard: ScorecardRecord
  }> {
    return await pb.send<{ sucesso: boolean; scorecard: ScorecardRecord }>(
      '/backend/v1/scorecards/recalcular',
      {
        method: 'POST',
        body: payload,
      },
    )
  },

  /**
   * Lista parâmetros versionados configurados na Administração
   */
  async listarParametros(): Promise<{ parametros: ParametroScorecardRecord[] }> {
    return await pb.send<{ parametros: ParametroScorecardRecord[] }>(
      '/backend/v1/scorecards/parametros/listar',
      {
        method: 'GET',
      },
    )
  },

  /**
   * Cria NOVA VERSÃO dos pesos e metas na Administração
   * Nunca apaga nem sobrescreve versões anteriores
   */
  async criarNovaVersaoParametros(payload: NovaVersaoParametrosPayload): Promise<{
    sucesso: boolean
    mensagem: string
    parametro: ParametroScorecardRecord
  }> {
    return await pb.send<{
      sucesso: boolean
      mensagem: string
      parametro: ParametroScorecardRecord
    }>('/backend/v1/scorecards/parametros/nova-versao', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Lista todos os scorecards mestre (não snapshot) de determinado tipo (para tabelas gerenciais)
   */
  async listarScorecardsPorTipo(
    tipo: 'prestador_externo' | 'prestador_interno' | 'empresa_parceira',
  ): Promise<ScorecardRecord[]> {
    return await pb.collection('scorecards').getFullList<ScorecardRecord>({
      filter: `tipo_entidade = '${tipo}' && is_snapshot != true`,
      sort: '-indice_composto',
    })
  },
}
