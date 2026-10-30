import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { PrestadorRecord, OrdemServicoRecord } from '@/types'
import { Users, Briefcase, AlertOctagon, CheckCircle2, UserCheck } from 'lucide-react'
import { SemaforoBadge, SemaforoPrazoStatus } from './SemaforoBadge'

export interface PrestadorCargaItem {
  prestador: PrestadorRecord
  tipo: 'interno' | 'externo'
  totalOsAtivas: number
  totalOsAtrasadas: number
  totalOsNoPrazo: number
  totalOsAtencao: number
  disciplinas: string[]
  capacidadeMax?: number
  percentualOcupacao: number
  statusGeral: SemaforoPrazoStatus
}

interface PainelCargaPrestadoresProps {
  cargas: PrestadorCargaItem[]
  filtroTipo?: 'todos' | 'interno' | 'externo'
  onSelectPrestador?: (prestadorId: string) => void
  prestadorSelecionadoId?: string
}

export const PainelCargaPrestadores: React.FC<PainelCargaPrestadoresProps> = ({
  cargas,
  filtroTipo = 'todos',
  onSelectPrestador,
  prestadorSelecionadoId,
}) => {
  const cargasFiltradas = cargas.filter((c) => {
    if (filtroTipo === 'todos') return true
    return c.tipo === filtroTipo
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#D95A2B]" />
          <h3 className="text-sm font-bold text-slate-900">
            Carga de Trabalho por Prestador ({cargasFiltradas.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          Equipe técnica própria (Interna) e subcontratados homologados (Externos)
        </span>
      </div>

      {cargasFiltradas.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          Nenhum prestador encontrado com OS ativas no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cargasFiltradas.map((item) => {
            const isSelected = prestadorSelecionadoId === item.prestador.id
            const isInterno = item.tipo === 'interno'

            return (
              <Card
                key={item.prestador.id}
                onClick={() => onSelectPrestador && onSelectPrestador(item.prestador.id)}
                className={`transition-all border cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-[#D95A2B] border-[#D95A2B] shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <CardContent className="p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-bold text-slate-900 truncate block">
                          {item.prestador.nome}
                        </strong>
                      </div>
                      <span className="text-[11px] text-slate-500 block truncate">
                        {item.disciplinas.join(', ') || item.prestador.disciplinas || 'Engenharia'}
                      </span>
                    </div>

                    <Badge
                      className={`text-[9px] uppercase font-bold shrink-0 ${
                        isInterno ? 'bg-sky-600 text-white' : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {isInterno ? 'Equipe Interna' : 'Externo'}
                    </Badge>
                  </div>

                  {/* Barra de Ocupação / Carga */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Ocupação / Carga:</span>
                      <strong className="text-slate-800 font-mono">
                        {item.totalOsAtivas}{' '}
                        {item.capacidadeMax ? `/ ${item.capacidadeMax} OS` : 'OS ativas'}
                      </strong>
                    </div>
                    <Progress
                      value={Math.min(100, item.percentualOcupacao)}
                      className={`h-2 ${
                        item.totalOsAtrasadas > 0
                          ? '[&>div]:bg-rose-600'
                          : item.percentualOcupacao >= 90
                            ? '[&>div]:bg-amber-500'
                            : '[&>div]:bg-[#D95A2B]'
                      }`}
                    />
                  </div>

                  {/* Resumo de Semáforo da Carga */}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {item.totalOsAtrasadas > 0 && (
                        <span className="text-rose-700 font-bold flex items-center gap-0.5">
                          <AlertOctagon className="w-3 h-3" />
                          {item.totalOsAtrasadas} atrasada(s)
                        </span>
                      )}
                      {item.totalOsAtencao > 0 && (
                        <span className="text-amber-700 font-medium">
                          {item.totalOsAtencao} atenção
                        </span>
                      )}
                      {item.totalOsNoPrazo > 0 && (
                        <span className="text-emerald-700 font-medium">
                          {item.totalOsNoPrazo} em dia
                        </span>
                      )}
                    </div>

                    <SemaforoBadge status={item.statusGeral} tamanho="sm" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PainelCargaPrestadores
