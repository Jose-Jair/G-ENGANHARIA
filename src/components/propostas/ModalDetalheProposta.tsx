import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  History,
  Clock,
  Copy,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileCheck,
  Briefcase,
  Send,
  Lock,
  ChevronDown,
  ChevronUp,
  MessageSquareWarning,
} from 'lucide-react'
import { PropostaRecord, ProjetoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { conversaoProjetoPacoteService } from '@/services/conversaoProjetoPacote'
import { propostasService } from '@/services/propostas'
import { restoreBodyPointerEvents } from '@/lib/utils'
import { ModalConversaoProjetoPacote } from './ModalConversaoProjetoPacote'
import { ModalEnviarPropostaCliente } from './ModalEnviarPropostaCliente'
import { DossiePropostaGmais } from './DossiePropostaGmais'
import { ModalDetalhesContratoServico } from '@/components/contratosServico/ModalDetalhesContratoServico'
import { contratosServicoService } from '@/services/contratosServico'
import { ContratoServicoRecord } from '@/types'
import { Printer } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface ModalDetalhePropostaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord | null
  currentUserId?: string
  currentUserEmail?: string
  onCriarRevisao?: (proposta: PropostaRecord) => void
  onMudarStatus?: (proposta: PropostaRecord, novoStatus: PropostaRecord['status']) => void
  onAbrirAprovacao?: (proposta: PropostaRecord) => void
  canEdit?: boolean
}

