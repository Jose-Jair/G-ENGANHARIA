migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const osCol = app.findCollectionByNameOrId('ordens_servico')
    const versoesCol = app.findCollectionByNameOrId('entregaveis_versoes')

    // =========================================================================
    // 1. COLEÇÃO: mensagens_os
    // Canal de mensagens por Ordem de Serviço entre Gestor/Revisor e Prestador.
    // Regras:
    // - Imutabilidade garantida por API rules (update/delete negados: null).
    // - Criação: Admin, Gestor ou Executor dono da OS (os.prestador.email = @request.auth.email).
    // - List/View: Admin, Gestor ou Executor dono da OS.
    // - Anexo protegido com file token obrigatório.
    // =========================================================================
    let mensagensCol
    try {
      mensagensCol = app.findCollectionByNameOrId('mensagens_os')
    } catch (_) {
      mensagensCol = new Collection({
        name: 'mensagens_os',
        type: 'base',
        fields: [
          {
            name: 'os',
            type: 'relation',
            collectionId: osCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'autor_tipo',
            type: 'select',
            values: ['interno', 'prestador', 'sistema'],
            required: true,
          },
          {
            name: 'autor_usuario',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'autor_nome', type: 'text', required: true },
          { name: 'autor_email', type: 'email' },
          { name: 'texto', type: 'text', required: true },
          {
            name: 'anexo',
            type: 'file',
            maxSelect: 1,
            maxSize: 52428800, // 50MB
            protected: true,
          },
          { name: 'anexo_nome_original', type: 'text' },
          { name: 'anexo_tamanho', type: 'number' },
          { name: 'lida_por_prestador', type: 'bool' },
          { name: 'lida_por_interno', type: 'bool' },
          { name: 'data_leitura_prestador', type: 'date' },
          { name: 'data_leitura_interno', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_msg_os_os ON mensagens_os (os)',
          'CREATE INDEX idx_msg_os_created ON mensagens_os (created)',
          'CREATE INDEX idx_msg_os_lida_prest ON mensagens_os (os, lida_por_prestador)',
          'CREATE INDEX idx_msg_os_lida_int ON mensagens_os (os, lida_por_interno)',
        ],
      })
      app.save(mensagensCol)

      // Regras RLS estritas de acesso
      mensagensCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && os.prestador.email = @request.auth.email))"
      mensagensCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && os.prestador.email = @request.auth.email))"
      mensagensCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && os.prestador.email = @request.auth.email))"
      // Imutabilidade estrita: update e delete bloqueados via API rules (null)
      mensagensCol.updateRule = null
      mensagensCol.deleteRule = null
      app.save(mensagensCol)
    }

    // =========================================================================
    // 2. COLEÇÃO: entregavel_comentarios
    // Comentários de revisão por versão do entregável.
    // Regras:
    // - Criação/Listagem por Admin, Gestor ou Executor da versão vinculada.
    // - Imutabilidade: update/delete bloqueados via API rules (null).
    // =========================================================================
    let comentariosCol
    try {
      comentariosCol = app.findCollectionByNameOrId('entregavel_comentarios')
    } catch (_) {
      comentariosCol = new Collection({
        name: 'entregavel_comentarios',
        type: 'base',
        fields: [
          {
            name: 'versao',
            type: 'relation',
            collectionId: versoesCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'autor_tipo',
            type: 'select',
            values: ['interno', 'prestador', 'sistema'],
            required: true,
          },
          {
            name: 'autor_usuario',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'autor_nome', type: 'text', required: true },
          { name: 'autor_email', type: 'email' },
          { name: 'texto', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ent_com_versao ON entregavel_comentarios (versao)',
          'CREATE INDEX idx_ent_com_created ON entregavel_comentarios (created)',
        ],
      })
      app.save(comentariosCol)

      comentariosCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && versao.entregavel.prestador.email = @request.auth.email))"
      comentariosCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && versao.entregavel.prestador.email = @request.auth.email))"
      comentariosCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && versao.entregavel.prestador.email = @request.auth.email))"
      comentariosCol.updateRule = null
      comentariosCol.deleteRule = null
      app.save(comentariosCol)
    }

    // =========================================================================
    // 3. COLEÇÃO: notificacoes
    // Central de notificações segmentada (usuários internos ou prestadores por email).
    // Regras:
    // - List/View: Usuário interno (destinatario_usuario = @request.auth.id) ou
    //   Prestador (destinatario_email = @request.auth.email).
    // - Create: Restrito a Admin/Gestor ou gerado pelo backend em modo superuser.
    // - Update: Somente marcar como lida o próprio registro.
    // =========================================================================
    let notificacoesCol
    try {
      notificacoesCol = app.findCollectionByNameOrId('notificacoes')
    } catch (_) {
      notificacoesCol = new Collection({
        name: 'notificacoes',
        type: 'base',
        fields: [
          {
            name: 'destinatario_tipo',
            type: 'select',
            values: ['interno', 'prestador'],
            required: true,
          },
          {
            name: 'destinatario_usuario',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          { name: 'destinatario_email', type: 'email' },
          {
            name: 'tipo',
            type: 'select',
            values: [
              'mensagem_os',
              'versao_submetida',
              'versao_avaliada',
              'comentario_versao',
              'sistema',
            ],
            required: true,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'mensagem', type: 'text', required: true },
          { name: 'referencia_tipo', type: 'text' }, // 'ordens_servico', 'entregaveis', etc.
          { name: 'referencia_id', type: 'text' },
          { name: 'lida', type: 'bool' },
          { name: 'data_leitura', type: 'date' },
          { name: 'email_enviado', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_notif_usuario ON notificacoes (destinatario_usuario)',
          'CREATE INDEX idx_notif_email ON notificacoes (destinatario_email)',
          'CREATE INDEX idx_notif_lida ON notificacoes (lida)',
          'CREATE INDEX idx_notif_created ON notificacoes (created)',
        ],
      })
      app.save(notificacoesCol)

      notificacoesCol.listRule =
        "@request.auth.id != '' && ((destinatario_tipo = 'interno' && destinatario_usuario = @request.auth.id) || (destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email) || @request.auth.role = 'admin')"
      notificacoesCol.viewRule =
        "@request.auth.id != '' && ((destinatario_tipo = 'interno' && destinatario_usuario = @request.auth.id) || (destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email) || @request.auth.role = 'admin')"
      notificacoesCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      // Update permitido apenas para marcar lida_por pelo próprio destinatário
      notificacoesCol.updateRule =
        "@request.auth.id != '' && ((destinatario_tipo = 'interno' && destinatario_usuario = @request.auth.id) || (destinatario_tipo = 'prestador' && destinatario_email = @request.auth.email) || @request.auth.role = 'admin')"
      notificacoesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(notificacoesCol)
    }
  },
  (app) => {
    try {
      const n = app.findCollectionByNameOrId('notificacoes')
      app.delete(n)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('entregavel_comentarios')
      app.delete(c)
    } catch (_) {}
    try {
      const m = app.findCollectionByNameOrId('mensagens_os')
      app.delete(m)
    } catch (_) {}
  },
)
