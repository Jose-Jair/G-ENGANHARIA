import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  VisaoGerencialDados,
  VisaoGerencialFluxoMes,
  VisaoGerencialProjetoMargem,
  VisaoGerencialContaAtrasada,
} from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  AlertCircle,
  Clock,
  PieChart,
  Wallet,
  HeartPulse,
} from 'lucide-react'
import { ModalSaudeFinanceiraProjeto } from '@/components/financeiro/ModalSaudeFinanceiraProjeto'

interface TabGerencialProps {
  dados: VisaoGerencialDados | null
  loading: boolean
  horizonte: 3 | 6 | 12
  onHorizonteChange: (h: 3 | 6 | 12) => void
  onAbrirConta: (id: string) => void
}

// Formata mês por extenso em pt-BR
const MESES_PTBR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function mesLabel(mesChave: string): string {
  const [ano, mes] = mesChave.split('-')
  const mesIdx = parseInt(mes, 10) - 1
  return `${MESES_PTBR[mesIdx]} de ${ano}`
}

export function TabGerencialFinanceiro({
  dados,
  loading,
  horizonte,
  onHorizonteChange,
  onAbrirConta,
}: TabGerencialProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [projetoSaudeModal, setProjetoSaudeModal] = useState<{
    id: string
    codigo: string
    nome: string
  } | null>(null)

  const fluxo = dados?.bloco1_fluxo_caixa
  const margem = dados?.bloco2_margem_projetos
  const alertas = dados?.bloco3_alertas_atraso

  const maiorValorFluxo = useMemo(() => {
    if (!fluxo) return 10000
    return Math.max(...fluxo.meses.map((m) => Math.max(m.totalEntradas, m.totalSaidas)), 10000)
  }, [fluxo])

  const handleAbrirProjeto = (projetoId: string) => {
    navigate(`/projetos?projeto=${projetoId}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!dados || !fluxo || !margem || !alertas) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Sem dados da visão gerencial. Tente atualizar a página.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Seletor de horizonte */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#D95A2B]" />
            Visão Gerencial do Financeiro
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fluxo de caixa projetado, margem real por projeto e alertas de atraso — dados
            consolidados no servidor (referência {formatDateBr(dados.data_referencia)}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Horizonte:</span>
          <Select
            value={String(horizonte)}
            onValueChange={(v) => onHorizonteChange(Number(v) as 3 | 6 | 12)}
          >
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ============ BLOCO 1 — FLUXO DE CAIXA PROJETADO ============ */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Fluxo de Caixa Projetado ({horizonte} meses)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Meses anteriores: valores efetivamente recebidos/pagos. Meses futuros: projeção por
                vencimento das contas (recebíveis de contratos e medições faturadas, pagáveis de
                medições e custos).
              </CardDescription>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-center">
                <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                  Entradas
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatCurrencyBr(fluxo.totais.totalEntradas)}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                  Saídas
                </span>
                <span className="font-mono font-bold text-rose-700">
                  {formatCurrencyBr(fluxo.totais.totalSaidas)}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                  Saldo final
                </span>
                <span
                  className={`font-mono font-bold ${
                    fluxo.totais.saldoFinal >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {formatCurrencyBr(fluxo.totais.saldoFinal)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {fluxo.totais.mesesComAlertaNegativo > 0 && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>
                Saldo acumulado negativo em {fluxo.totais.mesesComAlertaNegativo} mês(es) do
                horizonte projetado.
              </span>
            </div>
          )}

          {/* Gráfico de barras entradas × saídas com linha de saldo acumulado */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-end gap-2 min-w-max px-1" style={{ height: '260px' }}>
              {fluxo.meses.map((m: VisaoGerencialFluxoMes) => {
                const alturaEntrada = Math.min(
                  100,
                  Math.max((m.totalEntradas / maiorValorFluxo) * 100, 2),
                )
                const alturaSaida = Math.min(
                  100,
                  Math.max((m.totalSaidas / maiorValorFluxo) * 100, 2),
                )

                return (
                  <div
                    key={m.mesChave}
                    className="flex flex-col items-center gap-1 w-[64px] shrink-0"
                  >
                    {/* Saldo acumulado em "linha" (número acima das barras) */}
                    <span
                      className={`text-[9px] font-mono font-bold whitespace-nowrap ${
                        m.saldoAcumulado >= 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}
                      title={`Saldo acumulado: ${formatCurrencyBr(m.saldoAcumulado)}`}
                    >
                      {formatCurrencyBr(m.saldoAcumulado)}
                    </span>
                    {/* Barras entradas × saídas */}
                    <div className="h-44 flex items-end justify-center gap-1 w-full">
                      <div
                        className="w-4 bg-emerald-500 rounded-t-sm"
                        style={{ height: `${alturaEntrada}%` }}
                        title={`Entradas ${mesLabel(m.mesChave)}: ${formatCurrencyBr(m.totalEntradas)}`}
                      />
                      <div
                        className="w-4 bg-rose-500 rounded-t-sm"
                        style={{ height: `${alturaSaida}%` }}
                        title={`Saídas ${mesLabel(m.mesChave)}: ${formatCurrencyBr(m.totalSaidas)}`}
                      />
                    </div>
                    {/* Rótulo do mês */}
                    <span
                      className={`text-[10px] font-bold whitespace-nowrap ${
                        m.isAtual
                          ? 'text-[#D95A2B]'
                          : m.isFuturo
                            ? 'text-slate-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {m.rotulo}
                    </span>
                    {/* Saldo do mês */}
                    <span
                      className={`text-[9px] font-mono ${
                        m.saldoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrencyBr(m.saldoMes)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 pt-3 text-xs text-slate-600 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-xs" />
              <span>Entradas (recebido + a receber)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-rose-500 rounded-xs" />
              <span>Saídas (pago + a pagar)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-blue-700">Acum</span>
              <span>Saldo acumulado</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ BLOCO 2 — MARGEM REAL POR PROJETO ============ */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Percent className="w-4 h-4 text-[#D95A2B]" />
            Margem Real por Projeto
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Previsto da proposta de origem × realizado (receitas aprovadas/realizadas − custos pagos
            e comprometidos). Clique na linha para abrir a ficha do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {/* Consolidado no topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider block">
                Margem média prevista
              </span>
              <span className="text-lg font-bold font-mono text-slate-800">
                {margem.consolidado.margemMediaPrevistaPerc.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider block">
                Margem média real
              </span>
              <span
                className={`text-lg font-bold font-mono ${
                  margem.consolidado.margemMediaRealPerc >=
                  margem.consolidado.margemMediaPrevistaPerc
                    ? 'text-emerald-700'
                    : margem.consolidado.margemMediaRealPerc >=
                        margem.consolidado.margemMediaPrevistaPerc - 10
                      ? 'text-amber-600'
                      : 'text-rose-700'
                }`}
              >
                {margem.consolidado.margemMediaRealPerc.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider block">
                Desvio médio da carteira
              </span>
              <span
                className={`text-lg font-bold font-mono ${
                  margem.consolidado.desvioMedioPp >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {margem.consolidado.desvioMedioPp >= 0 ? '+' : ''}
                {margem.consolidado.desvioMedioPp.toFixed(1)} p.p.
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider block">
                Semáforo da carteira
              </span>
              <span className="text-sm font-bold flex items-center gap-1.5 mt-1">
                <span>🟢 {margem.consolidado.projetosVerde}</span>
                <span>🟡 {margem.consolidado.projetosAmarelo}</span>
                <span>🔴 {margem.consolidado.projetosVermelho}</span>
              </span>
            </div>
          </div>

          {margem.projetos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhum projeto ativo na carteira no momento.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Projeto / Cliente</th>
                    <th className="p-3 text-right">Previsto (preço)</th>
                    <th className="p-3 text-right">Custo previsto</th>
                    <th className="p-3 text-right">Margem prevista</th>
                    <th className="p-3 text-right">Receita real</th>
                    <th className="p-3 text-right">Custo real</th>
                    <th className="p-3 text-right">Margem real</th>
                    <th className="p-3 text-center">Desvio</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {margem.projetos.map((p: VisaoGerencialProjetoMargem) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleAbrirProjeto(p.id)}
                    >
                      <td className="p-3">
                        <span className="font-mono font-semibold text-[#1E2A4A] block">
                          {p.codigo}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[220px]">
                          {p.clienteNome}
                        </span>
                        {p.propostaNumero && (
                          <span className="text-[10px] text-slate-400 block">
                            Proposta: {p.propostaNumero}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatCurrencyBr(p.previsto.preco)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatCurrencyBr(p.previsto.custo)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {p.previsto.margemPerc.toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatCurrencyBr(p.real.receitaTotal)}
                        {p.real.receitaRealizada > 0 && (
                          <span className="block text-[10px] text-emerald-600">
                            Recebido: {formatCurrencyBr(p.real.receitaRealizada)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatCurrencyBr(p.real.custoTotal)}
                        {p.real.custoComprometido > 0 && (
                          <span className="block text-[10px] text-amber-600">
                            Comprometido: {formatCurrencyBr(p.real.custoComprometido)}
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          p.real.margemPerc >= p.previsto.margemPerc
                            ? 'text-emerald-700'
                            : p.real.margemPerc >= p.previsto.margemPerc - 10
                              ? 'text-amber-600'
                              : 'text-rose-700'
                        }`}
                      >
                        {p.real.margemPerc.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          title={p.desvio.descricao}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white"
                        >
                          {p.desvio.semaforo === 'verde'
                            ? '🟢'
                            : p.desvio.semaforo === 'amarelo'
                              ? '🟡'
                              : '🔴'}
                          <span className="text-[10px] font-mono text-slate-600">
                            {p.desvio.pontosPercentuais >= 0 ? '+' : ''}
                            {p.desvio.pontosPercentuais.toFixed(1)} p.p.
                          </span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 text-[#D95A2B] border-orange-200 hover:bg-orange-50"
                            onClick={() =>
                              setProjetoSaudeModal({
                                id: p.id,
                                codigo: p.codigo,
                                nome: p.clienteNome,
                              })
                            }
                            title="Ver painel Saúde Financeira em tempo real"
                          >
                            <HeartPulse className="w-3.5 h-3.5 mr-1" />
                            Saúde
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleAbrirProjeto(p.id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ficha
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ BLOCO 3 — ALERTA DE ATRASO ============ */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Alerta de Atraso ({alertas.totalAtrasadosCount} conta(s))
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Contas a receber e a pagar vencidas e não liquidadas, ordenadas pelos maiores dias de
            atraso. Clique para registrar recebimento/pagamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          {/* Receber em atraso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Receber em atraso ({alertas.receber.totalCount})
              </h4>
              <span className="font-mono text-xs font-bold text-rose-700">
                {formatCurrencyBr(alertas.receber.totalValor)}
              </span>
            </div>
            {alertas.receber.contas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhuma conta a receber em atraso. 🎉</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-rose-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-rose-50 border-b border-rose-200 text-rose-800 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Projeto</th>
                      <th className="p-2.5">Vencimento</th>
                      <th className="p-2.5 text-center">Dias</th>
                      <th className="p-2.5 text-right">Valor</th>
                      <th className="p-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 bg-white">
                    {alertas.receber.contas.map((c: VisaoGerencialContaAtrasada) => (
                      <tr key={c.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="p-2.5 font-medium text-slate-800 max-w-[260px] truncate">
                          {c.descricao}
                        </td>
                        <td className="p-2.5">
                          {c.projetoCodigo ? (
                            <span className="font-mono text-indigo-700">{c.projetoCodigo}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-rose-700">
                          {formatDateBr(c.vencimento)}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-300 font-bold"
                          >
                            {c.diasAtraso}d
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(c.valor)}
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => onAbrirConta(c.id)}
                          >
                            Receber
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagar em atraso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                Pagar em atraso ({alertas.pagar.totalCount})
              </h4>
              <span className="font-mono text-xs font-bold text-rose-700">
                {formatCurrencyBr(alertas.pagar.totalValor)}
              </span>
            </div>
            {alertas.pagar.contas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhuma conta a pagar em atraso. 🎉</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-amber-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-amber-50 border-b border-amber-200 text-amber-800 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5">Projeto</th>
                      <th className="p-2.5">Vencimento</th>
                      <th className="p-2.5 text-center">Dias</th>
                      <th className="p-2.5 text-right">Valor</th>
                      <th className="p-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50 bg-white">
                    {alertas.pagar.contas.map((c: VisaoGerencialContaAtrasada) => (
                      <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-2.5 font-medium text-slate-800 max-w-[260px] truncate">
                          {c.descricao}
                        </td>
                        <td className="p-2.5">
                          {c.projetoCodigo ? (
                            <span className="font-mono text-indigo-700">{c.projetoCodigo}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-amber-700">
                          {formatDateBr(c.vencimento)}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-300 font-bold"
                          >
                            {c.diasAtraso}d
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(c.valor)}
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => onAbrirConta(c.id)}
                          >
                            Pagar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Modal de Saúde Financeira do Projeto selecionado */}
      {projetoSaudeModal && (
        <ModalSaudeFinanceiraProjeto
          open={!!projetoSaudeModal}
          onOpenChange={(op) => {
            if (!op) setProjetoSaudeModal(null)
          }}
          projetoId={projetoSaudeModal.id}
          projetoCodigo={projetoSaudeModal.codigo}
          projetoNome={projetoSaudeModal.nome}
        />
      )}
    </div>
  )
}

export default TabGerencialFinanceiro
