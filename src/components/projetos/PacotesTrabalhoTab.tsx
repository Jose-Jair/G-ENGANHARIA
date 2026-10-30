import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase,
  Layers,
  Flag,
  Sparkles,
  CheckCircle2,
  Clock,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  FileCheck2,
  Calendar,
  DollarSign,
  ChevronRight,
  Loader2,
  RefreshCw,
  PlusCircle,
} from 'lucide-react'
import { ProjetoRecord, ProjetoEtapaRecord, EntregavelRecord, ContratoServicoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { sugestoesPrestadoresService } from '@/services/cadeiaContratosProjetos'
import { geradorPacotesContratoService } from '@/services/geradorPacotesContrato'
import { SugestaoPrestadorItem, CotacaoRecord } from '@/types'
import { ModalRankingCotacoes } from '@/components/projetos/ModalRankingCotacoes'
import pb from '@/lib/pocketbase/client'
import { Award, Users, AlertOctagon, Bot, ListChecks } from 'lucide-react'
import { ModalRascunhoIA } from '@/components/ia/ModalRascunhoIA'
import { iaOperacaoService, type IaEscopoPacoteResponse } from '@/services/iaOperacao'
import { entregaveisService } from '@/services/projetoDetalhes'
import { catalogoEscoposService } from '@/services/cadeiaContratosProjetos'

interface PacotesTrabalhoTabProps {
  projeto: ProjetoRecord
  contratoServico?: ContratoServicoRecord | null
  etapas: ProjetoEtapaRecord[]
  entregaveis: EntregavelRecord[]
  canEdit: boolean
  onRefresh: () => void
  onNavegarParaEntregaveis?: () => void
}

export const PacotesTrabalhoTab: React.FC<PacotesTrabalhoTabProps> = ({
  projeto,
  contratoServico,
  etapas,
  entregaveis,
  canEdit,
  onRefresh,
  onNavegarParaEntregaveis,
}) => {
  const { toast } = useToast()

  // Filtros de etapas
  const pacotes = etapas.filter((e) => e.is_pacote_trabalho)
  const marcos = etapas.filter((e) => e.is_marco)

  // Sugestões de prestadores
  const [pacoteSelecionado, setPacoteSelecionado] = useState<ProjetoEtapaRecord | null>(null)
  const [modalSugestoesAberto, setModalSugestoesAberto] = useState(false)
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [sugestoes, setSugestoes] = useState<SugestaoPrestadorItem[]>([])
  const [erroSugestoes, setErroSugestoes] = useState<string | null>(null)

  // IA: Justificativa de prestador sob demanda ("Por que este?")
  const [justificativasPorPrestador, setJustificativasPorPrestador] = useState<
    Record<
      string,
      { texto: string; nivel?: string; pontos_fortes?: string[]; pontos_atencao?: string[] }
    >
  >({})
  const [carregandoJustificativaId, setCarregandoJustificativaId] = useState<string | null>(null)
  const [erroJustificativaId, setErroJustificativaId] = useState<Record<string, string>>({})

  // IA: Geração de Escopo do Pacote
  const [modalEscopoIaAberto, setModalEscopoIaAberto] = useState(false)
  const [pacoteParaEscopoIa, setPacoteParaEscopoIa] = useState<ProjetoEtapaRecord | null>(null)
  const [carregandoEscopoIa, setCarregandoEscopoIa] = useState(false)
  const [erroEscopoIa, setErroEscopoIa] = useState<string | null>(null)
  const [textoEscopoIa, setTextoEscopoIa] = useState('')
  const [entregaveisSugeridosIa, setEntregaveisSugeridosIa] = useState<
    Array<{ titulo: string; descricao: string; formato?: string; selecionado?: boolean }>
  >([])
  const [aplicandoEscopoIa, setAplicandoEscopoIa] = useState(false)

  // Aprovação de sugestão (Criação de OS)
  const [prestadorAprovando, setPrestadorAprovando] = useState<SugestaoPrestadorItem | null>(null)
  const [modalAprovarAberto, setModalAprovarAberto] = useState(false)
  const [valorOs, setValorOs] = useState<number>(0)
  const [prazoDiasOs, setPrazoDiasOs] = useState<number>(30)
  const [salvandoOs, setSalvandoOs] = useState(false)
  const [erroTetoVendido, setErroTetoVendido] = useState<string | null>(null)

  // Botão gerar pacotes de contrato já assinado
  const [gerandoPacotes, setGerandoPacotes] = useState(false)

  // Cotação Automática & Ranking
  const [modalRankingAberto, setModalRankingAberto] = useState(false)
  const [pacoteRanking, setPacoteRanking] = useState<ProjetoEtapaRecord | null>(null)
  const [cotacoesPorPacote, setCotacoesPorPacote] = useState<Record<string, CotacaoRecord[]>>({})
  const [marcandoExternoId, setMarcandoExternoId] = useState<string | null>(null)

  // Carregar cotações de todos os pacotes
  const carregarCotacoesPacotes = async () => {
    if (pacotes.length === 0) return
    try {
      const pacoteIds = pacotes.map((p) => p.id)
      const filter = pacoteIds.map((id) => `pacote = '${id}' || etapa = '${id}'`).join(' || ')
      const records = await pb.collection('cotacoes').getFullList<CotacaoRecord>({
        filter,
        sort: '-created',
        expand: 'prestador',
      })

      const map: Record<string, CotacaoRecord[]> = {}
      for (const c of records) {
        const pId = c.pacote || c.etapa
        if (pId) {
          if (!map[pId]) map[pId] = []
          map[pId].push(c)
        }
      }
      setCotacoesPorPacote(map)
    } catch (err) {
      console.warn('Erro ao carregar cotações dos pacotes:', err)
    }
  }

  useEffect(() => {
    carregarCotacoesPacotes()
  }, [pacotes.map((p) => p.id).join(',')])

  const handleMarcarExterno = async (pacote: ProjetoEtapaRecord) => {
    setMarcandoExternoId(pacote.id)
    try {
      await pb.collection('projeto_etapas').update(pacote.id, {
        tipo_execucao: 'terceirizada',
      })
      toast({
        title: 'Cotação Automática Disparada!',
        description: `O pacote "${pacote.nome}" foi definido como EXTERNO. Prestadores elegíveis foram convidados automaticamente pelo servidor.`,
      })
      await carregarCotacoesPacotes()
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao marcar pacote como externo',
        description: err?.message || 'Falha ao atualizar modo de execução no servidor.',
        variant: 'destructive',
      })
    } finally {
      setMarcandoExternoId(null)
    }
  }

  const abrirRankingParaPacote = (pacote: ProjetoEtapaRecord) => {
    setPacoteRanking(pacote)
    setModalRankingAberto(true)
  }

  // Selecionar primeiro pacote caso nenhum esteja selecionado
  useEffect(() => {
    if (pacotes.length > 0 && !pacoteSelecionado) {
      setPacoteSelecionado(pacotes[0])
    }
  }, [pacotes, pacoteSelecionado])

  const abrirSugestoesParaPacote = async (pacote: ProjetoEtapaRecord) => {
    setPacoteSelecionado(pacote)
    setModalSugestoesAberto(true)
    setCarregandoSugestoes(true)
    setErroSugestoes(null)
    setSugestoes([])
    // Não limpa cache anterior de justificativas mas reseta erros de chamada
    setErroJustificativaId({})

    try {
      const res = await sugestoesPrestadoresService.obterSugestoes({
        disciplina: pacote.disciplina || 'Engenharia',
        pacote_id: pacote.id,
      })
      setSugestoes(res.sugestoes || [])
    } catch (err: any) {
      setErroSugestoes(err.message || 'Falha ao buscar ranking de prestadores no servidor.')
    } finally {
      setCarregandoSugestoes(false)
    }
  }

  // IA: Buscar justificativa sob demanda para um prestador específico
  const handleGerarJustificativaPrestador = async (sug: SugestaoPrestadorItem) => {
    if (justificativasPorPrestador[sug.prestador_id]) {
      return // já gerada em cache local
    }
    setCarregandoJustificativaId(sug.prestador_id)
    setErroJustificativaId((prev) => {
      const copy = { ...prev }
      delete copy[sug.prestador_id]
      return copy
    })

    try {
      const resp = await iaOperacaoService.gerarJustificativaPrestador({
        prestador_id: sug.prestador_id,
        disciplina: pacoteSelecionado?.disciplina || 'Engenharia',
        regiao: sug.uf || undefined,
      })

      const r = resp.rascunho
      setJustificativasPorPrestador((prev) => ({
        ...prev,
        [sug.prestador_id]: {
          texto: r.justificativa_texto,
          nivel: r.nivel_recomendacao,
          pontos_fortes: r.pontos_fortes || [],
          pontos_atencao: r.pontos_atencao || [],
        },
      }))
    } catch (err: any) {
      setErroJustificativaId((prev) => ({
        ...prev,
        [sug.prestador_id]:
          err?.data?.message || err?.message || 'Falha ao consultar justificativa via IA.',
      }))
    } finally {
      setCarregandoJustificativaId(null)
    }
  }

  // IA: Abrir fluxo de geração de escopo do pacote
  const handleAbrirGerarEscopoIa = async (pacote: ProjetoEtapaRecord) => {
    setPacoteParaEscopoIa(pacote)
    setModalEscopoIaAberto(true)
    setCarregandoEscopoIa(true)
    setErroEscopoIa(null)
    setTextoEscopoIa('')
    setEntregaveisSugeridosIa([])

    try {
      // 1. Tentar localizar escopo padrão do Catálogo de Escopos pela disciplina
      let catalogoEscopoId: string | undefined = undefined
      try {
        const catalogo = await catalogoEscoposService.listAtivos()
        const discNorm = (pacote.disciplina || '').trim().toLowerCase()
        const match = catalogo.find(
          (c) =>
            c.disciplina?.toLowerCase() === discNorm ||
            c.nome?.toLowerCase().includes(discNorm) ||
            discNorm.includes(c.disciplina?.toLowerCase() || ''),
        )
        if (match) {
          catalogoEscopoId = match.id
        }
      } catch (catErr) {
        console.warn('Catálogo de escopos indisponível para contexto IA:', catErr)
      }

      // 2. Chamar o serviço frontend da Rodada 9
      const resp: IaEscopoPacoteResponse = await iaOperacaoService.gerarEscopoPacote({
        disciplina: pacote.disciplina || 'Engenharia',
        proposta_texto:
          (projeto.expand as any)?.proposta?.descricao ||
          contratoServico?.objeto ||
          projeto.descricao ||
          '',
        catalogo_escopo_id: catalogoEscopoId,
        pacote_id: pacote.id,
        projeto_codigo: projeto.codigo || (projeto as any).numero,
      })

      const r = resp.rascunho
      setTextoEscopoIa(r.escopo_detalhado || r.raw_texto || '')
      setEntregaveisSugeridosIa(
        (r.entregaveis_sugeridos || []).map((ent) => ({
          ...ent,
          selecionado: true,
        })),
      )
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Erro ao gerar rascunho de escopo com IA.'
      setErroEscopoIa(msg)
    } finally {
      setCarregandoEscopoIa(false)
    }
  }

  // IA: Aprovação explícita e aplicação no registro
  const handleAprovarAplicarEscopoIa = async () => {
    if (!pacoteParaEscopoIa) return
    setAplicandoEscopoIa(true)
    try {
      // 1. Atualizar o escopo_detalhado do pacote no PocketBase
      await pb.collection('projeto_etapas').update(pacoteParaEscopoIa.id, {
        escopo_detalhado: textoEscopoIa.trim(),
      })

      // 2. Criar entregáveis sugeridos selecionados que ainda não existam
      const entregaveisAtuais = entregaveis.filter((e) => e.etapa === pacoteParaEscopoIa.id)
      const nomesAtuais = new Set(
        entregaveisAtuais.map((e) => (e.nome || e.titulo || '').trim().toLowerCase()),
      )

      const paraCriar = entregaveisSugeridosIa.filter(
        (e) => e.selecionado && !nomesAtuais.has(e.titulo.trim().toLowerCase()),
      )

      let criadosCount = 0
      for (const ent of paraCriar) {
        try {
          await entregaveisService.create({
            etapa: pacoteParaEscopoIa.id,
            nome: ent.titulo,
            descricao: ent.descricao
              ? `${ent.descricao}${ent.formato ? ` (Formato sugerido: ${ent.formato})` : ''}`
              : ent.titulo,
            status: 'em_producao',
          })
          criadosCount++
        } catch (entErr) {
          console.warn('Erro ao criar entregável sugerido pela IA:', entErr)
        }
      }

      toast({
        title: 'Escopo e Entregáveis Aplicados com Sucesso!',
        description: `O escopo técnico do pacote foi atualizado e ${criadosCount} entregável(is) foram incorporados.`,
      })

      setModalEscopoIaAberto(false)
      setPacoteParaEscopoIa(null)
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Falha ao aplicar escopo',
        description: err.message || 'Não foi possível gravar o escopo no pacote.',
        variant: 'destructive',
      })
    } finally {
      setAplicandoEscopoIa(false)
    }
  }

  const prepararAprovacao = (prestador: SugestaoPrestadorItem) => {
    setPrestadorAprovando(prestador)
    setErroTetoVendido(null)
    // Valor de referência inicial
    const valSugerido =
      pacoteSelecionado?.valor_interno_referencia || pacoteSelecionado?.valor_vendido || 0
    setValorOs(valSugerido)
    setPrazoDiasOs(30)
    setModalAprovarAberto(true)
  }

  const handleConfirmarAprovacao = async () => {
    if (!prestadorAprovando || !pacoteSelecionado) return
    setSalvandoOs(true)
    setErroTetoVendido(null)

    try {
      const resp = await sugestoesPrestadoresService.aprovarSugestao({
        prestador_id: prestadorAprovando.prestador_id,
        projeto_id: projeto.id,
        pacote_id: pacoteSelecionado.id,
        disciplina: pacoteSelecionado.disciplina || 'Engenharia',
        valor_os: Number(valorOs) || 0,
        prazo_dias: Number(prazoDiasOs) || 30,
        escopo_tecnico: pacoteSelecionado.escopo_detalhado || pacoteSelecionado.nome,
      })

      toast({
        title: 'Ordem de Serviço criada!',
        description: `OS ${resp.numero} gerada com sucesso para ${prestadorAprovando.nome}. Status: ${resp.status}`,
      })

      setModalAprovarAberto(false)
      setModalSugestoesAberto(false)
      onRefresh()
    } catch (err: any) {
      const msg = err.message || 'Erro ao aprovar sugestão de prestador.'
      if (
        msg.includes('teto') ||
        msg.includes('ultrapassa') ||
        msg.includes('soma de OS') ||
        msg.includes('valor vendido')
      ) {
        setErroTetoVendido(
          `TRAVA DE SEGURANÇA DO SERVIDOR: ${msg} (A soma de OS externas desta disciplina não pode exceder o valor vendido no contrato).`,
        )
      } else {
        toast({
          title: 'Não foi possível aprovar',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      setSalvandoOs(false)
    }
  }

  const handleGerarPacotesContrato = async () => {
    if (!contratoServico) {
      toast({
        title: 'Contrato não disponível',
        description: 'Este projeto ainda não possui um Contrato de Serviço vinculado.',
        variant: 'destructive',
      })
      return
    }

    try {
      setGerandoPacotes(true)
      const res = await geradorPacotesContratoService.gerarPacotesParaContrato(
        contratoServico.id,
        projeto.id,
      )

      toast({
        title: 'Geração Concluída',
        description: res.mensagem,
      })

      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Falha na geração de pacotes',
        description: err.message || 'Erro ao processar contrato no servidor.',
        variant: 'destructive',
      })
    } finally {
      setGerandoPacotes(false)
    }
  }

  const renderBadgeTendencia = (tendencia: 'melhorou' | 'estavel' | 'piorou') => {
    if (tendencia === 'melhorou') {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1"
        >
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          Melhorou
        </Badge>
      )
    }
    if (tendencia === 'piorou') {
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1"
        >
          <TrendingDown className="w-3 h-3 text-rose-600" />
          Piorou
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-700 border-slate-300 text-[10px] gap-1"
      >
        <Minus className="w-3 h-3 text-slate-500" />
        Estável
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Ações da Cadeia Contrato-Projetos */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D95A2B]/10 flex items-center justify-center text-[#D95A2B]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cadeia de Execução Técnica & Financeira
              </h3>
              <p className="text-xs text-slate-600">
                Pacotes de trabalho derivados do contrato, sugestões algorítmicas de prestadores e
                marcos de faturamento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contratoServico && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarPacotesContrato}
                disabled={gerandoPacotes}
                className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {gerandoPacotes ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando Pacotes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                    Gerar pacotes do contrato assinado
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Pacotes de Trabalho à Esquerda / Marcos à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1 & 2: PACOTES DE TRABALHO */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Pacotes de Trabalho ({pacotes.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              Escopos técnicos com entregáveis e prestador sugerido
            </span>
          </div>

          {pacotes.length === 0 ? (
            <Card className="border-dashed border-slate-300 p-8 text-center bg-slate-50">
              <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">
                Nenhum pacote de trabalho gerado ainda para este projeto.
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Clique no botão "Gerar pacotes do contrato assinado" acima para desdobrar o escopo
                técnico e seus entregáveis automaticamente.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pacotes.map((pacote) => {
                const entsDoPacote = entregaveis.filter((e) => e.etapa === pacote.id)
                const entsAprovados = entsDoPacote.filter((e) => e.status === 'aprovado')

                return (
                  <Card
                    key={pacote.id}
                    className="border-slate-200 hover:border-blue-300 transition-all shadow-sm bg-white"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{pacote.nome}</span>
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                            >
                              {pacote.disciplina || 'Engenharia'}
                            </Badge>
                            {pacote.ordem_servico_ativa && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                              >
                                OS Ativa
                              </Badge>
                            )}
                          </div>
                          {pacote.escopo_detalhado && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {pacote.escopo_detalhado}
                            </p>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {/* Botão de Marcar como Externo quando ainda não é terceirizada/externo */}
                            {pacote.tipo_execucao !== 'terceirizada' &&
                              !pacote.ordem_servico_ativa && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarcarExterno(pacote)}
                                  disabled={marcandoExternoId === pacote.id}
                                  className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs gap-1.5 h-8 font-medium shadow-xs"
                                  title="Dispara a concorrência automática para prestadores homologados"
                                >
                                  {marcandoExternoId === pacote.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Disparando cotações...
                                    </>
                                  ) : (
                                    <>
                                      <Users className="w-3.5 h-3.5" />
                                      Marcar EXTERNO & Cotar
                                    </>
                                  )}
                                </Button>
                              )}

                            {/* Botão Gerar Escopo com IA */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAbrirGerarEscopoIa(pacote)}
                              className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs gap-1.5 h-8 font-medium shadow-xs"
                              title="Gera rascunho de escopo técnico e lista de entregáveis a partir da proposta e catálogo"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                              Gerar escopo com IA
                            </Button>

                            {/* Botão de Ranking de Propostas (Abre modal de scores e escolha) */}
                            <Button
                              size="sm"
                              onClick={() => abrirRankingParaPacote(pacote)}
                              className="bg-[#1E2A4A] hover:bg-[#151e36] text-white text-xs gap-1.5 h-8 font-medium shadow-xs"
                            >
                              <Award className="w-3.5 h-3.5 text-orange-400" />
                              Ranking de Propostas
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirSugestoesParaPacote(pacote)}
                              className="text-slate-600 hover:text-slate-900 text-xs gap-1 h-8"
                              title="Ver prestadores sugeridos por ranking simples"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                              Sugestões
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Valor Vendido</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrencyBr(pacote.valor_vendido || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Ref. Interna</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrencyBr(pacote.valor_interno_referencia || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Prazo Estimado</span>
                          <span className="font-semibold text-slate-700">
                            {pacote.prazo ? formatDateBr(pacote.prazo) : 'A definir'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Entregáveis</span>
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                            {entsAprovados.length}/{entsDoPacote.length} aprovados
                          </span>
                        </div>
                      </div>

                      {/* PAINEL DE COTAÇÃO AUTOMÁTICA DO PACOTE */}
                      {(() => {
                        const cotsDoPacote = cotacoesPorPacote[pacote.id] || []
                        const isExterno =
                          pacote.tipo_execucao === 'terceirizada' || cotsDoPacote.length > 0
                        const respondidas = cotsDoPacote.filter(
                          (c) =>
                            c.status === 'respondida' || (c.preco_ofertado && c.preco_ofertado > 0),
                        )
                        const expiradas = cotsDoPacote.filter((c) => c.status === 'expirada')
                        const convidadas = cotsDoPacote.filter(
                          (c) => c.status === 'convite_enviado',
                        )
                        const escolhida = cotsDoPacote.find(
                          (c) => c.escolhida || c.status === 'escolhida',
                        )
                        const dataLimiteIso =
                          cotsDoPacote[0]?.data_limite_resposta || cotsDoPacote[0]?.data_limite

                        if (!isExterno && cotsDoPacote.length === 0) {
                          return null
                        }

                        return (
                          <div className="mt-3 p-3 rounded-lg border border-orange-200 bg-orange-50/40 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-[#D95A2B] text-white text-[10px] font-semibold gap-1">
                                  <Users className="w-3 h-3" />
                                  Cotação Automática Aberta
                                </Badge>

                                {escolhida ? (
                                  <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Encerrada (Proposta Escolhida)
                                  </Badge>
                                ) : convidadas.length > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                  >
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Aguardando Respostas ({respondidas.length}/{cotsDoPacote.length}
                                    )
                                  </Badge>
                                ) : expiradas.length === cotsDoPacote.length &&
                                  cotsDoPacote.length > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] gap-1"
                                  >
                                    <AlertOctagon className="w-3 h-3 text-rose-600" />
                                    Encerrada por Expiração
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-100 text-slate-700 text-[10px]"
                                  >
                                    Status: {cotsDoPacote[0]?.status || 'Ativa'}
                                  </Badge>
                                )}

                                {dataLimiteIso && (
                                  <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Data-limite: <strong>{formatDateBr(dataLimiteIso)}</strong>
                                  </span>
                                )}
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirRankingParaPacote(pacote)}
                                className="h-7 text-xs bg-white text-slate-800 hover:text-[#D95A2B] border-orange-200 hover:border-orange-300 gap-1"
                              >
                                <Award className="w-3 h-3 text-[#D95A2B]" />
                                Ver Ranking ({cotsDoPacote.length})
                              </Button>
                            </div>

                            {/* Detalhe dos prestadores convidados */}
                            {cotsDoPacote.length === 0 ? (
                              <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  Pacote marcado como EXTERNO, mas não foram encontrados prestadores
                                  elegíveis. O aviso foi encaminhado à{' '}
                                  <strong>Central de Ações do Dia</strong>.
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
                                  Convidados:
                                </span>
                                {cotsDoPacote.map((c) => {
                                  const nomePrest =
                                    c.expand?.prestador?.nome || 'Prestador Convidado'
                                  const foiRespondida =
                                    c.status === 'respondida' ||
                                    (c.preco_ofertado && c.preco_ofertado > 0)
                                  const foiEscolhida = c.escolhida || c.status === 'escolhida'
                                  const foiExpirada = c.status === 'expirada'

                                  return (
                                    <span
                                      key={c.id}
                                      className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 shrink-0 ${
                                        foiEscolhida
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : foiRespondida
                                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                                            : foiExpirada
                                              ? 'bg-rose-50 text-rose-800 border-rose-200 line-through'
                                              : 'bg-white text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {nomePrest}
                                      {foiEscolhida && (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      )}
                                      {foiRespondida && !foiEscolhida && (
                                        <span className="text-blue-700 font-bold">
                                          ({formatCurrencyBr(c.preco_ofertado || 0)})
                                        </span>
                                      )}
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            {expiradas.length > 0 && !escolhida && (
                              <p className="text-[10px] text-rose-700 italic pt-0.5">
                                Aviso: {expiradas.length} convite(s) expirado(s) sem envio de
                                proposta.
                              </p>
                            )}
                          </div>
                        )
                      })()}

                      {entsDoPacote.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {entsDoPacote.slice(0, 3).map((e) => (
                              <span
                                key={e.id}
                                className={`text-[10px] px-2 py-0.5 rounded border ${
                                  e.status === 'aprovado'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : e.status === 'enviado_revisao'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                {e.nome || e.titulo}
                              </span>
                            ))}
                            {entsDoPacote.length > 3 && (
                              <span className="text-[10px] text-slate-500">
                                +{entsDoPacote.length - 3} mais
                              </span>
                            )}
                          </div>

                          {onNavegarParaEntregaveis && (
                            <button
                              type="button"
                              onClick={onNavegarParaEntregaveis}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 shrink-0 ml-2"
                            >
                              Ver ciclo
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUNA 3: MARCOS DE FATURAMENTO / FINANCEIRO */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Marcos Financeiros ({marcos.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">1 por parcela</span>
          </div>

          {marcos.length === 0 ? (
            <Card className="border-dashed border-slate-300 p-6 text-center bg-slate-50">
              <Flag className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">Nenhum marco financeiro gerado.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Ao gerar pacotes do contrato, as parcelas da proposta viram marcos de faturamento.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {marcos.map((marco, idx) => (
                <div
                  key={marco.id}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">{marco.nome}</span>
                      </div>
                      {marco.descricao && (
                        <p className="text-[11px] text-slate-500 pl-6">{marco.descricao}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs pl-6">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Vencimento</span>
                      <span className="font-medium text-slate-700">
                        {marco.prazo ? formatDateBr(marco.prazo) : 'Sob medição'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Valor Parcela</span>
                      <span className="font-bold text-emerald-700">
                        {formatCurrencyBr(marco.valor_vendido || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: RANKING DE SUGESTÕES DE PRESTADORES */}
      <Dialog open={modalSugestoesAberto} onOpenChange={setModalSugestoesAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D95A2B]" />
              Sugestões Inteligentes de Prestadores
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ranking algorítmico do servidor para o pacote{' '}
              <strong>"{pacoteSelecionado?.nome}"</strong> (Disciplina:{' '}
              {pacoteSelecionado?.disciplina}).
            </DialogDescription>
          </DialogHeader>

          {carregandoSugestoes ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D95A2B]" />
              Processando ranking de prestadores com capacidade, notas, conselhos e tendência...
            </div>
          ) : erroSugestoes ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Erro ao consultar sugestões:
              </div>
              <p>{erroSugestoes}</p>
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
              <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">
                Nenhum prestador qualificado encontrado para esta disciplina.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Verifique se os prestadores cadastrados possuem a disciplina compatível e conselho
                válido no módulo Prestadores.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sugestoes.map((sug, idx) => (
                <div
                  key={sug.prestador_id}
                  className="bg-white border rounded-lg p-3.5 shadow-sm hover:border-orange-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{sug.nome}</span>
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px]">
                          {sug.tipo === 'interno' ? 'Equipe Interna' : 'Prestador PJ/PF'}
                        </Badge>
                        {renderBadgeTendencia(sug.tendencia)}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                        <span>
                          Nota média:{' '}
                          <strong>
                            {sug.nota_media ? sug.nota_media.toFixed(1) : '5.0'} / 5.0
                          </strong>
                        </span>
                        <span>
                          Capacidade livre: <strong>{sug.capacidade_livre} OS</strong>
                        </span>
                        <span>
                          UF: <strong>{sug.uf || 'BR'}</strong>
                        </span>
                        {sug.conselho_validade && (
                          <span className="text-emerald-700">
                            Conselho: <strong>Válido</strong>
                          </span>
                        )}
                      </div>

                      {/* Motivos do ranking */}
                      {sug.motivos && sug.motivos.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {sug.motivos.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="text-[11px] text-slate-500 flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D95A2B]" />
                              {m}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* IA: Botão sob demanda "Por que este?" e área de justificativa */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        {justificativasPorPrestador[sug.prestador_id] ? (
                          <div className="p-2.5 bg-orange-50/70 border border-orange-200 rounded-md text-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#D95A2B] flex items-center gap-1.5 text-[11px]">
                                <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                                Justificativa Técnica da IA:
                              </span>
                              {justificativasPorPrestador[sug.prestador_id].nivel && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase bg-white border-orange-300 text-orange-800"
                                >
                                  {justificativasPorPrestador[sug.prestador_id].nivel?.replace(
                                    /_/g,
                                    ' ',
                                  )}
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-700 leading-relaxed text-[11px]">
                              {justificativasPorPrestador[sug.prestador_id].texto}
                            </p>
                            {justificativasPorPrestador[sug.prestador_id].pontos_fortes &&
                              justificativasPorPrestador[sug.prestador_id].pontos_fortes!.length >
                                0 && (
                                <div className="text-[10px] text-emerald-800 space-y-0.5 pt-1">
                                  <strong className="block text-emerald-900">Pontos Fortes:</strong>
                                  {justificativasPorPrestador[sug.prestador_id].pontos_fortes!.map(
                                    (pf, pfIdx) => (
                                      <div key={pfIdx} className="flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-emerald-600" />
                                        {pf}
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        ) : erroJustificativaId[sug.prestador_id] ? (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center justify-between gap-2">
                            <span>{erroJustificativaId[sug.prestador_id]}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGerarJustificativaPrestador(sug)}
                              className="h-6 text-[10px] text-amber-800 underline p-0"
                            >
                              Tentar novamente
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={carregandoJustificativaId === sug.prestador_id}
                            onClick={() => handleGerarJustificativaPrestador(sug)}
                            className="h-7 text-xs text-[#D95A2B] hover:text-[#b84820] hover:bg-orange-50 font-medium gap-1 px-2"
                            title="Explicação sob demanda da compatibilidade técnica"
                          >
                            {carregandoJustificativaId === sug.prestador_id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Consultando IA...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                                Por que este?
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Score Geral</span>
                        <span className="text-sm font-bold text-[#D95A2B]">
                          {sug.score_final} pts
                        </span>
                      </div>

                      {canEdit && (
                        <Button
                          size="sm"
                          onClick={() => prepararAprovacao(sug)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-medium gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovar Sugestão
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalSugestoesAberto(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: APROVAÇÃO DE SUGESTÃO E GERAÇÃO DE ORDEM DE SERVIÇO */}
      <Dialog open={modalAprovarAberto} onOpenChange={setModalAprovarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Aprovar Prestador & Gerar OS
            </DialogTitle>
            <DialogDescription className="text-xs">
              A aprovação formaliza a alocação e cria a Ordem de Serviço (externa sob
              contrato-mestre com retenção técnica, ou interna).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Prestador Selecionado:</span>{' '}
                <strong className="text-slate-900">{prestadorAprovando?.nome}</strong>
              </div>
              <div>
                <span className="text-slate-500">Pacote de Trabalho:</span>{' '}
                <strong className="text-slate-900">{pacoteSelecionado?.nome}</strong>
              </div>
              <div>
                <span className="text-slate-500">Teto Vendido da Disciplina:</span>{' '}
                <strong className="text-blue-700">
                  {formatCurrencyBr(pacoteSelecionado?.valor_vendido || 0)}
                </strong>
              </div>
            </div>

            {/* ALERTA DE ERRO DE TETO VENDIDO EXIBIDO COM CLAREZA */}
            {erroTetoVendido && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Bloqueio de Faturamento / Teto Vendido
                </div>
                <p>{erroTetoVendido}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Valor da OS (R$) {prestadorAprovando?.tipo === 'interno' ? '(Interno: R$ 0)' : '*'}
              </label>
              <Input
                type="number"
                step="0.01"
                value={valorOs}
                onChange={(e) => setValorOs(Number(e.target.value) || 0)}
                disabled={prestadorAprovando?.tipo === 'interno'}
                className="text-xs h-9"
              />
              <p className="text-[10px] text-slate-500">
                {prestadorAprovando?.tipo === 'interno'
                  ? 'Execução interna é alocada sem custo de subcontrato financeiro.'
                  : 'A soma de OS externas desta disciplina não pode ultrapassar o teto vendido do contrato.'}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Prazo de Execução (dias) *
              </label>
              <Input
                type="number"
                value={prazoDiasOs}
                onChange={(e) => setPrazoDiasOs(Number(e.target.value) || 30)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalAprovarAberto(false)}
              disabled={salvandoOs}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarAprovacao}
              disabled={salvandoOs}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvandoOs ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Criando OS...
                </>
              ) : (
                'Confirmar e Criar OS'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: RANKING DE COTAÇÕES ALGORÍTMICO */}
      <ModalRankingCotacoes
        open={modalRankingAberto}
        onOpenChange={setModalRankingAberto}
        pacote={pacoteRanking}
        onSuccess={() => {
          carregarCotacoesPacotes()
          onRefresh()
        }}
      />

      {/* MODAL 4: RASCUNHO DE ESCOPO DO PACOTE VIA IA */}
      <ModalRascunhoIA
        open={modalEscopoIaAberto}
        onOpenChange={setModalEscopoIaAberto}
        titulo={`Gerar Escopo com IA: ${pacoteParaEscopoIa?.nome || ''}`}
        subtitulo={`Disciplina: ${pacoteParaEscopoIa?.disciplina || 'Engenharia'} • Projeto: ${projeto.codigo || (projeto as any).numero || ''}`}
        carregando={carregandoEscopoIa}
        textoRascunho={textoEscopoIa}
        onTextoChange={setTextoEscopoIa}
        onAprovar={handleAprovarAplicarEscopoIa}
        onDescartar={() => {
          setModalEscopoIaAberto(false)
          setPacoteParaEscopoIa(null)
        }}
        erro={erroEscopoIa}
        rotuloAprovar={aplicandoEscopoIa ? 'Aplicando ao Pacote...' : 'Aprovar e aplicar no pacote'}
        rotuloDescartar="Descartar rascunho"
        badgeRecurso="IA Escopo Pacote"
        bloquearAprovacao={aplicandoEscopoIa}
      >
        {entregaveisSugeridosIa.length > 0 && (
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-[#D95A2B]" />
                Entregáveis Sugeridos ({entregaveisSugeridosIa.filter((e) => e.selecionado).length}/
                {entregaveisSugeridosIa.length})
              </span>
              <span className="text-[10px] text-slate-500">
                Marque os que deseja cadastrar no pacote
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {entregaveisSugeridosIa.map((ent, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-white border rounded text-xs cursor-pointer hover:bg-orange-50/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={ent.selecionado}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setEntregaveisSugeridosIa((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, selecionado: checked } : item,
                        ),
                      )
                    }}
                    className="mt-0.5 rounded border-slate-300 text-[#D95A2B] focus:ring-[#D95A2B]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{ent.titulo}</span>
                      {ent.formato && (
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {ent.formato}
                        </Badge>
                      )}
                    </div>
                    {ent.descricao && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{ent.descricao}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </ModalRascunhoIA>
    </div>
  )
}
export default PacotesTrabalhoTab
