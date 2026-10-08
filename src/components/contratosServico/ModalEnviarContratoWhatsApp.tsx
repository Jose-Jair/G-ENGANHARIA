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
import { MessageSquare, Copy, ExternalLink, AlertCircle, Building2, User } from 'lucide-react'
import { ContratoServicoRecord, ContatoRecord } from '@/types'
import { formatPhoneBr, cleanPhoneForWa, isValidPhoneBr } from '@/lib/cnpj'
import { contatosService } from '@/services/contatos'
import { auditService } from '@/services/audit'
import { useToast } from '@/hooks/use-toast'
import { restoreBodyPointerEvents } from '@/lib/utils'

interface ModalEnviarContratoWhatsAppProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoServicoRecord | null
}

export function ModalEnviarContratoWhatsApp({
  open,
  onOpenChange,
  contrato,
}: ModalEnviarContratoWhatsAppProps) {
  const { toast } = useToast()
  const [nomeDestinatario, setNomeDestinatario] = useState('')
  const [telefone, setTelefone] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [telefoneError, setTelefoneError] = useState<string | null>(null)

  // Contatos de PJ se aplicável
  const [contatosPj, setContatosPj] = useState<ContatoRecord[]>([])
  const [contatoSelecionadoId, setContatoSelecionadoId] = useState<string>('principal')

  useEffect(() => {
    if (!open || !contrato) return

    setTelefoneError(null)

    const emp = contrato.expand?.empresa as any
    const pf = contrato.expand?.cliente_pf as any

    const linkAssinatura = `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente || ''}`

    const buildMensagem = (nomeAlvo: string) => {
      return (
        `Olá, ${nomeAlvo || 'Cliente'}! Tudo bem?\n\n` +
        `Segue o link oficial para assinatura digital do Contrato de Prestação de Serviços ${contrato.codigo} da G+ Engenharia:\n\n` +
        `${linkAssinatura}\n\n` +
        `Por favor, acesse o link para conferir as cláusulas e registrar seu aceite formal com validade jurídica.\n\n` +
        `Qualquer dúvida estamos à inteira disposição!`
      )
    }

    if (emp) {
      contatosService
        .listByEmpresa(emp.id)
        .then((contatos) => {
          setContatosPj(contatos)
          const principal = contatos.find((c) => c.decisor) || contatos[0]

          let finalNome = ''
          let finalTel = ''

          if (principal) {
            setContatoSelecionadoId(principal.id)
            finalNome = principal.nome
            finalTel = principal.whatsapp || principal.telefone || ''
          } else {
            setContatoSelecionadoId('empresa_direta')
            finalNome = emp.razao_social || emp.nome_fantasia || 'Cliente'
            const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
            const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
            finalTel = wpp || emp.telefone || ''
          }

          setNomeDestinatario(finalNome)
          setTelefone(finalTel ? formatPhoneBr(finalTel, true) : '')
          setMensagem(buildMensagem(finalNome))
        })
        .catch(() => {
          const nome = emp.razao_social || emp.nome_fantasia || 'Cliente'
          const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
          const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
          const tel = wpp || emp.telefone || ''

          setNomeDestinatario(nome)
          setTelefone(tel ? formatPhoneBr(tel, true) : '')
          setMensagem(buildMensagem(nome))
        })
    } else if (pf) {
      setContatosPj([])
      setContatoSelecionadoId('cliente_pf')
      const nome = pf.nome || 'Cliente'
      const telefones = Array.isArray(pf.telefones) ? pf.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      const tel = wpp || pf.telefone || ''

      setNomeDestinatario(nome)
      setTelefone(tel ? formatPhoneBr(tel, true) : '')
      setMensagem(buildMensagem(nome))
    } else {
      setNomeDestinatario('Cliente')
      setTelefone('')
      setMensagem(buildMensagem('Cliente'))
    }
  }, [open, contrato])

  const handleSelecionarContatoPj = (contatoId: string) => {
    if (!contrato) return
    setContatoSelecionadoId(contatoId)
    const emp = contrato.expand?.empresa as any
    const linkAssinatura = `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente || ''}`

    const buildMsg = (nome: string) =>
      `Olá, ${nome}! Tudo bem?\n\n` +
      `Segue o link oficial para assinatura digital do Contrato de Prestação de Serviços ${contrato.codigo} da G+ Engenharia:\n\n` +
      `${linkAssinatura}\n\n` +
      `Por favor, acesse o link para conferir as cláusulas e registrar seu aceite formal com validade jurídica.\n\n` +
      `Qualquer dúvida estamos à inteira disposição!`

    if (contatoId === 'empresa_direta') {
      const nome = emp?.razao_social || emp?.nome_fantasia || 'Cliente'
      const telefones = Array.isArray(emp?.telefones) ? emp?.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      const tel = wpp || emp?.telefone || ''

      setNomeDestinatario(nome)
      setTelefone(tel ? formatPhoneBr(tel, true) : '')
      setMensagem(buildMsg(nome))
    } else {
      const c = contatosPj.find((item) => item.id === contatoId)
      if (c) {
        setNomeDestinatario(c.nome)
        const tel = c.whatsapp || c.telefone || ''
        setTelefone(tel ? formatPhoneBr(tel, true) : '')
        setMensagem(buildMsg(c.nome))
      }
    }
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatPhoneBr(e.target.value, true)
    setTelefone(formatado)
    if (formatado && !isValidPhoneBr(formatado)) {
      setTelefoneError('Número inválido: informe DDD (2 dígitos) e número com 8 ou 9 dígitos.')
    } else {
      setTelefoneError(null)
    }
  }

  const handleEnviarWhatsApp = async () => {
    if (!contrato) return

    if (!telefone || !isValidPhoneBr(telefone)) {
      setTelefoneError('Número de WhatsApp inválido. Formato exigido: +55 (XX) XXXXX-XXXX.')
      toast({
        title: 'Telefone inválido',
        description: 'Informe um número com DDD válido para envio via WhatsApp.',
        variant: 'destructive',
      })
      return
    }

    const telNormalizado = cleanPhoneForWa(telefone)
    if (!telNormalizado || telNormalizado.length < 12) {
      toast({
        title: 'Telefone incompleto',
        description: 'O número não possui todos os dígitos necessários com DDI e DDD.',
        variant: 'destructive',
      })
      return
    }

    try {
      await auditService.log({
        action: 'envio_whatsapp_contrato',
        collection_name: 'contratos_servico',
        record_id: contrato.id,
        details: {
          contrato_codigo: contrato.codigo,
          destinatario_nome: nomeDestinatario.trim(),
          destinatario_telefone: telNormalizado,
        },
      })
    } catch (e) {
      console.warn('Falha ao auditar envio de WhatsApp do contrato:', e)
    }

    const textoEncoded = encodeURIComponent(mensagem)
    const waUrl = `https://wa.me/${telNormalizado}?text=${textoEncoded}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')

    toast({
      title: 'WhatsApp aberto!',
      description: `Conversa iniciada com +55 (${telNormalizado.slice(2, 4)}).`,
    })

    onOpenChange(false)
    restoreBodyPointerEvents()
  }

  if (!contrato) return null

  const linkAssinatura = `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente || ''}`
  const emp = contrato.expand?.empresa as any
  const pf = contrato.expand?.cliente_pf as any

  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        if (!op) restoreBodyPointerEvents()
        onOpenChange(op)
      }}
    >
      <DialogContent
        className="w-[96vw] max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        onCloseAutoFocus={() => restoreBodyPointerEvents()}
      >
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                Enviar Contrato via WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {contrato.codigo} — Link oficial para assinatura digital do cliente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Card com identificação do cliente e seleção de contatos se PJ */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                {emp ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Cliente PJ: <strong>{emp.razao_social || emp.nome_fantasia}</strong>
                  </>
                ) : pf ? (
                  <>
                    <User className="w-3.5 h-3.5 text-purple-600" />
                    Cliente PF: <strong>{pf.nome}</strong>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Destinatário Comercial
                  </>
                )}
              </span>
            </div>

            {emp && contatosPj.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <Label className="text-[11px] text-slate-600 block mb-1">
                  Selecione o Contato / Signatário:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {contatosPj.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelecionarContatoPj(c.id)}
                      className={`text-left p-2 rounded border text-[11px] transition-colors ${
                        contatoSelecionadoId === c.id
                          ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{c.nome}</span>
                        {c.decisor && (
                          <span className="text-[9px] px-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                            Decisor
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        {c.whatsapp || c.telefone || 'Sem telefone'}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSelecionarContatoPj('empresa_direta')}
                    className={`text-left p-2 rounded border text-[11px] transition-colors ${
                      contatoSelecionadoId === 'empresa_direta'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate font-medium">Empresa (Principal)</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      {emp.telefone || 'Sem telefone cadastrado'}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-slate-600">Nome do Contato:</Label>
              <Input
                value={nomeDestinatario}
                onChange={(e) => setNomeDestinatario(e.target.value)}
                placeholder="Ex: Carlos Oliveira"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-[11px] text-slate-600">
                WhatsApp com DDI e DDD (máscara +55):
              </Label>
              <Input
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="+55 (11) 98765-4321"
                className={`h-8 text-xs mt-1 font-mono ${
                  telefoneError ? 'border-red-500 focus-visible:ring-red-400' : ''
                }`}
              />
              {telefoneError && (
                <span className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {telefoneError}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Mensagem:</Label>
            <Textarea
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="text-xs font-sans leading-relaxed mt-1"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="truncate text-[11px] text-emerald-950">
              <strong className="block text-[10px] uppercase text-emerald-700">
                Link de Assinatura:
              </strong>
              <span className="font-mono">{linkAssinatura}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(linkAssinatura)
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
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleEnviarWhatsApp}
            className="text-xs gap-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Abrir WhatsApp e Auditar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
