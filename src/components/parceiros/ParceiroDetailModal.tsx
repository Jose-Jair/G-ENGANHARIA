import React, { useEffect, useState } from 'react'
import {
  EmpresaRecord,
  PropostaRecord,
  ProjetoRecord,
  ContaRecord,
  ContratoRecord,
  AuditLogRecord,
  IndicadoresParceiro,
} from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  FileText,
  History,
  TrendingUp,
  DollarSign,
  Briefcase,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { formatCnpj, formatPhoneBr } from '@/lib/cnpj'
import { auditService } from '@/services/audit'

interface ParceiroDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parceiro: EmpresaRecord | null
  indicador: IndicadoresParceiro | null
  propostas: PropostaRecord[]
  projetos: ProjetoRecord[]
  contas: ContaRecord[]
  contratos: ContratoRecord[]
  onAtualizar?: () => void
}

export function ParceiroDetailModal({
  open,
  onOpenChange,
  parceiro,
  indicador,
  propostas,
  projetos,
  contas,
  contratos,
  onAtualizar,
}: ParceiroDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'demandas' | 'timeline'>('visao_geral')
  const [timelineLogs, setTimelineLogs] = useState<AuditLogRecord[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Carregar histórico de auditoria do parceiro (mesmo mecanismo da Etapa 3 / EmpresaTimelineTab)
  useEffect(() => {
    if (!open || !parceiro?.id) return

    const loadAudit = async () => {
      setLoadingTimeline(true)
      try {
        // Busca logs onde registro_id seja o id da empresa OU onde detalhes contenham a empresa
        const res = await auditService.list(1, 100)
        const filtered = res.items.filter((item) => {
          if (item.registro_id === parceiro.id) return true
          const detalhes = item.detalhes as Record<string, unknown> | undefined
          if (!detalhes) return false
          const empId =
            (detalhes.empresa_id as string) ||
            (detalhes.depois && (detalhes.depois as Record<string, unknown>).empresa) ||
            (detalhes.antes && (detalhes.antes as Record<string, unknown>).empresa)
          return empId === parceiro.id
        })
        setTimelineLogs(filtered)
      } catch {
        setTimelineLogs([])
      } finally {
        setLoadingTimeline(false)
      }
    }

    loadAudit()
  }, [open, parceiro?.id])

  if (!parceiro) return null

  // Filtrar dados vinculados
  const empProps = propostas.filter((p) => p.empresa === parceiro.id)
  const empPropIds = new Set(empProps.map((p) => p.id))
  const empProjs = projetos.filter((pj) => pj.proposta && empPropIds.has(pj.proposta))
  const empProjIds = new Set(empProjs.map((pj) => pj.id))
  const empContas = contas.filter(
    (c) => (c.proposta && empPropIds.has(c.proposta)) || (c.projeto && empProjIds.has(c.projeto)),
  )
  const empContratos = contratos.filter((c) => c.empresa === parceiro.id)

  const curvaColor =
    indicador?.curvaDinamica === 'A'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : indicador?.curvaDinamica === 'B'
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : 'bg-amber-100 text-amber-800 border-amber-300'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {parceiro.razao_social}
                  </DialogTitle>
                  <Badge variant="outline" className={`font-mono font-bold text-xs ${curvaColor}`}>
                    Curva {indicador?.curvaDinamica || parceiro.curva || 'C'}
                  </Badge>
                  {indicador?.isSemDemandaCritica && (
                    <Badge variant="destructive" className="text-[11px] gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Sem Demanda há {indicador.diasSemDemanda} dias
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  {parceiro.nome_fantasia ? `${parceiro.nome_fantasia} • ` : ''}
                  CNPJ: {formatCnpj(parceiro.cnpj) || 'Não informado'} •{' '}
                  {parceiro.municipio
                    ? `${parceiro.municipio}/${parceiro.uf}`
                    : 'Localização não informada'}
                </DialogDescription>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase">
                Receita Acumulada
              </div>
              <div className="text-lg font-bold text-blue-700">
                {formatCurrencyBr(indicador?.receitaAcumulada || 0)}
              </div>
              <span className="text-[11px] text-slate-400">
                Score Demanda:{' '}
                <strong className="text-slate-700">{indicador?.scoreDemanda ?? 50}/100</strong>
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* 3 ABAS REQUISITADAS NO ITEM A2: Visão Geral, Histórico de Demandas, Linha do Tempo */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'visao_geral' | 'demandas' | 'timeline')}
          className="mt-4"
        >
          <TabsList className="grid grid-cols-3 w-full bg-slate-100">
            <TabsTrigger value="visao_geral" className="text-xs font-medium gap-2">
              <Building2 className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="demandas" className="text-xs font-medium gap-2">
              <FileText className="w-4 h-4" />
              Histórico de Demandas ({empProps.length + empProjs.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs font-medium gap-2">
              <History className="w-4 h-4" />
              Linha do Tempo ({timelineLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: VISÃO GERAL */}
          <TabsContent value="visao_geral" className="space-y-4 mt-4">
            {/* Cards de Indicadores do Parceiro (A5) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Ticket Médio
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {formatCurrencyBr(indicador?.ticketMedio || 0)}
                  </div>
                  <span className="text-[10px] text-slate-400">por demanda aceita</span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Margem Média
                  </span>
                  <div className="text-sm font-bold text-emerald-700 mt-1">
                    {indicador?.margemMedia || 35}%
                  </div>
                  <span className="text-[10px] text-slate-400">margem bruta das propostas</span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Prazo Médio Pagto
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {indicador?.prazoMedioPagamentoDias || 30} dias
                  </div>
                  <span className="text-[10px] text-slate-400">liquidação de contas a receber</span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                    Última Demanda
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {indicador?.ultimaDemandaData
                      ? formatDateBr(indicador.ultimaDemandaData)
                      : 'Sem registro'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {indicador?.diasSemDemanda !== undefined
                      ? `há ${indicador.diasSemDemanda} dias`
                      : '-'}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Score de Capacidade de Demanda (A4) Detalhado */}
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-950">
                    <Award className="w-4 h-4 text-blue-600" />
                    Score de Capacidade de Demanda: {indicador?.scoreDemanda ?? 50}/100
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white text-blue-700 border-blue-200"
                  >
                    Ranking #{indicador?.ranking || 1}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600">
                  Cálculo automático sob demanda com base em contratos públicos ativos, taxa de
                  conversão e projetos por ano.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Contratos Ativos:</span>
                    <strong className="text-slate-800 text-sm">
                      {indicador?.contratosAtivosQtd || empContratos.length} (
                      {formatCurrencyBr(indicador?.contratosAtivosValor || 0)})
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Taxa de Conversão:</span>
                    <strong className="text-slate-800 text-sm">
                      {indicador?.taxaConversao || 0}% ({indicador?.totalPropostasAceitas || 0}/
                      {indicador?.totalPropostasEnviadas || 0})
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Projetos por Ano:</span>
                    <strong className="text-slate-800 text-sm">
                      {indicador?.projetosPorAno || empProjs.length} projeto(s)
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados Cadastrais e Contratos Ativos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-200">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
                    Dados Cadastrais da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Razão Social:</span>{' '}
                    <strong className="text-slate-800">{parceiro.razao_social}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">CNAE Principal:</span>{' '}
                    <span className="text-slate-700">{parceiro.cnae || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Porte:</span>{' '}
                    <span className="text-slate-700">{parceiro.porte || 'MÉDIO'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">E-mail Comercial:</span>{' '}
                    <a href={`mailto:${parceiro.email}`} className="text-blue-600 hover:underline">
                      {parceiro.email || 'Não informado'}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500">Telefone:</span>{' '}
                    <span className="text-slate-700">
                      {formatPhoneBr(parceiro.telefone) || 'Não informado'}
                    </span>
                  </div>
                  {parceiro.observacoes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500 block mb-1">Observações Comerciais:</span>
                      <p className="p-2 bg-slate-50 rounded text-slate-600 text-[11px]">
                        {parceiro.observacoes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
                    Contratos Públicos Ativos ({empContratos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  {empContratos.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">
                      Nenhum contrato público cadastrado.
                    </p>
                  ) : (
                    empContratos.map((ct) => (
                      <div
                        key={ct.id}
                        className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{ct.numero}</span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrencyBr(ct.valor || 0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          {ct.objeto || ct.orgao}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Órgão: {ct.orgao}</span>
                          <span>Vigência até: {formatDateBr(ct.vigencia_fim)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 2: HISTÓRICO DE DEMANDAS (Propostas e Projetos fictícios existentes) */}
          <TabsContent value="demandas" className="space-y-4 mt-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Propostas Comerciais Vinculadas ({empProps.length})
              </h4>
              {empProps.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  Nenhuma proposta comercial registrada para este parceiro.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {empProps.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 transition-colors space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 font-mono">
                            {prop.numero}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold ${
                              prop.status === 'aceita'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : prop.status === 'recusada'
                                  ? 'bg-red-50 text-red-700 border-red-300'
                                  : 'bg-blue-50 text-blue-700 border-blue-300'
                            }`}
                          >
                            {prop.status.replace('_', ' ')}
                          </Badge>
                          {prop.disciplinas && (
                            <span className="text-[11px] text-slate-500">({prop.disciplinas})</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-emerald-700">
                            {formatCurrencyBr(prop.preco)}
                          </span>
                          {prop.margem && (
                            <span className="text-[11px] text-slate-400 ml-2">
                              Margem: {prop.margem}%
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                        <strong>Escopo:</strong> {prop.escopo}
                      </p>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>
                          Prazo: {prop.prazo || '30 dias'} • Pagamento:{' '}
                          {prop.condicoes_pagamento || 'Faturamento 30d'}
                        </span>
                        <span>Cadastrada em: {formatDateBr(prop.created)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Projetos Executivos em Andamento / Concluídos ({empProjs.length})
              </h4>
              {empProjs.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  Nenhum projeto de engenharia executivo em andamento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {empProjs.map((prj) => (
                    <div
                      key={prj.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-indigo-950">
                          {prj.codigo}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            prj.saude === 'verde'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : prj.saude === 'amarelo'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-red-50 text-red-700 border-red-300'
                          }`}
                        >
                          Saúde {prj.saude || 'verde'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600">
                        Status:{' '}
                        <strong className="text-slate-800">{prj.status || 'Em andamento'}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Iniciado em: {formatDateBr(prj.created)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerta de Parceiro Reincidente em Atraso (Etapa 9 - Item E) */}
            {(() => {
              const totalAtrasos = empContas.filter((c) => {
                if (c.status === 'atrasada') return true
                if (
                  (c.status === 'paga' || c.status === 'realizada') &&
                  c.vencimento &&
                  c.data_pagamento
                ) {
                  return c.data_pagamento.substring(0, 10) > c.vencimento.substring(0, 10)
                }
                return false
              }).length

              if (totalAtrasos > 0) {
                return (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-start gap-2.5 text-xs text-rose-900 mt-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block">
                        Alerta de Inadimplência / Atraso Reincidente:
                      </strong>
                      Este parceiro possui{' '}
                      <span className="font-bold underline">
                        {totalAtrasos} ocorrência(s) de atraso
                      </span>{' '}
                      registrada(s) no histórico de pagamentos de faturamento e parcelas. Avalie
                      exigir sinal antecipado ou garantias financeiras adicionais para novas
                      propostas.
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Contas a receber ligadas */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Contas a Receber / Faturamento ({empContas.length})
              </h4>{' '}
              {empContas.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum faturamento registrado.</p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {empContas.map((ct) => (
                    <div
                      key={ct.id}
                      className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{ct.descricao}</span>
                        <span className="text-[11px] text-slate-400 block">
                          Vencimento: {formatDateBr(ct.vencimento)} •{' '}
                          {ct.forma_pagamento || 'Boleto'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {formatCurrencyBr(ct.valor)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] block uppercase ${
                            ct.status === 'paga'
                              ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                              : 'text-amber-700 border-amber-200 bg-amber-50'
                          }`}
                        >
                          {ct.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA 3: LINHA DO TEMPO (Alimentada pela auditoria imutável) */}
          <TabsContent value="timeline" className="space-y-4 mt-4">
            {loadingTimeline ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2" />
                Carregando eventos de auditoria...
              </div>
            ) : timelineLogs.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Nenhum evento auditado para este parceiro.
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-2">
                {timelineLogs.map((log) => {
                  const isCriacao = log.acao === 'CRIACAO'
                  const isEdicao = log.acao === 'EDICAO'
                  const userName = log.expand?.user?.name || log.user_email || 'Sistema / Usuário'

                  return (
                    <div key={log.id} className="relative pl-6">
                      <div
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                          isCriacao
                            ? 'border-emerald-500 bg-emerald-100'
                            : isEdicao
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-slate-400 bg-slate-100'
                        }`}
                      />
                      <div className="bg-white border border-slate-200 rounded p-3 shadow-xs space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold ${
                                isCriacao
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : isEdicao
                                    ? 'text-blue-700 bg-blue-50'
                                    : 'text-slate-700'
                              }`}
                            >
                              {log.acao}
                            </Badge>
                            <span className="font-semibold text-slate-800">{log.entidade}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateTimeBr(log.created)}
                          </span>
                        </div>

                        {log.detalhes?.mensagem && (
                          <p className="text-slate-700 bg-slate-50 p-1.5 rounded text-[11px]">
                            {String(log.detalhes.mensagem)}
                          </p>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                          <span>Por: {userName}</span>
                          {log.ip && <span>IP: {log.ip}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
