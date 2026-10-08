migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const clientesPfId = app.findCollectionByNameOrId('clientes_pf').id
    const contratosServicoId = app.findCollectionByNameOrId('contratos_servico').id
    const projetosId = app.findCollectionByNameOrId('projetos').id
    const gruposColId = app.findCollectionByNameOrId('grupos_projetos').id
    const executoresId = app.findCollectionByNameOrId('executores').id
    const propostasId = app.findCollectionByNameOrId('propostas').id

    // 1. Atualizar coleção 'cotacoes' para suportar eixo no PROJETO e GRUPO
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')

    if (!cotacoesCol.fields.getByName('projeto')) {
      cotacoesCol.fields.add(
        new RelationField({
          name: 'projeto',
          collectionId: projetosId,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!cotacoesCol.fields.getByName('grupo')) {
      cotacoesCol.fields.add(
        new RelationField({
          name: 'grupo',
          collectionId: gruposColId,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Campo para registrar respostas recebidas fora do sistema (canal, justificativa)
    if (!cotacoesCol.fields.getByName('resposta_externa')) {
      cotacoesCol.fields.add(
        new BoolField({
          name: 'resposta_externa',
        }),
      )
    }

    if (!cotacoesCol.fields.getByName('registrado_por')) {
      cotacoesCol.fields.add(
        new RelationField({
          name: 'registrado_por',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Regras de RLS de cotacoes:
    // Admin e Gestor: gerenciam (create, update, delete)
    // Comercial e Financeiro: leem
    // Executor externo: NÃO acessa cotacoes via login; responde apenas via token público
    cotacoesCol.listRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'))"
    cotacoesCol.viewRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'))"
    cotacoesCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    cotacoesCol.updateRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor'))"
    cotacoesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    app.save(cotacoesCol)

    // Índices de cotacoes para projeto e grupo
    try {
      cotacoesCol.addIndex('idx_cotacoes_projeto', false, 'projeto', '')
      app.save(cotacoesCol)
    } catch (_) {}
    try {
      cotacoesCol.addIndex('idx_cotacoes_grupo', false, 'grupo', '')
      app.save(cotacoesCol)
    } catch (_) {}

    // Migração retroativa idempotente em cotacoes: se tiver etapa mas não tiver projeto, preencher projeto da etapa
    try {
      const cotacoesLegadas = app.findRecordsByFilter(
        'cotacoes',
        "projeto = '' && etapa != ''",
        'created',
        500,
        0,
      )
      for (let i = 0; i < cotacoesLegadas.length; i++) {
        const c = cotacoesLegadas[i]
        const etapaId = c.getString('etapa')
        if (etapaId) {
          try {
            const etapaRec = app.findRecordById('projeto_etapas', etapaId)
            const prjId = etapaRec.getString('projeto')
            if (prjId) {
              c.set('projeto', prjId)
              try {
                const prjRec = app.findRecordById('projetos', prjId)
                const grpId = prjRec.getString('grupo')
                if (grpId) c.set('grupo', grpId)
              } catch (_) {}
              app.save(c)
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Criar coleção 'subcontratos'
    let subcontratosCol
    try {
      subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    } catch (_) {
      subcontratosCol = new Collection({
        name: 'subcontratos',
        type: 'base',
        listRule:
          "token_assinatura != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'))",
        viewRule:
          "token_assinatura != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro'))",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "token_assinatura != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor'))",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'numero', type: 'text', required: true }, // SUB-AAAA-NNNN
          {
            name: 'projeto',
            type: 'relation',
            collectionId: projetosId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'grupo',
            type: 'relation',
            collectionId: gruposColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'contrato_servico_origem',
            type: 'relation',
            collectionId: contratosServicoId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'executor',
            type: 'relation',
            collectionId: executoresId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'cotacao',
            type: 'relation',
            collectionId: cotacoesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'modo_execucao',
            type: 'select',
            values: ['terceirizada_parcial', 'terceirizada_integral'],
            maxSelect: 1,
            required: true,
          },
          { name: 'descricao_escopo', type: 'text', required: false },
          { name: 'descricao_delegada', type: 'text', required: false },
          { name: 'valor_total', type: 'number', required: true },
          { name: 'prazo_dias', type: 'number', required: false },
          { name: 'nota_prazo', type: 'text', required: false },
          { name: 'clausulas_texto', type: 'text', required: false },
          { name: 'condicoes_pagamento', type: 'text', required: false },
          { name: 'parcelas_json', type: 'json', required: false },
          {
            name: 'status',
            type: 'select',
            values: ['minuta', 'aguardando_assinatura', 'assinado', 'cancelado'],
            maxSelect: 1,
            required: false,
          },
          { name: 'token_assinatura', type: 'text', required: false },
          // Assinatura digital do executor
          { name: 'executor_nome_assinante', type: 'text', required: false },
          { name: 'executor_documento_assinante', type: 'text', required: false },
          { name: 'data_assinatura_executor', type: 'date', required: false },
          { name: 'executor_ip', type: 'text', required: false },
          { name: 'executor_user_agent', type: 'text', required: false },
          { name: 'executor_declaracao', type: 'bool', required: false },
          { name: 'executor_hash', type: 'text', required: false },
          // Gestor/Admin emitente
          {
            name: 'emitido_por',
            type: 'relation',
            collectionId: usersId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'data_emissao', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_subcontratos_numero ON subcontratos (numero)',
          'CREATE INDEX idx_subcontratos_projeto ON subcontratos (projeto)',
          'CREATE INDEX idx_subcontratos_executor ON subcontratos (executor)',
          'CREATE INDEX idx_subcontratos_status ON subcontratos (status)',
          'CREATE INDEX idx_subcontratos_token ON subcontratos (token_assinatura)',
        ],
      })
      app.save(subcontratosCol)
    }

    // 3. Adicionar campo 'subcontrato' em contas a pagar
    const contasCol = app.findCollectionByNameOrId('contas')
    if (!contasCol.fields.getByName('subcontrato')) {
      contasCol.fields.add(
        new RelationField({
          name: 'subcontrato',
          collectionId: subcontratosCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(contasCol)
    }

    // 4. Parâmetros editáveis do Bloco 5 em Administração:
    // - subcontrato_clausulas_padrao
    // - texto_padrao_whatsapp_cotacao_executor
    // - texto_padrao_whatsapp_subcontrato_executor
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const parametrosBloco5 = [
      {
        chave: 'subcontrato_clausulas_padrao',
        valor:
          'TERMO DE SUBCONTRATAÇÃO E PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA GMAIS\n\n' +
          'CLÁUSULA PRIMEIRA — DO OBJETO E VINCULAÇÃO AO CONTRATO PRINCIPAL\n' +
          'O presente Termo tem por objeto a subcontratação, mediada pela G+ ENGENHARIA ("CONTRATANTE"), do EXECUTOR externo homologado ("SUBCONTRATADO") para execução técnica do escopo estipulado no PROJETO DE REFERÊNCIA, integrante do Grupo de Projetos do Contrato Principal de Prestação de Serviços.\n' +
          'Parágrafo Único: O SUBCONTRATADO declara plena ciência dos termos, especificações e condições técnicas do Contrato Original da G+, comprometendo-se ao estrito cumprimento de todas as obrigações e cláusulas pertinentes à sua atuação.\n\n' +
          'CLÁUSULA SEGUNDA — DA DURAÇÃO E DOS PRAZOS DE EXECUÇÃO\n' +
          'Conforme regramento corporativo, o projeto subcontratado terá a mesma duração do contrato original de referência ({prazo_dias_contrato} dias), respeitados os marcos intermediários e as datas de entrega fixadas na Ordem de Serviço emitida pela coordenação de projetos.\n\n' +
          'CLÁUSULA TERCEIRA — DO VALOR E DAS CONDIÇÕES DE PAGAMENTO\n' +
          'Pelos serviços prestados, a CONTRATANTE pagará ao SUBCONTRATADO o valor total de {valor_subcontrato}, distribuído nas parcelas e gatilhos de entrega pactuados na ficha de contratação, mediante prévia validação técnica das etapas e emissão da correspondente documentação fiscal.\n\n' +
          'CLÁUSULA QUARTA — DA RESPONSABILIDADE TÉCNICA E SIGILO\n' +
          'O SUBCONTRATADO responderá integralmente pela qualidade, precisão dos cálculos e conformidade normativa dos projetos entregues, devendo emitir e registrar tempestivamente a devida ART/RRT/TRT junto ao conselho profissional competente. Obriga-se ainda a guardar sigilo absoluto sobre informações, dados e metodologias de trabalho acessados.\n\n' +
          'CLÁUSULA QUINTA — DA SUBCONTRATAÇÃO E VEDAÇÃO DE REPASSE\n' +
          'É expressamente vedado ao SUBCONTRATADO subcontratar ou repassar a terceiros, no todo ou em parte, os serviços assumidos por este instrumento sem prévia anuência formal por escrito da Diretoria da G+.\n\n' +
          'CLÁUSULA SEXTA — DO ACEITE ELETRÔNICO E ASSINATURA\n' +
          'As partes validam formalmente este termo mediante assinatura eletrônica rastreável, com aposição de declaração, carimbo de data/hora, endereço IP e hashes criptográficos, elegendo o foro da sede da CONTRATANTE para quaisquer dirimências.',
        descricao:
          'Modelo padrão de cláusulas do Termo de Subcontratação GMAIS ({numero_subcontrato}, {projeto_codigo}, {executor_nome}, {valor_subcontrato}, {prazo_dias_contrato}, {link_assinatura}).',
      },
      {
        chave: 'texto_padrao_whatsapp_cotacao_executor',
        valor:
          'Olá, {executor_nome}! A G+ Engenharia solicita cotação para o projeto {projeto_codigo} ({projeto_nome}). Prazo limite de resposta: {data_limite}. Acesse o link exclusivo para visualizar o escopo detalhado e enviar sua proposta: {link_cotacao}',
        descricao:
          'Texto padrão para convite de cotação enviado ao executor via WhatsApp ({executor_nome}, {projeto_codigo}, {projeto_nome}, {data_limite}, {link_cotacao}).',
      },
      {
        chave: 'texto_padrao_whatsapp_subcontrato_executor',
        valor:
          'Olá, {executor_nome}! Parabéns, sua proposta foi selecionada para o projeto {projeto_codigo}. O Termo de Subcontratação {numero_subcontrato} está pronto para sua assinatura eletrônica através do link seguro: {link_subcontrato}',
        descricao:
          'Texto padrão para envio do link de assinatura do Termo de Subcontratação via WhatsApp ({executor_nome}, {projeto_codigo}, {numero_subcontrato}, {link_subcontrato}).',
      },
    ]

    for (const p of parametrosBloco5) {
      try {
        const achado = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (achado) {
          achado.set('descricao', p.descricao)
          app.save(achado)
        }
      } catch (_) {
        const rec = new Record(parametrosCol)
        rec.set('chave', p.chave)
        rec.set('valor', p.valor)
        rec.set('descricao', p.descricao)
        app.save(rec)
      }
    }
  },
  (app) => {
    // Reversão
    try {
      const col = app.findCollectionByNameOrId('subcontratos')
      app.delete(col)
    } catch (_) {}
  },
)
