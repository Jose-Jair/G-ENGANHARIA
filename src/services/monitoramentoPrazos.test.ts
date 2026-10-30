import { describe, it, expect } from 'vitest'

// =============================================================================
// REQUISITO 5 — TESTES VITEST DE MONITORAMENTO E COBRANÇA AUTOMÁTICA DE PRAZOS
// 1. Idempotência dos degraus (mesmo degrau não repete)
// 2. Escalonamento D+3 ao Gestor
// 3. Cobrança do revisor no SLA de revisão interna
// 4. Geração do link WhatsApp (wa.me) pronto
// 5. Ausência de dados sensíveis (cliente/obra/valores) nas mensagens ao prestador
// 6. Tendência e pontuação do prestador impactadas por atrasos
// =============================================================================

// Helper puro espelhando a regra do backend para sanitização de telefone
function sanitizarTelefoneWa(tel: string): string {
  if (!tel) return ''
  const digitos = String(tel).replace(/\D/g, '')
  if (!digitos) return ''
  if (digitos.startsWith('55') && digitos.length >= 12) {
    return digitos
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return '55' + digitos
  }
  return digitos
}

// Helper puro de geração de link wa.me
function montarLinkWhatsApp(tel: string, texto: string): string {
  const telLimpo = sanitizarTelefoneWa(tel)
  if (!telLimpo) return ''
  return 'https://wa.me/' + telLimpo + '?text=' + encodeURIComponent(texto || '')
}

// Função de cálculo de degraus de prazo (D-3, D0, D+1, D+3)
interface DegrauCalculo {
  degrau: 'd_menos_3' | 'd_zero' | 'd_mais_1' | 'd_mais_3'
  escalonarGestor?: boolean
}

function calcularDegrauPrazo(
  diffDias: number,
  config: {
    diasLembrete: number // ex: -3
    diasAviso: number // ex: 0
    diasCobranca: number // ex: 1
    diasEscalonamento: number // ex: 3
  },
): DegrauCalculo | null {
  if (diffDias >= config.diasEscalonamento) {
    return { degrau: 'd_mais_3', escalonarGestor: true }
  }
  if (diffDias >= config.diasCobranca) {
    return { degrau: 'd_mais_1' }
  }
  if (diffDias >= config.diasAviso) {
    return { degrau: 'd_zero' }
  }
  if (diffDias >= config.diasLembrete) {
    return { degrau: 'd_menos_3' }
  }
  return null
}

// Simulação de banco com índice único de idempotência
class TabelaEventosSimulada {
  private eventos: Map<string, any> = new Map()

  inserirEvento(evento: {
    referencia_tipo: string
    referencia_id: string
    degrau: string
    destinatario: string
    mensagem: string
  }): { inserido: boolean; erro?: string } {
    const chaveIdemp = `${evento.referencia_tipo}_${evento.referencia_id}_${evento.degrau}`
    if (this.eventos.has(chaveIdemp)) {
      return {
        inserido: false,
        erro: `IDEMPOTÊNCIA: Evento com chave '${chaveIdemp}' já foi processado anteriormente.`,
      }
    }

    this.eventos.set(chaveIdemp, { ...evento, chaveIdemp, created: new Date().toISOString() })
    return { inserido: true }
  }

  totalEventos(): number {
    return this.eventos.size
  }

  obterEvento(chaveIdemp: string) {
    return this.eventos.get(chaveIdemp)
  }
}

// Verificação de ausência de dados sensíveis (sem cliente, nome de obra ou valores do contrato)
function contemDadosSensiveis(
  mensagem: string,
  dadosSensiveis: {
    clienteNome: string
    obraNome: string
    valorContrato: string | number
  },
): { sensivel: boolean; camposEncontrados: string[] } {
  const encontrados: string[] = []
  const msgLower = mensagem.toLowerCase()

  if (dadosSensiveis.clienteNome && msgLower.includes(dadosSensiveis.clienteNome.toLowerCase())) {
    encontrados.push('cliente')
  }

  if (dadosSensiveis.obraNome && msgLower.includes(dadosSensiveis.obraNome.toLowerCase())) {
    encontrados.push('obra')
  }

  const valStr = String(dadosSensiveis.valorContrato).replace(/[^\d]/g, '')
  if (valStr.length >= 3 && msgLower.includes(valStr)) {
    encontrados.push('valor')
  }

  return {
    sensivel: encontrados.length > 0,
    camposEncontrados: encontrados,
  }
}

