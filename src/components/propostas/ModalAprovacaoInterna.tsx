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
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ShieldAlert, FileCheck, Loader2 } from 'lucide-react'
import { PropostaRecord } from '@/types'
import { propostasService } from '@/services/propostas'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface ModalAprovacaoInternaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord | null
  currentUserId: string
  currentUserRole: string
  onApproved: (updated: PropostaRecord) => void
}

export const ModalAprovacaoInterna: React.FC<ModalAprovacaoInternaProps> = ({
  open,
  onOpenChange,
  proposta,
  currentUserId,
  currentUserRole,
  onApproved,
}) => {
  const { toast } = useToast()
  const [parecerFinanceiro, setParecerFinanceiro] = useState('')
  const [loading, setLoading] = useState(false)

  if (!proposta) return null

  const isFinanceiro = currentUserRole === 'financeiro' || currentUserRole === 'admin'
  const isAdmin = currentUserRole === 'admin'
  const isComercial = currentUserRole === 'comercial'

  const handleSalvarParecerFinanceiro = async () => {
    if (!parecerFinanceiro.trim()) {
      toast({
        variant: 'destructive',
        title: 'Parecer obrigatório',
        description: 'Informe o parecer técnico-financeiro sobre margem e fluxo.',
      })
      return
    }

    setLoading(true)
    try {
      const updated = await propostasService.update(proposta.id, {
        parecer_financeiro: parecerFinanceiro,
        aprovador_financeiro: currentUserId,
        data_aprovacao_financeira: new Date().toISOString(),
      })
      toast({
        title: 'Parecer Financeiro Registrado',
        description: 'Parecer registrado e auditado com sucesso.',
      })
      onApproved(updated)
      onOpenChange(false)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar o parecer financeiro.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAprovarProposta = async () => {
    setLoading(true)
    try {
      const payload: any = {
        status: 'enviada', // Liberada para envio
      }

      if (isAdmin) {
        payload.aprovador_admin = currentUserId
        payload.data_aprovacao_admin = new Date().toISOString()
      }

      if (parecerFinanceiro && !proposta.parecer_financeiro) {
        payload.parecer_financeiro = parecerFinanceiro
        payload.aprovador_financeiro = currentUserId
        payload.data_aprovacao_financeira = new Date().toISOString()
      }

      const updated = await propostasService.update(proposta.id, payload)
      toast({
        title: 'Proposta Aprovada Internamente',
        description: `Proposta ${proposta.numero} liberada para envio ao cliente.`,
      })
      onApproved(updated)
      onOpenChange(false)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro na aprovação',
        description: 'Falha ao processar aprovação interna da proposta.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            Aprovação Interna da Proposta {proposta.numero}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Validação de alçada de margem, preço de venda e parecer financeiro antes da emissão ao
            cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Resumo da Proposta */}
          <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Preço Total:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrencyBr(proposta.preco)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Margem de Lucro:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {proposta.margem ? `${proposta.margem}%` : 'Não calculada'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Requer Alçada Admin:</span>
              <span>
                {proposta.requer_aprovacao_admin ? (
                  <Badge variant="destructive" className="text-[10px]">
                    Sim (Acima de R$ 100k ou Margem &lt; 20%)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50">
                    Não (Alçada Comercial Padrão)
                  </Badge>
                )}
              </span>
            </div>
          </div>

          {/* Parecer do Financeiro */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              Parecer Financeiro
              {proposta.aprovador_financeiro && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Parecer Emitido
                </Badge>
              )}
            </Label>
            {isFinanceiro ? (
              <Textarea
                rows={3}
                placeholder="Insira observações sobre viabilidade, fluxo de caixa, forma de faturamento e risco..."
                value={parecerFinanceiro || proposta.parecer_financeiro || ''}
                onChange={(e) => setParecerFinanceiro(e.target.value)}
                className="text-xs"
              />
            ) : (
              <div className="p-3 bg-slate-50 border rounded text-xs text-slate-700 italic">
                {proposta.parecer_financeiro || 'Nenhum parecer financeiro registrado ainda.'}
              </div>
            )}
          </div>

          {/* Alerta de Perfil */}
          {proposta.requer_aprovacao_admin && !isAdmin && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta proposta excede o limite autônomo do Comercial. Apenas usuários com perfil
                <strong> Administrador</strong> podem aprovar e liberar para envio.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {isFinanceiro && !isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSalvarParecerFinanceiro}
                disabled={loading}
                className="text-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Salvar Parecer Financeiro
              </Button>
            )}

            {/* Botão de aprovação final (Admin ou Comercial quando dentro da alçada) */}
            {(isAdmin || (!proposta.requer_aprovacao_admin && isComercial)) && (
              <Button
                type="button"
                size="sm"
                onClick={handleAprovarProposta}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Aprovar e Liberar para Envio
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
