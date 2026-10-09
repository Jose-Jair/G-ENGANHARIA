// Hook de regras de negócio da ETAPA 8:
// 1. Bloqueio no servidor para alocação de executor em etapas:
//    - Executor suspenso não pode ser alocado
//    - Executor com registro profissional vencido (conselho_validade no passado) não pode ser alocado
//    - Executor acima da capacidade simultânea não pode ser alocado (contando etapas ativas)
// 2. Cálculo e atualização automática da Nota Geral ponderada do Executor ao criar ou atualizar avaliação
// 3. Escolha de cotação: ao marcar escolhida=true, desmarcar demais da mesma etapa e vincular automaticamente à etapa
// 4. Geração automática de token para cotação na criação

// Geração de token único para nova cotação
onRecordCreate((e) => {
  const rec = e.record
  if (rec.collection().name === 'cotacoes') {
    if (!rec.getString('token')) {
      rec.set('token', $security.randomString(32))
    }
    if (!rec.getString('status')) {
      rec.set('status', 'convite_enviado')
    }

    // Se a cotação tiver projeto e não tiver grupo, tentar preencher grupo automaticamente
    const prjId = rec.getString('projeto')
    if (prjId && !rec.getString('grupo')) {
      try {
        const prj = $app.findRecordById('projetos', prjId)
        if (prj && prj.getString('grupo')) {
          rec.set('grupo', prj.getString('grupo'))
        }
      } catch (_) {}
    }
  }

  // Numeração automática sequencial sem lacunas para subcontratos (SUB-AAAA-NNNN)
  if (rec.collection().name === 'subcontratos') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'SUB-' + anoAtual + '-'

    let numeroExistente = rec.getString('numero')
    if (!numeroExistente || !numeroExistente.startsWith(prefixo)) {
      try {
        const subDoAno = $app.findRecordsByFilter(
          'subcontratos',
          "numero ~ '" + prefixo + "'",
          '-numero',
          1,
          0,
        )

        let proximoSeq = 1
        if (subDoAno.length > 0) {
          const ultimoNumero = subDoAno[0].getString('numero')
          const partes = ultimoNumero.split('-')
          const ultimoSeq = parseInt(partes[2], 10)
          if (!isNaN(ultimoSeq)) {
            proximoSeq = ultimoSeq + 1
          }
        }

        const seqStr = ('0000' + proximoSeq).slice(-4)
        rec.set('numero', prefixo + seqStr)
      } catch (err) {
        console.log('Erro ao gerar numeração automática de subcontrato: ' + err)
      }
    }

    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
    }

    if (!rec.getString('status')) {
      rec.set('status', 'aguardando_assinatura')
    }
  }
  e.next()
})

