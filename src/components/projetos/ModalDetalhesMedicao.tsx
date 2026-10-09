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

  if (!medicao) return null

  const sub = medicao.expand?.subcontrato
  const exec = medicao.expand?.executor
  const aprovador = medicao.expand?.aprovada_por
  const isApresentada = medicao.status === 'apresentada'

  const handleAprovar = async () => {
    if (!medicao) return
    setProcessando(true)
    try {
      const res = await medicoesService.aprovar(medicao.id)
      toast({
        title: 'Medição Aprovada!',
        description: res.message || 'Conta a pagar gerada automaticamente no Financeiro.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao aprovar medição:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao aprovar medição.'
      toast({
        title: 'Não foi possível aprovar a medição',
        description: msg,
        variant: 'destructive',
      })
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

          {/* Valores Financeiros */}
          <div className="grid grid-cols-3 gap-2">
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
                Retenção Impostos
              </span>
              <span className="font-mono font-bold text-slate-600 text-sm mt-0.5 block">
                {formatCurrencyBr(medicao.retencao_impostos || 0)}
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
                  const url = medicoesService.getAnexoUrl(medicao, fileName)
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
                        asChild
                        className="h-6 text-[10px] px-2 text-slate-700"
                      >
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-3 h-3 mr-1" />
                          Baixar
                        </a>
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
