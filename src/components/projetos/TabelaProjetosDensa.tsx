import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ProjetoRecord, UserRole } from '@/types'
import { ProjetoComEtapasCalculadas } from './CardProjeto'
import { formatCurrencyBr, formatDateBr, formatPrazoRelativo } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  FolderKanban,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

export interface TabelaProjetosDensaProps {
  projetos: ProjetoComEtapasCalculadas[]
  userRole?: UserRole
  canViewDossie?: boolean
  ordenacao: string
  onMudarOrdenacao: (novaOrdenacao: string) => void
  onAbrirProjeto: (projetoId: string) => void
  onAbrirDossie: (projetoId: string) => void
  onAbrirSaudeModal: (projeto: ProjetoRecord) => void
  onDefinirModo: (projeto: ProjetoRecord) => void
}

export const TabelaProjetosDensa: React.FC<TabelaProjetosDensaProps> = ({
  projetos,
  userRole,
  canViewDossie = false,
  ordenacao,
  onMudarOrdenacao,
  onAbrirProjeto,
  onAbrirDossie,
  onAbrirSaudeModal,
  onDefinirModo,
}) => {
  const navigate = useNavigate()
  const canEditSaude = userRole === 'admin' || userRole === 'gestor'
  const canOperateStandby = userRole === 'admin' || userRole === 'gestor'

  // Alterna ordenação de uma coluna clicável
  // Ex: prazo -> prazo_asc -> prazo_desc -> criacao_desc
  const handleSortHeader = (campo: 'codigo' | 'valor' | 'prazo') => {
    if (campo === 'codigo') {
      if (ordenacao === 'criacao_desc') {
        onMudarOrdenacao('criacao_asc')
      } else {
        onMudarOrdenacao('criacao_desc')
      }
    } else if (campo === 'valor') {
      if (ordenacao === 'valor_desc') {
        onMudarOrdenacao('valor_asc')
      } else {
        onMudarOrdenacao('valor_desc')
      }
    } else if (campo === 'prazo') {
      if (ordenacao === 'prazo_asc') {
        onMudarOrdenacao('prazo_desc')
      } else {
        onMudarOrdenacao('prazo_asc')
      }
    }
  }

  const renderSortIcon = (campo: 'codigo' | 'valor' | 'prazo') => {
    if (campo === 'codigo') {
      if (ordenacao === 'criacao_asc') return <ArrowUp className="w-3.5 h-3.5 text-[#D95A2B]" />
      if (ordenacao === 'criacao_desc') return <ArrowDown className="w-3.5 h-3.5 text-[#D95A2B]" />
    } else if (campo === 'valor') {
      if (ordenacao === 'valor_desc') return <ArrowDown className="w-3.5 h-3.5 text-[#D95A2B]" />
      if (ordenacao === 'valor_asc') return <ArrowUp className="w-3.5 h-3.5 text-[#D95A2B]" />
    } else if (campo === 'prazo') {
      if (ordenacao === 'prazo_asc') return <ArrowUp className="w-3.5 h-3.5 text-[#D95A2B]" />
      if (ordenacao === 'prazo_desc') return <ArrowDown className="w-3.5 h-3.5 text-[#D95A2B]" />
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
  }

  const getSaudeConfig = (saude?: string) => {
    switch (saude) {
      case 'verde':
        return {
          bg: 'bg-emerald-500',
          ring: 'ring-emerald-200',
          label: 'Verde (No prazo)',
          text: 'text-emerald-700',
        }
      case 'amarelo':
        return {
          bg: 'bg-amber-500',
          ring: 'ring-amber-200',
          label: 'Amarelo (Atenção)',
          text: 'text-amber-700',
        }
      case 'vermelho':
        return {
          bg: 'bg-rose-500',
          ring: 'ring-rose-200',
          label: 'Vermelho (Crítico)',
          text: 'text-rose-700',
        }
      default:
        return {
          bg: 'bg-slate-300',
          ring: 'ring-slate-100',
          label: 'Não definida',
          text: 'text-slate-500',
        }
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'aguardando_definicao':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-orange-50 text-[#D95A2B] border-orange-200 font-bold whitespace-nowrap"
          >
            Standby
          </Badge>
        )
      case 'contratacao':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-semibold whitespace-nowrap"
          >
            Em Contratação
          </Badge>
        )
      case 'em_andamento':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-slate-100 text-slate-700 border-slate-200 font-medium whitespace-nowrap"
          >
            Em Andamento
          </Badge>
        )
      case 'concluido':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold whitespace-nowrap"
          >
            Concluído
          </Badge>
        )
      case 'pausado':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 whitespace-nowrap"
          >
            Pausado
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 whitespace-nowrap"
          >
            Cancelado
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap"
          >
            {status || 'Em Andamento'}
          </Badge>
        )
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold select-none">
              {/* Código */}
              <th className="py-2.5 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortHeader('codigo')}
                  className="group inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#1E2A4A] focus:outline-hidden"
                  title="Ordenar por criação/código"
                >
                  <span>Código</span>
                  {renderSortIcon('codigo')}
                </button>
              </th>

              {/* Projeto (Nome + Cliente) - Sempre visível */}
              <th className="py-2.5 px-3 min-w-[200px]">Projeto / Cliente</th>

              {/* Grupo / Origem - Colapsa em telas pequenas */}
              <th className="py-2.5 px-3 hidden lg:table-cell whitespace-nowrap">Grupo / Origem</th>

              {/* Valor - Sempre visível */}
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortHeader('valor')}
                  className="group inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#1E2A4A] focus:outline-hidden ml-auto"
                  title="Ordenar por valor total"
                >
                  <span>Valor (R$)</span>
                  {renderSortIcon('valor')}
                </button>
              </th>

              {/* Prazo - Sempre visível */}
              <th className="py-2.5 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSortHeader('prazo')}
                  className="group inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#1E2A4A] focus:outline-hidden"
                  title="Ordenar por prazo final"
                >
                  <span>Prazo</span>
                  {renderSortIcon('prazo')}
                </button>
              </th>

              {/* Progresso - Colapsa em telas muito pequenas */}
              <th className="py-2.5 px-3 hidden md:table-cell min-w-[120px] whitespace-nowrap">
                Progresso
              </th>

              {/* Saúde */}
              <th className="py-2.5 px-2.5 text-center whitespace-nowrap">Saúde</th>

              {/* Status */}
              <th className="py-2.5 px-3 hidden sm:table-cell whitespace-nowrap">Status</th>

              {/* Ações */}
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {projetos.map((prj) => {
              const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
              const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
              const nomeCliente =
                pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado'
              const prazoRelativo = formatPrazoRelativo(prj.prazo_final)
              const saudeCfg = getSaudeConfig(prj.saude)
              const isStandby = prj.status === 'aguardando_definicao'

              return (
                <tr
                  key={prj.id}
                  onClick={() => onAbrirProjeto(prj.id)}
                  className="hover:bg-slate-50/75 transition-colors cursor-pointer group"
                >
                  {/* Código */}
                  <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-[#1E2A4A] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {prj.codigo}
                      </span>
                      {isStandby && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#D95A2B] shrink-0"
                          title="Standby - Aguardando definição"
                        />
                      )}
                    </div>
                  </td>

                  {/* Projeto / Cliente */}
                  <td className="py-2.5 px-3 align-middle">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 group-hover:text-[#D95A2B] transition-colors truncate max-w-xs sm:max-w-sm lg:max-w-md">
                        {prj.nome || `Projeto ${prj.codigo}`}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-sm">
                        {nomeCliente}
                      </div>
                    </div>
                  </td>

                  {/* Grupo / Origem */}
                  <td className="py-2.5 px-3 hidden lg:table-cell whitespace-nowrap align-middle text-[11px]">
                    {prj.grupo ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projetos/grupo/${prj.grupo}`)
                        }}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#D95A2B] hover:underline"
                        title="Abrir Grupo de Projetos"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-[#D95A2B]" />
                        <span>{prj.expand?.grupo?.codigo || 'Grupo'}</span>
                      </button>
                    ) : prj.expand?.proposta ? (
                      <span className="font-mono text-slate-400">{prj.expand.proposta.numero}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Valor */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap align-middle font-mono font-bold text-slate-900">
                    {prj.valor_total ? formatCurrencyBr(prj.valor_total) : 'R$ 0,00'}
                  </td>

                  {/* Prazo */}
                  <td className="py-2.5 px-3 whitespace-nowrap align-middle">
                    <div
                      className={`text-xs ${
                        prazoRelativo.atrasado
                          ? 'text-rose-600 font-semibold'
                          : prazoRelativo.hoje
                            ? 'text-amber-600 font-semibold'
                            : 'text-slate-700'
                      }`}
                      title={
                        prj.prazo_final
                          ? `Prazo: ${formatDateBr(prj.prazo_final)}`
                          : 'Sem prazo final'
                      }
                    >
                      <div>{prj.prazo_final ? formatDateBr(prj.prazo_final) : '—'}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {prazoRelativo.texto}
                      </div>
                    </div>
                  </td>

                  {/* Progresso */}
                  <td className="py-2.5 px-3 hidden md:table-cell align-middle">
                    <div className="space-y-1 w-28">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-bold text-slate-800">{prj.percentualConcluido}%</span>
                        <span>
                          {prj.etapasConcluidasCount}/{prj.totalEtapasCount}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            prj.percentualConcluido === 100
                              ? 'bg-emerald-500'
                              : prj.diasAtrasoMax > 0
                                ? 'bg-rose-500'
                                : 'bg-[#D95A2B]'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(0, prj.percentualConcluido))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Saúde (Ponto Colorido Clicável com Justificativa) */}
                  <td
                    className="py-2.5 px-2.5 text-center align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="p-1 -m-1 rounded-full hover:bg-slate-200/60 transition-colors inline-flex items-center justify-center focus:outline-hidden"
                          title="Ver justificativa da saúde"
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${saudeCfg.bg} ring-2 ${saudeCfg.ring}`}
                          />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="center"
                        className="w-72 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${saudeCfg.bg}`} />
                            Saúde: {saudeCfg.label}
                          </span>
                          {canEditSaude && (
                            <button
                              type="button"
                              onClick={() => onAbrirSaudeModal(prj)}
                              className="text-[11px] font-semibold text-[#D95A2B] hover:underline"
                            >
                              Alterar
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Justificativa do Gestor:
                          </p>
                          <p className="text-xs text-slate-800 italic mt-0.5">
                            {prj.justificativa_saude
                              ? `"${prj.justificativa_saude}"`
                              : 'Nenhuma justificativa manual registrada.'}
                          </p>
                        </div>
                        {prj.prazo_final && (
                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Prazo: {formatDateBr(prj.prazo_final)} ({prazoRelativo.texto})
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3 hidden sm:table-cell whitespace-nowrap align-middle">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(prj.status)}
                      {isStandby && canOperateStandby && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDefinirModo(prj)
                          }}
                          className="h-6 px-1.5 text-[10px] text-[#D95A2B] hover:bg-orange-50 font-bold"
                          title="Definir modo de execução"
                        >
                          Definir
                          <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Ações por Ícone com Tooltip */}
                  <td
                    className="py-2.5 px-3 text-right whitespace-nowrap align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TooltipProvider delayDuration={150}>
                      <div className="flex items-center justify-end gap-1">
                        {/* Standby CTA rápido se for admin/gestor */}
                        {isStandby && canOperateStandby && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onDefinirModo(prj)}
                                className="w-7 h-7 text-[#D95A2B] hover:bg-orange-50 rounded-lg sm:hidden"
                                aria-label="Definir modo de execução"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Definir Modo de Execução</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Grupo */}
                        {prj.grupo && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => navigate(`/projetos/grupo/${prj.grupo}`)}
                                className="w-7 h-7 text-slate-500 hover:text-[#D95A2B] hover:bg-orange-50 rounded-lg"
                                aria-label="Abrir Grupo de Projetos"
                              >
                                <FolderKanban className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Abrir Grupo de Projetos</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Dossiê */}
                        {canViewDossie && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onAbrirDossie(prj.id)}
                                className="w-7 h-7 text-slate-500 hover:text-[#1E2A4A] hover:bg-slate-200/60 rounded-lg"
                                aria-label="Ver Dossiê do Projeto"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Dossiê consolidado (PDF)</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Ficha */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onAbrirProjeto(prj.id)}
                              className="w-7 h-7 text-[#1E2A4A] hover:text-[#D95A2B] hover:bg-orange-50 rounded-lg"
                              aria-label="Abrir Ficha do Projeto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Abrir ficha completa</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
