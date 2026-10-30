import React, { useState, useEffect } from 'react'
import { PrestadorRecord, OrdemServicoRecord } from '@/types'
import { prestadoresService, ordensServicoService } from '@/services/prestadores'
import { formatDateBr } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  Plus,
  Briefcase,
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { assinaturaEletronicaService } from '@/services/assinaturaEletronica'
import { ModalDossieEvidenciasOS } from '@/components/prestadores/ModalDossieEvidenciasOS'
import { ShieldCheck } from 'lucide-react'

interface EquipeInternaTabProps {
  projetoId: string
  canEdit: boolean
}

export const EquipeInternaTab: React.FC<EquipeInternaTabProps> = ({ projetoId, canEdit }) => {
  const { toast } = useToast()
  const { user } = useAuth()
  const [prestadoresInternos, setPrestadoresInternos] = useState<PrestadorRecord[]>([])
  const [ordensServico, setOrdensServico] = useState<OrdemServicoRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Modal e controle do Dossiê de Evidências
  const [modalDossieOpen, setModalDossieOpen] = useState(false)
  const [osDossieSelecionada, setOsDossieSelecionada] = useState<OrdemServicoRecord | null>(null)
  const [aceitandoInternoId, setAceitandoInternoId] = useState<string | null>(null)

  // Permissão de Gestão (Admin e Gestor)
  const isAdminOuGestor = user?.role === 'admin' || user?.role === 'gestor'

  // Modal Nova OS Interna
  const [modalNovaOsOpen, setModalNovaOsOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [prestadorId, setPrestadorId] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [escopo, setEscopo] = useState('')
  const [prazoDias, setPrazoDias] = useState<number>(15)

  const carregarDados = async () => {
    setCarregando(true)
    try {
      const [todosPrestadores, todasOs] = await Promise.all([
        prestadoresService.list("tipo = 'interno'"),
        ordensServicoService.listByProjeto(projetoId),
      ])
      setPrestadoresInternos(todosPrestadores)
      // Filtra apenas OS da equipe interna
      setOrdensServico(todasOs.filter((os) => os.tipo_prestador === 'interno'))
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar equipe interna',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [projetoId])

  const handleAceiteInterno = async (osId: string) => {
    setAceitandoInternoId(osId)
    try {
      await assinaturaEletronicaService.aceiteInternoOS(osId)
      toast({
        title: 'Aceite Interno Formalizado!',
        description: 'Ordem de Serviço interna aceita e em execução direta.',
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao formalizar aceite interno',
        description: err.message || 'Falha ao processar aceite.',
        variant: 'destructive',
      })
    } finally {
      setAceitandoInternoId(null)
    }
  }

  const handleCriarOsInterna = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prestadorId) {
      toast({ title: 'Selecione um membro da equipe interna', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await ordensServicoService.create({
        tipo_prestador: 'interno',
        projeto: projetoId,
        prestador: prestadorId,
        disciplina: disciplina.trim() || 'Engenharia',
        escopo_tecnico: escopo.trim(),
        prazo_dias: prazoDias,
        // OS interna NÃO tem retenção técnica nem valor financeiro
        valor_os: 0,
        percentual_retencao_tecnica: 0,
      })
      toast({
        title: 'Ordem de Serviço Interna emitida!',
        description: 'Atividade delegada à equipe técnica interna.',
      })
      setModalNovaOsOpen(false)
      setPrestadorId('')
      setDisciplina('')
      setEscopo('')
      setPrazoDias(15)
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao emitir OS Interna',
        description: err.message || 'Falha ao salvar OS.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Equipe Interna de Engenharia</h3>
            <Badge className="bg-sky-600 text-white text-[10px]">Execução Direta</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe os engenheiros e arquitetos próprios da G+ alocados neste projeto, suas Ordens
            de Serviço e carga de trabalho.
          </p>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => setModalNovaOsOpen(true)}
            className="text-xs bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Emitir OS Interna
          </Button>
        )}
      </div>

      {carregando ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
        </div>
      ) : ordensServico.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">Nenhuma Ordem de Serviço Interna</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Nenhum membro da equipe técnica própria foi alocado formalmente neste projeto até o
            momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ordensServico.map((os) => {
            const prestador = os.expand?.prestador
            return (
              <div
                key={os.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{os.numero}</span>
                    <span className="text-xs font-semibold text-sky-700 mt-0.5 block">
                      {prestador?.nome || 'Membro da Equipe'}
                    </span>
                    {prestador?.conselho && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {prestador.conselho}{' '}
                        {prestador.numero_registro_conselho &&
                          `• ${prestador.numero_registro_conselho}`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-xs font-mono">
                      Status: {os.status}
                    </Badge>
                    {/* Selo de Aceite Jurídico da OS */}
                    {os.aceite_status === 'aceito' ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aceite Simples (Interno)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-50">
                        Aceite Pendente
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Disciplina:</span>
                    <strong className="text-slate-800">{os.disciplina || 'Geral'}</strong>
                  </div>
                  {os.prazo_dias && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Prazo Estimado:</span>
                      <span>{os.prazo_dias} dias</span>
                    </div>
                  )}
                  {os.data_previsao_fim && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Previsão Fim:</span>
                      <span>{formatDateBr(os.data_previsao_fim)}</span>
                    </div>
                  )}
                </div>

                {os.escopo_tecnico && (
                  <div className="text-xs text-slate-600 line-clamp-3 bg-slate-50/50 p-2 rounded">
                    <strong>Escopo:</strong> {os.escopo_tecnico}
                  </div>
                )}

                {/* Ações da OS Interna: Aceite Simplificado e Dossiê */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    {os.aceite_status !== 'aceito' && canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={aceitandoInternoId === os.id}
                        onClick={() => handleAceiteInterno(os.id)}
                        className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1"
                      >
                        {aceitandoInternoId === os.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Registrar Aceite Simples
                      </Button>
                    )}
                  </div>

                  {isAdminOuGestor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOsDossieSelecionada(os)
                        setModalDossieOpen(true)
                      }}
                      className="h-7 text-xs text-slate-600 hover:text-slate-900 gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      Dossiê de Evidências
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Dossiê de Evidências */}
      <ModalDossieEvidenciasOS
        open={modalDossieOpen}
        onOpenChange={setModalDossieOpen}
        osId={osDossieSelecionada?.id || null}
        numeroOS={osDossieSelecionada?.numero}
      />

      {/* Modal Emitir OS Interna */}
      <Dialog open={modalNovaOsOpen} onOpenChange={setModalNovaOsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-600" />
              Emitir Ordem de Serviço Interna
            </DialogTitle>
            <DialogDescription>
              Delegue disciplinas e escopo à equipe técnica própria da G+. Sem retenção técnica ou
              cobrança financeira.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarOsInterna} className="space-y-3">
            <div>
              <Label className="text-xs">Membro da Equipe Interna *</Label>
              <Select value={prestadorId} onValueChange={setPrestadorId} required>
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue placeholder="Selecione o profissional interno" />
                </SelectTrigger>
                <SelectContent>
                  {prestadoresInternos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.disciplinas ? `(${p.disciplinas})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Disciplina Técnica *</Label>
              <Input
                required
                placeholder="Ex.: Estruturas, Hidrossanitário, Elétrico, Topografia"
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Prazo Estimado (dias)</Label>
              <Input
                type="number"
                min="1"
                value={prazoDias}
                onChange={(e) => setPrazoDias(parseInt(e.target.value) || 1)}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Escopo / Diretrizes Técnicas</Label>
              <textarea
                rows={3}
                placeholder="Descreva as responsabilidades técnicas e entregas esperadas..."
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                className="w-full text-xs p-2 border rounded-md mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaOsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Emitir OS'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default EquipeInternaTab
