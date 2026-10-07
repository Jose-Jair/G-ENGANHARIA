import React, { useState, useEffect } from 'react'
import { AreaAtuacaoRecord, SubservicoRecord, EntregavelPadraoRecord } from '@/types'
import {
  areasAtuacaoService,
  subservicosService,
  entregaveisPadraoService,
} from '@/services/areasAtuacao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  FileCheck,
  ListOrdered,
  Search,
  Loader2,
} from 'lucide-react'

export const GestaoAreasModalidades: React.FC = () => {
  const { toast } = useToast()
  const [activeSubTab, setActiveSubTab] = useState<'areas' | 'subservicos' | 'entregaveis'>('areas')

  // Listas
  const [areas, setAreas] = useState<AreaAtuacaoRecord[]>([])
  const [subservicos, setSubservicos] = useState<SubservicoRecord[]>([])
  const [entregaveis, setEntregaveis] = useState<EntregavelPadraoRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('todas')

  // Modal Área
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [editingArea, setEditingArea] = useState<AreaAtuacaoRecord | null>(null)
  const [areaForm, setAreaForm] = useState({
    nome: '',
    descricao: '',
    ordem: 1,
    ativo: true,
  })

  // Modal Subserviço
  const [showSubModal, setShowSubModal] = useState(false)
  const [editingSub, setEditingSub] = useState<SubservicoRecord | null>(null)
  const [subForm, setSubForm] = useState({
    area: '',
    nome: '',
    descricao: '',
    ativo: true,
  })

  // Modal Entregável Padrão
  const [showEntregavelModal, setShowEntregavelModal] = useState(false)
  const [editingEntregavel, setEditingEntregavel] = useState<EntregavelPadraoRecord | null>(null)
  const [entregavelForm, setEntregavelForm] = useState({
    area: '',
    subservico: '',
    nome: '',
    descricao: '',
    ordem: 1,
    ativo: true,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [areasData, subsData, entregaveisData] = await Promise.all([
        areasAtuacaoService.list(),
        subservicosService.list(),
        entregaveisPadraoService.list(),
      ])
      setAreas(areasData)
      setSubservicos(subsData)
      setEntregaveis(entregaveisData)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados de áreas e modalidades.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // --- HANDLERS ÁREA ---
  const handleOpenCreateArea = () => {
    setEditingArea(null)
    setAreaForm({
      nome: '',
      descricao: '',
      ordem: areas.length + 1,
      ativo: true,
    })
    setShowAreaModal(true)
  }

  const handleOpenEditArea = (a: AreaAtuacaoRecord) => {
    setEditingArea(a)
    setAreaForm({
      nome: a.nome,
      descricao: a.descricao || '',
      ordem: a.ordem ?? 1,
      ativo: a.ativo !== false,
    })
    setShowAreaModal(true)
  }

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingArea) {
        await areasAtuacaoService.update(editingArea.id, areaForm)
        toast({ title: 'Área atualizada', description: 'Dados salvos com sucesso.' })
      } else {
        await areasAtuacaoService.create(areaForm)
        toast({ title: 'Área criada', description: 'Nova área de atuação registrada.' })
      }
      setShowAreaModal(false)
      loadData()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar área',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    }
  }

  const handleToggleAreaAtiva = async (area: AreaAtuacaoRecord) => {
    try {
      await areasAtuacaoService.update(area.id, { ativo: !area.ativo })
      toast({
        title: 'Status atualizado',
        description: `Área ${area.ativo ? 'desativada' : 'ativada'} com sucesso.`,
      })
      loadData()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar status.',
      })
    }
  }

  // --- HANDLERS SUBSERVIÇO ---
  const handleOpenCreateSub = (defaultAreaId?: string) => {
    setEditingSub(null)
    setSubForm({
      area: defaultAreaId || (areas[0]?.id ?? ''),
      nome: '',
      descricao: '',
      ativo: true,
    })
    setShowSubModal(true)
  }

  const handleOpenEditSub = (s: SubservicoRecord) => {
    setEditingSub(s)
    setSubForm({
      area: s.area,
      nome: s.nome,
      descricao: s.descricao || '',
      ativo: s.ativo !== false,
    })
    setShowSubModal(true)
  }

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subForm.area) {
      toast({
        variant: 'destructive',
        title: 'Atenção',
        description: 'Selecione uma área de atuação.',
      })
      return
    }
    try {
      if (editingSub) {
        await subservicosService.update(editingSub.id, subForm)
        toast({ title: 'Subserviço atualizado', description: 'Alterações salvas com sucesso.' })
      } else {
        await subservicosService.create(subForm)
        toast({ title: 'Subserviço criado', description: 'Novo subserviço cadastrado.' })
      }
      setShowSubModal(false)
      loadData()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar subserviço',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    }
  }

  const handleToggleSubAtivo = async (sub: SubservicoRecord) => {
    try {
      await subservicosService.update(sub.id, { ativo: !sub.ativo })
      toast({
        title: 'Status atualizado',
        description: `Subserviço ${sub.ativo ? 'desativado' : 'ativado'} com sucesso.`,
      })
      loadData()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar status.',
      })
    }
  }

  // --- HANDLERS ENTREGÁVEIS PADRÃO ---
  const handleOpenCreateEntregavel = (defaultAreaId?: string) => {
    setEditingEntregavel(null)
    const areaId = defaultAreaId || (areas[0]?.id ?? '')
    const totalEntregaveisArea = entregaveis.filter((e) => e.area === areaId).length
    setEntregavelForm({
      area: areaId,
      subservico: '',
      nome: '',
      descricao: '',
      ordem: totalEntregaveisArea + 1,
      ativo: true,
    })
    setShowEntregavelModal(true)
  }

  const handleOpenEditEntregavel = (ent: EntregavelPadraoRecord) => {
    setEditingEntregavel(ent)
    setEntregavelForm({
      area: ent.area,
      subservico: ent.subservico || '',
      nome: ent.nome,
      descricao: ent.descricao || '',
      ordem: ent.ordem ?? 1,
      ativo: ent.ativo !== false,
    })
    setShowEntregavelModal(true)
  }

  const handleSaveEntregavel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entregavelForm.area) {
      toast({
        variant: 'destructive',
        title: 'Atenção',
        description: 'Selecione uma área de atuação.',
      })
      return
    }
    try {
      const payload: any = {
        area: entregavelForm.area,
        nome: entregavelForm.nome,
        descricao: entregavelForm.descricao,
        ordem: Number(entregavelForm.ordem) || 1,
        ativo: entregavelForm.ativo,
      }
      if (entregavelForm.subservico) {
        payload.subservico = entregavelForm.subservico
      } else {
        payload.subservico = null
      }

      if (editingEntregavel) {
        await entregaveisPadraoService.update(editingEntregavel.id, payload)
        toast({ title: 'Entregável atualizado', description: 'Dados salvos com sucesso.' })
      } else {
        await entregaveisPadraoService.create(payload)
        toast({ title: 'Entregável criado', description: 'Novo entregável padrão cadastrado.' })
      }
      setShowEntregavelModal(false)
      loadData()
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar entregável',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    }
  }

  const handleToggleEntregavelAtivo = async (ent: EntregavelPadraoRecord) => {
    try {
      await entregaveisPadraoService.update(ent.id, { ativo: !ent.ativo })
      toast({
        title: 'Status atualizado',
        description: `Entregável padrão ${ent.ativo ? 'desativado' : 'ativado'} com sucesso.`,
      })
      loadData()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar status.',
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              Áreas de Atuação & Entregáveis Padrão
            </CardTitle>
            <CardDescription className="text-xs">
              Configuração central das 9 áreas técnicas de engenharia, seus subserviços específicos
              e entregáveis recomendados para propostas e projetos.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {activeSubTab === 'areas' && (
              <Button
                onClick={handleOpenCreateArea}
                className="bg-orange-600 hover:bg-orange-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Área
              </Button>
            )}
            {activeSubTab === 'subservicos' && (
              <Button
                onClick={() =>
                  handleOpenCreateSub(
                    selectedAreaFilter !== 'todas' ? selectedAreaFilter : undefined,
                  )
                }
                className="bg-orange-600 hover:bg-orange-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Subserviço
              </Button>
            )}
            {activeSubTab === 'entregaveis' && (
              <Button
                onClick={() =>
                  handleOpenCreateEntregavel(
                    selectedAreaFilter !== 'todas' ? selectedAreaFilter : undefined,
                  )
                }
                className="bg-orange-600 hover:bg-orange-700 text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Entregável Padrão
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <Tabs
            value={activeSubTab}
            onValueChange={(v) => setActiveSubTab(v as any)}
            className="w-full"
          >
            <TabsList className="bg-slate-100 p-1 mb-4">
              <TabsTrigger value="areas" className="text-xs gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Áreas de Atuação ({areas.length})
              </TabsTrigger>
              <TabsTrigger value="subservicos" className="text-xs gap-1.5">
                <ListOrdered className="w-3.5 h-3.5" />
                Subserviços ({subservicos.length})
              </TabsTrigger>
              <TabsTrigger value="entregaveis" className="text-xs gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                Entregáveis Padrão ({entregaveis.length})
              </TabsTrigger>
            </TabsList>

            {/* FILTROS COMUNS */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar por nome..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              {activeSubTab !== 'areas' && (
                <div className="w-full sm:w-72">
                  <Select
                    value={selectedAreaFilter}
                    onValueChange={(val) => setSelectedAreaFilter(val)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Filtrar por Área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Áreas de Atuação</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.ordem ? `${a.ordem}. ` : ''}
                          {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* CONTEÚDO 1: ÁREAS */}
            <TabsContent value="areas" className="m-0">
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">Ordem</th>
                      <th className="py-2.5 px-3">Nome da Área de Atuação</th>
                      <th className="py-2.5 px-3">Subserviços Cadastrados</th>
                      <th className="py-2.5 px-3">Entregáveis Padrão</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-600" />
                          Carregando áreas de atuação...
                        </td>
                      </tr>
                    ) : areas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Nenhuma área de atuação encontrada.
                        </td>
                      </tr>
                    ) : (
                      areas
                        .filter((a) => a.nome.toLowerCase().includes(searchFilter.toLowerCase()))
                        .map((area) => {
                          const totalSubs = subservicos.filter((s) => s.area === area.id).length
                          const totalEnts = entregaveis.filter((e) => e.area === area.id).length
                          return (
                            <tr key={area.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                                {area.ordem ?? '-'}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{area.nome}</div>
                                {area.descricao && (
                                  <div className="text-[11px] text-slate-500 line-clamp-1">
                                    {area.descricao}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="secondary" className="text-[11px] font-mono">
                                  {totalSubs} subserviço(s)
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className="text-[11px] font-mono">
                                  {totalEnts} padrão
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAreaAtiva(area)}
                                  className="inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {area.ativo ? (
                                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{' '}
                                      Ativa
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Inativa</span>
                                  )}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditArea(area)}
                                  className="h-7 text-xs text-orange-600 hover:text-orange-800"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  Editar
                                </Button>
                              </td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* CONTEÚDO 2: SUBSERVIÇOS */}
            <TabsContent value="subservicos" className="m-0">
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Área de Atuação</th>
                      <th className="py-2.5 px-3">Nome do Subserviço</th>
                      <th className="py-2.5 px-3">Descrição Técnica</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {subservicos
                      .filter((s) => {
                        const matchSearch = s.nome
                          .toLowerCase()
                          .includes(searchFilter.toLowerCase())
                        const matchArea =
                          selectedAreaFilter === 'todas' || s.area === selectedAreaFilter
                        return matchSearch && matchArea
                      })
                      .map((sub) => {
                        const areaObj = areas.find((a) => a.id === sub.area)
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className="text-[11px] bg-orange-50 border-orange-200 text-orange-800"
                              >
                                {areaObj?.nome || 'Área não definida'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{sub.nome}</td>
                            <td className="py-2.5 px-3 text-slate-600">{sub.descricao || '-'}</td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => handleToggleSubAtivo(sub)}
                                className="cursor-pointer"
                              >
                                {sub.ativo ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativo
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium">Inativo</span>
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditSub(sub)}
                                className="h-7 text-xs text-orange-600 hover:text-orange-800"
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* CONTEÚDO 3: ENTREGÁVEIS PADRÃO */}
            <TabsContent value="entregaveis" className="m-0">
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">Ordem</th>
                      <th className="py-2.5 px-3">Área de Atuação</th>
                      <th className="py-2.5 px-3">Subserviço Específico</th>
                      <th className="py-2.5 px-3">Nome do Entregável Padrão</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {entregaveis
                      .filter((e) => {
                        const matchSearch = e.nome
                          .toLowerCase()
                          .includes(searchFilter.toLowerCase())
                        const matchArea =
                          selectedAreaFilter === 'todas' || e.area === selectedAreaFilter
                        return matchSearch && matchArea
                      })
                      .map((ent) => {
                        const areaObj = areas.find((a) => a.id === ent.area)
                        const subObj = subservicos.find((s) => s.id === ent.subservico)
                        return (
                          <tr key={ent.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {ent.ordem ?? '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className="text-[11px] bg-orange-50 border-orange-200 text-orange-800"
                              >
                                {areaObj?.nome || 'Área geral'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              {subObj ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {subObj.nome}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Vale para toda a área
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{ent.nome}</td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => handleToggleEntregavelAtivo(ent)}
                                className="cursor-pointer"
                              >
                                {ent.ativo ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativo
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium">Inativo</span>
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditEntregavel(ent)}
                                className="h-7 text-xs text-orange-600 hover:text-orange-800"
                              >
                                <Edit2 className="w-3.5 h-3.5 mr-1" />
                                Editar
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* MODAL ÁREA DE ATUAÇÃO */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingArea ? 'Editar Área de Atuação' : 'Nova Área de Atuação'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Áreas de especialidade da engenharia para categorização de serviços, propostas e
              etapas de projeto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveArea} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Área de Atuação</Label>
              <Input
                required
                value={areaForm.nome}
                onChange={(e) => setAreaForm({ ...areaForm, nome: e.target.value })}
                placeholder="Ex: Projetos de estruturas de concreto armado"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ordem de Exibição</Label>
              <Input
                type="number"
                min="1"
                value={areaForm.ordem}
                onChange={(e) => setAreaForm({ ...areaForm, ordem: parseInt(e.target.value) || 1 })}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição Técnica</Label>
              <Textarea
                rows={3}
                value={areaForm.descricao}
                onChange={(e) => setAreaForm({ ...areaForm, descricao: e.target.value })}
                placeholder="Escopo técnico coberto por esta área de atuação..."
                className="text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="areaAtivaSwitch"
                checked={areaForm.ativo}
                onCheckedChange={(c) => setAreaForm({ ...areaForm, ativo: c })}
              />
              <Label htmlFor="areaAtivaSwitch" className="text-xs cursor-pointer">
                Área Ativa para propostas e projetos
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAreaModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-orange-600 hover:bg-orange-700">
                Salvar Área
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL SUBSERVIÇO */}
      <Dialog open={showSubModal} onOpenChange={setShowSubModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Editar Subserviço' : 'Novo Subserviço'}</DialogTitle>
            <DialogDescription className="text-xs">
              Especialidades e subitens técnicos vinculados a uma área de atuação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSub} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Área de Atuação Vinculada</Label>
              <Select
                value={subForm.area}
                onValueChange={(val) => setSubForm({ ...subForm, area: val })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome do Subserviço</Label>
              <Input
                required
                value={subForm.nome}
                onChange={(e) => setSubForm({ ...subForm, nome: e.target.value })}
                placeholder="Ex: Verificação/reforço estrutural"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição / Detalhes</Label>
              <Textarea
                rows={2}
                value={subForm.descricao}
                onChange={(e) => setSubForm({ ...subForm, descricao: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="subAtivoSwitch"
                checked={subForm.ativo}
                onCheckedChange={(c) => setSubForm({ ...subForm, ativo: c })}
              />
              <Label htmlFor="subAtivoSwitch" className="text-xs cursor-pointer">
                Subserviço Ativo
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSubModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-orange-600 hover:bg-orange-700">
                Salvar Subserviço
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL ENTREGÁVEL PADRÃO */}
      <Dialog open={showEntregavelModal} onOpenChange={setShowEntregavelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntregavel ? 'Editar Entregável Padrão' : 'Novo Entregável Padrão'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Entregável técnico sugerido automaticamente ao orçar serviços desta área ou
              subserviço.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEntregavel} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Área de Atuação</Label>
              <Select
                value={entregavelForm.area}
                onValueChange={(val) =>
                  setEntregavelForm({ ...entregavelForm, area: val, subservico: '' })
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Subserviço Específico (Opcional)</Label>
              <Select
                value={entregavelForm.subservico || 'area_toda'}
                onValueChange={(val) =>
                  setEntregavelForm({
                    ...entregavelForm,
                    subservico: val === 'area_toda' ? '' : val,
                  })
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Vale para a área toda ou selecione subserviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area_toda">Vale para toda a área</SelectItem>
                  {subservicos
                    .filter((s) => s.area === entregavelForm.area)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome do Entregável Padrão</Label>
              <Input
                required
                value={entregavelForm.nome}
                onChange={(e) => setEntregavelForm({ ...entregavelForm, nome: e.target.value })}
                placeholder="Ex: Memorial de cálculo, Modelo BIM IFC, ART..."
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ordem de Exibição</Label>
              <Input
                type="number"
                min="1"
                value={entregavelForm.ordem}
                onChange={(e) =>
                  setEntregavelForm({
                    ...entregavelForm,
                    ordem: parseInt(e.target.value) || 1,
                  })
                }
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="entregavelAtivoSwitch"
                checked={entregavelForm.ativo}
                onCheckedChange={(c) => setEntregavelForm({ ...entregavelForm, ativo: c })}
              />
              <Label htmlFor="entregavelAtivoSwitch" className="text-xs cursor-pointer">
                Entregável Padrão Ativo
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEntregavelModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-orange-600 hover:bg-orange-700">
                Salvar Entregável
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
