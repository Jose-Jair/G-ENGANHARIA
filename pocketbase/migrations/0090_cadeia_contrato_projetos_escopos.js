migrate(
  (app) => {
    // =========================================================================
    // 1. COLEÇÃO: catalogo_escopos
    // Requisito 1: disciplina, nome, entregaveis_padrao (JSON), checklist_revisao (JSON), ativo
    // API rules: leitura Admin/Gestor/Financeiro, escrita só Admin
    // =========================================================================
    let escoposCol
    try {
      escoposCol = app.findCollectionByNameOrId('catalogo_escopos')
    } catch (_) {
      escoposCol = new Collection({
        name: 'catalogo_escopos',
        type: 'base',
        fields: [
          { name: 'disciplina', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          { name: 'entregaveis_padrao', type: 'json' },
          { name: 'checklist_revisao', type: 'json' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_catalogo_escopos_disc ON catalogo_escopos (disciplina)',
          'CREATE INDEX idx_catalogo_escopos_ativo ON catalogo_escopos (ativo)',
        ],
      })
      app.save(escoposCol)

      escoposCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      escoposCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')"
      escoposCol.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      escoposCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      escoposCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(escoposCol)
    }

    // =========================================================================
    // 2. SEED IDEMPOTENTE DERIVADO DAS DISCIPLINAS/ÁREAS REAIS DO SISTEMA
    // =========================================================================
    try {
      const areasExistentes = app.findRecordsByFilter(
        'areas_atuacao',
        'ativo = true',
        'ordem',
        100,
        0,
      )
      for (let i = 0; i < areasExistentes.length; i++) {
        const areaRec = areasExistentes[i]
        const nomeArea = areaRec.getString('nome')
        if (!nomeArea) continue

        // Buscar se já existe no catalogo_escopos
        const jaTem = app.findRecordsByFilter(
          'catalogo_escopos',
          "nome = '" + nomeArea.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (jaTem.length > 0) continue

        // Buscar entregáveis padrão reais cadastrados para esta área
        const entregaveisArea = app.findRecordsByFilter(
          'entregaveis_padrao',
          "area = '" + areaRec.id + "' && ativo = true",
          'ordem',
          50,
          0,
        )
        const listaEntregaveis = []
        for (let j = 0; j < entregaveisArea.length; j++) {
          listaEntregaveis.push({
            nome: entregaveisArea[j].getString('nome'),
            descricao: entregaveisArea[j].getString('descricao'),
            ordem: entregaveisArea[j].getInt('ordem') || j + 1,
          })
        }

        const checklistPadrao = [
          { item: 'Compatibilização com referências e normas vigentes', obrigatorio: true },
          { item: 'Verificação de memoriais e critérios de cálculo', obrigatorio: true },
          { item: 'Conformidade de formatos e pranchas', obrigatorio: true },
          { item: 'Anotação de Responsabilidade Técnica (ART/RRT) válida', obrigatorio: true },
        ]

        const novoEscopo = new Record(escoposCol)
        novoEscopo.set('disciplina', nomeArea)
        novoEscopo.set('nome', nomeArea)
        novoEscopo.set('entregaveis_padrao', listaEntregaveis)
        novoEscopo.set('checklist_revisao', checklistPadrao)
        novoEscopo.set('ativo', true)
        app.save(novoEscopo)
      }
    } catch (eSeed) {
      console.log('Aviso ao semear catalogo_escopos a partir de areas_atuacao: ' + eSeed)
    }

    // =========================================================================
    // 3. AMPLIAÇÃO DAS COLEÇÕES EXISTENTES PARA PACOTES DE TRABALHO E MARCOS
    // Requisito 2: Reutilizar/ampliar projeto_etapas e entregaveis
    // projeto_etapas:
    //   - is_pacote_trabalho (bool)
    //   - is_marco (bool)
    //   - valor_interno_referencia (number)
    //   - valor_vendido (number)
    //   - escopo_detalhado (text)
    //   - proposta_item_origem (relation -> proposta_itens)
    //   - parcela_origem (relation -> proposta_parcelas)
    //   - ordem_servico_ativa (relation -> ordens_servico)
    // =========================================================================
    const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
    const osCol = app.findCollectionByNameOrId('ordens_servico')
    const pItensCol = app.findCollectionByNameOrId('proposta_itens')
    const pParcelasCol = app.findCollectionByNameOrId('proposta_parcelas')

    if (!etapasCol.fields.getByName('is_pacote_trabalho')) {
      etapasCol.fields.add(new BoolField({ name: 'is_pacote_trabalho' }))
    }
    if (!etapasCol.fields.getByName('is_marco')) {
      etapasCol.fields.add(new BoolField({ name: 'is_marco' }))
    }
    if (!etapasCol.fields.getByName('valor_interno_referencia')) {
      etapasCol.fields.add(new NumberField({ name: 'valor_interno_referencia' }))
    }
    if (!etapasCol.fields.getByName('valor_vendido')) {
      etapasCol.fields.add(new NumberField({ name: 'valor_vendido' }))
    }
    if (!etapasCol.fields.getByName('escopo_detalhado')) {
      etapasCol.fields.add(new TextField({ name: 'escopo_detalhado' }))
    }
    if (!etapasCol.fields.getByName('proposta_item_origem')) {
      etapasCol.fields.add(
        new RelationField({
          name: 'proposta_item_origem',
          collectionId: pItensCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!etapasCol.fields.getByName('parcela_origem')) {
      etapasCol.fields.add(
        new RelationField({
          name: 'parcela_origem',
          collectionId: pParcelasCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!etapasCol.fields.getByName('ordem_servico_ativa')) {
      etapasCol.fields.add(
        new RelationField({
          name: 'ordem_servico_ativa',
          collectionId: osCol.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(etapasCol)

    // =========================================================================
    // 4. AMPLIAÇÃO DE entregaveis (Ciclo de Entrega e Vínculo ao Prestador/OS)
    // Requisito 5: pacote, titulo, descricao, prestador, prazo, revisor_interno,
    //              status, versao_atual, motivo_devolucao
    // Note que 'etapa' já existe (que agora representa o pacote).
    // Adicionamos:
    // - titulo (text)
    // - prestador (relation -> prestadores)
    // - ordem_servico (relation -> ordens_servico)
    // - prazo (date)
    // - revisor_interno (relation -> users)
    // - versao_atual (number)
    // - motivo_devolucao (text)
    // =========================================================================
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const prestadoresCol = app.findCollectionByNameOrId('prestadores')

    if (!entregaveisCol.fields.getByName('titulo')) {
      entregaveisCol.fields.add(new TextField({ name: 'titulo' }))
    }
    if (!entregaveisCol.fields.getByName('prestador')) {
      entregaveisCol.fields.add(
        new RelationField({
          name: 'prestador',
          collectionId: prestadoresCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!entregaveisCol.fields.getByName('ordem_servico')) {
      entregaveisCol.fields.add(
        new RelationField({
          name: 'ordem_servico',
          collectionId: osCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!entregaveisCol.fields.getByName('prazo')) {
      entregaveisCol.fields.add(new DateField({ name: 'prazo' }))
    }
    if (!entregaveisCol.fields.getByName('revisor_interno')) {
      entregaveisCol.fields.add(
        new RelationField({
          name: 'revisor_interno',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }
    if (!entregaveisCol.fields.getByName('versao_atual')) {
      entregaveisCol.fields.add(new NumberField({ name: 'versao_atual', onlyInt: true }))
    }
    if (!entregaveisCol.fields.getByName('motivo_devolucao')) {
      entregaveisCol.fields.add(new TextField({ name: 'motivo_devolucao' }))
    }
    app.save(entregaveisCol)

    // =========================================================================
    // 5. COLEÇÃO: entregaveis_versoes
    // Requisito 5: entregavel, numero_versao, arquivo, enviado_por, enviado_em,
    // status, motivo_devolucao, avaliado_por, avaliado_em
    // =========================================================================
    let versoesCol
    try {
      versoesCol = app.findCollectionByNameOrId('entregaveis_versoes')
    } catch (_) {
      versoesCol = new Collection({
        name: 'entregaveis_versoes',
        type: 'base',
        fields: [
          {
            name: 'entregavel',
            type: 'relation',
            collectionId: entregaveisCol.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'numero_versao', type: 'number', onlyInt: true, required: true },
          { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 52428800, protected: true },
          {
            name: 'enviado_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'enviado_em', type: 'date' },
          {
            name: 'status',
            type: 'select',
            values: ['submetido', 'em_revisao', 'aprovado', 'devolvido'],
            required: true,
          },
          { name: 'motivo_devolucao', type: 'text' },
          {
            name: 'avaliado_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'avaliado_em', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ent_vers_entregavel ON entregaveis_versoes (entregavel)',
          'CREATE INDEX idx_ent_vers_status ON entregaveis_versoes (status)',
        ],
      })
      app.save(versoesCol)

      versoesCol.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      versoesCol.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      versoesCol.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && entregavel.prestador.email = @request.auth.email))"
      versoesCol.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
      versoesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(versoesCol)
    }

    // =========================================================================
    // 6. ATUALIZAR REGRAS DE entregaveis PARA DAR SUPORTE AO PRESTADOR DO PORTAL
    // O prestador autenticado como executor vê apenas seus próprios entregáveis
    // =========================================================================
    entregaveisCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
    entregaveisCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
    entregaveisCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    entregaveisCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
    entregaveisCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(entregaveisCol)
  },
  (app) => {
    // Reversão
  },
)
