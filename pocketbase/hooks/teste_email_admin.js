// -----------------------------------------------------------------------------
// Endpoint para Teste de Envio de E-mail pelo Admin
// Rota: POST /backend/v1/administracao/testar-email
// Restrito ao perfil admin
// -----------------------------------------------------------------------------

routerAdd(
  'POST',
  '/backend/v1/administracao/testar-email',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { success: false, message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          success: false,
          message: 'Apenas Administradores podem disparar o teste de e-mail.',
        })
      }

      const adminEmail = reqInfo.auth.getString('email')
      const adminName = reqInfo.auth.getString('name') || 'Administrador'
      const adminId = reqInfo.auth.id

      const settings = $app.settings()
      const meta = settings.meta || {}
      const smtp = settings.smtp || {}

      const senderAddress = meta.senderAddress || ''
      const senderName = meta.senderName || 'G+ Engenharia'

      const isSmtpConfigured = Boolean(smtp.enabled && smtp.host && senderAddress)

      let envioSucesso = false
      let erroEnvio = ''

      if (!isSmtpConfigured) {
        erroEnvio =
          'Serviço SMTP não está habilitado ou remetente não está configurado nas configurações do servidor.'
      } else {
        try {
          const agoraFormatada = new Date().toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          })
          const mailClient = $app.newMailClient()
          const message = new MailerMessage({
            from: {
              address: senderAddress,
              name: senderName,
            },
            to: [{ address: adminEmail, name: adminName }],
            subject: 'Teste de Conectividade SMTP - GESTÃO G+',
            html:
              '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
              '<h2 style="color: #D95A2B; margin-top: 0;">GESTÃO G+ — Teste de Envio de E-mail</h2>' +
              '<p>Olá, <strong>' +
              adminName +
              '</strong>,</p>' +
              '<p>Este é um e-mail de prova enviado a partir do painel de <strong>Administração</strong> do sistema GESTÃO G+.</p>' +
              '<div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px; margin: 16px 0;">' +
              '<p style="margin: 0; font-size: 14px; color: #334155;"><strong>Status do SMTP:</strong> Operante e conectado</p>' +
              '<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;"><strong>Remetente configurado:</strong> ' +
              senderAddress +
              '</p>' +
              '<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;"><strong>Host SMTP:</strong> ' +
              (smtp.host || 'Padrão Skip Cloud') +
              ':' +
              (smtp.port || '587') +
              '</p>' +
              '<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;"><strong>Data/Hora do envio:</strong> ' +
              agoraFormatada +
              '</p>' +
              '</div>' +
              '<p style="font-size: 13px; color: #64748b;">Se você recebeu esta mensagem, a infraestrutura de correio eletrônico está apta para disparos de propostas, contratos, cotações e notificações da operação.</p>' +
              '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />' +
              '<p style="font-size: 11px; color: #94a3b8; margin: 0;">G+ Engenharia Consultiva — Sistema de Gestão Integrada</p>' +
              '</div>',
          })

          mailClient.send(message)
          envioSucesso = true
        } catch (errSend) {
          envioSucesso = false
          erroEnvio = String(errSend)
          console.log('Falha no envio do teste de e-mail SMTP: ' + errSend)
        }
      }

      // Registro obrigatório de auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'TESTE_EMAIL_SMTP')
        aRec.set('entidade', 'configuracoes_smtp')
        aRec.set('registro_id', adminId)
        aRec.set('user', adminId)
        aRec.set('user_email', adminEmail)
        aRec.set('detalhes', {
          sucesso: envioSucesso,
          destinatario: adminEmail,
          remetente_configurado: senderAddress,
          smtp_host: smtp.host || '',
          smtp_habilitado: Boolean(smtp.enabled),
          erro: erroEnvio || null,
          data: new Date().toISOString(),
        })
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Falha ao gravar auditoria do teste de e-mail: ' + errAudit)
      }

      if (envioSucesso) {
        return e.json(200, {
          success: true,
          message: 'Mensagem de teste enviada com sucesso para ' + adminEmail,
          detalhes: {
            destinatario: adminEmail,
            remetente: senderAddress,
            smtp_host: smtp.host,
          },
        })
      } else {
        return e.json(400, {
          success: false,
          message: 'Não foi possível disparar o e-mail de teste: ' + erroEnvio,
          detalhes: {
            destinatario: adminEmail,
            remetente: senderAddress,
            smtp_habilitado: Boolean(smtp.enabled),
            erro: erroEnvio,
          },
        })
      }
    } catch (errGlobal) {
      console.log('Erro geral no endpoint testar-email: ' + errGlobal)
      return e.json(500, { success: false, message: 'Erro interno no servidor: ' + errGlobal })
    }
  },
  $apis.requireAuth(),
)
