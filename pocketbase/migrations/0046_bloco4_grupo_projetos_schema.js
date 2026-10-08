migrate(
  (app) => {
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const clientesPfId = app.findCollectionByNameOrId('clientes_pf').id
    const contratosServicoId = app.findCollectionByNameOrId('contratos_servico').id
    const propostasId = app.findCollectionByNameOrId('propostas').id

    // 1. Criar coleção grupos_projetos
    let gruposCol
    try {
      gruposCol = app.findCollectionByNameOrId('grupos_projetos')
    } catch (_) {
      gruposCol = new Collection({
        name: 'grupos_projetos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'codigo', type: 'text', required: true },
          {
            name: 'contrato_servico',
            type: 'relation',
            collectionId: contratosServicoId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'proposta',
            type: 'relation',
            collectionId: propostasId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'empresa',
            type: 'relation',
            collectionId: empresasId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'cliente_pf',
            type: 'relation',
            collectionId: clientesPfId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'nome', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            values: ['em_contratacao', 'ativo', 'concluido', 'cancelado'],
            maxSelect: 1,
            required: false,
          },
          { name: 'valor_total', type: 'number', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_grupos_projetos_codigo ON grupos_projetos (codigo)',
          'CREATE INDEX idx_grupos_projetos_contrato ON grupos_projetos (contrato_servico)',
          'CREATE INDEX idx_grupos_projetos_status ON grupos_projetos (status)',
        ],
      })
      app.save(gruposCol)
    }

    // 2. Adicionar campos 'grupo', 'modo_execucao' e 'descricao_delegada' em projetos
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const gruposColId = app.findCollectionByNameOrId('grupos_projetos').id

    if (!projetosCol.fields.getByName('grupo')) {
      projetosCol.fields.add(
        new RelationField({
          name: 'grupo',
          collectionId: gruposColId,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!projetosCol.fields.getByName('modo_execucao')) {
      projetosCol.fields.add(
        new SelectField({
          name: 'modo_execucao',
          values: ['direta', 'terceirizada_parcial', 'terceirizada_integral'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!projetosCol.fields.getByName('descricao_delegada')) {
      projetosCol.fields.add(
        new TextField({
          name: 'descricao_delegada',
          required: false,
        }),
      )
    }

    app.save(projetosCol)

    // Índice para campo grupo em projetos
    try {
      projetosCol.addIndex('idx_projetos_grupo', false, 'grupo', '')
      app.save(projetosCol)
    } catch (_) {}

    // 3. Migração retroativa IDEMPOTENTE:
    // Para cada projeto existente sem grupo, criar ou vincular o grupo de projetos
    const projetosExistentes = app.findRecordsByFilter('projetos', '', 'created', 500, 0)
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    const prefixoGPRBase = 'GPR-' + new Date().getFullYear() + '-'
    let proximoSeqGpr = 1

    // Buscar maior sequencial GPR já existente
    try {
      const gruposDoAno = app.findRecordsByFilter(
        'grupos_projetos',
        "codigo ~ '" + prefixoGPRBase + "'",
        '-codigo',
        1,
        0,
      )
      if (gruposDoAno.length > 0) {
        const ult = gruposDoAno[0].getString('codigo')
        const partes = ult.split('-')
        const num = parseInt(partes[2], 10)
        if (!isNaN(num)) proximoSeqGpr = num + 1
      }
    } catch (_) {}

    for (let i = 0; i < projetosExistentes.length; i++) {
      const prj = projetosExistentes[i]
      let grupoId = prj.getString('grupo')
      const contratoServicoIdPrj = prj.getString('contrato_servico')
      const propostaIdPrj = prj.getString('proposta')
      const empresaIdPrj = prj.getString('empresa')
      const clientePfIdPrj = prj.getString('cliente_pf')
      const valorPrj = prj.getFloat('valor_total') || 0
      const nomePrj = prj.getString('nome') || prj.getString('codigo')
      const prjCodigo = prj.getString('codigo')

      // Definir modo de execução padrão caso não preenchido
      if (!prj.getString('modo_execucao')) {
        prj.set('modo_execucao', 'direta')
      }

      if (!grupoId) {
        // Verificar se já existe um grupo vinculado ao mesmo contrato de serviço
        let grupoExistente = null
        if (contratoServicoIdPrj) {
          try {
            const achados = app.findRecordsByFilter(
              'grupos_projetos',
              "contrato_servico = '" + contratoServicoIdPrj + "'",
              '-created',
              1,
              0,
            )
            if (achados.length > 0) {
              grupoExistente = achados[0]
            }
          } catch (_) {}
        }

        if (!grupoExistente && propostaIdPrj) {
          try {
            const achadosProp = app.findRecordsByFilter(
              'grupos_projetos',
              "proposta = '" + propostaIdPrj + "'",
              '-created',
              1,
              0,
            )
            if (achadosProp.length > 0) {
              grupoExistente = achadosProp[0]
            }
          } catch (_) {}
        }

        if (grupoExistente) {
          prj.set('grupo', grupoExistente.id)
          app.save(prj)
        } else {
          // Criar novo grupo de projetos retroativo
          const seqStr = ('0000' + proximoSeqGpr).slice(-4)
          const codGPR = prefixoGPRBase + seqStr
          proximoSeqGpr++

          const novoGrupo = new Record(gruposCol)
          novoGrupo.set('codigo', codGPR)
          novoGrupo.set('nome', 'Grupo: ' + nomePrj)
          novoGrupo.set('descricao', 'Grupo de projetos gerado via migração retroativa Bloco 4')
          if (contratoServicoIdPrj) novoGrupo.set('contrato_servico', contratoServicoIdPrj)
          if (propostaIdPrj) novoGrupo.set('proposta', propostaIdPrj)
          if (empresaIdPrj) novoGrupo.set('empresa', empresaIdPrj)
          if (clientePfIdPrj) novoGrupo.set('cliente_pf', clientePfIdPrj)
          novoGrupo.set('status', prj.getString('status') === 'concluido' ? 'concluido' : 'ativo')
          novoGrupo.set('valor_total', valorPrj)
          app.save(novoGrupo)

          prj.set('grupo', novoGrupo.id)
          app.save(prj)

          // Registrar auditoria do backfill
          try {
            const aRec = new Record(auditCol)
            aRec.set('acao', 'CRIACAO_RETROATIVA_GRUPO_PROJETOS')
            aRec.set('entidade', 'grupos_projetos')
            aRec.set('registro_id', novoGrupo.id)
            aRec.set('detalhes', {
              mensagem:
                'Grupo de projetos ' +
                codGPR +
                ' criado retroativamente para o projeto existente ' +
                prjCodigo,
              grupo_codigo: codGPR,
              projeto_codigo: prjCodigo,
              projeto_id: prj.id,
              contrato_servico: contratoServicoIdPrj,
              valor: valorPrj,
            })
            app.save(aRec)
          } catch (_) {}
        }
      } else {
        app.save(prj)
      }
    }
  },
  (app) => {
    // Reversão
    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      projetosCol.removeIndex('idx_projetos_grupo')
      app.save(projetosCol)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('grupos_projetos')
      app.delete(col)
    } catch (_) {}
  },
)
