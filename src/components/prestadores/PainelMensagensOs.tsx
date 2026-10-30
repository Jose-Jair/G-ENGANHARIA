// =============================================================================
// GESTÃO G+ — CANAL DE COMUNICAÇÃO POR ORDEM DE SERVIÇO (PAINEL / CHAT)
// Funciona tanto na visão do Gestor quanto no Portal do Prestador.
// Regras de imutabilidade: mensagens não podem ser editadas nem excluídas.
// Anexos protegidos: download via PocketBase File Token (openProtectedFile).
// =============================================================================

import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  Paperclip,
  X,
  FileText,
  Download,
  Loader2,
  CheckCheck,
  Check,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatDateTimeBr } from '@/lib/formatters'
import { ModalRascunhoIA } from '@/components/ia/ModalRascunhoIA'
import { iaOperacaoService } from '@/services/iaOperacao'
import { openProtectedFile } from '@/lib/pocketbase/files'
import { mensagensOsService } from '@/services/mensagensOs'
import type { MensagemOsRecord } from '@/types'

export interface PainelMensagensOsProps {
  osId: string
  numeroOs?: string
  autorTipo: 'interno' | 'prestador'
  autorNome: string
  autorUsuarioId?: string
  autorEmail?: string
  /** Notifica componente pai quando mensagens forem marcadas como lidas */
  onMensagensLidas?: () => void
}

