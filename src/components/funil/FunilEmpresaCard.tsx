import React, { useState, useEffect } from 'react'
import { EmpresaRecord, CurvaABC } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isValidCnpj } from '@/lib/cnpj'
import pb from '@/lib/pocketbase/client'
import {
  Calendar,
  Clock,
  History,
  Building2,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  FileText,
  HelpCircle,
} from 'lucide-react'

interface FunilEmpresaCardProps {
  empresa: EmpresaRecord
  totalContratosAtivos: number
  hasReativacaoPendente?: boolean
  isSugeridoNutricao?: boolean
  diasEmPropostaEnviada?: number
  onEditProximaAcao?: (empresa: EmpresaRecord) => void
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
  isSugeridoNutricao,
  diasEmPropostaEnviada,
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

  // Indicador de Completude para Qualificação (quando em 'identificada')
  // 6 Requisitos:
  // 1. Razão Social
  // 2. CNPJ válido (Módulo 11)
  // 3. E-mail
  // 4. Telefone
  // 5. Responsável interno
  // 6. Contato decisor com e-mail e telefone
  const [temDecisorValido, setTemDecisorValido] = useState<boolean | null>(null)
  const [mostrarDetalhesRequisitos, setMostrarDetalhesRequisitos] = useState(false)

  const isIdentificada = empresa.etapa_funil === 'identificada'

  useEffect(() => {
    let ativo = true
    if (isIdentificada) {
      // Buscar se tem contato decisor com email e telefone
      pb.collection('contatos')
        .getList(1, 10, {
          filter: `empresa = "${empresa.id}" && decisor = true`,
          requestKey: `contatos_decisor_${empresa.id}`,
        })
        .then((res) => {
          if (!ativo) return
          const ok = res.items.some((c: any) => (c.email || '').trim() && (c.telefone || '').trim())
          setTemDecisorValido(ok)
        })
        .catch(() => {
          if (ativo) setTemDecisorValido(false)
        })
    }
    return () => {
      ativo = false
    }
  }, [empresa.id, isIdentificada, empresa.updated])

  const reqRazao = Boolean((empresa.razao_social || '').trim())
  const reqCnpj = Boolean((empresa.cnpj || '').trim() && isValidCnpj(empresa.cnpj || ''))
  const reqEmail = Boolean((empresa.email || '').trim())
  const reqTelefone = Boolean((empresa.telefone || '').trim())
  const reqResponsavel = Boolean((empresa.responsavel || '').trim())
  const reqDecisor = Boolean(temDecisorValido)

  const requisitosLista = [
    { label: 'Razão Social', ok: reqRazao },
    { label: 'CNPJ Válido', ok: reqCnpj },
    { label: 'E-mail', ok: reqEmail },
    { label: 'Telefone', ok: reqTelefone },
    { label: 'Responsável Atribuído', ok: reqResponsavel },
    { label: 'Contato Decisor (E-mail + Tel)', ok: reqDecisor },
  ]

  const totalAtendidos = requisitosLista.filter((r) => r.ok).length
  const totalRequisitos = 6
  const requisitosFaltantes = requisitosLista.filter((r) => !r.ok).map((r) => r.label)

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

      {/* Entrega 3: Selo "Sugerido para Nutrição" no Card (>7 dias em proposta_enviada sem aceite) */}
      {empresa.etapa_funil === 'proposta_enviada' && isSugeridoNutricao && (
        <div className="mb-2 p-1.5 rounded bg-violet-50 border border-violet-300 text-[10px] text-violet-900 flex items-center justify-between shadow-2xs">
          <span className="flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3 text-violet-600" />
            Sugerido para Nutrição
          </span>
          <span className="text-[9px] font-mono font-semibold text-violet-700 bg-violet-200/70 px-1 py-0.5 rounded">
            {diasEmPropostaEnviada !== undefined ? `+${diasEmPropostaEnviada} dias` : '>7 dias'}
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

      {/* Entrega 1: Mini-indicador de Completude para Qualificação (quando identificada) */}
      {isIdentificada && (
        <div className="mb-2 pl-4.5">
          <div
            onClick={(e) => {
              e.stopPropagation()
              setMostrarDetalhesRequisitos(!mostrarDetalhesRequisitos)
            }}
            className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px] cursor-pointer hover:bg-slate-100/80 transition-colors"
            title="Clique para ver os requisitos de qualificação"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                Qualificação:
                <span
                  className={`font-mono font-bold ${
                    totalAtendidos === totalRequisitos
                      ? 'text-emerald-700'
                      : totalAtendidos >= 4
                        ? 'text-amber-700'
                        : 'text-slate-700'
                  }`}
                >
                  {totalAtendidos}/{totalRequisitos} requisitos
                </span>
              </span>
              <span className="text-[9px] text-blue-600 hover:underline">
                {mostrarDetalhesRequisitos ? 'Ocultar' : 'Ver faltantes'}
              </span>
            </div>

            {/* Barra de progresso */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  totalAtendidos === totalRequisitos
                    ? 'bg-emerald-500'
                    : totalAtendidos >= 4
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${(totalAtendidos / totalRequisitos) * 100}%` }}
              />
            </div>

            {/* Detalhes dos Faltantes */}
            {mostrarDetalhesRequisitos && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-200 space-y-0.5">
                {requisitosLista.map((req, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px]">
                    <span className={req.ok ? 'text-slate-600' : 'text-rose-700 font-medium'}>
                      {req.label}
                    </span>
                    {req.ok ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <span className="text-[8px] uppercase text-rose-600 font-bold">Falta</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Valor Total dos Contratos Ativos */}
      <div className="pl-4.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-slate-400">
          Contratos Ativos:
        </span>
        <span className="font-mono text-xs font-bold text-slate-900">
          {formatCurrencyBr(totalContratosAtivos)}
        </span>
      </div>

      {/* Próxima Ação Real da Cadência ou Comercial (apenas visualização enxuta no card) */}
      <div
        onClick={() => onOpenDetalhes(empresa)}
        className={`mt-2 p-1.5 rounded border text-[11px] transition-colors cursor-pointer ${
          empresa.proxima_acao_desc?.includes('PENDÊNCIA')
            ? 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-300 text-rose-950'
            : empresa.etapa_funil === 'em_cadencia'
              ? 'bg-blue-50/60 hover:bg-blue-100/60 border-blue-200 text-blue-950'
              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 text-slate-700'
        }`}
        title="Clique para abrir a ficha cadastral da empresa"
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
            <span className="text-slate-400 italic font-normal">Nenhuma ação agendada</span>
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
