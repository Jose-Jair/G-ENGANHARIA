import React, { useState, useEffect } from 'react'
import { ExecutorRecord, StatusExecutor } from '@/types'
import { executoresService, ExecutorComMetricas } from '@/services/executores'
import { parametrosService } from '@/services/parametros'
import { formatDateBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Search,
  Star,
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  Download,
  Edit2,
  Trash2,
  ShieldAlert,
  Loader2,
  FileCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Award,
  Layers,
  MapPin,
  Briefcase,
  ChevronRight,
  Filter,
  HardHat,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ModalCriarEditarExecutor } from '@/components/executores/ModalCriarEditarExecutor'
import { ModalSuspenderExecutor } from '@/components/executores/ModalSuspenderExecutor'
import { ModalHistoricoAvaliacoes } from '@/components/executores/ModalHistoricoAvaliacoes'
import { ModalHistoricoAvaliacoesExecutor } from '@/components/executores/ModalHistoricoAvaliacoesExecutor'
import { ModalConvidarExecutor } from '@/components/executores/ModalConvidarExecutor'
import { avaliacoesExecutorService } from '@/services/avaliacoesExecutor'
import type { AvaliacaoExecutorRecord } from '@/services/avaliacoesExecutor'

import { useSearchParams } from 'react-router-dom'

