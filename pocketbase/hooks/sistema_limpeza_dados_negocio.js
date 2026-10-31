// =============================================================================
// GESTÃO G+ — MECANISMO DE LIMPEZA DE DADOS DE NEGÓCIO (RODADA 11)
// Rota de administração restrita a perfil Admin:
// POST /backend/v1/sistema/limpeza-dados-negocio
//
// Regras obrigatórias:
// 1. Exclusivo para perfil Admin (403 para Gestor, Comercial, Financeiro, Executor).
// 2. Frase de confirmação exata no corpo: "APAGAR DADOS DE NEGÓCIO".
// 3. Ordem de deleção respeitando dependências de chave estrangeira.
// 4. Cadastros e configurações NUNCA são apagados:
//    - users, audit_logs, empresas, clientes_pf, prestadores, profissionais_prestador,
//    - executores, catalogo_servicos, catalogo_escopos, areas_atuacao, subservicos,
//    - entregaveis_padrao, parametros, modelos, motivos, nao_contatar.
// 5. Auditoria ANTES e DEPOIS (quem, quando, quantos registros apagados por coleção,
//    inclusive registrando estado em caso de falha parcial).
//
// NOTA ARQUITETURAL SKIP CLOUD / POCKETBASE:
// Cada callback de routerAdd roda em VM isolada na pool Goja.
// Funções auxiliares de validação e auditoria são mantidas no escopo do callback.
// =============================================================================

