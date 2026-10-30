import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase,
  Layers,
  Flag,
  Sparkles,
  CheckCircle2,
  Clock,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  FileCheck2,
  Calendar,
  DollarSign,
  ChevronRight,
  Loader2,
  RefreshCw,
  PlusCircle,
} from 'lucide-react'
import { ProjetoRecord, ProjetoEtapaRecord, EntregavelRecord, ContratoServicoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  sugestoesPrestadoresService,
  geradorPacotesContratoService,
} from '@/services/cadeiaContratosProjetos'
import { SugestaoPrestadorItem } from '@/types'

interface PacotesTrabalhoTabProps {
  projeto: ProjetoRecord
  contratoServico?: ContratoServicoRecord | null
  etapas: ProjetoEtapaRecord[]
  entregaveis: EntregavelRecord[]
  canEdit: boolean
  onRefresh: () => void
  onNavegarParaEntregaveis?: () => void
}

export const PacotesTrabalhoTab: React.FC<PacotesTrabalhoTabProps> = ({
  projeto,
  contratoServico,
  etapas,
  entregaveis,
  canEdit,
  onRefresh,
  onNavegarParaEntregaveis,
}) => {
  const { toast } = useToast()

  // Filtros de etapas
  const pacotes = etapas.filter((e) => e.is_pacote_trabalho)
  const marcos = etapas.filter((e) => e.is_marco)

  // Sugestões de prestadores
  const [pacoteSelecionado, setPacoteSelecionado] = useState<ProjetoEtapaRecord | null>(null)
  const [modalSugestoesAberto, setModalSugestoesAberto] = useState(false)
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [sugestoes, setSugestoes] = useState<SugestaoPrestadorItem[]>([])
  const [erroSugestoes, setErroSugestoes] = useState<string | null>(null)

  // Aprovação de sugestão (Criação de OS)
  const [prestadorAprovando, setPrestadorAprovando] = useState<SugestaoPrestadorItem | null>(null)
  const [modalAprovarAberto, setModalAprovarAberto] = useState(false)
  const [valorOs, setValorOs] = useState<number>(0)
  const [prazoDiasOs, setPrazoDiasOs] = useState<number>(30)
  const [salvandoOs, setSalvandoOs] = useState(false)
  const [erroTetoVendido, setErroTetoVendido] = useState<string | null>(null)

  // Botão gerar pacotes de contrato já assinado
  const [gerandoPacotes, setGerandoPacotes] = useState(false)

  // Selecionar primeiro pacote caso nenhum esteja selecionado
  useEffect(() => {
    if (pacotes.length > 0 && !pacoteSelecionado) {
      setPacoteSelecionado(pacotes[0])
    }
  }, [pacotes, pacoteSelecionado])

  const abrirSugestoesParaPacote = async (pacote: ProjetoEtapaRecord) => {
    setPacoteSelecionado(pacote)
    setModalSugestoesAberto(true)
    setCarregandoSugestoes(true)
    setErroSugestoes(null)
    setSugestoes([])

    try {
      const res = await sugestoesPrestadoresService.obterSugestoes({
        disciplina: pacote.disciplina || 'Engenharia',
        pacote_id: pacote.id,
      })
      setSugestoes(res.sugestoes || [])
    } catch (err: any) {
      setErroSugestoes(err.message || 'Falha ao buscar ranking de prestadores no servidor.')
    } finally {
      setCarregandoSugestoes(false)
    }
  }

  const prepararAprovacao = (prestador: SugestaoPrestadorItem) => {
    setPrestadorAprovando(prestador)
    setErroTetoVendido(null)
    // Valor de referência inicial
    const valSugerido =
      pacoteSelecionado?.valor_interno_referencia || pacoteSelecionado?.valor_vendido || 0
    setValorOs(valSugerido)
    setPrazoDiasOs(30)
    setModalAprovarAberto(true)
  }

  const handleConfirmarAprovacao = async () => {
    if (!prestadorAprovando || !pacoteSelecionado) return
    setSalvandoOs(true)
    setErroTetoVendido(null)

    try {
      const resp = await sugestoesPrestadoresService.aprovarSugestao({
        prestador_id: prestadorAprovando.prestador_id,
        projeto_id: projeto.id,
        pacote_id: pacoteSelecionado.id,
        disciplina: pacoteSelecionado.disciplina || 'Engenharia',
        valor_os: Number(valorOs) || 0,
        prazo_dias: Number(prazoDiasOs) || 30,
        escopo_tecnico: pacoteSelecionado.escopo_detalhado || pacoteSelecionado.nome,
      })

      toast({
        title: 'Ordem de Serviço criada!',
        description: `OS ${resp.numero} gerada com sucesso para ${prestadorAprovando.nome}. Status: ${resp.status}`,
      })

      setModalAprovarAberto(false)
      setModalSugestoesAberto(false)
      onRefresh()
    } catch (err: any) {
      const msg = err.message || 'Erro ao aprovar sugestão de prestador.'
      if (
        msg.includes('teto') ||
        msg.includes('ultrapassa') ||
        msg.includes('soma de OS') ||
        msg.includes('valor vendido')
      ) {
        setErroTetoVendido(
          `TRAVA DE SEGURANÇA DO SERVIDOR: ${msg} (A soma de OS externas desta disciplina não pode exceder o valor vendido no contrato).`,
        )
      } else {
        toast({
          title: 'Não foi possível aprovar',
          description: msg,
          variant: 'destructive',
        })
      }
    } finally {
      setSalvandoOs(false)
    }
  }

  const handleGerarPacotesContrato = async () => {
    if (!contratoServico) {
      toast({
        title: 'Contrato não disponível',
        description: 'Este projeto ainda não possui um Contrato de Serviço vinculado.',
        variant: 'destructive',
      })
      return
    }

    try {
      setGerandoPacotes(true)
      const res = await geradorPacotesContratoService.gerarPacotesParaContrato(
        contratoServico.id,
        projeto.id,
      )

      toast({
        title: 'Geração Concluída',
        description: res.mensagem,
      })

      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Falha na geração de pacotes',
        description: err.message || 'Erro ao processar contrato no servidor.',
        variant: 'destructive',
      })
    } finally {
      setGerandoPacotes(false)
    }
  }

  const renderBadgeTendencia = (tendencia: 'melhorou' | 'estavel' | 'piorou') => {
    if (tendencia === 'melhorou') {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] gap-1"
        >
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          Melhorou
        </Badge>
      )
    }
    if (tendencia === 'piorou') {
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-300 text-[10px] gap-1"
        >
          <TrendingDown className="w-3 h-3 text-rose-600" />
          Piorou
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-700 border-slate-300 text-[10px] gap-1"
      >
        <Minus className="w-3 h-3 text-slate-500" />
        Estável
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Ações da Cadeia Contrato-Projetos */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D95A2B]/10 flex items-center justify-center text-[#D95A2B]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cadeia de Execução Técnica & Financeira
              </h3>
              <p className="text-xs text-slate-600">
                Pacotes de trabalho derivados do contrato, sugestões algorítmicas de prestadores e
                marcos de faturamento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contratoServico && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarPacotesContrato}
                disabled={gerandoPacotes}
                className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {gerandoPacotes ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando Pacotes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                    Gerar pacotes do contrato assinado
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Pacotes de Trabalho à Esquerda / Marcos à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1 & 2: PACOTES DE TRABALHO */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Pacotes de Trabalho ({pacotes.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              Escopos técnicos com entregáveis e prestador sugerido
            </span>
          </div>

          {pacotes.length === 0 ? (
            <Card className="border-dashed border-slate-300 p-8 text-center bg-slate-50">
              <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">
                Nenhum pacote de trabalho gerado ainda para este projeto.
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Clique no botão "Gerar pacotes do contrato assinado" acima para desdobrar o escopo
                técnico e seus entregáveis automaticamente.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pacotes.map((pacote) => {
                const entsDoPacote = entregaveis.filter((e) => e.etapa === pacote.id)
                const entsAprovados = entsDoPacote.filter((e) => e.status === 'aprovado')

                return (
                  <Card
                    key={pacote.id}
                    className="border-slate-200 hover:border-blue-300 transition-all shadow-sm bg-white"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{pacote.nome}</span>
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                            >
                              {pacote.disciplina || 'Engenharia'}
                            </Badge>
                            {pacote.ordem_servico_ativa && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                              >
                                OS Ativa
                              </Badge>
                            )}
                          </div>
                          {pacote.escopo_detalhado && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {pacote.escopo_detalhado}
                            </p>
                          )}
                        </div>

                        {canEdit && (
                          <Button
                            size="sm"
                            onClick={() => abrirSugestoesParaPacote(pacote)}
                            className="bg-[#D95A2B] hover:bg-[#c44e24] text-white text-xs gap-1.5 h-8 font-medium shadow-sm shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-orange-200" />
                            Sugestões de Prestadores
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Valor Vendido</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrencyBr(pacote.valor_vendido || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Ref. Interna</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrencyBr(pacote.valor_interno_referencia || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Prazo Estimado</span>
                          <span className="font-semibold text-slate-700">
                            {pacote.prazo ? formatDateBr(pacote.prazo) : 'A definir'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Entregáveis</span>
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                            {entsAprovados.length}/{entsDoPacote.length} aprovados
                          </span>
                        </div>
                      </div>

                      {entsDoPacote.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                            {entsDoPacote.slice(0, 3).map((e) => (
                              <span
                                key={e.id}
                                className={`text-[10px] px-2 py-0.5 rounded border ${
                                  e.status === 'aprovado'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : e.status === 'enviado_revisao'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                {e.nome || e.titulo}
                              </span>
                            ))}
                            {entsDoPacote.length > 3 && (
                              <span className="text-[10px] text-slate-500">
                                +{entsDoPacote.length - 3} mais
                              </span>
                            )}
                          </div>

                          {onNavegarParaEntregaveis && (
                            <button
                              type="button"
                              onClick={onNavegarParaEntregaveis}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 shrink-0 ml-2"
                            >
                              Ver ciclo
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUNA 3: MARCOS DE FATURAMENTO / FINANCEIRO */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Marcos Financeiros ({marcos.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">1 por parcela</span>
          </div>

          {marcos.length === 0 ? (
            <Card className="border-dashed border-slate-300 p-6 text-center bg-slate-50">
              <Flag className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">Nenhum marco financeiro gerado.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Ao gerar pacotes do contrato, as parcelas da proposta viram marcos de faturamento.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {marcos.map((marco, idx) => (
                <div
                  key={marco.id}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">{marco.nome}</span>
                      </div>
                      {marco.descricao && (
                        <p className="text-[11px] text-slate-500 pl-6">{marco.descricao}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs pl-6">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Vencimento</span>
                      <span className="font-medium text-slate-700">
                        {marco.prazo ? formatDateBr(marco.prazo) : 'Sob medição'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Valor Parcela</span>
                      <span className="font-bold text-emerald-700">
                        {formatCurrencyBr(marco.valor_vendido || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: RANKING DE SUGESTÕES DE PRESTADORES */}
      <Dialog open={modalSugestoesAberto} onOpenChange={setModalSugestoesAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D95A2B]" />
              Sugestões Inteligentes de Prestadores
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ranking algorítmico do servidor para o pacote{' '}
              <strong>"{pacoteSelecionado?.nome}"</strong> (Disciplina:{' '}
              {pacoteSelecionado?.disciplina}).
            </DialogDescription>
          </DialogHeader>

          {carregandoSugestoes ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D95A2B]" />
              Processando ranking de prestadores com capacidade, notas, conselhos e tendência...
            </div>
          ) : erroSugestoes ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Erro ao consultar sugestões:
              </div>
              <p>{erroSugestoes}</p>
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
              <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">
                Nenhum prestador qualificado encontrado para esta disciplina.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Verifique se os prestadores cadastrados possuem a disciplina compatível e conselho
                válido no módulo Prestadores.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {sugestoes.map((sug, idx) => (
                <div
                  key={sug.prestador_id}
                  className="bg-white border rounded-lg p-3.5 shadow-sm hover:border-orange-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{sug.nome}</span>
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px]">
                          {sug.tipo === 'interno' ? 'Equipe Interna' : 'Prestador PJ/PF'}
                        </Badge>
                        {renderBadgeTendencia(sug.tendencia)}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                        <span>
                          Nota média:{' '}
                          <strong>
                            {sug.nota_media ? sug.nota_media.toFixed(1) : '5.0'} / 5.0
                          </strong>
                        </span>
                        <span>
                          Capacidade livre: <strong>{sug.capacidade_livre} OS</strong>
                        </span>
                        <span>
                          UF: <strong>{sug.uf || 'BR'}</strong>
                        </span>
                        {sug.conselho_validade && (
                          <span className="text-emerald-700">
                            Conselho: <strong>Válido</strong>
                          </span>
                        )}
                      </div>

                      {/* Motivos do ranking */}
                      {sug.motivos && sug.motivos.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {sug.motivos.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="text-[11px] text-slate-500 flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D95A2B]" />
                              {m}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Score Geral</span>
                        <span className="text-sm font-bold text-[#D95A2B]">
                          {sug.score_final} pts
                        </span>
                      </div>

                      {canEdit && (
                        <Button
                          size="sm"
                          onClick={() => prepararAprovacao(sug)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-medium gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovar Sugestão
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalSugestoesAberto(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: APROVAÇÃO DE SUGESTÃO E GERAÇÃO DE ORDEM DE SERVIÇO */}
      <Dialog open={modalAprovarAberto} onOpenChange={setModalAprovarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Aprovar Prestador & Gerar OS
            </DialogTitle>
            <DialogDescription className="text-xs">
              A aprovação formaliza a alocação e cria a Ordem de Serviço (externa sob
              contrato-mestre com retenção técnica, ou interna).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Prestador Selecionado:</span>{' '}
                <strong className="text-slate-900">{prestadorAprovando?.nome}</strong>
              </div>
              <div>
                <span className="text-slate-500">Pacote de Trabalho:</span>{' '}
                <strong className="text-slate-900">{pacoteSelecionado?.nome}</strong>
              </div>
              <div>
                <span className="text-slate-500">Teto Vendido da Disciplina:</span>{' '}
                <strong className="text-blue-700">
                  {formatCurrencyBr(pacoteSelecionado?.valor_vendido || 0)}
                </strong>
              </div>
            </div>

            {/* ALERTA DE ERRO DE TETO VENDIDO EXIBIDO COM CLAREZA */}
            {erroTetoVendido && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Bloqueio de Faturamento / Teto Vendido
                </div>
                <p>{erroTetoVendido}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Valor da OS (R$) {prestadorAprovando?.tipo === 'interno' ? '(Interno: R$ 0)' : '*'}
              </label>
              <Input
                type="number"
                step="0.01"
                value={valorOs}
                onChange={(e) => setValorOs(Number(e.target.value) || 0)}
                disabled={prestadorAprovando?.tipo === 'interno'}
                className="text-xs h-9"
              />
              <p className="text-[10px] text-slate-500">
                {prestadorAprovando?.tipo === 'interno'
                  ? 'Execução interna é alocada sem custo de subcontrato financeiro.'
                  : 'A soma de OS externas desta disciplina não pode ultrapassar o teto vendido do contrato.'}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Prazo de Execução (dias) *
              </label>
              <Input
                type="number"
                value={prazoDiasOs}
                onChange={(e) => setPrazoDiasOs(Number(e.target.value) || 30)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalAprovarAberto(false)}
              disabled={salvandoOs}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarAprovacao}
              disabled={salvandoOs}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvandoOs ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Criando OS...
                </>
              ) : (
                'Confirmar e Criar OS'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PacotesTrabalhoTab
