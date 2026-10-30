import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { subcontratosService, SubcontratoPublicoData } from '@/services/subcontratos'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  ShieldCheck,
  Scale,
  Clock,
  ExternalLink,
  Printer,
  Lock,
} from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'

export const SubcontratoPublicoPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sub, setSub] = useState<SubcontratoPublicoData | null>(null)

  // Formulário de Assinatura
  const [nomeAssinante, setNomeAssinante] = useState('')
  const [documentoAssinante, setDocumentoAssinante] = useState('')
  const [declaracaoAceite, setDeclaracaoAceite] = useState(false)
  const [assinando, setAssinando] = useState(false)
  const [sucessoAssinatura, setSucessoAssinatura] = useState(false)

  const carregarDados = async () => {
    if (!token) {
      setErro('Token de acesso não informado')
      setCarregando(false)
      return
    }

    try {
      setCarregando(true)
      const data = await subcontratosService.obterPorToken(token)
      setSub(data)
      if (data.executor?.nome) {
        setNomeAssinante(data.executor.nome)
      }
      if (data.executor?.cpf_cnpj) {
        setDocumentoAssinante(data.executor.cpf_cnpj)
      }
      if (data.status === 'assinado') {
        setSucessoAssinatura(true)
      }
    } catch (err: any) {
      setErro(err.message || 'Não foi possível carregar o Termo de Subcontratação.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [token])

  const handleAssinar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (!declaracaoAceite) {
      toast({
        title: 'Declaração obrigatória',
        description: 'Você precisa declarar ciência e concordância com os termos estipulados.',
        variant: 'destructive',
      })
      return
    }

    if (!nomeAssinante.trim() || !documentoAssinante.trim()) {
      toast({
        title: 'Preencha os dados de identificação',
        description: 'Nome completo e CPF/CNPJ do responsável são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setAssinando(true)
    try {
      await subcontratosService.assinarExecutor({
        token_assinatura: token,
        declaracao: true,
        nome_assinante: nomeAssinante.trim(),
        documento_assinante: documentoAssinante.trim(),
      })

      toast({
        title: 'Termo assinado com sucesso!',
        description: 'A assinatura eletrônica bilateral foi registrada e auditada.',
      })
      setSucessoAssinatura(true)
      await carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro na assinatura',
        description: err.message || 'Falha ao processar assinatura eletrônica.',
        variant: 'destructive',
      })
    } finally {
      setAssinando(false)
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#D95A2B] mb-3" />
        <p className="text-sm font-semibold text-slate-700">
          Carregando Termo de Subcontratação...
        </p>
        <p className="text-xs text-slate-400">Ambiente seguro G+ Engenharia</p>
      </div>
    )
  }

  if (erro || !sub) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-slate-200 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Termo Não Encontrado ou Indisponível</h2>
          <p className="text-xs text-slate-500 mt-2">
            {erro || 'O link pode estar expirado ou incorreto.'}
          </p>
          <div className="mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isAssinado = sub.status === 'assinado' || sucessoAssinatura

  return (
    <div className="min-h-screen bg-slate-100/80 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho Corporativo G+ */}
        <div className="bg-[#1E2A4A] text-white p-6 rounded-2xl shadow-md border-b-4 border-[#D95A2B] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GPlusLogo className="h-10 text-white" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tracking-widest text-[#D95A2B] uppercase font-bold">
                  G+ ENGENHARIA CONSULTIVA
                </span>
                <Badge className="bg-white/20 text-white text-[10px] border-none font-mono">
                  {sub.numero}
                </Badge>
              </div>
              <h1 className="text-xl font-bold mt-0.5">Termo de Subcontratação Técnica</h1>
              <p className="text-xs text-slate-300">
                Vinculação Direta ao Contrato Original • Mediação G+
              </p>

              {/* Badges de Rastreabilidade CTR → GPR → PRJ → SUB (Bloco 6) */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-white/10 text-xs">
                <span className="text-[10px] uppercase font-semibold text-slate-300 tracking-wider mr-1">
                  Cadeia de Rastreabilidade:
                </span>

                {sub.contrato_original?.numero ? (
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-cyan-200 border-cyan-400/40 text-[11px] font-mono font-medium px-2 py-0.5"
                    title={`Contrato de Serviço Original: ${sub.contrato_original.numero}`}
                  >
                    CTR: {sub.contrato_original.numero}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-white/5 text-slate-400 border-white/10 text-[10px] font-mono"
                  >
                    CTR: Não vinculado
                  </Badge>
                )}

                <span className="text-slate-400 text-xs">→</span>

                {sub.grupo?.codigo ? (
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-amber-200 border-amber-400/40 text-[11px] font-mono font-medium px-2 py-0.5"
                    title={`Grupo de Projetos: ${sub.grupo.codigo}${sub.grupo.nome ? ` — ${sub.grupo.nome}` : ''}`}
                  >
                    GPR: {sub.grupo.codigo}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-white/5 text-slate-400 border-white/10 text-[10px] font-mono"
                  >
                    GPR: Individual
                  </Badge>
                )}

                <span className="text-slate-400 text-xs">→</span>

                {sub.projeto?.codigo ? (
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-blue-200 border-blue-400/40 text-[11px] font-mono font-medium px-2 py-0.5"
                    title={`Projeto: ${sub.projeto.codigo}${sub.projeto.nome ? ` — ${sub.projeto.nome}` : ''}`}
                  >
                    PRJ: {sub.projeto.codigo}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-white/5 text-slate-400 border-white/10 text-[10px] font-mono"
                  >
                    PRJ: —
                  </Badge>
                )}

                <span className="text-slate-400 text-xs">→</span>

                <Badge
                  className="bg-[#D95A2B] text-white text-[11px] font-mono font-bold px-2 py-0.5 shadow-xs"
                  title="Termo de Subcontratação atual"
                >
                  SUB: {sub.numero}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 h-8"
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Status de Assinatura */}
        {isAssinado ? (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-start gap-3 text-emerald-950">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="text-sm font-bold block text-emerald-900">
                Termo de Subcontratação Assinado com Sucesso
              </strong>
              <p className="text-emerald-800">
                Assinado eletronicamente por{' '}
                <strong>{sub.executor_nome_assinante || nomeAssinante}</strong> (
                {sub.executor_documento_assinante || documentoAssinante}) em{' '}
                {sub.data_assinatura_executor
                  ? formatDateTimeBr(sub.data_assinatura_executor)
                  : 'agora'}
                .
              </p>
              {sub.executor_hash && (
                <div className="font-mono text-[10px] text-emerald-700 bg-white/80 p-1.5 rounded border border-emerald-200 mt-1 break-all">
                  Hash de Validação Criptográfica: {sub.executor_hash}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-amber-950">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-sm font-bold block text-amber-900">
                Aguardando Assinatura do Executor Subcontratado
              </strong>
              <p className="text-amber-800 mt-0.5">
                Por favor, revise o teor das cláusulas, o prazo e os valores antes de efetuar o
                aceite eletrônico irrevogável ao final desta página.
              </p>
            </div>
          </div>
        )}

        {/* Ficha Resumo do Subcontrato */}
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#D95A2B]" />
              Resumo da Subcontratação
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Emitido em {sub.data_emissao ? formatDateBr(sub.data_emissao) : '—'}
            </span>
          </div>

          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Executor Subcontratado
              </span>
              <strong className="text-slate-900 text-sm block">{sub.executor?.nome}</strong>
              <span className="text-slate-500 text-[11px] font-mono">
                {sub.executor?.cpf_cnpj} • {sub.executor?.conselho || ''}{' '}
                {sub.executor?.numero_registro || ''}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Projeto Vinculado
              </span>
              <strong className="text-slate-900 text-sm block">
                {sub.projeto?.codigo} — {sub.projeto?.nome}
              </strong>
              <span className="text-slate-500 text-[11px] block">
                {sub.modo_execucao === 'terceirizada_integral'
                  ? 'Terceirização Integral (100%)'
                  : 'Terceirização Parcial'}
              </span>
              {(sub.contrato_original?.numero || sub.grupo?.codigo) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-mono">
                  {sub.contrato_original?.numero && (
                    <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-1.5 py-0.5 rounded font-semibold">
                      CTR: {sub.contrato_original.numero}
                    </span>
                  )}
                  {sub.grupo?.codigo && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                      GPR: {sub.grupo.codigo}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Duração do Subcontrato
              </span>
              <strong className="text-slate-900 text-sm block">
                {sub.prazo_dias || 30} dias corridos
              </strong>
              <span className="text-slate-500 text-[10px]">
                (Mesma duração do contrato original)
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                Valor Total da Contratação
              </span>
              <strong className="text-emerald-700 text-base font-bold font-mono block">
                {formatCurrencyBr(sub.valor_total || 0)}
              </strong>
              <span className="text-slate-500 text-[10px]">Conforme proposta comercial aceita</span>
            </div>
          </CardContent>

          {/* Faixa de Retenção Técnica e Status do Ciclo */}
          <div className="bg-amber-50/70 border-t border-amber-200/80 px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                Retenção Técnica de Garantia:
              </span>
              <strong className="text-amber-950 font-mono">
                {sub.percentual_retencao_tecnica || 0}% sobre cada medição
              </strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                Acumulado Retido / Liberado:
              </span>
              <strong className="text-slate-800 font-mono">
                {formatCurrencyBr(sub.retencao_tecnica_acumulada || 0)} /{' '}
                {formatCurrencyBr(sub.retencao_tecnica_liberada || 0)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                Status da Retenção:
              </span>
              <strong className="text-emerald-700">
                {sub.status_retencao === 'totalmente_liberada'
                  ? 'Totalmente Liberada'
                  : sub.status_retencao === 'parcialmente_liberada'
                    ? 'Parcialmente Liberada'
                    : sub.status_retencao === 'acumulando'
                      ? 'Acumulando em Medições'
                      : 'Sem Retenção'}
              </strong>
            </div>
          </div>
        </Card>

        {/* Detalhe da Delegação (se parcial) */}
        {sub.modo_execucao === 'terceirizada_parcial' && sub.descricao_delegada && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1.5 text-xs">
            <span className="text-[#D95A2B] font-bold uppercase text-[10px] tracking-wider block">
              Escopo Específico Delegado ao Executor (Terceirização Parcial)
            </span>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">
              {sub.descricao_delegada}
            </p>
          </div>
        )}

        {/* Cronograma de Parcelas */}
        {sub.parcelas_json && sub.parcelas_json.length > 0 && (
          <Card className="border-slate-200 shadow-xs">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[#D95A2B]" />
                Condições e Parcelas de Pagamento
              </h3>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Parcela / Gatilho</th>
                    <th className="py-2.5 px-4">Vencimento Previsto</th>
                    <th className="py-2.5 px-4 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sub.parcelas_json.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {p.descricao || `Parcela ${idx + 1}`}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.vencimento ? formatDateBr(p.vencimento) : 'A definir'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyBr(p.valor || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Cláusulas Contratuais Herdadas do Contrato GMAIS */}
        <Card className="border-slate-200 shadow-xs">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileSignature className="w-4 h-4 text-[#D95A2B]" />
              Cláusulas do Termo de Subcontratação
            </h3>
            <Badge variant="outline" className="text-[10px] bg-white">
              Padrão Jurídico GMAIS
            </Badge>
          </div>
          <CardContent className="p-5">
            <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-line max-h-96 overflow-y-auto space-y-3">
              <div>
                {sub.clausulas_texto || 'Cláusulas em processamento pela assessoria da G+.'}
              </div>
              <div className="pt-2 border-t border-slate-300 font-sans text-slate-800">
                <strong>CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA:</strong> As partes declaram e
                reconhecem expressamente a validade, integridade e eficácia jurídica desta
                contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº
                2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como válidas as assinaturas
                eletrônicas emitidas mediante verificação de código OTP de 6 dígitos enviado por
                e-mail, registro de endereço IP, user-agent, carimbo de tempo UTC e hash
                criptográfico SHA-256 do documento congelado.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Assinatura Eletrônica do Executor */}
        {!isAssinado ? (
          <Card className="border-[#D95A2B]/40 shadow-sm bg-gradient-to-b from-white to-orange-50/30">
            <div className="bg-orange-50 px-5 py-3 border-b border-orange-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#D95A2B]" />
                Assinatura Eletrônica Bilateral (Executor Subcontratado)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Esta operação possui valor jurídico com registro de declaração, carimbo de tempo, IP
                do signatário e hash SHA-256.
              </p>
            </div>

            <CardContent className="p-5">
              <form onSubmit={handleAssinar} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeAssin" className="text-xs font-semibold text-slate-700">
                      Nome Completo do Responsável Legal *
                    </Label>
                    <Input
                      id="nomeAssin"
                      value={nomeAssinante}
                      onChange={(e) => setNomeAssinante(e.target.value)}
                      placeholder="Ex: Engenheiro Fulano de Tal"
                      required
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="docAssin" className="text-xs font-semibold text-slate-700">
                      CPF ou CNPJ do Signatário *
                    </Label>
                    <Input
                      id="docAssin"
                      value={documentoAssinante}
                      onChange={(e) => setDocumentoAssinante(e.target.value)}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      required
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="declara"
                    checked={declaracaoAceite}
                    onChange={(e) => setDeclaracaoAceite(e.target.checked)}
                    className="mt-0.5 rounded text-[#D95A2B] focus:ring-[#D95A2B]"
                    required
                  />
                  <label
                    htmlFor="declara"
                    className="text-xs text-slate-700 leading-relaxed cursor-pointer"
                  >
                    <strong>Declaro formalmente</strong> que li e concordo integralmente com as
                    cláusulas deste Termo de Subcontratação, comprometendo-me a cumprir fielmente as
                    especificações, a duração do contrato original ({sub.prazo_dias} dias) e as
                    exigências técnicas da G+ Engenharia Consultiva.
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={assinando || !declaracaoAceite}
                    className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-bold px-6 h-9 shadow-sm"
                  >
                    {assinando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Autenticando e Assinando...
                      </>
                    ) : (
                      <>
                        <FileSignature className="w-4 h-4 mr-1.5" />
                        Assinar Eletronicamente Termo de Subcontratação
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 text-center space-y-2">
            <Lock className="w-6 h-6 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">
              Documento Selado e Arquivado Digitalmente
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              O Termo de Subcontratação {sub.numero} encontra-se devidamente assinado e vinculado
              aos registros operacionais e contábeis da G+ Engenharia.
            </p>
          </div>
        )}

        {/* Rodapé Informativo */}
        <div className="text-center text-[11px] text-slate-400 py-4">
          G+ Engenharia Consultiva • Plataforma Digital de Gestão Integrada de Subcontratos • Bloco
          5
        </div>
      </div>
    </div>
  )
}
export default SubcontratoPublicoPage
