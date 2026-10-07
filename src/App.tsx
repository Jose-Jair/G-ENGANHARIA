import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
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
import { ProjetosPage } from './pages/Projetos'
import { ExecutoresPage } from './pages/Executores'
import { CotacaoPublicaPage } from './pages/CotacaoPublica'
import { FinanceiroPage } from './pages/Financeiro'
import { ManualUsoPage } from './pages/ManualUso'
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

          {/* Rota pública de assinatura eletrônica do Contrato de Serviços GMAIS */}
          <Route path="/contrato-servico/:token" element={<ContratoServicoPublicoPage />} />

          {/* Rota pública de resposta de cotação do executor (Etapa 8) - sem login */}
          <Route path="/cotacao/:token" element={<CotacaoPublicaPage />} />

          {/* Authenticated routes wrapped with AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<IndexPage />} />
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
            {/* ETAPA 8: Módulo Projetos (Leitura: Admin, Comercial, Financeiro, Gestor; Gravação: Admin e Gestor) */}
            <Route
              path="/projetos"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <ProjetosPage />
                </ProtectedRoute>
              }
            />
            {/* ETAPA 8: Módulo Executores (Admin e Gestor gravam; Comercial leitura; Financeiro sem acesso) */}
            <Route
              path="/executores"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestor', 'comercial']}>
                  <ExecutoresPage />
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
