// Hook for auditing record creation, update and deletion across all collections
// Except audit_logs itself to prevent recursion

const businessCollections = [
  'users',
  'empresas',
  'contatos',
  'contratos',
  'toques',
  'campanhas',
  'campanha_envios',
  'nao_contatar',
  'clientes_pf',
  'propostas',
  'projetos',
  'projeto_etapas',
  'entregaveis',
  'documentos',
  'riscos',
  'executores',
  'cotacoes',
  'avaliacoes',
  'contas',
  'parametros',
  'modelos',
  'motivos',
  'sugestoes_funil',
  'reativacoes_sugeridas',
  'catalogo_servicos',
  'proposta_itens',
  'areas_atuacao',
  'subservicos',
  'entregaveis_padrao',
  'proposta_parcelas',
  'contratos_servico',
]
for (let i = 0; i < businessCollections.length; i++) {
  const targetCol = businessCollections[i]

  onRecordCreate((e) => {
    try {
      const collectionName = e.record.collection().name
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)

      let userId = null
      let userEmail = ''
      let ip = ''

      try {
        const reqInfo = e.requestInfo()
        if (reqInfo) {
          ip = reqInfo.remoteIP || ''
          if (reqInfo.auth) {
            userId = reqInfo.auth.id
            userEmail = reqInfo.auth.getString('email') || ''
          }
        }
      } catch (_) {}

      // If user was creating users collection or auth was not in reqInfo
      if (!userId && collectionName === 'users') {
        userId = e.record.id
        userEmail = e.record.getString('email')
      }

      const recData = {}
      const colFields = e.record.collection().fields
      for (let f = 0; f < colFields.length; f++) {
        const fieldName = colFields[f].name
        if (fieldName !== 'password' && fieldName !== 'tokenKey' && fieldName !== 'mfa_secret') {
          recData[fieldName] = e.record.get(fieldName)
        }
      }

      record.set('user', userId)
      record.set('user_email', userEmail)
      record.set('acao', 'CRIACAO')
      record.set('entidade', collectionName)
      record.set('registro_id', e.record.id)
      record.set('detalhes', { depois: recData })
      record.set('ip', ip)

      $app.save(record)
    } catch (err) {
      console.log('Erro ao registrar auditoria de criacao: ' + err)
    }

    e.next()
  }, targetCol)

  onRecordUpdate((e) => {
    try {
      const collectionName = e.record.collection().name
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)

      let userId = null
      let userEmail = ''
      let ip = ''

      try {
        const reqInfo = e.requestInfo()
        if (reqInfo) {
          ip = reqInfo.remoteIP || ''
          if (reqInfo.auth) {
            userId = reqInfo.auth.id
            userEmail = reqInfo.auth.getString('email') || ''
          }
        }
      } catch (_) {}

      const original = e.record.original()
      const antes = {}
      const depois = {}
      const colFields = e.record.collection().fields

      for (let f = 0; f < colFields.length; f++) {
        const fieldName = colFields[f].name
        if (
          fieldName !== 'password' &&
          fieldName !== 'tokenKey' &&
          fieldName !== 'mfa_secret' &&
          fieldName !== 'updated'
        ) {
          const oldVal = original ? original.get(fieldName) : null
          const newVal = e.record.get(fieldName)
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            antes[fieldName] = oldVal
            depois[fieldName] = newVal
          }
        }
      }

      record.set('user', userId)
      record.set('user_email', userEmail)
      record.set('acao', 'EDICAO')
      record.set('entidade', collectionName)
      record.set('registro_id', e.record.id)
      record.set('detalhes', { antes: antes, depois: depois })
      record.set('ip', ip)

      $app.save(record)
    } catch (err) {
      console.log('Erro ao registrar auditoria de atualizacao: ' + err)
    }

    e.next()
  }, targetCol)

  onRecordDelete((e) => {
    try {
      const collectionName = e.record.collection().name
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)

      let userId = null
      let userEmail = ''
      let ip = ''

      try {
        const reqInfo = e.requestInfo()
        if (reqInfo) {
          ip = reqInfo.remoteIP || ''
          if (reqInfo.auth) {
            userId = reqInfo.auth.id
            userEmail = reqInfo.auth.getString('email') || ''
          }
        }
      } catch (_) {}

      const antes = {}
      const colFields = e.record.collection().fields
      for (let f = 0; f < colFields.length; f++) {
        const fieldName = colFields[f].name
        if (fieldName !== 'password' && fieldName !== 'tokenKey' && fieldName !== 'mfa_secret') {
          antes[fieldName] = e.record.get(fieldName)
        }
      }

      record.set('user', userId)
      record.set('user_email', userEmail)
      record.set('acao', 'EXCLUSAO')
      record.set('entidade', collectionName)
      record.set('registro_id', e.record.id)
      record.set('detalhes', { antes: antes })
      record.set('ip', ip)

      $app.save(record)
    } catch (err) {
      console.log('Erro ao registrar auditoria de exclusao: ' + err)
    }

    e.next()
  }, targetCol)
}
