// Hook para gerenciar operações de exclusão e anonimização LGPD de Cliente PF
// Regra do projeto:
// 1. Exclusão restrita a Admin no servidor/banco.
// 2. Se cliente PF tiver propostas vinculadas -> Não excluir no banco, fazer ANONIMIZAÇÃO LGPD:
//    - Manter registros financeiros/contratuais coerentes
//    - Apagar CPF, telefones, e-mail e endereço
//    - Substituir nome por "Cliente removido a pedido (LGPD)"
//    - Gerar evento de auditoria: ANONIMIZACAO_CLIENTE_PF
// 3. Se cliente PF NÃO tiver propostas vinculadas -> Exclusão física permanente
//    - Dependentes apagados ANTES do cliente, em UMA transação (convites -> espelho
//      em empresas e seus dependentes -> notificações -> cliente), pois o PocketBase
//      recusa apagar registro referenciado por relação obrigatória sem cascade (erro 400).
//    - Gerar evento de auditoria: EXCLUSAO_CLIENTE_PF
// 4. Endpoint dedicado /backend/v1/clientes-pf/{id}/excluir-ou-anonimizar (POST)

routerAdd('POST', '/backend/v1/clientes-pf/{id}/excluir-ou-anonimizar', (e) => {
  // Handler inteiro em try/catch: qualquer falha responde JSON com 'message' real
  // em português (nunca "Something went wrong") e grava em erros_sistema.
  try {
    // 1. Autenticação e perfil Admin
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Autenticação necessária.' })
    }

    const role = authRecord.getString('role')
    if (role !== 'admin') {
      return e.json(403, {
        message:
          'Apenas usuários com perfil Administrador podem excluir ou anonimizar clientes PF.',
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

    // Mensagem de validação de negócio (ex.: espelho com propostas) — propagada como 400
    // com texto real ao front; distinta de falhas técnicas (500 genérico).
    let erroValidacaoMsg = ''

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

    // IP real via headers (PB v0.23: requestInfo() NÃO tem remoteIP — padrão do projeto)
    let remoteIP = ''
    try {
      remoteIP =
        (e.request &&
          e.request.getHeader &&
          (e.request.getHeader('x-forwarded-for') || e.request.getHeader('x-real-ip'))) ||
        (e.requestInfo().headers &&
          (e.requestInfo().headers['x-forwarded-for'] || e.requestInfo().headers['x-real-ip'])) ||
        ''
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
      // Ordem obrigatória dentro de UMA transação (ou apaga tudo, ou nada):
      //   (a) convites de cadastro (clientes_pf_convites.cliente_pf)
      //   (b) empresa espelho (empresas.cliente_pf_ref) e seus dependentes sem propostas
      //   (c) notificações ligadas ao cliente/espelho/convites
      //   (d) por último, o cliente
      // O PocketBase recusa apagar registro referenciado por relação obrigatória
      // sem cascade (erro 400) — por isso dependentes saem ANTES do cliente.
      const dadosExcluidos = {
        nome: cliente.getString('nome'),
        cpf: cliente.getString('cpf'),
        email: cliente.getString('email'),
      }

      const removidos = {
        clientes_pf_convites: [],
        empresas_espelho: [],
        dependentes_espelho: {},
        notificacoes: [],
        clientes_pf: [clienteId],
      }

      $app.runInTransaction(($app) => {
        // Helpers inline no callback (sem variáveis fora do escopo — padrão do projeto).
        // O parâmetro $app sombreia o global dentro da transação: todas as operações
        // abaixo usam a conexão da transação (padrão PocketBase runInTransaction).
        function coletarParaExclusao(colecao, filtro) {
          try {
            return $app.findRecordsByFilter(colecao, filtro, '-id', 500, 0)
          } catch (errBusca) {
            console.log('Aviso ao buscar ' + colecao + ' para exclusão do cliente PF: ' + errBusca)
            return []
          }
        }

        function apagarTodos(registros) {
          for (let i = 0; i < registros.length; i++) {
            $app.delete(registros[i])
          }
        }

        // (a) Convites de cadastro do cliente (relação obrigatória clientes_pf_convites.cliente_pf)
        const convites = $app.findRecordsByFilter(
          'clientes_pf_convites',
          "cliente_pf = '" + clienteId + "'",
          '-id',
          500,
          0,
        )
        for (let i = 0; i < convites.length; i++) {
          removidos.clientes_pf_convites.push(convites[i].id)
        }
        apagarTodos(convites)

        // (b) Empresa espelho + dependentes do espelho SEM propostas
        const espelhos = $app.findRecordsByFilter(
          'empresas',
          "cliente_pf_ref = '" + clienteId + "'",
          '-id',
          500,
          0,
        )
        for (let i = 0; i < espelhos.length; i++) {
          const espelho = espelhos[i]
          removidos.empresas_espelho.push(espelho.id)

          // Só apaga fisicamente o espelho deste cliente (relação cliente_pf_ref, tipo pf)
          const refEspelho = (espelho.getString('cliente_pf_ref') || '').trim()
          const tipoEspelho = (espelho.getString('tipo_cliente') || '').trim()
          if (refEspelho !== clienteId || (tipoEspelho && tipoEspelho !== 'pf')) {
            erroValidacaoMsg =
              'A empresa vinculada a este cliente PF não é um espelho do tipo Pessoa Física e não pode ser excluída automaticamente. Verifique o cadastro da empresa antes de excluir o cliente.'
            throw new Error(erroValidacaoMsg)
          }

          // Espelho com propostas/contratos não pode sair fisicamente (integridade fiscal)
          const propsEspelho = coletarParaExclusao('propostas', "empresa = '" + espelho.id + "'")
          if (propsEspelho && propsEspelho.length > 0) {
            erroValidacaoMsg =
              'A empresa espelho deste cliente possui propostas vinculadas e não pode ser excluída fisicamente para manter a integridade fiscal/contratual. Utilize o fluxo de Anonimização LGPD.'
            throw new Error(erroValidacaoMsg)
          }
          const contratosEspelho = coletarParaExclusao(
            'contratos',
            "empresa = '" + espelho.id + "'",
          )
          if (contratosEspelho && contratosEspelho.length > 0) {
            erroValidacaoMsg =
              'A empresa espelho deste cliente possui contratos públicos vinculados e não pode ser excluída fisicamente. Utilize o fluxo de Anonimização LGPD.'
            throw new Error(erroValidacaoMsg)
          }

          // Dependentes do espelho (relações obrigatórias com empresas) primeiro
          const dependentesEspelho = [
            'nao_contatar',
            'campanha_envios',
            'toques',
            'contatos',
            'reativacoes_sugeridas',
          ]
          for (let d = 0; d < dependentesEspelho.length; d++) {
            const colDep = dependentesEspelho[d]
            const registrosDep = coletarParaExclusao(colDep, "empresa = '" + espelho.id + "'")
            if (registrosDep && registrosDep.length > 0) {
              removidos.dependentes_espelho[colDep] = registrosDep.map((r) => r.id)
              apagarTodos(registrosDep)
            }
          }

          $app.delete(espelho)
        }

        // (c) Notificações ligadas ao cliente, espelho ou convites
        const idsReferencia = [clienteId]
          .concat(removidos.empresas_espelho)
          .concat(removidos.clientes_pf_convites)
        for (let i = 0; i < idsReferencia.length; i++) {
          const notificacoes = coletarParaExclusao(
            'notificacoes',
            "referencia_id = '" + idsReferencia[i] + "'",
          )
          for (let n = 0; n < notificacoes.length; n++) {
            removidos.notificacoes.push(notificacoes[n].id)
          }
          apagarTodos(notificacoes)
        }

        // (d) Por último, o cliente
        $app.delete(cliente)
      })

      // Auditoria EXCLUSAO_CLIENTE_PF: lista do que saiu (ids por coleção), usuário e data
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
            'Cliente sem propostas vinculadas. Registro e dependentes excluídos definitivamente pelo Administrador.',
          dados_excluidos: dadosExcluidos,
          registros_removidos: removidos,
          colecoes_afetadas: ['clientes_pf_convites', 'empresas', 'notificacoes', 'clientes_pf'],
          data_exclusao: new Date().toISOString(),
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
        registros_removidos: {
          convites: removidos.clientes_pf_convites.length,
          empresas_espelho: removidos.empresas_espelho.length,
          notificacoes: removidos.notificacoes.length,
        },
      })
    }
  } catch (errRota) {
    // Mensagem real do erro, sempre em português e compreensível
    const detalheBruto = (errRota && (errRota.message || String(errRota))) || 'erro desconhecido'
    const statusResposta = erroValidacaoMsg ? 400 : 500
    const mensagem = erroValidacaoMsg
      ? detalheBruto
      : 'Não foi possível excluir o cliente PF. ' +
        (/[Ff]oreign [Kk]ey|constraint|referenci/.test(detalheBruto)
          ? 'Existem registros vinculados a este cliente que impedem a exclusão.'
          : 'Ocorreu um erro inesperado no servidor. Tente novamente em instantes.')

    // Registro em erros_sistema (sem dados pessoais — só rota, usuário e mensagem técnica)
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', '/backend/v1/clientes-pf/{id}/excluir-ou-anonimizar')
        errRec.set('mensagem', mensagem.slice(0, 1000))
        errRec.set('usuario', authRecord ? authRecord.id : null)
        errRec.set('usuario_email', authRecord ? authRecord.getString('email') : '')
        errRec.set('ip', remoteIP)
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', { erro: detalheBruto.slice(0, 1000) })
        $app.save(errRec)
      }
    } catch (_) {}

    return e.json(statusResposta, {
      message: mensagem,
      error: mensagem,
      erro: mensagem,
      detalhe: detalheBruto.slice(0, 200),
    })
  }
})

