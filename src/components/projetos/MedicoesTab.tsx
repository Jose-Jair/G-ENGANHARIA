import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MedicaoRecord, SubcontratoRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { AvaliacaoExecutorRecord, avaliacoesExecutorService } from '@/services/avaliacoesExecutor'
import { ModalNovaMedicao } from './ModalNovaMedicao'
import { ModalDetalhesMedicao } from './ModalDetalhesMedicao'
import { ModalAvaliarExecutorSubcontrato } from './ModalAvaliarExecutorSubcontrato'
import {
  Plus,
  FileCheck2,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
} from 'lucide-react'

interface MedicoesTabProps {
  projetoId: string
  subcontratos: SubcontratoRecord[]
  medicoes: MedicaoRecord[]
  canManage: boolean // Admin ou Gestor
  onRefresh: () => void
}

export function MedicoesTab({
  projetoId,
  subcontratos,
  medicoes,
  canManage,
  onRefresh,
}: MedicoesTabProps) {
  const [modalNovaOpen, setModalNovaOpen] = useState(false)
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false)
  const [medicaoSelecionada, setMedicaoSelecionada] = useState<MedicaoRecord | null>(null)

  // Avaliações de executor (coleção nova avaliacoes_executor) do projeto
  const [avaliacoesExecutor, setAvaliacoesExecutor] = useState<AvaliacaoExecutorRecord[]>([])
  const [modalAvaliarOpen, setModalAvaliarOpen] = useState(false)
  const [subcontratoAvaliar, setSubcontratoAvaliar] = useState<SubcontratoRecord | null>(null)

  // Subcontratos assinados disponíveis
  const subcontratosAssinados = subcontratos.filter((s) => s.status === 'assinado')

  // Métricas
  const totalMedido = medicoes
    .filter((m) => m.status !== 'reprovada')
    .reduce((acc, m) => acc + (m.valor_bruto || 0), 0)

  const totalAprovado = medicoes
    .filter((m) => m.status === 'aprovada' || m.status === 'faturada' || m.status === 'paga')
    .reduce((acc, m) => acc + (m.valor_liquido || 0), 0)

  const totalPendente = medicoes.filter((m) => m.status === 'apresentada').length

  // Carrega as avaliações de executor já registradas para saber quais subcontratos já foram avaliados
  useEffect(() => {
    let ativo = true
    avaliacoesExecutorService
      .listByProjeto(projetoId)
      .then((avs) => {
        if (ativo) setAvaliacoesExecutor(avs)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [projetoId, medicoes])

  // Avaliação do executor está habilitada quando: subcontrato assinado + TODAS as
  // medições (exceto reprovadas) pagas + subcontrato ainda sem avaliação (índice único).
  const podeAvaliarSubcontrato = (sub: SubcontratoRecord): boolean => {
    if (sub.status !== 'assinado') return false
    if (avaliacoesExecutor.some((a) => a.subcontrato === sub.id)) return false
    const medicoesSub = medicoes.filter((m) => m.subcontrato === sub.id)
    if (medicoesSub.length === 0) return false
    return medicoesSub.filter((m) => m.status !== 'reprovada').every((m) => m.status === 'paga')
  }

  // Subcontratos elegíveis para avaliação (assinado + tudo pago + sem avaliação)
  const subcontratosAvaliaveis = subcontratosAssinados.filter((s) => podeAvaliarSubcontrato(s))

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'apresentada':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1 w-fit text-[11px]">
            <Clock className="w-3 h-3 text-amber-600" />
            Apresentada
          </Badge>
        )
      case 'aprovada':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Aprovada
          </Badge>
        )
      case 'reprovada':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 flex items-center gap-1 w-fit text-[11px]">
            <XCircle className="w-3 h-3 text-rose-600" />
            Reprovada
          </Badge>
        )
      case 'faturada':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 w-fit text-[11px]">
            <DollarSign className="w-3 h-3 text-blue-600" />
            Faturada
          </Badge>
        )
      case 'paga':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1 w-fit text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            Paga
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Cards de Métricas da Aba */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Total Medido (Bruto)
          </span>
          <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
            {formatCurrencyBr(totalMedido)}
          </div>
          <span className="text-[11px] text-slate-500">
            {medicoes.filter((m) => m.status !== 'reprovada').length} medição(ões) considerada(s)
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
            Total Aprovado (Líquido)
          </span>
          <div className="font-mono font-bold text-emerald-700 text-base mt-0.5">
            {formatCurrencyBr(totalAprovado)}
          </div>
          <span className="text-[11px] text-slate-500">Com contas a pagar geradas</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
            Aguardando Avaliação
          </span>
          <div className="font-mono font-bold text-amber-700 text-base mt-0.5">
            {totalPendente} pendente(s)
          </div>
          <span className="text-[11px] text-slate-500">Exige ação do Gestor/Admin</span>
        </div>
      </div>

      {/* Header com Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#D95A2B]" />
            Medições Progressivas por Subcontrato
          </h3>
          <p className="text-xs text-slate-500">
            Controle os boletins de medição progressiva vinculados aos subcontratos dos executores.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={subcontratosAvaliaveis.length === 0}
              onClick={() => {
                const sub = subcontratosAvaliaveis[0]
                if (sub) {
                  setSubcontratoAvaliar(sub)
                  setModalAvaliarOpen(true)
                }
              }}
              title={
                subcontratosAvaliaveis.length === 0
                  ? 'Disponível quando o subcontrato está assinado e todas as medições (exceto reprovadas) estão pagas'
                  : 'Registrar avaliação final do executor deste subcontrato'
              }
              className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs h-8 font-semibold shadow-xs"
            >
              <Award className="w-3.5 h-3.5 mr-1" />
              Avaliar Executor
            </Button>
          )}

          {canManage && (
            <Button
              size="sm"
              onClick={() => setModalNovaOpen(true)}
              disabled={subcontratosAssinados.length === 0}
              className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs h-8 font-semibold shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nova Medição
            </Button>
          )}
        </div>
      </div>

      {subcontratosAssinados.length === 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Este projeto ainda não possui nenhum <strong>Termo de Subcontratação assinado</strong>.
            As medições progressivas só podem ser emitidas após a formalização do subcontrato.
          </span>
        </div>
      )}

      {/* Tabela de Medições */}
      {medicoes.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
          <FileCheck2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-700">Nenhuma medição registrada ainda</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Clique em "Nova Medição" para apresentar o primeiro boletim de serviços executados.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700">Número</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">
                  Subcontrato / Executor
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Período</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-center">
                  % Exec.
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">
                  Valor Bruto
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">
                  Retenção
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">
                  Valor Líquido
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-center">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicoes.map((med) => {
                const sub = med.expand?.subcontrato
                const exec = med.expand?.executor

                return (
                  <TableRow key={med.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {med.numero}
                      <span className="block text-[10px] font-normal text-slate-400">
                        Medição #{String(med.numero_medicao).padStart(2, '0')}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs">
                      <span className="font-semibold text-slate-900 block">
                        {sub?.numero || 'SUB'}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                        {exec?.nome || 'Executor'}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {formatDateBr(med.periodo_inicio)}
                      <span className="text-slate-400 mx-1">a</span>
                      {formatDateBr(med.periodo_fim)}
                    </TableCell>

                    <TableCell className="text-xs text-center font-semibold text-slate-800">
                      {med.percentual_executado}%
                    </TableCell>

                    <TableCell className="font-mono text-xs text-right font-medium text-slate-800">
                      {formatCurrencyBr(med.valor_bruto)}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-right text-slate-500">
                      {formatCurrencyBr(med.retencao_impostos || 0)}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-right font-bold text-emerald-700">
                      {formatCurrencyBr(med.valor_liquido)}
                    </TableCell>

                    <TableCell>{getStatusBadge(med.status)}</TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMedicaoSelecionada(med)
                          setModalDetalhesOpen(true)
                        }}
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Ver Detalhes e Avaliar"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modais */}
      <ModalNovaMedicao
        open={modalNovaOpen}
        onOpenChange={setModalNovaOpen}
        subcontratos={subcontratosAssinados}
        onSuccess={() => {
          onRefresh()
        }}
      />

      <ModalDetalhesMedicao
        open={modalDetalhesOpen}
        onOpenChange={setModalDetalhesOpen}
        medicao={medicaoSelecionada}
        canApprove={canManage}
        onSuccess={() => {
          onRefresh()
        }}
      />

      <ModalAvaliarExecutorSubcontrato
        open={modalAvaliarOpen}
        onOpenChange={setModalAvaliarOpen}
        subcontrato={subcontratoAvaliar}
        medicoes={
          subcontratoAvaliar ? medicoes.filter((m) => m.subcontrato === subcontratoAvaliar.id) : []
        }
        onSuccess={() => {
          avaliacoesExecutorService
            .listByProjeto(projetoId)
            .then((avs) => setAvaliacoesExecutor(avs))
            .catch(() => {})
          onRefresh()
        }}
      />
    </div>
  )
}
