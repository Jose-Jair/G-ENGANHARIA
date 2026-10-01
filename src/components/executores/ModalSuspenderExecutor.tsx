import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { executoresService } from '@/services/executores'
import { ExecutorRecord } from '@/types'
import { AlertOctagon, Loader2 } from 'lucide-react'

interface ModalSuspenderExecutorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executor: ExecutorRecord | null
  onSuccess: () => void
}

export const ModalSuspenderExecutor: React.FC<ModalSuspenderExecutorProps> = ({
  open,
  onOpenChange,
  executor,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  React.useEffect(() => {
    if (open) {
      setMotivo('')
    }
  }, [open])

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!executor) return
    if (!motivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo detalhado para a suspensão do executor.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await executoresService.alterarStatus(executor.id, 'suspenso', motivo.trim())
      toast({
        title: 'Executor suspenso com sucesso!',
        description: 'O bloqueio no servidor impedirá qualquer nova alocação deste executor.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao suspender',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-rose-950 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            Suspender Executor
          </DialogTitle>
          <p className="text-xs text-slate-500">
            A suspensão bloqueia imediatamente a alocação em novas etapas de projetos no servidor.
          </p>
        </DialogHeader>

        <form onSubmit={handleConfirmar} className="space-y-4 pt-2">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
            Você está prestes a suspender <strong>{executor?.nome}</strong> ({executor?.conselho}{' '}
            {executor?.numero_registro}). Esta ação é totalmente auditada.
          </div>

          <div>
            <Label htmlFor="motivo">Motivo da Suspensão *</Label>
            <Textarea
              id="motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Atraso recorrente nos entregáveis, recusa de retrabalho ou irregularidade no conselho de classe..."
              required
              className="mt-1"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Suspensão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
