import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus,
  Trash2,
  Calculator,
  ShieldAlert,
  ShieldCheck,
  Check,
  FileText,
  Building2,
  UserCheck,
  Sparkles,
} from 'lucide-react'
import {
  PropostaRecord,
  PropostaItemRecord,
  EmpresaRecord,
  ClientePfRecord,
  ContratoRecord,
  ModeloRecord,
  CatalogoServicoRecord,
  AreaAtuacaoRecord,
  SubservicoRecord,
  EntregavelPadraoRecord,
} from '@/types'
import { propostasService } from '@/services/propostas'
import { catalogoServicosService } from '@/services/catalogoServicos'
import { empresasService } from '@/services/empresas'
import { clientesPfService } from '@/services/clientesPf'
import { contratosService } from '@/services/contratos'
import { modelosService } from '@/services/modelos'
import { parametrosService } from '@/services/parametros'
import {
  areasAtuacaoService,
  subservicosService,
  entregaveisPadraoService,
} from '@/services/areasAtuacao'
import { ClienteAutocomplete } from './ClienteAutocomplete'
import { ModalCadastroClienteRapido } from './ModalCadastroClienteRapido'
import { ModalItemPropostaCascata } from './ModalItemPropostaCascata'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface ModalEditorPropostaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propostaToEdit?: PropostaRecord | null
  initialEmpresaId?: string
  initialClientePfId?: string
  onSaved: (proposta: PropostaRecord) => void
  currentUserId?: string
}

