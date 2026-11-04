/**
 * Hook de Segurança - Lote 1 (C1, M1, M4)
 * - C1: Whitelist estrita de campos em updates sem autenticação (token público) para propostas e contratos_servico;
 *       Bloqueio de alteração de conteúdo via API em documentos já formalizados/assinados bilateralmente.
 * - M1: Perfis não-admin (financeiro, gestor, comercial, executor) não podem alterar campos de assinatura e auditoria via API.
 * - M4: erros_sistema: limitação de tamanho dos campos em onRecordCreateRequest para prevenir payloads abusivos.
 *
 * Todas as variáveis, listas e helpers são 100% INLINE dentro de cada callback para evitar Hook Scoping Error na VM do PocketBase.
 */

// -----------------------------------------------------------------------------
// 1. C1 + M1: Proteção de Atualização de Propostas via API
// -----------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const rec = e.record
  if (!rec || rec.collection().name !== 'propostas') {
    e.next()
    return
  }

  const reqInfo = e.requestInfo ? e.requestInfo() : null
  const auth = reqInfo ? reqInfo.auth : null
  const body = reqInfo && reqInfo.body && typeof reqInfo.body === 'object' ? reqInfo.body : {}
  const submittedKeys = Object.keys(body)
  const orig = rec.original ? rec.original() : null

  // Bloqueio de alteração de conteúdo via API se a proposta já estiver aceita
  if (orig && orig.getString('status') === 'aceita') {
    const camposConteudo = [
      'valor_total',
      'preco',
      'custo_total',
      'custo_direto',
      'margem_lucro',
      'impostos',
      'itens_json',
      'clausulas_padrao',
      'numero',
      'empresa',
      'cliente_pf',
      'token_aceite',
      'revisao',
      'condicoes_pagamento',
      'prazo_execucao',
    ]
    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposConteudo.indexOf(k) !== -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }
  }

  // CASO A: Requisição SEM AUTENTICAÇÃO (Acesso Público com token)
  if (!auth) {
    const tokenOriginal = orig ? orig.getString('token_aceite') : rec.getString('token_aceite')
    if (!tokenOriginal) {
      throw new BadRequestError('Campo não permitido')
    }

    const whitelistPublico = [
      'status',
      'data_visualizacao',
      'motivo_recusa',
      'detalhe_recusa',
      'data_recusa',
      'data_aceite',
      'aceite_declaracao',
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'aceite_status',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
      'solicitacao_alteracao_texto',
      'data_solicitacao_alteracao',
      'historico_devolutivas',
      'dados_complementares_preenchidos',
    ]

    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (whitelistPublico.indexOf(k) === -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }

    // Regra WRITE-ONCE (Lote 2): campos de aceite via token público só podem ser preenchidos se o valor ATUAL estiver vazio
    const camposWriteOnceProposta = [
      'data_aceite',
      'aceite_declaracao',
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'aceite_status',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
    ]

    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposWriteOnceProposta.indexOf(k) !== -1) {
        let valAtual = ''
        if (orig) {
          try {
            const raw = orig.get(k)
            if (raw !== null && raw !== undefined) {
              if (typeof raw === 'boolean') {
                valAtual = raw ? 'true' : ''
              } else if (typeof raw === 'object') {
                const s = JSON.stringify(raw)
                valAtual = s === '{}' || s === '[]' || s === 'null' ? '' : s
              } else {
                valAtual = String(raw).trim()
              }
            }
          } catch (_) {
            valAtual = orig.getString(k)
          }
        }
        if (valAtual !== '') {
          throw new BadRequestError('Campo não permitido')
        }
      }
    }

    if (body.status !== undefined) {
      const statusPermitidos = ['visualizada', 'recusada', 'aceita', 'em_negociacao']
      if (statusPermitidos.indexOf(String(body.status)) === -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }

    e.next()
    return
  }

  // CASO B: Requisição AUTENTICADA (M1 - Perfis não-admin não podem alterar assinatura/auditoria)
  const role = auth.getString('role')
  if (role !== 'admin') {
    const camposAssinatura = [
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'aceite_declaracao',
      'data_aceite',
      'aceite_status',
      'versao_texto_hash',
      'pdf_congelado_hash',
    ]
    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposAssinatura.indexOf(k) !== -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }
  }

  e.next()
}, 'propostas')

