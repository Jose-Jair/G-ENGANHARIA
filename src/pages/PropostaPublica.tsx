import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Building2,
  Check,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Printer,
  FileCheck,
} from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { propostasService } from '@/services/propostas'
import { motivosService } from '@/services/motivos'
import { PropostaRecord, MotivoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

export const PropostaPublicaPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()

  const [proposta, setProposta] = useState<PropostaRecord | null>(null)
  const [motivosRecusa, setMotivosRecusa] = useState<MotivoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processingAceite, setProcessingAceite] = useState(false)

  // Modal Recusa
  const [showRecusaModal, setShowRecusaModal] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState<string>('')
  const [detalheRecusa, setDetalheRecusa] = useState('')
  const [submittingRecusa, setSubmittingRecusa] = useState(false)

  // Sucesso de Aceite
  const [aceiteConcluido, setAceiteConcluido] = useState(false)

  useEffect(() => {
    if (!token) return

    const loadData = async () => {
      setLoading(true)
      try {
        const prop = await propostasService.getByToken(token)
        if (prop) {
          setProposta(prop)

          // Se status ainda for 'enviada', registrar primeira visualização (Req. D & I)
          if (prop.status === 'enviada') {
            try {
              const updated = await propostasService.update(prop.id, {
                status: 'visualizada',
                data_visualizacao: new Date().toISOString(),
              })
              setProposta(updated)
            } catch (err) {
              console.warn('Erro ao atualizar tracking de visualização:', err)
            }
          }
        }

        // Carregar motivos de recusa da coleção motivos
        const motivos = await motivosService.listAtivos('perda')
        setMotivosRecusa(motivos)
      } catch (err) {
        console.error('Erro ao carregar proposta pública:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

  // Processar Aceite da Proposta (Req. E)
  const handleAceitarProposta = async () => {
    if (!proposta) return

    setProcessingAceite(true)
    try {
      const updated = await propostasService.update(proposta.id, {
        status: 'aceita',
        data_aceite: new Date().toISOString(),
        token_aceite: token, // Passar no body para passar na regra de update da coleção
      })

      setProposta(updated)
      setAceiteConcluido(true)
      toast({
        title: 'Proposta Aceita com Sucesso!',
        description:
          'Agradecemos a confiança. Nosso setor de projetos iniciará os trâmites imediatamente.',
      })
    } catch (err) {
      console.error('Erro ao registrar aceite da proposta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no aceite',
        description:
          'Não foi possível registrar o aceite. Entre em contato com a equipe comercial.',
      })
    } finally {
      setProcessingAceite(false)
    }
  }

  // Processar Recusa da Proposta (Req. E)
  const handleRecusarProposta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposta) return
    if (!motivoSelecionado) {
      toast({
        variant: 'destructive',
        title: 'Motivo obrigatório',
        description: 'Por favor, selecione um motivo para a recusa da proposta.',
      })
      return
    }

    setSubmittingRecusa(true)
    try {
      const updated = await propostasService.update(proposta.id, {
        status: 'recusada',
        motivo_recusa: motivoSelecionado,
        detalhe_recusa: detalheRecusa,
        data_recusa: new Date().toISOString(),
        token_aceite: token,
      })

      setProposta(updated)
      setShowRecusaModal(false)
      toast({
        title: 'Proposta Recusada',
        description: 'Seu feedback foi registrado e auditado em nossa plataforma.',
      })
    } catch (err) {
      console.error('Erro ao recusar proposta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar a recusa da proposta.',
      })
    } finally {
      setSubmittingRecusa(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Carregando proposta comercial...</p>
        </div>
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 border-slate-200">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <CardTitle className="text-lg">Proposta Não Encontrada</CardTitle>
          <p className="text-xs text-slate-500 mt-2">
            O link informado pode ser inválido, ter expirado ou a proposta foi cancelada.
          </p>
        </Card>
      </div>
    )
  }

  const isFinalizada =
    proposta.status === 'aceita' || proposta.status === 'recusada' || proposta.status === 'expirada'

  return (
    <div className="min-h-screen bg-slate-100/80 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* BANNER DE STATUS SE JÁ ESTIVER ACEITA/RECUSADA/EXPIRADA */}
        {proposta.status === 'aceita' && (
          <div className="bg-emerald-600 text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-100" />
              <div>
                <div className="font-bold text-sm">Proposta Aceita com Sucesso</div>
                <div className="text-xs text-emerald-100">
                  Aceite digital formalizado em{' '}
                  {formatDateTimeBr(proposta.data_aceite || proposta.updated)}.
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-700 text-white border-0 text-xs">Formalizada</Badge>
          </div>
        )}

        {proposta.status === 'recusada' && (
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-100" />
              <div>
                <div className="font-bold text-sm">Proposta Recusada</div>
                <div className="text-xs text-red-100">
                  Motivo: {proposta.motivo_recusa} • Registrado em{' '}
                  {formatDateTimeBr(proposta.data_recusa || proposta.updated)}
                </div>
              </div>
            </div>
            <Badge className="bg-red-700 text-white border-0 text-xs">Recusada</Badge>
          </div>
        )}

        {proposta.status === 'expirada' && (
          <div className="bg-slate-700 text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-slate-300" />
              <div>
                <div className="font-bold text-sm">Prazo de Validade Expirado</div>
                <div className="text-xs text-slate-300">
                  Esta proposta expirou em{' '}
                  {proposta.validade ? formatDateBr(proposta.validade) : 'data anterior'}. Solicite
                  uma atualização ao seu consultor.
                </div>
              </div>
            </div>
            <Badge className="bg-slate-800 text-white border-0 text-xs">Expirada</Badge>
          </div>
        )}

        {/* DOCUMENTO DA PROPOSTA (LAYOUT DE DOCUMENTO FORMAL) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
          {/* TOPO COM LOGO E DADOS GERAIS */}
          <div className="p-8 border-b border-slate-200 bg-[#1E2A4A]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <GPlusLogo variant="horizontal" theme="light" size={44} showSlogan={true} />
            </div>

            <div className="text-left sm:text-right border-l sm:border-l-0 pl-4 sm:pl-0 border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D95A2B] block">
                Proposta Comercial
              </span>
              <div className="font-mono font-black text-lg text-[#1E2A4A]">{proposta.numero}</div>
              <div className="text-xs text-slate-500">
                Versão: {proposta.revisao || 'Rev.00'} • Emissão: {formatDateBr(proposta.created)}
              </div>
              {proposta.validade && (
                <div className="text-xs font-semibold text-[#D95A2B] mt-0.5">
                  Validade até {formatDateBr(proposta.validade)}
                </div>
              )}
            </div>
          </div>

          <div className="p-8 space-y-8 text-xs text-slate-700">
            {/* SEÇÃO 1: DADOS DAS PARTES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block mb-1">
                  Contratante / Solicitante:
                </span>
                {proposta.expand?.empresa ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {proposta.expand.empresa.razao_social}
                    </div>
                    <div>CNPJ: {proposta.expand.empresa.cnpj}</div>
                    {(proposta.expand.empresa.municipio || proposta.expand.empresa.uf) && (
                      <div>
                        {[proposta.expand.empresa.municipio, proposta.expand.empresa.uf]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    )}
                  </div>
                ) : proposta.expand?.cliente_pf ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {proposta.expand.cliente_pf.nome}
                    </div>
                    <div>CPF: {proposta.expand.cliente_pf.cpf || 'Não informado'}</div>
                    {proposta.expand.cliente_pf.endereco && (
                      <div>{proposta.expand.cliente_pf.endereco}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">Dados do contratante sob consulta</span>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block mb-1">
                  Referência Contratual:
                </span>
                {proposta.expand?.contrato ? (
                  <div>
                    <div className="font-semibold text-slate-900">
                      {proposta.expand.contrato.numero}
                    </div>
                    <div>{proposta.expand.contrato.orgao}</div>
                  </div>
                ) : (
                  <div>Contratação Direta de Serviços Técnicos Especializados</div>
                )}
              </div>
            </div>

            {/* SEÇÃO 2: OBJETO & ESCOPO TÉCNICO GMAIS */}
            {proposta.objeto && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                  1. Objeto da Proposta
                </h3>
                <div className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white p-2">
                  {proposta.objeto}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                {proposta.objeto
                  ? '2. Escopo dos Serviços'
                  : '1. Escopo e Metodologia dos Trabalhos'}
              </h3>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white p-2">
                {proposta.escopo_gerado || proposta.escopo}
              </div>
            </div>
            {/* SEÇÃO 3: DISCIPLINAS E ENTREGÁVEIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                  2. Disciplinas Contempladas
                </h3>
                <div className="p-3 bg-slate-50 rounded border text-slate-700">
                  {proposta.disciplinas || 'Engenharia Consultiva e Projetos'}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                  3. Entregáveis Técnicos
                </h3>
                <div className="p-3 bg-slate-50 rounded border text-slate-700">
                  {proposta.entregaveis || 'Memoriais, modelos e documentação técnica regulamentar'}
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: PLANILHA DE PREÇOS */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                4. Discriminação dos Serviços e Preço
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3">Item / Serviço</th>
                      <th className="py-2.5 px-3">Disciplina / Área</th>
                      <th className="py-2.5 px-3 text-center">Unid.</th>
                      <th className="py-2.5 px-3 text-center">Qtd.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proposta.itens_json && proposta.itens_json.length > 0 ? (
                      proposta.itens_json.map((it, idx) => {
                        const sub =
                          it.preco_total !== undefined
                            ? it.preco_total
                            : (it.custo_total || 0) * (1 + (it.bdi_percentual || 0) / 100)
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-900">{it.descricao}</td>
                            <td className="py-2 px-3 text-slate-600">{it.disciplina || '-'}</td>
                            <td className="py-2 px-3 text-center text-slate-600">
                              {it.unidade || 'un'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{it.quantidade}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatCurrencyBr(sub)}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-slate-500 italic">
                          Serviços técnicos globais de engenharia conforme escopo descrito.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-right text-slate-800 text-sm">
                        Valor Total da Proposta:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-base font-bold text-blue-700">
                        {formatCurrencyBr(proposta.preco)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* OBSERVAÇÃO SOBRE NOTA FISCAL NA PÁGINA PÚBLICA */}
              <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-slate-600">
                <strong>Observação Fiscal: </strong>
                {proposta.requer_nota ? (
                  <span>
                    O valor global <strong>contempla a emissão de nota fiscal</strong> com tributos
                    inclusos ({proposta.impostos || 16.5}%).
                  </span>
                ) : (
                  <span>
                    Os valores apresentados nesta proposta comercial{' '}
                    <strong>não contemplam a emissão de nota fiscal</strong>. Caso solicitada, será
                    acrescida a alíquota tributária vigente correspondente.
                  </span>
                )}
              </div>
            </div>

            {/* SEÇÃO CONDIÇÕES GERAIS (SE PREENCHIDA) */}
            {proposta.condicoes_gerais && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                  5. Condições Gerais
                </h3>
                <div className="p-3 bg-slate-50 rounded border text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
                  {proposta.condicoes_gerais}
                </div>
              </div>
            )}

            {/* SEÇÃO 5: PRAZO E CONDIÇÕES DE PAGAMENTO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                  Prazo de Execução:
                </span>
                <p className="font-semibold text-slate-800">
                  {proposta.prazo || '30 dias corridos'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                  Condições de Pagamento:
                </span>
                <p className="font-semibold text-slate-800">
                  {proposta.condicoes_pagamento || 'Conforme medição ou etapas acordadas'}
                </p>
              </div>
            </div>

            {/* SEÇÃO 6: PREMISSAS E EXCLUSÕES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  Premissas da Proposta:
                </h4>
                <p className="p-3 bg-slate-50 rounded border text-slate-600">
                  {proposta.premissas || 'Fornecimento tempestivo de dados e documentação prévia.'}
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  Exclusões de Escopo:
                </h4>
                <p className="p-3 bg-slate-50 rounded border text-slate-600">
                  {proposta.exclusoes || 'Taxas públicas e licenças municipais/estaduais.'}
                </p>
              </div>
            </div>
          </div>

          {/* RODAPÉ DO DOCUMENTO COM BOTÕES DE AÇÃO (ACEITAR / RECUSAR) */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Ambiente seguro de aceite digital com rastreabilidade e validade jurídica.
              </span>
            </div>

            {!isFinalizada && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecusaModal(true)}
                  disabled={processingAceite}
                  className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Recusar Proposta
                </Button>

                <Button
                  type="button"
                  onClick={handleAceitarProposta}
                  disabled={processingAceite}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 shadow-sm"
                >
                  {processingAceite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      Registrando Aceite...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Aceitar Proposta
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE RECUSA COM MOTIVO OBRIGATÓRIO (Req. E) */}
      <Dialog open={showRecusaModal} onOpenChange={setShowRecusaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Recusar Proposta {proposta.numero}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Para registrar a recusa, selecione obrigatoriamente o motivo principal e compartilhe
              mais detalhes caso deseje.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecusarProposta} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Recusa *</Label>
              <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado} required>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {motivosRecusa.length > 0 ? (
                    motivosRecusa.map((m) => (
                      <SelectItem key={m.id} value={m.descricao}>
                        {m.descricao}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Preço / Orçamento acima do esperado">
                        Preço / Orçamento acima do esperado
                      </SelectItem>
                      <SelectItem value="Prazo de entrega incompatível">
                        Prazo de entrega incompatível
                      </SelectItem>
                      <SelectItem value="Escopo técnico não atende às necessidades">
                        Escopo técnico não atende às necessidades
                      </SelectItem>
                      <SelectItem value="Opção por concorrente">Opção por concorrente</SelectItem>
                      <SelectItem value="Cancelamento do projeto pelo cliente final">
                        Cancelamento do projeto pelo cliente final
                      </SelectItem>
                      <SelectItem value="Outro motivo">Outro motivo</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Detalhamento ou Feedback (Opcional)</Label>
              <Textarea
                rows={3}
                placeholder="Detalhes adicionais para que possamos aprimorar futuras oportunidades..."
                value={detalheRecusa}
                onChange={(e) => setDetalheRecusa(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRecusaModal(false)}
                disabled={submittingRecusa}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingRecusa || !motivoSelecionado}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submittingRecusa ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Confirmar Recusa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PropostaPublicaPage
