import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  KeyRound,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  assinaturaEletronicaService,
  CLÁUSULA_ACEITE_ELETRONICO_PADRAO,
} from '@/services/assinaturaEletronica'
import { PortalOsRecord } from '@/types'
import { formatCurrencyBr } from '@/lib/formatters'

interface ModalAssinaturaEletronicaOSProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  os: PortalOsRecord | null
  usuarioNome?: string
  usuarioDoc?: string
  onSucesso: () => void
}

export const ModalAssinaturaEletronicaOS: React.FC<ModalAssinaturaEletronicaOSProps> = ({
  open,
  onOpenChange,
  os,
  usuarioNome = '',
  usuarioDoc = '',
  onSucesso,
}) => {
  const [nomeAssinante, setNomeAssinante] = useState(usuarioNome)
  const [docAssinante, setDocAssinante] = useState(usuarioDoc)
  const [concordou, setConcordou] = useState(false)
  const [codigoOtp, setCodigoOtp] = useState('')

  // Estados de envio de código e contador regressivo
  const [solicitandoCodigo, setSolicitandoCodigo] = useState(false)
  const [codigoSolicitado, setCodigoSolicitado] = useState(false)
  const [emailDestinoMascarado, setEmailDestinoMascarado] = useState('')
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState<number>(0)
  const [assinando, setAssinando] = useState(false)

  // Mensagens de feedback
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)

  // Resetar quando o modal abre ou muda de OS
  useEffect(() => {
    if (open) {
      setNomeAssinante(usuarioNome || '')
      setDocAssinante(usuarioDoc || '')
      setConcordou(false)
      setCodigoOtp('')
      setCodigoSolicitado(false)
      setEmailDestinoMascarado('')
      setTempoRestanteSegundos(0)
      setMensagemErro(null)
      setMensagemSucesso(null)
    }
  }, [open, os, usuarioNome, usuarioDoc])

  // Contador regressivo de 10 minutos (600 segundos)
  useEffect(() => {
    if (tempoRestanteSegundos <= 0) return

    const timer = setInterval(() => {
      setTempoRestanteSegundos((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [tempoRestanteSegundos])

  const formatarTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60)
    const s = segundos % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleSolicitarCodigo = async () => {
    if (!os) return
    setSolicitandoCodigo(true)
    setMensagemErro(null)
    setMensagemSucesso(null)
    try {
      const resp = await assinaturaEletronicaService.solicitarCodigoOS(
        os.os_id,
        os.token_assinatura,
      )
      setCodigoSolicitado(true)
      setEmailDestinoMascarado(resp.email_mascarado || 'e-mail cadastrado')
      setTempoRestanteSegundos(10 * 60) // 10 minutos
      setMensagemSucesso('Código de 6 dígitos gerado e enviado com sucesso!')
    } catch (err: any) {
      setMensagemErro(err.message || 'Falha ao solicitar código de verificação. Tente novamente.')
    } finally {
      setSolicitandoCodigo(false)
    }
  }

  const handleConfirmarAssinatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!os) return

    if (!concordou) {
      setMensagemErro('Você precisa declarar concordância com os termos antes de assinar.')
      return
    }

    if (!codigoOtp || codigoOtp.trim().length !== 6) {
      setMensagemErro('Informe o código numérico de 6 dígitos enviado por e-mail.')
      return
    }

    if (tempoRestanteSegundos <= 0) {
      setMensagemErro(
        'Código de verificação expirado (validade de 10 minutos). Clique em Reenviar Código.',
      )
      return
    }

    setAssinando(true)
    setMensagemErro(null)
    setMensagemSucesso(null)

    try {
      await assinaturaEletronicaService.assinarOS(os.os_id, {
        token: os.token_assinatura,
        codigo_otp: codigoOtp.trim(),
        nome: nomeAssinante.trim(),
        documento: docAssinante.trim(),
        declaracao: concordou,
      })

      setMensagemSucesso('Assinatura eletrônica registrada com validade jurídica plena!')
      setTimeout(() => {
        onSucesso()
        onOpenChange(false)
      }, 1500)
    } catch (err: any) {
      const msg = err.message || 'Erro ao processar assinatura com código.'
      setMensagemErro(msg)
    } finally {
      setAssinando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg text-[#D95A2B]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base text-slate-900">
                Assinatura Eletrônica Jurídica — Ordem de Serviço
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Padrão MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020 com Verificação OTP
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConfirmarAssinatura} className="space-y-4 pt-1">
          {/* Dados resumidos da OS exclusiva do prestador (Sem dados de cliente/obra/outros) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ordem de Serviço:</span>
              <strong className="text-slate-900 font-mono text-sm">{os?.numero_os}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Disciplina Técnica:</span>
              <span className="font-semibold text-slate-800">{os?.disciplina || 'Engenharia'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Valor Acordado da OS:</span>
              <strong className="text-emerald-700 text-sm">
                {formatCurrencyBr(os?.valor_os || 0)}
              </strong>
            </div>
            {os?.prazo_dias && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Prazo de Execução:</span>
                <span>{os.prazo_dias} dias corridos</span>
              </div>
            )}
          </div>

          {/* Cláusula Legal de Aceite Eletrônico */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#D95A2B]" />
              Cláusula Legal de Aceite de Assinatura Eletrônica
            </Label>
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-[11px] text-amber-950 leading-relaxed max-h-28 overflow-y-auto">
              {CLÁUSULA_ACEITE_ELETRONICO_PADRAO}
            </div>
          </div>

          {/* Escopo da OS */}
          {os?.escopo_tecnico && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Resumo do Escopo</Label>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 line-clamp-3">
                {os.escopo_tecnico}
              </div>
            </div>
          )}

          {/* Identificação do Signatário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome Completo do Signatário *</Label>
              <Input
                required
                value={nomeAssinante}
                onChange={(e) => setNomeAssinante(e.target.value)}
                placeholder="Ex.: João da Silva"
                className="text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">CPF / CNPJ do Signatário *</Label>
              <Input
                required
                value={docAssinante}
                onChange={(e) => setDocAssinante(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="text-xs mt-1"
              />
            </div>
          </div>

          {/* Declaração de Concordância */}
          <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Checkbox
              id="declara_concordancia"
              checked={concordou}
              onCheckedChange={(c) => setConcordou(!!c)}
              className="mt-0.5"
            />
            <label
              htmlFor="declara_concordancia"
              className="text-[11px] text-slate-700 leading-snug cursor-pointer select-none"
            >
              Declaro que li e concordo integralmente com as obrigações técnicas, prazos e valores
              desta Ordem de Serviço, reconhecendo expressamente a validade jurídica plena desta
              assinatura formalizada com código de verificação OTP.
            </label>
          </div>

          {/* Bloco de Código de 6 Dígitos e Contador */}
          <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D95A2B]" />
                <span className="text-xs font-bold text-slate-900">
                  Código de Confirmação (OTP 6 dígitos)
                </span>
              </div>

              {!codigoSolicitado ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSolicitarCodigo}
                  disabled={solicitandoCodigo || !concordou}
                  className="bg-[#1E2A4A] hover:bg-[#141D34] text-white text-xs h-8"
                >
                  {solicitandoCodigo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Solicitar Código por E-mail
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded font-bold ${
                      tempoRestanteSegundos <= 60
                        ? 'bg-rose-100 text-rose-700 animate-pulse'
                        : 'bg-orange-100 text-[#D95A2B]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Validade: {formatarTempo(tempoRestanteSegundos)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSolicitarCodigo}
                    disabled={solicitandoCodigo}
                    className="text-xs h-8 gap-1 border-orange-300 text-slate-700 hover:bg-orange-100"
                    title="Solicitar novo código por e-mail"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reenviar
                  </Button>
                </div>
              )}
            </div>

            {codigoSolicitado && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-slate-600">
                  Um código numérico de 6 dígitos foi enviado para{' '}
                  <strong className="text-slate-800">{emailDestinoMascarado}</strong>. Consulte sua
                  caixa de entrada e spam.
                </p>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">
                    Digite o código de 6 dígitos recebido:
                  </Label>
                  <Input
                    maxLength={6}
                    value={codigoOtp}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setCodigoOtp(v)
                    }}
                    placeholder="Ex: 482915"
                    disabled={tempoRestanteSegundos <= 0 || assinando}
                    className="font-mono text-center text-lg tracking-widest font-bold max-w-[200px] mt-1 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feedback de Erro */}
          {mensagemErro && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
              <AlertDescription>{mensagemErro}</AlertDescription>
            </Alert>
          )}

          {/* Feedback de Sucesso */}
          {mensagemSucesso && (
            <Alert className="py-2 text-xs bg-emerald-50 text-emerald-800 border-emerald-300">
              <CheckCircle2 className="w-4 h-4 mr-2 shrink-0 text-emerald-600" />
              <AlertDescription>{mensagemSucesso}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={assinando}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                !concordou ||
                !codigoSolicitado ||
                codigoOtp.length !== 6 ||
                tempoRestanteSegundos <= 0 ||
                assinando
              }
              className="bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5"
            >
              {assinando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gravando Assinatura...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Confirmar Assinatura da OS
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default ModalAssinaturaEletronicaOS
