// Migração 0152 — Disparo em lote do Toque 1 (e-mail de apresentação com modelo + portfólio anexo)
// Cria:
//   1. lotes_disparo   — relatório consultável de cada disparo em lote ({enviados, pulados, erros, avisos})
//   2. fila_disparo    — fila simples processada por cron de topo (1 item por ciclo, espaçamento seguro)
//   3. modelos_email   — modelos editáveis (Admin) com seed do modelo aprovado 'toque_1' (assunto/corpo EXATOS)
//                        + campo de arquivo anexo_portfolio (PDF) para o portfólio anexado
// Idempotente: cria coleções/registro apenas se não existirem.
migrate(
  (app) => {
    const ADMIN_RULE = "@request.auth.id != '' && @request.auth.role = 'admin'"
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const toquesCol = app.findCollectionByNameOrId('toques')

    // ---------- 1. lotes_disparo ----------
    let lotesCol = null
    try {
      lotesCol = app.findCollectionByNameOrId('lotes_disparo')
    } catch (_) {
      lotesCol = null
    }
    if (!lotesCol) {
      lotesCol = new Collection({
        name: 'lotes_disparo',
        type: 'base',
        listRule: ADMIN_RULE,
        viewRule: ADMIN_RULE,
        createRule: ADMIN_RULE,
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          {
            name: 'status',
            type: 'select',
            values: ['processando', 'concluido', 'concluido_com_erros'],
            maxSelect: 1,
            required: false,
          },
          { name: 'total', type: 'number', onlyInt: true },
          { name: 'enviados', type: 'number', onlyInt: true },
          { name: 'pulados', type: 'number', onlyInt: true },
          { name: 'erros', type: 'json', required: false },
          { name: 'avisos', type: 'json', required: false },
          {
            name: 'iniciado_por',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'iniciado_por_email', type: 'text', required: false },
          { name: 'concluido_em', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_lotes_disparo_status ON lotes_disparo (status)'],
      })
      app.save(lotesCol)
    }

    // ---------- 2. fila_disparo ----------
    let filaCol = null
    try {
      filaCol = app.findCollectionByNameOrId('fila_disparo')
    } catch (_) {
      filaCol = null
    }
    if (!filaCol) {
      filaCol = new Collection({
        name: 'fila_disparo',
        type: 'base',
        listRule: ADMIN_RULE,
        viewRule: ADMIN_RULE,
        createRule: ADMIN_RULE,
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          {
            name: 'lote',
            type: 'relation',
            collectionId: lotesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'empresa',
            type: 'relation',
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'enviada', 'pulada', 'erro'],
            maxSelect: 1,
            required: true,
          },
          { name: 'motivo', type: 'text', required: false },
          {
            name: 'toque',
            type: 'relation',
            collectionId: toquesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          },
          { name: 'proxima_execucao_em', type: 'date', required: false },
          { name: 'erro_detalhe', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_fila_disparo_lote ON fila_disparo (lote)',
          'CREATE INDEX idx_fila_disparo_status ON fila_disparo (status)',
        ],
      })
      app.save(filaCol)
    }

    // ---------- 3. modelos_email ----------
    let modelosEmailCol = null
    try {
      modelosEmailCol = app.findCollectionByNameOrId('modelos_email')
    } catch (_) {
      modelosEmailCol = null
    }
    if (!modelosEmailCol) {
      modelosEmailCol = new Collection({
        name: 'modelos_email',
        type: 'base',
        listRule: ADMIN_RULE,
        viewRule: ADMIN_RULE,
        createRule: ADMIN_RULE,
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          { name: 'nome', type: 'text', required: true },
          { name: 'assunto', type: 'text', required: true },
          { name: 'corpo_html', type: 'text', required: true },
          { name: 'ativo', type: 'bool' },
          {
            name: 'anexo_portfolio',
            type: 'file',
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['application/pdf'],
            required: false,
            hidden: false,
          },
          { name: 'atualizado_em', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_modelos_email_nome ON modelos_email (nome)'],
      })
      app.save(modelosEmailCol)
    }

    // Seed do modelo aprovado do Toque 1 (assunto e corpo EXATOS; única substituição {{empresa}})
    let seedExistente = null
    try {
      seedExistente = app.findFirstRecordByData('modelos_email', 'nome', 'toque_1')
    } catch (_) {
      seedExistente = null
    }
    if (!seedExistente) {
      const assuntoToque1 = 'Um braço técnico para a demanda da sua empresa — G+ ENGENHARIA'
      const corpoToque1 =
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;line-height:1.6;max-width:600px"><p>Olá, equipe da <b>{{empresa}}</b>, tudo bem?</p><p>Sou Jair, da <b>G+ ENGENHARIA</b>.</p><p>Sabemos que encontrar profissionais qualificados nas diversas disciplinas da engenharia — estrutura, instalações, BIM, orçamento — é um desafio constante, principalmente quando a demanda cresce ou o prazo aperta. Foi pensando nisso que a G+ atua como um <b>braço técnico das empresas parceiras</b>: assumimos parte da demanda com a qualidade e o prazo que o seu cliente espera, sem que vocês precisem contratar ou ampliar a equipe.</p><p>Podemos apoiar em:</p><ul><li>Projetos estruturais (concreto armado e estruturas metálicas) e complementares</li><li>Compatibilização e modelagem BIM</li><li>Orçamento de obras, planilhas e cronogramas</li><li>Pleitos administrativos: aditivos, reequilíbrio e respostas a diligências</li></ul><p>Atendemos de forma remota, com prazos definidos por etapa e entregas prontas para aprovação.</p><p><b>Segue em anexo o nosso portfólio.</b> Para conhecer mais:</p><p>▸ <a href="https://gmaisengenharia.goskip.app/portfolio" style="color:#D95A2B">Portfólio online</a><br>▸ <a href="https://gmaisengenharia.goskip.app" style="color:#D95A2B">Site</a><br>▸ <a href="https://gmaisengenharia.goskip.app/#orcamento" style="color:#D95A2B">Solicitar orçamento</a></p><p>Se preferir, fale direto comigo pelo WhatsApp — ou, se fizer sentido, podemos marcar uma conversa de 15 minutos para entender a demanda de vocês.</p><p><a href="https://wa.me/5588921886547?text=Ol%C3%A1%2C%20Jair!%20Recebi%20o%20e-mail%20da%20G%2B%20ENGENHARIA%20e%20gostaria%20de%20conversar." style="display:inline-block;padding:10px 20px;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:6px">Conversar no WhatsApp</a></p><p>Atenciosamente,<br><b>Jair — G+ ENGENHARIA</b><br>WhatsApp: <a href="https://wa.me/5588921886547" style="color:#D95A2B">(88) 92188-6547</a><br>grupomais.sae@gmail.com | <a href="https://gmaisengenharia.goskip.app" style="color:#D95A2B">gmaisengenharia.goskip.app</a></p></div>'

      const rec = new Record(modelosEmailCol)
      rec.set('nome', 'toque_1')
      rec.set('assunto', assuntoToque1)
      rec.set('corpo_html', corpoToque1)
      rec.set('ativo', true)
      rec.set('atualizado_em', new Date().toISOString())
      app.save(rec)
      console.log('Migração 0152: modelo toque_1 semeado em modelos_email')
    }
  },
  (app) => {
    // Down: remove as três coleções criadas (seed vai junto)
    try {
      const col = app.findCollectionByNameOrId('fila_disparo')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('lotes_disparo')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('modelos_email')
      app.delete(col)
    } catch (_) {}
  },
)
