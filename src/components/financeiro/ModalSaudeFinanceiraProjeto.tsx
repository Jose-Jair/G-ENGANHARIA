// =============================================================================
// GESTÃO G+ — MODAL DE SAÚDE FINANCEIRA DO PROJETO
// Exibe os dados do endpoint GET /backend/v1/projetos/{id}/saude-financeira
// Margem real em tempo real, teto vendido, custos diretos e alertas
// =============================================================================

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PainelSaudeFinanceiraProjeto } from '@/components/financeiro/PainelSaudeFinanceiraProjeto'
import { DollarSign, HeartPulse } from 'lucide-react'

interface ModalSaudeFinanceiraProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string
  projetoCodigo?: string
  projetoNome?: string
}

export const ModalSaudeFinanceiraProjeto: React.FC<ModalSaudeFinanceiraProjetoProps> = ({
  open,
  onOpenChange,
  projetoId,
  projetoCodigo,
  projetoNome,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-[#D95A2B]" />
              Saúde Financeira do Projeto
              {projetoCodigo && (
                <Badge variant="outline" className="font-mono text-xs">
                  {projetoCodigo}
                </Badge>
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {projetoNome || 'Diagnóstico de margem em tempo real, teto vendido e custos lançados.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {projetoId ? (
            <PainelSaudeFinanceiraProjeto
              projetoId={projetoId}
              projetoCodigo={projetoCodigo}
              projetoNome={projetoNome}
            />
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhum projeto selecionado.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default ModalSaudeFinanceiraProjeto
