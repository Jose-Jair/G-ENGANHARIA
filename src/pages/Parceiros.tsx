import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  EmpresaRecord,
  PropostaRecord,
  ProjetoRecord,
  ContaRecord,
  ContratoRecord,
  IndicadoresParceiro,
  CurvaABC,
  PesosScoreDemandaParceiro,
} from '@/types'
import { parceirosService } from '@/services/parceiros'
import { contratosService } from '@/services/contratos'
import { parametrosService } from '@/services/parametros'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  Building2,
  Search,
  Plus,
  AlertTriangle,
  Award,
  TrendingUp,
  DollarSign,
  Clock,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart3,
  HelpCircle,
  Download,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { exportService } from '@/services/exportService'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj, formatPhoneBr } from '@/lib/cnpj'
import { ParceiroDetailModal } from '@/components/parceiros/ParceiroDetailModal'
import { ModalCriarParceiro } from '@/components/parceiros/ModalCriarParceiro'

export function ParceirosPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [parceiros, setParceiros] = useState<EmpresaRecord[]>([])
  const [propostas, setPropostas] = useState<PropostaRecord[]>([])
  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [contas, setContas] = useState<ContaRecord[]>([])
  const [contratos, setContratos] = useState<ContratoRecord[]>([])

  // Parâmetros operacionais
  const [diasLimiteSemDemanda, setDiasLimiteSemDemanda] = useState<number>(180)
  const [modoCurva, setModoCurva] = useState<'dinamico' | 'manual'>('dinamico')
  const [pesosScore, setPesosScore] = useState<PesosScoreDemandaParceiro>({
    peso_contratos_valor: 35,
    peso_taxa_conversao: 35,
    peso_projetos_ano: 30,
  })
  const [cortesPareto, setCortesPareto] = useState({ corteA: 80, corteB: 95 })

  // Filtros e busca
  const [busca, setBusca] = useState('')
  const [filtroCurva, setFiltroCurva] = useState<string>('todos')
  const [filtroAlerta, setFiltroAlerta] = useState<string>('todos')
  const [ordenacao, setOrdenacao] = useState<'receita' | 'score' | 'demanda' | 'nome'>('receita')

  // Modais
  const [parceiroSelecionado, setParceiroSelecionado] = useState<EmpresaRecord | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Permissões de escrita: Admin e Comercial leem e gravam; Financeiro e Gestor apenas leitura
  const canWrite = user?.role === 'admin' || user?.role === 'comercial'

  const carregarDados = async () => {
    setLoading(true)
    try {
      // 1. Carregar parâmetros
      try {
        const [pDias, pModo, pPesos, pPareto] = await Promise.all([
          parametrosService.getByKey('dias_alerta_sem_demanda_parceiro'),
          parametrosService.getByKey('modo_curva_parceiros'),
          parametrosService.getByKey('pesos_score_demanda_parceiro'),
          parametrosService.getByKey('percentuais_curva_abc_parceiro'),
        ])
        if (pDias?.valor) setDiasLimiteSemDemanda(parseInt(pDias.valor, 10) || 180)
        if (pModo?.valor === 'manual' || pModo?.valor === 'dinamico') setModoCurva(pModo.valor)
        if (pPesos?.valor) {
          try {
            const parsed = JSON.parse(pPesos.valor)
            setPesosScore(parsed)
          } catch {
            /* ignore */
          }
        }
        if (pPareto?.valor) {
          try {
            const parsed = JSON.parse(pPareto.valor)
            setCortesPareto({
              corteA: parsed.corte_a_percent || 80,
              corteB: parsed.corte_b_percent || 95,
            })
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignora falhas em parâmetros */
      }

      // 2. Carregar entidades de banco
      const [parcs, props, projs, conts, contrs] = await Promise.all([
        parceirosService.listParceiros(),
        parceirosService.listPropostas(),
        parceirosService.listProjetos(),
        parceirosService.listContasReceber(),
        contratosService.listAll(),
      ])

      setParceiros(parcs)
      setPropostas(props)
      setProjetos(projs)
      setContas(conts)
      setContratos(contrs)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // 3. Calcular Indicadores e Curva ABC Dinâmica
  const indicadores = useMemo(() => {
    return parceirosService.calcularIndicadoresParceiros(
      parceiros,
      propostas,
      projetos,
      contas,
      contratos,
      diasLimiteSemDemanda,
      pesosScore,
      modoCurva,
      cortesPareto,
    )
  }, [
    parceiros,
    propostas,
    projetos,
    contas,
    contratos,
    diasLimiteSemDemanda,
    pesosScore,
    modoCurva,
    cortesPareto,
  ])

  // Map rápido de indicadores por empresaId
  const mapaIndicadores = useMemo(() => {
    const map = new Map<string, IndicadoresParceiro>()
    for (const ind of indicadores) {
      map.set(ind.empresaId, ind)
    }
    return map
  }, [indicadores])

  // Métricas de cabeçalho
  const metricas = useMemo(() => {
    const totalParceiros = indicadores.length
    const receitaTotal = indicadores.reduce((acc, i) => acc + i.receitaAcumulada, 0)
    const totalCriticos = indicadores.filter((i) => i.isSemDemandaCritica).length
    const curvaA = indicadores.filter((i) => i.curvaDinamica === 'A').length
    const curvaB = indicadores.filter((i) => i.curvaDinamica === 'B').length
    const curvaC = indicadores.filter((i) => i.curvaDinamica === 'C').length
    const scoreMedio =
      totalParceiros > 0
        ? Math.round(indicadores.reduce((acc, i) => acc + i.scoreDemanda, 0) / totalParceiros)
        : 0

    return {
      totalParceiros,
      receitaTotal,
      totalCriticos,
      curvaA,
      curvaB,
      curvaC,
      scoreMedio,
    }
  }, [indicadores])

  // Filtragem e ordenação da lista
  const parceirosFiltrados = useMemo(() => {
    return indicadores
      .filter((ind) => {
        const emp = ind.empresa
        const termo = busca.toLowerCase().trim()
        if (termo) {
          const matchNome = (emp.razao_social || '').toLowerCase().includes(termo)
          const matchFantasia = (emp.nome_fantasia || '').toLowerCase().includes(termo)
          const matchCnpj = (emp.cnpj || '').includes(termo)
          const matchUf = (emp.uf || '').toLowerCase().includes(termo)
          if (!matchNome && !matchFantasia && !matchCnpj && !matchUf) return false
        }

        if (filtroCurva !== 'todos' && ind.curvaDinamica !== filtroCurva) {
          return false
        }

        if (filtroAlerta === 'alerta' && !ind.isSemDemandaCritica) {
          return false
        }
        if (filtroAlerta === 'ativo' && ind.isSemDemandaCritica) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (ordenacao === 'receita') return b.receitaAcumulada - a.receitaAcumulada
        if (ordenacao === 'score') return b.scoreDemanda - a.scoreDemanda
        if (ordenacao === 'demanda') return b.diasSemDemanda - a.diasSemDemanda
        return (a.empresa.razao_social || '').localeCompare(b.empresa.razao_social || '')
      })
  }, [indicadores, busca, filtroCurva, filtroAlerta, ordenacao])

  const abrirDetalhe = (emp: EmpresaRecord) => {
    setParceiroSelecionado(emp)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Parceiros Demandantes
            </h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Etapa 6
            </Badge>
            {!canWrite && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
                Somente Leitura
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empresas com contratos públicos vigentes que terceirizam projetos de engenharia.
            Classificação por Curva ABC DINÂMICA (Pareto) e Score de Demanda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (parceirosFiltrados.length === 0) {
                toast({
                  title: 'Sem parceiros para exportar',
                  description: 'A lista filtrada de parceiros demandantes está vazia.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `parceiros_demandantes_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'parceiros',
                  descricao: 'Exportação de parceiros demandantes com Curva ABC dinâmica e score',
                  filtros: {
                    curva: filtroCurva,
                    alerta: filtroAlerta,
                    busca: busca || undefined,
                    ordenacao,
                  },
                  columns: [
                    {
                      header: 'Nome / Razão Social',
                      accessor: (ind) =>
                        ind.empresa.razao_social || ind.empresa.nome_fantasia || '',
                    },
                    {
                      header: 'Nome Fantasia',
                      accessor: (ind) => ind.empresa.nome_fantasia || '',
                    },
                    {
                      header: 'CNPJ',
                      accessor: (ind) => formatCnpj(ind.empresa.cnpj),
                    },
                    { header: 'UF', accessor: (ind) => ind.empresa.uf || '' },
                    {
                      header: 'Curva ABC Dinâmica',
                      accessor: (ind) => `Curva ${ind.curvaDinamica}`,
                    },
                    {
                      header: '% Receita Acumulada',
                      accessor: (ind) => `${ind.percentualReceitaAcumulada}%`,
                    },
                    { header: 'Score de Demanda', accessor: (ind) => ind.scoreDemanda },
                    {
                      header: 'Receita Acumulada (R$)',
                      accessor: (ind) => formatCurrencyBr(ind.receitaAcumulada),
                    },
                    {
                      header: 'Ticket Médio (R$)',
                      accessor: (ind) => formatCurrencyBr(ind.ticketMedio),
                    },
                    {
                      header: 'Taxa de Conversão (%)',
                      accessor: (ind) => `${ind.taxaConversao}%`,
                    },
                    {
                      header: 'Última Demanda',
                      accessor: (ind) =>
                        ind.ultimaDemandaData
                          ? formatDateBr(ind.ultimaDemandaData)
                          : 'Sem registro',
                    },
                    {
                      header: 'Dias sem Demanda',
                      accessor: (ind) =>
                        ind.diasSemDemanda !== undefined ? ind.diasSemDemanda : '',
                    },
                    {
                      header: 'Status de Alerta',
                      accessor: (ind) => (ind.isSemDemandaCritica ? 'Em Alerta (+dias)' : 'Ativo'),
                    },
                  ],
                  data: parceirosFiltrados,
                })
                toast({
                  title: 'Parceiros Exportados',
                  description: `${parceirosFiltrados.length} parceiro(s) exportado(s) com sucesso. Auditoria registrada no servidor.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar parceiros',
                  description: err.message || 'Falha ao exportar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs gap-1.5 shrink-0 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          {canWrite && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Parceiro Direto
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Total Parceiros</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{metricas.totalParceiros}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-700">{metricas.curvaA} A</span> •
              <span className="font-semibold text-blue-700">{metricas.curvaB} B</span> •
              <span className="font-semibold text-amber-700">{metricas.curvaC} C</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Receita Intermediada</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrencyBr(metricas.receitaTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Acumulada em propostas aceitas e faturamento
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Score Médio Demanda</span>
              <Award className="w-4 h-4 text-indigo-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{metricas.scoreMedio}/100</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Calculado ao abrir (contratos, conversão, projetos)
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-xs ${
            metricas.totalCriticos > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-white'
          }`}
        >
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Sem Demanda há +{diasLimiteSemDemanda}d</span>
              <AlertTriangle
                className={`w-4 h-4 ${metricas.totalCriticos > 0 ? 'text-rose-600' : 'text-slate-400'}`}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={`text-2xl font-bold ${
                metricas.totalCriticos > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {metricas.totalCriticos}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Alerta direcionado ao Comercial</div>
          </CardContent>
        </Card>
      </div>

      {/* Caixa Explicativa da Curva ABC Dinâmica (Pareto) */}
      <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
        <CardContent className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-950 block">
                Curva ABC Dinâmica (Ajuste A3):
              </span>
              <p className="text-slate-600 text-[11px]">
                A classificação é recalculada automaticamente com base na distribuição de Pareto da
                receita acumulada:
                <strong> Curva A</strong> = acumula os primeiros ~{cortesPareto.corteA}% da receita;
                <strong> Curva B</strong> = entre {cortesPareto.corteA}% e {cortesPareto.corteB}%;
                <strong> Curva C</strong> = o restante. Modo atual: <strong>{modoCurva}</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] bg-white border-blue-200 text-blue-800">
              Corte A: ≤{cortesPareto.corteA}% • Corte B: ≤{cortesPareto.corteB}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por razão, CNPJ, UF..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="text-xs h-8 pl-8"
              />
            </div>

            <div>
              <Select value={filtroCurva} onValueChange={setFiltroCurva}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Curva ABC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Curvas</SelectItem>
                  <SelectItem value="A">Curva A (~80% Pareto)</SelectItem>
                  <SelectItem value="B">Curva B (~80-95%)</SelectItem>
                  <SelectItem value="C">Curva C (Restante)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Status de Demanda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="alerta">
                    Com Alerta (+{diasLimiteSemDemanda}d sem demanda)
                  </SelectItem>
                  <SelectItem value="ativo">Demanda Recente (Ativos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select
                value={ordenacao}
                onValueChange={(val) =>
                  setOrdenacao(val as 'receita' | 'score' | 'demanda' | 'nome')
                }
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Maior Receita Acumulada</SelectItem>
                  <SelectItem value="score">Maior Score Demanda</SelectItem>
                  <SelectItem value="demanda">Mais Tempo Sem Demanda</SelectItem>
                  <SelectItem value="nome">Razão Social (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Parceiros Demandantes */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Parceiros Demandantes Cadastrados ({parceirosFiltrados.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Clique em uma empresa para abrir a visão geral, histórico de demandas e linha do tempo
              de auditoria.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ranking & Parceiro</th>
                  <th className="py-3 px-3">Curva Dinâmica</th>
                  <th className="py-3 px-3 text-right">Receita Acumulada</th>
                  <th className="py-3 px-3 text-center">Score Demanda</th>
                  <th className="py-3 px-3 text-center">Contratos Ativos</th>
                  <th className="py-3 px-3">Última Demanda</th>
                  <th className="py-3 px-3 text-center">Status Alerta</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      Carregando parceiros e calculando curvas...
                    </td>
                  </tr>
                ) : parceirosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      Nenhum parceiro encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  parceirosFiltrados.map((ind) => {
                    const emp = ind.empresa
                    const curvaBg =
                      ind.curvaDinamica === 'A'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : ind.curvaDinamica === 'B'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => abrirDetalhe(emp)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        {/* Nome & Ranking */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-slate-400 w-5">
                              #{ind.ranking}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                                {emp.razao_social}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {formatCnpj(emp.cnpj) || 'CNPJ não informado'}{' '}
                                {emp.uf && `• ${emp.uf}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Curva Dinâmica */}
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={`font-mono font-bold text-[10px] ${curvaBg}`}
                            title={`Acumula até ${ind.percentualReceitaAcumulada}% da receita geral no Pareto`}
                          >
                            Curva {ind.curvaDinamica}
                          </Badge>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {ind.percentualReceitaAcumulada}% acum.
                          </span>
                        </td>

                        {/* Receita Acumulada */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-bold text-slate-900 font-mono">
                            {formatCurrencyBr(ind.receitaAcumulada)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Ticket: {formatCurrencyBr(ind.ticketMedio)}
                          </span>
                        </td>

                        {/* Score Demanda */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1 font-bold text-slate-800">
                            <Award className="w-3.5 h-3.5 text-indigo-600" />
                            {ind.scoreDemanda}
                            <span className="text-[10px] text-slate-400">/100</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Conv: {ind.taxaConversao}%
                          </span>
                        </td>

                        {/* Contratos Ativos */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-semibold text-slate-800">
                            {ind.contratosAtivosQtd}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {formatCurrencyBr(ind.contratosAtivosValor)}
                          </span>
                        </td>

                        {/* Última Demanda */}
                        <td className="py-3 px-3">
                          <div className="text-slate-700">
                            {ind.ultimaDemandaData
                              ? formatDateBr(ind.ultimaDemandaData)
                              : 'Sem registro'}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {ind.diasSemDemanda !== undefined
                              ? `há ${ind.diasSemDemanda} dias`
                              : '-'}
                          </span>
                        </td>

                        {/* Status Alerta */}
                        <td className="py-3 px-3 text-center">
                          {ind.isSemDemandaCritica ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px] gap-1 font-bold animate-pulse"
                            >
                              <AlertTriangle className="w-3 h-3" />+{ind.diasSemDemanda}d sem
                              demanda
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ativo
                            </span>
                          )}
                        </td>

                        {/* Ação */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-800"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirDetalhe(emp)
                            }}
                          >
                            Ver Abas
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhe com 3 Abas: Visão Geral, Demandas, Linha do Tempo */}
      <ParceiroDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        parceiro={parceiroSelecionado}
        indicador={parceiroSelecionado ? mapaIndicadores.get(parceiroSelecionado.id) || null : null}
        propostas={propostas}
        projetos={projetos}
        contas={contas}
        contratos={contratos}
        onAtualizar={carregarDados}
      />

      {/* Modal de Novo Parceiro Direto (A1b) */}
      <ModalCriarParceiro
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={carregarDados}
      />
    </div>
  )
}
