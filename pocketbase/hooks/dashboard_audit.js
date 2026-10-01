// Hook para registrar auditoria de acesso ao Dashboard da GESTÃO G+ (ETAPA 11)
// Regra de Permissão no Servidor: Dashboard exclusivo do Admin.
// Se outro perfil tentar acessar a rota do dashboard no backend, retorna 403 Forbidden.

routerAdd(
  'POST',
  '/backend/v1/dashboard/audit',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) {
        throw new ForbiddenError('Acesso não autenticado.')
      }

      const role = auth.getString('role') || ''
      if (role !== 'admin') {
        throw new ForbiddenError(
          'Acesso restrito ao Dashboard Executivo. Apenas administradores possuem permissão.',
        )
      }

      const reqInfo = e.requestInfo()
      let ip = ''
      try {
        ip = reqInfo.remoteIP || ''
      } catch (_) {}

      // Registrar auditoria na coleção audit_logs
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRecord = new Record(auditCol)

      auditRecord.set('user', auth.id)
      auditRecord.set('user_email', auth.getString('email') || '')
      auditRecord.set('acao', 'ACESSO_DASHBOARD')
      auditRecord.set('entidade', 'dashboard')
      auditRecord.set('registro_id', 'dashboard_gerencial')
      auditRecord.set('detalhes', {
        modulo: 'dashboard',
        descricao: 'Acesso do Administrador ao Dashboard Executivo',
        perfil: role,
        data_hora: new Date().toISOString(),
      })
      auditRecord.set('ip', ip)

      $app.save(auditRecord)

      return e.json(200, {
        success: true,
        message: 'Acesso ao dashboard auditado com sucesso.',
        audit_id: auditRecord.id,
      })
    } catch (err) {
      if (err && err.status) {
        throw err
      }
      if (err && err.message && err.message.includes('Acesso restrito')) {
        throw new ForbiddenError(err.message)
      }
      return e.json(500, {
        success: false,
        message: 'Erro ao processar auditoria do dashboard: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
