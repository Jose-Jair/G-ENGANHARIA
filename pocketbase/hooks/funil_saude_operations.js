// Endpoint dedicado para o Painel de Saúde do Funil de Prospecção
// GET /backend/v1/funil/saude
// Acesso restrito a: Admin e Comercial (403 para os demais perfis)
// Somente leitura: não gera auditoria (consultas não geram auditoria)
//
// Retorna os 4 blocos de métricas:
// a. Tempo médio por etapa (tempo que as atuais estão nela e tempo que as que passaram levaram) + destaque de acúmulo
// b. Empresas estagnadas (sem mudança de etapa nem toque há X dias, X configurável em funil_estagnacao_dias)
// c. Conversão etapa -> etapa e saídas/descartes por etapa
// d. Descartes por motivo (agrupamento e mais recentes)

// =========================================================================
// ENDPOINT: AÇÕES EXCLUSIVAS DE ADMIN PARA LEADS EM FIM DE FUNIL
// =========================================================================
routerAdd(
  'POST',
  '/backend/v1/funil/acoes-fim-funil',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária.' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin') {
        return e.json(403, {
          message: 'Ação exclusiva para Administradores.',
        })
      }

      const body = reqInfo.body || {}
      const acao = body.acao // 'migrar_nutricao' ou 'marcar_nao_contatar'
      const empresaId = body.empresa_id
      const motivo = body.motivo || 'Fim de funil sem conversão (>7 dias em proposta enviada)'

      if (!empresaId) {
        return e.json(400, { message: 'ID da empresa é obrigatório.' })
      }

      const empresa = $app.findRecordById('empresas', empresaId)
      if (!empresa) {
        return e.json(404, { message: 'Empresa não encontrada.' })
      }

      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const userId = reqInfo.auth.id
      const userEmail = reqInfo.auth.getString('email') || 'admin'
      const clientIp = e.realIP() || ''

      if (acao === 'migrar_nutricao') {
        const etapaAnterior = empresa.getString('etapa_funil')
        empresa.set('etapa_anterior', etapaAnterior)
        empresa.set('etapa_funil', 'nutricao_mensal')
        empresa.set('motivo_inativacao', motivo)
        empresa.set(
          'observacoes',
          (empresa.getString('observacoes') || '') +
            '\n[Migração para Nutrição Mensal]: Lead migrado manualmente por ' +
            userEmail +
            ' em ' +
            new Date().toISOString() +
            ' (pode retornar ao funil se reacordar).',
        )
        $app.save(empresa)

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', userId)
          aRec.set('user_email', userEmail)
          aRec.set('acao', 'MIGRACAO_NUTRICAO')
          aRec.set('entidade', 'empresas')
          aRec.set('registro_id', empresaId)
          aRec.set('detalhes', {
            etapa_anterior: etapaAnterior,
            nova_etapa: 'nutricao_mensal',
            razao_social: empresa.getString('razao_social'),
            motivo: motivo,
            usuario: userEmail,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          message: 'Empresa migrada com sucesso para Nutrição Mensal.',
          empresa_id: empresaId,
          nova_etapa: 'nutricao_mensal',
        })
      } else if (acao === 'marcar_nao_contatar') {
        const cnpj = empresa.getString('cnpj') || ''
        const email = empresa.getString('email') || ''
        const razaoSocial = empresa.getString('razao_social') || ''

        // Inserir na coleção nao_contatar se não existir
        const naoContatarCol = $app.findCollectionByNameOrId('nao_contatar')
        let ncExiste = false
        if (empresaId) {
          try {
            const achou = $app.findFirstRecordByData('nao_contatar', 'empresa', empresaId)
            if (achou) ncExiste = true
          } catch (_) {}
        }
        if (!ncExiste && email) {
          try {
            const achou = $app.findFirstRecordByData('nao_contatar', 'email', email)
            if (achou) ncExiste = true
          } catch (_) {}
        }

        if (!ncExiste && (email || empresaId)) {
          const ncRec = new Record(naoContatarCol)
          ncRec.set('empresa', empresaId)
          ncRec.set('email', email || 'nao-informado@lead.com')
          ncRec.set('motivo', motivo)
          ncRec.set('data_inclusao', new Date().toISOString().substring(0, 10) + ' 12:00:00.000Z')
          $app.save(ncRec)
        }

        // Também atualizar o status da empresa para inativa
        const etapaAnterior = empresa.getString('etapa_funil')
        empresa.set('status', 'inativa')
        empresa.set('motivo_inativacao', 'Não contatar: ' + motivo)
        empresa.set(
          'observacoes',
          (empresa.getString('observacoes') || '') +
            '\n[Marcado como Não Contatar]: Marcado por ' +
            userEmail +
            ' em ' +
            new Date().toISOString(),
        )
        $app.save(empresa)

        try {
          const aRec = new Record(auditCol)
          aRec.set('user', userId)
          aRec.set('user_email', userEmail)
          aRec.set('acao', 'MARCADO_NAO_CONTATAR')
          aRec.set('entidade', 'empresas')
          aRec.set('registro_id', empresaId)
          aRec.set('detalhes', {
            razao_social: razaoSocial,
            cnpj: cnpj,
            email: email,
            motivo: motivo,
            usuario: userEmail,
            etapa_anterior: etapaAnterior,
          })
          aRec.set('ip', clientIp)
          $app.save(aRec)
        } catch (_) {}

        return e.json(200, {
          success: true,
          message: 'Lead incluído com sucesso na lista de Não Contatar.',
          empresa_id: empresaId,
        })
      } else {
        return e.json(400, { message: 'Ação desconhecida: ' + acao })
      }
    } catch (errAcao) {
      console.log('Erro ao executar acao fim de funil: ' + errAcao)
      return e.json(500, { message: 'Erro ao executar ação: ' + errAcao })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/funil/saude',
  (e) => {
    try {
      const reqInfo = e.requestInfo()
      if (!reqInfo.auth) {
        return e.json(401, { message: 'Autenticação necessária' })
      }

      const role = reqInfo.auth.getString('role')
      if (role !== 'admin' && role !== 'comercial') {
        return e.json(403, {
          message: 'Apenas usuários Administradores e Comercial podem acessar a Saúde do Funil.',
        })
      }

      // 1. Obter parâmetro de dias de estagnação (padrão 15)
      let diasEstagnacaoLimite = 15
      try {
        const paramEstagnacao = $app.findFirstRecordByData(
          'parametros',
          'chave',
          'funil_estagnacao_dias',
        )
        if (paramEstagnacao) {
          const v = parseInt(paramEstagnacao.getString('valor'), 10)
          if (!isNaN(v) && v > 0) diasEstagnacaoLimite = v
        }
      } catch (_) {}

      const agora = new Date()
      const agoraMs = agora.getTime()

      // Etapas oficiais do funil
      const ETAPAS_ORDENADAS = [
        'identificada',
        'qualificada',
        'em_cadencia',
        'em_conversa',
        'com_proposta_elaborada',
        'proposta_enviada',
        'parceira',
        'nutricao_mensal',
        'inativa',
      ]

      const ETAPAS_LABELS = {
        identificada: 'Identificada',
        qualificada: 'Qualificada',
        em_cadencia: 'Em Cadência',
        em_conversa: 'Em Conversa',
        com_proposta_elaborada: 'Proposta Elaborada',
        proposta_enviada: 'Proposta Enviada',
        parceira: 'Parceira',
        nutricao_mensal: 'Nutrição Mensal',
        inativa: 'Inativa',
      }

      // 2. Carregar todas as empresas
      const empresas = $app.findRecordsByFilter('empresas', '', '-created', 5000, 0)

      // Carregar todos os toques para verificar última atividade de toque
      const toques = $app.findRecordsByFilter('toques', '', '-created', 10000, 0)
      const toquesPorEmpresa = {}
      for (let t = 0; t < toques.length; t++) {
        const recT = toques[t]
        const empId = recT.getString('empresa')
        if (!empId) continue
        if (!toquesPorEmpresa[empId]) toquesPorEmpresa[empId] = []
        toquesPorEmpresa[empId].push(recT)
      }

      // Carregar logs de auditoria de empresas para rastrear transições históricas de etapa
      // Buscamos logs onde entidade = 'empresas'
      const auditEmpresas = $app.findRecordsByFilter(
        'audit_logs',
        "entidade = 'empresas'",
        'created',
        10000,
        0,
      )

      // Estrutura para reconstruir histórico de transições de etapa por empresa:
      // Para cada empresa, ordenamos os eventos: [ { data, etapa } ]
      const historicoPorEmpresa = {}

      for (let a = 0; a < auditEmpresas.length; a++) {
        const log = auditEmpresas[a]
        const empId = log.getString('registro_id')
        if (!empId) continue
        const acao = log.getString('acao')
        const dataLog = new Date(log.getString('created'))
        if (isNaN(dataLog.getTime())) continue

        let detalhes = null
        try {
          const raw = log.getString('detalhes')
          if (raw) detalhes = JSON.parse(raw)
        } catch (_) {}

        if (!detalhes) continue

        if (!historicoPorEmpresa[empId]) {
          historicoPorEmpresa[empId] = []
        }

        if (acao === 'CRIACAO') {
          const etapaCriada = (detalhes.depois && detalhes.depois.etapa_funil) || 'identificada'
          historicoPorEmpresa[empId].push({
            data: dataLog,
            etapa: etapaCriada,
            tipo: 'criacao',
          })
        } else if (acao === 'EDICAO') {
          if (detalhes.depois && detalhes.depois.etapa_funil !== undefined) {
            const etapaAntes = detalhes.antes ? detalhes.antes.etapa_funil : null
            const etapaDepois = detalhes.depois.etapa_funil
            if (etapaDepois && etapaDepois !== etapaAntes) {
              historicoPorEmpresa[empId].push({
                data: dataLog,
                etapa: etapaDepois,
                etapaAnterior: etapaAntes,
                tipo: 'mudanca',
              })
            }
          }
        }
      }

      // ---------------------------------------------------------
      // BLOCO A: Tempo Médio por Etapa
      // ---------------------------------------------------------
      // Para cada etapa:
      // - empresas_atuais_count: quantas empresas estão hoje nessa etapa
      // - tempo_medio_atual_dias: média de dias que as empresas atuais já estão nela
      // - empresas_passaram_count: transições de saída registradas desta etapa
      // - tempo_medio_historico_dias: média de dias que empresas que passaram levaram nela
      // - maior_acumulo: boolean (destaque da etapa com mais empresas ou maior tempo)

      const dadosEtapa = {}
      for (let i = 0; i < ETAPAS_ORDENADAS.length; i++) {
        const eKey = ETAPAS_ORDENADAS[i]
        dadosEtapa[eKey] = {
          etapa: eKey,
          label: ETAPAS_LABELS[eKey] || eKey,
          empresas_atuais_count: 0,
          soma_dias_atual: 0,
          tempo_medio_atual_dias: 0,
          empresas_passaram_count: 0,
          soma_dias_historico: 0,
          tempo_medio_historico_dias: 0,
        }
      }

      // 1. Calcular tempo atual para cada empresa na sua etapa atual
      // A data de entrada na etapa atual é a data da última transição no histórico para essa etapa,
      // ou a data de criação/atualização da empresa caso não haja log.
      const empresasDataEntradaEtapa = {}

      for (let eIdx = 0; eIdx < empresas.length; eIdx++) {
        const emp = empresas[eIdx]
        const etapaAtual = emp.getString('etapa_funil') || 'identificada'
        const empId = emp.id

        let dataEntrada = null
        const hist = historicoPorEmpresa[empId] || []
        // Procurar de trás para frente a última vez que entrou nessa etapa
        for (let h = hist.length - 1; h >= 0; h--) {
          if (hist[h].etapa === etapaAtual) {
            dataEntrada = hist[h].data
            break
          }
        }

        if (!dataEntrada) {
          // Se não encontrou transição expressa, usar data de criação da empresa
          const dtCriacao = new Date(emp.getString('created'))
          dataEntrada = !isNaN(dtCriacao.getTime()) ? dtCriacao : agora
        }

        empresasDataEntradaEtapa[empId] = dataEntrada

        const diasNaEtapa = Math.max(
          0,
          Math.floor((agoraMs - dataEntrada.getTime()) / (1000 * 60 * 60 * 24)),
        )

        if (dadosEtapa[etapaAtual]) {
          dadosEtapa[etapaAtual].empresas_atuais_count++
          dadosEtapa[etapaAtual].soma_dias_atual += diasNaEtapa
        }
      }

      // 2. Calcular tempo histórico das empresas que passaram por cada etapa
      // Percorrer historicoPorEmpresa: quando há mudança de E1 para E2 com intervalo deltaT
      for (const empId in historicoPorEmpresa) {
        const hist = historicoPorEmpresa[empId]
        for (let h = 0; h < hist.length - 1; h++) {
          const itemAtual = hist[h]
          const proximoItem = hist[h + 1]
          const etapaOrigem = itemAtual.etapa
          const dtInicio = itemAtual.data
          const dtFim = proximoItem.data
          if (dtInicio && dtFim && dtFim.getTime() >= dtInicio.getTime()) {
            const diasDuracao = Math.max(
              0,
              Math.floor((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60 * 60 * 24)),
            )
            if (dadosEtapa[etapaOrigem]) {
              dadosEtapa[etapaOrigem].empresas_passaram_count++
              dadosEtapa[etapaOrigem].soma_dias_historico += diasDuracao
            }
          }
        }
      }

      // Formatar tempo médio por etapa
      let maxEmpresasNaEtapa = 0
      let etapaComMaiorAcumulo = ''

      const tempoPorEtapaLista = ETAPAS_ORDENADAS.map((eKey) => {
        const item = dadosEtapa[eKey]
        const mediaAtual =
          item.empresas_atuais_count > 0
            ? Math.round((item.soma_dias_atual / item.empresas_atuais_count) * 10) / 10
            : 0
        const mediaHistorica =
          item.empresas_passaram_count > 0
            ? Math.round((item.soma_dias_historico / item.empresas_passaram_count) * 10) / 10
            : 0

        if (item.empresas_atuais_count > maxEmpresasNaEtapa) {
          maxEmpresasNaEtapa = item.empresas_atuais_count
          etapaComMaiorAcumulo = eKey
        }

        return {
          etapa: eKey,
          label: item.label,
          empresas_atuais: item.empresas_atuais_count,
          tempo_medio_atual_dias: mediaAtual,
          empresas_passaram: item.empresas_passaram_count,
          tempo_medio_historico_dias: mediaHistorica,
          maior_acumulo: false,
        }
      })

      // Marcar maior acúmulo se houver ao menos 1 empresa
      if (maxEmpresasNaEtapa > 0) {
        for (let i = 0; i < tempoPorEtapaLista.length; i++) {
          if (tempoPorEtapaLista[i].etapa === etapaComMaiorAcumulo) {
            tempoPorEtapaLista[i].maior_acumulo = true
            break
          }
        }
      }

      // ---------------------------------------------------------
      // BLOCO B: Empresas Estagnadas
      // ---------------------------------------------------------
      // Empresas sem progresso há >= X dias (sem mudança de etapa e sem toque realizado recente)
      // Exclui empresas que já estejam em "parceira" ou "inativa" do alerta de estagnação ativa
      const empresasEstagnadas = []

      for (let eIdx = 0; eIdx < empresas.length; eIdx++) {
        const emp = empresas[eIdx]
        const etapaAtual = emp.getString('etapa_funil') || 'identificada'

        // Estagnação é relevante para etapas do funil ativo (não para finalizadas 'parceira' ou já 'inativa')
        if (etapaAtual === 'parceira' || etapaAtual === 'inativa') {
          continue
        }

        const empId = emp.id
        const dtEntrada = empresasDataEntradaEtapa[empId] || new Date(emp.getString('created'))

        // Verificar última atividade de toque (data_realizada mais recente)
        let dtUltimoToqueRealizado = null
        const listaToques = toquesPorEmpresa[empId] || []
        for (let tk = 0; tk < listaToques.length; tk++) {
          const recT = listaToques[tk]
          const dtReal = recT.getString('data_realizada')
          if (dtReal) {
            const dtT = new Date(dtReal)
            if (!isNaN(dtT.getTime())) {
              if (!dtUltimoToqueRealizado || dtT.getTime() > dtUltimoToqueRealizado.getTime()) {
                dtUltimoToqueRealizado = dtT
              }
            }
          }
        }

        // Última data com movimento significativo: a mais recente entre entrada na etapa e último toque realizado
        let dtUltimaAtividade = dtEntrada
        if (
          dtUltimoToqueRealizado &&
          dtUltimoToqueRealizado.getTime() > dtUltimaAtividade.getTime()
        ) {
          dtUltimaAtividade = dtUltimoToqueRealizado
        }

        const diasSemProgresso = Math.max(
          0,
          Math.floor((agoraMs - dtUltimaAtividade.getTime()) / (1000 * 60 * 60 * 24)),
        )

        if (diasSemProgresso >= diasEstagnacaoLimite) {
          const proxAcaoData = emp.getString('proxima_acao_data')
          const proxAcaoDesc = emp.getString('proxima_acao_desc')

          let situacaoAcao = 'sem_acao'
          if (!proxAcaoData) {
            situacaoAcao = 'vazia'
          } else {
            const dtProx = new Date(proxAcaoData)
            if (!isNaN(dtProx.getTime()) && dtProx.getTime() < agoraMs) {
              situacaoAcao = 'vencida'
            } else {
              situacaoAcao = 'agendada'
            }
          }

          empresasEstagnadas.push({
            id: emp.id,
            razao_social: emp.getString('razao_social'),
            nome_fantasia: emp.getString('nome_fantasia'),
            cnpj: emp.getString('cnpj'),
            curva: emp.getString('curva') || 'C',
            etapa_atual: etapaAtual,
            etapa_label: ETAPAS_LABELS[etapaAtual] || etapaAtual,
            dias_parados: diasSemProgresso,
            data_ultima_atividade: dtUltimaAtividade.toISOString(),
            proxima_acao_data: proxAcaoData,
            proxima_acao_desc: proxAcaoDesc,
            situacao_acao: situacaoAcao, // 'vazia' | 'vencida' | 'agendada'
            responsavel_id: emp.getString('responsavel'),
          })
        }
      }

      // Ordenar estagnadas: maior dias_parados primeiro
      empresasEstagnadas.sort((a, b) => b.dias_parados - a.dias_parados)

      // ---------------------------------------------------------
      // BLOCO C: Conversão Etapa -> Etapa e Saídas (Descartes)
      // ---------------------------------------------------------
      // Funil sequencial principal de vendas:
      // identificada -> qualificada -> em_cadencia -> em_conversa -> com_proposta_elaborada -> proposta_enviada -> parceira
      // Paralelamente: saídas para 'inativa' ou 'nutricao_mensal' registradas a partir de cada etapa
      // Contabilizamos:
      // 1. Quantas empresas passaram por ou estão em cada etapa
      // 2. Quantas avançaram para a etapa seguinte
      // 3. Taxa de conversão percentual = (avançaram / total_etapa) * 100
      // 4. Quantas saíram para descarte (inativa / nutricao) a partir dessa etapa

      const FUNIL_FLUXO_PRINCIPAL = [
        'identificada',
        'qualificada',
        'em_cadencia',
        'em_conversa',
        'com_proposta_elaborada',
        'proposta_enviada',
        'parceira',
      ]

      // Mapear transições por etapa de origem:
      // avancaram: para qualquer etapa posterior do funil principal
      // sairam: para 'inativa' ou 'nutricao_mensal'
      const transicoesOrigem = {}
      for (let f = 0; f < FUNIL_FLUXO_PRINCIPAL.length; f++) {
        const eOrig = FUNIL_FLUXO_PRINCIPAL[f]
        transicoesOrigem[eOrig] = {
          avancaram: 0,
          descartadas: 0,
          atuais: dadosEtapa[eOrig] ? dadosEtapa[eOrig].empresas_atuais_count : 0,
        }
      }

      for (const empId in historicoPorEmpresa) {
        const hist = historicoPorEmpresa[empId]
        for (let h = 0; h < hist.length; h++) {
          const item = hist[h]
          const proximo = hist[h + 1]
          if (proximo) {
            const de = item.etapa
            const para = proximo.etapa

            if (transicoesOrigem[de]) {
              const idxDe = FUNIL_FLUXO_PRINCIPAL.indexOf(de)
              const idxPara = FUNIL_FLUXO_PRINCIPAL.indexOf(para)

              if (para === 'inativa' || para === 'nutricao_mensal') {
                transicoesOrigem[de].descartadas++
              } else if (idxPara > idxDe) {
                transicoesOrigem[de].avancaram++
              }
            }
          }
        }
      }

      const fluxoConversao = []
      for (let f = 0; f < FUNIL_FLUXO_PRINCIPAL.length; f++) {
        const etapa = FUNIL_FLUXO_PRINCIPAL[f]
        const proximaEtapa =
          f < FUNIL_FLUXO_PRINCIPAL.length - 1 ? FUNIL_FLUXO_PRINCIPAL[f + 1] : null
        const dados = transicoesOrigem[etapa] || { avancaram: 0, descartadas: 0, atuais: 0 }

        // Total que ingressou ou passou por esta etapa
        const totalPassaram = dados.avancaram + dados.descartadas + dados.atuais
        const taxaConversao =
          totalPassaram > 0 ? Math.round((dados.avancaram / totalPassaram) * 1000) / 10 : 0
        const taxaDescarte =
          totalPassaram > 0 ? Math.round((dados.descartadas / totalPassaram) * 1000) / 10 : 0

        fluxoConversao.push({
          etapa: etapa,
          label: ETAPAS_LABELS[etapa] || etapa,
          proxima_etapa: proximaEtapa,
          proxima_label: proximaEtapa ? ETAPAS_LABELS[proximaEtapa] || proximaEtapa : null,
          total_na_etapa: totalPassaram,
          atuais_paradas: dados.atuais,
          avancaram: dados.avancaram,
          taxa_conversao_pct: taxaConversao,
          descartadas: dados.descartadas,
          taxa_descarte_pct: taxaDescarte,
        })
      }

      // ---------------------------------------------------------
      // BLOCO D: Descartes por Motivo
      // ---------------------------------------------------------
      // Coleta motivos de descarte/inativação de:
      // 1. Empresas inativas (com motivo_inativacao)
      // 2. Sugestões de prospecção descartadas (sugestoes_funil com status='descartada' e motivo_descarte)
      // Agrupamento com contagem e percentual, e lista dos descartes mais recentes

      const motivosAgrupados = {}
      const descartesRecentes = []

      // 1. Descartes de empresas inativas
      for (let eIdx = 0; eIdx < empresas.length; eIdx++) {
        const emp = empresas[eIdx]
        const isDesc =
          emp.getString('etapa_funil') === 'inativa' || emp.getString('status') === 'inativa'
        if (isDesc) {
          const motivo =
            emp.getString('motivo_inativacao') || 'Não especificado / Inativação manual'
          if (!motivosAgrupados[motivo]) {
            motivosAgrupados[motivo] = { motivo: motivo, total: 0, tipo_origem: 'empresa' }
          }
          motivosAgrupados[motivo].total++

          descartesRecentes.push({
            id: emp.id,
            origem: 'empresa',
            nome: emp.getString('nome_fantasia') || emp.getString('razao_social'),
            cnpj: emp.getString('cnpj'),
            motivo: motivo,
            etapa_origem: emp.getString('etapa_anterior') || 'Funil de Vendas',
            data_descarte: emp.getString('updated') || emp.getString('created'),
          })
        }
      }

      // 2. Descartes da fila de sugestões do funil
      const sugestoesDescartadas = $app.findRecordsByFilter(
        'sugestoes_funil',
        "status = 'descartada'",
        '-data_decisao,-updated',
        1000,
        0,
      )

      for (let s = 0; s < sugestoesDescartadas.length; s++) {
        const sug = sugestoesDescartadas[s]
        const motivo = sug.getString('motivo_descarte') || 'Sem motivo registrado (Sugestão)'
        if (!motivosAgrupados[motivo]) {
          motivosAgrupados[motivo] = { motivo: motivo, total: 0, tipo_origem: 'sugestao' }
        }
        motivosAgrupados[motivo].total++

        descartesRecentes.push({
          id: sug.id,
          origem: 'sugestao',
          nome: sug.getString('nome_fantasia') || sug.getString('razao_social'),
          cnpj: sug.getString('cnpj'),
          motivo: motivo,
          etapa_origem: 'Fila de Sugestões (' + (sug.getString('fonte') || 'planilha') + ')',
          data_descarte:
            sug.getString('data_decisao') || sug.getString('updated') || sug.getString('created'),
        })
      }

      // Calcular percentual de cada motivo
      let totalDescartesGeral = 0
      for (const m in motivosAgrupados) {
        totalDescartesGeral += motivosAgrupados[m].total
      }

      const motivosLista = []
      for (const m in motivosAgrupados) {
        const qtd = motivosAgrupados[m].total
        const pct =
          totalDescartesGeral > 0 ? Math.round((qtd / totalDescartesGeral) * 1000) / 10 : 0
        motivosLista.push({
          motivo: m,
          total: qtd,
          percentual: pct,
          tipo_origem: motivosAgrupados[m].tipo_origem,
        })
      }

      // Ordenar motivos por total desc
      motivosLista.sort((a, b) => b.total - a.total)

      // Ordenar descartes recentes pela data mais nova
      descartesRecentes.sort((a, b) => {
        const dtA = new Date(a.data_descarte || 0).getTime()
        const dtB = new Date(b.data_descarte || 0).getTime()
        return dtB - dtA
      })

      // Limitar a lista de recentes aos 10 primeiros
      const descartesRecentes10 = descartesRecentes.slice(0, 10)

      // ---------------------------------------------------------
      // BLOCO E: Sugestões de Fim de Funil (Nutrição Mensal)
      // ---------------------------------------------------------
      // Critério EXATO: lead na última etapa (proposta_enviada)
      // confirmada há mais de 7 DIAS sem resposta positiva (sem proposta aceita).
      // Apenas sugestão — o sistema NUNCA migra sozinho.
      const sugestoesNutricao = []
      const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

      // Carregar todas as propostas aceitas para indexar por empresa
      const propostasAceitas = $app.findRecordsByFilter(
        'propostas',
        "status = 'aceita'",
        '',
        5000,
        0,
      )
      const empresasComPropostaAceita = {}
      for (let pa = 0; pa < propostasAceitas.length; pa++) {
        const empP = propostasAceitas[pa].getString('empresa')
        if (empP) empresasComPropostaAceita[empP] = true
      }

      for (let eIdx = 0; eIdx < empresas.length; eIdx++) {
        const emp = empresas[eIdx]
        const etapaAtual = emp.getString('etapa_funil')
        if (etapaAtual !== 'proposta_enviada') {
          continue
        }

        const empId = emp.id
        // Se já possui proposta aceita, não é fim de funil sem conversão
        if (empresasComPropostaAceita[empId]) {
          continue
        }

        const dtEntrada = empresasDataEntradaEtapa[empId] || new Date(emp.getString('created'))
        const tempoMs = agoraMs - dtEntrada.getTime()
        const diasNaEtapa = Math.max(0, Math.floor(tempoMs / (1000 * 60 * 60 * 24)))

        if (diasNaEtapa > 7) {
          sugestoesNutricao.push({
            id: empId,
            razao_social: emp.getString('razao_social'),
            nome_fantasia: emp.getString('nome_fantasia'),
            cnpj: emp.getString('cnpj'),
            curva: emp.getString('curva') || 'C',
            etapa_funil: etapaAtual,
            dias_na_etapa: diasNaEtapa,
            data_entrada_etapa: dtEntrada.toISOString(),
            responsavel_id: emp.getString('responsavel'),
            email: emp.getString('email'),
            telefone: emp.getString('telefone'),
          })
        }
      }

      // Ordenar sugestões de nutrição pelo maior tempo na etapa
      sugestoesNutricao.sort((a, b) => b.dias_na_etapa - a.dias_na_etapa)

      // Resumo executivo superior
      const resumo = {
        total_empresas: empresas.length,
        total_estagnadas: empresasEstagnadas.length,
        total_sugestoes_nutricao: sugestoesNutricao.length,
        dias_estagnacao_limite: diasEstagnacaoLimite,
        total_descartes: totalDescartesGeral,
        etapa_maior_gargalo: etapaComMaiorAcumulo
          ? ETAPAS_LABELS[etapaComMaiorAcumulo] || etapaComMaiorAcumulo
          : 'Nenhuma',
        calculado_em: agora.toISOString(),
      }

      return e.json(200, {
        resumo: resumo,
        tempo_por_etapa: tempoPorEtapaLista,
        empresas_estagnadas: empresasEstagnadas,
        conversao_etapas: fluxoConversao,
        descartes_por_motivo: {
          total: totalDescartesGeral,
          agrupado: motivosLista,
          recentes: descartesRecentes10,
        },
        sugestoes_nutricao: sugestoesNutricao,
      })
    } catch (err) {
      console.log('Erro ao calcular Painel de Saude do Funil: ' + err)
      return e.json(500, { message: 'Erro interno ao processar saúde do funil: ' + err })
    }
  },
  $apis.requireAuth(),
)
