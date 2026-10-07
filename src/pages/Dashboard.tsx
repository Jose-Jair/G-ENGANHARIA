import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardService, DashboardDados, PeriodoFiltroPropostas } from '@/services/dashboard'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { ETAPA_FUNIL_LABELS, EtapaFunil } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  Kanban,
  FileText,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Megaphone,
  HardHat,
  ArrowRight,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  ChevronRight,
  Calendar,
  PieChart as PieChartIcon,
  Sparkles,
  Rocket,
  Compass,
  Check,
  EyeOff,
  Users,
} from 'lucide-react'

export function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [periodoPropostas, setPeriodoPropostas] = useState<PeriodoFiltroPropostas>('mes_corrente')
  const [dados, setDados] = useState<DashboardDados | null>(null)
  const [guiaOculto, setGuiaOculto] = useState<boolean>(() => {
    return localStorage.getItem('gestao_gplus_guia_oculto') === 'true'
  })

  // Carregar dados e registrar auditoria de acesso do Admin
  const carregarDashboard = async (periodo = periodoPropostas) => {
    setLoading(true)
    try {
      // Registrar acesso ao dashboard (audit log no backend)
      await dashboardService.registrarAcesso()

      // Calcular dados em tempo de execução
      const data = await dashboardService.carregarDashboard(periodo)
      setDados(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Dashboard',
        description: err.message || 'Falha ao consolidar indicadores operacionais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDashboard(periodoPropostas)
  }, [periodoPropostas])

  const handlePeriodoChange = (novoPeriodo: PeriodoFiltroPropostas) => {
    setPeriodoPropostas(novoPeriodo)
  }

  // Lista compacta ordenada das 9 colunas do funil
  const etapasFunilOrdem: EtapaFunil[] = [
    'identificada',
    'qualificada',
    'em_cadencia',
    'em_conversa',
    'com_proposta_elaborada',
    'proposta_enviada',
    'parceira',
    'nutricao_mensal',
    'inativa',
  ]

  return (
    <div className="space-y-6">
      {/* GUIA DE PRIMEIROS PASSOS (BETA ONBOARDING PARA O ADMIN) */}
      {!guiaOculto && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50/90 via-amber-50/50 to-white shadow-xs overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#D95A2B] text-white rounded-xl shadow-xs">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Guia de Primeiros Passos — Ativação Operacional
                  </CardTitle>
                  <Badge className="bg-[#D95A2B] text-white text-[10px] font-bold uppercase tracking-wider">
                    Versão Beta
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600 mt-0.5">
                  Ordem recomendada para colocar a esteira do GESTÃO G+ em produção com seus dados
                  reais.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGuiaOculto(true)
                  localStorage.setItem('gestao_gplus_guia_oculto', 'true')
                }}
                className="text-xs text-slate-500 hover:text-slate-800 h-8"
                title="Ocultar este guia do painel"
              >
                <EyeOff className="w-3.5 h-3.5 mr-1" />
                Ocultar Guia
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Passo 1: Empresas */}
              <div
                onClick={() => navigate('/empresas')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  (dados?.funil.totalEmpresasAtivas ?? 0) > 0
                    ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                    : 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    {(dados?.funil.totalEmpresasAtivas ?? 0) > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3 mr-0.5" /> Concluído
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                        Iniciar
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#D95A2B] transition-colors flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    1. Empresas & Contratos
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Cadastre empresas vencedoras de licitações ou importe planilha de prospects.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#D95A2B] font-semibold group-hover:underline">
                  <span>Cadastrar empresas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Passo 2: Funil */}
              <div
                onClick={() => navigate('/funil')}
                className="p-3.5 rounded-xl border bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      Comercial
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                    <Kanban className="w-4 h-4 text-blue-500" />
                    2. Funil & Cadência
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Qualifique empresas, envie toques multicanal e classifique por Curva ABC.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-600 font-semibold group-hover:underline">
                  <span>Abrir funil</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Passo 3: Propostas */}
              <div
                onClick={() => navigate('/propostas')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  (dados?.propostas.totalEnviadas ?? 0) > 0
                    ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                    {(dados?.propostas.totalEnviadas ?? 0) > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3 mr-0.5" /> Concluído
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Orçamentos
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    3. Propostas Comerciais
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Monte propostas pelo catálogo de serviços com margens e links públicos.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold group-hover:underline">
                  <span>Criar proposta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Passo 4: Projetos */}
              <div
                onClick={() => navigate('/projetos')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  (dados?.projetos.emExecucaoCount ?? 0) > 0
                    ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      4
                    </span>
                    {(dados?.projetos.emExecucaoCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <Check className="w-3 h-3 mr-0.5" /> Concluído
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        Operação
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                    4. Projetos & Executores
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Vincule executores homologados, controle etapas por disciplina, ARTs e
                    entregáveis.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-700 font-semibold group-hover:underline">
                  <span>Ver projetos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Passo 5: Financeiro */}
              <div
                onClick={() => navigate('/financeiro')}
                className="p-3.5 rounded-xl border bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      5
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Caixa
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    5. Gestão Financeira
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Acompanhe receitas de propostas, subcontratações de medições e o fluxo 12 meses.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold group-hover:underline">
                  <span>Acessar finanças</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CABEÇALHO DO DASHBOARD EXECUTIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#D95A2B] text-white rounded-lg shadow-sm">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#1E2A4A]">
                  Dashboard Executivo — GESTÃO G+
                </h1>
                <Badge
                  variant="outline"
                  className="bg-orange-50 text-[#D95A2B] border-orange-200 font-bold text-[10px] uppercase tracking-wide"
                >
                  {isAdmin ? 'Visão Executiva (Admin)' : 'Visão Comercial'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Painel consolidado em tempo de execução com visão 360° de Funil, Propostas, Produção
                por Área de Atuação, Projetos e Finanças.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDashboard(periodoPropostas)}
            disabled={loading}
            className="text-xs text-slate-700 hover:text-blue-700 hover:border-blue-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Indicadores
          </Button>
        </div>
      </div>

      {/* 5. PAINEL DE ALERTAS CRÍTICOS (CONSOLIDADO E CLICÁVEL) */}
      {dados && dados.alertas.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Painel Central de Alertas Críticos ({dados.alertas.length})
              </CardTitle>
              <span className="text-[11px] text-amber-800 font-medium">
                Clique no alerta para abrir o módulo com o filtro aplicado
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {dados.alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  onClick={() => navigate(alerta.rotaDestino)}
                  className="p-3 bg-white rounded-lg border border-amber-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {alerta.titulo}
                      </span>
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        {alerta.descricao}
                      </p>
                    </div>
                    {alerta.badgeLabel && (
                      <Badge
                        className={`text-[9px] shrink-0 font-bold ${
                          alerta.severidade === 'critico'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                        variant="outline"
                      >
                        {alerta.badgeLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <span>
                      Responsável: <strong>{alerta.responsavel || 'Operação'}</strong>
                    </span>
                    <span className="text-blue-600 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Acessar <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO 1: COMERCIAL / FUNIL & CURVA ABC DINÂMICA */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Kanban className="w-4 h-4 text-blue-600" />
                1. Comercial & Funil de Intermediação
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Distribuição das empresas pelas 9 etapas do funil, volume de contratos sob gestão e
                classificação Curva ABC.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/funil')}
              className="text-xs text-blue-600 hover:text-blue-800 self-start sm:self-auto h-8"
            >
              Abrir Funil Kanban <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Métricas Topo Comercial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => navigate('/empresas')}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Empresas Ativas
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {dados?.funil.totalEmpresasAtivas ?? 0}
                </span>
                <Building2 className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[11px] text-blue-600 hover:underline mt-1 block">
                Ver lista completa de empresas &rarr;
              </span>
            </div>

            <div
              onClick={() => navigate('/funil')}
              className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">
                Contratos Sob Gestão
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-2xl font-bold font-mono text-blue-900">
                  {formatCurrencyBr(dados?.funil.valorTotalContratosGestao ?? 0)}
                </span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[11px] text-blue-700 mt-1 block">
                Total de contratos públicos ativos mapeados
              </span>
            </div>

            {/* Curva A */}
            <div
              onClick={() => navigate('/funil')}
              className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Curva A (&ge; R$ 5M)
                </span>
                <Badge className="bg-emerald-600 text-white text-[10px]">Classe A</Badge>
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-2xl font-bold font-mono text-emerald-900">
                  {dados?.funil.curvaABC.A.count ?? 0}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-800">
                  {formatCurrencyBr(dados?.funil.curvaABC.A.valor ?? 0)}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                Empresas prioritárias para prospecção
              </span>
            </div>

            {/* Curva B & C */}
            <div
              onClick={() => navigate('/funil')}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Curva B e C
                </span>
                <div className="flex gap-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                  >
                    B: {dados?.funil.curvaABC.B.count ?? 0}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                    C: {dados?.funil.curvaABC.C.count ?? 0}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                <div>
                  Curva B: <strong>{formatCurrencyBr(dados?.funil.curvaABC.B.valor ?? 0)}</strong>
                </div>
                <div>
                  Curva C: <strong>{formatCurrencyBr(dados?.funil.curvaABC.C.valor ?? 0)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Formato Compacto: Contagem de Empresas por Etapa do Funil (9 colunas) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Funil de Vendas — Contagem por Etapa (Compacto)
              </span>
              <span className="text-[11px] text-slate-500">
                Clique em qualquer etapa para abrir o Funil
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
              {etapasFunilOrdem.map((etapaKey) => {
                const count = dados?.funil.contagemPorEtapa[etapaKey] ?? 0
                return (
                  <div
                    key={etapaKey}
                    onClick={() => navigate('/funil')}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer text-center group"
                    title={`${ETAPA_FUNIL_LABELS[etapaKey]}: ${count} empresa(s)`}
                  >
                    <div className="text-[10px] font-semibold text-slate-600 line-clamp-1 group-hover:text-blue-700">
                      {ETAPA_FUNIL_LABELS[etapaKey]}
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-0.5 group-hover:text-blue-600">
                      {count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: PROPOSTAS COM SELETOR DE PERÍODO */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                2. Propostas Técnicas & Conversão
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Taxa de aceite, volumes comparativos propostos × fechados, alçadas pendentes e
                monitor de expiração.
              </CardDescription>
            </div>

            {/* SELETOR DE PERÍODO (Mês Corrente / Últimos 90 dias / Ano Corrente) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Período:</span>
              <Select
                value={periodoPropostas}
                onValueChange={(v) => handlePeriodoChange(v as PeriodoFiltroPropostas)}
              >
                <SelectTrigger className="w-[170px] text-xs h-8 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_corrente">Mês Corrente</SelectItem>
                  <SelectItem value="ultimos_90_dias">Últimos 90 Dias</SelectItem>
                  <SelectItem value="ano_corrente">Ano Corrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* 4 Cards de Propostas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Taxa de Aceite */}
            <div
              onClick={() => navigate('/propostas?status=aceita')}
              className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Taxa de Aceite
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-900 mt-2">
                {dados?.propostas.taxaAceite ?? 0}%
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                {dados?.propostas.totalAceitas ?? 0} aceitas de{' '}
                {dados?.propostas.totalEnviadas ?? 0} enviadas no período
              </p>
            </div>

            {/* Proposto x Fechado no Mês Corrente */}
            <div
              onClick={() => navigate('/propostas')}
              className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">
                Mês Corrente: Proposto × Fechado
              </span>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-600">Proposto:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatCurrencyBr(dados?.propostas.valorPropostoMes ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-emerald-700 font-semibold">Fechado:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatCurrencyBr(dados?.propostas.valorFechadoMes ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Aguardando Aprovação Interna (Alçada) */}
            <div
              onClick={() => navigate('/propostas?status=aprovacao_interna')}
              className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Aprovação Interna
                </span>
                <Badge className="bg-amber-500 text-slate-950 text-[10px]">Alçada</Badge>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-950 mt-2">
                {dados?.propostas.aguardandoAprovacaoInterna.total ?? 0}
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                Propostas retidas por alçada financeira/admin
              </p>
            </div>

            {/* Expirando D-3 & Expiradas */}
            <div
              onClick={() => navigate('/propostas?status=expirada')}
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Alertas de Validade
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-amber-700 font-medium">Expirando em D-3:</span>
                  <Badge
                    variant="outline"
                    className="font-mono bg-amber-100 text-amber-900 border-amber-300 text-[10px]"
                  >
                    {dados?.propostas.proximasExpirarD3.length ?? 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Expiradas no mês:</span>
                  <Badge
                    variant="outline"
                    className="font-mono bg-slate-200 text-slate-800 border-slate-300 text-[10px]"
                  >
                    {dados?.propostas.expiradasNoMes.length ?? 0}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico / Distribuição dos Motivos de Recusa */}
          {dados && dados.propostas.recusasPorMotivo.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <PieChartIcon className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Distribuição dos Motivos de Recusa de Propostas no Período
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {dados.propostas.recusasPorMotivo.map((recusa) => (
                  <div
                    key={recusa.motivo}
                    className="p-3 bg-white border border-slate-200 rounded-md"
                  >
                    <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {recusa.motivo}
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-lg font-bold font-mono text-rose-600">
                        {recusa.quantidade}
                      </span>
                      <span className="text-xs font-mono text-slate-500">{recusa.percentual}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listagem Rápida de Propostas Expirando em D-3 (Clicáveis) */}
          {dados && dados.propostas.proximasExpirarD3.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Propostas Próximas de Expirar (D-3 ou menos)
                </span>
                <span className="text-[11px] text-amber-800">Ação de follow-up recomendada</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {dados.propostas.proximasExpirarD3.map((prop) => (
                  <div
                    key={prop.id}
                    onClick={() => navigate(`/propostas?busca=${encodeURIComponent(prop.numero)}`)}
                    className="p-2.5 bg-white border border-amber-200 rounded-md hover:border-amber-400 cursor-pointer text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono">{prop.numero}</div>
                      <div className="text-[11px] text-slate-600 truncate max-w-[150px]">
                        {prop.cliente}
                      </div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                      {prop.diasRestantes === 0 ? 'Vence Hoje' : `${prop.diasRestantes}d restantes`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOVO BLOCO: PRODUÇÃO POR ÁREA DE ATUAÇÃO TÉCNICA */}
          {dados && dados.producaoPorArea && (
            <div className="border border-orange-200 bg-orange-50/25 rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-orange-200 pb-2">
                <div>
                  <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-orange-600" />
                    Produção por Área de Atuação Técnica (Período Selecionado)
                  </span>
                  <p className="text-[11px] text-slate-600">
                    Propostas emitidas, taxa de aceite, valores cotados/fechados e projetos/etapas
                    gerados por especialidade de engenharia.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Área de Atuação</th>
                      <th className="py-2.5 px-3 text-center">Propostas Emitidas</th>
                      <th className="py-2.5 px-3 text-center">Propostas Aceitas</th>
                      <th className="py-2.5 px-3 text-right">Valor Proposto</th>
                      <th className="py-2.5 px-3 text-right">Valor Fechado</th>
                      <th className="py-2.5 px-3 text-center">Projetos Gerados</th>
                      <th className="py-2.5 px-3 text-center">Etapas Criadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dados.producaoPorArea.map((area) => (
                      <tr key={area.areaId} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-semibold text-slate-900">{area.areaNome}</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {area.propostasEmitidas}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-emerald-700 font-bold">
                          {area.propostasAceitas}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatCurrencyBr(area.valorProposto)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-800">
                          {formatCurrencyBr(area.valorFechado)}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-700">
                          {area.projetosGerados}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">
                          {area.etapasGeradas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 3: PROJETOS DE ENGENHARIA */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                3. Operação de Engenharia & Projetos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Monitoramento por semáforo de saúde (🟢/🟡/🔴), etapas em atraso, vencimento de
                documentos e riscos críticos.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/projetos')}
              className="text-xs text-blue-600 hover:text-blue-800 self-start sm:self-auto h-8"
            >
              Ver Todos os Projetos <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Semáforo de Saúde dos Projetos */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div
              onClick={() => navigate('/projetos?saude=verde')}
              className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors text-center"
            >
              <span className="text-xs font-semibold text-emerald-800 block">🟢 Verde</span>
              <span className="text-2xl font-bold font-mono text-emerald-900 block mt-1">
                {dados?.projetos.porSaude.verde ?? 0}
              </span>
              <span className="text-[10px] text-emerald-700">No prazo / Normal</span>
            </div>

            <div
              onClick={() => navigate('/projetos?saude=amarelo')}
              className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors text-center"
            >
              <span className="text-xs font-semibold text-amber-800 block">🟡 Amarelo</span>
              <span className="text-2xl font-bold font-mono text-amber-900 block mt-1">
                {dados?.projetos.porSaude.amarelo ?? 0}
              </span>
              <span className="text-[10px] text-amber-700">Atenção</span>
            </div>

            <div
              onClick={() => navigate('/projetos?saude=vermelho')}
              className="p-3 bg-rose-50/70 border border-rose-300 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors text-center"
            >
              <span className="text-xs font-semibold text-rose-800 block">🔴 Vermelho</span>
              <span className="text-2xl font-bold font-mono text-rose-900 block mt-1">
                {dados?.projetos.porSaude.vermelho ?? 0}
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">Crítico</span>
            </div>

            <div
              onClick={() => navigate('/projetos?status=em_andamento')}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-center"
            >
              <span className="text-xs font-semibold text-slate-600 block">Em Execução</span>
              <span className="text-2xl font-bold font-mono text-slate-800 block mt-1">
                {dados?.projetos.emExecucaoCount ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">Andamento</span>
            </div>

            <div
              onClick={() => navigate('/projetos?status=concluido')}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-center"
            >
              <span className="text-xs font-semibold text-slate-600 block">Concluídos</span>
              <span className="text-2xl font-bold font-mono text-slate-800 block mt-1">
                {dados?.projetos.concluidosCount ?? 0}
              </span>
              <span className="text-[10px] text-slate-500">Entregues</span>
            </div>
          </div>

          {/* LISTA DOS PROJETOS VERMELHOS (CRÍTICOS) */}
          {dados && dados.projetos.vermelhosLista.length > 0 && (
            <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-4">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider block mb-2">
                Projetos com Alerta Vermelho de Saúde ({dados.projetos.vermelhosLista.length})
              </span>
              <div className="space-y-2">
                {dados.projetos.vermelhosLista.map((prj) => (
                  <div
                    key={prj.id}
                    onClick={() => navigate(`/projetos?busca=${encodeURIComponent(prj.codigo)}`)}
                    className="p-3 bg-white border border-rose-200 rounded-lg hover:border-rose-400 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          {prj.codigo}
                        </span>
                        <strong className="text-xs text-slate-900">{prj.nome}</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 italic">
                        "{prj.justificativa}"
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-800 block">
                        {formatCurrencyBr(prj.valor)}
                      </span>
                      <span className="text-[10px] text-blue-600 hover:underline">
                        Ver no Projetos &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid de 3 Blocos Operacionais: Etapas Atrasadas, Documentos e Riscos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bloco 1: Etapas em Atraso */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    Etapas em Atraso
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] bg-rose-50 text-rose-700 border-rose-200"
                  >
                    {dados?.projetos.etapasAtrasadas.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2 mt-2">
                  {dados?.projetos.etapasAtrasadas.slice(0, 3).map((et) => (
                    <div
                      key={et.id}
                      onClick={() =>
                        navigate(`/projetos?busca=${encodeURIComponent(et.projetoCodigo)}`)
                      }
                      className="p-2 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs"
                    >
                      <div className="font-semibold text-slate-900 truncate">{et.etapaNome}</div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                        <span>{et.projetoCodigo}</span>
                        <span className="text-rose-600 font-bold">{et.diasAtraso}d atraso</span>
                      </div>
                    </div>
                  ))}
                  {(dados?.projetos.etapasAtrasadas.length ?? 0) === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      Nenhuma etapa com prazo vencido.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco 2: Documentos Vencendo (D-30/15/7/1) */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Documentos Vencendo
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] bg-amber-50 text-amber-800 border-amber-300"
                  >
                    {dados?.projetos.documentosVencendo.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2 mt-2">
                  {dados?.projetos.documentosVencendo.slice(0, 3).map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() =>
                        navigate(`/projetos?busca=${encodeURIComponent(doc.projetoCodigo)}`)
                      }
                      className="p-2 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-900 truncate">
                          {doc.tipo} {doc.numero}
                        </span>
                        <Badge className="text-[9px] bg-amber-100 text-amber-900 border-amber-200 uppercase">
                          {doc.alertaNivel}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Projeto: {doc.projetoCodigo} • Vence: {formatDateBr(doc.vencimento)}
                      </div>
                    </div>
                  ))}
                  {(dados?.projetos.documentosVencendo.length ?? 0) === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      Nenhum documento com alerta de vencimento.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco 3: Riscos Alto/Alto em Aberto (Destaque Vermelho) */}
            <div className="p-4 bg-rose-50/40 border border-rose-200 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Riscos Alto / Alto
                  </span>
                  <Badge className="bg-rose-600 text-white text-[10px]">
                    {dados?.projetos.riscosAltoAlto.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2 mt-2">
                  {dados?.projetos.riscosAltoAlto.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      onClick={() =>
                        navigate(`/projetos?busca=${encodeURIComponent(r.projetoCodigo)}`)
                      }
                      className="p-2 rounded bg-white border border-rose-200 hover:border-rose-300 cursor-pointer text-xs"
                    >
                      <div className="font-semibold text-rose-900 line-clamp-1">{r.descricao}</div>
                      <div className="text-[10px] text-slate-600 mt-1 line-clamp-1">
                        Mitigação: {r.mitigacao}
                      </div>
                    </div>
                  ))}
                  {(dados?.projetos.riscosAltoAlto.length ?? 0) === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      Nenhum risco de severidade Alta/Alta aberto.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 4: FINANCEIRO & PROJEÇÃO DE CAIXA 30/60/90 DIAS */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                4. Controladoria Financeira & Projeção de Caixa
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Saldos a receber e pagar, inadimplência e projeção de liquidez consolidada para 30,
                60 e 90 dias.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/financeiro')}
              className="text-xs text-emerald-700 hover:text-emerald-900 self-start sm:self-auto h-8"
            >
              Abrir Módulo Financeiro <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Saldos a Receber e a Pagar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => navigate('/financeiro?tab=receber')}
              className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Saldo a Receber
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-900 mt-2">
                {formatCurrencyBr(dados?.financeiro.saldoReceber ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {(dados?.financeiro.atrasadasReceber.valor ?? 0) > 0 ? (
                  <span className="text-rose-600 font-semibold">
                    {formatCurrencyBr(dados?.financeiro.atrasadasReceber.valor ?? 0)} (
                    {dados?.financeiro.atrasadasReceber.qtd}) atrasadas
                  </span>
                ) : (
                  <span className="text-emerald-700">Sem atrasos a receber</span>
                )}
              </div>
            </div>

            <div
              onClick={() => navigate('/financeiro?tab=pagar')}
              className="p-4 bg-rose-50/60 border border-rose-200 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                  Saldo a Pagar
                </span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-rose-900 mt-2">
                {formatCurrencyBr(dados?.financeiro.saldoPagar ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {(dados?.financeiro.atrasadasPagar.valor ?? 0) > 0 ? (
                  <span className="text-rose-600 font-semibold">
                    {formatCurrencyBr(dados?.financeiro.atrasadasPagar.valor ?? 0)} (
                    {dados?.financeiro.atrasadasPagar.qtd}) atrasadas
                  </span>
                ) : (
                  <span className="text-slate-500">Sem contas a pagar em atraso</span>
                )}
              </div>
            </div>

            <div
              onClick={() => navigate('/financeiro?tab=fluxo_caixa')}
              className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                  Saldo Líquido Previsto
                </span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-blue-900 mt-2">
                {formatCurrencyBr(dados?.financeiro.saldoLiquido ?? 0)}
              </div>
              <p className="text-[11px] text-blue-700 mt-1">
                Recebíveis previstos subtraídos dos pagamentos
              </p>
            </div>
          </div>

          {/* Projeção de Caixa 30 / 60 / 90 dias (Reuso do cálculo da Etapa 9) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Projeção de Caixa por Horizonte (30, 60 e 90 Dias)
              </span>
              <span className="text-[11px] text-slate-500">
                Cálculo consolidado sem duplicar regras
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 30 Dias */}
              <div
                onClick={() => navigate('/financeiro?tab=fluxo_caixa')}
                className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>Próximos 30 Dias</span>
                  <Badge variant="outline" className="text-[10px]">
                    D+30
                  </Badge>
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Receber:</span>
                    <span className="font-mono text-emerald-600 font-semibold">
                      +{formatCurrencyBr(dados?.financeiro.projecao30Dias.receber ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pagar:</span>
                    <span className="font-mono text-rose-600 font-semibold">
                      -{formatCurrencyBr(dados?.financeiro.projecao30Dias.pagar ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                    <span>Saldo:</span>
                    <span
                      className={`font-mono ${(dados?.financeiro.projecao30Dias.saldo ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {formatCurrencyBr(dados?.financeiro.projecao30Dias.saldo ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 60 Dias */}
              <div
                onClick={() => navigate('/financeiro?tab=fluxo_caixa')}
                className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>Próximos 60 Dias</span>
                  <Badge variant="outline" className="text-[10px]">
                    D+60
                  </Badge>
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Receber:</span>
                    <span className="font-mono text-emerald-600 font-semibold">
                      +{formatCurrencyBr(dados?.financeiro.projecao60Dias.receber ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pagar:</span>
                    <span className="font-mono text-rose-600 font-semibold">
                      -{formatCurrencyBr(dados?.financeiro.projecao60Dias.pagar ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                    <span>Saldo:</span>
                    <span
                      className={`font-mono ${(dados?.financeiro.projecao60Dias.saldo ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {formatCurrencyBr(dados?.financeiro.projecao60Dias.saldo ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 90 Dias */}
              <div
                onClick={() => navigate('/financeiro?tab=fluxo_caixa')}
                className="p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>Próximos 90 Dias</span>
                  <Badge variant="outline" className="text-[10px]">
                    D+90
                  </Badge>
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Receber:</span>
                    <span className="font-mono text-emerald-600 font-semibold">
                      +{formatCurrencyBr(dados?.financeiro.projecao90Dias.receber ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pagar:</span>
                    <span className="font-mono text-rose-600 font-semibold">
                      -{formatCurrencyBr(dados?.financeiro.projecao90Dias.pagar ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                    <span>Saldo:</span>
                    <span
                      className={`font-mono ${(dados?.financeiro.projecao90Dias.saldo ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {formatCurrencyBr(dados?.financeiro.projecao90Dias.saldo ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 6: ATIVIDADE RECENTE (REGISTROS DE AUDITORIA) */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                6. Atividade Operacional Recente (Trilha de Auditoria)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Últimos eventos relevantes registrados no sistema (movimentações no funil,
                propostas, aprovações e exportações).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                Hoje: {dados?.resumoAtividades.hojeCount ?? 0} eventos
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                Semana: {dados?.resumoAtividades.semanaCount ?? 0} eventos
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/auditoria')}
                className="text-xs text-blue-600 hover:text-blue-800 h-8"
              >
                Trilha Completa <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {dados?.atividadeRecente.map((item) => (
              <div
                key={item.id}
                className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono uppercase px-1.5 py-0"
                    >
                      {item.acao}
                    </Badge>
                    <span className="font-semibold text-slate-900 truncate">
                      {item.descricaoFormatada}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Realizado por: <strong>{item.usuarioNome}</strong> (
                    {item.usuarioEmail || 'sistema'})
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap">
                  {formatDateTimeBr(item.dataHora)}
                </span>
              </div>
            ))}
            {(dados?.atividadeRecente.length ?? 0) === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma atividade recente registrada nos logs de auditoria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
