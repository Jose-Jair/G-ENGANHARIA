import { describe, it, expect, beforeAll } from 'vitest'
import PocketBase from 'pocketbase'

const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090'

describe('Endpoint de Autochecagem de Segurança (/backend/v1/seguranca/selfcheck)', () => {
  let pbAnon: PocketBase
  let pbAdmin: PocketBase
  let pbExecutor: PocketBase
  let pbComercial: PocketBase

  beforeAll(async () => {
    pbAnon = new PocketBase(pbUrl)
    pbAdmin = new PocketBase(pbUrl)
    pbExecutor = new PocketBase(pbUrl)
    pbComercial = new PocketBase(pbUrl)

    try {
      await pbAdmin.collection('users').authWithPassword('admin@sistema.eng.br', 'Skip@Pass')
    } catch {
      // Ignora caso falhe em ambiente offline
    }

    try {
      await pbExecutor.collection('users').authWithPassword('executor@sistema.eng.br', 'Eng@2024')
    } catch {
      // Ignora caso falhe em ambiente offline
    }

    try {
      await pbComercial
        .collection('users')
        .authWithPassword('comercial@sistema.eng.br', 'Skip@Pass')
    } catch {
      // Ignora caso falhe em ambiente offline
    }
  })

  it('deve negar com 401 ou 403 requisições anônimas', async () => {
    let errRes: any = null
    try {
      await pbAnon.send('/backend/v1/seguranca/selfcheck', { method: 'GET' })
    } catch (err: any) {
      errRes = err
    }

    expect(errRes).not.toBeNull()
    expect([401, 403]).toContain(errRes.status)
  })

  it('deve negar com 403 usuário logado que não seja Admin (ex: executor)', async () => {
    if (!pbExecutor.authStore.isValid) return

    let errRes: any = null
    try {
      await pbExecutor.send('/backend/v1/seguranca/selfcheck', { method: 'GET' })
    } catch (err: any) {
      errRes = err
    }

    expect(errRes).not.toBeNull()
    expect(errRes.status).toBe(403)
  })

  it('deve responder 200 com conformidade_geral para perfil Admin', async () => {
    if (!pbAdmin.authStore.isValid) return

    const res = await pbAdmin.send('/backend/v1/seguranca/selfcheck', { method: 'GET' })
    expect(res).toBeDefined()
    expect(res.status).toBe('OK')
    expect(res.resultados).toBeDefined()
    expect(res.resultados.item1_api_rules).toBeDefined()
    expect(res.resultados.item2_protected_files).toBeDefined()
    expect(res.resultados.item2_protected_files.todos_protegidos).toBe(true)
    expect(res.resultados.item9_canal_comunicacao_os).toBeDefined()
    expect(res.resultados.item9_canal_comunicacao_os.todas_conformes).toBe(true)
    expect(res.resultados.item10_monitoramento_cobranca_prazos).toBeDefined()
    expect(res.resultados.item10_monitoramento_cobranca_prazos.todas_conformes).toBe(true)
    expect(res.resultados.item11_ia_operacao_chaves).toBeDefined()
    expect(res.resultados.item11_ia_operacao_chaves.todas_conformes).toBe(true)

    // Item 12: SMTP Operante (Rodada 11)
    expect(res.resultados.item12_smtp_operante).toBeDefined()
    expect(res.resultados.item12_smtp_operante.detalhes).toBeDefined()

    // Item 13: Recrutamento Público, Triagem e Documentos (Rodada 12)
    expect(res.resultados.item13_recrutamento_triagem_documentos).toBeDefined()
    expect(res.resultados.item13_recrutamento_triagem_documentos.todas_conformes).toBe(true)
    expect(
      res.resultados.item13_recrutamento_triagem_documentos.detalhes.links_recrutamento_regras,
    ).toBe(true)
    expect(
      res.resultados.item13_recrutamento_triagem_documentos.detalhes.documentos_isolamento_dono,
    ).toBe(true)
    expect(
      res.resultados.item13_recrutamento_triagem_documentos.detalhes.documentos_arquivo_protegido,
    ).toBe(true)
    expect(
      res.resultados.item13_recrutamento_triagem_documentos.detalhes.campos_prestador_adicionados,
    ).toBe(true)
    expect(
      res.resultados.item13_recrutamento_triagem_documentos.detalhes.parametros_administracao,
    ).toBe(true)

    // Item 14: Prospecção Automática (Rodada 14 - Partes 1 e 2: Fontes do Ceará)
    expect(res.resultados.item14_prospeccao_automatica).toBeDefined()
    expect(res.resultados.item14_prospeccao_automatica.todas_conformes).toBe(true)
    expect(res.resultados.item14_prospeccao_automatica.detalhes.colecoes_configuradas).toBe(true)
    expect(res.resultados.item14_prospeccao_automatica.detalhes.pncp_configurada).toBe(true)
    expect(res.resultados.item14_prospeccao_automatica.detalhes.tce_ce_configurada).toBe(true)
    expect(
      res.resultados.item14_prospeccao_automatica.detalhes.ceara_transparente_csv_configurada,
    ).toBe(true)
    // Se chave ausente, nunca finge sucesso: status 'pendente'
    expect(res.resultados.item14_prospeccao_automatica.detalhes.transparencia_status).toBeDefined()
  })
})
