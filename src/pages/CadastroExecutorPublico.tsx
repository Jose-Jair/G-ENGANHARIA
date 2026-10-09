import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  executoresService,
  ObterExecutorTokenResponse,
  SubmeterCadastroTokenData,
} from '@/services/executores'
import { areasAtuacaoService } from '@/services/areasAtuacao'
import { AreaAtuacaoRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { GPlusLogo } from '@/components/GPlusLogo'
import {
  cleanCnpj,
  formatCnpj,
  isValidCnpj,
  cleanCpf,
  formatCpf,
  isValidCpf,
  formatPhoneBr,
} from '@/lib/cnpj'
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardHat,
  Building2,
  User,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
  Phone,
  HelpCircle,
} from 'lucide-react'

export const CadastroExecutorPublicoPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { toast } = useToast()

  // Estados de carregamento e validação do token
  const [validandoToken, setValidandoToken] = useState(true)
  const [tokenValido, setTokenValido] = useState(false)
  const [tokenErro, setTokenErro] = useState('')
  const [areasAtuacao, setAreasAtuacao] = useState<AreaAtuacaoRecord[]>([])

  // Etapas do formulário (1: Identificação & Conselho, 2: Disciplinas & Capacidade, 3: Dados Bancários & Envio)
  const [etapaAtual, setEtapaAtual] = useState<1 | 2 | 3>(1)
  const [submetendo, setSubmetendo] = useState(false)
  const [submetidoSucesso, setSubmetidoSucesso] = useState(false)

  // Campos do formulário
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [conselhoClasse, setConselhoClasse] = useState<'CREA' | 'CAU' | 'CFT' | 'OUTRO'>('CREA')
  const [numeroRegistro, setNumeroRegistro] = useState('')
  const [validadeRegistro, setValidadeRegistro] = useState('')
  const [disciplinasSelecionadas, setDisciplinasSelecionadas] = useState<string[]>([])
  const [outrasDisciplinas, setOutrasDisciplinas] = useState('')
  const [regiao, setRegiao] = useState('')
  const [capacidadeSimultanea, setCapacidadeSimultanea] = useState<number>(3)

  // Dados Bancários estruturados
  const [bancoNome, setBancoNome] = useState('')
  const [tipoChavePix, setTipoChavePix] = useState('cnpj_cpf')
  const [chavePix, setChavePix] = useState('')
  const [agencia, setAgencia] = useState('')
  const [contaCorrente, setContaCorrente] = useState('')
  const [titularConta, setTitularConta] = useState('')

  // Validar token ao montar tela
  useEffect(() => {
    if (!token) {
      setValidandoToken(false)
      setTokenValido(false)
      setTokenErro('Token de convite não encontrado na URL. Utilize o link enviado por e-mail.')
      return
    }

    const carregarTudo = async () => {
      setValidandoToken(true)
      try {
        const [tokenResp, areasResp] = await Promise.all([
          executoresService.obterPorTokenCadastro(token),
          areasAtuacaoService.listAtivas().catch(() => []),
        ])

        if (!tokenResp.valido || !tokenResp.executor) {
          setTokenValido(false)
          setTokenErro(tokenResp.error || 'Convite inválido ou expirado.')
          return
        }

        setAreasAtuacao(areasResp)
        setTokenValido(true)

        // Pré-preencher dados já existentes
        const ex = tokenResp.executor
        setNome(ex.nome || '')
        setEmail(ex.email || '')
        setTipo(ex.tipo === 'PJ' ? 'PJ' : 'PF')
        if (ex.cpf_cnpj) setCpfCnpj(ex.cpf_cnpj)
        if (ex.telefone) setTelefone(ex.telefone)
        if (ex.conselho) {
          const c = ex.conselho.toUpperCase()
          if (c.includes('CAU')) setConselhoClasse('CAU')
          else if (c.includes('CFT')) setConselhoClasse('CFT')
          else if (c.includes('CREA')) setConselhoClasse('CREA')
          else setConselhoClasse('OUTRO')
        }
        if (ex.numero_registro) setNumeroRegistro(ex.numero_registro)
        if (ex.conselho_validade) {
          setValidadeRegistro(ex.conselho_validade.slice(0, 10))
        }
        if (ex.regiao) setRegiao(ex.regiao)
        if (ex.capacidade_simultanea) setCapacidadeSimultanea(ex.capacidade_simultanea)

        // Se já havia disciplinas
        if (ex.disciplinas) {
          const partes = ex.disciplinas
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          setDisciplinasSelecionadas(partes)
        }
      } catch (err: any) {
        setTokenValido(false)
        setTokenErro(err.message || 'Falha ao validar o convite.')
      } finally {
        setValidandoToken(false)
      }
    }

    carregarTudo()
  }, [token])

  // Formatar CPF/CNPJ dinamicamente
  const handleCpfCnpjChange = (val: string) => {
    if (tipo === 'PJ') {
      setCpfCnpj(formatCnpj(val))
    } else {
      setCpfCnpj(formatCpf(val))
    }
  }

  const handleTelefoneChange = (val: string) => {
    setTelefone(formatPhoneBr(val))
  }

  // Toggle disciplina
  const toggleDisciplina = (nomeArea: string) => {
    setDisciplinasSelecionadas((prev) => {
      if (prev.includes(nomeArea)) {
        return prev.filter((d) => d !== nomeArea)
      } else {
        return [...prev, nomeArea]
      }
    })
  }

  // Validação da Etapa 1
  const validarEtapa1 = () => {
    if (!nome.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe seu nome completo ou razão social.',
        variant: 'destructive',
      })
      return false
    }

    const docLimpo = tipo === 'PJ' ? cleanCnpj(cpfCnpj) : cleanCpf(cpfCnpj)
    if (!docLimpo) {
      toast({
        title: 'Atenção',
        description: `Informe o ${tipo === 'PJ' ? 'CNPJ' : 'CPF'}.`,
        variant: 'destructive',
      })
      return false
    }

    if (tipo === 'PJ' && !isValidCnpj(docLimpo)) {
      toast({
        title: 'CNPJ inválido',
        description: 'Por favor confira os dígitos do CNPJ informado.',
        variant: 'destructive',
      })
      return false
    }
    if (tipo === 'PF' && !isValidCpf(docLimpo)) {
      toast({
        title: 'CPF inválido',
        description: 'Por favor confira os dígitos do CPF informado.',
        variant: 'destructive',
      })
      return false
    }

    if (!numeroRegistro.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o número de registro no Conselho (CREA / CAU / CFT).',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Validação da Etapa 2
  const validarEtapa2 = () => {
    const totalDisciplinas = [...disciplinasSelecionadas]
    if (outrasDisciplinas.trim()) {
      outrasDisciplinas.split(',').forEach((d) => {
        if (d.trim() && !totalDisciplinas.includes(d.trim())) {
          totalDisciplinas.push(d.trim())
        }
      })
    }

    if (totalDisciplinas.length === 0) {
      toast({
        title: 'Selecione suas especialidades',
        description:
          'Selecione ao menos 1 disciplina de atuação ou informe nas outras especialidades.',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Submeter cadastro completo
  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarEtapa1() || !validarEtapa2()) return

    setSubmetendo(true)
    try {
      // Consolidar disciplinas
      const totalDisciplinas = [...disciplinasSelecionadas]
      if (outrasDisciplinas.trim()) {
        outrasDisciplinas.split(',').forEach((d) => {
          if (d.trim() && !totalDisciplinas.includes(d.trim())) {
            totalDisciplinas.push(d.trim())
          }
        })
      }

      // Consolidar dados bancários
      const dadosBancariosObj = {
        banco: bancoNome.trim(),
        agencia: agencia.trim(),
        conta: contaCorrente.trim(),
        titular: titularConta.trim() || nome.trim(),
        chave_pix_tipo: tipoChavePix,
        chave_pix: chavePix.trim(),
      }

      const payload: SubmeterCadastroTokenData = {
        token: token,
        nome: nome.trim(),
        tipo: tipo,
        cpf_cnpj: cpfCnpj.trim(),
        telefone: telefone.trim(),
        conselho_classe: conselhoClasse,
        numero_registro: numeroRegistro.trim(),
        validade_registro: validadeRegistro || undefined,
        disciplinas: totalDisciplinas.join(', '),
        regiao: regiao.trim() || 'Brasil (Nacional)',
        capacidade_simultanea: capacidadeSimultanea,
        dados_bancarios: dadosBancariosObj,
      }

      await executoresService.submeterCadastroToken(payload)

      setSubmetidoSucesso(true)
      toast({
        title: 'Cadastro recebido com sucesso!',
        description: 'Seus dados foram salvos e enviados para homologação da equipe G+ Engenharia.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar cadastro',
        description: err.message || 'Falha ao salvar dados de credenciamento.',
        variant: 'destructive',
      })
    } finally {
      setSubmetendo(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Topo Institucional G+ */}
      <header className="bg-[#1E2A4A] border-b-4 border-[#D95A2B] text-white py-4 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GPlusLogo className="h-8 w-auto text-white" />
            <div className="border-l border-slate-700 pl-3">
              <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                Portal de Credenciamento Técnico
              </h1>
              <p className="text-[11px] text-slate-300">
                Rede de Engenheiros e Empresas Especializadas — G+ Engenharia
              </p>
            </div>
          </div>
          <Badge className="bg-[#D95A2B] text-white text-[10px] font-bold tracking-wider uppercase border-0">
            Homologação
          </Badge>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 my-auto">
        {validandoToken ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D95A2B] mb-3" />
            <h2 className="text-base font-bold text-slate-800">
              Validando convite de credenciamento...
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verificando autenticidade e validade da chave de acesso seguro.
            </p>
          </div>
        ) : !tokenValido ? (
          <div className="bg-white border border-rose-200 rounded-xl p-8 sm:p-10 text-center shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Convite Inválido ou Expirado</h2>
              <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                {tokenErro ||
                  'Este link de credenciamento não é mais válido ou já foi utilizado para envio. Entre em contato com o gestor do seu projeto na G+ Engenharia para solicitar um novo convite.'}
              </p>
            </div>
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md font-mono">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Segurança: Verificação por token criptográfico
              </div>
            </div>
          </div>
        ) : submetidoSucesso ? (
          <div className="bg-white border border-emerald-200 rounded-xl p-8 sm:p-12 text-center shadow-sm space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <Badge className="bg-emerald-600 text-white text-xs uppercase tracking-wider font-semibold">
                Cadastro Recebido — Aguardando Homologação
              </Badge>
              <h2 className="text-xl font-bold text-slate-900">Obrigado, {nome}!</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Suas informações profissionais, especialidades técnicas e dados bancários foram
                registrados com sucesso no sistema da G+ Engenharia.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 text-left max-w-md mx-auto space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-[#D95A2B]" />
                O que acontece a seguir?
              </div>
              <p className="text-slate-600">
                1. A diretoria técnica da G+ Engenharia fará a homologação do seu registro de
                classe.
              </p>
              <p className="text-slate-600">
                2. Uma vez homologado, seu perfil passa a receber convites automáticos para cotações
                e etapas de projetos.
              </p>
              <p className="text-slate-600">
                3. Você receberá notificações no e-mail <strong>{email}</strong> sempre que houver
                uma nova demanda em suas disciplinas.
              </p>
            </div>

            <p className="text-[11px] text-slate-400">
              Você já pode fechar esta aba com segurança.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Barra de Progresso / Stepper */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6">
              <div className="flex items-center justify-between max-w-lg mx-auto">
                {/* Etapa 1 */}
                <div
                  className={`flex items-center gap-2 ${
                    etapaAtual === 1
                      ? 'text-[#D95A2B] font-bold'
                      : etapaAtual > 1
                        ? 'text-emerald-600 font-semibold'
                        : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      etapaAtual === 1
                        ? 'bg-[#D95A2B] text-white shadow-xs'
                        : etapaAtual > 1
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {etapaAtual > 1 ? '✓' : '1'}
                  </div>
                  <span className="text-xs hidden sm:inline">Identificação</span>
                </div>

                <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

                {/* Etapa 2 */}
                <div
                  className={`flex items-center gap-2 ${
                    etapaAtual === 2
                      ? 'text-[#D95A2B] font-bold'
                      : etapaAtual > 2
                        ? 'text-emerald-600 font-semibold'
                        : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      etapaAtual === 2
                        ? 'bg-[#D95A2B] text-white shadow-xs'
                        : etapaAtual > 2
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {etapaAtual > 2 ? '✓' : '2'}
                  </div>
                  <span className="text-xs hidden sm:inline">Disciplinas & Cap.</span>
                </div>

                <div className="flex-1 h-0.5 bg-slate-200 mx-2" />

                {/* Etapa 3 */}
                <div
                  className={`flex items-center gap-2 ${
                    etapaAtual === 3 ? 'text-[#D95A2B] font-bold' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      etapaAtual === 3
                        ? 'bg-[#D95A2B] text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    3
                  </div>
                  <span className="text-xs hidden sm:inline">Dados Bancários</span>
                </div>
              </div>
            </div>

            {/* Corpo do Formulário */}
            <form onSubmit={handleSubmitFinal} className="p-6 sm:p-8 space-y-6">
              {/* ETAPA 1: Identificação, Tipo, CPF/CNPJ, Conselho de Classe */}
              {etapaAtual === 1 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-[#D95A2B]" />
                      Dados Profissionais e Registro de Classe
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Informe seus dados cadastrais e as anotações do conselho profissional
                      regulador.
                    </p>
                  </div>

                  {/* Tipo: PF ou PJ */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">
                      Tipo de Atuação Profissional <span className="text-rose-600">*</span>
                    </Label>
                    <RadioGroup
                      value={tipo}
                      onValueChange={(val: 'PF' | 'PJ') => {
                        setTipo(val)
                        setCpfCnpj('')
                      }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <label
                        className={`flex items-center gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${
                          tipo === 'PF'
                            ? 'border-[#D95A2B] bg-orange-50/20 ring-1 ring-[#D95A2B]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <RadioGroupItem value="PF" id="tipo-pf" />
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" /> Pessoa Física (Autônomo)
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Engenheiro, arquiteto ou técnico autônomo (CPF).
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-3.5 border rounded-lg cursor-pointer transition-all ${
                          tipo === 'PJ'
                            ? 'border-[#D95A2B] bg-orange-50/20 ring-1 ring-[#D95A2B]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <RadioGroupItem value="PJ" id="tipo-pj" />
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" /> Pessoa Jurídica
                            (Empresa)
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Empresa de engenharia, projetos ou consultoria (CNPJ).
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                        {tipo === 'PJ' ? 'Razão Social / Nome da Empresa' : 'Nome Completo'}{' '}
                        <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder={
                          tipo === 'PJ'
                            ? 'Ex: Alpha Engenharia e Estruturas Ltda'
                            : 'Ex: Eng. Roberto Carlos de Paula'
                        }
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cpf-cnpj" className="text-xs font-semibold text-slate-700">
                        {tipo === 'PJ' ? 'CNPJ' : 'CPF'} <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="cpf-cnpj"
                        value={cpfCnpj}
                        onChange={(e) => handleCpfCnpjChange(e.target.value)}
                        placeholder={tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                        className="text-xs font-mono"
                        maxLength={tipo === 'PJ' ? 18 : 14}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="telefone" className="text-xs font-semibold text-slate-700">
                        Telefone / WhatsApp <span className="text-rose-600">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="telefone"
                          value={telefone}
                          onChange={(e) => handleTelefoneChange(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="text-xs pl-8 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Conselho Profissional */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#D95A2B]" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Registro no Conselho de Classe Profissional
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-700">
                          Conselho <span className="text-rose-600">*</span>
                        </Label>
                        <Select
                          value={conselhoClasse}
                          onValueChange={(val: any) => setConselhoClasse(val)}
                        >
                          <SelectTrigger className="text-xs h-9 bg-white">
                            <SelectValue placeholder="Selecione o conselho" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CREA">CREA (Engenharia e Agronomia)</SelectItem>
                            <SelectItem value="CAU">CAU (Arquitetura e Urbanismo)</SelectItem>
                            <SelectItem value="CFT">CFT / CRT (Técnicos Industriais)</SelectItem>
                            <SelectItem value="OUTRO">Outro Conselho Regulador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="numero-registro"
                          className="text-xs font-medium text-slate-700"
                        >
                          Número do Registro / RNP <span className="text-rose-600">*</span>
                        </Label>
                        <Input
                          id="numero-registro"
                          value={numeroRegistro}
                          onChange={(e) => setNumeroRegistro(e.target.value)}
                          placeholder="Ex: 506.123.456-SP"
                          className="text-xs font-mono bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="validade-registro"
                          className="text-xs font-medium text-slate-700"
                        >
                          Validade da Certidão / Anuidade
                        </Label>
                        <Input
                          id="validade-registro"
                          type="date"
                          value={validadeRegistro}
                          onChange={(e) => setValidadeRegistro(e.target.value)}
                          className="text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (validarEtapa1()) {
                          setEtapaAtual(2)
                        }
                      }}
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                    >
                      Avançar para Especialidades
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: Disciplinas / Áreas de Atuação & Capacidade Simultânea */}
              {etapaAtual === 2 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#D95A2B]" />
                      Disciplinas Técnicas & Capacidade de Atendimento
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Marque as áreas em que você atua para receber cotações compatíveis com suas
                      competências.
                    </p>
                  </div>

                  {/* Seleção de Disciplinas do Catálogo */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Especialidades / Áreas Técnicas <span className="text-rose-600">*</span>
                      </Label>
                      <span className="text-[11px] text-slate-400">
                        {disciplinasSelecionadas.length} selecionada(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                      {areasAtuacao.map((area) => {
                        const checked = disciplinasSelecionadas.includes(area.nome)
                        return (
                          <div
                            key={area.id}
                            onClick={() => toggleDisciplina(area.nome)}
                            className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all flex items-start gap-2 select-none ${
                              checked
                                ? 'bg-orange-50 border-[#D95A2B] text-slate-900 font-semibold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-[#D95A2B] focus:ring-[#D95A2B]"
                            />
                            <div className="leading-tight">
                              <div>{area.nome}</div>
                              {area.descricao && (
                                <p className="text-[10px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                                  {area.descricao}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Outras disciplinas livres */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="outras-disciplinas"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Outras Especialidades ou Softwares Específicos
                    </Label>
                    <Input
                      id="outras-disciplinas"
                      value={outrasDisciplinas}
                      onChange={(e) => setOutrasDisciplinas(e.target.value)}
                      placeholder="Ex: Revit MEP, TQS, AltoQi Eberick, Geotecnia, SPDA (separar por vírgula)"
                      className="text-xs"
                    />
                  </div>

                  {/* Região e Capacidade Simultânea */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="regiao" className="text-xs font-semibold text-slate-700">
                        Região / Estados de Atuação
                      </Label>
                      <Input
                        id="regiao"
                        value={regiao}
                        onChange={(e) => setRegiao(e.target.value)}
                        placeholder="Ex: São Paulo / Todo o Brasil / Sul e Sudeste"
                        className="text-xs"
                      />
                      <p className="text-[10px] text-slate-400">
                        Caso atenda remotamente a todo o país, informe "Todo o Brasil".
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="capacidade" className="text-xs font-semibold text-slate-700">
                        Capacidade de Projetos em Paralelo
                      </Label>
                      <Select
                        value={String(capacidadeSimultanea)}
                        onValueChange={(val) => setCapacidadeSimultanea(parseInt(val, 10))}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Selecione a capacidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 projeto por vez (Foco exclusivo)</SelectItem>
                          <SelectItem value="2">Até 2 projetos simultâneos</SelectItem>
                          <SelectItem value="3">Até 3 projetos simultâneos (Padrão)</SelectItem>
                          <SelectItem value="5">Até 5 projetos simultâneos</SelectItem>
                          <SelectItem value="10">
                            Mais de 5 projetos (Equipe estruturada)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-slate-400">
                        Auxilia nossos gestores a não sobrecarregar sua equipe técnica.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEtapaAtual(1)}
                      className="text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                      Voltar para Identificação
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (validarEtapa2()) {
                          setEtapaAtual(3)
                        }
                      }}
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
                    >
                      Avançar para Dados Bancários
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: Dados Bancários, PIX e Confirmação */}
              {etapaAtual === 3 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-[#D95A2B]" />
                      Dados Bancários para Remuneração e Subcontratos
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Estes dados alimentarão a geração dos seus subcontratos e as ordens de
                      pagamento financeiras.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="banco" className="text-xs font-semibold text-slate-700">
                          Banco / Instituição Financeira
                        </Label>
                        <Input
                          id="banco"
                          value={bancoNome}
                          onChange={(e) => setBancoNome(e.target.value)}
                          placeholder="Ex: Itaú (341), Nubank, Bradesco, Banco do Brasil..."
                          className="text-xs bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="titular-conta"
                          className="text-xs font-semibold text-slate-700"
                        >
                          Nome do Titular da Conta
                        </Label>
                        <Input
                          id="titular-conta"
                          value={titularConta}
                          onChange={(e) => setTitularConta(e.target.value)}
                          placeholder={nome || 'Nome completo do titular ou razão social'}
                          className="text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs font-medium text-slate-700">
                          Tipo de Chave PIX
                        </Label>
                        <Select value={tipoChavePix} onValueChange={setTipoChavePix}>
                          <SelectTrigger className="text-xs h-9 bg-white">
                            <SelectValue placeholder="Tipo de Chave" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cnpj_cpf">
                              {tipo === 'PJ' ? 'CNPJ' : 'CPF'}
                            </SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="telefone">Telefone Celular</SelectItem>
                            <SelectItem value="aleatoria">Chave Aleatória (EVP)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="chave-pix" className="text-xs font-semibold text-slate-700">
                          Chave PIX
                        </Label>
                        <Input
                          id="chave-pix"
                          value={chavePix}
                          onChange={(e) => setChavePix(e.target.value)}
                          placeholder="Informe a chave PIX para recebimentos"
                          className="text-xs bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="agencia" className="text-xs font-medium text-slate-700">
                          Agência (com dígito se houver)
                        </Label>
                        <Input
                          id="agencia"
                          value={agencia}
                          onChange={(e) => setAgencia(e.target.value)}
                          placeholder="0001"
                          className="text-xs bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="conta" className="text-xs font-medium text-slate-700">
                          Conta Corrente (com dígito)
                        </Label>
                        <Input
                          id="conta"
                          value={contaCorrente}
                          onChange={(e) => setContaCorrente(e.target.value)}
                          placeholder="123456-7"
                          className="text-xs bg-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumo e Aceite dos Termos */}
                  <div className="p-4 bg-orange-50/40 border border-orange-200/80 rounded-lg text-xs space-y-2 text-slate-700">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-[#D95A2B]" />
                      Declaração de Autenticidade e Submissão
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Ao clicar em "Concluir e Enviar Cadastro", confirmo que as informações
                      prestadas, registros de conselho e dados bancários são verídicos e de minha
                      titularidade, autorizando a G+ Engenharia a homologar meu credenciamento e
                      disparar consultas de cotação.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEtapaAtual(2)}
                      disabled={submetendo}
                      className="text-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                      Voltar para Disciplinas
                    </Button>

                    <Button
                      type="submit"
                      disabled={submetendo}
                      className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-bold px-6 h-10 shadow-sm"
                    >
                      {submetendo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando Cadastro...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Concluir e Enviar Cadastro
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </main>

      {/* Rodapé Institucional */}
      <footer className="bg-slate-100 border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-700">
          G+ Engenharia Consultiva • Sistema de Intermediação de Projetos e Contratos Públicos
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Ambiente seguro com criptografia de ponta a ponta.
        </p>
      </footer>
    </div>
  )
}
export default CadastroExecutorPublicoPage
