import React, { useState } from 'react'
import {
  SubcontratoRecord,
  ItemChecklistEncerramento,
  STATUS_SUBCONTRATO_LABELS,
  STATUS_RETENCAO_LABELS,
  StatusSubcontrato,
} from '@/types'
import { subcontratosService } from '@/services/subcontratos'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr, formatarMoeda } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ExternalLink,
  Loader2,
  Lock,
  ArrowRight,
  Info,
  Scale,
} from 'lucide-react'

export interface BlocoDetalhesSubcontratoProps {
  subcontrato: SubcontratoRecord
  onUpdate?: () => void
  readOnly?: boolean
}

export const BlocoDetalhesSubcontrato: React.FC<BlocoDetalhesSubcontratoProps> = ({
  subcontrato,
  onUpdate,
  readOnly = false,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  const role = user?.role || ''
  const isAdminOrGestor = role === 'admin' || role === 'gestor'
  const isFinanceiroOrGestorOrAdmin = role === 'admin' || role === 'financeiro' || role === 'gestor'

  // Estados locais
  const [checklistExpandido, setChecklistExpandido] = useState(true)
  const [atualizandoChecklistId, setAtualizandoChecklistId] = useState<string | null>(null)

  // Modal de Transição de Status
  const [modalTransicaoOpen, setModalTransicaoOpen] = useState(false)
  const [novoStatusSelecionado, setNovoStatusSelecionado] = useState<StatusSubcontrato>(
    subcontrato.status,
  )
  const [transicionando, setTransicionando] = useState(false)

  // Modal de Liberação de Retenção Técnica
  const [modalRetencaoOpen, setModalRetencaoOpen] = useState(false)
  const [valorLiberar, setValorLiberar] = useState<string>('')
  const [justificativaRetencao, setJustificativaRetencao] = useState('')
  const [liberandoRetencao, setLiberandoRetencao] = useState(false)

  const retAcumulada = subcontrato.retencao_tecnica_acumulada || 0
  const retLiberada = subcontrato.retencao_tecnica_liberada || 0
  const saldoRetencao = Math.max(0, Math.round((retAcumulada - retLiberada) * 100) / 100)

  // Checklist de encerramento
  const checklist: ItemChecklistEncerramento[] =
    subcontrato.checklist_encerramento_json && subcontrato.checklist_encerramento_json.length > 0
      ? subcontrato.checklist_encerramento_json
      : [
          {
            id: 'art_rrt',
            titulo: 'ART / RRT recolhida e averbada',
            descricao: 'Anotação ou Registro de Responsabilidade Técnica comprovado pelo executor.',
            concluido: false,
          },
          {
            id: 'laudos',
            titulo: 'Laudos e entregáveis técnicos entregues e aprovados',
            descricao:
              'Todos os documentos, memórias de cálculo ou relatórios técnicos foram conferidos.',
            concluido: false,
          },
          {
            id: 'medicao_final',
            titulo: 'Medição final conferida e fechada',
            descricao: 'Escopo 100% medido e aprovado sem novas medições pendentes.',
            concluido: false,
          },
          {
            id: 'avaliacao_registrada',
            titulo: 'Avaliação do executor registrada no sistema',
            descricao:
              'Avaliação de prazo, qualidade e comunicação concluída na ficha de avaliações.',
            concluido: false,
          },
        ]

  const itensConcluidos = checklist.filter((i) => i.concluido).length
  const totalItens = checklist.length
  const checklistCompleto = totalItens > 0 && itensConcluidos === totalItens

  // Ciclo de vida passos ordenados
  const passosCiclo: Array<{ status: StatusSubcontrato; label: string; desc: string }> = [
    { status: 'minuta', label: 'Minuta', desc: 'Em elaboração interna' },
    { status: 'aguardando_assinatura', label: 'Aguard. Assinatura', desc: 'Enviado ao executor' },
    { status: 'assinado', label: 'Assinado', desc: 'Formalizado pelas partes' },
    { status: 'em_execucao', label: 'Em Execução', desc: '1ª medição / trabalhos em campo' },
    { status: 'concluido', label: 'Concluído', desc: 'Escopo técnico finalizado' },
    { status: 'avaliado', label: 'Avaliado', desc: 'Nota de desempenho registrada' },
    { status: 'encerrado', label: 'Encerrado', desc: 'Quitação plena e checklist 100%' },
  ]

  const statusAtualIdx = passosCiclo.findIndex((p) => p.status === subcontrato.status)

  // Ação de alternar item de checklist
  const handleToggleChecklistItem = async (item: ItemChecklistEncerramento) => {
    if (readOnly || !isAdminOrGestor) {
      toast({
        title: 'Acesso Restrito',
        description:
          'Apenas Administradores ou Gestores de Projetos podem marcar/reabrir itens do checklist.',
        variant: 'destructive',
      })
      return
    }

    setAtualizandoChecklistId(item.id)
    try {
      const res = await subcontratosService.atualizarChecklistItem(
        subcontrato.id,
        item.id,
        !item.concluido,
      )
      toast({
        title: item.concluido ? 'Item Reaberto' : 'Item Concluído',
        description: res.message || 'Checklist de encerramento atualizado com auditoria.',
      })
      if (onUpdate) onUpdate()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar checklist',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setAtualizandoChecklistId(null)
    }
  }

  // Ação de avançar transição de status
  const handleConfirmarTransicao = async () => {
    if (!isAdminOrGestor) return
    setTransicionando(true)
    try {
      const res = await subcontratosService.transicionarStatus(
        subcontrato.id,
        novoStatusSelecionado,
      )
      toast({
        title: 'Status Atualizado com Sucesso!',
        description: res.message || `Subcontrato transicionado para ${novoStatusSelecionado}.`,
      })
      setModalTransicaoOpen(false)
      if (onUpdate) onUpdate()
    } catch (err: any) {
      toast({
        title: 'Bloqueio de Transição',
        description: err.message || 'O servidor impediu a alteração do status.',
        variant: 'destructive',
      })
    } finally {
      setTransicionando(false)
    }
  }

  // Ação de liberar retenção técnica
  const handleConfirmarLiberacaoRetencao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFinanceiroOrGestorOrAdmin) return

    const vNum = parseFloat(valorLiberar.replace(',', '.'))
    if (isNaN(vNum) || vNum <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor numérico válido maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (vNum > saldoRetencao + 0.01) {
      toast({
        title: 'Valor excede saldo retido',
        description: `O valor máximo liberável é de ${formatCurrencyBr(saldoRetencao)}.`,
        variant: 'destructive',
      })
      return
    }

    setLiberandoRetencao(true)
    try {
      const res = await subcontratosService.liberarRetencao(
        subcontrato.id,
        vNum,
        justificativaRetencao.trim() || undefined,
      )
      toast({
        title: 'Retenção Técnica Liberada!',
        description: `${formatarMoeda(vNum)} liberados com sucesso. Conta a pagar gerada no Financeiro.`,
      })
      setModalRetencaoOpen(false)
      setValorLiberar('')
      setJustificativaRetencao('')
      if (onUpdate) onUpdate()
    } catch (err: any) {
      toast({
        title: 'Bloqueio na Liberação',
        description:
          err.message ||
          'A liberação de retenção requer que as medições correspondentes tenham sido aceitas pelo cliente.',
        variant: 'destructive',
      })
    } finally {
      setLiberandoRetencao(false)
    }
  }

  const statusSubInfo = STATUS_SUBCONTRATO_LABELS[subcontrato.status] || {
    label: subcontrato.status,
    cor: 'bg-slate-100 text-slate-700 border-slate-300',
  }
  const statusRetInfo = STATUS_RETENCAO_LABELS[subcontrato.status_retencao || 'sem_retencao'] || {
    label: 'Sem Retenção',
    cor: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      {/* CABEÇALHO DO SUBCONTRATO COM BADGES E STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 font-mono">
              {subcontrato.numero}
            </h4>
            <Badge
              variant="outline"
              className={`text-xs font-semibold px-2 py-0.5 border ${statusSubInfo.cor}`}
            >
              {statusSubInfo.label}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs font-medium px-2 py-0.5 border ${statusRetInfo.cor}`}
            >
              {statusRetInfo.label}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Executor: <strong>{subcontrato.expand?.executor?.nome || 'Não especificado'}</strong> •
            Modalidade:{' '}
            {subcontrato.modo_execucao === 'terceirizada_integral'
              ? 'Terceirização Integral (100%)'
              : 'Terceirização Parcial'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {subcontrato.token_assinatura && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs h-8 text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <a
                href={`/subcontrato/${subcontrato.token_assinatura}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1 text-[#D95A2B]" />
                Ficha Pública
              </a>
            </Button>
          )}

          {!readOnly &&
            isAdminOrGestor &&
            subcontrato.status !== 'encerrado' &&
            subcontrato.status !== 'cancelado' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNovoStatusSelecionado(subcontrato.status)
                  setModalTransicaoOpen(true)
                }}
                className="text-xs h-8 font-semibold text-slate-800 border-slate-300 hover:bg-slate-50"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                Avançar Ciclo
              </Button>
            )}
        </div>
      </div>

      {/* TIMELINE VISUAL DO CICLO DE VIDA DO SUBCONTRATO */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
          Ciclo de Vida do Subcontrato:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
          {passosCiclo.map((passo, idx) => {
            const isAtual = passo.status === subcontrato.status
            const isPassado = statusAtualIdx > idx && subcontrato.status !== 'cancelado'
            return (
              <div
                key={passo.status}
                className={`p-2 rounded-lg border transition-all ${
                  isAtual
                    ? 'bg-orange-50 border-[#D95A2B] text-orange-950 font-bold shadow-xs'
                    : isPassado
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {isPassado ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isAtual ? (
                    <Clock className="w-3.5 h-3.5 text-[#D95A2B] animate-pulse" />
                  ) : (
                    <Circle className="w-3 h-3 text-slate-300" />
                  )}
                  <span className="text-[11px] font-semibold">{passo.label}</span>
                </div>
                <span className="text-[10px] text-slate-500 block leading-tight">{passo.desc}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* BLOCO DE RETENÇÃO TÉCNICA AUDITADA */}
      <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 border border-amber-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              <h5 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Retenção Técnica de Garantia ({subcontrato.percentual_retencao_tecnica || 0}%)
              </h5>
              <Badge variant="outline" className={`text-[10px] ${statusRetInfo.cor}`}>
                {statusRetInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Valor retido a cada medição progressiva para caução técnica da entrega. Só pode ser
              liberado após a aceitação formal das etapas/medições pelo cliente.
            </p>
          </div>

          {!readOnly && isFinanceiroOrGestorOrAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setValorLiberar(saldoRetencao > 0 ? saldoRetencao.toFixed(2) : '0,00')
                setModalRetencaoOpen(true)
              }}
              disabled={saldoRetencao <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 font-semibold shadow-xs shrink-0"
              title={
                saldoRetencao <= 0
                  ? 'Não há saldo retido a liberar'
                  : 'Liberar valor da retenção técnica gerando conta a pagar'
              }
            >
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              Liberar Retenção
            </Button>
          )}
        </div>

        {/* CARDS COM METRICAS DE RETENCAO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-amber-200/60 text-xs">
          <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">
              Total Retido Acumulado
            </span>
            <span className="font-mono font-bold text-amber-900 text-sm">
              {formatCurrencyBr(retAcumulada)}
            </span>
          </div>
          <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">
              Total Já Liberado
            </span>
            <span className="font-mono font-bold text-blue-700 text-sm">
              {formatCurrencyBr(retLiberada)}
            </span>
          </div>
          <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">
              Saldo Disponível para Liberação
            </span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              {formatCurrencyBr(saldoRetencao)}
            </span>
          </div>
        </div>
      </div>

      {/* BLOCO EXPANSÍVEL: CHECKLIST DE ENCERRAMENTO AUDITADO (4 ITENS OBRIGATÓRIOS) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setChecklistExpandido(!checklistExpandido)}
          className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#D95A2B]" />
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Checklist de Encerramento Auditado ({itensConcluidos}/{totalItens})
              </span>
              <span className="text-[11px] text-slate-500">
                {checklistCompleto
                  ? 'Todos os 4 itens conferidos e concluídos. Encerramento elegível.'
                  : `Existem ${totalItens - itensConcluidos} item(ns) pendente(s) que bloqueiam o encerramento no servidor.`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[11px] font-semibold ${
                checklistCompleto
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {checklistCompleto ? 'Checklist Completo' : 'Pendências Restantes'}
            </Badge>
            {checklistExpandido ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {checklistExpandido && (
          <div className="p-4 space-y-2.5 divide-y divide-slate-100 text-xs">
            {checklist.map((item) => {
              const carregandoEste = atualizandoChecklistId === item.id
              return (
                <div
                  key={item.id}
                  className={`pt-2.5 first:pt-0 flex items-start justify-between gap-3 p-2 rounded-lg transition-colors ${
                    item.concluido ? 'bg-emerald-50/40' : 'bg-slate-50/50 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      disabled={readOnly || !isAdminOrGestor || carregandoEste}
                      onClick={() => handleToggleChecklistItem(item)}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                      title={
                        !isAdminOrGestor
                          ? 'Apenas Admin/Gestor podem alterar'
                          : item.concluido
                            ? 'Clique para desmarcar'
                            : 'Clique para marcar como concluído'
                      }
                    >
                      {carregandoEste ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#D95A2B]" />
                      ) : item.concluido ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    <div>
                      <strong
                        className={`block text-xs font-semibold ${
                          item.concluido
                            ? 'text-emerald-950 line-through decoration-emerald-500'
                            : 'text-slate-800'
                        }`}
                      >
                        {item.titulo}
                      </strong>
                      {item.descricao && (
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {item.descricao}
                        </p>
                      )}
                      {item.concluido && (
                        <span className="text-[10px] text-emerald-700 font-mono block mt-1">
                          Concluído por: {item.concluido_por || 'Sistema'}{' '}
                          {item.data_conclusao ? `em ${formatDateTimeBr(item.data_conclusao)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {!readOnly && isAdminOrGestor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={carregandoEste}
                      onClick={() => handleToggleChecklistItem(item)}
                      className={`h-7 text-[11px] px-2.5 font-medium shrink-0 ${
                        item.concluido
                          ? 'text-amber-700 hover:text-amber-800 hover:bg-amber-100/50'
                          : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/50'
                      }`}
                    >
                      {item.concluido ? 'Reabrir' : 'Marcar Concluído'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: TRANSIÇÃO DE STATUS DO CICLO DE VIDA (ADMIN / GESTOR) */}
      {modalTransicaoOpen && (
        <Dialog open={modalTransicaoOpen} onOpenChange={setModalTransicaoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-[#D95A2B]" />
                Avançar Ciclo de Vida do Subcontrato
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Subcontrato: <strong>{subcontrato.numero}</strong> • Status Atual:{' '}
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {statusSubInfo.label}
                </Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Selecione o Próximo Status:
                </Label>
                <select
                  value={novoStatusSelecionado}
                  onChange={(e) => setNovoStatusSelecionado(e.target.value as StatusSubcontrato)}
                  className="w-full mt-1.5 p-2 border border-slate-300 rounded-md text-xs bg-white font-medium text-slate-800"
                >
                  <option value="assinado">Assinado (Aguardando início de campo)</option>
                  <option value="em_execucao">Em Execução (Trabalhos em andamento)</option>
                  <option value="concluido">Concluído (Escopo técnico finalizado)</option>
                  <option value="avaliado">Avaliado (Avaliação de desempenho registrada)</option>
                  <option value="encerrado">Encerrado (Encerramento definitivo pleno)</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {novoStatusSelecionado === 'encerrado' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Regras Rígidas para Encerramento Definitivo:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                    <li>Avaliação do executor registrada na ficha de avaliações;</li>
                    <li>
                      Checklist de encerramento 100% concluído (ART, laudos, medição final,
                      avaliação);
                    </li>
                    <li>
                      Todas as contas a pagar vinculadas quitadas ou canceladas no Financeiro.
                    </li>
                  </ul>
                  <span className="text-[10px] text-slate-500 block pt-1">
                    O servidor bloqueará com mensagem detalhada se alguma pendência persistir.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalTransicaoOpen(false)}
                disabled={transicionando}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmarTransicao}
                disabled={transicionando || novoStatusSelecionado === subcontrato.status}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
              >
                {transicionando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Atualizando...
                  </>
                ) : (
                  'Confirmar Transição'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: LIBERAÇÃO DE RETENÇÃO TÉCNICA (ADMIN / FINANCEIRO / GESTOR) */}
      {modalRetencaoOpen && (
        <Dialog open={modalRetencaoOpen} onOpenChange={setModalRetencaoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Liberar Retenção Técnica do Subcontrato
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Subcontrato: <strong>{subcontrato.numero}</strong> • Saldo retido atual:{' '}
                <strong className="text-emerald-700 font-mono">
                  {formatCurrencyBr(saldoRetencao)}
                </strong>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmarLiberacaoRetencao} className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Exigência Contratual:</strong> A liberação só é permitida pelo servidor
                  após a <strong>aceitação formal das medições pelo cliente</strong>. Uma conta a
                  pagar será automaticamente gerada no Financeiro com vencimento em D+10 dias.
                </div>
              </div>

              <div>
                <Label htmlFor="valorRet" className="font-semibold text-slate-700">
                  Valor a Liberar (R$) *
                </Label>
                <Input
                  id="valorRet"
                  type="number"
                  step="0.01"
                  max={saldoRetencao}
                  value={valorLiberar}
                  onChange={(e) => setValorLiberar(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1 text-sm font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Máximo disponível: {formatCurrencyBr(saldoRetencao)}
                </span>
              </div>

              <div>
                <Label htmlFor="justifRet" className="font-semibold text-slate-700">
                  Justificativa / Parecer de Aceite
                </Label>
                <Textarea
                  id="justifRet"
                  rows={2}
                  value={justificativaRetencao}
                  onChange={(e) => setJustificativaRetencao(e.target.value)}
                  placeholder="Ex: Entrega final aprovada pelo cliente com termo de aceitação recebido em..."
                  className="mt-1 text-xs"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalRetencaoOpen(false)}
                  disabled={liberandoRetencao}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={liberandoRetencao}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {liberandoRetencao ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Processando...
                    </>
                  ) : (
                    'Liberar e Gerar Conta'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
