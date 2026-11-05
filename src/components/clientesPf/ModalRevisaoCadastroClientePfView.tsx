import React from 'react'
import { ModalPadrao } from '@/components/comum/ModalPadrao'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, Send, FileCheck } from 'lucide-react'
import { ClientePfRecord, ConviteClientePfRecord } from '@/services/clientesPf'
import { formatCpf } from '@/lib/cnpj'

export interface LinhaComparacao {
  campo: string
  dadoAtual: string
  dadoEnviado: string
  diferente: boolean
}

interface ModalRevisaoCadastroClientePfProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  carregandoConvite: boolean
  erroConvite: string | null
  convite: ConviteClientePfRecord | null
  linhasComparacao: LinhaComparacao[]
  totalDiferencas: number
  confirmandoAprovacao: boolean
  processandoAprovacao: boolean
  modoRecusa: boolean
  motivoRecusa: string
  processandoRecusa: boolean
  recusaConcluida: boolean
  erroApi: string | null
  formatarDataIsoBr: (iso?: string | null) => string
  onConfirmarAprovacaoClick: () => void
  onCancelarAprovacaoClick: () => void
  onAprovar: () => void
  onModoRecusaClick: () => void
  onCancelarRecusaClick: () => void
  onMotivoRecusaChange: (motivo: string) => void
  onRecusar: () => void
  onGerarNovoLink?: (cliente: ClientePfRecord) => void
}

export function ModalRevisaoCadastroClientePfView({
  open,
  onOpenChange,
  cliente,
  carregandoConvite,
  erroConvite,
  convite,
  linhasComparacao,
  totalDiferencas,
  confirmandoAprovacao,
  processandoAprovacao,
  modoRecusa,
  motivoRecusa,
  processandoRecusa,
  recusaConcluida,
  erroApi,
  formatarDataIsoBr,
  onConfirmarAprovacaoClick,
  onCancelarAprovacaoClick,
  onAprovar,
  onModoRecusaClick,
  onCancelarRecusaClick,
  onMotivoRecusaChange,
  onRecusar,
  onGerarNovoLink,
}: ModalRevisaoCadastroClientePfProps) {
  return (
    <ModalPadrao
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="sm:max-w-3xl"
      title={
        <span className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileCheck className="w-5 h-5 text-[#D95A2B]" />
          Revisar cadastro do cliente PF
        </span>
      }
      description={
        cliente
          ? `Cliente: ${cliente.nome}${cliente.cpf ? ` • CPF ${formatCpf(cliente.cpf)}` : ''}`
          : undefined
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          {recusaConcluida && cliente && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onGerarNovoLink?.(cliente)
              }}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Gerar novo link
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {carregandoConvite ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D95A2B]" />
            <span className="text-xs">Buscando dados enviados pelo cliente...</span>
          </div>
        ) : erroConvite ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>Aviso</span>
            </div>
            <p className="leading-relaxed">{erroConvite}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  <strong>Data/hora do envio:</strong>{' '}
                  {formatarDataIsoBr(convite?.enviado_em || convite?.updated)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                >
                  Em revisão
                </Badge>
                {totalDiferencas > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-orange-50 text-[#D95A2B] border-orange-200 font-semibold"
                  >
                    {totalDiferencas} campo(s) com alteração
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-normal"
                  >
                    Campos idênticos
                  </Badge>
                )}
              </div>
            </div>

            {erroApi && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <strong className="block">Não foi possível concluir:</strong>
                  <span>{erroApi}</span>
                </div>
              </div>
            )}

            {recusaConcluida ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <XCircle className="w-4.5 h-4.5 text-amber-700" />
                  <span>Cadastro recusado com sucesso</span>
                </div>
                <p className="leading-relaxed">
                  O cliente voltou para a situação <strong>Pré-cadastro</strong>. O motivo da recusa
                  foi registrado em auditoria. Deseja gerar um novo link de cadastro agora para
                  reenviar ao cliente?
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      if (cliente) onGerarNovoLink?.(cliente)
                    }}
                    className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Gerar novo link agora
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-1/4">Campo</th>
                          <th className="py-2.5 px-3 w-3/8">Dado atual</th>
                          <th className="py-2.5 px-3 w-3/8">Dado enviado pelo cliente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {linhasComparacao.map((l) => (
                          <tr
                            key={l.campo}
                            className={
                              l.diferente
                                ? 'bg-orange-50/80 hover:bg-orange-100/70 transition-colors'
                                : 'hover:bg-slate-50 transition-colors'
                            }
                          >
                            <td className="py-2 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                              {l.diferente && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-[#D95A2B] shrink-0"
                                  title="Campo alterado pelo cliente"
                                />
                              )}
                              <span>{l.campo}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 break-words font-mono text-[11px]">
                              {l.dadoAtual}
                            </td>
                            <td
                              className={`py-2 px-3 break-words font-mono text-[11px] ${
                                l.diferente ? 'text-[#D95A2B] font-bold' : 'text-slate-800'
                              }`}
                            >
                              {l.dadoEnviado}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {confirmandoAprovacao && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
                    <p className="text-xs text-emerald-950">
                      <strong>Confirmar aprovação:</strong> Os dados enviados pelo cliente serão
                      gravados no cadastro oficial, o CPF único será revalidado e o cliente passará
                      para a situação <strong>Completo</strong> (selo verde).
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={processandoAprovacao}
                        onClick={onAprovar}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                      >
                        {processandoAprovacao ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Gravando dados...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sim, aprovar e gravar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processandoAprovacao}
                        onClick={onCancelarAprovacaoClick}
                        className="text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {modoRecusa && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 space-y-2">
                    <Label className="text-xs font-semibold text-rose-900">
                      Motivo da recusa <span className="text-red-600">*</span>
                    </Label>
                    <Textarea
                      rows={2}
                      value={motivoRecusa}
                      onChange={(e) => onMotivoRecusaChange(e.target.value)}
                      placeholder="Ex: Documento de RG ilegível ou divergência no endereço informado..."
                      className="text-xs bg-white"
                    />
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Ao recusar, o cliente volta para <strong>Pré-cadastro</strong> e o motivo fica
                      registrado no convite. Em seguida você poderá gerar um novo link.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={processandoRecusa || !motivoRecusa.trim()}
                        onClick={onRecusar}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
                      >
                        {processandoRecusa ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Recusando...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Confirmar recusa
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processandoRecusa}
                        onClick={onCancelarRecusaClick}
                        className="text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {!confirmandoAprovacao && !modoRecusa && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onModoRecusaClick}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs gap-1.5"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Recusar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={onConfirmarAprovacaoClick}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprovar e gravar
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ModalPadrao>
  )
}
