// Rotas públicas de Rastreamento (Pixel 1x1 e Redirecionamento de Clique) e Informações de Descadastro
// 1. GET /backend/v1/track/open/{token}
//    - Retorna pixel GIF transparente 1x1
//    - Atualiza aberto_em e total_aberturas no campanha_envios
//    - Incrementa 'abertos' na campanha correspondente
//    - Audita abertura
// 2. GET /backend/v1/track/click/{token}
//    - Atualiza cliques e ultimo_clique_em no campanha_envios
//    - Incrementa 'cliques' na campanha
//    - Redireciona para ?url= (ou para home do sistema)
//    - Audita clique

routerAdd('GET', '/backend/v1/track/open/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (token) {
      try {
        const envios = $app.findRecordsByFilter(
          'campanha_envios',
          "token_rastreamento = '" + token + "'",
          '-created',
          1,
          0,
        )
        if (envios.length > 0) {
          const envio = envios[0]
          const jaAberto = envio.getString('aberto_em')
          const totalAtual = envio.getInt('total_aberturas') || 0

          envio.set('total_aberturas', totalAtual + 1)
          if (!jaAberto) {
            envio.set('aberto_em', new Date().toISOString())
          }
          $app.save(envio)

          // Incrementar contagem única da campanha se primeira abertura deste envio
          if (!jaAberto) {
            const campId = envio.getString('campanha')
            if (campId) {
              try {
                const camp = $app.findRecordById('campanhas', campId)
                if (camp) {
                  const campAbertos = camp.getInt('abertos') || 0
                  camp.set('abertos', campAbertos + 1)
                  $app.save(camp)
                }
              } catch (_) {}
            }
          }

          // Auditar abertura
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'ABERTURA_EMAIL_CAMPANHA')
            aRec.set('entidade', 'campanhas')
            aRec.set('registro_id', envio.getString('campanha'))
            aRec.set('detalhes', {
              envio_id: envio.id,
              destinatario: envio.getString('destinatario_email'),
              empresa: envio.getString('empresa'),
              abertura_numero: totalAtual + 1,
            })
            aRec.set('ip', e.requestInfo().remoteIP || '')
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (dbErr) {
        console.log('Erro ao registrar abertura: ' + dbErr)
      }
    }
  } catch (err) {
    console.log('Erro no track open: ' + err)
  }

  // 1x1 GIF transparente em base64: R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
  // Retorna imagem/gif com headers de no-cache
  const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  const gifBinary = $security.parseJWT ? null : null // fallback check

  // Resposta padrão PocketBase:
  e.response.header().set('Content-Type', 'image/gif')
  e.response.header().set('Cache-Control', 'no-cache, no-store, must-revalidate')
  e.response.header().set('Pragma', 'no-cache')
  e.response.header().set('Expires', '0')

  return e.blob(
    200,
    'image/gif',
    [
      71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0, 0,
      0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 68, 0, 59,
    ],
  )
})

routerAdd('GET', '/backend/v1/track/click/{token}', (e) => {
  let targetUrl = '/'
  try {
    const token = e.request.pathValue('token')
    const queryUrl = e.request.url.query().get('url') || ''
    if (queryUrl) {
      targetUrl = queryUrl
    }

    if (token) {
      try {
        const envios = $app.findRecordsByFilter(
          'campanha_envios',
          "token_rastreamento = '" + token + "'",
          '-created',
          1,
          0,
        )
        if (envios.length > 0) {
          const envio = envios[0]
          const cliquesAtuais = envio.getInt('cliques') || 0
          envio.set('cliques', cliquesAtuais + 1)
          envio.set('ultimo_clique_em', new Date().toISOString())
          $app.save(envio)

          // Incrementar contagem única da campanha se primeiro clique deste envio
          if (cliquesAtuais === 0) {
            const campId = envio.getString('campanha')
            if (campId) {
              try {
                const camp = $app.findRecordById('campanhas', campId)
                if (camp) {
                  const campCliques = camp.getInt('cliques') || 0
                  camp.set('cliques', campCliques + 1)
                  $app.save(camp)
                }
              } catch (_) {}
            }
          }

          // Auditar clique
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'CLIQUE_LINK_CAMPANHA')
            aRec.set('entidade', 'campanhas')
            aRec.set('registro_id', envio.getString('campanha'))
            aRec.set('detalhes', {
              envio_id: envio.id,
              destinatario: envio.getString('destinatario_email'),
              target_url: targetUrl,
            })
            aRec.set('ip', e.requestInfo().remoteIP || '')
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (dbErr) {
        console.log('Erro ao registrar clique: ' + dbErr)
      }
    }
  } catch (err) {
    console.log('Erro no track click: ' + err)
  }

  return e.redirect(302, targetUrl)
})
