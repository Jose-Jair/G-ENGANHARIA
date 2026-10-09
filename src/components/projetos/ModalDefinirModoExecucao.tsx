import React, { useState } from 'react'
import { ProjetoRecord } from '@/types'
import { projetosService } from '@/services/projetos'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Wrench,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  FileCheck,
} from 'lucide-react'

interface ModalDefinirModoExecucaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord | null
  onSuccess: () => void
}

export const ModalDefinirModoExecucao: React.FC<ModalDefinirModoExecucaoProps> = ({
  open,
  onOpenChange,
  projeto,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [modo, setModo] = useState<'direta' | 'cotacao'>('cotacao')
  const [salvando, setSalvando] = useState(false)

  if (!projeto) return null

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const resp = await projetosService.definirModoExecucao(projeto.id, modo)
      toast({
        title: 'Modo de execução definido!',
        description: `Projeto ${resp.codigo} configurado como "${
          modo === 'direta' ? 'Execução Direta' : 'Cotação com Executores'
        }". Status atualizado para Em Andamento e auditoria registrada.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao definir modo de execução',
        description: err.message || 'Não foi possível salvar o modo de execução.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#D95A2B] text-white font-mono text-[10px]">
              GRUPO D • STANDBY
            </Badge>
            <span className="text-xs text-slate-500 font-mono">{projeto.codigo}</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#D95A2B]" />
            Definir Modo de Execução do Projeto
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {projeto.nome || `Projeto ${projeto.codigo}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirmar} className="space-y-4 py-2">
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Projeto em Standby:</strong> Este projeto foi gerado na assinatura bilateral
              do contrato e aguarda a definição operacional. Ao confirmar, o status passará
              automaticamente para <span className="font-semibold">Em Andamento</span> com registro
              auditado no servidor.
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">
              Escolha a Estratégia de Execução:
            </Label>

            <RadioGroup
              value={modo}
              onValueChange={(val: 'direta' | 'cotacao') => setModo(val)}
              className="grid grid-cols-1 gap-3 pt-1"
            >
              {/* Opção 1: Execução Direta */}
              <label
                htmlFor="modo-direta"
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  modo === 'direta'
                    ? 'border-[#D95A2B] bg-orange-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <RadioGroupItem value="direta" id="modo-direta" className="mt-1 text-[#D95A2B]" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-sm text-slate-900">Execução direta</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50">
                      Interna
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    A demanda será realizada internamente pelo corpo técnico e engenharia da própria
                    G+, sem necessidade de abertura de concorrência com parceiros externos.
                  </p>
                </div>
              </label>

              {/* Opção 2: Cotação com Executores */}
              <label
                htmlFor="modo-cotacao"
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  modo === 'cotacao'
                    ? 'border-[#D95A2B] bg-orange-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <RadioGroupItem value="cotacao" id="modo-cotacao" className="mt-1 text-[#D95A2B]" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#D95A2B]" />
                    <span className="font-bold text-sm text-slate-900">Cotação com executores</span>
                    <Badge variant="outline" className="text-[10px] text-orange-700 bg-orange-50">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Abre concorrência com a rede de executores homologados. O sistema sugerirá
                    automaticamente os profissionais mais aderentes por área/disciplina e nota de
                    avaliação, com disparo via WhatsApp e e-mail.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Ação permitida apenas para <strong className="text-slate-700">Administrador</strong> e{' '}
              <strong className="text-slate-700">Gestor de Projetos</strong>. Auditada como{' '}
              <code className="font-mono text-[#D95A2B]">DEFINIR_MODO_EXECUCAO</code>.
            </span>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gravando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirmar Modo de Execução
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
