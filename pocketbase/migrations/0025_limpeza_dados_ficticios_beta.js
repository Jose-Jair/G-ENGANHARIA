migrate(
  (app) => {
    // Migração 0025: Limpeza total dos dados fictícios (semente/demonstração)
    // para preparar o sistema GESTÃO G+ na versão BETA limpa.
    // Preserva:
    // - Usuários (users)
    // - Parâmetros do sistema (parametros)
    // - Catálogo de serviços (catalogo_servicos)
    // - Modelos (modelos)
    // - Motivos (motivos)
    // - Regras de permissões e estrutura de coleções

    // Ordem de remoção com DELETE SQL direto para garantir limpeza respeitando relações e integridade:
    const tabelasParaLimpar = [
      'audit_logs', // Histórico de auditoria de dados fictícios
      'contas', // Contas a pagar/receber de demonstração
      'cotacoes', // Cotações de executores
      'avaliacoes', // Avaliações de executores
      'entregaveis', // Entregáveis de projeto
      'documentos', // Documentos de projeto (ARTs, OSs, medições)
      'riscos', // Riscos de projeto
      'projeto_etapas', // Etapas de projetos
      'projetos', // Projetos de engenharia
      'proposta_itens', // Itens de propostas
      'propostas', // Propostas comerciais
      'campanha_envios', // Histórico de envios de campanhas
      'campanhas', // Campanhas de nutrição
      'toques', // Toques de cadência
      'reativacoes_sugeridas', // Sugestões de reativação
      'sugestoes_funil', // Sugestões de funil (planilha/pncp/manual)
      'nao_contatar', // Registros de opt-out fictícios
      'contatos', // Contatos de empresas
      'contratos', // Contratos públicos vinculados
      'empresas', // Empresas do funil
      'clientes_pf', // Clientes pessoa física
      'executores', // Executores de obras/projetos
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

    // Registrar o evento de limpeza como uma ação de auditoria de sistema auditada
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      let adminUser = null
      try {
        adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@sistema.eng.br')
      } catch (_) {}

      const auditRec = new Record(auditCol)
      if (adminUser) {
        auditRec.set('user', adminUser.id)
        auditRec.set('user_email', adminUser.getString('email'))
      } else {
        auditRec.set('user_email', 'sistema@gestaogmais.eng.br')
      }
      auditRec.set('acao', 'LIMPEZA_SISTEMA_BETA')
      auditRec.set('entidade', 'sistema')
      auditRec.set('registro_id', 'v1.0.0-beta')
      auditRec.set('detalhes', {
        versao: 'v1.0.0-beta',
        descricao:
          'Limpeza completa de dados fictícios para início de uso real e testes da versão BETA.',
        tabelas_limpas: tabelasParaLimpar,
        preservados: ['users', 'parametros', 'catalogo_servicos', 'modelos', 'motivos'],
        data_execucao: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Aviso ao registrar auditoria de limpeza: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: a limpeza foi solicitada e aprovada como irreversível.
  },
)
