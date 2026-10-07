// Hook de verificação de limites dos campos de arquivos dos módulos de projeto
// Rota GET /backend/v1/projetos/limites-upload
// Acessível para usuários autenticados (Admin, Gestor, Financeiro, Comercial, Executor)
routerAdd(
  'GET',
  '/backend/v1/projetos/limites-upload',
  (e) => {
    try {
      const auth = e.auth
      if (!auth) {
        throw new ForbiddenError('Acesso não autenticado.')
      }

      const docCol = $app.findCollectionByNameOrId('documentos')
      const entCol = $app.findCollectionByNameOrId('entregaveis')
      const prjCol = $app.findCollectionByNameOrId('projetos')

      const docField = docCol.fields.getByName('arquivo')
      const entField = entCol.fields.getByName('arquivo')
      const prjField = prjCol.fields.getByName('anexo_autorizacao')

      return e.json(200, {
        success: true,
        limites: {
          documentos_arquivo: {
            maxSize: docField ? docField.maxSize : null,
            maxSizeMb: docField ? Math.round(docField.maxSize / (1024 * 1024)) : null,
          },
          entregaveis_arquivo: {
            maxSize: entField ? entField.maxSize : null,
            maxSizeMb: entField ? Math.round(entField.maxSize / (1024 * 1024)) : null,
          },
          projetos_anexo_autorizacao: {
            maxSize: prjField ? prjField.maxSize : null,
            maxSizeMb: prjField ? Math.round(prjField.maxSize / (1024 * 1024)) : null,
          },
        },
      })
    } catch (err) {
      return e.json(500, {
        success: false,
        message: 'Erro ao consultar limites: ' + (err?.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
