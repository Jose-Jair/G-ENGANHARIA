import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ProjetoRecord, ProjetoEtapaRecord, ExecutorRecord, EmpresaRecord } from '@/types'
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
  Download,
  RefreshCw,
  X,
  ArrowUpDown,
  Filter,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
  Kanban as KanbanIcon,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { formatCnpj, formatCpf } from '@/lib/cnpj'

import { ModalDetalheProjeto } from '@/components/projetos/ModalDetalheProjeto'
import { ModalCriarProjeto } from '@/components/projetos/ModalCriarProjeto'
import { ModalSaudeProjeto } from '@/components/projetos/ModalSaudeProjeto'
import { ModalDossieProjeto } from '@/components/projetos/ModalDossieProjeto'
import { ModalDefinirModoExecucao } from '@/components/projetos/ModalDefinirModoExecucao'
import { TrilhaDoNegocio } from '@/components/comum/TrilhaDoNegocio'
import { CardProjeto, ProjetoComEtapasCalculadas } from '@/components/projetos/CardProjeto'
import { TabelaProjetosDensa } from '@/components/projetos/TabelaProjetosDensa'
import { KanbanProjetos } from '@/components/projetos/KanbanProjetos'
import { SkeletonCardProjeto } from '@/components/projetos/SkeletonCardProjeto'
import { SkeletonTabelaProjetos } from '@/components/projetos/SkeletonTabelaProjetos'
import { SkeletonKanbanProjetos } from '@/components/projetos/SkeletonKanbanProjetos'

import { useSearchParams } from 'react-router-dom'

