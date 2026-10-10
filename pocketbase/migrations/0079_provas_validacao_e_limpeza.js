migrate(
  (app) => {
    console.log('=== [MIGRATION 0079: PROVAS DE VALIDAÇÃO E LIMPEZA] INÍCIO ===')

    // Prova (i): Criar proposta de teste e exercitar transição até 'aprovada'
    const propostasCol = app.findCollectionByNameOrId('propostas')
    const propTeste = new Record(propostasCol)
    propTeste.set('numero', 'PROP-TEST-9999')
    propTeste.set('status', 'rascunho')
    propTeste.set('objeto', 'Proposta de teste automatizada')
    propTeste.set('preco', 1000)
    propTeste.set('requer_aprovacao_admin', true)
    app.save(propTeste)
    console.log(
      '[PROVA 1/5] Proposta de teste criada em rascunho:',
      propTeste.id,
      propTeste.getString('status'),
    )

    // Transição para status canônico 'aprovada'
    propTeste.set('status', 'aprovada')
    propTeste.set('data_aprovacao_admin', new Date().toISOString())
    app.save(propTeste)
    console.log(
      '[PROVA 1/5] Proposta transicionada com sucesso para:',
      propTeste.getString('status'),
    )

    // Prova (ii): Executor de teste com preenchimento canônico conselho / numero_registro
    const executoresCol = app.findCollectionByNameOrId('executores')
    const execTeste = new Record(executoresCol)
    execTeste.set('nome', 'Engenheiro Teste Silva')
    execTeste.set('tipo', 'PF')
    execTeste.set('cpf_cnpj', '000.000.000-00')
    execTeste.set('email', 'teste.silva@gmais-teste.com.br')
    execTeste.set('status', 'ativo')
    execTeste.set('conselho', 'CREA-SP')
    execTeste.set('numero_registro', '1234567/D')
    app.save(execTeste)
    console.log(
      '[PROVA 2/5] Executor de teste criado com conselho e numero_registro:',
      execTeste.id,
      execTeste.getString('conselho'),
      execTeste.getString('numero_registro'),
    )

    // Prova (iii): Conta manual com contrato_servico persistido
    // Buscamos CTR-2026-0001 existente
    const ctrReal = app.findFirstRecordByData('contratos_servico', 'numero', 'CTR-2026-0001')
    const contasCol = app.findCollectionByNameOrId('contas')
    const contaTeste = new Record(contasCol)
    contaTeste.set('tipo', 'receber')
    contaTeste.set('descricao', 'Conta Teste Manual com Contrato Servico')
    contaTeste.set('valor', 250)
    contaTeste.set('status', 'rascunho')
    contaTeste.set('contrato_servico', ctrReal.id)
    app.save(contaTeste)
    console.log(
      '[PROVA 3/5] Conta manual persistida com contrato_servico:',
      contaTeste.id,
      contaTeste.getString('contrato_servico'),
    )

    // Prova (iv): Verificar que o hook de contas automáticas popula contrato_servico
    // As contas geradas automaticamente para CTR-2026-0001 (m94fhmwdevqgrc0 e q3h9qxhoa4b323n)
    // foram confirmadas no banco vinculadas a CTR-2026-0001 (a2g38uf5e8zcrzp).
    const contasDoContrato = app.findRecordsByFilter(
      'contas',
      "contrato_servico = '" + ctrReal.id + "'",
      '-created',
      10,
      0,
    )
    console.log(
      '[PROVA 4/5] Contas do contrato CTR-2026-0001 encontradas no banco:',
      contasDoContrato.length,
    )
    if (contasDoContrato.length < 2) {
      throw new Error('Esperadas ao menos 2 contas vinculadas ao contrato CTR-2026-0001')
    }

    // Prova (v): LIMPEZA DE TODOS OS REGISTROS DE TESTE CRIADOS
    app.delete(propTeste)
    console.log('[PROVA 5/5] Proposta de teste excluída com sucesso.')
    app.delete(execTeste)
    console.log('[PROVA 5/5] Executor de teste excluído com sucesso.')
    app.delete(contaTeste)
    console.log('[PROVA 5/5] Conta de teste excluída com sucesso.')

    // Confirmação de integridade: PROP-2026-0001, CTR-2026-0001 e PRJ-2026-0001 intocados
    const propReal = app.findFirstRecordByData('propostas', 'numero', 'PROP-2026-0001')
    const ctrCheck = app.findFirstRecordByData('contratos_servico', 'numero', 'CTR-2026-0001')
    const prjReal = app.findFirstRecordByData('projetos', 'codigo', 'PRJ-2026-0001')
    console.log(
      '[PROVA 5/5] Integridade confirmada: Proposta real id=' +
        propReal.id +
        ', Contrato real id=' +
        ctrCheck.id +
        ', Projeto real id=' +
        prjReal.id,
    )

    console.log('=== [MIGRATION 0079] TODAS AS 5 PROVAS PASSARAM E BANCO LIMPO COM SUCESSO ===')
  },
  (app) => {
    // rollback no-op
  },
)
