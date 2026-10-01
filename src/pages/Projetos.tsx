import React, { useState, useEffect } from 'react'
import { ProjetoRecord, SaudeProjeto } from '@/types'
import { projetosService } from '@/services/projetos'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Layers,
  HeartPulse,
  Eye,
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  DollarSign,
  Loader2,
  Download,
} from 'lucide-react'
import { exportService } from '@/services/exportService'
import { formatCnpj, formatCpf } from '@/lib/cnpj'

import { ModalDetalheProjeto } from '@/components/projetos/ModalDetalheProjeto'
import { ModalCriarProjeto } from '@/components/projetos/ModalCriarProjeto'
import { ModalSaudeProjeto } from '@/components/projetos/ModalSaudeProjeto'

export const ProjetosPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [projetos, setProjetos] = useState<ProjetoRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroSaude, setFiltroSaude] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modais
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null)

  const [modalSaudeRapidaOpen, setModalSaudeRapidaOpen] = useState(false)
  const [projetoSaudeRapida, setProjetoSaudeRapida] = useState<ProjetoRecord | null>(null)

  const canCreate = !!(user && (user.role === 'admin' || user.role === 'gestor'))

  const carregarProjetos = async () => {
    setCarregando(true)
    try {
      const lista = await projetosService.list()
      setProjetos(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar projetos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarProjetos()
  }, [])

  // Filtragem
  const projetosFiltrados = projetos.filter((prj) => {
    const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
    const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
    const nomeCliente = (pj?.nome_fantasia || pj?.razao_social || pf?.nome || '').toLowerCase()
    const codigo = (prj.codigo || '').toLowerCase()
    const nomePrj = (prj.nome || '').toLowerCase()
    const matchBusca =
      !busca ||
      codigo.includes(busca.toLowerCase()) ||
      nomePrj.includes(busca.toLowerCase()) ||
      nomeCliente.includes(busca.toLowerCase())

    const matchSaude = filtroSaude === 'todos' || prj.saude === filtroSaude
    const matchStatus = filtroStatus === 'todos' || prj.status === filtroStatus

    return matchBusca && matchSaude && matchStatus
  })

  // Contadores de saúde
  const countVerde = projetos.filter((p) => p.saude === 'verde').length
  const countAmarelo = projetos.filter((p) => p.saude === 'amarelo').length
  const countVermelho = projetos.filter((p) => p.saude === 'vermelho').length

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Projetos de Engenharia
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              Etapa 8
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão operacional das demandas geradas a partir de propostas aceitas (PRJ-AAAA-NNNN) ou
            cadastro direto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (projetosFiltrados.length === 0) {
                toast({
                  title: 'Sem projetos para exportar',
                  description: 'A lista atual não possui projetos com os filtros aplicados.',
                  variant: 'destructive',
                })
                return
              }
              try {
                await exportService.exportarParaCsv({
                  filename: `projetos_${new Date().toISOString().slice(0, 10)}.csv`,
                  tela: 'projetos',
                  descricao: 'Exportação de projetos de engenharia, saúde e valores',
                  filtros: {
                    saude: filtroSaude,
                    status: filtroStatus,
                    busca: busca || undefined,
                  },
                  columns: [
                    { header: 'Código', accessor: (p) => p.codigo },
                    { header: 'Nome do Projeto', accessor: (p) => p.nome || `Projeto ${p.codigo}` },
                    {
                      header: 'Cliente',
                      accessor: (p) => {
                        const pj = p.expand?.empresa || p.expand?.proposta?.expand?.empresa
                        const pf = p.expand?.cliente_pf || p.expand?.proposta?.expand?.cliente_pf
                        return pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Não vinculado'
                      },
                    },
                    {
                      header: 'Documento Cliente',
                      accessor: (p) => {
                        const pj = p.expand?.empresa || p.expand?.proposta?.expand?.empresa
                        const pf = p.expand?.cliente_pf || p.expand?.proposta?.expand?.cliente_pf
                        return pj?.cnpj ? formatCnpj(pj.cnpj) : pf?.cpf ? formatCpf(pf.cpf) : ''
                      },
                    },
                    { header: 'Status', accessor: (p) => p.status || 'em_andamento' },
                    { header: 'Saúde', accessor: (p) => p.saude || 'verde' },
                    { header: 'Justificativa Saúde', accessor: (p) => p.justificativa_saude || '' },
                    {
                      header: 'Valor Total (R$)',
                      accessor: (p) => formatCurrencyBr(p.valor_total || 0),
                    },
                    {
                      header: 'Prazo Final',
                      accessor: (p) => (p.prazo_final ? formatDateBr(p.prazo_final) : ''),
                    },
                    {
                      header: 'Proposta Origem',
                      accessor: (p) => p.expand?.proposta?.numero || '',
                    },
                    {
                      header: 'Disciplinas',
                      accessor: (p) => p.disciplinas || '',
                    },
                  ],
                  data: projetosFiltrados,
                })
                toast({
                  title: 'Projetos Exportados',
                  description: `${projetosFiltrados.length} projeto(s) exportado(s) com sucesso. Auditoria registrada.`,
                })
              } catch (err: any) {
                toast({
                  title: 'Erro ao exportar projetos',
                  description: err.message || 'Falha ao gerar CSV.',
                  variant: 'destructive',
                })
              }
            }}
            className="text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300 shadow-xs"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {canCreate && (
            <Button
              onClick={() => setModalCriarOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Projeto Direto
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Indicadores de Saúde */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total de Projetos
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{projetos.length}</span>
            <Briefcase className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Saúde Verde
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-emerald-900">{countVerde}</span>
            <span className="text-xs text-emerald-700">No prazo</span>
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Saúde Amarela
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-amber-900">{countAmarelo}</span>
            <span className="text-xs text-amber-700">Atenção</span>
          </div>
        </div>

        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-lg shadow-xs">
          <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Saúde Vermelha
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-rose-900">{countVermelho}</span>
            <span className="text-xs text-rose-700">Crítico / Atraso</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código (PRJ-...), nome do projeto ou cliente..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={filtroSaude} onValueChange={setFiltroSaude}>
            <SelectTrigger className="w-[150px] text-xs h-9">
              <SelectValue placeholder="Saúde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Saúdes</SelectItem>
              <SelectItem value="verde">🟢 Verde</SelectItem>
              <SelectItem value="amarelo">🟡 Amarelo</SelectItem>
              <SelectItem value="vermelho">🔴 Vermelho</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px] text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Projetos */}
      {carregando ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs text-slate-400">Carregando projetos de engenharia...</p>
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-lg">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Nenhum projeto encontrado</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Projetos são gerados automaticamente pelo aceite de propostas ou pelo botão "Novo
            Projeto Direto".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetosFiltrados.map((prj) => {
            const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
            const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
            const nomeCliente =
              pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado'

            return (
              <div
                key={prj.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {prj.codigo}
                      </span>
                      {prj.expand?.proposta && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Origem: {prj.expand.proposta.numero}
                        </p>
                      )}
                    </div>

                    {/* Badge de Saúde com Ação */}
                    <button
                      type="button"
                      onClick={() => {
                        setProjetoSaudeRapida(prj)
                        setModalSaudeRapidaOpen(true)
                      }}
                      title="Alterar saúde do projeto (Gestor)"
                      className="cursor-pointer"
                    >
                      {prj.saude === 'verde' && (
                        <Badge className="bg-emerald-600 text-white text-[10px] hover:bg-emerald-700">
                          🟢 Verde
                        </Badge>
                      )}
                      {prj.saude === 'amarelo' && (
                        <Badge className="bg-amber-500 text-slate-950 text-[10px] hover:bg-amber-600">
                          🟡 Amarelo
                        </Badge>
                      )}
                      {prj.saude === 'vermelho' && (
                        <Badge className="bg-rose-600 text-white text-[10px] hover:bg-rose-700">
                          🔴 Vermelho
                        </Badge>
                      )}
                      {!prj.saude && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          S/ Saúde
                        </Badge>
                      )}
                    </button>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 mt-3 line-clamp-2">
                    {prj.nome || `Projeto ${prj.codigo}`}
                  </h3>

                  {prj.justificativa_saude && (
                    <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">
                      "{prj.justificativa_saude}"
                    </p>
                  )}

                  {/* Informações de Cliente, Valor e Prazo */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Cliente: <strong className="text-slate-800">{nomeCliente}</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        Valor:
                      </span>
                      <strong className="text-slate-900 font-semibold">
                        {prj.valor_total ? formatCurrencyBr(prj.valor_total) : '—'}
                      </strong>
                    </div>

                    {prj.prazo_final && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                          Prazo Final:
                        </span>
                        <strong className="text-slate-800 font-mono">
                          {formatDateBr(prj.prazo_final)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão para Abrir Detalhe com as 4 Abas */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-semibold text-slate-600"
                  >
                    {prj.status || 'em_andamento'}
                  </Badge>

                  <Button
                    size="sm"
                    onClick={() => {
                      setProjetoSelecionadoId(prj.id)
                      setModalDetalheOpen(true)
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Abrir Projeto
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Projeto */}
      <ModalCriarProjeto
        open={modalCriarOpen}
        onOpenChange={setModalCriarOpen}
        onSuccess={carregarProjetos}
      />

      {/* Modal Detalhes do Projeto com as 4 Abas (Etapas, Entregáveis, Documentos, Riscos) */}
      <ModalDetalheProjeto
        open={modalDetalheOpen}
        onOpenChange={setModalDetalheOpen}
        projetoId={projetoSelecionadoId}
        onUpdate={carregarProjetos}
      />

      {/* Modal Rápido de Alteração de Saúde */}
      {projetoSaudeRapida && (
        <ModalSaudeProjeto
          open={modalSaudeRapidaOpen}
          onOpenChange={setModalSaudeRapidaOpen}
          projetoId={projetoSaudeRapida.id}
          codigoProjeto={projetoSaudeRapida.codigo}
          saudeAtual={projetoSaudeRapida.saude}
          justificativaAtual={projetoSaudeRapida.justificativa_saude}
          onSuccess={() => {
            carregarProjetos()
            setProjetoSaudeRapida(null)
          }}
        />
      )}
    </div>
  )
}
