import pb from '@/lib/pocketbase/client'
import {
  EmpresaRecord,
  ContratoRecord,
  PropostaRecord,
  PropostaItemRecord,
  AreaAtuacaoRecord,
  ProjetoRecord,
  ProjetoEtapaRecord,
  DocumentoRecord,
  RiscoRecord,
  ContaRecord,
  CampanhaRecord,
  AuditLogRecord,
  ExecutorRecord,
  CurvaABC,
  ETAPA_FUNIL_LABELS,
  EtapaFunil,
} from '@/types'
import { scoreCurvaService } from '@/services/scoreCurva'
import { financeiroService, ResumoFinanceiro } from '@/services/financeiro'
import { toquesService } from '@/services/toques'
import { parceirosService } from '@/services/parceiros'
import { parametrosService } from '@/services/parametros'
import { projetosService } from '@/services/projetos'
import { executoresService } from '@/services/executores'

export type PeriodoFiltroPropostas = 'mes_corrente' | 'ultimos_90_dias' | 'ano_corrente'

export interface AlertaDashboard {
  id: string
  tipo:
    | 'cadencia'
    | 'parceiro_dormente'
    | 'campanha'
    | 'executor'
    | 'projeto_vermelho'
    | 'documento'
  titulo: string
  descricao: string
  severidade: 'critico' | 'aviso' | 'info'
  responsavel?: string
  rotaDestino: string
  badgeLabel?: string
}

export interface DashboardDados {
  // 1. Comercial / Funil
  funil: {
    contagemPorEtapa: Record<EtapaFunil, number>
    totalEmpresasAtivas: number
    valorTotalContratosGestao: number
    curvaABC: {
      A: { count: number; valor: number }
      B: { count: number; valor: number }
      C: { count: number; valor: number }
    }
  }

  // 2. Propostas (afetadas pelo seletor de período)
  propostas: {
    taxaAceite: number // (aceitas / enviadas) * 100
    totalEnviadas: number
    totalAceitas: number
    valorPropostoMes: number
    valorFechadoMes: number
    aguardandoAprovacaoInterna: {
      total: number
      propostas: { id: string; numero: string; cliente: string; preco: number }[]
    }
    recusasPorMotivo: { motivo: string; quantidade: number; percentual: number }[]
    proximasExpirarD3: {
      id: string
      numero: string
      cliente: string
      validade: string
      diasRestantes: number
    }[]
    expiradasNoMes: {
      id: string
      numero: string
      cliente: string
      validade: string
    }[]
  }

  // 3. Projetos
  projetos: {
    porSaude: {
      verde: number
      amarelo: number
      vermelho: number
    }
    vermelhosLista: {
      id: string
      codigo: string
      nome: string
      cliente: string
      justificativa: string
      valor: number
    }[]
    emExecucaoCount: number
    concluidosCount: number
    etapasAtrasadas: {
      id: string
      etapaNome: string
      projetoCodigo: string
      projetoNome: string
      prazo: string
      diasAtraso: number
      executorNome?: string
    }[]
    documentosVencendo: {
      id: string
      tipo: string
      numero: string
      projetoCodigo: string
      vencimento: string
      diasAteVencimento: number
      alertaNivel: 'vencido' | 'd1' | 'd7' | 'd15' | 'd30'
    }[]
    riscosAltoAlto: {
      id: string
      descricao: string
      projetoCodigo: string
      projetoNome: string
      mitigacao: string
    }[]
  }

  // 4. Financeiro
  financeiro: {
    saldoReceber: number
    saldoPagar: number
    saldoLiquido: number
    atrasadasReceber: { valor: number; qtd: number }
    atrasadasPagar: { valor: number; qtd: number }
    projecao30Dias: { receber: number; pagar: number; saldo: number }
    projecao60Dias: { receber: number; pagar: number; saldo: number }
    projecao90Dias: { receber: number; pagar: number; saldo: number }
  }

  // 5. Painel de Alertas Consolidados
  alertas: AlertaDashboard[]

  // 6. Atividade Recente (Audit Logs)
  atividadeRecente: {
    id: string
    acao: string
    entidade: string
    descricaoFormatada: string
    usuarioNome: string
    usuarioEmail: string
    dataHora: string
  }[]
  resumoAtividades: {
    hojeCount: number
    semanaCount: number
  }

  // 7. Produção por Área de Atuação Técnica
  producaoPorArea: {
    areaId: string
    areaNome: string
    propostasEmitidas: number
    propostasAceitas: number
    valorProposto: number
    valorFechado: number
    projetosGerados: number
    etapasGeradas: number
  }[]
}

