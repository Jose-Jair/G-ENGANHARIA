import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  ShieldCheck,
  Check,
  Loader2,
  Copy,
  Upload,
  Download,
  Calendar,
  DollarSign,
  Clock,
  Printer,
  UserCheck,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'
import { ContratoServicoRecord } from '@/types'
import { DossieContratoServicoGmais } from './DossieContratoServicoGmais'
import { ModalEnviarContratoWhatsApp } from './ModalEnviarContratoWhatsApp'
import { ModalEnviarComplementoWhatsApp } from './ModalEnviarComplementoWhatsApp'
import { AlertCircle } from 'lucide-react'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { contratosServicoService } from '@/services/contratosServico'
import { useToast } from '@/hooks/use-toast'
import { restoreBodyPointerEvents } from '@/lib/utils'

interface ModalDetalhesContratoServicoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratoId: string | null
  isAdmin?: boolean
  onUpdated?: () => void
}

export function ModalDetalhesContratoServico({
  open,
  onOpenChange,
  contratoId,
  isAdmin = false,
  onUpdated,
}: ModalDetalhesContratoServicoProps) {
  const { toast } = useToast()
  const [contrato, setContrato] = useState<ContratoServicoRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [assinandoAdmin, setAssinandoAdmin] = useState(false)
  const [salvandoClausulas, setSalvandoClausulas] = useState(false)
  const [clausulasTexto, setClausulasTexto] = useState('')
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [dossieOpen, setDossieOpen] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showComplementoWhatsAppModal, setShowComplementoWhatsAppModal] = useState(false)

  const loadContrato = async () => {
    if (!contratoId) return
    setLoading(true)
    try {
      const rec = await contratosServicoService.getById(contratoId)
      setContrato(rec)
      setClausulasTexto(rec.clausulas_texto || '')
    } catch (err) {
      console.error('Erro ao carregar contrato:', err)
      toast({
        title: 'Erro ao carregar contrato',
        description: 'Não foi possível carregar os detalhes do contrato.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && contratoId) {
      loadContrato()
    }
  }, [open, contratoId])

  const handleAssinarComoAdmin = async () => {
    if (!contrato) return
    setAssinandoAdmin(true)
    try {
      await contratosServicoService.assinarComoAdmin(contrato.id, true)
      toast({
        title: 'Contrato Assinado pelo Administrador!',
        description:
          'O link de assinatura foi liberado para o cliente e a ação foi auditada com sucesso.',
      })
      await loadContrato()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast({
        title: 'Erro ao assinar contrato',
        description: err.message || 'Falha ao processar assinatura eletrônica.',
        variant: 'destructive',
      })
    } finally {
      setAssinandoAdmin(false)
    }
  }

  const handleSalvarClausulas = async () => {
    if (!contrato) return
    setSalvandoClausulas(true)
    try {
      await contratosServicoService.updateClausulas(contrato.id, clausulasTexto)
      toast({
        title: 'Cláusulas salvas com sucesso!',
      })
      await loadContrato()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar cláusulas',
        description: err.message || 'Falha na atualização.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoClausulas(false)
    }
  }

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!contrato || !e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setUploadingPdf(true)
    try {
      await contratosServicoService.uploadPdfAssinado(contrato.id, file)
      toast({
        title: 'PDF anexado com sucesso!',
        description: `Arquivo ${file.name} anexado ao contrato.`,
      })
      await loadContrato()
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast({
        title: 'Erro no upload do PDF',
        description: err.message || 'Falha ao anexar PDF.',
        variant: 'destructive',
      })
    } finally {
      setUploadingPdf(false)
    }
  }

  if (!contrato && loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600 mx-auto mb-2" />
          <p className="text-xs text-slate-600">Carregando detalhes do contrato...</p>
        </DialogContent>
      </Dialog>
    )
  }

  if (!contrato) return null

  const isAguardandoDados = contrato.status === 'aguardando_dados_cliente'
  const linkAssinaturaCliente = `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente || ''}`
  const linkComplementoDados = contrato.token_complemento_dados
    ? `${window.location.origin}/completar-cadastro/${contrato.token_complemento_dados}`
    : ''

  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        if (!op) restoreBodyPointerEvents()
        onOpenChange(op)
      }}
    >
      <DialogContent className="w-[96vw] max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold text-slate-900 truncate">
                  {contrato.numero}
                </DialogTitle>
                <Badge
                  className={
                    contrato.status === 'assinado'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                      : isAguardandoDados
                        ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                        : contrato.status === 'aguardando_assinatura_admin'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold'
                  }
                >
                  {contrato.status === 'assinado'
                    ? 'Assinado e Vigente'
                    : isAguardandoDados
                      ? 'Aguardando dados do cliente'
                      : contrato.status === 'aguardando_assinatura_admin'
                        ? 'Aguardando Assinatura Admin'
                        : 'Aguardando Assinatura Cliente'}
                </Badge>
              </div>
              <DialogDescription className="text-xs mt-1 truncate">
                Contrato de Prestação de Serviços Técnicos originado da Proposta{' '}
                <strong>{contrato.expand?.proposta?.numero || 'S/N'}</strong>
              </DialogDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50 font-semibold"
                onClick={() => setDossieOpen(true)}
              >
                <Printer className="w-3.5 h-3.5 text-orange-600" />
                Imprimir / PDF Contrato
              </Button>

              {isAguardandoDados && linkComplementoDados && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setShowComplementoWhatsAppModal(true)}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold shadow-xs"
                    title="Enviar link de complemento de dados ao cliente via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp Complemento
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1 font-semibold"
                  >
                    <a href={linkComplementoDados} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Link Complemento
                    </a>
                  </Button>
                </>
              )}

              {!isAguardandoDados && contrato.token_assinatura_cliente && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setShowWhatsAppModal(true)}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold shadow-xs"
                    title="Enviar link de assinatura ao cliente via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Enviar WhatsApp
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                  >
                    <a
                      href={`/contrato-servico/${contrato.token_assinatura_cliente}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Link Público
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 text-xs pt-2">
          {/* Alerta de Complemento de Dados Pendente (Bloco 3) */}
          {isAguardandoDados && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Aguardando Dados do Cliente para Geração Completa do Contrato
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                O cliente formalizou o aceite da proposta, mas restam pendências cadastrais
                obrigatórias (como endereço completo, documento validado ou representante legal). O
                contrato está bloqueado para assinaturas até a complementação.
              </p>
              {linkComplementoDados && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    readOnly
                    value={linkComplementoDados}
                    className="h-7 text-[11px] font-mono bg-white border-amber-300"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 shrink-0 border-amber-300 text-amber-900 bg-amber-100/60"
                    onClick={() => {
                      navigator.clipboard.writeText(linkComplementoDados)
                      toast({ title: 'Link de complemento copiado!' })
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowComplementoWhatsAppModal(true)}
                    className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 font-semibold"
                  >
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Card das Partes e Valores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Contratante / Solicitante
              </span>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                {contrato.expand?.empresa?.razao_social ||
                  contrato.expand?.cliente_pf?.nome ||
                  'Cliente'}
              </div>
              <div className="text-slate-600">
                Documento:{' '}
                {contrato.expand?.empresa?.cnpj ||
                  contrato.expand?.cliente_pf?.cpf ||
                  'Não informado'}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Valor Total e Prazo
              </span>
              <div className="font-mono font-bold text-blue-700 text-sm mt-0.5">
                {formatCurrencyBr(contrato.valor_total)}
              </div>
              <div className="text-slate-600">
                Prazo estimado: {contrato.prazo_dias || 30} dias corridos
              </div>
            </div>
          </div>

          {/* Objeto */}
          <div>
            <Label className="text-xs font-semibold text-slate-700">Objeto dos Serviços:</Label>
            <div className="bg-white p-2.5 rounded border text-slate-800 mt-1 leading-relaxed">
              {contrato.objeto}
            </div>
          </div>

          {/* Status das Assinaturas Eletrônicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assinatura Admin */}
            <div
              className={`p-3.5 rounded-lg border ${
                contrato.data_assinatura_admin
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Assinatura Admin (G+)
                </span>
                {contrato.data_assinatura_admin ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Assinado</Badge>
                ) : (
                  <Badge className="bg-amber-600 text-white text-[10px]">Pendente</Badge>
                )}
              </div>

              {contrato.data_assinatura_admin ? (
                <div className="space-y-1 text-slate-700 text-[11px]">
                  <div>Por: {contrato.expand?.assinante_admin?.name || 'Administrador'}</div>
                  <div>Data: {formatDateTimeBr(contrato.data_assinatura_admin)}</div>
                  <div className="font-mono text-[10px] text-emerald-800 truncate">
                    Hash: {contrato.admin_hash}
                  </div>
                </div>
              ) : isAdmin ? (
                <div className="space-y-2 mt-2">
                  <p className="text-amber-800 text-[11px]">
                    Como Administrador, assine este contrato para liberar o link oficial de
                    assinatura ao cliente.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleAssinarComoAdmin}
                    disabled={assinandoAdmin}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
                  >
                    {assinandoAdmin ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Assinar como Administrador
                  </Button>
                </div>
              ) : (
                <p className="text-amber-700 text-[11px] italic">
                  Aguardando assinatura da Diretoria.
                </p>
              )}
            </div>

            {/* Assinatura Cliente */}
            <div
              className={`p-3.5 rounded-lg border ${
                contrato.data_assinatura_cliente
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Assinatura do Cliente
                </span>
                {contrato.data_assinatura_cliente ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">Assinado</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Pendente
                  </Badge>
                )}
              </div>

              {contrato.data_assinatura_cliente ? (
                <div className="space-y-1 text-slate-700 text-[11px]">
                  <div>Signatário: {contrato.cliente_nome_assinante}</div>
                  <div>Documento: {contrato.cliente_documento_assinante}</div>
                  <div>Data: {formatDateTimeBr(contrato.data_assinatura_cliente)}</div>
                  <div className="font-mono text-[10px] text-emerald-800 truncate">
                    Hash: {contrato.cliente_hash}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[11px] text-slate-600">
                  <p>Link de assinatura do cliente:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={linkAssinaturaCliente}
                      className="h-7 text-[11px] font-mono bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2 shrink-0"
                      title="Copiar Link"
                      onClick={() => {
                        navigator.clipboard.writeText(linkAssinaturaCliente)
                        toast({ title: 'Link copiado!' })
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowWhatsAppModal(true)}
                      className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0"
                      title="Enviar por WhatsApp"
                    >
                      <MessageSquare className="w-3 h-3" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Anexo de PDF Final Assinado (opcional / físico) */}
          <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2">
            <span className="font-bold text-slate-900 block text-xs">
              Arquivo PDF Final Assinado (Opcional / Cópia Digitalizada)
            </span>
            <div className="flex items-center justify-between gap-3">
              {contrato.arquivo_pdf_assinado ? (
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <FileText className="w-4 h-4" />
                  <span>PDF assinado anexado ao registro</span>
                </div>
              ) : (
                <span className="text-slate-500 text-[11px]">Nenhum PDF externo anexado.</span>
              )}

              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    {uploadingPdf ? 'Enviando...' : 'Anexar PDF'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploadingPdf}
                    onChange={handleUploadPdf}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Cláusulas do Contrato */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold text-slate-700">
                Cláusulas e Condições Gerais do Contrato:
              </Label>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSalvarClausulas}
                  disabled={salvandoClausulas}
                  className="h-7 text-xs"
                >
                  {salvandoClausulas ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              )}
            </div>
            <Textarea
              rows={8}
              value={clausulasTexto}
              onChange={(e) => setClausulasTexto(e.target.value)}
              disabled={!isAdmin}
              className="text-xs font-sans leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              restoreBodyPointerEvents()
              onOpenChange(false)
            }}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      <DossieContratoServicoGmais
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        contrato={contrato}
      />

      {showWhatsAppModal && contrato && (
        <ModalEnviarContratoWhatsApp
          open={showWhatsAppModal}
          onOpenChange={(op) => {
            setShowWhatsAppModal(op)
            restoreBodyPointerEvents()
          }}
          contrato={contrato}
          onEnvioConcluido={() => {
            if (onUpdated) onUpdated()
          }}
        />
      )}

      {showComplementoWhatsAppModal && contrato && (
        <ModalEnviarComplementoWhatsApp
          open={showComplementoWhatsAppModal}
          onOpenChange={(op) => {
            setShowComplementoWhatsAppModal(op)
            restoreBodyPointerEvents()
          }}
          contrato={contrato}
          onEnvioConcluido={() => {
            if (onUpdated) onUpdated()
          }}
        />
      )}
    </Dialog>
  )
}
