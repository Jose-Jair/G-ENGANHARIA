import React, { useState } from 'react'
import { CotacaoRecord, ProjetoEtapaRecord, ExecutorRecord, StatusCotacao } from '@/types'
import { cotacoesService, CreateCotacaoData } from '@/services/executores'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { BotaoVerDetalheSensivel } from '@/components/comum/BotaoVerDetalheSensivel'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquareQuote,
  Plus,
  Copy,
  CheckCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Check,
  Star,
  Layers,
} from 'lucide-react'

interface ModalCotacoesEtapaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  etapa: ProjetoEtapaRecord | null
  executores: ExecutorRecord[]
  canEdit: boolean
  onSuccess: () => void
}

export const ModalCotacoesEtapa: React.FC<ModalCotacoesEtapaProps> = ({
  open,
  onOpenChange,
  etapa,
  executores,
  canEdit,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [cotacoes, setCotacoes] = useState<CotacaoRecord[]>([])
  const [carregando, setCarregando] = useState(false)
  const [modalNovoConviteOpen, setModalNovoConviteOpen] = useState(false)

  // Form convite
  const [executorId, setExecutorId] = useState('')
  const [escopo, setEscopo] = useState('')
  const [prazoResposta, setPrazoResposta] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregarCotacoes = async () => {
    if (!etapa) return
    setCarregando(true)
    try {
      const lista = await cotacoesService.listByEtapa(etapa.id)
      setCotacoes(lista)
    } catch {
      /* ignore */
    } finally {
      setCarregando(false)
    }
  }

  React.useEffect(() => {
    if (open && etapa) {
      carregarCotacoes()
      setEscopo(etapa.descricao || etapa.nome || '')
    }
  }, [open, etapa])

  const handleCriarConvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!etapa || !executorId) {
      toast({
        title: 'Selecione um executor',
        description: 'Escolha qual executor receberá o convite para cotação.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateCotacaoData = {
        etapa: etapa.id,
        executor: executorId,
        escopo: escopo.trim() || undefined,
        prazo_resposta: prazoResposta ? `${prazoResposta} 23:59:59.000Z` : undefined,
      }

      await cotacoesService.create(payload)
      toast({ title: 'Convite de cotação gerado com sucesso!' })
      setModalNovoConviteOpen(false)
      setExecutorId('')
      setPrazoResposta('')
      carregarCotacoes()
    } catch (err: any) {
      toast({ title: 'Erro ao gerar convite', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const handleCopiarLinkPublico = (token?: string) => {
    if (!token) return
    const url = `${window.location.origin}/cotacao/${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description: 'O link público com token foi copiado para a área de transferência.',
    })
  }

  const handleEscolherCotacao = async (cotacaoId: string) => {
    if (
      !confirm(
        'Confirmar a escolha desta proposta? As demais cotações desta etapa serão marcadas como não escolhidas e o executor será vinculado à etapa.',
      )
    ) {
      return
    }

    try {
      await cotacoesService.escolherCotacao(cotacaoId)
      toast({
        title: 'Cotação selecionada com sucesso!',
        description: 'Etapa atualizada e executor vinculado.',
      })
      carregarCotacoes()
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao selecionar cotação',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleExcluirCotacao = async (id: string) => {
    if (!confirm('Deseja excluir este convite de cotação?')) return
    try {
      await cotacoesService.delete(id)
      toast({ title: 'Cotação removida' })
      carregarCotacoes()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  // Filtrar executores aptos (somente ativos)
  const executoresDisponiveis = executores.filter((ex) => ex.status === 'ativo')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-indigo-600" />
                Cotações — Etapa: {etapa?.nome}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Convide múltiplos executores para cotar esta etapa terceirizada/mista e compare lado
                a lado.
              </p>
            </div>

            {canEdit && (
              <Button
                size="sm"
                onClick={() => setModalNovoConviteOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Convidar Executor
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Tabela Comparativa Lado a Lado */}
        {carregando ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Carregando cotações...
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <MessageSquareQuote className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Nenhum executor convidado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Clique em "Convidar Executor" para gerar o link com token público sem login.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cotacoes.map((c) => {
                const ex = c.expand?.executor
                const isEscolhida = c.escolhida
                const isRespondida = !!c.preco_ofertado

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-lg border flex flex-col justify-between transition-all ${
                      isEscolhida
                        ? 'bg-emerald-50/70 border-2 border-emerald-500 shadow-sm'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Cabeçalho do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{ex?.nome}</h4>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {ex?.conselho || 'S/Conselho'} {ex?.numero_registro || ''}
                          </span>
                        </div>

                        {isEscolhida ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold shrink-0">
                            <Check className="w-3 h-3 mr-1" />
                            Escolhida
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase shrink-0 ${
                              isRespondida
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isRespondida ? 'Respondida' : 'Aguardando'}
                          </Badge>
                        )}
                      </div>

                      {/* Nota Geral do Executor */}
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600">
                        <span className="font-semibold text-amber-600 flex items-center">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                          {ex?.nota_geral ? ex.nota_geral.toFixed(1) : 'S/ Nota'}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>{ex?.total_avaliacoes || 0} avaliações</span>
                      </div>

                      {/* Valores e Prazos Ofertados */}
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Preço Ofertado:</span>
                          {c.preco_ofertado ? (
                            <span className="text-sm font-bold text-slate-900">
                              {formatCurrencyBr(c.preco_ofertado)}
                            </span>
                          ) : (
                            <BotaoVerDetalheSensivel
                              tipo="cotacao_preco"
                              registroId={c.id}
                              titulo={`Preço da Cotação: ${ex?.nome || 'Prestador'}`}
                              labelBotao="Ver Preço (Auditado)"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Prazo Ofertado:</span>
                          <span className="text-xs font-semibold text-slate-800">
                            {c.prazo_ofertado || '—'}
                          </span>
                        </div>
                        {c.data_resposta && (
                          <div className="text-[10px] text-slate-400 text-right">
                            Respondido em: {formatDateBr(c.data_resposta)}
                          </div>
                        )}
                      </div>

                      {c.observacoes && (
                        <p className="text-xs text-slate-600 mt-2 italic bg-white p-2 rounded border border-slate-100">
                          "{c.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Ações e Link com Token */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarLinkPublico(c.token)}
                          className="h-7 text-[11px] text-slate-600 px-2"
                          title="Copiar link público com token para envio ao executor"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar Link
                        </Button>

                        <a
                          href={`/cotacao/${c.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                      </div>

                      {canEdit && !isEscolhida && isRespondida && (
                        <Button
                          size="sm"
                          onClick={() => handleEscolherCotacao(c.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Selecionar esta Proposta
                        </Button>
                      )}

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluirCotacao(c.id)}
                          className="w-full text-slate-400 hover:text-rose-600 text-[11px] h-6"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Excluir Convite
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modal Convidar Executor para Cotação */}
        <Dialog open={modalNovoConviteOpen} onOpenChange={setModalNovoConviteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Convidar Executor para Cotação
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Gera um token público de acesso sem login para o executor responder.
              </p>
            </DialogHeader>

            <form onSubmit={handleCriarConvite} className="space-y-3 pt-1">
              <div>
                <Label>Selecione o Executor *</Label>
                <Select value={executorId} onValueChange={setExecutorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Escolha um executor homologado/ativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {executoresDisponiveis.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.nome} ({ex.conselho || 'S/Conselho'} - Nota: {ex.nota_geral || 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="escopoCot">Escopo Técnico a ser Cotado</Label>
                <Textarea
                  id="escopoCot"
                  rows={3}
                  value={escopo}
                  onChange={(e) => setEscopo(e.target.value)}
                  placeholder="Detalhamento das entregas e diretrizes esperadas..."
                />
              </div>

              <div>
                <Label htmlFor="prazoResp">Prazo Limite para Resposta</Label>
                <Input
                  id="prazoResp"
                  type="date"
                  value={prazoResposta}
                  onChange={(e) => setPrazoResposta(e.target.value)}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovoConviteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerar Convite de Cotação
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
