// =============================================================================
// GESTÃO G+ — PAINEL DE FLUXO PROJETADO COM ALERTAS DE INVERSÃO (MARCOS)
// Endpoint: GET /backend/v1/financeiro/fluxo-marcos-inversao
// Restrito: Admin e Financeiro
// =============================================================================

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { financeiroService } from '@/services/financeiro'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

interface AlertaInversao {
  projeto_id: string
  projeto_codigo: string
  projeto_nome: string
  conta_pagar: {
    id: string
    descricao: string
    valor: number
    vencimento: string
    executor_id?: string
  }
  conta_receber: {
    id: string
    descricao: string
    valor: number
    vencimento: string
  }
  dias_inversao: number
  tipo_inversao: string
  mensagem: string
}

interface FluxoMarcosResponse {
  success: boolean
  antecedencia_dias_configurada: number
  total_alertas_inversao: number
  alertas: AlertaInversao[]
}

export const PainelFluxoMarcosInversao: React.FC = () => {
  const { toast } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<FluxoMarcosResponse | null>(null)

  const carregarAlertas = async () => {
    setCarregando(true)
    try {
      const res = await financeiroService.getFluxoMarcosInversao()
      setDados(res)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar fluxo de marcos',
        description: err.message || 'Falha ao consultar alertas de inversão.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarAlertas()
  }, [])

  if (carregando) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
          <span className="text-xs text-slate-500">
            Analisando descasamentos de datas entre cliente e prestadores...
          </span>
        </CardContent>
      </Card>
    )
  }

  if (!dados) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 text-center text-xs text-slate-500">
          Não foi possível carregar o fluxo projetado por marcos.
        </CardContent>
      </Card>
    )
  }

  const { alertas, antecedencia_dias_configurada } = dados

  return (
    <div className="space-y-4">
      {/* Alerta explicativo */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm text-amber-950 font-bold">
              Monitor de Descasamento de Caixa (Cliente × Prestador)
            </strong>
            <span>
              Dispara alerta quando uma conta a pagar ao prestador vence{' '}
              <strong>antes da previsão de recebimento do cliente correspondente</strong> ou com
              margem de segurança inferior a {antecedencia_dias_configurada} dias (parâmetro da
              Administração).
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={carregarAlertas}
          className="h-8 text-xs shrink-0 bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Recalcular Alertas
        </Button>
      </div>

      {alertas.length === 0 ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="py-12 text-center max-w-md mx-auto space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">
              Nenhuma Inversão de Fluxo Detectada
            </h4>
            <p className="text-xs text-slate-500">
              Todas as contas a pagar aos prestadores estão cronologicamente alinhadas para vencer
              após o recebimento dos clientes, com margem de segurança preservada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Identificados <strong>{alertas.length}</strong> caso(s) de atenção no fluxo de caixa
              projetado:
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {alertas.map((item, idx) => {
              const isInversaoCritica = item.dias_inversao > 0

              return (
                <Card
                  key={idx}
                  className={`border transition-all ${
                    isInversaoCritica
                      ? 'border-rose-300 bg-rose-50/20 shadow-xs'
                      : 'border-amber-300 bg-amber-50/20 shadow-xs'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isInversaoCritica
                              ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold text-xs'
                              : 'bg-amber-100 text-amber-800 border-amber-300 font-bold text-xs'
                          }
                        >
                          {isInversaoCritica ? 'Inversão Crítica' : 'Margem Insuficiente'}
                        </Badge>
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {item.projeto_codigo}
                        </span>
                        <span className="text-xs text-slate-600 truncate max-w-sm">
                          {item.projeto_nome}
                        </span>
                      </div>

                      <span
                        className={`text-xs font-bold font-mono ${
                          isInversaoCritica ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        {isInversaoCritica
                          ? `${item.dias_inversao} dia(s) de antecipação ao prestador`
                          : `Descasamento de ${Math.abs(item.dias_inversao)} dia(s)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Lado Prestador (A Pagar) */}
                      <div className="p-3 rounded-lg border border-rose-200 bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-rose-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                            Saída (Prestador / Fornecedor)
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrencyBr(item.conta_pagar.valor)}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium">{item.conta_pagar.descricao}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Vencimento: {formatDateBr(item.conta_pagar.vencimento)}</span>
                        </div>
                      </div>

                      {/* Lado Cliente (A Receber) */}
                      <div className="p-3 rounded-lg border border-emerald-200 bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                            Entrada Prevista (Cliente)
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatCurrencyBr(item.conta_receber.valor)}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium">{item.conta_receber.descricao}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Vencimento: {formatDateBr(item.conta_receber.vencimento)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded border border-slate-200/60 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{item.mensagem}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
export default PainelFluxoMarcosInversao
