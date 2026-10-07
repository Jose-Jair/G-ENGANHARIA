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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { empresasService } from '@/services/empresas'
import { clientesPfService } from '@/services/clientesPf'
import { cleanCnpj, formatCnpj, cleanCpf, formatCpf } from '@/lib/cnpj'
import { EmpresaRecord, ClientePfRecord } from '@/types'
import { Building2, User, Loader2 } from 'lucide-react'

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

  // Formulário PJ
  const [empresaForm, setEmpresaForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    uf: 'SP',
    municipio: 'São Paulo',
    porte: 'EPP',
  })

  // Formulário PF
  const [clientePfForm, setClientePfForm] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    endereco: '',
    base_legal: 'Consentimento do titular (Art. 7º, I da LGPD)',
    consentimento_lgpd: true,
  })

  const handleSubmitPj = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaForm.razao_social.trim()) {
      toast({ variant: 'destructive', title: 'Razão social obrigatória' })
      return
    }

    setSubmitting(true)
    try {
      const created = await empresasService.create({
        razao_social: empresaForm.razao_social.trim(),
        nome_fantasia: empresaForm.nome_fantasia.trim() || undefined,
        cnpj: formatCnpj(cleanCnpj(empresaForm.cnpj)),
        email: empresaForm.email.trim() || undefined,
        telefone: empresaForm.telefone.trim() || undefined,
        uf: empresaForm.uf,
        municipio: empresaForm.municipio,
        porte: empresaForm.porte,
        etapa_funil: 'com_proposta_elaborada',
        status: 'ativa',
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
      const created = await clientesPfService.create({
        nome: clientePfForm.nome.trim(),
        cpf: clientePfForm.cpf ? formatCpf(cleanCpf(clientePfForm.cpf)) : undefined,
        email: clientePfForm.email.trim() || undefined,
        telefone: clientePfForm.telefone.trim() || undefined,
        endereco: clientePfForm.endereco.trim() || undefined,
        base_legal: clientePfForm.base_legal,
        consentimento_lgpd: true,
        data_consentimento: new Date().toISOString(),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            Cadastro rápido sem sair da proposta. Ao concluir, o cliente já será selecionado
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        {tipo === 'pj' ? (
          <form onSubmit={handleSubmitPj} className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Razão Social *</Label>
              <Input
                required
                value={empresaForm.razao_social}
                onChange={(e) => setEmpresaForm({ ...empresaForm, razao_social: e.target.value })}
                placeholder="Ex: Construtora Exemplo Ltda"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome Fantasia</Label>
                <Input
                  value={empresaForm.nome_fantasia}
                  onChange={(e) =>
                    setEmpresaForm({ ...empresaForm, nome_fantasia: e.target.value })
                  }
                  placeholder="Ex: Exemplo Engenharia"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  value={empresaForm.cnpj}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">E-mail Comercial</Label>
                <Input
                  type="email"
                  value={empresaForm.email}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })}
                  placeholder="contato@empresa.com.br"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={empresaForm.telefone}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">UF</Label>
                <Input
                  maxLength={2}
                  value={empresaForm.uf}
                  onChange={(e) =>
                    setEmpresaForm({ ...empresaForm, uf: e.target.value.toUpperCase() })
                  }
                  className="text-xs h-9 uppercase"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Município</Label>
                <Input
                  value={empresaForm.municipio}
                  onChange={(e) => setEmpresaForm({ ...empresaForm, municipio: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar e Selecionar
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmitPf} className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo *</Label>
              <Input
                required
                value={clientePfForm.nome}
                onChange={(e) => setClientePfForm({ ...clientePfForm, nome: e.target.value })}
                placeholder="Ex: João da Silva Santos"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input
                  value={clientePfForm.cpf}
                  onChange={(e) => setClientePfForm({ ...clientePfForm, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  value={clientePfForm.telefone}
                  onChange={(e) => setClientePfForm({ ...clientePfForm, telefone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={clientePfForm.email}
                onChange={(e) => setClientePfForm({ ...clientePfForm, email: e.target.value })}
                placeholder="cliente@email.com"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Endereço Completo</Label>
              <Input
                value={clientePfForm.endereco}
                onChange={(e) => setClientePfForm({ ...clientePfForm, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade - UF"
                className="text-xs h-9"
              />
            </div>

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

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar e Selecionar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
