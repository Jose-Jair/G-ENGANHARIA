import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  PieChart,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react'
import { ContaRecord, ProjetoRecord } from '@/types'
import { MesFluxoCaixa } from '@/services/financeiro'
import { exportService } from '@/services/exportService'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface ModalRelatoriosFinanceirosProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaRecord[]
  fluxo12Meses: MesFluxoCaixa[]
  projetos: ProjetoRecord[]
}

export function ModalRelatoriosFinanceiros({
  open,
  onOpenChange,
  contas,
  fluxo12Meses,
  projetos,
}: ModalRelatoriosFinanceirosProps) {
  const { toast } = useToast()
  const [exportando, setExportando] = useState<string | null>(null)

  // 1. Relatório: Fluxo de Caixa 12 Meses
  const exportarFluxoCaixa12m = async () => {
    setExportando('fluxo12m')
    try {
      await exportService.exportarParaCsv({
        filename: `relatorio_fluxo_caixa_12_meses_${new Date().toISOString().slice(0, 10)}.csv`,
        tela: 'relatorios_financeiros_fluxo12m',
        descricao:
          'Relatório Consolidado do Fluxo de Caixa 12 Meses (Entradas, Saídas e Saldo Acumulado)',
        isFinanceiro: true,
        columns: [
          { header: 'Mês / Ano', accessor: (m) => m.rotulo },
          { header: 'Mês Chave', accessor: (m) => m.mesChave },
          {
            header: 'Entradas Realizadas (R$)',
            accessor: (m) => formatCurrencyBr(m.entradasRealizadas),
          },
          {
            header: 'Entradas Previstas (R$)',
            accessor: (m) => formatCurrencyBr(m.entradasPrevistas),
          },
          { header: 'Total de Entradas (R$)', accessor: (m) => formatCurrencyBr(m.totalEntradas) },
          {
            header: 'Saídas Realizadas (R$)',
            accessor: (m) => formatCurrencyBr(m.saidasRealizadas),
          },
          { header: 'Saídas Previstas (R$)', accessor: (m) => formatCurrencyBr(m.saidasPrevistas) },
          { header: 'Total de Saídas (R$)', accessor: (m) => formatCurrencyBr(m.totalSaidas) },
          {
            header: 'Resultado Líquido do Mês (R$)',
            accessor: (m) => formatCurrencyBr(m.saldoMes),
          },
          {
            header: 'Saldo Acumulado de Caixa (R$)',
            accessor: (m) => formatCurrencyBr(m.saldoAcumulado),
          },
          {
            header: 'Alerta Déficit no Mês',
            accessor: (m) => (m.alertaNegativo ? 'SIM (Atenção)' : 'NÃO'),
          },
        ],
        data: fluxo12Meses,
      })

      toast({
        title: 'Fluxo de Caixa Exportado',
        description:
          'Relatório de 12 meses gerado em CSV com sucesso. Auditoria financeira registrada.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar fluxo de caixa',
        description: err.message || 'Falha ao processar CSV.',
        variant: 'destructive',
      })
    } finally {
      setExportando(null)
    }
  }

  // 2. Relatório: Contas por Status e Período
  const exportarContasGeral = async () => {
    setExportando('contas')
    try {
      await exportService.exportarParaCsv({
        filename: `relatorio_contas_geral_${new Date().toISOString().slice(0, 10)}.csv`,
        tela: 'relatorios_financeiros_contas',
        descricao: 'Relatório Completo de Contas a Pagar e Receber por Status e Período',
        isFinanceiro: true,
        columns: [
          { header: 'Tipo', accessor: (c) => (c.tipo === 'receber' ? 'A Receber' : 'A Pagar') },
          { header: 'Descrição', accessor: (c) => c.descricao },
          {
            header: 'Cliente / Executor',
            accessor: (c) =>
              c.tipo === 'receber'
                ? c.expand?.projeto?.expand?.empresa?.razao_social ||
                  c.expand?.projeto?.expand?.empresa?.nome_fantasia ||
                  c.expand?.proposta?.expand?.empresa?.razao_social ||
                  c.expand?.proposta?.expand?.cliente_pf?.nome ||
                  'Cliente'
                : c.expand?.executor?.nome || 'Despesa Operacional',
          },
          { header: 'Projeto Vinculado', accessor: (c) => c.expand?.projeto?.codigo || '' },
          { header: 'Proposta Origem', accessor: (c) => c.expand?.proposta?.numero || '' },
          { header: 'Valor Bruto (R$)', accessor: (c) => formatCurrencyBr(c.valor) },
          {
            header: 'Retenção Impostos (R$)',
            accessor: (c) => formatCurrencyBr(c.retencao_impostos || 0),
          },
          {
            header: 'Valor Líquido (R$)',
            accessor: (c) => formatCurrencyBr(c.valor_liquido || c.valor),
          },
          {
            header: 'Vencimento',
            accessor: (c) => (c.vencimento ? formatDateBr(c.vencimento) : ''),
          },
          { header: 'Status', accessor: (c) => c.status },
          {
            header: 'Data de Baixa / Pagamento',
            accessor: (c) => (c.data_pagamento ? formatDateBr(c.data_pagamento) : ''),
          },
          { header: 'Número NF / Documento', accessor: (c) => c.nf || '' },
          { header: 'Forma de Pagamento', accessor: (c) => c.forma_pagamento || '' },
        ],
        data: contas,
      })

      toast({
        title: 'Relatório de Contas Exportado',
        description: `${contas.length} lançamentos exportados com sucesso. Auditoria financeira registrada.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na exportação',
        description: err.message || 'Falha ao gerar CSV.',
        variant: 'destructive',
      })
    } finally {
      setExportando(null)
    }
  }

  // 3. Relatório: Fechamento Financeiro Consolidado por Projeto
  const exportarFechamentoProjetos = async () => {
    setExportando('fechamento')
    try {
      // Agrupar contas por projeto
      const fechamentoMap = new Map<
        string,
        {
          projeto: ProjetoRecord
          receitasPrevistas: number
          receitasPagas: number
          subcontratacoesPrevistas: number
          subcontratacoesPagas: number
          retencoes: number
        }
      >()

      // Inicializa com projetos existentes
      projetos.forEach((p) => {
        fechamentoMap.set(p.id, {
          projeto: p,
          receitasPrevistas: 0,
          receitasPagas: 0,
          subcontratacoesPrevistas: 0,
          subcontratacoesPagas: 0,
          retencoes: 0,
        })
      })

      // Soma contas vinculadas aos projetos
      contas.forEach((c) => {
        if (!c.projeto) return
        let item = fechamentoMap.get(c.projeto)
        if (!item) {
          // caso não esteja carregado em projetos
          item = {
            projeto:
              c.expand?.projeto || ({ id: c.projeto, codigo: 'PRJ', nome: 'Projeto' } as any),
            receitasPrevistas: 0,
            receitasPagas: 0,
            subcontratacoesPrevistas: 0,
            subcontratacoesPagas: 0,
            retencoes: 0,
          }
          fechamentoMap.set(c.projeto, item)
        }

        const isPaga = c.status === 'paga' || c.status === 'realizada'
        if (c.tipo === 'receber') {
          if (isPaga) {
            item.receitasPagas += c.valor
          } else if (c.status !== 'cancelada') {
            item.receitasPrevistas += c.valor
          }
        } else if (c.tipo === 'pagar') {
          item.retencoes += c.retencao_impostos || 0
          if (isPaga) {
            item.subcontratacoesPagas += c.valor
          } else if (c.status !== 'cancelada') {
            item.subcontratacoesPrevistas += c.valor
          }
        }
      })

      const dadosFechamento = Array.from(fechamentoMap.values())

      await exportService.exportarParaCsv({
        filename: `fechamento_financeiro_projetos_${new Date().toISOString().slice(0, 10)}.csv`,
        tela: 'relatorios_financeiros_fechamento_projetos',
        descricao:
          'Fechamento Financeiro Consolidado por Projeto (Receitas, Despesas, Subcontratações e Margem)',
        isFinanceiro: true,
        columns: [
          { header: 'Código Projeto', accessor: (d) => d.projeto.codigo },
          {
            header: 'Nome do Projeto',
            accessor: (d) => d.projeto.nome || `Projeto ${d.projeto.codigo}`,
          },
          {
            header: 'Cliente',
            accessor: (d) =>
              d.projeto.expand?.empresa?.razao_social ||
              d.projeto.expand?.empresa?.nome_fantasia ||
              d.projeto.expand?.cliente_pf?.nome ||
              'Cliente',
          },
          { header: 'Status Projeto', accessor: (d) => d.projeto.status || 'em_andamento' },
          {
            header: 'Valor Contratado Total (R$)',
            accessor: (d) =>
              formatCurrencyBr(d.projeto.valor_total || d.receitasPagas + d.receitasPrevistas),
          },
          {
            header: 'Receitas Liquidadas (R$)',
            accessor: (d) => formatCurrencyBr(d.receitasPagas),
          },
          {
            header: 'Receitas a Receber (R$)',
            accessor: (d) => formatCurrencyBr(d.receitasPrevistas),
          },
          {
            header: 'Subcontratações Pagas (R$)',
            accessor: (d) => formatCurrencyBr(d.subcontratacoesPagas),
          },
          {
            header: 'Subcontratações a Pagar (R$)',
            accessor: (d) => formatCurrencyBr(d.subcontratacoesPrevistas),
          },
          { header: 'Retenções de Impostos (R$)', accessor: (d) => formatCurrencyBr(d.retencoes) },
          {
            header: 'Resultado Operacional Realizado (R$)',
            accessor: (d) => formatCurrencyBr(d.receitasPagas - d.subcontratacoesPagas),
          },
          {
            header: 'Resultado Total Projetado (R$)',
            accessor: (d) => {
              const recTot = d.receitasPagas + d.receitasPrevistas
              const despTot = d.subcontratacoesPagas + d.subcontratacoesPrevistas
              return formatCurrencyBr(recTot - despTot)
            },
          },
          {
            header: 'Margem Projetada (%)',
            accessor: (d) => {
              const recTot = d.receitasPagas + d.receitasPrevistas
              const despTot = d.subcontratacoesPagas + d.subcontratacoesPrevistas
              if (recTot <= 0) return '0%'
              const margem = ((recTot - despTot) / recTot) * 100
              return `${margem.toFixed(1)}%`
            },
          },
        ],
        data: dadosFechamento,
      })

      toast({
        title: 'Fechamento de Projetos Exportado',
        description: `${dadosFechamento.length} projetos consolidados em CSV. Auditoria registrada.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro no fechamento de projetos',
        description: err.message || 'Falha ao exportar CSV.',
        variant: 'destructive',
      })
    } finally {
      setExportando(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Relatórios Financeiros Exportáveis
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Gere e baixe planilhas CSV padrão Excel Brasil (separador ";", datas dd/mm/aaaa e
                valores R$).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Relatório 1: Fluxo de Caixa 12 Meses */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Fluxo de Caixa 12 Meses (CSV)</h4>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                >
                  12 Meses
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Detalhamento mês a mês com entradas realizadas/previstas, saídas operacionais,
                resultado mensal e saldo de caixa acumulado.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportarFluxoCaixa12m}
              disabled={exportando !== null}
              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              {exportando === 'fluxo12m' ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>

          {/* Relatório 2: Contas por Status / Período */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Contas por Status e Período (CSV)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {contas.length} contas
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Lista analítica completa de contas a pagar e receber, clientes, executores,
                retenções de impostos, vencimentos e datas de liquidação.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportarContasGeral}
              disabled={exportando !== null}
              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              {exportando === 'contas' ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>

          {/* Relatório 3: Fechamento por Projeto */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Fechamento Financeiro por Projeto (CSV)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                >
                  {projetos.length} projetos
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Demonstrativo por projeto consolidando receitas contratadas/faturadas, custos com
                terceirizados, retenções e margem final de intermediação.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportarFechamentoProjetos}
              disabled={exportando !== null}
              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              {exportando === 'fechamento' ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            🔒 Acesso restrito a usuários com perfil Admin e Financeiro. Auditoria obrigatória.
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
