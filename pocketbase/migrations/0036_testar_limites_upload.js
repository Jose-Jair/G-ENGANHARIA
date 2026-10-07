migrate(
  (app) => {
    // 1. Criar um projeto de teste
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const recProj = new Record(projetosCol)
    recProj.set('codigo', 'PRJ-TESTE-LIMITES')
    recProj.set('nome', 'Projeto Teste Limites de Upload')
    recProj.set('status', 'planejamento')
    app.save(recProj)

    const projId = recProj.id

    // 2. Testar criação de documento com anexo
    // No PocketBase server-side migrations, podemos anexar usando new FilePath / $filesystem ou testar salvamento de metadados
    // Vamos registrar no log a confirmação de que os campos estão com maxSize = 104857600
    const docCol = app.findCollectionByNameOrId('documentos')
    const entCol = app.findCollectionByNameOrId('entregaveis')

    const docArquivoField = docCol.fields.getByName('arquivo')
    const entArquivoField = entCol.fields.getByName('arquivo')
    const prjAnexoField = projetosCol.fields.getByName('anexo_autorizacao')

    console.log(
      'VERIFICACAO_LIMITES: docArquivo=' +
        (docArquivoField ? docArquivoField.maxSize : 'null') +
        ', entArquivo=' +
        (entArquivoField ? entArquivoField.maxSize : 'null') +
        ', prjAnexo=' +
        (prjAnexoField ? prjAnexoField.maxSize : 'null'),
    )

    // 3. Remover o projeto de teste imediatamente para não deixar lixo no banco
    app.delete(recProj)
  },
  (app) => {},
)
