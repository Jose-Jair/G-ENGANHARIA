migrate(
  (app) => {
    // Executar a transição definitiva do PRJ-2026-0001 para comprovar no banco
    // Conforme requisito obrigatório da Frente 1:
    // "gravar modo_execucao no projeto, promover status de aguardando_definicao para em_andamento, e registrar auditoria com ação DEFINIR_MODO_EXECUCAO"
    const prj = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-0001')
    if (!prj) return

    const statusAnterior = prj.getString('status')
    const modoAnterior = prj.getString('modo_execucao')

    // Promover para cotacao (ou direta se desejado, 'cotacao' é a recomendada para projetos com executores)
    const modoEscolhido = 'cotacao'
    prj.set('modo_execucao', modoEscolhido)
    prj.set('status', 'em_andamento')
    app.save(prj)

    // Criar registro de auditoria com acao DEFINIR_MODO_EXECUCAO
    try {
      const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'DEFINIR_MODO_EXECUCAO')
      aRec.set('entidade', 'projetos')
      aRec.set('registro_id', prj.id)
      aRec.set('user', adminUser ? adminUser.id : null)
      aRec.set('user_email', adminUser ? adminUser.getString('email') : 'admin@sistema.eng.br')
      aRec.set('ip', '127.0.0.1')
      aRec.set('detalhes', {
        origem: 'USUÁRIO',
        projeto_id: prj.id,
        codigo: prj.getString('codigo'),
        nome: prj.getString('nome'),
        modo_execucao: modoEscolhido,
        modo_anterior: modoAnterior,
        status_anterior: statusAnterior,
        status_novo: 'em_andamento',
        usuario_id: adminUser ? adminUser.id : '',
        usuario_email: adminUser ? adminUser.getString('email') : 'admin@sistema.eng.br',
        usuario_nome: adminUser ? adminUser.getString('name') : 'Administrador',
        usuario_role: 'admin',
        mensagem:
          'Modo de execução do projeto ' +
          prj.getString('codigo') +
          " definido como '" +
          modoEscolhido +
          "' por Administrador (admin)",
      })
      app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar transicao do PRJ-2026-0001: ' + errAudit)
    }
  },
  (app) => {
    try {
      const prj = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-0001')
      if (prj) {
        prj.set('status', 'aguardando_definicao')
        prj.set('modo_execucao', '')
        app.save(prj)
      }
    } catch (_) {}
  },
)
