import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { portalPrestadorService, ordensServicoService } from '@/services/prestadores'
import { PortalOsRecord, PortalEntregavelRecord, PortalDocumentoRecord } from '@/types'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Calendar,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  FileDown,
  Loader2,
  HardHat,
  DollarSign,
  Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GPlusLogo } from '@/components/GPlusLogo'

export const PortalPrestadorPage: React.FC = () => {
  const { user, logout } = useAuth()
  const { toast } = useToast()

  const [ordensServico, setOrdensServico] = useState<PortalOsRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [osSelecionada, setOsSelecionada] = useState<PortalOsRecord | null>(null)

  const [entregaveis, setEntregaveis] = useState<PortalEntregavelRecord[]>([])
  const [documentos, setDocumentos] = useState<PortalDocumentoRecord[]>([])
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)

  // Modal de Assinatura da OS
  const [modalAssinarOpen, setModalAssinarOpen] = useState(false)
  const [concordou, setConcordou] = useState(false)
  const [nomeAssinante, setNomeAssinante] = useState(user?.name || '')
  const [docAssinante, setDocAssinante] = useState(user?.cpf_cnpj || '')
  const [assinando, setAssinando] = useState(false)

  const carregarMinhasOS = async () => {
    setCarregando(true)
    try {
      const lista = await portalPrestadorService.listMinhasOS()
      setOrdensServico(lista)
      if (lista.length > 0 && !osSelecionada) {
        setOsSelecionada(lista[0])
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar Ordens de Serviço',
        description: err.message || 'Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarMinhasOS()
  }, [])

  useEffect(() => {
    if (osSelecionada) {
      setCarregandoDetalhes(true)
      Promise.all([
        portalPrestadorService.listEntregaveis(osSelecionada.os_id),
        portalPrestadorService.listDocumentos(osSelecionada.os_id),
      ])
        .then(([ents, docs]) => {
          setEntregaveis(ents)
          setDocumentos(docs)
        })
        .catch(() => {})
        .finally(() => {
          setCarregandoDetalhes(false)
        })
    }
  }, [osSelecionada])

  const handleAssinarOS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!osSelecionada || !concordou) return

    setAssinando(true)
    try {
      await ordensServicoService.assinarPrestador(osSelecionada.os_id, {
        token: osSelecionada.token_assinatura,
        declaracao: concordou,
        nome: nomeAssinante.trim(),
        documento: docAssinante.trim(),
      })

      toast({
        title: 'Ordem de Serviço assinada com sucesso!',
        description: 'Seu aceite eletrônico foi registrado na plataforma G+.',
      })
      setModalAssinarOpen(false)
      carregarMinhasOS()
    } catch (err: any) {
      toast({
        title: 'Erro ao assinar OS',
        description: err.message || 'Falha ao processar assinatura.',
        variant: 'destructive',
      })
    } finally {
      setAssinando(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'minuta':
        return <Badge variant="outline">Minuta</Badge>
      case 'aguardando_assinatura':
        return <Badge className="bg-amber-500 text-white">Aguardando Assinatura</Badge>
      case 'assinada':
        return <Badge className="bg-sky-600 text-white">Assinada</Badge>
      case 'em_execucao':
        return <Badge className="bg-emerald-600 text-white">Em Execução</Badge>
      case 'concluida':
        return <Badge className="bg-indigo-600 text-white">Concluída</Badge>
      case 'avaliada':
        return <Badge className="bg-purple-600 text-white">Avaliada</Badge>
      case 'encerrada':
        return <Badge variant="secondary">Encerrada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topo do Portal */}
      <header className="bg-[#1E2A4A] text-white border-b border-[#141D34] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GPlusLogo variant="compact" theme="dark" size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight">Portal do Prestador</span>
              <span className="text-[10px] bg-[#D95A2B] text-white px-2 py-0.5 rounded font-semibold uppercase">
                Ambiente Seguro
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Acesso exclusivo a escopos técnicos, entregáveis e prazos da sua Ordem de Serviço
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-right hidden sm:block">
            <span className="font-medium text-slate-200 block">{user?.name || user?.email}</span>
            <span className="text-[11px] text-slate-400 font-mono">{user?.email}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="text-xs border-white/20 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            Sair
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Boas-Vindas & Política de Privacidade */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-50 text-[#D95A2B]">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Ordens de Serviço Atribuídas a Você
              </h2>
              <p className="text-xs text-slate-500">
                Consulte as especificações da disciplina, faça download dos arquivos de projeto e
                acompanhe suas entregas.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs py-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Canal Técnico Isolado
          </Badge>
        </div>

        {carregando ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
          </div>
        ) : ordensServico.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">
              Nenhuma Ordem de Serviço Encontrada
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No momento você não possui Ordens de Serviço ativas no sistema. Assim que a equipe de
              engenharia da G+ emitir uma OS vinculada ao seu e-mail, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Lista de Ordens de Serviço */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block px-1">
                Suas Ordens de Serviço ({ordensServico.length})
              </span>

              {ordensServico.map((os) => {
                const isSelected = osSelecionada?.id === os.id
                return (
                  <div
                    key={os.id}
                    onClick={() => setOsSelecionada(os)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#D95A2B] bg-orange-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm">{os.numero_os}</span>
                      {getStatusBadge(os.status)}
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Código do Projeto:</span>
                        <span className="font-mono font-medium text-slate-800">
                          {os.codigo_projeto}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Disciplina:</span>
                        <span className="font-medium text-slate-800">
                          {os.disciplina || 'Engenharia'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Valor da OS:</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrencyBr(os.valor_os || 0)}
                        </span>
                      </div>
                      {os.prazo_dias && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Prazo:</span>
                          <span>{os.prazo_dias} dias</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Coluna 2 e 3: Detalhes da Ordem de Serviço Selecionada */}
            <div className="lg:col-span-2 space-y-6">
              {osSelecionada && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
                  {/* Topo da OS */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {osSelecionada.numero_os}
                        </h2>
                        {getStatusBadge(osSelecionada.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Projeto Referência:{' '}
                        <strong className="font-mono text-slate-700">
                          {osSelecionada.codigo_projeto}
                        </strong>{' '}
                        • Disciplina:{' '}
                        <strong className="text-slate-700">
                          {osSelecionada.disciplina || 'Engenharia'}
                        </strong>
                      </p>
                    </div>

                    {osSelecionada.status === 'aguardando_assinatura' && (
                      <Button
                        onClick={() => {
                          setConcordou(false)
                          setModalAssinarOpen(true)
                        }}
                        className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs shadow-xs"
                      >
                        <ShieldCheck className="w-4 h-4 mr-1.5" />
                        Assinar Eletronicamente
                      </Button>
                    )}
                  </div>

                  {/* Detalhes Técnicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-400 block">Valor Acordado da OS</span>
                      <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                        {formatCurrencyBr(osSelecionada.valor_os || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Prazo de Execução</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {osSelecionada.prazo_dias
                          ? `${osSelecionada.prazo_dias} dias corridos`
                          : 'A definir'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Previsão de Término</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {osSelecionada.data_previsao_fim
                          ? formatDateBr(osSelecionada.data_previsao_fim)
                          : 'Acompanhar cronograma'}
                      </span>
                    </div>
                  </div>

                  {/* Escopo Técnico */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Escopo Técnico Delegado
                    </h3>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {osSelecionada.escopo_tecnico ||
                        'Nenhuma descrição técnica detalhada informada.'}
                    </div>
                  </div>

                  {/* Entregáveis e Documentos Técnicos */}
                  <Tabs defaultValue="entregaveis" className="w-full">
                    <TabsList className="grid grid-cols-2 text-xs">
                      <TabsTrigger value="entregaveis">
                        Entregáveis Técnicos ({entregaveis.length})
                      </TabsTrigger>
                      <TabsTrigger value="documentos">
                        Arquivos Técnicos ({documentos.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="entregaveis" className="pt-3">
                      {carregandoDetalhes ? (
                        <div className="flex justify-center p-6">
                          <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
                        </div>
                      ) : entregaveis.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                          Nenhum entregável específico cadastrado para esta OS.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                          {entregaveis.map((ent) => (
                            <div
                              key={ent.id}
                              className="p-3 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {ent.nome}
                                </span>
                                {ent.descricao && (
                                  <span className="text-slate-500 text-[11px] block mt-0.5">
                                    {ent.descricao}
                                  </span>
                                )}
                                {ent.prazo_entrega && (
                                  <span className="text-slate-400 text-[10px] block mt-0.5">
                                    Prazo: {formatDateBr(ent.prazo_entrega)}
                                  </span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {ent.status || 'Pendente'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="documentos" className="pt-3">
                      {carregandoDetalhes ? (
                        <div className="flex justify-center p-6">
                          <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B]" />
                        </div>
                      ) : documentos.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                          Nenhum arquivo ou documento complementar anexado a esta OS.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                          {documentos.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-3 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <div>
                                  <span className="font-semibold text-slate-800 block">
                                    {doc.titulo}
                                  </span>
                                  {doc.categoria && (
                                    <span className="text-slate-400 text-[10px] block">
                                      {doc.categoria}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                Disponível
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Assinatura da OS */}
      <Dialog open={modalAssinarOpen} onOpenChange={setModalAssinarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D95A2B]" />
              Assinatura Eletrônica da Ordem de Serviço
            </DialogTitle>
            <DialogDescription>
              Ao assinar, você confirma o recebimento das diretrizes técnicas e concorda com o
              escopo, prazos e valor desta OS.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssinarOS} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div>
                <span className="text-slate-400">Ordem de Serviço:</span>{' '}
                <strong className="text-slate-800">{osSelecionada?.numero_os}</strong>
              </div>
              <div>
                <span className="text-slate-400">Projeto:</span>{' '}
                <strong className="text-slate-800 font-mono">
                  {osSelecionada?.codigo_projeto}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Valor da OS:</span>{' '}
                <strong className="text-emerald-700">
                  {formatCurrencyBr(osSelecionada?.valor_os || 0)}
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome Completo do Assinante *</Label>
                <Input
                  required
                  value={nomeAssinante}
                  onChange={(e) => setNomeAssinante(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">CPF / CNPJ do Assinante *</Label>
                <Input
                  required
                  value={docAssinante}
                  onChange={(e) => setDocAssinante(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="concordo"
                  checked={concordou}
                  onCheckedChange={(checked) => setConcordou(!!checked)}
                />
                <label
                  htmlFor="concordo"
                  className="text-[11px] text-slate-600 leading-snug cursor-pointer select-none"
                >
                  Declaro que li e concordo integralmente com o escopo técnico, valor e prazos
                  descritos nesta Ordem de Serviço, bem como com os termos de confidencialidade
                  estabelecidos no Contrato-Mestre.
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalAssinarOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!concordou || assinando}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white"
              >
                {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Assinatura'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PortalPrestadorPage
