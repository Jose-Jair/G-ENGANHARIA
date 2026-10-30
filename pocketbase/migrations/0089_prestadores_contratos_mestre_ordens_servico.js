migrate(
  (app) => {
    // =========================================================================
    // 1. COLEÇÃO: prestadores
    // =========================================================================
    let prestadoresCol
    try {
      prestadoresCol = app.findCollectionByNameOrId('prestadores')
    } catch (_) {
      prestadoresCol = new Collection({
        name: 'prestadores',
        type: 'base',
        fields: [
          {
            name: 'tipo',
            type: 'select',
            values: ['interno', 'pf_externo', 'pj_externo'],
            required: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'cpf_cnpj', type: 'text' },
          { name: 'email', type: 'email', required: true },
          { name: 'telefone', type: 'text' },
          { name: 'telefones', type: 'json' },
          { name: 'conselho', type: 'text' },
          { name: 'conselho_classe', type: 'text' },
          { name: 'numero_registro_conselho', type: 'text' },
          { name: 'validade_registro_conselho', type: 'date' },
          { name: 'disciplinas', type: 'text' },
          { name: 'regiao', type: 'text' },
          { name: 'capacidade_simultanea', type: 'number' },
          { name: 'dados_bancarios', type: 'text' },
          { name: 'nda_contrato', type: 'file', maxSelect: 1, maxSize: 10485760, protected: true },
          {
            name: 'documento_termo',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            protected: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['ativo', 'pendente', 'suspenso', 'inativo'],
            required: true,
          },
          { name: 'motivo_suspensao', type: 'text' },
          { name: 'nota_geral', type: 'number' },
          { name: 'total_avaliacoes', type: 'number' },
          { name: 'token_cadastro', type: 'text' },
          { name: 'token_cadastro_expira', type: 'date' },
          { name: 'tentativas_token', type: 'number' },
          { name: 'executor_legado_id', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_prestadores_tipo ON prestadores (tipo)',
          'CREATE INDEX idx_prestadores_status ON prestadores (status)',
          'CREATE INDEX idx_prestadores_email ON prestadores (email)',
          'CREATE INDEX idx_prestadores_cpf_cnpj ON prestadores (cpf_cnpj)',
        ],
      })
      app.save(prestadoresCol)

      prestadoresCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      prestadoresCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      prestadoresCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      prestadoresCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      prestadoresCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(prestadoresCol)
    }

    // =========================================================================
    // 2. COLEÇÃO: profissionais_prestador (para PJ Externo)
    // =========================================================================
    let profCol
    try {
      profCol = app.findCollectionByNameOrId('profissionais_prestador')
    } catch (_) {
      profCol = new Collection({
        name: 'profissionais_prestador',
        type: 'base',
        fields: [
          {
            name: 'prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'conselho', type: 'text' },
          { name: 'numero', type: 'text' },
          { name: 'validade', type: 'date' },
          { name: 'email', type: 'email' },
          { name: 'telefone', type: 'text' },
          { name: 'cargo_funcao', type: 'text' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_prof_prestador ON profissionais_prestador (prestador)'],
      })
      app.save(profCol)

      profCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      profCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      profCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      profCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      profCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(profCol)
    }

    // =========================================================================
    // 3. COLEÇÃO: contratos_mestre (um por prestador externo com NDA)
    // =========================================================================
    let cmCol
    try {
      cmCol = app.findCollectionByNameOrId('contratos_mestre')
    } catch (_) {
      cmCol = new Collection({
        name: 'contratos_mestre',
        type: 'base',
        fields: [
          { name: 'numero', type: 'text', required: true },
          {
            name: 'prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: [
              'minuta',
              'aguardando_assinatura_gmais',
              'aguardando_assinatura_prestador',
              'assinado',
              'cancelado',
            ],
            required: true,
          },
          { name: 'minuta_texto', type: 'text' },
          { name: 'clausulas_nda', type: 'text' },
          { name: 'token_assinatura', type: 'text' },
          {
            name: 'assinante_gmais',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'data_assinatura_gmais', type: 'date' },
          { name: 'gmais_ip', type: 'text' },
          { name: 'gmais_hash', type: 'text' },
          { name: 'assinante_prestador_nome', type: 'text' },
          { name: 'assinante_prestador_doc', type: 'text' },
          { name: 'data_assinatura_prestador', type: 'date' },
          { name: 'prestador_ip', type: 'text' },
          { name: 'prestador_hash', type: 'text' },
          { name: 'arquivo_pdf', type: 'file', maxSelect: 1, maxSize: 10485760, protected: true },
          { name: 'data_emissao', type: 'date' },
          { name: 'token_expiracao', type: 'date' },
          { name: 'tentativas_token', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_cm_numero ON contratos_mestre (numero)',
          'CREATE INDEX idx_cm_prestador ON contratos_mestre (prestador)',
          'CREATE INDEX idx_cm_status ON contratos_mestre (status)',
          'CREATE INDEX idx_cm_token ON contratos_mestre (token_assinatura)',
        ],
      })
      app.save(cmCol)

      cmCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      cmCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      cmCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      cmCol.updateRule =
        "(@request.auth.id != '' && @request.auth.role = 'admin') || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
      cmCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(cmCol)
    }

    // =========================================================================
    // 4. COLEÇÃO: ordens_servico (substitui subcontratos por OS)
    // =========================================================================
    let osCol
    try {
      osCol = app.findCollectionByNameOrId('ordens_servico')
    } catch (_) {
      const prjCol = app.findCollectionByNameOrId('projetos')
      const subCol = app.findCollectionByNameOrId('subcontratos')

      osCol = new Collection({
        name: 'ordens_servico',
        type: 'base',
        fields: [
          { name: 'numero', type: 'text', required: true },
          {
            name: 'tipo_prestador',
            type: 'select',
            values: ['interno', 'externo'],
            required: true,
          },
          {
            name: 'projeto',
            type: 'relation',
            collectionId: prjCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'prestador',
            type: 'relation',
            collectionId: prestadoresCol.id,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'contrato_mestre',
            type: 'relation',
            collectionId: cmCol.id,
            maxSelect: 1,
          },
          {
            name: 'subcontrato_legado',
            type: 'relation',
            collectionId: subCol.id,
            maxSelect: 1,
          },
          { name: 'disciplina', type: 'text' },
          { name: 'escopo_tecnico', type: 'text' },
          { name: 'entregaveis_texto', type: 'text' },
          { name: 'prazo_dias', type: 'number' },
          { name: 'data_inicio', type: 'date' },
          { name: 'data_previsao_fim', type: 'date' },
          { name: 'data_conclusao', type: 'date' },
          { name: 'valor_os', type: 'number' },
          {
            name: 'status',
            type: 'select',
            values: [
              'minuta',
              'aguardando_assinatura',
              'assinada',
              'em_execucao',
              'concluida',
              'avaliada',
              'encerrada',
              'cancelada',
            ],
            required: true,
          },
          { name: 'percentual_retencao_tecnica', type: 'number' },
          { name: 'retencao_tecnica_acumulada', type: 'number' },
          { name: 'retencao_tecnica_liberada', type: 'number' },
          {
            name: 'status_retencao',
            type: 'select',
            values: ['sem_retencao', 'acumulando', 'parcialmente_liberada', 'totalmente_liberada'],
          },
          { name: 'checklist_encerramento_json', type: 'json' },
          { name: 'aceite_cliente', type: 'bool' },
          { name: 'data_aceite_cliente', type: 'date' },
          { name: 'token_assinatura', type: 'text' },
          { name: 'assinante_prestador_nome', type: 'text' },
          { name: 'assinante_prestador_doc', type: 'text' },
          { name: 'data_assinatura_prestador', type: 'date' },
          { name: 'prestador_ip', type: 'text' },
          { name: 'prestador_hash', type: 'text' },
          { name: 'clausulas_texto', type: 'text' },
          { name: 'parcelas_json', type: 'json' },
          {
            name: 'emitido_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'token_expiracao', type: 'date' },
          { name: 'tentativas_token', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_os_numero ON ordens_servico (numero)',
          'CREATE INDEX idx_os_projeto ON ordens_servico (projeto)',
          'CREATE INDEX idx_os_prestador ON ordens_servico (prestador)',
          'CREATE INDEX idx_os_status ON ordens_servico (status)',
          'CREATE INDEX idx_os_tipo ON ordens_servico (tipo_prestador)',
        ],
      })
      app.save(osCol)

      osCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      osCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
      osCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      osCol.updateRule =
        "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
      osCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(osCol)
    }

    // Adicionar campo ordem_servico na coleção contas para suportar OS
    try {
      const contasCol = app.findCollectionByNameOrId('contas')
      if (!contasCol.fields.getByName('ordem_servico')) {
        contasCol.fields.add(
          new RelationField({
            name: 'ordem_servico',
            collectionId: osCol.id,
            maxSelect: 1,
          }),
        )
        app.save(contasCol)
      }
    } catch (_) {}

    // =========================================================================
    // 5. COLEÇÕES-PROJEÇÃO DO PORTAL DO PRESTADOR
    // portal_os, portal_entregaveis, portal_documentos
    // =========================================================================
    let portalOsCol
    try {
      portalOsCol = app.findCollectionByNameOrId('portal_os')
    } catch (_) {
      portalOsCol = new Collection({
        name: 'portal_os',
        type: 'base',
        fields: [
          { name: 'os_id', type: 'text', required: true },
          { name: 'prestador_email', type: 'email', required: true },
          { name: 'prestador_id', type: 'text' },
          { name: 'codigo_projeto', type: 'text', required: true },
          { name: 'numero_os', type: 'text', required: true },
          { name: 'disciplina', type: 'text' },
          { name: 'escopo_tecnico', type: 'text' },
          { name: 'entregaveis_resumo', type: 'text' },
          { name: 'prazo_dias', type: 'number' },
          { name: 'data_inicio', type: 'date' },
          { name: 'data_previsao_fim', type: 'date' },
          { name: 'status', type: 'text' },
          { name: 'valor_os', type: 'number' },
          { name: 'token_assinatura', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pos_os_id ON portal_os (os_id)',
          'CREATE INDEX idx_pos_email ON portal_os (prestador_email)',
        ],
      })
      app.save(portalOsCol)

      portalOsCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalOsCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalOsCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalOsCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalOsCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(portalOsCol)
    }

    let portalEntregaveisCol
    try {
      portalEntregaveisCol = app.findCollectionByNameOrId('portal_entregaveis')
    } catch (_) {
      portalEntregaveisCol = new Collection({
        name: 'portal_entregaveis',
        type: 'base',
        fields: [
          { name: 'os_id', type: 'text', required: true },
          { name: 'prestador_email', type: 'email', required: true },
          { name: 'codigo_projeto', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'versao', type: 'text' },
          { name: 'prazo_entrega', type: 'date' },
          { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 52428800, protected: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pent_os_id ON portal_entregaveis (os_id)',
          'CREATE INDEX idx_pent_email ON portal_entregaveis (prestador_email)',
        ],
      })
      app.save(portalEntregaveisCol)

      portalEntregaveisCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalEntregaveisCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalEntregaveisCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalEntregaveisCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalEntregaveisCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(portalEntregaveisCol)
    }

    let portalDocCol
    try {
      portalDocCol = app.findCollectionByNameOrId('portal_documentos')
    } catch (_) {
      portalDocCol = new Collection({
        name: 'portal_documentos',
        type: 'base',
        fields: [
          { name: 'os_id', type: 'text', required: true },
          { name: 'prestador_email', type: 'email', required: true },
          { name: 'codigo_projeto', type: 'text', required: true },
          { name: 'titulo', type: 'text', required: true },
          { name: 'categoria', type: 'text' },
          { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 52428800, protected: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pdoc_os_id ON portal_documentos (os_id)',
          'CREATE INDEX idx_pdoc_email ON portal_documentos (prestador_email)',
        ],
      })
      app.save(portalDocCol)

      portalDocCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalDocCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      portalDocCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalDocCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      portalDocCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(portalDocCol)
    }

    // =========================================================================
    // 6. BACKFILL NÃO DESTRUTIVO: executores -> prestadores
    // =========================================================================
    const idMapExecToPrestador = {}
    try {
      const execs = app.findRecordsByFilter('executores', '', '', 1000, 0)
      for (let i = 0; i < execs.length; i++) {
        const ex = execs[i]
        const docLimpo = (ex.getString('cpf_cnpj') || '').replace(/\D/g, '')
        let tipoDerivado = 'pf_externo'
        if (docLimpo.length === 14) {
          tipoDerivado = 'pj_externo'
        } else if (docLimpo.length === 11) {
          tipoDerivado = 'pf_externo'
        } else {
          tipoDerivado = ex.getString('tipo') === 'pj' ? 'pj_externo' : 'pf_externo'
        }

        const jaExiste = app.findRecordsByFilter(
          'prestadores',
          "executor_legado_id = '" + ex.id + "' || email = '" + ex.getString('email') + "'",
          '',
          1,
          0,
        )

        let pRec
        if (jaExiste.length > 0) {
          pRec = jaExiste[0]
        } else {
          pRec = new Record(prestadoresCol)
        }

        pRec.set('tipo', tipoDerivado)
        pRec.set('nome', ex.getString('nome'))
        pRec.set('cpf_cnpj', ex.getString('cpf_cnpj'))
        pRec.set('email', ex.getString('email'))
        pRec.set('telefone', ex.getString('telefone'))
        pRec.set('telefones', ex.get('telefones'))
        pRec.set('conselho', ex.getString('conselho'))
        pRec.set('conselho_classe', ex.getString('conselho_classe'))
        pRec.set(
          'numero_registro_conselho',
          ex.getString('numero_registro_conselho') || ex.getString('numero_registro'),
        )
        pRec.set(
          'validade_registro_conselho',
          ex.getString('validade_registro_conselho') || ex.getString('conselho_validade'),
        )
        pRec.set('disciplinas', ex.getString('disciplinas'))
        pRec.set('regiao', ex.getString('regiao'))
        pRec.set('capacidade_simultanea', ex.getInt('capacidade_simultanea') || 3)
        pRec.set('dados_bancarios', ex.getString('dados_bancarios'))
        pRec.set('status', ex.getString('status') || 'ativo')
        pRec.set('motivo_suspensao', ex.getString('motivo_suspensao'))
        pRec.set('nota_geral', ex.getFloat('nota_geral') || 5.0)
        pRec.set('total_avaliacoes', ex.getInt('total_avaliacoes') || 0)
        pRec.set('token_cadastro', ex.getString('token_cadastro'))
        pRec.set('executor_legado_id', ex.id)

        app.save(pRec)
        idMapExecToPrestador[ex.id] = pRec.id
      }
    } catch (eBackfillExec) {
      console.log('Erro no backfill de executores -> prestadores: ' + eBackfillExec)
    }

    // =========================================================================
    // 7. BACKFILL NÃO DESTRUTIVO: subcontratos -> ordens_servico
    // =========================================================================
    try {
      const subs = app.findRecordsByFilter('subcontratos', '', '', 1000, 0)
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i]
        const numSub = sub.getString('numero')
        const numOs = numSub.replace(/^SUB-/, 'OS-')

        const jaExisteOs = app.findRecordsByFilter(
          'ordens_servico',
          "subcontrato_legado = '" + sub.id + "' || numero = '" + numOs + "'",
          '',
          1,
          0,
        )

        let osRec
        if (jaExisteOs.length > 0) {
          osRec = jaExisteOs[0]
        } else {
          osRec = new Record(osCol)
        }

        const prestadorId = idMapExecToPrestador[sub.getString('executor')]
        if (!prestadorId) {
          continue
        }

        osRec.set('numero', numOs)
        osRec.set('tipo_prestador', 'externo')
        osRec.set('projeto', sub.getString('projeto'))
        osRec.set('prestador', prestadorId)
        osRec.set('subcontrato_legado', sub.id)
        osRec.set('disciplina', 'Engenharia')
        osRec.set(
          'escopo_tecnico',
          sub.getString('descricao_delegada') || sub.getString('descricao_escopo'),
        )
        osRec.set('prazo_dias', sub.getInt('prazo_dias') || 30)
        osRec.set('valor_os', sub.getFloat('valor_total') || 0)

        // Status mapping
        const sStatus = sub.getString('status')
        let mappedStatus = 'minuta'
        if (sStatus === 'assinado') mappedStatus = 'assinada'
        else if (sStatus === 'em_execucao') mappedStatus = 'em_execucao'
        else if (sStatus === 'concluido') mappedStatus = 'concluida'
        else if (sStatus === 'avaliado') mappedStatus = 'avaliada'
        else if (sStatus === 'encerrado') mappedStatus = 'encerrada'
        else if (sStatus === 'aguardando_assinatura') mappedStatus = 'aguardando_assinatura'
        else if (sStatus === 'cancelado') mappedStatus = 'cancelada'

        osRec.set('status', mappedStatus)
        osRec.set('percentual_retencao_tecnica', sub.getFloat('percentual_retencao_tecnica') || 0)
        osRec.set('retencao_tecnica_acumulada', sub.getFloat('retencao_tecnica_acumulada') || 0)
        osRec.set('retencao_tecnica_liberada', sub.getFloat('retencao_tecnica_liberada') || 0)
        osRec.set('status_retencao', sub.getString('status_retencao') || 'sem_retencao')
        osRec.set('checklist_encerramento_json', sub.get('checklist_encerramento_json'))
        osRec.set('token_assinatura', sub.getString('token_assinatura'))
        osRec.set('assinante_prestador_nome', sub.getString('executor_nome_assinante'))
        osRec.set('assinante_prestador_doc', sub.getString('executor_documento_assinante'))
        osRec.set('data_assinatura_prestador', sub.getString('data_assinatura_executor'))
        osRec.set('prestador_ip', sub.getString('executor_ip'))
        osRec.set('prestador_hash', sub.getString('executor_hash'))
        osRec.set('clausulas_texto', sub.getString('clausulas_texto'))
        osRec.set('parcelas_json', sub.get('parcelas_json'))
        osRec.set('emitido_por', sub.getString('emitido_por'))

        app.save(osRec)

        // Vincular contas do subcontrato à nova OS
        try {
          const contas = app.findRecordsByFilter(
            'contas',
            "subcontrato = '" + sub.id + "'",
            '',
            100,
            0,
          )
          for (let c = 0; c < contas.length; c++) {
            const conta = contas[c]
            if (!conta.getString('ordem_servico')) {
              conta.set('ordem_servico', osRec.id)
              app.save(conta)
            }
          }
        } catch (_) {}

        // Gerar projeção no portal_os
        try {
          const prestadorRec = app.findRecordById('prestadores', prestadorId)
          const prjRec = app.findRecordById('projetos', sub.getString('projeto'))
          const emailPrest = prestadorRec ? prestadorRec.getString('email') : ''
          const codPrj = prjRec ? prjRec.getString('codigo') : 'PRJ'

          if (emailPrest) {
            const projExist = app.findRecordsByFilter(
              'portal_os',
              "os_id = '" + osRec.id + "'",
              '',
              1,
              0,
            )
            let pOsRec
            if (projExist.length > 0) {
              pOsRec = projExist[0]
            } else {
              pOsRec = new Record(portalOsCol)
            }
            pOsRec.set('os_id', osRec.id)
            pOsRec.set('prestador_email', emailPrest)
            pOsRec.set('prestador_id', prestadorId)
            pOsRec.set('codigo_projeto', codPrj)
            pOsRec.set('numero_os', osRec.getString('numero'))
            pOsRec.set('disciplina', osRec.getString('disciplina') || 'Engenharia')
            pOsRec.set('escopo_tecnico', osRec.getString('escopo_tecnico'))
            pOsRec.set('prazo_dias', osRec.getInt('prazo_dias') || 30)
            pOsRec.set('status', osRec.getString('status'))
            pOsRec.set('valor_os', osRec.getFloat('valor_os') || 0)
            pOsRec.set('token_assinatura', osRec.getString('token_assinatura'))
            app.save(pOsRec)
          }
        } catch (eProj) {
          console.log('Erro ao sincronizar projeção de OS no backfill: ' + eProj)
        }
      }
    } catch (eBackfillSub) {
      console.log('Erro no backfill de subcontratos -> ordens_servico: ' + eBackfillSub)
    }

    // Criar um prestador interno semente caso ainda não exista equipe interna
    try {
      const internos = app.findRecordsByFilter('prestadores', "tipo = 'interno'", '', 1, 0)
      if (internos.length === 0) {
        const engInterno = new Record(prestadoresCol)
        engInterno.set('tipo', 'interno')
        engInterno.set('nome', 'Equipe Técnica Interna G+')
        engInterno.set('cpf_cnpj', '000.000.000-00')
        engInterno.set('email', 'engenharia.interna@gmais.eng.br')
        engInterno.set('telefone', '+55 (88) 92188-6547')
        engInterno.set('conselho', 'CREA')
        engInterno.set('conselho_classe', 'CREA')
        engInterno.set('numero_registro_conselho', 'CREA-CE 102938-D')
        engInterno.set('validade_registro_conselho', '2028-12-31 00:00:00.000Z')
        engInterno.set('disciplinas', 'Estrutural, Hidráulico, Elétrico, Topografia')
        engInterno.set('regiao', 'Ceará e Nordeste')
        engInterno.set('capacidade_simultanea', 5)
        engInterno.set('status', 'ativo')
        engInterno.set('nota_geral', 5.0)
        engInterno.set('total_avaliacoes', 0)
        app.save(engInterno)
      }
    } catch (_) {}
  },
  (app) => {
    // Reversão segura
  },
)
