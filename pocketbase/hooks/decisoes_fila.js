/**
 * pocketbase/hooks/decisoes_fila.js
 * RODADA 18 — Painel "Decisões": fila única ordenada por impacto, agregando:
 *  - Vencedores de cotação/pré-cotação (concluir designação)
 *  - Revisões além do SLA (issues_revisao)
 *  - Issues sem atribuição
 *  - Apontamentos a aprovar
 *  - Triagens de prestador pendentes
 *  - Sugestões de suspensão de executor
 *  - Alertas de margem / inversão de fluxo
 *  - Cobranças escaladas
 * Cada item fecha com clique auditado (registro em decisoes_acoes).
 */

routerAdd('GET', '/backend/v1/decisoes/fila', (c) => {
  const auth = c.auth
  if (!auth) {
    return c.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  if (role !== 'admin' && role !== 'gestor') {
    return c.json(403, { erro: 'Fila de decisões restrita a Admin e Gestor' })
  }

  const agora = new Date()
  const itens = []

  // 1. Vencedores de cotação
  try {
    const vencedores = $app.findRecordsByFilter(
      'cotacoes',
      "escolhida = true && status != 'convertida_os'",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < vencedores.length; i++) {
      const rec = vencedores[i]
      itens.push({
        tipo_item: 'vencedor_cotacao',
        item_id: rec.id,
        impacto: 90,
        titulo: 'Vencedor de cotação aguardando designação de OS',
        contexto: {
          codigo: rec.getString('codigo'),
          prestador_id: rec.getString('prestador'),
          status: rec.getString('status'),
        },
      })
    }
  } catch (_) {}

  // 2. Vencedores de pré-cotação
  try {
    const vencedoresPc = $app.findRecordsByFilter(
      'pre_cotacao_respostas',
      "escolhida = true && status != 'convertida_os'",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < vencedoresPc.length; i++) {
      const rec = vencedoresPc[i]
      itens.push({
        tipo_item: 'vencedor_pre_cotacao',
        item_id: rec.id,
        impacto: 85,
        titulo: 'Vencedor de pré-cotação aguardando designação',
        contexto: {
          codigo_pre_cotacao: rec.getString('codigo_pre_cotacao'),
          disciplina: rec.getString('disciplina'),
        },
      })
    }
  } catch (_) {}

  // 3. Revisões além do SLA (issues_revisao)
  try {
    let slaHoras = 24
    try {
      const param = $app.findFirstRecordByFilter(
        'parametros',
        "chave = 'decisoes_limite_dias_revisao_sla'",
      )
      if (param) {
        slaHoras = parseInt(param.getString('valor') || '24', 10) || 24
      }
    } catch (_) {}
    const limite = new Date(agora.getTime() - slaHoras * 3600 * 1000)

    const revisoes = $app.findRecordsByFilter(
      'issues_revisao',
      "status != 'resolvida' && created < @now",
      '-created',
      100,
      0,
    )
    for (let i = 0; i < revisoes.length; i++) {
      const rec = revisoes[i]
      const criada = new Date(rec.getString('created'))
      const atrasoHoras = Math.floor((agora - criada) / (3600 * 1000))
      if (criada < limite) {
        itens.push({
          tipo_item: 'revisao_fora_sla',
          item_id: rec.id,
          impacto: Math.min(100, 70 + Math.floor(atrasoHoras / 24)),
          titulo: 'Revisão de entregável fora do SLA (' + atrasoHoras + 'h)',
          contexto: {
            entregavel_id: rec.getString('entregavel'),
            severidade: rec.getString('severidade'),
            atraso_horas: atrasoHoras,
          },
        })
      }
    }
  } catch (_) {}

  // 4. Issues sem atribuição
  try {
    const issues = $app.findRecordsByFilter(
      'issues_revisao',
      "atribuido_a = '' && status != 'resolvida'",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < issues.length; i++) {
      const rec = issues[i]
      itens.push({
        tipo_item: 'issue_sem_atribuicao',
        item_id: rec.id,
        impacto: 60,
        titulo: 'Issue de revisão sem responsável atribuído',
        contexto: {
          severidade: rec.getString('severidade'),
          descricao: rec.getString('descricao'),
        },
      })
    }
  } catch (_) {}

  // 5. Apontamentos a aprovar
  try {
    const apont = $app.findRecordsByFilter(
      'apontamentos',
      "status = 'pendente_aprovacao'",
      '-created',
      100,
      0,
    )
    for (let i = 0; i < apont.length; i++) {
      const rec = apont[i]
      itens.push({
        tipo_item: 'apontamento_a_aprovar',
        item_id: rec.id,
        impacto: 50,
        titulo: 'Apontamento de horas aguardando aprovação',
        contexto: {
          prestador: rec.getString('prestador'),
          horas: rec.getFloat('horas'),
          data: rec.getString('data'),
        },
      })
    }
  } catch (_) {}

  // 6. Triagens de prestador pendentes
  try {
    const triagens = $app.findRecordsByFilter('triagens', "status = 'pendente'", '-created', 50, 0)
    for (let i = 0; i < triagens.length; i++) {
      const rec = triagens[i]
      itens.push({
        tipo_item: 'triagem_prestador',
        item_id: rec.id,
        impacto: 45,
        titulo: 'Triagem de prestador pendente de avaliação',
        contexto: { prestador: rec.getString('prestador'), score: rec.getFloat('score') },
      })
    }
  } catch (_) {}

  // 7. Sugestões de suspensão de executor
  try {
    const sugestoes = $app.findRecordsByFilter(
      'sugestoes_suspensao',
      "status = 'pendente'",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < sugestoes.length; i++) {
      const rec = sugestoes[i]
      itens.push({
        tipo_item: 'sugestao_suspensao',
        item_id: rec.id,
        impacto: 95,
        titulo: 'Sugestão de suspensão de executor aguardando decisão',
        contexto: { prestador: rec.getString('prestador'), motivo: rec.getString('motivo') },
      })
    }
  } catch (_) {}

  // 8. Alertas de margem / inversão de fluxo
  try {
    const alertas = $app.findRecordsByFilter(
      'alertas_financeiros',
      "status = 'ativo' && (tipo = 'margem' || tipo = 'inversao_fluxo')",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < alertas.length; i++) {
      const rec = alertas[i]
      itens.push({
        tipo_item: 'alerta_financeiro',
        item_id: rec.id,
        impacto: 80,
        titulo:
          rec.getString('tipo') === 'margem'
            ? 'Alerta de margem do projeto'
            : 'Inversão de fluxo de caixa',
        contexto: { projeto: rec.getString('projeto'), detalhe: rec.getString('mensagem') },
      })
    }
  } catch (_) {}

  // 9. Cobranças escaladas
  try {
    const cobrancas = $app.findRecordsByFilter(
      'cobrancas',
      "status = 'escalada'",
      '-created',
      50,
      0,
    )
    for (let i = 0; i < cobrancas.length; i++) {
      const rec = cobrancas[i]
      itens.push({
        tipo_item: 'cobranca_escalada',
        item_id: rec.id,
        impacto: 75,
        titulo: 'Cobrança de prazo escalada',
        contexto: {
          projeto: rec.getString('projeto'),
          os: rec.getString('os'),
          dias_atraso: rec.getInt('dias_atraso'),
        },
      })
    }
  } catch (_) {}

  itens.sort((a, b) => (b.impacto || 0) - (a.impacto || 0))

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const audit = new Record(auditCol)
    audit.set('usuario', auth.id)
    audit.set('usuario_email', auth.getString('email'))
    audit.set('usuario_role', role)
    audit.set('acao', 'LEITURA_FILA_DECISOES')
    audit.set('entidade', 'decisoes_acoes')
    audit.set('detalhes', JSON.stringify({ itens_retornados: itens.length, ip: c.realIP() }))
    $app.save(audit)
  } catch (_) {}

  return c.json(200, { sucesso: true, itens })
})

