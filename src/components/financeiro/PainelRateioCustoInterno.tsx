// src/components/financeiro/PainelRateioCustoInterno.tsx
// RODADA 15 — ABA "CUSTO INTERNO" NO FINANCEIRO:
// Rateio por projeto / mês e link direto para a aba "Fazer Dentro ou Fora" na Administração

import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { custoInternoService, RateioProjetoMes } from '@/services/custoInterno'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  DollarSign,
  Briefcase,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  TrendingDown,
  Layers,
  PieChart,
} from 'lucide-react'

export const PainelRateioCustoInterno: React.FC = () => {
  const { toast } = useToast()
  const [rateios, setRateios] = useState<RateioProjetoMes[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregarRateio = async () => {
    setCarregando(true)
    try {
      const lista = await custoInternoService.obterRateioMensalProjetos()
      setRateios(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar rateio de custo interno',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarRateio()
  }, [])

  // Métricas agregadas
  const { totalCustoAcumulado, totalHorasAcumuladas, totalOsInternas } = useMemo(() => {
    let custo = 0
    let horas = 0
    let os = 0
    rateios.forEach((r) => {
      custo += r.custo_total || 0
      horas += r.horas_totais || 0
      os += r.total_os || 0
    })
    return {
      totalCustoAcumulado: Math.round(custo * 100) / 100,
      totalHorasAcumuladas: Math.round(horas * 100) / 100,
      totalOsInternas: os,
    }
  }, [rateios])

  return (
    <div className="space-y-6">
      {/* Banner de Cabeçalho com Link para "Fazer Dentro ou Fora" */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D95A2B]" />
            <h3 className="text-base font-bold text-slate-900">
              Rateio de Custo Interno Operacional
            </h3>
            <Badge className="bg-emerald-600 text-white text-xs">Rodada 15</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Acompanhamento contábil e gerencial da remuneração da equipe técnica própria da G+
            alocada por projeto e competência mensal, deduzido diretamente da margem de
            contribuição.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarRateio}
            disabled={carregando}
            className="text-xs h-8 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {/* Link para Administração › Fazer Dentro ou Fora */}
          <Link to="/administracao?aba=fazer_dentro_fora">
            <Button
              size="sm"
              className="text-xs h-8 bg-sky-700 hover:bg-sky-800 text-white gap-1.5 shadow-xs"
            >
              <PieChart className="w-3.5 h-3.5" />
              Painel Fazer Dentro ou Fora
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                Custo Interno Total Apurado
              </span>
              <strong className="text-xl font-mono text-slate-900 block mt-1">
                {formatCurrencyBr(totalCustoAcumulado)}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50 text-[#D95A2B]">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                Horas Dedicadas (Equipe Própria)
              </span>
              <strong className="text-xl font-mono text-slate-900 block mt-1">
                {totalHorasAcumuladas} h
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                Ordens de Serviço Internas
              </span>
              <strong className="text-xl font-mono text-slate-900 block mt-1">
                {totalOsInternas} OS
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Rateio Projeto x Mês */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Distribuição por Projeto e Mês
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Contas de tipo <code>custo_interno</code> e OS internas apuradas por competência.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {carregando ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto mb-2" />
              <p className="text-xs text-slate-500">Consolidando rateios...</p>
            </div>
          ) : rateios.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Nenhum custo interno registrado.</p>
              <p className="text-slate-400">
                Os rateios aparecem conforme OS da equipe interna são delegadas, apontadas e
                concluídas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Competência</th>
                    <th className="p-3">Projeto</th>
                    <th className="p-3 text-center">OS Internas</th>
                    <th className="p-3 text-right">Horas Dedicadas</th>
                    <th className="p-3 text-right">Custo Rateado</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {rateios.map((r, idx) => (
                    <tr key={`${r.projeto_id}-${r.mes_ano}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-800">{r.mes_ano}</td>
                      <td className="p-3 font-sans">
                        <strong className="text-indigo-900 block font-mono">
                          {r.codigo_projeto}
                        </strong>
                        <span className="text-[11px] text-slate-500 line-clamp-1">
                          {r.nome_projeto}
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-700">{r.total_os}</td>
                      <td className="p-3 text-right text-slate-800 font-bold">{r.horas_totais}h</td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {formatCurrencyBr(r.custo_total)}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <Link to={`/projetos?projeto=${r.projeto_id}&aba=equipe_interna`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-sky-700"
                          >
                            Ver Equipe
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PainelRateioCustoInterno
