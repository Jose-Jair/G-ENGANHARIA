import React, { useEffect, useState } from 'react'
import {
  ClientePfRecord,
  PropostaRecord,
  AuditLogRecord,
  BASE_LEGAL_LGPD_LABELS,
  BaseLegalLgpd,
  TelefoneItem,
} from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  User,
  ShieldCheck,
  History,
  FileText,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Edit,
  Loader2,
  MessageSquare,
  PhoneCall,
  Save,
  X,
} from 'lucide-react'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { formatCpf, formatPhoneBr, cleanPhoneForWa } from '@/lib/cnpj'
import { openWhatsAppWithFallback } from '@/lib/whatsapp'
import { auditService } from '@/services/audit'
import { clientesPfService, UpdateClientePfData } from '@/services/clientesPf'
import { ListaTelefones } from '@/components/comum/ListaTelefones'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Trash2 } from 'lucide-react'

interface ClientePfDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  propostas: PropostaRecord[]
  onClienteUpdated?: (updated: ClientePfRecord) => void
  onExcluirClick?: (cliente: ClientePfRecord) => void
}

export function ClientePfDetailModal({
  open,
  onOpenChange,
  cliente,
  propostas,
  onClienteUpdated,
  onExcluirClick,
}: ClientePfDetailModalProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'dados' | 'propostas' | 'timeline'>('dados')
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Modo de edição dos dados
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Estados locais do formulário de edição
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [telefones, setTelefones] = useState<TelefoneItem[]>([])
  const [endereco, setEndereco] = useState<EnderecoValue>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  })

  // Sincroniza formulário quando o cliente mudar ou modal abrir
  useEffect(() => {
    if (!cliente) return
    setNome(cliente.nome || '')
    setEmail(cliente.email || '')
    setObservacoes(cliente.observacoes || '')

    // Carrega telefones (se array json existir ou converte telefone simples)
    if (cliente.telefones && Array.isArray(cliente.telefones) && cliente.telefones.length > 0) {
      setTelefones(cliente.telefones)
    } else if (cliente.telefone) {
      setTelefones([
        {
          id: `tel_ini_${cliente.id}`,
          numero: cliente.telefone,
          whatsapp: true,
          tipo: 'whatsapp',
        },
      ])
    } else {
      setTelefones([])
    }

    // Carrega endereço segmentado
    setEndereco({
      cep: cliente.cep || '',
      logradouro: cliente.logradouro || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      municipio: cliente.municipio || '',
      uf: cliente.uf || '',
    })

    setModoEdicao(false)
  }, [cliente, open])

  useEffect(() => {
    if (!open || !cliente?.id) return

    const loadAudit = async () => {
      setLoadingTimeline(true)
      try {
        const res = await auditService.list(1, 100)
        const filtered = res.items.filter((item) => {
          if (item.registro_id === cliente.id) return true
          const detalhes = item.detalhes as Record<string, unknown> | undefined
          if (!detalhes) return false
          const cliId =
            (detalhes.cliente_pf as string) ||
            (detalhes.depois && (detalhes.depois as Record<string, unknown>).cliente_pf) ||
            (detalhes.antes && (detalhes.antes as Record<string, unknown>).cliente_pf)
          return cliId === cliente.id
        })
        setTimelineLogs(filtered)
      } catch {
        setTimelineLogs([])
      } finally {
        setLoadingTimeline(false)
      }
    }

    loadAudit()
  }, [open, cliente?.id])

  if (!cliente) return null

  const cliProps = propostas.filter((p) => p.cliente_pf === cliente.id)
  const totalReceita = cliProps
    .filter((p) => p.status === 'aceita')
    .reduce((acc, p) => acc + (Number(p.preco) || 0), 0)

  const handleEnviarEmail = () => {
    const cleanMail = (cliente.email || email).trim()
    if (!cleanMail) return
    window.location.href = `mailto:${cleanMail}`
  }

  const handleSalvarEdicao = async () => {
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' })
      return
    }

    setSalvando(true)
    try {
      const primeiroTel = telefones[0]?.numero || ''

      // Monta texto de endereço mantendo compatibilidade
      const partes = [
        endereco.logradouro,
        endereco.numero ? `nº ${endereco.numero}` : '',
        endereco.complemento,
        endereco.bairro,
        endereco.municipio && endereco.uf ? `${endereco.municipio}/${endereco.uf}` : '',
        endereco.cep ? `CEP ${endereco.cep}` : '',
      ].filter(Boolean)
      const enderecoTexto = partes.length > 0 ? partes.join(', ') : cliente.endereco

      const payload: UpdateClientePfData = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: primeiroTel || undefined,
        telefones,
        cep: endereco.cep?.trim() || undefined,
        logradouro: endereco.logradouro?.trim() || undefined,
        numero: endereco.numero?.trim() || undefined,
        complemento: endereco.complemento?.trim() || undefined,
        bairro: endereco.bairro?.trim() || undefined,
        municipio: endereco.municipio?.trim() || undefined,
        uf: endereco.uf?.trim() || undefined,
        endereco: enderecoTexto,
        observacoes: observacoes.trim() || undefined,
      }

      const updated = await clientesPfService.update(cliente.id, payload)
      toast({
        title: 'Cliente PF atualizado',
        description: 'Dados cadastrais, telefones e endereço foram salvos com sucesso.',
      })
      setModoEdicao(false)
      onClienteUpdated?.(updated)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar cliente PF',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Lista efetiva de telefones para exibição (mescla cliente.telefones ou telefone legado)
  const telefonesExibicao: TelefoneItem[] =
    cliente.telefones && cliente.telefones.length > 0
      ? cliente.telefones
      : cliente.telefone
        ? [
            {
              id: 'tel_legado',
              numero: cliente.telefone,
              whatsapp: true,
              tipo: 'whatsapp',
            },
          ]
        : []

  const temEnderecoSegmentado = Boolean(
    cliente.cep || cliente.logradouro || cliente.bairro || cliente.municipio || cliente.uf,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {cliente.nome}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    LGPD Ativo
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  CPF: {formatCpf(cliente.cpf)} • Cadastrado em {formatDateBr(cliente.created)}
                </DialogDescription>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 uppercase block">
                Receita Acumulada
              </span>
              <div className="text-lg font-bold text-emerald-700">
                {formatCurrencyBr(totalReceita)}
              </div>
              <span className="text-[11px] text-slate-400">
                {cliProps.length} proposta(s) registrada(s)
              </span>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'dados' | 'propostas' | 'timeline')}
          className="mt-4"
        >
          <TabsList className="grid grid-cols-3 w-full bg-slate-100">
            <TabsTrigger value="dados" className="text-xs font-medium gap-2">
              <User className="w-4 h-4" />
              Dados e LGPD
            </TabsTrigger>
            <TabsTrigger value="propostas" className="text-xs font-medium gap-2">
              <FileText className="w-4 h-4" />
              Demandas / Propostas ({cliProps.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs font-medium gap-2">
              <History className="w-4 h-4" />
              Linha do Tempo ({timelineLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA DADOS E LGPD */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            {/* Barra de alternância edição */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-xs font-semibold text-slate-800">
                  {modoEdicao ? 'Modo de Edição Ativo' : 'Visualização dos Dados Cadastrais'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {modoEdicao
                    ? 'Altere telefones, e-mail e endereço segmentado e clique em Salvar Alterações.'
                    : 'Edite contatos com WhatsApp, envie e-mails diretos e gerencie o endereço completo.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !modoEdicao && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (cliente) onExcluirClick?.(cliente)
                    }}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold h-8"
                    title="Excluir cadastro ou anonimizar segundo LGPD (exclusivo Admin)"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                    Excluir / Anonimizar
                  </Button>
                )}
                {modoEdicao ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModoEdicao(false)}
                      disabled={salvando}
                      className="text-xs h-8"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSalvarEdicao}
                      disabled={salvando}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                    >
                      {salvando ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1" />
                      )}
                      Salvar Alterações
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModoEdicao(true)}
                    className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold h-8"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                    Editar Dados
                  </Button>
                )}
              </div>
            </div>

            {modoEdicao ? (
              /* FORMULÁRIO DE EDIÇÃO */
              <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome Completo *</Label>
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="text-xs h-9 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">E-mail (Único)</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="cliente@email.com"
                        className="text-xs h-9 bg-white flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleEnviarEmail}
                        disabled={!email.trim()}
                        className="h-9 px-2.5 text-xs text-blue-700 hover:bg-blue-50 border-blue-200 gap-1 shrink-0"
                        title="Enviar e-mail (mailto:)"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Enviar</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Múltiplos telefones no modo edição */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                  <ListaTelefones
                    telefones={telefones}
                    onChange={setTelefones}
                    label="Telefones do Cliente PF"
                    helperText="Gerencie múltiplos números com botão WhatsApp e links diretos."
                  />
                </div>

                {/* Endereço segmentado no modo edição */}
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                  <EnderecoComCep
                    value={endereco}
                    onChange={setEndereco}
                    label="Endereço Completo do Cliente PF"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="text-xs bg-white"
                  />
                </div>
              </div>
            ) : (
              /* MODO VISUALIZAÇÃO */
              <Card className="border-slate-200">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
                    Informações de Contato e Localização
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3 text-xs">
                  {/* E-mail com botão mailto */}
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700 min-w-0">
                      <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-500">E-mail:</span>
                      <span className="font-medium text-slate-900 truncate">
                        {cliente.email || 'Não informado'}
                      </span>
                    </div>
                    {cliente.email && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleEnviarEmail}
                        className="h-7 text-xs text-blue-700 hover:bg-blue-50 border-blue-200 gap-1 shrink-0"
                        title="Abrir no cliente de e-mail padrão (mailto:)"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Enviar E-mail
                      </Button>
                    )}
                  </div>

                  {/* Telefones com botão WhatsApp desktop / fallback Web */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs">
                      <Phone className="w-4 h-4 text-orange-600" />
                      <span>Telefones Cadastrados ({telefonesExibicao.length})</span>
                    </div>

                    {telefonesExibicao.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">
                        Nenhum telefone registrado.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {telefonesExibicao.map((t) => {
                          const hasWa = t.whatsapp ?? t.tipo === 'whatsapp'
                          const clean = cleanPhoneForWa(t.numero)
                          return (
                            <div
                              key={t.id}
                              className="p-2.5 rounded-md border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {hasWa ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                                    >
                                      WhatsApp
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-slate-100 text-slate-600"
                                    >
                                      {t.tipo || 'Telefone'}
                                    </Badge>
                                  )}
                                  {t.ramalOuDescricao && (
                                    <span className="text-[10px] text-slate-500 truncate">
                                      {t.ramalOuDescricao}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasWa) {
                                      openWhatsAppWithFallback({ phone: t.numero })
                                    } else if (clean) {
                                      window.location.href = `tel:${clean}`
                                    }
                                  }}
                                  className={`font-mono text-xs font-bold block mt-1 text-left cursor-pointer hover:underline ${
                                    hasWa ? 'text-emerald-800' : 'text-slate-900'
                                  }`}
                                  title={
                                    hasWa
                                      ? 'Abrir no aplicativo WhatsApp desktop (ou WhatsApp Web)'
                                      : 'Ligar para o telefone'
                                  }
                                >
                                  {formatPhoneBr(t.numero)}
                                </button>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {clean && (
                                  <a
                                    href={`tel:${clean}`}
                                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-blue-700"
                                    title="Ligar"
                                  >
                                    <PhoneCall className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {hasWa && (
                                  <button
                                    type="button"
                                    onClick={() => openWhatsAppWithFallback({ phone: t.numero })}
                                    className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                                    title="Abrir no WhatsApp desktop (ou WhatsApp Web)"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Endereço segmentado e legado */}
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                      <span className="font-semibold text-slate-500">Endereço:</span>
                    </div>

                    {temEnderecoSegmentado ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded border border-slate-200 mt-1">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Logradouro e Nº:</span>
                          <span className="font-semibold text-slate-800">
                            {cliente.logradouro || 'Sem logradouro'}
                            {cliente.numero ? `, nº ${cliente.numero}` : ''}
                          </span>
                        </div>
                        {cliente.complemento && (
                          <div>
                            <span className="text-[11px] text-slate-400 block">Complemento:</span>
                            <span className="text-slate-700">{cliente.complemento}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[11px] text-slate-400 block">Bairro:</span>
                          <span className="text-slate-700">
                            {cliente.bairro || 'Não informado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">
                            Município / UF / CEP:
                          </span>
                          <span className="font-mono text-slate-800">
                            {cliente.municipio ? `${cliente.municipio}/${cliente.uf || ''}` : '-'}{' '}
                            {cliente.cep ? `• CEP: ${cliente.cep}` : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 rounded text-slate-700 text-xs border border-slate-100">
                        {cliente.endereco || 'Endereço não informado'}
                      </div>
                    )}
                  </div>

                  {cliente.observacoes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500 block mb-1">Observações:</span>
                      <p className="p-2 bg-slate-50 rounded text-slate-600 text-[11px]">
                        {cliente.observacoes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cartão LGPD */}
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-emerald-950 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Registro de Consentimento e Base Legal LGPD
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2 text-xs text-emerald-950">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded border border-emerald-200">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Base Legal Aplicada:</span>
                    <strong className="text-slate-800">
                      {BASE_LEGAL_LGPD_LABELS[cliente.base_legal as BaseLegalLgpd] ||
                        cliente.base_legal ||
                        'Consentimento do Titular'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Data do Consentimento:</span>
                    <strong className="text-slate-800">
                      {formatDateBr(cliente.data_consentimento)}
                    </strong>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-900 bg-emerald-100/60 p-2.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                  O titular consentiu formalmente com o armazenamento de seus dados e documentos
                  técnicos para cumprimento das obrigações contratuais e emissão de Anotação de
                  Responsabilidade Técnica (ART).
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA PROPOSTAS */}
          <TabsContent value="propostas" className="space-y-4 mt-4">
            {cliProps.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
                Nenhuma proposta comercial vinculada a este cliente PF.
              </div>
            ) : (
              <div className="space-y-3">
                {cliProps.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {prop.numero}
                      </span>
                      <span className="font-bold text-sm text-emerald-700">
                        {formatCurrencyBr(prop.preco)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                      <strong>Escopo:</strong> {prop.escopo}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Prazo: {prop.prazo || '30 dias'}</span>
                      <span>Cadastrada em: {formatDateBr(prop.created)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ABA TIMELINE AUDITORIA */}
          <TabsContent value="timeline" className="space-y-4 mt-4">
            {loadingTimeline ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2" />
                Carregando histórico auditado...
              </div>
            ) : timelineLogs.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Nenhum evento auditado para este cliente PF.
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-2">
                {timelineLogs.map((log) => {
                  const isCriacao = log.acao === 'CRIACAO'
                  const isEdicao = log.acao === 'EDICAO'
                  const userName = log.expand?.user?.name || log.user_email || 'Sistema / Usuário'

                  return (
                    <div key={log.id} className="relative pl-6">
                      <div
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                          isCriacao
                            ? 'border-emerald-500 bg-emerald-100'
                            : isEdicao
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-slate-400 bg-slate-100'
                        }`}
                      />
                      <div className="bg-white border border-slate-200 rounded p-3 shadow-xs space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold ${
                                isCriacao
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : isEdicao
                                    ? 'text-blue-700 bg-blue-50'
                                    : 'text-slate-700'
                              }`}
                            >
                              {log.acao}
                            </Badge>
                            <span className="font-semibold text-slate-800">
                              {log.entidade === 'clientes_pf' ? 'Cliente PF' : log.entidade}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateTimeBr(log.created)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                          <span>Executado por: {userName}</span>
                          {log.ip && <span>IP: {log.ip}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
