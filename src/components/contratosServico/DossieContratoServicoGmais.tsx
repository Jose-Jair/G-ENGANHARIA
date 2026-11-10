import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, FileText, CheckCircle2 } from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'
import { ContratoServicoRecord } from '@/types'
import {
  formatCurrencyBr,
  formatDateBr,
  formatDateTimeBr,
  normalizarCondicoesPagamento,
  normalizarObjetoProposta,
} from '@/lib/formatters'
import { montarQualificacaoPf } from '@/lib/qualificacaoPf'
import { extrairSnapshotAssinatura, obterDadosRenderizacaoContrato } from '@/lib/snapshotContrato'

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

  // Snapshot de assinatura imutável (se existir, o dossiê renderiza SOMENTE a partir dele)
  const snapshot = extrairSnapshotAssinatura(contrato.snapshot_assinatura)
  const isCongelado = Boolean(snapshot)

  // Data do selo: snapshot_em do contrato ou gerado_em do snapshot
  const dataSelo = contrato.snapshot_em || snapshot?.gerado_em

  // Dados oficiais da Contratada / GMAIS ENGENHARIA LTDA
  const proponenteNome = snapshot?.contratada?.nome || 'GMAIS ENGENHARIA LTDA'
  const proponenteCnpj = snapshot?.contratada?.cnpj || '66.862.835/0001-69'
  const proponenteEmail = snapshot?.contratada?.email || 'grupomais.sae@gmail.com'
  const proponenteEndereco =
    snapshot?.contratada?.endereco ||
    'Av. Juvenco Gomes de Freitas, 354, Planalto Nelândia, Tauá – CE, CEP 63.660-000'
  const proponenteWhats = snapshot?.contratada?.telefone || '(88) 92188-6547'
  const proponenteRespTecnico =
    snapshot?.contratada?.responsavel_tecnico ||
    'Eng. Civil José Jair Oliveira Alves, CREA-CE 346391'
  const proponenteSlogan = snapshot?.contratada?.slogan || 'Conectando ideias, somando resultados'

  // Dados do Contratante
  const contratanteNome = snapshot
    ? snapshot.contratante?.nome || 'Cliente Não Informado'
    : contrato.expand?.empresa?.razao_social ||
      contrato.expand?.empresa?.nome_fantasia ||
      contrato.expand?.cliente_pf?.nome ||
      'Cliente Não Informado'

  const contratanteDoc = snapshot
    ? snapshot.contratante?.documento || 'Não informado'
    : contrato.expand?.empresa?.cnpj || contrato.expand?.cliente_pf?.cpf || 'Não informado'

  const contratanteEndereco = snapshot
    ? snapshot.contratante?.endereco || ''
    : (contrato.expand?.empresa?.municipio
        ? `${contrato.expand?.empresa?.logradouro || ''} ${contrato.expand?.empresa?.numero || ''} - ${contrato.expand?.empresa?.municipio}/${contrato.expand?.empresa?.uf || ''}`.trim()
        : contrato.expand?.cliente_pf?.endereco) || ''

  // Qualificação do contratante (em texto corrido)
  // Quando com snapshot: usa sempre o texto_qualificacao congelado
  // Quando ao vivo: PF usa montarQualificacaoPf, PJ segue layout bloco/padrão
  const textoQualificacaoSnapshot = snapshot?.contratante?.texto_qualificacao || ''
  const clientePfContratante = !snapshot ? contrato.expand?.cliente_pf || null : null
  const qualificacaoPfContratante = clientePfContratante
    ? montarQualificacaoPf(clientePfContratante).texto
    : ''

  // Resolução unificada via helper oficial de renderização
  const dadosRenderizacao = obterDadosRenderizacaoContrato(
    contrato,
    !snapshot ? contrato.expand?.cliente_pf || null : null,
  )

  const objetoTexto = dadosRenderizacao.objetoTexto
  const prazoDias = dadosRenderizacao.prazoDias
  const notaPrazoTexto =
    dadosRenderizacao.notaPrazo ||
    'Os prazos serão contados em dias corridos a partir da data de assinatura deste contrato e da disponibilização de todos os elementos técnicos necessários.'
  const valorTotal = dadosRenderizacao.valorTotal
  const parcelasLista = dadosRenderizacao.parcelas
  const clausulasTexto = dadosRenderizacao.clausulasTexto

  // Signatários
  const assinadoAdmin = Boolean(dadosRenderizacao.assinaturaAdmin?.data)
  const adminNome = dadosRenderizacao.assinaturaAdmin?.assinante || 'Diretoria G+'
  const adminDataAssinatura = dadosRenderizacao.assinaturaAdmin?.data
  const adminIp = dadosRenderizacao.assinaturaAdmin?.ip || 'Auditado'
  const adminHash = dadosRenderizacao.assinaturaAdmin?.hash

  const assinadoCliente = Boolean(dadosRenderizacao.assinaturaCliente?.data)
  const clienteNomeSignatario = dadosRenderizacao.assinaturaCliente?.assinante || 'Contratante'
  const clienteDocSignatario = dadosRenderizacao.assinaturaCliente?.documento || 'Não informado'
  const clienteDataAssinatura = dadosRenderizacao.assinaturaCliente?.data
  const clienteIp = dadosRenderizacao.assinaturaCliente?.ip || 'Auditado'
  const clienteHash = dadosRenderizacao.assinaturaCliente?.hash

  const propostaNumeroExibicao = snapshot
    ? snapshot.proposta_numero || contrato.expand?.proposta?.numero || 'S/N'
    : contrato.expand?.proposta?.numero || 'S/N'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dossie-contrato-dialog w-[98vw] max-w-4xl max-h-[95vh] overflow-y-auto overflow-x-hidden p-0 bg-slate-100 print:bg-white print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:p-0 print:border-none print:shadow-none print:static print:transform-none">
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  Contrato de Prestação de Serviços Técnicos
                </span>
                {isCongelado && dataSelo && (
                  <Badge
                    variant="outline"
                    data-testid="selo-versao-assinada"
                    className="bg-emerald-950/80 text-emerald-300 border-emerald-500/40 text-[10px] font-medium gap-1 py-0.5 px-2"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Versão assinada em {formatDateBr(dataSelo)}
                  </Badge>
                )}
              </div>
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
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <span className="text-base font-mono font-bold text-orange-600">
                  {contrato.numero}
                </span>
                {isCongelado && dataSelo && (
                  <Badge
                    variant="outline"
                    data-testid="selo-versao-assinada-documento"
                    className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1 py-0.5 px-2 print:border-emerald-600 print:text-emerald-900"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    Versão assinada em {formatDateBr(dataSelo)}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                Proposta de Origem: {propostaNumeroExibicao} • Emissão:{' '}
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
              <div className="text-[11px] text-slate-600">
                {proponenteEmail} • WhatsApp: {proponenteWhats}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{proponenteEndereco}</div>
              <div className="text-[10px] text-slate-600 font-medium mt-1">
                RT: {proponenteRespTecnico}
              </div>
              <div className="text-[10px] text-orange-700 italic mt-0.5">"{proponenteSlogan}"</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                CONTRATANTE
              </span>
              {textoQualificacaoSnapshot ? (
                <p
                  data-testid="qualificacao-contratante-snapshot"
                  className="text-[11px] text-slate-700 leading-relaxed text-justify mt-0.5"
                >
                  {textoQualificacaoSnapshot}
                </p>
              ) : clientePfContratante && qualificacaoPfContratante ? (
                <p
                  data-testid="qualificacao-contratante-pf-vivo"
                  className="text-[11px] text-slate-700 leading-relaxed text-justify mt-0.5"
                >
                  {qualificacaoPfContratante}
                </p>
              ) : (
                <>
                  <div
                    data-testid="nome-contratante"
                    className="font-bold text-slate-900 text-xs mt-0.5"
                  >
                    {contratanteNome}
                  </div>
                  <div className="text-[11px] text-slate-600">Documento: {contratanteDoc}</div>
                  {contratanteEndereco && (
                    <div className="text-[11px] text-slate-600">{contratanteEndereco}</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 3. CLÁUSULA PRIMEIRA: OBJETO */}
          <section className="dossie-secao space-y-1.5 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 1ª — Do Objeto dos Serviços</span>
            </h2>
            <p
              data-testid="objeto-contrato"
              className="text-justify text-slate-800 leading-relaxed whitespace-pre-line"
            >
              {objetoTexto}
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
                <strong data-testid="prazo-dias">{prazoDias} dias corridos</strong>.
              </p>
              <p className="text-[11px] text-slate-600 italic leading-normal">
                <strong>Nota de Prazo:</strong>{' '}
                <span data-testid="nota-prazo">{notaPrazoTexto}</span>
              </p>
            </div>
          </section>

          {/* 5. CLÁUSULA TERCEIRA: VALOR GLOBAL E FORMA DE PAGAMENTO */}
          <section className="dossie-secao space-y-2 break-inside-avoid [page-break-inside:avoid]">
            <h2 className="dossie-titulo-clausula text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between [break-after:avoid] [page-break-after:avoid]">
              <span>Cláusula 3ª — Do Valor Global e Condições de Pagamento</span>
            </h2>

            <div className="p-3 bg-slate-50 border border-slate-300 rounded flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 uppercase text-xs">
                  VALOR TOTAL DOS SERVIÇOS:
                </span>
                {dadosRenderizacao.valorExtenso && (
                  <div className="text-[11px] text-slate-600 italic">
                    ({dadosRenderizacao.valorExtenso})
                  </div>
                )}
              </div>
              <span
                data-testid="valor-total"
                className="font-mono text-base font-bold text-orange-600"
              >
                {formatCurrencyBr(valorTotal)}
              </span>
            </div>

            {parcelasLista.length > 0 && (
              <div className="border border-slate-300 rounded overflow-hidden overflow-x-auto print:overflow-visible mt-2">
                <table className="w-full text-left text-xs" data-testid="tabela-parcelas">
                  <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 text-center w-12">#</th>
                      <th className="py-2 px-3">Gatilho / Marco Contratual</th>
                      <th className="py-2 px-3 text-center w-24">Percentual</th>
                      <th className="py-2 px-3 text-right w-36">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parcelasLista.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-mono">{p.numero || idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {normalizarCondicoesPagamento(p.descricao)}{' '}
                          {p.gatilho ? `(${p.gatilho})` : ''}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{p.percentual}%</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBr(p.valor || 0)}
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
            <div className="text-slate-800 whitespace-pre-line leading-relaxed text-justify text-[11px] p-3.5 bg-slate-50 border border-slate-300 rounded space-y-2">
              <div data-testid="clausulas-texto">{clausulasTexto}</div>
              <div className="pt-2 border-t border-slate-200 text-slate-700 font-medium">
                <strong>CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA:</strong> As partes declaram e
                reconhecem expressamente a validade, integridade e eficácia jurídica desta
                contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº
                2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como válidas as assinaturas
                eletrônicas emitidas mediante verificação de código OTP de 6 dígitos enviado por
                e-mail, registro de endereço IP, user-agent, carimbo de tempo UTC e hash
                criptográfico SHA-256 do documento congelado.
              </div>
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
                      <span data-testid="signatario-admin-nome">{adminNome}</span>
                    </div>
                    <div>
                      <strong>Data/Hora:</strong>{' '}
                      <span data-testid="signatario-admin-data">
                        {adminDataAssinatura ? formatDateTimeBr(adminDataAssinatura) : 'Auditado'}
                      </span>
                    </div>
                    <div>
                      <strong>IP:</strong> {adminIp}
                    </div>
                    <div
                      data-testid="signatario-admin-hash"
                      className="font-mono text-[9px] text-emerald-800 break-all"
                    >
                      Hash: {adminHash}
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
                      <strong>Signatário:</strong>{' '}
                      <span data-testid="signatario-cliente-nome">{clienteNomeSignatario}</span>
                    </div>
                    <div>
                      <strong>Documento:</strong>{' '}
                      <span data-testid="signatario-cliente-doc">{clienteDocSignatario}</span>
                    </div>
                    <div>
                      <strong>Data/Hora:</strong>{' '}
                      <span data-testid="signatario-cliente-data">
                        {clienteDataAssinatura
                          ? formatDateTimeBr(clienteDataAssinatura)
                          : 'Auditado'}
                      </span>
                    </div>
                    <div>
                      <strong>IP:</strong> {clienteIp}
                    </div>
                    <div
                      data-testid="signatario-cliente-hash"
                      className="font-mono text-[9px] text-emerald-800 break-all"
                    >
                      Hash: {clienteHash}
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
