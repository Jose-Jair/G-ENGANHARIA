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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ShieldAlert, Trash2, Loader2, Info } from 'lucide-react'
import { ClientePfRecord, PropostaRecord } from '@/types'
import { clientesPfService } from '@/services/clientesPf'
import { useToast } from '@/hooks/use-toast'

interface ModalExcluirAnonimizarClientePfProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  propostas: PropostaRecord[]
  onSuccess: () => void
}

export function ModalExcluirAnonimizarClientePf({
  open,
  onOpenChange,
  cliente,
  propostas,
  onSuccess,
}: ModalExcluirAnonimizarClientePfProps) {
  const { toast } = useToast()
  const [confirmacaoNome, setConfirmacaoNome] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!cliente) return null

  // Verifica propostas vinculadas a este cliente
  const propostasVinculadas = propostas.filter((p) => p.cliente_pf === cliente.id)
  const temPropostas = propostasVinculadas.length > 0

  const nomeExato = (cliente.nome || '').trim()
  const podeConfirmar = confirmacaoNome.trim().toLowerCase() === nomeExato.toLowerCase()

  const handleConfirmar = async () => {
    if (!podeConfirmar) return

    setSubmitting(true)
    try {
      const res = await clientesPfService.excluirOuAnonimizar(cliente.id, confirmacaoNome.trim())

      if (res.acao === 'anonimizado') {
        toast({
          title: 'Cliente Anonimizado (LGPD)',
          description:
            res.mensagem ||
            'Como o cliente possui propostas vinculadas, os dados pessoais (CPF, e-mail, telefones, endereço) foram apagados e o nome foi anonimizado para manter o histórico fiscal e contratual.',
        })
      } else {
        toast({
          title: 'Cliente Excluído',
          description:
            res.mensagem ||
            'Cliente sem propostas excluído permanentemente com registro em auditoria.',
        })
      }

      setConfirmacaoNome('')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro na operação',
        description:
          err instanceof Error ? err.message : 'Falha ao processar exclusão/anonimização.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (v: boolean) => {
    if (!submitting) {
      setConfirmacaoNome('')
      onOpenChange(v)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            {temPropostas ? (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <DialogTitle className="text-base text-slate-900">
              {temPropostas
                ? 'Anonimização LGPD de Cliente PF'
                : 'Exclusão Permanente de Cliente PF'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Ação restrita ao perfil <strong>Administrador</strong> com rastreabilidade compulsória
            na trilha de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs">
          {temPropostas ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-amber-950 font-semibold">
                    Cliente possui {propostasVinculadas.length} proposta(s) vinculada(s)
                  </strong>
                  <p className="text-[11px] mt-1 leading-relaxed text-amber-900">
                    Por exigência legal e regulatória (fiscal/contratual), o registro não será
                    apagado do banco para não romper vínculos financeiros e projetos.
                  </p>
                </div>
              </div>
              <div className="pt-1.5 border-t border-amber-200 text-[11px] space-y-1">
                <p className="font-semibold text-amber-950">Comportamento LGPD aplicado:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-900 pl-1">
                  <li>
                    CPF, telefones, e-mail e endereços serão <strong>apagados</strong>{' '}
                    permanentemente;
                  </li>
                  <li>
                    Nome será substituído por: <em>&quot;Cliente removido a pedido (LGPD)&quot;</em>
                    ;
                  </li>
                  <li>
                    Evento <strong>ANONIMIZACAO_CLIENTE_PF</strong> registrado em auditoria com IP e
                    usuário.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-2 text-rose-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-rose-950 font-semibold">
                    Cliente sem propostas vinculadas
                  </strong>
                  <p className="text-[11px] mt-1 leading-relaxed text-rose-900">
                    O cadastro será <strong>excluído permanentemente</strong> do banco de dados.
                    Esta operação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-rose-800 pt-1 border-t border-rose-200">
                Evento <strong>EXCLUSAO_CLIENTE_PF</strong> será registrado na auditoria imutável.
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="text-[11px] text-slate-500 block">Cliente selecionado:</span>
            <div className="font-semibold text-slate-900 text-sm flex items-center justify-between">
              <span>{cliente.nome}</span>
              {cliente.pre_cadastro && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                >
                  Pré-cadastro
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-slate-700">
              Dupla confirmação: digite exatamente o nome{' '}
              <strong className="text-slate-900 font-mono select-all bg-slate-100 px-1 py-0.5 rounded">
                {cliente.nome}
              </strong>{' '}
              para liberar a ação:
            </Label>
            <Input
              value={confirmacaoNome}
              onChange={(e) => setConfirmacaoNome(e.target.value)}
              placeholder="Digite o nome exato aqui..."
              className="text-xs h-9 bg-white font-medium"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={submitting}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!podeConfirmar || submitting}
            onClick={handleConfirmar}
            className={
              temPropostas
                ? 'bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5'
                : 'bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5'
            }
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : temPropostas ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {temPropostas ? 'Confirmar Anonimização LGPD' : 'Confirmar Exclusão Permanente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