// ---------------------------------------------------------------------------
// Hook de REQUISIÇÃO (DELETE /api/collections/clientes_pf/records/{id}):
// checagem de permissão — somente Admin pode excluir cliente PF direto pela API.
// Fica aqui (e não no hook de MODELO) porque e.auth só existe no contexto HTTP
// de requisição; em rotas internas ($app.delete) hooks de MODELO rodam sem ele.
onRecordDeleteRequest((e) => {
  const auth = e.auth
  const isAdmin = !!auth && auth.getString('role') === 'admin'
  if (!isAdmin) {
    throw new ForbiddenError(
      'Apenas usuários com perfil Administrador podem excluir registros de clientes PF.',
    )
  }
  e.next()
}, 'clientes_pf')

// ---------------------------------------------------------------------------
// Hook de MODELO (vale sempre, inclusive nas rotas internas): regra de negócio —
// cliente PF com propostas vinculadas não sai fisicamente do banco (LGPD/
// integridade fiscal). Sem checagem de permissão aqui: em rotas internas não
// existe contexto HTTP para decidir permissão.
onRecordDelete((e) => {
  const cliente = e.record
  let propostasVinculadas = []
  try {
    propostasVinculadas = $app.findRecordsByFilter(
      'propostas',
      "cliente_pf = '" + cliente.id + "'",
      '-created',
      1,
      0,
    )
  } catch (errBusca) {
    console.log('Erro ao verificar propostas na exclusão de cliente PF: ' + errBusca)
  }
  if (propostasVinculadas && propostasVinculadas.length > 0) {
    throw new BadRequestError(
      'Cliente PF possui propostas vinculadas e não pode ser excluído fisicamente. Utilize o fluxo de Anonimização LGPD.',
    )
  }
  e.next()
}, 'clientes_pf')
