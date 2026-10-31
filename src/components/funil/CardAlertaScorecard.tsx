import React, { useState } from 'react'
import { AlertaScorecardUnificado } from '@/services/oQueFazerHoje'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Loader2,
  Award,
} from 'lucide-react'
import { prestadoresService } from '@/services/prestadores'
import { auditService } from '@/services/audit'
import { useToast } from '@/hooks/use-toast'

interface CardAlertaScorecardProps {
  alerta: AlertaScorecardUnificado
  onAcaoConcluida?: () => void
}

export const CardAlertaScorecard: React.FC<CardAlertaScorecardProps> = ({
  alerta,
  onAcaoConcluida,
}) => {
  const { toast } = useToast()
  const [modalDecisaoOpen, setModalDecisaoOpen] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [processando, setProcessando] = useState(false)

  const isSuspensao = alerta.tipo === 'sugestao_suspensao_scorecard'

  const handleDecisaoHumana = async (acao: 'suspender' | 'manter_ativo') => {
    setProcessando(true)
    try {
      if (acao === 'suspender') {
        // Suspende formalmente o prestador via serviço existente
        await prestadoresService.suspender(
          alerta.registro_id,
          justificativa.trim() ||
            `Suspensão técnica baseada no scorecard (queda acumulada / nota composta: ${alerta.indice_composto ?? 'baixa'})`,
        )
        toast({
          title: 'Decisão Humana Registrada: Prestador Suspenso',
          description: 'O prestador foi suspenso para novas convocações de OS.',
        })
      } else {
        // Registra em auditoria que a sugestão do scorecard foi avaliada pelo humano e rejeitada/mantida
        await auditService.log({
          action: 'scorecard_decisao_humana_manter_ativo',
          entity_type: 'prestadores',
          entity_id: alerta.registro_id,
          details: {
            motivo: justificativa.trim() || 'Gestor optou por manter ativo após avaliação técnica',
            scorecard_id: alerta.scorecard_id,
            indice_composto: alerta.indice_composto,
          },
        })
        toast({
          title: 'Decisão Humana Registrada: Mantido Ativo',
          description: 'A sugestão do scorecard foi avaliada e o prestador foi mantido ativo.',
        })
      }

      setModalDecisaoOpen(false)
      if (onAcaoConcluida) onAcaoConcluida()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar decisão',
        description: err.message || 'Falha na operação.',
        variant: 'destructive',
      })
    } finally {
      setProcessando(false)
    }
  }

  const renderIcone = () => {
    switch (alerta.tipo) {
      case 'sugestao_suspensao_scorecard':
        return <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
      case 'queda_brusca_scorecard':
        return <TrendingDown className="w-5 h-5 text-amber-600 shrink-0" />
      case 'atraso_pagamento_parceiro':
        return <Clock className="w-5 h-5 text-rose-600 shrink-0" />
      case 'sobrecarga_prestador_interno':
        return <Percent className="w-5 h-5 text-indigo-600 shrink-0" />
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
    }
  }

  const bgBorderClass = () => {
    if (alerta.prioridade === 'alta' || isSuspensao) {
      return 'bg-rose-50/60 border-rose-200 hover:border-rose-400'
    }
    if (alerta.tipo === 'sobrecarga_prestador_interno') {
      return 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400'
    }
    return 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
  }

  return (
    <>
      <Card className={`border shadow-2xs transition-all ${bgBorderClass()}`}>
        <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs mt-0.5">
              {renderIcone()}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">{alerta.titulo}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] capitalize ${
                    alerta.prioridade === 'alta'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  Prioridade {alerta.prioridade}
                </Badge>
                {alerta.indice_composto !== undefined && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white font-mono text-slate-700"
                  >
                    Composto: {alerta.indice_composto} pts
                  </Badge>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed">{alerta.descricao}</p>
              <div className="text-[11px] text-slate-500 font-medium">
                <strong>Ação recomendada:</strong> {alerta.acao_sugerida}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
            {isSuspensao ? (
              <Button
                size="sm"
                onClick={() => setModalDecisaoOpen(true)}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Decisão Humana Necessária
              </Button>
            ) : (
              <Badge variant="outline" className="bg-white text-slate-600 text-[11px] px-2 py-1">
                Alerta Informativo
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Decisão Humana Obrigatória */}
      <Dialog open={modalDecisaoOpen} onOpenChange={setModalDecisaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-900">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Decisão Humana: Sugestão de Suspensão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              O motor de Scorecard detectou queda crítica ou nota inferior ao limite técnico e
              sugere a suspensão deste prestador.
              <strong className="block text-slate-800 mt-1">
                A suspensão NUNCA é automática: exige intervenção expressa do gestor humano.
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-1">
            <div className="p-3 bg-slate-50 border rounded-lg space-y-1.5">
              <div className="text-slate-500">Alvo da análise:</div>
              <strong className="text-slate-900 block text-sm">{alerta.titulo}</strong>
              <p className="text-slate-600">{alerta.descricao}</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Justificativa da Decisão Gestora (opcional):
              </label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: Prestador reincidente em retrabalho / Ou: Concedida nova oportunidade com acompanhamento..."
                rows={3}
                className="w-full text-xs p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processando}
              onClick={() => handleDecisaoHumana('manter_ativo')}
              className="text-xs text-slate-700 hover:bg-slate-100 gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Manter Ativo (Rejeitar Suspensão)
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={processando}
              onClick={() => handleDecisaoHumana('suspender')}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1"
            >
              {processando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              Confirmar Suspensão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CardAlertaScorecard
