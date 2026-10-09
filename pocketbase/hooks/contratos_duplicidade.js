/**
 * Hook PocketBase: Conferência de Duplicidade de Contratos Públicos por Empresa
 *
 * Regras:
 * - Em onRecordCreateRequest("contratos"):
 *   - Valida se o usuário tem permissão (Admin ou Comercial)
 *   - Compara o novo contrato contra os contratos existentes da mesma empresa:
 *     (a) mesmo número informado;
 *     (b) mesmo órgão (case/acento-insensível) + mesmo valor;
 *     (c) mesmo órgão + vigência com sobreposição de datas;
 *     (d) objeto substancialmente igual para o mesmo órgão.
 *   - Se suspeito e sem confirmado_duplicidade=true no payload: rejeita com erro 409 (ApiError)
 *
 * - Em onRecordCreate("contratos"):
 *   - Se confirmado_duplicidade foi marcado como true (ou veio similarId):
 *     registra em audit_logs:
 *       acao: "CRIACAO_CONTRATO_DUPLICADO_CONFIRMADO"
 *       entidade: "contratos"
 *       detalhes: { contrato_id, numero, orgao, valor, contrato_similar_id }
 */

onRecordCreateRequest((e) => {
  function normalizeText(str) {
    if (!str) return ''
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function calculateJaccardSimilarity(s1, s2) {
    var t1 = normalizeText(s1).replace(/[^a-z0-9\s]/g, ' ')
    var t2 = normalizeText(s2).replace(/[^a-z0-9\s]/g, ' ')
    var parts1 = t1.split(/\s+/).filter(function (w) {
      return w.length >= 3
    })
    var parts2 = t2.split(/\s+/).filter(function (w) {
      return w.length >= 3
    })
    if (parts1.length === 0 || parts2.length === 0) return 0

    var set1 = {}
    for (var i = 0; i < parts1.length; i++) {
      set1[parts1[i]] = true
    }
    var set2 = {}
    for (var j = 0; j < parts2.length; j++) {
      set2[parts2[j]] = true
    }

    var inter = 0
    for (var k in set1) {
      if (set2[k]) inter++
    }

    var allKeys = {}
    for (var k1 in set1) allKeys[k1] = true
    for (var k2 in set2) allKeys[k2] = true
    var union = Object.keys(allKeys).length

    return union > 0 ? inter / union : 0
  }

  var auth = e.auth
  if (!auth) {
    throw e.unauthorizedError('Apenas usuários autenticados podem cadastrar contratos.', {})
  }

  var role = auth.getString('role')
  if (role !== 'admin' && role !== 'comercial') {
    throw e.forbiddenError(
      'Apenas Administradores e equipe Comercial podem cadastrar contratos.',
      {},
    )
  }

  // Extrair corpo da requisição
  var body = {}
  try {
    e.bindBody(body)
  } catch (_) {
    body = {}
  }

  var confirmadoDuplicidade =
    body.confirmado_duplicidade === true ||
    body.confirmado_duplicidade === 'true' ||
    body.confirmado_duplicidade === 1

  var empresaId = e.record.getString('empresa') || body.empresa || ''
  var novoOrgao = e.record.getString('orgao') || body.orgao || ''
  var novoNumero = e.record.getString('numero') || body.numero || ''
  var novoObjeto = e.record.getString('objeto') || body.objeto || ''
  var novoValor = Number(e.record.get('valor')) || Number(body.valor) || 0
  var novoVIni = e.record.getString('vigencia_inicio') || body.vigencia_inicio || ''
  var novoVFim = e.record.getString('vigencia_fim') || body.vigencia_fim || ''

  if (!empresaId) {
    e.next()
    return
  }

  // Buscar contratos existentes da mesma empresa
  var contratosExistentes = []
  try {
    contratosExistentes = $app.findRecordsByFilter(
      'contratos',
      "empresa = '" + empresaId + "'",
      '-created',
      200,
      0,
    )
  } catch (err) {
    console.log('Erro ao buscar contratos para conferência de duplicidade: ' + err)
    e.next()
    return
  }

  var normNovoOrgao = normalizeText(novoOrgao)
  var normNovoNumero = normalizeText(novoNumero)
  var conflito = null
  var motivo = ''

  for (var i = 0; i < contratosExistentes.length; i++) {
    var existente = contratosExistentes[i]
    var existNumero = existente.getString('numero')
    var existOrgao = existente.getString('orgao')
    var existObjeto = existente.getString('objeto')
    var existValor = Number(existente.get('valor')) || 0
    var existVIni = existente.getString('vigencia_inicio')
    var existVFim = existente.getString('vigencia_fim')

    var normExistNumero = normalizeText(existNumero)
    var normExistOrgao = normalizeText(existOrgao)

    // (a) Mesmo número informado (se não for genérico padrão CT-)
    if (
      normNovoNumero &&
      normExistNumero &&
      normNovoNumero === normExistNumero &&
      !normNovoNumero.startsWith('ct-')
    ) {
      conflito = existente
      motivo = 'Mesmo número de contrato informado (' + existNumero + ').'
      break
    }

    // Se mesmo órgão
    if (normNovoOrgao && normExistOrgao && normNovoOrgao === normExistOrgao) {
      // (b) Mesmo órgão + mesmo valor
      if (novoValor > 0 && Math.abs(novoValor - existValor) < 0.01) {
        conflito = existente
        motivo = 'Mesmo órgão e mesmo valor contratado (R$ ' + novoValor.toFixed(2) + ').'
        break
      }

      // (c) Mesmo órgão + sobreposição de vigências
      if (novoVIni && novoVFim && existVIni && existVFim) {
        var start1 = new Date(novoVIni).getTime()
        var end1 = new Date(novoVFim).getTime()
        var start2 = new Date(existVIni).getTime()
        var end2 = new Date(existVFim).getTime()
        if (!isNaN(start1) && !isNaN(end1) && !isNaN(start2) && !isNaN(end2)) {
          if (Math.max(start1, start2) <= Math.min(end1, end2)) {
            conflito = existente
            motivo = 'Mesmo órgão com sobreposição de vigências.'
            break
          }
        }
      }

      // (d) Objeto substancialmente igual para o mesmo órgão
      if (novoObjeto && existObjeto) {
        var sim = calculateJaccardSimilarity(novoObjeto, existObjeto)
        if (sim >= 0.55) {
          conflito = existente
          motivo =
            'Mesmo órgão e objeto substancialmente igual (' +
            Math.round(sim * 100) +
            '% similaridade).'
          break
        }
      }
    }
  }

  if (conflito) {
    if (!confirmadoDuplicidade) {
      throw e.error(
        409,
        'Já existe um contrato semelhante cadastrado para esta empresa: ' + motivo,
        {
          duplicidade: true,
          motivo: motivo,
          contrato_similar_id: conflito.id,
          contrato_similar_numero: conflito.getString('numero'),
          contrato_similar_orgao: conflito.getString('orgao'),
          contrato_similar_valor: conflito.get('valor'),
        },
      )
    }

    // Se confirmado_duplicidade = true, guardamos o similar_id no evento para auditoria
    e.set('contrato_duplicado_confirmado', true)
    e.set('contrato_similar_id', conflito.id)
  }

  e.next()
}, 'contratos')

onRecordCreate((e) => {
  try {
    var duplicadoConfirmado = e.get('contrato_duplicado_confirmado')
    var similarId = e.get('contrato_similar_id')

    if (duplicadoConfirmado) {
      var auditCol = $app.findCollectionByNameOrId('audit_logs')
      var record = new Record(auditCol)

      var userId = null
      var userEmail = ''
      var ip = ''

      try {
        var reqInfo = e.requestInfo()
        if (reqInfo) {
          ip = reqInfo.remoteIP || ''
          if (reqInfo.auth) {
            userId = reqInfo.auth.id
            userEmail = reqInfo.auth.getString('email') || ''
          }
        }
      } catch (_) {}

      record.set('user', userId)
      record.set('user_email', userEmail || 'SISTEMA')
      record.set('acao', 'CRIACAO_CONTRATO_DUPLICADO_CONFIRMADO')
      record.set('entidade', 'contratos')
      record.set('registro_id', e.record.id)
      record.set('detalhes', {
        contrato_id: e.record.id,
        numero: e.record.getString('numero'),
        orgao: e.record.getString('orgao'),
        valor: e.record.get('valor'),
        contrato_similar_id: similarId || '',
      })
      record.set('ip', ip)

      $app.save(record)
    }
  } catch (err) {
    console.log('Erro ao registrar auditoria de criacao de contrato duplicado confirmado: ' + err)
  } finally {
    e.next()
  }
}, 'contratos')
