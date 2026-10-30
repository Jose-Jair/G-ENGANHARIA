/**
 * Configuração e constantes para o mecanismo de limpeza de dados de negócio do GESTÃO G+.
 * Permite revisão transparente das tabelas a serem limpas, ordem de dependência e tabelas estritamente preservadas.
 */

export const FRASE_CONFIRMACAO_LIMPEZA = 'APAGAR DADOS DE NEGÓCIO'

export interface ColecaoLimpezaItem {
  colecao: string
  label: string
  descricao: string
}

export interface ColecaoPreservadaItem {
  colecao: string
  label: string
  motivo: string
}

/**
 * Ordem estrita de deleção respeitando dependências estrangeiras no PocketBase (SQLite).
 * Dependências mais profundas (filhos/mensagens/eventos/versões) são removidas primeiro.
 */
export const COLECOES_NEGOCIO_ORDEM_LIMPEZA: readonly ColecaoLimpezaItem[] = [
  // 1. Mensagens, notificações operacionais e eventos de cobrança
  {
    colecao: 'entregavel_comentarios',
    label: 'Comentários de Entregáveis',
    descricao: 'Interações e comentários em versões de entregáveis',
  },
  {
    colecao: 'mensagens_os',
    label: 'Mensagens por OS',
    descricao: 'Canal de comunicação interno/prestador de ordens de serviço',
  },
  {
    colecao: 'eventos_cobranca',
    label: 'Eventos de Cobrança de Prazos',
    descricao: 'Disparos e régua de cobrança automática por OS e entregáveis',
  },
  {
    colecao: 'notificacoes',
    label: 'Notificações Operacionais',
    descricao: 'Alertas e avisos operacionais de OS, entregáveis e prazos',
  },
  {
    colecao: 'resumos_diarios_gestor',
    label: 'Resumos Diários do Gestor',
    descricao: 'Snapshots diários consolidados da operação',
  },

  // 2. Projeções e portais temporários de prestador
  {
    colecao: 'portal_entregaveis',
    label: 'Portal: Entregáveis',
    descricao: 'Registros de visualização do portal do prestador',
  },
  {
    colecao: 'portal_documentos',
    label: 'Portal: Documentos',
    descricao: 'Documentos espelhados no portal do prestador',
  },
  {
    colecao: 'portal_os',
    label: 'Portal: Ordens de Serviço',
    descricao: 'Espelhos de OS disponibilizadas no portal do prestador',
  },

  // 3. Versões de entregáveis e arquivos
  {
    colecao: 'entregaveis_versoes',
    label: 'Versões de Entregáveis',
    descricao: 'Histórico de versões de arquivos submetidos e avaliados',
  },
  {
    colecao: 'entregaveis',
    label: 'Entregáveis',
    descricao: 'Entregáveis vinculados a etapas e ordens de serviço',
  },

  // 4. Medições e Avaliações de execução
  {
    colecao: 'medicoes',
    label: 'Medições de Projetos/OS',
    descricao: 'Boletins de medição progressiva e faturamento de prestadores',
  },
  {
    colecao: 'avaliacoes_executor',
    label: 'Avaliações de Executores',
    descricao: 'Notas de prazo, qualidade e comunicação dos prestadores',
  },
  {
    colecao: 'avaliacoes',
    label: 'Avaliações Legadas',
    descricao: 'Avaliações antigas de etapas e executores',
  },

  // 5. Ordens de Serviço e Subcontratos
  {
    colecao: 'ordens_servico',
    label: 'Ordens de Serviço (OS)',
    descricao: 'Ordens de serviço internas e externas com prestadores',
  },
  {
    colecao: 'contratos_mestre',
    label: 'Contratos Mestre de Prestadores',
    descricao: 'Minutas e contratos quadro assinados com prestadores',
  },
  {
    colecao: 'subcontratos',
    label: 'Subcontratos',
    descricao: 'Contratos e subcontratos com executores e prestadores',
  },
  {
    colecao: 'cotacoes',
    label: 'Cotações de Prestadores',
    descricao: 'Rodadas de cotação automáticas e manuais para pacotes/etapas',
  },

  // 6. Estrutura de Execução dos Projetos
  {
    colecao: 'documentos',
    label: 'Documentos Técnicos (ART/RRT/OS)',
    descricao: 'Anotações de responsabilidade técnica e anexos de projetos',
  },
  {
    colecao: 'riscos',
    label: 'Matriz de Riscos de Projetos',
    descricao: 'Apontamento de riscos e planos de mitigação',
  },
  {
    colecao: 'projeto_etapas',
    label: 'Etapas e Pacotes de Trabalho',
    descricao: 'Marcos, etapas e pacotes de trabalho dos projetos',
  },
  {
    colecao: 'grupos_projetos',
    label: 'Grupos de Projetos',
    descricao: 'Agrupamentos contratuais de projetos vinculados',
  },
  {
    colecao: 'projetos',
    label: 'Projetos de Engenharia',
    descricao: 'Projetos em andamento, contratados ou concluídos',
  },

  // 7. Financeiro de negócio (contas a receber e pagar geradas pela esteira)
  {
    colecao: 'contas',
    label: 'Contas a Receber e a Pagar',
    descricao: 'Lançamentos financeiros de clientes, parceiros e prestadores',
  },

  // 8. Contratos de Serviço e Propostas Comerciais
  {
    colecao: 'contratos_servico',
    label: 'Contratos de Serviço (G+)',
    descricao: 'Contratos emitidos para parceiros e clientes',
  },
  {
    colecao: 'proposta_parcelas',
    label: 'Parcelas de Propostas',
    descricao: 'Condições de pagamento e parcelamento comercial',
  },
  {
    colecao: 'proposta_itens',
    label: 'Itens de Proposta Comercial',
    descricao: 'Composição analítica de serviços e BDI das propostas',
  },
  {
    colecao: 'propostas',
    label: 'Propostas Comerciais',
    descricao: 'Propostas emitidas, aprovadas, em negociação e aceitas',
  },

  // 9. Campanhas de Nutrição e Cadência Comercial
  {
    colecao: 'campanha_envios',
    label: 'Envios de Campanhas',
    descricao: 'Disparos e histórico de aberturas/cliques de campanhas',
  },
  {
    colecao: 'campanhas',
    label: 'Campanhas de Nutrição',
    descricao: 'Campanhas de e-mail e réguas de nutrição comercial',
  },
  {
    colecao: 'toques',
    label: 'Toques de Cadência',
    descricao: 'Agendamentos e registros de contato com leads/empresas',
  },
  {
    colecao: 'reativacoes_sugeridas',
    label: 'Reativações Sugeridas',
    descricao: 'Sugestões de reativação de clientes/contratos inativos',
  },
  {
    colecao: 'sugestoes_funil',
    label: 'Sugestões do Funil (PNCP/Planilhas)',
    descricao: 'Contratos públicos e oportunidades capturadas para análise',
  },
  {
    colecao: 'contratos',
    label: 'Contratos Públicos dos Parceiros',
    descricao: 'Contratos licitados monitorados para geração de demanda',
  },
  {
    colecao: 'contatos',
    label: 'Contatos de Empresas/Leads',
    descricao: 'Pessoas de contato vinculadas às empresas do funil comercial',
  },
] as const

