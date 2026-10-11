import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import {
  CotacaoRecord,
  SubcontratoRecord,
  ProjetoRecord,
  ProjetoEtapaRecord,
  EntregavelRecord,
} from '@/types'
import { cotacoesService, RespostaCotacaoData } from '@/services/executores'
import { subcontratosService } from '@/services/subcontratos'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  HardHat,
  MessageSquareQuote,
  Briefcase,
  FileCheck2,
  Clock,
  Send,
  BarChart3,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Layers,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  ArrowRight,
  FolderKanban,
  Check,
  Plus,
} from 'lucide-react'
import { CronogramaGantt } from '@/components/projetos/CronogramaGantt'
import { ModalDetalheEtapa } from '@/components/projetos/ModalDetalheEtapa'
import { ModalNovaMedicao } from '@/components/projetos/ModalNovaMedicao'

export const PortalExecutorPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [cotacoes, setCotacoes] = useState<CotacaoRecord[]>([])
  const [subcontratos, setSubcontratos] = useState<SubcontratoRecord[]>([])
  const [etapas, setEtapas] = useState<ProjetoEtapaRecord[]>([])
  const [entregaveis, setEntregaveis] = useState<EntregavelRecord[]>([])

  // Modal para responder cotação
  const [modalResponderOpen, setModalResponderOpen] = useState(false)
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<CotacaoRecord | null>(null)
  const [precoOfertado, setPrecoOfertado] = useState('')
  const [prazoOfertado, setPrazoOfertado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvandoResposta, setSalvandoResposta] = useState(false)

  // Modal para visualizar cláusulas e detalhes do subcontrato
  const [modalSubcontratoOpen, setModalSubcontratoOpen] = useState(false)
  const [subcontratoSelecionado, setSubcontratoSelecionado] = useState<SubcontratoRecord | null>(
    null,
  )

  // Modal para apresentar medição progressiva (Executor)
  const [modalNovaMedicaoOpen, setModalNovaMedicaoOpen] = useState(false)
  const [subcontratoParaMedicaoId, setSubcontratoParaMedicaoId] = useState<string | undefined>(
    undefined,
  )

  // Visualização de Cronograma (Gantt) somente leitura no Portal do Executor
  const [visualizacaoAndamento, setVisualizacaoAndamento] = useState<'lista' | 'cronograma'>(
    'cronograma',
  )
  const [modalDetalheEtapaOpen, setModalDetalheEtapaOpen] = useState(false)
  const [etapaSelecionada, setEtapaSelecionada] = useState<ProjetoEtapaRecord | null>(null)

  const carregarDadosPortal = async () => {
    if (!user?.email) return
    setCarregando(true)
    try {
      // 1. Cotações enviadas para o executor logado
      const cotacoesRes = await pb.collection('cotacoes').getFullList<CotacaoRecord>({
        filter: `executor.email = '${user.email}'`,
        sort: '-created',
        expand: 'projeto,grupo,executor,etapa',
      })
      setCotacoes(cotacoesRes)

      // 2. Subcontratos do executor logado
      const subsRes = await subcontratosService.listMeusSubcontratos(user.email)
      setSubcontratos(subsRes)

      // 3. Etapas e entregáveis dos projetos em que atua (para a aba Andamento)
      const projetosIds = Array.from(new Set(subsRes.map((s) => s.projeto).filter(Boolean)))

      if (projetosIds.length > 0) {
        const etapasFilter = projetosIds.map((pid) => `projeto = '${pid}'`).join(' || ')
        const etapasRes = await pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
          filter: etapasFilter,
          sort: 'ordem,created',
          expand: 'projeto,executor',
        })
        setEtapas(etapasRes)

        if (etapasRes.length > 0) {
          const etapasIds = etapasRes.map((e) => e.id)
          const entregaveisFilter = etapasIds.map((eid) => `etapa = '${eid}'`).join(' || ')
          const entregaveisRes = await pb.collection('entregaveis').getFullList<EntregavelRecord>({
            filter: entregaveisFilter,
            sort: 'created',
            expand: 'etapa,etapa.projeto',
          })
          setEntregaveis(entregaveisRes)
        } else {
          setEntregaveis([])
        }
      } else {
        setEtapas([])
        setEntregaveis([])
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados do portal',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDadosPortal()
  }, [user?.email])

  const abrirModalResposta = (c: CotacaoRecord) => {
    setCotacaoSelecionada(c)
    setPrecoOfertado(c.preco_ofertado ? String(c.preco_ofertado) : '')
    setPrazoOfertado(c.prazo_ofertado || '')
    setObservacoes(c.observacoes || '')
    setModalResponderOpen(true)
  }

  const handleEnviarResposta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cotacaoSelecionada) return

    const precoNum = parseFloat(precoOfertado.replace(',', '.'))
    if (!precoNum || isNaN(precoNum) || precoNum <= 0) {
      toast({
        title: 'Preço obrigatório',
        description: 'Informe o valor total ofertado para o escopo solicitado.',
        variant: 'destructive',
      })
      return
    }

    if (!prazoOfertado.trim()) {
      toast({
        title: 'Prazo obrigatório',
        description: 'Informe o prazo estimado em dias para a entrega técnica.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoResposta(true)
    try {
      const payload: RespostaCotacaoData = {
        preco_ofertado: precoNum,
        prazo_ofertado: prazoOfertado.trim(),
        observacoes: observacoes.trim() || undefined,
      }

      await cotacoesService.responderCotacaoLogado(cotacaoSelecionada.id, payload)
      toast({
        title: 'Cotação respondida com sucesso!',
        description: 'Seus valores e prazos foram submetidos à coordenação de engenharia.',
      })
      setModalResponderOpen(false)
      carregarDadosPortal()
    } catch (err: any) {
      toast({
        title: 'Falha ao enviar resposta',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoResposta(false)
    }
  }

  const subcontratosPendentesAssinatura = subcontratos.filter(
    (s) => s.status === 'aguardando_assinatura',
  )

  const cotacoesAbertas = cotacoes.filter((c) => c.status === 'convite_enviado' || !c.status)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Topo Institucional do Portal */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#1E2A4A] text-white flex items-center justify-center shrink-0">
            <HardHat className="w-6 h-6 text-[#D95A2B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Portal do Executor</h1>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[10px]">
                Área Exclusiva
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bem-vindo, <strong>{user?.name}</strong>. Acompanhe seus convites de cotação,
              subcontratos ativos e o andamento das etapas técnicas delegadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDadosPortal}
            disabled={carregando}
            className="text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Alerta de Destaque: Subcontrato pendente de assinatura */}
      {subcontratosPendentesAssinatura.length > 0 && (
        <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-orange-950 text-sm">
                Atenção: Você possui {subcontratosPendentesAssinatura.length} Termo(s) de
                Subcontratação aguardando sua assinatura eletrônica!
              </h3>
              <p className="text-xs text-orange-800 mt-0.5">
                Revise os termos e assine com segurança para formalizar a contratação do escopo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {subcontratosPendentesAssinatura.map((sub) => (
              <Button
                key={sub.id}
                size="sm"
                asChild
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold h-9 shadow-xs"
              >
                <Link to={`/subcontrato/${sub.token_assinatura}`} target="_blank">
                  <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                  Assinar {sub.numero}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Convites Abertos</span>
              <MessageSquareQuote className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {cotacoesAbertas.length}
            </div>
            <span className="text-[10px] text-slate-400">Aguardando sua proposta</span>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Cotações Respondidas</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {cotacoes.filter((c) => c.status === 'respondida').length}
            </div>
            <span className="text-[10px] text-slate-400">Em análise técnica</span>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Meus Subcontratos</span>
              <Briefcase className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {subcontratos.length}
            </div>
            <span className="text-[10px] text-slate-400">
              {subcontratos.filter((s) => s.status === 'assinado').length} formalizados
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Etapas Delegadas</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{etapas.length}</div>
            <span className="text-[10px] text-slate-400">
              {etapas.filter((e) => e.status === 'concluida').length} concluídas
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais do Portal */}
      <Tabs defaultValue="cotacoes" className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="cotacoes" className="text-xs flex items-center gap-1.5">
            <MessageSquareQuote className="w-3.5 h-3.5 text-blue-600" />
            Convites de Cotação ({cotacoes.length})
          </TabsTrigger>
          <TabsTrigger value="subcontratos" className="text-xs flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-purple-600" />
            Meus Projetos & Subcontratos ({subcontratos.length})
          </TabsTrigger>
          <TabsTrigger value="andamento" className="text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            Andamento Técnico ({etapas.length} etapas)
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: CONVITES DE COTAÇÃO */}
        <TabsContent value="cotacoes">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">
                Convites de Cotação Recebidos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Veja o escopo técnico solicitado pela coordenação de projetos da G+ e envie suas
                propostas de preço e prazo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {carregando ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Carregando convites de cotação...
                </div>
              ) : cotacoes.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <MessageSquareQuote className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Nenhum convite no momento</p>
                  <p className="text-[11px] text-slate-400">
                    Você será notificado por e-mail e WhatsApp assim que um novo projeto for
                    disponibilizado para cotação.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cotacoes.map((c) => {
                    const projeto = c.expand?.projeto
                    const grupo = c.expand?.grupo
                    const isAberta = c.status === 'convite_enviado' || !c.status
                    const isEscolhida = c.escolhida || c.status === 'escolhida'
                    const isRespondida = c.status === 'respondida'

                    return (
                      <div
                        key={c.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              {projeto?.codigo || 'Projeto'}
                            </span>
                            {grupo && (
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                                <FolderKanban className="w-3 h-3 text-slate-400" />
                                {grupo.codigo}
                              </span>
                            )}
                            <Badge
                              className={
                                isEscolhida
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                  : isRespondida
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                              }
                            >
                              {isEscolhida
                                ? 'Proposta Vencedora / Contratado'
                                : isRespondida
                                  ? 'Proposta Enviada'
                                  : 'Aguardando Proposta'}
                            </Badge>
                          </div>

                          <h4 className="font-bold text-sm text-slate-900">
                            {projeto?.nome || 'Escopo Técnico de Engenharia'}
                          </h4>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                            {c.escopo || 'Escopo sob demanda técnica.'}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            {c.data_limite && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                Limite resposta:{' '}
                                <strong className="text-slate-700">
                                  {formatDateBr(c.data_limite)}
                                </strong>
                              </span>
                            )}
                            {c.preco_ofertado ? (
                              <span className="flex items-center gap-1 font-mono text-emerald-700 font-bold">
                                Valor ofertado: {formatCurrencyBr(c.preco_ofertado)} (
                                {c.prazo_ofertado})
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                          {isEscolhida ? (
                            <Badge className="bg-emerald-600 text-white text-xs px-3 py-1.5 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Contratação Aprovada
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => abrirModalResposta(c)}
                              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-9 px-4 font-semibold shadow-xs w-full sm:w-auto"
                            >
                              <Send className="w-3.5 h-3.5 mr-1.5" />
                              {isRespondida ? 'Atualizar Proposta' : 'Responder Cotação'}
                            </Button>
                          )}

                          {c.token && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="text-xs h-9 border-slate-200 text-slate-600 hover:bg-slate-50 w-full sm:w-auto"
                            >
                              <Link to={`/cotacao/${c.token}`} target="_blank">
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Link Público
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: MEUS PROJETOS & SUBCONTRATOS */}
        <TabsContent value="subcontratos">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">
                Projetos Contratados & Termos de Subcontratação
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Consulte todos os projetos em que você foi contratado pela G+ Engenharia, as
                cláusulas aplicáveis herdadas do contrato original e o status das assinaturas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {carregando ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Carregando subcontratos...
                </div>
              ) : subcontratos.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    Nenhum subcontrato formalizado ainda
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Assim que uma proposta de cotação sua for selecionada, o Termo de Subcontratação
                    aparecerá aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subcontratos.map((sub) => {
                    const prj = sub.expand?.projeto
                    const grp = sub.expand?.grupo
                    const csOrigem = sub.expand?.contrato_servico_origem
                    const isAssinado = sub.status === 'assinado'

                    return (
                      <div
                        key={sub.id}
                        className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-4"
                      >
                        {/* Header do Subcontrato com Cadeia de Rastreabilidade nos Dois Sentidos */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                                {sub.numero}
                              </span>
                              <Badge
                                className={
                                  isAssinado
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                                }
                              >
                                {isAssinado ? 'Assinado / Vigente' : 'Aguardando Assinatura'}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                              >
                                {sub.modo_execucao === 'terceirizada_integral'
                                  ? 'Terceirização Integral (100%)'
                                  : 'Terceirização Parcial'}
                              </Badge>
                            </div>

                            <h3 className="font-bold text-base text-slate-900 mt-1">
                              {prj?.nome || `Projeto ${prj?.codigo || ''}`}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSubcontratoSelecionado(sub)
                                setModalSubcontratoOpen(true)
                              }}
                              className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              Ver Cláusulas e Detalhes
                            </Button>

                            {isAssinado && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSubcontratoParaMedicaoId(sub.id)
                                  setModalNovaMedicaoOpen(true)
                                }}
                                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-8 font-semibold shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Apresentar Medição
                              </Button>
                            )}

                            {!isAssinado && sub.token_assinatura && (
                              <Button
                                size="sm"
                                asChild
                                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-8 font-semibold shadow-xs"
                              >
                                <Link to={`/subcontrato/${sub.token_assinatura}`} target="_blank">
                                  <FileSignature className="w-3.5 h-3.5 mr-1" />
                                  Assinar Agora
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* RASTREABILIDADE INVERSA VISÍVEL: Subcontrato -> Projeto -> Grupo -> Contrato */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Cadeia de Rastreabilidade Contratual (Origem):
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                              Subcontrato: {sub.numero}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                              Projeto: {prj?.codigo || 'PRJ'}
                            </span>
                            {grp && (
                              <>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  Grupo: {grp.codigo}
                                </span>
                              </>
                            )}
                            {csOrigem && (
                              <>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                                  Contrato Original: {csOrigem.numero}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Dados Comerciais e Técnicos */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Valor Contratado
                            </span>
                            <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                              {formatCurrencyBr(sub.valor_total)}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {sub.condicoes_pagamento || 'Conforme validação das etapas'}
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Duração / Prazo de Execução
                            </span>
                            <div className="font-semibold text-slate-900 mt-0.5">
                              {sub.prazo_dias || 30} dias corridos
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {sub.nota_prazo || 'Mesma duração do contrato principal'}
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Assinatura Eletrônica
                            </span>
                            <div className="font-semibold text-slate-900 mt-0.5">
                              {isAssinado ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  Assinado por {sub.executor_nome_assinante}
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold">
                                  Pendente de Assinatura
                                </span>
                              )}
                            </div>
                            {sub.data_assinatura_executor && (
                              <span className="text-[10px] text-slate-400 block">
                                Em {formatDateBr(sub.data_assinatura_executor)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Descrição da Parte Delegada */}
                        {sub.descricao_delegada && (
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">
                              Descrição da Parte Técnica Delegada:
                            </Label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed">
                              {sub.descricao_delegada}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: ANDAMENTO TÉCNICO DOS PROJETOS DELEGADOS */}
        <TabsContent value="andamento">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Andamento Técnico & Cronograma Visual
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Acompanhe o cronograma, marcos e entregas técnicas das etapas atribuídas
                  exclusivamente ao seu escopo contratado.
                </CardDescription>
              </div>

              {/* Alternância Lista / Cronograma para o Executor */}
              <div className="flex items-center border border-slate-200 rounded-md bg-slate-50 p-0.5 shrink-0">
                <Button
                  type="button"
                  variant={visualizacaoAndamento === 'cronograma' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setVisualizacaoAndamento('cronograma')}
                  className={`h-7 px-2.5 text-xs ${
                    visualizacaoAndamento === 'cronograma'
                      ? 'bg-[#D95A2B] text-white'
                      : 'text-slate-600'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1" />
                  Cronograma (Gantt)
                </Button>
                <Button
                  type="button"
                  variant={visualizacaoAndamento === 'lista' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setVisualizacaoAndamento('lista')}
                  className={`h-7 px-2.5 text-xs ${
                    visualizacaoAndamento === 'lista' ? 'bg-[#D95A2B] text-white' : 'text-slate-600'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Lista de Etapas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {carregando ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Carregando etapas do projeto...
                </div>
              ) : etapas.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    Nenhuma etapa em execução no momento
                  </p>
                  <p className="text-[11px] text-slate-400">
                    As etapas dos seus projetos subcontratados aparecerão aqui à medida que forem
                    desdobradas pelo Gestor.
                  </p>
                </div>
              ) : visualizacaoAndamento === 'cronograma' ? (
                <CronogramaGantt
                  projeto={etapas[0]?.expand?.projeto || null}
                  etapas={etapas}
                  canEdit={false}
                  onEtapaClick={(et) => {
                    setEtapaSelecionada(et)
                    setModalDetalheEtapaOpen(true)
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {etapas.map((et) => {
                    const entregaveisDaEtapa = entregaveis.filter((e) => e.etapa === et.id)
                    const prj = et.expand?.projeto

                    return (
                      <div
                        key={et.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3 cursor-pointer"
                        onClick={() => {
                          setEtapaSelecionada(et)
                          setModalDetalheEtapaOpen(true)
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                {prj?.codigo || 'Projeto'}
                              </span>
                              <span className="font-bold text-sm text-slate-900">{et.nome}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Disciplina: <strong>{et.disciplina || 'Engenharia'}</strong> • Ordem:{' '}
                              <strong>Etapa {et.ordem || 1}</strong>
                            </span>
                          </div>

                          <Badge
                            className={
                              et.status === 'concluida'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : et.status === 'em_andamento'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }
                          >
                            {et.status === 'concluida'
                              ? 'Concluída'
                              : et.status === 'em_andamento'
                                ? 'Em Andamento'
                                : et.status === 'cotacao'
                                  ? 'Fase de Cotação'
                                  : 'A Iniciar'}
                          </Badge>
                        </div>

                        {et.descricao && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                            {et.descricao}
                          </p>
                        )}

                        {/* Entregáveis da Etapa */}
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                            Entregáveis Relacionados ({entregaveisDaEtapa.length}):
                          </span>

                          {entregaveisDaEtapa.length === 0 ? (
                            <span className="text-xs text-slate-400 italic block">
                              Nenhum entregável cadastrado para esta etapa até o momento.
                            </span>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {entregaveisDaEtapa.map((ent) => (
                                <div
                                  key={ent.id}
                                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900">{ent.nome}</div>
                                    <span className="text-[10px] text-slate-500">
                                      Versão: {ent.versao || 'Rev.00'}
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-white text-slate-700 shrink-0"
                                  >
                                    {ent.status || 'Pendente'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para Responder Cotação logado */}
      <Dialog open={modalResponderOpen} onOpenChange={setModalResponderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-[#D95A2B]" />
              Enviar Proposta Comercial
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Projeto: <strong>{cotacaoSelecionada?.expand?.projeto?.codigo}</strong> •{' '}
              {cotacaoSelecionada?.expand?.projeto?.nome}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarResposta} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Escopo Solicitado:</Label>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-800 max-h-32 overflow-y-auto leading-relaxed">
                {cotacaoSelecionada?.escopo || 'Escopo técnico detalhado.'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="preco">Preço Ofertado (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={precoOfertado}
                  onChange={(e) => setPrecoOfertado(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1 text-sm font-semibold"
                />
              </div>

              <div>
                <Label htmlFor="prazo">Prazo de Execução *</Label>
                <Input
                  id="prazo"
                  value={prazoOfertado}
                  onChange={(e) => setPrazoOfertado(e.target.value)}
                  placeholder="Ex: 25 dias corridos"
                  required
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="obs">Observações / Premissas Técnicas</Label>
              <Textarea
                id="obs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes da metodologia, entregáveis inclusos, ART, etc..."
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalResponderOpen(false)}
                disabled={salvandoResposta}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoResposta}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
              >
                {salvandoResposta ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Submeter Proposta
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Reutilizável de Detalhe da Etapa (Somente leitura para Executor) */}
      <ModalDetalheEtapa
        open={modalDetalheEtapaOpen}
        onOpenChange={setModalDetalheEtapaOpen}
        etapa={etapaSelecionada}
        canEdit={false}
      />

      {/* Modal para Visualizar Cláusulas e Detalhes do Subcontrato */}
      <Dialog open={modalSubcontratoOpen} onOpenChange={setModalSubcontratoOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-600" />
              Termo de Subcontratação {subcontratoSelecionado?.numero}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Projeto {subcontratoSelecionado?.expand?.projeto?.codigo} • Vinculado ao Contrato
              Principal {subcontratoSelecionado?.expand?.contrato_servico_origem?.numero || 'G+'}
            </DialogDescription>
          </DialogHeader>

          {subcontratoSelecionado && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Valor Total
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatCurrencyBr(subcontratoSelecionado.valor_total)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Duração / Prazo
                  </span>
                  <span className="font-semibold text-slate-800">
                    {subcontratoSelecionado.prazo_dias || 30} dias
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Modalidade
                  </span>
                  <span className="font-semibold text-slate-800">
                    {subcontratoSelecionado.modo_execucao === 'terceirizada_integral'
                      ? 'Integral'
                      : 'Parcial'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Status
                  </span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {subcontratoSelecionado.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Informações de Retenção Técnica */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-950">
                    Retenção Técnica de Garantia (
                    {subcontratoSelecionado.percentual_retencao_tecnica || 0}%):
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white text-amber-800 border-amber-300"
                  >
                    {subcontratoSelecionado.status_retencao || 'sem_retencao'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    Retido Acumulado:{' '}
                    <strong>
                      {formatCurrencyBr(subcontratoSelecionado.retencao_tecnica_acumulada || 0)}
                    </strong>
                  </span>
                  <span>
                    Já Liberado:{' '}
                    <strong>
                      {formatCurrencyBr(subcontratoSelecionado.retencao_tecnica_liberada || 0)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Cláusulas Contratuais Aplicáveis (Herdadas do Contrato Original):
                </Label>
                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 max-h-60 overflow-y-auto leading-relaxed whitespace-pre-line font-sans">
                  {subcontratoSelecionado.clausulas_texto || 'Sem cláusulas cadastradas.'}
                </div>
              </div>

              {subcontratoSelecionado.parcelas_json &&
                subcontratoSelecionado.parcelas_json.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Cronograma de Pagamento:
                    </Label>
                    <div className="space-y-1.5">
                      {subcontratoSelecionado.parcelas_json.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{p.descricao}</span>
                            {p.vencimento && (
                              <span className="text-[11px] text-slate-400 block">
                                Vencimento: {formatDateBr(p.vencimento)}
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatCurrencyBr(p.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalSubcontratoOpen(false)}
                >
                  Fechar
                </Button>
                {subcontratoSelecionado.status !== 'assinado' &&
                  subcontratoSelecionado.token_assinatura && (
                    <Button
                      size="sm"
                      asChild
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
                    >
                      <Link
                        to={`/subcontrato/${subcontratoSelecionado.token_assinatura}`}
                        target="_blank"
                      >
                        <FileSignature className="w-3.5 h-3.5 mr-1" />
                        Ir para Página de Assinatura
                      </Link>
                    </Button>
                  )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para Apresentar Medição Progressiva (Executor) */}
      <ModalNovaMedicao
        open={modalNovaMedicaoOpen}
        onOpenChange={setModalNovaMedicaoOpen}
        subcontratos={subcontratos.filter((s) => s.status === 'assinado')}
        subcontratoPreSelecionadoId={subcontratoParaMedicaoId}
        onSuccess={() => {
          carregarDadosPortal()
        }}
      />
    </div>
  )
}
export default PortalExecutorPage
