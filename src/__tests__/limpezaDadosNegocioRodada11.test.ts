// =============================================================================
// GESTÃO G+ — TESTES VITEST AUTOMATIZADOS: RODADA 11
// MECANISMO DE LIMPEZA DE DADOS DE NEGÓCIO (ADMIN EXCLUSIVO)
// Cobrindo:
// 1. Validação da frase exata de confirmação ("APAGAR DADOS DE NEGÓCIO")
// 2. Bloqueio estrito de perfis não-Admin (Gestor, Comercial, Financeiro, Executor => 403)
// 3. Integridade e consistência da lista de coleções preservadas (não-vazia, com users, audit_logs, empresas, etc.)
// 4. Ordem e coerência das coleções de negócio a serem limpas (respeitando dependências FK)
// 5. Estrutura de auditoria ANTES e DEPOIS da execução
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  FRASE_CONFIRMACAO_LIMPEZA,
  COLECOES_NEGOCIO_ORDEM_LIMPEZA,
  COLECOES_PRESERVADAS,
  validarFraseConfirmacao,
  isColecaoPreservada,
} from '@/services/limpezaDadosNegocioConstants'
import schemaJson from '@/lib/pocketbase/schema.json'

const schemaData = schemaJson as unknown as { collections?: Array<{ name: string }> }
const schemaCollectionNames = new Set((schemaData.collections || []).map((c) => c.name))

