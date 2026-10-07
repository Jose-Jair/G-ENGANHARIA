import React, { useState } from 'react'
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Eye,
  Building2,
  FileText,
  Clock,
  Layers,
  HelpCircle,
  Receipt,
  RotateCcw,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  assistentePropostaIaService,
  SugestaoPropostaIa,
  RespostaAssistenteIa,
} from '@/services/assistentePropostaIa'
import { auditService } from '@/services/audit'
import { formatCurrencyBr } from '@/lib/formatters'

interface PainelAssistenteIaProps {
  onAplicarSugestao: (sugestao: SugestaoPropostaIa) => void
  propostaNumero?: string
  propostaStatus?: string
  isEdicao?: boolean
}

export const PainelAssistenteIa: React.FC<PainelAssistenteIaProps> = ({
  onAplicarSugestao,
  propostaNumero,
  propostaStatus,
  isEdicao,
}) => {
  const { toast } = useToast()
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [historico, setHistorico] = useState<
    Array<{
      role: 'user' | 'assistant'
      text: string
      sugestao?: SugestaoPropostaIa | null
    }>
  >([])
  const [sugestaoAtual, setSugestaoAtual] = useState<SugestaoPropostaIa | null>(null)
  const [showPreviaModal, setShowPreviaModal] = useState(false)
  const [aplicadaSucesso, setAplicadaSucesso] = useState(false)

  // Bloqueio de aplicação se proposta já foi enviada/aprovada/aceita
  const isBloqueadaParaGravacao =
    isEdicao &&
    propostaStatus &&
    propostaStatus !== 'rascunho' &&
    propostaStatus !== 'aprovacao_interna'

  const handleEnviar = async () => {
    const textoLimpo = mensagem.trim()
    if (!textoLimpo) return

    setLoading(true)
    setAplicadaSucesso(false)

    // Adicionar mensagem do usuário ao histórico local
    setHistorico((prev) => [...prev, { role: 'user', text: textoLimpo }])
    setMensagem('')

    try {
      const resp: RespostaAssistenteIa = await assistentePropostaIaService.enviarMensagem(
        textoLimpo,
        conversationId,
      )

      if (resp.conversation_id) {
        setConversationId(resp.conversation_id)
      }

      setHistorico((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: resp.content,
          sugestao: resp.sugestaoEstruturada,
        },
      ])

      if (resp.sugestaoEstruturada) {
        setSugestaoAtual(resp.sugestaoEstruturada)
        toast({
          title: 'Sugestão estruturada gerada!',
          description:
            'O assistente montou os itens, escopo e premissas. Revise a prévia antes de aplicar.',
        })
      }
    } catch (err: any) {
      console.error('Erro no assistente:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no Assistente IA',
        description: err.message || 'Não foi possível obter resposta do agente nativo Skip Cloud.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirPrevia = (sug: SugestaoPropostaIa) => {
    setSugestaoAtual(sug)
    setShowPreviaModal(true)
  }

  const handleConfirmarAplicacao = async () => {
    if (!sugestaoAtual) return

    if (isBloqueadaParaGravacao) {
      toast({
        variant: 'destructive',
        title: 'Gravação não permitida',
        description: `Propostas com status "${propostaStatus}" não podem ser alteradas. Crie uma nova revisão para aplicar alterações.`,
      })
      setShowPreviaModal(false)
      return
    }

    try {
      // 1. Aplicar na proposta (campos do formulário)
      onAplicarSugestao(sugestaoAtual)

      // 2. Registrar auditoria permanente obrigatória
      await auditService.log({
        action: 'APLICACAO_SUGESTAO_ASSISTENTE_IA',
        entity_type: 'propostas',
        entity_id: propostaNumero || 'nova_proposta',
        details: {
          mensagem: 'Sugestão técnica gerada pelo Assistente IA aplicada aos campos da proposta.',
          origem: 'assistente_ia_nativo_gmais',
          proposta_numero: propostaNumero || 'rascunho_em_elaboracao',
          empreendimento_detectado: sugestaoAtual.empreendimento,
          municipio: sugestaoAtual.municipio,
          uf: sugestaoAtual.uf,
          total_itens_sugeridos: sugestaoAtual.itens?.length || 0,
          prazo_dias: sugestaoAtual.prazo_dias,
          requer_nota: sugestaoAtual.requer_nota,
          total_parcelas: sugestaoAtual.parcelas?.length || 0,
          timestamp: new Date().toISOString(),
        },
      })

      setAplicadaSucesso(true)
      setShowPreviaModal(false)
      toast({
        title: 'Sugestão aplicada à proposta!',
        description:
          'Os campos de empreendimento, escopo, itens, prazo e parcelas foram preenchidos e auditados.',
      })
    } catch (err: any) {
      console.error('Erro ao aplicar sugestão:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar',
        description: 'Não foi possível aplicar a sugestão aos campos da proposta.',
      })
    }
  }

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-lg border border-slate-800 p-4 flex flex-col h-full space-y-3">
      {/* Cabeçalho do Painel */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs flex items-center gap-1.5">
              <span>Assistente IA GMAIS</span>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[9px] px-1.5 py-0">
                Nativo Skip Cloud
              </Badge>
            </div>
            <div className="text-[10px] text-slate-400">
              Descreva o pedido do cliente em linguagem livre
            </div>
          </div>
        </div>

        {historico.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setHistorico([])
              setConversationId(null)
              setSugestaoAtual(null)
              setAplicadaSucesso(false)
            }}
            className="h-6 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 px-2"
            title="Iniciar novo diálogo"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Histórico do Chat */}
      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[320px] pr-1 text-xs">
        {historico.length === 0 ? (
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-md text-[11px] text-slate-400 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
              Exemplo de comando:
            </div>
            <p className="italic bg-slate-950/60 p-2 rounded border border-slate-800 text-slate-300">
              &quot;projeto estrutural de galpão industrial de 1.200 m² em Campinas-SP, com
              hidráulico e sanitário, precisa de nota fiscal, prazo 90 dias, pagamento 50/50&quot;
            </p>
            <p className="text-[10px] text-slate-400">
              O assistente detecta disciplinas, consulta o catálogo oficial, redige o objeto e
              escopo GMAIS e monta uma prévia para sua revisão.
            </p>
          </div>
        ) : (
          historico.map((h, idx) => (
            <div
              key={idx}
              className={`flex flex-col space-y-1 ${
                h.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[95%] p-2.5 rounded-lg text-xs leading-relaxed ${
                  h.role === 'user'
                    ? 'bg-orange-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{h.text}</div>

                {h.sugestao && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pré-montagem estruturada pronta
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAbrirPrevia(h.sugestao!)}
                      className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 shadow-2xs gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Revisar Prévia
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg text-slate-300 border border-slate-700/40 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            <span>Consultando catálogo, áreas e diretrizes GMAIS...</span>
          </div>
        )}
      </div>

      {/* Alerta de Aplicação Feita */}
      {aplicadaSucesso && (
        <div className="bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 p-2 rounded text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sugestão aplicada aos campos da proposta e auditada.</span>
          </div>
        </div>
      )}

      {/* Aviso de Proposta Bloqueada se não for rascunho */}
      {isBloqueadaParaGravacao && (
        <div className="bg-amber-950/60 border border-amber-700/60 text-amber-300 p-2 rounded text-[10px]">
          Proposta com status &quot;{propostaStatus}&quot; (somente leitura). O assistente pode
          gerar sugestões, mas a aplicação está bloqueada.
        </div>
      )}

      {/* Input de Mensagem */}
      <div className="space-y-1.5 pt-1">
        <Textarea
          rows={2}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleEnviar()
            }
          }}
          placeholder="Descreva o pedido do cliente... (Ex: galpão 1200m² em Campinas, estrutural + hidrossanitário...)"
          className="text-xs bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none min-h-[56px] focus-visible:ring-orange-500"
          disabled={loading}
        />
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Pressione Enter para enviar</span>
          <Button
            type="button"
            size="sm"
            onClick={handleEnviar}
            disabled={loading || !mensagem.trim()}
            className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium px-3 gap-1 shadow-sm"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Consultar IA
          </Button>
        </div>
      </div>

      {/* MODAL DE PRÉVIA REVISÁVEL ANTES DE APLICAR */}
      <Dialog open={showPreviaModal} onOpenChange={setShowPreviaModal}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-5 text-slate-900 bg-white">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-slate-900">
              <Sparkles className="w-4 h-4 text-orange-600" />
              Revisão da Prévia Sugerida pelo Assistente IA
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confira os dados detectados e redigidos pelo agente antes de transferir para a
              proposta. O agente nunca grava diretamente no banco.
            </DialogDescription>
          </DialogHeader>

          {sugestaoAtual && (
            <div className="space-y-4 py-2 text-xs">
              {/* 1. DADOS DO EMPREENDIMENTO */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <Building2 className="w-3.5 h-3.5 text-orange-600" />
                  Empreendimento &amp; Localização
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-500">Obra/Edificação:</span>{' '}
                    <strong>{sugestaoAtual.empreendimento || 'Não identificado'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Local:</span>{' '}
                    <strong>
                      {[sugestaoAtual.municipio, sugestaoAtual.uf].filter(Boolean).join(' - ') ||
                        'Não informado'}
                    </strong>
                  </div>
                  {sugestaoAtual.area_m2 ? (
                    <div>
                      <span className="text-slate-500">Área construída:</span>{' '}
                      <strong>{sugestaoAtual.area_m2} m²</strong>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-slate-500">Prazo sugerido:</span>{' '}
                    <strong>{sugestaoAtual.prazo_dias || 30} dias corridos</strong>
                  </div>
                </div>
              </div>

              {/* 2. CONDIÇÕES FISCAIS & PARCELAMENTO */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 border rounded-lg space-y-1">
                  <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1 uppercase tracking-wide">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    Exigência de Nota Fiscal
                  </span>
                  <div className="text-slate-700">
                    {sugestaoAtual.requer_nota ? (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                        Com Nota Fiscal ({sugestaoAtual.impostos_percent || 16.5}%)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-600 text-[10px]">
                        Sem Nota Fiscal (0%)
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border rounded-lg space-y-1">
                  <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1 uppercase tracking-wide">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Parcelamento ({sugestaoAtual.parcelas?.length || 0}x)
                  </span>
                  <div className="text-[11px] text-slate-700">
                    {sugestaoAtual.parcelas && sugestaoAtual.parcelas.length > 0
                      ? sugestaoAtual.parcelas.map((p) => `${p.percentual}%`).join(' / ')
                      : '50% / 50% padrão'}
                  </div>
                </div>
              </div>

              {/* 3. ITENS DE SERVIÇO */}
              <div className="space-y-1.5">
                <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <Layers className="w-3.5 h-3.5 text-orange-600" />
                  Serviços do Catálogo / Áreas Sugeridas ({sugestaoAtual.itens?.length || 0})
                </span>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-semibold border-b text-slate-700">
                      <tr>
                        <th className="py-1.5 px-3">Serviço / Disciplina</th>
                        <th className="py-1.5 px-2 text-center w-16">Qtd</th>
                        <th className="py-1.5 px-3 text-right w-24">Preço Unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sugestaoAtual.itens && sugestaoAtual.itens.length > 0 ? (
                        sugestaoAtual.itens.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3">
                              <div className="font-medium text-slate-900">{it.descricao}</div>
                              <div className="text-[10px] text-slate-500">
                                {it.disciplina || 'Geral'}
                                {it.subservicos && it.subservicos.length > 0 && (
                                  <span> • Subserviços: {it.subservicos.join(', ')}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px]">
                              {it.quantidade || 1} {it.unidade || 'un'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-[11px] font-semibold text-slate-900">
                              {it.preco_venda_unitario !== undefined
                                ? formatCurrencyBr(it.preco_venda_unitario)
                                : 'A definir'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-slate-400 italic text-center">
                            Nenhum item discriminado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. OBJETO E ESCOPO PRÉ-REDIGIDOS */}
              {sugestaoAtual.objeto && (
                <div className="space-y-1">
                  <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">
                    Objeto Pré-Redigido GMAIS
                  </span>
                  <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-slate-700 leading-relaxed">
                    {sugestaoAtual.objeto}
                  </div>
                </div>
              )}

              {sugestaoAtual.escopo && (
                <div className="space-y-1">
                  <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">
                    Escopo Técnico Pré-Redigido
                  </span>
                  <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto font-mono">
                    {sugestaoAtual.escopo}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreviaModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarAplicacao}
              disabled={isBloqueadaParaGravacao}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium gap-1.5 px-4 shadow-sm"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Aplicar à Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PainelAssistenteIa
