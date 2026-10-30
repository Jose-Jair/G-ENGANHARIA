# Projeto Criado com o Skip

Este projeto foi criado de ponta a ponta com o [Skip](https://goskip.dev).

## 🚀 Stack Tecnológica

- **React 19** - Biblioteca JavaScript para construção de interfaces
- **Vite** - Build tool extremamente rápida
- **TypeScript** - Superset tipado do JavaScript
- **Shadcn UI** - Componentes reutilizáveis e acessíveis
- **Tailwind CSS** - Framework CSS utility-first
- **React Router** - Roteamento para aplicações React
- **React Hook Form** - Gerenciamento de formulários performático
- **Zod** - Validação de schemas TypeScript-first
- **Recharts** - Biblioteca de gráficos para React

## 📋 Pré-requisitos

- Node.js 18+
- npm

## 🔧 Instalação

```bash
npm install
```

## 💻 Scripts Disponíveis

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm start
# ou
npm run dev
```

Abre a aplicação em modo de desenvolvimento em [http://localhost:5173](http://localhost:5173).

### Build

```bash
# Build para produção
npm run build

# Build para desenvolvimento
npm run build:dev
```

Gera os arquivos otimizados para produção na pasta `dist/`.

### Preview

```bash
# Visualizar build de produção localmente
npm run preview
```

Permite visualizar a build de produção localmente antes do deploy.

### Linting e Formatação

```bash
# Executar linter
npm run lint

# Executar linter e corrigir problemas automaticamente
npm run lint:fix

# Formatar código com Oxfmt
npm run format

# Executar suíte de validação e testes (QA completo)
npm run qa
```

## 🔒 Migrações Idempotentes (Skip Cloud / PocketBase)

As migrações de dados de teste, provas automatizadas e saneamentos do histórico são **estritamente no-op idempotentes**, preservando dados reais de negócio e garantindo que reexecuções ou novos deploys não afetem a integridade do banco:

### Migrações `prova_*` (Idempotentes / Validações Históricas)
- `0067_prova_avaliacoes_executor_completa.js`: Prova isolada do módulo de avaliações, limpa seus próprios registros temporários de teste.
- `0070_prova_cadencia_e_limpeza.js`: Prova de cadência de toques executada e limpa sem resíduos.
- `0073_prova_saude_funil_e_limpeza.js`: Prova de métricas de estagnação de funil.
- `0074_prova_regras_funil_e_limpeza.js`: Prova de regras operacionais de conversão do funil.
- `0075_prova_regras_funil_e_limpeza.js`: Prova de consistência de status e bloqueio.
- `0079_provas_validacao_e_limpeza.js`: Validação de consistência relacional.
- `0083_provas_itens_5_8.js`: Validação de integridade de propostas e projetos.
- `0086_prova_mecanismo_subcontratacao.js`: Validação de retenção técnica e checklist, revertida após teste.
- `0087_prova_confiabilidade_executores.js`: Prova de bloqueio de cotações expiradas e isolamento de executores.

### Migrações `limpeza_*` (Saneamentos e Remoção de Mock Data)
- `0025_limpeza_dados_ficticios_beta.js`: Remoção inicial de sementes mockadas das etapas beta.
- `0034_limpeza_completa_dados_teste.js`: Saneamento de registros de teste do ciclo comercial.
- `0038_limpeza_projetos_duplicados_reset_proposta.js`: Desduplicação de projetos piloto e normalização.
- `0040_limpeza_banco_dados_teste_zero.js`: Marco de limpeza zero do ambiente de homologação.
- `0050_limpeza_cadeia_comercial_teste.js`: Limpeza controlada de simulações da cadeia comercial.
- `0055_limpeza_dados_teste_segunda_rodada.js`: Higienização de dados de teste da rodada 2.
- `0056_limpeza_microprojetos_duplicados_escopo.js`: Desduplicação de microprojetos residuais.
- `0057_limpeza_definitiva_microprojetos.js`: Saneamento definitivo de escopos duplicados.
- `0080_limpeza_completa_teste_zero.js`: Marco de saneamento integral pré-módulo de prestadores.
- `0084_limpeza_completa_teste_zero.js`: Limpeza zero de resíduos com registro em auditoria imutável.

### Migrações `seed_*` (Sementes Estruturais e No-Op em Produção)
- `0006_seed_initial_data.js`: Carga dos parâmetros padrão de sistema, modelos de contrato e catálogo inicial.
- `0007_etapa2_cadastros_permissions_and_seed.js`: Perfis e permissões fundamentais de acesso.
- `0009_etapa3_seed_dados_ficticios.js`: Carga inicial do funil (neutralizada por limpezas posteriores).
- `0011_etapa4_seed_toques_cadencia.js`: Parâmetros de cadência de vendas e templates de toques.
- `0013_etapa5_seed_campanhas_nutricao.js`: Modelos de nutrição mensal.
- `0015_etapa6_seed_dados_ficticios.js`: Carga histórica neutralizada por limpezas de homologação.
- `0017_etapa7_propostas_seed.js`: Modelos base de proposta comercial e catálogo de serviços.
- `0019_seed_etapa8_projetos_executores.js`: Semente histórica da transição legado de projetos.
- `0022_seed_etapa9_financeiro.js`: Plano de contas padrão e centros de custo G+.
- `0028_seed_areas_subservicos_entregaveis.js`: Áreas de atuação técnica e matriz de escopos padrão.
- `0069_seed_test_cadencia.js`: Dados temporários de verificação da cadência (limpos pela migração 0070).
- `0071_seed_test_cadencia.js`: Teste controlado no-op de idempotência de agendamentos.

## 📁 Estrutura do Projeto

```
.
├── src/              # Código fonte da aplicação
├── public/           # Arquivos estáticos
├── dist/             # Build de produção (gerado)
├── node_modules/     # Dependências (gerado)
└── package.json      # Configurações e dependências do projeto
```

## 🎨 Componentes UI

Este template inclui uma biblioteca completa de componentes Shadcn UI baseados em Radix UI:

- Accordion
- Alert Dialog
- Avatar
- Button
- Checkbox
- Dialog
- Dropdown Menu
- Form
- Input
- Label
- Select
- Switch
- Tabs
- Toast
- Tooltip
- E muito mais...

## 📝 Ferramentas de Qualidade de Código

- **TypeScript**: Tipagem estática
- **Oxlint**: Linter extremamente rápido
- **Oxfmt**: Formatação automática de código

## 🔄 Workflow de Desenvolvimento

1. Instale as dependências: `npm install`
2. Inicie o servidor de desenvolvimento: `npm start`
3. Faça suas alterações
4. Verifique o código: `npm run lint`
5. Formate o código: `npm run format`
6. Crie a build: `npm run build`
7. Visualize a build: `npm run preview`

## 📦 Build e Deploy

Para criar uma build otimizada para produção:

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/` e estarão prontos para deploy.
