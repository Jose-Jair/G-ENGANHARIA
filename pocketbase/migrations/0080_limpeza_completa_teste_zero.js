/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0080: LIMPEZA COMPLETA DO SISTEMA GESTÃO G+ PARA TESTE PONTA A PONTA
    // Solicitada e confirmada expressamente pelo usuário.
    // Inclui a esteira real criada até agora: PROP-2026-0001, CTR-2026-0001, PRJ-2026-0001
    // e todos os dados de negócio acumulados.
    //
    // O QUE APAGAR (todos os dados de negócio):
    // 1. contas (a receber e a pagar vinculadas a propostas, contratos_servico, projetos, etapas, etc.)
    // 2. medicoes (medições de subcontratos)
    // 3. avaliacoes_executor (avaliações estruturadas de subcontratos)
    // 4. avaliacoes (avaliações legadas por etapa)
    // 5. entregaveis (entregáveis vinculados a etapas de projetos)
    // 6. documentos (ARTs, RRTs, ordens de serviço e documentos de projetos)
    // 7. riscos (matriz de riscos de projetos)
    // 8. cotacoes (cotações de subcontratação)
    // 9. subcontratos (subcontratos formalizados e minutas)
    // 10. projeto_etapas (todas as etapas de projetos)
    // 11. grupos_projetos (incluindo GPR-2026-0001)
    // 12. projetos (incluindo PRJ-2026-0001 e microprojetos residuais)
    // 13. contratos_servico (incluindo CTR-2026-0001 e complementos)
    // 14. proposta_parcelas (condições e parcelas de propostas)
    // 15. proposta_itens (itens de escopo e subserviços vinculados)
    // 16. propostas (incluindo PROP-2026-0001 e quaisquer de teste)
    // 17. contratos (contratos públicos / licitações de clientes)
    // 18. campanha_envios (disparos de campanhas)
    // 19. campanhas (campanhas de prospecção/nutrição)
    // 20. toques (toques de cadência comercial)
    // 21. reativacoes_sugeridas (sugestões de reativação)
    // 22. sugestoes_funil (sugestões via planilha/PNCP/manual)
    // 23. contatos (contatos de empresas)
    // 24. empresas (leads do funil e empresas clientes, exceto se usuário direto)
    // 25. clientes_pf (clientes pessoa física de testes)
    // 26. executores (candidatos e executores cadastrados em testes)
    //
    // O QUE MANTER INTOCADO (NÃO APAGAR):
    // - users (todos os perfis e credenciais)
    // - parametros (parâmetros de sistema, cadência, alçadas, funil_estagnacao_dias, etc.)
    // - modelos (modelos de e-mail, templates de proposta)
    // - motivos (inativação, recusa, cancelamento de toque)
    // - catalogo_servicos (os 7 serviços ativos e suas áreas)
    // - areas_atuacao (áreas de atuação técnica)
    // - subservicos (subserviços do catálogo)
    // - entregaveis_padrao (entregáveis modelo)
    // - nao_contatar (lista LGPD)
    // - audit_logs existentes (histórico imutável de auditoria — preservado integralmente)
    // =========================================================================

    const tabelasNegocioParaLimpar = [
      'contas',
      'medicoes',
      'avaliacoes_executor',
      'avaliacoes',
      'entregaveis',
      'documentos',
      'riscos',
      'cotacoes',
      'subcontratos',
      'projeto_etapas',
      'projetos',
      'grupos_projetos',
      'contratos_servico',
      'proposta_parcelas',
      'proposta_itens',
      'propostas',
      'campanha_envios',
      'campanhas',
      'toques',
      'reativacoes_sugeridas',
      'sugestoes_funil',
      'contratos',
      'contatos',
      'empresas',
      'clientes_pf',
      'executores',
    ]

    const registrosRemovidos = {}

    // 1. Desvincular relações cruzadas e circulares para evitar violações de FK e travas
    const safeUpdate = (sql) => {
      try {
        app.db().newQuery(sql).execute()
      } catch (err) {
        console.log('[0080] Aviso ao executar desvinculo SQL: ' + err)
      }
    }

    if (app.hasTable('propostas')) {
      safeUpdate(
        "UPDATE propostas SET contrato_servico = '', empresa = '', cliente_pf = '', contrato = '', modelo = ''",
      )
    }
    if (app.hasTable('contratos_servico')) {
      safeUpdate(
        "UPDATE contratos_servico SET projeto = '', proposta = '', empresa = '', cliente_pf = ''",
      )
    }
    if (app.hasTable('projetos')) {
      safeUpdate(
        "UPDATE projetos SET grupo = '', contrato_servico = '', proposta = '', contrato = '', empresa = '', cliente_pf = ''",
      )
    }
    if (app.hasTable('grupos_projetos')) {
      safeUpdate(
        "UPDATE grupos_projetos SET contrato_servico = '', proposta = '', empresa = '', cliente_pf = ''",
      )
    }
    if (app.hasTable('subcontratos')) {
      safeUpdate(
        "UPDATE subcontratos SET projeto = '', grupo = '', contrato_servico_origem = '', cotacao = '', executor = ''",
      )
    }
    if (app.hasTable('medicoes')) {
      safeUpdate("UPDATE medicoes SET subcontrato = '', projeto = '', executor = ''")
    }
    if (app.hasTable('avaliacoes_executor')) {
      safeUpdate("UPDATE avaliacoes_executor SET subcontrato = '', projeto = '', executor = ''")
    }
    if (app.hasTable('cotacoes')) {
      safeUpdate("UPDATE cotacoes SET projeto = '', grupo = '', etapa = '', executor = ''")
    }
    if (app.hasTable('avaliacoes')) {
      safeUpdate("UPDATE avaliacoes SET executor = '', etapa = ''")
    }
    if (app.hasTable('projeto_etapas')) {
      safeUpdate("UPDATE projeto_etapas SET projeto = '', executor = '', area = ''")
    }
    if (app.hasTable('proposta_itens')) {
      safeUpdate(
        "UPDATE proposta_itens SET projeto_gerado = '', etapa_gerada = '', proposta = '', area = '', servico = ''",
      )
    }
    if (app.hasTable('contas')) {
      safeUpdate(
        "UPDATE contas SET projeto = '', proposta = '', etapa = '', subcontrato = '', contrato_servico = '', executor = ''",
      )
    }
    if (app.hasTable('contratos')) {
      safeUpdate("UPDATE contratos SET empresa = '', sugestao_origem = ''")
    }
    if (app.hasTable('sugestoes_funil')) {
      safeUpdate("UPDATE sugestoes_funil SET empresa_criada = ''")
    }
    if (app.hasTable('reativacoes_sugeridas')) {
      safeUpdate("UPDATE reativacoes_sugeridas SET empresa = '', contrato = ''")
    }
    if (app.hasTable('toques')) {
      safeUpdate("UPDATE toques SET empresa = ''")
    }
    if (app.hasTable('campanha_envios')) {
      safeUpdate("UPDATE campanha_envios SET campanha = '', empresa = ''")
    }
    if (app.hasTable('contatos')) {
      safeUpdate("UPDATE contatos SET empresa = ''")
    }

    // 2. Executar contagem prévia e exclusão em lote em ordem de dependência
    for (let i = 0; i < tabelasNegocioParaLimpar.length; i++) {
      const tabela = tabelasNegocioParaLimpar[i]
      if (app.hasTable(tabela)) {
        let total = 0
        try {
          const qCount = app.db().newQuery('SELECT COUNT(*) as total FROM ' + tabela)
          const res = {}
          qCount.one(res)
          total = parseInt(res.total, 10) || 0
        } catch (_) {
          try {
            total = app.countRecords(tabela)
          } catch (_) {
            total = 0
          }
        }

        try {
          app
            .db()
            .newQuery('DELETE FROM ' + tabela)
            .execute()
          registrosRemovidos[tabela] = total
        } catch (errDel) {
          console.log('[0080] Erro ao limpar ' + tabela + ': ' + errDel)
          registrosRemovidos[tabela] = 0
        }
      } else {
        registrosRemovidos[tabela] = 0
      }
    }

    // 3. Registrar novo evento de auditoria documentando a limpeza total
    // Nota: A auditoria existente é preservada integralmente (log imutável).
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
        auditRec.set('user_email', 'admin@sistema.eng.br')
      }

      auditRec.set('acao', 'LIMPEZA_COMPLETA_TESTE_ZERO')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'reset_total_teste_ponta_a_ponta')
      auditRec.set('detalhes', {
        motivo:
          'Limpeza completa do sistema GESTÃO G+ para teste ponta a ponta do zero solicitada e confirmada expressamente pelo usuário.',
        confirmacao_usuario:
          'Limpeza aprovada incluindo registros reais PROP-2026-0001, CTR-2026-0001 e PRJ-2026-0001.',
        autor: adminUser ? adminUser.getString('email') : 'SISTEMA',
        preservados: [
          'users (todos os perfis e credenciais)',
          'parametros (cadência, alçadas, funil_estagnacao_dias, etc.)',
          'modelos (modelos de e-mail e proposta)',
          'motivos (inativação, recusa, cancelamento)',
          'catalogo_servicos (os 7 serviços ativos)',
          'areas_atuacao',
          'subservicos',
          'entregaveis_padrao',
          'nao_contatar (lista LGPD)',
          'audit_logs (histórico de auditoria preservado)',
        ],
        tabelas_limpas: tabelasNegocioParaLimpar,
        quantidades_apagadas: registrosRemovidos,
        esteira_reiniciada: {
          propostas: 'PROP-2026-0001',
          contratos_servico: 'CTR-2026-0001',
          grupos_projetos: 'GPR-2026-0001',
          projetos: 'PRJ-2026-0001',
          subcontratos: 'SUB-2026-0001',
        },
        executado_em: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('[0080] Erro ao registrar log de auditoria da limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: limpeza destrutiva deliberada e autorizada pelo usuário
  },
)
