migrate(
  (app) => {
    // Alvo: Aumentar o limite de arquivos nos módulos de projeto
    // Campos identificados:
    // 1. documentos.arquivo (ART, RRT, TRT, OS, medicao) -> 100 MB (104857600 bytes)
    // 2. entregaveis.arquivo (entregáveis técnicos das etapas) -> 100 MB (104857600 bytes)
    // 3. projetos.anexo_autorizacao (autorização formal do demandante) -> 100 MB (104857600 bytes)
    const TARGET_MAX_SIZE = 104857600 // 100 MB em bytes

    // 1. Coleção documentos
    try {
      const documentosCol = app.findCollectionByNameOrId('documentos')
      const campoArquivoDoc = documentosCol.fields.getByName('arquivo')
      if (campoArquivoDoc) {
        campoArquivoDoc.maxSize = TARGET_MAX_SIZE
        app.save(documentosCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar campo arquivo de documentos: ' + e)
    }

    // 2. Coleção entregaveis
    try {
      const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
      const campoArquivoEnt = entregaveisCol.fields.getByName('arquivo')
      if (campoArquivoEnt) {
        campoArquivoEnt.maxSize = TARGET_MAX_SIZE
        app.save(entregaveisCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar campo arquivo de entregaveis: ' + e)
    }

    // 3. Coleção projetos
    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      const campoAnexoProj = projetosCol.fields.getByName('anexo_autorizacao')
      if (campoAnexoProj) {
        campoAnexoProj.maxSize = TARGET_MAX_SIZE
        app.save(projetosCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar campo anexo_autorizacao de projetos: ' + e)
    }
  },
  (app) => {
    // Reverter para os limites anteriores caso necessário
    try {
      const documentosCol = app.findCollectionByNameOrId('documentos')
      const campoArquivoDoc = documentosCol.fields.getByName('arquivo')
      if (campoArquivoDoc) {
        campoArquivoDoc.maxSize = 20971520 // 20 MB
        app.save(documentosCol)
      }
    } catch (_) {}

    try {
      const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
      const campoArquivoEnt = entregaveisCol.fields.getByName('arquivo')
      if (campoArquivoEnt) {
        campoArquivoEnt.maxSize = 20971520 // 20 MB
        app.save(entregaveisCol)
      }
    } catch (_) {}

    try {
      const projetosCol = app.findCollectionByNameOrId('projetos')
      const campoAnexoProj = projetosCol.fields.getByName('anexo_autorizacao')
      if (campoAnexoProj) {
        campoAnexoProj.maxSize = 10485760 // 10 MB
        app.save(projetosCol)
      }
    } catch (_) {}
  },
)
