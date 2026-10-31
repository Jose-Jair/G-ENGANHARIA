import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { prospeccaoService, MetricPorFonte } from '@/services/prospeccao'
import { formatDateBr } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Radar,
  Sparkles,
  ArrowRight,
  Database,
  Coins,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

export function CardMetricasProspeccao() {
  const navigate = useNavigate()
  const [metricas, setMetricas] = useState<MetricPorFonte[]>([])
  const [loading, setLoading] = useState(true)

  const carregarMetricas = async () => {
    setLoading(true)
    try {
      const data = await prospeccaoService.obterMetricasConsolidadas()
      setMetricas(data)
    } catch {
      // Falha silenciosa para não travar a Central de Ações
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarMetricas()
  }, [])

  const totais = metricas.reduce(
    (acc, m) => {
      acc.lidos += m.total_lidos
      acc.sugeridos += m.total_sugeridos
      acc.incorporados += m.total_incorporados
      acc.creditos += m.creditos_ia_gastos
      return acc
    },
    { lidos: 0, sugeridos: 0, incorporados: 0, creditos: 0 },
  )

  return (
    <Card className="border-slate-200 bg-linear-to-br from-white via-slate-50/50 to-orange-50/20 shadow-xs">
      <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-100/80 text-[#D95A2B]">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Métricas da Prospecção por Fonte
              <Badge
                variant="outline"
                className="text-[10px] bg-white text-[#D95A2B] border-orange-200"
              >
                Rodada 14
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-slate-500">
              Contratos lidos, sugestões geradas, incorporadas ao funil e créditos de IA consumidos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={carregarMetricas}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/funil/sugestoes')}
            className="text-xs h-7 text-[#D95A2B] border-orange-200 hover:bg-orange-50 gap-1 font-medium"
          >
            Ver Sugestões
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 space-y-3">
        {/* Placar Consolidado Geral */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-medium text-slate-500 block">Total Lidos</span>
            <span className="text-base font-bold font-mono text-slate-900">
              {totais.lidos.toLocaleString('pt-BR')}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-medium text-slate-500 block">
              Sugeridos (Score ABC)
            </span>
            <span className="text-base font-bold font-mono text-blue-700">
              {totais.sugeridos.toLocaleString('pt-BR')}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-medium text-slate-500 block">Incorporados Funil</span>
            <span className="text-base font-bold font-mono text-emerald-700">
              {totais.incorporados.toLocaleString('pt-BR')}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-medium text-slate-500 block">Créditos IA Gastos</span>
            <span className="text-base font-bold font-mono text-[#D95A2B] flex items-center justify-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              {totais.creditos.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Tabela / Grid detalhado por Fonte */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
            <span className="col-span-4 sm:col-span-3">Fonte</span>
            <span className="col-span-2 text-right">Lidos</span>
            <span className="col-span-2 text-right">Sugeridos</span>
            <span className="col-span-2 text-right">Incorp.</span>
            <span className="col-span-2 sm:col-span-3 text-right">Créditos IA</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {loading && metricas.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">Carregando métricas...</div>
            ) : metricas.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Nenhuma fonte cadastrada ou dados pendentes.
              </div>
            ) : (
              metricas.map((m) => (
                <div
                  key={m.slug}
                  className="px-3 py-2 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/80 transition-colors"
                >
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        m.ativo ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0">
                      <span
                        className="font-semibold text-slate-800 block truncate text-xs"
                        title={m.nome}
                      >
                        {m.nome}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {m.tipo === 'importador_csv'
                          ? 'CSV Oficial'
                          : m.tipo === 'transparencia_sancoes'
                            ? 'Sanções CGU'
                            : 'API Direta'}
                      </span>
                    </div>
                  </div>

                  <span className="col-span-2 text-right font-mono text-slate-700">
                    {m.total_lidos.toLocaleString('pt-BR')}
                  </span>

                  <span className="col-span-2 text-right font-mono font-medium text-blue-700">
                    {m.total_sugeridos.toLocaleString('pt-BR')}
                  </span>

                  <span className="col-span-2 text-right font-mono font-bold text-emerald-700">
                    {m.total_incorporados.toLocaleString('pt-BR')}
                  </span>

                  <div className="col-span-2 sm:col-span-3 text-right font-mono text-slate-800 flex items-center justify-end gap-1">
                    <Coins className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{m.creditos_ia_gastos.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé informativo com link para Administração */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#D95A2B]" />
            Varredura automática roda diariamente às 03:00 (cron).
          </span>
          <button
            type="button"
            onClick={() => navigate('/administracao')}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
          >
            Configurar Fontes na Administração
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
