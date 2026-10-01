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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { projetosService } from '@/services/projetos'
import { SaudeProjeto } from '@/types'
import { Loader2 } from 'lucide-react'

interface ModalSaudeProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string
  codigoProjeto: string
  saudeAtual?: SaudeProjeto
  justificativaAtual?: string
  onSuccess: () => void
}

export const ModalSaudeProjeto: React.FC<ModalSaudeProjetoProps> = ({
  open,
  onOpenChange,
  projetoId,
  codigoProjeto,
  saudeAtual = 'verde',
  justificativaAtual = '',
  onSuccess,
}) => {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [saude, setSaude] = useState<SaudeProjeto>(saudeAtual)
  const [justificativa, setJustificativa] = useState(justificativaAtual)

  React.useEffect(() => {
    setSaude(saudeAtual)
    setJustificativa(justificativaAtual || '')
  }, [open, saudeAtual, justificativaAtual])

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!justificativa.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'O Gestor deve fornecer uma justificativa para o status da saúde do projeto.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await projetosService.updateSaude(projetoId, saude, justificativa.trim())
      toast({ title: 'Saúde do projeto atualizada com sucesso!' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar saúde',
        description: err.message || 'Falha ao atualizar registro no banco',
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
          <DialogTitle className="text-lg font-bold text-slate-900">
            Atualizar Saúde — {codigoProjeto}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Definida pelo Gestor de Projetos com justificativa obrigatória auditada.
          </p>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-2">
          <div>
            <Label>Indicador de Saúde</Label>
            <Select value={saude} onValueChange={(val: SaudeProjeto) => setSaude(val)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verde">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-semibold text-emerald-800">
                      Verde — No Prazo / Estável
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="amarelo">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span className="font-semibold text-amber-800">
                      Amarelo — Atenção / Risco de Prazo
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="vermelho">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    <span className="font-semibold text-rose-800">
                      Vermelho — Crítico / Bloqueado / Atraso
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="justificativa">Justificativa do Gestor *</Label>
            <Textarea
              id="justificativa"
              rows={4}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique os motivos que justificam esta classificação de saúde..."
              required
              className="mt-1"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Classificação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
