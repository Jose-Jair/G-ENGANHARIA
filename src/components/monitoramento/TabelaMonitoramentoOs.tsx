import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrdemServicoRecord, EntregavelRecord } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  FileText,
  Calendar,
  Layers,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { SemaforoBadge, SemaforoPrazoStatus } from './SemaforoBadge'

export interface ItemMonitoramentoOs {
  os: OrdemServicoRecord
  projetoNome: string
  projetoCodigo: string
  prestadorNome: string
  disciplina: string
  prazoFim: string | null
  statusSemaforo: SemaforoPrazoStatus
  diasDiferenca: number | null
  entregaveis: {
    item: EntregavelRecord
    statusSemaforo: SemaforoPrazoStatus
    diasDiferenca: number | null
    horasEmRevisao: number | null
  }[]
}

interface TabelaMonitoramentoOsProps {
  itens: ItemMonitoramentoOs[]
  onAbrirWhatsApp: (osId: string) => void
  onNavegarProjeto: (projetoId: string) => void
}

export const TabelaMonitoramentoOs: React.FC<TabelaMonitoramentoOsProps> = ({
  itens,
  onAbrirWhatsApp,
  onNavegarProjeto,
}) => {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const toggleExpandir = (osId: string) => {
    setExpandidos((prev) => ({ ...prev, [osId]: !prev[osId] }))
  }

  return (
    <div className="space-y-2">
      {itens.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          Nenhuma Ordem de Serviço encontrada com os filtros selecionados.
        </div>
      ) : (
        itens.map((item) => {
          const { os, entregaveis } = item
          const isExpandido = Boolean(expandidos[os.id])
          const temEntregaveis = entregaveis.length > 0

          return (
            <Card
              key={os.id}
              className="border-slate-200 shadow-2xs hover:border-slate-300 transition-colors overflow-hidden"
            >
              <CardContent className="p-0">
                {/* Linha Principal da OS */}
                <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExpandir(os.id)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 mt-0.5 shrink-0"
                      title={isExpandido ? 'Recolher entregáveis' : 'Ver entregáveis da OS'}
                    >
                      {isExpandido ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-bold text-slate-900 font-mono">
                          {os.numero}
                        </strong>
                        <span className="text-xs font-semibold text-[#1E2A4A] bg-slate-100 px-2 py-0.5 rounded">
                          {item.projetoCodigo}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-bold text-slate-600 bg-slate-50"
                        >
                          {os.tipo_prestador === 'interno' ? 'Equipe Interna' : 'Externo'}
                        </Badge>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span>
                          Prestador: <strong>{item.prestadorNome}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Disciplina: <strong>{item.disciplina}</strong>
                        </span>
                        {item.prazoFim && (
                          <>
                            <span>•</span>
                            <span>
                              Previsão Fim: <strong>{formatDateBr(item.prazoFim)}</strong>
                            </span>
                          </>
                        )}
                        {temEntregaveis && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 font-medium">
                              {entregaveis.length} entregável(eis)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Semáforo e Ações da OS */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <SemaforoBadge
                      status={item.statusSemaforo}
                      diasRestantes={item.diasDiferenca}
                    />

                    {/* Botão wa.me pronto */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAbrirWhatsApp(os.id)}
                      className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1 font-semibold"
                      title="Abrir contato pronto com o prestador da OS no WhatsApp (wa.me)"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp wa.me</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavegarProjeto(os.projeto)}
                      className="h-8 text-xs text-slate-600 hover:text-slate-900"
                      title="Abrir ficha completa do projeto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Subtabela de Entregáveis da OS (Quando expandido) */}
                {isExpandido && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        Entregáveis vinculados a esta OS
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Acompanhe o semáforo de revisão técnica e prazo
                      </span>
                    </div>

                    {!temEntregaveis ? (
                      <p className="text-xs text-slate-500 italic p-2 bg-white rounded border border-slate-200">
                        Nenhum entregável individual cadastrado nesta Ordem de Serviço até o
                        momento.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {entregaveis.map(
                          ({ item: ent, statusSemaforo, diasDiferenca, horasEmRevisao }) => (
                            <div
                              key={ent.id}
                              className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-slate-300"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-800 truncate block">
                                    {ent.titulo || ent.nome}
                                  </strong>
                                  {ent.versao && (
                                    <Badge variant="outline" className="text-[9px] font-mono">
                                      v{ent.versao}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                  {ent.prazo ? (
                                    <span>Prazo de entrega: {formatDateBr(ent.prazo)}</span>
                                  ) : (
                                    <span>Sem prazo formal fixado</span>
                                  )}
                                  <span>•</span>
                                  <span className="capitalize">Status: {ent.status}</span>
                                </div>
                              </div>

                              <div className="shrink-0">
                                <SemaforoBadge
                                  status={statusSemaforo}
                                  diasRestantes={diasDiferenca}
                                  horasEmRevisao={horasEmRevisao}
                                  tamanho="sm"
                                />
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

export default TabelaMonitoramentoOs
