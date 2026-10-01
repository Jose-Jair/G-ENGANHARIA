migrate(
  (app) => {
    // 1. Atualizar regras de acesso para empresas
    // Admin + Comercial: leem e gravam
    // Financeiro + Gestor: apenas leem
    // Executor: sem acesso
    try {
      const empresas = app.findCollectionByNameOrId('empresas')
      empresas.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      empresas.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      empresas.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      empresas.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      empresas.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(empresas)
    } catch (e) {
      console.log('Erro ao atualizar regras da colecao empresas: ' + e)
    }

    // 2. Atualizar regras de acesso para contatos
    // Admin + Comercial: leem e gravam
    // Financeiro + Gestor: apenas leem
    // Executor: sem acesso
    try {
      const contatos = app.findCollectionByNameOrId('contatos')
      contatos.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      contatos.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      contatos.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      contatos.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      contatos.deleteRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      app.save(contatos)
    } catch (e) {
      console.log('Erro ao atualizar regras da colecao contatos: ' + e)
    }

    // 3. Atualizar regras de acesso para contratos
    // Admin + Comercial: leem e gravam
    // Financeiro + Gestor: apenas leem
    // Executor: sem acesso
    try {
      const contratos = app.findCollectionByNameOrId('contratos')
      contratos.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      contratos.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial' || @request.auth.role = 'financeiro' || @request.auth.role = 'gestor')"
      contratos.createRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      contratos.updateRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      contratos.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
      app.save(contratos)
    } catch (e) {
      console.log('Erro ao atualizar regras da colecao contratos: ' + e)
    }

    // 4. Atualizar regras de audit_logs para permitir visualização da linha do tempo por Admin e Comercial
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      auditLogs.listRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      auditLogs.viewRule =
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'comercial')"
      app.save(auditLogs)
    } catch (e) {
      console.log('Erro ao atualizar regras de audit_logs: ' + e)
    }

    // 5. Parâmetro dias_alerta_fim_contrato (padrão: 90)
    try {
      const paramCol = app.findCollectionByNameOrId('parametros')
      try {
        app.findFirstRecordByData('parametros', 'chave', 'dias_alerta_fim_contrato')
      } catch (_) {
        const paramRec = new Record(paramCol)
        paramRec.set('chave', 'dias_alerta_fim_contrato')
        paramRec.set('valor', '90')
        paramRec.set(
          'descricao',
          'Dias de antecedência para alertar contratos próximos do fim de vigência',
        )
        app.save(paramRec)
      }
    } catch (e) {
      console.log('Erro ao salvar parametro dias_alerta_fim_contrato: ' + e)
    }

    // 6. Criar empresas fictícias de engenharia com contratos e contatos
    try {
      const empresasCol = app.findCollectionByNameOrId('empresas')
      const contratosCol = app.findCollectionByNameOrId('contratos')
      const contatosCol = app.findCollectionByNameOrId('contatos')

      // Buscar id do usuário comercial ou admin para vincular como responsável
      let respId = null
      try {
        const comUser = app.findAuthRecordByEmail('_pb_users_auth_', 'comercial@sistema.eng.br')
        respId = comUser.id
      } catch (_) {
        try {
          const admUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@sistema.eng.br')
          respId = admUser.id
        } catch (_) {}
      }

      const sampleEmpresas = [
        {
          razao_social: 'Construtora & Pavimentadora Rio Doce Ltda',
          nome_fantasia: 'Rio Doce Engenharia',
          cnpj: '14.285.340/0001-80',
          situacao_cadastral: 'ATIVA',
          cnae: '42.11-1-01 - Construção de rodovias e ferrovias',
          porte: 'DEMAIS',
          uf: 'MG',
          municipio: 'Governador Valadares',
          email: 'contato@riodoceeng.com.br',
          telefone: '(33) 3271-8800',
          instagram: 'https://instagram.com/riodoceeng',
          linkedin: 'https://linkedin.com/company/rio-doce-engenharia',
          site: 'https://riodoceeng.com.br',
          etapa_funil: 'identificada',
          curva: 'A',
          score: 85,
          status: 'ativa',
          observacoes:
            'Vencedora de licitações viárias na bacia do Rio Doce. Alto potencial de apoio em projetos complementares e topografia.',
          contratos: [
            {
              orgao: 'Prefeitura Municipal de Governador Valadares',
              numero: 'CT-2024/048',
              objeto: 'Obras de drenagem pluvial e pavimentação asfáltica no corredor viário sul',
              modalidade: 'Concorrência Pública',
              valor: 6450000,
              saldo: 4200000,
              vigencia_inicio: '2024-03-10 00:00:00.000Z',
              vigencia_fim: '2026-12-31 00:00:00.000Z',
              situacao: 'Em Execução',
              link_edital: 'https://valadares.mg.gov.br/licitacoes/2024/cp048',
              fonte: 'Portal Nacional de Contratações Públicas (PNCP)',
            },
            {
              orgao: 'Secretaria de Infraestrutura de Minas Gerais (SEINFRA-MG)',
              numero: 'SEI-MG/1192-23',
              objeto: 'Contenção de encostas e recuperação estrutural de pontilhões na MG-259',
              modalidade: 'Concorrência',
              valor: 3100000,
              saldo: 850000,
              vigencia_inicio: '2023-08-01 00:00:00.000Z',
              vigencia_fim: '2026-11-15 00:00:00.000Z', // dentro de janela próxima do fim (~45 dias em relação a out/2026)
              situacao: 'Em Execução',
              link_edital: 'https://transparencia.mg.gov.br/licitacoes',
              fonte: 'DOE-MG',
            },
          ],
          contatos: [
            {
              nome: 'Eng. Marcelo Antunes',
              cargo: 'Diretor de Operações e Contratos',
              email: 'marcelo.antunes@riodoceeng.com.br',
              telefone: '(33) 99124-5544',
              whatsapp: '5533991245544',
              decisor: true,
              verificado: true,
            },
            {
              nome: 'Camila Fernandes',
              cargo: 'Gerente de Suprimentos & Terceirização',
              email: 'camila.fernandes@riodoceeng.com.br',
              telefone: '(33) 98831-2299',
              whatsapp: '5533988312299',
              decisor: false,
              verificado: true,
            },
          ],
        },
        {
          razao_social: 'Saneamento & Infraestrutura Paulista S.A.',
          nome_fantasia: 'SaniPaulista',
          cnpj: '28.761.429/0001-92',
          situacao_cadastral: 'ATIVA',
          cnae: '42.22-7-01 - Construção de redes de abastecimento de água, coleta de esgoto',
          porte: 'GRANDE',
          uf: 'SP',
          municipio: 'Ribeirão Preto',
          email: 'licitacoes@sanipaulista.com.br',
          telefone: '(16) 3605-4100',
          instagram: '',
          linkedin: 'https://linkedin.com/company/sanipaulista-infra',
          site: 'https://sanipaulista.com.br',
          etapa_funil: 'parceira',
          curva: 'B',
          score: 92,
          status: 'ativa',
          observacoes:
            'Parceira homologada desde 2025. Terceiriza integralmente o cálculo estrutural de elevatórias e laudos geológicos.',
          contratos: [
            {
              orgao: 'DAEE - Departamento de Águas e Energia Elétrica SP',
              numero: 'DAEE-2025-014',
              objeto: 'Implantação de interceptores de esgoto e estação elevatória no Rio Pardo',
              modalidade: 'RDC',
              valor: 2890000,
              saldo: 1950000,
              vigencia_inicio: '2025-01-15 00:00:00.000Z',
              vigencia_fim: '2027-06-30 00:00:00.000Z',
              situacao: 'Em Execução',
              link_edital: 'https://daee.sp.gov.br/editais',
              fonte: 'Diário Oficial de SP',
            },
          ],
          contatos: [
            {
              nome: 'Dr. Roberto Silveira',
              cargo: 'Superintendente de Engenharia',
              email: 'roberto.silveira@sanipaulista.com.br',
              telefone: '(16) 99781-3320',
              whatsapp: '5516997813320',
              decisor: true,
              verificado: true,
            },
          ],
        },
        {
          razao_social: 'Consórcio Nordeste Edificações Públicas SPE',
          nome_fantasia: 'CNEP Projetos',
          cnpj: '07.342.190/0001-44',
          situacao_cadastral: 'ATIVA',
          cnae: '41.20-4-00 - Construção de edifícios',
          porte: 'MEDIO',
          uf: 'CE',
          municipio: 'Fortaleza',
          email: 'diretoria@cnepobras.com.br',
          telefone: '(85) 3450-2000',
          instagram: 'https://instagram.com/cnep_obras',
          linkedin: '',
          site: 'https://cnepobras.com.br',
          etapa_funil: 'qualificada',
          curva: 'C',
          score: 70,
          status: 'ativa',
          observacoes:
            'Contrato de reforma de escolas estaduais. Necessita apoio em projetos de combate a incêndio (PPCI) e SPDA.',
          contratos: [
            {
              orgao: 'Secretaria da Educação do Ceará (SEDUC-CE)',
              numero: 'SEDUC-CONV-2024-88',
              objeto: 'Reforma e modernização de 8 escolas técnicas integradas',
              modalidade: 'Pregão Eletrônico',
              valor: 820000,
              saldo: 540000,
              vigencia_inicio: '2024-05-02 00:00:00.000Z',
              vigencia_fim: '2026-11-20 00:00:00.000Z', // dentro de janela próxima do fim (~50 dias)
              situacao: 'Em Execução',
              link_edital: 'https://seduc.ce.gov.br/licitacoes',
              fonte: 'Portal Compras CE',
            },
          ],
          contatos: [
            {
              nome: 'Mariana Vasconcelos',
              cargo: 'Coordenadora de Projetos Complementares',
              email: 'mariana.vasconcelos@cnepobras.com.br',
              telefone: '(85) 98112-9080',
              whatsapp: '5585981129080',
              decisor: true,
              verificado: true,
            },
          ],
        },
      ]

      for (const e of sampleEmpresas) {
        let empRec
        try {
          empRec = app.findFirstRecordByData('empresas', 'cnpj', e.cnpj)
        } catch (_) {
          empRec = new Record(empresasCol)
        }
        empRec.set('razao_social', e.razao_social)
        empRec.set('nome_fantasia', e.nome_fantasia)
        empRec.set('cnpj', e.cnpj)
        empRec.set('situacao_cadastral', e.situacao_cadastral)
        empRec.set('cnae', e.cnae)
        empRec.set('porte', e.porte)
        empRec.set('uf', e.uf)
        empRec.set('municipio', e.municipio)
        empRec.set('email', e.email)
        empRec.set('telefone', e.telefone)
        empRec.set('instagram', e.instagram)
        empRec.set('linkedin', e.linkedin)
        empRec.set('site', e.site)
        empRec.set('etapa_funil', e.etapa_funil)
        empRec.set('curva', e.curva)
        empRec.set('score', e.score)
        if (respId) empRec.set('responsavel', respId)
        empRec.set('status', e.status)
        empRec.set('observacoes', e.observacoes)
        app.save(empRec)

        // Salvar contratos
        for (const c of e.contratos) {
          let contRec
          try {
            contRec = app.findFirstRecordByData('contratos', 'numero', c.numero)
          } catch (_) {
            contRec = new Record(contratosCol)
          }
          contRec.set('empresa', empRec.id)
          contRec.set('orgao', c.orgao)
          contRec.set('numero', c.numero)
          contRec.set('objeto', c.objeto)
          contRec.set('modalidade', c.modalidade)
          contRec.set('valor', c.valor)
          contRec.set('saldo', c.saldo)
          contRec.set('vigencia_inicio', c.vigencia_inicio)
          contRec.set('vigencia_fim', c.vigencia_fim)
          contRec.set('situacao', c.situacao)
          contRec.set('link_edital', c.link_edital)
          contRec.set('fonte', c.fonte)
          app.save(contRec)
        }

        // Salvar contatos
        for (const ct of e.contatos) {
          let ctoRec
          try {
            ctoRec = app.findFirstRecordByData('contatos', 'email', ct.email)
          } catch (_) {
            ctoRec = new Record(contatosCol)
          }
          ctoRec.set('empresa', empRec.id)
          ctoRec.set('nome', ct.nome)
          ctoRec.set('cargo', ct.cargo)
          ctoRec.set('email', ct.email)
          ctoRec.set('telefone', ct.telefone)
          ctoRec.set('whatsapp', ct.whatsapp)
          ctoRec.set('decisor', ct.decisor)
          ctoRec.set('verificado', ct.verificado)
          app.save(ctoRec)
        }
      }
    } catch (e) {
      console.log('Erro ao semear empresas ficticias: ' + e)
    }
  },
  (app) => {
    // Reverter seed se necessario
  },
)
