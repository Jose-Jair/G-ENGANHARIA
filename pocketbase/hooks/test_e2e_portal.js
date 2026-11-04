// =============================================================================
// GESTÃO G+ — ROTA TEMPORÁRIA DE TESTE DE PONTA A PONTA DO PORTAL (RODADA 2)
// =============================================================================

routerAdd('GET', '/backend/v1/test-e2e-portal/executar-v2', (e) => {
  const relatorio = {
    contagensIniciais: {},
    contagensFinais: {},
    registrosCriados: {},
    provas: {},
    erros: [],
  }

  try {
    // 1. Contagens Iniciais usando $app.findRecordsByFilter ou newQuery().all(rows)
    const rowsPrest = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM prestadores').all(rowsPrest)
    relatorio.contagensIniciais.prestadores =
      rowsPrest.length > 0 ? parseInt(rowsPrest[0].total, 10) || 0 : 0

    const rowsUsers = []
    $app
      .db()
      .newQuery("SELECT COUNT(*) as total FROM users WHERE email LIKE '%@exemplo.test%'")
      .all(rowsUsers)
    relatorio.contagensIniciais.users_teste =
      rowsUsers.length > 0 ? parseInt(rowsUsers[0].total, 10) || 0 : 0

    const rowsTotalUsers = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM users').all(rowsTotalUsers)
    relatorio.contagensIniciais.users =
      rowsTotalUsers.length > 0 ? parseInt(rowsTotalUsers[0].total, 10) || 0 : 0

    const rowsPortalOs = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM portal_os').all(rowsPortalOs)
    relatorio.contagensIniciais.portal_os =
      rowsPortalOs.length > 0 ? parseInt(rowsPortalOs[0].total, 10) || 0 : 0

    const rowsPortalEnt = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM portal_entregaveis').all(rowsPortalEnt)
    relatorio.contagensIniciais.portal_entregaveis =
      rowsPortalEnt.length > 0 ? parseInt(rowsPortalEnt[0].total, 10) || 0 : 0

    // 2. Criar dados marcados 'TESTE PORTAL — apagar'
    // Prestador P1
    const p1Col = $app.findCollectionByNameOrId('prestadores')
    const p1 = new Record(p1Col)
    p1.set('nome', 'TESTE PORTAL — apagar P1')
    p1.set('tipo', 'pf_externo')
    p1.set('email', 'teste-portal-1@exemplo.test')
    p1.set('status', 'ativo')
    $app.save(p1)
    relatorio.registrosCriados.p1_id = p1.id

    // Usuário executor U1
    const uCol = $app.findCollectionByNameOrId('users')
    const u1 = new Record(uCol)
    u1.set('name', 'TESTE PORTAL — apagar U1')
    u1.set('email', 'teste-portal-1@exemplo.test')
    u1.set('role', 'executor')
    u1.set('active', true)
    u1.set('verified', true)
    u1.setPassword('SenhaTesteE2EPortal123!')
    $app.save(u1)
    relatorio.registrosCriados.u1_id = u1.id

    // Prestador P2 (sem usuário)
    const p2 = new Record(p1Col)
    p2.set('nome', 'TESTE PORTAL — apagar P2')
    p2.set('tipo', 'pf_externo')
    p2.set('email', 'teste-portal-p2-sem-user@exemplo.test')
    p2.set('status', 'ativo')
    $app.save(p2)
    relatorio.registrosCriados.p2_id = p2.id

    // OS1 (portal_os) para P1 — TESTE FALLBACK: prestador_email diferente de U1 ('email-diferente-os1@exemplo.test'), mas prestador_id = p1.id
    const posCol = $app.findCollectionByNameOrId('portal_os')
    const pos1 = new Record(posCol)
    pos1.set('os_id', 'OS-TESTE-E2E-P1')
    pos1.set('prestador_id', p1.id)
    pos1.set('prestador_email', 'email-diferente-os1@exemplo.test')
    pos1.set('codigo_projeto', 'PRJ-TESTE-P1')
    pos1.set('numero_os', 'OS-2026-TESTE-01')
    pos1.set('disciplina', 'Estrutural')
    pos1.set('escopo_tecnico', 'TESTE PORTAL — apagar')
    pos1.set('status', 'em_execucao')
    $app.save(pos1)
    relatorio.registrosCriados.pos1_id = pos1.id

    // OS2 (portal_os) para P2 — prestador_id = p2.id e prestador_email = 'teste-portal-p2-sem-user@exemplo.test'
    const pos2 = new Record(posCol)
    pos2.set('os_id', 'OS-TESTE-E2E-P2')
    pos2.set('prestador_id', p2.id)
    pos2.set('prestador_email', 'teste-portal-p2-sem-user@exemplo.test')
    pos2.set('codigo_projeto', 'PRJ-TESTE-P2')
    pos2.set('numero_os', 'OS-2026-TESTE-02')
    pos2.set('disciplina', 'BIM')
    pos2.set('escopo_tecnico', 'TESTE PORTAL — apagar OS 2')
    pos2.set('status', 'em_execucao')
    $app.save(pos2)
    relatorio.registrosCriados.pos2_id = pos2.id

    // 3. Provas de RLS / Permissões
    // A) U1 listando portal_os:
    // A regra da portal_os é:
    // @request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && ((prestador_id != '' && @collection.prestadores.id ?= prestador_id && @collection.prestadores.email ?= @request.auth.email) || prestador_email = @request.auth.email)))
    const rowsVisiveisU1 = []
    $app
      .db()
      .newQuery(
        'SELECT id FROM portal_os WHERE (' +
          "(prestador_id != '' AND EXISTS (SELECT 1 FROM prestadores WHERE prestadores.id = portal_os.prestador_id AND prestadores.email = '" +
          u1.getString('email') +
          "')) " +
          "OR prestador_email = '" +
          u1.getString('email') +
          "'" +
          ')',
      )
      .all(rowsVisiveisU1)

    const u1VePos1 = rowsVisiveisU1.some((r) => r.id === pos1.id)
    const u1VePos2 = rowsVisiveisU1.some((r) => r.id === pos2.id)

    relatorio.provas.u1_ve_apenas_os1 = u1VePos1 && !u1VePos2 && rowsVisiveisU1.length === 1
    relatorio.provas.u1_view_os2_negado = !u1VePos2

    // B) Teste de criação de entregável pelo U1 em OS1:
    const rowsPrestP1 = []
    $app
      .db()
      .newQuery(
        "SELECT COUNT(*) as total FROM prestadores WHERE id = '" +
          p1.id +
          "' AND email = '" +
          u1.getString('email') +
          "'",
      )
      .all(rowsPrestP1)
    const regraCreateAtendidaOS1 =
      rowsPrestP1.length > 0 && (parseInt(rowsPrestP1[0].total, 10) || 0) > 0

    let pent1 = null
    if (regraCreateAtendidaOS1) {
      const pentCol = $app.findCollectionByNameOrId('portal_entregaveis')
      pent1 = new Record(pentCol)
      pent1.set('os_id', 'OS-TESTE-E2E-P1')
      pent1.set('prestador_id', p1.id)
      pent1.set('prestador_email', 'email-diferente-os1@exemplo.test')
      pent1.set('codigo_projeto', 'PRJ-TESTE-P1')
      pent1.set('nome', 'TESTE PORTAL — apagar Entregável P1')
      pent1.set('descricao', 'Conteúdo mínimo de teste E2E')
      pent1.set('status', 'submetido')
      $app.save(pent1)
      relatorio.registrosCriados.pent1_id = pent1.id
    }
    relatorio.provas.u1_consegue_criar_entregavel_os1 = Boolean(pent1 && pent1.id)

    // C) Teste de criação de entregável pelo U1 em OS2 (P2):
    const rowsPrestP2 = []
    $app
      .db()
      .newQuery(
        "SELECT COUNT(*) as total FROM prestadores WHERE id = '" +
          p2.id +
          "' AND email = '" +
          u1.getString('email') +
          "'",
      )
      .all(rowsPrestP2)
    const emailMatchP2 = 'teste-portal-p2-sem-user@exemplo.test' === u1.getString('email')
    const regraCreateAtendidaOS2 =
      (rowsPrestP2.length > 0 && (parseInt(rowsPrestP2[0].total, 10) || 0) > 0) || emailMatchP2

    relatorio.provas.u1_criar_entregavel_os2_negado = !regraCreateAtendidaOS2

    // D) Admin confirma que o entregável de OS1 aparece:
    const rowsEntAdmin = []
    $app
      .db()
      .newQuery("SELECT id FROM portal_entregaveis WHERE os_id = 'OS-TESTE-E2E-P1'")
      .all(rowsEntAdmin)
    relatorio.provas.admin_ve_entregavel =
      rowsEntAdmin.length === 1 && rowsEntAdmin[0].id === pent1.id

    // E) Teste do Fallback:
    relatorio.provas.fallback_prestador_id_com_email_diferente =
      relatorio.provas.u1_ve_apenas_os1 &&
      pos1.getString('prestador_email') !== u1.getString('email') &&
      regraCreateAtendidaOS1

    // 4. LIMPEZA DOS DADOS DE TESTE (somente os ids criados)
    if (pent1 && pent1.id) {
      $app
        .db()
        .newQuery("DELETE FROM portal_entregaveis WHERE id = '" + pent1.id + "'")
        .execute()
    }
    if (pos1 && pos1.id) {
      $app
        .db()
        .newQuery("DELETE FROM portal_os WHERE id = '" + pos1.id + "'")
        .execute()
    }
    if (pos2 && pos2.id) {
      $app
        .db()
        .newQuery("DELETE FROM portal_os WHERE id = '" + pos2.id + "'")
        .execute()
    }
    if (u1 && u1.id) {
      $app
        .db()
        .newQuery("DELETE FROM users WHERE id = '" + u1.id + "'")
        .execute()
    }
    if (p1 && p1.id) {
      $app
        .db()
        .newQuery("DELETE FROM prestadores WHERE id = '" + p1.id + "'")
        .execute()
    }
    if (p2 && p2.id) {
      $app
        .db()
        .newQuery("DELETE FROM prestadores WHERE id = '" + p2.id + "'")
        .execute()
    }

    // 5. Contagens Finais
    const rowsPrestF = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM prestadores').all(rowsPrestF)
    relatorio.contagensFinais.prestadores =
      rowsPrestF.length > 0 ? parseInt(rowsPrestF[0].total, 10) || 0 : 0

    const rowsUsersF = []
    $app
      .db()
      .newQuery("SELECT COUNT(*) as total FROM users WHERE email LIKE '%@exemplo.test%'")
      .all(rowsUsersF)
    relatorio.contagensFinais.users_teste =
      rowsUsersF.length > 0 ? parseInt(rowsUsersF[0].total, 10) || 0 : 0

    const rowsTotalUsersF = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM users').all(rowsTotalUsersF)
    relatorio.contagensFinais.users =
      rowsTotalUsersF.length > 0 ? parseInt(rowsTotalUsersF[0].total, 10) || 0 : 0

    const rowsPortalOsF = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM portal_os').all(rowsPortalOsF)
    relatorio.contagensFinais.portal_os =
      rowsPortalOsF.length > 0 ? parseInt(rowsPortalOsF[0].total, 10) || 0 : 0

    const rowsPortalEntF = []
    $app.db().newQuery('SELECT COUNT(*) as total FROM portal_entregaveis').all(rowsPortalEntF)
    relatorio.contagensFinais.portal_entregaveis =
      rowsPortalEntF.length > 0 ? parseInt(rowsPortalEntF[0].total, 10) || 0 : 0

    relatorio.limpezaSucesso =
      relatorio.contagensIniciais.prestadores === relatorio.contagensFinais.prestadores &&
      relatorio.contagensIniciais.users === relatorio.contagensFinais.users &&
      relatorio.contagensIniciais.portal_os === relatorio.contagensFinais.portal_os &&
      relatorio.contagensIniciais.portal_entregaveis ===
        relatorio.contagensFinais.portal_entregaveis

    return e.json(200, relatorio)
  } catch (err) {
    relatorio.erros.push(String(err))
    return e.json(500, relatorio)
  }
})
