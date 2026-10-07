// Hook para expor o Assistente IA Nativo de Proposta GMAIS
// Permissões: APENAS perfis 'admin' e 'comercial' podem acessar.
// 'gestor', 'financeiro' ou usuários anônimos recebem 403 Forbidden.

routerAdd(
  'POST',
  '/backend/v1/propostas/assistente-ia',
  (e) => {
    try {
      const authRecord = e.auth
      if (!authRecord || !authRecord.id) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const role = authRecord.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          error:
            'Acesso restrito: O Assistente de IA para elaboração de propostas é exclusivo para os perfis Comercial e Admin.',
        })
      }

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.json(400, { error: 'A mensagem do pedido é obrigatória.' })
      }

      const userId = authRecord.id
      const conversationId = body.conversation_id || null

      const agent = $ai.agent('assistente-proposta-gmais')

      const result = agent.chat({
        user_id: userId,
        conversation_id: conversationId,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations || [],
        message_id: result.message_id,
      })
    } catch (err) {
      console.log('Erro no Assistente IA de Proposta GMAIS: ' + err)
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na execução do agente IA' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'Serviço de IA indisponível' : err.message,
        })
      }
      return e.json(500, { error: 'Erro interno ao processar sugestão do assistente IA' })
    }
  },
  $apis.requireAuth(),
)
