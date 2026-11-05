import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { GPlusLogo } from '@/components/GPlusLogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'
import { ESTADOS_BRASIL } from '@/services/cep'
import { cleanCpf, formatCpf, isValidCpf } from '@/lib/cnpj'
import { formatPhoneDisplay, formatPhoneProgressive } from '@/lib/phone'
import {
  OPCOES_ESTADO_CIVIL,
  DOC_TIPOS_OPTIONS,
  TEXTO_ACEITE_LGPD_PUBLICO,
  MENSAGEM_CPF_DUPLICADO,
} from '@/components/clientesPf/cadastroClientePfConstants'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'

type Tela = 'carregando' | 'formulario' | 'invalido' | 'sucesso'

interface DadosIniciais {
  nome?: string
  cpf?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
}

interface ErroBackend {
  status?: number
  statusText?: string
  error?: string
  erro?: string
  message?: string
  campos?: string[]
  erros?: Record<string, string>
  data?: {
    status?: number
    error?: string
    erro?: string
    message?: string
    campos?: string[]
    erros?: Record<string, string>
  }
}

const ENDERECO_VAZIO: EnderecoValue = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
}

const ROTULOS_CAMPO: Record<string, string> = {
  cpf: 'Informe um CPF válido (11 dígitos, com os dígitos verificadores corretos).',
  doc_tipo: 'Selecione o documento de identificação.',
  doc_tipo_outro: 'Informe qual é o documento de identificação.',
  rg: 'Informe o número do documento.',
  rg_orgao_emissor: 'Informe o órgão emissor.',
  rg_uf: 'Selecione a UF do documento.',
  estado_civil: 'Selecione o estado civil.',
  profissao: 'Informe a profissão.',
  nacionalidade: 'Informe a nacionalidade.',
  data_nascimento: 'Informe a data de nascimento.',
  cep: 'Informe um CEP válido (8 dígitos).',
  logradouro: 'Informe o logradouro.',
  numero: 'Informe o número do endereço.',
  bairro: 'Informe o bairro.',
  municipio: 'Informe o município.',
  uf: 'Selecione a UF do endereço.',
  telefone: 'Informe um telefone válido.',
  email: 'Informe um e-mail válido.',
  aceite_lgpd: 'É necessário marcar o aceite do tratamento de dados (LGPD).',
}

export interface PayloadCadastroClientePf {
  cpf: string
  doc_tipo: string
  doc_tipo_outro?: string
  rg: string
  rg_orgao_emissor: string
  rg_uf: string
  estado_civil: string
  regime_bens?: string
  profissao: string
  nacionalidade: string
  data_nascimento: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  municipio: string
  uf: string
  telefone: string
  email: string
  aceite_lgpd: boolean
}

