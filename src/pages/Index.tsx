import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import WelcomePage from './Welcome'

export default function IndexPage() {
  const { user, isAdmin } = useAuth()

  // If admin, can directly see administration or welcome
  // The task specifies:
  // 5. / : redireciona para o módulo padrão do perfil (admin → administração; outros → boas-vindas).
  if (isAdmin) {
    return <Navigate to="/administracao" replace />
  }

  return <WelcomePage />
}
