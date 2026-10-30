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
