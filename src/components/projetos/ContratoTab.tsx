import React, { useState } from 'react'
import {
  FileText,
  ShieldCheck,
  Check,
  Loader2,
  Copy,
  Upload,
  Calendar,
  DollarSign,
  Clock,
  Printer,
  UserCheck,
  ExternalLink,
  AlertCircle,
  FileSignature,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContratoServicoRecord, ProjetoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { contratosServicoService } from '@/services/contratosServico'
import { DossieContratoServicoGmais } from '@/components/contratosServico/DossieContratoServicoGmais'
import { ModalEnviarContratoWhatsApp } from '@/components/contratosServico/ModalEnviarContratoWhatsApp'
import { ModalEnviarComplementoWhatsApp } from '@/components/contratosServico/ModalEnviarComplementoWhatsApp'
import { useToast } from '@/hooks/use-toast'
import { openProtectedFile } from '@/lib/pocketbase/files'
import { useTempoRealContratos } from '@/hooks/useTempoRealContratos'

interface ContratoTabProps {
  projeto: ProjetoRecord
  contrato: ContratoServicoRecord | null
  isAdmin?: boolean
  canEdit?: boolean
  onRefresh: () => void
}

export function ContratoTab({
  projeto,
  contrato,
  isAdmin = false,
  canEdit = false,
  onRefresh,
}: ContratoTabProps) {
  const { toast } = useToast()

  // Escuta SSE em tempo real para o contrato do projeto (com pré-cadastros e fallback polling)
  useTempoRealContratos({
    contratoId: contrato?.id,
    propostaId: projeto.proposta || (contrato?.proposta as string) || undefined,
    onRecarregar: () => {
      onRefresh()
    },
    ativo: !!contrato?.id,
    escutarPreCadastros: true,
  })
  const [assinandoAdmin, setAssinandoAdmin] = useState(false)
  const [salvandoClausulas, setSalvandoClausulas] = useState(false)
  const [clausulasTexto, setClausulasTexto] = useState('')
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [dossieOpen, setDossieOpen] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showComplementoWhatsAppModal, setShowComplementoWhatsAppModal] = useState(false)
  // Atualizar cláusulas locais se contrato mudar
  React.useEffect(() => {
    if (contrato) {
      setClausulasTexto(contrato.clausulas_texto || '')
    }
  }, [contrato?.id, contrato?.clausulas_texto])

  if (!contrato) {
    return (
      <Card className="border-dashed border-slate-300 bg-white">
        <CardContent className="py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <FileSignature className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">
            Nenhum contrato de serviço vinculado a este projeto
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Este projeto não possui um Contrato de Serviços (CTR) emitido diretamente pela proposta
            ou pelo fluxo comercial.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isAguardandoDados = contrato.status === 'aguardando_dados_cliente'
  const linkAssinaturaCliente = `${window.location.origin}/contrato-servico/${contrato.token_assinatura_cliente || ''}`
  const linkComplementoDados = contrato.token_complemento_dados
    ? `${window.location.origin}/completar-cadastro/${contrato.token_complemento_dados}`
    : ''

  const handleAssinarComoAdmin = async () => {
    setAssinandoAdmin(true)
    try {
      await contratosServicoService.assinarComoAdmin(contrato.id, true)
      toast({
        title: 'Contrato Assinado pelo Administrador!',
        description:
          'Assinatura eletrônica registrada com hash e auditoria. O link para o cliente está liberado.',
      })
      onRefresh()
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
    setSalvandoClausulas(true)
    try {
      await contratosServicoService.updateClausulas(contrato.id, clausulasTexto)
      toast({
        title: 'Cláusulas salvas com sucesso!',
        description: 'Texto contratual atualizado e registrado na auditoria.',
      })
      onRefresh()
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
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setUploadingPdf(true)
    try {
      await contratosServicoService.uploadPdfAssinado(contrato.id, file)
      toast({
        title: 'PDF anexado com sucesso!',
        description: `Arquivo ${file.name} salvo com sucesso no contrato.`,
      })
      onRefresh()
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

  const clienteNome =
    contrato.expand?.empresa?.razao_social ||
    contrato.expand?.cliente_pf?.nome ||
    projeto.expand?.empresa?.razao_social ||
    projeto.expand?.cliente_pf?.nome ||
    'Cliente Contratante'

  const clienteDoc =
    contrato.expand?.empresa?.cnpj ||
    contrato.expand?.cliente_pf?.cpf ||
    projeto.expand?.empresa?.cnpj ||
    projeto.expand?.cliente_pf?.cpf ||
    'Não informado'

  const estaEmContratacao = projeto.status === 'contratacao'
  const assinado = contrato.status === 'assinado'

  return (
    <div className="space-y-4">
      {/* Alerta de Dados Pendentes (Bloco 3) */}
      {isAguardandoDados ? (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold text-amber-950 text-sm">
                Aguardando Dados Cadastrais do Cliente (Bloco 3)
              </p>
              <p>
                O cliente deu aceite na proposta, porém restam dados obrigatórios para que o
                contrato seja gerado completo e liberado para assinatura. O link exclusivo de
                complemento de dados foi gerado.
              </p>
              {contrato.campos_faltantes_json && contrato.campos_faltantes_json.length > 0 && (
                <p className="text-[11px] text-amber-800">
                  Campos pendentes: <strong>{contrato.campos_faltantes_json.join(', ')}</strong>
                </p>
              )}
            </div>
          </div>
          {linkComplementoDados && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(linkComplementoDados)
                  toast({ title: 'Link de complemento copiado com sucesso!' })
                }}
                className="h-8 text-xs border-amber-300 text-amber-900 bg-amber-100/70 hover:bg-amber-100 gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Link
              </Button>
              <Button
                size="sm"
                onClick={() => setShowComplementoWhatsAppModal(true)}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Complemento
              </Button>
            </div>
          )}
        </div>
      ) : (
        estaEmContratacao && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-semibold text-amber-900">
                Projeto em fase de Contratação — Assinatura Bilateral Pendente
              </p>
              <p>
                Este projeto foi gerado imediatamente após o aceite da proposta. As etapas,
                entregáveis e contas a receber serão ativados automaticamente assim que o contrato
                for assinado bilateralmente (Admin e Cliente).
              </p>
            </div>
          </div>
        )
      )}

      {/* Cabeçalho do Contrato */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-900">
                  {contrato.numero}
                </span>
                <Badge
                  className={
                    assinado
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isAguardandoDados
                        ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                        : contrato.status === 'aguardando_assinatura_admin'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  }
                >
                  {assinado
                    ? 'Assinado e Vigente'
                    : isAguardandoDados
                      ? 'Aguardando dados do cliente'
                      : contrato.status === 'aguardando_assinatura_admin'
                        ? 'Aguardando Assinatura Admin'
                        : 'Aguardando Assinatura Cliente'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Contrato de Prestação de Serviços Técnicos de Engenharia • Vinculado ao Projeto{' '}
                <strong className="text-slate-700">{projeto.codigo}</strong>
                {contrato.expand?.proposta?.numero && (
                  <>
                    {' '}
                    • Proposta{' '}
                    <strong className="text-slate-700">{contrato.expand.proposta.numero}</strong>
                  </>
                )}
              </p>
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
                    title="Enviar formulário de complemento de dados via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp Complemento
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1"
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
                    title="Enviar link de assinatura via WhatsApp"
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
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Grid de Partes e Resumo Comercial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Contratante / Solicitante
              </span>
              <div className="font-semibold text-slate-900 mt-0.5">{clienteNome}</div>
              <div className="text-slate-600">Doc: {clienteDoc}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Valor Total do Contrato
              </span>
              <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                {formatCurrencyBr(contrato.valor_total || projeto.valor_total || 0)}
              </div>
              <div className="text-slate-600">
                {contrato.parcelas_json && contrato.parcelas_json.length > 0
                  ? `${contrato.parcelas_json.length} parcela(s) prevista(s)`
                  : 'Parcela única'}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Prazo e Execução
              </span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {contrato.prazo_dias || 30} dias corridos
              </div>
              <div className="text-slate-500 text-[11px] truncate" title={contrato.nota_prazo}>
                {contrato.nota_prazo || 'A partir da assinatura'}
              </div>
            </div>
          </div>

          {/* Objeto */}
          <div className="text-xs">
            <Label className="text-xs font-semibold text-slate-700">Objeto dos Serviços:</Label>
            <div className="bg-slate-50/60 p-2.5 rounded border border-slate-200 text-slate-800 mt-1 leading-relaxed">
              {contrato.objeto ||
                projeto.descricao ||
                'Prestação de serviços técnicos de engenharia'}
            </div>
          </div>

          {/* Status das Assinaturas Eletrônicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                  <div
                    className="font-mono text-[10px] text-emerald-800 truncate"
                    title={contrato.admin_hash}
                  >
                    Hash: {contrato.admin_hash}
                  </div>
                </div>
              ) : isAdmin ? (
                <div className="space-y-2 mt-2">
                  <p className="text-amber-800 text-[11px]">
                    Como Administrador, assine este contrato para formalizar e liberar a assinatura
                    ao cliente.
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
                  Aguardando assinatura do Administrador do sistema.
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
                  <div
                    className="font-mono text-[10px] text-emerald-800 truncate"
                    title={contrato.cliente_hash}
                  >
                    Hash: {contrato.cliente_hash}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[11px] text-slate-600">
                  <p>Link exclusivo de assinatura do cliente:</p>
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
                        toast({ title: 'Link de assinatura copiado!' })
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
          <div className="p-3.5 bg-slate-50 border rounded-lg space-y-2 text-xs">
            <span className="font-bold text-slate-900 block text-xs">
              Arquivo PDF Final Assinado (Opcional / Cópia Digitalizada)
            </span>
            <div className="flex items-center justify-between gap-3">
              {contrato.arquivo_pdf_assinado ? (
                <button
                  type="button"
                  onClick={() => openProtectedFile(contrato, contrato.arquivo_pdf_assinado)}
                  className="flex items-center gap-2 text-emerald-700 font-medium hover:underline cursor-pointer"
                  title="Clique para baixar o PDF assinado"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF assinado anexado ao registro (Baixar)</span>
                </button>
              ) : (
                <span className="text-slate-500 text-[11px]">Nenhum PDF externo anexado.</span>
              )}

              {canEdit && (
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
              )}
            </div>
          </div>

          {/* Cláusulas do Contrato */}
          <div className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-semibold text-slate-700">
                Cláusulas e Condições Gerais do Contrato:
              </Label>
              {isAdmin && !assinado && (
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
              rows={6}
              value={clausulasTexto}
              onChange={(e) => setClausulasTexto(e.target.value)}
              disabled={!isAdmin || assinado}
              className="text-xs font-sans leading-relaxed bg-white"
            />
          </div>
        </CardContent>
      </Card>

      <DossieContratoServicoGmais
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        contrato={contrato}
      />

      {showWhatsAppModal && contrato && (
        <ModalEnviarContratoWhatsApp
          open={showWhatsAppModal}
          onOpenChange={setShowWhatsAppModal}
          contrato={contrato}
          onEnvioConcluido={() => {
            onRefresh()
          }}
        />
      )}

      {showComplementoWhatsAppModal && contrato && (
        <ModalEnviarComplementoWhatsApp
          open={showComplementoWhatsAppModal}
          onOpenChange={setShowComplementoWhatsAppModal}
          contrato={contrato}
          onEnvioConcluido={() => {
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
