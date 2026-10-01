migrate(
  (app) => {
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const contatosCol = app.findCollectionByNameOrId('contatos')
    const sugestoesCol = app.findCollectionByNameOrId('sugestoes_funil')
    const reativacoesCol = app.findCollectionByNameOrId('reativacoes_sugeridas')
    const naoContatarCol = app.findCollectionByNameOrId('nao_contatar')

    let adminUser = null
    let comercialUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@sistema.eng.br')
    } catch (_) {}
    try {
      comercialUser = app.findAuthRecordByEmail('_pb_users_auth_', 'comercial@sistema.eng.br')
    } catch (_) {}

    const respId = comercialUser ? comercialUser.id : adminUser ? adminUser.id : null

    // Lista abrangente de empresas fictícias para popular todas as 9 colunas do Funil
    // Colunas:
    // 1. identificada
    // 2. qualificada
    // 3. em_cadencia
    // 4. em_conversa
    // 5. com_proposta_elaborada
    // 6. proposta_enviada
    // 7. parceira
    // 8. nutricao_mensal
    // 9. inativa
    const empresasFicticias = [
      // 1. Identificada (já existia Rio Doce, adicionamos mais uma)
      {
        razao_social: 'GeoTop Topografia & Sondagens Especiais Ltda',
        nome_fantasia: 'GeoTop Geotecnia',
        cnpj: '31.458.902/0001-15',
        situacao_cadastral: 'ATIVA',
        cnae: '71.12-0-00 - Serviços de engenharia',
        porte: 'MEDIO',
        uf: 'MG',
        municipio: 'Belo Horizonte',
        email: 'comercial@geotopbrasil.com.br',
        telefone: '(31) 3349-1100',
        site: 'https://geotopbrasil.com.br',
        etapa_funil: 'identificada',
        curva: 'C',
        score: 65,
        status: 'ativa',
        proxima_acao_data: '2026-10-05 10:00:00.000Z',
        proxima_acao_desc: 'Mapear sócios decisores e contratos vigentes no DER-MG',
        observacoes: 'Detectada via diário oficial do Estado de Minas Gerais.',
        contratos: [
          {
            orgao: 'Departamento de Edificações e Estradas de Rodagem de Minas Gerais (DER-MG)',
            numero: 'DER-2024-912',
            objeto:
              'Levantamento planialtimétrico cadastral e batimetria de pontes na bacia do Paraopeba',
            modalidade: 'Pregão Eletrônico',
            valor: 620000,
            saldo: 410000,
            vigencia_inicio: '2024-04-10 00:00:00.000Z',
            vigencia_fim: '2026-12-15 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Eng. Renato Alencar',
            cargo: 'Gerente Técnico de Campo',
            email: 'renato@geotopbrasil.com.br',
            telefone: '(31) 99881-2020',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 3. Em cadência
      {
        razao_social: 'HidroVias Obras Portuárias & Dragagem S.A.',
        nome_fantasia: 'HidroVias Engenharia Fluvial',
        cnpj: '18.902.411/0001-77',
        situacao_cadastral: 'ATIVA',
        cnae: '42.91-0-00 - Obras portuárias, marítimas e fluviais',
        porte: 'GRANDE',
        uf: 'PA',
        municipio: 'Belém',
        email: 'licitacoes@hidroviaseng.com.br',
        telefone: '(91) 3211-9988',
        site: 'https://hidroviaseng.com.br',
        etapa_funil: 'em_cadencia',
        curva: 'A',
        score: 88,
        status: 'ativa',
        proxima_acao_data: '2026-10-03 14:30:00.000Z',
        proxima_acao_desc: 'Toque 3: Apresentar cases de modelagem hidrológica e licenciamento',
        observacoes: 'Grande player regional em obras de atracação e terminais fluviais.',
        contratos: [
          {
            orgao: 'Companhia Docas do Pará (CDP)',
            numero: 'CDP-CT-2024-031',
            objeto: 'Recuperação dos dolfins de amarração e dragagem do canal de acesso',
            modalidade: 'Concorrência Internacional',
            valor: 8900000,
            saldo: 6100000,
            vigencia_inicio: '2024-02-15 00:00:00.000Z',
            vigencia_fim: '2027-02-28 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Helena Miranda',
            cargo: 'Diretora de Relações Institucionais',
            email: 'helena.miranda@hidroviaseng.com.br',
            telefone: '(91) 98114-5544',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 4. Em conversa
      {
        razao_social: 'Engenharia & Soluções Estruturais Paulista Ltda',
        nome_fantasia: 'ESE Infraestrutura',
        cnpj: '45.120.893/0001-33',
        situacao_cadastral: 'ATIVA',
        cnae: '42.12-0-00 - Construção de obras de arte especiais',
        porte: 'DEMAIS',
        uf: 'SP',
        municipio: 'Campinas',
        email: 'contato@eseinfra.com.br',
        telefone: '(19) 3781-4000',
        site: 'https://eseinfra.com.br',
        etapa_funil: 'em_conversa',
        curva: 'B',
        score: 79,
        status: 'ativa',
        proxima_acao_data: '2026-10-06 09:00:00.000Z',
        proxima_acao_desc:
          'Reunião virtual de alinhamento com coordenador de projetos complementares',
        observacoes:
          'Contrato ativo com a Artesp; buscando terceirizar laudos periciais de pontes.',
        contratos: [
          {
            orgao: 'Secretaria de Meio Ambiente, Infraestrutura e Logística do Estado de SP',
            numero: 'SEMIL-OAE-2024-08',
            objeto: 'Inspeção especial e reforço de vigas protendidas em viadutos da SP-330',
            modalidade: 'Concorrência',
            valor: 3450000,
            saldo: 2200000,
            vigencia_inicio: '2024-06-01 00:00:00.000Z',
            vigencia_fim: '2027-01-30 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Carlos Eduardo Nogueira',
            cargo: 'Coordenador de Engenharia Rodoviária',
            email: 'carlos.nogueira@eseinfra.com.br',
            telefone: '(19) 99123-8877',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 5. Com proposta elaborada
      {
        razao_social: 'Energia Limpa Linhas de Transmissão & Subestações Ltda',
        nome_fantasia: 'Volt Brasil Projetos',
        cnpj: '22.883.190/0001-05',
        situacao_cadastral: 'ATIVA',
        cnae: '42.21-9-02 - Construção de estações e subestações de energia',
        porte: 'GRANDE',
        uf: 'PR',
        municipio: 'Curitiba',
        email: 'propostas@voltbrasil.com.br',
        telefone: '(41) 3090-6700',
        site: 'https://voltbrasil.com.br',
        etapa_funil: 'com_proposta_elaborada',
        curva: 'A',
        score: 91,
        status: 'ativa',
        proxima_acao_data: '2026-10-04 11:00:00.000Z',
        proxima_acao_desc: 'Revisão final interna da proposta técnica PR-2026-VOLT com diretoria',
        observacoes:
          'Proposta elaborada para terceirização completa de projetos de terraplenagem e drenagem de subestação.',
        contratos: [
          {
            orgao: 'COPEL Distribuição S.A.',
            numero: 'COPEL-SE-2024/110',
            objeto:
              'Ampliação da Subestação Curitiba Norte 230kV com instalação de banco de capacitores',
            modalidade: 'Concorrência',
            valor: 7800000,
            saldo: 5500000,
            vigencia_inicio: '2024-05-20 00:00:00.000Z',
            vigencia_fim: '2027-08-31 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Eng. Fernando Klein',
            cargo: 'Superintendente de Suprimentos & Engenharia',
            email: 'fklein@voltbrasil.com.br',
            telefone: '(41) 98844-3322',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 6. Proposta enviada / em negociação
      {
        razao_social: 'Solaris Parques Fotovoltaicos & Infraestrutura Ltda',
        nome_fantasia: 'Solaris Renováveis',
        cnpj: '37.912.445/0001-88',
        situacao_cadastral: 'ATIVA',
        cnae: '42.21-9-03 - Manutenção de redes de distribuição de energia',
        porte: 'MEDIO',
        uf: 'BA',
        municipio: 'Juazeiro',
        email: 'diretoria@solarisrenovaveis.com.br',
        telefone: '(74) 3612-4040',
        site: 'https://solarisrenovaveis.com.br',
        etapa_funil: 'proposta_enviada',
        curva: 'B',
        score: 83,
        status: 'ativa',
        proxima_acao_data: '2026-10-07 15:00:00.000Z',
        proxima_acao_desc: 'Follow-up do envio da proposta comercial: desconto vs forma de medição',
        observacoes:
          'Proposta de R$ 380 mil enviada na última quarta-feira. Em negociação de prazos.',
        contratos: [
          {
            orgao: 'Companhia Hidro Elétrica do São Francisco (CHESF)',
            numero: 'CHESF-SOLAR-2024/33',
            objeto:
              'Infraestrutura civil de suporte e contenção de solo para complexo solar fotovoltaico',
            modalidade: 'RDC',
            valor: 2400000,
            saldo: 1650000,
            vigencia_inicio: '2024-07-01 00:00:00.000Z',
            vigencia_fim: '2026-12-31 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Gisele Queiroz',
            cargo: 'Gerente Geral de Contratos e Projetos',
            email: 'gisele@solarisrenovaveis.com.br',
            telefone: '(74) 99911-3434',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 8. Nutrição mensal (com contrato novo para demonstrar sugestão de reativação!)
      {
        razao_social: 'Catarinense Engenharia Sanitária & Ambiental Eireli',
        nome_fantasia: 'Catarinense Saneamento',
        cnpj: '19.448.231/0001-62',
        situacao_cadastral: 'ATIVA',
        cnae: '42.22-7-01 - Construção de redes de abastecimento de água e esgoto',
        porte: 'MEDIO',
        uf: 'SC',
        municipio: 'Joinville',
        email: 'atendimento@catarinensesan.com.br',
        telefone: '(47) 3433-2211',
        site: 'https://catarinensesan.com.br',
        etapa_funil: 'nutricao_mensal',
        curva: 'B',
        score: 74,
        status: 'ativa',
        proxima_acao_data: '2026-10-18 10:00:00.000Z',
        proxima_acao_desc:
          'Disparo do informativo mensal de novidades normativas NBR de saneamento',
        observacoes:
          'Não fechou parceria em 2025 por falta de contratos vigentes na época. Acaba de vencer nova licitação.',
        contratos: [
          {
            orgao: 'Companhia Catarinense de Águas e Saneamento (CASAN)',
            numero: 'CASAN-CT-2026-092',
            objeto: 'Ampliação da Estação de Tratamento de Esgoto de Joinville e elevatórias',
            modalidade: 'Concorrência Pública',
            valor: 4200000,
            saldo: 4200000,
            vigencia_inicio: '2026-09-01 00:00:00.000Z',
            vigencia_fim: '2028-09-01 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Eng. Fábio Meireles',
            cargo: 'Sócio-Diretor Técnico',
            email: 'fabio.meireles@catarinensesan.com.br',
            telefone: '(47) 99122-3344',
            decisor: true,
            verificado: true,
          },
        ],
      },
      // 9. Inativa (Inativada pelo Admin, motivo registrado, com contrato antigo expirado)
      {
        razao_social: 'Terras do Cerrado Pavimentação & Terraplenagem Ltda',
        nome_fantasia: 'Terras do Cerrado',
        cnpj: '03.882.114/0001-90',
        situacao_cadastral: 'ATIVA',
        cnae: '42.11-1-01 - Construção de rodovias e ferrovias',
        porte: 'PEQUENO',
        uf: 'GO',
        municipio: 'Anápolis',
        email: 'financeiro@terrasdocerrado.com.br',
        telefone: '(62) 3311-5050',
        site: '',
        etapa_funil: 'inativa',
        curva: 'C',
        score: 40,
        status: 'inativa',
        motivo_inativacao: 'Empresa não possui contratos vigentes ou encerrou atividades públicas',
        etapa_anterior: 'em_conversa',
        proxima_acao_data: null,
        proxima_acao_desc: 'Inativada pelo Administrador por vacância de contratos.',
        observacoes:
          'Empresa sem contratos públicos desde 2025. Preservada para reativação futura caso vença novo edital.',
        contratos: [
          {
            orgao: 'Prefeitura Municipal de Anápolis',
            numero: 'ANP-2023-11',
            objeto: 'Recapeamento asfáltico em CBUQ no Distrito Agroindustrial de Anápolis',
            modalidade: 'Pregão',
            valor: 450000,
            saldo: 0,
            vigencia_inicio: '2023-01-10 00:00:00.000Z',
            vigencia_fim: '2024-06-30 00:00:00.000Z',
            situacao: 'Encerrado',
          },
        ],
        contatos: [
          {
            nome: 'Almir Barreto',
            cargo: 'Gerente Administrativo',
            email: 'almir@terrasdocerrado.com.br',
            telefone: '(62) 98771-0022',
            decisor: false,
            verificado: false,
          },
        ],
      },
      // Mais uma Parceira de Curva A com contratos expressivos (> 5M)
      {
        razao_social: 'Sul-Brasileira de Túneis & Geotecnia Pesada S.A.',
        nome_fantasia: 'SulTúneis Infra',
        cnpj: '11.390.871/0001-20',
        situacao_cadastral: 'ATIVA',
        cnae: '42.13-8-00 - Obras de urbanização - ruas, praças e calçadas',
        porte: 'GRANDE',
        uf: 'RS',
        municipio: 'Porto Alegre',
        email: 'diretoria@sultuneis.com.br',
        telefone: '(51) 3320-8000',
        site: 'https://sultuneis.com.br',
        etapa_funil: 'parceira',
        curva: 'A',
        score: 96,
        status: 'ativa',
        proxima_acao_data: '2026-10-15 16:00:00.000Z',
        proxima_acao_desc:
          'Reunião mensal de acompanhamento de demandas e subcontratações terceirizadas',
        observacoes:
          'Parceira demandante de ponta. Terceiriza laudos de vibração e modelagem estrutural 3D.',
        contratos: [
          {
            orgao: 'Departamento Autônomo de Estradas de Rodagem (DAER-RS)',
            numero: 'DAER-TN-2024-001',
            objeto: 'Obras de contenção geológica com cortina atirantada e túnel falso na ERS-115',
            modalidade: 'Concorrência',
            valor: 11500000,
            saldo: 8700000,
            vigencia_inicio: '2024-01-20 00:00:00.000Z',
            vigencia_fim: '2027-12-31 00:00:00.000Z',
            situacao: 'Em Execução',
          },
        ],
        contatos: [
          {
            nome: 'Eng. Cristina Becker',
            cargo: 'Diretora de Engenharia e Planejamento',
            email: 'cristina.becker@sultuneis.com.br',
            telefone: '(51) 99120-1122',
            decisor: true,
            verificado: true,
          },
        ],
      },
    ]

    for (const item of empresasFicticias) {
      let empRec
      try {
        empRec = app.findFirstRecordByData('empresas', 'cnpj', item.cnpj)
      } catch (_) {
        empRec = new Record(empresasCol)
      }
      empRec.set('razao_social', item.razao_social)
      empRec.set('nome_fantasia', item.nome_fantasia)
      empRec.set('cnpj', item.cnpj)
      empRec.set('situacao_cadastral', item.situacao_cadastral)
      empRec.set('cnae', item.cnae)
      empRec.set('porte', item.porte)
      empRec.set('uf', item.uf)
      empRec.set('municipio', item.municipio)
      empRec.set('email', item.email)
      empRec.set('telefone', item.telefone)
      empRec.set('site', item.site)
      empRec.set('etapa_funil', item.etapa_funil)
      empRec.set('curva', item.curva)
      empRec.set('score', item.score)
      empRec.set('status', item.status)
      if (item.motivo_inativacao) empRec.set('motivo_inativacao', item.motivo_inativacao)
      if (item.etapa_anterior) empRec.set('etapa_anterior', item.etapa_anterior)
      if (item.proxima_acao_data) empRec.set('proxima_acao_data', item.proxima_acao_data)
      if (item.proxima_acao_desc) empRec.set('proxima_acao_desc', item.proxima_acao_desc)
      if (item.observacoes) empRec.set('observacoes', item.observacoes)
      if (respId) empRec.set('responsavel', respId)

      app.save(empRec)

      // Salvar contratos
      if (item.contratos) {
        for (const c of item.contratos) {
          let cRec
          try {
            cRec = app.findFirstRecordByData('contratos', 'numero', c.numero)
          } catch (_) {
            cRec = new Record(contratosCol)
          }
          cRec.set('empresa', empRec.id)
          cRec.set('orgao', c.orgao)
          cRec.set('numero', c.numero)
          cRec.set('objeto', c.objeto)
          cRec.set('modalidade', c.modalidade)
          cRec.set('valor', c.valor)
          cRec.set('saldo', c.saldo)
          cRec.set('vigencia_inicio', c.vigencia_inicio)
          cRec.set('vigencia_fim', c.vigencia_fim)
          cRec.set('situacao', c.situacao)
          app.save(cRec)

          // Se for a Catarinense (em nutrição) criar registro pendente de sugestão de reativação
          if (item.razao_social.includes('Catarinense') && c.numero.includes('CASAN')) {
            try {
              app.findFirstRecordByData('reativacoes_sugeridas', 'contrato_numero', c.numero)
            } catch (_) {
              const rRec = new Record(reativacoesCol)
              rRec.set('empresa', empRec.id)
              rRec.set('contrato', cRec.id)
              rRec.set('contrato_numero', c.numero)
              rRec.set('contrato_orgao', c.orgao)
              rRec.set('contrato_valor', c.valor)
              rRec.set('etapa_origem', 'nutricao_mensal')
              rRec.set('status', 'pendente')
              app.save(rRec)
            }
          }
        }
      }

      // Salvar contatos
      if (item.contatos) {
        for (const ct of item.contatos) {
          let ctRec
          try {
            ctRec = app.findFirstRecordByData('contatos', 'email', ct.email)
          } catch (_) {
            ctRec = new Record(contatosCol)
          }
          ctRec.set('empresa', empRec.id)
          ctRec.set('nome', ct.nome)
          ctRec.set('cargo', ct.cargo)
          ctRec.set('email', ct.email)
          ctRec.set('telefone', ct.telefone)
          ctRec.set('decisor', ct.decisor)
          ctRec.set('verificado', ct.verificado)
          app.save(ctRec)
        }
      }
    }

    // Sugestões fictícias para a Fila de Sugestões (/funil/sugestoes)
    const sugestoesAmostra = [
      {
        razao_social: 'Construplan Engenharia Viária e Estrutural Ltda',
        nome_fantasia: 'Construplan Obras',
        cnpj: '15.672.890/0001-44',
        uf: 'GO',
        municipio: 'Goiânia',
        email: 'contato@construplan.eng.br',
        telefone: '(62) 3211-4500',
        cnae: '42.11-1-01 - Construção de rodovias e ferrovias',
        porte: 'MEDIO',
        orgao_contrato: 'Agência Goiana de Infraestrutura e Transportes (GOINFRA)',
        numero_contrato: 'GOINFRA-2024-88',
        objeto_contrato: 'Duplicação e pavimentação asfáltica em CBUQ da GO-070 com pontilhões',
        valor_estimado: 5400000,
        fonte: 'planilha',
        status: 'pendente',
        observacoes: 'Importada via planilha de vencedores de licitações GOINFRA.',
      },
      {
        razao_social: 'Aquasul Tecnologia em Tratamento de Efluentes S.A.',
        nome_fantasia: 'AquaSul Engenharia',
        cnpj: '33.901.782/0001-19',
        uf: 'RS',
        municipio: 'Caxias do Sul',
        email: 'licitacoes@aquasul.eng.br',
        telefone: '(54) 3289-9000',
        cnae: '42.22-7-01 - Construção de redes de água e esgoto',
        porte: 'DEMAIS',
        orgao_contrato: 'Serviço Autônomo Municipal de Água e Esgoto (SAMAE Caxias)',
        numero_contrato: 'SAMAE-CT-2024-15',
        objeto_contrato:
          'Construção da ETE Faxinal com vertedouros e decantadores em concreto armado',
        valor_estimado: 3850000,
        fonte: 'pncp',
        status: 'aprovada_para_inclusao',
        observacoes:
          'Detectada na consulta pública PNCP. Validada pelo comercial para inclusão no funil.',
      },
      {
        razao_social: 'Nordeste Pontes & Viadutos Especializados Ltda',
        nome_fantasia: 'Nordeste Pontes',
        cnpj: '08.772.339/0001-52',
        uf: 'PE',
        municipio: 'Recife',
        email: 'diretoria@nordestepontes.com.br',
        telefone: '(81) 3465-1200',
        cnae: '42.12-0-00 - Construção de obras de arte especiais',
        porte: 'MEDIO',
        orgao_contrato: 'Secretaria de Infraestrutura de Pernambuco (SEINFRA-PE)',
        numero_contrato: 'PE-OAE-2024-04',
        objeto_contrato: 'Reforço estrutural da ponte sobre o Rio Capibaribe',
        valor_estimado: 1950000,
        fonte: 'planilha',
        status: 'pendente',
        observacoes: 'Oportunidade para oferecer projeto executivo complementar de protensão.',
      },
      {
        razao_social: 'Soluções Acústicas & Isolamentos Industriais Ltda',
        nome_fantasia: 'Acústica Brasil',
        cnpj: '21.099.444/0001-33',
        uf: 'SP',
        municipio: 'São Paulo',
        email: 'vendas@acusticabrasil.com.br',
        telefone: '(11) 3881-9900',
        cnae: '43.29-1-05 - Tratamentos acústicos e térmicos',
        porte: 'PEQUENO',
        orgao_contrato: 'Fundação Teatro Municipal de SP',
        numero_contrato: 'TM-2024-012',
        objeto_contrato: 'Fornecimento de painéis acústicos e forro mineral',
        valor_estimado: 180000,
        fonte: 'manual',
        status: 'descartada',
        motivo_descarte: 'Escopo apenas de fornecimento de material sem serviços de engenharia',
        observacoes: 'Descartada por não se alinhar ao core de intermediação de projetos.',
      },
    ]

    for (const sug of sugestoesAmostra) {
      try {
        app.findFirstRecordByData('sugestoes_funil', 'cnpj', sug.cnpj)
      } catch (_) {
        const sRec = new Record(sugestoesCol)
        sRec.set('razao_social', sug.razao_social)
        sRec.set('nome_fantasia', sug.nome_fantasia)
        sRec.set('cnpj', sug.cnpj)
        sRec.set('uf', sug.uf)
        sRec.set('municipio', sug.municipio)
        sRec.set('email', sug.email)
        sRec.set('telefone', sug.telefone)
        sRec.set('cnae', sug.cnae)
        sRec.set('porte', sug.porte)
        sRec.set('orgao_contrato', sug.orgao_contrato)
        sRec.set('numero_contrato', sug.numero_contrato)
        sRec.set('objeto_contrato', sug.objeto_contrato)
        sRec.set('valor_estimado', sug.valor_estimado)
        sRec.set('fonte', sug.fonte)
        sRec.set('status', sug.status)
        if (sug.motivo_descarte) sRec.set('motivo_descarte', sug.motivo_descarte)
        sRec.set('observacoes', sug.observacoes)
        app.save(sRec)
      }
    }

    // Registros iniciais para a lista "Não Contatar" (/nao-contatar)
    const naoContatarAmostra = [
      {
        email: 'privacidade@construtoradescartada.com.br',
        motivo: 'Solicitação direta via link de descadastro (LGPD - opt-out)',
        data_inclusao: '2026-09-15 00:00:00.000Z',
      },
      {
        email: 'juridico@grupoindustrial-bloqueado.com.br',
        motivo: 'Notificação extrajudicial de recusa de contato comercial',
        data_inclusao: '2026-09-20 00:00:00.000Z',
      },
    ]

    for (const nc of naoContatarAmostra) {
      try {
        app.findFirstRecordByData('nao_contatar', 'email', nc.email)
      } catch (_) {
        const ncRec = new Record(naoContatarCol)
        ncRec.set('email', nc.email)
        ncRec.set('motivo', nc.motivo)
        ncRec.set('data_inclusao', nc.data_inclusao)
        app.save(ncRec)
      }
    }
  },
  (app) => {},
)
