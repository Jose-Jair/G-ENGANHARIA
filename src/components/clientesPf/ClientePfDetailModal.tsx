import React, { useEffect, useState } from 'react'
import {
  ClientePfRecord,
  PropostaRecord,
  AuditLogRecord,
  BASE_LEGAL_LGPD_LABELS,
  BaseLegalLgpd,
} from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  ShieldCheck,
  History,
  FileText,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { formatCpf, formatPhoneBr } from '@/lib/cnpj'
import { auditService } from '@/services/audit'

interface ClientePfDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  propostas: PropostaRecord[]
}

export function ClientePfDetailModal({
  open,
  onOpenChange,
  cliente,
  propostas,
}: ClientePfDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'dados' | 'propostas' | 'timeline'>('dados')
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

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
            <Card className="border-slate-200">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
                  Informações de Contato e Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">E-mail:</span>
                  <span>{cliente.email || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">Telefone:</span>
                  <span>{formatPhoneBr(cliente.telefone) || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">Endereço:</span>
                  <span>{cliente.endereco || 'Não informado'}</span>
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
