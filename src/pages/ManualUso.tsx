import React, { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole, ROLE_LABELS } from '@/types'
import { GPlusLogo } from '@/components/GPlusLogo'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  Search,
  Kanban,
  CalendarCheck,
  Megaphone,
  Handshake,
  UserCheck,
  FileText,
  Briefcase,
  HardHat,
  DollarSign,
  LayoutDashboard,
  Download,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  Award,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react'

// Interface de um capítulo do manual
interface CapituloManual {
  id: string
  titulo: string
  subtitulo: string
  icone: React.ElementType
  corIcone: string
  /** Perfis autorizados a ver este capítulo */
  perfisPermitidos: UserRole[]
  descricao: string
  passos: {
    titulo: string
    descricao: string
    dica?: string
  }[]
  regrasAutomaticas?: string[]
}

// Lista de capítulos do manual de uso da plataforma GESTÃO G+
const CAPITULOS_MANUAL: CapituloManual[] = [
  {
    id: 'visao-geral',
    titulo: 'Visão Geral & Fluxo Integrado',
    subtitulo: 'Ciclo completo: Prospect → Cadência → Proposta → Projeto → Finanças',
    icone: Layers,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'A GESTÃO G+ é uma plataforma especializada na intermediação de demandas de engenharia entre Parceiros Demandantes (portadores de atas/contratos públicos e privados) e Executores Especialistas credenciados. O sistema opera em fluxo contínuo e integrado.',
    passos: [
      {
        titulo: '1. Entrada de Prospects & Extração PNCP',
        descricao:
          'Empresas portadoras de contratos públicos são cadastradas manualmente ou capturadas via PNCP (Portal Nacional de Contratações Públicas). O sistema aplica a classificação Curva ABC com cortes Pareto em tempo real.',
        dica: 'Acesse a "Fila de Sugestões" para avaliar compras públicas recém-publicadas e transformá-las em potenciais parcerias.',
      },
      {
        titulo: '2. Cadência de Prospecção & Nutrição LGPD',
        descricao:
          'O time comercial aciona contatos via WhatsApp, ligação e e-mail em cadência estruturada (D0 a D30). Todo e-mail dispara com token seguro de descadastro LGPD (Art. 18 Lei 13.709/2018) e respeita a lista definitiva "Não Contatar".',
      },
      {
        titulo: '3. Proposta Técnica & Aprovação Interna',
        descricao:
          'Ao identificar demanda concreta, elabora-se a proposta comercial com código único PROP-AAAA-NNNN. A margem é calculada automaticamente. Propostas com margem abaixo da alçada mínima de 25% exigem deferimento exclusivo do Admin.',
      },
      {
        titulo: '4. Aceite Digital pelo Cliente',
        descricao:
          'O cliente recebe um link público seguro (/proposta/:token). Ao clicar em "Aceitar Proposta", o sistema registra data/hora, IP e auditoria, formalizando o aceite sem necessidade de login.',
      },
      {
        titulo: '5. Operação de Engenharia & Executores',
        descricao:
          'Com a proposta aceita, o Gestor de Projetos abre o projeto operacional (PROJ-AAAA-NNNN), define o cronograma de etapas e dispara cotações com token seguro para os executores da disciplina (orçamentistas, projetistas, calculistas).',
      },
      {
        titulo: '6. Faturamento & Controladoria Financeira',
        descricao:
          'O setor Financeiro gerencia o fluxo de caixa, emite contas a receber contra os parceiros conforme medições e programa o pagamento dos executores homologados.',
      },
    ],
    regrasAutomaticas: [
      'Auditoria server-side em todas as ações relevantes (quem, o quê, quando, IP).',
      'Row-Level Security (RLS) no PocketBase bloqueando leituras e gravações não autorizadas por perfil.',
      'Validação de links públicos via tokens criptográficos únicos e imutáveis.',
    ],
  },
  {
    id: 'funil',
    titulo: 'Módulo Funil Comercial',
    subtitulo: 'Gestão visual Kanban em 9 etapas e classificação Curva ABC',
    icone: Kanban,
    corIcone: 'text-sky-600',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Quadro visual em 9 etapas para acompanhamento ágil da esteira comercial: Identificada, Qualificada, Em Cadência, Em Conversa, Com Proposta Elaborada, Proposta Enviada, Parceira, Nutrição Mensal e Inativa.',
    passos: [
      {
        titulo: 'Navegação e filtros dinâmicos',
        descricao:
          'Filtre por Curva ABC (A, B ou C), UF/Estado, Responsável comercial e busca textual por Razão Social ou CNPJ.',
        dica: 'Empresas da Curva A (volume sob gestão ≥ R$ 5M) recebem destaque com badge dourada e prioridade na fila de toques.',
      },
      {
        titulo: 'Avançar etapa no Funil',
        descricao:
          'Abra o card da empresa para consultar os dados cadastrais, contatos e histórico. Mude a etapa através do seletor superior ou dos botões de ação recomendada.',
      },
      {
        titulo: 'Inativar empresa com motivo auditado',
        descricao:
          'Caso o lead decline da parceria, utilize a opção "Inativar Empresa" informando o motivo pré-cadastrado (perda de contrato, sem interesse, etc.). O sistema arquiva a empresa mantendo todo histórico preservado.',
      },
    ],
    regrasAutomaticas: [
      'Curva ABC por índice composto com cortes de Pareto: Classe A (80% do volume acumulado ou valor ≥ R$ 5M), Classe B (seguintes 15%) e Classe C (restante 5%).',
      'Inativação grava motivo e data no histórico de auditoria do sistema.',
    ],
  },
  {
    id: 'acoes-do-dia',
    titulo: 'Módulo Ações do Dia & Cadência',
    subtitulo: 'Agenda diária de toques operacionais por WhatsApp, Ligação e E-mail',
    icone: CalendarCheck,
    corIcone: 'text-amber-600',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Fila de tarefas automáticas gerada a partir das réguas de cadência das empresas ativas. Centraliza as ações agendadas para o dia e aponta atrasos para regularização imediata.',
    passos: [
      {
        titulo: 'Consultar tarefas de hoje',
        descricao:
          'Acesse "Ações do Dia". O painel agrupa toques divididos em: Para Hoje, Em Atraso e Futuros.',
      },
      {
        titulo: 'Executar toque via WhatsApp ou Ligação',
        descricao:
          'Clique no botão de WhatsApp para abrir o diálogo com o template sugerido pronto. Ao finalizar, clique em "Confirmar Toque" e insira o resumo do contato para liberar o próximo toque da régua.',
        dica: 'Você pode reagendar um toque caso o contato peça retorno em data específica.',
      },
      {
        titulo: 'Enviar e-mail de cadência',
        descricao:
          'Abra o modal de e-mail, selecione o modelo aprovado pelo Admin. O sistema preenche as tags {empresa}, {contato} e insere automaticamente o rodapé com link de descadastro seguro.',
      },
    ],
    regrasAutomaticas: [
      'Bloqueio automático de e-mail caso o endereço esteja na coleção "Não Contatar".',
      'Disparo de notificação visual no sininho da barra superior para toques com mais de 5 dias de atraso.',
    ],
  },
  {
    id: 'campanhas',
    titulo: 'Módulo Campanhas & Nutrição Mensal',
    subtitulo: 'Informativos técnicos recorrentes com aprovação e compliance LGPD',
    icone: Megaphone,
    corIcone: 'text-violet-600',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Disparo de comunicados mensais para empresas na etapa de Nutrição, visando manter a marca ativa e gerar novas oportunidades de projeto sem sobrecarregar a base.',
    passos: [
      {
        titulo: 'Criar campanha de nutrição',
        descricao:
          'Defina o título, o mês de referência, selecione os destinatários ou utilize a régua de carência (mínimo de 30 dias desde o último contato).',
      },
      {
        titulo: 'Submeter à aprovação do Admin',
        descricao:
          'Campanhas criadas pelo Comercial entram no estado "Rascunho". O Admin revisa o conteúdo, o número de destinatários e aprova o agendamento.',
        dica: 'O Admin recebe alerta no sininho superior com contador de campanhas pendentes.',
      },
      {
        titulo: 'Acompanhar métricas de envio',
        descricao:
          'Após o disparo, visualize os logs: entregues, erros de servidor e descadastros registrados.',
      },
    ],
    regrasAutomaticas: [
      'Filtro prévio obrigatório de remoção de qualquer e-mail presente na lista "Não Contatar".',
      'Inclusão forçada do token de descadastro em cada mensagem enviada.',
    ],
  },
  {
    id: 'parceiros',
    titulo: 'Módulo Parceiros Demandantes',
    subtitulo: 'Carteira de parceiros ativos, score de engajamento e alerta de inatividade',
    icone: Handshake,
    corIcone: 'text-emerald-600',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'Central de gestão das empresas que já fecharam parceria comercial. Inclui monitoramento de propostas em andamento, projetos executados e faturamento acumulado.',
    passos: [
      {
        titulo: 'Cadastrar novo parceiro ou converter lead',
        descricao:
          'Ao aprovar uma proposta no Funil, a empresa é promovida a "Parceira". Novos parceiros diretos podem ser criados informando CNPJ, razão social, contatos-chave e dados contratuais.',
      },
      {
        titulo: 'Análise de Score do Parceiro',
        descricao:
          'O sistema calcula o Score do Parceiro (0 a 100) ponderando volume de projetos, pontualidade no pagamento de faturas e recorrência de novas demandas.',
      },
      {
        titulo: 'Monitorar parceiros sem demanda (+180 dias)',
        descricao:
          'Parceiros sem novos projetos nos últimos 180 dias acionam um alerta no sininho da barra superior para que o Comercial promova uma aproximação estratégica.',
      },
    ],
    regrasAutomaticas: [
      'Perfis Financeiro e Gestor acessam a carteira em modo somente-leitura.',
      'Auditoria de qualquer edição nos dados fiscais ou bancários do parceiro.',
    ],
  },
  {
    id: 'clientes-pf',
    titulo: 'Módulo Clientes Pessoa Física (PF)',
    subtitulo: 'Demandas particulares, vistorias e laudos periciais de engenharia',
    icone: UserCheck,
    corIcone: 'text-cyan-600',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'Gestão de contratantes pessoas físicas para projetos residenciais, laudos de avaliação, vistorias cautelares e perícias judiciais de engenharia.',
    passos: [
      {
        titulo: 'Cadastrar Cliente PF',
        descricao:
          'Preencha nome completo, CPF validado pelo algoritmo oficial, telefones com indicador WhatsApp, e-mail e endereço com busca automática por CEP.',
      },
      {
        titulo: 'Vincular a Propostas e Projetos',
        descricao:
          'Ao elaborar propostas ou abrir projetos, selecione a opção "Pessoa Física" e vincule ao cadastro correspondente. Cadastros rápidos via proposta nascem como Pré-cadastro até o aceite.',
      },
      {
        titulo: 'Exclusão ou Anonimização LGPD (Exclusivo Administrador)',
        descricao:
          'Apenas usuários com perfil Administrador podem acionar o botão de exclusão, exigindo dupla confirmação digitando o nome exato do cliente. Se o cliente não possuir propostas vinculadas, o registro é excluído permanentemente (evento EXCLUSAO_CLIENTE_PF). Se possuir propostas vinculadas, o sistema executa a ANONIMIZAÇÃO LGPD: mantém o vínculo com o histórico fiscal/contratual, mas apaga CPF, telefones, e-mail e endereço, alterando o nome para "Cliente removido a pedido (LGPD)" (evento ANONIMIZACAO_CLIENTE_PF).',
      },
      {
        titulo: 'Filtro Opcional de Pré-cadastros',
        descricao:
          'Cadastros originados pela janela rápida da proposta ficam ocultos por padrão das listagens gerais e das métricas de topo. Administradores e Comerciais podem marcar o filtro "Incluir pré-cadastros" para inspecioná-los.',
      },
    ],
    regrasAutomaticas: [
      'Validação matemática estrita de CPF na criação e edição de registros.',
      'Exclusão bloqueada no servidor para perfis não-Admin.',
      'Anonimização compulsória com preservação de integridade fiscal e contratual caso haja propostas vinculadas.',
      'Pré-cadastros não são contabilizados em métricas e rol principal até que haja o aceite formal da proposta.',
    ],
  },
  {
    id: 'propostas',
    titulo: 'Módulo Propostas Comerciais',
    subtitulo: 'Elaboração PROP-AAAA-NNNN, cascata técnica, aceite público e conversão em Pacote',
    icone: FileText,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'Geração de propostas comerciais estruturadas com numeração sequencial sem lacunas (PROP-AAAA-NNNN), catálogo em cascata Área → Serviço → Subserviços com entregáveis padrão, alçadas comerciais (R$ 100 mil / margem ≥ 20%), aprovação de diretoria, envio de link seguro (/proposta/:token) e conversão total/parcial em Projeto-Pacote.',
    passos: [
      {
        titulo: '1. Selecionar cliente e preencher empreendimento',
        descricao:
          'No editor de propostas, selecione o cliente PJ ou PF e informe obrigatoriamente o Nome do Empreendimento (ex: "Clínica Studio Ser", "Edifício Horizonte"). Esse nome constará no cabeçalho formal do PDF GMAIS e na redação do Objeto. É possível cadastrar novos clientes (PJ ou PF) diretamente pelo botão "Cadastrar novo cliente" da janela rápida; estes nascem com o status "Pré-cadastro".',
      },
      {
        titulo: '1.1. Pré-cadastros e Promoção Automática no Aceite',
        descricao:
          'Clientes criados via janela rápida permanecem como pré-cadastros fora de métricas, curva ABC, funil e listagens padrão até o aceite formal da proposta. Ao ocorrer o aceite pelo cliente ou pelo comercial, o cadastro é promovido a cliente definitivo (PF) ou Parceiro Demandante (PJ), com auditoria automática PROMOCAO_CLIENTE_ACEITE.',
      },
      {
        titulo: '2. Inserir itens com cascata Área → Serviço → Subserviços',
        descricao:
          'Adicione disciplinas técnicas através da árvore em cascata: selecione a Área de Atuação, Serviço do catálogo e Subserviços associados. O investimento será tabulado automaticamente por área técnica no modelo do PDF.',
      },
      {
        titulo: '3. Redação Oficial GMAIS & Automações de Objeto e Escopo',
        descricao:
          'O sistema gera automaticamente o Objeto formal e o Escopo numerado consolidado por especialidade com base nos serviços e no empreendimento. Premissas, condições gerais (3 cláusulas) e nota de prazo em dias corridos nascem pré-preenchidas e 100% editáveis por proposta.',
      },
      {
        titulo: '4. Parcelamento com Gatilhos (Padrão 50/50 editável)',
        descricao:
          'Configure as parcelas da proposta com seus percentuais e gatilhos contratuais (contratação, entrega ou marco). As parcelas devem somar 100% e alimentarão o faturamento fracionado de contas a receber no módulo financeiro.',
      },
      {
        titulo: '5. Exigência de Nota Fiscal (Interruptor)',
        descricao:
          'Por padrão desligada, ative quando o cliente exigir formalmente a emissão de NF. O sistema aplica os impostos tributários e exibe no PDF a respectiva observação fiscal obrigatória.',
      },
      {
        titulo: '6. Emissão do Dossiê/PDF no Modelo GMAIS',
        descricao:
          'Clique em "Dossiê / PDF GMAIS" para abrir a reprodução fiel do modelo oficial da empresa: cabeçalho com logo G+, seções numeradas (1. Objeto a 9. Aceite/Assinaturas), tabela por área + valor global consolidado e folha de assinaturas das partes pronta para impressão ou PDF.',
      },
      {
        titulo: '7. Conversão em Projeto-Pacote com Faturamento Fracionado',
        descricao:
          'Ao converter a proposta aceita em projeto, as contas a receber em rascunho são geradas fracionadas de acordo com as parcelas configuradas (ex: 50% contratação e 50% entrega), respeitando a incidência ou não de nota fiscal.',
      },
    ],
    regrasAutomaticas: [
      'Ciclo de vida formal da proposta: Rascunho → Aprovação Interna → Aprovada → Enviada (via WhatsApp, E-mail oficial ou Cópia de Link confirmada) → Visualizada → Em Negociação → Aceita ou Recusada.',
      'Envio Manual Auditado: clicar em "Copiar Link" exige confirmação no sistema; ao confirmar, a proposta avança para "Enviada" e grava auditoria ENVIO_PROPOSTA_MANUAL com IP, usuário e dados do destinatário.',
      'Devolutiva do Cliente e Trava de Segurança: ao solicitar ajustes pelo link público, a proposta entra em "Em Negociação", trava as ações de aceite/recusa do cliente com aviso de análise em andamento, e guarda a devolutiva no histórico cumulativo (historico_devolutivas). O desbloqueio ocorre mediante nova revisão (novo token).',
      'Validade Jurídica do Aceite Eletrônico: o aceite via link público apoia-se em declaração expressa com concordância de termos, registro de endereço IP, timestamp UTC e hash criptográfico SHA-256 nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 (validade jurídica plena de aceite eletrônico entre as partes; esclarecendo que NÃO se trata de certificado digital ICP-Brasil).',
      'Contrato Bilateral dentro do Projeto: o aceite da proposta gera o Contrato de Prestação de Serviços Técnicos sob numeração oficial dentro do Projeto (aba "Contrato"). O projeto permanece no status inicial "Contratação" e só se torna "Ativo" após a assinatura eletrônica bilateral de ambas as partes.',
      'Numeração sequencial e contínua: PROP-AAAA-NNNN para propostas e PRJ-AAAA-NNNN para projetos gerados, garantindo rastreabilidade sem lacunas.',
      'Alçada comercial: propostas > R$ 100 mil ou com margem < 20% exigem deferimento exclusivo do perfil Admin.',
      'Validade configurável por proposta (padrão 15 dias, modelo GMAIS 5 dias), respeitada nos alertas D-3 e expiração automática.',
      'Contas a receber fracionadas automaticamente conforme as parcelas cadastradas na proposta.',
      'Tracking automático: a primeira abertura do link pelo cliente atualiza o status de "Enviada" para "Visualizada".',
      'Financeiro e Gestor possuem acesso restrito para consulta aos valores contratuais.',
    ],
  },
  {
    id: 'assistente-ia-proposta',
    titulo: 'Assistente de IA para Elaboração de Propostas GMAIS',
    subtitulo: 'Agente nativo Skip Cloud para pré-montagem técnica, disciplinas e redação oficial',
    icone: Sparkles,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Recurso inteligente de ponta integrado ao editor de propostas comerciais ("Elaborar Nova Proposta de Engenharia"). Exibido SOMENTE para os perfis Admin e Comercial (Gestor e Executor não veem o painel nem possuem permissão no backend). O operador descreve o pedido em linguagem livre e o agente nativo Skip Cloud estrutura a pré-montagem completa: empreendimento, áreas sugeridas com serviços/subserviços, entregáveis técnicos para marcar com checkboxes, objeto e escopo pré-redigidos GMAIS, prazo, nota fiscal e parcelas 50/50.',
    passos: [
      {
        titulo: '1. Acesso Exclusivo por Perfil (Admin e Comercial)',
        descricao:
          'O painel do assistente inteligente é exibido na lateral do editor de propostas somente para usuários com perfil Administrador ou Comercial. Usuários com perfil Gestor de Projetos, Financeiro ou Executor externo não veem o painel e qualquer tentativa de chamada ao endpoint /backend/v1/propostas/assistente-ia é bloqueada no servidor com código 403 Forbidden.',
      },
      {
        titulo: '2. Descrever o Pedido em Linguagem Livre',
        descricao:
          'No painel lateral "Assistente IA GMAIS", digite o pedido do cliente em linguagem natural (ex.: "projeto estrutural de galpão industrial de 1.200 m² em Campinas-SP, com hidráulico e sanitário, precisa de nota fiscal, prazo 90 dias, pagamento 50/50"). Pressione Enter ou clique em "Consultar IA".',
      },
      {
        titulo: '3. Prévia Técnica Revisável com Entregáveis Selecionáveis',
        descricao:
          'O assistente processa o pedido contra o catálogo de serviços e áreas da GMAIS, gerando uma prévia detalhada com itens, valores, objeto e escopo redigidos. Clique em "Revisar Prévia" para conferir cada elemento e marcar/desmarcar os entregáveis técnicos sugeridos através de checkboxes antes de transferir qualquer dado.',
      },
      {
        titulo: '4. Aplicação Segura ("Aplicar à Proposta")',
        descricao:
          'Nada é gravado no banco ou na proposta sem o clique explícito em "Aplicar à Proposta". Ao clicar, os campos do formulário (empreendimento, serviços, objeto, escopo, prazo, nota fiscal e parcelas) são preenchidos automaticamente para que o operador faça a revisão final antes de salvar.',
      },
      {
        titulo: '5. Auditoria Compulsória Automática (APLICACAO_SUGESTAO_ASSISTENTE_IA)',
        descricao:
          'Cada clique em "Aplicar à Proposta" dispara automaticamente um registro na trilha de Auditoria Imutável sob a ação APLICACAO_SUGESTAO_ASSISTENTE_IA, registrando quem aplicou, quando, qual proposta, empreendimento detectado, quantidade de itens, entregáveis selecionados e parcelas.',
      },
    ],
    regrasAutomaticas: [
      'Validação de permissão dupla: frontend oculta o painel para perfis não autorizados e o hook no servidor bloqueia com 403 Forbidden para quem não for Admin ou Comercial.',
      'Aplicação 100% sob controle humano: nada é gravado no banco de dados sem a confirmação e o clique em "Aplicar à Proposta".',
      'Bloqueio de segurança em propostas com status diferente de Rascunho ou Aprovação Interna.',
      'Registro compulsório de auditoria imutável (ação APLICACAO_SUGESTAO_ASSISTENTE_IA) na coleção audit_logs.',
      'Compatibilidade total com as regras de alçada comercial (limite de R$ 100 mil e margem mínima de 20%).',
    ],
  },
  {
    id: 'modelo-proposta-gmais',
    titulo: 'Administração do Modelo da Proposta GMAIS (Admin)',
    subtitulo: 'Gestão centralizada de textos padrão, cláusulas contratuais e parcelamento',
    icone: FileText,
    corIcone: 'text-blue-600',
    perfisPermitidos: ['admin'],
    descricao:
      'Tela exclusiva do perfil Administrador em Administração > "Modelo Proposta GMAIS" para customizar a redação padrão de premissas, condições gerais (3 cláusulas contratuais), nota sobre contagem de prazos e configuração das parcelas padrão de novas propostas.',
    passos: [
      {
        titulo: '1. Configurar Premissas Padrão',
        descricao:
          'Edite os itens de premissas técnicas que alimentam as propostas recém-criadas, cobrindo exonerações de atrasos de órgãos, pagamento de taxas ART/RRT e limite de revisões de arquitetura.',
      },
      {
        titulo: '2. Cláusulas de Condições Gerais',
        descricao:
          'Mantenha as 3 cláusulas contratuais da empresa: Cláusula 1ª (alterações e horas adicionais), Cláusula 2ª (uso exclusivo e direitos) e Cláusula 3ª (rescisão imotivada e multa compensatória de 20%).',
      },
      {
        titulo: '3. Estrutura de Parcelamento Padrão',
        descricao:
          'Defina o percentual, gatilhos (contratação, entrega, marco) e descrições das parcelas sugeridas para novas propostas. O botão "Restaurar Padrões GMAIS" permite retornar a qualquer momento aos parâmetros de fábrica da empresa.',
      },
    ],
    regrasAutomaticas: [
      'Acesso estritamente restrito a Administradores.',
      'Alterações nos parâmetros do modelo padrão afetam apenas novas propostas ou itens recém-gerados, preservando o histórico de propostas emitidas anteriormente.',
    ],
  },
  {
    id: 'areas-subservicos',
    titulo: 'Gestão de Áreas, Subserviços & Entregáveis Padrão',
    subtitulo: 'Padronização da cascata técnica e catálogo da engenharia (Admin)',
    icone: Layers,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin'],
    descricao:
      'Configuração centralizada da árvore técnica utilizada na montagem de propostas e etapas operacionais: Áreas de Atuação (disciplinas da engenharia), Subserviços especializados e Entregáveis Padrão com formatos previstos.',
    passos: [
      {
        titulo: '1. Gerenciar Áreas de Atuação',
        descricao:
          'Em Administração > Áreas & Modalidades, cadastre e ordene as especialidades atendidas pela G+ Engenharia (ex: Civil, Elétrica, Mecânica, Prevenção e Combate a Incêndio, Estrutural, Topografia).',
      },
      {
        titulo: '2. Configurar Subserviços vinculados',
        descricao:
          'Para cada Área de Atuação, cadastre os subserviços correspondentes (ex: na área Elétrica: Subestação, SPDA, Iluminação, Entrada de Energia). Defina status ativo/inativo.',
      },
      {
        titulo: '3. Cadastrar Entregáveis Padrão',
        descricao:
          'Defina a lista de produtos técnicos esperados por padrão em cada subserviço (ex: Pranchas DWG, Memorial Descritivo PDF, Lista de Materiais XLSX, ART de Projeto). Esses entregáveis são inseridos automaticamente ao selecionar o subserviço na proposta.',
      },
    ],
    regrasAutomaticas: [
      'Acesso restrito exclusivamente a usuários com papel Administrador.',
      'Auditoria de cadastro, edição de ordem e desativação de itens técnicos.',
    ],
  },
  {
    id: 'projetos',
    titulo: 'Módulo Operação de Projetos',
    subtitulo: 'Cronograma de etapas, entregáveis, matriz de riscos, saúde e Dossiê A4',
    icone: Briefcase,
    corIcone: 'text-blue-600',
    perfisPermitidos: ['admin', 'gestor', 'comercial', 'financeiro'],
    descricao:
      'Centro de comando operacional da engenharia para acompanhamento de escopos, prazos, entregáveis técnicos, licenças e documentação técnica.',
    passos: [
      {
        titulo: 'Cadastrar etapas operacionais',
        descricao:
          'Defina o cronograma quebrando o projeto em etapas lógicas (ex: Levantamento Topográfico, Projeto Estrutural, Memorial Descritivo) com datas de início e entrega.',
      },
      {
        titulo: 'Vincular entregáveis e gerenciar versões (Arquivos até 100 MB)',
        descricao:
          'Adicione os entregáveis esperados com versionamento (Rev.00, Rev.01) e anexe pranchas CAD, pacotes BIM ou memoriais em PDF em alta resolução com limite ampliado para até 100 MB por arquivo.',
      },
      {
        titulo: 'Monitorar saúde do projeto (Semáforo Verde / Amarelo / Vermelho)',
        descricao:
          'O sistema sugere a saúde com base em atrasos de etapas e documentos vencidos. O Gestor de Projetos pode confirmar ou alterar a saúde fundamentando a decisão.',
      },
      {
        titulo: 'Documentos técnicos com anexo ampliado (até 100 MB)',
        descricao:
          'Documentos com validade (ART/RRT, TRT, Ordens de Serviço, Medições e licenças ambientais) aceitam arquivos digitais pesados de até 100 MB e geram alertas preventivos de vencimento nos prazos D-30, D-15, D-7 e D-1.',
      },
      {
        titulo: 'Emitir Dossiê Consolidado (Layout A4)',
        descricao:
          'Clique em "Dossiê do Projeto" para gerar o documento técnico completo pronto para impressão ou salvamento em PDF no padrão A4 oficial da G+ Engenharia.',
      },
    ],
    regrasAutomaticas: [
      'Sugestão automática da saúde: etapas em atraso crítico acionam sugestão de status Vermelho.',
      'Geração do dossiê auditada no backend com captura de usuário e carimbo de data/hora.',
    ],
  },
  {
    id: 'executores',
    titulo: 'Módulo Executores & Cotações',
    subtitulo: 'Homologação técnica, cotações com link seguro e nota ponderada',
    icone: HardHat,
    corIcone: 'text-amber-600',
    perfisPermitidos: ['admin', 'gestor', 'comercial'],
    descricao:
      'Credenciamento de profissionais e empresas especializadas de engenharia (projetistas, calculistas, desenhistas, peritos), solicitação de propostas e avaliação de performance.',
    passos: [
      {
        titulo: 'Cadastrar executor técnico',
        descricao:
          'Preencha dados cadastrais, número de registro profissional (CREA/CAU), especialidades técnicas e modalidade (PJ ou autônomo).',
      },
      {
        titulo: 'Disparar solicitação de cotação (/cotacao/:token)',
        descricao:
          'Na etapa do projeto, clique em "Convidar Executor". O sistema gera um link individual seguro. O executor acessa sem necessidade de senha e preenche o preço e prazo ofertados.',
      },
      {
        titulo: 'Avaliação de Desempenho pós-entrega',
        descricao:
          'Ao concluir uma etapa, o Gestor preenche a avaliação com notas de 1 a 5 em Qualidade Técnica, Pontualidade de Entrega e Comunicação/Postura.',
      },
    ],
    regrasAutomaticas: [
      'Nota do executor ponderada por volume e recência: avaliações mais recentes e etapas de maior complexidade têm peso superior no cálculo da média.',
      'Executores com nota média recorrentemente baixa (< 3.0) exibem aviso de atenção ao Gestor.',
    ],
  },
  {
    id: 'financeiro',
    titulo: 'Módulo Financeiro & Fluxo de Caixa',
    subtitulo: 'Contas a pagar/receber, conciliação, D-7/D-1 e DRE operacional',
    icone: DollarSign,
    corIcone: 'text-emerald-600',
    perfisPermitidos: ['admin', 'financeiro'],
    descricao:
      'Controladoria financeira completa da intermediação. Controle de medições, emissão de faturas contra parceiros e ordens de pagamento a executores.',
    passos: [
      {
        titulo: 'Visualizar Dashboard Financeiro',
        descricao:
          'Acompanhe total a receber no mês, total a pagar a executores, margem bruta realizada e saldo projetado.',
      },
      {
        titulo: 'Lançar e baixar faturas',
        descricao:
          'Lance contas a pagar vinculadas a etapas de projetos e contas a receber vinculadas a contratos. Ao confirmar o pagamento bancário, efetue a "Baixa" com anexação de comprovante.',
      },
      {
        titulo: 'Alertas de vencimento D-7 e D-1',
        descricao:
          'O sininho superior destaca contas vencendo em 7 dias, na véspera e títulos em atraso, com acesso direto via filtro rápido.',
      },
      {
        titulo: 'Exportar relatórios em CSV',
        descricao:
          'Exporte extratos filtrados por período, status ou projeto para conciliação contábil externa.',
      },
    ],
    regrasAutomaticas: [
      'Acesso restrito exclusivamente a usuários com papel Admin e Financeiro.',
      'Auditoria compulsória de qualquer lançamento, edição de valor ou exclusão de fatura.',
    ],
  },
  {
    id: 'exportacoes',
    titulo: 'Exportações & Auditoria',
    subtitulo: 'Downloads em CSV tabulado e trilha imutável de eventos do servidor',
    icone: Download,
    corIcone: 'text-slate-600',
    perfisPermitidos: ['admin'],
    descricao:
      'Relatórios analíticos para inteligência de negócio e rastreabilidade total de conformidade jurídica.',
    passos: [
      {
        titulo: 'Exportar bases completas',
        descricao:
          'Nos módulos de Empresas, Parceiros, Executores e Financeiro, utilize o botão "Exportar CSV" para baixar relatórios compatíveis com Microsoft Excel e Google Planilhas.',
      },
      {
        titulo: 'Auditoria Imutável',
        descricao:
          'Em "Auditoria Imutável", consulte o histórico completo de operações: usuário autenticado, ação (criar, editar, remover, login, logout), registro alterado e endereço IP.',
      },
    ],
    regrasAutomaticas: [
      'A tabela audit_logs é imutável: regras de coleção no PocketBase bloqueiam deleções ou alterações via API.',
    ],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard Executivo 360° & Comercial',
    subtitulo: 'Painel gerencial centralizado com consolidação em tempo real e produção por área',
    icone: LayoutDashboard,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Painel de bordo da diretoria e do time comercial que reúne indicadores do funil, taxas de conversão de propostas, produção por área de atuação (emitidas, aceitas, valores propostos e fechados, projetos e etapas gerados), saúde dos projetos operacionais e alertas críticos.',
    passos: [
      {
        titulo: 'Alternar período de propostas e produção',
        descricao:
          'Selecione entre Mês Corrente, Últimos 90 Dias ou Ano Corrente para recalcular os indicadores de propostas e a produção discriminada por área de atuação.',
      },
      {
        titulo: 'Análise de Produção por Área de Atuação',
        descricao:
          'Consulte a tabela e os cartões consolidados por especialidade técnica: quantidade de propostas emitidas e aceitas, taxa de conversão %, valor proposto (R$), valor fechado (R$), projetos gerados e etapas de projeto geradas.',
      },
      {
        titulo: 'Acessar alertas centralizados',
        descricao:
          'Clique em qualquer cartão do Painel Central de Alertas Críticos para ir diretamente à tela correspondente com os filtros já aplicados.',
      },
    ],
    regrasAutomaticas: [
      'Acessível aos perfis Administrador e Comercial.',
      'Abertura do Dashboard gera registro automático na trilha de auditoria.',
    ],
  },
]

