// Hook de operações do BLOCO 5: Cotações por Projeto, Subcontratação e Assinatura Digital do Executor
// Endpoints REST dedicados com segurança, auditoria completa, geração de parcelas financeiras e disparo de e-mails/notificações

// 1. Endpoint: Criar solicitação de cotação para múltiplos executores (por Projeto) com disparo de e-mail e auditoria
routerAdd(
  'POST',
  '/backend/v1/projetos/solicitar-cotacoes',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message: 'Apenas Administradores e Gestores de Projetos podem solicitar cotações.',
        })
      }

      const body = reqInfo.body || {}
      const projetoId = body.projeto_id
      const executoresIds = Array.isArray(body.executores_ids) ? body.executores_ids : []
      const escopo = (body.escopo || '').trim()
      const dataLimite = body.data_limite || ''
      const enviarEmail = body.enviar_email !== false

      if (!projetoId) {
        return e.json(400, { message: 'ID do projeto não informado' })
      }
      if (executoresIds.length === 0) {
        return e.json(400, { message: 'Selecione ao menos um executor homologado para cotar' })
      }

      const projeto = $app.findRecordById('projetos', projetoId)
      if (!projeto) {
        return e.json(404, { message: 'Projeto não encontrado' })
      }

      const cotacoesCol = $app.findCollectionByNameOrId('cotacoes')
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const cotacoesCriadas = []

      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'
      const senderAddress =
        ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
      const senderName =
        ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

      for (let i = 0; i < executoresIds.length; i++) {
        const execId = executoresIds[i]
        try {
          const executor = $app.findRecordById('executores', execId)
          if (!executor) continue

          // Somente executores homologados/ativos podem receber cotação
          if (executor.getString('status') === 'suspenso') {
            continue
          }

          // Bloqueio server-side de convite para cotação quando o registro estiver vencido
          const valConselho =
            executor.getString('conselho_validade') ||
            executor.getString('validade_registro_conselho') ||
            ''
          if (valConselho) {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const dtVal = new Date(valConselho.substring(0, 10) + 'T23:59:59.000Z')
            if (dtVal < hoje) {
              throw new BadRequestError(
                'BLOQUEIO_COTACAO: Executor ' +
                  executor.getString('nome') +
                  ' possui registro de conselho VENCIDO (' +
                  valConselho.substring(0, 10) +
                  ') e não pode receber cotações.',
              )
            }
          }

          const token = $security.randomString(32)
          const novaCotacao = new Record(cotacoesCol)
          novaCotacao.set('projeto', projetoId)
          if (projeto.getString('grupo')) {
            novaCotacao.set('grupo', projeto.getString('grupo'))
          }
          novaCotacao.set('executor', execId)
          novaCotacao.set(
            'escopo',
            escopo ||
              projeto.getString('descricao') ||
              'Execução técnica dos serviços de engenharia',
          )
          if (dataLimite) {
            novaCotacao.set('data_limite', dataLimite)
            novaCotacao.set('prazo_resposta', dataLimite)
          }
          novaCotacao.set('token', token)
          novaCotacao.set('status', 'convite_enviado')
          novaCotacao.set('escolhida', false)
          novaCotacao.set('registrado_por', reqInfo.auth.id)

          $app.save(novaCotacao)
          cotacoesCriadas.push(novaCotacao)

          const linkCotacao = appUrl + '/cotacao/' + token

          // Auditoria de convite
          try {
            const aRec = new Record(auditCol)
            aRec.set('user', reqInfo.auth.id)
            aRec.set('user_email', reqInfo.auth.getString('email'))
            aRec.set('acao', 'CONVITE_COTACAO_PROJETO')
            aRec.set('entidade', 'cotacoes')
            aRec.set('registro_id', novaCotacao.id)
            aRec.set('detalhes', {
              mensagem:
                'Solicitação de cotação enviada para o executor ' +
                executor.getString('nome') +
                ' no projeto ' +
                projeto.getString('codigo'),
              projeto_id: projetoId,
              projeto_codigo: projeto.getString('codigo'),
              executor_id: execId,
              executor_nome: executor.getString('nome'),
              data_limite: dataLimite,
              link_cotacao: linkCotacao,
            })
            aRec.set(
              'ip',
              (reqInfo.headers &&
                (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
                '127.0.0.1',
            )
            $app.save(aRec)
          } catch (_) {}

          // Envio de e-mail ao executor se solicitado e se houver e-mail cadastrado
          const execEmail = executor.getString('email')
          if (enviarEmail && execEmail && execEmail.includes('@')) {
            try {
              const htmlEmail =
                '<!DOCTYPE html><html><body style="font-family: sans-serif; background: #f8fafc; padding: 20px; color: #1e293b;">' +
                '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">' +
                '<div style="background: #1E2A4A; padding: 20px; border-bottom: 3px solid #D95A2B; color: #fff;">' +
                '<span style="font-size: 18px; font-weight: bold;">G+ ENGENHARIA</span><br/>' +
                '<span style="font-size: 11px; color: #cbd5e1;">Solicitação de Cotação Técnica</span>' +
                '</div>' +
                '<div style="padding: 24px; font-size: 14px; line-height: 1.6;">' +
                '<p>Prezado(a) <strong>' +
                executor.getString('nome') +
                '</strong>,</p>' +
                '<p>A G+ Engenharia convida sua equipe a apresentar cotação de preço e prazo para o projeto <strong>' +
                projeto.getString('codigo') +
                ' (' +
                projeto.getString('nome') +
                ')</strong>.</p>' +
                (dataLimite
                  ? '<p><strong>Prazo limite para resposta:</strong> ' +
                    dataLimite.substring(0, 10).split('-').reverse().join('/') +
                    '</p>'
                  : '') +
                '<p style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">' +
                '<strong>Escopo:</strong><br/>' +
                (escopo ||
                  projeto.getString('descricao') ||
                  'Detalhamento do projeto de engenharia') +
                '</p>' +
                '<div style="text-align: center; margin: 28px 0;">' +
                '<a href="' +
                linkCotacao +
                '" style="background: #D95A2B; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">Acessar e Responder Cotação</a>' +
                '</div>' +
                '</div>' +
                '<div style="padding: 14px; background: #f1f5f9; font-size: 11px; text-align: center; color: #64748b;">' +
                'G+ Engenharia Consultiva • Coordenação de Executores' +
                '</div>' +
                '</div></body></html>'

              const msg = new MailerMessage({
                from: { address: senderAddress, name: senderName },
                to: [{ address: execEmail, name: executor.getString('nome') }],
                subject:
                  'Solicitação de Cotação — Projeto ' +
                  projeto.getString('codigo') +
                  ' — G+ Engenharia',
                html: htmlEmail,
              })
              $app.newMailClient().send(msg)
            } catch (errMail) {
              console.log('Aviso ao enviar e-mail de cotação para executor: ' + errMail)
            }
          }
        } catch (errExec) {
          console.log('Erro ao processar executor na cotação: ' + errExec)
        }
      }

      return e.json(200, {
        success: true,
        message: 'Cotações solicitadas com sucesso!',
        total_cotacoes: cotacoesCriadas.length,
      })
    } catch (err) {
      console.log('Erro interno em solicitar-cotacoes: ' + err)
      return e.json(500, { message: 'Erro interno ao solicitar cotações: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 2. Endpoint: Registrar resposta recebida fora do sistema (ex: telefone, WhatsApp, reunião)
routerAdd(
  'POST',
  '/backend/v1/cotacoes/registrar-resposta-externa',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message: 'Apenas Administradores e Gestores de Projetos podem registrar respostas.',
        })
      }

      const body = reqInfo.body || {}
      const cotacaoId = body.cotacao_id
      const precoOfertado = parseFloat(body.preco_ofertado)
      const prazoOfertado = (body.prazo_ofertado || '').trim()
      const observacoes = (body.observacoes || '').trim()

      if (!cotacaoId) {
        return e.json(400, { message: 'ID da cotação não informado' })
      }
      if (isNaN(precoOfertado) || precoOfertado <= 0) {
        return e.json(400, { message: 'Preço ofertado deve ser maior que zero' })
      }
      if (!prazoOfertado) {
        return e.json(400, { message: 'Prazo ofertado é obrigatório' })
      }

      const cotacao = $app.findRecordById('cotacoes', cotacaoId)
      if (!cotacao) {
        return e.json(404, { message: 'Cotação não encontrada' })
      }

      cotacao.set('preco_ofertado', precoOfertado)
      cotacao.set('prazo_ofertado', prazoOfertado)
      cotacao.set('observacoes', observacoes)
      cotacao.set('status', 'respondida')
      cotacao.set('resposta_externa', true)
      cotacao.set('data_resposta', new Date().toISOString())
      cotacao.set('registrado_por', reqInfo.auth.id)

      $app.save(cotacao)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'RESPOSTA_COTACAO_EXTERNA')
        aRec.set('entidade', 'cotacoes')
        aRec.set('registro_id', cotacaoId)
        aRec.set('detalhes', {
          mensagem: 'Resposta de cotação registrada manualmente pelo gestor',
          preco_ofertado: precoOfertado,
          prazo_ofertado: prazoOfertado,
          observacoes: observacoes,
        })
        aRec.set(
          'ip',
          (reqInfo.headers &&
            (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
            '127.0.0.1',
        )
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Resposta de cotação registrada com sucesso!',
        cotacao_id: cotacaoId,
      })
    } catch (err) {
      console.log('Erro interno em registrar-resposta-externa: ' + err)
      return e.json(500, { message: 'Erro interno ao registrar resposta: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 3. Endpoint: Contratar Executor para o Projeto (Gera Subcontrato + Contas a Pagar + Auditoria + Notificação)
routerAdd(
  'POST',
  '/backend/v1/projetos/contratar-executor',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message: 'Apenas Administradores e Gestores de Projetos podem contratar executores.',
        })
      }

      const body = reqInfo.body || {}
      const projetoId = body.projeto_id
      const cotacaoId = body.cotacao_id
      const modoExecucao = body.modo_execucao // 'terceirizada_parcial' | 'terceirizada_integral'
      const descricaoDelegada = (body.descricao_delegada || '').trim()
      const condicoesPagamento = (body.condicoes_pagamento || '').trim()
      const parcelas = Array.isArray(body.parcelas) ? body.parcelas : []

      if (!projetoId) {
        return e.json(400, { message: 'ID do projeto não informado' })
      }
      if (!cotacaoId) {
        return e.json(400, { message: 'ID da cotação vencedora não informado' })
      }
      if (modoExecucao !== 'terceirizada_parcial' && modoExecucao !== 'terceirizada_integral') {
        return e.json(400, { message: 'Modo de execução inválido para contratação externa' })
      }
      if (modoExecucao === 'terceirizada_parcial' && !descricaoDelegada) {
        return e.json(400, {
          message:
            'A descrição da parte delegada é obrigatória para contratação terceirizada parcial.',
        })
      }

      const projeto = $app.findRecordById('projetos', projetoId)
      if (!projeto) {
        return e.json(404, { message: 'Projeto não encontrado' })
      }

      const cotacao = $app.findRecordById('cotacoes', cotacaoId)
      if (!cotacao) {
        return e.json(404, { message: 'Cotação não encontrada' })
      }

      const executorId = cotacao.getString('executor')
      const executor = $app.findRecordById('executores', executorId)
      if (!executor) {
        return e.json(404, { message: 'Executor não encontrado' })
      }

      // Validação de executor homologado
      if (executor.getString('status') === 'suspenso') {
        return e.json(400, {
          message: 'Executor está suspenso e não pode ser contratado.',
        })
      }

      const precoContratado = cotacao.getFloat('preco_ofertado') || 0
      if (precoContratado <= 0) {
        return e.json(400, {
          message: 'A cotação precisa possuir um preço ofertado válido para gerar a contratação.',
        })
      }

      // 1. Herdar automaticamente o Contrato Original de referência e suas propriedades (PRAZO e CLÁUSULAS)
      let contratoServicoOrigem = null
      let prazoDiasContratoOriginal = 30
      let notaPrazoContratoOriginal = ''
      let clausulasContratoOriginal = ''

      const contratoServicoId = projeto.getString('contrato_servico')
      if (contratoServicoId) {
        try {
          contratoServicoOrigem = $app.findRecordById('contratos_servico', contratoServicoId)
          if (contratoServicoOrigem) {
            prazoDiasContratoOriginal = contratoServicoOrigem.getInt('prazo_dias') || 30
            notaPrazoContratoOriginal = contratoServicoOrigem.getString('nota_prazo') || ''
            clausulasContratoOriginal = contratoServicoOrigem.getString('clausulas_texto') || ''
          }
        } catch (_) {}
      }

      // Se não encontrou no contrato de serviço, busca nas configurações de parâmetros
      let clausulasTermo = ''
      try {
        const pClausulas = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'subcontrato_clausulas_padrao',
        )
        if (pClausulas) {
          clausulasTermo = pClausulas.getString('valor')
        }
      } catch (_) {}

      if (!clausulasTermo) {
        clausulasTermo = clausulasContratoOriginal || 'Cláusulas de Subcontratação da G+ Engenharia'
      }

      // Substituição de variáveis no modelo de cláusulas
      const numPreco = precoContratado.toFixed(2)
      const partesValor = numPreco.split('.')
      let intPart = partesValor[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      const precoFmt = 'R$ ' + intPart + ',' + partesValor[1]

      clausulasTermo = clausulasTermo
        .split('{prazo_dias_contrato}')
        .join(String(prazoDiasContratoOriginal))
        .split('{valor_subcontrato}')
        .join(precoFmt)
        .split('{projeto_codigo}')
        .join(projeto.getString('codigo'))
        .split('{executor_nome}')
        .join(executor.getString('nome'))

      // 2. Gerar número sequencial SUB-AAAA-NNNN sem lacunas
      const anoAtual = new Date().getFullYear()
      const prefixoSUB = 'SUB-' + anoAtual + '-'
      let proximoSeqSub = 1
      try {
        const subsDoAno = $app.findRecordsByFilter(
          'subcontratos',
          "numero ~ '" + prefixoSUB + "'",
          '-numero',
          1,
          0,
        )
        if (subsDoAno.length > 0) {
          const ult = subsDoAno[0].getString('numero')
          const partes = ult.split('-')
          const num = parseInt(partes[2], 10)
          if (!isNaN(num)) proximoSeqSub = num + 1
        }
      } catch (_) {}

      const seqStr = ('0000' + proximoSeqSub).slice(-4)
      const numeroSub = prefixoSUB + seqStr
      const tokenAssinatura = $security.randomString(32)

      // 3. Criar registro na coleção 'subcontratos'
      const subcontratosCol = $app.findCollectionByNameOrId('subcontratos')
      const novoSub = new Record(subcontratosCol)
      novoSub.set('numero', numeroSub)
      novoSub.set('projeto', projetoId)
      novoSub.set('grupo', projeto.getString('grupo') || '')
      novoSub.set(
        'contrato_servico_origem',
        projeto.getString('contrato_servico') || contratoServicoId || '',
      )
      novoSub.set('executor', executorId)
      novoSub.set('cotacao', cotacaoId)
      novoSub.set('modo_execucao', modoExecucao)
      novoSub.set('descricao_escopo', cotacao.getString('escopo') || projeto.getString('descricao'))
      novoSub.set('descricao_delegada', descricaoDelegada)
      novoSub.set('valor_total', precoContratado)
      novoSub.set('prazo_dias', prazoDiasContratoOriginal)
      novoSub.set(
        'nota_prazo',
        notaPrazoContratoOriginal ||
          'O projeto do executor terá a mesma duração do contrato original de referência (' +
            prazoDiasContratoOriginal +
            ' dias).',
      )
      novoSub.set('clausulas_texto', clausulasTermo)
      novoSub.set('condicoes_pagamento', condicoesPagamento)
      novoSub.set('parcelas_json', parcelas)

      // Percentual de retenção técnica: do payload ou buscar padrão de parâmetros (default 10%)
      let pctRetencao = parseFloat(body.percentual_retencao_tecnica)
      if (isNaN(pctRetencao) || pctRetencao < 0) {
        try {
          const pRec = $app.findFirstRecordByData(
            'parametros',
            'chave',
            'subcontrato_retencao_tecnica_padrao',
          )
          if (pRec) {
            pctRetencao = parseFloat(pRec.getString('valor')) || 10
          } else {
            pctRetencao = 10
          }
        } catch (_) {
          pctRetencao = 10
        }
      }
      novoSub.set('percentual_retencao_tecnica', pctRetencao)
      novoSub.set('retencao_tecnica_acumulada', 0)
      novoSub.set('retencao_tecnica_liberada', 0)
      novoSub.set('status_retencao', pctRetencao > 0 ? 'acumulando' : 'sem_retencao')

      // Checklist padrão de encerramento automático com 4 itens auditáveis
      const checklistInicial = [
        {
          id: 'art_rrt',
          titulo: 'ART / RRT recolhida e averbada',
          descricao: 'Anotação ou Registro de Responsabilidade Técnica comprovado pelo executor.',
          concluido: false,
          concluido_por: '',
          data_conclusao: '',
        },
        {
          id: 'laudos',
          titulo: 'Laudos e entregáveis técnicos entregues e aprovados',
          descricao:
            'Todos os documentos, memórias de cálculo ou relatórios técnicos foram conferidos.',
          concluido: false,
          concluido_por: '',
          data_conclusao: '',
        },
        {
          id: 'medicao_final',
          titulo: 'Medição final conferida e fechada',
          descricao: 'Escopo 100% medido e aprovado sem novas medições pendentes.',
          concluido: false,
          concluido_por: '',
          data_conclusao: '',
        },
        {
          id: 'avaliacao_registrada',
          titulo: 'Avaliação do executor registrada no sistema',
          descricao:
            'Avaliação de prazo, qualidade e comunicação concluída na ficha de avaliações.',
          concluido: false,
          concluido_por: '',
          data_conclusao: '',
        },
      ]
      novoSub.set('checklist_encerramento_json', checklistInicial)

      novoSub.set('status', 'aguardando_assinatura')
      novoSub.set('token_assinatura', tokenAssinatura)
      novoSub.set('emitido_por', reqInfo.auth.id)
      novoSub.set('data_emissao', new Date().toISOString())

      $app.save(novoSub)

      // 4. Marcar cotação como ESCOLHIDA (e desmarcar demais)
      cotacao.set('escolhida', true)
      cotacao.set('status', 'escolhida')
      $app.save(cotacao)

      // 5. Atualizar modo de execução e descrição delegada no Projeto
      projeto.set('modo_execucao', modoExecucao)
      projeto.set('descricao_delegada', descricaoDelegada)
      $app.save(projeto)

      // 6. Gerar CONTAS A PAGAR integradas ao financeiro existente
      const contasCol = $app.findCollectionByNameOrId('contas')
      const auditCol = $app.findCollectionByNameOrId('audit_logs')

      let parcelasParaCriar = parcelas
      if (!parcelasParaCriar || parcelasParaCriar.length === 0) {
        // Se nenhuma parcela detalhada informada, cria parcela única padrão
        const vencPadrao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .substring(0, 10)
        parcelasParaCriar = [
          {
            numero: 1,
            descricao: 'Subcontratação ' + numeroSub + ' — Parcela Única',
            valor: precoContratado,
            vencimento: vencPadrao,
          },
        ]
      }

      for (let pIdx = 0; pIdx < parcelasParaCriar.length; pIdx++) {
        const p = parcelasParaCriar[pIdx]
        const valorParc = Number(p.valor) || 0
        if (valorParc <= 0) continue

        const desc =
          p.descricao ||
          'Subcontratação ' +
            numeroSub +
            ' (' +
            projeto.getString('codigo') +
            ') — Parcela ' +
            (pIdx + 1) +
            '/' +
            parcelasParaCriar.length

        const venc = p.vencimento
          ? `${p.vencimento.substring(0, 10)} 12:00:00.000Z`
          : new Date(Date.now() + (pIdx + 1) * 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .substring(0, 10) + ' 12:00:00.000Z'

        try {
          const novaConta = new Record(contasCol)
          novaConta.set('tipo', 'pagar')
          novaConta.set('projeto', projetoId)
          novaConta.set('executor', executorId)
          novaConta.set('subcontrato', novoSub.id)
          novaConta.set('descricao', desc)
          novaConta.set('valor', valorParc)
          novaConta.set('valor_liquido', valorParc)
          novaConta.set('retencao_impostos', 0)
          novaConta.set('vencimento', venc)
          novaConta.set('status', 'rascunho')
          novaConta.set('forma_pagamento', 'Transferência Bancária (PIX)')
          novaConta.set('bloqueada_por_fechamento', false)
          $app.save(novaConta)
        } catch (cErr) {
          console.log('ERRO ao criar conta a pagar do subcontrato ' + numeroSub + ': ' + cErr)
          throw cErr
        }
      }

      // 7. Auditoria Completa da Contratação
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', reqInfo.auth.getString('email'))
        aRec.set('acao', 'CONTRATACAO_EXECUTOR_SUBCONTRATO')
        aRec.set('entidade', 'subcontratos')
        aRec.set('registro_id', novoSub.id)
        aRec.set('detalhes', {
          mensagem:
            'Executor ' +
            executor.getString('nome') +
            ' contratado para o projeto ' +
            projeto.getString('codigo') +
            ' (' +
            modoExecucao +
            '). Subcontrato ' +
            numeroSub +
            ' emitido.',
          numero_subcontrato: numeroSub,
          subcontrato_id: novoSub.id,
          projeto_id: projetoId,
          projeto_codigo: projeto.getString('codigo'),
          cotacao_id: cotacaoId,
          executor_id: executorId,
          executor_nome: executor.getString('nome'),
          modo_execucao: modoExecucao,
          descricao_delegada: descricaoDelegada,
          valor_total: precoContratado,
          prazo_dias: prazoDiasContratoOriginal,
        })
        aRec.set(
          'ip',
          (reqInfo.headers &&
            (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
            '127.0.0.1',
        )
        $app.save(aRec)
      } catch (_) {}

      // 8. Envio de e-mail ao executor informando da contratação
      const appUrl =
        $os.getenv('SITE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        ($app.settings().meta && $app.settings().meta.appUrl) ||
        'https://gestao-de-projetos-de-engenharia-be59d.shrd00.internal.goskip.dev'
      const linkSubcontrato = appUrl + '/subcontrato/' + tokenAssinatura
      const execEmail = executor.getString('email')

      if (execEmail && execEmail.includes('@')) {
        try {
          const senderAddress =
            ($app.settings().meta && $app.settings().meta.senderAddress) || 'nao-responder@skip.dev'
          const senderName =
            ($app.settings().meta && $app.settings().meta.senderName) || 'G+ Engenharia Consultiva'

          const htmlEmail =
            '<!DOCTYPE html><html><body style="font-family: sans-serif; background: #f8fafc; padding: 20px; color: #1e293b;">' +
            '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">' +
            '<div style="background: #1E2A4A; padding: 20px; border-bottom: 3px solid #D95A2B; color: #fff;">' +
            '<span style="font-size: 18px; font-weight: bold;">G+ ENGENHARIA</span><br/>' +
            '<span style="font-size: 11px; color: #cbd5e1;">Contratação Técnica & Termo de Subcontratação</span>' +
            '</div>' +
            '<div style="padding: 24px; font-size: 14px; line-height: 1.6;">' +
            '<p>Prezado(a) <strong>' +
            executor.getString('nome') +
            '</strong>,</p>' +
            '<p>Temos a satisfação de informar que sua proposta comercial foi a <strong>selecionada</strong> para o projeto <strong>' +
            projeto.getString('codigo') +
            ' (' +
            projeto.getString('nome') +
            ')</strong>.</p>' +
            '<p>O <strong>Termo de Subcontratação ' +
            numeroSub +
            '</strong> foi emitido e está pronto para sua assinatura eletrônica segura.</p>' +
            '<p style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">' +
            '<strong>Modalidade:</strong> ' +
            (modoExecucao === 'terceirizada_integral'
              ? 'Terceirização Integral (100%)'
              : 'Terceirização Parcial') +
            '<br/>' +
            '<strong>Valor Global:</strong> ' +
            precoFmt +
            '<br/>' +
            '<strong>Duração:</strong> ' +
            prazoDiasContratoOriginal +
            ' dias (conforme Contrato Original)' +
            '</p>' +
            '<div style="text-align: center; margin: 28px 0;">' +
            '<a href="' +
            linkSubcontrato +
            '" style="background: #D95A2B; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">Revisar e Assinar Termo de Subcontratação</a>' +
            '</div>' +
            '</div>' +
            '<div style="padding: 14px; background: #f1f5f9; font-size: 11px; text-align: center; color: #64748b;">' +
            'G+ Engenharia Consultiva • Gestão Integrada de Subcontratos' +
            '</div>' +
            '</div></body></html>'

          const msg = new MailerMessage({
            from: { address: senderAddress, name: senderName },
            to: [{ address: execEmail, name: executor.getString('nome') }],
            subject: 'Parabéns! Contratação Aprovada — Termo ' + numeroSub + ' — G+ Engenharia',
            html: htmlEmail,
          })
          $app.newMailClient().send(msg)
        } catch (eMail) {
          console.log('Aviso ao enviar e-mail de contratação: ' + eMail)
        }
      }

      return e.json(200, {
        success: true,
        message: 'Executor contratado com sucesso! Termo de subcontratação gerado.',
        subcontrato_id: novoSub.id,
        numero: numeroSub,
        token_assinatura: tokenAssinatura,
        link_assinatura: linkSubcontrato,
      })
    } catch (err) {
      console.log('Erro interno em contratar-executor: ' + err)
      return e.json(500, { message: 'Erro interno ao contratar executor: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 4. Endpoint Público: Assinatura Eletrônica do Termo de Subcontratação pelo Executor (sem login, via Token)
routerAdd('POST', '/backend/v1/subcontratos/assinar-executor', (e) => {
  try {
    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = body.token_assinatura
    const declaracao = body.declaracao === true
    const nomeAssinante = (body.nome_assinante || '').trim()
    const documentoAssinante = (body.documento_assinante || '').trim()

    if (!token) {
      return e.json(400, { message: 'Token de assinatura não informado' })
    }
    if (!declaracao) {
      return e.json(400, {
        message: 'Declaração de concordância com o termo e as cláusulas é obrigatória.',
      })
    }
    if (!nomeAssinante || !documentoAssinante) {
      return e.json(400, {
        message: 'Nome completo e CPF/CNPJ do responsável são obrigatórios para a assinatura.',
      })
    }

    const records = $app.findRecordsByFilter(
      'subcontratos',
      "token_assinatura = '" + token + "'",
      '-created',
      1,
      0,
    )
    if (records.length === 0) {
      return e.json(404, { message: 'Termo de subcontratação não localizado ou link inválido' })
    }

    const sub = records[0]

    if (sub.getString('status') === 'assinado') {
      return e.json(200, {
        success: true,
        message: 'Este Termo de Subcontratação já foi assinado.',
        subcontrato_id: sub.id,
      })
    }

    const clientIp =
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'
    const clientUserAgent = (reqInfo.headers && reqInfo.headers['user-agent']) || 'Navegador Web'
    const nowIso = new Date().toISOString()

    const hashPayload =
      sub.getString('numero') +
      '|' +
      nomeAssinante +
      '|' +
      documentoAssinante +
      '|' +
      clientIp +
      '|' +
      nowIso
    const executorHash = $security.sha256(hashPayload)

    sub.set('executor_nome_assinante', nomeAssinante)
    sub.set('executor_documento_assinante', documentoAssinante)
    sub.set('data_assinatura_executor', nowIso)
    sub.set('executor_ip', clientIp)
    sub.set('executor_user_agent', clientUserAgent)
    sub.set('executor_declaracao', true)
    sub.set('executor_hash', executorHash)
    sub.set('status', 'assinado')

    $app.save(sub)

    // Auditoria da assinatura do executor
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'ASSINATURA_EXECUTOR_SUBCONTRATO')
      aRec.set('entidade', 'subcontratos')
      aRec.set('registro_id', sub.id)
      aRec.set('detalhes', {
        mensagem:
          'Termo de Subcontratação ' +
          sub.getString('numero') +
          ' assinado eletronicamente pelo executor ' +
          nomeAssinante,
        subcontrato_numero: sub.getString('numero'),
        nome_assinante: nomeAssinante,
        documento_assinante: documentoAssinante,
        ip: clientIp,
        hash: executorHash,
      })
      aRec.set('ip', clientIp)
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: 'Termo de Subcontratação assinado com sucesso!',
      subcontrato_id: sub.id,
      numero: sub.getString('numero'),
      hash: executorHash,
    })
  } catch (err) {
    console.log('Erro interno em assinar-executor: ' + err)
    return e.json(500, { message: 'Erro interno ao assinar subcontrato: ' + err })
  }
})

// 5. Endpoint Público: Obter detalhes do Subcontrato por token para visualização na tela pública
routerAdd('GET', '/backend/v1/subcontratos/obter-por-token/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { message: 'Token não informado' })
    }

    const records = $app.findRecordsByFilter(
      'subcontratos',
      "token_assinatura = '" + token + "'",
      '-created',
      1,
      0,
    )
    if (records.length === 0) {
      return e.json(404, { message: 'Termo de subcontratação não encontrado ou link expirado' })
    }

    const sub = records[0]
    let executorData = null
    let projetoData = null
    let contratoOriginalData = null

    try {
      const exec = $app.findRecordById('executores', sub.getString('executor'))
      if (exec) {
        executorData = {
          id: exec.id,
          nome: exec.getString('nome'),
          cpf_cnpj: exec.getString('cpf_cnpj'),
          conselho: exec.getString('conselho'),
          numero_registro: exec.getString('numero_registro'),
          email: exec.getString('email'),
          telefone: exec.getString('telefone'),
        }
      }
    } catch (_) {}

    let grupoData = null

    try {
      const prj = $app.findRecordById('projetos', sub.getString('projeto'))
      if (prj) {
        projetoData = {
          id: prj.id,
          codigo: prj.getString('codigo'),
          nome: prj.getString('nome'),
          descricao: prj.getString('descricao'),
          disciplinas: prj.getString('disciplinas'),
          grupo: prj.getString('grupo'),
        }

        const grupoId = sub.getString('grupo') || prj.getString('grupo')
        if (grupoId) {
          try {
            const grp = $app.findRecordById('grupos_projetos', grupoId)
            if (grp) {
              grupoData = {
                id: grp.id,
                codigo: grp.getString('codigo'),
                nome: grp.getString('nome'),
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    try {
      let csId = sub.getString('contrato_servico_origem')
      if (!csId && sub.getString('projeto')) {
        // Tentar localizar contrato de serviço associado ao projeto se não preenchido direto
        try {
          const csRecords = $app.findRecordsByFilter(
            'contratos_servico',
            "projeto = '" + sub.getString('projeto') + "'",
            '-created',
            1,
            0,
          )
          if (csRecords.length > 0) {
            csId = csRecords[0].id
          }
        } catch (_) {}
      }
      if (csId) {
        const cs = $app.findRecordById('contratos_servico', csId)
        if (cs) {
          contratoOriginalData = {
            id: cs.id,
            numero: cs.getString('numero'),
            objeto: cs.getString('objeto'),
            prazo_dias: cs.getInt('prazo_dias'),
            nota_prazo: cs.getString('nota_prazo'),
          }
        }
      }
    } catch (_) {}

    return e.json(200, {
      id: sub.id,
      numero: sub.getString('numero'),
      status: sub.getString('status'),
      modo_execucao: sub.getString('modo_execucao'),
      descricao_escopo: sub.getString('descricao_escopo'),
      descricao_delegada: sub.getString('descricao_delegada'),
      valor_total: sub.getFloat('valor_total'),
      prazo_dias: sub.getInt('prazo_dias'),
      nota_prazo: sub.getString('nota_prazo'),
      clausulas_texto: sub.getString('clausulas_texto'),
      condicoes_pagamento: sub.getString('condicoes_pagamento'),
      parcelas_json: sub.get('parcelas_json'),
      data_emissao: sub.getString('data_emissao') || sub.getString('created'),
      percentual_retencao_tecnica: sub.getFloat('percentual_retencao_tecnica') || 0,
      retencao_tecnica_acumulada: sub.getFloat('retencao_tecnica_acumulada') || 0,
      retencao_tecnica_liberada: sub.getFloat('retencao_tecnica_liberada') || 0,
      status_retencao: sub.getString('status_retencao') || 'sem_retencao',
      checklist_encerramento_json: sub.get('checklist_encerramento_json') || [],
      // Dados de assinatura caso já assinado
      executor_nome_assinante: sub.getString('executor_nome_assinante'),
      executor_documento_assinante: sub.getString('executor_documento_assinante'),
      data_assinatura_executor: sub.getString('data_assinatura_executor'),
      executor_hash: sub.getString('executor_hash'),
      executor: executorData,
      projeto: projetoData,
      grupo: grupoData,
      contrato_original: contratoOriginalData,
    })
  } catch (err) {
    console.log('Erro ao obter subcontrato por token: ' + err)
    return e.json(500, { message: 'Erro interno ao buscar subcontrato: ' + err })
  }
})

// 6. Endpoint Autenticado para o Portal do Executor: Responder Cotação logado
routerAdd(
  'POST',
  '/backend/v1/portal-executor/responder-cotacao',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')

      const body = reqInfo.body || {}
      const cotacaoId = body.cotacao_id
      const precoOfertado = parseFloat(body.preco_ofertado)
      const prazoOfertado = (body.prazo_ofertado || '').trim()
      const observacoes = (body.observacoes || '').trim()

      if (!cotacaoId) {
        return e.json(400, { message: 'ID da cotação não informado' })
      }
      if (isNaN(precoOfertado) || precoOfertado <= 0) {
        return e.json(400, { message: 'Preço ofertado deve ser maior que zero' })
      }
      if (!prazoOfertado) {
        return e.json(400, { message: 'Prazo ofertado é obrigatório' })
      }

      const cotacao = $app.findRecordById('cotacoes', cotacaoId)
      if (!cotacao) {
        return e.json(404, { message: 'Cotação não encontrada' })
      }

      // Se for perfil executor, verificar se a cotação pertence a ele
      if (role === 'executor') {
        const executorId = cotacao.getString('executor')
        const execRec = $app.findRecordById('executores', executorId)
        if (!execRec || execRec.getString('email') !== userEmail) {
          return e.json(403, {
            message: 'Você não tem permissão para responder esta cotação.',
          })
        }
      } else if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message: 'Perfil sem permissão para responder cotações.',
        })
      }

      if (cotacao.getString('status') === 'escolhida' || cotacao.getBool('escolhida')) {
        return e.json(400, {
          message: 'Esta cotação já foi escolhida e não pode ser alterada.',
        })
      }

      cotacao.set('preco_ofertado', precoOfertado)
      cotacao.set('prazo_ofertado', prazoOfertado)
      cotacao.set('observacoes', observacoes)
      cotacao.set('status', 'respondida')
      cotacao.set('data_resposta', new Date().toISOString())
      $app.save(cotacao)

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', reqInfo.auth.id)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'RESPOSTA_COTACAO_PORTAL')
        aRec.set('entidade', 'cotacoes')
        aRec.set('registro_id', cotacaoId)
        aRec.set('detalhes', {
          mensagem: 'Cotação respondida pelo executor no Portal do Executor',
          preco_ofertado: precoOfertado,
          prazo_ofertado: prazoOfertado,
          observacoes: observacoes,
        })
        aRec.set(
          'ip',
          (reqInfo.headers &&
            (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
            '127.0.0.1',
        )
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Cotação respondida com sucesso!',
        cotacao_id: cotacaoId,
      })
    } catch (err) {
      console.log('Erro em responder-cotacao portal: ' + err)
      return e.json(500, { message: 'Erro interno ao responder cotação: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 7. Atualizar Item do Checklist de Encerramento (Admin ou Gestor)
// Cada marcação de item é auditada com quem, quando e qual item
routerAdd(
  'POST',
  '/backend/v1/subcontratos/{id}/checklist',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')
      const userId = reqInfo.auth.id

      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message:
            'Apenas Administradores ou Gestores de Projetos podem atualizar o checklist de encerramento.',
        })
      }

      const subId = e.request.pathValue('id')
      if (!subId) {
        return e.json(400, { message: 'ID do subcontrato não informado.' })
      }

      let sub
      try {
        sub = $app.findRecordById('subcontratos', subId)
      } catch (_) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }

      const body = reqInfo.body || {}
      const itemId = (body.item_id || '').trim()
      const concluido = body.concluido === true

      if (!itemId) {
        return e.json(400, { message: 'ID do item do checklist não informado.' })
      }

      const checklistAtual = sub.get('checklist_encerramento_json') || []
      const itensValidos = [
        {
          id: 'art_rrt',
          titulo: 'ART / RRT recolhida e averbada',
          descricao: 'Anotação ou Registro de Responsabilidade Técnica comprovado pelo executor.',
        },
        {
          id: 'laudos',
          titulo: 'Laudos e entregáveis técnicos entregues e aprovados',
          descricao:
            'Todos os documentos, memórias de cálculo ou relatórios técnicos foram conferidos.',
        },
        {
          id: 'medicao_final',
          titulo: 'Medição final conferida e fechada',
          descricao: 'Escopo 100% medido e aprovado sem novas medições pendentes.',
        },
        {
          id: 'avaliacao_registrada',
          titulo: 'Avaliação do executor registrada no sistema',
          descricao:
            'Avaliação de prazo, qualidade e comunicação concluída na ficha de avaliações.',
        },
      ]

      // Mesclar checklist existente com itens padrão se estiver vazio
      let lista = Array.isArray(checklistAtual) && checklistAtual.length > 0 ? checklistAtual : []
      if (lista.length === 0) {
        lista = itensValidos.map((it) => ({
          id: it.id,
          titulo: it.titulo,
          descricao: it.descricao,
          concluido: false,
          concluido_por: '',
          data_conclusao: '',
        }))
      }

      let itemEncontrado = false
      const nowIso = new Date().toISOString()
      let itemTitulo = itemId

      for (let i = 0; i < lista.length; i++) {
        if (lista[i].id === itemId) {
          itemEncontrado = true
          itemTitulo = lista[i].titulo || itemId
          lista[i].concluido = concluido
          lista[i].concluido_por = concluido ? userEmail : ''
          lista[i].data_conclusao = concluido ? nowIso : ''
          break
        }
      }

      if (!itemEncontrado) {
        // Se item não existia na lista, adicionar
        const padrao = itensValidos.find((it) => it.id === itemId)
        lista.push({
          id: itemId,
          titulo: padrao ? padrao.titulo : itemId,
          descricao: padrao ? padrao.descricao : '',
          concluido: concluido,
          concluido_por: concluido ? userEmail : '',
          data_conclusao: concluido ? nowIso : '',
        })
        itemTitulo = padrao ? padrao.titulo : itemId
      }

      sub.set('checklist_encerramento_json', lista)
      $app.save(sub)

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria do item de checklist
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', concluido ? 'CHECKLIST_ITEM_CONCLUIDO' : 'CHECKLIST_ITEM_REABERTO')
        aRec.set('entidade', 'subcontratos')
        aRec.set('registro_id', subId)
        aRec.set('detalhes', {
          mensagem:
            'Item do checklist "' +
            itemTitulo +
            '" ' +
            (concluido ? 'concluído' : 'desmarcado') +
            ' por ' +
            userEmail,
          subcontrato_id: subId,
          subcontrato_numero: sub.getString('numero'),
          item_id: itemId,
          item_titulo: itemTitulo,
          concluido: concluido,
          usuario: userEmail,
          data: nowIso,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message:
          'Item "' + itemTitulo + '" ' + (concluido ? 'marcado como concluído.' : 'desmarcado.'),
        checklist: lista,
      })
    } catch (err) {
      console.log('Erro ao atualizar checklist do subcontrato: ' + err)
      return e.json(500, { message: 'Erro interno ao atualizar checklist: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 8. Transição de Status do Ciclo de Vida do Subcontrato
// Ciclo: assinado -> em_execucao -> concluido -> avaliado -> encerrado
// Validado com bloqueios no servidor e auditoria rigorosa
routerAdd(
  'POST',
  '/backend/v1/subcontratos/{id}/transicao-status',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')
      const userId = reqInfo.auth.id

      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, {
          message:
            'Apenas Administradores ou Gestores de Projetos podem alterar o status do ciclo de vida de subcontratos.',
        })
      }

      const subId = e.request.pathValue('id')
      if (!subId) {
        return e.json(400, { message: 'ID do subcontrato não informado.' })
      }

      let sub
      try {
        sub = $app.findRecordById('subcontratos', subId)
      } catch (_) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }

      const body = reqInfo.body || {}
      const novoStatus = (body.status || '').trim()
      const statusAtual = sub.getString('status')
      const subNumero = sub.getString('numero')

      const statusValidos = [
        'minuta',
        'aguardando_assinatura',
        'assinado',
        'em_execucao',
        'concluido',
        'avaliado',
        'encerrado',
        'cancelado',
      ]

      if (!statusValidos.includes(novoStatus)) {
        return e.json(400, {
          message: 'Status "' + novoStatus + '" inválido.',
        })
      }

      if (statusAtual === novoStatus) {
        return e.json(200, {
          success: true,
          message: 'Subcontrato já se encontra no status ' + novoStatus + '.',
          status: novoStatus,
        })
      }

      // Regras de Transição de Ciclo de Vida:
      // A) assinado -> em_execucao: manual ou via medição aprovada
      if (novoStatus === 'em_execucao') {
        if (statusAtual !== 'assinado') {
          return e.json(400, {
            message:
              'Apenas subcontratos no status "assinado" podem entrar "em_execucao". Status atual: ' +
              statusAtual +
              '.',
          })
        }
      }

      // B) em_execucao -> concluido: escopo do subcontrato foi concluído
      if (novoStatus === 'concluido') {
        if (statusAtual !== 'em_execucao' && statusAtual !== 'assinado') {
          return e.json(400, {
            message:
              'Apenas subcontratos "assinado" ou "em_execucao" podem ser marcados como "concluido".',
          })
        }
      }

      // C) concluido -> avaliado: exige avaliação do executor registrada no sistema novo (avaliacoes_executor)
      if (novoStatus === 'avaliado') {
        if (statusAtual !== 'concluido' && statusAtual !== 'em_execucao') {
          return e.json(400, {
            message:
              'Subcontrato precisa estar "concluido" ou "em_execucao" antes de ser marcado como "avaliado".',
          })
        }

        const avals = $app.findRecordsByFilter(
          'avaliacoes_executor',
          "subcontrato = '" + subId + "'",
          '-created',
          1,
          0,
        )
        if (!avals || avals.length === 0) {
          return e.json(400, {
            message:
              'BLOQUEIO: Para transicionar para "avaliado", é OBRIGATÓRIO que a avaliação do executor esteja registrada na coleção de avaliações de execução.',
          })
        }
      }

      // D) avaliado -> encerrado: BLOQUEADO enquanto houver pendência no checklist ou conta em aberto
      if (novoStatus === 'encerrado') {
        if (statusAtual !== 'avaliado' && statusAtual !== 'concluido') {
          return e.json(400, {
            message:
              'O subcontrato precisa estar no status "avaliado" antes de ser encerrado definitivamente. Status atual: ' +
              statusAtual +
              '.',
          })
        }

        // 1. Validar avaliação registrada
        const avals = $app.findRecordsByFilter(
          'avaliacoes_executor',
          "subcontrato = '" + subId + "'",
          '-created',
          1,
          0,
        )
        if (!avals || avals.length === 0) {
          return e.json(400, {
            message:
              'BLOQUEIO DE ENCERRAMENTO: Nenhuma avaliação do executor foi encontrada para este subcontrato. O executor deve ser avaliado antes do encerramento.',
          })
        }

        // 2. Validar checklist de encerramento: TODOS os itens devem estar concluídos
        const checklistAtual = sub.get('checklist_encerramento_json') || []
        const listaChecklist =
          Array.isArray(checklistAtual) && checklistAtual.length > 0 ? checklistAtual : []
        if (listaChecklist.length === 0) {
          return e.json(400, {
            message:
              'BLOQUEIO DE ENCERRAMENTO: O checklist de encerramento não foi inicializado/preenchido. Todos os 4 itens obrigatórios (ART/RRT, laudos, medição final, avaliação) devem estar conferidos.',
          })
        }

        const pendentes = []
        for (let k = 0; k < listaChecklist.length; k++) {
          const item = listaChecklist[k]
          if (!item.concluido) {
            pendentes.push(item.titulo || item.id)
          }
        }
        if (pendentes.length > 0) {
          return e.json(400, {
            message:
              'BLOQUEIO DE ENCERRAMENTO: Existem itens pendentes no checklist de encerramento auditado: ' +
              pendentes.join('; ') +
              '. Todos os itens devem ser concluídos antes do encerramento.',
          })
        }

        // 3. Validar contas do subcontrato em aberto: NENHUMA conta do subcontrato pode estar pendente/rascunho/vencida
        const contasAbertas = $app.findRecordsByFilter(
          'contas',
          "subcontrato = '" + subId + "' && status != 'paga' && status != 'cancelada'",
          '-created',
          10,
          0,
        )
        if (contasAbertas && contasAbertas.length > 0) {
          const descs = contasAbertas.map(
            (c) => c.getString('descricao') + ' (status: ' + c.getString('status') + ')',
          )
          return e.json(400, {
            message:
              'BLOQUEIO DE ENCERRAMENTO: Existem contas do subcontrato em aberto no Financeiro que ainda não foram pagas ou canceladas: ' +
              descs.join(' | ') +
              '. NADA é encerrado com pendência financeira.',
          })
        }
      }

      // Se passou por todas as regras, atualizar status
      sub.set('status', novoStatus)
      $app.save(sub)

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria da transição de status
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'SUBCONTRATO_TRANSICAO_CICLO')
        aRec.set('entidade', 'subcontratos')
        aRec.set('registro_id', subId)
        aRec.set('detalhes', {
          mensagem:
            'Transição de status do subcontrato ' +
            subNumero +
            ': ' +
            statusAtual +
            ' ➔ ' +
            novoStatus +
            ' realizada por ' +
            userEmail,
          subcontrato_id: subId,
          subcontrato_numero: subNumero,
          status_anterior: statusAtual,
          novo_status: novoStatus,
          role: role,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message:
          'Status do subcontrato ' +
          subNumero +
          ' atualizado para "' +
          novoStatus +
          '" com sucesso.',
        status: novoStatus,
        status_anterior: statusAtual,
      })
    } catch (err) {
      console.log('Erro na transição de status do subcontrato: ' + err)
      return e.json(500, { message: 'Erro interno ao transicionar status: ' + err })
    }
  },
  $apis.requireAuth(),
)

