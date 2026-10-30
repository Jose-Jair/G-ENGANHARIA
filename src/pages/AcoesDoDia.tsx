import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  ToqueRecord,
  ToqueComCalculo,
  EmpresaRecord,
  ContatoRecord,
  ContratoRecord,
  ModeloRecord,
  MotivoRecord,
  CurvaABC,
  PropostaRecord,
} from '@/types'
import pb from '@/lib/pocketbase/client'
import { propostasService } from '@/services/propostas'
import { executoresService, ExecutorComMetricas } from '@/services/executores'
import { toquesService } from '@/services/toques'
import { empresasService } from '@/services/empresas'
import { contatosService } from '@/services/contatos'
import { contratosService } from '@/services/contratos'
import { modelosService } from '@/services/modelos'
import { motivosService } from '@/services/motivos'
import { parametrosService } from '@/services/parametros'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'
import { ConfirmarToqueModal } from '@/components/cadencia/ConfirmarToqueModal'
import { EnviarEmailModal } from '@/components/cadencia/EnviarEmailModal'
import { CancelarToqueModal } from '@/components/cadencia/CancelarToqueModal'
import { EmpresaDetailModal } from '@/components/empresas/EmpresaDetailModal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  Mail,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  RefreshCw,
  Phone,
  Ban,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  ArrowUpDown,
  Filter,
  Download,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { exportService } from '@/services/exportService'
import { useTempoRealContratos } from '@/hooks/useTempoRealContratos'
import { monitoramentoPrazosService } from '@/services/monitoramentoPrazos'
import { EventoCobrancaRecord, ResumoDiarioGestorRecord } from '@/types'
import { CardResumoDiarioGestor } from '@/components/monitoramento/CardResumoDiarioGestor'
import { CardCobrancaPrazo } from '@/components/monitoramento/CardCobrancaPrazo'

