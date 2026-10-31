import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { portalPrestadorService, ordensServicoService } from '@/services/prestadores'
import { PortalOsRecord, PortalEntregavelRecord, PortalDocumentoRecord } from '@/types'
import { entregaveisCicloService } from '@/services/cadeiaContratosProjetos'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Calendar,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  FileDown,
  Loader2,
  HardHat,
  DollarSign,
  Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GPlusLogo } from '@/components/GPlusLogo'
import { SecaoCotacoesPrestador } from '@/components/projetos/SecaoCotacoesPrestador'
import { Briefcase, MessageSquare, GitCompare, UserCheck, Award } from 'lucide-react'
import { ModalAssinaturaEletronicaOS } from '@/components/prestadores/ModalAssinaturaEletronicaOS'
import { PainelMensagensOs } from '@/components/prestadores/PainelMensagensOs'
import { PortalMeuCadastro } from '@/components/prestadores/PortalMeuCadastro'
import { SecaoPreCotacoesPrestador } from '@/components/prestadores/SecaoPreCotacoesPrestador'
import { PortalMinhasHoras } from '@/components/prestadores/PortalMinhasHoras'
import { PortalMeuDesempenho } from '@/components/prestadores/PortalMeuDesempenho'
import { prestadoresService } from '@/services/prestadores'
import { PrestadorRecord } from '@/types'
import { EntregavelVersaoComentarios } from '@/components/projetos/EntregavelVersaoComentarios'
import { ModalOQueMudou } from '@/components/projetos/ModalOQueMudou'
import { VisualizadorIfc } from '@/components/projetos/VisualizadorIfc'
import { PainelIssuesRevisao } from '@/components/projetos/PainelIssuesRevisao'
import { ModalChecklistEnvioIfc } from '@/components/projetos/ModalChecklistEnvioIfc'
import { mensagensOsService } from '@/services/mensagensOs'
import { validarArquivoComLimites } from '@/services/operacaoSistema'
import { Box } from 'lucide-react'

