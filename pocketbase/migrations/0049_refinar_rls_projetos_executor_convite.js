migrate(
  (app) => {
    const projetosCol = app.findCollectionByNameOrId('projetos')
    const etapasCol = app.findCollectionByNameOrId('projeto_etapas')
    const entregaveisCol = app.findCollectionByNameOrId('entregaveis')
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    // 1. Atualizar regras de RLS de projetos:
    // O executor logado pode visualizar dados básicos dos projetos onde foi contratado (via subcontrato)
    // OU onde possui convite/cotação enviada para ele (via cotacoes)
    projetosCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= id && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= id && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    projetosCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= id && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= id && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    app.save(projetosCol)

    // 2. Atualizar etapas e entregaveis também com suporte tanto a subcontrato quanto a cotações
    etapasCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= projeto && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= projeto && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    etapasCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= projeto && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= projeto && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    app.save(etapasCol)

    entregaveisCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= etapa.projeto && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= etapa.projeto && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    entregaveisCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'financeiro' || @request.auth.role = 'comercial' || (@request.auth.role = 'executor' && ((@collection.subcontratos.projeto ?= etapa.projeto && @collection.subcontratos.executor.email ?= @request.auth.email) || (@collection.cotacoes.projeto ?= etapa.projeto && @collection.cotacoes.executor.email ?= @request.auth.email))))"
    app.save(entregaveisCol)

    // Auditoria
    try {
      const a = new Record(auditCol)
      a.set('acao', 'AJUSTE_RLS_EXECUTOR_CONVITES')
      a.set('entidade', 'sistema')
      a.set('registro_id', 'bloco6_rls_refinamento')
      a.set('detalhes', {
        mensagem:
          'RLS de projetos, etapas e entregaveis refinado para contemplar tanto executores com subcontrato contratado quanto com convites de cotação abertos.',
      })
      app.save(a)
    } catch (_) {}
  },
  (app) => {
    // Reverter regras se necessário
  },
)