export default function AcoesDoDiaPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [toques, setToques] = useState<ToqueRecord[]>([])
  const [empresasMap, setEmpresasMap] = useState<Record<string, EmpresaRecord>>({})
  const [contatosMap, setContatosMap] = useState<Record<string, ContatoRecord[]>>({})
  const [contratosMap, setContratosMap] = useState<Record<string, ContratoRecord[]>>({})
  const [modelos, setModelos] = useState<ModeloRecord[]>([])
  const [motivosInativacao, setMotivosInativacao] = useState<MotivoRecord[]>([])
  const [motivosCancelamento, setMotivosCancelamento] = useState<MotivoRecord[]>([])
  const [diasLimiteAtraso, setDiasLimiteAtraso] = useState<number>(5)
  const [propostasAlteracao, setPropostasAlteracao] = useState<PropostaRecord[]>([])
  const [executoresAlertaVencimento, setExecutoresAlertaVencimento] = useState<
    ExecutorComMetricas[]
  >([])
  const [entregaveisAtrasados, setEntregaveisAtrasados] = useState<any[]>([])
  const [cotacoesVencidas, setCotacoesVencidas] = useState<any[]>([])
  const [pacotesSemElegiveis, setPacotesSemElegiveis] = useState<any[]>([])

  // Rodada 7: Monitoramento e Cobrança de Prazos (Admin/Gestor)
  const [eventosCobranca, setEventosCobranca] = useState<EventoCobrancaRecord[]>([])
  const [resumoDiario, setResumoDiario] = useState<ResumoDiarioGestorRecord | null>(null)
  const [carregandoResumo, setCarregandoResumo] = useState(false)

  // Filtros de tela
  const [busca, setBusca] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'todos' | 'email' | 'whatsapp'>('todos')
  const [filtroCurva, setFiltroCurva] = useState<'todas' | 'A' | 'B' | 'C'>('todas')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_atraso' | 'para_hoje'>('todos')

  // Modais de ação
  const [toqueConfirmar, setToqueConfirmar] = useState<ToqueComCalculo | null>(null)
  const [modalConfirmarOpen, setModalConfirmarOpen] = useState(false)

  const [toqueEmail, setToqueEmail] = useState<ToqueComCalculo | null>(null)
  const [modalEmailOpen, setModalEmailOpen] = useState(false)

  const [toqueCancelar, setToqueCancelar] = useState<ToqueComCalculo | null>(null)
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false)

  const [empresaDetalhe, setEmpresaDetalhe] = useState<EmpresaRecord | null>(null)
  const [modalEmpresaOpen, setModalEmpresaOpen] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      // 1. Carregar parâmetros
      try {
        const pLim = await parametrosService.getByKey('dias_limite_atraso_toque')
        if (pLim?.valor) setDiasLimiteAtraso(parseInt(pLim.valor, 10) || 5)
      } catch {
        /* intentionally ignored */
      }

      // 2. Carregar Toques ativos
      const toquesData = await toquesService.listAtivos()
      setToques(toquesData)

      // 3. Carregar Empresas relacionadas
      const empresaIds = Array.from(new Set(toquesData.map((t) => t.empresa).filter(Boolean)))
      const empresasObj: Record<string, EmpresaRecord> = {}
      const contatosObj: Record<string, ContatoRecord[]> = {}
      const contratosObj: Record<string, ContratoRecord[]> = {}

      if (empresaIds.length > 0) {
        // Carregar todas as empresas em uma tacada
        const todasEmpresas = await empresasService.list()
        todasEmpresas.forEach((emp) => {
          empresasObj[emp.id] = emp
        })

        // Buscar contratos e contatos dessas empresas
        await Promise.all(
          empresaIds.map(async (empId) => {
            try {
              const [cts, ctts] = await Promise.all([
                contratosService.listByEmpresa(empId),
                contatosService.listByEmpresa(empId),
              ])
              contratosObj[empId] = cts
              contatosObj[empId] = ctts
            } catch {
              /* intentionally ignored */
            }
          }),
        )
      }

      setEmpresasMap(empresasObj)
      setContratosMap(contratosObj)
      setContatosMap(contatosObj)

      // 4. Modelos e Motivos
      const [mods, motsInat, motsCanc] = await Promise.all([
        modelosService.list(),
        motivosService.listAtivos('inativacao'),
        motivosService.listAtivos('cancelamento_toque'),
      ])
      setModelos(mods)
      setMotivosInativacao(motsInat)
      setMotivosCancelamento(motsCanc)

      // 5. Carregar Propostas que solicitaram alteração (Ações do Dia para Comercial/Admin)
      try {
        const propsAlt = await propostasService.list({ status: 'solicitada_alteracao' })
        setPropostasAlteracao(propsAlt)
      } catch {
        /* ignore */
      }

      // 6. Carregar Executores com conselho vencendo em breve ou vencido (≤30 dias)
      try {
        const execs = await executoresService.listComMetricas()
        const comAlerta = execs.filter((ex) => ex.isRegistroVencido || ex.isRegistroVencendoBreve)
        setExecutoresAlertaVencimento(comAlerta)
      } catch {
        /* ignore */
      }

      // 7. Requisito 8: Carregar Entregáveis com prazo vencido e status não aprovado
      try {
        const hojeIso = new Date().toISOString()
        const entsVencidos = await pb.collection('entregaveis').getFullList({
          filter: `status != 'aprovado' && prazo != '' && prazo < '${hojeIso}'`,
          expand: 'prestador,etapa,etapa.projeto,ordem_servico',
          sort: 'prazo',
        })
        setEntregaveisAtrasados(entsVencidos)
      } catch {
        /* ignore */
      }

      // 8. Cotação Automática: Cotações vencidas sem resposta (status=expirada ou status=convite_enviado com prazo expirado)
      try {
        const agoraIso = new Date().toISOString()
        const cots = await pb.collection('cotacoes').getFullList({
          filter: `(status = 'expirada' || (status = 'convite_enviado' && data_limite_resposta != '' && data_limite_resposta < '${agoraIso}'))`,
          expand: 'pacote,etapa,prestador,projeto',
          sort: '-created',
        })
        setCotacoesVencidas(cots)
      } catch {
        /* ignore */
      }

      // 9. Cotação Automática: Pacotes externos sem prestadores elegíveis (audit_logs com acao='COTACAO_AUTOMATICA_SEM_ELEGIVEIS')
      try {
        const logsSemElegiveis = await pb.collection('audit_logs').getFullList({
          filter: "acao = 'COTACAO_AUTOMATICA_SEM_ELEGIVEIS'",
          sort: '-created',
        })
        setPacotesSemElegiveis(logsSemElegiveis)
      } catch {
        /* ignore */
      }

      // 10. Rodada 7: Eventos de Cobrança de Prazo recentes e Resumo Diário do Gestor
      try {
        const eventos = await monitoramentoPrazosService.listarEventos(undefined, '-created', 30)
        setEventosCobranca(eventos)
      } catch {
        /* ignore */
      }

      try {
        setCarregandoResumo(true)
        const resResumo = await monitoramentoPrazosService.obterResumoDiario()
        setResumoDiario(resResumo?.resumo || null)
      } catch {
        /* ignore */
      } finally {
        setCarregandoResumo(false)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Ações do Dia',
        description: err?.message || 'Falha ao sincronizar dados da cadência.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Atualização em tempo real via SSE (contratos, propostas, pré-cadastros) com fallback polling de 30s
  useTempoRealContratos({
    onRecarregar: () => {
      carregarDados()
    },
    escutarPreCadastros: true,
  })

  // Agrupar toques por empresa para rodar a lógica sequencial (calcularStatusToques)
  const toquesCalculados = useMemo(() => {
    const porEmpresa: Record<string, ToqueRecord[]> = {}
    for (const t of toques) {
      if (!porEmpresa[t.empresa]) porEmpresa[t.empresa] = []
      porEmpresa[t.empresa].push(t)
    }

    const todosCalculados: ToqueComCalculo[] = []
    for (const empId of Object.keys(porEmpresa)) {
      const calculados = toquesService.calcularStatusToques(porEmpresa[empId], diasLimiteAtraso)
      todosCalculados.push(...calculados)
    }

    // Filtrar apenas ações que são Para Hoje ou Em Atraso (ações ativas do dia liberadas)
    // Regra da Central: lista ações do dia liberadas para execução
    return todosCalculados.filter(
      (t) =>
        t.isLiberadoParaExecucao &&
        (t.statusCalculado === 'para_hoje' || t.statusCalculado === 'em_atraso'),
    )
  }, [toques, diasLimiteAtraso])

  // ORDENAÇÃO ESTRITA: CURVA (A -> B -> C) e depois por ATRASO (mais antigo primeiro / maior atraso)
  const toquesFiltradosEOrdenados = useMemo(() => {
    return toquesCalculados
      .filter((t) => {
        const emp = empresasMap[t.empresa]
        if (!emp) return false

        // Não exibir se a empresa estiver inativa ou se já saiu de 'em_cadencia'
        if (emp.status === 'inativa' || emp.etapa_funil !== 'em_cadencia') {
          return false
        }

        // Filtro texto
        if (busca) {
          const termo = busca.toLowerCase()
          const razao = emp.razao_social.toLowerCase()
          const fantasia = (emp.nome_fantasia || '').toLowerCase()
          const cnpj = (emp.cnpj || '').toLowerCase()
          if (!razao.includes(termo) && !fantasia.includes(termo) && !cnpj.includes(termo)) {
            return false
          }
        }

        // Filtro Canal
        if (filtroCanal !== 'todos' && t.canal !== filtroCanal) {
          return false
        }

        // Filtro Curva
        if (filtroCurva !== 'todas' && emp.curva !== filtroCurva) {
          return false
        }

        // Filtro Status
        if (filtroStatus !== 'todos' && t.statusCalculado !== filtroStatus) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const empA = empresasMap[a.empresa]
        const empB = empresasMap[b.empresa]

        // 1. Ordem de Curva: A (peso 1) -> B (peso 2) -> C (peso 3)
        const pesoCurva = (curva?: CurvaABC) => (curva === 'A' ? 1 : curva === 'B' ? 2 : 3)
        const diffCurva = pesoCurva(empA?.curva) - pesoCurva(empB?.curva)
        if (diffCurva !== 0) return diffCurva

        // 2. Ordem de Atraso: maior atraso primeiro (mais antigo primeiro)
        if (b.diasAtraso !== a.diasAtraso) {
          return b.diasAtraso - a.diasAtraso
        }

        // 3. Desempate por data prevista
        return (a.data_prevista || '').localeCompare(b.data_prevista || '')
      })
  }, [toquesCalculados, empresasMap, busca, filtroCanal, filtroCurva, filtroStatus])

  // Contadores
  const totalAtrasados = toquesCalculados.filter((t) => t.statusCalculado === 'em_atraso').length
  const totalParaHoje = toquesCalculados.filter((t) => t.statusCalculado === 'para_hoje').length
  const totalCriticosAdmin = toquesCalculados.filter((t) => t.isCriticoAdmin).length

  // Abrir WhatsApp diretamente
  const handleOpenWhatsApp = (toque: ToqueComCalculo) => {
    const emp = empresasMap[toque.empresa]
    if (!emp) return

    const contatos = contatosMap[emp.id] || []
    const decisor = contatos.find((c) => c.decisor && (c.whatsapp || c.telefone))
    const comTel = contatos.find((c) => c.whatsapp || c.telefone)
    const tel =
      decisor?.whatsapp ||
      decisor?.telefone ||
      comTel?.whatsapp ||
      comTel?.telefone ||
      emp.telefone ||
      ''

    if (!tel) {
      toast({
        title: 'Contato sem telefone',
        description: 'Cadastre o WhatsApp do contato decisor antes de iniciar o envio.',
        variant: 'destructive',
      })
      return
    }

    const contratos = contratosMap[emp.id] || []
    const contratoPrincipal = contratos[0]

    // Modelo de WhatsApp (Toque 2 ou Toque 4)
    const numToque = toque.numero_toque
    const modeloAtual =
      modelos.find((m) => m.nome.includes(`Toque ${numToque}`) || m.tipo === 'solucao_elaborada') ||
      null

    const url = toquesService.montarWhatsAppUrl({
      telefone: tel,
      modelo: modeloAtual,
      nomeContato: decisor?.nome || comTel?.nome || emp.nome_fantasia || 'Prezado(a)',
      nomeEmpresa: emp.nome_fantasia || emp.razao_social,
      orgao: contratoPrincipal?.orgao || 'órgão contratante',
      valorContrato: formatCurrencyBr(contratoPrincipal?.valor || 0),
    })

    window.open(url, '_blank')

    // Sugere abrir modal de confirmação para registrar o envio
    setTimeout(() => {
      setToqueConfirmar(toque)
      setModalConfirmarOpen(true)
    }, 500)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Central de Ações do Dia
            </h1>
            <Badge className="bg-blue-600 text-white font-mono text-xs">Etapa 4 — Cadência</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Fila diária de prospecção comercial da engenharia. Ordenada por prioridade estratégica
            (Curva A &rarr; B &rarr; C) e maior tempo de atraso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (toquesFiltradosEOrdenados.length === 0) {
                toast({
                  title: 'Sem ações para exportar',
                  description:
                    'A lista atual não contém toques pendentes com os filtros aplicados.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `acoes_do_dia_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'acoes_do_dia',
                  descricao: 'Exportação da esteira de Ações do Dia / Cadência de prospecção',
                  filtros: {
                    status: filtroStatus,
                    canal: filtroCanal,
                    curva: filtroCurva,
                    busca: busca || undefined,
                  },
                  columns: [
                    {
                      header: 'Empresa',
                      accessor: (t) => {
                        const emp = empresasMap[t.empresa]
                        return emp?.nome_fantasia || emp?.razao_social || 'Empresa'
                      },
                    },
                    {
                      header: 'CNPJ',
                      accessor: (t) => {
                        const emp = empresasMap[t.empresa]
                        return formatCnpj(emp?.cnpj || '')
                      },
                    },
                    {
                      header: 'Curva ABC',
                      accessor: (t) => empresasMap[t.empresa]?.curva || 'C',
                    },
                    { header: 'Toque', accessor: (t) => `Toque ${t.numero_toque}` },
                    {
                      header: 'Canal',
                      accessor: (t) => (t.canal === 'email' ? 'E-mail' : 'WhatsApp'),
                    },
                    {
                      header: 'Data Prevista',
                      accessor: (t) => formatDateBr(t.data_prevista),
                    },
                    {
                      header: 'Status',
                      accessor: (t) =>
                        t.statusCalculado === 'em_atraso'
                          ? `Em atraso (${t.diasAtraso}d)`
                          : 'Para hoje',
                    },
                    {
                      header: 'Decisor',
                      accessor: (t) => {
                        const contatos = contatosMap[t.empresa] || []
                        const decisor = contatos.find((c) => c.decisor) || contatos[0]
                        return decisor
                          ? `${decisor.nome} (${decisor.cargo || 'Cargo n/i'})`
                          : 'Não informado'
                      },
                    },
                    {
                      header: 'Órgão Contratante',
                      accessor: (t) => contratosMap[t.empresa]?.[0]?.orgao || 'Não informado',
                    },
                    {
                      header: 'Valor Contrato (R$)',
                      accessor: (t) => {
                        const v = contratosMap[t.empresa]?.[0]?.valor || 0
                        return formatCurrencyBr(v)
                      },
                    },
                  ],
                  data: toquesFiltradosEOrdenados,
                })
                toast({
                  title: 'Ações do Dia Exportadas',
                  description: `${toquesFiltradosEOrdenados.length} toque(s) exportado(s) com sucesso. Auditoria registrada.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar ações',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            disabled={loading}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* RODADA 7: RESUMO DIÁRIO DO GESTOR DE PROJETOS */}
      <CardResumoDiarioGestor
        resumo={resumoDiario}
        carregando={carregandoResumo}
        onAtualizar={carregarDados}
      />

      {/* RODADA 7: CARTÕES DE COBRANÇA DE PRAZO COM LINK WHATSAPP PRONTO */}
      {eventosCobranca.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Cobranças de Prazo & Lembretes WhatsApp ({eventosCobranca.length})
              </h2>
              <Badge className="bg-emerald-600 text-white text-[10px] font-mono">
                wa.me pronto
              </Badge>
            </div>
            <span className="text-[11px] text-slate-500">
              Disparos automáticos por degraus (D-3, D0, D+1, D+3 e SLA Revisor)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventosCobranca.map((ev) => (
              <CardCobrancaPrazo key={ev.id} evento={ev} onAcaoConcluida={carregarDados} />
            ))}
          </div>
        </div>
      )}

      {/* Seção Cotações Automáticas — Alertas: Vencidas sem Resposta e Sem Elegíveis */}
      {cotacoesVencidas.length > 0 && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/95 text-rose-950 flex items-start gap-3 shadow-xs">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <strong className="text-sm font-bold text-rose-900 block">
                Cotações automáticas expiradas sem resposta ({cotacoesVencidas.length})
              </strong>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/projetos')}
                className="h-6 text-[11px] border-rose-400 text-rose-900 hover:bg-rose-100"
              >
                Abrir Projetos e Pacotes &rarr;
              </Button>
            </div>
            <p className="text-rose-800 leading-relaxed">
              O prazo limite para envio de proposta pelos prestadores convidados expirou. Verifique
              o pacote de trabalho para convidar novos parceiros ou redefinir a estratégia de
              contratação:
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {cotacoesVencidas.map((cot) => {
                const pacoteId =
                  cot.pacote || cot.etapa || cot.expand?.pacote?.id || cot.expand?.etapa?.id
                const projetoId =
                  cot.projeto || cot.expand?.pacote?.projeto || cot.expand?.projeto?.id
                const projetoCodigo =
                  cot.expand?.projeto?.codigo ||
                  cot.expand?.pacote?.expand?.projeto?.codigo ||
                  'PRJ'
                const pacoteNome =
                  cot.expand?.pacote?.nome || cot.expand?.etapa?.nome || 'Pacote de Trabalho'
                const prestadorNome = cot.expand?.prestador?.nome || 'Prestador Convidado'

                return (
                  <div
                    key={cot.id}
                    onClick={() => {
                      if (projetoId) {
                        navigate(`/projetos?id=${projetoId}`)
                      } else {
                        navigate('/projetos')
                      }
                    }}
                    className="p-2.5 rounded-lg border border-rose-200 bg-white hover:border-rose-400 hover:shadow-xs transition-all flex flex-col justify-between gap-1 shadow-2xs cursor-pointer"
                    title="Clique para abrir o projeto correspondente"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 line-clamp-1 hover:text-rose-700">
                          {pacoteNome}
                        </span>
                        <span className="text-[10px] text-blue-600 underline font-medium">
                          {projetoCodigo}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 block truncate mt-0.5">
                        Prestador: <strong>{prestadorNome}</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-rose-100">
                      <span className="text-rose-700 font-bold">
                        Venceu em:{' '}
                        {cot.data_limite_resposta
                          ? formatDateBr(cot.data_limite_resposta)
                          : cot.data_limite
                            ? formatDateBr(cot.data_limite)
                            : 'Prazo esgotado'}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize border-rose-300 bg-rose-50 text-rose-800"
                      >
                        Expirada
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {pacotesSemElegiveis.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/95 text-amber-950 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <strong className="text-sm font-bold text-amber-900 block">
                Pacotes externos sem prestadores elegíveis ({pacotesSemElegiveis.length})
              </strong>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/prestadores')}
                className="h-6 text-[11px] border-amber-400 text-amber-900 hover:bg-amber-100"
              >
                Cadastrar / Regularizar Prestadores &rarr;
              </Button>
            </div>
            <p className="text-amber-800 leading-relaxed">
              O sistema disparou cotação automática para pacotes marcados como EXTERNOS, porém
              nenhum prestador homologado cumpriu todos os critérios (disciplina compatível,
              conselho de classe válido, capacidade simultânea livre e Contrato-Mestre assinado):
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {pacotesSemElegiveis.map((log) => {
                const det = log.detalhes || {}
                return (
                  <div
                    key={log.id}
                    onClick={() => navigate('/projetos')}
                    className="p-2.5 rounded-lg border border-amber-200 bg-white hover:border-amber-400 hover:shadow-xs transition-all flex flex-col justify-between gap-1 shadow-2xs cursor-pointer"
                    title="Clique para ir à tela de projetos"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 line-clamp-1">
                          {det.pacote_nome || 'Pacote Externo'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
                        >
                          {det.disciplina || 'Engenharia'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                        {det.aviso || 'Nenhum prestador cumpriu os 4 critérios de elegibilidade.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-amber-100 text-slate-500">
                      <span>Data: {formatDateBr(log.created)}</span>
                      <span className="text-blue-600 font-medium">Ver pacotes &rarr;</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Requisito 8: Alerta de Entregáveis em Atraso */}
      {entregaveisAtrasados.length > 0 && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-950 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <strong className="text-sm font-bold text-rose-900 block">
                Entregáveis com prazo vencido ({entregaveisAtrasados.length})
              </strong>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/projetos')}
                className="h-6 text-[11px] border-rose-400 text-rose-900 hover:bg-rose-100"
              >
                Abrir Projetos e Entregáveis &rarr;
              </Button>
            </div>
            <p className="text-rose-800 leading-relaxed">
              Estes itens impactam diretamente a pontualidade e a nota de tendência dos prestadores
              no ranqueamento inteligente:
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {entregaveisAtrasados.map((ent) => {
                const projetoId =
                  ent.expand?.etapa?.projeto || ent.expand?.etapa?.expand?.projeto?.id || ''
                const projetoCodigo =
                  ent.expand?.etapa?.expand?.projeto?.codigo || ent.expand?.etapa?.nome || ''
                return (
                  <div
                    key={ent.id}
                    onClick={() => {
                      if (projetoId) {
                        navigate(`/projetos?id=${projetoId}`)
                      } else {
                        navigate('/projetos')
                      }
                    }}
                    className="p-2.5 rounded-lg border border-rose-200 bg-white hover:border-rose-400 hover:shadow-xs transition-all flex flex-col justify-between gap-1 shadow-2xs cursor-pointer"
                    title={
                      projetoCodigo
                        ? `Ir para o projeto ${projetoCodigo}`
                        : 'Clique para ir ao projeto'
                    }
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 line-clamp-1 hover:text-rose-700">
                          {ent.titulo || ent.nome}
                        </span>
                        <span className="text-[10px] text-blue-600 underline font-medium">
                          {projetoCodigo ? `Projeto ${projetoCodigo}` : 'Ver'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block truncate">
                        Prestador: {ent.expand?.prestador?.nome || 'Não atribuído'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-rose-100">
                      <span className="text-rose-700 font-bold">
                        Vencido em: {formatDateBr(ent.prazo)}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize border-rose-300 text-rose-800"
                      >
                        {ent.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Executores com Conselho Vencendo (30 dias) ou Vencido */}
      {executoresAlertaVencimento.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <strong className="text-sm font-bold text-amber-900 block">
                Alerta de Habilitação Técnica: {executoresAlertaVencimento.length}{' '}
                {executoresAlertaVencimento.length === 1
                  ? 'executor requer renovação de anuidade'
                  : 'executores requerem renovação de anuidade'}
              </strong>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/executores')}
                className="h-6 text-[11px] border-amber-400 text-amber-900 hover:bg-amber-100"
              >
                Abrir Ficha de Executores &rarr;
              </Button>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Executores com registro de classe vencido têm bloqueio automático no servidor para
              recebimento de convites a novas cotações. Comunique os parceiros 30 dias antes do
              vencimento da anuidade:
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {executoresAlertaVencimento.map((ex) => (
                <div
                  key={ex.id}
                  className="p-2 bg-white/80 border border-amber-200 rounded text-[11px] flex items-center justify-between gap-1 shadow-2xs"
                >
                  <div className="truncate">
                    <span className="font-bold text-slate-800 block truncate">{ex.nome}</span>
                    <span className="text-[10px] text-slate-500">
                      {ex.conselho || 'Conselho'}: {ex.numero_registro || 'S/N'}
                    </span>
                  </div>
                  <Badge
                    className={`text-[9px] shrink-0 font-bold uppercase ${
                      ex.isRegistroVencido ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {ex.isRegistroVencido ? 'Vencido' : 'Vence em ≤30d'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Atraso Crítico para Admin */}
      {isAdmin && totalCriticosAdmin > 0 && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <strong className="text-sm font-bold text-rose-900 block mb-0.5">
              Alerta de Atraso Crítico da Cadência ({totalCriticosAdmin}{' '}
              {totalCriticosAdmin === 1 ? 'toque' : 'toques'} excedendo o limite de{' '}
              {diasLimiteAtraso} dias)
            </strong>
            <p className="text-rose-800 leading-relaxed">
              Existem empresas de alto potencial aguardando intervenção comercial além do prazo de
              tolerância configurado em Parâmetros. Notifique o time comercial para regularizar os
              toques em aberto ou arquivar a oportunidade.
            </p>
          </div>
        </div>
      )}

      {/* Cards de Métricas / Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => setFiltroStatus('todos')}
          className={`cursor-pointer transition-all border ${
            filtroStatus === 'todos' ? 'ring-2 ring-blue-500 shadow-sm' : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Ações Liberadas
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{toquesCalculados.length}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFiltroStatus('em_atraso')}
          className={`cursor-pointer transition-all border ${
            filtroStatus === 'em_atraso'
              ? 'ring-2 ring-rose-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                Em Atraso
              </p>
              <h3 className="text-2xl font-bold text-rose-700 mt-1">{totalAtrasados}</h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFiltroStatus('para_hoje')}
          className={`cursor-pointer transition-all border ${
            filtroStatus === 'para_hoje'
              ? 'ring-2 ring-emerald-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Para Hoje
              </p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">{totalParaHoje}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Buscar empresa por razão, nome ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Filtro Canal */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFiltroCanal('todos')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroCanal === 'todos'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600'
              }`}
            >
              Todos Canais
            </button>
            <button
              onClick={() => setFiltroCanal('email')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroCanal === 'email'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600'
              }`}
            >
              E-mail
            </button>
            <button
              onClick={() => setFiltroCanal('whatsapp')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroCanal === 'whatsapp'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600'
              }`}
            >
              WhatsApp
            </button>
          </div>

          {/* Filtro Curva */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFiltroCurva('todas')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filtroCurva === 'todas'
                  ? 'bg-white shadow-xs text-blue-700 font-bold'
                  : 'text-slate-600'
              }`}
            >
              Todas Curvas
            </button>
            <button
              onClick={() => setFiltroCurva('A')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filtroCurva === 'A' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600'
              }`}
            >
              Curva A
            </button>
            <button
              onClick={() => setFiltroCurva('B')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filtroCurva === 'B' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600'
              }`}
            >
              Curva B
            </button>
            <button
              onClick={() => setFiltroCurva('C')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filtroCurva === 'C' ? 'bg-slate-600 text-white font-bold' : 'text-slate-600'
              }`}
            >
              Curva C
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Ações */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800">
              Fila de Execução da Cadência ({toquesFiltradosEOrdenados.length} ações)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Ordem: Prioridade da Curva ABC e maior atraso decorrido.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              Sincronizando toques e regras de auditoria...
            </div>
          ) : toquesFiltradosEOrdenados.length === 0 ? (
            <div className="p-12 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  Nenhuma ação da cadência para hoje
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Quando você qualificar empresas e movê-las para a etapa{' '}
                  <strong>Em Cadência</strong> no funil, os toques multicanal (E-mail e WhatsApp)
                  serão gerados automaticamente e aparecerão listados aqui ordenados por prioridade.
                </p>
              </div>
              <div className="pt-1 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate('/funil')}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                >
                  Ir para o Funil de Vendas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/empresas')}
                  className="text-xs text-slate-700"
                >
                  Ver Empresas
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {toquesFiltradosEOrdenados.map((toque) => {
                const emp = empresasMap[toque.empresa]
                const contratos = contratosMap[toque.empresa] || []
                const contatos = contatosMap[toque.empresa] || []
                const decisor = contatos.find((c) => c.decisor) || contatos[0]
                const contratoPrincipal = contratos[0]

                // Indicador de Curva
                const badgeCurva =
                  emp?.curva === 'A' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-600 text-white shadow-xs">
                      Curva A
                    </span>
                  ) : emp?.curva === 'B' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-600 text-white shadow-xs">
                      Curva B
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-500 text-white shadow-xs">
                      Curva C
                    </span>
                  )

                // Indicador de Status
                const badgeStatus =
                  toque.statusCalculado === 'em_atraso' ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        toque.isCriticoAdmin
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Em atraso ({toque.diasAtraso}d)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      Para hoje
                    </span>
                  )

                const isEmail = toque.canal === 'email'

                // Verificar se a empresa tem aviso de pendência
                const hasPendenciaContato = emp?.proxima_acao_desc?.includes('PENDÊNCIA')

                return (
                  <div
                    key={toque.id}
                    className={`p-4 transition-colors hover:bg-slate-50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                      toque.isCriticoAdmin ? 'bg-rose-50/40 border-l-4 border-l-rose-500' : ''
                    }`}
                  >
                    {/* Informações da Empresa e Toque */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {badgeCurva}
                        <h4
                          onClick={() => {
                            setEmpresaDetalhe(emp)
                            setModalEmpresaOpen(true)
                          }}
                          className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer truncate"
                          title={emp?.razao_social}
                        >
                          {emp?.nome_fantasia || emp?.razao_social || 'Empresa'}
                        </h4>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs font-mono text-slate-500">
                          {emp?.cnpj || 'CNPJ não informado'}
                        </span>
                        {badgeStatus}
                      </div>

                      {/* Alerta de pendência de contato */}
                      {hasPendenciaContato && (
                        <div className="p-1 px-2 rounded bg-rose-100 text-rose-800 text-[11px] font-medium flex items-center gap-1.5 w-fit">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{emp.proxima_acao_desc}</span>
                        </div>
                      )}

                      {/* Contexto do Contrato e Contato */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          Contrato: <strong>
                            {contratoPrincipal?.orgao || 'Não informado'}
                          </strong> (
                          {formatCurrencyBr(contratoPrincipal?.valor || 0)})
                        </span>

                        <span className="text-slate-300">•</span>

                        <span className="flex items-center gap-1 text-slate-700">
                          Decisor: <strong>{decisor?.nome || 'Não cadastrado'}</strong>
                          {decisor?.cargo ? ` (${decisor.cargo})` : ''}
                        </span>
                      </div>

                      {/* Descrição do Toque */}
                      <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                        <span className="font-semibold text-blue-700">
                          Toque {toque.numero_toque} ({isEmail ? 'E-mail' : 'WhatsApp'}):
                        </span>
                        <span>{toque.observacao || 'Disparo programado pela cadência.'}</span>
                        <span className="font-mono text-slate-400">
                          (Previsto: {formatDateBr(toque.data_prevista)})
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {/* Ação 1: Executar Canal (Enviar E-mail ou Abrir WhatsApp) */}
                      {isEmail ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setToqueEmail(toque)
                            setModalEmailOpen(true)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                        >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          Enviar E-mail
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenWhatsApp(toque)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          Abrir WhatsApp
                        </Button>
                      )}

                      {/* Ação 2: Confirmar Toque */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setToqueConfirmar(toque)
                          setModalConfirmarOpen(true)
                        }}
                        className="text-xs h-8 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Confirmar
                      </Button>

                      {/* Ação 3: Cancelar Toque */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setToqueCancelar(toque)
                          setModalCancelarOpen(true)
                        }}
                        className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        title="Cancelar este toque com motivo oficial"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais Integrados */}
      {toqueConfirmar && (
        <ConfirmarToqueModal
          open={modalConfirmarOpen}
          onOpenChange={setModalConfirmarOpen}
          toque={toqueConfirmar}
          empresaNome={
            empresasMap[toqueConfirmar.empresa]?.nome_fantasia ||
            empresasMap[toqueConfirmar.empresa]?.razao_social
          }
          motivosInativacao={motivosInativacao}
          onSuccess={carregarDados}
        />
      )}

      {toqueEmail && (
        <EnviarEmailModal
          open={modalEmailOpen}
          onOpenChange={setModalEmailOpen}
          toque={toqueEmail}
          empresa={empresasMap[toqueEmail.empresa] || null}
          contatos={contatosMap[toqueEmail.empresa] || []}
          contratos={contratosMap[toqueEmail.empresa] || []}
          modelos={modelos}
          onSuccess={() => {
            carregarDados()
            // Sugere confirmação sequencial após o envio
            setToqueConfirmar(toqueEmail)
            setModalConfirmarOpen(true)
          }}
        />
      )}

      {toqueCancelar && (
        <CancelarToqueModal
          open={modalCancelarOpen}
          onOpenChange={setModalCancelarOpen}
          toque={toqueCancelar}
          empresaNome={
            empresasMap[toqueCancelar.empresa]?.nome_fantasia ||
            empresasMap[toqueCancelar.empresa]?.razao_social
          }
          motivosCancelamento={motivosCancelamento}
          onSuccess={carregarDados}
        />
      )}

      {empresaDetalhe && (
        <EmpresaDetailModal
          open={modalEmpresaOpen}
          onOpenChange={setModalEmpresaOpen}
          empresa={empresaDetalhe}
          onSuccess={carregarDados}
          readOnly={user?.role !== 'admin' && user?.role !== 'comercial'}
          onCreatedEmpresaSelect={(alvo) => setEmpresaDetalhe(alvo)}
          onEmpresaUpdate={(updated) => setEmpresaDetalhe(updated)}
        />
      )}
    </div>
  )
}
