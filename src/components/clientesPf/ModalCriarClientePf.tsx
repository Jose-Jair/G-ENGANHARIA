import React, { useState } from 'react'
import { ModalPadrao } from '@/components/comum/ModalPadrao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, ShieldCheck, FilePlus2, Loader2, AlertCircle, Mail, Link2 } from 'lucide-react'
import { formatCpf, isValidCpf, cleanCpf } from '@/lib/cnpj'
import { formatPhoneProgressive } from '@/lib/phone'
import { useToast } from '@/hooks/use-toast'
import { clientesPfService, CreateClientePfData } from '@/services/clientesPf'
import { BASE_LEGAL_LGPD_LABELS, BaseLegalLgpd, TelefoneItem } from '@/types'
import { ListaTelefones } from '@/components/comum/ListaTelefones'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'
import { ESTADOS_BRASIL } from '@/services/cep'
import {
  OPCOES_ESTADO_CIVIL,
  DOC_TIPOS_OPTIONS,
} from '@/components/clientesPf/cadastroClientePfConstants'

type ModoCadastro = 'completo' | 'pre_cadastro'

interface ModalCriarClientePfProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (criouPreCadastro?: boolean) => void
}

const FORM_VAZIO: CreateClientePfData = {
  nome: '',
  cpf: '',
  email: '',
  base_legal: 'consentimento',
  consentimento_lgpd: false,
  data_consentimento: new Date().toISOString().split('T')[0],
  observacoes: '',
  genero: '',
  doc_tipo: 'CIN',
  doc_tipo_outro: '',
  rg: '',
  rg_orgao_emissor: '',
  rg_uf: '',
  estado_civil: '',
  profissao: '',
  nacionalidade: '',
  data_nascimento: '',
}

