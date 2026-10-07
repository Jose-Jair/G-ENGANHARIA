import pb from '@/lib/pocketbase/client'
import { UserRecord, UserRole } from '@/types'

export interface CreateUserData {
  email: string
  password?: string
  passwordConfirm?: string
  name: string
  role: UserRole
  phone?: string
  cpf_cnpj?: string
  active?: boolean
}

export const usersService = {
  async list(): Promise<UserRecord[]> {
    return await pb.collection('users').getFullList<UserRecord>({
      sort: 'name',
    })
  },

  async getById(id: string): Promise<UserRecord> {
    return await pb.collection('users').getOne<UserRecord>(id)
  },

  async create(data: CreateUserData): Promise<UserRecord> {
    const password = data.password || 'Eng@2024'
    return await pb.collection('users').create<UserRecord>({
      ...data,
      password,
      passwordConfirm: password,
      active: data.active ?? true,
      emailVisibility: false,
    })
  },

  async update(id: string, data: Partial<UserRecord>): Promise<UserRecord> {
    return await pb.collection('users').update<UserRecord>(id, data)
  },

  async toggleActive(id: string, currentActive: boolean): Promise<UserRecord> {
    return await pb.collection('users').update<UserRecord>(id, {
      active: !currentActive,
    })
  },

  async requestPasswordReset(email: string): Promise<boolean> {
    await pb.collection('users').requestPasswordReset(email)
    return true
  },

  async setupMfa(): Promise<{ secret: string; otpauth: string; email: string }> {
    return await pb.send('/backend/v1/mfa/setup', {
      method: 'POST',
    })
  },

  async enableMfa(code: string): Promise<{ success: boolean; message: string }> {
    return await pb.send('/backend/v1/mfa/enable', {
      method: 'POST',
      body: { code },
    })
  },

  async disableMfa(): Promise<{ success: boolean; message: string }> {
    return await pb.send('/backend/v1/mfa/disable', {
      method: 'POST',
    })
  },

  async notifyLogout(): Promise<void> {
    try {
      await pb.send('/backend/v1/auth/logout-audit', {
        method: 'POST',
      })
    } catch {
      /* intentionally ignored */
    }
  },

  async changePassword(
    oldPassword: string,
    newPassword: string,
    newPasswordConfirm: string,
  ): Promise<UserRecord> {
    const currentUserId = pb.authStore.model?.id
    if (!currentUserId) {
      throw new Error('Usuário não autenticado.')
    }
    const updated = await pb.collection('users').update<UserRecord>(currentUserId, {
      oldPassword,
      password: newPassword,
      passwordConfirm: newPasswordConfirm,
    })
    // Audit log da alteração de senha via endpoint no servidor
    try {
      await pb.send('/backend/v1/auditoria/registrar', {
        method: 'POST',
        body: {
          user_id: currentUserId,
          user_email: updated.email,
          acao: 'TROCA_SENHA_PROPRIA',
          entidade: 'users',
          registro_id: currentUserId,
          detalhes: {
            mensagem: 'Usuário alterou a própria senha com sucesso',
          },
        },
      })
    } catch {
      /* audit fail-safe */
    }
    return updated
  },
}
