// Hook de Validação Server-side, Sincronização de Campos Canônicos,
// Homologação e Bloqueios de Cotação de Executores (G+ Engenharia)

// -----------------------------------------------------------------------------
// 1. Hook onRecordValidate em executores:
//    - Sincronização de campos legados <-> canônicos
//    - Validação rígida de CPF x CNPJ conforme Tipo (PF só CPF, PJ só CNPJ)
//    - Validação de dígitos verificadores
//    - Bloqueio de duplicidade de documento
//    - Validação de formato de registro no conselho
//    - Validação de que validade_registro não pode estar no passado no ato do cadastro
//    - Validação de checklist mínimo para transição homologacao -> ativo
// -----------------------------------------------------------------------------
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name !== 'executores') {
    e.next()
    return
  }

  // Funções utilitárias inline para isolamento de escopo por callback
  function cleanDocDigits(val) {
    if (!val) return ''
    return String(val).replace(/\D/g, '')
  }

  function isValidCpfDigits(cpfRaw) {
    const clean = cleanDocDigits(cpfRaw)
    if (!clean || clean.length !== 11) return false
    if (/^(\d)\1{10}$/.test(clean)) return false

    let soma = 0
    for (let i = 0; i < 9; i++) {
      soma += parseInt(clean.charAt(i), 10) * (10 - i)
    }
    let resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(clean.charAt(9), 10)) return false

    soma = 0
    for (let i = 0; i < 10; i++) {
      soma += parseInt(clean.charAt(i), 10) * (11 - i)
    }
    resto = (soma * 10) % 11
    if (resto === 10 || resto === 11) resto = 0
    if (resto !== parseInt(clean.charAt(10), 10)) return false

    return true
  }

  function isValidCnpjDigits(cnpjRaw) {
    const clean = cleanDocDigits(cnpjRaw)
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

  function isValidNumeroRegistroPorClasse(conselhoClasse, numeroReg) {
    if (!numeroReg) return false
    const limpo = String(numeroReg).trim().toUpperCase()
    if (limpo.length < 3) return false

    const cClasse = (conselhoClasse || '').trim().toUpperCase()

    if (cClasse === 'CREA') {
      const digitos = limpo.replace(/\D/g, '')
      if (digitos.length < 4 || digitos.length > 14) return false
      const regexCrea = /^(CREA[- ]?([A-Z]{2})?[- ]?)?\d{1,10}([\.\-\/][A-Z0-9]+)*$/i
      return regexCrea.test(limpo)
    }

    if (cClasse === 'CAU') {
      const digitos = limpo.replace(/\D/g, '')
      if (digitos.length < 4 || digitos.length > 10) return false
      const regexCau = /^(CAU[- ]?)?(A)?\d{4,8}([\-\/][A-Z0-9]+)?$/i
      return regexCau.test(limpo)
    }

    if (cClasse === 'CFT') {
      const digitos = limpo.replace(/\D/g, '')
      if (digitos.length < 4 || digitos.length > 14) return false
      const regexCft = /^(CFT|CRT[- ]?([0-9]{1,2}|[A-Z]{2})?[- ]?)?\d{4,12}([\.\-\/][A-Z0-9]+)*$/i
      return regexCft.test(limpo)
    }

    return limpo.length >= 3
  }

  // (A) SINCRONIZAÇÃO DE CAMPOS LEGADOS <-> CANÔNICOS
  // Canônicos: conselho, numero_registro, conselho_validade, nda_contrato
  // Legados: conselho_classe, numero_registro_conselho, validade_registro_conselho, documento_termo
  const conselhoCanonico = rec.getString('conselho') || rec.getString('conselho_classe') || ''
  const numeroRegistroCanonico =
    rec.getString('numero_registro') || rec.getString('numero_registro_conselho') || ''
  const validadeCanonico =
    rec.getString('conselho_validade') || rec.getString('validade_registro_conselho') || ''
  const termoCanonico = rec.getString('nda_contrato') || rec.getString('documento_termo') || ''

  // Normalizar ambos no record para manter paridade e blindar consultas legadas
  if (conselhoCanonico) {
    rec.set('conselho', conselhoCanonico)
    rec.set('conselho_classe', conselhoCanonico)
  }
  if (numeroRegistroCanonico) {
    rec.set('numero_registro', numeroRegistroCanonico)
    rec.set('numero_registro_conselho', numeroRegistroCanonico)
  }
  if (validadeCanonico) {
    rec.set('conselho_validade', validadeCanonico)
    rec.set('validade_registro_conselho', validadeCanonico)
  }
  if (termoCanonico) {
    rec.set('nda_contrato', termoCanonico)
    rec.set('documento_termo', termoCanonico)
  }

  // Validação de tipo e formato de arquivo anexado
  const extensoesValidas = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']
  if (termoCanonico) {
    const ext = termoCanonico.split('.').pop().toLowerCase()
    if (ext && !extensoesValidas.includes(ext)) {
      throw new BadRequestError(
        'VAL_ARQUIVO_INVALIDO: O documento anexado deve ser nos formatos PDF, DOC, DOCX ou Imagem (PNG/JPG).',
      )
    }
  }

  // (B) VALIDAÇÃO DE CPF / CNPJ E TIPO (PF vs PJ)
  const tipo = (rec.getString('tipo') || 'PF').toUpperCase()
  const cpfCnpjRaw = (rec.getString('cpf_cnpj') || '').trim()
  const docDigits = cleanDocDigits(cpfCnpjRaw)

  // Se estiver preenchendo documento
  if (docDigits) {
    if (tipo === 'PF') {
      if (docDigits.length !== 11) {
        throw new BadRequestError(
          'VAL_DOC_INVALIDO: Executor Pessoa Física (PF) deve possuir um CPF com 11 dígitos.',
        )
      }
      if (!isValidCpfDigits(docDigits)) {
        throw new BadRequestError(
          'VAL_CPF_INVALIDO: O CPF informado é inválido no cálculo dos dígitos verificadores.',
        )
      }
    } else if (tipo === 'PJ') {
      if (docDigits.length !== 14) {
        throw new BadRequestError(
          'VAL_DOC_INVALIDO: Executor Pessoa Jurídica (PJ) deve possuir um CNPJ com 14 dígitos.',
        )
      }
      if (!isValidCnpjDigits(docDigits)) {
        throw new BadRequestError(
          'VAL_CNPJ_INVALIDO: O CNPJ informado é inválido no cálculo dos dígitos verificadores.',
        )
      }
    } else {
      throw new BadRequestError(
        "VAL_TIPO_INVALIDO: Tipo de executor inválido. Utilize 'PF' ou 'PJ'.",
      )
    }

    // BLOQUEIO DE DUPLICIDADE DE DOCUMENTO (CPF/CNPJ)
    try {
      const todosComDoc = $app.findRecordsByFilter(
        'executores',
        "id != '" + rec.id + "' && cpf_cnpj != ''",
        '',
        500,
        0,
      )
      for (let i = 0; i < todosComDoc.length; i++) {
        const outEx = todosComDoc[i]
        const outDocDigits = cleanDocDigits(outEx.getString('cpf_cnpj'))
        if (outDocDigits === docDigits) {
          throw new BadRequestError(
            'DUPLICIDADE_DOCUMENTO: Já existe outro executor cadastrado com este ' +
              (tipo === 'PF' ? 'CPF' : 'CNPJ') +
              " ('" +
              outEx.getString('nome') +
              "', ID: " +
              outEx.id +
              ').',
          )
        }
      }
    } catch (errDup) {
      if (errDup && errDup.message && errDup.message.startsWith('DUPLICIDADE_DOCUMENTO:')) {
        throw errDup
      }
    }
  }

  // (C) VALIDAÇÃO DE REGISTRO NO CONSELHO DE CLASSE
  if (numeroRegistroCanonico) {
    const conselhoVal = conselhoCanonico || 'CREA'
    if (!isValidNumeroRegistroPorClasse(conselhoVal, numeroRegistroCanonico)) {
      throw new BadRequestError(
        'VAL_REGISTRO_INVALIDO: O formato do registro profissional é inválido para a classe ' +
          conselhoVal +
          " ('" +
          numeroRegistroCanonico +
          "').",
      )
    }
  }

  // (D) VALIDAÇÃO DE DATA DE VALIDADE DO CONSELHO
  // No ato do cadastro/criação, ou quando a data é modificada para um novo valor, a validade não pode estar no passado
  const isNew = !rec.id || !rec.original()
  const original = rec.original()
  const validadeOriginal = original ? original.getString('conselho_validade') : ''

  if (validadeCanonico && (isNew || validadeCanonico !== validadeOriginal)) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const strDataYmd = validadeCanonico.substring(0, 10)
    const dataVal = new Date(strDataYmd + 'T23:59:59.000Z')
    if (dataVal < hoje) {
      throw new BadRequestError(
        'VAL_CONSELHO_VENCIDO: A validade do registro de classe não pode ser cadastrada no passado (' +
          strDataYmd +
          '). O executor precisa possuir certidão/anotação válida.',
      )
    }
  }

  // (E) CHECKLIST MÍNIMO NO SERVIDOR PARA ATIVAÇÃO (homologacao -> ativo)
  const statusNovo = rec.getString('status')
  const statusAnterior = original ? original.getString('status') : ''

  if (statusNovo === 'ativo' && statusAnterior === 'homologacao') {
    // 1. Documento do conselho com validade futura
    if (!validadeCanonico) {
      throw new BadRequestError(
        'BLOQUEIO_HOMOLOGACAO: Não é possível ativar o executor sem a data de validade do conselho preenchida.',
      )
    }
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const strValidade = validadeCanonico.substring(0, 10)
    const dtVal = new Date(strValidade + 'T23:59:59.000Z')
    if (dtVal < hoje) {
      throw new BadRequestError(
        'BLOQUEIO_HOMOLOGACAO: O registro de classe do executor está VENCIDO (' +
          strValidade +
          '). Regularize a anuidade antes de ativar.',
      )
    }

    // 2. Dados bancários preenchidos
    const dadosBancarios = (rec.getString('dados_bancarios') || '').trim()
    if (!dadosBancarios || dadosBancarios.length < 5) {
      throw new BadRequestError(
        'BLOQUEIO_HOMOLOGACAO: Os dados bancários do executor são obrigatórios para homologação e ativação na base.',
      )
    }

    // 3. Termo/NDA anexado
    if (!termoCanonico) {
      throw new BadRequestError(
        'BLOQUEIO_HOMOLOGACAO: É obrigatório anexar o Termo de Credenciamento ou NDA assinado para ativar o executor.',
      )
    }
  }

  e.next()
})

