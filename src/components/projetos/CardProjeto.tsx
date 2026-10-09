import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ProjetoRecord, ProjetoEtapaRecord, UserRole } from '@/types'
import { formatCurrencyBr, formatDateBr, formatPrazoRelativo } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Building2,
  Calendar,
  Clock,
  Eye,
  FileText,
  FolderKanban,
  AlertTriangle,
  ArrowRight,
  Info,
  CalendarClock,
} from 'lucide-react'

export interface ProjetoComEtapasCalculadas extends ProjetoRecord {
  etapas: ProjetoEtapaRecord[]
  etapasConcluidasCount: number
  totalEtapasCount: number
  percentualConcluido: number
  diasAtrasoMax: number
  disciplinasList: string[]
  executoresIds: string[]
}

interface CardProjetoProps {
  projeto: ProjetoComEtapasCalculadas
  userRole?: UserRole
  canViewDossie?: boolean
  onAbrirProjeto: (projetoId: string) => void
  onAbrirDossie: (projetoId: string) => void
  onAbrirSaudeModal: (projeto: ProjetoRecord) => void
  onDefinirModo: (projeto: ProjetoRecord) => void
}

export const CardProjeto: React.FC<CardProjetoProps> = ({
  projeto,
  userRole,
  canViewDossie = false,
  onAbrirProjeto,
  onAbrirDossie,
  onAbrirSaudeModal,
  onDefinirModo,
}) => {
  const navigate = useNavigate()

  const pj = projeto.expand?.empresa || projeto.expand?.proposta?.expand?.empresa
  const pf = projeto.expand?.cliente_pf || projeto.expand?.proposta?.expand?.cliente_pf
  const nomeCliente = pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado'

  const isStandby = projeto.status === 'aguardando_definicao'
  const canOperateStandby = userRole === 'admin' || userRole === 'gestor'
  const canEditSaude = userRole === 'admin' || userRole === 'gestor'

  // Prazo com contagem relativa
  const prazoRelativo = formatPrazoRelativo(projeto.prazo_final)

  // Cor do ponto de saúde
  const saudeCor =
    projeto.saude === 'verde'
      ? {
          bg: 'bg-emerald-500',
          ring: 'ring-emerald-200',
          label: 'Verde (No prazo)',
          textColor: 'text-emerald-700',
        }
      : projeto.saude === 'amarelo'
        ? {
            bg: 'bg-amber-500',
            ring: 'ring-amber-200',
            label: 'Amarelo (Atenção)',
            textColor: 'text-amber-700',
          }
        : projeto.saude === 'vermelho'
          ? {
              bg: 'bg-rose-500',
              ring: 'ring-rose-200',
              label: 'Vermelho (Crítico)',
              textColor: 'text-rose-700',
            }
          : {
              bg: 'bg-slate-300',
              ring: 'ring-slate-100',
              label: 'Não definida',
              textColor: 'text-slate-500',
            }

  return (
    <div
      onClick={() => onAbrirProjeto(projeto.id)}
      className="group bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden cursor-pointer"
    >
      {/* 1. Faixa de Standby destacada (se o projeto estiver aguardando definição) */}
      {isStandby && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-r from-orange-500 via-[#D95A2B] to-[#C44E22] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#C44E22]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider truncate">
              Aguardando definição de execução
            </span>
          </div>

          {canOperateStandby ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDefinirModo(projeto)
              }}
              className="bg-white text-[#D95A2B] hover:bg-orange-50 font-bold text-[11px] h-6 px-2.5 shadow-xs shrink-0"
            >
              Definir Modo de Execução
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <span className="text-[10px] text-orange-100 italic">
              Apenas leitura (Admin/Gestor)
            </span>
          )}
        </div>
      )}

      {/* 2. Conteúdo do Card */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Cabeçalho do Card */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-[#1E2A4A] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {projeto.codigo}
              </span>

              {projeto.grupo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/projetos/grupo/${projeto.grupo}`)
                  }}
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#D95A2B] hover:underline"
                  title="Abrir Grupo de Projetos"
                >
                  <FolderKanban className="w-3 h-3 text-[#D95A2B]" />
                  {projeto.expand?.grupo?.codigo || 'Grupo'}
                </button>
              )}

              {projeto.expand?.proposta && (
                <span className="text-[10px] font-mono text-slate-400">
                  Origem: {projeto.expand.proposta.numero}
                </span>
              )}
            </div>

            {/* Status discreto */}
            <span
              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                projeto.status === 'concluido'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : projeto.status === 'aguardando_definicao'
                    ? 'bg-orange-50 text-[#D95A2B] border border-orange-200 font-bold'
                    : projeto.status === 'contratacao'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {projeto.status === 'aguardando_definicao'
                ? 'Standby'
                : projeto.status === 'contratacao'
                  ? 'Em Contratação'
                  : projeto.status === 'concluido'
                    ? 'Concluído'
                    : projeto.status === 'pausado'
                      ? 'Pausado'
                      : projeto.status === 'cancelado'
                        ? 'Cancelado'
                        : 'Em Andamento'}
            </span>
          </div>

          {/* Nome do Projeto em Destaque */}
          <h3 className="font-bold text-sm sm:text-base text-[#1E2A4A] line-clamp-2 group-hover:text-[#D95A2B] transition-colors pt-0.5">
            {projeto.nome || `Projeto ${projeto.codigo}`}
          </h3>

          {/* Cliente em Linha Única */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate pt-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate" title={nomeCliente}>
              Cliente: <strong className="text-slate-700 font-medium">{nomeCliente}</strong>
            </span>
          </div>
        </div>

        {/* Corpo: Uma Barra de Progresso Única */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Progresso</span>
            <span className="text-xs font-mono text-slate-500">
              <strong className="text-slate-900 font-bold">{projeto.percentualConcluido}%</strong>
              <span className="text-slate-400 ml-1.5">
                ({projeto.etapasConcluidasCount}/{projeto.totalEtapasCount} etapas)
              </span>
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                projeto.percentualConcluido === 100
                  ? 'bg-emerald-500'
                  : projeto.diasAtrasoMax > 0
                    ? 'bg-rose-500'
                    : 'bg-[#D95A2B]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, projeto.percentualConcluido))}%` }}
            />
          </div>

          {projeto.diasAtrasoMax > 0 && (
            <div className="flex items-center justify-end gap-1 text-[11px] text-rose-600 font-medium">
              <Clock className="w-3 h-3" />
              <span>Maior atraso em etapa: +{projeto.diasAtrasoMax}d</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Rodapé do Card: 3 Dados + Ações por Ícone com Tooltip */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs"
      >
        {/* 3 Dados: Valor · Prazo · Saúde (ponto clicável com justificativa) */}
        <div className="flex items-center gap-3 text-slate-700 min-w-0 flex-1">
          {/* Valor */}
          <span className="font-bold text-slate-900 truncate shrink-0">
            {projeto.valor_total ? formatCurrencyBr(projeto.valor_total) : 'R$ 0,00'}
          </span>

          <span className="text-slate-300 shrink-0">·</span>

          {/* Prazo com Contagem Relativa */}
          <div
            className={`flex items-center gap-1 truncate shrink-0 ${
              prazoRelativo.atrasado
                ? 'text-rose-600 font-semibold'
                : prazoRelativo.hoje
                  ? 'text-amber-600 font-semibold'
                  : 'text-slate-600'
            }`}
            title={
              projeto.prazo_final
                ? `Prazo final: ${formatDateBr(projeto.prazo_final)}`
                : 'Sem prazo'
            }
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{prazoRelativo.texto}</span>
          </div>

          <span className="text-slate-300 shrink-0">·</span>

          {/* Saúde como Pontinho Colorido Clicável com Justificativa via Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 p-1 -m-1 rounded-full hover:bg-slate-200/60 transition-colors shrink-0 group/saude focus:outline-hidden"
                title="Ver justificativa da saúde do projeto"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${saudeCor.bg} ring-2 ${saudeCor.ring} group-hover/saude:scale-110 transition-transform`}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-72 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${saudeCor.bg}`} />
                  Saúde: {saudeCor.label}
                </span>
                {canEditSaude && (
                  <button
                    type="button"
                    onClick={() => onAbrirSaudeModal(projeto)}
                    className="text-[11px] font-semibold text-[#D95A2B] hover:underline"
                  >
                    Alterar
                  </button>
                )}
              </div>

              <div>
                <p className="text-[11px] text-slate-500 font-medium">Justificativa do Gestor:</p>
                <p className="text-xs text-slate-800 italic mt-0.5">
                  {projeto.justificativa_saude
                    ? `"${projeto.justificativa_saude}"`
                    : 'Nenhuma justificativa manual registrada.'}
                </p>
              </div>

              {projeto.prazo_final && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Prazo: {formatDateBr(projeto.prazo_final)} ({prazoRelativo.texto})
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Ações por Ícone com Tooltip (abrir ficha, dossiê, grupo) */}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-1 shrink-0">
            {/* Abrir Grupo (se vinculado) */}
            {projeto.grupo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => navigate(`/projetos/grupo/${projeto.grupo}`)}
                    className="w-8 h-8 text-slate-500 hover:text-[#D95A2B] hover:bg-orange-50 rounded-lg"
                    aria-label="Abrir Grupo de Projetos"
                  >
                    <FolderKanban className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Abrir Grupo de Projetos consolidado</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Dossiê (PDF) */}
            {canViewDossie && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onAbrirDossie(projeto.id)}
                    className="w-8 h-8 text-slate-500 hover:text-[#1E2A4A] hover:bg-slate-200/60 rounded-lg"
                    aria-label="Ver Dossiê do Projeto (PDF)"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Dossiê consolidado (PDF)</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Abrir Ficha do Projeto */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onAbrirProjeto(projeto.id)}
                  className="w-8 h-8 text-[#1E2A4A] hover:text-[#D95A2B] hover:bg-orange-50 rounded-lg"
                  aria-label="Abrir Ficha do Projeto"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Abrir ficha completa do projeto</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
