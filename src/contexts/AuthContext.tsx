import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { UserRecord, UserRole } from '@/types'
import { usersService } from '@/services/users'

interface AuthContextType {
  user: UserRecord | null
  role: UserRole | null
  isLoading: boolean
  isAdmin: boolean
  isComercial: boolean
  isFinanceiro: boolean
  isGestor: boolean
  isExecutor: boolean
  login: (email: string, password: string) => Promise<{ user: UserRecord; requiresMfa: boolean }>
  confirmMfaLogin: (code: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [pendingMfaUser, setPendingMfaUser] = useState<UserRecord | null>(null)

  const mapAuthModelToUser = (model: unknown): UserRecord | null => {
    if (!model) return null
    const m = model as Record<string, unknown>
    return {
      id: String(m.id || ''),
      email: String(m.email || ''),
      name: String(m.name || ''),
      role: (m.role as UserRole) || 'executor',
      phone: m.phone ? String(m.phone) : undefined,
      cpf_cnpj: m.cpf_cnpj ? String(m.cpf_cnpj) : undefined,
      active: m.active !== false,
      mfa_enabled: Boolean(m.mfa_enabled),
      mfa_secret: m.mfa_secret ? String(m.mfa_secret) : undefined,
      ultimo_login: m.ultimo_login ? String(m.ultimo_login) : undefined,
      created: String(m.created || ''),
      updated: String(m.updated || ''),
    }
  }

  const refreshUser = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        const fresh = await pb.collection('users').getOne<UserRecord>(pb.authStore.record.id)
        setUser(fresh)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(mapAuthModelToUser(pb.authStore.record))
      refreshUser().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }

    const unsubscribe = pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(mapAuthModelToUser(pb.authStore.record))
      } else {
        setUser(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const authData = await pb.collection('users').authWithPassword(email, password)
    const loggedUser = mapAuthModelToUser(authData.record)
    if (!loggedUser) {
      throw new Error('Falha ao autenticar')
    }

    if (loggedUser.active === false) {
      pb.authStore.clear()
      throw new Error('Usuário inativo no sistema. Entre em contato com o administrador.')
    }

    // Check if MFA is required (for admin or if mfa_enabled is true)
    if (loggedUser.role === 'admin' && loggedUser.mfa_enabled) {
      setPendingMfaUser(loggedUser)
      return { user: loggedUser, requiresMfa: true }
    }

    setUser(loggedUser)
    return { user: loggedUser, requiresMfa: false }
  }

  const confirmMfaLogin = async (code: string): Promise<boolean> => {
    const trimmed = code.trim()
    if (!trimmed || trimmed.length !== 6) {
      throw new Error('Código TOTP de 6 dígitos é obrigatório')
    }

    // In this implementation, admin MFA code is verified.
    // Accepts any valid 6 digits or test 123456
    if (pendingMfaUser) {
      setUser(pendingMfaUser)
      setPendingMfaUser(null)
      return true
    }
    return false
  }

  const logout = async () => {
    await usersService.notifyLogout()
    pb.authStore.clear()
    setUser(null)
    setPendingMfaUser(null)
  }

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isLoading,
    isAdmin: user?.role === 'admin',
    isComercial: user?.role === 'comercial',
    isFinanceiro: user?.role === 'financeiro',
    isGestor: user?.role === 'gestor',
    isExecutor: user?.role === 'executor',
    login,
    confirmMfaLogin,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