// Glossário de Termos do Negócio
const GLOSSARIO_TERMOS = [
  {
    termo: 'Ciclo de Vida da Proposta',
    definicao:
      'Esteira formal de status da proposta: Rascunho → Aprovação Interna (alçada comercial) → Aprovada → Enviada (WhatsApp, E-mail oficial ou Link copiado) → Visualizada (pelo cliente) → Em Negociação (caso o cliente peça ajustes) → Aceita ou Recusada. Durante o status Em Negociação o link público fica travado para novo aceite até emissão de nova revisão.',
  },
  {
    termo: 'Validade Jurídica do Aceite Eletrônico',
    definicao:
      'Mecanismo de formalização probatória em conformidade com o art. 10, § 2º da Medida Provisória nº 2.200-2/2001. Registra declaração de concordância, carimbo temporal, IP de conexão e hash SHA-256 do documento. Possui eficácia jurídica entre os contratantes como aceite eletrônico particular (não constitui certificação digital ICP-Brasil).',
  },
  {
    termo: 'Contrato Bilateral do Projeto',
    definicao:
      'Instrumento jurídico gerado após o aceite da proposta, localizado na aba "Contrato" do projeto. O projeto recém-gerado assume o status "Contratação" e suas etapas operacionais, entregáveis e lançamentos financeiros são ativados somente após a assinatura eletrônica bilateral (G+ Engenharia e Contratante).',
  },
  {
    termo: 'Pré-cadastro de Cliente (PF e PJ)',
    definicao:
      'Cadastro temporário originado da janela rápida de criação de clientes na elaboração de propostas. Não entra em contagens de topo, curvas ABC, funil nem dashboards até que ocorra o aceite formal da proposta (PROMOCAO_CLIENTE_ACEITE). Sem aceite (recusada, expirada ou em negociação), permanece como pré-cadastro indefinidamente.',
  },
  {
    termo: 'Anonimização LGPD (Cliente PF)',
    definicao:
      'Mecanismo de proteção à privacidade aplicável quando um Administrador solicita a remoção de um Cliente Pessoa Física que possui propostas contratuais vinculadas. Para não quebrar a rastreabilidade fiscal, técnica e orçamentária dos projetos, o identificador é preservado e dados pessoais (CPF, telefones, e-mail, endereço) são definitivamente apagados, assumindo o nome fictício "Cliente removido a pedido (LGPD)" com auditoria compulsória.',
  },
  {
    termo: 'Curva ABC (Cortes Pareto)',
    definicao:
      'Classificação do porte das empresas parceiras baseada no valor acumulado de contratos públicos ativos: Curva A (topo 80% do volume financeiro acumulado ou valor ≥ R$ 5M), Curva B (seguintes 15%) e Curva C (restante 5%). Garante prioridade estratégica na prospecção.',
  },
  {
    termo: 'Toque de Cadência',
    definicao:
      'Ponto de contato planejado na esteira comercial (D0, D3, D7, D15, D30) executado via WhatsApp, Ligação telefônica ou E-mail. Cada toque concluído libera automaticamente o agendamento do próximo passo.',
  },
  {
    termo: 'Alçada de Margem',
    definicao:
      'Percentual mínimo de rentabilidade operacional aceitável para propostas comerciais sem autorização da diretoria (padrão de 25%). Propostas com margem abaixo dessa alçada são bloqueadas e exigem despacho formal do Admin.',
  },
  {
    termo: 'Dossiê do Projeto (A4)',
    definicao:
      'Documento técnico e gerencial consolidado gerado pela plataforma no padrão A4 oficial com cabeçalho G+ Engenharia, reunindo cliente, cronograma de etapas, executores, entregáveis, matriz de riscos e síntese financeira.',
  },
  {
    termo: 'Não Contatar (Opt-out LGPD)',
    definicao:
      'Lista definitiva de bloqueio em compliance com a Lei Geral de Proteção de Dados (Art. 18 da Lei 13.709/2018). Contatos adicionados à lista são sumariamente excluídos de qualquer automação ou disparo de mensagens no servidor.',
  },
  {
    termo: 'Token de Validação Pública',
    definicao:
      'Chave criptográfica única inserida nos links de propostas (/proposta/:token), cotações (/cotacao/:token) e descadastro (/descadastro/:token), permitindo acesso externo seguro sem exigência de login ou senha.',
  },
  {
    termo: 'Semáforo de Saúde do Projeto',
    definicao:
      'Classificação visual da condição do projeto: Verde (no prazo e escopo regular), Amarelo (riscos identificados ou pequenos atrasos) e Vermelho (atraso crítico em etapa-chave ou documento impeditivo). O sistema sugere a saúde e o Gestor valida.',
  },
  {
    termo: 'Nota Ponderada do Executor',
    definicao:
      'Métrica avaliativa calculada a partir de notas de 1 a 5 atribuídas pelo Gestor ao fim de cada entrega. Considera maior peso para serviços recentes e etapas de maior complexidade orçamentária.',
  },
  {
    termo: 'Auditoria Imutável',
    definicao:
      'Trilha de segurança técnica que armazena todas as mutações no banco de dados. Os registros não podem ser editados nem apagados por nenhum usuário pela interface.',
  },
]

