import React, { useEffect, useState } from 'react'
import { PortalMeuScorecardResponse } from '@/types'
import { scorecardsService } from '@/services/scorecards'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { renderBadgeTendencia } from '@/components/scorecards/FichaScorecard'
import {
  Award,
  Calendar,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Check,
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

export const PortalMeuDesempenho: React.FC = () => {
  const [data, setData] = useState<PortalMeuScorecardResponse | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await scorecardsService.obterMeuScorecard()
      setData(res)
    } catch (err: any) {
      setErro(err?.message || 'Erro ao carregar seu scorecard')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const scorecard = data?.scorecard
  const snapshots = data?.snapshots || []

  // Prepara dados do gráfico de linha estritamente pessoal
  const dadosGrafico = React.useMemo(() => {
    const ordenados = [...snapshots].sort((a, b) =>
      (a.mes_referencia || '').localeCompare(b.mes_referencia || ''),
    )
    const pontos = ordenados.map((s) => ({
      mes: s.mes_referencia || 'Histórico',
      composto:
        s.indice_composto !== null && s.indice_composto !== undefined
          ? Number(s.indice_composto)
          : null,
    }))

    if (scorecard && !scorecard.dados_insuficientes && scorecard.indice_composto !== null) {
      const mesAtual = (scorecard.data_calculo || '').slice(0, 7) || 'Atual'
      if (!pontos.some((p) => p.mes === mesAtual)) {
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
      <Card className="border-slate-200">
        <CardContent className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#D95A2B]" />
          Carregando seu scorecard de desempenho...
        </CardContent>
      </Card>
    )
  }

  const dadosInsuficientes =
    !scorecard || scorecard.dados_insuficientes || scorecard.indice_composto === null

  return (
    <div className="space-y-6">
      {/* Banner Informativo de Transparência */}
      <Card className="border-slate-200 shadow-xs bg-linear-to-r from-orange-50/40 via-white to-white">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#D95A2B]" />
                  Meu Desempenho Técnico
                </CardTitle>
                {renderBadgeTendencia(scorecard?.tendencia_5_trabalhos)}
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1 max-w-2xl">
                Transparência completa sobre a sua pontualidade, qualidade técnica e aderência aos
                escopos delegados. Este painel exibe{' '}
                <strong>exclusivamente seus próprios índices</strong>, sem comparações com outros
                prestadores e sem dados comerciais ou salariais.
              </CardDescription>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={carregar}
              className="text-xs h-8 px-3 gap-1.5 self-start sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Bloco 1: Indicador Composto vs Dados Insuficientes */}
      {dadosInsuficientes ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-5 flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="text-amber-900 block text-sm">
                Dados insuficientes para cálculo de nota composta
              </strong>
              <p className="text-amber-800 leading-relaxed">
                {scorecard?.motivo_insuficiencia ||
                  'Você ainda não possui entregas ou Ordens de Serviço concluídas e avaliadas nos últimos 12 meses. O sistema G+ não penaliza nem inventa nota fictícia.'}
              </p>
              <p className="text-[11px] text-amber-700 pt-1">
                À medida que suas OSs forem entregues no prazo e homologadas, seu índice composto e
                histórico mensal serão formados automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-center text-center sm:text-left">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Seu Índice Composto
            </span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-1">
              <span className="text-4xl font-extrabold text-[#D95A2B]">
                {Math.round(Number(scorecard.indice_composto))}
              </span>
              <span className="text-sm text-slate-400 font-mono">/100 pts</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Ponderação oficial: <strong>v{scorecard.versao_pesos}</strong> •{' '}
              {scorecard.total_trabalhos_janela} trabalho(s) na janela
            </span>
          </Card>

          <Card className="md:col-span-3 border-slate-200 bg-white shadow-xs p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
              Seus Indicadores Pessoais
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Pontualidade em Entregas</span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_pontualidade !== null && scorecard.ext_pontualidade !== undefined
                    ? `${Math.round(Number(scorecard.ext_pontualidade))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">marcos cumpridos no prazo</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Aderência Sem Retrabalho</span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_retrabalho !== null && scorecard.ext_retrabalho !== undefined
                    ? `${Math.round(Number(scorecard.ext_retrabalho))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">aceites de primeira versão</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">
                  Avaliação Técnica de Qualidade
                </span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_qualidade !== null && scorecard.ext_qualidade !== undefined
                    ? `${Math.round(Number(scorecard.ext_qualidade))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">homologação de engenharia</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">
                  Aderência ao Preço Ofertado
                </span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_aderencia_preco !== null &&
                  scorecard.ext_aderencia_preco !== undefined
                    ? `${Math.round(Number(scorecard.ext_aderencia_preco))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">manutenção do valor cotado</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Responsividade Técnica</span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_responsividade !== null &&
                  scorecard.ext_responsividade !== undefined
                    ? `${Math.round(Number(scorecard.ext_responsividade))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">atendimento a chamados e OS</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Conformidade Documental</span>
                <strong className="text-slate-800 text-sm font-mono mt-0.5 block">
                  {scorecard.ext_conformidade !== null && scorecard.ext_conformidade !== undefined
                    ? `${Math.round(Number(scorecard.ext_conformidade))}%`
                    : '—'}
                </strong>
                <span className="text-[9px] text-slate-400">ARTs, certidões e conselho</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bloco 2: Gráfico de Linha do Histórico Mensal Pessoal */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-sm font-bold text-slate-900">
              Evolução Mensal do Seu Desempenho
            </CardTitle>
          </div>
          <span className="text-[11px] text-slate-400">
            {dadosGrafico.length} medição(ões) registrada(s)
          </span>
        </CardHeader>

        <CardContent className="p-4">
          {dadosGrafico.length === 0 || dadosGrafico.every((p) => p.composto === null) ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              Ainda não há snapshots mensais anteriores registrados no seu histórico.
            </div>
          ) : (
            <div className="h-52 w-full pt-2">
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
                    formatter={(val: any) => [`${val} pts`, 'Seu Composto']}
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
        </CardContent>
      </Card>
    </div>
  )
}

export default PortalMeuDesempenho
