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
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  FileCheck,
} from 'lucide-react'
import type { IaPreRevisaoEntregavelResponse } from '@/services/iaOperacao'

export interface ModalPreRevisaoEntregavelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entregavelNome: string
  versaoNum?: number
  carregando: boolean
  resultado: IaPreRevisaoEntregavelResponse['rascunho'] | null
  erro: string | null
  onFechar: () => void
}

/**
 * Modal informativo de Pré-Revisão de Entregável via IA.
 * PRINCÍPIO: Exibe a verificação contra o checklist do Catálogo de Escopos SEM alterar o status do entregável.
 * A decisão de aprovar ou devolver o entregável continua 100% sob controle humano na aba Entregáveis.
 */
export const ModalPreRevisaoEntregavel: React.FC<ModalPreRevisaoEntregavelProps> = ({
  open,
  onOpenChange,
  entregavelNome,
  versaoNum = 1,
  carregando,
  resultado,
  erro,
  onFechar,
}) => {
  const isChaveDesligada =
    erro?.toLowerCase().includes('desativado') ||
    erro?.toLowerCase().includes('desligado') ||
    erro?.toLowerCase().includes('ia_pre_revisao')

  const renderBadgeResultado = (status?: string) => {
    switch (status) {
      case 'apto_para_revisao_humana':
        return (
          <Badge className="bg-emerald-600 text-white text-[11px] gap-1 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Apto para Revisão Humana
          </Badge>
        )
      case 'alerta_documental':
        return (
          <Badge className="bg-amber-500 text-white text-[11px] gap-1 py-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerta Documental
          </Badge>
        )
      case 'incompleto':
      default:
        return (
          <Badge className="bg-rose-600 text-white text-[11px] gap-1 py-0.5">
            <XCircle className="w-3.5 h-3.5" />
            Incompleto / Pendências
          </Badge>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              Pré-Análise Assistida por IA
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              v{versaoNum}.0
            </Badge>
          </div>
          <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
            Pré-Revisão Técnica: {entregavelNome}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Comparativo automático dos metadados e do histórico do entregável contra o checklist do
            Catálogo de Escopos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {carregando ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
              <p className="text-xs font-semibold text-slate-700">
                Processando pré-revisão contra o checklist técnico...
              </p>
              <p className="text-[11px] text-slate-400">
                Avaliando conformidade do entregável de forma não-intrusiva.
              </p>
            </div>
          ) : erro ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isChaveDesligada ? 'Recurso de Pré-Revisão Desativado' : 'Aviso na Pré-Revisão'}
                </span>
              </div>
              <p className="leading-relaxed">{erro}</p>
              {isChaveDesligada && (
                <p className="text-[11px] text-amber-800 pt-1">
                  O recurso <code>ia_pre_revisao</code> está desativado por padrão nos Parâmetros do
                  sistema. Para habilitá-lo, altere a chave para <code>true</code> em Administração.
                </p>
              )}
            </div>
          ) : resultado ? (
            <div className="space-y-4">
              {/* Card de Resumo do Parecer */}
              <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Resultado da Pré-Análise:
                    </span>
                    {renderBadgeResultado(resultado.resultado_pre_analise)}
                  </div>
                  <div className="text-xs text-slate-600">
                    Pontuação:{' '}
                    <strong className="text-purple-700 font-bold">
                      {resultado.pontuacao_conformidade_percentual}%
                    </strong>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">
                    Parecer Sintético:
                  </span>
                  {resultado.parecer_sintetico}
                </div>

                {resultado.recomendacao_ao_revisor_humano && (
                  <div className="text-xs text-slate-600 bg-purple-50/60 p-2.5 rounded border border-purple-200/80">
                    <span className="font-semibold text-purple-900 block mb-0.5">
                      Recomendação ao Revisor Humano:
                    </span>
                    {resultado.recomendacao_ao_revisor_humano}
                  </div>
                )}
              </div>

              {/* Itens do Checklist */}
              {resultado.itens_checklist && resultado.itens_checklist.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-purple-600" />
                    Itens do Checklist Avaliados ({resultado.itens_checklist.length})
                  </span>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {resultado.itens_checklist.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border rounded text-xs flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{it.item}</span>
                            {it.obrigatorio && (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-rose-700 border-rose-300"
                              >
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                          {it.observacao && (
                            <p className="text-[11px] text-slate-500">{it.observacao}</p>
                          )}
                        </div>

                        <div className="shrink-0">
                          {it.status === 'conforme' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Conforme
                            </Badge>
                          ) : it.status === 'pendente' ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Pendente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-500">
                              N/A
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aviso Ético de Apoio à Decisão */}
              <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-md text-[11px] text-sky-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  <strong>Decisão Exclusiva do Revisor Humano:</strong> esta análise serve apenas
                  como orientação prévia. O status do entregável <strong>não foi alterado</strong> e
                  sua aprovação ou devolução deve ser realizada pelo botão "Avaliar Versão" na ficha
                  do entregável.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onFechar} className="text-xs">
            Fechar Modal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalPreRevisaoEntregavel
