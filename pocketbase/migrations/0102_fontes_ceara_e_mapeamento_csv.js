/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const fontesCol = app.findCollectionByNameOrId('fontes_prospeccao')

    // 1. Campo de mapeamento de colunas CSV para fontes do tipo importador_csv
    if (!fontesCol.fields.getByName('mapeamento_colunas')) {
      fontesCol.fields.add(new JSONField({ name: 'mapeamento_colunas' }))
      app.save(fontesCol)
    }

    // 2. Campo exercicio para filtros
    if (!fontesCol.fields.getByName('exercicio')) {
      fontesCol.fields.add(new NumberField({ name: 'exercicio' }))
      app.save(fontesCol)
    }

    // 3. Cadastrar Fonte TCE-CE (api_externa)
    const tceExistente = app.findRecordsByFilter(
      'fontes_prospeccao',
      "slug = 'tce_ce_contratacoes'",
      '',
      1,
      0,
    )
    if (tceExistente.length === 0) {
      const r = new Record(fontesCol)
      r.set('nome', 'TCE-CE - Tribunal de Contas do Estado do Ceará (SIM)')
      r.set('slug', 'tce_ce_contratacoes')
      r.set('tipo', 'api_externa')
      r.set('ativo', true)
      r.set('cron_expressao', '0 4 * * *') // Diário às 04:00
      r.set('dias_janela', 30)
      r.set('ufs', 'CE')
      r.set('municipios', '044') // Fortaleza como padrão
      r.set(
        'palavras_chave',
        'projeto executivo, projeto básico, elaboração de projetos, estrutural, elétrico, hidrossanitário, drenagem, pavimentação, engenharia consultiva, laudo, fiscalização, supervisão',
      )
      r.set('cnaes', '7111-1/00, 7112-0/00, 7119-7/99, 7410-2/00')
      r.set('limite_por_execucao', 50)
      r.set('endpoint_base', 'https://api-dados-abertos.tce.ce.gov.br/sim')
      r.set('requer_chave', false)
      r.set('chave_configurada', true)
      r.set('exercicio', 2024)
      r.set(
        'aviso_configuracao',
        'API aberta do Sistema de Informação Municipal (SIM) do TCE-CE. Filtro por código de município e período (data_inicio / data_fim).',
      )
      r.set('total_lidos', 0)
      r.set('total_sugeridos', 0)
      r.set('total_incorporados', 0)
      r.set('ultimo_erro', '')
      app.save(r)
    }

    // 4. Cadastrar Fonte Ceará Transparente (importador_csv com mapeamento de colunas)
    const cearaTranspExistente = app.findRecordsByFilter(
      'fontes_prospeccao',
      "slug = 'ceara_transparente_csv'",
      '',
      1,
      0,
    )
    if (cearaTranspExistente.length === 0) {
      const r = new Record(fontesCol)
      r.set('nome', 'Ceará Transparente (transparencia.ce.gov.br)')
      r.set('slug', 'ceara_transparente_csv')
      r.set('tipo', 'importador_csv')
      r.set('ativo', true)
      r.set('cron_expressao', '')
      r.set('dias_janela', 30)
      r.set('ufs', 'CE')
      r.set('municipios', '')
      r.set(
        'palavras_chave',
        'projeto executivo, projeto básico, elaboração de projetos, estrutural, elétrico, hidrossanitário, pavimentação, drenagem, laudo, supervisão',
      )
      r.set('cnaes', '7111-1/00, 7112-0/00, 7119-7/99, 7410-2/00')
      r.set('limite_por_execucao', 200)
      r.set('endpoint_base', 'https://transparencia.ce.gov.br')
      r.set('requer_chave', false)
      r.set('chave_configurada', true)
      r.set('exercicio', 2026)
      r.set(
        'aviso_configuracao',
        'O portal Ceará Transparente retornou HTTP 502 no probe do servidor. Opera como importador de CSV com mapeamento dinâmico de colunas configurável.',
      )
      r.set('mapeamento_colunas', {
        col_cnpj: 'cpf_cnpj_contratada',
        col_razao_social: 'nome_contratada',
        col_orgao: 'orgao_contratante',
        col_numero_contrato: 'numero_contrato',
        col_objeto: 'objeto_contrato',
        col_valor: 'valor_contrato',
        col_vigencia_inicio: 'data_inicio_vigencia',
        col_vigencia_fim: 'data_fim_vigencia',
      })
      r.set('total_lidos', 0)
      r.set('total_sugeridos', 0)
      r.set('total_incorporados', 0)
      r.set('ultimo_erro', '')
      app.save(r)
    }
  },
  (app) => {
    // Reversão
    try {
      const f1 = app.findFirstRecordByData('fontes_prospeccao', 'slug', 'tce_ce_contratacoes')
      app.delete(f1)
    } catch (_) {}
    try {
      const f2 = app.findFirstRecordByData('fontes_prospeccao', 'slug', 'ceara_transparente_csv')
      app.delete(f2)
    } catch (_) {}
  },
)
