import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  EmpresaRecord,
  UserRecord,
  ContratoRecord,
  ETAPA_FUNIL_LABELS,
  EtapaFunil,
  CurvaABC,
} from '@/types'
import { empresasService, EmpresaFilters } from '@/services/empresas'
import { contratosService } from '@/services/contratos'
import { usersService } from '@/services/users'
import { parametrosService } from '@/services/parametros'
import { naoContatarService } from '@/services/naoContatar'
import { EmpresaDetailModal } from '@/components/empresas/EmpresaDetailModal'
import { formatCurrencyBr } from '@/lib/formatters'
import { formatCnpj, cleanCnpj, cleanPhoneForWa } from '@/lib/cnpj'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Plus,
  Search,
  X,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { exportService } from '@/services/exportService'

export default function EmpresasPage() {
  const { user, isAdmin, isComercial, isFinanceiro, isGestor } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Permissões
  // Admin e Comercial: leitura e gravação
  // Financeiro e Gestor: apenas leitura
  const canEdit = isAdmin || isComercial
  const isReadOnly = !canEdit

  const [loading, setLoading] = useState(true)
  const [todasEmpresas, setTodasEmpresas] = useState<EmpresaRecord[]>([])
  const [allContratos, setAllContratos] = useState<ContratoRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [naoContatarList, setNaoContatarList] = useState<
    { id: string; empresa?: string; email: string }[]
  >([])
  const [diasAlerta, setDiasAlerta] = useState(90)

  // Filtro de Busca com valor imediato (digitação fluida) e debounced
  const [buscaInput, setBuscaInput] = useState('')
  const [debouncedBusca, setDebouncedBusca] = useState('')

  // Filtros combináveis
  const [curvasSelecionadas, setCurvasSelecionadas] = useState<CurvaABC[]>([])
  const [situacaoCadastral, setSituacaoCadastral] = useState('todas')
  const [etapaFunil, setEtapaFunil] = useState('todas')
  const [uf, setUf] = useState('todas')
  const [cidade, setCidade] = useState('todas')
  const [responsavel, setResponsavel] = useState('todos')
  const [status, setStatus] = useState('todas') // 'todas' | 'ativa' | 'inativa'
  const [temContratoAtivo, setTemContratoAtivo] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [filtroNaoContatar, setFiltroNaoContatar] = useState<
    'excluir' | 'todos' | 'apenas_bloqueados'
  >('excluir')
  const [incluirPreCadastros, setIncluirPreCadastros] = useState(false)

  // Painel de filtros avançados recolhível no mobile ou expansível
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(true)

  // Ordenação da Tabela
  type SortField = 'razao_social' | 'cnpj' | 'cidade' | 'curva' | 'valor_contratos' | 'etapa_funil'
  const [sortField, setSortField] = useState<SortField>('razao_social')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal de Detalhe / Criação
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaRecord | null>(null)

  // Debounce da busca em ~500ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedBusca(buscaInput)
    }, 500)
    return () => clearTimeout(handler)
  }, [buscaInput])

  // Carregar dados mestres
  const loadData = async () => {
    setLoading(true)
    try {
      const [empList, contList, userList, paramList, ncList] = await Promise.all([
        empresasService.list({ incluirPreCadastros }),
        contratosService.listAll(),
        usersService.list(),
        parametrosService.list(),
        naoContatarService.list().catch(() => []),
      ])

      setTodasEmpresas(empList)
      setAllContratos(contList)
      setUsers(userList)
      setNaoContatarList(ncList)

      const pAlerta = paramList.find((p) => p.chave === 'dias_alerta_fim_contrato')
      if (pAlerta && pAlerta.valor) {
        const valNum = parseInt(pAlerta.valor, 10)
        if (!isNaN(valNum)) setDiasAlerta(valNum)
      }
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: err instanceof Error ? err.message : 'Falha ao consultar empresas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [incluirPreCadastros])

  // Mapa de contratos ativos por empresa para apuração rápida de coluna e alertas
  const contratosPorEmpresa = useMemo(() => {
    const map = new Map<
      string,
      { totalAtivo: number; contratos: ContratoRecord[]; hasAlertaVencimento: boolean }
    >()

    for (const c of allContratos) {
      if (!map.has(c.empresa)) {
        map.set(c.empresa, { totalAtivo: 0, contratos: [], hasAlertaVencimento: false })
      }
      const entry = map.get(c.empresa)!
      entry.contratos.push(c)

      const isAtivo = contratosService.isContratoAtivo(c)
      if (isAtivo) {
        entry.totalAtivo += c.valor || 0
        const alerta = contratosService.isProximoDoFim(c.vigencia_fim, diasAlerta)
        if (alerta.proximo) {
          entry.hasAlertaVencimento = true
        }
      }
    }
    return map
  }, [allContratos, diasAlerta])

  // Conjunto de IDs e E-mails bloqueados na lista "Não Contatar"
  const bloqueadosInfo = useMemo(() => {
    const empresaIds = new Set<string>()
    const emails = new Set<string>()
    for (const item of naoContatarList) {
      if (item.empresa) empresaIds.add(item.empresa)
      if (item.email) emails.add(item.email.trim().toLowerCase())
    }
    return { empresaIds, emails }
  }, [naoContatarList])

  // Helper para checar se uma empresa está na lista "Não contatar"
  const isEmpresaBloqueada = (emp: EmpresaRecord): boolean => {
    if (bloqueadosInfo.empresaIds.has(emp.id)) return true
    if (emp.email && bloqueadosInfo.emails.has(emp.email.trim().toLowerCase())) return true
    return false
  }

  // Listas de opções derivadas da base inteira
  const ufsDisponiveis = useMemo(() => {
    const setUfs = new Set<string>()
    todasEmpresas.forEach((e) => {
      if (e.uf) setUfs.add(e.uf.trim().toUpperCase())
    })
    return Array.from(setUfs).filter(Boolean).sort()
  }, [todasEmpresas])

  const cidadesDisponiveis = useMemo(() => {
    const setCidades = new Set<string>()
    todasEmpresas.forEach((e) => {
      // Se tiver UF selecionada, filtra cidades daquela UF
      if (uf !== 'todas' && e.uf?.trim().toUpperCase() !== uf) return
      if (e.municipio) setCidades.add(e.municipio.trim().toUpperCase())
    })
    return Array.from(setCidades).filter(Boolean).sort()
  }, [todasEmpresas, uf])

  // Normalização de Situação Cadastral (ex: 2 -> ATIVA)
  const normalizarSituacaoCadastral = (sit?: string): string => {
    if (!sit) return 'ATIVA'
    const s = String(sit).trim().toUpperCase()
    if (s === '2' || s === 'ATIVA' || s === 'ATIVO') return 'ATIVA'
    if (s === 'SUSPENSA' || s === 'SUSPENSO') return 'SUSPENSA'
    if (s === 'INAPTA' || s === 'INAPTO') return 'INAPTA'
    if (s === 'BAIXADA' || s === 'BAIXADO') return 'BAIXADA'
    if (s === 'NULA' || s === 'NULO') return 'NULA'
    return s
  }

  // Filtragem e busca progressiva combinada em tempo real (Escopos A e B)
  const empresasFiltradas = useMemo(() => {
    return todasEmpresas.filter((emp) => {
      // 1. Busca Progressiva Multi-critério (Razão Social, Nome Fantasia, CNPJ limpo ou formatado, Município, UF)
      if (debouncedBusca.trim()) {
        const queryTerm = debouncedBusca.trim().toLowerCase()
        const queryCleanDigits = debouncedBusca.replace(/\D/g, '')

        const razao = (emp.razao_social || '').toLowerCase()
        const fantasia = (emp.nome_fantasia || '').toLowerCase()
        const municipio = (emp.municipio || '').toLowerCase()
        const estadoUf = (emp.uf || '').toLowerCase()
        const empCnpjLimpo = cleanCnpj(emp.cnpj || '')
        const empCnpjFormatado = (emp.cnpj || '').toLowerCase()

        let matchesBusca =
          razao.includes(queryTerm) ||
          fantasia.includes(queryTerm) ||
          municipio.includes(queryTerm) ||
          estadoUf === queryTerm ||
          empCnpjFormatado.includes(queryTerm)

        // Se o usuário digitou números (com ou sem pontuação de CNPJ), checa se o CNPJ limpo contém esses dígitos
        if (!matchesBusca && queryCleanDigits.length > 0) {
          if (empCnpjLimpo.includes(queryCleanDigits)) {
            matchesBusca = true
          }
        }

        if (!matchesBusca) return false
      }

      // 2. Curva ABC (multi-seleção: A, B, C)
      if (curvasSelecionadas.length > 0) {
        const curvaEfetiva = (emp.curva || 'C') as CurvaABC
        if (!curvasSelecionadas.includes(curvaEfetiva)) {
          return false
        }
      }

      // 3. Situação Cadastral
      if (situacaoCadastral !== 'todas') {
        const sitNormalizada = normalizarSituacaoCadastral(emp.situacao_cadastral)
        if (sitNormalizada !== situacaoCadastral.toUpperCase()) {
          return false
        }
      }

      // 4. Etapa do Funil (as 9 colunas existentes)
      if (etapaFunil !== 'todas') {
        if (emp.etapa_funil !== etapaFunil) {
          return false
        }
      }

      // 5. UF
      if (uf !== 'todas') {
        if ((emp.uf || '').trim().toUpperCase() !== uf.toUpperCase()) {
          return false
        }
      }

      // 6. Cidade
      if (cidade !== 'todas') {
        if ((emp.municipio || '').trim().toUpperCase() !== cidade.toUpperCase()) {
          return false
        }
      }

      // 7. Responsável
      if (responsavel !== 'todos') {
        if (emp.responsavel !== responsavel) {
          return false
        }
      }

      // 8. Empresa ativa/inativa no sistema (Status no Funil)
      if (status !== 'todas') {
        if (emp.status !== status) {
          return false
        }
      }

      // 9. Tem contrato ativo (sim / não)
      if (temContratoAtivo !== 'todos') {
        const info = contratosPorEmpresa.get(emp.id)
        const temAtivo = Boolean(info && info.totalAtivo > 0)
        if (temContratoAtivo === 'sim' && !temAtivo) return false
        if (temContratoAtivo === 'nao' && temAtivo) return false
      }

      // 10. "Não contatar" (padrão 'excluir', ou 'todos', ou 'apenas_bloqueados')
      const bloqueada = isEmpresaBloqueada(emp)
      if (filtroNaoContatar === 'excluir' && bloqueada) {
        return false
      }
      if (filtroNaoContatar === 'apenas_bloqueados' && !bloqueada) {
        return false
      }

      return true
    })
  }, [
    todasEmpresas,
    debouncedBusca,
    curvasSelecionadas,
    situacaoCadastral,
    etapaFunil,
    uf,
    cidade,
    responsavel,
    status,
    temContratoAtivo,
    filtroNaoContatar,
    contratosPorEmpresa,
    bloqueadosInfo,
  ])

  // Ordenação das empresas filtradas ao clicar nas colunas
  const empresasOrdenadas = useMemo(() => {
    const list = [...empresasFiltradas]
    list.sort((a, b) => {
      let valA: string | number = ''
      let valB: string | number = ''

      if (sortField === 'razao_social') {
        valA = (a.nome_fantasia || a.razao_social || '').toLowerCase()
        valB = (b.nome_fantasia || b.razao_social || '').toLowerCase()
      } else if (sortField === 'cnpj') {
        valA = cleanCnpj(a.cnpj || '')
        valB = cleanCnpj(b.cnpj || '')
      } else if (sortField === 'cidade') {
        valA = `${a.municipio || ''} ${a.uf || ''}`.toLowerCase()
        valB = `${b.municipio || ''} ${b.uf || ''}`.toLowerCase()
      } else if (sortField === 'curva') {
        valA = a.curva || 'C'
        valB = b.curva || 'C'
      } else if (sortField === 'valor_contratos') {
        valA = contratosPorEmpresa.get(a.id)?.totalAtivo || 0
        valB = contratosPorEmpresa.get(b.id)?.totalAtivo || 0
      } else if (sortField === 'etapa_funil') {
        valA = a.etapa_funil || ''
        valB = b.etapa_funil || ''
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA)
      const strB = String(valB)
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' })
        : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' })
    })
    return list
  }, [empresasFiltradas, sortField, sortOrder, contratosPorEmpresa])

  // Alternar ordenação de coluna
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'valor_contratos' ? 'desc' : 'asc')
    }
  }

  // Toggle de seleção Curva ABC
  const toggleCurva = (curvaLetra: CurvaABC) => {
    setCurvasSelecionadas((prev) =>
      prev.includes(curvaLetra) ? prev.filter((c) => c !== curvaLetra) : [...prev, curvaLetra],
    )
  }

  // Limpar todos os filtros para o estado padrão
  const limparTodosFiltros = () => {
    setBuscaInput('')
    setDebouncedBusca('')
    setCurvasSelecionadas([])
    setSituacaoCadastral('todas')
    setEtapaFunil('todas')
    setUf('todas')
    setCidade('todas')
    setResponsavel('todos')
    setStatus('todas')
    setTemContratoAtivo('todos')
    setFiltroNaoContatar('excluir')
    setIncluirPreCadastros(false)
  }

  // Determinar quais filtros estão ativos para os chips removíveis
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(buscaInput.trim()) ||
      curvasSelecionadas.length > 0 ||
      situacaoCadastral !== 'todas' ||
      etapaFunil !== 'todas' ||
      uf !== 'todas' ||
      cidade !== 'todas' ||
      responsavel !== 'todos' ||
      status !== 'todas' ||
      temContratoAtivo !== 'todos' ||
      filtroNaoContatar !== 'excluir' ||
      incluirPreCadastros
    )
  }, [
    buscaInput,
    curvasSelecionadas,
    situacaoCadastral,
    etapaFunil,
    uf,
    cidade,
    responsavel,
    status,
    temContratoAtivo,
    filtroNaoContatar,
    incluirPreCadastros,
  ])

  const [exportando, setExportando] = useState(false)

  const handleExportarCsv = async () => {
    if (empresasOrdenadas.length === 0) {
      toast({
        title: 'Sem dados para exportar',
        description: 'A lista filtrada de empresas não contém registros no momento.',
        variant: 'destructive',
      })
      return
    }

    setExportando(true)
    try {
      await exportService.exportarParaCsv({
        filename: `empresas_export_${new Date().toISOString().slice(0, 10)}.csv`,
        tela: 'empresas',
        descricao: 'Exportação da lista filtrada e ordenada de empresas e contratos',
        filtros: {
          busca: debouncedBusca || undefined,
          curva: curvasSelecionadas.join(',') || undefined,
          situacao_cadastral: situacaoCadastral !== 'todas' ? situacaoCadastral : undefined,
          etapa_funil: etapaFunil !== 'todas' ? etapaFunil : undefined,
          uf: uf !== 'todas' ? uf : undefined,
          cidade: cidade !== 'todas' ? cidade : undefined,
          responsavel: responsavel !== 'todos' ? responsavel : undefined,
          status: status !== 'todas' ? status : undefined,
          tem_contrato_ativo: temContratoAtivo !== 'todos' ? temContratoAtivo : undefined,
          nao_contatar: filtroNaoContatar,
        },
        columns: [
          { header: 'Razão Social', accessor: (e) => e.razao_social || '' },
          { header: 'Nome Fantasia', accessor: (e) => e.nome_fantasia || '' },
          { header: 'CNPJ', accessor: (e) => formatCnpj(e.cnpj) },
          { header: 'UF', accessor: (e) => e.uf || '' },
          { header: 'Município', accessor: (e) => e.municipio || '' },
          { header: 'Curva ABC', accessor: (e) => e.curva || 'C' },
          {
            header: 'Etapa do Funil',
            accessor: (e) => ETAPA_FUNIL_LABELS[e.etapa_funil as EtapaFunil] || e.etapa_funil || '',
          },
          {
            header: 'Responsável',
            accessor: (e) => users.find((u) => u.id === e.responsavel)?.name || 'Não atribuído',
          },
          {
            header: 'Contratos Ativos (Qtd)',
            accessor: (e) => contratosPorEmpresa.get(e.id)?.contratos.length || 0,
          },
          {
            header: 'Valor Total Contratos (R$)',
            accessor: (e) => {
              const val = contratosPorEmpresa.get(e.id)?.totalAtivo || 0
              return formatCurrencyBr(val)
            },
          },
          {
            header: 'Situação Cadastral',
            accessor: (e) => normalizarSituacaoCadastral(e.situacao_cadastral),
          },
          { header: 'Status no Funil', accessor: (e) => e.status || 'ativa' },
          {
            header: 'Não Contatar',
            accessor: (e) => (isEmpresaBloqueada(e) ? 'Sim (Bloqueada)' : 'Não'),
          },
          { header: 'E-mail', accessor: (e) => e.email || '' },
          {
            header: 'Telefone',
            accessor: (e) => e.telefones?.[0]?.numero || e.telefone || '—',
          },
        ],
        data: empresasOrdenadas,
      })

      toast({
        title: 'Exportação Concluída',
        description: `${empresasOrdenadas.length} empresa(s) exportada(s) para CSV com sucesso. Auditoria registrada no servidor.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na Exportação',
        description: err.message || 'Falha ao gerar o arquivo de exportação.',
        variant: 'destructive',
      })
    } finally {
      setExportando(false)
    }
  }

  const openNewEmpresa = () => {
    setSelectedEmpresa(null)
    setModalOpen(true)
  }

  const openEditEmpresa = (emp: EmpresaRecord) => {
    setSelectedEmpresa(emp)
    setModalOpen(true)
  }

  // Totais de topo calculados sobre as empresas exibidas/filtradas
  const totalGeralContratosAtivos = useMemo(() => {
    return empresasFiltradas.reduce((acc, curr) => {
      const info = contratosPorEmpresa.get(curr.id)
      return acc + (info?.totalAtivo || 0)
    }, 0)
  }, [empresasFiltradas, contratosPorEmpresa])

  // Indicador de ícone de ordenação
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-slate-400 opacity-60 inline" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1 text-[#D95A2B] inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1 text-[#D95A2B] inline" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Topo da Tela com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#D95A2B]" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestão de Empresas & Contratos
            </h1>
            {isReadOnly && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-300 text-xs"
              >
                Modo Leitura ({user?.role})
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Mapeamento de empresas contratadas por órgãos públicos, busca progressiva inteligente e
            curva ABC.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleExportarCsv}
            disabled={exportando || loading}
            className="text-slate-700 hover:text-emerald-700 hover:border-emerald-300 text-xs h-9"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </Button>

          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/empresas/importar')}
                className="text-slate-700 hover:text-blue-600 hover:border-blue-300 text-xs h-9"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
                Importar Planilha
              </Button>

              <Button
                onClick={openNewEmpresa}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white shadow-sm text-xs h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Empresa
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Cards de Métricas Rápidas (refletindo a base ou filtros) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Empresas Encontradas
            </span>
            {hasActiveFilters && (
              <Badge
                variant="outline"
                className="text-[10px] bg-orange-50 text-[#D95A2B] border-orange-200"
              >
                Filtradas
              </Badge>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {empresasFiltradas.length}{' '}
            <span className="text-xs text-slate-400 font-normal">de {todasEmpresas.length}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {empresasFiltradas.filter((e) => e.status === 'ativa').length} ativas no funil
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Volume de Contratos Ativos
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {formatCurrencyBr(totalGeralContratosAtivos)}
          </div>
          <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> Potencial total da listagem
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Distribuição Curva ABC
          </span>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-mono font-bold">
              A: {empresasFiltradas.filter((e) => e.curva === 'A').length}
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs font-mono font-bold">
              B: {empresasFiltradas.filter((e) => e.curva === 'B').length}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-xs font-mono font-bold">
              C: {empresasFiltradas.filter((e) => (e.curva || 'C') === 'C').length}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Classificação por faixa contratual</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Alerta Próximo do Fim
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {
              empresasFiltradas.filter((e) => contratosPorEmpresa.get(e.id)?.hasAlertaVencimento)
                .length
            }
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Empresas com vigência &lt; {diasAlerta} dias
          </p>
        </div>
      </div>
      {/* Painel de Busca Progressiva e Filtros Combináveis */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3.5">
        {/* Barra de Busca Progressiva (Escopo A) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Buscar progressivamente por Razão Social, Fantasia, CNPJ (com ou sem máscara), Cidade ou UF..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm border-slate-300 focus-visible:ring-[#D95A2B]"
            />
            {buscaInput && (
              <button
                type="button"
                onClick={() => {
                  setBuscaInput('')
                  setDebouncedBusca('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Contador de resultados da busca em tempo real */}
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 whitespace-nowrap">
              <span className="font-bold text-[#D95A2B]">{empresasOrdenadas.length}</span>{' '}
              {empresasOrdenadas.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
              className={`h-10 text-xs gap-1.5 ${
                filtrosAvancadosAbertos
                  ? 'border-[#D95A2B] text-[#D95A2B] bg-orange-50/40'
                  : 'text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#D95A2B]" />}
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limparTodosFiltros}
                className="h-10 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1 px-2.5"
                title="Resetar todos os filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Limpar Tudo</span>
              </Button>
            )}
          </div>
        </div>

        {/* Grade de Novos Filtros Combináveis (Escopo B) */}
        {filtrosAvancadosAbertos && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              {/* Filtro: Curva ABC (multi-seleção: A, B, C) */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Curva ABC (Multi)
                </label>
                <div className="flex items-center gap-1.5 h-8">
                  {(['A', 'B', 'C'] as CurvaABC[]).map((letra) => {
                    const isSelected = curvasSelecionadas.includes(letra)
                    return (
                      <button
                        key={letra}
                        type="button"
                        onClick={() => toggleCurva(letra)}
                        className={`flex-1 h-8 rounded text-xs font-bold transition-all border ${
                          isSelected
                            ? letra === 'A'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : letra === 'B'
                                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                                : 'bg-slate-700 text-white border-slate-800 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        title={`Filtrar Curva ${letra}`}
                      >
                        {letra}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Filtro: Situação Cadastral */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Situação Cadastral
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={situacaoCadastral}
                  onChange={(e) => setSituacaoCadastral(e.target.value)}
                >
                  <option value="todas">Todas</option>
                  <option value="ATIVA">Ativa</option>
                  <option value="SUSPENSA">Suspensa</option>
                  <option value="INAPTA">Inapta</option>
                  <option value="BAIXADA">Baixada</option>
                  <option value="NULA">Nula</option>
                </select>
              </div>

              {/* Filtro: Etapa do Funil (9 colunas existentes) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Etapa do Funil
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={etapaFunil}
                  onChange={(e) => setEtapaFunil(e.target.value)}
                >
                  <option value="todas">Todas as Etapas</option>
                  <option value="identificada">Identificada</option>
                  <option value="qualificada">Qualificada</option>
                  <option value="em_cadencia">Em Cadência</option>
                  <option value="em_conversa">Em Conversa</option>
                  <option value="com_proposta_elaborada">Proposta Elaborada</option>
                  <option value="proposta_enviada">Proposta Enviada</option>
                  <option value="parceira">Parceira</option>
                  <option value="nutricao_mensal">Nutrição Mensal</option>
                  <option value="inativa">Inativa</option>
                </select>
              </div>

              {/* Filtro: UF (derivada da base) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  UF
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={uf}
                  onChange={(e) => {
                    setUf(e.target.value)
                    setCidade('todas')
                  }}
                >
                  <option value="todas">Todas as UFs</option>
                  {ufsDisponiveis.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro: Cidade (derivada da base) */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Cidade
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                >
                  <option value="todas">Todas as Cidades</option>
                  {cidadesDisponiveis.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro: Tem Contrato Ativo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Contrato Ativo
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={temContratoAtivo}
                  onChange={(e) => setTemContratoAtivo(e.target.value as any)}
                >
                  <option value="todos">Todos</option>
                  <option value="sim">Sim (Com Contrato)</option>
                  <option value="nao">Não (Sem Contrato)</option>
                </select>
              </div>

              {/* Filtro: Não Contatar */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Não Contatar
                </label>
                <select
                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B] font-medium"
                  value={filtroNaoContatar}
                  onChange={(e) => setFiltroNaoContatar(e.target.value as any)}
                >
                  <option value="excluir">Excluir Bloqueados (Padrão)</option>
                  <option value="todos">Incluir Todos</option>
                  <option value="apenas_bloqueados">Apenas Bloqueados</option>
                </select>
              </div>

              {/* Filtro: Pré-cadastros (Admin e Comercial) */}
              {canEdit && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Pré-cadastros
                  </label>
                  <label className="flex items-center gap-1.5 h-8 px-2 border border-slate-200 rounded bg-white text-xs text-slate-700 cursor-pointer select-none hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={incluirPreCadastros}
                      onChange={(e) => setIncluirPreCadastros(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>Incluir pré-cadastros</span>
                  </label>
                </div>
              )}
            </div>

            {/* Linha secundária de filtros: Responsável & Status Ativa/Inativa */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 text-[11px]">Responsável:</span>
                <select
                  className="h-7 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 text-[11px]">Status no Sistema:</span>
                <select
                  className="h-7 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D95A2B]"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="todas">Todos</option>
                  <option value="ativa">Ativas</option>
                  <option value="inativa">Inativas</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Chips de Filtros Ativos (Escopo C) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">
              Filtros Ativos:
            </span>

            {debouncedBusca.trim() && (
              <Badge
                variant="secondary"
                className="bg-orange-50 text-[#D95A2B] border border-orange-200 text-xs gap-1 font-normal"
              >
                Busca: &ldquo;{debouncedBusca}&rdquo;
                <button
                  type="button"
                  onClick={() => {
                    setBuscaInput('')
                    setDebouncedBusca('')
                  }}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {curvasSelecionadas.length > 0 && (
              <Badge
                variant="secondary"
                className="bg-blue-50 text-blue-800 border border-blue-200 text-xs gap-1 font-normal"
              >
                Curva: {curvasSelecionadas.sort().join(', ')}
                <button
                  type="button"
                  onClick={() => setCurvasSelecionadas([])}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {situacaoCadastral !== 'todas' && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-800 border border-slate-200 text-xs gap-1 font-normal"
              >
                Situação: {situacaoCadastral}
                <button
                  type="button"
                  onClick={() => setSituacaoCadastral('todas')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {etapaFunil !== 'todas' && (
              <Badge
                variant="secondary"
                className="bg-purple-50 text-purple-800 border border-purple-200 text-xs gap-1 font-normal"
              >
                Etapa: {ETAPA_FUNIL_LABELS[etapaFunil as EtapaFunil] || etapaFunil}
                <button
                  type="button"
                  onClick={() => setEtapaFunil('todas')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {uf !== 'todas' && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-800 border border-slate-200 text-xs gap-1 font-normal"
              >
                UF: {uf}
                <button
                  type="button"
                  onClick={() => setUf('todas')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {cidade !== 'todas' && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-800 border border-slate-200 text-xs gap-1 font-normal"
              >
                Cidade: {cidade}
                <button
                  type="button"
                  onClick={() => setCidade('todas')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {temContratoAtivo !== 'todos' && (
              <Badge
                variant="secondary"
                className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs gap-1 font-normal"
              >
                Contrato Ativo: {temContratoAtivo === 'sim' ? 'Sim' : 'Não'}
                <button
                  type="button"
                  onClick={() => setTemContratoAtivo('todos')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {filtroNaoContatar !== 'excluir' && (
              <Badge
                variant="secondary"
                className="bg-red-50 text-red-800 border border-red-200 text-xs gap-1 font-normal"
              >
                Não Contatar:{' '}
                {filtroNaoContatar === 'apenas_bloqueados'
                  ? 'Apenas Bloqueados'
                  : 'Todos (Inclusive Bloqueados)'}
                <button
                  type="button"
                  onClick={() => setFiltroNaoContatar('excluir')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {responsavel !== 'todos' && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-800 border border-slate-200 text-xs gap-1 font-normal"
              >
                Resp: {users.find((u) => u.id === responsavel)?.name || 'Outro'}
                <button
                  type="button"
                  onClick={() => setResponsavel('todos')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {status !== 'todas' && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-800 border border-slate-200 text-xs gap-1 font-normal"
              >
                Status: {status === 'ativa' ? 'Ativas' : 'Inativas'}
                <button
                  type="button"
                  onClick={() => setStatus('todas')}
                  className="hover:text-red-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            <button
              type="button"
              onClick={limparTodosFiltros}
              className="text-xs text-[#D95A2B] hover:underline font-semibold ml-1 cursor-pointer"
            >
              Limpar todos
            </button>
          </div>
        )}
      </div>
      {/* Tabela de Empresas com Ordenação por Coluna e Estado Vazio Orientado */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#D95A2B] mx-auto mb-2" />
            Carregando empresas e contratos...
          </div>
        ) : empresasOrdenadas.length === 0 ? (
          <div className="p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-[#D95A2B] flex items-center justify-center mx-auto shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {hasActiveFilters
                  ? 'Nenhuma empresa corresponde aos filtros'
                  : 'Cadastre sua primeira empresa ou importe uma base'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {hasActiveFilters
                  ? 'Nenhum registro encontrado para a combinação atual de critérios de busca e filtros selecionados.'
                  : 'O sistema GESTÃO G+ está pronto na versão BETA. Comece cadastrando uma empresa contratada por órgãos públicos ou importando uma lista de prospects para acionar o funil comercial.'}
              </p>
            </div>
            {hasActiveFilters ? (
              <div className="pt-2">
                <Button
                  onClick={limparTodosFiltros}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-9 font-semibold shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Limpar filtros
                </Button>
              </div>
            ) : canEdit ? (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <Button
                  onClick={openNewEmpresa}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-9 font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Minha Primeira Empresa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/empresas/importar')}
                  className="text-xs h-9 border-slate-300 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Importar Planilha
                  de Prospects
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th
                    onClick={() => handleSort('razao_social')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Empresa (Razão / Fantasia)</span>
                      {renderSortIndicator('razao_social')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cnpj')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center">
                      <span>CNPJ</span>
                      {renderSortIndicator('cnpj')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cidade')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Cidade / UF</span>
                      {renderSortIndicator('cidade')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('curva')}
                    className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center justify-center">
                      <span>Curva</span>
                      {renderSortIndicator('curva')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('valor_contratos')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center justify-end">
                      <span>Contratos Ativos (R$)</span>
                      {renderSortIndicator('valor_contratos')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('etapa_funil')}
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Etapa do Funil</span>
                      {renderSortIndicator('etapa_funil')}
                    </div>
                  </th>
                  <th className="py-3 px-3">Responsável</th>
                  <th className="py-3 px-2 text-center">Situação</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresasOrdenadas.map((emp) => {
                  const infoContratos = contratosPorEmpresa.get(emp.id) || {
                    totalAtivo: 0,
                    contratos: [],
                    hasAlertaVencimento: false,
                  }
                  const respUser = users.find((u) => u.id === emp.responsavel)
                  const bloqueada = isEmpresaBloqueada(emp)
                  const sitNorm = normalizarSituacaoCadastral(emp.situacao_cadastral)

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => openEditEmpresa(emp)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Nome / Razão */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 text-sm">
                            {emp.nome_fantasia || emp.razao_social}
                          </div>
                          {(emp.is_parceira || emp.etapa_funil === 'parceira') && (
                            <Badge
                              className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                              title="Empresa com selo de Parceira Demandante homologada"
                            >
                              Parceira
                            </Badge>
                          )}
                          {emp.pre_cadastro && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300 font-bold"
                            >
                              Pré-cadastro
                            </Badge>
                          )}
                          {bloqueada && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-red-50 text-red-700 border-red-300 font-bold"
                              title="Consta na lista Não Contatar"
                            >
                              Não contatar
                            </Badge>
                          )}
                        </div>
                        {emp.nome_fantasia && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {emp.razao_social}
                          </div>
                        )}
                        {/* Alerta inline se houver contrato próximo do fim */}
                        {infoContratos.hasAlertaVencimento && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-700 font-bold mt-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Vigência contratual próxima do fim</span>
                          </div>
                        )}
                      </td>

                      {/* CNPJ */}
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {formatCnpj(emp.cnpj) || '—'}
                      </td>

                      {/* Cidade / UF */}
                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-medium text-slate-800">{emp.municipio || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{emp.uf || '—'}</div>
                      </td>

                      {/* Curva */}
                      <td className="py-3 px-2 text-center">
                        <Badge
                          className={`font-mono text-xs font-bold ${
                            emp.curva === 'A'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                              : emp.curva === 'B'
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {emp.curva || 'C'}
                        </Badge>
                      </td>

                      {/* Valor Total de Contratos Ativos */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrencyBr(infoContratos.totalAtivo)}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {infoContratos.contratos.length} contrato(s)
                        </span>
                      </td>

                      {/* Etapa do Funil */}
                      <td className="py-3 px-3">
                        <Badge
                          variant="secondary"
                          className={`text-[11px] font-medium ${
                            emp.etapa_funil === 'parceira'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : emp.etapa_funil === 'identificada'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ETAPA_FUNIL_LABELS[emp.etapa_funil as EtapaFunil] ||
                            emp.etapa_funil ||
                            'Identificada'}
                        </Badge>
                      </td>

                      {/* Responsável */}
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]">
                        {respUser?.name || 'Não atribuído'}
                      </td>

                      {/* Situação Cadastral */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            sitNorm === 'ATIVA'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {sitNorm}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            emp.status === 'ativa'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {emp.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-[#D95A2B] hover:text-[#C44E22] hover:bg-orange-50"
                        >
                          Abrir <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal de Detalhe e Cadastro da Empresa */}
      <EmpresaDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        empresa={selectedEmpresa}
        users={users}
        diasAlerta={diasAlerta}
        readOnly={isReadOnly}
        onSuccess={loadData}
        onCreatedEmpresaSelect={(alvo) => {
          setSelectedEmpresa(alvo)
          setTodasEmpresas((prev) => [alvo, ...prev.filter((e) => e.id !== alvo.id)])
        }}
        onEmpresaUpdate={(updated) => {
          setSelectedEmpresa(updated)
          setTodasEmpresas((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
          loadData()
        }}
      />{' '}
    </div>
  )
}
