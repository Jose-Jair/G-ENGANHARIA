// Hook para gerenciar operações de exclusão e anonimização LGPD de Cliente PF
// Regra do projeto:
// 1. Exclusão restrita a Admin no servidor/banco.
// 2. Se cliente PF tiver propostas vinculadas -> Não excluir no banco, fazer ANONIMIZAÇÃO LGPD:
//    - Manter registros financeiros/contratuais coerentes
//    - Apagar CPF, telefones, e-mail e endereço
//    - Substituir nome por "Cliente removido a pedido (LGPD)"
//    - Gerar evento de auditoria: ANONIMIZACAO_CLIENTE_PF
// 3. Se cliente PF NÃO tiver propostas vinculadas -> Exclusão física permanente
//    - Gerar evento de auditoria: EXCLUSAO_CLIENTE_PF
// 4. Endpoint dedicado /backend/v1/clientes-pf/{id}/excluir-ou-anonimizar (POST)

routerAdd('POST', '/backend/v1/clientes-pf/{id}/excluir-ou-anonimizar', (e) => {
  // 1. Autenticação e perfil Admin
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Autenticação necessária.' })
  }

  const role = authRecord.getString('role')
  if (role !== 'admin') {
    return e.json(403, {
      message: 'Apenas usuários com perfil Administrador podem excluir ou anonimizar clientes PF.',
    })
  }

  const clienteId = e.request.pathValue('id')
  if (!clienteId) {
    return e.json(400, { message: 'ID do cliente PF é obrigatório.' })
  }

  let cliente
  try {
    cliente = $app.findRecordById('clientes_pf', clienteId)
  } catch (_) {
    return e.json(404, { message: 'Cliente PF não encontrado.' })
  }

  // 2. Ler confirmação do payload (digitação do nome)
  let confirmacaoNome = ''
  try {
    const body = e.requestInfo().body || {}
    confirmacaoNome = (body.confirmacao_nome || '').trim()
  } catch (_) {}

  const nomeAtual = (cliente.getString('nome') || '').trim()
  if (!confirmacaoNome || confirmacaoNome.toLowerCase() !== nomeAtual.toLowerCase()) {
    return e.json(400, {
      message:
        'Confirmação inválida. É obrigatório digitar o nome exato do cliente para confirmar.',
    })
  }

  // 3. Verificar se há propostas vinculadas a este cliente_pf
  let propostas = []
  try {
    propostas = $app.findRecordsByFilter(
      'propostas',
      "cliente_pf = '" + clienteId + "'",
      '-created',
      50,
      0,
    )
  } catch (errProp) {
    console.log('Erro ao buscar propostas do cliente PF: ' + errProp)
  }

  const temPropostas = propostas && propostas.length > 0

  let remoteIP = ''
  try {
    const reqInfo = e.requestInfo()
    if (reqInfo) remoteIP = reqInfo.remoteIP || ''
  } catch (_) {}

  const auditCol = $app.findCollectionByNameOrId('audit_logs')

  if (temPropostas) {
    // CENÁRIO A: ANONIMIZAÇÃO LGPD
    // Manter ID e coerência relacional, mas apagar dados pessoais identificáveis
    const dadosAnteriores = {
      nome: cliente.getString('nome'),
      cpf: cliente.getString('cpf'),
      email: cliente.getString('email'),
      telefone: cliente.getString('telefone'),
      telefones: cliente.get('telefones'),
      endereco: cliente.getString('endereco'),
      cep: cliente.getString('cep'),
      logradouro: cliente.getString('logradouro'),
      numero: cliente.getString('numero'),
      complemento: cliente.getString('complemento'),
      bairro: cliente.getString('bairro'),
      municipio: cliente.getString('municipio'),
      uf: cliente.getString('uf'),
    }

    cliente.set('nome', 'Cliente removido a pedido (LGPD)')
    cliente.set('cpf', '')
    cliente.set('email', '')
    cliente.set('telefone', '')
    cliente.set('telefones', [])
    cliente.set('endereco', '')
    cliente.set('cep', '')
    cliente.set('logradouro', '')
    cliente.set('numero', '')
    cliente.set('complemento', '')
    cliente.set('bairro', '')
    cliente.set('municipio', '')
    cliente.set('uf', '')
    cliente.set(
      'observacoes',
      (cliente.getString('observacoes') || '') +
        '\n[LGPD]: Dados pessoais apagados e anonimizados por solicitação do titular em ' +
        new Date().toISOString() +
        '. Registros de propostas (' +
        propostas.length +
        ') preservados para conformidade fiscal/contratual.',
    )

    $app.save(cliente)

    // Registrar auditoria específica ANONIMIZACAO_CLIENTE_PF
    try {
      const aRec = new Record(auditCol)
      aRec.set('user', authRecord.id)
      aRec.set('user_email', authRecord.getString('email'))
      aRec.set('acao', 'ANONIMIZACAO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf')
      aRec.set('registro_id', clienteId)
      aRec.set('detalhes', {
        tipo_acao: 'ANONIMIZACAO_LGPD',
        motivo:
          'Cliente com propostas vinculadas. Dados pessoais removidos e nome substituído conforme LGPD.',
        propostas_vinculadas_qtd: propostas.length,
        propostas_numeros: propostas.map((p) => p.getString('numero')),
        dados_apagados: ['cpf', 'telefones', 'email', 'endereco', 'cep'],
        nome_substituto: 'Cliente removido a pedido (LGPD)',
        nome_anterior: dadosAnteriores.nome,
      })
      aRec.set('ip', remoteIP)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao registrar auditoria de anonimizacao: ' + errAudit)
    }

    return e.json(200, {
      acao: 'anonimizado',
      mensagem:
        'Cliente PF possui propostas vinculadas. O cadastro foi devidamente anonimizado em conformidade com a LGPD (dados de CPF, telefones, e-mail e endereço apagados, nome substituído).',
      cliente_id: clienteId,
      propostas_vinculadas: propostas.length,
    })
  } else {
    // CENÁRIO B: EXCLUSÃO PERMANENTE REAL
    const dadosExcluidos = {
      nome: cliente.getString('nome'),
      cpf: cliente.getString('cpf'),
      email: cliente.getString('email'),
    }

    $app.delete(cliente)

    // Registrar auditoria específica EXCLUSAO_CLIENTE_PF
    try {
      const aRec = new Record(auditCol)
      aRec.set('user', authRecord.id)
      aRec.set('user_email', authRecord.getString('email'))
      aRec.set('acao', 'EXCLUSAO_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf')
      aRec.set('registro_id', clienteId)
      aRec.set('detalhes', {
        tipo_acao: 'EXCLUSAO_DEFINITIVA',
        motivo:
          'Cliente sem propostas vinculadas. Registro excluído definitivamente pelo Administrador.',
        dados_excluidos: dadosExcluidos,
      })
      aRec.set('ip', remoteIP)
      $app.save(aRec)
    } catch (errAudit) {
      console.log('Erro ao registrar auditoria de exclusao: ' + errAudit)
    }

    return e.json(200, {
      acao: 'excluido',
      mensagem: 'Cliente PF excluído permanentemente com sucesso (sem propostas vinculadas).',
      cliente_id: clienteId,
    })
  }
})

