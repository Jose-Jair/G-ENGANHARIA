import React, { useState } from 'react'
import {
  EntregavelRecord,
  EntregavelVersaoRecord,
  ProjetoEtapaRecord,
  StatusEntregavel,
} from '@/types'
import { entregaveisService, CreateEntregavelData } from '@/services/projetoDetalhes'
import { entregaveisCicloService } from '@/services/cadeiaContratosProjetos'
import { formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { openProtectedFile } from '@/lib/pocketbase/files'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  FileCheck2,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  History,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldAlert,
  GitCompare,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { EntregavelVersaoComentarios } from './EntregavelVersaoComentarios'
import { ModalOQueMudou } from './ModalOQueMudou'

interface EntregaveisTabProps {
  etapas: ProjetoEtapaRecord[]
  entregaveis: EntregavelRecord[]
  canEdit: boolean
  onRefresh: () => void
}

const STATUS_ENTREGAVEL_MAP: Record<string, { label: string; badge: string; icon: any }> = {
  atribuido: {
    label: 'Atribuído',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Clock,
  },
  em_producao: {
    label: 'Em Produção',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: Clock,
  },
  elaborando: {
    label: 'Elaborando',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Clock,
  },
  revisao_interna: {
    label: 'Revisão Interna',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: Eye,
  },
  enviado_revisao: {
    label: 'Enviado p/ Revisão',
    badge: 'bg-amber-100 text-amber-900 border-amber-400 font-semibold',
    icon: Eye,
  },
  enviado_cliente: {
    label: 'Enviado ao Cliente',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: FileCheck2,
  },
  aprovado: {
    label: 'Aprovado',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
    icon: CheckCircle2,
  },
  reprovado: {
    label: 'Reprovado',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: XCircle,
  },
  devolvido: {
    label: 'Devolvido com Motivo',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold',
    icon: RotateCcw,
  },
}

export const EntregaveisTab: React.FC<EntregaveisTabProps> = ({
  etapas,
  entregaveis,
  canEdit,
  onRefresh,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form states de criação
  const [etapaId, setEtapaId] = useState('')
  const [nome, setNome] = useState('')
  const [versao, setVersao] = useState('v1.0')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [etapaFiltro, setEtapaFiltro] = useState<string>('todas')

  // Modais de Ciclo de Entregáveis
  const [entregavelCiclo, setEntregavelCiclo] = useState<EntregavelRecord | null>(null)
  const [modalSubmeterAberto, setModalSubmeterAberto] = useState(false)
  const [modalAvaliarAberto, setModalAvaliarAberto] = useState(false)
  const [observacoesSubmissao, setObservacoesSubmissao] = useState('')
  const [modalOQueMudouAberto, setModalOQueMudouAberto] = useState(false)
  const [entregavelParaOQueMudou, setEntregavelParaOQueMudou] = useState<EntregavelRecord | null>(
    null,
  )
  const [versaoOQueMudouNum, setVersaoOQueMudouNum] = useState<number | undefined>(undefined)
  const [decisaoAvaliacao, setDecisaoAvaliacao] = useState<'aprovado' | 'devolvido'>('aprovado')
  const [motivoDevolucao, setMotivoDevolucao] = useState('')
  const [processandoCiclo, setProcessandoCiclo] = useState(false)

  // Histórico de Versões expansível por entregável
  const [versoesExpandidas, setVersoesExpandidas] = useState<
    Record<string, EntregavelVersaoRecord[]>
  >({})
  const [carregandoVersoes, setCarregandoVersoes] = useState<Record<string, boolean>>({})

  const isRevisorOuAdmin = user?.role === 'admin' || user?.role === 'gestor'

  const alternarHistoricoVersoes = async (entregavelId: string) => {
    if (versoesExpandidas[entregavelId]) {
      setVersoesExpandidas((prev) => {
        const copy = { ...prev }
        delete copy[entregavelId]
        return copy
      })
      return
    }

    try {
      setCarregandoVersoes((prev) => ({ ...prev, [entregavelId]: true }))
      const list = await entregaveisCicloService.listVersoes(entregavelId)
      setVersoesExpandidas((prev) => ({ ...prev, [entregavelId]: list }))
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar versões',
        description: err.message || 'Falha ao buscar histórico de versões.',
        variant: 'destructive',
      })
    } finally {
      setCarregandoVersoes((prev) => ({ ...prev, [entregavelId]: false }))
    }
  }

  const abrirModalSubmeter = (ent: EntregavelRecord) => {
    setEntregavelCiclo(ent)
    setObservacoesSubmissao('')
    setModalSubmeterAberto(true)
  }

  const handleSubmeterVersao = async () => {
    if (!entregavelCiclo) return
    setProcessandoCiclo(true)
    try {
      await entregaveisCicloService.submeterVersao(entregavelCiclo.id, observacoesSubmissao)
      toast({
        title: 'Versão enviada para revisão!',
        description: `O entregável avançou para revisão interna do Gestor/Admin.`,
      })
      setModalSubmeterAberto(false)
      onRefresh()
      // Recarrega versões se estava aberto
      if (versoesExpandidas[entregavelCiclo.id]) {
        const list = await entregaveisCicloService.listVersoes(entregavelCiclo.id)
        setVersoesExpandidas((prev) => ({ ...prev, [entregavelCiclo.id]: list }))
      }
    } catch (err: any) {
      toast({
        title: 'Erro na submissão',
        description: err.message || 'Falha ao submeter versão para revisão.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoCiclo(false)
    }
  }

  const abrirModalAvaliar = (ent: EntregavelRecord) => {
    setEntregavelCiclo(ent)
    setDecisaoAvaliacao('aprovado')
    setMotivoDevolucao('')
    setModalAvaliarAberto(true)
  }

  const handleAvaliarVersao = async () => {
    if (!entregavelCiclo) return
    if (decisaoAvaliacao === 'devolvido' && !motivoDevolucao.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'É obrigatório informar o motivo detalhado para devolução técnica.',
        variant: 'destructive',
      })
      return
    }

    setProcessandoCiclo(true)
    try {
      await entregaveisCicloService.avaliarVersao(
        entregavelCiclo.id,
        decisaoAvaliacao,
        motivoDevolucao,
      )
      toast({
        title: decisaoAvaliacao === 'aprovado' ? 'Entregável Aprovado!' : 'Entregável Devolvido',
        description:
          decisaoAvaliacao === 'aprovado'
            ? 'Entregável homologado com sucesso. Liberação de medições autorizada.'
            : 'Entregável devolvido com apontamento técnico registrado no histórico.',
      })
      setModalAvaliarAberto(false)
      onRefresh()
      // Recarrega versões se estava aberto
      if (versoesExpandidas[entregavelCiclo.id]) {
        const list = await entregaveisCicloService.listVersoes(entregavelCiclo.id)
        setVersoesExpandidas((prev) => ({ ...prev, [entregavelCiclo.id]: list }))
      }
    } catch (err: any) {
      toast({
        title: 'Erro na avaliação técnica',
        description: err.message || 'Falha ao registrar parecer técnico.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoCiclo(false)
    }
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!etapaId || !nome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Vincule a uma etapa e forneça o nome do entregável.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateEntregavelData = {
        etapa: etapaId,
        nome: nome.trim(),
        versao: versao.trim() || 'v1.0',
        status: 'atribuido',
        descricao: descricao.trim() || undefined,
        arquivo: arquivo || undefined,
      }

      await entregaveisService.create(payload)
      toast({ title: 'Entregável cadastrado com sucesso!' })
      setModalOpen(false)
      setNome('')
      setVersao('v1.0')
      setDescricao('')
      setArquivo(null)
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar entregável',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja excluir este entregável?')) return
    try {
      await entregaveisService.delete(id)
      toast({ title: 'Entregável removido' })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const entregaveisFiltrados =
    etapaFiltro === 'todas' ? entregaveis : entregaveis.filter((e) => e.etapa === etapaFiltro)

  return (
    <div className="space-y-4">
      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            Ciclo de Entregáveis & Versões ({entregaveis.length})
          </h3>
          <p className="text-xs text-slate-500">
            Fluxo técnico completo: Atribuído → Em Produção → Enviado p/ Revisão → Aprovado ou
            Devolvido com motivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
            <SelectTrigger className="h-8 text-xs w-[190px]">
              <SelectValue placeholder="Filtrar por etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Etapas / Pacotes</SelectItem>
              {etapas.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                if (etapas.length > 0 && !etapaId) {
                  setEtapaId(etapas[0].id)
                }
                setModalOpen(true)
              }}
              disabled={etapas.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-xs text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Entregável
            </Button>
          )}
        </div>
      </div>

      {/* Lista de Entregáveis */}
      {entregaveisFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-lg">
          <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhum entregável cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre os memoriais descritivos, pranchas ou relatórios técnicos deste projeto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entregaveisFiltrados.map((item) => {
            const metaStatus = STATUS_ENTREGAVEL_MAP[item.status] || STATUS_ENTREGAVEL_MAP.atribuido
            const StatusIcon = metaStatus.icon
            const etapaRel = etapas.find((e) => e.id === item.etapa)
            const hasArquivo = Boolean(item.arquivo)
            const versoes = versoesExpandidas[item.id]
            const carregandoVer = carregandoVersoes[item.id]

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-all overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {item.versao || (item.versao_atual ? `v${item.versao_atual}.0` : 'v1.0')}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">
                          {item.nome || item.titulo}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-semibold ${metaStatus.badge}`}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {metaStatus.label}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-500">
                        Pacote / Etapa:{' '}
                        <span className="font-medium text-slate-700">
                          {etapaRel?.nome || 'Geral'}
                        </span>
                        {item.prazo && (
                          <span className="ml-3">
                            Prazo:{' '}
                            <strong className="text-slate-700">{formatDateBr(item.prazo)}</strong>
                          </span>
                        )}
                        {item.expand?.revisor_interno?.name && (
                          <span className="ml-3">
                            Revisor:{' '}
                            <strong className="text-slate-700">
                              {item.expand.revisor_interno.name}
                            </strong>
                          </span>
                        )}
                      </p>

                      {item.descricao && (
                        <p className="text-xs text-slate-600 line-clamp-2">{item.descricao}</p>
                      )}

                      {/* Motivo de devolução visível */}
                      {item.motivo_devolucao && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-1.5 mt-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block">Motivo do retorno técnico:</span>
                            <p>{item.motivo_devolucao}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ações de Transição de Ciclo */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEntregavelParaOQueMudou(item)
                          setVersaoOQueMudouNum(item.versao_atual || undefined)
                          setModalOQueMudouAberto(true)
                        }}
                        className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1.5"
                        title="Comparar versão atual com a versão anterior"
                      >
                        <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                        <span>O que mudou</span>
                      </Button>

                      {/* Botão Submeter Nova Versão (Prestador ou Gestor) */}
                      {(item.status === 'atribuido' ||
                        item.status === 'em_producao' ||
                        item.status === 'devolvido' ||
                        item.status === 'elaborando') && (
                        <Button
                          size="sm"
                          onClick={() => abrirModalSubmeter(item)}
                          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {item.status === 'devolvido'
                            ? 'Submeter Nova Versão'
                            : 'Enviar p/ Revisão'}
                        </Button>
                      )}

                      {/* Botão Avaliar / Revisar (Revisor Interno / Gestor / Admin) */}
                      {item.status === 'enviado_revisao' && isRevisorOuAdmin && (
                        <Button
                          size="sm"
                          onClick={() => abrirModalAvaliar(item)}
                          className="h-8 text-xs bg-[#D95A2B] hover:bg-[#c44e24] text-white gap-1.5 font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Avaliar Versão
                        </Button>
                      )}

                      {hasArquivo && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openProtectedFile(item, item.arquivo)}
                          className="h-8 text-xs gap-1"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          Arquivo
                        </Button>
                      )}

                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluir(item.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Rodapé do Card com Histórico de Versões */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => alternarHistoricoVersoes(item.id)}
                      className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5 cursor-pointer text-[11px]"
                    >
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      {versoesExpandidas[item.id]
                        ? 'Ocultar Histórico'
                        : 'Ver Histórico de Versões'}
                      {versoesExpandidas[item.id] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    <span className="text-[11px] text-slate-400">
                      {item.data_aprovacao
                        ? `Aprovado em ${formatDateBr(item.data_aprovacao)}`
                        : `Criado em ${formatDateBr(item.created)}`}
                    </span>
                  </div>
                </div>

                {/* HISTÓRICO DE VERSÕES EXPANSÍVEL */}
                {versoesExpandidas[item.id] && (
                  <div className="bg-slate-50/80 border-t border-slate-200 p-4 space-y-2">
                    <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5 mb-2">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      Histórico e Rastreabilidade de Versões
                    </div>

                    {carregandoVer ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-600" />
                        Carregando versões...
                      </div>
                    ) : versoes && versoes.length > 0 ? (
                      <div className="space-y-2">
                        {versoes.map((v) => (
                          <div
                            key={v.id}
                            className="bg-white border rounded p-2.5 text-xs space-y-2"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                    v{v.numero_versao}.0
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] uppercase ${
                                      v.status === 'aprovado'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : v.status === 'devolvido'
                                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                                          : 'bg-amber-50 text-amber-700 border-amber-300'
                                    }`}
                                  >
                                    {v.status}
                                  </Badge>
                                  <span className="text-[11px] text-slate-400">
                                    Enviado em{' '}
                                    {v.enviado_em
                                      ? formatDateTimeBr(v.enviado_em)
                                      : formatDateTimeBr(v.created)}
                                    {v.expand?.enviado_por?.name &&
                                      ` por ${v.expand.enviado_por.name}`}
                                  </span>
                                </div>

                                {v.observacoes && (
                                  <p className="text-[11px] text-slate-600">
                                    <strong>Nota:</strong> {v.observacoes}
                                  </p>
                                )}

                                {v.motivo_devolucao && (
                                  <p className="text-[11px] text-rose-700">
                                    <strong>Motivo da devolução:</strong> {v.motivo_devolucao}
                                  </p>
                                )}

                                {v.avaliado_por && (
                                  <p className="text-[10px] text-slate-400">
                                    Avaliado por {v.expand?.avaliado_por?.name || 'Revisor'} em{' '}
                                    {formatDateTimeBr(v.avaliado_em || '')}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEntregavelParaOQueMudou(item)
                                    setVersaoOQueMudouNum(v.numero_versao)
                                    setModalOQueMudouAberto(true)
                                  }}
                                  className="h-6 text-[10px] text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                                  title="Ver comparativo desta versão"
                                >
                                  <GitCompare className="w-3 h-3 text-blue-600" />
                                  <span>Diff</span>
                                </Button>

                                {v.arquivo && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openProtectedFile(v, v.arquivo)}
                                    className="h-6 text-[10px] gap-1 shrink-0"
                                  >
                                    <Download className="w-3 h-3" />
                                    Arquivo da Versão
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* COMENTÁRIOS DE REVISÃO DA VERSÃO */}
                            <EntregavelVersaoComentarios
                              versaoId={v.id}
                              numeroVersao={v.numero_versao}
                              autorTipo="interno"
                              autorNome={user?.name || 'Revisor G+'}
                              autorUsuarioId={user?.id}
                              autorEmail={user?.email}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Nenhuma versão anterior registrada para este entregável.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL 1: SUBMETER VERSÃO PARA REVISÃO */}
      <Dialog open={modalSubmeterAberto} onOpenChange={setModalSubmeterAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Submeter Versão para Revisão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envie uma nova versão técnica do entregável{' '}
              <strong>"{entregavelCiclo?.nome || entregavelCiclo?.titulo}"</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Observações do Envio / Notas Técnicas
              </Label>
              <Textarea
                rows={3}
                placeholder="Descreva as alterações efetuadas nesta versão ou notas para o revisor..."
                value={observacoesSubmissao}
                onChange={(e) => setObservacoesSubmissao(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalSubmeterAberto(false)}
              disabled={processandoCiclo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmeterVersao}
              disabled={processandoCiclo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processandoCiclo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Submetendo...
                </>
              ) : (
                'Confirmar Submissão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: AVALIAR / HOMOLOGAR VERSÃO (COM MOTIVO OBRIGATÓRIO NA DEVOLUÇÃO) */}
      <Dialog open={modalAvaliarAberto} onOpenChange={setModalAvaliarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#D95A2B]" />
              Avaliação Técnica do Entregável
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revisão de conformidade técnica para{' '}
              <strong>"{entregavelCiclo?.nome || entregavelCiclo?.titulo}"</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Decisão Técnica *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisaoAvaliacao('aprovado')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    decisaoAvaliacao === 'aprovado'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  Aprovar Entregável
                </button>
                <button
                  type="button"
                  onClick={() => setDecisaoAvaliacao('devolvido')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    decisaoAvaliacao === 'devolvido'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  Devolver com Apontamentos
                </button>
              </div>
            </div>

            {decisaoAvaliacao === 'devolvido' && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs font-semibold text-rose-900">
                  Motivo da Devolução Técnica * (Obrigatório)
                </Label>
                <Textarea
                  rows={4}
                  placeholder="Descreva de forma detalhada as não-conformidades ou ajustes necessários..."
                  value={motivoDevolucao}
                  onChange={(e) => setMotivoDevolucao(e.target.value)}
                  className="text-xs border-rose-300 focus:border-rose-500"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalAvaliarAberto(false)}
              disabled={processandoCiclo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAvaliarVersao}
              disabled={processandoCiclo}
              className={
                decisaoAvaliacao === 'aprovado'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
            >
              {processandoCiclo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando parecer...
                </>
              ) : decisaoAvaliacao === 'aprovado' ? (
                'Confirmar Aprovação'
              ) : (
                'Devolver ao Prestador'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL "O QUE MUDOU" (METADADOS ATUAL × ANTERIOR) */}
      <ModalOQueMudou
        open={modalOQueMudouAberto}
        onOpenChange={setModalOQueMudouAberto}
        entregavelId={entregavelParaOQueMudou?.id || null}
        tituloEntregavel={entregavelParaOQueMudou?.nome || entregavelParaOQueMudou?.titulo}
        versaoAtualNum={versaoOQueMudouNum}
      />

      {/* Modal Criar Entregável */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cadastrar Entregável
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3 pt-1">
            <div>
              <Label>Etapa / Pacote Vinculado *</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a etapa ou pacote..." />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.nome} ({et.disciplina || 'Geral'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entregNome">Nome do Documento / Prancha *</Label>
              <Input
                id="entregNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Prancha 01 - Forma e Armação Vigas Térreo"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="versao">Versão Inicial</Label>
                <Input
                  id="versao"
                  value={versao}
                  onChange={(e) => setVersao(e.target.value)}
                  placeholder="v1.0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="entregDesc">Descrição / Observações Técnicas</Label>
              <Textarea
                id="entregDesc"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhamento do entregável técnico..."
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-blue-600 text-white"
              >
                {salvando ? 'Salvando...' : 'Cadastrar Entregável'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default EntregaveisTab
