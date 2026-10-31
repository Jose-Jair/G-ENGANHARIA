import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Check,
  ShieldCheck,
  MessageSquare,
  FileText,
  AlertCircle,
  Building2,
  User,
  ArrowRight,
  Lock,
} from 'lucide-react'
import { PropostaRecord, MotivoRecord } from '@/types'
import {
  formatCurrencyBr,
  formatDateBr,
  formatDateTimeBr,
  normalizarCondicoesPagamento,
} from '@/lib/formatters'
import { PropostaItemRecord } from '@/types'
import { areasAtuacaoService } from '@/services/areasAtuacao'
import { propostasService } from '@/services/propostas'
import { motivosService } from '@/services/motivos'
import { useToast } from '@/hooks/use-toast'
import { parametrosService } from '@/services/parametros'
import { GPlusLogo } from '@/components/GPlusLogo'
import { restoreBodyPointerEvents } from '@/lib/utils'

export function PropostaPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [proposta, setProposta] = useState<PropostaRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [motivosRecusa, setMotivosRecusa] = useState<MotivoRecord[]>([])
  const [areasMap, setAreasMap] = useState<Map<string, string>>(new Map())

  // Solicitar Alterações
  const [showAlteracoesModal, setShowAlteracoesModal] = useState(false)
  const [textoAlteracoes, setTextoAlteracoes] = useState('')
  const [submittingAlteracoes, setSubmittingAlteracoes] = useState(false)

  // Recusa com trava de segurança (confirmação dupla + motivo)
  const [showRecusaModal, setShowRecusaModal] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [detalheRecusa, setDetalheRecusa] = useState('')
  const [confirmacaoTravaRecusa, setConfirmacaoTravaRecusa] = useState(false)
  const [submittingRecusa, setSubmittingRecusa] = useState(false)

  // Aceite com Validade Jurídica (Declaração direta sem modal intermediário)
  const [declaracaoAceite, setDeclaracaoAceite] = useState(false)
  const [processingAceite, setProcessingAceite] = useState(false)
  const [aceiteConcluido, setAceiteConcluido] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const record = await propostasService.getByToken(token)
        setProposta(record)

        if (record) {
          // Marcar como visualizada se ainda estava em 'enviada'
          if (record.status === 'enviada') {
            try {
              await propostasService.update(record.id, {
                status: 'visualizada',
                data_visualizacao: new Date().toISOString(),
                token_aceite: token,
              })
            } catch (err) {
              console.warn('Erro ao atualizar tracking de visualização:', err)
            }
          }
        }

        const [motivos, areasList] = await Promise.all([
          motivosService.listAtivos('perda').catch(() => []),
          areasAtuacaoService.listAtivas().catch(() => []),
        ])
        setMotivosRecusa(motivos)
        const mapa = new Map<string, string>()
        areasList.forEach((a) => mapa.set(a.id, a.nome))
        setAreasMap(mapa)
      } catch (err) {
        console.error('Erro ao carregar proposta pública:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

  // Minuta do Contrato para visualização prévia
  const [showMinutaModal, setShowMinutaModal] = useState(false)
  const [clausulasMinuta, setClausulasMinuta] = useState<string>('')
  const [loadingMinuta, setLoadingMinuta] = useState(false)

  const handleAbrirMinutaContrato = async () => {
    setShowMinutaModal(true)
    setLoadingMinuta(true)
    try {
      const param = await parametrosService.get(
        'contrato_servico_minuta_padrao',
        'CLÁUSULA 1ª — DO OBJETO E ESCOPO TÉCNICO\nO presente instrumento tem por objeto a prestação dos serviços técnicos de engenharia discriminados na Proposta Comercial vinculada, a serem executados em estrita observância às normas técnicas brasileiras vigentes.\n\nCLÁUSULA 2ª — DO PRAZO E DA EXECUÇÃO\nOs serviços serão executados no prazo convencionado na proposta, iniciando-se a contagem a partir do fornecimento completo de todas as informações, acessos e documentações preliminares necessárias.\n\nCLÁUSULA 3ª — DAS CONDIÇÕES DE PAGAMENTO\nO pagamento será efetuado conforme os marcos e percentuais estabelecidos na proposta comercial. O atraso em qualquer pagamento sujeitará a incidência de juros moratórios de 1% ao mês e multa compensatória de 2%.\n\nCLÁUSULA 4ª — DAS ALTERAÇÕES E RETRABALHOS\nQuaisquer alterações de premissas, escopo ou solicitações supervenientes não contempladas expressamente no documento original deverão ser objeto de termo aditivo com orçamento complementar prévio.\n\nCLÁUSULA 5ª — DA CONFIDENCIALIDADE E PROPRIEDADE INTELECTUAL\nAs partes comprometem-se a manter sigilo rigoroso sobre quaisquer dados e documentos técnicos, reservando-se à Contratada a responsabilidade técnica e autoria dos projetos elaborados nos termos da legislação profissional vigente.\n\nCLÁUSULA 6ª — DA VALIDADE DO ACEITE ELETRÔNICO\nAs partes reconhecem a plena eficácia jurídica deste documento e das manifestações de vontade efetuadas eletronicamente, nos termos do art. 10, § 2º da MP nº 2.200-2/2001, com validação de autoria e integridade por meio de endereço IP, carimbo de data/hora e hash criptográfico.',
      )
      setClausulasMinuta(param)
    } catch (_) {
      setClausulasMinuta(
        'Cláusulas gerais da minuta de prestação de serviços técnicos da G+ Engenharia Consultiva.',
      )
    } finally {
      setLoadingMinuta(false)
    }
  }

  // 1. SOLICITAR ALTERAÇÕES PELO LINK
  const handleSolicitarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !textoAlteracoes.trim()) return

    setSubmittingAlteracoes(true)
    try {
      await propostasService.solicitarAlteracoes(token, textoAlteracoes)
      toast({
        title: 'Solicitação Enviada',
        description: 'Sua solicitação foi recebida e nossa equipe comercial entrará em contato.',
      })
      setShowAlteracoesModal(false)
      if (proposta) {
        setProposta({
          ...proposta,
          status: 'em_negociacao',
          solicitacao_alteracao_texto: textoAlteracoes,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar solicitação',
        description: err.message || 'Não foi possível registrar as alterações solicitadas.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingAlteracoes(false)
    }
  }

  // 2. RECUSAR COM TRAVA DE SEGURANÇA OBRIGATÓRIA (CONFIRMAÇÃO + MOTIVO)
  const handleRecusarProposta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proposta || !token) return

    if (!motivoSelecionado) {
      toast({
        variant: 'destructive',
        title: 'Motivo obrigatório',
        description: 'Por favor, selecione um motivo para a recusa da proposta.',
      })
      return
    }

    if (!confirmacaoTravaRecusa) {
      toast({
        variant: 'destructive',
        title: 'Trava de segurança',
        description: 'Por favor, marque a caixa confirmando a intenção de recusa da proposta.',
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
        description: 'A recusa foi registrada com sucesso e auditada em nossa plataforma.',
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

  // 3. ACEITE COM MECANISMOS DE VALIDADE JURÍDICA E REDIRECIONAMENTO DIRETO SEM MODAL INTERMEDIÁRIO
  const handleConfirmarAceiteDireto = async () => {
    if (!declaracaoAceite) {
      toast({
        title: 'Declaração obrigatória',
        description:
          'Por favor, declare que leu e aceita integralmente as condições da proposta para prosseguir.',
        variant: 'destructive',
      })
      return
    }

    if (!proposta || !token) return

    setProcessingAceite(true)
    try {
      const res = await propostasService.aceitarDigital({
        tokenAceite: token,
        declaracao: true,
      })

      setAceiteConcluido(true)

      // Atualizar objeto em memória
      setProposta({
        ...proposta,
        status: 'aceita',
        data_aceite: res.data_aceite || new Date().toISOString(),
        aceite_declaracao: true,
        aceite_hash: res.hash,
      })

      toast({
        title: 'Aceite Formalizado com Pleno Sucesso!',
        description:
          'O aceite digital possui validade jurídica. Redirecionando para o complemento cadastral...',
      })

      // ALTERAÇÃO 1: Ao receber resposta positiva do endpoint POST /backend/v1/propostas/aceitar-digital,
      // redirecionar IMEDIATAMENTE para /completar-cadastro/ + token_complemento_dados
      // sem modal/etapa intermediária de confirmação/autenticação cadastral (PF e PJ)
      if (res.token_complemento_dados) {
        navigate(`/completar-cadastro/${res.token_complemento_dados}`)
        return
      }

      // Se o cadastro já estava integralmente completo e veio token de assinatura do cliente:
      if (res.token_assinatura_cliente) {
        navigate(`/contrato-servico/${res.token_assinatura_cliente}`)
        return
      }
    } catch (err: any) {
      console.error('Erro ao registrar aceite digital:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no aceite digital',
        description: err.message || 'Não foi possível processar o aceite eletrônico.',
      })
    } finally {
      setProcessingAceite(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B] mx-auto" />
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
          <CardTitle className="text-lg">Proposta Não Encontrada ou Link Expirado</CardTitle>
          <p className="text-xs text-slate-500 mt-2">
            O link informado pode ser inválido ou foi substituído por uma nova revisão da proposta.
            Por favor, contate seu consultor da G+ Engenharia.
          </p>
        </Card>
      </div>
    )
  }

  const isFinalizada =
    proposta.status === 'aceita' ||
    proposta.status === 'recusada' ||
    proposta.status === 'expirada' ||
    proposta.status === 'em_negociacao'

  return (
    <div className="min-h-screen bg-slate-100/80 py-4 sm:py-8 px-2 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* BANNER DE STATUS SE JÁ ESTIVER ACEITA/RECUSADA/EXPIRADA/EM NEGOCIAÇÃO */}
        {proposta.status === 'aceita' && (
          <div className="bg-emerald-600 text-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-100 shrink-0" />
              <div>
                <div className="font-bold text-sm">Proposta Aceita com Sucesso</div>
                <div className="text-xs text-emerald-100">
                  Aceite eletrônico formalizado em{' '}
                  {formatDateTimeBr(proposta.data_aceite || proposta.updated)}.
                  {proposta.aceite_hash && (
                    <span className="block mt-0.5 font-mono text-[10px] text-emerald-200">
                      Hash de Integridade: {proposta.aceite_hash.substring(0, 24)}...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-700 text-white border-0 text-xs self-start sm:self-center">
              Formalizada
            </Badge>
          </div>
        )}

        {proposta.status === 'em_negociacao' && (
          <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 text-white p-4 sm:p-5 rounded-lg shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-purple-400">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-7 h-7 text-purple-200 shrink-0" />
              <div>
                <div className="font-bold text-sm sm:text-base">
                  Aguardando revisão da proposta ({proposta.revisao || 'Rev.00'}).
                </div>
                <div className="text-xs text-purple-100 mt-0.5 leading-relaxed">
                  Nossa equipe técnica e comercial está elaborando os ajustes solicitados. Você
                  receberá um novo link de acesso assim que a próxima versão for liberada.
                </div>
              </div>
            </div>
            <Badge className="bg-purple-900/90 text-purple-100 border border-purple-300 text-xs self-start sm:self-center font-mono py-1 px-2.5">
              {proposta.revisao || 'Rev.00'} em Análise
            </Badge>
          </div>
        )}

        {proposta.status === 'recusada' && (
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-100 shrink-0" />
              <div>
                <div className="font-bold text-sm">Proposta Recusada</div>
                <div className="text-xs text-red-100">
                  Motivo: {proposta.motivo_recusa} • Registrado em{' '}
                  {formatDateTimeBr(proposta.data_recusa || proposta.updated)}
                </div>
              </div>
            </div>
            <Badge className="bg-red-700 text-white border-0 text-xs self-start sm:self-center">
              Recusada
            </Badge>
          </div>
        )}

        {proposta.status === 'expirada' && (
          <div className="bg-slate-700 text-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-slate-300 shrink-0" />
              <div>
                <div className="font-bold text-sm">Prazo de Validade Expirado</div>
                <div className="text-xs text-slate-300">
                  Esta proposta expirou em{' '}
                  {proposta.validade ? formatDateBr(proposta.validade) : 'data anterior'}. Solicite
                  uma atualização ao seu consultor.
                </div>
              </div>
            </div>
            <Badge className="bg-slate-800 text-white border-0 text-xs self-start sm:self-center">
              Expirada
            </Badge>
          </div>
        )}

        {/* DOCUMENTO DA PROPOSTA (LAYOUT DE DOCUMENTO FORMAL) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
          {/* TOPO COM LOGO E DADOS GERAIS */}
          <div className="p-4 sm:p-8 border-b border-slate-200 bg-[#1E2A4A]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <GPlusLogo variant="horizontal" theme="light" size={38} showSlogan={true} />
            </div>

            <div className="text-left sm:text-right border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-[#D95A2B]/40 sm:border-transparent">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D95A2B] block">
                Proposta Comercial
              </span>
              <div className="font-mono font-black text-base sm:text-lg text-[#1E2A4A]">
                {proposta.numero}
              </div>
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

          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 text-xs text-slate-700">
            {/* SEÇÃO 1: DADOS DAS PARTES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-3.5 sm:p-4 rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block mb-1">
                  Contratante / Solicitante:
                </span>
                {proposta.expand?.empresa ? (
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {proposta.expand.empresa.razao_social}
                    </div>
                    <div className="text-xs text-slate-600">
                      CNPJ: {proposta.expand.empresa.cnpj}
                    </div>
                    {(proposta.expand.empresa.municipio || proposta.expand.empresa.uf) && (
                      <div className="text-xs text-slate-600">
                        {[proposta.expand.empresa.municipio, proposta.expand.empresa.uf]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    )}
                  </div>
                ) : proposta.expand?.cliente_pf ? (
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {proposta.expand.cliente_pf.nome}
                    </div>
                    <div className="text-xs text-slate-600">
                      CPF: {proposta.expand.cliente_pf.cpf || 'Não informado'}
                    </div>
                    {(proposta.expand.cliente_pf.endereco ||
                      proposta.expand.cliente_pf.logradouro) && (
                      <div className="text-xs text-slate-600">
                        {proposta.expand.cliente_pf.endereco ||
                          `${proposta.expand.cliente_pf.logradouro || ''}, nº ${proposta.expand.cliente_pf.numero || 'S/N'}${proposta.expand.cliente_pf.municipio ? ` - ${proposta.expand.cliente_pf.municipio}` : ''}${proposta.expand.cliente_pf.uf ? `/${proposta.expand.cliente_pf.uf}` : ''}`}
                      </div>
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
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900">
                      {proposta.expand.contrato.numero}
                    </div>
                    <div className="text-xs text-slate-600">{proposta.expand.contrato.orgao}</div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    Contratação Direta de Serviços Técnicos Especializados
                  </div>
                )}
              </div>
            </div>

            {/* 1. SEÇÃO 1: OBJETO */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">1. Objeto</h3>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white p-2 text-justify">
                {(
                  proposta.objeto ||
                  proposta.escopo ||
                  `Esta proposta comercial tem como objetivo a prestação de serviços técnicos especializados para o empreendimento "${proposta.empreendimento || 'Empreendimento'}".`
                )
                  .replace(/\n{3,}/g, '\n\n')
                  .trim()}
              </div>
            </div>

            {/* 2. SEÇÃO 2: ESCOPO DOS SERVIÇOS (LISTA PROJETO / DISCIPLINA) */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                2. Escopo dos Serviços
              </h3>
              <div className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white p-2 text-justify">
                {(() => {
                  const textoEscopo =
                    proposta.escopo_gerado ||
                    proposta.escopo ||
                    'Detalhamento do escopo e atividades técnicas a serem executadas conforme especificações contratuais.'
                  return textoEscopo.replace(/\n{3,}/g, '\n\n').trim()
                })()}
              </div>
            </div>

            {/* 3. SEÇÃO 3: DISCIPLINAS */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">3. Disciplinas</h3>
              <div className="p-3 bg-slate-50 rounded border text-slate-700 leading-relaxed">
                {proposta.disciplinas ||
                  (proposta.itens_json && proposta.itens_json.length > 0
                    ? Array.from(
                        new Set(
                          proposta.itens_json
                            .map(
                              (it) =>
                                it.disciplina ||
                                (it.area ? areasMap.get(it.area) : null) ||
                                'Engenharia Consultiva',
                            )
                            .filter(Boolean),
                        ),
                      ).join(', ')
                    : 'Engenharia Consultiva e Projetos')}
              </div>
            </div>

            {/* 4. SEÇÃO 4: ENTREGÁVEIS */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">4. Entregáveis</h3>
              <div className="p-3 bg-slate-50 rounded border text-slate-700 leading-relaxed">
                {proposta.entregaveis ||
                  'Plantas técnicas em formato digital (DWG/PDF), memoriais descritivos e de cálculo, ART/RRT de projeto e documentação regulamentar pertinente.'}
              </div>
            </div>

            {/* 5. SEÇÃO 5: DISCRIMINAÇÃO E PREÇO */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                5. Discriminação e Preço
              </h3>
              <div className="border rounded-lg overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="bg-slate-100 text-slate-800 font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3">Tipo de Projeto / Serviço</th>
                      <th className="py-2.5 px-3">Disciplina / Área</th>
                      <th className="py-2.5 px-3 text-center w-16">Unid.</th>
                      <th className="py-2.5 px-3 text-center w-16">Qtd.</th>
                      <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proposta.itens_json && proposta.itens_json.length > 0 ? (
                      proposta.itens_json.map((it, idx) => {
                        const bdi = Number(it.bdi_percentual ?? proposta.margem ?? 0)
                        const sub =
                          it.preco_total !== undefined && it.preco_total !== null
                            ? Math.round(Number(it.preco_total) * 100) / 100
                            : Math.round(Number(it.custo_total || 0) * (1 + bdi / 100) * 100) / 100
                        const areaNome =
                          it.disciplina || (it.area ? areasMap.get(it.area) : '-') || '-'
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-900">
                              <span>{it.descricao}</span>
                              {it.subservicos && it.subservicos.length > 0 && (
                                <span className="text-slate-500 text-[10px] block">
                                  Subserviços: {it.subservicos.join(', ')}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{areaNome}</td>
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
                          Serviços técnicos globais de engenharia conforme escopo descrito:{' '}
                          {formatCurrencyBr(proposta.preco)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t font-semibold">
                    {(() => {
                      const itensList = proposta.itens_json || []
                      const subtotalItens =
                        Math.round(
                          itensList.reduce((acc, it) => {
                            const bdi = Number(it.bdi_percentual ?? proposta.margem ?? 0)
                            const sub =
                              it.preco_total !== undefined && it.preco_total !== null
                                ? Math.round(Number(it.preco_total) * 100) / 100
                                : Math.round(Number(it.custo_total || 0) * (1 + bdi / 100) * 100) /
                                  100
                            return acc + sub
                          }, 0) * 100,
                        ) / 100

                      const aliquota = proposta.requer_nota ? Number(proposta.impostos) || 0 : 0
                      const valorImpostos =
                        proposta.requer_nota && aliquota > 0
                          ? Math.round(((subtotalItens * aliquota) / 100) * 100) / 100
                          : 0

                      const totalFinal =
                        proposta.requer_nota && aliquota > 0
                          ? Math.round((subtotalItens + valorImpostos) * 100) / 100
                          : subtotalItens > 0
                            ? subtotalItens
                            : Math.round(Number(proposta.preco || 0) * 100) / 100

                      return (
                        <>
                          {proposta.requer_nota && aliquota > 0 && itensList.length > 0 && (
                            <>
                              <tr>
                                <td
                                  colSpan={4}
                                  className="py-2 px-3 text-right text-slate-600 text-xs"
                                >
                                  Subtotal dos Serviços:
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-xs text-slate-800">
                                  {formatCurrencyBr(subtotalItens)}
                                </td>
                              </tr>
                              <tr>
                                <td
                                  colSpan={4}
                                  className="py-2 px-3 text-right text-slate-600 text-xs"
                                >
                                  Impostos com NF ({aliquota}%):
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-xs text-slate-800">
                                  {formatCurrencyBr(valorImpostos)}
                                </td>
                              </tr>
                            </>
                          )}
                          <tr className="bg-slate-900 text-white font-bold">
                            <td
                              colSpan={4}
                              className="py-3 px-3 text-right uppercase text-xs tracking-wider"
                            >
                              Investimento Global Consolidado:
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-base font-bold text-orange-400">
                              {formatCurrencyBr(totalFinal)}
                            </td>
                          </tr>
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>

              <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-slate-600 leading-relaxed">
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

            {/* 6. SEÇÃO 6: CONDIÇÕES GERAIS COM CLÁUSULAS 1ª A 3ª */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-slate-900 border-b pb-1">
                6. Condições Gerais
              </h3>
              <div className="p-3.5 bg-slate-50 rounded border text-slate-800 whitespace-pre-wrap leading-relaxed text-[11px] text-justify font-sans">
                {(
                  proposta.condicoes_gerais ||
                  'CLÁUSULA 1ª — As alterações no projeto ou nas premissas solicitadas pela CONTRATANTE incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias.\n\nCLÁUSULA 2ª — Os documentos e arquivos digitais são de uso exclusivo para o empreendimento objeto desta proposta.\n\nCLÁUSULA 3ª — A rescisão imotivada do contrato sujeitará a parte infratora à quitação dos serviços executados, acrescida de multa rescisória compensatória de 20% sobre o saldo remanescente.'
                )
                  .replace(/\n{3,}/g, '\n\n')
                  .trim()}
              </div>
            </div>

            {/* PRAZO E CONDIÇÕES DE PAGAMENTO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-3.5 sm:p-4 rounded-lg border border-slate-200">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                  Prazo de Execução:
                </span>
                <p className="font-semibold text-slate-800">
                  {proposta.prazo || `${proposta.prazo_dias || 30} dias corridos`}
                </p>
                {proposta.nota_prazo && (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    <strong>Nota:</strong> {proposta.nota_prazo}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider block">
                  Condições de Pagamento:
                </span>
                <p className="font-semibold text-slate-800">
                  {normalizarCondicoesPagamento(proposta.condicoes_pagamento) ||
                    '50% na contratação / 50% na entrega dos projetos executivos.'}
                </p>
              </div>
            </div>

            {/* PREMISSAS E EXCLUSÕES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  Premissas da Proposta:
                </h4>
                <p className="p-3 bg-slate-50 rounded border text-slate-600 text-justify">
                  {proposta.premissas || 'Fornecimento tempestivo de dados e documentação prévia.'}
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                  Exclusões de Escopo:
                </h4>
                <p className="p-3 bg-slate-50 rounded border text-slate-600 text-justify">
                  {proposta.exclusoes || 'Taxas públicas e licenças municipais/estaduais.'}
                </p>
              </div>
            </div>
          </div>

          {/* CHECKBOX DE DECLARAÇÃO OBRIGATÓRIA (MECANISMO DE VALIDADE JURÍDICA) */}
          {!isFinalizada && (
            <div className="p-4 sm:p-6 bg-slate-50/90 border-t border-slate-200 space-y-3">
              <div className="flex items-start gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <Checkbox
                  id="chk-declaracao"
                  checked={declaracaoAceite}
                  onCheckedChange={(c) => setDeclaracaoAceite(c === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="chk-declaracao"
                  className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none"
                >
                  <strong className="text-slate-900">Declaração de Aceite Eletrônico:</strong>{' '}
                  Declaro que li, compreendi e concordo integralmente com os termos, escopo técnico,
                  planilha orçamentária, prazos e condições gerais da Proposta Comercial{' '}
                  <strong className="text-slate-900 font-mono">{proposta.numero}</strong> (
                  {proposta.revisao || 'Rev.00'}). Reconheço este aceite eletrônico com plena
                  eficácia e validade jurídica para a subsequente emissão do Contrato de Prestação
                  de Serviços.
                </label>
              </div>
            </div>
          )}

          {/* RODAPÉ DO DOCUMENTO COM BOTÕES DE AÇÃO (SOLICITAR ALTERAÇÕES / RECUSAR / ACEITAR) */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] sm:text-xs">
                Ambiente seguro de formalização eletrônica com registro de IP, hora e integridade
                criptográfica.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Botão Visualizar Minuta do Contrato */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAbrirMinutaContrato}
                className="text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-100 justify-center"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5 shrink-0 text-blue-600" />
                Visualizar Minuta do Contrato
              </Button>

              {!isFinalizada && (
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  {/* Botão Solicitar Alterações */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAlteracoesModal(true)}
                    disabled={processingAceite}
                    className="text-xs font-semibold text-purple-700 border-purple-300 hover:bg-purple-50 justify-center"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Solicitar Alterações
                  </Button>

                  {/* Botão Recusar Proposta (com trava de segurança) */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRecusaModal(true)}
                    disabled={processingAceite}
                    className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold justify-center"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Recusar Proposta
                  </Button>

                  {/* Botão Aceitar Proposta (redirecionamento direto pós-aceite sem etapas intermediárias) */}
                  <Button
                    type="button"
                    onClick={handleConfirmarAceiteDireto}
                    disabled={processingAceite || !declaracaoAceite}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 shadow-sm justify-center disabled:opacity-50"
                  >
                    {processingAceite ? (
                      <Loader2 className="w-4 h-4 mr-1.5 shrink-0 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1.5 shrink-0" />
                    )}
                    Aceitar Proposta
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. MODAL SOLICITAR ALTERAÇÕES PELO CLIENTE */}
      <Dialog open={showAlteracoesModal} onOpenChange={setShowAlteracoesModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-purple-800">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              Solicitar Ajustes na Proposta {proposta.numero}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Descreva detalhadamente o que você gostaria de ajustar (escopo, prazos, parcelamento
              ou valores). Nossa equipe técnica reavaliará a proposta para emissão de uma nova
              versão.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSolicitarAlteracoes} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-800">
                Descrição dos ajustes ou esclarecimentos desejados *
              </Label>
              <Textarea
                required
                rows={4}
                value={textoAlteracoes}
                onChange={(e) => setTextoAlteracoes(e.target.value)}
                placeholder="Exemplo: Gostaríamos de incluir o projeto hidrossanitário e negociar o parcelamento em 4 vezes..."
                className="text-xs mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAlteracoesModal(false)}
                disabled={submittingAlteracoes}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingAlteracoes || !textoAlteracoes.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submittingAlteracoes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : null}
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. MODAL DE RECUSA COM TRAVA DE SEGURANÇA OBRIGATÓRIA */}
      <Dialog open={showRecusaModal} onOpenChange={setShowRecusaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmação de Recusa da Proposta {proposta.numero}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Para evitar cliques indevidos, a recusa exige confirmação expressa e a seleção do
              motivo principal.
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

            {/* TRAVA DE SEGURANÇA OBRIGATÓRIA */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
              <Checkbox
                id="chk-trava-recusa"
                checked={confirmacaoTravaRecusa}
                onCheckedChange={(c) => setConfirmacaoTravaRecusa(c === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="chk-trava-recusa"
                className="text-[11px] text-red-900 leading-snug cursor-pointer select-none font-medium"
              >
                Confirmo que desejo registrar a recusa formal desta proposta comercial, ciente de
                que ela não poderá mais ser aceita.
              </label>
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
                disabled={submittingRecusa || !motivoSelecionado || !confirmacaoTravaRecusa}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submittingRecusa ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Confirmar Recusa Definitiva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL VISUALIZAR MINUTA DO CONTRATO */}
      <Dialog open={showMinutaModal} onOpenChange={setShowMinutaModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-slate-900">
              <FileText className="w-5 h-5 text-blue-600" />
              Minuta do Contrato de Prestação de Serviços Técnicos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cláusulas padrão pré-contratuais que regerão a formalização após o aceite eletrônico
              da Proposta {proposta.numero}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs text-slate-700">
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-[11px] space-y-1">
              <div>
                <strong>Contratada:</strong> G+ Engenharia Consultiva
              </div>
              <div>
                <strong>Contratante:</strong>{' '}
                {proposta.expand?.empresa?.razao_social ||
                  proposta.expand?.cliente_pf?.nome ||
                  ((proposta as any).cliente_pf_dados && (proposta as any).cliente_pf_dados.nome) ||
                  'Cliente Titular'}
              </div>
              <div>
                <strong>CPF/CNPJ:</strong>{' '}
                {proposta.expand?.empresa?.cnpj ||
                  proposta.expand?.cliente_pf?.cpf ||
                  ((proposta as any).cliente_pf_dados && (proposta as any).cliente_pf_dados.cpf) ||
                  'Documento não informado'}
              </div>
              <div>
                <strong>Valor Global Proposto:</strong> {formatCurrencyBr(proposta.preco)}
              </div>
              <div>
                <strong>Prazo Estimado:</strong> {proposta.prazo || '30 dias'}
              </div>
              {proposta.condicoes_pagamento && (
                <div>
                  <strong>Condições de Pagamento:</strong>{' '}
                  {normalizarCondicoesPagamento(proposta.condicoes_pagamento)}
                </div>
              )}
            </div>

            <div className="bg-white border rounded-lg p-4 font-sans text-xs whitespace-pre-wrap leading-relaxed text-slate-800 max-h-[45vh] overflow-y-auto">
              {loadingMinuta ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                </div>
              ) : (
                clausulasMinuta
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMinutaModal(false)}
            >
              Fechar Minuta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default PropostaPublicaPage
