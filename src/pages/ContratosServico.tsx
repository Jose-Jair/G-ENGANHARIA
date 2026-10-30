import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  Printer,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { ContratoServicoRecord } from '@/types'
import { contratosServicoService } from '@/services/contratosServico'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { ModalDetalhesContratoServico } from '@/components/contratosServico/ModalDetalhesContratoServico'
import { DossieContratoServicoGmais } from '@/components/contratosServico/DossieContratoServicoGmais'
import { useAuth } from '@/contexts/AuthContext'

export function ContratosServicoPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()

  const [contratos, setContratos] = useState<ContratoServicoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  // Modais
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null)
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false)
  const [contratoDossie, setContratoDossie] = useState<ContratoServicoRecord | null>(null)
  const [dossieOpen, setDossieOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const lista = await contratosServicoService.listAll()
      setContratos(lista)
    } catch (err: any) {
      console.error('Erro ao listar contratos de serviço:', err)
      toast({
        title: 'Erro ao carregar contratos',
        description: err.message || 'Não foi possível buscar os contratos de serviço.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem
  const filtrados = contratos.filter((c) => {
    const q = busca.toLowerCase().trim()
    const matchBusca =
      !q ||
      c.numero.toLowerCase().includes(q) ||
      (c.expand?.proposta?.numero || '').toLowerCase().includes(q) ||
      (c.expand?.empresa?.razao_social || '').toLowerCase().includes(q) ||
      (c.expand?.empresa?.nome_fantasia || '').toLowerCase().includes(q) ||
      (c.expand?.cliente_pf?.nome || '').toLowerCase().includes(q) ||
      (c.objeto || '').toLowerCase().includes(q)

    const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro

    return matchBusca && matchStatus
  })

  // Métricas
  const totalContratos = contratos.length
  const totalAssinados = contratos.filter((c) => c.status === 'assinado').length
  const totalAguardandoAdmin = contratos.filter(
    (c) => c.status === 'aguardando_assinatura_admin',
  ).length
  const totalAguardandoCliente = contratos.filter(
    (c) => c.status === 'aguardando_assinatura_cliente',
  ).length
  const valorTotalAssinado = contratos
    .filter((c) => c.status === 'assinado')
    .reduce((acc, c) => acc + (c.valor_total || 0), 0)

  const handleCopiarLinkCliente = (c: ContratoServicoRecord) => {
    if (!c.token_assinatura_cliente) {
      toast({
        title: 'Link indisponível',
        description: 'O contrato ainda precisa ser assinado pelo Administrador para gerar o link.',
        variant: 'destructive',
      })
      return
    }
    const link = `${window.location.origin}/contrato-servico/${c.token_assinatura_cliente}`
    navigator.clipboard.writeText(link)
    toast({
      title: 'Link copiado!',
      description: `Link de assinatura do contrato ${c.numero} copiado para a área de transferência.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* TRILHA DO NEGÓCIO (FIXA PARA PERFIS INTERNOS) */}
      <TrilhaDoNegocio etapaAtual="contrato" />

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#D95A2B]" />
            Contratos de Serviço (GMAIS)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão dos instrumentos jurídicos vinculados às propostas aceitas • Assinatura Admin
            preliminar → Assinatura Cliente com validade jurídica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Assinados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-emerald-600">{totalAssinados}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              De {totalContratos} contrato(s) formalizados
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Valor Total Vigente</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-blue-700">
              {formatCurrencyBr(valorTotalAssinado)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Contratos assinados e em execução</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Pendente Admin</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-amber-600">
              {totalAguardandoAdmin}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Aguardando assinatura da Diretoria G+</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Pendente Cliente</span>
              <Clock className="w-4 h-4 text-sky-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono text-sky-600">
              {totalAguardandoCliente}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Link enviado, aguardando signatário</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por CTR-*, proposta, cliente ou objeto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[200px] text-xs h-9 bg-white">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="aguardando_dados_cliente">Aguardando Dados do Cliente</SelectItem>
              <SelectItem value="aguardando_assinatura_admin">
                Aguardando Assinatura Admin
              </SelectItem>
              <SelectItem value="aguardando_assinatura_cliente">
                Aguardando Assinatura Cliente
              </SelectItem>
              <SelectItem value="assinado">Assinado e Vigente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Contratos de Serviço */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Número Contrato</th>
                  <th className="py-3 px-4">Proposta Origem</th>
                  <th className="py-3 px-4">Contratante</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Assinatura Admin</th>
                  <th className="py-3 px-4">Assinatura Cliente</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Carregando contratos de serviço...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-700">
                          Nenhum contrato de serviço encontrado
                        </p>
                        <p className="text-xs text-slate-500">
                          Os contratos são gerados automaticamente quando o cliente formaliza o
                          aceite eletrônico na página pública da proposta comercial.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtrados.map((c) => {
                    const contratanteNome =
                      c.expand?.empresa?.razao_social ||
                      c.expand?.empresa?.nome_fantasia ||
                      c.expand?.cliente_pf?.nome ||
                      'Cliente'

                    const contratanteDoc =
                      c.expand?.empresa?.cnpj || c.expand?.cliente_pf?.cpf || ''

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                            {c.numero}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDateBr(c.created)}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 font-mono">
                            {c.expand?.proposta?.numero || 'S/N'}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[200px]">
                            {c.objeto}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 line-clamp-1 max-w-[220px]">
                            {contratanteNome}
                          </div>
                          {contratanteDoc && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              Doc: {contratanteDoc}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(c.valor_total)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={
                              c.status === 'assinado'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                                : c.status === 'aguardando_dados_cliente'
                                  ? 'bg-amber-100 text-amber-900 border-amber-400 font-semibold'
                                  : c.status === 'aguardando_assinatura_admin'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold'
                                    : 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold'
                            }
                          >
                            {c.status === 'assinado'
                              ? 'Assinado e Vigente'
                              : c.status === 'aguardando_dados_cliente'
                                ? 'Aguardando dados do cliente'
                                : c.status === 'aguardando_assinatura_admin'
                                  ? 'Aguardando Admin'
                                  : 'Aguardando Cliente'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          {c.data_assinatura_admin ? (
                            <div className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{formatDateBr(c.data_assinatura_admin)}</span>
                            </div>
                          ) : (
                            <span className="text-amber-700 text-[11px] font-medium">
                              Pendente Admin
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {c.data_assinatura_cliente ? (
                            <div className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{formatDateBr(c.data_assinatura_cliente)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Aguardando</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          {c.token_assinatura_cliente && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopiarLinkCliente(c)}
                              className="h-7 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium"
                              title="Copiar link de assinatura para o cliente"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Link
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setContratoDossie(c)
                              setDossieOpen(true)
                            }}
                            className="h-7 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-50 font-medium"
                            title="Visualizar e Imprimir Contrato no layout GMAIS"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            PDF GMAIS
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedContratoId(c.id)
                              setModalDetalhesOpen(true)
                            }}
                            className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                          >
                            {isAdmin && !c.data_assinatura_admin ? 'Assinar / Gerir' : 'Detalhes'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes Administrativos com Assinatura Admin */}
      <ModalDetalhesContratoServico
        open={modalDetalhesOpen}
        onOpenChange={setModalDetalhesOpen}
        contratoId={selectedContratoId}
        isAdmin={isAdmin}
        onUpdated={loadData}
      />

      {/* Modal do Dossiê/PDF no Modelo GMAIS */}
      <DossieContratoServicoGmais
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        contrato={contratoDossie}
      />
    </div>
  )
}

export default ContratosServicoPage
