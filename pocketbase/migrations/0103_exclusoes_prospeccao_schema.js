/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. COLEÇÃO: exclusoes_prospeccao (Lista própria de exclusão de prospecção)
    // -------------------------------------------------------------------------
    const usersId = '_pb_users_auth_'
    let exclusoesCol
    try {
      exclusoesCol = app.findCollectionByNameOrId('exclusoes_prospeccao')
    } catch (_) {
      exclusoesCol = new Collection({
        name: 'exclusoes_prospeccao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'cnpj', type: 'text' },
          { name: 'cnae', type: 'text' },
          { name: 'objeto_termo', type: 'text' },
          { name: 'razao_social', type: 'text' },
          { name: 'tipo_chave', type: 'text' }, // 'cnpj', 'cnae', 'objeto_termo', 'misto'
          { name: 'motivo_descarte', type: 'text' },
          { name: 'fonte_origem', type: 'text' }, // 'pncp', 'tce_ce', 'comprasnet', 'planilha', 'manual', etc.
          { name: 'sugestao_origem_id', type: 'text' },
          { name: 'descartado_por', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'data_descarte', type: 'date' },
          { name: 'ativo', type: 'bool' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_exclusoes_prospeccao_cnpj ON exclusoes_prospeccao (cnpj)',
          'CREATE INDEX idx_exclusoes_prospeccao_cnae ON exclusoes_prospeccao (cnae)',
          'CREATE INDEX idx_exclusoes_prospeccao_ativo ON exclusoes_prospeccao (ativo)',
        ],
      })
      app.save(exclusoesCol)
    }

    // -------------------------------------------------------------------------
    // 2. CAMPO ADITIVO EM nao_contatar: origem
    // Marca a origem dos registros (ex: 'opt_out_titular', 'descarte_prospeccao_legado', 'fim_funil')
    // para diferenciar opt-out LGPD real de descartes operacionais anteriores.
    // -------------------------------------------------------------------------
    try {
      const ncCol = app.findCollectionByNameOrId('nao_contatar')
      if (!ncCol.fields.getByName('origem')) {
        ncCol.fields.add(new TextField({ name: 'origem' }))
      }
      app.save(ncCol)
    } catch (e) {
      console.log('Erro ao adicionar campo origem em nao_contatar: ' + e)
    }

    // -------------------------------------------------------------------------
    // 3. MARCAÇÃO RETROATIVA (BACKFILL NÃO-DESTRUTIVO E IDEMPOTENTE)
    // Registros que já foram gravados na lista "Não contatar" por descarte de prospecção:
    // NÃO APAGAR. Apenas marcar origem = 'descarte_prospeccao_legado'.
    // -------------------------------------------------------------------------
    try {
      // 3.1 Registros cujo motivo inicia ou contém "Descarte prospecção"
      app
        .db()
        .newQuery(
          "UPDATE nao_contatar SET origem = 'descarte_prospeccao_legado' WHERE (origem IS NULL OR origem = '') AND motivo LIKE '%Descarte prospec%'",
        )
        .execute()

      // 3.2 Registros que não foram marcados e foram originados de opt-out/descadastro explícito
      app
        .db()
        .newQuery(
          "UPDATE nao_contatar SET origem = 'opt_out_titular' WHERE (origem IS NULL OR origem = '') AND (motivo LIKE '%Descadastro%' OR motivo LIKE '%opt-out%' OR motivo LIKE '%LGPD%')",
        )
        .execute()

      // 3.3 Registros que não possuem origem definida: marcar como 'legado_nao_contatar'
      app
        .db()
        .newQuery(
          "UPDATE nao_contatar SET origem = 'opt_out_titular' WHERE (origem IS NULL OR origem = '')",
        )
        .execute()
    } catch (e) {
      console.log('Erro na marcação retroativa de origem em nao_contatar: ' + e)
    }
  },
  (app) => {
    try {
      const exclusoesCol = app.findCollectionByNameOrId('exclusoes_prospeccao')
      app.delete(exclusoesCol)
    } catch (_) {}
  },
)
