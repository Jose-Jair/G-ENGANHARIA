migrate(
  (app) => {
    // 1. Atualizar collection clientes_pf
    const clientesPf = app.findCollectionByNameOrId('clientes_pf')

    if (!clientesPf.fields.getByName('telefones')) {
      clientesPf.fields.add(
        new JSONField({
          name: 'telefones',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('cep')) {
      clientesPf.fields.add(
        new TextField({
          name: 'cep',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('logradouro')) {
      clientesPf.fields.add(
        new TextField({
          name: 'logradouro',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('numero')) {
      clientesPf.fields.add(
        new TextField({
          name: 'numero',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('complemento')) {
      clientesPf.fields.add(
        new TextField({
          name: 'complemento',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('bairro')) {
      clientesPf.fields.add(
        new TextField({
          name: 'bairro',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('municipio')) {
      clientesPf.fields.add(
        new TextField({
          name: 'municipio',
          required: false,
        }),
      )
    }
    if (!clientesPf.fields.getByName('uf')) {
      clientesPf.fields.add(
        new TextField({
          name: 'uf',
          required: false,
        }),
      )
    }
    app.save(clientesPf)

    // 2. Atualizar collection empresas
    const empresas = app.findCollectionByNameOrId('empresas')

    if (!empresas.fields.getByName('cep')) {
      empresas.fields.add(
        new TextField({
          name: 'cep',
          required: false,
        }),
      )
    }
    if (!empresas.fields.getByName('logradouro')) {
      empresas.fields.add(
        new TextField({
          name: 'logradouro',
          required: false,
        }),
      )
    }
    if (!empresas.fields.getByName('numero')) {
      empresas.fields.add(
        new TextField({
          name: 'numero',
          required: false,
        }),
      )
    }
    if (!empresas.fields.getByName('complemento')) {
      empresas.fields.add(
        new TextField({
          name: 'complemento',
          required: false,
        }),
      )
    }
    if (!empresas.fields.getByName('bairro')) {
      empresas.fields.add(
        new TextField({
          name: 'bairro',
          required: false,
        }),
      )
    }
    app.save(empresas)

    // 3. Backfill nos registros existentes de clientes_pf:
    // telefone existente vira o primeiro item de telefones; endereco (texto) é preservado.
    try {
      const records = app.findRecordsByFilter('clientes_pf', '', '', 0, 0)
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const rawTelefone = r.getString('telefone')
        const telefonesJson = r.get('telefones')

        let precisaSalvar = false
        if (
          (!telefonesJson || telefonesJson.length === 0) &&
          rawTelefone &&
          rawTelefone.trim() !== ''
        ) {
          r.set('telefones', [
            {
              id: 'tel_mig_' + r.id,
              numero: rawTelefone.trim(),
              whatsapp: true,
            },
          ])
          precisaSalvar = true
        }

        if (precisaSalvar) {
          app.save(r)
        }
      }
    } catch (err) {
      console.log('Aviso ao migrar telefones de clientes_pf:', err)
    }
  },
  (app) => {
    try {
      const clientesPf = app.findCollectionByNameOrId('clientes_pf')
      const pfFields = [
        'telefones',
        'cep',
        'logradouro',
        'numero',
        'complemento',
        'bairro',
        'municipio',
        'uf',
      ]
      for (let i = 0; i < pfFields.length; i++) {
        const f = clientesPf.fields.getByName(pfFields[i])
        if (f) clientesPf.fields.remove(f)
      }
      app.save(clientesPf)

      const empresas = app.findCollectionByNameOrId('empresas')
      const empFields = ['cep', 'logradouro', 'numero', 'complemento', 'bairro']
      for (let i = 0; i < empFields.length; i++) {
        const f = empresas.fields.getByName(empFields[i])
        if (f) empresas.fields.remove(f)
      }
      app.save(empresas)
    } catch (_) {}
  },
)
