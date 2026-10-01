// Hook para registro de auditoria de exportações e segurança no backend (ETAPA 10)
// Permissões de exportação no servidor:
// - Executor externo: bloqueado totalmente (ForbiddenError)
// - Comercial: proibido de exportar dados financeiros (ForbiddenError)
// - Financeiro: permitido apenas dentro do seu escopo (financeiro, relatórios financeiros, propostas/projetos)
// - Gestor: permitido projetos, etapas, executores, empresas, etc. Proibido relatórios financeiros restritos se não aplicável
// - Admin: acesso total

routerAdd(
  'POST',
  '/backend/v1/export/audit',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) {
        throw new ForbiddenError('Acesso não autenticado.')
      }

      const role = auth.getString('role') || ''
      const reqInfo = e.requestInfo()
      const body = reqInfo.body || {}

      const tela = body.tela || 'geral'
      const formato = body.formato || 'csv'
      const totalLinhas = Number(body.total_linhas) || 0
      const filtros = body.filtros || {}
      const descricao = body.descricao || `Exportação de ${tela}`
      const isFinanceiroData =
        body.is_financeiro === true || tela.toLowerCase().includes('financeiro')

      // REGRA 5 DE SEGURANÇA NO SERVIDOR:
      // 1. Executor externo NÃO exporta nada
      if (role === 'executor') {
        throw new ForbiddenError(
          'Executores externos não possuem permissão para realizar exportações de dados do sistema.',
        )
      }

      // 2. Comercial NÃO exporta dados financeiros
      if (role === 'comercial' && isFinanceiroData) {
        throw new ForbiddenError(
          'Usuários com perfil Comercial não têm permissão para exportar dados ou relatórios financeiros.',
        )
      }

      // 3. Registrar auditoria na coleção audit_logs
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const auditRecord = new Record(auditCol)

      let ip = ''
      try {
        ip = reqInfo.remoteIP || ''
      } catch (_) {}

      auditRecord.set('user', auth.id)
      auditRecord.set('user_email', auth.getString('email') || '')
      auditRecord.set('acao', 'EXPORTACAO')
      auditRecord.set('entidade', tela)
      auditRecord.set('registro_id', tela)
      auditRecord.set('detalhes', {
        tela: tela,
        formato: formato,
        total_linhas: totalLinhas,
        filtros: filtros,
        descricao: descricao,
        perfil: role,
        data_hora: new Date().toISOString(),
        lgpd_atencao:
          tela === 'clientes_pf'
            ? 'Exportação de dados pessoais de Clientes PF sob conformidade LGPD'
            : undefined,
      })
      auditRecord.set('ip', ip)

      $app.save(auditRecord)

      return e.json(200, {
        success: true,
        message: 'Auditoria de exportação registrada com sucesso.',
        audit_id: auditRecord.id,
      })
    } catch (err) {
      if (err && err.status) {
        throw err
      }
      if (
        err &&
        err.message &&
        (err.message.includes('não têm permissão') || err.message.includes('não possuem permissão'))
      ) {
        throw new ForbiddenError(err.message)
      }
      return e.json(500, {
        success: false,
        message: 'Erro ao processar auditoria de exportação: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
