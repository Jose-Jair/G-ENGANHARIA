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
import EmpresasPage from './pages/Empresas'
import EmpresasImportarPage from './pages/EmpresasImportar'
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

          {/* Authenticated routes wrapped with AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<IndexPage />} />
            <Route path="/boas-vindas" element={<WelcomePage />} />

            {/* Rotas de Empresas / Cadastros (Etapa 2) */}
            <Route
              path="/empresas"
              element={
                <ProtectedRoute allowedRoles={['admin', 'comercial', 'financeiro', 'gestor']}>
                  <EmpresasPage />
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
