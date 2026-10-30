import { SemaforoPrazoStatus } from './SemaforoBadge'
import { OrdemServicoRecord, EntregavelRecord } from '@/types'

/**
 * Calcula a diferença em dias corridos entre uma data alvo e a data atual (zero horas)
 * Retorna positivo para datas futuras (dias restantes) e negativo para datas passadas (dias de atraso).
 */
export function calcularDiferencaDias(dataIso?: string | null): number | null {
  if (!dataIso) return null
  try {
    const dataAlvo = new Date(dataIso)
    if (isNaN(dataAlvo.getTime())) return null

    const agora = new Date()
    // Zera horas para comparação por dias corridos
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
    const inicioAlvo = new Date(
      dataAlvo.getFullYear(),
      dataAlvo.getMonth(),
      dataAlvo.getDate(),
    ).getTime()

    const diffMs = inicioAlvo - inicioHoje
    return Math.round(diffMs / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

/**
 * Calcula horas decorridas desde uma data ISO até o momento atual
 */
export function calcularHorasDecorridas(dataIso?: string | null): number | null {
  if (!dataIso) return null
  try {
    const data = new Date(dataIso)
    if (isNaN(data.getTime())) return null
    const agora = new Date().getTime()
    const diffMs = agora - data.getTime()
    if (diffMs < 0) return 0
    return Math.floor(diffMs / (1000 * 60 * 60))
  } catch {
    return null
  }
}

/**
 * Determina o semáforo de uma Ordem de Serviço:
 * - concluido: status 'concluida'
 * - aguardando_revisao: entregáveis da OS aguardando revisão interna
 * - atrasado: diffDias < 0
 * - atencao: diffDias entre 0 e 3 (ou D-3)
 * - no_prazo: diffDias > 3
 * - sem_prazo: sem data_previsao_fim
 */
export function calcularSemaforoOs(
  os: OrdemServicoRecord,
  temEntregavelEmRevisao: boolean = false,
): { status: SemaforoPrazoStatus; diasRestantes: number | null } {
  if (os.status === 'concluida') {
    return { status: 'concluido', diasRestantes: null }
  }

  if (temEntregavelEmRevisao) {
    return { status: 'aguardando_revisao', diasRestantes: null }
  }

  const diffDias = calcularDiferencaDias(os.data_previsao_fim)
  if (diffDias === null) {
    return { status: 'sem_prazo', diasRestantes: null }
  }

  if (diffDias < 0) {
    return { status: 'atrasado', diasRestantes: diffDias }
  }
  if (diffDias <= 3) {
    return { status: 'atencao', diasRestantes: diffDias }
  }
  return { status: 'no_prazo', diasRestantes: diffDias }
}

/**
 * Determina o semáforo de um entregável:
 * - concluido: status 'aprovado'
 * - aguardando_revisao: status 'em_revisao' ou 'aguardando_aprovacao'
 * - atrasado: diffDias < 0 (e não aprovado)
 * - atencao: diffDias <= 3
 * - no_prazo: diffDias > 3
 */
export function calcularSemaforoEntregavel(ent: EntregavelRecord): {
  status: SemaforoPrazoStatus
  diasRestantes: number | null
  horasEmRevisao: number | null
} {
  if (ent.status === 'aprovado') {
    return { status: 'concluido', diasRestantes: null, horasEmRevisao: null }
  }

  const statusStr = String(ent.status)
  if (
    statusStr === 'revisao_interna' ||
    statusStr === 'enviado_revisao' ||
    statusStr === 'em_revisao' ||
    statusStr === 'aguardando_aprovacao'
  ) {
    const horas = calcularHorasDecorridas(ent.updated || ent.created)
    return { status: 'aguardando_revisao', diasRestantes: null, horasEmRevisao: horas }
  }

  const diffDias = calcularDiferencaDias(ent.prazo)
  if (diffDias === null) {
    return { status: 'sem_prazo', diasRestantes: null, horasEmRevisao: null }
  }

  if (diffDias < 0) {
    return { status: 'atrasado', diasRestantes: diffDias, horasEmRevisao: null }
  }
  if (diffDias <= 3) {
    return { status: 'atencao', diasRestantes: diffDias, horasEmRevisao: null }
  }
  return { status: 'no_prazo', diasRestantes: diffDias, horasEmRevisao: null }
}