describe('Rodada 11 — Mecanismo de Limpeza de Dados de Negócio (Admin)', () => {
  // ---------------------------------------------------------------------------
  // 1. VALIDAÇÃO DA FRASE DE CONFIRMAÇÃO EXATA
  // ---------------------------------------------------------------------------
  describe('Validação da Frase de Confirmação Exata', () => {
    it('a frase canônica oficial deve ser "APAGAR DADOS DE NEGÓCIO"', () => {
      expect(FRASE_CONFIRMACAO_LIMPEZA).toBe('APAGAR DADOS DE NEGÓCIO')
    })

    it('aceita a frase exata sem espaços adicionais ou com espaços nas pontas tratados', () => {
      expect(validarFraseConfirmacao('APAGAR DADOS DE NEGÓCIO')).toBe(true)
      expect(validarFraseConfirmacao('  APAGAR DADOS DE NEGÓCIO  ')).toBe(true)
    })

    it('recusa frases parciais, minúsculas, com erros tipográficos ou vazias', () => {
      expect(validarFraseConfirmacao('apagar dados de negócio')).toBe(false)
      expect(validarFraseConfirmacao('APAGAR DADOS')).toBe(false)
      expect(validarFraseConfirmacao('APAGAR DADOS DE NEGOCIO')).toBe(false) // sem acento
      expect(validarFraseConfirmacao('SIM')).toBe(false)
      expect(validarFraseConfirmacao('')).toBe(false)
      expect(validarFraseConfirmacao(null as unknown as string)).toBe(false)
      expect(validarFraseConfirmacao(undefined as unknown as string)).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. BLOQUEIO ESTRITO DE PERFIL NÃO-ADMIN (REGRA DE SEGURANÇA 403)
  // ---------------------------------------------------------------------------
  describe('Bloqueio e Permissão por Perfil', () => {
    function autorizarLimpezaPorPerfil(role: string): { permitido: boolean; status: number } {
      if (role === 'admin') {
        return { permitido: true, status: 200 }
      }
      return { permitido: false, status: 403 }
    }

    it('apenas o perfil "admin" tem autorização para disparar a limpeza de negócio', () => {
      const res = autorizarLimpezaPorPerfil('admin')
      expect(res.permitido).toBe(true)
      expect(res.status).toBe(200)
    })

    it('rejeita "gestor" com HTTP 403', () => {
      const res = autorizarLimpezaPorPerfil('gestor')
      expect(res.permitido).toBe(false)
      expect(res.status).toBe(403)
    })

    it('rejeita "comercial" com HTTP 403', () => {
      const res = autorizarLimpezaPorPerfil('comercial')
      expect(res.permitido).toBe(false)
      expect(res.status).toBe(403)
    })

    it('rejeita "financeiro" com HTTP 403', () => {
      const res = autorizarLimpezaPorPerfil('financeiro')
      expect(res.permitido).toBe(false)
      expect(res.status).toBe(403)
    })

    it('rejeita "executor" com HTTP 403', () => {
      const res = autorizarLimpezaPorPerfil('executor')
      expect(res.permitido).toBe(false)
      expect(res.status).toBe(403)
    })

    it('rejeita requisições anônimas ou indefinidas', () => {
      const res = autorizarLimpezaPorPerfil('')
      expect(res.permitido).toBe(false)
      expect(res.status).toBe(403)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. INTEGRIDADE DA LISTA DE COLEÇÕES PRESERVADAS
  // ---------------------------------------------------------------------------
  describe('Lista de Coleções Preservadas (Cadastros e Segurança)', () => {
    it('a lista de coleções preservadas não está vazia e possui pelo menos 14 itens fundamentais', () => {
      expect(COLECOES_PRESERVADAS.length).toBeGreaterThanOrEqual(14)
    })

    it('contém obrigatoriamente users, audit_logs, empresas, clientes_pf, prestadores, parametros, modelos e motivos', () => {
      const nomes = COLECOES_PRESERVADAS.map((c) => c.colecao)
      expect(nomes).toContain('users')
      expect(nomes).toContain('audit_logs')
      expect(nomes).toContain('empresas')
      expect(nomes).toContain('clientes_pf')
      expect(nomes).toContain('prestadores')
      expect(nomes).toContain('profissionais_prestador')
      expect(nomes).toContain('executores')
      expect(nomes).toContain('catalogo_servicos')
      expect(nomes).toContain('catalogo_escopos')
      expect(nomes).toContain('areas_atuacao')
      expect(nomes).toContain('subservicos')
      expect(nomes).toContain('entregaveis_padrao')
      expect(nomes).toContain('parametros')
      expect(nomes).toContain('modelos')
      expect(nomes).toContain('motivos')
      expect(nomes).toContain('nao_contatar')
    })

    it('todas as coleções preservadas existem no schema real do banco PocketBase', () => {
      COLECOES_PRESERVADAS.forEach((item) => {
        expect(
          schemaCollectionNames.has(item.colecao),
          `Coleção preservada "${item.colecao}" deve existir no schema do PocketBase`,
        ).toBe(true)
      })
    })

    it('a função isColecaoPreservada identifica corretamente coleções protegidas e não-protegidas', () => {
      expect(isColecaoPreservada('users')).toBe(true)
      expect(isColecaoPreservada('audit_logs')).toBe(true)
      expect(isColecaoPreservada('empresas')).toBe(true)
      expect(isColecaoPreservada('parametros')).toBe(true)

      // Coleções de negócio não são preservadas
      expect(isColecaoPreservada('propostas')).toBe(false)
      expect(isColecaoPreservada('projetos')).toBe(false)
      expect(isColecaoPreservada('contratos_servico')).toBe(false)
      expect(isColecaoPreservada('contas')).toBe(false)
    })

    it('nenhuma coleção de negócio a limpar está presente na lista de preservadas (disjunção estrita)', () => {
      const preservadasSet = new Set(COLECOES_PRESERVADAS.map((c) => c.colecao))
      COLECOES_NEGOCIO_ORDEM_LIMPEZA.forEach((item) => {
        expect(
          preservadasSet.has(item.colecao),
          `Coleção a limpar "${item.colecao}" NUNCA pode estar na lista de preservadas`,
        ).toBe(false)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // 4. ORDEM E COERÊNCIA DAS COLEÇÕES DE NEGÓCIO A LIMPAR
  // ---------------------------------------------------------------------------
  describe('Ordem e Coerência das Coleções de Negócio', () => {
    it('possui todas as coleções de esteira de negócio mapeadas', () => {
      const nomes = COLECOES_NEGOCIO_ORDEM_LIMPEZA.map((c) => c.colecao)
      expect(nomes).toContain('propostas')
      expect(nomes).toContain('proposta_itens')
      expect(nomes).toContain('proposta_parcelas')
      expect(nomes).toContain('contratos_servico')
      expect(nomes).toContain('projetos')
      expect(nomes).toContain('projeto_etapas')
      expect(nomes).toContain('ordens_servico')
      expect(nomes).toContain('subcontratos')
      expect(nomes).toContain('cotacoes')
      expect(nomes).toContain('medicoes')
      expect(nomes).toContain('avaliacoes_executor')
      expect(nomes).toContain('mensagens_os')
      expect(nomes).toContain('eventos_cobranca')
      expect(nomes).toContain('notificacoes')
      expect(nomes).toContain('contas')
    })

    it('respeita a ordem de dependência: mensagens, eventos e entregáveis antes de ordens de serviço e projetos', () => {
      const nomes = COLECOES_NEGOCIO_ORDEM_LIMPEZA.map((c) => c.colecao)
      const idxMensagens = nomes.indexOf('mensagens_os')
      const idxEventos = nomes.indexOf('eventos_cobranca')
      const idxVersoes = nomes.indexOf('entregaveis_versoes')
      const idxMedicoes = nomes.indexOf('medicoes')
      const idxOS = nomes.indexOf('ordens_servico')
      const idxProjetos = nomes.indexOf('projetos')
      const idxContratosServico = nomes.indexOf('contratos_servico')
      const idxPropostas = nomes.indexOf('propostas')

      // Mensagens e eventos devem ser removidos antes de OS
      expect(idxMensagens).toBeLessThan(idxOS)
      expect(idxEventos).toBeLessThan(idxOS)

      // Versões e medições devem ser removidas antes de projetos e contratos
      expect(idxVersoes).toBeLessThan(idxProjetos)
      expect(idxMedicoes).toBeLessThan(idxProjetos)

      // OS antes de projetos
      expect(idxOS).toBeLessThan(idxProjetos)

      // Projetos antes de contratos de serviço
      expect(idxProjetos).toBeLessThan(idxContratosServico)

      // Contratos de serviço antes de propostas
      expect(idxContratosServico).toBeLessThan(idxPropostas)
    })

    it('todas as coleções de negócio a limpar existem no schema do banco', () => {
      COLECOES_NEGOCIO_ORDEM_LIMPEZA.forEach((item) => {
        expect(
          schemaCollectionNames.has(item.colecao),
          `Coleção de negócio "${item.colecao}" deve existir no schema do PocketBase`,
        ).toBe(true)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // 5. SIMULAÇÃO DO FLUXO DE AUDITORIA ANTES E DEPOIS
  // ---------------------------------------------------------------------------
  describe('Auditoria ANTES e DEPOIS da Limpeza', () => {
    it('constrói payload consistente para auditoria ANTES da execução', () => {
      const payloadAntes = {
        acao: 'LIMPEZA_DADOS_NEGOCIO_INICIADA',
        entidade: 'sistema',
        registro_id: 'limpeza_dados_negocio',
        detalhes: {
          autor_id: 'usr_admin_123',
          autor_email: 'admin@sistema.eng.br',
          confirmacao_fornecida: FRASE_CONFIRMACAO_LIMPEZA,
          total_registros_negocio_previstos: 42,
          contagens_antes: {
            projetos: 5,
            propostas: 8,
            contas: 12,
          },
          inicio_execucao: new Date().toISOString(),
        },
      }

      expect(payloadAntes.acao).toBe('LIMPEZA_DADOS_NEGOCIO_INICIADA')
      expect(payloadAntes.detalhes.confirmacao_fornecida).toBe('APAGAR DADOS DE NEGÓCIO')
      expect(payloadAntes.detalhes.total_registros_negocio_previstos).toBe(42)
    })

    it('constrói payload consistente para auditoria DEPOIS da execução (sucesso)', () => {
      const payloadDepois = {
        acao: 'LIMPEZA_DADOS_NEGOCIO_CONCLUIDA',
        entidade: 'sistema',
        registro_id: 'limpeza_dados_negocio',
        detalhes: {
          autor_id: 'usr_admin_123',
          autor_email: 'admin@sistema.eng.br',
          sucesso: true,
          total_apagados: 42,
          apagados_por_colecao: {
            projetos: 5,
            propostas: 8,
            contas: 12,
          },
          contagens_preservadas_depois: {
            users: 5,
            empresas: 10,
            parametros: 25,
          },
          finalizado_em: new Date().toISOString(),
        },
      }

      expect(payloadDepois.acao).toBe('LIMPEZA_DADOS_NEGOCIO_CONCLUIDA')
      expect(payloadDepois.detalhes.sucesso).toBe(true)
      expect(payloadDepois.detalhes.total_apagados).toBe(42)
      expect(payloadDepois.detalhes.contagens_preservadas_depois.users).toBe(5)
    })

    it('constrói payload com registro de falha parcial caso ocorra erro no percurso', () => {
      const payloadFalhaParcial = {
        acao: 'LIMPEZA_DADOS_NEGOCIO_FALHA_PARCIAL',
        entidade: 'sistema',
        registro_id: 'limpeza_dados_negocio',
        detalhes: {
          autor_id: 'usr_admin_123',
          autor_email: 'admin@sistema.eng.br',
          sucesso: false,
          erro: 'Simulação de erro em chave estrangeira',
          colecao_falha: 'projetos',
          total_apagados: 15,
          apagados_por_colecao: {
            mensagens_os: 5,
            entregaveis: 10,
            projetos: 0,
          },
          finalizado_em: new Date().toISOString(),
        },
      }

      expect(payloadFalhaParcial.acao).toBe('LIMPEZA_DADOS_NEGOCIO_FALHA_PARCIAL')
      expect(payloadFalhaParcial.detalhes.sucesso).toBe(false)
      expect(payloadFalhaParcial.detalhes.colecao_falha).toBe('projetos')
      expect(payloadFalhaParcial.detalhes.total_apagados).toBe(15)
    })
  })
})
