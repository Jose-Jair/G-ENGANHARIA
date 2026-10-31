// =============================================================================
// GESTÃO G+ — PAINEL DE ISSUES DE REVISÃO (RODADA 17)
// Exibe lista de issues com filtros, atribuição, prazo, status, severidade,
// visualização de viewpoint snapshot, botões de ação (Verificar, Rejeitar, Atribuir)
// e botão de "Importar BCF" com processamento no navegador.
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Plus,
  FileDown,
  Upload,
  Calendar,
  User,
  Layers,
  Camera,
  Loader2,
  Sparkles,
  ShieldAlert,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { issuesRevisaoService, type TopicoBcfPayload } from '@/services/issuesRevisaoService'
import { extrairTopicosArquivoBcf } from '@/services/bcfZipParser'
import type { IssueRevisaoRecord, SeveridadeIssueRevisao, StatusIssueRevisao } from '@/types'
import { SEVERIDADE_ISSUE_LABELS, STATUS_ISSUE_LABELS } from '@/types'

export interface PainelIssuesRevisaoProps {
  entregavelId: string
  versaoId?: string
  somenteLeitura?: boolean
  isPrestador?: boolean
  onIssueAtualizada?: () => void
}

export const PainelIssuesRevisao: React.FC<PainelIssuesRevisaoProps> = ({
  entregavelId,
  versaoId = 'todas',
  somenteLeitura = false,
  isPrestador = false,
  onIssueAtualizada,
}) => {
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState<IssueRevisaoRecord[]>([])
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')

  // Modais
  const [modalBcfAberto, setModalBcfAberto] = useState(false)
  const [importandoBcf, setImportandoBcf] = useState(false)
  const [modalNovaIssueAberto, setModalNovaIssueAberto] = useState(false)
  const [salvandoNovaIssue, setSalvandoNovaIssue] = useState(false)
  const [viewpointAmpliado, setViewpointAmpliado] = useState<string | null>(null)

  // Formulário Nova Issue Manual
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaSeveridade, setNovaSeveridade] = useState<SeveridadeIssueRevisao>('media')
  const [novoPavimento, setNovoPavimento] = useState('')
  const [novoPrazo, setNovoPrazo] = useState('')
  const [novosElementos, setNovosElementos] = useState('')

  const carregarIssues = async () => {
    if (!entregavelId) return
    setLoading(true)
    try {
      const res = await issuesRevisaoService.listarIssues(entregavelId, versaoId)
      setIssues(res.issues || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar issues de revisão',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarIssues()
  }, [entregavelId, versaoId])

  // Atualização de status da issue (Verificar, Rejeitar, etc.)
  const handleAtualizarStatus = async (issueId: string, novoStatus: StatusIssueRevisao) => {
    try {
      await issuesRevisaoService.atualizarStatus(issueId, novoStatus)
      toast({
        title: 'Status atualizado',
        description: `Issue marcada como ${STATUS_ISSUE_LABELS[novoStatus]?.label || novoStatus}.`,
      })
      carregarIssues()
      onIssueAtualizada?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message || 'Falha ao registrar alteração.',
        variant: 'destructive',
      })
    }
  }

  // Importação de arquivo BCF (2.1 ou 3.0)
  const handleArquivoBcfSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportandoBcf(true)
    try {
      const topicos = await extrairTopicosArquivoBcf(file)
      if (topicos.length === 0) {
        toast({
          title: 'Nenhum tópico encontrado',
          description: 'O arquivo BCF não contém tópicos legíveis.',
          variant: 'destructive',
        })
        return
      }

      const res = await issuesRevisaoService.importarBcf(entregavelId, versaoId, topicos)
      toast({
        title: 'Importação BCF Concluída!',
        description: `${res.criadas} issue(s) criada(s), ${res.ignoradas_dedupe} ignorada(s) por deduplicação.`,
      })
      setModalBcfAberto(false)
      carregarIssues()
      onIssueAtualizada?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao importar BCF',
        description: err.message || 'Falha ao processar o arquivo BCF.',
        variant: 'destructive',
      })
    } finally {
      setImportandoBcf(false)
    }
  }

  // Criação manual de issue
  const handleCriarIssueManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoTitulo.trim()) return

    setSalvandoNovaIssue(true)
    try {
      const elArray = novosElementos
        ? novosElementos
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined

      await issuesRevisaoService.criarIssue({
        entregavel: entregavelId,
        versao: versaoId === 'todas' ? '' : versaoId,
        origem: 'manual',
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || undefined,
        severidade: novaSeveridade,
        pavimento: novoPavimento.trim() || undefined,
        prazo: novoPrazo || undefined,
        elementos: elArray,
      })

      toast({ title: 'Issue de revisão cadastrada com sucesso!' })
      setModalNovaIssueAberto(false)
      setNovoTitulo('')
      setNovaDescricao('')
      setNovoPavimento('')
      setNovoPrazo('')
      setNovosElementos('')
      carregarIssues()
      onIssueAtualizada?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar issue',
        description: err.message || 'Falha ao salvar a issue.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoNovaIssue(false)
    }
  }

  // Filtragem local
  const issuesFiltradas = issues.filter((iss) => {
    if (filtroSeveridade !== 'todas' && iss.severidade !== filtroSeveridade) return false
    if (filtroStatus !== 'todas' && iss.status !== filtroStatus) return false
    if (termoBusca.trim()) {
      const t = termoBusca.toLowerCase()
      const matchTitulo = iss.titulo.toLowerCase().includes(t)
      const matchDesc = iss.descricao?.toLowerCase().includes(t)
      const matchPav = iss.pavimento?.toLowerCase().includes(t)
      const matchGid = iss.guid_bcf?.toLowerCase().includes(t)
      if (!matchTitulo && !matchDesc && !matchPav && !matchGid) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      {/* Barra de Ferramentas e Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Buscar por título, descrição, pavimento..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="h-7 text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
            <SelectTrigger className="h-7 text-[11px] w-[110px] bg-white">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Severidades</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-7 text-[11px] w-[110px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos Status</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="atribuida">Atribuída</SelectItem>
              <SelectItem value="corrigida">Corrigida</SelectItem>
              <SelectItem value="verificada">Verificada</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>

          {!somenteLeitura && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModalBcfAberto(true)}
                className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                title="Importar tópicos e viewpoints de arquivo BCF"
              >
                <FileDown className="w-3 h-3 text-blue-600" />
                Importar BCF
              </Button>

              <Button
                size="sm"
                onClick={() => setModalNovaIssueAberto(true)}
                className="h-7 text-xs bg-[#D95A2B] hover:bg-[#c44e24] text-white gap-1 font-medium"
              >
                <Plus className="w-3 h-3" />
                Nova Issue
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Lista de Issues */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 space-y-2">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#D95A2B]" />
          <span className="text-xs">Carregando issues de revisão...</span>
        </div>
      ) : issuesFiltradas.length === 0 ? (
        <div className="p-6 text-center bg-white border border-dashed rounded-lg text-slate-400 space-y-1">
          <CheckCircle2 className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="text-xs font-medium text-slate-600">Nenhuma issue de revisão encontrada</p>
          <p className="text-[11px] text-slate-400">
            {issues.length === 0
              ? 'Nenhum apontamento pendente para este entregável.'
              : 'Nenhuma issue corresponde aos filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {issuesFiltradas.map((issue) => {
            const sevInfo =
              SEVERIDADE_ISSUE_LABELS[issue.severidade] || SEVERIDADE_ISSUE_LABELS.media
            const stInfo = STATUS_ISSUE_LABELS[issue.status] || STATUS_ISSUE_LABELS.aberta

            return (
              <div
                key={issue.id}
                className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-all space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-bold ${sevInfo.cor}`}>
                        {sevInfo.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${stInfo.cor}`}
                      >
                        {stInfo.label}
                      </Badge>
                      {issue.origem === 'bcf' && (
                        <Badge className="bg-purple-100 text-purple-800 text-[9px] px-1 py-0">
                          BCF 2.1/3.0
                        </Badge>
                      )}
                      <h5 className="font-bold text-slate-900 text-xs truncate max-w-md">
                        {issue.titulo}
                      </h5>
                    </div>

                    {issue.descricao && (
                      <p className="text-[11px] text-slate-600 leading-snug">{issue.descricao}</p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap pt-0.5">
                      {issue.pavimento && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {issue.pavimento}
                        </span>
                      )}
                      {issue.prazo && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Prazo:{' '}
                          <strong className="text-slate-600">{formatDateBr(issue.prazo)}</strong>
                        </span>
                      )}
                      {issue.versao_corrigida && (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Corrigido na versão: {issue.versao_corrigida}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Viewpoint e Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Viewpoint snapshot se houver */}
                    {issue.viewpoint && (
                      <button
                        type="button"
                        onClick={() => setViewpointAmpliado(issue.viewpoint || null)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 text-[10px] border border-slate-300"
                        title="Ver captura de tela (viewpoint)"
                      >
                        <Camera className="w-3 h-3 text-blue-600" />
                        <span>Viewpoint</span>
                      </button>
                    )}

                    {/* Ações da Equipe Interna (somente admin/gestor) */}
                    {!somenteLeitura && !isPrestador && (
                      <div className="flex items-center gap-1">
                        {issue.status !== 'verificada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAtualizarStatus(issue.id, 'verificada')}
                            className="h-6 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-2"
                            title="Marcar como verificada e liberada"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" />
                            Verificar
                          </Button>
                        )}
                        {issue.status !== 'rejeitada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAtualizarStatus(issue.id, 'rejeitada')}
                            className="h-6 text-[10px] text-rose-700 border-rose-300 hover:bg-rose-50 px-2"
                            title="Rejeitar issue (falso positivo ou sem procedência)"
                          >
                            <XCircle className="w-3 h-3 mr-0.5 text-rose-600" />
                            Rejeitar
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Prestador: Pode marcar como corrigida ao avançar */}
                    {isPrestador &&
                      issue.status !== 'corrigida' &&
                      issue.status !== 'verificada' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAtualizarStatus(issue.id, 'corrigida')}
                          className="h-6 text-[10px] text-blue-700 border-blue-300 hover:bg-blue-50 px-2"
                        >
                          Marcar Corrigida
                        </Button>
                      )}
                  </div>
                </div>

                {/* GlobalIds dos elementos IFC vinculados */}
                {issue.elementos && issue.elementos.length > 0 && (
                  <div className="pt-1 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="text-slate-400 font-semibold">Elementos IFC:</span>
                    {issue.elementos.slice(0, 5).map((gid, idx) => (
                      <span
                        key={idx}
                        className="font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200"
                      >
                        {gid}
                      </span>
                    ))}
                    {issue.elementos.length > 5 && (
                      <span className="text-slate-400">+{issue.elementos.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL IMPORTAR BCF */}
      <Dialog open={modalBcfAberto} onOpenChange={setModalBcfAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-blue-600" />
              Importar Tópicos BCF (BIM Collaboration Format)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Carregue um arquivo .bcfzip ou .bcf contendo tópicos, viewpoints e severidades gerados
              em softwares como Solibri, Navisworks ou BIMcollab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-2">
              <Upload className="w-7 h-7 text-slate-400 mx-auto" />
              <div>
                <Label
                  htmlFor="bcf-file-input"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Selecionar arquivo .bcf ou .bcfzip
                </Label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tópicos com o mesmo GUID serão desduplicados automaticamente.
                </p>
              </div>
              <Input
                id="bcf-file-input"
                type="file"
                accept=".bcf,.bcfzip,.xml"
                onChange={handleArquivoBcfSelecionado}
                disabled={importandoBcf}
                className="hidden"
              />
            </div>

            {importandoBcf && (
              <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Processando tópicos e desduplicando no servidor...</span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalBcfAberto(false)}
              disabled={importandoBcf}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVA ISSUE MANUAL */}
      <Dialog open={modalNovaIssueAberto} onOpenChange={setModalNovaIssueAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#D95A2B]" />
              Nova Issue de Revisão Técnica
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarIssueManual} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Título do Apontamento *</Label>
              <Input
                required
                placeholder="Ex: Interferência Tubulação vs Viga V102"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Severidade</Label>
                <Select
                  value={novaSeveridade}
                  onValueChange={(v) => setNovaSeveridade(v as SeveridadeIssueRevisao)}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica (Bloqueante)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prazo de Resolução</Label>
                <Input
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pavimento / Localização</Label>
              <Input
                placeholder="Ex: Pavimento 02 ou Subsolo"
                value={novoPavimento}
                onChange={(e) => setNovoPavimento(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">GlobalIds IFC Envolvidos (separados por vírgula)</Label>
              <Input
                placeholder="Ex: 2O2_000rv4BB4UbReaQW00, 3K9_111za5CC5VcSfbRX11"
                value={novosElementos}
                onChange={(e) => setNovosElementos(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição Técnica Detalhada</Label>
              <Input
                placeholder="Instruções para o modelador/projetista corrigir..."
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaIssueAberto(false)}
                disabled={salvandoNovaIssue}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoNovaIssue}
                className="bg-[#D95A2B] hover:bg-[#c44e24] text-white"
              >
                {salvandoNovaIssue ? 'Salvando...' : 'Cadastrar Issue'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL VIEWPOINT AMPLIADO */}
      {viewpointAmpliado && (
        <Dialog open={Boolean(viewpointAmpliado)} onOpenChange={() => setViewpointAmpliado(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Captura de Tela do Viewpoint (BCF)
              </DialogTitle>
            </DialogHeader>
            <div className="p-2 border rounded-lg bg-slate-900 flex justify-center">
              <img
                src={viewpointAmpliado}
                alt="Viewpoint BCF"
                className="max-h-[400px] object-contain rounded"
              />
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setViewpointAmpliado(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default PainelIssuesRevisao
