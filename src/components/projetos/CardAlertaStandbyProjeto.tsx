import React from 'react'
import { ProjetoRecord, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react'

interface CardAlertaStandbyProjetoProps {
  projeto: ProjetoRecord
  userRole?: UserRole
  onDefinirModo?: () => void
  compacto?: boolean
}

export const CardAlertaStandbyProjeto: React.FC<CardAlertaStandbyProjetoProps> = ({
  projeto,
  userRole,
  onDefinirModo,
  compacto = false,
}) => {
  if (projeto.status !== 'aguardando_definicao') return null

  const canOperate = userRole === 'admin' || userRole === 'gestor'
  const isReadOnly = userRole === 'comercial' || userRole === 'financeiro'

  if (compacto) {
    return (
      <div className="p-3 bg-gradient-to-r from-orange-50 via-amber-50/60 to-orange-50 border border-orange-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#D95A2B] text-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#D95A2B] uppercase tracking-wide">
                Aguardando definição de execução
              </span>
              <Badge className="bg-[#D95A2B] text-white text-[9px] font-bold h-4 px-1.5">
                STANDBY
              </Badge>
            </div>
            <p className="text-[11px] text-slate-600 truncate mt-0.5">
              Defina se será condução direta ou por cotação de executores.
            </p>
          </div>
        </div>

        {canOperate && onDefinirModo && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDefinirModo()
            }}
            className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-7 px-3 font-semibold shadow-xs shrink-0 self-end sm:self-auto"
          >
            Definir Modo de Execução <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}

        {isReadOnly && (
          <span className="text-[10px] text-slate-500 italic bg-white/80 px-2 py-0.5 rounded border border-orange-200 shrink-0">
            Apenas leitura (Admin/Gestor)
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-50 via-amber-50/60 to-orange-50 border-2 border-[#D95A2B] rounded-xl shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D95A2B] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#D95A2B] bg-white px-2 py-0.5 rounded border border-[#D95A2B]/30">
                PROJETO EM STANDBY
              </span>
              <Badge className="bg-[#D95A2B] text-white text-[10px] font-bold">
                Aguardando Definição
              </Badge>
              <span className="text-xs font-mono text-slate-500">{projeto.codigo}</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mt-1">
              Aguardando definição de execução
            </h3>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed max-w-2xl">
              Este projeto foi ativado na assinatura bilateral do contrato de serviços e está em
              standby. Defina se será conduzido por <strong>Execução direta</strong> (equipe
              interna) ou por <strong>Cotação com executores</strong> homologados.
            </p>
          </div>
        </div>

        {canOperate && onDefinirModo && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onDefinirModo()
            }}
            className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold h-9 px-4 shadow-sm shrink-0"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Definir Modo de Execução
          </Button>
        )}

        {isReadOnly && (
          <div className="p-2 bg-white/80 border border-orange-200 rounded-lg text-right shrink-0">
            <span className="text-[11px] font-semibold text-slate-600 block">Modo de Consulta</span>
            <span className="text-[10px] text-slate-400">
              Apenas Admin ou Gestor podem definir a execução
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-orange-200/80 flex flex-wrap items-center justify-between text-[11px] text-orange-950">
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-[#D95A2B]" />
          Ação rastreável com auditoria no servidor (
          <code className="font-mono text-xs text-[#D95A2B]">DEFINIR_MODO_EXECUCAO</code>)
        </span>
        <span className="text-slate-500">
          Após a escolha, o projeto transita para <strong>Em Andamento</strong>.
        </span>
      </div>
    </div>
  )
}
