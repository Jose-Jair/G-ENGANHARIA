/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const parametrosCollection = app.findCollectionByNameOrId('parametros')

    // 1. Garantir que o parâmetro chave "texto_padrao_whatsapp_contrato" ou "contrato_servico_texto_whatsapp" exista
    const chavesParaCriar = [
      {
        chave: 'texto_padrao_whatsapp_contrato',
        valor:
          'Olá, {nome}! Agradecemos a aprovação da proposta comercial {numero_proposta}. O Contrato de Prestação de Serviços Técnicos {numero_contrato} já foi aprovado e assinado digitalmente pela Diretoria da G+ Engenharia. Para sua comodidade e segurança jurídica, disponibilizamos o link exclusivo para assinatura eletrônica: {link_contrato}',
        descricao:
          'Texto padrão configurável para envio do link de assinatura eletrônica do contrato de prestação de serviços via WhatsApp ({nome}, {numero_contrato}, {numero_proposta}, {link_contrato}).',
      },
      {
        chave: 'contrato_servico_texto_whatsapp',
        valor:
          'Olá, {nome}! O Contrato de Prestação de Serviços Técnicos {numero_contrato} já está disponível para sua assinatura eletrônica através do link seguro: {link_contrato}',
        descricao:
          'Mensagem padrão simplificada para envio do link do contrato de serviço ao cliente via WhatsApp.',
      },
    ]

    for (const item of chavesParaCriar) {
      try {
        const existing = app.findFirstRecordByFilter('parametros', `chave = '${item.chave}'`)
        if (existing) {
          // Já existe, não sobrescreve valor se customizado
        }
      } catch (err) {
        // Não encontrado -> criar
        try {
          const record = new Record(parametrosCollection)
          record.set('chave', item.chave)
          record.set('valor', item.valor)
          record.set('descricao', item.descricao)
          app.save(record)
        } catch (saveErr) {
          // Ignorar se já salvo concorrentemente
        }
      }
    }
  },
  (app) => {
    // Rollback opcional
  },
)
