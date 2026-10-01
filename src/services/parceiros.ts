import pb from '@/lib/pocketbase/client'
import {
  EmpresaRecord,
  PropostaRecord,
  ProjetoRecord,
  ContaRecord,
  ContratoRecord,
  IndicadoresParceiro,
  CurvaABC,
  PesosScoreDemandaParceiro,
} from '@/types'

export interface CreateParceiroDiretoData {
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  cnae?: string
  porte?: string
  uf?: string
  municipio?: string
  email?: string
  telefone?: string
  observacoes?: string
  // Proposta opcional na criação direta
  propostaOpcional?: {
    numero: string
    escopo: string
    preco: number
    prazo?: string
  }
}

export const parceirosService = {
  /**
   * Lista todas as empresas parceiras (etapa_funil = 'parceira')
   */
  async listParceiros(): Promise<EmpresaRecord[]> {
    return await pb.collection('empresas').getFullList<EmpresaRecord>({
      filter: "etapa_funil = 'parceira'",
      sort: 'razao_social',
      expand: 'responsavel',
    })
  },

  /**
   * Busca todas as propostas vinculadas a uma lista de empresas ou a uma empresa
   */
  async listPropostas(empresaId?: string): Promise<PropostaRecord[]> {
    const filter = empresaId ? `empresa = '${empresaId}'` : "empresa != ''"
    return await pb.collection('propostas').getFullList<PropostaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,cliente_pf',
    })
  },

  /**
   * Busca todos os projetos
   */
  async listProjetos(): Promise<ProjetoRecord[]> {
    return await pb.collection('projetos').getFullList<ProjetoRecord>({
      sort: '-created',
      expand: 'proposta,contrato',
    })
  },

  /**
   * Busca todas as contas a receber
   */
  async listContasReceber(): Promise<ContaRecord[]> {
    return await pb.collection('contas').getFullList<ContaRecord>({
      filter: "tipo = 'receber'",
      sort: '-created',
      expand: 'projeto,proposta',
    })
  },

  /**
   * Cadastra empresa diretamente como Parceira Demandante, com proposta opcional
   */
  async createParceiroDireto(
    dados: CreateParceiroDiretoData,
    userId?: string,
  ): Promise<EmpresaRecord> {
    const record = await pb.collection('empresas').create<EmpresaRecord>({
      razao_social: dados.razao_social,
      nome_fantasia: dados.nome_fantasia || '',
      cnpj: dados.cnpj || '',
      cnae: dados.cnae || '',
      porte: dados.porte || 'MEDIO',
      uf: dados.uf || '',
      municipio: dados.municipio || '',
      email: dados.email || '',
      telefone: dados.telefone || '',
      observacoes: dados.observacoes || '',
      etapa_funil: 'parceira',
      curva: 'C',
      score: 50,
      status: 'ativa',
      responsavel: userId || null,
    })

    // Se forneceu proposta opcional, cria vinculada
    if (dados.propostaOpcional && dados.propostaOpcional.numero && dados.propostaOpcional.escopo) {
      const preco = Number(dados.propostaOpcional.preco) || 0
      const custo = Math.round(preco * 0.65)
      await pb.collection('propostas').create<PropostaRecord>({
        numero: dados.propostaOpcional.numero,
        revisao: 'R00',
        empresa: record.id,
        escopo: dados.propostaOpcional.escopo,
        preco,
        custo,
        margem: 35,
        impostos: 16.5,
        prazo: dados.propostaOpcional.prazo || '30 dias',
        status: 'aceita',
      })
    }

    return record
  },

  /**
   * Calcula todos os indicadores consolidados de cada parceiro, incluindo a Curva ABC DINÂMICA (Pareto 80/15/5%)
   * e o Score de Demanda ponderado com pesos configuráveis.
   */
  calcularIndicadoresParceiros(
    parceiros: EmpresaRecord[],
    propostas: PropostaRecord[],
    projetos: ProjetoRecord[],
    contas: ContaRecord[],
    contratos: ContratoRecord[],
    diasLimiteSemDemanda = 180,
    pesosScore: PesosScoreDemandaParceiro = {
      peso_contratos_valor: 35,
      peso_taxa_conversao: 35,
      peso_projetos_ano: 30,
    },
    modoCurva: 'dinamico' | 'manual' = 'dinamico',
    cortesPareto = { corteA: 80, corteB: 95 },
  ): IndicadoresParceiro[] {
    const hoje = new Date()

    // 1. Agrupar dados por empresa
    const propostasPorEmpresa: Record<string, PropostaRecord[]> = {}
    const projetosPorEmpresa: Record<string, ProjetoRecord[]> = {}
    const contasPorEmpresa: Record<string, ContaRecord[]> = {}
    const contratosPorEmpresa: Record<string, ContratoRecord[]> = {}

    for (const p of parceiros) {
      propostasPorEmpresa[p.id] = []
      projetosPorEmpresa[p.id] = []
      contasPorEmpresa[p.id] = []
      contratosPorEmpresa[p.id] = []
    }

    // Mapear proposta -> empresa
    const empresaDaProposta: Record<string, string> = {}
    for (const prop of propostas) {
      if (prop.empresa) {
        empresaDaProposta[prop.id] = prop.empresa
        if (propostasPorEmpresa[prop.empresa]) {
          propostasPorEmpresa[prop.empresa].push(prop)
        }
      }
    }

    // Mapear projeto -> empresa através da proposta
    const empresaDoProjeto: Record<string, string> = {}
    for (const proj of projetos) {
      const empId = proj.proposta ? empresaDaProposta[proj.proposta] : null
      if (empId) {
        empresaDoProjeto[proj.id] = empId
        if (projetosPorEmpresa[empId]) {
          projetosPorEmpresa[empId].push(proj)
        }
      }
    }

    // Mapear contas a receber -> empresa
    for (const c of contas) {
      let empId: string | null = null
      if (c.proposta && empresaDaProposta[c.proposta]) {
        empId = empresaDaProposta[c.proposta]
      } else if (c.projeto && empresaDoProjeto[c.projeto]) {
        empId = empresaDoProjeto[c.projeto]
      }
      if (empId && contasPorEmpresa[empId]) {
        contasPorEmpresa[empId].push(c)
      }
    }

    // Mapear contratos
    for (const ct of contratos) {
      if (ct.empresa && contratosPorEmpresa[ct.empresa]) {
        contratosPorEmpresa[ct.empresa].push(ct)
      }
    }

    // 2. Calcular valores brutos por parceiro
    interface PreIndicador {
      parceiro: EmpresaRecord
      receitaAcumulada: number
      margemMedia: number
      ticketMedio: number
      prazoMedioPagamentoDias: number
      ultimaDemandaData: string | null
      diasSemDemanda: number
      isSemDemandaCritica: boolean
      totalPropostasEnviadas: number
      totalPropostasAceitas: number
      taxaConversao: number
      totalProjetos: number
      projetosPorAno: number
      contratosAtivosQtd: number
      contratosAtivosValor: number
      scoreDemanda: number
    }

    const preLista: PreIndicador[] = parceiros.map((emp) => {
      const empProps = propostasPorEmpresa[emp.id] || []
      const empProjs = projetosPorEmpresa[emp.id] || []
      const empContas = contasPorEmpresa[emp.id] || []
      const empContratos = contratosPorEmpresa[emp.id] || []

      // Receita acumulada das propostas aceitas OU contas pagas/realizadas
      const propostasAceitas = empProps.filter(
        (p) => p.status === 'aceita' || p.status === 'em_negociacao',
      )
      const totalReceitaPropostas = propostasAceitas.reduce(
        (acc, p) => acc + (Number(p.preco) || 0),
        0,
      )
      const totalContasReceber = empContas
        .filter((c) => c.status === 'paga' || c.status === 'realizada')
        .reduce((acc, c) => acc + (Number(c.valor) || 0), 0)

      // A receita acumulada é a maior entre propostas aceitas e contas já registradas (para robustez)
      const receitaAcumulada = Math.max(totalReceitaPropostas, totalContasReceber)

      // Margem média
      let somaMargens = 0
      let qtdMargens = 0
      for (const p of propostasAceitas) {
        if (p.margem != null && !isNaN(Number(p.margem))) {
          somaMargens += Number(p.margem)
          qtdMargens++
        }
      }
      const margemMedia = qtdMargens > 0 ? somaMargens / qtdMargens : 35.0

      // Ticket médio
      const ticketMedio =
        propostasAceitas.length > 0 ? receitaAcumulada / propostasAceitas.length : 0

      // Prazo médio de pagamento (das contas a receber)
      // Ex: padrão 28 a 30 dias se faturado, ou cálculo da diferença vencimento/created
      let somaDiasPagamento = 0
      let qtdContasPagas = 0
      for (const c of empContas) {
        if (c.status === 'paga' && c.vencimento && c.created) {
          const v = new Date(c.vencimento).getTime()
          const cr = new Date(c.created).getTime()
          const diff = Math.max(1, Math.round((v - cr) / (1000 * 3600 * 24)))
          somaDiasPagamento += diff
          qtdContasPagas++
        }
      }
      const prazoMedioPagamentoDias =
        qtdContasPagas > 0 ? Math.round(somaDiasPagamento / qtdContasPagas) : 30

      // Última demanda: data mais recente entre criação de propostas e projetos
      let ultimaData: Date | null = null
      for (const p of empProps) {
        const d = new Date(p.created || p.validade || '')
        if (!isNaN(d.getTime()) && (!ultimaData || d > ultimaData)) {
          ultimaData = d
        }
      }
      for (const pr of empProjs) {
        const d = new Date(pr.created || '')
        if (!isNaN(d.getTime()) && (!ultimaData || d > ultimaData)) {
          ultimaData = d
        }
      }

      let diasSemDemanda = 0
      if (ultimaData) {
        diasSemDemanda = Math.max(
          0,
          Math.floor((hoje.getTime() - ultimaData.getTime()) / (1000 * 3600 * 24)),
        )
      } else {
        // Se nunca teve demanda registrada, usar created da empresa
        const empCriada = new Date(emp.created || '')
        if (!isNaN(empCriada.getTime())) {
          diasSemDemanda = Math.max(
            0,
            Math.floor((hoje.getTime() - empCriada.getTime()) / (1000 * 3600 * 24)),
          )
        }
      }

      const isSemDemandaCritica = diasSemDemanda >= diasLimiteSemDemanda

      // Conversão
      const totalPropostasEnviadas = empProps.length
      const totalPropostasAceitas = propostasAceitas.length
      const taxaConversao =
        totalPropostasEnviadas > 0
          ? Math.round((totalPropostasAceitas / totalPropostasEnviadas) * 100)
          : 0

      // Projetos por ano
      const totalProjetos = empProjs.length
      const projetosPorAno = totalProjetos > 0 ? totalProjetos : propostasAceitas.length

      // Contratos ativos da empresa parceira
      const contratosAtivos = empContratos.filter((c) => {
        const s = (c.situacao || '').toLowerCase()
        return !s.includes('encerr') && !s.includes('cancel')
      })
      const contratosAtivosQtd = contratosAtivos.length
      const contratosAtivosValor = contratosAtivos.reduce(
        (acc, c) => acc + (Number(c.valor) || 0),
        0,
      )

      // Score de capacidade de demanda (A4)
      // 1. Contratos ativos (valor e quantidade) -> nota 0-100
      let notaContratos = 0
      if (contratosAtivosValor >= 5000000 || contratosAtivosQtd >= 2) notaContratos = 100
      else if (contratosAtivosValor >= 1000000 || contratosAtivosQtd >= 1) notaContratos = 75
      else if (contratosAtivosValor > 0) notaContratos = 50
      else notaContratos = 30

      // 2. Taxa de conversão -> nota 0-100
      let notaConversao = 0
      if (taxaConversao >= 80) notaConversao = 100
      else if (taxaConversao >= 50) notaConversao = 75
      else if (taxaConversao > 0) notaConversao = 50
      else notaConversao = 25

      // 3. Projetos por ano -> nota 0-100
      let notaProjetos = 0
      if (projetosPorAno >= 3) notaProjetos = 100
      else if (projetosPorAno === 2) notaProjetos = 80
      else if (projetosPorAno === 1) notaProjetos = 60
      else notaProjetos = 25

      const somaPesos =
        pesosScore.peso_contratos_valor +
          pesosScore.peso_taxa_conversao +
          pesosScore.peso_projetos_ano || 100

      const scoreDemanda = Math.round(
        (notaContratos * pesosScore.peso_contratos_valor +
          notaConversao * pesosScore.peso_taxa_conversao +
          notaProjetos * pesosScore.peso_projetos_ano) /
          somaPesos,
      )

      return {
        parceiro: emp,
        receitaAcumulada,
        margemMedia: Math.round(margemMedia * 10) / 10,
        ticketMedio: Math.round(ticketMedio),
        prazoMedioPagamentoDias,
        ultimaDemandaData: ultimaData ? ultimaData.toISOString() : null,
        diasSemDemanda,
        isSemDemandaCritica,
        totalPropostasEnviadas,
        totalPropostasAceitas,
        taxaConversao,
        totalProjetos,
        projetosPorAno,
        contratosAtivosQtd,
        contratosAtivosValor,
        scoreDemanda: Math.min(100, Math.max(0, scoreDemanda)),
      }
    })

    // 3. Ordenar do maior para o menor por receita acumulada para o PARETO DINÂMICO
    preLista.sort((a, b) => b.receitaAcumulada - a.receitaAcumulada)

    const receitaTotalGeral = preLista.reduce((acc, item) => acc + item.receitaAcumulada, 0)

    let acumuladoAtual = 0
    const resultados: IndicadoresParceiro[] = []

    for (let i = 0; i < preLista.length; i++) {
      const item = preLista[i]
      acumuladoAtual += item.receitaAcumulada

      const percAcumulado = receitaTotalGeral > 0 ? (acumuladoAtual / receitaTotalGeral) * 100 : 0

      let curvaDinamica: CurvaABC = 'C'

      if (modoCurva === 'manual') {
        // Usa a curva gravada na empresa ou fallback
        curvaDinamica = item.parceiro.curva || 'C'
      } else {
        // Curva ABC Dinâmica estilo Pareto (A3):
        // A = parceiros que acumulam até ~80% da receita (ou o 1º de maior receita se houver poucos)
        // B = os que levam de 80% a ~95%
        // C = o restante
        if (percAcumulado <= cortesPareto.corteA || i === 0) {
          curvaDinamica = 'A'
        } else if (percAcumulado <= cortesPareto.corteB) {
          curvaDinamica = 'B'
        } else {
          curvaDinamica = 'C'
        }
      }

      resultados.push({
        empresaId: item.parceiro.id,
        empresa: item.parceiro,
        receitaAcumulada: item.receitaAcumulada,
        margemMedia: item.margemMedia,
        ticketMedio: item.ticketMedio,
        prazoMedioPagamentoDias: item.prazoMedioPagamentoDias,
        ultimaDemandaData: item.ultimaDemandaData,
        diasSemDemanda: item.diasSemDemanda,
        isSemDemandaCritica: item.isSemDemandaCritica,
        totalPropostasEnviadas: item.totalPropostasEnviadas,
        totalPropostasAceitas: item.totalPropostasAceitas,
        taxaConversao: item.taxaConversao,
        totalProjetos: item.totalProjetos,
        projetosPorAno: item.projetosPorAno,
        contratosAtivosQtd: item.contratosAtivosQtd,
        contratosAtivosValor: item.contratosAtivosValor,
        scoreDemanda: item.scoreDemanda,
        curvaDinamica,
        percentualReceitaAcumulada: Math.round(percAcumulado * 10) / 10,
        ranking: i + 1,
      })
    }

    return resultados
  },
}
