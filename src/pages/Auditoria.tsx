import React, { useState, useEffect } from 'react'
import { auditService, AuditLogFilters } from '@/services/audit'
import { AuditLogRecord } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  History,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Clock,
  User,
  Database,
  Lock,
} from 'lucide-react'
import { formatDateTimeBr } from '@/lib/formatters'

const ACTION_COLORS: Record<string, string> = {
  CRIACAO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EDICAO: 'bg-blue-50 text-blue-700 border-blue-200',
  EXCLUSAO: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGOUT: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({
    userEmail: '',
    acao: 'todas',
    entidade: 'todas',
    dataInicio: '',
    dataFim: '',
  })

  // Selected Log Details Dialog
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)

  const fetchLogs = async (page = currentPage) => {
    setIsLoading(true)
    try {
      const res = await auditService.list(page, 20, filters)
      setLogs(res.items)
      setTotalItems(res.totalItems)
      setTotalPages(res.totalPages)
      setCurrentPage(page)
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(1)
  }, [filters.acao, filters.entidade])

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchLogs(1)
  }

  const handleResetFilters = () => {
    setFilters({
      userEmail: '',
      acao: 'todas',
      entidade: 'todas',
      dataInicio: '',
      dataFim: '',
    })
    fetchLogs(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Auditoria Imutável</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Lock className="w-3 h-3 text-emerald-600" />
              Somente Servidor
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Registro cronológico protegido contra alterações de todas as operações (quem, o quê,
            quando e detalhes).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(currentPage)}
          disabled={isLoading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar Registros
        </Button>
      </div>

      {/* Filter Box */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <form
            onSubmit={handleApplyFilter}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
          >
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                E-mail do Responsável
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="ex: admin@sistema..."
                  value={filters.userEmail}
                  onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Tipo de Ação
              </label>
              <Select
                value={filters.acao}
                onValueChange={(val) => setFilters({ ...filters, acao: val })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Ações</SelectItem>
                  <SelectItem value="CRIACAO">CRIACAO</SelectItem>
                  <SelectItem value="EDICAO">EDICAO</SelectItem>
                  <SelectItem value="EXCLUSAO">EXCLUSAO</SelectItem>
                  <SelectItem value="LOGIN">LOGIN</SelectItem>
                  <SelectItem value="LOGOUT">LOGOUT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Entidade Afetada
              </label>
              <Select
                value={filters.entidade}
                onValueChange={(val) => setFilters({ ...filters, entidade: val })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Entidades</SelectItem>
                  <SelectItem value="users">users</SelectItem>
                  <SelectItem value="parametros">parametros</SelectItem>
                  <SelectItem value="modelos">modelos</SelectItem>
                  <SelectItem value="motivos">motivos</SelectItem>
                  <SelectItem value="empresas">empresas</SelectItem>
                  <SelectItem value="contratos">contratos</SelectItem>
                  <SelectItem value="propostas">propostas</SelectItem>
                  <SelectItem value="projetos">projetos</SelectItem>
                  <SelectItem value="contas">contas</SelectItem>
                  <SelectItem value="auth">auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Data Inicial
              </label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 h-9 px-3 text-xs"
              >
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Registros Encontrados ({totalItems})
            </CardTitle>
            <CardDescription className="text-xs">
              Página {currentPage} de {totalPages || 1}
            </CardDescription>
          </div>
          {(filters.userEmail ||
            filters.dataInicio ||
            filters.dataFim ||
            filters.acao !== 'todas' ||
            filters.entidade !== 'todas') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-slate-500"
            >
              Limpar Filtros
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data e Hora (dd/mm/aaaa hh:mm)</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Entidade</th>
                  <th className="py-3 px-4">ID do Registro</th>
                  <th className="py-3 px-4">IP</th>
                  <th className="py-3 px-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Consultando trilha de auditoria...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Nenhum registro de auditoria atende aos critérios da busca.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {formatDateTimeBr(log.created)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {log.expand?.user?.name || log.user_email || 'Sistema'}
                        </div>
                        {log.user_email && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {log.user_email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold tracking-wider ${
                            ACTION_COLORS[log.acao] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.acao}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-blue-900">
                        {log.entidade}
                      </td>
                      <td
                        className="py-3 px-4 font-mono text-[11px] text-slate-500 max-w-[120px] truncate"
                        title={log.registro_id}
                      >
                        {log.registro_id || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {log.ip || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 text-xs text-blue-600 hover:text-blue-800 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Mostrando {logs.length} de {totalItems} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => fetchLogs(currentPage - 1)}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <span className="font-medium text-slate-700">
                {currentPage} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => fetchLogs(currentPage + 1)}
                className="h-8 px-2 text-xs"
              >
                Próxima
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Details Modal (JSON Diff) */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="w-5 h-5 text-blue-600" />
              Detalhes do Registro de Auditoria
            </DialogTitle>
            <DialogDescription className="text-xs">
              ID único: <span className="font-mono text-slate-700">{selectedLog?.id}</span> —
              gravado em {formatDateTimeBr(selectedLog?.created)}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">AÇÃO</span>
                  <span className="font-bold text-slate-800">{selectedLog.acao}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">COLEÇÃO / ENTIDADE</span>
                  <span className="font-mono font-semibold text-blue-700">
                    {selectedLog.entidade}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RESPONSÁVEL</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {selectedLog.user_email || 'Sistema'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">IP DE ORIGEM</span>
                  <span className="font-mono text-slate-600">{selectedLog.ip || '127.0.0.1'}</span>
                </div>
              </div>

              {selectedLog.detalhes?.mensagem && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded font-medium">
                  {selectedLog.detalhes.mensagem}
                </div>
              )}

              {/* Diff view */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-700 block">
                  Snapshot de Alteração (Antes & Depois):
                </span>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] max-h-72 overflow-y-auto">
                  <pre>{JSON.stringify(selectedLog.detalhes || {}, null, 2)}</pre>
                </div>
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded text-[11px]">
                🔒 <strong>Garantia de Integridade:</strong> A coleção <code>audit_logs</code> tem
                permissão de escrita e edição bloqueada na API (createRule = null, updateRule =
                null, deleteRule = null). Nenhum usuário consegue forjar ou deletar estes registros.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
