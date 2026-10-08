import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { gruposProjetosService, GrupoComProjetosEDetalhes } from '@/services/gruposProjetos'
import { projetosService } from '@/services/projetos'
import { ProjetoRecord, ModoExecucaoProjeto } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import {
  FolderKanban,
  FileText,
  Building2,
  DollarSign,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Check,
  Edit2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalDetalheProjeto } from '@/components/projetos/ModalDetalheProjeto'
import { ModalCotacoesProjeto } from '@/components/projetos/ModalCotacoesProjeto'
import { subcontratosService } from '@/services/subcontratos'
import { cotacoesService, executoresService } from '@/services/executores'
import { SubcontratoRecord, CotacaoRecord, ExecutorRecord } from '@/types'
import { MessageSquareQuote, FileSignature, ShieldCheck, CheckCircle } from 'lucide-react'

export function GrupoProjetosPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [dados, setDados] = useState<GrupoComProjetosEDetalhes | null>(null)
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null)
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)

  // Bloco 5: Cotações e Subcontratações no Grupo
  const [modalCotacoesProjetoOpen, setModalCotacoesProjetoOpen] = useState(false)
  const [projetoParaCotacoes, setProjetoParaCotacoes] = useState<ProjetoRecord | null>(null)
  const [executoresHomologados, setExecutoresHomologados] = useState<ExecutorRecord[]>([])
  const [cotacoesDoGrupo, setCotacoesDoGrupo] = useState<CotacaoRecord[]>([])
  const [subcontratosDoGrupo, setSubcontratosDoGrupo] = useState<SubcontratoRecord[]>([])

  // Modal para alterar modo de execução de um projeto
  const [projetoParaEdicaoModo, setProjetoParaEdicaoModo] = useState<ProjetoRecord | null>(null)
  const [novoModo, setNovoModo] = useState<ModoExecucaoProjeto>('direta')
  const [descricaoDelegada, setDescricaoDelegada] = useState('')
  const [salvandoModo, setSalvandoModo] = useState(false)

  const canOperate = !!(user && ['admin', 'gestor'].includes(user.role))
  const isExecutor = user?.role === 'executor'

  const carregarDados = async () => {
    if (!id) return
    setCarregando(true)
    try {
      const resp = await gruposProjetosService.getGrupoCompleto(id)
      setDados(resp)

      // Bloco 5: Carregar cotações, subcontratos do grupo e executores
      try {
        const [cotList, subList, exList] = await Promise.all([
          cotacoesService.listByGrupo(id),
          subcontratosService.listByGrupo(id),
          executoresService.list(),
        ])
        setCotacoesDoGrupo(cotList)
        setSubcontratosDoGrupo(subList)
        setExecutoresHomologados(exList)
      } catch {
        /* intentionally ignored */
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Grupo de Projetos',
        description: err.message || 'Grupo não encontrado.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (isExecutor) {
      toast({
        title: 'Acesso Não Autorizado',
        description: 'Executores externos não têm permissão para acessar a Gestão de Grupos.',
        variant: 'destructive',
      })
      navigate('/projetos')
      return
    }
    carregarDados()
  }, [id, isExecutor])

  const handleSalvarModo = async () => {
    if (!projetoParaEdicaoModo) return
    if (novoModo === 'terceirizada_parcial' && !descricaoDelegada.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description:
          'Para terceirização parcial, descreva detalhadamente qual parte do escopo será delegada.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoModo(true)
    try {
      await projetosService.updateModoExecucao(
        projetoParaEdicaoModo.id,
        novoModo,
        descricaoDelegada.trim(),
      )
      toast({
        title: 'Modo de Execução Atualizado',
        description: `Projeto ${projetoParaEdicaoModo.codigo} atualizado para "${novoModo}". Auditoria registrada.`,
      })
      setProjetoParaEdicaoModo(null)
      await carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar modo de execução',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoModo(false)
    }
  }

  if (isExecutor) return null

  if (carregando) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D95A2B] mb-2" />
        <p className="text-sm text-slate-500">Carregando painel de Gestão do Grupo...</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-md mx-auto space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Grupo não localizado</h2>
        <p className="text-xs text-slate-500">
          O grupo solicitado não foi encontrado ou você não tem acesso.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/projetos')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar aos Projetos
        </Button>
      </div>
    )
  }

  const { grupo, projetos, etapasPorProjeto, progressoMedio, valorTotalConsolidado } = dados

  const clientePJ = grupo.expand?.empresa || grupo.expand?.proposta?.expand?.empresa
  const clientePF = grupo.expand?.cliente_pf || grupo.expand?.proposta?.expand?.cliente_pf
  const nomeCliente =
    clientePJ?.nome_fantasia ||
    clientePJ?.razao_social ||
    clientePF?.nome ||
    'Cliente não vinculado'

  const contratoNumero = grupo.expand?.contrato_servico?.numero || 'Sem contrato formal'
  const propostaNumero = grupo.expand?.proposta?.numero

  const getModoBadge = (modo?: ModoExecucaoProjeto) => {
    switch (modo) {
      case 'terceirizada_integral':
        return (
          <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-semibold text-[11px] hover:bg-purple-100">
            Terceirizada Integral
          </Badge>
        )
      case 'terceirizada_parcial':
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-semibold text-[11px] hover:bg-blue-100">
            Terceirizada Parcial
          </Badge>
        )
      case 'direta':
      default:
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold text-[11px] hover:bg-emerald-100">
            Execução Direta
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Navegação Superior */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projetos')}
          className="text-slate-600 hover:text-slate-900 text-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar à Lista de Projetos
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-slate-300 text-slate-700">
            Bloco 4 — Multi-Projetos
          </Badge>
        </div>
      </div>

      {/* Cabeçalho do Grupo de Projetos (GPR-AAAA-NNNN) */}
      <div className="p-6 rounded-xl bg-[#1E2A4A] text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold bg-[#D95A2B] text-white px-2.5 py-1 rounded shadow-xs">
                {grupo.codigo}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold ${
                  grupo.status === 'concluido'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-blue-950 text-blue-300 border-blue-700'
                }`}
              >
                {grupo.status === 'concluido' ? 'Concluído' : grupo.status || 'Ativo'}
              </Badge>
              {contratoNumero && (
                <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Contrato: <strong>{contratoNumero}</strong>
                </span>
              )}
              {propostaNumero && (
                <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                  Proposta: <strong>{propostaNumero}</strong>
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              {grupo.nome || `Grupo de Projetos ${grupo.codigo}`}
            </h1>

            {grupo.descricao && (
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{grupo.descricao}</p>
            )}

            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#D95A2B]" />
                Cliente: <strong className="text-white">{nomeCliente}</strong>
              </span>

              <span className="flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-sky-400" />
                Projetos Vinculados: <strong className="text-white">{projetos.length}</strong>
              </span>

              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Criado em: <strong className="text-white">{formatDateBr(grupo.created)}</strong>
              </span>
            </div>
          </div>

          {/* Card de Valor Total Consolidado e Indicador de Subcontratações */}
          <div className="flex flex-col gap-2 min-w-[240px]">
            <div className="bg-white/10 backdrop-blur-xs p-4 rounded-lg border border-white/15 text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-300 block">
                Valor Total Consolidado
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {formatCurrencyBr(valorTotalConsolidado)}
              </span>
              <span className="text-[10px] text-slate-300 block mt-0.5">
                Soma dos {projetos.length} projetos do grupo
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs px-3 py-2 rounded-lg border border-white/15 flex items-center justify-between text-xs text-white">
              <span className="flex items-center gap-1.5 text-slate-200">
                <FileSignature className="w-3.5 h-3.5 text-[#D95A2B]" />
                Subcontratações:
              </span>
              <span className="font-bold text-[#D95A2B] font-mono">
                {subcontratosDoGrupo.length} emitidas (
                {subcontratosDoGrupo.filter((s) => s.status === 'assinado').length} assinadas)
              </span>
            </div>
          </div>
        </div>

        {/* Andamento Consolidado do Grupo */}
        <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Andamento Consolidado do Grupo
            </span>
            <span className="font-mono text-sm font-bold text-white">{progressoMedio}%</span>
          </div>
          <Progress value={progressoMedio} className="h-2.5 bg-white/20" />
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>
              {dados.totalEtapasConcluidas} de {dados.totalEtapas} etapas concluídas em todos os
              projetos
            </span>
            <span>Média ponderada do escopo contratual</span>
          </div>
        </div>
      </div>

      {/* Lista de Projetos do Grupo com Modo de Execução */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#D95A2B]" />
              Projetos do Grupo ({projetos.length})
            </h2>
            <p className="text-xs text-slate-500">
              Cada projeto corresponde a um item do escopo da proposta comercial e possui suas
              próprias etapas, entregáveis e modo de execução.
            </p>
          </div>
        </div>

        {projetos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              Nenhum projeto associado a este grupo ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {projetos.map((prj, idx) => {
              const etapasPrj = etapasPorProjeto[prj.id] || []
              const totalEt = etapasPrj.length
              const concEt = etapasPrj.filter((e) => e.status === 'concluida').length
              const percPrj = totalEt > 0 ? Math.round((concEt / totalEt) * 100) : 0

              return (
                <Card
                  key={prj.id}
                  className="border border-slate-200 hover:border-slate-300 transition-all shadow-xs"
                >
                  <CardHeader className="pb-3 bg-slate-50/70 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {prj.codigo}
                            </span>
                            {prj.saude === 'verde' && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                🟢 Verde
                              </Badge>
                            )}
                            {prj.saude === 'amarelo' && (
                              <Badge className="bg-amber-500 text-slate-950 text-[10px]">
                                🟡 Amarelo
                              </Badge>
                            )}
                            {prj.saude === 'vermelho' && (
                              <Badge className="bg-rose-600 text-white text-[10px]">
                                🔴 Vermelho
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-semibold text-slate-600"
                            >
                              {prj.status === 'concluido' ? 'Concluído' : prj.status || 'Ativo'}
                            </Badge>
                          </div>
                          <CardTitle className="text-base font-bold text-slate-900 mt-1">
                            {prj.nome || `Projeto ${prj.codigo}`}
                          </CardTitle>
                        </div>
                      </div>

                      {/* Modo de Execução com Botão para Alteração Auditada */}
                      <div className="flex items-center gap-2">
                        {getModoBadge(prj.modo_execucao)}
                        {canOperate && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setProjetoParaEdicaoModo(prj)
                              setNovoModo(prj.modo_execucao || 'direta')
                              setDescricaoDelegada(prj.descricao_delegada || '')
                            }}
                            className="text-xs h-7 px-2 text-slate-700 hover:text-[#D95A2B] hover:border-[#D95A2B]"
                            title="Definir/alterar modo de execução com auditoria"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Alterar Modo
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {prj.descricao && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                        <strong className="text-slate-800">Escopo do Item:</strong> {prj.descricao}
                      </p>
                    )}

                    {prj.modo_execucao === 'terceirizada_parcial' && prj.descricao_delegada && (
                      <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded text-xs text-blue-900">
                        <strong className="flex items-center gap-1 font-semibold text-blue-950 mb-0.5">
                          <Users className="w-3.5 h-3.5 text-blue-700" />
                          Parte Delegada (Terceirização Parcial):
                        </strong>
                        <p className="text-blue-800">{prj.descricao_delegada}</p>
                      </div>
                    )}

                    {/* Andamento do Projeto e Métricas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Valor do Projeto</span>
                        <strong className="text-slate-900 font-bold text-sm">
                          {formatCurrencyBr(prj.valor_total || 0)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Etapas</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-800">
                            {concEt} de {totalEt} concluídas
                          </span>
                          <span className="font-mono text-xs text-slate-500">({percPrj}%)</span>
                        </div>
                      </div>

                      <div className="sm:text-right flex flex-wrap sm:flex-col justify-between sm:justify-center gap-1.5">
                        <span className="text-slate-400 block text-[11px]">Ações Bloco 5</span>
                        <div className="flex items-center gap-1.5">
                          {/* Botão de Cotações & Subcontratação do Projeto */}
                          <Button
                            size="sm"
                            onClick={() => {
                              setProjetoParaCotacoes(prj)
                              setModalCotacoesProjetoOpen(true)
                            }}
                            className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-7 px-2.5 shadow-xs font-semibold"
                            title="Acompanhar cotações, comparar propostas e subcontratar"
                          >
                            <MessageSquareQuote className="w-3.5 h-3.5 mr-1" />
                            Cotações ({cotacoesDoGrupo.filter((c) => c.projeto === prj.id).length})
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setProjetoSelecionadoId(prj.id)
                              setModalDetalheOpen(true)
                            }}
                            className="bg-white hover:bg-slate-100 text-slate-800 text-xs h-7 px-2.5"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Ficha
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso do Projeto Individual */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Progresso físico do item</span>
                        <span className="font-mono font-semibold">{percPrj}%</span>
                      </div>
                      <Progress value={percPrj} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal para Definir/Alterar Modo de Execução do Projeto */}
      {projetoParaEdicaoModo && (
        <Dialog
          open={!!projetoParaEdicaoModo}
          onOpenChange={(op) => !op && setProjetoParaEdicaoModo(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Definir Modo de Execução — {projetoParaEdicaoModo.codigo}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="text-xs text-slate-600">
                Selecione como este projeto/item será executado pela equipe de engenharia. Toda
                alteração é registrada na auditoria do sistema.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Modo de Execução</label>
                <Select
                  value={novoModo}
                  onValueChange={(val: ModoExecucaoProjeto) => setNovoModo(val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direta">
                      🔨 Execução Direta (Equipe interna da G+)
                    </SelectItem>
                    <SelectItem value="terceirizada_parcial">
                      🤝 Terceirizada Parcial (Mista: interna + parceiro)
                    </SelectItem>
                    <SelectItem value="terceirizada_integral">
                      👥 Terceirizada Integral (100% executor externo)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {novoModo === 'terceirizada_parcial' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Descrição da Parte Delegada <span className="text-rose-500">*</span>
                  </label>
                  <Textarea
                    value={descricaoDelegada}
                    onChange={(e) => setDescricaoDelegada(e.target.value)}
                    placeholder="Descreva detalhadamente qual disciplina ou parcela do escopo será terceirizada..."
                    className="text-xs h-24"
                  />
                  <p className="text-[11px] text-slate-400">
                    Obrigatório para documentar a divisão de responsabilidades.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProjetoParaEdicaoModo(null)}
                disabled={salvandoModo}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvarModo}
                disabled={salvandoModo}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white"
              >
                {salvandoModo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                Salvar Modo de Execução
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Detalhe do Projeto Individual */}
      <ModalDetalheProjeto
        open={modalDetalheOpen}
        onOpenChange={setModalDetalheOpen}
        projetoId={projetoSelecionadoId}
        onUpdate={carregarDados}
      />

      {/* BLOCO 5: Modal de Cotações do Projeto com Comparativo Inteligente e Subcontratação */}
      <ModalCotacoesProjeto
        open={modalCotacoesProjetoOpen}
        onOpenChange={setModalCotacoesProjetoOpen}
        projeto={projetoParaCotacoes}
        executores={executoresHomologados}
        canEdit={canOperate}
        onSuccess={carregarDados}
      />
    </div>
  )
}
