import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ClientePfRecord, PropostaRecord } from '@/types'
import { clientesPfService, ClientePfComMetricas } from '@/services/clientesPf'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Search,
  Plus,
  ShieldCheck,
  DollarSign,
  Briefcase,
  ChevronRight,
  Filter,
  Download,
  UserCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { exportService } from '@/services/exportService'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCpf, formatPhoneBr } from '@/lib/cnpj'
import { ModalCriarClientePf } from '@/components/clientesPf/ModalCriarClientePf'
import { ClientePfDetailModal } from '@/components/clientesPf/ClientePfDetailModal'
import { parceirosService } from '@/services/parceiros'

export function ClientesPfPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClientePfComMetricas[]>([])
  const [propostas, setPropostas] = useState<PropostaRecord[]>([])

  // Busca e filtro
  const [busca, setBusca] = useState('')
  const [filtroBaseLegal, setFiltroBaseLegal] = useState<string>('todos')

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePfRecord | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Permissões: Admin e Comercial criam/editam; Financeiro e Gestor leem; Executor sem acesso
  const canWrite = user?.role === 'admin' || user?.role === 'comercial'

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [list, props] = await Promise.all([
        clientesPfService.listComMetricas(),
        parceirosService.listPropostas(),
      ])
      setClientes(list)
      setPropostas(props)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Métricas do topo
  const metricas = useMemo(() => {
    const totalClientes = clientes.length
    const receitaTotal = clientes.reduce((acc, c) => acc + c.receitaAcumulada, 0)
    const totalProjetos = clientes.reduce((acc, c) => acc + c.totalProjetos, 0)
    const comLgpd = clientes.filter((c) => c.consentimento_lgpd).length

    return {
      totalClientes,
      receitaTotal,
      totalProjetos,
      comLgpd,
    }
  }, [clientes])

  // Filtragem da lista
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const termo = busca.toLowerCase().trim()
      if (termo) {
        const matchNome = (c.nome || '').toLowerCase().includes(termo)
        const matchCpf = (c.cpf || '').includes(termo)
        const matchEmail = (c.email || '').toLowerCase().includes(termo)
        if (!matchNome && !matchCpf && !matchEmail) return false
      }

      if (filtroBaseLegal !== 'todos' && c.base_legal !== filtroBaseLegal) {
        return false
      }

      return true
    })
  }, [clientes, busca, filtroBaseLegal])

  const abrirDetalhe = (c: ClientePfRecord) => {
    setClienteSelecionado(c)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clientes Pessoa Física (PF)
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Etapa 6
            </Badge>
            {!canWrite && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
                Somente Leitura
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de contratantes pessoa física, laudos periciais e vistorias técnicas com
            validação estrita de CPF e registro auditado de conformidade LGPD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (clientesFiltrados.length === 0) {
                toast({
                  title: 'Sem clientes PF para exportar',
                  description: 'A lista atual de clientes PF está vazia.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `clientes_pf_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'clientes_pf',
                  descricao:
                    'Exportação de Clientes Pessoa Física com Base Legal e Consentimento LGPD',
                  filtros: {
                    base_legal: filtroBaseLegal,
                    busca: busca || undefined,
                  },
                  columns: [
                    { header: 'Nome do Cliente', accessor: (c) => c.nome },
                    { header: 'CPF', accessor: (c) => formatCpf(c.cpf) },
                    { header: 'E-mail', accessor: (c) => c.email || '' },
                    { header: 'Telefone', accessor: (c) => formatPhoneBr(c.telefone) || '' },
                    { header: 'Endereço', accessor: (c) => c.endereco || '' },
                    {
                      header: 'Base Legal LGPD',
                      accessor: (c) => c.base_legal?.replace('_', ' ') || 'consentimento',
                    },
                    {
                      header: 'Data Consentimento LGPD',
                      accessor: (c) => formatDateBr(c.data_consentimento),
                    },
                    {
                      header: 'Receita Acumulada (R$)',
                      accessor: (c) => formatCurrencyBr(c.receitaAcumulada),
                    },
                    { header: 'Nº Projetos', accessor: (c) => c.totalProjetos },
                    { header: 'Nº Propostas', accessor: (c) => c.totalPropostas },
                  ],
                  data: clientesFiltrados,
                })
                toast({
                  title: 'Clientes PF Exportados',
                  description: `${clientesFiltrados.length} cliente(s) PF exportado(s). Auditoria registrada em conformidade LGPD.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar clientes PF',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs gap-1.5 shrink-0 text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          {canWrite && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente PF
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas Principais (B) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Total Clientes PF</span>
              <User className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{metricas.totalClientes}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metricas.comLgpd} com consentimento LGPD ativo
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Receita Acumulada</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrencyBr(metricas.receitaTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Serviços de engenharia contratados
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Nº de Projetos</span>
              <Briefcase className="w-4 h-4 text-indigo-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{metricas.totalProjetos}</div>
            <div className="text-[11px] text-slate-500 mt-1">Propostas aceitas e em execução</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Conformidade LGPD</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">100%</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Base legal e consentimento auditados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por nome, CPF ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="text-xs h-8 pl-8"
              />
            </div>

            <div>
              <select
                value={filtroBaseLegal}
                onChange={(e) => setFiltroBaseLegal(e.target.value)}
                className="w-full text-xs h-8 border border-slate-200 rounded px-2.5 bg-white text-slate-700"
              >
                <option value="todos">Todas as Bases Legais</option>
                <option value="consentimento">Consentimento do Titular</option>
                <option value="execucao_contrato">Execução de Contrato</option>
                <option value="obrigacao_legal">Obrigação Legal</option>
                <option value="legitimo_interesse">Legítimo Interesse</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Clientes PF */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Clientes PF Cadastrados ({clientesFiltrados.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Clique em um cliente para visualizar o histórico de propostas, dados LGPD e linha do
              tempo de auditoria.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nome do Cliente</th>
                  <th className="py-3 px-3">CPF</th>
                  <th className="py-3 px-3">Contato</th>
                  <th className="py-3 px-3">Base Legal LGPD</th>
                  <th className="py-3 px-3 text-right">Receita Acumulada</th>
                  <th className="py-3 px-3 text-center">Nº Projetos</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      Carregando clientes PF...
                    </td>
                  </tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto">
                          <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {busca || filtroBaseLegal !== 'todos'
                              ? 'Nenhum cliente encontrado com os filtros'
                              : 'Cadastre o primeiro Cliente Pessoa Física'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {busca || filtroBaseLegal !== 'todos'
                              ? 'Tente ajustar sua busca ou selecionar outra base legal.'
                              : 'Atenda clientes diretos de engenharia (projetos residenciais, laudos ou vistorias particulares) com conformidade LGPD e consentimento auditado.'}
                          </p>
                        </div>
                        {canWrite && (
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={() => setShowCreateModal(true)}
                              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                            >
                              <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Cliente PF
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((cli) => (
                    <tr
                      key={cli.id}
                      onClick={() => abrirDetalhe(cli)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 hover:text-blue-600">
                          {cli.nome}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cli.endereco || 'Endereço não informado'}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-700">{formatCpf(cli.cpf)}</td>

                      <td className="py-3 px-3 text-slate-600">
                        <div>{cli.email || '-'}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatPhoneBr(cli.telefone) || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"
                        >
                          {cli.base_legal?.replace('_', ' ') || 'consentimento'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Desde: {formatDateBr(cli.data_consentimento)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyBr(cli.receitaAcumulada)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold text-slate-800">{cli.totalProjetos}</span>
                        <span className="text-[10px] text-slate-400 block">
                          ({cli.totalPropostas} prop.)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation()
                            abrirDetalhe(cli)
                          }}
                        >
                          Detalhes
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <ModalCriarClientePf
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={carregarDados}
      />

      <ClientePfDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        cliente={clienteSelecionado}
        propostas={propostas}
        onClienteUpdated={() => carregarDados()}
      />
    </div>
  )
}
