import React, { useState, useEffect } from 'react'
import { AuditLogRecord } from '@/types'
import { auditService } from '@/services/audit'
import { formatDateTimeBr } from '@/lib/formatters'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, Shield, ArrowRight, UserCheck, RefreshCw } from 'lucide-react'

interface FunilEmpresaTimelineProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  empresaNome: string
}

export function FunilEmpresaTimeline({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
}: FunilEmpresaTimelineProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      // Busca logs onde registro_id seja o id da empresa
      const res = await auditService.list(1, 50)
      const empLogs = res.items.filter(
        (l) =>
          l.registro_id === empresaId ||
          l.detalhes?.empresa === empresaId ||
          (l.detalhes?.depois && (l.detalhes.depois as any).empresa === empresaId) ||
          (l.detalhes?.depois && (l.detalhes.depois as any).razao_social === empresaNome),
      )
      setLogs(empLogs)
    } catch (err) {
      console.error('Erro ao buscar logs da empresa:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && empresaId) {
      loadLogs()
    }
  }, [open, empresaId])

  const renderAcaoBadge = (acao: string) => {
    switch (acao) {
      case 'CRIACAO':
        return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Criação</Badge>
      case 'EDICAO':
        return (
          <Badge className="bg-blue-100 text-blue-800 text-[10px]">Movimentação / Edição</Badge>
        )
      case 'EXCLUSAO':
        return <Badge className="bg-red-100 text-red-800 text-[10px]">Exclusão</Badge>
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {acao}
          </Badge>
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-200">
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2 text-slate-800">
              <History className="w-5 h-5 text-blue-600" />
              <SheetTitle className="text-base">Linha do Tempo e Auditoria</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              className="h-8 w-8 p-0 text-slate-500"
              title="Recarregar histórico"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <SheetDescription className="text-xs text-slate-500 truncate">
            Registro imutável de movimentações da empresa{' '}
            <strong className="text-slate-700">{empresaNome}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4 text-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
              Consultando logs no servidor...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
              <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600">Nenhum evento registrado ainda</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Todas as movimentações de etapa no Kanban, inativações e lançamentos de contratos
                são auditados e exibidos aqui.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {logs.map((log) => {
                const antes = log.detalhes?.antes as Record<string, any> | undefined
                const depois = log.detalhes?.depois as Record<string, any> | undefined
                const mudouEtapa = antes?.etapa_funil !== depois?.etapa_funil && depois?.etapa_funil
                const mudouStatus = antes?.status !== depois?.status && depois?.status

                return (
                  <div key={log.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        {renderAcaoBadge(log.acao)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateTimeBr(log.created)}
                        </span>
                      </div>

                      {/* Usuário executor */}
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">
                          {log.expand?.user?.name || log.user_email || 'Sistema'}
                        </span>
                      </div>

                      {/* Detalhe de movimentação de Etapa Funil */}
                      {mudouEtapa && (
                        <div className="mt-2 p-2 rounded bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900">
                          <span className="font-semibold block mb-0.5">Mudança de Etapa:</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-500 line-through">
                              {antes?.etapa_funil || 'origem'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold text-blue-700">{depois?.etapa_funil}</span>
                          </div>
                        </div>
                      )}

                      {/* Detalhe de Mudança de Status (Inativação / Reativação) */}
                      {mudouStatus && (
                        <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                          <span className="font-semibold block mb-0.5">Status da Empresa:</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="line-through">{antes?.status}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-bold">{depois?.status}</span>
                          </div>
                          {depois?.motivo_inativacao && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              <strong>Motivo:</strong> {depois.motivo_inativacao}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Mensagem genérica se houver */}
                      {log.detalhes?.mensagem && (
                        <p className="text-[11px] text-slate-600 italic">
                          "{log.detalhes.mensagem}"
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
