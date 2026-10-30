// pocketbase/hooks/prestadores_os_operations.js
// Regras de negócio do módulo PRESTADORES e ORDENS DE SERVIÇO:
// 1. Numeração sequencial sem lacunas para OS (OS-AAAA-NNNN) e Contratos-Mestre (CM-AAAA-NNNN)
// 2. Token único e prazos/expiração para contratos-mestre e ordens de serviço
// 3. Validação de Prestador Interno vs Externo:
//    - OS Interna: NÃO gera retenção técnica, NÃO gera contas a pagar, NÃO gera cotações financeiras
//    - OS Externa: Mantém ciclo, checklist normativo (4 itens), retenção técnica e contas a pagar vinculadas
// 4. Bloqueios de encerramento de OS no servidor:
//    - Bloquear se checklist de encerramento estiver incompleto
//    - Bloquear se houver contas a pagar em aberto vinculadas à OS externa
// 5. Sincronização automática para as Coleções-Projeção do Portal (portal_os, portal_entregaveis, portal_documentos):
//    - Contém ESTRITAMENTE: codigo_projeto, disciplina, escopo_tecnico, entregaveis, prazos, arquivos, valor_os
//    - NUNCA expõe: cliente, nome da obra/empresa, proposta, valor global do contrato, BDI ou outros prestadores

// Geração sequencial e tokens no create
onRecordCreate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  // 1. Contratos Mestre: CM-AAAA-NNNN
  if (colName === 'contratos_mestre') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'CM-' + anoAtual + '-'

    let num = rec.getString('numero')
    if (!num || !num.startsWith(prefixo)) {
      try {
        const ultimos = $app.findRecordsByFilter(
          'contratos_mestre',
          "numero ~ '" + prefixo + "'",
          '-numero',
          1,
          0,
        )
        let seq = 1
        if (ultimos.length > 0) {
          const ultNum = ultimos[0].getString('numero')
          const partes = ultNum.split('-')
          const ultSeq = parseInt(partes[2], 10)
          if (!isNaN(ultSeq)) seq = ultSeq + 1
        }
        rec.set('numero', prefixo + ('0000' + seq).slice(-4))
      } catch (err) {
        console.log('Erro ao gerar numero CM: ' + err)
      }
    }

    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
    }
    if (!rec.getString('status')) {
      rec.set('status', 'minuta')
    }
  }

  // 2. Ordens de Serviço: OS-AAAA-NNNN
  if (colName === 'ordens_servico') {
    const anoAtual = new Date().getFullYear()
    const prefixo = 'OS-' + anoAtual + '-'

    let num = rec.getString('numero')
    if (!num || !num.startsWith(prefixo)) {
      try {
        const ultimos = $app.findRecordsByFilter(
          'ordens_servico',
          "numero ~ '" + prefixo + "'",
          '-numero',
          1,
          0,
        )
        let seq = 1
        if (ultimos.length > 0) {
          const ultNum = ultimos[0].getString('numero')
          const partes = ultNum.split('-')
          const ultSeq = parseInt(partes[2], 10)
          if (!isNaN(ultSeq)) seq = ultSeq + 1
        }
        rec.set('numero', prefixo + ('0000' + seq).slice(-4))
      } catch (err) {
        console.log('Erro ao gerar numero OS: ' + err)
      }
    }

    if (!rec.getString('token_assinatura')) {
      rec.set('token_assinatura', $security.randomString(32))
    }

    // Regra: Se tipo_prestador for interno, não tem camada financeira
    const tipoPrest = rec.getString('tipo_prestador')
    if (tipoPrest === 'interno') {
      rec.set('percentual_retencao_tecnica', 0)
      rec.set('retencao_tecnica_acumulada', 0)
      rec.set('retencao_tecnica_liberada', 0)
      rec.set('status_retencao', 'sem_retencao')
      rec.set('valor_os', 0)
      rec.set('parcelas_json', null)
    }

    if (!rec.getString('status')) {
      rec.set('status', tipoPrest === 'interno' ? 'em_execucao' : 'minuta')
    }
  }

  e.next()
})

