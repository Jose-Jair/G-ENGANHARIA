migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Add role select field
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'comercial', 'financeiro', 'gestor', 'executor'],
          maxSelect: 1,
        }),
      )
    }

    // Add active bool field
    if (!users.fields.getByName('active')) {
      users.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
    }

    // Add phone text field
    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
        }),
      )
    }

    // Add cpf_cnpj text field
    if (!users.fields.getByName('cpf_cnpj')) {
      users.fields.add(
        new TextField({
          name: 'cpf_cnpj',
        }),
      )
    }

    // Add mfa_secret text field
    if (!users.fields.getByName('mfa_secret')) {
      users.fields.add(
        new TextField({
          name: 'mfa_secret',
        }),
      )
    }

    // Add mfa_enabled bool field
    if (!users.fields.getByName('mfa_enabled')) {
      users.fields.add(
        new BoolField({
          name: 'mfa_enabled',
        }),
      )
    }

    // Add ultimo_login date field
    if (!users.fields.getByName('ultimo_login')) {
      users.fields.add(
        new DateField({
          name: 'ultimo_login',
        }),
      )
    }

    // Set access rules:
    // Admin reads/manages all; others can only read/edit own record.
    // Only admin creates users.
    // Note: @request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)
    users.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const fieldsToRemove = [
      'role',
      'active',
      'phone',
      'cpf_cnpj',
      'mfa_secret',
      'mfa_enabled',
      'ultimo_login',
    ]
    fieldsToRemove.forEach((f) => {
      const field = users.fields.getByName(f)
      if (field) {
        users.fields.removeByName(f)
      }
    })
    users.listRule = ''
    users.viewRule = ''
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
