/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRAÇÃO 0141: APAGAR TUDO DO CLIENTE DE TESTE 'José Jair oliveira Alves'
    // Decisão EXPRESSA do dono antes de operar em produção.
    // Padrão de segurança:
    // - SQL direto via app.db().newQuery().execute() (sem disparar hooks de
    //   coleção, sem e-mail, sem notificações externas).
    // - Backup em TEXTO no log antes de apagar (ids + campos principais,
    //   CPF mascarado com 3 primeiros dígitos + ***).
    // - Log de contagens antes/depois de cada coleção afetada.
    // - Ordem de dependência (filhos primeiro -> pais depois).
    // - Idempotente: rodar num banco sem esses registros é no-op.
    // Preservados: usuários, audit_logs, parametros, catálogos, modelos,
    // configurações em geral.
    // =========================================================================

    // ---- Alvos confirmados por leitura no banco antes desta migração -------
    const ID_CLIENTE = 'tzc2dczdzw8m569' // clientes_pf 'José Jair oliveira Alves'
    const ID_EMPRESA = 'wh17vanux6u3cug' // empresas espelho PF (cliente_pf_ref -> cliente)
    const ID_PROPOSTA = 'as4v2k7xcp3jqu4' // propostas PROP-2026-0001
    const NOME = 'José Jair oliveira Alves'
    const CPF_MASC = '604***'

    // ---- Contadores ----------------------------------------------------------
    // Contagem via findRecordsByFilter (PocketBase) — padrão que funciona no
    // runtime de migrações Skip Cloud (SQL .one() com receptor dá panic Go).
    const q = (colecao, filtro) => {
      try {
        return app.findRecordsByFilter(colecao, filtro, '', 0, 0).length
      } catch (err) {
        console.log('[0141] Erro ao contar ' + colecao + ': ' + err)
        return 0
      }
    }
    const logContagem = (rotulo, antes, depois) => {
      console.log('[0141] CONTAGEM ' + rotulo + ': ' + antes + '->' + depois)
    }
    const apagar = (rotulo, sql) => {
      try {
        app.db().newQuery(sql).execute()
        console.log('[0141] DELETE executado em ' + rotulo)
      } catch (err) {
        console.log('[0141] Erro ao deletar ' + rotulo + ': ' + err)
      }
    }

    // ---- BACKUP EM TEXTO (log/console da migração) --------------------------
    const antesClienteGeral = q('clientes_pf', "id = '" + ID_CLIENTE + "'")
    if (antesClienteGeral > 0) {
      console.log('[0141] ================= BACKUP (TEXTO) =================')
      console.log(
        '[0141] BACKUP clientes_pf | id=' +
          ID_CLIENTE +
          ' | nome=' +
          NOME +
          ' | cpf=' +
          CPF_MASC +
          ' | email=josejair_ufca@outlook.com | telefone=(88) 99944-1685 | nascimento=1995-06-01 | municipio=Assaré/CE | logradouro=asas, 35 | bairro=sasa | cep=63140-000 | profissao=eng | doc_tipo=CIN | rg=604*** | rg_orgao=ssp/CE | estado_civil=solteiro(a) | nacionalidade=Brasileira | cadastro_status=completo | consentimento_lgpd=true | data_consentimento=2026-11-06 00:29:55 | base_legal=consentimento | criado=2026-11-05 16:44:15',
      )
      console.log(
        '[0141] BACKUP propostas | id=' +
          ID_PROPOSTA +
          ' | numero=PROP-2026-0001 | revisao=Rev.00 | status=rascunho | cliente_pf=' +
          ID_CLIENTE +
          ' | empresa=(vazio) | empreendimento=Residência Unifamiliar José Jair — Assaré/CE | disciplinas=BIM / Gestão | preco=1800 | custo=1800 | prazo=30 dias corridos | prazo_dias=30 | validade=2026-11-21 | criado=2026-11-06 12:04:33 | criado_por=ofzk87dccbga1y1',
      )
      console.log(
        '[0141] BACKUP proposta_itens | id=89zw714erorf146 | proposta=' +
          ID_PROPOSTA +
          ' | descricao=Modelagem da Informação da Construção (BIM Compatibilização) | disciplina=BIM / Gestão | unidade=m² | quantidade=150 | custo_unitario=12 | custo_total=1800 | preco_total=1800 | bdi=0 | servico=wqqk9h3mq427keu | status_conversao=nao_convertido',
      )
      console.log(
        '[0141] BACKUP proposta_parcelas | id1=avhdd0fls2v54ev ordem=1 percentual=50 valor=900 gatilho=contratacao | id2=lzgpuo1w3f123zp ordem=2 percentual=50 valor=900 gatilho=entrega | proposta=' +
          ID_PROPOSTA,
      )
      console.log(
        '[0141] BACKUP empresas (espelho PF) | id=' +
          ID_EMPRESA +
          ' | razao_social=' +
          NOME +
          ' | nome_fantasia=' +
          NOME +
          ' | cnpj=PF-' +
          ID_CLIENTE +
          ' | tipo_cliente=pf | cliente_pf_ref=' +
          ID_CLIENTE +
          ' | etapa_funil=qualificada | status=ativa | score=50 | telefone=+55 (88) 99944-1685 | observacoes=[Cliente PF Unificado] | criado=2026-11-05 16:44:15',
      )
      console.log(
        '[0141] BACKUP clientes_pf_convites (5 registros) | cliente_pf=' +
          ID_CLIENTE +
          ' | 1) id=c3wuzapt2ah2k5o status=cancelado token=257f9c34**** | 2) id=zx5aedha56gusxr status=cancelado token=a7ea06b9**** | 3) id=y4mmcdublxkey5h status=cancelado token=b42e5d86**** | 4) id=d2elountx9hsvrn status=cancelado token=82ed177a**** | 5) id=45k8c4uuzrkt2dv status=aprovado token=0fc8041e**** enviado_em=2026-11-05 19:12:21 revisado_em=2026-11-06 00:29:55 | tokens truncados (8 chars) por segurança',
      )
      console.log(
        '[0141] BACKUP notificacoes (5 registros) | 1) id=rcrvah8a7jrwi7b titulo=Novo Pedido de Orçamento pelo Site G+ referencia=empresas/9kmraorr33vborb | 2) id=qv24l0nzrz67ecu titulo=Novo Pedido de Orçamento pelo Site G+ referencia=empresas/9kmraorr33vborb | 3) id=oru95b994wxr8m9 titulo=Cliente PF enviou dados para revisão referencia=clientes_pf/' +
          ID_CLIENTE +
          ' | 4) id=s8p93f97cdl1gs7 titulo=Cliente PF enviou dados para revisão referencia=clientes_pf/' +
          ID_CLIENTE +
          ' | 5) id=0djrgp9dozhq5u5 titulo=Cliente PF enviou dados para revisão referencia=clientes_pf/' +
          ID_CLIENTE,
      )
      console.log('[0141] ================================================')
    } else {
      console.log('[0141] Cliente alvo não encontrado — nada a apagar (no-op).')
    }

    // ---- CONTAGENS ANTES ----------------------------------------------------
    const antesPropostas = q('propostas', "id = '" + ID_PROPOSTA + "'")
    const antesItens = q('proposta_itens', "proposta = '" + ID_PROPOSTA + "'")
    const antesParcelas = q('proposta_parcelas', "proposta = '" + ID_PROPOSTA + "'")
    const antesConvites = q('clientes_pf_convites', "cliente_pf = '" + ID_CLIENTE + "'")
    const antesEmpresas = q(
      'empresas',
      "id = '" + ID_EMPRESA + "' || cliente_pf_ref = '" + ID_CLIENTE + "'",
    )
    const antesCliente = q('clientes_pf', "id = '" + ID_CLIENTE + "'")
    const antesNotifTeste = q(
      'notificacoes',
      "mensagem ~ 'TESTE SITE' || mensagem ~ 'José Jair' || referencia_id = '" +
        ID_CLIENTE +
        "' || referencia_id = '" +
        ID_EMPRESA +
        "' || referencia_id = '" +
        ID_PROPOSTA +
        "' || referencia_id = '9kmraorr33vborb'",
    )
    const antesContas = q('contas', "proposta = '" + ID_PROPOSTA + "'")
    const antesContratos = q('contratos_servico', "proposta = '" + ID_PROPOSTA + "'")
    const antesProjetos = q('projetos', "proposta = '" + ID_PROPOSTA + "'")
    const antesPreCot = q('pre_cotacoes', "proposta = '" + ID_PROPOSTA + "'")
    const antesGrupos = q('grupos_projetos', "proposta = '" + ID_PROPOSTA + "'")
    console.log('[0141] CONTAGENS ANTES registradas.')

    // ---- 1. APAGAR FILHOS DA PROPOSTA ---------------------------------------
    apagar(
      'pre_cotacao_respostas (via pre_cotacoes da proposta)',
      "DELETE FROM pre_cotacao_respostas WHERE pre_cotacao IN (SELECT id FROM pre_cotacoes WHERE proposta = '" +
        ID_PROPOSTA +
        "')",
    )
    apagar(
      'pre_cotacoes',
      "DELETE FROM pre_cotacoes WHERE proposta = '" +
        ID_PROPOSTA +
        "' OR item_proposta IN (SELECT id FROM proposta_itens WHERE proposta = '" +
        ID_PROPOSTA +
        "')",
    )
    apagar('contas', "DELETE FROM contas WHERE proposta = '" + ID_PROPOSTA + "'")
    apagar(
      'contratos_servico',
      "DELETE FROM contratos_servico WHERE proposta = '" + ID_PROPOSTA + "'",
    )
    apagar('grupos_projetos', "DELETE FROM grupos_projetos WHERE proposta = '" + ID_PROPOSTA + "'")
    apagar('projetos', "DELETE FROM projetos WHERE proposta = '" + ID_PROPOSTA + "'")
    apagar('proposta_itens', "DELETE FROM proposta_itens WHERE proposta = '" + ID_PROPOSTA + "'")
    apagar(
      'proposta_parcelas',
      "DELETE FROM proposta_parcelas WHERE proposta = '" + ID_PROPOSTA + "'",
    )
    apagar('propostas (PROP-2026-0001)', "DELETE FROM propostas WHERE id = '" + ID_PROPOSTA + "'")

    // ---- 2. APAGAR CONVITES DO CLIENTE --------------------------------------
    apagar(
      'clientes_pf_convites',
      "DELETE FROM clientes_pf_convites WHERE cliente_pf = '" + ID_CLIENTE + "'",
    )

    // ---- 3. APAGAR EMPRESA ESPELHO ------------------------------------------
    apagar(
      'empresas (espelho PF)',
      "DELETE FROM empresas WHERE id = '" +
        ID_EMPRESA +
        "' OR cliente_pf_ref = '" +
        ID_CLIENTE +
        "'",
    )

    // ---- 4. APAGAR CLIENTE PF ------------------------------------------------
    apagar('clientes_pf', "DELETE FROM clientes_pf WHERE id = '" + ID_CLIENTE + "'")

    // ---- 5. APAGAR NOTIFICAÇÕES ---------------------------------------------
    apagar(
      'notificacoes (teste e ligadas ao cliente/proposta/convites)',
      "DELETE FROM notificacoes WHERE mensagem LIKE '%TESTE SITE%' OR mensagem LIKE '%José Jair%' OR referencia_id IN ('" +
        ID_CLIENTE +
        "','" +
        ID_EMPRESA +
        "','" +
        ID_PROPOSTA +
        "','9kmraorr33vborb')",
    )

    // ---- CONTAGENS DEPOIS ---------------------------------------------------
    const depoisPropostas = q('propostas', "id = '" + ID_PROPOSTA + "'")
    const depoisItens = q('proposta_itens', "proposta = '" + ID_PROPOSTA + "'")
    const depoisParcelas = q('proposta_parcelas', "proposta = '" + ID_PROPOSTA + "'")
    const depoisConvites = q('clientes_pf_convites', "cliente_pf = '" + ID_CLIENTE + "'")
    const depoisEmpresas = q(
      'empresas',
      "id = '" + ID_EMPRESA + "' || cliente_pf_ref = '" + ID_CLIENTE + "'",
    )
    const depoisCliente = q('clientes_pf', "id = '" + ID_CLIENTE + "'")
    const depoisNotifTeste = q(
      'notificacoes',
      "mensagem ~ 'TESTE SITE' || mensagem ~ 'José Jair' || referencia_id = '" +
        ID_CLIENTE +
        "' || referencia_id = '" +
        ID_EMPRESA +
        "' || referencia_id = '" +
        ID_PROPOSTA +
        "' || referencia_id = '9kmraorr33vborb'",
    )
    const depoisContas = q('contas', "proposta = '" + ID_PROPOSTA + "'")
    const depoisContratos = q('contratos_servico', "proposta = '" + ID_PROPOSTA + "'")
    const depoisProjetos = q('projetos', "proposta = '" + ID_PROPOSTA + "'")
    const depoisPreCot = q('pre_cotacoes', "proposta = '" + ID_PROPOSTA + "'")
    const depoisGrupos = q('grupos_projetos', "proposta = '" + ID_PROPOSTA + "'")

    logContagem('propostas', antesPropostas, depoisPropostas)
    logContagem('proposta_itens', antesItens, depoisItens)
    logContagem('proposta_parcelas', antesParcelas, depoisParcelas)
    logContagem('clientes_pf_convites', antesConvites, depoisConvites)
    logContagem('empresas', antesEmpresas, depoisEmpresas)
    logContagem('clientes_pf', antesCliente, depoisCliente)
    logContagem('notificacoes', antesNotifTeste, depoisNotifTeste)
    logContagem('contas', antesContas, depoisContas)
    logContagem('contratos_servico', antesContratos, depoisContratos)
    logContagem('projetos', antesProjetos, depoisProjetos)
    logContagem('pre_cotacoes', antesPreCot, depoisPreCot)
    logContagem('grupos_projetos', antesGrupos, depoisGrupos)

    // ---- VERIFICAÇÃO FINAL (órfãos) -----------------------------------------
    const totalPropostas = q('propostas', "id != ''")
    const totalConvites = q('clientes_pf_convites', "id != ''")
    const totalClientesPf = q('clientes_pf', "id != ''")
    const totalEmpresas = q('empresas', "id != ''")
    const totalUsers = q('users', "id != ''")
    const totalAudit = q('audit_logs', "id != ''")
    const totalParametros = q('parametros', "id != ''")
    const totalModelos = q('modelos', "id != ''")
    const totalCatalogo = q('catalogo_servicos', "id != ''")
    const totalAreas = q('areas_atuacao', "id != ''")
    const totalSubservicos = q('subservicos', "id != ''")
    const totalNotif = q('notificacoes', "id != ''")

    console.log(
      '[0141] TOTAIS GERAIS PÓS-EXCLUSÃO: propostas=' +
        totalPropostas +
        ' | clientes_pf=' +
        totalClientesPf +
        ' | clientes_pf_convites=' +
        totalConvites +
        ' | empresas=' +
        totalEmpresas +
        ' | notificacoes=' +
        totalNotif,
    )
    console.log(
      '[0141] PRESERVADOS: users=' +
        totalUsers +
        ' | audit_logs=' +
        totalAudit +
        ' | parametros=' +
        totalParametros +
        ' | modelos=' +
        totalModelos +
        ' | catalogo_servicos=' +
        totalCatalogo +
        ' | areas_atuacao=' +
        totalAreas +
        ' | subservicos=' +
        totalSubservicos,
    )

    // ---- CONTADOR DE PROPOSTAS ----------------------------------------------
    // A numeração (hook propostas_operations.js) deriva do MAIOR número EXISTENTE
    // (findRecordsByFilter numero ~ 'PROP-AAAA-', sort -numero, limit 1) — não há
    // contador em parametros. Com a única proposta apagada, o próximo número
    // naturalmente volta a ser PROP-2026-0001. Nenhuma alteração de código.
    console.log(
      '[0141] Numeração de propostas deriva do maior número EXISTENTE (sem contador em parametros). Único número existente era PROP-2026-0001 (agora apagado) → próxima proposta criada receberá PROP-2026-0001 automaticamente. Nenhuma alteração de código necessária.',
    )

    console.log('[0141] Limpeza do cliente de teste ' + NOME + ' concluída.')
  },
  () => {
    // Reversão não aplicável: exclusão permanente autorizada expressamente pelo dono
  },
)
