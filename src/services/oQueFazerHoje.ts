import pb from '@/lib/pocketbase/client'
import { ColunaFunil5 } from '@/types'

export interface AcaoDoDiaUnificada {
  id: string
  empresa_id: string
  empresa_nome: string
  cnpj: string
  curva: 'A' | 'B' | 'C'
  etapa_funil_atual: string
  coluna_5: ColunaFunil5
  is_parceira: boolean
  numero_toque: number
  canal: string
  data_prevista: string
  status_calculado: 'para_hoje' | 'em_atraso'
  dias_atraso: number
  is_critico: boolean
  observacao: string
}

export interface SugestaoNutricaoUnificada {
  empresa_id: string
  empresa_nome: string
  cnpj: string
  curva: 'A' | 'B' | 'C'
  toque5_id: string
  dias_decorridos_toque5: number
  carencia_limite_dias: number
  bloqueada_nao_contatar: boolean
  sugerida_para_nutricao: boolean
}

export interface EmpresaEstagnadaUnificada {
  empresa_id: string
  empresa_nome: string
  cnpj: string
  curva: 'A' | 'B' | 'C'
  etapa_funil: string
  coluna_5: ColunaFunil5
  is_parceira?: boolean
  dias_estagnada: number
  limite_dias: number
  proxima_acao_data?: string
  proxima_acao_desc?: string
  alerta: 'atencao' | 'critico'
}

export interface PropostaPendenteUnificada {
  id: string
  codigo: string
  status: string
  empresa_id: string
  empresa_nome: string
  preco: number
  motivo: string
}

export interface EntregavelAtrasadoUnificada {
  id: string
  nome: string
  status: string
  prazo: string
  projeto_id?: string
  etapa_id?: string
}

export interface OQueFazerHojeResponse {
  success: boolean
  perfil: string
  usuario_id: string
  data_referencia: string
  regras: {
    calculado_em_tempo_real: boolean
    gravacao_para_hoje_em_atraso_desabilitada: boolean
    conformidade_lgpd_nao_contatar: boolean
    dias_limite_atraso_toque: number
    dias_estagnacao_limite: number
    dias_carencia_nutricao: number
  }
  resumo_geral: {
    total_acoes_hoje: number
    toques_para_hoje: number
    toques_em_atraso: number
    toques_criticos: number
    sugestoes_nutricao: number
    empresas_estagnadas: number
    propostas_pendentes: number
    entregaveis_atrasados: number
  }
  acoes_do_dia: AcaoDoDiaUnificada[]
  sugestoes_nutricao: SugestaoNutricaoUnificada[]
  empresas_estagnadas: EmpresaEstagnadaUnificada[]
  propostas_pendentes: PropostaPendenteUnificada[]
  entregaveis_atrasados: EntregavelAtrasadoUnificada[]
}

export const oQueFazerHojeService = {
  /**
   * Consulta o endpoint consolidado do servidor "O que fazer hoje"
   * Unifica ações do dia, saúde do funil, sugestões de nutrição e pendências de proposta/entrega
   * Calculado 100% dinamicamente sem gravar 'para_hoje'/'em_atraso' no banco.
   */
  async getOQueFazerHoje(): Promise<OQueFazerHojeResponse> {
    return await pb.send<OQueFazerHojeResponse>('/backend/v1/funil/o-que-fazer-hoje', {
      method: 'GET',
    })
  },
}
