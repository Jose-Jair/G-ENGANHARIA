// =============================================================================
// GESTÃO G+ — IFC / BCF ENGINE (RODADA 17)
// Endpoints:
// 1. POST /backend/v1/entregaveis/{id}/versoes/{versao_id}/importar-bcf
// 2. POST /backend/v1/entregaveis/{id}/versoes/{versao_id}/resumo-ifc
// 3. GET  /backend/v1/entregaveis/{id}/versoes/{versao_id}/issues
//
// ATENÇÃO: Conforme o motor Goja/PocketBase, cada callback (onRecord*, cronAdd, routerAdd)
// executa isolado. Funções auxiliares devem ser estritamente inline dentro do callback.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. ENDPOINT: Importação de BCF 2.1 / 3.0
// POST /backend/v1/entregaveis/{id}/versoes/{versao_id}/importar-bcf
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/entregaveis/{id}/versoes/{versao_id}/importar-bcf',
  (e) => {
    try {
      function parseMarkupXmlInline(xmlStr) {
        function extrairTag(xml, tag) {
          const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')
          const m = xml.match(re)
          return m ? m[1].trim() : ''
        }

        function extrairAttr(xml, tag, attr) {
          const re = new RegExp('<' + tag + '[^>]*?\\s' + attr + '=["\']([^"\']+)["\']', 'i')
          const m = xml.match(re)
          return m ? m[1].trim() : ''
        }

        const title =
          extrairTag(xmlStr, 'Title') || extrairTag(xmlStr, 'title') || 'Issue sem título'
        const description =
          extrairTag(xmlStr, 'Description') || extrairTag(xmlStr, 'description') || ''

        const priority = (
          extrairTag(xmlStr, 'Priority') ||
          extrairTag(xmlStr, 'priority') ||
          'media'
        ).toLowerCase()
        let severidade = 'media'
        if (priority.indexOf('crit') !== -1 || priority.indexOf('block') !== -1) {
          severidade = 'critica'
        } else if (priority.indexOf('alt') !== -1 || priority.indexOf('high') !== -1) {
          severidade = 'alta'
        } else if (priority.indexOf('baix') !== -1 || priority.indexOf('low') !== -1) {
          severidade = 'baixa'
        } else if (priority.indexOf('med') !== -1) {
          severidade = 'media'
        }

        const statusRaw = (
          extrairTag(xmlStr, 'TopicStatus') ||
          extrairTag(xmlStr, 'Status') ||
          extrairTag(xmlStr, 'status') ||
          'aberta'
        ).toLowerCase()
        let status = 'aberta'
        if (statusRaw.indexOf('atrib') !== -1 || statusRaw.indexOf('assign') !== -1) {
          status = 'atribuida'
        } else if (statusRaw.indexOf('corrig') !== -1 || statusRaw.indexOf('resolved') !== -1) {
          status = 'corrigida'
        } else if (statusRaw.indexOf('verif') !== -1 || statusRaw.indexOf('closed') !== -1) {
          status = 'verificada'
        } else if (statusRaw.indexOf('rej') !== -1 || statusRaw.indexOf('reopen') !== -1) {
          status = 'rejeitada'
        }

        let guid = extrairAttr(xmlStr, 'Topic', 'Guid') || extrairAttr(xmlStr, 'topic', 'guid')
        if (!guid) {
          guid = extrairTag(xmlStr, 'Guid') || extrairTag(xmlStr, 'guid')
        }

        const elementos = []
        const compRegex = /IfcGuid=["']([^"']+)["']/gi
        let matchComp
        while ((matchComp = compRegex.exec(xmlStr)) !== null) {
          if (matchComp[1] && !elementos.includes(matchComp[1])) {
            elementos.push(matchComp[1])
          }
        }

        const pavimento =
          extrairTag(xmlStr, 'Stage') ||
          extrairTag(xmlStr, 'stage') ||
          extrairTag(xmlStr, 'Floor') ||
          extrairTag(xmlStr, 'floor') ||
          ''

        const prazo = extrairTag(xmlStr, 'DueDate') || extrairTag(xmlStr, 'dueDate') || ''

        return {
          guid: guid || '',
          titulo: title,
          descricao: description,
          severidade: severidade,
          status: status,
          elementos: elementos,
          pavimento: pavimento,
          prazo: prazo ? prazo.split('T')[0] : '',
        }
      }

      const entId = e.request.pathValue('id')
      const versaoId = e.request.pathValue('versao_id')
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth

      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      let versaoRec
      try {
        versaoRec = $app.findRecordById('entregaveis_versoes', versaoId)
      } catch (_) {
        return e.json(404, { error: 'Versão do entregável não encontrada.' })
      }

      if (versaoRec.getString('entregavel') !== entId) {
        return e.json(400, { error: 'Versão informada não pertence ao entregável.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')
      let autorizado = role === 'admin' || role === 'gestor'
      if (!autorizado && role === 'executor') {
        const prestadorId = entRec.getString('prestador')
        if (prestadorId) {
          try {
            const pRec = $app.findRecordById('prestadores', prestadorId)
            if (pRec && pRec.getString('email') === userEmail) {
              autorizado = true
            }
          } catch (_) {}
        }
      }

      if (!autorizado) {
        return e.json(403, {
          error: 'Você não tem permissão para importar BCF neste entregável.',
        })
      }

      const body = reqInfo.body || {}
      const topicos = body.topicos || body.issues || []

      if (!Array.isArray(topicos) || topicos.length === 0) {
        return e.json(400, {
          error:
            'Nenhum tópico BCF fornecido para importação. Envie o campo "topicos" com os dados do markup.bcf.',
        })
      }

      const issuesCol = $app.findCollectionByNameOrId('issues_revisao')
      let criadas = 0
      let ignoradasDedupe = 0
      const idsCriados = []

      for (let i = 0; i < topicos.length; i++) {
        const t = topicos[i]
        let parsed = {}

        if (t.markup_xml) {
          parsed = parseMarkupXmlInline(t.markup_xml)
        }

        const guidBcf = (t.guid_bcf || t.guid || parsed.guid || '').trim()
        const titulo = (t.titulo || parsed.titulo || 'Issue BCF').trim()
        const descricao = (t.descricao || parsed.descricao || '').trim()
        const severidade = (t.severidade || parsed.severidade || 'media').trim().toLowerCase()
        const status = (t.status || parsed.status || 'aberta').trim().toLowerCase()
        const elementos = Array.isArray(t.elementos)
          ? t.elementos
          : parsed.elementos && parsed.elementos.length > 0
            ? parsed.elementos
            : []
        const pavimento = (t.pavimento || parsed.pavimento || '').trim()
        const prazo = (t.prazo || parsed.prazo || '').trim()

        // DEDUPLICAÇÃO POR guid_bcf NO ENTREGÁVEL
        if (guidBcf) {
          const existentes = $app.findRecordsByFilter(
            'issues_revisao',
            "entregavel = '" + entId + "' && guid_bcf = '" + guidBcf.replace(/'/g, "''") + "'",
            '',
            1,
            0,
          )
          if (existentes.length > 0) {
            ignoradasDedupe++
            continue
          }
        }

        const novaIssue = new Record(issuesCol)
        novaIssue.set('entregavel', entId)
        novaIssue.set('versao', versaoId)
        novaIssue.set('origem', 'bcf')
        if (guidBcf) novaIssue.set('guid_bcf', guidBcf)
        novaIssue.set('titulo', titulo)
        novaIssue.set('descricao', descricao)
        novaIssue.set('elementos', elementos)
        novaIssue.set('pavimento', pavimento)
        novaIssue.set(
          'severidade',
          ['baixa', 'media', 'alta', 'critica'].includes(severidade) ? severidade : 'media',
        )
        novaIssue.set(
          'status',
          ['aberta', 'atribuida', 'corrigida', 'verificada', 'rejeitada'].includes(status)
            ? status
            : 'aberta',
        )
        if (prazo) novaIssue.set('prazo', prazo)

        if (t.viewpoint_base64) {
          try {
            const vpNome = t.viewpoint_nome || 'snapshot.png'
            const fileObj = $filesystem.fileFromBytes(t.viewpoint_base64, vpNome)
            novaIssue.set('viewpoint', fileObj)
          } catch (eVp) {
            console.log('Aviso ao anexar viewpoint BCF: ' + eVp)
          }
        }

        $app.save(novaIssue)
        criadas++
        idsCriados.push(novaIssue.id)
      }

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'IMPORTACAO_BCF')
        aRec.set('entidade', 'issues_revisao')
        aRec.set('registro_id', versaoId)
        aRec.set('detalhes', {
          entregavel_id: entId,
          versao_id: versaoId,
          total_topicos_recebidos: topicos.length,
          issues_criadas: criadas,
          ignoradas_dedupe: ignoradasDedupe,
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        entregavel_id: entId,
        versao_id: versaoId,
        total_processados: topicos.length,
        criadas: criadas,
        ignoradas_dedupe: ignoradasDedupe,
        ids_criados: idsCriados,
      })
    } catch (err) {
      console.log('Erro ao importar BCF: ' + err)
      return e.json(500, { error: 'Erro ao importar BCF: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 2. ENDPOINT: Resumo IFC do Navegador com Validação de Hash
// POST /backend/v1/entregaveis/{id}/versoes/{versao_id}/resumo-ifc
// -----------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/entregaveis/{id}/versoes/{versao_id}/resumo-ifc',
  (e) => {
    try {
      const entId = e.request.pathValue('id')
      const versaoId = e.request.pathValue('versao_id')
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth

      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      let versaoRec
      try {
        versaoRec = $app.findRecordById('entregaveis_versoes', versaoId)
      } catch (_) {
        return e.json(404, { error: 'Versão não encontrada.' })
      }

      if (versaoRec.getString('entregavel') !== entId) {
        return e.json(400, { error: 'Versão informada não pertence ao entregável.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')
      let autorizado = role === 'admin' || role === 'gestor'
      if (!autorizado && role === 'executor') {
        const prestadorId = entRec.getString('prestador')
        if (prestadorId) {
          try {
            const pRec = $app.findRecordById('prestadores', prestadorId)
            if (pRec && pRec.getString('email') === userEmail) {
              autorizado = true
            }
          } catch (_) {}
        }
      }

      if (!autorizado) {
        return e.json(403, {
          error: 'Sem permissão para gravar resumo IFC nesta versão.',
        })
      }

      const body = reqInfo.body || {}
      const hashSha256 = (body.hash_sha256 || '').trim().toLowerCase()
      const tamanho = parseInt(body.tamanho || '0', 10)
      const resumoIfc = body.resumo_ifc || body.resumo_ifc_json || null

      if (!hashSha256) {
        return e.json(400, {
          error: 'O hash SHA-256 do arquivo IFC é obrigatório para validação de integridade.',
        })
      }

      if (!resumoIfc) {
        return e.json(400, {
          error: 'Os dados do resumo IFC (classes, pavimentos, disciplinas) são obrigatórios.',
        })
      }

      const hashAtual = (versaoRec.getString('hash_sha256') || '').trim().toLowerCase()
      if (hashAtual && hashAtual !== hashSha256) {
        return e.json(422, {
          error:
            'HASH DIVERGENTE: O hash SHA-256 enviado (' +
            hashSha256 +
            ') não coincide com o hash registrado para esta versão do arquivo (' +
            hashAtual +
            '). Resumo rejeitado.',
        })
      }

      let tetoMb = 150
      try {
        const pTeto = $app.findFirstRecordByData('parametros', 'chave', 'tamanho_maximo_ifc_mb')
        if (pTeto && pTeto.getString('valor')) {
          tetoMb = parseInt(pTeto.getString('valor'), 10) || 150
        }
      } catch (_) {}

      const tetoBytes = tetoMb * 1024 * 1024
      if (tamanho > tetoBytes) {
        return e.json(413, {
          error:
            'Teto de upload excedido: O arquivo IFC possui ' +
            Math.round(tamanho / (1024 * 1024)) +
            ' MB, superando o limite configurado de ' +
            tetoMb +
            ' MB.',
        })
      }

      versaoRec.set('hash_sha256', hashSha256)
      if (tamanho > 0) versaoRec.set('tamanho', tamanho)
      versaoRec.set('resumo_ifc_json', resumoIfc)
      $app.save(versaoRec)

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const aRec = new Record(auditCol)
        aRec.set('user', authUser.id)
        aRec.set('user_email', userEmail)
        aRec.set('acao', 'RESUMO_IFC_GRAVADO')
        aRec.set('entidade', 'entregaveis_versoes')
        aRec.set('registro_id', versaoId)
        aRec.set('detalhes', {
          entregavel_id: entId,
          versao_id: versaoId,
          hash_sha256: hashSha256,
          tamanho_bytes: tamanho,
          classes_contagem: resumoIfc.classes || resumoIfc.contagens_por_classe || null,
        })
        $app.save(aRec)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        entregavel_id: entId,
        versao_id: versaoId,
        hash_sha256: hashSha256,
        tamanho: tamanho,
        resumo_ifc_json: resumoIfc,
      })
    } catch (err) {
      console.log('Erro ao gravar resumo IFC: ' + err)
      return e.json(500, { error: 'Erro ao gravar resumo IFC: ' + err })
    }
  },
  $apis.requireAuth(),
)

// -----------------------------------------------------------------------------
// 3. ENDPOINT: Listar Issues de Revisão do Entregável / Versão
// GET /backend/v1/entregaveis/{id}/versoes/{versao_id}/issues
// Apenas as issues da OS do próprio prestador caso seja executor
// -----------------------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/entregaveis/{id}/versoes/{versao_id}/issues',
  (e) => {
    try {
      const entId = e.request.pathValue('id')
      const versaoId = e.request.pathValue('versao_id')
      const reqInfo = e.requestInfo()
      const authUser = reqInfo.auth

      if (!authUser) {
        return e.json(401, { error: 'Autenticação necessária.' })
      }

      let entRec
      try {
        entRec = $app.findRecordById('entregaveis', entId)
      } catch (_) {
        return e.json(404, { error: 'Entregável não encontrado.' })
      }

      const role = authUser.getString('role')
      const userEmail = authUser.getString('email')

      if (role === 'executor') {
        const prestadorId = entRec.getString('prestador')
        let autorizado = false
        if (prestadorId) {
          try {
            const pRec = $app.findRecordById('prestadores', prestadorId)
            if (pRec && pRec.getString('email') === userEmail) {
              autorizado = true
            }
          } catch (_) {}
        }
        if (!autorizado) {
          return e.json(403, {
            error:
              'Acesso negado: Você não pode visualizar issues de OS ou entregável de outro prestador.',
          })
        }
      }

      let filter = "entregavel = '" + entId + "'"
      if (versaoId && versaoId !== 'todas') {
        filter += " && versao = '" + versaoId + "'"
      }

      const issues = $app.findRecordsByFilter('issues_revisao', filter, '-created', 200, 0)

      const higienizadas = []
      for (let i = 0; i < issues.length; i++) {
        const item = issues[i]
        higienizadas.push({
          id: item.id,
          entregavel: item.getString('entregavel'),
          versao: item.getString('versao'),
          origem: item.getString('origem'),
          guid_bcf: item.getString('guid_bcf'),
          titulo: item.getString('titulo'),
          descricao: item.getString('descricao'),
          elementos: item.get('elementos'),
          pavimento: item.getString('pavimento'),
          severidade: item.getString('severidade'),
          status: item.getString('status'),
          atribuida_a: item.getString('atribuida_a'),
          prazo: item.getString('prazo'),
          viewpoint: item.getString('viewpoint'),
          versao_corrigida: item.getString('versao_corrigida'),
          created: item.getString('created'),
          updated: item.getString('updated'),
        })
      }

      return e.json(200, {
        entregavel_id: entId,
        versao_id: versaoId,
        total: higienizadas.length,
        issues: higienizadas,
      })
    } catch (err) {
      console.log('Erro ao listar issues: ' + err)
      return e.json(500, { error: 'Erro ao listar issues: ' + err })
    }
  },
  $apis.requireAuth(),
)
