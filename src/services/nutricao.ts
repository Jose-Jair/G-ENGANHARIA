import pb from '@/lib/pocketbase/client'
import { EmpresaRecord, ToqueRecord, NaoContatarRecord } from '@/types'

export interface SugestaoNutricaoCarencia {
  empresa: EmpresaRecord
  toque5: ToqueRecord
  diasDecorridosToque5: number
  carenciaLimiteDias: number
  sugeridaParaNutricao: boolean
}

export interface ContagemDestinatariosNutricao {
  curvaA: number
  curvaB: number
  curvaC: number
  total: number
  detalhes: {
    totalEmNutricao: number
    semEmailValido: number
    bloqueadasNaoContatar: number
    elegiveisA: number
    elegiveisB: number
    elegiveisC: number
  }
}

export const nutricaoService = {
  // Calcular quais empresas na cadência atingiram Toque 5 + carência sem resposta (calculado ao abrir o sistema sem cron)
  calcularEmpresasCarenciaToque5(
    empresas: EmpresaRecord[],
    toques: ToqueRecord[],
    carenciaDias: number = 15,
  ): SugestaoNutricaoCarencia[] {
    const hoje = new Date()
    const sugestoes: SugestaoNutricaoCarencia[] = []

    // Indexar toques por empresa
    const toquesPorEmpresa = new Map<string, ToqueRecord[]>()
    for (const t of toques) {
      if (!toquesPorEmpresa.has(t.empresa)) {
        toquesPorEmpresa.set(t.empresa, [])
      }
      toquesPorEmpresa.get(t.empresa)!.push(t)
    }

    for (const emp of empresas) {
      if (emp.status !== 'ativa' || emp.etapa_funil !== 'em_cadencia') {
        continue
      }

      const lista = toquesPorEmpresa.get(emp.id) || []
      const toque5 = lista.find((t) => t.numero_toque === 5)
      if (!toque5 || !toque5.data_prevista) continue

      // Se o toque 5 não foi respondido e não foi cancelado
      if (toque5.status === 'respondido' || toque5.status === 'cancelado') {
        continue
      }

      // Verificar dias decorridos desde a data prevista do Toque 5
      const dataPrev5 = new Date(toque5.data_prevista)
      const diffMs = hoje.getTime() - dataPrev5.getTime()
      const diasDecorridos = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diasDecorridos >= carenciaDias) {
        sugestoes.push({
          empresa: emp,
          toque5,
          diasDecorridosToque5: diasDecorridos,
          carenciaLimiteDias: carenciaDias,
          sugeridaParaNutricao: true,
        })
      }
    }

    return sugestoes
  },

  // Mover empresa da cadência para Nutrição Mensal com 1 clique (auditado)
  async moverParaNutricao(
    empresaId: string,
    motivo: string = 'Toque 5 sem resposta após período de carência regulamentar',
  ): Promise<EmpresaRecord> {
    return (await pb.collection('empresas').update(empresaId, {
      etapa_funil: 'nutricao_mensal',
      etapa_anterior: 'em_cadencia',
      proxima_acao_data: '',
      proxima_acao_desc: `Encaminhada para Nutrição Mensal: ${motivo}`,
      observacoes: `[Nutrição Mensal]: ${motivo} em ${new Date().toLocaleDateString('pt-BR')}`,
    })) as EmpresaRecord
  },

  // Contagem em tempo real de destinatários por curva A/B/C/todas
  // (empresas em 'nutricao_mensal', ativas, com e-mail válido, fora da lista não-contatar)
  calcularContagemDestinatarios(
    empresas: EmpresaRecord[],
    bloqueadosNaoContatar: NaoContatarRecord[],
  ): ContagemDestinatariosNutricao {
    const emailsBloqueados = new Set<string>()
    const empresasBloqueadas = new Set<string>()

    for (const b of bloqueadosNaoContatar) {
      if (b.email) emailsBloqueados.add(b.email.toLowerCase().trim())
      if (b.empresa) empresasBloqueadas.add(b.empresa)
    }

    let totalEmNutricao = 0
    let semEmailValido = 0
    let bloqueadasNaoContatar = 0
    let elegiveisA = 0
    let elegiveisB = 0
    let elegiveisC = 0

    for (const emp of empresas) {
      if (emp.status !== 'ativa' || emp.etapa_funil !== 'nutricao_mensal') {
        continue
      }
      totalEmNutricao++

      const email = (emp.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        semEmailValido++
        continue
      }

      if (empresasBloqueadas.has(emp.id) || emailsBloqueados.has(email)) {
        bloqueadasNaoContatar++
        continue
      }

      const curva = emp.curva || 'C'
      if (curva === 'A') elegiveisA++
      else if (curva === 'B') elegiveisB++
      else elegiveisC++
    }

    return {
      curvaA: elegiveisA,
      curvaB: elegiveisB,
      curvaC: elegiveisC,
      total: elegiveisA + elegiveisB + elegiveisC,
      detalhes: {
        totalEmNutricao,
        semEmailValido,
        bloqueadasNaoContatar,
        elegiveisA,
        elegiveisB,
        elegiveisC,
      },
    }
  },
}
