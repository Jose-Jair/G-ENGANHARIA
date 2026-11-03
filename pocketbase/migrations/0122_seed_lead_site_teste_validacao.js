migrate(
  (app) => {
    // Dispara o lead de validação e testes dos cenários de aceitação
    // 1) Teste de validação: nome, descrição, etc.
    // 2) Criação do lead 'TESTE SITE — apagar' no funil
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const toquesCol = app.findCollectionByNameOrId('toques')
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    const notifCol = app.findCollectionByNameOrId('notificacoes')

    // Checar se já existe para garantir idempotência
    const existentes = app.findRecordsByFilter(
      'empresas',
      "razao_social = 'TESTE SITE — apagar'",
      '',
      1,
      0,
    )
    if (existentes.length > 0) {
      return
    }

    const agoraIso = new Date().toISOString()
    const dataHoje = agoraIso.substring(0, 10)
    const clientIp = '187.62.100.22'

    const textoDemanda =
      '[Lead Site G+ ' +
      dataHoje +
      ']\n' +
      'Nome solicitante: TESTE SITE — apagar\n' +
      'Empresa informada: G+ Engenharia Teste Lead\n' +
      'Documento informado: 12345678000199\n' +
      'E-mail: lead.site.teste@goskip.app\n' +
      'WhatsApp: (85) 99999-8888\n' +
      'Localidade: Fortaleza/CE\n' +
      'Serviços de interesse: Projetos Estruturais, Instalações Elétricas\n' +
      'Prazo desejado: 30 dias\n' +
      'Como conheceu: Google\n' +
      'Consentimento LGPD: Confirmado em ' +
      agoraIso +
      ' (IP: ' +
      clientIp +
      ')\n' +
      '---\n' +
      'Descrição detalhada:\n' +
      'Demanda de teste para validação do endpoint público lead-site.'

    // Criar empresa na primeira etapa ('identificada')
    const emp = new Record(empresasCol)
    emp.set('razao_social', 'TESTE SITE — apagar')
    emp.set('nome_fantasia', 'G+ Engenharia Teste Lead')
    emp.set('cnpj', '12345678000199')
    emp.set('email', 'lead.site.teste@goskip.app')
    emp.set('telefone', '(85) 99999-8888')
    emp.set('municipio', 'Fortaleza')
    emp.set('uf', 'CE')
    emp.set('etapa_funil', 'identificada')
    emp.set('curva', 'C')
    emp.set('score', 40)
    emp.set('status', 'ativa')
    emp.set('tipo_cliente', 'pj')
    emp.set('pre_cadastro', true)
    emp.set('origem', 'site')
    emp.set('fonte_prospeccao_origem', 'site')
    emp.set('observacoes', textoDemanda)
    emp.set(
      'proxima_acao_desc',
      'Retornar lead do site: TESTE SITE — apagar (Projetos Estruturais, Instalações Elétricas)',
    )
    emp.set('proxima_acao_data', agoraIso)
    app.save(emp)

    // Criar toque / interação
    const toque = new Record(toquesCol)
    toque.set('empresa', emp.id)
    toque.set('numero_toque', 1)
    toque.set('data_prevista', agoraIso)
    toque.set('data_realizada', agoraIso)
    toque.set('canal', 'site')
    toque.set('status', 'respondido')
    toque.set(
      'resultado',
      'Lead recebido via formulário de orçamento do site institucional G+ Engenharia.',
    )
    toque.set(
      'observacao',
      'Serviços: Projetos Estruturais, Instalações Elétricas\n' +
        'Prazo desejado: 30 dias\n' +
        'Local: Fortaleza/CE\n' +
        'Consentimento LGPD: ' +
        agoraIso +
        ' (IP ' +
        clientIp +
        ')\n' +
        'Descrição: Demanda de teste para validação do endpoint público lead-site.',
    )
    app.save(toque)

    // Protocolo e auditoria LEAD_SITE
    const protocolo = 'LEAD-2026-TESTE01'
    const audit = new Record(auditCol)
    audit.set('user', null)
    audit.set('user_email', 'lead.site.teste@goskip.app')
    audit.set('acao', 'LEAD_SITE')
    audit.set('entidade', 'empresas')
    audit.set('registro_id', emp.id)
    audit.set('ip', clientIp)
    audit.set('detalhes', {
      protocolo: protocolo,
      nome: 'TESTE SITE — apagar',
      tipo_cliente: 'escritorio',
      empresa: 'G+ Engenharia Teste Lead',
      email: 'lead.site.teste@goskip.app',
      whatsapp: '(85) 99999-8888',
      cidade: 'Fortaleza',
      uf: 'CE',
      servicos: ['Projetos Estruturais', 'Instalações Elétricas'],
      prazo_desejado: '30 dias',
      como_conheceu: 'Google',
      empresa_id: emp.id,
      consta_nao_contatar: false,
      consentimento_lgpd_ip: clientIp,
      consentimento_lgpd_data: agoraIso,
    })
    app.save(audit)

    // Notificação para admins
    const admins = app.findRecordsByFilter('users', "role = 'admin'", '', 20, 0)
    for (let a = 0; a < admins.length; a++) {
      const uAdmin = admins[a]
      const n = new Record(notifCol)
      n.set('destinatario_tipo', 'interno')
      n.set('destinatario_usuario', uAdmin.id)
      n.set('destinatario_email', uAdmin.getString('email'))
      n.set('tipo', 'sistema')
      n.set('titulo', 'Novo Pedido de Orçamento pelo Site G+')
      n.set(
        'mensagem',
        'Novo pedido pelo site: TESTE SITE — apagar — Projetos Estruturais, Instalações Elétricas',
      )
      n.set('referencia_tipo', 'empresas')
      n.set('referencia_id', emp.id)
      n.set('lida', false)
      n.set('email_enviado', false)
      app.save(n)
    }
  },
  (app) => {
    try {
      const existentes = app.findRecordsByFilter(
        'empresas',
        "razao_social = 'TESTE SITE — apagar'",
        '',
        10,
        0,
      )
      for (let i = 0; i < existentes.length; i++) {
        app.delete(existentes[i])
      }
    } catch (_) {}
  },
)
