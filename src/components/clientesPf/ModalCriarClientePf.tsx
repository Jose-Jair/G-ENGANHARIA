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
import { User, ShieldCheck, FilePlus2, Loader2, AlertCircle, Mail } from 'lucide-react'
import { formatCpf, isValidCpf, cleanCpf } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { clientesPfService, CreateClientePfData } from '@/services/clientesPf'
import { BASE_LEGAL_LGPD_LABELS, BaseLegalLgpd, TelefoneItem } from '@/types'
import { ListaTelefones } from '@/components/comum/ListaTelefones'
import { EnderecoComCep, EnderecoValue } from '@/components/comum/EnderecoComCep'

interface ModalCriarClientePfProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ModalCriarClientePf({ open, onOpenChange, onSuccess }: ModalCriarClientePfProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [cpfError, setCpfError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreateClientePfData>({
    nome: '',
    cpf: '',
    email: '',
    base_legal: 'consentimento',
    consentimento_lgpd: true,
    data_consentimento: new Date().toISOString().split('T')[0],
    observacoes: '',
  })

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

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = cleanCpf(e.target.value)
    setFormData((prev) => ({ ...prev, cpf: raw }))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome completo do cliente Pessoa Física.',
        variant: 'destructive',
      })
      return
    }

    const clean = cleanCpf(formData.cpf)
    if (!clean || clean.length !== 11 || !isValidCpf(clean)) {
      setCpfError('Informe um CPF válido com 11 dígitos.')
      toast({
        title: 'CPF inválido',
        description: 'Dígitos verificadores do CPF informados não conferem.',
        variant: 'destructive',
      })
      return
    }

    if (!formData.consentimento_lgpd) {
      toast({
        title: 'Consentimento LGPD obrigatório',
        description: 'O registro de consentimento LGPD é obrigatório conforme norma interna.',
        variant: 'destructive',
      })
      return
    }

    if (incluirProposta && !propostaData.escopo.trim()) {
      toast({
        title: 'Escopo da proposta obrigatório',
        description: 'Preencha o escopo da proposta comercial vinculada ao cliente PF.',
        variant: 'destructive',
      })
      return
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

    setSalvando(true)
    try {
      await clientesPfService.create({
        ...formData,
        cpf: formatCpf(formData.cpf),
        telefones,
        cep: endereco.cep?.trim() || undefined,
        logradouro: endereco.logradouro?.trim() || undefined,
        numero: endereco.numero?.trim() || undefined,
        complemento: endereco.complemento?.trim() || undefined,
        bairro: endereco.bairro?.trim() || undefined,
        municipio: endereco.municipio?.trim() || undefined,
        uf: endereco.uf?.trim() || undefined,
        endereco: enderecoTexto || undefined,
        propostaOpcional: incluirProposta
          ? {
              numero: propostaData.numero,
              escopo: propostaData.escopo,
              preco: Number(propostaData.preco) || 0,
              prazo: propostaData.prazo,
            }
          : undefined,
      })

      toast({
        title: 'Cliente PF cadastrado com sucesso!',
        description: 'Cadastro realizado e registro auditado com consentimento LGPD.',
      })

      onOpenChange(false)
      onSuccess()
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
            disabled={salvando || Boolean(cpfError)}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Cliente PF'
            )}
          </Button>
        </>
      }
    >
      <form id="form-criar-cliente-pf" onSubmit={handleSubmit} className="space-y-4">
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
        </div>

        {/* Múltiplos Telefones com WhatsApp */}
        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
          <ListaTelefones
            telefones={telefones}
            onChange={setTelefones}
            label="Telefones do Cliente PF"
            helperText="Adicione múltiplos números (fixo ou celular) com interruptor WhatsApp."
          />
        </div>

        {/* Endereço Segmentado com busca ViaCEP e fallback IBGE */}
        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
          <EnderecoComCep
            value={endereco}
            onChange={setEndereco}
            label="Endereço Completo do Cliente PF"
          />
        </div>

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
              conforme as regras de auditoria do sistema.
            </Label>
          </div>
        </div>

        {/* Vínculo opcional a proposta comercial */}
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
      </form>
    </ModalPadrao>
  )
}
