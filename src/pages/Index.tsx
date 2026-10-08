import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import WelcomePage from './Welcome'

export default function IndexPage() {
  const { user, isAdmin } = useAuth()

  // Se for executor logado, vai direto para o Portal do Executor
  if (user?.role === 'executor') {
    return <Navigate to="/portal-executor" replace />
  }

  // If admin, redireciona para a tela inicial padrão: /dashboard (Etapa 11)
  if (isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <WelcomePage />
}
