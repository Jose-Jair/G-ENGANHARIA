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
import { useToast } from '@/hooks/use-toast'
import { executoresService, ConvidarExecutorResponse } from '@/services/executores'
import { Mail, Send, Copy, Check, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { isValidEmail } from '@/lib/cnpj'

interface ModalConvidarExecutorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ModalConvidarExecutor: React.FC<ModalConvidarExecutorProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [conviteGerado, setConviteGerado] = useState<ConvidarExecutorResponse | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erroMsg, setErroMsg] = useState('')

  const handleReset = () => {
    setNome('')
    setEmail('')
    setConviteGerado(null)
    setCopiado(false)
    setErroMsg('')
    setEnviando(false)
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  const handleEnviarConvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroMsg('')

    const nomeTrim = nome.trim()
    const emailTrim = email.trim().toLowerCase()

    if (!nomeTrim) {
      setErroMsg('Informe o nome completo ou razão social do executor.')
      return
    }

    if (!emailTrim || !isValidEmail(emailTrim)) {
      setErroMsg('Informe um endereço de e-mail válido.')
      return
    }

    setEnviando(true)
    try {
      const resp = await executoresService.convidar({
        nome: nomeTrim,
        email: emailTrim,
      })

      setConviteGerado(resp)
      toast({
        title: 'Convite enviado com sucesso!',
        description: `Link único gerado para ${nomeTrim} (${emailTrim}). Auditoria registrada.`,
      })
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      const msg = err.message || 'Falha ao convidar executor.'
      setErroMsg(msg)
      toast({
        title: 'Erro ao convidar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!conviteGerado?.link_cadastro) return
    try {
      await navigator.clipboard.writeText(conviteGerado.link_cadastro)
      setCopiado(true)
      toast({ title: 'Link copiado para a área de transferência!' })
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione o link manualmente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Convidar Novo Executor Externo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dispare um convite por e-mail com link único e seguro para auto-credenciamento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {conviteGerado ? (
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-emerald-950">
                  Convite criado e cadastrado em Homologação!
                </p>
                <p className="text-emerald-800">
                  Um e-mail foi preparado e enviado para <strong>{conviteGerado.email}</strong> com
                  as instruções e o link seguro de preenchimento.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">
                Link Exclusivo de Cadastro (Expira em 7 dias):
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={conviteGerado.link_cadastro}
                  className="text-xs font-mono bg-slate-50 select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopiarLink}
                  className="shrink-0 h-9 text-xs"
                >
                  {copiado ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                Você também pode enviar este link diretamente por WhatsApp ou mensagem ao parceiro.
              </p>
            </div>

            <DialogFooter className="pt-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                Convidar Outro
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-xs text-white"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleEnviarConvite} className="space-y-4 py-2">
            {erroMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{erroMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nome-convite" className="text-xs font-medium text-slate-700">
                Nome Completo ou Razão Social <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="nome-convite"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Eng. Carlos Roberto Silva ou Estruturas BR Ltda"
                className="text-xs"
                disabled={enviando}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-convite" className="text-xs font-medium text-slate-700">
                E-mail do Executor <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="email-convite"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos.engenharia@exemplo.com.br"
                className="text-xs"
                disabled={enviando}
              />
              <p className="text-[11px] text-slate-500">
                O executor receberá um link protegido para preencher CREA/CAU, disciplinas, dados
                bancários e capacidade.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Fluxo de Homologação Automático:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  O executor é criado no sistema com status <strong>Homologação</strong>.
                </li>
                <li>Ele acessa o link sem necessidade de login prévio e submete os dados.</li>
                <li>O Administrador recebe o cadastro completo e homologa em um clique.</li>
              </ul>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={enviando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enviando}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Gerando Convite...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
