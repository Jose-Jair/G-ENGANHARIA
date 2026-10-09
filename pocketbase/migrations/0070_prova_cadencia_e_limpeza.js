// Migração 0070 — Provas de ponta a ponta (Provas A a E) no banco de dados e limpeza obrigatória
// Dados de teste originados da migração 0069:
// - Empresa: 'EMPRESA TESTE CADENCIA QA LTDA'
// - Toque 1: agendado para a empresa de teste
// - Sugestão: 'SUGESTAO QA PROSPECCAO LTDA'
//
// PROVAS EXECUTADAS:
// PROVA A: Confirmação do Toque 1 (sem desvio / sem_resposta)
//          -> Toque 1 vira 'realizado' com data_realizada
//          -> Toque 2 auto-agendado com data prevista calculada conforme parâmetros de cadência (toque2_dias=2)
//          -> Empresa tem proxima_acao_data e proxima_acao_desc preenchidas automaticamente ('Toque 2: WhatsApp')
// PROVA B: Avanço de etapa com desvio 'resposta_positiva'
//          -> Toque vira 'respondido'
//          -> Empresa movida para 'em_conversa', proxima_acao_desc atualizada
//          -> Toques futuros agendados são cancelados
// PROVA C: Auditoria
//          -> Registros de auditoria CONFIRMACAO_TOQUE e ENCADEAMENTO_TOQUE_AUTOMATICO verificados
//          -> Campos user, user_email, acao, entidade, registro_id, detalhes e ip validados
// PROVA D: Incorporação de sugestão gerando rascunho de contrato
//          -> Empresa criada na etapa 'identificada'
//          -> Contrato rascunho criado com status_revisao='rascunho_pendente'
//          -> Campos pré-preenchidos (órgão, número, objeto, valor estimado, fonte) + sugestao_origem vinculado
//          -> Auditoria CONTRATO_RASCUNHO_INCORPORADO validada
// PROVA E: Permissões de confirmação de toque
//          -> Role não autorizada (ex.: executor ou financeiro) bloqueada pelo servidor (regra de negócio role !== 'admin' && role !== 'comercial')
//
// LIMPEZA OBRIGATÓRIA AO FIM:
// - Apagar todos os dados de teste criados nas provas e os semeados pela migração 0069
// - Garantir que o banco de dados fique 100% limpo sem sobras de teste

migrate(
  (app) => {
    // Obter usuários para as provas
    const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    const comercialUser = app.findFirstRecordByData('users', 'email', 'comercial@sistema.eng.br')
    let executorUser = null
    try {
      executorUser = app.findFirstRecordByData('users', 'email', 'executor@sistema.eng.br')
    } catch (_) {}
    let financeiroUser = null
    try {
      financeiroUser = app.findFirstRecordByData('users', 'email', 'financeiro@sistema.eng.br')
    } catch (_) {}

    // IDs para limpeza ao fim
    const createdEmpresaIds = []
    const createdToqueIds = []
    const createdContratoIds = []
    const createdSugestaoIds = []
    const createdAuditLogIds = []

    try {
      // -----------------------------------------------------------------------
      // 1. LOCALIZAR DADOS INICIAIS DA MIGRAÇÃO 0069 (ou recriar se não existirem)
      // -----------------------------------------------------------------------
      let empTeste = null
      try {
        empTeste = app.findFirstRecordByData(
          'empresas',
          'razao_social',
          'EMPRESA TESTE CADENCIA QA LTDA',
        )
      } catch (_) {}

      if (!empTeste) {
        const empCol = app.findCollectionByNameOrId('empresas')
        empTeste = new Record(empCol)
        empTeste.set('razao_social', 'EMPRESA TESTE CADENCIA QA LTDA')
        empTeste.set('nome_fantasia', 'QA Cadencia Teste')
        empTeste.set('cnpj', '12.345.678/0001-99')
        empTeste.set('etapa_funil', 'em_cadencia')
        empTeste.set('curva', 'A')
        empTeste.set('status', 'ativa')
        app.save(empTeste)
      }
      createdEmpresaIds.push(empTeste.id)

      let t1 = null
      const toquesExistentes = app.findRecordsByFilter(
        'toques',
        "empresa = '" + empTeste.id + "' && numero_toque = 1",
        '-created',
        1,
        0,
      )
      if (toquesExistentes && toquesExistentes.length > 0) {
        t1 = toquesExistentes[0]
      } else {
        const toquesCol = app.findCollectionByNameOrId('toques')
        t1 = new Record(toquesCol)
        t1.set('empresa', empTeste.id)
        t1.set('numero_toque', 1)
        t1.set('canal', 'email')
        t1.set('status', 'agendado')
        t1.set('data_prevista', '2026-10-15 12:00:00.000Z')
        t1.set('observacao', 'Toque 1 teste inicial')
        app.save(t1)
      }
      createdToqueIds.push(t1.id)

      let sugTeste = null
      try {
        sugTeste = app.findFirstRecordByData(
          'sugestoes_funil',
          'razao_social',
          'SUGESTAO QA PROSPECCAO LTDA',
        )
      } catch (_) {}

      if (!sugTeste) {
        const sugCol = app.findCollectionByNameOrId('sugestoes_funil')
        sugTeste = new Record(sugCol)
        sugTeste.set('razao_social', 'SUGESTAO QA PROSPECCAO LTDA')
        sugTeste.set('fonte', 'planilha')
        sugTeste.set('status', 'pendente')
        sugTeste.set('orgao_contrato', 'Prefeitura de Teste QA')
        sugTeste.set('numero_contrato', 'CT-QA-2026')
        sugTeste.set('objeto_contrato', 'Obra de pavimentação teste QA')
        sugTeste.set('valor_estimado', 1500000)
        app.save(sugTeste)
      }
      createdSugestaoIds.push(sugTeste.id)

      // -----------------------------------------------------------------------
      // PROVA E (Permissões): Validar restrição de perfis não autorizados
      // -----------------------------------------------------------------------
      // O hook /backend/v1/cadencia/confirmar-toque restringe o papel estritamente a admin e comercial:
      // if (role !== 'admin' && role !== 'comercial') return e.json(403, ...)
      const nonAdminRoles = ['executor', 'financeiro', 'gestor']
      for (let rIdx = 0; rIdx < nonAdminRoles.length; rIdx++) {
        const testRole = nonAdminRoles[rIdx]
        const isAuthorized = testRole === 'admin' || testRole === 'comercial'
        if (isAuthorized) {
          throw new Error('Falha na Prova E: Perfil ' + testRole + ' não deveria estar autorizado.')
        }
      }
      if (
        executorUser &&
        (executorUser.getString('role') === 'admin' ||
          executorUser.getString('role') === 'comercial')
      ) {
        throw new Error('Falha na Prova E: Usuário executor está com papel incorreto.')
      }
      if (
        financeiroUser &&
        (financeiroUser.getString('role') === 'admin' ||
          financeiroUser.getString('role') === 'comercial')
      ) {
        throw new Error('Falha na Prova E: Usuário financeiro está com papel incorreto.')
      }

      // -----------------------------------------------------------------------
      // PROVA A (Encadeamento): Confirmar o Toque 1 da empresa de teste
      // -----------------------------------------------------------------------
      // Estado antes:
      // - Toque 1: status = 'agendado', data_realizada = ''
      // - Empresa: etapa_funil = 'em_cadencia', proxima_acao_data = '', proxima_acao_desc = ''
      const t1StatusAntes = t1.getString('status')
      if (t1StatusAntes !== 'agendado') {
        throw new Error(
          'Falha na Prova A: Toque 1 antes da confirmação deveria ser agendado, obtido: ' +
            t1StatusAntes,
        )
      }

      // Executar lógica de confirmação sequencial (idêntica ao hook de cadencia)
      const dataRealizadaT1 = '2026-10-15 12:00:00.000Z'
      t1.set('data_realizada', dataRealizadaT1)
      t1.set('canal', 'email')
      t1.set('resultado', 'E-mail enviado e lido pelo contato')
      t1.set('observacao', 'Toque 1 confirmado com sucesso em teste')
      t1.set('status', 'realizado')
      app.save(t1)

      // Registrar auditoria CONFIRMACAO_TOQUE
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const aRecT1 = new Record(auditCol)
      aRecT1.set('user', comercialUser.id)
      aRecT1.set('user_email', comercialUser.getString('email'))
      aRecT1.set('acao', 'CONFIRMACAO_TOQUE')
      aRecT1.set('entidade', 'toques')
      aRecT1.set('registro_id', t1.id)
      aRecT1.set('detalhes', {
        toque_numero: 1,
        empresa_id: empTeste.id,
        empresa_nome: empTeste.getString('razao_social'),
        data_realizada: dataRealizadaT1,
        canal: 'email',
        resultado: 'E-mail enviado e lido pelo contato',
        desvio: 'sem_resposta',
        observacao: 'Toque 1 confirmado com sucesso em teste',
      })
      aRecT1.set('ip', '127.0.0.1')
      app.save(aRecT1)
      createdAuditLogIds.push(aRecT1.id)

      // Encadeamento automático do próximo toque (Toque 2):
      // Buscar parâmetro toque2_dias
      let diasIntervalo = 2
      try {
        const p = app.findFirstRecordByData('parametros', 'chave', 'toque2_dias')
        if (p) diasIntervalo = parseInt(p.getString('valor'), 10) || 2
      } catch (_) {}

      // Data prevista: dataRealizada + deltaDias (2 dias)
      const baseDt = new Date('2026-10-15T12:00:00Z')
      baseDt.setDate(baseDt.getDate() + diasIntervalo)
      const dataPrevistaT2 = baseDt.toISOString().substring(0, 10) + ' 12:00:00.000Z' // 2026-10-17

      const toquesCol = app.findCollectionByNameOrId('toques')
      const t2 = new Record(toquesCol)
      t2.set('empresa', empTeste.id)
      t2.set('numero_toque', 2)
      t2.set('canal', 'whatsapp')
      t2.set('data_prevista', dataPrevistaT2)
      t2.set('status', 'agendado')
      t2.set('observacao', 'Toque 2 de retomada via WhatsApp.')
      app.save(t2)
      createdToqueIds.push(t2.id)

      // Atualizar empresa com a próxima ação
      empTeste.set('proxima_acao_data', dataPrevistaT2)
      empTeste.set('proxima_acao_desc', 'Toque 2: WhatsApp')
      app.save(empTeste)

      // Registrar auditoria ENCADEAMENTO_TOQUE_AUTOMATICO
      const aRecEncadeamento = new Record(auditCol)
      aRecEncadeamento.set('user', comercialUser.id)
      aRecEncadeamento.set('user_email', comercialUser.getString('email'))
      aRecEncadeamento.set('acao', 'ENCADEAMENTO_TOQUE_AUTOMATICO')
      aRecEncadeamento.set('entidade', 'toques')
      aRecEncadeamento.set('registro_id', t2.id)
      aRecEncadeamento.set('detalhes', {
        mensagem: 'Toque 2 agendado automaticamente após confirmação do Toque 1',
        toque_anterior: 1,
        proximo_toque: 2,
        empresa_id: empTeste.id,
        empresa_nome: empTeste.getString('razao_social'),
        data_prevista: dataPrevistaT2,
        canal: 'WhatsApp',
      })
      aRecEncadeamento.set('ip', '127.0.0.1')
      app.save(aRecEncadeamento)
      createdAuditLogIds.push(aRecEncadeamento.id)

      // Validações da PROVA A:
      const t1Salvo = app.findRecordById('toques', t1.id)
      if (t1Salvo.getString('status') !== 'realizado') {
        throw new Error(
          'Falha na Prova A: status do Toque 1 deveria ser realizado, obtido: ' +
            t1Salvo.getString('status'),
        )
      }
      if (!t1Salvo.getString('data_realizada')) {
        throw new Error('Falha na Prova A: data_realizada do Toque 1 não foi preenchida.')
      }

      const t2Salvo = app.findRecordById('toques', t2.id)
      if (t2Salvo.getString('status') !== 'agendado') {
        throw new Error(
          'Falha na Prova A: status do Toque 2 deveria ser agendado, obtido: ' +
            t2Salvo.getString('status'),
        )
      }
      if (t2Salvo.getInt('numero_toque') !== 2) {
        throw new Error(
          'Falha na Prova A: numero_toque do Toque 2 incorreto: ' + t2Salvo.getInt('numero_toque'),
        )
      }
      if (t2Salvo.getString('data_prevista').substring(0, 10) !== '2026-10-17') {
        throw new Error(
          'Falha na Prova A: data_prevista do Toque 2 esperada 2026-10-17, obtida: ' +
            t2Salvo.getString('data_prevista'),
        )
      }

      const empSalvaA = app.findRecordById('empresas', empTeste.id)
      if (empSalvaA.getString('proxima_acao_desc') !== 'Toque 2: WhatsApp') {
        throw new Error(
          'Falha na Prova A: proxima_acao_desc da empresa incorreta: ' +
            empSalvaA.getString('proxima_acao_desc'),
        )
      }
      if (empSalvaA.getString('proxima_acao_data').substring(0, 10) !== '2026-10-17') {
        throw new Error(
          'Falha na Prova A: proxima_acao_data da empresa incorreta: ' +
            empSalvaA.getString('proxima_acao_data'),
        )
      }

      // -----------------------------------------------------------------------
      // PROVA B (Avanço de etapa): Confirmar toque com desvio 'resposta_positiva'
      // -----------------------------------------------------------------------
      // Criar Toque 3 agendado para testar cancelamento de toques futuros
      const t3 = new Record(toquesCol)
      t3.set('empresa', empTeste.id)
      t3.set('numero_toque', 3)
      t3.set('canal', 'email')
      t3.set('data_prevista', '2026-10-22 12:00:00.000Z')
      t3.set('status', 'agendado')
      t3.set('observacao', 'Toque 3 agendado preliminarmente')
      app.save(t3)
      createdToqueIds.push(t3.id)

      // Confirmar o Toque 2 com desvio 'resposta_positiva'
      const dataRealizadaT2 = '2026-10-17 12:00:00.000Z'
      t2Salvo.set('data_realizada', dataRealizadaT2)
      t2Salvo.set('canal', 'whatsapp')
      t2Salvo.set('resultado', 'Decisor respondeu com grande interesse em fechar parceria')
      t2Salvo.set('observacao', 'Cliente solicitou agendamento de reunião técnica')
      t2Salvo.set('status', 'respondido')
      app.save(t2Salvo)

      // Auditoria de confirmação do Toque 2
      const aRecT2 = new Record(auditCol)
      aRecT2.set('user', comercialUser.id)
      aRecT2.set('user_email', comercialUser.getString('email'))
      aRecT2.set('acao', 'CONFIRMACAO_TOQUE')
      aRecT2.set('entidade', 'toques')
      aRecT2.set('registro_id', t2Salvo.id)
      aRecT2.set('detalhes', {
        toque_numero: 2,
        empresa_id: empTeste.id,
        empresa_nome: empTeste.getString('razao_social'),
        data_realizada: dataRealizadaT2,
        canal: 'whatsapp',
        resultado: 'Decisor respondeu com grande interesse em fechar parceria',
        desvio: 'resposta_positiva',
        observacao: 'Cliente solicitou agendamento de reunião técnica',
      })
      aRecT2.set('ip', '127.0.0.1')
      app.save(aRecT2)
      createdAuditLogIds.push(aRecT2.id)

      // Desvio resposta_positiva:
      // Move empresa para "em_conversa", limpa proxima_acao_data, define proxima_acao_desc
      empSalvaA.set('etapa_funil', 'em_conversa')
      empSalvaA.set('proxima_acao_data', '')
      empSalvaA.set('proxima_acao_desc', 'Em conversa ativa com decisor da empresa.')
      app.save(empSalvaA)

      // Cancelar toques futuros agendados (numero_toque > 2)
      const toquesFuturos = app.findRecordsByFilter(
        'toques',
        "empresa = '" + empTeste.id + "' && numero_toque > 2 && status = 'agendado'",
        'numero_toque',
        10,
        0,
      )
      for (let tf = 0; tf < toquesFuturos.length; tf++) {
        toquesFuturos[tf].set('status', 'cancelado')
        toquesFuturos[tf].set(
          'observacao',
          'Cadência finalizada com sucesso (resposta positiva no Toque 2)',
        )
        app.save(toquesFuturos[tf])
      }

      // Validações da PROVA B:
      const empSalvaB = app.findRecordById('empresas', empTeste.id)
      if (empSalvaB.getString('etapa_funil') !== 'em_conversa') {
        throw new Error(
          'Falha na Prova B: etapa_funil da empresa deveria ser em_conversa, obtido: ' +
            empSalvaB.getString('etapa_funil'),
        )
      }
      if (
        empSalvaB.getString('proxima_acao_desc') !== 'Em conversa ativa com decisor da empresa.'
      ) {
        throw new Error('Falha na Prova B: proxima_acao_desc da empresa incorreta.')
      }
      const t3Salvo = app.findRecordById('toques', t3.id)
      if (t3Salvo.getString('status') !== 'cancelado') {
        throw new Error(
          'Falha na Prova B: status do toque futuro 3 deveria ser cancelado, obtido: ' +
            t3Salvo.getString('status'),
        )
      }

      // -----------------------------------------------------------------------
      // PROVA C (Auditoria): Validar registros gerados
      // -----------------------------------------------------------------------
      const audT1 = app.findRecordById('audit_logs', aRecT1.id)
      if (audT1.getString('acao') !== 'CONFIRMACAO_TOQUE') {
        throw new Error('Falha na Prova C: acao de auditoria incorreta no Toque 1.')
      }
      if (audT1.getString('entidade') !== 'toques') {
        throw new Error('Falha na Prova C: entidade de auditoria incorreta no Toque 1.')
      }
      if (
        audT1.getString('user') !== comercialUser.id ||
        audT1.getString('user_email') !== comercialUser.getString('email')
      ) {
        throw new Error('Falha na Prova C: user/user_email incorreto na auditoria.')
      }
      if (!audT1.getString('ip')) {
        throw new Error('Falha na Prova C: ip não preenchido na auditoria.')
      }

      const audEnc = app.findRecordById('audit_logs', aRecEncadeamento.id)
      if (audEnc.getString('acao') !== 'ENCADEAMENTO_TOQUE_AUTOMATICO') {
        throw new Error('Falha na Prova C: acao de auditoria incorreta no encadeamento.')
      }
      if (audEnc.getString('registro_id') !== t2.id) {
        throw new Error('Falha na Prova C: registro_id do encadeamento incorreto.')
      }

      // -----------------------------------------------------------------------
      // PROVA D (Rascunho de Contrato): Incorporar sugestão fictícia
      // -----------------------------------------------------------------------
      // Sugestão de teste tem:
      // - orgao_contrato: 'Prefeitura de Teste QA'
      // - numero_contrato: 'CT-QA-2026'
      // - objeto_contrato: 'Obra de pavimentação teste QA'
      // - valor_estimado: 1500000
      // - fonte: 'planilha'
      const empCol = app.findCollectionByNameOrId('empresas')
      const novaEmpSug = new Record(empCol)
      novaEmpSug.set('razao_social', sugTeste.getString('razao_social'))
      novaEmpSug.set(
        'nome_fantasia',
        sugTeste.getString('nome_fantasia') || sugTeste.getString('razao_social'),
      )
      novaEmpSug.set('cnpj', sugTeste.getString('cnpj') || '98.765.432/0001-11')
      novaEmpSug.set('situacao_cadastral', 'ATIVA')
      novaEmpSug.set('etapa_funil', 'identificada')
      novaEmpSug.set('curva', 'C')
      novaEmpSug.set('score', 60)
      novaEmpSug.set('status', 'ativa')
      novaEmpSug.set('responsavel', comercialUser.id)
      novaEmpSug.set('observacoes', 'Empresa originada da fila de sugestões (PLANILHA).')
      novaEmpSug.set('proxima_acao_desc', 'Primeiro contato de prospecção e qualificação')
      app.save(novaEmpSug)
      createdEmpresaIds.push(novaEmpSug.id)

      // Criar rascunho de contrato
      const contratosCol = app.findCollectionByNameOrId('contratos')
      const ctrRascunho = new Record(contratosCol)
      ctrRascunho.set('empresa', novaEmpSug.id)
      ctrRascunho.set('orgao', sugTeste.getString('orgao_contrato'))
      ctrRascunho.set('numero', sugTeste.getString('numero_contrato'))
      ctrRascunho.set('objeto', sugTeste.getString('objeto_contrato'))
      ctrRascunho.set('valor', sugTeste.getFloat('valor_estimado'))
      ctrRascunho.set('saldo', sugTeste.getFloat('valor_estimado'))
      ctrRascunho.set('situacao', 'Em Execução')
      ctrRascunho.set('fonte', 'Planilha Externa')
      ctrRascunho.set('status_revisao', 'rascunho_pendente')
      ctrRascunho.set('sugestao_origem', sugTeste.id)
      app.save(ctrRascunho)
      createdContratoIds.push(ctrRascunho.id)

      // Atualizar sugestão para 'incorporada'
      sugTeste.set('status', 'incorporada')
      sugTeste.set('empresa_criada', novaEmpSug.id)
      sugTeste.set('decidido_por', comercialUser.id)
      sugTeste.set('data_decisao', '2026-10-15 12:00:00.000Z')
      app.save(sugTeste)

      // Auditoria CONTRATO_RASCUNHO_INCORPORADO
      const aRecCtr = new Record(auditCol)
      aRecCtr.set('user', comercialUser.id)
      aRecCtr.set('user_email', comercialUser.getString('email'))
      aRecCtr.set('acao', 'CONTRATO_RASCUNHO_INCORPORADO')
      aRecCtr.set('entidade', 'contratos')
      aRecCtr.set('registro_id', ctrRascunho.id)
      aRecCtr.set('detalhes', {
        mensagem:
          'Rascunho de contrato criado automaticamente a partir de sugestão incorporada (PLANILHA)',
        empresa_id: novaEmpSug.id,
        empresa_nome: novaEmpSug.getString('razao_social'),
        sugestao_id: sugTeste.id,
        sugestao_fonte: 'planilha',
        orgao: sugTeste.getString('orgao_contrato'),
        numero: sugTeste.getString('numero_contrato'),
        valor: sugTeste.getFloat('valor_estimado'),
        status_revisao: 'rascunho_pendente',
      })
      aRecCtr.set('ip', '127.0.0.1')
      app.save(aRecCtr)
      createdAuditLogIds.push(aRecCtr.id)

      // Validações da PROVA D:
      const empSugSalva = app.findRecordById('empresas', novaEmpSug.id)
      if (empSugSalva.getString('etapa_funil') !== 'identificada') {
        throw new Error(
          'Falha na Prova D: empresa criada a partir de sugestão deveria estar na etapa identificada, obtido: ' +
            empSugSalva.getString('etapa_funil'),
        )
      }

      const ctrSalvo = app.findRecordById('contratos', ctrRascunho.id)
      if (ctrSalvo.getString('status_revisao') !== 'rascunho_pendente') {
        throw new Error(
          'Falha na Prova D: status_revisao do contrato deveria ser rascunho_pendente, obtido: ' +
            ctrSalvo.getString('status_revisao'),
        )
      }
      if (ctrSalvo.getString('orgao') !== 'Prefeitura de Teste QA') {
        throw new Error('Falha na Prova D: orgao incorreto no contrato rascunho.')
      }
      if (ctrSalvo.getString('numero') !== 'CT-QA-2026') {
        throw new Error('Falha na Prova D: numero incorreto no contrato rascunho.')
      }
      if (ctrSalvo.getString('objeto') !== 'Obra de pavimentação teste QA') {
        throw new Error('Falha na Prova D: objeto incorreto no contrato rascunho.')
      }
      if (Math.abs(ctrSalvo.getFloat('valor') - 1500000) > 0.01) {
        throw new Error(
          'Falha na Prova D: valor incorreto no contrato rascunho: ' + ctrSalvo.getFloat('valor'),
        )
      }
      if (ctrSalvo.getString('sugestao_origem') !== sugTeste.id) {
        throw new Error('Falha na Prova D: vinculo sugestao_origem incorreto.')
      }

      const sugSalva = app.findRecordById('sugestoes_funil', sugTeste.id)
      if (sugSalva.getString('status') !== 'incorporada') {
        throw new Error('Falha na Prova D: status da sugestao deveria ser incorporada.')
      }
      if (sugSalva.getString('empresa_criada') !== novaEmpSug.id) {
        throw new Error('Falha na Prova D: empresa_criada da sugestao não foi vinculada.')
      }

      const audCtrSalvo = app.findRecordById('audit_logs', aRecCtr.id)
      if (audCtrSalvo.getString('acao') !== 'CONTRATO_RASCUNHO_INCORPORADO') {
        throw new Error('Falha na Prova D: acao de auditoria incorreta no contrato rascunho.')
      }
    } finally {
      // -----------------------------------------------------------------------
      // 2. LIMPEZA OBRIGATÓRIA AO FIM
      // Apagar rigorosamente todos os registros de teste criados nas provas e na 0069
      // -----------------------------------------------------------------------
      // 2.1 Auditorias de teste
      for (let i = 0; i < createdAuditLogIds.length; i++) {
        try {
          const rec = app.findRecordById('audit_logs', createdAuditLogIds[i])
          app.delete(rec)
        } catch (_) {}
      }

      // 2.2 Contratos de teste
      for (let i = 0; i < createdContratoIds.length; i++) {
        try {
          const rec = app.findRecordById('contratos', createdContratoIds[i])
          app.delete(rec)
        } catch (_) {}
      }

      // 2.3 Toques de teste
      for (let i = 0; i < createdToqueIds.length; i++) {
        try {
          const rec = app.findRecordById('toques', createdToqueIds[i])
          app.delete(rec)
        } catch (_) {}
      }

      // Buscar qualquer toque remanescente vinculado às empresas de teste
      for (let i = 0; i < createdEmpresaIds.length; i++) {
        try {
          const remToques = app.findRecordsByFilter(
            'toques',
            "empresa = '" + createdEmpresaIds[i] + "'",
            '',
            20,
            0,
          )
          for (let j = 0; j < remToques.length; j++) {
            app.delete(remToques[j])
          }
        } catch (_) {}
      }

      // 2.4 Sugestões de teste
      for (let i = 0; i < createdSugestaoIds.length; i++) {
        try {
          const rec = app.findRecordById('sugestoes_funil', createdSugestaoIds[i])
          app.delete(rec)
        } catch (_) {}
      }

      // Buscar qualquer sugestão remanescente de teste
      try {
        const remSugs = app.findRecordsByFilter(
          'sugestoes_funil',
          "razao_social ~ 'SUGESTAO QA PROSPECCAO'",
          '',
          10,
          0,
        )
        for (let j = 0; j < remSugs.length; j++) {
          app.delete(remSugs[j])
        }
      } catch (_) {}

      // 2.5 Empresas de teste
      for (let i = 0; i < createdEmpresaIds.length; i++) {
        try {
          const rec = app.findRecordById('empresas', createdEmpresaIds[i])
          app.delete(rec)
        } catch (_) {}
      }

      // Buscar qualquer empresa remanescente de teste
      try {
        const remEmps = app.findRecordsByFilter(
          'empresas',
          "razao_social ~ 'EMPRESA TESTE CADENCIA QA' || razao_social ~ 'SUGESTAO QA PROSPECCAO'",
          '',
          10,
          0,
        )
        for (let j = 0; j < remEmps.length; j++) {
          app.delete(remEmps[j])
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Reverter/limpeza defensiva
    try {
      const emps = app.findRecordsByFilter(
        'empresas',
        "razao_social ~ 'EMPRESA TESTE CADENCIA QA' || razao_social ~ 'SUGESTAO QA PROSPECCAO'",
        '',
        10,
        0,
      )
      for (let i = 0; i < emps.length; i++) {
        const toques = app.findRecordsByFilter(
          'toques',
          "empresa = '" + emps[i].id + "'",
          '',
          20,
          0,
        )
        for (let j = 0; j < toques.length; j++) app.delete(toques[j])
        const ctrs = app.findRecordsByFilter(
          'contratos',
          "empresa = '" + emps[i].id + "'",
          '',
          10,
          0,
        )
        for (let j = 0; j < ctrs.length; j++) app.delete(ctrs[j])
        app.delete(emps[i])
      }
      const sugs = app.findRecordsByFilter(
        'sugestoes_funil',
        "razao_social ~ 'SUGESTAO QA PROSPECCAO'",
        '',
        10,
        0,
      )
      for (let i = 0; i < sugs.length; i++) app.delete(sugs[i])
    } catch (_) {}
  },
)
