import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { OrdemServicoRecord, EntregavelRecord, ProjetoRecord, PrestadorRecord } from '@/types'
import pb from '@/lib/pocketbase/client'
import { ordensServicoService, prestadoresService } from '@/services/prestadores'
import { monitoramentoPrazosService } from '@/services/monitoramentoPrazos'
import { useToast } from '@/hooks/use-toast'
import {
  calcularDiferencaDias,
  calcularHorasDecorridas,
  calcularSemaforoOs,
  calcularSemaforoEntregavel,
} from '@/components/monitoramento/semaforoUtils'
import { SemaforoBadge, SemaforoPrazoStatus } from '@/components/monitoramento/SemaforoBadge'
import {
  PainelCargaPrestadores,
  PrestadorCargaItem,
} from '@/components/monitoramento/PainelCargaPrestadores'
import {
  DestaquesAtrasosMarcos,
  ItemAtrasoOuMarco,
} from '@/components/monitoramento/DestaquesAtrasosMarcos'
import {
  TabelaMonitoramentoOs,
  ItemMonitoramentoOs,
} from '@/components/monitoramento/TabelaMonitoramentoOs'
import {
  FiltrosMonitoramento,
  FiltrosMonitoramentoState,
} from '@/components/monitoramento/FiltrosMonitoramento'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Sparkles,
  Loader2,
  Layers,
  Users,
} from 'lucide-react'

