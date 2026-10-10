import React, { useState } from 'react'
import {
  ContaRecord,
  StatusConta,
  ProjetoRecord,
  ExecutorRecord,
  ProjetoEtapaRecord,
  DocumentoRecord,
} from '@/types'
import { financeiroService, CreateContaManualData } from '@/services/financeiro'
import { contratosServicoService } from '@/services/contratosServico'
import { ContratoServicoRecord } from '@/types'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, Plus, Calculator } from 'lucide-react'

interface ModalNovaContaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipoDefault: 'receber' | 'pagar'
  projetos: ProjetoRecord[]
  executores: ExecutorRecord[]
  medicoesAprovadas: DocumentoRecord[]
  onSuccess: () => void
}

export function ModalNovaConta({
  open,
  onOpenChange,
  tipoDefault,
  projetos,
  executores,
  medicoesAprovadas,
  onSuccess,
}: ModalNovaContaProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'manual' | 'medicao'>('manual')
  const [salvando, setSalvando] = useState(false)

  // Campos Form Manual
  const [tipo, setTipo] = useState<'receber' | 'pagar'>(tipoDefault)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('Boleto Bancário')
  const [nf, setNf] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [executorId, setExecutorId] = useState('')
  const [contratoServicoId, setContratoServicoId] = useState('')
  const [contratos, setContratos] = useState<ContratoServicoRecord[]>([])

  // Campos Geração por Medição de Projeto
  const [medicaoDocId, setMedicaoDocId] = useState('')
  const [medicaoProjetoId, setMedicaoProjetoId] = useState('')
  const [medicaoEtapaId, setMedicaoEtapaId] = useState('')
  const [medicaoExecutorId, setMedicaoExecutorId] = useState('')
  const [medicaoNumero, setMedicaoNumero] = useState('')
  const [medicaoValor, setMedicaoValor] = useState('')
  const [medicaoRetencaoPerc, setMedicaoRetencaoPerc] = useState('11.5')
  const [medicaoVencimento, setMedicaoVencimento] = useState('')

  React.useEffect(() => {
    setTipo(tipoDefault)
  }, [tipoDefault, open])

  React.useEffect(() => {
    if (open) {
      contratosServicoService
        .getAll()
        .then(setContratos)
        .catch((err) => {
          console.warn('Erro ao carregar contratos de serviço:', err)
        })
    }
  }, [open])

  const contratosFiltrados = React.useMemo(() => {
    if (!projetoId) return contratos
    return contratos.filter((c) => c.projeto === projetoId)
  }, [contratos, projetoId])

  // Quando escolhe uma medição existente
  const handleSelecionarMedicao = (docId: string) => {
    setMedicaoDocId(docId)
    const doc = medicoesAprovadas.find((m) => m.id === docId)
    if (doc) {
      setMedicaoProjetoId(doc.projeto || '')
      setMedicaoEtapaId(doc.etapa || '')
      setMedicaoNumero(doc.numero || 'BM-01')
      // Se a etapa tiver executor associado
      const etapa = (doc.expand as any)?.etapa as ProjetoEtapaRecord | undefined
      if (etapa?.executor) {
        setMedicaoExecutorId(etapa.executor)
      }
    }
  }

  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a descrição da conta.',
        variant: 'destructive',
      })
      return
    }
    const val = parseFloat(valor)
    if (isNaN(val) || val <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateContaManualData = {
        tipo,
        descricao: descricao.trim(),
        valor: val,
        vencimento: vencimento || undefined,
        forma_pagamento: formaPagamento,
        nf: nf.trim() || undefined,
        projeto: projetoId || undefined,
        contrato_servico: contratoServicoId || undefined,
        executor: executorId || undefined,
        status: 'rascunho',
      }

      await financeiroService.createManual(payload)
      toast({
        title: 'Conta criada com sucesso!',
        description: `Lançamento em rascunho criado na aba ${tipo === 'receber' ? 'Contas a Receber' : 'Contas a Pagar'}.`,
      })
      onOpenChange(false)
      limparCampos()
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar conta',
        description: err.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleSalvarPorMedicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medicaoProjetoId) {
      toast({
        title: 'Projeto obrigatório',
        description: 'Selecione o projeto vinculado à medição.',
        variant: 'destructive',
      })
      return
    }
    if (!medicaoExecutorId) {
      toast({
        title: 'Executor obrigatório',
        description: 'Selecione o executor contratado para o pagamento.',
        variant: 'destructive',
      })
      return
    }
    const val = parseFloat(medicaoValor)
    if (isNaN(val) || val <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe o valor total da medição.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await financeiroService.gerarContaPorMedicao({
        projetoId: medicaoProjetoId,
        etapaId: medicaoEtapaId || undefined,
        executorId: medicaoExecutorId,
        medicaoDocumentoId: medicaoDocId || 'manual',
        numeroMedicao: medicaoNumero || 'BM-Aprovada',
        valorMedicao: val,
        percentualRetencao: parseFloat(medicaoRetencaoPerc) || 11.5,
        vencimento: medicaoVencimento || undefined,
      })

      toast({
        title: 'Conta a Pagar gerada!',
        description: 'Subcontratação vinculada à medição criada com retenção calculada.',
      })
      onOpenChange(false)
      limparCampos()
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar conta por medição',
        description: err.message || 'Falha de validação no servidor.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const limparCampos = () => {
    setDescricao('')
    setValor('')
    setVencimento('')
    setNf('')
    setProjetoId('')
    setContratoServicoId('')
    setExecutorId('')
    setMedicaoDocId('')
    setMedicaoProjetoId('')
    setMedicaoEtapaId('')
    setMedicaoExecutorId('')
    setMedicaoNumero('')
    setMedicaoValor('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Novo Lançamento Financeiro
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="pt-1">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual" className="text-xs">
              Lançamento Manual (Despesa / Recebimento)
            </TabsTrigger>
            <TabsTrigger value="medicao" className="text-xs">
              A partir de Medição (Subcontratação)
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: LANÇAMENTO MANUAL */}
          <TabsContent value="manual">
            <form onSubmit={handleSalvarManual} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Conta *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receber">Conta a Receber (Cliente/Parceiro)</SelectItem>
                      <SelectItem value="pagar">Conta a Pagar (Despesa / Fornecedor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="valor">Valor Total (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Ex: 15000.00"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="desc">Descrição do Lançamento *</Label>
                <Input
                  id="desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === 'receber'
                      ? 'Ex: Faturamento de Consultoria ou Parcela 01'
                      : 'Ex: Aluguel da sede, Folha de pagamento, Impostos...'
                  }
                  className="mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="venc">Data de Vencimento</Label>
                  <Input
                    id="venc"
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Boleto Bancário">Boleto Bancário</SelectItem>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Transferência Bancária (TED/DOC)">
                        Transferência (TED)
                      </SelectItem>
                      <SelectItem value="Cartão Corporativo">Cartão Corporativo</SelectItem>
                      <SelectItem value="Guia Tributária (DARF/DAS)">
                        Guia Tributária (DARF/DAS)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nf">Nota Fiscal / Documento Fiscal</Label>
                  <Input
                    id="nf"
                    value={nf}
                    onChange={(e) => setNf(e.target.value)}
                    placeholder="Ex: NFS-e 1024 / Guia DAS"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Projeto Vinculado (Opcional)</Label>
                  <Select
                    value={projetoId || '_none_'}
                    onValueChange={(val) => {
                      const next = val === '_none_' ? '' : val
                      setProjetoId(next)
                      if (next && contratoServicoId) {
                        const ct = contratos.find((c) => c.id === contratoServicoId)
                        if (ct && ct.projeto && ct.projeto !== next) {
                          setContratoServicoId('')
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione se aplicável..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">-- Sem vínculo com projeto --</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo} - {p.nome || 'Projeto'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Contrato de Serviços (Opcional)</Label>
                <Select
                  value={contratoServicoId || '_none_'}
                  onValueChange={(val) => setContratoServicoId(val === '_none_' ? '' : val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um contrato CTR..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">
                      -- Sem vínculo com contrato de serviço --
                    </SelectItem>
                    {contratosFiltrados.map((c) => {
                      const clienteNome =
                        c.expand?.empresa?.razao_social || c.expand?.cliente_pf?.nome || 'Cliente'
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero} - {c.objeto?.substring(0, 35)}... ({clienteNome})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {tipo === 'pagar' && (
                <div>
                  <Label>Executor / Prestador PJ (Opcional)</Label>
                  <Select value={executorId} onValueChange={setExecutorId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o executor se for subcontratação..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Despesa Interna / Outro --</SelectItem>
                      {executores.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.nome} ({ex.tipo} - {ex.cpf_cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar em Rascunho
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ABA 2: GERAR POR MEDIÇÃO APROVADA */}
          <TabsContent value="medicao">
            <form onSubmit={handleSalvarPorMedicao} className="space-y-3 pt-2">
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Calculator className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Regra de Subcontratação:</strong> Selecione a medição técnica aprovada da
                  Etapa 8 para emitir a ordem de pagamento ao executor com retenção de tributos
                  calculada.
                </div>
              </div>

              {medicoesAprovadas.length > 0 && (
                <div>
                  <Label>Boletim de Medição Registrado</Label>
                  <Select value={medicaoDocId} onValueChange={handleSelecionarMedicao}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Escolha uma medição existente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {medicoesAprovadas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.numero || 'BM'} - {m.descricao || 'Medição de Avanço'} (Projeto:{' '}
                          {(m.expand as any)?.projeto?.codigo || m.projeto})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Projeto *</Label>
                  <Select value={medicaoProjetoId} onValueChange={setMedicaoProjetoId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o projeto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo} - {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Executor Subcontratado *</Label>
                  <Select value={medicaoExecutorId} onValueChange={setMedicaoExecutorId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o executor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {executores.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.nome} ({ex.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="numMed">Identificador / Número da Medição</Label>
                  <Input
                    id="numMed"
                    value={medicaoNumero}
                    onChange={(e) => setMedicaoNumero(e.target.value)}
                    placeholder="Ex: BM-01/2026"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="valMed">Valor Bruto da Medição (R$) *</Label>
                  <Input
                    id="valMed"
                    type="number"
                    step="0.01"
                    value={medicaoValor}
                    onChange={(e) => setMedicaoValor(e.target.value)}
                    placeholder="Ex: 50000.00"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="retPerc">Retenção de Impostos Padrão (%)</Label>
                  <Input
                    id="retPerc"
                    type="number"
                    step="0.1"
                    value={medicaoRetencaoPerc}
                    onChange={(e) => setMedicaoRetencaoPerc(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="vencMed">Vencimento para Pagamento</Label>
                  <Input
                    id="vencMed"
                    type="date"
                    value={medicaoVencimento}
                    onChange={(e) => setMedicaoVencimento(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {medicaoValor && !isNaN(parseFloat(medicaoValor)) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Valor Bruto da Medição:</span>
                    <strong>{formatCurrencyBr(parseFloat(medicaoValor))}</strong>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Retenção Estimada ({medicaoRetencaoPerc}%):</span>
                    <strong>
                      -
                      {formatCurrencyBr(
                        (parseFloat(medicaoValor) * (parseFloat(medicaoRetencaoPerc) || 0)) / 100,
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold border-t border-slate-200 pt-1">
                    <span>Valor Líquido a Pagar ao Executor:</span>
                    <span>
                      {formatCurrencyBr(
                        parseFloat(medicaoValor) -
                          (parseFloat(medicaoValor) * (parseFloat(medicaoRetencaoPerc) || 0)) / 100,
                      )}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerar Conta a Pagar
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
