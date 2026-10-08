migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const executoresCol = app.findCollectionByNameOrId('executores')
    const subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    // 0. Tornar campo 'etapa' opcional em 'cotacoes' para suportar cotações em nível de projeto
    const etapaField = cotacoesCol.fields.getByName('etapa')
    if (etapaField && etapaField.required) {
      etapaField.required = false
      app.save(cotacoesCol)
    }

    // 1. Atualizar regras de RLS de subcontratos:
    // O executor logado pode listar e visualizar apenas os subcontratos vinculados ao seu e-mail/executor!
    // Outros perfis internos (admin, gestor, comercial, financeiro) mantêm acesso; tokens públicos continuam funcionando
    subcontratosCol.listRule =
      "token_assinatura != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email)))"
    subcontratosCol.viewRule =
      "token_assinatura != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email)))"
    app.save(subcontratosCol)

    // 2. Atualizar regras de RLS de cotacoes:
    // O executor logado pode listar e visualizar cotações enviadas para ele (onde executor.email = auth.email)
    // Pode atualizar cotação enviada para ele (apenas se ainda não escolhida/recusada)
    cotacoesCol.listRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email)))"
    cotacoesCol.viewRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email)))"
    cotacoesCol.updateRule =
      "token != '' || (@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && executor.email = @request.auth.email)))"
    app.save(cotacoesCol)

    // 3. Atualizar regras de RLS de projetos:
    // O executor logado pode visualizar dados básicos dos projetos onde foi contratado (via subcontrato) ou convidado (via cotação)
    projetosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && @collection.subcontratos.projeto ?= id && @collection.subcontratos.executor.email ?= @request.auth.email))"
    projetosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && @collection.subcontratos.projeto ?= id && @collection.subcontratos.executor.email ?= @request.auth.email))"
    app.save(projetosCol)

    // 4. Atualizar regras de RLS de etapas e entregaveis para o executor acompanhar andamento dos seus projetos
    etapasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && (@collection.subcontratos.projeto ?= projeto && @collection.subcontratos.executor.email ?= @request.auth.email)))"
    etapasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && (@collection.subcontratos.projeto ?= projeto && @collection.subcontratos.executor.email ?= @request.auth.email)))"
    app.save(etapasCol)

    entregaveisCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && (@collection.subcontratos.projeto ?= etapa.projeto && @collection.subcontratos.executor.email ?= @request.auth.email)))"
    entregaveisCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && (@collection.subcontratos.projeto ?= etapa.projeto && @collection.subcontratos.executor.email ?= @request.auth.email)))"
    app.save(entregaveisCol)

    // 5. Garantir existência e sincronização do usuário executor fictício (Eduardo Fonseca, executor@sistema.eng.br / Eng@2024)
    let userExecutor
    try {
      userExecutor = app.findAuthRecordByEmail('_pb_users_auth_', 'executor@sistema.eng.br')
      userExecutor.setPassword('Eng@2024')
      userExecutor.setVerified(true)
      userExecutor.set('role', 'executor')
      userExecutor.set('active', true)
      userExecutor.set('phone', '(11) 98765-4325')
      userExecutor.set('cpf_cnpj', '567.890.123-44')
      app.save(userExecutor)
    } catch (_) {
      userExecutor = new Record(usersCol)
      userExecutor.setEmail('executor@sistema.eng.br')
      userExecutor.setPassword('Eng@2024')
      userExecutor.setVerified(true)
      userExecutor.set('name', 'Eduardo Fonseca')
      userExecutor.set('role', 'executor')
      userExecutor.set('active', true)
      userExecutor.set('phone', '(11) 98765-4325')
      userExecutor.set('cpf_cnpj', '567.890.123-44')
      app.save(userExecutor)
    }

    // 6. Garantir registro correspondente na coleção 'executores'
    let executorRec
    try {
      executorRec = app.findFirstRecordByData('executores', 'email', 'executor@sistema.eng.br')
      executorRec.set('nome', 'Eduardo Fonseca — Projetos Estruturais')
      executorRec.set('tipo', 'PF')
      executorRec.set('cpf_cnpj', '567.890.123-44')
      executorRec.set('conselho', 'CREA')
      executorRec.set('numero_registro', 'CREA-SP 123456/D')
      executorRec.set('disciplinas', 'Estrutural, Concreto Armado, Estrutura Metálica')
      executorRec.set('regiao', 'Sudeste / Nacional')
      executorRec.set('capacidade_simultanea', 4)
      executorRec.set('status', 'ativo')
      executorRec.set('telefone', '(11) 98765-4325')
      executorRec.set(
        'dados_bancarios',
        'Banco do Brasil - Ag 1234-5 - CC 98765-4 (PIX: 56789012344)',
      )
      app.save(executorRec)
    } catch (_) {
      executorRec = new Record(executoresCol)
      executorRec.set('nome', 'Eduardo Fonseca — Projetos Estruturais')
      executorRec.set('tipo', 'PF')
      executorRec.set('email', 'executor@sistema.eng.br')
      executorRec.set('cpf_cnpj', '567.890.123-44')
      executorRec.set('conselho', 'CREA')
      executorRec.set('numero_registro', 'CREA-SP 123456/D')
      executorRec.set('disciplinas', 'Estrutural, Concreto Armado, Estrutura Metálica')
      executorRec.set('regiao', 'Sudeste / Nacional')
      executorRec.set('capacidade_simultanea', 4)
      executorRec.set('status', 'ativo')
      executorRec.set('nota_geral', 9.5)
      executorRec.set('total_avaliacoes', 2)
      executorRec.set('telefone', '(11) 98765-4325')
      executorRec.set(
        'dados_bancarios',
        'Banco do Brasil - Ag 1234-5 - CC 98765-4 (PIX: 56789012344)',
      )
      app.save(executorRec)
    }

    // 7. Criar dados de exemplo no projeto PRJ-2026-0001 e PRJ-2026-0002 para demonstrar o portal
    // Localizar projetos
    let prj1, prj2
    try {
      prj1 = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-0001')
    } catch (_) {}
    try {
      prj2 = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-0002')
    } catch (_) {}

    // A. Subcontrato de exemplo em PRJ-2026-0001 (onde o executor já foi contratado)
    if (prj1 && executorRec) {
      let subExemplo
      try {
        subExemplo = app.findFirstRecordByData('subcontratos', 'executor', executorRec.id)
      } catch (_) {}

      if (!subExemplo) {
        subExemplo = new Record(subcontratosCol)
        subExemplo.set('numero', 'SUB-2026-0001')
        subExemplo.set('projeto', prj1.id)
        if (prj1.getString('grupo')) {
          subExemplo.set('grupo', prj1.getString('grupo'))
        }
        if (prj1.getString('contrato_servico')) {
          subExemplo.set('contrato_servico_origem', prj1.getString('contrato_servico'))
        }
        subExemplo.set('executor', executorRec.id)
        subExemplo.set('modo_execucao', 'terceirizada_parcial')
        subExemplo.set(
          'descricao_escopo',
          'Elaboração de Projeto Executivo Estrutural em Concreto Armado e Fundações com memorial de cálculo e detalhamento de armaduras.',
        )
        subExemplo.set(
          'descricao_delegada',
          'Desenvolvimento completo dos modelos estruturais, dimensionamento de pilares, vigas, lajes e emissão da ART correspondente.',
        )
        subExemplo.set('valor_total', 18500)
        subExemplo.set('prazo_dias', 45)
        subExemplo.set(
          'nota_prazo',
          'O projeto do executor terá a mesma duração do contrato original de referência (45 dias).',
        )
        subExemplo.set(
          'clausulas_texto',
          'TERMO DE SUBCONTRATAÇÃO E PRESTAÇÃO DE SERVIÇOS TÉCNICOS DE ENGENHARIA GMAIS\n\n' +
            'CLÁUSULA PRIMEIRA — DO OBJETO E VINCULAÇÃO AO CONTRATO PRINCIPAL\n' +
            'O presente Termo tem por objeto a subcontratação, mediada pela G+ ENGENHARIA ("CONTRATANTE"), do EXECUTOR Eduardo Fonseca ("SUBCONTRATADO") para execução técnica do Projeto Executivo Estrutural no projeto PRJ-2026-0001, integrante do Contrato CTR-2026-0001.\n\n' +
            'CLÁUSULA SEGUNDA — DOS PRAZOS\n' +
            'O projeto subcontratado terá a mesma duração do contrato original (45 dias corridos).\n\n' +
            'CLÁUSULA TERCEIRA — DO VALOR\n' +
            'Pelos serviços prestados, a CONTRATANTE pagará ao SUBCONTRATADO o valor total de R$ 18.500,00 mediante validação técnica das etapas.\n\n' +
            'CLÁUSULA QUARTA — DA ART E RESPONSABILIDADE TÉCNICA\n' +
            'O SUBCONTRATADO responderá perante o CREA-SP pela conformidade das normas técnicas NBR 6118.',
        )
        subExemplo.set(
          'condicoes_pagamento',
          '50% na aprovação do pré-dimensionamento e 50% na entrega final com ART',
        )
        subExemplo.set('parcelas_json', [
          {
            numero: 1,
            descricao: 'Subcontrato SUB-2026-0001 — Entrada e Pré-Dimensionamento',
            valor: 9250,
            vencimento: '2026-10-25 12:00:00.000Z',
          },
          {
            numero: 2,
            descricao: 'Subcontrato SUB-2026-0001 — Entrega Final e Emissão de ART',
            valor: 9250,
            vencimento: '2026-11-25 12:00:00.000Z',
          },
        ])
        subExemplo.set('status', 'aguardando_assinatura')
        subExemplo.set('token_assinatura', $security.randomString(32))
        subExemplo.set('data_emissao', new Date().toISOString())
        app.save(subExemplo)

        // Atualizar projeto para terceirizada parcial
        prj1.set('modo_execucao', 'terceirizada_parcial')
        prj1.set(
          'descricao_delegada',
          'Desenvolvimento completo dos modelos estruturais, dimensionamento de pilares, vigas, lajes e emissão da ART.',
        )
        app.save(prj1)

        // Criar etapa e entregável de exemplo em PRJ-2026-0001 para visualização de andamento
        try {
          const etapa1 = new Record(etapasCol)
          etapa1.set('projeto', prj1.id)
          etapa1.set('nome', 'Etapa 01 — Modelagem Estrutural e Pré-Dimensionamento')
          etapa1.set('disciplina', 'Estrutural')
          etapa1.set('tipo_execucao', 'terceirizada')
          etapa1.set('executor', executorRec.id)
          etapa1.set('ordem', 1)
          etapa1.set('status', 'em_andamento')
          etapa1.set(
            'descricao',
            'Lançamento das cargas e dimensionamento preliminar de vigas e pilares.',
          )
          app.save(etapa1)

          const entr1 = new Record(entregaveisCol)
          entr1.set('etapa', etapa1.id)
          entr1.set('nome', 'Relatório Técnico de Pré-Dimensionamento Estrutural')
          entr1.set('versao', 'Rev.01')
          entr1.set('status', 'em_analise')
          entr1.set('descricao', 'Memorial descritivo e memorial de cálculo estrutural preliminar.')
          app.save(entr1)

          const etapa2 = new Record(etapasCol)
          etapa2.set('projeto', prj1.id)
          etapa2.set('nome', 'Etapa 02 — Detalhamento de Armaduras e Pranchas Executivas')
          etapa2.set('disciplina', 'Estrutural')
          etapa2.set('tipo_execucao', 'terceirizada')
          etapa2.set('executor', executorRec.id)
          etapa2.set('ordem', 2)
          etapa2.set('status', 'a_iniciar')
          etapa2.set('descricao', 'Emissão das pranchas de armação e formas para obra.')
          app.save(etapa2)
        } catch (_) {}
      }
    }

    // B. Convite de Cotação aberto de exemplo em PRJ-2026-0002 para demonstrar a resposta
    if (prj2 && executorRec) {
      let cotacaoExemplo
      try {
        cotacaoExemplo = app.findFirstRecordByData('cotacoes', 'executor', executorRec.id)
      } catch (_) {}

      if (!cotacaoExemplo) {
        // Criar uma etapa prévia no projeto 2 se necessário
        let etapaBim
        try {
          etapaBim = app.findFirstRecordByData('projeto_etapas', 'projeto', prj2.id)
        } catch (_) {}

        if (!etapaBim) {
          etapaBim = new Record(etapasCol)
          etapaBim.set('projeto', prj2.id)
          etapaBim.set('nome', 'Modelagem BIM Multidisciplinar')
          etapaBim.set('disciplina', 'BIM Compatibilização')
          etapaBim.set('tipo_execucao', 'terceirizada')
          etapaBim.set('ordem', 1)
          etapaBim.set('status', 'cotacao')
          app.save(etapaBim)
        }

        cotacaoExemplo = new Record(cotacoesCol)
        if (etapaBim) {
          cotacaoExemplo.set('etapa', etapaBim.id)
        }
        cotacaoExemplo.set('projeto', prj2.id)
        if (prj2.getString('grupo')) {
          cotacaoExemplo.set('grupo', prj2.getString('grupo'))
        }
        cotacaoExemplo.set('executor', executorRec.id)
        cotacaoExemplo.set(
          'escopo',
          'Modelagem BIM 3D (Revit) e Compatibilização multidisciplinar do empreendimento comercial Clinica.',
        )
        cotacaoExemplo.set('token', $security.randomString(32))
        cotacaoExemplo.set('status', 'convite_enviado')
        cotacaoExemplo.set('escolhida', false)
        cotacaoExemplo.set(
          'data_limite',
          new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        )
        cotacaoExemplo.set(
          'prazo_resposta',
          new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        )
        app.save(cotacaoExemplo)
      }
    }

    // Auditoria da aplicação do Bloco 6
    try {
      const a = new Record(auditCol)
      a.set('acao', 'CONFIGURACAO_PORTAL_EXECUTOR_BLOCO6')
      a.set('entidade', 'sistema')
      a.set('registro_id', 'bloco6')
      a.set('detalhes', {
        mensagem:
          'Migração do Bloco 6 aplicada: regras RLS seguras para perfil executor, sincronização do executor fictício Eduardo Fonseca (executor@sistema.eng.br) e dados de demonstração.',
      })
      app.save(a)
    } catch (_) {}
  },
  (app) => {
    // Down idempotente
  },
)