// -----------------------------------------------------------------------------
// 2. Auditoria e Sincronização pós-salvamento:
//    - Auditoria de ATIVACAO_EXECUTOR (quem, quando, o quê)
// -----------------------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (rec.collection().name === 'executores') {
    const statusNovo = rec.getString('status')
    const original = rec.original()
    const statusAnterior = original ? original.getString('status') : ''

    if (statusNovo === 'ativo' && statusAnterior === 'homologacao') {
      try {
        const httpCtx = e.httpContext
        const authUser = httpCtx ? httpCtx.auth : null
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', 'ATIVACAO_EXECUTOR')
        aRec.set('entidade', 'executores')
        aRec.set('registro_id', rec.id)
        aRec.set('user', authUser ? authUser.id : null)
        aRec.set(
          'user_email',
          authUser ? authUser.getString('email') : 'sistema@gmaisengenharia.com.br',
        )
        aRec.set('ip', (httpCtx && httpCtx.request && httpCtx.request.remoteAddr) || '127.0.0.1')
        aRec.set('detalhes', {
          origem: 'SISTEMA / HOMOLOGAÇÃO',
          executor_id: rec.id,
          nome: rec.getString('nome'),
          cpf_cnpj: rec.getString('cpf_cnpj'),
          conselho: rec.getString('conselho'),
          validade_conselho: rec.getString('conselho_validade'),
          termo_anexado: !!rec.getString('nda_contrato'),
          checklist_minimo: {
            validade_futura: true,
            dados_bancarios_preenchidos: true,
            termo_nda_anexado: true,
          },
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          ativado_por: authUser
            ? authUser.getString('name') || authUser.getString('email')
            : 'Admin',
          mensagem:
            'Executor ' +
            rec.getString('nome') +
            ' homologado e ativado com checklist mínimo verificado no servidor.',
        })
        $app.save(aRec)
      } catch (errAudit) {
        console.log('Erro ao auditar ATIVACAO_EXECUTOR: ' + errAudit)
      }
    }
  }
  e.next()
})

