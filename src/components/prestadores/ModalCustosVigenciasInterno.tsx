// src/components/prestadores/ModalCustosVigenciasInterno.tsx
// RODADA 15 — CUSTOS E VIGÊNCIAS DO PRESTADOR INTERNO (custos_profissional)

import React, { useState, useEffect } from 'react'
import { PrestadorRecord, CustoProfissionalRecord } from '@/types'
import { custoInternoService } from '@/services/custoInterno'
import { prestadoresService } from '@/services/prestadores'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  Clock,
  Calendar,
  AlertTriangle,
  Plus,
  Loader2,
  History,
  CheckCircle2,
} from 'lucide-react'

interface ModalCustosVigenciasInternoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prestador: PrestadorRecord | null
  canEdit: boolean
  onAtualizado?: () => void
}

export const ModalCustosVigenciasInterno: React.FC<ModalCustosVigenciasInternoProps> = ({
  open,
  onOpenChange,
  prestador,
  canEdit,
  onAtualizado,
}) => {
  const { toast } = useToast()
  const [vigencias, setVigencias] = useState<CustoProfissionalRecord[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form de nova vigência
  const [mostrarNovoForm, setMostrarNovoForm] = useState(false)
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().substring(0, 10))
  const [dataFim, setDataFim] = useState('')
  const [custoMensal, setCustoMensal] = useState<string>('')
  const [horasMes, setHorasMes] = useState<string>('176')
  const [observacoes, setObservacoes] = useState('')

  const carregarVigencias = async () => {
    if (!prestador?.id) return
    setCarregando(true)
    try {
      const lista = await custoInternoService.listarVigenciasPrestador(prestador.id)
      setVigencias(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar vigências de custo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && prestador) {
      carregarVigencias()
      setMostrarNovoForm(false)
      setDataInicio(new Date().toISOString().substring(0, 10))
      setDataFim('')
      setCustoMensal(
        prestador.custo_mensal && prestador.custo_mensal > 0 ? String(prestador.custo_mensal) : '',
      )
      setHorasMes(
        prestador.horas_mes && prestador.horas_mes > 0 ? String(prestador.horas_mes) : '176',
      )
      setObservacoes('')
    }
  }, [open, prestador])

  // Custo-hora calculado em tempo real para o formulário
  const cMensalNum = parseFloat(custoMensal) || 0
  const hMesNum = parseFloat(horasMes) || 0
  const custoHoraCalculado = hMesNum > 0 ? Math.round((cMensalNum / hMesNum) * 100) / 100 : 0

  const handleSalvarVigencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prestador?.id) return

    if (!dataInicio) {
      toast({ title: 'Informe a data de início da vigência.', variant: 'destructive' })
      return
    }

    if (cMensalNum <= 0 || hMesNum <= 0) {
      toast({
        title: 'Valores inválidos',
        description: 'Custo mensal e horas/mês devem ser maiores que zero.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      // 1. Criar registro na coleção custos_profissional
      await custoInternoService.criarVigencia({
        prestadorId: prestador.id,
        dataInicio,
        dataFim: dataFim || undefined,
        custoMensal: cMensalNum,
        horasMes: hMesNum,
        observacoes,
      })

      // 2. Atualizar campos no registro do prestador para refletir a vigência ativa
      await prestadoresService.update(prestador.id, {
        custo_mensal: cMensalNum,
        horas_mes: hMesNum,
        custo_hora: custoHoraCalculado,
      })

      toast({
        title: 'Vigência de custo gravada com sucesso!',
        description: `Custo-hora calculado: ${formatCurrencyBr(custoHoraCalculado)}/h.`,
      })

      setMostrarNovoForm(false)
      carregarVigencias()
      if (onAtualizado) onAtualizado()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar vigência de custo',
        description: err.message || 'Falha ao registrar custos.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const custoConfigurado = Boolean(prestador?.custo_hora && prestador.custo_hora > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Custo Interno e Vigências: {prestador?.nome}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Parâmetros de remuneração da equipe própria G+ para apuração de custo hora real por OS.
            Valores vazios até configuração pelo Admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Card de Status Atual do Prestador */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Vigência Vigente
              </span>
              {custoConfigurado ? (
                <Badge className="bg-emerald-600 text-white text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Custo Configurado
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-800 border-amber-300 text-xs gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Custo não configurado
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Custo Mensal</span>
                <strong className="text-base font-mono text-slate-900 block mt-0.5">
                  {prestador?.custo_mensal && prestador.custo_mensal > 0
                    ? formatCurrencyBr(prestador.custo_mensal)
                    : '—'}
                </strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Horas / Mês</span>
                <strong className="text-base font-mono text-slate-900 block mt-0.5">
                  {prestador?.horas_mes && prestador.horas_mes > 0
                    ? `${prestador.horas_mes} h`
                    : '—'}
                </strong>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Custo-Hora Calculado</span>
                <strong
                  className={`text-base font-mono block mt-0.5 ${
                    custoConfigurado ? 'text-emerald-700 font-bold' : 'text-slate-400'
                  }`}
                >
                  {custoConfigurado ? `${formatCurrencyBr(prestador!.custo_hora)}/h` : '—'}
                </strong>
              </div>
            </div>

            {!custoConfigurado && (
              <p className="text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded border border-amber-200">
                Aviso: Sem custo cadastrado, as OS atribuídas a este profissional interno ficam com
                status <em>"custo não configurado"</em> e custo apurado zerado.
              </p>
            )}
          </div>

          {/* Botão Nova Vigência */}
          {canEdit && !mostrarNovoForm && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setMostrarNovoForm(true)}
                className="text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Vigência de Custo
              </Button>
            </div>
          )}

          {/* Formulário de Nova Vigência */}
          {mostrarNovoForm && (
            <form
              onSubmit={handleSalvarVigencia}
              className="p-4 bg-orange-50/40 border border-[#D95A2B]/30 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-orange-100">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#D95A2B]" />
                  Cadastrar Nova Vigência de Remuneração
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMostrarNovoForm(false)}
                  className="h-6 text-[11px] text-slate-500"
                >
                  Cancelar
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <Label className="text-xs">Data de Início *</Label>
                  <Input
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Data Fim (opcional)</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Custo Mensal (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Ex: 8500.00"
                    value={custoMensal}
                    onChange={(e) => setCustoMensal(e.target.value)}
                    className="text-xs mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Horas / Mês *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="Ex: 176"
                    value={horasMes}
                    onChange={(e) => setHorasMes(e.target.value)}
                    className="text-xs mt-1 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Observações da Vigência</Label>
                  <Input
                    placeholder="Ex: Reajuste anual / CLT sênior / Horista dedicação parcial..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              {/* Prévia do custo hora calculado */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-500">Custo-Hora resultante:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {cMensalNum > 0 && hMesNum > 0
                    ? `${formatCurrencyBr(custoHoraCalculado)}/h`
                    : 'R$ 0,00/h'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarNovoForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={salvando}
                  className="bg-[#D95A2B] hover:bg-[#b84820] text-white"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    'Confirmar Vigência'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Histórico de Vigências */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Histórico de Vigências ({vigencias.length})
            </span>

            {carregando ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto" />
              </div>
            ) : vigencias.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                Nenhum histórico de vigência registrado para este prestador.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {vigencias.map((vg, idx) => (
                  <div
                    key={vg.id}
                    className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">
                          {formatDateBr(vg.data_inicio)}
                          {vg.data_fim ? ` até ${formatDateBr(vg.data_fim)}` : ' em diante (Atual)'}
                        </strong>
                        {idx === 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300"
                          >
                            Mais Recente
                          </Badge>
                        )}
                      </div>
                      {vg.observacoes && (
                        <p className="text-[11px] text-slate-500">{vg.observacoes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 font-mono text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Mensal</span>
                        <span>{formatCurrencyBr(vg.custo_mensal || 0)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Horas</span>
                        <span>{vg.horas_mes || 0}h</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Custo/Hora</span>
                        <strong className="text-emerald-700 font-bold">
                          {formatCurrencyBr(vg.custo_hora || 0)}/h
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalCustosVigenciasInterno
