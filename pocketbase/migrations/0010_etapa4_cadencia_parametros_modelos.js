migrate(
  (app) => {
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'toque2_dias',
        valor: '2',
        descricao: 'Dias decorridos após início da cadência para o Toque 2 (WhatsApp)',
      },
      {
        chave: 'toque3_dias',
        valor: '7',
        descricao: 'Dias decorridos após início da cadência para o Toque 3 (E-mail)',
      },
      {
        chave: 'toque4_dias_inicio',
        valor: '10',
        descricao: 'Início da janela em dias para o Toque 4 (WhatsApp)',
      },
      {
        chave: 'toque4_dias_fim',
        valor: '14',
        descricao: 'Fim da janela em dias para o Toque 4 (WhatsApp)',
      },
      {
        chave: 'toque5_dias',
        valor: '30',
        descricao: 'Dias para execução do Toque 5 de encerramento (E-mail)',
      },
      {
        chave: 'toque5_janela_dias',
        valor: '31',
        descricao: 'Janela final em dias para execução do Toque 5',
      },
      {
        chave: 'dias_limite_atraso_toque',
        valor: '5',
        descricao: 'Dias de atraso tolerado no toque antes de alerta crítico para Administrador',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      try {
        const existing = app.findFirstRecordByData('parametros', 'chave', p.chave)
        existing.set('valor', p.valor)
        existing.set('descricao', p.descricao)
        app.save(existing)
      } catch (_) {
        const record = new Record(parametrosCol)
        record.set('chave', p.chave)
        record.set('valor', p.valor)
        record.set('descricao', p.descricao)
        app.save(record)
      }
    }

    // 2. Atualizar ou inserir Modelos oficiais de Toques com link de descadastro obrigatório
    const modelosCol = app.findCollectionByNameOrId('modelos')

    const templatesCadencia = [
      {
        nome: 'Toque 1 - Institucional',
        tipo: 'email_institucional',
        assunto: 'Apoio de Engenharia Consultiva para {orgao} — Contrato Ativo',
        corpo:
          'Prezado(a) {nome},\n\n' +
          'Acompanhamos com entusiasmo o contrato firmado com o órgão {orgao}, no montante estimado de R$ {valor_contrato}.\n\n' +
          'Atuamos como integradores e parceiros técnicos especializados na intermediação e gestão de engenharia, disponibilizando corpo técnico homologado para laudos, projetos complementares e acompanhamento de campo, permitindo que sua equipe foque integralmente na execução contratual principal.\n\n' +
          'Gostaríamos de apresentar brevemente nossas credenciais e entender se há demandas imediatas de disciplinas complementares.\n\n' +
          'Atenciosamente,\n' +
          'Equipe de Engenharia e Parcerias Públicas\n\n' +
          '---\n' +
          'Caso não deseje mais receber comunicações comerciais sobre este contrato, solicite seu descadastro através do link seguro:\n' +
          '{link_descadastro}',
      },
      {
        nome: 'Toque 3 - Solução Elaborada',
        tipo: 'solucao_elaborada',
        assunto: 'Solução Técnica Integrada para o contrato {orgao}',
        corpo:
          'Olá, {nome}.\n\n' +
          'Retomamos nosso contato referente ao contrato de engenharia com {orgao} (R$ {valor_contrato}).\n\n' +
          'Mapeamos os principais gargalos normativos e de cronograma frequentemente enfrentados em obras similares e elaboramos uma proposta de solução técnica com responsáveis técnicos habilitados (ART/RRT) prontos para mobilização imediata.\n\n' +
          'Teria disponibilidade para uma rápida conversa técnica nesta semana?\n\n' +
          'Atenciosamente,\n' +
          'Coordenação Técnica de Parcerias\n\n' +
          '---\n' +
          'Para não receber mais comunicados desta cadência, clique no link de descadastro:\n' +
          '{link_descadastro}',
      },
      {
        nome: 'Toque 5 - Projeto Piloto',
        tipo: 'piloto',
        assunto: 'Projeto Piloto sem Risco — Execução de Etapa para {orgao}',
        corpo:
          'Prezado(a) {nome},\n\n' +
          'Chegamos à etapa final de nossa apresentação para a demanda de {orgao} (R$ {valor_contrato}).\n\n' +
          'Sabemos que a contratação de novos parceiros requer máxima segurança técnica e conformidade. Por isso, oferecemos a possibilidade de executar uma etapa piloto ou laudo específico preliminar, validando na prática nosso padrão de entrega sem comprometer o fluxo financeiro do contrato principal.\n\n' +
          'Ficamos à disposição caso faça sentido avançarmos agora ou em futuros aditivos.\n\n' +
          'Atenciosamente,\n' +
          'Diretoria Técnica e Operacional\n\n' +
          '---\n' +
          'Se preferir interromper em definitivo os nossos contatos, utilize o link de descadastro abaixo:\n' +
          '{link_descadastro}',
      },
    ]

    for (let j = 0; j < templatesCadencia.length; j++) {
      const t = templatesCadencia[j]
      try {
        const existing = app.findFirstRecordByData('modelos', 'nome', t.nome)
        existing.set('tipo', t.tipo)
        existing.set('assunto', t.assunto)
        existing.set('corpo', t.corpo)
        app.save(existing)
      } catch (_) {
        const record = new Record(modelosCol)
        record.set('nome', t.nome)
        record.set('tipo', t.tipo)
        record.set('assunto', t.assunto)
        record.set('corpo', t.corpo)
        app.save(record)
      }
    }
  },
  (app) => {
    // Reversão opcional
  },
)
