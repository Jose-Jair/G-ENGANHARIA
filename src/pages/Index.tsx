import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  Clock,
  Mail,
  Network,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  Briefcase,
  Layers,
  Lock,
} from 'lucide-react'

export default function Index() {
  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-10">
      {/* Cabeçalho */}
      <header className="border-b pb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sistema de Gestão de Engenharia
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Intermediação de Projetos Públicos & Executores
            </h1>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1 border-primary/40 text-primary">
            Etapa 0 — Alinhamento & Capacidades
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Intermediação técnica e financeira entre <strong>Parceiros Demandantes</strong> (empresas
          com contratos públicos) e <strong>Executores</strong> (engenheiros e empresas executoras).
          Padrão brasileiro: datas em dd/mm/aaaa, moeda em R$ (BRL) e interface 100% em português do
          Brasil.
        </p>
      </header>

      {/* Confirmação de Entendimento e Status */}
      <section className="bg-muted/40 rounded-xl p-6 border space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Entendimento Confirmado — Nenhuma funcionalidade de negócio construída nesta etapa
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conforme solicitado na regra permanente nº 3,{' '}
              <strong>nenhum módulo de negócio foi implementado</strong>. Apresentamos a análise
              completa de capacidades técnicas da plataforma (o que ela consegue e não consegue
              fazer), a matriz de perfis de acesso e o plano sugerido para aprovação prévia antes do
              Módulo 1.
            </p>
          </div>
        </div>
      </section>

      {/* O que a plataforma CONSEGUE e NÃO CONSEGUE fazer */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Capacidades da Plataforma (Análise Técnica dos 5 Itens)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Permissões no servidor */}
          <Card className="border-l-4 border-l-green-600">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  1. Permissões no Servidor
                </CardTitle>
                <Badge className="bg-green-600 hover:bg-green-700 text-white">CONSEGUE</Badge>
              </div>
              <CardDescription>Regras granulares de banco e hooks server-side</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">O que consegue:</strong> O backend PocketBase
                conectado permite definir regras de acesso nativas no banco (
                <code className="text-xs bg-muted px-1 py-0.5 rounded">listRule</code>,{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">viewRule</code>,{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">createRule</code>,{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">updateRule</code>,{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">deleteRule</code>) filtrando
                por perfil do token JWT. Além disso, hooks JavaScript (
                <code className="text-xs bg-muted px-1 py-0.5 rounded">pb_hooks</code>) validam
                ações complexas no servidor antes de gravar no banco.
              </p>
              <p className="text-xs text-foreground/80 pt-1 border-t">
                ✓ Atende integralmente à <strong>Regra 5</strong>: permissões impostas na camada de
                dados, impedindo bypass via console/rede.
              </p>
            </CardContent>
          </Card>

          {/* Tarefas agendadas */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  2. Tarefas Agendadas
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-700 dark:text-amber-400"
                >
                  CONSEGUE C/ RESTRIÇÃO
                </Badge>
              </div>
              <CardDescription>Cron jobs no backend via hooks</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">O que consegue:</strong> Execução de rotinas
                automáticas no backend usando{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">cronAdd</code> (ex.: disparo
                diário de e-mails de prospecção, verificação de prazos de projetos e faturas a
                vencer).
              </p>
              <p>
                <strong className="text-foreground">O que NÃO consegue:</strong> A plataforma impõe
                intervalo mínimo de
                <strong> 10 minutos</strong> para jobs agendados. Não é possível rodar crons a cada
                1 minuto ou 5 minutos. Para rotinas de gestão de engenharia e envio diário/horário,
                atende com total folga.
              </p>
            </CardContent>
          </Card>

          {/* Envio de e-mail */}
          <Card className="border-l-4 border-l-green-600">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-5 w-5 text-green-600" />
                  3. Envio de E-mail
                </CardTitle>
                <Badge className="bg-green-600 hover:bg-green-700 text-white">CONSEGUE</Badge>
              </div>
              <CardDescription>E-mails transacionais e prospecção</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">O que consegue:</strong> Envio transacional
                nativo via Skip Cloud (recuperação de senha, convite de usuário, notificações de
                projeto) e envio programático via hooks de servidor (
                <code className="text-xs bg-muted px-1 py-0.5 rounded">$mails</code>).
              </p>
              <p className="text-xs text-foreground/80 pt-1 border-t">
                ✓ Atende à <strong>Regra 7</strong>: e-mails de prospecção incluirão
                obrigatoriamente link de descadastro (
                <code className="text-xs bg-muted px-1 py-0.5 rounded">/unsubscribe?token=...</code>
                ) e validação contra a tabela de bloqueio &ldquo;Não contatar&rdquo;.
              </p>
            </CardContent>
          </Card>

          {/* Chamada de API externa */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-5 w-5 text-amber-500" />
                  4. Chamadas de API Externa
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-700 dark:text-amber-400"
                >
                  PARCIALMENTE
                </Badge>
              </div>
              <CardDescription>APIs públicas suportadas; serviços pagos restritos</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">O que consegue:</strong> Integração com APIs
                externas públicas (ex.: consulta de CEP via ViaCEP, consulta de CNPJ público da
                Receita/BrasilAPI, IBGE, feriados nacionais).
              </p>
              <p>
                <strong className="text-foreground">O que NÃO consegue:</strong> Serviços externos
                proprietários que exijam SDKs nativos fechados ou contas externas de terceiros com
                segredos não configurados (ex.: Stripe Connect, Twilio WhatsApp corporativo,
                SendGrid dedicado). Usaremos o provedor de e-mail e infraestrutura nativos da Skip
                Cloud.
              </p>
            </CardContent>
          </Card>

          {/* Exportação */}
          <Card className="border-l-4 border-l-green-600 md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  5. Exportação de Dados
                </CardTitle>
                <Badge className="bg-green-600 hover:bg-green-700 text-white">CONSEGUE</Badge>
              </div>
              <CardDescription>
                Exportação em formatos padrão para engenharia e finanças
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">O que consegue:</strong> Geração e download de
                relatórios completos em
                <strong> CSV</strong> (compatível com Excel com separador ponto-e-vírgula e
                codificação UTF-8 com BOM para acentuação BR), relatórios estruturados em{' '}
                <strong>JSON</strong> e visualização para impressão/PDF de relatórios via navegador.
              </p>
              <p className="text-xs text-foreground/80 pt-1 border-t">
                ✓ Aplicável para: medições de obras, repasses a executores, faturamento de parceiros
                demandantes e log de auditoria.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Regras Permanentes do Projeto */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Compromisso com as 9 Regras Permanentes
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              num: '1',
              title: 'Um módulo por vez',
              desc: 'Só executar o que for expressamente solicitado na mensagem atual.',
            },
            {
              num: '2',
              title: 'Não alterar o que funciona',
              desc: 'Preservar telas, fluxos e regras já validadas sem regressões.',
            },
            {
              num: '3',
              title: 'Plano antes de construir',
              desc: 'Apresentar tabelas, telas e regras e aguardar aprovação explícita.',
            },
            {
              num: '4',
              title: 'Perguntar, não presumir',
              desc: 'Esclarecer qualquer ambiguidade de regra de negócio antes de codificar.',
            },
            {
              num: '5',
              title: 'Permissões no servidor',
              desc: 'Validação no banco (PocketBase rules) e pb_hooks, não apenas no front-end.',
            },
            {
              num: '6',
              title: 'Auditoria obrigatória',
              desc: 'Toda ação relevante gera log estruturado: quem, o quê e quando.',
            },
            {
              num: '7',
              title: 'E-mail com opt-out',
              desc: 'Link de descadastro em toda prospecção e respeito à lista "Não contatar".',
            },
            {
              num: '8',
              title: 'Apenas dados fictícios',
              desc: 'CNPJs, nomes de engenheiros, valores e contratos estritamente simulados.',
            },
            {
              num: '9',
              title: 'Pendências ao final',
              desc: 'Lista explícita de itens pendentes entregue ao final de cada etapa.',
            },
          ].map((r) => (
            <Card key={r.num} className="bg-card">
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    R{r.num}
                  </Badge>
                  <h3 className="font-semibold text-sm text-foreground">{r.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Perfis de Acesso */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Perfis de Acesso do Sistema (Matriz de Autorização)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              nome: 'Admin',
              tipo: 'Interno',
              escopo: 'Acesso total a configurações, usuários, auditoria e todos os módulos.',
              cor: 'border-red-500/40 bg-red-500/5',
            },
            {
              nome: 'Comercial',
              tipo: 'Interno',
              escopo: 'Prospecção, Parceiros Demandantes, orçamentos e lista "Não contatar".',
              cor: 'border-blue-500/40 bg-blue-500/5',
            },
            {
              nome: 'Financeiro',
              tipo: 'Interno',
              escopo: 'Faturamento de contratos, repasses de executores, fluxo de caixa e notas.',
              cor: 'border-emerald-500/40 bg-emerald-500/5',
            },
            {
              nome: 'Gestor de Projetos',
              tipo: 'Interno',
              escopo: 'Alocação de executores, acompanhamento de ordens de serviço e prazos.',
              cor: 'border-purple-500/40 bg-purple-500/5',
            },
            {
              nome: 'Executor Externo',
              tipo: 'Externo',
              escopo:
                'Portal restrito: visualiza APENAS seus projetos, ordens e medições atribuídas.',
              cor: 'border-amber-500/40 bg-amber-500/5',
            },
          ].map((p) => (
            <Card key={p.nome} className={`border ${p.cor}`}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground">{p.nome}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {p.tipo}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.escopo}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Proposta de Roteiro de Módulos (Aguardando Aprovação) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Plano Sugerido de Módulos (Aguardando Aprovação Prévia)
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              mod: 'Módulo 1',
              nome: 'Autenticação, Perfis de Usuário & Auditoria Base',
              status: 'Próximo passo proposto',
              tabelas: 'users (perfis), audit_logs',
              telas: 'Login, Recuperação de Senha, Gestão de Usuários (Admin), Meu Perfil',
              regras:
                'Validação no servidor de perfil em cada requisição; registro de login/logout/edição no audit_logs.',
            },
            {
              mod: 'Módulo 2',
              nome: 'Cadastro de Parceiros Demandantes & Executores',
              status: 'Planejado',
              tabelas:
                'demandantes (contratos públicos, órgãos), executores (especialidades, certidões), contatos_nao_contatar',
              telas:
                'Listagem e formulário de Parceiros Demandantes, Cadastro de Executores com upload de certidões fictícias.',
              regras:
                'Executor só pode ser ativado com certidões válidas; Comercial acessa demandantes; Financeiro acessa dados bancários.',
            },
            {
              mod: 'Módulo 3',
              nome: 'Gestão de Projetos, Ordens de Serviço & Intermediação',
              status: 'Planejado',
              tabelas: 'projetos, ordens_servico, entregas_medicoes',
              telas:
                'Kanban/Lista de Projetos, Atribuição de Executores, Portal do Executor (visão restrita).',
              regras:
                'Executor externo só enxerga ordens atribuídas a ele (regra PocketBase no banco).',
            },
            {
              mod: 'Módulo 4',
              nome: 'Módulo Comercial, Prospecção & Lista "Não Contatar"',
              status: 'Planejado',
              tabelas: 'campanhas_prospeccao, envios_emails, lista_nao_contatar',
              telas:
                'Gestão de Prospecção, Disparo com Opt-out, Página pública de descadastro (/descadastro).',
              regras:
                'Bloqueio estrito no servidor de disparo para qualquer e-mail na lista "Não contatar".',
            },
            {
              mod: 'Módulo 5',
              nome: 'Financeiro, Medições & Exportação',
              status: 'Planejado',
              tabelas: 'faturas_demandantes, repasses_executores, retencoes_impostos',
              telas:
                'Painel Financeiro BR (R$), Conciliação de Medições, Exportação CSV/Excel e comprovantes.',
              regras:
                'Apenas Financeiro e Admin visualizam faturamento completo e margem de intermediação.',
            },
          ].map((m, i) => (
            <Card key={m.mod} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{m.mod}</span>
                    <span className="font-semibold text-sm text-foreground">— {m.nome}</span>
                  </div>
                  <Badge variant={i === 0 ? 'default' : 'secondary'} className="text-xs">
                    {m.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
                  <div>
                    <strong className="text-foreground">Tabelas previstas:</strong> {m.tabelas}
                  </div>
                  <div>
                    <strong className="text-foreground">Telas previstas:</strong> {m.telas}
                  </div>
                  <div>
                    <strong className="text-foreground">Regras-chave:</strong> {m.regras}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Lista de Pendências da Etapa */}
      <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <h3 className="font-semibold text-sm text-foreground">
            Pendências desta Etapa (Conforme Regra Permanente nº 9)
          </h3>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>
            <strong>Aprovação do usuário</strong> quanto ao entendimento das regras permanentes e
            das capacidades técnicas da plataforma.
          </li>
          <li>
            <strong>Aprovação do plano detalhado do Módulo 1</strong> (Autenticação, Perfis de
            Usuário e Auditoria Base) antes do início da construção de código/banco.
          </li>
          <li>
            <strong>Definição de eventuais particularidades</strong> de campos para os perfis ou de
            campos específicos para Parceiros Demandantes com contratos públicos.
          </li>
        </ul>
      </section>
    </div>
  )
}
