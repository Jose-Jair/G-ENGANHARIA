import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  ShieldCheck,
  CheckCircle,
  FileSpreadsheet,
  Lock,
  ArrowRight,
  Database,
  Users,
  Briefcase,
  Layers,
  Coins,
} from 'lucide-react'
import { formatDateTimeBr } from '@/lib/formatters'

export default function WelcomePage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-600/10 skew-x-12 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Etapa 1 — Fundamentos de Dados e Segurança
            </span>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Olá, {user?.name || 'Colaborador'}!
            </h1>
            <p className="text-slate-300 text-sm md:text-base mt-1 max-w-2xl">
              Você está autenticado no Sistema de Gestão e Intermediação de Engenharia para
              Contratos Públicos.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/80 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Perfil:</span>
              <Badge
                variant="outline"
                className="border-blue-400 text-blue-300 font-semibold uppercase text-[10px]"
              >
                {user?.role ? ROLE_LABELS[user.role] : 'Indefinido'}
              </Badge>
            </div>

            <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs text-slate-300">
              <span className="text-slate-400 mr-1.5">E-mail:</span>
              <span className="font-mono text-white">{user?.email}</span>
            </div>

            {user?.ultimo_login && (
              <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs text-slate-400">
                <span>Último login: {formatDateTimeBr(user.ultimo_login)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin shortcut if applicable */}
      {isAdmin && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Acesso Administrativo Disponível
                </h4>
                <p className="text-xs text-slate-600">
                  Como Administrador, você possui permissão para gerenciar usuários, modelos e ver a
                  auditoria do servidor.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/administracao')}
              className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5 shrink-0"
            >
              Ir para Administração
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status of Stage 1 & Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Completed Foundation */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base text-slate-900">
                Etapa 1 Concluída: Base & Segurança
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              A infraestrutura do banco de dados e as regras de negócio estão ativas no servidor
              Skip Cloud (PocketBase).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>22 Coleções Criadas:</strong> Todas com RLS (permissões por perfil)
                aplicadas no servidor.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Auditoria Server-Side:</strong> Hook pb_hooks captura automaticamente
                criação, edição, deleção, login e logout.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Tabela audit_logs Imutável:</strong> Bloqueada para inserção/edição/remoção
                via API direta.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>MFA TOTP do Admin:</strong> Suporte a autenticação de dois fatores com
                código de 6 dígitos.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Formato Nacional:</strong> Padrão de datas dd/mm/aaaa e valores em R$
                implementados.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Upcoming Modules (Stage 2) */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base text-slate-900">
                Próximas Etapas (Roadmap de Construção)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Conforme a regra do projeto, cada módulo será construído com aprovação prévia em
              etapas futuras:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                Funil Comercial & Cadência de Toques
              </div>
              <p className="text-[11px] text-slate-500">
                Etapas do funil (identificada, qualificada, parceira), cadência D0-D30,
                classificação Curva ABC e envio de e-mails de prospecção com opt-out LGPD.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                Propostas Comerciais & Projetos
              </div>
              <p className="text-[11px] text-slate-500">
                Geração de código PROP-AAAA-NNNN, cálculo de margem, fluxo de aprovação interna,
                token de aceite e abertura de projeto vinculado.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                Homologação de Executores & Financeiro
              </div>
              <p className="text-[11px] text-slate-500">
                Cotações por disciplina técnica, avaliação de desempenho (pontualidade/qualidade) e
                contas a pagar/receber bloqueadas por fechamento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security note */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-700 block mb-0.5">
            Validação RLS (Row Level Security):
          </span>
          Todas as permissões do sistema são validadas pelas regras de coleção e hooks do PocketBase
          no servidor. Se um usuário não-administrador tentar requisitar diretamente dados restritos
          como <code>audit_logs</code> ou <code>parametros</code>, a API recusará com código HTTP
          403/404.
        </div>
      </div>
    </div>
  )
}
