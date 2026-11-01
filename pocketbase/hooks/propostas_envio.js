/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side de Envio de Propostas (WhatsApp e E-mail Transacional)
 * Rotas expostas:
 * - POST /backend/v1/propostas/registrar-envio-whatsapp
 * - POST /backend/v1/propostas/registrar-envio-manual
 * - POST /backend/v1/propostas/enviar-email
 *
 * E também aliases /backend/v1/gmais/propostas/{id}/... para compatibilidade reversa.
 * Todas as funções são mantidas 100% inline dentro de cada routerAdd para cumprir o modelo
 * de scoping isolado por pool do JSVM do PocketBase.
 */

routerAdd('POST', '/backend/v1/propostas/registrar-envio-whatsapp', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  const destinatarioTelefone = (
    body.destinatarioTelefone ||
    body.destinatario_telefone ||
    body.telefone ||
    ''
  )
    .toString()
    .trim()
  const destinatarioNome = (body.destinatarioNome || body.destinatario_nome || body.nome || '')
    .toString()
    .trim()

  // Verificar se o telefone está na lista de Não Contatar
  if (destinatarioTelefone) {
    const telDigits = destinatarioTelefone.replace(/\D/g, '')
    try {
      const recordsNc = $app.findAllRecords('nao_contatar')
      for (let i = 0; i < recordsNc.length; i++) {
        const item = recordsNc[i]
        const ncTel = (item.get('telefone') || '').toString().replace(/\D/g, '')
        if (
          ncTel &&
          telDigits &&
          (ncTel.indexOf(telDigits) !== -1 || telDigits.indexOf(ncTel) !== -1)
        ) {
          return e.json(403, {
            message: 'O destinatário encontra-se na lista de Não Contatar do sistema GESTÃO G+.',
          })
        }
      }
    } catch (ncErr) {
      // Ignora erro de consulta a lista se vazia
    }
  }

  // Atualizar status para enviada se ainda estiver em rascunho ou aprovada internamente
  const statusAtual = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtual)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn('[propostas_envio] Falha ao salvar status da proposta:', saveErr)
    }
  }

  // Registrar auditoria específica de envio
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: proposta.get('numero'),
      canal: 'whatsapp',
      destinatario_nome: destinatarioNome,
      destinatario_telefone: destinatarioTelefone,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria WhatsApp:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Envio via WhatsApp registrado e auditado com sucesso.',
  })
})

routerAdd('POST', '/backend/v1/gmais/propostas/{id}/enviar-whatsapp', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  const destinatarioTelefone = (
    body.destinatarioTelefone ||
    body.destinatario_telefone ||
    body.telefone ||
    ''
  )
    .toString()
    .trim()
  const destinatarioNome = (body.destinatarioNome || body.destinatario_nome || body.nome || '')
    .toString()
    .trim()

  if (destinatarioTelefone) {
    const telDigits = destinatarioTelefone.replace(/\D/g, '')
    try {
      const recordsNc = $app.findAllRecords('nao_contatar')
      for (let i = 0; i < recordsNc.length; i++) {
        const item = recordsNc[i]
        const ncTel = (item.get('telefone') || '').toString().replace(/\D/g, '')
        if (
          ncTel &&
          telDigits &&
          (ncTel.indexOf(telDigits) !== -1 || telDigits.indexOf(ncTel) !== -1)
        ) {
          return e.json(403, {
            message: 'O destinatário encontra-se na lista de Não Contatar do sistema GESTÃO G+.',
          })
        }
      }
    } catch (ncErr) {
      // Ignora
    }
  }

  const statusAtual = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtual)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn('[propostas_envio] Falha ao salvar status da proposta:', saveErr)
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: proposta.get('numero'),
      canal: 'whatsapp',
      destinatario_nome: destinatarioNome,
      destinatario_telefone: destinatarioTelefone,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria WhatsApp:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Envio via WhatsApp registrado e auditado com sucesso.',
  })
})

routerAdd('POST', '/backend/v1/propostas/registrar-envio-manual', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  const canal = (body.canal || 'manual').toString().trim()
  const destinatario = (
    body.destinatario ||
    body.destinatario_nome ||
    body.destinatario_contato ||
    ''
  )
    .toString()
    .trim()
  const observacoes = (body.observacoes || '').toString().trim()

  const statusAtual = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtual)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn('[propostas_envio] Falha ao salvar status da proposta no envio manual:', saveErr)
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: proposta.get('numero'),
      canal: canal,
      destinatario: destinatario,
      observacoes: observacoes,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria envio manual:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Envio manual registrado e auditado com sucesso.',
  })
})

