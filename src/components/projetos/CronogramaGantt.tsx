import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ProjetoEtapaRecord, ProjetoRecord } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import {
  parseDateOnly,
  formatToYmd,
  addDays,
  diffDays,
  getProgressoPorStatus,
  getStatusGanttStyle,
} from './ganttUtils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Calendar,
  Clock,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Move,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react'

export interface CronogramaGanttProps {
  projeto: ProjetoRecord | null
  etapas: ProjetoEtapaRecord[]
  canEdit: boolean
  onEtapaClick: (etapa: ProjetoEtapaRecord) => void
  onAtualizarDatasEtapa?: (
    etapaId: string,
    dataInicioYmd: string,
    prazoYmd: string,
  ) => Promise<void>
}

type EscalaGantt = 'semana' | 'dia'

interface DragState {
  etapaId: string
  tipo: 'move' | 'resize'
  startX: number
  origInicio: Date
  origPrazo: Date
  currentInicio: Date
  currentPrazo: Date
}

const ROW_HEIGHT = 46
const HEADER_HEIGHT = 56
const LEFT_COL_WIDTH = 280

export const CronogramaGantt: React.FC<CronogramaGanttProps> = ({
  projeto,
  etapas,
  canEdit,
  onEtapaClick,
  onAtualizarDatasEtapa,
}) => {
  const [escala, setEscala] = useState<EscalaGantt>('semana')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [salvandoMovimento, setSalvandoMovimento] = useState(false)

  // Modal de confirmação de movimento (especialmente se ultrapassar prazo_final do projeto)
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    open: boolean
    etapa: ProjetoEtapaRecord | null
    novoInicioYmd: string
    novoPrazoYmd: string
    ultrapassaPrazoProjeto: boolean
  }>({
    open: false,
    etapa: null,
    novoInicioYmd: '',
    novoPrazoYmd: '',
    ultrapassaPrazoProjeto: false,
  })

  const containerRef = useRef<HTMLDivElement>(null)

  // Largura de cada dia em pixels de acordo com a escala
  const dayWidth = escala === 'dia' ? 36 : 14

  // Prazo final do projeto
  const prazoFinalProjetoDate = useMemo(() => {
    return parseDateOnly(projeto?.prazo_final)
  }, [projeto?.prazo_final])

  // Data de hoje
  const hojeDate = useMemo(() => {
    const h = new Date()
    h.setHours(0, 0, 0, 0)
    return h
  }, [])

  // Etapas ordenadas por ordem
  const etapasOrdenadas = useMemo(() => {
    return [...etapas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
  }, [etapas])

  // Calcula janela total de tempo visível no Gantt
  const { minDate, maxDate, totalDias } = useMemo(() => {
    let minD = new Date(hojeDate)
    let maxD = new Date(hojeDate)

    etapasOrdenadas.forEach((et) => {
      const dIni = parseDateOnly(et.data_inicio)
      const dFim = parseDateOnly(et.prazo || et.prazo_fim)
      if (dIni) {
        if (dIni < minD) minD = new Date(dIni)
        if (dIni > maxD) maxD = new Date(dIni)
      }
      if (dFim) {
        if (dFim < minD) minD = new Date(dFim)
        if (dFim > maxD) maxD = new Date(dFim)
      }
    })

    if (prazoFinalProjetoDate) {
      if (prazoFinalProjetoDate < minD) minD = new Date(prazoFinalProjetoDate)
      if (prazoFinalProjetoDate > maxD) maxD = new Date(prazoFinalProjetoDate)
    }

    // Adiciona margem de dias antes e depois (pelo menos 7 dias antes e 21 dias depois)
    const inicioGantt = addDays(minD, -7)
    // Alinha para o domingo ou segunda
    const dayOfWeek = inicioGantt.getDay()
    const inicioAlinhado = addDays(inicioGantt, -dayOfWeek)

    const fimGantt = addDays(maxD, 28)
    const dias = Math.max(30, diffDays(inicioAlinhado, fimGantt))

    return {
      minDate: inicioAlinhado,
      maxDate: fimGantt,
      totalDias: dias,
    }
  }, [etapasOrdenadas, prazoFinalProjetoDate, hojeDate])

  // Largura total da timeline em pixels
  const timelineWidth = totalDias * dayWidth

  // Colunas do cabeçalho de tempo
  const headerCols = useMemo(() => {
    const cols: {
      date: Date
      isFirstOfMonth: boolean
      monthLabel?: string
      weekLabel?: string
      dayLabel: string
      isWeekend: boolean
      isHoje: boolean
      left: number
    }[] = []

    for (let i = 0; i < totalDias; i++) {
      const d = addDays(minDate, i)
      const isFirstOfMonth = d.getDate() === 1 || i === 0
      const isMonday = d.getDay() === 1
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const isHoje = d.getTime() === hojeDate.getTime()

      const monthName = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      const dayNum = d.getDate()
      const dayWeekShort = d.toLocaleDateString('pt-BR', { weekday: 'narrow' })

      cols.push({
        date: d,
        isFirstOfMonth,
        monthLabel: isFirstOfMonth ? monthName : undefined,
        weekLabel: isMonday ? `Sem ${d.getDate()}/${d.getMonth() + 1}` : undefined,
        dayLabel: escala === 'dia' ? `${dayWeekShort} ${dayNum}` : `${dayNum}`,
        isWeekend,
        isHoje,
        left: i * dayWidth,
      })
    }

    return cols
  }, [minDate, totalDias, dayWidth, escala, hojeDate])

  // Posição de "Hoje" na timeline
  const hojeLeft = useMemo(() => {
    const d = diffDays(minDate, hojeDate)
    if (d < 0 || d > totalDias) return null
    return d * dayWidth + dayWidth / 2
  }, [minDate, hojeDate, totalDias, dayWidth])

  // Posição do "Prazo Final do Projeto"
  const prazoFinalLeft = useMemo(() => {
    if (!prazoFinalProjetoDate) return null
    const d = diffDays(minDate, prazoFinalProjetoDate)
    if (d < 0 || d > totalDias) return null
    return d * dayWidth + dayWidth
  }, [minDate, prazoFinalProjetoDate, totalDias, dayWidth])

  // Função auxiliar para calcular início e término de uma etapa
  const getEtapaDates = useCallback(
    (et: ProjetoEtapaRecord, idx: number) => {
      // Se estiver sendo arrastada em tempo real, usa as datas do dragState
      if (dragState && dragState.etapaId === et.id) {
        return {
          dInicio: dragState.currentInicio,
          dPrazo: dragState.currentPrazo,
        }
      }

      let dInicio = parseDateOnly(et.data_inicio)
      let dPrazo = parseDateOnly(et.prazo || et.prazo_fim)

      // Fallbacks elegantes se as datas ainda não estiverem cadastradas
      if (!dInicio && !dPrazo) {
        // Estima sequência de 7 dias baseada no índice
        dInicio = addDays(hojeDate, idx * 7)
        dPrazo = addDays(dInicio, 6)
      } else if (!dInicio && dPrazo) {
        dInicio = addDays(dPrazo, -7)
      } else if (dInicio && !dPrazo) {
        dPrazo = addDays(dInicio, 7)
      }

      return { dInicio: dInicio!, dPrazo: dPrazo! }
    },
    [dragState, hojeDate],
  )

  // Listeners globais de mouse para drag & drop e redimensionamento fluido
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragState.startX
      const deltaDias = Math.round(deltaPx / dayWidth)

      if (dragState.tipo === 'move') {
        const novoInicio = addDays(dragState.origInicio, deltaDias)
        const duracaoDias = diffDays(dragState.origInicio, dragState.origPrazo)
        const novoPrazo = addDays(novoInicio, duracaoDias)

        setDragState((prev) =>
          prev ? { ...prev, currentInicio: novoInicio, currentPrazo: novoPrazo } : null,
        )
      } else if (dragState.tipo === 'resize') {
        let novoPrazo = addDays(dragState.origPrazo, deltaDias)
        // Não permite que o prazo seja menor que a data de início
        if (novoPrazo < dragState.origInicio) {
          novoPrazo = new Date(dragState.origInicio)
        }
        setDragState((prev) => (prev ? { ...prev, currentPrazo: novoPrazo } : null))
      }
    }

    const handleMouseUp = () => {
      if (!dragState) return

      const finalInicio = dragState.currentInicio
      const finalPrazo = dragState.currentPrazo
      const etapa = etapasOrdenadas.find((e) => e.id === dragState.etapaId)

      // Verifica se houve mudança real de datas
      const mudouInicio = diffDays(dragState.origInicio, finalInicio) !== 0
      const mudouPrazo = diffDays(dragState.origPrazo, finalPrazo) !== 0

      if (etapa && (mudouInicio || mudouPrazo)) {
        const novoInicioYmd = formatToYmd(finalInicio)
        const novoPrazoYmd = formatToYmd(finalPrazo)

        // Verifica se ultrapassa prazo final do projeto
        const ultrapassa = !!(
          prazoFinalProjetoDate && finalPrazo.getTime() > prazoFinalProjetoDate.getTime()
        )

        // Abre diálogo de confirmação
        setModalConfirmacao({
          open: true,
          etapa,
          novoInicioYmd,
          novoPrazoYmd,
          ultrapassaPrazoProjeto: ultrapassa,
        })
      }

      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, dayWidth, etapasOrdenadas, prazoFinalProjetoDate])

  const handleConfirmarMudancaDatas = async () => {
    if (!modalConfirmacao.etapa || !onAtualizarDatasEtapa) return

    setSalvandoMovimento(true)
    try {
      await onAtualizarDatasEtapa(
        modalConfirmacao.etapa.id,
        modalConfirmacao.novoInicioYmd,
        modalConfirmacao.novoPrazoYmd,
      )
      setModalConfirmacao((prev) => ({ ...prev, open: false }))
    } catch {
      // Erro tratado via toast pelo chamador
    } finally {
      setSalvandoMovimento(false)
    }
  }

  // Centraliza o scroll em "Hoje" no carregamento inicial
  useEffect(() => {
    if (containerRef.current && hojeLeft !== null) {
      const scrollPos = Math.max(0, hojeLeft - 300)
      containerRef.current.scrollLeft = scrollPos
    }
  }, [escala])

  return (
    <div className="space-y-3">
      {/* Barra de Controles e Legenda do Gantt */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Cronograma do Projeto ({etapasOrdenadas.length} etapas)
          </span>

          {canEdit ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
            >
              Edição Interativa Ativa (Arrastar e Redimensionar)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 font-medium"
            >
              Somente Leitura
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom / Escala */}
          <div className="flex items-center border border-slate-200 rounded-md bg-slate-50 p-0.5">
            <Button
              type="button"
              variant={escala === 'semana' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEscala('semana')}
              className={`h-7 px-2.5 text-xs ${
                escala === 'semana' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              <ZoomOut className="w-3 h-3 mr-1" />
              Semanas
            </Button>
            <Button
              type="button"
              variant={escala === 'dia' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEscala('dia')}
              className={`h-7 px-2.5 text-xs ${
                escala === 'dia' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              <ZoomIn className="w-3 h-3 mr-1" />
              Dias
            </Button>
          </div>

          {/* Botão de Hoje */}
          {hojeLeft !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollLeft = Math.max(0, hojeLeft - 250)
                }
              }}
              className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Ir para Hoje
            </Button>
          )}
        </div>
      </div>

      {/* Legenda visual */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">Legenda:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-400 inline-block" />
          Planejada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block" />
          Em Cotação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
          Em Andamento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
          Em Revisão
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
          Concluída
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block animate-pulse" />
          Atrasada / Estouro Prazo
        </span>
        <span className="flex items-center gap-1.5 ml-auto text-blue-700 font-medium">
          <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> Hoje
        </span>
        {prazoFinalProjetoDate && (
          <span className="flex items-center gap-1.5 text-rose-700 font-medium">
            <span className="w-2.5 h-0.5 bg-rose-600 inline-block" /> Marco Prazo Projeto (
            {formatDateBr(prazoFinalProjetoDate)})
          </span>
        )}
      </div>

      {/* Área Principal do Gantt com Scroll Horizontal */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
        <div className="flex w-full">
          {/* Coluna Fixa da Esquerda (Lista das Etapas e Responsáveis) */}
          <div
            className="shrink-0 bg-slate-50 border-r border-slate-200 z-10 flex flex-col"
            style={{ width: LEFT_COL_WIDTH }}
          >
            {/* Header da Coluna Esquerda */}
            <div
              className="p-3 border-b border-slate-200 flex items-center justify-between font-semibold text-xs text-slate-700"
              style={{ height: HEADER_HEIGHT }}
            >
              <span>Etapas ({etapasOrdenadas.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Executor</span>
            </div>

            {/* Linhas da Coluna Esquerda */}
            <div className="divide-y divide-slate-100">
              {etapasOrdenadas.map((et, idx) => {
                const nomeExecutor = et.expand?.executor?.nome || 'A cotar / Direta'
                return (
                  <div
                    key={et.id}
                    onClick={() => onEtapaClick(et)}
                    className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-100/70 cursor-pointer transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    title={`Clique para ver detalhes da etapa #${et.ordem || idx + 1}: ${et.nome}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-1 py-0.2 rounded shrink-0">
                          #{et.ordem || idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {et.nome}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                        <span>{et.disciplina || 'Geral'}</span>
                        <span>•</span>
                        <span className="truncate text-indigo-700 font-medium">{nomeExecutor}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                )
              })}

              {etapasOrdenadas.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhuma etapa cadastrada
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Timeline do Gantt com Scroll Horizontal */}
          <div
            ref={containerRef}
            className="flex-1 overflow-x-auto relative select-none"
            style={{ maxHeight: 600 }}
          >
            <div
              className="relative"
              style={{
                width: timelineWidth,
                minHeight: HEADER_HEIGHT + etapasOrdenadas.length * ROW_HEIGHT,
              }}
            >
              {/* Cabeçalho da Linha do Tempo (Meses e Dias/Semanas) */}
              <div
                className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 flex flex-col"
                style={{ height: HEADER_HEIGHT }}
              >
                {/* Linha dos Meses */}
                <div className="h-6 border-b border-slate-200 relative text-[10px] font-semibold text-slate-600">
                  {headerCols.map((c, i) =>
                    c.monthLabel ? (
                      <span
                        key={`m-${i}`}
                        className="absolute top-0.5 px-2 font-mono uppercase tracking-wider text-slate-700 border-l border-slate-300"
                        style={{ left: c.left }}
                      >
                        {c.monthLabel}
                      </span>
                    ) : null,
                  )}
                </div>

                {/* Linha dos Dias / Semanas */}
                <div className="h-8 relative text-[10px] text-slate-500">
                  {headerCols.map((c, i) => (
                    <div
                      key={`d-${i}`}
                      className={`absolute top-0 h-full flex flex-col items-center justify-center border-r border-slate-200/60 ${
                        c.isWeekend ? 'bg-slate-50/70 text-slate-400' : ''
                      } ${c.isHoje ? 'bg-blue-50 text-blue-700 font-bold' : ''}`}
                      style={{ left: c.left, width: dayWidth }}
                      title={formatDateBr(c.date)}
                    >
                      <span className="text-[9px] leading-none">{c.dayLabel}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid de Fundo com Linhas Verticais de Dias e Fins de Semana */}
              <div
                className="absolute left-0 right-0 bottom-0 pointer-events-none"
                style={{ top: HEADER_HEIGHT }}
              >
                {headerCols.map((c, i) => (
                  <div
                    key={`grid-${i}`}
                    className={`absolute top-0 bottom-0 border-r border-slate-100 ${
                      c.isWeekend ? 'bg-slate-50/40' : ''
                    }`}
                    style={{ left: c.left, width: dayWidth }}
                  />
                ))}

                {/* Linha Vertical de "Hoje" */}
                {hojeLeft !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                    style={{ left: hojeLeft }}
                  >
                    <div className="w-0.5 h-full bg-blue-500 shadow-xs" />
                    <span className="absolute -top-5 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-1 py-0.2 rounded shadow-xs font-mono">
                      HOJE
                    </span>
                  </div>
                )}

                {/* Linha Vertical de "Prazo Final do Projeto" (Marco Crítico) */}
                {prazoFinalLeft !== null && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                    style={{ left: prazoFinalLeft }}
                  >
                    <div className="w-0.5 h-full bg-rose-600 border-l border-dashed border-rose-500 shadow-xs" />
                    <span
                      className="absolute -top-5 -translate-x-1/2 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-xs font-mono flex items-center gap-1"
                      title={`Marco de Prazo Final do Projeto: ${formatDateBr(prazoFinalProjetoDate)}`}
                    >
                      PRAZO FINAL
                    </span>
                  </div>
                )}
              </div>

              {/* Setas de Dependência Simples (da Etapa N-1 para a Etapa N por Ordem) */}
              <svg
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  width: timelineWidth,
                  height: HEADER_HEIGHT + etapasOrdenadas.length * ROW_HEIGHT,
                }}
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                  </marker>
                </defs>

                {etapasOrdenadas.map((et, idx) => {
                  if (idx === 0) return null
                  const etapaAnterior = etapasOrdenadas[idx - 1]

                  const { dPrazo: fimAnt } = getEtapaDates(etapaAnterior, idx - 1)
                  const { dInicio: iniAtual } = getEtapaDates(et, idx)

                  const x1 = diffDays(minDate, fimAnt) * dayWidth + dayWidth
                  const y1 = HEADER_HEIGHT + (idx - 1) * ROW_HEIGHT + ROW_HEIGHT / 2

                  const x2 = diffDays(minDate, iniAtual) * dayWidth
                  const y2 = HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2

                  // Caminho ortogonal em escada
                  const midX = x1 + Math.max(10, (x2 - x1) / 2)
                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`

                  return (
                    <path
                      key={`dep-${et.id}`}
                      d={path}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      markerEnd="url(#gantt-arrow)"
                    />
                  )
                })}
              </svg>

              {/* Barras das Etapas */}
              <div
                className="relative divide-y divide-slate-100"
                style={{ paddingTop: 0, marginTop: 0 }}
              >
                {etapasOrdenadas.map((et, idx) => {
                  const { dInicio, dPrazo } = getEtapaDates(et, idx)

                  const leftDays = diffDays(minDate, dInicio)
                  const duracaoDias = Math.max(1, diffDays(dInicio, dPrazo) + 1)

                  const barLeft = leftDays * dayWidth
                  const barWidth = Math.max(dayWidth, duracaoDias * dayWidth)

                  // Verificação de atraso e estouro do marco de prazo final do projeto
                  const hojeTime = hojeDate.getTime()
                  const prazoTime = dPrazo.getTime()
                  const isConcluida = et.status === 'concluida'
                  const isCancelada = et.status === 'cancelada'
                  const isAtrasada = !isConcluida && !isCancelada && prazoTime < hojeTime

                  const isUltrapassaPrazoProjeto = !!(
                    prazoFinalProjetoDate && prazoTime > prazoFinalProjetoDate.getTime()
                  )

                  const progresso = getProgressoPorStatus(et.status)
                  const style = getStatusGanttStyle(et.status, isAtrasada, isUltrapassaPrazoProjeto)

                  const isDraggingThis = dragState?.etapaId === et.id

                  return (
                    <div
                      key={et.id}
                      className="relative hover:bg-slate-50/50 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Barra de Tempo da Etapa */}
                      <div
                        onClick={() => onEtapaClick(et)}
                        onMouseDown={(e) => {
                          if (!canEdit) return
                          // Inicia arrasto de deslocamento
                          e.stopPropagation()
                          setDragState({
                            etapaId: et.id,
                            tipo: 'move',
                            startX: e.clientX,
                            origInicio: new Date(dInicio),
                            origPrazo: new Date(dPrazo),
                            currentInicio: new Date(dInicio),
                            currentPrazo: new Date(dPrazo),
                          })
                        }}
                        style={{
                          left: barLeft,
                          width: barWidth,
                          top: 8,
                          height: ROW_HEIGHT - 16,
                        }}
                        className={`absolute rounded-md border shadow-xs overflow-hidden flex items-center transition-all ${
                          style.barClass
                        } ${
                          canEdit
                            ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400'
                            : 'cursor-pointer hover:opacity-90'
                        } ${isDraggingThis ? 'opacity-80 ring-2 ring-blue-500 z-30' : 'z-20'}`}
                        title={`${et.nome} (${style.label})
Início: ${formatDateBr(dInicio)} | Prazo: ${formatDateBr(dPrazo)}
Progresso: ${progresso}%
${canEdit ? 'Arraste para mover datas ou puxe a borda direita para estender o prazo.' : 'Clique para ver detalhes.'}`}
                      >
                        {/* Preenchimento Proporcional ao Progresso */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 opacity-75 ${style.progressClass} transition-all`}
                          style={{ width: `${progresso}%` }}
                        />

                        {/* Rótulo da Barra */}
                        <div className="relative z-10 px-2 flex items-center justify-between w-full text-[11px] font-semibold truncate pointer-events-none">
                          <span className="truncate flex items-center gap-1 drop-shadow-2xs">
                            {isUltrapassaPrazoProjeto && (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0 inline animate-bounce" />
                            )}
                            #{et.ordem || idx + 1} {et.nome}
                          </span>
                          <span className="text-[10px] font-mono opacity-90 shrink-0 ml-1">
                            {progresso}%
                          </span>
                        </div>

                        {/* Alça de Redimensionamento (Ajuste de Prazo pela borda direita - Gestor/Admin) */}
                        {canEdit && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              setDragState({
                                etapaId: et.id,
                                tipo: 'resize',
                                startX: e.clientX,
                                origInicio: new Date(dInicio),
                                origPrazo: new Date(dPrazo),
                                currentInicio: new Date(dInicio),
                                currentPrazo: new Date(dPrazo),
                              })
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2.5 bg-slate-400/30 hover:bg-blue-600 cursor-ew-resize transition-colors z-20 flex items-center justify-center"
                            title="Arraste para redimensionar o prazo desta etapa"
                          >
                            <span className="w-0.5 h-3 bg-slate-600/50 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Alteração de Datas (com Alerta de Estouro do Prazo Final) */}
      <Dialog
        open={modalConfirmacao.open}
        onOpenChange={(op) => {
          if (!salvandoMovimento) {
            setModalConfirmacao((prev) => ({ ...prev, open: op }))
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Move className="w-4 h-4 text-blue-600" />
              Confirmar Alteração de Cronograma
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600">
              Você alterou o período planejado da etapa{' '}
              <strong>"{modalConfirmacao.etapa?.nome}"</strong>:
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-slate-700">
                <span>Nova Data de Início:</span>
                <strong className="text-blue-700">
                  {formatDateBr(modalConfirmacao.novoInicioYmd)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Novo Prazo (Término):</span>
                <strong className="text-blue-700">
                  {formatDateBr(modalConfirmacao.novoPrazoYmd)}
                </strong>
              </div>
            </div>

            {/* Aviso Crítico se Ultrapassar o Prazo Final do Projeto */}
            {modalConfirmacao.ultrapassaPrazoProjeto && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Atenção: Esta etapa ultrapassa o prazo final do projeto!
                </div>
                <p className="text-[11px] leading-relaxed">
                  O prazo final estabelecido para o projeto é{' '}
                  <strong>{formatDateBr(prazoFinalProjetoDate)}</strong>. Ao salvar esta alteração,
                  a barra ficará destacada em vermelho indicando risco de atraso global. Deseja
                  prosseguir mesmo assim?
                </p>
              </div>
            )}

            <p className="text-[11px] text-slate-400 italic">
              Esta ação será gravada no histórico de auditoria (quem alterou, etapa e período
              anterior → novo).
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalConfirmacao((prev) => ({ ...prev, open: false }))}
              disabled={salvandoMovimento}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarMudancaDatas}
              disabled={salvandoMovimento}
              className={
                modalConfirmacao.ultrapassaPrazoProjeto
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            >
              {salvandoMovimento ? 'Salvando...' : 'Confirmar e Salvar Datas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
