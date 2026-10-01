import React, { useState } from 'react'
import { RiscoRecord, ProbabilidadeRisco, ImpactoRisco, StatusRisco } from '@/types'
import { riscosService, CreateRiscoData } from '@/services/projetoDetalhes'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, AlertTriangle, ShieldCheck, Flame, Trash2, Loader2 } from 'lucide-react'

interface RiscosTabProps {
  projetoId: string
  riscos: RiscoRecord[]
  canEdit: boolean
  onRefresh: () => void
}

export const RiscosTab: React.FC<RiscosTabProps> = ({ projetoId, riscos, canEdit, onRefresh }) => {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form states
  const [descricao, setDescricao] = useState('')
  const [probabilidade, setProbabilidade] = useState<ProbabilidadeRisco>('media')
  const [impacto, setImpacto] = useState<ImpactoRisco>('medio')
  const [mitigacao, setMitigacao] = useState('')
  const [status, setStatus] = useState<StatusRisco>('aberto')

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Descreva o risco.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateRiscoData = {
        projeto: projetoId,
        descricao: descricao.trim(),
        probabilidade,
        impacto,
        mitigacao: mitigacao.trim() || undefined,
        status,
      }

      await riscosService.create(payload)
      toast({ title: 'Risco registrado com sucesso!' })
      setModalOpen(false)
      limparForm()
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao registrar risco', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const handleAlterarStatus = async (item: RiscoRecord, novoStatus: StatusRisco) => {
    try {
      await riscosService.update(item.id, { status: novoStatus })
      toast({ title: `Status do risco alterado para ${novoStatus}` })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja excluir este risco?')) return
    try {
      await riscosService.delete(id)
      toast({ title: 'Risco excluído' })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const limparForm = () => {
    setDescricao('')
    setProbabilidade('media')
    setImpacto('medio')
    setMitigacao('')
    setStatus('aberto')
  }

  // Riscos com probabilidade alta e impacto alto (Risco Crítico Alto/Alto)
  const riscosCriticos = riscos.filter(
    (r) => r.probabilidade === 'alta' && r.impacto === 'alto' && r.status === 'aberto',
  )

  return (
    <div className="space-y-4">
      {/* Alerta de Risco Crítico Alto/Alto */}
      {riscosCriticos.length > 0 && (
        <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-lg flex items-center gap-3 animate-pulse">
          <Flame className="w-6 h-6 text-rose-600 shrink-0" />
          <div className="text-xs text-rose-950">
            <span className="font-bold uppercase tracking-wider">
              Atenção: Risco Alto / Alto em Aberto!
            </span>
            <p className="mt-0.5 text-rose-800">
              Existe(m) {riscosCriticos.length} risco(s) classificado(s) com Probabilidade Alta e
              Impacto Alto. Plano de mitigação imediato requerido pelo Gestor.
            </p>
          </div>
        </div>
      )}

      {/* Barra de Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Matriz de Riscos do Projeto ({riscos.length})
          </h3>
          <p className="text-xs text-slate-500">
            Mapeamento preventivo: Probabilidade × Impacto com destaque visual para Riscos Altos.
          </p>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              limparForm()
              setModalOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Risco
          </Button>
        )}
      </div>

      {/* Grid de Riscos */}
      {riscos.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-lg">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhum risco mapeado</p>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre interferências, atrasos de aprovação em órgãos públicos ou riscos de
            fornecimento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {riscos.map((risco) => {
            const isCritico =
              risco.probabilidade === 'alta' &&
              risco.impacto === 'alto' &&
              risco.status === 'aberto'

            return (
              <div
                key={risco.id}
                className={`p-4 rounded-lg border transition-all ${
                  isCritico
                    ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCritico ? (
                      <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <h4
                      className={`font-semibold text-sm ${
                        isCritico ? 'text-rose-950 font-bold' : 'text-slate-900'
                      }`}
                    >
                      {risco.descricao}
                    </h4>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold shrink-0 ${
                      risco.status === 'aberto'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : risco.status === 'mitigado'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {risco.status}
                  </Badge>
                </div>

                {/* Tags de Probabilidade e Impacto */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      risco.probabilidade === 'alta'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : risco.probabilidade === 'media'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    Probabilidade: <strong className="ml-1 uppercase">{risco.probabilidade}</strong>
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      risco.impacto === 'alto'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : risco.impacto === 'medio'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    Impacto: <strong className="ml-1 uppercase">{risco.impacto}</strong>
                  </Badge>
                </div>

                {risco.mitigacao && (
                  <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200/80 rounded text-xs text-slate-700">
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      Ação de Mitigação:
                    </span>
                    {risco.mitigacao}
                  </div>
                )}

                {/* Rodapé de Ações */}
                {canEdit && (
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">Alterar status:</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={risco.status}
                        onValueChange={(val: StatusRisco) => handleAlterarStatus(risco, val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="mitigado">Mitigado</SelectItem>
                          <SelectItem value="realizado">Realizado</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExcluir(risco.id)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Risco */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Novo Risco
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3 pt-1">
            <div>
              <Label htmlFor="descRisco">Descrição do Risco *</Label>
              <Textarea
                id="descRisco"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Atraso na aprovação do projeto hidrossanitário na concessionária local"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Probabilidade</Label>
                <Select
                  value={probabilidade}
                  onValueChange={(val: ProbabilidadeRisco) => setProbabilidade(val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Impacto</Label>
                <Select value={impacto} onValueChange={(val: ImpactoRisco) => setImpacto(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="mitigacao">Ação de Mitigação</Label>
              <Textarea
                id="mitigacao"
                rows={2}
                value={mitigacao}
                onChange={(e) => setMitigacao(e.target.value)}
                placeholder="Ex: Protocolar projeto com antecedência e manter contato semanal com o analista técnico..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar Risco
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
