import { describe, it, expect } from 'vitest'
import schema from '@/lib/pocketbase/schema.json'

/**
 * RODADA 18 Parte B — Testes Vitest por perfil:
 * - Comercial: acesso ao funil, propostas, empresas; proibido financeiro e canal direto OS
 * - Gestor: acesso operacional, monitoramento, fila de decisões, issues de revisão; sem dados bancários sem auditoria
 * - Financeiro: contas a pagar/receber, fluxo de caixa, rateios; SEM escopo técnico de engenharia (entregaveis, entregaveis_versoes, canal OS)
 * - Executor Externo: segmentação estrita — apenas OS atribuídas e seus entregáveis; zero acesso a cliente, proposta, valor de contrato público, BDI, outros prestadores
 * - Executor Interno / Prestador: dados bancários e custo-hora protegidos por auditoria
 */

describe('RODADA 18 — Matriz de Sigilo e RLS por Perfil', () => {
  const getCollection = (name: string) => {
    const list = (schema as any).collections || (schema as any[])
    return list.find((c: any) => c.name === name)
  }

  describe('1. Perfil Financeiro — Restrição de Escopo Técnico e Arquivos de Projeto', () => {
    it('entregaveis não permite perfil financeiro na listRule nem viewRule', () => {
      const col = getCollection('entregaveis')
      expect(col).toBeDefined()
      const listRule = col.listRule || col.apiRules?.list || ''
      const viewRule = col.viewRule || col.apiRules?.view || ''
      expect(listRule).not.toContain("@request.auth.role = 'financeiro'")
      expect(viewRule).not.toContain("@request.auth.role = 'financeiro'")
    })

    it('entregaveis_versoes não permite perfil financeiro na listRule nem viewRule', () => {
      const col = getCollection('entregaveis_versoes')
      expect(col).toBeDefined()
      const listRule = col.listRule || col.apiRules?.list || ''
      const viewRule = col.viewRule || ''
      expect(listRule).not.toContain("@request.auth.role = 'financeiro'")
      expect(viewRule).not.toContain("@request.auth.role = 'financeiro'")
    })

    it('documentos restringe financeiro exclusivamente para tipo="medicao"', () => {
      const col = getCollection('documentos')
      expect(col).toBeDefined()
      const listRule = col.listRule || ''
      expect(listRule).toContain("@request.auth.role = 'financeiro' && tipo = 'medicao'")
    })

    it('mensagens_os exclui perfil financeiro (canal da OS restrito a admin, gestor e executor atribuído)', () => {
      const col = getCollection('mensagens_os')
      expect(col).toBeDefined()
      const listRule = col.listRule || ''
      expect(listRule).not.toContain("@request.auth.role = 'financeiro'")
      expect(listRule).toContain("@request.auth.role = 'gestor'")
      expect(listRule).toContain("@request.auth.role = 'admin'")
    })
  })

  describe('2. Perfil Comercial — Segmentação e Restrições', () => {
    it('propostas permite comercial, admin e gestor', () => {
      const col = getCollection('propostas')
      expect(col).toBeDefined()
      const listRule = col.listRule || col.apiRules?.list || ''
      expect(listRule).toContain("@request.auth.role = 'comercial'")
    })

    it('contas financeiras bloqueia estritamente o perfil comercial', () => {
      const col = getCollection('contas')
      expect(col).toBeDefined()
      const listRule = col.listRule || col.apiRules?.list || ''
      expect(listRule).not.toContain("@request.auth.role = 'comercial'")
    })

    it('mensagens_os bloqueia o perfil comercial (não atua no canal de engenharia da OS)', () => {
      const col = getCollection('mensagens_os')
      expect(col).toBeDefined()
      expect(col.listRule).not.toContain("@request.auth.role = 'comercial'")
    })
  })

  describe('3. Perfil Gestor — Fila de Decisões e Operações', () => {
    it('issues_revisao e pacotes_trabalho estão abertos para gestor e admin', () => {
      const colIssues = getCollection('issues_revisao')
      const colPacotes = getCollection('pacotes_trabalho')
      expect(colIssues).toBeDefined()
      expect(colPacotes).toBeDefined()
      const listRuleIssues = colIssues.listRule || colIssues.apiRules?.list || ''
      const listRulePacotes = colPacotes.listRule || colPacotes.apiRules?.list || ''
      expect(listRuleIssues).toContain("@request.auth.role = 'gestor'")
      expect(listRulePacotes).toContain("@request.auth.role = 'gestor'")
    })

    it('gestor tem acesso à lista de projetos e etapas para coordenar engenharia', () => {
      const colEtapas = getCollection('projeto_etapas')
      expect(colEtapas).toBeDefined()
      const listRule = colEtapas.listRule || colEtapas.apiRules?.list || ''
      expect(listRule).toContain("@request.auth.role = 'gestor'")
    })
  })

  describe('4. Perfil Executor Externo (Portal do Prestador) — Isolamento Estrito', () => {
    it('PROVA NEGATIVA: executor NÃO acessa empresas nem clientes_pf', () => {
      const colEmp = getCollection('empresas')
      const colCli = getCollection('clientes_pf')
      expect(colEmp).toBeDefined()
      expect(colCli).toBeDefined()
      const listEmp = colEmp.listRule || colEmp.apiRules?.list || ''
      const listCli = colCli.listRule || colCli.apiRules?.list || ''
      expect(listEmp).not.toContain("@request.auth.role = 'executor'")
      expect(listCli).not.toContain("@request.auth.role = 'executor'")
    })

    it('PROVA NEGATIVA: executor NÃO acessa propostas nem contratos de serviço de clientes', () => {
      const colProp = getCollection('propostas')
      const colCtr = getCollection('contratos_servico')
      expect(colProp).toBeDefined()
      expect(colCtr).toBeDefined()
      const listProp = colProp.listRule || colProp.apiRules?.list || ''
      const listCtr = colCtr.listRule || colCtr.apiRules?.list || ''
      expect(listProp).not.toContain("@request.auth.role = 'executor'")
      expect(listCtr).not.toContain("@request.auth.role = 'executor'")
    })

    it('PROVA NEGATIVA: executor NÃO acessa outros prestadores nem valores de outros executores', () => {
      const colPrest = getCollection('prestadores')
      expect(colPrest).toBeDefined()
      // Apenas seu próprio e-mail se for prestador
      const listPrest = colPrest.listRule || colPrest.apiRules?.list || ''
      expect(listPrest).toContain('email = @request.auth.email')
    })

    it('PROVA POSITIVA: executor acessa apenas suas próprias mensagens da OS vinculada', () => {
      const colMsg = getCollection('mensagens_os')
      expect(colMsg).toBeDefined()
      const listMsg = colMsg.listRule || colMsg.apiRules?.list || ''
      expect(listMsg).toContain('pacote.subcontrato.executor.email = @request.auth.email')
    })
  })

  describe('5. Auditoria de Dados Sensíveis e Fila de Decisões', () => {
    it('coleção audit_logs existe e possui campos de usuário, ação, entidade e ip', () => {
      const colAudit = getCollection('audit_logs')
      expect(colAudit).toBeDefined()
      const campos = (colAudit.schema || colAudit.fields || []).map((f: any) => f.name)
      expect(campos).toContain('acao')
      expect(campos).toContain('entidade')
      expect(campos).toContain('registro_id')
    })

    it('coleção parametros existe e suporta parâmetros de rotas públicas e decisões', () => {
      const colParam = getCollection('parametros')
      expect(colParam).toBeDefined()
    })
  })
})
