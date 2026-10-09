import React, { useState, useEffect } from 'react'
import { ExecutorRecord } from '@/types'
import { avaliacoesExecutorService, AvaliacaoExecutorRecord } from '@/services/avaliacoesExecutor'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Award, Loader2, MessageSquare, Paperclip } from 'lucide-react'

interface ModalHistoricoAvaliacoesExecutorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executor: ExecutorRecord | null
}

// Histórico das AVALIAÇÕES DE EXECUÇÃO (coleção nova `avaliacoes_executor` — uma por subcontrato).
// Diferente de ModalHistoricoAvaliacoes.tsx, que lê a coleção antiga `avaliacoes` (avaliação por etapa).
export const ModalHistoricoAvaliacoesExecutor: React.FC<ModalHistoricoAvaliacoesExecutorProps> = ({
  open,
  onOpenChange,
  executor,
}) => {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoExecutorRecord[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (open && executor) {
      setCarregando(true)
      avaliacoesExecutorService
        .listByExecutor(executor.id)
        .then(setAvaliacoes)
        .catch(() => {})
        .finally(() => setCarregando(false))
    }
  }, [open, executor])

  const notaMedia =
    avaliacoes.length > 0
      ? avaliacoes.reduce((acc, a) => acc + (a.nota_ponderada || 0), 0) / avaliacoes.length
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#D95A2B]" />
            Histórico de Avaliações de Execução — {executor?.nome}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
            <span>
              Nota geral atual:{' '}
              <strong className="text-slate-900 font-bold">
                {executor?.nota_geral ? executor.nota_geral.toFixed(2) : 'S/ Nota'} / 5.00
              </strong>
            </span>
            <span>•</span>
            <span>{avaliacoes.length} avaliação(ões) de subcontrato</span>
            {notaMedia !== null && (
              <>
                <span>•</span>
                <span>
                  Média das notas ponderadas:{' '}
                  <strong className="text-slate-900">{notaMedia.toFixed(2)}</strong>
                </span>
              </>
            )}
          </div>
        </DialogHeader>

        {carregando ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D95A2B]" />
            Carregando avaliações de execução...
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Nenhuma avaliação de execução registrada ainda
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Este histórico lista as avaliações finais por subcontrato, disponíveis após o
              pagamento de todas as medições.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {avaliacoes.map((av) => {
              const sub = av.expand?.subcontrato
              const prj = av.expand?.projeto
              const avaliador = av.expand?.avaliado_por

              return (
                <div
                  key={av.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900 font-mono">
                        {av.numero}
                        {sub?.numero ? ` — ${sub.numero}` : ''}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        {prj?.codigo ? `Projeto: ${prj.codigo}` : 'Projeto —'}
                        {sub?.valor_total
                          ? ` • Subcontrato: ${formatCurrencyBr(sub.valor_total)}`
                          : ''}
                      </p>
                    </div>

                    <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-xs shrink-0">
                      <Award className="w-3 h-3 text-amber-500 mr-1" />
                      {av.nota_ponderada ? av.nota_ponderada.toFixed(2) : '—'}
                    </Badge>
                  </div>

                  {/* Notas dos 3 critérios */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Prazo (40%):</span>
                      <strong className="text-slate-800">{av.nota_prazo}/5</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Qualidade (40%):</span>
                      <strong className="text-slate-800">{av.nota_qualidade}/5</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Comunicação (20%):</span>
                      <strong className="text-slate-800">{av.nota_comunicacao}/5</strong>
                    </div>
                  </div>

                  {av.comentarios && (
                    <p className="text-xs text-slate-600 italic bg-amber-50/40 p-2 rounded border border-amber-100 flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>"{av.comentarios}"</span>
                    </p>
                  )}

                  {av.anexos && av.anexos.length > 0 && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {av.anexos.length} anexo(s) no dossiê da avaliação
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Avaliado em: {formatDateBr(av.data_avaliacao || av.created)}</span>
                    {avaliador && <span>Por: {avaliador.name || avaliador.email || 'Gestor'}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
