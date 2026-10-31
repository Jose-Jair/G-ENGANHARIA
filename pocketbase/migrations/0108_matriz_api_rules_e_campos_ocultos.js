migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // 1. Prestadores:
    //    Comercial: sem preço de prestador, sem custo-hora interno e sem salários
    //    Gestor: sem dados bancários de prestadores
    //    Ocultar campos no schema (hidden: true) para omitir das respostas comuns da API.
    // -------------------------------------------------------------------------
    try {
      const colP = app.findCollectionByNameOrId('prestadores')
      const fDadosBanc = colP.fields.getByName('dados_bancarios')
      if (fDadosBanc && !fDadosBanc.hidden) {
        fDadosBanc.hidden = true
        app.save(colP)
      }
      const fCustoHora = colP.fields.getByName('custo_hora')
      if (fCustoHora && !fCustoHora.hidden) {
        fCustoHora.hidden = true
        app.save(colP)
      }
      const fCustoMensal = colP.fields.getByName('custo_mensal')
      if (fCustoMensal && !fCustoMensal.hidden) {
        fCustoMensal.hidden = true
        app.save(colP)
      }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 2. Executores (legado): ocultar dados_bancarios
    // -------------------------------------------------------------------------
    try {
      const colEx = app.findCollectionByNameOrId('executores')
      const fDb = colEx.fields.getByName('dados_bancarios')
      if (fDb && !fDb.hidden) {
        fDb.hidden = true
        app.save(colEx)
      }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 3. Custos_profissional (vigências/salários):
    //    Regra: Comercial NÃO tem acesso. Restrito a Admin e Financeiro.
    // -------------------------------------------------------------------------
    try {
      const colCp = app.findCollectionByNameOrId('custos_profissional')
      colCp.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
      colCp.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'financeiro')"
      app.save(colCp)
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 4. Apontamentos:
    //    Regra: Executor interno só as próprias horas (prestador.email = @request.auth.email)
    //    Comercial sem custo-hora interno
    // -------------------------------------------------------------------------
    try {
      const colAp = app.findCollectionByNameOrId('apontamentos')
      colAp.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      colAp.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      const fVl = colAp.fields.getByName('valor_total')
      if (fVl && !fVl.hidden) {
        fVl.hidden = true
        app.save(colAp)
      }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 5. Cotações e Pré-Cotações:
    //    Cotação e pré-cotação NÃO têm rota pública (remover tokens públicos de list/view)
    // -------------------------------------------------------------------------
    try {
      const colCot = app.findCollectionByNameOrId('cotacoes')
      colCot.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      colCot.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      app.save(colCot)
    } catch (_) {}

    try {
      const colPcr = app.findCollectionByNameOrId('pre_cotacao_respostas')
      colPcr.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      colPcr.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || (@request.auth.role = 'executor' && prestador.email = @request.auth.email))"
      app.save(colPcr)
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 6. Contratos públicos (coleção 'contratos'):
    //    Campo 'valor' oculto da listagem comum, servido por endpoint de detalhes auditado
    // -------------------------------------------------------------------------
    try {
      const colCtr = app.findCollectionByNameOrId('contratos')
      const fVal = colCtr.fields.getByName('valor')
      if (fVal && !fVal.hidden) {
        fVal.hidden = true
        app.save(colCtr)
      }
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 7. Financeiro:
    //    Financeiro sem escopo técnico, arquivos de projeto e canal da OS.
    //    - mensagens_os: apenas Admin, Gestor e Executor da OS (Financeiro e Comercial proibidos)
    // -------------------------------------------------------------------------
    try {
      const colMsg = app.findCollectionByNameOrId('mensagens_os')
      colMsg.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && os.prestador.email = @request.auth.email))"
      colMsg.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && os.prestador.email = @request.auth.email))"
      app.save(colMsg)
    } catch (_) {}

    // -------------------------------------------------------------------------
    // 8. Executor interno/externo:
    //    Apenas a própria OS, as próprias horas e o próprio scorecard
    //    - scorecards: executor isolado por prestador_email = @request.auth.email
    // -------------------------------------------------------------------------
    try {
      const colSc = app.findCollectionByNameOrId('scorecards')
      colSc.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      colSc.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (@request.auth.role = 'executor' && prestador_email = @request.auth.email))"
      app.save(colSc)
    } catch (_) {}
  },
  (app) => {},
)