// Perguntas Frequentes (FAQ)
const FAQ_ITENS = [
  {
    pergunta: 'Como o cliente aceita uma proposta sem precisar criar senha ou fazer login?',
    resposta:
      'Ao gerar a proposta, o sistema cria um link seguro exclusivo contendo um token criptografado (ex: /proposta/abc123xyz). O cliente abre a proposta no navegador e clica em "Aceitar Proposta". O sistema registra o aceite, IP e data/hora formalizando a contratação com total validade jurídica e auditoria.',
  },
  {
    pergunta: 'O que acontece se uma proposta tiver margem bruta inferior a 25%?',
    resposta:
      'Ela entra automaticamente no estado "Aguardando Aprovação de Alçada". O Comercial não consegue enviar o link de aceite enquanto o Administrador não avaliar e deferir a proposta na tela de Propostas ou no Dashboard.',
  },
  {
    pergunta: 'Como funciona a exclusão de e-mails pela regra de opt-out LGPD?',
    resposta:
      'Todo e-mail enviado pelo sistema contém no rodapé o link de descadastro. Ao clicar, o contato confirma o opt-out e seu e-mail é gravado na coleção "Não Contatar". As APIs do PocketBase validam essa tabela antes de qualquer disparo, impedindo novos envios automaticamente no nível do servidor.',
  },
  {
    pergunta: 'Quem pode visualizar o Módulo Financeiro e o Dashboard Executivo?',
    resposta:
      'O Módulo Financeiro é de acesso exclusivo dos perfis Admin e Financeiro. O Dashboard Executivo e o módulo de Auditoria Imutável são de acesso restrito ao perfil Admin. O Gestor de Projetos e o Comercial possuem acesso apenas aos dados operacionais necessários às suas funções.',
  },
  {
    pergunta: 'Como salvar ou imprimir o Dossiê do Projeto em formato PDF?',
    resposta:
      'No detalhe do Projeto, clique em "Dossiê do Projeto". Uma janela pré-formatada será aberta. Clique no botão "Imprimir / Salvar em PDF A4" no canto superior direito para acionar a janela de impressão do seu navegador já formatada para folhas A4.',
  },
]

