// src/components/prestadores/PortalMinhasHoras.tsx
// RODADA 15 — ABA "MINHAS HORAS" NO PORTAL DO PRESTADOR INTERNO
// REGRA MANDATÓRIA DE SEGURANÇA: SEM NENHUM VALOR MONETÁRIO NA TELA
// O interno não vê custo_hora, salário, valor da OS, margem ou valores de contratos.

import React, { useState, useEffect, useMemo } from 'react'
import { ApontamentoRecord, AtividadeApontamento, PortalOsRecord, PrestadorRecord } from '@/types'
import { custoInternoService } from '@/services/custoInterno'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  CalendarDays,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

interface PortalMinhasHorasProps {
  prestador: PrestadorRecord
  ordensServico: PortalOsRecord[]
  onApontamentoSalvo?: () => void
}

export const PortalMinhasHoras: React.FC<PortalMinhasHorasProps> = ({
  prestador,
  ordensServico,
  onApontamentoSalvo,
}) => {
  const { toast } = useToast()
  const [apontamentos, setApontamentos] = useState<ApontamentoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // Formulário de lançamento diário
  const [osSelecionadaId, setOsSelecionadaId] = useState<string>('')
  const [dataApontamento, setDataApontamento] = useState<string>(
    new Date().toISOString().substring(0, 10),
  )
  const [horas, setHoras] = useState<number>(1.0)
  const [atividade, setAtividade] = useState<AtividadeApontamento>('producao')
  const [descricao, setDescricao] = useState<string>('')

  // Controle de semana corrente (Segunda a Domingo)
  const [offsetSemanas, setOffsetSemanas] = useState<number>(0)

  // Carregar histórico de apontamentos do prestador
  const carregarApontamentos = async () => {
    if (!prestador?.id) return
    setCarregando(true)
    try {
      const lista = await custoInternoService.listarMeusApontamentosPrestador(prestador.id)
      setApontamentos(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar apontamentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarApontamentos()
  }, [prestador?.id])

  // Selecionar a primeira OS por padrão se não houver seleção
  useEffect(() => {
    if (ordensServico.length > 0 && !osSelecionadaId) {
      setOsSelecionadaId(ordensServico[0].os_id)
    }
  }, [ordensServico])

  // Cálculo da semana em exibição
  const { inicioSemana, fimSemana, diasSemana } = useMemo(() => {
    const hoje = new Date()
    hoje.setDate(hoje.getDate() + offsetSemanas * 7)

    const diaSemana = hoje.getDay() // 0 = Domingo, 1 = Segunda, ...
    const distSegunda = diaSemana === 0 ? -6 : 1 - diaSemana

    const seg = new Date(hoje)
    seg.setDate(hoje.getDate() + distSegunda)
    seg.setHours(0, 0, 0, 0)

    const dom = new Date(seg)
    dom.setDate(seg.getDate() + 6)
    dom.setHours(23, 59, 59, 999)

    const dias = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(seg)
      d.setDate(seg.getDate() + i)
      dias.push(d.toISOString().substring(0, 10))
    }

    return {
      inicioSemana: seg.toISOString().substring(0, 10),
      fimSemana: dom.toISOString().substring(0, 10),
      diasSemana: dias,
    }
  }, [offsetSemanas])

  // Apontamentos da semana em exibição
  const apontamentosSemana = useMemo(() => {
    return apontamentos.filter((apt) => {
      const d = apt.data ? apt.data.substring(0, 10) : ''
      return d >= inicioSemana && d <= fimSemana
    })
  }, [apontamentos, inicioSemana, fimSemana])

  // Total de horas na semana
  const totalHorasSemana = useMemo(() => {
    return (
      Math.round(
        apontamentosSemana.reduce((acc, curr) => acc + (Number(curr.horas) || 0), 0) * 100,
      ) / 100
    )
  }, [apontamentosSemana])

  // Horas por dia da semana
  const horasPorDia = useMemo(() => {
    const mapa: Record<string, number> = {}
    diasSemana.forEach((d) => {
      mapa[d] = 0
    })
    apontamentosSemana.forEach((apt) => {
      const d = apt.data ? apt.data.substring(0, 10) : ''
      if (mapa[d] !== undefined) {
        mapa[d] += Number(apt.horas) || 0
      }
    })
    return mapa
  }, [diasSemana, apontamentosSemana])

  const handleSalvarApontamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!osSelecionadaId) {
      toast({ title: 'Selecione a Ordem de Serviço.', variant: 'destructive' })
      return
    }

    if (!dataApontamento) {
      toast({ title: 'Selecione a data de execução.', variant: 'destructive' })
      return
    }

    if (!horas || horas <= 0) {
      toast({ title: 'Informe a quantidade de horas trabalhadas.', variant: 'destructive' })
      return
    }

    // Validação de passos de 0.25 (ex: 0.25, 0.5, 0.75, 1.0, 1.25...)
    const resto = Math.round((horas * 100) % 25)
    if (resto !== 0) {
      toast({
        title: 'Passo inválido de horas',
        description:
          'As horas devem ser preenchidas em frações de 0,25 (ex: 0,25h, 0,5h, 0,75h, 1h, 1,25h).',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await custoInternoService.criarApontamento({
        osId: osSelecionadaId,
        prestadorId: prestador.id,
        data: dataApontamento,
        horas,
        atividade,
        origem: 'manual',
        descricao: descricao.trim(),
      })

      toast({
        title: 'Horas lançadas com sucesso!',
        description: `${horas}h registradas como ${getAtividadeLabel(atividade)} (status: Pendente de Aprovação).`,
      })

      setDescricao('')
      carregarApontamentos()
      if (onApontamentoSalvo) onApontamentoSalvo()
    } catch (err: any) {
      toast({
        title: 'Erro ao lançar apontamento',
        description: err.message || 'Falha ao gravar horas.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const getAtividadeLabel = (atv: AtividadeApontamento) => {
    switch (atv) {
      case 'producao':
        return 'Produção'
      case 'revisao':
        return 'Revisão Técnica'
      case 'correcao':
        return 'Correção de Apontamentos'
      case 'reuniao':
        return 'Reunião de Alinhamento'
      default:
        return atv
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'aprovado':
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Aprovado
          </Badge>
        )
      case 'rejeitado':
        return (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertCircle className="w-3 h-3" />
            Rejeitado
          </Badge>
        )
      case 'pendente':
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
          >
            Pendente
          </Badge>
        )
    }
  }

  const nomesDias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Apontamento Diário de Horas Técnicas
            </h3>
            <p className="text-xs text-slate-500">
              Lance sua dedicação em frações de 0,25h por Ordem de Serviço delegada. Seus
              lançamentos são consolidados semanalmente para aprovação do Gestor.
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-sky-700 bg-sky-50 border-sky-200 text-xs py-1">
          <Clock className="w-3.5 h-3.5 mr-1" />
          Passo 0,25h (15 min)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Formulário de Lançamento */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D95A2B]" />
              Lançar Horas
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Preencha data, Ordem de Serviço, atividade e horas dedicadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSalvarApontamento} className="space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Ordem de Serviço *</Label>
                <Select
                  value={osSelecionadaId}
                  onValueChange={setOsSelecionadaId}
                  disabled={ordensServico.length === 0}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue placeholder="Selecione a OS" />
                  </SelectTrigger>
                  <SelectContent>
                    {ordensServico.map((os) => (
                      <SelectItem key={os.os_id} value={os.os_id}>
                        {os.numero_os} — {os.disciplina || 'Geral'} ({os.codigo_projeto})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ordensServico.length === 0 && (
                  <span className="text-[11px] text-amber-600 block mt-1">
                    Nenhuma OS ativa encontrada para lançamento.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Data *</Label>
                  <Input
                    type="date"
                    required
                    value={dataApontamento}
                    onChange={(e) => setDataApontamento(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Horas (passo 0,25) *
                  </Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="14"
                    required
                    value={horas}
                    onChange={(e) => setHoras(parseFloat(e.target.value) || 0)}
                    className="text-xs mt-1 font-mono"
                  />
                </div>
              </div>

              {/* Botões Rápidos de Horas */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 block w-full">Atalhos rápidos:</span>
                {[0.25, 0.5, 1.0, 2.0, 4.0, 8.0].map((hVal) => (
                  <Button
                    key={hVal}
                    type="button"
                    variant={horas === hVal ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHoras(hVal)}
                    className={`h-6 text-[10px] px-2 ${
                      horas === hVal ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {hVal}h
                  </Button>
                ))}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Atividade Técnica *</Label>
                <Select value={atividade} onValueChange={(val: any) => setAtividade(val)}>
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao">Produção Técnica</SelectItem>
                    <SelectItem value="revisao">Revisão Técnica</SelectItem>
                    <SelectItem value="correcao">Correção de Apontamentos</SelectItem>
                    <SelectItem value="reuniao">Reunião de Alinhamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Descrição das Atividades Realizadas
                </Label>
                <textarea
                  rows={3}
                  placeholder="Ex: Modelagem do pavimento tipo, cálculo de vigas, compatibilização com arquitetura..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-md mt-1 focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <Button
                type="submit"
                disabled={salvando || ordensServico.length === 0}
                className="w-full bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs shadow-xs"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Gravando horas...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Registrar Apontamento
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Coluna 2 e 3: Visão Semanal e Histórico */}
        <div className="lg:col-span-2 space-y-6">
          {/* Navegador da Semana e Cards de Dias */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-sky-600" />
                  Visão da Semana: {formatDateBr(inicioSemana)} a {formatDateBr(fimSemana)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Total acumulado nesta semana:{' '}
                  <strong className="text-slate-900 font-mono text-sm">{totalHorasSemana}h</strong>
                </CardDescription>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOffsetSemanas((prev) => prev - 1)}
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {offsetSemanas !== 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-sky-700"
                    onClick={() => setOffsetSemanas(0)}
                  >
                    Semana Atual
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOffsetSemanas((prev) => prev + 1)}
                  title="Próxima semana"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Grid dos 7 dias da semana */}
              <div className="grid grid-cols-7 gap-2 text-center">
                {diasSemana.map((dStr, idx) => {
                  const hTotal = horasPorDia[dStr] || 0
                  const isHoje = dStr === new Date().toISOString().substring(0, 10)

                  return (
                    <div
                      key={dStr}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isHoje
                          ? 'border-sky-500 bg-sky-50/60'
                          : hTotal > 0
                            ? 'border-slate-200 bg-slate-50/80'
                            : 'border-slate-100 bg-white'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {nomesDias[idx]}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-700 block mt-0.5">
                        {dStr.substring(8, 10)}/{dStr.substring(5, 7)}
                      </span>
                      <strong
                        className={`text-sm font-mono block mt-1 ${
                          hTotal > 0 ? 'text-sky-700 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {hTotal > 0 ? `${hTotal}h` : '0h'}
                      </strong>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Histórico Recente de Apontamentos */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Apontamentos Registrados ({apontamentos.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Acompanhe o status de aprovação de cada lançamento feito na plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-600 mx-auto" />
                </div>
              ) : apontamentos.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum apontamento lançado até o momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {apontamentos.map((apt) => {
                    const osExpand = apt.expand?.os
                    return (
                      <div
                        key={apt.id}
                        className="p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">
                              {formatDateBr(apt.data)}
                            </span>
                            <span className="font-mono text-sky-700 font-semibold">
                              {osExpand?.numero || 'OS'}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {getAtividadeLabel(apt.atividade)}
                            </Badge>
                            {getStatusBadge(apt.status)}
                          </div>

                          {apt.descricao && (
                            <p className="text-[11px] text-slate-600 line-clamp-2">
                              {apt.descricao}
                            </p>
                          )}

                          {apt.motivo_rejeicao && apt.status === 'rejeitado' && (
                            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
                              <strong>Motivo da rejeição:</strong> {apt.motivo_rejeicao}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 sm:text-right">
                          <div className="bg-sky-50 text-sky-800 font-mono font-bold text-sm px-2.5 py-1 rounded-md border border-sky-100">
                            {apt.horas}h
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PortalMinhasHoras
