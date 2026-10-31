import React, { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { XCircle, ShieldAlert } from 'lucide-react'

interface ModalDescarteLoteProps {
  open: boolean
  totalSelecionados: number
  onClose: () => void
  onConfirmar: (motivo: string) => void
  loading?: boolean
}

export function ModalDescarteLote({
  open,
  totalSelecionados,
  onClose,
  onConfirmar,
  loading = false,
}: ModalDescarteLoteProps) {
  const [motivo, setMotivo] = useState('')

  const handleConfirmar = () => {
    if (!motivo.trim()) return
    onConfirmar(motivo.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <XCircle className="w-5 h-5" />
            <DialogTitle>Descartar Sugestões em Lote</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1">
            Você está descartando <strong>{totalSelecionados}</strong> sugestão(ões) selecionada(s).
            Os dados identificadores (CNPJ, CNAE e objeto) serão registrados na{' '}
            <strong>Lista de Exclusão de Prospecção</strong> para não serem recriados em varreduras
            futuras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Aviso de Conformidade:</strong> O descarte de sugestão é uma decisão
              operacional de triagem que exclui o CNPJ/CNAE/objeto da prospecção futura e{' '}
              <strong>NÃO é opt-out LGPD</strong>. Este descarte não alimenta a lista "Não Contatar"
              (destinada exclusivamente à manifestação do titular de dados).
            </span>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Motivo do Descarte <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Ex: Escopo fora da atuação da intermediação, objeto de baixo valor, fora do perfil de terceirização..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={loading || !motivo.trim()}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? 'Processando...' : `Confirmar Descarte (${totalSelecionados})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