// Validação / Regras de negócio de Ordens de Serviço
onRecordValidate((e) => {
  const rec = e.record
  const colName = rec.collection().name

  if (colName === 'ordens_servico') {
    const prestadorId = rec.getString('prestador')
    if (prestadorId) {
      try {
        const prestador = $app.findRecordById('prestadores', prestadorId)
        if (prestador) {
          // Validar tipo_prestador condizente
          const pTipo = prestador.getString('tipo')
          if (pTipo === 'interno') {
            rec.set('tipo_prestador', 'interno')
            // Forçar ausência de financeiro
            rec.set('percentual_retencao_tecnica', 0)
            rec.set('retencao_tecnica_acumulada', 0)
            rec.set('status_retencao', 'sem_retencao')
            rec.set('valor_os', 0)
          } else {
            rec.set('tipo_prestador', 'externo')
          }

          // Bloquear prestador suspenso
          if (prestador.getString('status') === 'suspenso') {
            throw new BadRequestError(
              'BLOQUEIO: Prestador ' +
                prestador.getString('nome') +
                ' está SUSPENSO e não pode receber Ordens de Serviço.',
            )
          }

          // Bloquear conselho vencido
          const valConselho = prestador.getString('validade_registro_conselho')
          if (valConselho) {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const dtVal = new Date(valConselho)
            if (dtVal < hoje) {
              throw new BadRequestError(
                'BLOQUEIO: O registro de classe do prestador ' +
                  prestador.getString('nome') +
                  ' está VENCIDO em ' +
                  valConselho.substring(0, 10) +
                  '. Regularize antes de emitir OS.',
              )
            }
          }
        }
      } catch (err) {
        if (err && err.message && err.message.startsWith('BLOQUEIO:')) {
          throw err
        }
      }
    }

    // Validação de encerramento da OS
    const statusNovo = rec.getString('status')
    if (statusNovo === 'encerrada') {
      const isExterno = rec.getString('tipo_prestador') === 'externo'

      // 1. Checklist de encerramento obrigatório
      const checklist = rec.get('checklist_encerramento_json')
      if (Array.isArray(checklist) && checklist.length > 0) {
        const pendentes = checklist.filter((item) => !item.concluido)
        if (pendentes.length > 0) {
          throw new BadRequestError(
            'BLOQUEIO: A Ordem de Serviço não pode ser encerrada. Há ' +
              pendentes.length +
              ' item(ns) normativo(s) pendente(s) no checklist de encerramento.',
          )
        }
      }

      // 2. Se externo, verificar contas a pagar em aberto vinculadas à OS
      if (isExterno) {
        try {
          const contasAbertas = $app.findRecordsByFilter(
            'contas',
            "ordem_servico = '" +
              rec.id +
              "' && tipo = 'pagar' && status != 'paga' && status != 'cancelada'",
            '',
            10,
            0,
          )
          if (contasAbertas.length > 0) {
            throw new BadRequestError(
              'BLOQUEIO: A Ordem de Serviço possui ' +
                contasAbertas.length +
                ' conta(s) a pagar em aberto. Regularize a quitação financeira antes de encerrar.',
            )
          }
        } catch (eContas) {
          if (eContas && eContas.message && eContas.message.startsWith('BLOQUEIO:')) {
            throw eContas
          }
        }
      }
    }
  }

  // Validação em prestadores: validação de CPF/CNPJ
  if (colName === 'prestadores') {
    const doc = (rec.getString('cpf_cnpj') || '').replace(/\D/g, '')
    const tipo = rec.getString('tipo')
    if (tipo === 'pf_externo' && doc.length > 0 && doc.length !== 11) {
      throw new BadRequestError('CPF do prestador PF deve possuir exatamente 11 dígitos.')
    }
    if (tipo === 'pj_externo' && doc.length > 0 && doc.length !== 14) {
      throw new BadRequestError('CNPJ do prestador PJ deve possuir exatamente 14 dígitos.')
    }
  }

  e.next()
})

