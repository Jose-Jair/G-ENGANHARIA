import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GPlusLogo } from '@/components/GPlusLogo'
import { recrutamentoService } from '@/services/prestadores'
import {
  PortfolioItem,
  PrecoReferenciaItem,
  DisponibilidadeItem,
  PreCadastroPublicoPayload,
} from '@/types'

export const PreCadastroPublicoPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()

  // Estado do Link de Recrutamento
  const [carregandoLink, setCarregandoLink] = useState(true)
  const [linkInvalido, setLinkInvalido] = useState<string | null>(null)
  const [disciplinaAlvoLink, setDisciplinaAlvoLink] = useState<string>('')
  const [tituloLink, setTituloLink] = useState<string>('')

  // Etapa atual (1: Identificação, 2: Disciplinas/Softwares/Capacidade, 3: Portfólio, 4: Preços/Disponibilidade/Aceite)
  const [etapa, setEtapa] = useState<1 | 2 | 3 | 4>(1)

  // Submissão
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null)

  // Campos Anti-Spam / Honeypot (escondidos da visão do usuário comum)
  const [websiteHp, setWebsiteHp] = useState('')
  const [honeypotVal, setHoneypotVal] = useState('')
  const [hpCampo, setHpCampo] = useState('')

  // (a) ETAPA 1: Identificação e Conselho
  const [tipo, setTipo] = useState<'pf_externo' | 'pj_externo'>('pf_externo')
  const [nome, setNome] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [conselho, setConselho] = useState('CREA')
  const [numeroRegistroConselho, setNumeroRegistroConselho] = useState('')
  const [validadeRegistroConselho, setValidadeRegistroConselho] = useState('')
  const [regiao, setRegiao] = useState('')

  // (b) ETAPA 2: Disciplinas, softwares e capacidade
  const [disciplinas, setDisciplinas] = useState('')
  const [softwares, setSoftwares] = useState('')
  const [capacidadeSimultanea, setCapacidadeSimultanea] = useState<number>(3)

  // (c) ETAPA 3: Portfólio (até 5 itens)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([
    {
      titulo: '',
      descricao: '',
      cliente_referencia: '',
      ano: new Date().getFullYear(),
      disciplina: '',
      link_url: '',
    },
  ])

  // (d) ETAPA 4: Preços de referência, disponibilidade e aceite
  const [precosReferencia, setPrecosReferencia] = useState<PrecoReferenciaItem[]>([
    { disciplina: '', unidade: 'hora', valor_referencia: undefined, observacoes: '' },
  ])
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeItem>({
    horas_semana: 20,
    inicio_disponivel: 'imediato',
    dias_uteis: true,
    finais_semana: false,
    observacoes: '',
  })
  const [aceiteTermos, setAceiteTermos] = useState(false)

  // Carregar dados preliminares do link pelo slug (ou validar existência)
  useEffect(() => {
    let ativo = true
    const verificarLink = async () => {
      if (!slug) {
        setLinkInvalido('Identificador de link de recrutamento não informado.')
        setCarregandoLink(false)
        return
      }

      try {
        setCarregandoLink(true)
        const link = await recrutamentoService.getLinkBySlug(slug)
        if (!ativo) return

        if (!link) {
          setLinkInvalido('O link de recrutamento informado não foi localizado ou não existe.')
        } else if (!link.ativo) {
          setLinkInvalido(
            'Este link de recrutamento foi desativado temporariamente pela G+ Engenharia.',
          )
        } else if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) {
          setLinkInvalido(
            'Este link de recrutamento expirou. Entre em contato com a equipe G+ Engenharia para solicitar um novo link.',
          )
        } else {
          setTituloLink(link.titulo || 'Banco de Talentos e Especialistas')
          if (link.disciplina_alvo) {
            setDisciplinaAlvoLink(link.disciplina_alvo)
            setDisciplinas((prev) => prev || link.disciplina_alvo || '')
          }
        }
      } catch (e: any) {
        // Se a coleção não tiver acesso leitura pública, o POST ainda valida o slug no backend.
        // Permitimos prosseguir assumindo o slug informado.
        setTituloLink('Banco de Talentos e Especialistas')
      } finally {
        if (ativo) setCarregandoLink(false)
      }
    }

    verificarLink()
    return () => {
      ativo = false
    }
  }, [slug])

  // Helpers de Portfólio
  const adicionarItemPortfolio = () => {
    if (portfolio.length >= 5) return
    setPortfolio([
      ...portfolio,
      {
        titulo: '',
        descricao: '',
        cliente_referencia: '',
        ano: new Date().getFullYear(),
        disciplina: '',
        link_url: '',
      },
    ])
  }

  const removerItemPortfolio = (index: number) => {
    if (portfolio.length <= 1) {
      setPortfolio([
        {
          titulo: '',
          descricao: '',
          cliente_referencia: '',
          ano: new Date().getFullYear(),
          disciplina: '',
          link_url: '',
        },
      ])
      return
    }
    setPortfolio(portfolio.filter((_, i) => i !== index))
  }

  const atualizarItemPortfolio = (index: number, campo: keyof PortfolioItem, valor: any) => {
    const novo = [...portfolio]
    novo[index] = { ...novo[index], [campo]: valor }
    setPortfolio(novo)
  }

  // Helpers de Preço de Referência
  const adicionarPrecoReferencia = () => {
    if (precosReferencia.length >= 8) return
    setPrecosReferencia([
      ...precosReferencia,
      { disciplina: '', unidade: 'hora', valor_referencia: undefined, observacoes: '' },
    ])
  }

  const removerPrecoReferencia = (index: number) => {
    if (precosReferencia.length <= 1) {
      setPrecosReferencia([
        { disciplina: '', unidade: 'hora', valor_referencia: undefined, observacoes: '' },
      ])
      return
    }
    setPrecosReferencia(precosReferencia.filter((_, i) => i !== index))
  }

  const atualizarPrecoReferencia = (
    index: number,
    campo: keyof PrecoReferenciaItem,
    valor: any,
  ) => {
    const novo = [...precosReferencia]
    novo[index] = { ...novo[index], [campo]: valor }
    setPrecosReferencia(novo)
  }

  // Formatação de CPF/CNPJ
  const formatarCpfCnpj = (val: string) => {
    const limpo = val.replace(/\D/g, '')
    if (limpo.length <= 11) {
      return limpo
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14)
    }
    return limpo
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .slice(0, 18)
  }

  // Validação por Etapa
  const validarEtapa1 = () => {
    if (!nome.trim()) return 'Informe o nome completo ou razão social.'
    if (!email.trim() || !email.includes('@')) return 'Informe um e-mail válido para contato.'
    const digitos = cpfCnpj.replace(/\D/g, '')
    if (tipo === 'pf_externo' && digitos.length !== 11)
      return 'CPF deve conter 11 dígitos numéricos.'
    if (tipo === 'pj_externo' && digitos.length !== 14)
      return 'CNPJ deve conter 14 dígitos numéricos.'
    return null
  }

  const validarEtapa2 = () => {
    if (!disciplinas.trim()) return 'Indique pelo menos uma disciplina técnica de atuação.'
    return null
  }

  const validarEtapa4 = () => {
    if (!aceiteTermos)
      return 'É obrigatório declarar o aceite dos termos de pré-cadastro e confidencialidade.'
    return null
  }

  const avancarEtapa = () => {
    setErroSubmissao(null)
    if (etapa === 1) {
      const err = validarEtapa1()
      if (err) {
        setErroSubmissao(err)
        return
      }
      setEtapa(2)
    } else if (etapa === 2) {
      const err = validarEtapa2()
      if (err) {
        setErroSubmissao(err)
        return
      }
      setEtapa(3)
    } else if (etapa === 3) {
      setEtapa(4)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const voltarEtapa = () => {
    setErroSubmissao(null)
    if (etapa > 1) {
      setEtapa((etapa - 1) as 1 | 2 | 3 | 4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Submissão Final
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroSubmissao(null)

    const err4 = validarEtapa4()
    if (err4) {
      setErroSubmissao(err4)
      return
    }

    if (!slug) {
      setErroSubmissao('Slug de recrutamento inválido.')
      return
    }

    setEnviando(true)
    try {
      // Filtrar itens de portfólio válidos (com título)
      const portfolioValido = portfolio.filter(
        (item) => item.titulo && item.titulo.trim().length > 0,
      )
      // Filtrar preços com disciplina
      const precosValidos = precosReferencia.filter(
        (p) => p.disciplina && p.disciplina.trim().length > 0,
      )

      const payload: PreCadastroPublicoPayload = {
        nome: nome.trim(),
        tipo,
        email: email.trim().toLowerCase(),
        cpf_cnpj: cpfCnpj.trim(),
        telefone: telefone.trim(),
        conselho: conselho.trim(),
        conselho_classe: conselho.trim(),
        numero_registro_conselho: numeroRegistroConselho.trim(),
        validade_registro_conselho: validadeRegistroConselho || undefined,
        disciplinas: disciplinas.trim(),
        regiao: regiao.trim(),
        softwares: softwares.trim(),
        portfolio_json: portfolioValido,
        preco_referencia_json: precosValidos,
        disponibilidade_json: disponibilidade,
        aceite_termos: true,
        // Honeypot fields
        website: websiteHp,
        honeypot: honeypotVal,
        hp_campo: hpCampo,
      }

      await recrutamentoService.submeterPreCadastro(slug, payload)
      setConcluido(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      const msg =
        err.data?.error || err.message || 'Falha ao processar pré-cadastro. Tente novamente.'
      setErroSubmissao(msg)
    } finally {
      setEnviando(false)
    }
  }

  // Carregamento inicial do link
  if (carregandoLink) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B] mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Carregando portal de credenciamento...
          </p>
        </div>
      </div>
    )
  }

  // Link Inválido ou Expirado
  if (linkInvalido) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">Link Indisponível</CardTitle>
            <CardDescription className="text-xs text-slate-600 mt-1">
              {linkInvalido}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-2 pb-6 text-xs text-slate-500 space-y-3">
            <p>
              Caso tenha interesse em prestar serviços técnicos de engenharia para a G+ Engenharia,
              entre em contato com nossa equipe gestora para solicitar um link de recrutamento
              ativo.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              G+ Engenharia Consultiva • Conectando ideias, somando resultados
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // TELA FINAL DE CONCLUSÃO: Sem links para o sistema interno (Critério de Aceite 1)
  if (concluido) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center space-y-6">
          <div className="flex justify-center">
            <GPlusLogo size="medium" />
          </div>

          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              Pré-Cadastro Recebido com Sucesso
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2A4A]">
              Obrigado pelo seu interesse em integrar a Rede G+!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Suas informações técnicas, portfólio e referências foram registradas com sucesso e
              encaminhadas para a equipe de Engenharia e Gestão de Projetos da{' '}
              <strong>G+ Engenharia</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D95A2B]" />
              Próximos passos da Triagem Técnica:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-[12px]">
              <li>
                Nossa equipe técnica avaliará seu perfil e alinhamento com as demandas operacionais
                vigentes.
              </li>
              <li>
                Você receberá atualizações no e-mail informado (<strong>{email}</strong>).
              </li>
              <li>
                Caso pré-aprovado, você será notificado para envio dos documentos comprobatórios e
                formalização do Contrato-Mestre.
              </li>
            </ul>
          </div>

          <div className="text-[11px] text-slate-400 pt-4 border-t border-slate-100">
            G+ Engenharia Consultiva • Todos os direitos reservados.
            <div className="text-[10px] text-slate-400 mt-0.5">
              Você já pode fechar esta aba do seu navegador com segurança.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // FORMULÁRIO PÚBLICO EM 4 ETAPAS
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-8 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <div className="bg-[#1E2A4A] text-white p-6 rounded-2xl shadow-md border-b-4 border-[#D95A2B] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-xs">
              <GPlusLogo size="small" />
            </div>
            <div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#D95A2B] text-white rounded">
                Credenciamento Técnico
              </span>
              <h1 className="text-lg sm:text-xl font-bold mt-0.5">{tituloLink}</h1>
              {disciplinaAlvoLink && (
                <p className="text-xs text-slate-300">
                  Foco em: <strong className="text-orange-300">{disciplinaAlvoLink}</strong>
                </p>
              )}
            </div>
          </div>

          <Badge
            variant="outline"
            className="border-white/20 text-white text-[11px] bg-white/10 shrink-0"
          >
            Formulário Oficial G+
          </Badge>
        </div>

        {/* INDICADOR DE ETAPAS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div
              className={`p-2 rounded-lg border transition-all ${
                etapa === 1
                  ? 'border-[#D95A2B] bg-orange-50 text-[#D95A2B] font-bold'
                  : etapa > 1
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Etapa 1</div>
              <div className="text-xs truncate">Identificação</div>
            </div>

            <div
              className={`p-2 rounded-lg border transition-all ${
                etapa === 2
                  ? 'border-[#D95A2B] bg-orange-50 text-[#D95A2B] font-bold'
                  : etapa > 2
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Etapa 2</div>
              <div className="text-xs truncate">Especialidades</div>
            </div>

            <div
              className={`p-2 rounded-lg border transition-all ${
                etapa === 3
                  ? 'border-[#D95A2B] bg-orange-50 text-[#D95A2B] font-bold'
                  : etapa > 3
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Etapa 3</div>
              <div className="text-xs truncate">Portfólio</div>
            </div>

            <div
              className={`p-2 rounded-lg border transition-all ${
                etapa === 4
                  ? 'border-[#D95A2B] bg-orange-50 text-[#D95A2B] font-bold'
                  : 'border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">Etapa 4</div>
              <div className="text-xs truncate">Preços & Aceite</div>
            </div>
          </div>
        </div>

        {/* ALERTA DE ERRO */}
        {erroSubmissao && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erroSubmissao}</span>
          </div>
        )}

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CAMPOS HONEYPOT OCULTOS (Critério Anti-Spam Backend) */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={websiteHp}
              onChange={(e) => setWebsiteHp(e.target.value)}
            />
            <label htmlFor="honeypot">Honeypot</label>
            <input
              id="honeypot"
              name="honeypot"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypotVal}
              onChange={(e) => setHoneypotVal(e.target.value)}
            />
            <label htmlFor="hp_campo">HP Campo</label>
            <input
              id="hp_campo"
              name="hp_campo"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hpCampo}
              onChange={(e) => setHpCampo(e.target.value)}
            />
          </div>

          {/* (a) ETAPA 1: Identificação e Conselho */}
          {etapa === 1 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#D95A2B]" />
                  1. Identificação Básica e Registro Profissional
                </CardTitle>
                <CardDescription className="text-xs">
                  Informe seus dados cadastrais e registro no conselho de classe de
                  engenharia/arquitetura.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Modalidade de Prestação *
                    </Label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => setTipo('pf_externo')}
                        className={`p-3 text-xs rounded-lg border text-left transition-all ${
                          tipo === 'pf_externo'
                            ? 'border-[#D95A2B] bg-orange-50/50 text-[#D95A2B] font-bold shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Pessoa Física (Autônomo / Consultor)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipo('pj_externo')}
                        className={`p-3 text-xs rounded-lg border text-left transition-all ${
                          tipo === 'pj_externo'
                            ? 'border-[#D95A2B] bg-orange-50/50 text-[#D95A2B] font-bold shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Pessoa Jurídica (Empresa Especializada)
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      {tipo === 'pj_externo'
                        ? 'Razão Social ou Nome Fantasia *'
                        : 'Nome Completo *'}
                    </Label>
                    <Input
                      placeholder={
                        tipo === 'pj_externo'
                          ? 'Ex: Alfa Engenharia Projetos Ltda'
                          : 'Ex: João Carlos da Silva'
                      }
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      {tipo === 'pj_externo' ? 'CNPJ *' : 'CPF *'}
                    </Label>
                    <Input
                      placeholder={tipo === 'pj_externo' ? '00.000.000/0000-00' : '000.000.000-00'}
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatarCpfCnpj(e.target.value))}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      E-mail de Contato Principal *
                    </Label>
                    <Input
                      type="email"
                      placeholder="seu.email@exemplo.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Telefone / WhatsApp
                    </Label>
                    <Input
                      placeholder="(88) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Região Principal de Atuação
                    </Label>
                    <Input
                      placeholder="Ex: Ceará, Nordeste ou Todo o Brasil (Remoto)"
                      value={regiao}
                      onChange={(e) => setRegiao(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Conselho de Classe
                    </Label>
                    <Select value={conselho} onValueChange={setConselho}>
                      <SelectTrigger className="text-xs mt-1">
                        <SelectValue placeholder="Selecione o conselho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREA">CREA (Engenharia e Agronomia)</SelectItem>
                        <SelectItem value="CAU">CAU (Arquitetura e Urbanismo)</SelectItem>
                        <SelectItem value="CFT">CFT (Técnicos Industriais)</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Número do Registro no Conselho
                    </Label>
                    <Input
                      placeholder="Ex: CREA-CE 123456/D"
                      value={numeroRegistroConselho}
                      onChange={(e) => setNumeroRegistroConselho(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Validade do Registro (Opcional)
                    </Label>
                    <Input
                      type="date"
                      value={validadeRegistroConselho}
                      onChange={(e) => setValidadeRegistroConselho(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* (b) ETAPA 2: Disciplinas, softwares e capacidade */}
          {etapa === 2 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D95A2B]" />
                  2. Especialidades, Ferramentas e Capacidade
                </CardTitle>
                <CardDescription className="text-xs">
                  Detalhe suas disciplinas de atuação técnica, softwares utilizados e estimativa de
                  carga operacional.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Disciplinas Técnicas de Atuação *
                    </Label>
                    <Textarea
                      placeholder="Ex: Estrutural (Concreto Armado e Metálica), Instalações Hidrossanitárias, Elétrica em Baixa Tensão, Prevenção Contra Incêndio (AVCB), Orçamento e Planejamento..."
                      value={disciplinas}
                      onChange={(e) => setDisciplinas(e.target.value)}
                      className="text-xs mt-1 min-h-[90px]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Separe por vírgulas ou linhas para facilitar o match com novas demandas da G+.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Softwares e Tecnologias de Projeto Dominadas
                    </Label>
                    <Input
                      placeholder="Ex: Revit (BIM), Eberick, TQS, AutoCAD, MS Project, Navisworks, SketchUp..."
                      value={softwares}
                      onChange={(e) => setSoftwares(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Capacidade Estimada de Demandas Simultâneas
                    </Label>
                    <Select
                      value={String(capacidadeSimultanea)}
                      onValueChange={(val) => setCapacidadeSimultanea(parseInt(val, 10))}
                    >
                      <SelectTrigger className="text-xs mt-1 max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 projeto por vez (Dedicação pontual)</SelectItem>
                        <SelectItem value="2">2 projetos simultâneos</SelectItem>
                        <SelectItem value="3">3 projetos simultâneos (Padrão)</SelectItem>
                        <SelectItem value="5">5 projetos simultâneos (Média capacidade)</SelectItem>
                        <SelectItem value="10">Mais de 5 projetos (Equipe estruturada)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* (c) ETAPA 3: Portfólio (até 5 itens e links) */}
          {etapa === 3 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D95A2B]" />
                    3. Portfólio de Referência (Até 5 Projetos)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Adicione os principais trabalhos já executados para demonstrar sua experiência
                    técnica.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={adicionarItemPortfolio}
                  disabled={portfolio.length >= 5}
                  className="text-xs border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar ({portfolio.length}/5)
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {portfolio.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Item #{idx + 1} de Referência
                      </span>
                      {portfolio.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removerItemPortfolio(idx)}
                          className="h-6 w-6 text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] text-slate-600">
                          Título do Trabalho / Obra *
                        </Label>
                        <Input
                          placeholder="Ex: Projeto Estrutural de Edifício Residencial 12 Pavimentos"
                          value={item.titulo}
                          onChange={(e) => atualizarItemPortfolio(idx, 'titulo', e.target.value)}
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-slate-600">Cliente ou Contratante</Label>
                        <Input
                          placeholder="Ex: Construtora XYZ ou Particular"
                          value={item.cliente_referencia || ''}
                          onChange={(e) =>
                            atualizarItemPortfolio(idx, 'cliente_referencia', e.target.value)
                          }
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-slate-600">Ano de Conclusão</Label>
                        <Input
                          placeholder="Ex: 2024"
                          value={item.ano || ''}
                          onChange={(e) => atualizarItemPortfolio(idx, 'ano', e.target.value)}
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-slate-600">Disciplina Aplicada</Label>
                        <Input
                          placeholder="Ex: Cálculo Estrutural / Concreto Armado"
                          value={item.disciplina || ''}
                          onChange={(e) =>
                            atualizarItemPortfolio(idx, 'disciplina', e.target.value)
                          }
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-slate-600">
                          Link Externo / Nuvem (Drive / Behance / PDF)
                        </Label>
                        <Input
                          placeholder="https://drive.google.com/..."
                          value={item.link_url || ''}
                          onChange={(e) => atualizarItemPortfolio(idx, 'link_url', e.target.value)}
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-[11px] text-slate-600">
                          Breve Descrição do Escopo
                        </Label>
                        <Textarea
                          placeholder="Descreva a complexidade técnica, área construída, desafios superados..."
                          value={item.descricao || ''}
                          onChange={(e) => atualizarItemPortfolio(idx, 'descricao', e.target.value)}
                          className="text-xs mt-0.5 bg-white min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* (d) ETAPA 4: Preços de referência, disponibilidade e aceite */}
          {etapa === 4 && (
            <Card className="border-slate-200 shadow-sm space-y-6">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#D95A2B]" />
                  4. Preços de Referência, Disponibilidade e Aceite
                </CardTitle>
                <CardDescription className="text-xs">
                  Defina suas referências de remuneração esperada, horários e concorde com os termos
                  da G+ Engenharia.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Preços de Referência */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Preços de Referência de Prestação
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Valores médios ou faixas para acelerar o envio de cotações nas oportunidades
                        certas.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={adicionarPrecoReferencia}
                      className="text-xs border-slate-300 text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Referência
                    </Button>
                  </div>

                  {precosReferencia.map((preco, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
                    >
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-slate-500">Disciplina / Serviço</Label>
                        <Input
                          placeholder="Ex: Projeto Elétrico Predial"
                          value={preco.disciplina}
                          onChange={(e) =>
                            atualizarPrecoReferencia(pIdx, 'disciplina', e.target.value)
                          }
                          className="text-xs mt-0.5 bg-white"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-slate-500">Unidade</Label>
                        <Select
                          value={preco.unidade}
                          onValueChange={(val) => atualizarPrecoReferencia(pIdx, 'unidade', val)}
                        >
                          <SelectTrigger className="text-xs mt-0.5 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hora">R$ / Hora</SelectItem>
                            <SelectItem value="m2">R$ / m² de projeto</SelectItem>
                            <SelectItem value="projeto">R$ / Escopo fechado</SelectItem>
                            <SelectItem value="item">R$ / Ponto ou Prancha</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex-1">
                          <Label className="text-[10px] text-slate-500">Valor Ref. (R$)</Label>
                          <Input
                            type="number"
                            placeholder="0,00"
                            value={preco.valor_referencia || ''}
                            onChange={(e) =>
                              atualizarPrecoReferencia(
                                pIdx,
                                'valor_referencia',
                                e.target.value ? parseFloat(e.target.value) : undefined,
                              )
                            }
                            className="text-xs mt-0.5 bg-white font-mono"
                          />
                        </div>
                        {precosReferencia.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removerPrecoReferencia(pIdx)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Disponibilidade */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900">Disponibilidade Operacional</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">
                        Horas Semanais Estimadas para a G+
                      </Label>
                      <Input
                        type="number"
                        placeholder="Ex: 20"
                        value={disponibilidade.horas_semana || ''}
                        onChange={(e) =>
                          setDisponibilidade({
                            ...disponibilidade,
                            horas_semana: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="text-xs mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-600">Início de Disponibilidade</Label>
                      <Select
                        value={disponibilidade.inicio_disponivel || 'imediato'}
                        onValueChange={(val) =>
                          setDisponibilidade({ ...disponibilidade, inicio_disponivel: val })
                        }
                      >
                        <SelectTrigger className="text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imediato">Disponibilidade Imediata</SelectItem>
                          <SelectItem value="15_dias">Em até 15 dias</SelectItem>
                          <SelectItem value="30_dias">Em até 30 dias</SelectItem>
                          <SelectItem value="sob_consulta">A combinar por demanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs text-slate-600">
                        Observações de Horários / Restrições
                      </Label>
                      <Input
                        placeholder="Ex: Atendimento preferencialmente no turno da manhã ou comercial..."
                        value={disponibilidade.observacoes || ''}
                        onChange={(e) =>
                          setDisponibilidade({ ...disponibilidade, observacoes: e.target.value })
                        }
                        className="text-xs mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Aceite dos Termos de Uso e LGPD */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-2">
                    <div className="flex items-center gap-2 text-orange-300 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      Declaração de Veracidade e Sigilo Profissional
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Ao enviar este pré-cadastro, declaro sob as penas da lei que todas as
                      informações e dados técnicos aqui prestados são verídicos, respondendo pela
                      veracidade de registros nos órgãos competentes e autorizando a G+ Engenharia a
                      tratar meus dados cadastrais exclusivamente para fins de credenciamento,
                      cotações e eventual contratação de serviços técnicos, nos moldes da LGPD (Lei
                      nº 13.709/2018).
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={aceiteTermos}
                      onChange={(e) => setAceiteTermos(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-[#D95A2B] focus:ring-[#D95A2B] h-4 w-4"
                    />
                    <span className="text-xs text-slate-700 leading-snug">
                      <strong>Concordo com os termos acima</strong> e solicito a avaliação do meu
                      pré-cadastro técnico pela equipe de triagem da G+ Engenharia.
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BARRA DE NAVEGAÇÃO / BOTÕES INFERIORES */}
          <div className="flex items-center justify-between pt-2">
            {etapa > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={voltarEtapa}
                disabled={enviando}
                className="text-xs text-slate-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar Etapa
              </Button>
            ) : (
              <div />
            )}

            {etapa < 4 ? (
              <Button
                type="button"
                onClick={avancarEtapa}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs font-bold px-5"
              >
                Próxima Etapa
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={enviando || !aceiteTermos}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 shadow-md"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Enviando Pré-Cadastro...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Concluir e Enviar Pré-Cadastro
                  </>
                )}
              </Button>
            )}
          </div>
        </form>

        {/* RODAPÉ INFORMATIVO */}
        <div className="text-center text-[11px] text-slate-400 pt-6">
          G+ Engenharia Consultiva • Conectando ideias, somando resultados
        </div>
      </div>
    </div>
  )
}

export default PreCadastroPublicoPage
