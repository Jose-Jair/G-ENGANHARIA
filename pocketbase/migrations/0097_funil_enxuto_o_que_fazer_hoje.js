migrate(
  (app) => {
    // =========================================================================
    // RODADA 10 — PARTE 1: FUNIL ENXUTO E TRILHA DO NEGÓCIO
    // 1. Novos campos não-destrutivos na coleção 'empresas':
    //    - is_parceira (bool, selo da empresa, substitui etapa fixa do funil sem alterar dados existentes)
    //    - data_selo_parceira (date)
    //    - tipo_cliente (select: 'pj' | 'pf', default 'pj')
    //    - cliente_pf_ref (relation para clientes_pf, maxSelect: 1, opcional)
    // =========================================================================
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const clientesPfCol = app.findCollectionByNameOrId('clientes_pf')

    if (!empresasCol.fields.getByName('is_parceira')) {
      empresasCol.fields.add(
        new BoolField({
          name: 'is_parceira',
          required: false,
        }),
      )
    }

    if (!empresasCol.fields.getByName('data_selo_parceira')) {
      empresasCol.fields.add(
        new DateField({
          name: 'data_selo_parceira',
          required: false,
        }),
      )
    }

    if (!empresasCol.fields.getByName('tipo_cliente')) {
      empresasCol.fields.add(
        new SelectField({
          name: 'tipo_cliente',
          values: ['pj', 'pf'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!empresasCol.fields.getByName('cliente_pf_ref')) {
      empresasCol.fields.add(
        new RelationField({
          name: 'cliente_pf_ref',
          collectionId: clientesPfCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(empresasCol)

    // =========================================================================
    // 2. Backfill NÃO-DESTRUTIVO do selo 'is_parceira' nas empresas que já têm
    //    etapa_funil = 'parceira' ou histórico de parceira (sem alterar etapa_funil!)
    // =========================================================================
    try {
      app
        .db()
        .newQuery(
          "UPDATE empresas SET is_parceira = 1, data_selo_parceira = updated WHERE etapa_funil = 'parceira' AND (is_parceira IS NULL OR is_parceira = 0)",
        )
        .execute()
    } catch (e1) {
      console.log('[0097] Erro no backfill is_parceira: ' + e1)
    }

    try {
      app
        .db()
        .newQuery(
          "UPDATE empresas SET tipo_cliente = 'pj' WHERE tipo_cliente IS NULL OR tipo_cliente = ''",
        )
        .execute()
    } catch (e2) {
      console.log('[0097] Erro no backfill tipo_cliente: ' + e2)
    }

    // =========================================================================
    // 3. Backfill NÃO-DESTRUTIVO de clientes_pf no fluxo unificado de clientes:
    //    Para cada cliente_pf que ainda não tem representação como cliente,
    //    preenchemos referência na coleção mantendo clientes_pf 100% intacto.
    // =========================================================================
    try {
      const todosClientesPf = app.findRecordsByFilter('clientes_pf', '', '', 5000, 0)
      for (let i = 0; i < todosClientesPf.length; i++) {
        const pf = todosClientesPf[i]
        const cpfLimpo = (pf.getString('cpf') || '').replace(/\D/g, '')

        // Verificar se já existe empresa com este cliente_pf_ref ou mesmo CPF
        let existeVinculo = false
        try {
          const achou = app.findFirstRecordByData('empresas', 'cliente_pf_ref', pf.id)
          if (achou) existeVinculo = true
        } catch (_) {}

        if (!existeVinculo && cpfLimpo) {
          try {
            const achouCpf = app.findFirstRecordByData('empresas', 'cnpj', cpfLimpo)
            if (achouCpf) {
              achouCpf.set('cliente_pf_ref', pf.id)
              achouCpf.set('tipo_cliente', 'pf')
              app.save(achouCpf)
              existeVinculo = true
            }
          } catch (_) {}
        }

        // Se ainda não existe empresa espelho para o cliente PF no funil unificado, criamos sem apagar clientes_pf
        if (!existeVinculo) {
          try {
            const novoEspelho = new Record(empresasCol)
            novoEspelho.set('razao_social', pf.getString('nome'))
            novoEspelho.set('nome_fantasia', pf.getString('nome'))
            novoEspelho.set('cnpj', cpfLimpo || 'PF-' + pf.id)
            novoEspelho.set('email', pf.getString('email'))
            novoEspelho.set('telefone', pf.getString('telefone'))
            novoEspelho.set('tipo_cliente', 'pf')
            novoEspelho.set('cliente_pf_ref', pf.id)
            novoEspelho.set('etapa_funil', 'qualificada')
            novoEspelho.set('curva', 'C')
            novoEspelho.set('score', 50)
            novoEspelho.set('status', 'ativa')
            novoEspelho.set(
              'observacoes',
              '[Fluxo Unificado PF]: Vinculado ao registro clientes_pf ' + pf.id,
            )
            app.save(novoEspelho)
          } catch (eEspelho) {
            console.log('[0097] Erro ao criar espelho de cliente_pf: ' + eEspelho)
          }
        }
      }
    } catch (ePf) {
      console.log('[0097] Aviso no backfill de clientes_pf: ' + ePf)
    }

    // =========================================================================
    // 4. Parâmetros do Sistema para a Rodada 10:
    //    - funil_correspondencia_5_colunas (Mapeamento oficial das 9 etapas para 5 colunas)
    //    - funil_probabilidade_por_coluna_5 (Probabilidade compatível com as 5 colunas)
    //    - rotulo_oficial_contratos_parceiro ("Contratos do Parceiro")
    //    - rotulo_oficial_contratos_servico ("Contratos de Serviço")
    // =========================================================================
    const parametrosCol = app.findCollectionByNameOrId('parametros')

    const novosParametros = [
      {
        chave: 'funil_correspondencia_5_colunas',
        valor: JSON.stringify({
          // As 9 etapas existentes -> mapeadas para as 5 colunas oficiais
          identificada: 'identificada',
          qualificada: 'qualificada',
          em_cadencia: 'qualificada',
          com_proposta_elaborada: 'em_proposta',
          proposta_enviada: 'em_proposta',
          em_conversa: 'negociacao',
          parceira: 'ganha_perdida',
          nutricao_mensal: 'ganha_perdida',
          inativa: 'ganha_perdida',
        }),
        descricao:
          'Tabela oficial de correspondência: mapeamento das 9 etapas antigas para as 5 colunas do Funil Enxuto (Identificada, Qualificada, Em proposta, Negociação, Ganha/Perdida).',
      },
      {
        chave: 'funil_colunas_5_definicao',
        valor: JSON.stringify([
          { id: 'identificada', titulo: 'Identificada', ordem: 1, cor: '#64748B' },
          { id: 'qualificada', titulo: 'Qualificada', ordem: 2, cor: '#2563EB' },
          { id: 'em_proposta', titulo: 'Em proposta', ordem: 3, cor: '#D95A2B' },
          { id: 'negociacao', titulo: 'Negociação', ordem: 4, cor: '#7C3AED' },
          { id: 'ganha_perdida', titulo: 'Ganha / Perdida', ordem: 5, cor: '#059669' },
        ]),
        descricao:
          'Definição das 5 colunas do funil enxuto com títulos oficiais, cores e ordem de exibição.',
      },
      {
        chave: 'funil_probabilidade_por_coluna_5',
        valor: JSON.stringify({
          identificada: 10,
          qualificada: 25,
          em_proposta: 60,
          negociacao: 85,
          ganha_perdida: 100, // para empresas ganhas (com selo de parceira); descartadas/perdidas = 0%
        }),
        descricao:
          'Probabilidade ponderada financeira compatível com as 5 colunas do funil comercial enxuto.',
      },
      {
        chave: 'rotulo_oficial_contratos_parceiro',
        valor: 'Contratos do Parceiro',
        descricao:
          'Rótulo oficial para a Parte 2: contratos públicos da empresa demandante com órgãos governamentais.',
      },
      {
        chave: 'rotulo_oficial_contratos_servico',
        valor: 'Contratos de Serviço',
        descricao:
          'Rótulo oficial para a Parte 2: contratos bilaterais de prestação de serviços de engenharia da G+.',
      },
    ]

    for (let i = 0; i < novosParametros.length; i++) {
      const p = novosParametros[i]
      try {
        const existe = app.findFirstRecordByData('parametros', 'chave', p.chave)
        if (existe) {
          existe.set('valor', p.valor)
          existe.set('descricao', p.descricao)
          app.save(existe)
        }
      } catch (_) {
        const r = new Record(parametrosCol)
        r.set('chave', p.chave)
        r.set('valor', p.valor)
        r.set('descricao', p.descricao)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reversão não-destrutiva: não remove campos nem apaga dados
  },
)
