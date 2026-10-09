import pb from '@/lib/pocketbase/client'
import {
  ContaRecord,
  StatusConta,
  ProjetoRecord,
  ExecutorRecord,
  ProjetoEtapaRecord,
  DocumentoRecord,
} from '@/types'

export interface CreateContaManualData {
  tipo: 'receber' | 'pagar'
  projeto?: string
  proposta?: string
  executor?: string
  etapa?: string
  descricao: string
  valor: number
  retencao_impostos?: number
  valor_liquido?: number
  vencimento?: string
  forma_pagamento?: string
  nf?: string
  medicao_aprovada_origem?: string
  status?: StatusConta
}

export interface BaixarContaData {
  data_pagamento: string
  forma_pagamento?: string
  comprovante: File
}

export interface ResumoFinanceiro {
  saldoReceber: number
  saldoPagar: number
  saldoLiquidoProjetado: number
  atrasadosReceberValor: number
  atrasadosReceberQtd: number
  atrasadosPagarValor: number
  atrasadosPagarQtd: number
  projecao30Dias: { receber: number; pagar: number; saldo: number }
  projecao60Dias: { receber: number; pagar: number; saldo: number }
  projecao90Dias: { receber: number; pagar: number; saldo: number }
}

export interface MesFluxoCaixa {
  mesChave: string // '2026-10'
  rotulo: string // 'Out/2026'
  entradasRealizadas: number
  entradasPrevistas: number
  totalEntradas: number
  saidasRealizadas: number
  saidasPrevistas: number
  totalSaidas: number
  saldoMes: number
  saldoAcumulado: number
  alertaNegativo: boolean
}

