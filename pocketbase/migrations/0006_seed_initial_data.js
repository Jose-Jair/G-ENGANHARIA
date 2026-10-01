migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const seededUsers = [
      {
        email: 'admin@sistema.eng.br',
        password: 'Eng@2024',
        name: 'Ana Souza',
        role: 'admin',
        phone: '(11) 98765-4321',
        cpf_cnpj: '123.456.789-00',
        active: true,
        mfa_enabled: false,
      },
      {
        email: 'comercial@sistema.eng.br',
        password: 'Eng@2024',
        name: 'Carlos Mendes',
        role: 'comercial',
        phone: '(11) 98765-4322',
        cpf_cnpj: '234.567.890-11',
        active: true,
        mfa_enabled: false,
      },
      {
        email: 'financeiro@sistema.eng.br',
        password: 'Eng@2024',
        name: 'Beatriz Lima',
        role: 'financeiro',
        phone: '(11) 98765-4323',
        cpf_cnpj: '345.678.901-22',
        active: true,
        mfa_enabled: false,
      },
      {
        email: 'gestor@sistema.eng.br',
        password: 'Eng@2024',
        name: 'Daniel Rocha',
        role: 'gestor',
        phone: '(11) 98765-4324',
        cpf_cnpj: '456.789.012-33',
        active: true,
        mfa_enabled: false,
      },
      {
        email: 'executor@sistema.eng.br',
        password: 'Eng@2024',
        name: 'Eduardo Fonseca',
        role: 'executor',
        phone: '(11) 98765-4325',
        cpf_cnpj: '567.890.123-44',
        active: true,
        mfa_enabled: false,
      },
    ]

    for (const u of seededUsers) {
      let rec
      try {
        rec = app.findAuthRecordByEmail('_pb_users_auth_', u.email)
      } catch (_) {
        rec = new Record(usersCol)
      }
      rec.setEmail(u.email)
      rec.setPassword(u.password)
      rec.setVerified(true)
      rec.set('name', u.name)
      rec.set('role', u.role)
      rec.set('phone', u.phone)
      rec.set('cpf_cnpj', u.cpf_cnpj)
      rec.set('active', u.active)
      rec.set('mfa_enabled', u.mfa_enabled)
      app.save(rec)
    }

    // 2. Parâmetros
    const parametrosCol = app.findCollectionByNameOrId('parametros')
    const defaultParams = [
      {
        chave: 'cadencia_5_toques',
        valor: 'D0,D2,D7,D10-14,D30',
        descricao: 'Dias da cadência de 5 toques para prospecção ativa',
      },
      {
        chave: 'carencia_nutricao',
        valor: '15',
        descricao: 'Dias de carência para empresas em nutrição mensal',
      },
      {
        chave: 'faixas_curva',
        valor: 'A>5000000; B 1000000-5000000; C<1000000',
        descricao: 'Definição das faixas de valor de contrato para curva ABC (R$)',
      },
      {
        chave: 'limite_atraso_toques',
        valor: '2',
        descricao: 'Dias tolerados de atraso antes de gerar alerta crítico de toque',
      },
      {
        chave: 'dias_alerta_sem_demanda',
        valor: '30',
        descricao: 'Dias sem demandas geradas para emitir alerta sobre parceiro',
      },
      {
        chave: 'alertas_documento',
        valor: '30,15,7,1',
        descricao: 'Dias de antecedência para alertas de vencimento de ART, RRT, certidões',
      },
      {
        chave: 'janela_toque5',
        valor: '30,31',
        descricao: 'Janela em dias para execução do 5º toque de fechamento',
      },
    ]

    for (const p of defaultParams) {
      let pRec
      try {
        pRec = app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        pRec = new Record(parametrosCol)
      }
      pRec.set('chave', p.chave)
      pRec.set('valor', p.valor)
      pRec.set('descricao', p.descricao)
      app.save(pRec)
    }

    // 3. Modelos
    const modelosCol = app.findCollectionByNameOrId('modelos')
    const defaultModelos = [
      {
        tipo: 'email_institucional',
        nome: 'Apresentação de Engenharia Parceira',
        assunto: 'Apoio de Engenharia Consultiva para {orgao}',
        corpo:
          'Prezado(a) {nome},\n\nNotamos o recente contrato firmado com o órgão {orgao} no valor de R$ {valor_contrato}.\n\nNossa empresa atua como parceira técnica especializada na execução e intermediação de projetos complementares, compatibilizações BIM, laudos e medições para contratos públicos.\n\nPodemos agendar uma rápida conversa de 15 minutos para apresentar nossa equipe técnica?\n\nAtenciosamente,\nEquipe de Parcerias Técnicas',
      },
      {
        tipo: 'solucao_elaborada',
        nome: 'Diagnóstico e Viabilidade Técnica',
        assunto: 'Proposta de Solução Técnica Integrada — {orgao}',
        corpo:
          'Olá, {nome}.\n\nCom base nas exigências editalícias do contrato com {orgao}, desenhamos uma proposta de solução técnica para viabilizar as disciplinas requeridas com executores certificados.\n\nEstamos à disposição para detalhar o escopo e os prazos de entrega.\n\nCordialmente,\nDiretoria de Operações',
      },
      {
        tipo: 'piloto',
        nome: 'Piloto Operacional sem Risco',
        assunto: 'Execução Piloto de Etapa — Parceria com {orgao}',
        corpo:
          'Prezado(a) {nome},\n\nPropomos um projeto piloto para a primeira etapa executiva do contrato com {orgao}. Nossa equipe homologada garante a emissão de ART/RRT e cumprimento integral do cronograma.\n\nFicamos no aguardo do seu retorno para formalização.',
      },
    ]

    for (const m of defaultModelos) {
      let mRec
      try {
        mRec = app.findFirstRecordByData('modelos', 'nome', m.nome)
      } catch (_) {
        mRec = new Record(modelosCol)
      }
      mRec.set('tipo', m.tipo)
      mRec.set('nome', m.nome)
      mRec.set('assunto', m.assunto)
      mRec.set('corpo', m.corpo)
      app.save(mRec)
    }

    // 4. Motivos
    const motivosCol = app.findCollectionByNameOrId('motivos')
    const defaultMotivos = [
      {
        tipo: 'inativacao',
        descricao: 'Empresa não possui contratos vigentes ou encerrou atividades públicas',
        ativo: true,
      },
      {
        tipo: 'inativacao',
        descricao: 'Solicitação direta de não contato / LGPD',
        ativo: true,
      },
      {
        tipo: 'recusa_proposta',
        descricao: 'Preço acima do orçamento da contratante',
        ativo: true,
      },
      {
        tipo: 'recusa_proposta',
        descricao: 'Prazo de entrega incompatível com a ordem de serviço do órgão',
        ativo: true,
      },
      {
        tipo: 'cancelamento_toque',
        descricao: 'Contato decisor não atua mais na empresa parceira',
        ativo: true,
      },
    ]

    for (const mo of defaultMotivos) {
      let moRec
      try {
        moRec = app.findFirstRecordByData('motivos', 'descricao', mo.descricao)
      } catch (_) {
        moRec = new Record(motivosCol)
      }
      moRec.set('tipo', mo.tipo)
      moRec.set('descricao', mo.descricao)
      moRec.set('ativo', mo.ativo)
      app.save(moRec)
    }
  },
  (app) => {
    // down logic is optional for seed
  },
)
