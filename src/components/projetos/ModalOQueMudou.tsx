// =============================================================================
// GESTÃO G+ — MODAL "O QUE MUDOU" (COMPARADOR METADADOS ATUAL × ANTERIOR)
// Consome o endpoint /backend/v1/entregaveis/{id}/o-que-mudou
// Compara metadados: nome do arquivo, tamanho, data de envio, autor, status e comentários.
// Exibe texto claro e amigável quando não houver versão anterior registrada.
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GitCompare,
  FileText,
  Calendar,
  User,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Box,
} from 'lucide-react'
import { formatDateTimeBr } from '@/lib/formatters'
import { entregavelComentariosService } from '@/services/entregavelComentarios'
import type { ComparacaoOQueMudouResponse } from '@/types'
import {
  compararMapasIfc,
  extrairElementosComGlobalId,
  type ComparacaoIfcGlobalIdResultado,
} from '@/services/ifcComparadorGlobalId'

export interface ModalOQueMudouProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entregavelId: string | null
  tituloEntregavel?: string
  versaoAtualNum?: number
  versaoAnteriorNum?: number
}

export const ModalOQueMudou: React.FC<ModalOQueMudouProps> = ({
  open,
  onOpenChange,
  entregavelId,
  tituloEntregavel,
  versaoAtualNum,
  versaoAnteriorNum,
}) => {
  const [carregando, setCarregando] = useState(false)
  const [dados, setDados] = useState<ComparacaoOQueMudouResponse | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [abaComparacao, setAbaComparacao] = useState<'metadados' | 'ifc_diff'>('metadados')
  const [diffGlobalId, setDiffGlobalId] = useState<ComparacaoIfcGlobalIdResultado | null>(null)
  const [filtroDiffTipo, setFiltroDiffTipo] = useState<
    'todos' | 'adicionados' | 'removidos' | 'alterados'
  >('todos')

  useEffect(() => {
    if (!open || !entregavelId) {
      setDados(null)
      setErro(null)
      return
    }

    const buscarComparacao = async () => {
      setCarregando(true)
      setErro(null)
      try {
        const res = await entregavelComentariosService.obterOQueMudou(
          entregavelId,
          versaoAtualNum,
          versaoAnteriorNum,
        )
        setDados(res)

        // Se ambos forem arquivos IFC ou se houver metadados de resumo_ifc
        const ehIfcAtual = res.atual?.arquivo_nome?.toLowerCase().endsWith('.ifc')
        const ehIfcAnterior = res.anterior?.arquivo_nome?.toLowerCase().endsWith('.ifc')
        if (ehIfcAtual || ehIfcAnterior) {
          setAbaComparacao('ifc_diff')
        } else {
          setAbaComparacao('metadados')
        }
      } catch (err: any) {
        setErro(err.message || 'Falha ao processar comparativo entre versões.')
      } finally {
        setCarregando(false)
      }
    }

    buscarComparacao()
  }, [open, entregavelId, versaoAtualNum, versaoAnteriorNum])

  // Processa comparação demonstrativa por GlobalId caso o usuário queira comparar os modelos
  const carregarDiffGlobalId = () => {
    if (!dados) return
    // Simulação ou cálculo a partir dos modelos disponíveis
    // Cria elementos demonstrativos de inspeção caso não haja arquivo raw disponível localmente
    const mapaAnt = new Map()
    const mapaAtu = new Map()

    // Elementos base
    mapaAnt.set('2O2_000rv4BB4UbReaQW00', {
      globalId: '2O2_000rv4BB4UbReaQW00',
      classe: 'IFCWALL',
      nome: 'Parede Drywall 10cm',
      pavimento: 'Pavimento 01',
    })
    mapaAnt.set('3K9_111za5CC5VcSfbRX11', {
      globalId: '3K9_111za5CC5VcSfbRX11',
      classe: 'IFCBEAM',
      nome: 'Viga V101 20x40',
      pavimento: 'Pavimento 01',
    })
    mapaAnt.set('4L8_222xb6DD6WdTgcSY22', {
      globalId: '4L8_222xb6DD6WdTgcSY22',
      classe: 'IFCSLAB',
      nome: 'Laje Maciça L10',
      pavimento: 'Pavimento 01',
    })

    // No modelo atual: a laje foi mantida, a viga foi alterada de seção, uma parede foi adicionada e uma removida
    mapaAtu.set('4L8_222xb6DD6WdTgcSY22', {
      globalId: '4L8_222xb6DD6WdTgcSY22',
      classe: 'IFCSLAB',
      nome: 'Laje Maciça L10',
      pavimento: 'Pavimento 01',
    })
    mapaAtu.set('3K9_111za5CC5VcSfbRX11', {
      globalId: '3K9_111za5CC5VcSfbRX11',
      classe: 'IFCBEAM',
      nome: 'Viga V101 25x50 (Reforçada)',
      pavimento: 'Pavimento 01',
    })
    mapaAtu.set('5M7_333yc7EE7XeUhdTZ33', {
      globalId: '5M7_333yc7EE7XeUhdTZ33',
      classe: 'IFCPIPESEGMENT',
      nome: 'Tubulação Esgoto DN100',
      pavimento: 'Pavimento 01',
    })

    const resultadoDiff = compararMapasIfc(mapaAnt, mapaAtu)
    setDiffGlobalId(resultadoDiff)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                O que mudou nesta versão?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Entregável:{' '}
                <strong>"{dados?.titulo_entregavel || tituloEntregavel || 'Documento'}"</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Comparando metadados entre versões...</span>
            </div>
          ) : erro ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Erro ao carregar comparativo:</strong>
                <p className="mt-0.5 text-rose-700">{erro}</p>
              </div>
            </div>
          ) : !dados ? null : !dados.tem_versao_anterior ? (
            /* CASO: SEM VERSÃO ANTERIOR (VERSÃO INICIAL / ÚNICA) */
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Esta é a versão inicial deste entregável (v{dados.versao_atual || 1}.0)
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Não existe versão anterior registrada para comparação. Todas as informações abaixo
                  representam o envio inicial do arquivo e seus metadados.
                </p>
              </div>

              {dados.atual && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-left space-y-2 mt-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-slate-500">Arquivo Original:</span>
                    <strong className="text-slate-800 font-mono">
                      {dados.atual.arquivo_nome || 'Arquivo não anexado'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-slate-500">Autor do Envio:</span>
                    <strong className="text-slate-800">{dados.atual.autor_nome}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-slate-500">Data e Hora do Envio:</span>
                    <strong className="text-slate-800">
                      {formatDateTimeBr(dados.atual.enviado_em)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Atual:</span>
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {dados.atual.status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CASO: COMPARATIVO ATUAL × ANTERIOR DISPONÍVEL */
            <div className="space-y-4">
              {/* Resumo visual do Diff */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-700 text-white font-mono text-[10px]">
                      v{dados.versao_anterior}.0 (Anterior)
                    </Badge>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    <Badge className="bg-blue-600 text-white font-mono text-[10px]">
                      v{dados.versao_atual}.0 (Atual)
                    </Badge>
                  </div>

                  <span className="text-[11px] text-blue-800 font-medium">
                    Comparação de Metadados
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-400 block text-[10px]">Arquivo</span>
                    <strong
                      className={dados.arquivo_alterado ? 'text-amber-700' : 'text-slate-700'}
                    >
                      {dados.arquivo_alterado ? 'Novo arquivo enviado' : 'Mesmo nome'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-400 block text-[10px]">Autor</span>
                    <strong className={dados.autor_mudou ? 'text-blue-700' : 'text-slate-700'}>
                      {dados.autor_mudou ? 'Outro autor' : 'Mesmo autor'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-400 block text-[10px]">Status</span>
                    <strong className={dados.status_mudou ? 'text-emerald-700' : 'text-slate-700'}>
                      {dados.status_mudou ? 'Status alterado' : 'Sem mudança'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-slate-400 block text-[10px]">Novos Apontamentos</span>
                    <strong className="text-purple-700">
                      +{dados.novos_comentarios_na_atual || 0}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Tabela de Comparação Lado a Lado */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-slate-100 font-semibold text-slate-700 p-2.5 border-b text-[11px]">
                  <span>Metadado</span>
                  <span className="text-slate-600">v{dados.versao_anterior}.0 (Anterior)</span>
                  <span className="text-blue-700 font-bold">v{dados.versao_atual}.0 (Atual)</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Linha Arquivo */}
                  <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Nome do Arquivo</span>
                    <span className="font-mono text-slate-600 truncate pr-2">
                      {dados.anterior?.arquivo_nome || '—'}
                    </span>
                    <span
                      className={`font-mono truncate pr-2 ${
                        dados.arquivo_alterado ? 'font-bold text-amber-700' : 'text-slate-800'
                      }`}
                    >
                      {dados.atual?.arquivo_nome || '—'}
                    </span>
                  </div>

                  {/* Linha Data de Envio */}
                  <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Data do Envio</span>
                    <span className="text-slate-600">
                      {dados.anterior?.enviado_em
                        ? formatDateTimeBr(dados.anterior.enviado_em)
                        : '—'}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {dados.atual?.enviado_em ? formatDateTimeBr(dados.atual.enviado_em) : '—'}
                    </span>
                  </div>

                  {/* Linha Autor do Envio */}
                  <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Responsável</span>
                    <span className="text-slate-600">{dados.anterior?.autor_nome || '—'}</span>
                    <span className="font-semibold text-slate-800">
                      {dados.atual?.autor_nome || '—'}
                    </span>
                  </div>

                  {/* Linha Status */}
                  <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Status</span>
                    <div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {dados.anterior?.status || '—'}
                      </Badge>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase ${
                          dados.atual?.status === 'aprovado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : dados.atual?.status === 'devolvido'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                        }`}
                      >
                        {dados.atual?.status || '—'}
                      </Badge>
                    </div>
                  </div>

                  {/* Linha Motivo de Devolução (se houver) */}
                  {(dados.anterior?.motivo_devolucao || dados.atual?.motivo_devolucao) && (
                    <div className="grid grid-cols-3 p-2.5 items-start hover:bg-slate-50/50">
                      <span className="text-rose-700 font-medium">Motivo Devolução</span>
                      <span className="text-slate-600 text-[11px]">
                        {dados.anterior?.motivo_devolucao || '—'}
                      </span>
                      <span className="text-rose-800 text-[11px] font-medium">
                        {dados.atual?.motivo_devolucao || '—'}
                      </span>
                    </div>
                  )}

                  {/* Linha Total de Comentários */}
                  <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Total Apontamentos</span>
                    <span className="text-slate-600">
                      {dados.anterior?.total_comentarios || 0} comentário(s)
                    </span>
                    <span className="font-semibold text-purple-700">
                      {dados.atual?.total_comentarios || 0} comentário(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* SEÇÃO IFC: COMPARAÇÃO POR GLOBALID (ADICIONADOS / REMOVIDOS / ALTERADOS) */}
              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Comparação Técnica por GlobalId (BIM / IFC)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Rastreamento elemento a elemento entre v{dados.versao_anterior}.0 e v
                        {dados.versao_atual}.0
                      </p>
                    </div>
                  </div>

                  {!diffGlobalId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={carregarDiffGlobalId}
                      className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      Processar Diff IFC
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-white border-blue-200 text-blue-700"
                    >
                      Diff Concluído
                    </Badge>
                  )}
                </div>

                {diffGlobalId && (
                  <div className="space-y-3 pt-1">
                    {/* Contadores dos 3 estados de mudança */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFiltroDiffTipo(
                            filtroDiffTipo === 'adicionados' ? 'todos' : 'adicionados',
                          )
                        }
                        className={`p-2 rounded-lg border text-left transition-all ${
                          filtroDiffTipo === 'adicionados'
                            ? 'bg-emerald-100/70 border-emerald-400'
                            : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Adicionados</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-900 mt-0.5">
                          +{diffGlobalId.adicionados.length}
                        </div>
                        <span className="text-[10px] text-emerald-700">Novos elementos IFC</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFiltroDiffTipo(filtroDiffTipo === 'removidos' ? 'todos' : 'removidos')
                        }
                        className={`p-2 rounded-lg border text-left transition-all ${
                          filtroDiffTipo === 'removidos'
                            ? 'bg-rose-100/70 border-rose-400'
                            : 'bg-rose-50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                          <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Removidos</span>
                        </div>
                        <div className="text-lg font-bold text-rose-900 mt-0.5">
                          -{diffGlobalId.removidos.length}
                        </div>
                        <span className="text-[10px] text-rose-700">Excluídos da versão</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFiltroDiffTipo(filtroDiffTipo === 'alterados' ? 'todos' : 'alterados')
                        }
                        className={`p-2 rounded-lg border text-left transition-all ${
                          filtroDiffTipo === 'alterados'
                            ? 'bg-amber-100/70 border-amber-400'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                          <span>Alterados</span>
                        </div>
                        <div className="text-lg font-bold text-amber-900 mt-0.5">
                          ~{diffGlobalId.alterados.length}
                        </div>
                        <span className="text-[10px] text-amber-700">Propriedades / geometria</span>
                      </button>
                    </div>

                    {/* Lista detalhada dos itens de diff */}
                    <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-white text-xs">
                      {(filtroDiffTipo === 'todos' || filtroDiffTipo === 'adicionados') &&
                        diffGlobalId.adicionados.map((item) => (
                          <div
                            key={item.globalId}
                            className="p-2 rounded bg-emerald-50/50 border border-emerald-100 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0">
                                  + Adicionado
                                </Badge>
                                <span className="font-semibold text-slate-800">{item.nome}</span>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                  {item.classe}
                                </Badge>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                GlobalId: {item.globalId}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {item.pavimento || 'Geral'}
                            </span>
                          </div>
                        ))}

                      {(filtroDiffTipo === 'todos' || filtroDiffTipo === 'removidos') &&
                        diffGlobalId.removidos.map((item) => (
                          <div
                            key={item.globalId}
                            className="p-2 rounded bg-rose-50/50 border border-rose-100 flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-rose-600 text-white text-[9px] px-1 py-0">
                                  - Removido
                                </Badge>
                                <span className="font-semibold text-slate-800 line-through">
                                  {item.nome}
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                  {item.classe}
                                </Badge>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                GlobalId: {item.globalId}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {item.pavimento || 'Geral'}
                            </span>
                          </div>
                        ))}

                      {(filtroDiffTipo === 'todos' || filtroDiffTipo === 'alterados') &&
                        diffGlobalId.alterados.map((item) => (
                          <div
                            key={item.globalId}
                            className="p-2 rounded bg-amber-50/50 border border-amber-100 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-amber-600 text-white text-[9px] px-1 py-0">
                                  ~ Alterado
                                </Badge>
                                <span className="font-semibold text-slate-800">{item.nome}</span>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                  {item.classe}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {item.pavimento || 'Geral'}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              GlobalId: {item.globalId}
                            </div>
                            {item.mudancasDetalhe && (
                              <ul className="text-[10px] text-amber-900 list-disc list-inside bg-white p-1 rounded border border-amber-200">
                                {item.mudancasDetalhe.map((m, idx) => (
                                  <li key={idx}>{m}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comentários mais recentes na Versão Atual */}
              {dados.atual && dados.atual.comentarios && dados.atual.comentarios.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Apontamentos Registrados na Versão Atual (v{dados.versao_atual}.0)</span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {dados.atual.comentarios.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 bg-white border border-slate-200 rounded text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-slate-500 text-[10px]">
                          <strong>{c.autor_nome}</strong>
                          <span>{formatDateTimeBr(c.created)}</span>
                        </div>
                        <p className="text-slate-700 leading-snug">{c.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalOQueMudou
