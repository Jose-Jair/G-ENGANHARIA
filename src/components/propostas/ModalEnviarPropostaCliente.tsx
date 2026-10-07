import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { MessageSquare, Mail, Send, Loader2, Copy, ExternalLink, CheckCircle2 } from 'lucide-react'
import { PropostaRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { cleanPhoneForWa } from '@/lib/cnpj'
import { propostasService } from '@/services/propostas'
import { parametrosService } from '@/services/parametros'
import { useToast } from '@/hooks/use-toast'
import { restoreBodyPointerEvents } from '@/lib/utils'

interface ModalEnviarPropostaClienteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord | null
  onEnvioConcluido?: () => void
}

export function ModalEnviarPropostaCliente({
  open,
  onOpenChange,
  proposta,
  onEnvioConcluido,
}: ModalEnviarPropostaClienteProps) {
  const { toast } = useToast()
  const [canal, setCanal] = useState<'whatsapp' | 'email'>('whatsapp')
  const [loading, setLoading] = useState(false)
  const [loadingTexto, setLoadingTexto] = useState(false)

  // Campos de envio
  const [destinatarioNome, setDestinatarioNome] = useState('')
  const [destinatarioTelefone, setDestinatarioTelefone] = useState('')
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [assuntoEmail, setAssuntoEmail] = useState('')
  const [mensagemTexto, setMensagemTexto] = useState('')

  useEffect(() => {
    if (!open || !proposta) return

    // Carregar dados pré-cadastrados do destinatário
    const emp = proposta.expand?.empresa
    const pf = proposta.expand?.cliente_pf

    let nome = ''
    let tel = ''
    let email = ''

    if (emp) {
      nome = emp.razao_social || emp.nome_fantasia || ''
      tel = emp.telefone || ''
      email = emp.email || ''
    } else if (pf) {
      nome = pf.nome || ''
      tel = pf.telefone || ''
      email = pf.email || ''
    }

    setDestinatarioNome(nome)
    setDestinatarioTelefone(tel)
    setDestinatarioEmail(email)

    carregarTextoPadrao(canal, nome)
  }, [open, proposta, canal])

  const carregarTextoPadrao = async (canalEscolhido: 'whatsapp' | 'email', nomeAlvo?: string) => {
    if (!proposta) return
    setLoadingTexto(true)
    try {
      const chave =
        canalEscolhido === 'whatsapp'
          ? 'texto_padrao_whatsapp_proposta'
          : 'texto_padrao_email_proposta'

      let template = await parametrosService.get(chave, '')

      const linkPublico = `${window.location.origin}/proposta/${proposta.token_aceite || ''}`
      const precoFmt = formatCurrencyBr(proposta.preco)
      const validadeData = proposta.validade ? formatDateBr(proposta.validade) : '15 dias'

      if (template) {
        template = template
          .replace(/{nome}/g, nomeAlvo || destinatarioNome || 'Cliente')
          .replace(/{numero}/g, proposta.numero)
          .replace(/{empreendimento}/g, proposta.empreendimento || 'Empreendimento')
          .replace(/{objeto}/g, proposta.objeto || proposta.escopo || 'Serviços de Engenharia')
          .replace(/{valor}/g, precoFmt)
          .replace(/{prazo}/g, proposta.prazo || '30 dias')
          .replace(/{validade}/g, validadeData)
          .replace(/{link_proposta}/g, linkPublico)
      } else {
        if (canalEscolhido === 'whatsapp') {
          template = `Olá, ${nomeAlvo || 'Cliente'}! Tudo bem?\n\nSegue o link oficial da Proposta Comercial ${proposta.numero} da G+ Engenharia para visualização e formalização:\n\n${linkPublico}\n\nFicamos à disposição!`
        } else {
          template = `Prezado(a) ${nomeAlvo || 'Cliente'},\n\nApresentamos nossa proposta técnica e comercial ${proposta.numero}.\n\nPara visualizar o detalhamento completo e formalizar o aceite eletrônico, acesse o link:\n${linkPublico}\n\nAtenciosamente,\nG+ Engenharia Consultiva`
        }
      }

      setMensagemTexto(template)
      if (canalEscolhido === 'email') {
        setAssuntoEmail(`Proposta Comercial ${proposta.numero} — G+ Engenharia`)
      }
    } catch (err) {
      console.warn('Erro ao carregar texto padrão de envio:', err)
    } finally {
      setLoadingTexto(false)
    }
  }

  const handleEnviar = async () => {
    if (!proposta) return

    setLoading(true)
    try {
      if (canal === 'whatsapp') {
        const telLimpo = cleanPhoneForWa(destinatarioTelefone)
        if (!telLimpo || telLimpo.length < 10) {
          toast({
            title: 'Telefone inválido',
            description: 'Informe um número de WhatsApp válido com DDD para envio.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        // Auditar o envio via endpoint de auditoria do backend
        await propostasService.registrarEnvioWhatsApp({
          propostaId: proposta.id,
          destinatarioTelefone: telLimpo,
          destinatarioNome,
        })

        // Abrir WhatsApp Web com mensagem codificada
        const textoEncoded = encodeURIComponent(mensagemTexto)
        const waUrl = `https://wa.me/55${telLimpo.replace(/^55/, '')}?text=${textoEncoded}`
        window.open(waUrl, '_blank', 'noopener,noreferrer')

        toast({
          title: 'Envio via WhatsApp iniciado',
          description: 'A janela de conversa foi aberta e o evento foi auditado com sucesso.',
        })

        if (onEnvioConcluido) onEnvioConcluido()
        onOpenChange(false)
        restoreBodyPointerEvents()
      } else {
        // Envio via E-mail Transacional Real
        if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
          toast({
            title: 'E-mail inválido',
            description: 'Por favor, informe um endereço de e-mail válido.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        await propostasService.enviarPorEmail({
          propostaId: proposta.id,
          destinatarioEmail,
          destinatarioNome,
          assunto: assuntoEmail,
          corpo: mensagemTexto,
        })

        toast({
          title: 'E-mail enviado com sucesso!',
          description: `A proposta foi enviada para ${destinatarioEmail} e a ação foi auditada.`,
        })

        if (onEnvioConcluido) onEnvioConcluido()
        onOpenChange(false)
        restoreBodyPointerEvents()
      }
    } catch (err: any) {
      console.error('Erro no envio da proposta:', err)
      toast({
        title: 'Erro ao enviar proposta',
        description: err.message || 'Ocorreu um erro no processamento do envio.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!proposta) return null

  const linkProposta = `${window.location.origin}/proposta/${proposta.token_aceite || ''}`

  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        if (!op) restoreBodyPointerEvents()
        onOpenChange(op)
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-600" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Enviar Proposta ao Cliente
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Envio oficial da proposta validada <strong>{proposta.numero}</strong> via canal
            pré-cadastrado com texto padrão editável e registro de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Seleção do Canal */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Selecione o Canal de Envio:
            </Label>
            <RadioGroup
              value={canal}
              onValueChange={(val: 'whatsapp' | 'email') => setCanal(val)}
              className="grid grid-cols-2 gap-3 mt-1.5"
            >
              <label
                htmlFor="canal-wa"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  canal === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="whatsapp" id="canal-wa" />
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Oficial</span>
              </label>

              <label
                htmlFor="canal-email"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  canal === 'email'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="email" id="canal-email" />
                <Mail className="w-4 h-4 text-blue-600" />
                <span>E-mail Transacional</span>
              </label>
            </RadioGroup>
          </div>

          {/* Dados do Destinatário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
            <div>
              <Label className="text-[11px] text-slate-600">Nome do Contato / Destinatário:</Label>
              <Input
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="h-8 text-xs mt-1 bg-white"
              />
            </div>

            {canal === 'whatsapp' ? (
              <div>
                <Label className="text-[11px] text-slate-600">Telefone / WhatsApp (com DDD):</Label>
                <Input
                  value={destinatarioTelefone}
                  onChange={(e) => setDestinatarioTelefone(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="h-8 text-xs mt-1 bg-white"
                />
              </div>
            ) : (
              <div>
                <Label className="text-[11px] text-slate-600">E-mail do Destinatário:</Label>
                <Input
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value)}
                  placeholder="cliente@empresa.com.br"
                  className="h-8 text-xs mt-1 bg-white"
                />
              </div>
            )}
          </div>

          {/* Assunto se for E-mail */}
          {canal === 'email' && (
            <div>
              <Label className="text-xs font-semibold text-slate-700">Assunto do E-mail:</Label>
              <Input
                value={assuntoEmail}
                onChange={(e) => setAssuntoEmail(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          )}

          {/* Mensagem com Texto Padrão Editável */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold text-slate-700">
                Corpo da Mensagem (editável antes do disparo):
              </Label>
              <span className="text-[10px] text-slate-400">
                Padrão configurável no menu Administração
              </span>
            </div>
            <Textarea
              rows={8}
              value={mensagemTexto}
              onChange={(e) => setMensagemTexto(e.target.value)}
              disabled={loadingTexto}
              className="text-xs font-sans leading-relaxed"
            />
          </div>

          {/* Link público gerado */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="truncate text-[11px] text-orange-950">
              <strong className="block text-[10px] uppercase text-orange-700">
                Link Seguro do Cliente:
              </strong>
              <span className="font-mono">{linkProposta}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white text-orange-800 border-orange-300 hover:bg-orange-100 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(linkProposta)
                toast({ title: 'Link copiado!' })
              }}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copiar
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              restoreBodyPointerEvents()
              onOpenChange(false)
            }}
            disabled={loading}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleEnviar}
            disabled={loading || loadingTexto}
            className={`text-xs gap-1.5 font-semibold text-white ${
              canal === 'whatsapp'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processando...
              </>
            ) : canal === 'whatsapp' ? (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                Abrir WhatsApp e Auditar Envio
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" />
                Disparar E-mail Transacional
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
