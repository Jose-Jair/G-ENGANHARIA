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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, FilePlus2, Loader2, Sparkles } from 'lucide-react'
import { formatCnpj, isValidCnpj, cleanCnpj, formatPhoneBr } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import { parceirosService, CreateParceiroDiretoData } from '@/services/parceiros'
import { useAuth } from '@/contexts/AuthContext'

interface ModalCriarParceiroProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ModalCriarParceiro({ open, onOpenChange, onSuccess }: ModalCriarParceiroProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)

  const [formData, setFormData] = useState<CreateParceiroDiretoData>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    cnae: '',
    porte: 'MEDIO',
    uf: 'SP',
    municipio: '',
    email: '',
    telefone: '',
    observacoes: '',
  })

  // Vínculo opcional a proposta comercial (A1b)
  const [incluirProposta, setIncluirProposta] = useState(false)
  const [propostaData, setPropostaData] = useState({
    numero: `PROP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    escopo: '',
    preco: 150000,
    prazo: '45 dias',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.razao_social.trim()) {
      toast({
        title: 'Razão Social obrigatória',
        description: 'Informe o nome empresarial do parceiro demandante.',
        variant: 'destructive',
      })
      return
    }

    if (formData.cnpj && !isValidCnpj(formData.cnpj)) {
      toast({
        title: 'CNPJ inválido',
        description: 'Verifique os números e dígitos verificadores do CNPJ informado.',
        variant: 'destructive',
      })
      return
    }

    if (incluirProposta && !propostaData.escopo.trim()) {
      toast({
        title: 'Escopo da proposta obrigatório',
        description: 'Preencha a descrição do escopo da proposta comercial vinculada.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await parceirosService.createParceiroDireto(
        {
          ...formData,
          propostaOpcional: incluirProposta
            ? {
                numero: propostaData.numero,
                escopo: propostaData.escopo,
                preco: Number(propostaData.preco) || 0,
                prazo: propostaData.prazo,
              }
            : undefined,
        },
        user?.id,
      )

      toast({
        title: 'Parceiro Demandante cadastrado!',
        description: incluirProposta
          ? 'Empresa parceira cadastrada e proposta comercial vinculada com sucesso.'
          : 'Empresa cadastrada diretamente como parceira demandante.',
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar parceiro.'
      toast({
        title: 'Erro ao cadastrar parceiro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Novo Parceiro Demandante (Cadastro Direto)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cadastre uma empresa diretamente como Parceira Demandante. Conforme item A1(b), o
            vínculo a uma proposta comercial é opcional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">
                Razão Social <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                placeholder="Ex: Construtora e Obras de Arte Especiais S.A."
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome Fantasia</Label>
              <Input
                value={formData.nome_fantasia || ''}
                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                placeholder="Ex: OAE Engenharia"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input
                value={formatCnpj(formData.cnpj)}
                onChange={(e) => setFormData({ ...formData, cnpj: cleanCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Porte</Label>
              <Select
                value={formData.porte}
                onValueChange={(val) => setFormData({ ...formData, porte: val })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEQUENO">Pequeno Porte</SelectItem>
                  <SelectItem value="MEDIO">Médio Porte</SelectItem>
                  <SelectItem value="GRANDE">Grande Porte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CNAE Principal</Label>
              <Input
                value={formData.cnae || ''}
                onChange={(e) => setFormData({ ...formData, cnae: e.target.value })}
                placeholder="Ex: 42.11-1-01 - Rodovias e ferrovias"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Município</Label>
              <Input
                value={formData.municipio || ''}
                onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                placeholder="Ex: São Paulo"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">UF</Label>
              <Input
                value={formData.uf || ''}
                maxLength={2}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                placeholder="SP"
                className="text-xs h-9 uppercase font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">E-mail Comercial</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="comercial@parceiro.com.br"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={formatPhoneBr(formData.telefone)}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 3344-5566"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Observações Operacionais</Label>
              <Textarea
                rows={2}
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Demandas típicas, áreas de terceirização solicitadas..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Vínculo opcional a proposta comercial */}
          <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-blue-600" />
                <Label
                  htmlFor="incluirProposta"
                  className="text-xs font-semibold text-blue-950 cursor-pointer"
                >
                  Vincular proposta comercial inicial agora? (Opcional)
                </Label>
              </div>
              <Switch
                id="incluirProposta"
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
                      step="1000"
                      value={propostaData.preco}
                      onChange={(e) =>
                        setPropostaData({ ...propostaData, preco: Number(e.target.value) || 0 })
                      }
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Prazo de Execução</Label>
                    <Input
                      value={propostaData.prazo}
                      onChange={(e) => setPropostaData({ ...propostaData, prazo: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Escopo Resumido da Demanda</Label>
                  <Input
                    value={propostaData.escopo}
                    onChange={(e) => setPropostaData({ ...propostaData, escopo: e.target.value })}
                    placeholder="Ex: Projeto executivo de contenção com laudos geológicos e ART"
                    className="text-xs h-8 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-xs"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gravando...
                </>
              ) : (
                'Salvar Parceiro'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