export const ModalEditorProposta: React.FC<ModalEditorPropostaProps> = ({
  open,
  onOpenChange,
  propostaToEdit,
  initialEmpresaId,
  initialClientePfId,
  onSaved,
  currentUserId,
}) => {
  const { toast } = useToast()

  // Entidades relacionadas
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [clientesPf, setClientesPf] = useState<ClientePfRecord[]>([])
  const [contratos, setContratos] = useState<ContratoRecord[]>([])
  const [modelos, setModelos] = useState<ModeloRecord[]>([])
  const [catalogoServicos, setCatalogoServicos] = useState<CatalogoServicoRecord[]>([])
  const [areas, setAreas] = useState<AreaAtuacaoRecord[]>([])
  const [subservicos, setSubservicos] = useState<SubservicoRecord[]>([])
  const [entregaveisPadrao, setEntregaveisPadrao] = useState<EntregavelPadraoRecord[]>([])

  // Modais auxiliares
  const [showCadastroClienteModal, setShowCadastroClienteModal] = useState(false)
  const [showCascataModal, setShowCascataModal] = useState(false)

  // Parâmetros de Alçada e Cálculo
  const [limiteAlcadaValor, setLimiteAlcadaValor] = useState(100000)
  const [margemMinimaAlcada, setMargemMinimaAlcada] = useState(20)
  const [margemPadrao, setMargemPadrao] = useState(35)
  const [impostosPadrao, setImpostosPadrao] = useState(16.5)
  const [validadeDiasPadrao, setValidadeDiasPadrao] = useState(15)

  // Tipo de Destinatário (PJ ou PF)
  const [tipoCliente, setTipoCliente] = useState<'pj' | 'pf'>('pj')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedClientePfId, setSelectedClientePfId] = useState<string>('')
  const [selectedContratoId, setSelectedContratoId] = useState<string>('')
  const [selectedModeloId, setSelectedModeloId] = useState<string>('')

  // Campos da Proposta
  const [escopo, setEscopo] = useState('')
  const [disciplinas, setDisciplinas] = useState('')
  const [entregaveis, setEntregaveis] = useState('')
  const [prazo, setPrazo] = useState('30 dias corridos')
  const [condicoesPagamento, setCondicoesPagamento] = useState(
    '30% entrada, 40% na entrega parcial, 30% na aprovação final',
  )
  const [validadeData, setValidadeData] = useState('')
  const [premissas, setPremissas] = useState(
    'Disponibilização de acesso às instalações e documentação técnica existente.',
  )
  const [exclusoes, setExclusoes] = useState(
    'Taxas de licenciamento e aprovações em órgãos públicos municipais ou estaduais.',
  )

  // Itens de Serviço
  const [itens, setItens] = useState<PropostaItemRecord[]>([])
  const [margemPercent, setMargemPercent] = useState<number>(35)
  const [impostosPercent, setImpostosPercent] = useState<number>(16.5)

  // Alçada calculada
  const [alcadaInfo, setAlcadaInfo] = useState<{ requerAdmin: boolean; motivoAlcada: string }>({
    requerAdmin: false,
    motivoAlcada: '',
  })

  const [saving, setSaving] = useState(false)

  // Carregar dados auxiliares ao abrir modal
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      try {
        const [
          empData,
          pfData,
          cataData,
          modData,
          areasData,
          subsData,
          entsData,
          paramValidade,
          paramLim,
          paramMargem,
          paramImp,
        ] = await Promise.all([
          empresasService.list({ status: 'ativa' }),
          clientesPfService.list(),
          catalogoServicosService.listAtivos(),
          modelosService.list(),
          areasAtuacaoService.listAtivas(),
          subservicosService.listAtivos(),
          entregaveisPadraoService.listAtivos(),
          parametrosService.get('proposta_validade_dias', '15'),
          parametrosService.get('proposta_alcada_limite_valor', '100000'),
          parametrosService.get('proposta_alcada_margem_minima', '20'),
          parametrosService.get('proposta_impostos_padrao', '16.5'),
        ])

        setEmpresas(empData)
        setClientesPf(pfData)
        setCatalogoServicos(cataData)
        setModelos(modData)
        setAreas(areasData)
        setSubservicos(subsData)
        setEntregaveisPadrao(entsData)

        const valDias = parseInt(paramValidade, 10) || 15
        setValidadeDiasPadrao(valDias)
        setLimiteAlcadaValor(parseFloat(paramLim) || 100000)
        setMargemMinimaAlcada(parseFloat(paramMargem) || 20)
        setImpostosPadrao(parseFloat(paramImp) || 16.5)

        // Inicializar com base na proposta existente ou nova
        if (propostaToEdit) {
          if (propostaToEdit.cliente_pf) {
            setTipoCliente('pf')
            setSelectedClientePfId(propostaToEdit.cliente_pf)
          } else {
            setTipoCliente('pj')
            setSelectedEmpresaId(propostaToEdit.empresa || '')
            if (propostaToEdit.empresa) {
              loadContratosEmpresa(propostaToEdit.empresa)
            }
          }

          setSelectedContratoId(propostaToEdit.contrato || '')
          setSelectedModeloId(propostaToEdit.modelo || '')
          setEscopo(propostaToEdit.escopo || '')
          setDisciplinas(propostaToEdit.disciplinas || '')
          setEntregaveis(propostaToEdit.entregaveis || '')
          setPrazo(propostaToEdit.prazo || '30 dias corridos')
          setCondicoesPagamento(propostaToEdit.condicoes_pagamento || '')
          setPremissas(propostaToEdit.premissas || '')
          setExclusoes(propostaToEdit.exclusoes || '')

          if (propostaToEdit.validade) {
            setValidadeData(propostaToEdit.validade.substring(0, 10))
          }

          setItens(propostaToEdit.itens_json || [])
          setMargemPercent(propostaToEdit.margem ?? 35)
          setImpostosPercent(propostaToEdit.impostos ?? 16.5)
        } else {
          // Nova proposta
          const hoje = new Date()
          hoje.setDate(hoje.getDate() + valDias)
          setValidadeData(hoje.toISOString().substring(0, 10))

          if (initialClientePfId) {
            setTipoCliente('pf')
            setSelectedClientePfId(initialClientePfId)
          } else if (initialEmpresaId) {
            setTipoCliente('pj')
            setSelectedEmpresaId(initialEmpresaId)
            loadContratosEmpresa(initialEmpresaId)
          }

          // Se tiver item no catálogo, adicionar um item inicial de exemplo
          if (cataData.length > 0 && itens.length === 0) {
            const primeiro = cataData[0]
            setItens([
              {
                servico: primeiro.id,
                descricao: primeiro.nome,
                disciplina: primeiro.disciplina,
                unidade: primeiro.unidade,
                quantidade: 1,
                custo_unitario: primeiro.preco_base,
                custo_total: primeiro.preco_base,
              },
            ])
            setDisciplinas(primeiro.disciplina)
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar editor de proposta:', err)
      }
    }

    loadData()
  }, [open, propostaToEdit, initialEmpresaId, initialClientePfId])

  const loadContratosEmpresa = async (empresaId: string) => {
    try {
      const data = await contratosService.listByEmpresa(empresaId)
      setContratos(data)
      if (data.length > 0 && !selectedContratoId) {
        setSelectedContratoId(data[0].id)
      }
    } catch (err) {
      console.warn('Erro ao carregar contratos da empresa:', err)
    }
  }

  // Troca de Empresa
  const handleEmpresaChange = (empId: string) => {
    setSelectedEmpresaId(empId)
    loadContratosEmpresa(empId)
  }

  // Adicionar item do catálogo
  const handleAddItem = (servicoId?: string) => {
    if (servicoId) {
      const servico = catalogoServicos.find((s) => s.id === servicoId)
      if (servico) {
        const novoItem: PropostaItemRecord = {
          servico: servico.id,
          descricao: servico.nome,
          disciplina: servico.disciplina,
          unidade: servico.unidade,
          quantidade: 1,
          custo_unitario: servico.preco_base,
          custo_total: servico.preco_base,
        }
        setItens([...itens, novoItem])
        return
      }
    }

    // Item avulso
    const novoItemAvulso: PropostaItemRecord = {
      descricao: 'Serviço Técnico Especializado',
      disciplina: 'Engenharia Geral',
      unidade: 'un',
      quantidade: 1,
      custo_unitario: 5000,
      custo_total: 5000,
    }
    setItens([...itens, novoItemAvulso])
  }

  const handleUpdateItem = (index: number, field: keyof PropostaItemRecord, value: any) => {
    const updated = [...itens]
    const item = { ...updated[index], [field]: value }

    if (field === 'quantidade' || field === 'custo_unitario') {
      const q = field === 'quantidade' ? parseFloat(value) || 0 : item.quantidade
      const c = field === 'custo_unitario' ? parseFloat(value) || 0 : item.custo_unitario
      item.custo_total = Math.round(q * c * 100) / 100
    }

    updated[index] = item
    setItens(updated)
  }

  const handleRemoveItem = (index: number) => {
    const updated = itens.filter((_, i) => i !== index)
    setItens(updated)
  }

  // Preenchimento com Modelo
  const handleAplicarModelo = (modeloId: string) => {
    setSelectedModeloId(modeloId)
    const modelo = modelos.find((m) => m.id === modeloId)
    if (!modelo) return

    let nomeCliente = ''
    let orgaoContrato = ''
    let valorContratoStr = ''

    if (tipoCliente === 'pj') {
      const emp = empresas.find((e) => e.id === selectedEmpresaId)
      if (emp) nomeCliente = emp.razao_social
      const cont = contratos.find((c) => c.id === selectedContratoId)
      if (cont) {
        orgaoContrato = cont.orgao
        valorContratoStr = formatCurrencyBr(cont.valor)
      }
    } else {
      const pf = clientesPf.find((c) => c.id === selectedClientePfId)
      if (pf) nomeCliente = pf.nome
    }

    const textoComVariaveis = propostasService.substituirVariaveisModelo(modelo.corpo, {
      nome: nomeCliente,
      orgao: orgaoContrato,
      valor_contrato: valorContratoStr,
      prazo: prazo,
      disciplinas: disciplinas,
    })

    setEscopo(textoComVariaveis)

    toast({
      title: 'Modelo Aplicado',
      description: `Variáveis preenchidas automaticamente a partir de "${modelo.nome}".`,
    })
  }

  // Totais calculados
  const custoTotalItens = itens.reduce((acc, curr) => acc + (curr.custo_total || 0), 0)
  const totais = propostasService.calcularTotais(custoTotalItens, margemPercent, impostosPercent)

  // Reavaliação de alçada
  useEffect(() => {
    const aval = propostasService.avaliarAlcada(
      totais.precoTotal,
      margemPercent,
      limiteAlcadaValor,
      margemMinimaAlcada,
    )
    setAlcadaInfo(aval)
  }, [totais.precoTotal, margemPercent, limiteAlcadaValor, margemMinimaAlcada])

  // Salvar Proposta
  const handleSave = async (enviarParaAprovacao: boolean = false) => {
    if (tipoCliente === 'pj' && !selectedEmpresaId) {
      toast({
        variant: 'destructive',
        title: 'Empresa obrigatória',
        description: 'Selecione a empresa contratante.',
      })
      return
    }
    if (tipoCliente === 'pf' && !selectedClientePfId) {
      toast({
        variant: 'destructive',
        title: 'Cliente PF obrigatório',
        description: 'Selecione o cliente PF contratante.',
      })
      return
    }
    if (!escopo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Escopo obrigatório',
        description: 'Descreva o escopo técnico da proposta.',
      })
      return
    }
    if (itens.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Itens obrigatórios',
        description: 'Adicione ao menos um item de serviço à proposta.',
      })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        empresa: tipoCliente === 'pj' ? selectedEmpresaId : undefined,
        cliente_pf: tipoCliente === 'pf' ? selectedClientePfId : undefined,
        contrato: tipoCliente === 'pj' ? selectedContratoId || undefined : undefined,
        modelo: selectedModeloId || undefined,
        escopo,
        disciplinas:
          disciplinas ||
          itens
            .map((i) => i.disciplina)
            .filter(Boolean)
            .join(', '),
        entregaveis,
        prazo,
        condicoes_pagamento: condicoesPagamento,
        validade: validadeData
          ? new Date(validadeData + 'T23:59:59.000Z').toISOString()
          : undefined,
        premissas,
        exclusoes,
        custo: totais.custo,
        margem: margemPercent,
        impostos: impostosPercent,
        preco: totais.precoTotal,
        requer_aprovacao_admin: alcadaInfo.requerAdmin,
        itens_json: itens,
      }

      if (enviarParaAprovacao) {
        payload.status = 'aprovacao_interna'
      }

      let res: PropostaRecord
      if (propostaToEdit) {
        res = await propostasService.update(propostaToEdit.id, payload)
        toast({
          title: 'Proposta Atualizada',
          description: `Proposta ${res.numero} atualizada com sucesso.`,
        })
      } else {
        payload.criado_por = currentUserId
        payload.status = enviarParaAprovacao ? 'aprovacao_interna' : 'rascunho'
        res = await propostasService.create(payload)

        // Se tiver empresa vinculada, mover empresa no funil para "Com proposta elaborada" (Req. G)
        if (selectedEmpresaId) {
          try {
            await empresasService.update(selectedEmpresaId, {
              etapa_funil: 'com_proposta_elaborada',
              proxima_acao_desc: `Elaborada proposta técnica ${res.numero || 'comercial'} no valor de ${formatCurrencyBr(totais.precoTotal)}`,
            })
          } catch (err) {
            console.warn('Erro ao atualizar etapa do funil da empresa:', err)
          }
        }

        toast({
          title: 'Proposta Elaborada',
          description: `Proposta gerada com numeração automática no servidor e vinculada ao funil.`,
        })
      }

      onSaved(res)
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao salvar proposta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a proposta. Verifique os dados.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {propostaToEdit
                    ? `Editar Proposta ${propostaToEdit.numero} (${propostaToEdit.revisao || 'Rev.00'})`
                    : 'Elaborar Nova Proposta de Engenharia'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Numeração sequencial anual PROP-AAAA-NNNN gerada no servidor, cálculo BDI e
                  validação de alçada de aprovação.
                </DialogDescription>
              </div>
              {propostaToEdit && (
                <Badge variant="outline" className="font-mono text-xs">
                  {propostaToEdit.numero} - {propostaToEdit.revisao || 'Rev.00'}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-2 text-xs">
            {/* 1. SELEÇÃO DE CLIENTE COM AUTOCOMPLETE DINÂMICO E CADASTRO RÁPIDO SEM PERDA */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  1. Destinatário e Contrato (Busca Dinâmica PF/PJ)
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={tipoCliente === 'pj' ? 'default' : 'outline'}
                    onClick={() => setTipoCliente('pj')}
                    className={`h-7 text-xs ${
                      tipoCliente === 'pj' ? 'bg-orange-600 hover:bg-orange-700' : ''
                    }`}
                  >
                    Pessoa Jurídica (PJ)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tipoCliente === 'pf' ? 'default' : 'outline'}
                    onClick={() => setTipoCliente('pf')}
                    className={`h-7 text-xs ${
                      tipoCliente === 'pf' ? 'bg-orange-600 hover:bg-orange-700' : ''
                    }`}
                  >
                    Cliente PF
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ClienteAutocomplete
                  tipo={tipoCliente}
                  empresas={empresas}
                  clientesPf={clientesPf}
                  selectedEmpresaId={selectedEmpresaId}
                  selectedClientePfId={selectedClientePfId}
                  onSelectEmpresa={handleEmpresaChange}
                  onSelectClientePf={setSelectedClientePfId}
                  onOpenNovoClienteModal={() => setShowCadastroClienteModal(true)}
                />

                {tipoCliente === 'pj' ? (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      Contrato Público Vinculado
                    </Label>
                    <Select
                      value={selectedContratoId}
                      onValueChange={setSelectedContratoId}
                      disabled={contratos.length === 0}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue
                          placeholder={
                            contratos.length > 0
                              ? 'Selecione o contrato...'
                              : selectedEmpresaId
                                ? 'Nenhum contrato ativo cadastrado para a empresa'
                                : 'Selecione a empresa acima primeiro'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {contratos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.numero} - {c.orgao} ({formatCurrencyBr(c.valor)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1 flex flex-col justify-end">
                    <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200">
                      <strong className="text-slate-800 block mb-0.5">Regra LGPD:</strong>
                      Cliente PF cadastrado com consentimento explícito arquivado no sistema para
                      orçamentos e projetos.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. ITENS DE SERVIÇO E CÁLCULO DE PREÇO */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    2. Itens do Catálogo e Planilha de Preço
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Preço = Custo dos itens + Margem ({margemPercent}%) + Impostos (
                    {impostosPercent}
                    %)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowCascataModal(true)}
                    className="h-8 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />+ Inserir por Área & Catálogo
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddItem()}
                    className="h-8 text-xs gap-1"
                  >
                    Item Avulso
                  </Button>
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="py-2 px-3">Descrição do Serviço & Especialidades</th>
                      <th className="py-2 px-3 w-28">Disciplina</th>
                      <th className="py-2 px-2 w-16">Unid.</th>
                      <th className="py-2 px-2 w-20 text-center">Qtd.</th>
                      <th className="py-2 px-3 w-28 text-right">Custo Unit. (R$)</th>
                      <th className="py-2 px-3 w-28 text-right">Custo Total</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itens.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          Nenhum item adicionado à proposta. Clique em &quot;+ Inserir por Área
                          &amp; Catálogo&quot; acima.
                        </td>
                      </tr>
                    ) : (
                      itens.map((it, idx) => {
                        const areaObj = areas.find((a) => a.id === it.area)
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 space-y-1">
                              <Input
                                value={it.descricao}
                                onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                                className="h-7 text-xs"
                              />
                              {(areaObj || (it.subservicos && it.subservicos.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {areaObj && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-orange-50 border-orange-200 text-orange-800"
                                    >
                                      {areaObj.nome}
                                    </Badge>
                                  )}
                                  {it.subservicos?.map((s, sIdx) => (
                                    <Badge key={sIdx} variant="secondary" className="text-[10px]">
                                      {s}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                value={it.disciplina || ''}
                                onChange={(e) =>
                                  handleUpdateItem(idx, 'disciplina', e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                value={it.unidade || 'un'}
                                onChange={(e) => handleUpdateItem(idx, 'unidade', e.target.value)}
                                className="h-7 text-xs text-center"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={it.quantidade}
                                onChange={(e) =>
                                  handleUpdateItem(idx, 'quantidade', e.target.value)
                                }
                                className="h-7 text-xs text-center font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.custo_unitario}
                                onChange={(e) =>
                                  handleUpdateItem(idx, 'custo_unitario', e.target.value)
                                }
                                className="h-7 text-xs text-right font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                              {formatCurrencyBr(it.custo_total)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(idx)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Configuração de Margem e Impostos */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Custo Direto Base
                  </Label>
                  <div className="text-base font-bold font-mono text-slate-800">
                    {formatCurrencyBr(totais.custo)}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Margem de Lucro (%):
                  </Label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={margemPercent}
                      onChange={(e) => setMargemPercent(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono w-24"
                    />
                    <span className="text-[11px] font-mono text-slate-600">
                      +{formatCurrencyBr(totais.valorMargem)}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Impostos / Tributos (%):
                  </Label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={impostosPercent}
                      onChange={(e) => setImpostosPercent(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono w-24"
                    />
                    <span className="text-[11px] font-mono text-slate-600">
                      +{formatCurrencyBr(totais.valorImpostos)}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/80 p-2.5 rounded border border-emerald-200">
                  <Label className="text-[11px] font-semibold text-emerald-800">
                    Preço Total da Proposta
                  </Label>
                  <div className="text-lg font-bold font-mono text-emerald-700">
                    {formatCurrencyBr(totais.precoTotal)}
                  </div>
                </div>
              </div>

              {/* ALÇADA DE APROVAÇÃO */}
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                  alcadaInfo.requerAdmin
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                {alcadaInfo.requerAdmin ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold">
                    {alcadaInfo.requerAdmin
                      ? 'Requer Aprovação de Alçada (Administrador + Parecer Financeiro)'
                      : 'Aprovação Autônoma do Comercial'}
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90">{alcadaInfo.motivoAlcada}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Regra parametrizada: Limite até {formatCurrencyBr(limiteAlcadaValor)} e Margem
                    mínima de {margemMinimaAlcada}%. Acima disso exige validação da Diretoria/Admin.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. MODELOS E CONTEÚDO TÉCNICO */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  3. Modelo de Texto e Especificações Técnicas
                </span>

                <div className="flex items-center gap-2">
                  <Select value={selectedModeloId} onValueChange={handleAplicarModelo}>
                    <SelectTrigger className="h-8 text-xs w-[240px]">
                      <SelectValue placeholder="Aplicar Modelo Padrão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Escopo Técnico dos Serviços *</Label>
                <Textarea
                  rows={4}
                  value={escopo}
                  onChange={(e) => setEscopo(e.target.value)}
                  placeholder="Detalhamento das atividades, metodologias e escopo a ser entregue..."
                  className="text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Disciplinas Envolvidas</Label>
                  <Input
                    value={disciplinas}
                    onChange={(e) => setDisciplinas(e.target.value)}
                    placeholder="Ex: Arquitetura, Estruturas, Instalações Prediais, BIM"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Entregáveis Previstos</Label>
                  <Input
                    value={entregaveis}
                    onChange={(e) => setEntregaveis(e.target.value)}
                    placeholder="Ex: Memoriais, pranchas em DWG/PDF, modelo IFC e ART"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Prazo de Execução</Label>
                  <Input
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    placeholder="Ex: 45 dias corridos"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Condições de Pagamento</Label>
                  <Input
                    value={condicoesPagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    placeholder="Ex: 30% entrada + 70% na entrega"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Validade da Proposta (Data Limite)</Label>
                  <Input
                    type="date"
                    value={validadeData}
                    onChange={(e) => setValidadeData(e.target.value)}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Premissas e Requisitos</Label>
                  <Textarea
                    rows={2}
                    value={premissas}
                    onChange={(e) => setPremissas(e.target.value)}
                    placeholder="Condições técnicas prévias para início dos serviços..."
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Exclusões</Label>
                  <Textarea
                    rows={2}
                    value={exclusoes}
                    onChange={(e) => setExclusoes(e.target.value)}
                    placeholder="Serviços ou taxas não contemplados nesta proposta..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="text-slate-700"
              >
                Salvar como Rascunho
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salvar e Enviar para Aprovação Interna
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CADASTRO RÁPIDO CLIENTE (PF OU PJ) SEM PERDER O FORMULÁRIO */}
      <ModalCadastroClienteRapido
        open={showCadastroClienteModal}
        onOpenChange={setShowCadastroClienteModal}
        tipo={tipoCliente}
        onClienteCadastrado={async (novo) => {
          if (novo.tipo === 'pj') {
            const empList = await empresasService.list({ status: 'ativa' })
            setEmpresas(empList)
            setSelectedEmpresaId(novo.id)
            loadContratosEmpresa(novo.id)
          } else {
            const pfList = await clientesPfService.list()
            setClientesPf(pfList)
            setSelectedClientePfId(novo.id)
          }
        }}
      />

      {/* MODAL CASCATA ÁREA -> SERVIÇO -> SUBSERVIÇOS -> ENTREGÁVEIS */}
      <ModalItemPropostaCascata
        open={showCascataModal}
        onOpenChange={setShowCascataModal}
        areas={areas}
        subservicos={subservicos}
        entregaveisPadrao={entregaveisPadrao}
        catalogoServicos={catalogoServicos}
        onItemConfirmado={(novoItem, entsSugeridos) => {
          setItens([...itens, novoItem])
          if (novoItem.disciplina && !disciplinas.includes(novoItem.disciplina)) {
            setDisciplinas(
              disciplinas ? `${disciplinas}, ${novoItem.disciplina}` : novoItem.disciplina,
            )
          }
          if (entsSugeridos.length > 0) {
            const entsAtuais = entregaveis
              ? entregaveis
                  .split(',')
                  .map((e) => e.trim())
                  .filter(Boolean)
              : []
            const uniao = Array.from(new Set([...entsAtuais, ...entsSugeridos]))
            setEntregaveis(uniao.join(', '))
          }
        }}
      />
    </>
  )
}
