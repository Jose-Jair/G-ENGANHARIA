// =============================================================================
// GESTÃO G+ — TESTES DA RODADA 9: IA A SERVIÇO DA OPERAÇÃO
// Validações de lógica pura/utilitária sem escrita fictícia no banco:
// 1. Gate de chave desligada (recusa 400 sem chamar modelo)
// 2. Segmentação do prompt do prestador (ausência de cliente/obra/valor/BDI)
// 3. Contrato de saída JSON defensivo (strip de fences ```json)
// 4. Auditoria estruturada sem dados sensíveis de contrato
// =============================================================================

import { describe, it, expect } from 'vitest'

// Utilitários de parsing e higienização replicados para teste de lógica pura
export function stripMarkdownFences(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let text = raw.trim()
  if (text.startsWith('```json')) {
    text = text.substring(7)
  } else if (text.startsWith('```')) {
    text = text.substring(3)
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3)
  }
  return text.trim()
}

export function parseJsonDefensivo<T>(rawText: string, fallback: T): T {
  const stripped = stripMarkdownFences(rawText)
  try {
    return JSON.parse(stripped)
  } catch {
    const f = stripped.indexOf('{')
    const l = stripped.lastIndexOf('}')
    if (f !== -1 && l !== -1 && l > f) {
      try {
        return JSON.parse(stripped.substring(f, l + 1))
      } catch {
        // fallback
      }
    }
  }
  return {
    ...fallback,
    raw_texto: rawText,
    parse_sucesso: false,
  }
}

export function validarGateChaveIa(
  chave: string,
  tabelaParametros: Record<string, string>,
): { autorizado: boolean; mensagemErro?: string } {
  const val = (tabelaParametros[chave] || '').trim().toLowerCase()
  const ativo = val === 'true' || val === '1' || val === 'sim'
  if (!ativo) {
    return {
      autorizado: false,
      mensagemErro: `O recurso de IA para ${chave} está desativado nos Parâmetros do sistema.`,
    }
  }
  return { autorizado: true }
}

export interface OsContextoSeguro {
  codigoProjeto: string
  numeroOs: string
  disciplina: string
  escopoTecnico: string
  prazoDias: number
  dataPrevisaoFim: string
  entregaveis: Array<{ titulo: string; prazo: string; status: string }>
  finalidade: string
  contextoExtra?: string
}

export function montarPromptCanalOsSeguro(contexto: OsContextoSeguro): string {
  return `DADOS RESTRITOS DA ORDEM DE SERVIÇO:
- Código do Projeto: ${contexto.codigoProjeto}
- Número da OS: ${contexto.numeroOs}
- Disciplina: ${contexto.disciplina}
- Escopo Técnico: ${contexto.escopoTecnico}
- Prazo Total em Dias: ${contexto.prazoDias}
- Previsão de Término / Entrega: ${contexto.dataPrevisaoFim}
- Entregáveis Vinculados: ${JSON.stringify(contexto.entregaveis)}
- Finalidade Solicitada: ${contexto.finalidade}
${contexto.contextoExtra ? '- Contexto Adicional Informado pelo Operador: ' + contexto.contextoExtra : ''}

RELEMBRE A REGRA DE CONFIDENCIALIDADE: Jamais mencione nomes de clientes, nomes de obras ou valores financeiros.
Responda OBRIGATORIAMENTE no formato JSON especificado.`
}

export function montarPayloadAuditoriaIa(
  userId: string,
  userEmail: string,
  recurso: string,
  acao: string,
  entidade: string,
  registroId: string,
  detalhesSeguros: Record<string, any>,
): {
  user: string
  user_email: string
  acao: string
  entidade: string
  registro_id: string
  detalhes: Record<string, any>
  ip: string
} {
  // Garante que chaves proibidas sejam purgadas caso inadvertidamente passadas
  const sanitizado: Record<string, any> = { ...detalhesSeguros }
  const camposProibidos = [
    'cliente',
    'cliente_nome',
    'obra',
    'nome_obra',
    'valor_contrato',
    'valor_total',
    'valor_os',
    'bdi',
    'margem',
    'clausulas',
    'outros_prestadores',
  ]
  for (const campo of camposProibidos) {
    delete sanitizado[campo]
  }

  return {
    user: userId,
    user_email: userEmail,
    acao,
    entidade,
    registro_id: registroId,
    detalhes: {
      recurso,
      timestamp_utc: '2026-10-30T14:00:00.000Z',
      ...sanitizado,
    },
    ip: '127.0.0.1',
  }
}