// Reforço no hook onRecordDelete para clientes_pf:
// Se um usuário não-Admin tentar invocar delete direto, barrar;
// Se o cliente tiver propostas vinculadas, impedir exclusão física direta e orientar uso do fluxo de anonimização.
onRecordDelete((e) => {
  const rec = e.record
  if (rec.collection().name !== 'clientes_pf') {
    e.next()
    return
  }

  // Verificar se quem está chamando é Admin
  let isAdmin = false
  try {
    const reqInfo = e.requestInfo()
    if (reqInfo && reqInfo.auth && reqInfo.auth.getString('role') === 'admin') {
      isAdmin = true
    }
  } catch (_) {}

  // Se não for admin, recusar
  if (!isAdmin) {
    throw new BadRequestError(
      'Apenas usuários com perfil Administrador podem excluir registros de clientes PF.',
    )
  }

  // Se tiver propostas, não permitir delete físico direto; deve usar a anonimização LGPD
  try {
    const propostas = $app.findRecordsByFilter(
      'propostas',
      "cliente_pf = '" + rec.id + "'",
      '-created',
      1,
      0,
    )
    if (propostas && propostas.length > 0) {
      throw new BadRequestError(
        'Este cliente PF possui propostas vinculadas e não pode ser excluído fisicamente para manter a integridade fiscal/contratual. Utilize o fluxo de Anonimização LGPD.',
      )
    }
  } catch (err) {
    if (err && err.message && err.message.includes('Anonimização LGPD')) {
      throw err
    }
  }

  e.next()
}, 'clientes_pf')
