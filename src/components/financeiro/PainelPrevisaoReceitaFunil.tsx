// =============================================================================
// GESTÃO G+ — PAINEL DE PREVISÃO DE RECEITA PONDERADA (FUNIL DE PROSPECÇÃO)
// Endpoint: GET /backend/v1/financeiro/previsao-receita-funil
// Restrito: Admin e Financeiro
// =============================================================================

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrencyBr } from '@/lib/formatters'
import { financeiroService } from '@/services/financeiro'
import { useToast } from '@/hooks/use-toast'
import {
  TrendingUp,
  Filter,
  Loader2,
  RefreshCw,
  Building2,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface PrevisaoFunilResponse {
  success: boolean
  parametros_probabilidades: Record<string, number>
  totalizador: {
    total_empresas: number
    valor_bruto_total: number
    previsao_receita_ponderada_total: number
    fator_conversao_medio_perc: number
  }
  etapas: Array<{
    etapa: string
    probabilidade_perc: number
    total_empresas: number
    valor_bruto_potencial: number
    valor_ponderado: number
    empresas_detalhe: Array<{
      id: string
      nome: string
      cnpj: string
      etapa: string
      probabilidade_perc: number
      valor_bruto: number
      valor_ponderado: number
      total_propostas: number
    }>
  }>
}

const ROTULOS_ETAPAS: Record<string, { nome: string; cor: string }> = {
  identificada: { nome: 'Identificada', cor: 'bg-slate-100 text-slate-700 border-slate-300' },
  qualificada: { nome: 'Qualificada', cor: 'bg-blue-50 text-blue-700 border-blue-300' },
  em_cadencia: { nome: 'Em Cadência', cor: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  em_conversa: { nome: 'Em Conversa', cor: 'bg-purple-50 text-purple-700 border-purple-300' },
  com_proposta_elaborada: {
    nome: 'Proposta Elaborada',
    cor: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  proposta_enviada: {
    nome: 'Proposta Enviada',
    cor: 'bg-orange-50 text-orange-700 border-orange-300',
  },
  parceira: { nome: 'Parceira Ativa', cor: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  nutricao_mensal: { nome: 'Nutrição Mensal', cor: 'bg-sky-50 text-sky-700 border-sky-300' },
  inativa: { nome: 'Inativa', cor: 'bg-zinc-100 text-zinc-500 border-zinc-300' },
}

export const PainelPrevisaoReceitaFunil: React.FC = () => {
  const { toast } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<PrevisaoFunilResponse | null>(null)
  const [etapaExpandida, setEtapaExpandida] = useState<string | null>(null)

  const carregarPrevisao = async () => {
    setCarregando(true)
    try {
      const res = await financeiroService.getPrevisaoReceitaFunil()
      setDados(res)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar previsão de receita',
        description: err.message || 'Verifique suas permissões.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarPrevisao()
  }, [])

  if (carregando) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
          <span className="text-xs text-slate-500">
            Calculando previsão de receita ponderada...
          </span>
        </CardContent>
      </Card>
    )
  }

  if (!dados) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 text-center text-xs text-slate-500">
          Não foi possível carregar os dados de previsão de receita do funil.
        </CardContent>
      </Card>
    )
  }

  const { totalizador, etapas } = dados

  return (
    <div className="space-y-4">
      {/* Cards de Resumo Executivo da Carteira */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Previsão Ponderada Total
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              {formatCurrencyBr(totalizador.previsao_receita_ponderada_total)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Probabilidade aplicada sobre o pipeline ativo
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Valor Bruto em Negociação
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrencyBr(totalizador.valor_bruto_total)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Soma total sem desconto de probabilidade
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Taxa Média de Conversão
            </span>
            <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
              {totalizador.fator_conversao_medio_perc}%
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Relação ponderada sobre o total bruto
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Empresas Ativas no Funil
            </span>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">
              {totalizador.total_empresas}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Distribuídas pelas fases de prospecção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Etapas com Detalhamento */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#D95A2B]" />
              Distribuição por Etapa do Funil Comercial
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Probabilidades configuradas na Administração aplicadas sobre as oportunidades de cada
              empresa.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={carregarPrevisao}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {etapas
              .filter((e) => e.total_empresas > 0 || e.valor_bruto_potencial > 0)
              .map((etp) => {
                const info = ROTULOS_ETAPAS[etp.etapa] || {
                  nome: etp.etapa,
                  cor: 'bg-slate-100 text-slate-700',
                }
                const isExpanded = etapaExpandida === etp.etapa
                const percCarteira =
                  totalizador.previsao_receita_ponderada_total > 0
                    ? Math.round(
                        (etp.valor_ponderado / totalizador.previsao_receita_ponderada_total) * 100,
                      )
                    : 0

                return (
                  <div key={etp.etapa} className="p-4 hover:bg-slate-50/70 transition-colors">
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                      onClick={() => setEtapaExpandida(isExpanded ? null : etp.etapa)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-xs font-semibold ${info.cor}`}>
                          {info.nome}
                        </Badge>
                        <span className="text-xs text-slate-500 font-mono">
                          {etp.probabilidade_perc}% probabilidade
                        </span>
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                          {etp.total_empresas} empresa(s)
                        </span>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Bruto</span>
                          <span className="font-mono text-xs text-slate-600">
                            {formatCurrencyBr(etp.valor_bruto_potencial)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Ponderado</span>
                          <span className="font-mono text-sm font-bold text-emerald-700">
                            {formatCurrencyBr(etp.valor_ponderado)}
                          </span>
                        </div>
                        <div className="w-16 text-right hidden sm:block">
                          <span className="text-[10px] text-slate-400 block">% Total</span>
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {percCarteira}%
                          </span>
                        </div>
                        <div className="text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lista expandida de empresas desta etapa */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 pl-2">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-2">
                          Empresas na etapa {info.nome}:
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {etp.empresas_detalhe.map((emp) => (
                            <div
                              key={emp.id}
                              className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 block truncate">
                                  {emp.nome}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {emp.cnpj || 'Sem CNPJ'} • {emp.total_propostas} proposta(s)
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs font-bold text-emerald-700 block">
                                  {formatCurrencyBr(emp.valor_ponderado)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Bruto: {formatCurrencyBr(emp.valor_bruto)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default PainelPrevisaoReceitaFunil
