import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Briefcase,
  Loader2,
  RefreshCw,
  AlertOctagon,
  Sparkles,
} from 'lucide-react'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { cotacaoAutomaticaService } from '@/services/cotacaoAutomatica'
import { ProjetoEtapaRecord, RankingCotacoesPacoteResponse, ItemRankingCotacao } from '@/types'

interface ModalRankingCotacoesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacote: ProjetoEtapaRecord | null
  onSuccess?: () => void
}

export const ModalRankingCotacoes: React.FC<ModalRankingCotacoesProps> = ({
  open,
  onOpenChange,
  pacote,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [carregando, setCarregando] = useState(false)
  const [rankingData, setRankingData] = useState<RankingCotacoesPacoteResponse | null>(null)
  const [erroRanking, setErroRanking] = useState<string | null>(null)
  const [escolhendoId, setEscolhendoId] = useState<string | null>(null)
  const [bloqueioTetoMensagem, setBloqueioTetoMensagem] = useState<string | null>(null)

  const carregarRanking = async () => {
    if (!pacote) return
    setCarregando(true)
    setErroRanking(null)
    setBloqueioTetoMensagem(null)
    try {
      const data = await cotacaoAutomaticaService.obterRankingPacote(pacote.id)
      setRankingData(data)
    } catch (err: any) {
      setErroRanking(
        err?.response?.data?.error ||
          err?.message ||
          'Falha ao carregar ranking de propostas do servidor.',
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && pacote) {
      carregarRanking()
    } else {
      setRankingData(null)
      setErroRanking(null)
      setBloqueioTetoMensagem(null)
      setEscolhendoId(null)
    }
  }, [open, pacote?.id])

  const handleEscolher = async (item: ItemRankingCotacao) => {
    if (!item.preco_ofertado || item.preco_ofertado <= 0) {
      toast({
        title: 'Proposta sem preço',
        description: 'Não é possível escolher uma proposta que ainda não informou preço.',
        variant: 'destructive',
      })
      return
    }

    setEscolhendoId(item.cotacao_id)
    setBloqueioTetoMensagem(null)

    try {
      const resp = await cotacaoAutomaticaService.escolherPropostaGerarOS(item.cotacao_id)
      toast({
        title: 'Proposta escolhida!',
        description: `OS ${resp.numero_os} gerada com sucesso (${formatCurrencyBr(resp.valor_os)}).`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      const rawMsg =
        err?.response?.data?.error ||
        err?.data?.error ||
        err?.message ||
        'Erro ao escolher proposta e gerar OS.'

      if (
        rawMsg.toLowerCase().includes('teto') ||
        rawMsg.toLowerCase().includes('ultrapassa') ||
        rawMsg.toLowerCase().includes('bloqueio') ||
        rawMsg.toLowerCase().includes('soma de os') ||
        rawMsg.toLowerCase().includes('contrato-mestre')
      ) {
        setBloqueioTetoMensagem(rawMsg)
      } else {
        toast({
          title: 'Não foi possível aprovar',
          description: rawMsg,
          variant: 'destructive',
        })
      }
    } finally {
      setEscolhendoId(null)
    }
  }

  const renderBadgeTendencia = (tendencia: 'melhorou' | 'estavel' | 'piorou') => {
    if (tendencia === 'melhorou') {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1"
        >
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          Melhorou
        </Badge>
      )
    }
    if (tendencia === 'piorou') {
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1"
        >
          <TrendingDown className="w-3 h-3 text-rose-600" />
          Piorou
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-700 border-slate-300 text-[10px] gap-1"
      >
        <Minus className="w-3 h-3 text-slate-500" />
        Estável
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#D95A2B]/10 flex items-center justify-center text-[#D95A2B]">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
                  Ranking de Propostas do Pacote
                  <Badge
                    variant="outline"
                    className="bg-orange-50 text-[#D95A2B] border-orange-200 text-xs font-semibold"
                  >
                    Score Algorítmico
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Pacote: <strong>{pacote?.nome}</strong> • Disciplina:{' '}
                  <strong>{pacote?.disciplina || 'Engenharia'}</strong>
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={carregarRanking}
              disabled={carregando}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </DialogHeader>

        {/* Quadro de referências do pacote */}
        {pacote && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Teto Vendido (Contrato)</span>
              <span className="font-bold text-blue-900 text-sm">
                {formatCurrencyBr(pacote.valor_vendido || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Valor Referência Interna</span>
              <span className="font-bold text-slate-800 text-sm">
                {formatCurrencyBr(pacote.valor_interno_referencia || 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Total de Propostas</span>
              <span className="font-semibold text-slate-700 text-sm">
                {rankingData?.total || 0} convite(s)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Status Atual</span>
              <Badge variant="outline" className="text-[11px] mt-0.5">
                {pacote.ordem_servico_ativa ? 'OS Gerada' : 'Aguardando Escolha'}
              </Badge>
            </div>
          </div>
        )}

        {/* Bloqueio de Teto / Erro com destaque vermelho */}
        {bloqueioTetoMensagem && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              Bloqueio do Servidor — Trava de Teto Vendido / Contrato
            </div>
            <p className="leading-relaxed">{bloqueioTetoMensagem}</p>
          </div>
        )}

        {carregando ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-[#D95A2B]" />
            <p className="text-xs">Calculando score e ordenando propostas no servidor...</p>
          </div>
        ) : erroRanking ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Erro ao obter ranking:
            </div>
            <p>{erroRanking}</p>
          </div>
        ) : !rankingData || rankingData.ranking.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              Nenhuma cotação vinculada a este pacote de trabalho.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Marque o pacote como EXTERNO para disparar as cotações automáticas aos prestadores
              elegíveis.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {rankingData.ranking.map((item, idx) => {
              const ultrapassaRef = item.ultrapassa_referencia
              const ultrapassaTeto =
                rankingData.valor_vendido > 0 &&
                item.preco_ofertado > 0 &&
                item.preco_ofertado > rankingData.valor_vendido

              return (
                <div
                  key={item.cotacao_id}
                  className={`border rounded-xl p-4 transition-all shadow-xs ${
                    item.escolhida
                      ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-300'
                      : ultrapassaRef
                        ? 'border-rose-300 bg-rose-50/30'
                        : 'border-slate-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Linha 1: Posição, Nome do Prestador, Selos */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            idx === 0 ? 'bg-[#D95A2B] text-white' : 'bg-slate-800 text-white'
                          }`}
                        >
                          #{idx + 1}
                        </span>

                        <span className="font-bold text-slate-900 text-sm">
                          {item.prestador_nome}
                        </span>

                        <Badge
                          variant="outline"
                          className="bg-slate-50 text-slate-700 text-[10px] capitalize"
                        >
                          {item.prestador_tipo === 'pj_externo' ? 'PJ Externo' : 'PF Externo'}
                        </Badge>

                        {renderBadgeTendencia(item.tendencia)}

                        {item.escolhida && (
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Proposta Escolhida (OS Gerada)
                          </Badge>
                        )}

                        {item.status === 'convite_enviado' && !item.respondida && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            Aguardando Resposta
                          </Badge>
                        )}
                      </div>

                      {/* Linha 2: Indicadores Técnicos */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Preço Ofertado</span>
                          <span
                            className={`font-bold text-sm ${
                              ultrapassaRef ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {item.preco_ofertado > 0
                              ? formatCurrencyBr(item.preco_ofertado)
                              : 'Sem proposta'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block">Prazo Ofertado</span>
                          <span className="font-semibold text-slate-800">
                            {item.prazo_ofertado || 'A definir'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block">Nota Geral</span>
                          <span className="font-semibold text-slate-800">
                            {item.nota_geral ? item.nota_geral.toFixed(1) : '5.0'} / 5.0
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 block">Capacidade Livre</span>
                          <span className="font-semibold text-slate-800">
                            {item.capacidade_livre} vaga(s) (Carga: {item.carga_atual})
                          </span>
                        </div>
                      </div>

                      {/* Alertas de estouro de referência ou teto */}
                      {ultrapassaRef && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Proposta ultrapassa o valor de referência interna (
                            {formatCurrencyBr(rankingData.valor_interno_referencia)})
                          </span>
                        </div>
                      )}

                      {ultrapassaTeto && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-rose-900 font-bold">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>
                            Atenção: ultrapassa o teto vendido do contrato (
                            {formatCurrencyBr(rankingData.valor_vendido)}). Será bloqueado na
                            geração da OS.
                          </span>
                        </div>
                      )}

                      {item.observacoes && (
                        <p className="text-[11px] text-slate-500 italic pt-0.5">
                          Obs: "{item.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Coluna da direita: Score e Ação */}
                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                          Score Final
                        </span>
                        <span className="text-base font-bold text-[#D95A2B]">
                          {item.score_final} pts
                        </span>
                      </div>

                      {!item.escolhida && !pacote.ordem_servico_ativa && (
                        <Button
                          size="sm"
                          onClick={() => handleEscolher(item)}
                          disabled={escolhendoId === item.cotacao_id || !item.respondida}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-medium gap-1.5 shadow-xs"
                        >
                          {escolhendoId === item.cotacao_id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Gerando OS...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Escolher e gerar OS
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter className="pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
