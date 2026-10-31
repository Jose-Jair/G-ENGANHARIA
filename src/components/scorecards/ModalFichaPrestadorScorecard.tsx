import React from 'react'
import { PrestadorRecord } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FichaScorecard } from './FichaScorecard'
import { Award, Briefcase, Mail, Phone, Layers, ShieldCheck } from 'lucide-react'

interface ModalFichaPrestadorScorecardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prestador: PrestadorRecord | null
  canRecalculate?: boolean
}

export const ModalFichaPrestadorScorecard: React.FC<ModalFichaPrestadorScorecardProps> = ({
  open,
  onOpenChange,
  prestador,
  canRecalculate = false,
}) => {
  if (!prestador) return null

  const isInterno = prestador.tipo === 'interno'
  const tipoScorecard = isInterno ? 'prestador_interno' : 'prestador_externo'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D95A2B]" />
                {prestador.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Ficha técnica com scorecard ponderado, histórico e tendência de entregas.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {isInterno
                ? 'Equipe Interna G+'
                : prestador.tipo === 'pj_externo'
                  ? 'PJ Terceirizado'
                  : 'PF Externo'}
            </Badge>
          </div>

          {/* Dados Resumidos de Contato */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{prestador.email}</span>
            </div>
            {prestador.telefone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{prestador.telefone}</span>
              </div>
            )}
            {prestador.conselho && (
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {prestador.conselho}{' '}
                  {prestador.numero_registro_conselho && `• ${prestador.numero_registro_conselho}`}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="pt-2">
          <FichaScorecard
            tipo={tipoScorecard}
            registroId={prestador.id}
            nomeEntidade={prestador.nome}
            canRecalculate={canRecalculate}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ModalFichaPrestadorScorecard
