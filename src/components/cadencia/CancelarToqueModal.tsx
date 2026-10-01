import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Ban } from 'lucide-react'
import { ToqueComCalculo, MotivoRecord } from '@/types'
import { toquesService } from '@/services/toques'
import { useToast } from '@/hooks/use-toast'

interface CancelarToqueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toque: ToqueComCalculo | null
  empresaNome?: string
  motivosCancelamento: MotivoRecord[]
  onSuccess: () => void
}

export const CancelarToqueModal: React.FC<CancelarToqueModalProps> = ({
  open,
  onOpenChange,
  toque,
  empresaNome,
  motivosCancelamento,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => {
    if (open) {
      setMotivo(motivosCancelamento[0]?.descricao || 'Contato decisor não atua mais na empresa')
      setObservacao('')
    }
  }, [open, motivosCancelamento])

  if (!toque) return null

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const justificativaCompleta = observacao ? `${motivo} — ${observacao}` : motivo

    try {
      await toquesService.cancelar(toque.id, justificativaCompleta)
      toast({
        title: 'Toque Cancelado',
        description: `O Toque ${toque.numero_toque} foi marcado como cancelado e auditado.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar',
        description: err?.message || 'Falha ao registrar cancelamento do toque.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <Ban className="w-5 h-5 text-rose-600" />
            Cancelar Toque {toque.numero_toque}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Informe o motivo de cancelamento deste toque para a empresa {empresaNome}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCancel} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Motivo do Cancelamento *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione um motivo..." />
              </SelectTrigger>
              <SelectContent>
                {motivosCancelamento.map((m) => (
                  <SelectItem key={m.id} value={m.descricao}>
                    {m.descricao}
                  </SelectItem>
                ))}
                <SelectItem value="Mudança de estratégia de abordagem">
                  Mudança de estratégia de abordagem
                </SelectItem>
                <SelectItem value="Acordo direto por outro canal">
                  Acordo direto por outro canal
                </SelectItem>
                <SelectItem value="Outro motivo justificado">Outro motivo justificado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="obsCanc" className="text-xs font-semibold">
              Observações / Justificativa adicional
            </Label>
            <Textarea
              id="obsCanc"
              rows={3}
              placeholder="Descreva o contexto do cancelamento..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              variant="destructive"
              className="text-xs"
            >
              {submitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
