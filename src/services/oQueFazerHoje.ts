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

export interface AlertaSemCotacaoUnificado {
  item_id: string
  proposta_id: string
  proposta_codigo?: string
  descricao_item: string
  disciplina: string
  quantidade?: number
  custo_atual?: number
  data_alerta?: string
  link_recrutamento?: string
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
    sem_cotacao?: number
  }
  acoes_do_dia: AcaoDoDiaUnificada[]
  sugestoes_nutricao: SugestaoNutricaoUnificada[]
  empresas_estagnadas: EmpresaEstagnadaUnificada[]
  propostas_pendentes: PropostaPendenteUnificada[]
  entregaveis_atrasados: EntregavelAtrasadoUnificada[]
  sem_cotacao?: AlertaSemCotacaoUnificado[]
}

export interface ItemOQueFazerHoje {
  id: string
  empresa_id: string
  empresa_nome: string
  cnpj: string
  curva: 'A' | 'B' | 'C'
  etapa_funil_atual?: string
  coluna_5?: ColunaFunil5
  is_parceira?: boolean
  numero_toque?: number
  tipo: 'toque' | 'acao_avulsa'
  descricao: string
  canal?: string
  data_prevista?: string
  status_calculado: 'para_hoje' | 'em_atraso'
  dias_atraso: number
  is_critico?: boolean
  nao_contatar?: boolean
  motivo_bloqueio?: string
}

export interface AcaoNutricaoOQueFazerHoje {
  id: string
  empresa_id: string
  empresa_nome: string
  cnpj: string
  curva: 'A' | 'B' | 'C'
  tipo_acao: string
  motivo: string
  dias_decorridos_toque5?: number
  nao_contatar?: boolean
  motivo_bloqueio?: string
}

export interface ResumoOQueFazerHojeEstruturado {
  para_hoje: ItemOQueFazerHoje[]
  em_atraso: ItemOQueFazerHoje[]
  sugestoes_nutricao: AcaoNutricaoOQueFazerHoje[]
  empresas_estagnadas: EmpresaEstagnadaUnificada[]
  propostas_pendentes: PropostaPendenteUnificada[]
  entregaveis_atrasados: EntregavelAtrasadoUnificada[]
  sem_cotacao: AlertaSemCotacaoUnificado[]
  resumo_geral: OQueFazerHojeResponse['resumo_geral']
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

  /**
   * Retorna os dados estruturados para exibição no BlocoOQueFazerHoje
   */
  async obter(): Promise<ResumoOQueFazerHojeEstruturado> {
    const raw = await this.getOQueFazerHoje()
    const acoes = raw.acoes_do_dia || []

    const paraHoje: ItemOQueFazerHoje[] = acoes
      .filter((a) => a.status_calculado === 'para_hoje')
      .map((a) => ({
        id: a.id,
        empresa_id: a.empresa_id,
        empresa_nome: a.empresa_nome,
        cnpj: a.cnpj,
        curva: a.curva,
        etapa_funil_atual: a.etapa_funil_atual,
        coluna_5: a.coluna_5,
        is_parceira: a.is_parceira,
        numero_toque: a.numero_toque,
        tipo: 'toque',
        descricao: a.observacao || `Toque ${a.numero_toque} da cadência comercial`,
        canal: a.canal,
        data_prevista: a.data_prevista,
        status_calculado: 'para_hoje',
        dias_atraso: a.dias_atraso || 0,
        is_critico: a.is_critico,
        nao_contatar: false,
      }))

    const emAtraso: ItemOQueFazerHoje[] = acoes
      .filter((a) => a.status_calculado === 'em_atraso')
      .map((a) => ({
        id: a.id,
        empresa_id: a.empresa_id,
        empresa_nome: a.empresa_nome,
        cnpj: a.cnpj,
        curva: a.curva,
        etapa_funil_atual: a.etapa_funil_atual,
        coluna_5: a.coluna_5,
        is_parceira: a.is_parceira,
        numero_toque: a.numero_toque,
        tipo: 'toque',
        descricao: a.observacao || `Toque ${a.numero_toque} atrasado`,
        canal: a.canal,
        data_prevista: a.data_prevista,
        status_calculado: 'em_atraso',
        dias_atraso: a.dias_atraso || 0,
        is_critico: a.is_critico,
        nao_contatar: false,
      }))

    const sugestoesNutricao: AcaoNutricaoOQueFazerHoje[] = (raw.sugestoes_nutricao || []).map(
      (s) => ({
        id: s.toque5_id || s.empresa_id,
        empresa_id: s.empresa_id,
        empresa_nome: s.empresa_nome,
        cnpj: s.cnpj,
        curva: s.curva,
        tipo_acao: 'Nutrição Mensal',
        motivo: `Toque 5 concluído há ${s.dias_decorridos_toque5} dias sem resposta (carência: ${s.carencia_limite_dias}d). Enviar conteúdo ou case.`,
        dias_decorridos_toque5: s.dias_decorridos_toque5,
        nao_contatar: s.bloqueada_nao_contatar,
        motivo_bloqueio: s.bloqueada_nao_contatar
          ? 'Empresa cadastrada na lista Não Contatar'
          : undefined,
      }),
    )

    return {
      para_hoje: paraHoje,
      em_atraso: emAtraso,
      sugestoes_nutricao: sugestoesNutricao,
      empresas_estagnadas: raw.empresas_estagnadas || [],
      propostas_pendentes: raw.propostas_pendentes || [],
      entregaveis_atrasados: raw.entregaveis_atrasados || [],
      sem_cotacao: raw.sem_cotacao || [],
      resumo_geral: raw.resumo_geral,
    }
  },
}
