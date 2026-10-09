/// <reference path="../pb_data/types.d.ts" />

// =============================================================================
// MIGRAÇÃO 0059 — CONSISTÊNCIA DA ATIVAÇÃO RETROATIVA DO CONTRATO CTR-2026-0001
// =============================================================================
// Contexto: o contrato CTR-2026-0001 (id a2g38uf5e8zcrzp) foi assinado
// bilateralmente (admin 09/10/2026 14:07 UTC, cliente Beatriz 09/10/2026
// 14:09 UTC) e os hooks recentes ativaram o projeto PRJ-2026-0001
// (id zdsz6qswd2vz8tv, grupo GPR-2026-0001), porém a retroativa de
// consistência nunca rodou. Esta migração completa o estado que a ativação
// deveria ter produzido:
//   1. Contas a receber 50% + 50% (R$ 7,50 cada) em rascunho, vinculadas ao
//      projeto e à proposta, com vencimentos derivados das parcelas gravadas
//      no contrato (1ª na assinatura, 2ª na entrega final);
//   2. prazo_final do projeto = assinatura do cliente + prazo_dias (08/11/2026);
//   3. data_inicio/prazo da etapa do projeto;
//   4. tipo_execucao da etapa vazio (Gestor ainda não definiu o modo);
//   5. dados_complementares_preenchidos = true na proposta;
//   6. PDF final assinado (duas assinaturas) gerado byte a byte (PDF 1.4
//      válido, Helvetica) e gravado via binding Go filesystem.NewFileFromBytes
//      quando disponível; se NENHUM método funcionar, o erro é capturado, a
//      pendência é registrada em audit_logs com a justificativa
//      "PDF assinado pendente — falha na geração durante migração 0059" e a
//      execução continua (a falha do PDF NUNCA derruba a migração);
//   7. expurgo dos logs de auditoria automáticos EDICAO/CRIACAO com diff vazio;
//   8. registro consolidado da migração na auditoria (justificativa
//      "migração 0059 — consistência da ativação", SISTEMA), incluindo a
//      VERIFICAÇÃO item a item re-lida do banco após as gravações.
// Robustez (correção do panic "invalid memory address or nil pointer
// dereference"): TODO acesso a registro carregado (contrato, projeto,
// proposta, etapa, usuário admin) passa por verificação de nulo — se o
// registro não existir, aquele item é PULADO com log e a migração segue.
// Idempotente: cada item só é aplicado quando o estado atual diverge.
// Nota: os hooks de auditoria (audit_record_lifecycle) rodam dentro da mesma
// transação e regravam os registros via $app.save — tudo é persistido junto.
// Nenhum acesso a requestInfo()/IP de requisição é feito aqui (em migração
// não há requisição — usar '127.0.0.1' literal quando o campo ip for exigido).
// =============================================================================

