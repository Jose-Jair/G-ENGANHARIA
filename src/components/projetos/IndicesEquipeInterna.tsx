import React, { useEffect, useState } from 'react'
import { ScorecardRecord } from '@/types'
import { scorecardsService } from '@/services/scorecards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { renderBadgeTendencia } from '@/components/scorecards/FichaScorecard'
import {
  Award,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Percent,
} from 'lucide-react'

interface IndicesEquipeInternaProps {
  prestadoresIds: string[]
  className?: string
}

interface PrestadorComScorecard {
  prestadorId: string
  scorecard: ScorecardRecord | null
}

export const IndicesEquipeInterna: React.FC<IndicesEquipeInternaProps> = ({
  prestadoresIds,
  className = '',
}) => {
  const [dados, setDados] = useState<PrestadorComScorecard[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!prestadoresIds || prestadoresIds.length === 0) {
      setDados([])
      setCarregando(false)
      return
    }

    const carregar = async () => {
      setCarregando(true)
      try {
        const resultados = await Promise.all(
          prestadoresIds.map(async (id) => {
            try {
              const res = await scorecardsService.obterPorEntidade('prestador_interno', id)
              return { prestadorId: id, scorecard: res.scorecard }
            } catch {
              return { prestadorId: id, scorecard: null }
            }
          }),
        )
        setDados(resultados)
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [prestadoresIds.join(',')])

  // Agrega médias consolidadas da equipe alocada
  const consolidados = React.useMemo(() => {
    const comScore = dados
      .map((d) => d.scorecard)
      .filter(
        (s): s is ScorecardRecord => !!s && !s.dados_insuficientes && s.indice_composto !== null,
      )

    if (comScore.length === 0) {
      return null
    }

    const calcMedia = (key: keyof ScorecardRecord) => {
      const vals = comScore
        .map((s) => s[key])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v))
      if (vals.length === 0) return null
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    }

    return {
      total: comScore.length,
      composto: calcMedia('indice_composto'),
      leadTime: calcMedia('int_lead_time'),
      ciclosRevisao: calcMedia('int_ciclos_revisao'),
      horasEntregavel: calcMedia('int_horas_entregavel'),
      ocupacao: calcMedia('int_ocupacao'),
      pontualidade: calcMedia('int_pontualidade'),
    }
  }, [dados])

  if (carregando) {
    return null
  }

  return (
    <Card className={`border-sky-100 bg-sky-50/30 shadow-xs ${className}`}>
      <CardHeader className="p-4 pb-2 border-b border-sky-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-sky-700" />
          <CardTitle className="text-sm font-bold text-sky-950">
            Índices Internos do Scorecard da Equipe
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] bg-white text-sky-800 border-sky-200">
          Metas Operacionais G+
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {!consolidados ? (
          <div className="p-3 bg-white/80 border border-dashed border-sky-200 rounded-lg flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Dados insuficientes:</strong> A equipe alocada ainda não possui entregas
              finalizadas na janela de 12 meses para consolidação dos índices internos.
            </span>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <div className="p-2.5 bg-white rounded-lg border border-sky-100 text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                  Composto Médio
                </span>
                <strong className="text-xl font-extrabold text-[#D95A2B]">
                  {consolidados.composto ?? '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block font-mono">/100 pts</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-sky-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Lead Time vs. Meta</span>
                  <Clock className="w-3 h-3 text-sky-600" />
                </div>
                <strong className="text-sm font-bold text-slate-800 font-mono block mt-1">
                  {consolidados.leadTime !== null ? `${consolidados.leadTime}%` : '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block">dias úteis vs meta</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-sky-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Ciclos de Revisão</span>
                  <RotateCcw className="w-3 h-3 text-indigo-600" />
                </div>
                <strong className="text-sm font-bold text-slate-800 font-mono block mt-1">
                  {consolidados.ciclosRevisao !== null ? `${consolidados.ciclosRevisao}%` : '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block">aderência à meta (≤1)</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-sky-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Horas/Entregável</span>
                  <Clock className="w-3 h-3 text-purple-600" />
                </div>
                <strong className="text-sm font-bold text-slate-800 font-mono block mt-1">
                  {consolidados.horasEntregavel !== null ? `${consolidados.horasEntregavel}%` : '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block">eficiência de apontamento</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-sky-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Taxa de Ocupação</span>
                  <Percent className="w-3 h-3 text-amber-600" />
                </div>
                <strong className="text-sm font-bold text-slate-800 font-mono block mt-1">
                  {consolidados.ocupacao !== null ? `${consolidados.ocupacao}%` : '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block">alocação (meta ~80%)</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-sky-100">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Pontualidade</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </div>
                <strong className="text-sm font-bold text-slate-800 font-mono block mt-1">
                  {consolidados.pontualidade !== null ? `${consolidados.pontualidade}%` : '—'}
                </strong>
                <span className="text-[9px] text-slate-400 block">entregas no prazo</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Médias consolidadas ponderadas de {consolidados.total} profissional(is) interno(s)
              alocado(s) neste projeto.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default IndicesEquipeInterna
