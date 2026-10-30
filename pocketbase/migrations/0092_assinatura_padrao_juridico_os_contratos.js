// pocketbase/migrations/0092_assinatura_padrao_juridico_os_contratos.js
// =============================================================================
// GESTÃO G+ — MIGRAÇÃO 0092: PADRÃO JURÍDICO ÚNICO E ASSINATURA PRÉVIA DA OS
// Nivelamento da assinatura eletrônica entre OS Externa, Contrato-Mestre, NDA e
// Contrato de Serviço GMAIS:
// - Código OTP de 6 dígitos com hash, expiração de 10 min e limite de tentativas
// - Congelamento do PDF e gravação do hash SHA-256
// - Dossiê de evidências estruturado (IP, UTC, user-agent, e-mail, versão)
// - Aceite simples para OS interna (sem código e sem camada financeira)
// - Projeção atualizada no portal_os
// =============================================================================

migrate(
  (app) => {
    // 1. Atualizar coleção ordens_servico
    try {
      const osCol = app.findCollectionByNameOrId('ordens_servico')
      const fieldsToAddOs = [
        { name: 'aceite_status', type: 'select', values: ['pendente', 'aceito', 'recusado'] },
        { name: 'codigo_verificacao_hash', type: 'text' },
        { name: 'codigo_expiracao', type: 'date' },
        { name: 'codigo_tentativas', type: 'number' },
        { name: 'codigo_enviado_para', type: 'text' },
        { name: 'data_aceite', type: 'date' },
        { name: 'aceite_ip', type: 'text' },
        { name: 'aceite_user_agent', type: 'text' },
        { name: 'pdf_congelado_hash', type: 'text' },
        { name: 'versao_texto_aceito', type: 'text' },
        { name: 'versao_texto_hash', type: 'text' },
        { name: 'dossie_evidencias_json', type: 'json' },
        { name: 'confirmacao_email_enviada', type: 'bool' },
        { name: 'confirmacao_email_log', type: 'text' },
      ]

      let alterouOs = false
      for (let i = 0; i < fieldsToAddOs.length; i++) {
        const item = fieldsToAddOs[i]
        if (!osCol.fields.getByName(item.name)) {
          if (item.type === 'select') {
            osCol.fields.add(
              new SelectField({
                name: item.name,
                values: item.values,
                maxSelect: 1,
              }),
            )
          } else if (item.type === 'number') {
            osCol.fields.add(new NumberField({ name: item.name }))
          } else if (item.type === 'date') {
            osCol.fields.add(new DateField({ name: item.name }))
          } else if (item.type === 'bool') {
            osCol.fields.add(new BoolField({ name: item.name }))
          } else if (item.type === 'json') {
            osCol.fields.add(new JSONField({ name: item.name }))
          } else {
            osCol.fields.add(new TextField({ name: item.name }))
          }
          alterouOs = true
        }
      }

      if (alterouOs) {
        app.save(osCol)
      }
    } catch (eOs) {
      console.log('Erro ao atualizar campos de ordens_servico na 0092: ' + eOs)
    }

    // 2. Atualizar coleção contratos_mestre
    try {
      const cmCol = app.findCollectionByNameOrId('contratos_mestre')
      const fieldsToAddCm = [
        { name: 'codigo_verificacao_hash', type: 'text' },
        { name: 'codigo_expiracao', type: 'date' },
        { name: 'codigo_tentativas', type: 'number' },
        { name: 'codigo_enviado_para', type: 'text' },
        { name: 'pdf_congelado_hash', type: 'text' },
        { name: 'versao_texto_aceito', type: 'text' },
        { name: 'versao_texto_hash', type: 'text' },
        { name: 'dossie_evidencias_json', type: 'json' },
        { name: 'confirmacao_email_enviada', type: 'bool' },
        { name: 'confirmacao_email_log', type: 'text' },
      ]

      let alterouCm = false
      for (let i = 0; i < fieldsToAddCm.length; i++) {
        const item = fieldsToAddCm[i]
        if (!cmCol.fields.getByName(item.name)) {
          if (item.type === 'number') {
            cmCol.fields.add(new NumberField({ name: item.name }))
          } else if (item.type === 'date') {
            cmCol.fields.add(new DateField({ name: item.name }))
          } else if (item.type === 'bool') {
            cmCol.fields.add(new BoolField({ name: item.name }))
          } else if (item.type === 'json') {
            cmCol.fields.add(new JSONField({ name: item.name }))
          } else {
            cmCol.fields.add(new TextField({ name: item.name }))
          }
          alterouCm = true
        }
      }

      if (alterouCm) {
        app.save(cmCol)
      }
    } catch (eCm) {
      console.log('Erro ao atualizar campos de contratos_mestre na 0092: ' + eCm)
    }

    // 3. Atualizar coleção contratos_servico
    try {
      const csCol = app.findCollectionByNameOrId('contratos_servico')
      const fieldsToAddCs = [
        { name: 'codigo_verificacao_hash', type: 'text' },
        { name: 'codigo_expiracao', type: 'date' },
        { name: 'codigo_tentativas', type: 'number' },
        { name: 'codigo_enviado_para', type: 'text' },
        { name: 'pdf_congelado_hash', type: 'text' },
        { name: 'versao_texto_aceito', type: 'text' },
        { name: 'versao_texto_hash', type: 'text' },
        { name: 'dossie_evidencias_json', type: 'json' },
        { name: 'confirmacao_email_enviada', type: 'bool' },
        { name: 'confirmacao_email_log', type: 'text' },
      ]

      let alterouCs = false
      for (let i = 0; i < fieldsToAddCs.length; i++) {
        const item = fieldsToAddCs[i]
        if (!csCol.fields.getByName(item.name)) {
          if (item.type === 'number') {
            csCol.fields.add(new NumberField({ name: item.name }))
          } else if (item.type === 'date') {
            csCol.fields.add(new DateField({ name: item.name }))
          } else if (item.type === 'bool') {
            csCol.fields.add(new BoolField({ name: item.name }))
          } else if (item.type === 'json') {
            csCol.fields.add(new JSONField({ name: item.name }))
          } else {
            csCol.fields.add(new TextField({ name: item.name }))
          }
          alterouCs = true
        }
      }

      if (alterouCs) {
        app.save(csCol)
      }
    } catch (eCs) {
      console.log('Erro ao atualizar campos de contratos_servico na 0092: ' + eCs)
    }

    // 4. Atualizar coleção portal_os (campos seguros para o portal do prestador)
    try {
      const posCol = app.findCollectionByNameOrId('portal_os')
      const fieldsToAddPos = [
        { name: 'aceite_status', type: 'text' },
        { name: 'pdf_congelado_hash', type: 'text' },
        { name: 'data_aceite', type: 'date' },
        { name: 'tipo_prestador', type: 'text' },
      ]

      let alterouPos = false
      for (let i = 0; i < fieldsToAddPos.length; i++) {
        const item = fieldsToAddPos[i]
        if (!posCol.fields.getByName(item.name)) {
          if (item.type === 'date') {
            posCol.fields.add(new DateField({ name: item.name }))
          } else {
            posCol.fields.add(new TextField({ name: item.name }))
          }
          alterouPos = true
        }
      }

      if (alterouPos) {
        app.save(posCol)
      }
    } catch (ePos) {
      console.log('Erro ao atualizar campos de portal_os na 0092: ' + ePos)
    }

    // 5. Parâmetro geral da Cláusula Padrão de Assinatura Eletrônica (se não existir)
    try {
      const paramCol = app.findCollectionByNameOrId('parametros')
      const clausulaPadrao =
        'CLÁUSULA DE ACEITE DE ASSINATURA ELETRÔNICA: As partes declaram e reconhecem expressamente a validade, integridade e eficácia jurídica desta contratação formalizada por meio eletrônico, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020, admitindo como válidas as assinaturas eletrônicas emitidas mediante verificação de código OTP de 6 dígitos enviado por e-mail, registro de endereço IP, user-agent, carimbo de tempo UTC e hash criptográfico SHA-256 do documento congelado.'

      const existeParam = app.findRecordsByFilter(
        'parametros',
        "chave = 'clausula_assinatura_eletronica_padrao'",
        '',
        1,
        0,
      )

      if (existeParam.length === 0) {
        const pRec = new Record(paramCol)
        pRec.set('chave', 'clausula_assinatura_eletronica_padrao')
        pRec.set('valor', clausulaPadrao)
        pRec.set(
          'descricao',
          'Cláusula jurídica padrão de aceite eletrônico MP 2.200-2/2001 e Lei 14.063/2020',
        )
        app.save(pRec)
      }
    } catch (eParam) {
      console.log('Erro ao criar parâmetro de cláusula padrão na 0092: ' + eParam)
    }
  },
  (app) => {
    // Reversão não-destrutiva
  },
)
