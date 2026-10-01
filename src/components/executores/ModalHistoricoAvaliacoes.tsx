import React, { useState, useEffect } from 'react'
import { ExecutorRecord, AvaliacaoRecord } from '@/types'
import { avaliacoesService } from '@/services/executores'
import { formatDateBr } from '@/lib/formatters'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Star, MessageSquare, Loader2 } from 'lucide-react'

interface ModalHistoricoAvaliacoesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executor: ExecutorRecord | null
}

export const ModalHistoricoAvaliacoes: React.FC<ModalHistoricoAvaliacoesProps> = ({
  open,
  onOpenChange,
  executor,
}) => {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRecord[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (open && executor) {
      setCarregando(true)
      avaliacoesService
        .listByExecutor(executor.id)
        .then(setAvaliacoes)
        .catch(() => {})
        .finally(() => setCarregando(false))
    }
  }, [open, executor])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Histórico de Avaliações — {executor?.nome}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
            <span>
              Nota Geral Ponderada:{' '}
              <strong className="text-slate-900 font-bold">
                {executor?.nota_geral ? executor.nota_geral.toFixed(2) : 'S/ Nota'} / 5.00
              </strong>
            </span>
            <span>•</span>
            <span>Total: {avaliacoes.length} avaliações</span>
          </div>
        </DialogHeader>

        {carregando ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            Carregando avaliações...
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              Nenhuma avaliação realizada ainda
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ao concluir uma etapa terceirizada, o Gestor de Projetos registra as notas de
              desempenho.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {avaliacoes.map((av) => (
              <div
                key={av.id}
                className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-900">
                      {av.expand?.etapa?.nome || 'Etapa Concluída'}
                    </h4>
                    {av.expand?.etapa?.expand?.projeto && (
                      <p className="text-[10px] font-mono text-slate-400">
                        Projeto: {av.expand.etapa.expand.projeto.codigo} -{' '}
                        {av.expand.etapa.expand.projeto.nome}
                      </p>
                    )}
                  </div>

                  <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-xs shrink-0">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500 mr-1" />
                    {av.nota_final ? av.nota_final.toFixed(2) : '—'}
                  </Badge>
                </div>

                {/* Notas dos 4 critérios */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pontualidade:</span>
                    <strong className="text-slate-800">{av.pontualidade}/5</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Qualidade:</span>
                    <strong className="text-slate-800">{av.qualidade}/5</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Desvio Custo:</span>
                    <strong className="text-slate-800">{av.desvio_custo}/5</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Responsividade:</span>
                    <strong className="text-slate-800">{av.responsividade}/5</strong>
                  </div>
                </div>

                {av.comentario && (
                  <p className="text-xs text-slate-600 italic bg-amber-50/40 p-2 rounded border border-amber-100">
                    "{av.comentario}"
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>Avaliado em: {formatDateBr(av.created)}</span>
                  {av.expand?.avaliado_por && (
                    <span>Por: {av.expand.avaliado_por.name || av.expand.avaliado_por.email}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