export const MonitoramentoPrazosPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [executandoMonitoramento, setExecutandoMonitoramento] = useState(false)

  // Dados brutos carregados
  const [ordensServico, setOrdensServico] = useState<OrdemServicoRecord[]>([])
  const [entregaveis, setEntregaveis] = useState<EntregavelRecord[]>([])
  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [prestadores, setPrestadores] = useState<PrestadorRecord[]>([])

  // Filtros de visualização
  const [filtros, setFiltros] = useState<FiltrosMonitoramentoState>({
    busca: '',
    prestadorId: 'todos',
    disciplina: 'todas',
    statusSemaforo: 'todos',
    tipoPrestador: 'todos',
  })

  // Carregar dados agregados do cliente
  const carregarDados = async () => {
    setCarregando(true)
    try {
      const [todasOs, todosEntregaveis, todosProjetos, todosPrestadores] = await Promise.all([
        pb.collection('ordens_servico').getFullList<OrdemServicoRecord>({
          sort: '-created',
          expand: 'projeto,prestador',
        }),
        pb.collection('entregaveis').getFullList<EntregavelRecord>({
          sort: 'prazo',
          expand: 'ordem_servico,prestador,etapa,etapa.projeto',
        }),
        pb.collection('projetos').getFullList<ProjetoRecord>({
          sort: '-created',
        }),
        pb.collection('prestadores').getFullList<PrestadorRecord>({
          sort: 'nome',
        }),
      ])

      setOrdensServico(todasOs)
      setEntregaveis(todosEntregaveis)
      setProjetos(todosProjetos)
      setPrestadores(todosPrestadores)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados de monitoramento',
        description: err?.message || 'Falha ao sincronizar dados com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Disparo manual do monitoramento no servidor
  const handleExecutarMonitoramento = async () => {
    setExecutandoMonitoramento(true)
    try {
      const res = await monitoramentoPrazosService.executarMonitoramento()
      toast({
        title: 'Monitoramento executado com sucesso',
        description: `${res.novos_eventos_criados} cobrança(s) gerada(s). ${res.total_os_monitoradas} OS monitoradas.`,
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao executar monitoramento',
        description: err?.message || 'Falha ao acionar endpoint.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoMonitoramento(false)
    }
  }

  // Handler de abertura do WhatsApp wa.me por OS
  const handleAbrirWhatsAppOs = async (osId: string) => {
    try {
      const res = await monitoramentoPrazosService.obterWhatsAppLink(osId)
      if (res?.whatsapp_url) {
        window.open(res.whatsapp_url, '_blank')
      } else {
        toast({
          title: 'Prestador sem telefone cadastrado',
          description: 'Cadastre o WhatsApp do prestador na ficha cadastral para liberar contato.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Falha ao abrir WhatsApp',
        description: err?.message || 'Erro ao consultar link da OS.',
        variant: 'destructive',
      })
    }
  }

  // Mapas rápidos
  const projetosMap = useMemo(() => {
    const map = new Map<string, ProjetoRecord>()
    projetos.forEach((p) => map.set(p.id, p))
    return map
  }, [projetos])

  const prestadoresMap = useMemo(() => {
    const map = new Map<string, PrestadorRecord>()
    prestadores.forEach((p) => map.set(p.id, p))
    return map
  }, [prestadores])

  // Entregáveis agrupados por OS
  const entregaveisPorOs = useMemo(() => {
    const map = new Map<string, EntregavelRecord[]>()
    entregaveis.forEach((ent) => {
      const osId = ent.ordem_servico
      if (osId) {
        const lista = map.get(osId) || []
        lista.push(ent)
        map.set(osId, lista)
      }
    })
    return map
  }, [entregaveis])

  // Processamento das Ordens de Serviço com Semáforo
  const itensOsProcessados: ItemMonitoramentoOs[] = useMemo(() => {
    return ordensServico.map((os) => {
      const prj = projetosMap.get(os.projeto)
      const prest = prestadoresMap.get(os.prestador)
      const entsDaOs = entregaveisPorOs.get(os.id) || []

      const temEntEmRevisao = entsDaOs.some((e) => {
        const st = String(e.status)
        return (
          st === 'revisao_interna' ||
          st === 'enviado_revisao' ||
          st === 'em_revisao' ||
          st === 'aguardando_aprovacao'
        )
      })
      const semaforoOs = calcularSemaforoOs(os, temEntEmRevisao)

      const entregaveisMapeados = entsDaOs.map((ent) => {
        const semEnt = calcularSemaforoEntregavel(ent)
        return {
          item: ent,
          statusSemaforo: semEnt.status,
          diasDiferenca: semEnt.diasRestantes,
          horasEmRevisao: semEnt.horasEmRevisao,
        }
      })

      return {
        os,
        projetoNome: prj?.nome || 'Projeto de Engenharia',
        projetoCodigo: prj?.codigo || 'PRJ',
        prestadorNome: prest?.nome || 'Prestador não vinculado',
        disciplina: os.disciplina || 'Engenharia',
        prazoFim: os.data_previsao_fim || null,
        statusSemaforo: semaforoOs.status,
        diasDiferenca: semaforoOs.diasRestantes,
        entregaveis: entregaveisMapeados,
      }
    })
  }, [ordensServico, projetosMap, prestadoresMap, entregaveisPorOs])

  // Itens em Atraso Crítico e Próximos Marcos (<= 7 dias)
  const { atrasosDestaque, proximosMarcosDestaque } = useMemo(() => {
    const atrasos: ItemAtrasoOuMarco[] = []
    const marcos: ItemAtrasoOuMarco[] = []

    // 1. OS
    itensOsProcessados.forEach((item) => {
      if (item.statusSemaforo === 'atrasado' && item.diasDiferenca !== null) {
        atrasos.push({
          id: item.os.id,
          tipo: 'os',
          titulo: `${item.os.numero} — ${item.os.escopo_tecnico || item.disciplina}`,
          projetoCodigo: item.projetoCodigo,
          prestadorNome: item.prestadorNome,
          disciplina: item.disciplina,
          dataPrazo: item.prazoFim || '',
          diasDiferenca: item.diasDiferenca,
          statusOriginal: item.os.status,
        })
      } else if (
        (item.statusSemaforo === 'atencao' || item.statusSemaforo === 'no_prazo') &&
        item.diasDiferenca !== null &&
        item.diasDiferenca >= 0 &&
        item.diasDiferenca <= 7
      ) {
        marcos.push({
          id: item.os.id,
          tipo: 'os',
          titulo: `${item.os.numero} — ${item.disciplina}`,
          projetoCodigo: item.projetoCodigo,
          prestadorNome: item.prestadorNome,
          disciplina: item.disciplina,
          dataPrazo: item.prazoFim || '',
          diasDiferenca: item.diasDiferenca,
          statusOriginal: item.os.status,
        })
      }
    })

    // 2. Entregáveis com prazo vencido ou vencendo em breve
    entregaveis.forEach((ent) => {
      if (ent.status === 'aprovado') return
      const diffDias = calcularDiferencaDias(ent.prazo)
      if (diffDias === null) return

      const prest = prestadoresMap.get(ent.prestador)

      if (diffDias < 0) {
        atrasos.push({
          id: ent.id,
          tipo: 'entregavel',
          titulo: ent.titulo || ent.nome,
          prestadorNome: prest?.nome,
          dataPrazo: ent.prazo,
          diasDiferenca: diffDias,
          statusOriginal: ent.status,
        })
      } else if (diffDias <= 7) {
        marcos.push({
          id: ent.id,
          tipo: 'entregavel',
          titulo: ent.titulo || ent.nome,
          prestadorNome: prest?.nome,
          dataPrazo: ent.prazo,
          diasDiferenca: diffDias,
          statusOriginal: ent.status,
        })
      }
    })

    // Ordenar atrasos por maior tempo de atraso (diferença mais negativa primeiro)
    atrasos.sort((a, b) => a.diasDiferenca - b.diasDiferenca)
    // Ordenar marcos pelo mais próximo do dia atual
    marcos.sort((a, b) => a.diasDiferenca - b.diasDiferenca)

    return { atrasosDestaque: atrasos, proximosMarcosDestaque: marcos }
  }, [itensOsProcessados, entregaveis, prestadoresMap])

  // Carga de Trabalho por Prestador (Interno e Externo)
  const cargasPrestadores: PrestadorCargaItem[] = useMemo(() => {
    return prestadores
      .map((prest) => {
        const osDoPrestador = itensOsProcessados.filter(
          (it) =>
            it.os.prestador === prest.id &&
            it.os.status !== 'concluida' &&
            it.os.status !== 'cancelada',
        )

        const totalAtivas = osDoPrestador.length
        const atrasadas = osDoPrestador.filter((it) => it.statusSemaforo === 'atrasado').length
        const atencao = osDoPrestador.filter((it) => it.statusSemaforo === 'atencao').length
        const noPrazo = osDoPrestador.filter((it) => it.statusSemaforo === 'no_prazo').length

        const capMax = prest.capacidade_simultanea || 3
        const percentual = capMax > 0 ? (totalAtivas / capMax) * 100 : 0

        let statusGeral: SemaforoPrazoStatus = 'no_prazo'
        if (atrasadas > 0) statusGeral = 'atrasado'
        else if (atencao > 0) statusGeral = 'atencao'
        else if (totalAtivas === 0) statusGeral = 'no_prazo'

        const discs = Array.from(new Set(osDoPrestador.map((it) => it.disciplina).filter(Boolean)))

        const tipoCalculado: 'interno' | 'externo' =
          prest.tipo === 'interno' ? 'interno' : 'externo'

        return {
          prestador: prest,
          tipo: tipoCalculado,
          totalOsAtivas: totalAtivas,
          totalOsAtrasadas: atrasadas,
          totalOsAtencao: atencao,
          totalOsNoPrazo: noPrazo,
          disciplinas: discs.length > 0 ? discs : [prest.disciplinas || 'Engenharia'],
          capacidadeMax: capMax,
          percentualOcupacao: percentual,
          statusGeral,
        }
      })
      .filter((item) => item.totalOsAtivas > 0 || item.prestador.tipo === 'interno')
  }, [prestadores, itensOsProcessados])

  // Opções para filtros
  const prestadoresOpcoes = useMemo(() => {
    return prestadores.map((p) => ({ id: p.id, nome: p.nome }))
  }, [prestadores])

  const disciplinasOpcoes = useMemo(() => {
    const setDisc = new Set<string>()
    ordensServico.forEach((os) => {
      if (os.disciplina) setDisc.add(os.disciplina)
    })
    return Array.from(setDisc)
  }, [ordensServico])

  // Itens de OS filtrados
  const itensOsFiltrados = useMemo(() => {
    return itensOsProcessados.filter((item) => {
      // 1. Busca textual
      if (filtros.busca) {
        const termo = filtros.busca.toLowerCase()
        const num = item.os.numero.toLowerCase()
        const prjCod = item.projetoCodigo.toLowerCase()
        const prjNom = item.projetoNome.toLowerCase()
        const prestNom = item.prestadorNome.toLowerCase()
        if (
          !num.includes(termo) &&
          !prjCod.includes(termo) &&
          !prjNom.includes(termo) &&
          !prestNom.includes(termo)
        ) {
          return false
        }
      }

      // 2. Tipo de prestador
      if (filtros.tipoPrestador !== 'todos' && item.os.tipo_prestador !== filtros.tipoPrestador) {
        return false
      }

      // 3. Prestador
      if (filtros.prestadorId !== 'todos' && item.os.prestador !== filtros.prestadorId) {
        return false
      }

      // 4. Disciplina
      if (filtros.disciplina !== 'todas' && item.disciplina !== filtros.disciplina) {
        return false
      }

      // 5. Status Semáforo
      if (filtros.statusSemaforo !== 'todos' && item.statusSemaforo !== filtros.statusSemaforo) {
        return false
      }

      return true
    })
  }, [itensOsProcessados, filtros])

  // Contadores Globais
  const totalOsNoPrazo = itensOsProcessados.filter((i) => i.statusSemaforo === 'no_prazo').length
  const totalOsAtencao = itensOsProcessados.filter((i) => i.statusSemaforo === 'atencao').length
  const totalOsAtrasadas = itensOsProcessados.filter((i) => i.statusSemaforo === 'atrasado').length
  const totalOsAguardandoRevisao = itensOsProcessados.filter(
    (i) => i.statusSemaforo === 'aguardando_revisao',
  ).length

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D95A2B]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#1E2A4A]">
              Painel de Monitoramento & Gestão de Prazos
            </h1>
            <Badge className="bg-[#D95A2B] text-white text-xs font-mono">Admin & Gestão</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visão executiva em tempo real com semáforo por OS e entregáveis, próximos marcos, carga
            por prestador e atalhos WhatsApp wa.me.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExecutarMonitoramento}
            disabled={executandoMonitoramento || carregando}
            className="text-xs bg-[#1E2A4A] text-white hover:bg-[#2B3B66] border-0 gap-1.5"
            title="Disparar verificação de prazos e resumo diário agora"
          >
            {executandoMonitoramento ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>Verificar Prazos</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={carregando}
            className="text-xs gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </Button>
        </div>
      </div>

      {/* Cards de Semáforo Geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          onClick={() => setFiltros({ ...filtros, statusSemaforo: 'no_prazo' })}
          className={`cursor-pointer border transition-all ${
            filtros.statusSemaforo === 'no_prazo'
              ? 'ring-2 ring-emerald-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                No Prazo (Verde)
              </span>
              <strong className="text-2xl font-bold text-slate-900 mt-1 block">
                {totalOsNoPrazo}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFiltros({ ...filtros, statusSemaforo: 'atencao' })}
          className={`cursor-pointer border transition-all ${
            filtros.statusSemaforo === 'atencao'
              ? 'ring-2 ring-amber-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                Atenção (Amarelo)
              </span>
              <strong className="text-2xl font-bold text-slate-900 mt-1 block">
                {totalOsAtencao}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFiltros({ ...filtros, statusSemaforo: 'atrasado' })}
          className={`cursor-pointer border transition-all ${
            filtros.statusSemaforo === 'atrasado'
              ? 'ring-2 ring-rose-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Atrasado (Vermelho)
              </span>
              <strong className="text-2xl font-bold text-rose-700 mt-1 block">
                {totalOsAtrasadas}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFiltros({ ...filtros, statusSemaforo: 'aguardando_revisao' })}
          className={`cursor-pointer border transition-all ${
            filtros.statusSemaforo === 'aguardando_revisao'
              ? 'ring-2 ring-sky-500 shadow-sm'
              : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                Em Revisão Interna (Azul)
              </span>
              <strong className="text-2xl font-bold text-sky-800 mt-1 block">
                {totalOsAguardandoRevisao}
              </strong>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Destaques: Atrasos em Destaque & Próximos Marcos */}
      <DestaquesAtrasosMarcos
        atrasos={atrasosDestaque}
        proximosMarcos={proximosMarcosDestaque}
        onAbrirWhatsApp={handleAbrirWhatsAppOs}
      />

      {/* Carga por Prestador (Interno e Externo) */}
      <PainelCargaPrestadores
        cargas={cargasPrestadores}
        onSelectPrestador={(prestId) => {
          setFiltros({ ...filtros, prestadorId: prestId })
        }}
        prestadorSelecionadoId={filtros.prestadorId}
      />

      {/* Barra de Filtros e Busca */}
      <FiltrosMonitoramento
        filtros={filtros}
        onChangeFiltros={setFiltros}
        prestadoresOpcoes={prestadoresOpcoes}
        disciplinasOpcoes={disciplinasOpcoes}
        onLimpar={() => {
          setFiltros({
            busca: '',
            prestadorId: 'todos',
            disciplina: 'todas',
            statusSemaforo: 'todos',
            tipoPrestador: 'todos',
          })
        }}
      />

      {/* Tabela de Monitoramento de OS com Semáforo e Entregáveis */}
      {carregando ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
        </div>
      ) : (
        <TabelaMonitoramentoOs
          itens={itensOsFiltrados}
          onAbrirWhatsApp={handleAbrirWhatsAppOs}
          onNavegarProjeto={(prjId) => navigate(`/projetos?id=${prjId}`)}
        />
      )}
    </div>
  )
}

export default MonitoramentoPrazosPage
