import React, { useEffect, useState } from 'react'
import { ScorecardRecord, TipoEntidadeScorecard, TendenciaScorecard } from '@/types'
import { scorecardsService } from '@/services/scorecards'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Award,
  Clock,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Layers,
  AlertTriangle,
  FileCheck,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export interface FichaScorecardProps {
  tipo: TipoEntidadeScorecard
  registroId: string
  nomeEntidade?: string
  canRecalculate?: boolean
  className?: string
  somenteVisualizacao?: boolean
}

export function renderBadgeTendencia(
  tendencia?: TendenciaScorecard | 'melhorou' | 'estavel' | 'piorou' | 'dados_insuficientes' | null,
) {
  switch (tendencia) {
    case 'melhorou':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1 py-0 h-5"
        >
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          Melhorou
        </Badge>
      )
    case 'piorou':
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1 py-0 h-5"
        >
          <TrendingDown className="w-3 h-3 text-rose-600" />
          Piorou
        </Badge>
      )
    case 'estavel':
      return (
        <Badge
          variant="outline"
          className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] gap-1 py-0 h-5"
        >
          <Minus className="w-3 h-3 text-slate-500" />
          Estável
        </Badge>
      )
    case 'dados_insuficientes':
    default:
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] gap-1 py-0 h-5"
        >
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Dados insuficientes
        </Badge>
      )
  }
}