export const dashboardService = {
  /**
   * Registra no backend o acesso exclusivo do administrador ao Dashboard
   */
  async registrarAcesso(): Promise<void> {
    try {
      await pb.send('/backend/v1/dashboard/audit', {
        method: 'POST',
      })
    } catch (err) {
      console.warn('Não foi possível registrar auditoria de acesso ao dashboard:', err)
    }
  },

  /**
   * Carrega todas as informações necessárias e calcula em tempo de execução ao abrir o dashboard.
   */
  async carregarDashboard(
    periodoPropostas: PeriodoFiltroPropostas = 'mes_corrente',
  ): Promise<DashboardDados> {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTimestamp = hoje.getTime()
    const hojeIsoStr = hoje.toISOString().slice(0, 10)

    // Parâmetros do sistema
    let diasLimiteAtrasoToque = 2
    let diasSemDemandaParceiro = 180
    let notaCorteExecutor = 3.0
    try {
      const [pToque, pParceiro, pCorte] = await Promise.all([
        parametrosService.getByKey('limite_atraso_toques').catch(() => null),
        parametrosService.getByKey('dias_alerta_sem_demanda_parceiro').catch(() => null),
        parametrosService.getByKey('nota_corte_executor').catch(() => null),
      ])
      if (pToque?.valor) diasLimiteAtrasoToque = parseInt(pToque.valor, 10) || 2
      if (pParceiro?.valor) diasSemDemandaParceiro = parseInt(pParceiro.valor, 10) || 180
      if (pCorte?.valor) notaCorteExecutor = parseFloat(pCorte.valor) || 3.0
    } catch {
      /* default values */
    }

    // Carregar todas as coleções em paralelo
    const [
      empresas,
      contratos,
      toques,
      campanhas,
      propostasRaw,
      propostaItensRaw,
      areasAtuacaoRaw,
      projetos,
      etapas,
      documentos,
      riscos,
      contas,
      executores,
      auditLogs,
      parceiros,
    ] = await Promise.all([
      pb
        .collection('empresas')
        .getFullList<EmpresaRecord>({ filter: 'pre_cadastro != true', sort: 'razao_social' }),
      pb.collection('contratos').getFullList<ContratoRecord>({ sort: '-created' }),
      pb
        .collection('toques')
        .getFullList({ filter: 'status != "cancelado"', expand: 'empresa,empresa.responsavel' }),
      pb.collection('campanhas').getFullList<CampanhaRecord>({ sort: '-created' }),
      pb.collection('propostas').getFullList<PropostaRecord>({
        sort: '-created',
        expand: 'empresa,cliente_pf,contrato,criado_por',
      }),
      pb
        .collection('proposta_itens')
        .getFullList<PropostaItemRecord>({
          sort: '-created',
          expand: 'area,projeto_gerado,etapa_gerada',
        })
        .catch(() => []),
      pb
        .collection('areas_atuacao')
        .getFullList<AreaAtuacaoRecord>({
          sort: 'ordem,nome',
        })
        .catch(() => []),
      pb.collection('projetos').getFullList<ProjetoRecord>({
        sort: '-created',
        expand: 'empresa,cliente_pf,proposta',
      }),
      pb.collection('projeto_etapas').getFullList<ProjetoEtapaRecord>({
        sort: 'prazo',
        expand: 'projeto,executor,area',
      }),
      pb.collection('documentos').getFullList<DocumentoRecord>({
        sort: 'vencimento',
        expand: 'projeto,etapa',
      }),
      pb.collection('riscos').getFullList<RiscoRecord>({
        filter: "status != 'mitigado' && status != 'encerrado'",
        expand: 'projeto',
      }),
      financeiroService.listAll(),
      executoresService.listComMetricas(notaCorteExecutor),
      pb.collection('audit_logs').getList<AuditLogRecord>(1, 30, {
        sort: '-created',
        expand: 'user',
      }),
      parceirosService.listParceiros().catch(() => []),
    ])

    // =========================================================================
    // 1. COMERCIAL / FUNIL & CURVA ABC
    // =========================================================================
    const contagemPorEtapa: Record<EtapaFunil, number> = {
      identificada: 0,
      qualificada: 0,
      em_cadencia: 0,
      em_conversa: 0,
      com_proposta_elaborada: 0,
      proposta_enviada: 0,
      parceira: 0,
      nutricao_mensal: 0,
      inativa: 0,
    }

    let totalEmpresasAtivas = 0
    for (const e of empresas) {
      if (e.etapa_funil && contagemPorEtapa[e.etapa_funil] !== undefined) {
        contagemPorEtapa[e.etapa_funil]++
      }
      if (e.status === 'ativa') {
        totalEmpresasAtivas++
      }
    }

    // Mapa de contratos ativos por empresa
    const contratosPorEmpresa: Record<string, ContratoRecord[]> = {}
    let valorTotalContratosGestao = 0
    for (const c of contratos) {
      const sit = (c.situacao || '').toLowerCase()
      if (sit.includes('encerr') || sit.includes('cancel') || sit.includes('rescind')) continue
      if (!contratosPorEmpresa[c.empresa]) {
        contratosPorEmpresa[c.empresa] = []
      }
      contratosPorEmpresa[c.empresa].push(c)
      valorTotalContratosGestao += Number(c.valor) || 0
    }

    // Curva ABC automática por índice composto e Pareto usando scoreCurvaService
    const curvaABC = {
      A: { count: 0, valor: 0 },
      B: { count: 0, valor: 0 },
      C: { count: 0, valor: 0 },
    }

    const mapaContratosAtivos = new Map<string, ContratoRecord[]>()
    for (const empId of Object.keys(contratosPorEmpresa)) {
      mapaContratosAtivos.set(empId, contratosPorEmpresa[empId])
    }

    const empresasAtivas = empresas.filter((e) => e.status === 'ativa')
    const mapaClassificacao = scoreCurvaService.classificarBaseEmpresas(
      empresasAtivas,
      mapaContratosAtivos,
    )

    for (const emp of empresasAtivas) {
      const resScore =
        mapaClassificacao.get(emp.id) ||
        scoreCurvaService.calcular(contratosPorEmpresa[emp.id] || [], emp.cnae)
      const curva = resScore.curva || 'C'
      curvaABC[curva].count++
      curvaABC[curva].valor += resScore.totalValorAtivo
    }

    // =========================================================================
    // 2. PROPOSTAS (com filtro de período dinâmico)
    // =========================================================================
    // Atualizar expiradas em tempo de execução
    const propostas = propostasRaw.map((p) => {
      if (
        (p.status === 'enviada' || p.status === 'visualizada' || p.status === 'em_negociacao') &&
        p.validade
      ) {
        const valDate = new Date(p.validade)
        valDate.setHours(23, 59, 59, 999)
        if (hojeTimestamp > valDate.getTime()) {
          return { ...p, status: 'expirada' as const }
        }
      }
      return p
    })

    // Definir intervalo de datas baseado em periodoPropostas
    let dataInicioPeriodo: Date
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() // 0 a 11

    if (periodoPropostas === 'mes_corrente') {
      dataInicioPeriodo = new Date(anoAtual, mesAtual, 1)
    } else if (periodoPropostas === 'ultimos_90_dias') {
      dataInicioPeriodo = new Date(hojeTimestamp - 90 * 24 * 60 * 60 * 1000)
    } else {
      // ano_corrente
      dataInicioPeriodo = new Date(anoAtual, 0, 1)
    }

    // Filtrar propostas no período selecionado
    const propostasNoPeriodo = propostas.filter((p) => {
      const criadoEm = new Date(p.created || '')
      return criadoEm >= dataInicioPeriodo
    })

    // Taxa de aceite no período: aceitas / enviadas
    const statusEnviadas = [
      'enviada',
      'visualizada',
      'em_negociacao',
      'aceita',
      'recusada',
      'expirada',
    ]
    let enviadasPeriodo = 0
    let aceitasPeriodo = 0
    const recusasMap: Record<string, number> = {}

    for (const p of propostasNoPeriodo) {
      if (statusEnviadas.includes(p.status)) {
        enviadasPeriodo++
      }
      if (p.status === 'aceita') {
        aceitasPeriodo++
      } else if (p.status === 'recusada') {
        const motivo = p.motivo_recusa || 'Outros motivos'
        recusasMap[motivo] = (recusasMap[motivo] || 0) + 1
      }
    }

    const taxaAceite =
      enviadasPeriodo > 0 ? Math.round((aceitasPeriodo / enviadasPeriodo) * 1000) / 10 : 0

    // Valor proposto x valor fechado no MÊS CORRENTE
    const inicioMesCorrente = new Date(anoAtual, mesAtual, 1)
    let valorPropostoMes = 0
    let valorFechadoMes = 0
    for (const p of propostas) {
      const criadoEm = new Date(p.created || '')
      if (criadoEm >= inicioMesCorrente) {
        valorPropostoMes += Number(p.preco) || 0
      }
      if (p.status === 'aceita') {
        const dataAceite = p.data_aceite ? new Date(p.data_aceite) : new Date(p.updated || '')
        if (dataAceite >= inicioMesCorrente) {
          valorFechadoMes += Number(p.preco) || 0
        }
      }
    }

    // Propostas aguardando aprovação interna (rascunhos com pendência de aprovação de alçada)
    const propostasAprovacao = propostas.filter(
      (p) => p.status === 'rascunho' && Boolean(p.requer_aprovacao_admin),
    )
    const aguardandoAprovacaoInterna = {
      total: propostasAprovacao.length,
      propostas: propostasAprovacao.map((p) => ({
        id: p.id,
        numero: p.numero,
        cliente:
          p.expand?.empresa?.razao_social ||
          p.expand?.empresa?.nome_fantasia ||
          p.expand?.cliente_pf?.nome ||
          'Cliente direto',
        preco: Number(p.preco) || 0,
      })),
    }

    // Distribuição dos motivos de recusa no período
    const totalRecusas = Object.values(recusasMap).reduce((a, b) => a + b, 0)
    const recusasPorMotivo = Object.entries(recusasMap)
      .map(([motivo, quantidade]) => ({
        motivo,
        quantidade,
        percentual: totalRecusas > 0 ? Math.round((quantidade / totalRecusas) * 100) : 0,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)

    // Propostas próximas de expirar (D-3) e expiradas no mês
    const proximasExpirarD3: DashboardDados['propostas']['proximasExpirarD3'] = []
    const expiradasNoMes: DashboardDados['propostas']['expiradasNoMes'] = []

    for (const p of propostas) {
      if (p.validade) {
        const valDate = new Date(p.validade)
        valDate.setHours(23, 59, 59, 999)
        const diffDias = Math.ceil((valDate.getTime() - hojeTimestamp) / (1000 * 60 * 60 * 24))
        const clienteNome =
          p.expand?.empresa?.razao_social ||
          p.expand?.empresa?.nome_fantasia ||
          p.expand?.cliente_pf?.nome ||
          'Cliente direto'

        // D-3 ativa
        if (
          (p.status === 'enviada' || p.status === 'visualizada' || p.status === 'em_negociacao') &&
          diffDias >= 0 &&
          diffDias <= 3
        ) {
          proximasExpirarD3.push({
            id: p.id,
            numero: p.numero,
            cliente: clienteNome,
            validade: p.validade,
            diasRestantes: Math.max(0, diffDias),
          })
        }

        // Expiradas no mês corrente
        if (p.status === 'expirada' && valDate >= inicioMesCorrente) {
          expiradasNoMes.push({
            id: p.id,
            numero: p.numero,
            cliente: clienteNome,
            validade: p.validade,
          })
        }
      }
    }

    // =========================================================================
    // 3. PROJETOS
    // =========================================================================
    const porSaude = { verde: 0, amarelo: 0, vermelho: 0 }
    const vermelhosLista: DashboardDados['projetos']['vermelhosLista'] = []
    let emExecucaoCount = 0
    let concluidosCount = 0

    for (const prj of projetos) {
      const saude = prj.saude || 'verde'
      if (saude === 'verde') porSaude.verde++
      else if (saude === 'amarelo') porSaude.amarelo++
      else if (saude === 'vermelho') {
        porSaude.vermelho++
        const pj = prj.expand?.empresa || prj.expand?.proposta?.expand?.empresa
        const pf = prj.expand?.cliente_pf || prj.expand?.proposta?.expand?.cliente_pf
        vermelhosLista.push({
          id: prj.id,
          codigo: prj.codigo,
          nome: prj.nome || `Projeto ${prj.codigo}`,
          cliente: pj?.nome_fantasia || pj?.razao_social || pf?.nome || 'Cliente não vinculado',
          justificativa: prj.justificativa_saude || 'Sem justificativa informada',
          valor: Number(prj.valor_total) || 0,
        })
      }

      if (prj.status === 'concluido') {
        concluidosCount++
      } else {
        emExecucaoCount++
      }
    }

    // Etapas em atraso (prazo vencido e status != concluida/cancelada)
    const etapasAtrasadas: DashboardDados['projetos']['etapasAtrasadas'] = []
    for (const et of etapas) {
      if (et.status === 'concluida' || et.status === 'cancelada') {
        continue
      }
      if (et.prazo) {
        const prazoDate = new Date(et.prazo)
        prazoDate.setHours(23, 59, 59, 999)
        if (hojeTimestamp > prazoDate.getTime()) {
          const diasAtraso = Math.floor(
            (hojeTimestamp - prazoDate.getTime()) / (1000 * 60 * 60 * 24),
          )
          etapasAtrasadas.push({
            id: et.id,
            etapaNome: et.nome,
            projetoCodigo: et.expand?.projeto?.codigo || '',
            projetoNome: et.expand?.projeto?.nome || '',
            prazo: et.prazo,
            diasAtraso,
            executorNome: et.expand?.executor?.nome,
          })
        }
      }
    }

    // Documentos vencendo (D-30 / D-15 / D-7 / D-1 / Vencidos)
    const docsComAlerta = projetosService.calcularAlertasDocumentos(documentos)
    const documentosVencendo: DashboardDados['projetos']['documentosVencendo'] = []
    for (const d of docsComAlerta) {
      if (d.alertaNivel && ['vencido', 'd1', 'd7', 'd15', 'd30'].includes(d.alertaNivel)) {
        documentosVencendo.push({
          id: d.id,
          tipo: d.tipo,
          numero: d.numero || '',
          projetoCodigo: d.expand?.projeto?.codigo || '',
          vencimento: d.vencimento || '',
          diasAteVencimento: d.diasAteVencimento ?? 0,
          alertaNivel: d.alertaNivel as 'vencido' | 'd1' | 'd7' | 'd15' | 'd30',
        })
      }
    }

    // Riscos Alto Probabilidade & Alto Impacto em aberto
    const riscosAltoAlto: DashboardDados['projetos']['riscosAltoAlto'] = []
    for (const r of riscos) {
      if (r.probabilidade === 'alta' && r.impacto === 'alto') {
        riscosAltoAlto.push({
          id: r.id,
          descricao: r.descricao,
          projetoCodigo: r.expand?.projeto?.codigo || '',
          projetoNome: r.expand?.projeto?.nome || '',
          mitigacao: r.mitigacao || 'Plano de mitigação não detalhado',
        })
      }
    }

    // =========================================================================
    // 4. FINANCEIRO (Reuso de ResumoFinanceiro existente)
    // =========================================================================
    const resumoFin: ResumoFinanceiro = financeiroService.calcularResumoFinanceiro(contas)
    const financeiro = {
      saldoReceber: resumoFin.saldoReceber,
      saldoPagar: resumoFin.saldoPagar,
      saldoLiquido: resumoFin.saldoLiquidoProjetado,
      atrasadasReceber: {
        valor: resumoFin.atrasadosReceberValor,
        qtd: resumoFin.atrasadosReceberQtd,
      },
      atrasadasPagar: {
        valor: resumoFin.atrasadosPagarValor,
        qtd: resumoFin.atrasadosPagarQtd,
      },
      projecao30Dias: resumoFin.projecao30Dias,
      projecao60Dias: resumoFin.projecao60Dias,
      projecao90Dias: resumoFin.projecao90Dias,
    }

    // =========================================================================
    // 5. PAINEL DE ALERTAS CONSOLIDADOS (Clicáveis)
    // =========================================================================
    const alertas: AlertaDashboard[] = []

    // 5.1 Atraso Crítico na Cadência
    // Agrupar toques por empresa em cadência
    const empresasEmCadencia = new Set(
      empresas
        .filter((e) => e.status === 'ativa' && e.etapa_funil === 'em_cadencia')
        .map((e) => e.id),
    )
    const toquesPorEmpresa: Record<string, any[]> = {}
    for (const t of toques) {
      const empId = typeof t.empresa === 'string' ? t.empresa : t.empresa?.id
      if (empId && empresasEmCadencia.has(empId)) {
        if (!toquesPorEmpresa[empId]) toquesPorEmpresa[empId] = []
        toquesPorEmpresa[empId].push(t)
      }
    }

    for (const empId of Object.keys(toquesPorEmpresa)) {
      const calcToques = toquesService.calcularStatusToques(
        toquesPorEmpresa[empId],
        diasLimiteAtrasoToque,
      )
      for (const t of calcToques) {
        if (t.isLiberadoParaExecucao && t.isCriticoAdmin) {
          const empObj = empresas.find((e) => e.id === empId)
          const respNome =
            t.expand?.empresa?.expand?.responsavel?.name ||
            empObj?.expand?.responsavel?.name ||
            'Comercial'
          alertas.push({
            id: `cadencia_${t.id}`,
            tipo: 'cadencia',
            titulo: `Cadência Crítica: ${t.expand?.empresa?.razao_social || empObj?.razao_social || 'Empresa'}`,
            descricao: `Toque ${t.numero_toque} atrasado há ${t.diasAtraso} dias (limite: ${diasLimiteAtrasoToque}d).`,
            severidade: 'critico',
            responsavel: respNome,
            rotaDestino: `/acoes-do-dia?empresaId=${empId}`,
            badgeLabel: `${t.diasAtraso}d atraso`,
          })
        }
      }
    }

    // 5.2 Parceiros sem demanda há mais de 180 dias
    try {
      const [parcProps, parcProjs, parcContas, parcContratos] = await Promise.all([
        parceirosService.listPropostas().catch(() => []),
        parceirosService.listProjetos().catch(() => []),
        parceirosService.listContasReceber().catch(() => []),
        pb
          .collection('contratos')
          .getFullList<ContratoRecord>({ sort: '-created' })
          .catch(() => []),
      ])

      const indsParceiros = parceirosService.calcularIndicadoresParceiros(
        parceiros,
        parcProps,
        parcProjs,
        parcContas,
        parcContratos,
        diasSemDemandaParceiro,
      )

      for (const pInd of indsParceiros) {
        if (pInd.isSemDemandaCritica) {
          const nomeEmp = pInd.empresa.nome_fantasia || pInd.empresa.razao_social
          alertas.push({
            id: `parceiro_${pInd.empresa.id}`,
            tipo: 'parceiro_dormente',
            titulo: `Parceiro Dormente: ${nomeEmp}`,
            descricao: `Sem novas demandas há ${pInd.diasSemDemanda} dias (parâmetro de alerta: ${diasSemDemandaParceiro} dias).`,
            severidade: 'aviso',
            responsavel: 'Comercial',
            rotaDestino: `/parceiros?semDemanda=true&busca=${encodeURIComponent(pInd.empresa.razao_social)}`,
            badgeLabel: `${pInd.diasSemDemanda}d sem demanda`,
          })
        }
      }
    } catch (err) {
      console.warn('Erro ao calcular parceiros sem demanda:', err)
    }

    // 5.3 Campanhas pendentes de aprovação
    const campanhasPendentes = campanhas.filter(
      (c) => c.status === 'rascunho' || c.status === 'devolvida',
    )
    for (const c of campanhasPendentes) {
      alertas.push({
        id: `campanha_${c.id}`,
        tipo: 'campanha',
        titulo: `Campanha Aguardando Aprovação: "${c.nome}"`,
        descricao:
          c.status === 'devolvida'
            ? 'Campanha devolvida pelo Admin para revisão comercial.'
            : 'Campanha em rascunho requer aprovação e agendamento pelo Admin.',
        severidade: 'aviso',
        responsavel: 'Admin / Comercial',
        rotaDestino: '/campanhas',
        badgeLabel: c.status === 'devolvida' ? 'Devolvida' : 'Rascunho',
      })
    }

    // 5.4 Executores com conselho vencido/vencendo ou nota abaixo do corte
    for (const ex of executores) {
      if (ex.isRegistroVencido) {
        alertas.push({
          id: `exec_vencido_${ex.id}`,
          tipo: 'executor',
          titulo: `Conselho Vencido: ${ex.nome}`,
          descricao: `Registro ${ex.conselho || 'Conselho'} expirado em ${ex.conselho_validade ? new Date(ex.conselho_validade).toLocaleDateString('pt-BR') : 'data não informada'}.`,
          severidade: 'critico',
          responsavel: 'Gestor de Projetos',
          rotaDestino: `/executores?alerta=vencido&busca=${encodeURIComponent(ex.nome)}`,
          badgeLabel: 'Conselho Vencido',
        })
      } else if (ex.isRegistroVencendoBreve) {
        alertas.push({
          id: `exec_vencendo_${ex.id}`,
          tipo: 'executor',
          titulo: `Conselho Vencendo em Breve: ${ex.nome}`,
          descricao: `Registro de conselho expira nos próximos 30 dias (${ex.conselho_validade ? new Date(ex.conselho_validade).toLocaleDateString('pt-BR') : ''}).`,
          severidade: 'aviso',
          responsavel: 'Gestor de Projetos',
          rotaDestino: `/executores?alerta=vencendo&busca=${encodeURIComponent(ex.nome)}`,
          badgeLabel: 'Vence em 30d',
        })
      }

      if (ex.isAbaixoNotaCorte) {
        alertas.push({
          id: `exec_corte_${ex.id}`,
          tipo: 'executor',
          titulo: `Desempenho Crítico: ${ex.nome}`,
          descricao: `Nota média de avaliações (${ex.nota_geral ? ex.nota_geral.toFixed(1) : 0}) abaixo do corte mínimo de ${notaCorteExecutor.toFixed(1)}.`,
          severidade: 'critico',
          responsavel: 'Gestor de Projetos',
          rotaDestino: `/executores?alerta=baixa_nota&busca=${encodeURIComponent(ex.nome)}`,
          badgeLabel: `Nota ${ex.nota_geral ? ex.nota_geral.toFixed(1) : 0}`,
        })
      }
    }

    // 5.5 Projetos com Saúde Vermelha
    for (const prjV of vermelhosLista) {
      alertas.push({
        id: `prj_red_${prjV.id}`,
        tipo: 'projeto_vermelho',
        titulo: `Projeto em Estado Crítico: ${prjV.codigo}`,
        descricao: `${prjV.nome} — Motivo: ${prjV.justificativa}`,
        severidade: 'critico',
        responsavel: 'Gestor de Projetos',
        rotaDestino: `/projetos?saude=vermelho&busca=${encodeURIComponent(prjV.codigo)}`,
        badgeLabel: '🔴 Saúde Vermelha',
      })
    }

    // =========================================================================
    // 6. ATIVIDADE RECENTE (Audit Logs Relevantes)
    // =========================================================================
    const acoesRelevantesFiltro = [
      'MOVIMENTACAO_FUNIL',
      'ACEITE_PROPOSTA',
      'RECUSA_PROPOSTA',
      'INATIVACAO',
      'APROVACAO_FINANCEIRA',
      'ACESSO_DASHBOARD',
      'EXPORTACAO',
      'CONFIRMACAO_TOQUE',
    ]

    const parseDescricaoAudit = (log: AuditLogRecord) => {
      const det: any = log.detalhes || {}
      if (log.acao === 'ACEITE_PROPOSTA') return `Proposta aceita online pelo cliente`
      if (log.acao === 'RECUSA_PROPOSTA')
        return `Proposta recusada pelo cliente: ${det.motivo || ''}`
      if (log.acao === 'MOVIMENTACAO_FUNIL')
        return `Empresa movida no funil para ${det.etapa_nova || det.depois?.etapa_funil || ''}`
      if (log.acao === 'INATIVACAO') return `Inativação de empresa: ${det.motivo || ''}`
      if (log.acao === 'APROVACAO_FINANCEIRA') return `Aprovação de alçada financeira concedida`
      if (log.acao === 'ACESSO_DASHBOARD') return `Acesso ao Dashboard Executivo pelo Administrador`
      if (log.acao === 'EXPORTACAO') return `Exportação de relatório CSV (${log.entidade})`
      if (log.acao === 'CONFIRMACAO_TOQUE')
        return `Confirmação de toque na cadência (${det.canal || ''})`
      if (log.acao === 'CRIACAO') return `Novo registro criado em ${log.entidade}`
      if (log.acao === 'EDICAO') return `Atualização realizada em ${log.entidade}`
      if (log.acao === 'EXCLUSAO') return `Exclusão efetuada em ${log.entidade}`
      return det.descricao || `${log.acao} em ${log.entidade}`
    }

    const logsItems = auditLogs.items || []
    const atividadeRecente = logsItems.slice(0, 15).map((log) => ({
      id: log.id,
      acao: log.acao,
      entidade: log.entidade,
      descricaoFormatada: parseDescricaoAudit(log),
      usuarioNome: log.expand?.user?.name || log.user_email || 'Sistema',
      usuarioEmail: log.user_email || '',
      dataHora: log.created,
    }))

    // Resumo de contagens hoje e na semana
    const seteDiasAtras = new Date(hojeTimestamp - 7 * 24 * 60 * 60 * 1000)
    let hojeCount = 0
    let semanaCount = 0
    for (const log of logsItems) {
      const criadoDate = new Date(log.created)
      if (criadoDate.toISOString().slice(0, 10) === hojeIsoStr) {
        hojeCount++
      }
      if (criadoDate >= seteDiasAtras) {
        semanaCount++
      }
    }

    // =========================================================================
    // 7. PRODUÇÃO POR ÁREA DE ATUAÇÃO TÉCNICA (filtrado pelo período de propostas)
    // =========================================================================
    // Mapa id da proposta -> status no período
    const mapPropostaPeriodo = new Map<string, PropostaRecord>()
    for (const p of propostasNoPeriodo) {
      mapPropostaPeriodo.set(p.id, p)
    }

    const mapaProducaoAreas = new Map<
      string,
      {
        areaId: string
        areaNome: string
        propostasEmitidasIds: Set<string>
        propostasAceitasIds: Set<string>
        valorProposto: number
        valorFechado: number
        projetosGeradosIds: Set<string>
        etapasCount: number
      }
    >()

    // Inicializar com todas as áreas cadastradas
    for (const a of areasAtuacaoRaw) {
      mapaProducaoAreas.set(a.id, {
        areaId: a.id,
        areaNome: a.nome,
        propostasEmitidasIds: new Set(),
        propostasAceitasIds: new Set(),
        valorProposto: 0,
        valorFechado: 0,
        projetosGeradosIds: new Set(),
        etapasCount: 0,
      })
    }

    // Processar itens de proposta (tanto da coleção proposta_itens quanto do fallback itens_json)
    const propostasProcessadasItens = new Set<string>()

    if (propostaItensRaw.length > 0) {
      for (const item of propostaItensRaw) {
        if (!item.proposta || !mapPropostaPeriodo.has(item.proposta)) continue
        propostasProcessadasItens.add(item.proposta)
        const prop = mapPropostaPeriodo.get(item.proposta)!
        const aId = item.area || 'outros'
        let registro = mapaProducaoAreas.get(aId)

        if (!registro) {
          registro = {
            areaId: aId,
            areaNome: item.expand?.area?.nome || 'Outros / Sem Área',
            propostasEmitidasIds: new Set(),
            propostasAceitasIds: new Set(),
            valorProposto: 0,
            valorFechado: 0,
            projetosGeradosIds: new Set(),
            etapasCount: 0,
          }
          mapaProducaoAreas.set(aId, registro)
        }

        registro.propostasEmitidasIds.add(item.proposta)
        registro.valorProposto += Number(item.preco_total) || 0

        if (prop.status === 'aceita') {
          registro.propostasAceitasIds.add(item.proposta)
          registro.valorFechado += Number(item.preco_total) || 0
        }

        if (item.projeto_gerado) {
          registro.projetosGeradosIds.add(item.projeto_gerado)
        }
      }
    }

    // Fallback: propostas no período que ainda não possuíam registros em proposta_itens mas possuem itens_json
    for (const prop of propostasNoPeriodo) {
      if (propostasProcessadasItens.has(prop.id)) continue
      const itens = prop.itens_json || []
      for (const item of itens) {
        const aId = item.area || 'outros'
        let registro = mapaProducaoAreas.get(aId)
        if (!registro) {
          registro = {
            areaId: aId,
            areaNome: item.expand?.area?.nome || item.disciplina || 'Outros / Sem Área',
            propostasEmitidasIds: new Set(),
            propostasAceitasIds: new Set(),
            valorProposto: 0,
            valorFechado: 0,
            projetosGeradosIds: new Set(),
            etapasCount: 0,
          }
          mapaProducaoAreas.set(aId, registro)
        }

        registro.propostasEmitidasIds.add(prop.id)
        registro.valorProposto += Number(item.preco_total) || 0

        if (prop.status === 'aceita') {
          registro.propostasAceitasIds.add(prop.id)
          registro.valorFechado += Number(item.preco_total) || 0
        }

        if (item.projeto_gerado) {
          registro.projetosGeradosIds.add(item.projeto_gerado)
        }
      }
    }

    // Processar etapas de projetos por área
    for (const etapa of etapas) {
      const aId = etapa.area || 'outros'
      let registro = mapaProducaoAreas.get(aId)
      if (!registro) {
        registro = {
          areaId: aId,
          areaNome: etapa.expand?.area?.nome || 'Outros / Sem Área',
          propostasEmitidasIds: new Set(),
          propostasAceitasIds: new Set(),
          valorProposto: 0,
          valorFechado: 0,
          projetosGeradosIds: new Set(),
          etapasCount: 0,
        }
        mapaProducaoAreas.set(aId, registro)
      }
      registro.etapasCount++
      if (etapa.projeto) {
        registro.projetosGeradosIds.add(etapa.projeto)
      }
    }

    const producaoPorArea = Array.from(mapaProducaoAreas.values()).map((r) => ({
      areaId: r.areaId,
      areaNome: r.areaNome,
      propostasEmitidas: r.propostasEmitidasIds.size,
      propostasAceitas: r.propostasAceitasIds.size,
      valorProposto: r.valorProposto,
      valorFechado: r.valorFechado,
      projetosGerados: r.projetosGeradosIds.size,
      etapasGeradas: r.etapasCount,
    }))

    return {
      funil: {
        contagemPorEtapa,
        totalEmpresasAtivas,
        valorTotalContratosGestao,
        curvaABC,
      },
      propostas: {
        taxaAceite,
        totalEnviadas: enviadasPeriodo,
        totalAceitas: aceitasPeriodo,
        valorPropostoMes,
        valorFechadoMes,
        aguardandoAprovacaoInterna,
        recusasPorMotivo,
        proximasExpirarD3,
        expiradasNoMes,
      },
      projetos: {
        porSaude,
        vermelhosLista,
        emExecucaoCount,
        concluidosCount,
        etapasAtrasadas,
        documentosVencendo,
        riscosAltoAlto,
      },
      financeiro,
      alertas,
      atividadeRecente,
      resumoAtividades: {
        hojeCount,
        semanaCount,
      },
      producaoPorArea,
    }
  },
}
