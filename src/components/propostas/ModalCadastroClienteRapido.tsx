import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { empresasService } from '@/services/empresas'
import { clientesPfService } from '@/services/clientesPf'
import {
  cleanCnpj,
  formatCnpj,
  cleanCpf,
  formatCpf,
  isValidCnpj,
  isValidCpf,
  isValidEmail,
} from '@/lib/cnpj'
import { TelefoneItem } from '@/types'
import { ListaTelefones } from '@/components/comum/ListaTelefones'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'
import { restoreBodyPointerEvents } from '@/lib/utils'
import { Building2, User, Loader2, Mail, ExternalLink, AlertCircle } from 'lucide-react'

interface ModalCadastroClienteRapidoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: 'pj' | 'pf'
  onClienteCadastrado: (novoCliente: { tipo: 'pj' | 'pf'; id: string }) => void
}

export const ModalCadastroClienteRapido: React.FC<ModalCadastroClienteRapidoProps> = ({
  open,
  onOpenChange,
  tipo,
  onClienteCadastrado,
}) => {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [cnpjError, setCnpjError] = useState<string | null>(null)
  const [emailPjError, setEmailPjError] = useState<string | null>(null)
  const [emailPfError, setEmailPfError] = useState<string | null>(null)

  // Formulário PJ
  const [empresaForm, setEmpresaForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    porte: 'EPP',
  })
  const [telefonesPj, setTelefonesPj] = useState<TelefoneItem[]>([])
  const [enderecoPj, setEnderecoPj] = useState<EnderecoValue>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: 'São Paulo',
    uf: 'SP',
  })

  // Formulário PF
  const [clientePfForm, setClientePfForm] = useState({
    nome: '',
    cpf: '',
    email: '',
    base_legal: 'Consentimento do titular (Art. 7º, I da LGPD)',
    consentimento_lgpd: true,
  })
  const [telefonesPf, setTelefonesPf] = useState<TelefoneItem[]>([])
  const [enderecoPf, setEnderecoPf] = useState<EnderecoValue>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  })

  // Validação ao digitar CNPJ
  const handleCnpjChange = (val: string) => {
    const formatado = formatCnpj(val)
    setEmpresaForm((prev) => ({ ...prev, cnpj: formatado }))
    const clean = cleanCnpj(val)
    if (clean.length === 14) {
      if (!isValidCnpj(clean)) {
        setCnpjError('CNPJ inválido: os dígitos verificadores não conferem.')
      } else {
        setCnpjError(null)
      }
    } else {
      setCnpjError(null)
    }
  }

  // Validação ao digitar CPF
  const handleCpfChange = (val: string) => {
    const formatado = formatCpf(val)
    setClientePfForm((prev) => ({ ...prev, cpf: formatado }))
    const clean = cleanCpf(val)
    if (clean.length === 11) {
      if (!isValidCpf(clean)) {
        setCpfError('CPF inválido: os dígitos verificadores não conferem.')
      } else {
        setCpfError(null)
      }
    } else {
      setCpfError(null)
    }
  }

  const handleEmailPjChange = (val: string) => {
    setEmpresaForm((prev) => ({ ...prev, email: val }))
    if (val.trim() && !isValidEmail(val.trim())) {
      setEmailPjError('E-mail comercial inválido.')
    } else {
      setEmailPjError(null)
    }
  }

  const handleEmailPfChange = (val: string) => {
    setClientePfForm((prev) => ({ ...prev, email: val }))
    if (val.trim() && !isValidEmail(val.trim())) {
      setEmailPfError('E-mail inválido.')
    } else {
      setEmailPfError(null)
    }
  }

  // Abertura de cliente de e-mail padrão via mailto:
  const handleEnviarEmail = (destinatario: string) => {
    const cleanEmail = destinatario.trim()
    if (!cleanEmail) {
      toast({
        title: 'E-mail em branco',
        description: 'Digite o endereço de e-mail antes de disparar.',
        variant: 'destructive',
      })
      return
    }
    window.location.href = `mailto:${cleanEmail}`
  }

  const handleSubmitPj = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaForm.razao_social.trim()) {
      toast({ variant: 'destructive', title: 'Razão social obrigatória' })
      return
    }

    const clean = cleanCnpj(empresaForm.cnpj)
    if (clean && (clean.length !== 14 || !isValidCnpj(clean))) {
      toast({
        variant: 'destructive',
        title: 'CNPJ inválido',
        description: 'Corrija os dígitos verificadores do CNPJ.',
      })
      return
    }

    if (empresaForm.email.trim() && !isValidEmail(empresaForm.email.trim())) {
      setEmailPjError('E-mail comercial inválido.')
      toast({
        variant: 'destructive',
        title: 'E-mail inválido',
        description: 'Informe um e-mail comercial válido.',
      })
      return
    }

    setSubmitting(true)
    try {
      // Checar duplicidade no banco por CNPJ
      if (clean) {
        const existente = await empresasService.findByCnpj(clean)
        if (existente) {
          toast({
            variant: 'destructive',
            title: 'Empresa já cadastrada',
            description: `CNPJ já pertence a "${existente.razao_social}".`,
          })
          setSubmitting(false)
          return
        }
      }

      const primeiroTel = telefonesPj[0]?.numero || ''

      const created = await empresasService.create({
        razao_social: empresaForm.razao_social.trim(),
        nome_fantasia: empresaForm.nome_fantasia.trim() || undefined,
        cnpj: formatCnpj(clean) || undefined,
        email: empresaForm.email.trim() || undefined,
        telefone: primeiroTel || undefined,
        telefones: telefonesPj,
        cep: enderecoPj.cep?.trim() || undefined,
        logradouro: enderecoPj.logradouro?.trim() || undefined,
        numero: enderecoPj.numero?.trim() || undefined,
        complemento: enderecoPj.complemento?.trim() || undefined,
        bairro: enderecoPj.bairro?.trim() || undefined,
        uf: enderecoPj.uf || 'SP',
        municipio: enderecoPj.municipio || 'São Paulo',
        porte: empresaForm.porte,
        etapa_funil: 'com_proposta_elaborada',
        status: 'ativa',
        pre_cadastro: true,
        observacoes:
          'Cadastrada via janela rápida na elaboração de proposta (pré-cadastro até o aceite).',
      })

      toast({
        title: 'Empresa cadastrada!',
        description: `${created.razao_social} selecionada na proposta.`,
      })
      onClienteCadastrado({ tipo: 'pj', id: created.id })
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar empresa',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitPf = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientePfForm.nome.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' })
      return
    }
    const clean = cleanCpf(clientePfForm.cpf)
    if (clean && (clean.length !== 11 || !isValidCpf(clean))) {
      toast({
        variant: 'destructive',
        title: 'CPF inválido',
        description: 'Corrija os dígitos verificadores do CPF.',
      })
      return
    }
    if (clientePfForm.email.trim() && !isValidEmail(clientePfForm.email.trim())) {
      setEmailPfError('E-mail inválido.')
      toast({
        variant: 'destructive',
        title: 'E-mail inválido',
        description: 'Informe um endereço de e-mail válido.',
      })
      return
    }
    if (!clientePfForm.consentimento_lgpd) {
      toast({
        variant: 'destructive',
        title: 'Consentimento obrigatório',
        description: 'É necessário registrar o consentimento LGPD do cliente.',
      })
      return
    }

    setSubmitting(true)
    try {
      const primeiroTel = telefonesPf[0]?.numero || ''

      // Monta string de endereço compatível com o legado para visualizações antigas
      const partesEndereco = [
        enderecoPf.logradouro,
        enderecoPf.numero ? `nº ${enderecoPf.numero}` : '',
        enderecoPf.complemento,
        enderecoPf.bairro,
        enderecoPf.municipio && enderecoPf.uf ? `${enderecoPf.municipio}/${enderecoPf.uf}` : '',
        enderecoPf.cep ? `CEP ${enderecoPf.cep}` : '',
      ].filter(Boolean)
      const enderecoTexto = partesEndereco.join(', ')

      const created = await clientesPfService.create({
        nome: clientePfForm.nome.trim(),
        cpf: formatCpf(clean) || '',
        email: clientePfForm.email.trim() || undefined,
        telefone: primeiroTel || undefined,
        telefones: telefonesPf,
        cep: enderecoPf.cep?.trim() || undefined,
        logradouro: enderecoPf.logradouro?.trim() || undefined,
        numero: enderecoPf.numero?.trim() || undefined,
        complemento: enderecoPf.complemento?.trim() || undefined,
        bairro: enderecoPf.bairro?.trim() || undefined,
        municipio: enderecoPf.municipio?.trim() || undefined,
        uf: enderecoPf.uf?.trim() || undefined,
        endereco: enderecoTexto || undefined,
        base_legal: clientePfForm.base_legal,
        consentimento_lgpd: true,
        data_consentimento: new Date().toISOString(),
        pre_cadastro: true,
        observacoes:
          'Cadastrado via janela rápida na elaboração de proposta (pré-cadastro até o aceite).',
      })

      toast({
        title: 'Cliente PF cadastrado!',
        description: `${created.nome} selecionado na proposta.`,
      })
      onClienteCadastrado({ tipo: 'pf', id: created.id })
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar cliente PF',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) restoreBodyPointerEvents()
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={() => restoreBodyPointerEvents()}
      >
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {tipo === 'pj' ? (
              <>
                <Building2 className="w-5 h-5 text-orange-600" />
                Cadastrar Nova Empresa (PJ)
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-orange-600" />
                Cadastrar Novo Cliente Pessoa Física (PF)
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cadastro rápido completo com múltiplos telefones (WhatsApp), e-mail direto e endereço
            com busca automática por CEP. Ao salvar, o cliente será selecionado na proposta.
          </DialogDescription>
        </DialogHeader>

        {tipo === 'pj' ? (
          <form onSubmit={handleSubmitPj} className="space-y-4 pt-2 text-xs">
            {/* Razão Social e Fantasia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Razão Social *</Label>
                <Input
                  required
                  value={empresaForm.razao_social}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, razao_social: e.target.value })}
                  placeholder="Ex: Construtora Exemplo Ltda"
                  className="text-xs h-9 bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome Fantasia</Label>
                <Input
                  value={empresaForm.nome_fantasia}
                  onChange={(e) =>
                    setEmpresaForm({ ...empresaForm, nome_fantasia: e.target.value })
                  }
                  placeholder="Ex: Exemplo Engenharia"
                  className="text-xs h-9 bg-white"
                />
              </div>
            </div>

            {/* CNPJ e E-mail com botão Enviar E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  value={empresaForm.cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className={`text-xs h-9 font-mono bg-white ${cnpjError ? 'border-red-500' : ''}`}
                />
                {cnpjError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {cnpjError}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail Comercial (Único)</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="email"
                    value={empresaForm.email}
                    onChange={(e) => handleEmailPjChange(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className={`text-xs h-9 bg-white flex-1 ${emailPjError ? 'border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleEnviarEmail(empresaForm.email)}
                    disabled={!empresaForm.email.trim() || Boolean(emailPjError)}
                    className="h-9 px-2.5 text-xs text-blue-700 hover:bg-blue-50 border-blue-200 gap-1 shrink-0"
                    title="Abrir no cliente de e-mail padrão (mailto:)"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </Button>
                </div>
                {emailPjError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {emailPjError}
                  </span>
                )}
              </div>
            </div>

            {/* Múltiplos Telefones (WhatsApp on/off) */}
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
              <ListaTelefones
                telefones={telefonesPj}
                onChange={setTelefonesPj}
                label="Telefones da Empresa"
                helperText="Múltiplos números com máscara e interruptor WhatsApp."
              />
            </div>

            {/* Endereço Segmentado com busca ViaCEP e fallback IBGE */}
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
              <EnderecoComCep
                value={enderecoPj}
                onChange={setEnderecoPj}
                label="Endereço da Empresa"
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || Boolean(cnpjError) || Boolean(emailPjError)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar e Selecionar Empresa
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmitPf} className="space-y-4 pt-2 text-xs">
            {/* Nome e CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome Completo *</Label>
                <Input
                  required
                  value={clientePfForm.nome}
                  onChange={(e) => setClientePfForm({ ...clientePfForm, nome: e.target.value })}
                  placeholder="Ex: Carlos Alberto Silveira"
                  className="text-xs h-9 bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input
                  value={clientePfForm.cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className={`text-xs h-9 font-mono bg-white ${cpfError ? 'border-red-500' : ''}`}
                />
                {cpfError && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {cpfError}
                  </span>
                )}
              </div>
            </div>

            {/* E-mail com botão Enviar E-mail */}
            <div className="space-y-1">
              <Label className="text-xs">E-mail do Cliente (Único)</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="email"
                  value={clientePfForm.email}
                  onChange={(e) => handleEmailPfChange(e.target.value)}
                  placeholder="cliente@email.com"
                  className={`text-xs h-9 bg-white flex-1 ${emailPfError ? 'border-red-500' : ''}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleEnviarEmail(clientePfForm.email)}
                  disabled={!clientePfForm.email.trim() || Boolean(emailPfError)}
                  className="h-9 px-2.5 text-xs text-blue-700 hover:bg-blue-50 border-blue-200 gap-1 shrink-0"
                  title="Abrir no cliente de e-mail padrão (mailto:)"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </div>
              {emailPfError && (
                <span className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailPfError}
                </span>
              )}
            </div>

            {/* Múltiplos Telefones (WhatsApp on/off) */}
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
              <ListaTelefones
                telefones={telefonesPf}
                onChange={setTelefonesPf}
                label="Telefones do Cliente PF"
                helperText="Adicione celulares e fixos com indicação de WhatsApp."
              />
            </div>

            {/* Endereço Segmentado com busca ViaCEP e fallback IBGE */}
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
              <EnderecoComCep
                value={enderecoPf}
                onChange={setEnderecoPf}
                label="Endereço do Cliente PF"
              />
            </div>

            {/* LGPD */}
            <div className="p-2.5 rounded bg-orange-50/70 border border-orange-200 space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="lgpdConsent"
                  checked={clientePfForm.consentimento_lgpd}
                  onCheckedChange={(c) =>
                    setClientePfForm({ ...clientePfForm, consentimento_lgpd: !!c })
                  }
                />
                <Label
                  htmlFor="lgpdConsent"
                  className="text-[11px] leading-snug cursor-pointer font-normal text-slate-700"
                >
                  O titular autorizou expressamente o tratamento dos seus dados para fins de
                  orçamento e execução de serviços de engenharia (LGPD).
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || Boolean(cpfError) || Boolean(emailPfError)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar e Selecionar Cliente PF
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