export const FichaScorecard: React.FC<FichaScorecardProps> = ({
  tipo,
  registroId,
  nomeEntidade,
  canRecalculate = false,
  className = '',
}) => {
  const [scorecard, setScorecard] = useState<ScorecardRecord | null>(null)
  const [snapshots, setSnapshots] = useState<ScorecardRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recalculando, setRecalculando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarDados = async () => {
    if (!registroId) return
    setCarregando(true)
    setErro(null)
    try {
      const res = await scorecardsService.obterPorEntidade(tipo, registroId)
      setScorecard(res.scorecard)
      setSnapshots(res.snapshots || [])
    } catch (err: any) {
      setErro(err?.message || 'Falha ao carregar scorecard')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tipo, registroId])

  const handleRecalcular = async () => {
    setRecalculando(true)
    try {
      const res = await scorecardsService.recalcular({
        tipo_entidade: tipo,
        registro_id: registroId,
      })
      if (res.scorecard) {
        setScorecard(res.scorecard)
      }
      await carregarDados()
    } catch (err: any) {
      setErro(err?.message || 'Erro ao recalcular scorecard')
    } finally {
      setRecalculando(false)
    }
  }

  // Prepara dados do gráfico de linha com snapshots mensais e o ponto atual
  const dadosGrafico = React.useMemo(() => {
    const ordenados = [...snapshots].sort((a, b) =>
      (a.mes_referencia || '').localeCompare(b.mes_referencia || ''),
    )
    const pontos: Array<{ mes: string; composto: number | null }> = ordenados.map((s) => ({
      mes: s.mes_referencia || 'Histórico',
      composto:
        s.indice_composto !== null && s.indice_composto !== undefined
          ? Number(s.indice_composto)
          : null,
    }))

    // Se temos scorecard atual ativo, adiciona ponto atual
    if (scorecard && !scorecard.dados_insuficientes && scorecard.indice_composto !== null) {
      const mesAtual = (scorecard.data_calculo || '').slice(0, 7) || 'Atual'
      const jaExiste = pontos.some((p) => p.mes === mesAtual)
      if (!jaExiste) {
        pontos.push({
          mes: `${mesAtual} (Atual)`,
          composto: Number(scorecard.indice_composto),
        })
      }
    }
    return pontos
  }, [snapshots, scorecard])

  if (carregando) {
    return (
      <Card className={`border-slate-200 ${className}`}>
        <CardContent className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D95A2B]" />
          Carregando scorecard...
        </CardContent>
      </Card>
    )
  }

  // Caso: Dados Insuficientes ou nenhum trabalho na janela
  const dadosInsuficientes =
    !scorecard || scorecard.dados_insuficientes || scorecard.indice_composto === null

  return (
    <Card className={`border-slate-200 shadow-xs ${className}`}>
      <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#D95A2B]" />
              Scorecard de Desempenho
              {nomeEntidade && <span className="text-slate-400 font-normal">• {nomeEntidade}</span>}
            </CardTitle>
            {renderBadgeTendencia(scorecard?.tendencia_5_trabalhos)}
            {scorecard?.sugestao_suspensao && (
              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                Sugestão de Suspensão Técnica
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            {tipo === 'prestador_externo' &&
              'Pontualidade, retrabalho, avaliações de qualidade e aderência técnica.'}
            {tipo === 'prestador_interno' &&
              'Lead time vs. meta, ciclos de revisão, horas apontadas e ocupação.'}
            {tipo === 'empresa_parceira' &&
              'Prazos de pagamento de marcos, aceite, devoluções e margem média.'}
          </CardDescription>
        </div>

        {canRecalculate && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRecalcular}
            disabled={recalculando}
            className="text-xs h-7 px-2.5 gap-1 shrink-0"
            title="Recalcula o scorecard com base nas OSs e eventos mais recentes"
          >
            <RefreshCw className={`w-3 h-3 ${recalculando ? 'animate-spin' : ''}`} />
            {recalculando ? 'Recalculando...' : 'Recalcular'}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {erro && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Bloco 1: Indicador Composto vs Dados Insuficientes */}
        {dadosInsuficientes ? (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-amber-900 block">
                Dados insuficientes para nota composta
              </span>
              <p className="text-amber-800 leading-relaxed">
                {scorecard?.motivo_insuficiencia ||
                  'Nenhum trabalho, OS concluída ou avaliação finalizada nos últimos 12 meses. O sistema não inventa nota fictícia nem penaliza arbitrariamente.'}
              </p>
              <div className="text-[11px] text-amber-700 pt-0.5">
                Total de entregas concluídas na janela:{' '}
                <strong>{scorecard?.total_trabalhos_janela || 0}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="sm:col-span-1 border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-2 sm:pb-0 pr-0 sm:pr-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Índice Composto
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-extrabold text-[#D95A2B]">
                  {scorecard.indice_composto !== null
                    ? Math.round(Number(scorecard.indice_composto))
                    : '—'}
                </span>
                <span className="text-xs text-slate-400 font-mono">/100</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                Versão dos pesos: <strong>v{scorecard.versao_pesos}</strong> •{' '}
                {scorecard.total_trabalhos_janela} trabalho(s)
              </span>
            </div>

            {/* Indicadores Específicos por Tipo */}
            <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {tipo === 'prestador_externo' && (
                <>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Pontualidade OS</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_pontualidade !== null &&
                      scorecard.ext_pontualidade !== undefined
                        ? `${Math.round(Number(scorecard.ext_pontualidade))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Índice Sem Retrabalho</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_retrabalho !== null && scorecard.ext_retrabalho !== undefined
                        ? `${Math.round(Number(scorecard.ext_retrabalho))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Qualidade Técnica</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_qualidade !== null && scorecard.ext_qualidade !== undefined
                        ? `${Math.round(Number(scorecard.ext_qualidade))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Aderência ao Preço</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_aderencia_preco !== null &&
                      scorecard.ext_aderencia_preco !== undefined
                        ? `${Math.round(Number(scorecard.ext_aderencia_preco))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Responsividade</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_responsividade !== null &&
                      scorecard.ext_responsividade !== undefined
                        ? `${Math.round(Number(scorecard.ext_responsividade))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Conformidade Doc.</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.ext_conformidade !== null &&
                      scorecard.ext_conformidade !== undefined
                        ? `${Math.round(Number(scorecard.ext_conformidade))}%`
                        : '—'}
                    </strong>
                  </div>
                </>
              )}

              {tipo === 'prestador_interno' && (
                <>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Lead Time vs. Meta</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.int_lead_time !== null && scorecard.int_lead_time !== undefined
                        ? `${Math.round(Number(scorecard.int_lead_time))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Ciclos de Revisão</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.int_ciclos_revisao !== null &&
                      scorecard.int_ciclos_revisao !== undefined
                        ? `${Math.round(Number(scorecard.int_ciclos_revisao))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Horas/Entregável</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.int_horas_entregavel !== null &&
                      scorecard.int_horas_entregavel !== undefined
                        ? `${Math.round(Number(scorecard.int_horas_entregavel))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Taxa de Ocupação</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.int_ocupacao !== null && scorecard.int_ocupacao !== undefined
                        ? `${Math.round(Number(scorecard.int_ocupacao))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Pontualidade Geral</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.int_pontualidade !== null &&
                      scorecard.int_pontualidade !== undefined
                        ? `${Math.round(Number(scorecard.int_pontualidade))}%`
                        : '—'}
                    </strong>
                  </div>
                </>
              )}

              {tipo === 'empresa_parceira' && (
                <>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">
                      Prazo Real Pagto. Marcos
                    </span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_prazo_pagamento !== null &&
                      scorecard.par_prazo_pagamento !== undefined
                        ? `${Math.round(Number(scorecard.par_prazo_pagamento))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Taxa de Aceite</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_taxa_aceite !== null && scorecard.par_taxa_aceite !== undefined
                        ? `${Math.round(Number(scorecard.par_taxa_aceite))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">
                      Devoluções pelo Cliente
                    </span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_devolucoes_cliente !== null &&
                      scorecard.par_devolucoes_cliente !== undefined
                        ? `${Math.round(Number(scorecard.par_devolucoes_cliente))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Frequência de Demanda</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_frequencia_demanda !== null &&
                      scorecard.par_frequencia_demanda !== undefined
                        ? `${Math.round(Number(scorecard.par_frequencia_demanda))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Margem Média</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_margem_media !== null &&
                      scorecard.par_margem_media !== undefined
                        ? `${Math.round(Number(scorecard.par_margem_media))}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Inversões de Fluxo</span>
                    <strong className="text-slate-800 text-sm font-mono">
                      {scorecard.par_inversoes_fluxo !== null &&
                      scorecard.par_inversoes_fluxo !== undefined
                        ? `${Math.round(Number(scorecard.par_inversoes_fluxo))}%`
                        : '—'}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bloco 2: Gráfico de Linha do Histórico Mensal */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Histórico Mensal do Índice Composto
            </span>
            <span className="text-[11px] text-slate-400">
              {dadosGrafico.length > 0
                ? `${dadosGrafico.length} snapshot(s) preservado(s)`
                : 'Sem snapshots anteriores'}
            </span>
          </div>

          {dadosGrafico.length === 0 || dadosGrafico.every((p) => p.composto === null) ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
              Sem dados históricos mensais para plotagem do gráfico de linha.
            </div>
          ) : (
            <div className="h-44 w-full bg-white border border-slate-200 rounded-xl p-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosGrafico} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E2A4A',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                    formatter={(val: any) => [`${val} pts`, 'Composto']}
                  />
                  <Line
                    type="monotone"
                    dataKey="composto"
                    stroke="#D95A2B"
                    strokeWidth={2.5}
                    dot={{ fill: '#D95A2B', r: 4 }}
                    activeDot={{ r: 6, fill: '#1E2A4A' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default FichaScorecard
