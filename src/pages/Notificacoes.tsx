// =============================================================================
// GESTÃO G+ — PÁGINA CENTRAL DE NOTIFICAÇÕES
// Exibe notificações gravadas pelo backend (mensagens_os, versoes, revisoes, sistema).
// Permite marcar como lida e redirecionar direto para o contexto de trabalho.
// =============================================================================

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  MessageSquare,
  FileCheck,
  FileText,
  CheckCheck,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
  Filter,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateTimeBr } from '@/lib/formatters'
import { notificacoesService } from '@/services/notificacoes'
import type { NotificacaoRecord, TipoNotificacao } from '@/types'

export const NotificacoesPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [notificacoes, setNotificacoes] = useState<NotificacaoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroApenasNaoLidas, setFiltroApenasNaoLidas] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [processandoAcao, setProcessandoAcao] = useState(false)

  const carregarNotificacoes = async () => {
    setCarregando(true)
    try {
      const lista = await notificacoesService.listarMinhas({
        apenasNaoLidas: filtroApenasNaoLidas,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
      })
      setNotificacoes(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar notificações',
        description: err.message || 'Falha ao buscar notificações da central.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarNotificacoes()
  }, [filtroApenasNaoLidas, filtroTipo])

  const handleMarcarLida = async (notif: NotificacaoRecord) => {
    if (notif.lida) return
    try {
      await notificacoesService.marcarComoLida(notif.id)
      setNotificacoes((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, lida: true } : item)),
      )
      window.dispatchEvent(new CustomEvent('gmais:notificacao_atualizada'))
    } catch {
      /* ignore */
    }
  }

  const handleMarcarTodasLidas = async () => {
    setProcessandoAcao(true)
    try {
      const total = await notificacoesService.marcarTodasComoLidas()
      toast({
        title: 'Notificações atualizadas',
        description: `${total} notificação(ões) marcada(s) como lida(s).`,
      })
      await carregarNotificacoes()
      window.dispatchEvent(new CustomEvent('gmais:notificacao_atualizada'))
    } catch (err: any) {
      toast({
        title: 'Erro ao marcar todas como lidas',
        description: err.message || 'Falha na operação.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoAcao(false)
    }
  }

  const handleIrParaContexto = async (notif: NotificacaoRecord) => {
    await handleMarcarLida(notif)

    // Direcionamento contextual conforme referência gravada pelo backend
    const refTipo = notif.referencia_tipo
    const refId = notif.referencia_id

    if (user?.role === 'executor') {
      // Prestador navega para o Portal do Prestador
      navigate('/portal-prestador')
      return
    }

    if (refTipo === 'ordens_servico' || notif.tipo === 'mensagem_os') {
      navigate('/prestadores')
      return
    }

    if (
      refTipo === 'entregaveis' ||
      notif.tipo === 'versao_submetida' ||
      notif.tipo === 'versao_avaliada' ||
      notif.tipo === 'comentario_versao'
    ) {
      navigate('/projetos')
      return
    }

    // Default
    navigate('/acoes-do-dia')
  }

  const getIconeNotificacao = (tipo: TipoNotificacao) => {
    switch (tipo) {
      case 'mensagem_os':
        return <MessageSquare className="w-4 h-4 text-[#D95A2B]" />
      case 'versao_submetida':
      case 'versao_avaliada':
      case 'comentario_versao':
        return <FileCheck className="w-4 h-4 text-blue-600" />
      default:
        return <Bell className="w-4 h-4 text-slate-500" />
    }
  }

  const totalNaoLidas = notificacoes.filter((n) => !n.lida).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Central de Notificações
            </h1>
            {totalNaoLidas > 0 && (
              <Badge className="bg-[#D95A2B] text-white font-bold text-xs">
                {totalNaoLidas} não lida(s)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Histórico completo de mensagens de ordens de serviço, envio e revisões de entregáveis e
            avisos operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarNotificacoes}
            className="text-xs h-8 gap-1.5"
            disabled={carregando}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          {totalNaoLidas > 0 && (
            <Button
              size="sm"
              onClick={handleMarcarTodasLidas}
              disabled={processandoAcao}
              className="text-xs h-8 bg-[#1E2A4A] hover:bg-[#141D34] text-white gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todas como lidas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">Filtrar por:</span>

          <div className="flex items-center gap-1.5">
            <Button
              variant={filtroTipo === 'todos' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFiltroTipo('todos')}
              className="h-7 text-xs px-2.5"
            >
              Todas
            </Button>
            <Button
              variant={filtroTipo === 'mensagem_os' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFiltroTipo('mensagem_os')}
              className="h-7 text-xs px-2.5"
            >
              Mensagens OS
            </Button>
            <Button
              variant={filtroTipo === 'versao_submetida' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFiltroTipo('versao_submetida')}
              className="h-7 text-xs px-2.5"
            >
              Entregáveis
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
          <input
            type="checkbox"
            checked={filtroApenasNaoLidas}
            onChange={(e) => setFiltroApenasNaoLidas(e.target.checked)}
            className="rounded border-slate-300 text-[#D95A2B] focus:ring-[#D95A2B]"
          />
          <span>Apenas não lidas</span>
        </label>
      </div>

      {/* Lista de Notificações */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
          <span className="text-xs">Carregando suas notificações...</span>
        </div>
      ) : notificacoes.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Nenhuma notificação encontrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filtroApenasNaoLidas
                ? 'Você não possui notificações pendentes de leitura no momento.'
                : 'Seu histórico de notificações está limpo.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notificacoes.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                !item.lida
                  ? 'bg-white border-[#D95A2B]/40 shadow-xs ring-1 ring-[#D95A2B]/20'
                  : 'bg-white/80 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    !item.lida ? 'bg-[#D95A2B]/10' : 'bg-slate-100'
                  }`}
                >
                  {getIconeNotificacao(item.tipo)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs ${
                        !item.lida ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                      }`}
                    >
                      {item.titulo}
                    </span>
                    {!item.lida && (
                      <Badge className="bg-[#D95A2B] text-white text-[9px] px-1.5 py-0 h-4 uppercase">
                        Nova
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {formatDateTimeBr(item.created)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed break-words">
                    {item.mensagem}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {!item.lida && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarcarLida(item)}
                    className="h-7 text-xs text-slate-500 hover:text-slate-800"
                    title="Marcar como lida"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Lida</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => handleIrParaContexto(item)}
                  className="h-7 text-xs bg-[#1E2A4A] hover:bg-[#141D34] text-white gap-1"
                >
                  <span>Abrir</span>
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificacoesPage
