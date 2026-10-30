// =============================================================================
// GESTÃO G+ — SUGESTÃO INTELIGENTE DE PRESTADORES E APROVAÇÃO COM CRIAÇÃO DE OS
// Requisitos 3 e 4:
// - Rota /backend/v1/prestadores/sugestoes (Admin e Gestor)
// - Rota /backend/v1/prestadores/aprovar-sugestao (Admin e Gestor)
// =============================================================================

routerAdd(
  'POST',
  '/backend/v1/prestadores/sugestoes',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Acesso restrito a Administradores e Gestores de Projetos.' })
      }

      const body = reqInfo.body || {}
      const disciplina = (body.disciplina || '').trim()
      const regiao = (body.regiao || '').trim().toUpperCase()
      const pacoteId = (body.pacote_id || '').trim()

      if (!disciplina) {
        return e.json(400, { error: 'O parâmetro disciplina é obrigatório para sugestão.' })
      }

      // Buscar todos os prestadores ativos e não suspensos
      const prestadores = $app.findRecordsByFilter(
        'prestadores',
        "status = 'ativo'",
        '-nota_media',
        200,
        0,
      )

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const sugestoes = []

      for (let i = 0; i < prestadores.length; i++) {
        const p = prestadores[i]

        // 1. Conselho de classe: validade não vencida
        const valConselho = p.getString('validade_registro_conselho')
        let conselhoValido = true
        if (valConselho) {
          const dtVal = new Date(valConselho)
          if (dtVal < hoje) {
            conselhoValido = false
          }
        }
        if (!conselhoValido) {
          continue // Ignorar conselho vencido
        }

        // 2. Disciplinas compatíveis
        const discLista = p.get('disciplinas_atuacao') || []
        const especialidade = p.getString('especialidade') || ''
        let compativel = false

        if (Array.isArray(discLista)) {
          for (let d = 0; d < discLista.length; d++) {
            if (
              String(discLista[d]).toLowerCase().includes(disciplina.toLowerCase()) ||
              disciplina.toLowerCase().includes(String(discLista[d]).toLowerCase())
            ) {
              compativel = true
              break
            }
          }
        }
        if (!compativel && especialidade.toLowerCase().includes(disciplina.toLowerCase())) {
          compativel = true
        }

        if (!compativel) {
          continue // Apenas prestadores com disciplina compatível
        }

        // 3. Capacidade simultânea livre (capacidade_simultanea menos OS ativas)
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
        const qtdOsAtivas = osAtivas.length
        const capacidadeLivre = Math.max(0, capMax - qtdOsAtivas)

        // 4. Região / UF compatível
        const ufPrestador = (p.getString('uf') || '').toUpperCase()
        const mesmaRegiao = regiao ? ufPrestador === regiao : true

        // 5. Histórico e TENDÊNCIA dos últimos trabalhos
        // Buscar as últimas 5 OS concluídas/encerradas do prestador
        const osHistorico = $app.findRecordsByFilter(
          'ordens_servico',
          "prestador = '" + p.id + "' && (status = 'encerrada' || status = 'em_execucao')",
          '-data_conclusao',
          5,
          0,
        )

        let pontualidadeScore = 0
        let totalAvaliadas = 0
        const historicoAtrasos = []

        for (let h = 0; h < osHistorico.length; h++) {
          const osItem = osHistorico[h]
          const dtPrev = osItem.getString('data_previsao_fim')
          const dtFim = osItem.getString('data_conclusao') || new Date().toISOString()
          if (dtPrev) {
            totalAvaliadas++
            const diasAtraso = Math.floor(
              (new Date(dtFim).getTime() - new Date(dtPrev).getTime()) / (1000 * 60 * 60 * 24),
            )
            historicoAtrasos.push(diasAtraso)
            if (diasAtraso <= 0) {
              pontualidadeScore += 1 // No prazo
            } else if (diasAtraso <= 3) {
              pontualidadeScore += 0.5 // Atraso leve
            } else {
              pontualidadeScore -= 1 // Atraso severo
            }
          }
        }

        // Determinar direção da tendência: melhorou, estável ou piorou
        let tendencia = 'estavel'
        if (historicoAtrasos.length >= 2) {
          const maisRecente = historicoAtrasos[0]
          const anterior = historicoAtrasos[1]
          if (maisRecente < anterior) {
            tendencia = 'melhorou'
          } else if (maisRecente > anterior) {
            tendencia = 'piorou'
          }
        }

        // 6. Cálculo da pontuação composta do ranking
        const notaMedia = p.getFloat('nota_media') || 5.0
        let score = notaMedia * 10 // 0 a 100 base
        score += capacidadeLivre * 5 // Bônus por capacidade livre
        if (mesmaRegiao) score += 10 // Bônus regional
        if (p.getString('tipo') === 'interno') score += 5 // Bônus equipe interna (agilidade)

        if (tendencia === 'melhorou') score += 8
        if (tendencia === 'piorou') score -= 12

        // Motivos formatados
        const motivos = []
        motivos.push('Disciplina compatível: ' + disciplina)
        motivos.push('Capacidade simultânea livre: ' + capacidadeLivre + ' de ' + capMax)
        motivos.push('Nota média: ' + notaMedia.toFixed(1))
        motivos.push(
          'Tendência de entregas: ' +
            tendencia.toUpperCase() +
            (totalAvaliadas > 0
              ? ' (' + totalAvaliadas + ' avaliadas)'
              : ' (sem histórico recente)'),
        )
        if (mesmaRegiao && regiao) motivos.push('Localização na mesma UF (' + regiao + ')')
        if (p.getString('tipo') === 'interno')
          motivos.push('Prestador Interno (sem camada financeira)')

        sugestoes.push({
          prestador_id: p.id,
          nome: p.getString('nome'),
          tipo: p.getString('tipo'),
          email: p.getString('email'),
          uf: ufPrestador,
          disciplinas: discLista,
          nota_media: notaMedia,
          capacidade_maxima: capMax,
          capacidade_livre: capacidadeLivre,
          os_ativas: qtdOsAtivas,
          tendencia: tendencia,
          score_final: Math.round(score * 10) / 10,
          motivos: motivos,
          conselho_validade: valConselho ? valConselho.substring(0, 10) : 'Sem restrição',
        })
      }

      // Ordenar por score_final decrescente
      sugestoes.sort((a, b) => b.score_final - a.score_final)

      return e.json(200, {
        disciplina: disciplina,
        regiao: regiao || 'Qualquer',
        pacote_id: pacoteId || null,
        total: sugestoes.length,
        sugestoes: sugestoes,
      })
    } catch (err) {
      console.log('Erro ao calcular sugestões de prestadores: ' + err)
      return e.json(500, { error: 'Erro ao ranquear prestadores: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/prestadores/aprovar-sugestao',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária' })
      }
      const role = authUser.getString('role')
      if (role !== 'admin' && role !== 'gestor') {
        return e.json(403, { error: 'Acesso restrito a Administradores e Gestores de Projetos.' })
      }

      const body = reqInfo.body || {}
      const prestadorId = (body.prestador_id || '').trim()
      const projetoId = (body.projeto_id || '').trim()
      const pacoteId = (body.pacote_id || '').trim() // ID de projeto_etapas (pacote)
      const disciplina = (body.disciplina || '').trim()
      const valorOS = parseFloat(body.valor_os) || 0
      const prazoDias = parseInt(body.prazo_dias) || 30
      const escopoTecnico = (body.escopo_tecnico || '').trim()

      if (!prestadorId || !projetoId) {
        return e.json(400, { error: 'prestador_id e projeto_id são obrigatórios.' })
      }

      const prestador = $app.findRecordById('prestadores', prestadorId)
      if (!prestador) {
        return e.json(404, { error: 'Prestador não encontrado.' })
      }

      const projeto = $app.findRecordById('projetos', projetoId)
      if (!projeto) {
        return e.json(404, { error: 'Projeto não encontrado.' })
      }

      const isInterno = prestador.getString('tipo') === 'interno'
      let contratoMestreId = null

      // Se for externo, deve vincular ao contrato-mestre do prestador
      if (!isInterno) {
        const cmAtivos = $app.findRecordsByFilter(
          'contratos_mestre',
          "prestador = '" + prestadorId + "' && status = 'assinado'",
          '-created',
          1,
          0,
        )
        if (cmAtivos.length > 0) {
          contratoMestreId = cmAtivos[0].id
        }
      }

      const osCol = $app.findCollectionByNameOrId('ordens_servico')
      const novaOS = new Record(osCol)

      novaOS.set('projeto', projetoId)
      novaOS.set('prestador', prestadorId)
      novaOS.set('tipo_prestador', isInterno ? 'interno' : 'externo')
      novaOS.set('disciplina', disciplina || 'Engenharia')
      novaOS.set('escopo_tecnico', escopoTecnico || 'Execução técnica da disciplina ' + disciplina)
      novaOS.set('prazo_dias', prazoDias)

      const dtInicio = new Date()
      const dtFim = new Date()
      dtFim.setDate(dtFim.getDate() + prazoDias)
      novaOS.set('data_inicio', dtInicio.toISOString().substring(0, 10) + ' 12:00:00.000Z')
      novaOS.set('data_previsao_fim', dtFim.toISOString().substring(0, 10) + ' 12:00:00.000Z')

      if (isInterno) {
        // Interno: SEM camada financeira nenhuma
        novaOS.set('valor_os', 0)
        novaOS.set('percentual_retencao_tecnica', 0)
        novaOS.set('retencao_tecnica_acumulada', 0)
        novaOS.set('status_retencao', 'sem_retencao')
        novaOS.set('status', 'em_execucao')
      } else {
        // Externo: camada financeira completa com retenção técnica
        novaOS.set('valor_os', valorOS)
        if (contratoMestreId) {
          novaOS.set('contrato_mestre', contratoMestreId)
        }
        const percRetencao = prestador.getFloat('retencao_tecnica_padrao') || 5.0
        novaOS.set('percentual_retencao_tecnica', percRetencao)
        novaOS.set('status_retencao', 'em_retencao')
        novaOS.set('status', 'minuta')

        // Parcelamento sugerido (100% na entrega ou 50/50)
        const parcelasOS = [
          {
            ordem: 1,
            descricao: 'Entrega e Aprovação Técnica Final',
            percentual: 100,
            valor: valorOS,
            vencimento: dtFim.toISOString().substring(0, 10),
          },
        ]
        novaOS.set('parcelas_json', parcelasOS)
      }

      // Salva a OS (aciona validações de teto vendido e hooks existentes)
      $app.save(novaOS)

      // Se pacoteId foi passado, vincular a OS à etapa/pacote e atribuir entregáveis
      if (pacoteId) {
        try {
          const pacoteRec = $app.findRecordById('projeto_etapas', pacoteId)
          if (pacoteRec) {
            pacoteRec.set('ordem_servico_ativa', novaOS.id)
            pacoteRec.set('status', 'em_andamento')
            $app.save(pacoteRec)

            // Vincular entregáveis desta etapa/pacote ao prestador e OS
            const entregaveisEtapa = $app.findRecordsByFilter(
              'entregaveis',
              "etapa = '" + pacoteId + "'",
              '',
              50,
              0,
            )
            for (let ent = 0; ent < entregaveisEtapa.length; ent++) {
              const entRec = entregaveisEtapa[ent]
              entRec.set('prestador', prestadorId)
              entRec.set('ordem_servico', novaOS.id)
              entRec.set('status', 'atribuido')
              $app.save(entRec)
            }
          }
        } catch (ePacote) {
          console.log('Aviso ao vincular pacote de trabalho à OS: ' + ePacote)
        }
      }

      // Auditoria da aprovação
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', authUser.getString('email'))
        aRec.set('acao', 'APROVACAO_SUGESTAO_PRESTADOR')
        aRec.set('entidade', 'ordens_servico')
        aRec.set('registro_id', novaOS.id)
        aRec.set('detalhes', {
          prestador_id: prestadorId,
          prestador_nome: prestador.getString('nome'),
          tipo: isInterno ? 'interno' : 'externo',
          projeto_id: projetoId,
          pacote_id: pacoteId || null,
          disciplina: disciplina,
          valor_os: valorOS,
          numero_os: novaOS.getString('numero'),
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        os_id: novaOS.id,
        numero: novaOS.getString('numero'),
        tipo: novaOS.getString('tipo_prestador'),
        status: novaOS.getString('status'),
        valor: novaOS.getFloat('valor_os') || 0,
      })
    } catch (err) {
      console.log('Erro ao aprovar sugestão de prestador: ' + err)
      return e.json(400, { error: err.message || String(err) })
    }
  },
  $apis.requireAuth(),
)
