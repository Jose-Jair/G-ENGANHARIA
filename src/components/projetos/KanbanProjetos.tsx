import React, { useState } from 'react'
import { ProjetoRecord, UserRole } from '@/types'
import { ProjetoComEtapasCalculadas } from './CardProjeto'
import { formatCurrencyBr } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Lock } from 'lucide-react'

export interface KanbanProjetosProps {
  projetos: ProjetoComEtapasCalculadas[]
  userRole?: UserRole
  onAbrirProjeto: (projetoId: string) => void
  onDefinirModo: (projeto: ProjetoRecord) => void
  onTentativaMudancaInvalida: (msg: string) => void
}

interface ColunaDef {
  id: string
  title: string
  color: string
  border: string
  dotColor: string
}

const COLUNAS_BASE: ColunaDef[] = [
  {
    id: 'aguardando_definicao',
    title: 'Standby',
    color: 'bg-orange-50/70 text-[#D95A2B]',
    border: 'border-orange-200',
    dotColor: 'bg-[#D95A2B]',
  },
  {
    id: 'contratacao',
    title: 'Em Contratação',
    color: 'bg-amber-50/70 text-amber-800',
    border: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'em_andamento',
    title: 'Em Andamento',
    color: 'bg-slate-100/70 text-slate-800',
    border: 'border-slate-200',
    dotColor: 'bg-slate-600',
  },
  {
    id: 'concluido',
    title: 'Concluído',
    color: 'bg-emerald-50/70 text-emerald-800',
    border: 'border-emerald-200',
    dotColor: 'bg-emerald-600',
  },
]

