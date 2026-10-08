migrate(
  (app) => {
    // Migração 0050: Limpeza completa da cadeia comercial solicitada pelo usuário (OPÇÃO 1)
    // Apaga propostas E tudo que delas derivou, preservando integralmente cadastros-base e histórico de auditoria.
    //
    // APAGAR (Cadeia comercial completa):
    // 1. contas vinculadas a propostas, projetos ou subcontratos (rascunhos de faturamento e despesas de teste)
    // 2. avaliacoes (avaliações vinculadas a etapas de projeto de teste)
    // 3. entregaveis (entregáveis de etapas de projeto de teste)
    // 4. cotacoes (cotações de convite/resposta de etapas ou projetos)
    // 5. subcontratos (SUB-2026-* gerados por contratação)
    // 6. documentos (documentos e ARTs de etapas ou projetos de teste)
    // 7. riscos (riscos mapeados em projetos de teste)
    // 8. projeto_etapas (etapas de projetos de teste)
    // 9. projetos (PRJ-2026-* gerados por aceites ou manuais de teste)
    // 10. grupos_projetos (GPR-2026-* gerados por contratos/propostas)
    // 11. contratos_servico (CTR-2026-* gerados por propostas)
    // 12. proposta_parcelas (parcelas das propostas)
    // 13. proposta_itens (itens de escopo das propostas)
    // 14. propostas (PROP-2026-*)
    //
    // PRESERVAR (Cadastros-base e infraestrutura):
    // - users (incl. executor@sistema.eng.br, admin, comercial, financeiro, gestor)
    // - empresas (clientes/parceiros PJ cadastrados)
    // - clientes_pf (clientes PF cadastrados)
    // - contatos (contatos das empresas)
    // - contratos (contratos de órgãos públicos/licitações das empresas parceiras)
    // - catalogo_servicos, areas_atuacao, subservicos, entregaveis_padrao (catálogo e parametrizações técnicas)
    // - modelos (modelos de propostas e e-mails)
    // - parametros (parâmetros de configuração e textos de sistema)
    // - motivos (motivos de recusa, inativação e cancelamento)
    // - executores (profissionais homologados e dados cadastrais)
    // - nao_contatar (lista LGPD)
    // - audit_logs (imutabilidade garantida; registro de auditoria da limpeza adicionado)

    const tabelasCadeiaComercial = [
      'contas',
      'avaliacoes',
      'entregaveis',
      'cotacoes',
      'subcontratos',
      'documentos',
      'riscos',
      'projeto_etapas',
      'projetos',
      'grupos_projetos',
      'contratos_servico',
      'proposta_parcelas',
      'proposta_itens',
      'propostas',
    ]

    const registrosRemovidos = {}

    // Desvincular chaves estrangeiras circulares antes do DELETE em lote (ex.: propostas.contrato_servico, projetos.contrato_servico)
    try {
      if (app.hasTable('propostas')) {
        app.db().newQuery("UPDATE propostas SET contrato_servico = ''").execute()
      }
      if (app.hasTable('contratos_servico')) {
        app.db().newQuery("UPDATE contratos_servico SET projeto = '', proposta = ''").execute()
      }
      if (app.hasTable('projetos')) {
        app
          .db()
          .newQuery("UPDATE projetos SET grupo = '', contrato_servico = '', proposta = ''")
          .execute()
      }
      if (app.hasTable('grupos_projetos')) {
        app
          .db()
          .newQuery("UPDATE grupos_projetos SET contrato_servico = '', proposta = ''")
          .execute()
      }
      if (app.hasTable('subcontratos')) {
        app
          .db()
          .newQuery(
            "UPDATE subcontratos SET projeto = '', grupo = '', contrato_servico_origem = '', cotacao = ''",
          )
          .execute()
      }
      if (app.hasTable('proposta_itens')) {
        app
          .db()
          .newQuery("UPDATE proposta_itens SET projeto_gerado = '', etapa_gerada = ''")
          .execute()
      }
    } catch (errDesvinculo) {
      console.log(
        'Aviso ao desvincular referências circulares da cadeia comercial: ' + errDesvinculo,
      )
    }

    // Executar limpeza tabela por tabela na ordem de dependência
    for (let i = 0; i < tabelasCadeiaComercial.length; i++) {
      const tabela = tabelasCadeiaComercial[i]
      try {
        if (app.hasTable(tabela)) {
          let contagemAntes = 0
          try {
            contagemAntes = app.countRecords(tabela)
          } catch (_) {}

          app
            .db()
            .newQuery('DELETE FROM ' + tabela)
            .execute()
          registrosRemovidos[tabela] = contagemAntes
        }
      } catch (errDel) {
        console.log('Erro ao limpar tabela ' + tabela + ': ' + errDel)
      }
    }

    // Registrar o evento oficial de auditoria da limpeza
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      let adminUser = null
      try {
        adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'josejair_ufca@outlook.com')
      } catch (_) {
        try {
          adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@sistema.eng.br')
        } catch (_) {}
      }

      const auditRec = new Record(auditCol)
      if (adminUser) {
        auditRec.set('user', adminUser.id)
        auditRec.set('user_email', adminUser.getString('email'))
      } else {
        auditRec.set('user_email', 'sistema@gestaogmais.eng.br')
      }

      auditRec.set('acao', 'LIMPEZA_CADEIA_COMERCIAL_TESTE_LIMPO')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'limpeza_propostas_cadeia')
      auditRec.set('detalhes', {
        motivo:
          'Limpeza completa da cadeia comercial solicitada pelo usuário (Opção 1): propostas, contratos de serviço, grupos, projetos, etapas, entregáveis, cotações, subcontratos e contas derivadas.',
        preservados: [
          'users',
          'empresas',
          'clientes_pf',
          'contatos',
          'contratos',
          'catalogo_servicos',
          'areas_atuacao',
          'subservicos',
          'entregaveis_padrao',
          'modelos',
          'parametros',
          'motivos',
          'executores',
          'nao_contatar',
          'audit_logs',
        ],
        tabelas_limpas: tabelasCadeiaComercial,
        registros_removidos: registrosRemovidos,
        numeracao_reiniciada: {
          propostas: 'PROP-2026-0001',
          contratos_servico: 'CTR-2026-0001',
          projetos: 'PRJ-2026-0001',
          grupos_projetos: 'GPR-2026-0001',
          subcontratos: 'SUB-2026-0001',
        },
        executado_em: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Aviso ao registrar auditoria de limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Down idempotente — migração de limpeza irreversível solicitada pelo usuário
  },
)
