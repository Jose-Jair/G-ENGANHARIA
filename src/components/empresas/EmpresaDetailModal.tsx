import React, { useState, useEffect } from 'react'
import {
  EmpresaRecord,
  ContratoRecord,
  ContatoRecord,
  CenarioEntrada,
  UserRecord,
  AuditLogRecord,
} from '@/types'
import { empresasService, CreateEmpresaData } from '@/services/empresas'
import { contratosService } from '@/services/contratos'
import { contatosService } from '@/services/contatos'
import { empresaTimelineService } from '@/services/empresaTimeline'
import { brasilApiService } from '@/services/brasilApi'
import { cleanCnpj, formatCnpj, isValidCnpj, cleanPhoneForWa, formatPhoneBr } from '@/lib/cnpj'
import { scoreCurvaService } from '@/services/scoreCurva'
import { TelefoneEmpresaItem } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { EmpresaContratosTab } from './EmpresaContratosTab'
import { EmpresaContatosTab } from './EmpresaContatosTab'
import { EmpresaTimelineTab } from './EmpresaTimelineTab'
import { EmpresaCadenciaTab } from './EmpresaCadenciaTab'
import { toquesService } from '@/services/toques'
import { modelosService } from '@/services/modelos'
import { motivosService } from '@/services/motivos'
import { ToqueComCalculo, ModeloRecord, MotivoRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Building2,
  Mail,
  Phone,
  Globe,
  Instagram,
  Linkedin,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  History,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  CalendarCheck,
  PhoneCall,
  Trash2,
  Plus,
  Info,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmpresaDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresa: EmpresaRecord | null
  users?: UserRecord[]
  diasAlerta?: number
  readOnly?: boolean
  onSuccess: () => void
  onCreatedEmpresaSelect?: (empresa: EmpresaRecord) => void
}

