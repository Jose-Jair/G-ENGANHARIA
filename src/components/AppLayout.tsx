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
} from 'lucide-react'
import { toquesService } from '@/services/toques'
import { empresasService } from '@/services/empresas'
import { parametrosService } from '@/services/parametros'
import { campanhasService } from '@/services/campanhas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateBr } from '@/lib/formatters'

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

  // Carregar contagem de ações do dia + atrasos para a badge de notificações no sininho
  const carregarNotificacoes = async () => {
    if (!user?.role || (user.role !== 'admin' && user.role !== 'comercial')) {
      return
    }

    try {
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
    } catch {
      /* intentionally ignored */
    }
  }

  React.useEffect(() => {
    carregarNotificacoes()
    const timer = setInterval(carregarNotificacoes, 30000)
    return () => clearInterval(timer)
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              Engenharia Contratos
            </h1>
            <span className="text-[11px] text-blue-400 font-medium">Intermediação & Projetos</span>
          </div>
        </div>

        {/* Navigation Modules (Strictly by Role in Stage 1) */}
        <div className="flex-1 py-4 px-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navegação Principal
          </div>

          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Home className="w-4 h-4" />
            <span>Página Inicial</span>
          </NavLink>

          {/* Módulo de Empresas / Cadastros (Admin, Comercial, Financeiro, Gestor) */}
          {user?.role && user.role !== 'executor' && (
            <NavLink
              to="/empresas"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Building2 className="w-4 h-4" />
              <div className="flex items-center justify-between flex-1">
                <span>Empresas</span>
                {(user.role === 'financeiro' || user.role === 'gestor') && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                    Leitura
                  </span>
                )}
              </div>
            </NavLink>
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
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Kanban className="w-4 h-4 text-blue-400" />
                <span>Funil (9 Etapas)</span>
              </NavLink>

              <NavLink
                to="/campanhas"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Não Contatar</span>
              </NavLink>
            </>
          )}

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
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Shield className="w-4 h-4" />
                <span>Administração</span>
              </NavLink>

              <NavLink
                to="/auditoria"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <History className="w-4 h-4" />
                <span>Auditoria Imutável</span>
              </NavLink>
            </>
          )}

          {user?.role === 'executor' && (
            <div className="mt-6 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block mb-1">Acesso Restrito:</span>
              Como executor externo, suas ordens de serviço e demandas de engenharia serão
              disponibilizadas na Etapa 5 (Execução).
            </div>
          )}
        </div>

        {/* User Card in Sidebar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Encerrar Sessão
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Ambiente Operacional Seguro</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-600 font-mono">
              Hoje: {formatDateBr(new Date().toISOString())}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Sininho com Badge de Notificações: Ações do Dia, Atrasos e Campanhas Pendentes de Aprovação */}
            {user?.role && (user.role === 'admin' || user.role === 'comercial') && (
              <NavLink
                to={isAdmin && badgeCampanhasPendentesCount > 0 ? '/campanhas' : '/acoes-do-dia'}
                className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors"
                title={
                  isAdmin && badgeCampanhasPendentesCount > 0
                    ? `${badgeCampanhasPendentesCount} campanha(s) aguardando aprovação do Admin | ${badgeAcoesCount} ações do dia`
                    : `${badgeAcoesCount} ações da cadência aguardando intervenção hoje`
                }
              >
                <Bell className="w-5 h-5" />
                {(badgeAcoesCount > 0 || (isAdmin && badgeCampanhasPendentesCount > 0)) && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold text-white shadow-xs ${
                      badgeCriticosCount > 0
                        ? 'bg-rose-600 animate-pulse'
                        : isAdmin && badgeCampanhasPendentesCount > 0
                          ? 'bg-amber-600'
                          : 'bg-blue-600'
                    }`}
                  >
                    {badgeAcoesCount + (isAdmin ? badgeCampanhasPendentesCount : 0)}
                  </span>
                )}
              </NavLink>
            )}

            {user && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 hidden sm:inline">
                  {user.name}
                </span>
                <Badge variant="outline" className={`text-xs ${ROLE_BADGE_VARIANTS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </Badge>
              </div>
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
      </div>
    </div>
  )
}
