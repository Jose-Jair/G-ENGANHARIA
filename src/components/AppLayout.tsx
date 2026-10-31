import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS, UserRole } from '@/types'
import {
  Building2,
  Users,
  Sliders,
  FileCode2,
  ListFilter,
  History,
  LogOut,
  Shield,
  Home,
  CheckCircle,
  Kanban,
  Sparkles,
  ShieldAlert,
  Bell,
  CalendarCheck,
  Megaphone,
  Handshake,
  UserCheck,
  FileText,
  Briefcase,
  HardHat,
  DollarSign,
  LayoutDashboard,
  BookOpen,
  KeyRound,
  Mail,
  MessageSquare,
  FileCheck,
  Clock,
  CheckSquare,
} from 'lucide-react'
import { ModalTrocarSenha } from '@/components/ModalTrocarSenha'
import { GPlusLogo } from '@/components/GPlusLogo'
import { projetosService } from '@/services/projetos'
import { toquesService } from '@/services/toques'
import { empresasService } from '@/services/empresas'
import { parametrosService } from '@/services/parametros'
import { propostasService } from '@/services/propostas'
import { contratosServicoService } from '@/services/contratosServico'
import { campanhasService } from '@/services/campanhas'
import { parceirosService } from '@/services/parceiros'
import { contratosService } from '@/services/contratos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateBr } from '@/lib/formatters'
import { openWhatsAppWithFallback } from '@/lib/whatsapp'

