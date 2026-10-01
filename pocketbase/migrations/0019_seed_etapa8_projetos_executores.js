migrate(
  (app) => {
    // 1. Criar Executores fictícios representativos
    // - Um ativo e bem avaliado
    // - Um suspenso com motivo registrado
    // - Um com registro profissional vencendo / vencido
    // - Um com nota abaixo do corte (< 3.0)
    const executoresCol = app.findCollectionByNameOrId('executores')

    const ex1 = new Record(executoresCol)
    ex1.set('tipo', 'PJ')
    ex1.set('nome', 'Vértice Engenharia Estrutural Ltda')
    ex1.set('cpf_cnpj', '12.345.678/0001-90')
    ex1.set('email', 'contato@vertice-eng.com.br')
    ex1.set('telefone', '(11) 98765-4321')
    ex1.set('conselho', 'CREA')
    ex1.set('numero_registro', 'CREA-SP 506123456')
    ex1.set('conselho_validade', '2027-12-31 23:59:59.000Z')
    ex1.set('disciplinas', 'Estrutural, Fundações, Concreto Protendido')
    ex1.set('regiao', 'Sudeste / São Paulo')
    ex1.set('capacidade_simultanea', 4)
    ex1.set(
      'dados_bancarios',
      'Banco do Brasil - Ag: 1234-5 / CC: 54321-0 (PIX: 12.345.678/0001-90)',
    )
    ex1.set('status', 'ativo')
    ex1.set('nota_geral', 4.85)
    ex1.set('total_avaliacoes', 5)
    app.save(ex1)

    const ex2 = new Record(executoresCol)
    ex2.set('tipo', 'PF')
    ex2.set('nome', 'Eng. Roberto Albuquerque')
    ex2.set('cpf_cnpj', '234.567.890-12')
    ex2.set('email', 'roberto.eng@eletrica-spda.com')
    ex2.set('telefone', '(21) 99876-5432')
    ex2.set('conselho', 'CREA')
    ex2.set('numero_registro', 'CREA-RJ 201834901')
    ex2.set('conselho_validade', '2027-06-30 23:59:59.000Z')
    ex2.set('disciplinas', 'Instalações Elétricas, Subestação, SPDA')
    ex2.set('regiao', 'Rio de Janeiro e Sul de Minas')
    ex2.set('capacidade_simultanea', 2)
    ex2.set('dados_bancarios', 'Itaú - Ag: 0098 / CC: 32145-6 (PIX: roberto.eng@eletrica-spda.com)')
    ex2.set('status', 'ativo')
    ex2.set('nota_geral', 4.2)
    ex2.set('total_avaliacoes', 3)
    app.save(ex2)

    // Executor SUSPENSO (bloqueio no servidor)
    const ex3Suspenso = new Record(executoresCol)
    ex3Suspenso.set('tipo', 'PJ')
    ex3Suspenso.set('nome', 'TecnoHidro Projetos e Saneamento ME')
    ex3Suspenso.set('cpf_cnpj', '45.678.901/0001-23')
    ex3Suspenso.set('email', 'diretoria@tecnohidro-eng.com.br')
    ex3Suspenso.set('telefone', '(31) 97654-3210')
    ex3Suspenso.set('conselho', 'CREA')
    ex3Suspenso.set('numero_registro', 'CREA-MG 10293847')
    ex3Suspenso.set('conselho_validade', '2026-11-30 23:59:59.000Z')
    ex3Suspenso.set('disciplinas', 'Hidrossanitário, Drenagem e ETE')
    ex3Suspenso.set('regiao', 'Minas Gerais')
    ex3Suspenso.set('capacidade_simultanea', 2)
    ex3Suspenso.set('status', 'suspenso')
    ex3Suspenso.set(
      'motivo_suspensao',
      'Atraso reincidente na entrega de revisões e recusa de emissão de ART complementar',
    )
    ex3Suspenso.set('nota_geral', 3.1)
    ex3Suspenso.set('total_avaliacoes', 2)
    app.save(ex3Suspenso)

    // Executor com CONSELHO VENCIDO
    const ex4Vencido = new Record(executoresCol)
    ex4Vencido.set('tipo', 'PF')
    ex4Vencido.set('nome', 'Arq. Juliana Vasconcelos')
    ex4Vencido.set('cpf_cnpj', '345.678.901-23')
    ex4Vencido.set('email', 'juliana.arq@projetos-urbanos.com.br')
    ex4Vencido.set('telefone', '(41) 98123-4567')
    ex4Vencido.set('conselho', 'CAU')
    ex4Vencido.set('numero_registro', 'CAU-PR A87654-3')
    ex4Vencido.set('conselho_validade', '2025-12-15 23:59:59.000Z') // Já vencido
    ex4Vencido.set('disciplinas', 'Arquitetura Corporativa, Acessibilidade')
    ex4Vencido.set('regiao', 'Paraná / Curitiba')
    ex4Vencido.set('capacidade_simultanea', 3)
    ex4Vencido.set('status', 'homologacao')
    ex4Vencido.set('nota_geral', 3.8)
    ex4Vencido.set('total_avaliacoes', 1)
    app.save(ex4Vencido)

    // Executor com NOTA ABAIXO DO CORTE (< 3.0)
    const ex5BaixaNota = new Record(executoresCol)
    ex5BaixaNota.set('tipo', 'PJ')
    ex5BaixaNota.set('nome', 'Klimat Soluções em Climatização e AVAC')
    ex5BaixaNota.set('cpf_cnpj', '56.789.012/0001-34')
    ex5BaixaNota.set('email', 'comercial@klimat-avac.com')
    ex5BaixaNota.set('telefone', '(19) 99123-8877')
    ex5BaixaNota.set('conselho', 'CREA')
    ex5BaixaNota.set('numero_registro', 'CREA-SP 987654321')
    ex5BaixaNota.set('conselho_validade', '2027-08-30 23:59:59.000Z')
    ex5BaixaNota.set('disciplinas', 'Climatização, Exaustão Mecânica, AVAC')
    ex5BaixaNota.set('regiao', 'Campinas e Interior de SP')
    ex5BaixaNota.set('capacidade_simultanea', 3)
    ex5BaixaNota.set('status', 'ativo')
    ex5BaixaNota.set('nota_geral', 2.65) // Abaixo do corte de 3.0
    ex5BaixaNota.set('total_avaliacoes', 4)
    app.save(ex5BaixaNota)

    // 2. Projetos Fictícios
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const documentosCol = app.findCollectionByNameOrId('documentos')
    const riscosCol = app.findCollectionByNameOrId('riscos')
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')

    // Buscar propostas existentes para vincular
    let prop1 = null
    let prop2 = null
    try {
      prop1 = app.findFirstRecordByData('propostas', 'numero', 'PROP-2026-081')
      prop2 = app.findFirstRecordByData('propostas', 'numero', 'PROP-2026-045')
    } catch (_) {}

    // Projeto 1: Originado da proposta PROP-2026-081 (Saúde Verde)
    const prj1 = new Record(projetosCol)
    prj1.set('codigo', 'PRJ-2026-0001')
    prj1.set('nome', 'Superestrutura e Modelagem BIM da Ponte Estaiada do Rodoanel')
    if (prop1) {
      prj1.set('proposta', prop1.id)
      prj1.set('empresa', prop1.getString('empresa'))
    }
    prj1.set('valor_total', 1100000)
    prj1.set('prazo_final', '2026-11-30 23:59:59.000Z')
    prj1.set('saude', 'verde')
    prj1.set(
      'justificativa_saude',
      'Cronograma em dia, aprovação da superestrutura realizada pelo DER sem ressalvas.',
    )
    prj1.set('status', 'em_andamento')
    prj1.set('disciplinas', 'Estruturas, BIM, Geotecnia')
    app.save(prj1)

    // Projeto 2: Originado da proposta PROP-2026-045 (Saúde Amarela)
    const prj2 = new Record(projetosCol)
    prj2.set('codigo', 'PRJ-2026-0002')
    prj2.set('nome', 'Contenção Geotécnica e Túnel ERS-115')
    if (prop2) {
      prj2.set('proposta', prop2.id)
      prj2.set('empresa', prop2.getString('empresa'))
    }
    prj2.set('valor_total', 1200000)
    prj2.set('prazo_final', '2026-09-15 23:59:59.000Z')
    prj2.set('saude', 'amarelo')
    prj2.set(
      'justificativa_saude',
      'Sondagem identificou camada de argila mole não prevista. Ajustando plano de tirantes.',
    )
    prj2.set('status', 'em_andamento')
    prj2.set('disciplinas', 'Geotecnia Pesada, Instrumentação')
    app.save(prj2)

    // Projeto 3: Cadastro Direto sem proposta (Saúde Vermelha)
    const prj3 = new Record(projetosCol)
    prj3.set('codigo', 'PRJ-2026-0003')
    prj3.set('nome', 'Complexo Hospitalar Municipal — Projetos Complementares')
    prj3.set('valor_total', 450000)
    prj3.set('prazo_final', '2026-07-20 23:59:59.000Z')
    prj3.set('saude', 'vermelho')
    prj3.set(
      'justificativa_saude',
      'Alvará pendente junto à prefeitura há 45 dias e atraso na compatibilização hidro/elétrica.',
    )
    prj3.set('status', 'em_andamento')
    prj3.set('disciplinas', 'Elétrica, Hidrossanitário, Climatização, PPCI')
    app.save(prj3)

    // 3. Etapas do Projeto 1 (Direta, Terceirizada, Mista)
    const et1 = new Record(etapasCol)
    et1.set('projeto', prj1.id)
    et1.set('nome', 'Concepção e Lançamento Estrutural em BIM')
    et1.set('ordem', 1)
    et1.set('disciplina', 'Estruturas')
    et1.set('tipo_execucao', 'direta')
    et1.set('status', 'concluida')
    et1.set('prazo', '2026-04-10 23:59:59.000Z')
    app.save(et1)

    const et2 = new Record(etapasCol)
    et2.set('projeto', prj1.id)
    et2.set('nome', 'Cálculo da Superestrutura e Estais')
    et2.set('ordem', 2)
    et2.set('disciplina', 'Estruturas')
    et2.set('tipo_execucao', 'terceirizada')
    et2.set('executor', ex1.id)
    et2.set('status', 'em_andamento')
    et2.set('prazo', '2026-06-30 23:59:59.000Z')
    app.save(et2)

    const et3 = new Record(etapasCol)
    et3.set('projeto', prj1.id)
    et3.set('nome', 'Projetos de Iluminação Viária e SPDA')
    et3.set('ordem', 3)
    et3.set('disciplina', 'Instalações Elétricas')
    et3.set('tipo_execucao', 'terceirizada')
    et3.set('status', 'cotacao') // Em fase de cotação com convites
    et3.set('prazo', '2026-08-30 23:59:59.000Z')
    app.save(et3)

    const et4 = new Record(etapasCol)
    et4.set('projeto', prj1.id)
    et4.set('nome', 'Emissão das Pranchas Finais e As-Built')
    et4.set('ordem', 4)
    et4.set('disciplina', 'Estruturas')
    et4.set('tipo_execucao', 'mista')
    et4.set('status', 'a_iniciar')
    et4.set('prazo', '2026-11-15 23:59:59.000Z')
    app.save(et4)

    // 4. Entregáveis do Projeto 1
    const ent1 = new Record(entregaveisCol)
    ent1.set('etapa', et1.id)
    ent1.set('nome', 'Modelo BIM Federado (IFC) e Memorial Descritivo')
    ent1.set('versao', 'Rev.02')
    ent1.set('status', 'aprovado')
    ent1.set('data_aprovacao', '2026-04-08 15:30:00.000Z')
    app.save(ent1)

    const ent2 = new Record(entregaveisCol)
    ent2.set('etapa', et2.id)
    ent2.set('nome', 'Memória de Cálculo de Esforços nos Estais e Ancoragens')
    ent2.set('versao', 'Rev.01')
    ent2.set('status', 'revisao_interna')
    ent2.set('descricao', 'Verificação com engenharia interna antes do envio ao cliente.')
    app.save(ent2)

    const ent3 = new Record(entregaveisCol)
    ent3.set('etapa', et2.id)
    ent3.set('nome', 'Pranchas de Detalhamento de Formas e Armaduras')
    ent3.set('versao', 'Rev.00')
    ent3.set('status', 'elaborando')
    app.save(ent3)

    // 5. Documentos do Projeto 1 com Alertas D-30 / D-15 / D-7 / D-1
    const hoje = new Date()

    // Doc D-1 (vencendo amanhã)
    const dataD1 = new Date(hoje.getTime() + 1 * 24 * 60 * 60 * 1000)
    const docD1 = new Record(documentosCol)
    docD1.set('projeto', prj1.id)
    docD1.set('etapa', et1.id)
    docD1.set('tipo', 'OS')
    docD1.set('numero', 'OS-DER-2026/042')
    docD1.set('descricao', 'Ordem de Serviço de Início das Sondagens Complementares')
    docD1.set('responsavel_tecnico', 'Eng. Pedro Cabral')
    docD1.set('vencimento', dataD1.toISOString())
    app.save(docD1)

    // Doc D-7 (vencendo em 6 dias)
    const dataD7 = new Date(hoje.getTime() + 6 * 24 * 60 * 60 * 1000)
    const docD7 = new Record(documentosCol)
    docD7.set('projeto', prj1.id)
    docD7.set('tipo', 'ART')
    docD7.set('numero', '2802723024045')
    docD7.set('descricao', 'ART de Projeto de Fundação e Sondagem')
    docD7.set('responsavel_tecnico', 'Eng. Marcos Santos (CREA-SP 506123)')
    docD7.set('vencimento', dataD7.toISOString())
    app.save(docD7)

    // Doc D-15 (vencendo em 13 dias)
    const dataD15 = new Date(hoje.getTime() + 13 * 24 * 60 * 60 * 1000)
    const docD15 = new Record(documentosCol)
    docD15.set('projeto', prj1.id)
    docD15.set('tipo', 'TRT')
    docD15.set('numero', 'TRT-CFT-2026-99')
    docD15.set('descricao', 'Termo de Responsabilidade Técnica de Topografia Cadastral')
    docD15.set('responsavel_tecnico', 'Téc. Agrimensor Lucas Lima')
    docD15.set('vencimento', dataD15.toISOString())
    app.save(docD15)

    // Doc D-30 (vencendo em 25 dias)
    const dataD30 = new Date(hoje.getTime() + 25 * 24 * 60 * 60 * 1000)
    const docD30 = new Record(documentosCol)
    docD30.set('projeto', prj1.id)
    docD30.set('tipo', 'medicao')
    docD30.set('numero', 'BM-01/2026')
    docD30.set('descricao', 'Primeiro Boletim de Medição de Avanço Físico Contratual')
    docD30.set('vencimento', dataD30.toISOString())
    app.save(docD30)

    // 6. Riscos do Projeto 1 — Incluindo Risco ALTO / ALTO
    const rCritico = new Record(riscosCol)
    rCritico.set('projeto', prj1.id)
    rCritico.set(
      'descricao',
      'Interferência imprevista de adutora de grande diâmetro da SABESP no bloco do pilar central',
    )
    rCritico.set('probabilidade', 'alta')
    rCritico.set('impacto', 'alto')
    rCritico.set(
      'mitigacao',
      'Solicitar sondagem não-destrutiva por georradar imediata e reunião de alinhamento com a concessionária para eventual remanejamento.',
    )
    rCritico.set('status', 'aberto')
    app.save(rCritico)

    const r2 = new Record(riscosCol)
    r2.set('projeto', prj1.id)
    r2.set(
      'descricao',
      'Variação cambial no custo de importação dos cabos especiais de estaiamento',
    )
    r2.set('probabilidade', 'media')
    r2.set('impacto', 'alto')
    r2.set(
      'mitigacao',
      'Cláusula de reajuste automático e hedge cambial incluído na proposta comercial.',
    )
    r2.set('status', 'mitigado')
    app.save(r2)

    const r3 = new Record(riscosCol)
    r3.set('projeto', prj1.id)
    r3.set('descricao', 'Divergência menor em cotas de amarração topográfica')
    r3.set('probabilidade', 'baixa')
    r3.set('impacto', 'baixo')
    r3.set('mitigacao', 'Conferência em campo com estação total de precisão milimétrica.')
    r3.set('status', 'aberto')
    app.save(r3)

    // 7. Cotações na Etapa 3 (Comparação Lado a Lado)
    // Cotação 1: Roberto Albuquerque (com resposta)
    const cot1 = new Record(cotacoesCol)
    cot1.set('etapa', et3.id)
    cot1.set('executor', ex2.id)
    cot1.set(
      'escopo',
      'Elaboração completa do projeto de iluminação pública viária em LED e malha de aterramento/SPDA da ponte.',
    )
    cot1.set('prazo_resposta', '2026-06-30 23:59:59.000Z')
    cot1.set('preco_ofertado', 68000)
    cot1.set('prazo_ofertado', '25 dias corridos')
    cot1.set(
      'observacoes',
      'Inclusos diagramas unifilares, pranchas e memorial de cálculo luminotécnico no Dialux.',
    )
    cot1.set('status', 'respondida')
    cot1.set('data_resposta', '2026-05-10 14:20:00.000Z')
    cot1.set('escolhida', false)
    cot1.set('token', 'cot_token_seed_ex2_roberto_123')
    app.save(cot1)

    // Cotação 2: Klimat Soluções (com resposta mais barata porém nota menor)
    const cot2 = new Record(cotacoesCol)
    cot2.set('etapa', et3.id)
    cot2.set('executor', ex5BaixaNota.id)
    cot2.set(
      'escopo',
      'Elaboração completa do projeto de iluminação pública viária em LED e malha de aterramento/SPDA da ponte.',
    )
    cot2.set('prazo_resposta', '2026-06-30 23:59:59.000Z')
    cot2.set('preco_ofertado', 55000)
    cot2.set('prazo_ofertado', '35 dias úteis')
    cot2.set('observacoes', 'Não inclui modelagem em BIM, apenas CAD 2D.')
    cot2.set('status', 'respondida')
    cot2.set('data_resposta', '2026-05-11 09:15:00.000Z')
    cot2.set('escolhida', false)
    cot2.set('token', 'cot_token_seed_ex5_klimat_456')
    app.save(cot2)

    // Cotação 3: Vértice Engenharia (Aguardando resposta com token aberto)
    const cot3 = new Record(cotacoesCol)
    cot3.set('etapa', et3.id)
    cot3.set('executor', ex1.id)
    cot3.set(
      'escopo',
      'Elaboração completa do projeto de iluminação pública viária em LED e malha de aterramento/SPDA da ponte.',
    )
    cot3.set('prazo_resposta', '2026-06-30 23:59:59.000Z')
    cot3.set('status', 'convite_enviado')
    cot3.set('escolhida', false)
    cot3.set('token', 'cot_token_seed_ex1_vertice_789')
    app.save(cot3)
  },
  (app) => {
    // Rollback não destrutivo de seed
  },
)