export const financeiroService = {
  /**
   * Lista todas as contas com expand dos relacionamentos
   */
  async listAll(): Promise<ContaRecord[]> {
    const list = await pb.collection('contas').getFullList<ContaRecord>({
      sort: 'vencimento',
      expand: 'projeto,proposta,executor,etapa',
    })
    return this.normalizarContasAtrasadas(list)
  },

  /**
   * Normaliza contas que venceram e não foram pagas para o status 'atrasada' em tempo de execução
   * (Sem necessidade de CRON)
   */
  normalizarContasAtrasadas(contas: ContaRecord[]): ContaRecord[] {
    const hojeStr = new Date().toISOString().substring(0, 10)
    return contas.map((c) => {
      if (
        c.vencimento &&
        c.status !== 'paga' &&
        c.status !== 'realizada' &&
        c.status !== 'cancelada'
      ) {
        const vencStr = c.vencimento.substring(0, 10)
        if (vencStr < hojeStr) {
          return { ...c, status: 'atrasada' }
        }
      }
      return c
    })
  },

  /**
   * Criação de conta manual (a pagar ou receber)
   */
  async createManual(data: CreateContaManualData): Promise<ContaRecord> {
    const payload: any = {
      tipo: data.tipo,
      descricao: data.descricao,
      valor: data.valor,
      status: data.status || 'rascunho',
      forma_pagamento: data.forma_pagamento,
      nf: data.nf,
      vencimento: data.vencimento ? `${data.vencimento} 12:00:00.000Z` : undefined,
      bloqueada_por_fechamento: false,
    }

    if (data.projeto) payload.projeto = data.projeto
    if (data.proposta) payload.proposta = data.proposta
    if (data.executor) payload.executor = data.executor
    if (data.etapa) payload.etapa = data.etapa
    if (data.retencao_impostos !== undefined) payload.retencao_impostos = data.retencao_impostos
    if (data.valor_liquido !== undefined) {
      payload.valor_liquido = data.valor_liquido
    } else if (data.retencao_impostos) {
      payload.valor_liquido = Math.max(0, data.valor - data.retencao_impostos)
    } else {
      payload.valor_liquido = data.valor
    }
    if (data.medicao_aprovada_origem) payload.medicao_aprovada_origem = data.medicao_aprovada_origem

    return await pb.collection('contas').create<ContaRecord>(payload)
  },

  /**
   * Gerar conta a pagar a partir de medição aprovada de executor
   */
  async gerarContaPorMedicao(params: {
    projetoId: string
    etapaId?: string
    executorId: string
    medicaoDocumentoId: string
    numeroMedicao: string
    valorMedicao: number
    percentualRetencao?: number
    vencimento?: string
  }): Promise<ContaRecord> {
    const percRet = params.percentualRetencao ?? 11.5
    const retencao = parseFloat(((params.valorMedicao * percRet) / 100).toFixed(2))
    const liquido = Math.max(0, parseFloat((params.valorMedicao - retencao).toFixed(2)))

    const venc = params.vencimento
      ? `${params.vencimento} 12:00:00.000Z`
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) +
        ' 12:00:00.000Z'

    const payload: any = {
      tipo: 'pagar',
      projeto: params.projetoId,
      etapa: params.etapaId || undefined,
      executor: params.executorId,
      descricao: `Subcontratação - Medição ${params.numeroMedicao}`,
      valor: params.valorMedicao,
      retencao_impostos: retencao,
      valor_liquido: liquido,
      vencimento: venc,
      status: 'rascunho',
      forma_pagamento: 'Transferência Bancária (PIX)',
      medicao_aprovada_origem: params.numeroMedicao,
      bloqueada_por_fechamento: false,
    }

    return await pb.collection('contas').create<ContaRecord>(payload)
  },

  /**
   * Aprovação de conta em rascunho (Admin ou Financeiro)
   */
  async aprovarConta(id: string): Promise<ContaRecord> {
    return await pb.collection('contas').update<ContaRecord>(id, {
      status: 'aprovada',
    })
  },

  /**
   * Envio de cobrança / emissão de remessa (para contas a receber aprovadas)
   */
  async enviarCobranca(id: string, nf?: string): Promise<ContaRecord> {
    const payload: any = { status: 'enviada' }
    if (nf) payload.nf = nf
    return await pb.collection('contas').update<ContaRecord>(id, payload)
  },

  /**
   * Baixa da conta por liquidação/pagamento com upload de comprovante obrigatório
   */
  async baixarConta(id: string, data: BaixarContaData): Promise<ContaRecord> {
    const formData = new FormData()
    formData.append('status', 'paga')
    formData.append('data_pagamento', `${data.data_pagamento} 12:00:00.000Z`)
    if (data.forma_pagamento) {
      formData.append('forma_pagamento', data.forma_pagamento)
    }
    formData.append('anexo_comprovante', data.comprovante)

    return await pb.collection('contas').update<ContaRecord>(id, formData)
  },

  /**
   * Cancelamento de conta com justificativa/motivo obrigatório
   */
  async cancelarConta(id: string, motivo: string): Promise<ContaRecord> {
    if (!motivo || !motivo.trim()) {
      throw new Error('Informe o motivo do cancelamento da conta.')
    }
    return await pb.collection('contas').update<ContaRecord>(id, {
      status: 'cancelada',
      motivo_cancelamento: motivo.trim(),
    })
  },

  /**
   * Atualização genérica de conta
   */
  async updateConta(id: string, data: Partial<ContaRecord>): Promise<ContaRecord> {
    return await pb.collection('contas').update<ContaRecord>(id, data)
  },

  /**
   * Exclusão (Admin)
   */
  async deleteConta(id: string): Promise<boolean> {
    return await pb.collection('contas').delete(id)
  },

  /**
   * Busca medições aprovadas existentes para vincular a contas a pagar
   */
  async listMedicoesAprovadas(): Promise<DocumentoRecord[]> {
    return await pb.collection('documentos').getFullList<DocumentoRecord>({
      filter: "tipo = 'medicao'",
      sort: '-created',
      expand: 'projeto,etapa',
    })
  },

  /**
   * Calcula indicadores e projeções financeiras a partir das contas
   */
  calcularResumoFinanceiro(contas: ContaRecord[]): ResumoFinanceiro {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTimestamp = hoje.getTime()

    const d30 = hojeTimestamp + 30 * 24 * 60 * 60 * 1000
    const d60 = hojeTimestamp + 60 * 24 * 60 * 60 * 1000
    const d90 = hojeTimestamp + 90 * 24 * 60 * 60 * 1000

    let saldoReceber = 0
    let saldoPagar = 0
    let atrasadosReceberValor = 0
    let atrasadosReceberQtd = 0
    let atrasadosPagarValor = 0
    let atrasadosPagarQtd = 0

    const p30 = { receber: 0, pagar: 0, saldo: 0 }
    const p60 = { receber: 0, pagar: 0, saldo: 0 }
    const p90 = { receber: 0, pagar: 0, saldo: 0 }

    for (const c of contas) {
      if (c.status === 'cancelada') continue

      const isLiquidada = c.status === 'paga' || c.status === 'realizada'
      const valor = c.valor || 0
      const vencTime = c.vencimento ? new Date(c.vencimento).getTime() : 0

      if (c.tipo === 'receber') {
        if (!isLiquidada) {
          saldoReceber += valor
          if (c.status === 'atrasada' || (vencTime && vencTime < hojeTimestamp)) {
            atrasadosReceberValor += valor
            atrasadosReceberQtd++
          } else if (vencTime) {
            if (vencTime <= d30) p30.receber += valor
            if (vencTime <= d60) p60.receber += valor
            if (vencTime <= d90) p90.receber += valor
          }
        }
      } else {
        // tipo === 'pagar'
        if (!isLiquidada) {
          saldoPagar += valor
          if (c.status === 'atrasada' || (vencTime && vencTime < hojeTimestamp)) {
            atrasadosPagarValor += valor
            atrasadosPagarQtd++
          } else if (vencTime) {
            if (vencTime <= d30) p30.pagar += valor
            if (vencTime <= d60) p60.pagar += valor
            if (vencTime <= d90) p90.pagar += valor
          }
        }
      }
    }

    p30.saldo = p30.receber - p30.pagar
    p60.saldo = p60.receber - p60.pagar
    p90.saldo = p90.receber - p90.pagar

    return {
      saldoReceber,
      saldoPagar,
      saldoLiquidoProjetado: saldoReceber - saldoPagar,
      atrasadosReceberValor,
      atrasadosReceberQtd,
      atrasadosPagarValor,
      atrasadosPagarQtd,
      projecao30Dias: p30,
      projecao60Dias: p60,
      projecao90Dias: p90,
    }
  },

  /**
   * Consolidação do Fluxo de Caixa Mensal (12 meses a partir do mês atual)
   */
  calcularFluxoCaixa12Meses(contas: ContaRecord[]): MesFluxoCaixa[] {
    const mesesNomes = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]
    const resultado: MesFluxoCaixa[] = []

    const agora = new Date()
    const anoInicial = agora.getFullYear()
    const mesInicial = agora.getMonth() // 0-11

    // Gerar 12 meses
    for (let i = 0; i < 12; i++) {
      const d = new Date(anoInicial, mesInicial + i, 1)
      const ano = d.getFullYear()
      const mes = d.getMonth()
      const mesStr = (mes + 1).toString().padStart(2, '0')
      const chave = `${ano}-${mesStr}`
      const rotulo = `${mesesNomes[mes]}/${ano}`

      resultado.push({
        mesChave: chave,
        rotulo,
        entradasRealizadas: 0,
        entradasPrevistas: 0,
        totalEntradas: 0,
        saidasRealizadas: 0,
        saidasPrevistas: 0,
        totalSaidas: 0,
        saldoMes: 0,
        saldoAcumulado: 0,
        alertaNegativo: false,
      })
    }

    const mapMeses: Record<string, MesFluxoCaixa> = {}
    for (const m of resultado) {
      mapMeses[m.mesChave] = m
    }

    // Distribuir as contas nos meses
    for (const c of contas) {
      if (c.status === 'cancelada') continue
      const isLiquidada = c.status === 'paga' || c.status === 'realizada'
      const dataRef = isLiquidada && c.data_pagamento ? c.data_pagamento : c.vencimento
      if (!dataRef) continue

      const chave = dataRef.substring(0, 7)
      const mesObj = mapMeses[chave]
      if (!mesObj) continue

      const valor = c.valor || 0
      if (c.tipo === 'receber') {
        if (isLiquidada) {
          mesObj.entradasRealizadas += valor
        } else {
          mesObj.entradasPrevistas += valor
        }
      } else {
        // pagar
        if (isLiquidada) {
          mesObj.saidasRealizadas += valor
        } else {
          mesObj.saidasPrevistas += valor
        }
      }
    }

    // Totalizar e calcular saldo acumulado
    let acumulado = 0
    for (const m of resultado) {
      m.totalEntradas = m.entradasRealizadas + m.entradasPrevistas
      m.totalSaidas = m.saidasRealizadas + m.saidasPrevistas
      m.saldoMes = m.totalEntradas - m.totalSaidas
      acumulado += m.saldoMes
      m.saldoAcumulado = acumulado
      m.alertaNegativo = m.saldoAcumulado < 0 || m.saldoMes < 0
    }

    return resultado
  },

  /**
   * Cálculo de alertas D-7 e D-1 de contas a pagar e receber (ao abrir, para o sininho e tela)
   */
  calcularAlertasVencimento(contas: ContaRecord[]): {
    d1Contas: ContaRecord[]
    d7Contas: ContaRecord[]
    atrasadas: ContaRecord[]
    totalAlertas: number
  } {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTime = hoje.getTime()

    const d1Contas: ContaRecord[] = []
    const d7Contas: ContaRecord[] = []
    const atrasadas: ContaRecord[] = []

    for (const c of contas) {
      if (c.status === 'paga' || c.status === 'realizada' || c.status === 'cancelada') continue
      if (!c.vencimento) continue

      const vencDate = new Date(c.vencimento)
      vencDate.setHours(0, 0, 0, 0)
      const vencTime = vencDate.getTime()

      const diffDias = Math.round((vencTime - hojeTime) / (1000 * 60 * 60 * 24))

      if (diffDias < 0) {
        atrasadas.push(c)
      } else if (diffDias <= 1) {
        d1Contas.push(c)
      } else if (diffDias <= 7) {
        d7Contas.push(c)
      }
    }

    return {
      d1Contas,
      d7Contas,
      atrasadas,
      totalAlertas: d1Contas.length + d7Contas.length + atrasadas.length,
    }
  },

  /**
   * Contagem leve de contas vencidas não liquidadas (endpoint dedicado do servidor) — badge do sininho
   */
  async getCountAtraso(): Promise<{ receber: number; pagar: number; total: number }> {
    const res = await pb.send<{ receber: number; pagar: number; total: number }>(
      '/backend/v1/financeiro/count-atraso',
      { method: 'GET' },
    )
    return res
  },

  /**
   * Contagem de atrasos históricos de um parceiro/empresa (para exibir na ficha do parceiro)
   */
  contarAtrasosHistoricosParceiro(empresaId: string, contas: ContaRecord[]): number {
    let count = 0
    for (const c of contas) {
      if (c.tipo !== 'receber') continue
      // Verificar se conta está ligada à proposta ou projeto da empresa
      const empId = (c.expand?.proposta as any)?.empresa || (c.expand?.projeto as any)?.empresa

      if (empId === empresaId) {
        if (c.status === 'atrasada') {
          count++
        } else if (
          (c.status === 'paga' || c.status === 'realizada') &&
          c.vencimento &&
          c.data_pagamento
        ) {
          const vStr = c.vencimento.substring(0, 10)
          const pStr = c.data_pagamento.substring(0, 10)
          if (pStr > vStr) {
            count++
          }
        }
      }
    }
    return count
  },

  /**
   * Obtém os dados consolidados da Visão Gerencial do Financeiro calculados no servidor
   * Endpoint dedicado: GET /backend/v1/financeiro/visao-gerencial?horizonte=3|6|12
   */
  async getVisaoGerencial(
    horizonte: 3 | 6 | 12 = 12,
  ): Promise<import('@/types').VisaoGerencialDados> {
    const res = await pb.send<import('@/types').VisaoGerencialDados>(
      `/backend/v1/financeiro/visao-gerencial?horizonte=${horizonte}`,
      { method: 'GET' },
    )
    return res
  },

  /**
   * Contagem de contas atrasadas (para atualizar badge do sininho em tempo real)
   */
  async getCountContasAtrasadas(): Promise<number> {
    try {
      const res = await this.getVisaoGerencial(3)
      return res.bloco3_alertas_atraso.totalAtrasadosCount || 0
    } catch {
      return 0
    }
  },
}
