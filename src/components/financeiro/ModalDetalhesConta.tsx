import React, { useState } from 'react'
import { ContaRecord } from '@/types'
import { financeiroService } from '@/services/financeiro'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ModalDetalhesContratoServico } from '@/components/contratosServico/ModalDetalhesContratoServico'
import { useAuth } from '@/contexts/AuthContext'
import {
  CheckCircle2,
  Send,
  UploadCloud,
  XCircle,
  FileText,
  AlertTriangle,
  Loader2,
  Download,
  ShieldAlert,
  FileCheck,
} from 'lucide-react'

interface ModalDetalhesContaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: ContaRecord | null
  canManage: boolean
  onSuccess: () => void
}

export function ModalDetalhesConta({
  open,
  onOpenChange,
  conta,
  canManage,
  onSuccess,
}: ModalDetalhesContaProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  // Sub-fluxos
  const [modo, setModo] = useState<'ver' | 'baixar' | 'cancelar' | 'enviar'>('ver')

  // Form Baixar
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().substring(0, 10))
  const [formaLiquidacao, setFormaLiquidacao] = useState('Pix')
  const [arquivoComprovante, setArquivoComprovante] = useState<File | null>(null)

  // Form Cancelar
  const [motivoCancelamento, setMotivoCancelamento] = useState('')

  // Form Enviar Remessa
  const [notaFiscalRemessa, setNotaFiscalRemessa] = useState('')
  const [showModalContrato, setShowModalContrato] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  React.useEffect(() => {
    if (conta) {
      setModo('ver')
      setDataPagamento(new Date().toISOString().substring(0, 10))
      setFormaLiquidacao(conta.forma_pagamento || 'Pix')
      setMotivoCancelamento('')
      setNotaFiscalRemessa(conta.nf || '')
      setArquivoComprovante(null)
    }
  }, [conta, open])

  if (!conta) return null

  // Aprovar rascunho
  const handleAprovar = async () => {
    setSalvando(true)
    try {
      await financeiroService.aprovarConta(conta.id)
      toast({
        title: 'Conta aprovada com sucesso!',
        description: 'Status alterado para Aprovada no fluxo financeiro.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar',
        description: err.message || 'Falha no servidor',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Enviar remessa de cobrança
  const handleEnviarCobranca = async () => {
    setSalvando(true)
    try {
      await financeiroService.enviarCobranca(conta.id, notaFiscalRemessa)
      toast({
        title: 'Remessa enviada!',
        description: 'Cobrança enviada ao parceiro demandante com sucesso.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar cobrança',
        description: err.message || 'Falha no servidor',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Baixa / Liquidação com comprovante
  const handleConfirmarBaixa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!arquivoComprovante) {
      toast({
        title: 'Comprovante obrigatório',
        description:
          'O servidor bloqueia baixa de conta sem o anexo do comprovante de pagamento/recebimento.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await financeiroService.baixarConta(conta.id, {
        data_pagamento: dataPagamento,
        forma_pagamento: formaLiquidacao,
        comprovante: arquivoComprovante,
      })
      toast({
        title: conta.tipo === 'receber' ? 'Recebimento baixado!' : 'Pagamento baixado!',
        description: 'Conta liquidada e comprovante anexado com auditoria imutável.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao liquidar conta',
        description: err.message || 'Falha ao baixar conta no servidor.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Cancelar com motivo
  const handleConfirmarCancelamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivoCancelamento.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe a justificativa/motivo do cancelamento.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await financeiroService.cancelarConta(conta.id, motivoCancelamento)
      toast({
        title: 'Conta cancelada com sucesso',
        description: 'Motivo registrado e ação auditada no sistema.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar conta',
        description: err.message || 'Falha ao salvar cancelamento.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const comprovanteUrl = conta.anexo_comprovante
    ? pb.files.getURL(conta, conta.anexo_comprovante)
    : null

  const isContaPaga = conta.status === 'paga' || conta.status === 'realizada'
  const isContaCancelada = conta.status === 'cancelada'
  const isContaRascunho = conta.status === 'rascunho'
  const isContaAprovada = conta.status === 'aprovada'
  const isContaEnviada = conta.status === 'enviada'
  const isContaAtrasada = conta.status === 'atrasada'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{conta.tipo === 'receber' ? 'Conta a Receber' : 'Conta a Pagar'}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase ${
                    isContaPaga
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : isContaAtrasada
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : isContaCancelada
                          ? 'bg-slate-100 text-slate-500 border-slate-300'
                          : isContaEnviada
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : isContaAprovada
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                  }`}
                >
                  {conta.status}
                </Badge>
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* MODO PRINCIPAL: VISUALIZAÇÃO E RESUMO */}
          {modo === 'ver' && (
            <div className="space-y-4 pt-1">
              {conta.bloqueada_por_fechamento && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Conta Bloqueada por Fechamento:</strong> Este projeto possui pendência
                    de fechamento contábil e as movimentações foram restringidas pelo servidor.
                  </div>
                </div>
              )}

              {isContaAtrasada && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Atenção:</strong> Vencimento ultrapassado em{' '}
                    {formatDateBr(conta.vencimento)}. Aguarda liquidação.
                  </span>
                </div>
              )}

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-xs text-slate-500 uppercase font-semibold">Descrição</span>
                <h4 className="text-sm font-bold text-slate-900">{conta.descricao}</h4>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">Valor Bruto:</span>
                    <span className="text-base font-bold text-slate-900">
                      {formatCurrencyBr(conta.valor)}
                    </span>
                  </div>

                  {conta.retencao_impostos ? (
                    <div>
                      <span className="text-slate-500 block">Valor Líquido:</span>
                      <span className="text-base font-bold text-emerald-700">
                        {formatCurrencyBr(
                          conta.valor_liquido || conta.valor - conta.retencao_impostos,
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Retenção: -{formatCurrencyBr(conta.retencao_impostos)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-500 block">Forma Prevista:</span>
                      <span className="font-medium text-slate-800">
                        {conta.forma_pagamento || 'Boleto'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadados e Vínculos */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Vencimento:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {conta.vencimento ? formatDateBr(conta.vencimento) : 'A definir'}
                  </span>
                </div>

                {conta.data_pagamento && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Data de Liquidação:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {formatDateBr(conta.data_pagamento)}
                    </span>
                  </div>
                )}

                {conta.nf && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Nota Fiscal / Doc:</span>
                    <span className="font-medium text-slate-800">{conta.nf}</span>
                  </div>
                )}

                {conta.expand?.projeto && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Projeto Vinculado:</span>
                    <span className="font-medium text-slate-800">
                      {conta.expand.projeto.codigo} - {conta.expand.projeto.nome}
                    </span>
                  </div>
                )}

                {(conta.contrato_servico || conta.expand?.contrato_servico) && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Contrato de Serviços:</span>
                    <button
                      type="button"
                      onClick={() => setShowModalContrato(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#1E2A4A] text-white hover:bg-[#D95A2B] transition-colors cursor-pointer"
                      title="Clique para ver os detalhes do Contrato de Serviços"
                    >
                      <FileCheck className="w-3 h-3 text-[#D95A2B]" />
                      <span>
                        {conta.expand?.contrato_servico?.numero ||
                          `CTR (${conta.contrato_servico})`}
                      </span>
                    </button>
                  </div>
                )}

                {conta.expand?.executor && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Executor / Fornecedor:</span>
                    <span className="font-medium text-slate-800">
                      {conta.expand.executor.nome} ({conta.expand.executor.cpf_cnpj})
                    </span>
                  </div>
                )}

                {conta.medicao_aprovada_origem && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Origem da Medição:</span>
                    <span className="font-medium text-indigo-700">
                      Boletim {conta.medicao_aprovada_origem}
                    </span>
                  </div>
                )}

                {conta.motivo_cancelamento && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-900 mt-2">
                    <span className="font-bold block mb-0.5">Motivo do Cancelamento:</span>
                    <p>{conta.motivo_cancelamento}</p>
                  </div>
                )}

                {comprovanteUrl && (
                  <div className="pt-2">
                    <a
                      href={comprovanteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Visualizar Comprovante de Pagamento
                    </a>
                  </div>
                )}
              </div>

              {/* Ações disponíveis de acordo com o status e perfil */}
              {canManage && !isContaCancelada && (
                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-2 justify-end">
                  {isContaRascunho && (
                    <Button
                      size="sm"
                      onClick={handleAprovar}
                      disabled={salvando}
                      className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aprovar Conta
                    </Button>
                  )}

                  {conta.tipo === 'receber' && (isContaAprovada || isContaRascunho) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModo('enviar')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Enviar Cobrança
                    </Button>
                  )}

                  {!isContaPaga && (
                    <Button
                      size="sm"
                      onClick={() => setModo('baixar')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5 mr-1" />
                      {conta.tipo === 'receber' ? 'Registrar Recebimento' : 'Dar Baixa / Pagamento'}
                    </Button>
                  )}

                  {!isContaPaga && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setModo('cancelar')}
                      className="text-slate-500 hover:text-rose-600 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Cancelar Conta
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODO SUB-FLUXO: BAIXAR CONTA COM COMPROVANTE */}
          {modo === 'baixar' && (
            <form onSubmit={handleConfirmarBaixa} className="space-y-3 pt-1">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <span className="font-bold block mb-1">
                  Liquidação Financeira Obrigatória (Servidor):
                </span>
                Para dar baixa em uma conta a receber ou a pagar, o comprovante de transferência/pix
                ou recibo autenticado é estritamente obrigatório para auditoria imutável.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dtPag">Data Efetiva da Liquidação *</Label>
                  <Input
                    id="dtPag"
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="formaLiq">Forma de Liquidação</Label>
                  <Input
                    id="formaLiq"
                    value={formaLiquidacao}
                    onChange={(e) => setFormaLiquidacao(e.target.value)}
                    placeholder="Ex: PIX, Transferência, Boleto..."
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="compFile">Arquivo do Comprovante (PDF ou Imagem) *</Label>
                <Input
                  id="compFile"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => setArquivoComprovante(e.target.files?.[0] || null)}
                  className="mt-1 cursor-pointer"
                  required
                />
                <span className="text-[11px] text-slate-400">
                  Tamanho máximo 10MB. O arquivo será anexado permanentemente à conta.
                </span>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Baixa com Comprovante
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* MODO SUB-FLUXO: CANCELAR CONTA */}
          {modo === 'cancelar' && (
            <form onSubmit={handleConfirmarCancelamento} className="space-y-3 pt-1">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                <span className="font-bold block mb-1">Atenção ao Cancelamento:</span>
                O cancelamento remove a conta dos saldos projetados e exige justificativa auditada.
              </div>

              <div>
                <Label htmlFor="motivoCancel">Motivo do Cancelamento *</Label>
                <Textarea
                  id="motivoCancel"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Informe detalhadamente por que este lançamento está sendo cancelado..."
                  rows={3}
                  className="mt-1"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button type="submit" disabled={salvando} variant="destructive">
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Cancelamento
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* MODO SUB-FLUXO: ENVIAR REMESSA DE COBRANÇA */}
          {modo === 'enviar' && (
            <div className="space-y-3 pt-1">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <span className="font-bold block mb-1">Remessa de Cobrança:</span>
                Marcar a conta como <strong>Enviada</strong> para o cliente/parceiro demandante e
                vincular a Nota Fiscal correspondente.
              </div>

              <div>
                <Label htmlFor="nfRemessa">Número da Nota Fiscal (NFS-e / NF-e)</Label>
                <Input
                  id="nfRemessa"
                  value={notaFiscalRemessa}
                  onChange={(e) => setNotaFiscalRemessa(e.target.value)}
                  placeholder="Ex: NFS-e 2026/890"
                  className="mt-1"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button
                  onClick={handleEnviarCobranca}
                  disabled={salvando}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Envio da Cobrança
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showModalContrato && (conta.contrato_servico || conta.expand?.contrato_servico?.id) && (
        <ModalDetalhesContratoServico
          open={showModalContrato}
          onOpenChange={setShowModalContrato}
          contratoId={conta.contrato_servico || conta.expand!.contrato_servico!.id}
          isAdmin={isAdmin}
        />
      )}
    </>
  )
}
