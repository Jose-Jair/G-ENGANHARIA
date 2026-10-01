migrate(
  (app) => {
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const clientesPfId = app.findCollectionByNameOrId('clientes_pf').id

    // 1. Ajustar coleção 'projetos'
    const projetos = app.findCollectionByNameOrId('projetos')
    if (!projetos.fields.getByName('nome')) {
      projetos.fields.add(new TextField({ name: 'nome' }))
    }
    if (!projetos.fields.getByName('empresa')) {
      projetos.fields.add(
        new RelationField({
          name: 'empresa',
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!projetos.fields.getByName('cliente_pf')) {
      projetos.fields.add(
        new RelationField({
          name: 'cliente_pf',
          collectionId: clientesPfId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!projetos.fields.getByName('valor_total')) {
      projetos.fields.add(new NumberField({ name: 'valor_total' }))
    }
    if (!projetos.fields.getByName('prazo_final')) {
      projetos.fields.add(new DateField({ name: 'prazo_final' }))
    }
    if (!projetos.fields.getByName('justificativa_saude')) {
      projetos.fields.add(new TextField({ name: 'justificativa_saude' }))
    }
    if (!projetos.fields.getByName('disciplinas')) {
      projetos.fields.add(new TextField({ name: 'disciplinas' }))
    }
    if (!projetos.fields.getByName('descricao')) {
      projetos.fields.add(new TextField({ name: 'descricao' }))
    }
    // Regras de projetos:
    // Leitura: admin, comercial, financeiro, gestor
    // Gravação (create/update): admin e gestor
    // Delete: admin
    projetos.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    projetos.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    projetos.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    projetos.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    projetos.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(projetos)

    // 2. Ajustar coleção 'projeto_etapas'
    const etapas = app.findCollectionByNameOrId('projeto_etapas')
    if (!etapas.fields.getByName('ordem')) {
      etapas.fields.add(new NumberField({ name: 'ordem' }))
    }
    if (!etapas.fields.getByName('descricao')) {
      etapas.fields.add(new TextField({ name: 'descricao' }))
    }
    if (!etapas.fields.getByName('data_inicio')) {
      etapas.fields.add(new DateField({ name: 'data_inicio' }))
    }
    if (!etapas.fields.getByName('data_conclusao')) {
      etapas.fields.add(new DateField({ name: 'data_conclusao' }))
    }
    if (!etapas.fields.getByName('custo_estimado')) {
      etapas.fields.add(new NumberField({ name: 'custo_estimado' }))
    }
    etapas.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    etapas.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    etapas.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    etapas.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    etapas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(etapas)

    // 3. Ajustar coleção 'entregaveis'
    const entregaveis = app.findCollectionByNameOrId('entregaveis')
    if (!entregaveis.fields.getByName('descricao')) {
      entregaveis.fields.add(new TextField({ name: 'descricao' }))
    }
    if (!entregaveis.fields.getByName('data_aprovacao')) {
      entregaveis.fields.add(new DateField({ name: 'data_aprovacao' }))
    }
    if (!entregaveis.fields.getByName('observacoes_revisao')) {
      entregaveis.fields.add(new TextField({ name: 'observacoes_revisao' }))
    }
    entregaveis.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
    entregaveis.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
    entregaveis.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    entregaveis.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    entregaveis.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(entregaveis)

    // 4. Ajustar coleção 'documentos'
    const documentos = app.findCollectionByNameOrId('documentos')
    if (!documentos.fields.getByName('descricao')) {
      documentos.fields.add(new TextField({ name: 'descricao' }))
    }
    if (!documentos.fields.getByName('responsavel_tecnico')) {
      documentos.fields.add(new TextField({ name: 'responsavel_tecnico' }))
    }
    documentos.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    documentos.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial')"
    documentos.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    documentos.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    documentos.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(documentos)

    // 5. Ajustar coleção 'riscos'
    const riscos = app.findCollectionByNameOrId('riscos')
    riscos.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
    riscos.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro')"
    riscos.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    riscos.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    riscos.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    app.save(riscos)

    // 6. Ajustar coleção 'executores'
    const executores = app.findCollectionByNameOrId('executores')
    if (!executores.fields.getByName('email')) {
      executores.fields.add(new EmailField({ name: 'email' }))
    }
    if (!executores.fields.getByName('telefone')) {
      executores.fields.add(new TextField({ name: 'telefone' }))
    }
    if (!executores.fields.getByName('motivo_suspensao')) {
      executores.fields.add(new TextField({ name: 'motivo_suspensao' }))
    }
    if (!executores.fields.getByName('numero_registro')) {
      executores.fields.add(new TextField({ name: 'numero_registro' }))
    }
    if (!executores.fields.getByName('total_avaliacoes')) {
      executores.fields.add(new NumberField({ name: 'total_avaliacoes' }))
    }
    // Regras de executores:
    // Leitura: admin, gestor, comercial (Financeiro SEM acesso)
    // Grava: admin e gestor
    executores.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
    executores.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
    executores.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    executores.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    executores.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(executores)

    // 7. Ajustar coleção 'cotacoes'
    const cotacoes = app.findCollectionByNameOrId('cotacoes')
    if (!cotacoes.fields.getByName('token')) {
      cotacoes.fields.add(new TextField({ name: 'token' }))
    }
    if (!cotacoes.fields.getByName('data_resposta')) {
      cotacoes.fields.add(new DateField({ name: 'data_resposta' }))
    }
    if (!cotacoes.fields.getByName('data_limite')) {
      cotacoes.fields.add(new DateField({ name: 'data_limite' }))
    }
    // Cotações:
    // Leitura autenticada: admin, comercial, gestor
    // Gravação: admin, comercial, gestor
    // Resposta pública sem login pelo token: via endpoint dedicado hook ou listRule por token
    cotacoes.listRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial'))"
    cotacoes.viewRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial'))"
    cotacoes.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
    cotacoes.updateRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial'))"
    cotacoes.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(cotacoes)

    // 8. Ajustar coleção 'avaliacoes'
    const avaliacoes = app.findCollectionByNameOrId('avaliacoes')
    if (!avaliacoes.fields.getByName('avaliado_por')) {
      avaliacoes.fields.add(
        new RelationField({
          name: 'avaliado_por',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!avaliacoes.fields.getByName('nota_final')) {
      avaliacoes.fields.add(new NumberField({ name: 'nota_final' }))
    }
    avaliacoes.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
    avaliacoes.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial')"
    avaliacoes.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    avaliacoes.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    avaliacoes.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(avaliacoes)

    // 9. Parâmetros da Etapa 8:
    // - pesos_avaliacao_executor (pontualidade, qualidade, desvio_custo, responsividade)
    // - nota_corte_executor (alerta de baixa nota)
    // - modelos_etapas_disciplinas (modelos padrão por disciplina)
    const parametros = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'pesos_avaliacao_executor',
        valor: JSON.stringify({
          peso_pontualidade: 30,
          peso_qualidade: 35,
          peso_desvio_custo: 20,
          peso_responsividade: 15,
        }),
        descricao:
          'Pesos em percentual (soma = 100) para cálculo da Nota Geral Ponderada do Executor',
      },
      {
        chave: 'nota_corte_executor',
        valor: '3.0',
        descricao:
          'Nota mínima geral ponderada (1 a 5). Executores abaixo deste corte recebem alerta de desempenho',
      },
      {
        chave: 'modelos_etapas_disciplinas',
        valor: JSON.stringify([
          {
            disciplina: 'Projetos Estruturais',
            etapas: [
              'Concepção e Lançamento Estrutural',
              'Cálculo e Dimensionamento de Elementos',
              'Detalhamento de Armaduras e Formas',
              'Emissão de Pranchas Executivas e ART',
            ],
          },
          {
            disciplina: 'Instalações Elétricas e SPDA',
            etapas: [
              'Levantamento de Cargas e Diagramas Unifilares',
              'Dimensionamento de Circuitos e Quadros',
              'Projeto de Malha de Aterramento e SPDA',
              'Lista de Materiais e Pranchas Finais',
            ],
          },
          {
            disciplina: 'Instalações Hidrossanitárias',
            etapas: [
              'Dimensionamento de Redes de Água Fria e Quente',
              'Projeto de Esgoto e Ventilação Sanitária',
              'Drenagem Pluvial e Reservatórios',
              'Isométricos e Detalhes Construtivos',
            ],
          },
          {
            disciplina: 'Climatização e AVAC',
            etapas: [
              'Cálculo de Carga Térmica por Ambiente',
              'Definição de Rotas de Dutos e Equipamentos',
              'Detalhamento de Automação e Difusores',
              'Memorial Descritivo e Pranchas Finais',
            ],
          },
          {
            disciplina: 'PPCI (Prevenção e Combate a Incêndio)',
            etapas: [
              'Classificação de Risco e Rotas de Fuga',
              'Rede de Hidrantes e Extintores',
              'Sinalização de Emergência e Iluminação',
              'Aprovação junto ao Corpo de Bombeiros',
            ],
          },
          {
            disciplina: 'Topografia e Sondagem',
            etapas: [
              'Levantamento Planialtimétrico Cadastral',
              'Sondagens a Percussão (SPT)',
              'Relatório Geotécnico e Perfil Geológico',
            ],
          },
        ]),
        descricao:
          'Modelos padrão de etapas sequenciais pré-configuradas por disciplina de engenharia',
      },
    ]

    for (const p of novosParametros) {
      try {
        app.findFirstRecordByData('parametros', 'chave', p.chave)
      } catch (_) {
        const r = new Record(parametros)
        r.set('chave', p.chave)
        r.set('valor', p.valor)
        r.set('descricao', p.descricao)
        app.save(r)
      }
    }
  },
  (app) => {
    // Rollback não destrutivo de campos
  },
)
