// Hook — Sincronização do "espelho" empresa ↔ cliente PF (PARTE B — ponto único)
//
// A coleção `empresas` tem registros espelho dos clientes pessoa física
// (tipo_cliente='pf', cliente_pf_ref → clientes_pf), usados pela visão unificada
// PJ/PF. Este hook garante que QUALQUER atualização relevante do cliente PF
// (aprovação pelo link público em clientes_pf_convites.js, edição interna pelo
// formulário/detalhe, etc.) seja refletida no espelho, SEM duplicar lógica:
//   - onRecordAfterUpdateSuccess('clientes_pf') roda DEPOIS de qualquer gravação
//     no cliente, incluindo a feita pela rota /aprovar (que já grava o nome
//     formatado com formatarNomeProprio). O espelho copia os valores JÁ
//     normalizados do registro — sem reformatar.
//   - Se não existe espelho (empresas com cliente_pf_ref = cliente), NADA é
//     criado — a sincronização é apenas de atualização.
//
// Campos espelhados quando mudarem no cliente:
//   nome → razao_social + nome_fantasia
//   cpf  → cnpj (somente quando o espelho é tipo_cliente='pf')
//   email, telefone, telefones, cep, logradouro, numero, complemento,
//   bairro, municipio, uf
//
// Regras respeitadas: helpers inline no callback (evita Hook scoping error);
// sem requestInfo().remoteIP; auditoria em audit_logs (quem, o quê, quando);
// leitura segura de JSON (getString + JSON.parse) como padrão do projeto.

onRecordAfterUpdateSuccess((e) => {
  const rec = e.record
  if (!rec || !rec.collection() || rec.collection().name !== 'clientes_pf') {
    e.next()
    return
  }

  try {
    // Campos relevantes para o espelho
    const CAMPOS = [
      'nome',
      'cpf',
      'email',
      'telefone',
      'telefones',
      'cep',
      'logradouro',
      'numero',
      'complemento',
      'bairro',
      'municipio',
      'uf',
    ]

    // Valor legível de um campo do registro (JSON lido com getString + JSON.parse)
    function lerValorSeguro(r, campo) {
      if (campo === 'telefones') {
        try {
          const raw = r.getString('telefones')
          if (raw) {
            const parsed = JSON.parse(raw)
            return parsed && typeof parsed === 'object' ? parsed : []
          }
          const direto = r.get('telefones')
          if (direto && typeof direto === 'object') return direto
          return []
        } catch (_) {
          return []
        }
      }
      return (r.getString(campo) || '').toString().trim()
    }

    // Compara valores antigo/novo de forma estável (JSON p/ objetos)
    function valoresDiferentes(a, b) {
      if (typeof a === 'object' || typeof b === 'object') {
        return JSON.stringify(a || null) !== JSON.stringify(b || null)
      }
      return (a || '') !== (b || '')
    }

    const original = rec.original()
    const mudancas = []
    const novosValores = {}
    for (let i = 0; i < CAMPOS.length; i++) {
      const campo = CAMPOS[i]
      const valorNovo = lerValorSeguro(rec, campo)
      const valorAntigo = original ? lerValorSeguro(original, campo) : ''
      if (valoresDiferentes(valorNovo, valorAntigo)) {
        mudancas.push(campo)
        novosValores[campo] = valorNovo
      }
    }

    // Nada relevante mudou → nada a espelhar (evita trabalho e auditoria ruído)
    if (mudancas.length === 0) {
      e.next()
      return
    }

    // Busca o espelho: empresas com cliente_pf_ref = cliente (NÃO cria se não houver)
    let espelhos = []
    try {
      espelhos = $app.findRecordsByFilter(
        'empresas',
        "cliente_pf_ref = '" + rec.id + "'",
        '-id',
        5,
        0,
      )
    } catch (eEsp) {
      console.log('Aviso ao buscar empresa espelho do cliente PF ' + rec.id + ': ' + eEsp)
    }
    if (!espelhos || espelhos.length === 0) {
      e.next()
      return
    }

    const espelho = espelhos[0]
    const payload = {}

    if (novosValores.nome !== undefined && novosValores.nome) {
      payload.razao_social = novosValores.nome
      payload.nome_fantasia = novosValores.nome
    }
    // CPF → cnpj apenas quando o espelho é de pessoa física
    if (
      novosValores.cpf !== undefined &&
      novosValores.cpf &&
      (espelho.getString('tipo_cliente') || '') === 'pf'
    ) {
      payload.cnpj = novosValores.cpf
    }
    if (novosValores.email !== undefined) payload.email = novosValores.email
    if (novosValores.telefone !== undefined) payload.telefone = novosValores.telefone
    if (novosValores.telefones !== undefined) payload.telefones = novosValores.telefones
    if (novosValores.cep !== undefined) payload.cep = novosValores.cep
    if (novosValores.logradouro !== undefined) payload.logradouro = novosValores.logradouro
    if (novosValores.numero !== undefined) payload.numero = novosValores.numero
    if (novosValores.complemento !== undefined) payload.complemento = novosValores.complemento
    if (novosValores.bairro !== undefined) payload.bairro = novosValores.bairro
    if (novosValores.municipio !== undefined) payload.municipio = novosValores.municipio
    if (novosValores.uf !== undefined) payload.uf = novosValores.uf

    if (Object.keys(payload).length > 0) {
      for (const [campo, valor] of Object.entries(payload)) {
        espelho.set(campo, valor)
      }
      $app.save(espelho)
    }

    // Auditoria: quem, o quê, quando (sem valores pessoais sensíveis — só nomes de campos)
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const aRec = new Record(auditCol)
      aRec.set('user', e.auth && e.auth.id ? e.auth.id : null)
      aRec.set('user_email', e.auth && e.auth.id ? e.auth.getString('email') : 'SISTEMA')
      aRec.set('acao', 'SINCRONIZACAO_ESPELHO_EMPRESA_CLIENTE_PF')
      aRec.set('entidade', 'clientes_pf')
      aRec.set('registro_id', rec.id)
      aRec.set('detalhes', {
        origem: 'HOOK_POS_UPDATE_CLIENTES_PF',
        empresa_espelho_id: espelho.id,
        campos_sincronizados: Object.keys(payload),
        mudancas_detectadas: mudancas,
      })
      $app.save(aRec)
    } catch (eAudit) {
      console.log('Aviso ao auditar sincronização de espelho cliente PF: ' + eAudit)
    }
  } catch (err) {
    // A sincronização do espelho não pode quebrar a gravação do cliente
    console.log('Aviso ao sincronizar empresa espelho do cliente PF: ' + err)
    try {
      const errCol = $app.findCollectionByNameOrId('erros_sistema')
      if (errCol) {
        const errRec = new Record(errCol)
        errRec.set('rota', 'hook:onRecordAfterUpdateSuccess:clientes_pf')
        errRec.set('mensagem', ('Erro ao sincronizar espelho empresa: ' + err).slice(0, 1000))
        errRec.set('hora', new Date().toISOString())
        errRec.set('detalhes', { erro: String(err) })
        $app.save(errRec)
      }
    } catch (_) {}
  }

  e.next()
}, 'clientes_pf')
