import pb from '@/lib/pocketbase/client'
import { EtapaFunil, CurvaABC } from '@/types'

export interface TempoPorEtapaSaude {
  etapa: EtapaFunil
  label: string
  empresas_atuais: number
  tempo_medio_atual_dias: number
  empresas_passaram: number
  tempo_medio_historico_dias: number
  maior_acumulo: boolean
}

export interface EmpresaEstagnadaSaude {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  curva: CurvaABC
  etapa_atual: EtapaFunil
  etapa_label: string
  dias_parados: number
  data_ultima_atividade: string
  proxima_acao_data?: string
  proxima_acao_desc?: string
  situacao_acao: 'vazia' | 'vencida' | 'agendada'
  responsavel_id?: string
}

export interface ConversaoEtapaSaude {
  etapa: EtapaFunil
  label: string
  proxima_etapa: EtapaFunil | null
  proxima_label: string | null
  total_na_etapa: number
  atuais_paradas: number
  avancaram: number
  taxa_conversao_pct: number
  descartadas: number
  taxa_descarte_pct: number
}

export interface MotivoDescarteAgrupado {
  motivo: string
  total: number
  percentual: number
  tipo_origem: 'empresa' | 'sugestao'
}

export interface DescarteRecenteItem {
  id: string
  origem: 'empresa' | 'sugestao'
  nome: string
  cnpj?: string
  motivo: string
  etapa_origem: string
  data_descarte: string
}

export interface ResumoSaudeFunil {
  total_empresas: number
  total_estagnadas: number
  total_sugestoes_nutricao?: number
  dias_estagnacao_limite: number
  total_descartes: number
  etapa_maior_gargalo: string
  calculado_em: string
}

export interface SugestaoNutricaoItem {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  curva: string
  etapa_funil: string
  dias_na_etapa: number
  data_entrada_etapa: string
  responsavel_id?: string
  email?: string
  telefone?: string
}

export interface SaudeFunilResponse {
  resumo: ResumoSaudeFunil
  tempo_por_etapa: TempoPorEtapaSaude[]
  empresas_estagnadas: EmpresaEstagnadaSaude[]
  conversao_etapas: ConversaoEtapaSaude[]
  descartes_por_motivo: {
    total: number
    agrupado: MotivoDescarteAgrupado[]
    recentes: DescarteRecenteItem[]
  }
  sugestoes_nutricao?: SugestaoNutricaoItem[]
}

export const funilSaudeService = {
  /**
   * Obtém os indicadores de saúde do funil de prospecção calculados no servidor.
   * Restrito a usuários com perfil Admin ou Comercial.
   */
  async obterSaude(): Promise<SaudeFunilResponse> {
    const res = await pb.send<SaudeFunilResponse>('/backend/v1/funil/saude', {
      method: 'GET',
    })
    return res
  },

  /**
   * Executa ações exclusivas de Admin sobre leads em fim de funil (>7 dias em proposta_enviada sem aceite):
   * - migrar_nutricao: move para etapa 'nutricao_mensal' + auditoria MIGRACAO_NUTRICAO
   * - marcar_nao_contatar: insere na coleção nao_contatar + auditoria MARCADO_NAO_CONTATAR
   */
  async executarAcaoFimFunil(payload: {
    acao: 'migrar_nutricao' | 'marcar_nao_contatar'
    empresa_id: string
    motivo?: string
  }): Promise<{ success: boolean; message: string; empresa_id: string }> {
    const res = await pb.send<{ success: boolean; message: string; empresa_id: string }>(
      '/backend/v1/funil/acoes-fim-funil',
      {
        method: 'POST',
        body: payload,
      },
    )
    return res
  },
}
