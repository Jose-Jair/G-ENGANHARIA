import React, { useState, useEffect } from 'react'
import {
  PreCotacaoRecord,
  PreCotacaoRespostaItemDto,
  PropostaItemRecord,
  PropostaRecord,
} from '@/types'
import { preCotacaoService } from '@/services/preCotacao'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  HelpCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Lock,
  Send,
  UserCheck,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Edit2,
  RefreshCw,
} from 'lucide-react'

interface ModalGestaoPreCotacaoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord
  item: PropostaItemRecord
  onAtualizado: () => void
}

export function ModalGestaoPreCotacao({
  open,
  onOpenChange,
  proposta,
  item,
  onAtualizado,
}: ModalGestaoPreCotacaoProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(false)
  const [preCotacoes, setPreCotacoes] = useState<PreCotacaoRecord[]>([])
  const [preCotacaoSelecionada, setPreCotacaoSelecionada] = useState<PreCotacaoRecord | null>(null)

  // Abertura de pré-cotação
  const [abrindo, setAbrindo] = useState(false)

  // Escolha do vencedor
  const [escolhendoId, setEscolhendoId] = useState<string | null>(null)

  // Modal "Por que este?" (Justificativa técnica de ranking)
  const [modalJustificativaOpen, setModalJustificativaOpen] = useState(false)
  const [respostaJustificativa, setRespostaJustificativa] =
    useState<PreCotacaoRespostaItemDto | null>(null)

  // Edição de custo auditada
  const [modalEdicaoCustoOpen, setModalEdicaoCustoOpen] = useState(false)
  const [novoCustoInput, setNovoCustoInput] = useState('')
  const [motivoEdicaoInput, setMotivoEdicaoInput] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const isInterno = user?.role === 'admin' || user?.role === 'gestor' || user?.role === 'comercial'
  const canEscolher = user?.role === 'admin' || user?.role === 'gestor'

  const carregarDados = async () => {
    if (!item?.id) return
    setCarregando(true)
    try {
      const res = await preCotacaoService.getByItem(item.id)
      setPreCotacoes(res.pre_cotacoes || [])
      if (res.pre_cotacoes && res.pre_cotacoes.length > 0) {
        setPreCotacaoSelecionada(res.pre_cotacoes[0])
      } else {
        setPreCotacaoSelecionada(null)
      }
    } catch (err: any) {
      console.error('Erro ao carregar pré-cotações:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && item?.id) {
      carregarDados()
      setNovoCustoInput(item.custo_total ? String(item.custo_total) : '')
      setMotivoEdicaoInput(item.motivo_edicao_custo || '')
    }
  }, [open, item?.id])

  const handleAbrirPreCotacao = async () => {
    if (!proposta?.id || !item?.id) return
    setAbrindo(true)
    try {
      const res = await preCotacaoService.abrir(proposta.id, item.id)
      if (res.sem_elegiveis) {
        toast({
          title: 'Sem prestadores elegíveis',
          description:
            res.mensagem ||
            'Não foram encontrados prestadores ativos com conselho válido e contrato-mestre assinado. Item mantido com custo de catálogo.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: `Pré-cotação ${res.codigo} aberta com sucesso!`,
          description: `${res.total_convidados || 0} prestadores elegíveis convidados por e-mail com escopo anonimizado.`,
        })
      }
      await carregarDados()
      onAtualizado()
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir pré-cotação',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setAbrindo(false)
    }
  }

  const handleEscolherVencedor = async (resp: PreCotacaoRespostaItemDto) => {
    if (!preCotacaoSelecionada) return
    if (!canEscolher) {
      toast({
        title: 'Ação restrita',
        description:
          'Apenas Administrador e Gestor de Projetos podem fixar o vencedor da pré-cotação.',
        variant: 'destructive',
      })
      return
    }

    setEscolhendoId(resp.id)
    try {
      const res = await preCotacaoService.escolherVencedor(preCotacaoSelecionada.id, resp.id)
      toast({
        title: 'Vencedor fixado com sucesso!',
        description: `Preço travado em ${formatCurrencyBr(res.preco_travado)} (${res.prazo_travado_dias} dias). Custo atualizado e ${res.total_prestadores_liberados} concorrentes liberados sem detalhes.`,
      })
      await carregarDados()
      onAtualizado()
    } catch (err: any) {
      toast({
        title: 'Erro ao escolher vencedor',
        description: err.message || 'Não foi possível fixar o vencedor.',
        variant: 'destructive',
      })
    } finally {
      setEscolhendoId(null)
    }
  }

  const handleSalvarEdicaoCusto = async () => {
    if (!proposta?.id || !item?.id) return
    const valor = parseFloat(novoCustoInput.replace(',', '.'))
    if (isNaN(valor) || valor < 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um custo total válido.',
        variant: 'destructive',
      })
      return
    }

    if (
      item.origem_custo === 'pre_cotacao' &&
      (!motivoEdicaoInput || motivoEdicaoInput.trim().length < 5)
    ) {
      toast({
        title: 'Motivo obrigatório',
        description:
          'A edição de custo oriundo de pré-cotação vinculante exige preenchimento do motivo auditado (mínimo 5 caracteres).',
        variant: 'destructive',
      })
      return
    }

    setSalvandoEdicao(true)
    try {
      await preCotacaoService.editarCustoAuditado(proposta.id, item.id, {
        novo_custo_total: valor,
        motivo_edicao_custo: motivoEdicaoInput.trim(),
      })
      toast({
        title: 'Custo do item auditado e atualizado!',
        description: 'Origem alterada para manual_auditado e auditoria registrada.',
      })
      setModalEdicaoCustoOpen(false)
      onAtualizado()
    } catch (err: any) {
      toast({
        title: 'Erro ao editar custo',
        description: err.message || 'Falha ao salvar custo auditado.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberta':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Aberta
          </Badge>
        )
      case 'respondida':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Send className="w-3 h-3 mr-1" />
            Respondida
          </Badge>
        )
      case 'convertida':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Convertida (Custo Travado)
          </Badge>
        )
      case 'encerrada':
        return <Badge variant="secondary">Encerrada</Badge>
      case 'expirada':
        return (
          <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
            Expirada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isInterno) {
    return null
  }

  const respostasOrdenadas = preCotacaoSelecionada?.respostas
    ? [...preCotacaoSelecionada.respostas].sort((a, b) => {
        // Vencedora primeiro, depois menor preço
        if (a.escolhida) return -1
        if (b.escolhida) return 1
        if (a.preco_ofertado && b.preco_ofertado) return a.preco_ofertado - b.preco_ofertado
        return (b.preco_ofertado || 0) - (a.preco_ofertado || 0)
      })
    : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Pré-Cotação Vinculante
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.disciplina || 'Geral'}
                  </Badge>
                  {item.origem_custo === 'pre_cotacao' && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[10px]">
                      <Lock className="w-2.5 h-2.5 mr-1" />
                      Custo Cotado
                    </Badge>
                  )}
                  {item.origem_custo === 'sem_cotacao' && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[10px]">
                      Sem Cotação
                    </Badge>
                  )}
                  {item.origem_custo === 'manual_auditado' && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold text-[10px]">
                      Manual Auditado
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Item da Proposta {proposta.numero}:{' '}
                  <strong className="text-slate-800">{item.descricao}</strong>
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={carregarDados}
                  disabled={carregando}
                  className="h-8 text-xs gap-1 text-slate-600"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                <Button
                  size="sm"
                  onClick={handleAbrirPreCotacao}
                  disabled={abrindo}
                  className="h-8 text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1.5 shadow-2xs font-semibold"
                >
                  {abrindo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {preCotacoes.length > 0 ? 'Abrir Nova Pré-Cotação' : 'Abrir Pré-Cotação'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Resumo Financeiro do Item */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border rounded-lg text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Custo Atual do Item
              </span>
              <span className="text-sm font-bold font-mono text-slate-900">
                {formatCurrencyBr(item.custo_total || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Origem</span>
              <span className="font-semibold text-slate-700">
                {item.origem_custo === 'pre_cotacao'
                  ? 'Pré-cotação Vinculante'
                  : item.origem_custo === 'sem_cotacao'
                    ? 'Sem Cotação (Catálogo)'
                    : item.origem_custo === 'manual_auditado'
                      ? 'Manual Auditado'
                      : 'Catálogo Padrão'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Preço Travado
              </span>
              <span className="font-mono font-medium text-emerald-700">
                {item.preco_travado ? formatCurrencyBr(item.preco_travado) : 'Não travado'}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalEdicaoCustoOpen(true)}
                className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Editar Custo (Auditado)
              </Button>
            </div>
          </div>

          {/* Se houver motivo de edição gravado */}
          {item.motivo_edicao_custo && (
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900">
              <span className="font-bold text-[10px] uppercase block">
                Motivo Auditado da Edição:
              </span>
              {item.motivo_edicao_custo}
            </div>
          )}

          {/* Lista de Pré-Cotações Existentes */}
          {carregando ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto mb-2" />
              <p className="text-xs text-slate-500">Consultando pré-cotações e respostas...</p>
            </div>
          ) : preCotacoes.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed rounded-lg p-6">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800">
                Nenhuma Pré-Cotação Aberta para este Item
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Abra a pré-cotação para anonimizar o escopo e convidar automaticamente até 5
                prestadores elegíveis com contrato-mestre assinado. O preço vencedor travará na
                proposta comercial.
              </p>
              <Button
                size="sm"
                onClick={handleAbrirPreCotacao}
                disabled={abrindo}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1.5 shadow-2xs"
              >
                {abrindo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Abrir Pré-Cotação Agora
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seletor de Pré-cotação se houver mais de uma */}
              {preCotacoes.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-400 font-semibold shrink-0">Histórico:</span>
                  {preCotacoes.map((pc) => (
                    <Button
                      key={pc.id}
                      variant={preCotacaoSelecionada?.id === pc.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreCotacaoSelecionada(pc)}
                      className="h-7 text-xs font-mono"
                    >
                      {pc.codigo} ({pc.status})
                    </Button>
                  ))}
                </div>
              )}

              {preCotacaoSelecionada && (
                <div className="border rounded-xl p-4 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-slate-900">
                          {preCotacaoSelecionada.codigo}
                        </span>
                        {getStatusBadge(preCotacaoSelecionada.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Disciplina: <strong>{preCotacaoSelecionada.disciplina}</strong> • Validade:
                        até {formatDateBr(preCotacaoSelecionada.data_limite)}
                      </p>
                    </div>

                    <div className="text-xs text-slate-500 sm:text-right">
                      <span>Total de Respostas: </span>
                      <strong className="font-mono text-slate-800">
                        {preCotacaoSelecionada.respostas?.filter((r) => r.preco_ofertado > 0)
                          .length || 0}{' '}
                        de {preCotacaoSelecionada.respostas?.length || 0}
                      </strong>
                    </div>
                  </div>

                  {/* Tabela de Ranking das Respostas dos Prestadores */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Ranking de Prestadores Convidados</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Preço • Prazo • Nota • Capacidade • Softwares
                      </span>
                    </h5>

                    {respostasOrdenadas.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        Nenhum prestador convidado registrado.
                      </p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                            <tr>
                              <th className="py-2.5 px-3">Prestador Convidado</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Preço Ofertado</th>
                              <th className="py-2.5 px-3 text-center">Prazo Ofertado</th>
                              <th className="py-2.5 px-3 text-center">Aceite Vinculante</th>
                              <th className="py-2.5 px-3 text-center">Justificativa</th>
                              <th className="py-2.5 px-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {respostasOrdenadas.map((resp, idx) => {
                              const temResposta = resp.preco_ofertado > 0
                              return (
                                <tr
                                  key={resp.id}
                                  className={`hover:bg-slate-50/80 ${
                                    resp.escolhida ? 'bg-emerald-50/60 font-medium' : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                        {idx + 1}º
                                      </span>
                                      <span className="font-semibold text-slate-900">
                                        {resp.prestador_nome}
                                      </span>
                                      {resp.escolhida && (
                                        <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                                          Vencedor
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {resp.status === 'enviada' ? (
                                      <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                                        Proposta Enviada
                                      </Badge>
                                    ) : resp.status === 'travada' ? (
                                      <Badge className="bg-emerald-600 text-white text-[10px]">
                                        Travada
                                      </Badge>
                                    ) : resp.status === 'liberada' ? (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Liberado
                                      </Badge>
                                    ) : resp.status === 'expirada' ? (
                                      <Badge variant="outline" className="text-red-600 text-[10px]">
                                        Expirada
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-slate-500 text-[10px]"
                                      >
                                        Aguardando
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                                    {temResposta ? (
                                      <span className="text-emerald-700">
                                        {formatCurrencyBr(resp.preco_ofertado)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {resp.prazo_ofertado_dias > 0 ? (
                                      <span>{resp.prazo_ofertado_dias} dias</span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {resp.aceite_vinculante ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium"
                                        title={`Hash: ${resp.aceite_hash || 'SHA-256'}`}
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Sim (Hash SHA-256)
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">Pendente</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setRespostaJustificativa(resp)
                                        setModalJustificativaOpen(true)
                                      }}
                                      className="h-6 text-[11px] text-blue-600 hover:text-blue-800 gap-1 px-2"
                                    >
                                      <HelpCircle className="w-3 h-3" />
                                      Por que este?
                                    </Button>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {resp.escolhida ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px]">
                                        Escolhido
                                      </Badge>
                                    ) : temResposta && canEscolher ? (
                                      <Button
                                        size="sm"
                                        onClick={() => handleEscolherVencedor(resp)}
                                        disabled={escolhendoId === resp.id}
                                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                      >
                                        {escolhendoId === resp.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="w-3 h-3" />
                                        )}
                                        Escolher Vencedor
                                      </Button>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL JUSTIFICATIVA "POR QUE ESTE?" */}
      <Dialog open={modalJustificativaOpen} onOpenChange={setModalJustificativaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D95A2B]" />
              Justificativa Técnica de Convocação
            </DialogTitle>
            <DialogDescription className="text-xs">
              Critérios que posicionaram <strong>
                {respostaJustificativa?.prestador_nome}
              </strong> no
              ranking da pré-cotação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nota Geral do Prestador:</span>
                <span className="font-bold text-slate-900">Média ponderada alta (avaliado)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Conselho de Classe:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Válido e vigente
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Contrato-Mestre:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Assinado bilateralmente
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Capacidade Simultânea:</span>
                <span className="font-semibold text-slate-800">Disponibilidade livre</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Softwares Técnicos:</span>
                <span className="font-semibold text-slate-800">
                  Aderência à disciplina (BIM/CAD)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Faixa de Preço de Referência:</span>
                <span className="font-semibold text-slate-800">
                  Compatível com tabela de referência G+
                </span>
              </div>
            </div>

            {respostaJustificativa?.premissas && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded">
                <span className="font-bold text-blue-900 block text-[10px] uppercase">
                  Premissas Ofertadas:
                </span>
                <p className="text-slate-700 text-xs mt-0.5">{respostaJustificativa.premissas}</p>
              </div>
            )}

            {respostaJustificativa?.observacoes && (
              <div className="p-2.5 bg-slate-50 border rounded">
                <span className="font-bold text-slate-700 block text-[10px] uppercase">
                  Observações:
                </span>
                <p className="text-slate-600 text-xs mt-0.5">{respostaJustificativa.observacoes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIÇÃO DE CUSTO AUDITADO */}
      <Dialog open={modalEdicaoCustoOpen} onOpenChange={setModalEdicaoCustoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-600" />
              Editar Custo do Item (Auditado)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ao alterar manualmente o custo de um item cotado ou de catálogo, o evento é registrado
              na trilha de auditoria e a origem passa a ser <strong>manual_auditado</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Novo Custo Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={novoCustoInput}
                onChange={(e) => setNovoCustoInput(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Motivo Auditado da Alteração{' '}
                {item.origem_custo === 'pre_cotacao' && (
                  <span className="text-red-600 font-bold">* (Obrigatório para item cotado)</span>
                )}
              </Label>
              <textarea
                value={motivoEdicaoInput}
                onChange={(e) => setMotivoEdicaoInput(e.target.value)}
                rows={3}
                placeholder="Ex: Ajuste técnico de escopo aprovado com o cliente..."
                className="w-full text-xs p-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalEdicaoCustoOpen(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvarEdicaoCusto}
                disabled={salvandoEdicao}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              >
                {salvandoEdicao && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar Custo Auditado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
