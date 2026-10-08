import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  FolderKanban,
} from 'lucide-react'

import { ContratoServicoRecord } from '@/types'
import { EtapasTab } from './EtapasTab'
import { EntregaveisTab } from './EntregaveisTab'
import { DocumentosTab } from './DocumentosTab'
import { RiscosTab } from './RiscosTab'
import { ContratoTab } from './ContratoTab'
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
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(true)
  const [projeto, setProjeto] = useState<ProjetoRecord | null>(null)
  const [contratoServico, setContratoServico] = useState<ContratoServicoRecord | null>(null)
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
      setContratoServico((completo as any).contratoServico || null)
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

  // Indicador de performance por projeto consolidado:
  // Prazo (etapas no prazo vs atrasadas), Risco (riscos por severidade) e Financeiro (pago a executores vs contratado)
  const etapasConcluidasCount = etapas.filter((e) => e.status === 'concluida').length
  const etapasAtrasadasCount = etapas.filter((e) => {
    if (e.status === 'concluida' || e.status === 'cancelada') return false
    const fim = e.prazo_fim || (e as any).data_fim
    if (!fim) return false
    const dFim = new Date(fim)
    dFim.setHours(0, 0, 0, 0)
    const hj = new Date()
    hj.setHours(0, 0, 0, 0)
    return dFim.getTime() < hj.getTime()
  }).length
  const etapasNoPrazoCount = etapas.length - etapasAtrasadasCount - etapasConcluidasCount

  const riscosAltos = riscos.filter(
    (r) => (r.impacto as string) === 'alto' || (r.impacto as string) === 'alta',
  ).length
  const riscosMedios = riscos.filter(
    (r) => (r.impacto as string) === 'medio' || (r.impacto as string) === 'media',
  ).length
  const riscosBaixos = riscos.length - riscosAltos - riscosMedios

  const totalPagoExecutores = etapas.reduce((acc, e) => acc + (Number(e.valor_executor) || 0), 0)
  const percFinanceiro = projeto?.valor_total
    ? Math.min(100, Math.round((totalPagoExecutores / Number(projeto.valor_total)) * 100))
    : 0

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
                {' '}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                        {projeto.codigo}
                      </span>
                      {projeto.expand?.proposta && (
                        <span className="font-mono text-xs text-orange-400 bg-orange-950/60 border border-orange-800/80 px-2 py-0.5 rounded">
                          Origem: {projeto.expand.proposta.numero} (
                          {projeto.expand.proposta.revisao || 'Rev.00'})
                        </span>
                      )}
                      {projeto.grupo && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false)
                            navigate(`/projetos/grupo/${projeto.grupo}`)
                          }}
                          className="h-6 px-2 text-[11px] bg-[#D95A2B]/20 text-orange-300 border-[#D95A2B]/50 hover:bg-[#D95A2B] hover:text-white"
                          title="Navegar para a gestão do Grupo de Projetos"
                        >
                          <FolderKanban className="w-3 h-3 mr-1" />
                          Ver Grupo
                        </Button>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${
                          projeto.status === 'contratacao'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : projeto.status === 'concluido'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-blue-950 text-blue-400 border-blue-800'
                        }`}
                      >
                        {projeto.status === 'contratacao'
                          ? 'Em Contratação'
                          : projeto.status === 'concluido'
                            ? 'Concluído'
                            : projeto.status || 'Em Andamento'}
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

                      {projeto.modo_execucao && (
                        <span className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-slate-800 text-slate-300 border-slate-700"
                          >
                            Modo:{' '}
                            {projeto.modo_execucao === 'direta'
                              ? 'Direta'
                              : projeto.modo_execucao === 'terceirizada_parcial'
                                ? 'Terc. Parcial'
                                : 'Terc. Integral'}
                          </Badge>
                        </span>
                      )}
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

              {/* Painel Consolidado de Performance do Projeto (Objetivo 2) */}
              <div className="p-4 bg-slate-100 border-b border-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>Indicadores de Performance Consolidados</span>
                  <span className="text-[10px] font-mono lowercase text-slate-400">
                    visão unificada: prazo, risco e custo
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Performance Prazo */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Performance de Prazo
                      </span>
                      <span className="font-mono text-[11px] font-bold">
                        {etapas.length > 0
                          ? `${Math.round((etapasConcluidasCount / etapas.length) * 100)}% conc.`
                          : '0%'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300"
                      >
                        {etapasConcluidasCount} concluídas
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-50 text-blue-800 border-blue-300"
                      >
                        {etapasNoPrazoCount} em dia
                      </Badge>
                      {etapasAtrasadasCount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {etapasAtrasadasCount} atrasadas
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Riscos Abertos por Severidade */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Mapa de Riscos ({riscos.length})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {totalRiscosCriticos} críticos abertos
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-rose-50 text-rose-800 border-rose-300"
                      >
                        {riscosAltos} Alto
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
                      >
                        {riscosMedios} Médio
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-100 text-slate-700 border-slate-300"
                      >
                        {riscosBaixos} Baixo
                      </Badge>
                    </div>
                  </div>

                  {/* Financeiro Consolidado */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        Alocação Financeira
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {percFinanceiro}% do teto
                      </span>
                    </div>
                    <div className="text-xs mt-1.5 flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Custo Executores:</span>
                      <strong className="text-slate-900 font-mono">
                        {formatCurrencyBr(totalPagoExecutores)}
                      </strong>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                      <span>Valor do Contrato:</span>
                      <span className="font-mono">
                        {formatCurrencyBr(projeto.valor_total || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Corpo com as 4 Abas do Plano A */}
              <div className="p-6 bg-slate-50">
                <Tabs
                  defaultValue={projeto.status === 'contratacao' ? 'contrato' : 'etapas'}
                  className="space-y-4"
                >
                  <TabsList className="bg-white border border-slate-200 p-1">
                    <TabsTrigger value="contrato" className="text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-orange-600" />
                      Aba Contrato
                      {contratoServico && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            contratoServico.status === 'assinado'
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      )}
                    </TabsTrigger>

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

                  <TabsContent value="contrato">
                    <ContratoTab
                      projeto={projeto}
                      contrato={contratoServico}
                      isAdmin={user?.role === 'admin'}
                      canEdit={canEdit}
                      onRefresh={() => {
                        carregarDadosCompletos()
                        onUpdate()
                      }}
                    />
                  </TabsContent>

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
