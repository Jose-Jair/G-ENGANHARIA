import React, { useState, useEffect, useMemo } from 'react'
import { CotacaoRecord, ProjetoRecord, ExecutorRecord, ParcelaSubcontratoItem } from '@/types'
import { cotacoesService, RespostaCotacaoExternaData } from '@/services/executores'
import { subcontratosService, ContratarExecutorPayload } from '@/services/subcontratos'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MessageSquareQuote,
  Plus,
  Copy,
  CheckCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Check,
  Star,
  Layers,
  Send,
  Sparkles,
  FileSignature,
  DollarSign,
  Clock,
  PhoneCall,
  Calendar,
  Share2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { openWhatsAppWithFallback } from '@/lib/whatsapp'

interface ModalCotacoesProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projeto: ProjetoRecord | null
  executores: ExecutorRecord[]
  canEdit: boolean
  onSuccess: () => void
}

type CriterioRecomendacao = 'menor_preco' | 'menor_prazo' | 'melhor_avaliacao' | 'composto'

export const ModalCotacoesProjeto: React.FC<ModalCotacoesProjetoProps> = ({
  open,
  onOpenChange,
  projeto,
  executores,
  canEdit,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [cotacoes, setCotacoes] = useState<CotacaoRecord[]>([])
  const [carregando, setCarregando] = useState(false)
  const [activeTab, setActiveTab] = useState<'comparativo' | 'convites' | 'historico'>(
    'comparativo',
  )

  // Critério de indicação da melhor cotação
  const [criterioRecomendacao, setCriterioRecomendacao] =
    useState<CriterioRecomendacao>('menor_preco')

  // Modal de Convidar Executores (Múltipla Seleção)
  const [modalNovoConviteOpen, setModalNovoConviteOpen] = useState(false)
  const [selecionadosIds, setSelecionadosIds] = useState<string[]>([])
  const [escopoConvite, setEscopoConvite] = useState('')
  const [dataLimiteConvite, setDataLimiteConvite] = useState('')
  const [enviarEmail, setEnviarEmail] = useState(true)
  const [enviandoConvites, setEnviandoConvites] = useState(false)

  // Modal de Registrar Resposta Externa (Recebida por telefone/WhatsApp/reunião)
  const [cotacaoParaRespostaExterna, setCotacaoParaRespostaExterna] =
    useState<CotacaoRecord | null>(null)
  const [precoExterno, setPrecoExterno] = useState('')
  const [prazoExterno, setPrazoExterno] = useState('')
  const [obsExterna, setObsExterna] = useState('')
  const [salvandoRespostaExterna, setSalvandoRespostaExterna] = useState(false)

  // Modal de Contratação Formal (Geração de Subcontrato e Parcelas a Pagar)
  const [cotacaoParaContratar, setCotacaoParaContratar] = useState<CotacaoRecord | null>(null)
  const [modoContratacao, setModoContratacao] = useState<
    'terceirizada_parcial' | 'terceirizada_integral'
  >('terceirizada_integral')
  const [descricaoDelegada, setDescricaoDelegada] = useState('')
  const [condicoesPagamento, setCondicoesPagamento] = useState(
    '30 dias após emissão da medição técnica aprovada',
  )
  const [parcelasContrato, setParcelasContrato] = useState<ParcelaSubcontratoItem[]>([])
  const [salvandoContratacao, setSalvandoContratacao] = useState(false)

  // Carregar cotações do projeto
  const carregarCotacoes = async () => {
    if (!projeto) return
    setCarregando(true)
    try {
      const lista = await cotacoesService.listByProjeto(projeto.id)
      setCotacoes(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar cotações',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && projeto) {
      carregarCotacoes()
      setEscopoConvite(projeto.descricao || projeto.nome || '')
      setDescricaoDelegada(projeto.descricao_delegada || '')
      setModoContratacao(
        projeto.modo_execucao === 'terceirizada_parcial'
          ? 'terceirizada_parcial'
          : 'terceirizada_integral',
      )
    }
  }, [open, projeto])

  // Filtrar executores homologados ativos
  const executoresDisponiveis = useMemo(() => {
    return executores.filter((ex) => ex.status !== 'suspenso')
  }, [executores])

  // Identificar melhor cotação respondida com base no critério selecionado
  const cotacoesRespondidas = useMemo(() => {
    return cotacoes.filter((c) => !!c.preco_ofertado && c.preco_ofertado > 0)
  }, [cotacoes])

  const melhorCotacaoId = useMemo(() => {
    if (cotacoesRespondidas.length === 0) return null

    let melhor = cotacoesRespondidas[0]

    for (const c of cotacoesRespondidas) {
      const precoAtual = c.preco_ofertado || Infinity
      const precoMelhor = melhor.preco_ofertado || Infinity
      const notaAtual = c.expand?.executor?.nota_geral || 0
      const notaMelhor = melhor.expand?.executor?.nota_geral || 0

      // Extrai números aproximados de dias do prazo texto (ex: "15 dias" -> 15)
      const parseDias = (pStr?: string) => {
        if (!pStr) return 999
        const m = pStr.match(/\d+/)
        return m ? parseInt(m[0], 10) : 999
      }
      const diasAtual = parseDias(c.prazo_ofertado)
      const diasMelhor = parseDias(melhor.prazo_ofertado)

      if (criterioRecomendacao === 'menor_preco') {
        if (precoAtual < precoMelhor) melhor = c
      } else if (criterioRecomendacao === 'menor_prazo') {
        if (diasAtual < diasMelhor) melhor = c
      } else if (criterioRecomendacao === 'melhor_avaliacao') {
        if (notaAtual > notaMelhor) melhor = c
      } else if (criterioRecomendacao === 'composto') {
        // Score composto: 50% preço, 30% avaliação, 20% prazo
        // Menor preço dá mais pontos, maior nota dá mais pontos, menor prazo dá mais pontos
        const pontPreco = precoMelhor / Math.max(precoAtual, 1) // 0 a 1
        const pontNota = notaAtual / 5 // 0 a 1
        const pontPrazo = diasMelhor / Math.max(diasAtual, 1) // 0 a 1
        const scoreAtual = pontPreco * 0.5 + pontNota * 0.3 + pontPrazo * 0.2

        const pontPrecoM = precoMelhor / Math.max(precoMelhor, 1)
        const pontNotaM = notaMelhor / 5
        const pontPrazoM = diasMelhor / Math.max(diasMelhor, 1)
        const scoreMelhor = pontPrecoM * 0.5 + pontNotaM * 0.3 + pontPrazoM * 0.2

        if (scoreAtual > scoreMelhor) melhor = c
      }
    }

    return melhor.id
  }, [cotacoesRespondidas, criterioRecomendacao])

  // Disparo de Convite em Lote para Executores Homologados
  const handleDispararConvites = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projeto) return
    if (selecionadosIds.length === 0) {
      toast({
        title: 'Selecione ao menos um executor',
        description: 'Marque os executores que devem receber o convite para cotação.',
        variant: 'destructive',
      })
      return
    }

    setEnviandoConvites(true)
    try {
      const resp = await cotacoesService.solicitarCotacoesMultiplos({
        projeto_id: projeto.id,
        executores_ids: selecionadosIds,
        escopo: escopoConvite.trim(),
        data_limite: dataLimiteConvite ? `${dataLimiteConvite} 23:59:59.000Z` : undefined,
        enviar_email: enviarEmail,
      })

      toast({
        title: 'Convites enviados com sucesso!',
        description: `${resp.total_cotacoes} cotações criadas e auditadas.`,
      })

      setModalNovoConviteOpen(false)
      setSelecionadosIds([])
      setDataLimiteConvite('')
      await carregarCotacoes()
      setActiveTab('comparativo')
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar convites',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setEnviandoConvites(false)
    }
  }

  // Registrar Resposta Recebida Externamente
  const handleSalvarRespostaExterna = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cotacaoParaRespostaExterna) return
    const valorNum = parseFloat(precoExterno.replace(',', '.'))
    if (!valorNum || valorNum <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe o valor ofertado pelo executor.',
        variant: 'destructive',
      })
      return
    }
    if (!prazoExterno.trim()) {
      toast({
        title: 'Prazo obrigatório',
        description: 'Informe o prazo ofertado.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoRespostaExterna(true)
    try {
      const payload: RespostaCotacaoExternaData = {
        cotacao_id: cotacaoParaRespostaExterna.id,
        preco_ofertado: valorNum,
        prazo_ofertado: prazoExterno.trim(),
        observacoes: obsExterna.trim() || undefined,
      }
      await cotacoesService.registrarRespostaExterna(payload)
      toast({
        title: 'Resposta registrada com sucesso!',
        description: 'Proposta inserida no comparativo do projeto com auditoria.',
      })
      setCotacaoParaRespostaExterna(null)
      setPrecoExterno('')
      setPrazoExterno('')
      setObsExterna('')
      await carregarCotacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar resposta',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoRespostaExterna(false)
    }
  }

  // Abrir Modal de Contratação
  const handleAbrirContratacao = (c: CotacaoRecord) => {
    setCotacaoParaContratar(c)
    const valor = c.preco_ofertado || 0
    // Gerar 2 parcelas padrão (50% início, 50% entrega)
    const parc1 = parseFloat((valor / 2).toFixed(2))
    const parc2 = parseFloat((valor - parc1).toFixed(2))
    const hoje = new Date()
    const d30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    const d60 = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

    setParcelasContrato([
      {
        numero: 1,
        descricao: '1ª Parcela — Início dos serviços / Mobilização',
        valor: parc1,
        vencimento: d30,
        gatilho: 'contratacao',
      },
      {
        numero: 2,
        descricao: '2ª Parcela — Entrega final e aprovação técnica',
        valor: parc2,
        vencimento: d60,
        gatilho: 'entrega',
      },
    ])
  }

  // Executar Contratação Formal do Executor Selecionado
  const handleConfirmarContratacao = async () => {
    if (!projeto || !cotacaoParaContratar) return
    if (modoContratacao === 'terceirizada_parcial' && !descricaoDelegada.trim()) {
      toast({
        title: 'Descrição da parte delegada obrigatória',
        description:
          'Para terceirização parcial, informe com clareza o escopo ou disciplina delegada ao executor.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoContratacao(true)
    try {
      const payload: ContratarExecutorPayload = {
        projeto_id: projeto.id,
        cotacao_id: cotacaoParaContratar.id,
        modo_execucao: modoContratacao,
        descricao_delegada:
          modoContratacao === 'terceirizada_parcial' ? descricaoDelegada.trim() : undefined,
        condicoes_pagamento: condicoesPagamento.trim(),
        parcelas: parcelasContrato,
      }

      const res = await subcontratosService.contratarExecutor(payload)

      toast({
        title: 'Executor Contratado com Sucesso!',
        description: `Termo de Subcontratação ${res.numero} gerado com o mesmo prazo e cláusulas do contrato original. Contas a pagar criadas no Financeiro.`,
      })

      setCotacaoParaContratar(null)
      await carregarCotacoes()
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao contratar executor',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoContratacao(false)
    }
  }

  // Copiar link de cotação pública
  const handleCopiarLinkPublico = (token?: string) => {
    if (!token) return
    const url = `${window.location.origin}/cotacao/${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'O link de resposta do executor foi copiado.',
    })
  }

  // Enviar convite via WhatsApp direto
  const handleEnviarWhatsApp = (c: CotacaoRecord) => {
    const ex = c.expand?.executor
    if (!ex) return
    const tel = ex.telefone || ''
    const link = `${window.location.origin}/cotacao/${c.token}`
    const texto = `Olá, ${ex.nome}! A G+ Engenharia solicita cotação para o projeto ${projeto?.codigo} (${projeto?.nome}). Acesse o link exclusivo para visualizar o escopo e enviar seus valores: ${link}`
    openWhatsAppWithFallback({ phone: tel, text: texto })
  }

  // Excluir cotação
  const handleExcluirCotacao = async (id: string) => {
    if (!confirm('Deseja excluir este convite de cotação?')) return
    try {
      await cotacoesService.delete(id)
      toast({ title: 'Cotação removida com sucesso' })
      carregarCotacoes()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const isCotadaOuSubcontratada = cotacoes.some((c) => c.escolhida)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white bg-[#1E2A4A] px-2 py-0.5 rounded">
                  {projeto?.codigo}
                </span>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold text-[#D95A2B] border-[#D95A2B]/30 bg-orange-50"
                >
                  Bloco 5 — Cotações & Subcontratação
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-[#D95A2B]" />
                Gestão de Cotações do Projeto
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {projeto?.nome} • Valor do item: {formatCurrencyBr(projeto?.valor_total || 0)}
              </p>
            </div>

            {canEdit && (
              <Button
                size="sm"
                onClick={() => setModalNovoConviteOpen(true)}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-8 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Solicitar Cotação (Múltiplos)
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Abas Principais */}
        <Tabs
          value={activeTab}
          onValueChange={(v: any) => setActiveTab(v)}
          className="space-y-4 pt-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <TabsList className="bg-slate-100 p-0.5">
              <TabsTrigger value="comparativo" className="text-xs font-medium gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Painel Comparativo ({cotacoesRespondidas.length})
              </TabsTrigger>
              <TabsTrigger value="convites" className="text-xs font-medium gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5" />
                Todos os Convites ({cotacoes.length})
              </TabsTrigger>
            </TabsList>

            {activeTab === 'comparativo' && cotacoesRespondidas.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Critério de Indicação:
                </span>
                <Select
                  value={criterioRecomendacao}
                  onValueChange={(v: CriterioRecomendacao) => setCriterioRecomendacao(v)}
                >
                  <SelectTrigger className="h-7 text-xs w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menor_preco">💰 Menor Preço (Padrão)</SelectItem>
                    <SelectItem value="menor_prazo">⚡ Menor Prazo</SelectItem>
                    <SelectItem value="melhor_avaliacao">⭐ Melhor Avaliação</SelectItem>
                    <SelectItem value="composto">🎯 Composto (Preço + Nota + Prazo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* TAB 1: PAINEL COMPARATIVO COM INDICAÇÃO DA MELHOR COTAÇÃO */}
          <TabsContent value="comparativo" className="space-y-4">
            {carregando ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D95A2B]" />
                Carregando cotações e propostas...
              </div>
            ) : cotacoesRespondidas.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-3">
                <MessageSquareQuote className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">
                  Nenhuma resposta registrada ainda
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Envie convites para os executores ou registre as respostas recebidas fora do
                  sistema (por telefone ou WhatsApp) para habilitar o comparativo.
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalNovoConviteOpen(true)}
                    className="text-xs text-[#D95A2B] border-[#D95A2B]/40 hover:bg-orange-50"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Convidar Executores Homologados
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Destaque da Melhor Cotação Recomendada */}
                {melhorCotacaoId && (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200 rounded-xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-800">
                      <strong className="text-amber-950 font-bold block text-sm">
                        Indicação da Melhor Cotação (
                        {criterioRecomendacao === 'menor_preco'
                          ? 'Menor Preço'
                          : criterioRecomendacao === 'menor_prazo'
                            ? 'Menor Prazo'
                            : criterioRecomendacao === 'melhor_avaliacao'
                              ? 'Melhor Avaliação'
                              : 'Score Balanceado'}
                        ):
                      </strong>
                      <span className="text-slate-600 block mt-0.5">
                        O sistema sugere a proposta abaixo com base nas diretrizes técnicas e
                        comerciais da G+. A decisão final de contratação cabe exclusivamente ao
                        Gestor de Projetos ou Administrador.
                      </span>
                    </div>
                  </div>
                )}

                {/* Tabela Comparativa Estilo Dossier */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Executor Homologado</th>
                        <th className="py-3 px-4 text-center">Avaliação (1-5)</th>
                        <th className="py-3 px-4 text-right">Preço Ofertado</th>
                        <th className="py-3 px-4">Prazo de Execução</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cotacoesRespondidas.map((c) => {
                        const ex = c.expand?.executor
                        const isMelhor = c.id === melhorCotacaoId
                        const isEscolhida = c.escolhida

                        return (
                          <tr
                            key={c.id}
                            className={`transition-colors ${
                              isEscolhida
                                ? 'bg-emerald-50/80 font-medium'
                                : isMelhor
                                  ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                  : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                {isMelhor && (
                                  <span
                                    title="Melhor cotação sugerida pelo critério selecionado"
                                    className="bg-amber-100 text-amber-800 p-1 rounded-full shrink-0"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                  </span>
                                )}
                                <div>
                                  <strong className="text-slate-900 block font-semibold">
                                    {ex?.nome}
                                  </strong>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {ex?.conselho || 'S/Conselho'} {ex?.numero_registro || ''} •{' '}
                                    {ex?.regiao || 'Brasil'}
                                  </span>
                                  {c.resposta_externa && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] text-indigo-700 bg-indigo-50 border-indigo-200 mt-0.5 block w-fit"
                                    >
                                      Resposta Externa
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                {ex?.nota_geral ? ex.nota_geral.toFixed(1) : 'S/ Nota'}
                              </div>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {ex?.total_avaliacoes || 0} avaliações
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <span className="text-sm font-bold text-slate-900 block font-mono">
                                {c.preco_ofertado ? formatCurrencyBr(c.preco_ofertado) : '—'}
                              </span>
                              {projeto?.valor_total && c.preco_ofertado && (
                                <span className="text-[10px] text-slate-500">
                                  {Math.round((c.preco_ofertado / projeto.valor_total) * 100)}% do
                                  item
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {c.prazo_ofertado || '—'}
                              </div>
                              {c.observacoes && (
                                <p
                                  className="text-[11px] text-slate-500 italic truncate max-w-xs"
                                  title={c.observacoes}
                                >
                                  "{c.observacoes}"
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {isEscolhida ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                  <Check className="w-3 h-3 mr-1" /> CONTRATADA
                                </Badge>
                              ) : isMelhor ? (
                                <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">
                                  RECOMENDADA
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-600">
                                  Respondida
                                </Badge>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {canEdit && !isEscolhida && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAbrirContratacao(c)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 font-semibold shadow-xs"
                                >
                                  <FileSignature className="w-3 h-3 mr-1" />
                                  Contratar
                                </Button>
                              )}
                              {isEscolhida && (
                                <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> Subcontratado
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: TODOS OS CONVITES (ENVIADOS, AGUARDANDO, RESPONDIDOS) */}
          <TabsContent value="convites" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cotacoes.map((c) => {
                const ex = c.expand?.executor
                const isEscolhida = c.escolhida
                const isRespondida = !!c.preco_ofertado

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isEscolhida
                        ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-sm font-bold text-slate-900 block">
                            {ex?.nome}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ex?.conselho || 'S/Conselho'} {ex?.numero_registro || ''}
                          </span>
                        </div>

                        {isEscolhida ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                            Contratada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${
                              isRespondida
                                ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isRespondida ? 'Respondida' : 'Aguardando'}
                          </Badge>
                        )}
                      </div>

                      {/* Dados Ofertados */}
                      <div className="mt-3 p-2.5 bg-slate-50 rounded-lg space-y-1.5 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Valor Ofertado:</span>
                          <strong className="text-slate-900 font-mono">
                            {c.preco_ofertado ? formatCurrencyBr(c.preco_ofertado) : 'Pendente'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Prazo:</span>
                          <span className="text-slate-800 font-medium">
                            {c.prazo_ofertado || '—'}
                          </span>
                        </div>
                        {c.data_limite && (
                          <div className="text-[10px] text-slate-400">
                            Limite: {formatDateBr(c.data_limite)}
                          </div>
                        )}
                      </div>

                      {c.observacoes && (
                        <p className="text-[11px] text-slate-600 mt-2 italic bg-white p-2 rounded border border-slate-100">
                          "{c.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarLinkPublico(c.token)}
                          className="h-7 text-[11px] px-2 text-slate-600"
                          title="Copiar link com token público sem login"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Link
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnviarWhatsApp(c)}
                          className="h-7 text-[11px] px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          title="Enviar convite por WhatsApp"
                        >
                          <PhoneCall className="w-3 h-3 mr-1" /> WhatsApp
                        </Button>

                        <a
                          href={`/cotacao/${c.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#D95A2B] hover:underline font-semibold flex items-center"
                        >
                          <ExternalLink className="w-3 h-3 mr-0.5" /> Abrir
                        </a>
                      </div>

                      {/* Botão Registrar Resposta Manual/Externa */}
                      {canEdit && !isRespondida && !isEscolhida && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCotacaoParaRespostaExterna(c)
                            setPrecoExterno('')
                            setPrazoExterno('')
                            setObsExterna('')
                          }}
                          className="w-full text-xs h-7 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <PhoneCall className="w-3 h-3 mr-1 text-slate-500" />
                          Registrar Resposta Externa
                        </Button>
                      )}

                      {canEdit && isRespondida && !isEscolhida && (
                        <Button
                          size="sm"
                          onClick={() => handleAbrirContratacao(c)}
                          className="w-full text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <FileSignature className="w-3 h-3 mr-1" /> Contratar Executor
                        </Button>
                      )}

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluirCotacao(c.id)}
                          className="w-full text-slate-400 hover:text-rose-600 text-[10px] h-5"
                        >
                          <Trash2 className="w-2.5 h-2.5 mr-1" /> Excluir Convite
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL 1: CONVIDAR EXECUTORES (MÚLTIPLA SELEÇÃO + E-MAIL AUTOMÁTICO) */}
        {modalNovoConviteOpen && (
          <Dialog open={modalNovoConviteOpen} onOpenChange={setModalNovoConviteOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#D95A2B]" />
                  Solicitar Cotação para Múltiplos Executores
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  Selecione os executores homologados. O sistema gera links com tokens individuais
                  de acesso público e envia notificações automáticas.
                </p>
              </DialogHeader>

              <form onSubmit={handleDispararConvites} className="space-y-4 py-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="font-semibold text-slate-700">
                      Executores Homologados Disponíveis ({executoresDisponiveis.length}) *
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selecionadosIds.length === executoresDisponiveis.length) {
                          setSelecionadosIds([])
                        } else {
                          setSelecionadosIds(executoresDisponiveis.map((e) => e.id))
                        }
                      }}
                      className="text-[#D95A2B] hover:underline font-semibold"
                    >
                      {selecionadosIds.length === executoresDisponiveis.length
                        ? 'Desmarcar Todos'
                        : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50/50">
                    {executoresDisponiveis.map((ex) => {
                      const isSel = selecionadosIds.includes(ex.id)
                      return (
                        <div
                          key={ex.id}
                          onClick={() => {
                            setSelecionadosIds((prev) =>
                              prev.includes(ex.id)
                                ? prev.filter((id) => id !== ex.id)
                                : [...prev, ex.id],
                            )
                          }}
                          className={`p-2 rounded cursor-pointer border flex items-center justify-between text-xs transition-all ${
                            isSel
                              ? 'bg-orange-50 border-[#D95A2B] text-slate-900 font-semibold'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => {}}
                              className="rounded text-[#D95A2B]"
                            />
                            <div>
                              <div>{ex.nome}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {ex.conselho || 'S/Conselho'} {ex.numero_registro || ''} •{' '}
                                {ex.email || 'Sem e-mail'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {ex.nota_geral ? ex.nota_geral.toFixed(1) : 'S/N'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="escopoEnvio" className="text-xs font-semibold text-slate-700">
                    Escopo Técnico a Ser Cotado
                  </Label>
                  <Textarea
                    id="escopoEnvio"
                    rows={3}
                    value={escopoConvite}
                    onChange={(e) => setEscopoConvite(e.target.value)}
                    placeholder="Detalhamento das entregas, disciplinas e premissas..."
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataLim" className="text-xs font-semibold text-slate-700">
                      Prazo Limite para Resposta
                    </Label>
                    <Input
                      id="dataLim"
                      type="date"
                      value={dataLimiteConvite}
                      onChange={(e) => setDataLimiteConvite(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="chkEmail"
                      checked={enviarEmail}
                      onChange={(e) => setEnviarEmail(e.target.checked)}
                      className="rounded text-[#D95A2B]"
                    />
                    <label htmlFor="chkEmail" className="text-xs text-slate-700 cursor-pointer">
                      Disparar e-mail corporativo automático aos convidados
                    </label>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalNovoConviteOpen(false)}
                    disabled={enviandoConvites}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={enviandoConvites || selecionadosIds.length === 0}
                    className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs"
                  >
                    {enviandoConvites ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Gerando e Disparando...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Disparar Cotações ({selecionadosIds.length})
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* MODAL 2: REGISTRAR RESPOSTA RECEBIDA FORA DO SISTEMA */}
        {cotacaoParaRespostaExterna && (
          <Dialog
            open={!!cotacaoParaRespostaExterna}
            onOpenChange={(op) => !op && setCotacaoParaRespostaExterna(null)}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-indigo-600" />
                  Registrar Resposta Externa — {cotacaoParaRespostaExterna.expand?.executor?.nome}
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  Permite registrar a proposta comercial recebida por WhatsApp, e-mail direto ou
                  reunião. Ação auditada no sistema.
                </p>
              </DialogHeader>

              <form onSubmit={handleSalvarRespostaExterna} className="space-y-3 py-2">
                <div>
                  <Label htmlFor="extPreco" className="text-xs font-semibold text-slate-700">
                    Preço Ofertado (R$) *
                  </Label>
                  <Input
                    id="extPreco"
                    type="number"
                    step="0.01"
                    value={precoExterno}
                    onChange={(e) => setPrecoExterno(e.target.value)}
                    placeholder="0,00"
                    required
                    className="text-xs mt-1 font-semibold"
                  />
                </div>

                <div>
                  <Label htmlFor="extPrazo" className="text-xs font-semibold text-slate-700">
                    Prazo Ofertado para Entrega *
                  </Label>
                  <Input
                    id="extPrazo"
                    value={prazoExterno}
                    onChange={(e) => setPrazoExterno(e.target.value)}
                    placeholder="Ex: 20 dias corridos"
                    required
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="extObs" className="text-xs font-semibold text-slate-700">
                    Observações e Canal de Recebimento
                  </Label>
                  <Textarea
                    id="extObs"
                    rows={2}
                    value={obsExterna}
                    onChange={(e) => setObsExterna(e.target.value)}
                    placeholder="Ex: Recebido via mensagem de WhatsApp pelo gestor em 10/10..."
                    className="text-xs mt-1"
                  />
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCotacaoParaRespostaExterna(null)}
                    disabled={salvandoRespostaExterna}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={salvandoRespostaExterna}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  >
                    {salvandoRespostaExterna ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Check className="w-3.5 h-3.5 mr-1" />
                    )}
                    Salvar Resposta
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* MODAL 3: CONTRATAÇÃO FORMAL (TERMO DE SUBCONTRATAÇÃO + CONTAS A PAGAR) */}
        {cotacaoParaContratar && (
          <Dialog
            open={!!cotacaoParaContratar}
            onOpenChange={(op) => !op && setCotacaoParaContratar(null)}
          >
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                    CONTRATAÇÃO
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    SUB-{new Date().getFullYear()}-XXXX
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-emerald-600" />
                  Contratar Executor: {cotacaoParaContratar.expand?.executor?.nome}
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  Gera o Termo de Subcontratação com o mesmo prazo e cláusulas do Contrato Original.
                  Cria as contas a pagar no módulo financeiro.
                </p>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Resumo da Proposta Escolhida */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Valor Contratado:</span>
                    <strong className="text-emerald-950 text-sm font-bold font-mono">
                      {formatCurrencyBr(cotacaoParaContratar.preco_ofertado || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Duração Contratual:</span>
                    <strong className="text-slate-800">Mesma do Contrato Original (Herdado)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Executor:</span>
                    <strong className="text-slate-800">
                      {cotacaoParaContratar.expand?.executor?.nome}
                    </strong>
                  </div>
                </div>

                {/* Modo de Execução: Parcial ou Integral */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">
                    Modalidade de Terceirização *
                  </Label>
                  <Select value={modoContratacao} onValueChange={(v: any) => setModoContratacao(v)}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terceirizada_integral">
                        👥 Terceirizada Integral (Executor assume 100% do escopo do projeto)
                      </SelectItem>
                      <SelectItem value="terceirizada_parcial">
                        🤝 Terceirizada Parcial (Mista: execução conjunta interna e externa)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {modoContratacao === 'terceirizada_parcial' && (
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">
                      Descrição da Parte Delegada <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      rows={2}
                      value={descricaoDelegada}
                      onChange={(e) => setDescricaoDelegada(e.target.value)}
                      placeholder="Descreva detalhadamente qual disciplina ou parcela do escopo foi delegada..."
                      className="text-xs"
                      required
                    />
                  </div>
                )}

                {/* Condições e Parcelas Financeiras */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Programação de Contas a Pagar ao Executor
                    </Label>
                    <span className="text-[11px] text-slate-500">
                      Total: {formatCurrencyBr(cotacaoParaContratar.preco_ofertado || 0)}
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {parcelasContrato.map((p, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 rounded border border-slate-200"
                      >
                        <div className="sm:col-span-1">
                          <label className="text-[10px] text-slate-400 block">Descrição</label>
                          <Input
                            value={p.descricao}
                            onChange={(e) => {
                              const novas = [...parcelasContrato]
                              novas[idx].descricao = e.target.value
                              setParcelasContrato(novas)
                            }}
                            className="text-xs h-7"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">Valor (R$)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.valor}
                            onChange={(e) => {
                              const novas = [...parcelasContrato]
                              novas[idx].valor = parseFloat(e.target.value) || 0
                              setParcelasContrato(novas)
                            }}
                            className="text-xs h-7 font-mono font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">
                            Vencimento Previsto
                          </label>
                          <Input
                            type="date"
                            value={p.vencimento}
                            onChange={(e) => {
                              const novas = [...parcelasContrato]
                              novas[idx].vencimento = e.target.value
                              setParcelasContrato(novas)
                            }}
                            className="text-xs h-7"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Herança Contratual Automática:</strong> O Termo herdará o prazo de
                    vigência integral do contrato original e as cláusulas aplicáveis do modelo
                    GMAIS. O executor receberá um link seguro para assinatura eletrônica com IP e
                    hash criptográfico.
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCotacaoParaContratar(null)}
                  disabled={salvandoContratacao}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmarContratacao}
                  disabled={salvandoContratacao}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {salvandoContratacao ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Emitindo Subcontrato...
                    </>
                  ) : (
                    <>
                      <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                      Emitir Termo e Contratar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
