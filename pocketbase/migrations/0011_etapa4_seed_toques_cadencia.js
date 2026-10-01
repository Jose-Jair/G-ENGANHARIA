migrate(
  (app) => {
    const toquesCol = app.findCollectionByNameOrId('toques')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Data de referência de hoje e passadas para gerar diferentes cenários
    const hoje = new Date()
    const toDateStr = (d) => d.toISOString().substring(0, 10) + ' 12:00:00.000Z'

    const dMenos8 = new Date(hoje.getTime() - 8 * 24 * 60 * 60 * 1000)
    const dMenos6 = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000)
    const dMenos3 = new Date(hoje.getTime() - 3 * 24 * 60 * 60 * 1000)
    const dMenos1 = new Date(hoje.getTime() - 1 * 24 * 60 * 60 * 1000)
    const dHoje = hoje
    const dMais2 = new Date(hoje.getTime() + 2 * 24 * 60 * 60 * 1000)
    const dMais5 = new Date(hoje.getTime() + 5 * 24 * 60 * 60 * 1000)
    const dMais10 = new Date(hoje.getTime() + 10 * 24 * 60 * 60 * 1000)
    const dMais25 = new Date(hoje.getTime() + 25 * 24 * 60 * 60 * 1000)

    // 1. EMPRESA 1: HidroVias Engenharia Fluvial (id: 65ysjigjznbfz1x, Curva A)
    // Cenário: Toque 1 realizado, Toque 2 realizado, Toque 3 (E-mail) EM ATRASO CRÍTICO (6 dias atrás)
    try {
      const emp1 = app.findRecordById('empresas', '65ysjigjznbfz1x')
      if (emp1) {
        emp1.set('etapa_funil', 'em_cadencia')
        emp1.set('proxima_acao_data', toDateStr(dMenos6))
        emp1.set('proxima_acao_desc', 'Toque 3: E-mail (Solução Elaborada) - Em atraso crítico')
        app.save(emp1)

        const toquesEmp1 = [
          {
            num: 1,
            canal: 'email',
            prev: toDateStr(dMenos8),
            real: toDateStr(dMenos8),
            status: 'realizado',
            res: 'E-mail institucional enviado para diretora Helena Miranda',
            obs: 'Toque 1 institucional enviado com sucesso.',
          },
          {
            num: 2,
            canal: 'whatsapp',
            prev: toDateStr(dMenos6),
            real: toDateStr(dMenos6),
            status: 'realizado',
            res: 'Mensagem de WhatsApp confirmada',
            obs: 'Retomada realizada via WhatsApp institucional.',
          },
          {
            num: 3,
            canal: 'email',
            prev: toDateStr(dMenos6),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 3 de solução técnica elaborada e viabilidade.',
          },
          {
            num: 4,
            canal: 'whatsapp',
            prev: toDateStr(dMais5),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 4 de retomada via WhatsApp.',
          },
          {
            num: 5,
            canal: 'email',
            prev: toDateStr(dMais25),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 5 de oferta de projeto piloto preliminar sem risco.',
          },
        ]

        for (let i = 0; i < toquesEmp1.length; i++) {
          const t = toquesEmp1[i]
          const rec = new Record(toquesCol)
          rec.set('empresa', emp1.id)
          rec.set('numero_toque', t.num)
          rec.set('canal', t.canal)
          rec.set('data_prevista', t.prev)
          if (t.real) rec.set('data_realizada', t.real)
          rec.set('status', t.status)
          if (t.res) rec.set('resultado', t.res)
          rec.set('observacao', t.obs)
          app.save(rec)
        }
      }
    } catch (e1) {
      console.log('Erro ao seedar toques emp1: ' + e1)
    }

    // 2. EMPRESA 2: GeoTop Geotecnia (id: 150h7gt89t2lqy6, Curva C)
    // Cenário: Toque 1 realizado, Toque 2 com PENDÊNCIA (número de WhatsApp inválido gerando pendência)
    try {
      const emp2 = app.findRecordById('empresas', '150h7gt89t2lqy6')
      if (emp2) {
        emp2.set('etapa_funil', 'em_cadencia')
        emp2.set('proxima_acao_data', toDateStr(dHoje))
        emp2.set(
          'proxima_acao_desc',
          'PENDÊNCIA: Contato inválido/rejeitado no Toque 2. Corrigir cadastro antes de prosseguir.',
        )
        app.save(emp2)

        const toquesEmp2 = [
          {
            num: 1,
            canal: 'email',
            prev: toDateStr(dMenos3),
            real: toDateStr(dMenos3),
            status: 'realizado',
            res: 'E-mail institucional enviado para contato comercial',
            obs: 'Primeiro toque enviado com link de descadastro.',
          },
          {
            num: 2,
            canal: 'whatsapp',
            prev: toDateStr(dHoje),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 2 aguardando correção de contato telefônico/WhatsApp.',
          },
          {
            num: 3,
            canal: 'email',
            prev: toDateStr(dMais5),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 3 de proposta de solução técnica.',
          },
          {
            num: 4,
            canal: 'whatsapp',
            prev: toDateStr(dMais10),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 4 de retomada.',
          },
          {
            num: 5,
            canal: 'email',
            prev: toDateStr(dMais25),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 5 piloto.',
          },
        ]

        for (let i = 0; i < toquesEmp2.length; i++) {
          const t = toquesEmp2[i]
          const rec = new Record(toquesCol)
          rec.set('empresa', emp2.id)
          rec.set('numero_toque', t.num)
          rec.set('canal', t.canal)
          rec.set('data_prevista', t.prev)
          if (t.real) rec.set('data_realizada', t.real)
          rec.set('status', t.status)
          if (t.res) rec.set('resultado', t.res)
          rec.set('observacao', t.obs)
          app.save(rec)
        }
      }
    } catch (e2) {
      console.log('Erro ao seedar toques emp2: ' + e2)
    }

    // 3. EMPRESA 3: Consórcio Nordeste Edificações Públicas SPE (id: l11w5z5l84hywva, Curva C)
    // Vamos movê-la para em_cadencia com Toque 1 PARA HOJE (D0)
    try {
      const emp3 = app.findRecordById('empresas', 'l11w5z5l84hywva')
      if (emp3) {
        emp3.set('etapa_funil', 'em_cadencia')
        emp3.set('proxima_acao_data', toDateStr(dHoje))
        emp3.set('proxima_acao_desc', 'Toque 1: E-mail Institucional (Para Hoje)')
        app.save(emp3)

        const toquesEmp3 = [
          {
            num: 1,
            canal: 'email',
            prev: toDateStr(dHoje),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 1 institucional de apresentação e credenciamento.',
          },
          {
            num: 2,
            canal: 'whatsapp',
            prev: toDateStr(dMais2),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 2 de retomada via WhatsApp.',
          },
          {
            num: 3,
            canal: 'email',
            prev: toDateStr(dMais5),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 3 de solução técnica elaborada e viabilidade.',
          },
          {
            num: 4,
            canal: 'whatsapp',
            prev: toDateStr(dMais10),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 4 de retomada via WhatsApp.',
          },
          {
            num: 5,
            canal: 'email',
            prev: toDateStr(dMais25),
            real: null,
            status: 'agendado',
            res: null,
            obs: 'Toque 5 de oferta de projeto piloto preliminar sem risco.',
          },
        ]

        for (let i = 0; i < toquesEmp3.length; i++) {
          const t = toquesEmp3[i]
          const rec = new Record(toquesCol)
          rec.set('empresa', emp3.id)
          rec.set('numero_toque', t.num)
          rec.set('canal', t.canal)
          rec.set('data_prevista', t.prev)
          rec.set('status', t.status)
          rec.set('observacao', t.obs)
          app.save(rec)
        }
      }
    } catch (e3) {
      console.log('Erro ao seedar toques emp3: ' + e3)
    }
  },
  (app) => {},
)
