import React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, AlertOctagon, Clock, HelpCircle } from 'lucide-react'

export type SemaforoPrazoStatus =
  | 'no_prazo'
  | 'atencao'
  | 'atrasado'
  | 'aguardando_revisao'
  | 'concluido'
  | 'sem_prazo'

interface SemaforoBadgeProps {
  status: SemaforoPrazoStatus
  diasRestantes?: number | null
  horasEmRevisao?: number | null
  className?: string
  tamanho?: 'sm' | 'md'
}

export const SemaforoBadge: React.FC<SemaforoBadgeProps> = ({
  status,
  diasRestantes,
  horasEmRevisao,
  className = '',
  tamanho = 'md',
}) => {
  const sizeClasses = tamanho === 'sm' ? 'text-[10px] py-0.5 px-1.5' : 'text-xs py-1 px-2'

  switch (status) {
    case 'no_prazo':
      return (
        <Badge
          className={`bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-2xs ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>No prazo</span>
          {diasRestantes !== undefined && diasRestantes !== null && (
            <span className="font-mono opacity-90">({diasRestantes}d)</span>
          )}
        </Badge>
      )

    case 'atencao':
      return (
        <Badge
          className={`bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1 shadow-2xs ${sizeClasses} ${className}`}
        >
          <Clock className="w-3 h-3" />
          <span>Atenção</span>
          {diasRestantes !== undefined && diasRestantes !== null && (
            <span className="font-mono">
              ({diasRestantes === 0 ? 'Hoje' : `${diasRestantes}d`})
            </span>
          )}
        </Badge>
      )

    case 'atrasado':
      return (
        <Badge
          className={`bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1 shadow-2xs ${sizeClasses} ${className}`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>Atrasado</span>
          {diasRestantes !== undefined && diasRestantes !== null && (
            <span className="font-mono">(+{Math.abs(diasRestantes)}d)</span>
          )}
        </Badge>
      )

    case 'aguardando_revisao':
      return (
        <Badge
          className={`bg-sky-600 hover:bg-sky-700 text-white font-medium gap-1 shadow-2xs ${sizeClasses} ${className}`}
        >
          <Clock className="w-3 h-3" />
          <span>Aguardando revisão interna</span>
          {horasEmRevisao !== undefined && horasEmRevisao !== null && (
            <span className="font-mono opacity-90">({horasEmRevisao}h)</span>
          )}
        </Badge>
      )

    case 'concluido':
      return (
        <Badge
          variant="outline"
          className={`border-emerald-300 bg-emerald-50 text-emerald-800 gap-1 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Concluído</span>
        </Badge>
      )

    case 'sem_prazo':
    default:
      return (
        <Badge
          variant="outline"
          className={`border-slate-300 bg-slate-50 text-slate-600 gap-1 ${sizeClasses} ${className}`}
        >
          <HelpCircle className="w-3 h-3 text-slate-400" />
          <span>Sem prazo</span>
        </Badge>
      )
  }
}

export default SemaforoBadge
