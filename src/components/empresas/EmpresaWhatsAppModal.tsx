import React from 'react'
import { MessageSquare } from 'lucide-react'
import { buildWaMeUrl } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export interface EmpresaWhatsAppModalProps {
  open: boolean
  empresaNome: string
  telefoneFormatado: string
  telefoneRaw: string
  initialMessage: string
  onClose: () => void
}

export function EmpresaWhatsAppModal({
  open,
  empresaNome,
  telefoneFormatado,
  telefoneRaw,
  initialMessage,
  onClose,
}: EmpresaWhatsAppModalProps) {
  const [message, setMessage] = React.useState(initialMessage)

  React.useEffect(() => {
    setMessage(initialMessage)
  }, [initialMessage, open])

  if (!open) return null

  const handleConfirm = () => {
    if (!telefoneRaw) return
    const waUrl = buildWaMeUrl(telefoneRaw, message)
    if (waUrl) {
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-white border border-slate-200 z-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            WhatsApp — {empresaNome}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Mensagem para o telefone comercial <strong>{telefoneFormatado}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label htmlFor="waEmpEditMsg" className="text-xs text-slate-700">
            Mensagem inicial:
          </Label>
          <textarea
            id="waEmpEditMsg"
            rows={4}
            className="w-full text-xs p-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-800"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" /> Enviar no WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
