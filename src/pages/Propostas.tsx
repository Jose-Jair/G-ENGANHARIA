import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Filter,
  TrendingUp,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Copy,
  ExternalLink,
  Loader2,
  Calendar,
  Layers,
  PieChart,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { propostasService, MetricasPropostas } from '@/services/propostas'
import { PropostaRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj, formatCpf } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { ModalEditorProposta } from '@/components/propostas/ModalEditorProposta'
import { ModalDetalheProposta } from '@/components/propostas/ModalDetalheProposta'
import { ModalAprovacaoInterna } from '@/components/propostas/ModalAprovacaoInterna'

export const PropostasPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [propostas, setPropostas] = useState<PropostaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>(() => {
    return searchParams.get('status') || 'todos'
  })
  const [filtroBusca, setFiltroBusca] = useState<string>(() => {
    return searchParams.get('busca') || ''
  })

  // Modais
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [propostaEditando, setPropostaEditando] = useState<PropostaRecord | null>(null)

  const [showDetalheModal, setShowDetalheModal] = useState(false)
  const [propostaDetalhe, setPropostaDetalhe] = useState<PropostaRecord | null>(null)

  const [showAprovacaoModal, setShowAprovacaoModal] = useState(false)
  const [propostaAprovacao, setPropostaAprovacao] = useState<PropostaRecord | null>(null)

  // Métricas
  const [metricas, setMetricas] = useState<MetricasPropostas>({
    totalCriadas: 0,
    totalEnviadas: 0,
    totalAceitas: 0,
    totalRecusadas: 0,
    totalExpiradas: 0,
    totalEmNegociacao: 0,
    taxaAceite: 0,
    valorTotalAceitas: 0,
    recusasPorMotivo: {},
  })

  // Permissões
  const role = user?.role || 'comercial'
  const canCreateOrEdit = role === 'admin' || role === 'comercial'
  const isFinanceiro = role === 'financeiro'

  // Carregar Propostas e Checar Expiração Automática (Req. D)
  const loadPropostas = async () => {
    setLoading(true)
    try {
      const data = await propostasService.list()

      // Expiração automática ao abrir o sistema
      await propostasService.verificarEAtualizarExpiradas(data)

      // Recarrega atualizadas
      const updatedData = await propostasService.list()
      setPropostas(updatedData)
      setMetricas(propostasService.calcularMetricas(updatedData))
    } catch (err) {
      console.error('Erro ao carregar propostas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar a listagem de propostas.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPropostas()
  }, [])

  // Verificar parâmetros de URL (ex: ?nova=true&empresaId=xyz) vindo do Funil
  useEffect(() => {
    if (searchParams.get('nova') === 'true') {
      const empresaId = searchParams.get('empresaId') || undefined
      const clientePfId = searchParams.get('clientePfId') || undefined
      setPropostaEditando(null)
      setShowEditorModal(true)
      // Limpa os searchParams para não reabrir em refresh
      setSearchParams({})
    }
  }, [searchParams])

  const handleOpenNova = () => {
    setPropostaEditando(null)
    setShowEditorModal(true)
  }

  const handleOpenEditar = (p: PropostaRecord) => {
    setPropostaEditando(p)
    setShowEditorModal(true)
  }

  const handleOpenDetalhes = (p: PropostaRecord) => {
    setPropostaDetalhe(p)
    setShowDetalheModal(true)
  }

  const handleOpenAprovacao = (p: PropostaRecord) => {
    setPropostaAprovacao(p)
    setShowAprovacaoModal(true)
  }

  const handleCriarRevisao = async (p: PropostaRecord) => {
    if (
      !confirm(
        `Deseja gerar uma nova revisão da proposta ${p.numero}? A versão atual será arquivada no histórico.`,
      )
    ) {
      return
    }

    try {
      const novaRev = await propostasService.criarRevisao(p, user?.name || 'Comercial')
      toast({
        title: 'Nova Revisão Criada',
        description: `Proposta ${novaRev.numero} agora está em ${novaRev.revisao} (Rascunho).`,
      })
      setShowDetalheModal(false)
      loadPropostas()
      setPropostaEditando(novaRev)
      setShowEditorModal(true)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar revisão',
        description: 'Não foi possível arquivar a revisão anterior.',
      })
    }
  }

  const handleMudarStatus = async (p: PropostaRecord, novoStatus: PropostaRecord['status']) => {
    try {
      await propostasService.update(p.id, { status: novoStatus })
      toast({
        title: 'Status atualizado',
        description: `Proposta ${p.numero} alterada para "${novoStatus}".`,
      })
      loadPropostas()
      if (showDetalheModal && propostaDetalhe?.id === p.id) {
        setPropostaDetalhe({ ...propostaDetalhe, status: novoStatus })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status da proposta.',
      })
    }
  }

  // Filtragem
  const propostasFiltradas = propostas.filter((p) => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    const busca = filtroBusca.toLowerCase()
    const matchBusca =
      !busca ||
      p.numero.toLowerCase().includes(busca) ||
      p.expand?.empresa?.razao_social.toLowerCase().includes(busca) ||
      p.expand?.cliente_pf?.nome.toLowerCase().includes(busca) ||
      p.escopo.toLowerCase().includes(busca)

    return matchStatus && matchBusca
  })

  // Badges visuais de status
  const getStatusBadge = (status: PropostaRecord['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>
      case 'aprovacao_interna':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">Aprovação Interna</Badge>
        )
      case 'enviada':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Enviada</Badge>
      case 'visualizada':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">Visualizada</Badge>
        )
      case 'em_negociacao':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">Em Negociação</Badge>
        )
      case 'aceita':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Aceita</Badge>
      case 'recusada':
        return <Badge variant="destructive">Recusada</Badge>
      case 'expirada':
        return (
          <Badge variant="outline" className="text-slate-500 bg-slate-100">
            Expirada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Gestão de Propostas Técnicas e Comerciais
          </h1>
          <p className="text-xs text-slate-500">
            Elaboração orçamentária, numeração sequencial anual (PROP-AAAA-NNNN), aprovação por
            alçada e aceite online com geração de projeto e conta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (propostasFiltradas.length === 0) {
                toast({
                  title: 'Sem propostas para exportar',
                  description: 'Nenhuma proposta encontrada com os filtros atuais.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `propostas_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'propostas',
                  descricao: 'Exportação de propostas comerciais e técnicas com margem e recusas',
                  filtros: {
                    status: filtroStatus,
                    busca: filtroBusca || undefined,
                  },
                  columns: [
                    { header: 'Número', accessor: (p) => p.numero },
                    { header: 'Revisão', accessor: (p) => p.revisao || 'Rev.00' },
                    {
                      header: 'Cliente',
                      accessor: (p) =>
                        p.expand?.empresa?.razao_social ||
                        p.expand?.empresa?.nome_fantasia ||
                        p.expand?.cliente_pf?.nome ||
                        'Não informado',
                    },
                    {
                      header: 'Documento (CNPJ/CPF)',
                      accessor: (p) =>
                        p.expand?.empresa?.cnpj
                          ? formatCnpj(p.expand.empresa.cnpj)
                          : p.expand?.cliente_pf?.cpf
                            ? formatCpf(p.expand.cliente_pf.cpf)
                            : '',
                    },
                    {
                      header: 'Valor Preço (R$)',
                      accessor: (p) => formatCurrencyBr(p.preco),
                    },
                    {
                      header: 'Custo Estimado (R$)',
                      accessor: (p) => formatCurrencyBr(p.custo),
                    },
                    {
                      header: 'Margem Bruta (R$)',
                      accessor: (p) => formatCurrencyBr(p.margem),
                    },
                    {
                      header: 'Status',
                      accessor: (p) => p.status,
                    },
                    {
                      header: 'Validade',
                      accessor: (p) => (p.validade ? formatDateBr(p.validade) : ''),
                    },
                    {
                      header: 'Motivo de Recusa',
                      accessor: (p) => p.motivo_recusa || '',
                    },
                    {
                      header: 'Data de Aceite',
                      accessor: (p) => (p.data_aceite ? formatDateBr(p.data_aceite) : ''),
                    },
                    {
                      header: 'Contrato Vinculado',
                      accessor: (p) => p.expand?.contrato?.numero || '',
                    },
                  ],
                  data: propostasFiltradas,
                })
                toast({
                  title: 'Propostas Exportadas',
                  description: `${propostasFiltradas.length} proposta(s) exportada(s) com sucesso. Auditoria registrada no servidor.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro na exportação',
                  description: err.message || 'Falha ao exportar CSV de propostas.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {canCreateOrEdit && (
            <Button
              onClick={handleOpenNova}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" />
              Nova Proposta
            </Button>
          )}
        </div>
      </div>

      {/* PAINEL DE INDICADORES (Req. F: Análise de Recusas e Taxa de Aceite) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taxa de Aceite */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Taxa de Conversão / Aceite</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {metricas.taxaAceite}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {metricas.totalAceitas} aceitas de {metricas.totalEnviadas} enviadas a clientes
            </p>
          </CardContent>
        </Card>

        {/* Volume Financeiro Aceito */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Valor Total Fechado</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-blue-700">
              {formatCurrencyBr(metricas.valorTotalAceitas)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Convertidas com projetos e contas gerados
            </p>
          </CardContent>
        </Card>

        {/* Em Negociação / Ativas */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Em Andamento</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-purple-700">
              {metricas.totalEmNegociacao +
                (metricas.totalEnviadas -
                  metricas.totalAceitas -
                  metricas.totalRecusadas -
                  metricas.totalExpiradas)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Enviadas, visualizadas ou em negociação ativa
            </p>
          </CardContent>
        </Card>

        {/* Recusas e Expiradas */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Recusas & Expiradas</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-slate-700">
              {metricas.totalRecusadas + metricas.totalExpiradas}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {metricas.totalRecusadas} recusadas • {metricas.totalExpiradas} vencidas/expiradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ANÁLISE DE MOTIVOS DE RECUSA (Req. F) */}
      {Object.keys(metricas.recusasPorMotivo).length > 0 && (
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-red-600" />
              Distribuição dos Motivos de Recusa Registrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.entries(metricas.recusasPorMotivo).map(([motivo, qtd]) => {
                const perc =
                  metricas.totalRecusadas > 0
                    ? Math.round((qtd / metricas.totalRecusadas) * 100)
                    : 0
                return (
                  <div
                    key={motivo}
                    className="bg-white border border-red-200 p-2.5 rounded-lg shadow-2xs"
                  >
                    <div className="font-semibold text-slate-800">{motivo}</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-lg font-bold font-mono text-red-600">{qtd}</span>
                      <span className="text-[11px] font-mono text-slate-500">{perc}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FILTROS E BUSCA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número, empresa, cliente PF ou escopo..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px] text-xs h-9 bg-white">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="aprovacao_interna">Aprovação Interna</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="visualizada">Visualizada</SelectItem>
              <SelectItem value="em_negociacao">Em Negociação</SelectItem>
              <SelectItem value="aceita">Aceita</SelectItem>
              <SelectItem value="recusada">Recusada</SelectItem>
              <SelectItem value="expirada">Expirada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABELA DE PROPOSTAS */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Número & Rev.</th>
                  <th className="py-3 px-4">Cliente / Empresa</th>
                  <th className="py-3 px-4">Contrato Vinculado</th>
                  <th className="py-3 px-4 text-right">Preço Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Validade</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Carregando propostas...
                    </td>
                  </tr>
                ) : propostasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-orange-100 text-[#D95A2B] flex items-center justify-center mx-auto">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {filtroBusca || filtroStatus !== 'todos'
                              ? 'Nenhuma proposta encontrada para estes filtros'
                              : 'Crie sua primeira Proposta Comercial'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {filtroBusca || filtroStatus !== 'todos'
                              ? 'Ajuste os filtros de busca ou status para visualizar os orçamentos.'
                              : 'Estruture orçamentos com catálogo de serviços da G+, regras de margem mínima (BDI), versionamento de revisões (Rev.00, Rev.01) e link público seguro.'}
                          </p>
                        </div>
                        {canCreateOrEdit && (
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={handleOpenNova}
                              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                            >
                              <Plus className="w-4 h-4 mr-1.5" /> Elaborar Primeira Proposta
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  propostasFiltradas.map((p) => {
                    // Cálculo de aviso de vencimento (D-3)
                    const hoje = new Date()
                    hoje.setHours(0, 0, 0, 0)
                    let dMenosTres = false
                    if (
                      p.validade &&
                      (p.status === 'enviada' ||
                        p.status === 'visualizada' ||
                        p.status === 'em_negociacao')
                    ) {
                      const dataVal = new Date(p.validade)
                      dataVal.setHours(0, 0, 0, 0)
                      const diffDias = Math.round(
                        (dataVal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
                      )
                      if (diffDias >= 0 && diffDias <= 3) {
                        dMenosTres = true
                      }
                    }

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                            {p.numero}
                            <Badge variant="outline" className="text-[10px] px-1 font-mono">
                              {p.revisao || 'Rev.00'}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDateBr(p.created)}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {p.expand?.empresa ? (
                            <div>
                              <div className="font-semibold text-slate-900 line-clamp-1">
                                {p.expand.empresa.razao_social}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                CNPJ: {p.expand.empresa.cnpj}
                                {p.expand.empresa.municipio &&
                                  ` • ${p.expand.empresa.municipio}/${p.expand.empresa.uf || ''}`}
                              </div>
                            </div>
                          ) : p.expand?.cliente_pf ? (
                            <div>
                              <div className="font-semibold text-slate-900">
                                {p.expand.cliente_pf.nome}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                PF{' '}
                                {p.expand.cliente_pf.endereco
                                  ? `• ${p.expand.cliente_pf.endereco}`
                                  : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Não informado</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {p.expand?.contrato ? (
                            <div>
                              <div className="font-medium text-slate-800 line-clamp-1">
                                {p.expand.contrato.numero}
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">
                                {p.expand.contrato.orgao}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Direto</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(p.preco)}
                        </td>

                        <td className="py-3 px-4 text-center">{getStatusBadge(p.status)}</td>

                        <td className="py-3 px-4">
                          {p.validade ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-700">
                                {formatDateBr(p.validade)}
                              </span>
                              {dMenosTres && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  D-3
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetalhes(p)}
                            className="h-7 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Ver Proposta
                          </Button>

                          {canCreateOrEdit && p.status === 'rascunho' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditar(p)}
                              className="h-7 text-xs text-slate-600 hover:text-slate-800"
                            >
                              Editar
                            </Button>
                          )}

                          {p.status === 'aprovacao_interna' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAprovacao(p)}
                              className="h-7 text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100"
                            >
                              Aprovação
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL EDITOR DE PROPOSTA */}
      <ModalEditorProposta
        open={showEditorModal}
        onOpenChange={setShowEditorModal}
        propostaToEdit={propostaEditando}
        currentUserId={user?.id}
        onSaved={() => {
          loadPropostas()
        }}
      />

      {/* MODAL DETALHE DE PROPOSTA */}
      <ModalDetalheProposta
        open={showDetalheModal}
        onOpenChange={setShowDetalheModal}
        proposta={propostaDetalhe}
        canEdit={canCreateOrEdit}
        onCriarRevisao={handleCriarRevisao}
        onMudarStatus={handleMudarStatus}
        onAbrirAprovacao={(p) => {
          setShowDetalheModal(false)
          handleOpenAprovacao(p)
        }}
      />

      {/* MODAL APROVAÇÃO INTERNA */}
      <ModalAprovacaoInterna
        open={showAprovacaoModal}
        onOpenChange={setShowAprovacaoModal}
        proposta={propostaAprovacao}
        currentUserId={user?.id || ''}
        currentUserRole={role}
        onApproved={() => {
          loadPropostas()
        }}
      />
    </div>
  )
}
export default PropostasPage
