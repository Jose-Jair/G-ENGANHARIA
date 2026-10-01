// Migração 0023: Suporte à Etapa 10 — Exportações e Relatórios
// - Registra parâmetros padrão caso necessário para exportação e dossiê
migrate(
  (app) => {
    // Parâmetro de configuração do sistema para exportação e dossiê de projetos
    try {
      const parametros = app.findCollectionByNameOrId('parametros')

      try {
        app.findFirstRecordByData('parametros', 'chave', 'empresa_nome_sistema')
      } catch (_) {
        const rec = new Record(parametros)
        rec.set('chave', 'empresa_nome_sistema')
        rec.set('valor', 'Gestão de Projetos de Engenharia — Intermediação Técnica')
        rec.set(
          'descricao',
          'Nome institucional exibido no cabeçalho do dossiê consolidado do projeto',
        )
        app.save(rec)
      }

      try {
        app.findFirstRecordByData('parametros', 'chave', 'exportacao_csv_delimitador')
      } catch (_) {
        const rec = new Record(parametros)
        rec.set('chave', 'exportacao_csv_delimitador')
        rec.set('valor', ';')
        rec.set('descricao', 'Separador padrão para exportações CSV (padrão Excel Brasil: ;)')
        app.save(rec)
      }
    } catch (err) {
      console.log('Erro na migracao 0023: ' + err)
    }
  },
  (app) => {
    try {
      const rec1 = app.findFirstRecordByData('parametros', 'chave', 'empresa_nome_sistema')
      app.delete(rec1)
    } catch (_) {}
    try {
      const rec2 = app.findFirstRecordByData('parametros', 'chave', 'exportacao_csv_delimitador')
      app.delete(rec2)
    } catch (_) {}
  },
)
