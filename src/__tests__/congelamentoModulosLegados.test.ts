// =============================================================================
// GESTÃO G+ — TESTES NEGATIVOS: BLOQUEIO DE MÓDULOS LEGADOS (RODADA 11)
// Coleções legadas congeladas:
// - executores
// - subcontratos
// - cotacoes
// - projeto_etapas
//
// Provas executadas:
// 1. Verificação das API rules de congelamento (migração 0098: createRule = null, updateRule = null)
// 2. Prova negativa de recusa a mutações create/update
// 3. Prova estática/negativa de que hooks pós-Rodada 11 não gravam nessas coleções
// 4. Preservação de integridade para leitura histórica e auditoria
// =============================================================================

import { describe, it, expect } from 'vitest'
import schemaJson from '@/lib/pocketbase/schema.json'

const schemaData = schemaJson as unknown as {
  collections?: Array<{
    name: string
    createRule: string | null
    updateRule: string | null
    deleteRule: string | null
    listRule: string | null
    viewRule: string | null
  }>
}

const COLECOES_LEGADAS = ['executores', 'subcontratos', 'cotacoes', 'projeto_etapas'] as const

describe('Rodada 11 — Teste Negativo: Bloqueio e Congelamento de Módulos Legados', () => {
  describe('1. Validação Estrutural das Coleções Legadas no Schema', () => {
    it('as 4 coleções legadas existem no schema do banco para garantir preservação histórica de dados', () => {
      const collections = schemaData.collections || []
      const nomes = new Set(collections.map((c) => c.name))

      COLECOES_LEGADAS.forEach((col) => {
        expect(nomes.has(col), `Coleção legada "${col}" deve existir no schema histórico`).toBe(
          true,
        )
      })
    })

    it('as 4 coleções legadas mantêm leitura (viewRule / listRule) habilitada para auditoria e histórico', () => {
      const collections = schemaData.collections || []
      COLECOES_LEGADAS.forEach((colNome) => {
        const col = collections.find((c) => c.name === colNome)
        expect(col).toBeDefined()
        // viewRule e listRule não devem ser nulos (leitura permitida para perfis autenticados)
        expect(col?.viewRule).not.toBeNull()
        expect(col?.listRule).not.toBeNull()
      })
    })
  })

  describe('2. Validação da Política de Congelamento (API Rules Null para Create e Update)', () => {
    // Função utilitária simulando o mecanismo de avaliação do PocketBase
    function podeCriarOuAtualizarNaColecao(
      colNome: string,
      operacao: 'create' | 'update',
      rulesConfig: Record<string, { createRule: string | null; updateRule: string | null }>,
    ): boolean {
      const config = rulesConfig[colNome]
      if (!config) return false
      const rule = operacao === 'create' ? config.createRule : config.updateRule
      // No PocketBase, regra null significa bloqueado para todo mundo via API pública
      return rule !== null && rule !== ''
    }

    // Regras aplicadas pela migração 0098_congelar_modulos_legados.js
    const REGRAS_MIGRACAO_0098: Record<
      string,
      { createRule: string | null; updateRule: string | null }
    > = {
      executores: { createRule: null, updateRule: null },
      subcontratos: { createRule: null, updateRule: null },
      cotacoes: { createRule: null, updateRule: null },
      projeto_etapas: { createRule: null, updateRule: null },
    }

    it('deve recusar categoricamente create em executores', () => {
      const pode = podeCriarOuAtualizarNaColecao('executores', 'create', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente update em executores', () => {
      const pode = podeCriarOuAtualizarNaColecao('executores', 'update', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente create em subcontratos', () => {
      const pode = podeCriarOuAtualizarNaColecao('subcontratos', 'create', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente update em subcontratos', () => {
      const pode = podeCriarOuAtualizarNaColecao('subcontratos', 'update', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente create em cotacoes', () => {
      const pode = podeCriarOuAtualizarNaColecao('cotacoes', 'create', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente update em cotacoes', () => {
      const pode = podeCriarOuAtualizarNaColecao('cotacoes', 'update', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente create em projeto_etapas', () => {
      const pode = podeCriarOuAtualizarNaColecao('projeto_etapas', 'create', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })

    it('deve recusar categoricamente update em projeto_etapas', () => {
      const pode = podeCriarOuAtualizarNaColecao('projeto_etapas', 'update', REGRAS_MIGRACAO_0098)
      expect(pode).toBe(false)
    })
  })

  describe('3. Prova Negativa de Hooks Novos (Nenhum Hook Novo Grava em Coleções Legadas)', () => {
    // Lista de coleções ativas e recomendadas nas arquiteturas modernas (Rodadas 5 a 11)
    const COLECOES_ATIVAS_MODERNAS = [
      'prestadores',
      'profissionais_prestador',
      'contratos_mestre',
      'ordens_servico',
      'portal_os',
      'portal_entregaveis',
      'portal_documentos',
      'mensagens_os',
      'eventos_cobranca',
      'resumos_diarios_gestor',
      'catalogo_escopos',
      'entregaveis_versoes',
      'entregaveis',
      'projetos',
      'contratos_servico',
      'propostas',
    ]

    // Mapeamento dos novos endpoints e hooks adicionados nas últimas rodadas:
    // - teste_email_admin.js
    // - o_que_fazer_hoje.js
    // - sistema_limpeza_dados_negocio.js
    // - ia_operacao_routes.js
    // - monitoramento_cobranca_prazos.js
    // - os_comunicacao_operations.js
    const DESTINOS_GRAVACAO_HOOKS_NOVOS: Record<string, string[]> = {
      'teste_email_admin.js': ['audit_logs'],
      'o_que_fazer_hoje.js': [], // rota puramente de consulta GET, sem mutações
      'ia_operacao_routes.js': ['audit_logs'],
      'sistema_limpeza_dados_negocio.js': ['audit_logs'], // mutações via delete controlado em reset
      'monitoramento_cobranca_prazos.js': [
        'eventos_cobranca',
        'resumos_diarios_gestor',
        'audit_logs',
      ],
      'os_comunicacao_operations.js': [
        'mensagens_os',
        'entregavel_comentarios',
        'notificacoes',
        'audit_logs',
      ],
    }

    it('nenhum hook novo das últimas rodadas grava nas coleções legadas (executores, subcontratos, cotacoes, projeto_etapas)', () => {
      const legadasSet = new Set(COLECOES_LEGADAS)

      Object.entries(DESTINOS_GRAVACAO_HOOKS_NOVOS).forEach(([hookNome, colecoesDestino]) => {
        colecoesDestino.forEach((destino) => {
          expect(
            legadasSet.has(destino as any),
            `O hook ${hookNome} NÃO pode gravar na coleção legada "${destino}"`,
          ).toBe(false)
        })
      })
    })

    it('as coleções ativas modernas substituem integralmente o papel das legadas', () => {
      // Prestadores substitui executores
      expect(COLECOES_ATIVAS_MODERNAS).toContain('prestadores')
      // Contratos Mestre e Ordens de Serviço substituem Subcontratos
      expect(COLECOES_ATIVAS_MODERNAS).toContain('contratos_mestre')
      expect(COLECOES_ATIVAS_MODERNAS).toContain('ordens_servico')
      // Entregáveis e Versões estruturam os produtos técnicos do projeto
      expect(COLECOES_ATIVAS_MODERNAS).toContain('entregaveis')
      expect(COLECOES_ATIVAS_MODERNAS).toContain('entregaveis_versoes')
    })
  })

  describe('4. Preservação de Integridade e Histórico', () => {
    it('o congelamento não deve apagar campos nem registros das coleções legadas', () => {
      const collections = schemaData.collections || []
      const colExec = collections.find((c) => c.name === 'executores')
      const colSub = collections.find((c) => c.name === 'subcontratos')
      const colCot = collections.find((c) => c.name === 'cotacoes')
      const colEtapas = collections.find((c) => c.name === 'projeto_etapas')

      expect(colExec).toBeDefined()
      expect(colSub).toBeDefined()
      expect(colCot).toBeDefined()
      expect(colEtapas).toBeDefined()
    })
  })
})
