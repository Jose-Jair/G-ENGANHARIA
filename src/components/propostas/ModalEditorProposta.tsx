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
  Receipt,
  Info,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
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
import { auditService } from '@/services/audit'
import {
  areasAtuacaoService,
  subservicosService,
  entregaveisPadraoService,
} from '@/services/areasAtuacao'
import { ClienteAutocomplete } from './ClienteAutocomplete'
import { ModalCadastroClienteRapido } from './ModalCadastroClienteRapido'
import { ModalItemPropostaCascata } from './ModalItemPropostaCascata'
import { restoreBodyPointerEvents } from '@/lib/utils'
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
  // Decisão do usuário: nota fiscal DESLIGADA por padrão
  const [requerNota, setRequerNota] = useState<boolean>(false)

  // Alçada calculada
  const [alcadaInfo, setAlcadaInfo] = useState<{ requerAdmin: boolean; motivoAlcada: string }>({
    requerAdmin: false,
    motivoAlcada: '',
  })

  const [saving, setSaving] = useState(false)

  // Carregar dados auxiliares ao abrir modal
  useEffect(() => {
    if (!open) return
    restoreBodyPointerEvents()

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
          setRequerNota(Boolean(propostaToEdit.requer_nota))
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
                origem: 'catalogo',
                descricao: primeiro.nome,
                disciplina: primeiro.disciplina,
                unidade: primeiro.unidade,
                quantidade: 1,
                custo_unitario: 0,
                custo_total: 0,
                preco_venda_unitario: primeiro.preco_base,
                preco_total: primeiro.preco_base,
                bdi_percentual: 0,
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

  // Adicionar item do catálogo ou avulso
  const handleAddItem = (servicoId?: string) => {
    if (servicoId) {
      const servico = catalogoServicos.find((s) => s.id === servicoId)
      if (servico) {
        const novoItem: PropostaItemRecord = {
          servico: servico.id,
          origem: 'catalogo',
          descricao: servico.nome,
          disciplina: servico.disciplina,
          unidade: servico.unidade,
          quantidade: 1,
          custo_unitario: 0,
          custo_total: 0,
          preco_venda_unitario: servico.preco_base,
          preco_total: servico.preco_base,
          bdi_percentual: 0,
        }
        setItens((prev) => [...prev, novoItem])
        return
      }
    }

    // Item avulso: custo direto informado + margem BDI
    const custoAvulso = 5000
    const bdiAvulso = margemPercent || 25
    const precoAvulso = Math.round(custoAvulso * (1 + bdiAvulso / 100) * 100) / 100
    const novoItemAvulso: PropostaItemRecord = {
      origem: 'avulso',
      descricao: 'Serviço Técnico Especializado',
      disciplina: 'Engenharia Geral',
      unidade: 'un',
      quantidade: 1,
      custo_unitario: custoAvulso,
      custo_total: custoAvulso,
      bdi_percentual: bdiAvulso,
      preco_total: precoAvulso,
    }
    setItens((prev) => [...prev, novoItemAvulso])
  }

  const handleUpdateItem = (index: number, field: keyof PropostaItemRecord, value: any) => {
    const updated = [...itens]
    const item = { ...updated[index], [field]: value }

    const q = field === 'quantidade' ? parseFloat(value) || 0 : item.quantidade || 0
    const c = field === 'custo_unitario' ? parseFloat(value) || 0 : item.custo_unitario || 0
    item.custo_total = Math.round(q * c * 100) / 100

    if (item.origem === 'catalogo') {
      const pv =
        field === 'preco_venda_unitario'
          ? parseFloat(value) || 0
          : item.preco_venda_unitario !== undefined
            ? item.preco_venda_unitario
            : item.preco_total && q > 0
              ? item.preco_total / q
              : 0
      item.preco_venda_unitario = pv
      item.preco_total = Math.round(q * pv * 100) / 100
      item.bdi_percentual = 0
    } else {
      // Item avulso
      const bdi = field === 'bdi_percentual' ? parseFloat(value) || 0 : item.bdi_percentual || 0
      item.bdi_percentual = bdi
      item.preco_total = Math.round(item.custo_total * (1 + bdi / 100) * 100) / 100
    }

    updated[index] = item
    setItens(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index))
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
  // Novo modelo: cada item tem seu preço_total (catálogo = preco_base*qtd; avulso = custo* (1+bdi%))
  // Se propostas legadas não tiverem preco_total nos itens, calcular preço de venda base como custo + margem geral
  const custoTotalItens = itens.reduce((acc, curr) => acc + (curr.custo_total || 0), 0)
  const hasPrecoTotalItens = itens.length > 0 && itens.some((it) => it.preco_total !== undefined)
  const precoVendaItens = hasPrecoTotalItens
    ? itens.reduce((acc, curr) => {
        if (curr.preco_total !== undefined) return acc + curr.preco_total
        const bdi = curr.bdi_percentual ?? margemPercent ?? 0
        return acc + (curr.custo_total || 0) * (1 + bdi / 100)
      }, 0)
    : undefined

  const totais = propostasService.calcularTotais(
    custoTotalItens,
    margemPercent,
    impostosPercent,
    precoVendaItens,
    requerNota,
  )

  // Verifica se há custo direto informado para a alçada
  const temCustoInformado = custoTotalItens > 0

  // Reavaliação de alçada: usa a margem efetiva calculada. Se custo não informado, avalia por valor total
  useEffect(() => {
    const margemParaAlcada = temCustoInformado ? totais.margemEfetivaPercent : margemPercent
    const aval = propostasService.avaliarAlcada(
      totais.precoTotal,
      margemParaAlcada,
      limiteAlcadaValor,
      margemMinimaAlcada,
      temCustoInformado,
    )
    setAlcadaInfo(aval)
  }, [
    totais.precoTotal,
    totais.margemEfetivaPercent,
    margemPercent,
    limiteAlcadaValor,
    margemMinimaAlcada,
    temCustoInformado,
  ])

  // Salvar Proposta
  const handleSave = async (enviarParaAprovacao: boolean = false) => {
    // Registrar auditoria se houver alteração na exigência de nota fiscal em proposta já existente
    if (propostaToEdit && propostaToEdit.requer_nota !== requerNota) {
      try {
        await auditService.log({
          action: 'proposta.alterar_exigencia_nota',
          entity_type: 'propostas',
          entity_id: propostaToEdit.id,
          details: {
            proposta_numero: propostaToEdit.numero,
            anterior: propostaToEdit.requer_nota ?? false,
            novo: requerNota,
            motivo: requerNota
              ? 'Cliente passou a exigir nota fiscal (impostos aplicados)'
              : 'Cliente não exigirá nota fiscal (impostos desativados)',
          },
        })
      } catch (err) {
        console.warn('Erro ao registrar auditoria de alteração de nota fiscal:', err)
      }
    }
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
        margem: temCustoInformado ? totais.margemEfetivaPercent : margemPercent,
        impostos: requerNota ? impostosPercent : 0,
        requer_nota: requerNota,
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

  const isAnySubmodalOpen = showCascataModal || showCadastroClienteModal

  return (
    <>
      <Dialog
        open={open && !isAnySubmodalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            restoreBodyPointerEvents()
          }
          onOpenChange(isOpen)
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[92vh] overflow-y-auto p-6"
          onCloseAutoFocus={() => restoreBodyPointerEvents()}
        >
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
                    Valores do catálogo já incluem margem de venda. Total = Preço de venda dos itens{' '}
                    {requerNota
                      ? `+ Impostos (${impostosPercent}%)`
                      : '(sem impostos / nota desligada)'}
                    .
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowCascataModal(true)}
                    className="h-8 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />+ Inserir por Área &amp; Catálogo
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
                      <th className="py-2 px-3">Descrição do Serviço &amp; Especialidades</th>
                      <th className="py-2 px-3 w-24">Origem</th>
                      <th className="py-2 px-2 w-14 text-center">Unid.</th>
                      <th className="py-2 px-2 w-16 text-center">Qtd.</th>
                      <th className="py-2 px-2 w-24 text-right">Custo Dir.</th>
                      <th className="py-2 px-2 w-28 text-right">Preço Venda Unit.</th>
                      <th className="py-2 px-3 w-28 text-right">Preço Total</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itens.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          Nenhum item adicionado à proposta. Clique em &quot;+ Inserir por Área
                          &amp; Catálogo&quot; acima.
                        </td>
                      </tr>
                    ) : (
                      itens.map((it, idx) => {
                        const areaObj = areas.find((a) => a.id === it.area)
                        const isCat =
                          it.origem === 'catalogo' ||
                          (Boolean(it.servico) && it.origem !== 'avulso')
                        const precoUnit =
                          it.preco_venda_unitario !== undefined
                            ? it.preco_venda_unitario
                            : it.preco_total && it.quantidade > 0
                              ? it.preco_total / it.quantidade
                              : (it.custo_unitario || 0) * (1 + (it.bdi_percentual || 0) / 100)
                        const precoTotalLinha =
                          it.preco_total !== undefined
                            ? it.preco_total
                            : Math.round(
                                (it.custo_total || 0) * (1 + (it.bdi_percentual || 0) / 100) * 100,
                              ) / 100

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
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  isCat
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {isCat ? 'Catálogo' : 'Avulso'}
                              </Badge>
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
                            <td className="py-2 px-2 text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0,00"
                                value={it.custo_unitario || 0}
                                onChange={(e) =>
                                  handleUpdateItem(idx, 'custo_unitario', e.target.value)
                                }
                                className="h-7 text-xs text-right font-mono"
                                title="Custo direto unitário (opcional para cálculo de margem efetiva)"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              {isCat ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={precoUnit}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, 'preco_venda_unitario', e.target.value)
                                  }
                                  className="h-7 text-xs text-right font-mono font-medium"
                                  title="Preço de venda unitário do catálogo (já inclui margem)"
                                />
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 justify-end">
                                    <span className="text-[10px] text-slate-500">BDI:</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={it.bdi_percentual || 0}
                                      onChange={(e) =>
                                        handleUpdateItem(idx, 'bdi_percentual', e.target.value)
                                      }
                                      className="h-6 w-14 text-[11px] text-center font-mono"
                                      title="Margem de lucro / BDI do item avulso (%)"
                                    />
                                    <span className="text-[10px] text-slate-500">%</span>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatCurrencyBr(precoTotalLinha)}
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

              {/* INTERRUPTOR: CLIENTE EXIGIRÁ NOTA FISCAL? */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50 gap-3">
                <div className="flex items-start gap-2.5">
                  <Receipt
                    className={`w-5 h-5 shrink-0 mt-0.5 ${requerNota ? 'text-blue-600' : 'text-slate-400'}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="switchNotaFiscal"
                        className="text-xs font-semibold text-slate-900 cursor-pointer"
                      >
                        Cliente exigirá nota fiscal?
                      </Label>
                      <Badge variant={requerNota ? 'default' : 'secondary'} className="text-[10px]">
                        {requerNota ? 'Nota Fiscal Ativa' : 'Nota Fiscal Desligada'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {requerNota
                        ? 'Com nota ativa: os impostos/tributos serão adicionados ao preço final e destacados na proposta.'
                        : 'Cliente não exigirá nota — impostos não aplicados.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Switch
                    id="switchNotaFiscal"
                    checked={requerNota}
                    onCheckedChange={setRequerNota}
                  />
                  <Label htmlFor="switchNotaFiscal" className="text-xs font-medium cursor-pointer">
                    {requerNota ? 'Sim' : 'Não'}
                  </Label>
                </div>
              </div>

              {/* PAINEL REORGANIZADO: Custo direto, Preço de venda, Margem efetiva %, Impostos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Custo Direto Informado
                  </Label>
                  <div className="text-base font-bold font-mono text-slate-800">
                    {formatCurrencyBr(totais.custo)}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {temCustoInformado
                      ? 'Soma dos custos diretos dos itens'
                      : 'Nenhum custo informado nos itens'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Preço de Venda (sem impostos)
                  </Label>
                  <div className="text-base font-bold font-mono text-blue-900">
                    {formatCurrencyBr(totais.precoVendaSemImpostos)}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Soma dos itens de venda da proposta
                  </span>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Margem Efetiva Calculada
                  </Label>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-base font-bold font-mono ${
                        !temCustoInformado
                          ? 'text-slate-600'
                          : totais.margemEfetivaPercent >= margemMinimaAlcada
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {temCustoInformado ? `${totais.margemEfetivaPercent}%` : '—'}
                    </span>
                    {temCustoInformado && (
                      <span className="text-[11px] font-mono text-slate-500">
                        ({formatCurrencyBr(totais.margemEfetivaValor)})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {temCustoInformado
                      ? '(Preço de venda − Custo direto)'
                      : 'Sem custo informado — alçada avalia valor total'}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded border transition-colors ${
                    requerNota
                      ? 'bg-amber-50/80 border-amber-200'
                      : 'bg-slate-100/70 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Impostos / Tributos
                    </Label>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                      {requerNota ? `${impostosPercent}%` : '0%'}
                    </Badge>
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">
                    {formatCurrencyBr(totais.valorImpostos)}
                  </div>
                  {requerNota ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={impostosPercent}
                        onChange={(e) => setImpostosPercent(parseFloat(e.target.value) || 0)}
                        className="h-6 text-[11px] font-mono w-16 px-1 text-center bg-white"
                        title="Alíquota de impostos (%)"
                      />
                      <span className="text-[10px] text-slate-500">% tributos</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 block mt-1 italic">
                      Cliente não exigirá nota — impostos não aplicados
                    </span>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-emerald-50/90 p-3 rounded-lg border border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-bold text-emerald-900 block">
                      Preço Total Final da Proposta
                    </Label>
                    <span className="text-[11px] text-emerald-800">
                      {requerNota
                        ? 'Preço de venda dos itens + impostos aplicados'
                        : 'Preço de venda direto dos itens (sem impostos / nota fiscal não exigida)'}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-700">
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
        onOpenChange={(isOpen) => {
          setShowCadastroClienteModal(isOpen)
          restoreBodyPointerEvents()
        }}
        tipo={tipoCliente}
        onClienteCadastrado={async (novo) => {
          try {
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
          } finally {
            restoreBodyPointerEvents()
          }
        }}
      />

      {/* MODAL CASCATA ÁREA -> SERVIÇO -> SUBSERVIÇOS -> ENTREGÁVEIS */}
      <ModalItemPropostaCascata
        open={showCascataModal}
        onOpenChange={(isOpen) => {
          setShowCascataModal(isOpen)
          restoreBodyPointerEvents()
        }}
        areas={areas}
        subservicos={subservicos}
        entregaveisPadrao={entregaveisPadrao}
        catalogoServicos={catalogoServicos}
        onItemConfirmado={(novoItem, entsSugeridos) => {
          try {
            setItens((prev) => [...prev, novoItem])
            if (novoItem.disciplina) {
              setDisciplinas((prevDisc) => {
                if (!prevDisc) return novoItem.disciplina || ''
                if (prevDisc.includes(novoItem.disciplina!)) return prevDisc
                return `${prevDisc}, ${novoItem.disciplina}`
              })
            }
            if (entsSugeridos && entsSugeridos.length > 0) {
              setEntregaveis((prevEnt) => {
                const entsAtuais = prevEnt
                  ? prevEnt
                      .split(',')
                      .map((e) => e.trim())
                      .filter(Boolean)
                  : []
                const uniao = Array.from(new Set([...entsAtuais, ...entsSugeridos]))
                return uniao.join(', ')
              })
            }
            toast({
              title: 'Item Adicionado',
              description: `"${novoItem.descricao}" foi incluído na proposta.`,
            })
          } catch (err: any) {
            console.error('Erro ao adicionar item na proposta:', err)
            toast({
              variant: 'destructive',
              title: 'Erro ao adicionar item',
              description: err?.message || 'Falha ao atualizar lista de itens.',
            })
          } finally {
            restoreBodyPointerEvents()
          }
        }}
      />
    </>
  )
}
