import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NaoContatarRecord, EmpresaRecord, MotivoRecord } from '@/types'
import { naoContatarService, CreateNaoContatarData } from '@/services/naoContatar'
import { empresasService } from '@/services/empresas'
import { motivosService } from '@/services/motivos'
import { formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  ShieldAlert,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  Building2,
  Mail,
  ShieldCheck,
  ArrowRight,
  Info,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function NaoContatarPage() {
  const { user, isAdmin, isComercial } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState<NaoContatarRecord[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([])
  const [motivosInativacao, setMotivosInativacao] = useState<MotivoRecord[]>([])
  const [busca, setBusca] = useState('')

  // Modal de Inclusão (Comercial e Admin podem incluir)
  const [modalOpen, setModalOpen] = useState(false)
  const [tipoInclusao, setTipoInclusao] = useState<'empresa' | 'email'>('empresa')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [inputEmail, setInputEmail] = useState('')
  const [selectedMotivo, setSelectedMotivo] = useState('')
  const [customMotivo, setCustomMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal de Exclusão (Admin only)
  const [itemParaRemover, setItemParaRemover] = useState<NaoContatarRecord | null>(null)
  const [removendo, setRemovendo] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, empList, motList] = await Promise.all([
        naoContatarService.list(),
        empresasService.list(),
        motivosService.listAtivos('inativacao'),
      ])
      setItens(list)
      setEmpresas(empList)
      setMotivosInativacao(motList)
      if (motList.length > 0) setSelectedMotivo(motList[0].descricao)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar lista Não Contatar',
        description: err instanceof Error ? err.message : 'Falha na conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem local
  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itens
    const q = busca.toLowerCase().trim()
    return itens.filter((it) => {
      const matchEmail = (it.email || '').toLowerCase().includes(q)
      const matchMotivo = (it.motivo || '').toLowerCase().includes(q)
      const matchEmp =
        it.expand?.empresa?.nome_fantasia?.toLowerCase().includes(q) ||
        it.expand?.empresa?.razao_social?.toLowerCase().includes(q)
      return matchEmail || matchMotivo || matchEmp
    })
  }, [itens, busca])

  // Submeter Inclusão
  const handleSalvarInclusao = async (e: React.FormEvent) => {
    e.preventDefault()
    let emailFinal = inputEmail.trim().toLowerCase()
    let empresaId: string | undefined = undefined

    if (tipoInclusao === 'empresa') {
      if (!selectedEmpresaId) {
        toast({
          title: 'Selecione uma empresa',
          description: 'É necessário selecionar a empresa a ser bloqueada.',
          variant: 'destructive',
        })
        return
      }
      const emp = empresas.find((e) => e.id === selectedEmpresaId)
      empresaId = selectedEmpresaId
      emailFinal = (emp?.email || '').trim().toLowerCase()
      if (!emailFinal) {
        // Se a empresa não tem email cadastrado, usa um identificador de domínio ou exige email
        emailFinal = `bloqueio@${emp?.cnpj?.replace(/\D/g, '') || 'empresa'}.local`
      }
    } else {
      if (!emailFinal || !emailFinal.includes('@')) {
        toast({
          title: 'E-mail inválido',
          description: 'Informe um endereço de e-mail válido para bloqueio.',
          variant: 'destructive',
        })
        return
      }
    }

    const motivoFinal = selectedMotivo === 'outro' ? customMotivo.trim() : selectedMotivo.trim()
    if (!motivoFinal) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Selecione ou digite o motivo da inclusão.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await naoContatarService.create({
        email: emailFinal,
        empresa: empresaId,
        motivo: motivoFinal,
        data_inclusao: new Date().toISOString(),
      })

      toast({
        title: 'Adicionado a Não Contatar',
        description: 'Bloqueio registrado com sucesso no banco de dados e auditado.',
      })

      setModalOpen(false)
      setInputEmail('')
      setSelectedEmpresaId('')
      setCustomMotivo('')
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao incluir na lista',
        description: err instanceof Error ? err.message : 'Falha na gravação.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Submeter Remoção (Admin Only)
  const handleConfirmarRemocao = async () => {
    if (!itemParaRemover) return
    if (!isAdmin) {
      toast({
        title: 'Ação não permitida',
        description:
          'Apenas Administradores têm permissão para remover itens da lista Não Contatar.',
        variant: 'destructive',
      })
      return
    }

    setRemovendo(true)
    try {
      await naoContatarService.delete(itemParaRemover.id)
      toast({
        title: 'Bloqueio Removido',
        description: 'O registro foi removido pelo Administrador e o histórico foi auditado.',
      })
      setItemParaRemover(null)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao remover',
        description: err instanceof Error ? err.message : 'Falha na exclusão.',
        variant: 'destructive',
      })
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Lista "Não Contatar" (Opt-Out / Bloqueios)
            </h1>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
              Módulo /nao-contatar
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lista de exclusão operacional e compliance LGPD. Totalmente separada da inativação de
            empresas no funil.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={async () => {
              if (itensFiltrados.length === 0) {
                toast({
                  title: 'Sem registros para exportar',
                  description: 'A lista Não Contatar está vazia.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `base_nao_contatar_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'nao_contatar',
                  descricao:
                    'Exportação da base completa da lista Não Contatar para revisão do Admin',
                  filtros: { busca: busca || undefined },
                  columns: [
                    { header: 'E-mail Bloqueado', accessor: (it) => it.email },
                    {
                      header: 'Empresa Associada',
                      accessor: (it) =>
                        it.expand?.empresa?.razao_social ||
                        it.expand?.empresa?.nome_fantasia ||
                        'E-mail Avulso',
                    },
                    {
                      header: 'CNPJ Empresa',
                      accessor: (it) => it.expand?.empresa?.cnpj || '',
                    },
                    { header: 'Motivo do Bloqueio', accessor: (it) => it.motivo || '' },
                    {
                      header: 'Data de Inclusão',
                      accessor: (it) => formatDateBr(it.data_inclusao || it.created),
                    },
                    { header: 'ID Registro', accessor: (it) => it.id },
                  ],
                  data: itensFiltrados,
                })
                toast({
                  title: 'Base Não Contatar Exportada',
                  description: `${itensFiltrados.length} registro(s) exportado(s) em CSV para auditoria do Admin.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/funil')}
            className="text-xs text-slate-700 hover:text-blue-600"
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
            Voltar ao Funil
          </Button>

          <Button
            onClick={() => setModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 text-white" />
            Incluir em Não Contatar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="text-slate-500 hover:text-blue-600"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Caixa de Esclarecimento de Regra de Negócio */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-950">
            Regra do Sistema: Desacoplamento entre Inativação e Não Contatar
          </span>
          <p className="text-amber-800">
            Uma empresa pode estar <strong>inativa no funil</strong> sem constar nesta lista (ex:
            falta momentânea de contratos) e, reciprocamente, um e-mail ou empresa pode estar nesta{' '}
            <strong>lista de bloqueio</strong> por solicitação formal de opt-out (LGPD) ou recusa
            comercial. Comercial e Admin podem incluir registros;{' '}
            <strong>remoções são restritas ao Administrador</strong> com auditoria imutável.
          </p>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <Input
            placeholder="Buscar por E-mail, Empresa vinculada ou Motivo do bloqueio..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Tabela de Itens Bloqueados */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600 mx-auto mb-2" />
            Carregando lista Não Contatar...
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhum registro de bloqueio</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Nenhuma empresa ou e-mail cadastrado na lista Não Contatar até o momento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">E-mail Bloqueado</th>
                  <th className="py-3 px-4">Empresa Associada</th>
                  <th className="py-3 px-4">Motivo do Bloqueio</th>
                  <th className="py-3 px-3">Data Inclusão</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itensFiltrados.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* E-mail */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{it.email}</span>
                      </div>
                    </td>

                    {/* Empresa Associada */}
                    <td className="py-3 px-4">
                      {it.expand?.empresa ? (
                        <div>
                          <div className="font-semibold text-slate-800">
                            {it.expand.empresa.nome_fantasia || it.expand.empresa.razao_social}
                          </div>
                          {it.expand.empresa.cnpj && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              CNPJ: {it.expand.empresa.cnpj}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">E-mail Avulso / Geral</span>
                      )}
                    </td>

                    {/* Motivo */}
                    <td className="py-3 px-4 text-slate-700 max-w-sm">
                      <span className="font-medium text-slate-800">{it.motivo || '—'}</span>
                    </td>

                    {/* Data de Inclusão */}
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {formatDateBr(it.data_inclusao || it.created)}
                    </td>

                    {/* Ação: Remoção (Admin Only) */}
                    <td className="py-3 px-4 text-right">
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemParaRemover(it)}
                          className="h-7 px-2 text-red-600 hover:text-red-800 hover:bg-red-50 text-xs"
                          title="Remover bloqueio (Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remover
                        </Button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400 italic"
                          title="Apenas Administradores podem remover"
                        >
                          Protegido (Admin)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: INCLUIR NA LISTA NÃO CONTATAR                  */}
      {/* ======================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSalvarInclusao}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-5 h-5" />
                <DialogTitle>Incluir em Não Contatar</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 pt-1">
                Adicione um e-mail ou empresa para bloqueio permanente de prospecção e mensagens.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {/* Opção: Por Empresa ou Por E-mail */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Tipo de Inclusão
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoInclusao('empresa')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md border text-center transition-colors ${
                      tipoInclusao === 'empresa'
                        ? 'bg-red-50 border-red-300 text-red-800 ring-1 ring-red-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Por Empresa Cadastrada
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoInclusao('email')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md border text-center transition-colors ${
                      tipoInclusao === 'email'
                        ? 'bg-red-50 border-red-300 text-red-800 ring-1 ring-red-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Por E-mail Avulso
                  </button>
                </div>
              </div>

              {tipoInclusao === 'empresa' ? (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 block mb-1">
                    Selecione a Empresa <span className="text-red-500">*</span>
                  </Label>
                  <select
                    className="w-full text-xs border border-slate-200 rounded-md p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                    value={selectedEmpresaId}
                    onChange={(e) => setSelectedEmpresaId(e.target.value)}
                  >
                    <option value="">-- Escolha uma empresa --</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social} {emp.cnpj ? `(${emp.cnpj})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 block mb-1">
                    Endereço de E-mail <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">
                  Motivo do Bloqueio <span className="text-red-500">*</span>
                </Label>
                <select
                  className="w-full text-xs border border-slate-200 rounded-md p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={selectedMotivo}
                  onChange={(e) => setSelectedMotivo(e.target.value)}
                >
                  <option value="Solicitação direta via descadastro (LGPD - opt-out)">
                    Solicitação direta via descadastro (LGPD - opt-out)
                  </option>
                  <option value="Notificação extrajudicial de recusa de contato">
                    Notificação extrajudicial de recusa de contato
                  </option>
                  <option value="Empresa concorrente / sem perfil de intermediação">
                    Empresa concorrente / sem perfil de intermediação
                  </option>
                  {motivosInativacao.map((m) => (
                    <option key={m.id} value={m.descricao}>
                      {m.descricao}
                    </option>
                  ))}
                  <option value="outro">Outro motivo customizado...</option>
                </select>
              </div>

              {selectedMotivo === 'outro' && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 block mb-1">
                    Especifique o Motivo <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Descreva o motivo detalhado..."
                    value={customMotivo}
                    onChange={(e) => setCustomMotivo(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? 'Salvando...' : 'Adicionar Bloqueio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 2: CONFIRMAÇÃO DE REMOÇÃO (ADMIN ONLY)            */}
      {/* ======================================================== */}
      <Dialog open={!!itemParaRemover} onOpenChange={(open) => !open && setItemParaRemover(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle>Confirmar Remoção de Bloqueio</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Você está prestes a remover o bloqueio do e-mail{' '}
              <strong className="text-slate-800">{itemParaRemover?.email}</strong>. Esta ação é
              restrita ao <strong>Administrador</strong> e será auditada nos registros do sistema.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setItemParaRemover(null)}
              disabled={removendo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarRemocao}
              disabled={removendo}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removendo ? 'Removendo...' : 'Confirmar Remoção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
