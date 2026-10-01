migrate(
  (app) => {
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const usersId = '_pb_users_auth_'
    const contratosId = app.findCollectionByNameOrId('contratos').id

    // 1. Coleção sugestoes_funil
    // Destinada a armazenar sugestões vindas de planilha ou PNCP
    // Acesso: Admin e Comercial
    let sugestoesCol
    try {
      sugestoesCol = app.findCollectionByNameOrId('sugestoes_funil')
    } catch (_) {
      sugestoesCol = new Collection({
        name: 'sugestoes_funil',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        fields: [
          { name: 'razao_social', type: 'text', required: true },
          { name: 'nome_fantasia', type: 'text' },
          { name: 'cnpj', type: 'text' },
          { name: 'uf', type: 'text' },
          { name: 'municipio', type: 'text' },
          { name: 'email', type: 'text' },
          { name: 'telefone', type: 'text' },
          { name: 'cnae', type: 'text' },
          { name: 'porte', type: 'text' },
          { name: 'orgao_contrato', type: 'text' },
          { name: 'numero_contrato', type: 'text' },
          { name: 'objeto_contrato', type: 'text' },
          { name: 'valor_estimado', type: 'number' },
          {
            name: 'fonte',
            type: 'select',
            values: ['planilha', 'pncp', 'manual'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aprovada_para_inclusao', 'incorporada', 'descartada'],
            maxSelect: 1,
          },
          { name: 'motivo_descarte', type: 'text' },
          { name: 'observacoes', type: 'text' },
          {
            name: 'empresa_criada',
            type: 'relation',
            collectionId: empresasId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'decidido_por',
            type: 'relation',
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_decisao', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sugestoes_status ON sugestoes_funil (status)',
          'CREATE INDEX idx_sugestoes_cnpj ON sugestoes_funil (cnpj)',
          'CREATE INDEX idx_sugestoes_fonte ON sugestoes_funil (fonte)',
        ],
      })
      app.save(sugestoesCol)
    }

    // 2. Coleção reativacoes_sugeridas
    // Sugestões geradas quando uma empresa em nutrição mensal ou inativa recebe um novo contrato ativo
    let reativacoesCol
    try {
      reativacoesCol = app.findCollectionByNameOrId('reativacoes_sugeridas')
    } catch (_) {
      reativacoesCol = new Collection({
        name: 'reativacoes_sugeridas',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        fields: [
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'contrato',
            type: 'relation',
            collectionId: contratosId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'contrato_numero', type: 'text' },
          { name: 'contrato_orgao', type: 'text' },
          { name: 'contrato_valor', type: 'number' },
          { name: 'etapa_origem', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'aceita', 'descartada'],
            maxSelect: 1,
          },
          { name: 'destino_aceito', type: 'text' },
          { name: 'observacao_decisao', type: 'text' },
          {
            name: 'decidido_por',
            type: 'relation',
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_decisao', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_reativacoes_empresa ON reativacoes_sugeridas (empresa)',
          'CREATE INDEX idx_reativacoes_status ON reativacoes_sugeridas (status)',
        ],
      })
      app.save(reativacoesCol)
    }

    // 3. Ajustar campos na tabela empresas se necessário:
    // Adicionar proxima_acao_data, proxima_acao_descricao, etapa_anterior para suporte de restauração
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      if (!empresas.fields.getByName('proxima_acao_data')) {
        empresas.fields.add(new DateField({ name: 'proxima_acao_data' }))
      }
      if (!empresas.fields.getByName('proxima_acao_desc')) {
        empresas.fields.add(new TextField({ name: 'proxima_acao_desc' }))
      }
      if (!empresas.fields.getByName('etapa_anterior')) {
        empresas.fields.add(new TextField({ name: 'etapa_anterior' }))
      }
      app.save(empresas)
    } catch (e) {
      console.log('Erro ao adicionar campos extras em empresas: ' + e)
    }

    // 4. Regras estritas de segurança em nao_contatar:
    // Comercial e Admin incluem; remoção só pelo Admin
    try {
      const naoContatar = app.findCollectionByNameOrId('nao_contatar')
      naoContatar.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      naoContatar.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      naoContatar.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      naoContatar.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      naoContatar.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(naoContatar)
    } catch (e) {
      console.log('Erro ao atualizar regras de nao_contatar: ' + e)
    }

    // 5. Parâmetros de Pesos e Cálculo do Score da Curva ABC
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const defaultParams = [
      {
        chave: 'pesos_score_curva',
        valor: JSON.stringify({
          peso_valor: 40,
          peso_vigencia: 25,
          peso_qtd_contratos: 20,
          peso_aderencia_disciplinas: 15,
        }),
        descricao:
          'Pesos em percentual (soma = 100) para cálculo do score de qualificação da empresa',
      },
      {
        chave: 'faixa_corte_curva_a',
        valor: '5000000',
        descricao: 'Valor total mínimo de contratos ativos para enquadramento na Curva A (R$)',
      },
      {
        chave: 'faixa_corte_curva_b',
        valor: '1000000',
        descricao: 'Valor total mínimo de contratos ativos para enquadramento na Curva B (R$)',
      },
    ]

    for (const p of defaultParams) {
      try {
        app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        const r = new Record(parametrosCol)
        r.set('chave', p.chave)
        r.set('valor', p.valor)
        r.set('descricao', p.descricao)
        app.save(r)
      }
    }
  },
  (app) => {
    ;['reativacoes_sugeridas', 'sugestoes_funil'].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
