migrate(
  (app) => {
    // 1. Ampliar coleção `propostas` com campos para validação de integridade, aceite jurídico e negociação:
    // - aceite_ip (text)
    // - aceite_user_agent (text)
    // - aceite_declaracao (bool)
    // - aceite_hash (text)
    // - solicitacao_alteracao_texto (text)
    // - data_solicitacao_alteracao (date)
    // - dados_complementares_preenchidos (bool)
    // - contrato_servico (relation -> contratos_servico) - adicionado após criar contratos_servico
    const propostas = app.findCollectionByNameOrId('propostas')

    if (!propostas.fields.getByName('aceite_ip')) {
      propostas.fields.add(new TextField({ name: 'aceite_ip', required: false }))
    }
    if (!propostas.fields.getByName('aceite_user_agent')) {
      propostas.fields.add(new TextField({ name: 'aceite_user_agent', required: false }))
    }
    if (!propostas.fields.getByName('aceite_declaracao')) {
      propostas.fields.add(new BoolField({ name: 'aceite_declaracao', required: false }))
    }
    if (!propostas.fields.getByName('aceite_hash')) {
      propostas.fields.add(new TextField({ name: 'aceite_hash', required: false }))
    }
    if (!propostas.fields.getByName('solicitacao_alteracao_texto')) {
      propostas.fields.add(new TextField({ name: 'solicitacao_alteracao_texto', required: false }))
    }
    if (!propostas.fields.getByName('data_solicitacao_alteracao')) {
      propostas.fields.add(new DateField({ name: 'data_solicitacao_alteracao', required: false }))
    }
    if (!propostas.fields.getByName('dados_complementares_preenchidos')) {
      propostas.fields.add(
        new BoolField({ name: 'dados_complementares_preenchidos', required: false }),
      )
    }

    app.save(propostas)

    // 2. Criar coleção `contratos_servico`
    // IMPORTANTE: a coleção `contratos` existente guarda contratos públicos do parceiro demandante.
    // Esta nova coleção `contratos_servico` é para a prestação de serviços de engenharia com os clientes da G+.
    const usersColId = '_pb_users_auth_'
    const empresasColId = app.findCollectionByNameOrId('empresas').id
    const clientesPfColId = app.findCollectionByNameOrId('clientes_pf').id
    const propostasColId = propostas.id

    let contratosServicoCol
    try {
      contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')
    } catch (_) {
      contratosServicoCol = new Collection({
        name: 'contratos_servico',
        type: 'base',
        listRule:
          "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && @request.query.token = token_assinatura_cliente)",
        viewRule:
          "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro')) || (token_assinatura_cliente != '' && (@request.query.token = token_assinatura_cliente || token_assinatura_cliente = @request.headers.x_token_assinatura))",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')",
        updateRule:
          "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')) || (token_assinatura_cliente != '' && token_assinatura_cliente = @request.body.token_assinatura_cliente)",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'numero', type: 'text', required: true }, // CTR-AAAA-NNNN
          {
            name: 'proposta',
            type: 'relation',
            collectionId: propostasColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'empresa',
            type: 'relation',
            collectionId: empresasColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'cliente_pf',
            type: 'relation',
            collectionId: clientesPfColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'objeto', type: 'text', required: true },
          { name: 'valor_total', type: 'number', required: true },
          { name: 'prazo_dias', type: 'number', required: false },
          { name: 'nota_prazo', type: 'text', required: false },
          { name: 'clausulas_texto', type: 'text', required: false },
          { name: 'parcelas_json', type: 'json', required: false },
          {
            name: 'status',
            type: 'select',
            values: [
              'aguardando_assinatura_admin',
              'aguardando_assinatura_cliente',
              'assinado',
              'cancelado',
            ],
            maxSelect: 1,
            required: true,
          },
          // Assinatura Admin
          {
            name: 'assinante_admin',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'data_assinatura_admin', type: 'date', required: false },
          { name: 'admin_ip', type: 'text', required: false },
          { name: 'admin_user_agent', type: 'text', required: false },
          { name: 'admin_declaracao', type: 'bool', required: false },
          { name: 'admin_hash', type: 'text', required: false },
          // Assinatura Cliente
          { name: 'token_assinatura_cliente', type: 'text', required: false },
          { name: 'cliente_nome_assinante', type: 'text', required: false },
          { name: 'cliente_documento_assinante', type: 'text', required: false },
          { name: 'data_assinatura_cliente', type: 'date', required: false },
          { name: 'cliente_ip', type: 'text', required: false },
          { name: 'cliente_user_agent', type: 'text', required: false },
          { name: 'cliente_declaracao', type: 'bool', required: false },
          { name: 'cliente_hash', type: 'text', required: false },
          // Arquivo PDF final assinado (opcional / upload)
          {
            name: 'arquivo_pdf_assinado',
            type: 'file',
            maxSelect: 1,
            maxSize: 15728640, // 15MB
            mimeTypes: ['application/pdf'],
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_contratos_servico_numero ON contratos_servico (numero)',
          'CREATE INDEX idx_contratos_servico_proposta ON contratos_servico (proposta)',
          'CREATE INDEX idx_contratos_servico_status ON contratos_servico (status)',
        ],
      })
      app.save(contratosServicoCol)
    }

    // 3. Adicionar relação `contrato_servico` na coleção `propostas`
    const contratosServicoId = app.findCollectionByNameOrId('contratos_servico').id
    if (!propostas.fields.getByName('contrato_servico')) {
      propostas.fields.add(
        new RelationField({
          name: 'contrato_servico',
          collectionId: contratosServicoId,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(propostas)
    }

    // 4. Parâmetros padrão editáveis no menu Administração:
    // - texto_padrao_whatsapp_proposta
    // - texto_padrao_email_proposta
    // - contrato_servico_clausulas_padrao
    const parametrosCol = app.findCollectionByNameOrId('parametros')
    const novosParametros = [
      {
        chave: 'texto_padrao_whatsapp_proposta',
        valor:
          'Olá, {nome}! Tudo bem?\n\n' +
          'Aqui é da equipe da G+ Engenharia. Conforme conversamos, elaboramos a proposta comercial {numero} para o empreendimento "{empreendimento}", no valor total de {valor}.\n\n' +
          'Você pode visualizar os detalhes técnicos, prazos, condições e formalizar o aceite eletrônico de forma rápida e segura através do link abaixo:\n\n' +
          '{link_proposta}\n\n' +
          'Ficamos à disposição para esclarecer quaisquer dúvidas ou realizar ajustes caso necessário!',
        descricao:
          'Texto padrão sugerido para envio de proposta ao cliente via WhatsApp (editável em Administração). Variáveis: {nome}, {numero}, {empreendimento}, {valor}, {validade}, {link_proposta}',
      },
      {
        chave: 'texto_padrao_email_proposta',
        valor:
          'Prezado(a) {nome},\n\n' +
          'Agradecemos a oportunidade de apresentar nossa proposta comercial para o empreendimento "{empreendimento}".\n\n' +
          'Resumo da Proposta {numero}:\n' +
          '• Objeto: {objeto}\n' +
          '• Valor Global: {valor}\n' +
          '• Prazo de Execução: {prazo}\n' +
          '• Validade da Proposta: até {validade}\n\n' +
          'Para acessar o documento completo com detalhamento dos entregáveis técnicos e realizar o aceite eletrônico seguro, acesse o link oficial:\n\n' +
          '{link_proposta}\n\n' +
          'Atenciosamente,\n' +
          'G+ Engenharia Consultiva e Projetos',
        descricao:
          'Texto padrão e corpo para envio de proposta por e-mail transacional ao cliente (editável em Administração). Variáveis: {nome}, {numero}, {empreendimento}, {objeto}, {valor}, {prazo}, {validade}, {link_proposta}',
      },
      {
        chave: 'texto_padrao_whatsapp_contrato',
        valor:
          'Olá, {nome}!\n\n' +
          'Agradecemos a formalização da proposta comercial {numero_proposta}. O Contrato de Prestação de Serviços Técnicos {numero_contrato} já foi aprovado e assinado digitalmente pela Diretoria da G+ Engenharia.\n\n' +
          'Solicitamos a sua assinatura digital através do link seguro a seguir para darmos início imediato às atividades operacionais do projeto:\n\n' +
          '{link_contrato}\n\n' +
          'G+ Engenharia Consultiva',
        descricao:
          'Texto padrão para envio do contrato de serviços ao cliente via WhatsApp. Variáveis: {nome}, {numero_proposta}, {numero_contrato}, {link_contrato}',
      },
      {
        chave: 'contrato_servico_clausulas_padrao',
        valor:
          'CLÁUSULA PRIMEIRA — DO OBJETO\n' +
          'O presente contrato tem como objeto a prestação de serviços técnicos especializados de engenharia pela CONTRATADA à CONTRATANTE, em estrita conformidade com os itens, disciplinas, especificações e prazos definidos na Proposta Comercial de referência aceita pelas partes.\n\n' +
          'CLÁUSULA SEGUNDA — DAS OBRIGAÇÕES DA CONTRATADA\n' +
          'A CONTRATADA se compromete a: (a) Executar os serviços com zelo, perícia e rigor técnico, observando a legislação e normas técnicas da ABNT aplicáveis; (b) Emitir a devida Anotação de Responsabilidade Técnica (ART/RRT) dos projetos sob sua responsabilidade técnica; (c) Manter canal contínuo de comunicação sobre o andamento dos serviços.\n\n' +
          'CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES DA CONTRATANTE\n' +
          'A CONTRATANTE obriga-se a: (a) Efetuar os pagamentos estipulados no cronograma de parcelas acordado; (b) Fornecer tempestivamente todos os documentos, plantas, laudos prévios e acessos aos locais necessários para a elaboração dos projetos; (c) Arcar com as taxas dos órgãos públicos e concessionárias para análise/aprovação.\n\n' +
          'CLÁUSULA QUARTA — DO VALOR E FORMA DE PAGAMENTO\n' +
          'Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor global acordado, faturado de acordo com o cronograma e os gatilhos estabelecidos nas parcelas da proposta.\n\n' +
          'CLÁUSULA QUINTA — DA PROPRIEDADE INTELECTUAL E USO DOS PROJETOS\n' +
          'Os documentos, desenhos, modelos e memoriais técnicos produzidos são de titularidade autoral da CONTRATADA e de uso exclusivo da CONTRATANTE para a finalidade específica do empreendimento contratado, sendo vedada sua alienação ou reutilização sem anuência expressa.\n\n' +
          'CLÁUSULA SEXTA — DA RESCISÃO E PENALIDADES\n' +
          'O descumprimento injustificado de qualquer cláusula facultará à parte inocente a rescisão deste instrumento após notificação prévia de 10 (dez) dias, sem prejuízo da apuração de perdas e danos e da quitação proporcional dos serviços técnicos já executados.\n\n' +
          'CLÁUSULA SÉTIMA — DO ACEITE ELETRÔNICO E FORO\n' +
          'As partes reconhecem a plena validade jurídica do presente contrato formalizado por meio de assinatura e aceite eletrônico, com registro de data/hora, endereço IP e hashes criptográficos de integridade. Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias decorrentes deste instrumento.',
        descricao:
          'Cláusulas gerais padrão do Contrato de Prestação de Serviços Técnicos de Engenharia GMAIS (editáveis em Administração)',
      },
    ]

    for (const p of novosParametros) {
      try {
        const existente = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (existente) {
          existente.set('descricao', p.descricao)
          app.save(existente)
        }
      } catch (_) {
        const novo = new Record(parametrosCol)
        novo.set('chave', p.chave)
        novo.set('valor', p.valor)
        novo.set('descricao', p.descricao)
        app.save(novo)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contratos_servico')
      app.delete(col)
    } catch (_) {}
  },
)
