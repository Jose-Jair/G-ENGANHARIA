import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import NotificacoesPage from './pages/Notificacoes'
import LoginPage from './pages/Login'
import IndexPage from './pages/Index'
import WelcomePage from './pages/Welcome'
import AdministracaoPage from './pages/Administracao'
import AuditoriaPage from './pages/Auditoria'
import DashboardPage from './pages/Dashboard'
import EmpresasPage from './pages/Empresas'
import EmpresasImportarPage from './pages/EmpresasImportar'
import FunilPage from './pages/Funil'
import FunilSugestoesPage from './pages/FunilSugestoes'
import NaoContatarPage from './pages/NaoContatar'
import AcoesDoDiaPage from './pages/AcoesDoDia'
import CampanhasPage from './pages/Campanhas'
import DescadastroPage from './pages/Descadastro'
import { ParceirosPage } from './pages/Parceiros'
import { ClientesPfPage } from './pages/ClientesPf'
import { PropostasPage } from './pages/Propostas'
import { PropostaPublicaPage } from './pages/PropostaPublica'
import { ContratoServicoPublicoPage } from './pages/ContratoServicoPublico'
import { ComplementoDadosClientePage } from './pages/ComplementoDadosCliente'
import { ProjetosPage } from './pages/Projetos'
import { GrupoProjetosPage } from './pages/GrupoProjetos'
import { ExecutoresPage } from './pages/Executores'
import { PrestadoresPage } from './pages/Prestadores'
import { PortalPrestadorPage } from './pages/PortalPrestador'
import { MonitoramentoPrazosPage } from './pages/MonitoramentoPrazos'
import { CotacaoPublicaPage } from './pages/CotacaoPublica'
import { SubcontratoPublicoPage } from './pages/SubcontratoPublico'
import { CadastroExecutorPublicoPage } from './pages/CadastroExecutorPublico'
import { FinanceiroPage } from './pages/Financeiro'
import { ManualUsoPage } from './pages/ManualUso'
import { PortalExecutorPage } from './pages/PortalExecutor'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public opt-out route for campaigns (LGPD) */}
          <Route path="/descadastro/:token" element={<DescadastroPage />} />
          <Route path="/descadastro" element={<DescadastroPage />} />

          {/* Rota pública de aceite/recusa de proposta (Etapa 7) - sem login */}
          <Route path="/proposta/:token" element={<PropostaPublicaPage />} />

          {/* Rota pública de complemento de dados cadastrais (Bloco 3) - sem login */}
          <Route path="/completar-cadastro/:token" element={<ComplementoDadosClientePage />} />

          {/* Rota pública de assinatura eletrônica do Contrato de Serviços GMAIS */}
          <Route path="/contrato-servico/:token" element={<ContratoServicoPublicoPage />} />
          <Route path="/contrato/:token" element={<ContratoServicoPublicoPage />} />

          {/* Rota pública de resposta de cotação do executor (Etapa 8) - sem login */}
          <Route path="/cotacao/:token" element={<CotacaoPublicaPage />} />

          {/* Rota pública de assinatura eletrônica do Termo de Subcontratação (Bloco 5) - sem login */}
          <Route path="/subcontrato/:token" element={<SubcontratoPublicoPage />} />

          {/* Rota pública de cadastro/credenciamento de executor por convite com token - sem login */}
          <Route path="/cadastro-executor" element={<CadastroExecutorPublicoPage />} />

          {/* Authenticated routes wrapped with AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<IndexPage />} />
            {/* BLOCO 6: Portal do Executor (Acesso Exclusivo para perfis Executor, com visualização para Admin/Gestor) */}
            <Route
              path="/portal-executor"
              element={
                <ProtectedRoute allowedRoles={['executor', 'admin', 'gestor']}>
                  <PortalExecutorPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 11: Dashboard Executivo (Acesso Exclusivo do Admin) */}
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />{' '}
            <Route path="/boas-vindas" element={<WelcomePage />} />
            {/* RODADA 6: Central de Notificações Unificada */}
            <Route
              path="/notificacoes"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'comercial', 'financeiro', 'gestor', 'executor']}
                >
                  <NotificacoesPage />
                </ProtectedRoute>
              }
            />
            {/* MANUAL DE USO DA PLATAFORMA (Acesso a todos os perfis autenticados com login) */}
            <Route
              path="/manual"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <ManualUsoPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 7: Módulo Propostas (Admin e Comercial gravam; Financeiro e Gestor leem) */}
            <Route
              path="/propostas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <PropostasPage />
                </ProtectedRoute>
              }
            />
            {/* Redirecionamento legado: Contratos de Serviço agora vivem dentro do Projeto em /projetos como aba */}
            <Route
              path="/contratos-servico"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <Navigate to="/projetos" replace />
                </ProtectedRoute>
              }
            />{' '}
            {/* ETAPA 8: Módulo Projetos (Leitura: Admin, Comercial, Financeiro, Gestor; Gravação: Admin e Gestor) */}
            <Route
              path="/projetos"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <ProjetosPage />
                </ProtectedRoute>
              }
            />
            {/* RODADA 7: Painel de Monitoramento e Cobrança de Prazos (Admin e Gestor) */}
            <Route
              path="/monitoramento"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestor']}>
                  <MonitoramentoPrazosPage />
                </ProtectedRoute>
              }
            />
            {/* BLOCO 4: Gestão do Grupo de Projetos (Admin, Comercial, Financeiro, Gestor leem; Admin e Gestor operam) */}
            <Route
              path="/projetos/grupo/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <GrupoProjetosPage />
                </ProtectedRoute>
              }
            />
            {/* NOVO CONCEITO ÚNICO: Módulo Prestadores de Serviço */}
            <Route
              path="/prestadores"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestor', 'comercial']}>
                  <PrestadoresPage />
                </ProtectedRoute>
              }
            />
            {/* Redirecionamento legado: /executores -> /prestadores */}
            <Route path="/executores" element={<Navigate to="/prestadores" replace />} />
            {/* NOVO: Portal do Prestador (Acesso do Prestador Externo e Supervisão) */}
            <Route
              path="/portal-prestador"
              element={
                <ProtectedRoute allowedRoles={['executor', 'admin', 'gestor']}>
                  <PortalPrestadorPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 9: Módulo Financeiro & Fluxo de Caixa (Acesso restrito: Admin e Financeiro. Comercial, Gestor e Executor SEM acesso) */}
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute allowedRoles={['admin', 'financeiro']}>
                  <FinanceiroPage />
                </ProtectedRoute>
              }
            />
            {/* Rotas de Empresas / Cadastros (Etapa 2) */}
            <Route
              path="/empresas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <EmpresasPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 6: Módulo Parceiros Demandantes (Admin e Comercial gravam; Financeiro e Gestor leem) */}
            <Route
              path="/parceiros"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <ParceirosPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 6: Módulo Clientes PF (Admin e Comercial gravam; Financeiro e Gestor leem) */}
            <Route
              path="/clientes-pf"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <ClientesPfPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/empresas/importar"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <EmpresasImportarPage />
                </ProtectedRoute>
              }
            />
            {/* Rotas do Funil de Intermediação e Cadência (Etapas 3 e 4 - Admin e Comercial) */}
            <Route
              path="/acoes-do-dia"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <AcoesDoDiaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funil"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <FunilPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 5: Módulo de Campanhas de Nutrição Mensal (Admin e Comercial) */}
            <Route
              path="/campanhas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <CampanhasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funil/sugestoes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <FunilSugestoesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nao-contatar"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial']}>
                  <NaoContatarPage />
                </ProtectedRoute>
              }
            />
            {/* Admin only routes */}
            <Route
              path="/administracao"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdministracaoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditoriaPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
