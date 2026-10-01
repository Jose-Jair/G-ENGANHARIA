// Hook to guard inactivation (only admin can move to inativa or update an inativa status)
// and automatic suggested reactivation generation when a new active contract is added to an inactive/nutricao company

onRecordUpdateRequest((e) => {
  try {
    const auth = e.auth
    if (!auth) return e.next()

    const role = auth.getString('role')
    const original = e.record.original()
    const newEtapa = e.record.getString('etapa_funil')
    const oldEtapa = original ? original.getString('etapa_funil') : ''
    const newStatus = e.record.getString('status')
    const oldStatus = original ? original.getString('status') : ''

    // Se estiver tentando inativar (etapa_funil = 'inativa' ou status = 'inativa') e o usuário não for admin
    const tryingToInactivate =
      (newEtapa === 'inativa' && oldEtapa !== 'inativa') ||
      (newStatus === 'inativa' && oldStatus !== 'inativa')

    if (tryingToInactivate && role !== 'admin') {
      throw new ForbiddenError(
        'Apenas administradores podem inativar empresas no funil de intermediação.',
      )
    }

    // Se estiver mudando de etapa, registrar no campo etapa_anterior para permitir restauração
    if (newEtapa && oldEtapa && newEtapa !== oldEtapa && newEtapa === 'inativa') {
      e.record.set('etapa_anterior', oldEtapa)
    }
  } catch (err) {
    throw err
  }

  e.next()
}, 'empresas')

// Hook on contratos creation: if empresa is in 'nutricao_mensal' or 'inativa', create reativacao_sugerida
onRecordAfterCreateSuccess((e) => {
  try {
    const contrato = e.record
    const empresaId = contrato.getString('empresa')
    if (!empresaId) return

    const empresa = $app.findRecordById('empresas', empresaId)
    if (!empresa) return

    const etapa = empresa.getString('etapa_funil')
    const status = empresa.getString('status')

    if (etapa === 'nutricao_mensal' || etapa === 'inativa' || status === 'inativa') {
      const reativacoesCol = $app.findCollectionByNameOrId('reativacoes_sugeridas')
      const reatRec = new Record(reativacoesCol)

      reatRec.set('empresa', empresa.id)
      reatRec.set('contrato', contrato.id)
      reatRec.set('contrato_numero', contrato.getString('numero') || '')
      reatRec.set('contrato_orgao', contrato.getString('orgao') || '')
      reatRec.set('contrato_valor', contrato.getFloat('valor') || 0)
      reatRec.set('etapa_origem', etapa || status || 'nutricao_mensal')
      reatRec.set('status', 'pendente')

      $app.save(reatRec)
    }
  } catch (err) {
    console.log('Erro ao processar sugestao de reativacao por novo contrato: ' + err)
  }
}, 'contratos')
