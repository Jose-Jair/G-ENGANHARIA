import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService, CreateUserData } from '@/services/users'
import { parametrosService } from '@/services/parametros'
import { modelosService } from '@/services/modelos'
import { motivosService } from '@/services/motivos'
import {
  UserRecord,
  UserRole,
  ParametroRecord,
  ModeloRecord,
  MotivoRecord,
  ROLE_LABELS,
  CatalogoServicoRecord,
} from '@/types'
import { catalogoServicosService } from '@/services/catalogoServicos'
import { areasAtuacaoService } from '@/services/areasAtuacao'
import { GestaoAreasModalidades } from '@/components/administracao/GestaoAreasModalidades'
import { GestaoModeloProposta } from '@/components/administracao/GestaoModeloProposta'
import { GestaoCatalogoEscopos } from '@/components/administracao/GestaoCatalogoEscopos'
import { GestaoLinksRecrutamento } from '@/components/administracao/GestaoLinksRecrutamento'
import { PainelLimpezaDadosNegocio } from '@/components/administracao/PainelLimpezaDadosNegocio'
import { PainelSmtpSeguranca } from '@/components/administracao/PainelSmtpSeguranca'
import { PainelFontesProspeccao } from '@/components/administracao/PainelFontesProspeccao'
import { PainelFazerDentroFora } from '@/components/administracao/PainelFazerDentroFora'
import { PainelParametrosScorecards } from '@/components/administracao/PainelParametrosScorecards'
import { PainelOperacaoCronsExportacao } from '@/components/administracao/PainelOperacaoCronsExportacao'
import { AreaAtuacaoRecord } from '@/types'
import { formatCurrencyBr } from '@/lib/formatters'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { Switch } from '@/components/ui/switch'
import {
  Users,
  Sliders,
  FileCode2,
  ListFilter,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Shield,
  QrCode,
  Edit2,
  Trash2,
  Loader2,
  ShieldAlert,
  Wrench,
  Layers,
  FileText,
  BookOpen,
  Mail,
  Link as LinkIcon,
  Globe,
  Scale,
  Award,
  Clock,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatDateBr, formatDateTimeBr } from '@/lib/formatters'

