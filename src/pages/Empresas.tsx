import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { EmpresaRecord, UserRecord, ContratoRecord, ETAPA_FUNIL_LABELS, EtapaFunil } from '@/types'
import { empresasService, EmpresaFilters } from '@/services/empresas'
import { contratosService } from '@/services/contratos'
import { usersService } from '@/services/users'
import { parametrosService } from '@/services/parametros'
import { EmpresaDetailModal } from '@/components/empresas/EmpresaDetailModal'
import { formatCurrencyBr } from '@/lib/formatters'
import { formatCnpj, cleanPhoneForWa } from '@/lib/cnpj'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Layers,
  Mail,
  Phone,
  Globe,
  Instagram,
  Linkedin,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Download,
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
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [allContratos, setAllContratos] = useState<ContratoRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [diasAlerta, setDiasAlerta] = useState(90)

  // Filtros
  const [busca, setBusca] = useState('')
  const [etapaFunil, setEtapaFunil] = useState('todas')
  const [curva, setCurva] = useState('todas')
  const [uf, setUf] = useState('todas')
  const [responsavel, setResponsavel] = useState('todos')
  const [status, setStatus] = useState('todas')

  // Modal de Detalhe / Criação
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaRecord | null>(null)

  // Carregar dados iniciais
  const loadData = async () => {
    setLoading(true)
    try {
      const [empList, contList, userList, paramList] = await Promise.all([
        empresasService.list({
          busca: busca.trim() || undefined,
          etapa_funil: etapaFunil !== 'todas' ? etapaFunil : undefined,
          curva: curva !== 'todas' ? curva : undefined,
          uf: uf !== 'todas' ? uf : undefined,
          responsavel: responsavel !== 'todos' ? responsavel : undefined,
          status: status !== 'todas' ? status : undefined,
        }),
        contratosService.listAll(),
        usersService.list(),
        parametrosService.list(),
      ])

      setEmpresas(empList)
      setAllContratos(contList)
      setUsers(userList)

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
  }, [etapaFunil, curva, uf, responsavel, status])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadData()
  }

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

  // Lista de UFs únicas para o filtro
  const ufsDisponiveis = useMemo(() => {
    const setUfs = new Set<string>()
    empresas.forEach((e) => {
      if (e.uf) setUfs.add(e.uf.toUpperCase())
    })
    return Array.from(setUfs).sort()
  }, [empresas])

  const [exportando, setExportando] = useState(false)

  const handleExportarCsv = async () => {
    if (empresas.length === 0) {
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
        descricao: 'Exportação da lista filtrada de empresas e contratos',
        filtros: {
          busca: busca || undefined,
          etapa_funil: etapaFunil,
          curva,
          uf,
          responsavel,
          status,
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
            accessor: (e) => ETAPA_FUNIL_LABELS[e.etapa_funil as EtapaFunil] || e.etapa_funil,
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
          { header: 'Situação Cadastral', accessor: (e) => e.situacao_cadastral || 'Ativa' },
          { header: 'Status no Funil', accessor: (e) => e.status || 'ativa' },
          { header: 'E-mail', accessor: (e) => e.email || '' },
          {
            header: 'Telefone',
            accessor: (e) => e.telefones?.[0]?.numero || e.telefone || '—',
          },
        ],
        data: empresas,
      })

      toast({
        title: 'Exportação Concluída',
        description: `${empresas.length} empresa(s) exportada(s) para CSV com sucesso. Auditoria registrada no servidor.`,
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

  // Totais de topo
  const totalGeralContratosAtivos = useMemo(() => {
    return Array.from(contratosPorEmpresa.values()).reduce((acc, curr) => acc + curr.totalAtivo, 0)
  }, [contratosPorEmpresa])

  return (
    <div className="space-y-6">
      {/* Topo da Tela com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
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
            Mapeamento de empresas contratadas por órgãos públicos, apuração de contratos ativos e
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
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-xs h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Empresa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Total de Empresas
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{empresas.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {empresas.filter((e) => e.status === 'ativa').length} ativas no funil
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
            <TrendingUp className="w-3.5 h-3.5" /> Potencial total identificado
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Distribuição Curva ABC
          </span>
          <div className="flex items-center gap-3 mt-2">
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-mono font-bold">
              A: {empresas.filter((e) => e.curva === 'A').length}
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs font-mono font-bold">
              B: {empresas.filter((e) => e.curva === 'B').length}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-xs font-mono font-bold">
              C: {empresas.filter((e) => e.curva === 'C').length}
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
              Array.from(contratosPorEmpresa.values()).filter((item) => item.hasAlertaVencimento)
                .length
            }
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Empresas com vigência &lt; {diasAlerta} dias
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ ou Município..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" className="shrink-0">
            Filtrar
          </Button>
          {busca && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBusca('')
                setTimeout(() => loadData(), 50)
              }}
              className="shrink-0 text-xs text-slate-500"
            >
              Limpar Busca
            </Button>
          )}
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* Filtro Etapa Funil */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Etapa do Funil
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* Filtro Curva ABC */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Curva
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
              value={curva}
              onChange={(e) => setCurva(e.target.value)}
            >
              <option value="todas">Todas as Curvas</option>
              <option value="A">Curva A (Pareto ~80% índice acumulado)</option>
              <option value="B">Curva B (Pareto 80%–95% índice acumulado)</option>
              <option value="C">Curva C (Restante da base)</option>
            </select>
          </div>

          {/* Filtro UF */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">UF</label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
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

          {/* Filtro Status */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Status
            </label>
            <select
              className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      {/* Tabela de Empresas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mx-auto mb-2" />
            Carregando empresas e contratos...
          </div>
        ) : empresas.length === 0 ? (
          <div className="p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-[#D95A2B] flex items-center justify-center mx-auto shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {busca ||
                etapaFunil !== 'todas' ||
                curva !== 'todas' ||
                uf !== 'todas' ||
                status !== 'todas'
                  ? 'Nenhuma empresa encontrada com estes filtros'
                  : 'Cadastre sua primeira empresa ou importe uma base'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {busca ||
                etapaFunil !== 'todas' ||
                curva !== 'todas' ||
                uf !== 'todas' ||
                status !== 'todas'
                  ? 'Tente limpar os filtros ou realizar uma busca mais ampla para localizar registros.'
                  : 'O sistema GESTÃO G+ está pronto na versão BETA. Comece cadastrando uma empresa contratada por órgãos públicos ou importando uma lista de prospects para acionar o funil comercial.'}
              </p>
            </div>
            {canEdit && (
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
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Empresa (Razão / Fantasia)</th>
                  <th className="py-3 px-3">CNPJ</th>
                  <th className="py-3 px-2 text-center">UF</th>
                  <th className="py-3 px-2 text-center">Curva</th>
                  <th className="py-3 px-4 text-right">Contratos Ativos (R$)</th>
                  <th className="py-3 px-3">Etapa do Funil</th>
                  <th className="py-3 px-3">Responsável</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.map((emp) => {
                  const infoContratos = contratosPorEmpresa.get(emp.id) || {
                    totalAtivo: 0,
                    contratos: [],
                    hasAlertaVencimento: false,
                  }
                  const respUser = users.find((u) => u.id === emp.responsavel)

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => openEditEmpresa(emp)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Nome / Razão */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {emp.nome_fantasia || emp.razao_social}
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

                      {/* UF */}
                      <td className="py-3 px-2 text-center">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold">
                          {emp.uf || '—'}
                        </Badge>
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

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
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
                          className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
        onCreatedEmpresaSelect={(created) => {
          setSelectedEmpresa(created)
          loadData()
        }}
        onEmpresaUpdate={(updated) => setSelectedEmpresa(updated)}
      />
    </div>
  )
}