export const ExecutoresPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [executores, setExecutores] = useState<ExecutorComMetricas[]>([])
  const [carregando, setCarregando] = useState(true)
  const [notaCorte, setNotaCorte] = useState<number>(3.0)

  // Aba ativa: 'cards' | 'ranking' | 'disponibilidade'
  const [abaAtiva, setAbaAtiva] = useState<string>('cards')

  // Filtros
  const [busca, setBusca] = useState(() => searchParams.get('busca') || '')
  const [filtroStatus, setFiltroStatus] = useState<string>(
    () => searchParams.get('status') || 'todos',
  )
  const [filtroAlerta, setFiltroAlerta] = useState<string>(
    () => searchParams.get('alerta') || 'todos',
  )
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('todas')
  const [filtroRegiao, setFiltroRegiao] = useState<string>('todas')
  const [filtroOcupacao, setFiltroOcupacao] = useState<string>('todos')

  // Modais
  const [modalCriarEditarOpen, setModalCriarEditarOpen] = useState(false)
  const [executorEditar, setExecutorEditar] = useState<ExecutorRecord | null>(null)

  const [modalSuspenderOpen, setModalSuspenderOpen] = useState(false)
  const [executorSuspender, setExecutorSuspender] = useState<ExecutorRecord | null>(null)

  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false)
  const [executorHistorico, setExecutorHistorico] = useState<ExecutorRecord | null>(null)

  const [modalConvidarOpen, setModalConvidarOpen] = useState(false)
  const [homologandoId, setHomologandoId] = useState<string | null>(null)

  // Avaliações de execução (coleção nova avaliacoes_executor) para badge de atenção e histórico
  const [avaliacoesExecucao, setAvaliacoesExecucao] = useState<AvaliacaoExecutorRecord[]>([])

  const [modalHistoricoExecOpen, setModalHistoricoExecOpen] = useState(false)

  const canEdit = !!(user && (user.role === 'admin' || user.role === 'gestor'))
  const canConvidar = !!(user && (user.role === 'admin' || user.role === 'comercial'))
  const canHomologar = !!(user && user.role === 'admin')

  const carregarDados = async () => {
    setCarregando(true)
    try {
      // Carregar nota de corte de parâmetros
      let corte = 3.0
      try {
        const pCorte = await parametrosService.getByKey('nota_corte_executor')
        if (pCorte?.valor) corte = parseFloat(pCorte.valor) || 3.0
      } catch {
        /* intentionally ignored */
      }
      setNotaCorte(corte)

      const lista = await executoresService.listComMetricas(corte)
      setExecutores(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar executores',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Carrega as avaliações de execução (coleção nova) — quem não tem permissão de leitura simplesmente não as vê
  useEffect(() => {
    let ativo = true
    avaliacoesExecutorService
      .listAll()
      .then((avs) => {
        if (ativo) setAvaliacoesExecucao(avs)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  // Homologação de executor com rota dedicada e auditoria HOMOLOGAR_EXECUTOR
  const handleHomologar = async (executor: ExecutorRecord) => {
    setHomologandoId(executor.id)
    try {
      await executoresService.homologar(executor.id)
      toast({
        title: 'Executor homologado!',
        description: `${executor.nome} foi ativado e está disponível para cotações e subcontratos.`,
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao homologar',
        description: err.message || 'Falha ao homologar executor.',
        variant: 'destructive',
      })
    } finally {
      setHomologandoId(null)
    }
  }

  // Alteração direta de homologação -> ativo (ou reativação)
  const handleAtivar = async (executor: ExecutorRecord) => {
    try {
      if (executor.status === 'homologacao' && user?.role === 'admin') {
        await handleHomologar(executor)
        return
      }
      await executoresService.alterarStatus(executor.id, 'ativo')
      toast({ title: 'Executor ativado com sucesso!' })
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao ativar', description: err.message, variant: 'destructive' })
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente remover este cadastro de executor?')) return
    try {
      await executoresService.delete(id)
      toast({ title: 'Executor excluído com sucesso' })
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  // Lista única de disciplinas e regiões para os selects de filtro
  const listaDisciplinas = Array.from(
    new Set(
      executores
        .flatMap((ex) => (ex.disciplinas ? ex.disciplinas.split(',').map((s) => s.trim()) : []))
        .filter(Boolean),
    ),
  ).sort()

  const listaRegioes = Array.from(
    new Set(executores.map((ex) => ex.regiao?.trim()).filter(Boolean) as string[]),
  ).sort()

  // Filtragem completa: busca, status, alerta, disciplina, região e ocupação
  const executoresFiltrados = executores.filter((ex) => {
    const matchBusca =
      !busca ||
      ex.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (ex.cpf_cnpj && ex.cpf_cnpj.toLowerCase().includes(busca.toLowerCase())) ||
      (ex.disciplinas && ex.disciplinas.toLowerCase().includes(busca.toLowerCase())) ||
      (ex.regiao && ex.regiao.toLowerCase().includes(busca.toLowerCase())) ||
      (ex.numero_registro && ex.numero_registro.toLowerCase().includes(busca.toLowerCase()))

    const matchStatus = filtroStatus === 'todos' || ex.status === filtroStatus

    let matchAlerta = true
    if (filtroAlerta === 'vencido') matchAlerta = ex.isRegistroVencido
    if (filtroAlerta === 'vencendo') matchAlerta = ex.isRegistroVencendoBreve
    if (filtroAlerta === 'baixa_nota') matchAlerta = ex.isAbaixoNotaCorte
    if (filtroAlerta === 'capacidade_cheia') matchAlerta = ex.isCapacidadeEsgotada

    const matchDisciplina =
      filtroDisciplina === 'todas' ||
      (ex.disciplinas &&
        ex.disciplinas
          .toLowerCase()
          .split(',')
          .map((d) => d.trim())
          .includes(filtroDisciplina.toLowerCase()))

    const matchRegiao = filtroRegiao === 'todas' || (ex.regiao && ex.regiao.trim() === filtroRegiao)

    let matchOcupacao = true
    if (filtroOcupacao === 'livre') matchOcupacao = ex.capacidadeLivre > 0
    else if (filtroOcupacao === 'esgotada') matchOcupacao = ex.isCapacidadeEsgotada
    else if (filtroOcupacao === 'parcial')
      matchOcupacao = ex.etapasAtivasCount > 0 && ex.capacidadeLivre > 0

    return (
      matchBusca && matchStatus && matchAlerta && matchDisciplina && matchRegiao && matchOcupacao
    )
  })

  // Ranking ordenado por nota geral decrescente (com sem nota no final)
  const executoresRanking = [...executoresFiltrados].sort((a, b) => {
    const notaA = a.nota_geral ?? -1
    const notaB = b.nota_geral ?? -1
    if (notaB !== notaA) return notaB - notaA
    return (b.total_avaliacoes || 0) - (a.total_avaliacoes || 0)
  })

  // Mapa de disponibilidade: quem está livre agora (capacidadeLivre > 0 e não suspenso)
  const executoresDisponiveis = executoresFiltrados.filter(
    (ex) => ex.capacidadeLivre > 0 && ex.status !== 'suspenso',
  )

  // Agrupamento de disponíveis por disciplina primária para facilitar convite à cotação
  const mapaPorDisciplina = listaDisciplinas.reduce(
    (acc, disc) => {
      const disponiveisNaDisc = executoresDisponiveis.filter((ex) =>
        ex.disciplinas?.toLowerCase().includes(disc.toLowerCase()),
      )
      if (disponiveisNaDisc.length > 0) {
        acc[disc] = disponiveisNaDisc
      }
      return acc
    },
    {} as Record<string, ExecutorComMetricas[]>,
  )

  // Contadores
  const countAtivos = executores.filter((e) => e.status === 'ativo').length
  const countSuspensos = executores.filter((e) => e.status === 'suspenso').length
  const countLivres = executores.filter(
    (e) => e.capacidadeLivre > 0 && e.status !== 'suspenso',
  ).length
  const countBaixaNota = executores.filter((e) => e.isAbaixoNotaCorte).length

  // Contagem de avaliações de execução (coleção nova) por executor
  const countAvaliacoesExecucao = (executorId: string): number =>
    avaliacoesExecucao.filter((a) => a.executor === executorId).length

  // Badge de atenção: indica desvios consistentes de comportamento para o gestor.
  // INDICATIVO APENAS — a suspensão continua sendo decisão manual do Admin.
  const isExecutorEmAtencao = (ex: ExecutorComMetricas): boolean => {
    const total = ex.total_avaliacoes || 0
    return !!(ex.nota_geral && total >= 2 && ex.nota_geral < 3.0)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Executores e Parceiros Técnicos
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              Etapa 8
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro de profissionais e empresas terceirizadas com controle de capacidade, anotações
            de classe e avaliações de desempenho.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (executoresFiltrados.length === 0) {
                toast({
                  title: 'Sem executores para exportar',
                  description: 'A lista atual não possui executores com os filtros aplicados.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `executores_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'executores',
                  descricao: 'Exportação de parceiros executores técnicos, notas e conselhos',
                  filtros: {
                    status: filtroStatus,
                    alerta: filtroAlerta,
                    busca: busca || undefined,
                  },
                  columns: [
                    { header: 'Nome', accessor: (ex) => ex.nome },
                    { header: 'Tipo', accessor: (ex) => ex.tipo },
                    { header: 'CPF / CNPJ', accessor: (ex) => ex.cpf_cnpj || '' },
                    { header: 'Conselho', accessor: (ex) => ex.conselho || '' },
                    { header: 'Nº Registro', accessor: (ex) => ex.numero_registro || '' },
                    {
                      header: 'Validade Conselho',
                      accessor: (ex) =>
                        ex.conselho_validade ? formatDateBr(ex.conselho_validade) : '',
                    },
                    { header: 'Disciplinas', accessor: (ex) => ex.disciplinas || '' },
                    {
                      header: 'Nota Geral',
                      accessor: (ex) => (ex.nota_geral ? ex.nota_geral.toFixed(2) : 'S/ Nota'),
                    },
                    { header: 'Total Avaliações', accessor: (ex) => ex.total_avaliacoes || 0 },
                    {
                      header: 'Capacidade Simultânea',
                      accessor: (ex) => ex.capacidade_simultanea || 1,
                    },
                    { header: 'Etapas Ativas', accessor: (ex) => ex.etapasAtivasCount },
                    { header: 'Status', accessor: (ex) => ex.status },
                    {
                      header: 'Motivo Suspensão',
                      accessor: (ex) => ex.motivo_suspensao || '',
                    },
                    { header: 'E-mail', accessor: (ex) => ex.email || '' },
                    { header: 'Telefone', accessor: (ex) => ex.telefone || '' },
                  ],
                  data: executoresFiltrados,
                })
                toast({
                  title: 'Executores Exportados',
                  description: `${executoresFiltrados.length} executor(es) exportado(s) com sucesso. Auditoria registrada.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar executores',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300 shadow-xs"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {canConvidar && (
            <Button
              variant="outline"
              onClick={() => setModalConvidarOpen(true)}
              className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs shadow-xs"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Convidar Executor
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={() => {
                setExecutorEditar(null)
                setModalCriarEditarOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-xs shadow-xs text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Executor
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Executores Ativos
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{countAtivos}</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Suspensos (Bloqueados)
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-rose-600">{countSuspensos}</span>
            <Ban className="w-5 h-5 text-rose-500" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Livres para Alocação
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-blue-600">{countLivres}</span>
            <Sparkles className="w-5 h-5 text-blue-500" />
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Abaixo do Corte (&lt; {notaCorte.toFixed(1)})
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-orange-600">{countBaixaNota}</span>
            <Star className="w-5 h-5 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros Completos: Busca, Disciplina, Região, Status e Ocupação */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, conselho, disciplina ou região..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full md:w-auto">
            {/* Filtro Status */}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Disciplina */}
            <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Disciplinas</SelectItem>
                {listaDisciplinas.map((disc) => (
                  <SelectItem key={disc} value={disc}>
                    {disc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Região */}
            <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Regiões</SelectItem>
                {listaRegioes.map((reg) => (
                  <SelectItem key={reg} value={reg}>
                    {reg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Ocupação */}
            <Select value={filtroOcupacao} onValueChange={setFiltroOcupacao}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Ocupação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda Ocupação</SelectItem>
                <SelectItem value="livre">🟢 Livre (Ocioso &gt; 0)</SelectItem>
                <SelectItem value="parcial">🟡 Em atendimento</SelectItem>
                <SelectItem value="esgotada">🔴 Cap. Esgotada (100%)</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Alerta */}
            <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Alertas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Alertas</SelectItem>
                <SelectItem value="vencido">⚠️ Conselho Vencido</SelectItem>
                <SelectItem value="vencendo">⏳ Vencendo em 30d</SelectItem>
                <SelectItem value="baixa_nota">⭐ Abaixo do Corte</SelectItem>
                <SelectItem value="capacidade_cheia">🚫 Capacidade Cheia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Navegação entre Visualizações: Cards de Desempenho, Ranking e Mapa de Disponibilidade */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="cards" className="text-xs flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Cards de Desempenho ({executoresFiltrados.length})
          </TabsTrigger>

          <TabsTrigger value="ranking" className="text-xs flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            Ranking por Nota Geral
          </TabsTrigger>

          <TabsTrigger value="disponibilidade" className="text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Mapa de Disponibilidade ({executoresDisponiveis.length} livres)
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA CARDS DE DESEMPENHO */}
        <TabsContent value="cards" className="space-y-4">
          {carregando ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs text-slate-400">Carregando executores e métricas...</p>
            </div>
          ) : executoresFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-md mx-auto space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <HardHat className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {busca || filtroStatus !== 'todos' || filtroDisciplina !== 'todas'
                    ? 'Nenhum executor encontrado com estes filtros'
                    : 'Cadastre seus Executores e Fornecedores Técnicos'}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {busca || filtroStatus !== 'todos' || filtroDisciplina !== 'todas'
                    ? 'Ajuste os filtros de status ou disciplina para visualizar os executores.'
                    : 'Cadastre engenheiros, arquitetos, projetistas e empresas executoras homologadas com controle de capacidade simultânea, notas de avaliação e cotações de etapas.'}
                </p>
              </div>
              {canEdit && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setExecutorEditar(null)
                      setModalCriarEditarOpen(true)
                    }}
                    className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Primeiro Executor
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {executoresFiltrados.map((ex) => {
                const ndaUrl = ex.nda_contrato ? pb.files.getURL(ex, ex.nda_contrato) : null

                return (
                  <div
                    key={ex.id}
                    className={`bg-white border rounded-lg p-5 shadow-xs flex flex-col justify-between transition-all ${
                      ex.status === 'suspenso'
                        ? 'border-rose-300 bg-rose-50/20'
                        : ex.isRegistroVencido
                          ? 'border-amber-300'
                          : ex.isAbaixoNotaCorte
                            ? 'border-orange-300 bg-orange-50/10'
                            : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Topo: Nome, Tipo, Região e Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] uppercase font-bold text-slate-700 bg-slate-100"
                            >
                              {ex.tipo}
                            </Badge>
                            <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                              {ex.nome}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            {ex.cpf_cnpj && <span className="font-mono">{ex.cpf_cnpj}</span>}
                            {ex.regiao && (
                              <span className="flex items-center gap-0.5 text-slate-500">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {ex.regiao}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge
                          className={`text-[10px] uppercase font-bold shrink-0 ${
                            ex.status === 'ativo'
                              ? 'bg-emerald-600 text-white'
                              : ex.status === 'suspenso'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {ex.status}
                        </Badge>
                      </div>

                      {/* Alertas Ativos no Card */}
                      <div className="space-y-1.5 mt-3">
                        {ex.status === 'suspenso' && (
                          <div className="p-2 bg-rose-100/70 border border-rose-200 rounded text-[11px] text-rose-900 flex items-start gap-1.5">
                            <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Suspenso:</strong>{' '}
                              {ex.motivo_suspensao || 'Sem motivo informado'}
                            </span>
                          </div>
                        )}

                        {ex.isRegistroVencido && (
                          <div className="p-2 bg-amber-100/70 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              <strong>Conselho Vencido:</strong> Validade expirou em{' '}
                              {formatDateBr(ex.conselho_validade!)}
                            </span>
                          </div>
                        )}

                        {ex.isAbaixoNotaCorte && (
                          <div className="p-2 bg-orange-100/70 border border-orange-200 rounded text-[11px] text-orange-900 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                            <span>
                              <strong>Desempenho Baixo:</strong> Média{' '}
                              {ex.nota_geral ? ex.nota_geral.toFixed(2) : '—'} abaixo do corte (
                              {notaCorte.toFixed(1)})
                            </span>
                          </div>
                        )}

                        {isExecutorEmAtencao(ex) && (
                          <div
                            className="p-2 bg-rose-100/70 border border-rose-200 rounded text-[11px] text-rose-900 flex items-center gap-1.5"
                            title="Indicativo de desvio consistente de comportamento — a suspensão continua sendo decisão manual do Admin"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              <strong>Executor em atenção:</strong> nota média{' '}
                              {ex.nota_geral?.toFixed(2)} em {ex.total_avaliacoes} avaliação(ões) —
                              abaixo de 3,0. Indicativo apenas: avalie antes de novos contratos
                              (suspensão manual do Admin).
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bloco de Desempenho com Seta de Tendência e Nota Geral */}
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                            Nota Geral & Tendência:
                          </span>

                          {/* Nota + Seta de Tendência */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setExecutorHistorico(ex)
                                setModalHistoricoExecOpen(true)
                              }}
                              className="flex items-center gap-1 text-slate-900 font-black text-sm hover:underline"
                              title="Ver histórico de avaliações"
                            >
                              {ex.nota_geral ? ex.nota_geral.toFixed(2) : 'S/ Nota'}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({ex.total_avaliacoes || 0})
                              </span>
                            </button>

                            {/* Indicador de Tendência */}
                            {ex.tendenciaNota === 'subindo' && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded"
                                title="Tendência: Melhorando em relação às avaliações anteriores"
                              >
                                <TrendingUp className="w-3 h-3 text-emerald-600" /> ↑ subindo
                              </span>
                            )}
                            {ex.tendenciaNota === 'caindo' && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded"
                                title="Tendência: Caindo em relação às avaliações anteriores"
                              >
                                <TrendingDown className="w-3 h-3 text-rose-600" /> ↓ caindo
                              </span>
                            )}
                            {ex.tendenciaNota === 'estavel' && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded"
                                title="Tendência: Desempenho estável"
                              >
                                <Minus className="w-3 h-3 text-slate-500" /> → estável
                              </span>
                            )}
                            {ex.tendenciaNota === 'sem_historico' && (
                              <span className="text-[10px] text-slate-400">sem histórico</span>
                            )}
                          </div>
                        </div>

                        {/* Última Avaliação Registrada */}
                        {ex.ultimaAvaliacao ? (
                          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                            <span>Última avaliação:</span>
                            <span className="font-medium text-slate-700">
                              ⭐ {ex.ultimaAvaliacao.nota.toFixed(2)} em{' '}
                              {formatDateBr(ex.ultimaAvaliacao.data)}
                              {ex.ultimaAvaliacao.projetoCodigo
                                ? ` (${ex.ultimaAvaliacao.projetoCodigo})`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-[11px] text-slate-400 border-t border-slate-200/60 pt-1.5">
                            Ainda não avaliado formalmente em projetos
                          </div>
                        )}
                      </div>

                      {/* Barra de Ocupação Atual & Capacidade */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Ocupação Atual:</span>
                          <span className="font-semibold text-slate-800">
                            {ex.etapasAtivasCount} / {ex.capacidade_simultanea || 1} etapas ativas (
                            {ex.taxaOcupacaoPercent}%)
                          </span>
                        </div>

                        {/* Barra horizontal visual de capacidade */}
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${
                              ex.isCapacidadeEsgotada
                                ? 'bg-rose-600'
                                : ex.taxaOcupacaoPercent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, ex.taxaOcupacaoPercent)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={
                              ex.capacidadeLivre > 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-600 font-semibold'
                            }
                          >
                            {ex.capacidadeLivre > 0
                              ? `✓ ${ex.capacidadeLivre} vaga(s) disponível(is)`
                              : '✕ Capacidade esgotada'}
                          </span>
                          <span className="text-slate-400">
                            Cap. Total: {ex.capacidade_simultanea || 1}
                          </span>
                        </div>
                      </div>

                      {/* Disciplinas e Conselho */}
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Conselho:</span>
                          <strong className="text-slate-800">
                            {ex.conselho || '—'} {ex.numero_registro || ''}
                          </strong>
                        </div>

                        {ex.disciplinas && (
                          <div>
                            <span className="text-slate-400 block mb-1">Disciplinas:</span>
                            <div className="flex flex-wrap gap-1">
                              {ex.disciplinas
                                .split(',')
                                .map((d) => d.trim())
                                .filter(Boolean)
                                .map((disc, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-[10px] bg-slate-50 text-slate-700"
                                  >
                                    {disc}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Últimos Projetos */}
                        {ex.ultimosProjetos && ex.ultimosProjetos.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400 block mb-1 font-medium">
                              Últimos Projetos Vinculados:
                            </span>
                            <div className="space-y-1">
                              {ex.ultimosProjetos.map((prj, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] bg-slate-50 border border-slate-200/80 rounded px-2 py-1 flex items-center justify-between"
                                >
                                  <span className="font-mono text-blue-700 font-bold truncate max-w-[120px]">
                                    {prj.codigo || prj.nome}
                                  </span>
                                  <span className="text-slate-500 truncate max-w-[150px] text-[10px]">
                                    {prj.etapaNome}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé e Ações */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        {countAvaliacoesExecucao(ex.id) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setExecutorHistorico(ex)
                              setModalHistoricoExecOpen(true)
                            }}
                            className="text-[11px] text-[#D95A2B] hover:text-[#C44E22] flex items-center gap-1 font-medium"
                            title="Ver histórico de avaliações de execução (por subcontrato)"
                          >
                            <Award className="w-3.5 h-3.5" />
                            Avaliações de Execução ({countAvaliacoesExecucao(ex.id)})
                          </button>
                        )}
                        {ndaUrl && (
                          <a
                            href={ndaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            NDA
                          </a>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          {ex.status === 'homologacao' && canHomologar && (
                            <Button
                              size="sm"
                              disabled={homologandoId === ex.id}
                              onClick={() => handleHomologar(ex)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 shadow-2xs"
                            >
                              {homologandoId === ex.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Homologando
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" /> Homologar
                                </>
                              )}
                            </Button>
                          )}

                          {ex.status !== 'suspenso' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setExecutorSuspender(ex)
                                setModalSuspenderOpen(true)
                              }}
                              className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 px-2"
                            >
                              Suspender
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAtivar(ex)}
                              className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 px-2"
                            >
                              Reativar
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setExecutorEditar(ex)
                              setModalCriarEditarOpen(true)
                            }}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                            title="Editar cadastro"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {user?.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExcluir(ex.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                              title="Excluir executor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. ABA RANKING DE EXECUTORES POR NOTA GERAL */}
        <TabsContent value="ranking" className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Ranking Geral de Desempenho Técnico
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordenado por média geral calculada das avaliações formais. Destaca executores
                  abaixo da nota de corte configurada ({notaCorte.toFixed(1)}).
                </p>
              </div>
              <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
                Corte Atual: {notaCorte.toFixed(1)}
              </Badge>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-4">Executor / Fornecedor</th>
                    <th className="py-3 px-4">Disciplinas</th>
                    <th className="py-3 px-3 text-center">Tendência</th>
                    <th className="py-3 px-3 text-center">Ocupação</th>
                    <th className="py-3 px-4 text-center">Avaliações</th>
                    <th className="py-3 px-4 text-right">Nota Geral</th>
                    <th className="py-3 px-4 text-center">Status Desempenho</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {executoresRanking.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Nenhum executor encontrado no ranking.
                      </td>
                    </tr>
                  ) : (
                    executoresRanking.map((ex, idx) => {
                      const posicao = idx + 1
                      const isTop3 = posicao <= 3 && (ex.nota_geral || 0) > 0

                      return (
                        <tr
                          key={ex.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            ex.isAbaixoNotaCorte ? 'bg-orange-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-bold">
                            {posicao === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                                🥇
                              </span>
                            ) : posicao === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black">
                                🥈
                              </span>
                            ) : posicao === 3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 text-xs font-black">
                                🥉
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">{posicao}º</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{ex.nome}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {ex.tipo} • {ex.conselho || 'S/ Conselho'} {ex.numero_registro || ''}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-slate-700 truncate max-w-[200px] block">
                              {ex.disciplinas || '—'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {ex.tendenciaNota === 'subindo' && (
                              <span
                                className="inline-flex items-center text-emerald-600 font-bold text-xs"
                                title="Melhorando"
                              >
                                <TrendingUp className="w-4 h-4 mr-0.5" /> ↑
                              </span>
                            )}
                            {ex.tendenciaNota === 'caindo' && (
                              <span
                                className="inline-flex items-center text-rose-600 font-bold text-xs"
                                title="Caindo"
                              >
                                <TrendingDown className="w-4 h-4 mr-0.5" /> ↓
                              </span>
                            )}
                            {ex.tendenciaNota === 'estavel' && (
                              <span
                                className="inline-flex items-center text-slate-500 text-xs"
                                title="Estável"
                              >
                                <Minus className="w-4 h-4 mr-0.5" /> →
                              </span>
                            )}
                            {ex.tendenciaNota === 'sem_historico' && (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-mono">
                            <span
                              className={
                                ex.isCapacidadeEsgotada
                                  ? 'text-rose-600 font-bold'
                                  : ex.capacidadeLivre > 0
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-slate-700'
                              }
                            >
                              {ex.etapasAtivasCount}/{ex.capacidade_simultanea || 1}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono text-slate-600">
                            {ex.total_avaliacoes || 0}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setExecutorHistorico(ex)
                                setModalHistoricoExecOpen(true)
                              }}
                              className="inline-flex items-center gap-1 font-black text-sm hover:underline text-slate-900"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {ex.nota_geral ? ex.nota_geral.toFixed(2) : '—'}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {ex.isAbaixoNotaCorte ? (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
                                Abaixo do corte
                              </Badge>
                            ) : (ex.nota_geral || 0) >= 4.5 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                Excelente
                              </Badge>
                            ) : (ex.nota_geral || 0) >= 3.5 ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                                Adequado
                              </Badge>
                            ) : (ex.nota_geral || 0) > 0 ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                Regular
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                Sem Avaliação
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setExecutorHistorico(ex)
                                setModalHistoricoExecOpen(true)
                              }}
                              className="h-7 text-xs text-blue-600 hover:text-blue-800"
                            >
                              Histórico
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. ABA MAPA DE DISPONIBILIDADE (QUEM ESTÁ LIVRE PARA ALOCAÇÃO AGORA) */}
        <TabsContent value="disponibilidade" className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Mapa de Disponibilidade para Cotação & Alocação
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Profissionais ativos com <strong>capacidade ociosa (&gt; 0)</strong> no momento,
                  agrupados por especialidade técnica para subsidiar convites imediatos a cotações.
                </p>
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                {executoresDisponiveis.length} executores com vagas
              </Badge>
            </div>

            {executoresDisponiveis.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhum executor com capacidade ociosa no momento com os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {/* Visão Rápida em Cards por Disciplina */}
                {Object.keys(mapaPorDisciplina).length > 0 ? (
                  Object.entries(mapaPorDisciplina).map(([disciplina, lista]) => (
                    <div
                      key={disciplina}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          {disciplina}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white font-semibold">
                          {lista.length} parceiro(s) disponível(is)
                        </Badge>
                      </div>

                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {lista.map((ex) => (
                          <div
                            key={ex.id}
                            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-all shadow-2xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                                  {ex.nome}
                                </h4>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {ex.tipo} • {ex.regiao || 'Brasil'}
                                </span>
                              </div>
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                {ex.capacidadeLivre} vaga(s)
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                              <span className="text-slate-400 text-[11px]">Nota:</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {ex.nota_geral ? ex.nota_geral.toFixed(2) : 'S/ Nota'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 text-[11px]">Ocupação:</span>
                              <span className="text-slate-700 font-mono text-[11px]">
                                {ex.etapasAtivasCount} de {ex.capacidade_simultanea || 1} ativas
                              </span>
                            </div>

                            {ex.telefone && (
                              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                                <span>Contato:</span>
                                <span className="font-mono text-blue-600">{ex.telefone}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {executoresDisponiveis.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h4 className="font-bold text-xs text-slate-900">{ex.nome}</h4>
                            <span className="text-[10px] text-slate-400">
                              {ex.disciplinas || 'Disciplinas gerais'}
                            </span>
                          </div>
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            {ex.capacidadeLivre} livre(s)
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <ModalCriarEditarExecutor
        open={modalCriarEditarOpen}
        onOpenChange={setModalCriarEditarOpen}
        executorParaEditar={executorEditar}
        onSuccess={carregarDados}
      />

      <ModalSuspenderExecutor
        open={modalSuspenderOpen}
        onOpenChange={setModalSuspenderOpen}
        executor={executorSuspender}
        onSuccess={carregarDados}
      />

      <ModalHistoricoAvaliacoes
        open={modalHistoricoOpen}
        onOpenChange={setModalHistoricoOpen}
        executor={executorHistorico}
      />

      <ModalConvidarExecutor
        open={modalConvidarOpen}
        onOpenChange={setModalConvidarOpen}
        onSuccess={carregarDados}
      />

      <ModalHistoricoAvaliacoesExecutor
        open={modalHistoricoExecOpen}
        onOpenChange={setModalHistoricoExecOpen}
        executor={executorHistorico}
      />
    </div>
  )
}