export const ModalDetalheProposta: React.FC<ModalDetalhePropostaProps> = ({
  open,
  onOpenChange,
  proposta,
  currentUserId,
  currentUserEmail,
  onCriarRevisao,
  onMudarStatus,
  onAbrirAprovacao,
  canEdit = true,
}) => {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState('documento')
  const [showConversaoModal, setShowConversaoModal] = useState(false)
  const [showEnviarModal, setShowEnviarModal] = useState(false)
  const [showDossieModal, setShowDossieModal] = useState(false)
  const [showContratoModal, setShowContratoModal] = useState(false)
  const [showConfirmacaoEnvioManual, setShowConfirmacaoEnvioManual] = useState(false)
  const [copiandoEnvioManual, setCopiandoEnvioManual] = useState(false)
  const [expandirHistoricoDevolutivas, setExpandirHistoricoDevolutivas] = useState(false)
  const [contratoVinculado, setContratoVinculado] = useState<ContratoServicoRecord | null>(null)
  const [projetosGerados, setProjetosGerados] = useState<ProjetoRecord[]>([])
  const [percentualConvertido, setPercentualConvertido] = useState<number>(0)

  useEffect(() => {
    if (open && proposta?.id) {
      conversaoProjetoPacoteService.listProjetosDaProposta(proposta.id).then((prjs) => {
        setProjetosGerados(prjs)
      })
      contratosServicoService.getByProposta(proposta.id).then(setContratoVinculado)
      propostasService.listItens(proposta.id).then((itens) => {
        if (itens.length > 0) {
          const conv = itens.filter((i) => i.status_conversao === 'convertido').length
          setPercentualConvertido(Math.round((conv / itens.length) * 100))
        } else if (proposta?.status === 'aceita') {
          setPercentualConvertido(100)
        }
      })
    }
  }, [open, proposta?.id, proposta?.status])

  if (!proposta) return null

  const getStatusBadge = (status: PropostaRecord['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>
      case 'aprovacao_interna':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">Aprovação Interna</Badge>
        )
      case 'aprovada':
        return <Badge className="bg-teal-100 text-teal-800 border-teal-300">Aprovada</Badge>
      case 'enviada':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Enviada</Badge>
      case 'visualizada':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">Visualizada</Badge>
        )
      case 'em_negociacao':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">Em Negociação</Badge>
        )
      case 'aceita':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Aceita</Badge>
      case 'recusada':
        return <Badge variant="destructive">Recusada</Badge>
      case 'expirada':
        return (
          <Badge variant="outline" className="text-slate-500 bg-slate-100">
            Expirada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Portão de validação: O link só é liberado para o cliente se a proposta estiver validada/aprovada (não rascunho nem em aprovação interna)
  const isAprovadaParaEnvio =
    proposta.status !== 'rascunho' &&
    proposta.status !== 'aprovacao_interna' &&
    Boolean(proposta.token_aceite)

  const publicLink = isAprovadaParaEnvio
    ? `${window.location.origin}/proposta/${proposta.token_aceite}`
    : ''

  const handleCopiarLink = () => {
    if (!isAprovadaParaEnvio) {
      toast({
        title: 'Link bloqueado',
        description:
          'A proposta precisa ser aprovada internamente antes da liberação do link ao cliente.',
        variant: 'destructive',
      })
      return
    }
    navigator.clipboard.writeText(publicLink)
    toast({
      title: 'Link copiado!',
      description: 'Link público com token copiado para a área de transferência.',
    })
  }

  const handleClicarCopiarLink = () => {
    if (!isAprovadaParaEnvio) {
      toast({
        title: 'Link bloqueado',
        description:
          'A proposta precisa ser aprovada internamente antes da liberação do link ao cliente.',
        variant: 'destructive',
      })
      return
    }

    // Se já estiver enviada, visualizada, em negociação ou aceita, copia direto com toast informativo
    if (proposta.status !== 'aprovada') {
      navigator.clipboard.writeText(publicLink)
      toast({
        title: 'Link copiado!',
        description: 'Link público da proposta copiado para a área de transferência.',
      })
      return
    }

    // Para proposta em status 'aprovada', abre o diálogo de confirmação do envio manual
    setShowConfirmacaoEnvioManual(true)
  }

  const handleConfirmarEnvioManual = async () => {
    if (!proposta?.id) return
    setCopiandoEnvioManual(true)
    try {
      const nomeDestinatario =
        proposta.expand?.empresa?.razao_social || proposta.expand?.cliente_pf?.nome || 'Cliente'
      const contatoDestinatario =
        proposta.expand?.empresa?.telefone ||
        proposta.expand?.cliente_pf?.telefone ||
        proposta.expand?.empresa?.email ||
        proposta.expand?.cliente_pf?.email ||
        ''

      await propostasService.registrarEnvioManual(
        proposta.id,
        nomeDestinatario,
        contatoDestinatario,
      )

      if (publicLink) {
        await navigator.clipboard.writeText(publicLink)
      }

      if (onMudarStatus) {
        onMudarStatus(proposta, 'enviada')
      }

      setShowConfirmacaoEnvioManual(false)
      toast({
        title: 'Envio manual registrado!',
        description:
          'A proposta foi marcada como enviada e o link foi copiado para a área de transferência.',
      })
    } catch (err: any) {
      console.error('Erro ao registrar envio manual:', err)
      toast({
        title: 'Erro ao registrar envio manual',
        description: err.message || 'Não foi possível registrar o envio manual da proposta.',
        variant: 'destructive',
      })
    } finally {
      setCopiandoEnvioManual(false)
    }
  }

  return (
    <>
      <Dialog
        open={open && !showConversaoModal}
        onOpenChange={(op) => {
          if (!op) restoreBodyPointerEvents()
          onOpenChange(op)
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[92vh] overflow-y-auto p-6"
          onCloseAutoFocus={() => restoreBodyPointerEvents()}
        >
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {proposta.numero}
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono">
                    {proposta.revisao || 'Rev.00'}
                  </Badge>
                  {getStatusBadge(proposta.status)}
                </div>
                <DialogDescription className="text-xs mt-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Criada em {formatDateBr(proposta.created)}
                  {proposta.validade && (
                    <span>• Validade até {formatDateBr(proposta.validade)}</span>
                  )}
                </DialogDescription>
              </div>

              {/* Ações rápidas de cabeçalho */}
              <div className="flex items-center gap-2">
                {/* Botão Ver Contrato de Serviços (se gerado) */}
                {contratoVinculado && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowContratoModal(true)}
                    className="h-8 text-xs gap-1.5 border-blue-300 text-blue-800 bg-blue-50/50 hover:bg-blue-100 font-semibold"
                    title="Ver Contrato de Serviços Técnicos associado a esta proposta"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                    Contrato {contratoVinculado.numero}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDossieModal(true)}
                  className="h-8 text-xs gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-50 font-semibold shadow-2xs"
                  title="Visualizar ou imprimir proposta no formato oficial GMAIS"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Dossiê / PDF GMAIS
                </Button>

                {/* Portão de Validação: Botão Enviar ao Cliente (WhatsApp / E-mail) só quando validada */}
                {isAprovadaParaEnvio ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setShowEnviarModal(true)}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold shadow-xs"
                      title="Enviar proposta validada ao cliente via WhatsApp ou E-mail com texto padrão editável"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar ao Cliente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClicarCopiarLink}
                      className="h-8 text-xs gap-1 text-slate-700 hover:text-orange-600 hover:border-orange-300"
                      title="Copiar Link Seguro da Proposta"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Link
                    </Button>{' '}
                  </>
                ) : (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800"
                    title="O link público é liberado somente após aprovação interna pelo Administrador."
                  >
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Link retido (aguarda validação)</span>
                  </div>
                )}

                {canEdit && onCriarRevisao && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCriarRevisao(proposta)}
                    className="h-8 text-xs gap-1 text-slate-700"
                  >
                    <History className="w-3.5 h-3.5" />
                    Gerar Revisão
                  </Button>
                )}

                {proposta.status === 'aprovacao_interna' && onAbrirAprovacao && (
                  <Button
                    size="sm"
                    onClick={() => onAbrirAprovacao(proposta)}
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Aprovação Interna
                  </Button>
                )}

                {/* Botão de gerenciamento do Projeto-Pacote para Comercial/Admin apenas se contrato assinado existir */}
                {canEdit &&
                  proposta.status === 'aceita' &&
                  (proposta.contrato_servico || projetosGerados.length > 0) && (
                    <Button
                      size="sm"
                      onClick={() => setShowConversaoModal(true)}
                      className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5 font-medium shadow-sm"
                      title="Gerenciar Projeto-Pacote vinculado ao Contrato Assinado"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Gerenciar Projeto-Pacote
                    </Button>
                  )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="documento" className="text-xs gap-1.5">
                <FileText className="w-4 h-4" />
                Documento da Proposta
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs gap-1.5">
                <History className="w-4 h-4" />
                Histórico de Revisões ({proposta.historico_revisoes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="status" className="text-xs gap-1.5">
                <Clock className="w-4 h-4" />
                Timeline & Auditoria
              </TabsTrigger>
            </TabsList>

            {/* ABA DOCUMENTO */}
            <TabsContent value="documento" className="space-y-6 pt-3">
              {/* PAINEL DESTACADO: Devolutiva do Cliente (quando status em_negociacao ou com devolutiva) */}
              {proposta.status === 'em_negociacao' && proposta.solicitacao_alteracao_texto && (
                <div className="bg-gradient-to-r from-purple-50 via-amber-50 to-purple-50 border-2 border-purple-300 rounded-lg p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                        <MessageSquareWarning className="w-5 h-5 text-purple-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-purple-950">
                            Devolutiva do Cliente (Negociação Aberta)
                          </h4>
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-[10px]">
                            {proposta.revisao || 'Rev.00'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-purple-700">
                          {proposta.data_solicitacao_alteracao
                            ? `Recebida em ${formatDateTimeBr(proposta.data_solicitacao_alteracao)} via link público`
                            : 'Solicitação de ajustes registrada pelo cliente'}
                        </p>
                      </div>
                    </div>

                    {canEdit && onCriarRevisao && (
                      <Button
                        size="sm"
                        onClick={() => onCriarRevisao(proposta)}
                        className="h-7 text-xs bg-purple-700 hover:bg-purple-800 text-white gap-1 shrink-0 font-medium"
                      >
                        <History className="w-3.5 h-3.5" />
                        Gerar Nova Revisão
                      </Button>
                    )}
                  </div>

                  {/* Texto integral da solicitação atual */}
                  <div className="bg-white/90 border border-purple-200 rounded-md p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    <span className="font-semibold text-purple-900 block mb-1 text-[11px] uppercase tracking-wider">
                      Texto Integral do Cliente:
                    </span>
                    {proposta.solicitacao_alteracao_texto}
                  </div>

                  {/* Histórico retrátil de devolutivas anteriores */}
                  {proposta.historico_devolutivas && proposta.historico_devolutivas.length > 0 && (
                    <div className="border-t border-purple-200/80 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandirHistoricoDevolutivas(!expandirHistoricoDevolutivas)
                        }
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-900 hover:text-purple-950 focus:outline-none"
                      >
                        {expandirHistoricoDevolutivas ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        Histórico de Devolutivas Anteriores ({proposta.historico_devolutivas.length}
                        )
                      </button>

                      {expandirHistoricoDevolutivas && (
                        <div className="mt-2 space-y-2">
                          {proposta.historico_devolutivas.map((dev, idx) => (
                            <div
                              key={idx}
                              className="bg-purple-50/60 border border-purple-200/60 rounded p-2.5 text-xs text-slate-700"
                            >
                              <div className="flex items-center justify-between text-[10px] text-purple-800 font-semibold mb-1">
                                <span>
                                  {dev.versao || 'Versão anterior'} — {formatDateTimeBr(dev.data)}
                                </span>
                                <span className="text-slate-500 font-normal">
                                  {dev.autor || 'Cliente'}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-slate-800 leading-snug">
                                {dev.texto}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Bloco de Rastreabilidade Projeto-Pacote se proposta tiver projetos ou itens convertidos */}
              {(projetosGerados.length > 0 || percentualConvertido > 0) && (
                <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-orange-950 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-orange-600" />
                      Rastreabilidade: Projeto-Pacote Vinculado
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      {projetosGerados.length > 0 ? (
                        <span>
                          Projetos gerados:{' '}
                          {projetosGerados.map((p) => (
                            <strong key={p.id} className="text-slate-900 font-mono mr-2">
                              {p.codigo} ({p.nome})
                            </strong>
                          ))}
                        </span>
                      ) : (
                        <span>Projeto associado em processamento</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Escopo Convertido
                      </span>
                      <span className="font-mono font-bold text-sm text-orange-700">
                        {percentualConvertido}%
                      </span>
                    </div>

                    {canEdit &&
                      proposta.status === 'aceita' &&
                      (proposta.contrato_servico || projetosGerados.length > 0) && (
                        <Button
                          size="sm"
                          onClick={() => setShowConversaoModal(true)}
                          className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          Gerenciar Etapas
                        </Button>
                      )}
                  </div>
                </div>
              )}
              {/* Cabeçalho do Documento */}
              <div className="bg-slate-50 border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                    Contratante / Destinatário
                  </span>
                  {proposta.expand?.empresa ? (
                    <div className="mt-1">
                      <div className="font-bold text-slate-900 text-sm">
                        {proposta.expand.empresa.razao_social}
                      </div>
                      <div className="text-slate-600">CNPJ: {proposta.expand.empresa.cnpj}</div>
                      {(proposta.expand.empresa.municipio || proposta.expand.empresa.uf) && (
                        <div className="text-slate-500">
                          {[proposta.expand.empresa.municipio, proposta.expand.empresa.uf]
                            .filter(Boolean)
                            .join(' / ')}
                        </div>
                      )}
                    </div>
                  ) : proposta.expand?.cliente_pf ? (
                    <div className="mt-1">
                      <div className="font-bold text-slate-900 text-sm">
                        {proposta.expand.cliente_pf.nome}
                      </div>
                      <div className="text-slate-600">
                        CPF: {proposta.expand.cliente_pf.cpf || 'Não informado'}
                      </div>
                      {proposta.expand.cliente_pf.endereco && (
                        <div className="text-slate-500">{proposta.expand.cliente_pf.endereco}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">Cliente não especificado</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                    Contrato Público / Referência
                  </span>
                  {proposta.expand?.contrato ? (
                    <div className="mt-1">
                      <div className="font-semibold text-slate-900">
                        {proposta.expand.contrato.numero} - {proposta.expand.contrato.orgao}
                      </div>
                      <div className="text-slate-600">
                        Valor Contrato: {formatCurrencyBr(proposta.expand.contrato.valor)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 mt-1">Serviço Direto / Sem contrato prévio</div>
                  )}
                </div>
              </div>

              {/* Escopo Técnico */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Escopo Técnico e Atividades
                </h4>
                <div className="bg-white border rounded-lg p-4 text-xs whitespace-pre-wrap leading-relaxed text-slate-700">
                  {proposta.escopo || 'Nenhum escopo detalhado.'}
                </div>
              </div>

              {/* Disciplinas e Entregáveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Disciplinas Envolvidas
                  </h4>
                  <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-700">
                    {proposta.disciplinas || 'Não especificadas'}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Entregáveis Técnicos
                  </h4>
                  <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-700">
                    {proposta.entregaveis || 'Memoriais, pranchas e arquivos digitais'}
                  </div>
                </div>
              </div>

              {/* Planilha de Itens de Serviço */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  4. Planilha Orçamentária de Serviços
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Item / Serviço</th>
                        <th className="py-2 px-3">Disciplina</th>
                        <th className="py-2 px-3 text-center">Unid.</th>
                        <th className="py-2 px-3 text-center">Qtd.</th>
                        <th className="py-2 px-3 text-right">Custo Unit.</th>
                        <th className="py-2 px-3 text-right">Preço Venda Unit.</th>
                        <th className="py-2 px-3 text-right">Preço Venda Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {proposta.itens_json && proposta.itens_json.length > 0 ? (
                        <>
                          {proposta.itens_json.map((it, idx) => {
                            const bdi = Number(it.bdi_percentual ?? proposta.margem ?? 0)
                            const qtd = Number(it.quantidade) || 1
                            const precoTotalItem =
                              it.preco_total != null
                                ? Math.round(Number(it.preco_total) * 100) / 100
                                : Math.round(Number(it.custo_total) * (1 + bdi / 100) * 100) / 100
                            const precoUnitVenda =
                              it.preco_venda_unitario != null
                                ? Math.round(Number(it.preco_venda_unitario) * 100) / 100
                                : Math.round((precoTotalItem / qtd) * 100) / 100

                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-medium text-slate-900">
                                  {it.descricao}
                                </td>
                                <td className="py-2 px-3 text-slate-600">{it.disciplina || '-'}</td>
                                <td className="py-2 px-3 text-center text-slate-600">
                                  {it.unidade || 'un'}
                                </td>
                                <td className="py-2 px-3 text-center font-mono">{it.quantidade}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">
                                  {formatCurrencyBr(it.custo_unitario)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-800">
                                  {formatCurrencyBr(precoUnitVenda)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                  {formatCurrencyBr(precoTotalItem)}
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={6} className="py-2 px-3 text-right text-slate-700">
                              Total da Planilha de Venda:
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-orange-700">
                              {formatCurrencyBr(
                                Math.round(
                                  proposta.itens_json.reduce((acc, it) => {
                                    const bdi = Number(it.bdi_percentual ?? proposta.margem ?? 0)
                                    const precoTotalItem =
                                      it.preco_total != null
                                        ? Math.round(Number(it.preco_total) * 100) / 100
                                        : Math.round(
                                            Number(it.custo_total) * (1 + bdi / 100) * 100,
                                          ) / 100
                                    return acc + precoTotalItem
                                  }, 0) * 100,
                                ) / 100,
                              )}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">
                            Nenhum item discriminado individualmente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preço e Condições */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border rounded-lg p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    5. Prazo e Pagamento
                  </h4>
                  <div>
                    <span className="text-slate-500 font-medium">Prazo de Execução:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {proposta.prazo || '30 dias corridos'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Condições de Pagamento:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {proposta.condicoes_pagamento || 'A combinar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Validade da Proposta:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {proposta.validade ? formatDateBr(proposta.validade) : '15 dias corridos'}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">
                    6. Resumo Financeiro & BDI
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Custo Direto:</span>
                    <span className="font-mono text-slate-800">
                      {formatCurrencyBr(proposta.custo || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Margem Comercial:</span>
                    <span className="font-mono text-slate-800">{proposta.margem || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Exigência de Nota Fiscal:</span>
                    <span className="font-semibold text-slate-800">
                      {proposta.requer_nota ? 'Sim (com nota)' : 'Não (sem nota)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tributos e Impostos:</span>
                    <span className="font-mono text-slate-800">
                      {proposta.requer_nota ? `${proposta.impostos || 0}%` : '0% (desligado)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-2 text-sm font-bold text-blue-900">
                    <span>Preço Total da Proposta:</span>
                    <span className="font-mono text-base">{formatCurrencyBr(proposta.preco)}</span>
                  </div>
                </div>
              </div>

              {/* Premissas e Exclusões */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    7. Premissas Técnicas
                  </h4>
                  <div className="p-3 bg-slate-50 border rounded text-slate-600">
                    {proposta.premissas || 'Nenhuma premissa adicional.'}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    8. Exclusões de Escopo
                  </h4>
                  <div className="p-3 bg-slate-50 border rounded text-slate-600">
                    {proposta.exclusoes || 'Nenhuma exclusão registrada.'}
                  </div>
                </div>
              </div>

              {/* Se recusada, exibir motivo */}
              {proposta.status === 'recusada' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-red-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Proposta Recusada pelo Cliente
                  </div>
                  <div className="text-red-700">
                    <strong>Motivo:</strong> {proposta.motivo_recusa || 'Não especificado'}
                  </div>
                  {proposta.detalhe_recusa && (
                    <div className="text-red-600">
                      <strong>Detalhe:</strong> {proposta.detalhe_recusa}
                    </div>
                  )}
                  {proposta.data_recusa && (
                    <div className="text-[11px] text-red-500">
                      Registrado em {formatDateTimeBr(proposta.data_recusa)}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ABA HISTÓRICO DE REVISÕES */}
            <TabsContent value="historico" className="space-y-4 pt-3 text-xs">
              {proposta.historico_revisoes && proposta.historico_revisoes.length > 0 ? (
                <div className="space-y-3">
                  {proposta.historico_revisoes.map((rev, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold bg-white">
                            {rev.revisao}
                          </Badge>
                          <span className="text-slate-600 font-medium">
                            Arquivada em {formatDateTimeBr(rev.data)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrencyBr(rev.preco)}
                        </span>
                      </div>

                      <div className="text-slate-700">
                        <strong>Escopo registrado:</strong>
                        <p className="line-clamp-2 text-slate-600 mt-0.5">
                          {rev.conteudo_snapshot?.escopo}
                        </p>
                      </div>

                      <div className="flex gap-4 text-[11px] text-slate-500">
                        <span>Custo: {formatCurrencyBr(rev.custo)}</span>
                        <span>Margem: {rev.margem}%</span>
                        <span>Impostos: {rev.impostos}%</span>
                        {rev.responsavel_nome && <span>Por: {rev.responsavel_nome}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  Esta proposta ainda está na versão original (Rev.00) e não possui revisões
                  anteriores arquivadas.
                </div>
              )}
            </TabsContent>

            {/* ABA TIMELINE & AUDITORIA */}
            <TabsContent value="status" className="space-y-3 pt-3 text-xs">
              <div className="border rounded-lg divide-y bg-white">
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">Criação da Proposta</div>
                    <div className="text-slate-500 text-[11px]">
                      {formatDateTimeBr(proposta.created)} por{' '}
                      {proposta.expand?.criado_por?.name || 'Sistema'}
                    </div>
                  </div>
                  <Badge variant="outline">Início</Badge>
                </div>

                {proposta.data_aprovacao_financeira && (
                  <div className="p-3 flex items-center justify-between bg-emerald-50/50">
                    <div>
                      <div className="font-semibold text-emerald-900">
                        Parecer Financeiro Emitido
                      </div>
                      <div className="text-emerald-700 text-[11px]">
                        {formatDateTimeBr(proposta.data_aprovacao_financeira)} por{' '}
                        {proposta.expand?.aprovador_financeiro?.name || 'Financeiro'}
                      </div>
                      {proposta.parecer_financeiro && (
                        <div className="text-slate-600 text-[11px] mt-1 italic">
                          "{proposta.parecer_financeiro}"
                        </div>
                      )}
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                )}

                {proposta.data_aprovacao_admin && (
                  <div className="p-3 flex items-center justify-between bg-blue-50/50">
                    <div>
                      <div className="font-semibold text-blue-900">
                        Aprovação de Alçada (Diretoria/Admin)
                      </div>
                      <div className="text-blue-700 text-[11px]">
                        {formatDateTimeBr(proposta.data_aprovacao_admin)} por{' '}
                        {proposta.expand?.aprovador_admin?.name || 'Administrador'}
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                )}

                {proposta.data_visualizacao && (
                  <div className="p-3 flex items-center justify-between bg-indigo-50/50">
                    <div>
                      <div className="font-semibold text-indigo-900">
                        Primeira Visualização pelo Cliente
                      </div>
                      <div className="text-indigo-700 text-[11px]">
                        Acessada via link público único em{' '}
                        {formatDateTimeBr(proposta.data_visualizacao)}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                      Visualizada
                    </Badge>
                  </div>
                )}

                {proposta.data_aceite && (
                  <div className="p-3 flex items-center justify-between bg-emerald-100/60">
                    <div>
                      <div className="font-semibold text-emerald-950">
                        Proposta Aceita pelo Cliente
                      </div>
                      <div className="text-emerald-800 text-[11px]">
                        Aceite digital registrado em {formatDateTimeBr(proposta.data_aceite)}.
                        <br />
                        <strong>Tríplice Consequência Disparada:</strong> Projeto gerado, Conta a
                        receber criada, Empresa convertida em Parceira.
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                )}

                {proposta.data_recusa && (
                  <div className="p-3 flex items-center justify-between bg-red-50">
                    <div>
                      <div className="font-semibold text-red-900">
                        Proposta Recusada pelo Cliente
                      </div>
                      <div className="text-red-700 text-[11px]">
                        Registrado em {formatDateTimeBr(proposta.data_recusa)}.
                        <br />
                        Motivo obrigatório: {proposta.motivo_recusa}
                      </div>
                    </div>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                )}
              </div>

              {/* Ações manuais de status para o Comercial */}
              {canEdit && proposta.status !== 'aceita' && proposta.status !== 'recusada' && (
                <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">Mudar Status Manualmente</div>
                    <div className="text-[11px] text-slate-500">
                      Controle de fluxo de negociação do Comercial
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {proposta.status !== 'em_negociacao' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMudarStatus && onMudarStatus(proposta, 'em_negociacao')}
                        className="text-xs h-7 text-purple-700 hover:bg-purple-50"
                      >
                        Marcar Em Negociação
                      </Button>
                    )}

                    {proposta.status === 'rascunho' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onMudarStatus && onMudarStatus(proposta, 'aprovacao_interna')
                        }
                        className="text-xs h-7 text-amber-700 hover:bg-amber-50"
                      >
                        Enviar para Aprovação
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG DE CONFIRMAÇÃO DO ENVIO MANUAL AO COPIAR O LINK */}
      <AlertDialog open={showConfirmacaoEnvioManual} onOpenChange={setShowConfirmacaoEnvioManual}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Envio Manual da Proposta?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Confirma o envio manual deste link ao cliente? Ao confirmar, a proposta será marcada
                como <strong>enviada</strong> e o evento será auditado no sistema com seu usuário e
                registro de data/hora.
              </p>
              <p className="font-mono text-[11px] bg-slate-100 p-2 rounded text-slate-800 truncate">
                {publicLink}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={copiandoEnvioManual}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarEnvioManual}
              disabled={copiandoEnvioManual}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {copiandoEnvioManual ? 'Processando...' : 'Confirmar e Copiar Link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DO DOSSIÊ / PDF NO MODELO REAL GMAIS */}
      <DossiePropostaGmais
        open={showDossieModal}
        onOpenChange={(op) => {
          setShowDossieModal(op)
          restoreBodyPointerEvents()
        }}
        proposta={proposta}
      />

      {/* MODAL DETALHES DO CONTRATO DE SERVIÇO */}
      {showContratoModal && contratoVinculado && (
        <ModalDetalhesContratoServico
          open={showContratoModal}
          onOpenChange={(op) => {
            setShowContratoModal(op)
            restoreBodyPointerEvents()
          }}
          contratoId={contratoVinculado.id}
          isAdmin={isAdmin}
          onUpdated={() => {
            if (proposta?.id) {
              contratosServicoService.getByProposta(proposta.id).then(setContratoVinculado)
            }
          }}
        />
      )}

      {/* MODAL DE ENVIO VIA WHATSAPP / E-MAIL TRANSACIONAL COM TEXTO PADRÃO E AUDITORIA */}
      {showEnviarModal && (
        <ModalEnviarPropostaCliente
          open={showEnviarModal}
          onOpenChange={(op) => {
            setShowEnviarModal(op)
            restoreBodyPointerEvents()
          }}
          proposta={proposta}
          onEnvioConcluido={() => {
            if (onMudarStatus) {
              onMudarStatus(proposta, 'enviada')
            }
          }}
        />
      )}

      {/* MODAL DE CONVERSÃO EM PROJETO-PACOTE */}
      {showConversaoModal && (
        <ModalConversaoProjetoPacote
          open={showConversaoModal}
          onOpenChange={(op) => {
            setShowConversaoModal(op)
            restoreBodyPointerEvents()
          }}
          proposta={proposta}
          currentUserId={currentUserId}
          onConversaoSucesso={() => {
            if (!proposta?.id) return
            conversaoProjetoPacoteService.listProjetosDaProposta(proposta.id).then((prjs) => {
              setProjetosGerados(prjs)
            })
            propostasService.listItens(proposta.id).then((itens) => {
              if (itens.length > 0) {
                const conv = itens.filter((i) => i.status_conversao === 'convertido').length
                setPercentualConvertido(Math.round((conv / itens.length) * 100))
              }
            })
          }}
        />
      )}
    </>
  )
}