export function EmpresaDetailModal({
  open,
  onOpenChange,
  empresa: initialEmpresa,
  users = [],
  diasAlerta = 5,
  readOnly = false,
  onSuccess,
  onCreatedEmpresaSelect,
}: EmpresaDetailModalProps) {
  const [currentEmpresa, setCurrentEmpresa] = useState<EmpresaRecord | null>(initialEmpresa)

  useEffect(() => {
    setCurrentEmpresa(initialEmpresa)
  }, [initialEmpresa])

  const empresa = currentEmpresa
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<
    'dados' | 'contratos' | 'contatos' | 'cadencia' | 'timeline'
  >('dados')
  const [submitting, setSubmitting] = useState(false)
  const [consultandoCnpj, setConsultandoCnpj] = useState(false)
  const [avisoApi, setAvisoApi] = useState<string | null>(null)

  // Sub-entidades carregadas
  const [contratos, setContratos] = useState<ContratoRecord[]>([])
  const [contatos, setContatos] = useState<ContatoRecord[]>([])
  const [toquesCalculados, setToquesCalculados] = useState<ToqueComCalculo[]>([])
  const [modelos, setModelos] = useState<ModeloRecord[]>([])
  const [motivosInativacao, setMotivosInativacao] = useState<MotivoRecord[]>([])
  const [motivosCancelamento, setMotivosCancelamento] = useState<MotivoRecord[]>([])
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Form Fields
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [situacaoCadastral, setSituacaoCadastral] = useState('ATIVA')
  const [cnae, setCnae] = useState('')
  const [porte, setPorte] = useState('')
  const [uf, setUf] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [telefones, setTelefones] = useState<import('@/types').TelefoneEmpresaItem[]>([])
  const [instagram, setInstagram] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [site, setSite] = useState('')
  const [etapaFunil, setEtapaFunil] = useState<EmpresaRecord['etapa_funil']>('identificada')
  const [curva, setCurva] = useState<EmpresaRecord['curva']>('C')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<EmpresaRecord['status']>('ativa')
  const [observacoes, setObservacoes] = useState('')

  // Explicação detalhada da Curva ABC
  const [explicacaoCurva, setExplicacaoCurva] = useState<string>('')
  const [scoreCalculado, setScoreCalculado] = useState<number>(0)

  // Estado para adicionar novo telefone na lista
  const [novoTelefoneNumero, setNovoTelefoneNumero] = useState('')
  const [novoTelefoneTipo, setNovoTelefoneTipo] =
    useState<import('@/types').TipoTelefoneEmpresa>('celular')
  const [novoTelefoneDesc, setNovoTelefoneDesc] = useState('')

  // Detecção dos 3 Cenários
  const [cenarioDetectado, setCenarioDetectado] = useState<CenarioEntrada>('nova')
  const [empresaExistenteDetectada, setEmpresaExistenteDetectada] = useState<EmpresaRecord | null>(
    null,
  )
  const [cnpjErro, setCnpjErro] = useState<string | null>(null)

  // WhatsApp quick text dialog para o contato geral da empresa
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waMessage, setWaMessage] = useState('')

  // Ao abrir ou trocar de empresa
  useEffect(() => {
    if (!open) return
    setActiveTab('dados')
    setAvisoApi(null)
    setCnpjErro(null)

    if (empresa) {
      // Modo edição/visualização
      setRazaoSocial(empresa.razao_social || '')
      setNomeFantasia(empresa.nome_fantasia || '')
      setCnpj(formatCnpj(empresa.cnpj || ''))
      setSituacaoCadastral(empresa.situacao_cadastral || 'ATIVA')
      setCnae(empresa.cnae || '')
      setPorte(empresa.porte || '')
      setUf(empresa.uf || '')
      setMunicipio(empresa.municipio || '')
      setEmail(empresa.email || '')
      setTelefone(empresa.telefone || '')

      // Múltiplos telefones: carregar do JSON ou inicializar com o telefone principal
      if (Array.isArray(empresa.telefones) && empresa.telefones.length > 0) {
        setTelefones(empresa.telefones)
      } else if (empresa.telefone) {
        setTelefones([
          {
            id: 'tel_1',
            numero: empresa.telefone,
            tipo: 'celular',
            ramalOuDescricao: 'Principal',
          },
        ])
      } else {
        setTelefones([])
      }

      setInstagram(empresa.instagram || '')
      setLinkedin(empresa.linkedin || '')
      setSite(empresa.site || '')
      setEtapaFunil(empresa.etapa_funil || 'identificada')
      setCurva(empresa.curva || 'C')
      setScoreCalculado(empresa.score || 0)
      setResponsavel(empresa.responsavel || '')
      setStatus(empresa.status || 'ativa')
      setObservacoes(empresa.observacoes || '')
      setCenarioDetectado(empresa.etapa_funil === 'parceira' ? 'parceira' : 'cadastrada')
      setEmpresaExistenteDetectada(empresa)

      loadSubData(empresa.id)
    } else {
      // Modo novo cadastro
      setRazaoSocial('')
      setNomeFantasia('')
      setCnpj('')
      setSituacaoCadastral('ATIVA')
      setCnae('')
      setPorte('')
      setUf('')
      setMunicipio('')
      setEmail('')
      setTelefone('')
      setTelefones([])
      setNovoTelefoneNumero('')
      setNovoTelefoneTipo('celular')
      setNovoTelefoneDesc('')
      setInstagram('')
      setLinkedin('')
      setSite('')
      setEtapaFunil('identificada')
      setCurva('C')
      setScoreCalculado(0)
      setExplicacaoCurva('')
      setResponsavel(users[0]?.id || '')
      setStatus('ativa')
      setObservacoes('')
      setCenarioDetectado('nova')
      setEmpresaExistenteDetectada(null)
      setContratos([])
      setContatos([])
      setTimelineLogs([])
    }
  }, [open, empresa])

  const loadSubData = async (empId: string) => {
    try {
      const [cts, ctos, tqs, mods, motsInat, motsCanc] = await Promise.all([
        contratosService.listByEmpresa(empId),
        contatosService.listByEmpresa(empId),
        toquesService.getByEmpresa(empId),
        modelosService.list(),
        motivosService.listAtivos('inativacao'),
        motivosService.listAtivos('cancelamento_toque'),
      ])
      setContratos(cts)
      setContatos(ctos)
      setModelos(mods)
      setMotivosInativacao(motsInat)
      setMotivosCancelamento(motsCanc)

      // Apurar Curva ABC e explicação com a base atual
      try {
        const todasEmpresas = await empresasService.list()
        const todosContratos = await contratosService.listAll()
        const contratosMap = new Map<string, ContratoRecord[]>()
        todosContratos.forEach((c) => {
          if (!contratosMap.has(c.empresa)) contratosMap.set(c.empresa, [])
          contratosMap.get(c.empresa)!.push(c)
        })
        const classificacao = scoreCurvaService.classificarBaseEmpresas(todasEmpresas, contratosMap)
        const res = classificacao.get(empId)
        if (res) {
          setCurva(res.curva)
          setScoreCalculado(res.score)
          setExplicacaoCurva(res.explicacao || '')
          // Se mudou curva no cálculo, sincroniza no banco
          if (empresa && (empresa.curva !== res.curva || empresa.score !== res.score)) {
            empresasService.update(empId, { curva: res.curva, score: res.score }).catch(() => {})
          }
        } else {
          const calcIsolado = scoreCurvaService.calcular(cts, empresa?.cnae)
          setCurva(calcIsolado.curva)
          setScoreCalculado(calcIsolado.score)
          setExplicacaoCurva(calcIsolado.explicacao || '')
        }
      } catch (e) {
        const calcIsolado = scoreCurvaService.calcular(cts, empresa?.cnae)
        setCurva(calcIsolado.curva)
        setScoreCalculado(calcIsolado.score)
        setExplicacaoCurva(calcIsolado.explicacao || '')
      }

      const calc = toquesService.calcularStatusToques(tqs, diasAlerta || 5)
      setToquesCalculados(calc)

      setLoadingTimeline(true)
      const logs = await empresaTimelineService.getTimeline(
        empId,
        cts.map((c) => c.id),
        ctos.map((ct) => ct.id),
      )
      setTimelineLogs(logs)
    } catch (err) {
      console.error('Erro ao carregar dados relacionados:', err)
    } finally {
      setLoadingTimeline(false)
    }
  }

  // Funções para gerenciar múltiplos telefones
  const handleAdicionarTelefone = () => {
    if (!novoTelefoneNumero.trim()) {
      toast({
        title: 'Número obrigatório',
        description: 'Digite o número do telefone com DDD.',
        variant: 'destructive',
      })
      return
    }

    const item: TelefoneEmpresaItem = {
      id: `tel_${Date.now()}`,
      numero: novoTelefoneNumero.trim(),
      tipo: novoTelefoneTipo,
      ramalOuDescricao: novoTelefoneDesc.trim() || undefined,
    }

    const atualizados = [...telefones, item]
    setTelefones(atualizados)
    // Se ainda não tiver telefone geral, define este
    if (!telefone) {
      setTelefone(item.numero)
    }
    setNovoTelefoneNumero('')
    setNovoTelefoneDesc('')
    setNovoTelefoneTipo('celular')
  }

  const handleRemoverTelefone = (id: string) => {
    const atualizados = telefones.filter((t) => t.id !== id)
    setTelefones(atualizados)
    if (telefone && !atualizados.some((t) => t.numero === telefone)) {
      setTelefone(atualizados[0]?.numero || '')
    }
  }

  // Detectar cenário e consultar BrasilAPI ao alterar o CNPJ
  const handleCnpjChange = async (val: string) => {
    const formatted = formatCnpj(val)
    setCnpj(formatted)
    const raw = cleanCnpj(val)

    if (raw.length < 14) {
      setCnpjErro(null)
      setAvisoApi(null)
      if (!empresa) {
        setCenarioDetectado('nova')
        setEmpresaExistenteDetectada(null)
      }
      return
    }

    // Validar dígitos verificadores
    if (!isValidCnpj(raw)) {
      setCnpjErro('CNPJ inválido (dígitos verificadores incorretos).')
      return
    }
    setCnpjErro(null)

    // Se estamos cadastrando uma nova empresa, checar duplicidade no banco
    if (!empresa) {
      try {
        const existente = await empresasService.findByCnpj(raw)
        if (existente) {
          setEmpresaExistenteDetectada(existente)
          if (existente.etapa_funil === 'parceira') {
            setCenarioDetectado('parceira')
          } else {
            setCenarioDetectado('cadastrada')
          }
          toast({
            title: 'CNPJ já cadastrado no sistema!',
            description: `A empresa "${existente.razao_social}" já existe. O sistema orientará para inclusão de contratos mantendo a etapa do funil.`,
          })
          return
        } else {
          setCenarioDetectado('nova')
          setEmpresaExistenteDetectada(null)
        }
      } catch (e) {
        console.warn('Erro ao checar CNPJ existente:', e)
      }
    }

    // Consultar BrasilAPI
    consultarApiReceita(raw)
  }

  const consultarApiReceita = async (rawCnpj: string) => {
    if (!rawCnpj || rawCnpj.length !== 14) return
    setConsultandoCnpj(true)
    setAvisoApi(null)
    try {
      const data = await brasilApiService.consultarCnpj(rawCnpj)

      if (!data) {
        throw new Error('Resposta vazia da BrasilAPI')
      }

      // Preencher campos com segurança absoluta contra undefined
      if (data.razao_social) setRazaoSocial(String(data.razao_social).trim())
      if (data.nome_fantasia) setNomeFantasia(String(data.nome_fantasia).trim())
      if (data.situacao_cadastral)
        setSituacaoCadastral(String(data.situacao_cadastral).toUpperCase().trim())
      if (data.cnae_fiscal_descricao) {
        setCnae(`${data.cnae_fiscal || ''} - ${data.cnae_fiscal_descricao}`)
      }
      if (data.porte) setPorte(String(data.porte).trim())
      if (data.uf) setUf(String(data.uf).toUpperCase().trim())
      if (data.municipio) setMunicipio(String(data.municipio).trim())
      if (data.email) setEmail(String(data.email).toLowerCase().trim())

      const telsEncontrados: TelefoneEmpresaItem[] = []
      if (data.ddd_telefone_1) {
        const formatted1 = formatPhoneBr(String(data.ddd_telefone_1))
        setTelefone(formatted1)
        telsEncontrados.push({
          id: `tel_api_1_${Date.now()}`,
          numero: formatted1,
          tipo: 'fixo',
          ramalOuDescricao: 'Receita Federal 1',
        })
      }
      if (data.ddd_telefone_2) {
        const formatted2 = formatPhoneBr(String(data.ddd_telefone_2))
        telsEncontrados.push({
          id: `tel_api_2_${Date.now()}`,
          numero: formatted2,
          tipo: 'fixo',
          ramalOuDescricao: 'Receita Federal 2',
        })
      }

      if (telsEncontrados.length > 0) {
        setTelefones((prev) => {
          const jaExistem = new Set(prev.map((t) => cleanPhoneForWa(t.numero)))
          const novos = telsEncontrados.filter((t) => !jaExistem.has(cleanPhoneForWa(t.numero)))
          return [...prev, ...novos]
        })
      }

      toast({
        title: 'Dados sincronizados via BrasilAPI',
        description: 'Razão social, situação cadastral e endereço preenchidos.',
      })
    } catch (err: unknown) {
      console.warn('Erro ao consultar BrasilAPI:', err)
      const msg = err instanceof Error ? err.message : 'Falha na consulta'
      setAvisoApi(
        `Não foi possível consultar os dados automaticamente (${msg}) — preencha manualmente.`,
      )
    } finally {
      setConsultandoCnpj(false)
    }
  }

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!razaoSocial.trim()) {
      toast({
        title: 'Razão Social obrigatória',
        description: 'Informe a razão social da empresa.',
        variant: 'destructive',
      })
      return
    }

    const rawCnpj = cleanCnpj(cnpj)
    if (rawCnpj) {
      if (!isValidCnpj(rawCnpj)) {
        toast({
          title: 'CNPJ Inválido',
          description: 'Corrija os dígitos verificadores do CNPJ antes de salvar.',
          variant: 'destructive',
        })
        return
      }

      // Bloqueio de duplicidade se for nova empresa
      if (!empresa) {
        const existente = await empresasService.findByCnpj(rawCnpj)
        if (existente) {
          toast({
            title: 'CNPJ já cadastrado',
            description: `Já existe uma empresa cadastrada com este CNPJ (${existente.razao_social}).`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const telPrincipal = telefone.trim() || telefones[0]?.numero || ''

      const payload: CreateEmpresaData = {
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim(),
        cnpj: formatCnpj(cnpj) || '',
        situacao_cadastral: situacaoCadastral.trim() || 'ATIVA',
        cnae: cnae.trim(),
        porte: porte.trim(),
        uf: uf.trim().toUpperCase(),
        municipio: municipio.trim(),
        email: email.trim().toLowerCase(),
        telefone: telPrincipal,
        telefones,
        instagram: instagram.trim(),
        linkedin: linkedin.trim(),
        site: site.trim(),
        etapa_funil: etapaFunil,
        curva,
        score: scoreCalculado,
        responsavel: responsavel || undefined,
        status,
        observacoes: observacoes.trim(),
      }

      if (empresa) {
        await empresasService.update(empresa.id, payload)
        toast({
          title: 'Empresa atualizada com sucesso',
          description: 'Os dados cadastrais foram salvos no sistema.',
        })
        onSuccess()
        onOpenChange(false)
      } else {
        // Cenário 1: Nova empresa -> etapa_funil = "identificada"
        payload.etapa_funil = 'identificada'
        const created = await empresasService.create(payload)
        toast({
          title: 'Empresa cadastrada com sucesso',
          description:
            'Redirecionando para a ficha completa para inclusão de contratos e contatos.',
        })
        onSuccess()
        // Item 9: Ao salvar empresa nova, redireciona para a ficha completa dela abrindo a aba contratos
        setCurrentEmpresa(created)
        setCenarioDetectado('cadastrada')
        setEmpresaExistenteDetectada(created)
        if (onCreatedEmpresaSelect) {
          onCreatedEmpresaSelect(created)
        }
        loadSubData(created.id)
        setActiveTab('contratos')
      }
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar empresa',
        description: err instanceof Error ? err.message : 'Falha na gravação dos dados.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openWaEmpresa = () => {
    const rawNum = cleanPhoneForWa(telefone)
    if (!rawNum) {
      toast({
        title: 'Sem telefone comercial',
        description: 'Cadastre o telefone da empresa para abrir conversa.',
        variant: 'destructive',
      })
      return
    }
    setWaMessage(
      `Olá! Somos da Engenharia Contratos. Gostaríamos de apresentar nossas soluções técnicas em projetos e orçamentos para a ${nomeFantasia || razaoSocial}. Com quem podemos conversar?`,
    )
    setWaModalOpen(true)
  }

  const confirmSendWaEmpresa = () => {
    const rawNum = cleanPhoneForWa(telefone)
    if (!rawNum) return
    window.open(`https://wa.me/${rawNum}?text=${encodeURIComponent(waMessage)}`, '_blank')
    setWaModalOpen(false)
  }

  const isSituacaoInativa = situacaoCadastral && situacaoCadastral.toUpperCase() !== 'ATIVA'

  const totalAtivo = contratos
    .filter((c) => contratosService.isContratoAtivo(c))
    .reduce((acc, c) => acc + (c.valor || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho da Empresa */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  {empresa ? razaoSocial || 'Detalhes da Empresa' : 'Cadastrar Nova Empresa'}
                </DialogTitle>
                {empresa && (
                  <Badge
                    variant="outline"
                    className={
                      status === 'ativa'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-red-50 text-red-700 border-red-300'
                    }
                  >
                    {status === 'ativa' ? 'Ativa' : 'Inativa'}
                  </Badge>
                )}
                {empresa && (
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="font-mono bg-blue-50 text-blue-700 border-blue-300"
                    >
                      Curva {curva} (Automática)
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-300"
                      title="Índice Composto: 50% Valor Ativo + 30% Vigência Restante + 20% Qtd Contratos"
                    >
                      Índice: {empresa.score || 0}/100
                    </Badge>
                  </div>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                {empresa ? (
                  <>
                    CNPJ: {formatCnpj(cnpj) || 'Não informado'} |{' '}
                    {municipio ? `${municipio}/${uf}` : 'Localização não informada'}
                  </>
                ) : (
                  'Informe o CNPJ para preenchimento automático via BrasilAPI e identificação de cenário de entrada.'
                )}
              </DialogDescription>
            </div>

            {/* Botões de Ação Rápida de Contato no Cabeçalho (aparecem somente se preenchidos) */}
            {empresa && (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Item 11: Botão Enviar e-mail com mailto:grupomais.sae@gmail.com */}
                <a
                  href="mailto:grupomais.sae@gmail.com"
                  className="p-2 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors shadow-xs"
                  title="Enviar e-mail oficial (grupomais.sae@gmail.com)"
                >
                  <Mail className="w-4 h-4" />
                </a>

                {telefone && (
                  <button
                    type="button"
                    onClick={openWaEmpresa}
                    className="p-2 rounded-md bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 transition-colors shadow-xs"
                    title={`Abrir WhatsApp (${telefone})`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}

                {instagram && (
                  <a
                    href={
                      instagram.startsWith('http')
                        ? instagram
                        : `https://instagram.com/${instagram.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-md bg-white border border-slate-200 hover:bg-pink-50 text-slate-700 hover:text-pink-600 transition-colors shadow-xs"
                    title="Abrir Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}

                {linkedin && (
                  <a
                    href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-md bg-white border border-slate-200 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors shadow-xs"
                    title="Abrir LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}

                {site && (
                  <a
                    href={site.startsWith('http') ? site : `https://${site}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors shadow-xs"
                    title="Abrir Website"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Banner de Alerta se Situação Cadastral != ATIVA */}
          {isSituacaoInativa && (
            <div className="mt-3 px-3 py-2 bg-red-100/90 border border-red-300 rounded-md text-red-900 text-xs flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                <strong>Atenção Cadastral:</strong> A situação deste CNPJ na Receita Federal é{' '}
                <strong className="uppercase underline">{situacaoCadastral}</strong> (não está
                ATIVA).
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Abas do Modal */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 border-b border-slate-200 bg-white shrink-0">
            <TabsList className="bg-transparent space-x-2 h-11 p-0">
              <TabsTrigger
                value="dados"
                className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent shadow-none text-xs font-semibold px-3 py-2.5"
              >
                <Building2 className="w-3.5 h-3.5 mr-1.5" /> Dados da Empresa
              </TabsTrigger>

              {empresa && (
                <>
                  <TabsTrigger
                    value="contratos"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent shadow-none text-xs font-semibold px-3 py-2.5"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Contratos Públicos (
                    {contratos.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="contatos"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent shadow-none text-xs font-semibold px-3 py-2.5"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" /> Contatos ({contatos.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="cadencia"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent shadow-none text-xs font-semibold px-3 py-2.5"
                  >
                    <CalendarCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Cadência de 5
                    Toques ({toquesCalculados.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="timeline"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none bg-transparent shadow-none text-xs font-semibold px-3 py-2.5"
                  >
                    <History className="w-3.5 h-3.5 mr-1.5" /> Linha do Tempo ({timelineLogs.length}
                    )
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* Conteúdo scrollável */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ABA DADOS DA EMPRESA */}
            <TabsContent value="dados" className="m-0 space-y-4">
              {/* Box de Orientação dos 3 Cenários (quando cadastrando novo ou CNPJ já detectado) */}
              {!empresa && (
                <div
                  className={`p-4 rounded-lg border text-xs ${
                    cenarioDetectado === 'parceira'
                      ? 'bg-purple-50 border-purple-300 text-purple-900'
                      : cenarioDetectado === 'cadastrada'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <Sparkles className="w-4 h-4" />
                    {cenarioDetectado === 'nova' && 'Cenário 1 — Nova Empresa Identificada'}
                    {cenarioDetectado === 'cadastrada' &&
                      'Cenário 2 — Empresa já Cadastrada no Sistema'}
                    {cenarioDetectado === 'parceira' &&
                      'Cenário 3 — Empresa Parceira (Alerta de Oportunidade)'}
                  </div>
                  <p>
                    {cenarioDetectado === 'nova' &&
                      'Empresa não localizada no banco. Ao salvar, ela entrará no funil comercial com a etapa inicial "Identificada" e você poderá lançar seus contratos ativos.'}
                    {cenarioDetectado === 'cadastrada' &&
                      `O CNPJ informado já pertence a "${empresaExistenteDetectada?.razao_social}". A etapa do funil será preservada (não reinicia). Você pode incluir novos contratos ativos.`}
                    {cenarioDetectado === 'parceira' &&
                      `A empresa "${empresaExistenteDetectada?.razao_social}" já é uma PARCEIRA homologada! A inclusão de novo contrato gerará alerta de oportunidade ao time Comercial sem retroceder o funil.`}
                  </p>
                </div>
              )}

              {/* Aviso da BrasilAPI se houve falha ou necessidade de preenchimento manual */}
              {avisoApi && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs flex items-center justify-between">
                  <span>{avisoApi}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => consultarApiReceita(cleanCnpj(cnpj))}
                    className="text-xs text-amber-900 hover:bg-amber-100"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              )}

              <form id="empresaForm" onSubmit={handleSaveEmpresa} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CNPJ */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empCnpj" className="flex items-center justify-between">
                      <span>CNPJ</span>
                      {consultandoCnpj && (
                        <span className="text-[10px] text-blue-600 animate-pulse font-normal">
                          Consultando BrasilAPI...
                        </span>
                      )}
                    </Label>
                    <Input
                      id="empCnpj"
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      disabled={readOnly}
                    />
                    {cnpjErro && <p className="text-[11px] text-red-600 font-medium">{cnpjErro}</p>}
                  </div>

                  {/* Razão Social */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="empRazao">Razão Social *</Label>
                    <Input
                      id="empRazao"
                      placeholder="Ex: Construtora Sulamericana de Infraestrutura Ltda"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      required
                      disabled={readOnly}
                    />
                  </div>

                  {/* Nome Fantasia */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="empFantasia">Nome Fantasia</Label>
                    <Input
                      id="empFantasia"
                      placeholder="Ex: Sulamericana Engenharia"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Situação Cadastral */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empSit">Situação Cadastral</Label>
                    <Input
                      id="empSit"
                      placeholder="Ex: ATIVA, BAIXADA, SUSPENSA"
                      value={situacaoCadastral}
                      onChange={(e) => setSituacaoCadastral(e.target.value)}
                      disabled={readOnly}
                      className={
                        isSituacaoInativa ? 'border-red-400 bg-red-50 text-red-800 font-bold' : ''
                      }
                    />
                  </div>

                  {/* Município */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empMun">Município</Label>
                    <Input
                      id="empMun"
                      placeholder="Ex: Belo Horizonte"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  {/* UF */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empUf">UF</Label>
                    <Input
                      id="empUf"
                      maxLength={2}
                      placeholder="MG"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Responsável Comercial */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empResp">Responsável</Label>
                    <select
                      id="empResp"
                      className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      disabled={readOnly}
                    >
                      <option value="">Selecione um responsável...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Curva ABC e Índice Composto (Classificação 100% Automática com transparência) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empCurva">Curva ABC & Índice (Automático)</Label>
                    <div className="flex items-center gap-2 h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-800">
                      <Badge
                        variant="outline"
                        className={`font-bold ${
                          curva === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : curva === 'B'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        Curva {curva}
                      </Badge>
                      <span className="text-slate-500 font-mono">
                        Índice: <strong>{scoreCalculado || empresa?.score || 0}</strong>/100
                      </span>
                    </div>
                  </div>

                  {/* Etapa do Funil */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empEtapa">Etapa do Funil</Label>
                    <select
                      id="empEtapa"
                      className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={etapaFunil}
                      onChange={(e) => setEtapaFunil(e.target.value as any)}
                      disabled={readOnly}
                    >
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

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empStatus">Status</Label>
                    <select
                      id="empStatus"
                      className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      disabled={readOnly}
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </div>

                  {/* Canais de Comunicação da Empresa */}
                  <div className="space-y-1.5">
                    <Label htmlFor="empEmail">E-mail Comercial</Label>
                    <Input
                      id="empEmail"
                      type="email"
                      placeholder="contato@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empTel">Telefone Principal (com DDI +55)</Label>
                    <Input
                      id="empTel"
                      placeholder="+55 (00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhoneBr(e.target.value, true))}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empSite">Site Oficial</Label>
                    <Input
                      id="empSite"
                      placeholder="https://empresa.com.br"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="empIg">Instagram</Label>
                    <Input
                      id="empIg"
                      placeholder="@empresa ou https://instagram.com/empresa"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="empLi">LinkedIn</Label>
                    <Input
                      id="empLi"
                      placeholder="https://linkedin.com/company/empresa"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Observações */}
                  <div className="space-y-1.5 md:col-span-3">
                    <Label htmlFor="empObs">Observações / Contexto da Engenharia</Label>
                    <Textarea
                      id="empObs"
                      rows={2}
                      placeholder="Pontos de atenção, nichos de atuação, demandas frequentes em licitações..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* Seção de Múltiplos Telefones (Item 8) */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Telefones da Empresa ({telefones.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Adicione múltiplos contatos (fixo, celular ou WhatsApp) com links diretos
                        para ligação e mensagem.
                      </p>
                    </div>
                  </div>

                  {/* Lista de Telefones cadastrados */}
                  {telefones.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mb-3">
                      {telefones.map((t) => {
                        const waNumero = cleanPhoneForWa(t.numero)
                        return (
                          <div
                            key={t.id}
                            className="p-2.5 rounded-md border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold uppercase ${
                                    t.tipo === 'whatsapp'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : t.tipo === 'celular'
                                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {t.tipo}
                                </Badge>
                                {t.ramalOuDescricao && (
                                  <span className="text-[10px] text-slate-500 truncate">
                                    {t.ramalOuDescricao}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs font-bold text-slate-900 block mt-1">
                                {t.numero}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Link tel: */}
                              <a
                                href={`tel:${cleanPhoneForWa(t.numero)}`}
                                className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-blue-700"
                                title="Ligar para o telefone"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </a>
                              {/* Link wa.me */}
                              {t.tipo === 'whatsapp' || t.tipo === 'celular' ? (
                                <a
                                  href={`https://wa.me/${waNumero}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700"
                                  title="Abrir no WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              ) : null}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoverTelefone(t.id)}
                                  className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                                  title="Remover telefone"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic mb-3">
                      Nenhum telefone adicional cadastrado.
                    </p>
                  )}

                  {/* Adicionar novo telefone */}
                  {!readOnly && (
                    <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="w-36 space-y-1">
                        <Label className="text-[11px]">Tipo</Label>
                        <select
                          className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                          value={novoTelefoneTipo}
                          onChange={(e) => setNovoTelefoneTipo(e.target.value as any)}
                        >
                          <option value="celular">Celular</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="fixo">Fixo</option>
                        </select>
                      </div>

                      <div className="flex-1 min-w-[180px] space-y-1">
                        <Label className="text-[11px]">Número com DDD (DDI +55)</Label>
                        <Input
                          placeholder="+55 (00) 00000-0000"
                          value={novoTelefoneNumero}
                          onChange={(e) =>
                            setNovoTelefoneNumero(formatPhoneBr(e.target.value, true))
                          }
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="flex-1 min-w-[140px] space-y-1">
                        <Label className="text-[11px]">Descrição / Setor (opcional)</Label>
                        <Input
                          placeholder="Ex: Comercial, Recepção"
                          value={novoTelefoneDesc}
                          onChange={(e) => setNovoTelefoneDesc(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAdicionarTelefone}
                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Telefone
                      </Button>
                    </div>
                  )}
                </div>

                {/* Bloco de Transparência da Curva ABC (Item 2) */}
                {empresa && (
                  <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200 rounded-md text-xs text-blue-900">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <Info className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>Transparência do Cálculo — Curva ABC & Score Composto</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {explicacaoCurva ||
                        `Classificada na Curva ${curva} com Índice Composto ${scoreCalculado || empresa.score || 0}/100. Ponderação: 50% Valor dos Contratos Ativos, 30% Vigência Restante e 20% Quantidade de Contratos. Regra de piso aplicada: a maior empresa da base nunca é classificada como C.`}
                    </p>
                  </div>
                )}
              </form>
            </TabsContent>

            {/* ABA CONTRATOS */}
            {empresa && (
              <TabsContent value="contratos" className="m-0">
                <EmpresaContratosTab
                  empresaId={empresa.id}
                  contratos={contratos}
                  diasAlerta={diasAlerta}
                  readOnly={readOnly}
                  onContratosChange={() => loadSubData(empresa.id)}
                />
              </TabsContent>
            )}

            {/* ABA CONTATOS */}
            {empresa && (
              <TabsContent value="contatos" className="m-0">
                <EmpresaContatosTab
                  empresaId={empresa.id}
                  empresaNome={nomeFantasia || razaoSocial}
                  contatos={contatos}
                  readOnly={readOnly}
                  onContatosChange={() => loadSubData(empresa.id)}
                />
              </TabsContent>
            )}

            {/* ABA CADÊNCIA DE 5 TOQUES */}
            {empresa && (
              <TabsContent value="cadencia" className="m-0">
                <EmpresaCadenciaTab
                  empresa={empresa}
                  toques={toquesCalculados}
                  contatos={contatos}
                  contratos={contratos}
                  modelos={modelos}
                  motivosInativacao={motivosInativacao}
                  motivosCancelamento={motivosCancelamento}
                  readOnly={readOnly}
                  onToquesChange={() => loadSubData(empresa.id)}
                />
              </TabsContent>
            )}

            {/* ABA TIMELINE */}
            {empresa && (
              <TabsContent value="timeline" className="m-0">
                <EmpresaTimelineTab logs={timelineLogs} loading={loadingTimeline} />
              </TabsContent>
            )}
          </div>
        </Tabs>

        {/* Rodapé do Modal */}
        <DialogFooter className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            {empresa && empresa.status !== 'inativa' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = `/propostas?nova=true&empresaId=${empresa.id}`
                }}
                className="text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 gap-1.5"
              >
                <FileText className="w-4 h-4 text-amber-600" />
                Elaborar Proposta
              </Button>
            )}
          </div>

          {!readOnly && (
            <Button
              type="submit"
              form="empresaForm"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Salvando...' : empresa ? 'Atualizar Empresa' : 'Cadastrar Empresa'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Modal Rápido de WhatsApp Geral da Empresa */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              WhatsApp — {nomeFantasia || razaoSocial}
            </DialogTitle>
            <DialogDescription>
              Mensagem para o telefone comercial <strong>{telefone}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label htmlFor="waEmpEdit">Mensagem inicial:</Label>
            <textarea
              id="waEmpEdit"
              rows={4}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmSendWaEmpresa}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" /> Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