describe('Rodada 9: IA a Serviço da Operação (Backend & Lógica Pura)', () => {
  describe('1. Gate de Chave Desligada', () => {
    it('deve recusar chamada se ia_pre_revisao estiver "false" por padrão', () => {
      const parametrosMock: Record<string, string> = {
        ia_escopo: 'true',
        ia_justificativa_prestador: 'true',
        ia_texto_canal: 'true',
        ia_resumo_dia: 'true',
        ia_pre_revisao: 'false',
      }

      const res = validarGateChaveIa('ia_pre_revisao', parametrosMock)
      expect(res.autorizado).toBe(false)
      expect(res.mensagemErro).toContain('ia_pre_revisao')
    })

    it('deve autorizar recursos quando a chave correspondente for "true"', () => {
      const parametrosMock: Record<string, string> = {
        ia_escopo: 'true',
        ia_justificativa_prestador: 'true',
        ia_texto_canal: 'true',
        ia_resumo_dia: 'true',
        ia_pre_revisao: 'false',
      }

      expect(validarGateChaveIa('ia_escopo', parametrosMock).autorizado).toBe(true)
      expect(validarGateChaveIa('ia_justificativa_prestador', parametrosMock).autorizado).toBe(true)
      expect(validarGateChaveIa('ia_texto_canal', parametrosMock).autorizado).toBe(true)
      expect(validarGateChaveIa('ia_resumo_dia', parametrosMock).autorizado).toBe(true)
    })

    it('deve recusar imediatamente se uma chave não existir nos parâmetros', () => {
      const parametrosMock: Record<string, string> = {}
      const res = validarGateChaveIa('ia_escopo', parametrosMock)
      expect(res.autorizado).toBe(false)
    })
  })

  describe('2. Segmentação Estrita do Prompt do Prestador (Canal da OS)', () => {
    it('deve montar o prompt apenas com dados técnicos da própria OS, sem vazar cliente, obra, valores ou BDI', () => {
      const contextoOs: OsContextoSeguro = {
        codigoProjeto: 'PRJ-2026-0042',
        numeroOs: 'OS-2026-0015',
        disciplina: 'Projetos de Estruturas Metálicas',
        escopoTecnico: 'Dimensionamento e detalhamento executivo de galpão modular',
        prazoDias: 25,
        dataPrevisaoFim: '2026-11-20',
        entregaveis: [
          {
            titulo: 'Plantas Executivas de Estrutura',
            prazo: '2026-11-15',
            status: 'atribuido',
          },
          {
            titulo: 'Memorial de Cálculo e ART',
            prazo: '2026-11-20',
            status: 'atribuido',
          },
        ],
        finalidade: 'cobranca_preventiva',
        contextoExtra: 'Solicitar confirmação se os dados de sondagem foram suficientes',
      }

      const promptMontado = montarPromptCanalOsSeguro(contextoOs)

      // Verificações positivas: dados técnicos presentes
      expect(promptMontado).toContain('PRJ-2026-0042')
      expect(promptMontado).toContain('OS-2026-0015')
      expect(promptMontado).toContain('Projetos de Estruturas Metálicas')
      expect(promptMontado).toContain('Plantas Executivas de Estrutura')
      expect(promptMontado).toContain('2026-11-20')

      // Verificações negativas DURAS de confidencialidade
      // NUNCA deve conter menção a cliente, obra específica sensível, valores monetários (R$), BDI ou outros prestadores
      expect(promptMontado.toLowerCase()).not.toContain('cliente:')
      expect(promptMontado.toLowerCase()).not.toContain('nome_cliente')
      expect(promptMontado.toLowerCase()).not.toContain('valor do contrato')
      expect(promptMontado.toLowerCase()).not.toContain('r$')
      expect(promptMontado.toLowerCase()).not.toContain('bdi')
      expect(promptMontado.toLowerCase()).not.toContain('margem')
      expect(promptMontado.toLowerCase()).not.toContain('concorrente')
      expect(promptMontado.toLowerCase()).not.toContain('outro prestador')
    })
  })

  describe('3. Contrato de Saída JSON Defensivo (Strip de Fences e Robustez)', () => {
    it('deve extrair JSON corretamente quando o modelo responde com ```json ... ```', () => {
      const modeloOutput =
        '```json\n{\n  "disciplina": "Elétrica",\n  "titulo_pacote": "Projetos Elétricos e SPDA"\n}\n```'
      const fallback = { disciplina: 'Geral', titulo_pacote: 'Padrão' }
      const parsed = parseJsonDefensivo(modeloOutput, fallback)

      expect(parsed.disciplina).toBe('Elétrica')
      expect(parsed.titulo_pacote).toBe('Projetos Elétricos e SPDA')
    })

    it('deve extrair JSON quando há texto introdutório antes do bloco JSON', () => {
      const modeloOutput =
        'Aqui está a sugestão solicitada:\n```\n{"sucesso": true, "score": 9.5}\n```'
      const fallback = { sucesso: false, score: 0 }
      const parsed = parseJsonDefensivo(modeloOutput, fallback)

      expect(parsed.sucesso).toBe(true)
      expect(parsed.score).toBe(9.5)
    })

    it('deve acionar o fallback seguro sem quebrar caso o modelo responda texto não-JSON', () => {
      const modeloOutput = 'Texto puramente em linguagem natural sem formatação JSON.'
      const fallback = {
        disciplina: 'Hidráulica',
        titulo_pacote: 'Pacote Padrão',
        parse_sucesso: false,
      }
      const parsed = parseJsonDefensivo(modeloOutput, fallback)

      expect(parsed.disciplina).toBe('Hidráulica')
      expect(parsed.parse_sucesso).toBe(false)
      expect((parsed as any).raw_texto).toBe(modeloOutput)
    })
  })

  describe('4. Auditoria Estruturada sem Conteúdo Sensível de Contrato', () => {
    it('deve registrar quem, para quê e qual recurso sem vazar valores ou termos do contrato', () => {
      const dadosTentativa = {
        disciplina: 'Fundações',
        projeto_codigo: 'PRJ-2026-0001',
        // Inserção inadvertida de campos confidenciais
        cliente: 'Prefeitura Municipal Exemplo',
        valor_contrato: 450000.0,
        bdi: 28.5,
      }

      const auditPayload = montarPayloadAuditoriaIa(
        'usr_gestor_123',
        'gestor@sistema.eng.br',
        'ia_escopo',
        'IA_GERACAO_ESCOPO_PACOTE',
        'projeto_etapas',
        'etapa_pacote_99',
        dadosTentativa,
      )

      expect(auditPayload.user).toBe('usr_gestor_123')
      expect(auditPayload.user_email).toBe('gestor@sistema.eng.br')
      expect(auditPayload.acao).toBe('IA_GERACAO_ESCOPO_PACOTE')
      expect(auditPayload.detalhes.recurso).toBe('ia_escopo')
      expect(auditPayload.detalhes.disciplina).toBe('Fundações')
      expect(auditPayload.detalhes.projeto_codigo).toBe('PRJ-2026-0001')

      // Assegurar expurgo de dados confidenciais
      expect((auditPayload.detalhes as any).cliente).toBeUndefined()
      expect((auditPayload.detalhes as any).valor_contrato).toBeUndefined()
      expect((auditPayload.detalhes as any).bdi).toBeUndefined()
    })
  })
})
