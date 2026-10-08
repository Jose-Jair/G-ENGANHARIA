import React, { useState } from 'react'
import { ContatoRecord } from '@/types'
import { contatosService } from '@/services/contatos'
import { formatPhoneBr, cleanPhoneForWa, isValidPhoneBr, isValidEmail } from '@/lib/cnpj'
import { openWhatsAppWithFallback } from '@/lib/whatsapp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus,
  Users,
  Mail,
  Phone,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
  Edit,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmpresaContatosTabProps {
  empresaId: string
  empresaNome: string
  contatos: ContatoRecord[]
  readOnly: boolean
  onContatosChange: () => void
}

export function EmpresaContatosTab({
  empresaId,
  empresaNome,
  contatos,
  readOnly,
  onContatosChange,
}: EmpresaContatosTabProps) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<ContatoRecord | null>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [decisor, setDecisor] = useState(false)
  const [verificado, setVerificado] = useState(false)

  // Validation states
  const [emailInvalido, setEmailInvalido] = useState(false)
  const [telefoneInvalido, setTelefoneInvalido] = useState(false)
  const [whatsappInvalido, setWhatsappInvalido] = useState(false)

  // WhatsApp quick text dialog
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waTargetNumber, setWaTargetNumber] = useState('')
  const [waTargetNome, setWaTargetNome] = useState('')
  const [waMessage, setWaMessage] = useState('')

  const openCreateModal = () => {
    setEditingContato(null)
    setNome('')
    setCargo('')
    setEmail('')
    setTelefone('')
    setWhatsapp('')
    setDecisor(false)
    setVerificado(false)
    setEmailInvalido(false)
    setTelefoneInvalido(false)
    setWhatsappInvalido(false)
    setModalOpen(true)
  }

  const openEditModal = (c: ContatoRecord) => {
    setEditingContato(c)
    setNome(c.nome || '')
    setCargo(c.cargo || '')
    setEmail(c.email || '')
    setTelefone(c.telefone ? formatPhoneBr(c.telefone, true) : '')
    setWhatsapp(c.whatsapp ? formatPhoneBr(c.whatsapp, true) : '')
    setDecisor(!!c.decisor)
    setVerificado(!!c.verificado)
    setEmailInvalido(false)
    setTelefoneInvalido(false)
    setWhatsappInvalido(false)
    setModalOpen(true)
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (val.trim()) {
      setEmailInvalido(!isValidEmail(val.trim()))
    } else {
      setEmailInvalido(false)
    }
  }

  const handleTelefoneChange = (val: string) => {
    const fmt = formatPhoneBr(val, true)
    setTelefone(fmt)
    if (fmt.trim()) {
      setTelefoneInvalido(!isValidPhoneBr(fmt))
    } else {
      setTelefoneInvalido(false)
    }
  }

  const handleWhatsappChange = (val: string) => {
    const fmt = formatPhoneBr(val, true)
    setWhatsapp(fmt)
    if (fmt.trim()) {
      setWhatsappInvalido(!isValidPhoneBr(fmt))
    } else {
      setWhatsappInvalido(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome completo do contato.',
        variant: 'destructive',
      })
      return
    }

    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailInvalido(true)
      toast({
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido.',
        variant: 'destructive',
      })
      return
    }

    if (telefone.trim() && !isValidPhoneBr(telefone.trim())) {
      setTelefoneInvalido(true)
      toast({
        title: 'Telefone inválido',
        description: 'Informe um telefone brasileiro válido (+55).',
        variant: 'destructive',
      })
      return
    }

    if (whatsapp.trim() && !isValidPhoneBr(whatsapp.trim())) {
      setWhatsappInvalido(true)
      toast({
        title: 'WhatsApp inválido',
        description: 'Informe um número de WhatsApp brasileiro válido (+55).',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        empresa: empresaId,
        nome: nome.trim(),
        cargo: cargo.trim(),
        email: email.trim(),
        telefone: telefone.trim() ? cleanPhoneForWa(telefone.trim()) : '',
        whatsapp: whatsapp.trim() ? cleanPhoneForWa(whatsapp.trim()) : '',
        decisor,
        verificado,
      }

      if (editingContato) {
        await contatosService.update(editingContato.id, payload)
        toast({
          title: 'Contato atualizado',
          description: `Contato ${payload.nome} foi salvo.`,
        })
      } else {
        await contatosService.create(payload)
        toast({
          title: 'Contato adicionado',
          description: `${payload.nome} cadastrado com sucesso.`,
        })
      }
      setModalOpen(false)
      onContatosChange()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar contato',
        description: err instanceof Error ? err.message : 'Falha ao salvar dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, contatoNome: string) => {
    if (!window.confirm(`Remover o contato ${contatoNome}?`)) return
    try {
      await contatosService.delete(id)
      toast({
        title: 'Contato excluído',
        description: `${contatoNome} foi removido.`,
      })
      onContatosChange()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao excluir contato',
        description: err instanceof Error ? err.message : 'Falha ao excluir.',
        variant: 'destructive',
      })
    }
  }

  const openWaDialog = (c: ContatoRecord) => {
    const rawNum = c.whatsapp || c.telefone || ''
    const cleanNum = cleanPhoneForWa(rawNum)
    if (!cleanNum) {
      toast({
        title: 'Sem número válido',
        description: 'Este contato não possui telefone/WhatsApp preenchido.',
        variant: 'destructive',
      })
      return
    }
    setWaTargetNumber(cleanNum)
    setWaTargetNome(c.nome)
    setWaMessage(
      `Olá, ${c.nome}! Tudo bem? Sou da equipe de intermediação de contratos da Engenharia Contratos. Gostaria de conversar rapidamente sobre as demandas e projetos da ${empresaNome}. Quando teria 10 minutinhos?`,
    )
    setWaModalOpen(true)
  }

  const handleSendWa = () => {
    if (!waTargetNumber) return
    const encoded = encodeURIComponent(waMessage)
    window.open(`https://wa.me/${waTargetNumber}?text=${encoded}`, '_blank', 'noopener,noreferrer')
    setWaModalOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Contatos e Decisores</h3>
          <p className="text-xs text-slate-500">
            Cadastre os profissionais da empresa, identificando decisores e canais diretos de
            comunicação.
          </p>
        </div>
        {!readOnly && (
          <Button
            onClick={openCreateModal}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Contato
          </Button>
        )}
      </div>

      {contatos.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-lg">
          <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhum contato registrado</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Cadastre ao menos um contato (preferencialmente decisor) para viabilizar as ações de
            cadência e prospecção.
          </p>
          {!readOnly && (
            <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Primeiro Contato
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contatos.map((c) => {
            const hasWa = !!(c.whatsapp || c.telefone)
            const hasEmail = !!c.email

            return (
              <div
                key={c.id}
                className={`bg-white border rounded-lg p-4 transition-all ${
                  c.decisor
                    ? 'border-blue-300 bg-blue-50/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.nome}</span>
                      {c.decisor && (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Decisor
                        </Badge>
                      )}
                      {c.verificado && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verificado
                        </Badge>
                      )}
                    </div>
                    {c.cargo && <p className="text-xs text-slate-500 mt-0.5">{c.cargo}</p>}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(c)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(c.id, c.nome)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Linha de canais de contato */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  {c.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                      <a
                        href={`mailto:${c.email}?subject=${encodeURIComponent(`Contato G+ Engenharia — ${empresaNome}`)}`}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-medium shrink-0 ml-2"
                        title={`Enviar e-mail para ${c.email}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!c.email || !c.email.trim()) {
                            e.preventDefault()
                            toast({
                              title: 'Contato sem e-mail',
                              description: 'Este contato não possui endereço de e-mail cadastrado.',
                              variant: 'destructive',
                            })
                          }
                        }}
                      >
                        Enviar E-mail
                      </a>
                    </div>
                  )}

                  {c.telefone && (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => openWhatsAppWithFallback({ phone: c.telefone })}
                        className="text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 text-left cursor-pointer transition-colors group"
                        title="Abrir no aplicativo WhatsApp desktop (ou WhatsApp Web)"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                        <span className="group-hover:underline">{formatPhoneBr(c.telefone)}</span>
                      </button>
                    </div>
                  )}

                  {c.whatsapp && (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => openWhatsAppWithFallback({ phone: c.whatsapp })}
                        className="text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 text-left cursor-pointer transition-colors group"
                        title="Abrir no aplicativo WhatsApp desktop (ou WhatsApp Web)"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="group-hover:underline">
                          WA: {formatPhoneBr(c.whatsapp)}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Ação rápida de WhatsApp com mensagem editável */}
                  {hasWa && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openWaDialog(c)}
                        className="h-7 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-300"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Mensagem WhatsApp
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal CRUD Contato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContato ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
            <DialogDescription>
              Dados da pessoa de contato na empresa parceira ou prospect.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nomeContato">Nome Completo *</Label>
              <Input
                id="nomeContato"
                placeholder="Ex: João da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cargoContato">Cargo / Função</Label>
              <Input
                id="cargoContato"
                placeholder="Ex: Diretor Técnico, Engenheiro Fiscal, Comprador"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emailContato">E-mail</Label>
              <Input
                id="emailContato"
                type="email"
                placeholder="joao@empresa.com.br"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={emailInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''}
              />
              {emailInvalido && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  E-mail inválido. Utilize o formato nome@dominio.com.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="telContato">Telefone</Label>
                <Input
                  id="telContato"
                  placeholder="+55 (00) 0000-0000"
                  value={telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  className={telefoneInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''}
                />
                {telefoneInvalido && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Telefone inválido.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="waContato">WhatsApp (com DDD)</Label>
                <Input
                  id="waContato"
                  placeholder="+55 (00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  className={whatsappInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''}
                />
                {whatsappInvalido && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    WhatsApp inválido.
                  </p>
                )}
              </div>{' '}
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="checkDecisor"
                  checked={decisor}
                  onCheckedChange={(c) => setDecisor(!!c)}
                />
                <label
                  htmlFor="checkDecisor"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Marcar como <strong>Decisor de Compra / Contratação</strong>
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="checkVerificado"
                  checked={verificado}
                  onCheckedChange={(c) => setVerificado(!!c)}
                />
                <label
                  htmlFor="checkVerificado"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Contato já <strong>Verificado</strong> (e-mail/telefone validado)
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || emailInvalido || telefoneInvalido || whatsappInvalido}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Salvando...' : editingContato ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Mensagem WhatsApp Editável */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Abrir Conversa no WhatsApp
            </DialogTitle>
            <DialogDescription>
              Mensagem pronta para <strong>{waTargetNome}</strong> ({waTargetNumber}). Você pode
              editar antes de enviar.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label htmlFor="waEditMsg">Mensagem inicial:</Label>
            <textarea
              id="waEditMsg"
              rows={4}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 italic">
              Ao confirmar, uma nova aba do WhatsApp Web / Aplicativo será aberta com a mensagem
              digitada.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendWa}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" /> Abrir no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