// Validação / Bloqueio no servidor de edição de etapas (permissões de perfil e validação de executor)
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'projeto_etapas') {
    // 1. Validação de perfil no servidor:
    // Apenas Admin ('admin') e Gestor de Projetos ('gestor') podem editar datas/etapas.
    // Comercial, Financeiro e Executor são bloqueados no servidor caso tentem alterar diretamente.
    const httpContext = e.httpContext
    if (httpContext && httpContext.auth) {
      const authUser = httpContext.auth
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        throw new ForbiddenError(
          'BLOQUEIO: Seu perfil (' +
            role +
            ') não possui permissão para editar ou alterar prazos de etapas.',
        )
      }
    }

    const executorId = rec.getString('executor')
    if (executorId) {
      const etapaStatus = rec.getString('status')
      // Se a etapa for ativa (não concluída e não cancelada)
      if (etapaStatus !== 'concluida' && etapaStatus !== 'cancelada') {
        try {
          const executor = $app.findRecordById('executores', executorId)
          if (executor) {
            // Regra 1: Não permitir alocar executor suspenso
            const statusExec = executor.getString('status')
            if (statusExec === 'suspenso') {
              const mot = executor.getString('motivo_suspensao') || 'Sem motivo especificado'
              throw new BadRequestError(
                'BLOQUEIO: Executor ' +
                  executor.getString('nome') +
                  ' está SUSPENSO (' +
                  mot +
                  ') e não pode ser alocado.',
              )
            }

            // Regra 2: Não permitir alocar executor com registro de conselho vencido
            const validadeStr = executor.getString('conselho_validade')
            if (validadeStr) {
              const hoje = new Date()
              hoje.setHours(0, 0, 0, 0)
              const dataVal = new Date(validadeStr)
              if (dataVal < hoje) {
                throw new BadRequestError(
                  'BLOQUEIO: O registro de classe (' +
                    executor.getString('conselho') +
                    ') do executor ' +
                    executor.getString('nome') +
                    ' está VENCIDO em ' +
                    validadeStr.substring(0, 10) +
                    '.',
                )
              }
            }

            // Regra 3: Não permitir alocar executor acima da capacidade simultânea
            const capSimultanea = executor.getInt('capacidade_simultanea') || 1
            const etapasAtivas = $app.findRecordsByFilter(
              'projeto_etapas',
              "executor = '" +
                executorId +
                "' && status != 'concluida' && status != 'cancelada' && id != '" +
                rec.id +
                "'",
              '',
              100,
              0,
            )

            if (etapasAtivas.length >= capSimultanea) {
              throw new BadRequestError(
                'BLOQUEIO: Executor ' +
                  executor.getString('nome') +
                  ' atingiu a capacidade máxima simultânea (' +
                  capSimultanea +
                  ' etapas ativas no momento).',
              )
            }
          }
        } catch (err) {
          if (err && err.message && err.message.startsWith('BLOQUEIO:')) {
            throw err
          }
          console.log('Erro ao validar alocação de executor: ' + err)
        }
      }
    }
  }
  e.next()
})

// Ao salvar uma avaliação, recalcular a nota geral com recência e volume
onRecordAfterCreateSuccess((e) => {
  try {
    const rec = e.record
    if (rec.collection().name === 'avaliacoes') {
      const executorId = rec.getString('executor')
      if (executorId) {
        try {
          const executor = $app.findRecordById('executores', executorId)
          if (executor) {
            const avaliacoes = $app.findRecordsByFilter(
              'avaliacoes',
              "executor = '" + executorId + "'",
              '-created',
              500,
              0,
            )

            if (avaliacoes.length === 0) {
              executor.set('nota_geral', 0)
              executor.set('total_avaliacoes', 0)
              $app.save(executor)
            } else {
              let somaNotasPonderadas = 0
              let somaPesosRecencia = 0

              for (let i = 0; i < avaliacoes.length; i++) {
                const a = avaliacoes[i]
                const pont = a.getFloat('pontualidade') || 0
                const qual = a.getFloat('qualidade') || 0
                const cust = a.getFloat('desvio_custo') || 0
                const resp = a.getFloat('responsividade') || 0

                const notaIndividual = (pont + qual + cust + resp) / 4
                if (Math.abs((a.getFloat('nota_final') || 0) - notaIndividual) > 0.01) {
                  a.set('nota_final', parseFloat(notaIndividual.toFixed(2)))
                  try {
                    $app.save(a)
                  } catch (_) {}
                }

                const pesoRecencia = Math.max(1.0, 3.0 - i * 0.4)
                somaNotasPonderadas += notaIndividual * pesoRecencia
                somaPesosRecencia += pesoRecencia
              }

              const notaCalculada =
                somaPesosRecencia > 0 ? somaNotasPonderadas / somaPesosRecencia : 0
              const notaAnterior = executor.getFloat('nota_geral') || 0
              const novaNota = parseFloat(notaCalculada.toFixed(2))

              executor.set('nota_geral', novaNota)
              executor.set('total_avaliacoes', avaliacoes.length)
              $app.save(executor)

              if (Math.abs(notaAnterior - novaNota) >= 0.05) {
                try {
                  const auditCol = $app.findCollectionByNameOrId('audit_logs')
                  const aRec = new Record(auditCol)
                  aRec.set('user', null)
                  aRec.set('user_email', 'SISTEMA')
                  aRec.set('acao', 'RECALCULO_NOTA_EXECUTOR')
                  aRec.set('entidade', 'executores')
                  aRec.set('registro_id', executorId)
                  aRec.set('detalhes', {
                    origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                    nota_anterior: notaAnterior,
                    nova_nota: novaNota,
                    total_avaliacoes: avaliacoes.length,
                    tendencia:
                      novaNota > notaAnterior
                        ? 'subindo'
                        : novaNota < notaAnterior
                          ? 'caindo'
                          : 'estavel',
                    mensagem:
                      'Nota recalculada automaticamente com ponderação por volume e recência',
                  })
                  $app.save(aRec)
                } catch (_) {}
              }
            }
          }
        } catch (err) {
          console.log('Erro ao recalcular nota no create: ' + err)
        }
      }
    }
  } finally {
    e.next()
  }
})

onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    if (rec.collection().name === 'avaliacoes') {
      const executorId = rec.getString('executor')
      if (executorId) {
        try {
          const executor = $app.findRecordById('executores', executorId)
          if (executor) {
            const avaliacoes = $app.findRecordsByFilter(
              'avaliacoes',
              "executor = '" + executorId + "'",
              '-created',
              500,
              0,
            )

            if (avaliacoes.length === 0) {
              executor.set('nota_geral', 0)
              executor.set('total_avaliacoes', 0)
              $app.save(executor)
            } else {
              let somaNotasPonderadas = 0
              let somaPesosRecencia = 0

              for (let i = 0; i < avaliacoes.length; i++) {
                const a = avaliacoes[i]
                const pont = a.getFloat('pontualidade') || 0
                const qual = a.getFloat('qualidade') || 0
                const cust = a.getFloat('desvio_custo') || 0
                const resp = a.getFloat('responsividade') || 0

                const notaIndividual = (pont + qual + cust + resp) / 4
                if (Math.abs((a.getFloat('nota_final') || 0) - notaIndividual) > 0.01) {
                  a.set('nota_final', parseFloat(notaIndividual.toFixed(2)))
                  try {
                    $app.save(a)
                  } catch (_) {}
                }

                const pesoRecencia = Math.max(1.0, 3.0 - i * 0.4)
                somaNotasPonderadas += notaIndividual * pesoRecencia
                somaPesosRecencia += pesoRecencia
              }

              const notaCalculada =
                somaPesosRecencia > 0 ? somaNotasPonderadas / somaPesosRecencia : 0
              const notaAnterior = executor.getFloat('nota_geral') || 0
              const novaNota = parseFloat(notaCalculada.toFixed(2))

              executor.set('nota_geral', novaNota)
              executor.set('total_avaliacoes', avaliacoes.length)
              $app.save(executor)

              if (Math.abs(notaAnterior - novaNota) >= 0.05) {
                try {
                  const auditCol = $app.findCollectionByNameOrId('audit_logs')
                  const aRec = new Record(auditCol)
                  aRec.set('user', null)
                  aRec.set('user_email', 'SISTEMA')
                  aRec.set('acao', 'RECALCULO_NOTA_EXECUTOR')
                  aRec.set('entidade', 'executores')
                  aRec.set('registro_id', executorId)
                  aRec.set('detalhes', {
                    origem: 'SISTEMA / GATILHO AUTOMÁTICO',
                    nota_anterior: notaAnterior,
                    nova_nota: novaNota,
                    total_avaliacoes: avaliacoes.length,
                    tendencia:
                      novaNota > notaAnterior
                        ? 'subindo'
                        : novaNota < notaAnterior
                          ? 'caindo'
                          : 'estavel',
                    mensagem:
                      'Nota recalculada automaticamente com ponderação por volume e recência',
                  })
                  $app.save(aRec)
                } catch (_) {}
              }
            }
          }
        } catch (err) {
          console.log('Erro ao recalcular nota no update: ' + err)
        }
      }
    } // Ao escolher uma cotação (escolhida = true), vincular executor ao projeto/etapa e desmarcar outras
    if (rec.collection().name === 'cotacoes') {
      const isEscolhida = rec.getBool('escolhida')
      const original = rec.original()
      const wasEscolhida = original ? original.getBool('escolhida') : false

      if (isEscolhida && !wasEscolhida) {
        const etapaId = rec.getString('etapa')
        const projetoId = rec.getString('projeto')
        const executorId = rec.getString('executor')
        const cotacaoId = rec.id

        try {
          // 1. Se vinculada ao projeto diretamente (novo eixo Bloco 5)
          if (projetoId) {
            const outrasPrj = $app.findRecordsByFilter(
              'cotacoes',
              "projeto = '" + projetoId + "' && id != '" + cotacaoId + "'",
              '',
              100,
              0,
            )
            for (let i = 0; i < outrasPrj.length; i++) {
              const o = outrasPrj[i]
              if (o.getBool('escolhida') || o.getString('status') !== 'recusada') {
                o.set('escolhida', false)
                if (o.getString('status') !== 'recusada') {
                  o.set('status', 'nao_escolhida')
                }
                $app.save(o)
              }
            }
          }

          // 2. Se também vinculada a etapa (legado ou mista)
          if (etapaId) {
            const outrasEtapa = $app.findRecordsByFilter(
              'cotacoes',
              "etapa = '" + etapaId + "' && id != '" + cotacaoId + "'",
              '',
              100,
              0,
            )
            for (let i = 0; i < outrasEtapa.length; i++) {
              const o = outrasEtapa[i]
              if (o.getBool('escolhida') || o.getString('status') !== 'recusada') {
                o.set('escolhida', false)
                if (o.getString('status') !== 'recusada') {
                  o.set('status', 'nao_escolhida')
                }
                $app.save(o)
              }
            }

            const etapa = $app.findRecordById('projeto_etapas', etapaId)
            if (etapa) {
              etapa.set('executor', executorId)
              if (etapa.getString('status') === 'cotacao') {
                etapa.set('status', 'a_iniciar')
              }
              $app.save(etapa)
            }
          }

          // Registrar auditoria da escolha de cotação
          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const aRec = new Record(auditCol)
            aRec.set('user', null)
            aRec.set('user_email', 'SISTEMA')
            aRec.set('acao', 'ESCOLHA_COTACAO')
            aRec.set('entidade', 'cotacoes')
            aRec.set('registro_id', cotacaoId)
            aRec.set('detalhes', {
              origem: 'SISTEMA / GATILHO AUTOMÁTICO',
              projeto_id: projetoId,
              etapa_id: etapaId,
              executor_id: executorId,
              preco_ofertado: rec.getFloat('preco_ofertado'),
              prazo_ofertado: rec.getString('prazo_ofertado'),
              mensagem: 'Cotação escolhida para o projeto/etapa',
            })
            $app.save(aRec)
          } catch (_) {}
        } catch (err) {
          console.log('Erro ao processar escolha de cotacao: ' + err)
        }
      }
    }
  } finally {
    e.next()
  }
})

