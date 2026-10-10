/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Migração de Verificação de Integridade e Contagens Pós-Limpeza 0080
    const tabelasNegocio = [
      'contas',
      'medicoes',
      'avaliacoes_executor',
      'avaliacoes',
      'entregaveis',
      'documentos',
      'riscos',
      'cotacoes',
      'subcontratos',
      'projeto_etapas',
      'projetos',
      'grupos_projetos',
      'contratos_servico',
      'proposta_parcelas',
      'proposta_itens',
      'propostas',
      'campanha_envios',
      'campanhas',
      'toques',
      'reativacoes_sugeridas',
      'sugestoes_funil',
      'contratos',
      'contatos',
      'empresas',
      'clientes_pf',
      'executores',
    ]

    for (let i = 0; i < tabelasNegocio.length; i++) {
      const t = tabelasNegocio[i]
      let count = 0
      try {
        count = app.countRecords(t)
      } catch (err) {
        throw new Error('Falha ao contar tabela ' + t + ': ' + err)
      }
      if (count !== 0) {
        throw new Error(
          'Falha de verificação: a tabela ' + t + ' ainda possui ' + count + ' registros!',
        )
      }
    }

    // Verificar integridade das coleções preservadas
    const totalUsers = app.countRecords('users')
    if (totalUsers < 6) {
      throw new Error('Falha de verificação: usuários foram afetados! Total: ' + totalUsers)
    }

    const recsCat = app.findRecordsByFilter('catalogo_servicos', 'ativo = true', '', 50, 0)
    if (recsCat.length !== 7) {
      throw new Error(
        'Falha de verificação: catálogo de serviços alterado! Total ativos: ' + recsCat.length,
      )
    }

    const totalParam = app.countRecords('parametros')
    if (totalParam === 0) {
      throw new Error('Falha de verificação: parâmetros foram apagados!')
    }

    const totalAreas = app.countRecords('areas_atuacao')
    if (totalAreas === 0) {
      throw new Error('Falha de verificação: áreas de atuação foram apagadas!')
    }

    // Verificar audit_logs: deve ter registros históricos e o evento da migração 0080
    const recsAudit = app.findRecordsByFilter(
      'audit_logs',
      "acao = 'LIMPEZA_COMPLETA_TESTE_ZERO'",
      '-created',
      5,
      0,
    )
    if (recsAudit.length === 0) {
      throw new Error('Falha de verificação: evento de auditoria da limpeza não encontrado!')
    }
  },
  (app) => {},
)
