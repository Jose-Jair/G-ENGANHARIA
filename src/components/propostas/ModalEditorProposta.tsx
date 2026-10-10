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
import {
  Plus,
  Trash2,
  Calculator,
  ShieldAlert,
  ShieldCheck,
  Check,
  FileText,
  Building2,
  Sparkles,
  Receipt,
  RotateCcw,
  Percent,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  PropostaRecord,
  PropostaItemRecord,
  PropostaParcelaRecord,
  EmpresaRecord,
  ClientePfRecord,
  ContratoRecord,
  ModeloRecord,
  CatalogoServicoRecord,
  AreaAtuacaoRecord,
  SubservicoRecord,
  EntregavelPadraoRecord,
} from '@/types'
import { propostasService, PropostaParcelaItemInput } from '@/services/propostas'
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
import { PainelAssistenteIa } from './PainelAssistenteIa'
import { SugestaoPropostaIa } from '@/services/assistentePropostaIa'
import { useAuth } from '@/contexts/AuthContext'
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
  const { user } = useAuth()
  const isComercialOrAdmin = user?.role === 'admin' || user?.role === 'comercial'

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

  // Textos e regras padrão GMAIS
  const [padraoPremissasGmais, setPadraoPremissasGmais] = useState('')
  const [padraoCondicoesGeraisGmais, setPadraoCondicoesGeraisGmais] = useState('')
  const [padraoNotaPrazoGmais, setPadraoNotaPrazoGmais] = useState('')
  const [padraoParcelasGmais, setPadraoParcelasGmais] = useState<PropostaParcelaItemInput[]>([])

  // Tipo de Destinatário (PJ ou PF)
  const [tipoCliente, setTipoCliente] = useState<'pj' | 'pf'>('pj')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedClientePfId, setSelectedClientePfId] = useState<string>('')
  const [selectedContratoId, setSelectedContratoId] = useState<string>('')
  const [selectedModeloId, setSelectedModeloId] = useState<string>('')

  // Campos do modelo GMAIS
  const [empreendimento, setEmpreendimento] = useState('')
  const [objeto, setObjeto] = useState('')
  const [escopoGerado, setEscopoGerado] = useState('')
  const [premissas, setPremissas] = useState('')
  const [prazoDias, setPrazoDias] = useState<number>(30)
  const [notaPrazo, setNotaPrazo] = useState('')
  const [validadeDias, setValidadeDias] = useState<number>(15)
  const [condicoesGerais, setCondicoesGerais] = useState('')

  // Parcelas da proposta
  const [parcelas, setParcelas] = useState<PropostaParcelaItemInput[]>([])

  // Campos legados / auxiliares
  const [disciplinas, setDisciplinas] = useState('')
  const [entregaveis, setEntregaveis] = useState('')
  const [exclusoes, setExclusoes] = useState('')

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
          paramPremissas,
          paramCondicoes,
          paramNotaPrazo,
          paramParcelas,
        ] = await Promise.all([
          empresasService.list({ status: 'ativa', incluirPreCadastros: true }),
          clientesPfService.list({ incluirPreCadastros: true }),
          catalogoServicosService.listAtivos(),
          modelosService.list(),
          areasAtuacaoService.listAtivas(),
          subservicosService.listAtivos(),
          entregaveisPadraoService.listAtivos(),
          parametrosService.get('proposta_validade_dias', '15'),
          parametrosService.get('proposta_alcada_limite_valor', '100000'),
          parametrosService.get('proposta_alcada_margem_minima', '20'),
          parametrosService.get('proposta_impostos_padrao', '16.5'),
          parametrosService.get(
            'modelo_proposta_premissas',
            '1. A CONTRATADA não se responsabiliza por eventuais paralisações, atrasos e/ou cancelamentos decorrentes de exigências imprevistas dos órgãos competentes.\n2. Não estão inclusos os custos de taxas dos órgãos competentes e ART/RRT.\n3. Projetos elaborados em conformidade com as normas técnicas vigentes.\n4. Estão inclusas até 2 (duas) revisões de projeto decorrentes de ajustes de concepção.',
          ),
          parametrosService.get(
            'modelo_proposta_condicoes_gerais',
            'CLÁUSULA 1ª — Alterações posteriores no projeto incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho.\n\nCLÁUSULA 2ª — Os projetos e memoriais são de uso exclusivo para o empreendimento objeto desta proposta.\n\nCLÁUSULA 3ª — A rescisão imotivada sujeitará à quitação dos serviços executados acrescida de multa rescisória compensatória de 20% sobre o saldo remanescente.',
          ),
          parametrosService.get(
            'modelo_proposta_nota_prazo',
            'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.',
          ),
          parametrosService.get('modelo_proposta_parcelas_padrao', ''),
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

        setPadraoPremissasGmais(paramPremissas)
        setPadraoCondicoesGeraisGmais(paramCondicoes)
        setPadraoNotaPrazoGmais(paramNotaPrazo)

        let parsedParcelas: PropostaParcelaItemInput[] = [
          {
            ordem: 1,
            percentual: 50,
            valor: 0,
            gatilho: 'contratacao',
            descricao: '50% (cinquenta por cento) na assinatura do contrato/aceite',
          },
          {
            ordem: 2,
            percentual: 50,
            valor: 0,
            gatilho: 'entrega',
            descricao: '50% (cinquenta por cento) na entrega final dos projetos executivos',
          },
        ]
        if (paramParcelas) {
          try {
            const arr = JSON.parse(paramParcelas)
            if (Array.isArray(arr) && arr.length > 0) {
              parsedParcelas = arr.map((p, i) => ({
                ordem: p.ordem || i + 1,
                percentual: Number(p.percentual) || 50,
                valor: 0,
                gatilho: p.gatilho || 'marco',
                descricao: p.descricao || `Parcela ${i + 1}`,
              }))
            }
          } catch {
            /* intentionally ignored */
          }
        }
        setPadraoParcelasGmais(parsedParcelas)

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
          setEmpreendimento(propostaToEdit.empreendimento || '')
          setObjeto(propostaToEdit.objeto || propostaToEdit.escopo || '')
          setEscopoGerado(propostaToEdit.escopo_gerado || propostaToEdit.escopo || '')
          setPremissas(propostaToEdit.premissas || paramPremissas)
          setPrazoDias(propostaToEdit.prazo_dias || 30)
          setNotaPrazo(propostaToEdit.nota_prazo || paramNotaPrazo)
          setValidadeDias(propostaToEdit.validade_dias || valDias)
          setCondicoesGerais(propostaToEdit.condicoes_gerais || paramCondicoes)

          setDisciplinas(propostaToEdit.disciplinas || '')
          setEntregaveis(propostaToEdit.entregaveis || '')
          setExclusoes(propostaToEdit.exclusoes || '')

          setItens(propostaToEdit.itens_json || [])
          setMargemPercent(propostaToEdit.margem ?? 35)
          setImpostosPercent(propostaToEdit.impostos ?? 16.5)
          setRequerNota(Boolean(propostaToEdit.requer_nota))

          // Carregar parcelas salvas
          try {
            const parcelasExistentes = await propostasService.listParcelas(propostaToEdit.id)
            if (parcelasExistentes && parcelasExistentes.length > 0) {
              setParcelas(
                parcelasExistentes.map((p) => ({
                  id: p.id,
                  ordem: p.ordem,
                  percentual: p.percentual,
                  valor: p.valor,
                  gatilho: p.gatilho,
                  descricao: p.descricao,
                })),
              )
            } else {
              setParcelas(parsedParcelas)
            }
          } catch (_) {
            setParcelas(parsedParcelas)
          }
        } else {
          // Nova proposta GMAIS
          if (initialClientePfId) {
            setTipoCliente('pf')
            setSelectedClientePfId(initialClientePfId)
          } else if (initialEmpresaId) {
            setTipoCliente('pj')
            setSelectedEmpresaId(initialEmpresaId)
            loadContratosEmpresa(initialEmpresaId)
          }

          setPremissas(paramPremissas)
          setCondicoesGerais(paramCondicoes)
          setNotaPrazo(paramNotaPrazo)
          setValidadeDias(valDias)
          setPrazoDias(30)
          setParcelas(parsedParcelas)

          // Se tiver item no catálogo, adicionar um item inicial de exemplo
          if (cataData.length > 0 && itens.length === 0) {
            const primeiro = cataData[0]
            const primeiroItem: PropostaItemRecord = {
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
            }
            setItens([primeiroItem])
            setDisciplinas(primeiro.disciplina)

            // Auto preencher objeto e escopo inicial
            const objAuto = propostasService.gerarObjetoAutomatico({
              empreendimento: '',
              itens: [primeiroItem],
            })
            setObjeto(objAuto)
            setEscopoGerado(
              propostasService.gerarEscopoAutomatico({
                itens: [primeiroItem],
                areas: areasData,
              }),
            )
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

    // Se empreendimento ainda vazio, sugerir nome da empresa
    const emp = empresas.find((e) => e.id === empId)
    if (emp && !empreendimento) {
      setEmpreendimento(emp.razao_social || emp.nome_fantasia || '')
    }
  }

  // Totais calculados
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

  // Atualizar valores monetários das parcelas quando o preço total mudar
  useEffect(() => {
    if (totais.precoTotal > 0 && parcelas.length > 0) {
      setParcelas((prev) =>
        prev.map((p) => ({
          ...p,
          valor: Math.round(((totais.precoTotal * p.percentual) / 100) * 100) / 100,
        })),
      )
    }
  }, [totais.precoTotal])

  // Recalcular objeto e escopo automaticamente quando solicitado ou na primeira inserção
  const handleAutoGerarObjetoEEscopo = () => {
    let mun: string | undefined
    let uf: string | undefined

    if (tipoCliente === 'pj') {
      const emp = empresas.find((e) => e.id === selectedEmpresaId)
      if (emp) {
        mun = emp.municipio
        uf = emp.uf
      }
    } else {
      const pf = clientesPf.find((c) => c.id === selectedClientePfId)
      if (pf) {
        mun = pf.municipio
        uf = pf.uf
      }
    }

    const novoObjeto = propostasService.gerarObjetoAutomatico({
      empreendimento,
      municipio: mun,
      uf: uf,
      itens,
    })
    const novoEscopo = propostasService.gerarEscopoAutomatico({
      itens,
      areas,
    })

    setObjeto(novoObjeto)
    setEscopoGerado(novoEscopo)

    toast({
      title: 'Objeto e Escopo Gerados',
      description: 'Textos oficiais pré-redigidos a partir do empreendimento e itens selecionados.',
    })
  }

  // Mapeamento e aplicação da prévia estruturada do Assistente IA
  const handleAplicarSugestaoIa = (sug: SugestaoPropostaIa) => {
    // 1. Empreendimento
    if (sug.empreendimento && !empreendimento) {
      setEmpreendimento(sug.empreendimento)
    } else if (sug.empreendimento) {
      setEmpreendimento(sug.empreendimento)
    }

    // 2. Prazo
    if (sug.prazo_dias && sug.prazo_dias > 0) {
      setPrazoDias(sug.prazo_dias)
    }

    // 3. Nota fiscal e impostos
    if (sug.requer_nota !== undefined) {
      setRequerNota(sug.requer_nota)
    }
    if (sug.impostos_percent !== undefined) {
      setImpostosPercent(sug.impostos_percent)
    }

    // 4. Margem
    if (sug.margem_percent !== undefined) {
      setMargemPercent(sug.margem_percent)
    }

    // 5. Objeto e Escopo GMAIS
    if (sug.objeto) {
      setObjeto(sug.objeto)
    }
    if (sug.escopo) {
      setEscopoGerado(sug.escopo)
    }
    if (sug.premissas) {
      setPremissas(sug.premissas)
    }
    if (sug.entregaveis) {
      setEntregaveis(sug.entregaveis)
    }

    // 6. Itens de serviço sugeridos
    if (sug.itens && sug.itens.length > 0) {
      const novosItensMapeados: PropostaItemRecord[] = sug.itens.map((si) => {
        // Tentar cruzar com o catálogo real de serviços pelo nome aproximado
        const catItem = catalogoServicos.find(
          (c) =>
            c.nome.toLowerCase().includes(si.descricao.toLowerCase()) ||
            si.descricao.toLowerCase().includes(c.nome.toLowerCase()),
        )

        // Tentar cruzar área pelo nome da disciplina
        const areaEncontrada = si.disciplina
          ? areas.find(
              (a) =>
                a.nome.toLowerCase().includes(si.disciplina!.toLowerCase()) ||
                si.disciplina!.toLowerCase().includes(a.nome.toLowerCase()),
            )
          : undefined

        const precoUnit =
          si.preco_venda_unitario !== undefined ? si.preco_venda_unitario : catItem?.preco_base || 0

        const qtd = si.quantidade || 1
        const custoUnit = si.custo_unitario || 0

        return {
          servico: catItem?.id || '',
          area: areaEncontrada?.id || catItem?.area || '',
          origem: catItem ? 'catalogo' : 'avulso',
          descricao: si.descricao,
          disciplina: si.disciplina || catItem?.disciplina || '',
          unidade: si.unidade || catItem?.unidade || 'un',
          quantidade: qtd,
          custo_unitario: custoUnit,
          custo_total: Math.round(custoUnit * qtd * 100) / 100,
          preco_venda_unitario: precoUnit,
          preco_total: Math.round(precoUnit * qtd * 100) / 100,
          bdi_percentual: 0,
          subservicos: si.subservicos || [],
        }
      })

      setItens(novosItensMapeados)

      // Atualizar disciplinas consolidadas
      const discUnicas = Array.from(
        new Set(novosItensMapeados.map((it) => it.disciplina).filter(Boolean)),
      )
      if (discUnicas.length > 0) {
        setDisciplinas(discUnicas.join(', '))
      }
    }

    // 7. Parcelas sugeridas (com recálculo imediato do valor monetário se preço > 0)
    if (sug.parcelas && sug.parcelas.length > 0) {
      setParcelas(
        sug.parcelas.map((p, idx) => ({
          ordem: p.ordem || idx + 1,
          percentual: p.percentual,
          valor:
            totais.precoTotal > 0
              ? Math.round(((totais.precoTotal * p.percentual) / 100) * 100) / 100
              : 0,
          gatilho: p.gatilho || (idx === 0 ? 'contratacao' : 'entrega'),
          descricao: p.descricao,
        })),
      )
    }
  }

  // Adicionar item do catálogo ou avulso
  const handleAddItem = (servicoId?: string) => {
    if (servicoId) {
      const servico = catalogoServicos.find((s) => s.id === servicoId)
      if (servico) {
        const custoBase = servico.preco_base || 0
        const novoItem: PropostaItemRecord = {
          servico: servico.id,
          origem: 'catalogo',
          descricao: servico.nome,
          disciplina: servico.disciplina,
          unidade: servico.unidade,
          quantidade: 1,
          custo_unitario: custoBase,
          custo_total: custoBase,
          preco_venda_unitario: custoBase,
          preco_total: custoBase,
          bdi_percentual: 0,
        }
        setItens((prev) => [...prev, novoItem])
        return
      }
    }

    // Item avulso: custo direto informado já inclui bonificação e BDI
    const custoAvulso = 5000
    const novoItemAvulso: PropostaItemRecord = {
      origem: 'avulso',
      descricao: 'Serviço Técnico Especializado',
      disciplina: 'Engenharia Geral',
      unidade: 'un',
      quantidade: 1,
      custo_unitario: custoAvulso,
      custo_total: custoAvulso,
      bdi_percentual: 0,
      preco_venda_unitario: custoAvulso,
      preco_total: custoAvulso,
    }
    setItens((prev) => [...prev, novoItemAvulso])
  }

  const handleUpdateItem = (index: number, field: keyof PropostaItemRecord, value: any) => {
    const updated = [...itens]
    const item = { ...updated[index], [field]: value }

    const q = field === 'quantidade' ? parseFloat(value) || 0 : item.quantidade || 0
    const c = field === 'custo_unitario' ? parseFloat(value) || 0 : item.custo_unitario || 0
    item.custo_total = Math.round(q * c * 100) / 100
    // O valor de Custo Direto já inclui bonificação e BDI (requisito 2).
    // O Preço Total da linha é derivado diretamente do Custo Direto (q * c).
    item.preco_total = item.custo_total
    item.preco_venda_unitario = c

    updated[index] = item
    setItens(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  // Manipulação de Parcelas
  const somaPercentuaisParcelas = parcelas.reduce((acc, p) => acc + (Number(p.percentual) || 0), 0)
  const parcelasValidas = Math.abs(somaPercentuaisParcelas - 100) < 0.01

  const handleAddParcela = () => {
    const proxOrdem = parcelas.length + 1
    const restante = Math.max(0, 100 - somaPercentuaisParcelas)
    const valorParc = Math.round(((totais.precoTotal * restante) / 100) * 100) / 100
    setParcelas([
      ...parcelas,
      {
        ordem: proxOrdem,
        percentual: restante,
        valor: valorParc,
        gatilho: 'marco',
        descricao: `${restante}% na entrega da fase ${proxOrdem}`,
      },
    ])
  }

  const handleRemoveParcela = (idx: number) => {
    if (parcelas.length <= 1) {
      toast({
        title: 'Aviso',
        description: 'A proposta deve ter ao menos uma parcela de pagamento.',
        variant: 'destructive',
      })
      return
    }
    const novas = parcelas.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i + 1 }))
    setParcelas(novas)
  }

  const handleUpdateParcela = (
    idx: number,
    field: keyof PropostaParcelaItemInput,
    value: string | number,
  ) => {
    setParcelas((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p
        const updated = { ...p, [field]: value }
        if (field === 'percentual') {
          const perc = parseFloat(String(value)) || 0
          updated.valor = Math.round(((totais.precoTotal * perc) / 100) * 100) / 100
        }
        return updated
      }),
    )
  }

  // Preenchimento com Modelo de E-mail/Texto existente
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
      prazo: `${prazoDias} dias corridos`,
      disciplinas: disciplinas,
    })

    setObjeto(textoComVariaveis)
    toast({
      title: 'Modelo Aplicado ao Objeto',
      description: `Variáveis preenchidas automaticamente a partir de "${modelo.nome}".`,
    })
  }

  // Verifica se há custo direto informado para a alçada
  const temCustoInformado = custoTotalItens > 0

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

    if (!empreendimento.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome do empreendimento obrigatório',
        description:
          'Informe o nome do empreendimento ou obra antes de salvar ou finalizar a proposta.',
      })
      return
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
    if (!objeto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Objeto obrigatório',
        description: 'Preencha o objeto técnico da proposta (ou clique em Gerar Automaticamente).',
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
    if (!parcelasValidas) {
      toast({
        variant: 'destructive',
        title: 'Parcelas inválidas',
        description: `A soma dos percentuais das parcelas deve ser exatamente 100% (atual: ${somaPercentuaisParcelas}%).`,
      })
      return
    }

    setSaving(true)
    try {
      // Calcular data de validade a partir do prazo de validade em dias
      const diasValidadeCalc = validadeDias > 0 ? validadeDias : validadeDiasPadrao
      const dtVal = new Date()
      dtVal.setDate(dtVal.getDate() + diasValidadeCalc)

      // Montar resumo textual de condições de pagamento
      const condicoesTexto = parcelas.map((p) => `${p.percentual}% (${p.descricao})`).join('; ')

      const payload: any = {
        empresa: tipoCliente === 'pj' ? selectedEmpresaId : undefined,
        cliente_pf: tipoCliente === 'pf' ? selectedClientePfId : undefined,
        contrato: tipoCliente === 'pj' ? selectedContratoId || undefined : undefined,
        modelo: selectedModeloId || undefined,
        // Novos campos modelo GMAIS
        empreendimento,
        objeto,
        escopo_gerado: escopoGerado || objeto,
        premissas,
        prazo_dias: prazoDias,
        nota_prazo: notaPrazo,
        validade_dias: diasValidadeCalc,
        condicoes_gerais: condicoesGerais,
        // Compatibilidade legada
        escopo: objeto,
        disciplinas:
          disciplinas ||
          itens
            .map((i) => i.disciplina)
            .filter(Boolean)
            .join(', '),
        entregaveis,
        prazo: `${prazoDias} dias corridos`,
        condicoes_pagamento: condicoesTexto,
        validade: dtVal.toISOString(),
        exclusoes,
        custo: totais.custo,
        margem: temCustoInformado ? totais.margemEfetivaPercent : margemPercent,
        impostos: requerNota ? impostosPercent : 0,
        requer_nota: requerNota,
        preco: totais.precoTotal,
        requer_aprovacao_admin: alcadaInfo.requerAdmin,
        // Garante que apenas itens válidos com catálogo/serviço ou descrição específica constem em itens_json
        itens_json: itens.filter((i) => {
          const desc = (i.descricao || '').trim()
          return (
            Boolean(i.servico || (i as any).catalogo_servico) ||
            (desc.length > 0 && !desc.startsWith('Item de Escopo '))
          )
        }),
      }

      if (enviarParaAprovacao) {
        payload.status = 'aprovada'
      }

      let res: PropostaRecord
      if (propostaToEdit) {
        res = await propostasService.update(propostaToEdit.id, payload)
        // Sincronizar parcelas no banco
        await propostasService.sincronizarParcelas(
          res.id,
          parcelas.map((p, idx) => ({ ...p, ordem: p.ordem ?? idx + 1 })),
        )

        toast({
          title: 'Proposta Atualizada',
          description: `Proposta ${res.numero} e suas parcelas foram salvas com sucesso.`,
        })
      } else {
        payload.criado_por = currentUserId
        payload.status = enviarParaAprovacao ? 'aprovada' : 'rascunho'
        res = await propostasService.create(payload)

        // Sincronizar parcelas no banco
        await propostasService.sincronizarParcelas(
          res.id,
          parcelas.map((p, idx) => ({ ...p, ordem: p.ordem ?? idx + 1 })),
        )

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
          title: 'Proposta GMAIS Elaborada',
          description: `Proposta ${res.numero} gerada com sucesso com ${parcelas.length} parcelas registradas.`,
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
          className={`${isComercialOrAdmin ? 'max-w-7xl' : 'max-w-4xl'} max-h-[92vh] overflow-y-auto p-6`}
          onCloseAutoFocus={() => restoreBodyPointerEvents()}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  {propostaToEdit
                    ? `Editar Proposta ${propostaToEdit.numero} (${propostaToEdit.revisao || 'Rev.00'})`
                    : 'Elaborar Proposta Técnica GMAIS'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Padrão oficial da empresa: Objeto, Escopo gerado por disciplina, Premissas, Prazo,
                  Investimento consolidado e Parcelamento com gatilhos.
                </DialogDescription>
              </div>
              {propostaToEdit && (
                <Badge variant="outline" className="font-mono text-xs">
                  {propostaToEdit.numero} - {propostaToEdit.revisao || 'Rev.00'}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* GRID COM PAINEL ASSISTENTE IA LATERAL PARA ADMIN E COMERCIAL */}
          <div
            className={`pt-2 text-xs ${isComercialOrAdmin ? 'grid grid-cols-1 lg:grid-cols-12 gap-5' : 'space-y-6'}`}
          >
            {/* COLUNA DO ASSISTENTE IA (Lado Esquerdo em desktop para Admin e Comercial) */}
            {isComercialOrAdmin && (
              <div className="lg:col-span-4 xl:col-span-4 order-2 lg:order-1">
                <PainelAssistenteIa
                  onAplicarSugestao={handleAplicarSugestaoIa}
                  propostaNumero={propostaToEdit?.numero}
                  propostaStatus={propostaToEdit?.status}
                  isEdicao={Boolean(propostaToEdit)}
                />
              </div>
            )}

            {/* COLUNA DOS CAMPOS DO FORMULÁRIO */}
            <div
              className={`${isComercialOrAdmin ? 'lg:col-span-8 xl:col-span-8 order-1 lg:order-2' : ''} space-y-6`}
            >
              {/* 1. DESTINATÁRIO E EMPREENDIMENTO */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-orange-600" />
                    1. Contratante &amp; Empreendimento
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
                    onTipoChange={setTipoCliente}
                  />

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      Nome do Empreendimento / Obra *
                    </Label>
                    <Input
                      value={empreendimento}
                      onChange={(e) => setEmpreendimento(e.target.value)}
                      placeholder="Ex.: Clínica de Fisioterapia Studio Ser, Edifício Horizonte..."
                      className="h-9 text-xs"
                    />
                    <span className="text-[10px] text-slate-500">
                      Exibido no cabeçalho do PDF e na redação formal do Objeto da Proposta.
                    </span>
                  </div>
                </div>

                {tipoCliente === 'pj' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-700">
                        Contrato Público Vinculado (se aplicável)
                      </Label>
                      <Select
                        value={selectedContratoId}
                        onValueChange={setSelectedContratoId}
                        disabled={contratos.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                  </div>
                )}
              </div>

              {/* 2. ITENS DE SERVIÇO, ÁREAS E INVESTIMENTO */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-emerald-600" />
                      2. Serviços &amp; Composição do Investimento por Área
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Insira os serviços por área de atuação. O dossiê/PDF organizará o investimento
                      em tabela por área seguida do valor global consolidado.
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
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="py-2.5 px-3 min-w-[260px]">
                          Disciplina &amp; Descrição do Serviço
                        </th>
                        <th className="py-2.5 px-2 w-20 text-center">Origem</th>
                        <th className="py-2.5 px-2 w-16 text-center">Unid.</th>
                        <th className="py-2.5 px-2 w-28 text-center bg-slate-200/80 font-bold text-slate-900">
                          Qtd.
                        </th>
                        <th className="py-2.5 px-2 min-w-[130px] w-36 text-right">
                          Custo Direto (R$)
                        </th>
                        <th className="py-2.5 px-3 min-w-[130px] w-36 text-right">
                          Custo Total (R$)
                        </th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
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
                          const isCat =
                            it.origem === 'catalogo' ||
                            (Boolean(it.servico) && it.origem !== 'avulso')
                          const custoTotalLinha =
                            it.custo_total !== undefined
                              ? it.custo_total
                              : Math.round((it.custo_unitario || 0) * (it.quantidade || 0) * 100) /
                                100

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 space-y-1">
                                <Input
                                  value={it.descricao}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, 'descricao', e.target.value)
                                  }
                                  className="h-8 text-xs font-medium w-full"
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
                              <td className="p-3 text-center">
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
                              <td className="p-3 text-center">
                                <Input
                                  value={it.unidade || 'un'}
                                  onChange={(e) => handleUpdateItem(idx, 'unidade', e.target.value)}
                                  className="h-8 text-xs text-center mx-auto w-14"
                                />
                              </td>
                              <td className="p-3 text-center bg-slate-100">
                                <Input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={it.quantidade}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, 'quantidade', e.target.value)
                                  }
                                  className="h-8 min-w-[80px] w-20 px-2 text-center font-mono font-bold text-sm bg-white border-slate-300 mx-auto shadow-2xs"
                                />
                              </td>
                              <td className="p-3 text-right font-mono">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0,00"
                                  value={it.custo_unitario || 0}
                                  onChange={(e) =>
                                    handleUpdateItem(idx, 'custo_unitario', e.target.value)
                                  }
                                  className="h-8 text-xs text-right font-mono font-semibold min-w-[100px] w-full px-2"
                                  title="Custo direto unitário (já inclui bonificação e BDI)"
                                />
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                                {formatCurrencyBr(custoTotalLinha)}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
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
                        <Badge
                          variant={requerNota ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {requerNota ? 'Nota Fiscal Ativa' : 'Nota Fiscal Desligada (Padrão)'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {requerNota
                          ? 'Com nota ativa: os impostos/tributos serão adicionados ao preço final e a proposta exibirá observação formal de emissão de NF.'
                          : 'Cliente não exigirá nota: o PDF indicará observação informando que os valores não contemplam emissão de NF.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Switch
                      id="switchNotaFiscal"
                      checked={requerNota}
                      onCheckedChange={setRequerNota}
                    />
                    <Label
                      htmlFor="switchNotaFiscal"
                      className="text-xs font-medium cursor-pointer"
                    >
                      {requerNota ? 'Sim' : 'Não'}
                    </Label>
                  </div>
                </div>

                {/* PAINEL DE INVESTIMENTO CONSOLIDADO */}
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
                      Preço de Venda dos Serviços
                    </Label>
                    <div className="text-base font-bold font-mono text-blue-900">
                      {formatCurrencyBr(totais.precoVendaSemImpostos)}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Soma das áreas e especialidades
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
                        VALOR GLOBAL CONSOLIDADO DA PROPOSTA
                      </Label>
                      <span className="text-[11px] text-emerald-800">
                        {requerNota
                          ? 'Investimento global com tributos inclusos (exigência de NF)'
                          : 'Investimento global sem tributos adicionais (cliente não exigirá NF)'}
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
                  </div>
                </div>
              </div>

              {/* 3. PARCELAMENTO & CONDIÇÕES DE PAGAMENTO (GMAIS 50/50 OU PERSONALIZADO) */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-blue-600" />
                      3. Condições de Pagamento — Parcelas da Proposta
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Padrão GMAIS: 50% na contratação / 50% na entrega final. Ao converter em
                      projeto, as contas a receber são geradas fracionadas por estas parcelas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        parcelasValidas
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                          : 'bg-red-50 text-red-800 border-red-300 text-[10px]'
                      }
                    >
                      Soma: {somaPercentuaisParcelas}%{' '}
                      {parcelasValidas ? '✓ (OK)' : '— Deve somar 100%'}
                    </Badge>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddParcela}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Parcela
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {parcelas.map((parc, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-1 font-mono text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          #{parc.ordem || pIdx + 1}
                        </Badge>
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-slate-500 block sm:hidden">
                          Percentual
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={parc.percentual}
                            onChange={(e) =>
                              handleUpdateParcela(
                                pIdx,
                                'percentual',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="text-xs h-7 pr-5 font-mono text-right"
                          />
                          <span className="text-[10px] text-slate-400 absolute right-2 top-1.5 font-bold">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-2 text-right">
                        <Label className="text-[10px] text-slate-500 block sm:hidden">
                          Valor R$
                        </Label>
                        <div className="font-mono font-semibold text-xs text-blue-900 bg-white border border-slate-200 px-2 py-1 rounded h-7 flex items-center justify-end">
                          {formatCurrencyBr(
                            parc.valor || (totais.precoTotal * parc.percentual) / 100,
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <Label className="text-[10px] text-slate-500 block sm:hidden">
                          Gatilho
                        </Label>
                        <Select
                          value={parc.gatilho}
                          onValueChange={(val: 'contratacao' | 'entrega' | 'marco') =>
                            handleUpdateParcela(pIdx, 'gatilho', val)
                          }
                        >
                          <SelectTrigger className="text-xs h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contratacao">Contratação / Aceite</SelectItem>
                            <SelectItem value="entrega">Entrega Final</SelectItem>
                            <SelectItem value="marco">Marco / Etapa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-3">
                        <Label className="text-[10px] text-slate-500 block sm:hidden">
                          Descrição
                        </Label>
                        <Input
                          value={parc.descricao}
                          onChange={(e) => handleUpdateParcela(pIdx, 'descricao', e.target.value)}
                          placeholder="Ex.: 50% na contratação..."
                          className="text-xs h-7"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParcela(pIdx)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-800"
                          title="Remover parcela"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {!parcelasValidas && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>
                      A soma dos percentuais deve totalizar exatamente 100% (atual:{' '}
                      {somaPercentuaisParcelas}%).
                    </span>
                  </div>
                )}
              </div>

              {/* 4. REDAÇÃO OFICIAL GMAIS (OBJETO, ESCOPO, PREMISSAS, PRAZOS, VALIDADE E CONDIÇÕES) */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    4. Redação Oficial GMAIS (Dossiê/PDF)
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoGerarObjetoEEscopo}
                      className="h-7 text-xs gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      Gerar Objeto &amp; Escopo Automaticamente
                    </Button>

                    <Select value={selectedModeloId} onValueChange={handleAplicarModelo}>
                      <SelectTrigger className="h-7 text-xs w-[180px]">
                        <SelectValue placeholder="Modelo de texto..." />
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

                {/* 1. OBJETO */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">
                      1. Objeto da Proposta *
                    </Label>
                    <span className="text-[10px] text-slate-500">
                      Pré-redigido conforme serviços, cliente e empreendimento
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    placeholder="Esta proposta comercial tem como objetivo a prestação de serviços técnicos para..."
                    className="text-xs font-sans leading-relaxed"
                  />
                </div>

                {/* 2. ESCOPO DOS SERVIÇOS (NUMERADO) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">
                      2. Escopo dos Serviços (Lista Numerada)
                    </Label>
                    <span className="text-[10px] text-slate-500">
                      Consolidado automaticamente por projetos e especialidades
                    </span>
                  </div>
                  <Textarea
                    rows={4}
                    value={escopoGerado}
                    onChange={(e) => setEscopoGerado(e.target.value)}
                    placeholder="1. PROJETO / DISCIPLINA: ARQUITETURA..."
                    className="text-xs font-mono text-[11px] leading-relaxed"
                  />
                </div>

                {/* 3. PREMISSAS */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">
                      3. Premissas Técnicas da Proposta
                    </Label>
                    <span className="text-[10px] text-slate-500">
                      Padrão oficial da empresa (editável por proposta)
                    </span>
                  </div>
                  <Textarea
                    rows={4}
                    value={premissas}
                    onChange={(e) => setPremissas(e.target.value)}
                    className="text-xs font-sans leading-relaxed"
                  />
                </div>

                {/* 4. PRAZO E NOTA */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      4. Prazo de Execução (dias)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        value={prazoDias}
                        onChange={(e) => setPrazoDias(parseInt(e.target.value, 10) || 0)}
                        className="text-xs h-9 font-mono"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-slate-500">
                        dias corridos
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-9 space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      Nota de Contagem de Prazos
                    </Label>
                    <Input
                      value={notaPrazo}
                      onChange={(e) => setNotaPrazo(e.target.value)}
                      placeholder="Os prazos serão contados em dias corridos..."
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                {/* 5. VALIDADE DA PROPOSTA (DIAS) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-xs font-semibold text-slate-800">
                      7. Validade da Proposta (em dias)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        max={180}
                        value={validadeDias}
                        onChange={(e) => setValidadeDias(parseInt(e.target.value, 10) || 0)}
                        className="text-xs h-9 font-mono pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-medium">
                        dias
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Padrão do sistema: 15 dias (o modelo GMAIS usa 5, 100% editável).
                    </span>
                  </div>

                  <div className="md:col-span-8 space-y-1 flex flex-col justify-end">
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-[11px]">
                      <strong>Regra de Expiração &amp; Lembretes:</strong> O sistema respeita este
                      prazo de {validadeDias} dias corridos para enviar alertas D-3 e atualizar
                      automaticamente o status para &quot;Expirada&quot;.
                    </div>
                  </div>
                </div>

                {/* 6. CONDIÇÕES GERAIS (3 CLÁUSULAS CONTRATUAIS) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-800">
                      8. Condições Gerais &amp; Cláusulas Rescisórias
                    </Label>
                    <span className="text-[10px] text-slate-500">
                      Cláusulas 1ª (alterações), 2ª (uso exclusivo) e 3ª (rescisão e multa de 20%)
                    </span>
                  </div>
                  <Textarea
                    rows={5}
                    value={condicoesGerais}
                    onChange={(e) => setCondicoesGerais(e.target.value)}
                    className="text-xs font-sans leading-relaxed"
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
                disabled={saving || !parcelasValidas}
                className="text-slate-700"
              >
                Salvar como Rascunho
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving || !parcelasValidas}
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
              const empList = await empresasService.list({
                status: 'ativa',
                incluirPreCadastros: true,
              })
              setEmpresas(empList)
              setSelectedEmpresaId(novo.id)
              loadContratosEmpresa(novo.id)
              if (!empreendimento) {
                const cadastrado = empList.find((e) => e.id === novo.id)
                setEmpreendimento(cadastrado?.razao_social || cadastrado?.nome_fantasia || '')
              }
            } else {
              const pfList = await clientesPfService.list({ incluirPreCadastros: true })
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
            const novosItens = [...itens, novoItem]
            setItens(novosItens)

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

            // Atualizar o escopo gerado caso ainda não tenha sido customizado
            if (!escopoGerado || escopoGerado.trim().length === 0) {
              setEscopoGerado(
                propostasService.gerarEscopoAutomatico({
                  itens: novosItens,
                  areas,
                }),
              )
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
export default ModalEditorProposta
