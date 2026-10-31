import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { projetosService, CreateProjetoData } from '@/services/projetos'
import { empresasService } from '@/services/empresas'
import { clientesPfService } from '@/services/clientesPf'
import { EmpresaRecord, ClientePfRecord, SaudeProjeto } from '@/types'
import { Loader2 } from 'lucide-react'

interface ModalCriarProjetoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const ModalCriarProjeto: React.FC<ModalCriarProjetoProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [clientesPf, setClientesPf] = useState<ClientePfRecord[]>([])

  const [tipoCliente, setTipoCliente] = useState<'pj' | 'pf'>('pj')
  const [clienteId, setClienteId] = useState('')
  const [nome, setNome] = useState('')
  const [disciplinas, setDisciplinas] = useState('')
  const [valorTotal, setValorTotal] = useState<string>('')
  const [prazoFinal, setPrazoFinal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saude, setSaude] = useState<SaudeProjeto>('verde')
  const [justificativaSaude, setJustificativaSaude] = useState('')

  React.useEffect(() => {
    if (open) {
      Promise.all([empresasService.list(), clientesPfService.list()])
        .then(([emps, pfs]) => {
          setEmpresas(emps.filter((e) => e.status === 'ativa'))
          setClientesPf(pfs)
        })
        .catch(() => {})
    }
  }, [open])

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do projeto.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateProjetoData = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        disciplinas: disciplinas.trim() || undefined,
        empresa: tipoCliente === 'pj' && clienteId ? clienteId : undefined,
        cliente_pf: tipoCliente === 'pf' && clienteId ? clienteId : undefined,
        valor_total: valorTotal ? parseFloat(valorTotal.replace(',', '.')) : 0,
        prazo_final: prazoFinal ? `${prazoFinal} 23:59:59.000Z` : undefined,
        saude,
        justificativa_saude: justificativaSaude.trim() || 'Cadastro direto inicial do projeto',
        status: 'em_andamento',
        subcontratacao_autorizada: true,
      }

      await projetosService.create(payload)
      toast({ title: 'Projeto cadastrado com sucesso!' })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar projeto',
        description: err.message || 'Falha ao salvar dados no servidor',
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
          <DialogTitle className="text-xl font-bold text-slate-900">
            Novo Projeto de Engenharia (Cadastro Direto)
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Cadastre um projeto diretamente no sistema com código sequencial automático
            PRJ-AAAA-NNNN.
          </p>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="nome">Nome do Projeto *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Execução de Projetos Complementares do Hospital Regional"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Cliente</Label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoCliente"
                    checked={tipoCliente === 'pj'}
                    onChange={() => {
                      setTipoCliente('pj')
                      setClienteId('')
                    }}
                  />
                  Pessoa Jurídica (Empresa)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoCliente"
                    checked={tipoCliente === 'pf'}
                    onChange={() => {
                      setTipoCliente('pf')
                      setClienteId('')
                    }}
                  />
                  Pessoa Física (Cliente PF)
                </label>
              </div>
            </div>

            <div>
              <Label>{tipoCliente === 'pj' ? 'Empresa / Parceiro' : 'Cliente PF'}</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {tipoCliente === 'pj'
                    ? empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome_fantasia || emp.razao_social}
                        </SelectItem>
                      ))
                    : clientesPf.map((pf) => (
                        <SelectItem key={pf.id} value={pf.id}>
                          {pf.nome} ({pf.cpf})
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="disciplinas">Disciplinas Atendidas</Label>
              <Input
                id="disciplinas"
                value={disciplinas}
                onChange={(e) => setDisciplinas(e.target.value)}
                placeholder="Ex: Estrutural, Elétrica, Hidro"
              />
            </div>
            <div>
              <Label htmlFor="valor">Valor Total do Projeto (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="prazo">Prazo Final Previsto</Label>
              <Input
                id="prazo"
                type="date"
                value={prazoFinal}
                onChange={(e) => setPrazoFinal(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <Label>Saúde do Projeto</Label>
              <Select value={saude} onValueChange={(val: SaudeProjeto) => setSaude(val)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verde">🟢 Verde (No prazo / Estável)</SelectItem>
                  <SelectItem value="amarelo">🟡 Amarelo (Atenção / Riscos)</SelectItem>
                  <SelectItem value="vermelho">🔴 Vermelho (Crítico / Atrasado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="just">Justificativa da Saúde *</Label>
              <Input
                id="just"
                value={justificativaSaude}
                onChange={(e) => setJustificativaSaude(e.target.value)}
                placeholder="Ex: Escopo alinhado, sem pendências"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="desc">Observações / Escopo Geral</Label>
            <Textarea
              id="desc"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva detalhes ou diretrizes contratuais relevantes..."
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar Projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
