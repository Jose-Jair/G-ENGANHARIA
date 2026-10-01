import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ProjetoRecord, ProjetoEtapaRecord, SaudeProjeto, ExecutorRecord } from '@/types'
import { projetosService } from '@/services/projetos'
import { executoresService } from '@/services/executores'
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
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { formatCnpj, formatCpf } from '@/lib/cnpj'

import { ModalDetalheProjeto } from '@/components/projetos/ModalDetalheProjeto'
import { ModalCriarProjeto } from '@/components/projetos/ModalCriarProjeto'
import { ModalSaudeProjeto } from '@/components/projetos/ModalSaudeProjeto'
import { ModalDossieProjeto } from '@/components/projetos/ModalDossieProjeto'

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
  const [searchParams] = useSearchParams()

  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [todasEtapas, setTodasEtapas] = useState<ProjetoEtapaRecord[]>([])
  const [executores, setExecutores] = useState<ExecutorRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [busca, setBusca] = useState(() => searchParams.get('busca') || '')
  const [filtroSaude, setFiltroSaude] = useState<string>(() => searchParams.get('saude') || 'todos')
  const [filtroDisciplina, setFiltroDisciplina] = useState<string>('todas')
  const [filtroExecutor, setFiltroExecutor] = useState<string>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>(
    () => searchParams.get('status') || 'todos',
  )

  // Modais
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null)

  const [modalSaudeRapidaOpen, setModalSaudeRapidaOpen] = useState(false)
  const [projetoSaudeRapida, setProjetoSaudeRapida] = useState<ProjetoRecord | null>(null)

  const [modalDossieCardOpen, setModalDossieCardOpen] = useState(false)
  const [projetoDossieCardId, setProjetoDossieCardId] = useState<string | null>(null)

  const canCreate = !!(user && (user.role === 'admin' || user.role === 'gestor'))
  const canViewDossie = !!(
    user && ['admin', 'gestor', 'financeiro', 'comercial'].includes(user.role)
  )

  const carregarProjetos = async () => {
    setCarregando(true)
    try {
      const [listaPrj, listaEtapas, listaExec] = await Promise.all([
        projetosService.list(),
        projetosService.listTodasEtapas ? projetosService.listTodasEtapas() : Promise.resolve([]),
        executoresService.list(),
      ])
      setProjetos(listaPrj)
      setTodasEtapas(listaEtapas)
      setExecutores(listaExec)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar projetos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarProjetos()
  }, [])

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

  // Filtragem e Ordenação por Criticidade (🔴 primeiro, depois por dias de atraso decrescente)
  const projetosFiltrados = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    return projetosComMetricas
      .filter((prj) => {
        const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
        const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
        const nomeCliente = (pj?.nome_fantasia || pj?.razao_social || pf?.nome || '').toLowerCase()
        const codigo = (prj.codigo || '').toLowerCase()
        const nomePrj = (prj.nome || '').toLowerCase()
        const matchBusca =
          !busca ||
          codigo.includes(busca.toLowerCase()) ||
          nomePrj.includes(busca.toLowerCase()) ||
          nomeCliente.includes(busca.toLowerCase())

        const matchSaude = filtroSaude === 'todos' || prj.saude === filtroSaude
        const matchStatus = filtroStatus === 'todos' || prj.status === filtroStatus

        const matchDisciplina =
          filtroDisciplina === 'todas' ||
          prj.disciplinasList.some((d) => d.toLowerCase().includes(filtroDisciplina.toLowerCase()))

        const matchExecutor =
          filtroExecutor === 'todos' || prj.executoresIds.includes(filtroExecutor)

        let matchPeriodo = true
        if (filtroPeriodo === 'mes_atual') {
          if (prj.prazo_final) {
            const d = new Date(prj.prazo_final)
            matchPeriodo =
              d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
          } else {
            matchPeriodo = false
          }
        } else if (filtroPeriodo === 'atrasados') {
          matchPeriodo = prj.diasAtrasoMax > 0
        }

        return (
          matchBusca &&
          matchSaude &&
          matchStatus &&
          matchDisciplina &&
          matchExecutor &&
          matchPeriodo
        )
      })
      .sort((a, b) => {
        // Ordenação por criticidade: 🔴 Vermelho (peso 3), 🟡 Amarelo (peso 2), 🟢 Verde (peso 1)
        const pesoSaude = (s?: string) => (s === 'vermelho' ? 3 : s === 'amarelo' ? 2 : 1)
        const diffSaude = pesoSaude(b.saude) - pesoSaude(a.saude)
        if (diffSaude !== 0) return diffSaude

        // Se empatar na saúde, desempata pelo maior número de dias de atraso
        return b.diasAtrasoMax - a.diasAtrasoMax
      })
  }, [
    projetosComMetricas,
    busca,
    filtroSaude,
    filtroStatus,
    filtroDisciplina,
    filtroExecutor,
    filtroPeriodo,
  ])

  // Contadores e métricas de portfólio por saúde
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
              if (projetosFiltrados.length === 0) {
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
                  data: projetosFiltrados,
                })
                toast({
                  title: 'Projetos Exportados',
                  description: `${projetosFiltrados.length} projeto(s) exportado(s) com sucesso. Auditoria registrada.`,
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
            Total de Projetos
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{projetosComMetricas.length}</span>
            <Briefcase className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Ordenação ativa por criticidade (🔴 primeiro)
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

      {/* Barra de Filtros Completos: Saúde, Disciplina, Executor, Período e Busca */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código (PRJ-...), nome do projeto ou cliente..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            {/* Filtro Saúde */}
            <Select value={filtroSaude} onValueChange={setFiltroSaude}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Saúde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Saúdes</SelectItem>
                <SelectItem value="vermelho">🔴 Vermelho</SelectItem>
                <SelectItem value="amarelo">🟡 Amarelo</SelectItem>
                <SelectItem value="verde">🟢 Verde</SelectItem>
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
              </SelectContent>
            </Select>

            {/* Filtro Executor */}
            <Select value={filtroExecutor} onValueChange={setFiltroExecutor}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Executor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Executores</SelectItem>
                {executores.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Período de Entrega */}
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo Período</SelectItem>
                <SelectItem value="mes_atual">Entrega este Mês</SelectItem>
                <SelectItem value="atrasados">Atrasados Hoje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid de Projetos */}
      {carregando ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs text-slate-400">Carregando projetos de engenharia...</p>
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-lg">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Nenhum projeto encontrado</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Projetos são gerados automaticamente pelo aceite de propostas ou pelo botão "Novo
            Projeto Direto".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosFiltrados.map((prj) => {
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
                      {prj.expand?.proposta && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Origem: {prj.expand.proposta.numero}
                        </p>
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

                {/* Botão para Abrir Detalhe com as 4 Abas */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-semibold text-slate-600"
                  >
                    {prj.status || 'em_andamento'}
                  </Badge>

                  <div className="flex items-center gap-1.5">
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
    </div>
  )
}
