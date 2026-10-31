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
  Users,
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
    id: 'operacao-do-sistema',
    titulo: 'Operação do Sistema & Crons (Rodada 19)',
    subtitulo:
      'Exportação semanal/manual auditada, monitoramento de crons 2×, catálogo de erros e tetos reais de upload',
    icone: Shield,
    corIcone: 'text-indigo-600',
    perfisPermitidos: ['admin', 'gestor', 'executor'],
    descricao:
      'Diretrizes operacionais e de sustentação da plataforma GESTÃO G+. Abrange a rotina semanal e sob demanda de exportação completa do banco de dados com auditoria indelével, o painel de integridade de crons e rotinas em background com alerta preventivo de 2× intervalo sem execução, o repositório de erros de sistema para suporte técnico ágil e os tetos rígidos de upload configurados na Administração por formato técnico (IFC, DWG, PDF e Imagens).',
    passos: [
      {
        titulo: '1. Exportação Semanal & Backup Manual Auditado (Admin)',
        descricao:
          'O Administrador dispõe de rotina automática semanal executada todo domingo às 02:00 UTC que consolida um backup integral JSON de todas as coleções do sistema com geração de índice e hash de integridade. Em Administração › "Operação & Crons", o Admin pode a qualquer momento clicar em "Exportar agora", gerando imediatamente o download auditado com registro de IP, data/hora e total de registros exportados.',
        dica: 'Cada exportação manual ou automática gera evento imutável na trilha audit_logs.',
      },
      {
        titulo: '2. Monitoramento de Crons & Alerta Preventivo de 2× Intervalo (Admin & Gestor)',
        descricao:
          'O painel de Crons inspeciona continuamente o batimento das rotinas agendadas essenciais: Monitoramento e Cobrança de Prazos (10 min), Prospecção Diária PNCP (24 h), Cálculo de Scorecards (24 h) e Exportação Semanal (7 dias). Quando uma rotina ultrapassa o dobro do seu intervalo normal sem registrar sucesso (2× intervalo), o sistema emite um badge de alerta crítico vermelho para intervenção imediata da equipe de TI/Gestão.',
      },
      {
        titulo: '3. Repositório Central de Erros de Sistema (Admin)',
        descricao:
          'Falhas de requisições, endpoints ou processamento são catalogadas automaticamente na coleção erros_sistema com rota afetada, mensagem técnica, pilha de erro, usuário autenticado e timestamp, permitindo diagnosticar problemas em minutos sem depender de reprodução cega.',
      },
      {
        titulo: '4. Tetos Reais de Upload por Tipo de Arquivo (Admin, Gestor & Prestador)',
        descricao:
          'Para garantir estabilidade da infraestrutura e respeitar os limites de memória da nuvem (limite de 100 MB por requisição da plataforma e buffer de 32 MB), o sistema aplica limites máximos por tipo de anexo parametrizáveis na Administração: IFC (.ifc, .ifczip — teto de até 150 MB), DWG/DXF (100 MB), PDF (50 MB) e Imagens (.png, .jpg, .jpeg, .webp — 25 MB).',
      },
      {
        titulo: '5. Mensagem de Bloqueio Educativa no Portal do Prestador (Prestador / Executor)',
        descricao:
          'Ao submeter arquivos técnicos ou anexos de prancha no Portal do Prestador e no envio de versões IFC, o arquivo é inspecionado antes do upload. Caso exceda o teto configurado, o envio é sumariamente bloqueado com a mensagem clara: "O arquivo [nome] tem X MB e excede o limite máximo permitido de Y MB para arquivos do tipo [TIPO]. Reduza o arquivo ou entre em contato com a equipe de gestão."',
        dica: 'Prestadores devem compactar ou expurgar camadas desnecessárias de arquivos CAD/BIM antes da submissão.',
      },
      {
        titulo: '6. Padrão de Snapshot Pré-Migração (Admin)',
        descricao:
          'Antes de qualquer migração estrutural ou transformação de dados em lote, o sistema gera um snapshot declarativo pré-migração que registra o estado anterior das coleções afetadas, contagens de registros e operador responsável, prevenindo corrupção de dados ou regressões operacionais.',
      },
    ],
    regrasAutomaticas: [
      'Alerta preventivo automático ativado sempre que o tempo desde o último sucesso for superior a 2× o intervalo da rotina.',
      'Validação de tamanho no cliente e no servidor antes de alocar memória para upload de pranchas e modelos.',
      'Auditoria de cada exportação manual contendo identificador do usuário e contagem de registros baixados.',
      'O Portal do Prestador mantém isolamento rígido: prestadores visualizam apenas as regras e limites de upload que afetam suas submissões.',
    ],
  },
  {
    id: 'bim-ifc-bcf-fluxo',
    titulo: 'Modelos BIM, Visualizador IFC & Gestão de Issues BCF (Rodada 17)',
    subtitulo:
      'Validação de entrada, árvore espacial 3D, propriedades técnicas, sobreposição multidisciplinar e rastreamento BCF',
    icone: Layers,
    corIcone: 'text-blue-600',
    perfisPermitidos: ['admin', 'gestor', 'executor'],
    descricao:
      'Fluxo técnico completo para gestão e coordenação de projetos em BIM (Building Information Modeling). Inclui checklist de entrada que analisa arquivos IFC2x3 e IFC4 antes do upload, bloqueia modelos malformados, transmite o resumo validado por hash SHA-256 ao servidor, visualizador 3D com isolamento de pavimentos e propriedades, ferramenta "O que mudou" com diff por GlobalId, painel de issues de revisão com importação BCF 2.1/3.0 e integração estrita com o Portal do Prestador.',
    passos: [
      {
        titulo: '1. Checklist de Entrada no Envio de Versão IFC',
        descricao:
          'Ao submeter uma nova versão de modelo técnico (.ifc), o navegador executa um checklist prévio completo: checagem de schema (IFC2x3 ou IFC4), presença de pavimentos nomeados (IfcBuildingStorey), unidade métrica (.METRE. / MILLIMETRE), compatibilidade de classes com a disciplina e percentual de elementos com vínculo espacial. Arquivos fora do padrão são bloqueados com exibição detalhada dos motivos. Para arquivos válidos, o resumo técnico é calculado junto ao hash criptográfico SHA-256 e transmitido ao endpoint seguro resumo-ifc.',
        dica: 'O tamanho máximo do arquivo IFC em megabytes é parametrizável pelo Admin em Administração › Parâmetros do Sistema (chave tamanho_maximo_ifc_mb).',
      },
      {
        titulo: '2. Visualizador IFC 3D & Árvore Espacial',
        descricao:
          'Na aba Entregáveis do Projeto e no Portal do Prestador (exclusivo para a própria OS), o usuário clica em "Visualizador IFC" para interagir com o modelo 3D. A ferramenta disponibiliza: navegação pela árvore espacial (IfcProject > IfcBuilding > Pavimentos > Elementos), seleção de elementos com exibição instantânea do PropertySet técnico, isolamento de pavimentos e disciplinas, e suporte para orbitar, transladar (pan) e zoom com alta performance.',
      },
      {
        titulo: '3. Sobreposição Federada de até 3 Modelos',
        descricao:
          'Na aba "Federação" do visualizador, o coordenador pode ativar e sobrepor simultaneamente até 3 modelos de disciplinas diferentes (ex: Estrutural + Hidráulica + Elétrica) com códigos de cores distintos, permitindo detectar interferências geométricas (clash detection visual) de forma ágil.',
      },
      {
        titulo: '4. Comparativo "O Que Mudou" por GlobalId',
        descricao:
          'Ao acionar o botão "O que mudou" entre duas versões de um modelo IFC, o sistema realiza a comparação por GlobalId (GUID imutável de 22 caracteres do padrão IFC). Os elementos são catalogados em três categorias: Adicionados (+), Removidos (-) e Alterados (~), indicando modificações de classe, nome ou parâmetros técnicos.',
      },
      {
        titulo: '5. Painel de Issues de Revisão & Importação BCF (2.1 / 3.0)',
        descricao:
          'Gestores e revisores gerenciam apontamentos na aba de Issues de Revisão. É possível cadastrar issues manualmente ou importar arquivos BCF (.bcfzip ou .bcf XML) exportados de softwares como Solibri, Navisworks ou Revit. O servidor desduplica os tópicos por GUID, preserva o snapshot 3D (viewpoint), severidade (crítica, alta, média, baixa), pavimento e prazo.',
      },
      {
        titulo: '6. Portal do Prestador: Aba "Issues" & Feedback com Viewpoint',
        descricao:
          'O profissional credenciado acessa a aba "Issues" vinculada à sua Ordem de Serviço. Ele visualiza as capturas de tela (viewpoints) dos problemas apontados pelos revisores da G+ e os GlobalIds dos elementos envolvidos. Ao solucionar o problema, clica em "Marcar Corrigida", sinalizando que a correção foi contemplada na nova versão submetida.',
        dica: 'SEGURANÇA E PRIVACIDADE: O Portal do Prestador é blindado por API rules no servidor. O prestador nunca vê dados de cliente, contratos de receita, outros prestadores ou valores globais do projeto.',
      },
    ],
    regrasAutomaticas: [
      'Validação de integridade no cliente com cálculo do hash SHA-256 e gravação segura no servidor.',
      'Bloqueio automático de uploads malformados que não atendam às normas de interoperabilidade.',
      'Deduplicação de tópicos BCF por GUID para impedir retrabalho ou registros redundantes.',
      'Isolamento estrito do Portal do Prestador via RLS, bloqueando qualquer informação comercial.',
    ],
  },
  {
    id: 'scorecards-desempenho',
    titulo: 'Scorecards de Desempenho & Governança (Rodada 16)',
    subtitulo:
      'Ponderações por perfil (externo, interno, parceiro), nota composta, tendência, versionamento e transparência no Portal',
    icone: Award,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor', 'executor'],
    descricao:
      'O sistema de Scorecards da G+ Engenharia avalia objetiva e continuamente a performance das três pontas da operação: Prestadores Externos (terceirizados), Equipe Interna (engenharia própria) e Empresas Parceiras (clientes demandantes). O motor recalcula automaticamente os índices a cada evento operacional (conclusão de OS, avaliação, apontamento de horas, pagamento de marco), ponderando os fatores conforme os pesos da versão ativa configurada na Administração.',
    passos: [
      {
        titulo: '1. O que é o Scorecard e os 3 Perfis de Avaliação',
        descricao:
          'O scorecard consolida múltiplos indicadores operacionais em um Índice Composto de 0 a 100 pontos. Os três perfis possuem métricas exclusivas: 1. Prestador Externo (pontualidade da OS, ausência de retrabalho, qualidade técnica das pranchas, aderência ao preço cotado, responsividade e conformidade documental); 2. Equipe Interna (lead time vs. meta por disciplina, ciclos de revisão técnica, horas/entregável apontadas, taxa de ocupação e pontualidade); 3. Empresa Parceira (prazo real de pagamento de marcos faturados, taxa de aceite de entregáveis, índice de devoluções pelo cliente, frequência de demanda, margem média e inversões de fluxo financeiro).',
      },
      {
        titulo: '2. Regra de "Dados Insuficientes" (Sem Notas Inventadas)',
        descricao:
          'Quando um prestador ou parceiro não possui histórico suficiente (mínimo de trabalhos concluídos na janela de 12 meses), o sistema exibe expressamente a bandeira amarela de "Dados insuficientes" em vez de inventar uma nota arbitrária ou penalizar injustamente o profissional com nota zero.',
        dica: 'Nas cotações e pré-cotações, participantes com dados insuficientes concorrem de forma neutra até acumularem entregas homologadas.',
      },
      {
        titulo: '3. Tendência dos Últimos 5 Trabalhos & Gráfico Mensal nas Fichas',
        descricao:
          'O scorecard analisa a inclinação das últimas 5 entregas e classifica a tendência em "Melhorou" (verde), "Estável" (cinza) ou "Piorou" (vermelho). Adicionalmente, as fichas completas de Prestador (em Prestadores) e de Parceiro (em Parceiros e Empresas) exibem o gráfico mensal de evolução histórica, radar de competências e detalhamento de cada índice que compõe a nota.',
      },
      {
        titulo: '4. Aba "Equipe Interna" nos Projetos & Desempenho Operacional',
        descricao:
          'Nos Projetos, a aba "Equipe Interna" apresenta os índices agregados de lead time real contra metas por disciplina, ciclos médios de revisão técnica antes da aprovação e taxa de ocupação da equipe própria alocada no projeto, permitindo calibrar prazos futuros com precisão.',
      },
      {
        titulo: '5. Parâmetros, Pesos e Versionamento Imutável na Administração (Admin)',
        descricao:
          'Em Administração › Scorecards & Metas, o Administrador gerencia as ponderações de cada indicador para os três perfis. A soma dos pesos deve totalizar exatamente 100%. Nenhuma alteração sobrescreve dados: cada ajuste gera uma nova versão auditada (v1, v2, v3...), preservando o histórico de versões anteriores apenas para leitura histórica.',
      },
      {
        titulo: '6. Cartões de Alerta na Central de Ações & Decisão Humana Obrigatória',
        descricao:
          'O robô de scorecards alimenta a Central de Ações ("O que fazer hoje") com cartões de alerta preventivo: queda de 15 pontos em relação ao trimestre anterior, atraso de pagamento de marcos pelo parceiro e sobrecarga de equipe interna acima de 100%. Em caso de "Sugestão de Suspensão Técnica", o sistema NUNCA suspende automaticamente: exige intervenção expressa do gestor com botões para "Confirmar Suspensão" ou "Manter Ativo (Rejeitar Suspensão)", registrando a decisão em auditoria.',
      },
      {
        titulo: '7. Aba "Meu Desempenho" no Portal do Prestador (Sem Comparação e Sem Finanças)',
        descricao:
          'O profissional credenciado (externo ou interno) acessa a aba "Meu Desempenho" no Portal do Prestador. O painel exibe com total transparência seus próprios índices, nota composta, tendência e gráfico histórico mensal. REGRA RÍGIDA DE SEGURANÇA: o portal NUNCA compara com outros prestadores e NUNCA expõe custo-hora, salário, margem financeira ou valores contratuais de clientes.',
      },
    ],
    regrasAutomaticas: [
      'Recálculo automático acionado por eventos operacionais (hooks de OS, medições e avaliações).',
      'Preservação imutável de snapshots mensais e histórico de versões de parâmetros na coleção parametros_scorecards.',
      'Suspensão técnica sempre assistida por decisão humana obrigatória (zero suspensão arbitrária por algoritmo).',
      'Segmentação estrita por RLS: prestadores só leem seu próprio registro via endpoint seguro /portal-prestador/meu-scorecard.',
    ],
  },
  {
    id: 'funil-enxuto-5-colunas',
    titulo: 'Funil Comercial Enxuto (5 Colunas)',
    subtitulo:
      'Nova esteira de intermediação: Prospecção → Qualificação → Proposta → Negociação → Fechada',
    icone: Kanban,
    corIcone: 'text-sky-600',
    perfisPermitidos: ['admin', 'comercial', 'gestor'],
    descricao:
      'A esteira comercial do GESTÃO G+ opera de forma objetiva em 5 macroetapas contínuas: 1. Prospecção (captação ativa e oportunidades PNCP), 2. Qualificação (validação de interesse e decisores), 3. Proposta (elaboração técnica com margem e cascata), 4. Negociação (ajustes, alçada e contrapropostas) e 5. Fechada (aceite formal que promove o parceiro e abre a contratação do projeto). A transição entre colunas é intuitiva e recalcula os indicadores em tempo real.',
    passos: [
      {
        titulo: '1. Navegação visual no Funil Enxuto',
        descricao:
          'Acesse o menu Funil para acompanhar os cards distribuídos nas 5 colunas. Cada card exibe a Razão Social, classificação Curva ABC (Pareto), tempo de permanência na etapa e data do último toque registrado.',
        dica: 'Empresas sem movimentação recente são sinalizadas com indicador de atenção para evitar estagnação comercial.',
      },
      {
        titulo: '2. Movimentação e Avanço de Etapa',
        descricao:
          'Arraste o card ou utilize as ações internas do modal da empresa para avançar entre as 5 etapas. Cada avanço sincroniza automaticamente o status no banco de dados e agenda o próximo passo na cadência.',
      },
      {
        titulo: '3. Promoção Automática no Fechamento',
        descricao:
          'Ao mover uma oportunidade para a 5ª coluna ("Fechada / Ganha"), o sistema promove o cliente a Parceiro Demandante formal e dispara o fluxo de contratação do projeto na engenharia.',
      },
    ],
    regrasAutomaticas: [
      'Cálculo automático de permanência em dias em cada uma das 5 colunas.',
      'Sincronização imediata de permissões: Comercial e Admin operam; Gestor e Financeiro consultam.',
      'Auditoria de cada transição de etapa com registro de usuário, timestamp e justificativa.',
    ],
  },
  {
    id: 'selo-parceira',
    titulo: 'Selo Parceira & Classificação de Relacionamento',
    subtitulo: 'Distinção formal de empresas com contratos assinados e projetos entregues',
    icone: Award,
    corIcone: 'text-emerald-600',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'O Selo Parceira é a chancela oficial concedida a empresas clientes que já formalizaram contratos de prestação de serviços técnicos e concluíram ciclos de projetos com a G+ Engenharia. A distinção confere prioridade operacional, prazos diferenciados e integração direta na carteira ativa de parceiros.',
    passos: [
      {
        titulo: '1. Atribuição do Selo Parceira',
        descricao:
          'O selo é atribuído automaticamente quando uma proposta é aceita e o Contrato de Serviços tem assinatura bilateral confirmada, ou pode ser atribuído manualmente pelo Admin no cadastro da empresa.',
      },
      {
        titulo: '2. Identificação Visual na Plataforma',
        descricao:
          'Empresas portadoras do Selo Parceira exibem uma insígnia verde com ícone de handshake no funil, nas listagens de empresas, no cabeçalho das propostas e na seleção de clientes de projetos.',
        dica: 'Utilize o filtro rápido de "Apenas Parceiras" para focar ações de pós-venda e retenção.',
      },
      {
        titulo: '3. Monitoramento de Recorrência',
        descricao:
          'Parceiras sem novas demandas há mais de 180 dias acionam um alerta preventivo no sininho superior para reativação comercial estratégica.',
      },
    ],
    regrasAutomaticas: [
      'Selo gravado de forma estruturada no campo booleano ou status parceira do cadastro.',
      'Preservação do histórico e auditoria de concessão ou revogação do selo.',
    ],
  },
  {
    id: 'o-que-fazer-hoje',
    titulo: 'Bloco "O Que Fazer Hoje"',
    subtitulo: 'Priorização diária inteligente de toques, cobranças e tarefas críticas',
    icone: CalendarCheck,
    corIcone: 'text-amber-600',
    perfisPermitidos: ['admin', 'comercial', 'gestor'],
    descricao:
      'Painel inteligente de ações prioritárias consolidado no início da jornada diária. O bloco reúne tarefas vencendo no dia, toques de cadência pendentes, contratos aguardando assinatura, cobranças de prazos e revisões com SLA próximo do limite, ordenando por gravidade e impacto financeiro.',
    passos: [
      {
        titulo: '1. Consulta Matinal do Bloco',
        descricao:
          'Ao acessar a aplicação ou o painel de Ações do Dia, o bloco "O Que Fazer Hoje" lista em ordem de urgência as tarefas distribuídas nas categorias: Ações Comerciais, Prazos Operacionais e Contratos Críticos.',
      },
      {
        titulo: '2. Execução Direta com 1 Clique',
        descricao:
          'Cada item possui botão de ação direta: disparar mensagem no WhatsApp oficial, abrir modal de envio de contrato, registrar toque ou aprovar medição.',
        dica: 'Ao concluir uma tarefa, o item é baixado imediatamente da lista sem necessidade de recarregar a tela.',
      },
      {
        titulo: '3. Indicadores de Meta Diária',
        descricao:
          'A barra de progresso no topo do bloco exibe a porcentagem de tarefas concluídas no dia, estimulando a regularização contínua das pendências.',
      },
    ],
    regrasAutomaticas: [
      'Geração dinâmica baseada nas regras de cadência (D0 a D30) e nos prazos contratuais de projetos.',
      'Alerta sonoro/visual no sininho superior quando itens críticos ultrapassam o prazo limite.',
    ],
  },
  {
    id: 'trilha-do-negocio',
    titulo: 'Trilha do Negócio & Linha do Tempo',
    subtitulo:
      'Rastreabilidade visual da esteira completa: Lead → Proposta → Contrato → OS → Pagamento',
    icone: Layers,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial', 'financeiro', 'gestor'],
    descricao:
      'Componente visual presente nas principais fichas operacionais que demonstra em qual estágio exato a demanda se encontra dentro do ciclo de vida da G+ Engenharia. Oferece clareza imediata sobre quem é o responsável pela próxima ação, prazos acordados e pendências impeditivas.',
    passos: [
      {
        titulo: '1. Visualização das Etapas da Trilha',
        descricao:
          'A trilha é segmentada em marcos sequenciais: 1. Prospecção/Cadastro, 2. Proposta Técnica (PROP), 3. Contrato de Serviço (CTR), 4. Projeto & Ordens de Serviço (OS), 5. Medições e Faturamento (NF/Contas).',
      },
      {
        titulo: '2. Identificação de Gargalos',
        descricao:
          'Etapas concluídas exibem check verde e data de conclusão; a etapa corrente destaca-se com borda laranja pulsante e badge de responsável; etapas futuras permanecem em tom neutro.',
      },
      {
        titulo: '3. Acesso aos Documentos de Cada Marco',
        descricao:
          'Clique em qualquer marco passado da trilha para inspecionar os registros vinculados (proposta aceita, contrato assinado, ordem de serviço emitida ou fatura baixada).',
      },
    ],
    regrasAutomaticas: [
      'Atualização automática de status baseada em eventos do servidor (aceite digital, assinatura de contrato, homologação de medição).',
      'Ocultação estrita para prestadores externos (resguardo de dados estratégicos e comerciais).',
    ],
  },
  {
    id: 'monitoramento-prazos-os',
    titulo: 'Monitoramento & Cobrança de Prazos de OS',
    subtitulo: 'Acompanhamento preventivo, semáforo diário, SLA de revisão e escalonamento',
    icone: Briefcase,
    corIcone: 'text-indigo-600',
    perfisPermitidos: ['admin', 'gestor'],
    descricao:
      'Módulo especializado para gestão preventiva do cumprimento de prazos das Ordens de Serviço (OS) com os prestadores credenciados. Monitora entregáveis, versões submetidas, SLAs de revisão técnica pela G+ Engenharia e dispara lembretes idempotentes com canal de escalonamento.',
    passos: [
      {
        titulo: '1. Painel de Monitoramento de Prazos (/monitoramento)',
        descricao:
          'Consulte a matriz de OS ativas filtradas por status de prazo: No Prazo (Verde), Alerta Preventivo (Amarelo, D-3), Vencendo Hoje (Laranja) e Em Atraso (Vermelho).',
      },
      {
        titulo: '2. SLA de Revisão de Entregáveis',
        descricao:
          'Quando o prestador envia uma nova versão de prancha ou memorial, o relógio de SLA interno da G+ Engenharia (padrão 48h, parametrizável na Administração) é iniciado para garantir retorno ágil.',
        dica: 'O gestor pode aprovar a versão, solicitar correções pontuais ou reprovar com justificativa técnica.',
      },
      {
        titulo: '3. Cobranças Automáticas e Idempotentes',
        descricao:
          'O robô de monitoramento avalia diariamente as OS e dispara eventos de cobrança registrados na coleção eventos_cobranca, prevenindo duplicações através de chave de idempotência.',
      },
    ],
    regrasAutomaticas: [
      'Imutabilidade dos eventos de cobrança gerados pelo robô (delete e update bloqueados).',
      'Isolamento estrito: cada prestador só acessa os eventos e cobranças referentes às suas próprias ordens de serviço.',
      'Parâmetros de monitoramento (dias de lembrete, aviso, cobrança e escalonamento) configuráveis exclusivamente pelo Admin na Administração.',
    ],
  },
  {
    id: 'ia-operacao',
    titulo: 'Inteligência Artificial a Serviço da Operação',
    subtitulo: '5 parâmetros de controle na Administração e recusa segura quando desativada',
    icone: Sparkles,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial', 'gestor'],
    descricao:
      'Recursos inteligentes integrados às rotinas diárias da G+ Engenharia para acelerar redação de escopos, justificar seleção de prestadores, sugerir mensagens operacionais no canal de OS, gerar resumo do dia para gestores e apoiar a pré-revisão técnica de entregáveis. Todos os recursos são governados por 5 interruptores na Administração com política de recusa segura (graceful failure).',
    passos: [
      {
        titulo: '1. Controle Central dos 5 Parâmetros na Administração (Admin)',
        descricao:
          'Em Administração > IA & Parâmetros, o Administrador controla os 5 interruptores individuais: 1. ia_escopo (redação de escopos), 2. ia_justificativa_prestador (motivação de escolha), 3. ia_texto_canal (redação de comunicados), 4. ia_resumo_dia (síntese executiva diária) e 5. ia_pre_revisao (análise prévia de conformidade técnica).',
      },
      {
        titulo: '2. Política de Recusa Segura (Gatekeeper)',
        descricao:
          'Se uma chave de IA estiver desligada ("false"), o backend recusa a requisição de forma limpa e informativa, informando que a funcionalidade está desabilitada nas configurações sem gerar erros 500 nem quebrar o formulário.',
        dica: 'A IA atua estritamente como copiloto consultivo: nenhuma decisão contratual ou financeira é tomada sem validação e clique explícito de um usuário humano.',
      },
      {
        titulo: '3. Pré-Revisão Inteligente de Entregáveis',
        descricao:
          'Ao receber arquivos de prestadores, o gestor pode solicitar a pré-revisão técnica. A IA analisa o conteúdo frente ao escopo contratado e lista conformidades e possíveis omissões para conferência do engenheiro responsável.',
      },
    ],
    regrasAutomaticas: [
      'Validação prévia das 5 chaves de parâmetros no banco antes de qualquer processamento.',
      'Auditoria de cada interação assistida por IA na trilha audit_logs.',
      'Ausência total de dados confidenciais de margens ou custos globais nos prompts operacionais.',
    ],
  },
  {
    id: 'limpeza-dados-negocio',
    titulo: 'Limpeza de Negócio & Saneamento de Testes (Admin)',
    subtitulo: 'Painel seguro de reset de dados de homologação sem apagar tabelas ou configurações',
    icone: Shield,
    corIcone: 'text-rose-600',
    perfisPermitidos: ['admin'],
    descricao:
      'Ferramenta exclusiva de nível executivo em Administração > "Limpeza de Dados de Negócio" para saneamento pontual de dados mockados, transações simuladas e registros temporários de teste, preservando integralmente o catálogo oficial, os usuários com login, os parâmetros do sistema e a estrutura de coleções.',
    passos: [
      {
        titulo: '1. Acesso Restrito ao Painel de Limpeza',
        descricao:
          'Apenas o usuário Administrador autenticado possui permissão para acessar a aba de Limpeza na Administração. Perfis Comercial, Financeiro, Gestor e Executor não veem o painel nem têm autorização no endpoint.',
      },
      {
        titulo: '2. Exibição Transparente de Contagens',
        descricao:
          'O painel lista previamente a contagem exata de registros em cada coleção que será higienizada (propostas de teste, projetos pilotos, contas simuladas, notificações antigas).',
      },
      {
        titulo: '3. Confirmação Rigorosa com Frase de Segurança',
        descricao:
          'Para evitar acidentes, a operação exige a digitação exata de uma frase de confirmação ("CONFIRMAR LIMPEZA DE DADOS DE NEGOCIO"). O botão permanece desabilitado até a conferência do texto.',
        dica: 'Cadastros e parâmetros oficiais configurados nas migrações são preservados permanentemente.',
      },
    ],
    regrasAutomaticas: [
      'Bloqueio irrestrito no servidor: recusa de chamadas anônimas ou de perfis não-Admin.',
      'Gravação de evento detalhado na Auditoria Imutável (LIMPEZA_DADOS_NEGOCIO) contendo a contagem de registros removidos e a identidade do Administrador.',
      'Migrações de limpeza são estruturadas como no-op idempotentes para não impactar novas implantações.',
    ],
  },
  {
    id: 'custo-interno-operacional',
    titulo: 'Custo Interno Operacional & Apontamento de Horas',
    subtitulo:
      'Vigências de remuneração, apontamento técnico no Portal, aprovação em lote, rateio no Financeiro e indicador "Fazer Dentro ou Fora"',
    icone: Users,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'gestor', 'financeiro', 'executor'],
    descricao:
      'O módulo de Custo Interno Operacional permite apurar com rigor contábil e gerencial a dedicação da equipe técnica própria da G+ Engenharia alocada nos projetos. O fluxo contempla o cadastro confidencial de vigências de custo pelo Admin/Financeiro, a chave seletiva de apontamento nas Ordens de Serviço, o lançamento semanal pelo profissional no Portal sem nenhuma informação salarial visível, a mesa semanal de aprovação do Gestor, a consolidação do rateio na nova aba do Financeiro e o painel estratégico "Fazer Dentro ou Fora" na Administração.',
    passos: [
      {
        titulo: '1. Cadastro de Vigências de Custo do Profissional (Admin & Financeiro)',
        descricao:
          'Em Prestadores › Custos & Vigências, o Admin ou Financeiro cadastra o histórico de remuneração do profissional interno: data de início, data fim (opcional), custo mensal contratado (R$) e horas/mês (padrão 176h). O custo-hora é derivado automaticamente no servidor. O cadastro inicia vazio até preenchimento pelo Admin: enquanto não houver vigência ativa cadastrada, o prestador e suas OS exibem o aviso "custo não configurado" com custo apurado zerado.',
        dica: 'O histórico de vigências é confidencial e nunca é exposto aos prestadores nem em relatórios externos.',
      },
      {
        titulo: '2. Chave "Exige Apontamento" na Ordem de Serviço (Gestor)',
        descricao:
          'Nas Ordens de Serviço emitidas para a equipe interna (projeto ou aba Prestadores), o Gestor define se a OS exige apontamento detalhado de horas ou se o custo deve ser estimado com base nos dias úteis de lead time da OS frente à capacidade simultânea do profissional.',
      },
      {
        titulo: '3. Lançamento Diário no Portal do Profissional ("Minhas Horas")',
        descricao:
          'O membro da equipe técnica própria acessa o Portal do Prestador e visualiza a aba dedicada "Minhas Horas". Ali, seleciona a OS delegada, a data de execução, a atividade técnica (Produção, Revisão, Correção ou Reunião), a fração de horas trabalhadas em passos de 0,25h (15 min) e a descrição técnica do serviço realizado. REGRA DE SEGURANÇA MANDATÓRIA: o portal do profissional não exibe nenhum valor monetário (sem custo_hora, sem salário, sem valor da OS e sem margem).',
        dica: 'O formulário oferece atalhos rápidos de 0,25h, 0,5h, 1h, 2h, 4h e 8h com visualização da semana corrente e status de aprovação de cada lançamento.',
      },
      {
        titulo: '4. Mesa Semanal de Aprovação em Lote (Gestor & Admin)',
        descricao:
          'Em Prestadores › aba "Aprovação de Horas", o Gestor ou Admin analisa a mesa de apontamentos pendentes. É possível selecionar apontamentos individualmente ou em lote para "Aprovar Lote" (com recálculo automático instantâneo do custo apurado e horas acumuladas nas OS afetadas) ou "Rejeitar Lote" (com exigência obrigatória de justificativa técnica auditada).',
      },
      {
        titulo: '5. Rateio no Financeiro & Painel "Fazer Dentro ou Fora"',
        descricao:
          'No módulo Financeiro, a nova aba "Custo Interno" consolida os valores apurados por projeto e por competência mensal (mês/ano), detalhando a quantidade de OS internas, horas dedicadas e valor total rateado, com link direto de navegação para a aba "Fazer Dentro ou Fora" na Administração. Ali, o indicador algorítmico compara o custo horário da equipe própria contra referências externas (pré-cotações e catálogo base de 40h) e recomenda formalmente "Fazer Dentro" ou "Fazer Fora" com cálculo percentual de economia estimada.',
      },
      {
        titulo: '6. Margem Real na Saúde Financeira & Ocupação no Monitoramento',
        descricao:
          'O custo interno apurado debita diretamente do custo comprometido do projeto, reduzindo a Margem Real calculada em tempo real no Painel de Saúde Financeira do Projeto. Paralelamente, o Painel de Carga de Prestadores no Monitoramento de Prazos (/monitoramento) exibe a barra de ocupação semanal em horas e dispara alerta visual vermelho quando a alocação da equipe técnica interna ultrapassar 100% da capacidade semanal.',
      },
    ],
    regrasAutomaticas: [
      'Segmentação estrita: custo_hora, salário e margem financeira nunca chegam ao Portal do Prestador (perfil executor).',
      'Validação de integridade: lançamentos em passos de 0,25h e auditoria de aprovação/rejeição no servidor.',
      'Recálculo automático do custo apurado da OS ao aprovar apontamentos no endpoint seguro /backend/v1/apontamentos/aprovar-lote.',
      'Alerta automático de sobrecarga acima de 100% da capacidade semanal no Monitoramento de Prazos.',
    ],
  },
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
    id: 'prospeccao-automatica',
    titulo: 'Prospecção Automática & Fontes Públicas (Rodada 14)',
    subtitulo:
      'Varredura diária no PNCP e TCE-CE, importador CSV dinâmico, triagem em lote e conformidade CEIS/CNEP',
    icone: Sparkles,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'comercial'],
    descricao:
      'Sistema automatizado de detecção de oportunidades de intermediação em contratos públicos de engenharia. O motor analisa dados oficiais (PNCP, TCE-CE SIM, Comprasnet e Ceará Transparente), enriquece dados via BrasilAPI/CNPJ, descarta CPFs e duplicidades, gera pontuação de relevância (Score ABC) e submete as oportunidades para triagem em lote.',
    passos: [
      {
        titulo: '1. Fontes de Prospecção & Agendamento (Administração)',
        descricao:
          'Na aba "Fontes Prospecção" da Administração, visualize e gerencie as 5 fontes oficiais: PNCP Contratos (API pública diária), TCE-CE SIM Contratações (municípios e exercício configuráveis), Importador CSV Comprasnet, Importador CSV Ceará Transparente e Portal da Transparência CGU (sanções CEIS/CNEP). Cada fonte expõe parâmetros editáveis, agendamento diário às 03:00 (cron), registro da última execução com contador de lidos/sugeridos/incorporados, último erro real e botão "Rodar agora". O Portal da Transparência permanece desligado com aviso amigável caso a chave PORTAL_TRANSPARENCIA_API_KEY não esteja configurada no servidor.',
        dica: 'Utilize o botão "Rodar agora" para disparar a extração imediata de uma fonte específica sem esperar pelo cron da madrugada.',
      },
      {
        titulo: '2. Importador CSV Dinâmico com Mapeamento Salvo',
        descricao:
          'Para bases que não possuem API aberta (ex: Comprasnet após desligamento do endpoint ou Ceará Transparente), acerte o mapeamento dinâmico de colunas (CNPJ, Razão Social, Órgão, Contrato, Objeto, Valor, Vigência). O sistema salva as preferências na coleção fontes_prospeccao e ingere o arquivo oficial de forma idêntica à varredura automática.',
      },
      {
        titulo: '3. Fila de Sugestões Reformulada & Filtros Avançados',
        descricao:
          'Em Funil › Sugestões (/funil/sugestoes), filtre a fila de oportunidades por fonte de origem, relevância (alta/média/baixa conforme score 0-100), UF e município, valor mínimo de contrato e status de vigência (vigente ou encerrado). Clique sobre qualquer sugestão para abrir a Ficha Completa com o objeto na íntegra, órgão contratante, vigência e link oficial do contrato.',
      },
      {
        titulo: '4. Triagem em Lote (Aprovar, Descartar e Incorporar)',
        descricao:
          'Selecione múltiplas sugestões e execute ações em massa: "Aprovar Selecionadas" (para validação prévia), "Incorporar ao Funil" (cria a empresa na etapa Identificada do Funil Comercial e gera rascunho de contrato pré-preenchido) ou "Descartar com Motivo". Ao descartar, o operador obrigatoriamente preenche o motivo auditado e o CNPJ/CNAE/objeto alimenta a Lista de Exclusão de Prospecção para que varreduras futuras não recriem a oportunidade (sem afetar a lista Não Contatar LGPD).',
      },
      {
        titulo: '5. Conformidade e Badge de Sanção (CEIS / CNEP)',
        descricao:
          'Na ficha da empresa e na Fila de Sugestões, o sistema exibe o badge de conformidade: "Sancionada" (bloqueio preventivo de toques de cadência e campanhas automáticas), "Sanção Verificada" (livre de penalidades) ou "Sanção Não Verificada" (caso a chave da CGU não esteja configurada).',
      },
      {
        titulo: '6. Métricas por Fonte na Central de Ações',
        descricao:
          'Na Central de Ações (Ações do Dia), o cartão de métricas consolidadas exibe o placar de contratos lidos, sugestões geradas, empresas incorporadas e créditos de IA consumidos por cada fonte configurada.',
      },
    ],
    regrasAutomaticas: [
      'Deduplicação automática por CNPJ: contratos de empresas já presentes no banco ou em sugestões anteriores não geram registros duplicados.',
      'Descarte automático de CPFs: contratos firmados com pessoas físicas são descartados da prospecção de empresas.',
      'Enriquecimento automático via BrasilAPI: consulta dados cadastrais, CNAE e situação na Receita Federal.',
      'Bloqueio de cadência para empresas com sanção confirmada (flag cadencia_bloqueada_sancao).',
      'Descartes em lote alimentam a lista própria de exclusão de prospecção e não misturam com opt-out LGPD.',
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
      {
        titulo: '8. Fluxo de Pré-Cotação Vinculante (Rodada 13)',
        descricao:
          'Na planilha orçamentária da proposta, utilize o botão "Pré-cotar" por item ou "Pré-cotar Todos os Itens". O sistema anonimiza o escopo (remove cliente, obra, órgão e BDI) e convida até 5 prestadores homologados com contrato-mestre assinado. O ranking calcula preço, prazo, nota técnica e capacidade. Ao escolher o vencedor, o item ganha o selo "Custo Cotado" e o preço/prazo são travados. Na assinatura bilateral do contrato, a trava é transportada para a OS do projeto, dispensando nova cotação automática. Caso não haja prestadores elegíveis, o item sinaliza "Sem Cotação" e gera cartão na Central de Ações com chamada direta para recrutamento público.',
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
    id: 'recrutamento-triagem-prestadores',
    titulo: 'Recrutamento & Triagem Técnica de Prestadores',
    subtitulo: 'Links públicos por slug, esteira em 4 etapas, honeypot anti-spam e triagem técnica',
    icone: UserCheck,
    corIcone: 'text-[#D95A2B]',
    perfisPermitidos: ['admin', 'gestor'],
    descricao:
      'Fluxo completo de credenciamento e triagem técnica para atração e homologação de prestadores de engenharia (PF e PJ). Abrange a criação de links parametrizados na Administração, o preenchimento público sem login, defesa anti-abuso e a mesa de avaliação na aba Triagem de Prestadores.',
    passos: [
      {
        titulo: '1. Gestão de Links de Recrutamento na Administração',
        descricao:
          'Em Administração > Links de Recrutamento, o Admin ou Gestor cria links amigáveis com slug exclusivo (ex: /pre-cadastro/estruturas-sp, /pre-cadastro/bim-eletrica). Cada link possui título descritivo, disciplina-alvo, prazo de expiração (padrão 30 dias, parametrizável) e contador de acessos em tempo real. É possível ativar, pausar ou copiar o link com 1 clique.',
        dica: 'O link geral padrão (/pre-cadastro/geral) permanece sempre ativo para captação institucional contínua.',
      },
      {
        titulo: '2. Pré-Cadastro Público (/pre-cadastro/:slug) em 4 Etapas',
        descricao:
          'O candidato acessa o formulário sem necessidade de login e percorre 4 etapas estruturadas: (1) Identificação e Conselho (PF/PJ, documento com máscara, e-mail, telefone, conselho CREA/CAU/CRT e região); (2) Disciplinas, Softwares BIM e Capacidade simultânea; (3) Portfólio de Trabalhos Anteriores (até 5 projetos com cliente de referência, ano e links de nuvem); (4) Tabela de Preços de Referência, Disponibilidade semanal e Aceite formal dos termos de confidencialidade.',
      },
      {
        titulo: '3. Proteção Honeypot Anti-Spam e Conclusão Segura',
        descricao:
          'A rota pública possui campos honeypot invisíveis e rate limit por IP (padrão 5 envios/hora). Ao submeter, o candidato visualiza uma tela de confirmação formal de recebimento SEM QUALQUER LINK de acesso interno ao sistema, preservando o isolamento da plataforma.',
      },
      {
        titulo: '4. Fila de Triagem Técnica (Prestadores > Triagem)',
        descricao:
          'Na aba "Fila de Triagem Técnica" de Prestadores, os candidatos recém-chegados (status "triagem") exibem o badge de origem ("Público (Recrutamento)"). Ao selecionar a ficha, o avaliador inspeciona portfólio, referências de preços e disponibilidade, podendo: (a) Aprovar Triagem (promove para status "pendente", registra parecer/nota e gera minuta de Contrato-Mestre); (b) Recusar Triagem (exige motivo obrigatório para auditoria e move para "inativo"); ou (c) Pedir Complemento de Dados (gera link seguro com token criptográfico de retorno com prazo configurável).',
      },
    ],
    regrasAutomaticas: [
      'Validação de taxa de submissão por IP parametrizada em recrutamento_rate_limit_ip_hora.',
      'Validação de links expirados ou inativos antes da exibição do formulário.',
      'Auditoria de cada deliberação de triagem (aprovação, recusa, complemento) com registro do gestor e parecer.',
    ],
  },
  {
    id: 'portal-prestador-meu-cadastro',
    titulo: 'Portal do Prestador & Aba "Meu Cadastro"',
    subtitulo:
      'Ambiente isolado, portfólio técnico, preços de referência, disponibilidade e documentos',
    icone: HardHat,
    corIcone: 'text-amber-600',
    perfisPermitidos: ['admin', 'gestor', 'executor'],
    descricao:
      'Espaço de trabalho seguro do prestador credenciado na plataforma G+. Além de responder a cotações técnicas e assinar Ordens de Serviço (OS), o prestador conta com a aba "Meu Cadastro" para manter seu perfil técnico sempre atualizado junto à engenharia da G+.',
    passos: [
      {
        titulo: '1. Portfólio Técnico de Trabalhos',
        descricao:
          'Na aba "Meu Cadastro", o prestador adiciona e edita até 10 projetos realizados, incluindo título, cliente/contratante, ano de conclusão, disciplina aplicada, link para nuvem (Drive/OneDrive) e descrição do escopo.',
      },
      {
        titulo: '2. Tabela de Preços de Referência & Disponibilidade Semanal',
        descricao:
          'O prestador informa valores médios de referência por hora, prancha (A1), metro quadrado ou diária, além da carga horária semanal disponível, prazo para início e observações de agenda, agilizando cotações futuras.',
      },
      {
        titulo: '3. Envio de Documentos Comprobatórios Protegidos',
        descricao:
          'O formulário seguro permite o envio de arquivos PDF ou imagens nos tipos oficiais aceitos pelo backend: Registro no Conselho (CREA/CAU/CRT), Certidão de Regularidade Profissional, RG/CNH, Comprovante de Residência, Contrato Social/MEI, Certidão Tributária e Currículo/Acervo Técnico (CAT).',
        dica: 'Os arquivos são gravados com proteção de acesso e passam por verificação técnica da equipe gestora.',
      },
      {
        titulo: '4. Isolamento Absoluto de Dados de Negócio',
        descricao:
          'Por regras de segurança no servidor (RLS e endpoints dedicados), nenhum dado de cliente, obra, proposta comercial, valor de contrato, BDI ou informações de outros prestadores alcança o Portal do Prestador.',
      },
    ],
    regrasAutomaticas: [
      'Validação server-side dos tipos de documento contra o schema oficial da coleção prestadores_documentos.',
      'Auditoria de cada atualização cadastral na trilha audit_logs vinculada ao e-mail autenticado.',
      'Acesso do prestador restrito estritamente aos seus próprios documentos e Ordens de Serviço.',
    ],
  },
  {
    id: 'executores',
    titulo: 'Módulo Prestadores & Executores Homologados',
    subtitulo: 'Homologação técnica, contratos-mestre com NDA, OS e nota ponderada',
    icone: Briefcase,
    corIcone: 'text-amber-600',
    perfisPermitidos: ['admin', 'gestor', 'comercial'],
    descricao:
      'Credenciamento de profissionais e empresas especializadas de engenharia (projetistas, calculistas, desenhistas, peritos), formalização de Contratos-Mestre com cláusulas de confidencialidade (NDA), emissão de Ordens de Serviço formais e avaliação de performance.',
    passos: [
      {
        titulo: 'Cadastrar prestador técnico homologado',
        descricao:
          'Preencha dados cadastrais, número de registro profissional (CREA/CAU/CRT), especialidades técnicas e modalidade (Equipe Interna, PF Externo ou PJ Externo). Para PJ, vincule a equipe de profissionais técnicos.',
      },
      {
        titulo: 'Contrato-Mestre e Cláusulas NDA',
        descricao:
          'Para prestadores externos, gere o Contrato-Mestre de prestação de serviços com cláusulas de confidencialidade e aceite de assinatura eletrônica. A G+ assina primeiro e libera a assinatura do prestador via OTP.',
      },
      {
        titulo: 'Avaliação de Desempenho e Selo de Tendência',
        descricao:
          'Ao concluir entregáveis e ordens de serviço, o Gestor registra notas de 1 a 5. O sistema calcula a nota média e exibe o selo de tendência operacional (Melhorou, Estável ou Piorou) na ficha do prestador.',
      },
    ],
    regrasAutomaticas: [
      'Nota do prestador ponderada por volume e recência com auditoria de avaliações.',
      'Bloqueio preventivo de emissão de novas Ordens de Serviço para prestadores em status Suspenso.',
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
  {
    termo: 'Fila Única de Decisões',
    definicao:
      'Painel gerencial exclusivo para Admin e Gestor (/decisoes) que consolida e prioriza por impacto de negócio todas as pendências que exigem despacho humano: cotações e pré-cotações vencedoras pendentes de conversão em OS, revisões técnicas estagnadas (SLA), apontamentos de horas aguardando aprovação, triagem de prestadores e suspensões reincidentes. Cada item abre o contexto e permite encerramento com clique auditado.',
  },
  {
    termo: 'Matriz de Sigilo e Dados Sensíveis',
    definicao:
      'Regras estritas aplicadas no servidor que protegem dados bancários de prestadores, custo-hora interno, preços de cotação e valor de contratos públicos. O acesso a esses campos sensíveis é intermediado por botões "Ver Detalhe" com aviso legal prévio de que o IP, usuário, data e hora da abertura são gravados de forma indelével nos logs de auditoria.',
  },
  {
    termo: 'Rotas Públicas por Token de Uso Único',
    definicao:
      'Mecanismo de acesso sem login para proponentes e prestadores (/cotacao/:token, /subcontrato/:token, etc.) parametrizado na Administração com controle estrito de validade em horas e limite máximo de tentativas. Tokens expirados ou já utilizados exibem alertas claros e impedem reenvio indevido.',
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
  {
    pergunta: 'Como o Gestor e o Admin operam a nova Fila de Decisões?',
    resposta:
      'Acessando o item "Decisões" no menu lateral. O painel lista os itens pendentes ordenados pelo impacto de negócio (0 a 100). Ao clicar em "Abrir Contexto", é possível analisar o histórico completo e registrar o parecer com "Aprovar / Decidir Agora", gravando uma auditoria imutável.',
  },
  {
    pergunta: 'Por que dados bancários e custos exigem clicar em "Ver Detalhe"?',
    resposta:
      'Para conformidade estrita com a matriz de sigilo e prevenção de vazamentos internos. Ao clicar no botão, o sistema emite um alerta de que o acesso será registrado nos logs com seu usuário, IP e timestamp, desincentivando acessos indevidos e garantindo rastreabilidade pericial total.',
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
