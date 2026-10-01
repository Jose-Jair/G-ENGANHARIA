import React, { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { projetosService, SugestaoSaudeProjeto } from '@/services/projetos'
import { financeiroService } from '@/services/financeiro'
import { SaudeProjeto } from '@/types'
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'

interface ModalSaudeProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string
  codigoProjeto: string
  saudeAtual?: SaudeProjeto
  justificativaAtual?: string
  onSuccess: () => void
}

export const ModalSaudeProjeto: React.FC<ModalSaudeProjetoProps> = ({
  open,
  onOpenChange,
  projetoId,
  codigoProjeto,
  saudeAtual = 'verde',
  justificativaAtual = '',
  onSuccess,
}) => {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [carregandoSugestao, setCarregandoSugestao] = useState(false)
  const [sugestao, setSugestao] = useState<SugestaoSaudeProjeto | null>(null)

  const [saude, setSaude] = useState<SaudeProjeto>(saudeAtual)
  const [justificativa, setJustificativa] = useState(justificativaAtual)

  const carregarSugestaoAutomatica = async () => {
    if (!projetoId) return
    setCarregandoSugestao(true)
    try {
      const [completo, contasPagar] = await Promise.all([
        projetosService.getProjetoCompleto(projetoId),
        financeiroService.listContas({ tipo: 'pagar', projeto: projetoId }),
      ])
      const resultado = projetosService.calcularSugestaoSaude(
        completo.projeto,
        completo.etapas,
        completo.riscos,
        completo.documentos,
        contasPagar,
      )
      setSugestao(resultado)
      // Se não havia saúde ou se está abrindo, sugere a calculada por padrão
      if (!justificativaAtual) {
        setSaude(resultado.sugestao)
      }
    } catch (err) {
      console.error('Erro ao calcular sugestão de saúde:', err)
    } finally {
      setCarregandoSugestao(false)
    }
  }

  useEffect(() => {
    if (open) {
      setSaude(saudeAtual)
      setJustificativa(justificativaAtual || '')
      carregarSugestaoAutomatica()
    }
  }, [open, projetoId, saudeAtual, justificativaAtual])

  const concordou = sugestao ? saude === sugestao.sugestao : true

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!concordou && !justificativa.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description:
          'Você está divergindo da sugestão automática por métricas. A justificativa é obrigatória e será auditada.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const justificativaFinal =
        justificativa.trim() ||
        (concordou
          ? `Concordância com a sugestão calculada (${sugestao?.sugestao}) por métricas do projeto.`
          : '')

      await projetosService.updateSaude(
        projetoId,
        saude,
        justificativaFinal,
        sugestao?.sugestao,
        sugestao?.motivos,
      )
      toast({
        title: 'Saúde do projeto atualizada!',
        description: concordou
          ? 'Concordância com a métrica registrada na auditoria.'
          : 'Divergência com justificativa registrada na auditoria.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar saúde',
        description: err.message || 'Falha ao atualizar registro no banco',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const getCorBadge = (s: SaudeProjeto) => {
    if (s === 'verde') return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    if (s === 'amarelo') return 'bg-amber-50 text-amber-800 border-amber-300'
    return 'bg-rose-50 text-rose-800 border-rose-300'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Classificação de Saúde — {codigoProjeto}
            </DialogTitle>
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
              Sugestão por Métricas
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            A saúde é calculada automaticamente a partir de etapas atrasadas, riscos Alto/Alto em
            aberto, documentos vencidos e situação financeira. O Gestor pode concordar ou divergir
            com justificativa.
          </p>
        </DialogHeader>

        {/* Card da Sugestão Automática por Métricas */}
        {carregandoSugestao ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            Analisando etapas, riscos, documentos e financeiro...
          </div>
        ) : sugestao ? (
          <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Sugestão Automática Calculada:
              </span>
              <Badge
                variant="outline"
                className={`font-bold capitalize text-xs ${getCorBadge(sugestao.sugestao)}`}
              >
                {sugestao.sugestao === 'verde' && '🟢 Verde (Estável)'}
                {sugestao.sugestao === 'amarelo' && '🟡 Amarelo (Atenção)'}
                {sugestao.sugestao === 'vermelho' && '🔴 Vermelho (Crítico)'}
              </Badge>
            </div>

            <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
              {sugestao.motivos.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>

            <div className="flex items-center gap-2 pt-1 border-t border-indigo-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                onClick={() => {
                  setSaude(sugestao.sugestao)
                  setJustificativa(
                    'Concordo com a sugestão calculada com base nos indicadores estatísticos.',
                  )
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Concordar com a sugestão
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          <div>
            <Label className="text-xs font-semibold">Decisão Final do Gestor</Label>
            <Select value={saude} onValueChange={(val: SaudeProjeto) => setSaude(val)}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verde">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-semibold text-emerald-800">
                      Verde — No Prazo / Estável
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="amarelo">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span className="font-semibold text-amber-800">
                      Amarelo — Atenção / Risco de Prazo
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="vermelho">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    <span className="font-semibold text-rose-800">
                      Vermelho — Crítico / Bloqueado / Atraso
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {sugestao && saude !== sugestao.sugestao && (
              <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Atenção:</strong> Você está divergindo da sugestão automática (
                  {sugestao.sugestao} → {saude}). A justificativa é <strong>obrigatória</strong> e
                  ficará registrada na auditoria.
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="justificativa" className="text-xs font-semibold">
                Justificativa do Gestor {concordou ? '(Opcional se concordar)' : '*(Obrigatória)'}
              </Label>
              {concordou ? (
                <span className="text-[10px] text-emerald-600 font-medium">
                  Em concordância com as métricas
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 font-bold">Divergência auditada</span>
              )}
            </div>
            <Textarea
              id="justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={
                concordou
                  ? 'Opcional: adicione comentários adicionais sobre a saúde do projeto...'
                  : 'Explique detalhadamente por que você está divergindo da sugestão calculada pelas métricas...'
              }
              required={!concordou}
              className="mt-1 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Classificação Auditada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
