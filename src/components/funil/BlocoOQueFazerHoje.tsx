import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  oQueFazerHojeService,
  ItemOQueFazerHoje,
  AcaoNutricaoOQueFazerHoje,
} from '@/services/oQueFazerHoje'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Phone,
  Mail,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  Building2,
  CheckCircle,
  HelpCircle,
  UserCheck,
} from 'lucide-react'
import { formatDateBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'

interface BlocoOQueFazerHojeProps {
  onRecarregarPai?: () => void
  onOpenEmpresaDetalhes?: (empresaId: string) => void
}

export function BlocoOQueFazerHoje({
  onRecarregarPai,
  onOpenEmpresaDetalhes,
}: BlocoOQueFazerHojeProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [paraHoje, setParaHoje] = useState<ItemOQueFazerHoje[]>([])
  const [emAtraso, setEmAtraso] = useState<ItemOQueFazerHoje[]>([])
  const [sugestoesNutricao, setSugestoesNutricao] = useState<AcaoNutricaoOQueFazerHoje[]>([])
  const [tabAtiva, setTabAtiva] = useState<'para_hoje' | 'em_atraso' | 'nutricao' | 'sem_cotacao'>(
    'para_hoje',
  )

  const carregar = async () => {
    setLoading(true)
    try {
      const res = await oQueFazerHojeService.obter()
      setParaHoje(res.para_hoje || [])
      setEmAtraso(res.em_atraso || [])
      setSugestoesNutricao(res.sugestoes_nutricao || [])
      setSemCotacao(res.sem_cotacao || [])
    } catch (err) {
      console.error('Falha ao carregar o que fazer hoje:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const [semCotacao, setSemCotacao] = useState<any[]>([])
  const totalHoje = paraHoje.length
  const totalAtraso = emAtraso.length
  const totalNutricao = sugestoesNutricao.length
  const totalSemCotacao = semCotacao.length
  const totalGeral = totalHoje + totalAtraso + totalNutricao + totalSemCotacao

  const renderBadgeCurva = (curva?: string) => {
    const c = curva || 'C'
    const bg =
      c === 'A'
        ? 'bg-emerald-100 text-emerald-800'
        : c === 'B'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-slate-100 text-slate-700'
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${bg}`}>
        Curva {c}
      </span>
    )
  }

  return (
    <Card className="border border-orange-200/80 shadow-xs bg-linear-to-b from-orange-50/30 to-white">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#D95A2B]/10 text-[#D95A2B] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-slate-900">
                  O que Fazer Hoje — Central Unificada
                </CardTitle>
                <Badge className="bg-[#D95A2B] text-white text-[10px] font-mono">
                  {totalGeral} prioridade(s)
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Consolidação ao vivo de intervenções comerciais, prazos atrasados e ações de
                nutrição. Respeita estritamente a lista Não Contatar (LGPD).
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={carregar}
              disabled={loading}
              className="text-xs h-8 text-slate-600 hover:text-[#D95A2B]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
          </div>
        </div>

        {/* Abas internas do bloco */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 mt-2">
          <button
            onClick={() => setTabAtiva('para_hoje')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tabAtiva === 'para_hoje'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Para Hoje ({totalHoje})
          </button>
          <button
            onClick={() => setTabAtiva('em_atraso')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tabAtiva === 'em_atraso'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Em Atraso ({totalAtraso})
          </button>
          <button
            onClick={() => setTabAtiva('nutricao')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tabAtiva === 'nutricao'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sugestões de Nutrição ({totalNutricao})
          </button>
          <button
            onClick={() => setTabAtiva('sem_cotacao')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tabAtiva === 'sem_cotacao'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Sem Cotação ({totalSemCotacao})
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#D95A2B]" />
            Calculando prioridades do dia no servidor...
          </div>
        ) : (
          <div>
            {/* ABA: PARA HOJE */}
            {tabAtiva === 'para_hoje' && (
              <div className="space-y-2">
                {paraHoje.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                    Nenhuma ação comercial agendada para hoje. Tudo em dia!
                  </div>
                ) : (
                  paraHoje.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {item.empresa_nome}
                          </span>
                          {renderBadgeCurva(item.curva)}
                          <span className="text-[11px] text-slate-500 font-mono">
                            {formatCnpj(item.cnpj)}
                          </span>
                          {item.nao_contatar && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                              title={`Bloqueio LGPD: ${item.motivo_bloqueio || 'Empresa na lista Não Contatar'}`}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Não contatar (LGPD)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-1 flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {item.tipo === 'toque'
                              ? `Toque ${item.numero_toque}`
                              : 'Ação de Próxima Intervenção'}
                            :
                          </span>
                          <span className="truncate">{item.descricao || 'Sem descrição'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.canal && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {item.canal === 'email' ? (
                              <Mail className="w-3 h-3 mr-1" />
                            ) : (
                              <Phone className="w-3 h-3 mr-1" />
                            )}
                            {item.canal}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (onOpenEmpresaDetalhes) {
                              onOpenEmpresaDetalhes(item.empresa_id)
                            } else {
                              navigate(`/empresas`)
                            }
                          }}
                          className="h-7 text-xs text-slate-700 hover:text-blue-700"
                        >
                          Ver Empresa &rarr;
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ABA: EM ATRASO */}
            {tabAtiva === 'em_atraso' && (
              <div className="space-y-2">
                {emAtraso.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                    Nenhuma ação comercial em atraso. Excelente!
                  </div>
                ) : (
                  emAtraso.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-rose-50/40 rounded-lg border border-rose-200 hover:border-rose-400 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {item.empresa_nome}
                          </span>
                          {renderBadgeCurva(item.curva)}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 font-mono">
                            {item.dias_atraso}d em atraso
                          </span>
                          {item.nao_contatar && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                              title={`Bloqueio LGPD: ${item.motivo_bloqueio || 'Empresa na lista Não Contatar'}`}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Não contatar (LGPD)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-1 flex items-center gap-2">
                          <span className="font-semibold text-rose-900">
                            {item.tipo === 'toque' ? `Toque ${item.numero_toque}` : 'Ação Agendada'}
                            :
                          </span>
                          <span className="truncate">{item.descricao || 'Sem descrição'}</span>
                        </div>
                        {item.data_prevista && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Data prevista era: {formatDateBr(item.data_prevista)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (onOpenEmpresaDetalhes) {
                              onOpenEmpresaDetalhes(item.empresa_id)
                            } else {
                              navigate(`/empresas`)
                            }
                          }}
                          className="h-7 text-xs border-rose-300 text-rose-800 hover:bg-rose-100"
                        >
                          Regularizar &rarr;
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ABA: SUGESTÕES DE NUTRIÇÃO */}
            {tabAtiva === 'nutricao' && (
              <div className="space-y-2">
                {sugestoesNutricao.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                    Nenhuma sugestão de nutrição pendente no momento.
                  </div>
                ) : (
                  sugestoesNutricao.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-indigo-50/40 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {item.empresa_nome}
                          </span>
                          {renderBadgeCurva(item.curva)}
                          <Badge
                            variant="outline"
                            className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px]"
                          >
                            {item.tipo_acao}
                          </Badge>
                          {item.nao_contatar && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                              title={`Bloqueio LGPD: ${item.motivo_bloqueio || 'Empresa na lista Não Contatar'}`}
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Não contatar (LGPD)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 line-clamp-2">{item.motivo}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (onOpenEmpresaDetalhes) {
                              onOpenEmpresaDetalhes(item.empresa_id)
                            } else {
                              navigate(`/empresas`)
                            }
                          }}
                          className="h-7 text-xs border-indigo-300 text-indigo-800 hover:bg-indigo-100"
                        >
                          Ver Ficha &rarr;
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ABA: SEM COTAÇÃO (RODADA 13) */}
            {tabAtiva === 'sem_cotacao' && (
              <div className="space-y-2">
                {semCotacao.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                    Nenhum item de proposta sem cotação elegível. Todos os serviços estão cobertos!
                  </div>
                ) : (
                  semCotacao.map((item) => (
                    <div
                      key={item.item_id}
                      className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]">
                            Sem Cotação
                          </Badge>
                          <span className="font-bold text-slate-900 truncate">
                            {item.descricao_item}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-[11px] font-semibold text-slate-600">
                            Disciplina: {item.disciplina}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">
                          Item mantido com custo de catálogo padrão por falta de prestadores
                          elegíveis ativos. Recomenda-se disparar recrutamento público para a
                          disciplina.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            navigate('/prestadores')
                          }}
                          className="h-7 text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          Recrutar Prestadores
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
