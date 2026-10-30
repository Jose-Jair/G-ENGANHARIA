// ============================================================================
// RODADA 8 — INTEGRAÇÃO FINANCEIRA COMPLETA
// Rotinas e Endpoints Especializados:
// 1. Conferência Contrato -> Contas a Receber (Idempotente)
// 2. Previsão de Receita Ponderada do Funil (com probabilidades configuráveis)
// 3. Saúde Financeira Consolidada por Projeto (Margem Real, Teto Vendido, Exposição, Alertas)
// 4. Fluxo de Caixa Projetado Cliente x Prestador por Marco com Alerta de Inversão
// ============================================================================

// ----------------------------------------------------------------------------
// 1. POST /backend/v1/contratos-servico/{id}/conferir-contas-receber
// Sincroniza/concede amarração de contrato -> contas a receber de forma IDEMPOTENTE
// Nunca duplica contas existentes com a mesma chave.
// ----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/contratos-servico/conferir-contas-receber/{id}',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.json(403, {
          message:
            'Acesso restrito: apenas Administrador ou Financeiro podem sincronizar contas a receber.',
        })
      }

      const contratoId = e.request.pathValue('id')
      if (!contratoId) {
        return e.json(400, { message: 'ID do contrato não informado.' })
      }

      let contrato
      try {
        contrato = $app.findRecordById('contratos_servico', contratoId)
      } catch (_) {
        return e.json(404, { message: 'Contrato de serviço não encontrado.' })
      }

      const contratoNumero = contrato.getString('numero')
      const propostaId = contrato.getString('proposta')
      const projetoId = contrato.getString('projeto')
      const valorTotalContrato = contrato.getFloat('valor_total') || 0
      const condicoesPagamento =
        contrato.getString('clausulas_texto') || 'Condições conforme contrato'

      let proposta = null
      let requerNota = false
      let aliquotaImpostos = 0
      if (propostaId) {
        try {
          proposta = $app.findRecordById('propostas', propostaId)
          if (proposta) {
            requerNota = proposta.getBool('requer_nota')
            aliquotaImpostos = proposta.getFloat('impostos') || 0
          }
        } catch (_) {}
      }

      // Buscar parcelas da proposta
      let parcelas = []
      if (propostaId) {
        try {
          parcelas = $app.findRecordsByFilter(
            'proposta_parcelas',
            "proposta = '" + propostaId + "'",
            'ordem',
            50,
            0,
          )
        } catch (_) {}
      }

      // Buscar marcos existentes no projeto
      let marcos = []
      if (projetoId) {
        try {
          marcos = $app.findRecordsByFilter(
            'projeto_etapas',
            "projeto = '" + projetoId + "' && is_marco = true",
            'ordem',
            50,
            0,
          )
        } catch (_) {}
      }

      const contasCol = $app.findCollectionByNameOrId('contas')
      const etapasCol = $app.findCollectionByNameOrId('projeto_etapas')
      const auditCol = $app.findCollectionByNameOrId('audit_logs')

      const criadas = []
      const jaExistiam = []

      // Se temos parcelas cadastradas, vinculamos cada parcela
      if (parcelas && parcelas.length > 0) {
        for (let i = 0; i < parcelas.length; i++) {
          const parc = parcelas[i]
          const ordem = parc.getInt('ordem') || i + 1
          const perc = parc.getFloat('percentual') || 0
          const valorParc = parc.getFloat('valor') || (valorTotalContrato * perc) / 100
          const descParc = parc.getString('descricao') || `Parcela ${ordem}/${parcelas.length}`
          const gatilho = parc.getString('gatilho') || 'marco'

          const chaveIdemp = 'CTR_' + contratoId + '_PARC_' + parc.id

          // 1. Procurar conta por chave de idempotência ou parcela_origem
          let contaAchada = null
          const contasPorChave = $app.findRecordsByFilter(
            'contas',
            "chave_idempotencia = '" + chaveIdemp + "'",
            '',
            1,
            0,
          )
          if (contasPorChave.length > 0) {
            contaAchada = contasPorChave[0]
          } else {
            const contasPorParc = $app.findRecordsByFilter(
              'contas',
              "parcela_origem = '" + parc.id + "' && tipo = 'receber' && status != 'cancelada'",
              '',
              1,
              0,
            )
            if (contasPorParc.length > 0) {
              contaAchada = contasPorParc[0]
            } else {
              const contasPorDesc = $app.findRecordsByFilter(
                'contas',
                "contrato_servico = '" +
                  contratoId +
                  "' && tipo = 'receber' && status != 'cancelada' && descricao ~ 'Parcela " +
                  ordem +
                  "/'",
                '',
                1,
                0,
              )
              if (contasPorDesc.length > 0) {
                contaAchada = contasPorDesc[0]
              }
            }
          }

          // Procurar ou criar marco correspondente
          let marcoId = null
          let marcoAchado = null
          for (let m = 0; m < marcos.length; m++) {
            if (marcos[m].getString('parcela_origem') === parc.id) {
              marcoAchado = marcos[m]
              break
            }
          }

          if (!marcoAchado && projetoId) {
            try {
              const novoMarco = new Record(etapasCol)
              novoMarco.set('projeto', projetoId)
              novoMarco.set('nome', 'Marco Financeiro: Parcela ' + ordem + ' (' + descParc + ')')
              novoMarco.set('disciplina', 'Marco Financeiro')
              novoMarco.set('ordem', 100 + ordem)
              novoMarco.set('tipo_execucao', 'direta')
              novoMarco.set('status', 'nao_iniciada')
              novoMarco.set('is_marco', true)
              novoMarco.set('is_pacote_trabalho', false)
              novoMarco.set('valor_vendido', valorParc)
              novoMarco.set('valor_interno_referencia', valorParc)
              novoMarco.set('parcela_origem', parc.id)

              const diasVencMarco = i === 0 ? 15 : (i + 1) * 30
              const dtVencMarco = new Date()
              dtVencMarco.setDate(dtVencMarco.getDate() + diasVencMarco)
              novoMarco.set('prazo', dtVencMarco.toISOString().substring(0, 10) + ' 12:00:00.000Z')
              novoMarco.set(
                'descricao',
                'Marco vinculado à parcela ' +
                  ordem +
                  ' do Contrato ' +
                  contratoNumero +
                  '. Gatilho: ' +
                  gatilho,
              )
              $app.save(novoMarco)
              marcoId = novoMarco.id
            } catch (eM) {
              console.log('Aviso ao criar marco: ' + eM)
            }
          } else if (marcoAchado) {
            marcoId = marcoAchado.id
          }

          if (contaAchada) {
            let mudou = false
            if (!contaAchada.getString('chave_idempotencia')) {
              contaAchada.set('chave_idempotencia', chaveIdemp)
              mudou = true
            }
            if (!contaAchada.getString('parcela_origem')) {
              contaAchada.set('parcela_origem', parc.id)
              mudou = true
            }
            if (marcoId && !contaAchada.getString('marco_origem')) {
              contaAchada.set('marco_origem', marcoId)
              mudou = true
            }
            if (mudou) {
              $app.save(contaAchada)
            }

            jaExistiam.push({
              conta_id: contaAchada.id,
              ordem: ordem,
              descricao: contaAchada.getString('descricao'),
              valor: contaAchada.getFloat('valor'),
              status: contaAchada.getString('status'),
              vencimento: contaAchada.getString('vencimento'),
              chave_idempotencia: chaveIdemp,
              marco_id: marcoId,
            })
          } else {
            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            if (projetoId) novaConta.set('projeto', projetoId)
            if (propostaId) novaConta.set('proposta', propostaId)
            novaConta.set('contrato_servico', contratoId)
            novaConta.set('chave_idempotencia', chaveIdemp)
            novaConta.set('parcela_origem', parc.id)
            if (marcoId) novaConta.set('marco_origem', marcoId)

            novaConta.set(
              'descricao',
              'Contrato ' +
                contratoNumero +
                ' — Parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ' (' +
                perc +
                '% - ' +
                descParc +
                ')' +
                (requerNota ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorParc)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)

            if (requerNota && aliquotaImpostos > 0) {
              const retencao =
                Math.round(((valorParc * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100) / 100
              novaConta.set('retencao_impostos', retencao)
              novaConta.set('valor_liquido', Math.round((valorParc - retencao) * 100) / 100)
            } else {
              novaConta.set('retencao_impostos', 0)
              novaConta.set('valor_liquido', valorParc)
            }

            const diasVenc = i === 0 ? 15 : (i + 1) * 30
            const dataVenc = new Date()
            dataVenc.setDate(dataVenc.getDate() + diasVenc)
            novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

            $app.save(novaConta)

            criadas.push({
              conta_id: novaConta.id,
              ordem: ordem,
              descricao: novaConta.getString('descricao'),
              valor: valorParc,
              vencimento: novaConta.getString('vencimento'),
              chave_idempotencia: chaveIdemp,
              marco_id: marcoId,
            })

            try {
              const aRec = new Record(auditCol)
              aRec.set('user', reqInfo.auth.id)
              aRec.set('user_email', reqInfo.auth.getString('email'))
              aRec.set('acao', 'CONFERENCIA_CONTA_RECEBER_CRIADA')
              aRec.set('entidade', 'contas')
              aRec.set('registro_id', novaConta.id)
              aRec.set('detalhes', {
                contrato_id: contratoId,
                contrato_numero: contratoNumero,
                parcela_ordem: ordem,
                valor: valorParc,
                chave_idempotencia: chaveIdemp,
              })
              $app.save(aRec)
            } catch (_) {}
          }
        }
      } else {
        const chaveIdemp = 'CTR_' + contratoId + '_INTEGRAL'
        const contasPorChave = $app.findRecordsByFilter(
          'contas',
          "chave_idempotencia = '" +
            chaveIdemp +
            "' || (contrato_servico = '" +
            contratoId +
            "' && tipo = 'receber' && status != 'cancelada')",
          '',
          1,
          0,
        )

        if (contasPorChave.length > 0) {
          const cExistente = contasPorChave[0]
          if (!cExistente.getString('chave_idempotencia')) {
            cExistente.set('chave_idempotencia', chaveIdemp)
            $app.save(cExistente)
          }
          jaExistiam.push({
            conta_id: cExistente.id,
            ordem: 1,
            descricao: cExistente.getString('descricao'),
            valor: cExistente.getFloat('valor'),
            status: cExistente.getString('status'),
            vencimento: cExistente.getString('vencimento'),
            chave_idempotencia: chaveIdemp,
          })
        } else {
          const novaConta = new Record(contasCol)
          novaConta.set('tipo', 'receber')
          if (projetoId) novaConta.set('projeto', projetoId)
          if (propostaId) novaConta.set('proposta', propostaId)
          novaConta.set('contrato_servico', contratoId)
          novaConta.set('chave_idempotencia', chaveIdemp)
          novaConta.set(
            'descricao',
            'Recebimento integral do Contrato ' +
              contratoNumero +
              (requerNota ? ' (Com NF)' : ' (Sem NF)'),
          )
          novaConta.set('valor', valorTotalContrato)
          novaConta.set('status', 'rascunho')
          novaConta.set('forma_pagamento', condicoesPagamento)
          novaConta.set('bloqueada_por_fechamento', false)

          if (requerNota && aliquotaImpostos > 0) {
            const retencao =
              Math.round(
                ((valorTotalContrato * aliquotaImpostos) / (100 + aliquotaImpostos)) * 100,
              ) / 100
            novaConta.set('retencao_impostos', retencao)
            novaConta.set('valor_liquido', Math.round((valorTotalContrato - retencao) * 100) / 100)
          } else {
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorTotalContrato)
          }

          const dataVenc = new Date()
          dataVenc.setDate(dataVenc.getDate() + 30)
          novaConta.set('vencimento', dataVenc.toISOString().substring(0, 10) + ' 12:00:00.000Z')

          $app.save(novaConta)

          criadas.push({
            conta_id: novaConta.id,
            ordem: 1,
            descricao: novaConta.getString('descricao'),
            valor: valorTotalContrato,
            vencimento: novaConta.getString('vencimento'),
            chave_idempotencia: chaveIdemp,
          })
        }
      }

      return e.json(200, {
        success: true,
        contrato_id: contratoId,
        contrato_numero: contratoNumero,
        relatorio: {
          total_criadas: criadas.length,
          total_ja_existiam: jaExistiam.length,
          criadas: criadas,
          ja_existiam: jaExistiam,
        },
        mensagem:
          criadas.length === 0
            ? 'Conferência realizada: todas as contas a receber já existiam. Nenhuma duplicidade gerada.'
            : `${criadas.length} nova(s) conta(s) a receber gerada(s). ${jaExistiam.length} já existia(m).`,
      })
    } catch (err) {
      console.log('Erro na conferência de contas a receber: ' + err)
      return e.json(500, { message: 'Erro ao conferir contas a receber: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------------------------------
// 2. GET /backend/v1/financeiro/previsao-receita-funil
// Previsão de receita ponderada por etapa do funil (Admin & Financeiro)
// ----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/financeiro/previsao-receita-funil',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.json(403, {
          message:
            'Acesso restrito: apenas Administradores e Financeiro podem acessar a previsão de receita ponderada.',
        })
      }

      const probabilidades = {
        identificada: 10,
        qualificada: 20,
        em_cadencia: 30,
        em_conversa: 50,
        com_proposta_elaborada: 70,
        proposta_enviada: 85,
        parceira: 100,
        nutricao_mensal: 15,
        inativa: 0,
      }

      try {
        const param = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'funil_probabilidade_por_etapa',
        )
        if (param) {
          const val = param.getString('valor')
          if (val) {
            const parsed = JSON.parse(val)
            Object.assign(probabilidades, parsed)
          }
        }
      } catch (_) {}

      // Mapeamento de 5 colunas para compatibilidade da Rodada 10
      const mapeamento5Colunas = {
        identificada: 'identificada',
        qualificada: 'qualificada',
        em_cadencia: 'qualificada',
        com_proposta_elaborada: 'em_proposta',
        proposta_enviada: 'em_proposta',
        em_conversa: 'negociacao',
        parceira: 'ganha_perdida',
        nutricao_mensal: 'ganha_perdida',
        inativa: 'ganha_perdida',
      }
      try {
        const paramMap = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'funil_correspondencia_5_colunas',
        )
        if (paramMap) {
          const valMap = paramMap.getString('valor')
          if (valMap) {
            const parsedMap = JSON.parse(valMap)
            Object.assign(mapeamento5Colunas, parsedMap)
          }
        }
      } catch (_) {}

      const colunas5Contadores = {
        identificada: {
          coluna: 'identificada',
          titulo: 'Identificada',
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
        },
        qualificada: {
          coluna: 'qualificada',
          titulo: 'Qualificada',
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
        },
        em_proposta: {
          coluna: 'em_proposta',
          titulo: 'Em proposta',
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
        },
        negociacao: {
          coluna: 'negociacao',
          titulo: 'Negociação',
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
        },
        ganha_perdida: {
          coluna: 'ganha_perdida',
          titulo: 'Ganha / Perdida',
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
        },
      }

      // Buscar empresas ativas com etapa_funil
      const empresas = $app.findRecordsByFilter('empresas', "status = 'ativa'", '-created', 2000, 0)

      // Buscar propostas não recusadas e não expiradas para cruzar valores
      const propostas = $app.findRecordsByFilter(
        'propostas',
        "status != 'recusada' && status != 'expirada'",
        '-created',
        1000,
        0,
      )

      const propostasPorEmpresa = {}
      for (let i = 0; i < propostas.length; i++) {
        const p = propostas[i]
        const empId = p.getString('empresa')
        if (empId) {
          if (!propostasPorEmpresa[empId]) propostasPorEmpresa[empId] = []
          propostasPorEmpresa[empId].push(p)
        }
      }

      const etapasContadores = {}
      const chavesEtapas = Object.keys(probabilidades)
      for (let k = 0; k < chavesEtapas.length; k++) {
        const etapa = chavesEtapas[k]
        etapasContadores[etapa] = {
          etapa: etapa,
          probabilidade_perc: probabilidades[etapa] || 0,
          total_empresas: 0,
          valor_bruto_potencial: 0,
          valor_ponderado: 0,
          empresas_detalhe: [],
        }
      }

      let totalBrutoCarteira = 0
      let totalPonderadoCarteira = 0

      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        const etapa = emp.getString('etapa_funil') || 'identificada'
        const prob = probabilidades[etapa] !== undefined ? probabilidades[etapa] : 20

        let valorBruto = 0
        const propsEmp = propostasPorEmpresa[emp.id]
        if (propsEmp && propsEmp.length > 0) {
          for (let pIdx = 0; pIdx < propsEmp.length; pIdx++) {
            valorBruto += propsEmp[pIdx].getFloat('preco') || 0
          }
        } else {
          valorBruto = emp.getFloat('valor_estimado_oportunidade') || 0
        }

        const valorPonderado = Math.round(((valorBruto * prob) / 100) * 100) / 100

        if (!etapasContadores[etapa]) {
          etapasContadores[etapa] = {
            etapa: etapa,
            probabilidade_perc: prob,
            total_empresas: 0,
            valor_bruto_potencial: 0,
            valor_ponderado: 0,
            empresas_detalhe: [],
          }
        }

        etapasContadores[etapa].total_empresas++
        etapasContadores[etapa].valor_bruto_potencial += valorBruto
        etapasContadores[etapa].valor_ponderado += valorPonderado

        // Acumular também na visão compatível de 5 colunas
        const col5Key = mapeamento5Colunas[etapa] || 'identificada'
        if (colunas5Contadores[col5Key]) {
          colunas5Contadores[col5Key].total_empresas++
          colunas5Contadores[col5Key].valor_bruto_potencial += valorBruto
          colunas5Contadores[col5Key].valor_ponderado += valorPonderado
        }

        etapasContadores[etapa].empresas_detalhe.push({
          id: emp.id,
          nome: emp.getString('nome_fantasia') || emp.getString('razao_social'),
          cnpj: emp.getString('cnpj'),
          etapa: etapa,
          coluna_5: col5Key,
          is_parceira: emp.getBool('is_parceira') || etapa === 'parceira',
          probabilidade_perc: prob,
          valor_bruto: Math.round(valorBruto * 100) / 100,
          valor_ponderado: valorPonderado,
          total_propostas: propsEmp ? propsEmp.length : 0,
        })

        totalBrutoCarteira += valorBruto
        totalPonderadoCarteira += valorPonderado
      }

      const etapasLista = Object.values(etapasContadores).map((item) => ({
        etapa: item.etapa,
        probabilidade_perc: item.probabilidade_perc,
        total_empresas: item.total_empresas,
        valor_bruto_potencial: Math.round(item.valor_bruto_potencial * 100) / 100,
        valor_ponderado: Math.round(item.valor_ponderado * 100) / 100,
        empresas_detalhe: item.empresas_detalhe,
      }))

      const colunas5Lista = Object.values(colunas5Contadores).map((c) => ({
        coluna: c.coluna,
        titulo: c.titulo,
        total_empresas: c.total_empresas,
        valor_bruto_potencial: Math.round(c.valor_bruto_potencial * 100) / 100,
        valor_ponderado: Math.round(c.valor_ponderado * 100) / 100,
      }))

      return e.json(200, {
        success: true,
        parametros_probabilidades: probabilidades,
        correspondencia_5_colunas: mapeamento5Colunas,
        totalizador: {
          total_empresas: empresas.length,
          valor_bruto_total: Math.round(totalBrutoCarteira * 100) / 100,
          previsao_receita_ponderada_total: Math.round(totalPonderadoCarteira * 100) / 100,
          fator_conversao_medio_perc:
            totalBrutoCarteira > 0
              ? Math.round((totalPonderadoCarteira / totalBrutoCarteira) * 1000) / 10
              : 0,
        },
        etapas: etapasLista,
        colunas_5: colunas5Lista,
      })
    } catch (err) {
      console.log('Erro ao calcular previsão de receita do funil: ' + err)
      return e.json(500, { message: 'Erro interno ao calcular previsão: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------------------------------
// 3. GET /backend/v1/projetos/{id}/saude-financeira
// Endpoint consolidado de Saúde Financeira por Projeto
// Margem real = valor vendido - soma das OS externas - custos lançados
// ----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/projetos/{id}/saude-financeira',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro' && role !== 'gestor') {
        return e.json(403, {
          message:
            'Acesso restrito: prestadores e perfis não autorizados não têm acesso à saúde financeira do projeto.',
        })
      }

      const projetoId = e.request.pathValue('id')
      let projeto
      try {
        projeto = $app.findRecordById('projetos', projetoId)
      } catch (_) {
        return e.json(404, { message: 'Projeto não encontrado.' })
      }

      let margemMinimaConfigurada = 20.0
      try {
        const param = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'financeiro_margem_minima_alerta',
        )
        if (param) {
          const val = parseFloat(param.getString('valor'))
          if (!isNaN(val)) margemMinimaConfigurada = val
        }
      } catch (_) {}

      // 1. Valor vendido
      let valorVendido = projeto.getFloat('valor_total') || 0
      const propostaId = projeto.getString('proposta')
      let propostaNumero = null
      let margemPropostaPerc = 0

      if (propostaId) {
        try {
          const prop = $app.findRecordById('propostas', propostaId)
          if (prop) {
            propostaNumero = prop.getString('numero')
            if (!valorVendido) valorVendido = prop.getFloat('preco') || 0
            margemPropostaPerc = prop.getFloat('margem') || 0
          }
        } catch (_) {}
      }

      // 2. Ordens de serviço externas do projeto
      const osExternas = $app.findRecordsByFilter(
        'ordens_servico',
        "projeto = '" + projetoId + "' && tipo_prestador = 'externo' && status != 'cancelada'",
        '-valor_os',
        100,
        0,
      )

      let somaOsExternas = 0
      const detalheOs = []
      for (let i = 0; i < osExternas.length; i++) {
        const os = osExternas[i]
        const vOs = os.getFloat('valor_os') || 0
        somaOsExternas += vOs
        detalheOs.push({
          id: os.id,
          numero: os.getString('numero'),
          disciplina: os.getString('disciplina'),
          prestador_id: os.getString('prestador'),
          status: os.getString('status'),
          valor_os: vOs,
          retencao_tecnica_acumulada: os.getFloat('retencao_tecnica_acumulada') || 0,
        })
      }

      // 3. Custos lançados
      const contasPagar = $app.findRecordsByFilter(
        'contas',
        "projeto = '" + projetoId + "' && tipo = 'pagar' && status != 'cancelada'",
        '-vencimento',
        200,
        0,
      )

      let custosLancadosContas = 0
      let custosPagos = 0
      let custosEmAberto = 0

      for (let i = 0; i < contasPagar.length; i++) {
        const c = contasPagar[i]
        const v = c.getFloat('valor') || 0
        const st = c.getString('status')
        custosLancadosContas += v
        if (st === 'paga' || st === 'realizada') {
          custosPagos += v
        } else {
          custosEmAberto += v
        }
      }

      // 4. Contas a receber do projeto
      const contasReceber = $app.findRecordsByFilter(
        'contas',
        "projeto = '" + projetoId + "' && tipo = 'receber' && status != 'cancelada'",
        'vencimento',
        200,
        0,
      )

      let totalReceber = 0
      let totalRecebido = 0
      let totalReceberAberto = 0

      for (let i = 0; i < contasReceber.length; i++) {
        const c = contasReceber[i]
        const v = c.getFloat('valor') || 0
        const st = c.getString('status')
        totalReceber += v
        if (st === 'paga' || st === 'realizada') {
          totalRecebido += v
        } else {
          totalReceberAberto += v
        }
      }

      let custosSemOs = 0
      for (let i = 0; i < contasPagar.length; i++) {
        if (
          !contasPagar[i].getString('ordem_servico') &&
          !contasPagar[i].getString('medicao_aprovada_origem')
        ) {
          custosSemOs += contasPagar[i].getFloat('valor') || 0
        }
      }
      const custoTotalComprometido = Math.round((somaOsExternas + custosSemOs) * 100) / 100
      const margemRealValor = Math.round((valorVendido - custoTotalComprometido) * 100) / 100
      const margemRealPerc =
        valorVendido > 0 ? Math.round((margemRealValor / valorVendido) * 1000) / 10 : 0

      const exposicaoFinanceira = Math.round((custoTotalComprometido - totalRecebido) * 100) / 100

      const alertas = []
      if (margemRealPerc < margemMinimaConfigurada) {
        alertas.push({
          tipo: 'MARGEM_CRITICA',
          nivel: 'critico',
          mensagem: `Margem real do projeto (${margemRealPerc.toFixed(1)}%) está abaixo do mínimo configurado (${margemMinimaConfigurada.toFixed(1)}%).`,
        })
      }

      if (custoTotalComprometido > valorVendido && valorVendido > 0) {
        alertas.push({
          tipo: 'ESTOURO_ORCAMENTO',
          nivel: 'critico',
          mensagem: `Custo total comprometido (R$ ${custoTotalComprometido.toFixed(2)}) ultrapassa o teto vendido do projeto (R$ ${valorVendido.toFixed(2)}).`,
        })
      }

      if (exposicaoFinanceira > 0 && totalReceberAberto > 0) {
        alertas.push({
          tipo: 'EXPOSICAO_CAIXA',
          nivel: 'atencao',
          mensagem: `Projeto em exposição financeira de R$ ${exposicaoFinanceira.toFixed(2)} à frente dos recebimentos realizados.`,
        })
      }

      return e.json(200, {
        success: true,
        projeto_id: projetoId,
        projeto_codigo: projeto.getString('codigo'),
        projeto_nome: projeto.getString('nome'),
        proposta_numero: propostaNumero,
        teto_vendido: valorVendido,
        custos: {
          soma_os_externas: Math.round(somaOsExternas * 100) / 100,
          outros_custos_lancados: Math.round(custosSemOs * 100) / 100,
          custo_total_comprometido: custoTotalComprometido,
          custos_pagos: Math.round(custosPagos * 100) / 100,
          custos_em_aberto: Math.round(custosEmAberto * 100) / 100,
          total_os_externas_count: osExternas.length,
          detalhes_os: detalheOs,
        },
        receitas: {
          total_receber_contratado: Math.round(totalReceber * 100) / 100,
          total_recebido: Math.round(totalRecebido * 100) / 100,
          total_receber_aberto: Math.round(totalReceberAberto * 100) / 100,
        },
        margem: {
          prevista_proposta_perc: margemPropostaPerc,
          real_valor: margemRealValor,
          real_perc: margemRealPerc,
          minima_toleravel_perc: margemMinimaConfigurada,
          status:
            margemRealPerc >= margemMinimaConfigurada
              ? 'saudavel'
              : margemRealPerc >= 10
                ? 'atencao'
                : 'critico',
        },
        exposicao_financeira: exposicaoFinanceira,
        alertas: alertas,
      })
    } catch (err) {
      console.log('Erro ao consultar saúde financeira do projeto: ' + err)
      return e.json(500, { message: 'Erro interno ao consultar saúde financeira: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------------------------------
// 4. GET /backend/v1/financeiro/fluxo-marcos-inversao
// Fluxo de caixa projetado cliente x prestador por marco, com alerta quando
// uma conta a pagar ao prestador vence ANTES do recebimento do cliente correspondente.
// ----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/financeiro/fluxo-marcos-inversao',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo || !reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'financeiro') {
        return e.json(403, {
          message:
            'Acesso restrito: apenas Administradores e Financeiro podem acessar o fluxo de marcos e alertas de inversão.',
        })
      }

      let antecedenciaDiasAlerta = 5
      try {
        const param = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'financeiro_antecedencia_alerta_inversao_dias',
        )
        if (param) {
          const val = parseInt(param.getString('valor'), 10)
          if (!isNaN(val)) antecedenciaDiasAlerta = val
        }
      } catch (_) {}

      // Carregar projetos
      const projetos = $app.findRecordsByFilter(
        'projetos',
        "status != 'cancelado'",
        'codigo',
        500,
        0,
      )
      const projetosById = {}
      for (let i = 0; i < projetos.length; i++) {
        projetosById[projetos[i].id] = projetos[i]
      }

      // Carregar contas que não estejam canceladas
      const contas = $app.findRecordsByFilter(
        'contas',
        "status != 'cancelada'",
        'vencimento',
        2000,
        0,
      )

      const contasPorProjeto = {}
      for (let i = 0; i < contas.length; i++) {
        const c = contas[i]
        const pId = c.getString('projeto')
        if (pId) {
          if (!contasPorProjeto[pId]) contasPorProjeto[pId] = []
          contasPorProjeto[pId].push(c)
        }
      }

      const alertasInversao = []
      const pIds = Object.keys(contasPorProjeto)
      for (let pIdx = 0; pIdx < pIds.length; pIdx++) {
        const projId = pIds[pIdx]
        const proj = projetosById[projId]
        if (!proj) continue

        const contasPrj = contasPorProjeto[projId]
        const aReceber = contasPrj.filter((c) => c.getString('tipo') === 'receber')
        const aPagar = contasPrj.filter((c) => c.getString('tipo') === 'pagar')

        for (let j = 0; j < aPagar.length; j++) {
          const cPagar = aPagar[j]
          const vencPagar = cPagar.getString('vencimento')
          const statusPagar = cPagar.getString('status')
          if (!vencPagar || statusPagar === 'paga' || statusPagar === 'realizada') continue

          const dtVencPagar = new Date(vencPagar)

          let recebimentoCorrespondente = null
          const marcoOrigemPagar = cPagar.getString('marco_origem') || cPagar.getString('etapa')

          if (marcoOrigemPagar) {
            recebimentoCorrespondente = aReceber.find(
              (r) =>
                (r.getString('marco_origem') === marcoOrigemPagar ||
                  r.getString('etapa') === marcoOrigemPagar) &&
                r.getString('status') !== 'paga',
            )
          }

          if (!recebimentoCorrespondente && aReceber.length > 0) {
            recebimentoCorrespondente = aReceber.find((r) => r.getString('status') !== 'paga')
          }

          if (recebimentoCorrespondente) {
            const vencReceber = recebimentoCorrespondente.getString('vencimento')
            if (vencReceber) {
              const dtVencReceber = new Date(vencReceber)
              const diffMs = dtVencReceber.getTime() - dtVencPagar.getTime()
              const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

              if (diffDias > 0 || (diffDias >= 0 && diffDias <= antecedenciaDiasAlerta)) {
                alertasInversao.push({
                  projeto_id: projId,
                  projeto_codigo: proj.getString('codigo'),
                  projeto_nome: proj.getString('nome'),
                  conta_pagar: {
                    id: cPagar.id,
                    descricao: cPagar.getString('descricao'),
                    valor: cPagar.getFloat('valor'),
                    vencimento: vencPagar,
                    executor_id: cPagar.getString('executor'),
                  },
                  conta_receber: {
                    id: recebimentoCorrespondente.id,
                    descricao: recebimentoCorrespondente.getString('descricao'),
                    valor: recebimentoCorrespondente.getFloat('valor'),
                    vencimento: vencReceber,
                  },
                  dias_inversao: diffDias,
                  tipo_inversao:
                    diffDias > 0
                      ? 'PAGAMENTO_PRESTADOR_ANTES_RECEBIMENTO'
                      : 'MARGEM_SEGURANCA_INSUFICIENTE',
                  mensagem:
                    diffDias > 0
                      ? `Inversão de fluxo: Conta a pagar ao prestador vence ${diffDias} dia(s) ANTES do recebimento correspondente do cliente.`
                      : `Atenção de fluxo: Margem de descasamento é de apenas ${Math.abs(diffDias)} dia(s) (limite configurado: ${antecedenciaDiasAlerta} dias).`,
                })
              }
            }
          }
        }
      }

      alertasInversao.sort((a, b) => b.dias_inversao - a.dias_inversao)

      return e.json(200, {
        success: true,
        antecedencia_dias_configurada: antecedenciaDiasAlerta,
        total_alertas_inversao: alertasInversao.length,
        alertas: alertasInversao,
      })
    } catch (err) {
      console.log('Erro ao calcular fluxo de marcos e inversão: ' + err)
      return e.json(500, { message: 'Erro interno ao calcular fluxo e inversão: ' + err })
    }
  },
  $apis.requireAuth(),
)
