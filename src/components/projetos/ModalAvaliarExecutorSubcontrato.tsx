import React, { useMemo, useState } from 'react'
import { MedicaoRecord, SubcontratoRecord } from '@/types'
import {
  avaliacoesExecutorService,
  RegistrarAvaliacaoExecutorResponse,
} from '@/services/avaliacoesExecutor'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, Star, Paperclip, Award } from 'lucide-react'

interface ModalAvaliarExecutorSubcontratoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subcontrato: SubcontratoRecord | null
  medicoes: MedicaoRecord[] // medições do subcontrato selecionado
  onSuccess: () => void
}

interface CriterioNota {
  key: 'nota_prazo' | 'nota_qualidade' | 'nota_comunicacao'
  label: string
  descricao: string
  peso: number
}

const CRITERIOS: CriterioNota[] = [
  {
    key: 'nota_prazo',
    label: 'Prazo',
    descricao: 'Cumprimento do cronograma e dos prazos acordados',
    peso: 40,
  },
  {
    key: 'nota_qualidade',
    label: 'Qualidade',
    descricao: 'Qualidade técnica dos serviços executados e medições apresentadas',
    peso: 40,
  },
  {
    key: 'nota_comunicacao',
    label: 'Comunicação',
    descricao: 'Responsividade, clareza e postura profissional durante a execução',
    peso: 20,
  },
]

export const ModalAvaliarExecutorSubcontrato: React.FC<ModalAvaliarExecutorSubcontratoProps> = ({
  open,
  onOpenChange,
  subcontrato,
  medicoes,
  onSuccess,
}) => {
  const { toast } = useToast()

  const [salvando, setSalvando] = useState(false)
  const [notaPrazo, setNotaPrazo] = useState(5)
  const [notaQualidade, setNotaQualidade] = useState(5)
  const [notaComunicacao, setNotaComunicacao] = useState(5)
  const [comentarios, setComentarios] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])

  const executorNome = subcontrato?.expand?.executor?.nome || 'Executor'
  const medicoesPagas = medicoes.filter((m) => m.status === 'paga')
  const valorTotalPago = medicoesPagas.reduce((acc, m) => acc + (m.valor_liquido || 0), 0)

  // Prévia da nota ponderada (o cálculo oficial é feito no servidor)
  const notaPrevista = useMemo(
    () => (0.4 * notaPrazo + 0.4 * notaQualidade + 0.2 * notaComunicacao).toFixed(2),
    [notaPrazo, notaQualidade, notaComunicacao],
  )

  const resetForm = () => {
    setNotaPrazo(5)
    setNotaQualidade(5)
    setNotaComunicacao(5)
    setComentarios('')
    setAnexos([])
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subcontrato) return

    setSalvando(true)
    try {
      const res: RegistrarAvaliacaoExecutorResponse = await avaliacoesExecutorService.registrar(
        {
          subcontrato: subcontrato.id,
          nota_prazo: notaPrazo,
          nota_qualidade: notaQualidade,
          nota_comunicacao: notaComunicacao,
          comentarios: comentarios.trim() || undefined,
        },
        anexos.length > 0 ? anexos : undefined,
      )

      toast({
        title: 'Avaliação registrada com sucesso!',
        description: `${res.message} Nota geral do executor atualizada para ${res.avaliacao.nota_geral_depois.toFixed(2)}.`,
      })
      resetForm()
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar avaliação',
        description: err?.message || 'Falha ao registrar a avaliação do executor.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const renderEstrelas = (value: number, onChange: (val: number) => void, disabled: boolean) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((estrela) => (
        <button
          key={estrela}
          type="button"
          disabled={disabled}
          onClick={() => onChange(estrela)}
          className="w-8 h-8 rounded transition-all flex items-center justify-center hover:scale-110"
          aria-label={`${estrela} estrela(s)`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              value >= estrela
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-100 text-slate-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-black text-slate-900 w-8 text-center">{value}</span>
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#D95A2B]" />
            Avaliar Executor do Subcontrato
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Avaliação final de desempenho vinculada à conclusão do subcontrato. Cada subcontrato
            pode ser avaliado <strong>apenas uma vez</strong>.
          </p>
        </DialogHeader>

        {/* Resumo do Subcontrato como contexto */}
        {subcontrato && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-slate-900">{subcontrato.numero}</span>
              <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold">
                {subcontrato.status}
              </Badge>
            </div>
            <div className="text-xs text-slate-600">
              Executor: <strong className="text-slate-800">{executorNome}</strong>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Valor do subcontrato:{' '}
                <strong className="font-mono text-slate-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    subcontrato.valor_total || 0,
                  )}
                </strong>
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/70 pt-1.5">
              <span>
                Medições pagas: <strong className="text-emerald-700">{medicoesPagas.length}</strong>{' '}
                de {medicoes.length}
              </span>
              <span>
                Total pago (líquido):{' '}
                <strong className="font-mono text-emerald-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    valorTotalPago,
                  )}
                </strong>
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-3">
          {CRITERIOS.map((criterio) => {
            const value =
              criterio.key === 'nota_prazo'
                ? notaPrazo
                : criterio.key === 'nota_qualidade'
                  ? notaQualidade
                  : notaComunicacao
            const onChange =
              criterio.key === 'nota_prazo'
                ? setNotaPrazo
                : criterio.key === 'nota_qualidade'
                  ? setNotaQualidade
                  : setNotaComunicacao

            return (
              <div
                key={criterio.key}
                className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-xs text-slate-800 block">
                    {criterio.label}{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      (peso {criterio.peso}%)
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400">{criterio.descricao}</span>
                </div>
                {renderEstrelas(value, onChange, salvando)}
              </div>
            )
          })}

          {/* Nota ponderada em tempo real (prévia — cálculo oficial no servidor) */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-amber-900">
              Nota ponderada: 40% Prazo + 40% Qualidade + 20% Comunicação
            </span>
            <span className="text-base font-black text-amber-900">{notaPrevista} / 5.00</span>
          </div>

          <div>
            <Label htmlFor="comentarios-avaliacao">Comentários / Parecer Final</Label>
            <Textarea
              id="comentarios-avaliacao"
              rows={3}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Descreva pontos fortes, ocorrências e recomendações para futuras contratações..."
            />
          </div>

          <div>
            <Label htmlFor="anexos-avaliacao" className="flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              Anexos (opcional — fotos, laudos, relatórios)
            </Label>
            <input
              id="anexos-avaliacao"
              type="file"
              multiple
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 mt-1"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                setAnexos(files.slice(0, 5))
              }}
            />
            {anexos.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                {anexos.length} arquivo(s) selecionado(s)
              </p>
            )}
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Avaliação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
