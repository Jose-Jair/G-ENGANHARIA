import React, { useState } from 'react'
import {
  ProjetoEtapaRecord,
  TipoExecucaoEtapa,
  StatusEtapa,
  ExecutorRecord,
  ModeloEtapaDisciplina,
} from '@/types'
import { projetoEtapasService, CreateEtapaData } from '@/services/projetoDetalhes'
import { parametrosService } from '@/services/parametros'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Layers,
  ArrowRight,
  UserCheck,
  Calendar,
  AlertTriangle,
  Lock,
  MessageSquareQuote,
  Loader2,
  Trash2,
} from 'lucide-react'

interface EtapasTabProps {
  projetoId: string
  etapas: ProjetoEtapaRecord[]
  executores: ExecutorRecord[]
  canEdit: boolean
  onRefresh: () => void
  onAbrirCotacoes: (etapa: ProjetoEtapaRecord) => void
  onAbrirAvaliacao: (etapa: ProjetoEtapaRecord) => void
}

const STATUS_LABELS: Record<StatusEtapa, { label: string; variant: string }> = {
  a_iniciar: { label: 'A Iniciar', variant: 'bg-slate-100 text-slate-700 border-slate-300' },
  cotacao: { label: 'Em Cotação', variant: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  em_andamento: { label: 'Em Andamento', variant: 'bg-blue-100 text-blue-800 border-blue-300' },
  revisao: { label: 'Em Revisão', variant: 'bg-amber-100 text-amber-800 border-amber-300' },
  concluida: { label: 'Concluída', variant: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelada: { label: 'Cancelada', variant: 'bg-rose-100 text-rose-800 border-rose-300' },
}

export const EtapasTab: React.FC<EtapasTabProps> = ({
  projetoId,
  etapas,
  executores,
  canEdit,
  onRefresh,
  onAbrirCotacoes,
  onAbrirAvaliacao,
}) => {
  const { toast } = useToast()
  const [modalNovaEtapaOpen, setModalNovaEtapaOpen] = useState(false)
  const [modalModelosOpen, setModalModelosOpen] = useState(false)
  const [modelosDisponiveis, setModelosDisponiveis] = useState<ModeloEtapaDisciplina[]>([])
  const [modeloSelecionadoIndex, setModeloSelecionadoIndex] = useState<string>('0')

  // Form states
  const [nome, setNome] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [tipoExecucao, setTipoExecucao] = useState<TipoExecucaoEtapa>('direta')
  const [executorId, setExecutorId] = useState('')
  const [prazo, setPrazo] = useState('')
  const [status, setStatus] = useState<StatusEtapa>('a_iniciar')
  const [custoEstimado, setCustoEstimado] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Carregar modelos de etapas
  React.useEffect(() => {
    parametrosService
      .getByKey('modelos_etapas_disciplinas')
      .then((p) => {
        if (p?.valor) {
          try {
            const list = JSON.parse(p.valor)
            if (Array.isArray(list)) setModelosDisponiveis(list)
          } catch {
            /* intentionally ignored */
          }
        }
      })
      .catch(() => {})
  }, [])

  const handleCriarEtapa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome da etapa.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateEtapaData = {
        projeto: projetoId,
        nome: nome.trim(),
        disciplina: disciplina.trim() || undefined,
        ordem: etapas.length + 1,
        tipo_execucao: tipoExecucao,
        executor: tipoExecucao !== 'direta' && executorId ? executorId : undefined,
        prazo: prazo ? `${prazo} 23:59:59.000Z` : undefined,
        custo_estimado: custoEstimado ? parseFloat(custoEstimado) : undefined,
        status,
      }

      await projetoEtapasService.create(payload)
      toast({ title: 'Etapa criada com sucesso!' })
      setModalNovaEtapaOpen(false)
      limparForm()
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar etapa',
        description: err.message || 'Falha ao salvar no servidor',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleAplicarModelo = async () => {
    const idx = parseInt(modeloSelecionadoIndex, 10)
    const modelo = modelosDisponiveis[idx]
    if (!modelo) return

    setSalvando(true)
    try {
      await projetoEtapasService.aplicarModeloPadrao(projetoId, modelo.disciplina, modelo.etapas)
      toast({
        title: 'Modelo padrão aplicado!',
        description: `${modelo.etapas.length} etapas adicionadas para ${modelo.disciplina}.`,
      })
      setModalModelosOpen(false)
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao aplicar modelo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleAlterarStatus = async (etapa: ProjetoEtapaRecord, novoStatus: StatusEtapa) => {
    try {
      await projetoEtapasService.update(etapa.id, { status: novoStatus })
      toast({ title: `Status alterado para ${STATUS_LABELS[novoStatus].label}` })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' })
    }
  }

  const handleExcluirEtapa = async (id: string) => {
    if (!confirm('Deseja realmente remover esta etapa?')) return
    try {
      await projetoEtapasService.delete(id)
      toast({ title: 'Etapa removida com sucesso' })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const limparForm = () => {
    setNome('')
    setDisciplina('')
    setTipoExecucao('direta')
    setExecutorId('')
    setPrazo('')
    setStatus('a_iniciar')
    setCustoEstimado('')
  }

  return (
    <div className="space-y-4">
      {/* Barra de Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Etapas do Projeto ({etapas.length})
          </h3>
          <p className="text-xs text-slate-500">
            Dependência simples sequencial: cada etapa deve aguardar a conclusão da anterior
            (bloqueio visual).
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalModelosOpen(true)}
              className="text-xs"
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Modelo por Disciplina
            </Button>
            <Button
              size="sm"
              onClick={() => {
                limparForm()
                setModalNovaEtapaOpen(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nova Etapa
            </Button>
          </div>
        )}
      </div>

      {/* Lista de Etapas Sequenciais */}
      {etapas.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-lg">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhuma etapa cadastrada ainda</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Utilize os modelos padrões por disciplina ou cadastre as etapas individualmente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {etapas.map((etapa, idx) => {
            const etapaAnterior = idx > 0 ? etapas[idx - 1] : null
            const isAnteriorPendente =
              etapaAnterior &&
              etapaAnterior.status !== 'concluida' &&
              etapaAnterior.status !== 'cancelada'
            const isEtapaTerceirizada =
              etapa.tipo_execucao === 'terceirizada' || etapa.tipo_execucao === 'mista'

            return (
              <div
                key={etapa.id}
                className={`p-4 bg-white border rounded-lg transition-all ${
                  isAnteriorPendente && etapa.status === 'a_iniciar'
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <h4 className="font-semibold text-sm text-slate-900">{etapa.nome}</h4>
                      {etapa.disciplina && (
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {etapa.disciplina}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${
                          etapa.tipo_execucao === 'direta'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : etapa.tipo_execucao === 'terceirizada'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        Execução {etapa.tipo_execucao}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${
                          STATUS_LABELS[etapa.status]?.variant || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[etapa.status]?.label || etapa.status}
                      </Badge>
                    </div>

                    {/* Informações de Prazo e Executor */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      {etapa.prazo && (
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Prazo: {formatDateBr(etapa.prazo)}
                        </span>
                      )}

                      {isEtapaTerceirizada && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          Executor:{' '}
                          <span className="font-medium text-slate-800">
                            {etapa.expand?.executor?.nome || 'Aguardando seleção/cotação'}
                          </span>
                        </span>
                      )}

                      {/* Aviso de dependência sequencial */}
                      {isAnteriorPendente && etapa.status === 'a_iniciar' && (
                        <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                          <Lock className="w-3 h-3 text-amber-600" />
                          Aguardando conclusão da etapa #{idx} ({etapaAnterior?.nome})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações da Etapa */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Botão de Cotações quando terceirizada/mista */}
                    {isEtapaTerceirizada && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAbrirCotacoes(etapa)}
                        className="text-xs border-indigo-200 hover:bg-indigo-50 text-indigo-700 h-8"
                      >
                        <MessageSquareQuote className="w-3.5 h-3.5 mr-1" />
                        Cotações
                      </Button>
                    )}

                    {/* Avaliar Executor quando concluída e terceirizada */}
                    {canEdit &&
                      isEtapaTerceirizada &&
                      etapa.status === 'concluida' &&
                      etapa.executor && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAbrirAvaliacao(etapa)}
                          className="text-xs border-amber-300 hover:bg-amber-50 text-amber-800 h-8"
                        >
                          ⭐ Avaliar Executor
                        </Button>
                      )}

                    {/* Transições de Status */}
                    {canEdit && (
                      <Select
                        value={etapa.status}
                        onValueChange={(val: StatusEtapa) => handleAlterarStatus(etapa, val)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_iniciar">A Iniciar</SelectItem>
                          <SelectItem value="cotacao">Em Cotação</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="revisao">Em Revisão</SelectItem>
                          <SelectItem value="concluida">Concluída</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExcluirEtapa(etapa.id)}
                        className="text-slate-400 hover:text-rose-600 h-8 px-2"
                        title="Remover etapa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Nova Etapa */}
      <Dialog open={modalNovaEtapaOpen} onOpenChange={setModalNovaEtapaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cadastrar Nova Etapa
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarEtapa} className="space-y-3 pt-1">
            <div>
              <Label htmlFor="etapaNome">Nome da Etapa *</Label>
              <Input
                id="etapaNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Concepção Estrutural"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="disc">Disciplina</Label>
                <Input
                  id="disc"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  placeholder="Ex: Estrutura"
                />
              </div>

              <div>
                <Label>Tipo de Execução</Label>
                <Select
                  value={tipoExecucao}
                  onValueChange={(val: TipoExecucaoEtapa) => setTipoExecucao(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direta">Direta (Interna)</SelectItem>
                    <SelectItem value="terceirizada">Terceirizada</SelectItem>
                    <SelectItem value="mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tipoExecucao !== 'direta' && (
              <div>
                <Label>Executor Vinculado (Opcional ou via Cotação)</Label>
                <Select value={executorId} onValueChange={setExecutorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou deixe para cotar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Sem executor (Iniciar via Cotação) --</SelectItem>
                    {executores
                      .filter((ex) => ex.status !== 'suspenso')
                      .map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.nome} ({ex.conselho || 'S/Conselho'} - Nota: {ex.nota_geral || 'N/A'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prazoEtapa">Prazo</Label>
                <Input
                  id="prazoEtapa"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>

              <div>
                <Label>Status Inicial</Label>
                <Select value={status} onValueChange={(val: StatusEtapa) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_iniciar">A Iniciar</SelectItem>
                    <SelectItem value="cotacao">Em Cotação</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNovaEtapaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Etapa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Aplicar Modelo Padrão por Disciplina */}
      <Dialog open={modalModelosOpen} onOpenChange={setModalModelosOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Aplicar Modelo Padrão por Disciplina
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Gera automaticamente a sequência padrão de etapas configurada em Parâmetros.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label>Selecione a Disciplina</Label>
              <Select
                value={modeloSelecionadoIndex}
                onValueChange={(val) => setModeloSelecionadoIndex(val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelosDisponiveis.map((m, idx) => (
                    <SelectItem key={m.disciplina} value={String(idx)}>
                      {m.disciplina} ({m.etapas.length} etapas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {modelosDisponiveis[parseInt(modeloSelecionadoIndex, 10)] && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-semibold text-slate-700 block mb-2">
                  Etapas que serão adicionadas:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                  {modelosDisponiveis[parseInt(modeloSelecionadoIndex, 10)].etapas.map((et, i) => (
                    <li key={i}>{et}</li>
                  ))}
                </ol>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalModelosOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAplicarModelo}
                disabled={salvando || modelosDisponiveis.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Inserir Etapas Sequenciais
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
