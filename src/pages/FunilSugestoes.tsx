import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { SugestaoFunilRecord } from '@/types'
import { sugestoesService, CreateSugestaoData } from '@/services/sugestoes'
import { prospeccaoService } from '@/services/prospeccao'
import { pncpService, PncpItemCompra } from '@/services/pncp'
import { readFileToSheetData, ParsedSheetData } from '@/lib/spreadsheetParser'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  FileSpreadsheet,
  Globe,
  Upload,
  CheckCircle,
  XCircle,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  AlertTriangle,
  Building2,
  ExternalLink,
  ChevronRight,
  Layers,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  CheckSquare,
  Square,
  Eye,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FichaSugestaoModal } from '@/components/funil/FichaSugestaoModal'
import { ModalDescarteLote } from '@/components/funil/ModalDescarteLote'

export default function FunilSugestoesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [sugestoes, setSugestoes] = useState<SugestaoFunilRecord[]>([])

  // Filtros Avançados Reformulados
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente')
  const [filtroFonte, setFiltroFonte] = useState<string>('todas')
  const [filtroRelevancia, setFiltroRelevancia] = useState<string>('todas') // 'alta' (>=70), 'media' (40-69), 'baixa' (<40)
  const [filtroUf, setFiltroUf] = useState<string>('todas')
  const [filtroMunicipio, setFiltroMunicipio] = useState('')
  const [filtroValorMin, setFiltroValorMin] = useState<string>('')
  const [filtroVigenciaStatus, setFiltroVigenciaStatus] = useState<string>('todas') // 'vigente', 'vencida', 'todas'

  // Seleção em Lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [executandoLote, setExecutandoLote] = useState(false)
  const [modalDescarteLoteOpen, setModalDescarteLoteOpen] = useState(false)

  // Ficha Detalhada da Sugestão
  const [sugestaoFicha, setSugestaoFicha] = useState<SugestaoFunilRecord | null>(null)

  // Descarte Individual com Motivo
  const [sugestaoDescartarIndividual, setSugestaoDescartarIndividual] =
    useState<SugestaoFunilRecord | null>(null)
  const [motivoDescarteIndividual, setMotivoDescarteIndividual] = useState('')

  // Modais de Importação e Consulta PNCP
  const [modalImportarOpen, setModalImportarOpen] = useState(false)
  const [modalPncpOpen, setModalPncpOpen] = useState(false)

  // Estado de Importação de Planilha
  const [sheetFile, setSheetFile] = useState<File | null>(null)
  const [sheetParsed, setSheetParsed] = useState<ParsedSheetData | null>(null)
  const [importPreviewErrors, setImportPreviewErrors] = useState<{ linha: number; erro: string }[]>(
    [],
  )
  const [importValidRows, setImportValidRows] = useState<CreateSugestaoData[]>([])
  const [importing, setImporting] = useState(false)

  // Estado de Consulta PNCP
  const [pncpTermo, setPncpTermo] = useState('engenharia')
  const [pncpUf, setPncpUf] = useState('todas')
  const [pncpLoading, setPncpLoading] = useState(false)
  const [pncpResults, setPncpResults] = useState<PncpItemCompra[]>([])
  const [pncpAviso, setPncpAviso] = useState('')
  const [pncpSelected, setPncpSelected] = useState<Set<number>>(new Set())

  // Carregar sugestões
  const loadSugestoes = async () => {
    setLoading(true)
    try {
      const list = await sugestoesService.list(filtroStatus !== 'todas' ? filtroStatus : undefined)
      setSugestoes(list)
      setSelecionados(new Set())
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar fila de sugestões',
        description: err instanceof Error ? err.message : 'Falha na conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSugestoes()
  }, [filtroStatus])

  // Lista de UFs e Fontes distintas para os selects
  const ufsDisponiveis = useMemo(() => {
    const set = new Set<string>()
    sugestoes.forEach((s) => {
      if (s.uf) set.add(s.uf.toUpperCase())
    })
    return Array.from(set).sort()
  }, [sugestoes])

  const fontesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    sugestoes.forEach((s) => {
      const f = s.fonte_prospeccao_slug || s.fonte
      if (f) set.add(f)
    })
    return Array.from(set).sort()
  }, [sugestoes])

  // Filtragem local multi-critérios
  const sugestoesFiltradas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)

    return sugestoes.filter((s) => {
      // Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase().trim()
        const matchRazao = s.razao_social.toLowerCase().includes(q)
        const matchFantasia = (s.nome_fantasia || '').toLowerCase().includes(q)
        const matchCnpj = (s.cnpj || '').includes(q)
        const matchOrgao = (s.orgao_contrato || '').toLowerCase().includes(q)
        const matchObjeto = (s.objeto_contrato || '').toLowerCase().includes(q)
        if (!matchRazao && !matchFantasia && !matchCnpj && !matchOrgao && !matchObjeto) {
          return false
        }
      }

      // Filtro por Fonte
      if (filtroFonte !== 'todas') {
        const f = s.fonte_prospeccao_slug || s.fonte
        if (f !== filtroFonte) return false
      }

      // Filtro por Relevância (score)
      if (filtroRelevancia !== 'todas') {
        const score = s.score_relevancia ?? 0
        if (filtroRelevancia === 'alta' && score < 70) return false
        if (filtroRelevancia === 'media' && (score < 40 || score >= 70)) return false
        if (filtroRelevancia === 'baixa' && score >= 40) return false
      }

      // Filtro por UF
      if (filtroUf !== 'todas') {
        if ((s.uf || '').toUpperCase() !== filtroUf.toUpperCase()) return false
      }

      // Filtro por Município
      if (filtroMunicipio.trim()) {
        const m = filtroMunicipio.toLowerCase().trim()
        if (!(s.municipio || '').toLowerCase().includes(m)) return false
      }

      // Filtro por Valor Mínimo
      if (filtroValorMin.trim()) {
        const valMin = Number(filtroValorMin) || 0
        if ((s.valor_estimado || 0) < valMin) return false
      }

      // Filtro por Vigência
      if (filtroVigenciaStatus !== 'todas') {
        if (!s.vigencia_fim) {
          // Sem data de fim, considerar vigente
          if (filtroVigenciaStatus === 'vencida') return false
        } else {
          const fimStr = s.vigencia_fim.slice(0, 10)
          if (filtroVigenciaStatus === 'vigente' && fimStr < hoje) return false
          if (filtroVigenciaStatus === 'vencida' && fimStr >= hoje) return false
        }
      }

      return true
    })
  }, [
    sugestoes,
    busca,
    filtroFonte,
    filtroRelevancia,
    filtroUf,
    filtroMunicipio,
    filtroValorMin,
    filtroVigenciaStatus,
  ])

  // Ações de Seleção em Lote
  const toggleSelecionar = (id: string) => {
    const next = new Set(selecionados)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelecionados(next)
  }

  const toggleSelecionarTodos = () => {
    if (selecionados.size === sugestoesFiltradas.length && sugestoesFiltradas.length > 0) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(sugestoesFiltradas.map((s) => s.id)))
    }
  }

  // Triagem em Lote via Endpoint Oficial /backend/v1/prospeccao/triagem-lote
  const handleAprovarLote = async () => {
    if (selecionados.size === 0) return
    setExecutandoLote(true)
    try {
      const res = await prospeccaoService.executarTriagemLote({
        acao: 'aprovar',
        sugestao_ids: Array.from(selecionados),
      })
      toast({
        title: 'Sugestões Aprovadas',
        description: `${res.aprovados.length} sugestão(ões) marcada(s) como aprovada(s) para inclusão.`,
      })
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao aprovar em lote',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setExecutandoLote(false)
    }
  }

  const handleIncorporarLote = async () => {
    if (selecionados.size === 0) return
    setExecutandoLote(true)
    try {
      const res = await prospeccaoService.executarTriagemLote({
        acao: 'incorporar',
        sugestao_ids: Array.from(selecionados),
      })
      toast({
        title: 'Sugestões Incorporadas ao Funil!',
        description: `${res.incorporados.length} empresa(s) criada(s) em "Identificada" com rascunho de contrato.`,
      })
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao incorporar em lote',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setExecutandoLote(false)
    }
  }

  const handleConfirmarDescarteLote = async (motivo: string) => {
    if (selecionados.size === 0) return
    setExecutandoLote(true)
    try {
      const res = await prospeccaoService.executarTriagemLote({
        acao: 'descartar',
        sugestao_ids: Array.from(selecionados),
        motivo_descarte: motivo,
      })
      toast({
        title: 'Sugestões Descartadas',
        description: `${res.descartados.length} sugestão(ões) descartada(s). Gravadas na Lista de Exclusão de Prospecção (não afeta lista Não Contatar LGPD).`,
      })
      setModalDescarteLoteOpen(false)
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao descartar em lote',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setExecutandoLote(false)
    }
  }

  // Ações Individuais
  const handleAprovarIndividual = async (sug: SugestaoFunilRecord) => {
    try {
      await prospeccaoService.executarTriagemLote({
        acao: 'aprovar',
        sugestao_ids: [sug.id],
      })
      toast({
        title: 'Sugestão aprovada',
        description: 'Marcada como aprovada para inclusão definitiva.',
      })
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao aprovar',
        description: String(err),
        variant: 'destructive',
      })
    }
  }

  const handleIncorporarIndividual = async (sug: SugestaoFunilRecord) => {
    try {
      const res = await prospeccaoService.executarTriagemLote({
        acao: 'incorporar',
        sugestao_ids: [sug.id],
      })
      toast({
        title: 'Empresa incorporada ao Funil!',
        description: `Adicionada na etapa Identificada com rascunho de contrato pré-preenchido.`,
      })
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao incorporar',
        description: String(err),
        variant: 'destructive',
      })
    }
  }

  const handleConfirmarDescarteIndividual = async () => {
    if (!sugestaoDescartarIndividual) return
    if (!motivoDescarteIndividual.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do descarte da sugestão.',
        variant: 'destructive',
      })
      return
    }

    try {
      await prospeccaoService.executarTriagemLote({
        acao: 'descartar',
        sugestao_ids: [sugestaoDescartarIndividual.id],
        motivo_descarte: motivoDescarteIndividual.trim(),
      })
      toast({
        title: 'Sugestão descartada',
        description: 'Registro arquivado e incluído na Lista de Exclusão de Prospecção.',
      })
      setSugestaoDescartarIndividual(null)
      setMotivoDescarteIndividual('')
      loadSugestoes()
    } catch (err) {
      toast({
        title: 'Erro ao descartar',
        description: String(err),
        variant: 'destructive',
      })
    }
  }

  // ==========================================
  // IMPORTAÇÃO DE PLANILHA (CSV / XLSX)
  // ==========================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSheetFile(file)
    setImportPreviewErrors([])
    setImportValidRows([])

    try {
      const parsed = await readFileToSheetData(file)
      setSheetParsed(parsed)

      const valid: CreateSugestaoData[] = []
      const errors: { linha: number; erro: string }[] = []

      parsed.rows.forEach((row, idx) => {
        const linhaNum = idx + 2

        const razao =
          row['razao_social'] ||
          row['Razão Social'] ||
          row['RAZAO SOCIAL'] ||
          row['razao'] ||
          row['Empresa'] ||
          row['empresa'] ||
          row['Nome'] ||
          ''

        const fantasia =
          row['nome_fantasia'] ||
          row['Nome Fantasia'] ||
          row['NOME FANTASIA'] ||
          row['fantasia'] ||
          ''

        const cnpj = row['cnpj'] || row['CNPJ'] || row['cpf_cnpj'] || ''
        const uf = row['uf'] || row['UF'] || row['Estado'] || ''
        const municipio = row['municipio'] || row['Município'] || row['Cidade'] || ''
        const email = row['email'] || row['E-mail'] || row['Email'] || ''
        const telefone = row['telefone'] || row['Telefone'] || row['Fone'] || ''
        const orgao = row['orgao'] || row['Órgão'] || row['Orgao'] || row['orgao_contrato'] || ''
        const numero =
          row['contrato'] || row['Contrato'] || row['numero_contrato'] || row['Numero'] || ''
        const objeto = row['objeto'] || row['Objeto'] || row['objeto_contrato'] || ''

        let valorNum: number | undefined = undefined
        const valorRaw = row['valor'] || row['Valor'] || row['valor_estimado'] || ''
        if (valorRaw) {
          const vClean = valorRaw
            .toString()
            .replace(/R\$\s?/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
          const n = parseFloat(vClean)
          if (!isNaN(n)) valorNum = n
        }

        if (!razao.trim()) {
          errors.push({ linha: linhaNum, erro: 'Coluna de Razão Social/Empresa vazia' })
          return
        }

        valid.push({
          razao_social: razao.trim(),
          nome_fantasia: fantasia.trim() || undefined,
          cnpj: cnpj.trim() || undefined,
          uf: uf.trim() || undefined,
          municipio: municipio.trim() || undefined,
          email: email.trim() || undefined,
          telefone: telefone.trim() || undefined,
          orgao_contrato: orgao.trim() || undefined,
          numero_contrato: numero.trim() || undefined,
          objeto_contrato: objeto.trim() || undefined,
          valor_estimado: valorNum,
          fonte: 'planilha',
          status: 'pendente',
        })
      })

      setImportValidRows(valid)
      setImportPreviewErrors(errors)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao processar planilha',
        description: err instanceof Error ? err.message : 'Falha na leitura do arquivo.',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmarImportacao = async () => {
    if (importValidRows.length === 0) return
    setImporting(true)
    try {
      const res = await sugestoesService.createBatch(importValidRows)
      toast({
        title: 'Importação concluída',
        description: `${res.created} sugestão(ões) adicionada(s) à fila com sucesso.`,
      })
      setModalImportarOpen(false)
      setSheetFile(null)
      setSheetParsed(null)
      setImportValidRows([])
      setImportPreviewErrors([])
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao importar',
        description: err instanceof Error ? err.message : 'Falha ao salvar registros.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // ==========================================
  // CONSULTA PNCP
  // ==========================================
  const handleConsultarPncp = async (e: React.FormEvent) => {
    e.preventDefault()
    setPncpLoading(true)
    setPncpAviso('')
    setPncpResults([])
    setPncpSelected(new Set())

    try {
      const res = await pncpService.consultarContratacoes({
        termo: pncpTermo.trim() || undefined,
        uf: pncpUf !== 'todas' ? pncpUf : undefined,
        tamanhoPagina: 15,
      })

      if (res.aviso) {
        setPncpAviso(res.aviso)
      }

      setPncpResults(res.items)

      if (res.items.length === 0 && !res.aviso) {
        setPncpAviso('Nenhuma contratação recente encontrada no PNCP para o termo informado.')
      }
    } finally {
      setPncpLoading(false)
    }
  }

  const toggleSelectPncp = (index: number) => {
    const next = new Set(pncpSelected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setPncpSelected(next)
  }

  const handleImportarSelecionadosPncp = async () => {
    if (pncpSelected.size === 0) return
    setPncpLoading(true)

    const itensParaImportar: CreateSugestaoData[] = []
    pncpSelected.forEach((idx) => {
      const item = pncpResults[idx]
      if (!item) return

      const razao = item.orgaoEntidade?.razaoSocial || 'Órgão Público PNCP'
      itensParaImportar.push({
        razao_social: `Prospect [${item.modalidadeNome || 'Licitação'}]: ${razao}`,
        nome_fantasia: razao,
        cnpj: item.orgaoEntidade?.cnpj || '',
        uf: item.unidadeOrgao?.ufSigla || '',
        municipio: item.unidadeOrgao?.municipioNome || '',
        orgao_contrato: razao,
        numero_contrato:
          item.numeroControlePNCP || `PNCP-${item.anoCompra || 2026}-${item.sequencialCompra || 1}`,
        objeto_contrato: item.objetoCompra || 'Contratação pública identificada via PNCP',
        valor_estimado: item.valorTotalEstimado || item.valorTotalHomologado || 0,
        fonte: 'pncp',
        status: 'pendente',
        observacoes: `Capturado via API PNCP (${item.modalidadeNome || 'Pregão'}). Requer validação antes da inclusão no funil.`,
      })
    })

    try {
      const res = await sugestoesService.createBatch(itensParaImportar)
      toast({
        title: 'Sugestões do PNCP importadas',
        description: `${res.created} oportunidade(s) adicionada(s) à Fila de Sugestões com sucesso.`,
      })
      setModalPncpOpen(false)
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao importar PNCP',
        description: err instanceof Error ? err.message : 'Falha ao salvar sugestões.',
        variant: 'destructive',
      })
    } finally {
      setPncpLoading(false)
    }
  }

  const limparFiltros = () => {
    setBusca('')
    setFiltroFonte('todas')
    setFiltroRelevancia('todas')
    setFiltroUf('todas')
    setFiltroMunicipio('')
    setFiltroValorMin('')
    setFiltroVigenciaStatus('todas')
  }

  const filtrosAtivosCount =
    (busca ? 1 : 0) +
    (filtroFonte !== 'todas' ? 1 : 0) +
    (filtroRelevancia !== 'todas' ? 1 : 0) +
    (filtroUf !== 'todas' ? 1 : 0) +
    (filtroMunicipio ? 1 : 0) +
    (filtroValorMin ? 1 : 0) +
    (filtroVigenciaStatus !== 'todas' ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Topo da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#D95A2B]" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Fila de Sugestões de Prospecção
            </h1>
            <Badge
              variant="outline"
              className="bg-orange-50 text-[#D95A2B] border-orange-200 text-xs"
            >
              Triagem em Lote
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Qualificação contínua de oportunidades detectadas por varreduras automáticas (PNCP,
            TCE-CE) ou planilhas externas. Filtros avançados, triagem em lote e descarte com lista
            própria de exclusão de prospecção.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate('/funil')}
            className="text-xs text-slate-700 hover:text-blue-600"
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
            Voltar ao Funil
          </Button>

          <Button
            variant="outline"
            onClick={() => setModalPncpOpen(true)}
            className="text-xs text-slate-700 hover:text-blue-600 hover:border-blue-300"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Consultar PNCP
          </Button>

          <Button
            onClick={() => setModalImportarOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-white" />
            Importar Planilha
          </Button>
        </div>
      </div>

      {/* Painel de Filtros Avançados Reformulados */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Buscar por Empresa, Órgão, CNPJ ou Objeto do Contrato..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-semibold text-slate-500 shrink-0">Status:</label>
            <select
              className="h-9 px-3 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todas">Todos os Status</option>
              <option value="pendente">Pendentes de Decisão</option>
              <option value="aprovada_para_inclusao">Aprovadas para Inclusão</option>
              <option value="incorporada">Incorporadas ao Funil</option>
              <option value="descartada">Descartadas</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadSugestoes}
              className="text-slate-500 hover:text-blue-600 h-9"
              title="Recarregar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Linha de Filtros por Fonte, Relevância, UF, Município, Valor e Vigência */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Filtro Fonte */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Fonte</label>
            <select
              value={filtroFonte}
              onChange={(e) => setFiltroFonte(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white"
            >
              <option value="todas">Todas as fontes</option>
              <option value="pncp_contratos">PNCP</option>
              <option value="tce_ce_contratacoes">TCE-CE SIM</option>
              <option value="comprasnet_contratos">Comprasnet CSV</option>
              <option value="ceara_transparente_csv">Ceará Transparente CSV</option>
              <option value="planilha">Planilha</option>
              {fontesDisponiveis
                .filter(
                  (f) =>
                    ![
                      'pncp_contratos',
                      'tce_ce_contratacoes',
                      'comprasnet_contratos',
                      'ceara_transparente_csv',
                      'planilha',
                    ].includes(f),
                )
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </div>

          {/* Filtro Relevância */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Relevância</label>
            <select
              value={filtroRelevancia}
              onChange={(e) => setFiltroRelevancia(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white"
            >
              <option value="todas">Todas</option>
              <option value="alta">Alta (Score ≥ 70)</option>
              <option value="media">Média (Score 40-69)</option>
              <option value="baixa">Baixa (Score &lt; 40)</option>
            </select>
          </div>

          {/* Filtro UF */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">UF</label>
            <select
              value={filtroUf}
              onChange={(e) => setFiltroUf(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white font-mono"
            >
              <option value="todas">Todas</option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Município */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Município</label>
            <Input
              value={filtroMunicipio}
              onChange={(e) => setFiltroMunicipio(e.target.value)}
              placeholder="Ex: Fortaleza, Sobral..."
              className="h-8 text-xs"
            />
          </div>

          {/* Filtro Valor Mínimo */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">
              Valor Mín (R$)
            </label>
            <Input
              type="number"
              value={filtroValorMin}
              onChange={(e) => setFiltroValorMin(e.target.value)}
              placeholder="Ex: 100000"
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Filtro Vigência */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1">Vigência</label>
            <select
              value={filtroVigenciaStatus}
              onChange={(e) => setFiltroVigenciaStatus(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white"
            >
              <option value="todas">Todas</option>
              <option value="vigente">Vigente / Ativo</option>
              <option value="vencida">Encerrada / Vencida</option>
            </select>
          </div>
        </div>

        {/* Linha de Status dos Filtros e Limpar */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Mostrando <strong>{sugestoesFiltradas.length}</strong> de{' '}
            <strong>{sugestoes.length}</strong> sugestão(ões).
            {filtrosAtivosCount > 0 && ` (${filtrosAtivosCount} filtro(s) ativo(s))`}
          </span>

          {filtrosAtivosCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-6 text-xs text-slate-500 hover:text-slate-800 gap-1 px-1.5"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Barra de Ações em Lote (Aprovar / Descartar / Incorporar) */}
      {selecionados.size > 0 && (
        <div className="bg-slate-900 text-white rounded-xl p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#D95A2B]" />
            <span className="text-xs font-semibold">
              <strong>{selecionados.size}</strong> sugestão(ões) selecionada(s)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelecionados(new Set())}
              className="bg-transparent border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-8"
            >
              Desmarcar
            </Button>

            <Button
              size="sm"
              onClick={handleAprovarLote}
              disabled={executandoLote}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Aprovar Selecionadas
            </Button>

            <Button
              size="sm"
              onClick={() => setModalDescarteLoteOpen(true)}
              disabled={executandoLote}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Descartar (com motivo)
            </Button>

            <Button
              size="sm"
              onClick={handleIncorporarLote}
              disabled={executandoLote}
              className="bg-[#D95A2B] hover:bg-[#c24e24] text-white text-xs h-8 gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Incorporar ao Funil
            </Button>
          </div>
        </div>
      )}

      {/* Lista / Tabela de Sugestões */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#D95A2B] mx-auto mb-2" />
            Carregando fila de sugestões...
          </div>
        ) : sugestoesFiltradas.length === 0 ? (
          <div className="p-16 text-center">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhuma sugestão encontrada</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Ajuste os filtros ou utilize os botões acima para executar uma varredura automática no
              PNCP/TCE-CE ou importar uma planilha.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <button
                      type="button"
                      onClick={toggleSelecionarTodos}
                      className="cursor-pointer text-slate-500 hover:text-slate-800"
                      title="Selecionar todos os visíveis"
                    >
                      {selecionados.size === sugestoesFiltradas.length &&
                      sugestoesFiltradas.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#D95A2B]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Empresa / Sugestão</th>
                  <th className="py-3 px-2">Fonte</th>
                  <th className="py-3 px-2 text-center">Relevância / Curva</th>
                  <th className="py-3 px-3">Órgão / Objeto Resumido</th>
                  <th className="py-3 px-3 text-right">Valor (R$)</th>
                  <th className="py-3 px-2 text-center">Vigência</th>
                  <th className="py-3 px-2 text-center">Sanção</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sugestoesFiltradas.map((sug) => {
                  const isChecked = selecionados.has(sug.id)

                  return (
                    <tr
                      key={sug.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-orange-50/40' : ''
                      }`}
                    >
                      {/* Checkbox de Seleção */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelecionar(sug.id)}
                          className="cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#D95A2B]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Empresa */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => setSugestaoFicha(sug)}
                          className="font-semibold text-slate-900 text-sm hover:text-[#D95A2B] cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{sug.nome_fantasia || sug.razao_social}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          {sug.cnpj && <span>CNPJ: {formatCnpj(sug.cnpj)}</span>}
                          {sug.uf && (
                            <Badge variant="outline" className="text-[9px] py-0 font-mono">
                              {sug.municipio ? `${sug.municipio}/${sug.uf}` : sug.uf}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Fonte */}
                      <td className="py-3 px-2 whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className="text-[9px] uppercase font-mono font-bold bg-slate-100 text-slate-700"
                        >
                          {sug.fonte_prospeccao_slug || sug.fonte}
                        </Badge>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {formatDateBr(sug.created)}
                        </span>
                      </td>

                      {/* Relevância / Curva */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <div className="font-mono font-bold text-xs text-[#D95A2B]">
                          {sug.score_relevancia != null ? `${sug.score_relevancia}/100` : '—'}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono mt-0.5 border-blue-200 text-blue-700 bg-blue-50"
                        >
                          Curva {sug.curva_provisoria || 'C'}
                        </Badge>
                      </td>

                      {/* Órgão / Objeto */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-800 truncate">
                          {sug.orgao_contrato || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {sug.objeto_contrato || sug.numero_contrato || '—'}
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrencyBr(sug.valor_estimado || 0)}
                      </td>

                      {/* Vigência */}
                      <td className="py-3 px-2 text-center text-[10px] whitespace-nowrap text-slate-600">
                        {sug.vigencia_fim ? (
                          <span>Até {formatDateBr(sug.vigencia_fim)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Sanção */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {sug.status_sancao === 'sancionada' ? (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-800 border-rose-300 text-[9px] gap-1"
                            title={sug.detalhe_sancao}
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Sancionada
                          </Badge>
                        ) : sug.status_sancao === 'sem_sancao' ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[9px] gap-1"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Livre
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] gap-1"
                            title="Chave de API do Portal da Transparência ausente ou consulta não efetuada"
                          >
                            <HelpCircle className="w-3 h-3 text-amber-600" />
                            Não verif.
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            sug.status === 'incorporada'
                              ? 'bg-purple-100 text-purple-800'
                              : sug.status === 'aprovada_para_inclusao'
                                ? 'bg-blue-100 text-blue-800'
                                : sug.status === 'descartada'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sug.status === 'incorporada'
                            ? 'Incorporada'
                            : sug.status === 'aprovada_para_inclusao'
                              ? 'Aprovada'
                              : sug.status === 'descartada'
                                ? 'Descartada'
                                : 'Pendente'}
                        </span>
                        {sug.motivo_descarte && (
                          <p
                            className="text-[9px] text-rose-600 mt-0.5 italic max-w-[120px] truncate mx-auto"
                            title={sug.motivo_descarte}
                          >
                            {sug.motivo_descarte}
                          </p>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Ver Ficha */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSugestaoFicha(sug)}
                            className="text-slate-600 hover:text-slate-900 h-7 px-1.5"
                            title="Ver Ficha Completa do Contrato"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {sug.status === 'pendente' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAprovarIndividual(sug)}
                                className="text-[11px] h-7 px-2 text-blue-700 hover:bg-blue-50"
                                title="Aprovar sugestão"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleIncorporarIndividual(sug)}
                                className="bg-[#D95A2B] hover:bg-[#c24e24] text-white text-[11px] h-7 px-2"
                                title="Incorporar ao Funil"
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                Incorporar
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSugestaoDescartarIndividual(sug)
                                  setMotivoDescarteIndividual('')
                                }}
                                className="text-slate-400 hover:text-red-600 h-7 px-1.5"
                                title="Descartar sugestão"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {sug.status === 'aprovada_para_inclusao' && (
                            <Button
                              size="sm"
                              onClick={() => handleIncorporarIndividual(sug)}
                              className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] h-7 px-2.5"
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              Criar em Identificada
                            </Button>
                          )}

                          {sug.status === 'incorporada' && (
                            <span className="text-[11px] text-purple-700 font-medium">
                              No funil
                            </span>
                          )}

                          {sug.status === 'descartada' && (
                            <span className="text-[11px] text-slate-400 italic">Descartada</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ficha Completa da Sugestão (Modal) */}
      <FichaSugestaoModal
        sugestao={sugestaoFicha}
        open={Boolean(sugestaoFicha)}
        onClose={() => setSugestaoFicha(null)}
        onAprovar={handleAprovarIndividual}
        onDescartar={(sug) => {
          setSugestaoDescartarIndividual(sug)
          setMotivoDescarteIndividual('')
        }}
        onIncorporar={handleIncorporarIndividual}
      />

      {/* Modal Descarte em Lote */}
      <ModalDescarteLote
        open={modalDescarteLoteOpen}
        totalSelecionados={selecionados.size}
        onClose={() => setModalDescarteLoteOpen(false)}
        onConfirmar={handleConfirmarDescarteLote}
        loading={executandoLote}
      />

      {/* Modal Descarte Individual */}
      <Dialog
        open={Boolean(sugestaoDescartarIndividual)}
        onOpenChange={(open) => !open && setSugestaoDescartarIndividual(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <DialogTitle>Descartar Sugestão de Prospecção</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Descarte a sugestão "
              <strong className="text-slate-800">
                {sugestaoDescartarIndividual?.nome_fantasia ||
                  sugestaoDescartarIndividual?.razao_social}
              </strong>
              ". O CNPJ/objeto será gravado na lista de exclusão de prospecção e NÃO na lista Não
              Contatar (LGPD).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Motivo do Descarte <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Ex: Escopo fora da atuação da intermediação, objeto de baixo valor, empresa sem interesse em terceirização..."
                value={motivoDescarteIndividual}
                onChange={(e) => setMotivoDescarteIndividual(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSugestaoDescartarIndividual(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarDescarteIndividual}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirmar Descarte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Importar Planilha */}
      <Dialog open={modalImportarOpen} onOpenChange={setModalImportarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <FileSpreadsheet className="w-5 h-5" />
              <DialogTitle>Importar Sugestões via Planilha</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Faça upload de planilha no padrão brasileiro (CSV com separador ";" ou XLSX). As
              linhas validadas serão inseridas na fila de sugestões.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <input
                type="file"
                id="file-sheet-sugestoes"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-sheet-sugestoes"
                className="cursor-pointer font-semibold text-blue-600 hover:underline"
              >
                {sheetFile ? sheetFile.name : 'Selecionar arquivo CSV ou Excel'}
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Colunas aceitas: Razão Social, Nome Fantasia, CNPJ, UF, Município, Órgão, Contrato,
                Objeto, Valor.
              </p>
            </div>

            {sheetParsed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Total de Linhas: {sheetParsed.rows.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-bold">
                      ✓ {importValidRows.length} Válidas
                    </span>
                    {importPreviewErrors.length > 0 && (
                      <span className="text-rose-600 font-bold">
                        ✗ {importPreviewErrors.length} Com Erro
                      </span>
                    )}
                  </div>
                </div>

                {importPreviewErrors.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 max-h-36 overflow-y-auto">
                    <div className="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Relatório de inconsistências por linha:
                    </div>
                    <ul className="space-y-1 text-[11px] text-rose-700 font-mono">
                      {importPreviewErrors.map((err, i) => (
                        <li key={i}>
                          Linha {err.linha}: {err.erro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalImportarOpen(false)}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarImportacao}
              disabled={importing || importValidRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {importing ? 'Importando...' : `Confirmar (${importValidRows.length} sugestões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Consulta PNCP */}
      <Dialog open={modalPncpOpen} onOpenChange={setModalPncpOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <Globe className="w-5 h-5" />
              <DialogTitle>Consulta Pública de Licitações no PNCP</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Busca contratações públicas recentes no Portal Nacional de Contratações Públicas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConsultarPncp} className="space-y-4 py-2 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Termo / Objeto de Engenharia
                </Label>
                <Input
                  placeholder="Ex: engenharia, drenagem, pavimentação..."
                  value={pncpTermo}
                  onChange={(e) => setPncpTermo(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="w-28">
                <Label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  UF
                </Label>
                <select
                  className="w-full h-9 px-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                  value={pncpUf}
                  onChange={(e) => setPncpUf(e.target.value)}
                >
                  <option value="todas">Todas</option>
                  <option value="SP">SP</option>
                  <option value="MG">MG</option>
                  <option value="RJ">RJ</option>
                  <option value="PR">PR</option>
                  <option value="SC">SC</option>
                  <option value="RS">RS</option>
                  <option value="BA">BA</option>
                  <option value="PE">PE</option>
                  <option value="CE">CE</option>
                  <option value="GO">GO</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={pncpLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                >
                  {pncpLoading ? 'Consultando...' : 'Buscar Contratações'}
                </Button>
              </div>
            </div>

            {pncpAviso && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>{pncpAviso}</p>
              </div>
            )}

            {pncpResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {pncpResults.length} Contratação(ões) Encontrada(s)
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">
                    {pncpSelected.size} selecionada(s) para importar
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  {pncpResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleSelectPncp(idx)}
                      className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        pncpSelected.has(idx)
                          ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400'
                          : 'bg-white border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {item.orgaoEntidade?.razaoSocial || 'Órgão Público'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {item.unidadeOrgao?.municipioNome} - {item.unidadeOrgao?.ufSigla} |{' '}
                            {item.modalidadeNome}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 shrink-0">
                          {formatCurrencyBr(
                            item.valorTotalEstimado || item.valorTotalHomologado || 0,
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                        {item.objetoCompra}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalPncpOpen(false)}
              disabled={pncpLoading}
            >
              Fechar
            </Button>
            {pncpResults.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleImportarSelecionadosPncp}
                disabled={pncpLoading || pncpSelected.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Importar {pncpSelected.size} Selecionada(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
