// =============================================================================
// GESTÃO G+ — PAINEL DE SAÚDE FINANCEIRA POR PROJETO
// Endpoint: GET /backend/v1/projetos/{id}/saude-financeira
// Margem real em tempo real, teto vendido, custos lançados, exposição e alertas críticos
// Visível no Financeiro e no Monitoramento de Prazos
// =============================================================================

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrencyBr } from '@/lib/formatters'
import { financeiroService } from '@/services/financeiro'
import { useToast } from '@/hooks/use-toast'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  FolderGit2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

interface SaudeFinanceiraResponse {
  success: boolean
  projeto_id: string
  projeto_codigo: string
  projeto_nome: string
  proposta_numero: string | null
  teto_vendido: number
  custos: {
    soma_os_externas: number
    outros_custos_lancados: number
    custo_total_comprometido: number
    custos_pagos: number
    custos_em_aberto: number
    total_os_externas_count: number
    soma_custo_interno?: number
    total_os_internas_count?: number
    detalhes_os: Array<{
      id: string
      numero: string
      disciplina: string
      prestador_id: string
      status: string
      valor_os: number
      retencao_tecnica_acumulada: number
    }>
  }
  receitas: {
    total_receber_contratado: number
    total_recebido: number
    total_receber_aberto: number
  }
  margem: {
    prevista_proposta_perc: number
    real_valor: number
    real_perc: number
    minima_toleravel_perc: number
    status: 'saudavel' | 'atencao' | 'critico'
  }
  exposicao_financeira: number
  alertas: Array<{
    tipo: string
    nivel: 'critico' | 'atencao' | 'info'
    mensagem: string
  }>
}

interface PainelSaudeFinanceiraProjetoProps {
  projetoId: string
  projetoCodigo?: string
  projetoNome?: string
  modoCompacto?: boolean
}

export const PainelSaudeFinanceiraProjeto: React.FC<PainelSaudeFinanceiraProjetoProps> = ({
  projetoId,
  projetoCodigo,
  projetoNome,
  modoCompacto = false,
}) => {
  const { toast } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<SaudeFinanceiraResponse | null>(null)

  const carregarSaude = async () => {
    if (!projetoId) return
    setCarregando(true)
    try {
      const res = await financeiroService.getSaudeFinanceiraProjeto(projetoId)
      setDados(res)
    } catch (err: any) {
      toast({
        title: 'Erro ao consultar saúde financeira',
        description: err.message || 'Falha ao carregar indicadores.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarSaude()
  }, [projetoId])

  if (carregando) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#D95A2B]" />
          <span className="text-xs text-slate-500">Calculando margem real e exposição...</span>
        </CardContent>
      </Card>
    )
  }

  if (!dados) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-6 text-center text-xs text-slate-500">
          Dados de saúde financeira indisponíveis para este projeto.
        </CardContent>
      </Card>
    )
  }

  const { teto_vendido, custos, receitas, margem, exposicao_financeira, alertas } = dados

  const getBadgeMargem = (st: string) => {
    switch (st) {
      case 'saudavel':
        return (
          <Badge className="bg-emerald-600 text-white text-xs gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saudável ({margem.real_perc}%)
          </Badge>
        )
      case 'atencao':
        return (
          <Badge className="bg-amber-600 text-white text-xs gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Atenção ({margem.real_perc}%)
          </Badge>
        )
      default:
        return (
          <Badge className="bg-rose-600 text-white text-xs gap-1 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5" />
            Margem Crítica ({margem.real_perc}%)
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Alertas Críticos de Margem Abaixo do Mínimo ou Estouro */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((al, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border flex items-center gap-3 text-xs ${
                al.nivel === 'critico'
                  ? 'bg-rose-50 border-rose-300 text-rose-950 font-medium'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div
                className={`p-1.5 rounded-md ${
                  al.nivel === 'critico' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="flex-1">{al.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid Principal de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Margem Real */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Margem Real em Tempo Real
              </span>
              {getBadgeMargem(margem.status)}
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {formatCurrencyBr(margem.real_valor)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Mínimo Configurado: {margem.minima_toleravel_perc}%</span>
              <span>Proposta: {margem.prevista_proposta_perc}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Teto Vendido */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Teto Vendido Contratado
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-700">
              {formatCurrencyBr(teto_vendido)}
            </div>
            <div className="text-[11px] text-slate-500">
              Recebido: <strong>{formatCurrencyBr(receitas.total_recebido)}</strong> (
              {teto_vendido > 0 ? Math.round((receitas.total_recebido / teto_vendido) * 100) : 0}
              %)
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Custos Comprometidos */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Custo Total Comprometido
            </span>
            <div className="text-2xl font-bold font-mono text-rose-700">
              {formatCurrencyBr(custos.custo_total_comprometido)}
            </div>
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div>
                Ext: {custos.total_os_externas_count} OS (
                {formatCurrencyBr(custos.soma_os_externas)})
              </div>
              {custos.soma_custo_interno !== undefined && custos.soma_custo_interno > 0 && (
                <div className="text-emerald-700 font-medium">
                  Int: {custos.total_os_internas_count || 0} OS (
                  {formatCurrencyBr(custos.soma_custo_interno)})
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Exposição Financeira de Caixa */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Exposição Financeira (Caixa)
            </span>
            <div
              className={`text-2xl font-bold font-mono ${
                exposicao_financeira > 0 ? 'text-amber-700' : 'text-slate-800'
              }`}
            >
              {formatCurrencyBr(exposicao_financeira)}
            </div>
            <div className="text-[11px] text-slate-500">
              {exposicao_financeira > 0
                ? 'Custos à frente dos recebimentos realizados'
                : 'Caixa coberto pelos recebimentos'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento de Ordens de Serviço Externas do Projeto */}
      {!modoCompacto && custos.detalhes_os && custos.detalhes_os.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Ordens de Serviço Externas Vinculadas ({custos.detalhes_os.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Composição do custo direto subcontratado debitado da margem do projeto.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarSaude}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Sincronizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {custos.detalhes_os.map((os) => (
                <div
                  key={os.id}
                  className="p-3 text-xs flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{os.numero}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {os.disciplina}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {os.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">
                      {formatCurrencyBr(os.valor_os)}
                    </span>
                    {os.retencao_tecnica_acumulada > 0 && (
                      <span className="text-[10px] text-emerald-700 font-mono block">
                        Ret. Técnica: {formatCurrencyBr(os.retencao_tecnica_acumulada)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default PainelSaudeFinanceiraProjeto
