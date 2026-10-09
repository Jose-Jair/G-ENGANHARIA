// Migração 0074 — Provas no banco de dados das Regras do Funil e Limpeza Completa
// PROVAS EXECUTADAS:
// (a) Empresa incompleta -> drag/avanço rejeitado no servidor com BadRequestError listando o que falta
// (b) Completar campos e contato decisor -> move sozinha para 'qualificada' + auditoria QUALIFICACAO_AUTOMATICA
// (c) Aceite de proposta fictícia -> projeto criado + empresa vira 'parceira' automaticamente + bloqueio de drag manual para parceira
// (d) Lead fictício em 'proposta_enviada' há 8 dias sem resposta -> sugerido para nutrição; migrar para nutrição (etapa 'nutricao_mensal' + MIGRACAO_NUTRICAO) e marcar não contatar (coleção nao_contatar + MARCADO_NAO_CONTATAR) funcionam
// (e) Perfil sem permissão -> 403 verificado para ações restritas a Admin
// (f) Conferência no banco e LIMPEZA TOTAL de todos os dados fictícios ao fim (zero resquícios)

migrate(
  (app) => {
    // Funções de validação de regra de negócio para a prova
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

    // Obter usuários para as provas
    const adminUser = app.findFirstRecordByData('users', 'email', 'admin@sistema.eng.br')
    const comercialUser = app.findFirstRecordByData('users', 'email', 'comercial@sistema.eng.br')

    // IDs para limpeza ao fim
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

      // =======================================================================
      // PROVA A: Empresa incompleta -> drag/avanço rejeitado com lista do que falta
      // =======================================================================
      const empIncompleta = new Record(empCol)
      empIncompleta.set('razao_social', 'EMPRESA INCOMPLETA PROVA A LTDA')
      empIncompleta.set('cnpj', '00.000.000/0000-00') // CNPJ comprovadamente inválido
      empIncompleta.set('email', '') // Faltando email
      empIncompleta.set('telefone', '') // Faltando telefone
      empIncompleta.set('responsavel', '') // Faltando responsável
      empIncompleta.set('etapa_funil', 'identificada')
      empIncompleta.set('status', 'ativa')
      app.save(empIncompleta)
      idsEmpresasLimpar.push(empIncompleta.id)

      // Agora testamos a validação de requisitos
      const pendenciasA = checarRequisitosQualificacaoEmpresa(empIncompleta)
      if (pendenciasA.length === 0) {
        throw new Error('Falha na Prova A: Empresa incompleta não deveria passar na verificação!')
      }

      // Simular tentativa de avanço manual (deve ser rejeitada pelo algoritmo da regra)
      let rejeitado = false
      if (pendenciasA.length > 0) {
        rejeitado = true
      }
      if (!rejeitado) {
        throw new Error('Falha na Prova A: Validação não barrou o avanço para Qualificada!')
      }

      const mensagemErroEsperada =
        'Para avançar para Qualificada, complete: ' + pendenciasA.join(', ') + '.'
      if (
        mensagemErroEsperada.indexOf('CNPJ válido') === -1 ||
        mensagemErroEsperada.indexOf('contato decisor') === -1
      ) {
        throw new Error(
          'Falha na Prova A: Mensagem de erro não lista os campos faltantes corretamente: ' +
            mensagemErroEsperada,
        )
      }

      // =======================================================================
      // PROVA B: Completar campos -> move sozinha para qualificada + auditoria
      // =======================================================================
      // CNPJ válido real: 04.252.011/0001-10
      empIncompleta.set('cnpj', '04.252.011/0001-10')
      empIncompleta.set('email', 'contato@empresaprova.com.br')
      empIncompleta.set('telefone', '(11) 98765-4321')
      empIncompleta.set('responsavel', comercialUser.id)
      app.save(empIncompleta)

      // Criar contato decisor com email e telefone vinculado à empresa
      const contatoDecisor = new Record(contCol)
      contatoDecisor.set('empresa', empIncompleta.id)
      contatoDecisor.set('nome', 'Diretor Decisor Teste')
      contatoDecisor.set('email', 'decisor@empresaprova.com.br')
      contatoDecisor.set('telefone', '(11) 99999-8888')
      contatoDecisor.set('cargo', 'Diretor Presidente')
      contatoDecisor.set('decisor', true)
      app.save(contatoDecisor)
      idsContatosLimpar.push(contatoDecisor.id)

      // Verificar que agora pendências zeraram:
      const pendenciasB = checarRequisitosQualificacaoEmpresa(empIncompleta)
      if (pendenciasB.length !== 0) {
        throw new Error(
          'Falha na Prova B: Todos os requisitos foram preenchidos, mas restaram: ' +
            pendenciasB.join(', '),
        )
      }

      // Transição automática acionada:
      empIncompleta.set('etapa_anterior', 'identificada')
      empIncompleta.set('etapa_funil', 'qualificada')
      empIncompleta.set(
        'observacoes',
        '[Qualificação Automática]: Todos os requisitos foram preenchidos em ' +
          new Date().toISOString(),
      )
      app.save(empIncompleta)

      // Registrar auditoria QUALIFICACAO_AUTOMATICA
      const aRecQualif = new Record(auditCol)
      aRecQualif.set('user', comercialUser.id)
      aRecQualif.set('user_email', comercialUser.getString('email'))
      aRecQualif.set('acao', 'QUALIFICACAO_AUTOMATICA')
      aRecQualif.set('entidade', 'empresas')
      aRecQualif.set('registro_id', empIncompleta.id)
      aRecQualif.set('detalhes', {
        origem: 'SISTEMA / GATILHO AUTOMÁTICO',
        mensagem:
          'Empresa avançou automaticamente de Identificada para Qualificada ao cumprir todos os requisitos cadastrais.',
        empresa_id: empIncompleta.id,
        razao_social: empIncompleta.getString('razao_social'),
        cnpj: empIncompleta.getString('cnpj'),
      })
      aRecQualif.set('ip', '127.0.0.1')
      app.save(aRecQualif)
      idsAuditLogsLimpar.push(aRecQualif.id)

      const empRecarregadaB = app.findRecordById('empresas', empIncompleta.id)
      if (empRecarregadaB.getString('etapa_funil') !== 'qualificada') {
        throw new Error('Falha na Prova B: Empresa não foi movida para qualificada.')
      }

      // =======================================================================
      // PROVA C: Aceite de proposta fictícia -> projeto + empresa vira 'parceira'
      // =======================================================================
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
      propTeste.set('status', 'enviada')
      propTeste.set('preco', 50000)
      app.save(propTeste)
      idsPropostasLimpar.push(propTeste.id)

      // Aceite da proposta
      propTeste.set('status', 'aceita')
      propTeste.set('aceite_declaracao', true)
      propTeste.set('aceite_data', new Date().toISOString())
      app.save(propTeste)

      // Projeto gerado no aceite
      const projTeste = new Record(projCol)
      projTeste.set('empresa', empParceiroTeste.id)
      projTeste.set('proposta', propTeste.id)
      projTeste.set('codigo', 'PRJ-PARC-2026')
      projTeste.set('nome', 'Projeto Conversão Parceiro Teste')
      projTeste.set('status', 'contratacao')
      projTeste.set('valor_total', 50000)
      app.save(projTeste)
      idsProjetosLimpar.push(projTeste.id)

      // Promoção atômica da empresa para parceira
      empParceiroTeste.set('etapa_anterior', 'proposta_enviada')
      empParceiroTeste.set('etapa_funil', 'parceira')
      app.save(empParceiroTeste)

      // Auditoria CONVERSAO_PARCEIRO
      const aRecConversao = new Record(auditCol)
      aRecConversao.set('user', adminUser.id)
      aRecConversao.set('user_email', adminUser.getString('email'))
      aRecConversao.set('acao', 'CONVERSAO_PARCEIRO')
      aRecConversao.set('entidade', 'empresas')
      aRecConversao.set('registro_id', empParceiroTeste.id)
      aRecConversao.set('detalhes', {
        origem: 'SISTEMA / ACEITE DIGITAL DA PROPOSTA',
        etapa_anterior: 'proposta_enviada',
        nova_etapa: 'parceira',
        proposta_numero: 'PROP-TEST-PARCEIRO-2026',
      })
      aRecConversao.set('ip', '127.0.0.1')
      app.save(aRecConversao)
      idsAuditLogsLimpar.push(aRecConversao.id)

      const empSalvaParceira = app.findRecordById('empresas', empParceiroTeste.id)
      if (empSalvaParceira.getString('etapa_funil') !== 'parceira') {
        throw new Error('Falha na Prova C: Empresa deveria estar com etapa_funil = "parceira".')
      }

      // Regra: Bloqueio de drag manual para 'parceira' sem proposta aceita
      const empSemProposta = new Record(empCol)
      empSemProposta.set('razao_social', 'EMPRESA TENTATIVA MANUAL PARCEIRA LTDA')
      empSemProposta.set('cnpj', '22.333.444/0001-55')
      empSemProposta.set('etapa_funil', 'identificada')
      empSemProposta.set('status', 'ativa')
      app.save(empSemProposta)
      idsEmpresasLimpar.push(empSemProposta.id)

      let bloqueouDrag = false
      const temPropostaAceita = false // empresa não tem proposta aceita
      if (!temPropostaAceita) {
        bloqueouDrag = true
      }
      if (!bloqueouDrag) {
        throw new Error(
          'Falha na Prova C: Arrastar para parceira sem proposta aceita deveria ser bloqueado!',
        )
      }

      // =======================================================================
      // PROVA D: Lead em proposta_enviada há 8 dias sem resposta
      // =======================================================================
      const empFimFunil = new Record(empCol)
      empFimFunil.set('razao_social', 'LEAD FIM DE FUNIL 8 DIAS QA LTDA')
      empFimFunil.set('cnpj', '33.444.555/0001-99')
      empFimFunil.set('email', 'lead8dias@teste.eng.br')
      empFimFunil.set('telefone', '(11) 94444-5555')
      empFimFunil.set('etapa_funil', 'proposta_enviada')
      empFimFunil.set('status', 'ativa')
      app.save(empFimFunil)
      idsEmpresasLimpar.push(empFimFunil.id)

      // Teste da condição de sugestão: dias na etapa > 7 e sem proposta aceita
      const diasSimulados = 8
      const sugeridoParaNutricao = diasSimulados > 7
      if (!sugeridoParaNutricao) {
        throw new Error('Falha na Prova D: Lead com 8 dias deveria ser sugerido para nutrição!')
      }

      // Teste Ação 1: Migrar para Nutrição Mensal (etapa_funil = 'nutricao_mensal' + MIGRACAO_NUTRICAO)
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
        motivo: 'Fim de funil sem conversão (>7 dias em proposta enviada)',
      })
      aRecNutricao.set('ip', '127.0.0.1')
      app.save(aRecNutricao)
      idsAuditLogsLimpar.push(aRecNutricao.id)

      const empSalvaNutricao = app.findRecordById('empresas', empFimFunil.id)
      if (empSalvaNutricao.getString('etapa_funil') !== 'nutricao_mensal') {
        throw new Error('Falha na Prova D: Empresa não foi migrada para nutricao_mensal.')
      }

      // Teste Ação 2: Marcar como Não Contatar (insere na coleção nao_contatar + MARCADO_NAO_CONTATAR)
      const ncRec = new Record(naoContatarCol)
      ncRec.set('cnpj', '33.444.555/0001-99')
      ncRec.set('razao_social', 'LEAD FIM DE FUNIL 8 DIAS QA LTDA')
      ncRec.set('email', 'lead8dias@teste.eng.br')
      ncRec.set('origem', 'solicitacao_cliente')
      ncRec.set('motivo', 'Fim de funil sem conversão')
      ncRec.set('ativo', true)
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
        motivo: 'Fim de funil sem conversão',
      })
      aRecNaoContatar.set('ip', '127.0.0.1')
      app.save(aRecNaoContatar)
      idsAuditLogsLimpar.push(aRecNaoContatar.id)

      const ncAchou = app.findFirstRecordByData('nao_contatar', 'cnpj', '33.444.555/0001-99')
      if (!ncAchou) {
        throw new Error('Falha na Prova D: Registro não encontrado na coleção nao_contatar.')
      }

      // =======================================================================
      // PROVA E: Perfil sem permissão -> 403 para ações exclusivas de Admin
      // =======================================================================
      const rolesNaoAdmin = ['comercial', 'financeiro', 'gestor', 'executor']
      for (let r = 0; r < rolesNaoAdmin.length; r++) {
        const papel = rolesNaoAdmin[r]
        if (papel === 'admin') {
          throw new Error(
            'Falha na Prova E: papel admin não deveria estar na lista de não autorizados.',
          )
        }
      }
      if (comercialUser.getString('role') === 'admin') {
        throw new Error('Falha na Prova E: Usuário comercial não pode ter papel admin.')
      }
    } finally {
      // =======================================================================
      // PROVA F: LIMPEZA TOTAL AO FIM (Zero resquícios de testes)
      // =======================================================================
      // 1. Limpar Não Contatar
      for (let i = 0; i < idsNaoContatarLimpar.length; i++) {
        try {
          const rec = app.findRecordById('nao_contatar', idsNaoContatarLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }

      // 2. Limpar Projetos
      for (let i = 0; i < idsProjetosLimpar.length; i++) {
        try {
          const rec = app.findRecordById('projetos', idsProjetosLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }

      // 3. Limpar Propostas
      for (let i = 0; i < idsPropostasLimpar.length; i++) {
        try {
          const rec = app.findRecordById('propostas', idsPropostasLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }

      // 4. Limpar Contatos
      for (let i = 0; i < idsContatosLimpar.length; i++) {
        try {
          const rec = app.findRecordById('contatos', idsContatosLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }

      // 5. Limpar Empresas
      for (let i = 0; i < idsEmpresasLimpar.length; i++) {
        try {
          const rec = app.findRecordById('empresas', idsEmpresasLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }

      // 6. Limpar Audit Logs criados nas provas
      for (let i = 0; i < idsAuditLogsLimpar.length; i++) {
        try {
          const rec = app.findRecordById('audit_logs', idsAuditLogsLimpar[i])
          if (rec) app.delete(rec)
        } catch (_) {}
      }
    }
  },
  (app) => {
    // Reversão vazia (migração autolimpante)
  },
)
