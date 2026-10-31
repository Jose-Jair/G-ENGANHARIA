import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Search,
  Scale,
  Users,
  Clock,
  ArrowRight,
  Info,
  Loader2,
} from 'lucide-react'
import { custoInternoService } from '@/services/custoInterno'
import { IndicadorFazerDentroFora } from '@/types'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

export const PainelFazerDentroFora: React.FC = () => {
  const { toast } = useToast()
  const [indicadores, setIndicadores] = useState<IndicadorFazerDentroFora[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroRecomendacao, setFiltroRecomendacao] = useState<
    'todas' | 'fazer_dentro' | 'fazer_fora'
  >('todas')

  const carregarIndicadores = async () => {
    setCarregando(true)
    try {
      const res = await custoInternoService.obterIndicadoresFazerDentroFora()
      if (res && res.indicadores) {
        setIndicadores(res.indicadores)
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores de custo interno:', err)
      toast({
        title: 'Falha ao carregar indicadores',
        description: 'Não foi possível consultar os indicadores de fazer dentro ou fora.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarIndicadores()
  }, [])

  const filtrados = indicadores.filter((item) => {
    const matchBusca =
      !filtroBusca || item.disciplina.toLowerCase().includes(filtroBusca.toLowerCase())
    const matchRec = filtroRecomendacao === 'todas' || item.recomendacao === filtroRecomendacao
    return matchBusca && matchRec
  })

  const totalDentro = indicadores.filter((i) => i.recomendacao === 'fazer_dentro').length
  const totalFora = indicadores.filter((i) => i.recomendacao === 'fazer_fora').length

  return (
    <div className="space-y-4">
      {/* Resumo de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total de Disciplinas Analisadas
              </span>
              <span className="text-2xl font-bold text-slate-900">{indicadores.length}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Scale className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Recomendação: Fazer Dentro
              </span>
              <span className="text-2xl font-bold text-emerald-900">{totalDentro}</span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">
                Custo interno mais econômico
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
                Recomendação: Fazer Fora
              </span>
              <span className="text-2xl font-bold text-blue-900">{totalFora}</span>
              <span className="text-[10px] text-blue-700 block mt-0.5">
                Subcontratação mais vantajosa
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Comparação */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 md:p-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#D95A2B]" />
                Indicador Estratégico: Fazer Dentro ou Fora por Disciplina
              </CardTitle>
              <CardDescription className="text-xs">
                Compara o custo interno apurado (horas × custo_hora contratado, base pacote 40h) com
                referências externas vinculantes (pré-cotações da Rodada 13 ou catálogo).
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarIndicadores}
              disabled={carregando}
              className="text-xs gap-1.5 h-8"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recalcular Indicadores
                </>
              )}
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Filtrar por disciplina..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Button
                variant={filtroRecomendacao === 'todas' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroRecomendacao('todas')}
                className="text-xs h-8 px-2.5"
              >
                Todas ({indicadores.length})
              </Button>
              <Button
                variant={filtroRecomendacao === 'fazer_dentro' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroRecomendacao('fazer_dentro')}
                className="text-xs h-8 px-2.5 text-emerald-700"
              >
                Fazer Dentro ({totalDentro})
              </Button>
              <Button
                variant={filtroRecomendacao === 'fazer_fora' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroRecomendacao('fazer_fora')}
                className="text-xs h-8 px-2.5 text-blue-700"
              >
                Fazer Fora ({totalFora})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Disciplina</th>
                  <th className="py-3 px-4 text-right">Custo Interno / Hora</th>
                  <th className="py-3 px-4 text-right">Custo Interno (Pacote 40h)</th>
                  <th className="py-3 px-4 text-right">Referência Externa</th>
                  <th className="py-3 px-4">Origem Externa</th>
                  <th className="py-3 px-4 text-center">Disponíveis Internos</th>
                  <th className="py-3 px-4 text-center">Recomendação</th>
                  <th className="py-3 px-4 text-right">Vantagem Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {carregando ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D95A2B]" />
                      Calculando indicadores por disciplina...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhuma disciplina encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => {
                    const isDentro = item.recomendacao === 'fazer_dentro'
                    const isFora = item.recomendacao === 'fazer_fora'

                    return (
                      <tr key={item.disciplina} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.disciplina}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {item.custo_interno_hora > 0
                            ? formatCurrencyBr(item.custo_interno_hora)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {item.custo_interno_padrao_40h > 0
                            ? formatCurrencyBr(item.custo_interno_padrao_40h)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {item.referencia_externa_valor > 0
                            ? formatCurrencyBr(item.referencia_externa_valor)
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {item.origem_referencia_externa === 'pre_cotacao' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-medium"
                            >
                              Pré-Cotação (R13)
                            </Badge>
                          )}
                          {item.origem_referencia_externa === 'catalogo' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-medium"
                            >
                              Catálogo Padrão
                            </Badge>
                          )}
                          {item.origem_referencia_externa === 'sem_referencia' && (
                            <span className="text-slate-400 text-[11px]">Sem cotação</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {item.prestadores_internos_disponiveis}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isDentro ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] gap-1 py-0.5">
                              <TrendingDown className="w-3 h-3" />
                              Fazer Dentro
                            </Badge>
                          ) : isFora ? (
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] gap-1 py-0.5">
                              <TrendingUp className="w-3 h-3" />
                              Fazer Fora
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-600 text-[10px] gap-1 py-0.5"
                            >
                              <Minus className="w-3 h-3 text-slate-400" />
                              Indiferente
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.economia_estimada_perc > 0 ? (
                            <span
                              className={`font-mono font-bold text-xs ${
                                isDentro ? 'text-emerald-700' : 'text-blue-700'
                              }`}
                            >
                              {item.economia_estimada_perc.toFixed(1)}%{' '}
                              {isDentro ? 'economia' : 'vantagem fora'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              <strong>Critério de Decisão:</strong> Compara o valor de um pacote padrão de 40 horas
              executado internamente versus a menor proposta técnica de pré-cotação vinculante ou
              preço de referência no catálogo. Disciplinas sem corpo técnico interno recomendam
              automaticamente subcontratação externa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PainelFazerDentroFora