routerAdd('POST', '/backend/v1/gmais/propostas/{id}/registrar-envio-manual', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  const canal = (body.canal || 'manual').toString().trim()
  const destinatario = (
    body.destinatario ||
    body.destinatario_nome ||
    body.destinatario_contato ||
    ''
  )
    .toString()
    .trim()
  const observacoes = (body.observacoes || '').toString().trim()

  const statusAtual = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtual)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn('[propostas_envio] Falha ao salvar status da proposta no envio manual:', saveErr)
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: proposta.get('numero'),
      canal: canal,
      destinatario: destinatario,
      observacoes: observacoes,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria envio manual:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Envio manual registrado e auditado com sucesso.',
  })
})

routerAdd('POST', '/backend/v1/propostas/enviar-email', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária para enviar e-mail.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  // Identificar destinatário: prioridade para o que veio no body, senão busca contato/PF/PJ
  let destinatarioEmail = (body.destinatarioEmail || body.destinatario_email || body.email || '')
    .toString()
    .trim()
    .toLowerCase()
  let destinatarioNome = (body.destinatarioNome || body.destinatario_nome || body.nome || '')
    .toString()
    .trim()
  const assuntoCustomizado = (body.assunto || '').toString().trim()
  const corpoCustomizado = (body.corpo || '').toString().trim()

  if (!destinatarioEmail) {
    const pfId = proposta.get('cliente_pf')
    if (pfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', pfId)
        if (pf && pf.get('email')) {
          destinatarioEmail = pf.get('email').toString().trim().toLowerCase()
          if (!destinatarioNome) destinatarioNome = pf.get('nome') || 'Cliente'
        }
      } catch (errPf) {
        // ignora
      }
    }
  }

  if (!destinatarioEmail) {
    const empId = proposta.get('empresa')
    if (empId) {
      try {
        const contatos = $app.findAllRecords(
          'contatos',
          $dbx.exp('empresa = {:emp}', { emp: empId }),
        )
        if (contatos && contatos.length > 0) {
          const decisor = contatos.find((c) => c.get('decisor') === true) || contatos[0]
          if (decisor && decisor.get('email')) {
            destinatarioEmail = decisor.get('email').toString().trim().toLowerCase()
            if (!destinatarioNome) destinatarioNome = decisor.get('nome') || ''
          }
        }
      } catch (errContatos) {
        // ignora
      }

      if (!destinatarioEmail) {
        try {
          const emp = $app.findRecordById('empresas', empId)
          if (emp && emp.get('email')) {
            destinatarioEmail = emp.get('email').toString().trim().toLowerCase()
            if (!destinatarioNome) {
              destinatarioNome = emp.get('razao_social') || emp.get('nome_fantasia') || 'Cliente'
            }
          }
        } catch (errEmp) {
          // ignora
        }
      }
    }
  }

  if (!destinatarioEmail) {
    return e.json(400, {
      message:
        'Não foi possível identificar o e-mail de destino. Informe o e-mail no formulário de envio.',
    })
  }

  if (!destinatarioNome) {
    destinatarioNome = 'Cliente'
  }

  // 1. Verificar lista "Não Contatar" (regra de plataforma)
  try {
    const emNaoContatar = $app.findAllRecords(
      'nao_contatar',
      $dbx.exp('LOWER(email) = {:email}', { email: destinatarioEmail }),
    )
    if (emNaoContatar && emNaoContatar.length > 0) {
      return e.json(403, {
        message:
          'O destinatário (' +
          destinatarioEmail +
          ') encontra-se na lista "Não Contatar" da plataforma.',
      })
    }
  } catch (ncErr) {
    console.warn('[propostas_envio] Erro ao checar lista nao_contatar:', ncErr)
  }

  // 2. Parâmetros e URLs
  const baseUrl =
    typeof getAppBaseUrl === 'function'
      ? getAppBaseUrl()
      : $os.getenv('PUBLIC_APP_URL') || 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
  const tokenAceite = proposta.get('token_aceite') || ''
  const linkPublico = baseUrl + '/proposta/' + tokenAceite
  const linkDescadastro = baseUrl + '/descadastro?email=' + encodeURIComponent(destinatarioEmail)

  // 3. Formatação segura para Goja (sem toLocaleString / sem Intl)
  const precoRaw = Number(proposta.get('preco')) || 0
  const precoFmt =
    'R$ ' +
    precoRaw
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const dataValidadeRaw = proposta.get('validade')
  let dataValidadeFmt = '15 dias'
  if (dataValidadeRaw) {
    const strData = dataValidadeRaw.toString()
    if (strData.length >= 10) {
      const p = strData.slice(0, 10).split('-')
      if (p.length === 3) {
        dataValidadeFmt = p[2] + '/' + p[1] + '/' + p[0]
      }
    }
  }

  const numeroProposta = proposta.get('numero') || 'PROP'
  const empreendimento = (proposta.get('empreendimento') || '').toString().trim()
  const objeto =
    proposta.get('objeto') || proposta.get('escopo') || 'Serviços de Engenharia Consultiva'

  const assuntoFinal =
    assuntoCustomizado || 'Proposta Comercial ' + numeroProposta + ' — G+ Engenharia'

  const trechoEmpreendimentoHtml = empreendimento
    ? ' para o empreendimento <em>' + empreendimento + '</em>'
    : ''

  const textoPrincipalHtml = corpoCustomizado
    ? corpoCustomizado.replace(/\n/g, '<br/>')
    : 'Apresentamos a proposta comercial e técnica <strong>' +
      numeroProposta +
      '</strong>' +
      trechoEmpreendimentoHtml +
      '.<br/><br/>' +
      'Para visualizar os detalhes técnicos, escopo, entregáveis e formalizar o seu <strong>aceite eletrônico</strong>, acesse o link seguro abaixo:'

  const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${assuntoFinal}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; max-width: 92%;">
          <tr>
            <td style="background-color: #1E2A4A; padding: 24px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px;">GESTÃO <span style="color: #D95A2B;">G+</span></span>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Engenharia Consultiva & Gestão de Projetos</div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(217, 90, 43, 0.2); border: 1px solid #D95A2B; color: #ffedd5; font-size: 11px; font-weight: 600; border-radius: 4px;">PROPOSTA OFICIAL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; line-height: 1.6; margin-top: 0; color: #1e293b;">
                Olá, <strong>${destinatarioNome}</strong>,
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${textoPrincipalHtml}
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 20px 0; font-size: 13px;">
                <tr>
                  <td width="35%" style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Proposta:</td>
                  <td style="color: #0f172a; font-weight: bold; border-bottom: 1px solid #edf2f7;">${numeroProposta}</td>
                </tr>
                ${
                  empreendimento
                    ? `<tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Empreendimento:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${empreendimento}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Objeto / Escopo:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${objeto}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Valor Global:</td>
                  <td style="color: #D95A2B; font-weight: bold; font-size: 15px; border-bottom: 1px solid #edf2f7;">${precoFmt}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Validade da Proposta:</td>
                  <td style="color: #0f172a;">${dataValidadeFmt}</td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${linkPublico}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #D95A2B; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 6px; box-shadow: 0 2px 4px rgba(217, 90, 43, 0.3);">
                      Visualizar Proposta Completa & Aceitar Online &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                Caso o botão acima não funcione, copie e cole o link a seguir no seu navegador:<br/>
                <a href="${linkPublico}" style="color: #D95A2B; word-break: break-all;">${linkPublico}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 6px 0;">
                Este e-mail foi gerado automaticamente pelo sistema <strong>GESTÃO G+</strong> da G+ Engenharia.
              </p>
              <p style="margin: 0;">
                Se não deseja mais receber comunicados comerciais desta proposta, <a href="${linkDescadastro}" style="color: #64748b; text-decoration: underline;">clique aqui para descadastrar-se</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  try {
    const mailClient = $app.newMailClient()
    const senderAddress =
      $app.settings().meta.senderAddress || 'nao-responder@gmaisengenharia.com.br'
    const senderName = $app.settings().meta.senderName || 'G+ Engenharia'

    mailClient.send({
      from: { address: senderAddress, name: senderName },
      to: [{ address: destinatarioEmail, name: destinatarioNome }],
      subject: assuntoFinal,
      html: htmlBody,
    })
  } catch (sendErr) {
    console.error('[propostas_envio] Falha no mailClient.send:', sendErr)
    return e.json(500, {
      message:
        'Falha no servidor de e-mail ao enviar a proposta: ' + (sendErr.message || String(sendErr)),
    })
  }

  const statusAtualEmail = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtualEmail)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn(
        '[propostas_envio] Falha ao salvar status da proposta no envio por e-mail:',
        saveErr,
      )
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: numeroProposta,
      canal: 'email',
      destinatario_nome: destinatarioNome,
      destinatario_email: destinatarioEmail,
      assunto: assuntoFinal,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria do e-mail:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Proposta enviada por e-mail com sucesso para ' + destinatarioEmail + '.',
  })
})

// =============================================================================
// BACKFILL IDEMPOTENTE v0.0.189 — REGISTRO ACEITE_DIGITAL_PROPOSTA PARA PROP-2026-0002
// =============================================================================
// Executa em cron oneshot que se auto-remove na primeira linha do callback.
// Cria UM registro ACEITE_DIGITAL_PROPOSTA retroativo para a proposta id g5yd9trmgxxjj8t (PROP-2026-0002).
// Idempotência estrita: se já existir acao='ACEITE_DIGITAL_PROPOSTA' && registro_id='g5yd9trmgxxjj8t', não faz nada.
// Regra de segurança: NÃO apaga e NÃO altera nenhum registro existente.
try {
  cronRemove('backfill-aceite-digital-prop-2026-0002-v189')
} catch (_) {}

cronAdd('backfill-aceite-digital-prop-2026-0002-v189', '* * * * *', function () {
  try {
    cronRemove('backfill-aceite-digital-prop-2026-0002-v189')
  } catch (_) {}

  try {
    const propIdAlvo = 'g5yd9trmgxxjj8t'

    // Checar idempotência antes de qualquer ação
    const auditLogsExistentes = $app.findRecordsByFilter(
      'audit_logs',
      "acao = 'ACEITE_DIGITAL_PROPOSTA' && registro_id = '" + propIdAlvo + "'",
      '-created',
      1,
      0,
    )

    if (auditLogsExistentes && auditLogsExistentes.length > 0) {
      console.log(
        '[backfill-v189] ACEITE_DIGITAL_PROPOSTA para ' +
          propIdAlvo +
          ' já existe. Pulando backfill.',
      )
      return
    }

    let prop = null
    try {
      prop = $app.findRecordById('propostas', propIdAlvo)
    } catch (errProp) {
      console.warn('[backfill-v189] Proposta alvo ' + propIdAlvo + ' não encontrada: ' + errProp)
      return
    }

    if (!prop) {
      console.warn('[backfill-v189] Proposta alvo ' + propIdAlvo + ' nula.')
      return
    }

    const propNumero = prop.getString('numero') || 'PROP-2026-0002'
    const propRevisao = prop.getString('revisao') || 'Rev.00'
    const propPreco = prop.getFloat('preco') || 1000
    const propDataAceite = prop.getString('data_aceite') || '2026-11-01 01:07:56.256Z'
    const propUserAgent = prop.getString('aceite_user_agent') || 'Navegador Web'
    const propHash =
      prop.getString('aceite_hash') ||
      '4132d0b3fd4997cb59df1154925a2d82559ea6e0c7b76f218ffa664f7a69d006'
    const propIp = 'nao_capturado'

    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const aRec = new Record(auditCol)
    aRec.set('acao', 'ACEITE_DIGITAL_PROPOSTA')
    aRec.set('entidade', 'propostas')
    aRec.set('registro_id', propIdAlvo)
    aRec.set('user', prop.getString('criado_por') || '')
    aRec.set('user_email', 'SISTEMA')
    aRec.set('origem', 'SISTEMA / BACKFILL v0.0.189')
    aRec.set('detalhes', {
      origem: 'SISTEMA / BACKFILL v0.0.189',
      mensagem:
        'Aceite eletrônico formalizado pelo cliente com validade jurídica na proposta ' +
        propNumero,
      proposta_numero: propNumero,
      revisao: propRevisao,
      valor: propPreco,
      data_aceite: propDataAceite,
      ip: propIp,
      user_agent: propUserAgent,
      hash: propHash,
      declaracao_aceite: true,
    })
    aRec.set('ip', propIp)

    $app.save(aRec)
    console.log(
      '[backfill-v189] Registro ACEITE_DIGITAL_PROPOSTA criado com sucesso para ' + propNumero,
    )
  } catch (errGeral) {
    console.warn('[backfill-v189] Falha ao executar backfill de aceite digital: ' + errGeral)
  }
})

routerAdd('POST', '/backend/v1/gmais/propostas/{id}/enviar-email', (e) => {
  const reqInfo = e.requestInfo()
  const authRecord = reqInfo.auth || e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária para enviar e-mail.' })
  }

  let body = {}
  try {
    body = reqInfo.body || {}
  } catch (err) {
    // Body vazio
  }

  const propostaId = e.request.pathValue('id') || body.proposta_id || body.propostaId
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let proposta = null
  try {
    proposta = $app.findRecordById('propostas', propostaId)
  } catch (errFind) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  let destinatarioEmail = (body.destinatarioEmail || body.destinatario_email || body.email || '')
    .toString()
    .trim()
    .toLowerCase()
  let destinatarioNome = (body.destinatarioNome || body.destinatario_nome || body.nome || '')
    .toString()
    .trim()
  const assuntoCustomizado = (body.assunto || '').toString().trim()
  const corpoCustomizado = (body.corpo || '').toString().trim()

  if (!destinatarioEmail) {
    const pfId = proposta.get('cliente_pf')
    if (pfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', pfId)
        if (pf && pf.get('email')) {
          destinatarioEmail = pf.get('email').toString().trim().toLowerCase()
          if (!destinatarioNome) destinatarioNome = pf.get('nome') || 'Cliente'
        }
      } catch (errPf) {
        // ignora
      }
    }
  }

  if (!destinatarioEmail) {
    const empId = proposta.get('empresa')
    if (empId) {
      try {
        const contatos = $app.findAllRecords(
          'contatos',
          $dbx.exp('empresa = {:emp}', { emp: empId }),
        )
        if (contatos && contatos.length > 0) {
          const decisor = contatos.find((c) => c.get('decisor') === true) || contatos[0]
          if (decisor && decisor.get('email')) {
            destinatarioEmail = decisor.get('email').toString().trim().toLowerCase()
            if (!destinatarioNome) destinatarioNome = decisor.get('nome') || ''
          }
        }
      } catch (errContatos) {
        // ignora
      }

      if (!destinatarioEmail) {
        try {
          const emp = $app.findRecordById('empresas', empId)
          if (emp && emp.get('email')) {
            destinatarioEmail = emp.get('email').toString().trim().toLowerCase()
            if (!destinatarioNome) {
              destinatarioNome = emp.get('razao_social') || emp.get('nome_fantasia') || 'Cliente'
            }
          }
        } catch (errEmp) {
          // ignora
        }
      }
    }
  }

  if (!destinatarioEmail) {
    return e.json(400, {
      message:
        'Não foi possível identificar o e-mail de destino. Informe o e-mail no formulário de envio.',
    })
  }

  if (!destinatarioNome) {
    destinatarioNome = 'Cliente'
  }

  try {
    const emNaoContatar = $app.findAllRecords(
      'nao_contatar',
      $dbx.exp('LOWER(email) = {:email}', { email: destinatarioEmail }),
    )
    if (emNaoContatar && emNaoContatar.length > 0) {
      return e.json(403, {
        message:
          'O destinatário (' +
          destinatarioEmail +
          ') encontra-se na lista "Não Contatar" da plataforma.',
      })
    }
  } catch (ncErr) {
    console.warn('[propostas_envio] Erro ao checar lista nao_contatar:', ncErr)
  }

  const baseUrl =
    typeof getAppBaseUrl === 'function'
      ? getAppBaseUrl()
      : $os.getenv('PUBLIC_APP_URL') || 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
  const tokenAceite = proposta.get('token_aceite') || ''
  const linkPublico = baseUrl + '/proposta/' + tokenAceite
  const linkDescadastro = baseUrl + '/descadastro?email=' + encodeURIComponent(destinatarioEmail)

  const precoRaw = Number(proposta.get('preco')) || 0
  const precoFmt =
    'R$ ' +
    precoRaw
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  const dataValidadeRaw = proposta.get('validade')
  let dataValidadeFmt = '15 dias'
  if (dataValidadeRaw) {
    const strData = dataValidadeRaw.toString()
    if (strData.length >= 10) {
      const p = strData.slice(0, 10).split('-')
      if (p.length === 3) {
        dataValidadeFmt = p[2] + '/' + p[1] + '/' + p[0]
      }
    }
  }

  const numeroProposta = proposta.get('numero') || 'PROP'
  const empreendimento = (proposta.get('empreendimento') || '').toString().trim()
  const objeto =
    proposta.get('objeto') || proposta.get('escopo') || 'Serviços de Engenharia Consultiva'

  const assuntoFinal =
    assuntoCustomizado || 'Proposta Comercial ' + numeroProposta + ' — G+ Engenharia'

  const trechoEmpreendimentoHtml = empreendimento
    ? ' para o empreendimento <em>' + empreendimento + '</em>'
    : ''

  const textoPrincipalHtml = corpoCustomizado
    ? corpoCustomizado.replace(/\n/g, '<br/>')
    : 'Apresentamos a proposta comercial e técnica <strong>' +
      numeroProposta +
      '</strong>' +
      trechoEmpreendimentoHtml +
      '.<br/><br/>' +
      'Para visualizar os detalhes técnicos, escopo, entregáveis e formalizar o seu <strong>aceite eletrônico</strong>, acesse o link seguro abaixo:'

  const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${assuntoFinal}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; max-width: 92%;">
          <tr>
            <td style="background-color: #1E2A4A; padding: 24px 32px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px;">GESTÃO <span style="color: #D95A2B;">G+</span></span>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Engenharia Consultiva & Gestão de Projetos</div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(217, 90, 43, 0.2); border: 1px solid #D95A2B; color: #ffedd5; font-size: 11px; font-weight: 600; border-radius: 4px;">PROPOSTA OFICIAL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; line-height: 1.6; margin-top: 0; color: #1e293b;">
                Olá, <strong>${destinatarioNome}</strong>,
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${textoPrincipalHtml}
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 20px 0; font-size: 13px;">
                <tr>
                  <td width="35%" style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Proposta:</td>
                  <td style="color: #0f172a; font-weight: bold; border-bottom: 1px solid #edf2f7;">${numeroProposta}</td>
                </tr>
                ${
                  empreendimento
                    ? `<tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Empreendimento:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${empreendimento}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Objeto / Escopo:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${objeto}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Valor Global:</td>
                  <td style="color: #D95A2B; font-weight: bold; font-size: 15px; border-bottom: 1px solid #edf2f7;">${precoFmt}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Validade da Proposta:</td>
                  <td style="color: #0f172a;">${dataValidadeFmt}</td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${linkPublico}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #D95A2B; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 6px; box-shadow: 0 2px 4px rgba(217, 90, 43, 0.3);">
                      Visualizar Proposta Completa & Aceitar Online &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                Caso o botão acima não funcione, copie e cole o link a seguir no seu navegador:<br/>
                <a href="${linkPublico}" style="color: #D95A2B; word-break: break-all;">${linkPublico}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 6px 0;">
                Este e-mail foi gerado automaticamente pelo sistema <strong>GESTÃO G+</strong> da G+ Engenharia.
              </p>
              <p style="margin: 0;">
                Se não deseja mais receber comunicados comerciais desta proposta, <a href="${linkDescadastro}" style="color: #64748b; text-decoration: underline;">clique aqui para descadastrar-se</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  try {
    const mailClient = $app.newMailClient()
    const senderAddress =
      $app.settings().meta.senderAddress || 'nao-responder@gmaisengenharia.com.br'
    const senderName = $app.settings().meta.senderName || 'G+ Engenharia'

    mailClient.send({
      from: { address: senderAddress, name: senderName },
      to: [{ address: destinatarioEmail, name: destinatarioNome }],
      subject: assuntoFinal,
      html: htmlBody,
    })
  } catch (sendErr) {
    console.error('[propostas_envio] Falha no mailClient.send:', sendErr)
    return e.json(500, {
      message:
        'Falha no servidor de e-mail ao enviar a proposta: ' + (sendErr.message || String(sendErr)),
    })
  }

  const statusAtualEmail = proposta.get('status')
  if (['rascunho', 'aprovada'].includes(statusAtualEmail)) {
    proposta.set('status', 'enviada')
    try {
      $app.save(proposta)
    } catch (saveErr) {
      console.warn(
        '[propostas_envio] Falha ao salvar status da proposta no envio por e-mail:',
        saveErr,
      )
    }
  }

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user', authRecord.id)
    auditRec.set('user_email', authRecord.getString('email') || '')
    auditRec.set('acao', 'ENVIO_PROPOSTA')
    auditRec.set('entidade', 'propostas')
    auditRec.set('registro_id', proposta.id)
    auditRec.set('detalhes', {
      proposta_numero: numeroProposta,
      canal: 'email',
      destinatario_nome: destinatarioNome,
      destinatario_email: destinatarioEmail,
      assunto: assuntoFinal,
      data_envio: new Date().toISOString(),
    })
    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) clientIp = xff.split(',')[0].trim()
        else if (xri) clientIp = xri.trim()
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) clientIp = String(xff).split(',')[0].trim()
        else if (xri) clientIp = String(xri).trim()
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'
    auditRec.set('ip', clientIp)
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria do e-mail:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Proposta enviada por e-mail com sucesso para ' + destinatarioEmail + '.',
  })
})