migrate(
  (app) => {
    const contratoId = 'a2g38uf5e8zcrzp'
    const projetoId = 'zdsz6qswd2vz8tv'
    const propostaIdAlvo = 'e0msjfhi5a9j0l7'
    const etapaIdLegado = 'a434n4z0y2jeb06'
    const JUSTIFICATIVA = 'migração 0059 — consistência da ativação'
    const JUSTIFICATIVA_PDF_PENDENTE =
      'PDF assinado pendente — falha na geração durante migração 0059'

    // Coleções podem não existir em ambientes rebuildados: sem elas, nada a fazer.
    let auditCol = null
    try {
      auditCol = app.findCollectionByNameOrId('audit_logs')
    } catch (eAuditCol) {
      console.log('MIGRAÇÃO 0059: coleção audit_logs indisponível: ' + eAuditCol)
    }
    let contasCol = null
    try {
      contasCol = app.findCollectionByNameOrId('contas')
    } catch (eContasCol) {
      console.log('MIGRAÇÃO 0059: coleção contas indisponível: ' + eContasCol)
    }

    // ---------- Helpers -------------------------------------------------------
    function fnLog(msg) {
      console.log('MIGRAÇÃO 0059: ' + msg)
    }

    // Find por id que NUNCA lança: devolve null quando o registro não existe.
    function fnFindOrNull(colecao, id) {
      if (!colecao || !id) return null
      try {
        return app.findRecordById(colecao, id)
      } catch (_) {
        return null
      }
    }

    // Primeiro registro por filtro que NUNCA lança: devolve null se não houver.
    function fnFindFirstOrNull(colecao, filtro, ordenacao) {
      try {
        const lista = app.findRecordsByFilter(colecao, filtro, ordenacao || '', 1, 0)
        return lista && lista.length > 0 ? lista[0] : null
      } catch (_) {
        return null
      }
    }

    function fnBrl(v) {
      const n = Number(v) || 0
      const inteiro = Math.floor(n)
      const cent = Math.round((n - inteiro) * 100)
      const mil = inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      return mil + ',' + (cent < 10 ? '0' + cent : cent)
    }

    function fnDataBr(dt) {
      const d = dt.getUTCDate()
      const m = dt.getUTCMonth() + 1
      const y = dt.getUTCFullYear()
      return (d < 10 ? '0' + d : '' + d) + '/' + (m < 10 ? '0' + m : '' + m) + '/' + y
    }

    function fnPbDate(dt) {
      return dt.toISOString().substring(0, 10) + ' 12:00:00.000Z'
    }

    // Remove acentos/pontuação não-ASCII (PDF fica 100% ASCII -> offsets exatos)
    function fnAscii(s) {
      const map = {
        á: 'a',
        à: 'a',
        â: 'a',
        ã: 'a',
        ä: 'a',
        é: 'e',
        è: 'e',
        ê: 'e',
        ë: 'e',
        í: 'i',
        ì: 'i',
        î: 'i',
        ï: 'i',
        ó: 'o',
        ò: 'o',
        ô: 'o',
        õ: 'o',
        ö: 'o',
        ú: 'u',
        ù: 'u',
        û: 'u',
        ü: 'u',
        ç: 'c',
        ñ: 'n',
        ª: 'a.',
        º: 'o.',
        Á: 'A',
        À: 'A',
        Â: 'A',
        Ã: 'A',
        Ä: 'A',
        É: 'E',
        È: 'E',
        Ê: 'E',
        Ë: 'E',
        Í: 'I',
        Ì: 'I',
        Î: 'I',
        Ï: 'I',
        Ó: 'O',
        Ò: 'O',
        Ô: 'O',
        Õ: 'O',
        Ö: 'O',
        Ú: 'U',
        Ù: 'U',
        Û: 'U',
        Ü: 'U',
        Ç: 'C',
        Ñ: 'N',
        '—': '-',
        '–': '-',
        '‘': "'",
        '’': "'",
        '“': '"',
        '”': '"',
        '…': '...',
      }
      let r = ''
      for (const ch of String(s)) {
        if (map[ch] !== undefined) r += map[ch]
        else if (ch.charCodeAt(0) < 128) r += ch
        else r += '?'
      }
      return r
    }

    function fnWrap(s, largura, maxLinhas) {
      const palavras = fnAscii(s).split(/\s+/)
      const linhas = []
      let atual = ''
      for (let i = 0; i < palavras.length; i++) {
        if ((atual + ' ' + palavras[i]).trim().length > largura) {
          linhas.push(atual.trim())
          atual = palavras[i]
          if (linhas.length >= maxLinhas) break
        } else {
          atual = atual + ' ' + palavras[i]
        }
      }
      if (linhas.length < maxLinhas && atual.trim()) linhas.push(atual.trim())
      return linhas
    }

    function fnPdfEscape(s) {
      return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    }

    // Gera um PDF 1.4 real de 1 página (Helvetica, texto ASCII), com xref
    // calculado por offsets de bytes.
    function fnBuildPdf(blocos) {
      let conteudo = ''
      let y = 800
      for (let i = 0; i < blocos.length; i++) {
        const b = blocos[i]
        if (y < 40) break
        if (!b.t) {
          y -= 8
          continue
        }
        const fonte = b.b ? 'F2' : 'F1'
        const tamanho = b.s || 10
        conteudo +=
          'BT\n/' +
          fonte +
          ' ' +
          tamanho +
          ' Tf\n1 0 0 1 40 ' +
          y +
          ' Tm\n(' +
          fnPdfEscape(b.t) +
          ') Tj\nET\n'
        y -= tamanho + 5
      }
      const objetos = []
      objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>'
      objetos[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
      objetos[3] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'
      objetos[4] =
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
      objetos[5] =
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
      objetos[6] = '<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream'
      let pdf = '%PDF-1.4\n'
      const offsets = [0]
      for (let i = 1; i <= 6; i++) {
        offsets[i] = pdf.length
        pdf += i + ' 0 obj\n' + objetos[i] + '\nendobj\n'
      }
      const xrefPos = pdf.length
      pdf += 'xref\n0 7\n0000000000 65535 f \n'
      for (let i = 1; i <= 6; i++) {
        let off = String(offsets[i])
        while (off.length < 10) off = '0' + off
        pdf += off + ' 00000 n \n'
      }
      pdf += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF'
      return pdf
    }

    // Já existe log dessa ação? (usado para auditoria idempotente da migração)
    function fnJaRegistrado(acao) {
      try {
        const lista = app.findRecordsByFilter('audit_logs', "acao = '" + acao + "'", 'id', 1, 0)
        return lista && lista.length > 0
      } catch (_) {
        return false
      }
    }

    // Log de auditoria "best-effort": NUNCA derruba a migração. Quando
    // gravarUmaUnicaVez = true, a ação é gravada apenas na primeira execução
    // (idempotência: reprocessar a migração não duplica o registro).
    function fnAudit(acao, entidade, registroId, detalhes, gravarUmaUnicaVez) {
      if (!auditCol) return
      if (gravarUmaUnicaVez && fnJaRegistrado(acao)) return
      try {
        const aRec = new Record(auditCol)
        aRec.set('user', null)
        aRec.set('user_email', 'SISTEMA')
        aRec.set('acao', acao)
        aRec.set('entidade', entidade)
        aRec.set('registro_id', registroId)
        aRec.set('detalhes', detalhes)
        aRec.set('ip', '127.0.0.1')
        app.save(aRec)
      } catch (errAuditRec) {
        fnLog('auditoria ' + acao + ' não gravada (seguindo): ' + errAuditRec)
      }
    }

    // ---------- 0. Carregar registros-base (com guardas de nulo) --------------
    const contrato = fnFindOrNull('contratos_servico', contratoId)
    if (!contrato) {
      fnLog(
        'contrato CTR-2026-0001 (' +
          contratoId +
          ') não encontrado — nenhum saneamento aplicado; migracao marcada como aplicada.',
      )
      return
    }
    if (contrato.getString('status') !== 'assinado') {
      fnLog(
        'contrato CTR-2026-0001 não está assinado (status: ' +
          contrato.getString('status') +
          ') — nenhum saneamento aplicado; migracao marcada como aplicada.',
      )
      return
    }

    const projeto = fnFindOrNull('projetos', projetoId)
    if (!projeto) {
      fnLog(
        'projeto PRJ-2026-0001 (' +
          projetoId +
          ') não encontrado — pulando itens do projeto; migracao marcada como aplicada.',
      )
      return
    }
    if (projeto.getString('contrato_servico') !== contratoId) {
      fnLog(
        'projeto PRJ-2026-0001 não está vinculado ao contrato CTR-2026-0001 — pulando itens do projeto; migracao marcada como aplicada.',
      )
      return
    }

    // A proposta é opcional: ausente não aborta (só empurra default nos textos).
    const proposta = fnFindOrNull('propostas', propostaIdAlvo)

    // Datas canônicas: dia da assinatura às 12h UTC; prazo em dias corridos.
    let prazoDias = 30
    let dtAssinatura = null
    try {
      const dataAssinaturaCliente = contrato.getDateTime('data_assinatura_cliente').string()
      dtAssinatura = new Date(dataAssinaturaCliente.replace(' ', 'T'))
      if (isNaN(dtAssinatura.getTime())) dtAssinatura = null
    } catch (_) {
      dtAssinatura = null
    }
    if (!dtAssinatura) {
      // Data de referência gravada no contrato real (fallback estável).
      dtAssinatura = new Date('2026-10-09T14:09:20.305Z')
      fnLog('data_assinatura_cliente do contrato inválida/ausente — usando fallback 2026-10-09.')
    }
    const cd = contrato.getInt('prazo_dias')
    if (cd && cd > 0) prazoDias = cd

    const dtInicio = new Date(
      Date.UTC(
        dtAssinatura.getUTCFullYear(),
        dtAssinatura.getUTCMonth(),
        dtAssinatura.getUTCDate(),
        12,
        0,
        0,
      ),
    )
    const dtPrazoFinal = new Date(dtInicio.getTime() + prazoDias * 86400000)
    const dataInicioPb = fnPbDate(dtInicio) // 2026-10-09 (dia da assinatura do cliente)
    const prazoFinalPb = fnPbDate(dtPrazoFinal) // 2026-11-08 (assinatura + 30 dias)
    const dataInicioBr = fnDataBr(dtInicio)
    const prazoFinalBr = fnDataBr(dtPrazoFinal)

    // Parcelas gravadas no contrato (1ª na assinatura, 2ª na entrega final).
    let parcelas = []
    try {
      const raw = JSON.parse(contrato.getString('parcelas_json') || '[]')
      if (Array.isArray(raw)) parcelas = raw
    } catch (errParc) {
      parcelas = []
      fnLog(
        'parcelas_json do contrato é inválido (' +
          errParc +
          ') — usando 2 parcelas 50/50 de R$ 7,50.',
      )
    }
    if (!parcelas || parcelas.length === 0) {
      parcelas = [
        {
          ordem: 1,
          percentual: 50,
          valor: 7.5,
          gatilho: 'contratacao',
          descricao: '50% (cinquenta por cento) na assinatura do contrato/aceite',
        },
        {
          ordem: 2,
          percentual: 50,
          valor: 7.5,
          gatilho: 'entrega',
          descricao: '50% (cinquenta por cento) na entrega final dos projetos executivos',
        },
      ]
    }
    parcelas.sort(function (a, b) {
      return (Number(a && a.ordem) || 0) - (Number(b && b.ordem) || 0)
    })

    const condicoesPagamento =
      (proposta && proposta.getString('condicoes_pagamento')) || 'Conforme contrato assinado'
    const requerNota = proposta ? proposta.getBool('requer_nota') : false

    // ---------- 1. CONTAS A RECEBER (50% + 50%) -------------------------------
    // Idempotente: cria apenas quando NÃO existe nenhuma conta a receber do
    // contrato. Cada criação é protegida: uma conta que falhe não derruba as demais.
    const contasCriadas = []
    let contasJaExistem = 0
    if (contasCol) {
      let contasExistentes = []
      try {
        contasExistentes = app.findRecordsByFilter(
          'contas',
          "tipo = 'receber' && descricao ~ '" + contrato.getString('numero') + "'",
          '-created',
          10,
          0,
        )
      } catch (_) {
        contasExistentes = []
      }
      contasJaExistem = contasExistentes ? contasExistentes.length : 0

      if (contasJaExistem > 0) {
        fnLog('contas a receber do contrato já existem (' + contasJaExistem + ') — nada a criar.')
      } else {
        for (let i = 0; i < parcelas.length; i++) {
          const parc = parcelas[i] || {}
          const ordem = Number(parc.ordem) || i + 1
          const perc = Number(parc.percentual) || 0
          const valorParc = Number(parc.valor) || (contrato.getFloat('valor_total') * perc) / 100
          const descParc = parc.descricao || 'Parcela ' + ordem + '/' + parcelas.length
          const gatilho = (parc.gatilho || 'marco').toString().toLowerCase()

          // Vencimento derivado da parcela: 1ª na assinatura, demais na entrega final
          let vencimentoDt
          if (gatilho === 'contratacao' || gatilho === 'assinatura') {
            vencimentoDt = dtInicio
          } else if (gatilho === 'entrega' || gatilho === 'conclusao') {
            vencimentoDt = dtPrazoFinal
          } else {
            vencimentoDt = i === 0 ? dtInicio : dtPrazoFinal
          }

          try {
            const novaConta = new Record(contasCol)
            novaConta.set('tipo', 'receber')
            novaConta.set('projeto', projetoId)
            if (proposta) novaConta.set('proposta', proposta.id)
            novaConta.set(
              'descricao',
              'Contrato ' +
                contrato.getString('numero') +
                ' — Parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ': ' +
                descParc +
                (requerNota ? ' (Com NF)' : ' (Sem NF)'),
            )
            novaConta.set('valor', valorParc)
            novaConta.set('status', 'rascunho')
            novaConta.set('forma_pagamento', 'Gatilho: ' + gatilho + ' | ' + condicoesPagamento)
            novaConta.set('bloqueada_por_fechamento', false)
            novaConta.set('retencao_impostos', 0)
            novaConta.set('valor_liquido', valorParc)
            novaConta.set('vencimento', fnPbDate(vencimentoDt))
            app.save(novaConta)
            contasCriadas.push({
              id: novaConta.id,
              ordem: ordem,
              valor: valorParc,
              vencimento: fnPbDate(vencimentoDt),
            })

            fnAudit('CRIACAO_CONTA_RECEBER_MIGRACAO', 'contas', novaConta.id, {
              justificativa: JUSTIFICATIVA,
              origem: 'SISTEMA / MIGRATION_0059',
              mensagem:
                'Conta a receber retroativa (parcela ' +
                ordem +
                '/' +
                parcelas.length +
                ') criada pela migração 0059 para o Contrato ' +
                contrato.getString('numero'),
              contrato_id: contratoId,
              contrato_numero: contrato.getString('numero'),
              projeto_id: projetoId,
              proposta_id: propostaIdAlvo,
              ordem: ordem,
              percentual: perc,
              valor: valorParc,
              gatilho: gatilho,
              vencimento: fnPbDate(vencimentoDt),
            })
          } catch (errConta) {
            fnLog('falha ao criar conta a receber da parcela ' + ordem + ' (seguindo): ' + errConta)
          }
        }
      }
    } else {
      fnLog('coleção contas indisponível — item 1 pulado.')
    }

    // ---------- 2. PRAZO_FINAL DO PROJETO -------------------------------------
    // Idempotente: só grava quando vazio (não sobrescreve dado já correto).
    if (!projeto.getString('prazo_final')) {
      projeto.set('prazo_final', prazoFinalPb)
      app.save(projeto)
    }

    // ---------- 3 e 4. ETAPA DO PROJETO (datas + tipo_execucao vazio) ---------
    // O id a434n4z0y2jeb06 citado no levantamento está obsoleto: a etapa única
    // do PRJ-2026-0001 ("Etapa: Modelagem da Informação da Construção (BIM
    // Compatibilização)") tem outro id. Resolver pela etapa de ordem 1 do projeto.
    let etapa = fnFindOrNull('projeto_etapas', etapaIdLegado)
    if (etapa && etapa.getString('projeto') !== projetoId) {
      etapa = null
    }
    if (!etapa) {
      etapa = fnFindFirstOrNull('projeto_etapas', "projeto = '" + projetoId + "'", 'ordem,created')
    }
    if (!etapa) {
      fnLog('nenhuma etapa encontrada para o projeto PRJ-2026-0001 — item 3/4 pulado (seguindo).')
    } else {
      let etapaAlterada = false
      const tipoAnterior = etapa.getString('tipo_execucao') || ''
      if (!etapa.getString('data_inicio')) {
        etapa.set('data_inicio', dataInicioPb)
        etapaAlterada = true
      }
      if (!etapa.getString('prazo')) {
        etapa.set('prazo', prazoFinalPb)
        etapaAlterada = true
      }
      if (tipoAnterior) {
        // O Gestor ainda não definiu o modo de execução (projeto em standby
        // aguardando_definicao): o valor 'direta' gravado pelo hook é incorreto.
        etapa.set('tipo_execucao', '')
        etapaAlterada = true
      }
      if (etapaAlterada) {
        app.save(etapa)
        fnAudit('AJUSTE_ETAPA_MIGRACAO', 'projeto_etapas', etapa.id, {
          justificativa: JUSTIFICATIVA,
          origem: 'SISTEMA / MIGRATION_0059',
          mensagem: 'Datas e tipo_execucao da etapa do PRJ-2026-0001 corrigidos pela migração 0059',
          etapa_id_legado_informado: etapaIdLegado,
          etapa_id_resolvido: etapa.id,
          data_inicio: dataInicioPb,
          prazo: prazoFinalPb,
          tipo_execucao_anterior: tipoAnterior,
          tipo_execucao_novo: '',
        })
      }
    }

    // ---------- 5. DADOS COMPLEMENTARES DA PROPOSTA ---------------------------
    if (!proposta) {
      fnLog('proposta alvo não encontrada — item 5 pulado (seguindo).')
    } else if (!proposta.getBool('dados_complementares_preenchidos')) {
      proposta.set('dados_complementares_preenchidos', true)
      app.save(proposta)
    }

    // ---------- 6. PDF FINAL ASSINADO DO CONTRATO -----------------------------
    // Uma falha aqui NÃO derruba a migração: captura, registra pendência na
    // auditoria e segue.
    let nomeAdmin = 'Diretoria G+ Engenharia'
    try {
      const adminId = contrato.getString('assinante_admin')
      if (adminId) {
        const adm = fnFindOrNull('users', adminId)
        if (adm) {
          nomeAdmin = adm.getString('name') || adm.getString('email') || nomeAdmin
        } else {
          fnLog('usuário admin assinante não encontrado — usando nome padrão no PDF (seguindo).')
        }
      }
    } catch (_) {}

    const clienteNome = contrato.getString('cliente_nome_assinante') || 'Cliente'
    const clienteDoc = contrato.getString('cliente_documento_assinante') || ''
    let dataAdminBr = '-'
    let dataClienteBr = fnDataBr(dtAssinatura)
    try {
      const dtAdm = new Date(
        contrato.getDateTime('data_assinatura_admin').string().replace(' ', 'T'),
      )
      if (!isNaN(dtAdm.getTime())) dataAdminBr = fnDataBr(dtAdm)
    } catch (_) {}
    const nomeArquivoPdf = 'CTR_2026_0001_contrato_assinado.pdf'

    let pdfMetodo = ''
    let pdfErro = ''
    if (contrato.getString('arquivo_pdf_assinado')) {
      pdfMetodo = 'ja_existente'
      fnLog('contrato já possui arquivo_pdf_assinado — item 6 pulado (idempotência).')
    } else {
      // Monta as linhas do documento (qualquer falha aqui vira pendência, não panic)
      let pdfConteudo = ''
      try {
        const linhasObjeto = fnWrap(contrato.getString('objeto'), 95, 6)
        const linhasClausulas = fnWrap(contrato.getString('clausulas_texto'), 95, 14)
        const blocosPdf = [
          { t: 'CONTRATO DE PRESTACAO DE SERVICOS TECNICOS DE ENGENHARIA', b: true, s: 13 },
          { t: 'Contrato no. ' + contrato.getString('numero'), s: 10 },
          {
            t:
              'Proposta no. ' +
              (proposta ? proposta.getString('numero') : propostaIdAlvo) +
              (proposta ? ' - revisao ' + proposta.getString('revisao') : ''),
            s: 10,
          },
          {
            t: 'Documento final consolidado - assinaturas eletronicas registradas no sistema GESTAO G+',
            s: 9,
          },
          { t: '' },
          { t: '1. DAS PARTES', b: true, s: 11 },
          {
            t: 'CONTRATANTE: ' + clienteNome + (clienteDoc ? ' (CPF/CNPJ ' + clienteDoc + ')' : ''),
            s: 10,
          },
          {
            t:
              'CONTRATADA: G+ Engenharia Consultiva e Projetos (representada por ' +
              nomeAdmin +
              ')',
            s: 10,
          },
          { t: '' },
          { t: '2. DO OBJETO', b: true, s: 11 },
        ]
        for (let i = 0; i < linhasObjeto.length; i++) blocosPdf.push({ t: linhasObjeto[i], s: 10 })
        blocosPdf.push({ t: '' })
        blocosPdf.push({ t: '3. DO VALOR E DAS PARCELAS', b: true, s: 11 })
        blocosPdf.push({
          t:
            'Valor global: R$ ' +
            fnBrl(contrato.getFloat('valor_total')) +
            ' - Prazo de execucao: ' +
            prazoDias +
            ' dias corridos contados da assinatura (' +
            dataClienteBr +
            '), com termino em ' +
            prazoFinalBr +
            '.',
          s: 10,
        })
        for (let i = 0; i < parcelas.length; i++) {
          const parc = parcelas[i] || {}
          const perc = Number(parc.percentual) || 0
          const valorParc = Number(parc.valor) || (contrato.getFloat('valor_total') * perc) / 100
          const gatilho = (parc.gatilho || 'marco').toString().toLowerCase()
          const vencTxt =
            gatilho === 'contratacao' || gatilho === 'assinatura'
              ? dataInicioBr + ' (assinatura)'
              : gatilho === 'entrega' || gatilho === 'conclusao'
                ? prazoFinalBr + ' (entrega final)'
                : gatilho
          blocosPdf.push({
            t:
              '- Parcela ' +
              (Number(parc.ordem) || i + 1) +
              '/' +
              parcelas.length +
              ': ' +
              perc +
              '% = R$ ' +
              fnBrl(valorParc) +
              ' - ' +
              (parc.descricao || '') +
              ' - vencimento: ' +
              vencTxt,
            s: 10,
          })
        }
        blocosPdf.push({ t: '' })
        blocosPdf.push({ t: '4. DAS CLAUSULAS GERAIS', b: true, s: 11 })
        for (let i = 0; i < linhasClausulas.length; i++)
          blocosPdf.push({ t: linhasClausulas[i], s: 9 })
        if (fnAscii(contrato.getString('clausulas_texto')).length > 14 * 95) {
          blocosPdf.push({ t: '(texto integral disponivel no sistema GESTAO G+)', s: 9 })
        }
        blocosPdf.push({ t: '' })
        blocosPdf.push({ t: '5. DAS ASSINATURAS ELETRONICAS', b: true, s: 11 })
        blocosPdf.push({
          t: 'As partes declaram que a assinatura eletronica tem plena validade juridica, com registro de',
          s: 9,
        })
        blocosPdf.push({ t: 'data/hora, endereco IP e hash de integridade.', s: 9 })
        blocosPdf.push({ t: '' })
        blocosPdf.push({ t: 'CONTRATADA - G+ ENGENHARIA', b: true, s: 10 })
        blocosPdf.push({
          t:
            nomeAdmin +
            ' - Assinada em ' +
            dataAdminBr +
            ' (UTC) - IP ' +
            (contrato.getString('admin_ip') || '-'),
          s: 10,
        })
        blocosPdf.push({
          t: 'Hash de integridade: ' + (contrato.getString('admin_hash') || '-'),
          s: 9,
        })
        blocosPdf.push({ t: '' })
        blocosPdf.push({ t: 'CONTRATANTE', b: true, s: 10 })
        blocosPdf.push({
          t:
            clienteNome +
            ' - Assinada em ' +
            dataClienteBr +
            ' (UTC) - IP ' +
            (contrato.getString('cliente_ip') || '-'),
          s: 10,
        })
        blocosPdf.push({
          t: 'Hash de integridade: ' + (contrato.getString('cliente_hash') || '-'),
          s: 9,
        })
        blocosPdf.push({ t: '' })
        blocosPdf.push({
          t: 'Emitido digitalmente pelo sistema GESTAO G+ (migracao 0059 - consistencia da ativacao). Dados ficticios - homologacao.',
          s: 8,
        })
        pdfConteudo = fnBuildPdf(blocosPdf)
      } catch (errPdfBuild) {
        pdfErro = 'falha ao montar o conteúdo do PDF: ' + errPdfBuild
      }

      if (pdfConteudo) {
        // Único método tentado: binding Go filesystem.NewFileFromBytes, atrás
        // de typeof (ausente no runtime de migrações => apenas não entra).
        // NÃO se usa app.newFilesystem()/fsys.upload()/baseFilesPath() aqui:
        // essas chamadas nativas entram em nil pointer dereference no runtime
        // de migrações (panic Go que o try/catch do goja não captura) e o
        // PocketBase valida o campo file no save ("Invalid new files"),
        // rejeitando o nome gravado sem o arquivo no storage.
        try {
          if (
            typeof filesystem !== 'undefined' &&
            filesystem &&
            typeof filesystem.NewFileFromBytes === 'function'
          ) {
            contrato.set(
              'arquivo_pdf_assinado',
              filesystem.NewFileFromBytes(pdfConteudo, nomeArquivoPdf),
            )
            pdfMetodo = 'filesystem.NewFileFromBytes'
          }
        } catch (eFs2) {
          fnLog('filesystem.NewFileFromBytes falhou: ' + eFs2)
        }
      }

      if (pdfMetodo) {
        try {
          app.save(contrato)
          fnAudit('GERACAO_PDF_ASSINADO_MIGRACAO', 'contratos_servico', contrato.id, {
            justificativa: JUSTIFICATIVA,
            origem: 'SISTEMA / MIGRATION_0059',
            mensagem:
              'PDF final do Contrato ' +
              contrato.getString('numero') +
              ' gerado com as duas assinaturas eletrônicas e anexado ao registro (arquivo_pdf_assinado).',
            arquivo: nomeArquivoPdf,
            metodo_anexo: pdfMetodo,
            assinante_admin: nomeAdmin,
            assinante_cliente: clienteNome,
          })
        } catch (errPdfSave) {
          pdfErro = pdfErro || 'falha ao gravar o contrato com o PDF: ' + errPdfSave
          pdfMetodo = ''
          fnLog('gravação do contrato com PDF falhou: ' + errPdfSave)
        }
      }

      if (!pdfMetodo) {
        // Pendência documentada — a migração SEGUE de pé.
        fnLog(
          'PDF assinado NÃO anexado: ' +
            (pdfErro || 'nenhum método de anexo disponível no runtime de migrações'),
        )
        fnAudit('PENDENCIA_PDF_ASSINADO_MIGRACAO', 'contratos_servico', contratoId, {
          justificativa: JUSTIFICATIVA_PDF_PENDENTE,
          origem: 'SISTEMA / MIGRATION_0059',
          mensagem:
            'PDF assinado do Contrato ' +
            contrato.getString('numero') +
            ' NÃO foi anexado: falha na geração/upload durante a migração 0059. Anexar manualmente.',
          erro: pdfErro || 'nenhum método de anexo disponível no runtime de migrações',
          arquivo_previsto: nomeArquivoPdf,
        })
      }
    }

    // ---------- 7. EXPURGO DE AUDITORIA COM DIFF VAZIO ------------------------
    // Remove APENAS os logs automáticos EDICAO/CRIACAO com diff vazio
    // (antes:{} e depois:{}), preservando todo o histórico restante.
    const sqlCondicao =
      "acao IN ('EDICAO', 'CRIACAO') " +
      "AND entidade != 'audit_logs' " +
      "AND (detalhes IS NULL OR detalhes = '' " +
      "OR REPLACE(REPLACE(detalhes, ' ', ''), CHAR(10), '') IN ('{}', '{\"antes\":{},\"depois\":{}}', '{\"depois\":{}}') " +
      "OR (acao = 'EDICAO' AND REPLACE(detalhes, ' ', '') LIKE '%\"antes\":{}%' AND REPLACE(detalhes, ' ', '') LIKE '%\"depois\":{}%') " +
      "OR (acao = 'CRIACAO' AND REPLACE(detalhes, ' ', '') LIKE '%\"depois\":{}%'))"

    let expurgoAlvo = 0
    let expurgados = 0
    try {
      if (app.hasTable('audit_logs')) {
        // Padrão da migração 0055: o resultado vai num objeto receptor passado
        // a .one(res) — a forma sem argumento entra em nil pointer no runtime
        // de migrações (panic Go que o try/catch do goja não captura).
        const resCount = {}
        app
          .db()
          .newQuery('SELECT COUNT(*) AS n FROM audit_logs WHERE ' + sqlCondicao)
          .one(resCount)
        if (resCount && typeof resCount.n !== 'undefined') expurgoAlvo = Number(resCount.n) || 0
      }
    } catch (errCount) {
      fnLog('falha ao contar logs a expurgar (seguindo): ' + errCount)
    }
    if (expurgoAlvo > 0) {
      try {
        app
          .db()
          .newQuery('DELETE FROM audit_logs WHERE ' + sqlCondicao)
          .execute()
        expurgados = expurgoAlvo
      } catch (errDel) {
        fnLog('falha ao expurgar logs com diff vazio (seguindo): ' + errDel)
      }
    }

    // ---------- VERIFICAÇÃO (re-lê o estado real gravado) ---------------------
    const verificacao = {
      contas_criadas_count: contasCriadas.length,
      contas_ja_existentes: contasJaExistem,
      contas: [],
      projeto_prazo_final: '',
      etapa: {},
      proposta_dados_complementares_preenchidos: null,
      contrato_pdf_assinado: '',
      pdf_metodo: pdfMetodo,
      pdf_erro: pdfErro,
      logs_alvo_expurgo: expurgoAlvo,
      logs_expurgados: expurgados,
      logs_vazios_restantes: 0,
    }
    try {
      if (contasCol) {
        const contasRe = app.findRecordsByFilter(
          'contas',
          "projeto = '" + projetoId + "' && tipo = 'receber'",
          '-created',
          10,
          0,
        )
        for (let i = 0; i < contasRe.length; i++) {
          verificacao.contas.push({
            id: contasRe[i].id,
            descricao: contasRe[i].getString('descricao'),
            valor: contasRe[i].getFloat('valor'),
            status: contasRe[i].getString('status'),
            vencimento: contasRe[i].getString('vencimento'),
            proposta: contasRe[i].getString('proposta'),
          })
        }
      }
      const projetoRe = fnFindOrNull('projetos', projetoId)
      if (projetoRe) verificacao.projeto_prazo_final = projetoRe.getString('prazo_final')
      if (etapa) {
        const etapaRe = fnFindOrNull('projeto_etapas', etapa.id)
        if (etapaRe) {
          verificacao.etapa = {
            id: etapaRe.id,
            data_inicio: etapaRe.getString('data_inicio'),
            prazo: etapaRe.getString('prazo'),
            tipo_execucao: etapaRe.getString('tipo_execucao'),
          }
        }
      }
      if (proposta) {
        const propostaRe = fnFindOrNull('propostas', propostaIdAlvo)
        if (propostaRe) {
          verificacao.proposta_dados_complementares_preenchidos = propostaRe.getBool(
            'dados_complementares_preenchidos',
          )
        }
      }
      const contratoRe = fnFindOrNull('contratos_servico', contratoId)
      if (contratoRe)
        verificacao.contrato_pdf_assinado = contratoRe.getString('arquivo_pdf_assinado')
      const resRest = {}
      app
        .db()
        .newQuery('SELECT COUNT(*) AS n FROM audit_logs WHERE ' + sqlCondicao)
        .one(resRest)
      if (resRest && typeof resRest.n !== 'undefined') {
        verificacao.logs_vazios_restantes = Number(resRest.n) || 0
      }
    } catch (errVerif) {
      verificacao.erro_verificacao = '' + errVerif
    }
    fnLog('VERIFICACAO ' + JSON.stringify(verificacao))

    // ---------- 8. AUDITORIA CONSOLIDADA DA MIGRAÇÃO --------------------------
    // gravarUmaUnicaVez = true: rodar de novo não duplica o registro consolidado.
    fnAudit(
      'MIGRACAO_0059_CONSISTENCIA_ATIVACAO',
      'contratos_servico',
      contratoId,
      {
        justificativa: JUSTIFICATIVA,
        origem: 'SISTEMA / MIGRATION_0059',
        mensagem:
          'Migração 0059 executada: contas a receber 50%/50% criadas em rascunho, prazo_final do projeto definido (' +
          prazoFinalBr +
          '), datas da etapa corrigidas, tipo_execucao da etapa limpo para definição do Gestor, dados_complementares_preenchidos=true na proposta, PDF assinado ' +
          (pdfMetodo
            ? 'gerado e anexado (' + pdfMetodo + ')'
            : 'PENDENTE (falha registrada na auditoria)') +
          ', e logs de auditoria com diff vazio expurgados.',
        contrato_id: contratoId,
        contrato_numero: contrato.getString('numero'),
        projeto_id: projetoId,
        proposta_id: propostaIdAlvo,
        prazo_dias: prazoDias,
        data_assinatura_cliente: dtAssinatura.toISOString(),
        data_inicio_etapa: dataInicioPb,
        prazo_final_projeto: prazoFinalPb,
        contas_criadas: contasCriadas,
        contas_ja_existentes: contasJaExistem,
        etapa_id_legado_informado: etapaIdLegado,
        etapa_id_resolvido: etapa ? etapa.id : '',
        pdf_arquivo: nomeArquivoPdf,
        pdf_metodo: pdfMetodo,
        pdf_erro: pdfErro,
        logs_expurgados: expurgados,
        logs_alvo_expurgo: expurgoAlvo,
        verificacao: verificacao,
      },
      true,
    )
  },
  (app) => {
    // Reversão no-op: migração de dados (padrão das migrações 0054/0058).
  },
)
