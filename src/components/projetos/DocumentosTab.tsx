import React, { useState } from 'react'
import { DocumentoRecord, ProjetoEtapaRecord, TipoDocumento } from '@/types'
import { DocumentoComAlerta } from '@/services/projetos'
import { documentosService, CreateDocumentoData } from '@/services/projetoDetalhes'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  FileText,
  AlertTriangle,
  Download,
  Trash2,
  Loader2,
  Calendar,
  ShieldAlert,
} from 'lucide-react'

interface DocumentosTabProps {
  projetoId: string
  etapas: ProjetoEtapaRecord[]
  documentos: DocumentoComAlerta[]
  canEdit: boolean
  onRefresh: () => void
}

export const DocumentosTab: React.FC<DocumentosTabProps> = ({
  projetoId,
  etapas,
  documentos,
  canEdit,
  onRefresh,
}) => {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form states
  const [tipo, setTipo] = useState<TipoDocumento>('ART')
  const [etapaId, setEtapaId] = useState('')
  const [numero, setNumero] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelTecnico, setResponsavelTecnico] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const payload: CreateDocumentoData = {
        projeto: projetoId,
        etapa: etapaId || undefined,
        tipo,
        numero: numero.trim() || undefined,
        descricao: descricao.trim() || undefined,
        responsavel_tecnico: responsavelTecnico.trim() || undefined,
        vencimento: vencimento ? `${vencimento} 23:59:59.000Z` : undefined,
        arquivo: arquivo || undefined,
      }

      await documentosService.create(payload)
      toast({ title: 'Documento cadastrado com sucesso!' })
      setModalOpen(false)
      limparForm()
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar documento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja excluir este documento?')) return
    try {
      await documentosService.delete(id)
      toast({ title: 'Documento removido' })
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const limparForm = () => {
    setTipo('ART')
    setEtapaId('')
    setNumero('')
    setDescricao('')
    setResponsavelTecnico('')
    setVencimento('')
    setArquivo(null)
  }

  // Estatísticas de alerta de documentos
  const docsAlerta = documentos.filter(
    (d) => d.alertaNivel && ['vencido', 'd1', 'd7', 'd15', 'd30'].includes(d.alertaNivel),
  )

  return (
    <div className="space-y-4">
      {/* Barra de Alertas D-30 / D-15 / D-7 / D-1 */}
      {docsAlerta.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-900">
            <span className="font-bold">Atenção aos Vencimentos:</span> Há {docsAlerta.length}{' '}
            documento(s) com alerta de vencimento próximo ou vencido (regra D-30 / D-15 / D-7 /
            D-1).
          </div>
        </div>
      )}

      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Documentos Técnicos e Regulatórios ({documentos.length})
          </h3>
          <p className="text-xs text-slate-500">
            ART/RRT, TRT, Ordens de Serviço (OS) e Medições com monitoramento de vencimento.
          </p>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              limparForm()
              setModalOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Documento
          </Button>
        )}
      </div>

      {/* Tabela de Documentos */}
      {documentos.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-lg">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">Nenhum documento registrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Anexe as ARTs, RRTs e relatórios de medição deste projeto.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="p-3">Tipo</th>
                <th className="p-3">Nº / Registro</th>
                <th className="p-3">Descrição / Resp. Técnico</th>
                <th className="p-3">Etapa</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Alerta D-N</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documentos.map((doc) => {
                const fileUrl = doc.arquivo ? pb.files.getURL(doc, doc.arquivo) : null

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          doc.tipo === 'ART'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : doc.tipo === 'RRT'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : doc.tipo === 'TRT'
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : doc.tipo === 'OS'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {doc.tipo}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800">
                      {doc.numero || '—'}
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-800">{doc.descricao || '—'}</p>
                      {doc.responsavel_tecnico && (
                        <p className="text-[11px] text-slate-400">
                          Resp: {doc.responsavel_tecnico}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{doc.expand?.etapa?.nome || 'Geral'}</td>
                    <td className="p-3 font-mono text-slate-700">
                      {doc.vencimento ? formatDateBr(doc.vencimento) : 'Indeterminado'}
                    </td>
                    <td className="p-3">
                      {doc.alertaNivel === 'vencido' && (
                        <Badge className="bg-rose-600 text-white text-[10px]">
                          Vencido ({Math.abs(doc.diasAteVencimento || 0)}d atrás)
                        </Badge>
                      )}
                      {doc.alertaNivel === 'd1' && (
                        <Badge className="bg-rose-500 text-white text-[10px] animate-pulse">
                          Alerta D-1 ({doc.diasAteVencimento}d)
                        </Badge>
                      )}
                      {doc.alertaNivel === 'd7' && (
                        <Badge className="bg-orange-500 text-white text-[10px]">
                          Alerta D-7 ({doc.diasAteVencimento}d)
                        </Badge>
                      )}
                      {doc.alertaNivel === 'd15' && (
                        <Badge className="bg-amber-500 text-slate-950 text-[10px]">
                          Alerta D-15 ({doc.diasAteVencimento}d)
                        </Badge>
                      )}
                      {doc.alertaNivel === 'd30' && (
                        <Badge className="bg-yellow-400 text-slate-900 text-[10px]">
                          Alerta D-30 ({doc.diasAteVencimento}d)
                        </Badge>
                      )}
                      {doc.alertaNivel === 'ok' && (
                        <span className="text-[11px] text-emerald-600 font-medium">Regular</span>
                      )}
                      {!doc.alertaNivel && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Baixar arquivo"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExcluir(doc.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            title="Excluir documento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar Documento */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Documento do Projeto
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Documento *</Label>
                <Select value={tipo} onValueChange={(val: TipoDocumento) => setTipo(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ART">ART (Engenharia / CREA)</SelectItem>
                    <SelectItem value="RRT">RRT (Arquitetura / CAU)</SelectItem>
                    <SelectItem value="TRT">TRT (Técnicos / CFT)</SelectItem>
                    <SelectItem value="OS">Ordem de Serviço (OS)</SelectItem>
                    <SelectItem value="medicao">Boletim de Medição</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="numDoc">Número / Código</Label>
                <Input
                  id="numDoc"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 28027230240"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Etapa Associada (Opcional)</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Geral do Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Geral do Projeto --</SelectItem>
                  {etapas.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descDoc">Descrição</Label>
              <Input
                id="descDoc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: ART de Execução de Projeto Estrutural"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="respTec">Responsável Técnico</Label>
                <Input
                  id="respTec"
                  value={responsavelTecnico}
                  onChange={(e) => setResponsavelTecnico(e.target.value)}
                  placeholder="Eng. Fulano de Tal"
                />
              </div>

              <div>
                <Label htmlFor="vencDoc">Data de Vencimento</Label>
                <Input
                  id="vencDoc"
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="fileDoc">Arquivo Digitalizado (PDF / DWG / BIM / etc.)</Label>
              <Input
                id="fileDoc"
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
                Limite aumentado para até 100 MB por arquivo (adequado para memoriais e pranchas em
                alta resolução).
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Documento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
