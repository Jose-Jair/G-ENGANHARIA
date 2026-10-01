import React, { useState } from 'react'
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
import { AlertCircle, CheckCircle2, RotateCcw, Calendar, Loader2 } from 'lucide-react'
import { CampanhaRecord } from '@/types'
import { campanhasService } from '@/services/campanhas'
import { useToast } from '@/hooks/use-toast'

interface ModalAprovacaoAgendamentoProps {
  campanha: CampanhaRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  adminId: string
  diaEnvioPadrao?: number
}

export function ModalAprovacaoAgendamento({
  campanha,
  open,
  onOpenChange,
  onSuccess,
  adminId,
  diaEnvioPadrao = 5,
}: ModalAprovacaoAgendamentoProps) {
  const { toast } = useToast()
  const [modo, setModo] = useState<'aprovar' | 'devolver' | 'agendar'>('aprovar')
  const [observacaoDevolucao, setObservacaoDevolucao] = useState('')
  const [dataEnvio, setDataEnvio] = useState(() => {
    // Sugerir o próximo dia 5 do mês seguinte ou atual
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth() + 1
    const proximoMes = mes === 12 ? 1 : mes + 1
    const proximoAno = mes === 12 ? ano + 1 : ano
    const diaFormatado = String(diaEnvioPadrao).padStart(2, '0')
    const mesFormatado = String(proximoMes).padStart(2, '0')
    return `${proximoAno}-${mesFormatado}-${diaFormatado}`
  })
  const [loading, setLoading] = useState(false)

  if (!campanha) return null

  const handleAprovar = async () => {
    setLoading(true)
    try {
      await campanhasService.aprovar(campanha.id, adminId)
      toast({
        title: 'Campanha Aprovada!',
        description:
          'A campanha foi aprovada e está pronta para agendamento ou disparo pelo Administrador.',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao aprovar',
        description: err instanceof Error ? err.message : 'Falha na aprovação da campanha.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDevolver = async () => {
    if (!observacaoDevolucao.trim()) {
      toast({
        title: 'Observação obrigatória',
        description: 'Informe o motivo da devolução para que o Comercial saiba o que revisar.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await campanhasService.devolver(campanha.id, observacaoDevolucao.trim())
      toast({
        title: 'Campanha Devolvida',
        description: 'A campanha retornou para o status Devolvida com sua observação registrada.',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao devolver',
        description: err instanceof Error ? err.message : 'Falha na devolução.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAgendar = async () => {
    if (!dataEnvio) {
      toast({
        title: 'Data obrigatória',
        description: 'Defina a data prevista de disparo mensal.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const dataIso = `${dataEnvio} 10:00:00.000Z`
      await campanhasService.agendar(campanha.id, dataIso, adminId)
      toast({
        title: 'Campanha Agendada!',
        description: `Disparo agendado para ${new Date(dataIso).toLocaleDateString('pt-BR')}.`,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao agendar',
        description: err instanceof Error ? err.message : 'Falha no agendamento.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              Controle de Aprovação e Agendamento (Admin)
            </DialogTitle>
            <Badge variant="outline" className="text-xs uppercase">
              {campanha.status}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Campanha: <strong className="text-slate-800">{campanha.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Abas de Ação */}
        <div className="flex border-b border-slate-200 gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setModo('aprovar')}
            className={`pb-2 px-3 border-b-2 transition-colors ${
              modo === 'aprovar'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Aprovar Campanha
          </button>
          <button
            type="button"
            onClick={() => setModo('agendar')}
            className={`pb-2 px-3 border-b-2 transition-colors ${
              modo === 'agendar'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Definir Agendamento
          </button>
          <button
            type="button"
            onClick={() => setModo('devolver')}
            className={`pb-2 px-3 border-b-2 transition-colors ${
              modo === 'devolver'
                ? 'border-amber-600 text-amber-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Devolver com Ajustes
          </button>
        </div>

        {modo === 'aprovar' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Aprovação da Campanha para Disparo
              </p>
              <p className="mt-1 text-emerald-800 text-[11px]">
                Ao aprovar, a campanha estará validada tecnicamente pelo Administrador. Você poderá
                agendá-la para o dia mensal padrão ou dispará-la de imediato.
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-600 space-y-1">
              <div>
                Assunto: <strong>{campanha.assunto || '(Sem assunto)'}</strong>
              </div>
              <div>
                Segmento: <strong>Curva {campanha.segmento}</strong>
              </div>
            </div>
          </div>
        )}

        {modo === 'agendar' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
              <p className="font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                Agendamento do Envio Mensal
              </p>
              <p className="mt-1 text-blue-800 text-[11px]">
                Parâmetro padrão configurado para o <strong>dia {diaEnvioPadrao}</strong> de cada
                mês. Como não há tarefas agendadas em segundo plano, ao abrir o sistema após esta
                data a campanha será exibida com o status{' '}
                <em>"Pronta para Envio / Pendente de Disparo"</em>.
              </p>
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">
                Data Prevista de Envio:
              </label>
              <input
                type="date"
                value={dataEnvio}
                onChange={(e) => setDataEnvio(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        )}

        {modo === 'devolver' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
              <p className="font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Devolver Campanha ao Comercial
              </p>
              <p className="mt-1 text-amber-800 text-[11px]">
                A campanha voltará ao status <strong>devolvida</strong> e o Comercial poderá
                corrigir o texto, assunto ou segmentação conforme suas orientações.
              </p>
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">
                Observação / Orientações para o Comercial:
              </label>
              <textarea
                rows={3}
                value={observacaoDevolucao}
                onChange={(e) => setObservacaoDevolucao(e.target.value)}
                placeholder="Ex: Favor ajustar a chamada técnica do contrato e garantir que a proposta preliminar não cite prazos curtos..."
                className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          {modo === 'aprovar' && (
            <Button
              size="sm"
              onClick={handleAprovar}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirmar Aprovação
            </Button>
          )}

          {modo === 'agendar' && (
            <Button
              size="sm"
              onClick={handleAgendar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirmar Agendamento
            </Button>
          )}

          {modo === 'devolver' && (
            <Button
              size="sm"
              onClick={handleDevolver}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Devolver ao Comercial
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
