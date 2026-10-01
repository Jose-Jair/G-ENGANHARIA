import React from 'react'
import { EmpresaRecord, CurvaABC } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  History,
  Building2,
  ChevronRight,
  Sparkles,
  AlertCircle,
  GripVertical,
} from 'lucide-react'

interface FunilEmpresaCardProps {
  empresa: EmpresaRecord
  totalContratosAtivos: number
  hasReativacaoPendente?: boolean
  onEditProximaAcao: (empresa: EmpresaRecord) => void
  onOpenTimeline: (empresa: EmpresaRecord) => void
  onOpenDetalhes: (empresa: EmpresaRecord) => void
  onElaborarProposta?: (empresa: EmpresaRecord) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  canDrag?: boolean
}
export const FunilEmpresaCard: React.FC<FunilEmpresaCardProps> = ({
  empresa,
  totalContratosAtivos,
  hasReativacaoPendente,
  onEditProximaAcao,
  onOpenTimeline,
  onOpenDetalhes,
  onElaborarProposta,
  onDragStart,
  canDrag = true,
}) => {
  // Cores distintivas da Curva ABC
  const getCurvaBadge = (curva?: CurvaABC) => {
    switch (curva) {
      case 'A':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500 text-white shadow-xs">
            Curva A
          </span>
        )
      case 'B':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-600 text-white shadow-xs">
            Curva B
          </span>
        )
      case 'C':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-500 text-white shadow-xs">
            Curva C
          </span>
        )
    }
  }

  // Próxima ação formatada
  const dataAcaoFormatada = empresa.proxima_acao_data
    ? formatDateBr(empresa.proxima_acao_data)
    : null

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, empresa.id)}
      className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-xs hover:shadow-md hover:border-blue-300 transition-all group relative cursor-grab active:cursor-grabbing select-none"
    >
      {/* Alerta de Sugestão de Reativação Disponível */}
      {hasReativacaoPendente && (
        <div className="mb-2 p-1.5 rounded bg-emerald-50 border border-emerald-300 text-[10px] text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" />
            Novo contrato! Sugestão de Reativação
          </span>
          <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-200/60 px-1 py-0.2 rounded">
            Pendente
          </span>
        </div>
      )}

      {/* Topo do Card: Nome e Curva */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0" />
            <h4
              onClick={() => onOpenDetalhes(empresa)}
              className="font-semibold text-slate-900 text-xs truncate hover:text-blue-600 cursor-pointer"
              title={empresa.nome_fantasia || empresa.razao_social}
            >
              {empresa.nome_fantasia || empresa.razao_social}
            </h4>
          </div>
          {empresa.nome_fantasia && (
            <p className="text-[10px] text-slate-400 truncate pl-4.5">{empresa.razao_social}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1">{getCurvaBadge(empresa.curva)}</div>
      </div>

      {/* Localidade e Score */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 pl-4.5">
        <span>
          {empresa.municipio ? `${empresa.municipio} - ` : ''}
          {empresa.uf || 'BR'}
        </span>
        {empresa.score !== undefined && empresa.score !== null && (
          <span className="text-[10px] font-mono text-slate-600 font-medium">
            Score: <strong className="text-slate-800">{empresa.score}</strong>/100
          </span>
        )}
      </div>

      {/* Valor Total dos Contratos Ativos */}
      <div className="pl-4.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-slate-400">
          Contratos Ativos:
        </span>
        <span className="font-mono text-xs font-bold text-slate-900">
          {formatCurrencyBr(totalContratosAtivos)}
        </span>
      </div>

      {/* Próxima Ação Real da Cadência ou Comercial */}
      <div
        onClick={() => onEditProximaAcao(empresa)}
        className={`mt-2 p-1.5 rounded border text-[11px] transition-colors cursor-pointer ${
          empresa.proxima_acao_desc?.includes('PENDÊNCIA')
            ? 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-300 text-rose-950'
            : empresa.etapa_funil === 'em_cadencia'
              ? 'bg-blue-50/60 hover:bg-blue-100/60 border-blue-200 text-blue-950'
              : 'bg-slate-50 hover:bg-blue-50/70 border-slate-200/80 hover:border-blue-200 text-slate-700'
        }`}
        title="Próxima ação real calculada pela cadência"
      >
        <div className="flex items-center justify-between text-[10px] font-medium mb-0.5">
          <span
            className={`flex items-center gap-1 ${
              empresa.proxima_acao_desc?.includes('PENDÊNCIA')
                ? 'text-rose-700 font-bold'
                : empresa.etapa_funil === 'em_cadencia'
                  ? 'text-blue-700 font-bold'
                  : 'text-slate-600'
            }`}
          >
            {empresa.proxima_acao_desc?.includes('PENDÊNCIA') ? (
              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-3 h-3 text-blue-600 shrink-0" />
            )}
            {empresa.etapa_funil === 'em_cadencia' ? 'Próximo Toque:' : 'Próxima ação:'}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            {dataAcaoFormatada || 'Não agendada'}
          </span>
        </div>
        <p className="text-[10px] line-clamp-2 font-medium">
          {empresa.proxima_acao_desc || (
            <span className="text-slate-400 italic font-normal">
              + Definir próxima intervenção...
            </span>
          )}
        </p>
      </div>

      {/* Botão Elaborar Proposta (Etapa 7 - Origem no Funil) */}
      {onElaborarProposta && empresa.status !== 'inativa' && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onElaborarProposta(empresa)}
            className="w-full h-6.5 text-[10px] font-semibold text-amber-800 bg-amber-50/80 hover:bg-amber-100/90 border-amber-300 hover:border-amber-400 gap-1 shadow-2xs"
            title="Elaborar nova proposta técnica/comercial para esta empresa"
          >
            <FileText className="w-3 h-3 text-amber-600" />
            Elaborar Proposta
          </Button>
        </div>
      )}

      {/* Ações Rápidas de Rodapé */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenTimeline(empresa)}
          className="h-6 px-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 text-[10px]"
          title="Ver auditoria e linha do tempo"
        >
          <History className="w-3 h-3 mr-1" />
          Histórico
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenDetalhes(empresa)}
          className="h-6 px-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-[10px]"
        >
          Ver cadastro <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>
    </div>
  )
}
