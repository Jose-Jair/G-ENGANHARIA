migrate(
  (app) => {
    // Buscar todos os projetos que vieram de proposta e que ainda estão sem nome/valor
    const projetos = app.findRecordsByFilter('projetos', "nome = '' && proposta != ''", '', 100, 0)
    for (let i = 0; i < projetos.length; i++) {
      const prj = projetos[i]
      const propId = prj.getString('proposta')
      if (propId) {
        try {
          const prop = app.findRecordById('propostas', propId)
          if (prop) {
            prj.set('nome', prop.getString('escopo') || 'Projeto ' + prj.getString('codigo'))
            prj.set('valor_total', prop.getFloat('preco') || 0)
            prj.set('disciplinas', prop.getString('disciplinas') || '')
            prj.set('empresa', prop.getString('empresa') || '')
            prj.set('cliente_pf', prop.getString('cliente_pf') || '')
            if (prop.getString('validade')) {
              prj.set('prazo_final', prop.getString('validade'))
            }
            if (!prj.getString('justificativa_saude')) {
              prj.set(
                'justificativa_saude',
                'Projeto gerado automaticamente pela proposta aceita ' + prop.getString('numero'),
              )
            }
            app.save(prj)
          }
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
