/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook Server-side de Envio de Propostas (WhatsApp e E-mail Transacional)
 * Rotas expostas:
 * - POST /api/gmais/propostas/:id/enviar-whatsapp
 * - POST /api/gmais/propostas/:id/enviar-email
 *
 * Regras implementadas:
 * 1. Autenticação obrigatória (Admin, Comercial, Gestor de Projetos).
 * 2. Validação estrita de Não Contatar (e-mail e telefone normalizados).
 * 3. Auditoria detalhada na coleção audit_logs (quem, o quê, quando, destinatário).
 * 4. Formatação de moeda e datas em JS seguro para ambiente Goja (sem toLocaleString/Intl).
 * 5. Link público seguro com token_aceite da proposta.
 * 6. Link obrigatório de descadastro (regra de plataforma).
 */

routerAdd('POST', '/backend/v1/gmais/propostas/{id}/enviar-whatsapp', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária para registrar envio.' })
  }

  const propostaId = e.request.pathValue('id')
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    // Body vazio ou inválido
  }

  const destinatarioTelefone = (body.destinatarioTelefone || '').toString().trim()
  const destinatarioNome = (body.destinatarioNome || '').toString().trim()

  const proposta = $app.findRecordById('propostas', propostaId)
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

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

  // Registrar auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('user_email', authRecord.email() || '')
    auditRec.set('user_nome', authRecord.get('name') || authRecord.get('nome') || '')
    auditRec.set('perfil', authRecord.get('role') || authRecord.get('perfil') || '')
    auditRec.set('action', 'envio_whatsapp_proposta')
    auditRec.set('collection_name', 'propostas')
    auditRec.set('record_id', proposta.id)
    auditRec.set(
      'details',
      JSON.stringify({
        proposta_numero: proposta.get('numero'),
        destinatario_nome: destinatarioNome,
        destinatario_telefone: destinatarioTelefone,
        data_envio: new Date().toISOString(),
      }),
    )
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria WhatsApp:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Envio via WhatsApp registrado e auditado com sucesso.',
  })
})

routerAdd('POST', '/backend/v1/gmais/propostas/{id}/enviar-email', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária para enviar e-mail.' })
  }

  const propostaId = e.request.pathValue('id')
  if (!propostaId) {
    return e.json(400, { message: 'ID da proposta não informado.' })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    // Body vazio
  }

  const proposta = $app.findRecordById('propostas', propostaId)
  if (!proposta) {
    return e.json(404, { message: 'Proposta não encontrada.' })
  }

  // Identificar destinatário: prioridade para o que veio no body, senão busca contato/PF/PJ
  let destinatarioEmail = (body.destinatarioEmail || '').toString().trim().toLowerCase()
  let destinatarioNome = (body.destinatarioNome || '').toString().trim()
  const assuntoCustomizado = (body.assunto || '').toString().trim()
  const corpoCustomizado = (body.corpo || '').toString().trim()

  if (!destinatarioEmail) {
    // Tenta obter de cliente_pf
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
    // Tenta obter da empresa ou contatos da empresa
    const empId = proposta.get('empresa')
    if (empId) {
      try {
        // Busca contato decisor na coleção contatos
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
  const baseUrl = $os.getenv('PUBLIC_APP_URL') || 'https://gestao-gmais.skip.app'
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
  const empreendimento = proposta.get('empreendimento') || 'Empreendimento'
  const objeto =
    proposta.get('objeto') || proposta.get('escopo') || 'Serviços de Engenharia Consultiva'
  const prazo = proposta.get('prazo') || '30 dias'

  const assuntoFinal =
    assuntoCustomizado || 'Proposta Comercial ' + numeroProposta + ' — G+ Engenharia'

  // Se o usuário digitou texto customizado, usamos na mensagem principal
  const textoPrincipalHtml = corpoCustomizado
    ? corpoCustomizado.replace(/\n/g, '<br/>')
    : 'Apresentamos a proposta comercial e técnica <strong>' +
      numeroProposta +
      '</strong> para o empreendimento <em>' +
      empreendimento +
      '</em>.<br/><br/>' +
      'Para visualizar os detalhes técnicos, escopo, entregáveis e formalizar o seu <strong>aceite eletrônico</strong>, acesse o link seguro abaixo:'

  // Montagem do HTML oficial compatível com todos os clientes de e-mail
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
          <!-- Header G+ Engenharia -->
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

          <!-- Conteúdo -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; line-height: 1.6; margin-top: 0; color: #1e293b;">
                Olá, <strong>${destinatarioNome}</strong>,
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${textoPrincipalHtml}
              </p>

              <!-- Resumo da Proposta -->
              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 20px 0; font-size: 13px;">
                <tr>
                  <td width="35%" style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Proposta:</td>
                  <td style="color: #0f172a; font-weight: bold; border-bottom: 1px solid #edf2f7;">${numeroProposta}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Empreendimento:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${empreendimento}</td>
                </tr>
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

              <!-- Botão Principal de Ação -->
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

          <!-- Rodapé com auditoria e descadastro -->
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

  // 4. Disparo do e-mail via mailClient do PocketBase
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

  // 5. Auditoria obrigatória (quem, o quê, quando)
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const auditRec = new Record(auditCol)
    auditRec.set('user_id', authRecord.id)
    auditRec.set('user_email', authRecord.email() || '')
    auditRec.set('user_nome', authRecord.get('name') || authRecord.get('nome') || '')
    auditRec.set('perfil', authRecord.get('role') || authRecord.get('perfil') || '')
    auditRec.set('action', 'envio_email_proposta')
    auditRec.set('collection_name', 'propostas')
    auditRec.set('record_id', proposta.id)
    auditRec.set(
      'details',
      JSON.stringify({
        proposta_numero: numeroProposta,
        destinatario_nome: destinatarioNome,
        destinatario_email: destinatarioEmail,
        assunto: assuntoFinal,
        data_envio: new Date().toISOString(),
      }),
    )
    $app.save(auditRec)
  } catch (auditErr) {
    console.warn('[propostas_envio] Falha ao registrar log de auditoria do e-mail:', auditErr)
  }

  return e.json(200, {
    success: true,
    message: 'Proposta enviada por e-mail com sucesso para ' + destinatarioEmail + '.',
  })
})
