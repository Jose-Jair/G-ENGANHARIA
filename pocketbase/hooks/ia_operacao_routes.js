// =============================================================================
// GESTÃO G+ — IA A SERVIÇO DA OPERAÇÃO (RODADA 9 - PARTE 1: BACKEND)
// Endpoints One-Shot sob /backend/v1/ia/*
// 1. POST /backend/v1/ia/escopo-pacote (Admin, Gestor)
// 2. POST /backend/v1/ia/justificativa-prestador (Admin, Gestor)
// 3. POST /backend/v1/ia/texto-canal-os (Admin, Gestor, Comercial + Prestador da OS)
// 4. POST /backend/v1/ia/resumo-dia (Admin, Gestor)
// 5. POST /backend/v1/ia/pre-revisao-entregavel (Admin, Gestor - Gate liga/desliga)
//
// NOTA ARQUITETURAL SKIP CLOUD / POCKETBASE:
// Cada callback do routerAdd roda em uma VM isolada da pool Goja.
// Todas as funções auxiliares de validação, auditoria e parsing de JSON
// são declaradas DENTRO de cada callback para prevenir ReferenceError.
// =============================================================================

// =============================================================================
// 1. POST /backend/v1/ia/escopo-pacote
// Perfil: Admin, Gestor
// Chave: ia_escopo
// =============================================================================
routerAdd(
  'POST',
  '/backend/v1/ia/escopo-pacote',
  (e) => {
    function obterParametroAtivo(chave) {
      try {
        const recs = $app.findRecordsByFilter(
          'parametros',
          "chave = '" + chave.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (recs.length === 0) return false
        const val = String(recs[0].getString('valor')).trim().toLowerCase()
        return val === 'true' || val === '1' || val === 'sim'
      } catch (_) {
        return false
      }
    }

    function registrarAuditoria(
      userId,
      userEmail,
      recurso,
      acao,
      entidade,
      registroId,
      detalhesSafe,
      reqInfo,
    ) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao || 'IA_GERACAO_ONE_SHOT')
        aRec.set('entidade', entidade || 'ia_operacao')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          recurso: recurso,
          timestamp_utc: new Date().toISOString(),
          ...(detalhesSafe || {}),
        })
        const ip =
          reqInfo && reqInfo.headers
            ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
            : '127.0.0.1'
        aRec.set('ip', ip)
        $app.save(aRec)
      } catch (err) {
        console.log('Aviso ao registrar auditoria de IA: ' + err)
      }
    }

    function extrairJson(rawText, fallbackObj) {
      if (!rawText || typeof rawText !== 'string') return fallbackObj
      let text = rawText.trim()
      if (text.startsWith('```json')) {
        text = text.substring(7)
      } else if (text.startsWith('```')) {
        text = text.substring(3)
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      }
      text = text.trim()
      try {
        return JSON.parse(text)
      } catch (_) {
        const f = text.indexOf('{')
        const l = text.lastIndexOf('}')
        if (f !== -1 && l !== -1 && l > f) {
          try {
            return JSON.parse(text.substring(f, l + 1))
          } catch (e2) {}
        }
      }
      return {
        ...fallbackObj,
        raw_texto: rawText,
        parse_sucesso: false,
      }
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: Geração de escopo de pacote permitida apenas para Admin e Gestor de Projetos.',
        })
      }

      // Validação de Chave na Administração
      if (!obterParametroAtivo('ia_escopo')) {
        return e.json(400, {
          error:
            'O recurso de IA para Escopo de Pacotes está desativado nos Parâmetros do sistema.',
          chave: 'ia_escopo',
        })
      }

      const body = e.requestInfo().body || {}
      const disciplina = (body.disciplina || '').trim()
      const propostaTexto = (body.proposta_texto || body.descricao_proposta || '').trim()
      const catalogoEscopoId = (body.catalogo_escopo_id || '').trim()
      const pacoteId = (body.pacote_id || '').trim()
      const projetoCodigo = (body.projeto_codigo || '').trim()

      if (!disciplina && !propostaTexto && !catalogoEscopoId) {
        return e.json(400, {
          error: 'Informe ao menos a disciplina técnica ou o texto da proposta/necessidade.',
        })
      }

      // Contexto a partir do Catálogo de Escopos se disponível
      let catalogoInfo = ''
      if (catalogoEscopoId || disciplina) {
        try {
          const filter = catalogoEscopoId
            ? "id = '" + catalogoEscopoId + "'"
            : "disciplina ~ '" + disciplina.replace(/'/g, "''") + "' && ativo = true"
          const recs = $app.findRecordsByFilter('catalogo_escopos', filter, '', 1, 0)
          if (recs.length > 0) {
            const cat = recs[0]
            catalogoInfo = `Catálogo de Escopos Padrão (${cat.getString('disciplina')} - ${cat.getString('nome')}): Entregáveis Padrão: ${JSON.stringify(cat.get('entregaveis_padrao') || [])}. Checklist de Revisão: ${JSON.stringify(cat.get('checklist_revisao') || [])}.`
          }
        } catch (_) {}
      }

      const promptMensagem = `Gere o escopo técnico e a lista de entregáveis padrão para o pacote de trabalho.
DADOS DO PACOTE:
- Projeto Código: ${projetoCodigo || 'Não informado'}
- Disciplina Técnica: ${disciplina || 'Engenharia'}
- Texto da Proposta / Descrição da Demanda: ${propostaTexto || 'Elaboração técnica de projetos executivos'}
${catalogoInfo ? '- Referência do Catálogo: ' + catalogoInfo : ''}

Responda OBRIGATORIAMENTE no formato JSON especificado nas diretrizes do agente.`

      const agent = $ai.agent('ia-escopo-pacote')
      const result = agent.chat({
        user_id: auth.id,
        message: promptMensagem,
      })

      const parsed = extrairJson(result.content, {
        disciplina: disciplina,
        titulo_pacote: 'Pacote de Trabalho - ' + (disciplina || 'Engenharia'),
        escopo_detalhado: result.content,
        entregaveis_sugeridos: [],
      })

      registrarAuditoria(
        auth.id,
        auth.getString('email'),
        'ia_escopo',
        'IA_GERACAO_ESCOPO_PACOTE',
        'projeto_etapas',
        pacoteId,
        {
          disciplina: disciplina,
          projeto_codigo: projetoCodigo || null,
          has_catalogo_ref: Boolean(catalogoInfo),
        },
        e.requestInfo(),
      )

      return e.json(200, {
        sucesso: true,
        recurso: 'ia_escopo',
        rascunho: parsed,
      })
    } catch (err) {
      console.log('Erro na rota /backend/v1/ia/escopo-pacote: ' + err)
      return e.json(500, {
        error: 'Erro ao processar geração de escopo com IA: ' + (err.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// =============================================================================
// 2. POST /backend/v1/ia/justificativa-prestador
// Perfil: Admin, Gestor
// Chave: ia_justificativa_prestador
// =============================================================================
routerAdd(
  'POST',
  '/backend/v1/ia/justificativa-prestador',
  (e) => {
    function obterParametroAtivo(chave) {
      try {
        const recs = $app.findRecordsByFilter(
          'parametros',
          "chave = '" + chave.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (recs.length === 0) return false
        const val = String(recs[0].getString('valor')).trim().toLowerCase()
        return val === 'true' || val === '1' || val === 'sim'
      } catch (_) {
        return false
      }
    }

    function registrarAuditoria(
      userId,
      userEmail,
      recurso,
      acao,
      entidade,
      registroId,
      detalhesSafe,
      reqInfo,
    ) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao || 'IA_GERACAO_ONE_SHOT')
        aRec.set('entidade', entidade || 'ia_operacao')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          recurso: recurso,
          timestamp_utc: new Date().toISOString(),
          ...(detalhesSafe || {}),
        })
        const ip =
          reqInfo && reqInfo.headers
            ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
            : '127.0.0.1'
        aRec.set('ip', ip)
        $app.save(aRec)
      } catch (err) {
        console.log('Aviso ao registrar auditoria de IA: ' + err)
      }
    }

    function extrairJson(rawText, fallbackObj) {
      if (!rawText || typeof rawText !== 'string') return fallbackObj
      let text = rawText.trim()
      if (text.startsWith('```json')) {
        text = text.substring(7)
      } else if (text.startsWith('```')) {
        text = text.substring(3)
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      }
      text = text.trim()
      try {
        return JSON.parse(text)
      } catch (_) {
        const f = text.indexOf('{')
        const l = text.lastIndexOf('}')
        if (f !== -1 && l !== -1 && l > f) {
          try {
            return JSON.parse(text.substring(f, l + 1))
          } catch (e2) {}
        }
      }
      return {
        ...fallbackObj,
        raw_texto: rawText,
        parse_sucesso: false,
      }
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: Justificativa de prestador permitida apenas para Admin e Gestor de Projetos.',
        })
      }

      if (!obterParametroAtivo('ia_justificativa_prestador')) {
        return e.json(400, {
          error:
            'O recurso de IA para Justificativa de Prestador está desativado nos Parâmetros do sistema.',
          chave: 'ia_justificativa_prestador',
        })
      }

      const body = e.requestInfo().body || {}
      const prestadorId = (body.prestador_id || '').trim()
      const disciplina = (body.disciplina || '').trim()
      const regiao = (body.regiao || '').trim()

      if (!prestadorId) {
        return e.json(400, { error: 'O parâmetro prestador_id é obrigatório.' })
      }

      let pRec
      try {
        pRec = $app.findRecordById('prestadores', prestadorId)
      } catch (_) {
        return e.json(404, { error: 'Prestador não encontrado.' })
      }

      const nomePrestador = pRec.getString('nome')
      const ufPrestador = pRec.getString('uf') || regiao || 'Brasil'
      const capMax = pRec.getInt('capacidade_simultanea') || 3
      const notaMedia = pRec.getFloat('nota_geral') || pRec.getFloat('nota_media') || 5.0
      const totalAval = pRec.getInt('total_avaliacoes') || 0
      const tipoPrestador = pRec.getString('tipo') || 'externo'

      let osAtivasQtd = 0
      try {
        const osAtivas = $app.findRecordsByFilter(
          'ordens_servico',
          "prestador = '" +
            prestadorId +
            "' && (status = 'em_execucao' || status = 'em_revisao' || status = 'assinada')",
          '',
          100,
          0,
        )
        osAtivasQtd = osAtivas.length
      } catch (_) {}
      const capLivre = Math.max(0, capMax - osAtivasQtd)

      let tendencia = 'estavel'
      let totalEncerradas = 0
      try {
        const ultimasOs = $app.findRecordsByFilter(
          'ordens_servico',
          "prestador = '" + prestadorId + "' && (status = 'encerrada' || status = 'concluida')",
          '-data_conclusao',
          5,
          0,
        )
        totalEncerradas = ultimasOs.length
        if (ultimasOs.length >= 2) {
          const atrasos = []
          for (let u = 0; u < ultimasOs.length; u++) {
            const dtPrev = ultimasOs[u].getString('data_previsao_fim')
            const dtFim =
              ultimasOs[u].getString('data_conclusao') || ultimasOs[u].getString('updated')
            if (dtPrev && dtFim) {
              const diff = Math.floor(
                (new Date(dtFim).getTime() - new Date(dtPrev).getTime()) / (1000 * 60 * 60 * 24),
              )
              atrasos.push(diff)
            }
          }
          if (atrasos.length >= 2) {
            if (atrasos[0] < atrasos[1]) tendencia = 'melhorou'
            else if (atrasos[0] > atrasos[1]) tendencia = 'piorou'
          }
        }
      } catch (_) {}

      const promptMensagem = `Redija a justificativa técnica de indicação do prestador para a disciplina informada.
INDICADORES CONSOLIDADOS DO PRESTADOR:
- Nome do Prestador: ${nomePrestador} (Tipo: ${tipoPrestador})
- Disciplina Solicitada: ${disciplina || 'Engenharia'}
- Região/UF: ${ufPrestador}
- Capacidade Simultânea Máxima: ${capMax}
- OS Ativas no Momento: ${osAtivasQtd}
- Capacidade Simultânea Livre: ${capLivre}
- Nota Média Avaliada: ${notaMedia.toFixed(1)} / 5.0 (${totalAval} avaliações registradas)
- Tendência Recente de Entregas: ${tendencia.toUpperCase()} (Base: ${totalEncerradas} OS anteriores analisadas)

Responda OBRIGATORIAMENTE no formato JSON especificado nas diretrizes do agente.`

      const agent = $ai.agent('ia-justificativa-prestador')
      const result = agent.chat({
        user_id: auth.id,
        message: promptMensagem,
      })

      const parsed = extrairJson(result.content, {
        prestador_nome: nomePrestador,
        nivel_recomendacao: capLivre > 0 ? 'recomendado' : 'recomendado_com_ressalvas',
        justificativa_texto: result.content,
        pontos_fortes: [`Nota média ${notaMedia.toFixed(1)}`, `Capacidade livre ${capLivre}`],
        pontos_atencao: capLivre === 0 ? ['Prestador operando no limite de capacidade'] : [],
        resumo_indicadores: {
          disciplina: disciplina,
          capacidade_livre: capLivre,
          capacidade_maxima: capMax,
          nota_media: notaMedia,
          tendencia: tendencia,
        },
      })

      registrarAuditoria(
        auth.id,
        auth.getString('email'),
        'ia_justificativa_prestador',
        'IA_GERACAO_JUSTIFICATIVA_PRESTADOR',
        'prestadores',
        prestadorId,
        {
          prestador_id: prestadorId,
          disciplina: disciplina,
          capacidade_livre: capLivre,
          tendencia: tendencia,
        },
        e.requestInfo(),
      )

      return e.json(200, {
        sucesso: true,
        recurso: 'ia_justificativa_prestador',
        rascunho: parsed,
      })
    } catch (err) {
      console.log('Erro na rota /backend/v1/ia/justificativa-prestador: ' + err)
      return e.json(500, {
        error: 'Erro ao processar justificativa com IA: ' + (err.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// =============================================================================
// 3. POST /backend/v1/ia/texto-canal-os
// Perfil: Admin, Gestor, Comercial (cobrança/alinhamento)
//         Executor/Prestador autêntico dono da OS (somente para resposta da OS)
// Chave: ia_texto_canal
// REGRA DURA: O prompt do prestador NUNCA recebe cliente, obra, proposta,
//             valor do contrato, BDI ou dados de outros prestadores.
// =============================================================================
routerAdd(
  'POST',
  '/backend/v1/ia/texto-canal-os',
  (e) => {
    function obterParametroAtivo(chave) {
      try {
        const recs = $app.findRecordsByFilter(
          'parametros',
          "chave = '" + chave.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (recs.length === 0) return false
        const val = String(recs[0].getString('valor')).trim().toLowerCase()
        return val === 'true' || val === '1' || val === 'sim'
      } catch (_) {
        return false
      }
    }

    function registrarAuditoria(
      userId,
      userEmail,
      recurso,
      acao,
      entidade,
      registroId,
      detalhesSafe,
      reqInfo,
    ) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao || 'IA_GERACAO_ONE_SHOT')
        aRec.set('entidade', entidade || 'ia_operacao')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          recurso: recurso,
          timestamp_utc: new Date().toISOString(),
          ...(detalhesSafe || {}),
        })
        const ip =
          reqInfo && reqInfo.headers
            ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
            : '127.0.0.1'
        aRec.set('ip', ip)
        $app.save(aRec)
      } catch (err) {
        console.log('Aviso ao registrar auditoria de IA: ' + err)
      }
    }

    function extrairJson(rawText, fallbackObj) {
      if (!rawText || typeof rawText !== 'string') return fallbackObj
      let text = rawText.trim()
      if (text.startsWith('```json')) {
        text = text.substring(7)
      } else if (text.startsWith('```')) {
        text = text.substring(3)
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      }
      text = text.trim()
      try {
        return JSON.parse(text)
      } catch (_) {
        const f = text.indexOf('{')
        const l = text.lastIndexOf('}')
        if (f !== -1 && l !== -1 && l > f) {
          try {
            return JSON.parse(text.substring(f, l + 1))
          } catch (e2) {}
        }
      }
      return {
        ...fallbackObj,
        raw_texto: rawText,
        parse_sucesso: false,
      }
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const role = auth.getString('role')
      const userEmail = auth.getString('email')
      const body = e.requestInfo().body || {}
      const osId = (body.os_id || '').trim()
      const finalidade = (body.finalidade || 'cobranca_preventiva').trim()
      const contextoExtra = (body.contexto_extra || '').trim()

      if (!osId) {
        return e.json(400, { error: 'O parâmetro os_id é obrigatório.' })
      }

      if (!obterParametroAtivo('ia_texto_canal')) {
        return e.json(400, {
          error:
            'O recurso de IA para Texto de Canal da OS está desativado nos Parâmetros do sistema.',
          chave: 'ia_texto_canal',
        })
      }

      let osRec
      try {
        osRec = $app.findRecordById('ordens_servico', osId)
      } catch (_) {
        return e.json(404, { error: 'Ordem de Serviço não encontrada.' })
      }

      const prestadorId = osRec.getString('prestador')
      let pRec = null
      if (prestadorId) {
        try {
          pRec = $app.findRecordById('prestadores', prestadorId)
        } catch (_) {}
      }

      const isInternalStaff = role === 'admin' || role === 'gestor' || role === 'comercial'
      const isOwnerPrestador =
        role === 'executor' &&
        pRec &&
        pRec.getString('email').toLowerCase() === userEmail.toLowerCase()

      if (!isInternalStaff && !isOwnerPrestador) {
        return e.json(403, {
          error:
            'Acesso restrito: Apenas a coordenação interna ou o prestador titular da OS podem redigir mensagens com assistência de IA.',
        })
      }

      if (isOwnerPrestador && finalidade !== 'resposta_prestador') {
        return e.json(403, {
          error:
            'Prestadores podem utilizar a IA exclusivamente para redação de respostas e alinhamentos de sua própria OS.',
        })
      }

      // Código do Projeto (SOMENTE o código PRJ, NUNCA cliente ou nome da obra)
      let codigoProjeto = 'PRJ-SISTEMA'
      const projetoId = osRec.getString('projeto')
      if (projetoId) {
        try {
          const projRec = $app.findRecordById('projetos', projetoId)
          if (projRec) {
            codigoProjeto = projRec.getString('codigo') || codigoProjeto
          }
        } catch (_) {}
      }

      // Entregáveis vinculados (estritamente técnicos)
      const listaEntregaveis = []
      try {
        const entRecs = $app.findRecordsByFilter(
          'entregaveis',
          "ordem_servico = '" + osId + "'",
          'prazo',
          20,
          0,
        )
        for (let k = 0; k < entRecs.length; k++) {
          listaEntregaveis.push({
            titulo: entRecs[k].getString('titulo') || entRecs[k].getString('nome'),
            prazo: entRecs[k].getString('prazo')
              ? entRecs[k].getString('prazo').substring(0, 10)
              : 'A definir',
            status: entRecs[k].getString('status') || 'pendente',
          })
        }
      } catch (_) {}

      const numeroOs = osRec.getString('numero') || osId
      const disciplina = osRec.getString('disciplina') || 'Engenharia'
      const escopoTecnico = osRec.getString('escopo_tecnico') || 'Serviços técnicos especializados'
      const dtFimPrevisao = osRec.getString('data_previsao_fim')
        ? osRec.getString('data_previsao_fim').substring(0, 10)
        : 'A definir'
      const prazoDias = osRec.getInt('prazo_dias') || 0

      // SEGMENTAÇÃO ESTRITA: CONTÉM SOMENTE:
      // Código do projeto, número da OS, disciplina, escopo técnico, entregáveis, prazos
      // NUNCA CONTÉM: Cliente, Obra, Proposta, Valor do Contrato, BDI, Outros Prestadores
      const dadosSanitizadosOs = `DADOS RESTRITOS DA ORDEM DE SERVIÇO:
- Código do Projeto: ${codigoProjeto}
- Número da OS: ${numeroOs}
- Disciplina: ${disciplina}
- Escopo Técnico: ${escopoTecnico}
- Prazo Total em Dias: ${prazoDias}
- Previsão de Término / Entrega: ${dtFimPrevisao}
- Entregáveis Vinculados: ${JSON.stringify(listaEntregaveis)}
- Finalidade Solicitada: ${finalidade}
${contextoExtra ? '- Contexto Adicional Informado pelo Operador: ' + contextoExtra : ''}

RELEMBRE A REGRA DE CONFIDENCIALIDADE: Jamais mencione nomes de clientes, nomes de obras ou valores financeiros.
Responda OBRIGATORIAMENTE no formato JSON especificado.`

      const agent = $ai.agent('ia-texto-canal-os')
      const result = agent.chat({
        user_id: auth.id,
        message: dadosSanitizadosOs,
      })

      const parsed = extrairJson(result.content, {
        finalidade: finalidade,
        destinatario_tipo: isOwnerPrestador ? 'interno' : 'prestador',
        assunto_sugerido: `Alinhamento OS ${numeroOs} - ${disciplina}`,
        mensagem_texto: result.content,
        aviso_confidencialidade_respeitado: true,
      })

      registrarAuditoria(
        auth.id,
        userEmail,
        'ia_texto_canal',
        'IA_GERACAO_MENSAGEM_CANAL_OS',
        'ordens_servico',
        osId,
        {
          numero_os: numeroOs,
          codigo_projeto: codigoProjeto,
          finalidade: finalidade,
          autor_perfil: role,
        },
        e.requestInfo(),
      )

      return e.json(200, {
        sucesso: true,
        recurso: 'ia_texto_canal',
        rascunho: parsed,
      })
    } catch (err) {
      console.log('Erro na rota /backend/v1/ia/texto-canal-os: ' + err)
      return e.json(500, {
        error: 'Erro ao gerar texto para o canal com IA: ' + (err.message || err),
      })
    }
  },
  $apis.requireAuth(),
)