// =========================================================================
// 5. ENDPOINT DEFINIR MODO DE EXECUÇÃO DO PROJETO (Admin / Gestor)
// POST /backend/v1/projetos/{id}/definir-modo-execucao
// Body: { modo_execucao: 'direta' | 'cotacao' }
// =========================================================================
routerAdd(
  'POST',
  '/backend/v1/projetos/{id}/definir-modo-execucao',
  (c) => {
    const authRecord = c.auth
    if (!authRecord) {
      return c.json(401, { error: 'Autenticação obrigatória' })
    }

    const role = authRecord.getString('role')
    if (role !== 'admin' && role !== 'gestor') {
      return c.json(403, {
        error: 'Apenas administradores e gestores de projeto podem definir o modo de execução.',
      })
    }

    const projetoId = c.request.pathValue('id')
    if (!projetoId) {
      return c.json(400, { error: 'ID do projeto não fornecido' })
    }

    let body = {}
    try {
      c.bindBody(body)
    } catch (_) {}

    const modo = (body.modo_execucao || body.modo || '').trim()
    if (modo !== 'direta' && modo !== 'cotacao') {
      return c.json(400, {
        error: "Modo de execução inválido. Valores aceitos: 'direta' ou 'cotacao'.",
      })
    }

    let projeto
    try {
      projeto = $app.findRecordById('projetos', projetoId)
    } catch (_) {
      return c.json(404, { error: 'Projeto não encontrado' })
    }

    const statusAnterior = projeto.getString('status')
    const modoAnterior = projeto.getString('modo_execucao')

    // Definir modo e atualizar status para 'em_andamento'
    projeto.set('modo_execucao', modo)
    if (statusAnterior === 'aguardando_definicao' || !statusAnterior) {
      projeto.set('status', 'em_andamento')
    }

    $app.save(projeto)

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('acao', 'DEFINIR_MODO_EXECUCAO')
      aRec.set('entidade', 'projetos')
      aRec.set('registro_id', projeto.id)
      aRec.set('user', authRecord.id)
      aRec.set('user_email', authRecord.getString('email'))
      aRec.set('detalhes', {
        origem: 'USUÁRIO',
        projeto_id: projeto.id,
        codigo: projeto.getString('codigo'),
        nome: projeto.getString('nome'),
        modo_execucao: modo,
        modo_anterior: modoAnterior,
        status_anterior: statusAnterior,
        status_novo: projeto.getString('status'),
        usuario_id: authRecord.id,
        usuario_email: authRecord.getString('email'),
        usuario_nome: authRecord.getString('nome'),
        usuario_role: role,
        mensagem:
          'Modo de execução do projeto ' +
          projeto.getString('codigo') +
          " definido como '" +
          modo +
          "' por " +
          authRecord.getString('nome') +
          ' (' +
          role +
          ')',
      })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Erro ao auditar definicao de modo de execucao: ' + eAudit)
    }

    return c.json(200, {
      sucesso: true,
      projeto_id: projeto.id,
      codigo: projeto.getString('codigo'),
      modo_execucao: modo,
      status: projeto.getString('status'),
    })
  },
  $apis.requireAuth(),
)