routerAdd(
  'POST',
  '/backend/v1/sistema/limpeza-dados-negocio',
  (e) => {
    const FRASE_ESPERADA = 'APAGAR DADOS DE NEGÓCIO'

    // Coleções de negócio na ordem estrita de deleção (dependências mais profundas primeiro)
    const COLECOES_NEGOCIO = [
      'entregavel_comentarios',
      'mensagens_os',
      'eventos_cobranca',
      'notificacoes',
      'resumos_diarios_gestor',
      'portal_entregaveis',
      'portal_documentos',
      'portal_os',
      'entregaveis_versoes',
      'entregaveis',
      'medicoes',
      'avaliacoes_executor',
      'avaliacoes',
      'ordens_servico',
      'contratos_mestre',
      'subcontratos',
      'cotacoes',
      'documentos',
      'riscos',
      'projeto_etapas',
      'grupos_projetos',
      'projetos',
      'contas',
      'contratos_servico',
      'proposta_parcelas',
      'proposta_itens',
      'propostas',
      'campanha_envios',
      'campanhas',
      'toques',
      'reativacoes_sugeridas',
      'sugestoes_funil',
      'contratos',
      'contatos',
    ]

    // Coleções estruturais e cadastros imutáveis que JAMAIS podem ser tocados
    const COLECOES_PRESERVADAS = [
      'users',
      'audit_logs',
      'empresas',
      'clientes_pf',
      'prestadores',
      'profissionais_prestador',
      'executores',
      'catalogo_servicos',
      'catalogo_escopos',
      'areas_atuacao',
      'subservicos',
      'entregaveis_padrao',
      'parametros',
      'modelos',
      'motivos',
      'nao_contatar',
    ]

    function registrarAuditoria(userId, userEmail, acao, entidade, registroId, detalhes, clientIp) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao)
        aRec.set('entidade', entidade || 'sistema')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          timestamp_utc: new Date().toISOString(),
          ...(detalhes || {}),
        })
        aRec.set('ip', clientIp || '127.0.0.1')
        $app.save(aRec)
        return aRec.id
      } catch (err) {
        console.log('[LIMPEZA] Erro ao gravar audit_logs: ' + err)
        return null
      }
    }

    function contarRegistrosTabela(tabela) {
      try {
        if (!$app.hasTable(tabela)) return 0
        const qCount = $app.db().newQuery('SELECT COUNT(*) as total FROM ' + tabela)
        const res = {}
        qCount.one(res)
        return parseInt(res.total, 10) || 0
      } catch (_) {
        try {
          return $app.countRecords(tabela)
        } catch (_) {
          return 0
        }
      }
    }

    function safeExecuteSql(sql) {
      try {
        $app.db().newQuery(sql).execute()
      } catch (err) {
        console.log('[LIMPEZA] Aviso SQL: ' + err)
      }
    }

    try {
      const auth = e.auth
      if (!auth) {
        return e.json(401, {
          success: false,
          error: 'Autenticação necessária para executar a limpeza do sistema.',
        })
      }

      const role = auth.getString('role')
      const userId = auth.id
      const userEmail = auth.getString('email')
      const reqInfo = e.requestInfo()
      const clientIp =
        reqInfo && reqInfo.headers
          ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
          : '127.0.0.1'

      // Bloqueio rígido: APENAS ADMIN
      if (role !== 'admin') {
        registrarAuditoria(
          userId,
          userEmail,
          'TENTATIVA_LIMPEZA_NEGADO_PERFIL',
          'sistema',
          'limpeza_dados_negocio',
          {
            perfil_tentativa: role,
            motivo: 'Apenas perfil Admin possui autorização para limpeza de dados de negócio.',
          },
          clientIp,
        )
        return e.json(403, {
          success: false,
          error:
            'Acesso negado: apenas o perfil Administrador pode executar a limpeza de dados de negócio.',
          perfil_atual: role,
        })
      }

      const body = reqInfo.body || {}
      const confirmacao = (body.confirmacao || body.frase_confirmacao || '').trim()

      // Validação de frase de confirmação
      if (confirmacao !== FRASE_ESPERADA) {
        registrarAuditoria(
          userId,
          userEmail,
          'TENTATIVA_LIMPEZA_FRASE_INVALIDA',
          'sistema',
          'limpeza_dados_negocio',
          {
            frase_enviada: confirmacao,
            esperado: FRASE_ESPERADA,
          },
          clientIp,
        )
        return e.json(400, {
          success: false,
          error: 'Frase de confirmação incorreta. Digite exatamente: "' + FRASE_ESPERADA + '".',
        })
      }

      // 1. Snapshot de contagem ANTES da exclusão
      const contagensAntes = {}
      let totalGeralAntes = 0
      for (let i = 0; i < COLECOES_NEGOCIO.length; i++) {
        const col = COLECOES_NEGOCIO[i]
        const c = contarRegistrosTabela(col)
        contagensAntes[col] = c
        totalGeralAntes += c
      }

      // Snapshot de conferência das coleções preservadas
      const contagensPreservadasAntes = {}
      for (let p = 0; p < COLECOES_PRESERVADAS.length; p++) {
        const colP = COLECOES_PRESERVADAS[p]
        contagensPreservadasAntes[colP] = contarRegistrosTabela(colP)
      }

      // Registro de Auditoria: ANTES DA EXECUÇÃO
      const auditInicioId = registrarAuditoria(
        userId,
        userEmail,
        'LIMPEZA_DADOS_NEGOCIO_INICIADA',
        'sistema',
        'limpeza_dados_negocio',
        {
          autor_id: userId,
          autor_email: userEmail,
          confirmacao_fornecida: confirmacao,
          total_registros_negocio_previstos: totalGeralAntes,
          contagens_antes: contagensAntes,
          contagens_preservadas_antes: contagensPreservadasAntes,
          colecoes_preservadas: COLECOES_PRESERVADAS,
          inicio_execucao: new Date().toISOString(),
        },
        clientIp,
      )

      // 2. Desvincular relações circulares/chaves estrangeiras para permitir deleção limpa sem travas
      if ($app.hasTable('propostas')) {
        safeExecuteSql("UPDATE propostas SET contrato_servico = '', contrato = '', modelo = ''")
      }
      if ($app.hasTable('contratos_servico')) {
        safeExecuteSql("UPDATE contratos_servico SET projeto = '', proposta = ''")
      }
      if ($app.hasTable('projetos')) {
        safeExecuteSql(
          "UPDATE projetos SET grupo = '', contrato_servico = '', proposta = '', contrato = ''",
        )
      }
      if ($app.hasTable('grupos_projetos')) {
        safeExecuteSql("UPDATE grupos_projetos SET contrato_servico = '', proposta = ''")
      }
      if ($app.hasTable('ordens_servico')) {
        safeExecuteSql(
          "UPDATE ordens_servico SET projeto = '', contrato_mestre = '', subcontrato_legado = ''",
        )
      }
      if ($app.hasTable('subcontratos')) {
        safeExecuteSql(
          "UPDATE subcontratos SET projeto = '', grupo = '', contrato_servico_origem = '', cotacao = ''",
        )
      }
      if ($app.hasTable('projeto_etapas')) {
        safeExecuteSql(
          "UPDATE projeto_etapas SET projeto = '', proposta_item_origem = '', parcela_origem = '', ordem_servico_ativa = ''",
        )
      }
      if ($app.hasTable('proposta_itens')) {
        safeExecuteSql(
          "UPDATE proposta_itens SET proposta = '', projeto_gerado = '', etapa_gerada = ''",
        )
      }
      if ($app.hasTable('contas')) {
        safeExecuteSql(
          "UPDATE contas SET projeto = '', proposta = '', etapa = '', subcontrato = '', contrato_servico = '', ordem_servico = '', parcela_origem = '', marco_origem = ''",
        )
      }
      if ($app.hasTable('medicoes')) {
        safeExecuteSql("UPDATE medicoes SET subcontrato = '', projeto = ''")
      }
      if ($app.hasTable('avaliacoes_executor')) {
        safeExecuteSql("UPDATE avaliacoes_executor SET subcontrato = '', projeto = ''")
      }
      if ($app.hasTable('cotacoes')) {
        safeExecuteSql("UPDATE cotacoes SET projeto = '', grupo = '', etapa = '', pacote = ''")
      }
      if ($app.hasTable('contratos')) {
        safeExecuteSql("UPDATE contratos SET sugestao_origem = ''")
      }

      // 3. Execução sequencial da limpeza respeitando a ordem de dependência
      const apagadosPorColecao = {}
      let totalGeralApagado = 0
      let erroOcorrido = null
      let colecaoFalha = null

      for (let k = 0; k < COLECOES_NEGOCIO.length; k++) {
        const colecaoAtual = COLECOES_NEGOCIO[k]

        // Salvaguarda adicional: se por qualquer motivo uma coleção preservada estiver na lista, pula
        if (COLECOES_PRESERVADAS.indexOf(colecaoAtual) !== -1) {
          console.log('[LIMPEZA] Salvaguarda: ignorando coleção protegida ' + colecaoAtual)
          continue
        }

        if (!$app.hasTable(colecaoAtual)) {
          apagadosPorColecao[colecaoAtual] = 0
          continue
        }

        const qtdAntesTabela = contagensAntes[colecaoAtual] || 0

        try {
          $app
            .db()
            .newQuery('DELETE FROM ' + colecaoAtual)
            .execute()
          const qtdDepoisTabela = contarRegistrosTabela(colecaoAtual)
          const deltaApagado = Math.max(0, qtdAntesTabela - qtdDepoisTabela)
          apagadosPorColecao[colecaoAtual] = deltaApagado
          totalGeralApagado += deltaApagado
        } catch (errDelete) {
          console.log('[LIMPEZA] Erro na exclusão da tabela ' + colecaoAtual + ': ' + errDelete)
          erroOcorrido = String(errDelete)
          colecaoFalha = colecaoAtual
          apagadosPorColecao[colecaoAtual] = 0
          break
        }
      }

      // 4. Snapshot de conferência das coleções preservadas APÓS a limpeza
      const contagensPreservadasDepois = {}
      for (let p2 = 0; p2 < COLECOES_PRESERVADAS.length; p2++) {
        const colP2 = COLECOES_PRESERVADAS[p2]
        contagensPreservadasDepois[colP2] = contarRegistrosTabela(colP2)
      }

      // 5. Auditoria DEPOIS (seja sucesso ou com falha parcial)
      const acaoFinal = erroOcorrido
        ? 'LIMPEZA_DADOS_NEGOCIO_FALHA_PARCIAL'
        : 'LIMPEZA_DADOS_NEGOCIO_CONCLUIDA'
      registrarAuditoria(
        userId,
        userEmail,
        acaoFinal,
        'sistema',
        'limpeza_dados_negocio',
        {
          audit_inicio_id: auditInicioId,
          autor_id: userId,
          autor_email: userEmail,
          sucesso: !erroOcorrido,
          erro: erroOcorrido,
          colecao_falha: colecaoFalha,
          total_apagados: totalGeralApagado,
          apagados_por_colecao: apagadosPorColecao,
          contagens_antes: contagensAntes,
          contagens_preservadas_antes: contagensPreservadasAntes,
          contagens_preservadas_depois: contagensPreservadasDepois,
          finalizado_em: new Date().toISOString(),
        },
        clientIp,
      )

      if (erroOcorrido) {
        return e.json(500, {
          success: false,
          error: 'Falha durante a limpeza na coleção "' + colecaoFalha + '": ' + erroOcorrido,
          detalhes_parciais: {
            total_apagados_ate_falha: totalGeralApagado,
            apagados_por_colecao: apagadosPorColecao,
          },
        })
      }

      return e.json(200, {
        success: true,
        message: 'Limpeza de dados de negócio concluída com sucesso.',
        total_apagados: totalGeralApagado,
        apagados_por_colecao: apagadosPorColecao,
        preservados_conferencia: contagensPreservadasDepois,
        executado_em: new Date().toISOString(),
        executado_por: userEmail,
      })
    } catch (errGlobal) {
      console.log('[LIMPEZA] Erro geral na rota de limpeza: ' + errGlobal)
      return e.json(500, {
        success: false,
        error:
          'Erro interno no servidor ao processar a limpeza: ' + (errGlobal.message || errGlobal),
      })
    }
  },
  $apis.requireAuth(),
)

// =============================================================================
// LIMPEZA TOTAL DOS DADOS DE TESTE (RODADA DE PRODUÇÃO / v0.0.176)
// Autorizado expressamente pelo dono do sistema para zerar dados fictícios de teste.
//
// Componentes adicionados:
// 1. Função núcleo de limpeza total executarLimpezaTotalEngine()
// 2. Rota interna restrita: POST /backend/v1/sistema/limpeza-total-executar (Admin)
// 3. Cron de execução única: cronAdd('limpeza-total-oneshot', '* * * * *', ...)
// =============================================================================

// ROTA INTERNA COMPLEMENTAR (Admin)
routerAdd(
  'POST',
  '/backend/v1/sistema/limpeza-total-executar',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) {
        return e.json(401, { success: false, error: 'Autenticação necessária.' })
      }
      const role = auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, { success: false, error: 'Apenas Administrador pode executar.' })
      }
      const reqInfo = e.requestInfo()
      const clientIp =
        reqInfo && reqInfo.headers
          ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
          : '127.0.0.1'

      const userEmail = auth.getString('email') || 'admin@sistema'
      const origemChamada = 'rota_interna_admin'

      // Janela limite de execução: 2 horas a partir de 2026-04-02T11:40Z (Timestamp estático absoluto)
      const LIMPEZA_TOTAL_JANELA_ATE = 1775148000000 + 2 * 60 * 60 * 1000

      const COLECOES_LIMPEZA_TOTAL = [
        'entregavel_comentarios',
        'mensagens_os',
        'eventos_cobranca',
        'notificacoes',
        'resumos_diarios_gestor',
        'portal_entregaveis',
        'portal_documentos',
        'portal_os',
        'entregaveis_versoes',
        'entregaveis',
        'apontamentos',
        'medicoes',
        'avaliacoes_executor',
        'avaliacoes',
        'ordens_servico',
        'contratos_mestre',
        'subcontratos',
        'cotacoes',
        'pre_cotacao_respostas',
        'pre_cotacoes',
        'custos_profissional',
        'scorecards',
        'issues_revisao',
        'decisoes_acoes',
        'documentos',
        'riscos',
        'projeto_etapas',
        'grupos_projetos',
        'projetos',
        'contas',
        'contratos_servico',
        'proposta_parcelas',
        'proposta_itens',
        'propostas',
        'campanha_envios',
        'campanhas',
        'toques',
        'reativacoes_sugeridas',
        'sugestoes_funil',
        'contratos',
        'contatos',
        'erros_sistema',
        'lotes_prospeccao_auditoria',
        'prestadores_documentos',
        'profissionais_prestador',
        'prestadores',
        'executores',
        'clientes_pf',
        'empresas',
      ]

      const COLECOES_LIMPEZA_TOTAL_PRESERVADAS = [
        'users',
        'audit_logs',
        'parametros',
        'parametros_scorecards',
        'modelos',
        'motivos',
        'catalogo_servicos',
        'catalogo_escopos',
        'areas_atuacao',
        'subservicos',
        'entregaveis_padrao',
        'fontes_prospeccao',
        'links_recrutamento',
      ]

      const COLECOES_PRESERVADAS_DUVIDA = ['nao_contatar', 'exclusoes_prospeccao']

      function registrarAudit(acao, detalhes) {
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user_email', userEmail || 'SISTEMA-CRON-AUTORIZADO-DONO')
          aRec.set('acao', acao)
          aRec.set('entidade', 'sistema')
          aRec.set('registro_id', 'limpeza_total_dados_teste')
          aRec.set('detalhes', {
            timestamp_utc: new Date().toISOString(),
            ...(detalhes || {}),
          })
          aRec.set('ip', clientIp || '127.0.0.1')
          $app.save(aRec)
          return aRec.id
        } catch (err) {
          console.log('[LIMPEZA_TOTAL] Erro ao gravar audit_logs: ' + err)
          return null
        }
      }

      function contarRegistros(tabela) {
        try {
          if (!$app.hasTable(tabela)) return 0
          const qCount = $app.db().newQuery('SELECT COUNT(*) as total FROM ' + tabela)
          const res = {}
          qCount.one(res)
          return parseInt(res.total, 10) || 0
        } catch (_) {
          try {
            return $app.countRecords(tabela)
          } catch (_) {
            return 0
          }
        }
      }

      function safeSql(sql) {
        try {
          $app.db().newQuery(sql).execute()
        } catch (err) {
          console.log('[LIMPEZA_TOTAL] Aviso SQL: ' + err)
        }
      }

      function fmtTimestamp(d) {
        const pad = (n) => String(n).padStart(2, '0')
        return (
          d.getFullYear() +
          pad(d.getMonth() + 1) +
          pad(d.getDate()) +
          '-' +
          pad(d.getHours()) +
          pad(d.getMinutes()) +
          pad(d.getSeconds())
        )
      }

      function obterParamConcluido() {
        try {
          if (!$app.hasTable('parametros')) return null
          return $app.findFirstRecordByFilter('parametros', "chave = 'limpeza_total_concluida'")
        } catch (_) {
          return null
        }
      }

      function salvarParamConcluido(statusInfo) {
        try {
          if (!$app.hasTable('parametros')) return
          let rec = obterParamConcluido()
          if (!rec) {
            const pCol = $app.findCollectionByNameOrId('parametros')
            rec = new Record(pCol)
            rec.set('chave', 'limpeza_total_concluida')
            rec.set('nome', 'Flag de Limpeza Total Concluída')
            rec.set(
              'descricao',
              'Indica que a limpeza total autorizada de dados de teste já foi executada.',
            )
            rec.set('tipo', 'json')
            rec.set('categoria', 'sistema')
          }
          rec.set('valor', typeof statusInfo === 'string' ? statusInfo : JSON.stringify(statusInfo))
          $app.save(rec)
        } catch (err) {
          console.log('[LIMPEZA_TOTAL] Erro ao salvar parametro: ' + err)
        }
      }

      function gravarErro(origem, msg) {
        try {
          if (!$app.hasTable('erros_sistema')) return
          const col = $app.findCollectionByNameOrId('erros_sistema')
          const rec = new Record(col)
          rec.set('origem', origem || 'limpeza_total')
          rec.set('mensagem', String(msg || ''))
          $app.save(rec)
        } catch (_) {}
      }

      const agora = Date.now()

      // (G1) Guarda de janela de tempo
      if (agora > LIMPEZA_TOTAL_JANELA_ATE) {
        return e.json(400, {
          executado: false,
          motivo: 'Janela de execução expirada',
          limite_ate: new Date(LIMPEZA_TOTAL_JANELA_ATE).toISOString(),
        })
      }

      // (G2) Guarda de execução prévia
      const paramExistente = obterParamConcluido()
      if (paramExistente) {
        return e.json(200, {
          executado: false,
          motivo: 'Limpeza já foi executada anteriormente (flag limpeza_total_concluida presente)',
        })
      }

      // (G3) BACKUP PRIMEIRO
      const timestampStr = fmtTimestamp(new Date())
      const nomeBackupBase = 'pre-limpeza-total-' + timestampStr
      const nomeBackupZip = nomeBackupBase + '.zip'
      let backupCriado = false
      let backupConfirmadoStat = false
      let backupErro = null

      try {
        $app.createBackup(nomeBackupBase)
        backupCriado = true
      } catch (errBackup) {
        backupErro = String(errBackup)
        gravarErro('limpeza_total_backup', 'Falha ao criar backup obrigatório: ' + backupErro)
        registrarAudit('LIMPEZA_TOTAL_FALHA', {
          etapa_falha: 'criacao_backup',
          erro_backup: backupErro,
          mensagem: 'Limpeza ABORTADA: o backup prévio falhou e nada foi apagado.',
          origem: origemChamada,
        })
        return e.json(500, {
          executado: false,
          sucesso: false,
          erro: 'Falha na criação do backup obrigatório: ' + backupErro,
        })
      }

      if (backupCriado) {
        try {
          const pathsToTest = [
            'pb_data/backups/' + nomeBackupZip,
            'pb_data/backups/' + nomeBackupBase,
          ]
          for (let p = 0; p < pathsToTest.length; p++) {
            try {
              const info = $os.stat(pathsToTest[p])
              if (info) {
                backupConfirmadoStat = true
                break
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // Snapshot ANTES
      const contagensAntes = {}
      let totalRegistrosAntes = 0
      for (let i = 0; i < COLECOES_LIMPEZA_TOTAL.length; i++) {
        const col = COLECOES_LIMPEZA_TOTAL[i]
        const c = contarRegistros(col)
        contagensAntes[col] = c
        totalRegistrosAntes += c
      }

      const contagensPreservadasAntes = {}
      for (let p = 0; p < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; p++) {
        const colP = COLECOES_LIMPEZA_TOTAL_PRESERVADAS[p]
        contagensPreservadasAntes[colP] = contarRegistros(colP)
      }
      for (let pd = 0; pd < COLECOES_PRESERVADAS_DUVIDA.length; pd++) {
        const colPd = COLECOES_PRESERVADAS_DUVIDA[pd]
        contagensPreservadasAntes[colPd] = contarRegistros(colPd)
      }

      registrarAudit('LIMPEZA_TOTAL_INICIADA', {
        nome_backup: nomeBackupBase,
        backup_criado: backupCriado,
        backup_confirmado_stat: backupConfirmadoStat,
        total_registros_antes: totalRegistrosAntes,
        contagens_antes: contagensAntes,
        contagens_preservadas_antes: contagensPreservadasAntes,
        origem: origemChamada,
      })

      // (G4) Só então apagar:
      if ($app.hasTable('propostas')) {
        safeSql("UPDATE propostas SET contrato_servico = '', contrato = '', modelo = ''")
      }
      if ($app.hasTable('contratos_servico')) {
        safeSql("UPDATE contratos_servico SET projeto = '', proposta = ''")
      }
      if ($app.hasTable('projetos')) {
        safeSql(
          "UPDATE projetos SET grupo = '', contrato_servico = '', proposta = '', contrato = ''",
        )
      }
      if ($app.hasTable('grupos_projetos')) {
        safeSql("UPDATE grupos_projetos SET contrato_servico = '', proposta = ''")
      }
      if ($app.hasTable('ordens_servico')) {
        safeSql(
          "UPDATE ordens_servico SET projeto = '', contrato_mestre = '', subcontrato_legado = ''",
        )
      }
      if ($app.hasTable('subcontratos')) {
        safeSql(
          "UPDATE subcontratos SET projeto = '', grupo = '', contrato_servico_origem = '', cotacao = ''",
        )
      }
      if ($app.hasTable('projeto_etapas')) {
        safeSql(
          "UPDATE projeto_etapas SET projeto = '', proposta_item_origem = '', parcela_origem = '', ordem_servico_ativa = ''",
        )
      }
      if ($app.hasTable('proposta_itens')) {
        safeSql("UPDATE proposta_itens SET proposta = '', projeto_gerado = '', etapa_gerada = ''")
      }
      if ($app.hasTable('contas')) {
        safeSql(
          "UPDATE contas SET projeto = '', proposta = '', etapa = '', subcontrato = '', contrato_servico = '', ordem_servico = '', parcela_origem = '', marco_origem = ''",
        )
      }
      if ($app.hasTable('medicoes')) {
        safeSql("UPDATE medicoes SET subcontrato = '', projeto = ''")
      }
      if ($app.hasTable('avaliacoes_executor')) {
        safeSql("UPDATE avaliacoes_executor SET subcontrato = '', projeto = ''")
      }
      if ($app.hasTable('cotacoes')) {
        safeSql("UPDATE cotacoes SET projeto = '', grupo = '', etapa = '', pacote = ''")
      }
      if ($app.hasTable('contratos')) {
        safeSql("UPDATE contratos SET sugestao_origem = ''")
      }
      if ($app.hasTable('profissionais_prestador')) {
        safeSql("UPDATE profissionais_prestador SET prestador = ''")
      }
      if ($app.hasTable('prestadores_documentos')) {
        safeSql("UPDATE prestadores_documentos SET prestador = ''")
      }
      if ($app.hasTable('contatos')) {
        safeSql("UPDATE contatos SET empresa = ''")
      }

      const apagadosPorColecao = {}
      let totalGeralApagado = 0
      let erroOcorrido = null
      let colecaoFalha = null

      const conjuntoPreservado = {}
      for (let z = 0; z < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; z++) {
        conjuntoPreservado[COLECOES_LIMPEZA_TOTAL_PRESERVADAS[z]] = true
      }
      for (let zd = 0; zd < COLECOES_PRESERVADAS_DUVIDA.length; zd++) {
        conjuntoPreservado[COLECOES_PRESERVADAS_DUVIDA[zd]] = true
      }

      for (let k = 0; k < COLECOES_LIMPEZA_TOTAL.length; k++) {
        const colAtual = COLECOES_LIMPEZA_TOTAL[k]
        if (conjuntoPreservado[colAtual]) continue
        if (!$app.hasTable(colAtual)) {
          apagadosPorColecao[colAtual] = 0
          continue
        }

        const qtdAntes = contagensAntes[colAtual] || 0
        try {
          $app
            .db()
            .newQuery('DELETE FROM ' + colAtual)
            .execute()
          const qtdDepois = contarRegistros(colAtual)
          const delta = Math.max(0, qtdAntes - qtdDepois)
          apagadosPorColecao[colAtual] = delta
          totalGeralApagado += delta
        } catch (errDel) {
          erroOcorrido = String(errDel)
          colecaoFalha = colAtual
          apagadosPorColecao[colAtual] = 0
          gravarErro('limpeza_total_delete_' + colAtual, erroOcorrido)
          break
        }
      }

      const contagensDepois = {}
      for (let d = 0; d < COLECOES_LIMPEZA_TOTAL.length; d++) {
        const colD = COLECOES_LIMPEZA_TOTAL[d]
        contagensDepois[colD] = contarRegistros(colD)
      }

      const contagensPreservadasDepois = {}
      for (let p2 = 0; p2 < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; p2++) {
        const colP2 = COLECOES_LIMPEZA_TOTAL_PRESERVADAS[p2]
        contagensPreservadasDepois[colP2] = contarRegistros(colP2)
      }
      for (let pd2 = 0; pd2 < COLECOES_PRESERVADAS_DUVIDA.length; pd2++) {
        const colPd2 = COLECOES_PRESERVADAS_DUVIDA[pd2]
        contagensPreservadasDepois[colPd2] = contarRegistros(colPd2)
      }

      const statusParam = {
        concluido_em: new Date().toISOString(),
        sucesso: !erroOcorrido,
        nome_backup: nomeBackupBase,
        backup_confirmado: backupConfirmadoStat,
        total_apagados: totalGeralApagado,
        erro: erroOcorrido,
        colecao_falha: colecaoFalha,
        origem: origemChamada,
      }
      salvarParamConcluido(statusParam)

      const acaoFinal = erroOcorrido ? 'LIMPEZA_TOTAL_FALHA' : 'LIMPEZA_TOTAL_CONCLUIDA'
      registrarAudit(acaoFinal, {
        sucesso: !erroOcorrido,
        nome_backup: nomeBackupBase,
        backup_confirmado_stat: backupConfirmadoStat,
        erro: erroOcorrido,
        colecao_falha: colecaoFalha,
        total_apagados: totalGeralApagado,
        apagados_por_colecao: apagadosPorColecao,
        contagens_antes: contagensAntes,
        contagens_depois: contagensDepois,
        contagens_preservadas_antes: contagensPreservadasAntes,
        contagens_preservadas_depois: contagensPreservadasDepois,
        colecoes_preservadas_duvida: COLECOES_PRESERVADAS_DUVIDA,
        data_hora: new Date().toISOString(),
        origem: origemChamada,
      })

      return e.json(200, {
        success: true,
        resultado: {
          executado: true,
          sucesso: !erroOcorrido,
          nome_backup: nomeBackupBase,
          backup_confirmado_stat: backupConfirmadoStat,
          total_apagados: totalGeralApagado,
          contagens_antes: contagensAntes,
          contagens_depois: contagensDepois,
          contagens_preservadas_depois: contagensPreservadasDepois,
          erro: erroOcorrido,
          colecao_falha: colecaoFalha,
        },
      })
    } catch (err) {
      return e.json(500, { success: false, error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// CRON DE EXECUÇÃO ÚNICA (One-shot)
// Roda a cada minuto; graças às guardas G1 e G2, executa exatamente 1 vez logo após o deploy
// e depois é no-op silencioso permanente.
cronAdd('limpeza-total-oneshot', '* * * * *', () => {
  try {
    const userEmail = 'SISTEMA-CRON-AUTORIZADO-DONO'
    const clientIp = '127.0.0.1'
    const origemChamada = 'cron_limpeza_total_oneshot'

    // Janela limite de execução: 2 horas a partir de 2026-04-02T11:40Z (Timestamp estático absoluto)
    const LIMPEZA_TOTAL_JANELA_ATE = 1775148000000 + 2 * 60 * 60 * 1000

    const COLECOES_LIMPEZA_TOTAL = [
      'entregavel_comentarios',
      'mensagens_os',
      'eventos_cobranca',
      'notificacoes',
      'resumos_diarios_gestor',
      'portal_entregaveis',
      'portal_documentos',
      'portal_os',
      'entregaveis_versoes',
      'entregaveis',
      'apontamentos',
      'medicoes',
      'avaliacoes_executor',
      'avaliacoes',
      'ordens_servico',
      'contratos_mestre',
      'subcontratos',
      'cotacoes',
      'pre_cotacao_respostas',
      'pre_cotacoes',
      'custos_profissional',
      'scorecards',
      'issues_revisao',
      'decisoes_acoes',
      'documentos',
      'riscos',
      'projeto_etapas',
      'grupos_projetos',
      'projetos',
      'contas',
      'contratos_servico',
      'proposta_parcelas',
      'proposta_itens',
      'propostas',
      'campanha_envios',
      'campanhas',
      'toques',
      'reativacoes_sugeridas',
      'sugestoes_funil',
      'contratos',
      'contatos',
      'erros_sistema',
      'lotes_prospeccao_auditoria',
      'prestadores_documentos',
      'profissionais_prestador',
      'prestadores',
      'executores',
      'clientes_pf',
      'empresas',
    ]

    const COLECOES_LIMPEZA_TOTAL_PRESERVADAS = [
      'users',
      'audit_logs',
      'parametros',
      'parametros_scorecards',
      'modelos',
      'motivos',
      'catalogo_servicos',
      'catalogo_escopos',
      'areas_atuacao',
      'subservicos',
      'entregaveis_padrao',
      'fontes_prospeccao',
      'links_recrutamento',
    ]

    const COLECOES_PRESERVADAS_DUVIDA = ['nao_contatar', 'exclusoes_prospeccao']

    function registrarAudit(acao, detalhes) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user_email', userEmail)
        aRec.set('acao', acao)
        aRec.set('entidade', 'sistema')
        aRec.set('registro_id', 'limpeza_total_dados_teste')
        aRec.set('detalhes', {
          timestamp_utc: new Date().toISOString(),
          ...(detalhes || {}),
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
        return aRec.id
      } catch (err) {
        console.log('[LIMPEZA_TOTAL] Erro ao gravar audit_logs: ' + err)
        return null
      }
    }

    function contarRegistros(tabela) {
      try {
        if (!$app.hasTable(tabela)) return 0
        const qCount = $app.db().newQuery('SELECT COUNT(*) as total FROM ' + tabela)
        const res = {}
        qCount.one(res)
        return parseInt(res.total, 10) || 0
      } catch (_) {
        try {
          return $app.countRecords(tabela)
        } catch (_) {
          return 0
        }
      }
    }

    function safeSql(sql) {
      try {
        $app.db().newQuery(sql).execute()
      } catch (err) {
        console.log('[LIMPEZA_TOTAL] Aviso SQL: ' + err)
      }
    }

    function fmtTimestamp(d) {
      const pad = (n) => String(n).padStart(2, '0')
      return (
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        '-' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
      )
    }

    function obterParamConcluido() {
      try {
        if (!$app.hasTable('parametros')) return null
        return $app.findFirstRecordByFilter('parametros', "chave = 'limpeza_total_concluida'")
      } catch (_) {
        return null
      }
    }

    function salvarParamConcluido(statusInfo) {
      try {
        if (!$app.hasTable('parametros')) return
        let rec = obterParamConcluido()
        if (!rec) {
          const pCol = $app.findCollectionByNameOrId('parametros')
          rec = new Record(pCol)
          rec.set('chave', 'limpeza_total_concluida')
          rec.set('nome', 'Flag de Limpeza Total Concluída')
          rec.set(
            'descricao',
            'Indica que a limpeza total autorizada de dados de teste já foi executada.',
          )
          rec.set('tipo', 'json')
          rec.set('categoria', 'sistema')
        }
        rec.set('valor', typeof statusInfo === 'string' ? statusInfo : JSON.stringify(statusInfo))
        $app.save(rec)
      } catch (err) {
        console.log('[LIMPEZA_TOTAL] Erro ao salvar parametro: ' + err)
      }
    }

    function gravarErro(origem, msg) {
      try {
        if (!$app.hasTable('erros_sistema')) return
        const col = $app.findCollectionByNameOrId('erros_sistema')
        const rec = new Record(col)
        rec.set('origem', origem || 'limpeza_total')
        rec.set('mensagem', String(msg || ''))
        $app.save(rec)
      } catch (_) {}
    }

    const agora = Date.now()

    // (G1) Guarda de janela de tempo
    if (agora > LIMPEZA_TOTAL_JANELA_ATE) {
      console.log('[LIMPEZA_TOTAL] Janela expirada no cron. Abortando.')
      return
    }

    // (G2) Guarda de execução prévia: se parametros(chave='limpeza_total_concluida') já existir, no-op silencioso
    const paramExistente = obterParamConcluido()
    if (paramExistente) {
      // no-op silencioso
      return
    }

    console.log('[LIMPEZA_TOTAL_CRON] Executando limpeza total oneshot autorizada...')

    // (G3) BACKUP PRIMEIRO: $app.createBackup('pre-limpeza-total-' + timestamp AAAAMMDD-HHMMSS)
    const timestampStr = fmtTimestamp(new Date())
    const nomeBackupBase = 'pre-limpeza-total-' + timestampStr
    const nomeBackupZip = nomeBackupBase + '.zip'
    let backupCriado = false
    let backupConfirmadoStat = false
    let backupErro = null

    try {
      $app.createBackup(nomeBackupBase)
      backupCriado = true
      console.log('[LIMPEZA_TOTAL_CRON] Backup criado: ' + nomeBackupBase)
    } catch (errBackup) {
      backupErro = String(errBackup)
      console.log('[LIMPEZA_TOTAL_CRON] FALHA CRÍTICA NO BACKUP: ' + backupErro)
      gravarErro('limpeza_total_backup', 'Falha ao criar backup obrigatório: ' + backupErro)
      registrarAudit('LIMPEZA_TOTAL_FALHA', {
        etapa_falha: 'criacao_backup',
        erro_backup: backupErro,
        mensagem: 'Limpeza ABORTADA: o backup prévio falhou e nada foi apagado.',
        origem: origemChamada,
      })
      return
    }

    // Confirmar com $os.stat
    if (backupCriado) {
      try {
        const pathsToTest = [
          'pb_data/backups/' + nomeBackupZip,
          'pb_data/backups/' + nomeBackupBase,
        ]
        for (let p = 0; p < pathsToTest.length; p++) {
          try {
            const info = $os.stat(pathsToTest[p])
            if (info) {
              backupConfirmadoStat = true
              console.log('[LIMPEZA_TOTAL_CRON] Backup confirmado no disco: ' + pathsToTest[p])
              break
            }
          } catch (_) {}
        }
      } catch (errStat) {
        console.log('[LIMPEZA_TOTAL_CRON] Aviso ao verificar $os.stat: ' + errStat)
      }
    }

    // Snapshot ANTES
    const contagensAntes = {}
    let totalRegistrosAntes = 0
    for (let i = 0; i < COLECOES_LIMPEZA_TOTAL.length; i++) {
      const col = COLECOES_LIMPEZA_TOTAL[i]
      const c = contarRegistros(col)
      contagensAntes[col] = c
      totalRegistrosAntes += c
    }

    const contagensPreservadasAntes = {}
    for (let p = 0; p < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; p++) {
      const colP = COLECOES_LIMPEZA_TOTAL_PRESERVADAS[p]
      contagensPreservadasAntes[colP] = contarRegistros(colP)
    }
    for (let pd = 0; pd < COLECOES_PRESERVADAS_DUVIDA.length; pd++) {
      const colPd = COLECOES_PRESERVADAS_DUVIDA[pd]
      contagensPreservadasAntes[colPd] = contarRegistros(colPd)
    }

    registrarAudit('LIMPEZA_TOTAL_INICIADA', {
      nome_backup: nomeBackupBase,
      backup_criado: backupCriado,
      backup_confirmado_stat: backupConfirmadoStat,
      total_registros_antes: totalRegistrosAntes,
      contagens_antes: contagensAntes,
      contagens_preservadas_antes: contagensPreservadasAntes,
      origem: origemChamada,
    })

    // (G4) Só então apagar:
    // Zera referências cruzadas
    console.log('[LIMPEZA_TOTAL_CRON] Zerando referências cruzadas...')
    if ($app.hasTable('propostas')) {
      safeSql("UPDATE propostas SET contrato_servico = '', contrato = '', modelo = ''")
    }
    if ($app.hasTable('contratos_servico')) {
      safeSql("UPDATE contratos_servico SET projeto = '', proposta = ''")
    }
    if ($app.hasTable('projetos')) {
      safeSql("UPDATE projetos SET grupo = '', contrato_servico = '', proposta = '', contrato = ''")
    }
    if ($app.hasTable('grupos_projetos')) {
      safeSql("UPDATE grupos_projetos SET contrato_servico = '', proposta = ''")
    }
    if ($app.hasTable('ordens_servico')) {
      safeSql(
        "UPDATE ordens_servico SET projeto = '', contrato_mestre = '', subcontrato_legado = ''",
      )
    }
    if ($app.hasTable('subcontratos')) {
      safeSql(
        "UPDATE subcontratos SET projeto = '', grupo = '', contrato_servico_origem = '', cotacao = ''",
      )
    }
    if ($app.hasTable('projeto_etapas')) {
      safeSql(
        "UPDATE projeto_etapas SET projeto = '', proposta_item_origem = '', parcela_origem = '', ordem_servico_ativa = ''",
      )
    }
    if ($app.hasTable('proposta_itens')) {
      safeSql("UPDATE proposta_itens SET proposta = '', projeto_gerado = '', etapa_gerada = ''")
    }
    if ($app.hasTable('contas')) {
      safeSql(
        "UPDATE contas SET projeto = '', proposta = '', etapa = '', subcontrato = '', contrato_servico = '', ordem_servico = '', parcela_origem = '', marco_origem = ''",
      )
    }
    if ($app.hasTable('medicoes')) {
      safeSql("UPDATE medicoes SET subcontrato = '', projeto = ''")
    }
    if ($app.hasTable('avaliacoes_executor')) {
      safeSql("UPDATE avaliacoes_executor SET subcontrato = '', projeto = ''")
    }
    if ($app.hasTable('cotacoes')) {
      safeSql("UPDATE cotacoes SET projeto = '', grupo = '', etapa = '', pacote = ''")
    }
    if ($app.hasTable('contratos')) {
      safeSql("UPDATE contratos SET sugestao_origem = ''")
    }
    if ($app.hasTable('profissionais_prestador')) {
      safeSql("UPDATE profissionais_prestador SET prestador = ''")
    }
    if ($app.hasTable('prestadores_documentos')) {
      safeSql("UPDATE prestadores_documentos SET prestador = ''")
    }
    if ($app.hasTable('contatos')) {
      safeSql("UPDATE contatos SET empresa = ''")
    }

    // Execução da exclusão respeitando a ordem filhos -> pais
    const apagadosPorColecao = {}
    let totalGeralApagado = 0
    let erroOcorrido = null
    let colecaoFalha = null

    const conjuntoPreservado = {}
    for (let z = 0; z < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; z++) {
      conjuntoPreservado[COLECOES_LIMPEZA_TOTAL_PRESERVADAS[z]] = true
    }
    for (let zd = 0; zd < COLECOES_PRESERVADAS_DUVIDA.length; zd++) {
      conjuntoPreservado[COLECOES_PRESERVADAS_DUVIDA[zd]] = true
    }

    for (let k = 0; k < COLECOES_LIMPEZA_TOTAL.length; k++) {
      const colAtual = COLECOES_LIMPEZA_TOTAL[k]

      if (conjuntoPreservado[colAtual]) {
        continue
      }

      if (!$app.hasTable(colAtual)) {
        apagadosPorColecao[colAtual] = 0
        continue
      }

      const qtdAntes = contagensAntes[colAtual] || 0
      try {
        $app
          .db()
          .newQuery('DELETE FROM ' + colAtual)
          .execute()
        const qtdDepois = contarRegistros(colAtual)
        const delta = Math.max(0, qtdAntes - qtdDepois)
        apagadosPorColecao[colAtual] = delta
        totalGeralApagado += delta
        console.log(
          '[LIMPEZA_TOTAL_CRON] ' + colAtual + ': antes=' + qtdAntes + ' depois=' + qtdDepois,
        )
      } catch (errDel) {
        console.log('[LIMPEZA_TOTAL_CRON] Erro ao deletar ' + colAtual + ': ' + errDel)
        erroOcorrido = String(errDel)
        colecaoFalha = colAtual
        apagadosPorColecao[colAtual] = 0
        gravarErro('limpeza_total_delete_' + colAtual, erroOcorrido)
        break
      }
    }

    const contagensDepois = {}
    for (let d = 0; d < COLECOES_LIMPEZA_TOTAL.length; d++) {
      const colD = COLECOES_LIMPEZA_TOTAL[d]
      contagensDepois[colD] = contarRegistros(colD)
    }

    const contagensPreservadasDepois = {}
    for (let p2 = 0; p2 < COLECOES_LIMPEZA_TOTAL_PRESERVADAS.length; p2++) {
      const colP2 = COLECOES_LIMPEZA_TOTAL_PRESERVADAS[p2]
      contagensPreservadasDepois[colP2] = contarRegistros(colP2)
    }
    for (let pd2 = 0; pd2 < COLECOES_PRESERVADAS_DUVIDA.length; pd2++) {
      const colPd2 = COLECOES_PRESERVADAS_DUVIDA[pd2]
      contagensPreservadasDepois[colPd2] = contarRegistros(colPd2)
    }

    // Gravar / Atualizar parametros(chave='limpeza_total_concluida')
    const statusParam = {
      concluido_em: new Date().toISOString(),
      sucesso: !erroOcorrido,
      nome_backup: nomeBackupBase,
      backup_confirmado: backupConfirmadoStat,
      total_apagados: totalGeralApagado,
      erro: erroOcorrido,
      colecao_falha: colecaoFalha,
      origem: origemChamada,
    }
    salvarParamConcluido(statusParam)

    const acaoFinal = erroOcorrido ? 'LIMPEZA_TOTAL_FALHA' : 'LIMPEZA_TOTAL_CONCLUIDA'
    registrarAudit(acaoFinal, {
      sucesso: !erroOcorrido,
      nome_backup: nomeBackupBase,
      backup_confirmado_stat: backupConfirmadoStat,
      erro: erroOcorrido,
      colecao_falha: colecaoFalha,
      total_apagados: totalGeralApagado,
      apagados_por_colecao: apagadosPorColecao,
      contagens_antes: contagensAntes,
      contagens_depois: contagensDepois,
      contagens_preservadas_antes: contagensPreservadasAntes,
      contagens_preservadas_depois: contagensPreservadasDepois,
      colecoes_preservadas_duvida: COLECOES_PRESERVADAS_DUVIDA,
      data_hora: new Date().toISOString(),
      origem: origemChamada,
    })

    console.log('[LIMPEZA_TOTAL_CRON] Concluído com sucesso! Total apagados: ' + totalGeralApagado)
  } catch (errCron) {
    console.log('[LIMPEZA_TOTAL_CRON] Erro não capturado no cron: ' + errCron)
  }
})
