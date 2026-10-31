import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CotacaoRecord } from '@/types'
import { cotacoesService, RespostaCotacaoData } from '@/services/executores'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatPhoneBr, isValidPhoneBr } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { rotasPublicasTokenService } from '@/services/rotasPublicasTokenService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquareQuote,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Send,
  Loader2,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'

export const CotacaoPublicaPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()

  const [cotacao, setCotacao] = useState<CotacaoRecord | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // Form states
  const [precoOfertado, setPrecoOfertado] = useState('')
  const [prazoOfertado, setPrazoOfertado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [telefoneContato, setTelefoneContato] = useState('')
  const [telefoneInvalido, setTelefoneInvalido] = useState(false)

  const carregarCotacao = async () => {
    if (!token) {
      setErro('Token de cotação não informado.')
      setCarregando(false)
      return
    }

    setCarregando(true)
    try {
      // Validação de token com verificação de bloqueio/expiração/uso prévio
      const checkToken = await rotasPublicasTokenService.tentarAcessoCotacaoPublica()
      if (checkToken.bloqueado) {
        setErro(checkToken.erro)
        setCarregando(false)
        return
      }

      const data = await cotacoesService.getByToken(token)
      setCotacao(data)
      if (data.status === 'respondida' || data.escolhida || data.status === 'nao_escolhida') {
        if (data.preco_ofertado) setPrecoOfertado(String(data.preco_ofertado))
        if (data.prazo_ofertado) setPrazoOfertado(data.prazo_ofertado)
        if (data.observacoes) setObservacoes(data.observacoes)
      }
      if (data.expand?.executor?.telefone) {
        setTelefoneContato(formatPhoneBr(data.expand.executor.telefone, true))
      }
    } catch (err: any) {
      setErro(err.message || 'Cotação não encontrada ou link expirado.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarCotacao()
  }, [token])

  const handleTelefoneChange = (val: string) => {
    const fmt = formatPhoneBr(val, true)
    setTelefoneContato(fmt)
    if (fmt.trim()) {
      setTelefoneInvalido(!isValidPhoneBr(fmt))
    } else {
      setTelefoneInvalido(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (telefoneContato.trim() && !isValidPhoneBr(telefoneContato.trim())) {
      setTelefoneInvalido(true)
      toast({
        title: 'Telefone inválido',
        description: 'Informe um número de telefone com DDD válido (+55).',
        variant: 'destructive',
      })
      return
    }

    const precoNum = parseFloat(precoOfertado.replace(',', '.'))
    if (!precoNum || isNaN(precoNum) || precoNum <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe o valor total ofertado para a execução deste escopo.',
        variant: 'destructive',
      })
      return
    }

    if (!prazoOfertado.trim()) {
      toast({
        title: 'Prazo obrigatório',
        description: 'Informe o prazo estimado em dias ou data para conclusão.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      let obsFinal = observacoes.trim()
      if (telefoneContato.trim()) {
        const linhaTel = `Contato/WhatsApp: ${telefoneContato.trim()}`
        if (!obsFinal.includes(telefoneContato.trim())) {
          obsFinal = obsFinal ? `${obsFinal}\n${linhaTel}` : linhaTel
        }
      }

      const payload: RespostaCotacaoData = {
        preco_ofertado: precoNum,
        prazo_ofertado: prazoOfertado.trim(),
        observacoes: obsFinal || undefined,
      }

      await cotacoesService.responderPorToken(token, payload)
      setSucesso(true)
      toast({
        title: 'Proposta enviada com sucesso!',
        description: 'Seus valores e prazos foram registrados no sistema.',
      })
      carregarCotacao()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar proposta',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
          <p className="text-sm text-slate-500">Localizando solicitação de cotação...</p>
        </div>
      </div>
    )
  }

  if (erro || !cotacao) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Link Inválido ou Não Localizado</h2>
          <p className="text-xs text-slate-500">
            {erro || 'Não foi possível encontrar a solicitação de cotação referente a este link.'}
          </p>
          <p className="text-[11px] text-slate-400">
            Entre em contato com o Gestor de Projetos responsável caso acredite ser um erro.
          </p>
        </div>
      </div>
    )
  }

  const etapa = cotacao.expand?.etapa
  const projeto = etapa?.expand?.projeto
  const executor = cotacao.expand?.executor
  const jaRespondida =
    cotacao.status === 'respondida' || cotacao.escolhida || cotacao.status === 'nao_escolhida'

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Topo Institucional com Logo Oficial */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <GPlusLogo variant="horizontal" theme="light" size={40} showSlogan={true} />
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#D95A2B] font-bold block">
              Cotação de Executor Externo
            </span>
            <span className="font-bold text-xs text-[#1E2A4A] block">{executor?.nome}</span>
            <span className="text-[10px] font-mono text-slate-400 block">
              {executor?.conselho} {executor?.numero_registro}
            </span>
          </div>
        </div>

        {/* Mensagem de Sucesso ou Status */}
        {sucesso || jaRespondida ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950">
              <span className="font-bold text-sm block">
                {cotacao.escolhida
                  ? 'Parabéns! Sua proposta foi a ESCOLHIDA para este projeto.'
                  : 'Proposta registrada com sucesso!'}
              </span>
              <p className="mt-1 text-emerald-800">
                Seus valores (
                <strong>
                  {cotacao.preco_ofertado ? formatCurrencyBr(cotacao.preco_ofertado) : '—'}
                </strong>
                ) e prazo estimado (<strong>{cotacao.prazo_ofertado}</strong>) estão registrados no
                sistema da coordenação de engenharia.
              </p>
              {cotacao.data_resposta && (
                <span className="text-[10px] text-emerald-700 block mt-1">
                  Enviado em: {formatDateBr(cotacao.data_resposta)}
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* Detalhes do Escopo e Etapa */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[11px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">
              Projeto & Etapa
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              {etapa?.nome} ({etapa?.disciplina || 'Disciplina de Engenharia'})
            </h2>
            {projeto && (
              <p className="text-xs text-slate-500 mt-0.5">
                Código do Projeto:{' '}
                <strong className="font-mono text-slate-700">{projeto.codigo}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">
              Descrição e Escopo Solicitado
            </Label>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
              {cotacao.escopo ||
                etapa?.descricao ||
                'Escopo detalhado nos anexos ou briefing da disciplina.'}
            </div>
          </div>

          {cotacao.prazo_resposta && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>
                Prazo limite para resposta:{' '}
                <strong className="text-slate-800 font-mono">
                  {formatDateBr(cotacao.prazo_resposta)}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Formulário de Resposta do Executor */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">
              {jaRespondida ? 'Sua Proposta Ofertada' : 'Preencher Proposta Comercial'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {jaRespondida
                ? 'Você pode atualizar sua proposta enquanto a etapa estiver em fase de cotação.'
                : 'Informe o valor total e o prazo que sua equipe necessita para entregar esta etapa.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preco">Preço Total Ofertado (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={precoOfertado}
                  onChange={(e) => setPrecoOfertado(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1 text-sm font-semibold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Valor bruto de prestação do serviço técnico.
                </span>
              </div>

              <div>
                <Label htmlFor="prazo">Prazo Ofertado para Entrega *</Label>
                <Input
                  id="prazo"
                  value={prazoOfertado}
                  onChange={(e) => setPrazoOfertado(e.target.value)}
                  placeholder="Ex: 20 dias corridos / 15 dias úteis"
                  required
                  className="mt-1 text-sm"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Tempo estimado após emissão da Ordem de Serviço.
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="telCotacao">Telefone / WhatsApp de Contato</Label>
              <Input
                id="telCotacao"
                value={telefoneContato}
                onChange={(e) => handleTelefoneChange(e.target.value)}
                placeholder="+55 (11) 98765-4321"
                className={`mt-1 text-sm font-mono ${
                  telefoneInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''
                }`}
              />
              {telefoneInvalido ? (
                <span className="text-[11px] text-rose-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Telefone inválido: utilize o formato nacional +55 (XX) XXXXX-XXXX.
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Canal direto para alinhamentos técnicos sobre a proposta.
                </span>
              )}
            </div>

            <div>
              <Label htmlFor="obs">Observações / Premissas da Proposta</Label>
              <Textarea
                id="obs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informe premissas adotadas, entregáveis inclusos ou condições técnicas relevantes..."
                className="mt-1 text-xs"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Seus dados serão comparados diretamente pelo Gestor de Projetos. Não é necessário
                login.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={salvando || telefoneInvalido}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold text-xs px-6 py-2.5 h-auto shadow-sm"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {jaRespondida ? 'Atualizar Proposta Ofertada' : 'Enviar Proposta Comercial'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Rodapé Seguro */}
        <div className="text-center text-[11px] text-slate-400 py-4">
          Ambiente seguro com token individual de validação técnica. Sistema de Gestão de
          Engenharia.
        </div>
      </div>
    </div>
  )
}
