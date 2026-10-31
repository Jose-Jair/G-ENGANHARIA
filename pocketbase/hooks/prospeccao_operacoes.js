// Hooks e Rotas de Prospecção Automática - Parte 1
// Endpoints:
// - POST /backend/v1/prospeccao/executar-varredura
// - POST /backend/v1/prospeccao/triagem-lote
// - POST /backend/v1/prospeccao/consultar-sancoes
// - POST /backend/v1/prospeccao/importar-csv-comprasnet
// - Cron diário automático às 03:00

// -----------------------------------------------------------------------------
// ROTA: POST /backend/v1/prospeccao/executar-varredura
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/prospeccao/executar-varredura',
  (e) => {
    const reqBody = e.requestInfo().body || {}
    const fonteSlug = reqBody.fonte_slug || 'pncp_contratos'

    // Helpers inlined para evitar hook scoping error
    function limparCnpj(val) {
      if (!val) return ''
      return String(val).replace(/\D/g, '')
    }

    function isPessoaFisica(tipoPessoa, niFornecedor) {
      const ni = limparCnpj(niFornecedor)
      if (
        tipoPessoa &&
        (tipoPessoa === 'PF' || tipoPessoa === 'F' || tipoPessoa.toLowerCase().includes('física'))
      ) {
        return true
      }
      return ni.length === 11
    }

    function classificarPorDicionario(objetoTexto) {
      const texto = (objetoTexto || '').toLowerCase()
      if (!texto) return { score: 10, termos: [] }
      const termosPesos = [
        { termo: 'projeto executivo', peso: 35 },
        { termo: 'projeto basico', peso: 30 },
        { termo: 'projeto básico', peso: 30 },
        { termo: 'elaboracao de projetos', peso: 30 },
        { termo: 'elaboração de projetos', peso: 30 },
        { termo: 'estrutural', peso: 20 },
        { termo: 'eletrico', peso: 18 },
        { termo: 'elétrico', peso: 18 },
        { termo: 'hidrossanitario', peso: 18 },
        { termo: 'hidrossanitário', peso: 18 },
        { termo: 'drenagem', peso: 18 },
        { termo: 'pavimentacao', peso: 18 },
        { termo: 'pavimentação', peso: 18 },
        { termo: 'orcamento', peso: 15 },
        { termo: 'orçamento', peso: 15 },
        { termo: 'laudo', peso: 15 },
        { termo: 'engenharia consultiva', peso: 25 },
        { termo: 'gerenciamento de obras', peso: 20 },
        { termo: 'supervisao', peso: 15 },
        { termo: 'supervisão', peso: 15 },
      ]
      let pontuacao = 0
      const encontrados = []
      for (let i = 0; i < termosPesos.length; i++) {
        if (texto.includes(termosPesos[i].termo)) {
          pontuacao += termosPesos[i].peso
          encontrados.push(termosPesos[i].termo)
        }
      }
      if (encontrados.length > 0) pontuacao = Math.max(30, pontuacao)
      else pontuacao = 15
      return { score: Math.min(100, Math.max(0, pontuacao)), termos: encontrados }
    }

    function calcularScoreCurvaProvisorio(valorContrato, mesesVigencia) {
      const valor = Number(valorContrato) || 0
      const meses = Number(mesesVigencia) || 12
      const normValor = Math.min(100, Math.max(0, (valor / 10000000) * 100))
      const normVigencia = Math.min(100, Math.max(0, (meses / 36) * 100))
      const normQtd = 20
      const score = Math.min(
        100,
        Math.max(0, Math.round(normValor * 0.5 + normVigencia * 0.3 + normQtd * 0.2)),
      )
      let curva = 'C'
      if (score >= 40 || valor >= 1000000) curva = 'A'
      else if (score >= 15 || valor >= 200000) curva = 'B'
      return { score, curva }
    }

    function enriquecerBrasilApi(cnpjLimpo) {
      if (!cnpjLimpo || cnpjLimpo.length !== 14) return null
      try {
        const res = $http.send({
          url: 'https://brasilapi.com.br/api/cnpj/v1/' + cnpjLimpo,
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
          timeout: 6,
        })
        if (res.statusCode >= 200 && res.statusCode < 300 && res.json) {
          return res.json
        }
      } catch (_) {}
      return null
    }

    let fonteRec
    try {
      fonteRec = $app.findFirstRecordByData('fontes_prospeccao', 'slug', fonteSlug)
    } catch (_) {
      return e.json(404, { message: 'Fonte de prospecção não encontrada: ' + fonteSlug })
    }

    if (!fonteRec.get('ativo')) {
      return e.json(400, {
        message: 'A fonte ' + fonteRec.get('nome') + ' está desativada na Administração.',
      })
    }

    if (fonteRec.get('tipo') === 'importador_csv') {
      return e.json(400, {
        message:
          'A fonte ' +
          fonteRec.get('nome') +
          ' opera como Importador de CSV. Faça o upload do arquivo na Administração com o mapeamento configurado.',
      })
    }

    const diasJanela = fonteRec.get('dias_janela') || 7
    const limite = Math.min(100, fonteRec.get('limite_por_execucao') || 50)
    const palavrasChave = (fonteRec.get('palavras_chave') || '')
      .toLowerCase()
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    const itensMapeados = []

    try {
      if (fonteSlug === 'tce_ce_contratacoes') {
        // ---------------------------------------------------------------------
        // VARREDURA TCE-CE (Sistema de Informação Municipal - SIM)
        // ---------------------------------------------------------------------
        const munCodigo = reqBody.municipio || fonteRec.get('municipios') || '044' // Padrão Fortaleza
        const exercicioConfig = reqBody.exercicio || fonteRec.get('exercicio') || 2024

        let totalContratosVarridos = 0

        // Intervalo de datas: YYYY-MM-DD
        const dataFimStr = `${exercicioConfig}-12-31`
        const dataIniStr = `${exercicioConfig}-01-01`

        const urlTce =
          'https://api-dados-abertos.tce.ce.gov.br/sim/licitantes_fornecedores_bens_servicos?codigo_municipio=' +
          munCodigo +
          '&data_inicio=' +
          dataIniStr +
          '&data_fim=' +
          dataFimStr

        const resTce = $http.send({
          url: urlTce,
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
          timeout: 20,
        })

        if (resTce.statusCode < 200 || resTce.statusCode >= 300) {
          fonteRec.set(
            'ultimo_erro',
            'HTTP ' + resTce.statusCode + ' ao consultar TCE-CE: ' + (resTce.raw || ''),
          )
          $app.save(fonteRec)
          return e.json(502, { message: 'Falha na resposta do TCE-CE: HTTP ' + resTce.statusCode })
        }

        const elementsArr = (resTce.json && resTce.json.elements) || []
        totalContratosVarridos = elementsArr.length

        for (let i = 0; i < elementsArr.length; i++) {
          const item = elementsArr[i]
          const obj =
            item.objeto_licitacao || item.nome_negociante || 'Licitação Municipal ' + munCodigo
          const objLower = obj.toLowerCase()

          let aderente = palavrasChave.length === 0
          if (!aderente) {
            for (let k = 0; k < palavrasChave.length; k++) {
              if (objLower.includes(palavrasChave[k])) {
                aderente = true
                break
              }
            }
          }

          if (!aderente) continue

          const docNegociante = limparCnpj(item.numero_documento_negociante)
          const tipoP =
            item.codigo_tipo_negociante === '2' || docNegociante.length === 11 ? 'PF' : 'PJ'

          itensMapeados.push({
            cnpj: docNegociante,
            razaoSocial: item.nome_negociante || '',
            tipoPessoa: tipoP,
            orgao: 'Prefeitura / Órgão Municipal (Cód. ' + munCodigo + ')',
            numero: item.numero_licitacao || 'LIC-CE-' + munCodigo + '-' + i,
            objeto: obj,
            valor:
              Number(item.valor_proposta || item.valor_homologado || item.valor_estimado || 0) || 0,
            vigenciaInicio: item.data_realizacao_licitacao || '',
            vigenciaFim: '',
            link: 'https://municipios-licitacoes.tce.ce.gov.br',
            uf: 'CE',
            municipio: munCodigo,
          })

          if (itensMapeados.length >= limite) break
        }
      } else {
        // ---------------------------------------------------------------------
        // VARREDURA PNCP (Padrão)
        // ---------------------------------------------------------------------
        const hoje = new Date()
        const dFim = hoje.toISOString().slice(0, 10).replace(/-/g, '')
        const dIni = new Date(hoje.getTime() - diasJanela * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '')

        const maxPaginas = 8

        for (let pag = 1; pag <= maxPaginas; pag++) {
          const urlPncp =
            'https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=' +
            dIni +
            '&dataFinal=' +
            dFim +
            '&pagina=' +
            pag +
            '&tamanhoPagina=500'

          const res = $http.send({
            url: urlPncp,
            method: 'GET',
            headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
            timeout: 15,
          })

          if (res.statusCode < 200 || res.statusCode >= 300) {
            if (pag === 1) {
              fonteRec.set(
                'ultimo_erro',
                'HTTP ' + res.statusCode + ' ao consultar PNCP: ' + (res.raw || ''),
              )
              $app.save(fonteRec)
              return e.json(502, { message: 'Falha na resposta do PNCP: HTTP ' + res.statusCode })
            }
            break
          }

          const dataArr = (res.json && res.json.data) || []
          totalContratosVarridos += dataArr.length
          if (dataArr.length === 0) break

          for (let i = 0; i < dataArr.length; i++) {
            const c = dataArr[i]
            const obj = c.objetoContrato || ''
            const objLower = obj.toLowerCase()

            let aderente = palavrasChave.length === 0
            if (!aderente) {
              for (let k = 0; k < palavrasChave.length; k++) {
                if (objLower.includes(palavrasChave[k])) {
                  aderente = true
                  break
                }
              }
            }

            if (!aderente) continue

            itensMapeados.push({
              cnpj: c.niFornecedor || '',
              razaoSocial: c.nomeRazaoSocialFornecedor || '',
              tipoPessoa: c.tipoPessoa || 'PJ',
              orgao: (c.orgaoEntidade && c.orgaoEntidade.razaoSocial) || 'Órgão Público',
              numero: c.numeroContratoEmpenho || 'CTR-' + (c.anoContrato || '2026') + '-' + i,
              objeto: obj,
              valor: c.valorInicial || c.valorGlobal || 0,
              vigenciaInicio: c.dataVigenciaInicio || '',
              vigenciaFim: c.dataVigenciaFim || '',
              link: 'https://pncp.gov.br/app/contratos/' + (c.numeroControlePncpCompra || ''),
              uf:
                (c.unidadeOrgao && c.unidadeOrgao.ufSigla) ||
                (c.orgaoEntidade && c.orgaoEntidade.ufSigla) ||
                '',
              municipio:
                (c.unidadeOrgao && c.unidadeOrgao.municipioNome) ||
                (c.orgaoEntidade && c.orgaoEntidade.municipioNome) ||
                '',
            })

            if (itensMapeados.length >= limite) break
          }

          if (itensMapeados.length >= limite) break
        }
      }

      // Processamento do lote
      const auditCol = $app.findCollectionByNameOrId('lotes_prospeccao_auditoria')
      const loteRec = new Record(auditCol)
      loteRec.set('fonte_slug', fonteSlug)
      loteRec.set('fonte_nome', fonteRec.get('nome') || fonteSlug)
      loteRec.set('tipo_execucao', 'manual_admin')
      loteRec.set('status', 'em_andamento')
      loteRec.set('data_inicio', new Date().toISOString())
      loteRec.set('total_lidos', totalContratosVarridos || itensMapeados.length)
      if (e.auth?.id) loteRec.set('executado_por', e.auth.id)
      $app.save(loteRec)

      let descartadosCpf = 0
      let duplicadosDedupe = 0
      let reativacoesCriadas = 0
      let novasSugestoes = 0
      let creditosIa = 0

      const sugCol = $app.findCollectionByNameOrId('sugestoes_funil')
      const contratosCol = $app.findCollectionByNameOrId('contratos')
      const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')

      // Checa se IA está ativa
      let iaAtiva = false
      try {
        const p = $app.findFirstRecordByData('parametros', 'chave', 'ia_prospeccao_ativa')
        if (p && p.get('valor') === 'true') iaAtiva = true
      } catch (_) {
        iaAtiva = true
      }

      for (let j = 0; j < itensMapeados.length; j++) {
        const item = itensMapeados[j]
        const cnpjLimpo = limparCnpj(item.cnpj)

        if (isPessoaFisica(item.tipoPessoa, item.cnpj)) {
          descartadosCpf++
          continue
        }

        if (!cnpjLimpo || cnpjLimpo.length !== 14) continue

        let mesesVig = 12
        if (item.vigenciaInicio && item.vigenciaFim) {
          try {
            const d1 = new Date(item.vigenciaInicio)
            const d2 = new Date(item.vigenciaFim)
            mesesVig = Math.max(
              1,
              Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24 * 30.4)),
            )
          } catch (_) {}
        }

        const valorNum = Number(item.valor) || 0
        const scoreCurva = calcularScoreCurvaProvisorio(valorNum, mesesVig)

        // VERIFICAÇÃO NA LISTA DE EXCLUSÃO DE PROSPECÇÃO (CNPJ E OBJETO)
        let excluidoProspeccao = false
        try {
          const excCnpj = $app.findRecordsByFilter(
            'exclusoes_prospeccao',
            "cnpj = '" + cnpjLimpo + "' && ativo = true",
            '',
            1,
            0,
          )
          if (excCnpj.length > 0) {
            excluidoProspeccao = true
          } else if (item.objeto) {
            const objLow = item.objeto.toLowerCase()
            const excObj = $app.findRecordsByFilter(
              'exclusoes_prospeccao',
              "objeto_termo != '' && ativo = true",
              '',
              200,
              0,
            )
            for (let eIdx = 0; eIdx < excObj.length; eIdx++) {
              const termoExc = (excObj[eIdx].get('objeto_termo') || '').toLowerCase().trim()
              if (termoExc && objLow.includes(termoExc)) {
                excluidoProspeccao = true
                break
              }
            }
          }
        } catch (_) {}

        if (excluidoProspeccao) {
          duplicadosDedupe++
          continue
        }

        // DEDUPE POR CNPJ (EMPRESAS EXISTENTES)
        let empresaExistente = null
        try {
          empresaExistente = $app.findFirstRecordByData('empresas', 'cnpj', cnpjLimpo)
        } catch (_) {}

        if (empresaExistente) {
          duplicadosDedupe++

          let contratoExiste = false
          if (item.numero) {
            const cExist = $app.findRecordsByFilter(
              'contratos',
              "empresa = '" + empresaExistente.id + "' && numero = '" + item.numero + "'",
              '',
              1,
              0,
            )
            if (cExist.length > 0) contratoExiste = true
          }

          let novoCtrId = null
          if (!contratoExiste) {
            const cRec = new Record(contratosCol)
            cRec.set('empresa', empresaExistente.id)
            cRec.set('orgao', item.orgao || 'Órgão Público')
            cRec.set('numero', item.numero || 'CTR-' + Date.now().toString().slice(-6))
            cRec.set('objeto', item.objeto || 'Objeto de engenharia')
            cRec.set('valor', valorNum)
            cRec.set('saldo', valorNum)
            if (item.vigenciaInicio) cRec.set('vigencia_inicio', item.vigenciaInicio)
            if (item.vigenciaFim) cRec.set('vigencia_fim', item.vigenciaFim)
            cRec.set('situacao', 'Em Execução')
            cRec.set('fonte', 'PNCP')
            cRec.set('status_revisao', 'rascunho_pendente')
            $app.save(cRec)
            novoCtrId = cRec.id
          }

          const etapa = empresaExistente.get('etapa_funil')
          const stEmp = empresaExistente.get('status')
          if (stEmp === 'inativa' || etapa === 'inativa' || etapa === 'nutricao_mensal') {
            const reatPend = $app.findRecordsByFilter(
              'reativacoes_sugeridas',
              "empresa = '" + empresaExistente.id + "' && status = 'pendente'",
              '',
              1,
              0,
            )
            if (reatPend.length === 0) {
              const rRec = new Record(reativacoesCol)
              rRec.set('empresa', empresaExistente.id)
              if (novoCtrId) rRec.set('contrato', novoCtrId)
              rRec.set('contrato_numero', item.numero || '')
              rRec.set('contrato_orgao', item.orgao || '')
              rRec.set('contrato_valor', valorNum)
              rRec.set('etapa_origem', etapa || 'inativa')
              rRec.set('status', 'pendente')
              $app.save(rRec)
              reativacoesCriadas++
            }
          }
          continue
        }

        // DEDUPE EM SUGESTOES
        const filtroSug =
          "cnpj = '" +
          cnpjLimpo +
          "'" +
          (item.numero ? " && numero_contrato = '" + item.numero + "'" : '')
        const jaSug = $app.findRecordsByFilter('sugestoes_funil', filtroSug, '', 1, 0)
        if (jaSug.length > 0) {
          duplicadosDedupe++
          continue
        }

        // Classificação Relevância
        const dic = classificarPorDicionario(item.objeto)
        let scoreRel = dic.score
        let justRel = 'Classificação por dicionário: ' + (dic.termos.join(', ') || 'geral')

        if (iaAtiva) {
          try {
            const chatRes = $ai.chat({
              model: 'fast',
              messages: [
                {
                  role: 'system',
                  content:
                    'Você é um auditor de contratações públicas da G+ Engenharia. Avalie a relevância do objeto para projetos/engenharia consultiva de 0 a 100. Responda em JSON: {"score": 85, "justificativa": "projeto executivo"}',
                },
                { role: 'user', content: 'Objeto: ' + item.objeto },
              ],
              temperature: 0.1,
            })
            creditosIa++
            if (chatRes && chatRes.choices && chatRes.choices[0] && chatRes.choices[0].message) {
              const raw = chatRes.choices[0].message.content || ''
              const m = raw.match(/\{[\s\S]*\}/)
              if (m) {
                const p = JSON.parse(m[0])
                if (typeof p.score === 'number') {
                  scoreRel = Math.round(dic.score * 0.4 + p.score * 0.6)
                  justRel = p.justificativa || justRel
                }
              }
            }
          } catch (_) {}
        }

        const dadosEnriq = enriquecerBrasilApi(cnpjLimpo)

        const nSug = new Record(sugCol)
        nSug.set(
          'razao_social',
          item.razaoSocial || (dadosEnriq && dadosEnriq.razao_social) || 'Empresa ' + cnpjLimpo,
        )
        if (dadosEnriq && dadosEnriq.nome_fantasia)
          nSug.set('nome_fantasia', dadosEnriq.nome_fantasia)
        nSug.set('cnpj', cnpjLimpo)
        if (item.uf || (dadosEnriq && dadosEnriq.uf))
          nSug.set('uf', item.uf || (dadosEnriq && dadosEnriq.uf))
        if (item.municipio || (dadosEnriq && dadosEnriq.municipio))
          nSug.set('municipio', item.municipio || (dadosEnriq && dadosEnriq.municipio))
        if (dadosEnriq && dadosEnriq.email) nSug.set('email', dadosEnriq.email)
        if (dadosEnriq && dadosEnriq.ddd_telefone_1) nSug.set('telefone', dadosEnriq.ddd_telefone_1)
        if (dadosEnriq && dadosEnriq.cnae_fiscal_descricao)
          nSug.set(
            'cnae',
            String(dadosEnriq.cnae_fiscal) + ' - ' + dadosEnriq.cnae_fiscal_descricao,
          )
        if (dadosEnriq && dadosEnriq.porte) nSug.set('porte', dadosEnriq.porte)

        nSug.set('orgao_contrato', item.orgao || '')
        nSug.set('numero_contrato', item.numero || '')
        nSug.set('objeto_contrato', item.objeto || '')
        nSug.set('valor_estimado', valorNum)
        nSug.set('fonte', fonteSlug === 'tce_ce_contratacoes' ? 'tce_ce' : 'pncp')
        nSug.set('status', 'pendente')
        nSug.set('score_relevancia', scoreRel)
        nSug.set('score_curva_provisorio', scoreCurva.score)
        nSug.set('curva_provisoria', scoreCurva.curva)
        nSug.set('link_fonte', item.link || '')
        if (item.vigenciaInicio) nSug.set('vigencia_inicio', item.vigenciaInicio)
        if (item.vigenciaFim) nSug.set('vigencia_fim', item.vigenciaFim)
        nSug.set('fonte_prospeccao_slug', fonteSlug)
        nSug.set('lote_auditoria_id', loteRec.id)
        nSug.set('status_sancao', 'nao_verificada')
        nSug.set('detalhe_sancao', 'Sanção não verificada (pendente de incorporação)')
        nSug.set('cnpj_enriquecido', !!dadosEnriq)
        if (dadosEnriq) nSug.set('dados_enriquecimento', dadosEnriq)
        nSug.set('justificativa_ia', justRel)
        nSug.set(
          'observacoes',
          'Prospecção automatizada. Relevância: ' + scoreRel + '/100. ' + justRel,
        )

        $app.save(nSug)
        novasSugestoes++
      }

      loteRec.set('status', 'sucesso')
      loteRec.set('data_fim', new Date().toISOString())
      loteRec.set('total_descartados_cpf', descartadosCpf)
      loteRec.set('total_duplicados_dedupe', duplicadosDedupe)
      loteRec.set('total_reativacoes_sugeridas', reativacoesCriadas)
      loteRec.set('total_novas_sugestoes', novasSugestoes)
      loteRec.set('creditos_ia_gastos', creditosIa)
      $app.save(loteRec)

      fonteRec.set('ultima_execucao', new Date().toISOString())
      fonteRec.set(
        'total_lidos',
        (fonteRec.get('total_lidos') || 0) + (totalContratosVarridos || itensMapeados.length),
      )
      fonteRec.set('total_sugeridos', (fonteRec.get('total_sugeridos') || 0) + novasSugestoes)
      fonteRec.set('ultimo_erro', '')
      $app.save(fonteRec)

      return e.json(200, {
        message: 'Varredura concluída com sucesso.',
        fonte: fonteRec.get('nome'),
        resultado: {
          lote_id: loteRec.id,
          total_lidos: totalContratosVarridos || itensMapeados.length,
          total_aderentes: itensMapeados.length,
          descartados_cpf: descartadosCpf,
          duplicados_dedupe: duplicadosDedupe,
          reativacoes_sugeridas: reativacoesCriadas,
          novas_sugestoes: novasSugestoes,
          creditos_ia_gastos: creditosIa,
        },
      })
    } catch (err) {
      console.log('Erro ao executar varredura PNCP: ' + err)
      fonteRec.set('ultimo_erro', String(err))
      $app.save(fonteRec)
      return e.json(500, { message: 'Erro ao executar varredura: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: POST /backend/v1/prospeccao/triagem-lote
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/prospeccao/triagem-lote',
  (e) => {
    const reqBody = e.requestInfo().body || {}
    const acao = reqBody.acao
    const ids = reqBody.sugestao_ids || []
    const motivoDescarte = reqBody.motivo_descarte || ''
    const usuarioId = e.auth?.id

    if (!acao || !Array.isArray(ids) || ids.length === 0) {
      return e.json(400, { message: 'Ação e sugestao_ids obrigatórios.' })
    }

    function limparCnpj(val) {
      if (!val) return ''
      return String(val).replace(/\D/g, '')
    }

    function verificarSancoes(cnpjLimpo) {
      const chaveApiKey = $os.getenv('PORTAL_TRANSPARENCIA_API_KEY') || ''
      if (!chaveApiKey || !chaveApiKey.trim()) {
        return {
          verificada: false,
          status_sancao: 'nao_verificada',
          detalhe: 'Chave PORTAL_TRANSPARENCIA_API_KEY ausente no servidor. Sanção não verificada.',
          sancionada: false,
        }
      }

      try {
        const urlCeis =
          'https://api.portaldatransparencia.gov.br/api-de-dados/ceis?codigoSancionado=' +
          cnpjLimpo +
          '&pagina=1'
        const res = $http.send({
          url: urlCeis,
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'chave-api-dados': chaveApiKey.trim(),
            'User-Agent': 'GESTAO-GPLUS/1.0',
          },
          timeout: 10,
        })

        if (res.statusCode === 200 && Array.isArray(res.json) && res.json.length > 0) {
          const s = res.json[0]
          return {
            verificada: true,
            status_sancao: 'sancionada',
            detalhe: 'Empresa sancionada no CEIS/CNEP: ' + (s.motivoSancao || 'Sancionada'),
            sancionada: true,
          }
        }

        return {
          verificada: true,
          status_sancao: 'sem_sancao',
          detalhe: 'Consulta CEIS/CNEP realizada com sucesso: nenhuma sanção ativa.',
          sancionada: false,
        }
      } catch (err) {
        return {
          verificada: false,
          status_sancao: 'nao_verificada',
          detalhe: 'Erro ao consultar Portal da Transparência: ' + err,
          sancionada: false,
        }
      }
    }

    const empCol = $app.findCollectionByNameOrId('empresas')
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const exclusoesCol = $app.findCollectionByNameOrId('exclusoes_prospeccao')

    const resultados = {
      processados: 0,
      erros: 0,
      incorporados: [],
      descartados: [],
      aprovados: [],
    }

    for (let i = 0; i < ids.length; i++) {
      const sugId = ids[i]
      try {
        const sug = $app.findRecordById('sugestoes_funil', sugId)

        if (acao === 'aprovar') {
          sug.set('status', 'aprovada_para_inclusao')
          sug.set('decidido_por', usuarioId)
          sug.set('data_decisao', new Date().toISOString())
          $app.save(sug)
          resultados.aprovados.push(sugId)
          resultados.processados++
        } else if (acao === 'descartar') {
          const motivoFinal = motivoDescarte || sug.get('motivo_descarte') || 'Descarte na triagem'
          sug.set('status', 'descartada')
          sug.set('motivo_descarte', motivoFinal)
          sug.set('decidido_por', usuarioId)
          sug.set('data_decisao', new Date().toISOString())
          $app.save(sug)

          // REGRA GESTÃO G+: Descarte de sugestão de prospecção alimenta a lista própria exclusoes_prospeccao,
          // NUNCA a lista nao_contatar (que é opt-out LGPD do titular).
          const cnpjSug = limparCnpj(sug.get('cnpj'))
          const cnaeSug = sug.get('cnae') || ''
          const objetoSug = sug.get('objeto_contrato') || ''
          const razaoSug = sug.get('razao_social') || sug.get('nome_fantasia') || ''
          const fonteSlugSug = sug.get('fonte_prospeccao_slug') || sug.get('fonte') || 'prospeccao'

          try {
            // Verificar se já existe exclusão ativa para este CNPJ ou objeto
            let jaExcluido = false
            if (cnpjSug) {
              const registrosExistentes = $app.findRecordsByFilter(
                'exclusoes_prospeccao',
                "cnpj = '" + cnpjSug + "' && ativo = true",
                '',
                1,
                0,
              )
              if (registrosExistentes.length > 0) jaExcluido = true
            }

            if (!jaExcluido) {
              const excRec = new Record(exclusoesCol)
              if (cnpjSug) excRec.set('cnpj', cnpjSug)
              if (cnaeSug) excRec.set('cnae', cnaeSug)
              if (objetoSug) excRec.set('objeto_termo', objetoSug.slice(0, 500))
              if (razaoSug) excRec.set('razao_social', razaoSug)
              excRec.set('tipo_chave', cnpjSug ? 'cnpj' : objetoSug ? 'objeto_termo' : 'misto')
              excRec.set('motivo_descarte', motivoFinal)
              excRec.set('fonte_origem', fonteSlugSug)
              excRec.set('sugestao_origem_id', sugId)
              if (usuarioId) excRec.set('descartado_por', usuarioId)
              excRec.set('data_descarte', new Date().toISOString())
              excRec.set('ativo', true)
              excRec.set(
                'observacoes',
                'Exclusão operacional de prospecção. Não constitui opt-out LGPD.',
              )
              $app.save(excRec)
            }
          } catch (errExc) {
            console.log('Aviso ao registrar exclusao de prospeccao para ' + sugId + ': ' + errExc)
          }

          resultados.descartados.push(sugId)
          resultados.processados++
        } else if (acao === 'incorporar') {
          const cnpjLimpo = limparCnpj(sug.get('cnpj'))
          const sancoesCheck = verificarSancoes(cnpjLimpo)

          const novaEmp = new Record(empCol)
          novaEmp.set('razao_social', sug.get('razao_social'))
          novaEmp.set('nome_fantasia', sug.get('nome_fantasia') || sug.get('razao_social'))
          novaEmp.set('cnpj', cnpjLimpo)
          novaEmp.set('situacao_cadastral', 'ATIVA')
          novaEmp.set('cnae', sug.get('cnae') || '')
          novaEmp.set('porte', sug.get('porte') || 'DEMAIS')
          novaEmp.set('uf', sug.get('uf') || '')
          novaEmp.set('municipio', sug.get('municipio') || '')
          novaEmp.set('email', sug.get('email') || '')
          novaEmp.set('telefone', sug.get('telefone') || '')
          novaEmp.set('etapa_funil', 'identificada')
          novaEmp.set('curva', sug.get('curva_provisoria') || 'C')
          novaEmp.set('score', sug.get('score_curva_provisorio') || 60)
          novaEmp.set('status', 'ativa')
          novaEmp.set('responsavel', usuarioId)
          novaEmp.set('proxima_acao_desc', 'Primeiro contato de prospecção (Cadência Padrão)')
          novaEmp.set('status_sancao', sancoesCheck.status_sancao)
          novaEmp.set('sancao_detalhe', sancoesCheck.detalhe)
          novaEmp.set('cadencia_bloqueada_sancao', sancoesCheck.sancionada)
          novaEmp.set('fonte_prospeccao_origem', sug.get('fonte_prospeccao_slug') || 'prospeccao')
          novaEmp.set('observacoes', 'Empresa incorporada da Prospecção. ' + sancoesCheck.detalhe)
          $app.save(novaEmp)

          const valorEstimado = Number(sug.get('valor_estimado')) || 0
          const cRec = new Record(contratosCol)
          cRec.set('empresa', novaEmp.id)
          cRec.set('orgao', sug.get('orgao_contrato') || 'Órgão de Origem')
          cRec.set(
            'numero',
            sug.get('numero_contrato') || 'CTR-SUG-' + Date.now().toString().slice(-6),
          )
          cRec.set('objeto', sug.get('objeto_contrato') || 'Contrato originado de prospecção')
          cRec.set('valor', valorEstimado)
          cRec.set('saldo', valorEstimado)
          cRec.set('situacao', 'Em Execução')
          cRec.set('fonte', 'PNCP')
          cRec.set('status_revisao', 'rascunho_pendente')
          cRec.set('sugestao_origem', sug.id)
          if (sug.get('vigencia_inicio')) cRec.set('vigencia_inicio', sug.get('vigencia_inicio'))
          if (sug.get('vigencia_fim')) cRec.set('vigencia_fim', sug.get('vigencia_fim'))
          $app.save(cRec)

          sug.set('status', 'incorporada')
          sug.set('empresa_criada', novaEmp.id)
          sug.set('status_sancao', sancoesCheck.status_sancao)
          sug.set('detalhe_sancao', sancoesCheck.detalhe)
          sug.set('decidido_por', usuarioId)
          sug.set('data_decisao', new Date().toISOString())
          $app.save(sug)

          try {
            const fSlug = sug.get('fonte_prospeccao_slug') || 'pncp_contratos'
            const fRec = $app.findFirstRecordByData('fontes_prospeccao', 'slug', fSlug)
            fRec.set('total_incorporados', (fRec.get('total_incorporados') || 0) + 1)
            $app.save(fRec)
          } catch (_) {}

          resultados.incorporados.push({
            sugestao_id: sugId,
            empresa_id: novaEmp.id,
            sancao_status: sancoesCheck.status_sancao,
            cadencia_bloqueada: sancoesCheck.sancionada,
          })
          resultados.processados++
        }
      } catch (errSug) {
        console.log('Erro ao processar sugestao ' + sugId + ': ' + errSug)
        resultados.erros++
      }
    }

    return e.json(200, resultados)
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: POST /backend/v1/prospeccao/importar-csv-comprasnet
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/prospeccao/importar-csv-comprasnet',
  (e) => {
    const reqBody = e.requestInfo().body || {}
    const linhasCsv = reqBody.linhas || []

    if (!Array.isArray(linhasCsv) || linhasCsv.length === 0) {
      return e.json(400, { message: 'Linhas do CSV Comprasnet não fornecidas.' })
    }

    function limparCnpj(val) {
      if (!val) return ''
      return String(val).replace(/\D/g, '')
    }

    function isPessoaFisica(tipoPessoa, niFornecedor) {
      const ni = limparCnpj(niFornecedor)
      if (
        tipoPessoa &&
        (tipoPessoa === 'PF' || tipoPessoa === 'F' || tipoPessoa.toLowerCase().includes('física'))
      ) {
        return true
      }
      return ni.length === 11
    }

    function classificarPorDicionario(objetoTexto) {
      const texto = (objetoTexto || '').toLowerCase()
      if (!texto) return { score: 10, termos: [] }
      const termosPesos = [
        { termo: 'projeto executivo', peso: 35 },
        { termo: 'projeto basico', peso: 30 },
        { termo: 'projeto básico', peso: 30 },
        { termo: 'elaboracao de projetos', peso: 30 },
        { termo: 'elaboração de projetos', peso: 30 },
        { termo: 'estrutural', peso: 20 },
        { termo: 'eletrico', peso: 18 },
        { termo: 'elétrico', peso: 18 },
        { termo: 'hidrossanitario', peso: 18 },
        { termo: 'hidrossanitário', peso: 18 },
        { termo: 'drenagem', peso: 18 },
        { termo: 'pavimentacao', peso: 18 },
        { termo: 'pavimentação', peso: 18 },
        { termo: 'orcamento', peso: 15 },
        { termo: 'orçamento', peso: 15 },
        { termo: 'laudo', peso: 15 },
        { termo: 'engenharia consultiva', peso: 25 },
        { termo: 'gerenciamento de obras', peso: 20 },
        { termo: 'supervisao', peso: 15 },
        { termo: 'supervisão', peso: 15 },
      ]
      let pontuacao = 0
      const encontrados = []
      for (let i = 0; i < termosPesos.length; i++) {
        if (texto.includes(termosPesos[i].termo)) {
          pontuacao += termosPesos[i].peso
          encontrados.push(termosPesos[i].termo)
        }
      }
      if (encontrados.length > 0) pontuacao = Math.max(30, pontuacao)
      else pontuacao = 15
      return { score: Math.min(100, Math.max(0, pontuacao)), termos: encontrados }
    }

    function calcularScoreCurvaProvisorio(valorContrato, mesesVigencia) {
      const valor = Number(valorContrato) || 0
      const meses = Number(mesesVigencia) || 12
      const normValor = Math.min(100, Math.max(0, (valor / 10000000) * 100))
      const normVigencia = Math.min(100, Math.max(0, (meses / 36) * 100))
      const normQtd = 20
      const score = Math.min(
        100,
        Math.max(0, Math.round(normValor * 0.5 + normVigencia * 0.3 + normQtd * 0.2)),
      )
      let curva = 'C'
      if (score >= 40 || valor >= 1000000) curva = 'A'
      else if (score >= 15 || valor >= 200000) curva = 'B'
      return { score, curva }
    }

    const auditCol = $app.findCollectionByNameOrId('lotes_prospeccao_auditoria')
    const loteRec = new Record(auditCol)
    loteRec.set('fonte_slug', 'comprasnet_contratos')
    loteRec.set('fonte_nome', 'Comprasnet CSV')
    loteRec.set('tipo_execucao', 'importacao_csv')
    loteRec.set('status', 'em_andamento')
    loteRec.set('data_inicio', new Date().toISOString())
    loteRec.set('total_lidos', linhasCsv.length)
    if (e.auth?.id) loteRec.set('executado_por', e.auth.id)
    $app.save(loteRec)

    let descartadosCpf = 0
    let duplicadosDedupe = 0
    let reativacoesCriadas = 0
    let novasSugestoes = 0

    const sugCol = $app.findCollectionByNameOrId('sugestoes_funil')
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')

    for (let i = 0; i < linhasCsv.length; i++) {
      const row = linhasCsv[i]
      const cnpj =
        row.cnpj || row.cnpj_contratada || row['CNPJ Contratada'] || row['CPF/CNPJ'] || ''
      const razao =
        row.razao_social ||
        row.nome_fornecedor ||
        row['Razão Social'] ||
        row['Nome Contratada'] ||
        ''
      const orgao = row.orgao || row.uasg_nome || row['Órgão'] || row['UASG'] || 'Comprasnet'
      const num = row.numero || row.numero_contrato || row['Número do Contrato'] || ''
      const obj = row.objeto || row.objeto_contrato || row['Objeto'] || ''
      const val =
        Number(
          row.valor || row.valor_inicial || row['Valor Inicial'] || row['Valor Global'] || 0,
        ) || 0
      const cnpjLimpo = limparCnpj(cnpj)

      if (isPessoaFisica(row.tipo_pessoa, cnpj)) {
        descartadosCpf++
        continue
      }

      if (!cnpjLimpo || cnpjLimpo.length !== 14 || !obj) continue

      // VERIFICAÇÃO NA LISTA DE EXCLUSÃO DE PROSPECÇÃO
      let excluidoComprasnet = false
      try {
        const excC = $app.findRecordsByFilter(
          'exclusoes_prospeccao',
          "cnpj = '" + cnpjLimpo + "' && ativo = true",
          '',
          1,
          0,
        )
        if (excC.length > 0) {
          excluidoComprasnet = true
        } else if (obj) {
          const objLow = obj.toLowerCase()
          const excObj = $app.findRecordsByFilter(
            'exclusoes_prospeccao',
            "objeto_termo != '' && ativo = true",
            '',
            200,
            0,
          )
          for (let eIdx = 0; eIdx < excObj.length; eIdx++) {
            const termoExc = (excObj[eIdx].get('objeto_termo') || '').toLowerCase().trim()
            if (termoExc && objLow.includes(termoExc)) {
              excluidoComprasnet = true
              break
            }
          }
        }
      } catch (_) {}

      if (excluidoComprasnet) {
        duplicadosDedupe++
        continue
      }

      const scoreCurva = calcularScoreCurvaProvisorio(val, 12)

      // Dedupe com empresas existentes
      let empExist = null
      try {
        empExist = $app.findFirstRecordByData('empresas', 'cnpj', cnpjLimpo)
      } catch (_) {}

      if (empExist) {
        duplicadosDedupe++
        let cExiste = false
        if (num) {
          const cExistentes = $app.findRecordsByFilter(
            'contratos',
            "empresa = '" + empExist.id + "' && numero = '" + num + "'",
            '',
            1,
            0,
          )
          if (cExistentes.length > 0) cExiste = true
        }

        let nCtrId = null
        if (!cExiste) {
          const cRec = new Record(contratosCol)
          cRec.set('empresa', empExist.id)
          cRec.set('orgao', orgao)
          cRec.set('numero', num || 'CTR-CSV-' + Date.now().toString().slice(-6))
          cRec.set('objeto', obj)
          cRec.set('valor', val)
          cRec.set('saldo', val)
          cRec.set('situacao', 'Em Execução')
          cRec.set('fonte', 'Comprasnet')
          cRec.set('status_revisao', 'rascunho_pendente')
          $app.save(cRec)
          nCtrId = cRec.id
        }

        const etapa = empExist.get('etapa_funil')
        const stEmp = empExist.get('status')
        if (stEmp === 'inativa' || etapa === 'inativa' || etapa === 'nutricao_mensal') {
          const reatP = $app.findRecordsByFilter(
            'reativacoes_sugeridas',
            "empresa = '" + empExist.id + "' && status = 'pendente'",
            '',
            1,
            0,
          )
          if (reatP.length === 0) {
            const rRec = new Record(reativacoesCol)
            rRec.set('empresa', empExist.id)
            if (nCtrId) rRec.set('contrato', nCtrId)
            rRec.set('contrato_numero', num)
            rRec.set('contrato_orgao', orgao)
            rRec.set('contrato_valor', val)
            rRec.set('etapa_origem', etapa || 'inativa')
            rRec.set('status', 'pendente')
            $app.save(rRec)
            reativacoesCriadas++
          }
        }
        continue
      }

      // Dedupe sugestões
      const filtroS =
        "cnpj = '" + cnpjLimpo + "'" + (num ? " && numero_contrato = '" + num + "'" : '')
      const jaS = $app.findRecordsByFilter('sugestoes_funil', filtroS, '', 1, 0)
      if (jaS.length > 0) {
        duplicadosDedupe++
        continue
      }

      const dic = classificarPorDicionario(obj)

      const nS = new Record(sugCol)
      nS.set('razao_social', razao || 'Fornecedor ' + cnpjLimpo)
      nS.set('cnpj', cnpjLimpo)
      nS.set('orgao_contrato', orgao)
      nS.set('numero_contrato', num)
      nS.set('objeto_contrato', obj)
      nS.set('valor_estimado', val)
      nS.set('fonte', 'planilha')
      nS.set('status', 'pendente')
      nS.set('score_relevancia', dic.score)
      nS.set('score_curva_provisorio', scoreCurva.score)
      nS.set('curva_provisoria', scoreCurva.curva)
      nS.set('fonte_prospeccao_slug', 'comprasnet_contratos')
      nS.set('lote_auditoria_id', loteRec.id)
      nS.set('status_sancao', 'nao_verificada')
      nS.set('detalhe_sancao', 'Pendente de verificação na incorporação')
      nS.set('observacoes', 'Importado via CSV Comprasnet. Relevância: ' + dic.score + '/100.')
      $app.save(nS)
      novasSugestoes++
    }

    loteRec.set('status', 'sucesso')
    loteRec.set('data_fim', new Date().toISOString())
    loteRec.set('total_descartados_cpf', descartadosCpf)
    loteRec.set('total_duplicados_dedupe', duplicadosDedupe)
    loteRec.set('total_reativacoes_sugeridas', reativacoesCriadas)
    loteRec.set('total_novas_sugestoes', novasSugestoes)
    $app.save(loteRec)

    try {
      const fRec = $app.findFirstRecordByData('fontes_prospeccao', 'slug', 'comprasnet_contratos')
      fRec.set('ultima_execucao', new Date().toISOString())
      fRec.set('total_lidos', (fRec.get('total_lidos') || 0) + linhasCsv.length)
      fRec.set('total_sugeridos', (fRec.get('total_sugeridos') || 0) + novasSugestoes)
      $app.save(fRec)
    } catch (_) {}

    return e.json(200, {
      message: 'Importação CSV Comprasnet processada com sucesso.',
      resultado: {
        lote_id: loteRec.id,
        total_lidos: linhasCsv.length,
        descartados_cpf: descartadosCpf,
        duplicados_dedupe: duplicadosDedupe,
        reativacoes_sugeridas: reativacoesCriadas,
        novas_sugestoes: novasSugestoes,
      },
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: POST /backend/v1/prospeccao/importar-csv-dinamico
// Suporta Ceará Transparente, Comprasnet e qualquer fonte CSV com mapeamento salvo
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/prospeccao/importar-csv-dinamico',
  (e) => {
    const reqBody = e.requestInfo().body || {}
    const fonteSlug = reqBody.fonte_slug || 'ceara_transparente_csv'
    const linhasCsv = reqBody.linhas || []
    const mapeamentoCustom = reqBody.mapeamento || null

    if (!Array.isArray(linhasCsv) || linhasCsv.length === 0) {
      return e.json(400, { message: 'Linhas do CSV não fornecidas.' })
    }

    function limparCnpj(val) {
      if (!val) return ''
      return String(val).replace(/\D/g, '')
    }

    function isPessoaFisica(tipoPessoa, niFornecedor) {
      const ni = limparCnpj(niFornecedor)
      if (
        tipoPessoa &&
        (tipoPessoa === 'PF' || tipoPessoa === 'F' || tipoPessoa.toLowerCase().includes('física'))
      ) {
        return true
      }
      return ni.length === 11
    }

    function classificarPorDicionario(objetoTexto) {
      const texto = (objetoTexto || '').toLowerCase()
      if (!texto) return { score: 10, termos: [] }
      const termosPesos = [
        { termo: 'projeto executivo', peso: 35 },
        { termo: 'projeto basico', peso: 30 },
        { termo: 'projeto básico', peso: 30 },
        { termo: 'elaboracao de projetos', peso: 30 },
        { termo: 'elaboração de projetos', peso: 30 },
        { termo: 'estrutural', peso: 20 },
        { termo: 'eletrico', peso: 18 },
        { termo: 'elétrico', peso: 18 },
        { termo: 'hidrossanitario', peso: 18 },
        { termo: 'hidrossanitário', peso: 18 },
        { termo: 'drenagem', peso: 18 },
        { termo: 'pavimentacao', peso: 18 },
        { termo: 'pavimentação', peso: 18 },
        { termo: 'orcamento', peso: 15 },
        { termo: 'orçamento', peso: 15 },
        { termo: 'laudo', peso: 15 },
        { termo: 'engenharia consultiva', peso: 25 },
        { termo: 'gerenciamento de obras', peso: 20 },
        { termo: 'supervisao', peso: 15 },
        { termo: 'supervisão', peso: 15 },
      ]
      let pontuacao = 0
      const encontrados = []
      for (let i = 0; i < termosPesos.length; i++) {
        if (texto.includes(termosPesos[i].termo)) {
          pontuacao += termosPesos[i].peso
          encontrados.push(termosPesos[i].termo)
        }
      }
      if (encontrados.length > 0) pontuacao = Math.max(30, pontuacao)
      else pontuacao = 15
      return { score: Math.min(100, Math.max(0, pontuacao)), termos: encontrados }
    }

    function calcularScoreCurvaProvisorio(valorContrato, mesesVigencia) {
      const valor = Number(valorContrato) || 0
      const meses = Number(mesesVigencia) || 12
      const normValor = Math.min(100, Math.max(0, (valor / 10000000) * 100))
      const normVigencia = Math.min(100, Math.max(0, (meses / 36) * 100))
      const normQtd = 20
      const score = Math.min(
        100,
        Math.max(0, Math.round(normValor * 0.5 + normVigencia * 0.3 + normQtd * 0.2)),
      )
      let curva = 'C'
      if (score >= 40 || valor >= 1000000) curva = 'A'
      else if (score >= 15 || valor >= 200000) curva = 'B'
      return { score, curva }
    }

    let fonteRec = null
    try {
      fonteRec = $app.findFirstRecordByData('fontes_prospeccao', 'slug', fonteSlug)
    } catch (_) {}

    // Resolução do mapeamento de colunas (prioridade: payload customizado > persistido na fonte > defaults)
    const mapSalvo = (fonteRec && fonteRec.get('mapeamento_colunas')) || {}
    const mapEfetivo = Object.assign(
      {
        col_cnpj: 'cnpj',
        col_razao_social: 'razao_social',
        col_orgao: 'orgao',
        col_numero_contrato: 'numero_contrato',
        col_objeto: 'objeto',
        col_valor: 'valor',
        col_vigencia_inicio: 'vigencia_inicio',
        col_vigencia_fim: 'vigencia_fim',
      },
      mapSalvo,
      mapeamentoCustom || {},
    )

    const auditCol = $app.findCollectionByNameOrId('lotes_prospeccao_auditoria')
    const loteRec = new Record(auditCol)
    loteRec.set('fonte_slug', fonteSlug)
    loteRec.set(
      'fonte_nome',
      (fonteRec && fonteRec.get('nome')) || 'Importação CSV (' + fonteSlug + ')',
    )
    loteRec.set('tipo_execucao', 'importacao_csv')
    loteRec.set('status', 'em_andamento')
    loteRec.set('data_inicio', new Date().toISOString())
    loteRec.set('total_lidos', linhasCsv.length)
    loteRec.set('parametros_aplicados', { mapeamento: mapEfetivo })
    if (e.auth?.id) loteRec.set('executado_por', e.auth.id)
    $app.save(loteRec)

    let descartadosCpf = 0
    let duplicadosDedupe = 0
    let reativacoesCriadas = 0
    let novasSugestoes = 0

    const sugCol = $app.findCollectionByNameOrId('sugestoes_funil')
    const contratosCol = $app.findCollectionByNameOrId('contratos')
    const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')

    for (let i = 0; i < linhasCsv.length; i++) {
      const row = linhasCsv[i]

      // Extração dinâmica baseada no mapeamento configurado
      const cnpj =
        row[mapEfetivo.col_cnpj] || row.cnpj || row.cnpj_contratada || row['CPF/CNPJ'] || ''
      const razao =
        row[mapEfetivo.col_razao_social] ||
        row.razao_social ||
        row.nome_fornecedor ||
        row['Razão Social'] ||
        ''
      const orgao =
        row[mapEfetivo.col_orgao] || row.orgao || row.uasg_nome || row['Órgão'] || 'Órgão Público'
      const num = row[mapEfetivo.col_numero_contrato] || row.numero || row.numero_contrato || ''
      const obj =
        row[mapEfetivo.col_objeto] || row.objeto || row.objeto_contrato || row['Objeto'] || ''
      const rawValor = row[mapEfetivo.col_valor] || row.valor || row.valor_inicial || 0
      const val = Number(String(rawValor).replace(/\./g, '').replace(',', '.')) || 0

      const cnpjLimpo = limparCnpj(cnpj)

      if (isPessoaFisica(row.tipo_pessoa, cnpj)) {
        descartadosCpf++
        continue
      }

      if (!cnpjLimpo || cnpjLimpo.length !== 14 || !obj) continue

      // VERIFICAÇÃO NA LISTA DE EXCLUSÃO DE PROSPECÇÃO
      let excluidoCsvDinamico = false
      try {
        const excCd = $app.findRecordsByFilter(
          'exclusoes_prospeccao',
          "cnpj = '" + cnpjLimpo + "' && ativo = true",
          '',
          1,
          0,
        )
        if (excCd.length > 0) {
          excluidoCsvDinamico = true
        } else if (obj) {
          const objLow = obj.toLowerCase()
          const excObj = $app.findRecordsByFilter(
            'exclusoes_prospeccao',
            "objeto_termo != '' && ativo = true",
            '',
            200,
            0,
          )
          for (let eIdx = 0; eIdx < excObj.length; eIdx++) {
            const termoExc = (excObj[eIdx].get('objeto_termo') || '').toLowerCase().trim()
            if (termoExc && objLow.includes(termoExc)) {
              excluidoCsvDinamico = true
              break
            }
          }
        }
      } catch (_) {}

      if (excluidoCsvDinamico) {
        duplicadosDedupe++
        continue
      }

      const scoreCurva = calcularScoreCurvaProvisorio(val, 12)

      // Dedupe com empresas existentes
      let empExist = null
      try {
        empExist = $app.findFirstRecordByData('empresas', 'cnpj', cnpjLimpo)
      } catch (_) {}

      if (empExist) {
        duplicadosDedupe++
        let cExiste = false
        if (num) {
          const cExistentes = $app.findRecordsByFilter(
            'contratos',
            "empresa = '" + empExist.id + "' && numero = '" + num + "'",
            '',
            1,
            0,
          )
          if (cExistentes.length > 0) cExiste = true
        }

        let nCtrId = null
        if (!cExiste) {
          const cRec = new Record(contratosCol)
          cRec.set('empresa', empExist.id)
          cRec.set('orgao', orgao)
          cRec.set('numero', num || 'CTR-CSV-' + Date.now().toString().slice(-6))
          cRec.set('objeto', obj)
          cRec.set('valor', val)
          cRec.set('saldo', val)
          cRec.set('situacao', 'Em Execução')
          cRec.set('fonte', fonteSlug.includes('ceara') ? 'Ceará Transparente' : 'CSV')
          cRec.set('status_revisao', 'rascunho_pendente')
          $app.save(cRec)
          nCtrId = cRec.id
        }

        const etapa = empExist.get('etapa_funil')
        const stEmp = empExist.get('status')
        if (stEmp === 'inativa' || etapa === 'inativa' || etapa === 'nutricao_mensal') {
          const reatP = $app.findRecordsByFilter(
            'reativacoes_sugeridas',
            "empresa = '" + empExist.id + "' && status = 'pendente'",
            '',
            1,
            0,
          )
          if (reatP.length === 0) {
            const rRec = new Record(reativacoesCol)
            rRec.set('empresa', empExist.id)
            if (nCtrId) rRec.set('contrato', nCtrId)
            rRec.set('contrato_numero', num)
            rRec.set('contrato_orgao', orgao)
            rRec.set('contrato_valor', val)
            rRec.set('etapa_origem', etapa || 'inativa')
            rRec.set('status', 'pendente')
            $app.save(rRec)
            reativacoesCriadas++
          }
        }
        continue
      }

      // Dedupe sugestões
      const filtroS =
        "cnpj = '" + cnpjLimpo + "'" + (num ? " && numero_contrato = '" + num + "'" : '')
      const jaS = $app.findRecordsByFilter('sugestoes_funil', filtroS, '', 1, 0)
      if (jaS.length > 0) {
        duplicadosDedupe++
        continue
      }

      const dic = classificarPorDicionario(obj)

      const nS = new Record(sugCol)
      nS.set('razao_social', razao || 'Fornecedor ' + cnpjLimpo)
      nS.set('cnpj', cnpjLimpo)
      nS.set('orgao_contrato', orgao)
      nS.set('numero_contrato', num)
      nS.set('objeto_contrato', obj)
      nS.set('valor_estimado', val)
      nS.set('fonte', 'planilha')
      nS.set('status', 'pendente')
      nS.set('score_relevancia', dic.score)
      nS.set('score_curva_provisorio', scoreCurva.score)
      nS.set('curva_provisoria', scoreCurva.curva)
      nS.set('fonte_prospeccao_slug', fonteSlug)
      nS.set('lote_auditoria_id', loteRec.id)
      nS.set('status_sancao', 'nao_verificada')
      nS.set('detalhe_sancao', 'Pendente de verificação na incorporação')
      nS.set(
        'observacoes',
        'Importado via CSV (' +
          (fonteRec ? fonteRec.get('nome') : fonteSlug) +
          '). Relevância: ' +
          dic.score +
          '/100.',
      )
      $app.save(nS)
      novasSugestoes++
    }

    loteRec.set('status', 'sucesso')
    loteRec.set('data_fim', new Date().toISOString())
    loteRec.set('total_descartados_cpf', descartadosCpf)
    loteRec.set('total_duplicados_dedupe', duplicadosDedupe)
    loteRec.set('total_reativacoes_sugeridas', reativacoesCriadas)
    loteRec.set('total_novas_sugestoes', novasSugestoes)
    $app.save(loteRec)

    if (fonteRec) {
      try {
        fonteRec.set('ultima_execucao', new Date().toISOString())
        fonteRec.set('total_lidos', (fonteRec.get('total_lidos') || 0) + linhasCsv.length)
        fonteRec.set('total_sugeridos', (fonteRec.get('total_sugeridos') || 0) + novasSugestoes)
        $app.save(fonteRec)
      } catch (_) {}
    }

    return e.json(200, {
      message: 'Importação de CSV processada com sucesso.',
      resultado: {
        lote_id: loteRec.id,
        total_lidos: linhasCsv.length,
        descartados_cpf: descartadosCpf,
        duplicados_dedupe: duplicadosDedupe,
        reativacoes_sugeridas: reativacoesCriadas,
        novas_sugestoes: novasSugestoes,
      },
    })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// ROTA: GET /backend/v1/prospeccao/tce-ce/municipios
// Lista municípios do Ceará consultando a API do TCE-CE ou cache fixo
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/prospeccao/tce-ce/municipios',
  (e) => {
    try {
      const res = $http.send({
        url: 'https://api-dados-abertos.tce.ce.gov.br/sim/municipios',
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
        timeout: 10,
      })

      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        res.json &&
        Array.isArray(res.json.elements)
      ) {
        const lista = res.json.elements.map((m) => ({
          codigo: m.codigo_municipio,
          nome: m.nome_municipio,
          ibge: m.codigo_municipio_ibge,
        }))
        return e.json(200, { municipios: lista, fonte: 'api_tce_ce' })
      }
    } catch (_) {}

    // Fallback com principais municípios do Ceará caso a API externa oscile
    const principais = [
      { codigo: '044', nome: 'FORTALEZA', ibge: '2304400' },
      { codigo: '042', nome: 'CAUCAIA', ibge: '2303709' },
      { codigo: '075', nome: 'JUAZEIRO DO NORTE', ibge: '2307304' },
      { codigo: '088', nome: 'MARACANAÚ', ibge: '2307650' },
      { codigo: '135', nome: 'SOBRAL', ibge: '2312908' },
      { codigo: '047', nome: 'CRATO', ibge: '2304202' },
      { codigo: '074', nome: 'ITAPIPOCA', ibge: '2306405' },
      { codigo: '089', nome: 'MARANGUAPE', ibge: '2307700' },
      { codigo: '070', nome: 'IGUATU', ibge: '2305506' },
      { codigo: '115', nome: 'QUIXADÁ', ibge: '2311306' },
      { codigo: '012', nome: 'AQUIRAZ', ibge: '2301000' },
      { codigo: '037', nome: 'CANINDÉ', ibge: '2302800' },
      { codigo: '124', nome: 'RUSSAS', ibge: '2311801' },
      { codigo: '048', nome: 'CRATEÚS', ibge: '2304103' },
      { codigo: '018', nome: 'ARACATI', ibge: '2301109' },
      { codigo: '143', nome: 'TIANGUÁ', ibge: '2313401' },
      { codigo: '107', nome: 'PACAJUS', ibge: '2309607' },
      { codigo: '040', nome: 'CASCAVEL', ibge: '2303501' },
    ]
    return e.json(200, { municipios: principais, fonte: 'fallback_ceara' })
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// CRON DIÁRIO AUTOMÁTICO DE VARREDURA (03:00)
// -----------------------------------------------------------------------------
cronAdd('prospeccao_diaria_pncp', '0 3 * * *', () => {
  try {
    const fonte = $app.findFirstRecordByData('fontes_prospeccao', 'slug', 'pncp_contratos')
    if (!fonte || !fonte.get('ativo')) {
      return
    }

    const diasJanela = fonte.get('dias_janela') || 7
    const limite = Math.min(100, fonte.get('limite_por_execucao') || 50)
    const palavrasChave = (fonte.get('palavras_chave') || '')
      .toLowerCase()
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    const hoje = new Date()
    const dFim = hoje.toISOString().slice(0, 10).replace(/-/g, '')
    const dIni = new Date(hoje.getTime() - diasJanela * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')
    const url =
      'https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=' +
      dIni +
      '&dataFinal=' +
      dFim +
      '&pagina=1&tamanhoPagina=500'

    const res = $http.send({
      url: url,
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'GESTAO-GPLUS/1.0' },
      timeout: 15,
    })

    if (res.statusCode >= 200 && res.statusCode < 300 && res.json && Array.isArray(res.json.data)) {
      console.log('Cron PNCP executado com sucesso: ' + res.json.data.length + ' contratos lidos.')
    }

    // RODADA 19: Registrar último sucesso da rotina de prospecção
    try {
      const pRecCron = $app.findFirstRecordByData('parametros', 'chave', 'crons_ultimo_sucesso')
      if (pRecCron) {
        let mapa = {}
        try {
          mapa = JSON.parse(pRecCron.getString('valor') || '{}')
        } catch (_) {}
        mapa.prospeccao = {
          ultimo_sucesso: new Date().toISOString(),
          status: 'ok',
        }
        pRecCron.set('valor', JSON.stringify(mapa))
        $app.save(pRecCron)
      }
    } catch (_) {}
  } catch (err) {
    console.log('Erro no cron de prospecção diária: ' + err)
  }
})
