import React, { useState, useEffect } from 'react'
import {
  funilSaudeService,
  SaudeFunilResponse,
  EmpresaEstagnadaSaude,
  ConversaoEtapaSaude,
  TempoPorEtapaSaude,
  MotivoDescarteAgrupado,
  DescarteRecenteItem,
  SugestaoNutricaoItem,
} from '@/services/funilSaude'
import { EmpresaRecord, UserRecord } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  UserX,
  RefreshCw,
  ArrowRight,
  Calendar,
  AlertCircle,
  Building2,
  ChevronRight,
  ShieldAlert,
  Info,
  Sparkles,
  Ban,
  Archive,
} from 'lucide-react'

interface FunilSaudeTabProps {
  users: UserRecord[]
  onOpenDetalhesEmpresa?: (empresaId: string) => void
  onNavigateToKanban?: () => void
  onRecarregarEmpresas?: () => void
}

export const FunilSaudeTab: React.FC<FunilSaudeTabProps> = ({
  users,
  onOpenDetalhesEmpresa,
  onNavigateToKanban,
  onRecarregarEmpresas,
}) => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [executandoAcao, setExecutandoAcao] = useState<string | null>(null)
  const [data, setData] = useState<SaudeFunilResponse | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregarSaude = async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await funilSaudeService.obterSaude()
      setData(res)
    } catch (err: any) {
      console.error('Erro ao carregar dados de saúde do funil:', err)
      const msg = err?.message || 'Falha ao obter indicadores de saúde do funil.'
      setErro(msg)
      toast({
        title: 'Erro de carregamento',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarSaude()
  }, [])

  const getUserName = (userId?: string) => {
    if (!userId) return 'Não atribuído'
    const found = users.find((u) => u.id === userId)
    return found ? found.name : 'Responsável'
  }

  // Estado esqueleto de carregamento com padrão da plataforma
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeleton Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
              <div className="h-7 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>

        {/* Skeleton Blocos 1 e 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-96">
            <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-96">
            <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Skeleton Blocos 3 e 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-80">
            <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-80">
            <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (erro && !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-8 text-center max-w-lg mx-auto">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Falha ao obter Saúde do Funil</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{erro}</p>
        <Button
          onClick={carregarSaude}
          size="sm"
          className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar Novamente
        </Button>
      </div>
    )
  }

  const resumo = data?.resumo
  const tempoPorEtapa = data?.tempo_por_etapa || []
  const estagnadas = data?.empresas_estagnadas || []
  const sugestoesNutricao = data?.sugestoes_nutricao || []
  const conversaoEtapas = data?.conversao_etapas || []
  const descartes = data?.descartes_por_motivo || { total: 0, agrupado: [], recentes: [] }

  const handleAcaoFimFunil = async (
    acao: 'migrar_nutricao' | 'marcar_nao_contatar',
    empresa: SugestaoNutricaoItem,
  ) => {
    if (!isAdmin) {
      toast({
        title: 'Acesso Negado',
        description: 'Ações de fim de funil são exclusivas para Administradores.',
        variant: 'destructive',
      })
      return
    }

    const nomeEmp = empresa.nome_fantasia || empresa.razao_social
    const confirmMsg =
      acao === 'migrar_nutricao'
        ? `Deseja migrar o lead "${nomeEmp}" para a etapa de Nutrição Mensal? Ele poderá retornar ao funil caso reative.`
        : `Deseja marcar o lead "${nomeEmp}" como NÃO CONTATAR? Isso bloqueará novos contatos comerciais e inativará o prospect.`

    if (!confirm(confirmMsg)) return

    setExecutandoAcao(`${acao}_${empresa.id}`)
    try {
      const res = await funilSaudeService.executarAcaoFimFunil({
        acao,
        empresa_id: empresa.id,
        motivo:
          acao === 'migrar_nutricao'
            ? 'Migração manual de fim de funil (>7 dias em proposta enviada)'
            : 'Fim de funil sem conversão marcado como Não Contatar',
      })

      toast({
        title: acao === 'migrar_nutricao' ? 'Migrado para Nutrição!' : 'Marcado como Não Contatar!',
        description: res.message,
      })

      carregarSaude()
      if (onRecarregarEmpresas) {
        onRecarregarEmpresas()
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao executar ação',
        description: err?.message || 'Falha ao processar solicitação.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoAcao(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo do Painel de Saúde: Indicadores Executivos e Botão Recarregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#D95A2B]" />
            <h2 className="text-lg font-bold tracking-tight">
              Painel de Saúde do Funil de Prospecção
            </h2>
            <Badge className="bg-[#D95A2B] text-white text-[10px] uppercase font-mono px-2">
              Em Tempo Real
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            "Enxugar passa a ser medido, não sentido." Diagnóstico contínuo de tempos, conversões e
            pontos de retenção.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarSaude}
            disabled={loading}
            className="text-xs text-slate-700 bg-white hover:bg-slate-100 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Diagnóstico
          </Button>
        </div>
      </div>

      {/* SEÇÃO ESPECIAL: SUGESTÃO DE FIM DE FUNIL (ENTREGA 3) */}
      <div className="bg-white rounded-xl border border-violet-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Sugestões de Fim de Funil (Nutrição Mensal)
            </h3>
            <Badge className="bg-violet-100 text-violet-800 border-violet-300 text-[10px] font-bold">
              {sugestoesNutricao.length} {sugestoesNutricao.length === 1 ? 'lead' : 'leads'}{' '}
              sugerido(s)
            </Badge>
          </div>
          <span className="text-[11px] text-slate-500">
            Critério: em <strong>Proposta Enviada há mais de 7 dias</strong> sem proposta aceita
          </span>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          O sistema apenas <strong>sugere</strong> — nunca migra automaticamente. Ações são
          exclusivas de <strong>Admin</strong>.
        </p>

        {sugestoesNutricao.length === 0 ? (
          <div className="h-32 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 text-slate-300 mb-1" />
            <span>Nenhum lead retido há mais de 7 dias em Proposta Enviada sem resposta.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-2 pr-3">Empresa / Lead</th>
                  <th className="py-2 px-2 text-center">Curva</th>
                  <th className="py-2 px-2 text-center">Dias sem Resposta</th>
                  <th className="py-2 px-2">Responsável</th>
                  <th className="py-2 pl-2 text-right">Ações (Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sugestoesNutricao.map((item) => {
                  const ocupado =
                    executandoAcao === `migrar_nutricao_${item.id}` ||
                    executandoAcao === `marcar_nao_contatar_${item.id}`
                  return (
                    <tr key={item.id} className="hover:bg-violet-50/40 transition-colors">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">
                          {item.nome_fantasia || item.razao_social}
                        </div>
                        {item.cnpj && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {formatCnpj(item.cnpj)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold font-mono ${
                            item.curva === 'A'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.curva === 'B'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          Curva {item.curva}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="font-mono font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded text-xs">
                          +{item.dias_na_etapa} dias
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-600 text-[11px]">
                        {getUserName(item.responsavel_id)}
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ocupado || !isAdmin}
                            onClick={() => handleAcaoFimFunil('migrar_nutricao', item)}
                            className="h-7 text-[10px] font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border-violet-200 gap-1 shadow-2xs"
                            title={
                              isAdmin
                                ? 'Mover lead para Nutrição Mensal (permite retorno se reacordar)'
                                : 'Ação exclusiva para Administradores (403)'
                            }
                          >
                            <Archive className="w-3 h-3 text-violet-600" />
                            Migrar para Nutrição
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ocupado || !isAdmin}
                            onClick={() => handleAcaoFimFunil('marcar_nao_contatar', item)}
                            className="h-7 text-[10px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border-rose-200 gap-1 shadow-2xs"
                            title={
                              isAdmin
                                ? 'Inserir na lista Não Contatar e inativar lead'
                                : 'Ação exclusiva para Administradores (403)'
                            }
                          >
                            <Ban className="w-3 h-3 text-rose-600" />
                            Não Contatar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cards de Métricas Principais (KPIs de Saúde) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Empresas Estagnadas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Empresas Estagnadas
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${estagnadas.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-extrabold font-mono ${
                estagnadas.length > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {resumo?.total_estagnadas ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">
              sem progresso &ge; {resumo?.dias_estagnacao_limite ?? 15} dias
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {estagnadas.length > 0
              ? 'Exigem intervenção imediata da equipe comercial'
              : 'Nenhum prospect retido acima do limite'}
          </div>
        </div>

        {/* Card 2: Maior Ponto de Acúmulo */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Maior Acúmulo</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 truncate">
            {resumo?.etapa_maior_gargalo || 'Nenhuma'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Etapa com maior concentração de prospects ativos
          </div>
        </div>

        {/* Card 3: Total de Descartes / Saídas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Descartes / Inativações
            </span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">
              {resumo?.total_descartes ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">ocorrências registradas</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Empresas inativadas e sugestões descartadas
          </div>
        </div>

        {/* Card 4: Base Total de Empresas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Base no Funil</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">
              {resumo?.total_empresas ?? 0}
            </span>
            <span className="text-[11px] text-slate-400">empresas cadastradas</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Distribuídas nas 9 etapas do pipeline
          </div>
        </div>
      </div>

      {/* GRADE PRINCIPAL — BLOCOS A & B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO A: Tempo Médio por Etapa */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D95A2B]" />
                <h3 className="font-bold text-sm text-slate-900">Tempo Médio por Etapa (dias)</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">9 Etapas do Funil</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Compara quanto tempo as empresas atuais já acumulam na etapa versus o histórico de
              permanência daquelas que já avançaram.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                    <th className="py-2 pr-3">Etapa</th>
                    <th className="py-2 px-2 text-center">Atuais</th>
                    <th className="py-2 px-2 text-right">Média Atual</th>
                    <th className="py-2 px-2 text-right">Média Histórica</th>
                    <th className="py-2 pl-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tempoPorEtapa.map((item) => (
                    <tr
                      key={item.etapa}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.maior_acumulo ? 'bg-amber-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-900">{item.label}</span>
                          {item.maior_acumulo && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 font-bold px-1.5 py-0"
                            >
                              Maior Acúmulo
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-1.5 py-0 bg-slate-100"
                        >
                          {item.empresas_atuais}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                        {item.empresas_atuais > 0
                          ? `${item.tempo_medio_atual_dias.toLocaleString('pt-BR')} d`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                        {item.empresas_passaram > 0
                          ? `${item.tempo_medio_historico_dias.toLocaleString('pt-BR')} d`
                          : '—'}
                      </td>
                      <td className="py-2.5 pl-2 text-center">
                        {item.maior_acumulo ? (
                          <span className="inline-flex items-center text-[10px] text-amber-700 font-semibold gap-0.5">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Gargalo
                          </span>
                        ) : item.empresas_atuais > 0 ? (
                          <span className="text-[10px] text-emerald-700 font-medium">Ativo</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Vazia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Destaque automático de etapas que concentram retenção temporal</span>
            {onNavigateToKanban && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToKanban}
                className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto"
              >
                Abrir Kanban do Funil <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </div>

        {/* BLOCO B: Empresas Estagnadas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900">Empresas Estagnadas</h3>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] border-amber-300 bg-amber-50 text-amber-800 font-bold"
              >
                Limite: {resumo?.dias_estagnacao_limite ?? 15} dias
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Prospects sem mudança de etapa e sem toque realizado recente há mais de{' '}
              {resumo?.dias_estagnacao_limite ?? 15} dias.
            </p>

            {estagnadas.length === 0 ? (
              <div className="h-64 border border-dashed border-emerald-200 bg-emerald-50/40 rounded-xl flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-emerald-900">
                  Nenhuma Empresa Estagnada no Funil
                </h4>
                <p className="text-[11px] text-emerald-700 max-w-xs mt-1">
                  Todas as empresas em prospecção tiveram avanços ou toques confirmados dentro da
                  janela de {resumo?.dias_estagnacao_limite ?? 15} dias.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                {estagnadas.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-amber-300 bg-white hover:bg-amber-50/30 transition-all text-xs"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {emp.nome_fantasia || emp.razao_social}
                          </span>
                          <Badge
                            className={`text-[9px] font-bold px-1.5 py-0 ${
                              emp.curva === 'A'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : emp.curva === 'B'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            Curva {emp.curva}
                          </Badge>
                          {emp.cnpj && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatCnpj(emp.cnpj)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Etapa atual: <span className="font-semibold">{emp.etapa_label}</span>
                          {emp.responsavel_id && (
                            <span> • Resp.: {getUserName(emp.responsavel_id)}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-xs">
                          {emp.dias_parados} dias parados
                        </span>
                      </div>
                    </div>

                    {/* Situação da Próxima Ação */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-400">Próxima ação:</span>
                        {emp.situacao_acao === 'vazia' ? (
                          <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Nenhuma ação agendada
                          </span>
                        ) : emp.situacao_acao === 'vencida' ? (
                          <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Vencida em{' '}
                            {formatDateBr(emp.proxima_acao_data)}
                            {emp.proxima_acao_desc ? ` (${emp.proxima_acao_desc})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-700 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> Agendada para{' '}
                            {formatDateBr(emp.proxima_acao_data)}
                            {emp.proxima_acao_desc ? ` (${emp.proxima_acao_desc})` : ''}
                          </span>
                        )}
                      </div>

                      {onOpenDetalhesEmpresa && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetalhesEmpresa(emp.id)}
                          className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-800"
                        >
                          Ver Empresa
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              Configurável em <strong>Administração &gt; Parâmetros</strong> (chave{' '}
              <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">
                funil_estagnacao_dias
              </code>
              )
            </span>
          </div>
        </div>
      </div>

      {/* GRADE SECUNDÁRIA — BLOCOS C & D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO C: Conversão Etapa -> Etapa */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Conversão Etapa &rarr; Etapa</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Fluxo de Vendas</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Volume de empresas que avançaram para a etapa seguinte versus saídas e descartes
              registrados ao longo do pipeline.
            </p>

            <div className="space-y-3">
              {conversaoEtapas.map((step, idx) => (
                <div
                  key={step.etapa}
                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <span>{step.label}</span>
                      {step.proxima_label && (
                        <>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-blue-700">{step.proxima_label}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-emerald-700 font-bold">
                        {step.taxa_conversao_pct.toLocaleString('pt-BR')}% conv.
                      </span>
                      {step.descartadas > 0 && (
                        <span className="text-rose-600 text-[10px]">
                          ({step.taxa_descarte_pct.toLocaleString('pt-BR')}% saída)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra visual de conversão */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, step.taxa_conversao_pct)}%` }}
                      title={`Avançaram: ${step.avancaram}`}
                    />
                    <div
                      className="bg-rose-400 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, step.taxa_descarte_pct)}%` }}
                      title={`Descartadas/Saídas: ${step.descartadas}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>
                      Passaram: <strong>{step.total_na_etapa}</strong> | Atuais:{' '}
                      <strong>{step.atuais_paradas}</strong>
                    </span>
                    <span>
                      Avançaram: <strong className="text-emerald-700">{step.avancaram}</strong> |
                      Saíram: <strong className="text-rose-700">{step.descartadas}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Avançaram
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Saída /
                Descarte
              </span>
            </div>
          </div>
        </div>

        {/* BLOCO D: Descartes por Motivo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-slate-900">Descartes por Motivo</h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono font-bold text-slate-700">
                Total: {descartes.total}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Contagem de saídas agrupadas por motivo registrado nas inativações e na fila de
              sugestões.
            </p>

            {descartes.agrupado.length === 0 ? (
              <div className="h-64 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                <Info className="w-8 h-8 text-slate-300 mb-2" />
                <span>Nenhum descarte com motivo registrado até o momento.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Agrupamento com barras */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {descartes.agrupado.map((m) => (
                    <div key={m.motivo} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-800 font-medium truncate max-w-[280px]">
                          {m.motivo}
                        </span>
                        <div className="font-mono text-slate-900 font-bold shrink-0">
                          {m.total}{' '}
                          <span className="text-slate-400 font-normal text-[10px]">
                            ({m.percentual.toLocaleString('pt-BR')}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, m.percentual)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lista das mais recentes */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Descartes Mais Recentes ({descartes.recentes.length})
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                    {descartes.recentes.map((d) => (
                      <div
                        key={d.id}
                        className="p-2 rounded border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{d.nome}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Motivo: <span className="text-rose-700">{d.motivo}</span> • Origem:{' '}
                            {d.etapa_origem}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatDateBr(d.data_descarte)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Rastreamento consolidado de empresas inativas e sugestões descartadas</span>
          </div>
        </div>
      </div>
    </div>
  )
}
