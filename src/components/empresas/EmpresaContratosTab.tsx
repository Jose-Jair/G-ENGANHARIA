import React, { useState } from 'react'
import { ContratoRecord } from '@/types'
import { contratosService } from '@/services/contratos'
import {
  formatCurrencyBr,
  formatDateBr,
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus,
  FileText,
  AlertTriangle,
  ExternalLink,
  Edit,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmpresaContratosTabProps {
  empresaId: string
  contratos: ContratoRecord[]
  diasAlerta: number
  readOnly: boolean
  onContratosChange: () => void
  autoOpenNovoContrato?: boolean
  onNovoContratoModalClose?: () => void
}

export function EmpresaContratosTab({
  empresaId,
  contratos,
  diasAlerta,
  readOnly,
  onContratosChange,
  autoOpenNovoContrato = false,
  onNovoContratoModalClose,
}: EmpresaContratosTabProps) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContrato, setEditingContrato] = useState<ContratoRecord | null>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [orgao, setOrgao] = useState('')
  const [objeto, setObjeto] = useState('')
  const [valorInput, setValorInput] = useState('')
  const [situacao, setSituacao] = useState('Em Execução')
  const [fonte, setFonte] = useState('')

  // Campos adicionais do formulário (número e vigências)
  const [numero, setNumero] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [saldo, setSaldo] = useState<number | ''>('')
  const [vigenciaInicio, setVigenciaInicio] = useState('')
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [linkEdital, setLinkEdital] = useState('')

  // Estados de detecção de duplicidade
  const [duplicidadeModalOpen, setDuplicidadeModalOpen] = useState(false)
  const [contratoExistenteConflito, setContratoExistenteConflito] = useState<ContratoRecord | null>(
    null,
  )
  const [motivoDuplicidade, setMotivoDuplicidade] = useState<string>('')
  const [highlightedContratoId, setHighlightedContratoId] = useState<string | null>(null)
  const [pendentePayload, setPendentePayload] = useState<any>(null)

  const openCreateModal = () => {
    setEditingContrato(null)
    setOrgao('')
    setObjeto('')
    setValorInput('')
    setSituacao('Em Execução')
    setFonte('')
    setNumero('')
    setModalidade('')
    setSaldo('')
    setVigenciaInicio('')
    setVigenciaFim('')
    setLinkEdital('')
    setModalOpen(true)
  }

  // Se autoOpenNovoContrato for acionado pelo fluxo de duplicidade
  React.useEffect(() => {
    if (autoOpenNovoContrato && !readOnly) {
      openCreateModal()
    } else if (!autoOpenNovoContrato) {
      // Se resetado para false, garante que o modal possa fechar se não estiver editando
    }
  }, [autoOpenNovoContrato, readOnly])

  const openEditModal = (c: ContratoRecord) => {
    setEditingContrato(c)
    setOrgao(c.orgao || '')
    setObjeto(c.objeto || '')
    setValorInput(typeof c.valor === 'number' && c.valor > 0 ? formatCurrencyBr(c.valor) : '')
    setSituacao(c.situacao || 'Em Execução')
    setFonte(c.fonte || '')
    setNumero(c.numero || '')
    setModalidade(c.modalidade || '')
    setSaldo(typeof c.saldo === 'number' ? c.saldo : '')
    setVigenciaInicio(c.vigencia_inicio ? c.vigencia_inicio.slice(0, 10) : '')
    setVigenciaFim(c.vigencia_fim ? c.vigencia_fim.slice(0, 10) : '')
    setLinkEdital(c.link_edital || '')
    setModalOpen(true)
  }

  // Helpers para normalização e detecção de duplicidade
  const normalizeText = (text?: string): string => {
    if (!text) return ''
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  const checkJaccardSimilarity = (s1: string, s2: string): number => {
    const t1 = normalizeText(s1).replace(/[^a-z0-9\s]/g, ' ')
    const t2 = normalizeText(s2).replace(/[^a-z0-9\s]/g, ' ')
    const words1 = new Set(t1.split(/\s+/).filter((w) => w.length >= 3))
    const words2 = new Set(t2.split(/\s+/).filter((w) => w.length >= 3))
    if (words1.size === 0 || words2.size === 0) return 0
    let inter = 0
    for (const w of words1) {
      if (words2.has(w)) inter++
    }
    const union = new Set([...words1, ...words2]).size
    return union > 0 ? inter / union : 0
  }

  const checkDuplicidade = (
    num: string,
    org: string,
    val: number,
    vIni?: string,
    vFim?: string,
    obj?: string,
  ): { conflito: ContratoRecord; motivo: string } | null => {
    const normOrg = normalizeText(org)
    const normNum = normalizeText(num)

    for (const existente of contratos) {
      if (editingContrato && existente.id === editingContrato.id) continue

      const existOrg = normalizeText(existente.orgao)
      const existNum = normalizeText(existente.numero)
      const existVal = Number(existente.valor) || 0

      // (a) Mesmo número informado
      if (normNum && existNum && normNum === existNum) {
        return {
          conflito: existente,
          motivo: `Mesmo número de contrato (${existente.numero || num}).`,
        }
      }

      // Se for para o mesmo órgão
      if (normOrg && existOrg && normOrg === existOrg) {
        // (b) Mesmo órgão + mesmo valor
        if (val > 0 && Math.abs(val - existVal) < 0.01) {
          return {
            conflito: existente,
            motivo: `Mesmo órgão e mesmo valor (${formatCurrencyBr(val)}).`,
          }
        }

        // (c) Mesmo órgão + vigência com sobreposição de datas
        if (vIni && vFim && existente.vigencia_inicio && existente.vigencia_fim) {
          const start1 = new Date(vIni).getTime()
          const end1 = new Date(vFim).getTime()
          const start2 = new Date(existente.vigencia_inicio).getTime()
          const end2 = new Date(existente.vigencia_fim).getTime()
          if (!isNaN(start1) && !isNaN(end1) && !isNaN(start2) && !isNaN(end2)) {
            const overlap = Math.max(start1, start2) <= Math.min(end1, end2)
            if (overlap) {
              return {
                conflito: existente,
                motivo: `Mesmo órgão com vigências sobrepostas (${formatDateBr(vIni)} a ${formatDateBr(vFim)}).`,
              }
            }
          }
        }

        // (d) Objeto substancialmente igual para o mesmo órgão
        if (obj && existente.objeto) {
          const sim = checkJaccardSimilarity(obj, existente.objeto)
          if (sim >= 0.55) {
            return {
              conflito: existente,
              motivo: `Mesmo órgão e objeto substancialmente igual (${Math.round(sim * 100)}% similaridade).`,
            }
          }
        }
      }
    }

    return null
  }

  const salvarContratoFinal = async (payload: any) => {
    setLoading(true)
    try {
      if (editingContrato) {
        await contratosService.update(editingContrato.id, payload)
        toast({
          title: 'Contrato atualizado',
          description: `Contrato salvo com sucesso (${formatCurrencyBr(payload.valor)}).`,
        })
      } else {
        await contratosService.create(payload)
        toast({
          title: 'Contrato lançado',
          description: `Novo contrato adicionado com sucesso (${formatCurrencyBr(payload.valor)}).`,
        })
      }
      setModalOpen(false)
      setDuplicidadeModalOpen(false)
      setPendentePayload(null)
      setContratoExistenteConflito(null)
      onContratosChange()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar contrato',
        description: err instanceof Error ? err.message : 'Falha na comunicação com o banco.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgao.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o órgão contratante.',
        variant: 'destructive',
      })
      return
    }

    const valorNumerico = parseCurrencyInput(valorInput)
    const numeroFinal =
      numero.trim() || editingContrato?.numero || `CT-${Date.now().toString().slice(-6)}`

    const payload: any = {
      empresa: empresaId,
      orgao: orgao.trim(),
      numero: numeroFinal,
      objeto: objeto.trim(),
      modalidade: modalidade.trim(),
      valor: valorNumerico,
      saldo: typeof saldo === 'number' && saldo > 0 ? saldo : valorNumerico,
      vigencia_inicio: vigenciaInicio ? `${vigenciaInicio} 00:00:00.000Z` : undefined,
      vigencia_fim: vigenciaFim ? `${vigenciaFim} 00:00:00.000Z` : undefined,
      situacao: situacao.trim() || 'Em Execução',
      link_edital: linkEdital.trim(),
      fonte: fonte.trim(),
    }

    // Apenas na criação de novo contrato verificamos duplicidade preliminarmente
    if (!editingContrato) {
      const dup = checkDuplicidade(
        numeroFinal,
        orgao.trim(),
        valorNumerico,
        vigenciaInicio,
        vigenciaFim,
        objeto.trim(),
      )
      if (dup) {
        setContratoExistenteConflito(dup.conflito)
        setMotivoDuplicidade(dup.motivo)
        setPendentePayload(payload)
        setDuplicidadeModalOpen(true)
        return
      }
    }

    await salvarContratoFinal(payload)
  }

  const handleConfirmarDuplicidade = async () => {
    if (!pendentePayload) return
    const payloadConfirmado = {
      ...pendentePayload,
      confirmado_duplicidade: true,
      contrato_similar_id: contratoExistenteConflito?.id,
    }
    await salvarContratoFinal(payloadConfirmado)
  }

  const handleVerContratoExistente = () => {
    if (!contratoExistenteConflito) return
    const id = contratoExistenteConflito.id
    setDuplicidadeModalOpen(false)
    setModalOpen(false)
    setHighlightedContratoId(id)

    setTimeout(() => {
      const el = document.getElementById(`contrato-card-${id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)

    // Remove o highlight após 5 segundos
    setTimeout(() => {
      setHighlightedContratoId((current) => (current === id ? null : current))
    }, 5000)
  }

  const handleDelete = async (contratoId: string, numeroContrato: string) => {
    if (!window.confirm(`Tem certeza de que deseja remover o contrato ${numeroContrato}?`)) {
      return
    }
    try {
      await contratosService.delete(contratoId)
      toast({
        title: 'Contrato excluído',
        description: `Contrato ${numeroContrato} foi removido com sucesso.`,
      })
      onContratosChange()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao excluir contrato',
        description: err instanceof Error ? err.message : 'Falha na exclusão.',
        variant: 'destructive',
      })
    }
  }

  const totalAtivo = contratos
    .filter((c) => contratosService.isContratoAtivo(c))
    .reduce((acc, c) => acc + (c.valor || 0), 0)

  return (
    <div className="space-y-4">
      {/* Top Banner de Resumo da Aba Contratos */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Total de Contratos Ativos da Empresa
            </span>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {formatCurrencyBr(totalAtivo)}
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Lançar Novo Contrato
          </Button>
        )}
      </div>

      {/* Lista de Contratos (Colunas suprimidas: número, modalidade, saldo, início, fim, link do edital) */}
      {contratos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">
            Nenhum contrato cadastrado nesta empresa
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Lançar os contratos públicos permite estimar a curva ABC e o potencial de intermediação
            técnica da engenharia.
          </p>
          {!readOnly && (
            <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Primeiro Contrato
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map((c) => {
            const isAtivo = contratosService.isContratoAtivo(c)

            return (
              <div
                key={c.id}
                id={`contrato-card-${c.id}`}
                className={`border rounded-lg p-4 transition-all duration-300 ${
                  highlightedContratoId === c.id
                    ? 'bg-amber-50 border-2 border-amber-500 shadow-md ring-2 ring-amber-300 ring-offset-1'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.orgao}</span>
                      {c.numero && (
                        <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          Nº {c.numero}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${
                          isAtivo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.situacao || 'Em Execução'}
                      </Badge>
                      {(c.vigencia_inicio || c.vigencia_fim) && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {c.vigencia_inicio ? formatDateBr(c.vigencia_inicio) : '—'} a{' '}
                          {c.vigencia_fim ? formatDateBr(c.vigencia_fim) : '—'}
                        </span>
                      )}
                      {c.fonte && (
                        <span className="text-[11px] text-slate-400">Fonte: {c.fonte}</span>
                      )}
                      {highlightedContratoId === c.id && (
                        <Badge className="bg-amber-600 text-white text-[10px] uppercase font-bold animate-pulse">
                          Contrato em Destaque
                        </Badge>
                      )}
                    </div>

                    {c.objeto && (
                      <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{c.objeto}"
                      </p>
                    )}
                  </div>

                  <div className="flex lg:flex-col items-end justify-between border-t lg:border-t-0 pt-2 lg:pt-0 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Valor Contratado
                      </span>
                      <span className="text-base font-bold text-slate-900 font-mono">
                        {formatCurrencyBr(c.valor || 0)}
                      </span>
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(c)}
                          className="h-8 px-2 text-slate-600 hover:text-blue-600"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id, c.orgao)}
                          className="h-8 px-2 text-slate-600 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal CRUD Contrato (com campos suprimidos do formulário) */}
      <Dialog
        open={modalOpen}
        onOpenChange={(isOpen) => {
          setModalOpen(isOpen)
          if (!isOpen && onNovoContratoModalClose) {
            onNovoContratoModalClose()
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContrato ? 'Editar Contrato Público' : 'Lançar Novo Contrato'}
            </DialogTitle>
            <DialogDescription>
              Informe o órgão contratante, o valor contratado e o objeto do contrato para
              classificação na Curva ABC.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="orgao">Órgão Contratante *</Label>
                <Input
                  id="orgao"
                  placeholder="Ex: Prefeitura Municipal de Salvador, DER-SP, DNIT"
                  value={orgao}
                  onChange={(e) => setOrgao(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valorInput">Valor Contratado (R$) *</Label>
                <Input
                  id="valorInput"
                  placeholder="R$ 0,00"
                  value={valorInput}
                  onChange={(e) => setValorInput(formatCurrencyInput(e.target.value))}
                  className="font-mono text-base font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="objeto">Objeto do Contrato</Label>
                <Textarea
                  id="objeto"
                  rows={3}
                  placeholder="Descreva o escopo da obra, projeto ou intervenção..."
                  value={objeto}
                  onChange={(e) => setObjeto(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="situacao">Situação</Label>
                  <select
                    id="situacao"
                    className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={situacao}
                    onChange={(e) => setSituacao(e.target.value)}
                  >
                    <option value="Em Execução">Em Execução</option>
                    <option value="Aguardando OS">Aguardando Ordem de Serviço</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Encerrado">Encerrado</option>
                    <option value="Rescindido">Rescindido</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fonte">Fonte da Informação</Label>
                  <Input
                    id="fonte"
                    placeholder="Ex: PNCP, Diário Oficial, Comprasnet"
                    value={fonte}
                    onChange={(e) => setFonte(e.target.value)}
                  />
                </div>
              </div>

              {/* Número e Vigência */}
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número do Contrato (opcional)</Label>
                <Input
                  id="numero"
                  placeholder="Ex: 045/2024, Pregão 12/2023"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vigenciaInicio">Início da Vigência</Label>
                  <Input
                    id="vigenciaInicio"
                    type="date"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vigenciaFim">Término da Vigência</Label>
                  <Input
                    id="vigenciaFim"
                    type="date"
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading
                  ? 'Salvando...'
                  : editingContrato
                    ? 'Salvar Alterações'
                    : 'Lançar Contrato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Conferência de Duplicidade de Contrato */}
      <Dialog open={duplicidadeModalOpen} onOpenChange={setDuplicidadeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <DialogTitle className="text-slate-900">
                Alerta de Possível Contrato Duplicado
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 pt-1">
              Já existe um contrato semelhante cadastrado para esta empresa. Deseja cadastrar mesmo
              assim?
            </DialogDescription>
          </DialogHeader>

          {motivoDuplicidade && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 font-medium">
              <strong>Motivo detectado:</strong> {motivoDuplicidade}
            </div>
          )}

          {/* Comparativo lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
            {/* Contrato Existente */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Contrato Existente
                </span>
                <Badge variant="outline" className="text-[10px] bg-white">
                  {contratoExistenteConflito?.situacao || 'Cadastrado'}
                </Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Órgão:</span>
                  <div className="font-semibold text-slate-900">
                    {contratoExistenteConflito?.orgao || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Número:</span>
                  <div className="font-mono text-slate-900">
                    {contratoExistenteConflito?.numero || 'Não informado'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Valor:</span>
                  <div className="font-mono font-bold text-slate-900">
                    {formatCurrencyBr(contratoExistenteConflito?.valor || 0)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Vigência:</span>
                  <div className="text-slate-800">
                    {contratoExistenteConflito?.vigencia_inicio
                      ? formatDateBr(contratoExistenteConflito.vigencia_inicio)
                      : '—'}{' '}
                    até{' '}
                    {contratoExistenteConflito?.vigencia_fim
                      ? formatDateBr(contratoExistenteConflito.vigencia_fim)
                      : '—'}
                  </div>
                </div>

                {contratoExistenteConflito?.objeto && (
                  <div>
                    <span className="text-slate-500 font-medium">Objeto:</span>
                    <div className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-200 line-clamp-3">
                      "{contratoExistenteConflito.objeto}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Novo Contrato */}
            <div className="border border-blue-200 rounded-lg p-3.5 bg-blue-50/40 space-y-2">
              <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
                  Novo Contrato (em preenchimento)
                </span>
                <Badge className="text-[10px] bg-blue-600 text-white">Novo</Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-blue-600 font-medium">Órgão:</span>
                  <div className="font-semibold text-slate-900">
                    {pendentePayload?.orgao || orgao || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-blue-600 font-medium">Número:</span>
                  <div className="font-mono text-slate-900">
                    {pendentePayload?.numero || numero || 'Não informado'}
                  </div>
                </div>

                <div>
                  <span className="text-blue-600 font-medium">Valor:</span>
                  <div className="font-mono font-bold text-blue-950">
                    {formatCurrencyBr(pendentePayload?.valor || parseCurrencyInput(valorInput))}
                  </div>
                </div>

                <div>
                  <span className="text-blue-600 font-medium">Vigência:</span>
                  <div className="text-slate-800">
                    {pendentePayload?.vigencia_inicio
                      ? formatDateBr(pendentePayload.vigencia_inicio)
                      : vigenciaInicio
                        ? formatDateBr(vigenciaInicio)
                        : '—'}{' '}
                    até{' '}
                    {pendentePayload?.vigencia_fim
                      ? formatDateBr(pendentePayload.vigencia_fim)
                      : vigenciaFim
                        ? formatDateBr(vigenciaFim)
                        : '—'}
                  </div>
                </div>

                {(pendentePayload?.objeto || objeto) && (
                  <div>
                    <span className="text-blue-600 font-medium">Objeto:</span>
                    <div className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border border-blue-200 line-clamp-3">
                      "{pendentePayload?.objeto || objeto}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleVerContratoExistente}
              className="text-slate-700 text-xs"
            >
              Ver Contrato Existente
            </Button>
            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicidadeModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmarDuplicidade}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Mesmo Assim'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
