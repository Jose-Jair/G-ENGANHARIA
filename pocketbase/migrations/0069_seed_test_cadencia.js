migrate(
  (app) => {
    // 1. Criar empresa de teste
    const empCol = app.findCollectionByNameOrId('empresas')
    const emp = new Record(empCol)
    emp.set('razao_social', 'EMPRESA TESTE CADENCIA QA LTDA')
    emp.set('nome_fantasia', 'QA Cadencia Teste')
    emp.set('cnpj', '12.345.678/0001-99')
    emp.set('etapa_funil', 'em_cadencia')
    emp.set('curva', 'A')
    emp.set('status', 'ativa')
    app.save(emp)

    // 2. Criar Toque 1 agendado
    const toquesCol = app.findCollectionByNameOrId('toques')
    const t1 = new Record(toquesCol)
    t1.set('empresa', emp.id)
    t1.set('numero_toque', 1)
    t1.set('canal', 'email')
    t1.set('status', 'agendado')
    t1.set('data_prevista', '2026-10-15 12:00:00.000Z')
    t1.set('observacao', 'Toque 1 teste inicial')
    app.save(t1)

    // 3. Criar sugestão de teste
    const sugCol = app.findCollectionByNameOrId('sugestoes_funil')
    const sug = new Record(sugCol)
    sug.set('razao_social', 'SUGESTAO QA PROSPECCAO LTDA')
    sug.set('fonte', 'planilha')
    sug.set('status', 'pendente')
    sug.set('orgao_contrato', 'Prefeitura de Teste QA')
    sug.set('numero_contrato', 'CT-QA-2026')
    sug.set('objeto_contrato', 'Obra de pavimentação teste QA')
    sug.set('valor_estimado', 1500000)
    app.save(sug)
  },
  (app) => {
    // Reverter/limpar
    try {
      const e = app.findFirstRecordByData(
        'empresas',
        'razao_social',
        'EMPRESA TESTE CADENCIA QA LTDA',
      )
      if (e) {
        const toques = app.findRecordsByFilter('toques', "empresa = '" + e.id + "'", '', 10, 0)
        for (let i = 0; i < toques.length; i++) app.delete(toques[i])
        app.delete(e)
      }
      const s = app.findFirstRecordByData(
        'sugestoes_funil',
        'razao_social',
        'SUGESTAO QA PROSPECCAO LTDA',
      )
      if (s) app.delete(s)
    } catch (_) {}
  },
)