// 10. Bloqueio no servidor para edição direta do subcontrato (Guardião de Integridade)
// Garante que ninguém force encerramento ou liberação burlando as regras de negócio
onRecordUpdateRequest((e) => {
  try {
    const auth = e.auth
    const role = auth ? auth.getString('role') : ''
    const original = e.record.original()
    const oldStatus = original ? original.getString('status') : ''
    const newStatus = e.record.getString('status')

    if (oldStatus !== newStatus && newStatus === 'encerrado') {
      // Validar que possui avaliação
      const subId = e.record.id
      const avals = $app.findRecordsByFilter(
        'avaliacoes_executor',
        "subcontrato = '" + subId + "'",
        '-created',
        1,
        0,
      )
      if (!avals || avals.length === 0) {
        throw new BadRequestError(
          'BLOQUEIO NO SERVIDOR: Não é permitido encerrar o subcontrato sem avaliação do executor registrada.',
        )
      }

      // Validar itens do checklist
      const chk = e.record.get('checklist_encerramento_json') || []
      const lista = Array.isArray(chk) ? chk : []
      if (lista.length === 0) {
        throw new BadRequestError(
          'BLOQUEIO NO SERVIDOR: O checklist de encerramento não está completo.',
        )
      }
      for (let i = 0; i < lista.length; i++) {
        if (!lista[i].concluido) {
          throw new BadRequestError(
            'BLOQUEIO NO SERVIDOR: O item "' +
              (lista[i].titulo || lista[i].id) +
              '" do checklist de encerramento ainda está pendente.',
          )
        }
      }

      // Validar contas abertas
      const contasAbertas = $app.findRecordsByFilter(
        'contas',
        "subcontrato = '" + subId + "' && status != 'paga' && status != 'cancelada'",
        '-created',
        1,
        0,
      )
      if (contasAbertas && contasAbertas.length > 0) {
        throw new BadRequestError(
          'BLOQUEIO NO SERVIDOR: Existem contas financeiras vinculadas a este subcontrato ainda pendentes de quitação.',
        )
      }
    }
  } catch (err) {
    throw err
  }
  e.next()
}, 'subcontratos')

