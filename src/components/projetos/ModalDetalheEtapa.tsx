import React, { useState } from 'react'
import { ProjetoEtapaRecord, TipoExecucaoEtapa, StatusEtapa, ExecutorRecord } from '@/types'
import { projetoEtapasService } from '@/services/projetoDetalhes'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  Layers,
  UserCheck,
  DollarSign,
  Clock,
  Loader2,
  Trash2,
  MessageSquareQuote,
  Star,
} from 'lucide-react'

export interface ModalDetalheEtapaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  etapa: ProjetoEtapaRecord | null
  executores?: ExecutorRecord[]
  canEdit?: boolean
  onUpdated?: () => void
  onDeleted?: () => void
  onAbrirCotacoes?: (etapa: ProjetoEtapaRecord) => void
  onAbrirAvaliacao?: (etapa: ProjetoEtapaRecord) => void
}

const STATUS_LABELS: Record<StatusEtapa, { label: string; variant: string }> = {
  a_iniciar: { label: 'A Iniciar', variant: 'bg-slate-100 text-slate-700 border-slate-300' },
  cotacao: { label: 'Em Cotação', variant: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  em_andamento: { label: 'Em Andamento', variant: 'bg-blue-100 text-blue-800 border-blue-300' },
  revisao: { label: 'Em Revisão', variant: 'bg-amber-100 text-amber-800 border-amber-300' },
  concluida: { label: 'Concluída', variant: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelada: { label: 'Cancelada', variant: 'bg-rose-100 text-rose-800 border-rose-300' },
}

// Converte string ISO ou YYYY-MM-DD para YYYY-MM-DD para input date
function toDateInputValue(val?: string | null): string {
  if (!val) return ''
  const s = String(val).trim()
  if (s.length >= 10) return s.slice(0, 10)
  return ''
}

export const ModalDetalheEtapa: React.FC<ModalDetalheEtapaProps> = ({
  open,
  onOpenChange,
  etapa,
  executores = [],
  canEdit = false,
  onUpdated,
  onDeleted,
  onAbrirCotacoes,
  onAbrirAvaliacao,
}) => {
  const { toast } = useToast()

  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Campos de edição
  const [nome, setNome] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [tipoExecucao, setTipoExecucao] = useState<TipoExecucaoEtapa>('direta')
  const [executorId, setExecutorId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [prazo, setPrazo] = useState('')
  const [custoEstimado, setCustoEstimado] = useState('')
  const [status, setStatus] = useState<StatusEtapa>('a_iniciar')

  React.useEffect(() => {
    if (etapa) {
      setNome(etapa.nome || '')
      setDisciplina(etapa.disciplina || '')
      setTipoExecucao(etapa.tipo_execucao || 'direta')
      setExecutorId(etapa.executor || '')
      setDataInicio(toDateInputValue(etapa.data_inicio))
      setPrazo(toDateInputValue(etapa.prazo || etapa.prazo_fim))
      setCustoEstimado(
        etapa.custo_estimado !== undefined && etapa.custo_estimado !== null
          ? String(etapa.custo_estimado)
          : '',
      )
      setStatus(etapa.status || 'a_iniciar')
      setEditando(false)
    }
  }, [etapa, open])

  if (!etapa) return null

  const isTerceirizada = etapa.tipo_execucao === 'terceirizada' || etapa.tipo_execucao === 'mista'
  const nomeExecutor = etapa.expand?.executor?.nome || 'Não definido / A cotar'

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return

    setSalvando(true)
    try {
      const payload: any = {
        nome: nome.trim(),
        disciplina: disciplina.trim() || null,
        tipo_execucao: tipoExecucao,
        executor: tipoExecucao !== 'direta' && executorId ? executorId : null,
        data_inicio: dataInicio ? `${dataInicio} 00:00:00.000Z` : null,
        prazo: prazo ? `${prazo} 23:59:59.000Z` : null,
        custo_estimado: custoEstimado ? parseFloat(custoEstimado) : null,
        status,
      }

      await projetoEtapasService.update(etapa.id, payload)
      toast({ title: 'Etapa atualizada com sucesso!' })
      setEditando(false)
      onUpdated?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar etapa',
        description: err.message || 'Falha ao salvar no servidor',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async () => {
    if (!confirm('Deseja realmente remover esta etapa do projeto?')) return
    setSalvando(true)
    try {
      await projetoEtapasService.delete(etapa.id)
      toast({ title: 'Etapa excluída com sucesso' })
      onOpenChange(false)
      onDeleted?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover etapa',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              Etapa #{etapa.ordem || 1}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold uppercase ${
                STATUS_LABELS[etapa.status]?.variant || 'bg-slate-100 text-slate-700'
              }`}
            >
              {STATUS_LABELS[etapa.status]?.label || etapa.status}
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold text-slate-900 mt-1">
            {etapa.nome}
          </DialogTitle>
        </DialogHeader>

        {editando ? (
          <form onSubmit={handleSalvarEdicao} className="space-y-3 pt-2">
            <div>
              <Label htmlFor="etapaNomeEdit">Nome da Etapa *</Label>
              <Input
                id="etapaNomeEdit"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="discEdit">Disciplina</Label>
                <Input
                  id="discEdit"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  placeholder="Ex: Arquitetura, Estrutura"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Tipo de Execução</Label>
                <Select
                  value={tipoExecucao}
                  onValueChange={(val: TipoExecucaoEtapa) => setTipoExecucao(val)}
                >
                  <SelectTrigger className="mt-1">
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
                <Label>Executor Vinculado</Label>
                <Select value={executorId} onValueChange={setExecutorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione ou deixe para cotar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Sem executor (Iniciar via Cotação) --</SelectItem>
                    {executores
                      .filter((ex) => ex.status !== 'suspenso')
                      .map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.nome} ({ex.conselho || 'S/Conselho'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dataInicioEdit">Data Início</Label>
                <Input
                  id="dataInicioEdit"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="prazoEdit">Prazo (Término)</Label>
                <Input
                  id="prazoEdit"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="custoEdit">Custo Estimado (R$)</Label>
                <Input
                  id="custoEdit"
                  type="number"
                  step="0.01"
                  value={custoEstimado}
                  onChange={(e) => setCustoEstimado(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: StatusEtapa) => setStatus(val)}>
                  <SelectTrigger className="mt-1">
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
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditando(false)}
                disabled={salvando}
              >
                Voltar à visualização
              </Button>
              <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Grid de Informações da Etapa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Disciplina / Área
                </span>
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  {etapa.disciplina || etapa.expand?.area?.nome || 'Geral'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Modo de Execução
                </span>
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
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Executor
                </span>
                <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{nomeExecutor}</span>
                </div>
                {etapa.expand?.executor?.nota_geral ? (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Nota média: ⭐ {etapa.expand.executor.nota_geral}
                  </span>
                ) : null}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Custo Estimado
                </span>
                <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  {etapa.custo_estimado !== undefined && etapa.custo_estimado !== null
                    ? formatCurrencyBr(etapa.custo_estimado)
                    : 'Não informado'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Data de Início
                </span>
                <div className="font-mono text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {etapa.data_inicio ? formatDateBr(etapa.data_inicio) : 'Não definida'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Prazo de Término
                </span>
                <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  {etapa.prazo || etapa.prazo_fim
                    ? formatDateBr(etapa.prazo || etapa.prazo_fim)
                    : 'Sem prazo'}
                </div>
              </div>
            </div>

            {etapa.descricao && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Descrição / Escopo da Etapa
                </span>
                {etapa.descricao}
              </div>
            )}

            {/* Ações Específicas */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {isTerceirizada && onAbrirCotacoes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onAbrirCotacoes(etapa)
                  }}
                  className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 mr-1" />
                  Cotações da Etapa
                </Button>
              )}

              {isTerceirizada && etapa.status === 'concluida' && etapa.executor && (
                <span
                  className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded"
                  title="Avaliação formal vinculada a subcontrato e medições na aba Medições"
                >
                  Avaliações agora na aba Medições
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExcluir}
                      disabled={salvando}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Excluir
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEditando(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      Editar Dados
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
