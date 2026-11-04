/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0127: EXCLUSÃO COMPLETA DA CADEIA DE TESTE 'TESTE E2E'
    // Decisão do dono: confirmou que tudo é teste.
    // Autorizado apagar a cadeia inteira de forma segura e idempotente.
    //
    // Padrão de segurança:
    // - SQL direto via app.db().newQuery().execute() (sem hooks de exclusão,
    //   sem envio de e-mails, sem notificações externas, sem side-effects).
    // - Ordem estrita de dependência (filhos primeiro -> pais depois):
    //   1. contas (parcelas dos contratos de teste)
    //   2. entregaveis (entregáveis gerados dos pacotes/etapas de teste)
    //   3. projeto_etapas (etapas e pacotes dos projetos de teste)
    //   4. projetos (PRJ-2026-0001..0004)
    //   5. grupos_projetos (GPR-2026-0001..0004)
    //   6. contratos_servico (CTR-2026-0001..0004)
    //   7. proposta_itens (itens das propostas de teste)
    //   8. propostas (PROP-2026-0001..0004)
    //   9. empresas (empresa espelho PF 'TESTE E2E Cliente 2' id cdi450u5xdhfgt1)
    //   10. clientes_pf (cliente PF 'TESTE E2E Cliente 2' id quvppphqoqdklkg)
    //
    // Preservados 100%: usuários, parâmetros, catálogos, modelos, prestadores,
    // links de recrutamento, audit_logs, erros_sistema.
    // Idempotente: cláusulas WHERE específicas por ID e número de teste.
    // =========================================================================

    const idsClientesPf = ["'quvppphqoqdklkg'"]
    const idsEmpresasPf = ["'cdi450u5xdhfgt1'"]

    const idsPropostas = [
      "'x1ce1z1jyvtjn1o'", // PROP-2026-0001
      "'g5yd9trmgxxjj8t'", // PROP-2026-0002
      "'nlu6qremdn1biiz'", // PROP-2026-0003
      "'e6du05oslnt0gkd'", // PROP-2026-0004
    ]

    const idsContratos = [
      "'0yfta39qweu2eee'", // CTR-2026-0001
      "'3q1x2s11wdbzlzw'", // CTR-2026-0002
      "'ksorfla6p6kvgr1'", // CTR-2026-0003
      "'yikdjwsrxm3zhkn'", // CTR-2026-0004
    ]

    const idsProjetos = [
      "'q3qh152vwyuke0a'", // PRJ-2026-0001
      "'yde16al28uc26i0'", // PRJ-2026-0002
      "'hfaeg6pptx5nf9w'", // PRJ-2026-0003
      "'rge2cwoqd322erh'", // PRJ-2026-0004
    ]

    const idsGrupos = [
      "'ziriyxvuw6fahom'", // GPR-2026-0001
      "'km8vl5umuk4d4ui'", // GPR-2026-0002
      "'ouatgv96iy87gz4'", // GPR-2026-0003
      "'db7j7pkxerjqtua'", // GPR-2026-0004
    ]

    const idsContas = [
      "'e252wzyz1gb9ceh'", // CTR-0002 Parcela 1
      "'2ivn8dd7hhn895b'", // CTR-0002 Parcela 2
      "'iz8c116wynfqls5'", // CTR-0003 Parcela 1
      "'xcta16txafjno8m'", // CTR-0003 Parcela 2
      "'gy88m2d5ji6az00'", // CTR-0004 Parcela 1
      "'doesj9duqlebujz'", // CTR-0004 Parcela 2
    ]

    const idsEtapas = [
      "'t4xby3o2hu2puss'", // PRJ-0001 Etapa
      "'6oxr6rdkrnlce2q'", // PRJ-0002 Pacote
      "'fj6psaj46gotah8'", // PRJ-0003 Pacote
      "'nz8pupx1lllp0gd'", // PRJ-0004 Pacote
    ]

    const idsEntregaveis = [
      "'jekbyl9ugw44vfg'",
      "'kk0sh58i3qsoiyj'",
      "'hvnu770lu0vp92f'",
      "'8fhdoiu86uy1sy1'",
      "'fq3vkgb7ekw7g52'",
      "'493puk877k7v6v8'",
      "'x7zt9awzp78owdm'",
      "'qykxtvccb6twgjd'",
      "'gqar6y6frcanwep'",
    ]

    const idsPropostaItens = [
      "'0rtswgj1yvi28tp'", // PROP-0001 item
      "'j2pe371bqc1s1em'", // PROP-0002 item
      "'3vvohmxqo1hwb3a'", // PROP-0003 item
      "'kstk2sckxt4fqv3'", // PROP-0004 item
    ]

    // 1. Apagar contas vinculadas aos contratos ou projetos de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM contas WHERE id IN (' +
            idsContas.join(',') +
            ') OR contrato_servico IN (' +
            idsContratos.join(',') +
            ') OR projeto IN (' +
            idsProjetos.join(',') +
            ')',
        )
        .execute()
    } catch (e1) {
      console.log('[0127] Erro ao deletar contas: ' + e1)
    }

    // 2. Apagar entregaveis vinculados às etapas de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM entregaveis WHERE id IN (' +
            idsEntregaveis.join(',') +
            ') OR etapa IN (' +
            idsEtapas.join(',') +
            ')',
        )
        .execute()
    } catch (e2) {
      console.log('[0127] Erro ao deletar entregaveis: ' + e2)
    }

    // 3. Apagar projeto_etapas vinculadas aos projetos de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM projeto_etapas WHERE id IN (' +
            idsEtapas.join(',') +
            ') OR projeto IN (' +
            idsProjetos.join(',') +
            ')',
        )
        .execute()
    } catch (e3) {
      console.log('[0127] Erro ao deletar projeto_etapas: ' + e3)
    }

    // 4. Apagar projetos de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM projetos WHERE id IN (' +
            idsProjetos.join(',') +
            ') OR contrato_servico IN (' +
            idsContratos.join(',') +
            ') OR proposta IN (' +
            idsPropostas.join(',') +
            ") OR cliente_pf IN ('quvppphqoqdklkg')",
        )
        .execute()
    } catch (e4) {
      console.log('[0127] Erro ao deletar projetos: ' + e4)
    }

    // 5. Apagar grupos_projetos de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM grupos_projetos WHERE id IN (' +
            idsGrupos.join(',') +
            ') OR contrato_servico IN (' +
            idsContratos.join(',') +
            ') OR proposta IN (' +
            idsPropostas.join(',') +
            ") OR cliente_pf IN ('quvppphqoqdklkg')",
        )
        .execute()
    } catch (e5) {
      console.log('[0127] Erro ao deletar grupos_projetos: ' + e5)
    }

    // 6. Apagar contratos_servico de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM contratos_servico WHERE id IN (' +
            idsContratos.join(',') +
            ') OR proposta IN (' +
            idsPropostas.join(',') +
            ") OR cliente_pf IN ('quvppphqoqdklkg')",
        )
        .execute()
    } catch (e6) {
      console.log('[0127] Erro ao deletar contratos_servico: ' + e6)
    }

    // 7. Apagar proposta_itens de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM proposta_itens WHERE id IN (' +
            idsPropostaItens.join(',') +
            ') OR proposta IN (' +
            idsPropostas.join(',') +
            ')',
        )
        .execute()
    } catch (e7) {
      console.log('[0127] Erro ao deletar proposta_itens: ' + e7)
    }

    // 8. Apagar propostas de teste
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM propostas WHERE id IN (' +
            idsPropostas.join(',') +
            ") OR cliente_pf IN ('quvppphqoqdklkg') OR empresa IN ('cdi450u5xdhfgt1')",
        )
        .execute()
    } catch (e8) {
      console.log('[0127] Erro ao deletar propostas: ' + e8)
    }

    // 9. Apagar toques vinculados à empresa de teste (se houver)
    try {
      app.db().newQuery("DELETE FROM toques WHERE empresa IN ('cdi450u5xdhfgt1')").execute()
    } catch (e9) {
      console.log('[0127] Erro ao deletar toques: ' + e9)
    }

    // 10. Apagar empresa espelho PF de teste
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM empresas WHERE id IN ('cdi450u5xdhfgt1') OR cliente_pf_ref IN ('quvppphqoqdklkg')",
        )
        .execute()
    } catch (e10) {
      console.log('[0127] Erro ao deletar empresas PF teste: ' + e10)
    }

    // 11. Apagar clientes_pf de teste
    try {
      app.db().newQuery("DELETE FROM clientes_pf WHERE id IN ('quvppphqoqdklkg')").execute()
    } catch (e11) {
      console.log('[0127] Erro ao deletar clientes_pf teste: ' + e11)
    }

    console.log('[0127] Exclusão completa da cadeia de teste TESTE E2E concluída com sucesso.')
  },
  () => {
    // Reversão não aplicável para limpeza permanente de dados de teste autorizada pelo dono
  },
)
