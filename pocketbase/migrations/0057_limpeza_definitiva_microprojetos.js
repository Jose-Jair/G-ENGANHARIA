/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0057: Limpeza definitiva de microprojetos falsos "Item de Escopo N"
    // e garantia do projeto real oficial PRJ-2026-0001 (id zdsz6qswd2vz8tv).

    const idProjetoReal = 'zdsz6qswd2vz8tv'
    const idContrato = 'a2g38uf5e8zcrzp' // CTR-2026-0001
    const idGrupo = '2unzvfz7nw8uagr' // GPR-2026-0001
    const idProposta = 'e0msjfhi5a9j0l7' // PROP-2026-0001
    const idAreaBim = 'wfzlf7aok1jleud'

    let totalProjetosApagados = 0
    let totalEtapasApagadas = 0

    // 1. Buscar registros de projetos via API do PocketBase
    let falsos = []
    try {
      falsos = app.findRecordsByFilter(
        'projetos',
        "id != '" +
          idProjetoReal +
          "' && (contrato_servico = '" +
          idContrato +
          "' || grupo = '" +
          idGrupo +
          "' || descricao ~ 'Item de Escopo')",
        'created',
        2000,
        0,
      )
    } catch (errF) {
      console.log('Aviso ao buscar projetos falsos: ' + errF)
    }

    for (let i = 0; i < falsos.length; i++) {
      const pRec = falsos[i]
      const pid = pRec.id
      if (pid === idProjetoReal) continue

      // Desvincular contas
      try {
        app
          .db()
          .newQuery("UPDATE contas SET projeto = '' WHERE projeto = {:pid}")
          .bind({ pid: pid })
          .execute()
      } catch (_) {}

      // Desvincular proposta_itens
      try {
        app
          .db()
          .newQuery("UPDATE proposta_itens SET projeto_gerado = '' WHERE projeto_gerado = {:pid}")
          .bind({ pid: pid })
          .execute()
      } catch (_) {}

      // Obter etapas
      try {
        const etapas = app.findRecordsByFilter(
          'projeto_etapas',
          "projeto = '" + pid + "'",
          'created',
          200,
          0,
        )

        for (let eIdx = 0; eIdx < etapas.length; eIdx++) {
          const eRec = etapas[eIdx]
          const eid = eRec.id

          try {
            app
              .db()
              .newQuery('DELETE FROM entregaveis WHERE etapa = {:eid}')
              .bind({ eid: eid })
              .execute()
          } catch (_) {}

          try {
            app
              .db()
              .newQuery("UPDATE contas SET etapa = '' WHERE etapa = {:eid}")
              .bind({ eid: eid })
              .execute()
          } catch (_) {}

          try {
            app
              .db()
              .newQuery("UPDATE proposta_itens SET etapa_gerada = '' WHERE etapa_gerada = {:eid}")
              .bind({ eid: eid })
              .execute()
          } catch (_) {}

          try {
            app.delete(eRec)
            totalEtapasApagadas++
          } catch (_) {}
        }
      } catch (_) {}

      // Documentos e riscos
      try {
        app
          .db()
          .newQuery('DELETE FROM documentos WHERE projeto = {:pid}')
          .bind({ pid: pid })
          .execute()
        app.db().newQuery('DELETE FROM riscos WHERE projeto = {:pid}').bind({ pid: pid }).execute()
        app
          .db()
          .newQuery('DELETE FROM cotacoes WHERE projeto = {:pid}')
          .bind({ pid: pid })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM subcontratos WHERE projeto = {:pid}')
          .bind({ pid: pid })
          .execute()
      } catch (_) {}

      // Apagar o projeto falso
      try {
        app.delete(pRec)
        totalProjetosApagados++
      } catch (errDel) {
        try {
          app.db().newQuery('DELETE FROM projetos WHERE id = {:pid}').bind({ pid: pid }).execute()
          totalProjetosApagados++
        } catch (_) {}
      }
    }

    // Também executar limpeza direta de qualquer resto que ainda coincida com o padrão
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM projetos WHERE id != '" +
            idProjetoReal +
            "' AND (descricao LIKE 'Item de Escopo%' OR nome LIKE '%Item de Escopo%' OR (contrato_servico = '" +
            idContrato +
            "' AND valor_total < 10))",
        )
        .execute()
    } catch (_) {}

    // 2. Garantir e Preservar o Projeto Real (zdsz6qswd2vz8tv)
    try {
      const prjReal = app.findRecordById('projetos', idProjetoReal)
      if (prjReal) {
        prjReal.set('codigo', 'PRJ-2026-0001')
        prjReal.set('nome', 'Projeto: CTR-2026-0001 — Beatriz da Conceição de Lima')
        prjReal.set('descricao', 'Modelagem da Informação da Construção (BIM Compatibilização)')
        prjReal.set('disciplinas', 'BIM / Gestão')
        prjReal.set('valor_total', 15.0)
        prjReal.set('status', 'aguardando_definicao')
        prjReal.set('modo_execucao', null)
        prjReal.set('grupo', idGrupo)
        prjReal.set('contrato_servico', idContrato)
        prjReal.set('proposta', idProposta)
        prjReal.set('cliente_pf', '3j05wjvztqhegdz')
        prjReal.set('saude', 'verde')
        prjReal.set('subcontratacao_autorizada', true)
        app.save(prjReal)
      }
    } catch (errPrj) {
      console.log('Aviso ao atualizar projeto real: ' + errPrj)
    }

    // 3. Garantir ponteiro no contrato_servico a2g38uf5e8zcrzp
    try {
      const ctr = app.findRecordById('contratos_servico', idContrato)
      if (ctr) {
        ctr.set('projeto', idProjetoReal)
        app.save(ctr)
      }
    } catch (_) {}

    // 4. Garantir etapa e entregáveis oficiais no projeto real
    let etapaRealId = null
    try {
      const etapasReal = app.findRecordsByFilter(
        'projeto_etapas',
        "projeto = '" + idProjetoReal + "'",
        'ordem',
        10,
        0,
      )

      if (etapasReal.length > 0) {
        const etapaUnica = etapasReal[0]
        etapaUnica.set(
          'nome',
          'Etapa: Modelagem da Informação da Construção (BIM Compatibilização)',
        )
        etapaUnica.set('disciplina', 'BIM / Gestão')
        etapaUnica.set('area', idAreaBim)
        etapaUnica.set('ordem', 1)
        etapaUnica.set('tipo_execucao', 'direta')
        etapaUnica.set('status', 'nao_iniciada')
        etapaUnica.set('custo_estimado', 0)
        etapaUnica.set(
          'descricao',
          'Serviços técnicos de Modelagem da Informação da Construção (BIM Compatibilização).',
        )
        app.save(etapaUnica)
        etapaRealId = etapaUnica.id

        // Apagar excedentes
        for (let idx = 1; idx < etapasReal.length; idx++) {
          const exEtp = etapasReal[idx]
          const exEtpId = exEtp.id
          try {
            app
              .db()
              .newQuery('DELETE FROM entregaveis WHERE etapa = {:exEtpId}')
              .bind({ exEtpId: exEtpId })
              .execute()
            app.delete(exEtp)
          } catch (_) {}
        }
      } else {
        const colEtapas = app.findCollectionByNameOrId('projeto_etapas')
        const novaEtapa = new Record(colEtapas)
        novaEtapa.set('projeto', idProjetoReal)
        novaEtapa.set('nome', 'Etapa: Modelagem da Informação da Construção (BIM Compatibilização)')
        novaEtapa.set('disciplina', 'BIM / Gestão')
        novaEtapa.set('area', idAreaBim)
        novaEtapa.set('ordem', 1)
        novaEtapa.set('tipo_execucao', 'direta')
        novaEtapa.set('status', 'nao_iniciada')
        novaEtapa.set('custo_estimado', 0)
        novaEtapa.set(
          'descricao',
          'Serviços técnicos de Modelagem da Informação da Construção (BIM Compatibilização).',
        )
        app.save(novaEtapa)
        etapaRealId = novaEtapa.id
      }

      // Garantir entregáveis padrão na etapa oficial
      if (etapaRealId) {
        const entregaveis = app.findRecordsByFilter(
          'entregaveis',
          "etapa = '" + etapaRealId + "'",
          'created',
          20,
          0,
        )

        if (entregaveis.length === 0) {
          const entCol = app.findCollectionByNameOrId('entregaveis')
          const itensPadrao = [
            { nome: 'Detecção de interferências', desc: 'Clash Detection de modelos BIM' },
            {
              nome: 'Matriz de compatibilização',
              desc: 'Matriz com apontamentos de inconformidades',
            },
            {
              nome: 'Relatório de inspeção',
              desc: 'Relatório executivo de compatibilização e fechamento',
            },
          ]
          for (let p = 0; p < itensPadrao.length; p++) {
            const nEnt = new Record(entCol)
            nEnt.set('etapa', etapaRealId)
            nEnt.set('nome', itensPadrao[p].nome)
            nEnt.set('descricao', itensPadrao[p].desc)
            nEnt.set('versao', 'v1.0')
            nEnt.set('status', 'pendente')
            app.save(nEnt)
          }
        }
      }
    } catch (errEtp) {
      console.log('Aviso ao sincronizar etapas do projeto real: ' + errEtp)
    }

    // 5. Vincular contas a receber ao projeto real
    try {
      app
        .db()
        .newQuery(
          "UPDATE contas SET projeto = '" +
            idProjetoReal +
            "' WHERE proposta = '" +
            idProposta +
            "' OR descricao LIKE '%CTR-2026-0001%'",
        )
        .execute()
    } catch (_) {}

    // 6. Sincronizar proposta_itens com custos válidos (evita "cannot be blank")
    try {
      const itensProp = app.findRecordsByFilter(
        'proposta_itens',
        "proposta = '" + idProposta + "'",
        'created',
        10,
        0,
      )
      if (itensProp.length === 0) {
        const colItens = app.findCollectionByNameOrId('proposta_itens')
        const itemRec = new Record(colItens)
        itemRec.set('proposta', idProposta)
        itemRec.set('descricao', 'Modelagem da Informação da Construção (BIM Compatibilização)')
        itemRec.set('disciplina', 'BIM / Gestão')
        itemRec.set('area', idAreaBim)
        itemRec.set('servico', 'wqqk9h3mq427keu')
        itemRec.set('quantidade', 1)
        itemRec.set('unidade', 'm²')
        itemRec.set('custo_unitario', 0)
        itemRec.set('custo_total', 0)
        itemRec.set('bdi_percentual', 0)
        itemRec.set('preco_total', 15.0)
        itemRec.set('status_conversao', 'convertido')
        itemRec.set('projeto_gerado', idProjetoReal)
        if (etapaRealId) itemRec.set('etapa_gerada', etapaRealId)
        itemRec.set('ordem', 1)
        app.save(itemRec)
      } else {
        const principal = itensProp[0]
        principal.set('projeto_gerado', idProjetoReal)
        if (etapaRealId) principal.set('etapa_gerada', etapaRealId)
        principal.set('status_conversao', 'convertido')
        principal.set('custo_unitario', principal.getFloat('custo_unitario') || 0)
        principal.set('custo_total', principal.getFloat('custo_total') || 0)
        app.save(principal)
      }
    } catch (errItens) {
      console.log('Aviso ao sincronizar proposta_itens: ' + errItens)
    }

    // 7. Auditoria obrigatória (audit_logs)
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user', null)
      auditRec.set('user_email', 'SISTEMA')
      auditRec.set('acao', 'LIMPEZA_MICROPROJETOS_DUPLICADOS_ESCOPO')
      auditRec.set('entidade', 'projetos')
      auditRec.set('registro_id', idProjetoReal)
      auditRec.set('detalhes', {
        origem: 'SISTEMA / MIGRATION_0057',
        justificativa: 'limpeza de microprojetos falsos',
        mensagem:
          'Limpeza definitiva de microprojetos redundantes "Item de Escopo N" concluída com sucesso. Preservado 1 único projeto oficial PRJ-2026-0001 (R$ 15,00) id ' +
          idProjetoReal +
          ' vinculado ao Contrato CTR-2026-0001.',
        projeto_preservado_id: idProjetoReal,
        codigo: 'PRJ-2026-0001',
        contrato_id: idContrato,
        contrato_numero: 'CTR-2026-0001',
        grupo_id: idGrupo,
        grupo_codigo: 'GPR-2026-0001',
        valor_total: 15.0,
        total_projetos_apagados: totalProjetosApagados,
        total_etapas_apagadas: totalEtapasApagadas,
        autor: 'SISTEMA',
        executado_em: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Erro ao gravar audit_log na migração 0057: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: saneamento irreversível de registros falsos
  },
)