export const PainelMensagensOs: React.FC<PainelMensagensOsProps> = ({
  osId,
  numeroOs,
  autorTipo,
  autorNome,
  autorUsuarioId,
  autorEmail,
  onMensagensLidas,
}) => {
  const { toast } = useToast()
  const [mensagens, setMensagens] = useState<MensagemOsRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [texto, setTexto] = useState('')
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null)
  const [baixandoAnexoId, setBaixandoAnexoId] = useState<string | null>(null)

  // IA: Redigir com IA
  const [modalIaAberto, setModalIaAberto] = useState(false)
  const [finalidadeIa, setFinalidadeIa] = useState<
    'cobranca_preventiva' | 'cobranca_atraso' | 'resposta_prestador' | 'alinhamento_tecnico'
  >(autorTipo === 'prestador' ? 'resposta_prestador' : 'cobranca_preventiva')
  const [contextoExtraIa, setContextoExtraIa] = useState('')
  const [carregandoIa, setCarregandoIa] = useState(false)
  const [erroIa, setErroIa] = useState<string | null>(null)
  const [rascunhoIaTexto, setRascunhoIaTexto] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const carregarMensagens = async (marcarLidas = true) => {
    if (!osId) return
    try {
      const lista = await mensagensOsService.listarPorOs(osId)
      setMensagens(lista)

      // Marcar como lidas para o leitor atual se solicitado
      if (marcarLidas) {
        try {
          const res = await mensagensOsService.marcarComoLidas(osId)
          if (res.total_marcadas_lidas > 0 && onMensagensLidas) {
            onMensagensLidas()
          }
        } catch {
          // Marcação de lidas não bloqueia a leitura de mensagens
        }
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar mensagens',
        description: err.message || 'Não foi possível carregar o histórico de comunicação da OS.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    setCarregando(true)
    carregarMensagens(true)

    // Polling leve para novas mensagens a cada 15 segundos
    const timer = setInterval(() => {
      carregarMensagens(false)
    }, 15000)

    return () => clearInterval(timer)
  }, [osId])

  useEffect(() => {
    if (!carregando) {
      scrollToBottom()
    }
  }, [mensagens.length, carregando])

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const textoLimpo = texto.trim()
    if (!textoLimpo && !arquivoAnexo) {
      return
    }

    setEnviando(true)
    try {
      await mensagensOsService.enviarMensagem({
        os: osId,
        texto: textoLimpo || (arquivoAnexo ? `[Arquivo anexo: ${arquivoAnexo.name}]` : ''),
        autor_tipo: autorTipo,
        autor_nome: autorNome,
        autor_usuario: autorUsuarioId,
        autor_email: autorEmail,
        anexo: arquivoAnexo || undefined,
      })

      setTexto('')
      setArquivoAnexo(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Recarrega lista
      await carregarMensagens(true)

      // Notifica layout/pai
      window.dispatchEvent(new CustomEvent('gmais:notificacao_atualizada'))
      if (onMensagensLidas) {
        onMensagensLidas()
      }
    } catch (err: any) {
      toast({
        title: 'Falha no envio',
        description: err.message || 'Não foi possível enviar a mensagem no canal da OS.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const handleDownloadAnexo = async (msg: MensagemOsRecord) => {
    if (!msg.anexo) return
    setBaixandoAnexoId(msg.id)
    try {
      await openProtectedFile(msg, msg.anexo)
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir anexo protegido',
        description: err.message || 'Falha ao autenticar o download seguro do arquivo.',
        variant: 'destructive',
      })
    } finally {
      setBaixandoAnexoId(null)
    }
  }

  const formatarTamanho = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // IA: Dispara requisição de rascunho de texto para a OS
  const handleAbrirRedigirIa = async () => {
    const finInicial = autorTipo === 'prestador' ? 'resposta_prestador' : 'cobranca_preventiva'
    setFinalidadeIa(finInicial)
    setContextoExtraIa('')
    setModalIaAberto(true)
    await handleGerarTextoIa(finInicial, '')
  }

  const handleGerarTextoIa = async (
    finalidade:
      | 'cobranca_preventiva'
      | 'cobranca_atraso'
      | 'resposta_prestador'
      | 'alinhamento_tecnico',
    contextoExtra: string,
  ) => {
    setCarregandoIa(true)
    setErroIa(null)
    setRascunhoIaTexto('')
    try {
      const resp = await iaOperacaoService.gerarTextoCanalOs({
        os_id: osId,
        finalidade,
        contexto_extra: contextoExtra.trim() || undefined,
      })
      setRascunhoIaTexto(resp.rascunho.mensagem_texto || resp.rascunho.raw_texto || '')
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Falha ao redigir mensagem com IA.'
      setErroIa(msg)
    } finally {
      setCarregandoIa(false)
    }
  }

  // Aplica o rascunho aprovado diretamente no textarea de edição
  const handleAprovarRascunhoIa = () => {
    if (rascunhoIaTexto.trim()) {
      setTexto(rascunhoIaTexto.trim())
      toast({
        title: 'Rascunho inserido no campo de mensagem',
        description: 'Revise o texto abaixo e clique em Enviar quando estiver pronto.',
      })
    }
    setModalIaAberto(false)
  }

  return (
    <div className="flex flex-col h-[520px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Cabeçalho do Canal */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#D95A2B]/10 text-[#D95A2B] flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Canal Oficial de Comunicação</span>
              {numeroOs && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {numeroOs}
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              Histórico seguro e imutável. Mensagens e anexos registrados com carimbo de data/hora.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => carregarMensagens(true)}
          className="h-7 text-xs text-slate-500 hover:text-slate-800 gap-1"
          title="Atualizar mensagens"
        >
          <RefreshCw className={`w-3 h-3 ${carregando ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Alerta de Imutabilidade */}
      <div className="px-3 py-1.5 bg-amber-50/80 border-b border-amber-200/60 flex items-center gap-2 text-[10px] text-amber-800 shrink-0">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          <strong>Canal rastreável:</strong> mensagens gravadas não podem ser alteradas nem
          excluídas por nenhuma das partes.
        </span>
      </div>

      {/* Área da Thread de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
        {carregando && mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
            <span className="text-xs">Carregando conversa...</span>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">Nenhuma mensagem nesta OS ainda.</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
              Inicie a comunicação técnica enviando orientações, dúvidas, prazos ou anexos para esta
              Ordem de Serviço.
            </p>
          </div>
        ) : (
          mensagens.map((msg) => {
            const isMinha =
              msg.autor_tipo === autorTipo &&
              (!msg.autor_usuario || msg.autor_usuario === autorUsuarioId)
            const isPrestador = msg.autor_tipo === 'prestador'

            // Status de leitura na outra ponta
            const lidaNaOutraPonta = isPrestador ? msg.lida_por_interno : msg.lida_por_prestador

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMinha ? 'items-end' : 'items-start'}`}
              >
                {/* Linha de Autor e Horário */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-slate-700">{msg.autor_nome}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 h-4 uppercase ${
                      isPrestador
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {isPrestador ? 'Prestador' : 'Coordenação G+'}
                  </Badge>
                  <span className="text-[10px] text-slate-400">
                    {formatDateTimeBr(msg.created)}
                  </span>
                </div>

                {/* Balão de Mensagem */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                    isMinha
                      ? 'bg-[#1E2A4A] text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line break-words">{msg.texto}</p>

                  {/* Anexo protegido se houver */}
                  {msg.anexo && (
                    <div
                      className={`mt-2.5 pt-2 border-t flex items-center justify-between gap-2 rounded-lg p-2 ${
                        isMinha
                          ? 'border-white/15 bg-white/10 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText
                          className={`w-4 h-4 shrink-0 ${isMinha ? 'text-orange-300' : 'text-[#D95A2B]'}`}
                        />
                        <div className="min-w-0">
                          <span className="font-medium text-[11px] truncate block">
                            {msg.anexo_nome_original || msg.anexo}
                          </span>
                          {msg.anexo_tamanho && (
                            <span
                              className={`text-[10px] block ${isMinha ? 'text-slate-300' : 'text-slate-400'}`}
                            >
                              {formatarTamanho(msg.anexo_tamanho)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isMinha ? 'secondary' : 'outline'}
                        disabled={baixandoAnexoId === msg.id}
                        onClick={() => handleDownloadAnexo(msg)}
                        className={`h-7 px-2 text-[10px] gap-1 shrink-0 ${
                          isMinha
                            ? 'bg-white/20 hover:bg-white/30 text-white border-0'
                            : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Baixar arquivo seguro"
                      >
                        {baixandoAnexoId === msg.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>Baixar</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Status de Leitura / Confirmação */}
                <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400">
                  {isMinha && (
                    <>
                      {lidaNaOutraPonta ? (
                        <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                          <CheckCheck className="w-3 h-3" />
                          Lida pelo {isPrestador ? 'Gestor' : 'Prestador'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Check className="w-3 h-3" />
                          Enviada (não lida)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Anexo selecionado em rascunho */}
      {arquivoAnexo && (
        <div className="px-4 py-2 bg-orange-50 border-t border-orange-200 flex items-center justify-between text-xs text-slate-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-3.5 h-3.5 text-[#D95A2B] shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{arquivoAnexo.name}</span>
            <span className="text-[10px] text-slate-400">
              ({formatarTamanho(arquivoAnexo.size)})
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setArquivoAnexo(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Barra de Entrada / Envio */}
      <form
        onSubmit={handleEnviar}
        className="p-3 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files[0]) {
              setArquivoAnexo(files[0])
            }
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAbrirRedigirIa}
          className="h-9 px-2.5 border-orange-200 text-[#D95A2B] hover:bg-orange-50 shrink-0 gap-1 text-xs font-medium"
          title="Redigir rascunho de mensagem ou cobrança assistido por IA"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
          <span className="hidden sm:inline">Redigir com IA</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-9 px-2.5 text-slate-600 border-slate-300 hover:bg-slate-50 shrink-0"
          title="Anexar arquivo protegido (PDF, DWG, imagens, etc.)"
        >
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline text-xs ml-1">Anexo</span>
        </Button>

        <div className="flex-1 min-w-0">
          <Textarea
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEnviar(e)
              }
            }}
            placeholder="Digite sua mensagem técnica (Enter para enviar)..."
            className="text-xs resize-none min-h-[38px] max-h-24 py-2 border-slate-300 focus:border-[#D95A2B]"
          />
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={enviando || (!texto.trim() && !arquivoAnexo)}
          className="h-9 px-3.5 bg-[#D95A2B] hover:bg-[#b84820] text-white shrink-0"
        >
          {enviando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs font-semibold">Enviar</span>
            </>
          )}
        </Button>
      </form>

      {/* MODAL RASCUNHO IA PARA CANAL DA OS */}
      <ModalRascunhoIA
        open={modalIaAberto}
        onOpenChange={setModalIaAberto}
        titulo={
          autorTipo === 'prestador'
            ? 'Redigir Resposta Técnica com IA'
            : 'Redigir Mensagem / Cobrança com IA'
        }
        subtitulo={
          autorTipo === 'prestador'
            ? 'Rascunho seguro e profissional para prestar contas ou esclarecimentos técnicos.'
            : 'Rascunho estruturado sem dados sensíveis de contrato, obra ou cliente.'
        }
        carregando={carregandoIa}
        textoRascunho={rascunhoIaTexto}
        onTextoChange={setRascunhoIaTexto}
        onAprovar={handleAprovarRascunhoIa}
        onDescartar={() => setModalIaAberto(false)}
        erro={erroIa}
        rotuloAprovar="Inserir no campo de mensagem"
        rotuloDescartar="Descartar rascunho"
        badgeRecurso="IA Canal OS"
      >
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-700 block">
              Finalidade da Mensagem:
            </span>
            {autorTipo === 'prestador' ? (
              <div className="p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900 font-medium">
                Resposta Técnica do Prestador (Alinhamento de progresso e entregas)
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFinalidadeIa('cobranca_preventiva')
                    handleGerarTextoIa('cobranca_preventiva', contextoExtraIa)
                  }}
                  className={`p-2 rounded border text-xs text-left transition-colors ${
                    finalidadeIa === 'cobranca_preventiva'
                      ? 'bg-orange-50 border-[#D95A2B] text-[#D95A2B] font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cobrança Preventiva
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinalidadeIa('cobranca_atraso')
                    handleGerarTextoIa('cobranca_atraso', contextoExtraIa)
                  }}
                  className={`p-2 rounded border text-xs text-left transition-colors ${
                    finalidadeIa === 'cobranca_atraso'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cobrança de Atraso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinalidadeIa('alinhamento_tecnico')
                    handleGerarTextoIa('alinhamento_tecnico', contextoExtraIa)
                  }}
                  className={`p-2 rounded border text-xs text-left transition-colors ${
                    finalidadeIa === 'alinhamento_tecnico'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Alinhamento Técnico
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-600 block">
              Contexto Adicional (Opcional — ex: solicitar sondagem, avisar sobre prazo de revisão):
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={contextoExtraIa}
                onChange={(e) => setContextoExtraIa(e.target.value)}
                placeholder="Ex: Reforçar envio da prancha até quinta-feira"
                className="text-xs flex-1 px-2.5 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-[#D95A2B]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleGerarTextoIa(finalidadeIa, contextoExtraIa)}
                disabled={carregandoIa}
                className="text-xs h-8 text-[#D95A2B] border-orange-200 hover:bg-orange-50 shrink-0"
              >
                Regerar
              </Button>
            </div>
          </div>
        </div>
      </ModalRascunhoIA>
    </div>
  )
}

export default PainelMensagensOs
