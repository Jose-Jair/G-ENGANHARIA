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
  isAdmin?: boolean
  temAcessoPortal?: boolean
  onGerenciarAcesso?: (prestador: PrestadorRecord, jaTemAcesso: boolean) => void
}

export const ModalFichaPrestadorScorecard: React.FC<ModalFichaPrestadorScorecardProps> = ({
  open,
  onOpenChange,
  prestador,
  canRecalculate = false,
  isAdmin = false,
  temAcessoPortal = false,
  onGerenciarAcesso,
}) => {
  if (!prestador) return null

  const isInterno = prestador.tipo === 'interno'
  const tipoScorecard = isInterno ? 'prestador_interno' : 'prestador_externo'
  const elegivelAcesso =
    prestador.status === 'ativo' || (prestador.status as string) === 'homologado'

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
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isAdmin &&
                elegivelAcesso &&
                (temAcessoPortal ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1 py-0 h-5">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Acesso ativo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] gap-1 py-0 h-5"
                  >
                    Sem acesso ao portal
                  </Badge>
                ))}
              <Badge variant="outline" className="text-xs capitalize">
                {isInterno
                  ? 'Equipe Interna G+'
                  : prestador.tipo === 'pj_externo'
                    ? 'PJ Terceirizado'
                    : 'PF Externo'}
              </Badge>
            </div>
          </div>

          {/* Ações Administrativas de Acesso ao Portal (Item 8 - Visível apenas para Admin) */}
          {isAdmin && elegivelAcesso && onGerenciarAcesso && (
            <div className="mt-3 p-2.5 rounded-lg bg-orange-50/60 border border-orange-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <ShieldCheck className="w-4 h-4 text-[#D95A2B]" />
                <span>
                  Portal do Prestador:{' '}
                  {temAcessoPortal ? (
                    <strong className="text-emerald-700">Acesso Ativo</strong>
                  ) : (
                    <span className="text-slate-500">Nenhum usuário vinculado</span>
                  )}
                </span>
              </div>
              <div>
                {temAcessoPortal ? (
                  <button
                    type="button"
                    onClick={() => onGerenciarAcesso(prestador, true)}
                    className="inline-flex items-center justify-center rounded-md text-[11px] font-medium h-7 px-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
                  >
                    Reenviar convite
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGerenciarAcesso(prestador, false)}
                    className="inline-flex items-center justify-center rounded-md text-[11px] font-medium h-7 px-2.5 bg-[#D95A2B] hover:bg-[#c44e24] text-white shadow-xs cursor-pointer"
                  >
                    Criar acesso do prestador
                  </button>
                )}
              </div>
            </div>
          )}

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
