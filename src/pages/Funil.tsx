import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  EmpresaRecord,
  ContratoRecord,
  UserRecord,
  EtapaFunil,
  CurvaABC,
  ReativacaoSugeridaRecord,
} from '@/types'
import { empresasService } from '@/services/empresas'
import { contratosService } from '@/services/contratos'
import { usersService } from '@/services/users'
import { parametrosService } from '@/services/parametros'
import { reativacoesService } from '@/services/reativacoes'
import { scoreCurvaService } from '@/services/scoreCurva'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { FunilEmpresaCard } from '@/components/funil/FunilEmpresaCard'
import { InativarEmpresaModal } from '@/components/funil/InativarEmpresaModal'
import { ProximaAcaoModal } from '@/components/funil/ProximaAcaoModal'
import { FunilEmpresaTimeline } from '@/components/funil/FunilEmpresaTimeline'
import { EmpresaDetailModal } from '@/components/empresas/EmpresaDetailModal'
import {
  Kanban,
  Filter,
  RefreshCw,
  Search,
  Plus,
  Sparkles,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// As 9 colunas oficiais do Funil de Intermediação de Engenharia
const KANBAN_COLUMNS: { id: EtapaFunil; title: string; color: string; border: string }[] = [
  {
    id: 'identificada',
    title: 'Identificada',
    color: 'bg-slate-100/90 text-slate-800',
    border: 'border-slate-300',
  },
  {
    id: 'qualificada',
    title: 'Qualificada',
    color: 'bg-blue-50 text-blue-800',
    border: 'border-blue-200',
  },
  {
    id: 'em_cadencia',
    title: 'Em Cadência',
    color: 'bg-indigo-50 text-indigo-800',
    border: 'border-indigo-200',
  },
  {
    id: 'em_conversa',
    title: 'Em Conversa',
    color: 'bg-cyan-50 text-cyan-800',
    border: 'border-cyan-200',
  },
  {
    id: 'com_proposta_elaborada',
    title: 'Proposta Elaborada',
    color: 'bg-amber-50 text-amber-800',
    border: 'border-amber-200',
  },
  {
    id: 'proposta_enviada',
    title: 'Proposta Enviada / Negociação',
    color: 'bg-orange-50 text-orange-800',
    border: 'border-orange-200',
  },
  {
    id: 'parceira',
    title: 'Parceira',
    color: 'bg-emerald-50 text-emerald-800',
    border: 'border-emerald-300',
  },
  {
    id: 'nutricao_mensal',
    title: 'Nutrição Mensal',
    color: 'bg-violet-50 text-violet-800',
    border: 'border-violet-200',
  },
  { id: 'inativa', title: 'Inativa', color: 'bg-rose-50 text-rose-800', border: 'border-rose-200' },
]

export default function FunilPage() {
  const { user, isAdmin, isComercial } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Estado de dados
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [contratos, setContratos] = useState<ContratoRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [reativacoesPendentes, setReativacoesPendentes] = useState<ReativacaoSugeridaRecord[]>([])

  // Filtros combináveis persistidos na sessionStorage
  const [filtroEtapa, setFiltroEtapa] = useState<string>(
    () => sessionStorage.getItem('funil_filtro_etapa') || 'todas',
  )
  const [filtroCurva, setFiltroCurva] = useState<string>(
    () => sessionStorage.getItem('funil_filtro_curva') || 'todas',
  )
  const [filtroUf, setFiltroUf] = useState<string>(
    () => sessionStorage.getItem('funil_filtro_uf') || 'todas',
  )
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>(
    () => sessionStorage.getItem('funil_filtro_resp') || 'todos',
  )
  const [filtroFaixaValor, setFiltroFaixaValor] = useState<string>(
    () => sessionStorage.getItem('funil_filtro_valor') || 'todas',
  )
  const [busca, setBusca] = useState('')

  // Persistir filtros na sessão
  useEffect(() => {
    sessionStorage.setItem('funil_filtro_etapa', filtroEtapa)
  }, [filtroEtapa])
  useEffect(() => {
    sessionStorage.setItem('funil_filtro_curva', filtroCurva)
  }, [filtroCurva])
  useEffect(() => {
    sessionStorage.setItem('funil_filtro_uf', filtroUf)
  }, [filtroUf])
  useEffect(() => {
    sessionStorage.setItem('funil_filtro_resp', filtroResponsavel)
  }, [filtroResponsavel])
  useEffect(() => {
    sessionStorage.setItem('funil_filtro_valor', filtroFaixaValor)
  }, [filtroFaixaValor])

  // Modais de suporte
  const [empresaInativar, setEmpresaInativar] = useState<EmpresaRecord | null>(null)
  const [empresaProximaAcao, setEmpresaProximaAcao] = useState<EmpresaRecord | null>(null)
  const [empresaTimeline, setEmpresaTimeline] = useState<EmpresaRecord | null>(null)
  const [empresaDetalhe, setEmpresaDetalhe] = useState<EmpresaRecord | null>(null)

  // Drag & drop state
  const [draggedEmpresaId, setDraggedEmpresaId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const [exportando, setExportando] = useState(false)

  const handleExportarFunil = async () => {
    if (empresasFiltradas.length === 0) {
      toast({
        title: 'Sem dados para exportar',
        description: 'Nenhuma empresa visível no funil com os filtros atuais.',
        variant: 'destructive',
      })
      return
    }

    setExportando(true)
    try {
      await exportService.exportarParaCsv({
        filename: `funil_export_${new Date().toISOString().slice(0, 10)}.csv`,
        tela: 'funil',
        descricao: 'Exportação das empresas e etapas do Funil de Vendas com curva ABC e valores',
        filtros: {
          etapa: filtroEtapa,
          curva: filtroCurva,
          uf: filtroUf,
          responsavel: filtroResponsavel,
          faixa_valor: filtroFaixaValor,
          busca: busca || undefined,
        },
        columns: [
          {
            header: 'Empresa',
            accessor: (e) => e.nome_fantasia || e.razao_social || 'Sem Nome',
          },
          { header: 'Razão Social', accessor: (e) => e.razao_social || '' },
          { header: 'CNPJ', accessor: (e) => formatCnpj(e.cnpj) },
          { header: 'UF', accessor: (e) => e.uf || '' },
          {
            header: 'Etapa do Funil',
            accessor: (e) => {
              const col = KANBAN_COLUMNS.find((c) => c.id === e.etapa_funil)
              return col ? col.title : e.etapa_funil
            },
          },
          { header: 'Curva ABC', accessor: (e) => e.curva || 'C' },
          {
            header: 'Score Calculado',
            accessor: (e) => {
              const cts = contratosPorEmpresa.get(e.id)?.contratos || []
              return scoreCurvaService.calcular(cts, e.cnae).score
            },
          },
          {
            header: 'Valor Contratos Ativos (R$)',
            accessor: (e) => {
              const val = contratosPorEmpresa.get(e.id)?.total || 0
              return formatCurrencyBr(val)
            },
          },
          {
            header: 'Qtd Contratos Ativos',
            accessor: (e) => contratosPorEmpresa.get(e.id)?.contratos.length || 0,
          },
          {
            header: 'Responsável',
            accessor: (e) => users.find((u) => u.id === e.responsavel)?.name || 'Não atribuído',
          },
          {
            header: 'Próxima Ação Data',
            accessor: (e) => (e.proxima_acao_data ? formatDateBr(e.proxima_acao_data) : ''),
          },
          { header: 'Próxima Ação Descrição', accessor: (e) => e.proxima_acao_desc || '' },
          { header: 'Status', accessor: (e) => e.status || 'ativa' },
        ],
        data: empresasFiltradas,
      })

      toast({
        title: 'Funil Exportado',
        description: `${empresasFiltradas.length} empresa(s) do funil exportada(s) com sucesso. Auditoria registrada no servidor.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na Exportação do Funil',
        description: err.message || 'Falha ao gerar CSV do funil.',
        variant: 'destructive',
      })
    } finally {
      setExportando(false)
    }
  }

  // Carregar dados
  const loadData = async () => {
    setLoading(true)
    try {
      const [empList, contList, userList, _paramList, reatList] = await Promise.all([
        empresasService.list(),
        contratosService.listAll(),
        usersService.list(),
        parametrosService.list(),
        reativacoesService.listPendentes(),
      ])

      setEmpresas(empList)
      setContratos(contList)
      setUsers(userList)
      setReativacoesPendentes(reatList)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar o funil',
        description: err instanceof Error ? err.message : 'Falha na conexão com o banco.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mapa de contratos ativos por empresa
  const contratosPorEmpresa = useMemo(() => {
    const map = new Map<string, { total: number; contratos: ContratoRecord[] }>()
    for (const c of contratos) {
      if (!map.has(c.empresa)) {
        map.set(c.empresa, { total: 0, contratos: [] })
      }
      const entry = map.get(c.empresa)!
      entry.contratos.push(c)
      if (contratosService.isContratoAtivo(c)) {
        entry.total += Number(c.valor) || 0
      }
    }
    return map
  }, [contratos])

  // Lista de UFs disponíveis nos dados
  const ufsDisponiveis = useMemo(() => {
    const setUfs = new Set<string>()
    empresas.forEach((e) => {
      if (e.uf) setUfs.add(e.uf.toUpperCase())
    })
    return Array.from(setUfs).sort()
  }, [empresas])

  // Empresas filtradas
  const empresasFiltradas = useMemo(() => {
    return empresas.filter((emp) => {
      // Busca por texto
      if (busca.trim()) {
        const q = busca.toLowerCase().trim()
        const matchNome = (emp.nome_fantasia || '').toLowerCase().includes(q)
        const matchRazao = (emp.razao_social || '').toLowerCase().includes(q)
        const matchMun = (emp.municipio || '').toLowerCase().includes(q)
        const matchCnpj = (emp.cnpj || '').includes(q)
        if (!matchNome && !matchRazao && !matchMun && !matchCnpj) return false
      }

      // Filtro Etapa
      if (filtroEtapa !== 'todas' && emp.etapa_funil !== filtroEtapa) {
        return false
      }

      // Filtro Curva
      if (filtroCurva !== 'todas' && emp.curva !== filtroCurva) {
        return false
      }

      // Filtro UF
      if (filtroUf !== 'todas' && (emp.uf || '').toUpperCase() !== filtroUf) {
        return false
      }

      // Filtro Responsável
      if (filtroResponsavel !== 'todos' && emp.responsavel !== filtroResponsavel) {
        return false
      }

      // Filtro Faixa de Valor
      const valorTotal = contratosPorEmpresa.get(emp.id)?.total || 0
      if (filtroFaixaValor === 'acima_5m' && valorTotal < 5000000) return false
      if (filtroFaixaValor === '1m_a_5m' && (valorTotal < 1000000 || valorTotal >= 5000000))
        return false
      if (filtroFaixaValor === 'abaixo_1m' && valorTotal >= 1000000) return false

      return true
    })
  }, [
    empresas,
    busca,
    filtroEtapa,
    filtroCurva,
    filtroUf,
    filtroResponsavel,
    filtroFaixaValor,
    contratosPorEmpresa,
  ])

  // Valor TOTAL dos contratos ativos de todas as empresas visíveis (recalculado automaticamente)
  const valorTotalVisivel = useMemo(() => {
    return empresasFiltradas.reduce((acc, emp) => {
      const val = contratosPorEmpresa.get(emp.id)?.total || 0
      return acc + val
    }, 0)
  }, [empresasFiltradas, contratosPorEmpresa])

  // Agrupamento por coluna com ordenação estrita: Curva A -> B -> C, depois por maior valor
  const colunasComEmpresas = useMemo(() => {
    const mapa = new Map<EtapaFunil, EmpresaRecord[]>()
    KANBAN_COLUMNS.forEach((col) => mapa.set(col.id, []))

    empresasFiltradas.forEach((emp) => {
      const etapa = (emp.etapa_funil || 'identificada') as EtapaFunil
      const lista = mapa.get(etapa) || []
      lista.push(emp)
      mapa.set(etapa, lista)
    })

    // Ordenar cada coluna: A -> B -> C, depois por maior valor
    mapa.forEach((lista, etapa) => {
      lista.sort((a, b) => {
        const pesoCurva = { A: 3, B: 2, C: 1 }
        const curvaA = pesoCurva[a.curva || 'C'] || 1
        const curvaB = pesoCurva[b.curva || 'C'] || 1
        if (curvaA !== curvaB) return curvaB - curvaA

        const valorA = contratosPorEmpresa.get(a.id)?.total || 0
        const valorB = contratosPorEmpresa.get(b.id)?.total || 0
        return valorB - valorA
      })
    })

    return mapa
  }, [empresasFiltradas, contratosPorEmpresa])

  // ==========================================
  // DRAG & DROP HANDLERS
  // ==========================================
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedEmpresaId(id)
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverColumn(colId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetEtapa: EtapaFunil) => {
    e.preventDefault()
    setDragOverColumn(null)
    const empresaId = draggedEmpresaId || e.dataTransfer.getData('text/plain')
    if (!empresaId) return

    const empresa = empresas.find((item) => item.id === empresaId)
    if (!empresa) return

    const etapaOrigem = empresa.etapa_funil || 'identificada'
    if (etapaOrigem === targetEtapa) return

    // REGRA C: Se o destino for "inativa", apenas Admin pode mover e exige motivo!
    if (targetEtapa === 'inativa') {
      if (!isAdmin) {
        toast({
          title: 'Operação não permitida',
          description:
            'Apenas Administradores têm permissão para mover empresas para a etapa Inativa.',
          variant: 'destructive',
        })
        return
      }
      // Abre modal de inativação com motivo obrigatório
      setEmpresaInativar(empresa)
      return
    }

    // Se estiver saindo de inativa (reativação pelo drag and drop)
    const isReactivating = etapaOrigem === 'inativa'
    const newStatus = isReactivating ? 'ativa' : empresa.status

    try {
      // Atualização otimista no estado local
      setEmpresas((prev) =>
        prev.map((item) =>
          item.id === empresaId
            ? { ...item, etapa_funil: targetEtapa, status: newStatus as any }
            : item,
        ),
      )

      await empresasService.update(empresaId, {
        etapa_funil: targetEtapa,
        status: newStatus as any,
        etapa_anterior: isReactivating ? undefined : etapaOrigem,
      })

      toast({
        title: 'Etapa atualizada',
        description: `Empresa movida de "${etapaOrigem}" para "${targetEtapa}". Auditoria registrada.`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao movimentar empresa',
        description: err instanceof Error ? err.message : 'Falha na movimentação.',
        variant: 'destructive',
      })
      loadData()
    } finally {
      setDraggedEmpresaId(null)
    }
  }

  // ==========================================
  // INATIVAÇÃO E RESTAURAÇÃO
  // ==========================================
  const handleConfirmarInativacao = async (motivo: string, observacao?: string) => {
    if (!empresaInativar) return
    const etapaAtual = empresaInativar.etapa_funil || 'identificada'

    await empresasService.update(empresaInativar.id, {
      etapa_funil: 'inativa',
      status: 'inativa',
      motivo_inativacao: motivo,
      etapa_anterior: etapaAtual,
      observacoes: observacao
        ? `${empresaInativar.observacoes || ''}\n[Inativação]: ${observacao}`.trim()
        : empresaInativar.observacoes,
    })

    toast({
      title: 'Empresa Inativada',
      description: `A empresa foi inativada pelo Administrador com motivo registrado.`,
    })

    setEmpresaInativar(null)
    loadData()
  }

  // Restauração de empresa inativa para sua etapa anterior
  const handleRestaurarEmpresa = async (emp: EmpresaRecord) => {
    const destinoRestauracao = (emp.etapa_anterior as EtapaFunil) || 'identificada'
    try {
      await empresasService.update(emp.id, {
        etapa_funil: destinoRestauracao,
        status: 'ativa',
        motivo_inativacao: '',
      })
      toast({
        title: 'Empresa Restaurada',
        description: `Restaurada com sucesso para a etapa anterior: ${destinoRestauracao}.`,
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao restaurar',
        description: err instanceof Error ? err.message : 'Falha na restauração.',
        variant: 'destructive',
      })
    }
  }

  // ==========================================
  // PRÓXIMA AÇÃO
  // ==========================================
  const handleSalvarProximaAcao = async (data: string | undefined, desc: string | undefined) => {
    if (!empresaProximaAcao) return
    try {
      await empresasService.update(empresaProximaAcao.id, {
        proxima_acao_data: data,
        proxima_acao_desc: desc,
      })
      toast({
        title: 'Próxima ação salva',
        description: 'Intervenção comercial agendada com sucesso.',
      })
      setEmpresaProximaAcao(null)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar ação',
        description: err instanceof Error ? err.message : 'Falha ao gravar.',
        variant: 'destructive',
      })
    }
  }

  // ==========================================
  // DECISÃO DE SUGESTÃO DE REATIVAÇÃO
  // ==========================================
  const handleAceitarReativacao = async (
    reat: ReativacaoSugeridaRecord,
    destino: 'em_conversa' | 'identificada',
  ) => {
    if (!user) return
    try {
      await reativacoesService.aceitar(reat.id, destino, user.id)
      toast({
        title: 'Reativação Aceita!',
        description: `Empresa reativada e movida para a coluna "${destino}".`,
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao reativar',
        description: err instanceof Error ? err.message : 'Falha ao processar reativação.',
        variant: 'destructive',
      })
    }
  }

  const handleDescartarReativacao = async (reat: ReativacaoSugeridaRecord) => {
    if (!user) return
    const obs = prompt(
      'Observação do descarte da sugestão de reativação:',
      'Contrato não se enquadra na atuação pretendida',
    )
    if (!obs) return

    try {
      await reativacoesService.descartar(reat.id, obs, user.id)
      toast({
        title: 'Sugestão descartada',
        description: 'A sugestão foi arquivada com registro de auditoria.',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao descartar',
        description: err instanceof Error ? err.message : 'Falha ao processar.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-5">
      {/* Topo do Módulo do Funil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Kanban className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Funil de Intermediação Comercial
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              9 Etapas Operacionais
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de oportunidades com órgãos públicos e parceiros demandantes de engenharia.
            Priorização por Curva ABC (A &gt; B &gt; C) e valores contratuais.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarFunil}
            disabled={exportando || loading}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/funil/sugestoes')}
            className="text-xs text-slate-700 hover:text-blue-600 hover:border-blue-300"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Fila de Sugestões
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/nao-contatar')}
            className="text-xs text-slate-700 hover:text-red-600 hover:border-red-200"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-red-500" />
            Lista Não Contatar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="text-slate-500 hover:text-blue-600"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Banner de Sugestões de Reativação Pendentes */}
      {reativacoesPendentes.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-bounce" />
              <span>{reativacoesPendentes.length} Sugestão(ões) de Reativação Disponível(is)</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">
              Empresas em Nutrição ou Inativas que venceram novo contrato
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {reativacoesPendentes.map((reat) => (
              <div
                key={reat.id}
                className="bg-white p-3 rounded-lg border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {reat.expand?.empresa?.nome_fantasia ||
                      reat.expand?.empresa?.razao_social ||
                      'Empresa'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Contrato:{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {reat.contrato_numero}
                    </span>{' '}
                    | {reat.contrato_orgao}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-emerald-700">
                    {formatCurrencyBr(reat.contrato_valor || 0)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleAceitarReativacao(reat, 'em_conversa')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Reativar (Em Conversa)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDescartarReativacao(reat)}
                    className="text-slate-600 hover:text-red-600 text-[11px] h-7 px-2"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado Vazio Orientado do Funil (quando não há empresas cadastradas no sistema) */}
      {!loading && empresas.length === 0 && (
        <div className="bg-white border-2 border-dashed border-orange-200 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-xs my-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 text-[#D95A2B] flex items-center justify-center mx-auto mb-3">
            <Kanban className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Seu Funil de Intermediação está Pronto
          </h2>
          <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            Nenhuma empresa foi cadastrada ainda. Para alimentar as 9 colunas do funil (da
            Identificação ao Fechamento), cadastre sua primeira empresa ou importe uma planilha de
            prospects públicos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <Button
              onClick={() => navigate('/empresas')}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold h-9 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Primeira Empresa
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/empresas/importar')}
              className="text-xs h-9 border-slate-300 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Importar Planilha de
              Prospects
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/funil/sugestoes')}
              className="text-xs h-9 border-slate-300 text-slate-700 hover:text-blue-700 hover:border-blue-300"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" /> Ver Fila de Sugestões PNCP
            </Button>
          </div>
        </div>
      )}

      {/* CABEÇALHO DO FUNIL: Valor Total Recalculado e Contadores */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-400">
            Pipeline Visível no Funil
          </span>
          <div className="text-3xl font-extrabold font-mono text-white mt-1">
            {formatCurrencyBr(valorTotalVisivel)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Soma dinâmica dos contratos ativos das empresas visíveis conforme os filtros ativos.
          </p>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Empresas Visíveis
            </span>
            <span className="text-xl font-bold font-mono text-white">
              {empresasFiltradas.length}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Curva A</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {empresasFiltradas.filter((e) => e.curva === 'A').length}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Curva B</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {empresasFiltradas.filter((e) => e.curva === 'B').length}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Curva C</span>
            <span className="text-xl font-bold font-mono text-slate-300">
              {empresasFiltradas.filter((e) => e.curva === 'C').length}
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS COMBINÁVEIS (PERSISTIDOS NA SESSÃO) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Buscar empresas por Razão Social, Fantasia, CNPJ ou Cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          {busca && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBusca('')}
              className="text-xs text-slate-500"
            >
              Limpar busca
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-xs">
          {/* Filtro Etapa */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Etapa
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filtroEtapa}
              onChange={(e) => setFiltroEtapa(e.target.value)}
            >
              <option value="todas">Todas as Etapas (9)</option>
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Curva */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Curva ABC
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
              value={filtroCurva}
              onChange={(e) => setFiltroCurva(e.target.value)}
            >
              <option value="todas">Todas as Curvas</option>
              <option value="A">Curva A (&gt; R$ 5 mi)</option>
              <option value="B">Curva B (R$ 1–5 mi)</option>
              <option value="C">Curva C (&lt; R$ 1 mi)</option>
            </select>
          </div>

          {/* Filtro UF */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">UF</label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filtroUf}
              onChange={(e) => setFiltroUf(e.target.value)}
            >
              <option value="todas">Todas as UFs</option>
              {ufsDisponiveis.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Responsável */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Responsável
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
            >
              <option value="todos">Todos os Responsáveis</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Faixa de Valor */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Faixa de Valor Ativo
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filtroFaixaValor}
              onChange={(e) => setFiltroFaixaValor(e.target.value)}
            >
              <option value="todas">Todas as Faixas</option>
              <option value="acima_5m">&gt; R$ 5 Milhões</option>
              <option value="1m_a_5m">R$ 1 Milhão a R$ 5 Milhões</option>
              <option value="abaixo_1m">&lt; R$ 1 Milhão</option>
            </select>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD: 9 COLUNAS COM DRAG & DROP E ORDENAÇÃO A -> B -> C */}
      <div className="relative">
        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            Carregando funil e calculando scores...
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 items-start min-h-[600px] scrollbar-thin">
            {KANBAN_COLUMNS.map((col) => {
              const empresasDaColuna = colunasComEmpresas.get(col.id) || []
              const totalColuna = empresasDaColuna.reduce(
                (acc, emp) => acc + (contratosPorEmpresa.get(emp.id)?.total || 0),
                0,
              )
              const isOver = dragOverColumn === col.id

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`w-72 shrink-0 flex flex-col rounded-xl border bg-slate-100/60 transition-colors ${
                    isOver ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'border-slate-200'
                  }`}
                >
                  {/* Cabeçalho da Coluna */}
                  <div className={`p-3 rounded-t-xl border-b ${col.border} ${col.color}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs uppercase tracking-wide truncate">
                        {col.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white">
                        {empresasDaColuna.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Total ativo:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrencyBr(totalColuna)}
                      </span>
                    </div>
                  </div>

                  {/* Corpo da Coluna: Cards de Empresas */}
                  <div className="p-2 space-y-2 flex-1 min-h-[420px] max-h-[calc(100vh-320px)] overflow-y-auto">
                    {empresasDaColuna.length === 0 ? (
                      <div className="h-32 border border-dashed border-slate-300/80 rounded-lg flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs">
                        <span>Arraste uma empresa para cá</span>
                      </div>
                    ) : (
                      empresasDaColuna.map((emp) => {
                        const totalAtivo = contratosPorEmpresa.get(emp.id)?.total || 0
                        const hasReat = reativacoesPendentes.some((r) => r.empresa === emp.id)

                        return (
                          <div key={emp.id} className="relative">
                            <FunilEmpresaCard
                              empresa={emp}
                              totalContratosAtivos={totalAtivo}
                              hasReativacaoPendente={hasReat}
                              onEditProximaAcao={(e) => setEmpresaProximaAcao(e)}
                              onOpenTimeline={(e) => setEmpresaTimeline(e)}
                              onOpenDetalhes={(e) => setEmpresaDetalhe(e)}
                              onElaborarProposta={(e) => {
                                navigate(`/propostas?nova=true&empresaId=${e.id}`)
                              }}
                              onDragStart={handleDragStart}
                              canDrag={true}
                            />{' '}
                            {/* Ação especial na coluna Inativa: Restaurar etapa anterior */}
                            {col.id === 'inativa' && emp.etapa_anterior && (
                              <button
                                onClick={() => handleRestaurarEmpresa(emp)}
                                className="mt-1 w-full text-center text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 py-1 rounded border border-blue-200 transition-colors"
                              >
                                Restaurar para "{emp.etapa_anterior}"
                              </button>
                            )}
                            {/* Ação especial na coluna Nutrição Mensal: Reativar retorno ao funil para Em Conversa */}
                            {col.id === 'nutricao_mensal' && (
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      `Mover ${
                                        emp.nome_fantasia || emp.razao_social
                                      } de volta ao funil ativo na etapa "Em conversa"?`,
                                    )
                                  ) {
                                    try {
                                      await empresasService.update(emp.id, {
                                        etapa_funil: 'em_conversa',
                                        etapa_anterior: 'nutricao_mensal',
                                        proxima_acao_data: new Date().toISOString(),
                                        proxima_acao_desc:
                                          'Retorno manual de Nutrição Mensal para Em conversa',
                                      })
                                      toast({
                                        title: 'Empresa reativada!',
                                        description:
                                          'A empresa retornou para a etapa Em conversa no funil.',
                                      })
                                      loadData()
                                    } catch (err: unknown) {
                                      toast({
                                        title: 'Erro ao mover',
                                        description:
                                          err instanceof Error ? err.message : 'Falha na alteração',
                                        variant: 'destructive',
                                      })
                                    }
                                  }
                                }}
                                className="mt-1 w-full text-center text-[10px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 py-1 rounded border border-teal-200 transition-colors"
                              >
                                Retornar para "Em conversa"
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Inativação Obrigatória (Admin only) */}
      <InativarEmpresaModal
        open={!!empresaInativar}
        onOpenChange={(open) => !open && setEmpresaInativar(null)}
        empresaNome={empresaInativar?.nome_fantasia || empresaInativar?.razao_social || ''}
        onConfirm={handleConfirmarInativacao}
      />

      {/* Modal de Próxima Ação */}
      <ProximaAcaoModal
        open={!!empresaProximaAcao}
        onOpenChange={(open) => !open && setEmpresaProximaAcao(null)}
        empresaNome={empresaProximaAcao?.nome_fantasia || empresaProximaAcao?.razao_social || ''}
        currentDate={empresaProximaAcao?.proxima_acao_data}
        currentDesc={empresaProximaAcao?.proxima_acao_desc}
        onSave={handleSalvarProximaAcao}
      />

      {/* Painel Lateral de Linha do Tempo e Auditoria */}
      <FunilEmpresaTimeline
        open={!!empresaTimeline}
        onOpenChange={(open) => !open && setEmpresaTimeline(null)}
        empresaId={empresaTimeline?.id || ''}
        empresaNome={empresaTimeline?.nome_fantasia || empresaTimeline?.razao_social || ''}
      />

      {/* Modal Completo de Cadastro da Empresa */}
      {empresaDetalhe && (
        <EmpresaDetailModal
          open={!!empresaDetalhe}
          onOpenChange={(open) => !open && setEmpresaDetalhe(null)}
          empresa={empresaDetalhe}
          users={users}
          diasAlerta={90}
          readOnly={false}
          onSuccess={() => {
            loadData()
          }}
          onCreatedEmpresaSelect={(alvo) => setEmpresaDetalhe(alvo)}
          onEmpresaUpdate={(updated) => setEmpresaDetalhe(updated)}
        />
      )}
    </div>
  )
}
