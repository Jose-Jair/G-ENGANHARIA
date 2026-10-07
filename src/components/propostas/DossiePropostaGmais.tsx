import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, CheckCircle2, ShieldCheck, FileText, Info } from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'
import { PropostaRecord, PropostaParcelaRecord, PropostaItemRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'
import { propostasService } from '@/services/propostas'
import { areasAtuacaoService } from '@/services/areasAtuacao'

interface DossiePropostaGmaisProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaRecord | null
}

export const DossiePropostaGmais: React.FC<DossiePropostaGmaisProps> = ({
  open,
  onOpenChange,
  proposta,
}) => {
  const [parcelas, setParcelas] = useState<PropostaParcelaRecord[]>([])
  const [areasMap, setAreasMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !proposta?.id) return

    const carregarDadosDossie = async () => {
      setLoading(true)
      try {
        const [parcs, areasList] = await Promise.all([
          propostasService.listParcelas(proposta.id),
          areasAtuacaoService.listAtivas().catch(() => []),
        ])
        setParcelas(parcs)
        const mapa = new Map<string, string>()
        areasList.forEach((a) => mapa.set(a.id, a.nome))
        setAreasMap(mapa)
      } catch (err) {
        console.warn('Erro ao carregar dados do dossiê GMAIS:', err)
      } finally {
        setLoading(false)
      }
    }

    carregarDadosDossie()
  }, [open, proposta?.id])

  if (!proposta) return null

  const handleImprimir = () => {
    window.print()
  }

  // Dados do proponente / G+
  const proponenteNome = 'G+ GESTÃO E ENGENHARIA LTDA'
  const proponenteCnpj = '00.000.000/0001-00'
  const proponenteEmail = 'contato@gmaisengenharia.com.br'

  // Dados do contratante
  const contratanteNome =
    proposta.expand?.empresa?.razao_social ||
    proposta.expand?.empresa?.nome_fantasia ||
    proposta.expand?.cliente_pf?.nome ||
    'Cliente Não Informado'

  const contratanteDoc =
    proposta.expand?.empresa?.cnpj || proposta.expand?.cliente_pf?.cpf || 'Documento não informado'

  const contratanteEndereco =
    (proposta.expand?.empresa?.municipio
      ? `${proposta.expand?.empresa?.municipio} - ${proposta.expand?.empresa?.uf || ''}`
      : proposta.expand?.cliente_pf?.endereco) || ''

  const empreendimentoNome = proposta.empreendimento || contratanteNome

  // Agrupamento de itens por Área de Atuação para tabela por tipo de projeto/área
  const itens: PropostaItemRecord[] = proposta.itens_json || []
  const gruposArea = new Map<
    string,
    { nomeArea: string; itens: PropostaItemRecord[]; subtotal: number }
  >()

  itens.forEach((it) => {
    const areaId = it.area || 'geral'
    const nomeArea =
      it.expand?.area?.nome ||
      areasMap.get(areaId) ||
      it.disciplina ||
      (areaId !== 'geral' ? areaId : 'Serviços Técnicos e Consultoria')

    if (!gruposArea.has(areaId)) {
      gruposArea.set(areaId, {
        nomeArea,
        itens: [],
        subtotal: 0,
      })
    }
    const g = gruposArea.get(areaId)!
    g.itens.push(it)
    const valorItem =
      it.preco_total !== undefined
        ? it.preco_total
        : (it.custo_total || 0) * (1 + (it.bdi_percentual || 0) / 100)
    g.subtotal += valorItem
  })

  const gruposArray = Array.from(gruposArea.values())

  // Prazos e Validade
  const diasPrazo = proposta.prazo_dias || 30
  const diasValidade = proposta.validade_dias || 15
  const notaPrazoTexto =
    proposta.nota_prazo ||
    'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'

  // Premissas e Condições Gerais
  const premissasTexto =
    proposta.premissas ||
    '1. A CONTRATADA não se responsabiliza por eventuais paralisações, atrasos e/ou cancelamentos decorrentes de exigências imprevistas dos órgãos competentes.\n2. Não estão inclusos os custos de taxas dos órgãos competentes e ART/RRT.\n3. Projetos elaborados em conformidade com as normas técnicas vigentes.\n4. Estão inclusas até 2 (duas) revisões de projeto decorrentes de concepção.'

  const condicoesGeraisTexto =
    proposta.condicoes_gerais ||
    'CLÁUSULA 1ª — As alterações no projeto ou nas premissas solicitadas pela CONTRATANTE incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias.\n\nCLÁUSULA 2ª — Os documentos e arquivos digitais são de uso exclusivo para o empreendimento objeto desta proposta.\n\nCLÁUSULA 3ª — A rescisão imotivada do contrato sujeitará a parte infratora à quitação dos serviços executados, acrescida de multa rescisória compensatória de 20% sobre o saldo remanescente.'

  const dataEmissaoFormatada = formatDateBr(proposta.created)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 bg-slate-100 print:bg-white print:max-w-none print:max-h-none print:overflow-visible print:p-0 print:border-none print:shadow-none">
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-bold text-sm">Visualização do Modelo Oficial GMAIS</div>
              <div className="text-[11px] text-slate-300">
                Proposta nº {proposta.numero} ({proposta.revisao || 'Rev.00'}) • Layout idêntico ao
                modelo da empresa
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleImprimir}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold gap-1.5 h-8 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* ÁREA DO DOCUMENTO PARA VISUALIZAÇÃO E IMPRESSÃO (Folha A4 / Modelo GMAIS) */}
        <div className="p-8 sm:p-12 bg-white max-w-4xl mx-auto text-slate-900 font-sans text-xs leading-relaxed space-y-6 print:p-6 print:text-black">
          {/* 1. CABEÇALHO COM LOGO E DADOS G+ */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              <GPlusLogo size={42} variant="horizontal" />
            </div>
            <div className="text-right">
              <div className="text-sm font-black tracking-wide text-slate-900 uppercase">
                Proposta Comercial de Engenharia
              </div>
              <div className="text-base font-mono font-bold text-orange-600 mt-0.5">
                Proposta nº {proposta.numero}
              </div>
              <div className="text-[11px] text-slate-500">
                {proposta.revisao || 'Rev.00'} • Data: {dataEmissaoFormatada}
              </div>
            </div>
          </div>

          {/* 2. DADOS DAS PARTES (PROPONENTE E CONTRATANTE) */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3.5 bg-slate-50/60 print:bg-white">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Proponente
              </span>
              <div className="font-bold text-slate-900 text-xs mt-0.5">{proponenteNome}</div>
              <div className="text-[11px] text-slate-600">CNPJ: {proponenteCnpj}</div>
              <div className="text-[11px] text-slate-600">{proponenteEmail}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Contratante / Empreendimento
              </span>
              <div className="font-bold text-slate-900 text-xs mt-0.5">{contratanteNome}</div>
              <div className="text-[11px] text-slate-700">
                <strong>Empreendimento:</strong> {empreendimentoNome}
              </div>
              <div className="text-[11px] text-slate-600">Doc: {contratanteDoc}</div>
              {contratanteEndereco && (
                <div className="text-[11px] text-slate-600">{contratanteEndereco}</div>
              )}
            </div>
          </div>

          {/* 3. SEÇÃO 1: OBJETO */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
              <span>1. Objeto</span>
            </h2>
            <p className="text-justify text-slate-800 leading-relaxed whitespace-pre-wrap">
              {proposta.objeto ||
                proposta.escopo ||
                `Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para o empreendimento "${empreendimentoNome}".`}
            </p>
          </section>

          {/* 4. SEÇÃO 2: ESCOPO DOS SERVIÇOS (NUMERADO) */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>2. Escopo dos Serviços</span>
            </h2>
            <div className="text-slate-800 whitespace-pre-wrap font-sans leading-relaxed text-justify">
              {proposta.escopo_gerado ||
                proposta.escopo ||
                'Detalhamento do escopo e atividades técnicas a serem executadas conforme especificações contratuais.'}
            </div>
          </section>

          {/* 5. SEÇÃO 3: PREMISSAS */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>3. Premissas</span>
            </h2>
            <div className="text-slate-800 whitespace-pre-wrap leading-relaxed text-justify">
              {premissasTexto}
            </div>
          </section>

          {/* 6. SEÇÃO 4: PRAZO DE EXECUÇÃO */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>4. Prazo de Execução</span>
            </h2>
            <div className="text-slate-800 space-y-1">
              <p>
                O prazo estimado total para o desenvolvimento dos serviços é de{' '}
                <strong>{diasPrazo} (trinta) dias</strong>.
              </p>
              <p className="text-[11px] text-slate-600 italic leading-normal">
                <strong>Nota:</strong> {notaPrazoTexto}
              </p>
            </div>
          </section>

          {/* 7. SEÇÃO 5: INVESTIMENTO (TABELA POR ÁREA + VALOR GLOBAL CONSOLIDADO) */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
              <span>5. Investimento</span>
            </h2>

            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3">Tipo de Projeto / Área &amp; Serviços</th>
                    <th className="py-2 px-2 text-center w-16">Qtd.</th>
                    <th className="py-2 px-3 text-right w-36">Investimento (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {gruposArray.length > 0 ? (
                    gruposArray.map((grupo, gIdx) => (
                      <React.Fragment key={gIdx}>
                        <tr className="bg-slate-50 font-semibold text-slate-900">
                          <td colSpan={2} className="py-2 px-3">
                            <span className="uppercase text-[11px] text-orange-700 tracking-wide">
                              ● {grupo.nomeArea}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900">
                            {formatCurrencyBr(grupo.subtotal)}
                          </td>
                        </tr>
                        {grupo.itens.map((it, itIdx) => {
                          const valorLinha =
                            it.preco_total !== undefined
                              ? it.preco_total
                              : (it.custo_total || 0) * (1 + (it.bdi_percentual || 0) / 100)
                          return (
                            <tr key={itIdx} className="text-[11px] text-slate-700">
                              <td className="py-1 px-4 pl-6">
                                <span>{it.descricao}</span>
                                {it.subservicos && it.subservicos.length > 0 && (
                                  <span className="text-slate-500 text-[10px] block">
                                    Subserviços: {it.subservicos.join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 px-2 text-center font-mono">
                                {it.quantidade} {it.unidade || 'un'}
                              </td>
                              <td className="py-1 px-3 text-right font-mono text-slate-600">
                                {formatCurrencyBr(valorLinha)}
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-center text-slate-500">
                        Serviços técnicos especializados: {formatCurrencyBr(proposta.preco)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-900">
                    <td colSpan={2} className="py-2.5 px-3 uppercase text-xs tracking-wider">
                      VALOR GLOBAL CONSOLIDADO
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm text-orange-400">
                      {formatCurrencyBr(proposta.preco)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* OBSERVAÇÃO OBRIGATÓRIA SOBRE NOTA FISCAL (Decisão do usuário / Req. 4) */}
            <div className="p-2.5 border rounded bg-slate-50 text-[11px] text-slate-700">
              <strong>Observação Fiscal: </strong>
              {proposta.requer_nota ? (
                <span>
                  O valor global desta proposta <strong>contempla a emissão de nota fiscal</strong>{' '}
                  de serviços técnicos e todos os tributos/impostos incidentes (
                  {proposta.impostos || 16.5}%).
                </span>
              ) : (
                <span>
                  Os valores apresentados nesta proposta comercial{' '}
                  <strong>não contemplam a emissão de nota fiscal</strong>. Caso a CONTRATANTE
                  solicite posterior faturamento formal por NF, será acrescida a alíquota tributária
                  vigente correspondente.
                </span>
              )}
            </div>
          </section>

          {/* 8. SEÇÃO 6: CONDIÇÕES DE PAGAMENTO (PARCELAS) */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>6. Condições de Pagamento</span>
            </h2>
            <div className="space-y-1 text-slate-800">
              <p>O pagamento dos serviços será efetuado conforme o cronograma e gatilhos abaixo:</p>
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="py-1.5 px-3 w-16 text-center">Parcela</th>
                      <th className="py-1.5 px-3 w-20 text-center">%</th>
                      <th className="py-1.5 px-3 text-right w-32">Valor (R$)</th>
                      <th className="py-1.5 px-3">Gatilho &amp; Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parcelas.length > 0 ? (
                      parcelas.map((parc, pIdx) => (
                        <tr key={pIdx}>
                          <td className="py-1.5 px-3 text-center font-bold font-mono">
                            #{parc.ordem || pIdx + 1}
                          </td>
                          <td className="py-1.5 px-3 text-center font-mono font-semibold">
                            {parc.percentual}%
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatCurrencyBr(parc.valor)}
                          </td>
                          <td className="py-1.5 px-3 text-slate-700">{parc.descricao}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-2 px-3 text-slate-700">
                          {proposta.condicoes_pagamento ||
                            '50% na contratação / 50% na entrega dos projetos executivos.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 9. SEÇÃO 7: VALIDADE DA PROPOSTA */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>7. Validade da Proposta</span>
            </h2>
            <p className="text-slate-800">
              Esta proposta é válida por <strong>{diasValidade} dias</strong> a contar de sua data
              de emissão
              {proposta.validade && ` (até ${formatDateBr(proposta.validade)})`}.
            </p>
          </section>

          {/* 10. SEÇÃO 8: CONDIÇÕES GERAIS */}
          <section className="space-y-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>8. Condições Gerais</span>
            </h2>
            <div className="text-slate-800 whitespace-pre-wrap leading-relaxed text-justify text-[11px]">
              {condicoesGeraisTexto}
            </div>
          </section>

          {/* 11. SEÇÃO 9: ACEITE & ASSINATURAS (MODELO GMAIS) */}
          <section className="space-y-4 pt-6 page-break-before">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1">
              <span>9. Aceite &amp; Assinaturas</span>
            </h2>
            <p className="text-[11px] text-slate-600 text-justify">
              E por estarem de pleno acordo com todas as cláusulas, condições e especificações
              técnicas constantes nesta Proposta Comercial e Contratual nº {proposta.numero}, as
              partes firmam o presente instrumento.
            </p>

            <div className="pt-10 grid grid-cols-2 gap-12 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                  {proponenteNome}
                </div>
                <div className="text-[10px] text-slate-600">CONTRATADA</div>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                  {contratanteNome}
                </div>
                <div className="text-[10px] text-slate-600">CONTRATANTE</div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-4">
              Documento gerado pelo sistema GESTÃO G+ em{' '}
              {formatDateTimeBr(new Date().toISOString())} • Proposta {proposta.numero}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default DossiePropostaGmais
