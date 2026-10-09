/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0055: Segunda Limpeza Destrutiva de Dados de Teste solicitada explicitamente pelo usuário.
    // Apaga a esteira comercial completa gerada nos testes recentes (v0.0.67 a v0.0.72):
    // - propostas (PROP-2026-0001 a 0003) e seus itens e parcelas
    // - contratos_servico (CTR-2026-0001 a 0003) com tokens e arquivos de assinatura
    // - grupos_projetos (GPR-2026-0001 a 0003)
    // - projetos (PRJ-2026-0001 a 0003) com etapas, entregáveis, documentos, riscos e medições
    // - contas (a receber e a pagar vinculadas à cadeia de teste)
    // - subcontratos (SUB-2026-0001 e 0002) e cotações vinculadas
    // - avaliações de executores vinculadas a etapas de teste
    // - registros de auditoria gerados pelos testes desta rodada recente (após a 1ª limpeza 0050)
    //
    // PRESERVADOS INTEGRALMENTE:
    // - users (Admin, Comercial, Financeiro, Gestor, Executor homologado)
    // - empresas, contatos, clientes_pf
    // - contratos (contratos de órgãos públicos de clientes)
    // - catalogo_servicos, areas_atuacao, subservicos, entregaveis_padrao
    // - executores homologados
    // - modelos, textos padrão e parametros (incluindo parâmetros de WhatsApp e cláusulas GMAIS)
    // - motivos (inativação, recusa, cancelamento)
    // - nao_contatar (lista LGPD)
    // - campanhas, campanha_envios, toques, sugestoes_funil, reativacoes_sugeridas
    // - coleções estruturais e registros históricos de auditoria anteriores à rodada recente

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

    // 1. Desvincular chaves estrangeiras circulares antes do DELETE em lote
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
      if (app.hasTable('cotacoes')) {
        app.db().newQuery("UPDATE cotacoes SET projeto = '', grupo = '', etapa = ''").execute()
      }
      if (app.hasTable('proposta_itens')) {
        app
          .db()
          .newQuery("UPDATE proposta_itens SET projeto_gerado = '', etapa_gerada = ''")
          .execute()
      }
      if (app.hasTable('contas')) {
        app
          .db()
          .newQuery("UPDATE contas SET projeto = '', proposta = '', etapa = '', subcontrato = ''")
          .execute()
      }
    } catch (errDesvinculo) {
      console.log('Aviso ao desvincular chaves estrangeiras: ' + errDesvinculo)
    }

    // 2. Apagar tabelas da cadeia comercial em ordem de dependência (filhos antes de pais)
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

    // 3. Limpar logs de auditoria dos testes da rodada recente (gerados após a 1ª limpeza 0050)
    // Identificador da 1ª limpeza: created '2026-10-08 19:43:49.924Z'
    // Mantém: a auditoria da 1ª limpeza e quaisquer registros anteriores a ela.
    let logsAuditoriaRemovidos = 0
    try {
      if (app.hasTable('audit_logs')) {
        // Obter timestamp da 1ª limpeza
        let dataCortePrimeiraLimpeza = '2026-10-08 19:43:50.000Z'
        try {
          const recLimpeza1 = app.findFirstRecordByData(
            'audit_logs',
            'acao',
            'LIMPEZA_CADEIA_COMERCIAL_TESTE_LIMPO',
          )
          if (recLimpeza1) {
            dataCortePrimeiraLimpeza = recLimpeza1.getString('created')
          }
        } catch (_) {}

        // Contar quantos logs recentes serão apagados
        try {
          const qCount = app
            .db()
            .newQuery(
              "SELECT COUNT(*) as total FROM audit_logs WHERE created > {:corte} AND acao != 'LIMPEZA_CADEIA_COMERCIAL_TESTE_LIMPO'",
            )
            .bind({ corte: dataCortePrimeiraLimpeza })
          const res = {}
          qCount.one(res)
          if (res.total) {
            logsAuditoriaRemovidos = parseInt(res.total, 10) || 0
          }
        } catch (_) {}

        // Deletar logs gerados pelos testes da rodada recente
        app
          .db()
          .newQuery(
            "DELETE FROM audit_logs WHERE created > {:corte} AND acao != 'LIMPEZA_CADEIA_COMERCIAL_TESTE_LIMPO'",
          )
          .bind({ corte: dataCortePrimeiraLimpeza })
          .execute()

        registrosRemovidos['audit_logs_rodada_recente'] = logsAuditoriaRemovidos
      }
    } catch (errAuditDel) {
      console.log('Aviso ao limpar logs recentes de auditoria: ' + errAuditDel)
    }

    // 4. Registrar na auditoria (audit_logs) a própria limpeza
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
        auditRec.set('user_email', 'SISTEMA')
      }

      auditRec.set('acao', 'LIMPEZA_DADOS_TESTE_SEGUNDA_RODADA')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'limpeza_segunda_rodada_2026')
      auditRec.set('detalhes', {
        motivo: 'limpeza de dados de teste solicitada pelo usuário',
        justificativa: 'limpeza de dados de teste solicitada pelo usuário',
        autor: 'SISTEMA',
        preservados: [
          'users',
          'empresas',
          'contatos',
          'clientes_pf',
          'contratos',
          'catalogo_servicos',
          'areas_atuacao',
          'subservicos',
          'entregaveis_padrao',
          'executores',
          'modelos',
          'parametros',
          'motivos',
          'nao_contatar',
          'campanhas',
          'campanha_envios',
          'toques',
          'sugestoes_funil',
          'reativacoes_sugeridas',
          'audit_logs_historicos_anteriores',
        ],
        tabelas_afetadas: tabelasCadeiaComercial,
        quantidades_apagadas: registrosRemovidos,
        numeracao_reiniciada: {
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
      console.log('Aviso ao registrar auditoria da 2ª limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: limpeza destrutiva confirmada pelo usuário
  },
)
