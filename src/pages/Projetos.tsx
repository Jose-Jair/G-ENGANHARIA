import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  ProjetoRecord,
  ProjetoEtapaRecord,
  SaudeProjeto,
  ExecutorRecord,
  EmpresaRecord,
} from '@/types'
import { projetosService, ProjetoFiltrosServidor } from '@/services/projetos'
import { executoresService } from '@/services/executores'
import { empresasService } from '@/services/empresas'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Briefcase,
  Search,
  Eye,
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  DollarSign,
  Loader2,
  Download,
  Clock,
  User,
  Activity,
  FileSignature,
  FolderKanban,
  RefreshCw,
  X,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { exportService } from '@/services/exportService'
import { formatCnpj, formatCpf } from '@/lib/cnpj'

import { ModalDetalheProjeto } from '@/components/projetos/ModalDetalheProjeto'
import { ModalCriarProjeto } from '@/components/projetos/ModalCriarProjeto'
import { ModalSaudeProjeto } from '@/components/projetos/ModalSaudeProjeto'
import { ModalDossieProjeto } from '@/components/projetos/ModalDossieProjeto'
import { CardAlertaStandbyProjeto } from '@/components/projetos/CardAlertaStandbyProjeto'
import { ModalDefinirModoExecucao } from '@/components/projetos/ModalDefinirModoExecucao'

import { useSearchParams } from 'react-router-dom'

interface ProjetoComEtapasCalculadas extends ProjetoRecord {
  etapas: ProjetoEtapaRecord[]
  etapasConcluidasCount: number
  totalEtapasCount: number
  percentualConcluido: number
  diasAtrasoMax: number
  disciplinasList: string[]
  executoresIds: string[]
}