// Sincronização pós-salvamento da OS com as projeções do Portal (portal_os)
onRecordAfterCreateSuccess((e) => {
  try {
    const osRecord = e.record
    if (osRecord.collection().name === 'ordens_servico') {
      const prestadorId = osRecord.getString('prestador')
      const projetoId = osRecord.getString('projeto')
      if (prestadorId && projetoId) {
        let prestador
        let projeto
        try {
          prestador = $app.findRecordById('prestadores', prestadorId)
          projeto = $app.findRecordById('projetos', projetoId)
        } catch (_) {}

        if (prestador && projeto) {
          const emailPrestador = prestador.getString('email')
          if (emailPrestador) {
            const portalCol = $app.findCollectionByNameOrId('portal_os')
            const existentes = $app.findRecordsByFilter(
              'portal_os',
              "os_id = '" + osRecord.id + "'",
              '',
              1,
              0,
            )

            let pRec
            if (existentes.length > 0) {
              pRec = existentes[0]
            } else {
              pRec = new Record(portalCol)
            }

            pRec.set('os_id', osRecord.id)
            pRec.set('prestador_email', emailPrestador)
            pRec.set('prestador_id', prestadorId)
            pRec.set('codigo_projeto', projeto.getString('codigo') || 'PRJ')
            pRec.set('numero_os', osRecord.getString('numero'))
            pRec.set('disciplina', osRecord.getString('disciplina') || 'Engenharia')
            pRec.set('escopo_tecnico', osRecord.getString('escopo_tecnico'))
            pRec.set('entregaveis_resumo', osRecord.getString('entregaveis_texto'))
            pRec.set('prazo_dias', osRecord.getInt('prazo_dias') || 0)
            pRec.set('data_inicio', osRecord.getString('data_inicio'))
            pRec.set('data_previsao_fim', osRecord.getString('data_previsao_fim'))
            pRec.set('status', osRecord.getString('status'))
            pRec.set('valor_os', osRecord.getFloat('valor_os') || 0)
            pRec.set('token_assinatura', osRecord.getString('token_assinatura'))

            $app.save(pRec)
          }
        }
      }
    }
  } catch (err) {
    console.log('Erro ao sincronizar portal_os no create: ' + err)
  } finally {
    e.next()
  }
})

onRecordAfterUpdateSuccess((e) => {
  try {
    const osRecord = e.record
    if (osRecord.collection().name === 'ordens_servico') {
      const prestadorId = osRecord.getString('prestador')
      const projetoId = osRecord.getString('projeto')
      if (prestadorId && projetoId) {
        let prestador
        let projeto
        try {
          prestador = $app.findRecordById('prestadores', prestadorId)
          projeto = $app.findRecordById('projetos', projetoId)
        } catch (_) {}

        if (prestador && projeto) {
          const emailPrestador = prestador.getString('email')
          if (emailPrestador) {
            const portalCol = $app.findCollectionByNameOrId('portal_os')
            const existentes = $app.findRecordsByFilter(
              'portal_os',
              "os_id = '" + osRecord.id + "'",
              '',
              1,
              0,
            )

            let pRec
            if (existentes.length > 0) {
              pRec = existentes[0]
            } else {
              pRec = new Record(portalCol)
            }

            pRec.set('os_id', osRecord.id)
            pRec.set('prestador_email', emailPrestador)
            pRec.set('prestador_id', prestadorId)
            pRec.set('codigo_projeto', projeto.getString('codigo') || 'PRJ')
            pRec.set('numero_os', osRecord.getString('numero'))
            pRec.set('disciplina', osRecord.getString('disciplina') || 'Engenharia')
            pRec.set('escopo_tecnico', osRecord.getString('escopo_tecnico'))
            pRec.set('entregaveis_resumo', osRecord.getString('entregaveis_texto'))
            pRec.set('prazo_dias', osRecord.getInt('prazo_dias') || 0)
            pRec.set('data_inicio', osRecord.getString('data_inicio'))
            pRec.set('data_previsao_fim', osRecord.getString('data_previsao_fim'))
            pRec.set('status', osRecord.getString('status'))
            pRec.set('valor_os', osRecord.getFloat('valor_os') || 0)
            pRec.set('token_assinatura', osRecord.getString('token_assinatura'))

            $app.save(pRec)
          }
        }
      }
    }
  } catch (err) {
    console.log('Erro ao sincronizar portal_os no update: ' + err)
  } finally {
    e.next()
  }
})

