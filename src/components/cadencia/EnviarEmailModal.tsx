import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Mail, Send, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react'
import {
  ToqueComCalculo,
  ContatoRecord,
  EmpresaRecord,
  ContratoRecord,
  ModeloRecord,
} from '@/types'
import { toquesService } from '@/services/toques'
import { useToast } from '@/hooks/use-toast'
import { formatCurrencyBr } from '@/lib/formatters'

interface EnviarEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toque: ToqueComCalculo | null
  empresa: EmpresaRecord | null
  contatos: ContatoRecord[]
  contratos: ContratoRecord[]
  modelos: ModeloRecord[]
  onSuccess: () => void
}

export const EnviarEmailModal: React.FC<EnviarEmailModalProps> = ({
  open,
  onOpenChange,
  toque,
  empresa,
  contatos,
  contratos,
  modelos,
  onSuccess,
}) => {
  const { toast } = useToast()

  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [destinatarioNome, setDestinatarioNome] = useState('')
  const [sending, setSending] = useState(false)

  // Encontrar contato decisor ou preferencial
  React.useEffect(() => {
    if (empresa && open) {
      const decisor = contatos.find((c) => c.decisor && c.email)
      const comEmail = contatos.find((c) => c.email)
      const emailFinal = decisor?.email || comEmail?.email || empresa.email || ''
      const nomeFinal = decisor?.nome || comEmail?.nome || empresa.nome_fantasia || ''

      setDestinatarioEmail(emailFinal)
      setDestinatarioNome(nomeFinal)
    }
  }, [empresa, contatos, open])

  if (!toque || !empresa) return null

  // Contrato principal
  const contratoPrincipal = contratos[0]
  const orgaoTexto = contratoPrincipal?.orgao || 'Órgão Contratante'
  const valorTexto = formatCurrencyBr(contratoPrincipal?.valor || 0)

  // Identificar modelo
  const numToque = toque.numero_toque
  let tipoModelo = 'email_institucional'
  if (numToque === 3) tipoModelo = 'solucao_elaborada'
  if (numToque === 5) tipoModelo = 'piloto'

  const modeloAtual =
    modelos.find((m) => m.nome.includes(`Toque ${numToque}`) || m.tipo === tipoModelo) || null

  // Pré-visualização com tags
  const previewAssunto = (modeloAtual?.assunto || 'Apoio Técnico em Contratos Públicos')
    .replace(/\{nome\}/g, destinatarioNome || 'Prezado(a)')
    .replace(/\{orgao\}/g, orgaoTexto)
    .replace(/\{valor_contrato\}/g, valorTexto)

  const previewCorpo = (
    modeloAtual?.corpo ||
    'Prezado(a) {nome},\n\nEm referência ao contrato com {orgao}...\n\nDescadastro: {link_descadastro}'
  )
    .replace(/\{nome\}/g, destinatarioNome || 'Prezado(a)')
    .replace(/\{orgao\}/g, orgaoTexto)
    .replace(/\{valor_contrato\}/g, valorTexto)
    .replace(
      /\{link_descadastro\}/g,
      `${window.location.origin}/nao-contatar?acao=descadastro&empresa=${empresa.id}&email=${encodeURIComponent(destinatarioEmail)}`,
    )

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destinatarioEmail) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o endereço de e-mail do destinatário.',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    try {
      const res = await toquesService.enviarEmailCadencia({
        toque_id: toque.id,
        empresa_id: empresa.id,
        destinatario_email: destinatarioEmail,
        destinatario_nome: destinatarioNome,
        custom_descadastro_url: `${window.location.origin}/nao-contatar?acao=descadastro&empresa=${empresa.id}&email=${encodeURIComponent(destinatarioEmail)}`,
      })

      toast({
        title: 'E-mail enviado com sucesso!',
        description: `Disparado para ${destinatarioEmail} com link de descadastro obrigatório inserido.`,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao processar envio do e-mail.'
      toast({
        title: 'Envio bloqueado ou com falha',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Mail className="w-5 h-5 text-blue-600" />
            Enviar E-mail Cadência — Toque {toque.numero_toque}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Disparo auditado server-side com validação de lista "Não contatar" e link de descadastro
            obrigatório por compliance LGPD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
          {/* Compliance Badge */}
          <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Verificação ativa da lista "Não Contatar" antes de cada envio
            </span>
            <span className="text-[10px] font-mono uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
              Auditoria Ativa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="destEmail" className="text-xs font-semibold">
                E-mail do Destinatário *
              </Label>
              <Input
                id="destEmail"
                type="email"
                required
                placeholder="decisor@empresa.com.br"
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="destNome" className="text-xs font-semibold">
                Nome do Decisor / Contato
              </Label>
              <Input
                id="destNome"
                placeholder="Eng. Marcelo Antunes"
                value={destinatarioNome}
                onChange={(e) => setDestinatarioNome(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Selecionar contato rápido */}
          {contatos.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600">
              <span className="font-semibold text-slate-500">Contatos salvos:</span>
              {contatos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (c.email) setDestinatarioEmail(c.email)
                    if (c.nome) setDestinatarioNome(c.nome)
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    destinatarioEmail === c.email
                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {c.nome} {c.decisor ? '(Decisor)' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Dados dinâmicos identificados */}
          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Órgão do Contrato:
              </span>
              <span className="font-medium text-slate-800">{orgaoTexto}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Valor do Contrato:
              </span>
              <span className="font-mono font-bold text-slate-800">{valorTexto}</span>
            </div>
          </div>

          {/* Pré-visualização do Assunto e Corpo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              Assunto (Template: {modeloAtual?.nome || `Toque ${numToque}`}):
            </Label>
            <div className="p-2 rounded bg-slate-100 text-xs font-medium text-slate-900 border border-slate-200">
              {previewAssunto}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              Corpo da Mensagem com Substituição das Variáveis e Link de Descadastro:
            </Label>
            <div className="p-3 rounded bg-slate-50 border border-slate-200 font-sans text-xs text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {previewCorpo}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sending}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sending ? 'Disparando e-mail...' : 'Disparar E-mail Oficial'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
