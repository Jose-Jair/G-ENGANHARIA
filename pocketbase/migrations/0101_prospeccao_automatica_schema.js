/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. COLEÇÃO: fontes_prospeccao
    // -------------------------------------------------------------------------
    let fontesCol
    try {
      fontesCol = app.findCollectionByNameOrId('fontes_prospeccao')
    } catch (_) {
      fontesCol = new Collection({
        name: 'fontes_prospeccao',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            values: ['api_externa', 'importador_csv', 'transparencia_sancoes'],
            maxSelect: 1,
            required: true,
          },
          { name: 'ativo', type: 'bool' },
          { name: 'cron_expressao', type: 'text' },
          { name: 'dias_janela', type: 'number' },
          { name: 'ufs', type: 'text' },
          { name: 'municipios', type: 'text' },
          { name: 'palavras_chave', type: 'text' },
          { name: 'cnaes', type: 'text' },
          { name: 'limite_por_execucao', type: 'number' },
          { name: 'endpoint_base', type: 'text' },
          { name: 'requer_chave', type: 'bool' },
          { name: 'chave_configurada', type: 'bool' },
          { name: 'aviso_configuracao', type: 'text' },
          { name: 'ultima_execucao', type: 'date' },
          { name: 'total_lidos', type: 'number' },
          { name: 'total_sugeridos', type: 'number' },
          { name: 'total_incorporados', type: 'number' },
          { name: 'ultimo_erro', type: 'text' },
          { name: 'config_extra', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_fontes_slug ON fontes_prospeccao (slug)',
          'CREATE INDEX idx_fontes_ativo ON fontes_prospeccao (ativo)',
        ],
      })
      app.save(fontesCol)
    }

    // -------------------------------------------------------------------------
    // 2. COLEÇÃO: lotes_prospeccao_auditoria
    // -------------------------------------------------------------------------
    const usersId = '_pb_users_auth_'
    let lotesCol
    try {
      lotesCol = app.findCollectionByNameOrId('lotes_prospeccao_auditoria')
    } catch (_) {
      lotesCol = new Collection({
        name: 'lotes_prospeccao_auditoria',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'fonte_slug', type: 'text', required: true },
          { name: 'fonte_nome', type: 'text', required: true },
          {
            name: 'tipo_execucao',
            type: 'select',
            values: ['cron_automatico', 'manual_admin', 'importacao_csv'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['em_andamento', 'sucesso', 'erro_parcial', 'falha'],
            maxSelect: 1,
            required: true,
          },
          { name: 'data_inicio', type: 'date', required: true },
          { name: 'data_fim', type: 'date' },
          { name: 'total_lidos', type: 'number' },
          { name: 'total_descartados_cpf', type: 'number' },
          { name: 'total_duplicados_dedupe', type: 'number' },
          { name: 'total_reativacoes_sugeridas', type: 'number' },
          { name: 'total_novas_sugestoes', type: 'number' },
          { name: 'total_incorporados', type: 'number' },
          { name: 'creditos_ia_gastos', type: 'number' },
          { name: 'erro_detalhe', type: 'text' },
          { name: 'parametros_aplicados', type: 'json' },
          { name: 'executado_por', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_lotes_fonte ON lotes_prospeccao_auditoria (fonte_slug)',
          'CREATE INDEX idx_lotes_status ON lotes_prospeccao_auditoria (status)',
          'CREATE INDEX idx_lotes_data_inicio ON lotes_prospeccao_auditoria (data_inicio DESC)',
        ],
      })
      app.save(lotesCol)
    }

    // -------------------------------------------------------------------------
    // 3. CAMPOS ADITIVOS EM sugestoes_funil
    // -------------------------------------------------------------------------
    try {
      const sugCol = app.findCollectionByNameOrId('sugestoes_funil')
      const novosCampos = [
        { name: 'score_relevancia', type: 'number' },
        { name: 'score_curva_provisorio', type: 'number' },
        { name: 'curva_provisoria', type: 'text' }, // A, B ou C
        { name: 'link_fonte', type: 'text' },
        { name: 'vigencia_inicio', type: 'date' },
        { name: 'vigencia_fim', type: 'date' },
        { name: 'fonte_prospeccao_slug', type: 'text' },
        { name: 'lote_auditoria_id', type: 'text' },
        { name: 'status_sancao', type: 'text' }, // 'nao_verificada', 'sem_sancao', 'sancionada'
        { name: 'detalhe_sancao', type: 'text' },
        { name: 'cnpj_enriquecido', type: 'bool' },
        { name: 'dados_enriquecimento', type: 'json' },
        { name: 'justificativa_ia', type: 'text' },
      ]

      for (let i = 0; i < novosCampos.length; i++) {
        const c = novosCampos[i]
        if (!sugCol.fields.getByName(c.name)) {
          if (c.type === 'number') {
            sugCol.fields.add(new NumberField({ name: c.name }))
          } else if (c.type === 'text') {
            sugCol.fields.add(new TextField({ name: c.name }))
          } else if (c.type === 'date') {
            sugCol.fields.add(new DateField({ name: c.name }))
          } else if (c.type === 'bool') {
            sugCol.fields.add(new BoolField({ name: c.name }))
          } else if (c.type === 'json') {
            sugCol.fields.add(new JSONField({ name: c.name }))
          }
        }
      }
      app.save(sugCol)
    } catch (e) {
      console.log('Erro ao atualizar campos de sugestoes_funil: ' + e)
    }

    // -------------------------------------------------------------------------
    // 4. CAMPOS ADITIVOS EM empresas (suporte a sanções e bloqueio de cadência)
    // -------------------------------------------------------------------------
    try {
      const empCol = app.findCollectionByNameOrId('empresas')
      const camposEmp = [
        { name: 'status_sancao', type: 'text' }, // 'nao_verificada', 'sem_sancao', 'sancionada'
        { name: 'sancao_detalhe', type: 'text' },
        { name: 'cadencia_bloqueada_sancao', type: 'bool' },
        { name: 'fonte_prospeccao_origem', type: 'text' },
      ]
      for (let i = 0; i < camposEmp.length; i++) {
        const c = camposEmp[i]
        if (!empCol.fields.getByName(c.name)) {
          if (c.type === 'text') {
            empCol.fields.add(new TextField({ name: c.name }))
          } else if (c.type === 'bool') {
            empCol.fields.add(new BoolField({ name: c.name }))
          }
        }
      }
      app.save(empCol)
    } catch (e) {
      console.log('Erro ao atualizar campos de empresas: ' + e)
    }

    // -------------------------------------------------------------------------
    // 5. SEED DAS FONTES INICIAIS (Idempotente)
    // -------------------------------------------------------------------------
    const fontesIniciais = [
      {
        nome: 'PNCP - Portal Nacional de Contratações Públicas',
        slug: 'pncp_contratos',
        tipo: 'api_externa',
        ativo: true,
        cron_expressao: '0 3 * * *', // Diário às 03:00
        dias_janela: 7,
        ufs: 'SP,RJ,MG,PR,SC,RS,DF,BA,PE,CE,GO',
        municipios: '',
        palavras_chave:
          'projeto executivo, projeto básico, elaboração de projetos, estrutural, elétrico, hidrossanitário, pavimentação, drenagem, orçamento, laudo, engenharia consultiva, gerenciamento de obras, supervisão',
        cnaes: '7111-1/00, 7112-0/00, 7119-7/99, 7410-2/00',
        limite_por_execucao: 50,
        endpoint_base: 'https://pncp.gov.br/api/consulta/v1/contratos',
        requer_chave: false,
        chave_configurada: true,
        aviso_configuracao: '',
        total_lidos: 0,
        total_sugeridos: 0,
        total_incorporados: 0,
        ultimo_erro: '',
      },
      {
        nome: 'Comprasnet Contratos (Governo Federal)',
        slug: 'comprasnet_contratos',
        tipo: 'importador_csv',
        ativo: true,
        cron_expressao: '',
        dias_janela: 30,
        ufs: '',
        municipios: '',
        palavras_chave:
          'projeto executivo, projeto básico, elaboração de projetos, estrutural, elétrico, hidrossanitário, pavimentação, drenagem, orçamento, laudo',
        cnaes: '7111-1/00, 7112-0/00, 7119-7/99, 7410-2/00',
        limite_por_execucao: 200,
        endpoint_base: '',
        requer_chave: false,
        chave_configurada: true,
        aviso_configuracao:
          'A API direta compras.dados.gov.br respondeu 404 (legada). Opera como importador de CSV na Administração, parseando o mesmo schema padrão.',
        total_lidos: 0,
        total_sugeridos: 0,
        total_incorporados: 0,
        ultimo_erro: '',
      },
      {
        nome: 'Portal da Transparência (CEIS / CNEP)',
        slug: 'portal_transparencia',
        tipo: 'transparencia_sancoes',
        ativo: false, // OBRIGATÓRIO: Desligado por padrão
        cron_expressao: '',
        dias_janela: 0,
        ufs: '',
        municipios: '',
        palavras_chave: '',
        cnaes: '',
        limite_por_execucao: 100,
        endpoint_base: 'https://api.portaldatransparencia.gov.br/api-de-dados',
        requer_chave: true,
        chave_configurada: false,
        aviso_configuracao:
          'Chave de API do Portal da Transparência (CGU) não configurada na variável/secreta PORTAL_TRANSPARENCIA_API_KEY. Fonte desativada até fornecimento da chave no painel.',
        total_lidos: 0,
        total_sugeridos: 0,
        total_incorporados: 0,
        ultimo_erro: '',
      },
    ]

    for (let f = 0; f < fontesIniciais.length; f++) {
      const fonteData = fontesIniciais[f]
      const existentes = app.findRecordsByFilter(
        'fontes_prospeccao',
        "slug = '" + fonteData.slug + "'",
        '',
        1,
        0,
      )
      if (existentes.length === 0) {
        const r = new Record(app.findCollectionByNameOrId('fontes_prospeccao'))
        r.set('nome', fonteData.nome)
        r.set('slug', fonteData.slug)
        r.set('tipo', fonteData.tipo)
        r.set('ativo', fonteData.ativo)
        r.set('cron_expressao', fonteData.cron_expressao)
        r.set('dias_janela', fonteData.dias_janela)
        r.set('ufs', fonteData.ufs)
        r.set('municipios', fonteData.municipios)
        r.set('palavras_chave', fonteData.palavras_chave)
        r.set('cnaes', fonteData.cnaes)
        r.set('limite_por_execucao', fonteData.limite_por_execucao)
        r.set('endpoint_base', fonteData.endpoint_base)
        r.set('requer_chave', fonteData.requer_chave)
        r.set('chave_configurada', fonteData.chave_configurada)
        r.set('aviso_configuracao', fonteData.aviso_configuracao)
        r.set('total_lidos', fonteData.total_lidos)
        r.set('total_sugeridos', fonteData.total_sugeridos)
        r.set('total_incorporados', fonteData.total_incorporados)
        r.set('ultimo_erro', fonteData.ultimo_erro)
        app.save(r)
      }
    }

    // -------------------------------------------------------------------------
    // 6. AGENTE IA NATIVO SKIP CLOUD (prospeccao-classificador)
    // -------------------------------------------------------------------------
    try {
      $ai.agents.delete(app, 'prospeccao-classificador')
    } catch (_) {}

    $ai.agents.define(app, {
      slug: 'prospeccao-classificador',
      name: 'Classificador de Contratos de Prospecção',
      description:
        'Classifica relevância técnica de contratos públicos de engenharia (0-100) e identifica aderência aos serviços da G+ Engenharia.',
      tier: 'fast',
      systemPrompt: `Você é o Auditor Especialista em Triagem de Contratos Públicos da G+ Gestão e Engenharia.
Sua missão é analisar o objeto de um contrato público e atribuir uma nota de relevância de 0 a 100 para prospecção de parcerias de engenharia consultiva, projetos e laudos.

CRITÉRIOS DE AVALIAÇÃO:
1. ALTA RELEVÂNCIA (70 a 100):
   - Elaboração de projetos executivos ou básicos de engenharia e arquitetura
   - Cálculos estruturais, instalações elétricas, hidrossanitárias, drenagem, pavimentação
   - Laudos técnicos, perícias, orçamentação e engenharia consultiva
   - Gerenciamento e supervisão de obras
2. MÉDIA RELEVÂNCIA (40 a 69):
   - Reformas com menção a projetos complementares
   - Manutenção predial com necessidade de engenharia especializada
   - Serviços topográficos e sondagens
3. BAIXA RELEVÂNCIA (0 a 39):
   - Execução pura de obras sem etapa de projeto/consultoria
   - Fornecimento de materiais, locação de máquinas, limpeza, vigilância, TI

SAÍDA EXCLUSIVAMENTE EM FORMATO JSON:
{
  "score": 0,
  "justificativa": "string concisa com 1 frase justificando a pontuação",
  "disciplinas_identificadas": ["string"],
  "aderente_gmais": true
}`,
      tools: [{ collection: 'fontes_prospeccao', perms: { list: true, read: true } }],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'G+ Engenharia atua em intermediação e coordenação de projetos executivos, complementares, laudos e orçamentos para parceiros demandantes públicos.',
          },
        },
      ],
    })

    // Parâmetro liga/desliga da IA de prospecção na Administração
    const paramCol = app.findCollectionByNameOrId('parametros')
    const jaParam = app.findRecordsByFilter('parametros', "chave = 'ia_prospeccao_ativa'", '', 1, 0)
    if (jaParam.length === 0) {
      const p = new Record(paramCol)
      p.set('chave', 'ia_prospeccao_ativa')
      p.set('valor', 'true')
      p.set(
        'descricao',
        'Habilita o uso do Agente IA Skip Cloud para classificação refinada de relevância de contratos na prospecção. Se desligado, usa dicionário fixo.',
      )
      app.save(p)
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'prospeccao-classificador')
    } catch (_) {}
    ;['lotes_prospeccao_auditoria', 'fontes_prospeccao'].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    })
  },
)
