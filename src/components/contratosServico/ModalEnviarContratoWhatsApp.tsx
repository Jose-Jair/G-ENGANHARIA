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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ContratoServicoRecord } from '@/types'
import { contratosServicoService } from '@/services/contratosServico'
import { parametrosService } from '@/services/parametros'
import { cleanPhoneForWa, formatPhoneBr } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare, ExternalLink, Loader2, RefreshCw } from 'lucide-react'

interface ModalEnviarContratoWhatsAppProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoServicoRecord
  onEnvioConcluido?: () => void
}

export function ModalEnviarContratoWhatsApp({
  open,
  onOpenChange,
  contrato,
  onEnvioConcluido,
}: ModalEnviarContratoWhatsAppProps) {
  const { toast } = useToast()

  const [telefone, setTelefone] = useState('')
  const [destinatarioNome, setDestinatarioNome] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loadingTexto, setLoadingTexto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const publicLink = contrato.token_assinatura_cliente
    ? `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente}`
    : ''

  // Carregar dados iniciais e texto padrão configurável
  useEffect(() => {
    if (!open || !contrato) return

    // Descobrir nome e telefone do cliente
    const emp = contrato.expand?.empresa
    const pf = contrato.expand?.cliente_pf

    let nome = ''
    if (contrato.cliente_nome_assinante) {
      nome = contrato.cliente_nome_assinante
    } else if (pf?.nome) {
      nome = pf.nome
    } else if (emp?.razao_social) {
      nome = emp.razao_social
    } else {
      nome = 'Cliente'
    }
    setDestinatarioNome(nome)

    let tel = ''
    if (emp) {
      const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      tel = wpp || ''
    } else if (pf) {
      const telefones = Array.isArray(pf.telefones) ? pf.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      tel = wpp || ''
    }
    setTelefone(tel)

    carregarTextoPadrao(nome)
  }, [open, contrato])

  const carregarTextoPadrao = async (nomeAlvo: string) => {
    setLoadingTexto(true)
    try {
      // Buscar parâmetro configurável texto_padrao_whatsapp_contrato ou contrato_servico_texto_whatsapp
      const textoCustomizado =
        (await parametrosService.get('contrato_servico_texto_whatsapp')) ||
        (await parametrosService.get('texto_padrao_whatsapp_contrato'))

      let base =
        textoCustomizado ||
        'Olá, {nome}! Agradecemos a formalização da proposta comercial {numero_proposta}. O Contrato de Prestação de Serviços Técnicos {numero_contrato} já foi aprovado e assinado digitalmente pela Diretoria da G+ Engenharia. Para sua comodidade e segurança jurídica, disponibilizamos o link exclusivo para assinatura eletrônica: {link_contrato}'

      const msg = base
        .replace(/\{nome\}/g, nomeAlvo)
        .replace(/\{numero_contrato\}/g, contrato.numero || '')
        .replace(/\{numero_proposta\}/g, contrato.expand?.proposta?.numero || '')
        .replace(/\{link_contrato\}/g, publicLink)
        .replace(/\{link\}/g, publicLink)

      setMensagem(msg)
    } catch (err) {
      console.error('Erro ao carregar texto padrão de WhatsApp:', err)
      setMensagem(
        `Olá, ${nomeAlvo}! O Contrato de Prestação de Serviços Técnicos ${contrato.numero} já está disponível para sua assinatura eletrônica através do link: ${publicLink}`,
      )
    } finally {
      setLoadingTexto(false)
    }
  }

  const handleEnviar = async () => {
    const rawPhone = cleanPhoneForWa(telefone)
    if (!rawPhone || rawPhone.length < 10) {
      toast({
        title: 'Telefone inválido',
        description: 'Informe um número de telefone com DDD válido para envio via WhatsApp.',
        variant: 'destructive',
      })
      return
    }

    if (!mensagem.trim()) {
      toast({
        title: 'Mensagem vazia',
        description: 'Digite o conteúdo da mensagem a ser enviada.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    try {
      // Registrar auditoria
      await contratosServicoService.registrarEnvioWhatsApp({
        contratoId: contrato.id,
        telefone: rawPhone,
        destinatarioNome: destinatarioNome.trim(),
        mensagem: mensagem.trim(),
      })

      // Abrir WhatsApp Web / wa.me com texto codificado
      const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(mensagem)}`
      window.open(waUrl, '_blank')

      toast({
        title: 'WhatsApp Aberto',
        description:
          'O link de envio foi aberto no WhatsApp e o disparo foi auditado no sistema com sucesso.',
      })

      if (onEnvioConcluido) {
        onEnvioConcluido()
      }
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao auditar envio WhatsApp do contrato:', err)
      toast({
        title: 'Erro ao registrar envio',
        description: err.message || 'Não foi possível registrar o envio no log de auditoria.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg p-5">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Enviar Contrato via WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Contrato <strong className="text-slate-800">{contrato.numero}</strong> • Link com
                assinatura eletrônica
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Nome do Contato / Signatário:</Label>
              <Input
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
                placeholder="Ex: Carlos Silva"
                className="h-8 text-xs bg-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Telefone WhatsApp (com DDD):</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                placeholder="(11) 99999-9999"
                className="h-8 text-xs font-mono bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-slate-600">
                Mensagem Padrão (configurável em Administração):
              </Label>
              <button
                type="button"
                onClick={() => carregarTextoPadrao(destinatarioNome)}
                disabled={loadingTexto}
                className="text-[11px] text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${loadingTexto ? 'animate-spin' : ''}`} />
                Restaurar padrão
              </button>
            </div>
            <Textarea
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="text-xs leading-relaxed font-sans"
              placeholder="Digite a mensagem..."
            />
          </div>

          <div className="p-3 bg-slate-50 border rounded text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Link Seguro Incluído:</div>
            <div className="font-mono text-[10px] text-blue-700 break-all select-all">
              {publicLink || 'Token ainda não gerado'}
            </div>
            <div className="text-[10px] text-slate-400">
              Premissa: o botão abre o WhatsApp Web/App direto na conversa com a mensagem
              pré-preenchida e gera log no histórico de auditoria.
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleEnviar}
            disabled={enviando || loadingTexto}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
          >
            {enviando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                Abrir WhatsApp e Auditar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