const ROLE_BADGE_VARIANTS: Record<UserRole, string> = {
  admin: 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20',
  comercial: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20',
  financeiro: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20',
  gestor: 'bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20',
  executor: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20',
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const [badgeAcoesCount, setBadgeAcoesCount] = useState<number>(0)
  const [badgeCriticosCount, setBadgeCriticosCount] = useState<number>(0)
  const [badgeCampanhasPendentesCount, setBadgeCampanhasPendentesCount] = useState<number>(0)
  const [badgeParceirosSemDemandaCount, setBadgeParceirosSemDemandaCount] = useState<number>(0)
  const [badgeDocumentosVencendoCount, setBadgeDocumentosVencendoCount] = useState<number>(0)
  const [badgeFinanceiroAlertasCount, setBadgeFinanceiroAlertasCount] = useState<number>(0)
  const [badgeFinanceiroAtrasadosCount, setBadgeFinanceiroAtrasadosCount] = useState<number>(0)
  const [badgeContratosPendentesCount, setBadgeContratosPendentesCount] = useState<number>(0)
  const [badgeSolicitacoesAlteracaoCount, setBadgeSolicitacoesAlteracaoCount] = useState<number>(0)
  const [badgeMedicoesApresentadasCount, setBadgeMedicoesApresentadasCount] = useState<number>(0)
  const [badgeNotificacoesBancoCount, setBadgeNotificacoesBancoCount] = useState<number>(0)
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false)

  // Carregar contagem de ações do dia + atrasos para a badge de notificações no sininho
  const carregarNotificacoes = async () => {
    if (!user?.role) {
      return
    }

    try {
      // Carregar notificações não lidas da coleção notificacoes
      try {
        const { notificacoesService } = await import('@/services/notificacoes')
        const totalNotifs = await notificacoesService.contarNaoLidas()
        setBadgeNotificacoesBancoCount(totalNotifs)
      } catch {
        /* intentionally ignored */
      }

      let diasLim = 5
      try {
        const p = await parametrosService.getByKey('dias_limite_atraso_toque')
        if (p?.valor) diasLim = parseInt(p.valor, 10) || 5
      } catch {
        /* intentionally ignored */
      }

      const [toquesData, empresasData] = await Promise.all([
        toquesService.listAtivos(),
        empresasService.list(),
      ])

      const empresasCadencia = new Set(
        empresasData
          .filter((e) => e.status === 'ativa' && e.etapa_funil === 'em_cadencia')
          .map((e) => e.id),
      )

      const porEmpresa: Record<string, typeof toquesData> = {}
      for (const t of toquesData) {
        if (empresasCadencia.has(t.empresa)) {
          if (!porEmpresa[t.empresa]) porEmpresa[t.empresa] = []
          porEmpresa[t.empresa].push(t)
        }
      }

      let countAcoes = 0
      let countCriticos = 0

      for (const empId of Object.keys(porEmpresa)) {
        const calc = toquesService.calcularStatusToques(porEmpresa[empId], diasLim)
        for (const item of calc) {
          if (
            item.isLiberadoParaExecucao &&
            (item.statusCalculado === 'para_hoje' || item.statusCalculado === 'em_atraso')
          ) {
            countAcoes++
            if (item.isCriticoAdmin) countCriticos++
          }
        }
      }

      setBadgeAcoesCount(countAcoes)
      setBadgeCriticosCount(countCriticos)

      // Regra de Solicitações de Alteração em Propostas (notificação sininho para Comercial e Admin)
      if (user.role === 'admin' || user.role === 'comercial') {
        try {
          const propsSolicitadas = await propostasService.list({
            status: 'solicitada_alteracao',
          })
          setBadgeSolicitacoesAlteracaoCount(propsSolicitadas.length)
        } catch {
          /* ignore */
        }
      } else {
        setBadgeSolicitacoesAlteracaoCount(0)
      }

      // Regra de Contratos de Serviço aguardando assinatura (Admin e Gestor de Projetos)
      if (user.role === 'admin' || user.role === 'gestor') {
        try {
          const contratosAguardando = await contratosServicoService.listAll()
          const pendentes = contratosAguardando.filter((c) => c.status !== 'assinado')
          setBadgeContratosPendentesCount(pendentes.length)
        } catch {
          /* ignore */
        }

        // Regra de Medições Progressivas aguardando aprovação (Admin e Gestor)
        try {
          const { medicoesService } = await import('@/services/medicoes')
          const countMeds = await medicoesService.countApresentadas()
          setBadgeMedicoesApresentadasCount(countMeds)
        } catch {
          /* ignore */
        }
      } else {
        setBadgeContratosPendentesCount(0)
        setBadgeMedicoesApresentadasCount(0)
      }

      // Regra da Etapa 5: Sininho alerta o Admin quando há campanha pendente de aprovação
      if (isAdmin) {
        try {
          const camps = await campanhasService.list()
          const pendentes = camps.filter((c) => c.status === 'rascunho' || c.status === 'devolvida')
          setBadgeCampanhasPendentesCount(pendentes.length)
        } catch {
          /* intentionally ignored */
        }
      } else {
        setBadgeCampanhasPendentesCount(0)
      }

      // Regra da Etapa 6 (A6): Alerta de parceiro sem demanda há mais de X dias direcionado ao Comercial / Admin
      try {
        let diasParceiroLim = 180
        try {
          const p = await parametrosService.getByKey('dias_alerta_sem_demanda_parceiro')
          if (p?.valor) diasParceiroLim = parseInt(p.valor, 10) || 180
        } catch {
          /* ignore */
        }

        const [parcs, props, projs, conts, contrs] = await Promise.all([
          parceirosService.listParceiros(),
          parceirosService.listPropostas(),
          parceirosService.listProjetos(),
          parceirosService.listContasReceber(),
          contratosService.listAll(),
        ])

        const inds = parceirosService.calcularIndicadoresParceiros(
          parcs,
          props,
          projs,
          conts,
          contrs,
          diasParceiroLim,
        )

        const semDemandaCriticos = inds.filter((i) => i.isSemDemandaCritica).length
        setBadgeParceirosSemDemandaCount(semDemandaCriticos)
      } catch {
        /* intentionally ignored */
      }

      // Regra da Etapa 8: Alertas de Documentos do Projeto D-30 / D-15 / D-7 / D-1 calculados ao abrir o sistema
      try {
        const docsAlerta = await projetosService.listDocumentosComAlertaGeral()
        setBadgeDocumentosVencendoCount(docsAlerta.length)
      } catch {
        /* intentionally ignored */
      }

      // Regra da Etapa 9: Alertas Financeiros D-7, D-1 e Contas Atrasadas (apenas para Admin e Financeiro)
      if (user?.role === 'admin' || user?.role === 'financeiro') {
        try {
          const { financeiroService } = await import('@/services/financeiro')
          const todasContas = await financeiroService.listAll()
          const alertasFin = financeiroService.calcularAlertasVencimento(todasContas)
          setBadgeFinanceiroAlertasCount(alertasFin.totalAlertas)
        } catch {
          /* intentionally ignored */
        }

        // Regra da Visão Gerencial: contagem de contas VENCIDAS (receber + pagar) calculada no servidor
        try {
          const { financeiroService: finSvc } = await import('@/services/financeiro')
          const cnt = await finSvc.getCountAtraso()
          setBadgeFinanceiroAtrasadosCount(cnt.total || 0)
        } catch {
          /* intentionally ignored */
        }
      }
    } catch {
      /* intentionally ignored */
    }
  }

  React.useEffect(() => {
    carregarNotificacoes()
    const timer = setInterval(carregarNotificacoes, 30000)

    const handleNotificacaoEvent = () => {
      carregarNotificacoes()
    }
    window.addEventListener('gmais:notificacao_atualizada', handleNotificacaoEvent)

    return () => {
      clearInterval(timer)
      window.removeEventListener('gmais:notificacao_atualizada', handleNotificacaoEvent)
    }
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#1E2A4A] text-slate-100 flex flex-col shrink-0 border-r border-[#141D34]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <NavLink to={isAdmin ? '/dashboard' : '/'} className="flex items-center gap-3 group">
            <GPlusLogo variant="compact" theme="dark" size={32} />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">GESTÃO G+</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D95A2B] text-white tracking-wider uppercase">
                  BETA
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">v1.0.0-beta</span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Modules (Strictly by Role) */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navegação Principal
          </div>

          {/* MENU PARA PRESTADOR / EXECUTOR EXTERNO */}
          {user?.role === 'executor' ? (
            <NavLink
              to="/portal-prestador"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <HardHat className="w-4 h-4 text-orange-300" />
              <div className="flex items-center justify-between flex-1">
                <span>Portal do Prestador</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-bold uppercase">
                  Meu Acesso
                </span>
              </div>
            </NavLink>
          ) : user?.role && (user.role === 'admin' || user.role === 'comercial') ? (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 text-orange-300" />
              <div className="flex items-center justify-between flex-1">
                <span>Dashboard</span>
                <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                  {isAdmin ? 'Admin' : 'Comercial'}
                </span>
              </div>
            </NavLink>
          ) : (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Home className="w-4 h-4 text-orange-300" />
              <span>Página Inicial</span>
            </NavLink>
          )}

          {/* Atalho ao Portal do Prestador para Administradores e Gestores (Supervisão) */}
          {(user?.role === 'admin' || user?.role === 'gestor') && (
            <NavLink
              to="/portal-prestador"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <HardHat className="w-4 h-4 text-amber-400" />
              <div className="flex items-center justify-between flex-1">
                <span>Portal do Prestador</span>
                <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  Visão
                </span>
              </div>
            </NavLink>
          )}

          {/* Módulo de Empresas / Cadastros (Admin, Comercial, Financeiro, Gestor) */}
          {user?.role && user.role !== 'executor' && (
            <NavLink
              to="/empresas"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Building2 className="w-4 h-4" />
              <div className="flex items-center justify-between flex-1">
                <span>Empresas</span>
                {(user.role === 'financeiro' || user.role === 'gestor') && (
                  <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                    Leitura
                  </span>
                )}
              </div>
            </NavLink>
          )}

          {/* ETAPA 6: Módulo Parceiros e Clientes (Admin, Comercial, Financeiro, Gestor) */}
          {user?.role && user.role !== 'executor' && (
            <>
              <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Parceiros e Clientes
              </div>

              <NavLink
                to="/parceiros"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Handshake className="w-4 h-4 text-emerald-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Parceiros</span>
                  {badgeParceirosSemDemandaCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white shadow-xs"
                      title={`${badgeParceirosSemDemandaCount} parceiro(s) sem demanda há mais de 180 dias`}
                    >
                      {badgeParceirosSemDemandaCount}
                    </span>
                  )}
                  {(user.role === 'financeiro' || user.role === 'gestor') && (
                    <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      Leitura
                    </span>
                  )}
                </div>
              </NavLink>

              <NavLink
                to="/clientes-pf"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Clientes PF</span>
                  {(user.role === 'financeiro' || user.role === 'gestor') && (
                    <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      Leitura
                    </span>
                  )}
                </div>
              </NavLink>

              {/* ETAPA 7: Módulo Propostas (Admin/Comercial gravam; Financeiro/Gestor leem) */}
              <NavLink
                to="/propostas"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <FileText className="w-4 h-4 text-orange-300" />
                <div className="flex items-center justify-between flex-1">
                  <span>Propostas</span>
                  {(user.role === 'financeiro' || user.role === 'gestor') && (
                    <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      Leitura
                    </span>
                  )}
                </div>
              </NavLink>

              {/* ETAPA 9: MÓDULO FINANCEIRO (Exclusivo Admin e Financeiro) */}
              {(user.role === 'admin' || user.role === 'financeiro') && (
                <>
                  <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Controladoria & Finanças
                  </div>

                  <NavLink
                    to="/financeiro"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <div className="flex items-center justify-between flex-1">
                      <span>Financeiro</span>
                      {badgeFinanceiroAlertasCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white shadow-xs"
                          title={`${badgeFinanceiroAlertasCount} conta(s) com alerta de vencimento (D-7/D-1/Atraso)`}
                        >
                          {badgeFinanceiroAlertasCount}
                        </span>
                      )}
                    </div>
                  </NavLink>
                </>
              )}

              {/* ETAPA 8: PROJETOS E PRESTADORES */}
              <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Operação de Engenharia
              </div>

              {/* Projetos: Leitura por Admin, Comercial, Financeiro, Gestor */}
              <NavLink
                to="/projetos"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Briefcase className="w-4 h-4 text-sky-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Projetos</span>
                  {badgeDocumentosVencendoCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-xs"
                      title={`${badgeDocumentosVencendoCount} documento(s) com alerta de vencimento`}
                    >
                      {badgeDocumentosVencendoCount}
                    </span>
                  )}
                  {(user.role === 'financeiro' || user.role === 'comercial') && (
                    <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      Leitura
                    </span>
                  )}
                </div>
              </NavLink>

              {/* Contratos de Serviço (G+ com Clientes) */}
              <NavLink
                to="/contratos-servico"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Contratos de Serviço</span>
                  {badgeContratosPendentesCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-xs"
                      title={`${badgeContratosPendentesCount} contrato(s) de serviço aguardando assinatura`}
                    >
                      {badgeContratosPendentesCount}
                    </span>
                  )}
                </div>
              </NavLink>

              {/* Prestadores de Serviço (Conceito Único): Admin, Gestor, Comercial */}
              {user.role !== 'financeiro' && (
                <NavLink
                  to="/prestadores"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Users className="w-4 h-4 text-amber-400" />
                  <div className="flex items-center justify-between flex-1">
                    <span>Prestadores</span>
                    {user.role === 'comercial' && (
                      <span className="text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Leitura
                      </span>
                    )}
                  </div>
                </NavLink>
              )}

              {/* RODADA 18: Fila Única de Decisões (Admin e Gestor) */}
              {(user.role === 'admin' || user.role === 'gestor') && (
                <NavLink
                  to="/decisoes"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <div className="flex items-center justify-between flex-1">
                    <span>Decisões</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                      Fila
                    </span>
                  </div>
                </NavLink>
              )}

              {/* RODADA 7: Monitoramento de Prazos e Cobrança (Admin e Gestor) */}
              {(user.role === 'admin' || user.role === 'gestor') && (
                <NavLink
                  to="/monitoramento"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <div className="flex items-center justify-between flex-1">
                    <span>Monitoramento</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                      Prazos
                    </span>
                  </div>
                </NavLink>
              )}
            </>
          )}

          {/* ETAPA 3: MÓDULO FUNIL COMERCIAL (Admin e Comercial exclusivamente) */}
          {user?.role && (user.role === 'admin' || user.role === 'comercial') && (
            <>
              <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Funil de Intermediação
              </div>

              <NavLink
                to="/acoes-do-dia"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <CalendarCheck className="w-4 h-4 text-amber-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Ações do Dia</span>
                  {badgeAcoesCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white shadow-xs">
                      {badgeAcoesCount}
                    </span>
                  )}
                </div>
              </NavLink>

              <NavLink
                to="/funil"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Kanban className="w-4 h-4 text-sky-400" />
                <span>Funil (5 Etapas)</span>
              </NavLink>

              <NavLink
                to="/campanhas"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Megaphone className="w-4 h-4 text-violet-400" />
                <div className="flex items-center justify-between flex-1">
                  <span>Nutrição Mensal</span>
                  {isAdmin && badgeCampanhasPendentesCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 shadow-xs"
                      title={`${badgeCampanhasPendentesCount} campanha(s) aguardando aprovação do Admin`}
                    >
                      {badgeCampanhasPendentesCount}
                    </span>
                  )}
                </div>
              </NavLink>

              <NavLink
                to="/funil/sugestoes"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Fila de Sugestões</span>
              </NavLink>

              <NavLink
                to="/nao-contatar"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Não Contatar</span>
              </NavLink>
            </>
          )}

          {/* AJUDA & MANUAL DE USO (Acesso geral com login) */}
          <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Ajuda & Documentação
          </div>
          <NavLink
            to="/manual"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
            <div className="flex items-center justify-between flex-1">
              <span>Manual de Uso</span>
              <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded font-medium">
                Guia
              </span>
            </div>
          </NavLink>

          {/* Admin Exclusive Links */}
          {isAdmin && (
            <>
              <div className="pt-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Gestão do Sistema (Admin)
              </div>

              <NavLink
                to="/administracao"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Shield className="w-4 h-4 text-orange-300" />
                <span>Administração</span>
              </NavLink>

              <NavLink
                to="/auditoria"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D95A2B] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <History className="w-4 h-4 text-orange-300" />
                <span>Auditoria Imutável</span>
              </NavLink>
            </>
          )}

          {user?.role === 'executor' && (
            <div className="mt-6 p-3 rounded-lg bg-black/20 border border-white/10 text-xs text-slate-300">
              <span className="font-semibold text-white block mb-1">Acesso Restrito:</span>
              Como prestador externo, suas ordens de serviço e demandas de engenharia são
              disponibilizadas pelo Gestor de Projetos no Portal do Prestador.
            </div>
          )}
        </div>

        {/* Contato Oficial G+ Engenharia na Sidebar */}
        <div className="px-3 py-2 border-t border-white/10 bg-[#17223b] text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Contato Oficial G+
          </span>
          <div className="space-y-1 text-[11px]">
            <a
              href="mailto:grupomais.sae@gmail.com"
              className="text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors truncate"
              title="E-mail Oficial (grupomais.sae@gmail.com)"
            >
              <Mail className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="truncate">grupomais.sae@gmail.com</span>
            </a>
            <button
              type="button"
              onClick={() => openWhatsAppWithFallback({ phone: '5588999441685' })}
              className="text-slate-300 hover:text-emerald-300 flex items-center gap-1.5 transition-colors text-left cursor-pointer w-full"
              title="Abrir WhatsApp Oficial no aplicativo desktop (ou WhatsApp Web)"
            >
              <MessageSquare className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>+55 88 9 9944-1685</span>
            </button>
          </div>
        </div>

        {/* User Card in Sidebar */}
        <div className="p-3 border-t border-white/10 bg-[#141D34]">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
            {user?.role && (
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold shrink-0 ${ROLE_BADGE_VARIANTS[user.role]}`}
              >
                {ROLE_LABELS[user.role]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <NavLink
              to="/manual"
              className="flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
              title="Manual de Uso da Plataforma"
            >
              <BookOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Manual</span>
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalSenhaOpen(true)}
              className="px-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 h-8"
              title="Alterar minha senha de acesso"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-300 mr-1 shrink-0" />
              <span>Senha</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="px-2 text-[11px] text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 h-8"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5 mr-1 shrink-0" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#1E2A4A] tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D95A2B]" />
              GESTÃO G+ • Engenharia
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-mono">
              Hoje: {formatDateBr(new Date().toISOString())}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Atalho para o Manual de Uso */}
            <NavLink
              to="/manual"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E2A4A] hover:text-[#D95A2B] bg-slate-100 hover:bg-orange-50 rounded-lg transition-colors border border-slate-200"
              title="Acessar Manual de Uso da Plataforma"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#D95A2B]" />
              <span>Manual de Uso</span>
            </NavLink>

            {/* Sininho com Badge de Notificações — Leva para a Central de Notificações */}
            {user?.role && (
              <NavLink
                to="/notificacoes"
                className="relative p-2 text-slate-600 hover:text-[#D95A2B] hover:bg-slate-100 rounded-full transition-colors"
                title={`Central de Notificações (${badgeNotificacoesBancoCount} nova(s) / alertas operacionais)`}
              >
                <Bell className="w-5 h-5" />
                {(badgeNotificacoesBancoCount > 0 ||
                  badgeAcoesCount > 0 ||
                  badgeSolicitacoesAlteracaoCount > 0 ||
                  badgeContratosPendentesCount > 0 ||
                  badgeMedicoesApresentadasCount > 0 ||
                  (isAdmin && badgeCampanhasPendentesCount > 0) ||
                  badgeParceirosSemDemandaCount > 0 ||
                  badgeDocumentosVencendoCount > 0 ||
                  badgeFinanceiroAtrasadosCount > 0) && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold text-white shadow-xs ${
                      badgeNotificacoesBancoCount > 0 ||
                      badgeCriticosCount > 0 ||
                      badgeSolicitacoesAlteracaoCount > 0 ||
                      badgeMedicoesApresentadasCount > 0 ||
                      badgeParceirosSemDemandaCount > 0 ||
                      badgeDocumentosVencendoCount > 0 ||
                      badgeFinanceiroAtrasadosCount > 0
                        ? 'bg-rose-600 animate-pulse'
                        : isAdmin && badgeCampanhasPendentesCount > 0
                          ? 'bg-amber-600'
                          : 'bg-[#D95A2B]'
                    }`}
                  >
                    {badgeNotificacoesBancoCount +
                      badgeAcoesCount +
                      badgeSolicitacoesAlteracaoCount +
                      badgeContratosPendentesCount +
                      badgeMedicoesApresentadasCount +
                      (isAdmin ? badgeCampanhasPendentesCount : 0) +
                      badgeParceirosSemDemandaCount +
                      badgeDocumentosVencendoCount +
                      badgeFinanceiroAtrasadosCount}
                  </span>
                )}
              </NavLink>
            )}

            {user && (
              <NavLink
                to="/manual"
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Ver perfil e Manual de Uso"
              >
                <div className="w-7 h-7 rounded-full bg-[#1E2A4A] text-white flex items-center justify-center text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-none">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 leading-none">
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
              </NavLink>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-slate-600 hover:text-red-600 hover:border-red-200"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sair
            </Button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>

        {/* Modal de Troca de Senha Própria */}
        <ModalTrocarSenha
          open={modalSenhaOpen}
          onOpenChange={setModalSenhaOpen}
          userName={user?.name}
          userEmail={user?.email}
        />
      </div>
    </div>
  )
}
