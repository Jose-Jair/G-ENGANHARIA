import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResumoDiarioGestorRecord } from '@/types'
import { formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { monitoramentoPrazosService } from '@/services/monitoramentoPrazos'
import { iaOperacaoService, type IaResumoDiaResponse } from '@/services/iaOperacao'
import { useToast } from '@/hooks/use-toast'

interface CardResumoDiarioGestorProps {
  resumo: ResumoDiarioGestorRecord | null
  carregando: boolean
  onAtualizar: () => void
}

export const CardResumoDiarioGestor: React.FC<CardResumoDiarioGestorProps> = ({
  resumo,
  carregando,
  onAtualizar,
}) => {
  const { toast } = useToast()
  const [executando, setExecutando] = useState(false)

  // IA: Resumo do Dia
  const [gerandoResumoIa, setGerandoResumoIa] = useState(false)
  const [resumoIa, setResumoIa] = useState<IaResumoDiaResponse['rascunho'] | null>(null)
  const [erroResumoIa, setErroResumoIa] = useState<string | null>(null)
  const [expandirResumoIa, setExpandirResumoIa] = useState(true)

  const handleDispararMonitoramento = async () => {
    setExecutando(true)
    try {
      const res = await monitoramentoPrazosService.executarMonitoramento()
      toast({
        title: 'Monitoramento executado com sucesso',
        description: `${res.novos_eventos_criados} novo(s) evento(s) de cobrança gerado(s). ${res.total_os_monitoradas} OS monitoradas.`,
      })
      onAtualizar()
    } catch (err: any) {
      toast({
        title: 'Falha ao executar monitoramento',
        description: err?.message || 'Erro ao sincronizar com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setExecutando(false)
    }
  }

  // IA: Geração sob demanda do Resumo do Dia
  const handleGerarResumoDiaIa = async () => {
    setGerandoResumoIa(true)
    setErroResumoIa(null)
    try {
      const resp = await iaOperacaoService.gerarResumoDia()
      setResumoIa(resp.rascunho)
      setExpandirResumoIa(true)
      toast({
        title: 'Resumo do Dia (IA) gerado com sucesso!',
        description:
          'Texto executivo compilado a partir do monitoramento de prazos e do fluxo operacional.',
      })
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao gerar o resumo diário com IA.'
      setErroResumoIa(msg)
      toast({
        title: 'Não foi possível gerar Resumo com IA',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setGerandoResumoIa(false)
    }
  }

  const itens = resumo?.itens_atencao_json || []

  return (
    <Card className="border-slate-200 shadow-xs overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#1E2A4A] to-[#2B3B66] text-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-amber-300">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold tracking-tight text-white">
                  Resumo Diário da Gestão de Prazos
                </CardTitle>
                <Badge className="bg-[#D95A2B] text-white text-[10px] font-mono border-0">
                  {resumo?.data_referencia ? formatDateBr(resumo.data_referencia) : 'Hoje'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Visão consolidada do que atrasou e do que exige intervenção imediata do Gestor de
                Projetos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGerarResumoDiaIa}
              disabled={gerandoResumoIa || carregando}
              className="h-7 text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white border-0 gap-1.5 font-medium shadow-xs"
              title="Gera o texto corrido do Resumo do Dia para o Gestor com IA"
            >
              {gerandoResumoIa ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando Resumo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Gerar Resumo do Dia (IA)</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDispararMonitoramento}
              disabled={executando || carregando}
              className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1"
              title="Disparar verificação sob demanda agora"
            >
              {executando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>Verificar Agora</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onAtualizar}
              disabled={carregando}
              className="h-7 w-7 p-0 text-white hover:bg-white/10"
              title="Atualizar dados do resumo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* BLOCO IA: RESUMO DO DIA CORRIDO GERADO SOB DEMANDA */}
        {erroResumoIa && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{erroResumoIa}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setErroResumoIa(null)}
              className="h-6 text-[10px] text-amber-800 p-0"
            >
              Fechar
            </Button>
          </div>
        )}

        {resumoIa && (
          <div className="p-4 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/40 border border-orange-200 rounded-xl space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-[#D95A2B] text-white text-[10px] gap-1">
                  <Sparkles className="w-3 h-3 text-white" />
                  Resumo Executivo (IA)
                </Badge>
                <span className="text-xs font-bold text-slate-900">{resumoIa.titulo_resumo}</span>
                {resumoIa.status_geral_operacao && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] uppercase ${
                      resumoIa.status_geral_operacao === 'verde'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : resumoIa.status_geral_operacao === 'amarelo'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    Semáforo Geral: {resumoIa.status_geral_operacao}
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandirResumoIa(!expandirResumoIa)}
                className="h-6 text-xs text-slate-500 hover:text-slate-900 p-1 gap-1"
              >
                {expandirResumoIa ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            {expandirResumoIa && (
              <div className="space-y-3 pt-1">
                {/* Texto corrido estruturado */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-line shadow-2xs">
                  {resumoIa.texto_corrido}
                </div>

                {/* Destaques operacionais & financeiros em cards compactos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {resumoIa.destaques_operacionais &&
                    resumoIa.destaques_operacionais.length > 0 && (
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1">
                        <span className="font-bold text-blue-900 text-[11px] block">
                          Destaques da Operação:
                        </span>
                        <ul className="space-y-0.5 text-blue-950 text-[11px]">
                          {resumoIa.destaques_operacionais.map((d, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 shrink-0" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {resumoIa.acoes_recomendadas && resumoIa.acoes_recomendadas.length > 0 && (
                    <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-1">
                      <span className="font-bold text-emerald-900 text-[11px] block">
                        Ações Recomendadas ao Gestor:
                      </span>
                      <ul className="space-y-0.5 text-emerald-950 text-[11px]">
                        {resumoIa.acoes_recomendadas.map((a, aIdx) => (
                          <li key={aIdx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Métricas do Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500 block">
              OS Monitoradas
            </span>
            <strong className="text-lg font-bold text-slate-800">
              {resumo?.total_os_monitoradas ?? 0}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-semibold uppercase text-rose-700 block">
              OS Atrasadas
            </span>
            <strong className="text-lg font-bold text-rose-800">
              {resumo?.total_os_atrasadas ?? 0}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-semibold uppercase text-amber-700 block">
              Entregáveis Atrasados
            </span>
            <strong className="text-lg font-bold text-amber-800">
              {resumo?.total_entregaveis_atrasados ?? 0}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200">
            <span className="text-[10px] font-semibold uppercase text-sky-700 block">
              Revisões Estagnadas
            </span>
            <strong className="text-lg font-bold text-sky-800">
              {resumo?.total_revisoes_estagnadas ?? 0}
            </strong>
          </div>

          <div className="p-2.5 rounded-lg bg-red-100 border border-red-300 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-semibold uppercase text-red-800 block">
              Escalonamentos D+3
            </span>
            <strong className="text-lg font-bold text-red-900">
              {resumo?.total_escalonamentos ?? 0}
            </strong>
          </div>
        </div>

        {/* Itens que Exigem Atenção / Decisão do Gestor */}
        {itens.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Itens Críticos para Decisão do Gestor ({itens.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Última compilação: {resumo?.gerado_em ? formatDateTimeBr(resumo.gerado_em) : 'Hoje'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {itens.map((item, idx) => {
                const isEscalonado = item.tipo === 'os_escalonada'
                return (
                  <div
                    key={item.id || idx}
                    className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 transition-colors ${
                      isEscalonado ? 'bg-rose-50/70 border-rose-200' : 'bg-sky-50/70 border-sky-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-900 font-bold truncate">
                          {item.numero || item.nome || 'Item Crítico'}
                        </strong>
                        <Badge
                          className={`text-[9px] uppercase font-bold shrink-0 ${
                            isEscalonado ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
                          }`}
                        >
                          {isEscalonado ? 'Escalonado D+3' : 'SLA Revisão Excedido'}
                        </Badge>
                      </div>

                      <div className="mt-1 space-y-0.5 text-slate-600 text-[11px]">
                        {item.disciplina && (
                          <p>
                            Disciplina: <strong>{item.disciplina}</strong>
                          </p>
                        )}
                        {item.prestador_nome && (
                          <p>
                            Prestador: <strong>{item.prestador_nome}</strong>
                          </p>
                        )}
                        {isEscalonado && item.dias_atraso !== undefined && (
                          <p className="text-rose-700 font-semibold">
                            Atraso atual: {item.dias_atraso} dia(s)
                          </p>
                        )}
                        {!isEscalonado && item.horas_em_revisao !== undefined && (
                          <p className="text-sky-800 font-semibold">
                            Em revisão interna há {item.horas_em_revisao}h (SLA:{' '}
                            {item.sla_horas || 48}h)
                          </p>
                        )}
                        {item.prazo_previsto && (
                          <p className="text-slate-500 text-[10px]">
                            Prazo previsto: {formatDateBr(item.prazo_previsto)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
            <span>
              <strong>Tudo em conformidade:</strong> Nenhuma OS em atraso crítico (D+3) ou
              entregável com SLA de revisão interna estagnado hoje.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CardResumoDiarioGestor
