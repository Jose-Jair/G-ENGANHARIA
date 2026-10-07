migrate(
  (app) => {
    // Limpeza via migração dos 3 projetos duplicados órfãos da proposta qf9f0d6ban0vlds (PROP-2026-0001)
    // Projetos: syewmcz5hup4117, lylaimc1l9lwl52, c8af5qs7vkmeiha
    const projetoIds = ['syewmcz5hup4117', 'lylaimc1l9lwl52', 'c8af5qs7vkmeiha']

    for (let i = 0; i < projetoIds.length; i++) {
      const pId = projetoIds[i]

      // 1. Excluir dependentes em cascata que apontem para esses projetos
      // documentos, riscos, contas
      app.db().newQuery('DELETE FROM documentos WHERE projeto = {:id}').bind({ id: pId }).execute()
      app.db().newQuery('DELETE FROM riscos WHERE projeto = {:id}').bind({ id: pId }).execute()
      app.db().newQuery('DELETE FROM contas WHERE projeto = {:id}').bind({ id: pId }).execute()

      // entregaveis e cotacoes apontam para projeto_etapas
      app
        .db()
        .newQuery(`
      DELETE FROM entregaveis WHERE etapa IN (
        SELECT id FROM projeto_etapas WHERE projeto = {:id}
      )
    `)
        .bind({ id: pId })
        .execute()

      app
        .db()
        .newQuery(`
      DELETE FROM cotacoes WHERE etapa IN (
        SELECT id FROM projeto_etapas WHERE projeto = {:id}
      )
    `)
        .bind({ id: pId })
        .execute()

      app
        .db()
        .newQuery(`
      DELETE FROM avaliacoes WHERE etapa IN (
        SELECT id FROM projeto_etapas WHERE projeto = {:id}
      )
    `)
        .bind({ id: pId })
        .execute()

      app
        .db()
        .newQuery('DELETE FROM projeto_etapas WHERE projeto = {:id}')
        .bind({ id: pId })
        .execute()

      // Limpar vínculo em proposta_itens
      app
        .db()
        .newQuery(
          "UPDATE proposta_itens SET projeto_gerado = NULL, etapa_gerada = NULL, status_conversao = 'nao_convertido' WHERE projeto_gerado = {:id}",
        )
        .bind({ id: pId })
        .execute()

      // Excluir o projeto
      try {
        const proj = app.findRecordById('projetos', pId)
        app.delete(proj)
      } catch (_) {
        app.db().newQuery('DELETE FROM projetos WHERE id = {:id}').bind({ id: pId }).execute()
      }
    }

    // Excluir contratos_servico órfãos associados à proposta (se houver) para permitir reexercício limpo
    try {
      const ctrs = app.findRecordsByFilter(
        'contratos_servico',
        "proposta = 'qf9f0d6ban0vlds'",
        '-created',
        50,
        0,
      )
      for (let c = 0; c < ctrs.length; c++) {
        app.delete(ctrs[c])
      }
    } catch (_) {}

    // Excluir contas a receber associadas à proposta qf9f0d6ban0vlds
    try {
      app.db().newQuery("DELETE FROM contas WHERE proposta = 'qf9f0d6ban0vlds'").execute()
    } catch (_) {}

    // Resetar a proposta qf9f0d6ban0vlds (PROP-2026-0001) para status 'enviada' com token_aceite ativo
    // Preserva cliente_pf ywx7s6c5yh0af92 como pré-cadastro para retestar a promoção completa
    try {
      const proposta = app.findRecordById('propostas', 'qf9f0d6ban0vlds')
      if (proposta) {
        proposta.set('status', 'enviada')
        proposta.set('data_aceite', '')
        proposta.set('aceite_ip', '')
        proposta.set('aceite_user_agent', '')
        proposta.set('aceite_declaracao', false)
        proposta.set('aceite_hash', '')
        proposta.set('contrato_servico', '')
        proposta.set('dados_complementares_preenchidos', false)
        if (!proposta.getString('token_aceite')) {
          proposta.set('token_aceite', $security.randomString(32))
        }
        app.save(proposta)
      }
    } catch (errProp) {
      console.log('Erro ao resetar proposta PROP-2026-0001: ' + errProp)
    }

    // Garantir que o cliente ywx7s6c5yh0af92 permaneça como pré-cadastro para o reteste
    try {
      const clientePf = app.findRecordById('clientes_pf', 'ywx7s6c5yh0af92')
      if (clientePf) {
        clientePf.set('pre_cadastro', true)
        app.save(clientePf)
      }
    } catch (errPf) {
      console.log('Erro ao resetar cliente PF: ' + errPf)
    }
  },
  (app) => {
    // down: no-op para migração de limpeza
  },
)
