migrate(
  (app) => {
    // Garantir empresas em nutrição mensal nas curvas A, B e C
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const contatosCol = app.findCollectionByNameOrId('contatos')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const campanhasCol = app.findCollectionByNameOrId('campanhas')
    const enviosCol = app.findCollectionByNameOrId('campanha_envios')
    const modelosCol = app.findCollectionByNameOrId('modelos')

    // 1. Obter usuário comercial e admin para vincular
    let adminId = ''
    let comercialId = ''
    try {
      const uAdmin = app.findFirstRecordByData('users', 'role', 'admin')
      adminId = uAdmin.id
    } catch (_) {}
    try {
      const uComercial = app.findFirstRecordByData('users', 'role', 'comercial')
      comercialId = uComercial.id
    } catch (_) {}

    // 2. Criar ou verificar empresas em nutricao_mensal para curva A, B, C
    const empresasSeed = [
      {
        razao: 'Vértice Infraestrutura & Concessões S.A.',
        fantasia: 'Vértice Infra',
        cnpj: '71.229.384/0001-92',
        uf: 'SP',
        municipio: 'São Paulo',
        email: 'diretoria@verticeinfra.com.br',
        telefone: '(11) 3290-8800',
        curva: 'A',
        score: 92,
        etapa: 'nutricao_mensal',
        contrato_orgao: 'Secretaria de Infraestrutura e Meio Ambiente de SP',
        contrato_num: 'CT-2024/098',
        contrato_val: 18500000,
        obs: 'Entrou em nutrição após cadência de 5 toques sem fechamento no momento. Contrato bilionário de concessão.',
      },
      {
        razao: 'Novas Pontes e Estruturas Metálicas Ltda',
        fantasia: 'Novas Pontes',
        cnpj: '44.891.223/0001-15',
        uf: 'MG',
        municipio: 'Belo Horizonte',
        email: 'comercial@novaspontes.eng.br',
        telefone: '(31) 3450-1122',
        curva: 'B',
        score: 78,
        etapa: 'nutricao_mensal',
        contrato_orgao: 'DNIT - Departamento Nacional de Infraestrutura de Transportes',
        contrato_num: 'DNIT-449/2024',
        contrato_val: 3800000,
        obs: 'Recusa no Toque 3 por janela orçamentária; enviada para nutrição mensal com aprovação comercial.',
      },
      {
        razao: 'SondaGeo Topografia & Sondagens Técnicas Eireli',
        fantasia: 'SondaGeo Engenharia',
        cnpj: '28.190.445/0001-38',
        uf: 'PR',
        municipio: 'Curitiba',
        email: 'contato@sondageo.com.br',
        telefone: '(41) 3322-9900',
        curva: 'C',
        score: 55,
        etapa: 'nutricao_mensal',
        contrato_orgao: 'Prefeitura Municipal de Curitiba - SMOP',
        contrato_num: 'PMC-SMOP-112/2024',
        contrato_val: 620000,
        obs: 'Prestador regional de menor porte em nutrição de relacionamento institucional.',
      },
    ]

    const idsEmpresasNutricao = []

    for (let i = 0; i < empresasSeed.length; i++) {
      const eData = empresasSeed[i]
      let empRec
      try {
        empRec = app.findFirstRecordByData('empresas', 'cnpj', eData.cnpj)
        empRec.set('etapa_funil', 'nutricao_mensal')
        empRec.set('curva', eData.curva)
        empRec.set('score', eData.score)
        empRec.set('status', 'ativa')
        app.save(empRec)
      } catch (_) {
        empRec = new Record(empresasCol)
        empRec.set('razao_social', eData.razao)
        empRec.set('nome_fantasia', eData.fantasia)
        empRec.set('cnpj', eData.cnpj)
        empRec.set('uf', eData.uf)
        empRec.set('municipio', eData.municipio)
        empRec.set('email', eData.email)
        empRec.set('telefone', eData.telefone)
        empRec.set('etapa_funil', 'nutricao_mensal')
        empRec.set('curva', eData.curva)
        empRec.set('score', eData.score)
        empRec.set('status', 'ativa')
        empRec.set('observacoes', eData.obs)
        empRec.set('responsavel', comercialId || adminId)
        app.save(empRec)
      }
      idsEmpresasNutricao.push(empRec.id)

      // Criar contato se não houver
      try {
        app.findFirstRecordByData('contatos', 'empresa', empRec.id)
      } catch (_) {
        const cRec = new Record(contatosCol)
        cRec.set('empresa', empRec.id)
        cRec.set('nome', 'Diretor(a) de Obras / Suprimentos')
        cRec.set('cargo', 'Diretor de Operações')
        cRec.set('email', eData.email)
        cRec.set('telefone', eData.telefone)
        cRec.set('decisor', true)
        app.save(cRec)
      }

      // Criar contrato se não houver
      try {
        app.findFirstRecordByData('contratos', 'empresa', empRec.id)
      } catch (_) {
        const ctRec = new Record(contratosCol)
        ctRec.set('empresa', empRec.id)
        ctRec.set('orgao', eData.contrato_orgao)
        ctRec.set('numero', eData.contrato_num)
        ctRec.set('valor', eData.contrato_val)
        ctRec.set('saldo', eData.contrato_val)
        ctRec.set('situacao', 'ativo')
        ctRec.set('vigencia_inicio', '2024-01-15 00:00:00.000Z')
        ctRec.set('vigencia_fim', '2027-12-31 00:00:00.000Z')
        app.save(ctRec)
      }
    }

    // 3. Obter modelo de campanha padrão
    let modeloPadraoId = ''
    try {
      const m = app.findFirstRecordByData('modelos', 'tipo', 'campanha')
      modeloPadraoId = m.id
    } catch (_) {}

    // 4. Criar campanhas nos diferentes status para demonstração do fluxo:
    // (a) RASCUNHO (criado pelo Comercial, aguardando aprovação)
    // (b) DEVOLVIDA (Admin devolveu para o Comercial revisar o texto de chamada)
    // (c) APROVADA / AGENDADA (Admin aprovou e agendou para o dia 5)
    // (d) ENVIADA (campanha histórica do mês anterior com métricas reais/envios)

    // (a) RASCUNHO
    try {
      app.findFirstRecordByData(
        'campanhas',
        'nome',
        'Boletim Outubro — Desafios de Drenagem e Infra',
      )
    } catch (_) {
      const c1 = new Record(campanhasCol)
      c1.set('nome', 'Boletim Outubro — Desafios de Drenagem e Infra')
      c1.set('segmento', 'todos')
      c1.set('status', 'rascunho')
      c1.set('template', modeloPadraoId)
      c1.set('assunto', 'Atualizações Técnicas e Suporte de Engenharia em Obras com {orgao}')
      c1.set(
        'corpo',
        'Olá, {nome}!\n\nAcompanhamos as recentes entregas relacionadas ao contrato com {orgao} (R$ {valor_contrato}).\n\nDisponibilizamos nossa consultoria preliminar e equipes de sondagem/laudo técnico para otimizar os cronogramas críticos do quarto trimestre.\n\nDescadastro: {link_descadastro}',
      )
      c1.set('enviados', 0)
      c1.set('abertos', 0)
      c1.set('cliques', 0)
      c1.set('respostas', 0)
      c1.set('descadastros', 0)
      app.save(c1)
    }

    // (b) DEVOLVIDA
    try {
      app.findFirstRecordByData('campanhas', 'nome', 'Proposta de Apoio BIM para Curva A — Q4')
    } catch (_) {
      const c2 = new Record(campanhasCol)
      c2.set('nome', 'Proposta de Apoio BIM para Curva A — Q4')
      c2.set('segmento', 'A')
      c2.set('status', 'devolvida')
      c2.set('template', modeloPadraoId)
      c2.set('assunto', 'Modelagem BIM e Compatibilização Técnica para Grandes Contratos ({orgao})')
      c2.set(
        'corpo',
        'Prezado(a) {nome},\n\nPara o contrato com {orgao} no montante de R$ {valor_contrato}, nossa equipe estruturou um núcleo dedicado de modelagem BIM.\n\nFavor ajustar descadastro: {link_descadastro}',
      )
      c2.set(
        'observacao_devolucao',
        'Comercial: favor suavizar a menção comercial direta e reforçar primeiro os cases técnicos do setor público antes de agendarmos o envio.',
      )
      c2.set('enviados', 0)
      c2.set('abertos', 0)
      c2.set('cliques', 0)
      c2.set('respostas', 0)
      c2.set('descadastros', 0)
      app.save(c2)
    }

    // (c) AGENDADA
    let campAgendadaId = ''
    try {
      const c3Exist = app.findFirstRecordByData(
        'campanhas',
        'nome',
        'Informativo Mensal de Inovação Normativa — Curvas A e B',
      )
      campAgendadaId = c3Exist.id
    } catch (_) {
      const c3 = new Record(campanhasCol)
      c3.set('nome', 'Informativo Mensal de Inovação Normativa — Curvas A e B')
      c3.set('segmento', 'todos')
      c3.set('status', 'agendada')
      c3.set('template', modeloPadraoId)
      c3.set('data_envio', '2026-11-05 10:00:00.000Z')
      c3.set('aprovado_por', adminId)
      c3.set('aprovado_em', '2026-10-01 12:00:00.000Z')
      c3.set('assunto', 'Boletim de Engenharia: Gestão de Riscos Contratuais em {orgao}')
      c3.set(
        'corpo',
        'Prezado(a) {nome},\n\nCompartilhamos as notas técnicas referentes ao acompanhamento de fiscalização em órgãos como {orgao} (contrato R$ {valor_contrato}).\n\nDescadastro: {link_descadastro}',
      )
      c3.set('enviados', 0)
      c3.set('abertos', 0)
      c3.set('cliques', 0)
      c3.set('respostas', 0)
      c3.set('descadastros', 0)
      app.save(c3)
      campAgendadaId = c3.id
    }

    // (d) ENVIADA (com envios e métricas fictícias consolidadas)
    let campEnviadaId = ''
    try {
      const c4Exist = app.findFirstRecordByData(
        'campanhas',
        'nome',
        'Campanha de Nutrição — Setembro/2026',
      )
      campEnviadaId = c4Exist.id
    } catch (_) {
      const c4 = new Record(campanhasCol)
      c4.set('nome', 'Campanha de Nutrição — Setembro/2026')
      c4.set('segmento', 'todos')
      c4.set('status', 'enviada')
      c4.set('data_envio', '2026-09-05 09:30:00.000Z')
      c4.set('aprovado_por', adminId)
      c4.set('aprovado_em', '2026-09-04 15:00:00.000Z')
      c4.set('template', modeloPadraoId)
      c4.set('assunto', 'Atualizações de Engenharia — Setembro/2026')
      c4.set(
        'corpo',
        'Prezado(a) {nome},\n\nInformativo mensal com atualizações das normas ABNT e suporte para seu contrato em {orgao} (R$ {valor_contrato}).\n\nDescadastro: {link_descadastro}',
      )
      c4.set('enviados', 3)
      c4.set('abertos', 2)
      c4.set('cliques', 1)
      c4.set('respostas', 1)
      c4.set('descadastros', 0)
      app.save(c4)
      campEnviadaId = c4.id

      // Criar registros individuais em campanha_envios para demonstrar métricas por destinatário
      if (idsEmpresasNutricao.length >= 3) {
        // Envio 1: Aberto e clicado e respondeu
        const e1 = new Record(enviosCol)
        e1.set('campanha', c4.id)
        e1.set('empresa', idsEmpresasNutricao[0])
        e1.set('destinatario_email', 'diretoria@verticeinfra.com.br')
        e1.set('destinatario_nome', 'Diretoria Vértice Infra')
        e1.set('status', 'enviado')
        e1.set('token_rastreamento', 'seed-tok-vertice-001')
        e1.set('enviado_em', '2026-09-05 09:30:10.000Z')
        e1.set('aberto_em', '2026-09-05 11:20:00.000Z')
        e1.set('total_aberturas', 2)
        e1.set('cliques', 1)
        e1.set('ultimo_clique_em', '2026-09-05 11:25:00.000Z')
        e1.set('resposta_em', '2026-09-06 14:00:00.000Z')
        e1.set(
          'resposta_observacao',
          'Diretoria solicitou orçamento para laudo estrutural de recuperação.',
        )
        app.save(e1)

        // Envio 2: Apenas aberto
        const e2 = new Record(enviosCol)
        e2.set('campanha', c4.id)
        e2.set('empresa', idsEmpresasNutricao[1])
        e2.set('destinatario_email', 'comercial@novaspontes.eng.br')
        e2.set('destinatario_nome', 'Engenharia Novas Pontes')
        e2.set('status', 'enviado')
        e2.set('token_rastreamento', 'seed-tok-pontes-002')
        e2.set('enviado_em', '2026-09-05 09:30:15.000Z')
        e2.set('aberto_em', '2026-09-05 16:45:00.000Z')
        e2.set('total_aberturas', 1)
        e2.set('cliques', 0)
        app.save(e2)

        // Envio 3: Enviado sem abertura ainda
        const e3 = new Record(enviosCol)
        e3.set('campanha', c4.id)
        e3.set('empresa', idsEmpresasNutricao[2])
        e3.set('destinatario_email', 'contato@sondageo.com.br')
        e3.set('destinatario_nome', 'SondaGeo Contato')
        e3.set('status', 'enviado')
        e3.set('token_rastreamento', 'seed-tok-sondageo-003')
        e3.set('enviado_em', '2026-09-05 09:30:20.000Z')
        e3.set('total_aberturas', 0)
        e3.set('cliques', 0)
        app.save(e3)
      }
    }
  },
  (app) => {},
)
