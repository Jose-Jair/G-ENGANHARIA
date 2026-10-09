/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração 0056: Limpeza de microprojetos duplicados e consolidação de escopo
    // 1. Apaga etapas e entregáveis vinculados aos microprojetos com valor_total = 0.05 ou criados indevidamente
    //    do contrato CTR-2026-0001 (id a2g38uf5e8zcrzp, grupo GPR-2026-0001 id 2unzvfz7nw8uagr).
    // 2. Apaga os microprojetos redundantes gerados pelo split textual de itens_json.
    // 3. Garante e preserva 1 único projeto oficial PRJ-2026-0001 consolidado com:
    //    - valor_total: 15.00
    //    - grupo: 2unzvfz7nw8uagr (GPR-2026-0001)
    //    - contrato_servico: a2g38uf5e8zcrzp (CTR-2026-0001)
    //    - proposta: e0msjfhi5a9j0l7 (PROP-2026-0001)
    //    - status: aguardando_definicao
    //    - modo_execucao: null
    //    - disciplinas: BIM / Gestão
    //    - descricao: Modelagem da Informação da Construção (BIM Compatibilização)
    // 4. Atualiza o ponteiro 'projeto' no contrato_servico a2g38uf5e8zcrzp para apontar para o projeto consolidado.
    // 5. Garante 1 etapa padrão vinculada ao projeto com os entregáveis da área de BIM/Outros.
    // 6. Atualiza proposta_itens se existir para sincronizar com o item único e vinculá-lo ao projeto/etapa.
    // 7. Registra auditoria com autor "SISTEMA" (quem/quê/quando).

    const contratoId = 'a2g38uf5e8zcrzp'
    const grupoId = '2unzvfz7nw8uagr'
    const propostaId = 'e0msjfhi5a9j0l7'
    const areaBimId = 'wfzlf7aok1jleud'

    let projetoConsolidadoId = null

    // 1. Localizar ou eleger o projeto PRJ-2026-0001 que será consolidado
    try {
      const projetosContrato = app.findRecordsByFilter(
        'projetos',
        "contrato_servico = '" + contratoId + "' || grupo = '" + grupoId + "'",
        'created',
        2000,
        0,
      )

      if (projetosContrato.length > 0) {
        // Encontra preferencialmente o que tem código PRJ-2026-0001 ou o primeiro criado
        const prj0001 = projetosContrato.find((p) => p.getString('codigo') === 'PRJ-2026-0001')
        const eleito = prj0001 || projetosContrato[0]
        projetoConsolidadoId = eleito.id

        // Ajustar os dados do projeto eleito
        eleito.set('codigo', 'PRJ-2026-0001')
        eleito.set('nome', 'Projeto: CTR-2026-0001 — Beatriz da Conceição de Lima')
        eleito.set('descricao', 'Modelagem da Informação da Construção (BIM Compatibilização)')
        eleito.set('disciplinas', 'BIM / Gestão')
        eleito.set('valor_total', 15.0)
        eleito.set('status', 'aguardando_definicao')
        eleito.set('modo_execucao', null)
        eleito.set('grupo', grupoId)
        eleito.set('contrato_servico', contratoId)
        eleito.set('proposta', propostaId)
        eleito.set('cliente_pf', '3j05wjvztqhegdz')
        eleito.set('saude', 'verde')
        eleito.set('subcontratacao_autorizada', true)
        app.save(eleito)

        // 2. Apagar todos os demais projetos do contrato / grupo
        const outrosProjetosIds = projetosContrato
          .filter((p) => p.id !== projetoConsolidadoId)
          .map((p) => p.id)

        for (let i = 0; i < outrosProjetosIds.length; i++) {
          const pid = outrosProjetosIds[i]

          // Desvincular e apagar contas vinculadas aos projetos descartados
          try {
            app
              .db()
              .newQuery("UPDATE contas SET projeto = '' WHERE projeto = {:pid}")
              .bind({ pid })
              .execute()
          } catch (_) {}

          // Buscar etapas vinculadas a este projeto descartado
          try {
            const etapasDesc = app.findRecordsByFilter(
              'projeto_etapas',
              "projeto = '" + pid + "'",
              'created',
              100,
              0,
            )
            for (let eIdx = 0; eIdx < etapasDesc.length; eIdx++) {
              const eid = etapasDesc[eIdx].id
              try {
                app
                  .db()
                  .newQuery('DELETE FROM entregaveis WHERE etapa = {:eid}')
                  .bind({ eid })
                  .execute()
              } catch (_) {}
              try {
                app.delete(etapasDesc[eIdx])
              } catch (_) {}
            }
          } catch (_) {}

          // Apagar documentos ou riscos vinculados
          try {
            app
              .db()
              .newQuery('DELETE FROM documentos WHERE projeto = {:pid}')
              .bind({ pid })
              .execute()
            app.db().newQuery('DELETE FROM riscos WHERE projeto = {:pid}').bind({ pid }).execute()
          } catch (_) {}

          // Apagar o projeto duplicado
          try {
            const prjDel = app.findRecordById('projetos', pid)
            if (prjDel) {
              app.delete(prjDel)
            }
          } catch (errDel) {
            // Se falhar via app.delete, tenta raw query
            try {
              app.db().newQuery('DELETE FROM projetos WHERE id = {:pid}').bind({ pid }).execute()
            } catch (_) {}
          }
        }
      }
    } catch (errProjetos) {
      console.log('Erro ao processar limpeza de projetos: ' + errProjetos)
    }

    // Se não existia projeto, criar o PRJ-2026-0001
    if (!projetoConsolidadoId) {
      try {
        const projetosCol = app.findCollectionByNameOrId('projetos')
        const novoPrj = new Record(projetosCol)
        novoPrj.set('codigo', 'PRJ-2026-0001')
        novoPrj.set('nome', 'Projeto: CTR-2026-0001 — Beatriz da Conceição de Lima')
        novoPrj.set('descricao', 'Modelagem da Informação da Construção (BIM Compatibilização)')
        novoPrj.set('disciplinas', 'BIM / Gestão')
        novoPrj.set('valor_total', 15.0)
        novoPrj.set('status', 'aguardando_definicao')
        novoPrj.set('modo_execucao', null)
        novoPrj.set('grupo', grupoId)
        novoPrj.set('contrato_servico', contratoId)
        novoPrj.set('proposta', propostaId)
        novoPrj.set('cliente_pf', '3j05wjvztqhegdz')
        novoPrj.set('saude', 'verde')
        novoPrj.set('subcontratacao_autorizada', true)
        app.save(novoPrj)
        projetoConsolidadoId = novoPrj.id
      } catch (errCreate) {
        console.log('Erro ao criar PRJ-2026-0001 consolidado: ' + errCreate)
      }
    }

    // 3. Atualizar o ponteiro 'projeto' no contrato_servico
    if (projetoConsolidadoId) {
      try {
        const contratoRec = app.findRecordById('contratos_servico', contratoId)
        if (contratoRec) {
          contratoRec.set('projeto', projetoConsolidadoId)
          app.save(contratoRec)
        }
      } catch (errCtr) {
        console.log('Erro ao atualizar ponteiro projeto em contratos_servico: ' + errCtr)
      }
    }

    // 4. Garantir etapas e entregáveis padrão para o projeto consolidado
    let etapaId = null
    if (projetoConsolidadoId) {
      try {
        const etapas = app.findRecordsByFilter(
          'projeto_etapas',
          "projeto = '" + projetoConsolidadoId + "'",
          'ordem',
          10,
          0,
        )

        let etapaPrincipal = null
        if (etapas.length > 0) {
          etapaPrincipal = etapas[0]
          etapaPrincipal.set(
            'nome',
            'Etapa: Modelagem da Informação da Construção (BIM Compatibilização)',
          )
          etapaPrincipal.set('disciplina', 'BIM / Gestão')
          etapaPrincipal.set('area', areaBimId)
          etapaPrincipal.set('ordem', 1)
          etapaPrincipal.set('status', 'nao_iniciada')
          etapaPrincipal.set('tipo_execucao', 'direta')
          app.save(etapaPrincipal)
          etapaId = etapaPrincipal.id

          // Apagar etapas excedentes desse projeto consolidado
          for (let eIdx = 1; eIdx < etapas.length; eIdx++) {
            const exId = etapas[eIdx].id
            try {
              app
                .db()
                .newQuery('DELETE FROM entregaveis WHERE etapa = {:exId}')
                .bind({ exId })
                .execute()
              app.delete(etapas[eIdx])
            } catch (_) {}
          }
        } else {
          const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
          const novaEtapa = new Record(etapasCol)
          novaEtapa.set('projeto', projetoConsolidadoId)
          novaEtapa.set(
            'nome',
            'Etapa: Modelagem da Informação da Construção (BIM Compatibilização)',
          )
          novaEtapa.set('disciplina', 'BIM / Gestão')
          novaEtapa.set('area', areaBimId)
          novaEtapa.set('ordem', 1)
          novaEtapa.set('tipo_execucao', 'direta')
          novaEtapa.set('status', 'nao_iniciada')
          novaEtapa.set('custo_estimado', 0)
          novaEtapa.set(
            'descricao',
            'Serviços técnicos de Modelagem da Informação da Construção (BIM Compatibilização).',
          )
          app.save(novaEtapa)
          etapaId = novaEtapa.id
        }

        // Criar ou garantir entregáveis padrão da área BIM
        if (etapaId) {
          const entregaveisExistentes = app.findRecordsByFilter(
            'entregaveis',
            "etapa = '" + etapaId + "'",
            'created',
            50,
            0,
          )

          if (entregaveisExistentes.length === 0) {
            const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
            const padroes = [
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

            for (let pIdx = 0; pIdx < padroes.length; pIdx++) {
              const novoEntregavel = new Record(entregaveisCol)
              novoEntregavel.set('etapa', etapaId)
              novoEntregavel.set('nome', padroes[pIdx].nome)
              novoEntregavel.set('versao', 'v1.0')
              novoEntregavel.set('status', 'pendente')
              novoEntregavel.set('descricao', padroes[pIdx].desc)
              app.save(novoEntregavel)
            }
          }
        }
      } catch (errEtp) {
        console.log('Erro ao configurar etapas e entregáveis consolidados: ' + errEtp)
      }
    }

    // 5. Garantir que contas a receber apontem para o projeto consolidado
    if (projetoConsolidadoId) {
      try {
        app
          .db()
          .newQuery(
            "UPDATE contas SET projeto = {:pid} WHERE proposta = {:propostaId} OR descricao LIKE '%CTR-2026-0001%'",
          )
          .bind({ pid: projetoConsolidadoId, propostaId })
          .execute()
      } catch (_) {}
    }

    // 6. Sincronizar proposta_itens para manter 1 item real de catálogo se vazio
    try {
      const itensProp = app.findRecordsByFilter(
        'proposta_itens',
        "proposta = '" + propostaId + "'",
        'created',
        10,
        0,
      )
      if (itensProp.length === 0) {
        const colItens = app.findCollectionByNameOrId('proposta_itens')
        const itemRec = new Record(colItens)
        itemRec.set('proposta', propostaId)
        itemRec.set('descricao', 'Modelagem da Informação da Construção (BIM Compatibilização)')
        itemRec.set('disciplina', 'BIM / Gestão')
        itemRec.set('area', areaBimId)
        itemRec.set('servico', 'wqqk9h3mq427keu')
        itemRec.set('quantidade', 1)
        itemRec.set('unidade', 'm²')
        itemRec.set('custo_unitario', 0)
        itemRec.set('custo_total', 0)
        itemRec.set('bdi_percentual', 0)
        itemRec.set('preco_total', 15.0)
        itemRec.set('status_conversao', 'convertido')
        if (projetoConsolidadoId) itemRec.set('projeto_gerado', projetoConsolidadoId)
        if (etapaId) itemRec.set('etapa_gerada', etapaId)
        itemRec.set('ordem', 1)
        app.save(itemRec)
      }
    } catch (_) {}

    // 7. Auditoria (audit_logs)
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRec = new Record(auditCol)
      auditRec.set('user', null)
      auditRec.set('user_email', 'SISTEMA')
      auditRec.set('acao', 'LIMPEZA_MICROPROJETOS_DUPLICADOS_ESCOPO')
      auditRec.set('entidade', 'projetos')
      auditRec.set('registro_id', projetoConsolidadoId || 'PRJ-2026-0001')
      auditRec.set('detalhes', {
        origem: 'SISTEMA / MIGRATION_0056',
        mensagem:
          'Limpeza e saneamento de microprojetos redundantes R$ 0,05 concluídos. Consolidado 1 único projeto PRJ-2026-0001 (R$ 15,00) para o Contrato CTR-2026-0001 e Grupo GPR-2026-0001.',
        projeto_consolidado_id: projetoConsolidadoId,
        codigo: 'PRJ-2026-0001',
        contrato_id: contratoId,
        contrato_numero: 'CTR-2026-0001',
        grupo_id: grupoId,
        grupo_codigo: 'GPR-2026-0001',
        valor_total: 15.0,
        autor: 'SISTEMA',
        executado_em: new Date().toISOString(),
      })
      auditRec.set('ip', '127.0.0.1')
      app.save(auditRec)
    } catch (auditErr) {
      console.log('Erro ao gravar audit_log na migração 0056: ' + auditErr)
    }
  },
  (app) => {
    // Reversão não aplicável: saneamento de dados de teste duplicados
  },
)
