import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  Building2,
  User,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'
import {
  cleanCpf,
  cleanCnpj,
  formatCpf,
  formatCnpj,
  isValidCpf,
  isValidCnpj,
  formatPhoneBr,
} from '@/lib/cnpj'
import { formatCurrencyBr } from '@/lib/formatters'
import {
  contratosServicoService,
  ObterContratoComplementoResponse,
} from '@/services/contratosServico'
import { GPlusLogo } from '@/components/GPlusLogo'

export function ComplementoDadosClientePage() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [dadosContrato, setDadosContrato] = useState<ObterContratoComplementoResponse | null>(null)

  // Formulário: campos compartilhados e específicos
  const [tipoCliente, setTipoCliente] = useState<'pf' | 'pj'>('pj')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [nomePf, setNomePf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')

  // Representante Legal (para PJ)
  const [representanteNome, setRepresentanteNome] = useState('')
  const [representanteDocumento, setRepresentanteDocumento] = useState('')

  // Endereço
  const [endereco, setEndereco] = useState<EnderecoValue>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  })

  // Mensagens de erro de validação inline
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) {
      setError('Token de complemento de cadastro não informado.')
      setLoading(false)
      return
    }

    async function carregarDados() {
      try {
        setLoading(true)
        setError(null)
        const resp = await contratosServicoService.getPorTokenComplemento(token!)
        setDadosContrato(resp)
        setTipoCliente(resp.tipo_cliente)

        const dc = resp.dados_cliente || {}
        if (resp.tipo_cliente === 'pj') {
          setRazaoSocial(dc.razao_social || '')
          setNomeFantasia(dc.nome_fantasia || '')
          setCnpj(formatCnpj(dc.cnpj || ''))
        } else {
          setNomePf(dc.nome || '')
          setCpf(formatCpf(dc.cpf || ''))
        }

        setEmail(dc.email || '')
        setTelefone(formatPhoneBr(dc.telefone || ''))

        setEndereco({
          cep: dc.cep || '',
          logradouro: dc.logradouro || '',
          numero: dc.numero || '',
          complemento: dc.complemento || '',
          bairro: dc.bairro || '',
          municipio: dc.municipio || '',
          uf: dc.uf || '',
        })

        if (resp.representante) {
          setRepresentanteNome(resp.representante.nome || '')
          setRepresentanteDocumento(formatCpf(resp.representante.documento || ''))
        }

        // Se já tiver sido completado anteriormente
        if (
          resp.contrato.status !== 'aguardando_dados_cliente' &&
          resp.contrato.dados_completados_em
        ) {
          setSucesso(true)
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados do contrato:', err)
        setError(
          err?.data?.message ||
            err?.message ||
            'Não foi possível localizar as informações do contrato com o link fornecido. Verifique se o link está correto.',
        )
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [token])

  const validarCampos = (): boolean => {
    const errs: Record<string, string> = {}

    if (tipoCliente === 'pj') {
      if (!razaoSocial.trim()) {
        errs.razaoSocial = 'Razão Social é obrigatória.'
      }
      const rawCnpj = cleanCnpj(cnpj)
      if (!rawCnpj) {
        errs.cnpj = 'CNPJ é obrigatório.'
      } else if (!isValidCnpj(rawCnpj)) {
        errs.cnpj = 'CNPJ inválido: confira os números digitados.'
      }

      if (!representanteNome.trim()) {
        errs.representanteNome = 'Nome do representante legal / signatário é obrigatório.'
      }
      const rawRepDoc = cleanCpf(representanteDocumento)
      if (!rawRepDoc) {
        errs.representanteDocumento = 'CPF do representante legal é obrigatório.'
      } else if (!isValidCpf(rawRepDoc)) {
        errs.representanteDocumento = 'CPF do representante legal inválido.'
      }
    } else {
      if (!nomePf.trim()) {
        errs.nomePf = 'Nome completo é obrigatório.'
      }
      const rawCpf = cleanCpf(cpf)
      if (!rawCpf) {
        errs.cpf = 'CPF é obrigatório.'
      } else if (!isValidCpf(rawCpf)) {
        errs.cpf = 'CPF inválido: confira os números digitados.'
      }
    }

    if (!email.trim() || !email.includes('@')) {
      errs.email = 'E-mail corporativo / principal válido é obrigatório.'
    }

    const rawTel = telefone.replace(/\D/g, '')
    if (!rawTel || rawTel.length < 10) {
      errs.telefone = 'Telefone válido com DDD é obrigatório.'
    }

    const rawCep = (endereco.cep || '').replace(/\D/g, '')
    if (!rawCep || rawCep.length < 8) {
      errs.cep = 'CEP completo com 8 dígitos é obrigatório.'
    }
    if (!endereco.logradouro.trim()) {
      errs.logradouro = 'Logradouro / Rua é obrigatório.'
    }
    if (!endereco.numero.trim()) {
      errs.numero = 'Número é obrigatório.'
    }
    if (!endereco.bairro.trim()) {
      errs.bairro = 'Bairro é obrigatório.'
    }
    if (!endereco.municipio.trim()) {
      errs.municipio = 'Município é obrigatório.'
    }
    if (!endereco.uf.trim()) {
      errs.uf = 'UF é obrigatório.'
    }

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarCampos()) return

    try {
      setSaving(true)
      setError(null)

      const payload = {
        token_complemento_dados: token!,
        ...(tipoCliente === 'pj'
          ? {
              razao_social: razaoSocial.trim(),
              nome_fantasia: nomeFantasia.trim(),
              cnpj: cleanCnpj(cnpj),
              representante_nome: representanteNome.trim(),
              representante_documento: cleanCpf(representanteDocumento),
            }
          : {
              nome: nomePf.trim(),
              cpf: cleanCpf(cpf),
            }),
        email: email.trim(),
        telefone: telefone.trim(),
        cep: (endereco.cep || '').trim(),
        logradouro: endereco.logradouro.trim(),
        numero: endereco.numero.trim(),
        complemento: (endereco.complemento || '').trim(),
        bairro: endereco.bairro.trim(),
        municipio: endereco.municipio.trim(),
        uf: endereco.uf.trim().toUpperCase(),
      }

      await contratosServicoService.complementarDados(payload)
      setSucesso(true)
    } catch (err: any) {
      console.error('Erro ao enviar dados cadastrais:', err)
      setError(
        err?.data?.message ||
          err?.message ||
          'Ocorreu um erro ao salvar suas informações cadastrais. Por favor, confira os dados e tente novamente.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-3" />
        <p className="text-sm font-medium text-slate-700">
          Carregando formulário de complemento...
        </p>
      </div>
    )
  }

  if (error && !dadosContrato) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Link Inválido ou Inacessível</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="text-xs">
                Ir para a Página Inicial
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const cInfo = dadosContrato?.contrato

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GPlusLogo size="md" />
            <div>
              <h1 className="text-base font-bold text-slate-900">G+ Engenharia Consultiva</h1>
              <p className="text-xs text-slate-500">
                Complemento Cadastral para Emissão do Contrato
              </p>
            </div>
          </div>
          {cInfo && (
            <div className="text-right">
              <Badge
                variant="outline"
                className="font-mono text-xs text-orange-700 bg-orange-50 border-orange-200"
              >
                {cInfo.numero}
              </Badge>
              <div className="text-[11px] text-slate-500 mt-1">
                Valor Contratado: <strong>{formatCurrencyBr(cInfo.valor_total)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* MENSAGEM DE SUCESSO */}
        {sucesso ? (
          <div className="bg-white rounded-xl border border-emerald-200 p-8 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Dados Cadastrais Confirmados com Sucesso!
            </h2>
            <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
              Obrigado por completar suas informações cadastrais. O seu Contrato de Prestação de
              Serviços Técnicos <strong>{cInfo?.numero}</strong> foi gerado de forma completa e
              encaminhado para assinatura digital da Diretoria Técnica da G+ Engenharia.
            </p>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 max-w-lg mx-auto text-left text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Próximas Etapas do Fluxo:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800">
                <li>A Diretoria da G+ realizará a assinatura digital oficial do documento.</li>
                <li>Você receberá a notificação para assinatura digital pelo mesmo canal.</li>
                <li>Após a assinatura bilateral, o projeto de engenharia será iniciado!</li>
              </ol>
            </div>
            {cInfo?.token_assinatura_cliente && (
              <div className="pt-2">
                <Link to={`/contrato-servico/${cInfo.token_assinatura_cliente}`}>
                  <Button className="bg-[#D95A2B] hover:bg-[#b8451b] text-white text-xs gap-1.5 shadow-sm">
                    <ExternalLink className="w-4 h-4" />
                    Visualizar Contrato Gerado
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* FORMULÁRIO DE COMPLEMENTO */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 text-orange-700 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Preenchimento de Informações Contratuais Obrigatórias
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    Para garantir total segurança jurídica e emissão da Nota Fiscal, precisamos de
                    alguns dados cadastrais complementares antes da formalização do contrato{' '}
                    <strong>{cInfo?.numero}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-6 mt-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* SEÇÃO 1: TIPO DE CLIENTE E DADOS BÁSICOS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  {tipoCliente === 'pj' ? (
                    <Building2 className="w-4 h-4 text-orange-600" />
                  ) : (
                    <User className="w-4 h-4 text-orange-600" />
                  )}
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {tipoCliente === 'pj'
                      ? 'Dados da Empresa Contratante (Pessoa Jurídica)'
                      : 'Dados do Contratante (Pessoa Física)'}
                  </h3>
                </div>

                {tipoCliente === 'pj' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-700">Razão Social *</Label>
                        <Input
                          value={razaoSocial}
                          onChange={(e) => setRazaoSocial(e.target.value)}
                          placeholder="Ex: Empresa Exemplo Engenharia LTDA"
                          className={`mt-1 text-xs ${validationErrors.razaoSocial ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.razaoSocial && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.razaoSocial}
                          </span>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-slate-700">Nome Fantasia (opcional)</Label>
                        <Input
                          value={nomeFantasia}
                          onChange={(e) => setNomeFantasia(e.target.value)}
                          placeholder="Ex: Exemplo Soluções"
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-slate-700">CNPJ *</Label>
                        <Input
                          value={cnpj}
                          onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          className={`mt-1 text-xs font-mono ${validationErrors.cnpj ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.cnpj && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.cnpj}
                          </span>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-slate-700">
                          E-mail Principal / Financeiro *
                        </Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contato@empresa.com.br"
                          className={`mt-1 text-xs ${validationErrors.email ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.email && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.email}
                          </span>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-slate-700">Telefone / WhatsApp *</Label>
                        <Input
                          value={telefone}
                          onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className={`mt-1 text-xs font-mono ${validationErrors.telefone ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.telefone && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.telefone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* REPRESENTANTE LEGAL */}
                    <div className="p-4 bg-orange-50/50 rounded-lg border border-orange-200/70 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-950">
                        <User className="w-4 h-4 text-orange-600" />
                        Representante Legal / Signatário do Contrato
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Informe o nome completo e o CPF do representante legal com poderes para
                        assinar eletronicamente o contrato pela empresa.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <Label className="text-xs text-slate-700">
                            Nome Completo do Representante *
                          </Label>
                          <Input
                            value={representanteNome}
                            onChange={(e) => setRepresentanteNome(e.target.value)}
                            placeholder="Ex: Carlos Eduardo de Oliveira"
                            className={`mt-1 text-xs bg-white ${validationErrors.representanteNome ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.representanteNome && (
                            <span className="text-[11px] text-red-600 mt-1 block">
                              {validationErrors.representanteNome}
                            </span>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs text-slate-700">CPF do Representante *</Label>
                          <Input
                            value={representanteDocumento}
                            onChange={(e) => setRepresentanteDocumento(formatCpf(e.target.value))}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            className={`mt-1 text-xs font-mono bg-white ${validationErrors.representanteDocumento ? 'border-red-500' : ''}`}
                          />
                          {validationErrors.representanteDocumento && (
                            <span className="text-[11px] text-red-600 mt-1 block">
                              {validationErrors.representanteDocumento}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-700">Nome Completo *</Label>
                        <Input
                          value={nomePf}
                          onChange={(e) => setNomePf(e.target.value)}
                          placeholder="Ex: Maria Aparecida Santos"
                          className={`mt-1 text-xs ${validationErrors.nomePf ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.nomePf && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.nomePf}
                          </span>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-slate-700">CPF *</Label>
                        <Input
                          value={cpf}
                          onChange={(e) => setCpf(formatCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className={`mt-1 text-xs font-mono ${validationErrors.cpf ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.cpf && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.cpf}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-700">E-mail Principal *</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seuemail@exemplo.com"
                          className={`mt-1 text-xs ${validationErrors.email ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.email && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.email}
                          </span>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-slate-700">Telefone / WhatsApp *</Label>
                        <Input
                          value={telefone}
                          onChange={(e) => setTelefone(formatPhoneBr(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className={`mt-1 text-xs font-mono ${validationErrors.telefone ? 'border-red-500' : ''}`}
                        />
                        {validationErrors.telefone && (
                          <span className="text-[11px] text-red-600 mt-1 block">
                            {validationErrors.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* SEÇÃO 2: ENDEREÇO COMPLETO COM BUSCA POR CEP */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Endereço Completo {tipoCliente === 'pj' ? 'da Sede' : 'Residencial'}
                  </h3>
                </div>

                <EnderecoComCep value={endereco} onChange={setEndereco} required={true} />
                {validationErrors.cep && (
                  <span className="text-[11px] text-red-600 block">{validationErrors.cep}</span>
                )}
                {(validationErrors.logradouro ||
                  validationErrors.numero ||
                  validationErrors.bairro ||
                  validationErrors.municipio ||
                  validationErrors.uf) && (
                  <span className="text-[11px] text-red-600 block">
                    Preencha todos os campos do endereço (logradouro, número, bairro, município e
                    UF).
                  </span>
                )}
              </div>

              {/* BOTÃO DE SUBMISSÃO */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  Seus dados estão protegidos sob sigilo técnico e utilizados exclusivamente para
                  formalização deste contrato.
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto bg-[#D95A2B] hover:bg-[#b8451b] text-white font-semibold text-xs px-6 h-10 shadow-sm gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando Informações...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Salvar Cadastro e Liberar Contrato
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default ComplementoDadosClientePage
