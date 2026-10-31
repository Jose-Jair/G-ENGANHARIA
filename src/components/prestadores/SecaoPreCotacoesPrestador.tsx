import React, { useState, useEffect } from 'react'
import { PreCotacaoRespostaPortalRecord } from '@/types'
import { preCotacaoService } from '@/services/preCotacao'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Send,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react'

interface SecaoPreCotacoesPrestadorProps {
  onRespostaEnviada?: () => void
}

export function SecaoPreCotacoesPrestador({ onRespostaEnviada }: SecaoPreCotacoesPrestadorProps) {
  const { toast } = useToast()

  const [lista, setLista] = useState<PreCotacaoRespostaPortalRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Resposta modal
  const [modalResponderOpen, setModalResponderOpen] = useState(false)
  const [preCotSelecionada, setPreCotSelecionada] = useState<PreCotacaoRespostaPortalRecord | null>(
    null,
  )

  const [precoInput, setPrecoInput] = useState('')
  const [prazoInput, setPrazoInput] = useState('')
  const [premissasInput, setPremissasInput] = useState('')
  const [observacoesInput, setObservacoesInput] = useState('')
  const [aceiteVinculante, setAceiteVinculante] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const carregarOportunidades = async () => {
    setCarregando(true)
    try {
      const res = await preCotacaoService.listMinhasPreCotacoes()
      setLista(res || [])
    } catch (err: any) {
      console.error('Erro ao carregar pré-cotações do prestador:', err)
      toast({
        title: 'Erro ao carregar pré-cotações',
        description: err.message || 'Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarOportunidades()
  }, [])

  const handleAbrirModalResponder = (item: PreCotacaoRespostaPortalRecord) => {
    setPreCotSelecionada(item)
    setPrecoInput(item.preco_ofertado ? String(item.preco_ofertado) : '')
    setPrazoInput(
      item.prazo_ofertado_dias
        ? String(item.prazo_ofertado_dias)
        : item.prazo_desejado_dias
          ? String(item.prazo_desejado_dias)
          : '30',
    )
    setPremissasInput(item.premissas || '')
    setObservacoesInput(item.observacoes || '')
    setAceiteVinculante(Boolean(item.aceite_vinculante))
    setModalResponderOpen(true)
  }

  const handleEnviarResposta = async () => {
    if (!preCotSelecionada) return
    const preco = parseFloat(precoInput.replace(',', '.'))
    const prazo = parseInt(prazoInput, 10)

    if (isNaN(preco) || preco <= 0) {
      toast({
        title: 'Preço obrigatório',
        description: 'Informe um preço válido maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (isNaN(prazo) || prazo <= 0) {
      toast({
        title: 'Prazo obrigatório',
        description: 'Informe o prazo ofertado em dias corridos.',
        variant: 'destructive',
      })
      return
    }

    if (!aceiteVinculante) {
      toast({
        title: 'Aceite vinculante obrigatório',
        description:
          'É obrigatório marcar o aceite dos termos vinculantes antes de confirmar sua proposta técnica.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    try {
      const res = await preCotacaoService.responderPortal(preCotSelecionada.id, {
        preco_ofertado: preco,
        prazo_ofertado_dias: prazo,
        premissas: premissasInput.trim(),
        observacoes: observacoesInput.trim(),
        aceite_vinculante: true,
      })

      toast({
        title: 'Proposta vinculante registrada!',
        description: `Código ${res.codigo_pre_cotacao} confirmado com hash SHA-256 e integridade jurídica.`,
      })

      setModalResponderOpen(false)
      await carregarOportunidades()
      if (onRespostaEnviada) onRespostaEnviada()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar proposta vinculante',
        description: err.message || 'Falha ao comunicar com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'convite_enviado':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Aguardando Sua Resposta
          </Badge>
        )
      case 'enviada':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Send className="w-3 h-3 mr-1" />
            Proposta Enviada (Vinculante)
          </Badge>
        )
      case 'travada':
        return (
          <Badge className="bg-emerald-600 text-white font-semibold">
            <Lock className="w-3 h-3 mr-1" />
            Proposta Vencedora (Preço Travado)
          </Badge>
        )
      case 'liberada':
        return (
          <Badge variant="secondary" className="text-slate-600">
            Processo Concluído (Liberado)
          </Badge>
        )
      case 'expirada':
        return (
          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
            Expirada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Banner de Segmentação e Privacidade Rigorosa */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-50 text-[#D95A2B]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Pré-Cotações Técnicas Vinculantes G+
            </h3>
            <p className="text-slate-500">
              Oportunidades preliminares anonimizadas para elaboração de propostas comerciais. Ao
              enviar seu preço e prazo, o compromisso torna-se vinculante e travará caso sua
              proposta seja vencedora na emissão da Ordem de Serviço.
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-emerald-700 bg-emerald-50 border-emerald-200 shrink-0"
        >
          <Lock className="w-3 h-3 mr-1" />
          Escopo Técnico Isolado
        </Badge>
      </div>

      {/* Lista de Pré-Cotações */}
      {carregando ? (
        <div className="p-16 text-center bg-white rounded-xl border">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B] mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando suas pré-cotações...</p>
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-800">Nenhuma Pré-Cotação Pendente</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Você não possui convites de pré-cotação em aberto no momento. Quando a equipe técnica G+
            abrir uma pré-cotação para a sua disciplina de atuação, ela aparecerá aqui com código
            provisório PRE-AAAA-NNNN.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lista.map((item) => {
            const isFinalizada =
              item.status === 'travada' || item.status === 'liberada' || item.status === 'expirada'

            return (
              <Card
                key={item.id}
                className="border-slate-200 bg-white shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {item.codigo_pre_cotacao}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#D95A2B]" />
                    Disciplina: {item.disciplina}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Prazo limite para resposta:{' '}
                    <strong>{formatDateBr(item.data_limite_resposta)}</strong>
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 text-xs">
                  {/* Escopo Técnico Anonimizado */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                    <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">
                      Escopo Técnico Anonimizado:
                    </span>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                      {item.escopo_resumo}
                    </p>
                  </div>

                  {/* Entregáveis Técnicos */}
                  {item.entregaveis_resumo && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                      <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">
                        Entregáveis Requeridos:
                      </span>
                      <p className="text-slate-700 text-xs">{item.entregaveis_resumo}</p>
                    </div>
                  )}

                  {/* Dados da Oferta Atual (se já respondeu) */}
                  {item.preco_ofertado && item.preco_ofertado > 0 ? (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">Sua Oferta Vinculante:</span>
                        <span className="font-mono font-bold text-sm text-emerald-800">
                          {formatCurrencyBr(item.preco_ofertado)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Prazo de Execução Ofertado:</span>
                        <span className="font-semibold text-slate-800">
                          {item.prazo_ofertado_dias} dias corridos
                        </span>
                      </div>
                      {item.aceite_hash && (
                        <div className="pt-1 border-t border-blue-200/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Hash de Aceite:</span>
                          <span
                            className="truncate max-w-[180px] text-slate-700"
                            title={item.aceite_hash}
                          >
                            {item.aceite_hash}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Envie sua proposta de preço e prazo para garantir participação vinculante
                        nesta oportunidade.
                      </span>
                    </div>
                  )}

                  {/* Mensagem de Liberação (se aplicável) */}
                  {item.aviso_liberacao && (
                    <div className="p-2.5 bg-slate-100 rounded text-slate-600 text-[11px]">
                      {item.aviso_liberacao}
                    </div>
                  )}
                </CardContent>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.codigo_pre_cotacao}
                  </span>

                  {!isFinalizada && (
                    <Button
                      size="sm"
                      onClick={() => handleAbrirModalResponder(item)}
                      className="h-8 text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5 shadow-2xs font-semibold"
                    >
                      <Send className="w-3 h-3" />
                      {item.preco_ofertado ? 'Atualizar Proposta' : 'Enviar Proposta Vinculante'}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL DE RESPOSTA VINCULANTE DO PRESTADOR */}
      <Dialog open={modalResponderOpen} onOpenChange={setModalResponderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold text-slate-900">
                Proposta Técnica Vinculante
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {preCotSelecionada?.codigo_pre_cotacao}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Disciplina: <strong>{preCotSelecionada?.disciplina}</strong> • Escopo preliminar
              anonimizado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Resumo do Escopo e Entregáveis */}
            <div className="p-3 bg-slate-50 border rounded-lg space-y-1.5 max-h-36 overflow-y-auto">
              <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">
                Escopo e Entregáveis Anonimizados:
              </span>
              <p className="text-slate-700 whitespace-pre-wrap text-xs">
                {preCotSelecionada?.escopo_resumo}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Preço Total Ofertado (R$)*</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 8500.00"
                  value={precoInput}
                  onChange={(e) => setPrecoInput(e.target.value)}
                  className="h-8 text-xs font-mono font-bold text-emerald-800"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Prazo de Execução (dias corridos)*</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="Ex: 30"
                  value={prazoInput}
                  onChange={(e) => setPrazoInput(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Premissas Técnicas da Proposta</Label>
              <textarea
                rows={2}
                placeholder="Ex: Considerado modelo BIM no formato IFC; fornecimento de ART/RRT incluso..."
                value={premissasInput}
                onChange={(e) => setPremissasInput(e.target.value)}
                className="w-full text-xs p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações Complementares</Label>
              <Input
                placeholder="Observações pontuais de cronograma ou alinhamento..."
                value={observacoesInput}
                onChange={(e) => setObservacoesInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* CLÁUSULA DE ACEITE VINCULANTE (EXIBIDA ANTES DE CONFIRMAR) */}
            <div className="p-3 bg-orange-50/80 border border-orange-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-orange-950 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#D95A2B]" />
                Cláusula de Vinculação Jurídica & Preço Travado
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                "Ao enviar esta proposta, o prestador declara e aceita expressamente que os valores
                de <strong>preço e prazo</strong> aqui fixados possuem caráter vinculante para a
                disciplina <strong>{preCotSelecionada?.disciplina}</strong> sob o código{' '}
                <strong>{preCotSelecionada?.codigo_pre_cotacao}</strong>. Caso esta proposta seja
                selecionada pela G+ Engenharia e o contrato principal seja formalizado, o preço e
                prazo serão automaticamente travados na emissão da Ordem de Serviço (OS), sem
                necessidade de renegociação."
              </p>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceiteVinculante}
                  onChange={(e) => setAceiteVinculante(e.target.checked)}
                  className="mt-0.5 rounded text-[#D95A2B] focus:ring-orange-500"
                />
                <span className="text-slate-900 font-semibold text-xs leading-snug">
                  Li e manifesto meu <strong>aceite formal e vinculante</strong> aos termos acima,
                  autorizando o registro de hash SHA-256, endereço IP e data/hora.
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalResponderOpen(false)}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleEnviarResposta}
              disabled={enviando || !aceiteVinculante}
              className="h-8 text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5 font-semibold"
            >
              {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar e Enviar Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