// =========================================================================
// 6. ENDPOINT SUGESTÕES INTELIGENTES DE EXECUTORES POR ÁREA DO PROJETO
// GET /backend/v1/projetos/{id}/sugestoes-executores
// Filtra executores homologados/ativos com disciplina compatível
// Ordenados por nota_geral desc (desempate), retornando DDI 55 normalizado
// =========================================================================
routerAdd(
  'GET',
  '/backend/v1/projetos/{id}/sugestoes-executores',
  (c) => {
    const authRecord = c.auth
    if (!authRecord) {
      return c.json(401, { error: 'Autenticação obrigatória' })
    }

    const projetoId = c.request.pathValue('id')
    if (!projetoId) {
      return c.json(400, { error: 'ID do projeto não fornecido' })
    }

    let projeto
    try {
      projeto = $app.findRecordById('projetos', projetoId)
    } catch (_) {
      return c.json(404, { error: 'Projeto não encontrado' })
    }

    // Coletar disciplinas/áreas do projeto e de suas etapas
    const termosAreas = []
    function addTermos(str) {
      if (!str) return
      const partes = str
        .toLowerCase()
        .replace(/[;,/\\|\n\r]/g, ' ')
        .split(/\s+/)
      for (let i = 0; i < partes.length; i++) {
        const p = partes[i].trim()
        if (
          p.length >= 3 &&
          ![
            'com',
            'para',
            'dos',
            'das',
            'que',
            'uma',
            'por',
            'sem',
            'projeto',
            'projetos',
          ].includes(p)
        ) {
          termosAreas.push(p)
        }
      }
    }

    const prjDisciplinas = projeto.getString('disciplinas')
    const prjNome = projeto.getString('nome')
    const prjDescricao = projeto.getString('descricao')
    addTermos(prjDisciplinas)
    addTermos(prjNome)

    // Buscar etapas do projeto
    try {
      const etapas = $app.findRecordsByFilter(
        'projeto_etapas',
        "projeto = '" + projetoId + "'",
        'created',
        50,
        0,
      )
      for (let i = 0; i < etapas.length; i++) {
        addTermos(etapas[i].getString('nome'))
        addTermos(etapas[i].getString('disciplina'))
        const areaRelId = etapas[i].getString('area')
        if (areaRelId) {
          try {
            const areaRec = $app.findRecordById('areas_atuacao', areaRelId)
            if (areaRec) {
              addTermos(areaRec.getString('nome'))
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Buscar executores ativos
    const executores = $app.findRecordsByFilter(
      'executores',
      "status = 'ativo'",
      '-nota_geral',
      200,
      0,
    )

    function normalizarTelefoneDDI55(tel) {
      if (!tel) return ''
      let digits = tel.replace(/\D/g, '')
      if (!digits) return ''
      if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
      if (!digits.startsWith('55')) {
        digits = '55' + digits
      }
      return digits
    }

    const sugestoes = []
    for (let i = 0; i < executores.length; i++) {
      const ex = executores[i]
      const discEx = (ex.getString('disciplinas') || '').toLowerCase()
      const regiaoEx = (ex.getString('regiao') || '').toLowerCase()

      // Calcular aderência por correspondência de termos
      let matchCount = 0
      const matchedTerms = []
      if (termosAreas.length > 0) {
        for (let t = 0; t < termosAreas.length; t++) {
          const termo = termosAreas[t]
          if (discEx.indexOf(termo) !== -1) {
            matchCount++
            if (!matchedTerms.includes(termo)) matchedTerms.push(termo)
          }
        }
      }

      // Se não há restrição de área no projeto, todos entram. Se há termos, filtrar os compatíveis ou listar com score
      const notaGeral = ex.getFloat('nota_geral') || 0
      const telOriginal = ex.getString('telefone')
      const telNormalizado = normalizarTelefoneDDI55(telOriginal)

      sugestoes.push({
        id: ex.id,
        nome: ex.getString('nome'),
        tipo: ex.getString('tipo'),
        cpf_cnpj: ex.getString('cpf_cnpj'),
        email: ex.getString('email'),
        telefone: telOriginal,
        telefone_normalizado: telNormalizado,
        disciplinas: ex.getString('disciplinas'),
        regiao: ex.getString('regiao'),
        nota_geral: notaGeral,
        total_avaliacoes: ex.getInt('total_avaliacoes') || 0,
        status: ex.getString('status'),
        compatibilidade: matchCount,
        termos_compativeis: matchedTerms,
      })
    }

    // Ordenar: primeiro compatibilidade de áreas desc (se houver correspondência), depois nota_geral desc como desempate
    sugestoes.sort((a, b) => {
      if (
        b.compatibilidade !== a.compatibilidade &&
        (b.compatibilidade > 0 || a.compatibilidade > 0)
      ) {
        return b.compatibilidade - a.compatibilidade
      }
      return b.nota_geral - a.nota_geral
    })

    return c.json(200, {
      projeto_id: projeto.id,
      projeto_codigo: projeto.getString('codigo'),
      disciplinas_projeto: prjDisciplinas,
      total_encontrados: sugestoes.length,
      sugestoes: sugestoes,
    })
  },
  $apis.requireAuth(),
)