// 9. Liberação de Retenção Técnica (Admin ou Financeiro ou Gestor)
// Requisitos:
// - Medições correspondentes devem estar com aceita_pelo_cliente = true
// - Valor a liberar não pode exceder o saldo retido disponível (acumulado - liberado)
// - Gera automaticamente conta a pagar do tipo 'pagar' integrada ao financeiro
// - Atualiza retencao_tecnica_liberada e status_retencao no subcontrato
// - Registra auditoria completa
routerAdd(
  'POST',
  '/backend/v1/subcontratos/{id}/liberar-retencao',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      const userEmail = reqInfo.auth.getString('email')
      const userId = reqInfo.auth.id

      if (role !== 'admin' && role !== 'financeiro' && role !== 'gestor') {
        return e.json(403, {
          message:
            'Apenas Financeiro, Administradores ou Gestores de Projetos podem liberar a retenção técnica.',
        })
      }

      const subId = e.request.pathValue('id')
      if (!subId) {
        return e.json(400, { message: 'ID do subcontrato não informado.' })
      }

      let sub
      try {
        sub = $app.findRecordById('subcontratos', subId)
      } catch (_) {
        return e.json(404, { message: 'Subcontrato não encontrado.' })
      }

      const body = reqInfo.body || {}
      const valorLiberar = parseFloat(body.valor_liberar)
      const justificativa = (body.justificativa || '').trim()

      const retAcumulada = sub.getFloat('retencao_tecnica_acumulada') || 0
      const retLiberada = sub.getFloat('retencao_tecnica_liberada') || 0
      const saldoDisponivel = Math.round((retAcumulada - retLiberada) * 100) / 100

      if (saldoDisponivel <= 0) {
        return e.json(400, {
          message:
            'Não há saldo de retenção técnica retido para este subcontrato (Saldo retido: R$ 0,00).',
        })
      }

      if (isNaN(valorLiberar) || valorLiberar <= 0) {
        return e.json(400, {
          message: 'Informe um valor válido maior que zero para a liberação da retenção.',
        })
      }

      if (valorLiberar > saldoDisponivel + 0.01) {
        return e.json(400, {
          message:
            'BLOQUEIO: O valor solicitado para liberação (R$ ' +
            valorLiberar.toFixed(2) +
            ') excede o saldo de retenção disponível (R$ ' +
            saldoDisponivel.toFixed(2) +
            ').',
        })
      }

      // Regra fundamental: medições com retenção deste subcontrato devem estar ACEITAS pelo cliente
      const medicoesComRetencao = $app.findRecordsByFilter(
        'medicoes',
        "subcontrato = '" + subId + "' && valor_retencao_tecnica > 0",
        '-numero_medicao',
        200,
        0,
      )

      let totalAceito = 0
      const naoAceitas = []
      for (let m = 0; m < medicoesComRetencao.length; m++) {
        const med = medicoesComRetencao[m]
        if (med.getBool('aceita_pelo_cliente')) {
          totalAceito += med.getFloat('valor_retencao_tecnica') || 0
        } else {
          naoAceitas.push(med.getString('numero'))
        }
      }

      // O teto que pode ser liberado até o momento é o valor das medições aceitas pelo cliente
      const tetoLiberavelPorAceitacao = Math.round(totalAceito * 100) / 100
      const maximoLiberavelHoje = Math.round((tetoLiberavelPorAceitacao - retLiberada) * 100) / 100

      if (valorLiberar > maximoLiberavelHoje + 0.01) {
        return e.json(400, {
          message:
            'BLOQUEIO DE ACEITAÇÃO: A liberação de retenção técnica exige a aceitação formal da etapa/entrega pelo cliente. ' +
            (naoAceitas.length > 0
              ? 'As medições [' +
                naoAceitas.join(', ') +
                '] ainda não possuem aceitação registrada pelo cliente. '
              : '') +
            'Valor máximo liberável com base nas entregas aceitas: R$ ' +
            (maximoLiberavelHoje > 0 ? maximoLiberavelHoje.toFixed(2) : '0,00') +
            '.',
        })
      }

      // Criar CONTA A PAGAR correspondente ao valor liberado
      const subNumero = sub.getString('numero')
      const projetoId = sub.getString('projeto')
      const executorId = sub.getString('executor')

      let prjCodigo = ''
      try {
        const prjRec = $app.findRecordById('projetos', projetoId)
        if (prjRec) prjCodigo = prjRec.getString('codigo')
      } catch (_) {}

      let execNome = ''
      try {
        const exRec = $app.findRecordById('executores', executorId)
        if (exRec) execNome = exRec.getString('nome')
      } catch (_) {}

      const contasCol = $app.findCollectionByNameOrId('contas')
      const novaConta = new Record(contasCol)
      novaConta.set('tipo', 'pagar')
      novaConta.set('status', 'rascunho')
      novaConta.set(
        'descricao',
        'Liberação de Retenção Técnica — Subcontrato ' +
          subNumero +
          (prjCodigo ? ' • ' + prjCodigo : '') +
          (execNome ? ' • ' + execNome : '') +
          (justificativa ? ' — ' + justificativa : ''),
      )
      novaConta.set('valor', valorLiberar)
      novaConta.set('retencao_impostos', 0)
      novaConta.set('valor_liquido', valorLiberar)
      novaConta.set('subcontrato', subId)
      novaConta.set('projeto', projetoId)
      novaConta.set('executor', executorId)
      novaConta.set(
        'forma_pagamento',
        'Transferência Bancária / PIX (Liberação de Retenção Técnica)',
      )
      novaConta.set('bloqueada_por_fechamento', false)

      // Vencimento em D+10 dias
      const dataVenc = new Date()
      dataVenc.setDate(dataVenc.getDate() + 10)
      novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

      $app.save(novaConta)

      // Atualizar o subcontrato com o novo acumulado liberado e status
      const novoTotalLiberado = Math.round((retLiberada + valorLiberar) * 100) / 100
      sub.set('retencao_tecnica_liberada', novoTotalLiberado)

      let novoStatusRetencao = 'parcialmente_liberada'
      if (novoTotalLiberado >= retAcumulada - 0.01) {
        novoStatusRetencao = 'totalmente_liberada'
      }
      sub.set('status_retencao', novoStatusRetencao)
      $app.save(sub)

      const clientIp =
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      // Auditoria completa da liberação de retenção
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', userId)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'RETENCAO_TECNICA_LIBERADA')
        aRec.set('entidade', 'subcontratos')
        aRec.set('registro_id', subId)
        aRec.set('detalhes', {
          mensagem:
            'Liberação de retenção técnica de R$ ' +
            valorLiberar.toFixed(2) +
            ' aprovada por ' +
            userEmail +
            '. Conta a pagar gerada no Financeiro.',
          subcontrato_id: subId,
          subcontrato_numero: subNumero,
          valor_liberado: valorLiberar,
          novo_total_liberado: novoTotalLiberado,
          retencao_acumulada: retAcumulada,
          saldo_remanescente: Math.round((retAcumulada - novoTotalLiberado) * 100) / 100,
          status_retencao: novoStatusRetencao,
          conta_pagar_id: novaConta.id,
          justificativa: justificativa,
        })
        aRec.set('ip', clientIp)
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message:
          'Retenção técnica de R$ ' +
          valorLiberar.toFixed(2) +
          ' liberada com sucesso! Conta a pagar gerada no Financeiro.',
        subcontrato_id: subId,
        valor_liberado: valorLiberar,
        total_liberado: novoTotalLiberado,
        saldo_remanescente: Math.round((retAcumulada - novoTotalLiberado) * 100) / 100,
        status_retencao: novoStatusRetencao,
        conta_pagar_id: novaConta.id,
      })
    } catch (err) {
      console.log('Erro ao liberar retenção técnica: ' + err)
      return e.json(500, { message: 'Erro interno ao liberar retenção: ' + err })
    }
  },
  $apis.requireAuth(),
)
