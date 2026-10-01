import React, { useState, useEffect } from 'react'
import {
  ProjetoRecord,
  ProjetoEtapaRecord,
  EntregavelRecord,
  RiscoRecord,
  ExecutorRecord,
} from '@/types'
import { projetosService, DocumentoComAlerta } from '@/services/projetos'
import { executoresService } from '@/services/executores'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  Calendar,
  DollarSign,
  HeartPulse,
  Layers,
  FileCheck2,
  FileText,
  AlertTriangle,
  Loader2,
  Building2,
  UserCheck,
} from 'lucide-react'

import { EtapasTab } from './EtapasTab'
import { EntregaveisTab } from './EntregaveisTab'
import { DocumentosTab } from './DocumentosTab'
import { RiscosTab } from './RiscosTab'
import { ModalSaudeProjeto } from './ModalSaudeProjeto'
import { ModalCotacoesEtapa } from './ModalCotacoesEtapa'
import { ModalAvaliacaoExecutor } from './ModalAvaliacaoExecutor'
import { ModalDossieProjeto } from './ModalDossieProjeto'

interface ModalDetalheProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string | null
  onUpdate: () => void
}

export const ModalDetalheProjeto: React.FC<ModalDetalheProjetoProps> = ({
  open,
  onOpenChange,
  projetoId,
  onUpdate,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [projeto, setProjeto] = useState<ProjetoRecord | null>(null)
  const [etapas, setEtapas] = useState<ProjetoEtapaRecord[]>([])
  const [entregaveis, setEntregaveis] = useState<EntregavelRecord[]>([])
  const [documentos, setDocumentos] = useState<DocumentoComAlerta[]>([])
  const [riscos, setRiscos] = useState<RiscoRecord[]>([])
  const [executores, setExecutores] = useState<ExecutorRecord[]>([])

  // Modais secundários
  const [modalSaudeOpen, setModalSaudeOpen] = useState(false)
  const [modalCotacoesOpen, setModalCotacoesOpen] = useState(false)
  const [modalDossieOpen, setModalDossieOpen] = useState(false)
  const [etapaCotacaoSelecionada, setEtapaCotacaoSelecionada] = useState<ProjetoEtapaRecord | null>(
    null,
  )
  const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false)
  const [etapaAvaliacaoSelecionada, setEtapaAvaliacaoSelecionada] =
    useState<ProjetoEtapaRecord | null>(null)

  const canEdit = !!(user && (user.role === 'admin' || user.role === 'gestor'))
  const canViewDossie = !!(
    user && ['admin', 'gestor', 'financeiro', 'comercial'].includes(user.role)
  )

  const carregarDadosCompletos = async () => {
    if (!projetoId) return
    setCarregando(true)
    try {
      const [completo, execs] = await Promise.all([
        projetosService.getProjetoCompleto(projetoId),
        executoresService.list(),
      ])

      setProjeto(completo.projeto)
      setEtapas(completo.etapas)
      setEntregaveis(completo.entregaveis)
      setDocumentos(completo.documentos)
      setRiscos(completo.riscos)
      setExecutores(execs)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar projeto',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && projetoId) {
      carregarDadosCompletos()
    }
  }, [open, projetoId])

  if (!open || !projetoId) return null

  // Identificação do cliente (PJ ou PF)
  const clientePJ = projeto?.expand?.empresa || projeto?.expand?.proposta?.expand?.empresa
  const clientePF = projeto?.expand?.cliente_pf || projeto?.expand?.proposta?.expand?.cliente_pf
  const nomeCliente =
    clientePJ?.nome_fantasia ||
    clientePJ?.razao_social ||
    clientePF?.nome ||
    'Cliente não vinculado'

  // Alertas de Documentos
  const totalAlertasDoc = documentos.filter(
    (d) => d.alertaNivel && ['vencido', 'd1', 'd7', 'd15', 'd30'].includes(d.alertaNivel),
  ).length

  // Riscos Críticos
  const totalRiscosCriticos = riscos.filter(
    (r) => r.probabilidade === 'alta' && r.impacto === 'alto' && r.status === 'aberto',
  ).length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          {carregando ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm text-slate-500">Carregando dados do projeto e abas...</p>
            </div>
          ) : projeto ? (
            <div className="flex flex-col">
              {/* Header do Projeto */}
              <div className="p-6 bg-slate-900 text-white border-b border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                        {projeto.codigo}
                      </span>
                      {projeto.expand?.proposta && (
                        <span className="font-mono text-xs text-slate-400">
                          Origem: {projeto.expand.proposta.numero}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${
                          projeto.status === 'concluido'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-blue-950 text-blue-400 border-blue-800'
                        }`}
                      >
                        {projeto.status || 'em_andamento'}
                      </Badge>
                    </div>

                    <h2 className="text-xl font-bold text-white mt-1">
                      {projeto.nome || `Projeto ${projeto.codigo}`}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-2">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Cliente: <strong className="text-white">{nomeCliente}</strong>
                      </span>

                      {projeto.valor_total ? (
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          Valor: {formatCurrencyBr(projeto.valor_total)}
                        </span>
                      ) : null}

                      {projeto.prazo_final ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          Prazo Final: {formatDateBr(projeto.prazo_final)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Saúde do Projeto com Botão para Gestor */}
                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/80 flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Saúde:</span>
                      {projeto.saude === 'verde' && (
                        <Badge className="bg-emerald-600 text-white text-xs font-semibold">
                          🟢 Verde (Estável)
                        </Badge>
                      )}
                      {projeto.saude === 'amarelo' && (
                        <Badge className="bg-amber-500 text-slate-950 text-xs font-semibold">
                          🟡 Amarelo (Atenção)
                        </Badge>
                      )}
                      {projeto.saude === 'vermelho' && (
                        <Badge className="bg-rose-600 text-white text-xs font-semibold">
                          🔴 Vermelho (Crítico)
                        </Badge>
                      )}
                      {!projeto.saude && (
                        <Badge variant="outline" className="text-xs text-slate-400">
                          Não definida
                        </Badge>
                      )}
                    </div>

                    {projeto.justificativa_saude && (
                      <p className="text-[11px] text-slate-400 italic max-w-xs text-right truncate">
                        "{projeto.justificativa_saude}"
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1">
                      {canViewDossie && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalDossieOpen(true)}
                          className="text-[11px] bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white border-blue-500/40 h-6 px-2.5"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Dossiê (PDF)
                        </Button>
                      )}

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setModalSaudeOpen(true)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 hover:bg-slate-700/50 h-6 px-2"
                        >
                          <HeartPulse className="w-3 h-3 mr-1" />
                          Alterar Saúde
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Corpo com as 4 Abas do Plano A */}
              <div className="p-6 bg-slate-50">
                <Tabs defaultValue="etapas" className="space-y-4">
                  <TabsList className="bg-white border border-slate-200 p-1">
                    <TabsTrigger value="etapas" className="text-xs flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Aba Etapas ({etapas.length})
                    </TabsTrigger>

                    <TabsTrigger value="entregaveis" className="text-xs flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Aba Entregáveis ({entregaveis.length})
                    </TabsTrigger>

                    <TabsTrigger value="documentos" className="text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Aba Documentos ({documentos.length})
                      {totalAlertasDoc > 0 && (
                        <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {totalAlertasDoc}
                        </span>
                      )}
                    </TabsTrigger>

                    <TabsTrigger value="riscos" className="text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Aba Riscos ({riscos.length})
                      {totalRiscosCriticos > 0 && (
                        <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                          !
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="etapas">
                    <EtapasTab
                      projetoId={projeto.id}
                      etapas={etapas}
                      executores={executores}
                      canEdit={canEdit}
                      onRefresh={() => {
                        carregarDadosCompletos()
                        onUpdate()
                      }}
                      onAbrirCotacoes={(et) => {
                        setEtapaCotacaoSelecionada(et)
                        setModalCotacoesOpen(true)
                      }}
                      onAbrirAvaliacao={(et) => {
                        setEtapaAvaliacaoSelecionada(et)
                        setModalAvaliacaoOpen(true)
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="entregaveis">
                    <EntregaveisTab
                      etapas={etapas}
                      entregaveis={entregaveis}
                      canEdit={canEdit}
                      onRefresh={carregarDadosCompletos}
                    />
                  </TabsContent>

                  <TabsContent value="documentos">
                    <DocumentosTab
                      projetoId={projeto.id}
                      etapas={etapas}
                      documentos={documentos}
                      canEdit={canEdit}
                      onRefresh={carregarDadosCompletos}
                    />
                  </TabsContent>

                  <TabsContent value="riscos">
                    <RiscosTab
                      projetoId={projeto.id}
                      riscos={riscos}
                      canEdit={canEdit}
                      onRefresh={carregarDadosCompletos}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modais de Operação */}
      {projeto && (
        <ModalSaudeProjeto
          open={modalSaudeOpen}
          onOpenChange={setModalSaudeOpen}
          projetoId={projeto.id}
          codigoProjeto={projeto.codigo}
          saudeAtual={projeto.saude}
          justificativaAtual={projeto.justificativa_saude}
          onSuccess={() => {
            carregarDadosCompletos()
            onUpdate()
          }}
        />
      )}

      <ModalCotacoesEtapa
        open={modalCotacoesOpen}
        onOpenChange={setModalCotacoesOpen}
        etapa={etapaCotacaoSelecionada}
        executores={executores}
        canEdit={canEdit}
        onSuccess={() => {
          carregarDadosCompletos()
          onUpdate()
        }}
      />

      <ModalAvaliacaoExecutor
        open={modalAvaliacaoOpen}
        onOpenChange={setModalAvaliacaoOpen}
        etapa={etapaAvaliacaoSelecionada}
        onSuccess={() => {
          carregarDadosCompletos()
          onUpdate()
        }}
      />

      {/* Modal Dossiê Consolidado do Projeto (PDF / Impressão autenticada) */}
      <ModalDossieProjeto
        open={modalDossieOpen}
        onOpenChange={setModalDossieOpen}
        projetoId={projetoId}
      />
    </>
  )
}