export function ManualUsoPage() {
  const { user } = useAuth()
  const [busca, setBusca] = useState('')
  const [capituloSelecionadoId, setCapituloSelecionadoId] = useState<string>('visao-geral')
  const [termoGlossarioAberto, setTermoGlossarioAberto] = useState<string | null>(null)
  const [faqAbertaIndex, setFaqAbertaIndex] = useState<number | null>(null)

  const roleAtual = user?.role || 'executor'

  // Capítulos visíveis para o perfil do usuário logado
  const capitulosPermitidos = useMemo(() => {
    return CAPITULOS_MANUAL.filter((cap) => cap.perfisPermitidos.includes(roleAtual))
  }, [roleAtual])

  // Filtragem pela busca textual
  const capitulosFiltrados = useMemo(() => {
    if (!busca.trim()) return capitulosPermitidos
    const termo = busca.toLowerCase()
    return capitulosPermitidos.filter(
      (c) =>
        c.titulo.toLowerCase().includes(termo) ||
        c.subtitulo.toLowerCase().includes(termo) ||
        c.descricao.toLowerCase().includes(termo) ||
        c.passos.some(
          (p) =>
            p.titulo.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo),
        ),
    )
  }, [capitulosPermitidos, busca])

  // Capítulo atualmente ativo na visualização
  const capituloAtivo = useMemo(() => {
    return (
      capitulosPermitidos.find((c) => c.id === capituloSelecionadoId) ||
      capitulosPermitidos[0] ||
      CAPITULOS_MANUAL[0]
    )
  }, [capitulosPermitidos, capituloSelecionadoId])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* CABEÇALHO DO MANUAL */}
      <div className="bg-[#1E2A4A] text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-[#141D34] flex flex-col md:flex-row md:items-center justify-between gap-6 print:bg-white print:text-black print:border-b-2 print:border-slate-800 print:shadow-none">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#D95A2B] text-white">
              Documentação Oficial
            </span>
            <span className="text-xs text-slate-300">Versão 1.0 • GESTÃO G+</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white print:text-black">
            Manual de Uso da Plataforma
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl print:text-slate-600">
            Guia completo de operação, regras de negócio, fluxos integrados e glossário técnico para
            a equipe de engenharia e gestão.
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
            <span>Perfil Ativo:</span>
            <Badge className="bg-white/10 text-white border-white/20 uppercase text-[10px] font-bold">
              {ROLE_LABELS[roleAtual]}
            </Badge>
            <span className="text-slate-400 text-[11px]">
              • {capitulosPermitidos.length} módulos habilitados para seu acesso
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 print:hidden">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimir Manual
          </Button>
        </div>
      </div>

      {/* BARRA DE PESQUISA RÁPIDA */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 print:hidden">
        <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
        <Input
          placeholder="Buscar no manual (ex: Curva ABC, Proposta, Alçada de margem, Aceite, Dossiê, Executor...)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="border-0 focus-visible:ring-0 text-xs sm:text-sm placeholder:text-slate-400"
        />
        {busca && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBusca('')}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* CORPO PRINCIPAL COM SIDEBAR NAVEGÁVEL E CONTEÚDO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* NAVEGAÇÃO LATERAL DE CAPÍTULOS */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Capítulos do Manual</span>
                <span className="font-mono text-[11px] text-[#D95A2B] font-bold">
                  {capitulosFiltrados.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {capitulosFiltrados.map((cap) => {
                const Icone = cap.icone
                const isAtivo = cap.id === capituloAtivo.id
                return (
                  <button
                    key={cap.id}
                    onClick={() => {
                      setCapituloSelecionadoId(cap.id)
                      window.scrollTo({ top: 380, behavior: 'smooth' })
                    }}
                    className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-3 group ${
                      isAtivo
                        ? 'bg-[#1E2A4A] text-white shadow-xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                        isAtivo
                          ? 'bg-[#D95A2B] text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-white'
                      }`}
                    >
                      <Icone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold truncate ${
                            isAtivo ? 'text-white' : 'text-slate-900 group-hover:text-[#D95A2B]'
                          }`}
                        >
                          {cap.titulo}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] line-clamp-1 mt-0.5 ${
                          isAtivo ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cap.subtitulo}
                      </p>
                    </div>
                  </button>
                )
              })}

              {capitulosFiltrados.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhum capítulo localizado para o termo pesquisado.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ATALHOS RÁPIDOS PARA GLOSSÁRIO E FAQ */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById('secao-glossario')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-xs text-slate-700 hover:text-[#D95A2B] hover:border-orange-300 justify-start h-auto py-2.5 px-3"
            >
              <Award className="w-4 h-4 mr-2 text-[#D95A2B]" />
              <div className="text-left">
                <span className="font-bold block text-[11px]">Glossário</span>
                <span className="text-[10px] text-slate-500">Termos chave</span>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById('secao-faq')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-xs text-slate-700 hover:text-[#D95A2B] hover:border-orange-300 justify-start h-auto py-2.5 px-3"
            >
              <HelpCircle className="w-4 h-4 mr-2 text-sky-600" />
              <div className="text-left">
                <span className="font-bold block text-[11px]">Dúvidas (FAQ)</span>
                <span className="text-[10px] text-slate-500">Respostas rápidas</span>
              </div>
            </Button>
          </div>
        </div>

        {/* CONTEÚDO DO CAPÍTULO ATIVO */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 p-6 border-b border-slate-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-[#1E2A4A] text-white shadow-xs">
                  <capituloAtivo.icone className="w-6 h-6 text-[#D95A2B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D95A2B]">
                      Capítulo
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-medium text-slate-500">
                      Módulo da Plataforma
                    </span>
                  </div>
                  <CardTitle className="text-xl font-bold text-[#1E2A4A] mt-1">
                    {capituloAtivo.titulo}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 mt-1">
                    {capituloAtivo.subtitulo}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Descrição geral */}
              <div className="p-4 rounded-xl bg-orange-50/40 border border-orange-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {capituloAtivo.descricao}
              </div>

              {/* Passo a passo operacional */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Passo a Passo das Operações Principais
                </h3>

                <div className="space-y-3">
                  {capituloAtivo.passos.map((passo, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#1E2A4A] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {passo.titulo}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {passo.descricao}
                          </p>
                          {passo.dica && (
                            <div className="mt-2.5 p-2.5 rounded bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Dica prática:</strong> {passo.dica}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regras e classificações automáticas vigentes */}
              {capituloAtivo.regrasAutomaticas && (
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Regras de Sistema & Classificações Automáticas
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {capituloAtivo.regrasAutomaticas.map((regra, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#D95A2B] font-bold">•</span>
                        <span>{regra}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEÇÃO DE GLOSSÁRIO DE TERMOS */}
          <div id="secao-glossario" className="pt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D95A2B]" />
                Glossário Técnico da Plataforma
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {GLOSSARIO_TERMOS.length} termos catalogados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GLOSSARIO_TERMOS.map((g, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-orange-300 transition-colors"
                >
                  <h4 className="text-xs font-bold text-[#1E2A4A] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D95A2B]" />
                    {g.termo}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">{g.definicao}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO DE PERGUNTAS FREQUENTES (FAQ) */}
          <div id="secao-faq" className="pt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-600" />
                Perguntas Frequentes (FAQ)
              </h2>
              <span className="text-xs text-slate-500 font-mono">Respostas e boas práticas</span>
            </div>

            <div className="space-y-2">
              {FAQ_ITENS.map((item, index) => {
                const aberto = faqAbertaIndex === index
                return (
                  <div
                    key={index}
                    className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setFaqAbertaIndex(aberto ? null : index)}
                      className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">
                        {item.pergunta}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          aberto ? 'rotate-180 text-[#D95A2B]' : ''
                        }`}
                      />
                    </button>
                    {aberto && (
                      <div className="p-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                        {item.resposta}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* RODAPÉ DO MANUAL */}
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">
              GESTÃO G+ — Engenharia • Conectando ideias, somando resultados
            </p>
            <p className="text-[11px]">
              Dúvidas técnicas ou solicitações de customização devem ser direcionadas ao
              Administrador do Sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManualUsoPage
