import React, { useState, useEffect } from 'react'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { ModalPadrao } from '@/components/comum/ModalPadrao'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MessageSquare,
  Mail,
  Copy,
  AlertCircle,
  Building2,
  User,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { ContratoServicoRecord, ContatoRecord } from '@/types'
import { formatPhoneBr, cleanPhoneForWa, isValidPhoneBr, isValidEmail } from '@/lib/cnpj'
import { contatosService } from '@/services/contatos'
import { contratosServicoService } from '@/services/contratosServico'
import { auditService } from '@/services/audit'
import { useToast } from '@/hooks/use-toast'
import { restoreBodyPointerEvents } from '@/lib/utils'

export interface ModalEnviarContratoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoServicoRecord | null
  initialCanal?: 'whatsapp' | 'email'
  onEnvioConcluido?: () => void
}

export function ModalEnviarContrato({
  open,
  onOpenChange,
  contrato,
  initialCanal = 'whatsapp',
  onEnvioConcluido,
}: ModalEnviarContratoProps) {
  const { toast } = useToast()
  const [canal, setCanal] = useState<'whatsapp' | 'email'>(initialCanal)

  // WhatsApp states
  const [nomeDestinatarioWa, setNomeDestinatarioWa] = useState('')
  const [telefone, setTelefone] = useState('')
  const [mensagemWa, setMensagemWa] = useState('')
  const [telefoneError, setTelefoneError] = useState<string | null>(null)

  // E-mail states
  const [nomeDestinatarioEmail, setNomeDestinatarioEmail] = useState('')
  const [emailDestinatario, setEmailDestinatario] = useState('')
  const [assuntoEmail, setAssuntoEmail] = useState('')
  const [corpoEmail, setCorpoEmail] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Contatos de PJ se aplicável
  const [contatosPj, setContatosPj] = useState<ContatoRecord[]>([])
  const [contatoSelecionadoId, setContatoSelecionadoId] = useState<string>('principal')

  useEffect(() => {
    if (open) {
      setCanal(initialCanal)
    }
  }, [open, initialCanal])

  useEffect(() => {
    if (!open || !contrato) return

    setTelefoneError(null)
    setEmailError(null)

    const emp = contrato.expand?.empresa as any
    const pf = contrato.expand?.cliente_pf as any

    const linkAssinatura = `${getAppBaseUrl()}/contrato-servico/${contrato.token_assinatura_cliente || ''}`

    const buildMensagemWa = (nomeAlvo: string) => {
      return (
        `Olá, ${nomeAlvo || 'Cliente'}! Tudo bem?\n\n` +
        `Segue o link oficial para assinatura digital do Contrato de Prestação de Serviços ${contrato.numero} da G+ Engenharia:\n\n` +
        `${linkAssinatura}\n\n` +
        `Por favor, acesse o link para conferir as cláusulas e registrar seu aceite formal com validade jurídica.\n\n` +
        `Qualquer dúvida estamos à inteira disposição!`
      )
    }

    const defaultAssunto = `Contrato de Prestação de Serviços ${contrato.numero} — G+ Engenharia`
    setAssuntoEmail(defaultAssunto)

    const buildCorpoEmail = (nomeAlvo: string) => {
      return (
        `Olá, ${nomeAlvo || 'Cliente'},\n\n` +
        `Encaminhamos para conferência e assinatura eletrônica o Contrato de Prestação de Serviços ${contrato.numero}.\n` +
        `O documento já foi devidamente formalizado e assinado pela Diretoria da G+ Engenharia.\n\n` +
        `Por favor, acesse o link seguro para formalizar o seu aceite eletrônico:\n` +
        `${linkAssinatura}\n\n` +
        `Permanecemos à disposição para quaisquer esclarecimentos técnicos ou administrativos.`
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
          let finalEmail = ''

          if (principal) {
            setContatoSelecionadoId(principal.id)
            finalNome = principal.nome
            finalTel = principal.whatsapp || principal.telefone || ''
            finalEmail = principal.email || emp.email || ''
          } else {
            setContatoSelecionadoId('empresa_direta')
            finalNome = emp.razao_social || emp.nome_fantasia || 'Cliente'
            const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
            const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
            finalTel = wpp || emp.telefone || ''
            finalEmail = emp.email || ''
          }

          setNomeDestinatarioWa(finalNome)
          setTelefone(finalTel ? formatPhoneBr(finalTel, true) : '')
          setMensagemWa(buildMensagemWa(finalNome))

          setNomeDestinatarioEmail(finalNome)
          setEmailDestinatario(finalEmail)
          setCorpoEmail(buildCorpoEmail(finalNome))
        })
        .catch(() => {
          const nome = emp.razao_social || emp.nome_fantasia || 'Cliente'
          const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
          const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
          const tel = wpp || emp.telefone || ''
          const em = emp.email || ''

          setNomeDestinatarioWa(nome)
          setTelefone(tel ? formatPhoneBr(tel, true) : '')
          setMensagemWa(buildMensagemWa(nome))

          setNomeDestinatarioEmail(nome)
          setEmailDestinatario(em)
          setCorpoEmail(buildCorpoEmail(nome))
        })
    } else if (pf) {
      setContatosPj([])
      setContatoSelecionadoId('cliente_pf')
      const nome = pf.nome || 'Cliente'
      const telefones = Array.isArray(pf.telefones) ? pf.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      const tel = wpp || pf.telefone || ''
      const em = pf.email || ''

      setNomeDestinatarioWa(nome)
      setTelefone(tel ? formatPhoneBr(tel, true) : '')
      setMensagemWa(buildMensagemWa(nome))

      setNomeDestinatarioEmail(nome)
      setEmailDestinatario(em)
      setCorpoEmail(buildCorpoEmail(nome))
    } else {
      setNomeDestinatarioWa('Cliente')
      setTelefone('')
      setMensagemWa(buildMensagemWa('Cliente'))

      setNomeDestinatarioEmail('Cliente')
      setEmailDestinatario('')
      setCorpoEmail(buildCorpoEmail('Cliente'))
    }
  }, [open, contrato])

  const handleSelecionarContatoPj = (contatoId: string) => {
    if (!contrato) return
    setContatoSelecionadoId(contatoId)
    const emp = contrato.expand?.empresa as any
    const linkAssinatura = `${getAppBaseUrl()}/contrato-servico/${contrato.token_assinatura_cliente || ''}`

    const buildMsgWa = (nome: string) =>
      `Olá, ${nome}! Tudo bem?\n\n` +
      `Segue o link oficial para assinatura digital do Contrato de Prestação de Serviços ${contrato.numero} da G+ Engenharia:\n\n` +
      `${linkAssinatura}\n\n` +
      `Por favor, acesse o link para conferir as cláusulas e registrar seu aceite formal com validade jurídica.\n\n` +
      `Qualquer dúvida estamos à inteira disposição!`

    const buildCorpoMail = (nome: string) =>
      `Olá, ${nome || 'Cliente'},\n\n` +
      `Encaminhamos para conferência e assinatura eletrônica o Contrato de Prestação de Serviços ${contrato.numero}.\n` +
      `O documento já foi devidamente formalizado e assinado pela Diretoria da G+ Engenharia.\n\n` +
      `Por favor, acesse o link seguro para formalizar o seu aceite eletrônico:\n` +
      `${linkAssinatura}\n\n` +
      `Permanecemos à disposição para quaisquer esclarecimentos técnicos ou administrativos.`

    if (contatoId === 'empresa_direta') {
      const nome = emp?.razao_social || emp?.nome_fantasia || 'Cliente'
      const telefones = Array.isArray(emp?.telefones) ? emp?.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      const tel = wpp || emp?.telefone || ''
      const em = emp?.email || ''

      setNomeDestinatarioWa(nome)
      setTelefone(tel ? formatPhoneBr(tel, true) : '')
      setMensagemWa(buildMsgWa(nome))

      setNomeDestinatarioEmail(nome)
      setEmailDestinatario(em)
      setCorpoEmail(buildCorpoMail(nome))
    } else {
      const c = contatosPj.find((item) => item.id === contatoId)
      if (c) {
        setNomeDestinatarioWa(c.nome)
        const tel = c.whatsapp || c.telefone || ''
        setTelefone(tel ? formatPhoneBr(tel, true) : '')
        setMensagemWa(buildMsgWa(c.nome))

        setNomeDestinatarioEmail(c.nome)
        setEmailDestinatario(c.email || emp?.email || '')
        setCorpoEmail(buildCorpoMail(c.nome))
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

    // Validar gate jurídico
    if (!contrato.data_assinatura_admin) {
      toast({
        title: 'Envio bloqueado',
        description: 'O Administrador deve assinar o contrato antes do envio ao cliente.',
        variant: 'destructive',
      })
      return
    }

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
        entity_type: 'contratos_servico',
        entity_id: contrato.id,
        details: {
          contrato_numero: contrato.numero,
          destinatario_nome: nomeDestinatarioWa.trim(),
          destinatario_telefone: telNormalizado,
        },
      })
    } catch (e) {
      console.warn('Falha ao auditar envio de WhatsApp do contrato:', e)
    }

    const textoEncoded = encodeURIComponent(mensagemWa)
    const waUrl = `https://wa.me/${telNormalizado}?text=${textoEncoded}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')

    toast({
      title: 'WhatsApp aberto com sucesso!',
      description: `Conversa iniciada com +55 (${telNormalizado.slice(2, 4)}).`,
    })

    if (onEnvioConcluido) {
      onEnvioConcluido()
    }
    onOpenChange(false)
    restoreBodyPointerEvents()
  }

  const handleEnviarEmail = async () => {
    if (!contrato) return

    // Validar gate jurídico
    if (!contrato.data_assinatura_admin) {
      toast({
        title: 'Envio bloqueado',
        description: 'O Administrador deve assinar o contrato antes do envio ao cliente.',
        variant: 'destructive',
      })
      return
    }

    const emailLimpo = (emailDestinatario || '').trim().toLowerCase()
    if (!emailLimpo || !isValidEmail(emailLimpo)) {
      setEmailError('Informe um endereço de e-mail válido.')
      toast({
        title: 'E-mail inválido',
        description: 'Verifique o formato do e-mail do destinatário.',
        variant: 'destructive',
      })
      return
    }

    setEmailError(null)
    setEnviandoEmail(true)
    try {
      const res = await contratosServicoService.enviarEmail({
        contratoId: contrato.id,
        destinatarioEmail: emailLimpo,
        destinatarioNome: nomeDestinatarioEmail.trim() || undefined,
        assunto: assuntoEmail.trim() || undefined,
        corpo: corpoEmail.trim() || undefined,
      })

      toast({
        title: 'Contrato enviado por e-mail!',
        description: res.message || `Disparo realizado para ${emailLimpo}.`,
      })

      if (onEnvioConcluido) {
        onEnvioConcluido()
      }
      onOpenChange(false)
      restoreBodyPointerEvents()
    } catch (err: any) {
      toast({
        title: 'Falha no envio de e-mail',
        description: err.message || 'Erro ao enviar o contrato por e-mail.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  if (!contrato) return null

  const linkAssinatura = `${getAppBaseUrl()}/contrato-servico/${contrato.token_assinatura_cliente || ''}`
  const emp = contrato.expand?.empresa as any
  const pf = contrato.expand?.cliente_pf as any
  const adminAssinou = Boolean(contrato.data_assinatura_admin)

  return (
    <ModalPadrao
      open={open}
      onOpenChange={(op) => {
        if (!op) restoreBodyPointerEvents()
        onOpenChange(op)
      }}
      maxWidthClass="sm:max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              canal === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {canal === 'whatsapp' ? (
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            ) : (
              <Mail className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-base sm:text-lg font-bold text-slate-900 truncate block">
              Enviar Contrato ao Cliente
            </span>
          </div>
        </div>
      }
      description={`${contrato.numero} • Assinatura Eletrônica Formal`}
      headerExtra={
        <div className="flex items-center bg-slate-100 p-1 rounded-lg shrink-0 border border-slate-200">
          <button
            type="button"
            onClick={() => setCanal('whatsapp')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              canal === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setCanal('email')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              canal === 'email'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </button>
        </div>
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              restoreBodyPointerEvents()
              onOpenChange(false)
            }}
          >
            Cancelar
          </Button>

          {canal === 'whatsapp' ? (
            <Button
              type="button"
              size="sm"
              disabled={!adminAssinou}
              onClick={handleEnviarWhatsApp}
              className="text-xs gap-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                adminAssinou
                  ? 'Abrir WhatsApp e auditar envio'
                  : 'Assine como Admin para liberar o envio'
              }
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Abrir WhatsApp e Auditar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!adminAssinou || enviandoEmail}
              onClick={handleEnviarEmail}
              className="text-xs gap-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                adminAssinou
                  ? 'Disparar e-mail com link de assinatura'
                  : 'Assine como Admin para liberar o envio'
              }
            >
              {enviandoEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando E-mail...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Enviar Contrato por E-mail
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 pt-1 text-xs">
        {/* Alerta de Gate Jurídico se Admin ainda não assinou */}
        {!adminAssinou && (
          <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 leading-relaxed">
              <strong className="block text-amber-950 font-bold mb-0.5">
                Envio ao cliente bloqueado: Assinatura da Diretoria Obrigatória
              </strong>
              Por regra jurídica da G+ Engenharia, o contrato deve ser formalmente assinado pelo
              Administrador antes de ser disponibilizado para assinatura do cliente.
            </div>
          </div>
        )}

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
                      {canal === 'whatsapp'
                        ? c.whatsapp || c.telefone || 'Sem telefone'
                        : c.email || 'Sem e-mail'}
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
                    {canal === 'whatsapp'
                      ? emp.telefone || 'Sem telefone cadastrado'
                      : emp.email || 'Sem e-mail cadastrado'}
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FORMULÁRIO DO CANAL WHATSAPP */}
        {canal === 'whatsapp' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-slate-600">Nome do Contato:</Label>
                <Input
                  value={nomeDestinatarioWa}
                  onChange={(e) => setNomeDestinatarioWa(e.target.value)}
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
                rows={5}
                value={mensagemWa}
                onChange={(e) => setMensagemWa(e.target.value)}
                className="text-xs font-sans leading-relaxed mt-1"
              />
            </div>
          </>
        )}

        {/* FORMULÁRIO DO CANAL E-MAIL */}
        {canal === 'email' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-slate-600">Nome do Destinatário:</Label>
                <Input
                  value={nomeDestinatarioEmail}
                  onChange={(e) => setNomeDestinatarioEmail(e.target.value)}
                  placeholder="Ex: Carlos Oliveira"
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-600">E-mail de Destino:</Label>
                <Input
                  type="email"
                  value={emailDestinatario}
                  onChange={(e) => {
                    setEmailDestinatario(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  placeholder="cliente@empresa.com.br"
                  className={`h-8 text-xs mt-1 ${
                    emailError ? 'border-red-500 focus-visible:ring-red-400' : ''
                  }`}
                />
                {emailError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {emailError}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-slate-600">Assunto do E-mail:</Label>
              <Input
                value={assuntoEmail}
                onChange={(e) => setAssuntoEmail(e.target.value)}
                placeholder="Contrato de Prestação de Serviços — G+ Engenharia"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Mensagem / Instruções:</Label>
              <Textarea
                rows={5}
                value={corpoEmail}
                onChange={(e) => setCorpoEmail(e.target.value)}
                className="text-xs font-sans leading-relaxed mt-1"
              />
            </div>
          </>
        )}

        {/* Card com Link Seguro de Assinatura */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
          <div className="truncate text-[11px] text-slate-800">
            <strong className="block text-[10px] uppercase text-slate-600">
              Link de Assinatura do Cliente:
            </strong>
            <span className="font-mono text-blue-700">{linkAssinatura}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-white text-slate-700 hover:bg-slate-50 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(linkAssinatura)
              toast({ title: 'Link copiado com sucesso!' })
            }}
          >
            <Copy className="w-3 h-3 mr-1" />
            Copiar
          </Button>
        </div>
      </div>
    </ModalPadrao>
  )
}