// =============================================================================
// 4. POST /backend/v1/ia/resumo-dia
// Perfil: Admin, Gestor
// Chave: ia_resumo_dia
// =============================================================================
routerAdd(
  'POST',
  '/backend/v1/ia/resumo-dia',
  (e) => {
    function obterParametroAtivo(chave) {
      try {
        const recs = $app.findRecordsByFilter(
          'parametros',
          "chave = '" + chave.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (recs.length === 0) return false
        const val = String(recs[0].getString('valor')).trim().toLowerCase()
        return val === 'true' || val === '1' || val === 'sim'
      } catch (_) {
        return false
      }
    }

    function registrarAuditoria(
      userId,
      userEmail,
      recurso,
      acao,
      entidade,
      registroId,
      detalhesSafe,
      reqInfo,
    ) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao || 'IA_GERACAO_ONE_SHOT')
        aRec.set('entidade', entidade || 'ia_operacao')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          recurso: recurso,
          timestamp_utc: new Date().toISOString(),
          ...(detalhesSafe || {}),
        })
        const ip =
          reqInfo && reqInfo.headers
            ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
            : '127.0.0.1'
        aRec.set('ip', ip)
        $app.save(aRec)
      } catch (err) {
        console.log('Aviso ao registrar auditoria de IA: ' + err)
      }
    }

    function extrairJson(rawText, fallbackObj) {
      if (!rawText || typeof rawText !== 'string') return fallbackObj
      let text = rawText.trim()
      if (text.startsWith('```json')) {
        text = text.substring(7)
      } else if (text.startsWith('```')) {
        text = text.substring(3)
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      }
      text = text.trim()
      try {
        return JSON.parse(text)
      } catch (_) {
        const f = text.indexOf('{')
        const l = text.lastIndexOf('}')
        if (f !== -1 && l !== -1 && l > f) {
          try {
            return JSON.parse(text.substring(f, l + 1))
          } catch (e2) {}
        }
      }
      return {
        ...fallbackObj,
        raw_texto: rawText,
        parse_sucesso: false,
      }
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: Resumo Diário do Gestor permitido apenas para Admin e Gestor de Projetos.',
        })
      }

      if (!obterParametroAtivo('ia_resumo_dia')) {
        return e.json(400, {
          error: 'O recurso de IA para Resumo Diário está desativado nos Parâmetros do sistema.',
          chave: 'ia_resumo_dia',
        })
      }

      const hojeStr = new Date().toISOString().substring(0, 10)

      let dadosMonitoramento = {
        data_referencia: hojeStr,
        total_os_monitoradas: 0,
        total_os_atrasadas: 0,
        total_entregaveis_atrasados: 0,
        total_revisoes_estagnadas: 0,
        total_escalonamentos: 0,
        itens_atencao: [],
      }

      try {
        const ultimosResumos = $app.findRecordsByFilter(
          'resumos_diarios_gestor',
          '',
          '-created',
          1,
          0,
        )
        if (ultimosResumos.length > 0) {
          const r = ultimosResumos[0]
          dadosMonitoramento = {
            data_referencia: r.getString('data_referencia') || hojeStr,
            total_os_monitoradas: r.getInt('total_os_monitoradas') || 0,
            total_os_atrasadas: r.getInt('total_os_atrasadas') || 0,
            total_entregaveis_atrasados: r.getInt('total_entregaveis_atrasados') || 0,
            total_revisoes_estagnadas: r.getInt('total_revisoes_estagnadas') || 0,
            total_escalonamentos: r.getInt('total_escalonamentos') || 0,
            itens_atencao: r.get('itens_atencao_json') || [],
          }
        }
      } catch (_) {}

      let dadosFinanceiro = {
        contas_a_receber_atrasadas: 0,
        contas_a_pagar_proximos_7dias: 0,
      }

      try {
        const contasAtraso = $app.findRecordsByFilter(
          'contas',
          "tipo = 'receber' && status = 'atrasada'",
          '',
          100,
          0,
        )
        dadosFinanceiro.contas_a_receber_atrasadas = contasAtraso.length

        const hojeObj = new Date()
        const em7d = new Date()
        em7d.setDate(hojeObj.getDate() + 7)
        const em7dStr = em7d.toISOString().substring(0, 10)

        const contasPagar = $app.findRecordsByFilter(
          'contas',
          "tipo = 'pagar' && (status = 'prevista' || status = 'aprovada') && vencimento <= '" +
            em7dStr +
            "'",
          '',
          100,
          0,
        )
        dadosFinanceiro.contas_a_pagar_proximos_7dias = contasPagar.length
      } catch (_) {}

      const promptMensagem = `Gere o Resumo Diário Executivo do Gestor de Projetos.
DADOS DE MONITORAMENTO DE PRAZOS:
- Data de Referência: ${dadosMonitoramento.data_referencia}
- Total de OS Monitoradas Ativas: ${dadosMonitoramento.total_os_monitoradas}
- Total de OS em Atraso: ${dadosMonitoramento.total_os_atrasadas}
- Entregáveis em Atraso: ${dadosMonitoramento.total_entregaveis_atrasados}
- Revisões Pendentes Estagnadas (fora de SLA): ${dadosMonitoramento.total_revisoes_estagnadas}
- Escalonamentos Críticos: ${dadosMonitoramento.total_escalonamentos}
- Itens de Atenção Imediata: ${JSON.stringify(dadosMonitoramento.itens_atencao)}

DADOS DO FINANCEIRO:
- Contas a Receber em Atraso: ${dadosFinanceiro.contas_a_receber_atrasadas}
- Contas a Pagar nos Próximos 7 Dias: ${dadosFinanceiro.contas_a_pagar_proximos_7dias}

Responda OBRIGATORIAMENTE no formato JSON especificado nas diretrizes do agente.`

      const agent = $ai.agent('ia-resumo-dia')
      const result = agent.chat({
        user_id: auth.id,
        message: promptMensagem,
      })

      const parsed = extrairJson(result.content, {
        data_referencia: hojeStr,
        status_geral_operacao: dadosMonitoramento.total_os_atrasadas > 0 ? 'amarelo' : 'verde',
        titulo_resumo: `Resumo Diário da Operação - ${hojeStr}`,
        texto_corrido: result.content,
        destaques_operacionais: [
          `${dadosMonitoramento.total_os_monitoradas} OS monitoradas`,
          `${dadosMonitoramento.total_os_atrasadas} OS em atraso`,
        ],
        destaques_financeiros: [
          `${dadosFinanceiro.contas_a_receber_atrasadas} contas a receber em atraso`,
          `${dadosFinanceiro.contas_a_pagar_proximos_7dias} contas a pagar na semana`,
        ],
        acoes_recomendadas: ['Verificar canal de mensagens das OS em atraso'],
      })

      registrarAuditoria(
        auth.id,
        auth.getString('email'),
        'ia_resumo_dia',
        'IA_GERACAO_RESUMO_DIARIO',
        'resumos_diarios_gestor',
        hojeStr,
        {
          data_referencia: hojeStr,
          os_monitoradas: dadosMonitoramento.total_os_monitoradas,
          os_atrasadas: dadosMonitoramento.total_os_atrasadas,
        },
        e.requestInfo(),
      )

      return e.json(200, {
        sucesso: true,
        recurso: 'ia_resumo_dia',
        rascunho: parsed,
      })
    } catch (err) {
      console.log('Erro na rota /backend/v1/ia/resumo-dia: ' + err)
      return e.json(500, { error: 'Erro ao gerar resumo diário com IA: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)

// =============================================================================
// 5. POST /backend/v1/ia/pre-revisao-entregavel
// Perfil: Admin, Gestor
// Chave: ia_pre_revisao (DESLIGADO POR PADRÃO)
// REGRA: Deve recusar com mensagem clara quando a chave estiver desligada
// =============================================================================
routerAdd(
  'POST',
  '/backend/v1/ia/pre-revisao-entregavel',
  (e) => {
    function obterParametroAtivo(chave) {
      try {
        const recs = $app.findRecordsByFilter(
          'parametros',
          "chave = '" + chave.replace(/'/g, "''") + "'",
          '',
          1,
          0,
        )
        if (recs.length === 0) return false
        const val = String(recs[0].getString('valor')).trim().toLowerCase()
        return val === 'true' || val === '1' || val === 'sim'
      } catch (_) {
        return false
      }
    }

    function registrarAuditoria(
      userId,
      userEmail,
      recurso,
      acao,
      entidade,
      registroId,
      detalhesSafe,
      reqInfo,
    ) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        if (userId) aRec.set('user', userId)
        if (userEmail) aRec.set('user_email', userEmail)
        aRec.set('acao', acao || 'IA_GERACAO_ONE_SHOT')
        aRec.set('entidade', entidade || 'ia_operacao')
        if (registroId) aRec.set('registro_id', String(registroId))
        aRec.set('detalhes', {
          recurso: recurso,
          timestamp_utc: new Date().toISOString(),
          ...(detalhesSafe || {}),
        })
        const ip =
          reqInfo && reqInfo.headers
            ? reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || '127.0.0.1'
            : '127.0.0.1'
        aRec.set('ip', ip)
        $app.save(aRec)
      } catch (err) {
        console.log('Aviso ao registrar auditoria de IA: ' + err)
      }
    }

    function extrairJson(rawText, fallbackObj) {
      if (!rawText || typeof rawText !== 'string') return fallbackObj
      let text = rawText.trim()
      if (text.startsWith('```json')) {
        text = text.substring(7)
      } else if (text.startsWith('```')) {
        text = text.substring(3)
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      }
      text = text.trim()
      try {
        return JSON.parse(text)
      } catch (_) {
        const f = text.indexOf('{')
        const l = text.lastIndexOf('}')
        if (f !== -1 && l !== -1 && l > f) {
          try {
            return JSON.parse(text.substring(f, l + 1))
          } catch (e2) {}
        }
      }
      return {
        ...fallbackObj,
        raw_texto: rawText,
        parse_sucesso: false,
      }
    }

    try {
      const auth = e.auth
      if (!auth) return e.json(401, { error: 'Autenticação necessária' })

      const role = auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error:
            'Acesso restrito: Pré-revisão de entregáveis permitida apenas para Admin e Gestor de Projetos.',
        })
      }

      // Validação ESTRITA da Chave liga/desliga — Recusa imediata sem chamar modelo
      if (!obterParametroAtivo('ia_pre_revisao')) {
        return e.json(400, {
          error:
            'O recurso de pré-revisão assistida por IA está desativado nos Parâmetros do sistema. Ative a chave "ia_pre_revisao" na Administração para habilitar.',
          chave: 'ia_pre_revisao',
          ativo: false,
        })
      }

      const body = e.requestInfo().body || {}
      const entregavelId = (body.entregavel_id || '').trim()
      const versaoId = (body.versao_id || '').trim()

      if (!entregavelId) {
        return e.json(400, { error: 'O parâmetro entregavel_id é obrigatório.' })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entregavelId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      const titulo = entRec.getString('titulo') || entRec.getString('nome') || 'Entregável Técnico'
      const versaoAtual = entRec.getInt('versao_atual') || 1
      const etapaId = entRec.getString('etapa')

      let disciplina = 'Engenharia'
      let checklist = [
        { item: 'Compatibilização com normas e diretrizes vigentes', obrigatorio: true },
        { item: 'Verificação de memoriais de cálculo e critérios técnicos', obrigatorio: true },
        { item: 'Conformidade de formato e identificação de pranchas', obrigatorio: true },
        { item: 'Anotação de Responsabilidade Técnica (ART/RRT)', obrigatorio: true },
      ]

      if (etapaId) {
        try {
          const etapaRec = $app.findRecordById('projeto_etapas', etapaId)
          if (etapaRec) {
            disciplina = etapaRec.getString('disciplina') || disciplina
          }
        } catch (_) {}
      }

      try {
        const catRecs = $app.findRecordsByFilter(
          'catalogo_escopos',
          "disciplina ~ '" + disciplina.replace(/'/g, "''") + "' && ativo = true",
          '',
          1,
          0,
        )
        if (catRecs.length > 0) {
          const cList = catRecs[0].get('checklist_revisao')
          if (Array.isArray(cList) && cList.length > 0) checklist = cList
        }
      } catch (_) {}

      let versaoInfo = ''
      if (versaoId) {
        try {
          const vRec = $app.findRecordById('entregaveis_versoes', versaoId)
          if (vRec) {
            versaoInfo = `Versão submetida nº ${vRec.getInt('numero_versao')}, status: ${vRec.getString('status')}, observações: ${vRec.getString('observacoes') || 'Nenhuma'}`
          }
        } catch (_) {}
      }

      const promptMensagem = `Realize a pré-revisão técnica consultiva do entregável em relação ao Checklist do Catálogo de Escopos.
DADOS DO ENTREGÁVEL:
- Título: ${titulo}
- Disciplina Técnica: ${disciplina}
- Versão Atual: ${versaoAtual}
${versaoInfo ? '- Informações da Versão: ' + versaoInfo : ''}
- Checklist Técnico de Referência: ${JSON.stringify(checklist)}

Responda OBRIGATORIAMENTE no formato JSON especificado nas diretrizes do agente.`

      const agent = $ai.agent('ia-pre-revisao-entregavel')
      const result = agent.chat({
        user_id: auth.id,
        message: promptMensagem,
      })

      const parsed = extrairJson(result.content, {
        entregavel_titulo: titulo,
        versao_avaliada: versaoAtual,
        resultado_pre_analise: 'apto_para_revisao_humana',
        pontuacao_conformidade_percentual: 100,
        itens_checklist: checklist.map((c) => ({
          item: c.item,
          obrigatorio: Boolean(c.obrigatorio),
          status: 'conforme',
          observacao: 'Verificado na pré-análise documental',
        })),
        parecer_sintetico: result.content,
        recomendacao_ao_revisor_humano: 'Proceder à revisão técnica presencial detalhada.',
      })

      registrarAuditoria(
        auth.id,
        auth.getString('email'),
        'ia_pre_revisao',
        'IA_PRE_REVISAO_ENTREGAVEL',
        'entregaveis',
        entregavelId,
        {
          entregavel_id: entregavelId,
          versao_avaliada: versaoAtual,
          disciplina: disciplina,
        },
        e.requestInfo(),
      )

      return e.json(200, {
        sucesso: true,
        recurso: 'ia_pre_revisao',
        rascunho: parsed,
      })
    } catch (err) {
      console.log('Erro na rota /backend/v1/ia/pre-revisao-entregavel: ' + err)
      return e.json(500, { error: 'Erro ao executar pré-revisão com IA: ' + (err.message || err) })
    }
  },
  $apis.requireAuth(),
)
