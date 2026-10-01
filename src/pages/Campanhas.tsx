import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  CampanhaRecord,
  CampanhaCalculada,
  MetricasConsolidadasCampanhas,
  ModeloRecord,
  EmpresaRecord,
  NaoContatarRecord,
  ToqueRecord,
  ParametroRecord,
} from '@/types'
import { campanhasService } from '@/services/campanhas'
import {
  nutricaoService,
  ContagemDestinatariosNutricao,
  SugestaoNutricaoCarencia,
} from '@/services/nutricao'
import { empresasService } from '@/services/empresas'
import { toquesService } from '@/services/toques'
import { naoContatarService } from '@/services/naoContatar'
import { modelosService } from '@/services/modelos'
import { parametrosService } from '@/services/parametros'
import { formatDateTimeBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Megaphone,
  Plus,
  Send,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Clock,
  Eye,
  BarChart3,
  MailCheck,
  MousePointerClick,
  MessageSquare,
  UserX,
  AlertTriangle,
  Play,
  FileEdit,
  Building2,
  ArrowRight,
  Loader2,
  Search,
  Filter,
  Check,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'

import { ModalCriarEditarCampanha } from '@/components/campanhas/ModalCriarEditarCampanha'
import { ModalAprovacaoAgendamento } from '@/components/campanhas/ModalAprovacaoAgendamento'
import { DetalhesEnviosModal } from '@/components/campanhas/DetalhesEnviosModal'
import { PreviaCampanhaModal } from '@/components/campanhas/PreviaCampanhaModal'

export default function CampanhasPage() {
  const { user, isAdmin, isComercial } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [campanhas, setCampanhas] = useState<CampanhaRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [bloqueadosNaoContatar, setBloqueadosNaoContatar] = useState<NaoContatarRecord[]>([])
  const [modelos, setModelos] = useState<ModeloRecord[]>([])
  const [toques, setToques] = useState<ToqueRecord[]>([])
  const [parametros, setParametros] = useState<ParametroRecord[]>([])

  // Filtros de campanhas
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  // Modais
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [campanhaParaEditar, setCampanhaParaEditar] = useState<CampanhaRecord | null>(null)
  const [campanhaParaAprovar, setCampanhaParaAprovar] = useState<CampanhaRecord | null>(null)
  const [campanhaParaMetricas, setCampanhaParaMetricas] = useState<CampanhaCalculada | null>(null)
  const [campanhaParaPrevia, setCampanhaParaPrevia] = useState<CampanhaRecord | null>(null)

  // Disparo em andamento
  const [disparandoId, setDisparandoId] = useState<string | null>(null)
  const [movendoEmpresaId, setMovendoEmpresaId] = useState<string | null>(null)

  // Carregar dados gerais
  const carregarDados = async () => {
    setLoading(true)
    try {
      const [campList, empList, ncList, modData, toquesData, paramsData] = await Promise.all([
        campanhasService.list(),
        empresasService.list(),
        naoContatarService.list(),
        modelosService.list(),
        toquesService.listAtivos(),
        parametrosService.list(),
      ])

      setCampanhas(campList)
      setEmpresas(empList)
      setBloqueadosNaoContatar(ncList)
      setModelos(modData)
      setToques(toquesData)
      setParametros(paramsData)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar campanhas',
        description: err instanceof Error ? err.message : 'Falha ao buscar dados no backend.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Parâmetros de nutrição
  const carenciaDiasParam = useMemo(() => {
    const p = parametros.find((item) => item.chave === 'nutricao_carencia_dias')
    return p ? parseInt(p.valor, 10) || 15 : 15
  }, [parametros])

  const diaEnvioParam = useMemo(() => {
    const p = parametros.find((item) => item.chave === 'nutricao_dia_envio')
    return p ? parseInt(p.valor, 10) || 5 : 5
  }, [parametros])

  // Contagem de destinatários em tempo real por curva
  const contagemDestinatarios = useMemo(() => {
    return nutricaoService.calcularContagemDestinatarios(empresas, bloqueadosNaoContatar)
  }, [empresas, bloqueadosNaoContatar])

  // Sugestões de entrada em nutrição por Toque 5 sem resposta + carência
  const sugestoesCarencia = useMemo(() => {
    return nutricaoService.calcularEmpresasCarenciaToque5(empresas, toques, carenciaDiasParam)
  }, [empresas, toques, carenciaDiasParam])

  // Campanhas calculadas com métricas e status dinâmico
  const campanhasCalculadas = useMemo(() => {
    return campanhas.map((c) => campanhasService.calcularCampanha(c))
  }, [campanhas])

  // Métricas consolidadas
  const metricasConsolidadas = useMemo(() => {
    return campanhasService.calcularMetricasConsolidadas(campanhas)
  }, [campanhas])

  // Mover empresa da cadência para nutrição com 1 clique (auditado)
  const handleMoverParaNutricao = async (empresaId: string, razaoSocial: string) => {
    setMovendoEmpresaId(empresaId)
    try {
      await nutricaoService.moverParaNutricao(
        empresaId,
        `Toque 5 sem resposta após carência de ${carenciaDiasParam} dias. Movido pelo usuário.`,
      )
      toast({
        title: 'Empresa em Nutrição Mensal',
        description: `${razaoSocial} foi transferida com sucesso para a etapa de Nutrição Mensal. Ação auditada.`,
      })
      carregarDados()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao mover empresa',
        description: err instanceof Error ? err.message : 'Falha na movimentação.',
        variant: 'destructive',
      })
    } finally {
      setMovendoEmpresaId(null)
    }
  }

  // Disparo em lote de campanha (Admin)
  const handleDispararCampanha = async (campanha: CampanhaCalculada) => {
    if (!isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas Administradores podem executar disparos em lote.',
        variant: 'destructive',
      })
      return
    }

    if (
      !confirm(
        `Deseja iniciar o disparo do lote para a campanha "${campanha.nome}"? ` +
          `Cada destinatário será verificado no servidor contra a lista Não Contatar antes do envio.`,
      )
    ) {
      return
    }

    setDisparandoId(campanha.id)
    try {
      const res = await campanhasService.dispararLote(campanha.id)
      toast({
        title: 'Disparo Concluído!',
        description: `${res.message} Total enviados: ${res.total_enviados}. Bloqueados compliance: ${res.total_bloqueados_nao_contatar}.`,
      })
      carregarDados()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao disparar lote',
        description: err instanceof Error ? err.message : 'Falha na execução do envio.',
        variant: 'destructive',
      })
    } finally {
      setDisparandoId(null)
    }
  }

  // Filtragem de campanhas
  const campanhasFiltradas = useMemo(() => {
    return campanhasCalculadas.filter((camp) => {
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'pronta_disparo') {
          if (!camp.isProntaParaDisparo || camp.status === 'enviada') return false
        } else if (camp.status !== filtroStatus) {
          return false
        }
      }

      if (filtroSegmento !== 'todos' && camp.segmento !== filtroSegmento) {
        return false
      }

      if (busca.trim()) {
        const q = busca.toLowerCase()
        const matchNome = camp.nome.toLowerCase().includes(q)
        const matchAssunto = (camp.assunto || '').toLowerCase().includes(q)
        if (!matchNome && !matchAssunto) return false
      }

      return true
    })
  }, [campanhasCalculadas, filtroStatus, filtroSegmento, busca])

  return (
    <div className="space-y-6">
      {/* Top Header & Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Campanhas de Nutrição Mensal
              </h1>
              <p className="text-xs text-slate-500">
                Relacionamento institucional contínuo com empresas fora da cadência ativa e recusas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (campanhasFiltradas.length === 0) {
                toast({
                  title: 'Sem campanhas para exportar',
                  description: 'Nenhuma campanha corresponde aos filtros selecionados.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `relatorio_campanhas_nutricao_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'campanhas_nutricao',
                  descricao:
                    'Relatório Consolidado de Campanhas de Nutrição Mensal, Destinatários e Métricas',
                  filtros: {
                    status: filtroStatus,
                    segmento: filtroSegmento,
                    busca: busca || undefined,
                  },
                  columns: [
                    { header: 'Nome da Campanha', accessor: (c) => c.nome },
                    { header: 'Assunto do E-mail', accessor: (c) => c.assunto },
                    { header: 'Segmento Curva', accessor: (c) => c.segmento_curva || 'Todos' },
                    { header: 'Status', accessor: (c) => c.status },
                    {
                      header: 'Data de Envio / Agendamento',
                      accessor: (c) => (c.data_envio ? formatDateBr(c.data_envio) : 'Mensal'),
                    },
                    { header: 'Total Destinatários', accessor: (c) => c.total_destinatarios || 0 },
                    { header: 'Total Enviados', accessor: (c) => c.total_enviados || 0 },
                    { header: 'Total Abertos', accessor: (c) => c.total_abertos || 0 },
                    { header: 'Total Cliques', accessor: (c) => c.total_cliques || 0 },
                    { header: 'Total Respostas', accessor: (c) => c.total_respostas || 0 },
                    {
                      header: 'Total Descadastros (LGPD)',
                      accessor: (c) => c.total_descadastros || 0,
                    },
                    {
                      header: 'Taxa de Abertura (%)',
                      accessor: (c) => `${c.metricas?.taxaAbertura || 0}%`,
                    },
                    {
                      header: 'Taxa de Cliques (%)',
                      accessor: (c) => `${c.metricas?.taxaClique || 0}%`,
                    },
                    {
                      header: 'Taxa de Respostas (%)',
                      accessor: (c) => `${c.metricas?.taxaResposta || 0}%`,
                    },
                    {
                      header: 'Aprovada por Admin',
                      accessor: (c) => (c.aprovada_por_admin ? 'SIM' : 'NÃO'),
                    },
                  ],
                  data: campanhasFiltradas,
                })
                toast({
                  title: 'Campanhas Exportadas',
                  description: `${campanhasFiltradas.length} campanha(s) exportada(s) em CSV. Auditoria registrada.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar campanhas',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {(isAdmin || isComercial) && (
            <Button
              onClick={() => {
                setCampanhaParaEditar(null)
                setModalCriarOpen(true)
              }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nova Campanha (Rascunho)
            </Button>
          )}
        </div>
      </div>

      {/* Sugestões de Entrada em Nutrição por Carência do Toque 5 */}
      {sugestoesCarencia.length > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Sugestão de Entrada em Nutrição Mensal ({sugestoesCarencia.length}{' '}
              {sugestoesCarencia.length === 1 ? 'empresa' : 'empresas'})
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px] font-mono">
              Toque 5 + carência ({carenciaDiasParam} dias)
            </Badge>
          </div>
          <p className="text-xs text-amber-800">
            As seguintes empresas concluíram a cadência sem resposta e ultrapassaram o prazo de
            tolerância. Mova-as para a coluna <strong>Nutrição Mensal</strong> com 1 clique:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {sugestoesCarencia.map((sug) => (
              <div
                key={sug.empresa.id}
                className="p-3 bg-white border border-amber-200/80 rounded-lg shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-800 truncate">
                      {sug.empresa.nome_fantasia || sug.empresa.razao_social}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Curva {sug.empresa.curva || 'C'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Toque 5 previsto: <strong>{formatDateBr(sug.toque5.data_prevista)}</strong>{' '}
                    (atraso:{' '}
                    <span className="text-rose-600 font-semibold">
                      {sug.diasDecorridosToque5} dias
                    </span>
                    )
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-100 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={movendoEmpresaId === sug.empresa.id}
                    onClick={() =>
                      handleMoverParaNutricao(
                        sug.empresa.id,
                        sug.empresa.nome_fantasia || sug.empresa.razao_social,
                      )
                    }
                    className="text-xs h-7 text-amber-800 border-amber-300 hover:bg-amber-50"
                  >
                    {movendoEmpresaId === sug.empresa.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3 h-3 mr-1" />
                    )}
                    Mover para Nutrição
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas Consolidadas das Campanhas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Disparos Totais</span>
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-1">
              {metricasConsolidadas.totalEnviados}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metricasConsolidadas.totalCampanhas} campanhas
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Aberturas Únicas</span>
              <MailCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {metricasConsolidadas.taxaAberturaGeral}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metricasConsolidadas.totalAbertos} aberturas estimadas
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Taxa de Cliques</span>
              <MousePointerClick className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">
              {metricasConsolidadas.taxaCliqueGeral}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metricasConsolidadas.totalCliques} cliques registrados
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Respostas</span>
              <MessageSquare className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-teal-700 mt-1">
              {metricasConsolidadas.totalRespostas}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Retornaram para Em Conversa ({metricasConsolidadas.taxaRespostaGeral}%)
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Descadastros</span>
              <UserX className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">
              {metricasConsolidadas.totalDescadastros}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Opt-out LGPD ({metricasConsolidadas.taxaDescadastroGeral}%)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Segmentação e Destinatários Elegíveis em Tempo Real */}
      <Card className="border-slate-200 bg-slate-50/50 shadow-2xs">
        <CardHeader className="py-3 px-4 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Destinatários em Nutrição Mensal (Tempo Real)
            </CardTitle>
            <span className="text-[11px] text-slate-500">
              Dia sugerido de envio mensal:{' '}
              <strong className="text-slate-800">Todo dia {diaEnvioParam}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-slate-500 text-[11px]">Curva A (Grandes)</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">
              {contagemDestinatarios.curvaA}{' '}
              <span className="text-xs font-normal text-slate-400">empresas</span>
            </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-slate-500 text-[11px]">Curva B (Médios)</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">
              {contagemDestinatarios.curvaB}{' '}
              <span className="text-xs font-normal text-slate-400">empresas</span>
            </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-slate-500 text-[11px]">Curva C (Menores)</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">
              {contagemDestinatarios.curvaC}{' '}
              <span className="text-xs font-normal text-slate-400">empresas</span>
            </div>
          </div>
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
            <div className="text-blue-900 font-semibold text-[11px]">Total Elegível</div>
            <div className="text-xl font-bold text-blue-900 mt-0.5">
              {contagemDestinatarios.total}{' '}
              <span className="text-xs font-normal text-blue-700">prontas</span>
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">
              {contagemDestinatarios.detalhes.bloqueadasNaoContatar} bloqueadas em Não-Contatar
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de Filtros e Busca de Campanhas */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por título ou assunto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto text-xs">
          {/* Filtro Status */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setFiltroStatus('todos')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'todos'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('rascunho')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'rascunho'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Rascunho
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('aprovada')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'aprovada'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Aprovadas
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('agendada')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'agendada'
                  ? 'bg-purple-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Agendadas
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('enviada')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'enviada'
                  ? 'bg-teal-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Enviadas
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('devolvida')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filtroStatus === 'devolvida'
                  ? 'bg-amber-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Devolvidas
            </button>
          </div>

          {/* Filtro Segmento */}
          <select
            value={filtroSegmento}
            onChange={(e) => setFiltroSegmento(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="todos">Segmento: Todos</option>
            <option value="A">Curva A</option>
            <option value="B">Curva B</option>
            <option value="C">Curva C</option>
          </select>
        </div>
      </div>

      {/* Lista de Campanhas */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Carregando campanhas de nutrição...</span>
          </div>
        ) : campanhasFiltradas.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500 text-xs">
            Nenhuma campanha encontrada para os filtros selecionados.
          </div>
        ) : (
          campanhasFiltradas.map((camp) => {
            const isPronta = camp.isProntaParaDisparo && camp.status !== 'enviada'
            return (
              <Card
                key={camp.id}
                className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow bg-white"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Identificação e Assunto */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-sm text-slate-900 truncate">
                          {camp.nome}
                        </h2>

                        {/* Badges de Status */}
                        {camp.status === 'rascunho' && (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-700 text-[10px]"
                          >
                            Rascunho
                          </Badge>
                        )}
                        {camp.status === 'devolvida' && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                          >
                            Devolvida para Ajuste
                          </Badge>
                        )}
                        {camp.status === 'aprovada' && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                          >
                            Aprovada pelo Admin
                          </Badge>
                        )}
                        {camp.status === 'agendada' && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-800 border-purple-300 text-[10px]"
                          >
                            Agendada: {camp.data_envio ? formatDateBr(camp.data_envio) : 'Mensal'}
                          </Badge>
                        )}
                        {camp.status === 'enviada' && (
                          <Badge
                            variant="outline"
                            className="bg-teal-50 text-teal-800 border-teal-300 text-[10px]"
                          >
                            Enviada ({camp.enviados || 0})
                          </Badge>
                        )}

                        {/* Alerta sem cron: Pronta para Envio */}
                        {isPronta && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 animate-pulse border border-rose-300">
                            <Clock className="w-3 h-3" />
                            Pronta para Envio / Pendente de Disparo
                          </span>
                        )}

                        <Badge variant="outline" className="text-[10px] text-slate-600">
                          Segmento: Curva{' '}
                          {camp.segmento === 'todos' ? 'Todas (A/B/C)' : camp.segmento}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-1">
                        <strong>Assunto:</strong> {camp.assunto || '(Sem assunto definido)'}
                      </p>

                      {camp.observacao_devolucao && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 mt-1">
                          <strong>Observação do Admin:</strong> {camp.observacao_devolucao}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>Criada em: {formatDateBr(camp.created)}</span>
                        {camp.aprovado_em && (
                          <span>• Aprovada em: {formatDateBr(camp.aprovado_em)}</span>
                        )}
                        {camp.data_envio && (
                          <span>
                            • Data Envio:{' '}
                            <strong className="text-slate-600">
                              {formatDateTimeBr(camp.data_envio)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Métricas Resumidas se enviada */}
                    {camp.status === 'enviada' && (
                      <div className="grid grid-cols-4 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 shrink-0">
                        <div>
                          <div className="text-[10px] text-slate-400">Enviados</div>
                          <div className="font-bold text-slate-800">{camp.enviados || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Abertos</div>
                          <div className="font-bold text-emerald-700">{camp.taxaAbertura}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Cliques</div>
                          <div className="font-bold text-indigo-700">{camp.taxaClique}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Respostas</div>
                          <div className="font-bold text-teal-700">{camp.respostas || 0}</div>
                        </div>
                      </div>
                    )}

                    {/* Botões de Ação por Perfil */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {/* Prévia */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCampanhaParaPrevia(camp)}
                        className="text-xs h-8 text-slate-700"
                        title="Ver prévia renderizada"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Prévia
                      </Button>

                      {/* Editar (Comercial/Admin em rascunho/devolvida) */}
                      {(camp.status === 'rascunho' || camp.status === 'devolvida') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCampanhaParaEditar(camp)
                            setModalCriarOpen(true)
                          }}
                          className="text-xs h-8 text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          <FileEdit className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                      )}

                      {/* Aprovação / Agendamento (Somente Admin) */}
                      {isAdmin &&
                        (camp.status === 'rascunho' ||
                          camp.status === 'devolvida' ||
                          camp.status === 'aprovada' ||
                          camp.status === 'agendada') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCampanhaParaAprovar(camp)}
                            className="text-xs h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Aprovar / Agendar
                          </Button>
                        )}

                      {/* Disparo em Lote (Somente Admin, para Aprovada ou Agendada) */}
                      {isAdmin && (camp.status === 'aprovada' || camp.status === 'agendada') && (
                        <Button
                          size="sm"
                          disabled={disparandoId === camp.id}
                          onClick={() => handleDispararCampanha(camp)}
                          className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {disparandoId === camp.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              Disparando Lote...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 mr-1" />
                              Disparar Lote Agora
                            </>
                          )}
                        </Button>
                      )}

                      {/* Ver Métricas / Destinatários */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCampanhaParaMetricas(camp)}
                        className="text-xs h-8 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <BarChart3 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Métricas & Envios
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modais da Aplicação */}
      {modalCriarOpen && (
        <ModalCriarEditarCampanha
          campanha={campanhaParaEditar}
          open={modalCriarOpen}
          onOpenChange={setModalCriarOpen}
          onSuccess={carregarDados}
          modelos={modelos}
          contagemDestinatarios={contagemDestinatarios}
        />
      )}

      {campanhaParaAprovar && user && (
        <ModalAprovacaoAgendamento
          campanha={campanhaParaAprovar}
          open={!!campanhaParaAprovar}
          onOpenChange={() => setCampanhaParaAprovar(null)}
          onSuccess={carregarDados}
          adminId={user.id}
          diaEnvioPadrao={diaEnvioParam}
        />
      )}

      {campanhaParaMetricas && (
        <DetalhesEnviosModal
          campanha={campanhaParaMetricas}
          open={!!campanhaParaMetricas}
          onOpenChange={() => setCampanhaParaMetricas(null)}
          onSuccess={carregarDados}
          isAdminOrComercial={isAdmin || isComercial}
        />
      )}

      {campanhaParaPrevia && (
        <PreviaCampanhaModal
          open={!!campanhaParaPrevia}
          onOpenChange={() => setCampanhaParaPrevia(null)}
          assunto={campanhaParaPrevia.assunto || ''}
          corpo={campanhaParaPrevia.corpo || ''}
          segmento={campanhaParaPrevia.segmento || 'todos'}
          contagem={contagemDestinatarios}
        />
      )}
    </div>
  )
}
