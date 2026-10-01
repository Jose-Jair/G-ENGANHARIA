import React, { useState, useEffect } from 'react'
import { MotivoRecord } from '@/types'
import { motivosService } from '@/services/motivos'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

interface InativarEmpresaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaNome: string
  onConfirm: (motivo: string, observacao?: string) => Promise<void>
}

export function InativarEmpresaModal({
  open,
  onOpenChange,
  empresaNome,
  onConfirm,
}: InativarEmpresaModalProps) {
  const [motivos, setMotivos] = useState<MotivoRecord[]>([])
  const [selectedMotivo, setSelectedMotivo] = useState('')
  const [customMotivo, setCustomMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      setSelectedMotivo('')
      setCustomMotivo('')
      setObservacao('')
      motivosService
        .listAtivos('inativacao')
        .then((list) => {
          setMotivos(list)
          if (list.length > 0) setSelectedMotivo(list[0].descricao)
        })
        .catch((e) => console.error('Erro ao buscar motivos:', e))
    }
  }, [open])

  const handleConfirm = async () => {
    const finalMotivo = selectedMotivo === 'outro' ? customMotivo.trim() : selectedMotivo.trim()
    if (!finalMotivo) {
      setError('O motivo da inativação é obrigatório.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onConfirm(finalMotivo, observacao.trim() || undefined)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao inativar empresa. Certifique-se de possuir privilégios de Administrador.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle>Inativação de Empresa</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1">
            Ação restrita a <strong>Administradores</strong>. A empresa{' '}
            <span className="font-semibold text-slate-800">{empresaNome}</span> será movida para a
            coluna <strong>Inativa</strong> com histórico preservado para eventual reativação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Motivo da Inativação <span className="text-red-500">*</span>
            </Label>
            <select
              className="w-full text-xs border border-slate-200 rounded-md p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              value={selectedMotivo}
              onChange={(e) => setSelectedMotivo(e.target.value)}
            >
              {motivos.map((m) => (
                <option key={m.id} value={m.descricao}>
                  {m.descricao}
                </option>
              ))}
              <option value="outro">Outro motivo especificado...</option>
            </select>
          </div>

          {selectedMotivo === 'outro' && (
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1">
                Especifique o Motivo <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Descreva claramente a razão da inativação..."
                value={customMotivo}
                onChange={(e) => setCustomMotivo(e.target.value)}
                className="text-xs"
              />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1">
              Observações Adicionais (opcional)
            </Label>
            <Textarea
              placeholder="Instruções para a equipe comercial ou contexto interno..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Inativando...' : 'Confirmar Inativação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
