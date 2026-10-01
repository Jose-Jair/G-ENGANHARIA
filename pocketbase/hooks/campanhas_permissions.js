// Hooks de Segurança e Regras de Negócio para Campanhas de Nutrição Mensal (Etapa 5)
// 1. Guardião de Permissão no Banco (onRecordUpdateRequest para 'campanhas'):
//    - Comercial pode editar campos de rascunho (nome, segmento, template, assunto, corpo)
//    - Comercial NÃO pode aprovar (status -> 'aprovada'), agendar (data_envio), devolver (status -> 'devolvida') ou marcar enviada
//    - Apenas Admin pode aprovar, agendar ou devolver campanhas
// 2. Bloqueio de envio para Parceiras ou Em Conversa (verificado no hook e antes do envio)

onRecordUpdateRequest((e) => {
  try {
    const auth = e.auth
    const role = auth ? auth.getString('role') : ''
    const original = e.record.original()
    const oldStatus = original ? original.getString('status') : 'rascunho'
    const newStatus = e.record.getString('status')
    const oldDataEnvio = original ? original.getString('data_envio') : ''
    const newDataEnvio = e.record.getString('data_envio')

    // Se houve mudança de status ou de agendamento:
    const statusChanged = oldStatus !== newStatus
    const dataEnvioChanged = oldDataEnvio !== newDataEnvio

    if (role !== 'admin') {
      // Se não for admin, não pode aprovar, agendar nem devolver
      if (
        statusChanged &&
        (newStatus === 'aprovada' || newStatus === 'agendada' || newStatus === 'devolvida')
      ) {
        throw new ForbiddenError(
          'Apenas Administradores têm permissão para aprovar, agendar ou devolver campanhas.',
        )
      }

      if (dataEnvioChanged && newDataEnvio) {
        throw new ForbiddenError(
          'Apenas Administradores podem definir ou alterar a data de agendamento de campanhas.',
        )
      }
    }
  } catch (err) {
    throw err
  }

  e.next()
}, 'campanhas')