/**
 * Tabelas e cadastros que NUNCA podem ser apagados pelo mecanismo de negócio.
 * Preservam a fundação do sistema, credenciais, segurança, catálogos e histórico de auditoria.
 */
export const COLECOES_PRESERVADAS: readonly ColecaoPreservadaItem[] = [
  {
    colecao: 'users',
    label: 'Usuários e Perfis de Acesso',
    motivo:
      'Credenciais de login, senhas com hash e papéis (Admin, Comercial, Gestor, Financeiro, Executor).',
  },
  {
    colecao: 'audit_logs',
    label: 'Auditoria Imutável',
    motivo:
      'Rastreabilidade jurídica total de ações realizadas no sistema; histórico nunca é expurgado.',
  },
  {
    colecao: 'empresas',
    label: 'Empresas e Clientes PJ',
    motivo: 'Cadastros mestres de empresas parceiras e demandantes.',
  },
  {
    colecao: 'clientes_pf',
    label: 'Clientes Pessoa Física (PF)',
    motivo: 'Cadastros mestres com consentimento LGPD de clientes pessoa física.',
  },
  {
    colecao: 'prestadores',
    label: 'Prestadores de Serviço',
    motivo: 'Cadastro institucional, dados bancários e capacidade de atendimento dos prestadores.',
  },
  {
    colecao: 'profissionais_prestador',
    label: 'Profissionais Técnicos de Prestadores',
    motivo: 'RTs e profissionais habilitados vinculados aos prestadores.',
  },
  {
    colecao: 'executores',
    label: 'Executores Homologados',
    motivo: 'Cadastro mestre de engenheiros e técnicos parceiros homologados.',
  },
  {
    colecao: 'catalogo_servicos',
    label: 'Catálogo de Serviços de Engenharia',
    motivo: 'Serviços cadastrados com preços-base, BDI e unidades de medida.',
  },
  {
    colecao: 'catalogo_escopos',
    label: 'Catálogo de Escopos Técnicos',
    motivo: 'Escopos padrão de engenharia e checklists de revisão técnica.',
  },
  {
    colecao: 'areas_atuacao',
    label: 'Áreas de Atuação',
    motivo: 'Estrutura de áreas de engenharia (Civil, Elétrica, Mecânica etc.).',
  },
  {
    colecao: 'subservicos',
    label: 'Subserviços Técnicos',
    motivo: 'Subdivisões de serviços por disciplina técnica.',
  },
  {
    colecao: 'entregaveis_padrao',
    label: 'Entregáveis Padrão',
    motivo: 'Modelos de entregáveis por disciplina e subserviço.',
  },
  {
    colecao: 'parametros',
    label: 'Parâmetros da Administração',
    motivo: 'Chaves de IA, alçadas financeiras, prazos de estagnação e configurações do sistema.',
  },
  {
    colecao: 'modelos',
    label: 'Modelos de Texto e Proposta',
    motivo: 'Templates institucionais de e-mail, minutas e propostas comerciais.',
  },
  {
    colecao: 'motivos',
    label: 'Motivos de Inativação / Recusa',
    motivo: 'Listas padronizadas de motivos cadastrados pela Administração.',
  },
  {
    colecao: 'nao_contatar',
    label: 'Lista "Não Contatar" (LGPD)',
    motivo: 'Opt-out e preferências de privacidade de titulares protegidos pela LGPD.',
  },
] as const

/**
 * Validador estrito para uso no frontend e em testes unitários
 */
export function validarFraseConfirmacao(fraseDigitada: string): boolean {
  if (typeof fraseDigitada !== 'string') return false
  return fraseDigitada.trim() === FRASE_CONFIRMACAO_LIMPEZA
}

/**
 * Verifica se uma coleção faz parte da lista de preservação obrigatória
 */
export function isColecaoPreservada(nomeColecao: string): boolean {
  return COLECOES_PRESERVADAS.some((item) => item.colecao === nomeColecao)
}
