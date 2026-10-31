/**
 * pocketbase/hooks/sigilo_detalhes_audit.js
 * RODADA 18:
 * - Endpoints detalhados com auditoria de leitura (quem leu, quando, qual campo)
 * - Matriz de necessidade de acesso por perfil (servidor/projeções):
 *   - Comercial: sem preço de prestadores, sem custo-hora interno e sem salários
 *   - Gestor: sem dados bancários de prestadores
 *   - Financeiro: sem escopo técnico, arquivos de projeto e canal da OS
 *   - Executor: só a própria OS, as próprias horas e o próprio scorecard
 * - Nota PocketBase JSVM: todas as funções utilitárias ficam inline dentro de cada callback.
 */

routerAdd('GET', '/backend/v1/sigilo/prestador-sensivel/{id}', (e) => {
  const reqInfo = e.requestInfo()
  const auth = reqInfo.auth || e.auth
  if (!auth) {
    return e.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  const id = e.request.pathValue('id')
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (role === 'comercial') {
    return e.json(403, {
      erro: 'Perfil Comercial não tem acesso a dados financeiros/bancários e custo-hora de prestadores',
    })
  }
  if (role === 'executor') {
    return e.json(403, { erro: 'Prestadores não têm acesso aos dados de outros prestadores' })
  }

  try {
    const rec = $app.findRecordById('prestadores', id)

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user', auth.id)
      audit.set('user_email', auth.getString('email'))
      audit.set('acao', 'LEITURA_SENSIVEL_PRESTADOR')
      audit.set('entidade', 'prestadores')
      audit.set('registro_id', id)
      audit.set('ip', clientIp)
      audit.set('detalhes', {
        motivo: 'Consulta de ficha detalhada com campos sensíveis',
        prestador_nome: rec.getString('nome') || rec.getString('razao_social'),
        campos_solicitados: role === 'gestor' ? ['custo_hora'] : ['dados_bancarios', 'custo_hora'],
        ip: clientIp,
      })
      $app.save(audit)
    } catch (eAudit) {
      console.log('Aviso audit leitura sensivel: ' + eAudit)
    }

    const resp = {
      id: rec.id,
      nome: rec.getString('nome') || rec.getString('razao_social'),
      tipo_vinculo: rec.getString('tipo_vinculo') || rec.getString('tipo'),
      dados_bancarios: role === 'gestor' ? null : rec.getString('dados_bancarios'),
      custo_hora: rec.getFloat('custo_hora'),
      custo_mensal: role === 'gestor' ? null : rec.getFloat('custo_mensal'),
      dados_bancarios_ocultados_motivo:
        role === 'gestor' ? 'Regra de Sigilo: Gestor não tem acesso a dados bancários' : null,
    }

    return e.json(200, { sucesso: true, dados: resp })
  } catch (_) {
    return e.json(404, { erro: 'Prestador não encontrado' })
  }
})

routerAdd('GET', '/backend/v1/sigilo/cotacao-preco/{id}', (e) => {
  const reqInfo = e.requestInfo()
  const auth = reqInfo.auth || e.auth
  if (!auth) {
    return e.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  const id = e.request.pathValue('id')
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (role === 'comercial') {
    return e.json(403, {
      erro: 'Comercial sem acesso ao preço individual de cada prestador em cotações',
    })
  }
  if (role !== 'admin' && role !== 'gestor' && role !== 'financeiro') {
    return e.json(403, { erro: 'Acesso restrito' })
  }

  try {
    const rec = $app.findRecordById('cotacoes', id)

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user', auth.id)
      audit.set('user_email', auth.getString('email'))
      audit.set('acao', 'LEITURA_PRECO_COTACAO')
      audit.set('entidade', 'cotacoes')
      audit.set('registro_id', id)
      audit.set('ip', clientIp)
      audit.set('detalhes', {
        codigo: rec.getString('codigo'),
        preco_consultado: true,
        ip: clientIp,
      })
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      dados: {
        id: rec.id,
        codigo: rec.getString('codigo'),
        preco_ofertado: rec.getFloat('preco_ofertado'),
        prazo_dias: rec.getInt('prazo_dias'),
        status: rec.getString('status'),
      },
    })
  } catch (_) {
    return e.json(404, { erro: 'Cotação não encontrada' })
  }
})

routerAdd('GET', '/backend/v1/sigilo/pre-cotacao-resposta-preco/{id}', (e) => {
  const reqInfo = e.requestInfo()
  const auth = reqInfo.auth || e.auth
  if (!auth) {
    return e.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  const id = e.request.pathValue('id')
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (role === 'comercial') {
    return e.json(403, { erro: 'Comercial sem acesso ao preço individual de cada prestador' })
  }
  if (role !== 'admin' && role !== 'gestor' && role !== 'financeiro') {
    return e.json(403, { erro: 'Acesso restrito' })
  }

  try {
    const rec = $app.findRecordById('pre_cotacao_respostas', id)

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user', auth.id)
      audit.set('user_email', auth.getString('email'))
      audit.set('acao', 'LEITURA_PRECO_PRE_COTACAO')
      audit.set('entidade', 'pre_cotacao_respostas')
      audit.set('registro_id', id)
      audit.set('ip', clientIp)
      audit.set('detalhes', {
        codigo_pre_cotacao: rec.getString('codigo_pre_cotacao'),
        disciplina: rec.getString('disciplina'),
        ip: clientIp,
      })
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      dados: {
        id: rec.id,
        codigo_pre_cotacao: rec.getString('codigo_pre_cotacao'),
        preco_ofertado: rec.getFloat('preco_ofertado'),
        prazo_ofertado_dias: rec.getInt('prazo_ofertado_dias'),
        status: rec.getString('status'),
      },
    })
  } catch (_) {
    return e.json(404, { erro: 'Resposta de pré-cotação não encontrada' })
  }
})

routerAdd('GET', '/backend/v1/sigilo/contrato-publico-valor/{id}', (e) => {
  const reqInfo = e.requestInfo()
  const auth = reqInfo.auth || e.auth
  if (!auth) {
    return e.json(401, { erro: 'Autenticação necessária' })
  }
  const role = (auth.getString('role') || '').toLowerCase()
  const id = e.request.pathValue('id')
  const clientIp =
    (e.request &&
      typeof e.request.getHeader === 'function' &&
      (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
    (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
    '127.0.0.1'

  if (role === 'executor') {
    return e.json(403, { erro: 'Executores não têm acesso a valores de contratos públicos' })
  }

  try {
    const rec = $app.findRecordById('contratos', id)

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user', auth.id)
      audit.set('user_email', auth.getString('email'))
      audit.set('acao', 'LEITURA_VALOR_CONTRATO_PUBLICO')
      audit.set('entidade', 'contratos')
      audit.set('registro_id', id)
      audit.set('ip', clientIp)
      audit.set('detalhes', {
        numero_edital: rec.getString('numero_edital'),
        orgao: rec.getString('orgao'),
        ip: clientIp,
      })
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      dados: {
        id: rec.id,
        numero_edital: rec.getString('numero_edital'),
        orgao: rec.getString('orgao'),
        valor: rec.getFloat('valor'),
      },
    })
  } catch (_) {
    return e.json(404, { erro: 'Contrato não encontrado' })
  }
})
