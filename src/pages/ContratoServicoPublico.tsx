import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Check,
  ShieldCheck,
  Printer,
  FileText,
  Lock,
} from 'lucide-react'
import { ContratoServicoRecord } from '@/types'
import { DossieContratoServicoGmais } from '@/components/contratosServico/DossieContratoServicoGmais'
import {
  formatCurrencyBr,
  formatDateBr,
  formatDateTimeBr,
  normalizarCondicoesPagamento,
} from '@/lib/formatters'
import { cleanCpf, formatCpf } from '@/lib/cnpj'
import { contratosServicoService } from '@/services/contratosServico'
import { useToast } from '@/hooks/use-toast'
import { GPlusLogo } from '@/components/GPlusLogo'

export function ContratoServicoPublicoPage() {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()

  const [contrato, setContrato] = useState<ContratoServicoRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Assinatura do Cliente
  const [declaracaoCliente, setDeclaracaoCliente] = useState(false)
  const [nomeSignatario, setNomeSignatario] = useState('')
  const [cpfSignatario, setCpfSignatario] = useState('')
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false)
  const [submittingAssinatura, setSubmittingAssinatura] = useState(false)
  const [segundosAssinandoCliente, setSegundosAssinandoCliente] = useState(0)
  const [dossieOpen, setDossieOpen] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (submittingAssinatura) {
      setSegundosAssinandoCliente(0)
      timer = setInterval(() => {
        setSegundosAssinandoCliente((s) => s + 1)
      }, 1000)
    } else {
      setSegundosAssinandoCliente(0)
    }
    return () => clearInterval(timer)
  }, [submittingAssinatura])

  useEffect(() => {
    async function loadContrato() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const rec = await contratosServicoService.getByToken(token)
        setContrato(rec)

        if (rec) {
          const emp = rec.expand?.empresa
          const pf = rec.expand?.cliente_pf
          if (rec.cliente_nome_assinante) {
            setNomeSignatario(rec.cliente_nome_assinante)
          } else if (pf) {
            setNomeSignatario(pf.nome || '')
          } else if (emp) {
            setNomeSignatario(emp.razao_social || '')
          }

          if (rec.cliente_documento_assinante) {
            setCpfSignatario(rec.cliente_documento_assinante)
          } else if (pf) {
            setCpfSignatario(pf.cpf || '')
          }
        }
      } catch (err) {
        console.error('Erro ao carregar contrato por token:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContrato()
  }, [token])

  const handleAbrirConfirmacao = () => {
    if (!declaracaoCliente) {
      toast({
        title: 'Declaração obrigatória',
        description: 'Você precisa declarar a leitura e concordância com os termos do contrato.',
        variant: 'destructive',
      })
      return
    }

    if (!nomeSignatario.trim() || !cpfSignatario.trim()) {
      toast({
        title: 'Dados do signatário',
        description: 'Informe seu nome completo e CPF para a formalização da assinatura.',
        variant: 'destructive',
      })
      return
    }

    setShowConfirmacaoModal(true)
  }

  const handleAssinarContratoFinal = async () => {
    if (!contrato || !token) return

    setSubmittingAssinatura(true)

    // Timeout de segurança visível (~30s) para evitar giro indefinido
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'A requisição excedeu o tempo limite (30s). Por favor, verifique a conexão e tente novamente.',
            ),
          ),
        30000,
      ),
    )

    try {
      await Promise.race([
        contratosServicoService.assinarComoCliente({
          token_assinatura_cliente: token,
          declaracao: true,
          nome_assinante: nomeSignatario.trim(),
          documento_assinante: cpfSignatario.trim(),
        }),
        timeoutPromise,
      ])

      setShowConfirmacaoModal(false)
      toast({
        title: 'Contrato Assinado com Sucesso!',
        description:
          'Assinatura digital e hash criptográfico registrados com sucesso! O projeto técnico de engenharia foi formalizado.',
      })

      // Recarregar dados
      const atualizado = await contratosServicoService.getByToken(token)
      setContrato(atualizado)
    } catch (err: any) {
      console.error('Erro na assinatura do contrato:', err)
      toast({
        title: 'Falha na assinatura eletrônica',
        description:
          err.message ||
          'Não foi possível formalizar a assinatura do contrato dentro do tempo limite.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingAssinatura(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B] mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Carregando Contrato de Serviços...</p>
        </div>
      </div>
    )
  }

  if (!contrato) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 border-slate-200">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <CardTitle className="text-lg">Contrato Não Encontrado</CardTitle>
          <p className="text-xs text-slate-500 mt-2">
            O link de assinatura informado é inválido ou expirou.
          </p>
        </Card>
      </div>
    )
  }

  const isAguardandoDados = contrato.status === 'aguardando_dados_cliente'
  const jaAssinadoCliente = Boolean(contrato.data_assinatura_cliente)
  const assinadoAdmin = Boolean(contrato.data_assinatura_admin)

  return (
    <div className="min-h-screen bg-slate-100/80 py-4 sm:py-8 px-2 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Banner de Status */}
        {isAguardandoDados ? (
          <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-xs">
                <div className="font-bold text-sm text-amber-950">
                  Cadastro Pendente: Aguardando Complemento de Dados
                </div>
                <div className="text-amber-800 mt-0.5">
                  Não é possível gerar o contrato definitivo nem assinar enquanto as informações
                  cadastrais obrigatórias estiverem incompletas. Por favor, acesse o formulário de
                  complementação.
                </div>
              </div>
            </div>
            {contrato.token_complemento_dados && (
              <a
                href={`/completar-cadastro/${contrato.token_complemento_dados}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-[#D95A2B] hover:bg-[#b8451b] text-white text-xs font-semibold rounded-md shadow-sm shrink-0"
              >
                Completar Cadastro Agora
              </a>
            )}
          </div>
        ) : jaAssinadoCliente ? (
          <div className="bg-emerald-600 text-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-100 shrink-0" />
              <div>
                <div className="font-bold text-sm">Contrato de Prestação de Serviços Assinado</div>
                <div className="text-xs text-emerald-100">
                  Assinado digitalmente por ambas as partes. Data do cliente:{' '}
                  {formatDateTimeBr(contrato.data_assinatura_cliente!)}.
                  {contrato.cliente_hash && (
                    <span className="block mt-0.5 font-mono text-[10px] text-emerald-200">
                      Hash Signatário: {contrato.cliente_hash.substring(0, 24)}...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-700 text-white border-0 text-xs self-start sm:self-center">
              Totalmente Vigente
            </Badge>
          </div>
        ) : !assinadoAdmin ? (
          <div className="bg-blue-600 text-white p-4 rounded-lg shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-100 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-sm">
                  Minuta Contratual — Aguardando Assinatura da Diretoria G+
                </div>
                <div>
                  O cadastro do cliente está confirmado. Abaixo está disponível a minuta oficial
                  completa do Contrato para leitura e conferência. A assinatura eletrônica do
                  cliente será habilitada assim que a Diretoria Técnica da G+ formalizar o
                  instrumento.
                </div>
              </div>
            </div>
            <Badge className="bg-blue-800 text-white border-0 text-xs shrink-0 self-start sm:self-center font-medium">
              Minuta Oficial
            </Badge>
          </div>
        ) : (
          <div className="bg-blue-600 text-white p-4 rounded-lg shadow-sm flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-100 shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-sm">
                Assinatura da Diretoria da G+ Engenharia Concluída
              </div>
              <div>
                O instrumento contratual já foi formalizado pela G+. Revise as cláusulas abaixo e
                insira seus dados para a assinatura eletrônica final.
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTO DO CONTRATO DE SERVIÇOS GMAIS */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
          {/* TOPO COM LOGO E IDENTIFICAÇÃO */}
          <div className="p-4 sm:p-8 border-b border-slate-200 bg-[#1E2A4A]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <GPlusLogo variant="horizontal" theme="light" size={38} showSlogan={true} />

            <div className="text-left sm:text-right border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-[#D95A2B]/40 sm:border-transparent">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D95A2B] block">
                Contrato de Prestação de Serviços Técnicos
              </span>
              <div className="font-mono font-black text-base sm:text-lg text-[#1E2A4A]">
                {contrato.numero}
              </div>
              <div className="text-xs text-slate-500">
                Proposta de Origem: {contrato.expand?.proposta?.numero || 'S/N'} • Emissão:{' '}
                {formatDateBr(contrato.created)}
              </div>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDossieOpen(true)}
                  className="h-7 text-[11px] gap-1 text-orange-700 border-orange-200 hover:bg-orange-50"
                >
                  <Printer className="w-3 h-3 text-orange-600" />
                  Imprimir / PDF Oficial
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-8 space-y-6 text-xs text-slate-700">
            {/* PARTES CONTRATANTES */}
            <div className="p-4 bg-slate-50 border rounded-lg space-y-3 leading-relaxed">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Das Partes Contratantes
              </span>
              <div>
                <strong className="text-slate-900">CONTRATADA: </strong>
                G+ ENGENHARIA CONSULTIVA E PROJETOS LTDA, pessoa jurídica de direito privado,
                especializada em serviços de arquitetura e engenharia técnica consultiva.
              </div>
              <div>
                <strong className="text-slate-900">CONTRATANTE: </strong>
                {contrato.expand?.empresa ? (
                  <span>
                    <strong>{contrato.expand.empresa.razao_social}</strong>, inscrita no CNPJ sob o
                    nº <strong>{contrato.expand.empresa.cnpj}</strong>
                    {contrato.expand.empresa.logradouro && (
                      <span>
                        , com sede em {contrato.expand.empresa.logradouro},{' '}
                        {contrato.expand.empresa.numero} - {contrato.expand.empresa.municipio}/
                        {contrato.expand.empresa.uf}
                      </span>
                    )}
                    .
                  </span>
                ) : contrato.expand?.cliente_pf ? (
                  <span>
                    <strong>{contrato.expand.cliente_pf.nome}</strong>, pessoa física portadora do
                    CPF nº <strong>{contrato.expand.cliente_pf.cpf}</strong>
                    {contrato.expand.cliente_pf.endereco && (
                      <span>
                        , residente e domiciliado em {contrato.expand.cliente_pf.endereco}
                      </span>
                    )}
                    .
                  </span>
                ) : (
                  <span>Contratante qualificado na proposta comercial de referência.</span>
                )}
              </div>
            </div>

            {/* OBJETO E VALOR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border rounded-lg space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Objeto dos Serviços
                </span>
                <p className="text-slate-800 font-medium leading-relaxed">{contrato.objeto}</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">
                  Valor Global Contratado
                </span>
                <div className="text-xl font-bold font-mono text-blue-900">
                  {formatCurrencyBr(contrato.valor_total)}
                </div>
                <div className="text-[11px] text-blue-700">
                  Prazo de execução estimado em {contrato.prazo_dias || 30} dias corridos.
                </div>
              </div>
            </div>

            {/* CRONOGRAMA DE PARCELAS */}
            {contrato.parcelas_json && contrato.parcelas_json.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Condições de Pagamento e Cronograma de Parcelas
                </h4>
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-xs">
                    <thead className="bg-slate-100 text-slate-800 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3 text-center w-12">#</th>
                        <th className="py-2 px-3">Gatilho / Marco Contratual</th>
                        <th className="py-2 px-3 text-center w-24">Percentual</th>
                        <th className="py-2 px-3 text-right w-32">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {contrato.parcelas_json.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-mono">{p.ordem || idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {normalizarCondicoesPagamento(p.descricao)} ({p.gatilho})
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{p.percentual}%</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                            {formatCurrencyBr(p.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CLÁUSULAS CONTRATUAIS */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Cláusulas Gerais e Condições Técnicas
              </h4>
              <div className="p-4 bg-slate-50 border rounded-lg whitespace-pre-wrap leading-relaxed text-justify text-[11px] text-slate-700 font-sans max-h-96 overflow-y-auto">
                {contrato.clausulas_texto || 'Cláusulas padrão da prestação de serviços técnicos.'}
              </div>
            </div>

            {/* QUADRO DE ASSINATURAS */}
            <div className="border-t pt-4 space-y-3">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Registro de Assinaturas Eletrônicas
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assinatura Admin G+ */}
                <div
                  className={`p-3.5 rounded-lg border ${
                    assinadoAdmin
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-900 text-xs">
                      Pela Contratada (G+)
                    </span>
                    {assinadoAdmin ? (
                      <Badge className="bg-emerald-600 text-white text-[10px]">Assinado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  {assinadoAdmin ? (
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <div>
                        Assinante: {contrato.expand?.assinante_admin?.name || 'Diretoria G+'}
                      </div>
                      <div>Data: {formatDateTimeBr(contrato.data_assinatura_admin!)}</div>
                      <div className="font-mono text-[10px] text-emerald-800 truncate">
                        Hash: {contrato.admin_hash}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Aguardando assinatura da Diretoria Técnica
                    </div>
                  )}
                </div>

                {/* Assinatura Cliente */}
                <div
                  className={`p-3.5 rounded-lg border ${
                    jaAssinadoCliente
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-900 text-xs">
                      Pelo Contratante (Cliente)
                    </span>
                    {jaAssinadoCliente ? (
                      <Badge className="bg-emerald-600 text-white text-[10px]">Assinado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  {jaAssinadoCliente ? (
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <div>Assinante: {contrato.cliente_nome_assinante}</div>
                      <div>Documento: {contrato.cliente_documento_assinante}</div>
                      <div>Data: {formatDateTimeBr(contrato.data_assinatura_cliente!)}</div>
                      <div className="font-mono text-[10px] text-emerald-800 truncate">
                        Hash: {contrato.cliente_hash}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Aguardando assinatura do cliente
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE AVISO SE CADASTRO INCOMPLETO */}
          {isAguardandoDados && (
            <div className="p-4 sm:p-6 bg-amber-50/60 border-t border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Assinatura Bloqueada — Cadastro Incompleto
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Este contrato não pode ser assinado no momento porque alguns dados cadastrais
                obrigatórios (endereço completo, documentos validados ou dados de representação)
                estão pendentes de preenchimento pelo cliente.
              </p>
              {contrato.token_complemento_dados && (
                <div>
                  <a
                    href={`/completar-cadastro/${contrato.token_complemento_dados}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D95A2B] hover:bg-[#b8451b] text-white text-xs font-semibold rounded-md shadow-sm"
                  >
                    Acessar Formulário de Complemento de Dados
                  </a>
                </div>
              )}
            </div>
          )}

          {/* PAINEL DE ASSINATURA PARA O CLIENTE SE PENDENTE */}
          {!isAguardandoDados && !jaAssinadoCliente && assinadoAdmin && (
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 space-y-4">
              <div className="space-y-2">
                <span className="font-bold text-slate-900 text-xs block">
                  Identificação do Signatário para Assinatura Eletrônica:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-600">
                      Nome Completo do Representante / Signatário *
                    </Label>
                    <Input
                      value={nomeSignatario}
                      onChange={(e) => setNomeSignatario(e.target.value)}
                      placeholder="Ex: Carlos Eduardo Silva"
                      className="h-8 text-xs bg-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-600">CPF do Signatário *</Label>
                    <Input
                      value={cpfSignatario}
                      onChange={(e) => setCpfSignatario(e.target.value)}
                      placeholder="000.000.000-00"
                      className="h-8 text-xs bg-white mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
                <Checkbox
                  id="chk-declaracao-contrato"
                  checked={declaracaoCliente}
                  onCheckedChange={(c) => setDeclaracaoCliente(c === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="chk-declaracao-contrato"
                  className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none"
                >
                  <strong className="text-slate-900">Declaração de Concordância Contratual:</strong>{' '}
                  Declaro que li, compreendi e concordo com todas as cláusulas do Contrato{' '}
                  <strong className="text-slate-900 font-mono">{contrato.numero}</strong> e autorizo
                  o início dos serviços de engenharia contratados, ciente do registro eletrônico do
                  meu IP e integridade criptográfica.
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleAbrirConfirmacao}
                  disabled={!declaracaoCliente || submittingAssinatura}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 h-9 shadow-sm gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Assinar Contrato de Serviços
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO FINAL DE ASSINATURA */}
      <Dialog open={showConfirmacaoModal} onOpenChange={setShowConfirmacaoModal}>
        <DialogContent className="w-[96vw] sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b bg-white shrink-0">
            <DialogTitle className="text-base flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Confirmar Assinatura do Contrato {contrato.numero}
            </DialogTitle>
            <DialogDescription className="text-xs">
              A assinatura formaliza a contratação dos serviços de engenharia no valor de{' '}
              <strong>{formatCurrencyBr(contrato.valor_total)}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded border space-y-1">
              <div>
                <strong>Signatário:</strong> {nomeSignatario}
              </div>
              <div>
                <strong>CPF:</strong> {cpfSignatario}
              </div>
              <div>
                <strong>Rastreabilidade:</strong> IP e Hash Criptográfico
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmacaoModal(false)}
              disabled={submittingAssinatura}
            >
              Revisar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAssinarContratoFinal}
              disabled={submittingAssinatura}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {submittingAssinatura ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assinando... ({segundosAssinandoCliente}s / 30s)</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Assinatura Definitiva</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DossieContratoServicoGmais
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        contrato={contrato}
      />
    </div>
  )
}
export default ContratoServicoPublicoPage
