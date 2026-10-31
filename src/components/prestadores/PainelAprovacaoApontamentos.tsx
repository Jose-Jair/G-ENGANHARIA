// src/components/prestadores/PainelAprovacaoApontamentos.tsx
// RODADA 15 — MESA DE APROVAÇÃO EM LOTE SEMANAL DE APONTAMENTOS (GESTOR / ADMIN)
// Consome o endpoint seguro /backend/v1/apontamentos/aprovar-lote

import React, { useState, useEffect, useMemo } from 'react'
import { ApontamentoRecord } from '@/types'
import { custoInternoService } from '@/services/custoInterno'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
  Loader2,
  CheckCheck,
  Search,
  RefreshCw,
  User,
  Layers,
} from 'lucide-react'

interface PainelAprovacaoApontamentosProps {
  onProcessado?: () => void
}

export const PainelAprovacaoApontamentos: React.FC<PainelAprovacaoApontamentosProps> = ({
  onProcessado,
}) => {
  const { toast } = useToast()
  const [apontamentosPendentes, setApontamentosPendentes] = useState<ApontamentoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({})
  const [processandoLote, setProcessandoLote] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')

  // Modal de Rejeição com Motivo
  const [modalRejeitarOpen, setModalRejeitarOpen] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [idsParaRejeitar, setIdsParaRejeitar] = useState<string[]>([])

  const carregarPendentes = async () => {
    setCarregando(true)
    try {
      const lista = await custoInternoService.listarApontamentosPendentes()
      setApontamentosPendentes(lista)
      setSelecionados({})
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar apontamentos pendentes',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarPendentes()
  }, [])

  // Filtragem
  const apontamentosFiltrados = useMemo(() => {
    if (!busca.trim()) return apontamentosPendentes
    const termo = busca.toLowerCase()
    return apontamentosPendentes.filter((apt) => {
      const pNome = apt.expand?.prestador?.nome?.toLowerCase() || ''
      const osNum = apt.expand?.os?.numero?.toLowerCase() || ''
      const atv = apt.atividade?.toLowerCase() || ''
      const desc = apt.descricao?.toLowerCase() || ''
      return (
        pNome.includes(termo) ||
        osNum.includes(termo) ||
        atv.includes(termo) ||
        desc.includes(termo)
      )
    })
  }, [apontamentosPendentes, busca])

  const idsSelecionados = useMemo(() => {
    return Object.keys(selecionados).filter((id) => selecionados[id])
  }, [selecionados])

  const totalHorasSelecionadas = useMemo(() => {
    return (
      Math.round(
        apontamentosFiltrados
          .filter((apt) => selecionados[apt.id])
          .reduce((acc, curr) => acc + (Number(curr.horas) || 0), 0) * 100,
      ) / 100
    )
  }, [apontamentosFiltrados, selecionados])

  const todosSelecionados =
    apontamentosFiltrados.length > 0 && apontamentosFiltrados.every((apt) => selecionados[apt.id])

  const handleToggleSelecionarTodos = () => {
    if (todosSelecionados) {
      setSelecionados({})
    } else {
      const novoMapa: Record<string, boolean> = {}
      apontamentosFiltrados.forEach((apt) => {
        novoMapa[apt.id] = true
      })
      setSelecionados(novoMapa)
    }
  }

  const handleAprovarLote = async () => {
    if (idsSelecionados.length === 0) {
      toast({ title: 'Selecione ao menos um apontamento para aprovar.', variant: 'destructive' })
      return
    }

    setProcessandoLote(true)
    try {
      const res = await custoInternoService.aprovarLote(idsSelecionados, 'aprovado')
      toast({
        title: 'Apontamentos Aprovados!',
        description: `${res.processados} apontamento(s) aprovado(s) com recálculo automático de custos das OS.`,
      })
      carregarPendentes()
      if (onProcessado) onProcessado()
    } catch (err: any) {
      toast({
        title: 'Erro na aprovação em lote',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setProcessandoLote(false)
    }
  }

  const abrirModalRejeitarLote = () => {
    if (idsSelecionados.length === 0) {
      toast({ title: 'Selecione ao menos um apontamento para rejeitar.', variant: 'destructive' })
      return
    }
    setIdsParaRejeitar(idsSelecionados)
    setMotivoRejeicao('')
    setModalRejeitarOpen(true)
  }

  const handleConfirmarRejeicao = async () => {
    if (!motivoRejeicao.trim()) {
      toast({ title: 'Informe o motivo da rejeição obrigatório.', variant: 'destructive' })
      return
    }

    setProcessandoLote(true)
    try {
      const res = await custoInternoService.aprovarLote(
        idsParaRejeitar,
        'rejeitado',
        motivoRejeicao.trim(),
      )
      toast({
        title: 'Apontamentos Rejeitados',
        description: `${res.processados} apontamento(s) rejeitado(s) com motivo registrado.`,
      })
      setModalRejeitarOpen(false)
      carregarPendentes()
      if (onProcessado) onProcessado()
    } catch (err: any) {
      toast({
        title: 'Erro ao rejeitar apontamentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setProcessandoLote(false)
    }
  }

  const getAtividadeBadge = (atv: string) => {
    switch (atv) {
      case 'producao':
        return <Badge className="bg-sky-600 text-white text-[10px]">Produção</Badge>
      case 'revisao':
        return <Badge className="bg-indigo-600 text-white text-[10px]">Revisão</Badge>
      case 'correcao':
        return <Badge className="bg-amber-600 text-white text-[10px]">Correção</Badge>
      case 'reuniao':
        return <Badge className="bg-purple-600 text-white text-[10px]">Reunião</Badge>
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {atv}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Topo com Ações em Lote */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#D95A2B]" />
            <h3 className="text-base font-bold text-slate-900">
              Aprovação em Lote de Apontamentos
            </h3>
            <Badge className="bg-amber-500 text-white text-xs">
              {apontamentosPendentes.length} Pendente(s)
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mesa semanal do Gestor para validação de horas da equipe interna. Ao aprovar, o custo
            real da OS é recalculado no servidor e gravado na auditoria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarPendentes}
            disabled={carregando}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button
            size="sm"
            disabled={idsSelecionados.length === 0 || processandoLote}
            onClick={handleAprovarLote}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            {processandoLote ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            Aprovar Lote ({idsSelecionados.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={idsSelecionados.length === 0 || processandoLote}
            onClick={abrirModalRejeitarLote}
            className="text-xs h-8 border-rose-300 text-rose-700 hover:bg-rose-50 gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Rejeitar Lote
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Resumo da Seleção */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por prestador, OS, atividade ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-500">
            Selecionados: <strong>{idsSelecionados.length}</strong> ({totalHorasSelecionadas}h
            acumuladas)
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelecionarTodos}
            className="h-7 text-xs text-slate-700"
          >
            {todosSelecionados ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </Button>
        </div>
      </div>

      {/* Tabela de Apontamentos Pendentes */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-0">
          {carregando ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto mb-2" />
              <p className="text-xs text-slate-500">Carregando apontamentos pendentes...</p>
            </div>
          ) : apontamentosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-700">Tudo em dia!</p>
              <p className="text-slate-400">Nenhum apontamento pendente de aprovação no momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={todosSelecionados}
                        onCheckedChange={handleToggleSelecionarTodos}
                      />
                    </th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Profissional</th>
                    <th className="p-3">Ordem de Serviço</th>
                    <th className="p-3">Atividade</th>
                    <th className="p-3">Descrição Técnica</th>
                    <th className="p-3 text-right">Horas</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apontamentosFiltrados.map((apt) => {
                    const isChecked = Boolean(selecionados[apt.id])
                    const p = apt.expand?.prestador
                    const os = apt.expand?.os

                    return (
                      <tr
                        key={apt.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isChecked ? 'bg-orange-50/30' : ''
                        }`}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(val) => {
                              setSelecionados((prev) => ({ ...prev, [apt.id]: Boolean(val) }))
                            }}
                          />
                        </td>
                        <td className="p-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {formatDateBr(apt.data)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <strong className="text-slate-900 block">{p?.nome || '—'}</strong>
                          <span className="text-[10px] text-slate-400">{p?.email}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-sky-800 block">
                            {os?.numero || 'OS'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {os?.disciplina || 'Geral'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {getAtividadeBadge(apt.atividade)}
                        </td>
                        <td className="p-3 max-w-xs text-slate-600 truncate" title={apt.descricao}>
                          {apt.descricao || <span className="text-slate-300">Sem observações</span>}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                            {apt.horas}h
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                setProcessandoLote(true)
                                try {
                                  await custoInternoService.aprovarLote([apt.id], 'aprovado')
                                  toast({ title: 'Apontamento aprovado!' })
                                  carregarPendentes()
                                  if (onProcessado) onProcessado()
                                } catch (err: any) {
                                  toast({
                                    title: 'Erro ao aprovar',
                                    description: err.message,
                                    variant: 'destructive',
                                  })
                                } finally {
                                  setProcessandoLote(false)
                                }
                              }}
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              title="Aprovar apontamento"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIdsParaRejeitar([apt.id])
                                setMotivoRejeicao('')
                                setModalRejeitarOpen(true)
                              }}
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              title="Rejeitar apontamento com motivo"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Motivo de Rejeição */}
      <Dialog open={modalRejeitarOpen} onOpenChange={setModalRejeitarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <XCircle className="w-5 h-5 text-rose-600" />
              Rejeitar Apontamento(s)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o motivo técnico da rejeição para registrar na auditoria e exibir na tela do
              prestador interno.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Motivo da Rejeição *</Label>
              <textarea
                rows={3}
                required
                placeholder="Ex: Horas incompatíveis com o escopo / atividade não delegada nesta OS / duplicidade de apontamento..."
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-md mt-1 focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalRejeitarOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={processandoLote || !motivoRejeicao.trim()}
              onClick={handleConfirmarRejeicao}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {processandoLote ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Rejeição'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PainelAprovacaoApontamentos
