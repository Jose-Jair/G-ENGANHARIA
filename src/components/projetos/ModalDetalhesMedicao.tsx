import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MedicaoRecord } from '@/types'
import { openProtectedFile } from '@/lib/pocketbase/files'
import { medicoesService } from '@/services/medicoes'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Calendar,
  AlertTriangle,
  Download,
  ShieldAlert,
} from 'lucide-react'

interface ModalDetalhesMedicaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  medicao: MedicaoRecord | null
  canApprove: boolean // Admin ou Gestor
  onSuccess: () => void
}

export function ModalDetalhesMedicao({
  open,
  onOpenChange,
  medicao,
  canApprove,
  onSuccess,
}: ModalDetalhesMedicaoProps) {
  const [observacoesReprovacao, setObservacoesReprovacao] = useState('')
  const [modoReprovar, setModoReprovar] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [responsavelAceitacao, setResponsavelAceitacao] = useState('')
  const [processandoAceite, setProcessandoAceite] = useState(false)
  const [erroBloqueioEntregavel, setErroBloqueioEntregavel] = useState<string | null>(null)

  if (!medicao) return null

  const sub = medicao.expand?.subcontrato
  const exec = medicao.expand?.executor
  const aprovador = medicao.expand?.aprovada_por
  const isApresentada = medicao.status === 'apresentada'

  const handleAprovar = async () => {
    if (!medicao) return
    setProcessando(true)
    setErroBloqueioEntregavel(null)
    try {
      const res = await medicoesService.aprovar(medicao.id)
      toast({
        title: 'Medição Aprovada!',
        description: res.message || 'Boletim aprovado e conta a pagar lançada no Financeiro.',
      })
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao aprovar medição:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao aprovar medição.'
      if (
        msg.toLowerCase().includes('entregável') ||
        msg.toLowerCase().includes('entregavel') ||
        msg.toLowerCase().includes('aprovado') ||
        msg.toLowerCase().includes('gate')
      ) {
        setErroBloqueioEntregavel(
          `BLOQUEIO DE LIBERAÇÃO: A aprovação desta medição foi impedida pelo servidor porque os entregáveis técnicos da etapa/disciplina ainda não foram homologados/aprovados na íntegra. (${msg})`,
        )
      } else {
        toast({
          title: 'Não foi possível aprovar a medição',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      setProcessando(false)
    }
  }

  const handleReprovar = async () => {
    if (!medicao) return
    if (!observacoesReprovacao.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'Descreva detalhadamente o motivo da reprovação para o executor.',
        variant: 'destructive',
      })
      return
    }

    setProcessando(true)
    try {
      const res = await medicoesService.reprovar(medicao.id, observacoesReprovacao.trim())
      toast({
        title: 'Medição Reprovada',
        description: res.message || 'O executor foi notificado para reapresentação.',
      })
      onOpenChange(false)
      setModoReprovar(false)
      setObservacoesReprovacao('')
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao reprovar medição:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao reprovar medição.'
      toast({
        title: 'Não foi possível reprovar a medição',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessando(false)
    }
  }

  const handleAceitarCliente = async () => {
    if (!medicao) return
    setProcessandoAceite(true)
    try {
      const res = await medicoesService.aceitarPeloCliente(
        medicao.id,
        responsavelAceitacao.trim() || undefined,
      )
      toast({
        title: 'Aceitação Registrada!',
        description:
          res.message ||
          'A entrega desta medição foi formalmente aceita pelo cliente, liberando o teto de retenção técnica.',
      })
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao aceitar medição:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao registrar aceitação pelo cliente.'
      toast({
        title: 'Não foi possível registrar aceitação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessandoAceite(false)
    }
  }

  const getStatusBadge = () => {
    switch (medicao.status) {
      case 'apresentada':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300">
            Aguardando Aprovação
          </Badge>
        )
      case 'aprovada':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Aprovada</Badge>
        )
      case 'reprovada':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">Reprovada</Badge>
      case 'faturada':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Faturada</Badge>
      case 'paga':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            Paga / Liquidada
          </Badge>
        )
      default:
        return <Badge variant="outline">{medicao.status}</Badge>
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        if (!op) {
          setModoReprovar(false)
          setObservacoesReprovacao('')
        }
        onOpenChange(op)
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Medição {medicao.numero}
            </DialogTitle>
            {getStatusBadge()}
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Boletim de Medição #{String(medicao.numero_medicao).padStart(2, '0')} • Subcontrato{' '}
            {sub?.numero || 'SUB'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Alerta Visível de Bloqueio por Entregável não aprovado */}
          {erroBloqueioEntregavel && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-lg text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-800 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                Regra de Gate / Liberação Bloqueada
              </div>
              <p className="text-[11px] leading-relaxed text-rose-800">{erroBloqueioEntregavel}</p>
              <div className="pt-1 text-[10px] text-slate-600">
                Acesse a aba <strong>Entregáveis</strong> do projeto para revisar e aprovar as
                versões submetidas pelo prestador antes de aprovar a medição.
              </div>
            </div>
          )}
          {/* Card Resumo do Executor e Período */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Executor Contratado
              </span>
              <span className="font-semibold text-slate-900 block mt-0.5">
                {exec?.nome || 'Executor Externo'}
              </span>
              <span className="text-[10px] text-slate-500">{exec?.email}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Período de Execução
              </span>
              <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-slate-500" />
                {formatDateBr(medicao.periodo_inicio)} até {formatDateBr(medicao.periodo_fim)}
              </span>
              <span className="text-[10px] text-slate-500">
                Progresso Físico: <strong>{medicao.percentual_executado}%</strong>
              </span>
            </div>
          </div>

          {/* Valores Financeiros e Retenção Técnica */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Valor Bruto
              </span>
              <span className="font-mono font-bold text-blue-700 text-sm mt-0.5 block">
                {formatCurrencyBr(medicao.valor_bruto)}
              </span>
            </div>

            <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Ret. Impostos
              </span>
              <span className="font-mono font-bold text-slate-600 text-sm mt-0.5 block">
                {formatCurrencyBr(medicao.retencao_impostos || 0)}
              </span>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">
                Ret. Técnica ({medicao.percentual_retencao_tecnica || 0}%)
              </span>
              <span className="font-mono font-bold text-amber-900 text-sm mt-0.5 block">
                {formatCurrencyBr(medicao.valor_retencao_tecnica || 0)}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                Valor Líquido
              </span>
              <span className="font-mono font-bold text-emerald-800 text-sm mt-0.5 block">
                {formatCurrencyBr(medicao.valor_liquido)}
              </span>
            </div>
          </div>

          {/* Box de Aceitação do Cliente (Proteção da Retenção Técnica) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    medicao.aceita_pelo_cliente ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold text-slate-800 text-xs">
                  Aceitação Formal pelo Cliente (G+ / Contratante)
                </span>
              </div>
              <Badge
                className={
                  medicao.aceita_pelo_cliente
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }
              >
                {medicao.aceita_pelo_cliente ? 'Etapa Aceita pelo Cliente' : 'Aguardando Aceite'}
              </Badge>
            </div>

            {medicao.aceita_pelo_cliente ? (
              <p className="text-[11px] text-emerald-700 bg-emerald-50/60 p-2 rounded border border-emerald-200">
                Aceitação confirmada em{' '}
                {formatDateBr(medicao.data_aceitacao_cliente || medicao.updated)}
                {medicao.responsavel_aceitacao_cliente
                  ? ` por ${medicao.responsavel_aceitacao_cliente}`
                  : ''}
                . A parcela de retenção técnica deste boletim (
                {formatCurrencyBr(medicao.valor_retencao_tecnica || 0)}) está apta para liberação no
                subcontrato.
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-slate-500">
                  A retenção técnica só pode ser liberada ao executor após o cliente aceitar
                  formalmente a etapa correspondente.
                </p>
                {canApprove && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nome do responsável pelo aceite no cliente (ex: Fiscal de Contrato / Gestor)"
                      value={responsavelAceitacao}
                      onChange={(e) => setResponsavelAceitacao(e.target.value)}
                      className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAceitarCliente}
                      disabled={
                        processandoAceite ||
                        (medicao.status !== 'aprovada' &&
                          medicao.status !== 'faturada' &&
                          medicao.status !== 'paga')
                      }
                      title={
                        medicao.status !== 'aprovada' &&
                        medicao.status !== 'faturada' &&
                        medicao.status !== 'paga'
                          ? 'A medição precisa ser aprovada antes do aceite pelo cliente'
                          : 'Registrar aceite do cliente'
                      }
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 shrink-0 font-semibold"
                    >
                      {processandoAceite ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      Registrar Aceite do Cliente
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dados de Aprovação se houver */}
          {medicao.status === 'aprovada' && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Medição aprovada pelo Gestor</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Aprovada em {formatDateBr(medicao.data_aprovacao || medicao.updated)} por{' '}
                  {aprovador?.name || 'Administração'}. Conta a pagar gerada no módulo Financeiro.
                </p>
              </div>
            </div>
          )}

          {/* Dados de Reprovação se houver */}
          {medicao.status === 'reprovada' && medicao.observacoes_gestor && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Motivo da Reprovação / Ajustes Solicitados:
              </div>
              <p className="text-slate-800 bg-white p-2.5 rounded border border-rose-200 whitespace-pre-wrap leading-relaxed">
                {medicao.observacoes_gestor}
              </p>
            </div>
          )}

          {/* Anexos Comprobatórios */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 block">
              Comprovantes / Evidências Fotográficas ({medicao.anexos?.length || 0}):
            </span>
            {!medicao.anexos || medicao.anexos.length === 0 ? (
              <p className="text-slate-400 italic text-xs">
                Nenhum arquivo anexado a esta medição.
              </p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {medicao.anexos.map((fileName, idx) => {
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded"
                    >
                      <span className="truncate max-w-[340px] text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        {fileName}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openProtectedFile(medicao, fileName)}
                        className="h-6 text-[10px] px-2 text-slate-700 cursor-pointer"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Baixar
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Campo de Justificativa para Reprovação */}
          {modoReprovar && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-2 animate-in fade-in-50">
              <Label htmlFor="obsReprovar" className="text-xs font-bold text-rose-900 block">
                Justificativa da Reprovação (Obrigatória) *
              </Label>
              <Textarea
                id="obsReprovar"
                rows={3}
                placeholder="Descreva claramente quais entregas estão divergentes ou pendentes de correção..."
                value={observacoesReprovacao}
                onChange={(e) => setObservacoesReprovacao(e.target.value)}
                className="text-xs bg-white border-rose-300"
                required
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoReprovar(false)}
                  className="text-xs text-slate-600"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleReprovar}
                  disabled={processando || !observacoesReprovacao.trim()}
                  className="text-xs font-semibold"
                >
                  {processando ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Confirmar Reprovação'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex justify-between sm:justify-between items-center w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          {/* Ações de Aprovação/Reprovação exclusivas para Admin/Gestor em medições apresentadas */}
          {canApprove && isApresentada && !modoReprovar && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModoReprovar(true)}
                disabled={processando}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Reprovar Medição
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAprovar}
                disabled={processando}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Aprovar e Gerar Conta
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
