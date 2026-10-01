import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Printer,
  Download,
  Building2,
  Calendar,
  DollarSign,
  Layers,
  FileCheck2,
  AlertTriangle,
  HeartPulse,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { formatCnpj, formatCpf } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'

interface ModalDossieProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string | null
}

export function ModalDossieProjeto({ open, onOpenChange, projetoId }: ModalDossieProjetoProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [dossie, setDossie] = useState<any>(null)

  const carregarDossie = async () => {
    if (!projetoId) return
    setLoading(true)
    try {
      const res = await pb.send(`/backend/v1/projetos/${projetoId}/dossie-data`, {
        method: 'GET',
      })
      setDossie(res)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar dossiê do projeto',
        description: err.message || 'Falha na conexão com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (open && projetoId) {
      carregarDossie()
    } else {
      setDossie(null)
    }
  }, [open, projetoId])

  const handleImprimirSalvarPdf = () => {
    // Abre a janela de impressão do browser formatada especificamente para salvar como PDF A4
    window.print()
  }

  if (!open || !projetoId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 print:m-0 print:p-0 print:max-w-none print:max-h-none print:shadow-none print:border-none">
        {/* Barra Superior com Controles de Exportação / PDF */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-20 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white">
                Dossiê Consolidado do Projeto (PDF)
              </DialogTitle>
              <p className="text-[11px] text-slate-300">
                Documento técnico consolidado com etapas, entregáveis, documentos, riscos e
                finanças.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleImprimirSalvarPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Salvar em PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              Fechar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs text-slate-500">
              Processando dossiê consolidado e auditando geração no servidor...
            </p>
          </div>
        ) : dossie ? (
          <div className="p-8 sm:p-10 bg-white text-slate-900 text-xs space-y-6 print:p-6 print:space-y-4 font-sans">
            {/* CABEÇALHO INSTITUCIONAL DO DOSSIÊ */}
            <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-blue-700 block">
                  Plataforma de Intermediação Técnica de Engenharia
                </span>
                <h1 className="text-2xl font-black text-slate-950 tracking-tight mt-0.5">
                  DOSSIÊ TÉCNICO & OPERACIONAL DO PROJETO
                </h1>
                <div className="flex items-center gap-3 mt-1 text-slate-600 text-xs">
                  <span>
                    Código:{' '}
                    <strong className="font-mono text-slate-900">{dossie.projeto.codigo}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Status:{' '}
                    <strong className="uppercase font-semibold">{dossie.projeto.status}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Saúde Operacional:{' '}
                    <strong
                      className={
                        dossie.projeto.saude === 'verde'
                          ? 'text-emerald-700'
                          : dossie.projeto.saude === 'amarelo'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                      }
                    >
                      {dossie.projeto.saude.toUpperCase()}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-500 font-mono">
                <div>
                  Gerado em: <strong>{formatDateTimeBr(dossie.gerado_em)}</strong>
                </div>
                <div>
                  Responsável: <strong>{dossie.gerado_por.nome}</strong>
                </div>
                <div className="text-[10px] text-slate-400">
                  Perfil: {dossie.gerado_por.role} • Auditoria Registrada
                </div>
              </div>
            </div>

            {/* SEÇÃO 1: DADOS DO PROJETO E CLIENTE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 avoid-break">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  1. Informações do Projeto
                </span>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nome:</span>
                    <strong className="text-slate-900 text-right">{dossie.projeto.nome}</strong>
                  </div>
                  {dossie.projeto.descricao && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Objeto:</span>
                      <span className="text-slate-800 text-right italic max-w-[220px]">
                        {dossie.projeto.descricao}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Disciplinas:</span>
                    <strong className="text-slate-900">
                      {dossie.projeto.disciplinas || 'Múltiplas'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prazo Final Contratual:</span>
                    <strong className="font-mono text-slate-900">
                      {dossie.projeto.prazo_final
                        ? formatDateBr(dossie.projeto.prazo_final)
                        : 'Não informado'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subcontratação:</span>
                    <strong className="text-slate-900">
                      {dossie.projeto.subcontratacao_autorizada ? 'Autorizada' : 'Restrita'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  2. Cliente e Origem Comercial
                </span>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cliente ({dossie.cliente.tipo}):</span>
                    <strong className="text-slate-900 text-right">{dossie.cliente.nome}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Documento:</span>
                    <span className="font-mono text-slate-800">
                      {dossie.cliente.tipo === 'PJ'
                        ? formatCnpj(dossie.cliente.documento)
                        : formatCpf(dossie.cliente.documento)}
                    </span>
                  </div>
                  {dossie.cliente.email && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contato:</span>
                      <span className="text-slate-800">{dossie.cliente.email}</span>
                    </div>
                  )}
                  {dossie.proposta && (
                    <div className="flex justify-between border-t border-slate-200/80 pt-1">
                      <span className="text-slate-500">Proposta de Origem:</span>
                      <strong className="font-mono text-blue-700">
                        {dossie.proposta.numero} ({dossie.proposta.revisao || 'Rev.00'})
                      </strong>
                    </div>
                  )}
                  {dossie.proposta && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aceite da Proposta:</span>
                      <span className="font-mono text-slate-800">
                        {dossie.proposta.data_aceite
                          ? formatDateBr(dossie.proposta.data_aceite)
                          : 'Concluído'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: RESUMO FINANCEIRO OPERACIONAL */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-900 text-white avoid-break print:bg-slate-100 print:text-slate-950 print:border-slate-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                3. Síntese Financeira do Projeto
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Valor Contratado</span>
                  <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                    {formatCurrencyBr(dossie.financeiro.total_contratado)}
                  </span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-[10px] text-emerald-400 block">Total Recebido</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                    {formatCurrencyBr(dossie.financeiro.total_recebido)}
                  </span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-[10px] text-rose-400 block">Pago a Executores</span>
                  <span className="text-sm font-bold text-rose-400 font-mono mt-0.5 block">
                    {formatCurrencyBr(dossie.financeiro.total_pago_executores)}
                  </span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
                  <span className="text-[10px] text-blue-400 block">Margem Projetada</span>
                  <span className="text-sm font-bold text-blue-400 font-mono mt-0.5 block">
                    {dossie.financeiro.margem_projetada.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: ETAPAS E ENTREGÁVEIS */}
            <div className="space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  4. Etapas Operacionais e Executores Alocados ({dossie.etapas.length})
                </h3>
                <span className="text-slate-500 font-medium">
                  Progresso: <strong>{dossie.progresso.percentual}% concluído</strong> (
                  {dossie.progresso.etapas_concluidas}/{dossie.progresso.total_etapas} etapas)
                </span>
              </div>

              {dossie.etapas.length === 0 ? (
                <p className="text-slate-400 italic">Nenhuma etapa cadastrada no cronograma.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-2">Ordem / Etapa</th>
                        <th className="p-2">Disciplina</th>
                        <th className="p-2">Executor Responsável</th>
                        <th className="p-2">Prazo</th>
                        <th className="p-2 text-right">Custo Estimado</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dossie.etapas.map((et: any) => (
                        <tr key={et.id} className="hover:bg-slate-50/50">
                          <td className="p-2 font-semibold text-slate-900">
                            {et.ordem ? `${et.ordem}. ` : ''}
                            {et.nome}
                          </td>
                          <td className="p-2 text-slate-600">{et.disciplina || 'Geral'}</td>
                          <td className="p-2 text-slate-800">
                            {et.executor_nome}
                            {et.executor_tipo && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {et.executor_tipo}
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-slate-600">
                            {et.prazo ? formatDateBr(et.prazo) : '—'}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {formatCurrencyBr(et.custo_estimado)}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                et.status === 'concluida'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : et.status === 'em_andamento'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {et.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEÇÃO 4: ENTREGÁVEIS DAS ETAPAS */}
            <div className="space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                  5. Entregáveis Técnicos e Versões ({dossie.entregaveis.length})
                </h3>
              </div>

              {dossie.entregaveis.length === 0 ? (
                <p className="text-slate-400 italic">Nenhum entregável registrado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dossie.entregaveis.map((en: any) => (
                    <div
                      key={en.id}
                      className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block">{en.nome}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Versão: {en.versao || 'Rev.00'}{' '}
                          {en.data_aprovacao
                            ? `• Aprovado em ${formatDateBr(en.data_aprovacao)}`
                            : ''}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                          en.status === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : en.status === 'revisao'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {en.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SEÇÃO 5: DOCUMENTOS E ANOTAÇÕES DE CLASSE */}
            <div className="space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-600" />
                  6. Documentos Obrigatórios, ART/RRT e Medições ({dossie.documentos.length})
                </h3>
              </div>

              {dossie.documentos.length === 0 ? (
                <p className="text-slate-400 italic">Nenhum documento anexado ao projeto.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Identificação / Número</th>
                        <th className="p-2">Responsável Técnico</th>
                        <th className="p-2">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {dossie.documentos.map((doc: any) => (
                        <tr key={doc.id}>
                          <td className="p-2 font-sans font-bold uppercase text-slate-800">
                            {doc.tipo}
                          </td>
                          <td className="p-2 text-slate-700">
                            {doc.numero || doc.descricao || '—'}
                          </td>
                          <td className="p-2 font-sans text-slate-600">
                            {doc.responsavel_tecnico || 'Não informado'}
                          </td>
                          <td className="p-2 text-slate-600">
                            {doc.vencimento ? formatDateBr(doc.vencimento) : 'Sem expiração'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEÇÃO 6: RISCOS ATIVOS E MITIGAÇÕES */}
            <div className="space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  7. Gestão de Riscos Operacionais ({dossie.riscos.length})
                </h3>
              </div>

              {dossie.riscos.length === 0 ? (
                <p className="text-slate-400 italic">Nenhum risco ativo mapeado no projeto.</p>
              ) : (
                <div className="space-y-2">
                  {dossie.riscos.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded border border-slate-200 bg-slate-50/70 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{r.descricao}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                            Prob: {r.probabilidade}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-800">
                            Imp: {r.impacto}
                          </span>
                        </div>
                      </div>
                      {r.mitigacao && (
                        <p className="text-slate-600 italic mt-1 text-[10px]">
                          <strong>Ação Mitigatória:</strong> {r.mitigacao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RODAPÉ DO DOSSIÊ */}
            <div className="pt-6 mt-8 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400">
              <span>
                Documento oficial gerado e auditado eletronicamente pela Plataforma de Engenharia.
              </span>
              <span>Página 1 de 1 • Confidencial</span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