export const PortalPrestadorPage: React.FC = () => {
  const { user, logout } = useAuth()
  const { toast } = useToast()

  const [meuPrestador, setMeuPrestador] = useState<PrestadorRecord | null>(null)
  const [ordensServico, setOrdensServico] = useState<PortalOsRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [osSelecionada, setOsSelecionada] = useState<PortalOsRecord | null>(null)

  const [entregaveis, setEntregaveis] = useState<PortalEntregavelRecord[]>([])
  const [documentos, setDocumentos] = useState<PortalDocumentoRecord[]>([])
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)

  // Submissão de versão pelo prestador
  const [modalSubmeterVersaoOpen, setModalSubmeterVersaoOpen] = useState(false)
  const [entregavelSelecionadoSubmissao, setEntregavelSelecionadoSubmissao] =
    useState<PortalEntregavelRecord | null>(null)
  const [obsSubmissaoPrestador, setObsSubmissaoPrestador] = useState('')
  const [submetendoVersao, setSubmetendoVersao] = useState(false)

  // Estados Rodada 17: Visualizador IFC e Checklist Envio no Portal do Prestador
  const [entregavelVisualizandoIfc, setEntregavelVisualizandoIfc] =
    useState<PortalEntregavelRecord | null>(null)
  const [modalChecklistEnvioOpen, setModalChecklistEnvioOpen] = useState(false)
  const [entregavelParaEnvioIfc, setEntregavelParaEnvioIfc] =
    useState<PortalEntregavelRecord | null>(null)

  // Modal de Assinatura da OS
  const [modalAssinarOpen, setModalAssinarOpen] = useState(false)

  // Contadores de mensagens não lidas por OS e Modal O que mudou
  const [naoLidasPorOs, setNaoLidasPorOs] = useState<Record<string, number>>({})
  const [modalOQueMudouAberto, setModalOQueMudouAberto] = useState(false)
  const [entregavelParaOQueMudou, setEntregavelParaOQueMudou] =
    useState<PortalEntregavelRecord | null>(null)

  const carregarMinhasOS = async () => {
    setCarregando(true)
    try {
      // Buscar dados do prestador logado
      try {
        const prestadorData = await prestadoresService.getMeuPerfilPrestador()
        setMeuPrestador(prestadorData)
      } catch {
        /* intentionally ignored */
      }

      const lista = await portalPrestadorService.listMinhasOS()
      setOrdensServico(lista)

      // Carregar contadores de mensagens não lidas por OS no Portal
      try {
        const contadores = await mensagensOsService.obterContadoresNaoLidas()
        setNaoLidasPorOs(contadores.por_os || {})
      } catch {
        /* ignore */
      }

      if (lista.length > 0 && !osSelecionada) {
        setOsSelecionada(lista[0])
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Ordens de Serviço',
        description: err.message || 'Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarMinhasOS()
  }, [])

  useEffect(() => {
    if (osSelecionada) {
      setCarregandoDetalhes(true)
      Promise.all([
        portalPrestadorService.listEntregaveis(osSelecionada.os_id),
        portalPrestadorService.listDocumentos(osSelecionada.os_id),
      ])
        .then(([ents, docs]) => {
          setEntregaveis(ents)
          setDocumentos(docs)
        })
        .catch(() => {})
        .finally(() => {
          setCarregandoDetalhes(false)
        })
    }
  }, [osSelecionada])

  const handleSucessoAssinatura = () => {
    toast({
      title: 'Ordem de Serviço assinada com sucesso!',
      description: 'Seu aceite eletrônico foi registrado com validade jurídica na plataforma G+.',
    })
    carregarMinhasOS()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'minuta':
        return <Badge variant="outline">Minuta</Badge>
      case 'aguardando_assinatura':
        return <Badge className="bg-amber-500 text-white">Aguardando Assinatura</Badge>
      case 'assinada':
        return <Badge className="bg-sky-600 text-white">Assinada</Badge>
      case 'em_execucao':
        return <Badge className="bg-emerald-600 text-white">Em Execução</Badge>
      case 'concluida':
        return <Badge className="bg-indigo-600 text-white">Concluída</Badge>
      case 'avaliada':
        return <Badge className="bg-purple-600 text-white">Avaliada</Badge>
      case 'encerrada':
        return <Badge variant="secondary">Encerrada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topo do Portal */}
      <header className="bg-[#1E2A4A] text-white border-b border-[#141D34] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GPlusLogo variant="compact" theme="dark" size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight">Portal do Prestador</span>
              <span className="text-[10px] bg-[#D95A2B] text-white px-2 py-0.5 rounded font-semibold uppercase">
                Ambiente Seguro
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Acesso exclusivo a escopos técnicos, entregáveis e prazos da sua Ordem de Serviço
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-right hidden sm:block">
            <span className="font-medium text-slate-200 block">{user?.name || user?.email}</span>
            <span className="text-[11px] text-slate-400 font-mono">{user?.email}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="text-xs border-white/20 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            Sair
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Boas-Vindas & Política de Privacidade */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-50 text-[#D95A2B]">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Portal de Engenharia & Cotações G+
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe suas cotações técnicas abertas, ordens de serviço ativas, escopos
                delegados e entregas de projetos.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs py-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Canal Técnico Isolado
          </Badge>
        </div>

        {/* Abas Principais: Pré-Cotações vs Cotações vs Ordens de Serviço vs Meu Desempenho vs Minhas Horas (se interno) vs Meu Cadastro */}
        <Tabs defaultValue="pre_cotacoes" className="w-full space-y-4">
          <TabsList
            className={`grid ${
              meuPrestador?.tipo === 'interno' ? 'grid-cols-6 max-w-4xl' : 'grid-cols-5 max-w-3xl'
            } text-xs bg-slate-200/70 p-1`}
          >
            <TabsTrigger
              value="pre_cotacoes"
              className="gap-1.5 text-xs font-bold text-[#D95A2B] data-[state=active]:bg-white"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D95A2B]" />
              Pré-Cotações
            </TabsTrigger>
            <TabsTrigger
              value="cotacoes"
              className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#D95A2B]" />
              Cotações OS
            </TabsTrigger>
            <TabsTrigger
              value="ordens_servico"
              className="gap-1.5 text-xs font-semibold data-[state=active]:bg-white"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Ordens de Serviço ({ordensServico.length})
            </TabsTrigger>
            <TabsTrigger
              value="meu_desempenho"
              className="gap-1.5 text-xs font-bold text-[#D95A2B] data-[state=active]:bg-white"
            >
              <Award className="w-3.5 h-3.5 text-[#D95A2B]" />
              Meu Desempenho
            </TabsTrigger>
            {meuPrestador?.tipo === 'interno' && (
              <TabsTrigger
                value="minhas_horas"
                className="gap-1.5 text-xs font-bold text-sky-700 data-[state=active]:bg-white"
              >
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Minhas Horas
              </TabsTrigger>
            )}
            <TabsTrigger
              value="meu_cadastro"
              className="gap-1.5 text-xs font-bold text-slate-700 data-[state=active]:bg-white"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-700" />
              Meu Cadastro
            </TabsTrigger>
          </TabsList>

          {/* ABA MEU DESEMPENHO / SCORECARD PRÓPRIO (RODADA 16) */}
          <TabsContent value="meu_desempenho" className="space-y-4">
            <PortalMeuDesempenho />
          </TabsContent>

          {/* ABA 0: PRÉ-COTAÇÕES VINCULANTES (RODADA 13) */}
          <TabsContent value="pre_cotacoes" className="space-y-4">
            <SecaoPreCotacoesPrestador onRespostaEnviada={carregarMinhasOS} />
          </TabsContent>

          {/* ABA 1: COTAÇÕES */}
          <TabsContent value="cotacoes" className="space-y-4">
            <SecaoCotacoesPrestador onCotacaoRespondida={carregarMinhasOS} />
          </TabsContent>

          {/* ABA 2.5: MINHAS HORAS (PRESTADOR INTERNO - RODADA 15) */}
          {meuPrestador?.tipo === 'interno' && (
            <TabsContent value="minhas_horas" className="space-y-4">
              <PortalMinhasHoras
                prestador={meuPrestador}
                ordensServico={ordensServico}
                onApontamentoSalvo={carregarMinhasOS}
              />
            </TabsContent>
          )}

          {/* ABA 3: MEU CADASTRO (RODADA 12) */}
          <TabsContent value="meu_cadastro" className="space-y-4">
            {meuPrestador ? (
              <PortalMeuCadastro
                prestador={meuPrestador}
                onAtualizado={() => {
                  prestadoresService
                    .getMeuPerfilPrestador()
                    .then(setMeuPrestador)
                    .catch(() => {})
                }}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando dados do seu cadastro...</p>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: ORDENS DE SERVIÇO */}
          <TabsContent value="ordens_servico" className="space-y-4">
            {carregando ? (
              <div className="flex justify-center p-16 bg-white rounded-xl border border-slate-200">
                <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
              </div>
            ) : ordensServico.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">
                  Nenhuma Ordem de Serviço Encontrada
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  No momento você não possui Ordens de Serviço ativas no sistema. Assim que uma
                  proposta sua for escolhida na cotação automática ou a equipe G+ emitir uma OS
                  vinculada ao seu e-mail, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Lista de Ordens de Serviço */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block px-1">
                    Suas Ordens de Serviço ({ordensServico.length})
                  </span>

                  {ordensServico.map((os) => {
                    const isSelected = osSelecionada?.id === os.id
                    return (
                      <div
                        key={os.id}
                        onClick={() => setOsSelecionada(os)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#D95A2B] bg-orange-50/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{os.numero_os}</span>
                            {(naoLidasPorOs[os.os_id] || 0) > 0 && (
                              <Badge className="bg-[#D95A2B] text-white text-[10px] px-1.5 py-0 h-4 flex items-center gap-1">
                                <MessageSquare className="w-2.5 h-2.5" />
                                {naoLidasPorOs[os.os_id]}
                              </Badge>
                            )}
                          </div>
                          {getStatusBadge(os.status)}
                        </div>

                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Código do Projeto:</span>
                            <span className="font-mono font-medium text-slate-800">
                              {os.codigo_projeto}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Disciplina:</span>
                            <span className="font-medium text-slate-800">
                              {os.disciplina || 'Engenharia'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Valor da OS:</span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrencyBr(os.valor_os || 0)}
                            </span>
                          </div>
                          {os.prazo_dias && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Prazo:</span>
                              <span>{os.prazo_dias} dias</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Coluna 2 e 3: Detalhes da Ordem de Serviço Selecionada */}
                <div className="lg:col-span-2 space-y-6">
                  {osSelecionada && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
                      {/* Topo da OS */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900">
                              {osSelecionada.numero_os}
                            </h2>
                            {getStatusBadge(osSelecionada.status)}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Projeto Referência:{' '}
                            <strong className="font-mono text-slate-700">
                              {osSelecionada.codigo_projeto}
                            </strong>{' '}
                            • Disciplina:{' '}
                            <strong className="text-slate-700">
                              {osSelecionada.disciplina || 'Engenharia'}
                            </strong>
                          </p>
                        </div>

                        {(osSelecionada.status === 'aguardando_assinatura' ||
                          osSelecionada.status === 'minuta') && (
                          <Button
                            onClick={() => {
                              setModalAssinarOpen(true)
                            }}
                            className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs shadow-xs"
                          >
                            <ShieldCheck className="w-4 h-4 mr-1.5" />
                            Assinar Eletronicamente (OTP)
                          </Button>
                        )}
                      </div>

                      {/* Detalhes Técnicos */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg text-xs">
                        <div>
                          <span className="text-slate-400 block">Valor Acordado da OS</span>
                          <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                            {formatCurrencyBr(osSelecionada.valor_os || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Prazo de Execução</span>
                          <span className="font-semibold text-slate-800 mt-0.5 block">
                            {osSelecionada.prazo_dias
                              ? `${osSelecionada.prazo_dias} dias corridos`
                              : 'A definir'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Previsão de Término</span>
                          <span className="font-semibold text-slate-800 mt-0.5 block">
                            {osSelecionada.data_previsao_fim
                              ? formatDateBr(osSelecionada.data_previsao_fim)
                              : 'Acompanhar cronograma'}
                          </span>
                        </div>
                      </div>

                      {/* Escopo Técnico */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Escopo Técnico Delegado
                        </h3>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                          {osSelecionada.escopo_tecnico ||
                            'Nenhuma descrição técnica detalhada informada.'}
                        </div>
                      </div>

                      {/* Abas: Canal de Mensagens, Entregáveis e Documentos Técnicos */}
                      <Tabs defaultValue="mensagens" className="w-full">
                        <TabsList className="grid grid-cols-3 text-xs">
                          <TabsTrigger value="mensagens" className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#D95A2B]" />
                            <span>Mensagens</span>
                            {(naoLidasPorOs[osSelecionada.os_id] || 0) > 0 && (
                              <Badge className="bg-[#D95A2B] text-white text-[10px] px-1.5 py-0 h-4">
                                {naoLidasPorOs[osSelecionada.os_id]}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="entregaveis">
                            Entregáveis ({entregaveis.length})
                          </TabsTrigger>
                          <TabsTrigger value="issues">Issues de Revisão</TabsTrigger>
                          <TabsTrigger value="documentos">
                            Arquivos ({documentos.length})
                          </TabsTrigger>
                        </TabsList>

                        {/* ABA DE MENSAGENS NO PORTAL DO PRESTADOR */}
                        <TabsContent value="mensagens" className="pt-3">
                          <PainelMensagensOs
                            osId={osSelecionada.os_id}
                            numeroOs={osSelecionada.numero_os}
                            autorTipo="prestador"
                            autorNome={user?.name || user?.email || 'Prestador'}
                            autorUsuarioId={user?.id}
                            autorEmail={user?.email}
                            onMensagensLidas={() => {
                              setNaoLidasPorOs((prev) => ({ ...prev, [osSelecionada.os_id]: 0 }))
                            }}
                          />
                        </TabsContent>

                        <TabsContent value="entregaveis" className="pt-3">
                          {carregandoDetalhes ? (
                            <div className="flex justify-center p-6">
                              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
                            </div>
                          ) : entregaveis.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                              Nenhum entregável específico cadastrado para esta OS.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {entregaveis.map((ent) => (
                                <div
                                  key={ent.id}
                                  className="p-3.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg space-y-2"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{ent.nome}</span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] ${
                                            ent.status === 'aprovado'
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              : ent.status === 'enviado_revisao'
                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                : ent.status === 'devolvido'
                                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                                  : 'bg-white text-slate-700'
                                          }`}
                                        >
                                          {ent.status === 'aprovado'
                                            ? 'Aprovado'
                                            : ent.status === 'enviado_revisao'
                                              ? 'Em Revisão Interna'
                                              : ent.status === 'devolvido'
                                                ? 'Devolvido com Apontamentos'
                                                : ent.status || 'Atribuído'}
                                        </Badge>
                                      </div>
                                      {ent.descricao && (
                                        <p className="text-slate-600 text-[11px] leading-snug">
                                          {ent.descricao}
                                        </p>
                                      )}
                                      {ent.prazo_entrega && (
                                        <span className="text-slate-500 text-[10px] block">
                                          Prazo de entrega:{' '}
                                          <strong>{formatDateBr(ent.prazo_entrega)}</strong>
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Visualizador IFC 3D da própria OS */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEntregavelVisualizandoIfc(
                                            entregavelVisualizandoIfc?.id === ent.id ? null : ent,
                                          )
                                        }}
                                        className={`h-7 text-xs gap-1 ${
                                          entregavelVisualizandoIfc?.id === ent.id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-blue-700 border-blue-200 hover:bg-blue-50'
                                        }`}
                                      >
                                        <Box className="w-3.5 h-3.5" />
                                        <span>Visualizador IFC</span>
                                      </Button>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEntregavelParaOQueMudou(ent)
                                          setModalOQueMudouAberto(true)
                                        }}
                                        className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                                        title="Comparar com versão anterior"
                                      >
                                        <GitCompare className="w-3 h-3 text-blue-600" />
                                        <span>O que mudou</span>
                                      </Button>

                                      {(ent.status === 'atribuido' ||
                                        ent.status === 'em_producao' ||
                                        ent.status === 'devolvido' ||
                                        !ent.status) && (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setEntregavelParaEnvioIfc(ent)
                                            setModalChecklistEnvioOpen(true)
                                          }}
                                          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                        >
                                          <FileDown className="w-3.5 h-3.5" />
                                          Enviar Versão (IFC)
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Visualizador IFC 3D Embutido da OS */}
                                  {entregavelVisualizandoIfc?.id === ent.id && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                      <VisualizadorIfc
                                        tituloEntregavel={ent.nome}
                                        versaoNumero={ent.versao_atual || 1}
                                        isPrestador={true}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>

                        {/* ABA DE ISSUES NO PORTAL DO PRESTADOR */}
                        <TabsContent value="issues" className="pt-3">
                          {entregaveis.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                              Nenhum entregável cadastrado para esta OS.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900">
                                <p className="font-semibold">
                                  Apontamentos de Revisão e Não-Conformidades Técnicas
                                </p>
                                <p className="text-[11px] text-blue-700 mt-0.5">
                                  Veja abaixo os tópicos BCF e feedbacks registrados pelos
                                  revisores. Cada issue exibe o viewpoint (captura de tela 3D) e
                                  você pode marcar como corrigida indicando a versão de correção.
                                </p>
                              </div>

                              {entregaveis.map((ent) => (
                                <div
                                  key={ent.id}
                                  className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 shadow-sm"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h5 className="font-bold text-xs text-slate-800">{ent.nome}</h5>
                                    <Badge variant="outline" className="text-[10px]">
                                      v{ent.versao_atual || 1}.0
                                    </Badge>
                                  </div>
                                  <PainelIssuesRevisao
                                    entregavelId={ent.id}
                                    somenteLeitura={false}
                                    isPrestador={true}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="documentos" className="pt-3">
                          {carregandoDetalhes ? (
                            <div className="flex justify-center p-6">
                              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
                            </div>
                          ) : documentos.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                              Nenhum arquivo ou documento complementar anexado a esta OS.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                              {documentos.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="p-3 text-xs flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <div>
                                      <span className="font-semibold text-slate-800 block">
                                        {doc.titulo}
                                      </span>
                                      {doc.categoria && (
                                        <span className="text-slate-400 text-[10px] block">
                                          {doc.categoria}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">
                                    Disponível
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Submeter Versão pelo Prestador */}
      <Dialog open={modalSubmeterVersaoOpen} onOpenChange={setModalSubmeterVersaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-600" />
              Submeter Nova Versão do Entregável
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envio técnico para revisão da equipe G+:{' '}
              <strong>"{entregavelSelecionadoSubmissao?.nome}"</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Notas da Entrega</Label>
              <Input
                placeholder="Ex: Versão preliminar com plantas e memorial ajustado..."
                value={obsSubmissaoPrestador}
                onChange={(e) => setObsSubmissaoPrestador(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Anexo Técnico (Opcional)
              </Label>
              <Input
                type="file"
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const validacao = validarArquivoComLimites(f)
                    if (!validacao.valido) {
                      toast({
                        title: 'Teto de Arquivo Excedido',
                        description: validacao.mensagem,
                        variant: 'destructive',
                      })
                      e.target.value = ''
                    }
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Respeita os tetos da Administração: DWG (100MB), PDF (50MB), Imagem (25MB).
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalSubmeterVersaoOpen(false)}
              disabled={submetendoVersao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submetendoVersao}
              onClick={async () => {
                if (!entregavelSelecionadoSubmissao) return
                setSubmetendoVersao(true)
                try {
                  await entregaveisCicloService.submeterVersao(
                    entregavelSelecionadoSubmissao.id,
                    obsSubmissaoPrestador,
                  )
                  toast({
                    title: 'Entregável enviado para revisão!',
                    description: 'A equipe técnica da G+ foi notificada para avaliar a versão.',
                  })
                  setModalSubmeterVersaoOpen(false)
                  if (osSelecionada) {
                    const ents = await portalPrestadorService.listEntregaveis(osSelecionada.os_id)
                    setEntregaveis(ents)
                  }
                } catch (err: any) {
                  toast({
                    title: 'Erro ao enviar versão',
                    description: err.message || 'Falha ao submeter versão.',
                    variant: 'destructive',
                  })
                } finally {
                  setSubmetendoVersao(false)
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submetendoVersao ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Confirmar Envio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal O Que Mudou no Portal do Prestador */}
      <ModalOQueMudou
        open={modalOQueMudouAberto}
        onOpenChange={setModalOQueMudouAberto}
        entregavelId={entregavelParaOQueMudou?.id || null}
        tituloEntregavel={entregavelParaOQueMudou?.nome}
      />

      {/* Modal Checklist de Entrada IFC no Portal do Prestador */}
      {entregavelParaEnvioIfc && (
        <ModalChecklistEnvioIfc
          open={modalChecklistEnvioOpen}
          onOpenChange={setModalChecklistEnvioOpen}
          entregavelId={entregavelParaEnvioIfc.id}
          entregavelNome={entregavelParaEnvioIfc.nome || 'Entregável'}
          onSucesso={async () => {
            if (osSelecionada) {
              const ents = await portalPrestadorService.listEntregaveis(osSelecionada.os_id)
              setEntregaveis(ents)
            }
            setModalChecklistEnvioOpen(false)
          }}
        />
      )}

      {/* Modal de Assinatura da OS com OTP de 6 dígitos */}
      <ModalAssinaturaEletronicaOS
        open={modalAssinarOpen}
        onOpenChange={setModalAssinarOpen}
        os={osSelecionada}
        usuarioNome={user?.name || ''}
        usuarioDoc={user?.cpf_cnpj || ''}
        onSucesso={handleSucessoAssinatura}
      />
    </div>
  )
}
export default PortalPrestadorPage
