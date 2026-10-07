import React, { useState, useEffect } from 'react'
import { PropostaRecord, PropostaItemRecord, ProjetoRecord, AreaAtuacaoRecord } from '@/types'
import {
  conversaoProjetoPacoteService,
  ItemAgrupadoPorArea,
  ResultadoConversaoProjetoPacote,
} from '@/services/conversaoProjetoPacote'
import { propostasService } from '@/services/propostas'
import { areasAtuacaoService } from '@/services/areasAtuacao'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  Briefcase,
  Layers,
  FolderPlus,
  GitMerge,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
} from 'lucide-react'

interface ModalConversaoProjetoPacoteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord
  currentUserId?: string
  currentUserEmail?: string
  onConversaoSucesso?: (resultado: ResultadoConversaoProjetoPacote) => void
}

export const ModalConversaoProjetoPacote: React.FC<ModalConversaoProjetoPacoteProps> = ({
  open,
  onOpenChange,
  proposta,
  currentUserId,
  currentUserEmail,
  onConversaoSucesso,
}) => {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Itens da proposta
  const [itens, setItens] = useState<PropostaItemRecord[]>([])
  const [areas, setAreas] = useState<AreaAtuacaoRecord[]>([])
  const [projetosExistentes, setProjetosExistentes] = useState<ProjetoRecord[]>([])

  // Seleção de itens a converter
  const [selectedItensIds, setSelectedItensIds] = useState<string[]>([])

  // Decisão: Incorporar vs Novo Projeto
  const [modoProjeto, setModoProjeto] = useState<'incorporar' | 'novo'>('incorporar')
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('')
  const [nomeNovoProjeto, setNomeNovoProjeto] = useState<string>('')

  // Grupos calculados por área
  const [gruposPorArea, setGruposPorArea] = useState<ItemAgrupadoPorArea[]>([])

  const loadDados = async () => {
    setLoading(true)
    try {
      const [itensData, areasData, prjsData] = await Promise.all([
        propostasService.listItens(proposta.id),
        areasAtuacaoService.list(),
        conversaoProjetoPacoteService.listProjetosDaProposta(proposta.id),
      ])

      // Fallback: se não tiver itens em proposta_itens mas houver itens_json, sincronizar
      let itensFinais = itensData
      if (itensData.length === 0 && proposta.itens_json && proposta.itens_json.length > 0) {
        // Criar os registros em proposta_itens
        for (const jItem of proposta.itens_json) {
          try {
            await pbCreateFallback(proposta.id, jItem)
          } catch {
            /* intentionally ignored */
          }
        }
        itensFinais = await propostasService.listItens(proposta.id)
      }

      setItens(itensFinais)
      setAreas(areasData)
      setProjetosExistentes(prjsData)

      // Por padrão, selecionar todos os itens NÃO CONVERTIDOS
      const naoConvertidos = itensFinais.filter((i) => i.status_conversao !== 'convertido')
      const idsNaoConvertidos = (naoConvertidos.length > 0 ? naoConvertidos : itensFinais).map(
        (i) => i.id || '',
      )
      setSelectedItensIds(idsNaoConvertidos)

      // Modo de projeto sugerido
      if (prjsData.length > 0) {
        setModoProjeto('incorporar')
        setSelectedProjetoId(prjsData[0].id)
      } else {
        setModoProjeto('novo')
      }

      setNomeNovoProjeto(
        `Pacote Técnico: ${proposta.numero} - ${
          proposta.expand?.empresa?.razao_social ||
          proposta.expand?.cliente_pf?.nome ||
          'Engenharia G+'
        }`,
      )
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os itens da proposta.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Fallback auxiliar se necessário
  const pbCreateFallback = async (propId: string, it: any) => {
    return propostasService.update(propId, {
      itens_json: proposta.itens_json,
    })
  }

  useEffect(() => {
    if (open) {
      loadDados()
    }
  }, [open, proposta.id])

  // Recalcular agrupamento por área quando a seleção de itens mudar
  useEffect(() => {
    const itensSelecionados = itens.filter((i) => selectedItensIds.includes(i.id || ''))
    conversaoProjetoPacoteService
      .agruparItensPorArea(itensSelecionados, areas)
      .then((grupos) => setGruposPorArea(grupos))
  }, [selectedItensIds, itens, areas])

  // Alternar seleção de item
  const handleToggleItem = (itemId: string) => {
    if (selectedItensIds.includes(itemId)) {
      setSelectedItensIds(selectedItensIds.filter((id) => id !== itemId))
    } else {
      setSelectedItensIds([...selectedItensIds, itemId])
    }
  }

  const handleSelectAll = (selecionar: boolean) => {
    if (selecionar) {
      setSelectedItensIds(itens.map((i) => i.id || ''))
    } else {
      setSelectedItensIds([])
    }
  }

  const itensJaConvertidos = itens.filter((i) => i.status_conversao === 'convertido')
  const totalSelecionados = selectedItensIds.length
  const valorTotalSelecionado = itens
    .filter((i) => selectedItensIds.includes(i.id || ''))
    .reduce((acc, it) => acc + (Number(it.preco_total) || 0), 0)

  const isConversaoParcial = totalSelecionados < itens.length

  const handleExecutarConversao = async () => {
    if (selectedItensIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum item selecionado',
        description: 'Selecione ao menos um item de serviço para converter.',
      })
      return
    }

    if (modoProjeto === 'incorporar' && !selectedProjetoId) {
      toast({
        variant: 'destructive',
        title: 'Selecione o projeto',
        description: 'Escolha qual projeto existente receberá as novas etapas.',
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await conversaoProjetoPacoteService.converterItensEmProjetoPacote({
        proposta,
        itensSelecionadosIds: selectedItensIds,
        modoProjeto,
        projetoExistenteId: selectedProjetoId || undefined,
        nomeProjeto: nomeNovoProjeto,
        usuarioId: currentUserId,
        usuarioEmail: currentUserEmail,
      })

      toast({
        title: 'Conversão em Projeto-Pacote concluída!',
        description: `${res.etapasCriadas.length} etapa(s) gerada(s) por área técnica no projeto ${res.projeto.codigo}.`,
      })

      if (onConversaoSucesso) {
        onConversaoSucesso(res)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro na conversão',
        description: err instanceof Error ? err.message : 'Falha ao processar conversão.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                Conversão em PROJETO-PACOTE
              </DialogTitle>
              <DialogDescription className="text-xs">
                Transforme os serviços aceitos em um projeto de engenharia com etapas estruturadas
                por Área de Atuação e entregáveis técnicos sugeridos.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {proposta.numero}
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-600" />
            Carregando itens da proposta e áreas técnicas...
          </div>
        ) : (
          <div className="space-y-5 pt-2 text-xs">
            {/* 1. SELEÇÃO DE ITENS (CONVERSÃO TOTAL OU PARCIAL) */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-orange-600" />
                    1. Itens da Proposta a Converter
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Selecione todos os itens para conversão total, ou apenas parte do escopo
                    (conversão parcial).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                    className="h-6 text-[11px]"
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                    className="h-6 text-[11px]"
                  >
                    Desmarcar
                  </Button>
                </div>
              </div>

              {/* LISTA DE ITENS */}
              <div className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
                {itens.map((it) => {
                  const checked = selectedItensIds.includes(it.id || '')
                  const jaConvertido = it.status_conversao === 'convertido'
                  const areaObj = areas.find((a) => a.id === it.area)

                  return (
                    <div
                      key={it.id || it.descricao}
                      onClick={() => handleToggleItem(it.id || '')}
                      className={`p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                        checked ? 'bg-orange-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => handleToggleItem(it.id || '')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            {it.descricao}
                            {jaConvertido && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Já Convertido em Projeto
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                            {areaObj ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-orange-50 border-orange-200 text-orange-800"
                              >
                                {areaObj.nome}
                              </Badge>
                            ) : (
                              <span className="italic text-slate-400">Área geral</span>
                            )}

                            {it.subservicos && it.subservicos.length > 0 && (
                              <span className="text-slate-600">
                                • Subs: {it.subservicos.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-semibold text-slate-900 block">
                          {formatCurrencyBr(it.preco_total || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {it.quantidade} {it.unidade}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* RESUMO DA SELEÇÃO */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-600">
                  {totalSelecionados} de {itens.length} item(ns) selecionado(s)
                  {isConversaoParcial && (
                    <strong className="text-amber-700 ml-1.5">(Conversão Parcial)</strong>
                  )}
                </span>
                <span className="font-semibold text-slate-900">
                  Total Selecionado:{' '}
                  <strong className="text-orange-700 font-mono text-sm ml-1">
                    {formatCurrencyBr(valorTotalSelecionado)}
                  </strong>
                </span>
              </div>
            </div>

            {/* 2. ETAPAS QUE SERÃO GERADAS (AGRUPADAS POR ÁREA DE ATUAÇÃO) */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  2. Etapas e Entregáveis que Serão Criados por Área Técnica
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {gruposPorArea.length} etapa(s) prevista(s)
                </Badge>
              </div>

              {gruposPorArea.length === 0 ? (
                <p className="text-slate-400 italic py-2">
                  Nenhum item selecionado. Marque os itens acima para visualizar as etapas.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gruposPorArea.map((g, idx) => (
                    <div
                      key={g.areaId}
                      className="p-3 rounded border border-slate-200 bg-slate-50/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {g.areaNome}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] text-emerald-800">
                          {formatCurrencyBr(g.valorTotal)}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-600">
                        <strong>Subserviços:</strong>{' '}
                        {g.subservicos.length > 0
                          ? g.subservicos.join(', ')
                          : 'Geral da disciplina'}
                      </div>

                      <div className="text-[11px] text-slate-600">
                        <strong className="block text-slate-700 mb-0.5">
                          Entregáveis Padrão da Etapa:
                        </strong>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {g.entregaveisSugeridos.slice(0, 4).map((ent, eIdx) => (
                            <li key={eIdx} className="truncate">
                              {ent}
                            </li>
                          ))}
                          {g.entregaveisSugeridos.length > 4 && (
                            <li className="text-slate-400 italic">
                              + {g.entregaveisSugeridos.length - 4} outro(s)
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. DESTINO DO PROJETO: INCORPORAR AO PACOTE EXISTENTE OU GERAR NOVO PROJETO */}
            <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/40 space-y-3">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <GitMerge className="w-4 h-4 text-orange-600" />
                3. Destino das Novas Etapas Técnicas
              </span>

              {projetosExistentes.length > 0 ? (
                <RadioGroup
                  value={modoProjeto}
                  onValueChange={(v) => setModoProjeto(v as any)}
                  className="space-y-2 pt-1"
                >
                  {/* OPÇÃO 1: INCORPORAR (RECOMENDADO) */}
                  <div
                    className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer ${
                      modoProjeto === 'incorporar'
                        ? 'bg-white border-orange-400 shadow-sm'
                        : 'bg-white/60 border-slate-200'
                    }`}
                    onClick={() => setModoProjeto('incorporar')}
                  >
                    <RadioGroupItem value="incorporar" id="optIncorporar" className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor="optIncorporar"
                        className="font-semibold text-slate-900 cursor-pointer flex items-center gap-1.5"
                      >
                        Incorporar ao Projeto-Pacote Existente (Recomendado)
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 text-[10px]"
                        >
                          Padrão G+
                        </Badge>
                      </Label>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        As novas etapas por área serão adicionadas ao projeto já em andamento desta
                        proposta, mantendo a rastreabilidade unificada.
                      </p>

                      {modoProjeto === 'incorporar' && (
                        <div className="mt-2.5 space-y-1">
                          <Label className="text-[11px] font-medium text-slate-700">
                            Selecione o Projeto de Destino:
                          </Label>
                          <select
                            value={selectedProjetoId}
                            onChange={(e) => setSelectedProjetoId(e.target.value)}
                            className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800"
                          >
                            {projetosExistentes.map((prj) => (
                              <option key={prj.id} value={prj.id}>
                                {prj.codigo} - {prj.nome} (Atual:{' '}
                                {formatCurrencyBr(prj.valor_total)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OPÇÃO 2: NOVO PROJETO INDEPENDENTE */}
                  <div
                    className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer ${
                      modoProjeto === 'novo'
                        ? 'bg-white border-orange-400 shadow-sm'
                        : 'bg-white/60 border-slate-200'
                    }`}
                    onClick={() => setModoProjeto('novo')}
                  >
                    <RadioGroupItem value="novo" id="optNovo" className="mt-0.5" />
                    <div className="flex-1">
                      <Label
                        htmlFor="optNovo"
                        className="font-semibold text-slate-900 cursor-pointer"
                      >
                        Gerar um NOVO Projeto Independente (PRJ-AAAA-NNNN)
                      </Label>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Cria um novo projeto com numeração sequencial própria anual vinculado à
                        mesma proposta.
                      </p>

                      {modoProjeto === 'novo' && (
                        <div className="mt-2.5 space-y-1">
                          <Label className="text-[11px] font-medium text-slate-700">
                            Título do Novo Projeto:
                          </Label>
                          <Input
                            value={nomeNovoProjeto}
                            onChange={(e) => setNomeNovoProjeto(e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-600">
                    Nenhum projeto vinculado ainda. Será criado um novo projeto com código
                    sequencial <strong>PRJ-AAAA-NNNN</strong>:
                  </p>
                  <Input
                    value={nomeNovoProjeto}
                    onChange={(e) => setNomeNovoProjeto(e.target.value)}
                    placeholder="Título do Projeto-Pacote..."
                    className="text-xs h-8 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleExecutarConversao}
            disabled={submitting || selectedItensIds.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {modoProjeto === 'incorporar' && projetosExistentes.length > 0
              ? 'Incorporar Etapas ao Projeto'
              : 'Gerar Projeto-Pacote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
