import React, { useState, useEffect } from 'react'
import {
  PrestadorRecord,
  TipoPrestador,
  StatusPrestador,
  ProfissionalPrestadorRecord,
  ContratoMestreRecord,
} from '@/types'
import {
  prestadoresService,
  CreatePrestadorData,
  CreateProfissionalData,
  CreateContratoMestreData,
} from '@/services/prestadores'
import { formatDateBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { openProtectedFile } from '@/lib/pocketbase/files'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  Plus,
  Search,
  Star,
  AlertTriangle,
  Ban,
  CheckCircle,
  Download,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  FileCheck,
  Building,
  User,
  ShieldCheck,
  Briefcase,
  Layers,
  Phone,
  Mail,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { exportService } from '@/services/exportService'

export const PrestadoresPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [prestadores, setPrestadores] = useState<PrestadorRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modais de Prestador
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [prestadorEdicao, setPrestadorEdicao] = useState<PrestadorRecord | null>(null)

  const [formData, setFormData] = useState<CreatePrestadorData>({
    tipo: 'pf_externo',
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    conselho: 'CREA',
    numero_registro_conselho: '',
    validade_registro_conselho: '',
    disciplinas: '',
    regiao: '',
    capacidade_simultanea: 3,
    status: 'ativo',
  })

  // Modal de Profissionais (PJ)
  const [modalProfissionaisOpen, setModalProfissionaisOpen] = useState(false)
  const [prestadorSelecionado, setPrestadorSelecionado] = useState<PrestadorRecord | null>(null)
  const [profissionais, setProfissionais] = useState<ProfissionalPrestadorRecord[]>([])
  const [carregandoProf, setCarregandoProf] = useState(false)
  const [novoProfNome, setNovoProfNome] = useState('')
  const [novoProfConselho, setNovoProfConselho] = useState('')
  const [novoProfNumero, setNovoProfNumero] = useState('')
  const [novoProfValidade, setNovoProfValidade] = useState('')
  const [novoProfCargo, setNovoProfCargo] = useState('')

  // Modal de Contrato-Mestre
  const [modalContratoMestreOpen, setModalContratoMestreOpen] = useState(false)
  const [contratosMestre, setContratosMestre] = useState<ContratoMestreRecord[]>([])
  const [carregandoCm, setCarregandoCm] = useState(false)
  const [assinandoGmais, setAssinandoGmais] = useState(false)

  // Modal de Suspensão
  const [modalSuspenderOpen, setModalSuspenderOpen] = useState(false)
  const [motivoSuspensao, setMotivoSuspensao] = useState('')

  const canEdit = !!(user && (user.role === 'admin' || user.role === 'gestor'))
  const isAdmin = !!(user && user.role === 'admin')

  const carregarPrestadores = async () => {
    setCarregando(true)
    try {
      const data = await prestadoresService.list()
      setPrestadores(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar prestadores',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarPrestadores()
  }, [])

  const abrirModalCriar = () => {
    setPrestadorEdicao(null)
    setFormData({
      tipo: 'pf_externo',
      nome: '',
      cpf_cnpj: '',
      email: '',
      telefone: '',
      conselho: 'CREA',
      numero_registro_conselho: '',
      validade_registro_conselho: '',
      disciplinas: '',
      regiao: '',
      capacidade_simultanea: 3,
      status: 'ativo',
    })
    setModalNovoOpen(true)
  }

  const abrirModalEditar = (p: PrestadorRecord) => {
    setPrestadorEdicao(p)
    setFormData({
      tipo: p.tipo,
      nome: p.nome,
      cpf_cnpj: p.cpf_cnpj || '',
      email: p.email,
      telefone: p.telefone || '',
      conselho: p.conselho || 'CREA',
      numero_registro_conselho: p.numero_registro_conselho || '',
      validade_registro_conselho: p.validade_registro_conselho
        ? p.validade_registro_conselho.substring(0, 10)
        : '',
      disciplinas: p.disciplinas || '',
      regiao: p.regiao || '',
      capacidade_simultanea: p.capacidade_simultanea || 3,
      status: p.status,
    })
    setModalNovoOpen(true)
  }

  const handleSalvarPrestador = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      if (prestadorEdicao) {
        await prestadoresService.update(prestadorEdicao.id, formData)
        toast({ title: 'Prestador atualizado com sucesso!' })
      } else {
        await prestadoresService.create(formData)
        toast({ title: 'Prestador cadastrado com sucesso!' })
      }
      setModalNovoOpen(false)
      carregarPrestadores()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar prestador',
        description: err.message || 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const abrirProfissionais = async (p: PrestadorRecord) => {
    setPrestadorSelecionado(p)
    setModalProfissionaisOpen(true)
    setCarregandoProf(true)
    try {
      const lista = await prestadoresService.listProfissionais(p.id)
      setProfissionais(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar profissionais',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregandoProf(false)
    }
  }

  const handleAdicionarProfissional = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prestadorSelecionado || !novoProfNome.trim()) return
    try {
      await prestadoresService.createProfissional({
        prestador: prestadorSelecionado.id,
        nome: novoProfNome.trim(),
        conselho: novoProfConselho.trim(),
        numero: novoProfNumero.trim(),
        validade: novoProfValidade || undefined,
        cargo_funcao: novoProfCargo.trim(),
        ativo: true,
      })
      toast({ title: 'Profissional vinculado!' })
      setNovoProfNome('')
      setNovoProfConselho('')
      setNovoProfNumero('')
      setNovoProfValidade('')
      setNovoProfCargo('')
      const lista = await prestadoresService.listProfissionais(prestadorSelecionado.id)
      setProfissionais(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao vincular profissional',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const abrirContratoMestre = async (p: PrestadorRecord) => {
    setPrestadorSelecionado(p)
    setModalContratoMestreOpen(true)
    setCarregandoCm(true)
    try {
      const lista = await prestadoresService.listContratosMestre(p.id)
      setContratosMestre(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar contrato-mestre',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregandoCm(false)
    }
  }

  const handleGerarContratoMestre = async () => {
    if (!prestadorSelecionado) return
    try {
      await prestadoresService.createContratoMestre({
        prestador: prestadorSelecionado.id,
        minuta_texto: `CONTRATO-MESTRE DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS E TERMO DE CONFIDENCIALIDADE (NDA) firmado com ${prestadorSelecionado.nome}.`,
        clausulas_nda:
          '1. Confidencialidade irrestrita das informações técnicas, projetos e clientes da G+ Engenharia.\n2. Vedações de contato direto ou aliciamento dos clientes da G+.\n3. Obrigatoriedade de emissão de Ordens de Serviço formais para cada trabalho.',
      })
      toast({ title: 'Contrato-Mestre gerado com sucesso!' })
      const lista = await prestadoresService.listContratosMestre(prestadorSelecionado.id)
      setContratosMestre(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar Contrato-Mestre',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleAssinarGmais = async (cmId: string) => {
    setAssinandoGmais(true)
    try {
      await prestadoresService.assinarContratoMestreGmais(cmId)
      toast({
        title: 'Assinado pela G+ Engenharia!',
        description: 'Liberado para o prestador assinar via token/portal.',
      })
      if (prestadorSelecionado) {
        const lista = await prestadoresService.listContratosMestre(prestadorSelecionado.id)
        setContratosMestre(lista)
      }
    } catch (err: any) {
      toast({
        title: 'Erro na assinatura da G+',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setAssinandoGmais(false)
    }
  }

  const handleSuspenderPrestador = async () => {
    if (!prestadorSelecionado || !motivoSuspensao.trim()) return
    try {
      await prestadoresService.suspender(prestadorSelecionado.id, motivoSuspensao.trim())
      toast({
        title: 'Prestador suspenso',
        description: 'Novas Ordens de Serviço estão bloqueadas para este cadastro.',
      })
      setModalSuspenderOpen(false)
      setMotivoSuspensao('')
      carregarPrestadores()
    } catch (err: any) {
      toast({
        title: 'Erro ao suspender',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleReativarPrestador = async (p: PrestadorRecord) => {
    try {
      await prestadoresService.reativar(p.id)
      toast({ title: 'Prestador reativado!' })
      carregarPrestadores()
    } catch (err: any) {
      toast({
        title: 'Erro ao reativar',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const prestadoresFiltrados = prestadores.filter((p) => {
    const matchBusca =
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.cpf_cnpj && p.cpf_cnpj.toLowerCase().includes(busca.toLowerCase())) ||
      (p.email && p.email.toLowerCase().includes(busca.toLowerCase())) ||
      (p.disciplinas && p.disciplinas.toLowerCase().includes(busca.toLowerCase()))

    const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus

    return matchBusca && matchTipo && matchStatus
  })

  const getTipoBadge = (tipo: TipoPrestador) => {
    switch (tipo) {
      case 'interno':
        return (
          <Badge className="bg-sky-600 text-white hover:bg-sky-700">
            <User className="w-3 h-3 mr-1" />
            Equipe Interna
          </Badge>
        )
      case 'pf_externo':
        return (
          <Badge className="bg-amber-600 text-white hover:bg-amber-700">
            <User className="w-3 h-3 mr-1" />
            PF Externo
          </Badge>
        )
      case 'pj_externo':
        return (
          <Badge className="bg-purple-600 text-white hover:bg-purple-700">
            <Building className="w-3 h-3 mr-1" />
            PJ Externo
          </Badge>
        )
    }
  }

  const getStatusBadge = (status: StatusPrestador) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-emerald-600 text-white">Ativo</Badge>
      case 'pendente':
        return <Badge className="bg-amber-500 text-white">Pendente</Badge>
      case 'suspenso':
        return <Badge className="bg-rose-600 text-white">Suspenso</Badge>
      case 'inativo':
        return <Badge variant="secondary">Inativo</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Prestadores de Serviço
            </h1>
            <Badge
              variant="outline"
              className="font-mono text-xs text-[#D95A2B] border-[#D95A2B]/30"
            >
              Conceito Único G+
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão integrada de Equipe Interna, Profissionais Autônomos (PF) e Empresas
            Terceirizadas (PJ) com Contratos-Mestre, NDA e Responsáveis Técnicos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (prestadoresFiltrados.length === 0) {
                toast({ title: 'Sem registros para exportar', variant: 'destructive' })
                return
              }
              await exportService.exportarParaCsv({
                filename: `prestadores_${new Date().toISOString().slice(0, 10)}.csv`,
                tela: 'prestadores',
                descricao: 'Exportação de prestadores de serviços técnicos G+',
                filtros: { tipo: filtroTipo, status: filtroStatus, busca: busca || undefined },
                columns: [
                  { header: 'Tipo', accessor: (p) => p.tipo },
                  { header: 'Nome', accessor: (p) => p.nome },
                  { header: 'CPF/CNPJ', accessor: (p) => p.cpf_cnpj || '' },
                  { header: 'E-mail', accessor: (p) => p.email },
                  { header: 'Telefone', accessor: (p) => p.telefone || '' },
                  { header: 'Conselho', accessor: (p) => p.conselho || '' },
                  { header: 'Nº Registro', accessor: (p) => p.numero_registro_conselho || '' },
                  { header: 'Disciplinas', accessor: (p) => p.disciplinas || '' },
                  { header: 'Status', accessor: (p) => p.status },
                  { header: 'Nota Geral', accessor: (p) => p.nota_geral || 5.0 },
                ],
                data: prestadoresFiltrados,
              })
            }}
            className="text-xs"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {canEdit && (
            <Button
              onClick={abrirModalCriar}
              className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Prestador
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Cadastrado</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{prestadores.length}</div>
          <span className="text-[11px] text-slate-400">Prestadores mapeados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Equipe Interna</span>
            <User className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-2">
            {prestadores.filter((p) => p.tipo === 'interno').length}
          </div>
          <span className="text-[11px] text-slate-400">Engenharia própria</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Externos Ativos</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {prestadores.filter((p) => p.tipo !== 'interno' && p.status === 'ativo').length}
          </div>
          <span className="text-[11px] text-slate-400">PF e PJ homologados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Suspensos</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {prestadores.filter((p) => p.status === 'suspenso').length}
          </div>
          <span className="text-[11px] text-slate-400">Com bloqueio de OS</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ, e-mail ou disciplina..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="w-40">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Tipo de prestador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="interno">Equipe Interna</SelectItem>
              <SelectItem value="pf_externo">PF Externo</SelectItem>
              <SelectItem value="pj_externo">PJ Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-36">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Prestadores */}
      {carregando ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
        </div>
      ) : prestadoresFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Nenhum prestador encontrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Ajuste os filtros ou cadastre um novo prestador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prestadoresFiltrados.map((p) => {
            const isInterno = p.tipo === 'interno'
            const isPj = p.tipo === 'pj_externo'

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 text-sm leading-tight">
                        {p.nome}
                      </span>
                      {p.cpf_cnpj && (
                        <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {p.cpf_cnpj}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(p.status)}
                  </div>

                  <div className="mb-4">{getTipoBadge(p.tipo)}</div>

                  {/* Desempenho e Tendência */}
                  <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span className="font-semibold text-slate-800">
                        {p.nota_geral ? p.nota_geral.toFixed(1) : '5.0'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({p.total_avaliacoes || 0} avaliações)
                      </span>
                    </div>

                    {/* Selo de Tendência na Ficha do Prestador */}
                    {p.total_avaliacoes && p.total_avaliacoes >= 2 ? (
                      (p.nota_geral || 5) >= 4.5 ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1 py-0 h-5"
                          title="Tendência: Melhorou / Alto desempenho"
                        >
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          Melhorou
                        </Badge>
                      ) : (p.nota_geral || 5) < 3.5 ? (
                        <Badge
                          variant="outline"
                          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1 py-0 h-5"
                          title="Tendência: Piorou / Sob atenção técnica"
                        >
                          <TrendingDown className="w-3 h-3 text-rose-600" />
                          Piorou
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] gap-1 py-0 h-5"
                          title="Tendência: Desempenho Estável"
                        >
                          <Minus className="w-3 h-3 text-slate-500" />
                          Estável
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-500 border-slate-200 text-[10px] gap-1 py-0 h-5"
                        title="Tendência: Estável / Inicial"
                      >
                        <Minus className="w-3 h-3 text-slate-400" />
                        Estável
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                    {p.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{p.telefone}</span>
                      </div>
                    )}
                    {p.conselho && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {p.conselho}{' '}
                          {p.numero_registro_conselho && `• ${p.numero_registro_conselho}`}
                        </span>
                      </div>
                    )}
                    {p.disciplinas && (
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.disciplinas}</span>
                      </div>
                    )}
                  </div>

                  {p.status === 'suspenso' && p.motivo_suspensao && (
                    <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700">
                      <strong>Motivo da suspensão:</strong> {p.motivo_suspensao}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Botão de Profissionais para PJ */}
                    {isPj && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirProfissionais(p)}
                        className="text-[11px] h-7 px-2"
                        title="Profissionais vinculados a esta PJ"
                      >
                        <Users className="w-3 h-3 mr-1 text-purple-600" />
                        Equipe PJ
                      </Button>
                    )}

                    {/* Botão Contrato-Mestre para Externos */}
                    {!isInterno && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirContratoMestre(p)}
                        className="text-[11px] h-7 px-2"
                        title="Contrato-Mestre e Termo de Confidencialidade (NDA)"
                      >
                        <FileCheck className="w-3 h-3 mr-1 text-[#D95A2B]" />
                        Contrato-Mestre
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => abrirModalEditar(p)}
                        className="h-7 w-7 text-slate-500 hover:text-slate-800"
                        title="Editar prestador"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {canEdit && p.status === 'ativo' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setPrestadorSelecionado(p)
                          setModalSuspenderOpen(true)
                        }}
                        className="h-7 w-7 text-rose-600 hover:text-rose-800"
                        title="Suspender prestador"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {canEdit && p.status === 'suspenso' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleReativarPrestador(p)}
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-800"
                        title="Reativar prestador"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar/Editar Prestador */}
      <Dialog open={modalNovoOpen} onOpenChange={setModalNovoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{prestadorEdicao ? 'Editar Prestador' : 'Novo Prestador'}</DialogTitle>
            <DialogDescription>
              Selecione o tipo de prestador (Interno, PF Externo ou PJ Externo) e preencha os dados
              técnicos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarPrestador} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Tipo de Prestador *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(val: any) => setFormData({ ...formData, tipo: val })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Equipe Técnica Interna G+</SelectItem>
                    <SelectItem value="pf_externo">Pessoa Física (PF) Externo</SelectItem>
                    <SelectItem value="pj_externo">Pessoa Jurídica (PJ) Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label className="text-xs">
                  {formData.tipo === 'pj_externo'
                    ? 'Razão Social / Nome da Empresa *'
                    : 'Nome Completo *'}
                </Label>
                <Input
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder={
                    formData.tipo === 'pj_externo'
                      ? 'Ex.: Delta Engenharia e Projetos LTDA'
                      : 'Ex.: Carlos Eduardo Mendes'
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">{formData.tipo === 'pj_externo' ? 'CNPJ' : 'CPF'}</Label>
                <Input
                  value={formData.cpf_cnpj || ''}
                  onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  placeholder={
                    formData.tipo === 'pj_externo' ? '00.000.000/0000-00' : '000.000.000-00'
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">E-mail de Contato *</Label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@prestador.com"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="+55 (88) 99999-9999"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Conselho de Classe</Label>
                <Input
                  value={formData.conselho || ''}
                  onChange={(e) => setFormData({ ...formData, conselho: e.target.value })}
                  placeholder="CREA, CAU, CFT..."
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Nº Registro no Conselho</Label>
                <Input
                  value={formData.numero_registro_conselho || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, numero_registro_conselho: e.target.value })
                  }
                  placeholder="Ex.: CREA-CE 123456"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Validade do Registro</Label>
                <Input
                  type="date"
                  value={formData.validade_registro_conselho || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, validade_registro_conselho: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Disciplinas / Especialidades</Label>
                <Input
                  value={formData.disciplinas || ''}
                  onChange={(e) => setFormData({ ...formData, disciplinas: e.target.value })}
                  placeholder="Ex.: Estrutural, Hidráulico, Elétrico, Geotecnia"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Prestador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Profissionais da PJ */}
      <Dialog open={modalProfissionaisOpen} onOpenChange={setModalProfissionaisOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              Equipe Técnica PJ: {prestadorSelecionado?.nome}
            </DialogTitle>
            <DialogDescription>
              Engenheiros e arquitetos vinculados a esta empresa terceirizada com seus registros de
              classe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Form de Adição */}
            {canEdit && (
              <form
                onSubmit={handleAdicionarProfissional}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
              >
                <span className="text-xs font-semibold text-slate-700 block">
                  Vincular Novo Profissional
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Input
                    placeholder="Nome completo *"
                    value={novoProfNome}
                    onChange={(e) => setNovoProfNome(e.target.value)}
                    className="text-xs"
                    required
                  />
                  <Input
                    placeholder="Conselho (ex. CREA)"
                    value={novoProfConselho}
                    onChange={(e) => setNovoProfConselho(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Nº Registro"
                    value={novoProfNumero}
                    onChange={(e) => setNovoProfNumero(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    type="date"
                    value={novoProfValidade}
                    onChange={(e) => setNovoProfValidade(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <Input
                    placeholder="Cargo / Função (ex.: Resp. Técnico Estrutural)"
                    value={novoProfCargo}
                    onChange={(e) => setNovoProfCargo(e.target.value)}
                    className="text-xs max-w-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </form>
            )}

            {/* Lista */}
            {carregandoProf ? (
              <div className="flex justify-center p-6">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : profissionais.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum profissional vinculado a este prestador ainda.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {profissionais.map((prof) => (
                  <div key={prof.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{prof.nome}</span>
                      {prof.cargo_funcao && (
                        <span className="text-slate-500 ml-2">({prof.cargo_funcao})</span>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {prof.conselho} {prof.numero && `• Nº ${prof.numero}`}
                        {prof.validade && ` • Validade: ${formatDateBr(prof.validade)}`}
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm(`Remover ${prof.nome}?`)) {
                            await prestadoresService.deleteProfissional(prof.id)
                            const lista = await prestadoresService.listProfissionais(
                              prestadorSelecionado!.id,
                            )
                            setProfissionais(lista)
                          }
                        }}
                        className="h-6 w-6 text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Contrato-Mestre e NDA */}
      <Dialog open={modalContratoMestreOpen} onOpenChange={setModalContratoMestreOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#D95A2B]" />
              Contrato-Mestre & NDA: {prestadorSelecionado?.nome}
            </DialogTitle>
            <DialogDescription>
              Instrumento jurídico assinado uma única vez com o prestador externo antes de qualquer
              OS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 font-medium">Contratos Mestre Emitidos</span>
              {isAdmin && contratosMestre.length === 0 && (
                <Button
                  size="sm"
                  onClick={handleGerarContratoMestre}
                  className="text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Gerar Contrato-Mestre
                </Button>
              )}
            </div>

            {carregandoCm ? (
              <div className="flex justify-center p-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
              </div>
            ) : contratosMestre.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-lg text-xs text-slate-500">
                Nenhum Contrato-Mestre gerado para este prestador.
              </div>
            ) : (
              <div className="space-y-3">
                {contratosMestre.map((cm) => (
                  <div
                    key={cm.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{cm.numero}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Status: {cm.status}
                      </Badge>
                    </div>

                    <p className="text-slate-600 text-[11px] whitespace-pre-line">
                      {cm.clausulas_nda || cm.minuta_texto}
                    </p>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                      <div>
                        {cm.data_assinatura_gmais ? (
                          <span className="text-emerald-600 font-medium">
                            ✓ Assinado pela G+ em {formatDateBr(cm.data_assinatura_gmais)}
                          </span>
                        ) : (
                          <span className="text-amber-600">Pendente de assinatura G+</span>
                        )}
                        {cm.data_assinatura_prestador && (
                          <span className="text-emerald-600 font-medium ml-3">
                            ✓ Assinado pelo Prestador em{' '}
                            {formatDateBr(cm.data_assinatura_prestador)}
                          </span>
                        )}
                      </div>

                      {isAdmin && !cm.data_assinatura_gmais && (
                        <Button
                          size="sm"
                          disabled={assinandoGmais}
                          onClick={() => handleAssinarGmais(cm.id)}
                          className="text-xs bg-[#1E2A4A] hover:bg-[#141D34] text-white"
                        >
                          {assinandoGmais ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Assinar pela G+'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Suspender Prestador */}
      <Dialog open={modalSuspenderOpen} onOpenChange={setModalSuspenderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="w-5 h-5" />
              Suspender Prestador
            </DialogTitle>
            <DialogDescription>
              A suspensão bloqueará imediatamente a emissão de novas Ordens de Serviço para este
              prestador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label className="text-xs">Motivo da Suspensão *</Label>
            <Input
              required
              placeholder="Ex.: Descumprimento reiterado de prazos ou falta de ART..."
              value={motivoSuspensao}
              onChange={(e) => setMotivoSuspensao(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModalSuspenderOpen(false)
                setMotivoSuspensao('')
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSuspenderPrestador}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirmar Suspensão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PrestadoresPage
