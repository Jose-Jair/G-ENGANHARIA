import React, { useState, useEffect } from 'react'
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
import { Calendar, Clock, CalendarDays } from 'lucide-react'

interface ProximaAcaoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaNome: string
  currentDate?: string
  currentDesc?: string
  onSave: (data: string | undefined, desc: string | undefined) => Promise<void>
}

export function ProximaAcaoModal({
  open,
  onOpenChange,
  empresaNome,
  currentDate,
  currentDesc,
  onSave,
}: ProximaAcaoModalProps) {
  const [dataAcao, setDataAcao] = useState('')
  const [horaAcao, setHoraAcao] = useState('09:00')
  const [descAcao, setDescAcao] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (currentDate) {
        try {
          const d = new Date(currentDate)
          setDataAcao(d.toISOString().slice(0, 10))
          setHoraAcao(d.toISOString().slice(11, 16))
        } catch (_) {
          setDataAcao('')
          setHoraAcao('09:00')
        }
      } else {
        // Sugere amanhã
        const amanha = new Date(Date.now() + 24 * 3600 * 1000)
        setDataAcao(amanha.toISOString().slice(0, 10))
        setHoraAcao('09:00')
      }
      setDescAcao(currentDesc || '')
    }
  }, [open, currentDate, currentDesc])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let isoString: string | undefined = undefined
      if (dataAcao) {
        const timePart = horaAcao || '09:00'
        isoString = new Date(`${dataAcao}T${timePart}:00.000Z`).toISOString()
      }
      await onSave(isoString, descAcao.trim() || undefined)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setLoading(true)
    try {
      await onSave(undefined, undefined)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <CalendarDays className="w-5 h-5" />
              <DialogTitle>Próxima Ação Comercial</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Agende ou edite a próxima intervenção manual de prospecção para{' '}
              <strong className="text-slate-800">{empresaNome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">
                  Data Prevista
                </Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dataAcao}
                    onChange={(e) => setDataAcao(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Horário</Label>
                <div className="relative">
                  <Input
                    type="time"
                    value={horaAcao}
                    onChange={(e) => setHoraAcao(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1">
                Descrição da Ação
              </Label>
              <Textarea
                placeholder="Ex.: Ligar para o Eng. Responsável para apresentar portfólio de pontes e contenções..."
                value={descAcao}
                onChange={(e) => setDescAcao(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            {currentDesc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={loading}
                className="text-slate-500 hover:text-red-600 mr-auto"
              >
                Limpar Ação
              </Button>
            )}
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
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Salvando...' : 'Salvar Ação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