export function validarPayloadCadastroClientePf(
  payload: Partial<PayloadCadastroClientePf>,
): Record<string, string> {
  const erros: Record<string, string> = {}
  const docTipoValidos = ['CIN', 'RG', 'CNH', 'Carteira profissional', 'Outro']
  const estadosCivisValidos = [
    'solteiro(a)',
    'casado(a)',
    'união estável',
    'divorciado(a)',
    'separado(a)',
    'viúvo(a)',
  ]
  const cpfUfsValidas = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]

  const clean = (v?: unknown) => (v || '').toString().trim()
  const soDigitos = (v?: unknown) => (v || '').toString().replace(/\D/g, '')

  const docTipo = clean(payload.doc_tipo)
  const docTipoOutro = clean(payload.doc_tipo_outro)
  const cpf = soDigitos(payload.cpf)
  const rg = docTipo === 'CIN' ? cpf : clean(payload.rg)
  const rgOrgao = clean(payload.rg_orgao_emissor)
  const rgUf = clean(payload.rg_uf).toUpperCase()
  const estadoCivil = clean(payload.estado_civil).toLowerCase()
  const profissao = clean(payload.profissao)
  const nacionalidade = clean(payload.nacionalidade)
  const dataNascimento = clean(payload.data_nascimento)
  const cep = soDigitos(payload.cep)
  const logradouro = clean(payload.logradouro)
  const numero = clean(payload.numero)
  const bairro = clean(payload.bairro)
  const municipio = clean(payload.municipio)
  const uf = clean(payload.uf).toUpperCase()
  const telefone = clean(payload.telefone)
  const email = clean(payload.email).toLowerCase()
  const aceiteLgpd = payload.aceite_lgpd === true || payload.aceite_lgpd === ('true' as unknown)

  if (!docTipo || !docTipoValidos.includes(docTipo)) {
    erros.doc_tipo = ROTULOS_CAMPO.doc_tipo
  }
  if (docTipo === 'Outro' && !docTipoOutro) {
    erros.doc_tipo_outro = ROTULOS_CAMPO.doc_tipo_outro
  }
  if (!cpf) {
    erros.cpf = 'Informe o CPF.'
  } else if (!isValidCpf(cpf)) {
    erros.cpf = ROTULOS_CAMPO.cpf
  }
  if (!rg) {
    erros.rg = ROTULOS_CAMPO.rg
  }
  if (!rgOrgao) {
    erros.rg_orgao_emissor = ROTULOS_CAMPO.rg_orgao_emissor
  }
  if (!rgUf || rgUf.length !== 2 || !cpfUfsValidas.includes(rgUf)) {
    erros.rg_uf = ROTULOS_CAMPO.rg_uf
  }
  if (!estadoCivil || !estadosCivisValidos.includes(estadoCivil)) {
    erros.estado_civil = ROTULOS_CAMPO.estado_civil
  }
  if (!profissao) {
    erros.profissao = ROTULOS_CAMPO.profissao
  }
  if (!nacionalidade) {
    erros.nacionalidade = ROTULOS_CAMPO.nacionalidade
  }
  if (!dataNascimento) {
    erros.data_nascimento = ROTULOS_CAMPO.data_nascimento
  } else {
    const isoM = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(dataNascimento)
    const brM = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(dataNascimento)
    if (!isoM && !brM) {
      erros.data_nascimento = 'Informe uma data de nascimento válida.'
    }
  }
  if (!cep || cep.length < 8) {
    erros.cep = ROTULOS_CAMPO.cep
  }
  if (!logradouro) {
    erros.logradouro = ROTULOS_CAMPO.logradouro
  }
  if (!numero) {
    erros.numero = ROTULOS_CAMPO.numero
  }
  if (!bairro) {
    erros.bairro = ROTULOS_CAMPO.bairro
  }
  if (!municipio) {
    erros.municipio = ROTULOS_CAMPO.municipio
  }
  if (!uf || uf.length !== 2 || !cpfUfsValidas.includes(uf)) {
    erros.uf = ROTULOS_CAMPO.uf
  }
  if (!telefone) {
    erros.telefone = ROTULOS_CAMPO.telefone
  }
  if (!email) {
    erros.email = 'Informe o e-mail.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erros.email = ROTULOS_CAMPO.email
  }
  if (!aceiteLgpd) {
    erros.aceite_lgpd = ROTULOS_CAMPO.aceite_lgpd
  }

  return erros
}

export function extrairErroBackend(err: unknown): {
  status?: number
  error?: string
  campos?: string[]
  erros?: Record<string, string>
} {
  const anyErr = err as {
    status?: number
    statusCode?: number
    response?: ErroBackend & { status?: number }
    data?: {
      status?: number
      error?: string
      erro?: string
      message?: string
      campos?: string[]
      erros?: Record<string, string>
    }
    error?: string
    erro?: string
    message?: string
    campos?: string[]
    erros?: Record<string, string>
  } | null

  const resp = anyErr?.response || anyErr?.data || anyErr || {}
  const innerData = (resp as ErroBackend).data || {}

  const status =
    anyErr?.status ||
    anyErr?.statusCode ||
    (resp as ErroBackend).status ||
    (resp as { statusCode?: number }).statusCode ||
    innerData.status

  const error =
    (resp as ErroBackend).error ||
    (resp as ErroBackend).erro ||
    innerData.error ||
    innerData.erro ||
    anyErr?.error ||
    anyErr?.erro ||
    (resp as ErroBackend).message ||
    innerData.message ||
    anyErr?.message

  const campos = (resp as ErroBackend).campos || innerData.campos || anyErr?.campos
  const erros = (resp as ErroBackend).erros || innerData.erros || anyErr?.erros

  return { status: typeof status === 'number' ? status : undefined, error, campos, erros }
}

