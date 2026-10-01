import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
} from 'lucide-react'
import { PropostaRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface ModalDetalhePropostaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord | null
  onCriarRevisao?: (proposta: PropostaRecord) => void
  onMudarStatus?: (proposta: PropostaRecord, novoStatus: PropostaRecord['status']) => void
  onAbrirAprovacao?: (proposta: PropostaRecord) => void
  canEdit?: boolean
}

export const ModalDetalheProposta: React.FC<ModalDetalhePropostaProps> = ({
  open,
  onOpenChange,
  proposta,
  onCriarRevisao,
  onMudarStatus,
  onAbrirAprovacao,
  canEdit = true,
}) => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('documento')

  if (!proposta) return null

  const getStatusBadge = (status: PropostaRecord['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>
      case 'aprovacao_interna':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">Aprovação Interna</Badge>
        )
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

  const publicLink = `${window.location.origin}/proposta/${proposta.token_aceite}`

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(publicLink)
    toast({
      title: 'Link copiado!',
      description: 'Link público com token copiado para a área de transferência.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
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
                {proposta.validade && <span>• Validade até {formatDateBr(proposta.validade)}</span>}
              </DialogDescription>
            </div>

            {/* Ações rápidas de cabeçalho */}
            <div className="flex items-center gap-2">
              {proposta.token_aceite && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopiarLink}
                  className="h-8 text-xs gap-1"
                  title="Copiar link público para envio ao cliente"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Link Público
                </Button>
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
                      <th className="py-2 px-3 text-right">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proposta.itens_json && proposta.itens_json.length > 0 ? (
                      proposta.itens_json.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900">{it.descricao}</td>
                          <td className="py-2 px-3 text-slate-600">{it.disciplina || '-'}</td>
                          <td className="py-2 px-3 text-center text-slate-600">
                            {it.unidade || 'un'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{it.quantidade}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {formatCurrencyBr(it.custo_unitario)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatCurrencyBr(it.custo_total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400">
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
                  <span className="text-slate-600">Tributos e Impostos:</span>
                  <span className="font-mono text-slate-800">{proposta.impostos || 0}%</span>
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
                    <div className="font-semibold text-emerald-900">Parecer Financeiro Emitido</div>
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
                    <div className="font-semibold text-red-900">Proposta Recusada pelo Cliente</div>
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
                      onClick={() => onMudarStatus && onMudarStatus(proposta, 'aprovacao_interna')}
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
  )
}