routerAdd('POST', '/backend/v1/decisoes/fechar', (c) => {
  const auth = c.auth
  if (!auth) {
    return c.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  if (role !== 'admin' && role !== 'gestor') {
    return c.json(403, { erro: 'Fila de decisões restrita a Admin e Gestor' })
  }

  const info = c.requestInfo()
  const dados = info.body || {}
  const tipoItem = (dados.tipo_item || '').toString()
  const itemId = (dados.item_id || '').toString()
  const parecer = (dados.parecer_resolucao || '').toString()
  const acao = (dados.acao_tomada || '').toString()

  if (!tipoItem || !itemId) {
    return c.json(400, { erro: 'tipo_item e item_id são obrigatórios' })
  }

  try {
    const col = $app.findCollectionByNameOrId('decisoes_acoes')
    const rec = new Record(col)
    rec.set('tipo_item', tipoItem)
    rec.set('item_id', itemId)
    rec.set('impacto', String(dados.impacto || ''))
    rec.set('titulo', (dados.titulo || '').toString())
    rec.set('resolvido_por', auth.id)
    rec.set('resolvido_por_email', auth.getString('email'))
    rec.set('resolvido_por_nome', auth.getString('name') || auth.getString('email'))
    rec.set('parecer_resolucao', parecer)
    rec.set('acao_tomada', acao)
    $app.save(rec)
  } catch (e) {
    return c.json(500, { erro: 'Falha ao registrar decisão: ' + e })
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const audit = new Record(auditCol)
    audit.set('usuario', auth.id)
    audit.set('usuario_email', auth.getString('email'))
    audit.set('usuario_role', role)
    audit.set('acao', 'DECISAO_FECHADA')
    audit.set('entidade', tipoItem)
    audit.set('registro_id', itemId)
    audit.set('detalhes', JSON.stringify({ parecer: parecer, acao_tomada: acao, ip: c.realIP() }))
    $app.save(audit)
  } catch (_) {}

  return c.json(200, { sucesso: true, mensagem: 'Decisão registrada com auditoria' })
})
