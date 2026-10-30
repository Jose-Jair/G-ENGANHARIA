migrate(
  (app) => {
    // 1. API Rules das coleções cotacoes e subcontratos
    // Corrigir padrão vulnerável token != '' || (...) para exigir @request.query.token ou headers específicos
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')
    cotacoesCol.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.updateRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token != '' && (@request.query.token = token || token = @request.headers.x_token_cotacao))"
    cotacoesCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    if (!cotacoesCol.fields.getByName('token_expiracao')) {
      cotacoesCol.fields.add(new DateField({ name: 'token_expiracao' }))
    }
    if (!cotacoesCol.fields.getByName('tentativas_token')) {
      cotacoesCol.fields.add(new NumberField({ name: 'tentativas_token', min: 0, onlyInt: true }))
    }
    app.save(cotacoesCol)

    const subcontratosCol = app.findCollectionByNameOrId('subcontratos')
    subcontratosCol.listRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
    subcontratosCol.viewRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && executor.email = @request.auth.email))) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
    subcontratosCol.updateRule =
      "(@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')) || (token_assinatura != '' && (@request.query.token = token_assinatura || token_assinatura = @request.headers.x_token_assinatura))"
    subcontratosCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    if (!subcontratosCol.fields.getByName('token_expiracao')) {
      subcontratosCol.fields.add(new DateField({ name: 'token_expiracao' }))
    }
    if (!subcontratosCol.fields.getByName('tentativas_token')) {
      subcontratosCol.fields.add(
        new NumberField({ name: 'tentativas_token', min: 0, onlyInt: true }),
      )
    }
    app.save(subcontratosCol)

    // 2. Proteção contra escalonamento na coleção users
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'admin') && (@request.auth.role = 'admin' || (@request.body.role:changed = false && @request.body.active:changed = false && @request.body.cpf_cnpj:changed = false))"
    app.save(usersCol)

    // 3. Adicionar campos de expiração e tentativas em propostas, contratos_servico e executores
    const propostasCol = app.findCollectionByNameOrId('propostas')
    if (!propostasCol.fields.getByName('token_expiracao')) {
      propostasCol.fields.add(new DateField({ name: 'token_expiracao' }))
    }
    if (!propostasCol.fields.getByName('tentativas_token')) {
      propostasCol.fields.add(new NumberField({ name: 'tentativas_token', min: 0, onlyInt: true }))
    }
    app.save(propostasCol)

    const contratosServicoCol = app.findCollectionByNameOrId('contratos_servico')
    if (!contratosServicoCol.fields.getByName('token_expiracao')) {
      contratosServicoCol.fields.add(new DateField({ name: 'token_expiracao' }))
    }
    if (!contratosServicoCol.fields.getByName('tentativas_token')) {
      contratosServicoCol.fields.add(
        new NumberField({ name: 'tentativas_token', min: 0, onlyInt: true }),
      )
    }
    if (!contratosServicoCol.fields.getByName('token_complemento_expiracao')) {
      contratosServicoCol.fields.add(new DateField({ name: 'token_complemento_expiracao' }))
    }
    if (!contratosServicoCol.fields.getByName('tentativas_token_complemento')) {
      contratosServicoCol.fields.add(
        new NumberField({ name: 'tentativas_token_complemento', min: 0, onlyInt: true }),
      )
    }
    app.save(contratosServicoCol)

    const executoresCol = app.findCollectionByNameOrId('executores')
    if (!executoresCol.fields.getByName('tentativas_token')) {
      executoresCol.fields.add(new NumberField({ name: 'tentativas_token', min: 0, onlyInt: true }))
    }
    if (!executoresCol.fields.getByName('telefones')) {
      executoresCol.fields.add(new JSONField({ name: 'telefones' }))
    }
    app.save(executoresCol)

    // 4. Marcar arquivos sensíveis com protected: true
    const proFilesMap = [
      { col: 'executores', fields: ['nda_contrato', 'documento_termo'] },
      { col: 'contratos_servico', fields: ['arquivo_pdf_assinado'] },
      { col: 'contas', fields: ['anexo_comprovante'] },
      { col: 'medicoes', fields: ['anexos'] },
      { col: 'avaliacoes_executor', fields: ['anexos'] },
      { col: 'entregaveis', fields: ['arquivo'] },
      { col: 'documentos', fields: ['arquivo'] },
      { col: 'projetos', fields: ['anexo_autorizacao'] },
    ]

    for (let i = 0; i < proFilesMap.length; i++) {
      const item = proFilesMap[i]
      try {
        const c = app.findCollectionByNameOrId(item.col)
        let changed = false
        for (let j = 0; j < item.fields.length; j++) {
          const f = c.fields.getByName(item.fields[j])
          if (f && !f.protected) {
            f.protected = true
            changed = true
          }
        }
        if (changed) {
          app.save(c)
        }
      } catch (err) {
        console.log('Erro ao proteger arquivos de ' + item.col + ': ' + err)
      }
    }

    // 5. Backfill NÃO destrutivo de telefones para o campo JSON telefones
    // Clientes PF
    try {
      const pfs = app.findRecordsByFilter('clientes_pf', "telefone != ''", '', 500, 0)
      for (let i = 0; i < pfs.length; i++) {
        const pf = pfs[i]
        const tels = pf.get('telefones')
        const rawTel = (pf.getString('telefone') || '').trim()
        if ((!tels || (Array.isArray(tels) && tels.length === 0)) && rawTel) {
          const digits = rawTel.replace(/\D/g, '')
          const semDdi = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
          let formatted = rawTel
          if (semDdi.length === 11) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 7) + '-' + semDdi.slice(7)
          } else if (semDdi.length === 10) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 6) + '-' + semDdi.slice(6)
          }
          pf.set('telefones', [
            {
              id: 'tel_backfill_' + pf.id,
              numero: formatted,
              whatsapp: true,
              tipo: semDdi.length === 11 ? 'whatsapp' : 'fixo',
            },
          ])
          app.save(pf)
        }
      }
    } catch (ePf) {
      console.log('Backfill clientes_pf telefones: ' + ePf)
    }

    // Empresas
    try {
      const emps = app.findRecordsByFilter('empresas', "telefone != ''", '', 500, 0)
      for (let i = 0; i < emps.length; i++) {
        const emp = emps[i]
        const tels = emp.get('telefones')
        const rawTel = (emp.getString('telefone') || '').trim()
        if ((!tels || (Array.isArray(tels) && tels.length === 0)) && rawTel) {
          const digits = rawTel.replace(/\D/g, '')
          const semDdi = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
          let formatted = rawTel
          if (semDdi.length === 11) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 7) + '-' + semDdi.slice(7)
          } else if (semDdi.length === 10) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 6) + '-' + semDdi.slice(6)
          }
          emp.set('telefones', [
            {
              id: 'tel_backfill_' + emp.id,
              numero: formatted,
              whatsapp: true,
              tipo: semDdi.length === 11 ? 'whatsapp' : 'fixo',
            },
          ])
          app.save(emp)
        }
      }
    } catch (eEmp) {
      console.log('Backfill empresas telefones: ' + eEmp)
    }

    // Executores
    try {
      const execs = app.findRecordsByFilter('executores', "telefone != ''", '', 500, 0)
      for (let i = 0; i < execs.length; i++) {
        const ex = execs[i]
        const tels = ex.get('telefones')
        const rawTel = (ex.getString('telefone') || '').trim()
        if ((!tels || (Array.isArray(tels) && tels.length === 0)) && rawTel) {
          const digits = rawTel.replace(/\D/g, '')
          const semDdi = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
          let formatted = rawTel
          if (semDdi.length === 11) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 7) + '-' + semDdi.slice(7)
          } else if (semDdi.length === 10) {
            formatted =
              '+55 (' + semDdi.slice(0, 2) + ') ' + semDdi.slice(2, 6) + '-' + semDdi.slice(6)
          }
          ex.set('telefones', [
            {
              id: 'tel_backfill_' + ex.id,
              numero: formatted,
              whatsapp: true,
              tipo: semDdi.length === 11 ? 'whatsapp' : 'fixo',
            },
          ])
          app.save(ex)
        }
      }
    } catch (eEx) {
      console.log('Backfill executores telefones: ' + eEx)
    }
  },
  (app) => {
    // Reversão segura
  },
)
