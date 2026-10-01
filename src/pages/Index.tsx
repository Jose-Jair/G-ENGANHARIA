import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import WelcomePage from './Welcome'

export default function IndexPage() {
  const { user, isAdmin } = useAuth()

  // If admin, redireciona para a tela inicial padrão: /dashboard (Etapa 11)
  if (isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <WelcomePage />
}
