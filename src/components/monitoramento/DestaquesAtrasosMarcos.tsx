import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateBr } from '@/lib/formatters'
import { Calendar, AlertOctagon, Clock, ArrowRight, MessageSquare } from 'lucide-react'
import { SemaforoBadge } from './SemaforoBadge'

export interface ItemAtrasoOuMarco {
  id: string
  tipo: 'os' | 'entregavel'
  titulo: string
  subtitulo?: string
  projetoCodigo?: string
  prestadorNome?: string
  disciplina?: string
  dataPrazo: string
  diasDiferenca: number // negativo = atrasado, positivo = futuro
  statusOriginal: string
}

interface DestaquesAtrasosMarcosProps {
  atrasos: ItemAtrasoOuMarco[]
  proximosMarcos: ItemAtrasoOuMarco[]
  onAbrirWhatsApp?: (osId: string) => void
  onNavegarProjeto?: (projetoId?: string) => void
}

export const DestaquesAtrasosMarcos: React.FC<DestaquesAtrasosMarcosProps> = ({
  atrasos,
  proximosMarcos,
  onAbrirWhatsApp,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Coluna 1: Atrasos em Destaque */}
      <Card className="border-rose-200 bg-rose-50/40 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-rose-950">
                Atrasos Críticos em Destaque ({atrasos.length})
              </h3>
            </div>
            <Badge className="bg-rose-600 text-white text-[10px]">Ação Necessária</Badge>
          </div>

          {atrasos.length === 0 ? (
            <div className="p-4 bg-white/80 rounded-lg text-xs text-emerald-800 border border-emerald-200">
              Nenhuma OS ou entregável com prazo vencido. Parabéns à equipe!
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {atrasos.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-white rounded-lg border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-rose-400 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-900 truncate block">{item.titulo}</strong>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">
                        {item.tipo === 'os' ? 'OS' : 'Entregável'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.prestadorNome && <span>Prestador: {item.prestadorNome} • </span>}
                      {item.disciplina && <span>{item.disciplina}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <SemaforoBadge
                      status="atrasado"
                      diasRestantes={item.diasDiferenca}
                      tamanho="sm"
                    />
                    {item.tipo === 'os' && onAbrirWhatsApp && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAbrirWhatsApp(item.id)}
                        className="h-7 text-[11px] border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1 px-2"
                        title="Cobrar prestador via link WhatsApp wa.me"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-600" />
                        <span>wa.me</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coluna 2: Próximos Marcos */}
      <Card className="border-sky-200 bg-sky-50/40 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#1E2A4A] text-amber-300">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Próximos Marcos & Entregas (≤ 7 dias) ({proximosMarcos.length})
              </h3>
            </div>
            <Badge className="bg-[#1E2A4A] text-white text-[10px]">Cronograma Ativo</Badge>
          </div>

          {proximosMarcos.length === 0 ? (
            <div className="p-4 bg-white/80 rounded-lg text-xs text-slate-500 border border-slate-200">
              Nenhum marco programado para os próximos 7 dias.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {proximosMarcos.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-900 truncate block">{item.titulo}</strong>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono">
                        {item.tipo === 'os' ? 'OS' : 'Entregável'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.prestadorNome && <span>Prestador: {item.prestadorNome} • </span>}
                      <span>Vencimento: {formatDateBr(item.dataPrazo)}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <SemaforoBadge
                      status={item.diasDiferenca <= 3 ? 'atencao' : 'no_prazo'}
                      diasRestantes={item.diasDiferenca}
                      tamanho="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DestaquesAtrasosMarcos
