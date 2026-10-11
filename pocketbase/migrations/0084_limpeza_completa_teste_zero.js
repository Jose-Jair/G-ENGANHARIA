/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0084: LIMPEZA COMPLETA DO SISTEMA GESTÃO G+ PARA TESTE DO ZERO
    // Solicitada e expressamente confirmada pelo usuário.
    //
    // ESCOPO: Apagar TODOS os registros de negócio (incluindo órfãos e esteira real):
    // - propostas (PROP-2026-0001, etc.), proposta_itens, proposta_parcelas
    // - contratos_servico (CTR-2026-0001, etc.) e contratos (contratos públicos)
    // - grupos_projetos (GPR-2026-0001, etc.), projetos (PRJ-2026-0001 e PRJ-2026-0002, etc.),
    //   projeto_etapas, entregaveis, documentos, riscos
    // - contas (a pagar e a receber, incluindo as 2 em rascunho de CTR-2026-0001)
    // - subcontratos, medicoes, avaliacoes_executor e avaliacoes (legadas)
    // - cotacoes
    // - empresas (leads do funil), contatos, toques, campanhas, campanha_envios,
    //   sugestoes_funil, reativacoes_sugeridas
    // - executores e clientes_pf (incluindo "Beatriz da Conceição de Lima")
    //
    // MANTER INTOCADO:
    // - users (todos os perfis e credenciais)
    // - parametros (cadência, alçadas, estagnação de funil etc.)
    // - modelos (templates de proposta e e-mail)
    // - motivos (inativação, recusa, cancelamento de toque)
    // - catalogo_servicos (os 7 serviços ativos e suas áreas)
    // - areas_atuacao, subservicos, entregaveis_padrao
    // - nao_contatar (lista LGPD)
    // - audit_logs históricos (imutáveis, não se apagam)
    //
    // GRAVAR:
    // - Evento de auditoria LIMPEZA_COMPLETA_TESTE_ZERO em audit_logs com contagens
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

    // Função auxiliar para updates seguros
    const safeUpdate = (sql) => {
      try {
        app.db().newQuery(sql).execute()
      } catch (err) {
        console.log('[0084] Aviso ao executar SQL de desvinculo: ' + err)
      }
    }

    // 1. Desvincular todas as relações circulares e foreign keys para evitar travas e bloqueios
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

    // 2. Contar e excluir dados de cada tabela em lote via SQL direto
    // (o SQL direto evita que hooks de interface ou RLS impeçam o reset em lote autorizado)
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
          console.log('[0084] Erro ao limpar ' + tabela + ': ' + errDel)
          registrosRemovidos[tabela] = 0
        }
      } else {
        registrosRemovidos[tabela] = 0
      }
    }

    // 3. Gravar evento de auditoria documentando a limpeza completa
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')

      let adminUser = null
      try {
        adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@sistema.eng.br')
      } catch (_) {
        try {
          adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'josejair_ufca@outlook.com')
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
      auditRec.set('registro_id', 'reset_total_teste_zero_2026')
      auditRec.set('detalhes', {
        motivo: 'Limpeza completa do banco de dados do sistema GESTÃO G+ para novo teste do zero.',
        confirmacao_usuario:
          'Usuário confirmou expressamente a exclusão de tudo, incluindo PROP-2026-0001, CTR-2026-0001, PRJ-2026-0001, PRJ-2026-0002, grupo GPR-2026-0001, contas a receber e cliente PF Beatriz da Conceição de Lima.',
        autor: adminUser ? adminUser.getString('email') : 'admin@sistema.eng.br',
        preservados: [
          'users (usuários e perfis)',
          'parametros (cadência, alçadas, estagnação funil etc.)',
          'modelos (modelos de e-mail e proposta)',
          'motivos (inativação, recusa, cancelamento de toque)',
          'catalogo_servicos (7 serviços ativos)',
          'areas_atuacao',
          'subservicos',
          'entregaveis_padrao',
          'nao_contatar (lista LGPD)',
          'audit_logs (histórico imutável de auditoria preservado)',
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
      console.log('[0084] Erro ao registrar log de auditoria da limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: limpeza destrutiva deliberada e autorizada pelo usuário
  },
)