export function ModalCriarClientePf({ open, onOpenChange, onSuccess }: ModalCriarClientePfProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [cpfError, setCpfError] = useState<string | null>(null)

  // Modo de cadastro: completo (fluxo atual) ou pré-cadastro (cliente completa pelo link)
  const [modo, setModo] = useState<ModoCadastro>('completo')

  const [formData, setFormData] = useState<CreateClientePfData>({ ...FORM_VAZIO })
  const [telefoneSimples, setTelefoneSimples] = useState('')

  const [telefones, setTelefones] = useState<TelefoneItem[]>([])
  const [endereco, setEndereco] = useState<EnderecoValue>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  })

  // Vínculo opcional a proposta
  const [incluirProposta, setIncluirProposta] = useState(false)
  const [propostaData, setPropostaData] = useState({
    numero: `PROP-PF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    escopo: '',
    preco: 25000,
    prazo: '20 dias',
  })

  const isPreCadastro = modo === 'pre_cadastro'
  const temContato = Boolean((formData.email || '').trim()) || Boolean(telefoneSimples.trim())

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = cleanCpf(e.target.value)
    setFormData((prev) => ({
      ...prev,
      cpf: raw,
      rg: prev.doc_tipo === 'CIN' ? formatCpf(raw) : prev.rg,
    }))
    if (raw.length === 11) {
      if (!isValidCpf(raw)) {
        setCpfError('CPF inválido: os dígitos verificadores não conferem.')
      } else {
        setCpfError(null)
      }
    } else {
      setCpfError(null)
    }
  }

  const handleEnviarEmail = () => {
    if (!formData.email?.trim()) return
    window.location.href = `mailto:${formData.email.trim()}`
  }

  const trocarModo = (novoModo: ModoCadastro) => {
    setModo(novoModo)
    setCpfError(null)
    if (novoModo === 'pre_cadastro') {
      setIncluirProposta(false)
    }
  }

  const resetarFormulario = () => {
    setFormData({ ...FORM_VAZIO, data_consentimento: new Date().toISOString().split('T')[0] })
    setTelefoneSimples('')
    setTelefones([])
    setEndereco({
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      municipio: '',
      uf: '',
    })
    setIncluirProposta(false)
    setCpfError(null)
    setModo('completo')
  }

  const validarPreCadastro = (): string | null => {
    if (!formData.nome.trim()) {
      return 'Informe o nome do cliente para criar o pré-cadastro.'
    }
    if (!temContato) {
      return 'Informe pelo menos um contato: telefone ou e-mail.'
    }
    if (
      formData.cpf &&
      cleanCpf(formData.cpf).length === 11 &&
      !isValidCpf(cleanCpf(formData.cpf))
    ) {
      return 'O CPF informado é inválido. Corrija ou deixe em branco para o cliente completar.'
    }
    return null
  }

  const validarCompleto = (): string | null => {
    const clean = cleanCpf(formData.cpf)
    if (!clean || clean.length !== 11 || !isValidCpf(clean)) {
      setCpfError('Informe um CPF válido com 11 dígitos.')
      return 'CPF inválido: informe um CPF válido com 11 dígitos.'
    }
    if (!formData.consentimento_lgpd) {
      return 'É necessário registrar o consentimento LGPD para cadastrar o cliente.'
    }
    if (incluirProposta && !propostaData.escopo.trim()) {
      return 'Preencha o escopo da proposta comercial vinculada ao cliente PF.'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isPreCadastro) {
      const erro = validarPreCadastro()
      if (erro) {
        toast({ title: 'Pré-cadastro incompleto', description: erro, variant: 'destructive' })
        return
      }
    } else {
      const erro = validarCompleto()
      if (erro) {
        toast({ title: 'Dados incompletos', description: erro, variant: 'destructive' })
        return
      }
    }

    // String compatível com o endereço de texto existente
    const partesEndereco = [
      endereco.logradouro,
      endereco.numero ? `nº ${endereco.numero}` : '',
      endereco.complemento,
      endereco.bairro,
      endereco.municipio && endereco.uf ? `${endereco.municipio}/${endereco.uf}` : '',
      endereco.cep ? `CEP ${endereco.cep}` : '',
    ].filter(Boolean)
    const enderecoTexto = partesEndereco.join(', ')

    const telefonesFinais: TelefoneItem[] = isPreCadastro
      ? telefoneSimples.trim()
        ? [
            {
              id: `${Date.now()}`,
              numero: telefoneSimples.trim(),
              tipo: 'celular',
              whatsapp: true,
            },
          ]
        : []
      : telefones

    setSalvando(true)
    try {
      await clientesPfService.create({
        ...formData,
        // Garante mapeamento bidirecional orgao_emissor / uf_rg
        orgao_emissor: formData.orgao_emissor || formData.rg_orgao_emissor,
        uf_rg: formData.uf_rg || formData.rg_uf,
        rg_orgao_emissor: formData.rg_orgao_emissor || formData.orgao_emissor,
        rg_uf: formData.rg_uf || formData.uf_rg,
        cpf: isPreCadastro
          ? cleanCpf(formData.cpf)
            ? formatCpf(formData.cpf)
            : ''
          : formatCpf(formData.cpf),
        email: (formData.email || '').trim(),
        telefone: isPreCadastro ? telefoneSimples.trim() : undefined,
        telefones: telefonesFinais,
        consentimento_lgpd: isPreCadastro ? Boolean(formData.consentimento_lgpd) : true,
        cep: endereco.cep?.trim() || undefined,
        logradouro: endereco.logradouro?.trim() || undefined,
        numero: endereco.numero?.trim() || undefined,
        complemento: endereco.complemento?.trim() || undefined,
        bairro: endereco.bairro?.trim() || undefined,
        municipio: endereco.municipio?.trim() || undefined,
        uf: endereco.uf?.trim() || undefined,
        endereco: enderecoTexto || undefined,
        pre_cadastro: isPreCadastro,
        propostaOpcional:
          !isPreCadastro && incluirProposta
            ? {
                numero: propostaData.numero,
                escopo: propostaData.escopo,
                preco: Number(propostaData.preco) || 0,
                prazo: propostaData.prazo,
              }
            : undefined,
      })

      toast({
        title: isPreCadastro ? 'Pré-cadastro criado!' : 'Cliente PF cadastrado com sucesso!',
        description: isPreCadastro
          ? 'Use "Enviar link de cadastro" na lista para o cliente completar os dados pelo link.'
          : 'Cadastro realizado e registro auditado com consentimento LGPD.',
      })

      const criouPre = isPreCadastro
      resetarFormulario()
      onOpenChange(false)
      onSuccess(criouPre)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar cliente PF.'
      toast({
        title: 'Erro no cadastro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalPadrao
      open={open}
      onOpenChange={onOpenChange}
      maxWidthClass="sm:max-w-2xl"
      title={
        <span className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
          <User className="w-5 h-5 text-blue-600" />
          Novo Cliente Pessoa Física (PF)
        </span>
      }
      description="Cadastro de contratantes pessoa física com contatos completos (múltiplos telefones com WhatsApp), endereço segmentado via CEP e conformidade LGPD."
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-criar-cliente-pf"
            size="sm"
            disabled={salvando || (!isPreCadastro && Boolean(cpfError))}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Salvando...
              </>
            ) : isPreCadastro ? (
              'Salvar Pré-cadastro'
            ) : (
              'Salvar Cliente PF'
            )}
          </Button>
        </>
      }
    >
      <form id="form-criar-cliente-pf" onSubmit={handleSubmit} className="space-y-4">
        {/* Seletor de modo */}
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2">
          <Label className="text-xs font-semibold text-slate-700">Como quer cadastrar?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => trocarModo('completo')}
              className={`text-left p-3 rounded-lg border transition-colors ${
                !isPreCadastro
                  ? 'border-[#D95A2B] bg-orange-50 ring-1 ring-[#D95A2B]/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <User className="w-3.5 h-3.5 text-[#D95A2B]" />
                Cadastro completo agora
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Você preenche todos os dados do cliente (CPF, contato, endereço e LGPD).
              </p>
            </button>
            <button
              type="button"
              onClick={() => trocarModo('pre_cadastro')}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isPreCadastro
                  ? 'border-[#D95A2B] bg-orange-50 ring-1 ring-[#D95A2B]/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Link2 className="w-3.5 h-3.5 text-[#D95A2B]" />
                Pré-cadastro — o cliente completa pelo link
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Salve só o nome e um contato. Depois, envie o link de cadastro para o cliente
                completar os próprios dados (válido 7 dias, uso único).
              </p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">
              Nome Completo <span className="text-red-500">*</span>
            </Label>
            <Input
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Carlos Alberto Silveira"
              className="text-xs h-9 bg-white"
            />
          </div>

          {!isPreCadastro ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">
                  CPF (com validação estrita) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  value={formatCpf(formData.cpf)}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  className={`text-xs h-9 font-mono bg-white ${
                    cpfError ? 'border-red-500 focus-visible:ring-red-400' : ''
                  }`}
                />
                {cpfError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                    {cpfError}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail (Único)</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className="text-xs h-9 bg-white flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnviarEmail}
                    disabled={!formData.email?.trim()}
                    className="h-9 px-2 text-xs text-blue-700 hover:bg-blue-50 border-blue-200 gap-1 shrink-0"
                    title="Abrir no cliente de e-mail padrão (mailto:)"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">
                  Telefone (WhatsApp) <span className="text-slate-400">— ou e-mail abaixo</span>
                </Label>
                <Input
                  inputMode="tel"
                  value={telefoneSimples}
                  onChange={(e) =>
                    setTelefoneSimples(formatPhoneProgressive(e.target.value) || e.target.value)
                  }
                  placeholder="(00) 00000-0000"
                  className="text-xs h-9 font-mono bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  E-mail <span className="text-slate-400">— ou telefone acima</span>
                </Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="text-xs h-9 bg-white"
                />
              </div>
              {!temContato && (
                <p className="text-[11px] text-amber-700 sm:col-span-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Informe pelo menos um contato (telefone ou e-mail) para conseguir enviar o link.
                </p>
              )}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">
                  CPF <span className="text-slate-400">(opcional no pré-cadastro)</span>
                </Label>
                <Input
                  value={formatCpf(formData.cpf)}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00 — o cliente também pode informar no link"
                  className={`text-xs h-9 font-mono bg-white ${
                    cpfError ? 'border-red-500 focus-visible:ring-red-400' : ''
                  }`}
                />
                {cpfError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                    {cpfError}
                  </span>
                )}
              </div>
              <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-snug">
                No pré-cadastro, o cliente receberá um link seguro e completará os próprios dados
                (CPF, RG, endereço, contato e aceite LGPD). O cadastro fica em análise até a equipe
                aprovar.
              </div>
            </>
          )}
        </div>

        {/* Múltiplos Telefones com WhatsApp (fluxo completo) */}
        {!isPreCadastro && (
          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <ListaTelefones
              telefones={telefones}
              onChange={setTelefones}
              label="Telefones do Cliente PF"
              helperText="Adicione múltiplos números (fixo ou celular) com interruptor WhatsApp."
            />
          </div>
        )}

        {/* Campos novos opcionais — fluxo completo */}
        {!isPreCadastro && (
          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase">
              Dados pessoais (opcionais)
            </span>

            {/* Documento de identificação: Select primeiro, se 'Outro' exige 'Qual documento?' */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Gênero</Label>
                  <Select
                    value={formData.genero || ''}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, genero: v }))}
                  >
                    <SelectTrigger className="text-xs h-8 bg-white">
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Documento de identificação</Label>
                  <Select
                    value={formData.doc_tipo || 'CIN'}
                    onValueChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        doc_tipo: v,
                        rg: v === 'CIN' ? (prev.cpf ? formatCpf(prev.cpf) : '') : prev.rg,
                        doc_tipo_outro: v === 'Outro' ? prev.doc_tipo_outro || '' : '',
                      }))
                    }
                  >
                    <SelectTrigger className="text-xs h-8 bg-white">
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
                </div>
                {formData.doc_tipo === 'Outro' && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Qual documento? *</Label>
                    <Input
                      value={formData.doc_tipo_outro || ''}
                      onChange={(e) => setFormData({ ...formData, doc_tipo_outro: e.target.value })}
                      placeholder="Ex: Passaporte, RNE..."
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Número do documento</Label>
                  <Input
                    value={
                      formData.doc_tipo === 'CIN'
                        ? formData.cpf
                          ? formatCpf(formData.cpf)
                          : ''
                        : formData.rg || ''
                    }
                    readOnly={formData.doc_tipo === 'CIN'}
                    onChange={(e) => {
                      if (formData.doc_tipo !== 'CIN') {
                        setFormData({ ...formData, rg: e.target.value })
                      }
                    }}
                    placeholder="Número"
                    className={`text-xs h-8 bg-white ${
                      formData.doc_tipo === 'CIN'
                        ? 'bg-slate-100 text-slate-600 cursor-not-allowed font-mono'
                        : ''
                    }`}
                  />
                  {formData.doc_tipo === 'CIN' && (
                    <p className="text-[10px] text-slate-500">Na CIN o número é o próprio CPF</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Órgão emissor</Label>
                  <Input
                    value={formData.rg_orgao_emissor || ''}
                    onChange={(e) => setFormData({ ...formData, rg_orgao_emissor: e.target.value })}
                    placeholder="SSP, DETRAN, CREA, CAU, OAB..."
                    className="text-xs h-8 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">UF</Label>
                  <Select
                    value={formData.rg_uf || ''}
                    onValueChange={(v) => setFormData({ ...formData, rg_uf: v })}
                  >
                    <SelectTrigger className="text-xs h-8 bg-white">
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
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Estado civil</Label>
                <Select
                  value={formData.estado_civil || ''}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      estado_civil: v,
                    })
                  }
                >
                  <SelectTrigger className="text-xs h-8 bg-white">
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
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Profissão</Label>
                <Input
                  value={formData.profissao || ''}
                  onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                  className="text-xs h-8 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Nacionalidade</Label>
                <Input
                  value={formData.nacionalidade || ''}
                  onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
                  placeholder="Ex: Brasileira"
                  className="text-xs h-8 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Data de nascimento</Label>
                <Input
                  type="date"
                  value={formData.data_nascimento || ''}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  className="text-xs h-8 bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Endereço Segmentado com busca ViaCEP e fallback IBGE */}
        {!isPreCadastro && (
          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <EnderecoComCep
              value={endereco}
              onChange={setEndereco}
              label="Endereço Completo do Cliente PF"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Observações do Atendimento</Label>
          <Textarea
            rows={2}
            value={formData.observacoes || ''}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Natureza da demanda, laudo pericial, indicação..."
            className="text-xs bg-white"
          />
        </div>

        {/* Seção LGPD Obrigatória */}
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-950 uppercase">
              Conformidade LGPD — Tratamento de Dados Pessoais
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-emerald-900">
                Base Legal Aplicável (Art. 7º Lei 13.709/2018)
              </Label>
              <Select
                value={formData.base_legal}
                onValueChange={(val: BaseLegalLgpd) =>
                  setFormData({ ...formData, base_legal: val })
                }
              >
                <SelectTrigger className="text-xs h-8 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BASE_LEGAL_LGPD_LABELS) as BaseLegalLgpd[]).map((bl) => (
                    <SelectItem key={bl} value={bl}>
                      {BASE_LEGAL_LGPD_LABELS[bl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-emerald-900">
                Data do Consentimento / Registro
              </Label>
              <Input
                type="date"
                required
                value={formData.data_consentimento}
                onChange={(e) => setFormData({ ...formData, data_consentimento: e.target.value })}
                className="text-xs h-8 bg-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="consentimentoLgpd"
              checked={formData.consentimento_lgpd}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, consentimento_lgpd: Boolean(checked) })
              }
            />
            <Label
              htmlFor="consentimentoLgpd"
              className="text-[11px] leading-tight text-emerald-950 cursor-pointer"
            >
              <strong>Consentimento formal registrado:</strong> O titular autorizou o tratamento de
              seus dados pessoais para execução de serviços de engenharia e emissão de ART/laudos
              conforme as regras de auditoria do sistema
              {isPreCadastro
                ? ' (o aceite formal do titular será coletado no link de cadastro).'
                : '.'}
            </Label>
          </div>
        </div>

        {/* Vínculo opcional a proposta comercial */}
        {!isPreCadastro && (
          <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-blue-600" />
                <Label
                  htmlFor="incluirPropostaPf"
                  className="text-xs font-semibold text-blue-950 cursor-pointer"
                >
                  Vincular proposta comercial inicial agora? (Opcional)
                </Label>
              </div>
              <Switch
                id="incluirPropostaPf"
                checked={incluirProposta}
                onCheckedChange={setIncluirProposta}
              />
            </div>

            {incluirProposta && (
              <div className="space-y-2 pt-2 border-t border-blue-200/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Número Proposta</Label>
                    <Input
                      value={propostaData.numero}
                      onChange={(e) => setPropostaData({ ...propostaData, numero: e.target.value })}
                      className="text-xs h-8 font-mono bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Preço Total (R$)</Label>
                    <Input
                      type="number"
                      step="500"
                      value={propostaData.preco}
                      onChange={(e) =>
                        setPropostaData({
                          ...propostaData,
                          preco: Number(e.target.value) || 0,
                        })
                      }
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Prazo</Label>
                    <Input
                      value={propostaData.prazo}
                      onChange={(e) => setPropostaData({ ...propostaData, prazo: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Escopo Resumido</Label>
                  <Input
                    value={propostaData.escopo}
                    onChange={(e) => setPropostaData({ ...propostaData, escopo: e.target.value })}
                    placeholder="Ex: Laudo técnico de estabilidade estrutural com recolhimento de ART"
                    className="text-xs h-8 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </ModalPadrao>
  )
}
