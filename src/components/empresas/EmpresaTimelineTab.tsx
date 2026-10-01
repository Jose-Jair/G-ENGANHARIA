import React from 'react'
import { AuditLogRecord } from '@/types'
import { formatDateTimeBr } from '@/lib/formatters'
import {
  History,
  FilePlus,
  FileEdit,
  Trash2,
  AlertCircle,
  Building2,
  FileText,
  UserCheck,
  CheckCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface EmpresaTimelineTabProps {
  logs: AuditLogRecord[]
  loading: boolean
}

export function EmpresaTimelineTab({ logs, loading }: EmpresaTimelineTabProps) {
  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
        Carregando linha do tempo de auditoria...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
        <History className="w-9 h-9 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-600">
          Nenhum evento registrado para esta empresa
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Qualquer criação, edição, lançamento de contrato ou oportunidade gerada nesta empresa é
          registrada automaticamente no histórico auditável.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Linha do Tempo e Eventos</h3>
          <p className="text-xs text-slate-500">
            Registro cronológico decrescente de auditoria: criações, atualizações, contratos e
            alertas de oportunidade.
          </p>
        </div>
        <Badge variant="outline" className="text-xs bg-slate-50">
          {logs.length} evento(s)
        </Badge>
      </div>

      <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
        {logs.map((log) => {
          const isCriacao = log.acao === 'CRIACAO'
          const isEdicao = log.acao === 'EDICAO'
          const isExclusao = log.acao === 'EXCLUSAO'
          const isOportunidade = log.acao === 'ALERTA_OPORTUNIDADE' || log.acao === 'OPORTUNIDADE'

          let icon = <FileEdit className="w-3.5 h-3.5 text-blue-600" />
          let dotBg = 'bg-blue-100 border-blue-400'

          if (isCriacao) {
            icon = <FilePlus className="w-3.5 h-3.5 text-emerald-600" />
            dotBg = 'bg-emerald-100 border-emerald-400'
          } else if (isExclusao) {
            icon = <Trash2 className="w-3.5 h-3.5 text-red-600" />
            dotBg = 'bg-red-100 border-red-400'
          } else if (isOportunidade) {
            icon = <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            dotBg = 'bg-amber-100 border-amber-400'
          }

          const userName = log.expand?.user?.name || log.user_email || 'Sistema / Usuário'

          // Extrair detalhes relevantes
          const depois = log.detalhes?.depois as Record<string, unknown> | undefined
          const antes = log.detalhes?.antes as Record<string, unknown> | undefined
          const mensagem = (log.detalhes?.mensagem as string) || ''

          return (
            <div key={log.id} className="relative pl-6">
              {/* Dot no eixo temporal */}
              <div
                className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${dotBg}`}
              >
                {icon}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${
                        isCriacao
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : isEdicao
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : isExclusao
                              ? 'bg-red-50 text-red-700 border-red-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}
                    >
                      {log.acao}
                    </Badge>

                    <span className="text-xs font-semibold text-slate-800">
                      {log.entidade === 'empresas' && 'Empresa'}
                      {log.entidade === 'contratos' && 'Contrato Público'}
                      {log.entidade === 'contatos' && 'Contato Comercial'}
                      {log.entidade === 'importacao' && 'Importação por Planilha'}
                      {!['empresas', 'contratos', 'contatos', 'importacao'].includes(
                        log.entidade,
                      ) && log.entidade}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {formatDateTimeBr(log.created)}
                  </span>
                </div>

                {mensagem && (
                  <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2 rounded border border-slate-100">
                    {mensagem}
                  </p>
                )}

                {/* Mudança de dados (antes e depois) */}
                {antes && depois && Object.keys(depois).length > 0 && (
                  <div className="text-[11px] space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="font-semibold text-slate-500 uppercase text-[10px] block">
                      Campos Modificados:
                    </span>
                    {Object.keys(depois).map((k) => (
                      <div key={k} className="grid grid-cols-3 gap-2">
                        <span className="text-slate-600 font-mono font-medium">{k}:</span>
                        <span className="text-red-600 line-through truncate">
                          {String(antes[k] ?? 'vazio')}
                        </span>
                        <span className="text-emerald-700 font-semibold truncate">
                          {String(depois[k] ?? 'vazio')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Criação com resumo do registro */}
                {isCriacao && depois && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 space-y-0.5">
                    {depois.razao_social && (
                      <div>
                        <strong>Razão Social:</strong> {String(depois.razao_social)}
                      </div>
                    )}
                    {depois.numero && (
                      <div>
                        <strong>Contrato:</strong> {String(depois.numero)} | Órgão:{' '}
                        {String(depois.orgao)}
                      </div>
                    )}
                    {depois.nome && (
                      <div>
                        <strong>Nome Contato:</strong> {String(depois.nome)} (
                        {String(depois.cargo || 'Sem cargo')})
                      </div>
                    )}
                    {depois.etapa_funil && (
                      <div>
                        <strong>Etapa do Funil:</strong> {String(depois.etapa_funil)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>
                    Executado por: <strong className="text-slate-600">{userName}</strong>
                  </span>
                  {log.ip && <span className="font-mono text-[10px]">IP: {log.ip}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
