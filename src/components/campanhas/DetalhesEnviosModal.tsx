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
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Send,
  MailCheck,
  MousePointerClick,
  MessageSquare,
  UserX,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Clock,
  ShieldCheck,
  Search,
} from 'lucide-react'
import { CampanhaRecord, CampanhaEnvioRecord, CampanhaCalculada } from '@/types'
import { campanhasService } from '@/services/campanhas'
import { formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface DetalhesEnviosModalProps {
  campanha: CampanhaCalculada | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  isAdminOrComercial: boolean
}

export function DetalhesEnviosModal({
  campanha,
  open,
  onOpenChange,
  onSuccess,
  isAdminOrComercial,
}: DetalhesEnviosModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [envios, setEnvios] = useState<CampanhaEnvioRecord[]>([])
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  // Modal para marcar resposta
  const [envioParaResposta, setEnvioParaResposta] = useState<CampanhaEnvioRecord | null>(null)
  const [obsResposta, setObsResposta] = useState('')
  const [salvandoResposta, setSalvandoResposta] = useState(false)

  const carregarEnvios = async () => {
    if (!campanha?.id) return
    setLoading(true)
    try {
      const list = await campanhasService.listEnvios(campanha.id)
      setEnvios(list)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar envios',
        description: err instanceof Error ? err.message : 'Falha na consulta de destinatários.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && campanha?.id) {
      carregarEnvios()
    }
  }, [open, campanha?.id])

  const handleConfirmarResposta = async () => {
    if (!envioParaResposta) return
    setSalvandoResposta(true)
    try {
      const res = await campanhasService.marcarResposta(
        envioParaResposta.id,
        obsResposta.trim() || 'Resposta comercial confirmada na campanha de nutrição.',
      )
      toast({
        title: 'Resposta Registrada!',
        description: res.message,
      })
      setEnvioParaResposta(null)
      setObsResposta('')
      carregarEnvios()
      onSuccess()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar resposta',
        description: err instanceof Error ? err.message : 'Falha ao processar.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoResposta(false)
    }
  }

  if (!campanha) return null

  const enviosFiltrados = envios.filter((item) => {
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'aberto' && !item.aberto_em) return false
      if (filtroStatus === 'clique' && (!item.cliques || item.cliques === 0)) return false
      if (filtroStatus === 'respondeu' && !item.resposta_em) return false
      if (filtroStatus === 'descadastro' && !item.descadastro_em) return false
      if (filtroStatus === 'bloqueado' && item.status !== 'bloqueado_nao_contatar') return false
    }

    if (busca.trim()) {
      const q = busca.toLowerCase()
      const matchMail = (item.destinatario_email || '').toLowerCase().includes(q)
      const matchNome = (item.destinatario_nome || '').toLowerCase().includes(q)
      const empNome = item.expand?.empresa?.razao_social || ''
      const matchEmp = empNome.toLowerCase().includes(q)
      if (!matchMail && !matchNome && !matchEmp) return false
    }

    return true
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Métricas & Destinatários: {campanha.nome}
              </DialogTitle>
              <Badge variant="outline" className="text-xs uppercase bg-slate-50">
                Status: {campanha.status}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Acompanhamento de disparos, aberturas estimadas, cliques e registro de respostas
              comerciais com retorno automático ao funil.
            </DialogDescription>
          </DialogHeader>

          {/* Cards de Métricas da Campanha */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                Enviados
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {campanha.enviados || 0}
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <MailCheck className="w-3.5 h-3.5 text-emerald-600" />
                Aberturas
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {campanha.abertos || 0}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({campanha.taxaAbertura}%)
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5 text-indigo-600" />
                Cliques
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {campanha.cliques || 0}{' '}
                <span className="text-xs font-normal text-slate-500">({campanha.taxaClique}%)</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                Respostas
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {campanha.respostas || 0}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({campanha.taxaResposta}%)
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <UserX className="w-3.5 h-3.5 text-rose-600" />
                Descadastros
              </div>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {campanha.descadastros || 0}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({campanha.taxaDescadastro}%)
                </span>
              </div>
            </div>
          </div>

          {/* Aviso sobre precisão de pixel */}
          <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Atenção sobre Métricas:</strong> As taxas de abertura são estimadas via pixel
              1x1. Clientes de e-mail com bloqueio automático de imagens remotas ou firewalls
              corporativos podem não contabilizar aberturas mesmo após a leitura da mensagem.
            </span>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar destinatário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto w-full sm:w-auto text-xs">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroStatus === 'todos'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({envios.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('aberto')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroStatus === 'aberto'
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Abertos
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('clique')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroStatus === 'clique'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Clicaram
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('respondeu')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroStatus === 'respondeu'
                    ? 'bg-teal-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Responderam
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('descadastro')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filtroStatus === 'descadastro'
                    ? 'bg-rose-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Descadastros
              </button>
            </div>
          </div>

          {/* Tabela de Destinatários */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg mt-2 min-h-[220px]">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-xs">Carregando dados dos destinatários...</span>
              </div>
            ) : enviosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum destinatário encontrado com os filtros aplicados.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Empresa / Destinatário</th>
                    <th className="py-2 px-3 font-semibold">Status Disparo</th>
                    <th className="py-2 px-3 font-semibold">Abertura</th>
                    <th className="py-2 px-3 font-semibold">Cliques</th>
                    <th className="py-2 px-3 font-semibold">Resposta / Retorno</th>
                    <th className="py-2 px-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enviosFiltrados.map((item) => {
                    const empNome =
                      item.expand?.empresa?.nome_fantasia ||
                      item.expand?.empresa?.razao_social ||
                      'Empresa em Nutrição'
                    const jaRespondeu = !!item.resposta_em
                    const jaDescadastrou = !!item.descadastro_em

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{empNome}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.destinatario_email}
                          </div>
                          {item.destinatario_nome && (
                            <div className="text-[10px] text-slate-400">
                              Contato: {item.destinatario_nome}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {item.status === 'bloqueado_nao_contatar' ? (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 text-[10px]"
                            >
                              Bloqueado (Não Contatar)
                            </Badge>
                          ) : item.status === 'enviado' ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 text-[10px]"
                            >
                              Enviado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {item.status}
                            </Badge>
                          )}
                          {item.enviado_em && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {formatDateTimeBr(item.enviado_em)}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {item.aberto_em ? (
                            <div>
                              <span className="font-semibold text-emerald-700">Aberto</span>
                              <div className="text-[10px] text-slate-400">
                                {formatDateTimeBr(item.aberto_em)} ({item.total_aberturas || 1}x)
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Não detectado</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {item.cliques && item.cliques > 0 ? (
                            <div>
                              <span className="font-semibold text-indigo-700">
                                {item.cliques} clique(s)
                              </span>
                              {item.ultimo_clique_em && (
                                <div className="text-[10px] text-slate-400">
                                  {formatDateTimeBr(item.ultimo_clique_em)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {jaDescadastrou ? (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-800 text-[10px]"
                            >
                              Descadastrado (LGPD)
                            </Badge>
                          ) : jaRespondeu ? (
                            <div>
                              <Badge className="bg-teal-600 text-white text-[10px]">
                                Respondeu (Em conversa)
                              </Badge>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatDateTimeBr(item.resposta_em!)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Aguardando</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {!jaRespondeu && !jaDescadastrou && isAdminOrComercial && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEnvioParaResposta(item)}
                              className="text-[11px] h-7 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                            >
                              <MessageSquare className="w-3 h-3 mr-1 text-teal-600" />
                              Registrar Resposta
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para confirmação de resposta comercial */}
      {envioParaResposta && (
        <Dialog open={!!envioParaResposta} onOpenChange={() => setEnvioParaResposta(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                Registrar Resposta da Empresa
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Ao registrar que a empresa respondeu à campanha, ela{' '}
                <strong>retornará automaticamente para a coluna "Em conversa" no funil</strong>,
                pausando a nutrição mensal. Ação 100% auditada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700 space-y-1">
                <div>
                  Destinatário: <strong>{envioParaResposta.destinatario_email}</strong>
                </div>
                <div>
                  Contato: <strong>{envioParaResposta.destinatario_nome || 'Responsável'}</strong>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Observações sobre a resposta / interesse comercial:
                </label>
                <textarea
                  rows={3}
                  value={obsResposta}
                  onChange={(e) => setObsResposta(e.target.value)}
                  placeholder="Ex: Diretor de obras retornou solicitando apresentação técnica das disciplinas complementares para o novo contrato..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setEnvioParaResposta(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmarResposta}
                disabled={salvandoResposta}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {salvandoResposta && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Confirmar e Mover para Em Conversa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