// -----------------------------------------------------------------------------
// 3. Bloqueio server-side de criação de cotações para executor com conselho vencido
// -----------------------------------------------------------------------------
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'cotacoes') {
    const executorId = rec.getString('executor')
    if (executorId) {
      try {
        const executor = $app.findRecordById('executores', executorId)
        if (executor) {
          // Bloqueio se executor estiver suspenso
          if (executor.getString('status') === 'suspenso') {
            throw new BadRequestError(
              'BLOQUEIO_COTACAO: Executor ' +
                executor.getString('nome') +
                ' está SUSPENSO e não pode receber convite para cotação.',
            )
          }

          // Bloqueio server-side se conselho estiver vencido
          const validadeStr =
            executor.getString('conselho_validade') ||
            executor.getString('validade_registro_conselho') ||
            ''
          if (validadeStr) {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const dtVal = new Date(validadeStr.substring(0, 10) + 'T23:59:59.000Z')
            if (dtVal < hoje) {
              throw new BadRequestError(
                'BLOQUEIO_COTACAO: O registro de classe do executor ' +
                  executor.getString('nome') +
                  ' (' +
                  (executor.getString('conselho') || 'Conselho') +
                  ') está VENCIDO em ' +
                  validadeStr.substring(0, 10) +
                  '. Não é permitido convidar executores com anotação vencida para cotações.',
              )
            }
          }
        }
      } catch (errEx) {
        if (errEx && errEx.message && errEx.message.startsWith('BLOQUEIO_COTACAO:')) {
          throw errEx
        }
      }
    }
  }
  e.next()
})
