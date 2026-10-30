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
import {
  MessageSquare,
  Mail,
  Send,
  Loader2,
  Copy,
  ExternalLink,
  CheckCircle2,
  Users,
  AlertCircle,
  Building2,
  User,
} from 'lucide-react'
import { PropostaRecord, ContatoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { isValidEmail } from '@/lib/cnpj'
import {
  formatPhoneDisplay,
  formatPhoneProgressive,
  isValidPhone,
  toCanonicalPhone,
  getWaDigitsOnly,
  buildWaMeUrl,
} from '@/lib/phone'
import { propostasService } from '@/services/propostas'
import { parametrosService } from '@/services/parametros'
import { contatosService } from '@/services/contatos'
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

  // Lista de contatos disponíveis da PJ (quando aplicável) para seleção
  const [contatosPj, setContatosPj] = useState<ContatoRecord[]>([])
  const [contatoSelecionadoId, setContatoSelecionadoId] = useState<string>('principal')

  // Campos de envio editáveis inline
  const [destinatarioNome, setDestinatarioNome] = useState('')
  const [destinatarioTelefone, setDestinatarioTelefone] = useState('')
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [assuntoEmail, setAssuntoEmail] = useState('')
  const [mensagemTexto, setMensagemTexto] = useState('')

  // Erros de validação inline
  const [telefoneError, setTelefoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Carregar dados pré-preenchidos a partir de PF ou PJ (com busca de contatos se PJ)
  useEffect(() => {
    if (!open || !proposta) return

    setTelefoneError(null)
    setEmailError(null)

    const emp = proposta.expand?.empresa as any
    const pf = proposta.expand?.cliente_pf as any

    let nomeInicial = ''
    let telInicial = ''
    let emailInicial = ''

    if (emp) {
      // Carregar contatos da empresa para permitir alternar entre eles
      contatosService
        .listByEmpresa(emp.id)
        .then((contatos) => {
          setContatosPj(contatos)

          // Escolhe o contato principal: primeiro com decisor=true ou primeiro da lista
          const contatoPrincipal = contatos.find((c) => c.decisor) || contatos[0]

          let finalNome = ''
          let finalTel = ''
          let finalEmail = ''

          if (contatoPrincipal) {
            setContatoSelecionadoId(contatoPrincipal.id)
            finalNome = contatoPrincipal.nome
            finalTel = contatoPrincipal.whatsapp || contatoPrincipal.telefone || ''
            finalEmail = contatoPrincipal.email || emp.email || ''
          } else {
            setContatoSelecionadoId('empresa_direta')
            finalNome = emp.razao_social || emp.nome_fantasia || 'Cliente'
            finalEmail = emp.email || ''
            const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
            const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
            finalTel = wpp || emp.telefone || ''
          }

          setDestinatarioNome(finalNome)
          setDestinatarioTelefone(finalTel ? formatPhoneDisplay(finalTel, true) : '')
          setDestinatarioEmail(finalEmail)
          carregarTextoPadrao(canal, finalNome)
        })
        .catch(() => {
          // Fallback se a busca de contatos falhar
          nomeInicial = emp.razao_social || emp.nome_fantasia || 'Cliente'
          emailInicial = emp.email || ''
          const telefones = Array.isArray(emp.telefones) ? emp.telefones : []
          const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
          telInicial = wpp || emp.telefone || ''

          setDestinatarioNome(nomeInicial)
          setDestinatarioTelefone(telInicial ? formatPhoneDisplay(telInicial, true) : '')
          setDestinatarioEmail(emailInicial)
          carregarTextoPadrao(canal, nomeInicial)
        })
    } else if (pf) {
      setContatosPj([])
      setContatoSelecionadoId('cliente_pf')

      nomeInicial = pf.nome || 'Cliente'
      emailInicial = pf.email || ''

      const telefones = Array.isArray(pf.telefones) ? pf.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      telInicial = wpp || pf.telefone || ''

      setDestinatarioNome(nomeInicial)
      setDestinatarioTelefone(telInicial ? formatPhoneDisplay(telInicial, true) : '')
      setDestinatarioEmail(emailInicial)
      carregarTextoPadrao(canal, nomeInicial)
    } else {
      setDestinatarioNome('Cliente')
      setDestinatarioTelefone('')
      setDestinatarioEmail('')
      carregarTextoPadrao(canal, 'Cliente')
    }
  }, [open, proposta])

  // Troca de contato selecionado na PJ
  const handleSelecionarContatoPj = (contatoId: string) => {
    setContatoSelecionadoId(contatoId)
    const emp = proposta?.expand?.empresa as any

    if (contatoId === 'empresa_direta') {
      const nome = emp?.razao_social || emp?.nome_fantasia || 'Cliente'
      const email = emp?.email || ''
      const telefones = Array.isArray(emp?.telefones) ? emp.telefones : []
      const wpp = telefones.find((t: any) => t.whatsapp)?.numero || telefones[0]?.numero
      const tel = wpp || emp?.telefone || ''

      setDestinatarioNome(nome)
      setDestinatarioTelefone(tel ? formatPhoneDisplay(tel, true) : '')
      setDestinatarioEmail(email)
      carregarTextoPadrao(canal, nome)
    } else {
      const contato = contatosPj.find((c) => c.id === contatoId)
      if (contato) {
        setDestinatarioNome(contato.nome)
        const tel = contato.whatsapp || contato.telefone || ''
        setDestinatarioTelefone(tel ? formatPhoneDisplay(tel, true) : '')
        setDestinatarioEmail(contato.email || emp?.email || '')
        carregarTextoPadrao(canal, contato.nome)
      }
    }
  }

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
          template = `Olá, ${nomeAlvo || 'Cliente'}! Tudo bem?\n\nSegue o link oficial da Proposta Comercial ${proposta.numero} da G+ Engenharia para visualização e formalização:\n\n${linkPublico}\n\nFicamos à total disposição para esclarecer eventuais dúvidas!`
        } else {
          template = `Prezado(a) ${nomeAlvo || 'Cliente'},\n\nApresentamos nossa proposta técnica e comercial ${proposta.numero}.\n\nPara visualizar o detalhamento completo e formalizar o aceite eletrônico, acesse o link seguro abaixo:\n${linkPublico}\n\nAtenciosamente,\nG+ Engenharia Consultiva`
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

  const handleCanalChange = (novoCanal: 'whatsapp' | 'email') => {
    setCanal(novoCanal)
    carregarTextoPadrao(novoCanal, destinatarioNome)
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatPhoneProgressive(e.target.value)
    setDestinatarioTelefone(formatado)
    if (formatado && !isValidPhone(formatado)) {
      setTelefoneError('Número inválido: informe DDD oficial e número válido.')
    } else {
      setTelefoneError(null)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDestinatarioEmail(val)
    if (val && !isValidEmail(val)) {
      setEmailError('E-mail inválido: confira o formato (ex: cliente@empresa.com.br).')
    } else {
      setEmailError(null)
    }
  }

  const handleEnviar = async () => {
    if (!proposta) return

    setLoading(true)
    try {
      if (canal === 'whatsapp') {
        if (!destinatarioTelefone || !isValidPhone(destinatarioTelefone)) {
          setTelefoneError('Número de WhatsApp inválido. Formato exigido: +55 (XX) XXXXX-XXXX.')
          toast({
            title: 'Telefone inválido',
            description:
              'Informe um número de telefone com DDD válido no formato +55 (XX) XXXXX-XXXX.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        const canonical = toCanonicalPhone(destinatarioTelefone)
        const waDigits = getWaDigitsOnly(destinatarioTelefone)
        if (!canonical || !waDigits || waDigits.length < 12) {
          toast({
            title: 'Telefone incompleto',
            description: 'O número não contém todos os dígitos necessários com DDI e DDD.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        // Auditar o envio via endpoint de auditoria do backend com canônico E.164
        await propostasService.registrarEnvioWhatsApp({
          propostaId: proposta.id,
          destinatarioTelefone: canonical,
          destinatarioNome: destinatarioNome.trim(),
        })

        // Gerar o link oficial wa.me garantido estritamente com apenas dígitos e DDI 55
        const waUrl = buildWaMeUrl(destinatarioTelefone, mensagemTexto)
        window.open(waUrl, '_blank', 'noopener,noreferrer')

        toast({
          title: 'Envio via WhatsApp iniciado',
          description: `A conversa com +55 (${telNormalizado.slice(2, 4)}) foi aberta e a ação foi auditada.`,
        })

        if (onEnvioConcluido) onEnvioConcluido()
        onOpenChange(false)
        restoreBodyPointerEvents()
      } else {
        // Envio via E-mail Transacional Real
        if (!destinatarioEmail || !isValidEmail(destinatarioEmail)) {
          setEmailError('Informe um endereço de e-mail corporativo válido.')
          toast({
            title: 'E-mail inválido',
            description: 'Por favor, informe um endereço de e-mail corporativo/pessoal válido.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        await propostasService.enviarPorEmail({
          propostaId: proposta.id,
          destinatarioEmail: destinatarioEmail.trim(),
          destinatarioNome: destinatarioNome.trim(),
          assunto: assuntoEmail.trim(),
          corpo: mensagemTexto,
        })

        toast({
          title: 'E-mail enviado com sucesso!',
          description: `A proposta ${proposta.numero} foi enviada para ${destinatarioEmail} e auditada no sistema.`,
        })

        if (onEnvioConcluido) onEnvioConcluido()
        onOpenChange(false)
        restoreBodyPointerEvents()
      }
    } catch (err: any) {
      console.error('Erro no envio da proposta:', err)
      toast({
        title: 'Erro ao enviar proposta',
        description:
          err?.data?.message || err.message || 'Ocorreu um erro no processamento do envio.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!proposta) return null

  const linkProposta = `${window.location.origin}/proposta/${proposta.token_aceite || ''}`
  const emp = proposta.expand?.empresa as any
  const pf = proposta.expand?.cliente_pf as any

  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        if (!op) restoreBodyPointerEvents()
        onOpenChange(op)
      }}
    >
      <DialogContent
        className="w-[96vw] max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
        onCloseAutoFocus={() => restoreBodyPointerEvents()}
      >
        <div className="p-4 sm:p-6 pb-3 border-b shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                <Send className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Enviar Proposta ao Cliente — {proposta.numero}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Envio oficial com máscara padrão, texto configurável e registro de auditoria.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-4 sm:p-6 overflow-y-auto flex-1 text-xs">
          {/* Card com Resumo do Cliente / Pré-Cadastro Vinculado */}
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
              {(emp?.pre_cadastro || pf?.pre_cadastro) && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  Pré-cadastro ativo
                </span>
              )}
            </div>

            {/* Se for PJ e tiver contatos cadastrados, permitir alternar de forma prática */}
            {emp && contatosPj.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <Label className="text-[11px] text-slate-600 block mb-1">
                  Selecione o Contato / Signatário da Empresa:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {contatosPj.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelecionarContatoPj(c.id)}
                      className={`text-left p-2 rounded border text-[11px] transition-colors ${
                        contatoSelecionadoId === c.id
                          ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-semibold'
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
                        {c.whatsapp || c.telefone || c.email || 'Sem telefone'}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSelecionarContatoPj('empresa_direta')}
                    className={`text-left p-2 rounded border text-[11px] transition-colors ${
                      contatoSelecionadoId === 'empresa_direta'
                        ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-semibold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate font-medium">Dados Gerais da Empresa</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      {emp.telefone || emp.email || 'Cadastro principal'}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seleção do Canal de Envio */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">Canal de Envio:</Label>
            <RadioGroup
              value={canal}
              onValueChange={(val: 'whatsapp' | 'email') => handleCanalChange(val)}
              className="grid grid-cols-2 gap-3 mt-1.5"
            >
              <label
                htmlFor="canal-wa"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  canal === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="whatsapp" id="canal-wa" />
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-semibold text-xs">WhatsApp Oficial</div>
                  <div className="text-[10px] text-slate-500">Abre wa.me com link seguro</div>
                </div>
              </label>

              <label
                htmlFor="canal-email"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  canal === 'email'
                    ? 'border-blue-500 bg-blue-50/60 text-blue-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RadioGroupItem value="email" id="canal-email" />
                <Mail className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-semibold text-xs">E-mail Transacional</div>
                  <div className="text-[10px] text-slate-500">Disparo com template G+</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Dados do Destinatário (Editáveis Inline com Pré-preenchimento) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
            <div>
              <Label className="text-[11px] text-slate-600">Nome do Destinatário / Contato:</Label>
              <Input
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="h-8 text-xs mt-1 bg-white"
              />
            </div>

            {canal === 'whatsapp' ? (
              <div>
                <Label className="text-[11px] text-slate-600">
                  WhatsApp com DDI e DDD (máscara +55):
                </Label>
                <Input
                  value={destinatarioTelefone}
                  onChange={handleTelefoneChange}
                  placeholder="+55 (11) 98765-4321"
                  className={`h-8 text-xs mt-1 font-mono bg-white ${
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
            ) : (
              <div>
                <Label className="text-[11px] text-slate-600">E-mail do Destinatário:</Label>
                <Input
                  type="email"
                  value={destinatarioEmail}
                  onChange={handleEmailChange}
                  placeholder="cliente@empresa.com.br"
                  className={`h-8 text-xs mt-1 bg-white ${
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
                placeholder="Assunto da proposta..."
              />
            </div>
          )}

          {/* Mensagem com Texto Padrão Editável */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold text-slate-700">
                Corpo da Mensagem (editável antes do disparo):
              </Label>
              <button
                type="button"
                onClick={() => carregarTextoPadrao(canal, destinatarioNome)}
                disabled={loadingTexto}
                className="text-[11px] text-orange-600 hover:text-orange-700 underline font-medium"
              >
                Restaurar padrão
              </button>
            </div>
            <Textarea
              rows={7}
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

        <div className="p-4 sm:p-6 pt-3 border-t bg-slate-50 shrink-0">
          <DialogFooter className="gap-2 flex-col sm:flex-row">
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
                  Disparar E-mail Oficial
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>{' '}
    </Dialog>
  )
}