export const ProjetosPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [todasEtapas, setTodasEtapas] = useState<ProjetoEtapaRecord[]>([])
  const [, setExecutores] = useState<ExecutorRecord[]>([])
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

  // Alternância de visão: Cards ⇄ Tabela ⇄ Kanban (persistida por usuário)
  type VisaoProjetos = 'cards' | 'tabela' | 'kanban'
  const storageKeyVisao = useMemo(() => {
    return `gestao_gplus_projetos_visao_${user?.id || 'anon'}`
  }, [user?.id])

  const [visao, setVisao] = useState<VisaoProjetos>(() => {
    try {
      const salva = localStorage.getItem(`gestao_gplus_projetos_visao_${user?.id || 'anon'}`)
      if (salva === 'cards' || salva === 'tabela' || salva === 'kanban') {
        return salva
      }
    } catch {
      // silencioso
    }
    return 'cards'
  })

  // Sincroniza a chave se o usuário mudar de sessão
  useEffect(() => {
    try {
      const salva = localStorage.getItem(storageKeyVisao)
      if (salva === 'cards' || salva === 'tabela' || salva === 'kanban') {
        setVisao(salva)
      }
    } catch {
      // silencioso
    }
  }, [storageKeyVisao])

  // Atualiza visão e salva no localStorage do usuário
  const handleMudarVisao = (novaVisao: VisaoProjetos) => {
    setVisao(novaVisao)
    try {
      localStorage.setItem(storageKeyVisao, novaVisao)
    } catch {
      // silencioso
    }
  }

  // Painel recolhível de filtros adicionais sob demanda
  const [painelFiltrosAberto, setPainelFiltrosAberto] = useState(false)

  // Ordenação no servidor
  const [ordenacao, setOrdenacao] = useState<string>('criacao_desc')

  // Contagens globais para a faixa de indicadores de resumo
  const [resumoContagens, setResumoContagens] = useState<{
    total: number
    verde: number
    amarelo: number
    vermelho: number
    standby: number
  }>({ total: 0, verde: 0, amarelo: 0, vermelho: 0, standby: 0 })

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

  // Debounce na busca textual (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusca(buscaInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [buscaInput])

  // Mapear opção de ordenação da UI para o PocketBase
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

  // Objeto de filtros estruturados para o serviço
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

  // Contagem de filtros ativos (exceto texto de busca se tratado separadamente, mas aqui somamos para o badge)
  const totalFiltrosAvancadosAtivos = useMemo(() => {
    let count = 0
    if (filtroStatus !== 'todos') count++
    if (filtroSaude !== 'todos') count++
    if (filtroEmpresa !== 'todas') count++
    if (filtroDisciplina !== 'todas') count++
    if (filtroDataInicio) count++
    if (filtroDataFim) count++
    return count
  }, [filtroStatus, filtroSaude, filtroEmpresa, filtroDisciplina, filtroDataInicio, filtroDataFim])

  const totalFiltrosAtivos = totalFiltrosAvancadosAtivos + (busca.trim() ? 1 : 0)

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

  // Carrega contagens do resumo
  const carregarResumo = useCallback(async () => {
    const c = await projetosService.getContagensResumo()
    setResumoContagens(c)
  }, [])

  // Carrega opções auxiliares
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
    carregarResumo()
    return () => {
      cancel = true
    }
  }, [carregarResumo])

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

  // Toggle do indicador de saúde ou standby
  const handleToggleFiltroIndicador = (
    tipo: 'todos' | 'verde' | 'amarelo' | 'vermelho' | 'standby',
  ) => {
    if (tipo === 'todos') {
      if (filtroSaude === 'todos' && filtroStatus === 'todos') {
        // já limpo
      } else {
        setFiltroSaude('todos')
        setFiltroStatus('todos')
      }
      return
    }

    if (tipo === 'standby') {
      if (filtroStatus === 'aguardando_definicao') {
        setFiltroStatus('todos')
      } else {
        setFiltroStatus('aguardando_definicao')
        setFiltroSaude('todos')
      }
      return
    }

    // Verde / Amarelo / Vermelho
    if (filtroSaude === tipo) {
      setFiltroSaude('todos')
    } else {
      setFiltroSaude(tipo)
      if (filtroStatus === 'aguardando_definicao') {
        setFiltroStatus('todos')
      }
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

  const projetosExibidos = projetosComMetricas

  return (
    <div className="space-y-4">
      {/* TRILHA DO NEGÓCIO (FIXA PARA PERFIS INTERNOS) */}
      <TrilhaDoNegocio etapaAtual="projeto" />

      {/* 1. Cabeçalho da Página com Identidade G+ (#1E2A4A / #D95A2B) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1E2A4A] tracking-tight">
              Projetos de Engenharia
            </h1>
            <Badge variant="outline" className="font-mono text-xs border-slate-300 text-slate-600">
              Etapa 8
            </Badge>
          </div>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
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
            className="text-xs text-slate-700 hover:text-[#1E2A4A] shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Exportar CSV
          </Button>

          {canCreate && (
            <Button
              onClick={() => setModalCriarOpen(true)}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Projeto Direto
            </Button>
          )}
        </div>
      </div>

      {/* 2. Faixa de Resumo Compacta no Topo: Linha Fina de Indicadores Clicáveis (~1 linha) */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Resumo:
          </span>

          {/* Indicador: Total */}
          <button
            type="button"
            onClick={() => handleToggleFiltroIndicador('todos')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filtroSaude === 'todos' && filtroStatus !== 'aguardando_definicao'
                ? 'bg-[#1E2A4A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Mostrar todos os projetos (limpa filtros de saúde e standby)"
          >
            <span>Total</span>
            <span className="font-bold">{resumoContagens.total}</span>
          </button>

          <span className="text-slate-300">·</span>

          {/* Indicador: Verde */}
          <button
            type="button"
            onClick={() => handleToggleFiltroIndicador('verde')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroSaude === 'verde'
                ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-300 shadow-xs'
                : 'hover:bg-emerald-50 text-slate-700'
            }`}
            title="Filtrar projetos com saúde Verde (clique novamente para limpar)"
          >
            <span className="text-sm leading-none">🟢</span>
            <span>{resumoContagens.verde}</span>
          </button>

          <span className="text-slate-300">·</span>

          {/* Indicador: Amarelo */}
          <button
            type="button"
            onClick={() => handleToggleFiltroIndicador('amarelo')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroSaude === 'amarelo'
                ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-300 shadow-xs'
                : 'hover:bg-amber-50 text-slate-700'
            }`}
            title="Filtrar projetos com saúde Amarela (clique novamente para limpar)"
          >
            <span className="text-sm leading-none">🟡</span>
            <span>{resumoContagens.amarelo}</span>
          </button>

          <span className="text-slate-300">·</span>

          {/* Indicador: Vermelho */}
          <button
            type="button"
            onClick={() => handleToggleFiltroIndicador('vermelho')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroSaude === 'vermelho'
                ? 'bg-rose-600 text-white font-bold ring-2 ring-rose-300 shadow-xs'
                : 'hover:bg-rose-50 text-slate-700'
            }`}
            title="Filtrar projetos com saúde Vermelha (clique novamente para limpar)"
          >
            <span className="text-sm leading-none">🔴</span>
            <span>{resumoContagens.vermelho}</span>
          </button>

          <span className="text-slate-300">·</span>

          {/* Indicador: Standby */}
          <button
            type="button"
            onClick={() => handleToggleFiltroIndicador('standby')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filtroStatus === 'aguardando_definicao'
                ? 'bg-[#D95A2B] text-white font-bold ring-2 ring-orange-300 shadow-xs'
                : 'hover:bg-orange-50 text-slate-700'
            }`}
            title="Filtrar projetos em Standby (aguardando definição de execução)"
          >
            <span className="w-2 h-2 rounded-full bg-[#D95A2B]" />
            <span>Standby</span>
            <span className="font-bold">{resumoContagens.standby}</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-normal">
          {totalFiltrosAtivos > 0 ? (
            <span className="text-slate-600 font-medium">
              Filtrados: {totalItens} de {resumoContagens.total}
            </span>
          ) : (
            <span>Base total: {resumoContagens.total}</span>
          )}
        </div>
      </div>

      {/* 3. Filtros Sob Demanda: 1 Linha Permanente + Painel Opcional Recolhível */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-2xs">
        {/* Linha 1 Sempre Visível: Busca + Ordenação + Botão "Filtros (n)" */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Busca Livre */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Buscar por código (PRJ-...), título/nome do projeto ou cliente na base..."
              className="pl-9 pr-8 text-xs h-9 bg-slate-50/50 focus:bg-white"
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 hidden md:inline-flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                Ordenar:
              </span>
              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="text-xs h-9 w-[170px] sm:w-[190px]">
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

            {/* Botão "Filtros" com Badge de Quantidade de Filtros Ativos */}
            <Button
              type="button"
              variant={
                painelFiltrosAberto || totalFiltrosAvancadosAtivos > 0 ? 'default' : 'outline'
              }
              size="sm"
              onClick={() => setPainelFiltrosAberto((prev) => !prev)}
              className={`text-xs h-9 font-medium shadow-2xs gap-1.5 ${
                painelFiltrosAberto || totalFiltrosAvancadosAtivos > 0
                  ? 'bg-[#1E2A4A] hover:bg-[#151D33] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {totalFiltrosAvancadosAtivos > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#D95A2B] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalFiltrosAvancadosAtivos}
                </span>
              )}
              {painelFiltrosAberto ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              )}
            </Button>

            {/* SELETOR DE VISÃO: Grupo de 3 ícones (Cards | Tabela | Kanban) persistido por usuário */}
            <div
              className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200"
              role="group"
              aria-label="Alternar modo de visualização"
            >
              <button
                type="button"
                onClick={() => handleMudarVisao('cards')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  visao === 'cards'
                    ? 'bg-white text-[#1E2A4A] shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Visão em Cards"
                aria-pressed={visao === 'cards'}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#D95A2B]" />
                <span className="hidden sm:inline">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => handleMudarVisao('tabela')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  visao === 'tabela'
                    ? 'bg-white text-[#1E2A4A] shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Visão em Tabela Densa"
                aria-pressed={visao === 'tabela'}
              >
                <TableIcon className="w-3.5 h-3.5 text-[#D95A2B]" />
                <span className="hidden sm:inline">Tabela</span>
              </button>

              <button
                type="button"
                onClick={() => handleMudarVisao('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  visao === 'kanban'
                    ? 'bg-white text-[#1E2A4A] shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Visão em Quadro Kanban"
                aria-pressed={visao === 'kanban'}
              >
                <KanbanIcon className="w-3.5 h-3.5 text-[#D95A2B]" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Linha de Chips Ativos (se houver filtros ativos, visíveis logo abaixo da busca) */}
        {totalFiltrosAtivos > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] text-slate-400 font-medium mr-0.5">Ativos:</span>

            {busca.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-[#1E2A4A] border border-slate-200">
                Texto: "{busca}"
                <button
                  type="button"
                  onClick={() => {
                    setBuscaInput('')
                    setBusca('')
                  }}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de texto"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroStatus !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                Status:{' '}
                {filtroStatus === 'aguardando_definicao'
                  ? 'Standby'
                  : filtroStatus === 'em_andamento'
                    ? 'Em Andamento'
                    : filtroStatus === 'contratacao'
                      ? 'Contratação'
                      : filtroStatus === 'concluido'
                        ? 'Concluído'
                        : filtroStatus}
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de status"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroSaude !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                Saúde:{' '}
                {filtroSaude === 'verde'
                  ? '🟢 Verde'
                  : filtroSaude === 'amarelo'
                    ? '🟡 Amarelo'
                    : '🔴 Vermelho'}
                <button
                  type="button"
                  onClick={() => setFiltroSaude('todos')}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de saúde"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroEmpresa !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                Empresa:{' '}
                {empresas.find((e) => e.id === filtroEmpresa)?.nome_fantasia || 'Selecionada'}
                <button
                  type="button"
                  onClick={() => setFiltroEmpresa('todas')}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de empresa"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filtroDisciplina !== 'todas' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                Disciplina: {filtroDisciplina}
                <button
                  type="button"
                  onClick={() => setFiltroDisciplina('todas')}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de disciplina"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(filtroDataInicio || filtroDataFim) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                Prazo: {filtroDataInicio ? formatDateBr(filtroDataInicio) : '...'} até{' '}
                {filtroDataFim ? formatDateBr(filtroDataFim) : '...'}
                <button
                  type="button"
                  onClick={() => {
                    setFiltroDataInicio('')
                    setFiltroDataFim('')
                  }}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remover filtro de período"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={limparTodosFiltros}
              className="text-xs h-6 px-2 text-[#D95A2B] hover:text-[#C44E22] hover:bg-orange-50 font-semibold"
            >
              Limpar todos
            </Button>
          </div>
        )}

        {/* Painel Recolhível de Filtros Avançados (Status, Saúde, Empresa, Disciplina e Período) */}
        {painelFiltrosAberto && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Status */}
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">Status</span>
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
            </div>

            {/* Saúde */}
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">Saúde</span>
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
            </div>

            {/* Empresa / Parceiro Demandante */}
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Empresa / Parceiro
              </span>
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
            </div>

            {/* Disciplina */}
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Disciplina
              </span>
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
            </div>

            {/* Período de Prazo: De / Até */}
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Período de Prazo
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="text-xs h-9 px-1.5 text-slate-700"
                  title="Prazo final a partir de..."
                />
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="text-xs h-9 px-1.5 text-slate-700"
                  title="Prazo final até..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Conteúdo da Visão Ativa (Cards | Tabela | Kanban), Esqueletos ou Estado Vazio */}
      {carregando ? (
        visao === 'tabela' ? (
          <SkeletonTabelaProjetos rows={8} />
        ) : visao === 'kanban' ? (
          <SkeletonKanbanProjetos columns={4} />
        ) : (
          <SkeletonCardProjeto count={6} />
        )
      ) : projetosExibidos.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-md mx-auto space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-[#D95A2B] flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-[#1E2A4A] text-sm">
              {totalFiltrosAtivos > 0
                ? 'Nenhum projeto encontrado'
                : 'Inicie seu primeiro Projeto de Engenharia'}
            </p>
            <p className="text-xs text-[#8A8A8A] mt-1 leading-relaxed px-4">
              {totalFiltrosAtivos > 0
                ? 'Nenhum projeto corresponde aos critérios informados. Ajuste os filtros ou limpe-os para voltar a ver toda a base.'
                : 'Projetos são gerados automaticamente após o aceite formal de uma proposta ou criados diretamente aqui, com gestão de etapas por disciplina, cotações, documentos e riscos.'}
            </p>
          </div>
          {totalFiltrosAtivos > 0 ? (
            <div className="pt-2">
              <Button
                size="sm"
                onClick={limparTodosFiltros}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold shadow-xs"
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            canCreate && (
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => setModalCriarOpen(true)}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold shadow-xs"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Criar Projeto Direto
                </Button>
              </div>
            )
          )}
        </div>
      ) : visao === 'tabela' ? (
        /* VISÃO 2: TABELA DENSA COM ORDENAÇÃO NO SERVIDOR E HOVER */
        <TabelaProjetosDensa
          projetos={projetosExibidos}
          userRole={user?.role}
          canViewDossie={canViewDossie}
          ordenacao={ordenacao}
          onMudarOrdenacao={setOrdenacao}
          onAbrirProjeto={(id) => {
            setProjetoSelecionadoId(id)
            setModalDetalheOpen(true)
          }}
          onAbrirDossie={(id) => {
            setProjetoDossieCardId(id)
            setModalDossieCardOpen(true)
          }}
          onAbrirSaudeModal={(p) => {
            setProjetoSaudeRapida(p)
            setModalSaudeRapidaOpen(true)
          }}
          onDefinirModo={(p) => {
            setProjetoDefinirModo(p)
            setModalDefinirModoOpen(true)
          }}
        />
      ) : visao === 'kanban' ? (
        /* VISÃO 3: KANBAN POR STATUS COM REGRAS OFICIAIS DE TRANSIÇÃO */
        <KanbanProjetos
          projetos={projetosExibidos}
          userRole={user?.role}
          onAbrirProjeto={(id) => {
            setProjetoSelecionadoId(id)
            setModalDetalheOpen(true)
          }}
          onDefinirModo={(p) => {
            setProjetoDefinirModo(p)
            setModalDefinirModoOpen(true)
          }}
          onTentativaMudancaInvalida={(msg) => {
            toast({
              title: 'Caminho oficial obrigatório',
              description: msg,
              variant: 'destructive',
            })
          }}
        />
      ) : (
        /* VISÃO 1: CARDS (DEFAULT) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosExibidos.map((prj) => (
            <CardProjeto
              key={prj.id}
              projeto={prj}
              userRole={user?.role}
              canViewDossie={canViewDossie}
              onAbrirProjeto={(id) => {
                setProjetoSelecionadoId(id)
                setModalDetalheOpen(true)
              }}
              onAbrirDossie={(id) => {
                setProjetoDossieCardId(id)
                setModalDossieCardOpen(true)
              }}
              onAbrirSaudeModal={(p) => {
                setProjetoSaudeRapida(p)
                setModalSaudeRapidaOpen(true)
              }}
              onDefinirModo={(p) => {
                setProjetoDefinirModo(p)
                setModalDefinirModoOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* 5. Rodapé Integrado: Contador "Mostrando X de Y (Página N de M)" + Carregar Mais */}
      {!carregando && totalItens > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-600 font-medium">
            Mostrando <strong>{projetos.length}</strong> de <strong>{totalItens}</strong>
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
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#D95A2B]" />
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
              onClick={() => {
                carregarProjetos(paginaAtual, false)
                carregarResumo()
              }}
              disabled={carregando}
              className="text-xs h-8 text-slate-600 hover:text-slate-900"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Modais da Página */}
      <ModalCriarProjeto
        open={modalCriarOpen}
        onOpenChange={setModalCriarOpen}
        onSuccess={() => {
          carregarProjetos(1, false)
          carregarResumo()
        }}
      />

      <ModalDetalheProjeto
        open={modalDetalheOpen}
        onOpenChange={setModalDetalheOpen}
        projetoId={projetoSelecionadoId}
        onUpdate={() => {
          carregarProjetos(paginaAtual, false)
          carregarResumo()
        }}
      />

      {projetoSaudeRapida && (
        <ModalSaudeProjeto
          open={modalSaudeRapidaOpen}
          onOpenChange={setModalSaudeRapidaOpen}
          projetoId={projetoSaudeRapida.id}
          codigoProjeto={projetoSaudeRapida.codigo}
          saudeAtual={projetoSaudeRapida.saude}
          justificativaAtual={projetoSaudeRapida.justificativa_saude}
          onSuccess={() => {
            carregarProjetos(paginaAtual, false)
            carregarResumo()
            setProjetoSaudeRapida(null)
          }}
        />
      )}

      <ModalDossieProjeto
        open={modalDossieCardOpen}
        onOpenChange={setModalDossieCardOpen}
        projetoId={projetoDossieCardId}
      />

      <ModalDefinirModoExecucao
        open={modalDefinirModoOpen}
        onOpenChange={setModalDefinirModoOpen}
        projeto={projetoDefinirModo}
        onSuccess={() => {
          carregarProjetos(1, false)
          carregarResumo()
        }}
      />
    </div>
  )
}
export default ProjetosPage
