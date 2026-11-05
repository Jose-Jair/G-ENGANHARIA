import React, { useState } from 'react'
import { ModalPadrao } from '@/components/comum/ModalPadrao'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Copy, MessageCircle, Mail, Clock, AlertTriangle, Send } from 'lucide-react'
import { clientesPfService, ClientePfRecord, CriarConviteResponse } from '@/services/clientesPf'
import { getWaDigitsOnly } from '@/lib/phone'

interface ModalEnviarLinkCadastroProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  onSuccess: () => void
}

const MENSAGEM_WHATSAPP_EXATA = (primeiroNome: string, link: string) =>
  `Olá, ${primeiroNome}! Aqui é da G+ ENGENHARIA. Para darmos andamento, complete seu cadastro neste link (válido por 7 dias): ${link}`

export function ModalEnviarLinkCadastro({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: ModalEnviarLinkCadastroProps) {
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(false)
  const [linkConvite, setLinkConvite] = useState<string | null>(null)
  const [expiraEm, setExpiraEm] = useState<string | null>(null)
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [confirmandoEmail, setConfirmandoEmail] = useState(false)
  const [confirmandoReenvio, setConfirmandoReenvio] = useState(false)

  const primeiroNome = (cliente?.nome || '').trim().split(/\s+/)[0] || 'cliente'
  const temEmail = Boolean((cliente?.email || '').trim())

  // 1º telefone marcado como WhatsApp (lista telefones) ou, na falta, o telefone simples
  const telefoneWhatsapp = (() => {
    const lista = cliente?.telefones || []
    const wa = lista.find((t) => t.whatsapp)
    return wa?.numero || cliente?.telefone || ''
  })()

  const gerarLink = async () => {
    if (!cliente) return
    setCarregando(true)
    try {
      // NUNCA envia e-mail aqui — enviar_email: false cria o convite só com o link
      const resp = await clientesPfService.criarConvite(cliente.id, { enviar_email: false })
      setLinkConvite(resp.link)
      setExpiraEm(resp.expira_em)
      setEmailEnviado(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar o link de cadastro.'
      toast({
        title: 'Erro ao gerar o link',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  const copiarLink = async () => {
    if (!linkConvite) return
    try {
      await navigator.clipboard.writeText(linkConvite)
      toast({ title: 'Link copiado!', description: 'Cole no chat com o cliente.' })
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione e copie o link manualmente.',
        variant: 'destructive',
      })
    }
  }

  const abrirWhatsApp = () => {
    if (!linkConvite || !telefoneWhatsapp) return
    const url = `https://wa.me/${getWaDigitsOnly(telefoneWhatsapp)}?text=${encodeURIComponent(
      MENSAGEM_WHATSAPP_EXATA(primeiroNome, linkConvite),
    )}`
    window.open(url, '_blank', 'noopener')
  }

  const handleAbrirClienteEmail = () => {
    if (!linkConvite || !temEmail) return
    const assunto = encodeURIComponent('Complete o seu cadastro — G+ ENGENHARIA')
    const corpo = encodeURIComponent(
      `Olá, ${primeiroNome}!\n\n` +
        'Para darmos andamento, complete seu cadastro neste link (válido por 7 dias):\n' +
        linkConvite +
        '\n\nEste link é pessoal e de uso único.\n\nG+ ENGENHARIA',
    )
    window.location.href = `mailto:${cliente?.email}?subject=${assunto}&body=${corpo}`
    setEmailEnviado(true)
  }

  const handleReenviarEmail = async () => {
    if (!cliente) return
    setCarregando(true)
    try {
      const resp = await clientesPfService.criarConvite(cliente.id, { enviar_email: true })
      setLinkConvite(resp.link)
      setExpiraEm(resp.expira_em)
      setEmailEnviado(Boolean(resp.email_enviado))
      setConfirmandoReenvio(false)
      onSuccess()
      if (resp.email_enviado) {
        toast({
          title: 'Convite reenviado por e-mail',
          description: `E-mail de convite disparado para ${cliente.email}.`,
        })
      } else {
        toast({
          title: 'Convite recriado, mas o e-mail não saiu',
          description:
            'O sistema não conseguiu disparar o e-mail agora. Use "Copiar link" ou "WhatsApp".',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao reenviar o convite.'
      toast({ title: 'Erro ao reenviar', description: msg, variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }

  return (
    <ModalPadrao
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="sm:max-w-lg"
      title={
        <span className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Send className="w-4.5 h-4.5 text-[#D95A2B]" />
          Enviar link de cadastro
        </span>
      }
      description={
        cliente
          ? `Cliente: ${cliente.nome}${cliente.cpf ? ` — CPF ${cliente.cpf}` : ' (sem CPF ainda — o cliente informa no link)'}`
          : undefined
      }
      footer={
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      }
    >
      {!linkConvite ? (
        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-snug flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ao gerar um novo link, qualquer convite anterior <strong>ativo</strong> deste cliente
              será <strong>cancelado</strong> automaticamente. O novo link fica válido por 7 dias e
              é de uso único.
            </span>
          </div>
          <Button
            onClick={gerarLink}
            disabled={carregando}
            className="w-full bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs"
          >
            {carregando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Gerando link...
              </>
            ) : (
              'Gerar link de cadastro'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">
              Link de cadastro
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-slate-100 border border-slate-200 rounded px-2 py-2 break-all select-all">
                {linkConvite}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copiarLink}
                className="h-9 shrink-0 gap-1.5 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar link
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Validade: 7 dias, uso único{expiraEm ? ` (expira em ${expiraEm.slice(0, 10)})` : ''}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-snug flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ao gerar um novo link, qualquer convite anterior <strong>ativo</strong> deste cliente
              será <strong>cancelado</strong> automaticamente.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              onClick={abrirWhatsApp}
              disabled={!telefoneWhatsapp}
              className="justify-start gap-2 text-xs h-9 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              WhatsApp
              {!telefoneWhatsapp && (
                <span className="text-[10px] text-slate-400">(sem telefone cadastrado)</span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                if (!emailEnviado) setConfirmandoEmail(true)
                else setConfirmandoReenvio(true)
              }}
              disabled={!temEmail}
              className="justify-start gap-2 text-xs h-9 border-blue-200 text-blue-800 hover:bg-blue-50"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              {emailEnviado ? 'Reenviar por e-mail' : 'Enviar por e-mail'}
              {!temEmail && (
                <span className="text-[10px] text-slate-400">(cliente sem e-mail)</span>
              )}
            </Button>

            {emailEnviado && (
              <div className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  Aberto no seu cliente de e-mail
                </Badge>
                Confirme o envio no aplicativo de e-mail.
              </div>
            )}
          </div>

          {/* Confirmação antes do primeiro envio por e-mail */}
          {confirmandoEmail && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-2">
              <p className="text-xs text-slate-700">
                Confirmar o envio do convite por e-mail para <strong>{cliente?.email}</strong>? O
                sistema registrará o disparo em auditoria.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  onClick={handleAbrirClienteEmail}
                >
                  Confirmar e abrir e-mail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmandoEmail(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Confirmação de reenvio (gera novo convite via backend) */}
          {confirmandoReenvio && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <p className="text-xs text-slate-700">
                Reenviar por e-mail gera um <strong>novo convite</strong> (o link anterior ativo
                será cancelado) e dispara o e-mail para <strong>{cliente?.email}</strong>.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  disabled={carregando}
                  onClick={handleReenviarEmail}
                >
                  {carregando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Confirmar reenvio'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmandoReenvio(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalPadrao>
  )
}
