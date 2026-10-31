import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  UserCheck,
  Ban,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Filter,
  RefreshCw,
  Sparkles,
  Layers,
  Inbox,
  DollarSign,
  TrendingDown,
} from 'lucide-react'
import { decisoesFilaService } from '@/services/decisoesFilaService'
import type { ItemFilaDecisao, TipoItemDecisao } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { formatCurrencyBr } from '@/lib/formatters'
import { useNavigate } from 'react-router-dom'

export const DecisoesPage: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(true)
  const [itens, setItens] = useState<ItemFilaDecisao[]>([])
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [itemSelecionado, setItemSelecionado] = useState<ItemFilaDecisao | null>(null)
  const [resolvendo, setResolvendo] = useState(false)
  const [modalContextoOpen, setModalContextoOpen] = useState(false)

  const carregarFila = async () => {
    setCarregando(true)
    try {
      const resp = await decisoesFilaService.getFila()
      if (resp.sucesso) {
        setItens(resp.itens || [])
      } else {
        toast({
          title: 'Aviso ao carregar Fila de Decisões',
          description: resp.erro || 'Falha ao buscar itens da fila.',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Erro de conexão',
        description: e?.message || 'Falha ao buscar dados da fila.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarFila()
  }, [])

  const itensFiltrados = itens.filter((it) => {
    if (filtroTipo === 'todos') return true
    return it.tipo_item === filtroTipo
  })

  const getBadgeImpacto = (impacto: number) => {
    if (impacto >= 80) {
      return (
        <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-[11px] font-bold">
          Impacto {impacto} (Crítico)
        </Badge>
      )
    }
    if (impacto >= 60) {
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[11px] font-bold">
          Impacto {impacto} (Alto)
        </Badge>
      )
    }
    return (
      <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px] font-semibold">
        Impacto {impacto} (Médio)
      </Badge>
    )
  }

  const getIconeTipo = (tipo: TipoItemDecisao) => {
    switch (tipo) {
      case 'vencedor_cotacao':
      case 'vencedor_pre_cotacao':
        return <FileText className="w-4 h-4 text-emerald-600" />
      case 'revisao_fora_sla':
      case 'issue_sem_atribuicao':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />
      case 'apontamento_a_aprovar':
        return <Clock className="w-4 h-4 text-blue-600" />
      case 'triagem_prestador':
        return <UserCheck className="w-4 h-4 text-indigo-600" />
      case 'sugestao_suspensao':
        return <Ban className="w-4 h-4 text-rose-600" />
      case 'alerta_financeiro':
        return <DollarSign className="w-4 h-4 text-rose-600" />
      case 'cobranca_escalada':
        return <TrendingDown className="w-4 h-4 text-amber-600" />
      default:
        return <Layers className="w-4 h-4 text-slate-600" />
    }
  }

  const getModuloUrl = (it: ItemFilaDecisao): string => {
    switch (it.tipo_item) {
      case 'vencedor_cotacao':
      case 'revisao_fora_sla':
      case 'issue_sem_atribuicao':
        return it.contexto?.projeto_id ? `/projetos` : '/projetos'
      case 'vencedor_pre_cotacao':
        return '/propostas'
      case 'apontamento_a_aprovar':
      case 'triagem_prestador':
      case 'sugestao_suspensao':
        return '/prestadores'
      case 'alerta_financeiro':
        return '/financeiro'
      case 'cobranca_escalada':
        return '/monitoramento'
      default:
        return '/dashboard'
    }
  }

  const handleAbrirContexto = (item: ItemFilaDecisao) => {
    setItemSelecionado(item)
    setModalContextoOpen(true)
  }

  const handleResolverComCliqueAuditado = async (acaoTomada: string) => {
    if (!itemSelecionado) return
    setResolvendo(true)
    try {
      const resp = await decisoesFilaService.fecharDecisao({
        tipo_item: itemSelecionado.tipo_item,
        item_id: itemSelecionado.item_id,
        impacto: itemSelecionado.impacto,
        titulo: itemSelecionado.titulo,
        acao_tomada: acaoTomada,
        parecer_resolucao: `Decisão executada com clique auditado: ${acaoTomada}.`,
      })

      if (resp.sucesso) {
        toast({
          title: 'Decisão registrada e auditada!',
          description: resp.mensagem || 'O item foi atualizado e registrado no log imutável.',
        })
        setModalContextoOpen(false)
        setItemSelecionado(null)
        carregarFila()
      } else {
        toast({
          title: 'Erro ao resolver item',
          description: resp.erro || 'Falha ao processar ação.',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Erro inesperado',
        description: e?.message || 'Falha ao registrar resolução.',
        variant: 'destructive',
      })
    } finally {
      setResolvendo(false)
    }
  }

  const handleIrParaModulo = () => {
    if (!itemSelecionado) return
    const url = getModuloUrl(itemSelecionado)
    setModalContextoOpen(false)
    navigate(url)
  }

  return (
    <div className="space-y-6">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2A4A] tracking-tight">
              Fila Única de Decisões
            </h1>
            <Badge className="bg-[#D95A2B] text-white hover:bg-[#b84820] text-xs font-mono">
              {itens.length} {itens.length === 1 ? 'pendência' : 'pendências'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Fila priorizada por impacto de negócio para Admin e Gestor. Cada item abre o contexto
            completo e permite decisão com clique auditado e imutável.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarFila}
            disabled={carregando}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alerta de Alimentação do Resumo do Dia (IA) */}
      <Alert className="bg-indigo-50/70 border-indigo-200 text-indigo-950 text-xs">
        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <AlertDescription className="space-y-1">
          <span className="font-semibold block text-indigo-900">
            Integração com Resumo do Dia (IA) & Monitoramento
          </span>
          <p className="text-slate-600">
            Esta fila única alimenta automaticamente o prompt do agente de Inteligência Artificial
            do <strong>Resumo Diário Executivo</strong>, garantindo que nenhum gargalo de cotação,
            revisão técnica, triagem ou apontamento passe despercebido.
          </p>
        </AlertDescription>
      </Alert>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filtrar por Categoria:</span>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="vencedor_cotacao">Cotações Vencedoras s/ OS</SelectItem>
              <SelectItem value="vencedor_pre_cotacao">Pré-Cotações Vencedoras</SelectItem>
              <SelectItem value="revisao_fora_sla">Revisões Estagnadas</SelectItem>
              <SelectItem value="issue_sem_atribuicao">Issues de Revisão</SelectItem>
              <SelectItem value="apontamento_a_aprovar">Apontamentos a Aprovar</SelectItem>
              <SelectItem value="triagem_prestador">Triagens de Prestador</SelectItem>
              <SelectItem value="sugestao_suspensao">Suspensões Reincidentes</SelectItem>
              <SelectItem value="alerta_financeiro">Alertas Financeiros</SelectItem>
              <SelectItem value="cobranca_escalada">Cobranças Escaladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-slate-500">
          Exibindo <strong>{itensFiltrados.length}</strong> de <strong>{itens.length}</strong> itens
        </div>
      </div>

      {/* Lista de Itens da Fila */}
      {carregando ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D95A2B]" />
          <p className="text-xs text-slate-500">Carregando e priorizando fila de decisões...</p>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">Fila Limpa! Nenhuma Decisão Pendente</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Todas as cotações, apontamentos, triagens e revisões técnicas do sistema estão em dia ou
            já foram processadas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {itensFiltrados.map((it) => (
            <Card
              key={`${it.tipo_item}-${it.item_id}`}
              className="border-slate-200 hover:border-slate-300 transition-all hover:shadow-xs"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getBadgeImpacto(it.impacto)}
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        {getIconeTipo(it.tipo_item)}
                        {it.titulo}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 font-sans">
                      <span>
                        Identificador:{' '}
                        <strong className="font-mono text-slate-700">{it.item_id}</strong>
                      </span>
                      {it.contexto &&
                        Object.entries(it.contexto)
                          .slice(0, 3)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]"
                            >
                              {k}: <strong>{String(v)}</strong>
                            </span>
                          ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button
                      size="sm"
                      onClick={() => handleAbrirContexto(it)}
                      className="text-xs bg-[#1E2A4A] hover:bg-[#141d33] text-white gap-1.5 h-8"
                    >
                      <span>Abrir Contexto</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhamento e Resolução com Clique Auditado */}
      <Dialog open={modalContextoOpen} onOpenChange={setModalContextoOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#1E2A4A]">
              <ShieldAlert className="w-5 h-5 text-[#D95A2B]" />
              <DialogTitle className="text-base">
                Contexto de Decisão e Resolução Auditada
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Analise os detalhes do registro. Cada ação de aprovação, conversão ou dispensa será
              registrada de forma imutável nos logs de auditoria.
            </DialogDescription>
          </DialogHeader>

          {itemSelecionado && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-sm">
                    {itemSelecionado.titulo}
                  </span>
                  {getBadgeImpacto(itemSelecionado.impacto)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Tipo: {itemSelecionado.tipo_item} • ID: {itemSelecionado.item_id}
                </div>
              </div>

              {/* Informações específicas de contexto */}
              {itemSelecionado.contexto && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                    Dados Adicionais de Contexto
                  </span>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5 font-mono text-[11px]">
                    {Object.entries(itemSelecionado.contexto).map(([key, val]) => (
                      <div
                        key={key}
                        className="flex justify-between border-b border-slate-100 pb-1"
                      >
                        <span className="text-slate-500">{key}:</span>
                        <span className="font-semibold text-slate-800">
                          {typeof val === 'number' && key.toLowerCase().includes('preco')
                            ? formatCurrencyBr(val)
                            : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert className="bg-amber-50 border-amber-200 text-amber-900 text-[11px]">
                <AlertDescription>
                  Ação com registro obrigatório de auditoria: o encerramento desta pendência gravará
                  seu ID de usuário, e-mail, data/hora e justificativa.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleIrParaModulo}
              className="text-xs gap-1 border-slate-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver no Módulo de Origem</span>
            </Button>

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalContextoOpen(false)}
                disabled={resolvendo}
                className="text-xs"
              >
                Voltar
              </Button>

              <Button
                size="sm"
                onClick={() => handleResolverComCliqueAuditado('aprovado_decidido')}
                disabled={resolvendo}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1"
              >
                {resolvendo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gravando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar / Decidir Agora
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DecisoesPage
