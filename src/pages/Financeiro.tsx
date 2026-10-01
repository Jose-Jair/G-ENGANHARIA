import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ContaRecord, StatusConta, ProjetoRecord, ExecutorRecord, DocumentoRecord } from '@/types'
import { financeiroService, ResumoFinanceiro, MesFluxoCaixa } from '@/services/financeiro'
import { projetosService } from '@/services/projetos'
import { executoresService } from '@/services/executores'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  FileText,
  AlertCircle,
  Eye,
  Send,
  UploadCloud,
  Check,
  ShieldCheck,
  Briefcase,
  Layers,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { ModalNovaConta } from '@/components/financeiro/ModalNovaConta'
import { ModalDetalhesConta } from '@/components/financeiro/ModalDetalhesConta'
import { ModalRelatoriosFinanceiros } from '@/components/financeiro/ModalRelatoriosFinanceiros'

import { useSearchParams } from 'react-router-dom'

export function FinanceiroPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [executores, setExecutores] = useState<ExecutorRecord[]>([])
  const [medicoesAprovadas, setMedicoesAprovadas] = useState<DocumentoRecord[]>([])

  const [activeTab, setActiveTab] = useState<'receber' | 'pagar' | 'fluxo_caixa'>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'pagar' || tab === 'fluxo_caixa' || tab === 'receber') return tab
    return 'receber'
  })
  const [termoBusca, setTermoBusca] = useState(() => searchParams.get('busca') || '')
  const [filtroStatus, setFiltroStatus] = useState<string>(
    () => searchParams.get('status') || 'todos',
  )

  // Modais
  const [modalNovaContaOpen, setModalNovaContaOpen] = useState(false)
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false)
  const [modalRelatoriosOpen, setModalRelatoriosOpen] = useState(false)
  const [contaSelecionada, setContaSelecionada] = useState<ContaRecord | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'financeiro'

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [contasData, projsData, execsData, medData] = await Promise.all([
        financeiroService.listAll(),
        projetosService.list().catch(() => []),
        executoresService.list().catch(() => []),
        financeiroService.listMedicoesAprovadas().catch(() => []),
      ])

      setContas(contasData)
      setProjetos(projsData)
      setExecutores(execsData)
      setMedicoesAprovadas(medData)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar módulo financeiro',
        description: err.message || 'Verifique as permissões de acesso.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Cálculos de Resumo e Projeções
  const resumo = financeiroService.calcularResumoFinanceiro(contas)
  const fluxo12Meses = financeiroService.calcularFluxoCaixa12Meses(contas)
  const alertasVenc = financeiroService.calcularAlertasVencimento(contas)

  // Filtragem de listas
  const filtrarContas = (tipo: 'receber' | 'pagar') => {
    return contas.filter((c) => {
      if (c.tipo !== tipo) return false

      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'atrasada') {
          if (c.status !== 'atrasada') return false
        } else if (c.status !== filtroStatus) {
          return false
        }
      }

      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase()
        const desc = (c.descricao || '').toLowerCase()
        const nf = (c.nf || '').toLowerCase()
        const proj = (c.expand?.projeto?.codigo || '').toLowerCase()
        const exec = (c.expand?.executor?.nome || '').toLowerCase()
        if (
          !desc.includes(termo) &&
          !nf.includes(termo) &&
          !proj.includes(termo) &&
          !exec.includes(termo)
        ) {
          return false
        }
      }

      return true
    })
  }

  const contasReceberFiltradas = filtrarContas('receber')
  const contasPagarFiltradas = filtrarContas('pagar')

  const handleAbrirDetalhes = (c: ContaRecord) => {
    setContaSelecionada(c)
    setModalDetalhesOpen(true)
  }

  // Gráfico mensal simples: encontrar o maior valor do horizonte para calcular barras relativas
  const maiorValorFluxo = Math.max(
    ...fluxo12Meses.map((m) => Math.max(m.totalEntradas, m.totalSaidas)),
    10000,
  )

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestão Financeira & Fluxo de Caixa
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300"
            >
              Admin & Financeiro
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Contas a receber originadas de propostas/medições, subcontratações de executores e
            projeção de caixa consolidada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalRelatoriosOpen(true)}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Relatórios Financeiros
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const dadosExport =
                activeTab === 'receber' ? contasReceberFiltradas : contasPagarFiltradas
              if (dadosExport.length === 0) {
                toast({
                  title: 'Sem dados para exportar',
                  description: 'A lista atual não contém registros correspondentes.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `financeiro_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: `financeiro_${activeTab}`,
                  descricao: `Exportação da lista de contas a ${activeTab} com filtros ativos`,
                  isFinanceiro: true,
                  filtros: {
                    tipo: activeTab,
                    status: filtroStatus,
                    busca: termoBusca || undefined,
                  },
                  columns: [
                    {
                      header: 'Tipo',
                      accessor: (c) => (c.tipo === 'receber' ? 'A Receber' : 'A Pagar'),
                    },
                    { header: 'Descrição', accessor: (c) => c.descricao },
                    {
                      header: 'Cliente / Fornecedor',
                      accessor: (c) =>
                        c.tipo === 'receber'
                          ? c.expand?.projeto?.expand?.empresa?.razao_social ||
                            c.expand?.projeto?.expand?.empresa?.nome_fantasia ||
                            c.expand?.proposta?.expand?.empresa?.razao_social ||
                            c.expand?.proposta?.expand?.cliente_pf?.nome ||
                            'Cliente'
                          : c.expand?.executor?.nome || 'Despesa Operacional',
                    },
                    { header: 'Projeto', accessor: (c) => c.expand?.projeto?.codigo || '' },
                    { header: 'Proposta', accessor: (c) => c.expand?.proposta?.numero || '' },
                    { header: 'Valor Bruto (R$)', accessor: (c) => formatCurrencyBr(c.valor) },
                    {
                      header: 'Retenção Impostos (R$)',
                      accessor: (c) => formatCurrencyBr(c.retencao_impostos || 0),
                    },
                    {
                      header: 'Valor Líquido (R$)',
                      accessor: (c) => formatCurrencyBr(c.valor_liquido || c.valor),
                    },
                    {
                      header: 'Vencimento',
                      accessor: (c) => (c.vencimento ? formatDateBr(c.vencimento) : ''),
                    },
                    { header: 'Status', accessor: (c) => c.status },
                    {
                      header: 'Data de Baixa',
                      accessor: (c) => (c.data_pagamento ? formatDateBr(c.data_pagamento) : ''),
                    },
                    { header: 'Nota Fiscal / Doc', accessor: (c) => c.nf || '' },
                    { header: 'Forma Pagamento', accessor: (c) => c.forma_pagamento || '' },
                  ],
                  data: dadosExport,
                })
                toast({
                  title: 'Lista Exportada',
                  description: `${dadosExport.length} conta(s) exportada(s) para CSV com sucesso.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro na exportação',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canManage && (
            <Button
              size="sm"
              onClick={() => setModalNovaContaOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Lançamento
            </Button>
          )}
        </div>
      </div>

      {/* Alerta de Contas Vencidas / D-7 / D-1 */}
      {alertasVenc.totalAlertas > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Atenção aos Vencimentos ({alertasVenc.totalAlertas} conta(s) pendentes)
              </h4>
              <p className="text-xs text-amber-900 mt-0.5">
                {alertasVenc.atrasadas.length > 0 && (
                  <span className="font-semibold text-rose-700 mr-2">
                    • {alertasVenc.atrasadas.length} conta(s) em atraso
                  </span>
                )}
                {alertasVenc.d1Contas.length > 0 && (
                  <span className="font-semibold text-amber-800 mr-2">
                    • {alertasVenc.d1Contas.length} vencendo amanhã (D-1)
                  </span>
                )}
                {alertasVenc.d7Contas.length > 0 && (
                  <span className="text-amber-800">
                    • {alertasVenc.d7Contas.length} vencendo nos próximos 7 dias (D-7)
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFiltroStatus('atrasada')}
            className="text-xs border-amber-400 text-amber-950 hover:bg-amber-100 self-start md:self-auto"
          >
            Filtrar Atrasadas
          </Button>
        </div>
      )}

      {/* CARTÕES DE RESUMO CALCULADOS AO ABRIR (ITEM A) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo a Receber */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Saldo a Receber
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
              {formatCurrencyBr(resumo.saldoReceber)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              {resumo.atrasadosReceberValor > 0 ? (
                <span className="text-rose-600 font-semibold">
                  {formatCurrencyBr(resumo.atrasadosReceberValor)} ({resumo.atrasadosReceberQtd}) em
                  atraso
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">Nenhum atraso a receber</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Saldo a Pagar */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Saldo a Pagar
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
              {formatCurrencyBr(resumo.saldoPagar)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              {resumo.atrasadosPagarValor > 0 ? (
                <span className="text-rose-600 font-semibold">
                  {formatCurrencyBr(resumo.atrasadosPagarValor)} ({resumo.atrasadosPagarQtd}) em
                  atraso
                </span>
              ) : (
                <span className="text-slate-500 font-medium">Sem contas a pagar em atraso</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Saldo Líquido Projetado */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Saldo Líquido Previsto
              </span>
              <div
                className={`p-2 rounded-lg ${
                  resumo.saldoLiquidoProjetado >= 0
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-xl font-bold mt-2 font-mono ${
                resumo.saldoLiquidoProjetado >= 0 ? 'text-blue-700' : 'text-rose-700'
              }`}
            >
              {formatCurrencyBr(resumo.saldoLiquidoProjetado)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              (A receber menos a pagar pendente)
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Projeções 30 / 60 / 90 dias */}
        <Card className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <CardContent className="p-3 space-y-1.5 text-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block tracking-wider">
              Projeção de Caixa
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">30 dias:</span>
              <span
                className={`font-mono font-bold ${
                  resumo.projecao30Dias.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrencyBr(resumo.projecao30Dias.saldo)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">60 dias:</span>
              <span
                className={`font-mono font-bold ${
                  resumo.projecao60Dias.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrencyBr(resumo.projecao60Dias.saldo)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">90 dias:</span>
              <span
                className={`font-mono font-bold ${
                  resumo.projecao90Dias.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatCurrencyBr(resumo.projecao90Dias.saldo)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ABAS DO MÓDULO FINANCEIRO: CONTAS A RECEBER | CONTAS A PAGAR | FLUXO DE CAIXA */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="receber" className="text-xs font-semibold gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Contas a Receber ({contas.filter((c) => c.tipo === 'receber').length})
            </TabsTrigger>
            <TabsTrigger value="pagar" className="text-xs font-semibold gap-2">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              Contas a Pagar ({contas.filter((c) => c.tipo === 'pagar').length})
            </TabsTrigger>
            <TabsTrigger value="fluxo_caixa" className="text-xs font-semibold gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              Fluxo de Caixa (12 Meses)
            </TabsTrigger>
          </TabsList>

          {/* Filtros rápidos de busca e status nas abas de contas */}
          {activeTab !== 'fluxo_caixa' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Buscar descrição, NF, executor..."
                  className="pl-8 h-8 text-xs w-[200px]"
                />
              </div>

              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="atrasada">Atrasada</SelectItem>
                  <SelectItem value="paga">Paga/Recebida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ABA 1: CONTAS A RECEBER */}
        <TabsContent value="receber" className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Receitas Previstas e Faturamentos ({contasReceberFiltradas.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Originadas dos aceites de propostas da Etapa 7, medições de projetos e lançamentos
                  manuais.
                </p>
              </div>
            </div>

            {contasReceberFiltradas.length === 0 ? (
              <div className="p-12 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {termoBusca || filtroStatus !== 'todos'
                      ? 'Nenhuma conta a receber encontrada com estes filtros'
                      : 'Nenhuma receita ou conta a receber pendente'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {termoBusca || filtroStatus !== 'todos'
                      ? 'Ajuste os filtros de busca ou status para exibir os lançamentos.'
                      : 'Contas a receber são geradas quando propostas comerciais são aprovadas pelos parceiros/clientes ou adicionadas avulsas manualmente.'}
                  </p>
                </div>
                {canManage && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => setModalNovaContaOpen(true)}
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Lançar Nova Receita
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Descrição / Origem</th>
                      <th className="p-3">Projeto / Proposta</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Forma / NF</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contasReceberFiltradas.map((c) => {
                      const isPaga = c.status === 'paga' || c.status === 'realizada'
                      const isAtrasada = c.status === 'atrasada'

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isAtrasada ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="p-3">
                            <span className="font-semibold text-slate-900 block">
                              {c.descricao}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ID: {c.id.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="p-3 text-slate-700">
                            {c.expand?.projeto ? (
                              <span className="font-mono text-indigo-700 font-medium block">
                                {c.expand.projeto.codigo}
                              </span>
                            ) : c.expand?.proposta ? (
                              <span className="font-mono text-blue-700 font-medium block">
                                {c.expand.proposta.numero}
                              </span>
                            ) : (
                              <span className="text-slate-400">Avulso</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <span
                              className={isAtrasada ? 'text-rose-700 font-bold' : 'text-slate-700'}
                            >
                              {c.vencimento ? formatDateBr(c.vencimento) : '—'}
                            </span>
                            {isPaga && c.data_pagamento && (
                              <span className="block text-[10px] text-emerald-600">
                                Liq: {formatDateBr(c.data_pagamento)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {formatCurrencyBr(c.valor)}
                          </td>
                          <td className="p-3 text-slate-600">
                            <div>{c.forma_pagamento || 'Boleto'}</div>
                            {c.nf && (
                              <div className="text-[10px] text-slate-400 font-mono">NF: {c.nf}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold ${
                                isPaga
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : isAtrasada
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                    : c.status === 'enviada'
                                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                                      : c.status === 'aprovada'
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                        : c.status === 'cancelada'
                                          ? 'bg-slate-100 text-slate-500 border-slate-300'
                                          : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              {c.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAbrirDetalhes(c)}
                              className="h-7 text-xs px-2 text-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 2: CONTAS A PAGAR */}
        <TabsContent value="pagar" className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Subcontratações e Despesas Operacionais ({contasPagarFiltradas.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Subcontratações vinculadas a medições da Etapa 8 + despesas internas (salários,
                  aluguel, impostos).
                </p>
              </div>
            </div>

            {contasPagarFiltradas.length === 0 ? (
              <div className="p-12 text-center max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {termoBusca || filtroStatus !== 'todos'
                      ? 'Nenhuma conta a pagar encontrada com estes filtros'
                      : 'Nenhuma conta a pagar ou subcontratação pendente'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {termoBusca || filtroStatus !== 'todos'
                      ? 'Ajuste os filtros de busca ou status para exibir as contas.'
                      : 'Contas a pagar são alimentadas pelas medições de executores aprovadas nos projetos e por despesas operacionais da empresa lançadas manualmente.'}
                  </p>
                </div>
                {canManage && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => setModalNovaContaOpen(true)}
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Lançar Conta a Pagar
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Descrição / Finalidade</th>
                      <th className="p-3">Executor / Fornecedor</th>
                      <th className="p-3">Projeto / Medição</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Valor Bruto / Líquido</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contasPagarFiltradas.map((c) => {
                      const isPaga = c.status === 'paga' || c.status === 'realizada'
                      const isAtrasada = c.status === 'atrasada'

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isAtrasada ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="p-3">
                            <span className="font-semibold text-slate-900 block">
                              {c.descricao}
                            </span>
                            {c.nf && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                Doc: {c.nf}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {c.expand?.executor ? (
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {c.expand.executor.nome}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {c.expand.executor.tipo} • {c.expand.executor.cpf_cnpj}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-medium">Despesa Interna</span>
                            )}
                          </td>
                          <td className="p-3">
                            {c.expand?.projeto ? (
                              <span className="font-mono text-indigo-700 font-medium block">
                                {c.expand.projeto.codigo}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {c.medicao_aprovada_origem && (
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                Medição {c.medicao_aprovada_origem}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <span
                              className={isAtrasada ? 'text-rose-700 font-bold' : 'text-slate-700'}
                            >
                              {c.vencimento ? formatDateBr(c.vencimento) : '—'}
                            </span>
                            {isPaga && c.data_pagamento && (
                              <span className="block text-[10px] text-emerald-600">
                                Pago: {formatDateBr(c.data_pagamento)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-bold text-slate-900">
                              {formatCurrencyBr(c.valor)}
                            </div>
                            {c.retencao_impostos ? (
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                Líq:{' '}
                                {formatCurrencyBr(c.valor_liquido || c.valor - c.retencao_impostos)}
                              </div>
                            ) : null}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold ${
                                isPaga
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : isAtrasada
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                    : c.status === 'aprovada'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                      : c.status === 'cancelada'
                                        ? 'bg-slate-100 text-slate-500 border-slate-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              {c.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAbrirDetalhes(c)}
                              className="h-7 text-xs px-2 text-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 3: FLUXO DE CAIXA MENSAL CONSOLIDADO (ITEM D) */}
        <TabsContent value="fluxo_caixa" className="space-y-6">
          {/* Alerta de Saldo Negativo Projetado no Horizonte */}
          {fluxo12Meses.some((m) => m.alertaNegativo) && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-3 text-xs text-rose-950 shadow-xs">
              <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <strong className="block text-sm">Alerta de Déficit no Horizonte Projetado:</strong>
                Identificado saldo negativo em um ou mais meses dos próximos 12 meses. Avalie a
                antecipação de recebíveis de contratos ou reescalonamento de subcontratações.
              </div>
            </div>
          )}

          {/* Gráfico de Barras Mensais (12 Meses) */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Demonstrativo de Entradas vs. Saídas (12 Meses)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Comparativo mensal de valores realizados + previstos a receber versus pagos + a
                pagar.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 text-center">
                {fluxo12Meses.map((m) => {
                  const alturaEntradaPerc = Math.min(
                    100,
                    Math.max(6, Math.round((m.totalEntradas / maiorValorFluxo) * 100)),
                  )
                  const alturaSaidaPerc = Math.min(
                    100,
                    Math.max(6, Math.round((m.totalSaidas / maiorValorFluxo) * 100)),
                  )

                  return (
                    <div
                      key={m.mesChave}
                      className={`p-2 rounded-lg border flex flex-col justify-between ${
                        m.alertaNegativo
                          ? 'border-rose-300 bg-rose-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-slate-700 block mb-2 truncate">
                        {m.rotulo}
                      </span>

                      {/* Mini barras verticais */}
                      <div className="h-28 flex items-end justify-center gap-1.5 py-1">
                        <div
                          style={{ height: `${alturaEntradaPerc}%` }}
                          className="w-3 bg-emerald-500 rounded-t-sm"
                          title={`Entradas: ${formatCurrencyBr(m.totalEntradas)}`}
                        />
                        <div
                          style={{ height: `${alturaSaidaPerc}%` }}
                          className="w-3 bg-rose-500 rounded-t-sm"
                          title={`Saídas: ${formatCurrencyBr(m.totalSaidas)}`}
                        />
                      </div>

                      {/* Saldo Líquido do Mês */}
                      <div className="pt-2 border-t border-slate-200/80 text-[10px]">
                        <span
                          className={`font-mono font-bold block truncate ${
                            m.saldoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatCurrencyBr(m.saldoMes)}
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          Acum: {formatCurrencyBr(m.saldoAcumulado)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legenda do gráfico */}
              <div className="flex items-center justify-center gap-6 pt-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-emerald-500 rounded-xs" />
                  <span>Entradas (Recebido + A Receber)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-rose-500 rounded-xs" />
                  <span>Saídas (Pago + A Pagar)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela Consolidada Mensal */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900 text-sm">
                Tabela Detalhada do Fluxo de Caixa Mensal
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Mês / Ano</th>
                    <th className="p-3 text-right">Entradas Realizadas</th>
                    <th className="p-3 text-right">Entradas Previstas</th>
                    <th className="p-3 text-right">Total Entradas</th>
                    <th className="p-3 text-right">Saídas Realizadas</th>
                    <th className="p-3 text-right">Saídas Previstas</th>
                    <th className="p-3 text-right">Total Saídas</th>
                    <th className="p-3 text-right">Saldo do Mês</th>
                    <th className="p-3 text-right">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {fluxo12Meses.map((m) => (
                    <tr
                      key={m.mesChave}
                      className={`hover:bg-slate-50 transition-colors ${
                        m.alertaNegativo ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="p-3 font-sans font-bold text-slate-800">{m.rotulo}</td>
                      <td className="p-3 text-right text-slate-600">
                        {formatCurrencyBr(m.entradasRealizadas)}
                      </td>
                      <td className="p-3 text-right text-emerald-600">
                        {formatCurrencyBr(m.entradasPrevistas)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-800 bg-emerald-50/30">
                        {formatCurrencyBr(m.totalEntradas)}
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {formatCurrencyBr(m.saidasRealizadas)}
                      </td>
                      <td className="p-3 text-right text-rose-600">
                        {formatCurrencyBr(m.saidasPrevistas)}
                      </td>
                      <td className="p-3 text-right font-bold text-rose-800 bg-rose-50/30">
                        {formatCurrencyBr(m.totalSaidas)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          m.saldoMes >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrencyBr(m.saldoMes)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          m.saldoAcumulado >= 0 ? 'text-blue-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrencyBr(m.saldoAcumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Criar Nova Conta */}
      <ModalNovaConta
        open={modalNovaContaOpen}
        onOpenChange={setModalNovaContaOpen}
        tipoDefault={activeTab === 'pagar' ? 'pagar' : 'receber'}
        projetos={projetos}
        executores={executores}
        medicoesAprovadas={medicoesAprovadas}
        onSuccess={carregarDados}
      />

      {/* Modal Detalhes / Baixa / Cancelamento */}
      <ModalDetalhesConta
        open={modalDetalhesOpen}
        onOpenChange={setModalDetalhesOpen}
        conta={contaSelecionada}
        canManage={canManage}
        onSuccess={carregarDados}
      />

      {/* Modal Relatórios Financeiros Exportáveis (Item 3 do escopo) */}
      <ModalRelatoriosFinanceiros
        open={modalRelatoriosOpen}
        onOpenChange={setModalRelatoriosOpen}
        contas={contas}
        fluxo12Meses={fluxo12Meses}
        projetos={projetos}
      />
    </div>
  )
}
export default FinanceiroPage
