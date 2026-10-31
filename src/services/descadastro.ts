import pb from '@/lib/pocketbase/client'

export interface DescadastroInfo {
  token: string
  email: string
  destinatario_nome?: string
  empresa_nome: string
  ja_descadastrado: boolean
  data_descadastro?: string
}

export interface ConfirmarDescadastroPayload {
  token?: string
  email?: string
  motivo?: string
}

export const descadastroService = {
  // Consultar dados seguros do token ou e-mail (público)
  async getInfo(token: string): Promise<DescadastroInfo> {
    return await pb.send<DescadastroInfo>(
      `/backend/v1/descadastro/info/${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
    )
  },

  // Consultar status de descadastro por e-mail (público)
  async getInfoPorEmail(email: string): Promise<DescadastroInfo> {
    return await pb.send<DescadastroInfo>(
      `/backend/v1/descadastro/info-email?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
      },
    )
  },

  // Confirmar descadastro (público)
  async confirmar(
    payload: ConfirmarDescadastroPayload,
  ): Promise<{ success: boolean; message: string; email: string }> {
    return await pb.send<{ success: boolean; message: string; email: string }>(
      '/backend/v1/descadastro/confirmar',
      {
        method: 'POST',
        body: payload,
      },
    )
  },
}
