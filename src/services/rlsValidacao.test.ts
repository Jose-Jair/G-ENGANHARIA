import { describe, it, expect, beforeAll } from 'vitest'
import PocketBase from 'pocketbase'

const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090'

describe('Validação Real do Isolamento RLS — Executor e Outros Perfis', () => {
  let pbExecutor: PocketBase
  let pbAdmin: PocketBase
  let pbComercial: PocketBase
  let pbFinanceiro: PocketBase

  beforeAll(async () => {
    pbExecutor = new PocketBase(pbUrl)
    pbAdmin = new PocketBase(pbUrl)
    pbComercial = new PocketBase(pbUrl)
    pbFinanceiro = new PocketBase(pbUrl)

    try {
      await pbExecutor.collection('users').authWithPassword('executor@sistema.eng.br', 'Eng@2024')
    } catch (e) {
      console.error('Falha ao autenticar executor@sistema.eng.br:', e)
    }

    try {
      await pbAdmin.collection('users').authWithPassword('admin@sistema.eng.br', 'Skip@Pass')
    } catch (e) {
      console.error('Falha ao autenticar admin@sistema.eng.br:', e)
    }

    try {
      await pbComercial
        .collection('users')
        .authWithPassword('comercial@sistema.eng.br', 'Skip@Pass')
    } catch (e) {
      console.error('Falha ao autenticar comercial@sistema.eng.br:', e)
    }

    try {
      await pbFinanceiro
        .collection('users')
        .authWithPassword('financeiro@sistema.eng.br', 'Skip@Pass')
    } catch (e) {
      console.error('Falha ao autenticar financeiro@sistema.eng.br:', e)
    }
  })

  describe('1. Perfil Executor (executor@sistema.eng.br)', () => {
    it('deve autenticar com sucesso e ter role executor', () => {
      expect(pbExecutor.authStore.isValid).toBe(true)
      expect(pbExecutor.authStore.record?.email).toBe('executor@sistema.eng.br')
      expect(pbExecutor.authStore.record?.role).toBe('executor')
    })

    it('consegue ler APENAS seus subcontratos vinculados (SUB-2026-0001)', async () => {
      const subs = await pbExecutor.collection('subcontratos').getFullList()
      expect(subs.length).toBeGreaterThan(0)
      for (const s of subs) {
        expect(s.numero).toBe('SUB-2026-0001')
      }
    })

    it('consegue ler APENAS seus convites de cotação vinculados (PRJ-2026-0002)', async () => {
      const cots = await pbExecutor.collection('cotacoes').getFullList()
      expect(cots.length).toBeGreaterThan(0)
      for (const c of cots) {
        // Cotações onde o executor é ele
        expect(c.executor).toBe('aacv3g6a03ioyn9')
      }
    })

    it('consegue ler APENAS projetos vinculados (onde foi contratado via subcontrato ou convidado via cotação)', async () => {
      const prjs = await pbExecutor.collection('projetos').getFullList()
      expect(prjs.length).toBeGreaterThan(0)
      // PRJ-2026-0001 (subcontratado) e PRJ-2026-0002 (cotação)
      const codigos = prjs.map((p) => p.codigo)
      expect(codigos).toContain('PRJ-2026-0001')
      expect(codigos).toContain('PRJ-2026-0002')
      expect(codigos).not.toContain('PRJ-2026-0003')
    })

    it('BLOQUEIA coleções sensíveis: propostas retorna 0 registros ou 403', async () => {
      let propostas: any[] = []
      let erroOcorreu = false
      try {
        propostas = await pbExecutor.collection('propostas').getFullList()
      } catch {
        erroOcorreu = true
      }
      expect(erroOcorreu || propostas.length === 0).toBe(true)
    })

    it('BLOQUEIA coleções sensíveis: contas financeiras retorna 0 registros ou 403', async () => {
      let contas: any[] = []
      let erroOcorreu = false
      try {
        contas = await pbExecutor.collection('contas').getFullList()
      } catch {
        erroOcorreu = true
      }
      expect(erroOcorreu || contas.length === 0).toBe(true)
    })

    it('BLOQUEIA coleções sensíveis: empresas do funil retorna 0 registros ou 403', async () => {
      let empresas: any[] = []
      let erroOcorreu = false
      try {
        empresas = await pbExecutor.collection('empresas').getFullList()
      } catch {
        erroOcorreu = true
      }
      expect(erroOcorreu || empresas.length === 0).toBe(true)
    })

    it('BLOQUEIA coleções sensíveis: grupos de projetos retorna 0 registros ou 403', async () => {
      let grupos: any[] = []
      let erroOcorreu = false
      try {
        grupos = await pbExecutor.collection('grupos_projetos').getFullList()
      } catch {
        erroOcorreu = true
      }
      expect(erroOcorreu || grupos.length === 0).toBe(true)
    })

    it('BLOQUEIA coleções sensíveis: contratos de serviço retorna 0 registros ou 403', async () => {
      let ctrs: any[] = []
      let erroOcorreu = false
      try {
        ctrs = await pbExecutor.collection('contratos_servico').getFullList()
      } catch {
        erroOcorreu = true
      }
      expect(erroOcorreu || ctrs.length === 0).toBe(true)
    })
  })

  describe('2. Perfis Internos (Admin, Comercial, Financeiro)', () => {
    it('Admin consegue ver todos os projetos, subcontratos, cotações, empresas e contas', async () => {
      expect(pbAdmin.authStore.isValid).toBe(true)
      const prjs = await pbAdmin.collection('projetos').getFullList()
      const subs = await pbAdmin.collection('subcontratos').getFullList()
      const cots = await pbAdmin.collection('cotacoes').getFullList()
      const empresas = await pbAdmin.collection('empresas').getFullList()
      const contas = await pbAdmin.collection('contas').getFullList()

      expect(prjs.length).toBeGreaterThan(0)
      expect(subs.length).toBeGreaterThan(0)
      expect(cots.length).toBeGreaterThan(0)
      expect(empresas.length).toBeGreaterThan(0)
      expect(contas.length).toBeGreaterThan(0)
    })

    it('Comercial consegue ler propostas, projetos e empresas, mas NÃO contas financeiras', async () => {
      expect(pbComercial.authStore.isValid).toBe(true)
      const propostas = await pbComercial.collection('propostas').getFullList()
      const empresas = await pbComercial.collection('empresas').getFullList()
      expect(propostas.length).toBeGreaterThan(0)
      expect(empresas.length).toBeGreaterThan(0)

      let contas: any[] = []
      let bloqueado = false
      try {
        contas = await pbComercial.collection('contas').getFullList()
      } catch {
        bloqueado = true
      }
      expect(bloqueado || contas.length === 0).toBe(true)
    })

    it('Financeiro consegue ler contas, projetos e propostas', async () => {
      expect(pbFinanceiro.authStore.isValid).toBe(true)
      const contas = await pbFinanceiro.collection('contas').getFullList()
      const prjs = await pbFinanceiro.collection('projetos').getFullList()
      expect(contas.length).toBeGreaterThan(0)
      expect(prjs.length).toBeGreaterThan(0)
    })
  })
})
