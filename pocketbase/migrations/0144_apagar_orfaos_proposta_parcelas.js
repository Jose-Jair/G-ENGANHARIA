/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0144: APAGAR REGISTROS ÓRFÃOS EM PROPOSTA_PARCELAS
    // Exclusão APROVADA expressamente pelo dono em conversa.
    //
    // Contexto:
    // - Limpezas antigas deixaram 8 parcelas órfãs criadas em 31/10 e 01/11,
    //   todas de valor 500 e apontando para propostas já inexistentes.
    //
    // Padrão de segurança:
    // 1. Backup em texto no log antes de apagar (id, proposta, valor, percentual,
    //    ordem, descricao, created).
    // 2. SQL direto via app.db().newQuery().execute() (sem disparar hooks).
    // 3. Contagens antes/depois registradas no log.
    // 4. Idempotente: apaga somente onde proposta NOT IN (SELECT id FROM propostas)
    //    ou onde proposta != '' e não existe em propostas. Em replay/banco vazio
    //    não faz nada (0 apagados).
    // 5. Preservados intactos: users, audit_logs, parametros, catálogos,
    //    modelos, notificações, etc.
    // =========================================================================

    // ---- Contadores auxiliares ----------------------------------------------
    const q = (colecao, filtro) => {
      try {
        return app.findRecordsByFilter(colecao, filtro, '', 0, 0).length
      } catch (err) {
        console.log('[0144] Erro ao contar ' + colecao + ': ' + err)
        return 0
      }
    }

    const antesTotalParcelas = q('proposta_parcelas', "id != ''")
    console.log('[0144] Total de proposta_parcelas antes da limpeza: ' + antesTotalParcelas)

    // ---- 1. BACKUP EM TEXTO NO LOG ANTES DE APAGAR --------------------------
    // Os 8 registros identificados por leitura prévia:
    // CPF não existe nesses registros.
    console.log('[0144] ================= BACKUP PROPOSTA_PARCELAS ÓRFÃS (TEXTO) =================')
    try {
      const orfaos = app.findRecordsByFilter(
        'proposta_parcelas',
        "proposta = 'x1ce1z1jyvtjn1o' || proposta = 'g5yd9trmgxxjj8t' || proposta = 'nlu6qremdn1biiz' || proposta = 'e6du05oslnt0gkd'",
        'created',
        0,
        0,
      )

      console.log(
        '[0144] Registros órfãos encontrados para backup via findRecords: ' + orfaos.length,
      )
      for (let i = 0; i < orfaos.length; i++) {
        const r = orfaos[i]
        console.log(
          '[0144] BACKUP parcela #' +
            (i + 1) +
            ' | id=' +
            r.id +
            ' | proposta=' +
            r.getString('proposta') +
            ' | valor=' +
            r.getInt('valor') +
            ' | percentual=' +
            r.getInt('percentual') +
            ' | ordem=' +
            r.getInt('ordem') +
            ' | gatilho=' +
            r.getString('gatilho') +
            ' | descricao=' +
            r.getString('descricao') +
            ' | created=' +
            r.getString('created'),
        )
      }
    } catch (e) {
      console.log('[0144] Erro durante leitura para backup dinâmico: ' + e)
    }

    // Backup determinístico dos 8 registros conhecidos como garantia de log
    console.log(
      '[0144] BACKUP ESTATICO 1) id=4tid22nu42vfwkl proposta=x1ce1z1jyvtjn1o valor=500 percentual=50 ordem=1 gatilho=contratacao descricao="50% (cinquenta por cento) na assinatura do contrato/aceite" created="2026-10-31 19:48:09.324Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 2) id=yrh956j2cdp4tnq proposta=x1ce1z1jyvtjn1o valor=500 percentual=50 ordem=2 gatilho=entrega descricao="50% (cinquenta por cento) na entrega final dos projetos executivos" created="2026-10-31 19:48:09.478Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 3) id=0dx1yeihdx3ae52 proposta=g5yd9trmgxxjj8t valor=500 percentual=50 ordem=1 gatilho=contratacao descricao="50% (cinquenta por cento) na assinatura do contrato/aceite" created="2026-11-01 01:01:32.428Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 4) id=5vq1ckc8bhfw17n proposta=g5yd9trmgxxjj8t valor=500 percentual=50 ordem=2 gatilho=entrega descricao="50% (cinquenta por cento) na entrega final dos projetos executivos" created="2026-11-01 01:01:32.536Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 5) id=f62jzd5is266q7u proposta=nlu6qremdn1biiz valor=500 percentual=50 ordem=1 gatilho=contratacao descricao="50% (cinquenta por cento) na assinatura do contrato/aceite" created="2026-11-01 12:02:47.573Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 6) id=e9ymnmbla86uzz3 proposta=nlu6qremdn1biiz valor=500 percentual=50 ordem=2 gatilho=entrega descricao="50% (cinquenta por cento) na entrega final dos projetos executivos" created="2026-11-01 12:02:47.684Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 7) id=n3j9lw0iv1ovwlt proposta=e6du05oslnt0gkd valor=500 percentual=50 ordem=1 gatilho=contratacao descricao="50% (cinquenta por cento) na assinatura do contrato/aceite" created="2026-11-01 17:54:00.358Z"',
    )
    console.log(
      '[0144] BACKUP ESTATICO 8) id=tggfzcrzmharbab proposta=e6du05oslnt0gkd valor=500 percentual=50 ordem=2 gatilho=entrega descricao="50% (cinquenta por cento) na entrega final dos projetos executivos" created="2026-11-01 17:54:00.365Z"',
    )
    console.log('[0144] =========================================================================')

    // ---- 2. DELETE DIRETO VIA SQL (SEM HOOKS) -------------------------------
    // Apaga SOMENTE registros de proposta_parcelas cujo campo `proposta` não
    // corresponda a nenhuma proposta existente na coleção propostas.
    const sqlDelete = `
      DELETE FROM proposta_parcelas
      WHERE proposta IS NOT NULL
        AND proposta != ''
        AND proposta NOT IN (SELECT id FROM propostas)
    `

    try {
      app.db().newQuery(sqlDelete).execute()
      console.log('[0144] DELETE de proposta_parcelas órfãs executado via SQL puro.')
    } catch (err) {
      console.log('[0144] Erro ao executar DELETE SQL de proposta_parcelas órfãs: ' + err)
      throw err
    }

    // ---- 3. CONTAGENS DEPOIS ------------------------------------------------
    const depoisTotalParcelas = q('proposta_parcelas', "id != ''")
    console.log(
      '[0144] CONTAGEM proposta_parcelas: antes=' +
        antesTotalParcelas +
        ' -> depois=' +
        depoisTotalParcelas,
    )

    // ---- 4. VERIFICAÇÃO DE PRESERVAÇÃO DE OUTRAS COLEÇÕES -------------------
    const totalUsers = q('users', "id != ''")
    const totalPropostas = q('propostas', "id != ''")
    const totalAudit = q('audit_logs', "id != ''")
    const totalParam = q('parametros', "id != ''")
    const totalModelos = q('modelos', "id != ''")
    const totalCatalogo = q('catalogo_servicos', "id != ''")

    console.log(
      '[0144] PRESERVADOS: users=' +
        totalUsers +
        ' | propostas=' +
        totalPropostas +
        ' | audit_logs=' +
        totalAudit +
        ' | parametros=' +
        totalParam +
        ' | modelos=' +
        totalModelos +
        ' | catalogo_servicos=' +
        totalCatalogo,
    )

    console.log('[0144] Migração de limpeza de proposta_parcelas órfãs concluída com sucesso.')
  },
  () => {
    // Reversão não aplicável: exclusão de registros órfãos autorizada expressamente pelo dono
  },
)
