migrate(
  (app) => {
    // Migração 0040: Limpeza completa do banco de dados para teste do zero.
    // Prepara o ambiente para reexecução da esteira completa de teste:
    // (proposta -> validação -> envio -> aceite -> contrato na aba do projeto -> assinatura bilateral -> projeto ativo com etapas e contas).
    //
    // Preservar estritamente:
    // - users (incluindo usuários fictícios: admin, comercial, financeiro, gestor, executor)
    // - parametros (curva ABC, percentuais, textos padrão de WhatsApp/proposta, etc.)
    // - modelos (modelos de e-mail e proposta)
    // - motivos (motivos cadastrados no sistema)
    // - catalogo_servicos, areas_atuacao, subservicos, entregaveis_padrao (estrutura técnica)
    // - nao_contatar (lista de exclusão permanente LGPD)
    //
    // Ordem de deleção direta em lote via SQL para respeitar integridade referencial:
    // 1. contas (aponta para projetos, propostas, executores, projeto_etapas)
    // 2. cotacoes, avaliacoes, entregaveis (apontam para projeto_etapas e executores)
    // 3. documentos, riscos (apontam para projetos e projeto_etapas)
    // 4. projeto_etapas (aponta para projetos, executores, areas_atuacao)
    // 5. proposta_parcelas (aponta para propostas)
    // 6. proposta_itens (aponta para propostas, servicos, areas, projetos, projeto_etapas)
    // 7. contratos_servico (aponta para propostas, empresas, clientes_pf, projetos)
    // 8. projetos (aponta para propostas, contratos, empresas, clientes_pf, contratos_servico)
    // 9. propostas (aponta para empresas, clientes_pf, contratos, modelos, contratos_servico)
    // 10. campanha_envios (aponta para campanhas, empresas)
    // 11. campanhas (aponta para modelos, users)
    // 12. toques (aponta para empresas)
    // 13. reativacoes_sugeridas (aponta para empresas, contratos, users)
    // 14. sugestoes_funil (aponta para empresas, users)
    // 15. contatos (aponta para empresas)
    // 16. contratos (aponta para empresas)
    // 17. empresas (aponta para users)
    // 18. clientes_pf
    // 19. audit_logs (limpa logs transacionais de teste anteriores para zerar a base)

    const tabelasParaLimpar = [
      'contas',
      'cotacoes',
      'avaliacoes',
      'entregaveis',
      'documentos',
      'riscos',
      'projeto_etapas',
      'proposta_parcelas',
      'proposta_itens',
      'contratos_servico',
      'projetos',
      'propostas',
      'campanha_envios',
      'campanhas',
      'toques',
      'reativacoes_sugeridas',
      'sugestoes_funil',
      'contatos',
      'contratos',
      'empresas',
      'clientes_pf',
      'audit_logs',
    ]

    const registrosRemovidosPorTabela = {}

    for (let i = 0; i < tabelasParaLimpar.length; i++) {
      const tabela = tabelasParaLimpar[i]
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

          registrosRemovidosPorTabela[tabela] = contagemAntes
        }
      } catch (err) {
        console.log('Aviso ao limpar tabela ' + tabela + ': ' + err)
      }
    }

    // Registrar um único evento oficial de auditoria documentando a limpeza total
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

      auditRec.set('acao', 'LIMPEZA_BANCO_TESTE_ZERO')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'reset_total_teste')
      auditRec.set('detalhes', {
        motivo:
          'Limpeza de banco para teste do zero da esteira completa de engenharia (proposta -> aceite -> contrato -> ativacao do projeto)',
        tabelas_limpas: tabelasParaLimpar,
        registros_removidos: registrosRemovidosPorTabela,
        preservados: [
          'users',
          'parametros',
          'modelos',
          'motivos',
          'catalogo_servicos',
          'areas_atuacao',
          'subservicos',
          'entregaveis_padrao',
          'nao_contatar',
        ],
        executado_em: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Aviso ao registrar auditoria de limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: limpeza aprovada de dados de teste para reinício do ciclo.
  },
)
