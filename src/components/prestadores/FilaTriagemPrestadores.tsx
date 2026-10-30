import React, { useState, useEffect } from 'react'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Search,
  FileText,
  DollarSign,
  Clock,
  Layers,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Sparkles,
  Calendar,
  User,
  Building,
  Mail,
  Phone,
  Briefcase,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { prestadoresService, prestadoresDocumentosService } from '@/services/prestadores'
import {
  PrestadorRecord,
  PrestadorDocumentoRecord,
  OrigemCadastroPrestador,
  PortfolioItem,
  PrecoReferenciaItem,
  DisponibilidadeItem,
} from '@/types'
import { formatDateBr, formatDateTimeBr, formatCurrencyBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

export const FilaTriagemPrestadores: React.FC<{
  onTriagemAtualizada?: () => void
}> = ({ onTriagemAtualizada }) => {
  const { toast } = useToast()

  const [prestadoresTriagem, setPrestadoresTriagem] = useState<PrestadorRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  // Ficha Detalhada Selecionada
  const [prestadorFicha, setPrestadorFicha] = useState<PrestadorRecord | null>(null)
  const [documentosFicha, setDocumentosFicha] = useState<PrestadorDocumentoRecord[]>([])
  const [carregandoDocs, setCarregandoDocs] = useState(false)

  // Modais de Ação de Triagem
  const [modalAprovarOpen, setModalAprovarOpen] = useState(false)
  const [parecerAprovacao, setParecerAprovacao] = useState('')
  const [notaAprovacao, setNotaAprovacao] = useState<number>(5.0)

  const [modalRecusarOpen, setModalRecusarOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [notaRecusa, setNotaRecusa] = useState<number>(0)

  const [modalComplementoOpen, setModalComplementoOpen] = useState(false)
  const [obsComplemento, setObsComplemento] = useState('')
  const [linkGerado, setLinkGerado] = useState<string | null>(null)

  const [executandoAcao, setExecutandoAcao] = useState(false)

  const carregarFila = async () => {
    setCarregando(true)
    try {
      const lista = await prestadoresService.list("status = 'triagem'")
      setPrestadoresTriagem(lista)
      if (prestadorFicha) {
        const atualizado = lista.find((p) => p.id === prestadorFicha.id)
        if (atualizado) {
          setPrestadorFicha(atualizado)
        } else {
          setPrestadorFicha(null)
        }
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar fila de triagem',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarFila()
  }, [])

  const abrirFicha = async (p: PrestadorRecord) => {
    setPrestadorFicha(p)
    setCarregandoDocs(true)
    try {
      const docs = await prestadoresDocumentosService.listByPrestador(p.id)
      setDocumentosFicha(docs)
    } catch (_) {
      setDocumentosFicha([])
    } finally {
      setCarregandoDocs(false)
    }
  }

  // Ação 1: Aprovar Triagem
  const handleAprovar = async () => {
    if (!prestadorFicha) return
    setExecutandoAcao(true)
    try {
      const res = await prestadoresService.aprovarTriagem(prestadorFicha.id, {
        parecer: parecerAprovacao.trim() || undefined,
        nota: notaAprovacao,
      })
      toast({
        title: 'Triagem Aprovada!',
        description: `${prestadorFicha.nome} avançou para status "Pendente" com minuta de Contrato-Mestre gerada.`,
      })
      setModalAprovarOpen(false)
      setPrestadorFicha(null)
      carregarFila()
      if (onTriagemAtualizada) onTriagemAtualizada()
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar triagem',
        description: err.data?.error || err.message,
        variant: 'destructive',
      })
    } finally {
      setExecutandoAcao(false)
    }
  }

  // Ação 2: Recusar Triagem (motivo estritamente obrigatório)
  const handleRecusar = async () => {
    if (!prestadorFicha) return
    if (!motivoRecusa.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo detalhado da recusa para fins de auditoria técnica.',
        variant: 'destructive',
      })
      return
    }

    setExecutandoAcao(true)
    try {
      await prestadoresService.recusarTriagem(prestadorFicha.id, {
        motivo: motivoRecusa.trim(),
        nota: notaRecusa,
      })
      toast({
        title: 'Triagem Recusada',
        description: `Prestador ${prestadorFicha.nome} movido para status "Inativo" com parecer arquivado.`,
      })
      setModalRecusarOpen(false)
      setPrestadorFicha(null)
      carregarFila()
      if (onTriagemAtualizada) onTriagemAtualizada()
    } catch (err: any) {
      toast({
        title: 'Erro ao recusar triagem',
        description: err.data?.error || err.message,
        variant: 'destructive',
      })
    } finally {
      setExecutandoAcao(false)
    }
  }

  // Ação 3: Pedir Complemento
  const handlePedirComplemento = async () => {
    if (!prestadorFicha) return
    setExecutandoAcao(true)
    try {
      const res = await prestadoresService.pedirComplementoTriagem(prestadorFicha.id, {
        observacoes: obsComplemento.trim() || undefined,
      })
      setLinkGerado(res.link_retorno)
      toast({
        title: 'Solicitação de Complemento Registrada!',
        description: 'Link seguro de retorno gerado e notificação enviada.',
      })
      carregarFila()
      if (onTriagemAtualizada) onTriagemAtualizada()
    } catch (err: any) {
      toast({
        title: 'Erro ao solicitar complemento',
        description: err.data?.error || err.message,
        variant: 'destructive',
      })
    } finally {
      setExecutandoAcao(false)
    }
  }

  // Badge de Origem do Cadastro
  const getOrigemBadge = (origem?: OrigemCadastroPrestador | string) => {
    switch (origem) {
      case 'publico':
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-[#D95A2B] border-orange-200 text-[10px] font-bold"
          >
            Público (Recrutamento)
          </Badge>
        )
      case 'convite':
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold"
          >
            Convite G+
          </Badge>
        )
      case 'interno':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-bold"
          >
            Cadastro Interno
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-slate-500">
            {origem || 'Não inf.'}
          </Badge>
        )
    }
  }

  const prestadoresFiltrados = prestadoresTriagem.filter((p) => {
    const termo = busca.toLowerCase()
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.email && p.email.toLowerCase().includes(termo)) ||
      (p.cpf_cnpj && p.cpf_cnpj.toLowerCase().includes(termo)) ||
      (p.disciplinas && p.disciplinas.toLowerCase().includes(termo))
    )
  })

  return (
    <div className="space-y-6">
      {/* Topo / Métricas da Fila */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Fila de Triagem Técnica de Prestadores
            </h2>
            <Badge className="bg-[#D95A2B] text-white text-[11px] font-bold">
              {prestadoresTriagem.length} pendentes
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Avalie o portfólio, preços de referência, disponibilidade e aceite dos candidatos antes
            de liberar a minuta do Contrato-Mestre.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Filtrar por nome, disciplina ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
      </div>

      {/* Grid Principal: Fila à esquerda + Ficha à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LISTA DA FILA (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 flex items-center justify-between">
            <span>Candidatos em Triagem ({prestadoresFiltrados.length})</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={carregarFila}
              className="h-6 text-[11px] text-[#D95A2B] hover:text-[#b84820]"
            >
              Atualizar
            </Button>
          </div>

          {carregando ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto mb-2" />
              <span className="text-xs text-slate-500">Carregando fila de triagem...</span>
            </div>
          ) : prestadoresFiltrados.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">Fila Limpa</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Não há prestadores aguardando triagem neste momento. Todos os pré-cadastros foram
                avaliados.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {prestadoresFiltrados.map((p) => {
                const isSelected = prestadorFicha?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => abrirFicha(p)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#D95A2B] bg-orange-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm leading-tight">
                          {p.nome}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{p.email}</span>
                      </div>
                      {getOrigemBadge(p.origem_cadastro)}
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      {p.disciplinas && (
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-800">
                            {p.disciplinas}
                          </span>
                        </div>
                      )}
                      {p.conselho && (
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {p.conselho} • {p.numero_registro_conselho || 'Sem nº'}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        <span>Recebido em:</span>
                        <span>{formatDateBr(p.created)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FICHA COMPLETA DO CANDIDATO (7 cols) */}
        <div className="lg:col-span-7">
          {prestadorFicha ? (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/80 p-5 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-slate-900">
                        {prestadorFicha.nome}
                      </CardTitle>
                      {getOrigemBadge(prestadorFicha.origem_cadastro)}
                    </div>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      {prestadorFicha.tipo === 'pj_externo'
                        ? 'Pessoa Jurídica'
                        : 'Pessoa Física Autônoma'}{' '}
                      • Doc:{' '}
                      <span className="font-mono text-slate-700">
                        {prestadorFicha.cpf_cnpj || 'Não informado'}
                      </span>
                    </CardDescription>
                  </div>

                  {/* Botões de Ação de Triagem */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setParecerAprovacao('')
                        setNotaAprovacao(5.0)
                        setModalAprovarOpen(true)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setObsComplemento('')
                        setLinkGerado(null)
                        setModalComplementoOpen(true)
                      }}
                      className="border-blue-300 text-blue-700 bg-blue-50/40 hover:bg-blue-100/50 text-xs gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Pedir Complemento
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMotivoRecusa('')
                        setNotaRecusa(0)
                        setModalRecusarOpen(true)
                      }}
                      className="border-rose-300 text-rose-700 bg-rose-50/40 hover:bg-rose-100/50 text-xs gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 1. Contato e Conselho */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">E-mail:</span>
                    <span className="font-semibold text-slate-800 break-all">
                      {prestadorFicha.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Telefone / WhatsApp:</span>
                    <span className="font-semibold text-slate-800">
                      {prestadorFicha.telefone || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Conselho Profissional:</span>
                    <span className="font-semibold text-slate-800">
                      {prestadorFicha.conselho || 'Não informado'}
                      {prestadorFicha.numero_registro_conselho &&
                        ` • Nº ${prestadorFicha.numero_registro_conselho}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Região de Atuação:</span>
                    <span className="font-semibold text-slate-800">
                      {prestadorFicha.regiao || 'Brasil / Remoto'}
                    </span>
                  </div>
                </div>

                {/* 2. Especialidades e Softwares */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#D95A2B]" />
                    Disciplinas Técnicas & Softwares
                  </h4>
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white text-xs space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Disciplinas Declaradas:
                      </span>
                      <p className="text-slate-800 font-medium whitespace-pre-line mt-0.5">
                        {prestadorFicha.disciplinas || 'Nenhuma disciplina informada.'}
                      </p>
                    </div>
                    {prestadorFicha.softwares && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block text-[11px]">Softwares / BIM:</span>
                        <p className="text-slate-700 mt-0.5">{prestadorFicha.softwares}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Portfólio de Referência */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#D95A2B]" />
                    Portfólio de Referência (
                    {Array.isArray(prestadorFicha.portfolio_json)
                      ? prestadorFicha.portfolio_json.length
                      : 0}
                    )
                  </h4>

                  {Array.isArray(prestadorFicha.portfolio_json) &&
                  prestadorFicha.portfolio_json.length > 0 ? (
                    <div className="space-y-2">
                      {prestadorFicha.portfolio_json.map((item: PortfolioItem, pI: number) => (
                        <div
                          key={pI}
                          className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{item.titulo}</span>
                            {item.ano && (
                              <Badge variant="outline" className="text-[10px]">
                                {item.ano}
                              </Badge>
                            )}
                          </div>
                          {item.cliente_referencia && (
                            <span className="text-slate-500 text-[11px] block">
                              Cliente: <strong>{item.cliente_referencia}</strong>
                            </span>
                          )}
                          {item.descricao && (
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {item.descricao}
                            </p>
                          )}
                          {item.link_url && (
                            <div className="pt-1">
                              <a
                                href={item.link_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[#D95A2B] hover:underline font-semibold"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Abrir Link Externo do Projeto
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg text-center">
                      Nenhum projeto de portfólio informado no pré-cadastro.
                    </p>
                  )}
                </div>

                {/* 4. Preços de Referência e Disponibilidade */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#D95A2B]" />
                    Preços de Referência & Disponibilidade
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tabela de Preços */}
                    <div className="p-3 border border-slate-200 rounded-lg bg-white space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Preços Médios
                      </span>
                      {Array.isArray(prestadorFicha.preco_referencia_json) &&
                      prestadorFicha.preco_referencia_json.length > 0 ? (
                        <div className="space-y-1.5 text-xs">
                          {prestadorFicha.preco_referencia_json.map(
                            (pr: PrecoReferenciaItem, prI: number) => (
                              <div
                                key={prI}
                                className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0"
                              >
                                <span className="text-slate-700">{pr.disciplina}</span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {pr.valor_referencia
                                    ? formatCurrencyBr(pr.valor_referencia)
                                    : 'Sob consulta'}{' '}
                                  / {pr.unidade}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic block">
                          Sem referências informadas.
                        </span>
                      )}
                    </div>

                    {/* Disponibilidade */}
                    <div className="p-3 border border-slate-200 rounded-lg bg-white space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Carga & Horários
                      </span>
                      {prestadorFicha.disponibilidade_json ? (
                        <div className="space-y-1 text-xs text-slate-600">
                          <div>
                            Horas semanais:{' '}
                            <strong className="text-slate-900">
                              {prestadorFicha.disponibilidade_json.horas_semana || 0}h
                            </strong>
                          </div>
                          <div>
                            Início:{' '}
                            <strong className="text-slate-900">
                              {prestadorFicha.disponibilidade_json.inicio_disponivel || 'Imediato'}
                            </strong>
                          </div>
                          {prestadorFicha.disponibilidade_json.observacoes && (
                            <p className="text-[11px] text-slate-500 pt-1">
                              "{prestadorFicha.disponibilidade_json.observacoes}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic block">
                          Não especificada.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. Documentos Comprobatórios */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#D95A2B]" />
                    Documentos Comprobatórios Anexados ({documentosFicha.length})
                  </h4>

                  {carregandoDocs ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D95A2B] mx-auto" />
                    </div>
                  ) : documentosFicha.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                      {documentosFicha.map((doc) => (
                        <div key={doc.id} className="p-3 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 uppercase block text-[11px]">
                              {doc.tipo.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Enviado em {formatDateBr(doc.created)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                doc.status_verificacao === 'aprovado'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : doc.status_verificacao === 'rejeitado'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {doc.status_verificacao || 'Pendente'}
                            </Badge>

                            {doc.arquivo && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const url = pb.files.getUrl(doc, doc.arquivo)
                                  window.open(url, '_blank')
                                }}
                                className="h-7 text-xs text-blue-600 gap-1"
                              >
                                <Download className="w-3 h-3" />
                                Abrir
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg text-center">
                      Nenhum documento anexado ainda. O prestador enviará após a aprovação inicial
                      no Portal do Prestador.
                    </p>
                  )}
                </div>

                {/* 6. Dados Probatórios do Aceite Jurídico */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Evidências do Aceite do Pré-Cadastro (Auditadas)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      Timestamp:{' '}
                      <strong>{formatDateTimeBr(prestadorFicha.aceite_termos_em)}</strong>
                    </div>
                    <div>
                      IP Registrado:{' '}
                      <strong className="font-mono">
                        {prestadorFicha.aceite_ip || '127.0.0.1'}
                      </strong>
                    </div>
                    {prestadorFicha.aceite_hash && (
                      <div className="sm:col-span-2 font-mono text-[10px] text-slate-400 truncate">
                        Hash SHA-256: {prestadorFicha.aceite_hash}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <Eye className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">Nenhum Prestador Selecionado</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Clique em um prestador na fila à esquerda para abrir a ficha completa, portfólio,
                preços de referência e despachar a triagem.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: APROVAR TRIAGEM */}
      <Dialog open={modalAprovarOpen} onOpenChange={setModalAprovarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Aprovar Triagem de Prestador
            </DialogTitle>
            <DialogDescription className="text-xs">
              O prestador <strong>{prestadorFicha?.nome}</strong> será movido para status{' '}
              <strong>"Pendente"</strong> e a minuta do Contrato-Mestre será gerada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Nota Inicial de Triagem (1 a 5)
              </Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={notaAprovacao}
                onChange={(e) => setNotaAprovacao(parseFloat(e.target.value) || 5.0)}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Parecer Técnico da Triagem
              </Label>
              <Textarea
                placeholder="Ex: Candidato atende aos requisitos técnicos para projetos estruturais. Aprovado para envio de documentos e assinatura de NDA..."
                value={parecerAprovacao}
                onChange={(e) => setParecerAprovacao(e.target.value)}
                className="text-xs mt-1 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAprovarOpen(false)}
              disabled={executandoAcao}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAprovar}
              disabled={executandoAcao}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              {executandoAcao ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Aprovando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmar Aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: RECUSAR TRIAGEM */}
      <Dialog open={modalRecusarOpen} onOpenChange={setModalRecusarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Recusar Triagem de Prestador
            </DialogTitle>
            <DialogDescription className="text-xs">
              O prestador <strong>{prestadorFicha?.nome}</strong> será movido para status{' '}
              <strong>"Inativo"</strong> com o motivo registrado compulsoriamente na trilha de
              auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Motivo da Recusa * (Obrigatório)
              </Label>
              <Textarea
                placeholder="Ex: Portfólio não atende às especialidades demandadas pela G+ Engenharia no momento; ausência de registro ativo no CREA..."
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                className="text-xs mt-1 min-h-[90px]"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRecusarOpen(false)}
              disabled={executandoAcao}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleRecusar}
              disabled={executandoAcao || !motivoRecusa.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
            >
              {executandoAcao ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recusando...
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  Confirmar Recusa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: PEDIR COMPLEMENTO */}
      <Dialog open={modalComplementoOpen} onOpenChange={setModalComplementoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              Solicitar Complemento de Dados
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gera um link seguro com token para o prestador <strong>
                {prestadorFicha?.nome}
              </strong>{' '}
              atualizar informações ou anexar itens faltantes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Orientações ao Prestador
              </Label>
              <Textarea
                placeholder="Ex: Favor informar o número do registro ativo no conselho e anexar ao menos 2 projetos no portfólio..."
                value={obsComplemento}
                onChange={(e) => setObsComplemento(e.target.value)}
                className="text-xs mt-1 min-h-[80px]"
              />
            </div>

            {linkGerado && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5">
                <span className="text-[11px] font-bold text-blue-900 block">
                  Link de Retorno Gerado:
                </span>
                <p className="font-mono text-[11px] text-blue-800 break-all select-all">
                  {linkGerado}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalComplementoOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            {!linkGerado && (
              <Button
                size="sm"
                onClick={handlePedirComplemento}
                disabled={executandoAcao}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                {executandoAcao ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando Link...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Gerar e Enviar Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FilaTriagemPrestadores
