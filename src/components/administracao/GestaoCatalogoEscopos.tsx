import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  ListChecks,
  FileCheck,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { catalogoEscoposService } from '@/services/cadeiaContratosProjetos'
import { CatalogoEscopoRecord } from '@/types'

export const GestaoCatalogoEscopos: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [escopos, setEscopos] = useState<CatalogoEscopoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  // Modal de criação / edição
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [escopoEditando, setEscopoEditando] = useState<CatalogoEscopoRecord | null>(null)

  // Formulário
  const [formDisciplina, setFormDisciplina] = useState('')
  const [formNome, setFormNome] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)

  // Entregáveis padrão no form
  const [entregaveis, setEntregaveis] = useState<
    Array<{ nome: string; descricao: string; ordem: number }>
  >([])
  const [novoEntNome, setNovoEntNome] = useState('')
  const [novoEntDesc, setNovoEntDesc] = useState('')

  // Checklist de revisão no form
  const [checklist, setChecklist] = useState<Array<{ item: string; obrigatorio: boolean }>>([])
  const [novoCheckItem, setNovoCheckItem] = useState('')
  const [novoCheckObrigatorio, setNovoCheckObrigatorio] = useState(true)

  const podeEditar = user?.role === 'admin' || user?.role === 'gestor'

  const carregarEscopos = async () => {
    try {
      setLoading(true)
      const data = await catalogoEscoposService.list()
      setEscopos(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Catálogo de Escopos',
        description: err.message || 'Falha ao buscar dados no servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarEscopos()
  }, [])

  const abrirModalCriar = () => {
    setEscopoEditando(null)
    setFormDisciplina('')
    setFormNome('')
    setFormAtivo(true)
    setEntregaveis([
      {
        nome: 'Memorial Descritivo e Justificativo',
        descricao: 'Memoriais de cálculo e critérios técnicos adotados',
        ordem: 1,
      },
      {
        nome: 'Pranchas Executivas / Desenhos Técnicos',
        descricao: 'Plantas, cortes, elevações e detalhes executivos',
        ordem: 2,
      },
      {
        nome: 'Anotação de Responsabilidade Técnica (ART/RRT)',
        descricao: 'Comprovante e certidão de registro no conselho',
        ordem: 3,
      },
    ])
    setChecklist([
      { item: 'Conformidade com normas técnicas vigentes (ABNT/NBR)', obrigatorio: true },
      { item: 'Compatibilização arquitetônica e estrutural', obrigatorio: true },
      { item: 'Anotação técnica (ART/RRT) devidamente quitada', obrigatorio: true },
      { item: 'Assinatura digital padrão ICP-Brasil válida', obrigatorio: false },
    ])
    setModalAberto(true)
  }

  const abrirModalEditar = (item: CatalogoEscopoRecord) => {
    setEscopoEditando(item)
    setFormDisciplina(item.disciplina)
    setFormNome(item.nome)
    setFormAtivo(item.ativo !== false)

    const ents = Array.isArray(item.entregaveis_padrao)
      ? item.entregaveis_padrao.map((e, idx) => ({
          nome: e.nome || '',
          descricao: e.descricao || '',
          ordem: e.ordem || idx + 1,
        }))
      : []
    setEntregaveis(ents)

    const chk = Array.isArray(item.checklist_revisao)
      ? item.checklist_revisao.map((c) => ({
          item: c.item || '',
          obrigatorio: c.obrigatorio !== false,
        }))
      : []
    setChecklist(chk)

    setModalAberto(true)
  }

  const adicionarEntregavel = () => {
    if (!novoEntNome.trim()) return
    setEntregaveis((prev) => [
      ...prev,
      {
        nome: novoEntNome.trim(),
        descricao: novoEntDesc.trim(),
        ordem: prev.length + 1,
      },
    ])
    setNovoEntNome('')
    setNovoEntDesc('')
  }

  const removerEntregavel = (index: number) => {
    setEntregaveis((prev) => prev.filter((_, i) => i !== index))
  }

  const adicionarChecklist = () => {
    if (!novoCheckItem.trim()) return
    setChecklist((prev) => [
      ...prev,
      {
        item: novoCheckItem.trim(),
        obrigatorio: novoCheckObrigatorio,
      },
    ])
    setNovoCheckItem('')
    setNovoCheckObrigatorio(true)
  }

  const removerChecklist = (index: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSalvar = async () => {
    if (!formDisciplina.trim() || !formNome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe a disciplina e o nome descritivo do escopo.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      const payload = {
        disciplina: formDisciplina.trim(),
        nome: formNome.trim(),
        entregaveis_padrao: entregaveis,
        checklist_revisao: checklist,
        ativo: formAtivo,
      }

      if (escopoEditando) {
        await catalogoEscoposService.update(escopoEditando.id, payload)
        toast({
          title: 'Escopo atualizado',
          description: `O escopo ${payload.nome} foi atualizado com sucesso.`,
        })
      } else {
        await catalogoEscoposService.create(payload)
        toast({
          title: 'Escopo criado',
          description: `Novo escopo técnico cadastrado no catálogo.`,
        })
      }

      setModalAberto(false)
      await carregarEscopos()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar escopo',
        description: err.message || 'Falha ao salvar no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente remover o escopo "${nome}" do catálogo?`)) return
    try {
      await catalogoEscoposService.delete(id)
      toast({
        title: 'Escopo excluído',
        description: 'Registro removido com sucesso.',
      })
      await carregarEscopos()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir escopo',
        description: err.message || 'Não foi possível remover o registro.',
        variant: 'destructive',
      })
    }
  }

  const escoposFiltrados = escopos.filter((e) => {
    const q = busca.toLowerCase()
    return (
      (e.disciplina || '').toLowerCase().includes(q) || (e.nome || '').toLowerCase().includes(q)
    )
  })

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#D95A2B]" />
            <CardTitle className="text-lg">Catálogo de Escopos Técnicos</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            Padronização de entregáveis e checklists de revisão técnica por disciplina de
            engenharia. Alimenta a geração automática de pacotes de trabalho e validação de
            conformidade.
          </CardDescription>
        </div>
        {podeEditar && (
          <Button
            onClick={abrirModalCriar}
            className="bg-[#D95A2B] hover:bg-[#c44e24] text-white text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Escopo Técnico
          </Button>
        )}
      </CardHeader>

      <div className="px-6 pb-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Filtrar por disciplina ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Disciplina</th>
                <th className="py-3 px-4">Nome do Escopo</th>
                <th className="py-3 px-4 text-center">Entregáveis Padrão</th>
                <th className="py-3 px-4 text-center">Checklist de Revisão</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D95A2B]" />
                    Carregando catálogo de escopos...
                  </td>
                </tr>
              ) : escoposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum escopo técnico encontrado.
                  </td>
                </tr>
              ) : (
                escoposFiltrados.map((item) => {
                  const qtdEntregaveis = Array.isArray(item.entregaveis_padrao)
                    ? item.entregaveis_padrao.length
                    : 0
                  const qtdChecklist = Array.isArray(item.checklist_revisao)
                    ? item.checklist_revisao.length
                    : 0

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="bg-orange-50 border-orange-200 text-[#D95A2B] font-semibold text-[11px]"
                        >
                          {item.disciplina}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.nome}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                          {qtdEntregaveis} entregáveis
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                          {qtdChecklist} itens
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.ativo !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {podeEditar && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirModalEditar(item)}
                              className="h-7 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExcluir(item.id, item.nome)}
                                className="h-7 text-xs text-rose-600 hover:text-rose-800"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Excluir
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Modal de Criação / Edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#D95A2B]" />
              {escopoEditando ? 'Editar Escopo Técnico' : 'Cadastrar Novo Escopo Técnico'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a disciplina, os entregáveis esperados e o checklist obrigatório para
              revisão técnica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Disciplina *</Label>
                <Input
                  placeholder="Ex: Estruturas, Topografia, Elétrica..."
                  value={formDisciplina}
                  onChange={(e) => setFormDisciplina(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nome Descritivo *</Label>
                <Input
                  placeholder="Ex: Projetos Estruturais em Concreto Armado"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-slate-50">
              <div>
                <div className="text-xs font-semibold text-slate-800">Status Ativo</div>
                <div className="text-[11px] text-slate-500">
                  Escopos ativos aparecem na sugestão automática de pacotes
                </div>
              </div>
              <Switch checked={formAtivo} onCheckedChange={setFormAtivo} />
            </div>

            {/* SEÇÃO ENTREGÁVEIS-PADRÃO */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  Entregáveis-Padrão ({entregaveis.length})
                </div>
                <span className="text-[11px] text-slate-400">Gerados na criação do pacote</span>
              </div>

              {entregaveis.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {entregaveis.map((ent, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between bg-white border rounded p-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{ent.nome}</span>
                        {ent.descricao && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{ent.descricao}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removerEntregavel(i)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  Nenhum entregável padrão cadastrado.
                </p>
              )}

              {/* Inserir novo entregável */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t">
                <div className="sm:col-span-6">
                  <Input
                    placeholder="Nome do entregável..."
                    value={novoEntNome}
                    onChange={(e) => setNovoEntNome(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-5">
                  <Input
                    placeholder="Descrição / critérios..."
                    value={novoEntDesc}
                    onChange={(e) => setNovoEntDesc(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={adicionarEntregavel}
                    className="w-full h-8 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* SEÇÃO CHECKLIST DE REVISÃO */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                  <ListChecks className="w-4 h-4 text-emerald-600" />
                  Checklist de Revisão Técnica ({checklist.length})
                </div>
                <span className="text-[11px] text-slate-400">Exigido para aprovar versões</span>
              </div>

              {checklist.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {checklist.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white border rounded p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800">{c.item}</span>
                        {c.obrigatorio && (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-rose-50 text-rose-700 border-rose-200"
                          >
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removerChecklist(i)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  Nenhum item de checklist configurado.
                </p>
              )}

              {/* Inserir novo item de checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t">
                <div className="sm:col-span-8">
                  <Input
                    placeholder="Critério de verificação técnica..."
                    value={novoCheckItem}
                    onChange={(e) => setNovoCheckItem(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-2 px-1">
                  <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novoCheckObrigatorio}
                      onChange={(e) => setNovoCheckObrigatorio(e.target.checked)}
                      className="rounded text-blue-600 h-3.5 w-3.5"
                    />
                    Obrigatório
                  </label>
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={adicionarChecklist}
                    className="w-full h-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSalvar}
              disabled={salvando}
              className="bg-[#D95A2B] hover:bg-[#c44e24] text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Escopo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
export default GestaoCatalogoEscopos