export function CadastroClientePublicoPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') || '').trim()

  const [tela, setTela] = useState<Tela>('carregando')
  const [nomeCliente, setNomeCliente] = useState('')
  const [form, setForm] = useState({
    cpf: '',
    doc_tipo: 'CIN',
    doc_tipo_outro: '',
    rg: '',
    rg_orgao_emissor: '',
    rg_uf: '',
    estado_civil: '',
    profissao: '',
    nacionalidade: 'Brasileira',
    data_nascimento: '',
    telefone: '',
    email: '',
  })
  const [endereco, setEndereco] = useState<EnderecoValue>(ENDERECO_VAZIO)
  const [aceiteLgpd, setAceiteLgpd] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    if (!token) {
      setTela('invalido')
      return
    }
    ;(async () => {
      try {
        const resp = await pb.send<{ sucesso: boolean; dados: DadosIniciais }>(
          `/backend/v1/cadastro-cliente/${encodeURIComponent(token)}`,
          {},
        )
        if (!ativo) return
        const d = resp.dados || {}
        setNomeCliente(d.nome || '')
        setForm((prev) => ({
          ...prev,
          cpf: d.cpf ? formatCpf(cleanCpf(d.cpf)) : '',
          telefone: d.telefone ? formatPhoneDisplay(d.telefone, false) : '',
          email: d.email || '',
        }))
        setEndereco({
          cep: d.cep || '',
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
        })
        setTela('formulario')
      } catch {
        if (ativo) setTela('invalido')
      }
    })()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const setCampo = (campo: string, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErros((prev) => {
      if (!prev[campo]) return prev
      const novo = { ...prev }
      delete novo[campo]
      return novo
    })
  }

  const validarFormulario = (): Record<string, string> => {
    const errs: Record<string, string> = {}
    const cpfClean = cleanCpf(form.cpf)
    if (!cpfClean || cpfClean.length !== 11 || !isValidCpf(cpfClean)) errs.cpf = ROTULOS_CAMPO.cpf
    if (!form.doc_tipo) errs.doc_tipo = ROTULOS_CAMPO.doc_tipo
    if (form.doc_tipo === 'Outro' && !form.doc_tipo_outro.trim()) {
      errs.doc_tipo_outro = ROTULOS_CAMPO.doc_tipo_outro
    }
    const rgValor = form.doc_tipo === 'CIN' ? cleanCpf(form.cpf) : form.rg.trim()
    if (!rgValor) errs.rg = ROTULOS_CAMPO.rg
    if (!form.rg_orgao_emissor.trim()) errs.rg_orgao_emissor = ROTULOS_CAMPO.rg_orgao_emissor
    if (!form.rg_uf) errs.rg_uf = ROTULOS_CAMPO.rg_uf
    if (!form.estado_civil) errs.estado_civil = ROTULOS_CAMPO.estado_civil
    if (!form.profissao.trim()) errs.profissao = ROTULOS_CAMPO.profissao
    if (!form.nacionalidade.trim()) errs.nacionalidade = ROTULOS_CAMPO.nacionalidade
    if (!form.data_nascimento) {
      errs.data_nascimento = ROTULOS_CAMPO.data_nascimento
    } else {
      const isoM = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(form.data_nascimento.trim())
      const brM = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(form.data_nascimento.trim())
      if (!isoM && !brM) {
        errs.data_nascimento = 'Informe uma data de nascimento válida.'
      }
    }
    if (!endereco.cep || endereco.cep.replace(/\D/g, '').length !== 8) errs.cep = ROTULOS_CAMPO.cep
    if (!endereco.logradouro.trim()) errs.logradouro = ROTULOS_CAMPO.logradouro
    if (!endereco.numero.trim()) errs.numero = ROTULOS_CAMPO.numero
    if (!endereco.bairro.trim()) errs.bairro = ROTULOS_CAMPO.bairro
    if (!endereco.municipio.trim()) errs.municipio = ROTULOS_CAMPO.municipio
    if (!endereco.uf || endereco.uf.length !== 2) errs.uf = ROTULOS_CAMPO.uf
    if (!form.telefone.trim() || form.telefone.replace(/\D/g, '').length < 10)
      errs.telefone = ROTULOS_CAMPO.telefone
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = ROTULOS_CAMPO.email
    if (!aceiteLgpd) errs.aceite_lgpd = ROTULOS_CAMPO.aceite_lgpd
    return errs
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroGeral('')
    const errs = validarFormulario()
    setErros(errs)
    if (Object.keys(errs).length > 0) return

    const payloadEnvio: PayloadCadastroClientePf = {
      cpf: cleanCpf(form.cpf),
      doc_tipo: form.doc_tipo || 'RG',
      doc_tipo_outro: form.doc_tipo === 'Outro' ? form.doc_tipo_outro.trim() : '',
      rg: form.doc_tipo === 'CIN' ? cleanCpf(form.cpf) : form.rg.trim(),
      rg_orgao_emissor: form.rg_orgao_emissor.trim(),
      rg_uf: form.rg_uf,
      estado_civil: form.estado_civil,
      profissao: form.profissao.trim(),
      nacionalidade: form.nacionalidade.trim(),
      data_nascimento: form.data_nascimento,
      cep: endereco.cep,
      logradouro: endereco.logradouro.trim(),
      numero: endereco.numero.trim(),
      complemento: endereco.complemento.trim(),
      bairro: endereco.bairro.trim(),
      municipio: endereco.municipio.trim(),
      uf: endereco.uf,
      telefone: form.telefone.trim(),
      email: form.email.trim().toLowerCase(),
      aceite_lgpd: true,
    }

    setEnviando(true)
    try {
      await pb.send(`/backend/v1/cadastro-cliente/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          ...payloadEnvio,
          dados: payloadEnvio,
        },
      })
      setTela('sucesso')
    } catch (err) {
      const resp = extrairErroBackend(err)
      const errosDoBackend = resp.erros || {}
      const temErrosPorCampo = Object.keys(errosDoBackend).length > 0
      const temCampos = Array.isArray(resp.campos) && resp.campos.length > 0

      if (
        (resp.error &&
          (resp.error.indexOf('já consta em outro cadastro') !== -1 ||
            resp.error.indexOf('já está cadastrado') !== -1)) ||
        (errosDoBackend.cpf && errosDoBackend.cpf.indexOf('já está cadastrado') !== -1)
      ) {
        setErros({ cpf: MENSAGEM_CPF_DUPLICADO })
      } else if (temErrosPorCampo || temCampos) {
        const mapeados: Record<string, string> = {}
        if (temErrosPorCampo) {
          for (const [campo, msg] of Object.entries(errosDoBackend)) {
            mapeados[campo] = msg || ROTULOS_CAMPO[campo] || 'Verifique este campo.'
          }
        }
        if (temCampos) {
          for (const campo of resp.campos!) {
            if (!mapeados[campo]) {
              mapeados[campo] = ROTULOS_CAMPO[campo] || 'Verifique este campo.'
            }
          }
        }
        if (!mapeados.aceite_lgpd) setAceiteLgpd(true)
        setErros(mapeados)
        if (mapeados.aceite_lgpd) setAceiteLgpd(false)
      } else {
        const msgBase = resp.error || 'Não foi possível enviar o cadastro. Tente novamente.'
        const statusSufixo = resp.status ? ` (cód. ${resp.status})` : ''
        setErroGeral(`${msgBase}${statusSufixo}`)
      }
    } finally {
      setEnviando(false)
    }
  }

  const primeiroNome = (nomeCliente || '').trim().split(/\s+/)[0] || ''

  if (tela === 'carregando') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-[#D95A2B]" />
          <p className="text-sm">Carregando seu formulário...</p>
        </div>
      </div>
    )
  }

  if (tela === 'invalido') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <GPlusLogo variant="horizontal" size={34} showSlogan={false} />
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-slate-900">
            Link inválido ou expirado — solicite um novo link
          </h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Este link de cadastro não está mais disponível. Fale com a equipe G+ ENGENHARIA para
            receber um novo.
          </p>
        </div>
      </div>
    )
  }

  if (tela === 'sucesso') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <GPlusLogo variant="horizontal" size={34} showSlogan={false} />
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-slate-900">
            Cadastro enviado! A equipe G+ vai revisar seus dados.
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            Você receberá a confirmação da nossa equipe em breve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Cabeçalho institucional */}
      <header className="bg-[#1E2A4A] px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <GPlusLogo variant="horizontal" size={34} dark showSlogan={false} />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-14">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-7">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Complete seu cadastro</h1>
          {primeiroNome && (
            <p className="text-sm text-slate-600 mt-1">
              Olá, <span className="font-semibold text-slate-900">{primeiroNome}</span>! Preencha os
              dados abaixo para concluirmos seu cadastro.
            </p>
          )}
          <div className="h-0.5 w-14 bg-[#D95A2B] rounded-full mt-3 mb-5" />

          {erroGeral && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{erroGeral}</span>
            </div>
          )}

          <form onSubmit={enviar} className="space-y-4" noValidate>
            {/* Identificação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF *</Label>
                <Input
                  inputMode="numeric"
                  value={form.cpf}
                  onChange={(e) => {
                    const novoCpf = formatCpf(cleanCpf(e.target.value))
                    setCampo('cpf', novoCpf)
                    if (form.doc_tipo === 'CIN') {
                      setCampo('rg', novoCpf)
                    }
                  }}
                  placeholder="000.000.000-00"
                  className={`text-sm h-10 font-mono bg-white ${erros.cpf ? 'border-red-500' : ''}`}
                />
                {erros.cpf && <p className="text-[11px] text-red-600">{erros.cpf}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de nascimento *</Label>
                <Input
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) => setCampo('data_nascimento', e.target.value)}
                  className={`text-sm h-10 bg-white ${erros.data_nascimento ? 'border-red-500' : ''}`}
                />
                {erros.data_nascimento && (
                  <p className="text-[11px] text-red-600">{erros.data_nascimento}</p>
                )}
              </div>
            </div>

            {/* Documento de identificação: select primeiro, se 'Outro' campo adicional */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Documento de identificação *</Label>
                  <Select
                    value={form.doc_tipo}
                    onValueChange={(v) => {
                      setCampo('doc_tipo', v)
                      if (v === 'CIN') {
                        setCampo('rg', form.cpf || '')
                      }
                      if (v !== 'Outro') setCampo('doc_tipo_outro', '')
                    }}
                  >
                    <SelectTrigger
                      className={`text-sm h-10 bg-white ${erros.doc_tipo ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="Selecione o tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TIPOS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {erros.doc_tipo && <p className="text-[11px] text-red-600">{erros.doc_tipo}</p>}
                </div>
                {form.doc_tipo === 'Outro' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Qual documento? *</Label>
                    <Input
                      value={form.doc_tipo_outro}
                      onChange={(e) => setCampo('doc_tipo_outro', e.target.value)}
                      placeholder="Ex: Passaporte, RNE..."
                      className={`text-sm h-10 bg-white ${erros.doc_tipo_outro ? 'border-red-500' : ''}`}
                    />
                    {erros.doc_tipo_outro && (
                      <p className="text-[11px] text-red-600">{erros.doc_tipo_outro}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Número do documento *</Label>
                  <Input
                    value={form.doc_tipo === 'CIN' ? form.cpf : form.rg}
                    readOnly={form.doc_tipo === 'CIN'}
                    onChange={(e) => {
                      if (form.doc_tipo !== 'CIN') {
                        setCampo('rg', e.target.value)
                      }
                    }}
                    placeholder="Número"
                    className={`text-sm h-10 bg-white ${
                      form.doc_tipo === 'CIN'
                        ? 'bg-slate-100 text-slate-600 cursor-not-allowed font-mono'
                        : ''
                    } ${erros.rg ? 'border-red-500' : ''}`}
                  />
                  {form.doc_tipo === 'CIN' && (
                    <p className="text-[11px] text-slate-500">Na CIN o número é o próprio CPF</p>
                  )}
                  {erros.rg && <p className="text-[11px] text-red-600">{erros.rg}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Órgão emissor *</Label>
                  <Input
                    value={form.rg_orgao_emissor}
                    onChange={(e) => setCampo('rg_orgao_emissor', e.target.value)}
                    placeholder="SSP, DETRAN, CREA, CAU, OAB..."
                    className={`text-sm h-10 bg-white ${erros.rg_orgao_emissor ? 'border-red-500' : ''}`}
                  />
                  {erros.rg_orgao_emissor && (
                    <p className="text-[11px] text-red-600">{erros.rg_orgao_emissor}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UF *</Label>
                  <Select value={form.rg_uf} onValueChange={(v) => setCampo('rg_uf', v)}>
                    <SelectTrigger
                      className={`text-sm h-10 bg-white ${erros.rg_uf ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BRASIL.map((uf) => (
                        <SelectItem key={uf.sigla} value={uf.sigla}>
                          {uf.sigla}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {erros.rg_uf && <p className="text-[11px] text-red-600">{erros.rg_uf}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado civil *</Label>
                <Select
                  value={form.estado_civil}
                  onValueChange={(v) => setCampo('estado_civil', v)}
                >
                  <SelectTrigger
                    className={`text-sm h-10 bg-white ${erros.estado_civil ? 'border-red-500' : ''}`}
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_ESTADO_CIVIL.map((ec) => (
                      <SelectItem key={ec} value={ec}>
                        {ec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {erros.estado_civil && (
                  <p className="text-[11px] text-red-600">{erros.estado_civil}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Profissão *</Label>
                <Input
                  value={form.profissao}
                  onChange={(e) => setCampo('profissao', e.target.value)}
                  className={`text-sm h-10 bg-white ${erros.profissao ? 'border-red-500' : ''}`}
                />
                {erros.profissao && <p className="text-[11px] text-red-600">{erros.profissao}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nacionalidade *</Label>
                <Input
                  value={form.nacionalidade}
                  onChange={(e) => setCampo('nacionalidade', e.target.value)}
                  className={`text-sm h-10 bg-white ${erros.nacionalidade ? 'border-red-500' : ''}`}
                />
                {erros.nacionalidade && (
                  <p className="text-[11px] text-red-600">{erros.nacionalidade}</p>
                )}
              </div>
            </div>

            {/* Endereço com busca por CEP */}
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/60">
              <EnderecoComCep
                value={endereco}
                onChange={setEndereco}
                label="Endereço residencial"
              />
              {(erros.cep ||
                erros.logradouro ||
                erros.numero ||
                erros.bairro ||
                erros.municipio ||
                erros.uf) && (
                <p className="text-[11px] text-red-600 mt-2">
                  Complete todos os campos do endereço (CEP, logradouro, número, bairro, município e
                  UF).
                </p>
              )}
            </div>

            {/* Contato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Telefone *</Label>
                <Input
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) =>
                    setCampo('telefone', formatPhoneProgressive(e.target.value) || e.target.value)
                  }
                  placeholder="(00) 00000-0000"
                  className={`text-sm h-10 font-mono bg-white ${erros.telefone ? 'border-red-500' : ''}`}
                />
                {erros.telefone && <p className="text-[11px] text-red-600">{erros.telefone}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setCampo('email', e.target.value)}
                  placeholder="seu@email.com"
                  className={`text-sm h-10 bg-white ${erros.email ? 'border-red-500' : ''}`}
                />
                {erros.email && <p className="text-[11px] text-red-600">{erros.email}</p>}
              </div>
            </div>

            {/* Aceite LGPD */}
            <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950 uppercase">
                  Proteção dos seus dados (LGPD)
                </span>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="aceite-lgpd-publico"
                  checked={aceiteLgpd}
                  onCheckedChange={(checked) => {
                    setAceiteLgpd(Boolean(checked))
                    setErros((prev) => {
                      if (!prev.aceite_lgpd) return prev
                      const novo = { ...prev }
                      delete novo.aceite_lgpd
                      return novo
                    })
                  }}
                />
                <Label
                  htmlFor="aceite-lgpd-publico"
                  className="text-[11px] leading-snug text-emerald-950 cursor-pointer"
                >
                  {TEXTO_ACEITE_LGPD_PUBLICO}
                </Label>
              </div>
              {erros.aceite_lgpd && <p className="text-[11px] text-red-600">{erros.aceite_lgpd}</p>}
            </div>

            <Button
              type="submit"
              disabled={enviando}
              className="w-full h-11 bg-[#D95A2B] hover:bg-[#C44E22] text-white text-sm font-semibold"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar cadastro'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          G+ Engenharia Consultiva — proteção e sigilo dos seus dados.
        </p>
      </main>
    </div>
  )
}

export default CadastroClientePublicoPage
