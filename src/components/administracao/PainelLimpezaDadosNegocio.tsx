import React, { useState } from 'react'
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
  Database,
  ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FRASE_CONFIRMACAO_LIMPEZA,
  COLECOES_NEGOCIO_ORDEM_LIMPEZA,
  COLECOES_PRESERVADAS,
  validarFraseConfirmacao,
} from '@/services/limpezaDadosNegocioConstants'
import {
  executarLimpezaDadosNegocio,
  LimpezaResultadoResponse,
} from '@/services/limpezaDadosNegocio'
import { useToast } from '@/hooks/use-toast'

interface PainelLimpezaDadosNegocioProps {
  onSucessoExecucao?: () => void
}

export const PainelLimpezaDadosNegocio: React.FC<PainelLimpezaDadosNegocioProps> = ({
  onSucessoExecucao,
}) => {
  const { toast } = useToast()
  const [fraseDigitada, setFraseDigitada] = useState('')
  const [dialogConfirmacaoOpen, setDialogConfirmacaoOpen] = useState(false)
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState<LimpezaResultadoResponse | null>(null)
  const [erroExecucao, setErroExecucao] = useState<string | null>(null)

  const fraseValida = validarFraseConfirmacao(fraseDigitada)

  const handleAbrirDialogConfirmacao = () => {
    if (!fraseValida) return
    setDialogConfirmacaoOpen(true)
  }

  const handleConfirmarExecucao = async () => {
    setDialogConfirmacaoOpen(false)
    setExecutando(true)
    setErroExecucao(null)

    try {
      const resp = await executarLimpezaDadosNegocio(fraseDigitada)
      setResultado(resp)
      setFraseDigitada('')
      toast({
        title: 'Limpeza de negócio realizada com sucesso!',
        description: `Foram removidos ${resp.total_apagados ?? 0} registros de negócio. Cadastros e configurações foram preservados.`,
        variant: 'default',
      })
      if (onSucessoExecucao) {
        onSucessoExecucao()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao executar limpeza'
      setErroExecucao(msg)
      toast({
        title: 'Erro na limpeza de dados',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setExecutando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de Aviso Crítico de Irreversibilidade */}
      <Card className="border-2 border-red-500 bg-red-50/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-lg shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold text-red-900">
                  Limpeza de Dados de Negócio (Ação Irreversível)
                </CardTitle>
                <Badge
                  variant="destructive"
                  className="font-bold uppercase tracking-wider text-[10px]"
                >
                  Restrito a Admin
                </Badge>
              </div>
              <CardDescription className="text-red-800 text-xs mt-1">
                Esta operação apaga exclusivamente os registros operacionais e comerciais de negócio
                gerados durante a operação (esteira comercial, propostas, contratos de serviço,
                projetos, etapas, ordens de serviço, medições, mensagens, notificações e lançamentos
                financeiros). Cadastros mestres, usuários, parâmetros e configurações permanecem
                100% preservados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-red-900 space-y-2">
          <div className="p-3 bg-white/80 border border-red-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Atenção máxima:</span> Uma vez executada, esta ação{' '}
              <strong className="underline">não pode ser desfeita</strong>. Todos os dados excluídos
              serão registrados na Auditoria Imutável antes e depois do procedimento (com usuário,
              IP, timestamp e contagens detalhadas por coleção).
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: O que será apagado vs O que será preservado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: O QUE SERÁ APAGADO */}
        <Card className="border-red-200">
          <CardHeader className="p-4 bg-red-50/40 border-b border-red-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <CardTitle className="text-sm font-semibold text-red-900">
                  O que será apagado ({COLECOES_NEGOCIO_ORDEM_LIMPEZA.length} coleções de negócio)
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] text-red-700 border-red-300">
                Ordem estrita de dependência
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-600 mt-1">
              Registros da esteira comercial e de engenharia criados em testes ou na operação.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[380px] overflow-y-auto">
            <div className="divide-y divide-slate-100 text-xs">
              {COLECOES_NEGOCIO_ORDEM_LIMPEZA.map((item, idx) => (
                <div
                  key={item.colecao}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-[10px] font-mono text-slate-400 w-5 text-right shrink-0 mt-0.5">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <code className="text-[10px] font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-600">
                        {item.colecao}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coluna 2: O QUE SERÁ PRESERVADO */}
        <Card className="border-emerald-200">
          <CardHeader className="p-4 bg-emerald-50/40 border-b border-emerald-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold text-emerald-900">
                  O que NUNCA será apagado ({COLECOES_PRESERVADAS.length} cadastros/estruturas)
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50"
              >
                100% Intocado
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-600 mt-1">
              Cadastros institucionais, usuários, configurações e trilha jurídica de auditoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[380px] overflow-y-auto">
            <div className="divide-y divide-slate-100 text-xs">
              {COLECOES_PRESERVADAS.map((item) => (
                <div
                  key={item.colecao}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <code className="text-[10px] font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-600">
                        {item.colecao}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.motivo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caixa de Confirmação e Ação */}
      <Card className="border-slate-300 shadow-sm bg-slate-50/60">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#D95A2B]" />
            Confirmação de Segurança do Administrador
          </CardTitle>
          <CardDescription className="text-xs text-slate-600">
            Para liberar a execução, digite a frase exata de confirmação abaixo. O botão permanecerá
            desabilitado enquanto o texto não coincidir perfeitamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Digite a frase exatamente como exibida:{' '}
              <span className="font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded select-all font-bold">
                {FRASE_CONFIRMACAO_LIMPEZA}
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                value={fraseDigitada}
                onChange={(e) => setFraseDigitada(e.target.value)}
                placeholder={`Digite "${FRASE_CONFIRMACAO_LIMPEZA}"`}
                className={`font-mono text-xs uppercase tracking-wide h-10 ${
                  fraseDigitada && !fraseValida
                    ? 'border-red-400 focus-visible:ring-red-400'
                    : fraseValida
                      ? 'border-emerald-500 focus-visible:ring-emerald-500 bg-emerald-50/30'
                      : ''
                }`}
                disabled={executando}
              />
              <Button
                type="button"
                variant="destructive"
                disabled={!fraseValida || executando}
                onClick={handleAbrirDialogConfirmacao}
                className="h-10 px-5 text-xs font-semibold gap-2 shrink-0 bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {executando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executando limpeza...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Apagar Dados de Negócio
                  </>
                )}
              </Button>
            </div>
            {fraseDigitada && !fraseValida && (
              <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                <XCircle className="w-3.5 h-3.5" />
                A frase digitada ainda não coincide com a confirmação obrigatória.
              </p>
            )}
            {fraseValida && (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Frase confirmada. Clique no botão vermelho para o diálogo final de autorização.
              </p>
            )}
          </div>

          {/* Feedback de Erro */}
          {erroExecucao && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Erro ao executar a limpeza:</span>
                <p className="mt-0.5">{erroExecucao}</p>
              </div>
            </div>
          )}

          {/* Feedback de Sucesso Detalhado com Contagens */}
          {resultado && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Limpeza concluída com sucesso!</span>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono"
                >
                  Total apagado: {resultado.total_apagados ?? 0} registros
                </Badge>
              </div>

              <div className="text-[11px] text-emerald-900">
                <p>
                  Executado por:{' '}
                  <strong className="font-semibold">{resultado.executado_por}</strong>
                </p>
                <p>
                  Data/Hora:{' '}
                  <span className="font-mono">
                    {resultado.executado_em
                      ? new Date(resultado.executado_em).toLocaleString('pt-BR')
                      : '-'}
                  </span>
                </p>
              </div>

              {/* Tabela Resumo dos Registros Apagados por Coleção */}
              {resultado.apagados_por_colecao && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <span className="font-semibold text-emerald-900 block mb-1">
                    Registros apagados por coleção:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
                    {Object.entries(resultado.apagados_por_colecao).map(([col, qtd]) => (
                      <div
                        key={col}
                        className={`p-2 rounded border flex items-center justify-between ${
                          qtd > 0
                            ? 'bg-emerald-100/60 border-emerald-300 font-medium text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="truncate pr-1" title={col}>
                          {col}
                        </span>
                        <span className="font-mono font-bold text-xs shrink-0">{qtd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conferência das coleções preservadas */}
              {resultado.preservados_conferencia && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <span className="font-semibold text-emerald-900 block mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Conferência de preservação (registros mantidos):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
                    {Object.entries(resultado.preservados_conferencia).map(([col, qtd]) => (
                      <div
                        key={col}
                        className="p-2 rounded bg-white border border-emerald-200 flex items-center justify-between text-slate-700"
                      >
                        <span className="truncate pr-1" title={col}>
                          {col}
                        </span>
                        <span className="font-mono font-bold text-xs text-emerald-700 shrink-0">
                          {qtd}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo Final de Confirmação (Double Check de Segurança) */}
      <Dialog open={dialogConfirmacaoOpen} onOpenChange={setDialogConfirmacaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-base font-bold text-red-900">
                Confirmação Final de Exclusão
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 space-y-2">
              <p>Você está prestes a apagar todos os registros de negócio do sistema GESTÃO G+.</p>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-900 font-medium">
                Esta ação é definitiva e não poderá ser revertida. Todos os projetos, propostas,
                contratos de serviço, ordens de serviço e lançamentos financeiros operacionais serão
                apagados.
              </div>
              <p className="text-slate-700">
                Cadastros de empresas, prestadores, clientes, usuários e parâmetros permanecerão
                intactos.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogConfirmacaoOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmarExecucao}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Sim, Apagar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
