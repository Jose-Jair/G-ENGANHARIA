// =============================================================================
// GESTÃO G+ — COMPONENTE DE COMENTÁRIOS DE REVISÃO POR VERSÃO DO ENTREGÁVEL
// Permite que Gestor/Revisor e Prestador troquem apontamentos técnicos de revisão.
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatDateTimeBr } from '@/lib/formatters'
import { entregavelComentariosService } from '@/services/entregavelComentarios'
import type { EntregavelComentarioRecord } from '@/types'

export interface EntregavelVersaoComentariosProps {
  versaoId: string
  numeroVersao: number
  autorTipo: 'interno' | 'prestador'
  autorNome: string
  autorUsuarioId?: string
  autorEmail?: string
  /** Contagem inicial de comentários para exibição no cabeçalho */
  totalComentariosInicial?: number
  onComentarioAdicionado?: () => void
}

export const EntregavelVersaoComentarios: React.FC<EntregavelVersaoComentariosProps> = ({
  versaoId,
  numeroVersao,
  autorTipo,
  autorNome,
  autorUsuarioId,
  autorEmail,
  totalComentariosInicial = 0,
  onComentarioAdicionado,
}) => {
  const { toast } = useToast()
  const [expandido, setExpandido] = useState(false)
  const [comentarios, setComentarios] = useState<EntregavelComentarioRecord[]>([])
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [texto, setTexto] = useState('')

  const carregarComentarios = async () => {
    if (!versaoId) return
    setCarregando(true)
    try {
      const lista = await entregavelComentariosService.listarPorVersao(versaoId)
      setComentarios(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar comentários',
        description: err.message || 'Falha ao buscar apontamentos da versão.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (expandido) {
      carregarComentarios()
    }
  }, [expandido, versaoId])

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const textoLimpo = texto.trim()
    if (!textoLimpo) return

    setEnviando(true)
    try {
      await entregavelComentariosService.criarComentario({
        versao: versaoId,
        texto: textoLimpo,
        autor_tipo: autorTipo,
        autor_nome: autorNome,
        autor_usuario: autorUsuarioId,
        autor_email: autorEmail,
      })

      setTexto('')
      await carregarComentarios()
      toast({
        title: 'Comentário publicado',
        description: `Apontamento adicionado à versão v${numeroVersao}.0 com sucesso.`,
      })

      if (onComentarioAdicionado) {
        onComentarioAdicionado()
      }
      window.dispatchEvent(new CustomEvent('gmais:notificacao_atualizada'))
    } catch (err: any) {
      toast({
        title: 'Erro ao comentar',
        description: err.message || 'Não foi possível registrar o comentário.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const totalExibido = expandido ? comentarios.length : totalComentariosInicial

  return (
    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
      {/* Botão de Expansão */}
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-slate-700">
            Comentários de Revisão da v{numeroVersao}.0
          </span>
          <Badge
            variant="outline"
            className="text-[10px] font-mono px-1.5 py-0 h-4 bg-white text-slate-600"
          >
            {totalExibido}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <span>{expandido ? 'Ocultar' : 'Ver apontamentos'}</span>
          {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </button>

      {/* Conteúdo Expandido */}
      {expandido && (
        <div className="p-3 space-y-3 bg-slate-50/30 border-t border-slate-200">
          {carregando ? (
            <div className="flex items-center justify-center py-4 text-slate-400 gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Carregando comentários...</span>
            </div>
          ) : comentarios.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-2">
              Nenhum comentário registrado nesta versão ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {comentarios.map((c) => {
                const isPrestador = c.autor_tipo === 'prestador'
                return (
                  <div
                    key={c.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {c.autor_nome}
                        </span>
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
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTimeBr(c.created)}
                      </span>
                    </div>

                    <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed">
                      {c.texto}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Form de Novo Comentário */}
          <form onSubmit={handleEnviar} className="pt-2 border-t border-slate-200 space-y-2">
            <Textarea
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Escreva um apontamento técnico sobre a versão v${numeroVersao}.0...`}
              className="text-xs resize-none border-slate-300 focus:border-blue-500"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={enviando || !texto.trim()}
                className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              >
                {enviando ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Publicar Apontamento</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default EntregavelVersaoComentarios
