import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubcontratoRecord } from '@/types'
import { medicoesService } from '@/services/medicoes'
import { formatCurrencyBr } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import { Loader2, Plus, Upload, AlertCircle, FileText } from 'lucide-react'

interface ModalNovaMedicaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subcontratos: SubcontratoRecord[]
  subcontratoPreSelecionadoId?: string
  onSuccess: () => void
}

export function ModalNovaMedicao({
  open,
  onOpenChange,
  subcontratos,
  subcontratoPreSelecionadoId,
  onSuccess,
}: ModalNovaMedicaoProps) {
  const [subcontratoId, setSubcontratoId] = useState<string>('')
  const [periodoInicio, setPeriodoInicio] = useState<string>('')
  const [periodoFim, setPeriodoFim] = useState<string>('')
  const [percentualExecutado, setPercentualExecutado] = useState<string>('')
  const [valorBruto, setValorBruto] = useState<string>('')
  const [retencaoImpostos, setRetencaoImpostos] = useState<string>('0')
  const [anexos, setAnexos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)

  // Subcontratos assinados válidos
  const subcontratosValidos = subcontratos.filter((s) => s.status === 'assinado')

  useEffect(() => {
    if (open) {
      if (subcontratoPreSelecionadoId) {
        setSubcontratoId(subcontratoPreSelecionadoId)
      } else if (subcontratosValidos.length > 0) {
        setSubcontratoId(subcontratosValidos[0].id)
      } else {
        setSubcontratoId('')
      }
      // Datas padrão: primeiro ao último dia do mês atual
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const primeiroDia = `${y}-${m}-01`
      const ultDiaNum = new Date(y, now.getMonth() + 1, 0).getDate()
      const ultimoDia = `${y}-${m}-${String(ultDiaNum).padStart(2, '0')}`

      setPeriodoInicio(primeiroDia)
      setPeriodoFim(ultimoDia)
      setPercentualExecutado('')
      setValorBruto('')
      setRetencaoImpostos('0')
      setAnexos([])
    }
  }, [open, subcontratoPreSelecionadoId])

  const subcontratoSelecionado = subcontratos.find((s) => s.id === subcontratoId)

  // Calcular valor bruto sugerido a partir da porcentagem se o usuário mudar a %
  const handlePercentualChange = (val: string) => {
    setPercentualExecutado(val)
    const num = parseFloat(val)
    if (!isNaN(num) && subcontratoSelecionado && subcontratoSelecionado.valor_total > 0) {
      const calc = Math.round(((subcontratoSelecionado.valor_total * num) / 100) * 100) / 100
      setValorBruto(calc.toFixed(2))
    }
  }

  // Calcular porcentagem sugerida se o usuário mudar o valor bruto
  const handleValorBrutoChange = (val: string) => {
    setValorBruto(val)
    const num = parseFloat(val)
    if (!isNaN(num) && subcontratoSelecionado && subcontratoSelecionado.valor_total > 0) {
      const perc = Math.round((num / subcontratoSelecionado.valor_total) * 100 * 10) / 10
      setPercentualExecutado(perc.toString())
    }
  }

  const numValorBruto = parseFloat(valorBruto) || 0
  const numRetencao = parseFloat(retencaoImpostos) || 0
  const valorLiquidoCalculado = Math.max(0, Math.round((numValorBruto - numRetencao) * 100) / 100)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setAnexos((prev) => [...prev, ...filesArray])
    }
  }

  const handleRemoveFile = (index: number) => {
    setAnexos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subcontratoId) {
      toast({
        title: 'Selecione um subcontrato',
        description: 'É necessário vincular a medição a um subcontrato assinado.',
        variant: 'destructive',
      })
      return
    }

    if (!periodoInicio || !periodoFim) {
      toast({
        title: 'Período obrigatório',
        description: 'Informe as datas de início e fim da medição.',
        variant: 'destructive',
      })
      return
    }

    if (numValorBruto <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O valor bruto da medição deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const res = await medicoesService.criar({
        subcontrato: subcontratoId,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        percentual_executado: parseFloat(percentualExecutado) || 0,
        valor_bruto: numValorBruto,
        retencao_impostos: numRetencao,
        anexos: anexos,
      })

      toast({
        title: 'Medição Apresentada!',
        description: res.message || 'A medição foi registrada e aguarda validação do Gestor.',
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao apresentar medição:', err)
      const msg = err?.data?.message || err?.message || 'Falha ao registrar medição.'
      toast({
        title: 'Não foi possível apresentar a medição',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#D95A2B]" />
            Apresentar Medição Progressiva
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Cadastre os serviços executados no período com valores e comprovação técnica
            (relatórios/fotos).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {subcontratosValidos.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Nenhum subcontrato assinado disponível.</p>
                <p className="mt-0.5 text-amber-700">
                  Para emitir uma medição, o projeto precisa possuir um subcontrato no status
                  "assinado".
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Seleção do Subcontrato */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Subcontrato Vinculado *
                </Label>
                <Select value={subcontratoId} onValueChange={setSubcontratoId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione o subcontrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcontratosValidos.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id} className="text-xs">
                        {sub.numero} — {sub.expand?.executor?.nome || 'Executor'} —{' '}
                        {formatCurrencyBr(sub.valor_total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcontratoSelecionado && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex justify-between items-center text-slate-600">
                    <span>
                      Executor: <strong>{subcontratoSelecionado.expand?.executor?.nome}</strong>
                    </span>
                    <span>
                      Valor Total:{' '}
                      <strong>{formatCurrencyBr(subcontratoSelecionado.valor_total)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Período da Medição */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="periodoInicio" className="text-xs font-semibold text-slate-700">
                    Período Início *
                  </Label>
                  <Input
                    id="periodoInicio"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="periodoFim" className="text-xs font-semibold text-slate-700">
                    Período Fim *
                  </Label>
                  <Input
                    id="periodoFim"
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Percentual e Valor Bruto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="perc" className="text-xs font-semibold text-slate-700">
                    % Executado nesta Medição *
                  </Label>
                  <Input
                    id="perc"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    placeholder="Ex: 25.0"
                    value={percentualExecutado}
                    onChange={(e) => handlePercentualChange(e.target.value)}
                    required
                    className="text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bruto" className="text-xs font-semibold text-slate-700">
                    Valor Bruto (R$) *
                  </Label>
                  <Input
                    id="bruto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={valorBruto}
                    onChange={(e) => handleValorBrutoChange(e.target.value)}
                    required
                    className="text-xs font-semibold text-blue-700"
                  />
                </div>
              </div>

              {/* Retenção de Impostos e Valor Líquido */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="retencao" className="text-xs font-semibold text-slate-700">
                    Retenção de Impostos (R$)
                  </Label>
                  <Input
                    id="retencao"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={retencaoImpostos}
                    onChange={(e) => setRetencaoImpostos(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Valor Líquido a Pagar (R$)
                  </Label>
                  <div className="h-9 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold text-emerald-800 flex items-center">
                    {formatCurrencyBr(valorLiquidoCalculado)}
                  </div>
                </div>
              </div>

              {/* Upload de Anexos (Fotos / Relatório) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Evidências / Relatório Fotográfico de Execução (Opcional)
                </Label>
                <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.zip"
                    onChange={handleFileChange}
                    className="text-xs cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Formatos suportados: PDF, JPG, PNG, ZIP (até 20 MB por arquivo)
                  </span>
                </div>

                {anexos.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Arquivos selecionados ({anexos.length}):
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {anexos.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded text-xs"
                        >
                          <span className="truncate max-w-[280px] text-slate-700 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                            {file.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(idx)}
                            className="h-5 text-rose-600 text-[10px] hover:bg-rose-50"
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando || subcontratosValidos.length === 0}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Gravando...
                </>
              ) : (
                'Apresentar Medição'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
