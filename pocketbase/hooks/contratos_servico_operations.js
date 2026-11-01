// Hook com rotas para interações do contrato e proposta:
// 1. /backend/v1/propostas/solicitar-alteracoes
// 2. /backend/v1/propostas/aceitar-digital (validação do cadastro do cliente: se incompleto -> status 'aguardando_dados_cliente')
// 3. /backend/v1/contratos-servico/assinar-cliente (bloqueio se status for 'aguardando_dados_cliente')
// 4. /backend/v1/contratos-servico/assinar-admin
// 5. /backend/v1/contratos-servico/obter-por-token-complemento (dados para o formulário de complemento)
// 6. /backend/v1/contratos-servico/complementar-dados (gravação dos dados faltantes pelo cliente, atualização cadastral e liberação do contrato)

routerAdd('POST', '/backend/v1/propostas/solicitar-alteracoes', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_aceite
    const texto = (body.texto || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token de proposta não informado' })
    }
    if (!texto) {
      return e.json(400, {
        message: 'Por favor, descreva detalhadamente os ajustes ou dúvidas desejadas.',
      })
    }

    const records = $app.findRecordsByFilter(
      'propostas',
      "token_aceite = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Proposta não encontrada ou link inválido' })
    }

    const proposta = records[0]
    const statusAtual = proposta.getString('status')
    if (statusAtual === 'aceita') {
      return e.json(400, { message: 'Esta proposta já foi aceita e formalizada.' })
    }

    const nowIso = new Date().toISOString()
    const versaoAtual = proposta.getString('revisao') || 'Rev.00'
    let historico = []
    try {
      const histRaw = proposta.get('historico_devolutivas')
      if (Array.isArray(histRaw)) {
        historico = histRaw
      } else if (typeof histRaw === 'string' && histRaw.trim()) {
        historico = JSON.parse(histRaw)
      }
    } catch (_) {
      historico = []
    }

    const novaDevolutiva = {
      data: nowIso,
      versao: versaoAtual,
      texto: texto,
      autor: 'Cliente',
    }
    const historicoAtualizado = historico.concat([novaDevolutiva])

    proposta.set('status', 'em_negociacao')
    proposta.set('solicitacao_alteracao_texto', texto)
    proposta.set('data_solicitacao_alteracao', nowIso)
    proposta.set('historico_devolutivas', historicoAtualizado)
    $app.save(proposta)

    const resolvedReqIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'SOLICITACAO_ALTERACAO_PROPOSTA')
      aRec.set('entidade', 'propostas')
      aRec.set('registro_id', proposta.id)
      aRec.set('detalhes', {
        mensagem:
          'Cliente solicitou alterações na proposta ' +
          proposta.getString('numero') +
          '. Retornada para "Em negociação".',
        proposta_numero: proposta.getString('numero'),
        texto_solicitacao: texto,
        ip: resolvedReqIp,
        user_agent: (reqInfo.headers && reqInfo.headers['user-agent']) || '',
      })
      aRec.set('ip', resolvedReqIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar solicitação de alteração: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message: 'Solicitação de alterações enviada com sucesso! Nossa equipe entrará em contato.',
    })
  } catch (err) {
    console.log('Erro ao processar solicitação de alteração de proposta: ' + err)
    return e.json(500, { message: 'Erro ao registrar solicitação: ' + err })
  }
})

// Endpoint de Aceite Digital da Proposta com Validação Cadastral Server-Side (Bloco 3)
routerAdd('POST', '/backend/v1/propostas/aceitar-digital', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_aceite
    const declaracao = body.declaracao === true
    const hashConteudo = body.hash_conteudo || ''

    if (!token) {
      return e.json(400, { message: 'Token de proposta não informado' })
    }

    if (!declaracao) {
      return e.json(400, {
        message:
          'A declaração de concordância integral com a proposta é obrigatória para o aceite.',
      })
    }

    const records = $app.findRecordsByFilter(
      'propostas',
      "token_aceite = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Proposta não encontrada' })
    }

    const proposta = records[0]
    const statusAtual = proposta.getString('status')
    if (statusAtual === 'aceita') {
      // Idempotência: se já aceita, retornar dados do contrato/projeto existentes
      const contrsExistentes = $app.findRecordsByFilter(
        'contratos_servico',
        "proposta = '" + proposta.id + "'",
        '-created',
        1,
        0,
      )
      const c = contrsExistentes.length > 0 ? contrsExistentes[0] : null
      return e.json(200, {
        success: true,
        message: 'Esta proposta já se encontra aceita.',
        proposta_id: proposta.id,
        contrato_id: c ? c.id : null,
        contrato_numero: c ? c.getString('numero') : null,
        status_contrato: c ? c.getString('status') : null,
        token_complemento_dados: c ? c.getString('token_complemento_dados') : null,
      })
    }

    if (statusAtual === 'recusada' || statusAtual === 'expirada') {
      return e.json(400, {
        message: 'Esta proposta está marcada como ' + statusAtual + ' e não pode mais ser aceita.',
      })
    }

    let clientIp = 'nao_capturado'
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        const xff = e.request.header.get('x-forwarded-for')
        const xri = e.request.header.get('x-real-ip')
        if (xff) {
          clientIp = xff.split(',')[0].trim()
        } else if (xri) {
          clientIp = xri.trim()
        }
      }
      if (clientIp === 'nao_capturado' && e.request && typeof e.request.getHeader === 'function') {
        const xff = e.request.getHeader('x-forwarded-for')
        const xri = e.request.getHeader('x-real-ip')
        if (xff) {
          clientIp = xff.split(',')[0].trim()
        } else if (xri) {
          clientIp = xri.trim()
        }
      }
      if (clientIp === 'nao_capturado' && reqInfo.headers) {
        const xff = reqInfo.headers['x-forwarded-for']
        const xri = reqInfo.headers['x-real-ip']
        if (xff) {
          clientIp = String(xff).split(',')[0].trim()
        } else if (xri) {
          clientIp = String(xri).trim()
        }
      }
    } catch (_) {
      clientIp = 'nao_capturado'
    }
    if (!clientIp) clientIp = 'nao_capturado'

    const clientUserAgent =
      (body.user_agent && String(body.user_agent).trim()) ||
      (body.userAgent && String(body.userAgent).trim()) ||
      (reqInfo.headers && reqInfo.headers['user-agent']) ||
      'nao_capturado'
    const nowIso = new Date().toISOString()

    let hashFinal = hashConteudo
    if (!hashFinal) {
      const payloadStr =
        proposta.getString('numero') +
        '|' +
        proposta.getFloat('preco') +
        '|' +
        proposta.getString('revisao') +
        '|' +
        clientIp +
        '|' +
        nowIso
      hashFinal = $security.sha256(payloadStr)
    }

    proposta.set('status', 'aceita')
    proposta.set('data_aceite', nowIso)
    proposta.set('aceite_ip', clientIp)
    proposta.set('aceite_user_agent', clientUserAgent)
    proposta.set('aceite_declaracao', true)
    proposta.set('aceite_hash', hashFinal)
    $app.save(proposta)

    // Auditoria detalhada do aceite
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'ACEITE_DIGITAL_PROPOSTA')
      aRec.set('entidade', 'propostas')
      aRec.set('registro_id', proposta.id)
      aRec.set('detalhes', {
        mensagem:
          'Aceite eletrônico formalizado pelo cliente com validade jurídica na proposta ' +
          proposta.getString('numero'),
        proposta_numero: proposta.getString('numero'),
        revisao: proposta.getString('revisao'),
        valor: proposta.getFloat('preco'),
        data_aceite: nowIso,
        ip: clientIp,
        user_agent: clientUserAgent,
        hash: hashFinal,
        declaracao_aceite: true,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar aceite digital: ' + errAudit)
    }

    // DECISÃO DO SISTEMA: Parceiro nasce SOMENTE da conversão (proposta aceita -> parceira)
    // Definir etapa_funil='parceira' na empresa atomicamente com auditoria CONVERSAO_PARCEIRO
    const empresaVinculadaId = proposta.getString('empresa')
    if (empresaVinculadaId) {
      try {
        const empRec = $app.findRecordById('empresas', empresaVinculadaId)
        if (empRec) {
          const etapaAtualEmp = empRec.getString('etapa_funil')
          if (etapaAtualEmp !== 'parceira') {
            empRec.set('etapa_anterior', etapaAtualEmp)
            empRec.set('etapa_funil', 'parceira')
            empRec.set('status', 'ativa')
            $app.save(empRec)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRecEmp = new Record(auditCol)
              aRecEmp.set('acao', 'CONVERSAO_PARCEIRO')
              aRecEmp.set('entidade', 'empresas')
              aRecEmp.set('registro_id', empresaVinculadaId)
              aRecEmp.set('detalhes', {
                origem: 'SISTEMA / ACEITE DIGITAL DA PROPOSTA',
                mensagem:
                  'Empresa promovida automaticamente a Parceira após o aceite da Proposta ' +
                  proposta.getString('numero'),
                etapa_anterior: etapaAtualEmp,
                nova_etapa: 'parceira',
                proposta_id: proposta.id,
                proposta_numero: proposta.getString('numero'),
                ip: clientIp,
              })
              aRecEmp.set('ip', clientIp)
              $app.save(aRecEmp)
            } catch (_) {}
          }
        }
      } catch (errEmpAceite) {
        console.log(
          'Erro ao converter empresa para parceira no aceite da proposta: ' + errEmpAceite,
        )
      }
    }

    // Agendamento assíncrono em segundo plano (oneshot cron <= 1 min) para validação,
    // criação idempotente do contrato CTR e disparo de e-mail sem bloquear a resposta HTTP.
    // No runtime do PocketBase v0.23, o callback do cronAdd roda em VM pool isolada,
    // portanto toda a rotina de geração de contrato é executada inline dentro do callback.
    const propostaIdParaContrato = proposta.id
    const ipParaContrato = clientIp
    try {
      const jobId = 'gerar-ctr-prop-' + propostaIdParaContrato
      try {
        cronRemove(jobId)
      } catch (_) {}
      cronAdd(jobId, '* * * * *', function () {
        try {
          cronRemove(jobId)
        } catch (_) {}

        function executarGeracaoContratoInline(propId, ipOrigem) {
          const prop = $app.findRecordById('propostas', propId)
          if (!prop || prop.getString('status') !== 'aceita') return null

          const contratosExistentes = $app.findRecordsByFilter(
            'contratos_servico',
            "proposta = '" + propId + "'",
            '-created',
            1,
            0,
          )
          if (contratosExistentes.length > 0) {
            const cExistente = contratosExistentes[0]
            if (prop.getString('contrato_servico') !== cExistente.id) {
              try {
                prop.set('contrato_servico', cExistente.id)
                $app.save(prop)
              } catch (_) {}
            }
            return cExistente
          }

          const propNum = prop.getString('numero')
          const empId = prop.getString('empresa')
          const cliPfId = prop.getString('cliente_pf')
          const preco = prop.getFloat('preco') || 0
          const prazoDias = prop.getInt('prazo_dias') || 30
          const notaPrazo =
            prop.getString('nota_prazo') ||
            'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'
          const objeto =
            prop.getString('objeto') ||
            prop.getString('escopo') ||
            'Prestação de serviços técnicos especializados de engenharia'

          const cleanDigits = (v) => (v || '').toString().replace(/\D/g, '')

          const isValidCpf = (cStr) => {
            const clean = cleanDigits(cStr)
            if (!clean || clean.length !== 11) return false
            if (/^(\d)\1{10}$/.test(clean)) return false
            let soma = 0
            for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
            let resto = (soma * 10) % 11
            if (resto === 10 || resto === 11) resto = 0
            if (resto !== parseInt(clean.charAt(9), 10)) return false
            soma = 0
            for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
            resto = (soma * 10) % 11
            if (resto === 10 || resto === 11) resto = 0
            return resto === parseInt(clean.charAt(10), 10)
          }

          const isValidCnpj = (cStr) => {
            const clean = cleanDigits(cStr)
            if (!clean || clean.length !== 14) return false
            if (/^(\d)\1{13}$/.test(clean)) return false
            let soma = 0
            let peso = 5
            for (let i = 0; i < 12; i++) {
              soma += parseInt(clean.charAt(i), 10) * peso
              peso = peso === 2 ? 9 : peso - 1
            }
            let resto = soma % 11
            const dv1 = resto < 2 ? 0 : 11 - resto
            if (parseInt(clean.charAt(12), 10) !== dv1) return false
            soma = 0
            peso = 6
            for (let i = 0; i < 13; i++) {
              soma += parseInt(clean.charAt(i), 10) * peso
              peso = peso === 2 ? 9 : peso - 1
            }
            resto = soma % 11
            const dv2 = resto < 2 ? 0 : 11 - resto
            return parseInt(clean.charAt(13), 10) === dv2
          }

          const camposFaltantes = []
          let cliRec = null
          let emailDest = ''
          let nomeDest = ''

          if (empId) {
            try {
              cliRec = $app.findRecordById('empresas', empId)
            } catch (_) {}
            if (!cliRec) {
              camposFaltantes.push('empresa_nao_encontrada')
            } else {
              const razao = (cliRec.getString('razao_social') || '').trim()
              const cnpj = cleanDigits(cliRec.getString('cnpj'))
              const cep = cleanDigits(cliRec.getString('cep'))
              const logradouro = (cliRec.getString('logradouro') || '').trim()
              const numero = (cliRec.getString('numero') || '').trim()
              const bairro = (cliRec.getString('bairro') || '').trim()
              const municipio = (cliRec.getString('municipio') || '').trim()
              const uf = (cliRec.getString('uf') || '').trim()
              const email = (cliRec.getString('email') || '').trim()
              const telefone = (cliRec.getString('telefone') || '').trim()

              emailDest = email
              nomeDest = razao

              let temTelefone = Boolean(telefone)
              try {
                const tels = cliRec.get('telefones')
                if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) temTelefone = true
              } catch (_) {}

              if (!razao) camposFaltantes.push('razao_social')
              if (!cnpj || !isValidCnpj(cnpj)) camposFaltantes.push('cnpj')
              if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
              if (!temTelefone) camposFaltantes.push('telefone')
              if (!cep || cep.length < 8) camposFaltantes.push('cep')
              if (!logradouro) camposFaltantes.push('logradouro')
              if (!numero) camposFaltantes.push('numero')
              if (!bairro) camposFaltantes.push('bairro')
              if (!municipio) camposFaltantes.push('municipio')
              if (!uf) camposFaltantes.push('uf')

              let repNome = ''
              let repCpf = ''
              try {
                const contatos = $app.findRecordsByFilter(
                  'contatos',
                  "empresa = '" + empId + "'",
                  '-decisor,-created',
                  5,
                  0,
                )
                for (let ci = 0; ci < contatos.length; ci++) {
                  const cRec = contatos[ci]
                  const cNome = (cRec.getString('nome') || '').trim()
                  const cCpf = cleanDigits(
                    cRec.getString('cpf') ||
                      cRec.getString('documento') ||
                      cRec.getString('observacao') ||
                      '',
                  )
                  if (cNome && !repNome) repNome = cNome
                  if (cCpf && isValidCpf(cCpf) && !repCpf) repCpf = cCpf
                  if (repNome && repCpf) break
                }
              } catch (_) {}

              if (!repNome) camposFaltantes.push('representante_nome')
              if (!repCpf || !isValidCpf(repCpf)) camposFaltantes.push('representante_documento')
            }
          } else if (cliPfId) {
            try {
              cliRec = $app.findRecordById('clientes_pf', cliPfId)
            } catch (_) {}
            if (!cliRec) {
              camposFaltantes.push('cliente_pf_nao_encontrado')
            } else {
              const nome = (cliRec.getString('nome') || '').trim()
              const cpf = cleanDigits(cliRec.getString('cpf'))
              const email = (cliRec.getString('email') || '').trim()
              const telefone = (cliRec.getString('telefone') || '').trim()
              const cep = cleanDigits(cliRec.getString('cep'))
              const logradouro = (cliRec.getString('logradouro') || '').trim()
              const numero = (cliRec.getString('numero') || '').trim()
              const bairro = (cliRec.getString('bairro') || '').trim()
              const municipio = (cliRec.getString('municipio') || '').trim()
              const uf = (cliRec.getString('uf') || '').trim()

              emailDest = email
              nomeDest = nome

              let temTelefone = Boolean(telefone)
              try {
                const tels = cliRec.get('telefones')
                if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) temTelefone = true
              } catch (_) {}

              if (!nome) camposFaltantes.push('nome')
              if (!cpf || !isValidCpf(cpf)) camposFaltantes.push('cpf')
              if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
              if (!temTelefone) camposFaltantes.push('telefone')
              if (!cep || cep.length < 8) camposFaltantes.push('cep')
              if (!logradouro) camposFaltantes.push('logradouro')
              if (!numero) camposFaltantes.push('numero')
              if (!bairro) camposFaltantes.push('bairro')
              if (!municipio) camposFaltantes.push('municipio')
              if (!uf) camposFaltantes.push('uf')
            }
          } else {
            camposFaltantes.push('cliente_indefinido')
          }

          const cadastroCompleto = camposFaltantes.length === 0
          const statusInicial = cadastroCompleto
            ? 'aguardando_assinatura_admin'
            : 'aguardando_dados_cliente'

          const anoAtual = new Date().getFullYear()
          const prefixoCTR = 'CTR-' + anoAtual + '-'
          const contratosDoAno = $app.findRecordsByFilter(
            'contratos_servico',
            "numero ~ '" + prefixoCTR + "'",
            '-numero',
            1,
            0,
          )

          let proximoSeqCtr = 1
          if (contratosDoAno.length > 0) {
            const ultimoNumero = contratosDoAno[0].getString('numero')
            const partes = ultimoNumero.split('-')
            const ultimoSeq = parseInt(partes[2], 10)
            if (!isNaN(ultimoSeq)) proximoSeqCtr = ultimoSeq + 1
          }
          const numeroCTR = prefixoCTR + ('0000' + proximoSeqCtr).slice(-4)

          let clausulasTexto = ''
          try {
            const paramClausulas = $app.findFirstRecordByData(
              'parametros',
              'chave',
              'contrato_servico_clausulas_padrao',
            )
            if (paramClausulas) clausulasTexto = paramClausulas.getString('valor')
          } catch (_) {}

          let parcelas = []
          try {
            const parcs = $app.findRecordsByFilter(
              'proposta_parcelas',
              "proposta = '" + propId + "'",
              'ordem',
              50,
              0,
            )
            parcelas = parcs.map((p) => ({
              ordem: p.getInt('ordem'),
              percentual: p.getFloat('percentual'),
              valor: p.getFloat('valor'),
              gatilho: p.getString('gatilho'),
              descricao: p.getString('descricao'),
            }))
          } catch (_) {}

          const tokenAssinaturaCliente = $security.randomString(32)
          const tokenComplementoDados = cadastroCompleto ? '' : $security.randomString(32)

          const contratosCol = $app.findCollectionByNameOrId('contratos_servico')
          const novoContrato = new Record(contratosCol)
          novoContrato.set('numero', numeroCTR)
          novoContrato.set('proposta', propId)
          if (empId) novoContrato.set('empresa', empId)
          if (cliPfId) novoContrato.set('cliente_pf', cliPfId)
          novoContrato.set('objeto', objeto)
          novoContrato.set('valor_total', preco)
          novoContrato.set('prazo_dias', prazoDias)
          novoContrato.set('nota_prazo', notaPrazo)
          novoContrato.set('clausulas_texto', clausulasTexto)
          novoContrato.set('parcelas_json', parcelas)
          novoContrato.set('status', statusInicial)
          novoContrato.set('token_assinatura_cliente', tokenAssinaturaCliente)
          novoContrato.set('token_complemento_dados', tokenComplementoDados)
          novoContrato.set('campos_faltantes_json', camposFaltantes)

          $app.save(novoContrato)

          try {
            prop.set('contrato_servico', novoContrato.id)
            if (cadastroCompleto) {
              prop.set('dados_complementares_preenchidos', true)
            } else if (tokenComplementoDados) {
              prop.set('dados_complementares_preenchidos', false)
            }
            $app.save(prop)
          } catch (_) {}

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('acao', 'GERACAO_CONTRATO_SERVICO')
            aRec.set('entidade', 'contratos_servico')
            aRec.set('registro_id', novoContrato.id)
            aRec.set('detalhes', {
              mensagem:
                'Contrato de serviços gerado pelo aceite digital da proposta ' +
                propNum +
                (cadastroCompleto
                  ? ' (Cadastro completo -> Aguardando assinatura Admin)'
                  : ' (Cadastro incompleto -> Aguardando dados do cliente)'),
              contrato_numero: numeroCTR,
              proposta_id: propId,
              proposta_numero: propNum,
              status: statusInicial,
              campos_faltantes: camposFaltantes,
              valor: preco,
              ip: ipOrigem,
            })
            aRec.set('ip', ipOrigem)
            $app.save(aRec)
          } catch (_) {}

          if (
            !cadastroCompleto &&
            tokenComplementoDados &&
            emailDest &&
            emailDest.indexOf('@') !== -1
          ) {
            try {
              const appUrl =
                $os.getenv('PUBLIC_APP_URL') ||
                'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
              const linkComplemento = appUrl + '/completar-cadastro/' + tokenComplementoDados
              const senderAddress =
                ($app.settings().meta && $app.settings().meta.senderAddress) ||
                'nao-responder@skip.dev'
              const senderName =
                ($app.settings().meta && $app.settings().meta.senderName) ||
                'G+ Engenharia Consultiva'
              const linkDescadastro =
                appUrl +
                '/descadastro?origem=fluxo_contratual&email=' +
                encodeURIComponent(emailDest)

              const htmlEmail =
                '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
                '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
                '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
                '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
                '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Complementação de Dados para Emissão do Contrato</p>' +
                '</td></tr>' +
                '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
                '<p>Olá, <strong>' +
                (nomeDest || 'Cliente') +
                '</strong>!</p>' +
                '<p>Confirmamos o aceite na Proposta Comercial <strong>' +
                propNum +
                '</strong>. Para que o seu Contrato de Prestação de Serviços Técnicos seja gerado com total conformidade jurídica e siga para a etapa de assinaturas digitais, precisamos que você complete alguns dados cadastrais obrigatórios.</p>' +
                '<div style="margin:28px 0;text-align:center;">' +
                '<a href="' +
                linkComplemento +
                '" target="_blank" style="background-color:#D95A2B;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;font-size:14px;">Completar Meus Dados Cadastrais</a>' +
                '</div>' +
                '<p style="font-size:12px;color:#64748b;">Se o botão não funcionar, copie e cole este link em seu navegador:<br /><span style="font-family:monospace;word-break:break-all;">' +
                linkComplemento +
                '</span></p>' +
                '</td></tr>' +
                '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
                'Mensagem transacional do fluxo de contratação G+ Engenharia • ' +
                numeroCTR +
                '<br />Caso não queira receber nossas comunicações, <a href="' +
                linkDescadastro +
                '" style="color:#64748b;">descadastre seu e-mail</a>.' +
                '</td></tr>' +
                '</table></body></html>'

              const msg = new MailerMessage({
                from: { address: senderAddress, name: senderName },
                to: [{ address: emailDest, name: nomeDest }],
                subject:
                  'Ação necessária: Complete seu cadastro para geração do contrato ' + numeroCTR,
                html: htmlEmail,
              })

              $app.newMailClient().send(msg)

              try {
                const auditCol = $app.findCollectionByNameOrId('audit_logs')
                const aRec = new Record(auditCol)
                aRec.set('acao', 'ENVIO_EMAIL_COMPLEMENTO_DADOS')
                aRec.set('entidade', 'contratos_servico')
                aRec.set('registro_id', novoContrato.id)
                aRec.set('detalhes', {
                  mensagem:
                    'E-mail transacional de complemento de dados enviado com link exclusivo para ' +
                    emailDest,
                  contrato_numero: numeroCTR,
                  destinatario: emailDest,
                  link: linkComplemento,
                })
                aRec.set('ip', ipOrigem)
                $app.save(aRec)
              } catch (_) {}
            } catch (mailErr) {
              console.log('Aviso/Erro ao disparar e-mail de complemento: ' + mailErr)
            }
          }

          return novoContrato
        }

        try {
          executarGeracaoContratoInline(propostaIdParaContrato, ipParaContrato)
        } catch (errPos) {
          try {
            const errCol = $app.findCollectionByNameOrId('erros_sistema')
            if (errCol) {
              const errRec = new Record(errCol)
              errRec.set('rota', 'ACEITE_PROPOSTA_POS_RESPOSTA')
              errRec.set(
                'mensagem',
                ('Falha ao gerar contrato pós-aceite (cron): ' + errPos).slice(0, 1000),
              )
              errRec.set('hora', new Date().toISOString())
              errRec.set('ip', ipParaContrato)
              errRec.set('usuario_email', 'sistema')
              errRec.set('detalhes', {
                proposta_id: propostaIdParaContrato,
                erro: String(errPos),
              })
              $app.save(errRec)
            }
          } catch (_) {}
        }
      })
    } catch (errCron) {
      console.log('Erro ao agendar geracao de contrato pos-aceite: ' + errCron)
    }

    return e.json(200, {
      success: true,
      aceite_registrado: true,
      contrato_em_geracao: true,
      message:
        'Aceite registrado! Seu contrato está sendo gerado e você receberá as informações por e-mail.',
      proposta_id: proposta.id,
      proposta_numero: proposta.getString('numero'),
      hash: hashFinal,
      data_aceite: nowIso,
    })
  } catch (err) {
    console.log('Erro ao registrar aceite digital de proposta: ' + err)
    return e.json(500, { message: 'Erro interno ao processar aceite: ' + err })
  }
})

// =============================================================================
// BACKFILL IDEMPOTENTE ONESHOT (Auto-removível no primeiro disparo)
// Varre propostas status='aceita' com contrato_servico vazio e data_aceite preenchida
// =============================================================================
try {
  cronRemove('backfill-propostas-aceitas-sem-contrato-v186')
} catch (_) {}

cronAdd('backfill-propostas-aceitas-sem-contrato-v186', '* * * * *', function () {
  try {
    cronRemove('backfill-propostas-aceitas-sem-contrato-v186')
  } catch (_) {}

  function gerarContratoInlineParaBackfill(propId, ipOrigem) {
    const prop = $app.findRecordById('propostas', propId)
    if (!prop || prop.getString('status') !== 'aceita') return null

    const contratosExistentes = $app.findRecordsByFilter(
      'contratos_servico',
      "proposta = '" + propId + "'",
      '-created',
      1,
      0,
    )
    if (contratosExistentes.length > 0) {
      const cExistente = contratosExistentes[0]
      if (prop.getString('contrato_servico') !== cExistente.id) {
        try {
          prop.set('contrato_servico', cExistente.id)
          $app.save(prop)
        } catch (_) {}
      }
      return cExistente
    }

    const propNum = prop.getString('numero')
    const empId = prop.getString('empresa')
    const cliPfId = prop.getString('cliente_pf')
    const preco = prop.getFloat('preco') || 0
    const prazoDias = prop.getInt('prazo_dias') || 30
    const notaPrazo =
      prop.getString('nota_prazo') ||
      'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'
    const objeto =
      prop.getString('objeto') ||
      prop.getString('escopo') ||
      'Prestação de serviços técnicos especializados de engenharia'

    const cleanDigits = (v) => (v || '').toString().replace(/\D/g, '')

    const isValidCpf = (cStr) => {
      const clean = cleanDigits(cStr)
      if (!clean || clean.length !== 11) return false
      if (/^(\d)\1{10}$/.test(clean)) return false
      let soma = 0
      for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
      let resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      if (resto !== parseInt(clean.charAt(9), 10)) return false
      soma = 0
      for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
      resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      return resto === parseInt(clean.charAt(10), 10)
    }

    const isValidCnpj = (cStr) => {
      const clean = cleanDigits(cStr)
      if (!clean || clean.length !== 14) return false
      if (/^(\d)\1{13}$/.test(clean)) return false
      let soma = 0
      let peso = 5
      for (let i = 0; i < 12; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      let resto = soma % 11
      const dv1 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(12), 10) !== dv1) return false
      soma = 0
      peso = 6
      for (let i = 0; i < 13; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      resto = soma % 11
      const dv2 = resto < 2 ? 0 : 11 - resto
      return parseInt(clean.charAt(13), 10) === dv2
    }

    const camposFaltantes = []
    let cliRec = null
    let emailDest = ''
    let nomeDest = ''

    if (empId) {
      try {
        cliRec = $app.findRecordById('empresas', empId)
      } catch (_) {}
      if (!cliRec) {
        camposFaltantes.push('empresa_nao_encontrada')
      } else {
        const razao = (cliRec.getString('razao_social') || '').trim()
        const cnpj = cleanDigits(cliRec.getString('cnpj'))
        const cep = cleanDigits(cliRec.getString('cep'))
        const logradouro = (cliRec.getString('logradouro') || '').trim()
        const numero = (cliRec.getString('numero') || '').trim()
        const bairro = (cliRec.getString('bairro') || '').trim()
        const municipio = (cliRec.getString('municipio') || '').trim()
        const uf = (cliRec.getString('uf') || '').trim()
        const email = (cliRec.getString('email') || '').trim()
        const telefone = (cliRec.getString('telefone') || '').trim()

        emailDest = email
        nomeDest = razao

        let temTelefone = Boolean(telefone)
        try {
          const tels = cliRec.get('telefones')
          if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) temTelefone = true
        } catch (_) {}

        if (!razao) camposFaltantes.push('razao_social')
        if (!cnpj || !isValidCnpj(cnpj)) camposFaltantes.push('cnpj')
        if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
        if (!temTelefone) camposFaltantes.push('telefone')
        if (!cep || cep.length < 8) camposFaltantes.push('cep')
        if (!logradouro) camposFaltantes.push('logradouro')
        if (!numero) camposFaltantes.push('numero')
        if (!bairro) camposFaltantes.push('bairro')
        if (!municipio) camposFaltantes.push('municipio')
        if (!uf) camposFaltantes.push('uf')

        let repNome = ''
        let repCpf = ''
        try {
          const contatos = $app.findRecordsByFilter(
            'contatos',
            "empresa = '" + empId + "'",
            '-decisor,-created',
            5,
            0,
          )
          for (let ci = 0; ci < contatos.length; ci++) {
            const cRec = contatos[ci]
            const cNome = (cRec.getString('nome') || '').trim()
            const cCpf = cleanDigits(
              cRec.getString('cpf') ||
                cRec.getString('documento') ||
                cRec.getString('observacao') ||
                '',
            )
            if (cNome && !repNome) repNome = cNome
            if (cCpf && isValidCpf(cCpf) && !repCpf) repCpf = cCpf
            if (repNome && repCpf) break
          }
        } catch (_) {}

        if (!repNome) camposFaltantes.push('representante_nome')
        if (!repCpf || !isValidCpf(repCpf)) camposFaltantes.push('representante_documento')
      }
    } else if (cliPfId) {
      try {
        cliRec = $app.findRecordById('clientes_pf', cliPfId)
      } catch (_) {}
      if (!cliRec) {
        camposFaltantes.push('cliente_pf_nao_encontrado')
      } else {
        const nome = (cliRec.getString('nome') || '').trim()
        const cpf = cleanDigits(cliRec.getString('cpf'))
        const email = (cliRec.getString('email') || '').trim()
        const telefone = (cliRec.getString('telefone') || '').trim()
        const cep = cleanDigits(cliRec.getString('cep'))
        const logradouro = (cliRec.getString('logradouro') || '').trim()
        const numero = (cliRec.getString('numero') || '').trim()
        const bairro = (cliRec.getString('bairro') || '').trim()
        const municipio = (cliRec.getString('municipio') || '').trim()
        const uf = (cliRec.getString('uf') || '').trim()

        emailDest = email
        nomeDest = nome

        let temTelefone = Boolean(telefone)
        try {
          const tels = cliRec.get('telefones')
          if (Array.isArray(tels) && tels.length > 0 && tels[0].numero) temTelefone = true
        } catch (_) {}

        if (!nome) camposFaltantes.push('nome')
        if (!cpf || !isValidCpf(cpf)) camposFaltantes.push('cpf')
        if (!email || email.indexOf('@') === -1) camposFaltantes.push('email')
        if (!temTelefone) camposFaltantes.push('telefone')
        if (!cep || cep.length < 8) camposFaltantes.push('cep')
        if (!logradouro) camposFaltantes.push('logradouro')
        if (!numero) camposFaltantes.push('numero')
        if (!bairro) camposFaltantes.push('bairro')
        if (!municipio) camposFaltantes.push('municipio')
        if (!uf) camposFaltantes.push('uf')
      }
    } else {
      camposFaltantes.push('cliente_indefinido')
    }

    const cadastroCompleto = camposFaltantes.length === 0
    const statusInicial = cadastroCompleto
      ? 'aguardando_assinatura_admin'
      : 'aguardando_dados_cliente'

    const anoAtual = new Date().getFullYear()
    const prefixoCTR = 'CTR-' + anoAtual + '-'
    const contratosDoAno = $app.findRecordsByFilter(
      'contratos_servico',
      "numero ~ '" + prefixoCTR + "'",
      '-numero',
      1,
      0,
    )

    let proximoSeqCtr = 1
    if (contratosDoAno.length > 0) {
      const ultimoNumero = contratosDoAno[0].getString('numero')
      const partes = ultimoNumero.split('-')
      const ultimoSeq = parseInt(partes[2], 10)
      if (!isNaN(ultimoSeq)) proximoSeqCtr = ultimoSeq + 1
    }
    const numeroCTR = prefixoCTR + ('0000' + proximoSeqCtr).slice(-4)

    let clausulasTexto = ''
    try {
      const paramClausulas = $app.findFirstRecordByData(
        'parametros',
        'chave',
        'contrato_servico_clausulas_padrao',
      )
      if (paramClausulas) clausulasTexto = paramClausulas.getString('valor')
    } catch (_) {}

    let parcelas = []
    try {
      const parcs = $app.findRecordsByFilter(
        'proposta_parcelas',
        "proposta = '" + propId + "'",
        'ordem',
        50,
        0,
      )
      parcelas = parcs.map((p) => ({
        ordem: p.getInt('ordem'),
        percentual: p.getFloat('percentual'),
        valor: p.getFloat('valor'),
        gatilho: p.getString('gatilho'),
        descricao: p.getString('descricao'),
      }))
    } catch (_) {}

    const tokenAssinaturaCliente = $security.randomString(32)
    const tokenComplementoDados = cadastroCompleto ? '' : $security.randomString(32)

    const contratosCol = $app.findCollectionByNameOrId('contratos_servico')
    const novoContrato = new Record(contratosCol)
    novoContrato.set('numero', numeroCTR)
    novoContrato.set('proposta', propId)
    if (empId) novoContrato.set('empresa', empId)
    if (cliPfId) novoContrato.set('cliente_pf', cliPfId)
    novoContrato.set('objeto', objeto)
    novoContrato.set('valor_total', preco)
    novoContrato.set('prazo_dias', prazoDias)
    novoContrato.set('nota_prazo', notaPrazo)
    novoContrato.set('clausulas_texto', clausulasTexto)
    novoContrato.set('parcelas_json', parcelas)
    novoContrato.set('status', statusInicial)
    novoContrato.set('token_assinatura_cliente', tokenAssinaturaCliente)
    novoContrato.set('token_complemento_dados', tokenComplementoDados)
    novoContrato.set('campos_faltantes_json', camposFaltantes)

    $app.save(novoContrato)

    try {
      prop.set('contrato_servico', novoContrato.id)
      if (cadastroCompleto) {
        prop.set('dados_complementares_preenchidos', true)
      } else if (tokenComplementoDados) {
        prop.set('dados_complementares_preenchidos', false)
      }
      $app.save(prop)
    } catch (_) {}

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'GERACAO_CONTRATO_SERVICO')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', novoContrato.id)
      aRec.set('detalhes', {
        origem: 'SISTEMA / BACKFILL IDEMPOTENTE V0.0.186',
        mensagem:
          'Contrato de serviços gerado pelo backfill pós-aceite da proposta ' +
          propNum +
          (cadastroCompleto
            ? ' (Cadastro completo -> Aguardando assinatura Admin)'
            : ' (Cadastro incompleto -> Aguardando dados do cliente)'),
        contrato_numero: numeroCTR,
        proposta_id: propId,
        proposta_numero: propNum,
        status: statusInicial,
        campos_faltantes: camposFaltantes,
        valor: preco,
        ip: ipOrigem,
      })
      aRec.set('ip', ipOrigem)
      $app.save(aRec)
    } catch (_) {}

    if (!cadastroCompleto && tokenComplementoDados && emailDest && emailDest.indexOf('@') !== -1) {
      try {
        const appUrl =
          $os.getenv('PUBLIC_APP_URL') ||
          'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
        const linkComplemento = appUrl + '/completar-cadastro/' + tokenComplementoDados
        const senderAddress =
          ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
        const senderName =
          ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'
        const linkDescadastro =
          appUrl + '/descadastro?origem=fluxo_contratual&email=' + encodeURIComponent(emailDest)

        const htmlEmail =
          '<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;font-family:sans-serif;background-color:#f8fafc;color:#1e293b;">' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">' +
          '<tr><td style="background-color:#1E2A4A;padding:20px 24px;border-bottom:3px solid #D95A2B;">' +
          '<h2 style="margin:0;color:#ffffff;font-size:18px;">G+ Engenharia Consultiva</h2>' +
          '<p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">Complementação de Dados para Emissão do Contrato</p>' +
          '</td></tr>' +
          '<tr><td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">' +
          '<p>Olá, <strong>' +
          (nomeDest || 'Cliente') +
          '</strong>!</p>' +
          '<p>Confirmamos o aceite na Proposta Comercial <strong>' +
          propNum +
          '</strong>. Para que o seu Contrato de Prestação de Serviços Técnicos seja gerado com total conformidade jurídica e siga para a etapa de assinaturas digitais, precisamos que você complete alguns dados cadastrais obrigatórios.</p>' +
          '<div style="margin:28px 0;text-align:center;">' +
          '<a href="' +
          linkComplemento +
          '" target="_blank" style="background-color:#D95A2B;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;font-size:14px;">Completar Meus Dados Cadastrais</a>' +
          '</div>' +
          '<p style="font-size:12px;color:#64748b;">Se o botão não funcionar, copie e cole este link em seu navegador:<br /><span style="font-family:monospace;word-break:break-all;">' +
          linkComplemento +
          '</span></p>' +
          '</td></tr>' +
          '<tr><td style="padding:16px 24px;background-color:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
          'Mensagem transacional do fluxo de contratação G+ Engenharia • ' +
          numeroCTR +
          '<br />Caso não queira receber nossas comunicações, <a href="' +
          linkDescadastro +
          '" style="color:#64748b;">descadastre seu e-mail</a>.' +
          '</td></tr>' +
          '</table></body></html>'

        const msg = new MailerMessage({
          from: { address: senderAddress, name: senderName },
          to: [{ address: emailDest, name: nomeDest }],
          subject: 'Ação necessária: Complete seu cadastro para geração do contrato ' + numeroCTR,
          html: htmlEmail,
        })

        $app.newMailClient().send(msg)

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'ENVIO_EMAIL_COMPLEMENTO_DADOS')
          aRec.set('entidade', 'contratos_servico')
          aRec.set('registro_id', novoContrato.id)
          aRec.set('detalhes', {
            mensagem:
              'E-mail transacional de complemento de dados enviado com link exclusivo para ' +
              emailDest,
            contrato_numero: numeroCTR,
            destinatario: emailDest,
            link: linkComplemento,
          })
          aRec.set('ip', ipOrigem)
          $app.save(aRec)
        } catch (_) {}
      } catch (mailErr) {
        console.log('Aviso/Erro ao disparar e-mail de complemento: ' + mailErr)
      }
    }

    return novoContrato
  }

  try {
    const propostasPendentes = $app.findRecordsByFilter(
      'propostas',
      "status = 'aceita' && contrato_servico = '' && data_aceite != ''",
      'created',
      50,
      0,
    )

    if (propostasPendentes.length === 0) {
      console.log('[backfill-aceite] Nenhuma proposta aceita pendente de contrato encontrada.')
      return
    }

    console.log(
      '[backfill-aceite] Encontradas ' +
        propostasPendentes.length +
        ' proposta(s) aceita(s) sem contrato. Iniciando processamento idempotente...',
    )

    let totalSucesso = 0
    let totalFalha = 0

    for (let i = 0; i < propostasPendentes.length; i++) {
      const p = propostasPendentes[i]
      const propId = p.id
      const propNum = p.getString('numero')
      const ipGravado = p.getString('aceite_ip') || 'nao_capturado'

      try {
        const contratoGerado = gerarContratoInlineParaBackfill(propId, ipGravado)
        if (contratoGerado) {
          totalSucesso++
          console.log(
            '[backfill-aceite] Contrato gerado com sucesso para proposta ' +
              propNum +
              ' -> ' +
              contratoGerado.getString('numero') +
              ' (' +
              contratoGerado.getString('status') +
              ')',
          )
        }
      } catch (errProp) {
        totalFalha++
        console.log(
          '[backfill-aceite] Erro ao gerar contrato para proposta ' +
            propNum +
            ' (' +
            propId +
            '): ' +
            errProp,
        )
        try {
          const errCol = $app.findCollectionByNameOrId('erros_sistema')
          if (errCol) {
            const errRec = new Record(errCol)
            errRec.set('rota', 'BACKFILL_ACEITE_PROPOSTA')
            errRec.set(
              'mensagem',
              ('Falha no backfill da proposta ' + propNum + ': ' + errProp).slice(0, 1000),
            )
            errRec.set('hora', new Date().toISOString())
            errRec.set('ip', ipGravado)
            errRec.set('usuario_email', 'sistema')
            errRec.set('detalhes', {
              proposta_id: propId,
              proposta_numero: propNum,
              erro: String(errProp),
            })
            $app.save(errRec)
          }
        } catch (_) {}
      }
    }

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'BACKFILL_CONTRATOS_PROPOSTAS_ACEITAS')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('detalhes', {
        origem: 'SISTEMA / BACKFILL ONESHOT V0.0.186',
        mensagem:
          'Backfill de contratos para propostas aceitas executado. Processadas: ' +
          propostasPendentes.length +
          ' | Sucessos: ' +
          totalSucesso +
          ' | Falhas: ' +
          totalFalha,
        total_propostas: propostasPendentes.length,
        total_sucesso: totalSucesso,
        total_falha: totalFalha,
      })
      $app.save(aRec)
    } catch (_) {}
  } catch (errBackfillGeral) {
    console.log('[backfill-aceite] Erro geral no cron de backfill: ' + errBackfillGeral)
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', 'BACKFILL_ACEITE_PROPOSTA')
        errRec.set(
          'mensagem',
          ('Falha geral no cron de backfill: ' + errBackfillGeral).slice(0, 1000),
        )
        errRec.set('hora', new Date().toISOString())
        errRec.set('usuario_email', 'sistema')
        errRec.set('detalhes', { erro: String(errBackfillGeral) })
        $app.save(errRec)
      }
    } catch (_) {}
  }
})

// Endpoint Público: Obter Contrato de Serviço por Token de Assinatura (ou Complemento) em QUALQUER status (sem login)
routerAdd('GET', '/backend/v1/contratos-servico/obter-por-token/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { message: 'Token não informado' })
    }

    // ALTERAÇÃO 2: Aceitar o contrato em QUALQUER status (aguardando_dados_cliente, aguardando_assinatura_admin,
    // aguardando_assinatura_cliente, assinado) desde que o token da URL corresponda exatamente
    // ao campo token_assinatura_cliente (ou token_complemento_dados) do registro.
    // Retornar a minuta completa expandida (contratante PJ/PF, proposta, cláusulas) sem exigir sessão.
    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_assinatura_cliente = '" + token + "' || token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link expirado' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    const propostaId = contrato.getString('proposta')
    const assinanteAdminId = contrato.getString('assinante_admin')
    const projetoId = contrato.getString('projeto')

    let empresaExpand = null
    let clientePfExpand = null
    let propostaExpand = null
    let assinanteAdminExpand = null

    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) {
          empresaExpand = {
            id: emp.id,
            razao_social: emp.getString('razao_social'),
            nome_fantasia: emp.getString('nome_fantasia'),
            cnpj: emp.getString('cnpj'),
            email: emp.getString('email'),
            telefone: emp.getString('telefone'),
            telefones: emp.get('telefones') || [],
            cep: emp.getString('cep'),
            logradouro: emp.getString('logradouro'),
            numero: emp.getString('numero'),
            complemento: emp.getString('complemento'),
            bairro: emp.getString('bairro'),
            municipio: emp.getString('municipio'),
            uf: emp.getString('uf'),
          }
        }
      } catch (_) {}
    }

    if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        if (pf) {
          clientePfExpand = {
            id: pf.id,
            nome: pf.getString('nome'),
            cpf: pf.getString('cpf'),
            email: pf.getString('email'),
            telefone: pf.getString('telefone'),
            telefones: pf.get('telefones') || [],
            cep: pf.getString('cep'),
            logradouro: pf.getString('logradouro'),
            numero: pf.getString('numero'),
            complemento: pf.getString('complemento'),
            bairro: pf.getString('bairro'),
            municipio: pf.getString('municipio'),
            uf: pf.getString('uf'),
            endereco: pf.getString('endereco'),
          }
        }
      } catch (_) {}
    }

    if (propostaId) {
      try {
        const prop = $app.findRecordById('propostas', propostaId)
        if (prop) {
          propostaExpand = {
            id: prop.id,
            numero: prop.getString('numero'),
            objeto: prop.getString('objeto'),
            preco: prop.getFloat('preco'),
          }
        }
      } catch (_) {}
    }

    if (assinanteAdminId) {
      try {
        const adm = $app.findRecordById('users', assinanteAdminId)
        if (adm) {
          assinanteAdminExpand = {
            id: adm.id,
            name: adm.getString('name'),
            email: adm.getString('email'),
          }
        }
      } catch (_) {}
    }

    let camposFaltantes = []
    try {
      const cf = contrato.get('campos_faltantes_json')
      if (Array.isArray(cf)) camposFaltantes = cf
    } catch (_) {}

    return e.json(200, {
      id: contrato.id,
      numero: contrato.getString('numero'),
      proposta: propostaId,
      empresa: empresaId || undefined,
      cliente_pf: clientePfId || undefined,
      projeto: projetoId || undefined,
      objeto: contrato.getString('objeto'),
      valor_total: contrato.getFloat('valor_total'),
      prazo_dias: contrato.getInt('prazo_dias'),
      nota_prazo: contrato.getString('nota_prazo'),
      clausulas_texto: contrato.getString('clausulas_texto'),
      parcelas_json: contrato.get('parcelas_json'),
      status: contrato.getString('status'),
      token_complemento_dados: contrato.getString('token_complemento_dados'),
      campos_faltantes_json: camposFaltantes,
      dados_completados_em: contrato.getString('dados_completados_em'),
      assinante_admin: assinanteAdminId || undefined,
      data_assinatura_admin: contrato.getString('data_assinatura_admin'),
      admin_ip: contrato.getString('admin_ip'),
      admin_user_agent: contrato.getString('admin_user_agent'),
      admin_declaracao: contrato.getBool('admin_declaracao'),
      admin_hash: contrato.getString('admin_hash'),
      token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
      cliente_nome_assinante: contrato.getString('cliente_nome_assinante'),
      cliente_documento_assinante: contrato.getString('cliente_documento_assinante'),
      data_assinatura_cliente: contrato.getString('data_assinatura_cliente'),
      cliente_ip: contrato.getString('cliente_ip'),
      cliente_user_agent: contrato.getString('cliente_user_agent'),
      cliente_declaracao: contrato.getBool('cliente_declaracao'),
      cliente_hash: contrato.getString('cliente_hash'),
      arquivo_pdf_assinado: contrato.getString('arquivo_pdf_assinado'),
      created: contrato.getString('created'),
      updated: contrato.getString('updated'),
      expand: {
        proposta: propostaExpand,
        empresa: empresaExpand,
        cliente_pf: clientePfExpand,
        assinante_admin: assinanteAdminExpand,
      },
    })
  } catch (err) {
    console.log('Erro ao obter contrato por token de assinatura: ' + err)
    return e.json(500, { message: 'Erro interno: ' + err })
  }
})

// Endpoint para Obter Dados do Contrato e Cliente via Token de Complemento (Público, sem login)
routerAdd('GET', '/backend/v1/contratos-servico/obter-por-token-complemento', (e) => {
  try {
    const token = e.request.url.query().get('token')
    if (!token) {
      return e.json(400, { message: 'Token de complemento não informado' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link expirado' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    let tipoCliente = empresaId ? 'pj' : 'pf'

    let dadosCliente = {}
    let representante = { nome: '', documento: '' }

    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        dadosCliente = {
          razao_social: emp.getString('razao_social'),
          nome_fantasia: emp.getString('nome_fantasia'),
          cnpj: emp.getString('cnpj'),
          email: emp.getString('email'),
          telefone: emp.getString('telefone'),
          telefones: emp.get('telefones') || [],
          cep: emp.getString('cep'),
          logradouro: emp.getString('logradouro'),
          numero: emp.getString('numero'),
          complemento: emp.getString('complemento'),
          bairro: emp.getString('bairro'),
          municipio: emp.getString('municipio'),
          uf: emp.getString('uf'),
          porte: emp.getString('porte'),
        }

        const contatos = $app.findRecordsByFilter(
          'contatos',
          "empresa = '" + empresaId + "'",
          '-decisor,-created',
          1,
          0,
        )
        if (contatos.length > 0) {
          representante.nome = contatos[0].getString('nome') || ''
        }
      } catch (_) {}
    } else if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        dadosCliente = {
          nome: pf.getString('nome'),
          cpf: pf.getString('cpf'),
          email: pf.getString('email'),
          telefone: pf.getString('telefone'),
          telefones: pf.get('telefones') || [],
          cep: pf.getString('cep'),
          logradouro: pf.getString('logradouro'),
          numero: pf.getString('numero'),
          complemento: pf.getString('complemento'),
          bairro: pf.getString('bairro'),
          municipio: pf.getString('municipio'),
          uf: pf.getString('uf'),
        }
      } catch (_) {}
    }

    let camposFaltantes = []
    try {
      const cf = contrato.get('campos_faltantes_json')
      if (Array.isArray(cf)) camposFaltantes = cf
    } catch (_) {}

    return e.json(200, {
      success: true,
      contrato: {
        id: contrato.id,
        numero: contrato.getString('numero'),
        objeto: contrato.getString('objeto'),
        valor_total: contrato.getFloat('valor_total'),
        prazo_dias: contrato.getInt('prazo_dias'),
        status: contrato.getString('status'),
        token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
        campos_faltantes: camposFaltantes,
        dados_completados_em: contrato.getString('dados_completados_em'),
      },
      tipo_cliente: tipoCliente,
      dados_cliente: dadosCliente,
      representante: representante,
    })
  } catch (err) {
    console.log('Erro ao obter contrato por token de complemento: ' + err)
    return e.json(500, { message: 'Erro interno: ' + err })
  }
})

// Endpoint para Gravar Complemento de Dados do Cliente (Público, sem login)
routerAdd('POST', '/backend/v1/contratos-servico/complementar-dados', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_complemento_dados

    if (!token) {
      return e.json(400, { message: 'Token de complemento não informado' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_complemento_dados = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou token inválido' })
    }

    const contrato = records[0]
    const empresaId = contrato.getString('empresa')
    const clientePfId = contrato.getString('cliente_pf')
    const isPj = Boolean(empresaId)

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'
    const nowIso = new Date().toISOString()

    const fnClean = (val) => (val || '').toString().replace(/\D/g, '')

    const fnIsValidCpf = (cpfStr) => {
      const clean = fnClean(cpfStr)
      if (!clean || clean.length !== 11) return false
      if (/^(\d)\1{10}$/.test(clean)) return false
      let soma = 0
      for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
      let resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      if (resto !== parseInt(clean.charAt(9), 10)) return false
      soma = 0
      for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
      resto = (soma * 10) % 11
      if (resto === 10 || resto === 11) resto = 0
      if (resto !== parseInt(clean.charAt(10), 10)) return false
      return true
    }

    const fnIsValidCnpj = (cnpjStr) => {
      const clean = fnClean(cnpjStr)
      if (!clean || clean.length !== 14) return false
      if (/^(\d)\1{13}$/.test(clean)) return false
      let soma = 0
      let peso = 5
      for (let i = 0; i < 12; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      let resto = soma % 11
      const dv1 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(12), 10) !== dv1) return false
      soma = 0
      peso = 6
      for (let i = 0; i < 13; i++) {
        soma += parseInt(clean.charAt(i), 10) * peso
        peso = peso === 2 ? 9 : peso - 1
      }
      resto = soma % 11
      const dv2 = resto < 2 ? 0 : 11 - resto
      if (parseInt(clean.charAt(13), 10) !== dv2) return false
      return true
    }

    // Campos submetidos
    const nomeOuRazao = (body.razao_social || body.nome || '').trim()
    const docPrincipal = (body.cnpj || body.cpf || '').trim()
    const email = (body.email || '').trim()
    const telefone = (body.telefone || '').trim()
    const cep = (body.cep || '').trim()
    const logradouro = (body.logradouro || '').trim()
    const numero = (body.numero || '').trim()
    const complemento = (body.complemento || '').trim()
    const bairro = (body.bairro || '').trim()
    const municipio = (body.municipio || '').trim()
    const uf = (body.uf || '').trim().toUpperCase()

    // Validações obrigatórias
    if (!nomeOuRazao) {
      return e.json(400, { message: isPj ? 'Razão social é obrigatória.' : 'Nome é obrigatório.' })
    }
    if (!email || email.indexOf('@') === -1) {
      return e.json(400, { message: 'E-mail válido é obrigatório.' })
    }
    if (!telefone) {
      return e.json(400, { message: 'Telefone com DDD é obrigatório.' })
    }
    if (!cep || fnClean(cep).length < 8) {
      return e.json(400, { message: 'CEP completo de 8 dígitos é obrigatório.' })
    }
    if (!logradouro || !numero || !bairro || !municipio || !uf) {
      return e.json(400, {
        message: 'Endereço completo (logradouro, número, bairro, município e UF) é obrigatório.',
      })
    }

    if (isPj) {
      const cleanCnpj = fnClean(docPrincipal)
      if (!cleanCnpj || !fnIsValidCnpj(cleanCnpj)) {
        return e.json(400, { message: 'CNPJ inválido: confira os dígitos verificadores.' })
      }
      const repNome = (body.representante_nome || '').trim()
      const repDocClean = fnClean(body.representante_documento)
      if (!repNome) {
        return e.json(400, {
          message: 'Nome do representante legal é obrigatório para pessoa jurídica.',
        })
      }
      if (!repDocClean || !fnIsValidCpf(repDocClean)) {
        return e.json(400, { message: 'CPF do representante legal é inválido.' })
      }

      // Atualizar dados da empresa
      const emp = $app.findRecordById('empresas', empresaId)
      emp.set('razao_social', nomeOuRazao)
      emp.set('cnpj', docPrincipal)
      emp.set('email', email)
      emp.set('telefone', telefone)
      emp.set('cep', cep)
      emp.set('logradouro', logradouro)
      emp.set('numero', numero)
      emp.set('complemento', complemento)
      emp.set('bairro', bairro)
      emp.set('municipio', municipio)
      emp.set('uf', uf)
      emp.set('pre_cadastro', false)
      if (body.nome_fantasia) emp.set('nome_fantasia', body.nome_fantasia)
      $app.save(emp)

      // Criar ou atualizar contato do representante legal
      try {
        const contatosEmpresa = $app.findRecordsByFilter(
          'contatos',
          "empresa = '" + empresaId + "'",
          '-decisor,-created',
          1,
          0,
        )
        if (contatosEmpresa.length > 0) {
          const c = contatosEmpresa[0]
          c.set('nome', repNome)
          c.set('cargo', 'Representante Legal / Signatário')
          c.set('telefone', telefone)
          c.set('email', email)
          c.set('decisor', true)
          $app.save(c)
        } else {
          const contatosCol = $app.findCollectionByNameOrId('contatos')
          const novoC = new Record(contatosCol)
          novoC.set('empresa', empresaId)
          novoC.set('nome', repNome)
          novoC.set('cargo', 'Representante Legal / Signatário')
          novoC.set('telefone', telefone)
          novoC.set('email', email)
          novoC.set('decisor', true)
          $app.save(novoC)
        }
      } catch (errContato) {
        console.log('Aviso ao atualizar contato de representante: ' + errContato)
      }

      // Registrar nome sugerido no contrato para signatário
      contrato.set('cliente_nome_assinante', repNome)
      contrato.set('cliente_documento_assinante', body.representante_documento)
    } else {
      const cleanCpf = fnClean(docPrincipal)
      if (!cleanCpf || !fnIsValidCpf(cleanCpf)) {
        return e.json(400, { message: 'CPF inválido: confira os dígitos verificadores.' })
      }

      const pf = $app.findRecordById('clientes_pf', clientePfId)
      pf.set('nome', nomeOuRazao)
      pf.set('cpf', docPrincipal)
      pf.set('email', email)
      pf.set('telefone', telefone)
      pf.set('cep', cep)
      pf.set('logradouro', logradouro)
      pf.set('numero', numero)
      pf.set('complemento', complemento)
      pf.set('bairro', bairro)
      pf.set('municipio', municipio)
      pf.set('uf', uf)
      pf.set('pre_cadastro', false)
      const partes = [
        logradouro,
        numero ? 'nº ' + numero : '',
        complemento,
        bairro,
        municipio + '/' + uf,
        'CEP ' + cep,
      ]
      pf.set('endereco', partes.filter(Boolean).join(', '))
      $app.save(pf)

      contrato.set('cliente_nome_assinante', nomeOuRazao)
      contrato.set('cliente_documento_assinante', docPrincipal)
    }

    // Atualizar Contrato: assegurar token de assinatura do cliente (gerar se inexistente) e transição para 'aguardando_assinatura_admin'
    let tokenAssinaturaCliente = (contrato.getString('token_assinatura_cliente') || '').trim()
    let tokenFoiGeradoAgora = false
    if (!tokenAssinaturaCliente) {
      tokenAssinaturaCliente = $security.randomString(32)
      contrato.set('token_assinatura_cliente', tokenAssinaturaCliente)
      tokenFoiGeradoAgora = true
    }

    contrato.set('status', 'aguardando_assinatura_admin')
    contrato.set('campos_faltantes_json', [])
    contrato.set('dados_completados_em', nowIso)
    $app.save(contrato)

    // Atualizar Proposta marcando dados_complementares_preenchidos = true
    try {
      const propostaId = contrato.getString('proposta')
      if (propostaId) {
        const prop = $app.findRecordById('propostas', propostaId)
        prop.set('dados_complementares_preenchidos', true)
        $app.save(prop)
      }
    } catch (_) {}

    // Auditoria com detalhes do complemento de dados e emissão/atualização de token
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'COMPLEMENTO_DADOS_CLIENTE')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contrato.id)
      aRec.set('detalhes', {
        mensagem:
          'Cliente completou cadastro com sucesso pelo link público. Contrato ' +
          contrato.getString('numero') +
          ' liberado para assinatura da Diretoria G+.' +
          (tokenFoiGeradoAgora
            ? ' Novo token de assinatura do cliente emitido.'
            : ' Token de assinatura do cliente confirmado.'),
        contrato_numero: contrato.getString('numero'),
        tipo_cliente: isPj ? 'PJ' : 'PF',
        cliente_nome: nomeOuRazao,
        documento: docPrincipal,
        ip: clientIp,
        novo_status: 'aguardando_assinatura_admin',
        token_assinatura_cliente_emitido: tokenFoiGeradoAgora,
        token_assinatura_cliente_presente: Boolean(tokenAssinaturaCliente),
        data_conclusao: nowIso,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao auditar complemento de dados: ' + errAudit)
    }

    return e.json(200, {
      success: true,
      message:
        'Cadastro complementado com sucesso! O contrato agora está pronto e aguardando a assinatura da Diretoria G+.',
      contrato_id: contrato.id,
      contrato_numero: contrato.getString('numero'),
      status: 'aguardando_assinatura_admin',
      token_assinatura_cliente: tokenAssinaturaCliente,
      token_complemento_dados: contrato.getString('token_complemento_dados'),
      contrato: {
        id: contrato.id,
        numero: contrato.getString('numero'),
        status: 'aguardando_assinatura_admin',
        token_assinatura_cliente: tokenAssinaturaCliente,
        token_complemento_dados: contrato.getString('token_complemento_dados'),
        valor_total: contrato.getFloat('valor_total'),
        objeto: contrato.getString('objeto'),
        dados_completados_em: nowIso,
      },
    })
  } catch (err) {
    console.log('Erro ao salvar complemento de dados: ' + err)
    return e.json(500, { message: 'Erro interno ao processar dados: ' + err })
  }
})

// Endpoint para Assinatura do Cliente no Contrato de Serviço
routerAdd('POST', '/backend/v1/contratos-servico/assinar-cliente', (e) => {
  function ativarContratoServicoBilateral(rec) {
    const contratoId = rec.id
    const contratoNumero = rec.getString('numero')
    const propostaId = rec.getString('proposta')
    const empresaId = rec.getString('empresa')
    const clientePfId = rec.getString('cliente_pf')
    const valorTotalContrato = rec.getFloat('valor_total') || 0
    const objetoContrato = rec.getString('objeto') || 'Prestação de serviços técnicos de engenharia'

    let propostaRec = null
    let propostaNumero = ''
    let condicoesPagamento = 'Conforme contrato assinado'
    let requerNotaProposta = false
    let aliquotaImpostos = 0

    if (propostaId) {
      try {
        propostaRec = $app.findRecordById('propostas', propostaId)
        if (propostaRec) {
          propostaNumero = propostaRec.getString('numero')
          condicoesPagamento = propostaRec.getString('condicoes_pagamento') || condicoesPagamento
          requerNotaProposta = propostaRec.getBool('requer_nota')
          aliquotaImpostos = propostaRec.getInt('impostos') || 0
        }
      } catch (errProp) {
        console.log('Erro ao buscar proposta vinculada ' + propostaId + ': ' + errProp)
      }
    }

    let nomeCliente = 'Cliente'
    if (empresaId) {
      try {
        const emp = $app.findRecordById('empresas', empresaId)
        if (emp) nomeCliente = emp.getString('razao_social')
      } catch (_) {}
    } else if (clientePfId) {
      try {
        const pf = $app.findRecordById('clientes_pf', clientePfId)
        if (pf) nomeCliente = pf.getString('nome')
      } catch (_) {}
    }

    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const projetosCol = $app.findCollectionByNameOrId('projetos')
    const gruposCol = $app.findCollectionByNameOrId('grupos_projetos')
    const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')
    const contasCol = $app.findCollectionByNameOrId('contas')

    // 1. CRIAR OU RECUPERAR GRUPO DE PROJETOS (Trava 1:1)
    let grupoCriado = null
    try {
      const gruposExistentes = $app.findRecordsByFilter(
        'grupos_projetos',
        "contrato_servico = '" + contratoId + "'",
        '-created',
        1,
        0,
      )
      if (gruposExistentes.length > 0) {
        grupoCriado = gruposExistentes[0]
      } else {
        const anoAtual = new Date().getFullYear()
        const prefixoGPR = 'GPR-' + anoAtual + '-'
        const gruposDoAno = $app.findRecordsByFilter(
          'grupos_projetos',
          "codigo ~ '" + prefixoGPR + "'",
          '-codigo',
          1,
          0,
        )

        let proximoSeqGpr = 1
        if (gruposDoAno.length > 0) {
          const ultimoCodigo = gruposDoAno[0].getString('codigo')
          const partes = ultimoCodigo.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeqGpr = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeqGpr).slice(-4)
        const codigoGPR = prefixoGPR + seqStr

        const novoGrupo = new Record(gruposCol)
        novoGrupo.set('codigo', codigoGPR)
        novoGrupo.set('contrato_servico', contratoId)
        if (propostaId) novoGrupo.set('proposta', propostaId)
        if (empresaId) novoGrupo.set('empresa', empresaId)
        if (clientePfId) novoGrupo.set('cliente_pf', clientePfId)
        novoGrupo.set('nome', 'Grupo: ' + contratoNumero + ' — ' + nomeCliente)
        novoGrupo.set('descricao', objetoContrato)
        novoGrupo.set('status', 'ativo')
        novoGrupo.set('valor_total', valorTotalContrato)

        $app.save(novoGrupo)
        grupoCriado = novoGrupo

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'CRIACAO_GRUPO_PROJETOS')
          aRec.set('entidade', 'grupos_projetos')
          aRec.set('registro_id', novoGrupo.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Grupo de projetos ' +
              codigoGPR +
              ' criado pela assinatura bilateral do Contrato ' +
              contratoNumero,
            codigo: codigoGPR,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            proposta_id: propostaId,
            proposta_numero: propostaNumero,
            valor_total: valorTotalContrato,
          })
          $app.save(aRec)
        } catch (_) {}
      }
    } catch (errGrupo) {
      console.log('Erro ao criar grupo de projetos: ' + errGrupo)
    }

    // Trava de idempotência atômica: se já existirem projetos ativos vinculados a este contrato, não recriar
    const projetosJaCriados = $app.findRecordsByFilter(
      'projetos',
      "contrato_servico = '" + contratoId + "'",
      'codigo',
      100,
      0,
    )
    if (projetosJaCriados.length > 0) {
      for (let pIdx = 0; pIdx < projetosJaCriados.length; pIdx++) {
        const prjExistente = projetosJaCriados[pIdx]
        let prjModificado = false
        if (grupoCriado && prjExistente.getString('grupo') !== grupoCriado.id) {
          prjExistente.set('grupo', grupoCriado.id)
          prjModificado = true
        }
        if (clientePfId && prjExistente.getString('cliente_pf') !== clientePfId) {
          prjExistente.set('cliente_pf', clientePfId)
          prjModificado = true
        }
        if (empresaId && prjExistente.getString('empresa') !== empresaId) {
          prjExistente.set('empresa', empresaId)
          prjModificado = true
        }
        const st = prjExistente.getString('status')
        if (st === 'contratacao' || st === 'Em Contratação' || !st) {
          prjExistente.set('status', 'aguardando_definicao')
          prjExistente.set('modo_execucao', null)
          prjModificado = true
        }
        if (prjModificado) {
          $app.save(prjExistente)
        }
      }
      return
    }

    // 2. ITENS DE ESCOPO (Apenas itens reais do catálogo ou com serviço/descrição válida)
    let itensEscopo = []
    if (propostaId) {
      try {
        const itensDb = $app.findRecordsByFilter(
          'proposta_itens',
          "proposta = '" + propostaId + "'",
          'ordem,created',
          200,
          0,
        )
        if (itensDb.length > 0) {
          itensEscopo = itensDb
            .filter((it) => {
              const desc = (it.getString('descricao') || '').trim()
              const serv = it.getString('servico') || ''
              return (serv !== '' || desc.length > 0) && !desc.startsWith('Item de Escopo ')
            })
            .map((it) => ({
              id: it.id,
              record: it,
              descricao: it.getString('descricao'),
              disciplina: it.getString('disciplina') || 'Geral',
              area: it.getString('area'),
              valor: it.getFloat('preco_total') || 0,
              custo: it.getFloat('custo_total') || 0,
              subservicos: it.get('subservicos') || [],
            }))
        }
      } catch (_) {}

      if (itensEscopo.length === 0 && propostaRec) {
        try {
          const rawJsonStr = propostaRec.getString('itens_json')
          let parsedItens = []
          if (rawJsonStr && rawJsonStr.trim()) {
            const parsed = JSON.parse(rawJsonStr)
            if (Array.isArray(parsed)) {
              parsedItens = parsed
            }
          }
          if (parsedItens.length > 0) {
            itensEscopo = parsedItens
              .filter((it) => {
                const desc = typeof it.descricao === 'string' ? it.descricao.trim() : ''
                const temServico = Boolean(it.servico || it.catalogo_servico)
                const descValida = desc.length > 0 && !desc.startsWith('Item de Escopo ')
                return temServico || descValida
              })
              .map((it) => ({
                id: null,
                record: null,
                descricao: (it.descricao || '').trim() || objetoContrato,
                disciplina: it.disciplina || 'Geral',
                area: it.area || '',
                valor: Number(it.preco_total) || 0,
                custo: Number(it.custo_total) || 0,
                subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
              }))
          }
        } catch (errJson) {
          console.log('Erro ao analisar itens_json canônico: ' + errJson)
        }
      }
    }

    if (itensEscopo.length === 0) {
      itensEscopo = [
        {
          id: null,
          record: null,
          descricao: objetoContrato,
          disciplina: propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
          area: '',
          valor: valorTotalContrato,
          custo: 0,
          subservicos: [],
        },
      ]
    }

    const somaItens = itensEscopo.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
    if (somaItens === 0 && valorTotalContrato > 0) {
      const valorPorItem = Math.round((valorTotalContrato / itensEscopo.length) * 100) / 100
      for (let idx = 0; idx < itensEscopo.length; idx++) {
        itensEscopo[idx].valor =
          idx === itensEscopo.length - 1
            ? Math.round((valorTotalContrato - valorPorItem * (itensEscopo.length - 1)) * 100) / 100
            : valorPorItem
      }
    }

    // 3. PROJETOS POR ITEM DE ESCOPO
    let projetosExistentesContrato = []
    try {
      projetosExistentesContrato = $app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" +
          contratoId +
          "' || (proposta = '" +
          propostaId +
          "' && grupo = '')",
        'codigo',
        100,
        0,
      )
    } catch (_) {}

    const anoAtualPrj = new Date().getFullYear()
    const prefixoPRJ = 'PRJ-' + anoAtualPrj + '-'
    let proximoSeqPrj = 1
    try {
      const projetosDoAno = $app.findRecordsByFilter(
        'projetos',
        "codigo ~ '" + prefixoPRJ + "'",
        '-codigo',
        1,
        0,
      )
      if (projetosDoAno.length > 0) {
        const ult = projetosDoAno[0].getString('codigo')
        const partes = ult.split('-')
        const num = parseInt(partes[2], 10)
        if (!isNaN(num)) proximoSeqPrj = num + 1
      }
    } catch (_) {}

    const projetosGerados = []

    for (let i = 0; i < itensEscopo.length; i++) {
      const item = itensEscopo[i]
      let prjParaItem = null

      if (i < projetosExistentesContrato.length) {
        prjParaItem = projetosExistentesContrato[i]
      }

      if (prjParaItem) {
        let prjAlterado = false
        if (grupoCriado && prjParaItem.getString('grupo') !== grupoCriado.id) {
          prjParaItem.set('grupo', grupoCriado.id)
          prjAlterado = true
        }
        if (prjParaItem.getString('contrato_servico') !== contratoId) {
          prjParaItem.set('contrato_servico', contratoId)
          prjAlterado = true
        }
        if (clientePfId && prjParaItem.getString('cliente_pf') !== clientePfId) {
          prjParaItem.set('cliente_pf', clientePfId)
          prjAlterado = true
        }
        if (empresaId && prjParaItem.getString('empresa') !== empresaId) {
          prjParaItem.set('empresa', empresaId)
          prjAlterado = true
        }

        if (itensEscopo.length > 1) {
          prjParaItem.set(
            'nome',
            'Projeto ' +
              (i + 1) +
              '/' +
              itensEscopo.length +
              ': ' +
              item.descricao +
              ' — ' +
              nomeCliente,
          )
          prjParaItem.set('descricao', item.descricao)
          prjParaItem.set('valor_total', item.valor)
          prjParaItem.set('disciplinas', item.disciplina)
          prjAlterado = true
        } else {
          prjParaItem.set('valor_total', item.valor || valorTotalContrato)
          prjAlterado = true
        }

        if (!prjParaItem.getString('prazo_final')) {
          try {
            const pDiasContrato = rec.getInt('prazo_dias') || 30
            const dtBaseAssinatura =
              rec.getString('data_assinatura_cliente') ||
              rec.getString('data_assinatura_admin') ||
              new Date().toISOString()
            const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
            dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
            prjParaItem.set(
              'prazo_final',
              dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
            )
            prjAlterado = true
          } catch (_) {}
        }

        const statusAtual = prjParaItem.getString('status')
        if (statusAtual === 'contratacao' || statusAtual === 'Em Contratação' || !statusAtual) {
          prjParaItem.set('status', 'aguardando_definicao')
          prjParaItem.set('modo_execucao', null)
          prjAlterado = true
        }

        if (prjAlterado) {
          $app.save(prjParaItem)
        }
      } else {
        const seqStr = ('0000' + proximoSeqPrj).slice(-4)
        const codigoPRJ = prefixoPRJ + seqStr
        proximoSeqPrj++

        const novoPrj = new Record(projetosCol)
        novoPrj.set('codigo', codigoPRJ)
        novoPrj.set(
          'nome',
          itensEscopo.length > 1
            ? 'Projeto ' +
                (i + 1) +
                '/' +
                itensEscopo.length +
                ': ' +
                item.descricao +
                ' — ' +
                nomeCliente
            : 'Projeto: ' + contratoNumero + ' — ' + nomeCliente,
        )
        novoPrj.set('descricao', item.descricao)
        if (propostaId) novoPrj.set('proposta', propostaId)
        novoPrj.set('contrato_servico', contratoId)
        if (grupoCriado) novoPrj.set('grupo', grupoCriado.id)
        if (empresaId) novoPrj.set('empresa', empresaId)
        if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
        novoPrj.set('valor_total', item.valor)
        novoPrj.set('subcontratacao_autorizada', true)
        novoPrj.set('saude', 'verde')
        novoPrj.set('status', 'aguardando_definicao')
        novoPrj.set('modo_execucao', null)
        novoPrj.set('disciplinas', item.disciplina)

        // Prazo final do projeto PRJ criado = data_assinatura + prazo_dias
        try {
          const pDiasContrato = rec.getInt('prazo_dias') || 30
          const dtBaseAssinatura =
            rec.getString('data_assinatura_cliente') ||
            rec.getString('data_assinatura_admin') ||
            new Date().toISOString()
          const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
          dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
          novoPrj.set(
            'prazo_final',
            dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
          )
        } catch (_) {}

        $app.save(novoPrj)
        prjParaItem = novoPrj

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'CRIACAO_PROJETO_ITEM_ESCOPO')
          aRec.set('entidade', 'projetos')
          aRec.set('registro_id', novoPrj.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Projeto ' +
              codigoPRJ +
              ' criado para o item de escopo "' +
              item.descricao +
              '" do Contrato ' +
              contratoNumero,
            codigo: codigoPRJ,
            grupo_id: grupoCriado ? grupoCriado.id : null,
            grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
            contrato_id: contratoId,
            contrato_numero: contratoNumero,
            item_descricao: item.descricao,
            item_valor: item.valor,
          })
          $app.save(aRec)
        } catch (_) {}
      }

      projetosGerados.push(prjParaItem)

      if (item.record) {
        try {
          item.record.set('status_conversao', 'convertido')
          item.record.set('projeto_gerado', prjParaItem.id)
          $app.save(item.record)
        } catch (_) {}
      }

      // 4. ETAPAS E ENTREGÁVEIS
      try {
        const etapasExistentes = $app.findRecordsByFilter(
          'projeto_etapas',
          "projeto = '" + prjParaItem.id + "'",
          'ordem',
          1,
          0,
        )

        if (etapasExistentes.length === 0) {
          let areaNome = item.disciplina || 'Geral'
          if (item.area) {
            try {
              const areaRec = $app.findRecordById('areas_atuacao', item.area)
              if (areaRec) areaNome = areaRec.getString('nome')
            } catch (_) {}
          }

          const novaEtapa = new Record(etapasCol)
          novaEtapa.set('projeto', prjParaItem.id)
          novaEtapa.set('nome', 'Pacote: ' + (areaNome || item.descricao))
          novaEtapa.set('disciplina', item.disciplina || 'Geral')
          novaEtapa.set('ordem', 1)
          novaEtapa.set('tipo_execucao', 'direta')
          novaEtapa.set('status', 'atribuido')
          novaEtapa.set('custo_estimado', item.custo || 0)
          novaEtapa.set('is_pacote_trabalho', true)
          novaEtapa.set('is_marco', false)
          novaEtapa.set('valor_interno_referencia', item.custo || 0)
          novaEtapa.set('valor_vendido', item.valor || 0)
          novaEtapa.set('escopo_detalhado', item.descricao || '')
          if (item.id) {
            novaEtapa.set('proposta_item_origem', item.id)
          }

          let desc = 'Subserviços contemplados: '
          if (Array.isArray(item.subservicos) && item.subservicos.length > 0) {
            desc += item.subservicos.join(', ')
          } else {
            desc += 'Serviços técnicos de ' + item.disciplina
          }
          desc += '.\nItem do escopo: ' + item.descricao
          novaEtapa.set('descricao', desc)

          if (item.area) {
            novaEtapa.set('area', item.area)
          }

          // Prazo de referência do pacote (baseado no prazo do contrato ou 30 dias)
          const prazoDiasContrato = rec.getInt('prazo_dias') || 30
          const dtPrazoPacote = new Date()
          dtPrazoPacote.setDate(dtPrazoPacote.getDate() + prazoDiasContrato)
          novaEtapa.set('prazo', dtPrazoPacote.toISOString().substring(0, 10) + ' 12:00:00.000Z')

          $app.save(novaEtapa)

          if (item.record) {
            try {
              item.record.set('etapa_gerada', novaEtapa.id)
              $app.save(item.record)
            } catch (_) {}
          }

          // Buscar entregáveis baseados no catálogo de escopos da disciplina
          let entregaveisDoEscopo = []
          try {
            const escoposFiltro = $app.findRecordsByFilter(
              'catalogo_escopos',
              "disciplina = '" +
                (item.disciplina || '').replace(/'/g, "''") +
                "' || nome = '" +
                (areaNome || '').replace(/'/g, "''") +
                "'",
              '',
              1,
              0,
            )
            if (escoposFiltro.length > 0) {
              const escopoRec = escoposFiltro[0]
              const pdr = escopoRec.get('entregaveis_padrao')
              if (Array.isArray(pdr)) {
                entregaveisDoEscopo = pdr
              }
            }
          } catch (_) {}

          if (entregaveisDoEscopo.length === 0 && item.area) {
            try {
              const entregaveisAreaDb = $app.findRecordsByFilter(
                'entregaveis_padrao',
                "area = '" + item.area + "' && ativo = true",
                'ordem',
                30,
                0,
              )
              for (let ep = 0; ep < entregaveisAreaDb.length; ep++) {
                entregaveisDoEscopo.push({
                  nome: entregaveisAreaDb[ep].getString('nome'),
                  descricao: entregaveisAreaDb[ep].getString('descricao'),
                })
              }
            } catch (_) {}
          }

          if (entregaveisDoEscopo.length === 0) {
            entregaveisDoEscopo = [
              {
                nome: 'Relatório e Memorial de ' + (item.disciplina || 'Engenharia'),
                descricao: 'Memorial técnico descritivo e memória de cálculo',
              },
              {
                nome: 'Pranchas e Desenhos Técnicos',
                descricao: 'Plantas, cortes, detalhes e arquivos executivos',
              },
              {
                nome: 'Anotação de Responsabilidade Técnica (ART/RRT)',
                descricao: 'Registro de responsabilidade técnica perante o conselho de classe',
              },
            ]
          }

          for (let ep = 0; ep < entregaveisDoEscopo.length; ep++) {
            try {
              const entNome = entregaveisDoEscopo[ep].nome || 'Entregável ' + (ep + 1)
              const entDesc =
                entregaveisDoEscopo[ep].descricao ||
                'Entregável técnico da disciplina ' + item.disciplina
              const novoEntregavel = new Record(entregaveisCol)
              novoEntregavel.set('etapa', novaEtapa.id)
              novoEntregavel.set('nome', entNome)
              novoEntregavel.set('titulo', entNome)
              novoEntregavel.set('versao', 'v1.0')
              novoEntregavel.set('versao_atual', 1)
              novoEntregavel.set('status', 'atribuido')
              novoEntregavel.set('descricao', entDesc)
              novoEntregavel.set(
                'prazo',
                dtPrazoPacote.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )
              $app.save(novoEntregavel)
            } catch (errNovoEnt) {
              console.log('Erro ao criar entregável para etapa: ' + errNovoEnt)
            }
          }
        }
      } catch (errEtapaPrj) {
        console.log('Erro ao criar etapas para o projeto do item: ' + errEtapaPrj)
      }
    }

    if (projetosGerados.length > 0) {
      try {
        rec.set('projeto', projetosGerados[0].id)
        $app.save(rec)
      } catch (_) {}
    }

    // 5. CONTAS A RECEBER
    try {
      const projetoRefId = projetosGerados.length > 0 ? projetosGerados[0].id : null
      let filtroContas =
        "tipo = 'receber' && (contrato_servico = '" +
        contratoId +
        "' || descricao ~ 'Contrato " +
        contratoNumero +
        "'"
      if (propostaId) {
        filtroContas += " || proposta = '" + propostaId + "'"
      }
      filtroContas += ')'
      const contasExistentes = $app.findRecordsByFilter('contas', filtroContas, '-created', 1, 0)

      if (contasExistentes.length === 0) {
        let parcelas = []
        // Prioridade L1: parcelas_json do próprio contrato
        try {
          const rawParcelasJson = rec.get('parcelas_json')
          if (Array.isArray(rawParcelasJson) && rawParcelasJson.length > 0) {
            parcelas = rawParcelasJson.map((p, idx) => ({
              id: 'json_' + (idx + 1),
              ordem: p.ordem || idx + 1,
              percentual: Number(p.percentual) || 0,
              valor: Number(p.valor) || (valorTotalContrato * (Number(p.percentual) || 0)) / 100,
              descricao:
                p.descricao || 'Parcela ' + (p.ordem || idx + 1) + '/' + rawParcelasJson.length,
              gatilho: p.gatilho || 'marco',
              dias_vencimento: p.dias_vencimento || (idx === 0 ? 15 : (idx + 1) * 30),
            }))
          }
        } catch (_) {}

        // Fallback: proposta_parcelas apenas se parcelas_json vazio
        if (parcelas.length === 0 && propostaId) {
          try {
            const parcsDb = $app.findRecordsByFilter(
              'proposta_parcelas',
              "proposta = '" + propostaId + "'",
              'ordem',
              50,
              0,
            )
            if (parcsDb && parcsDb.length > 0) {
              parcelas = parcsDb.map((p, idx) => ({
                id: p.id,
                ordem: p.getInt('ordem') || idx + 1,
                percentual: p.getFloat('percentual') || 0,
                valor:
                  p.getFloat('valor') ||
                  (valorTotalContrato * (p.getFloat('percentual') || 0)) / 100,
                descricao:
                  p.getString('descricao') ||
                  'Parcela ' + (p.getInt('ordem') || idx + 1) + '/' + parcsDb.length,
                gatilho: p.getString('gatilho') || 'marco',
                dias_vencimento: idx === 0 ? 15 : (idx + 1) * 30,
              }))
            }
          } catch (_) {}
        }

        if (parcelas && parcelas.length > 0) {
          for (let i = 0; i < parcelas.length; i++) {
            const parc = parcelas[i]
            const ordem =
              typeof parc.ordem === 'number'
                ? parc.ordem
                : parc.getInt
                  ? parc.getInt('ordem')
                  : i + 1
            const perc =
              typeof parc.percentual === 'number'
                ? parc.percentual
                : parc.getFloat
                  ? parc.getFloat('percentual')
                  : 0
            const valorParc =
              typeof parc.valor === 'number'
                ? parc.valor
                : parc.getFloat
                  ? parc.getFloat('valor')
                  : (valorTotalContrato * perc) / 100
            const descParc =
              typeof parc.descricao === 'string'
                ? parc.descricao
                : parc.getString
                  ? parc.getString('descricao')
                  : 'Parcela ' + ordem + '/' + parcelas.length
            const gatilho =
              typeof parc.gatilho === 'string'
                ? parc.gatilho
                : parc.getString
                  ? parc.getString('gatilho')
                  : 'marco'

            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoRefId) novaConta.set('projeto', projetoRefId)
            if (propostaId) novaConta.set('proposta', propostaId)
            if (contratoId) novaConta.set('contrato_servico', contratoId)
            novaConta.set(
              'descricao',
              'Contrato ' +
                contratoNumero +
                ' — Parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ' (' +
                perc +
                '% - ' +
                descParc +
                ')' +
                (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorParc)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNotaProposta && aliquotaImpostos > 0) {
              const retencao =
                Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorParc)
            }

            const diasVenc = i === 0 ? 15 : (i + 1) * 30
            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + diasVenc)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaConta)

            try {
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Conta a receber da parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' gerada por assinatura do Contrato ' +
                  contratoNumero,
                ordem: ordem,
                percentual: perc,
                valor: valorParc,
                gatilho: gatilho,
                projeto_id: projetoRefId,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}

            // REQUISITO 2: Gerar um MARCO por cada parcela no projeto principal (idempotente)
            if (projetoRefId) {
              try {
                const marcosExistentes = $app.findRecordsByFilter(
                  'projeto_etapas',
                  "projeto = '" + projetoRefId + "' && parcela_origem = '" + parc.id + "'",
                  '',
                  1,
                  0,
                )
                if (marcosExistentes.length === 0) {
                  const marcoEtapa = new Record(etapasCol)
                  marcoEtapa.set('projeto', projetoRefId)
                  marcoEtapa.set(
                    'nome',
                    'Marco Financeiro: Parcela ' + ordem + ' (' + descParc + ')',
                  )
                  marcoEtapa.set('disciplina', 'Marco Financeiro')
                  marcoEtapa.set('ordem', 100 + ordem)
                  marcoEtapa.set('tipo_execucao', 'direta')
                  marcoEtapa.set('status', 'nao_iniciada')
                  marcoEtapa.set('is_marco', true)
                  marcoEtapa.set('is_pacote_trabalho', false)
                  marcoEtapa.set('valor_vendido', valorParc)
                  marcoEtapa.set('valor_interno_referencia', valorParc)
                  marcoEtapa.set('parcela_origem', parc.id)
                  marcoEtapa.set(
                    'prazo',
                    dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                  )
                  marcoEtapa.set(
                    'descricao',
                    'Marco vinculado à parcela ' +
                      ordem +
                      ' do Contrato ' +
                      contratoNumero +
                      '. Gatilho: ' +
                      gatilho,
                  )
                  $app.save(marcoEtapa)
                }
              } catch (eMarco) {
                console.log('Erro ao criar marco da parcela ' + ordem + ': ' + eMarco)
              }
            }
          }
        } else {
          const novaConta = new Record(contasCol)
          novaConta.set('tipo', 'receber')
          if (projetoRefId) novaConta.set('projeto', projetoRefId)
          if (propostaId) novaConta.set('proposta', propostaId)
          if (contratoId) novaConta.set('contrato_servico', contratoId)
          novaConta.set(
            'descricao',
            'Recebimento integral do Contrato Assinado ' +
              contratoNumero +
              (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
          )
          novaConta.set('valor', valorTotalContrato)
          novaConta.set('status', 'rascunho')
          novaConta.set('forma_pagamento', condicoesPagamento)
          novaConta.set('bloqueada_por_fechamento', false)

          if (requerNotaProposta && aliquotaImpostos > 0) {
            const retencao =
              Math.round(
                ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
              ) / 100
            novaConta.set('retencao_impostos', retencao)
            novaConta.set('valor_liquido', Math.round((valorTotalContrato - retencao) * 100) / 100)
          } else {
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorTotalContrato)
          }

          const dataVenc = new Date()
          dataVenc.setDate(dataVenc.getDate() + 30)
          novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

          $app.save(novaConta)

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
            aRec.set('entidade', 'contas')
            aRec.set('registro_id', novaConta.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
              valor: valorTotalContrato,
              projeto_id: projetoRefId,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (errContas) {
      console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
    }

    // Auditoria geral Bloco 4
    try {
      const aRec = new Record(auditCol)
      aRec.set('user', null)
      aRec.set('user_email', 'SISTEMA')
      aRec.set('acao', 'ATIVACAO_BLOCO4_CONTRATO_ASSINADO')
      aRec.set('entidade', 'contratos_servico')
      aRec.set('registro_id', contratoId)
      aRec.set('detalhes', {
        origem: 'SISTEMA / GATILHO AUTOMÁTICO',
        mensagem:
          'Contrato ' +
          contratoNumero +
          ' assinado bilateralmente. 1 Grupo de Projetos (' +
          (grupoCriado ? grupoCriado.getString('codigo') : 'GPR') +
          ') e ' +
          projetosGerados.length +
          ' projeto(s) gerado(s) com sucesso.',
        contrato_numero: contratoNumero,
        grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
        total_projetos: projetosGerados.length,
        codigos_projetos: projetosGerados.map((p) => p.getString('codigo')),
        valor_total: valorTotalContrato,
      })
      $app.save(aRec)
    } catch (_) {}

    // Atualização do status da proposta para "convertida_em_projeto"
    if (propostaId) {
      try {
        const propToUpdate = $app.findRecordById('propostas', propostaId)
        if (propToUpdate) {
          const stAnt = propToUpdate.getString('status')
          if (stAnt !== 'convertida_em_projeto') {
            propToUpdate.set('status', 'convertida_em_projeto')
            $app.save(propToUpdate)

            try {
              const aRecProp = new Record(auditCol)
              aRecProp.set('user', null)
              aRecProp.set('user_email', 'SISTEMA')
              aRecProp.set('acao', 'PROPOSTA_CONVERTIDA_EM_PROJETO')
              aRecProp.set('entidade', 'propostas')
              aRecProp.set('registro_id', propostaId)
              aRecProp.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Proposta ' +
                  propostaNumero +
                  ' convertida em projeto após assinatura bilateral do Contrato ' +
                  contratoNumero,
                status_anterior: stAnt,
                novo_status: 'convertida_em_projeto',
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
                total_projetos: projetosGerados.length,
              })
              $app.save(aRecProp)
            } catch (_) {}
          }
        }
      } catch (errPropUpdate) {
        console.log(
          'Erro ao atualizar status da proposta para convertida_em_projeto: ' + errPropUpdate,
        )
      }
    }

    // Promoção
    if (empresaId) {
      try {
        const empresa = $app.findRecordById('empresas', empresaId)
        if (empresa) {
          const etapaAtual = empresa.getString('etapa_funil')
          const eraPreCadastro = empresa.getBool('pre_cadastro')

          let houveMudanca = false
          if (eraPreCadastro) {
            empresa.set('pre_cadastro', false)
            houveMudanca = true
          }

          if (etapaAtual !== 'parceira') {
            empresa.set('etapa_anterior', etapaAtual)
            empresa.set('etapa_funil', 'parceira')
            empresa.set('status', 'ativa')
            houveMudanca = true
          }

          if (houveMudanca) {
            empresa.set(
              'observacoes',
              (empresa.getString('observacoes') || '') +
                '\n[Efetivação por Contrato Assinado]: Contrato ' +
                contratoNumero +
                ' assinado em ' +
                new Date().toISOString() +
                (eraPreCadastro ? ' (pré-cadastro promovido a definitivo)' : ''),
            )
            $app.save(empresa)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CONVERSAO_PARCEIRO')
              aRec.set('entidade', 'empresas')
              aRec.set('registro_id', empresaId)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Empresa convertida para Parceira pela assinatura do Contrato ' + contratoNumero,
                contrato_numero: contratoNumero,
                proposta_numero: propostaNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (errEmp) {
        console.log('Erro ao converter empresa em parceira por contrato: ' + errEmp)
      }
    }

    if (clientePfId) {
      try {
        const clientePf = $app.findRecordById('clientes_pf', clientePfId)
        if (clientePf && clientePf.getBool('pre_cadastro')) {
          clientePf.set('pre_cadastro', false)
          clientePf.set(
            'observacoes',
            (clientePf.getString('observacoes') || '') +
              '\n[Efetivação por Contrato Assinado]: Contrato ' +
              contratoNumero +
              ' assinado em ' +
              new Date().toISOString() +
              ' (promovido a cliente definitivo)',
          )
          $app.save(clientePf)

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'PROMOCAO_CLIENTE_CONTRATO')
            aRec.set('entidade', 'clientes_pf')
            aRec.set('registro_id', clientePfId)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              tipo: 'pf',
              mensagem:
                'Cliente PF promovido de pré-cadastro a definitivo pela assinatura do Contrato ' +
                contratoNumero,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errPf) {
        console.log('Erro ao promover cliente PF por contrato: ' + errPf)
      }
    }
  }

  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_assinatura_cliente
    const declaracao = body.declaracao === true
    const nomeAssinante = (body.nome_assinante || '').trim()
    const documentoAssinante = (body.documento_assinante || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token de assinatura não informado' })
    }
    if (!declaracao) {
      return e.json(400, { message: 'A declaração de concordância com o contrato é obrigatória.' })
    }
    if (!nomeAssinante || !documentoAssinante) {
      return e.json(400, { message: 'Nome e CPF do signatário são obrigatórios.' })
    }

    const records = $app.findRecordsByFilter(
      'contratos_servico',
      "token_assinatura_cliente = '" + token + "'",
      '-created',
      1,
      0,
    )

    if (records.length === 0) {
      return e.json(404, { message: 'Contrato não encontrado ou link inválido' })
    }

    const contrato = records[0]

    // BLOQUEIO SERVER-SIDE DO BLOCO 3:
    // Se o cadastro estiver incompleto (status 'aguardando_dados_cliente'), o cliente NÃO pode assinar
    if (contrato.getString('status') === 'aguardando_dados_cliente') {
      return e.json(403, {
        message:
          'Não é possível assinar o contrato enquanto houver pendências nos dados cadastrais. Por favor, complete as informações solicitadas.',
        cadastro_incompleto: true,
        token_complemento_dados: contrato.getString('token_complemento_dados'),
      })
    }

    if (contrato.getString('data_assinatura_cliente')) {
      return e.json(409, {
        success: false,
        message: 'Este contrato já foi assinado anteriormente pelo cliente.',
        data_assinatura_cliente: contrato.getString('data_assinatura_cliente'),
        contrato_id: contrato.id,
      })
    }

    // Validação de Código OTP de 6 dígitos se exigido ou enviado
    const codigoEnviado = (body.codigo_otp || body.codigo || '').trim()
    const codigoHashEsperado = contrato.getString('codigo_verificacao_hash')

    if (codigoHashEsperado) {
      if (!codigoEnviado) {
        return e.json(400, {
          message:
            'Código de verificação OTP de 6 dígitos é obrigatório para confirmar a assinatura.',
        })
      }

      let tentativas = contrato.getInt('codigo_tentativas') || 0
      if (tentativas >= 5) {
        return e.json(403, {
          message:
            'Limite de 5 tentativas de validação excedido. Solicite um novo código de verificação para continuar.',
        })
      }

      const expiraEmStr = contrato.getString('codigo_expiracao')
      if (expiraEmStr) {
        const expiraEmDate = new Date(expiraEmStr).getTime()
        if (Date.now() > expiraEmDate) {
          return e.json(400, {
            message:
              'Código de verificação expirado (validade de 10 minutos). Solicite um novo código.',
          })
        }
      }

      const hashEnviado = $security.sha256(codigoEnviado)
      if (hashEnviado !== codigoHashEsperado) {
        tentativas += 1
        contrato.set('codigo_tentativas', tentativas)
        $app.save(contrato)
        return e.json(400, {
          message:
            'Código de verificação incorreto. Tentativa ' +
            tentativas +
            ' de 5' +
            (tentativas >= 5 ? ' (bloqueado por segurança).' : '.'),
        })
      }
    }

    // Captura de IP: ler x-forwarded-for e depois x-real-ip na entrada; se vazio, 'nao_capturado' (NUNCA 127.0.0.1) e registrar em erros_sistema
    let rawIp = ''
    try {
      if (e.request && e.request.header && typeof e.request.header.get === 'function') {
        rawIp = e.request.header.get('x-forwarded-for') || e.request.header.get('x-real-ip') || ''
      }
      if (!rawIp && e.request && typeof e.request.getHeader === 'function') {
        rawIp = e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip') || ''
      }
      if (!rawIp && reqInfo.headers) {
        rawIp = reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || ''
      }
    } catch (_) {}

    if (rawIp && typeof rawIp === 'string') {
      rawIp = rawIp.split(',')[0].trim()
    }

    let clientIp = rawIp && rawIp !== '127.0.0.1' ? rawIp : 'nao_capturado'
    if (clientIp === 'nao_capturado') {
      try {
        const errCol = $app.findCollectionByNameOrId('erros_sistema')
        if (errCol) {
          const errRec = new Record(errCol)
          errRec.set('rota', '/backend/v1/contratos-servico/assinar-cliente')
          errRec.set(
            'mensagem',
            'IP nao capturado na rota assinar-cliente (headers x-forwarded-for e x-real-ip ausentes ou locais)',
          )
          errRec.set('hora', new Date().toISOString())
          errRec.set('ip', 'nao_capturado')
          errRec.set('detalhes', {
            contrato_id: contrato.id,
            contrato_numero: contrato.getString('numero'),
            raw_ip: rawIp,
          })
          $app.save(errRec)
        }
      } catch (_) {}
    }

    // User Agent: prioriza body.userAgent enviado pelo front; fallback para header
    const clientUserAgent =
      (
        body.userAgent ||
        body.user_agent ||
        (reqInfo.headers && reqInfo.headers['user-agent']) ||
        ''
      ).trim() || 'Navegador Web'
    const nowIso = new Date().toISOString()

    const temOtp = Boolean(codigoHashEsperado)
    let clausulaPadrao = temOtp
      ? 'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como válidas as assinaturas eletrônicas emitidas mediante verificação de código OTP de 6 dígitos enviado por e-mail, registro de endereço IP, user-agent, carimbo de tempo UTC e hash criptográfico SHA-256 do documento congelado.'
      : 'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como prova de autoria, integridade e tempestividade o registro da data e hora da manifestação, o endereço IP de conexão, a identificação do navegador (user agent) e o hash criptográfico SHA-256 gerado no momento do aceite.'
    try {
      const p = $app.findFirstRecordByData(
        'parametros',
        'chave',
        'clausula_assinatura_eletronica_padrao',
      )
      if (p && p.getString('valor')) {
        const textoParam = p.getString('valor')
        if (temOtp) {
          clausulaPadrao = textoParam
        } else {
          // Se o parâmetro do banco contiver menção explícita a OTP, substitui pela redação por clique
          if (/código OTP|código de 6 dígitos/i.test(textoParam)) {
            clausulaPadrao =
              'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como prova de autoria, integridade e tempestividade o registro da data e hora da manifestação, o endereço IP de conexão, a identificação do navegador (user agent) e o hash criptográfico SHA-256 gerado no momento do aceite.'
          } else {
            clausulaPadrao = textoParam
          }
        }
      }
    } catch (_) {}

    const hashPayload =
      contrato.getString('numero') +
      '|' +
      nomeAssinante +
      '|' +
      documentoAssinante +
      '|' +
      clientIp +
      '|' +
      nowIso +
      '|' +
      clausulaPadrao
    const clientHash = $security.sha256(hashPayload)

    const emailUtilizado = contrato.getString('codigo_enviado_para') || ''

    const dossieEvidencias = {
      tipo: 'assinatura_cliente_contrato_otp',
      documento_tipo: 'Contrato de Serviço',
      documento_numero: contrato.getString('numero'),
      documento_id: contrato.id,
      data_aceite_utc: nowIso,
      ip_origem: clientIp,
      user_agent: clientUserAgent,
      email_utilizado: emailUtilizado,
      assinante_nome: nomeAssinante,
      assinante_documento: documentoAssinante,
      pdf_congelado_hash: clientHash,
      versao_texto_hash: clientHash,
      clausula_assinatura: clausulaPadrao,
      tentativas_utilizadas: contrato.getInt('codigo_tentativas') || 0,
      validacao_otp_concluida: !!codigoHashEsperado,
    }

    contrato.set('cliente_nome_assinante', nomeAssinante)
    contrato.set('cliente_documento_assinante', documentoAssinante)
    contrato.set('data_assinatura_cliente', nowIso)
    contrato.set('cliente_ip', clientIp)
    contrato.set('cliente_user_agent', clientUserAgent)
    contrato.set('cliente_declaracao', true)
    contrato.set('cliente_hash', clientHash)
    contrato.set('aceite_status', 'aceito')
    contrato.set('data_aceite', nowIso)
    contrato.set('aceite_ip', clientIp)
    contrato.set('aceite_user_agent', clientUserAgent)
    contrato.set('versao_texto_aceito', clausulaPadrao)
    contrato.set('versao_texto_hash', clientHash)
    contrato.set('pdf_congelado_hash', clientHash)
    contrato.set('dossie_evidencias_json', dossieEvidencias)

    const assinadoBilateralmente = Boolean(contrato.getString('data_assinatura_admin'))
    if (assinadoBilateralmente) {
      contrato.set('status', 'assinado')
    } else {
      contrato.set('status', 'aguardando_assinatura_admin')
    }

    $app.save(contrato)

    // Auditoria imediata da assinatura do cliente (rápida, atômica)
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      if (auditCol) {
        const aRec = new Record(auditCol)
        aRec.set('acao', 'ASSINATURA_CLIENTE_CONTRATO')
        aRec.set('entidade', 'contratos_servico')
        aRec.set('registro_id', contrato.id)
        aRec.set('detalhes', {
          mensagem:
            'Contrato ' +
            contrato.getString('numero') +
            ' assinado digitalmente pelo cliente ' +
            nomeAssinante,
          contrato_numero: contrato.getString('numero'),
          signatario_nome: nomeAssinante,
          signatario_doc: documentoAssinante,
          data_assinatura: nowIso,
          ip: clientIp,
          hash: clientHash,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      }
    } catch (errAudit) {
      console.log('Erro ao auditar assinatura cliente contrato: ' + errAudit)
    }

    // Efeitos colaterais assíncronos/protegidos (ativação de projetos/etapas/contas)
    // Executam em bloco isolado com try/catch e registro de falhas em erros_sistema
    if (assinadoBilateralmente) {
      try {
        const jobId = 'ativar-ctr-' + contrato.id
        try {
          cronRemove(jobId)
        } catch (_) {}
        cronAdd(jobId, '* * * * *', function () {
          try {
            cronRemove(jobId)
          } catch (_) {}
          try {
            const c = $app.findRecordById('contratos_servico', contrato.id)
            if (!c || c.getString('status') !== 'assinado') return
            ativarContratoServicoBilateral(c)
          } catch (errAtiv) {
            try {
              const errCol = $app.findCollectionByNameOrId('erros_sistema')
              if (errCol) {
                const errRec = new Record(errCol)
                errRec.set('rota', '/backend/v1/contratos-servico/assinar-cliente')
                errRec.set(
                  'mensagem',
                  ('Falha ao ativar contrato bilateral (cron): ' + errAtiv).slice(0, 1000),
                )
                errRec.set('hora', new Date().toISOString())
                errRec.set('ip', clientIp)
                errRec.set('detalhes', {
                  contrato_id: contrato.id,
                  contrato_numero: contrato.getString('numero'),
                  erro: String(errAtiv),
                })
                $app.save(errRec)
              }
            } catch (_) {}
          }
        })
      } catch (errCron) {
        console.log('Erro ao agendar ativacao (assinar-cliente): ' + errCron)
      }
    }

    return e.json(200, {
      success: true,
      message: 'Contrato assinado com sucesso! O projeto de engenharia foi iniciado.',
      contrato_id: contrato.id,
      contrato_numero: contrato.getString('numero'),
      hash: clientHash,
    })
  } catch (err) {
    console.log('Erro ao assinar contrato de serviço (cliente): ' + err)
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', '/backend/v1/contratos-servico/assinar-cliente')
        errRec.set('mensagem', ('Erro interno ao assinar contrato: ' + err).slice(0, 1000))
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', { erro: String(err) })
        $app.save(errRec)
      }
    } catch (_) {}
    return e.json(500, { message: 'Erro interno ao assinar contrato: ' + err })
  }
})