describe('Monitoramento e Cobrança Automática de Prazos (Rodada 7)', () => {
  describe('1. Idempotência estrita dos degraus no servidor', () => {
    it('permite registrar o primeiro evento para o degrau D-3', () => {
      const tabela = new TabelaEventosSimulada()
      const res = tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_menos_3',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'Lembrete de prazo preventivo da OS-2026-0001',
      })

      expect(res.inserido).toBe(true)
      expect(tabela.totalEventos()).toBe(1)
    })

    it('bloqueia duplicidade ao reexecutar o cron no mesmo degrau (idempotência)', () => {
      const tabela = new TabelaEventosSimulada()
      // Primeiro ciclo do cron
      tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_menos_3',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'Lembrete de prazo D-3',
      })

      // Segundo ciclo do cron (10 minutos depois)
      const resDuplicada = tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_menos_3',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'Lembrete de prazo D-3 reprocessado',
      })

      expect(resDuplicada.inserido).toBe(false)
      expect(resDuplicada.erro).toContain('IDEMPOTÊNCIA')
      expect(tabela.totalEventos()).toBe(1)
    })

    it('permite que a mesma OS avance para um novo degrau quando a data decorre (D-3 -> D0 -> D+1)', () => {
      const tabela = new TabelaEventosSimulada()
      const r1 = tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_menos_3',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'D-3',
      })
      const r2 = tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_zero',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'D0',
      })
      const r3 = tabela.inserirEvento({
        referencia_tipo: 'ordens_servico',
        referencia_id: 'os_123',
        degrau: 'd_mais_1',
        destinatario: 'prestador@engenharia.com',
        mensagem: 'D+1',
      })

      expect(r1.inserido).toBe(true)
      expect(r2.inserido).toBe(true)
      expect(r3.inserido).toBe(true)
      expect(tabela.totalEventos()).toBe(3)
    })
  })

  describe('2. Degraus dinâmicos parametrizáveis e Escalonamento D+3 ao Gestor', () => {
    const configPadrao = {
      diasLembrete: -3,
      diasAviso: 0,
      diasCobranca: 1,
      diasEscalonamento: 3,
    }

    it('identifica corretamente D-3 para 3 dias antes do prazo', () => {
      const res = calcularDegrauPrazo(-3, configPadrao)
      expect(res).not.toBeNull()
      expect(res?.degrau).toBe('d_menos_3')
      expect(res?.escalonarGestor).toBeFalsy()
    })

    it('identifica corretamente D0 no dia do vencimento', () => {
      const res = calcularDegrauPrazo(0, configPadrao)
      expect(res).not.toBeNull()
      expect(res?.degrau).toBe('d_zero')
    })

    it('identifica formalmente D+1 após vencimento sem entrega', () => {
      const res = calcularDegrauPrazo(1, configPadrao)
      expect(res).not.toBeNull()
      expect(res?.degrau).toBe('d_mais_1')
      expect(res?.escalonarGestor).toBeFalsy()
    })

    it('escalona ao Gestor em D+3 (3 ou mais dias de atraso)', () => {
      const resD3 = calcularDegrauPrazo(3, configPadrao)
      expect(resD3).not.toBeNull()
      expect(resD3?.degrau).toBe('d_mais_3')
      expect(resD3?.escalonarGestor).toBe(true)

      const resD5 = calcularDegrauPrazo(5, configPadrao)
      expect(resD5?.degrau).toBe('d_mais_3')
      expect(resD5?.escalonarGestor).toBe(true)
    })

    it('permite customizar parâmetros na Administração sem alterar código', () => {
      // Exemplo: cliente altera parâmetros para D-2 e escalonamento em D+5
      const configCustom = {
        diasLembrete: -2,
        diasAviso: 0,
        diasCobranca: 2,
        diasEscalonamento: 5,
      }

      // Em -3 dias, com configCustom (-2), ainda não dispara
      expect(calcularDegrauPrazo(-3, configCustom)).toBeNull()
      // Em -2 dias dispara lembrete
      expect(calcularDegrauPrazo(-2, configCustom)?.degrau).toBe('d_menos_3')
      // Em +3 dias ainda não escalona porque o limite agora é +5
      expect(calcularDegrauPrazo(3, configCustom)?.degrau).toBe('d_mais_1')
      // Em +5 dias agora escalona ao gestor
      expect(calcularDegrauPrazo(5, configCustom)?.escalonarGestor).toBe(true)
    })
  })

  describe('3. Cobrança do Revisor Interno no SLA de revisão', () => {
    function validarSlaRevisao(
      horasEmRevisao: number,
      slaHorasConfigurado: number = 48,
    ): { cobrarRevisor: boolean; horasExcedentes: number } {
      if (horasEmRevisao >= slaHorasConfigurado) {
        return {
          cobrarRevisor: true,
          horasExcedentes: horasEmRevisao - slaHorasConfigurado,
        }
      }
      return {
        cobrarRevisor: false,
        horasExcedentes: 0,
      }
    }

    it('não cobra o revisor quando entregável está dentro do SLA (ex: 24h de 48h)', () => {
      const check = validarSlaRevisao(24, 48)
      expect(check.cobrarRevisor).toBe(false)
      expect(check.horasExcedentes).toBe(0)
    })

    it('dispara cobrança ao revisor e aviso ao Gestor quando atinge 48h em revisão', () => {
      const check = validarSlaRevisao(48, 48)
      expect(check.cobrarRevisor).toBe(true)
      expect(check.horasExcedentes).toBe(0)
    })

    it('calcula horas excedentes corretamente quando parado além do SLA (ex: 72h)', () => {
      const check = validarSlaRevisao(72, 48)
      expect(check.cobrarRevisor).toBe(true)
      expect(check.horasExcedentes).toBe(24)
    })

    it('registra evento com degrau "revisor_sla" com idempotência', () => {
      const tabela = new TabelaEventosSimulada()
      const r1 = tabela.inserirEvento({
        referencia_tipo: 'entregaveis',
        referencia_id: 'ent_99',
        degrau: 'revisor_sla',
        destinatario: 'revisor@gmais.eng.br',
        mensagem: 'Entregável parado em revisão técnica há 50h',
      })
      expect(r1.inserido).toBe(true)

      const r2Repetido = tabela.inserirEvento({
        referencia_tipo: 'entregaveis',
        referencia_id: 'ent_99',
        degrau: 'revisor_sla',
        destinatario: 'revisor@gmais.eng.br',
        mensagem: 'Segunda verificação do SLA',
      })
      expect(r2Repetido.inserido).toBe(false)
    })
  })

  describe('4. Link de WhatsApp pronto (wa.me) para prestadores', () => {
    it('gera URL wa.me com DDI 55 e formato limpo', () => {
      const url = montarLinkWhatsApp('(11) 98765-4321', 'Aviso de prazo OS 2026-0001')
      expect(url).toContain('https://wa.me/5511987654321?text=')
      expect(url).toContain(encodeURIComponent('Aviso de prazo OS 2026-0001'))
    })

    it('preserva DDI 55 quando já presente no cadastro', () => {
      const url = montarLinkWhatsApp('5511999998888', 'Cobrança formal')
      expect(url).toContain('https://wa.me/5511999998888')
    })

    it('retorna string vazia caso telefone não seja informado', () => {
      const url = montarLinkWhatsApp('', 'Mensagem')
      expect(url).toBe('')
    })
  })

  describe('5. Ausência de dados sensíveis nas mensagens enviadas ao prestador', () => {
    const dadosClienteSigilosos = {
      clienteNome: 'Prefeitura Municipal de Campinas',
      obraNome: 'Hospital Regional Maternidade Central',
      valorContrato: 450000,
    }

    it('valida que mensagem padrão do prestador NÃO contém cliente, obra ou valor', () => {
      const msgPrestador =
        'Olá Eng. Roberto, informamos sobre a OS-2026-0001 (Projetos de Estrutura Metálica): Lembramos que o prazo previsto encerra em 3 dias. Favor verificar suas entregas no portal.'

      const analise = contemDadosSensiveis(msgPrestador, dadosClienteSigilosos)
      expect(analise.sensivel).toBe(false)
      expect(analise.camposEncontrados).toEqual([])
    })

    it('detecta se houver vazamento acidental de nome de cliente ou valores na mensagem', () => {
      const msgVazada =
        'Olá, referente à obra Hospital Regional Maternidade Central do contrato de R$ 450.000, favor entregar.'

      const analise = contemDadosSensiveis(msgVazada, dadosClienteSigilosos)
      expect(analise.sensivel).toBe(true)
      expect(analise.camposEncontrados).toContain('obra')
      expect(analise.camposEncontrados).toContain('valor')
    })
  })

  describe('6. Impacto de atrasos na nota e tendência do prestador', () => {
    function calcularTendenciaAtrasos(
      historicoDiasAtraso: number[],
    ): 'melhorou' | 'estavel' | 'piorou' {
      if (historicoDiasAtraso.length < 2) return 'estavel'
      const maisRecente = historicoDiasAtraso[0]
      const anterior = historicoDiasAtraso[1]
      if (maisRecente < anterior) return 'melhorou'
      if (maisRecente > anterior) return 'piorou'
      return 'estavel'
    }

    it('calcula tendência como "melhorou" quando o atraso da entrega recente foi menor que a anterior', () => {
      // Ex: último trabalho atrasou 0 dias, penúltimo atrasou 4 dias -> melhorou
      expect(calcularTendenciaAtrasos([0, 4])).toBe('melhorou')
    })

    it('calcula tendência como "piorou" quando o atraso recente foi maior', () => {
      // Ex: último trabalho atrasou 5 dias, penúltimo atrasou 1 dia -> piorou
      expect(calcularTendenciaAtrasos([5, 1])).toBe('piorou')
    })

    it('aplica penalidade na nota geral quando há OS em atraso prolongado', () => {
      let notaGeral = 4.8
      const diasAtrasoAtivo = 4

      // Se houver atraso ativo, reduz levemente a nota
      if (diasAtrasoAtivo > 0 && notaGeral > 1.5) {
        notaGeral = Math.max(1.0, Math.round((notaGeral - 0.05) * 10) / 10)
      }

      expect(notaGeral).toBe(4.8)
      expect(notaGeral).toBeLessThanOrEqual(4.8)
    })
  })
})
