migrate(
  (app) => {
    // Migração 0034: Limpeza completa de dados de teste (Opção 2 - cadeia completa)
    // para teste limpo do sistema GESTÃO G+.
    //
    // Ordem de remoção com DELETE SQL direto respeitando integridade referencial (filhos antes de pais):
    // audit_logs; contas; cotacoes; avaliacoes; entregaveis; documentos; riscos;
    // projeto_etapas; projetos; proposta_parcelas; proposta_itens; propostas;
    // campanha_envios; campanhas; toques; reativacoes_sugeridas; sugestoes_funil;
    // contatos; contratos; empresas; clientes_pf.
    //
    // Preservar:
    // users, parametros, modelos, motivos, catalogo_servicos,
    // areas_atuacao, subservicos, entregaveis_padrao, nao_contatar.
    // Idempotente.

    const tabelasParaLimpar = [
      'audit_logs',
      'contas',
      'cotacoes',
      'avaliacoes',
      'entregaveis',
      'documentos',
      'riscos',
      'projeto_etapas',
      'projetos',
      'proposta_parcelas',
      'proposta_itens',
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
    ]

    for (let i = 0; i < tabelasParaLimpar.length; i++) {
      const tabela = tabelasParaLimpar[i]
      try {
        if (app.hasTable(tabela)) {
          app
            .db()
            .newQuery('DELETE FROM ' + tabela)
            .execute()
        }
      } catch (err) {
        console.log('Aviso ao limpar tabela ' + tabela + ': ' + err)
      }
    }

    // Registrar um único evento LIMPEZA_DADOS_TESTE em audit_logs ao final
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
      auditRec.set('acao', 'LIMPEZA_DADOS_TESTE')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'limpeza_completa')
      auditRec.set('detalhes', {
        tipo: 'Opção 2 - cadeia completa',
        descricao: 'Limpeza completa de dados de teste para teste limpo.',
        tabelas_limpas: tabelasParaLimpar,
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
        data_execucao: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Aviso ao registrar auditoria de limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: limpeza completa aprovada e irreversível.
  },
)
