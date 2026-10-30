import { EtapaFunil, ColunaFunil5, EmpresaRecord } from '@/types'

/**
 * Tabela oficial de correspondência: Mapeamento não-destrutivo das 9 etapas antigas
 * gravadas no banco para as 5 colunas do Funil Enxuto (Rodada 10).
 *
 * (1) Identificada           -> Identificada
 * (2) Qualificada            -> Qualificada
 * (3) Em Cadência            -> Qualificada
 * (4) Em Proposta Elaborada  -> Em proposta
 * (5) Proposta Enviada       -> Em proposta
 * (6) Em Conversa            -> Negociação
 * (7) Parceira               -> Ganha/Perdida (com selo de Parceira na empresa)
 * (8) Nutrição Mensal        -> Ganha/Perdida (saída do funil ativo / standby)
 * (9) Inativa                -> Ganha/Perdida (descartada)
 */
export const MAPA_ETAPAS_9_PARA_5: Record<EtapaFunil, ColunaFunil5> = {
  identificada: 'identificada',
  qualificada: 'qualificada',
  em_cadencia: 'qualificada',
  com_proposta_elaborada: 'em_proposta',
  proposta_enviada: 'em_proposta',
  em_conversa: 'negociacao',
  parceira: 'ganha_perdida',
  nutricao_mensal: 'ganha_perdida',
  inativa: 'ganha_perdida',
}

export interface ColunaFunilConfig {
  id: ColunaFunil5
  titulo: string
  subtitulo: string
  ordem: number
  cor: string
  border: string
  bgHeader: string
  badgeColor: string
  // Aliases para compatibilidade com Funil.tsx
  borda: string
  corFundo: string
  corTexto: string
  descricao: string
}

export const COLUNAS_FUNIL_5_CONFIG: ColunaFunilConfig[] = [
  {
    id: 'identificada',
    titulo: 'Identificada',
    subtitulo: 'Leads mapeados e dados básicos',
    ordem: 1,
    cor: '#64748B',
    border: 'border-slate-300',
    bgHeader: 'bg-slate-100 text-slate-800',
    badgeColor: 'bg-slate-600',
    borda: 'border-slate-300',
    corFundo: 'bg-slate-100',
    corTexto: 'text-slate-800',
    descricao: 'Leads mapeados e dados básicos',
  },
  {
    id: 'qualificada',
    titulo: 'Qualificada',
    subtitulo: 'Decisor validado e em cadência',
    ordem: 2,
    cor: '#2563EB',
    border: 'border-blue-300',
    bgHeader: 'bg-blue-50 text-blue-800',
    badgeColor: 'bg-blue-600',
    borda: 'border-blue-300',
    corFundo: 'bg-blue-50',
    corTexto: 'text-blue-800',
    descricao: 'Decisor validado e em cadência',
  },
  {
    id: 'em_proposta',
    titulo: 'Em proposta',
    subtitulo: 'Proposta elaborada ou enviada',
    ordem: 3,
    cor: '#D95A2B',
    border: 'border-orange-300',
    bgHeader: 'bg-orange-50 text-orange-800',
    badgeColor: 'bg-[#D95A2B]',
    borda: 'border-orange-300',
    corFundo: 'bg-orange-50',
    corTexto: 'text-orange-800',
    descricao: 'Proposta elaborada ou enviada',
  },
  {
    id: 'negociacao',
    titulo: 'Negociação',
    subtitulo: 'Em conversa e alinhamento de termos',
    ordem: 4,
    cor: '#7C3AED',
    border: 'border-purple-300',
    bgHeader: 'bg-purple-50 text-purple-800',
    badgeColor: 'bg-purple-600',
    borda: 'border-purple-300',
    corFundo: 'bg-purple-50',
    corTexto: 'text-purple-800',
    descricao: 'Em conversa e alinhamento de termos',
  },
  {
    id: 'ganha_perdida',
    titulo: 'Ganha / Perdida',
    subtitulo: 'Parceiras consolidadas ou desfechos',
    ordem: 5,
    cor: '#059669',
    border: 'border-emerald-300',
    bgHeader: 'bg-emerald-50 text-emerald-800',
    badgeColor: 'bg-emerald-600',
    borda: 'border-emerald-300',
    corFundo: 'bg-emerald-50',
    corTexto: 'text-emerald-800',
    descricao: 'Parceiras consolidadas ou desfechos',
  },
]

/**
 * Probabilidade ponderada padrão para a previsão financeira baseada nas 5 colunas.
 * Mantém coerência com o cálculo do módulo Financeiro.
 */
export const PROBABILIDADE_PADRAO_COLUNA_5: Record<ColunaFunil5, number> = {
  identificada: 10,
  qualificada: 25,
  em_proposta: 60,
  negociacao: 85,
  ganha_perdida: 100, // para parceiras ganhas; descartadas pontuam 0
}

/**
 * Helper para obter a coluna de 5 correspondente a partir de qualquer etapa antiga
 */
export function mapearEtapaParaColuna5(etapa?: string | null): ColunaFunil5 {
  if (!etapa) return 'identificada'
  return MAPA_ETAPAS_9_PARA_5[etapa as EtapaFunil] || 'identificada'
}

/**
 * Determina se a empresa tem o selo de Parceira Demandante (não-destrutivo):
 * Verdadeiro se campo booleano `is_parceira` for true OU se `etapa_funil` gravada for 'parceira'.
 */
export function isEmpresaParceira(empresa: Partial<EmpresaRecord>): boolean {
  if (!empresa) return false
  return Boolean(empresa.is_parceira || empresa.etapa_funil === 'parceira')
}

/**
 * Calcula a probabilidade financeira ponderada individual de uma empresa
 * respeitando sua etapa real ou coluna mapeada e o selo Parceira.
 */
export function calcularProbabilidadeEmpresa(
  empresa: Partial<EmpresaRecord>,
  probabilidadesConfig?: Record<string, number>,
): number {
  const etapa = (empresa.etapa_funil || 'identificada') as EtapaFunil

  // Se já possui selo de parceira ou etapa parceira, probabilidade é 100%
  if (isEmpresaParceira(empresa)) {
    return 100
  }

  // Se inativa, probabilidade é 0%
  if (empresa.status === 'inativa' || etapa === 'inativa') {
    return 0
  }

  // Se configurado pelo backend
  if (probabilidadesConfig && probabilidadesConfig[etapa] !== undefined) {
    return probabilidadesConfig[etapa]
  }

  // Fallback baseado na coluna das 5
  const col5 = mapearEtapaParaColuna5(etapa)
  if (col5 === 'ganha_perdida') {
    return etapa === 'nutricao_mensal' ? 15 : 0
  }
  return PROBABILIDADE_PADRAO_COLUNA_5[col5] ?? 20
}
