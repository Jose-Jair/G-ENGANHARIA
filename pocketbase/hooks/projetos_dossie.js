// Hook para geração consolidada do Dossiê do Projeto (ETAPA 10)
// GET /backend/v1/projetos/{id}/dossie-data
// Requer autenticação. Restrito para Admin, Gestor, Financeiro e Comercial (apenas leitura do projeto).
// Executor externo é bloqueado.

routerAdd(
  'GET',
  '/backend/v1/projetos/{id}/dossie-data',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) {
        throw new ForbiddenError('Acesso não autenticado.')
      }

      const role = auth.getString('role') || ''
      if (role === 'executor') {
        throw new ForbiddenError(
          'Executores externos não possuem permissão para acessar o dossiê do projeto.',
        )
      }

      const projetoId = e.requestInfo().pathParams.id
      if (!projetoId) {
        throw new BadRequestError('ID do projeto não informado.')
      }

      const projeto = $app.findRecordById('projetos', projetoId)
      if (!projeto) {
        throw new NotFoundError('Projeto não encontrado.')
      }

      // Cliente
      let clienteNome = 'Cliente não vinculado'
      let clienteDocumento = ''
      let clienteTipo = 'PJ'
      let clienteEmail = ''
      let clienteTelefone = ''

      const empId = projeto.getString('empresa')
      const clientePfId = projeto.getString('cliente_pf')

      if (empId) {
        try {
          const emp = $app.findRecordById('empresas', empId)
          clienteNome = emp.getString('nome_fantasia') || emp.getString('razao_social')
          clienteDocumento = emp.getString('cnpj')
          clienteTipo = 'PJ'
          clienteEmail = emp.getString('email')
          clienteTelefone = emp.getString('telefone')
        } catch (_) {}
      } else if (clientePfId) {
        try {
          const pf = $app.findRecordById('clientes_pf', clientePfId)
          clienteNome = pf.getString('nome')
          clienteDocumento = pf.getString('cpf')
          clienteTipo = 'PF'
          clienteEmail = pf.getString('email')
          clienteTelefone = pf.getString('telefone')
        } catch (_) {}
      }

      // Proposta de Origem
      let propostaInfo = null
      const propostaId = projeto.getString('proposta')
      if (propostaId) {
        try {
          const prop = $app.findRecordById('propostas', propostaId)
          propostaInfo = {
            id: prop.id,
            numero: prop.getString('numero'),
            revisao: prop.getString('revisao'),
            preco: prop.getFloat('preco') || 0,
            custo: prop.getFloat('custo') || 0,
            margem: prop.getFloat('margem') || 0,
            validade: prop.getString('validade'),
            status: prop.getString('status'),
            data_aceite: prop.getString('data_aceite'),
          }
        } catch (_) {}
      }

      // Contrato de Origem (contrato_servico ou contrato de parceiro)
      let contratoInfo = null
      const contratoServicoId = projeto.getString('contrato_servico')
      const contratoId = projeto.getString('contrato')

      if (contratoServicoId) {
        try {
          const ct = $app.findRecordById('contratos_servico', contratoServicoId)
          if (ct) {
            contratoInfo = {
              id: ct.id,
              numero: ct.getString('numero'),
              objeto: ct.getString('objeto'),
              valor: ct.getFloat('valor_total') || 0,
              prazo_dias: ct.getInt('prazo_dias') || 0,
              status: ct.getString('status'),
            }
          }
        } catch (_) {}
      }

      if (!contratoInfo && contratoId) {
        try {
          // Busca em contratos_servico primeiro, caso o id seja de contrato_servico
          let ct = null
          try {
            ct = $app.findRecordById('contratos_servico', contratoId)
            if (ct) {
              contratoInfo = {
                id: ct.id,
                numero: ct.getString('numero'),
                objeto: ct.getString('objeto'),
                valor: ct.getFloat('valor_total') || 0,
                status: ct.getString('status'),
              }
            }
          } catch (_) {}

          if (!contratoInfo) {
            try {
              const ctP = $app.findRecordById('contratos', contratoId)
              if (ctP) {
                contratoInfo = {
                  id: ctP.id,
                  numero: ctP.getString('numero'),
                  orgao: ctP.getString('orgao'),
                  objeto: ctP.getString('objeto'),
                  valor: ctP.getFloat('valor') || 0,
                  vigencia_inicio: ctP.getString('vigencia_inicio'),
                  vigencia_fim: ctP.getString('vigencia_fim'),
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // Etapas do Projeto
      const etapasRecords = $app.findRecordsByFilter(
        'projeto_etapas',
        "projeto = '" + projetoId + "'",
        'ordem,created',
        200,
        0,
      )

      const etapasList = []
      const etapaIds = []
      for (let i = 0; i < etapasRecords.length; i++) {
        const et = etapasRecords[i]
        etapaIds.push(et.id)

        let executorNome = 'Não alocado'
        let executorTipo = ''
        const execId = et.getString('executor')
        if (execId) {
          try {
            const exec = $app.findRecordById('executores', execId)
            executorNome = exec.getString('nome')
            executorTipo = exec.getString('tipo')
          } catch (_) {}
        }

        etapasList.push({
          id: et.id,
          nome: et.getString('nome'),
          disciplina: et.getString('disciplina'),
          tipo_execucao: et.getString('tipo_execucao'),
          prazo: et.getString('prazo'),
          data_inicio: et.getString('data_inicio'),
          data_conclusao: et.getString('data_conclusao'),
          custo_estimado: et.getFloat('custo_estimado') || 0,
          status: et.getString('status'),
          ordem: et.getInt('ordem'),
          executor_nome: executorNome,
          executor_tipo: executorTipo,
          executor_id: execId,
        })
      }

      // Entregáveis das etapas
      const entregaveisList = []
      if (etapaIds.length > 0) {
        const filterEtapas = etapaIds.map((id) => "etapa = '" + id + "'").join(' || ')
        const entregRecords = $app.findRecordsByFilter(
          'entregaveis',
          filterEtapas,
          'created',
          300,
          0,
        )
        for (let i = 0; i < entregRecords.length; i++) {
          const en = entregRecords[i]
          entregaveisList.push({
            id: en.id,
            etapa_id: en.getString('etapa'),
            nome: en.getString('nome'),
            versao: en.getString('versao'),
            status: en.getString('status'),
            data_aprovacao: en.getString('data_aprovacao'),
            observacoes_revisao: en.getString('observacoes_revisao'),
          })
        }
      }

      // Documentos (ART, RRT, OS, Medição)
      const docRecords = $app.findRecordsByFilter(
        'documentos',
        "projeto = '" + projetoId + "'",
        '-created',
        200,
        0,
      )
      const documentosList = []
      const medicoesList = []
      for (let i = 0; i < docRecords.length; i++) {
        const doc = docRecords[i]
        const itemDoc = {
          id: doc.id,
          tipo: doc.getString('tipo'),
          numero: doc.getString('numero'),
          descricao: doc.getString('descricao'),
          responsavel_tecnico: doc.getString('responsavel_tecnico'),
          vencimento: doc.getString('vencimento'),
          created: doc.getString('created'),
          arquivo: doc.getString('arquivo'),
        }
        documentosList.push(itemDoc)
        if (doc.getString('tipo') === 'medicao') {
          medicoesList.push(itemDoc)
        }
      }

      // Riscos Ativos
      const riscoRecords = $app.findRecordsByFilter(
        'riscos',
        "projeto = '" + projetoId + "'",
        'created',
        100,
        0,
      )
      const riscosList = []
      for (let i = 0; i < riscoRecords.length; i++) {
        const r = riscoRecords[i]
        riscosList.push({
          id: r.id,
          descricao: r.getString('descricao'),
          probabilidade: r.getString('probabilidade'),
          impacto: r.getString('impacto'),
          mitigacao: r.getString('mitigacao'),
          status: r.getString('status'),
        })
      }

      // Síntese Financeira: Contas a receber e Contas a pagar do projeto
      let totalContratado =
        projeto.getFloat('valor_total') || (propostaInfo ? propostaInfo.preco : 0)
      let totalRecebido = 0
      let totalAReceber = 0
      let totalPagoExecutores = 0
      let totalAPagarExecutores = 0

      const contasRecords = $app.findRecordsByFilter(
        'contas',
        "projeto = '" + projetoId + "'",
        'vencimento',
        200,
        0,
      )

      const contasReceberList = []
      const contasPagarList = []

      for (let i = 0; i < contasRecords.length; i++) {
        const c = contasRecords[i]
        const tipo = c.getString('tipo')
        const status = c.getString('status')
        const valor = c.getFloat('valor') || 0
        const valorLiq = c.getFloat('valor_liquido') || valor

        if (tipo === 'receber') {
          contasReceberList.push({
            id: c.id,
            descricao: c.getString('descricao'),
            valor: valor,
            vencimento: c.getString('vencimento'),
            status: status,
            data_pagamento: c.getString('data_pagamento'),
            nf: c.getString('nf'),
          })
          if (status === 'paga' || status === 'realizada') {
            totalRecebido += valor
          } else if (status !== 'cancelada') {
            totalAReceber += valor
          }
        } else if (tipo === 'pagar') {
          contasPagarList.push({
            id: c.id,
            descricao: c.getString('descricao'),
            valor: valor,
            valor_liquido: valorLiq,
            vencimento: c.getString('vencimento'),
            status: status,
            data_pagamento: c.getString('data_pagamento'),
            executor_id: c.getString('executor'),
            nf: c.getString('nf'),
          })
          if (status === 'paga' || status === 'realizada') {
            totalPagoExecutores += valor
          } else if (status !== 'cancelada') {
            totalAPagarExecutores += valor
          }
        }
      }

      // Progresso calculado das etapas
      const etapasTotais = etapasList.length
      const etapasConcluidas = etapasList.filter((et) => et.status === 'concluida').length
      const percentualConclusao =
        etapasTotais > 0 ? Math.round((etapasConcluidas / etapasTotais) * 100) : 0

      // Registrar auditoria da geração do dossiê (suporta campos em pt-br ou en)
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const auditRecord = new Record(auditCol)
        if (auditCol.fields.getByName('user')) {
          auditRecord.set('user', auth.id)
        }
        if (auditCol.fields.getByName('user_email')) {
          auditRecord.set('user_email', auth.getString('email') || '')
        }
        if (auditCol.fields.getByName('acao')) {
          auditRecord.set('acao', 'GERACAO_DOSSIE')
        }
        if (auditCol.fields.getByName('action')) {
          auditRecord.set('action', 'GERACAO_DOSSIE')
        }
        if (auditCol.fields.getByName('entidade')) {
          auditRecord.set('entidade', 'projetos')
        }
        if (auditCol.fields.getByName('entity_type')) {
          auditRecord.set('entity_type', 'projetos')
        }
        if (auditCol.fields.getByName('registro_id')) {
          auditRecord.set('registro_id', projetoId)
        }
        if (auditCol.fields.getByName('entity_id')) {
          auditRecord.set('entity_id', projetoId)
        }
        const detalhesPayload = {
          codigo_projeto: projeto.getString('codigo'),
          nome_projeto: projeto.getString('nome'),
          formato: 'PDF_HTML',
          perfil: role,
          gerado_em: new Date().toISOString(),
        }
        if (auditCol.fields.getByName('detalhes')) {
          auditRecord.set('detalhes', detalhesPayload)
        }
        if (auditCol.fields.getByName('details')) {
          auditRecord.set('details', detalhesPayload)
        }
        $app.save(auditRecord)
      } catch (_) {}

      return e.json(200, {
        success: true,
        projeto: {
          id: projeto.id,
          codigo: projeto.getString('codigo'),
          nome: projeto.getString('nome') || `Projeto ${projeto.getString('codigo')}`,
          descricao: projeto.getString('descricao'),
          status: projeto.getString('status') || 'em_andamento',
          saude: projeto.getString('saude') || 'verde',
          justificativa_saude: projeto.getString('justificativa_saude'),
          prazo_final: projeto.getString('prazo_final'),
          valor_total: totalContratado,
          subcontratacao_autorizada: projeto.getBool('subcontratacao_autorizada'),
          disciplinas: projeto.getString('disciplinas'),
          created: projeto.getString('created'),
          updated: projeto.getString('updated'),
        },
        cliente: {
          nome: clienteNome,
          documento: clienteDocumento,
          tipo: clienteTipo,
          email: clienteEmail,
          telefone: clienteTelefone,
        },
        proposta: propostaInfo,
        contrato: contratoInfo,
        progresso: {
          total_etapas: etapasTotais,
          etapas_concluidas: etapasConcluidas,
          percentual: percentualConclusao,
        },
        etapas: etapasList,
        entregaveis: entregaveisList,
        documentos: documentosList,
        medicoes: medicoesList,
        riscos: riscosList,
        financeiro: {
          total_contratado: totalContratado,
          total_recebido: totalRecebido,
          total_a_receber: totalAReceber,
          total_pago_executores: totalPagoExecutores,
          total_a_pagar_executores: totalAPagarExecutores,
          saldo_operacional: totalRecebido - totalPagoExecutores,
          margem_projetada:
            totalContratado > 0
              ? ((totalContratado - (totalPagoExecutores + totalAPagarExecutores)) /
                  totalContratado) *
                100
              : 0,
          contas_receber: contasReceberList,
          contas_pagar: contasPagarList,
        },
        gerado_em: new Date().toISOString(),
        gerado_por: {
          nome: auth.getString('name') || auth.getString('email'),
          email: auth.getString('email'),
          role: role,
        },
      })
    } catch (err) {
      if (err && err.status) {
        throw err
      }
      return e.json(500, {
        success: false,
        message: 'Erro ao gerar dados do dossiê: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
