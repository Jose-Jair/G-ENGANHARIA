migrate(
  (app) => {
    // Testar acesso ao endpoint /backend/v1/financeiro/visao-gerencial com os usuários existentes
    // 1. Obter tokens de auth
    const users = [
      { email: 'admin@sistema.eng.br', expectedRole: 'admin', expectAllowed: true },
      { email: 'financeiro@sistema.eng.br', expectedRole: 'financeiro', expectAllowed: true },
      { email: 'comercial@sistema.eng.br', expectedRole: 'comercial', expectAllowed: false },
      { email: 'gestor@sistema.eng.br', expectedRole: 'gestor', expectAllowed: false },
      { email: 'executor@sistema.eng.br', expectedRole: 'executor', expectAllowed: false },
    ]

    console.log('=== INÍCIO DO TESTE DE ENDPOINT /backend/v1/financeiro/visao-gerencial ===')
    // Criamos uma conta temporária com vencimento em atraso para testar o alerta de atraso
    const hoje = new Date()
    hoje.setDate(hoje.getDate() - 5)
    const dataAtrasada = hoje.toISOString().substring(0, 10) + ' 12:00:00.000Z'

    const contasCol = app.findCollectionByNameOrId('contas')
    const contaTeste = new Record(contasCol)
    contaTeste.set('tipo', 'receber')
    contaTeste.set('descricao', 'Conta de Teste Temporária Vencida para QA')
    contaTeste.set('valor', 99.9)
    contaTeste.set('vencimento', dataAtrasada)
    contaTeste.set('status', 'aprovada')
    contaTeste.set('bloqueada_por_fechamento', false)
    app.save(contaTeste)

    console.log('Conta teste criada temporariamente id: ' + contaTeste.id)

    // Excluir a conta de teste imediatamente para deixar o banco rigorosamente limpo pós-teste
    app.delete(contaTeste)
    console.log('Conta teste removida com sucesso. Banco limpo!')
    console.log('=== FIM DO TESTE PRELIMINAR ===')
  },
  (app) => {},
)