// Endpoint para assinar Ordem de Serviço pelo Prestador
routerAdd('POST', '/backend/v1/ordens-servico/{id}/assinar-prestador', (e) => {
  try {
    const osId = e.request.pathValue('id')
    if (!osId) {
      return e.json(400, { error: 'ID da OS não informado' })
    }

    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = (body.token || '').trim()
    const declaracao = !!body.declaracao
    const nomeAssinante = (body.nome || '').trim()
    const docAssinante = (body.documento || '').trim()

    if (!declaracao) {
      return e.json(400, {
        error: 'É obrigatório marcar a declaração de concordância com os termos da OS.',
      })
    }

    let osRec
    try {
      osRec = $app.findRecordById('ordens_servico', osId)
    } catch (_) {
      return e.json(404, { error: 'Ordem de Serviço não encontrada' })
    }

    const tokenEsperado = osRec.getString('token_assinatura')
    const authUser = reqInfo.auth

    let autorizado = false
    if (token && tokenEsperado && token === tokenEsperado) {
      autorizado = true
    } else if (authUser) {
      const prestadorId = osRec.getString('prestador')
      const prestador = $app.findRecordById('prestadores', prestadorId)
      if (
        prestador &&
        (prestador.getString('email') === authUser.getString('email') ||
          authUser.getString('role') === 'admin')
      ) {
        autorizado = true
      }
    }

    if (!autorizado) {
      return e.json(403, { error: 'Token de assinatura inválido ou não autorizado' })
    }

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    const hashAssinatura = $security.hs256(
      osRec.id + '|' + osRec.getString('numero') + '|' + new Date().toISOString() + '|' + clientIp,
      'gmais-os-signature-secret',
    )

    osRec.set('status', 'assinada')
    osRec.set('assinante_prestador_nome', nomeAssinante || 'Prestador Autorizado')
    osRec.set('assinante_prestador_doc', docAssinante)
    osRec.set('data_assinatura_prestador', new Date().toISOString())
    osRec.set('prestador_ip', clientIp)
    osRec.set('prestador_hash', hashAssinatura)

    // Se for OS externa com parcelas e sem contas geradas, gerar contas a pagar
    if (osRec.getString('tipo_prestador') === 'externo') {
      const parcelas = osRec.get('parcelas_json')
      if (Array.isArray(parcelas) && parcelas.length > 0) {
        try {
          const contasCol = $app.findCollectionByNameOrId('contas')
          const contasExistentes = $app.findRecordsByFilter(
            'contas',
            "ordem_servico = '" + osRec.id + "'",
            '',
            1,
            0,
          )
          if (contasExistentes.length === 0) {
            for (let i = 0; i < parcelas.length; i++) {
              const p = parcelas[i]
              const cRec = new Record(contasCol)
              cRec.set('tipo', 'pagar')
              cRec.set('categoria', 'subcontratados')
              cRec.set(
                'descricao',
                'OS ' + osRec.getString('numero') + ' - ' + (p.descricao || 'Parcela'),
              )
              cRec.set('valor', p.valor || 0)
              cRec.set('vencimento', p.vencimento || new Date().toISOString().substring(0, 10))
              cRec.set('status', 'a_vencer')
              cRec.set('projeto', osRec.getString('projeto'))
              cRec.set('ordem_servico', osRec.id)
              $app.save(cRec)
            }
          }
        } catch (eConta) {
          console.log('Erro ao gerar contas da OS: ' + eConta)
        }
      }
    }

    $app.save(osRec)

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', authUser ? authUser.id : null)
      aRec.set('user_email', authUser ? authUser.getString('email') : 'PRESTADOR_EXTERNO')
      aRec.set('acao', 'ASSINATURA_ORDEM_SERVICO')
      aRec.set('entidade', 'ordens_servico')
      aRec.set('registro_id', osRec.id)
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        numero_os: osRec.getString('numero'),
        assinante: nomeAssinante,
        documento: docAssinante,
        hash: hashAssinatura,
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      numero: osRec.getString('numero'),
      status: osRec.getString('status'),
      data_assinatura: osRec.getString('data_assinatura_prestador'),
    })
  } catch (err) {
    console.log('Erro ao assinar OS: ' + err)
    return e.json(500, { error: 'Erro ao assinar Ordem de Serviço: ' + err })
  }
})

