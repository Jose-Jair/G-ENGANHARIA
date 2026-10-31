// pocketbase/hooks/revisao_sistema.js
// Rota GET /backend/v1/revisao-sistema - Revisão e integridade do sistema (Somente Leitura em dados de negócio)
// Versão: 0.0.184

routerAdd(
  'GET',
  '/backend/v1/revisao-sistema',
  (e) => {
    const reqInfo = e.requestInfo ? e.requestInfo() : null
    const auth = (reqInfo && reqInfo.auth) || e.auth || (e.get ? e.get('authRecord') : null)
    if (!auth) {
      return e.json(401, { error: 'Autenticação necessária para executar a revisão do sistema.' })
    }

    const role = (auth.getString('role') || auth.getString('perfil') || '').toLowerCase()
    if (role !== 'admin') {
      return e.json(403, {
        error: 'Acesso negado: apenas administradores podem executar a revisão do sistema.',
      })
    }

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo &&
        reqInfo.headers &&
        (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    const checagens = []

    // Helper para registrar falha na collection erros_sistema (única escrita permitida)
    function registrarErro(idChecagem, contagem, detalhe) {
      try {
        if (!$app.hasTable('erros_sistema')) return
        const col = $app.findCollectionByNameOrId('erros_sistema')
        const rec = new Record(col)
        rec.set('rota', '/backend/v1/revisao-sistema')
        rec.set(
          'mensagem',
          `[revisao_sistema] ${idChecagem}: ${contagem} ocorrência(s). ${detalhe}`,
        )
        if (auth && auth.id) {
          rec.set('usuario', auth.id)
          rec.set('usuario_email', auth.getString('email'))
        }
        rec.set('hora', new Date().toISOString())
        rec.set('ip', clientIp)
        rec.set('detalhes', {
          origem: 'revisao_sistema',
          contexto: 'revisao_sistema',
          checagem_id: idChecagem,
          contagem: contagem,
          detalhe: detalhe,
          executado_em: new Date().toISOString(),
        })
        $app.save(rec)
      } catch (err) {
        console.log('[REVISAO_SISTEMA] Falha ao gravar em erros_sistema: ' + err)
      }
    }

    // (1) contratos_servico assinados com admin_ip ou cliente_ip = '127.0.0.1'
    try {
      const q1 = $app
        .db()
        .newQuery(
          "SELECT id, numero, status, admin_ip, cliente_ip FROM contratos_servico WHERE (status = 'assinado' OR status = 'bilateral') AND (admin_ip = '127.0.0.1' OR cliente_ip = '127.0.0.1')",
        )
      const rows1 = []
      q1.all(rows1)
      const cnt1 = rows1.length
      if (cnt1 > 0) {
        const detalhe1 = `Encontrado(s) ${cnt1} contrato(s) de serviço assinado(s) com IP local 127.0.0.1 (admin_ip ou cliente_ip).`
        checagens.push({
          id: 'contratos_ip_loopback',
          nome: 'Contratos de serviço assinados com IP 127.0.0.1',
          status: 'falha',
          detalhe: detalhe1,
          contagem: cnt1,
        })
        registrarErro('contratos_ip_loopback', cnt1, detalhe1)
      } else {
        checagens.push({
          id: 'contratos_ip_loopback',
          nome: 'Contratos de serviço assinados com IP 127.0.0.1',
          status: 'ok',
          detalhe: 'Nenhum contrato assinado possui IP de assinatura como 127.0.0.1.',
          contagem: 0,
        })
      }
    } catch (err1) {
      checagens.push({
        id: 'contratos_ip_loopback',
        nome: 'Contratos de serviço assinados com IP 127.0.0.1',
        status: 'falha',
        detalhe: `Erro ao consultar contratos_servico: ${err1.message}`,
        contagem: 1,
      })
      registrarErro('contratos_ip_loopback', 1, `Erro SQL: ${err1.message}`)
    }

    // (2) contratos_servico assinados (status assinado/bilateral) sem nenhuma conta a receber vinculada na collection contas (tipo = receber) por contrato/projeto
    try {
      const q2 = $app
        .db()
        .newQuery(
          "SELECT cs.id, cs.numero, cs.projeto FROM contratos_servico cs WHERE (cs.status = 'assinado' OR cs.status = 'bilateral') AND NOT EXISTS (SELECT 1 FROM contas c WHERE c.tipo = 'receber' AND (c.contrato_servico = cs.id OR c.contrato = cs.id OR (cs.projeto != '' AND cs.projeto IS NOT NULL AND c.projeto = cs.projeto)))",
        )
      const rows2 = []
      q2.all(rows2)
      const cnt2 = rows2.length
      if (cnt2 > 0) {
        const detalhe2 = `Encontrado(s) ${cnt2} contrato(s) assinado(s) sem conta a receber vinculada em contas.`
        checagens.push({
          id: 'contratos_sem_conta_receber',
          nome: 'Contratos assinados sem contas a receber',
          status: 'falha',
          detalhe: detalhe2,
          contagem: cnt2,
        })
        registrarErro('contratos_sem_conta_receber', cnt2, detalhe2)
      } else {
        checagens.push({
          id: 'contratos_sem_conta_receber',
          nome: 'Contratos assinados sem contas a receber',
          status: 'ok',
          detalhe: 'Todos os contratos de serviço assinados possuem contas a receber vinculadas.',
          contagem: 0,
        })
      }
    } catch (err2) {
      checagens.push({
        id: 'contratos_sem_conta_receber',
        nome: 'Contratos assinados sem contas a receber',
        status: 'falha',
        detalhe: `Erro ao consultar contas vinculadas a contratos: ${err2.message}`,
        contagem: 1,
      })
      registrarErro('contratos_sem_conta_receber', 1, `Erro SQL: ${err2.message}`)
    }

    // (3) projetos criados de contrato assinado com prazo_final vazio
    try {
      const q3 = $app
        .db()
        .newQuery(
          "SELECT p.id, p.nome, p.codigo FROM projetos p WHERE (p.prazo_final IS NULL OR TRIM(p.prazo_final) = '') AND (EXISTS (SELECT 1 FROM contratos_servico cs WHERE cs.projeto = p.id AND (cs.status = 'assinado' OR cs.status = 'bilateral')) OR EXISTS (SELECT 1 FROM contratos c WHERE c.projeto = p.id AND (c.status = 'assinado' OR c.status = 'bilateral')))",
        )
      const rows3 = []
      q3.all(rows3)
      const cnt3 = rows3.length
      if (cnt3 > 0) {
        const detalhe3 = `Encontrado(s) ${cnt3} projeto(s) decorrente(s) de contrato assinado com prazo_final vazio.`
        checagens.push({
          id: 'projetos_contrato_sem_prazo',
          nome: 'Projetos de contrato assinado com prazo final vazio',
          status: 'falha',
          detalhe: detalhe3,
          contagem: cnt3,
        })
        registrarErro('projetos_contrato_sem_prazo', cnt3, detalhe3)
      } else {
        checagens.push({
          id: 'projetos_contrato_sem_prazo',
          nome: 'Projetos de contrato assinado com prazo final vazio',
          status: 'ok',
          detalhe:
            'Todos os projetos gerados a partir de contratos assinados possuem prazo final preenchido.',
          contagem: 0,
        })
      }
    } catch (err3) {
      checagens.push({
        id: 'projetos_contrato_sem_prazo',
        nome: 'Projetos de contrato assinado com prazo final vazio',
        status: 'falha',
        detalhe: `Erro ao consultar projetos: ${err3.message}`,
        contagem: 1,
      })
      registrarErro('projetos_contrato_sem_prazo', 1, `Erro SQL: ${err3.message}`)
    }

    // (4) propostas enviadas (status enviado ao cliente) com campo empreendimento vazio
    try {
      const q4 = $app
        .db()
        .newQuery(
          "SELECT id, numero, status FROM propostas WHERE (status = 'enviada' OR status = 'enviado_cliente' OR status = 'enviada_cliente') AND (empreendimento IS NULL OR TRIM(empreendimento) = '')",
        )
      const rows4 = []
      q4.all(rows4)
      const cnt4 = rows4.length
      if (cnt4 > 0) {
        const detalhe4 = `Encontrada(s) ${cnt4} proposta(s) enviada(s) com campo empreendimento vazio.`
        checagens.push({
          id: 'propostas_enviadas_sem_empreendimento',
          nome: 'Propostas enviadas com campo empreendimento vazio',
          status: 'falha',
          detalhe: detalhe4,
          contagem: cnt4,
        })
        registrarErro('propostas_enviadas_sem_empreendimento', cnt4, detalhe4)
      } else {
        checagens.push({
          id: 'propostas_enviadas_sem_empreendimento',
          nome: 'Propostas enviadas com campo empreendimento vazio',
          status: 'ok',
          detalhe: 'Todas as propostas enviadas possuem o campo empreendimento preenchido.',
          contagem: 0,
        })
      }
    } catch (err4) {
      checagens.push({
        id: 'propostas_enviadas_sem_empreendimento',
        nome: 'Propostas enviadas com campo empreendimento vazio',
        status: 'falha',
        detalhe: `Erro ao consultar propostas enviadas: ${err4.message}`,
        contagem: 1,
      })
      registrarErro('propostas_enviadas_sem_empreendimento', 1, `Erro SQL: ${err4.message}`)
    }

    // (5) contratos com texto de cláusula gravada citando 'OTP' sem codigo_verificacao_hash preenchido
    try {
      let falhasOtp = []

      // Verificar em contratos_servico (onde residem clausulas_texto, versao_texto_aceito e codigo_verificacao_hash)
      if ($app.hasTable('contratos_servico')) {
        const qCs = $app
          .db()
          .newQuery(
            "SELECT id, numero, 'contratos_servico' as tabela FROM contratos_servico WHERE (clausulas_texto LIKE '%OTP%' OR versao_texto_aceito LIKE '%OTP%') AND (codigo_verificacao_hash IS NULL OR TRIM(codigo_verificacao_hash) = '')",
          )
        const rowsCs = []
        qCs.all(rowsCs)
        falhasOtp = falhasOtp.concat(rowsCs)
      }

      // Verificar também em contratos_mestre caso exista
      if ($app.hasTable('contratos_mestre')) {
        try {
          const qCm = $app
            .db()
            .newQuery(
              "SELECT id, numero, 'contratos_mestre' as tabela FROM contratos_mestre WHERE (minuta_texto LIKE '%OTP%' OR versao_texto_aceito LIKE '%OTP%') AND (codigo_verificacao_hash IS NULL OR TRIM(codigo_verificacao_hash) = '')",
            )
          const rowsCm = []
          qCm.all(rowsCm)
          falhasOtp = falhasOtp.concat(rowsCm)
        } catch (_) {}
      }

      const cnt5 = falhasOtp.length
      if (cnt5 > 0) {
        const detalhe5 = `Encontrado(s) ${cnt5} contrato(s) com cláusula gravada citando OTP sem codigo_verificacao_hash preenchido.`
        checagens.push({
          id: 'contratos_otp_sem_hash',
          nome: 'Contratos com cláusula citando OTP sem hash de verificação',
          status: 'falha',
          detalhe: detalhe5,
          contagem: cnt5,
        })
        registrarErro('contratos_otp_sem_hash', cnt5, detalhe5)
      } else {
        checagens.push({
          id: 'contratos_otp_sem_hash',
          nome: 'Contratos com cláusula citando OTP sem hash de verificação',
          status: 'ok',
          detalhe:
            'Nenhum contrato que cita OTP em suas cláusulas gravadas está sem o codigo_verificacao_hash preenchido.',
          contagem: 0,
        })
      }
    } catch (err5) {
      checagens.push({
        id: 'contratos_otp_sem_hash',
        nome: 'Contratos com cláusula citando OTP sem hash de verificação',
        status: 'falha',
        detalhe: `Erro ao consultar contratos com OTP: ${err5.message || err5}`,
        contagem: 1,
      })
      registrarErro('contratos_otp_sem_hash', 1, `Erro SQL: ${err5.message || err5}`)
    }

    // (6) parâmetro url_publica_app da Administração vazio ou contendo o texto 'preview'
    try {
      let urlPublica = ''
      let paramEncontrado = false
      try {
        const paramRec = $app.findFirstRecordByFilter(
          'parametros',
          "chave = 'url_publica_app' || nome = 'url_publica_app'",
        )
        if (paramRec) {
          paramEncontrado = true
          urlPublica = paramRec.getString('valor') || paramRec.getString('conteudo') || ''
        }
      } catch (eParam) {
        // Tentar via SQL caso nome/chave variem
        try {
          const rowP = {}
          $app
            .db()
            .newQuery(
              "SELECT valor FROM parametros WHERE chave = 'url_publica_app' OR nome = 'url_publica_app' LIMIT 1",
            )
            .one(rowP)
          if (rowP && rowP.valor !== undefined) {
            paramEncontrado = true
            urlPublica = String(rowP.valor)
          }
        } catch (eSql) {}
      }

      const urlTrim = (urlPublica || '').trim()
      const isVazio = !urlTrim
      const isPreview = urlTrim.toLowerCase().indexOf('preview') !== -1

      if (isVazio || isPreview) {
        const motivo = isVazio
          ? 'parâmetro não configurado ou vazio'
          : `contém 'preview' (${urlTrim})`
        const detalhe6 = `Parâmetro url_publica_app inválido: ${motivo}.`
        checagens.push({
          id: 'parametro_url_publica_app',
          nome: 'Parâmetro url_publica_app da Administração',
          status: 'falha',
          detalhe: detalhe6,
          contagem: 1,
        })
        registrarErro('parametro_url_publica_app', 1, detalhe6)
      } else {
        checagens.push({
          id: 'parametro_url_publica_app',
          nome: 'Parâmetro url_publica_app da Administração',
          status: 'ok',
          detalhe: `URL pública configurada corretamente: ${urlTrim}`,
          contagem: 0,
        })
      }
    } catch (err6) {
      checagens.push({
        id: 'parametro_url_publica_app',
        nome: 'Parâmetro url_publica_app da Administração',
        status: 'falha',
        detalhe: `Erro ao verificar url_publica_app: ${err6.message}`,
        contagem: 1,
      })
      registrarErro(
        'parametro_url_publica_app',
        1,
        `Erro ao verificar url_publica_app: ${err6.message}`,
      )
    }

    const totalOk = checagens.filter((c) => c.status === 'ok').length
    const totalFalhas = checagens.filter((c) => c.status === 'falha').length

    const resumo = {
      total_checagens: checagens.length,
      total_ok: totalOk,
      total_falhas: totalFalhas,
      status_geral: totalFalhas === 0 ? 'aprovado' : 'atencao',
      executado_em: new Date().toISOString(),
    }

    return e.json(200, {
      checagens: checagens,
      resumo: resumo,
    })
  },
  $apis.requireAuth(),
)
