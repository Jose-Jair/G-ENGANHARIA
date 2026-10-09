// Hook to guard inactivation (only admin can move to inativa or update an inativa status)
// and automatic suggested reactivation generation when a new active contract is added to an inactive/nutricao company
// and Cadência de 5 toques server-side rules:
// - Bloquear início de cadência para empresa parceira
// - Gerar automaticamente 5 toques calculados a partir dos parâmetros quando empresa entra em "em_cadencia"
// - Atualizar proxima_acao_data e proxima_acao_desc da empresa a partir do próximo toque ativo

onRecordUpdateRequest((e) => {
  // Funções auxiliares declaradas DENTRO do escopo do callback para compatibilidade com o JSVM
  function validarCnpjMod11(cnpjVal) {
    if (!cnpjVal) return false
    const limpo = String(cnpjVal).replace(/\D/g, '')
    if (limpo.length !== 14) return false
    if (/^(\d)\1{13}$/.test(limpo)) return false

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < 12; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos1[i]
    }
    let resto = soma % 11
    const dig1 = resto < 2 ? 0 : 11 - resto
    if (parseInt(limpo.charAt(12), 10) !== dig1) return false

    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = 0
    for (let i = 0; i < 13; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos2[i]
    }
    resto = soma % 11
    const dig2 = resto < 2 ? 0 : 11 - resto
    return parseInt(limpo.charAt(13), 10) === dig2
  }

  function checarRequisitosQualificacaoEmpresa(empRec) {
    const pendencias = []

    const rSocial = (empRec.getString('razao_social') || '').trim()
    if (!rSocial) pendencias.push('razão social')

    const cCnpj = (empRec.getString('cnpj') || '').trim()
    if (!cCnpj || !validarCnpjMod11(cCnpj)) {
      pendencias.push('CNPJ válido')
    }

    const eMail = (empRec.getString('email') || '').trim()
    if (!eMail) pendencias.push('e-mail')

    const tTel = (empRec.getString('telefone') || '').trim()
    if (!tTel) pendencias.push('telefone')

    const rResp = (empRec.getString('responsavel') || '').trim()
    if (!rResp) pendencias.push('responsável interno atribuído')

    // Verificar contato decisor da empresa
    let temDecisorValido = false
    const empId = empRec.id
    if (empId) {
      try {
        const contatosDecisores = $app.findRecordsByFilter(
          'contatos',
          'empresa = {:empId} && decisor = true',
          '-created',
          50,
          0,
          { empId: empId },
        )
        for (let c = 0; c < contatosDecisores.length; c++) {
          const cRec = contatosDecisores[c]
          const cEmail = (cRec.getString('email') || '').trim()
          const cTelefone = (cRec.getString('telefone') || '').trim()
          if (cEmail && cTelefone) {
            temDecisorValido = true
            break
          }
        }
      } catch (errDec) {
        console.log('Erro ao checar contatos decisores: ' + errDec)
      }
    }

    if (!temDecisorValido) {
      pendencias.push('contato decisor com e-mail e telefone')
    }

    return pendencias
  }

  try {
    const auth = e.auth
    const original = e.record.original()
    const newEtapa = e.record.getString('etapa_funil')
    const oldEtapa = original ? original.getString('etapa_funil') : ''
    const newStatus = e.record.getString('status')
    const oldStatus = original ? original.getString('status') : ''

    const role = auth ? auth.getString('role') : ''

    // Se estiver tentando inativar (etapa_funil = 'inativa' ou status = 'inativa') e o usuário não for admin
    const tryingToInactivate =
      (newEtapa === 'inativa' && oldEtapa !== 'inativa') ||
      (newStatus === 'inativa' && oldStatus !== 'inativa')

    if (tryingToInactivate && role !== 'admin') {
      throw new ForbiddenError(
        'Apenas administradores podem inativar empresas no funil de intermediação.',
      )
    }

    // Regra: EMPRESA PARCEIRA NÃO ENTRA NA CADÊNCIA — bloquear no servidor (hook)
    if (newEtapa === 'em_cadencia' && oldEtapa === 'parceira') {
      throw new BadRequestError(
        'Empresas já homologadas como Parceiras não podem ser incluídas na cadência de prospecção.',
      )
    }

    // Regra da DECISÃO DO USUÁRIO:
    // O kanban principal é de LEADS. Parceiro nasce SOMENTE da conversão (proposta aceita -> projeto), nunca de arrastar.
    // Bloquear drag manual para 'parceira'
    if (newEtapa === 'parceira' && oldEtapa !== 'parceira') {
      // Se não houver proposta aceita ou contrato ativo e for edição interativa do usuário
      const empId = e.record.id
      let temPropostaAceita = false
      if (empId) {
        try {
          const pAceita = $app.findFirstRecordByFilter(
            'propostas',
            'empresa = {:empId} && status = "aceita"',
            { empId: empId },
          )
          if (pAceita) temPropostaAceita = true
        } catch (_) {}
      }
      if (!temPropostaAceita) {
        throw new BadRequestError(
          'Parceiro nasce somente da conversão (proposta aceita -> projeto), nunca por movimentação manual no kanban.',
        )
      }
    }

    // Se estiver mudando de etapa, registrar no campo etapa_anterior para permitir restauração
    if (newEtapa && oldEtapa && newEtapa !== oldEtapa && newEtapa === 'inativa') {
      e.record.set('etapa_anterior', oldEtapa)
    }

    // =========================================================================
    // ENTREGA 1 — TRAVA DE QUALIFICAÇÃO (identificada -> qualificada)
    // =========================================================================
    if (newEtapa === 'qualificada' && oldEtapa !== 'qualificada') {
      const pendencias = checarRequisitosQualificacaoEmpresa(e.record)
      if (pendencias.length > 0) {
        throw new BadRequestError(
          'Para avançar para Qualificada, complete: ' + pendencias.join(', ') + '.',
        )
      }
    }

    // =========================================================================
    // ENTREGA 1 — TRANSIÇÃO AUTOMÁTICA: ao salvar/editar empresa identificada
    // com todos os requisitos atendidos, o servidor move para qualificada sozinho.
    // =========================================================================
    if (newEtapa === 'identificada' && (oldEtapa === 'identificada' || !oldEtapa)) {
      const pendencias = checarRequisitosQualificacaoEmpresa(e.record)
      if (pendencias.length === 0) {
        e.record.set('etapa_anterior', 'identificada')
        e.record.set('etapa_funil', 'qualificada')
        e.record.set(
          'observacoes',
          (e.record.getString('observacoes') || '') +
            '\n[Qualificação Automática]: Todos os requisitos foram preenchidos em ' +
            new Date().toISOString(),
        )
      }
    }
  } catch (err) {
    throw err
  }

  e.next()
}, 'empresas')

// Hook onRecordAfterUpdateSuccess for empresas:
// When empresa enters 'em_cadencia', generate the 5 toques if not already present or active
onRecordAfterUpdateSuccess((e) => {
  try {
    const empresa = e.record
    const original = empresa.original()
    const newEtapa = empresa.getString('etapa_funil')
    const oldEtapa = original ? original.getString('etapa_funil') : ''

    // Se houve transição automática para qualificada (identificada -> qualificada sem intervenção manual de drag)
    if (newEtapa === 'qualificada' && oldEtapa === 'identificada') {
      try {
        const obsAtual = empresa.getString('observacoes') || ''
        if (obsAtual.indexOf('[Qualificação Automática]') !== -1) {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', e.auth ? e.auth.id : null)
          aRec.set('user_email', e.auth ? e.auth.getString('email') : 'SISTEMA')
          aRec.set('acao', 'QUALIFICACAO_AUTOMATICA')
          aRec.set('entidade', 'empresas')
          aRec.set('registro_id', empresa.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Empresa avançou automaticamente de Identificada para Qualificada ao cumprir todos os requisitos cadastrais.',
            empresa_id: empresa.id,
            razao_social: empresa.getString('razao_social'),
            cnpj: empresa.getString('cnpj'),
          })
          $app.save(aRec)
        }
      } catch (errAuditQualif) {
        console.log('Erro ao auditar qualificacao automatica: ' + errAuditQualif)
      }
    }

    if (newEtapa === 'em_cadencia' && oldEtapa !== 'em_cadencia') {
      const empresaId = empresa.id

      // Check if there are already toques for this empresa
      const existingToques = $app.findRecordsByFilter(
        'toques',
        "empresa = '" + empresaId + "' && status != 'cancelado'",
        'numero_toque',
        10,
        0,
      )

      if (existingToques.length === 0) {
        // Obter parâmetros de dias
        let t2Dias = 2
        let t3Dias = 7
        let t4Dias = 12
        let t5Dias = 30

        try {
          const p2 = $app.findFirstRecordByData('parametros', 'chave', 'toque2_dias')
          if (p2) t2Dias = parseInt(p2.getString('valor'), 10) || 2
        } catch (_) {}

        try {
          const p3 = $app.findFirstRecordByData('parametros', 'chave', 'toque3_dias')
          if (p3) t3Dias = parseInt(p3.getString('valor'), 10) || 7
        } catch (_) {}

        try {
          const p4 = $app.findFirstRecordByData('parametros', 'chave', 'toque4_dias_inicio')
          if (p4) t4Dias = parseInt(p4.getString('valor'), 10) || 12
        } catch (_) {}

        try {
          const p5 = $app.findFirstRecordByData('parametros', 'chave', 'toque5_dias')
          if (p5) t5Dias = parseInt(p5.getString('valor'), 10) || 30
        } catch (_) {}

        const now = new Date()
        const toDateString = (d) => {
          return d.toISOString().substring(0, 10) + ' 12:00:00.000Z'
        }

        const addDays = (baseDate, days) => {
          const d = new Date(baseDate.getTime())
          d.setDate(d.getDate() + days)
          return d
        }

        const d0 = toDateString(now)
        const d2 = toDateString(addDays(now, t2Dias))
        const d7 = toDateString(addDays(now, t3Dias))
        const d12 = toDateString(addDays(now, t4Dias))
        const d30 = toDateString(addDays(now, t5Dias))

        const toquesCol = $app.findCollectionByNameOrId('toques')

        const toquesDef = [
          {
            num: 1,
            canal: 'email',
            data: d0,
            obs: 'Toque 1 institucional de apresentação e credenciamento.',
          },
          { num: 2, canal: 'whatsapp', data: d2, obs: 'Toque 2 de retomada via WhatsApp.' },
          {
            num: 3,
            canal: 'email',
            data: d7,
            obs: 'Toque 3 de solução técnica elaborada e viabilidade.',
          },
          { num: 4, canal: 'whatsapp', data: d12, obs: 'Toque 4 de retomada via WhatsApp.' },
          {
            num: 5,
            canal: 'email',
            data: d30,
            obs: 'Toque 5 de oferta de projeto piloto preliminar sem risco.',
          },
        ]

        for (let i = 0; i < toquesDef.length; i++) {
          const td = toquesDef[i]
          const rec = new Record(toquesCol)
          rec.set('empresa', empresaId)
          rec.set('numero_toque', td.num)
          rec.set('canal', td.canal)
          rec.set('data_prevista', td.data)
          rec.set('status', 'agendado')
          rec.set('observacao', td.obs)
          $app.save(rec)
        }

        // Atualizar campos da empresa com a próxima ação real (Toque 1)
        empresa.set('proxima_acao_data', d0)
        empresa.set('proxima_acao_desc', 'Toque 1: E-mail Institucional (D0)')
        $app.save(empresa)

        // Registrar auditoria específica do início da cadência
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', null)
          aRec.set('user_email', 'SISTEMA')
          aRec.set('acao', 'INICIO_CADENCIA')
          aRec.set('entidade', 'toques')
          aRec.set('registro_id', empresaId)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Cadência padrão de 5 toques gerada automaticamente na entrada da etapa Em cadência.',
            empresa_id: empresaId,
            empresa_nome: empresa.getString('razao_social'),
          })
          $app.save(aRec)
        } catch (_) {}
      }
    }
  } catch (err) {
    console.log('Erro ao processar início de cadência da empresa: ' + err)
  } finally {
    e.next()
  }
}, 'empresas')

// Hook on contratos creation: if empresa is in 'nutricao_mensal' or 'inativa', create reativacao_sugerida
// Ao adicionar ou alterar contatos de uma empresa, verificar se a empresa está em 'identificada'
// e passou a atender todos os requisitos de qualificação (incluindo contato decisor com email e telefone)
onRecordAfterCreateSuccess((e) => {
  function validarCnpjMod11(cnpjVal) {
    if (!cnpjVal) return false
    const limpo = String(cnpjVal).replace(/\D/g, '')
    if (limpo.length !== 14) return false
    if (/^(\d)\1{13}$/.test(limpo)) return false

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < 12; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos1[i]
    }
    let resto = soma % 11
    const dig1 = resto < 2 ? 0 : 11 - resto
    if (parseInt(limpo.charAt(12), 10) !== dig1) return false

    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = 0
    for (let i = 0; i < 13; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos2[i]
    }
    resto = soma % 11
    const dig2 = resto < 2 ? 0 : 11 - resto
    return parseInt(limpo.charAt(13), 10) === dig2
  }

  function checarRequisitos(empRec) {
    const pendencias = []
    const rSocial = (empRec.getString('razao_social') || '').trim()
    if (!rSocial) pendencias.push('razão social')

    const cCnpj = (empRec.getString('cnpj') || '').trim()
    if (!cCnpj || !validarCnpjMod11(cCnpj)) pendencias.push('CNPJ válido')

    const eMail = (empRec.getString('email') || '').trim()
    if (!eMail) pendencias.push('e-mail')

    const tTel = (empRec.getString('telefone') || '').trim()
    if (!tTel) pendencias.push('telefone')

    const rResp = (empRec.getString('responsavel') || '').trim()
    if (!rResp) pendencias.push('responsável interno atribuído')

    let temDecisorValido = false
    const empId = empRec.id
    if (empId) {
      try {
        const contatosDecisores = $app.findRecordsByFilter(
          'contatos',
          'empresa = {:empId} && decisor = true',
          '-created',
          50,
          0,
          { empId: empId },
        )
        for (let c = 0; c < contatosDecisores.length; c++) {
          const cRec = contatosDecisores[c]
          const cEmail = (cRec.getString('email') || '').trim()
          const cTelefone = (cRec.getString('telefone') || '').trim()
          if (cEmail && cTelefone) {
            temDecisorValido = true
            break
          }
        }
      } catch (_) {}
    }
    if (!temDecisorValido) pendencias.push('contato decisor com e-mail e telefone')
    return pendencias
  }

  try {
    const contato = e.record
    const empresaId = contato.getString('empresa')
    if (!empresaId) return

    const empresa = $app.findRecordById('empresas', empresaId)
    if (!empresa) return

    if (empresa.getString('etapa_funil') === 'identificada') {
      const pendencias = checarRequisitos(empresa)
      if (pendencias.length === 0) {
        empresa.set('etapa_anterior', 'identificada')
        empresa.set('etapa_funil', 'qualificada')
        empresa.set(
          'observacoes',
          (empresa.getString('observacoes') || '') +
            '\n[Qualificação Automática]: Todos os requisitos foram preenchidos (contato decisor adicionado) em ' +
            new Date().toISOString(),
        )
        $app.save(empresa)

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', e.auth ? e.auth.id : null)
          aRec.set('user_email', e.auth ? e.auth.getString('email') : 'SISTEMA')
          aRec.set('acao', 'QUALIFICACAO_AUTOMATICA')
          aRec.set('entidade', 'empresas')
          aRec.set('registro_id', empresa.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Empresa avançou automaticamente de Identificada para Qualificada ao cadastrar contato decisor com e-mail e telefone.',
            empresa_id: empresa.id,
            razao_social: empresa.getString('razao_social'),
            cnpj: empresa.getString('cnpj'),
          })
          $app.save(aRec)
        } catch (_) {}
      }
    }
  } catch (errContatoCriado) {
    console.log('Erro ao checar qualificacao automatica apos contato: ' + errContatoCriado)
  } finally {
    e.next()
  }
}, 'contatos')

onRecordAfterUpdateSuccess((e) => {
  function validarCnpjMod11(cnpjVal) {
    if (!cnpjVal) return false
    const limpo = String(cnpjVal).replace(/\D/g, '')
    if (limpo.length !== 14) return false
    if (/^(\d)\1{13}$/.test(limpo)) return false

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < 12; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos1[i]
    }
    let resto = soma % 11
    const dig1 = resto < 2 ? 0 : 11 - resto
    if (parseInt(limpo.charAt(12), 10) !== dig1) return false

    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = 0
    for (let i = 0; i < 13; i++) {
      soma += parseInt(limpo.charAt(i), 10) * pesos2[i]
    }
    resto = soma % 11
    const dig2 = resto < 2 ? 0 : 11 - resto
    return parseInt(limpo.charAt(13), 10) === dig2
  }

  function checarRequisitos(empRec) {
    const pendencias = []
    const rSocial = (empRec.getString('razao_social') || '').trim()
    if (!rSocial) pendencias.push('razão social')

    const cCnpj = (empRec.getString('cnpj') || '').trim()
    if (!cCnpj || !validarCnpjMod11(cCnpj)) pendencias.push('CNPJ válido')

    const eMail = (empRec.getString('email') || '').trim()
    if (!eMail) pendencias.push('e-mail')

    const tTel = (empRec.getString('telefone') || '').trim()
    if (!tTel) pendencias.push('telefone')

    const rResp = (empRec.getString('responsavel') || '').trim()
    if (!rResp) pendencias.push('responsável interno atribuído')

    let temDecisorValido = false
    const empId = empRec.id
    if (empId) {
      try {
        const contatosDecisores = $app.findRecordsByFilter(
          'contatos',
          'empresa = {:empId} && decisor = true',
          '-created',
          50,
          0,
          { empId: empId },
        )
        for (let c = 0; c < contatosDecisores.length; c++) {
          const cRec = contatosDecisores[c]
          const cEmail = (cRec.getString('email') || '').trim()
          const cTelefone = (cRec.getString('telefone') || '').trim()
          if (cEmail && cTelefone) {
            temDecisorValido = true
            break
          }
        }
      } catch (_) {}
    }
    if (!temDecisorValido) pendencias.push('contato decisor com e-mail e telefone')
    return pendencias
  }

  try {
    const contato = e.record
    const empresaId = contato.getString('empresa')
    if (!empresaId) return

    const empresa = $app.findRecordById('empresas', empresaId)
    if (!empresa) return

    if (empresa.getString('etapa_funil') === 'identificada') {
      const pendencias = checarRequisitos(empresa)
      if (pendencias.length === 0) {
        empresa.set('etapa_anterior', 'identificada')
        empresa.set('etapa_funil', 'qualificada')
        empresa.set(
          'observacoes',
          (empresa.getString('observacoes') || '') +
            '\n[Qualificação Automática]: Todos os requisitos foram preenchidos (contato decisor atualizado) em ' +
            new Date().toISOString(),
        )
        $app.save(empresa)

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('user', e.auth ? e.auth.id : null)
          aRec.set('user_email', e.auth ? e.auth.getString('email') : 'SISTEMA')
          aRec.set('acao', 'QUALIFICACAO_AUTOMATICA')
          aRec.set('entidade', 'empresas')
          aRec.set('registro_id', empresa.id)
          aRec.set('detalhes', {
            origem: 'SISTEMA / GATILHO AUTOMÁTICO',
            mensagem:
              'Empresa avançou automaticamente de Identificada para Qualificada ao atualizar contato decisor com e-mail e telefone.',
            empresa_id: empresa.id,
            razao_social: empresa.getString('razao_social'),
            cnpj: empresa.getString('cnpj'),
          })
          $app.save(aRec)
        } catch (_) {}
      }
    }
  } catch (errContatoAtualizado) {
    console.log(
      'Erro ao checar qualificacao automatica apos atualizar contato: ' + errContatoAtualizado,
    )
  } finally {
    e.next()
  }
}, 'contatos')

// Hook on contratos creation: if empresa is in 'nutricao_mensal' or 'inativa', create reativacao_sugerida
onRecordAfterCreateSuccess((e) => {
  try {
    const contrato = e.record
    const empresaId = contrato.getString('empresa')
    if (!empresaId) return

    const empresa = $app.findRecordById('empresas', empresaId)
    if (!empresa) return

    const etapa = empresa.getString('etapa_funil')
    const status = empresa.getString('status')

    if (etapa === 'nutricao_mensal' || etapa === 'inativa' || status === 'inativa') {
      const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')
      const reatRec = new Record(reativacoesCol)

      reatRec.set('empresa', empresa.id)
      reatRec.set('contrato', contrato.id)
      reatRec.set('contrato_numero', contrato.getString('numero') || '')
      reatRec.set('contrato_orgao', contrato.getString('orgao') || '')
      reatRec.set('contrato_valor', contrato.getFloat('valor') || 0)
      reatRec.set('etapa_origem', etapa || status || 'nutricao_mensal')
      reatRec.set('status', 'pendente')

      $app.save(reatRec)
    }
  } catch (err) {
    console.log('Erro ao processar sugestao de reativacao por novo contrato: ' + err)
  } finally {
    e.next()
  }
}, 'contratos')
