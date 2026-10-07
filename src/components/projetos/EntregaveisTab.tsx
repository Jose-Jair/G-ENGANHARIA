import React, { useState } from 'react'
import { EntregavelRecord, ProjetoEtapaRecord, StatusEntregavel } from '@/types'
import { entregaveisService, CreateEntregavelData } from '@/services/projetoDetalhes'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  FileCheck2,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  FileUp,
} from 'lucide-react'

interface EntregaveisTabProps {
  etapas: ProjetoEtapaRecord[]
  entregaveis: EntregavelRecord[]
  canEdit: boolean
  onRefresh: () => void
}

const STATUS_ENTREGAVEL_MAP: Record<StatusEntregavel, { label: string; badge: string; icon: any }> =
  {
    elaborando: {
      label: 'Elaborando',
      badge: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: Clock,
    },
    revisao_interna: {
      label: 'Revisão Interna',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: Eye,
    },
    enviado_cliente: {
      label: 'Enviado ao Cliente',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: FileCheck2,
    },
    aprovado: {
      label: 'Aprovado',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: CheckCircle2,
    },
    reprovado: {
      label: 'Reprovado',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      icon: XCircle,
    },
  }

export const EntregaveisTab: React.FC<EntregaveisTabProps> = ({
  etapas,
  entregaveis,
  canEdit,
  onRefresh,
}) => {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form states
  const [etapaId, setEtapaId] = useState('')
  const [nome, setNome] = useState('')
  const [versao, setVersao] = useState('Rev.00')
  const [status, setStatus] = useState<StatusEntregavel>('elaborando')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [etapaFiltro, setEtapaFiltro] = useState<string>('todas')

  const entregaveisFiltrados =
    etapaFiltro === 'todas' ? entregaveis : entregaveis.filter((e) => e.etapa === etapaFiltro)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!etapaId || !nome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Vincule a uma etapa e forneça o nome do entregável.',
        variant: 'destructive',
      })
      return
    }

    if (arquivo && arquivo.size > 104857600) {
      toast({
        title: 'Arquivo excede o limite',
        description: `O arquivo selecionado possui ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo permitido é de 100 MB.`,
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateEntregavelData = {
        etapa: etapaId,
        nome: nome.trim(),
        versao: versao.trim() || 'Rev.00',
        status,
        descricao: descricao.trim() || undefined,
        arquivo: arquivo || undefined,
        data_aprovacao: status === 'aprovado' ? new Date().toISOString() : undefined,
      }

      await entregaveisService.create(payload)
      toast({ title: 'Entregável cadastrado com sucesso!' })
      setModalOpen(false)
      limparForm()
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar entregável',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleAlterarStatus = async (item: EntregavelRecord, novoStatus: StatusEntregavel) => {
    try {
      await entregaveisService.update(item.id, {
        status: novoStatus,
        data_aprovacao: novoStatus === 'aprovado' ? new Date().toISOString() : undefined,
      })
      toast({ title: `Status atualizado para ${STATUS_ENTREGAVEL_MAP[novoStatus].label}` })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja excluir este entregável?')) return
    try {
      await entregaveisService.delete(id)
      toast({ title: 'Entregável removido' })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const limparForm = () => {
    setNome('')
    setVersao('Rev.00')
    setStatus('elaborando')
    setDescricao('')
    setArquivo(null)
  }

  return (
    <div className="space-y-4">
      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Entregáveis Técnicos ({entregaveis.length})
            </h3>
            <p className="text-xs text-slate-500">
              Fluxo de versões e aprovação: Elaborando → Revisão interna → Enviado ao cliente →
              Aprovado/Reprovado
            </p>
          </div>

          {/* Filtro por Etapa */}
          <div className="hidden sm:block ml-4">
            <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Filtrar por etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Etapas</SelectItem>
                {etapas.map((et) => (
                  <SelectItem key={et.id} value={et.id}>
                    {et.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              limparForm()
              if (etapas.length > 0 && !etapaId) {
                setEtapaId(etapas[0].id)
              }
              setModalOpen(true)
            }}
            disabled={etapas.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Entregável
          </Button>
        )}
      </div>

      {/* Grid ou Lista de Entregáveis */}
      {entregaveisFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-lg">
          <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhum entregável cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre os projetos complementares, memoriais descritivos ou relatórios desta etapa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entregaveisFiltrados.map((item) => {
            const metaStatus =
              STATUS_ENTREGAVEL_MAP[item.status] || STATUS_ENTREGAVEL_MAP.elaborando
            const StatusIcon = metaStatus.icon
            const etapaRel = etapas.find((e) => e.id === item.etapa)

            const fileUrl = item.arquivo ? pb.files.getURL(item, item.arquivo) : null

            return (
              <div
                key={item.id}
                className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {item.versao || 'Rev.00'}
                        </span>
                        <h4 className="font-semibold text-sm text-slate-900 truncate">
                          {item.nome}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Etapa: <span className="font-medium">{etapaRel?.nome || 'Etapa'}</span>
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold shrink-0 ${metaStatus.badge}`}
                    >
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {metaStatus.label}
                    </Badge>
                  </div>

                  {item.descricao && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{item.descricao}</p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                    <span>
                      {item.data_aprovacao
                        ? `Aprovado em: ${formatDateBr(item.data_aprovacao)}`
                        : `Criado em: ${formatDateBr(item.created)}`}
                    </span>

                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <Download className="w-3 h-3" />
                        Baixar Arquivo
                      </a>
                    )}
                  </div>
                </div>

                {/* Controles de Status do Entregável */}
                {canEdit && (
                  <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">Mudar status:</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={item.status}
                        onValueChange={(val: StatusEntregavel) => handleAlterarStatus(item, val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="elaborando">Elaborando</SelectItem>
                          <SelectItem value="revisao_interna">Revisão Interna</SelectItem>
                          <SelectItem value="enviado_cliente">Enviado Cliente</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExcluir(item.id)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Entregável */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cadastrar Entregável
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3 pt-1">
            <div>
              <Label>Etapa Vinculada *</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.nome} ({et.disciplina || 'Geral'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entregNome">Nome do Documento / Prancha *</Label>
              <Input
                id="entregNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Prancha 01 - Forma e Armação Vigas Térreo"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="versao">Versão</Label>
                <Input
                  id="versao"
                  value={versao}
                  onChange={(e) => setVersao(e.target.value)}
                  placeholder="Rev.00"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: StatusEntregavel) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elaborando">Elaborando</SelectItem>
                    <SelectItem value="revisao_interna">Revisão Interna</SelectItem>
                    <SelectItem value="enviado_cliente">Enviado Cliente</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="fileUpload">Upload de Arquivo (PDF, DWG, BIM, ZIP, etc.)</Label>
              <Input
                id="fileUpload"
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f && f.size > 104857600) {
                    toast({
                      title: 'Arquivo muito grande',
                      description: `O arquivo tem ${(f.size / (1024 * 1024)).toFixed(1)} MB e ultrapassa o teto de 100 MB.`,
                      variant: 'destructive',
                    })
                  }
                  setArquivo(f)
                }}
                className="mt-1 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Limite aumentado para até 100 MB por arquivo (suporta pranchas CAD, pacotes BIM e
                memoriais pesados).
              </p>
            </div>

            <div>
              <Label htmlFor="descEnt">Descrição / Detalhes</Label>
              <Textarea
                id="descEnt"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Observações complementares..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Entregável
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
