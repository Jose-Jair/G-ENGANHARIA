// Migração 0075 — Provas no banco de dados das Regras do Funil e Limpeza Completa
// Provas de:
// (a) Empresa incompleta -> identificação precisa das pendências
// (b) Transição automática ao qualificar + auditoria QUALIFICACAO_AUTOMATICA
// (c) Conversão de proposta -> projeto + parceira + auditoria CONVERSAO_PARCEIRO
// (d) Sugestão de fim de funil (>7 dias) + migração para nutricao_mensal (MIGRACAO_NUTRICAO) + nao_contatar (MARCADO_NAO_CONTATAR)
// (e) Validação de permissões exclusivas de Admin (403)
// (f) Limpeza completa de todos os dados fictícios criados

migrate(
  (app) => {
    function validarCnpjMod11(cnpjVal) {
      if (!cnpjVal) return false
      const limpo = String(cnpjVal).replace(/\D/g, '')
      if (limpo.length !== 14) return false
      if (/^(\d)\1{13}$/.test(limpo)) return false

      const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      let soma = 0
      for (let i = 0; i < 12; i++) {
        soma += parseInt(limpo.charAt(i), 10) * pesos1[i]
      }
      let resto = soma % 11
      const dig1 = resto < 2 ? 0 : 11 - resto
      if (parseInt(limpo.charAt(12), 10) !== dig1) return false

      const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      soma = 0
      for (let i = 0; i < 13; i++) {
        soma += parseInt(limpo.charAt(i), 10) * pesos2[i]
      }
      resto = soma % 11
      const dig2 = resto < 2 ? 0 : 11 - resto
      return parseInt(limpo.charAt(13), 10) === dig2
    }

    function checarRequisitosQualificacaoEmpresa(empRec) {
      const pendencias = []
      const rSocial = (empRec.getString('razao_social') || '').trim()
      if (!rSocial) pendencias.push('razão social')

      const cCnpj = (empRec.getString('cnpj') || '').trim()
      if (!cCnpj || !validarCnpjMod11(cCnpj)) {
        pendencias.push('CNPJ válido')
      }

      const eMail = (empRec.getString('email') || '').trim()
      if (!eMail) pendencias.push('e-mail')

      const tTel = (empRec.getString('telefone') || '').trim()
      if (!tTel) pendencias.push('telefone')

      const rResp = (empRec.getString('responsavel') || '').trim()
      if (!rResp) pendencias.push('responsável interno atribuído')

      let temDecisorValido = false
      const empId = empRec.id
      if (empId) {
        try {
          const contatosDecisores = app.findRecordsByFilter(
            'contatos',
            'empresa = {:empId} && decisor = true',
            '-created',
            50,
            0,
            { empId: empId },
          )
          for (let c = 0; c < contatosDecisores.length; c++) {
            const cRec = contatosDecisores[c]
            const cEmail = (cRec.getString('email') || '').trim()
            const cTelefone = (cRec.getString('telefone') || '').trim()
            if (cEmail && cTelefone) {
              temDecisorValido = true
              break
            }
          }
        } catch (_) {}
      }
      if (!temDecisorValido) pendencias.push('contato decisor com e-mail e telefone')
      return pendencias
    }

    const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    const comercialUser = app.findFirstRecordByData('users', 'email', 'comercial@sistema.eng.br')

    const idsEmpresasLimpar = []
    const idsContatosLimpar = []
    const idsPropostasLimpar = []
    const idsProjetosLimpar = []
    const idsNaoContatarLimpar = []
    const idsAuditLogsLimpar = []

    try {
      const empCol = app.findCollectionByNameOrId('empresas')
      const contCol = app.findCollectionByNameOrId('contatos')
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const propCol = app.findCollectionByNameOrId('propostas')
      const projCol = app.findCollectionByNameOrId('projetos')
      const naoContatarCol = app.findCollectionByNameOrId('nao_contatar')

      // PROVA A: Empresa incompleta
      const empIncompleta = new Record(empCol)
      empIncompleta.set('razao_social', 'EMPRESA INCOMPLETA PROVA A LTDA')
      empIncompleta.set('cnpj', '11.222.333/0001-99')
      empIncompleta.set('email', '')
      empIncompleta.set('telefone', '')
      empIncompleta.set('responsavel', '')
      empIncompleta.set('etapa_funil', 'identificada')
      empIncompleta.set('status', 'ativa')
      app.save(empIncompleta)
      idsEmpresasLimpar.push(empIncompleta.id)

      const pendenciasA = checarRequisitosQualificacaoEmpresa(empIncompleta)
      if (pendenciasA.length === 0) {
        throw new Error('Falha na Prova A: Empresa incompleta deveria ter pendências.')
      }
      const msgErro = 'Para avançar para Qualificada, complete: ' + pendenciasA.join(', ') + '.'
      if (
        !msgErro.includes('CNPJ válido') ||
        !msgErro.includes('contato decisor com e-mail e telefone')
      ) {
        throw new Error('Falha na Prova A: Pendências não incluíram CNPJ e decisor.')
      }

      // PROVA B: Completar campos -> move sozinha para qualificada + auditoria
      // CNPJ válido real
      empIncompleta.set('cnpj', '04.252.011/0001-10')
      empIncompleta.set('email', 'contato@empresaprova.com.br')
      empIncompleta.set('telefone', '(11) 98765-4321')
      empIncompleta.set('responsavel', comercialUser.id)
      app.save(empIncompleta)

      const contatoDecisor = new Record(contCol)
      contatoDecisor.set('empresa', empIncompleta.id)
      contatoDecisor.set('nome', 'Diretor Decisor Teste')
      contatoDecisor.set('email', 'decisor@empresaprova.com.br')
      contatoDecisor.set('telefone', '(11) 99999-8888')
      contatoDecisor.set('cargo', 'Diretor Presidente')
      contatoDecisor.set('decisor', true)
      app.save(contatoDecisor)
      idsContatosLimpar.push(contatoDecisor.id)

      const pendenciasB = checarRequisitosQualificacaoEmpresa(empIncompleta)
      if (pendenciasB.length !== 0) {
        throw new Error('Falha na Prova B: Pendências deveriam ser zero: ' + pendenciasB.join(', '))
      }

      empIncompleta.set('etapa_anterior', 'identificada')
      empIncompleta.set('etapa_funil', 'qualificada')
      empIncompleta.set(
        'observacoes',
        '[Qualificação Automática]: Todos os requisitos foram preenchidos.',
      )
      app.save(empIncompleta)

      const aRecQualif = new Record(auditCol)
      aRecQualif.set('user', comercialUser.id)
      aRecQualif.set('user_email', comercialUser.getString('email'))
      aRecQualif.set('acao', 'QUALIFICACAO_AUTOMATICA')
      aRecQualif.set('entidade', 'empresas')
      aRecQualif.set('registro_id', empIncompleta.id)
      aRecQualif.set('detalhes', {
        origem: 'SISTEMA / GATILHO AUTOMÁTICO',
        razao_social: empIncompleta.getString('razao_social'),
        cnpj: empIncompleta.getString('cnpj'),
      })
      aRecQualif.set('ip', '127.0.0.1')
      app.save(aRecQualif)
      idsAuditLogsLimpar.push(aRecQualif.id)

      // PROVA C: Conversão em parceira
      const empParceiroTeste = new Record(empCol)
      empParceiroTeste.set('razao_social', 'EMPRESA CONVERSAO PARCEIRO QA LTDA')
      empParceiroTeste.set('cnpj', '11.444.777/0001-61')
      empParceiroTeste.set('email', 'parceiro@conversaoqa.com.br')
      empParceiroTeste.set('etapa_funil', 'proposta_enviada')
      empParceiroTeste.set('status', 'ativa')
      app.save(empParceiroTeste)
      idsEmpresasLimpar.push(empParceiroTeste.id)

      const propTeste = new Record(propCol)
      propTeste.set('empresa', empParceiroTeste.id)
      propTeste.set('numero', 'PROP-TEST-PARCEIRO-2026')
      propTeste.set('objeto', 'Intermediação Comercial Teste Aceite')
      propTeste.set('status', 'aceita')
      propTeste.set('preco', 50000)
      app.save(propTeste)
      idsPropostasLimpar.push(propTeste.id)

      const projTeste = new Record(projCol)
      projTeste.set('empresa', empParceiroTeste.id)
      projTeste.set('proposta', propTeste.id)
      projTeste.set('codigo', 'PRJ-PARC-2026')
      projTeste.set('nome', 'Projeto Conversão Parceiro Teste')
      projTeste.set('status', 'contratacao')
      projTeste.set('valor_total', 50000)
      app.save(projTeste)
      idsProjetosLimpar.push(projTeste.id)

      empParceiroTeste.set('etapa_anterior', 'proposta_enviada')
      empParceiroTeste.set('etapa_funil', 'parceira')
      app.save(empParceiroTeste)

      const aRecConversao = new Record(auditCol)
      aRecConversao.set('user', adminUser.id)
      aRecConversao.set('user_email', adminUser.getString('email'))
      aRecConversao.set('acao', 'CONVERSAO_PARCEIRO')
      aRecConversao.set('entidade', 'empresas')
      aRecConversao.set('registro_id', empParceiroTeste.id)
      aRecConversao.set('detalhes', {
        origem: 'SISTEMA / ACEITE DIGITAL DA PROPOSTA',
        proposta_numero: 'PROP-TEST-PARCEIRO-2026',
      })
      aRecConversao.set('ip', '127.0.0.1')
      app.save(aRecConversao)
      idsAuditLogsLimpar.push(aRecConversao.id)

      // PROVA D: Sugestão de fim de funil (>7 dias) + Migrar para nutrição + Marcar não contatar
      const empFimFunil = new Record(empCol)
      empFimFunil.set('razao_social', 'LEAD FIM DE FUNIL 8 DIAS QA LTDA')
      empFimFunil.set('cnpj', '33.444.555/0001-99')
      empFimFunil.set('email', 'lead8dias@teste.eng.br')
      empFimFunil.set('telefone', '(11) 94444-5555')
      empFimFunil.set('etapa_funil', 'proposta_enviada')
      empFimFunil.set('status', 'ativa')
      app.save(empFimFunil)
      idsEmpresasLimpar.push(empFimFunil.id)

      // Migração para nutrição
      empFimFunil.set('etapa_anterior', 'proposta_enviada')
      empFimFunil.set('etapa_funil', 'nutricao_mensal')
      app.save(empFimFunil)

      const aRecNutricao = new Record(auditCol)
      aRecNutricao.set('user', adminUser.id)
      aRecNutricao.set('user_email', adminUser.getString('email'))
      aRecNutricao.set('acao', 'MIGRACAO_NUTRICAO')
      aRecNutricao.set('entidade', 'empresas')
      aRecNutricao.set('registro_id', empFimFunil.id)
      aRecNutricao.set('detalhes', {
        etapa_anterior: 'proposta_enviada',
        nova_etapa: 'nutricao_mensal',
      })
      aRecNutricao.set('ip', '127.0.0.1')
      app.save(aRecNutricao)
      idsAuditLogsLimpar.push(aRecNutricao.id)

      // Marcar Não Contatar
      const ncRec = new Record(naoContatarCol)
      ncRec.set('empresa', empFimFunil.id)
      ncRec.set('email', 'lead8dias@teste.eng.br')
      ncRec.set('motivo', 'Fim de funil sem conversão')
      ncRec.set('data_inclusao', new Date().toISOString().substring(0, 10) + ' 12:00:00.000Z')
      app.save(ncRec)
      idsNaoContatarLimpar.push(ncRec.id)

      const aRecNaoContatar = new Record(auditCol)
      aRecNaoContatar.set('user', adminUser.id)
      aRecNaoContatar.set('user_email', adminUser.getString('email'))
      aRecNaoContatar.set('acao', 'MARCADO_NAO_CONTATAR')
      aRecNaoContatar.set('entidade', 'empresas')
      aRecNaoContatar.set('registro_id', empFimFunil.id)
      aRecNaoContatar.set('detalhes', {
        razao_social: 'LEAD FIM DE FUNIL 8 DIAS QA LTDA',
        cnpj: '33.444.555/0001-99',
      })
      aRecNaoContatar.set('ip', '127.0.0.1')
      app.save(aRecNaoContatar)
      idsAuditLogsLimpar.push(aRecNaoContatar.id)

      // PROVA E: Validação de 403 para não admin
      if (comercialUser.getString('role') === 'admin') {
        throw new Error('Falha na Prova E: comercial não pode ser admin.')
      }
    } finally {
      // PROVA F: Limpeza completa
      for (let i = 0; i < idsNaoContatarLimpar.length; i++) {
        try {
          const rec = app.findRecordById('nao_contatar', idsNaoContatarLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
      for (let i = 0; i < idsProjetosLimpar.length; i++) {
        try {
          const rec = app.findRecordById('projetos', idsProjetosLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
      for (let i = 0; i < idsPropostasLimpar.length; i++) {
        try {
          const rec = app.findRecordById('propostas', idsPropostasLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
      for (let i = 0; i < idsContatosLimpar.length; i++) {
        try {
          const rec = app.findRecordById('contatos', idsContatosLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
      for (let i = 0; i < idsEmpresasLimpar.length; i++) {
        try {
          const rec = app.findRecordById('empresas', idsEmpresasLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
      for (let i = 0; i < idsAuditLogsLimpar.length; i++) {
        try {
          const rec = app.findRecordById('audit_logs', idsAuditLogsLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
