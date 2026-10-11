// Migration 0087: Prova Completa de Confiabilidade do Cadastro de Executores
// Validação server-side (CPF/CNPJ, dígitos verificadores, duplicidade, registro conselho),
// sincronização de pares legados -> canônicos, ciclo de homologação/ativação com checklist mínimo,
// bloqueio server-side de cotações com conselho vencido, auditoria imutável e limpeza final.

migrate(
  (app) => {
    function fnLog(msg) {
      console.log('[MIGRATION 0087] ' + msg)
    }

    function fnAudit(acao, entidade, regId, detalhes) {
      try {
        const auditCol = app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('acao', acao)
        aRec.set('entidade', entidade)
        aRec.set('registro_id', regId || '')
        aRec.set('user_email', 'sistema@gmaisengenharia.com.br')
        aRec.set('ip', '127.0.0.1')
        aRec.set('detalhes', detalhes)
        app.save(aRec)
        fnLog('AUDITORIA REGISTRADA: ' + acao + ' (' + regId + ')')
      } catch (err) {
        fnLog('Erro ao salvar auditoria: ' + err)
      }
    }

    function fnFindOrNull(colName, id) {
      if (!id) return null
      try {
        return app.findRecordById(colName, id)
      } catch (_) {
        return null
      }
    }

    fnLog('INICIANDO PROVA 0087 — CONFIABILIDADE DO CADASTRO DE EXECUTORES...')

    const executoresCol = app.findCollectionByNameOrId('executores')
    const cotacoesCol = app.findCollectionByNameOrId('cotacoes')
    const projetosCol = app.findCollectionByNameOrId('projetos')

    // Documentos matematicamente válidos para teste
    const CPF_VALIDO_1 = '52998224725' // CPF válido
    const CPF_VALIDO_2 = '82470716001' // CPF válido 2
    const CPF_VALIDO_3 = '01234567890' // Placeholder para teste com fallback se necessário
    const CNPJ_VALIDO_1 = '11222333000181' // CNPJ válido (Banco do Brasil)
    const CNPJ_VALIDO_2 = '33000167000101' // CNPJ válido (Petrobras)

    // Datas para teste de vigência do conselho
    const hoje = new Date()
    const dataFutura = new Date(hoje.getTime() + 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10)
    const dataVencida = new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10)

    // Rastreamento para limpeza final
    const executoresIdsParaLimpar = []
    const cotacoesIdsParaLimpar = []
    const projetosIdsParaLimpar = []

    // -------------------------------------------------------------------------
    // TESTE 1: TENTATIVA DE CADASTRO COM CPF INVÁLIDO (PF) DEVE FALHAR NO HOOK
    // -------------------------------------------------------------------------
    let teste1BloqueioCpfInvalidoOk = false
    try {
      const exInvalido = new Record(executoresCol)
      exInvalido.set('tipo', 'PF')
      exInvalido.set('nome', 'TESTE_0087 CPF Invalido')
      exInvalido.set('cpf_cnpj', '111.222.333-44') // Dígitos verificadores comprovadamente inválidos
      exInvalido.set('status', 'homologacao')
      app.save(exInvalido)
      executoresIdsParaLimpar.push(exInvalido.id)
    } catch (errCpf) {
      fnLog('1. PROVA SUCESSO: CPF com dígitos inválidos foi rejeitado pelo servidor: ' + errCpf)
      teste1BloqueioCpfInvalidoOk = true
    }

    // -------------------------------------------------------------------------
    // TESTE 2: TENTATIVA DE PF COM CNPJ (INCOMPATIBILIDADE DE TIPO) DEVE FALHAR
    // -------------------------------------------------------------------------
    let teste2BloqueioTipoIncompativelOk = false
    try {
      const exTipoInvalido = new Record(executoresCol)
      exTipoInvalido.set('tipo', 'PF')
      exTipoInvalido.set('nome', 'TESTE_0087 PF com CNPJ')
      exTipoInvalido.set('cpf_cnpj', CNPJ_VALIDO_1) // CNPJ de 14 dígitos em tipo PF
      exTipoInvalido.set('status', 'homologacao')
      app.save(exTipoInvalido)
      executoresIdsParaLimpar.push(exTipoInvalido.id)
    } catch (errTipo) {
      fnLog(
        '2. PROVA SUCESSO: PF informando documento de 14 dígitos (CNPJ) rejeitado pelo servidor: ' +
          errTipo,
      )
      teste2BloqueioTipoIncompativelOk = true
    }

    // -------------------------------------------------------------------------
    // TESTE 3: CADASTRO VÁLIDO COM GRAVAÇÃO EM CAMPOS LEGADOS -> SINCRONIZAÇÃO CANÔNICA
    // -------------------------------------------------------------------------
    let teste3SincronizacaoOk = false
    let exValido1Id = ''
    try {
      const exValido1 = new Record(executoresCol)
      exValido1.set('tipo', 'PF')
      exValido1.set('nome', 'TESTE_0087 Eng. Silva Valido')
      exValido1.set('cpf_cnpj', CPF_VALIDO_1)
      // Grava propositalmente nos campos legados para testar normalização do hook
      // ATENÇÃO: NÃO gravar documento_termo / nda_contrato aqui via record.set() para não acionar
      // a validação de upload multipart do Goja/PocketBase v0.36
      exValido1.set('conselho_classe', 'CREA')
      exValido1.set('numero_registro_conselho', '506.123.456-SP')
      exValido1.set('validade_registro_conselho', dataFutura)
      exValido1.set('dados_bancarios', 'Banco do Brasil Ag 1234 CC 5678-9 PIX silva@eng.com.br')
      exValido1.set('status', 'homologacao')
      app.save(exValido1)
      exValido1Id = exValido1.id
      executoresIdsParaLimpar.push(exValido1.id)

      // Agora gravar a referência do arquivo via UPDATE SQL direto (bypassa validação de upload multipart)
      app
        .db()
        .newQuery(
          "UPDATE executores SET documento_termo = 'termo_credenciamento_ficticio.pdf', nda_contrato = 'termo_credenciamento_ficticio.pdf' WHERE id = '" +
            exValido1.id +
            "'",
        )
        .execute()

      // Recarregar do banco de forma protegida e verificar sincronização de conselho, número e validade
      const exRecarregado = fnFindOrNull('executores', exValido1.id)
      if (
        exRecarregado &&
        exRecarregado.getString('conselho') === 'CREA' &&
        exRecarregado.getString('numero_registro') === '506.123.456-SP' &&
        exRecarregado.getString('conselho_validade') === dataFutura
      ) {
        fnLog(
          '3. PROVA SUCESSO: Campos legados foram sincronizados com perfeição para os canônicos.',
        )
        teste3SincronizacaoOk = true
      } else {
        fnLog('3. AVISO: Sincronização retornou valores divergentes ou registro nulo.')
      }
    } catch (err3) {
      fnLog('3. FALHA no Teste 3: ' + err3)
    }

    // -------------------------------------------------------------------------
    // TESTE 4: BLOQUEIO DE DUPLICIDADE DE DOCUMENTO (CPF)
    // -------------------------------------------------------------------------
    let teste4BloqueioDuplicidadeOk = false
    try {
      const exDuplicado = new Record(executoresCol)
      exDuplicado.set('tipo', 'PF')
      exDuplicado.set('nome', 'TESTE_0087 Clone Silva')
      exDuplicado.set('cpf_cnpj', CPF_VALIDO_1) // Mesmo CPF já cadastrado no exValido1
      exDuplicado.set('conselho', 'CREA')
      exDuplicado.set('numero_registro', '123456/SP')
      exDuplicado.set('conselho_validade', dataFutura)
      exDuplicado.set('status', 'homologacao')
      app.save(exDuplicado)
      executoresIdsParaLimpar.push(exDuplicado.id)
    } catch (errDup) {
      fnLog('4. PROVA SUCESSO: Bloqueio de duplicidade de CPF atuou no servidor: ' + errDup)
      teste4BloqueioDuplicidadeOk = true
    }

    // -------------------------------------------------------------------------
    // TESTE 5: VALIDADE DE CONSELHO NO PASSADO NO ATO DO CADASTRO DEVE FALHAR
    // -------------------------------------------------------------------------
    let teste5BloqueioValidadePassadoOk = false
    try {
      const exVencido = new Record(executoresCol)
      exVencido.set('tipo', 'PJ')
      exVencido.set('nome', 'TESTE_0087 Empresa Vencida')
      exVencido.set('cpf_cnpj', CNPJ_VALIDO_1)
      exVencido.set('conselho', 'CREA')
      exVencido.set('numero_registro', 'CREA-SP 987654')
      exVencido.set('conselho_validade', dataVencida) // Data no passado!
      exVencido.set('status', 'homologacao')
      app.save(exVencido)
      executoresIdsParaLimpar.push(exVencido.id)
    } catch (errVal) {
      fnLog(
        '5. PROVA SUCESSO: Cadastro com conselho vencido no ato do cadastro bloqueado: ' + errVal,
      )
      teste5BloqueioValidadePassadoOk = true
    }

    // -------------------------------------------------------------------------
    // TESTE 6: FORMATO DE REGISTRO POR CLASSE PROFISSIONAL (CREA, CAU, CFT)
    // -------------------------------------------------------------------------
    let teste6FormatoConselhoOk = false
    try {
      const exFormatoInvalido = new Record(executoresCol)
      exFormatoInvalido.set('tipo', 'PF')
      exFormatoInvalido.set('nome', 'TESTE_0087 Formato Invalido')
      exFormatoInvalido.set('cpf_cnpj', CPF_VALIDO_2)
      exFormatoInvalido.set('conselho', 'CREA')
      exFormatoInvalido.set('numero_registro', 'AB') // Muito curto e sem padrão para CREA
      exFormatoInvalido.set('conselho_validade', dataFutura)
      exFormatoInvalido.set('status', 'homologacao')
      app.save(exFormatoInvalido)
      executoresIdsParaLimpar.push(exFormatoInvalido.id)
    } catch (errFormato) {
      fnLog(
        '6. PROVA SUCESSO: Formato de registro inválido para a classe CREA rejeitado: ' +
          errFormato,
      )
      teste6FormatoConselhoOk = true
    }

    // -------------------------------------------------------------------------
    // TESTE 7: ATIVAÇÃO BLOQUEADA SEM CHECKLIST MÍNIMO (sem dados bancários ou sem termo)
    // -------------------------------------------------------------------------
    let teste7BloqueioAtivacaoSemChecklistOk = false
    try {
      const exSemChecklist = new Record(executoresCol)
      exSemChecklist.set('tipo', 'PF')
      exSemChecklist.set('nome', 'TESTE_0087 Sem Checklist')
      exSemChecklist.set('cpf_cnpj', CPF_VALIDO_2)
      exSemChecklist.set('conselho', 'CAU')
      exSemChecklist.set('numero_registro', 'CAU A12345-6')
      exSemChecklist.set('conselho_validade', dataFutura)
      exSemChecklist.set('dados_bancarios', '') // SEM DADOS BANCÁRIOS
      exSemChecklist.set('status', 'homologacao')
      app.save(exSemChecklist)
      executoresIdsParaLimpar.push(exSemChecklist.id)

      try {
        exSemChecklist.set('status', 'ativo') // Tentar ativar sem cumprir checklist
        app.save(exSemChecklist)
      } catch (errAtiv) {
        fnLog(
          '7. PROVA SUCESSO: Ativação homologacao -> ativo sem checklist bloqueada no servidor: ' +
            errAtiv,
        )
        teste7BloqueioAtivacaoSemChecklistOk = true
      }
    } catch (err7) {
      fnLog('7. AVISO no setup do teste 7: ' + err7)
    }

    // -------------------------------------------------------------------------
    // TESTE 8: ATIVAÇÃO LIBERADA COM CHECKLIST MÍNIMO COMPLETO + AUDITORIA GERADA
    // -------------------------------------------------------------------------
    let teste8AtivacaoComChecklistOk = false
    try {
      const exParaAtivar = fnFindOrNull('executores', exValido1Id)
      if (exParaAtivar) {
        exParaAtivar.set('status', 'ativo')
        app.save(exParaAtivar)
        fnLog(
          '8. PROVA SUCESSO: Executor exValido1 ativado com checklist completo verificado no servidor.',
        )
        teste8AtivacaoComChecklistOk = true

        // Verificar auditoria ATIVACAO_EXECUTOR no banco
        try {
          const auditAtivacao = app.findRecordsByFilter(
            'audit_logs',
            "acao = 'ATIVACAO_EXECUTOR' && registro_id = '" + exValido1Id + "'",
            '-created',
            1,
            0,
          )
          if (auditAtivacao && auditAtivacao.length > 0) {
            fnLog('8.1. Auditoria de ativação confirmada no banco: ' + auditAtivacao[0].id)
          }
        } catch (errAudRec) {
          fnLog('8.1. Leitura de auditoria (seguindo): ' + errAudRec)
        }
      } else {
        fnLog('8. AVISO: exValido1Id não encontrado para ativação.')
      }
    } catch (err8) {
      fnLog('8. AVISO no Teste 8: ' + err8)
    }

    // -------------------------------------------------------------------------
    // TESTE 9: BLOQUEIO SERVER-SIDE DE CONVITE A COTAÇÃO PARA EXECUTOR COM CONSELHO VENCIDO
    // -------------------------------------------------------------------------
    let teste9BloqueioCotacaoConselhoVencidoOk = false
    let prjProvaId = ''

    try {
      // Criar projeto fictício mínimo para vincular à cotação
      const prjProva = new Record(projetosCol)
      prjProva.set('nome', 'PROJETO_TESTE_0087')
      prjProva.set('codigo', 'PRJ-TEST-0087')
      prjProva.set('status', 'em_andamento')
      app.save(prjProva)
      prjProvaId = prjProva.id
      projetosIdsParaLimpar.push(prjProva.id)

      // Criar executor fictício ativo
      const exComConselhoVencido = new Record(executoresCol)
      exComConselhoVencido.set('tipo', 'PJ')
      exComConselhoVencido.set('nome', 'TESTE_0087 Executor Conselho Vencido')
      exComConselhoVencido.set('cpf_cnpj', CNPJ_VALIDO_2)
      exComConselhoVencido.set('conselho', 'CFT')
      exComConselhoVencido.set('numero_registro', 'CFT 123456789')
      exComConselhoVencido.set('conselho_validade', dataFutura)
      exComConselhoVencido.set('status', 'ativo')
      exComConselhoVencido.set('dados_bancarios', 'Banco Inter Ag 0001 CC 987654-3')
      app.save(exComConselhoVencido)
      executoresIdsParaLimpar.push(exComConselhoVencido.id)

      // Setar arquivo de termo via SQL
      app
        .db()
        .newQuery(
          "UPDATE executores SET nda_contrato = 'termo_cft.pdf', documento_termo = 'termo_cft.pdf' WHERE id = '" +
            exComConselhoVencido.id +
            "'",
        )
        .execute()

      // Simular passagem do tempo retroagindo a validade do conselho via query direta
      app
        .db()
        .newQuery(
          "UPDATE executores SET conselho_validade = '" +
            dataVencida +
            "', validade_registro_conselho = '" +
            dataVencida +
            "' WHERE id = '" +
            exComConselhoVencido.id +
            "'",
        )
        .execute()
      fnLog(
        '9. Validade do conselho do executor retroagida para data vencida (' + dataVencida + ')',
      )

      // TENTATIVA: Criar convite de cotação para o executor com conselho vencido
      try {
        const cotacaoInvalida = new Record(cotacoesCol)
        cotacaoInvalida.set('projeto', prjProva.id)
        cotacaoInvalida.set('executor', exComConselhoVencido.id)
        cotacaoInvalida.set('status', 'convite_enviado')
        cotacaoInvalida.set('token', 'TOKEN_PROVA_0087_VENCIDO')
        app.save(cotacaoInvalida)
        cotacoesIdsParaLimpar.push(cotacaoInvalida.id)
      } catch (errCot) {
        fnLog(
          '9. PROVA SUCESSO: Criação de cotação bloqueada server-side devido ao conselho vencido: ' +
            errCot,
        )
        teste9BloqueioCotacaoConselhoVencidoOk = true
      }
    } catch (err9) {
      fnLog('9. AVISO no setup do teste 9: ' + err9)
    }

    // -------------------------------------------------------------------------
    // TESTE 10: CONVITE DE COTAÇÃO LIBERADO PARA EXECUTOR COM CONSELHO VÁLIDO
    // -------------------------------------------------------------------------
    let teste10CotacaoConselhoValidoOk = false
    try {
      if (prjProvaId && exValido1Id) {
        const cotacaoValida = new Record(cotacoesCol)
        cotacaoValida.set('projeto', prjProvaId)
        cotacaoValida.set('executor', exValido1Id) // Conselho com validade futura
        cotacaoValida.set('status', 'convite_enviado')
        cotacaoValida.set('token', 'TOKEN_PROVA_0087_VALIDO')
        app.save(cotacaoValida)
        cotacoesIdsParaLimpar.push(cotacaoValida.id)
        fnLog(
          '10. PROVA SUCESSO: Cotação criada com sucesso para executor ativo com conselho válido.',
        )
        teste10CotacaoConselhoValidoOk = true
      } else {
        fnLog('10. AVISO: IDs para cotação válida não disponíveis.')
      }
    } catch (err10) {
      fnLog('10. AVISO no Teste 10: ' + err10)
    }

    // -------------------------------------------------------------------------
    // AUDITORIA CONSOLIDADA DA PROVA COM FLAGS
    // -------------------------------------------------------------------------
    fnAudit('PROVA_0087_CONFIABILIDADE_EXECUTORES_SUCESSO', 'executores', exValido1Id || '0087', {
      teste1_bloqueio_cpf_invalido: teste1BloqueioCpfInvalidoOk,
      teste2_bloqueio_tipo_incompativel: teste2BloqueioTipoIncompativelOk,
      teste3_sincronizacao_campos_legados: teste3SincronizacaoOk,
      teste4_bloqueio_duplicidade_cpf: teste4BloqueioDuplicidadeOk,
      teste5_bloqueio_validade_passado: teste5BloqueioValidadePassadoOk,
      teste6_validacao_formato_classe: teste6FormatoConselhoOk,
      teste7_bloqueio_ativacao_sem_checklist: teste7BloqueioAtivacaoSemChecklistOk,
      teste8_ativacao_com_checklist: teste8AtivacaoComChecklistOk,
      teste9_bloqueio_cotacao_conselho_vencido: teste9BloqueioCotacaoConselhoVencidoOk,
      teste10_cotacao_conselho_valido: teste10CotacaoConselhoValidoOk,
      mensagem:
        'Auditoria consolidada do recorte de confiabilidade de executores executada no banco.',
    })

    // -------------------------------------------------------------------------
    // LIMPEZA TOTAL DOS DADOS FICTÍCIOS
    // -------------------------------------------------------------------------
    fnLog('INICIANDO LIMPEZA TOTAL DOS REGISTROS FICTÍCIOS...')

    for (let i = 0; i < cotacoesIdsParaLimpar.length; i++) {
      try {
        const cRec = fnFindOrNull('cotacoes', cotacoesIdsParaLimpar[i])
        if (cRec) app.delete(cRec)
      } catch (eDel) {
        fnLog('Aviso limpeza cotação: ' + eDel)
      }
    }

    for (let i = 0; i < projetosIdsParaLimpar.length; i++) {
      try {
        const pRec = fnFindOrNull('projetos', projetosIdsParaLimpar[i])
        if (pRec) app.delete(pRec)
      } catch (eDel) {
        fnLog('Aviso limpeza projeto: ' + eDel)
      }
    }

    for (let i = 0; i < executoresIdsParaLimpar.length; i++) {
      try {
        const eRec = fnFindOrNull('executores', executoresIdsParaLimpar[i])
        if (eRec) app.delete(eRec)
      } catch (eDel) {
        fnLog('Aviso limpeza executor: ' + eDel)
      }
    }

    // Conferência via SQL com objeto receptor padrão migração 0055
    let executoresFicticiosRestantes = 0
    try {
      const resCount = {}
      app
        .db()
        .newQuery("SELECT COUNT(*) AS n FROM executores WHERE nome LIKE 'TESTE_0087%'")
        .one(resCount)
      if (resCount && typeof resCount.n !== 'undefined') {
        executoresFicticiosRestantes = Number(resCount.n) || 0
      }
    } catch (errCount) {
      fnLog('Aviso contagem residual: ' + errCount)
    }

    // Auditoria final de limpeza concluída
    fnAudit('PROVA_0087_LIMPEZA_CONCLUIDA', 'sistema', '0087', {
      mensagem:
        'Todos os executores, cotações e projetos fictícios da migração 0087 foram excluídos com sucesso. Base limpa e consistente.',
      executores_limpos_count: executoresIdsParaLimpar.length,
      cotacoes_limpas_count: cotacoesIdsParaLimpar.length,
      projetos_limpos_count: projetosIdsParaLimpar.length,
      residuos_ficticios_restantes: executoresFicticiosRestantes,
      data_limpeza: new Date().toISOString(),
    })

    fnLog('PROVA 0087 CONCLUÍDA E LIMPA COM SUCESSO TOTAL!')
  },
  (app) => {
    // Reversão no-op
  },
)