// Endpoint para Assinatura do Admin no Contrato de Serviço
routerAdd(
  'POST',
  '/backend/v1/contratos-servico/assinar-admin',
  (e) => {
    function ativarContratoServicoBilateral(rec) {
      const contratoId = rec.id
      const contratoNumero = rec.getString('numero')
      const propostaId = rec.getString('proposta')
      const empresaId = rec.getString('empresa')
      const clientePfId = rec.getString('cliente_pf')
      const valorTotalContrato = rec.getFloat('valor_total') || 0
      const objetoContrato =
        rec.getString('objeto') || 'Prestação de serviços técnicos de engenharia'

      let propostaRec = null
      let propostaNumero = ''
      let condicoesPagamento = 'Conforme contrato assinado'
      let requerNotaProposta = false
      let aliquotaImpostos = 0

      if (propostaId) {
        try {
          propostaRec = $app.findRecordById('propostas', propostaId)
          if (propostaRec) {
            propostaNumero = propostaRec.getString('numero')
            condicoesPagamento = propostaRec.getString('condicoes_pagamento') || condicoesPagamento
            requerNotaProposta = propostaRec.getBool('requer_nota')
            aliquotaImpostos = propostaRec.getInt('impostos') || 0
          }
        } catch (errProp) {
          console.log('Erro ao buscar proposta vinculada ' + propostaId + ': ' + errProp)
        }
      }

      let nomeCliente = 'Cliente'
      if (empresaId) {
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          if (emp) nomeCliente = emp.getString('razao_social')
        } catch (_) {}
      } else if (clientePfId) {
        try {
          const pf = $app.findRecordById('clientes_pf', clientePfId)
          if (pf) nomeCliente = pf.getString('nome')
        } catch (_) {}
      }

      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const projetosCol = $app.findCollectionByNameOrId('projetos')
      const gruposCol = $app.findCollectionByNameOrId('grupos_projetos')
      const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
      const entregaveisCol = $app.findCollectionByNameOrId('entregaveis')
      const contasCol = $app.findCollectionByNameOrId('contas')

      // 1. CRIAR OU RECUPERAR GRUPO DE PROJETOS (Trava 1:1)
      let grupoCriado = null
      try {
        const gruposExistentes = $app.findRecordsByFilter(
          'grupos_projetos',
          "contrato_servico = '" + contratoId + "'",
          '-created',
          1,
          0,
        )
        if (gruposExistentes.length > 0) {
          grupoCriado = gruposExistentes[0]
        } else {
          const anoAtual = new Date().getFullYear()
          const prefixoGPR = 'GPR-' + anoAtual + '-'
          const gruposDoAno = $app.findRecordsByFilter(
            'grupos_projetos',
            "codigo ~ '" + prefixoGPR + "'",
            '-codigo',
            1,
            0,
          )

          let proximoSeqGpr = 1
          if (gruposDoAno.length > 0) {
            const ultimoCodigo = gruposDoAno[0].getString('codigo')
            const partes = ultimoCodigo.split('-')
            const ultimoSeq = parseInt(partes[2], 10)
            if (!isNaN(ultimoSeq)) {
              proximoSeqGpr = ultimoSeq + 1
            }
          }

          const seqStr = ('0000' + proximoSeqGpr).slice(-4)
          const codigoGPR = prefixoGPR + seqStr

          const novoGrupo = new Record(gruposCol)
          novoGrupo.set('codigo', codigoGPR)
          novoGrupo.set('contrato_servico', contratoId)
          if (propostaId) novoGrupo.set('proposta', propostaId)
          if (empresaId) novoGrupo.set('empresa', empresaId)
          if (clientePfId) novoGrupo.set('cliente_pf', clientePfId)
          novoGrupo.set('nome', 'Grupo: ' + contratoNumero + ' — ' + nomeCliente)
          novoGrupo.set('descricao', objetoContrato)
          novoGrupo.set('status', 'ativo')
          novoGrupo.set('valor_total', valorTotalContrato)

          $app.save(novoGrupo)
          grupoCriado = novoGrupo

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_GRUPO_PROJETOS')
            aRec.set('entidade', 'grupos_projetos')
            aRec.set('registro_id', novoGrupo.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Grupo de projetos ' +
                codigoGPR +
                ' criado pela assinatura bilateral do Contrato ' +
                contratoNumero,
              codigo: codigoGPR,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
              proposta_id: propostaId,
              proposta_numero: propostaNumero,
              valor_total: valorTotalContrato,
            })
            $app.save(aRec)
          } catch (_) {}
        }
      } catch (errGrupo) {
        console.log('Erro ao criar grupo de projetos: ' + errGrupo)
      }

      // Trava de idempotência atômica: se já existirem projetos ativos vinculados a este contrato, não recriar
      const projetosJaCriados = $app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" + contratoId + "'",
        'codigo',
        100,
        0,
      )
      if (projetosJaCriados.length > 0) {
        for (let pIdx = 0; pIdx < projetosJaCriados.length; pIdx++) {
          const prjExistente = projetosJaCriados[pIdx]
          let prjModificado = false
          if (grupoCriado && prjExistente.getString('grupo') !== grupoCriado.id) {
            prjExistente.set('grupo', grupoCriado.id)
            prjModificado = true
          }
          if (clientePfId && prjExistente.getString('cliente_pf') !== clientePfId) {
            prjExistente.set('cliente_pf', clientePfId)
            prjModificado = true
          }
          if (empresaId && prjExistente.getString('empresa') !== empresaId) {
            prjExistente.set('empresa', empresaId)
            prjModificado = true
          }
          const st = prjExistente.getString('status')
          if (st === 'contratacao' || st === 'Em Contratação' || !st) {
            prjExistente.set('status', 'aguardando_definicao')
            prjExistente.set('modo_execucao', null)
            prjModificado = true
          }
          if (prjModificado) {
            $app.save(prjExistente)
          }
        }
        return
      }

      // 2. ITENS DE ESCOPO (Apenas itens reais do catálogo ou com serviço/descrição válida)
      let itensEscopo = []
      if (propostaId) {
        try {
          const itensDb = $app.findRecordsByFilter(
            'proposta_itens',
            "proposta = '" + propostaId + "'",
            'ordem,created',
            200,
            0,
          )
          if (itensDb.length > 0) {
            itensEscopo = itensDb
              .filter((it) => {
                const desc = (it.getString('descricao') || '').trim()
                const serv = it.getString('servico') || ''
                return (serv !== '' || desc.length > 0) && !desc.startsWith('Item de Escopo ')
              })
              .map((it) => ({
                id: it.id,
                record: it,
                descricao: it.getString('descricao'),
                disciplina: it.getString('disciplina') || 'Geral',
                area: it.getString('area'),
                valor: it.getFloat('preco_total') || 0,
                custo: it.getFloat('custo_total') || 0,
                subservicos: it.get('subservicos') || [],
                origem_custo: it.getString('origem_custo'),
                preco_travado: it.getFloat('preco_travado') || 0,
                prazo_travado_dias: it.getInt('prazo_travado_dias') || 0,
                prestador_vencedor: it.getString('prestador_vencedor'),
                pre_cotacao_vencedora: it.getString('pre_cotacao_vencedora'),
              }))
          }
        } catch (_) {}

        if (itensEscopo.length === 0 && propostaRec) {
          try {
            const rawJsonStr = propostaRec.getString('itens_json')
            let parsedItens = []
            if (rawJsonStr && rawJsonStr.trim()) {
              const parsed = JSON.parse(rawJsonStr)
              if (Array.isArray(parsed)) {
                parsedItens = parsed
              }
            }
            if (parsedItens.length > 0) {
              itensEscopo = parsedItens
                .filter((it) => {
                  const desc = typeof it.descricao === 'string' ? it.descricao.trim() : ''
                  const temServico = Boolean(it.servico || it.catalogo_servico)
                  const descValida = desc.length > 0 && !desc.startsWith('Item de Escopo ')
                  return temServico || descValida
                })
                .map((it) => ({
                  id: null,
                  record: null,
                  descricao: (it.descricao || '').trim() || objetoContrato,
                  disciplina: it.disciplina || 'Geral',
                  area: it.area || '',
                  valor: Number(it.preco_total) || 0,
                  custo: Number(it.custo_total) || 0,
                  subservicos: Array.isArray(it.subservicos) ? it.subservicos : [],
                }))
            }
          } catch (errJson) {
            console.log('Erro ao analisar itens_json canônico: ' + errJson)
          }
        }
      }

      if (itensEscopo.length === 0) {
        itensEscopo = [
          {
            id: null,
            record: null,
            descricao: objetoContrato,
            disciplina: propostaRec ? propostaRec.getString('disciplinas') || 'Geral' : 'Geral',
            area: '',
            valor: valorTotalContrato,
            custo: 0,
            subservicos: [],
          },
        ]
      }

      const somaItens = itensEscopo.reduce((acc, it) => acc + (Number(it.valor) || 0), 0)
      if (somaItens === 0 && valorTotalContrato > 0) {
        const valorPorItem = Math.round((valorTotalContrato / itensEscopo.length) * 100) / 100
        for (let idx = 0; idx < itensEscopo.length; idx++) {
          itensEscopo[idx].valor =
            idx === itensEscopo.length - 1
              ? Math.round((valorTotalContrato - valorPorItem * (itensEscopo.length - 1)) * 100) /
                100
              : valorPorItem
        }
      }

      // 3. PROJETOS POR ITEM DE ESCOPO
      let projetosExistentesContrato = []
      try {
        projetosExistentesContrato = $app.findRecordsByFilter(
          'projetos',
          "contrato_servico = '" +
            contratoId +
            "' || (proposta = '" +
            propostaId +
            "' && grupo = '')",
          'codigo',
          100,
          0,
        )
      } catch (_) {}

      const anoAtualPrj = new Date().getFullYear()
      const prefixoPRJ = 'PRJ-' + anoAtualPrj + '-'
      let proximoSeqPrj = 1
      try {
        const projetosDoAno = $app.findRecordsByFilter(
          'projetos',
          "codigo ~ '" + prefixoPRJ + "'",
          '-codigo',
          1,
          0,
        )
        if (projetosDoAno.length > 0) {
          const ult = projetosDoAno[0].getString('codigo')
          const partes = ult.split('-')
          const num = parseInt(partes[2], 10)
          if (!isNaN(num)) proximoSeqPrj = num + 1
        }
      } catch (_) {}

      const projetosGerados = []

      for (let i = 0; i < itensEscopo.length; i++) {
        const item = itensEscopo[i]
        let prjParaItem = null

        if (i < projetosExistentesContrato.length) {
          prjParaItem = projetosExistentesContrato[i]
        }

        if (prjParaItem) {
          let prjAlterado = false
          if (grupoCriado && prjParaItem.getString('grupo') !== grupoCriado.id) {
            prjParaItem.set('grupo', grupoCriado.id)
            prjAlterado = true
          }
          if (prjParaItem.getString('contrato_servico') !== contratoId) {
            prjParaItem.set('contrato_servico', contratoId)
            prjAlterado = true
          }
          if (clientePfId && prjParaItem.getString('cliente_pf') !== clientePfId) {
            prjParaItem.set('cliente_pf', clientePfId)
            prjAlterado = true
          }
          if (empresaId && prjParaItem.getString('empresa') !== empresaId) {
            prjParaItem.set('empresa', empresaId)
            prjAlterado = true
          }

          if (itensEscopo.length > 1) {
            prjParaItem.set(
              'nome',
              'Projeto ' +
                (i + 1) +
                '/' +
                itensEscopo.length +
                ': ' +
                item.descricao +
                ' — ' +
                nomeCliente,
            )
            prjParaItem.set('descricao', item.descricao)
            prjParaItem.set('valor_total', item.valor)
            prjParaItem.set('disciplinas', item.disciplina)
            prjAlterado = true
          } else {
            prjParaItem.set('valor_total', item.valor || valorTotalContrato)
            prjAlterado = true
          }

          if (!prjParaItem.getString('prazo_final')) {
            try {
              const pDiasContrato = rec.getInt('prazo_dias') || 30
              const dtBaseAssinatura =
                rec.getString('data_assinatura_cliente') ||
                rec.getString('data_assinatura_admin') ||
                new Date().toISOString()
              const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
              dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
              prjParaItem.set(
                'prazo_final',
                dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )
              prjAlterado = true
            } catch (_) {}
          }

          const statusAtual = prjParaItem.getString('status')
          if (statusAtual === 'contratacao' || statusAtual === 'Em Contratação' || !statusAtual) {
            prjParaItem.set('status', 'aguardando_definicao')
            prjParaItem.set('modo_execucao', null)
            prjAlterado = true
          }

          if (prjAlterado) {
            $app.save(prjParaItem)
          }
        } else {
          const seqStr = ('0000' + proximoSeqPrj).slice(-4)
          const codigoPRJ = prefixoPRJ + seqStr
          proximoSeqPrj++

          const novoPrj = new Record(projetosCol)
          novoPrj.set('codigo', codigoPRJ)
          novoPrj.set(
            'nome',
            itensEscopo.length > 1
              ? 'Projeto ' +
                  (i + 1) +
                  '/' +
                  itensEscopo.length +
                  ': ' +
                  item.descricao +
                  ' — ' +
                  nomeCliente
              : 'Projeto: ' + contratoNumero + ' — ' + nomeCliente,
          )
          novoPrj.set('descricao', item.descricao)
          if (propostaId) novoPrj.set('proposta', propostaId)
          novoPrj.set('contrato_servico', contratoId)
          if (grupoCriado) novoPrj.set('grupo', grupoCriado.id)
          if (empresaId) novoPrj.set('empresa', empresaId)
          if (clientePfId) novoPrj.set('cliente_pf', clientePfId)
          novoPrj.set('valor_total', item.valor)
          novoPrj.set('subcontratacao_autorizada', true)
          novoPrj.set('saude', 'verde')
          novoPrj.set('status', 'aguardando_definicao')
          novoPrj.set('modo_execucao', null)
          novoPrj.set('disciplinas', item.disciplina)

          // Prazo final do projeto PRJ criado = data_assinatura + prazo_dias
          try {
            const pDiasContrato = rec.getInt('prazo_dias') || 30
            const dtBaseAssinatura =
              rec.getString('data_assinatura_cliente') ||
              rec.getString('data_assinatura_admin') ||
              new Date().toISOString()
            const dtPrazoFinalPrj = new Date(dtBaseAssinatura)
            dtPrazoFinalPrj.setDate(dtPrazoFinalPrj.getDate() + pDiasContrato)
            novoPrj.set(
              'prazo_final',
              dtPrazoFinalPrj.toISOString().substring(0, 10) + ' 12:00:00.000Z',
            )
          } catch (_) {}

          $app.save(novoPrj)
          prjParaItem = novoPrj

          try {
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'CRIACAO_PROJETO_ITEM_ESCOPO')
            aRec.set('entidade', 'projetos')
            aRec.set('registro_id', novoPrj.id)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              mensagem:
                'Projeto ' +
                codigoPRJ +
                ' criado para o item de escopo "' +
                item.descricao +
                '" do Contrato ' +
                contratoNumero,
              codigo: codigoPRJ,
              grupo_id: grupoCriado ? grupoCriado.id : null,
              grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
              contrato_id: contratoId,
              contrato_numero: contratoNumero,
              item_descricao: item.descricao,
              item_valor: item.valor,
            })
            $app.save(aRec)
          } catch (_) {}
        }

        projetosGerados.push(prjParaItem)

        if (item.record) {
          try {
            item.record.set('status_conversao', 'convertido')
            item.record.set('projeto_gerado', prjParaItem.id)
            $app.save(item.record)
          } catch (_) {}
        }

        // 4. ETAPAS E ENTREGÁVEIS
        try {
          const etapasExistentes = $app.findRecordsByFilter(
            'projeto_etapas',
            "projeto = '" + prjParaItem.id + "'",
            'ordem',
            1,
            0,
          )

          if (etapasExistentes.length === 0) {
            let areaNome = item.disciplina || 'Geral'
            if (item.area) {
              try {
                const areaRec = $app.findRecordById('areas_atuacao', item.area)
                if (areaRec) areaNome = areaRec.getString('nome')
              } catch (_) {}
            }

            const novaEtapa = new Record(etapasCol)
            novaEtapa.set('projeto', prjParaItem.id)
            novaEtapa.set('nome', 'Pacote: ' + (areaNome || item.descricao))
            novaEtapa.set('disciplina', item.disciplina || 'Geral')
            novaEtapa.set('ordem', 1)

            // RODADA 13: Se o item tiver preço travado e prestador vencedor vindo de pré-cotação
            let itemTemPrecoTravadoValido = false
            let prestadorVencedorId = item.prestador_vencedor || item.pre_cotacao_vencedora
            let precoTravadoValor = item.preco_travado || item.custo || 0

            if (
              item.origem_custo === 'pre_cotacao' &&
              precoTravadoValor > 0 &&
              prestadorVencedorId
            ) {
              // Checar se a pré-cotação ainda está dentro da validade
              let precotValida = true
              try {
                const pcs = $app.findRecordsByFilter(
                  'pre_cotacoes',
                  "item_proposta = '" + item.id + "'",
                  '-created',
                  1,
                  0,
                )
                if (pcs.length > 0) {
                  const pc = pcs[0]
                  const dtLimite = pc.getString('data_limite')
                  if (dtLimite && new Date(dtLimite) < new Date()) {
                    precotValida = false
                  }
                }
              } catch (_) {}

              if (precotValida) {
                itemTemPrecoTravadoValido = true
              } else {
                // Fora da validade: avisa o Gestor na auditoria/saúde e não trava
                try {
                  const aRec = new Record(auditCol)
                  aRec.set('user', null)
                  aRec.set('user_email', 'SISTEMA')
                  aRec.set('acao', 'PRE_COTACAO_EXPIRADA_NA_ATIVACAO')
                  aRec.set('entidade', 'contratos_servico')
                  aRec.set('registro_id', contratoId)
                  aRec.set('detalhes', {
                    item_id: item.id,
                    disciplina: item.disciplina,
                    aviso:
                      'Pré-cotação vinculante expirou antes da assinatura bilateral. Cotação será reaberta.',
                  })
                  $app.save(aRec)
                } catch (_) {}
              }
            }

            novaEtapa.set('tipo_execucao', itemTemPrecoTravadoValido ? 'terceirizada' : 'direta')
            novaEtapa.set('status', 'atribuido')
            novaEtapa.set('custo_estimado', item.custo || 0)
            novaEtapa.set('is_pacote_trabalho', true)
            novaEtapa.set('is_marco', false)
            novaEtapa.set('valor_interno_referencia', item.custo || 0)
            novaEtapa.set('valor_vendido', item.valor || 0)
            novaEtapa.set('escopo_detalhado', item.descricao || '')
            if (item.id) {
              novaEtapa.set('proposta_item_origem', item.id)
            }

            let desc = 'Subserviços contemplados: '
            if (Array.isArray(item.subservicos) && item.subservicos.length > 0) {
              desc += item.subservicos.join(', ')
            } else {
              desc += 'Serviços técnicos de ' + item.disciplina
            }
            desc += '.\nItem do escopo: ' + item.descricao
            novaEtapa.set('descricao', desc)

            if (item.area) {
              novaEtapa.set('area', item.area)
            }

            const prazoDiasContrato = rec.getInt('prazo_dias') || 30
            const dtPrazoPacote = new Date()
            dtPrazoPacote.setDate(dtPrazoPacote.getDate() + prazoDiasContrato)
            novaEtapa.set('prazo', dtPrazoPacote.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaEtapa)

            if (item.record) {
              try {
                item.record.set('etapa_gerada', novaEtapa.id)
                $app.save(item.record)
              } catch (_) {}
            }

            // RODADA 13: Se o item tiver preço travado e prestador vencedor válido,
            // Gerar imediatamente a Ordem de Serviço com o preço travado e vincular ao pacote,
            // BLOQUEANDO o disparo da cotação automática!
            if (itemTemPrecoTravadoValido && prestadorVencedorId) {
              try {
                let cmAssinado = null
                const cms = $app.findRecordsByFilter(
                  'contratos_mestre',
                  "prestador = '" + prestadorVencedorId + "' && status = 'assinado'",
                  '-created',
                  1,
                  0,
                )
                if (cms.length > 0) cmAssinado = cms[0]

                if (cmAssinado) {
                  const osCol = $app.findCollectionByNameOrId('ordens_servico')
                  const osTravada = new Record(osCol)
                  osTravada.set('projeto', prjParaItem.id)
                  osTravada.set('prestador', prestadorVencedorId)
                  osTravada.set('contrato_mestre', cmAssinado.id)
                  osTravada.set('tipo_prestador', 'externo')
                  osTravada.set('disciplina', item.disciplina || 'Geral')
                  osTravada.set(
                    'escopo_tecnico',
                    item.descricao || 'Execução técnica de escopo travado',
                  )
                  const pDias = item.prazo_travado_dias || 30
                  osTravada.set('prazo_dias', pDias)
                  osTravada.set('valor_os', precoTravadoValor)
                  osTravada.set('status', 'minuta')

                  const dIni = new Date()
                  const dFim = new Date(dIni.getTime() + pDias * 24 * 60 * 60 * 1000)
                  osTravada.set(
                    'data_inicio',
                    dIni.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                  )
                  osTravada.set(
                    'data_previsao_fim',
                    dFim.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                  )
                  $app.save(osTravada)

                  // Vincula a OS ativa ao pacote gerado (bloqueia o disparo de cotação automática)
                  novaEtapa.set('ordem_servico_ativa', osTravada.id)
                  $app.save(novaEtapa)

                  // Audita a trava do preço na OS
                  try {
                    const aRec = new Record(auditCol)
                    aRec.set('user', null)
                    aRec.set('user_email', 'SISTEMA')
                    aRec.set('acao', 'OS_NASCIDA_PRECO_TRAVADO_PRE_COTACAO')
                    aRec.set('entidade', 'ordens_servico')
                    aRec.set('registro_id', osTravada.id)
                    aRec.set('detalhes', {
                      pacote_id: novaEtapa.id,
                      prestador_id: prestadorVencedorId,
                      valor_os_travado: precoTravadoValor,
                      prazo_dias_travado: pDias,
                      contrato_id: contratoId,
                    })
                    $app.save(aRec)
                  } catch (_) {}
                }
              } catch (errOsTravada) {
                console.log('Erro ao gerar OS com preço travado da pré-cotação: ' + errOsTravada)
              }
            }

            let entregaveisDoEscopo = []
            try {
              const escoposFiltro = $app.findRecordsByFilter(
                'catalogo_escopos',
                "disciplina = '" +
                  (item.disciplina || '').replace(/'/g, "''") +
                  "' || nome = '" +
                  (areaNome || '').replace(/'/g, "''") +
                  "'",
                '',
                1,
                0,
              )
              if (escoposFiltro.length > 0) {
                const escopoRec = escoposFiltro[0]
                const pdr = escopoRec.get('entregaveis_padrao')
                if (Array.isArray(pdr)) {
                  entregaveisDoEscopo = pdr
                }
              }
            } catch (_) {}

            if (entregaveisDoEscopo.length === 0 && item.area) {
              try {
                const entregaveisAreaDb = $app.findRecordsByFilter(
                  'entregaveis_padrao',
                  "area = '" + item.area + "' && ativo = true",
                  'ordem',
                  30,
                  0,
                )
                for (let ep = 0; ep < entregaveisAreaDb.length; ep++) {
                  entregaveisDoEscopo.push({
                    nome: entregaveisAreaDb[ep].getString('nome'),
                    descricao: entregaveisAreaDb[ep].getString('descricao'),
                  })
                }
              } catch (_) {}
            }

            if (entregaveisDoEscopo.length === 0) {
              entregaveisDoEscopo = [
                {
                  nome: 'Relatório e Memorial de ' + (item.disciplina || 'Engenharia'),
                  descricao: 'Memorial técnico descritivo e memória de cálculo',
                },
                {
                  nome: 'Pranchas e Desenhos Técnicos',
                  descricao: 'Plantas, cortes, detalhes e arquivos executivos',
                },
                {
                  nome: 'Anotação de Responsabilidade Técnica (ART/RRT)',
                  descricao: 'Registro de responsabilidade técnica perante o conselho de classe',
                },
              ]
            }

            for (let ep = 0; ep < entregaveisDoEscopo.length; ep++) {
              try {
                const entNome = entregaveisDoEscopo[ep].nome || 'Entregável ' + (ep + 1)
                const entDesc =
                  entregaveisDoEscopo[ep].descricao ||
                  'Entregável técnico da disciplina ' + item.disciplina
                const novoEntregavel = new Record(entregaveisCol)
                novoEntregavel.set('etapa', novaEtapa.id)
                novoEntregavel.set('nome', entNome)
                novoEntregavel.set('titulo', entNome)
                novoEntregavel.set('versao', 'v1.0')
                novoEntregavel.set('versao_atual', 1)
                novoEntregavel.set('status', 'atribuido')
                novoEntregavel.set('descricao', entDesc)
                novoEntregavel.set(
                  'prazo',
                  dtPrazoPacote.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                )
                $app.save(novoEntregavel)
              } catch (errNovoEnt) {
                console.log('Erro ao criar entregável para etapa: ' + errNovoEnt)
              }
            }
          }
        } catch (errEtapaPrj) {
          console.log('Erro ao criar etapas para o projeto do item: ' + errEtapaPrj)
        }
      }

      if (projetosGerados.length > 0) {
        try {
          rec.set('projeto', projetosGerados[0].id)
          $app.save(rec)
        } catch (_) {}
      }

      // 5. CONTAS A RECEBER
      try {
        const projetoRefId = projetosGerados.length > 0 ? projetosGerados[0].id : null
        let filtroContas =
          "tipo = 'receber' && (contrato_servico = '" +
          contratoId +
          "' || descricao ~ 'Contrato " +
          contratoNumero +
          "'"
        if (propostaId) {
          filtroContas += " || proposta = '" + propostaId + "'"
        }
        filtroContas += ')'
        const contasExistentes = $app.findRecordsByFilter('contas', filtroContas, '-created', 1, 0)

        if (contasExistentes.length === 0) {
          let parcelas = []
          // Prioridade L1: parcelas_json do próprio contrato
          try {
            const rawParcelasJson = rec.get('parcelas_json')
            if (Array.isArray(rawParcelasJson) && rawParcelasJson.length > 0) {
              parcelas = rawParcelasJson.map((p, idx) => ({
                id: 'json_' + (idx + 1),
                ordem: p.ordem || idx + 1,
                percentual: Number(p.percentual) || 0,
                valor: Number(p.valor) || (valorTotalContrato * (Number(p.percentual) || 0)) / 100,
                descricao:
                  p.descricao || 'Parcela ' + (p.ordem || idx + 1) + '/' + rawParcelasJson.length,
                gatilho: p.gatilho || 'marco',
                dias_vencimento: p.dias_vencimento || (idx === 0 ? 15 : (idx + 1) * 30),
              }))
            }
          } catch (_) {}

          // Fallback: proposta_parcelas apenas se parcelas_json vazio
          if (parcelas.length === 0 && propostaId) {
            try {
              const parcsDb = $app.findRecordsByFilter(
                'proposta_parcelas',
                "proposta = '" + propostaId + "'",
                'ordem',
                50,
                0,
              )
              if (parcsDb && parcsDb.length > 0) {
                parcelas = parcsDb.map((p, idx) => ({
                  id: p.id,
                  ordem: p.getInt('ordem') || idx + 1,
                  percentual: p.getFloat('percentual') || 0,
                  valor:
                    p.getFloat('valor') ||
                    (valorTotalContrato * (p.getFloat('percentual') || 0)) / 100,
                  descricao:
                    p.getString('descricao') ||
                    'Parcela ' + (p.getInt('ordem') || idx + 1) + '/' + parcsDb.length,
                  gatilho: p.getString('gatilho') || 'marco',
                  dias_vencimento: idx === 0 ? 15 : (idx + 1) * 30,
                }))
              }
            } catch (_) {}
          }

          if (parcelas && parcelas.length > 0) {
            for (let i = 0; i < parcelas.length; i++) {
              const parc = parcelas[i]
              const ordem =
                typeof parc.ordem === 'number'
                  ? parc.ordem
                  : parc.getInt
                    ? parc.getInt('ordem')
                    : i + 1
              const perc =
                typeof parc.percentual === 'number'
                  ? parc.percentual
                  : parc.getFloat
                    ? parc.getFloat('percentual')
                    : 0
              const valorParc =
                typeof parc.valor === 'number'
                  ? parc.valor
                  : parc.getFloat
                    ? parc.getFloat('valor')
                    : (valorTotalContrato * perc) / 100
              const descParc =
                typeof parc.descricao === 'string'
                  ? parc.descricao
                  : parc.getString
                    ? parc.getString('descricao')
                    : 'Parcela ' + ordem + '/' + parcelas.length
              const gatilho =
                typeof parc.gatilho === 'string'
                  ? parc.gatilho
                  : parc.getString
                    ? parc.getString('gatilho')
                    : 'marco'

              const novaConta = new Record(contasCol)
              novaConta.set('tipo', 'receber')
              if (projetoRefId) novaConta.set('projeto', projetoRefId)
              if (propostaId) novaConta.set('proposta', propostaId)
              if (contratoId) novaConta.set('contrato_servico', contratoId)
              novaConta.set(
                'descricao',
                'Contrato ' +
                  contratoNumero +
                  ' — Parcela ' +
                  ordem +
                  '/' +
                  parcelas.length +
                  ' (' +
                  perc +
                  '% - ' +
                  descParc +
                  ')' +
                  (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
              )
              novaConta.set('valor', valorParc)
              novaConta.set('status', 'rascunho')
              novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
              novaConta.set('bloqueada_por_fechamento', false)

              if (requerNotaProposta && aliquotaImpostos > 0) {
                const retencao =
                  Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) /
                  100
                novaConta.set('retencao_impostos', retencao)
                novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
              } else {
                novaConta.set('retencao_impostos', 0)
                novaConta.set('valor_liquido', valorParc)
              }

              const diasVenc = i === 0 ? 15 : (i + 1) * 30
              const dataVenc = new Date()
              dataVenc.setDate(dataVenc.getDate() + diasVenc)
              novaConta.set(
                'vencimento',
                dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
              )

              $app.save(novaConta)

              try {
                const aRec = new Record(auditCol)
                aRec.set('user', null)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
                aRec.set('entidade', 'contas')
                aRec.set('registro_id', novaConta.id)
                aRec.set('detalhes', {
                  origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                  mensagem:
                    'Conta a receber da parcela ' +
                    ordem +
                    '/' +
                    parcelas.length +
                    ' gerada por assinatura do Contrato ' +
                    contratoNumero,
                  ordem: ordem,
                  percentual: perc,
                  valor: valorParc,
                  gatilho: gatilho,
                  projeto_id: projetoRefId,
                  contrato_id: contratoId,
                  contrato_numero: contratoNumero,
                })
                $app.save(aRec)
              } catch (_) {}

              // REQUISITO 2: Gerar um MARCO por cada parcela no projeto principal (idempotente)
              if (projetoRefId) {
                try {
                  const marcosExistentes = $app.findRecordsByFilter(
                    'projeto_etapas',
                    "projeto = '" + projetoRefId + "' && parcela_origem = '" + parc.id + "'",
                    '',
                    1,
                    0,
                  )
                  if (marcosExistentes.length === 0) {
                    const marcoEtapa = new Record(etapasCol)
                    marcoEtapa.set('projeto', projetoRefId)
                    marcoEtapa.set(
                      'nome',
                      'Marco Financeiro: Parcela ' + ordem + ' (' + descParc + ')',
                    )
                    marcoEtapa.set('disciplina', 'Marco Financeiro')
                    marcoEtapa.set('ordem', 100 + ordem)
                    marcoEtapa.set('tipo_execucao', 'direta')
                    marcoEtapa.set('status', 'nao_iniciada')
                    marcoEtapa.set('is_marco', true)
                    marcoEtapa.set('is_pacote_trabalho', false)
                    marcoEtapa.set('valor_vendido', valorParc)
                    marcoEtapa.set('valor_interno_referencia', valorParc)
                    marcoEtapa.set('parcela_origem', parc.id)
                    marcoEtapa.set(
                      'prazo',
                      dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z',
                    )
                    marcoEtapa.set(
                      'descricao',
                      'Marco vinculado à parcela ' +
                        ordem +
                        ' do Contrato ' +
                        contratoNumero +
                        '. Gatilho: ' +
                        gatilho,
                    )
                    $app.save(marcoEtapa)
                  }
                } catch (eMarco) {
                  console.log('Erro ao criar marco da parcela ' + ordem + ': ' + eMarco)
                }
              }
            }
          } else {
            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoRefId) novaConta.set('projeto', projetoRefId)
            if (propostaId) novaConta.set('proposta', propostaId)
            if (contratoId) novaConta.set('contrato_servico', contratoId)
            novaConta.set(
              'descricao',
              'Recebimento integral do Contrato Assinado ' +
                contratoNumero +
                (requerNotaProposta ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorTotalContrato)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNotaProposta && aliquotaImpostos > 0) {
              const retencao =
                Math.round(
                  ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
                ) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set(
                'valor_liquido',
                Math.round((valorTotalContrato - retencao) * 100) / 100,
              )
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorTotalContrato)
            }

            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + 30)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaConta)

            try {
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'CRIACAO_AUTOMATICA_CONTA_RECEBER')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                mensagem:
                  'Conta a receber integral gerada por assinatura do Contrato ' + contratoNumero,
                valor: valorTotalContrato,
                projeto_id: projetoRefId,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } catch (errContas) {
        console.log('Erro ao gerar contas a receber a partir do contrato: ' + errContas)
      }

      // Auditoria geral Bloco 4
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA')
        aRec.set('acao', 'ATIVACAO_BLOCO4_CONTRATO_ASSINADO')
        aRec.set('entidade', 'contratos_servico')
        aRec.set('registro_id', contratoId)
        aRec.set('detalhes', {
          origem: 'SISTEMA / GATILHO AUTOMÁTICO',
          mensagem:
            'Contrato ' +
            contratoNumero +
            ' assinado bilateralmente. 1 Grupo de Projetos (' +
            (grupoCriado ? grupoCriado.getString('codigo') : 'GPR') +
            ') e ' +
            projetosGerados.length +
            ' projeto(s) gerado(s) com sucesso.',
          contrato_numero: contratoNumero,
          grupo_codigo: grupoCriado ? grupoCriado.getString('codigo') : null,
          total_projetos: projetosGerados.length,
          codigos_projetos: projetosGerados.map((p) => p.getString('codigo')),
          valor_total: valorTotalContrato,
        })
        $app.save(aRec)
      } catch (_) {}

      // Atualização do status da proposta para "convertida_em_projeto"
      if (propostaId) {
        try {
          const propToUpdate = $app.findRecordById('propostas', propostaId)
          if (propToUpdate) {
            const stAnt = propToUpdate.getString('status')
            if (stAnt !== 'convertida_em_projeto') {
              propToUpdate.set('status', 'convertida_em_projeto')
              $app.save(propToUpdate)

              try {
                const aRecProp = new Record(auditCol)
                aRecProp.set('user', null)
                aRecProp.set('user_email', 'SISTEMA')
                aRecProp.set('acao', 'PROPOSTA_CONVERTIDA_EM_PROJETO')
                aRecProp.set('entidade', 'propostas')
                aRecProp.set('registro_id', propostaId)
                aRecProp.set('detalhes', {
                  origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                  mensagem:
                    'Proposta ' +
                    propostaNumero +
                    ' convertida em projeto após assinatura bilateral do Contrato ' +
                    contratoNumero,
                  status_anterior: stAnt,
                  novo_status: 'convertida_em_projeto',
                  contrato_id: contratoId,
                  contrato_numero: contratoNumero,
                  total_projetos: projetosGerados.length,
                })
                $app.save(aRecProp)
              } catch (_) {}
            }
          }
        } catch (errPropUpdate) {
          console.log(
            'Erro ao atualizar status da proposta para convertida_em_projeto: ' + errPropUpdate,
          )
        }
      }

      // Promoção
      if (empresaId) {
        try {
          const empresa = $app.findRecordById('empresas', empresaId)
          if (empresa) {
            const etapaAtual = empresa.getString('etapa_funil')
            const eraPreCadastro = empresa.getBool('pre_cadastro')

            let houveMudanca = false
            if (eraPreCadastro) {
              empresa.set('pre_cadastro', false)
              houveMudanca = true
            }

            if (etapaAtual !== 'parceira') {
              empresa.set('etapa_anterior', etapaAtual)
              empresa.set('etapa_funil', 'parceira')
              empresa.set('status', 'ativa')
              houveMudanca = true
            }

            if (houveMudanca) {
              empresa.set(
                'observacoes',
                (empresa.getString('observacoes') || '') +
                  '\n[Efetivação por Contrato Assinado]: Contrato ' +
                  contratoNumero +
                  ' assinado em ' +
                  new Date().toISOString() +
                  (eraPreCadastro ? ' (pré-cadastro promovido a definitivo)' : ''),
              )
              $app.save(empresa)

              try {
                const auditCol = $app.findCollectionByNameOrId('audit_logs')
                const aRec = new Record(auditCol)
                aRec.set('user', null)
                aRec.set('user_email', 'SISTEMA')
                aRec.set('acao', 'CONVERSAO_PARCEIRO')
                aRec.set('entidade', 'empresas')
                aRec.set('registro_id', empresaId)
                aRec.set('detalhes', {
                  origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                  mensagem:
                    'Empresa convertida para Parceira pela assinatura do Contrato ' +
                    contratoNumero,
                  contrato_numero: contratoNumero,
                  proposta_numero: propostaNumero,
                })
                $app.save(aRec)
              } catch (_) {}
            }
          }
        } catch (errEmp) {
          console.log('Erro ao converter empresa em parceira por contrato: ' + errEmp)
        }
      }

      if (clientePfId) {
        try {
          const clientePf = $app.findRecordById('clientes_pf', clientePfId)
          if (clientePf && clientePf.getBool('pre_cadastro')) {
            clientePf.set('pre_cadastro', false)
            clientePf.set(
              'observacoes',
              (clientePf.getString('observacoes') || '') +
                '\n[Efetivação por Contrato Assinado]: Contrato ' +
                contratoNumero +
                ' assinado em ' +
                new Date().toISOString() +
                ' (promovido a cliente definitivo)',
            )
            $app.save(clientePf)

            try {
              const auditCol = $app.findCollectionByNameOrId('audit_logs')
              const aRec = new Record(auditCol)
              aRec.set('user', null)
              aRec.set('user_email', 'SISTEMA')
              aRec.set('acao', 'PROMOCAO_CLIENTE_CONTRATO')
              aRec.set('entidade', 'clientes_pf')
              aRec.set('registro_id', clientePfId)
              aRec.set('detalhes', {
                origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                tipo: 'pf',
                mensagem:
                  'Cliente PF promovido de pré-cadastro a definitivo pela assinatura do Contrato ' +
                  contratoNumero,
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        } catch (errPf) {
          console.log('Erro ao promover cliente PF por contrato: ' + errPf)
        }
      }
    }

    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          message:
            'Apenas Administradores podem assinar o Contrato de Serviços pela G+ Engenharia.',
        })
      }

      const body = reqInfo.body || {}
      const contratoId = body.contrato_id
      const declaracao = body.declaracao === true

      if (!contratoId) {
        return e.json(400, { message: 'ID do contrato não informado' })
      }

      if (!declaracao) {
        return e.json(400, { message: 'Declaração obrigatória para formalização da assinatura.' })
      }

      const contrato = $app.findRecordById('contratos_servico', contratoId)
      if (!contrato) {
        return e.json(404, { message: 'Contrato não encontrado' })
      }

      // Bloquear se o contrato ainda estiver aguardando dados do cliente
      if (contrato.getString('status') === 'aguardando_dados_cliente') {
        return e.json(400, {
          message:
            'Não é possível assinar o contrato: os dados cadastrais do cliente ainda estão incompletos.',
        })
      }

      // Captura de IP: ler x-forwarded-for e depois x-real-ip na entrada; se vazio, 'nao_capturado' (NUNCA 127.0.0.1) e registrar em erros_sistema
      let rawIp = ''
      try {
        if (e.request && e.request.header && typeof e.request.header.get === 'function') {
          rawIp = e.request.header.get('x-forwarded-for') || e.request.header.get('x-real-ip') || ''
        }
        if (!rawIp && e.request && typeof e.request.getHeader === 'function') {
          rawIp = e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip') || ''
        }
        if (!rawIp && reqInfo.headers) {
          rawIp = reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'] || ''
        }
      } catch (_) {}

      if (rawIp && typeof rawIp === 'string') {
        rawIp = rawIp.split(',')[0].trim()
      }

      let clientIp = rawIp && rawIp !== '127.0.0.1' ? rawIp : 'nao_capturado'
      if (clientIp === 'nao_capturado') {
        try {
          const errCol = $app.findCollectionByNameOrId('erros_sistema')
          if (errCol) {
            const errRec = new Record(errCol)
            errRec.set('rota', '/backend/v1/contratos-servico/assinar-admin')
            errRec.set(
              'mensagem',
              'IP nao capturado na rota assinar-admin (headers x-forwarded-for e x-real-ip ausentes ou locais)',
            )
            errRec.set('hora', new Date().toISOString())
            errRec.set('ip', 'nao_capturado')
            if (reqInfo && reqInfo.auth) {
              errRec.set('usuario', reqInfo.auth.id)
              errRec.set('usuario_email', reqInfo.auth.getString('email'))
            }
            errRec.set('detalhes', {
              contrato_id: contrato.id,
              contrato_numero: contrato.getString('numero'),
              raw_ip: rawIp,
            })
            $app.save(errRec)
          }
        } catch (_) {}
      }

      // User Agent: prioriza body.userAgent enviado pelo front; fallback para header
      const clientUserAgent =
        (
          body.userAgent ||
          body.user_agent ||
          (reqInfo.headers && reqInfo.headers['user-agent']) ||
          ''
        ).trim() || 'Navegador Web'
      const nowIso = new Date().toISOString()

      const hashPayload =
        contrato.getString('numero') + '|' + reqInfo.auth.id + '|ADMIN|' + clientIp + '|' + nowIso
      const adminHash = $security.sha256(hashPayload)

      contrato.set('assinante_admin', reqInfo.auth.id)
      contrato.set('data_assinatura_admin', nowIso)
      contrato.set('admin_ip', clientIp)
      contrato.set('admin_user_agent', clientUserAgent)
      contrato.set('admin_declaracao', true)
      contrato.set('admin_hash', adminHash)

      const assinadoBilateralmente = Boolean(contrato.getString('data_assinatura_cliente'))
      if (assinadoBilateralmente) {
        contrato.set('status', 'assinado')
      } else {
        contrato.set('status', 'aguardando_assinatura_cliente')
      }

      $app.save(contrato)

      // Auditoria imediata da assinatura do admin (rápida, atômica)
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        if (auditCol) {
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'ASSINATURA_ADMIN_CONTRATO')
          aRec.set('entidade', 'contratos_servico')
          aRec.set('registro_id', contratoId)
          aRec.set('detalhes', {
            mensagem:
              'Contrato ' +
              contrato.getString('numero') +
              ' assinado digitalmente pelo Administrador ' +
              reqInfo.auth.getString('name'),
            contrato_numero: contrato.getString('numero'),
            admin_id: reqInfo.auth.id,
            admin_nome: reqInfo.auth.getString('name'),
            data_assinatura: nowIso,
            ip: clientIp,
            hash: adminHash,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        }
      } catch (errAudit) {
        console.log('Erro ao auditar assinatura admin contrato: ' + errAudit)
      }

      // Efeitos colaterais protegidos (ativação de projetos/etapas/contas se assinado bilateralmente)
      // Executam isoladamente sem travar a resposta; erros gravados em erros_sistema
      if (assinadoBilateralmente) {
        try {
          const jobId = 'ativar-ctr-' + contrato.id
          try {
            cronRemove(jobId)
          } catch (_) {}
          cronAdd(jobId, '* * * * *', function () {
            try {
              cronRemove(jobId)
            } catch (_) {}
            try {
              const c = $app.findRecordById('contratos_servico', contrato.id)
              if (!c || c.getString('status') !== 'assinado') return
              ativarContratoServicoBilateral(c)
            } catch (errAtiv) {
              try {
                const errCol = $app.findCollectionByNameOrId('erros_sistema')
                if (errCol) {
                  const errRec = new Record(errCol)
                  errRec.set('rota', '/backend/v1/contratos-servico/assinar-admin')
                  errRec.set(
                    'mensagem',
                    ('Falha ao ativar contrato bilateral (cron): ' + errAtiv).slice(0, 1000),
                  )
                  if (reqInfo && reqInfo.auth) {
                    errRec.set('usuario', reqInfo.auth.id)
                    errRec.set('usuario_email', reqInfo.auth.getString('email'))
                  }
                  errRec.set('hora', new Date().toISOString())
                  errRec.set('ip', clientIp)
                  errRec.set('detalhes', {
                    contrato_id: contrato.id,
                    contrato_numero: contrato.getString('numero'),
                    erro: String(errAtiv),
                  })
                  $app.save(errRec)
                }
              } catch (_) {}
            }
          })
        } catch (errCron) {
          console.log('Erro ao agendar ativacao (assinar-admin): ' + errCron)
        }
      }

      return e.json(200, {
        success: true,
        message: 'Contrato assinado pelo Administrador com sucesso!',
        contrato_id: contrato.id,
        contrato_numero: contrato.getString('numero'),
        status: contrato.getString('status'),
        token_assinatura_cliente: contrato.getString('token_assinatura_cliente'),
      })
    } catch (err) {
      console.log('Erro ao assinar contrato como admin: ' + err)
      try {
        const errCol = $app.findCollectionByNameOrId('erros_sistema')
        if (errCol) {
          const errRec = new Record(errCol)
          errRec.set('rota', '/backend/v1/contratos-servico/assinar-admin')
          errRec.set('mensagem', ('Erro interno ao assinar contrato: ' + err).slice(0, 1000))
          if (reqInfo && reqInfo.auth) {
            errRec.set('usuario', reqInfo.auth.id)
            errRec.set('usuario_email', reqInfo.auth.getString('email'))
          }
          errRec.set('hora', new Date().toISOString())
          errRec.set('detalhes', { erro: String(err) })
          $app.save(errRec)
        }
      } catch (_) {}
      return e.json(500, { message: 'Erro interno ao assinar contrato: ' + err })
    }
  },
  $apis.requireAuth(),
)

// Endpoint para envio do Contrato por E-mail ao cliente
// Requer autenticação e valida gate jurídico (o contrato DEVE estar assinado pelo Admin)
routerAdd(
  'POST',
  '/backend/v1/contratos-servico/enviar-email',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authRecord = reqInfo.auth || e.auth
      if (!authRecord) {
        return e.json(401, { message: 'Autenticação necessária para enviar contrato por e-mail.' })
      }

      let body = {}
      try {
        body = reqInfo.body || {}
      } catch (err) {
        // body vazio
      }

      const contratoId = body.contrato_id || body.contratoId
      if (!contratoId) {
        return e.json(400, { message: 'ID do contrato não informado.' })
      }

      let contrato = null
      try {
        contrato = $app.findRecordById('contratos_servico', contratoId)
      } catch (_) {
        return e.json(404, { message: 'Contrato não encontrado.' })
      }
      if (!contrato) {
        return e.json(404, { message: 'Contrato não encontrado.' })
      }

      // GATE JURÍDICO RIGOROSO:
      // O envio ao cliente só é liberado após a assinatura formal do Administrador
      const assinadoAdmin = Boolean(contrato.getString('data_assinatura_admin'))
      if (!assinadoAdmin) {
        return e.json(403, {
          message:
            'Envio bloqueado: o Contrato deve ser formalmente assinado pelo Administrador da G+ Engenharia antes de ser enviado ao cliente.',
        })
      }

      // Se estiver aguardando dados cadastrais, também não pode enviar
      if (contrato.getString('status') === 'aguardando_dados_cliente') {
        return e.json(400, {
          message: 'Envio bloqueado: os dados cadastrais do cliente ainda estão incompletos.',
        })
      }

      // Identificar destinatário: body com fallback para PF ou PJ
      let destinatarioEmail = (
        body.destinatarioEmail ||
        body.destinatario_email ||
        body.email ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase()
      let destinatarioNome = (body.destinatarioNome || body.destinatario_nome || body.nome || '')
        .toString()
        .trim()
      const assuntoCustomizado = (body.assunto || '').toString().trim()
      const corpoCustomizado = (body.corpo || '').toString().trim()

      if (!destinatarioEmail) {
        const pfId = contrato.getString('cliente_pf')
        if (pfId) {
          try {
            const pf = $app.findRecordById('clientes_pf', pfId)
            if (pf && pf.getString('email')) {
              destinatarioEmail = pf.getString('email').trim().toLowerCase()
              if (!destinatarioNome) destinatarioNome = pf.getString('nome') || 'Cliente'
            }
          } catch (_) {}
        }
      }

      if (!destinatarioEmail) {
        const empId = contrato.getString('empresa')
        if (empId) {
          try {
            const contatos = $app.findAllRecords(
              'contatos',
              $dbx.exp('empresa = {:emp}', { emp: empId }),
            )
            if (contatos && contatos.length > 0) {
              const decisor = contatos.find((c) => c.getBool('decisor') === true) || contatos[0]
              if (decisor && decisor.getString('email')) {
                destinatarioEmail = decisor.getString('email').trim().toLowerCase()
                if (!destinatarioNome) destinatarioNome = decisor.getString('nome') || ''
              }
            }
          } catch (_) {}

          if (!destinatarioEmail) {
            try {
              const emp = $app.findRecordById('empresas', empId)
              if (emp && emp.getString('email')) {
                destinatarioEmail = emp.getString('email').trim().toLowerCase()
                if (!destinatarioNome) {
                  destinatarioNome =
                    emp.getString('razao_social') || emp.getString('nome_fantasia') || 'Cliente'
                }
              }
            } catch (_) {}
          }
        }
      }

      if (!destinatarioEmail) {
        return e.json(400, {
          message:
            'Não foi possível identificar o e-mail do cliente. Informe o endereço de destino no formulário.',
        })
      }

      if (!destinatarioNome) {
        destinatarioNome = 'Cliente'
      }

      // Verificação da lista "Não Contatar" (regra de plataforma)
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
        console.warn('[contratos_envio] Erro ao consultar lista nao_contatar:', ncErr)
      }

      // URL pública do contrato para assinatura eletrônica
      const baseUrl =
        typeof getAppBaseUrl === 'function'
          ? getAppBaseUrl()
          : $os.getenv('PUBLIC_APP_URL') ||
            'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
      const tokenAssinatura = contrato.getString('token_assinatura_cliente')
      const linkPublico = baseUrl + '/contrato/' + tokenAssinatura
      const linkDescadastro =
        baseUrl + '/descadastro?email=' + encodeURIComponent(destinatarioEmail)

      const contratoNumero = contrato.getString('numero') || 'CTR'
      const objeto = contrato.getString('objeto') || 'Prestação de serviços técnicos de engenharia'
      const valorTotal = contrato.getFloat('valor_total') || 0
      const valorFmt =
        'R$ ' +
        valorTotal
          .toFixed(2)
          .replace('.', ',')
          .replace(/\B(?=(\d{3})+(?!\d))/g, '.')

      const prazoDias = contrato.getInt('prazo_dias') || 30
      const assuntoFinal =
        assuntoCustomizado ||
        'Contrato de Prestação de Serviços ' + contratoNumero + ' — G+ Engenharia'

      const textoPrincipalHtml = corpoCustomizado
        ? corpoCustomizado.replace(/\n/g, '<br/>')
        : 'Encaminhamos para sua conferência e assinatura eletrônica o <strong>Contrato de Prestação de Serviços ' +
          contratoNumero +
          '</strong>.<br/><br/>' +
          'O documento já foi devidamente formalizado e assinado pela Diretoria da <strong>G+ Engenharia</strong>. ' +
          'Para formalizar o seu aceite e iniciar os trabalhos de engenharia, acesse o link seguro abaixo:'

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
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(217, 90, 43, 0.2); border: 1px solid #D95A2B; color: #ffedd5; font-size: 11px; font-weight: 600; border-radius: 4px;">CONTRATO DE SERVIÇOS</span>
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
                  <td width="35%" style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Instrumento:</td>
                  <td style="color: #0f172a; font-weight: bold; border-bottom: 1px solid #edf2f7;">${contratoNumero}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Objeto:</td>
                  <td style="color: #0f172a; border-bottom: 1px solid #edf2f7;">${objeto}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #edf2f7;">Valor Global:</td>
                  <td style="color: #D95A2B; font-weight: bold; font-size: 15px; border-bottom: 1px solid #edf2f7;">${valorFmt}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Prazo Estimado:</td>
                  <td style="color: #0f172a;">${prazoDias} dias</td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${linkPublico}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #D95A2B; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 6px; box-shadow: 0 2px 4px rgba(217, 90, 43, 0.3);">
                      Assinar Contrato Online &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                Caso o botão acima não funcione, acesse copiando e colando o endereço abaixo:<br/>
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
                Se não deseja mais receber comunicados deste contrato, <a href="${linkDescadastro}" style="color: #64748b; text-decoration: underline;">clique aqui para descadastrar-se</a>.
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

      const clientIp =
        (e.request &&
          typeof e.request.getHeader === 'function' &&
          (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

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
        console.error('[contratos_envio] Falha no mailClient.send:', sendErr)
        return e.json(500, {
          message:
            'Falha no servidor de e-mail ao enviar o contrato: ' +
            (sendErr.message || String(sendErr)),
        })
      }

      // Registro de auditoria do disparo com quem/quando/para quem/IP
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authRecord.id)
        aRec.set('user_email', authRecord.getString('email') || '')
        aRec.set('acao', 'ENVIO_CONTRATO')
        aRec.set('entidade', 'contratos_servico')
        aRec.set('registro_id', contrato.id)
        aRec.set('detalhes', {
          origem: 'DISPARO_MANUAL_SISTEMA',
          canal: 'email',
          mensagem:
            'Contrato ' +
            contratoNumero +
            ' enviado por e-mail para ' +
            destinatarioEmail +
            ' por ' +
            authRecord.getString('name'),
          contrato_id: contrato.id,
          contrato_numero: contratoNumero,
          destinatario_nome: destinatarioNome,
          destinatario_email: destinatarioEmail,
          assunto: assuntoFinal,
          remetente_id: authRecord.id,
          remetente_nome: authRecord.getString('name'),
          data_envio: new Date().toISOString(),
          ip: clientIp,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (auditErr) {
        console.warn('[contratos_envio] Falha ao registrar auditoria:', auditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Contrato enviado por e-mail com sucesso para ' + destinatarioEmail + '.',
        contrato_id: contrato.id,
        contrato_numero: contratoNumero,
      })
    } catch (err) {
      console.log('Erro ao enviar contrato por e-mail: ' + err)
      return e.json(500, { message: 'Erro interno ao enviar contrato: ' + err })
    }
  },
  $apis.requireAuth(),
)
