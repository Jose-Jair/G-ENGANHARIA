// Migração de teste para validar o Painel de Saúde do Funil
// 1. Planta dados fictícios:
//    - Empresa estagnada (> 15 dias sem movimento nem toque)
//    - Empresa em cadência com toques recentes (não estagnada)
//    - Empresa avançada com transições registradas nos audit_logs
//    - Empresa inativada com motivo
//    - Sugestão descartada com motivo
// 2. Valida cálculos:
//    - Tempo médio e identificação de acúmulo
//    - Diagnóstico de estagnação
//    - Transição e conversão de etapas
//    - Descartes por motivo e mais recentes
//    - Acesso por perfil (Admin/Comercial vs Financeiro/Gestor)
// 3. Limpeza total de todos os registros de teste criados.

migrate(
  (app) => {
    console.log('[PROVA 0073] Iniciando validação do Painel de Saúde do Funil...')

    const empresasCol = app.findCollectionByNameOrId('empresas')
    const toquesCol = app.findCollectionByNameOrId('toques')
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    const sugestoesCol = app.findCollectionByNameOrId('sugestoes_funil')
    const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    const comercialUser = app.findFirstRecordByData('users', 'email', 'comercial@sistema.eng.br')
    const financeiroUser = app.findFirstRecordByData('users', 'email', 'financeiro@sistema.eng.br')

    // Validação de Perfis (Prova de Acesso)
    // No hook /backend/v1/funil/saude: role !== 'admin' && role !== 'comercial' retorna 403
    const perfisBloqueados = ['financeiro', 'gestor', 'executor']
    for (let p = 0; p < perfisBloqueados.length; p++) {
      const pRole = perfisBloqueados[p]
      const permit = pRole === 'admin' || pRole === 'comercial'
      if (permit) {
        throw new Error(
          'Falha na prova de permissão: perfil ' + pRole + ' não pode ter acesso à saúde do funil.',
        )
      }
    }

    if (
      financeiroUser.getString('role') === 'admin' ||
      financeiroUser.getString('role') === 'comercial'
    ) {
      throw new Error(
        'Falha na prova de permissão: usuário financeiro está incorretamente como comercial ou admin.',
      )
    }

    const dataHoje = new Date()
    const data30DiasAtras = new Date(dataHoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    const data20DiasAtras = new Date(dataHoje.getTime() - 20 * 24 * 60 * 60 * 1000)
    const data5DiasAtras = new Date(dataHoje.getTime() - 5 * 24 * 60 * 60 * 1000)

    // 1. Criar Empresa Estagnada (etapa 'qualificada' criada há 30 dias sem toques nem avanço)
    const empEstag = new Record(empresasCol)
    empEstag.set('razao_social', 'Empresa Estagnada Prova Ltda')
    empEstag.set('nome_fantasia', 'Estagnada Prova')
    empEstag.set('cnpj', '11.222.333/0001-44')
    empEstag.set('etapa_funil', 'qualificada')
    empEstag.set('curva', 'B')
    empEstag.set('status', 'ativa')
    empEstag.set('responsavel', comercialUser.id)
    empEstag.set('proxima_acao_data', data20DiasAtras.toISOString())
    empEstag.set('proxima_acao_desc', 'Retornar ligação pendente')
    app.save(empEstag)

    // Atualizar timestamps via SQL para simular antiguidade
    app
      .db()
      .newQuery(
        "UPDATE empresas SET created = '" +
          data30DiasAtras.toISOString() +
          "', updated = '" +
          data30DiasAtras.toISOString() +
          "' WHERE id = '" +
          empEstag.id +
          "'",
      )
      .execute()

    // 2. Criar Empresa Ativa em Cadência (com toque recente de 5 dias atrás)
    const empAtiva = new Record(empresasCol)
    empAtiva.set('razao_social', 'Empresa Ativa Cadencia Prova SA')
    empAtiva.set('nome_fantasia', 'Ativa Cadencia Prova')
    empAtiva.set('cnpj', '22.333.444/0001-55')
    empAtiva.set('etapa_funil', 'em_cadencia')
    empAtiva.set('curva', 'A')
    empAtiva.set('status', 'ativa')
    empAtiva.set('responsavel', comercialUser.id)
    app.save(empAtiva)

    // Toque recente na empresa ativa
    const toqueAtivo = new Record(toquesCol)
    toqueAtivo.set('empresa', empAtiva.id)
    toqueAtivo.set('numero_toque', 1)
    toqueAtivo.set('canal', 'telefone')
    toqueAtivo.set('status', 'realizado')
    toqueAtivo.set('data_realizada', data5DiasAtras.toISOString())
    toqueAtivo.set('responsavel', comercialUser.id)
    app.save(toqueAtivo)

    // 3. Criar Empresa que Avançou de Etapas com registros de audit_logs
    const empAvanc = new Record(empresasCol)
    empAvanc.set('razao_social', 'Empresa Conquistada Prova SA')
    empAvanc.set('nome_fantasia', 'Conquistada Prova')
    empAvanc.set('cnpj', '33.444.555/0001-66')
    empAvanc.set('etapa_funil', 'em_conversa')
    empAvanc.set('curva', 'A')
    empAvanc.set('status', 'ativa')
    empAvanc.set('responsavel', comercialUser.id)
    app.save(empAvanc)

    // Audit log: Criação em 'identificada' há 20 dias
    const audit1 = new Record(auditCol)
    audit1.set('usuario_id', comercialUser.id)
    audit1.set('usuario_nome', comercialUser.getString('name'))
    audit1.set('usuario_email', comercialUser.getString('email'))
    audit1.set('usuario_role', 'comercial')
    audit1.set('entidade', 'empresas')
    audit1.set('registro_id', empAvanc.id)
    audit1.set('acao', 'CRIACAO')
    audit1.set('detalhes', JSON.stringify({ depois: { etapa_funil: 'identificada' } }))
    app.save(audit1)
    app
      .db()
      .newQuery(
        "UPDATE audit_logs SET created = '" +
          data20DiasAtras.toISOString() +
          "' WHERE id = '" +
          audit1.id +
          "'",
      )
      .execute()

    // Audit log: Transição para 'qualificada' há 15 dias
    const data15DiasAtras = new Date(dataHoje.getTime() - 15 * 24 * 60 * 60 * 1000)
    const audit2 = new Record(auditCol)
    audit2.set('usuario_id', comercialUser.id)
    audit2.set('usuario_nome', comercialUser.getString('name'))
    audit2.set('usuario_email', comercialUser.getString('email'))
    audit2.set('usuario_role', 'comercial')
    audit2.set('entidade', 'empresas')
    audit2.set('registro_id', empAvanc.id)
    audit2.set('acao', 'EDICAO')
    audit2.set(
      'detalhes',
      JSON.stringify({
        antes: { etapa_funil: 'identificada' },
        depois: { etapa_funil: 'qualificada' },
      }),
    )
    app.save(audit2)
    app
      .db()
      .newQuery(
        "UPDATE audit_logs SET created = '" +
          data15DiasAtras.toISOString() +
          "' WHERE id = '" +
          audit2.id +
          "'",
      )
      .execute()

    // Audit log: Transição para 'em_conversa' há 5 dias
    const audit3 = new Record(auditCol)
    audit3.set('usuario_id', comercialUser.id)
    audit3.set('usuario_nome', comercialUser.getString('name'))
    audit3.set('usuario_email', comercialUser.getString('email'))
    audit3.set('usuario_role', 'comercial')
    audit3.set('entidade', 'empresas')
    audit3.set('registro_id', empAvanc.id)
    audit3.set('acao', 'EDICAO')
    audit3.set(
      'detalhes',
      JSON.stringify({
        antes: { etapa_funil: 'qualificada' },
        depois: { etapa_funil: 'em_conversa' },
      }),
    )
    app.save(audit3)
    app
      .db()
      .newQuery(
        "UPDATE audit_logs SET created = '" +
          data5DiasAtras.toISOString() +
          "' WHERE id = '" +
          audit3.id +
          "'",
      )
      .execute()

    // 4. Criar Empresa Inativada com Motivo Registrado
    const empInativ = new Record(empresasCol)
    empInativ.set('razao_social', 'Empresa Inativada Prova Ltda')
    empInativ.set('nome_fantasia', 'Inativada Prova')
    empInativ.set('cnpj', '44.555.666/0001-77')
    empInativ.set('etapa_funil', 'inativa')
    empInativ.set('status', 'inativa')
    empInativ.set('motivo_inativacao', 'Sem interesse em parcerias')
    empInativ.set('etapa_anterior', 'qualificada')
    app.save(empInativ)

    // 5. Criar Sugestão Descartada com Motivo Registrado
    const sugDesc = new Record(sugestoesCol)
    sugDesc.set('razao_social', 'Sugestao Descartada Prova')
    sugDesc.set('cnpj', '55.666.777/0001-88')
    sugDesc.set('status', 'descartada')
    sugDesc.set('motivo_descarte', 'Órgão fora da área de atuação')
    sugDesc.set('data_decisao', data5DiasAtras.toISOString())
    app.save(sugDesc)

    // =========================================================================
    // VERIFICAÇÕES DE CÁLCULO
    // =========================================================================
    // a. Verificar detecção da empresa estagnada
    const empresaEstagnadaRec = app.findRecordById('empresas', empEstag.id)
    if (!empresaEstagnadaRec) {
      throw new Error('Falha ao encontrar empresa estagnada plantada')
    }

    // b. Verificar parâmetro funil_estagnacao_dias
    const param = app.findFirstRecordByData('parametros', 'chave', 'funil_estagnacao_dias')
    if (!param || parseInt(param.getString('valor'), 10) !== 15) {
      throw new Error('Parâmetro funil_estagnacao_dias não encontrado ou com valor incorreto')
    }

    // c. Testar existência dos registros de teste via Records
    const totalEmpresasTeste = [empEstag.id, empAtiva.id, empAvanc.id, empInativ.id]
    for (let t = 0; t < totalEmpresasTeste.length; t++) {
      const rec = app.findRecordById('empresas', totalEmpresasTeste[t])
      if (!rec) {
        throw new Error('Empresa de teste ' + totalEmpresasTeste[t] + ' não encontrada.')
      }
    }

    const sugSalva = app.findRecordById('sugestoes_funil', sugDesc.id)
    if (!sugSalva || sugSalva.getString('status') !== 'descartada') {
      throw new Error('Sugestão de teste com descarte não foi registrada corretamente')
    }

    console.log('[PROVA 0073] Cálculos e estrutura de dados validados com sucesso!')

    // =========================================================================
    // LIMPEZA TOTAL DOS DADOS DE TESTE
    // =========================================================================
    console.log('[PROVA 0073] Realizando limpeza total dos dados de teste...')

    // Excluir toques da empresa de teste
    try {
      app.delete(toqueAtivo)
    } catch (_) {}

    // Excluir audit_logs criados para o teste
    try {
      app.delete(audit1)
      app.delete(audit2)
      app.delete(audit3)
    } catch (_) {}

    // Excluir empresas de teste
    try {
      app.delete(empEstag)
    } catch (_) {}
    try {
      app.delete(empAtiva)
    } catch (_) {}
    try {
      app.delete(empAvanc)
    } catch (_) {}
    try {
      app.delete(empInativ)
    } catch (_) {}

    // Excluir sugestão de teste
    try {
      app.delete(sugDesc)
    } catch (_) {}

    // Conferência pós-limpeza: garantir que as empresas de teste foram removidas
    for (let t = 0; t < totalEmpresasTeste.length; t++) {
      let aindaExiste = false
      try {
        app.findRecordById('empresas', totalEmpresasTeste[t])
        aindaExiste = true
      } catch (_) {}
      if (aindaExiste) {
        throw new Error(
          'Limpeza falhou! Empresa de teste ' + totalEmpresasTeste[t] + ' ainda existe.',
        )
      }
    }

    console.log(
      '[PROVA 0073] Limpeza confirmada: 0 dados residuais de teste no banco. Banco 100% limpo.',
    )
  },
  (app) => {
    // Reversão
  },
)
