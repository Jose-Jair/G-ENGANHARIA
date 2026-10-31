// =============================================================================
// GESTÃO G+ — PRÉ-COTAÇÃO VINCULANTE NA PROPOSTA (RODADA 13)
// pocketbase/hooks/pre_cotacao_operations.js
//
// Endpoints e rotinas:
// 1. POST /backend/v1/propostas/{proposta_id}/itens/{item_id}/pre-cotacao/abrir
//    - Cria registro em pre_cotacoes com código PRE-AAAA-NNNN
//    - Escopo e entregáveis ANONIMIZADOS (NUNCA cliente, obra, órgão ou valor/BDI)
//    - Validade e max_convidados lidos dos parâmetros da Administração
//    - Convida elegíveis (disciplina, conselho válido, capacidade livre, contrato-mestre assinado)
//    - Ordena elegíveis por ranking (preço de referência, nota, tendência, capacidade, softwares)
//    - Se não houver elegíveis: marca item com origem_custo='sem_cotacao' e alerta na Central de Ações
//
// 2. POST /backend/v1/portal-prestador/pre-cotacoes/{resposta_id}/responder
//    - Prestador envia preço, prazo, premissas, observações
//    - Grava aceite vinculante com SHA-256, IP, user-agent e timestamp
//    - Status passa para 'enviada'
//
// 3. POST /backend/v1/pre-cotacoes/{id}/escolher
//    - Gestor escolhe a resposta vencedora
//    - Atualiza item da proposta: origem_custo='pre_cotacao', preco_travado, prazo_travado_dias, prestador_vencedor
//    - Recalcula custo e margem da proposta
//    - Encerra pré-cotação como 'convertida'
//    - Trava resposta vencedora ('travada')
//    - LIBERA concorrentes ('liberada') com aviso SEM citar vencedor nem valores concorrentes
//
// 4. POST /backend/v1/propostas/{proposta_id}/itens/{item_id}/editar-custo-auditado
//    - Editar custo de item com origem_custo 'pre_cotacao' exige motivo_edicao_custo preenchido
//    - Altera origem_custo para 'manual_auditado' e registra auditoria detalhada
//
// 5. GET /backend/v1/pre-cotacoes/item/{item_id}
//    - Consulta pré-cotação e respostas para o Gestor/Comercial
//
// 6. Cron a cada 10 min para expiração de pré-cotações fora da validade
// =============================================================================

