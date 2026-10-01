import pb from '@/lib/pocketbase/client'
import { cleanCnpj } from '@/lib/cnpj'

export interface BrasilApiCnpjResponse {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  situacao_cadastral: string
  descricao_situacao_cadastral?: string
  data_situacao_cadastral?: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  porte: string
  uf: string
  municipio: string
  bairro?: string
  logradouro?: string
  numero?: string
  cep?: string
  email?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
}

export const brasilApiService = {
  async consultarCnpj(cnpj: string): Promise<BrasilApiCnpjResponse> {
    const raw = cleanCnpj(cnpj)
    if (raw.length !== 14) {
      throw new Error('CNPJ deve conter 14 dígitos')
    }

    // 1ª tentativa: endpoint seguro no backend para evitar CORS
    try {
      const response = await pb.send<BrasilApiCnpjResponse>(`/backend/v1/cnpj/${raw}`, {
        method: 'GET',
      })
      if (response && (response.razao_social || response.cnpj)) {
        return response
      }
    } catch (err: unknown) {
      console.warn('Backend proxy falhou, tentando direto no frontend:', err)
    }

    // 2ª tentativa: chamada direta da BrasilAPI pelo frontend
    let directRes: Response
    try {
      directRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`, {
        headers: {
          Accept: 'application/json',
        },
      })
    } catch (netErr: unknown) {
      console.warn('Falha de rede ao chamar BrasilAPI direta:', netErr)
      throw new Error('Falha de conexão com o serviço BrasilAPI. Preencha os campos manualmente.')
    }

    if (!directRes.ok) {
      if (directRes.status === 404) {
        throw new Error('CNPJ não encontrado na base pública da Receita Federal')
      }
      throw new Error(`Falha ao consultar CNPJ na BrasilAPI (código ${directRes.status})`)
    }

    const data = (await directRes.json()) as BrasilApiCnpjResponse
    return data
  },
}
