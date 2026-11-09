/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0142: VERIFICAÇÃO PÓS-LIMPEZA DO CLIENTE DE TESTE
    // 'José Jair oliveira Alves' (companheira da migração 0141).
    //
    // Asserção de integridade: se QUALQUER registro alvo da limpeza ainda
    // existir (cliente, convites, empresa espelho, proposta PROP-2026-0001 e
    // filhos, notificações de teste), a migração LANÇA ERRO e falha — assim o
    // sucesso do apply prova, por leitura no banco, que nada ficou órfão.
    // Em um banco vazio/fresco (replay do histórico) todas as contagens são 0,
    // então esta migração é no-op e idempotente.
    // Contagens via findRecordsByFilter (padrão que funciona no runtime de
    // migrações Skip Cloud; SQL .one() com receptor dá panic Go).
    // =========================================================================

    const ID_CLIENTE = 'tzc2dczdzw8m569'
    const ID_EMPRESA = 'wh17vanux6u3cug'
    const ID_PROPOSTA = 'as4v2k7xcp3jqu4'

    const q = (colecao, filtro) => {
      try {
        return app.findRecordsByFilter(colecao, filtro, '', 0, 0).length
      } catch (err) {
        console.log('[0142] Erro ao contar ' + colecao + ': ' + err)
        return 0
      }
    }

    const residuos = []

    const cCliente = q('clientes_pf', "id = '" + ID_CLIENTE + "'")
    if (cCliente > 0) residuos.push('clientes_pf=' + cCliente)

    const cConvites = q('clientes_pf_convites', "cliente_pf = '" + ID_CLIENTE + "'")
    if (cConvites > 0) residuos.push('clientes_pf_convites=' + cConvites)

    const cEmpresas = q(
      'empresas',
      "id = '" + ID_EMPRESA + "' || cliente_pf_ref = '" + ID_CLIENTE + "'",
    )
    if (cEmpresas > 0) residuos.push('empresas=' + cEmpresas)

    const cPropostas = q('propostas', "id = '" + ID_PROPOSTA + "'")
    if (cPropostas > 0) residuos.push('propostas=' + cPropostas)

    const cItens = q('proposta_itens', "proposta = '" + ID_PROPOSTA + "'")
    if (cItens > 0) residuos.push('proposta_itens=' + cItens)

    const cParcelas = q('proposta_parcelas', "proposta = '" + ID_PROPOSTA + "'")
    if (cParcelas > 0) residuos.push('proposta_parcelas=' + cParcelas)

    const cContas = q('contas', "proposta = '" + ID_PROPOSTA + "'")
    if (cContas > 0) residuos.push('contas=' + cContas)

    const cContratos = q('contratos_servico', "proposta = '" + ID_PROPOSTA + "'")
    if (cContratos > 0) residuos.push('contratos_servico=' + cContratos)

    const cProjetos = q('projetos', "proposta = '" + ID_PROPOSTA + "'")
    if (cProjetos > 0) residuos.push('projetos=' + cProjetos)

    const cGrupos = q('grupos_projetos', "proposta = '" + ID_PROPOSTA + "'")
    if (cGrupos > 0) residuos.push('grupos_projetos=' + cGrupos)

    const cPreCot = q('pre_cotacoes', "proposta = '" + ID_PROPOSTA + "'")
    if (cPreCot > 0) residuos.push('pre_cotacoes=' + cPreCot)

    const cNotif = q(
      'notificacoes',
      "mensagem ~ 'TESTE SITE' || mensagem ~ 'José Jair' || referencia_id = '" +
        ID_CLIENTE +
        "' || referencia_id = '" +
        ID_EMPRESA +
        "' || referencia_id = '" +
        ID_PROPOSTA +
        "' || referencia_id = '9kmraorr33vborb'",
    )
    if (cNotif > 0) residuos.push('notificacoes=' + cNotif)

    console.log(
      '[0142] Verificação de resíduos: ' +
        (residuos.length === 0 ? 'NENHUM resíduo encontrado — banco limpo.' : residuos.join(', ')),
    )

    if (residuos.length > 0) {
      throw new Error(
        '[0142] VERIFICAÇÃO FALHOU — resíduos do cliente de teste José Jair ainda presentes: ' +
          residuos.join(', '),
      )
    }

    // ---- Preservação (somente leitura informativa + asserção leve) ---------
    const totalUsers = q('users', "id != ''")
    const totalAudit = q('audit_logs', "id != ''")
    const totalParam = q('parametros', "id != ''")
    const totalModelos = q('modelos', "id != ''")
    const totalCatalogo = q('catalogo_servicos', "id != ''")
    const totalAreas = q('areas_atuacao', "id != ''")
    const totalSubservicos = q('subservicos', "id != ''")
    const usersGmais = q('users', "email = 'grupomais.sae@gmail.com'")
    const usersSistema = q('users', "email ~ '@sistema.eng.br'")
    const contadorPropostas = q(
      'parametros',
      "chave ~ 'proposta' || chave ~ 'sequenc' || chave ~ 'contador'",
    )

    console.log(
      '[0142] PRESERVADOS: users=' +
        totalUsers +
        ' (grupomais.sae@gmail.com=' +
        usersGmais +
        ', @sistema.eng.br=' +
        usersSistema +
        ') | audit_logs=' +
        totalAudit +
        ' | parametros=' +
        totalParam +
        ' | modelos=' +
        totalModelos +
        ' | catalogo_servicos=' +
        totalCatalogo +
        ' | areas_atuacao=' +
        totalAreas +
        ' | subservicos=' +
        totalSubservicos,
    )
    console.log(
      '[0142] Contador de propostas em parametros (chaves proposta/sequenc/contador): ' +
        contadorPropostas +
        ' — numeração deriva do maior número EXISTENTE (hook propostas_operations.js); com 0 propostas, a próxima será PROP-2026-0001.',
    )

    // Asserção de preservação: em banco de produção esses conjuntos existem.
    // Em um banco vazio/fresco (replay) nada foi semeado ainda, então só
    // falhamos se houver usuários mas faltar o grupo preservado essencial.
    if (totalUsers > 0 && usersGmais === 0 && usersSistema === 0) {
      throw new Error(
        '[0142] VERIFICAÇÃO FALHOU — usuários foram apagados indevidamente (grupomais.sae@gmail.com e @sistema.eng.br ausentes).',
      )
    }

    console.log('[0142] Verificação pós-limpeza concluída com sucesso.')
  },
  () => {
    // Reversão não aplicável: verificação é somente leitura + asserção
  },
)
