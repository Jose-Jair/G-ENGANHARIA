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

  // Campos suprimidos do formulário mantidos internamente para preservação em edição
  const [numero, setNumero] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [saldo, setSaldo] = useState<number | ''>('')
  const [vigenciaInicio, setVigenciaInicio] = useState('')
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [linkEdital, setLinkEdital] = useState('')

  const openCreateModal = () => {
    setEditingContrato(null)
    setOrgao('')
    setObjeto('')
    setValorInput('')
    setSituacao('Em Execução')
    setFonte('')
    // Defaults para campos suprimidos do formulário
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
    // Se não tiver número de contrato (campo suprimido), gera um identificador padrão único e limpo
    const numeroFinal =
      numero.trim() || editingContrato?.numero || `CT-${Date.now().toString().slice(-6)}`

    setLoading(true)
    try {
      const payload = {
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

      if (editingContrato) {
        await contratosService.update(editingContrato.id, payload)
        toast({
          title: 'Contrato atualizado',
          description: `Contrato salvo com sucesso (${formatCurrencyBr(valorNumerico)}).`,
        })
      } else {
        await contratosService.create(payload)
        toast({
          title: 'Contrato lançado',
          description: `Novo contrato adicionado à empresa com sucesso (${formatCurrencyBr(valorNumerico)}).`,
        })
      }
      setModalOpen(false)
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
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.orgao}</span>
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
                      {c.fonte && (
                        <span className="text-[11px] text-slate-400">Fonte: {c.fonte}</span>
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
    </div>
  )
}