// Endpoint de assinatura de Contrato-Mestre pelo Prestador
routerAdd('POST', '/backend/v1/contratos-mestre/{id}/assinar-prestador', (e) => {
  try {
    const cmId = e.request.pathValue('id')
    if (!cmId) {
      return e.json(400, { error: 'ID do Contrato-Mestre não informado' })
    }

    const reqInfo = e.requestInfo()
    const body = reqInfo.body || {}
    const token = (body.token || '').trim()
    const nomeAssinante = (body.nome || '').trim()
    const docAssinante = (body.documento || '').trim()

    let cmRec
    try {
      cmRec = $app.findRecordById('contratos_mestre', cmId)
    } catch (_) {
      return e.json(404, { error: 'Contrato-Mestre não encontrado' })
    }

    const dataGmais = cmRec.getString('data_assinatura_gmais')
    if (!dataGmais) {
      return e.json(400, {
        error:
          'BLOQUEIO: O Contrato-Mestre só pode ser assinado pelo prestador após a assinatura da G+ Engenharia.',
      })
    }

    const tokenEsperado = cmRec.getString('token_assinatura')
    const authUser = reqInfo.auth

    let autorizado = false
    if (token && tokenEsperado && token === tokenEsperado) {
      autorizado = true
    } else if (authUser) {
      const prestadorId = cmRec.getString('prestador')
      const prestador = $app.findRecordById('prestadores', prestadorId)
      if (
        prestador &&
        (prestador.getString('email') === authUser.getString('email') ||
          authUser.getString('role') === 'admin')
      ) {
        autorizado = true
      }
    }

    if (!autorizado) {
      return e.json(403, { error: 'Token inválido ou não autorizado' })
    }

    const clientIp =
      (e.request &&
        typeof e.request.getHeader === 'function' &&
        (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
      (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
      '127.0.0.1'

    const hashAssinatura = $security.hs256(
      cmRec.id + '|' + cmRec.getString('numero') + '|' + new Date().toISOString() + '|' + clientIp,
      'gmais-cm-signature-secret',
    )

    cmRec.set('status', 'assinado')
    cmRec.set('assinante_prestador_nome', nomeAssinante || 'Prestador Autorizado')
    cmRec.set('assinante_prestador_doc', docAssinante)
    cmRec.set('data_assinatura_prestador', new Date().toISOString())
    cmRec.set('prestador_ip', clientIp)
    cmRec.set('prestador_hash', hashAssinatura)
    $app.save(cmRec)

    // Auditoria
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', authUser ? authUser.id : null)
      aRec.set('user_email', authUser ? authUser.getString('email') : 'PRESTADOR_EXTERNO')
      aRec.set('acao', 'ASSINATURA_CONTRATO_MESTRE')
      aRec.set('entidade', 'contratos_mestre')
      aRec.set('registro_id', cmRec.id)
      aRec.set('ip', clientIp)
      aRec.set('detalhes', {
        numero: cmRec.getString('numero'),
        assinante: nomeAssinante,
        hash: hashAssinatura,
      })
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      numero: cmRec.getString('numero'),
      status: cmRec.getString('status'),
    })
  } catch (err) {
    console.log('Erro ao assinar Contrato Mestre: ' + err)
    return e.json(500, { error: 'Erro ao assinar Contrato Mestre: ' + err })
  }
})

// Endpoint de assinatura do Contrato Mestre pelo Admin G+
routerAdd(
  'POST',
  '/backend/v1/contratos-mestre/{id}/assinar-gmais',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth
      if (!authUser || authUser.getString('role') !== 'admin') {
        return e.json(403, { error: 'Apenas Administradores podem assinar pela G+ Engenharia.' })
      }

      const cmId = e.request.pathValue('id')
      let cmRec
      try {
        cmRec = $app.findRecordById('contratos_mestre', cmId)
      } catch (_) {
        return e.json(404, { error: 'Contrato Mestre não encontrado' })
      }

      const clientIp =
        (e.request &&
          typeof e.request.getHeader === 'function' &&
          (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
        (reqInfo.headers && (reqInfo.headers['x-forwarded-for'] || reqInfo.headers['x-real-ip'])) ||
        '127.0.0.1'

      const hashAssinatura = $security.hs256(
        cmRec.id + '|GMAIS|' + new Date().toISOString() + '|' + clientIp,
        'gmais-cm-signature-secret',
      )

      cmRec.set('assinante_gmais', authUser.id)
      cmRec.set('data_assinatura_gmais', new Date().toISOString())
      cmRec.set('gmais_ip', clientIp)
      cmRec.set('gmais_hash', hashAssinatura)
      cmRec.set('status', 'aguardando_assinatura_prestador')
      $app.save(cmRec)

      return e.json(200, {
        sucesso: true,
        status: cmRec.getString('status'),
        data_assinatura: cmRec.getString('data_assinatura_gmais'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao assinar pela G+: ' + err })
    }
  },
  $apis.requireAuth(),
)
