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
  }
  e.next()
})

// Validação / Bloqueio no servidor de alocação de executor em etapas
onRecordValidate((e) => {
  const rec = e.record
  if (rec.collection().name === 'projeto_etapas') {
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
                aRec.set('acao', 'RECALCULO_NOTA_EXECUTOR')
                aRec.set('entidade', 'executores')
                aRec.set('registro_id', executorId)
                aRec.set('detalhes', {
                  nota_anterior: notaAnterior,
                  nova_nota: novaNota,
                  total_avaliacoes: avaliacoes.length,
                  tendencia:
                    novaNota > notaAnterior
                      ? 'subindo'
                      : novaNota < notaAnterior
                        ? 'caindo'
                        : 'estavel',
                  mensagem: 'Nota recalculada automaticamente com ponderação por volume e recência',
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
})

onRecordAfterUpdateSuccess((e) => {
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
                aRec.set('acao', 'RECALCULO_NOTA_EXECUTOR')
                aRec.set('entidade', 'executores')
                aRec.set('registro_id', executorId)
                aRec.set('detalhes', {
                  nota_anterior: notaAnterior,
                  nova_nota: novaNota,
                  total_avaliacoes: avaliacoes.length,
                  tendencia:
                    novaNota > notaAnterior
                      ? 'subindo'
                      : novaNota < notaAnterior
                        ? 'caindo'
                        : 'estavel',
                  mensagem: 'Nota recalculada automaticamente com ponderação por volume e recência',
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
  } // Ao escolher uma cotação (escolhida = true), vincular executor à etapa e desmarcar outras
  if (rec.collection().name === 'cotacoes') {
    const isEscolhida = rec.getBool('escolhida')
    const original = rec.original()
    const wasEscolhida = original ? original.getBool('escolhida') : false

    if (isEscolhida && !wasEscolhida) {
      const etapaId = rec.getString('etapa')
      const executorId = rec.getString('executor')
      const cotacaoId = rec.id

      try {
        // Desmarcar as outras cotações da mesma etapa
        const outras = $app.findRecordsByFilter(
          'cotacoes',
          "etapa = '" + etapaId + "' && id != '" + cotacaoId + "'",
          '',
          100,
          0,
        )
        for (let i = 0; i < outras.length; i++) {
          const o = outras[i]
          if (o.getBool('escolhida') || o.getString('status') !== 'recusada') {
            o.set('escolhida', false)
            if (o.getString('status') !== 'recusada') {
              o.set('status', 'nao_escolhida')
            }
            $app.save(o)
          }
        }

        // Vincular executor à etapa e atualizar status da etapa
        const etapa = $app.findRecordById('projeto_etapas', etapaId)
        if (etapa) {
          etapa.set('executor', executorId)
          if (etapa.getString('status') === 'cotacao') {
            etapa.set('status', 'a_iniciar')
          }
          $app.save(etapa)
        }

        // Registrar auditoria da escolha de cotação
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const aRec = new Record(auditCol)
          aRec.set('acao', 'ESCOLHA_COTACAO')
          aRec.set('entidade', 'cotacoes')
          aRec.set('registro_id', cotacaoId)
          aRec.set('detalhes', {
            etapa_id: etapaId,
            executor_id: executorId,
            preco_ofertado: rec.getFloat('preco_ofertado'),
            prazo_ofertado: rec.getString('prazo_ofertado'),
            mensagem: 'Cotação escolhida e executor vinculado à etapa',
          })
          $app.save(aRec)
        } catch (_) {}
      } catch (err) {
        console.log('Erro ao processar escolha de cotacao: ' + err)
      }
    }
  }
})
