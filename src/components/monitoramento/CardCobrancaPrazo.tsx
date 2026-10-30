import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EventoCobrancaRecord } from '@/types'
import { formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Calendar,
  User,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { monitoramentoPrazosService } from '@/services/monitoramentoPrazos'
import { useToast } from '@/hooks/use-toast'

interface CardCobrancaPrazoProps {
  evento: EventoCobrancaRecord
  onAcaoConcluida?: () => void
}

const DEGRAU_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  d_menos_3: {
    label: 'D-3 Lembrete Preventivo',
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    text: 'text-emerald-700',
    icon: Calendar,
  },
  d_zero: {
    label: 'D0 Vence Hoje',
    bg: 'bg-amber-50 border-amber-200 text-amber-800',
    text: 'text-amber-700',
    icon: Clock,
  },
  d_mais_1: {
    label: 'D+1 Cobrança Formal',
    bg: 'bg-orange-50 border-orange-200 text-orange-800',
    text: 'text-orange-700',
    icon: AlertTriangle,
  },
  d_mais_3: {
    label: 'D+3 Escalonamento Crítico',
    bg: 'bg-rose-50 border-rose-200 text-rose-800',
    text: 'text-rose-700',
    icon: AlertTriangle,
  },
  revisor_sla: {
    label: 'Cobrança do Revisor (SLA)',
    bg: 'bg-sky-50 border-sky-200 text-sky-800',
    text: 'text-sky-700',
    icon: ShieldCheck,
  },
}

export const CardCobrancaPrazo: React.FC<CardCobrancaPrazoProps> = ({
  evento,
  onAcaoConcluida,
}) => {
  const { toast } = useToast()
  const [gerandoLink, setGerandoLink] = useState(false)

  const config = DEGRAU_CONFIG[evento.degrau] || {
    label: evento.degrau,
    bg: 'bg-slate-50 border-slate-200 text-slate-800',
    text: 'text-slate-700',
    icon: Clock,
  }
  const IconComponent = config.icon

  const handleAbrirWhatsApp = async () => {
    // Se o evento já tiver a URL gerada e preenchida, usa direto
    if (evento.whatsapp_url) {
      window.open(evento.whatsapp_url, '_blank')
      return
    }

    // Caso a URL não esteja no evento mas tenhamos a OS referenciada, busca via endpoint
    const osId =
      evento.ordem_servico ||
      (evento.referencia_tipo === 'ordens_servico' ? evento.referencia_id : '')
    if (!osId) {
      toast({
        title: 'Ordem de Serviço não identificada',
        description: 'Não foi possível obter o link de WhatsApp para este evento.',
        variant: 'destructive',
      })
      return
    }

    setGerandoLink(true)
    try {
      const res = await monitoramentoPrazosService.obterWhatsAppLink(osId)
      if (res?.whatsapp_url) {
        window.open(res.whatsapp_url, '_blank')
        if (onAcaoConcluida) onAcaoConcluida()
      } else {
        toast({
          title: 'Telefone do prestador não cadastrado',
          description:
            'Cadastre o WhatsApp do prestador na ficha cadastral para liberar o contato direto.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao obter link WhatsApp',
        description: err?.message || 'Falha ao consultar endpoint de WhatsApp.',
        variant: 'destructive',
      })
    } finally {
      setGerandoLink(false)
    }
  }

  const osNome =
    evento.expand?.ordem_servico?.numero ||
    (evento.referencia_tipo === 'ordens_servico' ? `OS #${evento.referencia_id.slice(-6)}` : '')
  const entregavelNome = evento.expand?.entregavel?.titulo || evento.expand?.entregavel?.nome || ''
  const destinatarioNome =
    evento.destinatario_nome ||
    evento.expand?.destinatario_prestador?.nome ||
    evento.expand?.destinatario_usuario?.name ||
    'Destinatário'

  return (
    <Card className={`border rounded-xl shadow-2xs hover:shadow-xs transition-all ${config.bg}`}>
      <CardContent className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-white/70 shadow-2xs">
              <IconComponent className={`w-4 h-4 ${config.text}`} />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block">
                {osNome || entregavelNome || 'Evento de Monitoramento'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Para: {destinatarioNome}
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`text-[10px] font-bold uppercase shrink-0 ${config.bg}`}
          >
            {config.label}
          </Badge>
        </div>

        {/* Mensagem do evento */}
        <div className="p-2.5 bg-white/90 border border-slate-200/80 rounded-lg text-xs text-slate-700 leading-relaxed font-sans">
          {evento.mensagem_texto}
        </div>

        {/* Rodapé com data e ação WhatsApp */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
          <span className="text-slate-500 font-mono">
            Registrado em: {formatDateTimeBr(evento.created)}
          </span>

          <div className="flex items-center gap-1.5">
            {evento.email_enviado && (
              <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                E-mail
              </Badge>
            )}

            {/* Link direto WhatsApp (wa.me) */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAbrirWhatsApp}
              disabled={gerandoLink}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-2xs gap-1 font-semibold"
              title="Abrir mensagem pronta no WhatsApp via wa.me"
            >
              {gerandoLink ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
              <span>WhatsApp wa.me</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CardCobrancaPrazo
