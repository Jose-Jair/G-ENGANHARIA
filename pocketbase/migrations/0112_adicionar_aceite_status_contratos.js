// pocketbase/migrations/0112_adicionar_aceite_status_contratos.js
// =============================================================================
// GESTÃO G+ — MIGRAÇÃO 0112: ADICIONAR CAMPO aceite_status EM CONTRATOS
// Adiciona o campo aceite_status (SelectField: pendente, aceito, recusado)
// nas coleções contratos_mestre e contratos_servico para conformidade do Item 8
// do Selfcheck de Segurança com o padrão de ordens_servico.
// Migração aditiva e idempotente: zero alteração/exclusão de dados existentes.
// =============================================================================

migrate(
  (app) => {
    // 1. Atualizar coleção contratos_mestre
    try {
      const cmCol = app.findCollectionByNameOrId('contratos_mestre')
      if (!cmCol.fields.getByName('aceite_status')) {
        cmCol.fields.add(
          new SelectField({
            name: 'aceite_status',
            values: ['pendente', 'aceito', 'recusado'],
            maxSelect: 1,
          }),
        )
        app.save(cmCol)
        console.log('Migração 0112: campo aceite_status adicionado em contratos_mestre')
      } else {
        console.log('Migração 0112: campo aceite_status já existia em contratos_mestre')
      }
    } catch (eCm) {
      console.log('Erro ao atualizar campo aceite_status em contratos_mestre na 0112: ' + eCm)
      throw eCm
    }

    // 2. Atualizar coleção contratos_servico
    try {
      const csCol = app.findCollectionByNameOrId('contratos_servico')
      if (!csCol.fields.getByName('aceite_status')) {
        csCol.fields.add(
          new SelectField({
            name: 'aceite_status',
            values: ['pendente', 'aceito', 'recusado'],
            maxSelect: 1,
          }),
        )
        app.save(csCol)
        console.log('Migração 0112: campo aceite_status adicionado em contratos_servico')
      } else {
        console.log('Migração 0112: campo aceite_status já existia em contratos_servico')
      }
    } catch (eCs) {
      console.log('Erro ao atualizar campo aceite_status em contratos_servico na 0112: ' + eCs)
      throw eCs
    }
  },
  (app) => {
    // Reversão não-destrutiva — preserva integridade do banco
  },
)