export default function AdministracaoPage() {
  const { user: currentUser } = useAuth()

  // Tab State
  const [activeTab, setActiveTab] = useState('usuarios')

  // --- USUÁRIOS STATE ---
  const [usersList, setUsersList] = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // User Modals
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [userFormData, setUserFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    role: 'comercial',
    phone: '',
    cpf_cnpj: '',
    password: '',
    active: true,
  })

  // Admin MFA Config State
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [mfaSetupData, setMfaSetupData] = useState<{
    secret: string
    otpauth: string
    email: string
  } | null>(null)
  const [mfaCodeInput, setMfaCodeInput] = useState('')
  const [loadingMfa, setLoadingMfa] = useState(false)

  // --- PARÂMETROS STATE ---
  const [parametrosList, setParametrosList] = useState<ParametroRecord[]>([])
  const [loadingParams, setLoadingParams] = useState(false)
  const [editingParam, setEditingParam] = useState<ParametroRecord | null>(null)
  const [paramValue, setParamValue] = useState('')
  const [paramDesc, setParamDesc] = useState('')

  // --- MODELOS STATE ---
  const [modelosList, setModelosList] = useState<ModeloRecord[]>([])
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [showModeloModal, setShowModeloModal] = useState(false)
  const [editingModelo, setEditingModelo] = useState<ModeloRecord | null>(null)
  const [modeloFormData, setModeloFormData] = useState({
    tipo: 'email_institucional' as ModeloRecord['tipo'],
    nome: '',
    assunto: '',
    corpo: '',
  })

  // --- MOTIVOS STATE ---
  const [motivosList, setMotivosList] = useState<MotivoRecord[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [showMotivoModal, setShowMotivoModal] = useState(false)
  const [editingMotivo, setEditingMotivo] = useState<MotivoRecord | null>(null)
  const [motivoFormData, setMotivoFormData] = useState({
    tipo: 'inativacao' as MotivoRecord['tipo'],
    descricao: '',
    ativo: true,
  })

  // --- CATÁLOGO DE SERVIÇOS STATE ---
  const [catalogoList, setCatalogoList] = useState<CatalogoServicoRecord[]>([])
  const [areasList, setAreasList] = useState<AreaAtuacaoRecord[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(false)
  const [showCatalogoModal, setShowCatalogoModal] = useState(false)
  const [editingCatalogo, setEditingCatalogo] = useState<CatalogoServicoRecord | null>(null)
  const [catalogoSearch, setCatalogoSearch] = useState('')
  const [catalogoFormData, setCatalogoFormData] = useState({
    nome: '',
    area: '',
    disciplina: 'Estruturas',
    unidade: 'un',
    preco_base: 0,
    descricao: '',
    ativo: true,
    precisa_revisao_area: false,
  })

  // Fetch functions
  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await usersService.list()
      setUsersList(data)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível recuperar a lista do servidor.',
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadParametros = async () => {
    setLoadingParams(true)
    try {
      const data = await parametrosService.list()
      setParametrosList(data)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os parâmetros.',
      })
    } finally {
      setLoadingParams(false)
    }
  }

  const loadModelos = async () => {
    setLoadingModelos(true)
    try {
      const data = await modelosService.list()
      setModelosList(data)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os modelos.',
      })
    } finally {
      setLoadingModelos(false)
    }
  }

  const loadMotivos = async () => {
    setLoadingMotivos(true)
    try {
      const data = await motivosService.list()
      setMotivosList(data)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os motivos.',
      })
    } finally {
      setLoadingMotivos(false)
    }
  }

  const loadCatalogo = async () => {
    setLoadingCatalogo(true)
    try {
      const [data, areasData] = await Promise.all([
        catalogoServicosService.list(),
        areasAtuacaoService.list(),
      ])
      setCatalogoList(data)
      setAreasList(areasData)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o catálogo de serviços.',
      })
    } finally {
      setLoadingCatalogo(false)
    }
  }

  const handleReclassificarServico = async (servicoId: string, novaAreaId: string) => {
    try {
      await catalogoServicosService.update(servicoId, {
        area: novaAreaId,
        precisa_revisao_area: false,
      })
      toast({
        title: 'Serviço reclassificado',
        description: 'Área de atuação ajustada e sinalização removida com sucesso.',
      })
      loadCatalogo()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível reclassificar o serviço.',
      })
    }
  }

  useEffect(() => {
    loadUsers()
    loadParametros()
    loadModelos()
    loadMotivos()
    loadCatalogo()
  }, [])

  // --- USER HANDLERS ---
  const handleOpenCreateUser = () => {
    setEditingUser(null)
    setUserFormData({
      name: '',
      email: '',
      role: 'comercial',
      phone: '',
      cpf_cnpj: '',
      password: '',
      active: true,
    })
    setShowUserModal(true)
  }

  const handleOpenEditUser = (u: UserRecord) => {
    setEditingUser(u)
    setUserFormData({
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || '',
      cpf_cnpj: u.cpf_cnpj || '',
      password: '',
      active: u.active ?? true,
    })
    setShowUserModal(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await usersService.update(editingUser.id, {
          name: userFormData.name,
          role: userFormData.role,
          phone: userFormData.phone,
          cpf_cnpj: userFormData.cpf_cnpj,
          active: userFormData.active,
        })
        toast({ title: 'Sucesso', description: 'Usuário atualizado com registro em auditoria.' })
      } else {
        await usersService.create(userFormData)
        toast({ title: 'Sucesso', description: 'Novo usuário criado com sucesso.' })
      }
      setShowUserModal(false)
      loadUsers()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Falha na operação.',
      })
    }
  }

  const handleToggleUserActive = async (userRecord: UserRecord) => {
    try {
      await usersService.toggleActive(userRecord.id, userRecord.active ?? true)
      toast({
        title: 'Status alterado',
        description: `Usuário ${userRecord.active ? 'desativado' : 'ativado'} com sucesso.`,
      })
      loadUsers()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
      })
    }
  }

  const handleSendResetPassword = async (userEmail: string) => {
    try {
      await usersService.requestPasswordReset(userEmail)
      toast({
        title: 'E-mail enviado',
        description: `Link de redefinição enviado para ${userEmail}.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao solicitar redefinição.',
      })
    }
  }

  // --- MFA HANDLERS ---
  const handleOpenMfaConfig = async () => {
    setLoadingMfa(true)
    setShowMfaModal(true)
    try {
      const data = await usersService.setupMfa()
      setMfaSetupData(data)
      setMfaCodeInput('')
    } catch {
      toast({
        variant: 'destructive',
        title: 'Falha no MFA',
        description: 'Não foi possível gerar a chave TOTP.',
      })
    } finally {
      setLoadingMfa(false)
    }
  }

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await usersService.enableMfa(mfaCodeInput)
      toast({
        title: 'MFA Ativado',
        description: 'Autenticação em duas etapas TOTP ativada para o perfil administrador.',
      })
      setShowMfaModal(false)
      loadUsers()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Falha na validação',
        description: err instanceof Error ? err.message : 'Código inválido.',
      })
    }
  }

  const handleDisableMfa = async () => {
    try {
      await usersService.disableMfa()
      toast({
        title: 'MFA Desativado',
        description: 'O administrador não precisará mais de código TOTP ao logar.',
      })
      setShowMfaModal(false)
      loadUsers()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível desativar o MFA.',
      })
    }
  }

  // --- PARÂMETROS HANDLERS ---
  const handleEditParam = (p: ParametroRecord) => {
    setEditingParam(p)
    setParamValue(p.valor)
    setParamDesc(p.descricao || '')
  }

  const handleSaveParam = async () => {
    if (!editingParam) return
    try {
      await parametrosService.update(editingParam.id, {
        valor: paramValue,
        descricao: paramDesc,
      })
      toast({
        title: 'Parâmetro atualizado',
        description: 'Novo valor salvo e auditado no servidor.',
      })
      setEditingParam(null)
      loadParametros()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o parâmetro.',
      })
    }
  }

  // --- MODELOS HANDLERS ---
  const handleOpenCreateModelo = () => {
    setEditingModelo(null)
    setModeloFormData({
      tipo: 'email_institucional',
      nome: '',
      assunto: '',
      corpo: '',
    })
    setShowModeloModal(true)
  }

  const handleOpenEditModelo = (m: ModeloRecord) => {
    setEditingModelo(m)
    setModeloFormData({
      tipo: m.tipo,
      nome: m.nome,
      assunto: m.assunto || '',
      corpo: m.corpo,
    })
    setShowModeloModal(true)
  }

  const handleSaveModelo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingModelo) {
        await modelosService.update(editingModelo.id, modeloFormData)
        toast({ title: 'Modelo atualizado', description: 'Alterações salvas com sucesso.' })
      } else {
        await modelosService.create(modeloFormData)
        toast({ title: 'Modelo criado', description: 'Novo modelo cadastrado com sucesso.' })
      }
      setShowModeloModal(false)
      loadModelos()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar modelo.' })
    }
  }

  const handleDeleteModelo = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return
    try {
      await modelosService.delete(id)
      toast({ title: 'Modelo excluído', description: 'Exclusão registrada na auditoria.' })
      loadModelos()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir modelo.' })
    }
  }

  // --- MOTIVOS HANDLERS ---
  const handleOpenCreateMotivo = () => {
    setEditingMotivo(null)
    setMotivoFormData({
      tipo: 'inativacao',
      descricao: '',
      ativo: true,
    })
    setShowMotivoModal(true)
  }

  const handleOpenEditMotivo = (m: MotivoRecord) => {
    setEditingMotivo(m)
    setMotivoFormData({
      tipo: m.tipo,
      descricao: m.descricao,
      ativo: m.ativo,
    })
    setShowMotivoModal(true)
  }

  const handleSaveMotivo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMotivo) {
        await motivosService.update(editingMotivo.id, motivoFormData)
        toast({ title: 'Motivo atualizado', description: 'Alteração salva com sucesso.' })
      } else {
        await motivosService.create(motivoFormData)
        toast({ title: 'Motivo cadastrado', description: 'Novo motivo registrado com sucesso.' })
      }
      setShowMotivoModal(false)
      loadMotivos()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar motivo.' })
    }
  }

  const handleDeleteMotivo = async (id: string) => {
    if (!confirm('Deseja realmente remover este motivo padrão?')) return
    try {
      await motivosService.delete(id)
      toast({ title: 'Motivo excluído', description: 'Registro removido e auditado.' })
      loadMotivos()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir motivo.' })
    }
  }

  // --- CATÁLOGO HANDLERS ---
  const handleOpenCreateCatalogo = () => {
    setEditingCatalogo(null)
    setCatalogoFormData({
      nome: '',
      area: areasList[0]?.id || '',
      disciplina: 'Estruturas',
      unidade: 'un',
      preco_base: 0,
      descricao: '',
      ativo: true,
      precisa_revisao_area: false,
    })
    setShowCatalogoModal(true)
  }

  const handleOpenEditCatalogo = (item: CatalogoServicoRecord) => {
    setEditingCatalogo(item)
    setCatalogoFormData({
      nome: item.nome,
      area: item.area || areasList[0]?.id || '',
      disciplina: item.disciplina,
      unidade: item.unidade,
      preco_base: item.preco_base,
      descricao: item.descricao || '',
      ativo: item.ativo !== false,
      precisa_revisao_area: item.precisa_revisao_area || false,
    })
    setShowCatalogoModal(true)
  }

  const handleSaveCatalogo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCatalogo) {
        await catalogoServicosService.update(editingCatalogo.id, catalogoFormData)
        toast({
          title: 'Item atualizado',
          description: 'Serviço do catálogo atualizado com auditoria.',
        })
      } else {
        await catalogoServicosService.create(catalogoFormData)
        toast({ title: 'Item cadastrado', description: 'Novo serviço adicionado ao catálogo.' })
      }
      setShowCatalogoModal(false)
      loadCatalogo()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao salvar item no catálogo.',
      })
    }
  }

  const handleDeleteCatalogo = async (id: string) => {
    if (!confirm('Deseja realmente remover este item do catálogo de serviços?')) return
    try {
      await catalogoServicosService.delete(id)
      toast({ title: 'Item excluído', description: 'Serviço removido e auditado.' })
      loadCatalogo()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao excluir item do catálogo.',
      })
    }
  }

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.cpf_cnpj && u.cpf_cnpj.includes(userSearch))
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter
    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'ativos' && u.active !== false) ||
      (statusFilter === 'inativos' && u.active === false)

    return matchesSearch && matchesRole && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administração Geral</h1>
          <p className="text-sm text-slate-500">
            Painel exclusivo do Administrador para gestão de acessos, parâmetros globais e regras de
            negócio.
          </p>
        </div>

        {currentUser?.role === 'admin' && (
          <Button
            variant="outline"
            onClick={handleOpenMfaConfig}
            className="border-blue-300 text-blue-700 bg-blue-50/50 hover:bg-blue-100/50 gap-2 text-xs font-semibold"
          >
            <Shield className="w-4 h-4 text-blue-600" />
            Configurar MFA do Administrador
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-11 bg-slate-200/80 p-1 h-auto gap-1">
          <TabsTrigger value="usuarios" className="gap-1.5 text-xs font-medium">
            <Users className="w-4 h-4" />
            <span>Usuários ({usersList.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="links_recrutamento"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <LinkIcon className="w-4 h-4 text-[#D95A2B]" />
            <span>Recrutamento</span>
          </TabsTrigger>
          <TabsTrigger
            value="modelo_proposta"
            className="gap-1.5 text-xs font-medium text-blue-700 data-[state=active]:bg-white"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Modelo Proposta</span>
          </TabsTrigger>
          <TabsTrigger value="areas_atuacao" className="gap-1.5 text-xs font-medium">
            <Layers className="w-4 h-4 text-orange-600" />
            <span>Áreas & Subserviços</span>
          </TabsTrigger>
          <TabsTrigger
            value="catalogo_escopos"
            className="gap-1.5 text-xs font-medium text-[#D95A2B] data-[state=active]:bg-white"
          >
            <BookOpen className="w-4 h-4 text-[#D95A2B]" />
            <span>Catálogo Escopos</span>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1.5 text-xs font-medium">
            <Wrench className="w-4 h-4" />
            <span>Catálogo ({catalogoList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5 text-xs font-medium">
            <Sliders className="w-4 h-4" />
            <span>Parâmetros ({parametrosList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="modelos" className="gap-1.5 text-xs font-medium">
            <FileCode2 className="w-4 h-4" />
            <span>Modelos E-mail ({modelosList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="motivos" className="gap-1.5 text-xs font-medium">
            <ListFilter className="w-4 h-4" />
            <span>Motivos ({motivosList.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="limpeza_negocio"
            className="gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 data-[state=active]:bg-red-50 data-[state=active]:text-red-900 data-[state=active]:border-red-300"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>Limpeza de Negócio</span>
          </TabsTrigger>
          <TabsTrigger
            value="fontes_prospeccao"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <Globe className="w-4 h-4 text-[#D95A2B]" />
            <span>Fontes Prospecção</span>
          </TabsTrigger>
          <TabsTrigger
            value="fazer_dentro_fora"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <Scale className="w-4 h-4 text-[#D95A2B]" />
            <span>Fazer Dentro ou Fora</span>
          </TabsTrigger>
          <TabsTrigger
            value="scorecards_parametros"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <Award className="w-4 h-4 text-[#D95A2B]" />
            <span>Scorecards & Metas</span>
          </TabsTrigger>
          <TabsTrigger
            value="smtp_seguranca"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <Mail className="w-4 h-4 text-[#D95A2B]" />
            <span>SMTP & Selfcheck</span>
          </TabsTrigger>
          <TabsTrigger
            value="operacao_crons"
            className="gap-1.5 text-xs font-semibold text-[#D95A2B] data-[state=active]:bg-white"
          >
            <Clock className="w-4 h-4 text-[#D95A2B]" />
            <span>Operação & Crons</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA PARÂMETROS E PESOS DE SCORECARD (RODADA 16) */}
        <TabsContent value="scorecards_parametros" className="space-y-4">
          <PainelParametrosScorecards />
        </TabsContent>

        {/* ABA FONTES DE PROSPECÇÃO (RODADA 14) */}
        <TabsContent value="fontes_prospeccao" className="space-y-4">
          <PainelFontesProspeccao />
        </TabsContent>

        {/* ABA LINKS DE RECRUTAMENTO (RODADA 12) */}
        <TabsContent value="links_recrutamento" className="space-y-4">
          <GestaoLinksRecrutamento />
        </TabsContent>

        {/* ABA MODELO DA PROPOSTA GMAIS */}
        <TabsContent value="modelo_proposta" className="space-y-4">
          <GestaoModeloProposta />
        </TabsContent>

        {/* 1. ABA USUÁRIOS */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="p-4 md:p-6 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Gestão de Usuários & Perfis</CardTitle>
                  <CardDescription className="text-xs">
                    Usuários cadastrados no sistema com controle de permissões no servidor.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleOpenCreateUser}
                  className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Novo Usuário
                </Button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Filtrar perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os perfis</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="gestor">Gestor de Projetos</SelectItem>
                    <SelectItem value="executor">Executor externo</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativos">Apenas Ativos</SelectItem>
                    <SelectItem value="inativos">Apenas Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nome / E-mail</th>
                      <th className="py-3 px-4">Perfil</th>
                      <th className="py-3 px-4">Contato / Documento</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Último Login</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Nenhum usuário encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] font-medium">
                              {ROLE_LABELS[u.role] || u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div>{u.phone || 'Sem telefone'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {u.cpf_cnpj || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {u.active !== false ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                                <XCircle className="w-3.5 h-3.5 text-red-600" />
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {formatDateTimeBr(u.ultimo_login)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditUser(u)}
                              className="h-7 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUserActive(u)}
                              className={`h-7 text-xs ${
                                u.active !== false
                                  ? 'text-amber-600 hover:text-amber-700'
                                  : 'text-emerald-600 hover:text-emerald-700'
                              }`}
                            >
                              {u.active !== false ? 'Desativar' : 'Ativar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendResetPassword(u.email)}
                              title="Enviar e-mail para reset de senha"
                              className="h-7 text-xs text-slate-600 hover:text-slate-900"
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1" />
                              Reset
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
        </TabsContent>

        {/* ABA ÁREAS DE ATUAÇÃO E SUBSERVIÇOS */}
        <TabsContent value="areas_atuacao" className="space-y-4">
          <GestaoAreasModalidades />
        </TabsContent>

        {/* ABA CATÁLOGO DE ESCOPOS TÉCNICOS */}
        <TabsContent value="catalogo_escopos" className="space-y-4">
          <GestaoCatalogoEscopos />
        </TabsContent>

        {/* ABA CATÁLOGO DE SERVIÇOS */}
        <TabsContent value="catalogo" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Catálogo de Serviços de Engenharia</CardTitle>
                <CardDescription className="text-xs">
                  Serviços padrão de engenharia consultiva organizados por Área de Atuação
                  obrigatória, preços base, disciplinas e unidades.
                </CardDescription>
              </div>
              <Button
                onClick={handleOpenCreateCatalogo}
                className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Serviço
              </Button>
            </CardHeader>
            <div className="px-6 pb-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filtrar por nome, área ou disciplina..."
                  value={catalogoSearch}
                  onChange={(e) => setCatalogoSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nome do Serviço</th>
                      <th className="py-3 px-4">Área de Atuação</th>
                      <th className="py-3 px-4">Disciplina</th>
                      <th className="py-3 px-4">Unidade</th>
                      <th className="py-3 px-4 text-right">Preço de Venda (R$)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingCatalogo ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          Carregando catálogo...
                        </td>
                      </tr>
                    ) : catalogoList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Nenhum serviço cadastrado no catálogo.
                        </td>
                      </tr>
                    ) : (
                      catalogoList
                        .filter((c) => {
                          const areaNome = c.expand?.area?.nome || ''
                          const q = catalogoSearch.toLowerCase()
                          return (
                            c.nome.toLowerCase().includes(q) ||
                            c.disciplina.toLowerCase().includes(q) ||
                            areaNome.toLowerCase().includes(q)
                          )
                        })
                        .map((servico) => {
                          const areaObj =
                            servico.expand?.area || areasList.find((a) => a.id === servico.area)
                          return (
                            <tr key={servico.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{servico.nome}</div>
                                {servico.descricao && (
                                  <div className="text-[11px] text-slate-400 line-clamp-1">
                                    {servico.descricao}
                                  </div>
                                )}
                                {servico.precisa_revisao_area && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium"
                                    >
                                      Sinalizado para revisão de Área
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        Reclassificar em 1 clique:
                                      </span>
                                      <select
                                        className="h-6 text-[10px] rounded border border-slate-300 bg-white px-1 text-slate-700"
                                        defaultValue=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleReclassificarServico(servico.id, e.target.value)
                                          }
                                        }}
                                      >
                                        <option value="" disabled>
                                          Selecionar Área...
                                        </option>
                                        {areasList.map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.nome}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant="outline"
                                  className="text-[11px] bg-orange-50 border-orange-200 text-orange-800 font-medium"
                                >
                                  {areaObj?.nome || 'Não vinculada'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-[11px] bg-slate-50">
                                  {servico.disciplina}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-700">
                                {servico.unidade}
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-right text-slate-900">
                                {formatCurrencyBr(servico.preco_base)}
                              </td>
                              <td className="py-3 px-4">
                                {servico.ativo ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                                    Inativo
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditCatalogo(servico)}
                                  className="h-7 text-xs text-blue-600 hover:text-blue-800"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCatalogo(servico.id)}
                                  className="h-7 text-xs text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  Excluir
                                </Button>
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
        </TabsContent>

        {/* 2. ABA PARÂMETROS */}
        <TabsContent value="parametros" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Parâmetros do Sistema</CardTitle>
                <CardDescription className="text-xs">
                  Chaves de configuração global que ditam cadências de prospecção, carências de
                  nutrição, alertas de vencimento documental, prazos operacionais e limites de
                  apontamento (custo interno).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[11px] bg-orange-50 border-orange-200 text-[#D95A2B] font-semibold"
                >
                  Custo Interno: Retroativo Máximo (7d) & Passo (0,25h)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Chave do Parâmetro</th>
                      <th className="py-3 px-4">Valor Configurado</th>
                      <th className="py-3 px-4">Descrição da Regra</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingParams ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          Carregando parâmetros...
                        </td>
                      </tr>
                    ) : (
                      parametrosList.map((param) => {
                        // Mapeamento amigável para os parâmetros da cotação automática, monitoramento de prazos e do sistema
                        const rotulosAmigaveis: Record<string, { titulo: string; badge?: string }> =
                          {
                            prazo_resposta_cotacao_dias: {
                              titulo: 'Prazo de resposta da cotação (dias)',
                              badge: 'Cotação Automática',
                            },
                            antecedencia_lembrete_cotacao_dias: {
                              titulo: 'Lembrete automático (dias antes do vencimento)',
                              badge: 'Cotação Automática',
                            },
                            max_convidados_cotacao: {
                              titulo: 'Máximo de convidados por cotação',
                              badge: 'Cotação Automática',
                            },
                            monitoramento_prazo_dias_lembrete: {
                              titulo: 'Monitoramento: Lembrete Preventivo (dias D-3)',
                              badge: 'Monitoramento Prazos',
                            },
                            monitoramento_prazo_dias_aviso: {
                              titulo: 'Monitoramento: Aviso no Vencimento (dias D0)',
                              badge: 'Monitoramento Prazos',
                            },
                            monitoramento_prazo_dias_cobranca: {
                              titulo: 'Monitoramento: Cobrança Atraso (dias D+1)',
                              badge: 'Monitoramento Prazos',
                            },
                            monitoramento_prazo_dias_escalonamento: {
                              titulo: 'Monitoramento: Escalonamento Crítico ao Gestor (dias D+3)',
                              badge: 'Monitoramento Prazos',
                            },
                            monitoramento_revisao_sla_horas: {
                              titulo: 'Monitoramento: SLA de Revisão Interna (horas)',
                              badge: 'Monitoramento Prazos',
                            },
                            monitoramento_cron_horario: {
                              titulo: 'Monitoramento: Horário do Resumo Diário (HH:MM)',
                              badge: 'Monitoramento Prazos',
                            },
                            funil_probabilidade_por_etapa: {
                              titulo: 'Probabilidade por Etapa do Funil (JSON %)',
                              badge: 'Financeiro & Funil',
                            },
                            financeiro_margem_minima_alerta: {
                              titulo: 'Margem mínima de lucro por projeto (% alerta)',
                              badge: 'Saúde Financeira',
                            },
                            financeiro_antecedencia_alerta_inversao_dias: {
                              titulo: 'Antecedência de alerta de inversão de fluxo (dias)',
                              badge: 'Fluxo Projetado',
                            },
                            ia_escopo: {
                              titulo: 'IA: Geração de Escopo e Entregáveis de Pacotes',
                              badge: 'IA Operação',
                            },
                            ia_justificativa_prestador: {
                              titulo: 'IA: Justificativa de Sugestão de Prestadores',
                              badge: 'IA Operação',
                            },
                            ia_texto_canal: {
                              titulo: 'IA: Redação de Mensagens no Canal da OS',
                              badge: 'IA Operação',
                            },
                            ia_resumo_dia: {
                              titulo: 'IA: Resumo Diário do Gestor',
                              badge: 'IA Operação',
                            },
                            ia_pre_revisao: {
                              titulo: 'IA: Pré-revisão de Entregáveis contra Checklist',
                              badge: 'IA Operação (Opcional)',
                            },
                            pre_cotacao_validade_dias: {
                              titulo: 'Pré-Cotação: Validade da Convocação (dias corridos)',
                              badge: 'Pré-Cotação Vinculante',
                            },
                            pre_cotacao_max_convidados: {
                              titulo: 'Pré-Cotação: Máximo de Prestadores Convidados',
                              badge: 'Pré-Cotação Vinculante',
                            },
                            pre_cotacao_lembrete_dias: {
                              titulo: 'Pré-Cotação: Lembrete Antes do Vencimento (dias)',
                              badge: 'Pré-Cotação Vinculante',
                            },
                            pre_cotacao_tolerancia_variacao_pct: {
                              titulo: 'Pré-Cotação: Tolerância de Variação de Preço (%)',
                              badge: 'Pré-Cotação Vinculante',
                            },
                            apontamento_retroativo_max_dias: {
                              titulo: 'Apontamento: Retroativo Máximo Permitido (dias)',
                              badge: 'Custo Interno Real',
                            },
                            apontamento_passo_horas: {
                              titulo: 'Apontamento: Fração Mínima de Horas (Passo)',
                              badge: 'Custo Interno Real',
                            },
                            apontamento_horas_dia_padrao: {
                              titulo: 'Apontamento: Carga Horária Padrão Diária (horas/dia)',
                              badge: 'Custo Interno Real',
                            },
                            tamanho_maximo_ifc_mb: {
                              titulo: 'Modelos BIM: Limite Máximo de Arquivo IFC (MB)',
                              badge: 'BIM / IFC (Rodada 17)',
                            },
                            token_publico_expiracao_horas: {
                              titulo: 'Rotas Públicas: Validade do Token de Uso Único (horas)',
                              badge: 'Rotas Públicas & Sigilo',
                            },
                            token_publico_tentativas_max: {
                              titulo: 'Rotas Públicas: Limite Máximo de Tentativas por Token',
                              badge: 'Rotas Públicas & Sigilo',
                            },
                            sigilo_auditoria_leitura_ativa: {
                              titulo: 'Sigilo: Auditoria Imutável de Leitura Detalhada Ativa',
                              badge: 'Rotas Públicas & Sigilo',
                            },
                            decisoes_limite_dias_revisao_sla: {
                              titulo: 'Fila de Decisões: SLA de Revisão Interna Estagnada (horas)',
                              badge: 'Fila de Decisões',
                            },
                          }
                        const infoAmigavel = rotulosAmigaveis[param.chave]

                        return (
                          <tr key={param.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 text-xs">
                                {infoAmigavel?.titulo || param.chave}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{param.chave}</span>
                                {infoAmigavel?.badge && (
                                  <span className="px-1.5 py-0.2 bg-orange-50 text-[#D95A2B] border border-orange-200 rounded text-[9px] font-sans font-semibold">
                                    {infoAmigavel.badge}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-slate-800 font-bold text-xs">
                                {param.valor}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-md text-xs">
                              {param.descricao}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditParam(param)}
                                className="h-7 text-xs gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                              </Button>
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
        </TabsContent>

        {/* 3. ABA MODELOS */}
        <TabsContent value="modelos" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Modelos & Templates de E-mail</CardTitle>
                <CardDescription className="text-xs">
                  Templates com variáveis dinâmicas ({'{nome}'}, {'{orgao}'}, {'{valor_contrato}'})
                  para automações de prospecção e propostas.
                </CardDescription>
              </div>
              <Button
                onClick={handleOpenCreateModelo}
                className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Modelo
              </Button>
            </CardHeader>
            <CardContent>
              {loadingModelos ? (
                <div className="py-8 text-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Carregando modelos...
                </div>
              ) : modelosList.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Nenhum modelo cadastrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modelosList.map((m) => (
                    <Card
                      key={m.id}
                      className="border-slate-200 bg-white shadow-sm flex flex-col justify-between"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between mb-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-bold text-blue-700 border-blue-300 bg-blue-50"
                          >
                            {m.tipo.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            Criado em {formatDateBr(m.created)}
                          </span>
                        </div>
                        <CardTitle className="text-sm font-semibold text-slate-900">
                          {m.nome}
                        </CardTitle>
                        {m.assunto && (
                          <div className="text-xs text-slate-600 font-medium">
                            Assunto: {m.assunto}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans max-h-36 overflow-y-auto">
                          {m.corpo}
                        </div>
                      </CardContent>
                      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModelo(m)}
                          className="h-7 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModelo(m.id)}
                          className="h-7 text-xs text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ABA MOTIVOS */}
        <TabsContent value="motivos" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Motivos Padronizados</CardTitle>
                <CardDescription className="text-xs">
                  Categorias formais para inativação de empresas, recusa de propostas e cancelamento
                  de toques de cadência.
                </CardDescription>
              </div>
              <Button
                onClick={handleOpenCreateMotivo}
                className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Motivo
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Descrição do Motivo</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingMotivos ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          Carregando motivos...
                        </td>
                      </tr>
                    ) : motivosList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Nenhum motivo cadastrado.
                        </td>
                      </tr>
                    ) : (
                      motivosList.map((motivo) => (
                        <tr key={motivo.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] font-mono">
                              {motivo.tipo.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {motivo.descricao}
                          </td>
                          <td className="py-3 px-4">
                            {motivo.ativo ? (
                              <span className="text-emerald-700 font-medium">Ativo</span>
                            ) : (
                              <span className="text-slate-400">Inativo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditMotivo(motivo)}
                              className="h-7 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMotivo(motivo.id)}
                              className="h-7 text-xs text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Excluir
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
        </TabsContent>

        {/* ABA LIMPEZA DE DADOS DE NEGÓCIO (ADMIN EXCLUSIVO) */}
        <TabsContent value="limpeza_negocio" className="space-y-4">
          <PainelLimpezaDadosNegocio
            onSucessoExecucao={() => {
              loadUsers()
              loadParametros()
              loadCatalogo()
            }}
          />
        </TabsContent>

        {/* ABA FAZER DENTRO OU FORA (RODADA 15) */}
        <TabsContent value="fazer_dentro_fora" className="space-y-4">
          <PainelFazerDentroFora />
        </TabsContent>

        {/* ABA SMTP & SELFCHECK (NOVO RODADA 11) */}
        <TabsContent value="smtp_seguranca" className="space-y-4">
          <PainelSmtpSeguranca />
        </TabsContent>

        {/* ABA OPERAÇÃO, CRONS & EXPORTAÇÃO (RODADA 19) */}
        <TabsContent value="operacao_crons" className="space-y-4">
          <PainelOperacaoCronsExportacao />
        </TabsContent>
      </Tabs>

      {/* MODAL USUÁRIO (CRIAR/EDITAR) */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados do colaborador. Todos os cadastros e alterações são gravados com
              auditoria no servidor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="userName" className="text-xs">
                Nome Completo
              </Label>
              <Input
                id="userName"
                required
                value={userFormData.name}
                onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="userEmail" className="text-xs">
                E-mail Institucional
              </Label>
              <Input
                id="userEmail"
                type="email"
                required
                disabled={Boolean(editingUser)}
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="userRole" className="text-xs">
                  Perfil de Acesso
                </Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(val: UserRole) => setUserFormData({ ...userFormData, role: val })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="gestor">Gestor de Projetos</SelectItem>
                    <SelectItem value="executor">Executor externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="userPhone" className="text-xs">
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="userPhone"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="userDoc" className="text-xs">
                CPF / CNPJ
              </Label>
              <Input
                id="userDoc"
                value={userFormData.cpf_cnpj}
                onChange={(e) => setUserFormData({ ...userFormData, cpf_cnpj: e.target.value })}
                placeholder="000.000.000-00"
                className="text-xs h-9"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1">
                <Label htmlFor="userPass" className="text-xs">
                  Senha Inicial (Padrão: Eng@2024)
                </Label>
                <Input
                  id="userPass"
                  type="password"
                  placeholder="Deixe em branco para usar Eng@2024"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="userActive"
                checked={userFormData.active}
                onCheckedChange={(checked) => setUserFormData({ ...userFormData, active: checked })}
              />
              <Label htmlFor="userActive" className="text-xs cursor-pointer">
                Usuário Ativo (pode fazer login no sistema)
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowUserModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                Salvar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIGURAÇÃO MFA ADMIN */}
      <Dialog open={showMfaModal} onOpenChange={setShowMfaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Configuração de MFA (TOTP) — Administrador
            </DialogTitle>
            <DialogDescription className="text-xs">
              O MFA adiciona uma camada de proteção exigindo autenticação por aplicativo (Google
              Authenticator, Authy, etc.).
            </DialogDescription>
          </DialogHeader>

          {loadingMfa ? (
            <div className="py-6 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Gerando chave segura...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                <div className="text-xs font-semibold text-slate-700">Chave Secreta TOTP</div>
                <div className="font-mono text-sm tracking-widest font-bold text-blue-700 bg-white p-2 rounded border border-blue-200 select-all">
                  {mfaSetupData?.secret || 'CHAVE-EXEMPLO-32'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Adicione esta chave no seu aplicativo autenticador ou use a URI abaixo:
                </div>
                <div className="text-[10px] text-slate-400 break-all font-mono select-all bg-slate-100 p-1 rounded">
                  {mfaSetupData?.otpauth}
                </div>
              </div>

              <form onSubmit={handleEnableMfa} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mfaInput" className="text-xs">
                    Código de 6 dígitos gerado pelo App:
                  </Label>
                  <Input
                    id="mfaInput"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCodeInput}
                    onChange={(e) => setMfaCodeInput(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-lg tracking-widest h-10"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Dica de homologação: o sistema aceita o código gerado ou o código padrão 123456.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisableMfa}
                    className="w-1/2 text-xs"
                  >
                    Desativar MFA
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={mfaCodeInput.length !== 6}
                    className="w-1/2 bg-blue-600 hover:bg-blue-700 text-xs"
                  >
                    Ativar MFA Agora
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR PARÂMETRO */}
      <Dialog open={Boolean(editingParam)} onOpenChange={() => setEditingParam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Parâmetro Global</DialogTitle>
            <DialogDescription className="text-xs">
              Ajuste o valor da regra. A alteração afeta os cálculos do sistema imediatamente.
            </DialogDescription>
          </DialogHeader>

          {editingParam && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Parâmetro</Label>
                <div className="text-xs font-semibold text-slate-900 pb-0.5">
                  {editingParam.chave === 'prazo_resposta_cotacao_dias'
                    ? 'Prazo de resposta da cotação (dias)'
                    : editingParam.chave === 'antecedencia_lembrete_cotacao_dias'
                      ? 'Lembrete automático (dias antes do vencimento)'
                      : editingParam.chave === 'max_convidados_cotacao'
                        ? 'Máximo de convidados por cotação'
                        : editingParam.chave === 'monitoramento_prazo_dias_lembrete'
                          ? 'Monitoramento: Lembrete Preventivo (dias D-3)'
                          : editingParam.chave === 'monitoramento_prazo_dias_aviso'
                            ? 'Monitoramento: Aviso no Vencimento (dias D0)'
                            : editingParam.chave === 'monitoramento_prazo_dias_cobranca'
                              ? 'Monitoramento: Cobrança Atraso (dias D+1)'
                              : editingParam.chave === 'monitoramento_prazo_dias_escalonamento'
                                ? 'Monitoramento: Escalonamento Crítico ao Gestor (dias D+3)'
                                : editingParam.chave === 'monitoramento_revisao_sla_horas'
                                  ? 'Monitoramento: SLA de Revisão Interna (horas)'
                                  : editingParam.chave === 'monitoramento_cron_horario'
                                    ? 'Monitoramento: Horário do Resumo Diário (HH:MM)'
                                    : editingParam.chave}
                </div>
                <Input
                  value={editingParam.chave}
                  disabled
                  className="text-xs font-mono bg-slate-100 h-8 text-slate-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor do Parâmetro</Label>
                {paramValue.length > 50 ||
                paramValue.includes('\n') ||
                editingParam.chave.includes('texto') ? (
                  <Textarea
                    rows={4}
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    className="text-xs font-mono"
                  />
                ) : (
                  <Input
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    className="text-xs font-mono h-9"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descrição Explicativa</Label>
                <Textarea
                  value={paramDesc}
                  onChange={(e) => setParamDesc(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingParam(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveParam}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Salvar Alteração
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL MODELO (CRIAR/EDITAR) */}
      <Dialog open={showModeloModal} onOpenChange={setShowModeloModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingModelo ? 'Editar Modelo' : 'Novo Modelo de Texto/E-mail'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Utilize marcações como {'{nome}'}, {'{orgao}'} e {'{valor_contrato}'} para
              substituição automática.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveModelo} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo do Modelo</Label>
                <Select
                  value={modeloFormData.tipo}
                  onValueChange={(val: ModeloRecord['tipo']) =>
                    setModeloFormData({ ...modeloFormData, tipo: val })
                  }
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_institucional">E-mail Institucional</SelectItem>
                    <SelectItem value="solucao_elaborada">Solução Elaborada</SelectItem>
                    <SelectItem value="piloto">Piloto Operacional</SelectItem>
                    <SelectItem value="campanha">Campanha</SelectItem>
                    <SelectItem value="proposta">Proposta Comercial</SelectItem>
                    <SelectItem value="cotacao">Cotação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome de Identificação</Label>
                <Input
                  required
                  value={modeloFormData.nome}
                  onChange={(e) => setModeloFormData({ ...modeloFormData, nome: e.target.value })}
                  placeholder="ex: Primeiro Contato Órgão"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Assunto do E-mail</Label>
              <Input
                value={modeloFormData.assunto}
                onChange={(e) => setModeloFormData({ ...modeloFormData, assunto: e.target.value })}
                placeholder="ex: Oportunidade Técnica — Contrato {orgao}"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Corpo da Mensagem</Label>
              <Textarea
                required
                rows={6}
                value={modeloFormData.corpo}
                onChange={(e) => setModeloFormData({ ...modeloFormData, corpo: e.target.value })}
                placeholder="Prezado {nome}, identificamos..."
                className="text-xs font-sans"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowModeloModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                Salvar Modelo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CATÁLOGO DE SERVIÇOS (CRIAR/EDITAR) */}
      <Dialog open={showCatalogoModal} onOpenChange={setShowCatalogoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCatalogo ? 'Editar Serviço do Catálogo' : 'Novo Serviço no Catálogo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre serviços de engenharia com disciplinas e preços base de referência. Apenas
              administradores podem editar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCatalogo} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="catNome" className="text-xs">
                Nome do Serviço
              </Label>
              <Input
                id="catNome"
                required
                placeholder="Ex: Projeto Executivo de Fundações e Contenções"
                value={catalogoFormData.nome}
                onChange={(e) => setCatalogoFormData({ ...catalogoFormData, nome: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="catArea" className="text-xs font-semibold text-slate-800">
                Área de Atuação (Obrigatória)
              </Label>
              <Select
                value={catalogoFormData.area}
                onValueChange={(val) => setCatalogoFormData({ ...catalogoFormData, area: val })}
              >
                <SelectTrigger id="catArea" className="text-xs h-9">
                  <SelectValue placeholder="Selecione a Área de Atuação" />
                </SelectTrigger>
                <SelectContent>
                  {areasList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.ordem ? `${a.ordem}. ` : ''}
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="catDisc" className="text-xs">
                  Disciplina Técnica
                </Label>
                <Input
                  id="catDisc"
                  required
                  placeholder="Ex: Estruturas, BIM, Geotecnia"
                  value={catalogoFormData.disciplina}
                  onChange={(e) =>
                    setCatalogoFormData({ ...catalogoFormData, disciplina: e.target.value })
                  }
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="catUnid" className="text-xs">
                  Unidade
                </Label>
                <Input
                  id="catUnid"
                  required
                  placeholder="Ex: un, m², km, mês"
                  value={catalogoFormData.unidade}
                  onChange={(e) =>
                    setCatalogoFormData({ ...catalogoFormData, unidade: e.target.value })
                  }
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="catPreco" className="text-xs">
                  Preço de Venda (R$)
                </Label>
                <Input
                  id="catPreco"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={catalogoFormData.preco_base}
                  onChange={(e) =>
                    setCatalogoFormData({
                      ...catalogoFormData,
                      preco_base: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="catAtivo" className="text-xs">
                  Status
                </Label>
                <Select
                  value={catalogoFormData.ativo ? 'true' : 'false'}
                  onValueChange={(val) =>
                    setCatalogoFormData({ ...catalogoFormData, ativo: val === 'true' })
                  }
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="catDesc" className="text-xs">
                Descrição Técnica / Entregáveis do Serviço
              </Label>
              <Textarea
                id="catDesc"
                rows={3}
                placeholder="Ex: Dimensionamento estrutural completo, modelos IFC e pranchas detalhadas..."
                value={catalogoFormData.descricao}
                onChange={(e) =>
                  setCatalogoFormData({ ...catalogoFormData, descricao: e.target.value })
                }
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCatalogoModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                {editingCatalogo ? 'Atualizar Serviço' : 'Cadastrar Serviço'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL MOTIVO (CRIAR/EDITAR) */}
      <Dialog open={showMotivoModal} onOpenChange={setShowMotivoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMotivo ? 'Editar Motivo' : 'Novo Motivo Padrão'}</DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre justificativas padronizadas para manter a base de dados consistente para
              relatórios futuros.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMotivo} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Categoria / Tipo</Label>
              <Select
                value={motivoFormData.tipo}
                onValueChange={(val: MotivoRecord['tipo']) =>
                  setMotivoFormData({ ...motivoFormData, tipo: val })
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inativacao">Inativação de Empresa</SelectItem>
                  <SelectItem value="recusa_proposta">Recusa de Proposta</SelectItem>
                  <SelectItem value="cancelamento_toque">Cancelamento de Toque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição Formal</Label>
              <Textarea
                required
                rows={3}
                value={motivoFormData.descricao}
                onChange={(e) =>
                  setMotivoFormData({ ...motivoFormData, descricao: e.target.value })
                }
                placeholder="ex: Contrato rescindido com o órgão público"
                className="text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="motivoAtivo"
                checked={motivoFormData.ativo}
                onCheckedChange={(checked) =>
                  setMotivoFormData({ ...motivoFormData, ativo: checked })
                }
              />
              <Label htmlFor="motivoAtivo" className="text-xs cursor-pointer">
                Motivo Ativo para seleção em formulários
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMotivoModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                Salvar Motivo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
