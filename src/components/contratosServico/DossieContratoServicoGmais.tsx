import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, FileText } from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'
import { ContratoServicoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr, formatDateTimeBr } from '@/lib/formatters'

interface DossieContratoServicoGmaisProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoServicoRecord | null
}

export const DossieContratoServicoGmais: React.FC<DossieContratoServicoGmaisProps> = ({
  open,
  onOpenChange,
  contrato,
}) => {
  if (!contrato) return null

  const handleImprimir = () => {
    window.print()
  }

  // Dados do proponente / Contratada G+
  const proponenteNome = 'G+ ENGENHARIA CONSULTIVA E PROJETOS LTDA'
  const proponenteCnpj = '00.000.000/0001-00'
  const proponenteEmail = 'grupomais.sae@gmail.com'

  // Dados do Contratante
  const contratanteNome =
    contrato.expand?.empresa?.razao_social ||
    contrato.expand?.empresa?.nome_fantasia ||
    contrato.expand?.cliente_pf?.nome ||
    'Cliente Não Informado'

  const contratanteDoc =
    contrato.expand?.empresa?.cnpj || contrato.expand?.cliente_pf?.cpf || 'Não informado'

  const contratanteEndereco =
    (contrato.expand?.empresa?.municipio
      ? `${contrato.expand?.empresa?.logradouro || ''} ${contrato.expand?.empresa?.numero || ''} - ${contrato.expand?.empresa?.municipio}/${contrato.expand?.empresa?.uf || ''}`.trim()
      : contrato.expand?.cliente_pf?.endereco) || ''

  const assinadoAdmin = Boolean(contrato.data_assinatura_admin)
  const assinadoCliente = Boolean(contrato.data_assinatura_cliente)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dossie-contrato-dialog w-[98vw] max-w-4xl max-h-[95vh] overflow-y-auto overflow-x-hidden p-0 bg-slate-100 print:bg-white print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:p-0 print:border-none print:shadow-none print:static print:transform-none">
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-bold text-sm">Contrato de Prestação de Serviços Técnicos</div>
              <div className="text-[11px] text-slate-300">
                Instrumento nº {contrato.numero} • Layout Oficial GMAIS
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
        <div className="dossie-contrato-documento p-4 sm:p-8 md:p-12 bg-white w-full max-w-4xl mx-auto text-slate-900 font-sans text-xs leading-relaxed space-y-5 print:p-0 print:m-0 print:max-w-none print:w-full print:text-black print:space-y-3 print:space-y-reverse-0">
          {/* 1. CABEÇALHO COM LOGO E DADOS G+ */}
          <div className="dossie-secao flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-3">
              <GPlusLogo size={42} variant="horizontal" />
            </div>
            <div className="text-right">
              <div className="text-sm font-black tracking-wide text-slate-900 uppercase">
                Contrato de Prestação de Serviços Técnicos
              </div>
              <div className="text-base font-mono font-bold text-orange-600 mt-0.5">
                {contrato.numero}
              </div>
              <div className="text-[11px] text-slate-500">
                Proposta de Origem: {contrato.expand?.proposta?.numero || 'S/N'} • Emissão:{' '}
                {formatDateBr(contrato.created)}
              </div>
            </div>
          </div>

          {/* 2. PARTES CONTRATANTES */}
          <div className="dossie-secao grid grid-cols-2 gap-4 border border-slate-300 rounded p-3.5 bg-slate-50/60 print:bg-white">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                CONTRATADA
              </span>
              <div className="font-bold text-slate-900 text-xs mt-0.5">{proponenteNome}</div>
              <div className="text-[11px] text-slate-600">CNPJ: {proponenteCnpj}</div>
              <div className="text-[11px] text-slate-600">{proponenteEmail}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                CONTRATANTE
              </span>
              <div className="font-bold text-slate-900 text-xs mt-0.5">{contratanteNome}</div>
              <div className="text-[11px] text-slate-600">Documento: {contratanteDoc}</div>
              {contratanteEndereco && (
                <div className="text-[11px] text-slate-600">{contratanteEndereco}</div>
              )}
            </div>
          </div>

          {/* 3. CLÁUSULA PRIMEIRA: OBJETO */}
          <section className="dossie-secao space-y-1.5 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 1ª — Do Objeto dos Serviços</span>
            </h2>
            <p className="text-justify text-slate-800 leading-relaxed whitespace-pre-line">
              {(
                contrato.objeto ||
                'Prestação de serviços técnicos especializados de engenharia consultiva e desenvolvimento de projetos executivos.'
              )
                .replace(/\n{3,}/g, '\n\n')
                .trim()}
            </p>
          </section>

          {/* 4. CLÁUSULA SEGUNDA: PRAZO DE EXECUÇÃO */}
          <section className="dossie-secao space-y-1.5 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 2ª — Do Prazo de Execução</span>
            </h2>
            <div className="text-slate-800 space-y-1">
              <p>
                O prazo total estimado para o desenvolvimento dos serviços ora contratados é de{' '}
                <strong>{contrato.prazo_dias || 30} dias corridos</strong>.
              </p>
              <p className="text-[11px] text-slate-600 italic leading-normal">
                <strong>Nota de Prazo:</strong>{' '}
                {(
                  contrato.nota_prazo ||
                  'Os prazos serão contados em dias corridos a partir da data de assinatura deste contrato e da disponibilização de todos os elementos técnicos necessários.'
                ).trim()}
              </p>
            </div>
          </section>

          {/* 5. CLÁUSULA TERCEIRA: VALOR GLOBAL E FORMA DE PAGAMENTO */}
          <section className="dossie-secao space-y-2 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 3ª — Do Valor Global e Condições de Pagamento</span>
            </h2>

            <div className="p-3 bg-slate-50 border border-slate-300 rounded flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase text-xs">
                VALOR TOTAL DOS SERVIÇOS:
              </span>
              <span className="font-mono text-base font-bold text-orange-600">
                {formatCurrencyBr(contrato.valor_total)}
              </span>
            </div>

            {contrato.parcelas_json && contrato.parcelas_json.length > 0 && (
              <div className="border border-slate-300 rounded overflow-hidden overflow-x-auto print:overflow-visible mt-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 text-center w-12">#</th>
                      <th className="py-2 px-3">Gatilho / Marco Contratual</th>
                      <th className="py-2 px-3 text-center w-24">Percentual</th>
                      <th className="py-2 px-3 text-right w-36">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {contrato.parcelas_json.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-mono">{p.ordem || idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {p.descricao} ({p.gatilho})
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{p.percentual}%</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 6. CLÁUSULA QUARTA: CONDIÇÕES GERAIS E CLÁUSULAS CONTRATUAIS */}
          <section className="dossie-secao space-y-1.5 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 4ª — Das Cláusulas e Condições Gerais</span>
            </h2>
            <div className="text-slate-800 whitespace-pre-line leading-relaxed text-justify text-[11px] p-3.5 bg-slate-50 border border-slate-300 rounded">
              {(
                contrato.clausulas_texto ||
                'CLÁUSULA 1ª — As alterações no projeto ou nas premissas solicitadas pela CONTRATANTE incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias.\n\nCLÁUSULA 2ª — Os documentos e arquivos digitais são de uso exclusivo para o empreendimento objeto deste contrato.\n\nCLÁUSULA 3ª — A rescisão imotivada sujeitará a parte infratora à quitação dos serviços executados, acrescida de multa rescisória compensatória de 20% sobre o saldo remanescente.'
              )
                .replace(/\n{3,}/g, '\n\n')
                .trim()}
            </div>
          </section>

          {/* 7. SEÇÃO DE ASSINATURAS ELETRÔNICAS DAS PARTES */}
          <section className="dossie-secao-assinaturas break-inside-avoid [page-break-inside:avoid] space-y-3 pt-3">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 [break-after:avoid] [page-break-after:avoid]">
              <span>Registro de Formalização e Assinaturas Eletrônicas</span>
            </h2>
            <p className="text-[11px] text-slate-600 text-justify">
              E por estarem justas e contratadas, as partes firmam o presente Contrato de Prestação
              de Serviços Técnicos nº <strong>{contrato.numero}</strong>, com plena eficácia e
              validade jurídica decorrente do registro de declaração de concordância, captura de IP
              e hash criptográfico.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 text-xs pt-3">
              {/* Box Contratada G+ */}
              <div className="p-3.5 border border-slate-300 rounded bg-slate-50">
                <div className="font-bold text-slate-900 text-xs mb-1">
                  PELA CONTRATADA (G+ ENGENHARIA)
                </div>
                {assinadoAdmin ? (
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div>
                      <strong>Signatário:</strong>{' '}
                      {contrato.expand?.assinante_admin?.name || 'Diretoria G+'}
                    </div>
                    <div>
                      <strong>Data/Hora:</strong>{' '}
                      {formatDateTimeBr(contrato.data_assinatura_admin!)}
                    </div>
                    <div>
                      <strong>IP:</strong> {contrato.admin_ip || 'Auditado'}
                    </div>
                    <div className="font-mono text-[9px] text-emerald-800 break-all">
                      Hash: {contrato.admin_hash}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">
                    Assinatura da Diretoria Técnica pendente
                  </div>
                )}
              </div>

              {/* Box Contratante */}
              <div className="p-3.5 border border-slate-300 rounded bg-slate-50">
                <div className="font-bold text-slate-900 text-xs mb-1">
                  PELO CONTRATANTE (CLIENTE)
                </div>
                {assinadoCliente ? (
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div>
                      <strong>Signatário:</strong> {contrato.cliente_nome_assinante}
                    </div>
                    <div>
                      <strong>Documento:</strong> {contrato.cliente_documento_assinante}
                    </div>
                    <div>
                      <strong>Data/Hora:</strong>{' '}
                      {formatDateTimeBr(contrato.data_assinatura_cliente!)}
                    </div>
                    <div>
                      <strong>IP:</strong> {contrato.cliente_ip || 'Auditado'}
                    </div>
                    <div className="font-mono text-[9px] text-emerald-800 break-all">
                      Hash: {contrato.cliente_hash}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">
                    Assinatura do Contratante pendente
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-slate-200">
              Documento gerado pelo sistema GESTÃO G+ • Contrato nº {contrato.numero} • Registrado
              em {formatDateTimeBr(new Date().toISOString())}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default DossieContratoServicoGmais
