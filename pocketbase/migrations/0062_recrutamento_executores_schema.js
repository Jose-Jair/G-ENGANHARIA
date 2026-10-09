migrate(
  (app) => {
    const executores = app.findCollectionByNameOrId('executores')

    // 1. token_cadastro (texto)
    if (!executores.fields.getByName('token_cadastro')) {
      executores.fields.add(
        new TextField({
          name: 'token_cadastro',
          required: false,
        }),
      )
    }

    // 2. token_cadastro_expira (data/hora)
    if (!executores.fields.getByName('token_cadastro_expira')) {
      executores.fields.add(
        new DateField({
          name: 'token_cadastro_expira',
          required: false,
        }),
      )
    }

    // 3. conselho_classe (select: CREA | CAU | CFT | OUTRO)
    if (!executores.fields.getByName('conselho_classe')) {
      executores.fields.add(
        new SelectField({
          name: 'conselho_classe',
          values: ['CREA', 'CAU', 'CFT', 'OUTRO'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 4. numero_registro_conselho (texto)
    if (!executores.fields.getByName('numero_registro_conselho')) {
      executores.fields.add(
        new TextField({
          name: 'numero_registro_conselho',
          required: false,
        }),
      )
    }

    // 5. validade_registro_conselho (data)
    if (!executores.fields.getByName('validade_registro_conselho')) {
      executores.fields.add(
        new DateField({
          name: 'validade_registro_conselho',
          required: false,
        }),
      )
    }

    // 6. documento_termo (arquivo)
    if (!executores.fields.getByName('documento_termo')) {
      executores.fields.add(
        new FileField({
          name: 'documento_termo',
          maxSelect: 1,
          maxSize: 10 * 1024 * 1024, // 10MB
          mimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          required: false,
        }),
      )
    }

    // Salvar coleção com novos campos
    app.save(executores)

    // Adicionar índice para token_cadastro
    try {
      executores.addIndex('idx_executores_token_cadastro', false, 'token_cadastro', '')
      app.save(executores)
    } catch (errIdx) {
      console.log('Aviso ao adicionar índice idx_executores_token_cadastro: ' + errIdx)
    }
  },
  (app) => {
    const executores = app.findCollectionByNameOrId('executores')
    try {
      executores.removeIndex('idx_executores_token_cadastro')
    } catch (_) {}

    const camposParaRemover = [
      'token_cadastro',
      'token_cadastro_expira',
      'conselho_classe',
      'numero_registro_conselho',
      'validade_registro_conselho',
      'documento_termo',
    ]

    for (let i = 0; i < camposParaRemover.length; i++) {
      const f = executores.fields.getByName(camposParaRemover[i])
      if (f) {
        executores.fields.removeByName(camposParaRemover[i])
      }
    }

    app.save(executores)
  },
)