export const ProjetosPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [todasEtapas, setTodasEtapas] = useState<ProjetoEtapaRecord[]>([])
  const [executores, setExecutores] = useState<ExecutorRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Paginação no servidor (20 projetos por página com carregamento incremental)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalItens, setTotalItens] = useState(0)
  const [carregandoMais, setCarregandoMais] = useState(false)

  // Filtros no servidor
  const [buscaInput, setBuscaInput] = useState(() => searchParams.get('busca') || '')
  const [busca, setBusca] = useState(() => searchParams.get('busca') || '')
  const [filtroSaude, setFiltroSaude] = useState<string>(() => searchParams.get('saude') || 'todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('todas')
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>(
    () => searchParams.get('status') || 'todos',
  )

  // Ordenação no servidor
  // Opções: prazo_asc, prazo_desc, valor_desc, valor_asc, criacao_desc, criacao_asc
  const [ordenacao, setOrdenacao] = useState<string>('criacao_desc')

  // Modais
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null)

  const [modalSaudeRapidaOpen, setModalSaudeRapidaOpen] = useState(false)
  const [projetoSaudeRapida, setProjetoSaudeRapida] = useState<ProjetoRecord | null>(null)

  const [modalDossieCardOpen, setModalDossieCardOpen] = useState(false)
  const [projetoDossieCardId, setProjetoDossieCardId] = useState<string | null>(null)

  const [modalDefinirModoOpen, setModalDefinirModoOpen] = useState(false)
  const [projetoDefinirModo, setProjetoDefinirModo] = useState<ProjetoRecord | null>(null)

  const canCreate = !!(user && (user.role === 'admin' || user.role === 'gestor'))
  const canViewDossie = !!(
    user && ['admin', 'gestor', 'financeiro', 'comercial'].includes(user.role)
  )

  // Debounce na busca textual (350ms) para não sobrecarregar o servidor
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusca(buscaInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [buscaInput])

  // Mapear opção de ordenação da UI para a string do PocketBase
  const sortPocketBase = useMemo(() => {
    switch (ordenacao) {
      case 'prazo_asc':
        return 'prazo_final,created'
      case 'prazo_desc':
        return '-prazo_final,-created'
      case 'valor_desc':
        return '-valor_total,-created'
      case 'valor_asc':
        return 'valor_total,created'
      case 'criacao_asc':
        return 'created'
      case 'criacao_desc':
      default:
        return '-created'
    }
  }, [ordenacao])

  // Montar objeto de filtros para o serviço
  const filtrosAtuaisServidor = useMemo<ProjetoFiltrosServidor>(() => {
    return {
      busca: busca.trim() || undefined,
      status: filtroStatus,
      saude: filtroSaude,
      empresaId: filtroEmpresa,
      disciplina: filtroDisciplina,
      dataInicial: filtroDataInicio || undefined,
      dataFinal: filtroDataFim || undefined,
    }
  }, [
    busca,
    filtroStatus,
    filtroSaude,
    filtroEmpresa,
    filtroDisciplina,
    filtroDataInicio,
    filtroDataFim,
  ])

  // Contagem de filtros ativos
  const totalFiltrosAtivos = useMemo(() => {
    let count = 0
    if (busca.trim()) count++
    if (filtroStatus !== 'todos') count++
    if (filtroSaude !== 'todos') count++
    if (filtroEmpresa !== 'todas') count++
    if (filtroDisciplina !== 'todas') count++
    if (filtroDataInicio) count++
    if (filtroDataFim) count++
    return count
  }, [
    busca,
    filtroStatus,
    filtroSaude,
    filtroEmpresa,
    filtroDisciplina,
    filtroDataInicio,
    filtroDataFim,
  ])

  const limparTodosFiltros = () => {
    setBuscaInput('')
    setBusca('')
    setFiltroStatus('todos')
    setFiltroSaude('todos')
    setFiltroEmpresa('todas')
    setFiltroDisciplina('todas')
    setFiltroDataInicio('')
    setFiltroDataFim('')
  }

  // Carrega opções auxiliares (executores e empresas parceiras) apenas uma vez
  useEffect(() => {
    let cancel = false
    const carregarAuxiliares = async () => {
      try {
        const [listaExec, listaEmpresas, listaEtapas] = await Promise.all([
          executoresService.list().catch(() => []),
          empresasService.list({ incluirPreCadastros: false }).catch(() => []),
          projetosService.listTodasEtapas
            ? projetosService.listTodasEtapas().catch(() => [])
            : Promise.resolve([]),
        ])
        if (!cancel) {
          setExecutores(listaExec)
          setEmpresas(listaEmpresas)
          setTodasEtapas(listaEtapas)
        }
      } catch {
        // silencioso
      }
    }
    carregarAuxiliares()
    return () => {
      cancel = true
    }
  }, [])

  // Função central de carregamento de projetos paginados no servidor
  const carregarProjetos = async (pagina = 1, append = false) => {
    if (append) {
      setCarregandoMais(true)
    } else {
      setCarregando(true)
    }
    try {
      const pagedResult = await projetosService.getList({
        page: pagina,
        perPage: 20,
        sort: sortPocketBase,
        filtros: filtrosAtuaisServidor,
      })

      setProjetos((prev) => (append ? [...prev, ...pagedResult.items] : pagedResult.items))
      setPaginaAtual(pagedResult.page)
      setTotalPaginas(pagedResult.totalPages)
      setTotalItens(pagedResult.totalItems)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar projetos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
      setCarregandoMais(false)
    }
  }

  // Recarregar da página 1 sempre que filtros ou ordenação mudarem
  useEffect(() => {
    carregarProjetos(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAtuaisServidor, sortPocketBase])

  const handleCarregarMais = () => {
    if (paginaAtual < totalPaginas && !carregandoMais) {
      carregarProjetos(paginaAtual + 1, true)
    }
  }

  // Mapa de etapas por projeto e cálculo de métricas de portfólio
  const projetosComMetricas = useMemo<ProjetoComEtapasCalculadas[]>(() => {
    const mapaEtapas = new Map<string, ProjetoEtapaRecord[]>()
    todasEtapas.forEach((et) => {
      const arr = mapaEtapas.get(et.projeto) || []
      arr.push(et)
      mapaEtapas.set(et.projeto, arr)
    })

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    return projetos.map((prj) => {
      const etapas = mapaEtapas.get(prj.id) || []
      const totalEtapasCount = etapas.length
      const etapasConcluidasCount = etapas.filter((e) => e.status === 'concluida').length
      const percentualConcluido =
        totalEtapasCount > 0 ? Math.round((etapasConcluidasCount / totalEtapasCount) * 100) : 0

      let diasAtrasoMax = 0
      const executoresSet = new Set<string>()

      etapas.forEach((e) => {
        if (e.executor) executoresSet.add(e.executor)
        if (e.status !== 'concluida' && e.status !== 'cancelada') {
          const fim = e.prazo_fim || (e as any).data_fim
          if (fim) {
            const dFim = new Date(fim)
            dFim.setHours(0, 0, 0, 0)
            const diff = Math.ceil((hoje.getTime() - dFim.getTime()) / (1000 * 3600 * 24))
            if (diff > diasAtrasoMax) diasAtrasoMax = diff
          }
        }
      })

      const discString = prj.disciplinas || ''
      const disciplinasList = discString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      return {
        ...prj,
        etapas,
        etapasConcluidasCount,
        totalEtapasCount,
        percentualConcluido,
        diasAtrasoMax,
        disciplinasList,
        executoresIds: Array.from(executoresSet),
      }
    })
  }, [projetos, todasEtapas])

  // Lista a exibir: projetos já chegam filtrados e ordenados pelo servidor
  const projetosExibidos = projetosComMetricas

  // Projetos em Standby (aguardando_definicao) carregados na página atual
  const projetosEmStandby = useMemo(() => {
    return projetos.filter((p) => p.status === 'aguardando_definicao')
  }, [projetos])

  // Contadores e métricas dos registros carregados
  const metricasPortfolio = useMemo(() => {
    const calcMedia = (lista: ProjetoComEtapasCalculadas[]) => {
      if (lista.length === 0) return { percConcluido: 0, diasAtraso: 0, total: 0 }
      const totalPerc = lista.reduce((acc, p) => acc + p.percentualConcluido, 0)
      const maxAtraso = Math.max(0, ...lista.map((p) => p.diasAtrasoMax))
      return {
        total: lista.length,
        percConcluido: Math.round(totalPerc / lista.length),
        diasAtraso: maxAtraso,
      }
    }

    const verdes = projetosComMetricas.filter((p) => p.saude === 'verde')
    const amarelos = projetosComMetricas.filter((p) => p.saude === 'amarelo')
    const vermelhos = projetosComMetricas.filter((p) => p.saude === 'vermelho')

    return {
      verde: calcMedia(verdes),
      amarelo: calcMedia(amarelos),
      vermelho: calcMedia(vermelhos),
    }
  }, [projetosComMetricas])

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Projetos de Engenharia
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              Etapa 8
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão operacional das demandas geradas a partir de propostas aceitas (PRJ-AAAA-NNNN) ou
            cadastro direto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (projetosExibidos.length === 0) {
                toast({
                  title: 'Sem projetos para exportar',
                  description: 'A lista atual não possui projetos com os filtros aplicados.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `projetos_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'projetos',
                  descricao: 'Exportação de projetos de engenharia, saúde e valores',
                  filtros: {
                    saude: filtroSaude,
                    status: filtroStatus,
                    empresaId: filtroEmpresa !== 'todas' ? filtroEmpresa : undefined,
                    disciplina: filtroDisciplina !== 'todas' ? filtroDisciplina : undefined,
                    busca: busca || undefined,
                  },
                  columns: [
                    { header: 'Código', accessor: (p) => p.codigo },
                    { header: 'Nome do Projeto', accessor: (p) => p.nome || `Projeto ${p.codigo}` },
                    {
                      header: 'Cliente',
                      accessor: (p) => {
                        const pj = p.expand?.empresa || p.expand?.proposta?.expand?.empresa
                        const pf = p.expand?.cliente_pf || p.expand?.proposta?.expand?.cliente_pf
                        return pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Não vinculado'
                      },
                    },
                    {
                      header: 'Documento Cliente',
                      accessor: (p) => {
                        const pj = p.expand?.empresa || p.expand?.proposta?.expand?.empresa
                        const pf = p.expand?.cliente_pf || p.expand?.proposta?.expand?.cliente_pf
                        return pj?.cnpj ? formatCnpj(pj.cnpj) : pf?.cpf ? formatCpf(pf.cpf) : ''
                      },
                    },
                    { header: 'Status', accessor: (p) => p.status || 'em_andamento' },
                    { header: 'Saúde', accessor: (p) => p.saude || 'verde' },
                    { header: 'Justificativa Saúde', accessor: (p) => p.justificativa_saude || '' },
                    {
                      header: 'Valor Total (R$)',
                      accessor: (p) => formatCurrencyBr(p.valor_total || 0),
                    },
                    {
                      header: 'Prazo Final',
                      accessor: (p) => (p.prazo_final ? formatDateBr(p.prazo_final) : ''),
                    },
                    {
                      header: 'Proposta Origem',
                      accessor: (p) => p.expand?.proposta?.numero || '',
                    },
                    {
                      header: 'Disciplinas',
                      accessor: (p) => p.disciplinas || '',
                    },
                  ],
                  data: projetosExibidos,
                })
                toast({
                  title: 'Projetos Exportados',
                  description: `${projetosExibidos.length} projeto(s) exportado(s) com sucesso. Auditoria registrada.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar projetos',
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

          {canCreate && (
            <Button
              onClick={() => setModalCriarOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Projeto Direto
            </Button>
          )}
        </div>
      </div>

      {/* Visão de Portfólio: Cards no Topo por Saúde com % Concluído e Dias de Atraso */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total na Base
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{totalItens}</span>
            <Briefcase className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {projetos.length < totalItens
              ? `Carregados: ${projetos.length} de ${totalItens}`
              : `Todos os ${totalItens} registros exibidos`}
          </div>
        </div>

        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />🟢 Verde (
              {metricasPortfolio.verde.total})
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-white text-emerald-700 border-emerald-300"
            >
              No prazo
            </Badge>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-950">
              {metricasPortfolio.verde.percConcluido}%
            </span>
            <span className="text-xs text-emerald-700 font-medium">etapas concluídas</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> 0 dias de atraso crítico
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />🟡 Amarelo (
              {metricasPortfolio.amarelo.total})
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-white text-amber-700 border-amber-300"
            >
              Atenção
            </Badge>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-950">
              {metricasPortfolio.amarelo.percConcluido}%
            </span>
            <span className="text-xs text-amber-700 font-medium">etapas concluídas</span>
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {metricasPortfolio.amarelo.diasAtraso > 0
              ? `Máx atraso: ${metricasPortfolio.amarelo.diasAtraso}d`
              : 'Sem atraso registrado'}
          </div>
        </div>

        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-lg shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />🔴 Vermelho (
              {metricasPortfolio.vermelho.total})
            </span>
            <Badge variant="destructive" className="text-[10px]">
              Crítico
            </Badge>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-950">
              {metricasPortfolio.vermelho.percConcluido}%
            </span>
            <span className="text-xs text-rose-700 font-medium">etapas concluídas</span>
          </div>
          <div className="text-[11px] text-rose-700 mt-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            {metricasPortfolio.vermelho.diasAtraso > 0
              ? `Atraso de até ${metricasPortfolio.vermelho.diasAtraso} dias`
              : 'Risco/bloqueio crítico'}
          </div>
        </div>
      </div>

      {/* Banner de Projetos em Standby (Grupo D) */}
      {projetosEmStandby.length > 0 && (
        <div className="space-y-3">
          {projetosEmStandby.map((prj) => (
            <CardAlertaStandbyProjeto
              key={`standby-banner-${prj.id}`}
              projeto={prj}
              userRole={user?.role}
              onDefinirModo={() => {
                setProjetoDefinirModo(prj)
                setModalDefinirModoOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Barra de Filtros no Servidor e Ordenação */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
        {/* Linha 1: Busca Livre + Ordenação */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Buscar por código (PRJ-...), título/nome do projeto ou cliente na base inteira..."
              className="pl-9 pr-8 text-xs"
            />
            {buscaInput && (
              <button
                type="button"
                onClick={() => {
                  setBuscaInput('')
                  setBusca('')
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ordenação no Servidor */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              Ordenar por:
            </span>
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="text-xs h-9 w-full md:w-[220px]">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="criacao_desc">Mais Recentes (Criação ↓)</SelectItem>
                <SelectItem value="criacao_asc">Mais Antigos (Criação ↑)</SelectItem>
                <SelectItem value="prazo_asc">Prazo Mais Próximo (Prazo ↑)</SelectItem>
                <SelectItem value="prazo_desc">Prazo Mais Distante (Prazo ↓)</SelectItem>
                <SelectItem value="valor_desc">Maior Valor (R$ ↓)</SelectItem>
                <SelectItem value="valor_asc">Menor Valor (R$ ↑)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 2: Filtros Estruturados (Status, Saúde, Empresa, Disciplina e Período) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Filtro Status */}
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="aguardando_definicao">⏳ Em Standby</SelectItem>
              <SelectItem value="contratacao">📝 Em Contratação</SelectItem>
              <SelectItem value="em_andamento">🚀 Em Andamento</SelectItem>
              <SelectItem value="concluido">✅ Concluído</SelectItem>
              <SelectItem value="pausado">⏸️ Pausado</SelectItem>
              <SelectItem value="cancelado">❌ Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Saúde */}
          <Select value={filtroSaude} onValueChange={setFiltroSaude}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Saúde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Saúdes</SelectItem>
              <SelectItem value="verde">🟢 Verde (No prazo)</SelectItem>
              <SelectItem value="amarelo">🟡 Amarelo (Atenção)</SelectItem>
              <SelectItem value="vermelho">🔴 Vermelho (Crítico)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Empresa / Parceiro Demandante */}
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Empresa/Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos Parceiros</SelectItem>
              {empresas.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Disciplina */}
          <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Disciplinas</SelectItem>
              <SelectItem value="Estrutura">Estrutura</SelectItem>
              <SelectItem value="Instalações">Instalações</SelectItem>
              <SelectItem value="Arquitetura">Arquitetura</SelectItem>
              <SelectItem value="Elétrica">Elétrica</SelectItem>
              <SelectItem value="Hidrossanitário">Hidrossanitário</SelectItem>
              <SelectItem value="Climatização">Climatização</SelectItem>
              <SelectItem value="Prevenção contra Incêndio">PPCI</SelectItem>
              <SelectItem value="BIM">BIM / Gestão</SelectItem>
              <SelectItem value="Geral">Geral</SelectItem>
            </SelectContent>
          </Select>

          {/* Período de Prazo: Data Inicial */}
          <div className="relative">
            <Input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="text-xs h-9 px-2 text-slate-700"
              title="Prazo final a partir de..."
            />
            <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-slate-400 font-medium">
              Prazo de
            </span>
          </div>

          {/* Período de Prazo: Data Final */}
          <div className="relative">
            <Input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="text-xs h-9 px-2 text-slate-700"
              title="Prazo final até..."
            />
            <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-slate-400 font-medium">
              Prazo até
            </span>
          </div>
        </div>

        {/* Linha 3: Barra de Chips de Filtros Ativos e Botão de Limpar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={totalFiltrosAtivos > 0 ? 'default' : 'secondary'}
              className={`text-xs h-6 px-2.5 font-medium flex items-center gap-1.5 ${
                totalFiltrosAtivos > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              Filtros ativos ({totalFiltrosAtivos})
            </Badge>

            {busca.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                Texto: "{busca}"
                <button
                  type="button"
                  onClick={() => {
                    setBuscaInput('')
                    setBusca('')
                  }}
                  className="hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroStatus !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                Status: {filtroStatus}
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroSaude !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                Saúde: {filtroSaude}
                <button
                  type="button"
                  onClick={() => setFiltroSaude('todos')}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroEmpresa !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                Empresa:{' '}
                {empresas.find((e) => e.id === filtroEmpresa)?.nome_fantasia || 'Selecionada'}
                <button
                  type="button"
                  onClick={() => setFiltroEmpresa('todas')}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroDisciplina !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                Disciplina: {filtroDisciplina}
                <button
                  type="button"
                  onClick={() => setFiltroDisciplina('todas')}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(filtroDataInicio || filtroDataFim) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                Prazo: {filtroDataInicio ? formatDateBr(filtroDataInicio) : '...'} até{' '}
                {filtroDataFim ? formatDateBr(filtroDataFim) : '...'}
                <button
                  type="button"
                  onClick={() => {
                    setFiltroDataInicio('')
                    setFiltroDataFim('')
                  }}
                  className="hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {totalFiltrosAtivos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limparTodosFiltros}
              className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar todos os filtros
            </Button>
          )}
        </div>
      </div>

      {/* Grid de Projetos */}
      {carregando ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs text-slate-400">Consultando projetos no servidor...</p>
        </div>
      ) : projetosExibidos.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-md mx-auto space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">
              {totalFiltrosAtivos > 0
                ? 'Nenhum projeto encontrado para estes filtros'
                : 'Inicie seu primeiro Projeto de Engenharia'}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {totalFiltrosAtivos > 0
                ? 'Ajuste ou limpe os filtros para pesquisar na base inteira do servidor.'
                : 'Projetos são gerados automaticamente após o aceite formal de uma proposta ou criados diretamente aqui, com gestão de etapas por disciplina, cotações, documentos e riscos.'}
            </p>
          </div>
          {totalFiltrosAtivos > 0 ? (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={limparTodosFiltros}
                className="text-xs text-slate-700"
              >
                Limpar todos os filtros
              </Button>
            </div>
          ) : (
            canCreate && (
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => setModalCriarOpen(true)}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Criar Projeto Direto
                </Button>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosExibidos.map((prj) => {
            const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
            const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
            const nomeCliente =
              pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado'

            return (
              <div
                key={prj.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {prj.codigo}
                      </span>
                      {prj.status === 'aguardando_definicao' && (
                        <Badge className="ml-1.5 bg-[#D95A2B] text-white text-[9px] font-bold">
                          STANDBY
                        </Badge>
                      )}{' '}
                      {prj.expand?.proposta && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Origem: {prj.expand.proposta.numero}
                        </p>
                      )}
                      {prj.grupo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/projetos/grupo/${prj.grupo}`)
                          }}
                          className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold text-[#D95A2B] hover:underline"
                          title="Abrir Grupo de Projetos consolidado"
                        >
                          <FolderKanban className="w-3 h-3 text-[#D95A2B]" />
                          {prj.expand?.grupo?.codigo || 'Ver Grupo'}
                        </button>
                      )}
                    </div>

                    {/* Badge de Saúde com Ação */}
                    <button
                      type="button"
                      onClick={() => {
                        setProjetoSaudeRapida(prj)
                        setModalSaudeRapidaOpen(true)
                      }}
                      title="Alterar saúde do projeto (Gestor)"
                      className="cursor-pointer"
                    >
                      {prj.saude === 'verde' && (
                        <Badge className="bg-emerald-600 text-white text-[10px] hover:bg-emerald-700">
                          🟢 Verde
                        </Badge>
                      )}
                      {prj.saude === 'amarelo' && (
                        <Badge className="bg-amber-500 text-slate-950 text-[10px] hover:bg-amber-600">
                          🟡 Amarelo
                        </Badge>
                      )}
                      {prj.saude === 'vermelho' && (
                        <Badge className="bg-rose-600 text-white text-[10px] hover:bg-rose-700">
                          🔴 Vermelho
                        </Badge>
                      )}
                      {!prj.saude && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          S/ Saúde
                        </Badge>
                      )}
                    </button>
                  </div>

                  {prj.status === 'aguardando_definicao' && (
                    <div className="mt-2.5">
                      <CardAlertaStandbyProjeto
                        projeto={prj}
                        userRole={user?.role}
                        compacto
                        onDefinirModo={() => {
                          setProjetoDefinirModo(prj)
                          setModalDefinirModoOpen(true)
                        }}
                      />
                    </div>
                  )}

                  <h3 className="font-bold text-sm text-slate-900 mt-3 line-clamp-2">
                    {prj.nome || `Projeto ${prj.codigo}`}
                  </h3>
                  {prj.justificativa_saude && (
                    <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">
                      "{prj.justificativa_saude}"
                    </p>
                  )}

                  {/* Linha do Tempo Visual do Projeto: Barra de progresso horizontal com etapas */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600 flex items-center gap-1">
                        <Activity className="w-3 h-3 text-blue-600" />
                        Linha do Tempo ({prj.percentualConcluido}% concluído)
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {prj.etapasConcluidasCount}/{prj.totalEtapasCount} etapas
                      </span>
                    </div>

                    {prj.etapas.length === 0 ? (
                      <div className="h-2 w-full bg-slate-100 rounded-full" />
                    ) : (
                      <div className="flex items-center gap-1 w-full py-1">
                        {prj.etapas.map((et, idx) => {
                          const hojeTime = new Date().setHours(0, 0, 0, 0)
                          const isConcluida = et.status === 'concluida'
                          const isAndamento = et.status === 'em_andamento'
                          const dFim =
                            et.prazo_fim || (et as any).data_fim
                              ? new Date(et.prazo_fim || (et as any).data_fim).getTime()
                              : 0
                          const isAtrasada =
                            !isConcluida && et.status !== 'cancelada' && dFim > 0 && dFim < hojeTime

                          const corEtapa = isConcluida
                            ? 'bg-emerald-500 hover:bg-emerald-600'
                            : isAtrasada
                              ? 'bg-rose-500 hover:bg-rose-600 animate-pulse'
                              : isAndamento
                                ? 'bg-blue-500 hover:bg-blue-600'
                                : 'bg-slate-200 hover:bg-slate-300'

                          const nomeExecutor = et.expand?.executor?.nome || 'Sem executor'
                          const prazoTexto = et.prazo_fim ? formatDateBr(et.prazo_fim) : 'Sem prazo'

                          return (
                            <div
                              key={et.id || idx}
                              className={`h-2.5 flex-1 rounded-sm cursor-pointer transition-colors ${corEtapa}`}
                              title={`Etapa ${idx + 1}: ${et.nome || 'Etapa'} | Status: ${isAtrasada ? 'ATRASADA' : et.status} | Executor: ${nomeExecutor} | Prazo: ${prazoTexto}`}
                            />
                          )
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{' '}
                        Concluída
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block ml-1" /> Em
                        andamento
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-1" />{' '}
                        Atrasada
                      </span>
                      {prj.diasAtrasoMax > 0 && (
                        <span className="font-bold text-rose-600">
                          +{prj.diasAtrasoMax}d atraso
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informações de Cliente, Valor e Prazo */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Cliente: <strong className="text-slate-800">{nomeCliente}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        Valor:
                      </span>
                      <strong className="text-slate-900 font-semibold">
                        {prj.valor_total ? formatCurrencyBr(prj.valor_total) : '—'}
                      </strong>
                    </div>

                    {prj.prazo_final && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                          Prazo Final:
                        </span>
                        <strong className="text-slate-800 font-mono">
                          {formatDateBr(prj.prazo_final)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão para Abrir Detalhe com as Abas */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {prj.status === 'aguardando_definicao' ? (
                    <Badge
                      className="text-[10px] uppercase font-bold bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-100 flex items-center gap-1"
                      title="Projeto aguardando definição de execução (direta ou cotação)"
                    >
                      <Clock className="w-3 h-3 text-[#D95A2B]" />
                      Aguardando Definição
                    </Badge>
                  ) : prj.status === 'contratacao' ? (
                    <Badge
                      className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 flex items-center gap-1"
                      title="Projeto aguardando assinatura bilateral do contrato de serviços"
                    >
                      <FileSignature className="w-3 h-3 text-amber-700" />
                      Em Contratação
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${
                        prj.status === 'concluido'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {prj.status === 'concluido' ? 'Concluído' : prj.status || 'Em Andamento'}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1.5">
                    {prj.grupo && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/projetos/grupo/${prj.grupo}`)}
                        className="text-xs h-8 text-[#D95A2B] hover:bg-orange-50 border-orange-200"
                        title="Ver Grupo de Projetos"
                      >
                        <FolderKanban className="w-3.5 h-3.5 mr-1" />
                        Grupo
                      </Button>
                    )}

                    {canViewDossie && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProjetoDossieCardId(prj.id)
                          setModalDossieCardOpen(true)
                        }}
                        className="text-xs h-8 text-blue-700 hover:bg-blue-50 border-blue-200"
                        title="Ver dossiê consolidado e imprimir/salvar em PDF"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Dossiê (PDF)
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => {
                        setProjetoSelecionadoId(prj.id)
                        setModalDetalheOpen(true)
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Abrir Projeto
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Controles de Paginação / Carregamento Incremental */}
      {!carregando && totalItens > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-600 font-medium">
            Mostrando <strong>{projetos.length}</strong> de <strong>{totalItens}</strong> projetos
            {totalPaginas > 1 && (
              <span className="text-slate-400 ml-1 font-normal">
                (Página {paginaAtual} de {totalPaginas})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {paginaAtual < totalPaginas && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCarregarMais}
                disabled={carregandoMais}
                className="text-xs h-8 font-medium shadow-xs"
              >
                {carregandoMais ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-blue-600" />
                    Carregando mais...
                  </>
                ) : (
                  <>Carregar mais ({totalItens - projetos.length} restantes)</>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => carregarProjetos(paginaAtual, false)}
              disabled={carregando}
              className="text-xs h-8 text-slate-600 hover:text-slate-900"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Criar Projeto */}
      <ModalCriarProjeto
        open={modalCriarOpen}
        onOpenChange={setModalCriarOpen}
        onSuccess={carregarProjetos}
      />

      {/* Modal Detalhes do Projeto com as 4 Abas (Etapas, Entregáveis, Documentos, Riscos) */}
      <ModalDetalheProjeto
        open={modalDetalheOpen}
        onOpenChange={setModalDetalheOpen}
        projetoId={projetoSelecionadoId}
        onUpdate={carregarProjetos}
      />

      {/* Modal Rápido de Alteração de Saúde */}
      {projetoSaudeRapida && (
        <ModalSaudeProjeto
          open={modalSaudeRapidaOpen}
          onOpenChange={setModalSaudeRapidaOpen}
          projetoId={projetoSaudeRapida.id}
          codigoProjeto={projetoSaudeRapida.codigo}
          saudeAtual={projetoSaudeRapida.saude}
          justificativaAtual={projetoSaudeRapida.justificativa_saude}
          onSuccess={() => {
            carregarProjetos()
            setProjetoSaudeRapida(null)
          }}
        />
      )}

      {/* Modal Dossiê do Projeto acionado pelo card da listagem */}
      <ModalDossieProjeto
        open={modalDossieCardOpen}
        onOpenChange={setModalDossieCardOpen}
        projetoId={projetoDossieCardId}
      />

      {/* Modal Definir Modo de Execução (Grupo D) */}
      <ModalDefinirModoExecucao
        open={modalDefinirModoOpen}
        onOpenChange={setModalDefinirModoOpen}
        projeto={projetoDefinirModo}
        onSuccess={carregarProjetos}
      />
    </div>
  )
}
