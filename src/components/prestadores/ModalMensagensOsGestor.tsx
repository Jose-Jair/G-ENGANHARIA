// =============================================================================
// GESTÃO G+ — MODAL DE DETALHES E CANAL DE MENSAGENS DA ORDEM DE SERVIÇO
// Exibição completa da OS com aba de escopo/detalhes e aba de Mensagens Técnicas.
// =============================================================================

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, FileText, Briefcase, Calendar, DollarSign, ShieldCheck } from 'lucide-react'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { PainelMensagensOs } from './PainelMensagensOs'
import type { OrdemServicoRecord } from '@/types'

export interface ModalMensagensOsGestorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  os: OrdemServicoRecord | null
  usuarioNome: string
  usuarioId?: string
  usuarioEmail?: string
  naoLidasCount?: number
  onMensagensLidas?: () => void
  onAbrirDossie?: () => void
}

export const ModalMensagensOsGestor: React.FC<ModalMensagensOsGestorProps> = ({
  open,
  onOpenChange,
  os,
  usuarioNome,
  usuarioId,
  usuarioEmail,
  naoLidasCount = 0,
  onMensagensLidas,
  onAbrirDossie,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'mensagens' | 'detalhes'>('mensagens')

  if (!os) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#D95A2B]" />
                  Ordem de Serviço {os.numero}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {os.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Disciplina: <strong>{os.disciplina || 'Engenharia'}</strong> • Valor:{' '}
                <strong className="text-emerald-700">{formatCurrencyBr(os.valor_os || 0)}</strong>
              </DialogDescription>
            </div>

            {onAbrirDossie && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAbrirDossie}
                className="h-8 text-xs text-slate-700 border-slate-300 gap-1.5 shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#D95A2B]" />
                Dossiê de Evidências
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <Tabs
            value={abaAtiva}
            onValueChange={(v) => setAbaAtiva(v as 'mensagens' | 'detalhes')}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 text-xs">
              <TabsTrigger value="mensagens" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#D95A2B]" />
                <span>Canal de Mensagens</span>
                {naoLidasCount > 0 && (
                  <Badge className="bg-[#D95A2B] text-white text-[10px] px-1.5 py-0 h-4">
                    {naoLidasCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="detalhes" className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Ficha e Escopo da OS</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mensagens" className="pt-3">
              <PainelMensagensOs
                osId={os.id}
                numeroOs={os.numero}
                autorTipo="interno"
                autorNome={usuarioNome}
                autorUsuarioId={usuarioId}
                autorEmail={usuarioEmail}
                onMensagensLidas={onMensagensLidas}
              />
            </TabsContent>

            <TabsContent value="detalhes" className="pt-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Valor Contratado</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatCurrencyBr(os.valor_os || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Prazo de Execução</span>
                  <span className="font-semibold text-slate-800">
                    {os.prazo_dias ? `${os.prazo_dias} dias corridos` : 'Não definido'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Previsão de Conclusão</span>
                  <span className="font-semibold text-slate-800">
                    {os.data_previsao_fim ? formatDateBr(os.data_previsao_fim) : 'Em cronograma'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Escopo Técnico
                </span>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {os.escopo_tecnico || 'Nenhum escopo detalhado cadastrado.'}
                </div>
              </div>

              {os.clausulas_texto && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Cláusulas e Condições Técnicas
                  </span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 whitespace-pre-line">
                    {os.clausulas_texto}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ModalMensagensOsGestor
