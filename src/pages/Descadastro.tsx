import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { descadastroService, DescadastroInfo } from '@/services/descadastro'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, ShieldCheck, MailX, Loader2, ArrowLeft } from 'lucide-react'
import { formatDateTimeBr } from '@/lib/formatters'
import { GPlusLogo } from '@/components/GPlusLogo'

export default function DescadastroPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [info, setInfo] = useState<DescadastroInfo | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [motivo, setMotivo] = useState('')

  // Efetuar busca da informação do token
  useEffect(() => {
    const carregarInfo = async () => {
      if (!token) {
        setErrorMsg('Token de descadastro não informado na URL.')
        setLoading(false)
        return
      }

      try {
        const res = await descadastroService.getInfo(token)
        setInfo(res)
        if (res.ja_descadastrado) {
          setSucesso(true)
        }
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Link de descadastro inválido, expirado ou não encontrado no sistema.',
        )
      } finally {
        setLoading(false)
      }
    }

    carregarInfo()
  }, [token])

  const handleConfirmar = async () => {
    if (!token) return
    setSubmitting(true)
    setErrorMsg(null)

    try {
      await descadastroService.confirmar({
        token,
        motivo: motivo.trim() || 'Solicitação de opt-out via página de descadastro',
      })
      setSucesso(true)
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha ao confirmar descadastro. Tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg">
        {/* Header institucional */}
        <div className="text-center mb-6 space-y-2">
          <div className="flex justify-center">
            <GPlusLogo variant="vertical" theme="light" size={56} showSlogan={true} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            GESTÃO G+ • Intermediação Técnica & Gestão de Demandas
          </p>
        </div>

        <Card className="border-slate-200 shadow-md bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Preferências de Comunicação (LGPD)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                Art. 18 Lei 13.709/2018
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Você tem direito garantido por lei de interromper o recebimento de e-mails de
              prospecção e informativos técnicos.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Verificando dados de sua inscrição...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-900">Não foi possível processar</p>
                  <p className="mt-1">{errorMsg}</p>
                </div>
              </div>
            ) : sucesso ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-1">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Descadastro Confirmado</h3>
                  <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
                    O endereço <strong className="text-slate-800">{info?.email}</strong> foi
                    inserido com sucesso em nossa lista de bloqueio <strong>Não Contatar</strong>.
                  </p>
                  {info?.data_descadastro && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      Registrado em: {formatDateTimeBr(info.data_descadastro)}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destinatário:</span>
                    <span className="font-medium text-slate-800">
                      {info?.destinatario_nome || 'Responsável'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Empresa:</span>
                    <span className="font-medium text-slate-800">{info?.empresa_nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status compliance:</span>
                    <span className="font-semibold text-emerald-700">Bloqueado no Servidor</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Nenhum novo e-mail automatizado ou campanha será disparado para esta conta.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <p className="font-medium">Confirmação de Opt-out:</p>
                  <p className="text-amber-800 mt-1">
                    Ao confirmar, você deixará de receber os informativos mensais de engenharia e
                    atualizações técnicas de contratos com o setor público.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">E-mail:</span>
                    <span className="font-semibold text-slate-800">{info?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Empresa:</span>
                    <span className="font-medium text-slate-800">{info?.empresa_nome}</span>
                  </div>
                  {info?.destinatario_nome && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contato:</span>
                      <span className="text-slate-700">{info.destinatario_nome}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Motivo opcional do descadastro:
                  </label>
                  <textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex: Não tenho interesse neste momento / Conteúdo não relevante para nosso escopo..."
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleConfirmar}
                    disabled={submitting}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2.5 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando Opt-out...
                      </>
                    ) : (
                      'Confirmar Descadastro Definitivo'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé com link para login */}
        <div className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Acesso do Sistema Interno
          </Link>
        </div>
      </div>
    </div>
  )
}
