// Endpoint autenticado para registro de auditoria no servidor
// Chamado para eventos que não alteram registros diretamente ou ações de contexto especial
// Exemplos: visualização de link público, exclusões lógicas, acionamento de IA, etc.
// Mantém os campos canônicos: user, user_email, acao, entidade, registro_id, detalhes, ip

routerAdd(
  'POST',
  '/backend/v1/auditoria/registrar',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const body = reqInfo.body || {}

      const acao = (body.acao || body.action || '').trim()
      const entidade = (body.entidade || body.entity_type || 'sistema').trim()
      const registroId = (body.registro_id || body.entity_id || '').trim()
      const detalhes = body.detalhes || body.details || {}

      if (!acao) {
        return e.json(400, { message: 'Ação de auditoria é obrigatória' })
      }

      let userId = null
      let userEmail = ''

      if (reqInfo.auth) {
        userId = reqInfo.auth.id
        userEmail = reqInfo.auth.getString('email') || ''
      } else if (body.user_id) {
        userId = body.user_id
        userEmail = body.user_email || ''
      }

      const clientIp =
        reqInfo.remoteIP || (reqInfo.headers && reqInfo.headers['x-forwarded-for']) || '127.0.0.1'

      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)

      if (userId) {
        aRec.set('user', userId)
      }
      if (userEmail) {
        aRec.set('user_email', userEmail)
      }
      aRec.set('acao', acao)
      aRec.set('entidade', entidade)
      if (registroId) {
        aRec.set('registro_id', registroId)
      }
      aRec.set('detalhes', detalhes)
      aRec.set('ip', clientIp)

      $app.save(aRec)

      return e.json(200, {
        success: true,
        audit_id: aRec.id,
        acao: acao,
        entidade: entidade,
      })
    } catch (err) {
      console.log('Erro ao registrar log de auditoria no servidor: ' + err)
      return e.json(500, { message: 'Falha ao gravar auditoria: ' + err })
    }
  },
  // Permite chamada pública ou autenticada, mas captura auth se presente
)
