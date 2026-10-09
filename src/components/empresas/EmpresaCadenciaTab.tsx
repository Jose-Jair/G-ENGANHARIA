import React, { useState } from 'react'
import {
  ToqueRecord,
  ToqueComCalculo,
  EmpresaRecord,
  ContatoRecord,
  ContratoRecord,
  ModeloRecord,
  MotivoRecord,
} from '@/types'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Ban,
  RotateCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { toquesService } from '@/services/toques'
import { useToast } from '@/hooks/use-toast'

interface EmpresaCadenciaTabProps {
  empresa: EmpresaRecord
  toques: ToqueComCalculo[]
  contatos: ContatoRecord[]
  contratos: ContratoRecord[]
  modelos: ModeloRecord[]
  motivosInativacao: MotivoRecord[]
  motivosCancelamento: MotivoRecord[]
  readOnly?: boolean
  onToquesChange: () => void
}

export const EmpresaCadenciaTab: React.FC<EmpresaCadenciaTabProps> = ({
  empresa,
  toques,
  contatos: _contatos,
  contratos: _contratos,
  modelos: _modelos,
  motivosInativacao: _motivosInativacao,
  motivosCancelamento: _motivosCancelamento,
  readOnly,
  onToquesChange,
}) => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [iniciandoCadencia, setIniciandoCadencia] = useState(false)

  const handleIniciarCadencia = async () => {
    if (empresa.etapa_funil === 'parceira') {
      toast({
        title: 'Operação não permitida',
        description: 'Empresas parceiras não entram na cadência de prospecção.',
        variant: 'destructive',
      })
      return
    }

    setIniciandoCadencia(true)
    try {
      await toquesService.iniciarCadencia(empresa.id)
      toast({
        title: 'Cadência Iniciada!',
        description: 'Os 5 toques padrão foram gerados automaticamente com datas calculadas.',
      })
      onToquesChange()
    } catch (err: any) {
      toast({
        title: 'Erro ao iniciar cadência',
        description: err?.message || 'Falha ao gerar toques.',
        variant: 'destructive',
      })
    } finally {
      setIniciandoCadencia(false)
    }
  }

  // Ordenar toques de 1 a 5
  const sortedToques = [...toques].sort((a, b) => a.numero_toque - b.numero_toque)

  return (
    <div className="space-y-4">
      {/* Cabeçalho da Cadência */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Cadência de 5 Toques — Prospecção Comercial
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fluxo sequencial multicanal (E-mail e WhatsApp). O próximo toque só é liberado após a
            confirmação do anterior.
          </p>
        </div>

        {sortedToques.length === 0 && !readOnly && (
          <Button
            size="sm"
            onClick={handleIniciarCadencia}
            disabled={iniciandoCadencia || empresa.etapa_funil === 'parceira'}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${iniciandoCadencia ? 'animate-spin' : ''}`} />
            {iniciandoCadencia ? 'Gerando...' : 'Iniciar Sequência de 5 Toques'}
          </Button>
        )}
      </div>

      {sortedToques.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 space-y-2">
          <Clock className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">
            Esta empresa ainda não possui toques gerados
          </p>
          <p className="text-slate-400 max-w-sm mx-auto">
            Ao mover a empresa para "Em cadência" no Funil ou clicar no botão acima, os 5 toques
            serão calculados automaticamente pelo servidor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedToques.map((toque) => {
            const isEmail = toque.canal === 'email'
            const isConcluido =
              toque.statusCalculado === 'realizado' || toque.statusCalculado === 'respondido'
            const isCancelado = toque.statusCalculado === 'cancelado'
            const isBloqueado = toque.statusCalculado === 'bloqueado'

            let badgeStatus = null
            if (toque.statusCalculado === 'realizado') {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Realizado ({toque.data_realizada ? formatDateBr(toque.data_realizada) : 'OK'})
                </span>
              )
            } else if (toque.statusCalculado === 'respondido') {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  Respondido
                </span>
              )
            } else if (toque.statusCalculado === 'cancelado') {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  <Ban className="w-3 h-3" />
                  Cancelado
                </span>
              )
            } else if (toque.statusCalculado === 'em_atraso') {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  Em atraso ({toque.diasAtraso}d)
                </span>
              )
            } else if (toque.statusCalculado === 'para_hoje') {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Para hoje
                </span>
              )
            } else if (isBloqueado) {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                  <Lock className="w-3 h-3" />
                  Aguardando anterior
                </span>
              )
            } else {
              badgeStatus = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                  <Clock className="w-3 h-3" />
                  Agendado
                </span>
              )
            }

            return (
              <div
                key={toque.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isConcluido
                    ? 'bg-emerald-50/20 border-emerald-200'
                    : isBloqueado
                      ? 'bg-slate-50/80 border-slate-200 opacity-70'
                      : toque.statusCalculado === 'em_atraso'
                        ? 'bg-rose-50/30 border-rose-200'
                        : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      isConcluido
                        ? 'bg-emerald-600 text-white'
                        : isBloqueado
                          ? 'bg-slate-200 text-slate-500'
                          : 'bg-blue-600 text-white'
                    }`}
                  >
                    {toque.numero_toque}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900">
                        Toque {toque.numero_toque}: {isEmail ? 'E-mail Corporativo' : 'WhatsApp'}
                      </span>
                      {badgeStatus}
                    </div>

                    <p className="text-xs text-slate-600">{toque.observacao}</p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>Previsto: {formatDateBr(toque.data_prevista)}</span>
                      {toque.data_realizada && (
                        <span>• Realizado: {formatDateBr(toque.data_realizada)}</span>
                      )}
                      {toque.resultado && (
                        <span className="text-slate-700 italic">• {toque.resultado}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visualização de histórico: Toques pendentes exibem atalho para executar na Central */}
                {!isConcluido && !isCancelado && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/acoes-do-dia')}
                      className="text-xs h-7 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 font-medium"
                      title="Executar ou confirmar toque na Central de Ações do Dia"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Executar na Central
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
