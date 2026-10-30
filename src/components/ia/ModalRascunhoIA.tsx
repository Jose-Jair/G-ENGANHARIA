import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react'

export interface ModalRascunhoIAProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  subtitulo?: string
  carregando: boolean
  textoRascunho: string
  onTextoChange: (novoTexto: string) => void
  onAprovar: () => void
  onDescartar: () => void
  erro?: string | null
  rotuloAprovar?: string
  rotuloDescartar?: string
  badgeRecurso?: string
  children?: React.ReactNode
  bloquearAprovacao?: boolean
}

/**
 * Componente compartilhado da Rodada 9 para exibição e aprovação de rascunhos de IA.
 * PRINCÍPIO FUNDAMENTAL: Nada é aplicado ao registro sem clique humano explícito em "Aprovar e aplicar".
 * Trata o erro 400 de chave desligada com feedback amigável e claro em PT-BR.
 */
export const ModalRascunhoIA: React.FC<ModalRascunhoIAProps> = ({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  carregando,
  textoRascunho,
  onTextoChange,
  onAprovar,
  onDescartar,
  erro,
  rotuloAprovar = 'Aprovar e aplicar',
  rotuloDescartar = 'Descartar',
  badgeRecurso = 'Assistente IA G+',
  children,
  bloquearAprovacao = false,
}) => {
  const isChaveDesligada =
    erro?.toLowerCase().includes('desativado') ||
    erro?.toLowerCase().includes('desligado') ||
    erro?.toLowerCase().includes('ia_')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-orange-50 text-[#D95A2B] border-orange-200 text-[10px] gap-1"
            >
              <Sparkles className="w-3 h-3 text-[#D95A2B]" />
              {badgeRecurso}
            </Badge>
          </div>
          <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
            {titulo}
          </DialogTitle>
          {subtitulo && (
            <DialogDescription className="text-xs text-slate-500">{subtitulo}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {carregando ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D95A2B]" />
              <p className="text-xs font-semibold text-slate-700">
                Processando requisição com IA...
              </p>
              <p className="text-[11px] text-slate-400">
                Compilando dados técnicos seguros e estruturando o rascunho de forma auditável.
              </p>
            </div>
          ) : erro ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isChaveDesligada ? 'Recurso de IA Desativado' : 'Aviso ao consultar IA'}
                </span>
              </div>
              <p className="leading-relaxed">{erro}</p>
              {isChaveDesligada && (
                <p className="text-[11px] text-amber-800 pt-1">
                  Para ativar este recurso, um Administrador do sistema deve habilitar a respectiva
                  chave na tela de <strong>Administração &gt; Parâmetros do Sistema</strong>.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Slot opcional para campos específicos (ex: entregáveis gerados, checklist) */}
              {children}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Rascunho Gerado (Revise e edite antes de aprovar):
                  </Label>
                  <span className="text-[10px] text-slate-400">Editável pelo operador humano</span>
                </div>
                <Textarea
                  value={textoRascunho}
                  onChange={(e) => onTextoChange(e.target.value)}
                  rows={8}
                  placeholder="O texto gerado pela IA aparecerá aqui para sua revisão..."
                  className="text-xs font-mono border-slate-300 focus:border-[#D95A2B] leading-relaxed"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Decisão Humana Obrigatória:</strong> nada é gravado ou alterado
                  automaticamente no banco de dados sem o clique em "{rotuloAprovar}".
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDescartar}
            disabled={carregando}
            className="text-xs gap-1"
          >
            <X className="w-3.5 h-3.5" />
            {rotuloDescartar}
          </Button>

          {!erro && !carregando && (
            <Button
              type="button"
              size="sm"
              onClick={onAprovar}
              disabled={bloquearAprovacao || !textoRascunho.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {rotuloAprovar}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalRascunhoIA
