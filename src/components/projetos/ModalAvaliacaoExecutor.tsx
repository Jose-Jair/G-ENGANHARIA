import React, { useState } from 'react'
import { ProjetoEtapaRecord, PesosAvaliacaoExecutor } from '@/types'
import { avaliacoesService, CreateAvaliacaoData } from '@/services/executores'
import { parametrosService } from '@/services/parametros'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Star } from 'lucide-react'

interface ModalAvaliacaoExecutorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  etapa: ProjetoEtapaRecord | null
  onSuccess: () => void
}

export const ModalAvaliacaoExecutor: React.FC<ModalAvaliacaoExecutorProps> = ({
  open,
  onOpenChange,
  etapa,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [salvando, setSalvando] = useState(false)
  const [pontualidade, setPontualidade] = useState(5)
  const [qualidade, setQualidade] = useState(5)
  const [desvioCusto, setDesvioCusto] = useState(5)
  const [responsividade, setResponsividade] = useState(5)
  const [comentario, setComentario] = useState('')
  const [pesos, setPesos] = useState<PesosAvaliacaoExecutor>({
    peso_pontualidade: 30,
    peso_qualidade: 35,
    peso_desvio_custo: 20,
    peso_responsividade: 15,
  })

  React.useEffect(() => {
    if (open) {
      parametrosService
        .getByKey('pesos_avaliacao_executor')
        .then((p) => {
          if (p?.valor) {
            try {
              setPesos(JSON.parse(p.valor))
            } catch {
              /* intentionally ignored */
            }
          }
        })
        .catch(() => {})
    }
  }, [open])

  // Cálculo da nota ponderada instantânea
  const somaPesos =
    pesos.peso_pontualidade +
      pesos.peso_qualidade +
      pesos.peso_desvio_custo +
      pesos.peso_responsividade || 100

  const notaPonderadaCalculada =
    (pontualidade * pesos.peso_pontualidade +
      qualidade * pesos.peso_qualidade +
      desvioCusto * pesos.peso_desvio_custo +
      responsividade * pesos.peso_responsividade) /
    somaPesos

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!etapa || !etapa.executor) {
      toast({
        title: 'Sem executor vinculado',
        description: 'Esta etapa não possui executor associado.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateAvaliacaoData = {
        executor: etapa.executor,
        etapa: etapa.id,
        avaliado_por: user?.id,
        pontualidade,
        qualidade,
        desvio_custo: desvioCusto,
        responsividade,
        comentario: comentario.trim() || undefined,
      }

      await avaliacoesService.create(payload, pesos)
      toast({
        title: 'Avaliação registrada com sucesso!',
        description: `Nota final ponderada: ${notaPonderadaCalculada.toFixed(2)}/5.00`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar avaliação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const renderRatingButtons = (
    label: string,
    peso: number,
    value: number,
    onChange: (val: number) => void,
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
      <div>
        <span className="font-semibold text-xs text-slate-800 block">{label}</span>
        <span className="text-[10px] text-slate-400">Peso no cálculo: {peso}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-7 h-7 rounded text-xs font-bold transition-all flex items-center justify-center ${
              value >= star
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
            }`}
          >
            {star}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Avaliar Executor da Etapa
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Etapa concluída: <strong className="text-slate-700">{etapa?.nome}</strong>
          </p>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-3 pt-1">
          {renderRatingButtons(
            '1. Pontualidade (Cumprimento do Cronograma)',
            pesos.peso_pontualidade,
            pontualidade,
            setPontualidade,
          )}

          {renderRatingButtons(
            '2. Qualidade Técnica dos Entregáveis',
            pesos.peso_qualidade,
            qualidade,
            setQualidade,
          )}

          {renderRatingButtons(
            '3. Desvio de Custo / Orçamento',
            pesos.peso_desvio_custo,
            desvioCusto,
            setDesvioCusto,
          )}

          {renderRatingButtons(
            '4. Responsividade e Comunicação',
            pesos.peso_responsividade,
            responsividade,
            setResponsividade,
          )}

          {/* Resultado Ponderado em Tempo Real */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900">
              Nota Geral Calculada (Média Ponderada):
            </span>
            <span className="text-base font-black text-blue-900">
              {notaPonderadaCalculada.toFixed(2)} / 5.00
            </span>
          </div>

          <div>
            <Label htmlFor="coment">Parecer Técnico / Comentários</Label>
            <Textarea
              id="coment"
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Descreva pontos fortes ou oportunidades de melhoria desta entrega..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Avaliação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
