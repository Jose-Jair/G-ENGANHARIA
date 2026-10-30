import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  Send,
  Loader2,
  RefreshCw,
  Layers,
  Lock,
  XCircle,
  Info,
} from 'lucide-react'
import { CotacaoRecord } from '@/types'
import {
  cotacaoAutomaticaService,
  RespostaCotacaoPortalPayload,
} from '@/services/cotacaoAutomatica'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface SecaoCotacoesPrestadorProps {
  onCotacaoRespondida?: () => void
}

export const SecaoCotacoesPrestador: React.FC<SecaoCotacoesPrestadorProps> = ({
  onCotacaoRespondida,
}) => {
  const { toast } = useToast()
  const [cotacoes, setCotacoes] = useState<CotacaoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Modal de Resposta
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<CotacaoRecord | null>(null)
  const [modalRespostaAberto, setModalRespostaAberto] = useState(false)
  const [precoInput, setPrecoInput] = useState('')
  const [prazoInput, setPrazoInput] = useState('')
  const [obsInput, setObsInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)

  const carregarCotacoes = async () => {
    setCarregando(true)
    setErro(null)
    try {
      const lista = await cotacaoAutomaticaService.listMinhasCotacoes()
      setCotacoes(lista)
    } catch (err: any) {
      const msg = err?.message || 'Falha ao buscar cotações disponíveis.'
      setErro(msg)
      toast({
        title: 'Erro ao carregar cotações',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarCotacoes()
  }, [])

  const abrirModalResposta = (cot: CotacaoRecord) => {
    setCotacaoSelecionada(cot)
    setPrecoInput(cot.preco_ofertado && cot.preco_ofertado > 0 ? String(cot.preco_ofertado) : '')
    setPrazoInput(cot.prazo_ofertado || '')
    setObsInput(cot.observacoes || '')
    setErroForm(null)
    setModalRespostaAberto(true)
  }

  const handleEnviarResposta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cotacaoSelecionada) return

    setErroForm(null)

    // Validação de Preço
    const precoNum = parseFloat(precoInput.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (isNaN(precoNum) || precoNum <= 0) {
      setErroForm('Por favor, informe um valor de preço ofertado válido e maior que zero.')
      return
    }

    // Validação de Prazo
    const prazoLimpo = prazoInput.trim()
    if (!prazoLimpo) {
      setErroForm('O prazo de execução ofertado é obrigatório (ex.: "15 dias corridos").')
      return
    }

    setEnviando(true)
    try {
      const payload: RespostaCotacaoPortalPayload = {
        preco_ofertado: precoNum,
        prazo_ofertado: prazoLimpo,
        observacoes: obsInput.trim() || undefined,
      }

      const res = await cotacaoAutomaticaService.responderCotacaoPortal(
        cotacaoSelecionada.id,
        payload,
      )

      toast({
        title: 'Proposta enviada com sucesso!',
        description:
          res.mensagem ||
          'Sua cotação foi registrada e agora consta no ranking de avaliação da G+.',
      })

      setModalRespostaAberto(false)
      await carregarCotacoes()
      onCotacaoRespondida?.()
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.data?.error ||
        err?.message ||
        'Erro ao submeter resposta de cotação.'
      setErroForm(msg)
      toast({
        title: 'Não foi possível enviar a proposta',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  const renderBadgeStatus = (status?: string, dataLimite?: string) => {
    const agora = new Date()
    const expiradaPorData =
      dataLimite && new Date(dataLimite) < agora && status === 'convite_enviado'

    if (status === 'escolhida') {
      return (
        <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Proposta Escolhida (OS Gerada)
        </Badge>
      )
    }

    if (status === 'respondida') {
      return (
        <Badge className="bg-blue-600 text-white text-[10px] gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Proposta Enviada
        </Badge>
      )
    }

    if (status === 'expirada' || expiradaPorData) {
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1"
        >
          <XCircle className="w-3 h-3 text-rose-600" />
          Prazo Expirado
        </Badge>
      )
    }

    if (status === 'recusada' || status === 'encerrada' || status === 'nao_escolhida') {
      return (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Lock className="w-3 h-3" />
          Encerrada
        </Badge>
      )
    }

    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1 animate-pulse"
      >
        <Clock className="w-3 h-3 text-amber-600" />
        Aguardando Sua Proposta
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-50 text-[#D95A2B]">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Convites de Cotação Técnica ({cotacoes.length})
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                Projeção Restrita
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Analise o escopo e os prazos desejados para submeter sua proposta de preço e prazo de
              execução.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarCotacoes}
          disabled={carregando}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar Cotações
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center p-12 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
        </div>
      ) : erro ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erro}</span>
          </div>
          <Button variant="outline" size="sm" onClick={carregarCotacoes} className="text-xs">
            Tentar Novamente
          </Button>
        </div>
      ) : cotacoes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">
            Nenhuma Cotação Aberta no Momento
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Quando a equipe G+ abrir cotações para a sua disciplina técnica e você for selecionado,
            as oportunidades com escopo e prazo desejado serão listadas aqui para envio de sua
            proposta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cotacoes.map((cot) => {
            const dataLim = cot.data_limite_resposta || cot.data_limite || cot.prazo_resposta
            const agora = new Date()
            const expirada =
              cot.status === 'expirada' ||
              (Boolean(dataLim) && new Date(dataLim!) < agora && cot.status === 'convite_enviado')
            const respondidaOuFechada =
              cot.status === 'respondida' ||
              cot.status === 'escolhida' ||
              cot.status === 'recusada' ||
              cot.status === 'nao_escolhida' ||
              cot.status === 'encerrada' ||
              expirada

            // Projeção Segura: Código do Projeto via expand
            const codigoProjeto = cot.expand?.projeto?.codigo || 'Projeto G+'
            const disciplina = cot.disciplina || cot.expand?.pacote?.disciplina || 'Engenharia'
            const escopo =
              cot.escopo ||
              cot.expand?.pacote?.escopo_detalhado ||
              cot.expand?.pacote?.descricao ||
              cot.expand?.pacote?.nome ||
              'Escopo técnico especificado pela equipe de engenharia.'

            return (
              <Card
                key={cot.id}
                className="border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {codigoProjeto}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-orange-50 text-[#D95A2B] border-orange-200 text-[11px] font-semibold"
                        >
                          {disciplina}
                        </Badge>
                      </div>
                    </div>
                    {renderBadgeStatus(cot.status, dataLim)}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 text-xs flex-1 flex flex-col justify-between">
                  {/* Escopo Técnico Permitido */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Escopo Técnico & Entregáveis
                    </span>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed text-xs max-h-32 overflow-y-auto whitespace-pre-line">
                      {escopo}
                    </p>
                  </div>

                  {/* Informações de Prazos */}
                  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/70 border border-slate-100 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Prazo Desejado</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {dataLim ? formatDateBr(dataLim) : 'A definir'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {respondidaOuFechada ? 'Sua Proposta de Prazo' : 'Data Limite de Resposta'}
                      </span>
                      <span
                        className={`font-semibold flex items-center gap-1 mt-0.5 ${
                          expirada ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        <Clock className="w-3 h-3 text-slate-500" />
                        {cot.prazo_ofertado
                          ? cot.prazo_ofertado
                          : dataLim
                            ? formatDateBr(dataLim)
                            : 'Em aberto'}
                      </span>
                    </div>
                  </div>

                  {/* Estado Respondido (Somente Leitura) */}
                  {cot.preco_ofertado && cot.preco_ofertado > 0 ? (
                    <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-emerald-800 font-medium block">
                          Preço Ofertado
                        </span>
                        <span className="text-sm font-bold text-emerald-700">
                          {formatCurrencyBr(cot.preco_ofertado)}
                        </span>
                      </div>
                      {cot.data_resposta && (
                        <span className="text-[10px] text-emerald-700">
                          Enviado em {formatDateBr(cot.data_resposta)}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {cot.observacoes && (
                    <p className="text-[11px] text-slate-500 italic">
                      Obs da sua proposta: "{cot.observacoes}"
                    </p>
                  )}

                  {/* Ação: Botão de Responder vs Somente Leitura */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {respondidaOuFechada ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cot.status === 'escolhida'
                            ? 'Cotação finalizada. Ordem de Serviço emitida.'
                            : cot.status === 'respondida'
                              ? 'Proposta sob análise da equipe técnica.'
                              : 'Cotação encerrada ou expirada (somente leitura).'}
                        </span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => abrirModalResposta(cot)}
                        className="w-full bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar Proposta (Preço e Prazo)
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Formulário de Resposta da Cotação */}
      <Dialog open={modalRespostaAberto} onOpenChange={setModalRespostaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#D95A2B]" />
              Enviar Proposta de Cotação
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Projeto:{' '}
              <strong className="font-mono text-slate-800">
                {cotacaoSelecionada?.expand?.projeto?.codigo || 'Projeto G+'}
              </strong>{' '}
              • Disciplina:{' '}
              <strong>
                {cotacaoSelecionada?.disciplina ||
                  cotacaoSelecionada?.expand?.pacote?.disciplina ||
                  'Engenharia'}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarResposta} className="space-y-4 text-xs pt-1">
            {/* Aviso de Confidencialidade e Dados Restritos */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-xs text-blue-800">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                Diretriz de Escopo Técnico
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700">
                Sua proposta de preço e prazo será avaliada pelo algoritmo da G+ e pelo Gestor de
                Projetos. Uma vez enviada, os valores alimentarão o ranking para emissão de Ordem de
                Serviço.
              </p>
            </div>

            {erroForm && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{erroForm}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Preço Ofertado (R$) *
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-semibold text-xs">
                    R$
                  </span>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={precoInput}
                    onChange={(e) => setPrecoInput(e.target.value)}
                    className="text-xs pl-9"
                    disabled={enviando}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Valor bruto total proposto para execução de todos os entregáveis do escopo.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Prazo de Execução Ofertado *
                </Label>
                <Input
                  required
                  placeholder="Ex: 20 dias corridos"
                  value={prazoInput}
                  onChange={(e) => setPrazoInput(e.target.value)}
                  className="text-xs mt-1"
                  disabled={enviando}
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Especifique a quantidade de dias ou período necessário para a entrega final.
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Observações Técnicas / Premissas (Opcional)
                </Label>
                <Input
                  placeholder="Ex: Inclui 1 rodada de revisão técnica..."
                  value={obsInput}
                  onChange={(e) => setObsInput(e.target.value)}
                  className="text-xs mt-1"
                  disabled={enviando}
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalRespostaAberto(false)}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enviando}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando Proposta...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirmar Envio
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default SecaoCotacoesPrestador