// -----------------------------------------------------------------------------
// 2. C1 + M1: Proteção de Atualização de Contratos de Serviço via API
// -----------------------------------------------------------------------------
onRecordUpdateRequest((e) => {
  const rec = e.record
  if (!rec || rec.collection().name !== 'contratos_servico') {
    e.next()
    return
  }

  const reqInfo = e.requestInfo ? e.requestInfo() : null
  const auth = reqInfo ? reqInfo.auth : null
  const body = reqInfo && reqInfo.body && typeof reqInfo.body === 'object' ? reqInfo.body : {}
  const submittedKeys = Object.keys(body)
  const orig = rec.original ? rec.original() : null

  // Bloqueio de alteração de conteúdo via API se o contrato já estiver assinado por ambas as partes
  const assinadoCliente = orig ? Boolean(orig.getString('data_assinatura_cliente')) : false
  const assinadoAdmin = orig ? Boolean(orig.getString('data_assinatura_admin')) : false
  const statusAssinado = orig ? orig.getString('status') === 'assinado' : false
  const isBilateral = (assinadoCliente && assinadoAdmin) || statusAssinado

  if (isBilateral) {
    const camposConteudoContrato = [
      'valor_total',
      'objeto',
      'prazo_dias',
      'nota_prazo',
      'clausulas_texto',
      'parcelas_json',
      'numero',
      'empresa',
      'cliente_pf',
      'proposta',
      'token_assinatura_cliente',
      'token_complemento_dados',
      'data_assinatura_cliente',
      'data_assinatura_admin',
      'cliente_hash',
      'admin_hash',
      'cliente_nome_assinante',
      'cliente_documento_assinante',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
    ]
    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposConteudoContrato.indexOf(k) !== -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }
  }

  // CASO A: Requisição SEM AUTENTICAÇÃO (Acesso Público com token)
  if (!auth) {
    const tokenAssinatura = orig
      ? orig.getString('token_assinatura_cliente')
      : rec.getString('token_assinatura_cliente')
    const tokenComplemento = orig
      ? orig.getString('token_complemento_dados')
      : rec.getString('token_complemento_dados')
    if (!tokenAssinatura && !tokenComplemento) {
      throw new BadRequestError('Campo não permitido')
    }

    const whitelistPublicoContrato = [
      'status',
      'cliente_nome_assinante',
      'cliente_documento_assinante',
      'data_assinatura_cliente',
      'cliente_ip',
      'cliente_user_agent',
      'cliente_declaracao',
      'cliente_hash',
      'aceite_status',
      'data_aceite',
      'aceite_ip',
      'aceite_user_agent',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
      'token_usado',
      'data_uso_token',
      'codigo_tentativas',
      'campos_faltantes_json',
      'dados_completados_em',
    ]

    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (whitelistPublicoContrato.indexOf(k) === -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }

    // Regra WRITE-ONCE (Lote 2): campos de assinatura/aceite cliente via token público só podem ser preenchidos se o valor ATUAL estiver vazio
    const camposWriteOnceContrato = [
      'cliente_hash',
      'data_assinatura_cliente',
      'cliente_nome_assinante',
      'cliente_documento_assinante',
      'cliente_ip',
      'cliente_user_agent',
      'cliente_declaracao',
      'aceite_status',
      'data_aceite',
      'aceite_ip',
      'aceite_user_agent',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
    ]

    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposWriteOnceContrato.indexOf(k) !== -1) {
        let valAtual = ''
        if (orig) {
          try {
            const raw = orig.get(k)
            if (raw !== null && raw !== undefined) {
              if (typeof raw === 'boolean') {
                valAtual = raw ? 'true' : ''
              } else if (typeof raw === 'object') {
                const s = JSON.stringify(raw)
                valAtual = s === '{}' || s === '[]' || s === 'null' ? '' : s
              } else {
                valAtual = String(raw).trim()
              }
            }
          } catch (_) {
            valAtual = orig.getString(k)
          }
        }
        if (valAtual !== '') {
          throw new BadRequestError('Campo não permitido')
        }
      }
    }

    if (body.status !== undefined) {
      const statusPermitidos = [
        'aguardando_assinatura_admin',
        'aguardando_assinatura_cliente',
        'assinado',
      ]
      if (statusPermitidos.indexOf(String(body.status)) === -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }

    e.next()
    return
  }

  // CASO B: Requisição AUTENTICADA (M1 - Perfis não-admin não podem alterar assinatura/auditoria)
  const role = auth.getString('role')
  if (role !== 'admin') {
    const camposAssinaturaContrato = [
      'cliente_hash',
      'cliente_ip',
      'cliente_user_agent',
      'cliente_declaracao',
      'data_assinatura_cliente',
      'admin_hash',
      'admin_ip',
      'admin_user_agent',
      'admin_declaracao',
      'data_assinatura_admin',
      'assinante_admin',
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'data_aceite',
      'aceite_status',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
    ]
    for (let i = 0; i < submittedKeys.length; i++) {
      const k = submittedKeys[i]
      if (camposAssinaturaContrato.indexOf(k) !== -1) {
        throw new BadRequestError('Campo não permitido')
      }
    }
  }

  e.next()
}, 'contratos_servico')

// -----------------------------------------------------------------------------
// 3. M4: Limitação de tamanho de campos para erros_sistema
// -----------------------------------------------------------------------------
onRecordCreateRequest((e) => {
  const rec = e.record
  if (!rec || rec.collection().name !== 'erros_sistema') {
    e.next()
    return
  }

  const rota = rec.getString('rota')
  if (rota && rota.length > 255) {
    rec.set('rota', rota.slice(0, 255))
  }

  const msg = rec.getString('mensagem')
  if (msg && msg.length > 2000) {
    rec.set('mensagem', msg.slice(0, 2000))
  }

  const email = rec.getString('usuario_email')
  if (email && email.length > 255) {
    rec.set('usuario_email', email.slice(0, 255))
  }

  try {
    const det = rec.get('detalhes')
    if (typeof det === 'string' && det.length > 10000) {
      rec.set('detalhes', det.slice(0, 10000))
    }
  } catch (_) {}

  e.next()
}, 'erros_sistema')