export const KanbanProjetos: React.FC<KanbanProjetosProps> = ({
  projetos,
  userRole,
  onAbrirProjeto,
  onDefinirModo,
  onTentativaMudancaInvalida,
}) => {
  const [draggedProjeto, setDraggedProjeto] = useState<ProjetoComEtapasCalculadas | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  const canDrag = userRole === 'admin' || userRole === 'gestor'

  // Verifica se existe algum projeto 'cancelado' ou 'pausado' na lista atual para exibir a coluna correspondente
  const hasCancelado = projetos.some((p) => p.status === 'cancelado')
  const hasPausado = projetos.some((p) => p.status === 'pausado')

  const colunas: ColunaDef[] = [...COLUNAS_BASE]

  if (hasPausado) {
    colunas.push({
      id: 'pausado',
      title: 'Pausado',
      color: 'bg-slate-100/70 text-slate-700',
      border: 'border-slate-300',
      dotColor: 'bg-slate-400',
    })
  }

  if (hasCancelado) {
    colunas.push({
      id: 'cancelado',
      title: 'Cancelado',
      color: 'bg-rose-50/70 text-rose-800',
      border: 'border-rose-200',
      dotColor: 'bg-rose-500',
    })
  }

  // Agrupamento de projetos por status
  const mapaColunas = new Map<string, ProjetoComEtapasCalculadas[]>()
  colunas.forEach((c) => mapaColunas.set(c.id, []))

  projetos.forEach((p) => {
    const st = p.status || 'em_andamento'
    const arr = mapaColunas.get(st)
    if (arr) {
      arr.push(p)
    } else {
      // Se tiver algum status atípico, agrupa em 'em_andamento'
      const defaultArr = mapaColunas.get('em_andamento')
      if (defaultArr) defaultArr.push(p)
    }
  })

  // Handlers de Drag and Drop
  const handleDragStart = (e: React.DragEvent, projeto: ProjetoComEtapasCalculadas) => {
    if (!canDrag) return
    setDraggedProjeto(projeto)
    e.dataTransfer.setData('text/plain', projeto.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    if (!canDrag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColId !== colId) {
      setDragOverColId(colId)
    }
  }

  const handleDragLeave = () => {
    setDragOverColId(null)
  }

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault()
    setDragOverColId(null)
    const prj = draggedProjeto
    setDraggedProjeto(null)
    if (!prj) return

    const sourceStatus = prj.status || 'em_andamento'

    // Se soltou na mesma coluna, nada a fazer
    if (sourceStatus === targetColId) return

    // REGRA CRÍTICA DE NEGÓCIO:
    // Arrastar entre colunas NUNCA muda o status diretamente no banco de dados!
    // Ao soltar, abre o caminho oficial correspondente.

    // Caso 1: Standby -> Em Andamento (ou qualquer destino operacional):
    // Abre o modal "Definir Modo de Execução" que já existe e valida no servidor
    if (
      sourceStatus === 'aguardando_definicao' &&
      (targetColId === 'em_andamento' || targetColId === 'contratacao')
    ) {
      onDefinirModo(prj)
      return
    }

    // Caso 2: Em Contratação -> Standby ou Em Andamento -> Standby:
    // Standby é um status de nascimento (pré-ativação). Não há retorno para Standby sem fluxo específico.
    if (targetColId === 'aguardando_definicao') {
      onTentativaMudancaInvalida(
        `O projeto ${prj.codigo} não pode retornar para Standby. O status Standby é reservado exclusivamente para projetos recém-assinados aguardando a primeira definição de execução.`,
      )
      return
    }

    // Caso 3: Em Andamento -> Concluído:
    // Conclusão oficial de projeto exige conclusão/aprovação de todas as etapas e medições dentro da ficha do projeto.
    if (targetColId === 'concluido') {
      if (prj.percentualConcluido < 100) {
        onTentativaMudancaInvalida(
          `Para concluir o projeto ${prj.codigo}, todas as etapas e entregáveis devem estar concluídos (${prj.etapasConcluidasCount}/${prj.totalEtapasCount} etapas prontas). Abra a ficha do projeto para concluir as pendências.`,
        )
      } else {
        onTentativaMudancaInvalida(
          `A conclusão formal do projeto ${prj.codigo} deve ser realizada dentro da ficha do projeto, mediante encerramento das etapas e conferência das contas/medições.`,
        )
        onAbrirProjeto(prj.id)
      }
      return
    }

    // Caso 4: Transição de/para Contratação:
    // Contratação é regida pela assinatura bilateral de contrato ou subcontratos de executores.
    if (targetColId === 'contratacao' || sourceStatus === 'contratacao') {
      onTentativaMudancaInvalida(
        `A etapa de contratação é gerenciada por meio dos contratos de serviço e subcontratos com executores. Abra a ficha do projeto ${prj.codigo} para gerenciar os contratos.`,
      )
      onAbrirProjeto(prj.id)
      return
    }

    // Caso genérico não suportado diretamente por drag:
    onTentativaMudancaInvalida(
      `A transição de "${sourceStatus}" para "${targetColId}" requer aprovação formal na ficha do projeto. O quadro Kanban não altera status sem a trilha oficial de auditoria.`,
    )
  }

  const getSaudeDot = (saude?: string) => {
    switch (saude) {
      case 'verde':
        return 'bg-emerald-500'
      case 'amarelo':
        return 'bg-amber-500'
      case 'vermelho':
        return 'bg-rose-500'
      default:
        return 'bg-slate-300'
    }
  }

  return (
    <div className="space-y-2">
      {/* Aviso de modo somente leitura se usuário não for admin/gestor */}
      {!canDrag && (
        <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            <strong>Quadro somente leitura:</strong> apenas <em>Administradores</em> e{' '}
            <em>Gestores de Projetos</em> podem movimentar projetos no Kanban.
          </span>
        </div>
      )}

      {/* Grid de Colunas Kanban com scroll horizontal */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 items-start min-h-[520px] scrollbar-thin">
        {colunas.map((col) => {
          const projetosDaColuna = mapaColunas.get(col.id) || []
          const valorTotalColuna = projetosDaColuna.reduce(
            (acc, p) => acc + (p.valor_total || 0),
            0,
          )
          const isOver = dragOverColId === col.id

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-xl border bg-slate-100/60 transition-all ${
                isOver
                  ? 'ring-2 ring-[#D95A2B] bg-orange-50/40 border-[#D95A2B]'
                  : 'border-slate-200'
              }`}
            >
              {/* Cabeçalho da Coluna */}
              <div className={`p-3 rounded-t-xl border-b bg-white ${col.border}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor} shrink-0`} />
                    <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 truncate">
                      {col.title}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs font-bold text-slate-700 bg-slate-50 shrink-0"
                  >
                    {projetosDaColuna.length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
                  <span>Valor consolidado:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatCurrencyBr(valorTotalColuna)}
                  </span>
                </div>
              </div>

              {/* Corpo da Coluna: Mini Cartões */}
              <div className="p-2 space-y-2 flex-1 min-h-[380px] max-h-[calc(100vh-340px)] overflow-y-auto">
                {projetosDaColuna.length === 0 ? (
                  <div className="h-32 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs">
                    <span>Nenhum projeto nesta etapa</span>
                  </div>
                ) : (
                  projetosDaColuna.map((prj) => {
                    const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
                    const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
                    const nomeCliente =
                      pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado'
                    const isStandby = prj.status === 'aguardando_definicao'

                    return (
                      <div
                        key={prj.id}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, prj)}
                        onClick={() => onAbrirProjeto(prj.id)}
                        className={`bg-white border rounded-lg p-3 space-y-2 shadow-2xs hover:shadow-md transition-all ${
                          canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${
                          isStandby
                            ? 'border-orange-300 hover:border-[#D95A2B]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Topo do mini-card: Código + Ponto de Saúde */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-[#1E2A4A] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {prj.codigo}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isStandby && (
                              <span className="text-[10px] font-bold text-[#D95A2B] uppercase">
                                Standby
                              </span>
                            )}
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${getSaudeDot(
                                prj.saude,
                              )} shrink-0`}
                              title={`Saúde: ${prj.saude || 'não definida'}`}
                            />
                          </div>
                        </div>

                        {/* Nome do Projeto + Cliente */}
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-2 hover:text-[#D95A2B] transition-colors leading-snug">
                            {prj.nome || `Projeto ${prj.codigo}`}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {nomeCliente}
                          </p>
                        </div>

                        {/* Valor */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500 text-[11px]">Valor:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {prj.valor_total ? formatCurrencyBr(prj.valor_total) : 'R$ 0,00'}
                          </span>
                        </div>

                        {/* Barra Fina de Progresso */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Progresso</span>
                            <span className="font-bold text-slate-800">
                              {prj.percentualConcluido}% ({prj.etapasConcluidasCount}/
                              {prj.totalEtapasCount})
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                prj.percentualConcluido === 100
                                  ? 'bg-emerald-500'
                                  : prj.diasAtrasoMax > 0
                                    ? 'bg-rose-500'
                                    : 'bg-[#D95A2B]'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(0, prj.percentualConcluido))}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Standby CTA no card se for admin/gestor */}
                        {isStandby && canDrag && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDefinirModo(prj)
                              }}
                              className="w-full text-center text-[10px] font-bold text-white bg-[#D95A2B] hover:bg-[#C44E22] py-1 rounded transition-colors"
                            >
                              Definir Modo de Execução →
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