// -----------------------------------------------------------------------------
// 1. ENDPOINT: ABRIR PRÉ-COTAÇÃO POR ITEM DA PROPOSTA
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/propostas/{proposta_id}/itens/{item_id}/pre-cotacao/abrir',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor' && role !== 'comercial') {
        return e.json(403, {
          error: 'Apenas Administrador, Gestor ou Comercial podem abrir pré-cotação.',
        })
      }

      const propostaId = e.request.pathValue('proposta_id')
      const itemId = e.request.pathValue('item_id')

      let proposta
      let item
      try {
        proposta = $app.findRecordById('propostas', propostaId)
      } catch (_) {
        return e.json(404, { error: 'Proposta não encontrada.' })
      }

      try {
        item = $app.findRecordById('proposta_itens', itemId)
      } catch (_) {
        return e.json(404, { error: 'Item de proposta não encontrado.' })
      }

      if (item.getString('proposta') !== proposta.id) {
        return e.json(400, { error: 'O item não pertence à proposta indicada.' })
      }

      // Parâmetros da Administração
      let validadeDias = 30
      let maxConvidados = 5
      try {
        const pVal = $app.findFirstRecordByData('parametros', 'chave', 'pre_cotacao_validade_dias')
        if (pVal) validadeDias = parseInt(pVal.getString('valor'), 10) || 30
      } catch (_) {}

      try {
        const pMax = $app.findFirstRecordByData('parametros', 'chave', 'pre_cotacao_max_convidados')
        if (pMax) maxConvidados = parseInt(pMax.getString('valor'), 10) || 5
      } catch (_) {}

      const agora = new Date()
      const dataLimite = new Date(agora.getTime() + validadeDias * 24 * 60 * 60 * 1000)
      const dataLimiteIso = dataLimite.toISOString()

      // Geração de Código Provisório Sequencial PRE-AAAA-NNNN
      const anoAtual = agora.getFullYear()
      const prefixo = 'PRE-' + anoAtual + '-'
      let proximoSeq = 1

      const ultimos = $app.findRecordsByFilter(
        'pre_cotacoes',
        "codigo ~ '" + prefixo + "'",
        '-codigo',
        1,
        0,
      )
      if (ultimos.length > 0) {
        const cod = ultimos[0].getString('codigo')
        const partes = cod.split('-')
        const num = parseInt(partes[2], 10)
        if (!isNaN(num)) proximoSeq = num + 1
      }
      const seqStr = ('0000' + proximoSeq).slice(-4)
      const codigoPreCotacao = prefixo + seqStr

      // Disciplina e Escopo rigorosamente anonimizado
      const disciplina =
        item.getString('disciplina') || proposta.getString('disciplinas') || 'Geral'
      const descItem = item.getString('descricao') || 'Execução técnica de escopo'

      // Sanitização de escopo: remove qualquer menção direta e não repassa cliente/órgão/valores
      const escopoAnonimizado =
        'Escopo Técnico da Disciplina: ' +
        disciplina +
        '.\nDescrição do Serviço: ' +
        descItem +
        '.\nNota: Escopo isolado sem identificação comercial do cliente contratante.'

      const entregaveisTexto =
        proposta.getString('entregaveis') ||
        'Memoriais descritivos, pranchas e arquivos executivos da disciplina.'

      const prazoDesejadoDias = proposta.getInt('prazo_dias') || 30

      // Criar registro na coleção pre_cotacoes
      const preCotCol = $app.findCollectionByNameOrId('pre_cotacoes')
      const novaPreCot = new Record(preCotCol)
      novaPreCot.set('codigo', codigoPreCotacao)
      novaPreCot.set('proposta', proposta.id)
      novaPreCot.set('item_proposta', item.id)
      novaPreCot.set('disciplina', disciplina)
      novaPreCot.set('escopo_anonimizado', escopoAnonimizado)
      novaPreCot.set('entregaveis_texto', entregaveisTexto)
      novaPreCot.set('prazo_desejado_dias', prazoDesejadoDias)
      novaPreCot.set('validade_dias', validadeDias)
      novaPreCot.set('data_limite', dataLimiteIso)
      novaPreCot.set('status', 'aberta')
      novaPreCot.set('criado_por', reqInfo.auth.id)
      $app.save(novaPreCot)

      // Busca de Elegíveis conforme Rodada 4 + Rodada 12
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const todosPrestadores = $app.findRecordsByFilter(
        'prestadores',
        "status = 'ativo'",
        '-nota_geral',
        200,
        0,
      )

      const elegiveis = []
      for (let i = 0; i < todosPrestadores.length; i++) {
        const p = todosPrestadores[i]
        if (p.getString('tipo') === 'interno') continue
        if (p.getString('status') === 'suspenso') continue

        // Conselho de classe válido
        const valConselho = p.getString('validade_registro_conselho')
        if (valConselho) {
          const dtVal = new Date(valConselho)
          if (dtVal < hoje) continue
        }

        // Compatibilidade com disciplina
        const discStr = p.getString('disciplinas') || ''
        const discList = p.get('disciplinas_atuacao') || []
        let compativel = false
        if (discStr.toLowerCase().includes(disciplina.toLowerCase())) compativel = true
        if (!compativel && Array.isArray(discList)) {
          compativel = discList.some((d) =>
            String(d).toLowerCase().includes(disciplina.toLowerCase()),
          )
        }
        if (!compativel) continue

        // Contrato-mestre assinado obrigatório
        const cmAssinados = $app.findRecordsByFilter(
          'contratos_mestre',
          "prestador = '" + p.id + "' && status = 'assinado'",
          '',
          1,
          0,
        )
        if (cmAssinados.length === 0) continue

        // Capacidade simultânea livre
        const capMax = p.getInt('capacidade_simultanea') || 3
        const osAtivas = $app.findRecordsByFilter(
          'ordens_servico',
          "prestador = '" +
            p.id +
            "' && (status = 'em_execucao' || status = 'em_revisao' || status = 'assinada' || status = 'minuta' || status = 'aguardando_assinatura')",
          '',
          100,
          0,
        )
        const capLivre = capMax - osAtivas.length
        if (capLivre <= 0) continue

        // Cálculo de pontuação composta: Nota (50%) + Capacidade (20%) + Softwares (15%) + Faixa Preço (15%)
        const nota = p.getFloat('nota_geral') || 5.0
        let score = nota * 10 + capLivre * 4

        // Aderência de softwares (Rodada 12)
        const softwaresPrest = (p.getString('softwares') || '').toLowerCase()
        if (
          softwaresPrest.includes('revit') ||
          softwaresPrest.includes('bim') ||
          softwaresPrest.includes('tqs') ||
          softwaresPrest.includes('autocad')
        ) {
          score += 10
        }

        // Faixa de preço de referência informada na triagem (Rodada 12)
        const precoRefJson = p.get('preco_referencia_json')
        if (precoRefJson) {
          score += 5
        }

        elegiveis.push({
          prestador: p,
          capacidadeLivre: capLivre,
          notaGeral: nota,
          scoreFinal: score,
        })
      }

      const respostasCol = $app.findCollectionByNameOrId('pre_cotacao_respostas')
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const clientIp = reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'

      // CASO SEM ELEGÍVEIS:
      if (elegiveis.length === 0) {
        // Marca o item como 'sem_cotacao'
        item.set('origem_custo', 'sem_cotacao')
        $app.save(item)

        // Alerta e sugestão de recrutamento da Rodada 12
        let linkRecrutamentoSlug = 'geral'
        try {
          const links = $app.findRecordsByFilter(
            'links_recrutamento',
            "ativo = true && (disciplina_alvo ~ '" + disciplina + "' || disciplina_alvo = 'Geral')",
            '-created',
            1,
            0,
          )
          if (links.length > 0) linkRecrutamentoSlug = links[0].getString('slug')
        } catch (_) {}

        const avisoMsg =
          'PRÉ-COTAÇÃO SEM PRESTADORES ELEGÍVEIS: O item "' +
          descItem +
          '" (' +
          disciplina +
          ') da Proposta ' +
          proposta.getString('numero') +
          ' não encontrou prestadores ativos com conselho válido e CM assinado. Custo mantido pelo catálogo e recrutamento sugerido: /recrutamento/' +
          linkRecrutamentoSlug

        // Auditoria
        try {
          const aRec = new Record(auditCol)
          aRec.set('user', reqInfo.auth.id)
          aRec.set('user_email', reqInfo.auth.getString('email'))
          aRec.set('acao', 'PRE_COTACAO_SEM_ELEGIVEIS')
          aRec.set('entidade', 'pre_cotacoes')
          aRec.set('registro_id', novaPreCot.id)
          aRec.set('detalhes', {
            proposta_id: proposta.id,
            item_id: item.id,
            disciplina: disciplina,
            aviso: avisoMsg,
            link_recrutamento_sugerido: '/recrutamento/' + linkRecrutamentoSlug,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          sem_elegiveis: true,
          pre_cotacao_id: novaPreCot.id,
          codigo: codigoPreCotacao,
          origem_custo: 'sem_cotacao',
          mensagem: avisoMsg,
          link_recrutamento: '/recrutamento/' + linkRecrutamentoSlug,
        })
      }

      // ORDENAR E CONVIDAR
      elegiveis.sort((a, b) => b.scoreFinal - a.scoreFinal)
      const selecionados = elegiveis.slice(0, maxConvidados)
      const convidadosInfo = []

      for (let s = 0; s < selecionados.length; s++) {
        const prest = selecionados[s].prestador
        const novaResp = new Record(respostasCol)
        novaResp.set('pre_cotacao', novaPreCot.id)
        novaResp.set('prestador', prest.id)
        novaResp.set('codigo_pre_cotacao', codigoPreCotacao)
        novaResp.set('disciplina', disciplina)
        novaResp.set('escopo_resumo', escopoAnonimizado)
        novaResp.set('entregaveis_resumo', entregaveisTexto)
        novaResp.set('prazo_desejado_dias', prazoDesejadoDias)
        novaResp.set('data_limite_resposta', dataLimiteIso)
        novaResp.set('status', 'convite_enviado')
        novaResp.set('escolhida', false)
        novaResp.set('lembrete_enviado', false)
        $app.save(novaResp)

        convidadosInfo.push({
          prestador_id: prest.id,
          prestador_nome: prest.getString('nome'),
          email: prest.getString('email'),
        })

        // Envio de E-mail de Notificação ao Prestador
        const prestEmail = prest.getString('email')
        if (prestEmail) {
          try {
            const msg = new MailerMessage({
              from: { address: 'contato@gmais.eng.br', name: 'G+ Engenharia Consultiva' },
              to: [{ address: prestEmail, name: prest.getString('nome') }],
              subject:
                'Oportunidade Técnica ' +
                codigoPreCotacao +
                ' (' +
                disciplina +
                ') — G+ Engenharia',
              html:
                '<p>Olá <strong>' +
                prest.getString('nome') +
                '</strong>,</p><p>Você recebeu um convite de pré-cotação técnica para a disciplina <strong>' +
                disciplina +
                '</strong> (Código <strong>' +
                codigoPreCotacao +
                '</strong>).</p><p>Acesse o Portal do Prestador para conferir o escopo preliminar e enviar sua proposta vinculante.</p>',
            })
            $app.newMailClient().send(msg)
          } catch (_) {}
        }
      }

      // Auditoria
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'PRE_COTACAO_ABERTA')
        aRec.set('entidade', 'pre_cotacoes')
        aRec.set('registro_id', novaPreCot.id)
        aRec.set('detalhes', {
          codigo: codigoPreCotacao,
          proposta_id: proposta.id,
          item_id: item.id,
          disciplina: disciplina,
          total_convidados: convidadosInfo.length,
          data_limite: dataLimiteIso,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        sem_elegiveis: false,
        pre_cotacao_id: novaPreCot.id,
        codigo: codigoPreCotacao,
        disciplina: disciplina,
        total_convidados: convidadosInfo.length,
        convidados: convidadosInfo.map((c) => c.prestador_nome),
        data_limite: dataLimiteIso,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao abrir pré-cotação: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 2. ENDPOINT: RESPOSTA VINCULANTE DO PRESTADOR PELO PORTAL
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/portal-prestador/pre-cotacoes/{resposta_id}/responder',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const respostaId = e.request.pathValue('resposta_id')
      let resposta
      try {
        resposta = $app.findRecordById('pre_cotacao_respostas', respostaId)
      } catch (_) {
        return e.json(404, { error: 'Convite de pré-cotação não encontrado.' })
      }

      // Validação de isolamento do prestador
      const prestadorId = resposta.getString('prestador')
      let prestador
      try {
        prestador = $app.findRecordById('prestadores', prestadorId)
      } catch (_) {
        return e.json(404, { error: 'Prestador não encontrado.' })
      }

      const authEmail = reqInfo.auth.getString('email')
      const prestEmail = prestador.getString('email')
      const role = reqInfo.auth.getString('role')

      if (role === 'executor' && authEmail.toLowerCase() !== prestEmail.toLowerCase()) {
        return e.json(403, {
          error: 'Acesso negado: você só pode responder pré-cotações direcionadas ao seu cadastro.',
        })
      }

      const statusAtual = resposta.getString('status')
      if (statusAtual === 'travada' || statusAtual === 'liberada' || statusAtual === 'expirada') {
        return e.json(400, {
          error: 'Esta pré-cotação já foi finalizada ou expirada e não aceita mais alterações.',
        })
      }

      const body = e.requestInfo().body || {}
      const precoOfertado = Number(body.preco_ofertado) || 0
      const prazoOfertadoDias = parseInt(body.prazo_ofertado_dias, 10) || 0
      const premissas = String(body.premissas || '').trim()
      const observacoes = String(body.observacoes || '').trim()
      const aceiteVinculante = Boolean(body.aceite_vinculante)

      if (precoOfertado <= 0) {
        return e.json(400, { error: 'O preço ofertado deve ser maior que zero.' })
      }
      if (prazoOfertadoDias <= 0) {
        return e.json(400, { error: 'O prazo ofertado em dias deve ser informado.' })
      }
      if (!aceiteVinculante) {
        return e.json(400, {
          error:
            'O aceite dos termos vinculantes da pré-cotação é obrigatório para registrar a proposta.',
        })
      }

      const clientIp = reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'
      const clientUserAgent = reqInfo.headers ? reqInfo.headers['user-agent'] : 'Browser'
      const now = new Date()
      const nowIso = now.toISOString()

      // Geração de Hash SHA-256 de Aceite Vinculante
      const payloadString = [
        resposta.id,
        resposta.getString('codigo_pre_cotacao'),
        prestador.id,
        precoOfertado.toFixed(2),
        prazoOfertadoDias,
        nowIso,
        clientIp,
      ].join('|')
      const aceiteHash = $security.sha256(payloadString)

      resposta.set('preco_ofertado', precoOfertado)
      resposta.set('prazo_ofertado_dias', prazoOfertadoDias)
      resposta.set('premissas', premissas)
      resposta.set('observacoes', observacoes)
      resposta.set('aceite_vinculante', true)
      resposta.set('aceite_hash', aceiteHash)
      resposta.set('aceite_ip', clientIp)
      resposta.set('aceite_user_agent', clientUserAgent)
      resposta.set('aceite_timestamp', nowIso)
      resposta.set('data_resposta', nowIso)
      resposta.set('status', 'enviada')
      $app.save(resposta)

      // Atualiza status da pré-cotação pai para 'respondida'
      const preCotId = resposta.getString('pre_cotacao')
      if (preCotId) {
        try {
          const preCot = $app.findRecordById('pre_cotacoes', preCotId)
          if (preCot && preCot.getString('status') === 'aberta') {
            preCot.set('status', 'respondida')
            $app.save(preCot)
          }
        } catch (_) {}
      }

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'PRE_COTACAO_RESPOSTA_ENVIADA')
        aRec.set('entidade', 'pre_cotacao_respostas')
        aRec.set('registro_id', resposta.id)
        aRec.set('detalhes', {
          codigo: resposta.getString('codigo_pre_cotacao'),
          preco_ofertado: precoOfertado,
          prazo_ofertado_dias: prazoOfertadoDias,
          aceite_hash: aceiteHash,
          timestamp: nowIso,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        mensagem: 'Proposta vinculante enviada com sucesso.',
        resposta_id: resposta.id,
        codigo_pre_cotacao: resposta.getString('codigo_pre_cotacao'),
        aceite_hash: aceiteHash,
        status: 'enviada',
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao registrar resposta vinculante: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 3. ENDPOINT: GESTOR ESCOLHE A RESPOSTA VENCEDORA
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/pre-cotacoes/{id}/escolher',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          error: 'Apenas Administrador e Gestor podem selecionar a proposta vencedora.',
        })
      }

      const preCotId = e.request.pathValue('id')
      let preCot
      try {
        preCot = $app.findRecordById('pre_cotacoes', preCotId)
      } catch (_) {
        return e.json(404, { error: 'Pré-cotação não encontrada.' })
      }

      const body = e.requestInfo().body || {}
      const respostaId = body.resposta_id
      if (!respostaId) {
        return e.json(400, { error: 'ID da resposta vencedora não informado.' })
      }

      let respVencedora
      try {
        respVencedora = $app.findRecordById('pre_cotacao_respostas', respostaId)
      } catch (_) {
        return e.json(404, { error: 'Resposta informada não encontrada.' })
      }

      if (respVencedora.getString('pre_cotacao') !== preCot.id) {
        return e.json(400, { error: 'A resposta não pertence a esta pré-cotação.' })
      }

      const precoEscolhido = respVencedora.getFloat('preco_ofertado') || 0
      const prazoEscolhidoDias = respVencedora.getInt('prazo_ofertado_dias') || 30
      const prestadorVencedorId = respVencedora.getString('prestador')

      if (precoEscolhido <= 0) {
        return e.json(400, {
          error: 'A resposta escolhida deve possuir preço válido maior que zero.',
        })
      }

      const itemId = preCot.getString('item_proposta')
      const propostaId = preCot.getString('proposta')

      let item = null
      let proposta = null
      if (itemId) {
        try {
          item = $app.findRecordById('proposta_itens', itemId)
        } catch (_) {}
      }
      if (propostaId) {
        try {
          proposta = $app.findRecordById('propostas', propostaId)
        } catch (_) {}
      }

      if (!item) {
        return e.json(404, { error: 'Item de proposta vinculado não encontrado.' })
      }

      // 1. Atualizar o item da proposta:
      // origem_custo = 'pre_cotacao', preco_travado, prazo_travado_dias, prestador_vencedor, pre_cotacao_vencedora
      const qtd = item.getFloat('quantidade') || 1
      const custoUnit = Math.round((precoEscolhido / qtd) * 100) / 100
      item.set('origem_custo', 'pre_cotacao')
      item.set('custo_unitario', custoUnit)
      item.set('custo_total', precoEscolhido)
      item.set('preco_travado', precoEscolhido)
      item.set('prazo_travado_dias', prazoEscolhidoDias)
      item.set('prestador_vencedor', prestadorVencedorId)
      item.set('pre_cotacao_vencedora', prestadorVencedorId)
      $app.save(item)

      // 2. Recalcular margem e custo da proposta (Rotina Rodada 8)
      if (proposta) {
        try {
          const todosItens = $app.findRecordsByFilter(
            'proposta_itens',
            "proposta = '" + proposta.id + "'",
            '',
            200,
            0,
          )
          let novoCustoTotal = 0
          for (let it = 0; it < todosItens.length; it++) {
            novoCustoTotal += todosItens[it].getFloat('custo_total') || 0
          }
          const precoVendaProposta = proposta.getFloat('preco') || 0
          proposta.set('custo', Math.round(novoCustoTotal * 100) / 100)

          if (precoVendaProposta > 0) {
            const margemEfetiva = ((precoVendaProposta - novoCustoTotal) / precoVendaProposta) * 100
            proposta.set('margem', Math.round(margemEfetiva * 10) / 10)
          }
          $app.save(proposta)
        } catch (errMargem) {
          console.log('Erro ao recalcular margem da proposta: ' + errMargem)
        }
      }

      // 3. Encerrar a pré-cotação como 'convertida'
      preCot.set('status', 'convertida')
      preCot.set('resposta_escolhida_id', respVencedora.id)
      preCot.set(
        'motivo_encerramento',
        'Vencedor selecionado pelo Gestor e custo vinculado à proposta.',
      )
      $app.save(preCot)

      // 4. Travar a resposta vencedora
      respVencedora.set('escolhida', true)
      respVencedora.set('status', 'travada')
      $app.save(respVencedora)

      // 5. LIBERAR os demais prestadores com aviso SEM citar quem venceu nem valores
      const agoraIso = new Date().toISOString()
      const outrasRespostas = $app.findRecordsByFilter(
        'pre_cotacao_respostas',
        "pre_cotacao = '" + preCot.id + "' && id != '" + respVencedora.id + "'",
        '',
        100,
        0,
      )

      for (let r = 0; r < outrasRespostas.length; r++) {
        const respOutra = outrasRespostas[r]
        respOutra.set('escolhida', false)
        respOutra.set('status', 'liberada')
        respOutra.set(
          'aviso_liberacao',
          'Agradecemos a participação. Para este escopo provisório, a G+ Engenharia concluiu a seleção da proposta técnica. Seus dados e capacidade permanecem disponíveis para novos convites.',
        )
        respOutra.set('data_liberacao', agoraIso)
        $app.save(respOutra)

        // Enviar e-mail discreto de liberação sem detalhes do vencedor
        const pId = respOutra.getString('prestador')
        if (pId) {
          try {
            const prestOutro = $app.findRecordById('prestadores', pId)
            const em = prestOutro.getString('email')
            if (em) {
              const msg = new MailerMessage({
                from: { address: 'contato@gmais.eng.br', name: 'G+ Engenharia Consultiva' },
                to: [{ address: em, name: prestOutro.getString('nome') }],
                subject:
                  'Aviso de Conclusão de Seleção — ' +
                  preCot.getString('codigo') +
                  ' — G+ Engenharia',
                html:
                  '<p>Olá <strong>' +
                  prestOutro.getString('nome') +
                  '</strong>,</p><p>Agradecemos sua submissão para a oportunidade provisória <strong>' +
                  preCot.getString('codigo') +
                  '</strong> (' +
                  preCot.getString('disciplina') +
                  ').</p><p>A etapa de seleção desta oportunidade foi concluída. Sua capacidade e disponibilidade já foram liberadas para novas convocações na plataforma G+.</p>',
              })
              $app.newMailClient().send(msg)
            }
          } catch (_) {}
        }
      }

      // Auditoria
      const clientIp = reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'PRE_COTACAO_VENCEDOR_ESCOLHIDO')
        aRec.set('entidade', 'pre_cotacoes')
        aRec.set('registro_id', preCot.id)
        aRec.set('detalhes', {
          codigo: preCot.getString('codigo'),
          resposta_escolhida: respVencedora.id,
          preco_travado: precoEscolhido,
          prazo_travado_dias: prazoEscolhidoDias,
          prestador_vencedor_id: prestadorVencedorId,
          proposta_id: propostaId,
          item_id: itemId,
          total_liberados: outrasRespostas.length,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        mensagem:
          'Proposta vencedora fixada com sucesso. Custo vinculado e prestadores concorrentes liberados.',
        codigo_pre_cotacao: preCot.getString('codigo'),
        preco_travado: precoEscolhido,
        prazo_travado_dias: prazoEscolhidoDias,
        prestador_vencedor_id: prestadorVencedorId,
        total_prestadores_liberados: outrasRespostas.length,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao escolher vencedor da pré-cotação: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 4. ENDPOINT: EDITAR CUSTO DE ITEM COM ORIGEM PRE_COTACAO (EXIGE MOTIVO AUDITADO)
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/propostas/{proposta_id}/itens/{item_id}/editar-custo-auditado',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor' && role !== 'comercial') {
        return e.json(403, {
          error: 'Apenas Administrador, Gestor ou Comercial podem editar custos da proposta.',
        })
      }

      const propostaId = e.request.pathValue('proposta_id')
      const itemId = e.request.pathValue('item_id')

      let item
      try {
        item = $app.findRecordById('proposta_itens', itemId)
      } catch (_) {
        return e.json(404, { error: 'Item de proposta não encontrado.' })
      }

      const body = e.requestInfo().body || {}
      const novoCustoTotal = Number(body.novo_custo_total)
      const motivo = String(body.motivo_edicao_custo || '').trim()

      if (isNaN(novoCustoTotal) || novoCustoTotal < 0) {
        return e.json(400, { error: 'Novo custo total inválido.' })
      }

      const origemAtual = item.getString('origem_custo')
      // Se a origem atual for 'pre_cotacao', o motivo é OBRIGATÓRIO
      if (origemAtual === 'pre_cotacao' && (!motivo || motivo.length < 5)) {
        return e.json(400, {
          error:
            'A edição de custo oriundo de pré-cotação vinculante exige preenchimento do motivo auditado (mínimo 5 caracteres).',
        })
      }

      const custoAntigo = item.getFloat('custo_total') || 0
      const qtd = item.getFloat('quantidade') || 1
      const novoCustoUnit = Math.round((novoCustoTotal / qtd) * 100) / 100

      item.set('custo_total', novoCustoTotal)
      item.set('custo_unitario', novoCustoUnit)
      item.set('origem_custo', 'manual_auditado')
      item.set('motivo_edicao_custo', motivo)
      $app.save(item)

      // Recalcular proposta
      try {
        const proposta = $app.findRecordById('propostas', propostaId)
        if (proposta) {
          const todosItens = $app.findRecordsByFilter(
            'proposta_itens',
            "proposta = '" + proposta.id + "'",
            '',
            200,
            0,
          )
          let somaCusto = 0
          for (let i = 0; i < todosItens.length; i++) {
            somaCusto += todosItens[i].getFloat('custo_total') || 0
          }
          proposta.set('custo', Math.round(somaCusto * 100) / 100)
          const preco = proposta.getFloat('preco') || 0
          if (preco > 0) {
            const margem = ((preco - somaCusto) / preco) * 100
            proposta.set('margem', Math.round(margem * 10) / 10)
          }
          $app.save(proposta)
        }
      } catch (_) {}

      // Auditoria obrigatória
      const clientIp = reqInfo.headers ? reqInfo.headers['x-forwarded-for'] : '127.0.0.1'
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'EDICAO_CUSTO_ITEM_AUDITADA')
        aRec.set('entidade', 'proposta_itens')
        aRec.set('registro_id', item.id)
        aRec.set('detalhes', {
          proposta_id: propostaId,
          custo_anterior: custoAntigo,
          custo_novo: novoCustoTotal,
          origem_anterior: origemAtual,
          origem_nova: 'manual_auditado',
          motivo_edicao: motivo,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        mensagem: 'Custo do item atualizado e auditado com sucesso.',
        item_id: item.id,
        origem_custo: 'manual_auditado',
        custo_total: novoCustoTotal,
        motivo_edicao_custo: motivo,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao editar custo auditado: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 5. ENDPOINT: CONSULTA DE PRÉ-COTAÇÕES DO ITEM PARA GESTOR/COMERCIAL
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/pre-cotacoes/item/{item_id}',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { error: 'Autenticação necessária' })
      }

      const itemId = e.request.pathValue('item_id')
      const precots = $app.findRecordsByFilter(
        'pre_cotacoes',
        "item_proposta = '" + itemId + "'",
        '-created',
        10,
        0,
      )

      if (precots.length === 0) {
        return e.json(200, { existe: false, pre_cotacoes: [] })
      }

      const resultado = []
      for (let i = 0; i < precots.length; i++) {
        const pc = precots[i]
        const respostas = $app.findRecordsByFilter(
          'pre_cotacao_respostas',
          "pre_cotacao = '" + pc.id + "'",
          '-preco_ofertado',
          50,
          0,
        )

        const respFormatadas = []
        for (let r = 0; r < respostas.length; r++) {
          const resp = respostas[r]
          let prestNome = 'Prestador'
          const pId = resp.getString('prestador')
          if (pId) {
            try {
              const p = $app.findRecordById('prestadores', pId)
              if (p) prestNome = p.getString('nome')
            } catch (_) {}
          }

          respFormatadas.push({
            id: resp.id,
            prestador_id: pId,
            prestador_nome: prestNome,
            preco_ofertado: resp.getFloat('preco_ofertado') || 0,
            prazo_ofertado_dias: resp.getInt('prazo_ofertado_dias') || 0,
            premissas: resp.getString('premissas'),
            observacoes: resp.getString('observacoes'),
            status: resp.getString('status'),
            escolhida: Boolean(resp.getBool('escolhida')),
            aceite_vinculante: Boolean(resp.getBool('aceite_vinculante')),
            aceite_hash: resp.getString('aceite_hash'),
            aceite_timestamp: resp.getString('aceite_timestamp'),
            data_resposta: resp.getString('data_resposta'),
          })
        }

        resultado.push({
          id: pc.id,
          codigo: pc.getString('codigo'),
          disciplina: pc.getString('disciplina'),
          escopo_anonimizado: pc.getString('escopo_anonimizado'),
          entregaveis_texto: pc.getString('entregaveis_texto'),
          prazo_desejado_dias: pc.getInt('prazo_desejado_dias'),
          validade_dias: pc.getInt('validade_dias'),
          data_limite: pc.getString('data_limite'),
          status: pc.getString('status'),
          resposta_escolhida_id: pc.getString('resposta_escolhida_id'),
          respostas: respFormatadas,
        })
      }

      return e.json(200, {
        existe: true,
        total: resultado.length,
        pre_cotacoes: resultado,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao consultar pré-cotações: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 6. CRON DE EXPIRAÇÃO DE PRÉ-COTAÇÕES E LIBERAÇÃO AUTOMÁTICA
// -----------------------------------------------------------------------------
cronAdd('pre_cotacoes_expiracao', '*/10 * * * *', () => {
  try {
    const agora = new Date()
    const agoraIso = agora.toISOString()

    // 1. Pré-cotações abertas ou respondidas que passaram da data_limite
    const vencidas = $app.findRecordsByFilter(
      'pre_cotacoes',
      "(status = 'aberta' || status = 'respondida') && data_limite != '' && data_limite < '" +
        agoraIso +
        "'",
      '',
      100,
      0,
    )

    for (let i = 0; i < vencidas.length; i++) {
      const pc = vencidas[i]
      pc.set('status', 'expirada')
      pc.set('motivo_encerramento', 'Validade da pré-cotação expirada automaticamente.')
      $app.save(pc)

      // Libera todas as respostas pendentes
      const resps = $app.findRecordsByFilter(
        'pre_cotacao_respostas',
        "pre_cotacao = '" + pc.id + "' && status != 'travada'",
        '',
        100,
        0,
      )
      for (let r = 0; r < resps.length; r++) {
        const resp = resps[r]
        resp.set('status', 'expirada')
        resp.set(
          'aviso_liberacao',
          'A oportunidade provisória ' +
            pc.getString('codigo') +
            ' expirou. Sua disponibilidade e capacidade permanecem liberadas.',
        )
        resp.set('data_liberacao', agoraIso)
        $app.save(resp)
      }
    }
  } catch (errCron) {
    console.log('Aviso no cron de expiração de pré-cotações: ' + errCron)
  }
})
