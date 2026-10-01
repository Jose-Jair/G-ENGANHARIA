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
} from 'lucide-react'
import { exportService } from '@/services/exportService'

import { ModalCriarEditarExecutor } from '@/components/executores/ModalCriarEditarExecutor'
import { ModalSuspenderExecutor } from '@/components/executores/ModalSuspenderExecutor'
import { ModalHistoricoAvaliacoes } from '@/components/executores/ModalHistoricoAvaliacoes'

export const ExecutoresPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [executores, setExecutores] = useState<ExecutorComMetricas[]>([])
  const [carregando, setCarregando] = useState(true)
  const [notaCorte, setNotaCorte] = useState<number>(3.0)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroAlerta, setFiltroAlerta] = useState<string>('todos')

  // Modais
  const [modalCriarEditarOpen, setModalCriarEditarOpen] = useState(false)
  const [executorEditar, setExecutorEditar] = useState<ExecutorRecord | null>(null)

  const [modalSuspenderOpen, setModalSuspenderOpen] = useState(false)
  const [executorSuspender, setExecutorSuspender] = useState<ExecutorRecord | null>(null)

  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false)
  const [executorHistorico, setExecutorHistorico] = useState<ExecutorRecord | null>(null)

  const canEdit = !!(user && (user.role === 'admin' || user.role === 'gestor'))

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

  // Alteração direta de homologação -> ativo
  const handleAtivar = async (executor: ExecutorRecord) => {
    try {
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

  // Filtragem
  const executoresFiltrados = executores.filter((ex) => {
    const matchBusca =
      !busca ||
      ex.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (ex.cpf_cnpj && ex.cpf_cnpj.toLowerCase().includes(busca.toLowerCase())) ||
      (ex.disciplinas && ex.disciplinas.toLowerCase().includes(busca.toLowerCase())) ||
      (ex.numero_registro && ex.numero_registro.toLowerCase().includes(busca.toLowerCase()))

    const matchStatus = filtroStatus === 'todos' || ex.status === filtroStatus

    let matchAlerta = true
    if (filtroAlerta === 'vencido') matchAlerta = ex.isRegistroVencido
    if (filtroAlerta === 'vencendo') matchAlerta = ex.isRegistroVencendoBreve
    if (filtroAlerta === 'baixa_nota') matchAlerta = ex.isAbaixoNotaCorte
    if (filtroAlerta === 'capacidade_cheia') matchAlerta = ex.isCapacidadeEsgotada

    return matchBusca && matchStatus && matchAlerta
  })

  // Contadores
  const countAtivos = executores.filter((e) => e.status === 'ativo').length
  const countSuspensos = executores.filter((e) => e.status === 'suspenso').length
  const countVencidos = executores.filter((e) => e.isRegistroVencido).length
  const countBaixaNota = executores.filter((e) => e.isAbaixoNotaCorte).length

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

          {canEdit && (
            <Button
              onClick={() => {
                setExecutorEditar(null)
                setModalCriarEditarOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-xs shadow-xs"
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
            Conselho Vencido
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-amber-600">{countVencidos}</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
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

      {/* Barra de Filtros */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ, registro de conselho ou disciplina..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px] text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="homologacao">Homologação</SelectItem>
              <SelectItem value="suspenso">Suspensos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
            <SelectTrigger className="w-[180px] text-xs h-9">
              <SelectValue placeholder="Alertas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Alertas</SelectItem>
              <SelectItem value="vencido">⚠️ Conselho Vencido</SelectItem>
              <SelectItem value="vencendo">⏳ Vencendo em 30d</SelectItem>
              <SelectItem value="baixa_nota">⭐ Abaixo da Nota de Corte</SelectItem>
              <SelectItem value="capacidade_cheia">🚫 Capacidade Esgotada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Executores */}
      {carregando ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs text-slate-400">Carregando executores e métricas...</p>
        </div>
      ) : executoresFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-lg">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Nenhum executor encontrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre os profissionais e fornecedores que atuarão nas etapas terceirizadas.
          </p>
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
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Topo: Nome, Tipo e Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] uppercase font-bold text-slate-700 bg-slate-100"
                        >
                          {ex.tipo}
                        </Badge>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{ex.nome}</h3>
                      </div>
                      {ex.cpf_cnpj && (
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">{ex.cpf_cnpj}</p>
                      )}
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
                          <strong>Suspenso:</strong> {ex.motivo_suspensao || 'Sem motivo informado'}
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
                  </div>

                  {/* Informações Técnicas */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Conselho:</span>
                      <strong className="text-slate-800">
                        {ex.conselho || '—'} {ex.numero_registro || ''}
                      </strong>
                    </div>

                    {ex.disciplinas && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Disciplinas:</span>
                        <span className="text-slate-800 font-medium truncate max-w-[170px] text-right">
                          {ex.disciplinas}
                        </span>
                      </div>
                    )}

                    {/* Capacidade Simultânea */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ocupação / Capacidade:</span>
                      <span
                        className={`font-semibold ${
                          ex.isCapacidadeEsgotada ? 'text-rose-600 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {ex.etapasAtivasCount} de {ex.capacidade_simultanea || 1} etapas ativas
                      </span>
                    </div>

                    {/* Nota Geral Ponderada */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Nota Geral Ponderada:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setExecutorHistorico(ex)
                          setModalHistoricoOpen(true)
                        }}
                        className="flex items-center gap-1 text-amber-600 font-bold hover:underline"
                        title="Ver histórico de avaliações detalhadas"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {ex.nota_geral ? ex.nota_geral.toFixed(2) : 'S/ Nota'}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({ex.total_avaliacoes || 0})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rodapé e Ações */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div>
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
                      {ex.status === 'homologacao' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAtivar(ex)}
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-2"
                        >
                          Aprovar
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
    </div>
  )
}
