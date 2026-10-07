import React, { useState, useEffect } from 'react'
import {
  AreaAtuacaoRecord,
  SubservicoRecord,
  EntregavelPadraoRecord,
  CatalogoServicoRecord,
  PropostaItemRecord,
} from '@/types'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrencyBr } from '@/lib/formatters'
import { Layers, Plus, Check } from 'lucide-react'

interface ModalItemPropostaCascataProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: AreaAtuacaoRecord[]
  subservicos: SubservicoRecord[]
  entregaveisPadrao: EntregavelPadraoRecord[]
  catalogoServicos: CatalogoServicoRecord[]
  onItemConfirmado: (item: PropostaItemRecord, entregaveisSugeridos: string[]) => void
}

export const ModalItemPropostaCascata: React.FC<ModalItemPropostaCascataProps> = ({
  open,
  onOpenChange,
  areas,
  subservicos,
  entregaveisPadrao,
  catalogoServicos,
  onItemConfirmado,
}) => {
  // Cascata
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [selectedServicoId, setSelectedServicoId] = useState<string>('')
  const [selectedSubservicoIds, setSelectedSubservicoIds] = useState<string[]>([])
  const [selectedEntregaveis, setSelectedEntregaveis] = useState<string[]>([])

  // Campos de Orçamento do Item
  const [descricao, setDescricao] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [quantidade, setQuantidade] = useState<number>(1)
  const [custoUnitario, setCustoUnitario] = useState<number>(0)
  const [bdiPercent, setBdiPercent] = useState<number>(25)

  // Ao abrir ou trocar de área
  useEffect(() => {
    if (open) {
      if (!selectedAreaId && areas.length > 0) {
        setSelectedAreaId(areas[0].id)
      }
    }
  }, [open, areas, selectedAreaId])

  // Filtrar serviços por Área selecionada
  const servicosDaArea = catalogoServicos.filter(
    (s) => s.area === selectedAreaId || (!s.area && selectedAreaId === areas[0]?.id),
  )

  // Subserviços da Área selecionada
  const subservicosDaArea = subservicos.filter((s) => s.area === selectedAreaId && s.ativo)

  // Entregáveis sugeridos para a Área
  const entregaveisSugeridosDisponiveis = entregaveisPadrao.filter(
    (e) =>
      e.area === selectedAreaId &&
      e.ativo &&
      (!e.subservico || selectedSubservicoIds.includes(e.subservico)),
  )

  // Quando seleciona um serviço do catálogo
  const handleSelectServico = (servicoId: string) => {
    setSelectedServicoId(servicoId)
    const serv = catalogoServicos.find((s) => s.id === servicoId)
    if (serv) {
      setDescricao(serv.nome)
      setDisciplina(serv.disciplina)
      setUnidade(serv.unidade)
      setCustoUnitario(serv.preco_base)
    }
  }

  // Alternar subserviço marcado
  const handleToggleSubservico = (subId: string) => {
    if (selectedSubservicoIds.includes(subId)) {
      setSelectedSubservicoIds(selectedSubservicoIds.filter((id) => id !== subId))
    } else {
      const novos = [...selectedSubservicoIds, subId]
      setSelectedSubservicoIds(novos)

      // Adicionar entregáveis padrão vinculados a este subserviço automaticamente
      const entsDoSub = entregaveisPadrao
        .filter((e) => e.subservico === subId && e.ativo)
        .map((e) => e.nome)
      const uniao = Array.from(new Set([...selectedEntregaveis, ...entsDoSub]))
      setSelectedEntregaveis(uniao)
    }
  }

  // Quando muda a área de atuação
  const handleAreaChange = (novaAreaId: string) => {
    setSelectedAreaId(novaAreaId)
    setSelectedServicoId('')
    setSelectedSubservicoIds([])

    // Carregar entregáveis gerais da nova área
    const entsAreaGeral = entregaveisPadrao
      .filter((e) => e.area === novaAreaId && !e.subservico && e.ativo)
      .map((e) => e.nome)
    setSelectedEntregaveis(entsAreaGeral)

    // Ajustar descrição inicial
    const servs = catalogoServicos.filter((s) => s.area === novaAreaId)
    if (servs.length > 0) {
      handleSelectServico(servs[0].id)
    } else {
      const areaObj = areas.find((a) => a.id === novaAreaId)
      setDescricao(areaObj ? `Serviço de ${areaObj.nome}` : 'Serviço de Engenharia')
      setDisciplina('Engenharia')
      setCustoUnitario(5000)
    }
  }

  // Alternar entregável sugerido
  const handleToggleEntregavel = (entNome: string) => {
    if (selectedEntregaveis.includes(entNome)) {
      setSelectedEntregaveis(selectedEntregaveis.filter((n) => n !== entNome))
    } else {
      setSelectedEntregaveis([...selectedEntregaveis, entNome])
    }
  }

  const custoTotal = Math.round(quantidade * custoUnitario * 100) / 100
  const precoTotalItem = Math.round(custoTotal * (1 + bdiPercent / 100) * 100) / 100

  const handleConfirmar = () => {
    if (!descricao.trim()) return

    const nomesSubservicos = subservicos
      .filter((s) => selectedSubservicoIds.includes(s.id))
      .map((s) => s.nome)

    const item: PropostaItemRecord = {
      area: selectedAreaId,
      servico: selectedServicoId || undefined,
      descricao: descricao.trim(),
      disciplina: disciplina.trim() || undefined,
      unidade: unidade.trim() || 'un',
      quantidade: quantidade > 0 ? quantidade : 1,
      custo_unitario: custoUnitario,
      custo_total: custoTotal,
      bdi_percentual: bdiPercent,
      preco_total: precoTotalItem,
      subservicos: nomesSubservicos,
      status_conversao: 'nao_convertido',
    }

    onItemConfirmado(item, selectedEntregaveis)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-600" />
            Adicionar Item de Proposta por Área de Atuação
          </DialogTitle>
          <DialogDescription className="text-xs">
            Seleção guiada: Área de Atuação → Serviço do Catálogo → Subserviços específicos e
            Entregáveis técnicos sugeridos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* PASSO 1: ÁREA DE ATUAÇÃO */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              1. Área de Atuação (Especialidade Técnica) *
            </Label>
            <Select value={selectedAreaId} onValueChange={handleAreaChange}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Selecione a área técnica..." />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.ordem ? `${a.ordem}. ` : ''}
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PASSO 2: SERVIÇO DO CATÁLOGO OU DESCRIÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">
                2. Serviço de Referência do Catálogo
              </Label>
              <Select value={selectedServicoId} onValueChange={handleSelectServico}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue
                    placeholder={
                      servicosDaArea.length > 0
                        ? 'Selecione do catálogo...'
                        : 'Nenhum pré-cadastrado nesta área'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {servicosDaArea.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} ({formatCurrencyBr(s.preco_base)}/{s.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Disciplina Técnica</Label>
              <Input
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                placeholder="Ex: Estruturas, Instalações, etc."
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">
              Descrição do Serviço na Proposta *
            </Label>
            <Input
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Projeto Executivo de Estruturas em Concreto Armado"
              className="text-xs h-9"
            />
          </div>

          {/* PASSO 3: SUBSERVIÇOS (MÚLTIPLA ESCOLHA) */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-800">
                3. Subserviços Específicos Abrangidos (Múltipla Seleção)
              </Label>
              <span className="text-[11px] text-slate-500 font-mono">
                {selectedSubservicoIds.length} selecionado(s)
              </span>
            </div>

            {subservicosDaArea.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                Nenhum subserviço específico cadastrado para esta área.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {subservicosDaArea.map((sub) => {
                  const checked = selectedSubservicoIds.includes(sub.id)
                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleSubservico(sub.id)}
                      className={`flex items-start space-x-2 p-2 rounded cursor-pointer border text-xs transition-colors ${
                        checked
                          ? 'bg-orange-50/80 border-orange-300 text-orange-950 font-medium'
                          : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggleSubservico(sub.id)}
                        className="mt-0.5"
                      />
                      <div className="leading-tight">
                        <span>{sub.nome}</span>
                        {sub.descricao && (
                          <div className="text-[10px] text-slate-400 font-normal line-clamp-1">
                            {sub.descricao}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* PASSO 4: ENTREGÁVEIS TÉCNICOS SUGERIDOS */}
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-emerald-950">
                4. Entregáveis Técnicos Sugeridos (Incorporados à Proposta)
              </Label>
              <Badge variant="outline" className="text-[10px] bg-emerald-100/60 text-emerald-800">
                {selectedEntregaveis.length} incluído(s)
              </Badge>
            </div>

            <p className="text-[11px] text-slate-600">
              Marcados por padrão com base na Área e Subserviços escolhidos. Eles alimentarão as
              etapas do Projeto-Pacote após a conversão.
            </p>

            {entregaveisSugeridosDisponiveis.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                Nenhum entregável padrão configurado para esta área.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {entregaveisSugeridosDisponiveis.map((ent) => {
                  const checked = selectedEntregaveis.includes(ent.nome)
                  return (
                    <div
                      key={ent.id}
                      onClick={() => handleToggleEntregavel(ent.nome)}
                      className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer border text-xs transition-colors ${
                        checked
                          ? 'bg-white border-emerald-400 text-emerald-950 font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggleEntregavel(ent.nome)}
                      />
                      <span className="truncate">{ent.nome}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* PASSO 5: QUANTIDADE, UNIDADE, CUSTO E BDI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Unidade</Label>
              <Input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex: m², un"
                className="text-xs h-8 text-center"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Quantidade</Label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={quantidade}
                onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                className="text-xs h-8 font-mono text-center"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">Custo Direto (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={custoUnitario}
                onChange={(e) => setCustoUnitario(parseFloat(e.target.value) || 0)}
                className="text-xs h-8 font-mono text-right"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600">BDI Sugerido (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={bdiPercent}
                onChange={(e) => setBdiPercent(parseFloat(e.target.value) || 0)}
                className="text-xs h-8 font-mono text-center"
              />
            </div>

            <div className="col-span-2 sm:col-span-4 flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-600 text-[11px]">
                Custo Total Direto:{' '}
                <strong className="font-mono text-slate-900">{formatCurrencyBr(custoTotal)}</strong>
              </span>
              <span className="text-emerald-700 text-xs font-semibold">
                Preço c/ BDI:{' '}
                <strong className="font-mono text-sm">{formatCurrencyBr(precoTotalItem)}</strong>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
          >
            <Check className="w-4 h-4" />
            Adicionar Item à Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
