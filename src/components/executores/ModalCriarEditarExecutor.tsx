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
import { executoresService, CreateExecutorData } from '@/services/executores'
import { TipoExecutor, ConselhoClasse, StatusExecutor, ExecutorRecord } from '@/types'
import {
  isValidCpf,
  isValidCnpj,
  formatCpf,
  formatCnpj,
  cleanCpf,
  cleanCnpj,
  formatPhoneBr,
  isValidPhoneBr,
  isValidEmail,
  cleanPhoneForWa,
} from '@/lib/cnpj'
import { Loader2, AlertCircle } from 'lucide-react'

interface ModalCriarEditarExecutorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executorParaEditar?: ExecutorRecord | null
  onSuccess: () => void
}

export const ModalCriarEditarExecutor: React.FC<ModalCriarEditarExecutorProps> = ({
  open,
  onOpenChange,
  executorParaEditar,
  onSuccess,
}) => {
  const { toast } = useToast()
  const isEditing = !!executorParaEditar

  const [salvando, setSalvando] = useState(false)
  const [tipo, setTipo] = useState<TipoExecutor>('PJ')
  const [nome, setNome] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [emailInvalido, setEmailInvalido] = useState(false)
  const [telefoneInvalido, setTelefoneInvalido] = useState(false)
  const [conselho, setConselho] = useState<ConselhoClasse>('CREA')
  const [numeroRegistro, setNumeroRegistro] = useState('')
  const [conselhoValidade, setConselhoValidade] = useState('')
  const [disciplinas, setDisciplinas] = useState('')
  const [regiao, setRegiao] = useState('')
  const [capacidadeSimultanea, setCapacidadeSimultanea] = useState('3')
  const [dadosBancarios, setDadosBancarios] = useState('')
  const [status, setStatus] = useState<StatusExecutor>('homologacao')
  const [motivoSuspensao, setMotivoSuspensao] = useState('')
  const [ndaContrato, setNdaContrato] = useState<File | null>(null)

  React.useEffect(() => {
    if (open) {
      if (executorParaEditar) {
        setTipo(executorParaEditar.tipo)
        setNome(executorParaEditar.nome)
        setCpfCnpj(executorParaEditar.cpf_cnpj || '')
        setEmail(executorParaEditar.email || '')
        setTelefone(
          executorParaEditar.telefone ? formatPhoneBr(executorParaEditar.telefone, true) : '',
        )
        setEmailInvalido(false)
        setTelefoneInvalido(false)
        setConselho(executorParaEditar.conselho || 'CREA')
        setNumeroRegistro(executorParaEditar.numero_registro || '')
        setConselhoValidade(
          executorParaEditar.conselho_validade
            ? executorParaEditar.conselho_validade.substring(0, 10)
            : '',
        )
        setDisciplinas(executorParaEditar.disciplinas || '')
        setRegiao(executorParaEditar.regiao || '')
        setCapacidadeSimultanea(String(executorParaEditar.capacidade_simultanea ?? 3))
        setDadosBancarios(executorParaEditar.dados_bancarios || '')
        setStatus(executorParaEditar.status)
        setMotivoSuspensao(executorParaEditar.motivo_suspensao || '')
        setNdaContrato(null)
      } else {
        setTipo('PJ')
        setNome('')
        setCpfCnpj('')
        setEmail('')
        setTelefone('')
        setEmailInvalido(false)
        setTelefoneInvalido(false)
        setConselho('CREA')
        setNumeroRegistro('')
        setConselhoValidade('')
        setDisciplinas('')
        setRegiao('')
        setCapacidadeSimultanea('3')
        setDadosBancarios('')
        setStatus('homologacao')
        setMotivoSuspensao('')
        setNdaContrato(null)
      }
    }
  }, [open, executorParaEditar])

  const handleCpfCnpjChange = (val: string) => {
    if (tipo === 'PF') {
      const clean = cleanCpf(val)
      setCpfCnpj(clean.length <= 11 ? formatCpf(clean) : val)
    } else {
      const clean = cleanCnpj(val)
      setCpfCnpj(clean.length <= 14 ? formatCnpj(clean) : val)
    }
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (val.trim()) {
      setEmailInvalido(!isValidEmail(val.trim()))
    } else {
      setEmailInvalido(false)
    }
  }

  const handleTelefoneChange = (val: string) => {
    const fmt = formatPhoneBr(val, true)
    setTelefone(fmt)
    if (fmt.trim()) {
      setTelefoneInvalido(!isValidPhoneBr(fmt))
    } else {
      setTelefoneInvalido(false)
    }
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do executor.',
        variant: 'destructive',
      })
      return
    }

    // Validação de CPF ou CNPJ
    if (cpfCnpj.trim()) {
      if (tipo === 'PF' && !isValidCpf(cpfCnpj)) {
        toast({
          title: 'CPF Inválido',
          description: 'Por favor, informe um CPF válido.',
          variant: 'destructive',
        })
        return
      }
      if (tipo === 'PJ' && !isValidCnpj(cpfCnpj)) {
        toast({
          title: 'CNPJ Inválido',
          description: 'Por favor, informe um CNPJ válido.',
          variant: 'destructive',
        })
        return
      }
    }

    // Validação de E-mail
    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailInvalido(true)
      toast({
        title: 'E-mail Inválido',
        description: 'Informe um endereço de e-mail válido.',
        variant: 'destructive',
      })
      return
    }

    // Validação de Telefone
    if (telefone.trim() && !isValidPhoneBr(telefone.trim())) {
      setTelefoneInvalido(true)
      toast({
        title: 'Telefone Inválido',
        description: 'Informe um número de telefone com DDD válido (+55).',
        variant: 'destructive',
      })
      return
    }

    // Validação de Validade de Conselho não pode ser no passado no ato do cadastro
    if (conselhoValidade) {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const dtVal = new Date(conselhoValidade.substring(0, 10) + 'T23:59:59.000Z')
      if (dtVal < hoje) {
        toast({
          title: 'Validade do Conselho Inválida',
          description:
            'A validade do registro de classe não pode estar no passado no ato do cadastro.',
          variant: 'destructive',
        })
        return
      }
    }

    if (status === 'suspenso' && !motivoSuspensao.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo para suspensão do executor (ação auditada).',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const payload: CreateExecutorData = {
        tipo,
        nome: nome.trim(),
        cpf_cnpj: cpfCnpj.trim() || undefined,
        email: email.trim() || undefined,
        telefone: telefone.trim() ? cleanPhoneForWa(telefone.trim()) : undefined,
        conselho,
        numero_registro: numeroRegistro.trim() || undefined,
        conselho_validade: conselhoValidade ? `${conselhoValidade} 23:59:59.000Z` : undefined,
        disciplinas: disciplinas.trim() || undefined,
        regiao: regiao.trim() || undefined,
        capacidade_simultanea: parseInt(capacidadeSimultanea, 10) || 1,
        dados_bancarios: dadosBancarios.trim() || undefined,
        status,
        motivo_suspensao: status === 'suspenso' ? motivoSuspensao.trim() : undefined,
        nda_contrato: ndaContrato || undefined,
      }

      if (isEditing && executorParaEditar) {
        await executoresService.update(executorParaEditar.id, payload)
        toast({ title: 'Executor atualizado com sucesso!' })
      } else {
        await executoresService.create(payload)
        toast({ title: 'Executor cadastrado com sucesso!' })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar executor',
        description: err.message,
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
            {isEditing ? 'Editar Executor Técnico' : 'Novo Executor Técnico'}
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Profissional ou empresa de engenharia parceira com validação de conselho e capacidade
            simultânea.
          </p>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          {/* Tipo e Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select
                value={tipo}
                onValueChange={(val: TipoExecutor) => {
                  setTipo(val)
                  setCpfCnpj('')
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                  <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="nomeExec">
                {tipo === 'PJ'
                  ? 'Razão Social / Nome Fantasia *'
                  : 'Nome Completo do Profissional *'}
              </Label>
              <Input
                id="nomeExec"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={
                  tipo === 'PJ'
                    ? 'Ex: Geotécnica & Estruturas Ltda'
                    : 'Ex: Eng. Carlos Eduardo Mendes'
                }
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cpfCnpj">{tipo === 'PF' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                id="cpfCnpj"
                value={cpfCnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="emailExec">E-mail de Contato</Label>
              <Input
                id="emailExec"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="contato@executor.com.br"
                className={`mt-1 ${emailInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''}`}
              />
              {emailInvalido && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  E-mail inválido.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="telExec">Telefone / WhatsApp</Label>
              <Input
                id="telExec"
                value={telefone}
                onChange={(e) => handleTelefoneChange(e.target.value)}
                placeholder="+55 (11) 98765-4321"
                className={`mt-1 ${telefoneInvalido ? 'border-rose-500 focus-visible:ring-rose-400' : ''}`}
              />
              {telefoneInvalido && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Telefone inválido (+55).
                </p>
              )}
            </div>
          </div>

          {/* Conselho de Classe e Validade */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">
              Habilitação Profissional (Conselho de Classe)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Conselho de Classe</Label>
                <Select value={conselho} onValueChange={(val: ConselhoClasse) => setConselho(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREA">CREA (Engenharia e Agronomia)</SelectItem>
                    <SelectItem value="CAU">CAU (Arquitetura e Urbanismo)</SelectItem>
                    <SelectItem value="CFT">CFT (Conselho Federal dos Técnicos)</SelectItem>
                    <SelectItem value="OUTRO">Outro Conselho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="numReg">Nº de Registro Profissional</Label>
                <Input
                  id="numReg"
                  value={numeroRegistro}
                  onChange={(e) => setNumeroRegistro(e.target.value)}
                  placeholder="Ex: 506.123.456-SP"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="valReg">Validade da Anotação / Registro</Label>
                <Input
                  id="valReg"
                  type="date"
                  value={conselhoValidade}
                  onChange={(e) => setConselhoValidade(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Disciplinas, Região e Capacidade Simultânea */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="discExec">Disciplinas Atendidas</Label>
              <Input
                id="discExec"
                value={disciplinas}
                onChange={(e) => setDisciplinas(e.target.value)}
                placeholder="Ex: Estrutural, Elétrica"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="regiaoExec">Região de Atuação</Label>
              <Input
                id="regiaoExec"
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                placeholder="Ex: Sudeste / SP / Remoto"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="capSim">Capacidade Simultânea (Projetos)</Label>
              <Input
                id="capSim"
                type="number"
                min="1"
                max="20"
                value={capacidadeSimultanea}
                onChange={(e) => setCapacidadeSimultanea(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Dados Bancários e NDA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bancoExec">Dados Bancários / Chave PIX</Label>
              <Textarea
                id="bancoExec"
                rows={2}
                value={dadosBancarios}
                onChange={(e) => setDadosBancarios(e.target.value)}
                placeholder="Banco, Agência, Conta e Chave PIX para pagamentos..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ndaFile">NDA / Contrato de Prestação (PDF)</Label>
              <Input
                id="ndaFile"
                type="file"
                onChange={(e) => setNdaContrato(e.target.files?.[0] || null)}
                className="mt-1 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Acordo de Confidencialidade e Termo de Subcontratação assinado.
              </span>
            </div>
          </div>

          {/* Status e Motivo de Suspensão */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Status do Executor</Label>
                <Select value={status} onValueChange={(val: StatusExecutor) => setStatus(val)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (Em análise)</SelectItem>
                    <SelectItem value="ativo">Ativo (Habilitado)</SelectItem>
                    <SelectItem value="suspenso">Suspenso (Bloqueado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {status === 'suspenso' && (
                <div className="md:col-span-2">
                  <Label htmlFor="motivoSusp">Motivo da Suspensão *</Label>
                  <Input
                    id="motivoSusp"
                    value={motivoSuspensao}
                    onChange={(e) => setMotivoSuspensao(e.target.value)}
                    placeholder="Ex: Registro vencido não regularizado / Descumprimento de prazo"
                    required
                    className="mt-1 border-rose-300"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || emailInvalido || telefoneInvalido}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Executor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
